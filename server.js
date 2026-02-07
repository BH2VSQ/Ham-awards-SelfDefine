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
    adminPath: 'admin' // 默认管理路径
};

/**
 * ==========================================
 * 1. 工具函数：ADIF 解析
 * ==========================================
 */
function parseAdif(adifString) {
  const records = [];
  const parts = adifString.split(/<eor>/i); // Split by End of Record
  
  for (let part of parts) {
    if (!part.trim()) continue;
    const record = {};
    // 正则匹配 <FIELD:LENGTH>DATA
    const regex = /<([a-zA-Z0-9_]+):(\d+)(?::[a-zA-Z])?>([^<]*)/g;
    let match;
    while ((match = regex.exec(part)) !== null) {
      const field = match[1].toLowerCase();
      const length = parseInt(match[2]);
      const data = match[3].substring(0, length); // 确保读取指定长度
      record[field] = data.trim();
    }
    // 基础过滤：必须有呼号和日期
    if (record.call && record.qso_date) {
      records.push(record);
    }
  }
  return records;
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
    // 用户表：增加权限组
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        callsign VARCHAR(20) UNIQUE NOT NULL, 
        password_hash TEXT NOT NULL, 
        role VARCHAR(20) DEFAULT 'user', -- 'user', 'award_admin', 'admin'
        totp_secret TEXT, 
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // QSO 日志表
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
        UNIQUE(user_id, callsign, band, mode, qso_date) -- 防止重复导入
      );
    `);

    // 奖状表：增加 status, design_layout(设计图坐标), rules(规则)
    await client.query(`
      CREATE TABLE IF NOT EXISTS awards (
        id SERIAL PRIMARY KEY, 
        name TEXT NOT NULL, 
        description TEXT, 
        bg_url TEXT,
        rules JSONB DEFAULT '[]', -- [{field: 'dxcc', operator: 'count', value: 100}, ...]
        layout JSONB DEFAULT '[]', -- [{type: 'text', label: 'Callsign', x: 100, y: 100}, ...]
        status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'pending', 'approved'
        creator_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // 用户申领记录
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_awards (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            award_id INTEGER REFERENCES awards(id),
            issued_at TIMESTAMP DEFAULT NOW()
        );
    `);

    console.log("Database schema checked.");
  } catch (err) {
    console.error("Schema upgrade error:", err.message);
  } finally {
    client.release();
  }
}

/**
 * ==========================================
 * 3. 中间件与权限
 * ==========================================
 */

const verifyToken = (req, res, next) => {
  if (!appConfig.installed && req.path.startsWith('/api/install')) return next();
  if (req.path === '/api/system-status' || req.path === '/api/auth/login' || req.path === '/api/auth/register') return next(); 

  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'TOKEN_MISSING', message: '未提供验证令牌' });
  
  try {
    const decoded = jwt.verify(token.split(' ')[1], appConfig.jwtSecret);
    req.user = decoded; 
    next();
  } catch (err) { res.status(401).json({ error: 'TOKEN_INVALID', message: '无效或过期的令牌' }); }
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'PERMISSION_DENIED', message: '需要系统管理员权限' });
  next();
};

const verifyAwardAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'award_admin') return res.status(403).json({ error: 'PERMISSION_DENIED', message: '需要奖状管理员权限' });
  next();
};

// 敏感操作二次验证中间件
const require2FA = async (req, res, next) => {
    try {
        const result = await dbPool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
        const secret = result.rows[0]?.totp_secret;
        if (!secret) return next(); // 未开启2FA则跳过

        const code = req.headers['x-2fa-code']; // 敏感操作需在 Header 带 Code
        if (!code) return res.status(403).json({ error: '2FA_REQUIRED', message: '此操作需要2FA验证' });
        
        if (!otplib.authenticator.check(code, secret)) {
            return res.status(403).json({ error: 'INVALID_2FA', message: '验证码错误' });
        }
        next();
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
};

/**
 * ==========================================
 * 4. API 路由
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
  const { dbHost, dbPort, dbUser, dbPass, dbName, adminCall, adminPass, adminPath, minio, useHttps } = req.body;
  
  let tempPool = new Pool({ user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort });
  let client;

  try {
    client = await tempPool.connect();
    // 执行建表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, callsign VARCHAR(20) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(20) DEFAULT 'user', totp_secret TEXT, created_at TIMESTAMP DEFAULT NOW());
    `);
    
    // 创建管理员
    const hash = await bcrypt.hash(adminPass, 10);
    // 检查是否存在
    await client.query('DELETE FROM users WHERE callsign = $1', [adminCall.toUpperCase()]);
    await client.query(`INSERT INTO users (callsign, password_hash, role) VALUES ($1, $2, 'admin')`, [adminCall.toUpperCase(), hash]);

    const newConfig = { 
        installed: true, 
        jwtSecret: crypto.randomBytes(64).toString('hex'), 
        db: { user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort },
        minio: minio,
        useHttps: !!useHttps,
        adminPath: adminPath || 'admin'
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    appConfig = newConfig; // 重新加载内存配置
    dbPool = tempPool;
    
    // 重新运行完整建表
    await upgradeSchema();
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); } finally { if (client) client.release(); }
});

