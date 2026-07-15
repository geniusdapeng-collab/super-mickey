/**
 * 安全分数解析（替代eval）
 * 将字符串格式的分数（如"30/1"）解析为数字
 */
function safeEvalFraction(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  return parseFloat(str) || 0;
}

module.exports = { safeEvalFraction };
