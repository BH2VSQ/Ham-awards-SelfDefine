import express from 'express';
import http from 'http';
import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import otplib from 'otplib';
import qrcode from 'qrcode';
import cors from 'cors';
import * as Minio from 'minio';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// 配置上传
const upload = multer({ dest: 'uploads/' });

const CONFIG_FILE = path.join(__dirname, 'config.json');

// 2FA 配置
otplib.authenticator.options = { window: 1 };

let dbPool = null;
let minioClient = null;
let appConfig = { 
    installed: false, 
    useHttps: false,
    minio: null,
    minioBucket: 'ham-awards',
    jwtSecret: 'default_secret_change_on_install',
    adminPath: 'admin' 
};

/**
 * ==========================================
 * 1. 工具函数：ADIF 解析 & MinIO 初始化
 * ==========================================
 */
function parseAdif(adifString) {
  const records = [];
  const parts = adifString.split(/<eor>/i); 
  
  for (let part of parts) {
    if (!part.trim()) continue;
    const record = {};
    const regex = /<([a-zA-Z0-9_]+):(\d+)(?::[a-zA-Z])?>([^<]*)/g;
    let match;
    while ((match = regex.exec(part)) !== null) {
      const field = match[1].toLowerCase();
      const length = parseInt(match[2]);
      const data = match[3].substring(0, length);
      record[field] = data.trim();
    }
    if (record.call && record.qso_date) {
      records.push(record);
    }
  }
  return records;
}

async function initMinioBucket() {
    if (!minioClient || !appConfig.minioBucket) return;
    try {
        const exists = await minioClient.bucketExists(appConfig.minioBucket);
        if (!exists) {
            await minioClient.makeBucket(appConfig.minioBucket, 'us-east-1');
            console.log(`Bucket '${appConfig.minioBucket}' created successfully.`);
            const policy = {
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: { AWS: ["*"] },
                    Action: ["s3:GetObject"],
                    Resource: [`arn:aws:s3:::${appConfig.minioBucket}/*`]
                }]
            };
            await minioClient.setBucketPolicy(appConfig.minioBucket, JSON.stringify(policy));
        }
    } catch (err) {
        console.error("MinIO Bucket init error:", err);
    }
}

/**
 * ==========================================
 * 2. 系统初始化
 * ==========================================
 */
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      appConfig = { ...appConfig, ...data };
      
      if (appConfig.installed && appConfig.db) {
        dbPool = new Pool(appConfig.db);
        console.log("Database pool initialized.");
        upgradeSchema();
      }
      if (appConfig.minio && appConfig.minio.endPoint) {
        minioClient = new Minio.Client(appConfig.minio);
        console.log("MinIO client initialized.");
        initMinioBucket();
      }
    } catch (e) { 
      console.error("Config load error:", e);
      appConfig.installed = false;
    }
  } else {
    appConfig.installed = false;
  }
}

