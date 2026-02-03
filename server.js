import express from 'express';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

let dbPool = null;
let appConfig = { installed: false, adminPath: 'admin' };

// --- 配置加载与数据库初始化 ---
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      appConfig = { ...appConfig, ...data };
      if (appConfig.installed && appConfig.db) {
        dbPool = new Pool(appConfig.db);
        console.log("Database pool initialized.");
        upgradeSchema(); // 尝试更新表结构
      }
    } catch (e) { console.error("Config load error:", e); }
  }
}

// 简单的 Schema 升级 (添加新字段)
async function upgradeSchema() {
  if (!dbPool) return;
  const client = await dbPool.connect();
  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'zh'`);
    await client.query(`ALTER TABLE awards ADD COLUMN IF NOT EXISTS bg_url TEXT`);
  } catch (err) {
    console.log("Schema check skipped/failed:", err.message);
  } finally {
    client.release();
  }
}

loadConfig();

// --- 辅助函数 ---
function parseADIF(data) {
  const records = [];
  const contentStart = data.toLowerCase().indexOf('<eoh>');
  if (contentStart === -1) return [];
  const body = data.substring(contentStart + 5);
  const rawRecords = body.split(/<eor>/i);

  rawRecords.forEach(rec => {
    if (!rec.trim()) return;
    const qso = {};
    let cursor = 0;
    while (cursor < rec.length) {
      const tagStart = rec.indexOf('<', cursor);
      if (tagStart === -1) break;
      const tagEnd = rec.indexOf('>', tagStart);
      if (tagEnd === -1) break;
      const tagContent = rec.substring(tagStart + 1, tagEnd);
      const [tagName, lenStr] = tagContent.split(':');
      if (tagName && lenStr) {
        const len = parseInt(lenStr, 10);
        const value = rec.substr(tagEnd + 1, len);
        qso[tagName.toLowerCase()] = value.trim();
        cursor = tagEnd + 1 + len;
      } else {
        cursor = tagEnd + 1;
      }
    }
    if (qso.call) records.push(qso);
  });
  return records;
}

// --- 中间件 ---
const verifyToken = (req, res, next) => {
  if (!appConfig.installed && req.path === '/api/install') return next();
  if (req.path === '/api/system-status') return next(); 

  const token = req.headers['authorization'];
  const timestamp = req.headers['x-timestamp'];

  if (!timestamp || Math.abs(Date.now() - parseInt(timestamp)) > 5 * 60 * 1000) {
    return res.status(403).json({ error: 'Request expired or missing timestamp' });
  }

  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token.split(' ')[1], appConfig.jwtSecret);
    req.user = decoded; // { id, role, callsign }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 敏感操作验证中间件：如果用户开启了 2FA，必须验证 header 中的 x-2fa-code
const verifySensitiveAction = async (req, res, next) => {
  try {
    // 获取当前操作者的 2FA 状态
    const result = await dbPool.query(`SELECT totp_secret FROM users WHERE id = $1`, [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = result.rows[0];
    
    // 如果用户未开启 2FA，直接放行
    if (!user.totp_secret) return next();

    // 如果开启了 2FA，验证 Code
    const code = req.headers['x-2fa-code'];
    if (!code) return res.status(403).json({ error: '2FA_REQUIRED', message: '需要两步验证码' });
    
    if (!otplib.authenticator.check(code, user.totp_secret)) {
      return res.status(403).json({ error: 'INVALID_2FA', message: '验证码错误' });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Security check failed' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
};

// --- API 路由 ---

// 系统基础
app.get('/api/system-status', (req, res) => {
  res.json({ installed: appConfig.installed, adminPath: appConfig.adminPath });
});

app.post('/api/install', async (req, res) => {
  if (appConfig.installed) return res.status(400).json({ error: 'System already installed' });
  const { dbHost, dbPort, dbUser, dbPass, dbName, adminCall, adminPass, adminPath } = req.body;
  const tempPool = new Pool({ user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort });
  try {
    const client = await tempPool.connect();
    // 初始化表结构，包含 language 和 bg_url
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, callsign VARCHAR(20) UNIQUE NOT NULL, password_hash TEXT NOT NULL, 
        role VARCHAR(10) DEFAULT 'user', totp_secret TEXT, language VARCHAR(5) DEFAULT 'zh', 
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS qsos (
        id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
        adif_data JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qsos_jsonb ON qsos USING GIN (adif_data);
      CREATE TABLE IF NOT EXISTS awards (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, 
        criteria JSONB NOT NULL, bg_style TEXT, bg_url TEXT, active BOOLEAN DEFAULT TRUE
      );
    `);
    const hash = await bcrypt.hash(adminPass, 10);
    await client.query(`INSERT INTO users (callsign, password_hash, role, language) VALUES ($1, $2, 'admin', 'zh') ON CONFLICT (callsign) DO NOTHING`, [adminCall.toUpperCase(), hash]);
    
    // 种子数据
    const seedAwards = [
        {name: "10M FT8 Master", desc: "10m Band FT8 Mode > 5 DXCC", criteria: {"jsonb_raw.band": "10M", "jsonb_raw.mode": "FT8", "minDxcc": 5}},
        {name: "SAT Communicator", desc: "Via QO-100 Satellite", criteria: {"jsonb_raw.sat_name": "QO-100", "minDxcc": 1}}
    ];
    for(let a of seedAwards) await client.query(`INSERT INTO awards (name, description, criteria) VALUES ($1, $2, $3)`, [a.name, a.desc, JSON.stringify(a.criteria)]);

    client.release();
    const newConfig = { 
        installed: true, 
        adminPath: adminPath || 'admin', 
        jwtSecret: crypto.randomBytes(64).toString('hex'), 
        db: { user: dbUser, host: dbHost, database: dbName, password: dbPass, port: dbPort } 
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    appConfig = newConfig;
    dbPool = tempPool;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Installation failed: ' + err.message }); }
});

