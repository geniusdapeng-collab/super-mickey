/**
 * confirmation-server.js - 确认服务 API（加固版 v2.1.12-fix）
 *
 * 安全策略：
 * 1. 只监听 127.0.0.1，逐请求校验回环来源
 * 2. 校验 X-Confirm-Token 头（timing-safe 比较）
 * 3. 每次请求（含被拒绝）追加写入 audit.log
 * 4. 确认文件补齐 type 字段
 * 5. type 参数白名单校验
 * 6. 【v2.1.12】确认文件写入 run_id（绑定当前运行），原子写防半成品读取
 *
 * 用法（HTTP POST，仅限本机）：
 * curl -X POST http://127.0.0.1:9876 \
 * -H "Content-Type: application/json" \
 * -H "X-Confirm-Token: <HUMAN_CONFIRMATION_TOKEN>" \
 * -d '{"type":"creative-theme","action":"approve","reason":"确认"}'
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const runCoordinator = require('./run-coordinator');

// ── 加载 .env ───────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
 const envContent = fs.readFileSync(envPath, 'utf8');
 const secretMatch = envContent.match(/HUMAN_CONFIRMATION_SECRET=(.+)/);
 if (secretMatch && !process.env.HUMAN_CONFIRMATION_SECRET) {
 process.env.HUMAN_CONFIRMATION_SECRET = secretMatch[1].trim();
 }
 const tokenMatch = envContent.match(/HUMAN_CONFIRMATION_TOKEN=(.+)/);
 if (tokenMatch && !process.env.HUMAN_CONFIRMATION_TOKEN) {
 process.env.HUMAN_CONFIRMATION_TOKEN = tokenMatch[1].trim();
 }
}

let HUMAN_SECRET = process.env.HUMAN_CONFIRMATION_SECRET;
let HUMAN_TOKEN = process.env.HUMAN_CONFIRMATION_TOKEN;

const PORT = process.env.CONFIRMATION_SERVER_PORT || 9876;
const AUDIT_LOG = path.join(__dirname, '..', 'hyperreality-system', 'output', 'confirmations', 'audit.log');

// type 白名单：小写字母/数字开头，可含连字符，1-64 字符
const TYPE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// 请求体大小上限（64KB，确认请求正常只有几百字节）
const MAX_BODY_BYTES = 64 * 1024;

// timing-safe token 比较
function verifyToken(tokenHeader, expected) {
 if (!tokenHeader || !expected) return false;
 const a = Buffer.from(tokenHeader, 'utf8');
 const b = Buffer.from(expected, 'utf8');
 if (a.length !== b.length) return false;
 try {
 return crypto.timingSafeEqual(a, b);
 } catch {
 return false;
 }
}

function logAudit(clientIp, result, type, action, reason, filePath) {
 const dir = path.dirname(AUDIT_LOG);
 if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
 const entry = [
 new Date().toISOString(),
 clientIp,
 result,
 String(type || ''),
 String(action || ''),
 String(reason || ''),
 filePath || 'N/A'
 ].join(' | ') + '\n';
 fs.appendFileSync(AUDIT_LOG, entry, 'utf8');
}

function generateConfirmation(type, approved, reason) {
 if (!HUMAN_SECRET) {
 throw new Error('HUMAN_CONFIRMATION_SECRET 未配置');
 }
 const timestamp = Date.now();
 const nonce = crypto.randomBytes(16).toString('hex');
 const payload = `${type}:${timestamp}:${nonce}`;
 const signature = crypto.createHmac('sha256', HUMAN_SECRET).update(payload).digest('hex');

 // 【v2.1.12】绑定当前运行（无活动运行时 run_id 为 null，等待方按时间戳规则兜底）
 const currentRun = runCoordinator.getCurrentRun();

 const confirmData = {
 type,
 approved,
 timestamp,
 nonce,
 signature,
 reason: reason || '',
 confirmed_at: new Date().toISOString(),
 run_id: currentRun && currentRun.status === 'running' ? currentRun.run_id : null
 };

 const confirmPath = path.join(__dirname, '..', 'hyperreality-system', 'output', 'confirmations', `confirmation-${type}.json`);
 // 【v2.1.12】原子写（临时文件 + rename），轮询方不会读到写了一半的文件
 runCoordinator.atomicWriteSync(confirmPath, JSON.stringify(confirmData, null, 2));

 return { file: confirmPath, timestamp, signature };
}

// ── 回环来源校验 ───────────────────────────────────────────────────────
function isLoopback(ip) {
 return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

const server = http.createServer(async (req, res) => {
 const clientIp = req.socket.remoteAddress || 'unknown';

 // CORS 头保持原有（仅本地回环，无实际暴露风险）
 res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1');
 res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Confirm-Token');

 if (req.method === 'OPTIONS') {
 res.writeHead(200);
 res.end();
 return;
 }

 if (req.method !== 'POST') {
 logAudit(clientIp, 'rejected-method', null, null, null, null);
 res.writeHead(405, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Method not allowed' }));
 return;
 }

 // 1. 回环来源校验
 if (!isLoopback(clientIp)) {
 logAudit(clientIp, 'rejected-origin', null, null, null, null);
 res.writeHead(403, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Forbidden: only loopback allowed' }));
 return;
 }

 // 2. X-Confirm-Token 校验
 const token = req.headers['x-confirm-token'];
 if (!verifyToken(token, HUMAN_TOKEN)) {
 logAudit(clientIp, 'rejected-token', null, null, null, null);
 res.writeHead(403, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Forbidden: invalid token' }));
 return;
 }

 let body = '';
 let bodyBytes = 0;
 let aborted = false;
 req.on('data', chunk => {
 bodyBytes += chunk.length;
 if (bodyBytes > MAX_BODY_BYTES) {
 // 【v2.1.12】请求体超限，直接断开
 aborted = true;
 logAudit(clientIp, 'rejected-oversize', null, null, `body>${MAX_BODY_BYTES}`, null);
 res.writeHead(413, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Payload too large' }));
 req.destroy();
 return;
 }
 body += chunk;
 });
 req.on('end', async () => {
 if (aborted) return;
 try {
 const data = JSON.parse(body);
 const { type, action, reason } = data;

 if (!type || !action) {
 logAudit(clientIp, 'rejected-params', type || null, action || null, reason || null, null);
 res.writeHead(400, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Missing type or action' }));
 return;
 }

 // 5. type 白名单校验
 if (!TYPE_RE.test(type)) {
 logAudit(clientIp, 'rejected-type', type, action, reason, null);
 res.writeHead(400, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: 'Invalid type format' }));
 return;
 }

 const approved = action !== 'reject';
 const result = generateConfirmation(type, approved, reason || '');
 logAudit(clientIp, approved ? 'approved' : 'rejected', type, action, reason || '', result.file);

 res.writeHead(200, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({
 success: true,
 type,
 action,
 approved,
 file: result.file,
 timestamp: result.timestamp
 }));
 } catch (e) {
 logAudit(clientIp, 'rejected-error', null, null, e.message, null);
 res.writeHead(500, { 'Content-Type': 'application/json' });
 res.end(JSON.stringify({ error: e.message }));
 }
 });
});

module.exports = { server, generateConfirmation };

if (require.main === module) {
 server.listen(PORT, '127.0.0.1', () => {
 console.log(`[ConfirmationServer] 加固版确认服务已启动: http://127.0.0.1:${PORT} (仅回环)`);
 });
}