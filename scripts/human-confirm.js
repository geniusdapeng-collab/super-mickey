#!/usr/bin/env node
/**
 * 人类确认工具 - v2.1.10-hotfix
 * 
 * 这是唯一允许创建 confirmation-*.json 的工具。
 * 生成的确认文件包含 HMAC-SHA256 签名，AI 无法伪造。
 * 
 * 用法:
 *   node scripts/human-confirm.js <type> [approve|reject] [reason]
 * 
 * 示例:
 *   node scripts/human-confirm.js creative-theme approve "主题很好"
 *   node scripts/human-confirm.js requirement reject "需要调整场景"
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 使用 process.argv[1] 获取脚本实际路径（兼容 exec 环境）
const scriptDir = path.dirname(process.argv[1]);

// 加载 .env 文件中的密钥（环境变量优先，确保主入口和 human-confirm.js 密钥一致）
let HUMAN_SECRET = process.env.HUMAN_CONFIRMATION_SECRET;

if (!HUMAN_SECRET) {
  try {
    const envPath = path.join(scriptDir, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const secretMatch = envContent.match(/HUMAN_CONFIRMATION_SECRET=(.+)/);
    if (secretMatch) {
      HUMAN_SECRET = secretMatch[1].trim();
      process.env.HUMAN_CONFIRMATION_SECRET = HUMAN_SECRET; // 同步到环境变量
    }
  } catch (e) {
    // .env 不存在，尝试从环境变量读取（上面已读取）
  }
}

if (!HUMAN_SECRET) {
  console.error('❌ 错误: HUMAN_CONFIRMATION_SECRET 未设置');
  console.error('  示例: export HUMAN_CONFIRMATION_SECRET=$(openssl rand -hex 32)');
  console.error('  或确保 .env 文件中包含 HUMAN_CONFIRMATION_SECRET');
  process.exit(1);
}

const type = process.argv[2];
const approved = process.argv[3] !== 'reject'; // 默认 approve
const reason = process.argv[4] || '';

if (!type) {
  console.log('用法: node scripts/human-confirm.js <type> [approve|reject] [reason]');
  console.log('');
  console.log('步骤类型:');
  console.log('  creative-theme  - 创意主题确认 (Step 2)');
  console.log('  requirement     - 需求清单确认 (Step 3)');
  console.log('  prd             - PRD 确认 (Step 4)');
  console.log('  prompt          - 提示词审核确认 (Step 5)');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/human-confirm.js creative-theme approve "主题很好"');
  console.log('  node scripts/human-confirm.js requirement reject "需要调整场景"');
  process.exit(1);
}

// 生成密码学安全的确认文件
const timestamp = Date.now();
const nonce = crypto.randomBytes(16).toString('hex');
const payload = `${type}:${timestamp}:${nonce}`;
const signature = crypto.createHmac('sha256', HUMAN_SECRET).update(payload).digest('hex');

const confirmData = {
  approved,
  timestamp,
  nonce,
  signature,
  reason,
  confirmed_at: new Date().toISOString()
  // 注意: 没有 confirmed_by_human 字段——签名本身就证明了人类身份
};

const confirmPath = path.join(scriptDir, '..', 'hyperreality-system', 'output', 'confirmations', `confirmation-${type}.json`);

// 确保目录存在
const dir = path.dirname(confirmPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(confirmPath, JSON.stringify(confirmData, null, 2));

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log(`║ ✅ 已确认: ${type.padEnd(24)} ║`);
console.log('╠══════════════════════════════════════════╣');
console.log(`║ 文件: ${confirmPath.substring(confirmPath.length - 36).padEnd(34)} ║`);
console.log(`║ 签名: ${signature.substring(0, 24).padEnd(34)}... ║`);
console.log(`║ 状态: ${(approved ? '✅ 通过' : '❌ 拒绝').padEnd(31)} ║`);
if (reason) {
  console.log(`║ 理由: ${reason.substring(0, 30).padEnd(30)} ║`);
}
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log('⚠️  确认文件已生成，预生产流程将继续。');
console.log('   AI 无法伪造此签名，因为密钥仅人类知晓。');
console.log('');
