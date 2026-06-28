#!/bin/bash
echo "========================================"
echo "🧪 v4.6 字段路径修复验证"
echo "========================================"

cd /root/.openclaw/workspace/stories/rhabdomyolysis-s01e01

echo ""
echo "📋 测试性别字段路径"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/chen-nurse/character-card.json'));
console.log('voiceIdentity.gender: ' + card.voiceIdentity?.gender);
console.log('visualIdentity.baseIdentity: ' + card.visualIdentity?.baseIdentity);
"

echo ""
echo "📋 测试xiaoG性别字段"
node -e "
const fs = require('fs');
const card = JSON.parse(fs.readFileSync('../../characters/xiaoG/character-card.json'));
console.log('voiceIdentity.gender: ' + card.voiceIdentity?.gender);
console.log('visualIdentity.baseIdentity: ' + card.visualIdentity?.baseIdentity);
"

echo ""
echo "📋 语法检查"
node --check scripts/build-storyboard-v4.1.js 2>&1 | head -5

echo ""
echo "========================================"
echo "✅ 验证完成"
echo "========================================"
