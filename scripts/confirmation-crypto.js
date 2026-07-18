/**
 * 确认文件密码学验证模块 - v2.1.10-hotfix
 * 
 * 核心思想: 确认文件包含 HMAC-SHA256 签名，AI 无法伪造
 * 因为密钥仅人类知晓（存储在 .env 中，AI 不可读取）
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 【v2.1.10-fix Step2确认过期】签名有效期策略调整
// 原实现：时间戳有效期 ±5 分钟。人类确认后，若主流程 >5 分钟才读取到确认文件
// （例如确认时主流程正卡在长时间 LLM 调用、或隔了一夜重跑），合法确认会被误判
// "时间戳过期"并删除，导致 Step 2 反复要求重新确认。
// 防重放的真实防线是 nonce 一次性消费（下方 usedNonces），超长有效期不降低安全性：
// 没有 HMAC 密钥依然无法伪造签名，同一 nonce 依然只能用一次。
// 默认 24 小时，可通过 HUMAN_CONFIRMATION_TTL_MS 覆盖。
const CONFIRM_TTL_MS = (() => {
  const v = parseInt(process.env.HUMAN_CONFIRMATION_TTL_MS || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 24 * 60 * 60 * 1000;
})();
// 未来时间戳宽限（仅容忍时钟偏移，超过即视为伪造）
const FUTURE_SKEW_MS = 10 * 60 * 1000;

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
  // 【修复 P1-6】缺密钥不再 process.exit：主流程允许启动，确认环节安全降级为"不可用"
  console.warn('⚠️ [confirmation-crypto] HUMAN_CONFIRMATION_SECRET 未设置');
  console.warn('  人工确认环节将不可用（无法生成/验证签名），但系统其余功能正常');
  console.warn('  配置方法: export HUMAN_CONFIRMATION_SECRET=$(openssl rand -hex 32)，或写入 .env');
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
  // 【修复 P1-6】惰性校验：仅在真正需要签名时才失败
  if (!HUMAN_SECRET) {
    throw new Error('HUMAN_CONFIRMATION_SECRET 未配置，无法生成确认签名');
  }
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
  // 【修复 P1-6】密钥未配置时，任何确认文件都不可信 → 安全拒绝（继续等待人工处理）
  if (!HUMAN_SECRET) {
    console.log(' ⛔ 拒绝: HUMAN_CONFIRMATION_SECRET 未配置，签名体系不可用');
    return false;
  }
  // 1. 检查必填字段
  if (!confirmData.signature || !confirmData.timestamp || !confirmData.nonce) {
    console.log(' ⛔ 拒绝: 缺少签名字段');
    return false;
  }

  // 2. 检查时间戳
  // 【v2.1.10-fix Step2确认过期】拆分为"未来偏移"与"有效期"两个独立判断：
  // - 未来偏移超过 10 分钟 → 伪造嫌疑，拒绝
  // - 确认文件生成超过 TTL（默认 24h，HUMAN_CONFIRMATION_TTL_MS 可调）→ 过期，拒绝
  // 防重放依赖 nonce 一次性消费，不依赖短 TTL
  const now = Date.now();
  const ts = confirmData.timestamp;
  if (ts > now + FUTURE_SKEW_MS) {
    console.log(' ⛔ 拒绝: 时间戳来自未来（超过允许的时钟偏移，疑似伪造）');
    return false;
  }
  if (now - ts > CONFIRM_TTL_MS) {
    console.log(` ⛔ 拒绝: 确认文件已过期（生成于 ${Math.round((now - ts) / 60000)} 分钟前，有效期 ${Math.round(CONFIRM_TTL_MS / 3600000)} 小时）`);
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
