#!/bin/bash
echo "========================================"
echo "🧪 v4.5 系统集成快速验证"
echo "========================================"

cd /root/.openclaw/workspace/stories/rhabdomyolysis-s01e01

# 测试1: 模块是否能正常加载
echo ""
echo "📋 测试1: 模块加载测试"
node -e "
const SemanticIntegrityValidator = require('./systems/semantic-integrity-validator.js');
const TransitionDesigner = require('./systems/transition-designer.js');
console.log('  ✅ SemanticIntegrityValidator 加载成功');
console.log('  ✅ TransitionDesigner 加载成功');
"

# 测试2: build-storyboard-v4.1.js 语法检查
echo ""
echo "📋 测试2: 主链路语法检查"
node --check scripts/build-storyboard-v4.1.js && echo "  ✅ 语法通过" || echo "  ❌ 语法错误"

echo ""
echo "========================================"
echo "✅ v4.5 系统集成验证完成"
echo "========================================"
