#!/bin/bash
echo "========================================"
echo "🧪 v4.7 七坑全填 系统级修复验证"
echo "========================================"

cd /root/.openclaw/workspace/stories/rhabdomyolysis-s01e01

echo ""
echo "📋 测试1: 语法检查"
node --check scripts/build-storyboard-v4.1.js 2>&1 | head -5

echo ""
echo "📋 测试2: chen-nurse全字段提取"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/chen-nurse/character-card.json'));

console.log('=== 角色档案字段检查 ===');
console.log('visualIdentity.style:', !!card.visualIdentity?.style ? '✅ 存在' : '❌ 缺失');
console.log('visualIdentity.age:', !!card.visualIdentity?.age ? '✅ 存在' : '❌ 缺失');
console.log('visualIdentity.baseIdentity:', !!card.visualIdentity?.baseIdentity ? '✅ 存在' : '❌ 缺失');
console.log('appearance.hair:', !!card.visualIdentity?.appearance?.hair ? '✅ 存在' : '❌ 缺失');
console.log('appearance.face:', !!card.visualIdentity?.appearance?.face ? '✅ 存在' : '❌ 缺失');
console.log('appearance.eyes:', !!card.visualIdentity?.appearance?.eyes ? '✅ 存在' : '❌ 缺失');
console.log('appearance.uniform:', !!card.visualIdentity?.appearance?.uniform ? '✅ 存在' : '❌ 缺失');
console.log('appearance.accessories:', !!card.visualIdentity?.appearance?.accessories ? '✅ 存在' : '❌ 缺失');
console.log('appearance.build:', !!card.visualIdentity?.appearance?.build ? '✅ 存在' : '❌ 缺失');
console.log('appearance.expression:', !!card.visualIdentity?.appearance?.expression ? '✅ 存在' : '❌ 缺失');
console.log('visualIdentity.angles:', !!card.visualIdentity?.angles ? '✅ 存在' : '❌ 缺失');
console.log('voiceIdentity.gender:', !!card.voiceIdentity?.gender ? '✅ 存在' : '❌ 缺失');
console.log('voiceIdentity.promptFragment:', !!card.voiceIdentity?.promptFragment ? '✅ 存在' : '❌ 缺失');
console.log('voiceIdentity.style:', !!card.voiceIdentity?.style ? '✅ 存在' : '❌ 缺失');
console.log('voiceIdentity.mood:', !!card.voiceIdentity?.mood ? '✅ 存在' : '❌ 缺失');
console.log('personality.core:', !!card.personality?.core ? '✅ 存在' : '❌ 缺失');
console.log('personality.traits:', !!card.personality?.traits ? '✅ 存在' : '❌ 缺失');
"

echo ""
echo "📋 测试3: xiaoG全字段提取"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/xiaoG/character-card.json'));

console.log('=== xiaoG 特殊字段检查 ===');
console.log('voiceIdentity.gender:', card.voiceIdentity?.gender || '❌ undefined');
console.log('visualIdentity.age:', card.visualIdentity?.age || '❌ undefined');
console.log('visualIdentity.appearance.body:', !!card.visualIdentity?.appearance?.body ? '✅ 存在' : '❌ 缺失');
console.log('personality.core:', !!card.personality?.core ? '✅ 存在' : '❌ 缺失');
"

echo ""
echo "📋 测试4: 模拟Prompt组装（字数检查）"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/chen-nurse/character-card.json'));

// 模拟v4.7的组装逻辑
const visualId = card.visualIdentity || {};
const appearance = visualId.appearance || {};
const voiceId = card.voiceIdentity || {};

const parts = [
  '小陈：',
  visualId.style,
  visualId.baseIdentity,
  visualId.age,
  appearance.hair?.promptFragment,
  appearance.face?.promptFragment,
  appearance.eyes?.promptFragment,
  appearance.uniform?.promptFragment,
  appearance.accessories?.promptFragment,
  appearance.build?.promptFragment,
  appearance.expression?.promptFragment,
  '气质' + card.personality?.core,
  '特征' + card.personality?.traits?.slice(0,2).join('、'),
  voiceId.promptFragment,
  voiceId.style,
  '语气' + voiceId.mood,
  '表情亲切专业',
  '嘴部微张正在说话',
  '正在讲解肾功能和肾损伤原理'
].filter(Boolean);

const desc = parts.join('，');
const chineseChars = (desc.match(/[\u4e00-\u9fff]/g) || []).length;
console.log('模拟角色描述字数:', chineseChars, '字');
console.log(chineseChars < 490 ? '✅ 在490字限制内' : '❌ 超过490字！');
"

echo ""
echo "========================================"
echo "✅ v4.7 七坑全填 快速验证完成"
echo "========================================"
