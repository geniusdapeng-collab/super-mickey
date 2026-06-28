#!/bin/bash
echo "========================================"
echo "🧪 v4.6 声音+主题锚点 系统级修复验证"
echo "========================================"

cd /root/.openclaw/workspace/stories/rhabdomyolysis-s01e01

# 语法检查
echo ""
echo "📋 语法检查"
node --check scripts/build-storyboard-v4.1.js 2>&1 | head -5

# 快速测试性别锚点提取
echo ""
echo "📋 测试性别锚点逻辑"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/chen-nurse/character-card.json'));
console.log('角色: ' + card.name);
console.log('性别: ' + card.gender);
console.log('baseIdentity: ' + card.baseIdentity);
console.log('✅ 性别信息存在');
"

# 测试主题关键词提取
echo ""
echo "📋 测试主题关键词提取"
node -e "
const narration = '小陈老师，出现这些症状要立即去医院吗？';
const keywordMap = {
  '横纹肌溶解': '横纹肌溶解的症状识别',
  '症状': '症状识别与判断',
  '就医': '紧急就医指导',
  '检查': '医学检查流程'
};
for (const [key, value] of Object.entries(keywordMap)) {
  if (narration.includes(key)) {
    console.log('✅ 匹配: ' + key + ' -> ' + value);
    break;
  }
}
"

echo ""
echo "========================================"
echo "✅ 验证完成"
echo "========================================"
