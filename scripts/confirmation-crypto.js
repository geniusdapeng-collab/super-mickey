/**
 * 确认文件密码学验证模块 - v2.1.10-hotfix
 * 
 * 核心思想: 确认文件包含 HMAC-SHA256 签名，AI 无法伪造
 * 因为密钥仅人类知晓（存储在 .env 中，AI 不可读取）
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 人类共享密钥（仅在人类端存储，AI 不可访问）
// 优先使用环境变量，回退到 .env 文件（确保主入口和 human-confirm.js 使用同一密钥）
let HUMAN_SECRET = process.env.HUMAN_CONFIRMATION_SECRET;

if (!HUMAN_SECRET) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const secretMatch = envContent.match(/HUMAN_CONFIRMATION_SECRET=(.+)/);
    if (secretMatch) {
      HUMAN_SECRET = secretMatch[1].trim();
      process.env.HUMAN_CONFIRMATION_SECRET = HUMAN_SECRET; // 同步到环境变量
    }
  } catch (e) {
    // .env 不存在或读取失败
  }
}

if (!HUMAN_SECRET) {
  console.error('❌ 错误: HUMAN_CONFIRMATION_SECRET 未设置');
  console.error('  请运行: export HUMAN_CONFIRMATION_SECRET=$(openssl rand -hex 32)');
  console.error('  或确保 .env 文件中包含 HUMAN_CONFIRMATION_SECRET');
  process.exit(1);
}

// nonce 管理（持久化存储，防止重放攻击）
const NONCE_STORE = path.join(__dirname, '..', '.nonce-store.json');
const usedNonces = new Set();

// 启动时加载历史 nonce
try {
  const history = JSON.parse(fs.readFileSync(NONCE_STORE, 'utf8'));
  history.forEach(n => usedNonces.add(n));
} catch (e) { /* 首次运行，忽略 */ }

/**
 * 生成确认签名
 * @param {string} type - 确认类型
 * @param {number} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @returns {string} HMAC-SHA256 签名
 */
function generateSignature(type, timestamp, nonce) {
  const payload = `${type}:${timestamp}:${nonce}`;
  return crypto.createHmac('sha256', HUMAN_SECRET).update(payload).digest('hex');
}

/**
 * 验证确认文件
 * @param {Object} confirmData - 确认文件内容
 * @param {string} type - 确认类型
 * @returns {boolean} 验证是否通过
 */
function verifyConfirmation(confirmData, type) {
  // 1. 检查必填字段
  if (!confirmData.signature || !confirmData.timestamp || !confirmData.nonce) {
    console.log(' ⛔ 拒绝: 缺少签名字段');
    return false;
  }

  // 2. 检查时间戳（允许 ±5 分钟时钟偏移）
  const now = Date.now();
  const ts = confirmData.timestamp;
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    console.log(' ⛔ 拒绝: 时间戳过期（可能是重放攻击）');
    return false;
  }

  // 3. 检查 nonce（防止复制攻击）
  if (usedNonces.has(confirmData.nonce)) {
    console.log(' ⛔ 拒绝: nonce 已被使用（复制攻击）');
    return false;
  }

  // 4. 验证 HMAC 签名（使用 timing-safe 比较防止时序攻击）
  const expectedSig = generateSignature(type, confirmData.timestamp, confirmData.nonce);
  try {
    if (!crypto.timingSafeEqual(
      Buffer.from(confirmData.signature, 'hex'),
      Buffer.from(expectedSig, 'hex')
    )) {
      console.log(' ⛔ 拒绝: 签名不匹配（AI 伪造的确认文件）');
      return false;
    }
  } catch (e) {
    console.log(' ⛔ 拒绝: 签名格式错误');
    return false;
  }

  // 5. 标记 nonce 已使用
  markNonceUsed(confirmData.nonce);

  console.log(' ✅ 签名验证通过，确认来自人类');
  return true;
}

function markNonceUsed(nonce) {
  usedNonces.add(nonce);
  fs.writeFileSync(NONCE_STORE, JSON.stringify([...usedNonces].slice(-1000)));
}

module.exports = { generateSignature, verifyConfirmation };