// 认证 API
app.post('/api/auth/register', async (req, res) => {
  const { callsign, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await dbPool.query(`INSERT INTO users (callsign, password_hash) VALUES ($1, $2) RETURNING id, callsign, role`, [callsign.toUpperCase(), hash]);
    res.json(result.rows[0]);
  } catch (err) { res.status(400).json({ error: 'Callsign exists or db error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { callsign, password, token: totpToken } = req.body;
  try {
    const result = await dbPool.query(`SELECT * FROM users WHERE callsign = $1`, [callsign.toUpperCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.totp_secret) {
      if (!totpToken) return res.status(403).json({ error: '2FA_REQUIRED' });
      if (!otplib.authenticator.check(totpToken, user.totp_secret)) return res.status(403).json({ error: 'Invalid 2FA code' });
    }
    const token = jwt.sign({ id: user.id, role: user.role, callsign: user.callsign }, appConfig.jwtSecret, { expiresIn: '12h' });
    res.json({ token, user: { id: user.id, callsign: user.callsign, role: user.role, language: user.language, has2fa: !!user.totp_secret } });
  } catch (err) { res.status(500).json({ error: 'Login error' }); }
});

// 2FA 设置 API
app.post('/api/auth/2fa/setup', verifyToken, async (req, res) => {
  const secret = otplib.authenticator.generateSecret();
  const otpauth = otplib.authenticator.keyuri(req.user.callsign, 'HamAwards', secret);
  try { res.json({ secret, qrCode: await qrcode.toDataURL(otpauth) }); } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/auth/2fa/confirm', verifyToken, async (req, res) => {
  const { token, secret } = req.body;
  if (otplib.authenticator.check(token, secret)) {
    await dbPool.query(`UPDATE users SET totp_secret = $1 WHERE id = $2`, [secret, req.user.id]);
    res.json({ success: true });
  } else { res.status(400).json({ error: 'Invalid code' }); }
});

app.post('/api/auth/2fa/disable', verifyToken, verifySensitiveAction, async (req, res) => {
    try {
        await dbPool.query(`UPDATE users SET totp_secret = NULL WHERE id = $1`, [req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({error: 'Failed to disable 2FA'}); }
});

// 用户日志上传 (带处理统计)
app.post('/api/qsos/upload', verifyToken, async (req, res) => {
  const { rawAdif } = req.body;
  if (!rawAdif) return res.status(400).json({ error: 'No content' });
  const records = parseADIF(rawAdif);
  if (records.length === 0) return res.status(400).json({ error: 'No valid ADIF' });
  
  const client = await dbPool.connect();
  let added = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    for (const rec of records) {
      // 检查重复：user_id + call + qso_date + time_on
      const check = await client.query(
          `SELECT id FROM qsos WHERE user_id = $1 AND adif_data @> $2::jsonb`, 
          [req.user.id, JSON.stringify({ call: rec.call, qso_date: rec.qso_date, time_on: rec.time_on })]
      );
      if (check.rowCount === 0) {
        await client.query(`INSERT INTO qsos (user_id, adif_data) VALUES ($1, $2)`, [req.user.id, JSON.stringify(rec)]);
        added++;
      } else {
        skipped++;
      }
    }
    await client.query('COMMIT');
    res.json({ total: records.length, added, skipped, processed: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Import failed' }); } finally { client.release(); }
});

// 用户数据看板
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const qsoRes = await dbPool.query(`SELECT COUNT(*) FROM qsos WHERE user_id = $1`, [req.user.id]);
    const dxccRes = await dbPool.query(`SELECT COUNT(DISTINCT adif_data->>'dxcc') FROM qsos WHERE user_id = $1`, [req.user.id]);
    const qsoData = await dbPool.query(`SELECT adif_data FROM qsos WHERE user_id = $1 AND adif_data->>'qsl_rcvd' = 'Y'`, [req.user.id]);
    const awards = await dbPool.query(`SELECT * FROM awards WHERE active = TRUE ORDER BY id`);
    const awardsStatus = awards.rows.map(award => {
      let validQsos = qsoData.rows.map(r => r.adif_data);
      Object.keys(award.criteria).forEach(key => {
        if (key.startsWith('jsonb_raw.')) {
          const field = key.split('.')[1];
          validQsos = validQsos.filter(q => q[field] === award.criteria[key] || q[field.toLowerCase()] === award.criteria[key]);
        }
      });
      const uniqueDxcc = new Set(validQsos.map(q => q.dxcc || q.country)).size;
      return { ...award, progress: uniqueDxcc, required: award.criteria.minDxcc || 1, eligible: uniqueDxcc >= (award.criteria.minDxcc || 1) };
    });
    res.json({ qsos: qsoRes.rows[0].count, dxcc: dxccRes.rows[0].count, awards: awardsStatus });
  } catch (err) { res.status(500).json({ error: 'Stats error' }); }
});

// --- 个人资料管理 API ---

app.put('/api/profile/info', verifyToken, verifySensitiveAction, async (req, res) => {
    const { password, language } = req.body;
    try {
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await dbPool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
        }
        if (language) {
            await dbPool.query(`UPDATE users SET language = $1 WHERE id = $2`, [language, req.user.id]);
        }
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/profile/logs', verifyToken, verifySensitiveAction, async (req, res) => {
    try {
        await dbPool.query(`DELETE FROM qsos WHERE user_id = $1`, [req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Delete logs failed' }); }
});

app.delete('/api/profile/account', verifyToken, verifySensitiveAction, async (req, res) => {
    try {
        // qsos 有 ON DELETE CASCADE，所以只需删用户
        await dbPool.query(`DELETE FROM users WHERE id = $1`, [req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Delete account failed' }); }
});

// --- 管理员 API (细分) ---

// 1. 奖状管理
app.post('/api/admin/awards', verifyToken, verifyAdmin, async (req, res) => {
  const { name, description, criteria, bgStyle, bgUrl } = req.body;
  try {
    await dbPool.query(
        `INSERT INTO awards (name, description, criteria, bg_style, bg_url) VALUES ($1, $2, $3, $4, $5)`, 
        [name, description, JSON.stringify(criteria), bgStyle, bgUrl]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Create award failed' }); }
});

// 2. 用户管理
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  const result = await dbPool.query(
      `SELECT id, callsign, role, language, created_at, (totp_secret IS NOT NULL) as has_2fa, 
       (SELECT count(*) FROM qsos WHERE user_id = users.id) as qso_count 
       FROM users ORDER BY id DESC`
  );
  res.json(result.rows);
});

app.delete('/api/admin/users/:id', verifyToken, verifyAdmin, verifySensitiveAction, async (req, res) => {
    const targetId = req.params.id;
    try {
        await dbPool.query(`DELETE FROM users WHERE id = $1`, [targetId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Delete user failed' }); }
});

app.post('/api/admin/users/:id/reset-password', verifyToken, verifyAdmin, verifySensitiveAction, async (req, res) => {
    const { newPassword } = req.body;
    const targetId = req.params.id;
    try {
        const hash = await bcrypt.hash(newPassword, 10);
        await dbPool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, targetId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Reset password failed' }); }
});

app.delete('/api/admin/users/:id/logs', verifyToken, verifyAdmin, verifySensitiveAction, async (req, res) => {
    const targetId = req.params.id;
    try {
        await dbPool.query(`DELETE FROM qsos WHERE user_id = $1`, [targetId]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Clear user logs failed' }); }
});

// 3. 管理面板设置
app.post('/api/admin/settings/path', verifyToken, verifyAdmin, verifySensitiveAction, async (req, res) => {
    const { newPath } = req.body;
    if (!newPath) return res.status(400).json({ error: 'Missing path' });
    appConfig.adminPath = newPath;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2));
    res.json({ success: true, newPath });
});

app.post('/api/admin/settings/password', verifyToken, verifyAdmin, verifySensitiveAction, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'Missing password' });
    try {
        const hash = await bcrypt.hash(newPassword, 10);
        await dbPool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: 'Failed' }); }
});

// Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});