async function upgradeSchema() {
  if (!dbPool) return;
  const client = await dbPool.connect();
  try {
    // 基础用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        callsign VARCHAR(20) UNIQUE NOT NULL, 
        password_hash TEXT NOT NULL, 
        role VARCHAR(20) DEFAULT 'user', 
        totp_secret TEXT, 
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 修复 last_seen
    const checkCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='last_seen'");
    if (checkCol.rows.length === 0) {
        await client.query("ALTER TABLE users ADD COLUMN last_seen TIMESTAMP DEFAULT NOW()");
    }

    // QSO 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS qsos (
        id SERIAL PRIMARY KEY, 
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        callsign VARCHAR(20),
        band VARCHAR(10),
        mode VARCHAR(10),
        dxcc VARCHAR(10),
        country VARCHAR(100),
        qso_date VARCHAR(20),
        adif_raw JSONB NOT NULL, 
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, callsign, band, mode, qso_date)
      );
    `);

    // Awards 表 - 包含新字段 tracking_id, audit_log, reject_reason
    await client.query(`
      CREATE TABLE IF NOT EXISTS awards (
        id SERIAL PRIMARY KEY, 
        name TEXT NOT NULL, 
        description TEXT, 
        bg_url TEXT,
        rules JSONB DEFAULT '[]', 
        layout JSONB DEFAULT '[]', 
        status VARCHAR(20) DEFAULT 'draft',
        creator_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        tracking_id VARCHAR(50),
        audit_log JSONB DEFAULT '[]',
        reject_reason TEXT
      );
    `);
    
    // 检查并添加新列 (用于旧数据库升级)
    const awardCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='awards'");
    const cols = awardCols.rows.map(r => r.column_name);
    if (!cols.includes('tracking_id')) await client.query("ALTER TABLE awards ADD COLUMN tracking_id VARCHAR(50)");
    if (!cols.includes('audit_log')) await client.query("ALTER TABLE awards ADD COLUMN audit_log JSONB DEFAULT '[]'");
    if (!cols.includes('reject_reason')) await client.query("ALTER TABLE awards ADD COLUMN reject_reason TEXT");

    await client.query(`
        CREATE TABLE IF NOT EXISTS user_awards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE,
            issued_at TIMESTAMP DEFAULT NOW(),
            serial_number VARCHAR(20),
            level VARCHAR(50),
            score_snapshot INTEGER
        );
    `);
    
    // Check user_awards columns for upgrade
    const uaCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='user_awards'");
    const uaColNames = uaCols.rows.map(r => r.column_name);
    if (!uaColNames.includes('serial_number')) await client.query("ALTER TABLE user_awards ADD COLUMN serial_number VARCHAR(20)");
    if (!uaColNames.includes('level')) await client.query("ALTER TABLE user_awards ADD COLUMN level VARCHAR(50)");
    if (!uaColNames.includes('score_snapshot')) await client.query("ALTER TABLE user_awards ADD COLUMN score_snapshot INTEGER");


    console.log("Database schema checked.");
  } catch (err) {
    console.error("Schema upgrade error:", err.message);
  } finally {
    client.release();
  }
}

/**
 * ==========================================
 * 3. 核心逻辑：奖状判定引擎 (Advanced Award Engine)
 * ==========================================
 */

const categorizeMode = (mode) => {
    mode = mode?.toUpperCase() || '';
    if (['CW'].includes(mode)) return 'cw';
    if (['SSB', 'AM', 'FM', 'USB', 'LSB'].includes(mode)) return 'phone';
    // All digital modes default to data
    if (['FT8', 'FT4', 'RTTY', 'PSK31', 'JT65', 'JS8'].includes(mode)) return 'data';
    return 'data'; // Default to data for unknown
};

const evaluateAward = async (userId, awardId, includeQsos = false) => {
    const client = await dbPool.connect();
    try {
        const awardRes = await client.query('SELECT * FROM awards WHERE id = $1', [awardId]);
        if (awardRes.rows.length === 0) throw new Error('Award not found');
        const award = awardRes.rows[0];
        const rules = award.rules; // JSONB

        // Legacy compatibility for simple V1 rules
        if (Array.isArray(rules) && !rules.v2) {
             return { eligible: false, current_score: 0, target_score: 1, details: { msg: '旧版规则不兼容自动检查' } };
        }

        // Fetch user QSOs
        // In production, optimize this to only fetch relevant columns or use DB filtering
        const qsoRes = await client.query('SELECT * FROM qsos WHERE user_id = $1', [userId]);
        const qsos = qsoRes.rows;

        // --- Step 1: Filter ---
        let filteredQsos = qsos.filter(q => {
            const raw = q.adif_raw;
            // Date Filter
            if (rules.basic?.startDate) {
                const qDate = raw.qso_date || q.qso_date;
                // ADIF date format is usually YYYYMMDD
                const qDateFormatted = qDate.length === 8 ? `${qDate.slice(0,4)}-${qDate.slice(4,6)}-${qDate.slice(6,8)}` : qDate;
                if (qDateFormatted < rules.basic.startDate) return false;
            }
            if (rules.basic?.endDate) {
                const qDate = raw.qso_date || q.qso_date;
                const qDateFormatted = qDate.length === 8 ? `${qDate.slice(0,4)}-${qDate.slice(4,6)}-${qDate.slice(6,8)}` : qDate;
                if (qDateFormatted > rules.basic.endDate) return false;
            }
            
            // QSL Required
            if (rules.basic?.qslRequired) {
                // Check common ADIF qsl fields
                const qslR = raw.qsl_rcvd?.toUpperCase() === 'Y';
                const lotwR = raw.lotw_qsl_rcvd?.toUpperCase() === 'Y';
                if (!qslR && !lotwR) return false;
            }

            // Custom Filters
            if (rules.filters && Array.isArray(rules.filters)) {
                for (const f of rules.filters) {
                    if (!f.field || !f.value || f.value === 'ANY') continue;
                    const val = (raw[f.field.toLowerCase()] || q[f.field.toLowerCase()] || '').toString().toUpperCase();
                    const targetVal = f.value.toUpperCase();
                    
                    if (f.operator === 'eq' && val !== targetVal) return false;
                    if (f.operator === 'neq' && val === targetVal) return false;
                    if (f.operator === 'contains' && !val.includes(targetVal)) return false;
                    // Add more operators as needed
                }
            }
            return true;
        });

        // --- Step 2: Target Matching & Scoring ---
        const logic = rules.logic || 'collection';
        const targetType = rules.targets?.type || 'any';
        const rawTargetList = rules.targets?.list ? rules.targets.list.split(',').map(s=>s.trim().toUpperCase()).filter(s=>s) : [];
        const targetSet = new Set(rawTargetList);
        
        // Helper to get target value from QSO
        const getTargetValue = (qso) => {
            const raw = qso.adif_raw;
            if (targetType === 'any') return `${raw.call}-${raw.qso_date}-${raw.time_on}`; // Unique QSO for "Any" in collection logic? Or logic=points just counts.
            if (targetType === 'callsign') return (qso.callsign || raw.call).toUpperCase();
            if (targetType === 'dxcc') return (qso.dxcc || raw.dxcc);
            if (targetType === 'grid') return (raw.gridsquare || '').substring(0,4).toUpperCase();
            if (targetType === 'iota') return (raw.iota || '').toUpperCase();
            if (targetType === 'state') return (raw.state || '').toUpperCase();
            return null;
        };

        // If Target List is provided, filter further
        // 修正：对于全收集类型，不应在这里过滤掉非目标QSO，否则"missing"计算会出错？
        // 不，应该过滤。如果QSO的目标值不在TargetList里，它对全收集也没用。
        if (targetSet.size > 0) {
            filteredQsos = filteredQsos.filter(q => {
                const val = getTargetValue(q);
                return val && targetSet.has(val);
            });
        }

        let score = 0;
        let uniqueSet = new Set();
        let qsoMap = new Map(); // Key -> QSO Object (for display)

        // --- Step 3: Calculation ---
        if (logic === 'collection') {
            // Count unique entities
            filteredQsos.forEach(q => {
                const key = getTargetValue(q);
                if (key) {
                    uniqueSet.add(key);
                    // Store the first matching QSO for this target for display
                    if (!qsoMap.has(key)) qsoMap.set(key, q);
                }
            });
            score = uniqueSet.size;
        } else {
            // Points Calculation
            const deduplication = rules.deduplication || 'none';
            const scoring = rules.scoring || { cw: 1, phone: 1, data: 1 };
            
            for (const q of filteredQsos) {
                const call = (q.callsign || q.adif_raw.call).toUpperCase();
                const band = (q.band || q.adif_raw.band).toUpperCase();
                const modeCat = categorizeMode(q.mode || q.adif_raw.mode);
                const mode = (q.mode || q.adif_raw.mode).toUpperCase();

                // Deduplication Key Construction
                let dedupKey = null;
                if (deduplication === 'call') dedupKey = call;
                else if (deduplication === 'call_band') dedupKey = `${call}-${band}`;
                else if (deduplication === 'slot') dedupKey = `${call}-${band}-${mode}`;
                // New Deduplication Options
                else if (deduplication === 'state') dedupKey = (q.state || q.adif_raw.state || '').toUpperCase();
                else if (deduplication === 'custom') {
                    const field = rules.deduplicationCustomField || 'call';
                    dedupKey = (q[field] || q.adif_raw[field] || '').toString().toUpperCase();
                }
                // 'none' means no key

                if (dedupKey) {
                    if (uniqueSet.has(dedupKey)) continue; // Skip duplicate
                    uniqueSet.add(dedupKey);
                }

                // Add points
                score += (scoring[modeCat] || 0);
            }
        }

        // --- Breakdown for specific targets (Pre-calculation) ---
        let breakdown = null;
        if (targetSet.size > 0) {
            const missing = [];
            const achieved_list = [];
            // Iterate over the required list to preserve order or just check set
            // Wait, rules.targets.list is the master list
            rawTargetList.forEach(t => {
                if (uniqueSet.has(t)) {
                    achieved_list.push({ target: t, qso: qsoMap.get(t) }); // Store full info
                } else {
                    missing.push(t);
                }
            });
            breakdown = {
                total_required: targetSet.size,
                achieved: achieved_list, // Array of Objects or Strings? Let's use objects for detail view
                achieved_keys: Array.from(uniqueSet), // Just keys
                missing: missing
            };
        }

        // --- Step 4: Multi-level Thresholds (NEW: Independent Full Collection) ---
        // Normalize thresholds to array and sort descending by value
        let thresholds = rules.thresholds || [{ name: 'Award', value: 1 }];
        if (!Array.isArray(thresholds)) thresholds = [thresholds];
        
        // Sort: High score first. If values are same, maybe prioritize 'fullCollection'?
        // Generally user defines levels like Bronze (10), Silver (20), Gold (20 + All)
        thresholds.sort((a, b) => b.value - a.value);

        // Find the highest achieved level
        const achieved = thresholds.find(t => {
            const scoreMet = score >= t.value;
            // 3. 全收集独立于分数，和分数并列为奖项的判定条件
            // Check if this threshold requires full collection
            const collectionMet = !t.fullCollection || (breakdown && breakdown.missing.length === 0);
            return scoreMet && collectionMet;
        });

        // Find next target (logic is tricky with mixed conditions, assume next score target for now)
        const next_target = thresholds.slice().reverse().find(t => score < t.value) || thresholds[0];

        // Fetch claimed levels
        const claimedRes = await client.query('SELECT level FROM user_awards WHERE user_id=$1 AND award_id=$2', [userId, awardId]);
        const claimedLevels = claimedRes.rows.map(r => r.level);

        return {
            eligible: !!achieved,
            current_score: score,
            target_score: next_target.value,
            achieved_level: achieved, // { name, value, color, fullCollection }
            next_level: next_target,
            claimed_levels: claimedLevels,
            thresholds: thresholds, // Return all levels for UI
            breakdown,
            matching_qsos: includeQsos ? filteredQsos.map(q => ({
                id: q.id,
                call: q.callsign || q.adif_raw.call,
                band: q.band || q.adif_raw.band,
                mode: q.mode || q.adif_raw.mode,
                date: q.qso_date,
                grid: q.adif_raw.gridsquare,
                // Add fields for display logic
                ...q.adif_raw // safe to spread for frontend display if needed
            })) : undefined,
            details: {
                msg: achieved 
                    ? `已达成: ${achieved.name} (${score}${achieved.fullCollection ? ' + Full' : ''})` 
                    : `当前 ${score}，下一目标 ${next_target.value} (${next_target.name})`
            }
        };

    } finally {
        client.release();
    }
};

/**
 * ==========================================
 * 4. 中间件与权限
 * ==========================================
 */

const verifyToken = async (req, res, next) => {
  if (!appConfig.installed && req.path.startsWith('/api/install')) return next();
  if (req.path === '/api/system-status' || req.path === '/api/auth/login' || req.path === '/api/auth/register') return next(); 

  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'TOKEN_MISSING', message: '未提供验证令牌' });
  
  let decoded;
  try {
    decoded = jwt.verify(token.split(' ')[1], appConfig.jwtSecret);
  } catch (err) { 
    return res.status(401).json({ error: 'TOKEN_INVALID', message: '无效或过期的令牌' }); 
  }

  req.user = decoded; 
  if (dbPool && req.user && req.user.id) {
      dbPool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.id])
          .catch(err => console.error("Update last_seen failed:", err.message));
  }
  next();
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'PERMISSION_DENIED', message: '需要系统管理员权限' });
  next();
};

const verifyAwardAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'award_admin') return res.status(403).json({ error: 'PERMISSION_DENIED', message: '需要奖状管理员权限' });
  next();
};

const require2FA = async (req, res, next) => {
    try {
        const result = await dbPool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
        const secret = result.rows[0]?.totp_secret;
        if (!secret) return next(); 

        const code = req.headers['x-2fa-code']; 
        if (!code) return res.status(403).json({ error: '2FA_REQUIRED', message: '此操作需要2FA验证' });
        
        if (!otplib.authenticator.check(code, secret)) {
            return res.status(403).json({ error: 'INVALID_2FA', message: '验证码错误' });
        }
        next();
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
};

const requirePassword = async (req, res, next) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'PASSWORD_REQUIRED', message: '需要密码确认' });
    try {
        const r = await dbPool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        const match = await bcrypt.compare(password, r.rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'PASSWORD_INVALID', message: '密码错误' });
        next();
    } catch(e) { res.status(500).json({ error: 'Server Error' }); }
};

/**
 * ==========================================
 * 5. API 路由
 * ==========================================
 */

// --- 基础 & 认证 ---

app.get('/api/system-status', (req, res) => {
    res.json({ 
        installed: appConfig.installed, 
        useHttps: appConfig.useHttps,
        adminPath: appConfig.adminPath || 'admin',
        minioConfigured: !!appConfig.minio
    });
});

app.post('/api/install', async (req, res) => {
  if (appConfig.installed) return res.status(400).json({ error: '系统已安装' });
  const { dbHost, dbPort, dbUser, dbPass, dbName, adminCall, adminPass, adminPath, minio, useHttps, minioBucket } = req.body;
  
  let tempPool = new Pool({ user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort });
  let client;

  try {
    client = await tempPool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, callsign VARCHAR(20) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(20) DEFAULT 'user', totp_secret TEXT, created_at TIMESTAMP DEFAULT NOW(), last_seen TIMESTAMP DEFAULT NOW());
    `);
    
    const hash = await bcrypt.hash(adminPass, 10);
    await client.query('DELETE FROM users WHERE callsign = $1', [adminCall.toUpperCase()]);
    await client.query(`INSERT INTO users (callsign, password_hash, role) VALUES ($1, $2, 'admin')`, [adminCall.toUpperCase(), hash]);

    const newConfig = { 
        installed: true, 
        jwtSecret: crypto.randomBytes(64).toString('hex'), 
        db: { user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort },
        minio: minio,
        minioBucket: minioBucket || 'ham-awards', 
        useHttps: !!useHttps,
        adminPath: adminPath || 'admin'
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    appConfig = newConfig; 
    dbPool = tempPool;
    
    if (appConfig.minio) {
        minioClient = new Minio.Client(appConfig.minio);
        await initMinioBucket(); 
    }
    
    await upgradeSchema();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); } finally { if (client) client.release(); }
});

