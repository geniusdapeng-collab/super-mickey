/**
 * confirmation-server.js - 确认服务 API
 * 提供 HTTP API 供 AI 助手调用，生成密码学签名的确认文件
 * 
 * 用法（HTTP POST）:
 *   curl -X POST http://localhost:9876 \
 *     -H "Content-Type: application/json" \
 *     -d '{"type":"creative-theme","action":"approve","reason":"确认"}'
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 加载 .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const secretMatch = envContent.match(/HUMAN_CONFIRMATION_SECRET=(.+)/);
  if (secretMatch && !process.env.HUMAN_CONFIRMATION_SECRET) {
    process.env.HUMAN_CONFIRMATION_SECRET = secretMatch[1].trim();
  }
}

let HUMAN_SECRET = process.env.HUMAN_CONFIRMATION_SECRET;

const PORT = process.env.CONFIRMATION_SERVER_PORT || 9876;

function generateConfirmation(type, approved, reason) {
  if (!HUMAN_SECRET) {
    throw new Error('HUMAN_CONFIRMATION_SECRET 未配置');
  }
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${type}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac('sha256', HUMAN_SECRET).update(payload).digest('hex');

  const confirmData = {
    approved,
    timestamp,
    nonce,
    signature,
    reason: reason || '',
    confirmed_at: new Date().toISOString()
  };

  const confirmPath = path.join(__dirname, '..', 'hyperreality-system', 'output', 'confirmations', `confirmation-${type}.json`);
  const dir = path.dirname(confirmPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(confirmPath, JSON.stringify(confirmData, null, 2));

  return { file: confirmPath, timestamp, signature };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { type, action, reason } = data;
      
      if (!type || !action) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing type or action' }));
        return;
      }
      
      const approved = action !== 'reject';
      const result = generateConfirmation(type, approved, reason || '');
      
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
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

// 导出供外部调用（AI 助手可直接 require 后调用 generateConfirmation）
module.exports = { server, generateConfirmation };

// 如果直接运行，启动服务器
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[ConfirmationServer] 确认服务已启动: http://localhost:${PORT}`);
  });
}