app.post('/api/auth/login', async (req, res) => {
    const { callsign, password, code, loginType } = req.body; // code 是 2FA 码
    
    try {
        const result = await dbPool.query(`SELECT * FROM users WHERE callsign = $1`, [callsign.toUpperCase()]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'AUTH_FAILED', message: '用户不存在' });
        const user = result.rows[0];

        const passMatch = await bcrypt.compare(password, user.password_hash);
        if (!passMatch) return res.status(401).json({ error: 'AUTH_FAILED', message: '密码错误' });

        // 登录入口校验
        if (loginType === 'admin') {
            if (user.role === 'user') return res.status(403).json({ error: 'ACCESS_DENIED', message: '普通用户请使用普通登录入口' });
        }

        // 2FA 逻辑
        if (user.totp_secret) {
            if (!code) {
                return res.status(403).json({ error: '2FA_REQUIRED', message: '请输入两步验证码' });
            }
            const isValid = otplib.authenticator.check(code, user.totp_secret);
            if (!isValid) return res.status(403).json({ error: 'INVALID_2FA', message: '验证码无效' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, callsign: user.callsign }, 
            appConfig.jwtSecret, 
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user.id, 
                callsign: user.callsign, 
                role: user.role, 
                has2fa: !!user.totp_secret 
            } 
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
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

// --- 用户中心 & 安全 ---

// 1. 获取用户信息
app.get('/api/user/profile', verifyToken, async (req, res) => {
    const r = await dbPool.query('SELECT id, callsign, role, totp_secret, created_at FROM users WHERE id=$1', [req.user.id]);
    const u = r.rows[0];
    res.json({ ...u, has2fa: !!u.totp_secret, totp_secret: undefined });
});

// 2. 开启 2FA (第一步：获取二维码)
app.post('/api/user/2fa/setup', verifyToken, async (req, res) => {
    const secret = otplib.authenticator.generateSecret();
    const otpauth = otplib.authenticator.keyuri(req.user.callsign, 'HamAwards', secret);
    const imgData = await qrcode.toDataURL(otpauth);
    res.json({ secret, qr: imgData });
});

// 3. 开启 2FA (第二步：确认开启)
app.post('/api/user/2fa/enable', verifyToken, async (req, res) => {
    const { secret, token } = req.body;
    if (otplib.authenticator.check(token, secret)) {
        await dbPool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user.id]);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: '验证码无效' });
    }
});

// 4. 关闭 2FA
app.post('/api/user/2fa/disable', verifyToken, async (req, res) => {
    const { password } = req.body;
    const client = await dbPool.connect();
    try {
        const r = await client.query('SELECT password_hash, totp_secret FROM users WHERE id=$1', [req.user.id]);
        const u = r.rows[0];
        
        // 验证密码作为安全确认
        const match = await bcrypt.compare(password, u.password_hash);
        if(!match) return res.status(401).json({error: '密码错误'});
        
        await client.query('UPDATE users SET totp_secret=NULL WHERE id=$1', [req.user.id]);
        res.json({ success: true });
    } finally {
        client.release();
    }
});