app.post('/api/auth/login', async (req, res) => {
    const { callsign, password, code } = req.body;
    try {
        const result = await dbPool.query(`SELECT * FROM users WHERE callsign = $1`, [callsign.toUpperCase()]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'AUTH_FAILED', message: '用户不存在' });
        const user = result.rows[0];

        const passMatch = await bcrypt.compare(password, user.password_hash);
        if (!passMatch) return res.status(401).json({ error: 'AUTH_FAILED', message: '密码错误' });

        // Removed role guard to allow merged login
        // if (loginType === 'admin' && user.role === 'user') { ... }

        if (user.totp_secret) {
            if (!code) return res.status(403).json({ error: '2FA_REQUIRED', message: '请输入两步验证码' });
            if (!otplib.authenticator.check(code, user.totp_secret)) return res.status(403).json({ error: 'INVALID_2FA', message: '验证码无效' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, callsign: user.callsign }, appConfig.jwtSecret, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, callsign: user.callsign, role: user.role, has2fa: !!user.totp_secret } });
    } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

app.post('/api/auth/register', async (req, res) => {
    const { callsign, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await dbPool.query(`INSERT INTO users (callsign, password_hash, role) VALUES ($1, $2, 'user')`, [callsign.toUpperCase(), hash]);
        res.json({ success: true });
    } catch (e) {
        if (e.code === '23505') res.status(400).json({ error: 'EXISTS', message: '呼号已被注册' });
        else res.status(500).json({ error: 'ERROR', message: e.message });
    }
});

// --- 统计概览 ---

app.get('/api/stats/dashboard', verifyToken, async (req, res) => {
    const { role, id } = req.user;
    const client = await dbPool.connect();
    
    try {
        let stats = {};

        if (role === 'user') {
            const qsoCount = await client.query('SELECT count(*) FROM qsos WHERE user_id=$1', [id]);
            const bandCount = await client.query('SELECT count(DISTINCT band) FROM qsos WHERE user_id=$1', [id]);
            const modeCount = await client.query('SELECT count(DISTINCT mode) FROM qsos WHERE user_id=$1', [id]);
            const dxccCount = await client.query('SELECT count(DISTINCT dxcc) FROM qsos WHERE user_id=$1', [id]);
            const awardCount = await client.query('SELECT count(*) FROM user_awards WHERE user_id=$1', [id]);

            stats = {
                qsos: qsoCount.rows[0].count,
                bands: bandCount.rows[0].count,
                modes: modeCount.rows[0].count,
                dxccs: dxccCount.rows[0].count,
                my_awards: awardCount.rows[0].count
            };
        } else if (role === 'award_admin') {
            // 修正：奖状管理员只看自己的数据
            const totalApproved = await client.query("SELECT count(*) FROM awards WHERE creator_id=$1 AND status = 'approved'", [id]);
            const myDrafts = await client.query("SELECT count(*) FROM awards WHERE creator_id=$1 AND status='draft'", [id]);
            const pending = await client.query("SELECT count(*) FROM awards WHERE creator_id=$1 AND status='pending'", [id]);
            const returned = await client.query("SELECT count(*) FROM awards WHERE creator_id=$1 AND status='returned'", [id]);
            
            stats = {
                my_approved: totalApproved.rows[0].count,
                my_drafts: myDrafts.rows[0].count,
                my_pending: pending.rows[0].count,
                my_returned: returned.rows[0].count
            };
        } else if (role === 'admin') {
            const onlineTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            let onlineUsers = { rows: [] };
            try {
                onlineUsers = await client.query(`SELECT role, count(*) as count FROM users WHERE last_seen > $1 GROUP BY role`, [onlineTime]);
            } catch (err) {}

            const totalUsers = await client.query('SELECT role, count(*) as count FROM users GROUP BY role');
            const totalAwards = await client.query("SELECT count(*) FROM awards WHERE status = 'approved'");
            const pendingAwards = await client.query("SELECT count(*) FROM awards WHERE status = 'pending'");
            // 修正：显示当前系统中已经颁发的全部奖状计数
            const totalIssued = await client.query("SELECT count(*) FROM user_awards");

            stats = {
                system_status: 'running',
                online_users: onlineUsers.rows,
                total_users: totalUsers.rows,
                awards_approved: totalAwards.rows[0].count,
                awards_pending: pendingAwards.rows[0].count,
                awards_issued: totalIssued.rows[0].count // Added global total count
            };
        }
        res.json(stats);
    } catch (e) {
        console.error("Dashboard error:", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});


// --- 用户中心 ---

app.get('/api/user/profile', verifyToken, async (req, res) => {
    const r = await dbPool.query('SELECT id, callsign, role, totp_secret, created_at FROM users WHERE id=$1', [req.user.id]);
    const u = r.rows[0];
    res.json({ ...u, has2fa: !!u.totp_secret, totp_secret: undefined });
});

app.post('/api/user/2fa/setup', verifyToken, async (req, res) => {
    const secret = otplib.authenticator.generateSecret();
    const otpauth = otplib.authenticator.keyuri(req.user.callsign, 'HamAwards', secret);
    const imgData = await qrcode.toDataURL(otpauth);
    res.json({ secret, qr: imgData });
});

app.post('/api/user/2fa/enable', verifyToken, async (req, res) => {
    const { secret, token } = req.body;
    if (otplib.authenticator.check(token, secret)) {
        await dbPool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.id]);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: '验证码无效' });
    }
});