// 5. 修改密码 (需验证旧密码，若已开启2FA需验证2FA)
app.post('/api/user/password', verifyToken, require2FA, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const client = await dbPool.connect();
    try {
        const r = await client.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
        const u = r.rows[0];
        
        const match = await bcrypt.compare(oldPassword, u.password_hash);
        if(!match) return res.status(401).json({error: '旧密码错误'});

        const hash = await bcrypt.hash(newPassword, 10);
        await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
        res.json({ success: true });
    } finally {
        client.release();
    }
});

// --- 日志系统 ---

app.post('/api/logbook/upload', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
        const raw = fs.readFileSync(req.file.path, 'utf8');
        const records = parseAdif(raw);
        let imported = 0;
        
        // 使用事务批量插入
        const client = await dbPool.connect();
        try {
            await client.query('BEGIN');
            for (let r of records) {
                await client.query(`
                    INSERT INTO qsos (user_id, callsign, band, mode, qso_date, dxcc, country, adif_raw)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (user_id, callsign, band, mode, qso_date) DO NOTHING
                `, [
                    req.user.id, 
                    r.call || '', 
                    r.band || '', 
                    r.mode || '', 
                    r.qso_date || '', 
                    r.dxcc || '',
                    r.country || '',
                    JSON.stringify(r)
                ]);
                imported++;
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
            fs.unlinkSync(req.file.path);
        }

        res.json({ success: true, count: records.length, imported });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/logbook/stats', verifyToken, async (req, res) => {
    const total = await dbPool.query('SELECT count(*) FROM qsos WHERE user_id=$1', [req.user.id]);
    res.json({ total: total.rows[0].count });
});

// --- 奖状管理 ---

app.post('/api/awards', verifyToken, verifyAwardAdmin, async (req, res) => {
    const { id, name, description, rules, layout, bg_url, status } = req.body;
    const targetStatus = status === 'approved' && req.user.role !== 'admin' ? 'pending' : status;

    if (id) {
        await dbPool.query(
            `UPDATE awards SET name=$1, description=$2, rules=$3, layout=$4, bg_url=$5, status=$6 WHERE id=$7`,
            [name, description, JSON.stringify(rules), JSON.stringify(layout), bg_url, targetStatus, id]
        );
        res.json({ success: true, id });
    } else {
        const r = await dbPool.query(
            `INSERT INTO awards (name, description, rules, layout, bg_url, status, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [name, description, JSON.stringify(rules), JSON.stringify(layout), bg_url, targetStatus || 'draft', req.user.id]
        );
        res.json({ success: true, id: r.rows[0].id });
    }
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/awards', verifyToken, async (req, res) => {
    let sql = `SELECT * FROM awards WHERE status = 'approved'`;
    if (req.user.role === 'admin' || req.user.role === 'award_admin') {
        sql = `SELECT * FROM awards`;
    }
    const r = await dbPool.query(sql + ` ORDER BY id DESC`);
    res.json(r.rows);
});

// --- 系统管理 ---

app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
    const r = await dbPool.query('SELECT id, callsign, role, created_at, totp_secret IS NOT NULL as has_2fa FROM users ORDER BY id');
    res.json(r.rows);
});

app.put('/api/admin/users/:id', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    const { role, password } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;

    if (role) { updates.push(`role=$${idx++}`); values.push(role); }
    if (password) { 
        const hash = await bcrypt.hash(password, 10);
        updates.push(`password_hash=$${idx++}`); 
        values.push(hash); 
    }
    
    values.push(req.params.id);
    await dbPool.query(`UPDATE users SET ${updates.join(',')} WHERE id=$${idx}`, values);
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', verifyToken, verifyAdmin, require2FA, async (req, res) => {
    await dbPool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
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