app.post('/api/user/2fa/disable', verifyToken, async (req, res) => {
    const { password } = req.body;
    const client = await dbPool.connect();
    try {
        const r = await client.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        const match = await bcrypt.compare(password, r.rows[0].password_hash);
        if(!match) return res.status(401).json({error: '密码错误'});
        await client.query('UPDATE users SET totp_secret=NULL WHERE id=$1', [req.user.id]);
        res.json({ success: true });
    } finally { client.release(); }
});

app.post('/api/user/password', verifyToken, require2FA, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const client = await dbPool.connect();
    try {
        const r = await client.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        const match = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
        if(!match) return res.status(401).json({error: '旧密码错误'});
        const hash = await bcrypt.hash(newPassword, 10);
        await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
        res.json({ success: true });
    } finally { client.release(); }
});

app.delete('/api/user/logs', verifyToken, requirePassword, require2FA, async (req, res) => {
    await dbPool.query('DELETE FROM qsos WHERE user_id=$1', [req.user.id]);
    res.json({ success: true });
});

app.delete('/api/user/account', verifyToken, requirePassword, require2FA, async (req, res) => {
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        // 将该用户创建的奖状设置为无主 (避免外键约束错误)
        await client.query('UPDATE awards SET creator_id = NULL WHERE creator_id = $1', [req.user.id]);
        // 删除用户 (QSOS 和 user_awards 会自动级联删除)
        await client.query('DELETE FROM users WHERE id=$1', [req.user.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// --- 日志上传 ---

app.post('/api/logbook/upload', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const raw = fs.readFileSync(req.file.path, 'utf8');
        const records = parseAdif(raw);
        let imported = 0;
        const client = await dbPool.connect();
        try {
            await client.query('BEGIN');
            for (let r of records) {
                await client.query(`
                    INSERT INTO qsos (user_id, callsign, band, mode, qso_date, dxcc, country, adif_raw)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (user_id, callsign, band, mode, qso_date) DO NOTHING
                `, [req.user.id, r.call || '', r.band || '', r.mode || '', r.qso_date || '', r.dxcc || '', r.country || '', JSON.stringify(r)]);
                imported++;
            }
            await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); fs.unlinkSync(req.file.path); }
        res.json({ success: true, count: records.length, imported });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 奖状管理 (核心重构) ---

// 获取我的奖状 (奖状管理员)
app.get('/api/awards/my', verifyToken, verifyAwardAdmin, async (req, res) => {
    const { status } = req.query;
    let query = `SELECT * FROM awards WHERE creator_id = $1`;
    const params = [req.user.id];
    
    if (status) {
        if (status === 'drafts') {
            // drafts: 包含纯草稿
            query += ` AND status = 'draft'`;
        } else if (status === 'returned') {
            query += ` AND status = 'returned'`;
        } else if (status === 'audit_list') {
            // audit_list: 包含历史提交记录 (pending, approved, returned)
            query += ` AND status IN ('pending', 'approved', 'returned')`;
        }
    }
    
    query += ` ORDER BY created_at DESC`;
    const r = await dbPool.query(query, params);
    res.json(r.rows);
});

// 获取所有已发布的奖状 (公共大厅 / 系统总览)
app.get('/api/awards/all_approved', verifyToken, async (req, res) => {
    const r = await dbPool.query(`SELECT * FROM awards WHERE status = 'approved' ORDER BY id DESC`);
    res.json(r.rows);
});

// 系统管理员：获取待审核奖状
app.get('/api/admin/awards/pending', verifyToken, verifyAdmin, async (req, res) => {
    const r = await dbPool.query(`SELECT awards.*, users.callsign as creator_call FROM awards JOIN users ON awards.creator_id = users.id WHERE status = 'pending' ORDER BY created_at ASC`);
    res.json(r.rows);
});

// 系统管理员：获取已发布奖状 (用于抽查)
app.get('/api/admin/awards/approved', verifyToken, verifyAdmin, async (req, res) => {
    const r = await dbPool.query(`SELECT awards.*, users.callsign as creator_call FROM awards JOIN users ON awards.creator_id = users.id WHERE status = 'approved' ORDER BY created_at DESC`);
    res.json(r.rows);
});

// 系统管理员：获取已颁发奖状列表 (New)
app.get('/api/admin/issued-awards', verifyToken, verifyAdmin, async (req, res) => {
    const r = await dbPool.query(`
        SELECT ua.id, ua.serial_number, ua.issued_at, ua.level, 
               u.callsign as applicant_call, 
               a.name as award_name, a.tracking_id
        FROM user_awards ua
        JOIN users u ON ua.user_id = u.id
        JOIN awards a ON ua.award_id = a.id
        ORDER BY ua.issued_at DESC
    `);
    res.json(r.rows);
});

// 系统管理员：删除/撤销已颁发的奖状 (New)
app.delete('/api/admin/issued-awards/:id', verifyToken, verifyAdmin, async (req, res) => {
    await dbPool.query('DELETE FROM user_awards WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// 系统管理员：审核操作 (通过/打回/撤回)
app.post('/api/admin/awards/audit', verifyToken, verifyAdmin, async (req, res) => {
    const { id, action, reason } = req.body; // action: 'approve', 'reject', 'recall'
    
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        const old = await client.query('SELECT status, audit_log FROM awards WHERE id=$1', [id]);
        if(old.rows.length === 0) throw new Error("Award not found");
        
        let newStatus = '';
        let logEntry = {
            time: new Date().toISOString(),
            actor: req.user.callsign,
            action: action,
            reason: reason || ''
        };
        
        let currentLog = old.rows[0].audit_log || [];
        
        if (action === 'approve') {
            newStatus = 'approved';
        } else if (action === 'reject' || action === 'recall') {
            newStatus = 'returned';
            if (!reason) throw new Error("必须填写打回/撤回原因");
        } else {
            throw new Error("Invalid action");
        }

        currentLog.push(logEntry);

        await client.query(
            `UPDATE awards SET status=$1, audit_log=$2, reject_reason=$3 WHERE id=$4`,
            [newStatus, JSON.stringify(currentLog), reason || null, id]
        );
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// 创建/更新奖状 (奖状管理员)
app.post('/api/awards', verifyToken, verifyAwardAdmin, async (req, res) => {
    const { id, name, description, rules, layout, bg_url, status } = req.body;
    
    // 生成/更新 tracking_id 和日志
    const trackingId = id ? undefined : crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

        let logEntry = {
            time: new Date().toISOString(),
            actor: req.user.callsign,
            action: status === 'pending' ? 'submitted' : 'saved_draft',
            details: status === 'pending' ? '提交审核' : '保存草稿'
        };

        if (id) {
            // 更新
            const old = await client.query('SELECT audit_log FROM awards WHERE id=$1', [id]);
            let logs = old.rows[0].audit_log || [];
            logs.push(logEntry);
            
            // 如果是重新提交，清空拒绝原因
            const rejectReasonUpdate = status === 'pending' ? null : undefined;
            
            let updateSql = `UPDATE awards SET name=$1, description=$2, rules=$3, layout=$4, bg_url=$5, status=$6, audit_log=$7`;
            let params = [name, description, JSON.stringify(rules), JSON.stringify(layout), bg_url, status, JSON.stringify(logs)];
            
            if (status === 'pending') {
                updateSql += `, reject_reason=NULL`; // 清空原因
            }
            
            updateSql += ` WHERE id=$8`;
            params.push(id);
            
            await client.query(updateSql, params);
            res.json({ success: true, id });
        } else {
            // 新建
            await client.query(
                `INSERT INTO awards (name, description, rules, layout, bg_url, status, creator_id, tracking_id, audit_log) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [name, description, JSON.stringify(rules), JSON.stringify(layout), bg_url, status, req.user.id, trackingId, JSON.stringify([logEntry])]
            );
            res.json({ success: true });
        }
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.delete('/api/awards/:id', verifyToken, verifyAwardAdmin, async (req, res) => {
    // 只能删除自己的 Draft 或 Returned
    await dbPool.query(`DELETE FROM awards WHERE id=$1 AND creator_id=$2 AND status IN ('draft', 'returned')`, [req.params.id, req.user.id]);
    res.json({ success: true });
});

app.post('/api/awards/upload-bg', verifyToken, verifyAwardAdmin, upload.single('bg'), async (req, res) => {
    if (!req.file || !minioClient) return res.status(400).json({ error: 'Upload failed or MinIO not configured' });
    const meta = { 'Content-Type': req.file.mimetype };
    const fileName = `awards/bg_${Date.now()}_${req.file.originalname}`;
    try {
        await minioClient.putObject(appConfig.minioBucket, fileName, fs.createReadStream(req.file.path), meta);
        const protocol = appConfig.minio.useSSL ? 'https://' : 'http://';
        const fullUrl = `${protocol}${appConfig.minio.endPoint}:${appConfig.minio.port}/${appConfig.minioBucket}/${fileName}`;
        fs.unlinkSync(req.file.path);
        res.json({ url: fullUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 奖状申请 & 检查 API (New) ---

app.get('/api/awards/:id/check', verifyToken, async (req, res) => {
    try {
        const includeQsos = req.query.include_qsos === 'true';
        const result = await evaluateAward(req.user.id, req.params.id, includeQsos);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/awards/:id/apply', verifyToken, async (req, res) => {
    try {
        const { eligible, achieved_level, current_score } = await evaluateAward(req.user.id, req.params.id);
        if (!eligible) return res.status(400).json({ error: 'Conditions not met', message: '未满足申请条件' });

        const levelName = achieved_level.name;

        // Check if already applied for this level
        const exists = await dbPool.query('SELECT id FROM user_awards WHERE user_id=$1 AND award_id=$2 AND level=$3', [req.user.id, req.params.id, levelName]);
        if (exists.rows.length > 0) return res.status(400).json({ error: 'Already applied', message: `您已领取过此等级(${levelName})的奖状` });

        // Generate 16-digit Serial
        // Using random bytes to ensure uniqueness and length 
        // 16 digits: 10^16 possibilities. 
        // Simple random number string
        let serial = '';
        while(serial.length < 16) {
             serial += Math.floor(Math.random() * 10).toString();
        }

        await dbPool.query(
            'INSERT INTO user_awards (user_id, award_id, level, score_snapshot, serial_number) VALUES ($1, $2, $3, $4, $5)', 
            [req.user.id, req.params.id, levelName, current_score, serial]
        );
        res.json({ success: true, serial, level: levelName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user/my-awards', verifyToken, async (req, res) => {
    // Join user_awards with awards to get details
    // Added a.rules to fetch badge colors
    const result = await dbPool.query(`
        SELECT ua.*, a.name, a.bg_url, a.description, a.tracking_id, a.rules
        FROM user_awards ua
        JOIN awards a ON ua.award_id = a.id
        WHERE ua.user_id = $1
        ORDER BY ua.issued_at DESC
    `, [req.user.id]);
    res.json(result.rows);
});

// API for User Logbook (View All) - Verified Logic
app.get('/api/user/qsos', verifyToken, async (req, res) => {
    try {
        const limit = 1000; // Hard limit for now
        // Explicitly selecting columns to match frontend expectations
        const r = await dbPool.query('SELECT id, callsign, band, mode, qso_date, country, state, adif_raw FROM qsos WHERE user_id=$1 ORDER BY qso_date DESC, id DESC LIMIT $2', [req.user.id, limit]);
        res.json(r.rows);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// API to find participating awards for a specific QSO
app.get('/api/qsos/:id/awards', verifyToken, async (req, res) => {
    const client = await dbPool.connect();
    try {
        // Get the QSO
        const qsoRes = await client.query('SELECT * FROM qsos WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
        if(qsoRes.rows.length === 0) return res.status(404).json({error: "QSO not found"});
        const qso = qsoRes.rows[0];

        // Get all approved awards
        const awardsRes = await client.query("SELECT id, name, rules FROM awards WHERE status='approved'");
        const matchingAwards = [];

        // Check each award
        // Note: This duplicates the filter logic from evaluateAward. 
        // To save tokens/complexity here, I will implement a quick checker that mimics evaluateAward's Step 1 & 2.
        
        for (const award of awardsRes.rows) {
            const rules = award.rules;
            // Skip legacy
            if (Array.isArray(rules) && !rules.v2) continue;

            // 1. Basic Filter Check
            let match = true;
            const raw = qso.adif_raw;
            
            if (rules.basic?.startDate) {
                const qDate = raw.qso_date || qso.qso_date;
                const qDateFormatted = qDate.length === 8 ? `${qDate.slice(0,4)}-${qDate.slice(4,6)}-${qDate.slice(6,8)}` : qDate;
                if (qDateFormatted < rules.basic.startDate) match = false;
            }
            if (match && rules.basic?.endDate) {
                const qDate = raw.qso_date || qso.qso_date;
                const qDateFormatted = qDate.length === 8 ? `${qDate.slice(0,4)}-${qDate.slice(4,6)}-${qDate.slice(6,8)}` : qDate;
                if (qDateFormatted > rules.basic.endDate) match = false;
            }
            if (match && rules.basic?.qslRequired) {
                const qslR = raw.qsl_rcvd?.toUpperCase() === 'Y';
                const lotwR = raw.lotw_qsl_rcvd?.toUpperCase() === 'Y';
                if (!qslR && !lotwR) match = false;
            }
            if (match && rules.filters) {
                for (const f of rules.filters) {
                    if (!f.field || !f.value || f.value === 'ANY') continue;
                    const val = (raw[f.field.toLowerCase()] || qso[f.field.toLowerCase()] || '').toString().toUpperCase();
                    const targetVal = f.value.toUpperCase();
                    if (f.operator === 'eq' && val !== targetVal) match = false;
                    if (f.operator === 'neq' && val === targetVal) match = false;
                    if (f.operator === 'contains' && !val.includes(targetVal)) match = false;
                }
            }

            // 2. Target Check
            if (match && rules.targets?.list) {
                const targetList = rules.targets.list.split(',').map(s=>s.trim().toUpperCase());
                const targetType = rules.targets.type;
                let val = null;
                if (targetType === 'callsign') val = (qso.callsign || raw.call).toUpperCase();
                else if (targetType === 'dxcc') val = (qso.dxcc || raw.dxcc);
                else if (targetType === 'grid') val = (raw.gridsquare || '').substring(0,4).toUpperCase();
                else if (targetType === 'iota') val = (raw.iota || '').toUpperCase();
                else if (targetType === 'state') val = (raw.state || '').toUpperCase();
                
                if (val && !targetList.includes(val)) match = false;
            }

            if (match) matchingAwards.push({ id: award.id, name: award.name });
        }

        res.json(matchingAwards);
    } finally {
        client.release();
    }
});


// --- 系统管理 ---

app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    const r = await dbPool.query('SELECT id, callsign, role, created_at, totp_secret IS NOT NULL as has_2fa FROM users ORDER BY id');
    res.json(r.rows);
});

app.post('/api/admin/users', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    const { callsign, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await dbPool.query(`INSERT INTO users (callsign, password_hash, role) VALUES ($1, $2, $3)`, [callsign.toUpperCase(), hash, role || 'user']);
        res.json({ success: true });
    } catch (e) {
        if (e.code === '23505') res.status(400).json({ error: 'EXISTS', message: '呼号已存在' });
        else res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/users/:id', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    const { role, password } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (role) { updates.push(`role=$${idx++}`); values.push(role); }
    if (password) { const hash = await bcrypt.hash(password, 10); updates.push(`password_hash=$${idx++}`); values.push(hash); }
    values.push(req.params.id);
    await dbPool.query(`UPDATE users SET ${updates.join(',')} WHERE id=$${idx}`, values);
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        // 将该用户创建的奖状设置为无主 (避免外键约束错误)
        await client.query('UPDATE awards SET creator_id = NULL WHERE creator_id = $1', [req.params.id]);
        // 删除用户 (QSOS 和 user_awards 会自动级联删除)
        await client.query('DELETE FROM users WHERE id=$1', [req.params.id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/admin/settings', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    const { useHttps, adminPath } = req.body;
    appConfig.useHttps = useHttps;
    appConfig.adminPath = adminPath;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
    res.json({ success: true });
});

// 启动
loadConfig();
const PORT = 3003;
http.createServer(app).listen(PORT, () => console.log(`Server running on port ${PORT}`));