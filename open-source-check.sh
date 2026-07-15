#!/bin/bash
# ============================================
# 开源安全检查脚本
# 在推送代码前运行此脚本，确保无敏感信息泄露
# 用法: ./open-source-check.sh
# ============================================

set -e

ERRORS=0

echo "=========================================="
echo "  🔍 开源安全检查"
echo "=========================================="

# 1. 检查 .env 文件是否被 git 跟踪
echo ""
echo "--- 1. 检查 .env 是否被误提交 ---"
if git ls-files | grep -q "^\.env$"; then
    echo "❌ ERROR: .env 文件被 git 跟踪"
    git ls-files | grep "^\.env$"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ .env 未被 git 跟踪"
fi

# 2. 检查真实 API Key 格式 (ark-0e...)
echo ""
echo "--- 2. 检查真实 ark- API Key ---"
# 排除假阳性: .env.example, 占位符, 英文单词 (dark-theme, dark-adapted)
REAL_KEYS=$(git grep -rn "ark-[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}-[0-9]\{5\}" -- '*.js' '*.ts' '*.json' '*.md' '*.sh' 2>/dev/null | grep -v "ark-xxx\|ark-xxxxxxxx\|YOUR_ARK_API_KEY\|REDACTED\|dark-theme\|dark-realism\|dark-adapted\|\.env\.example" || true)
if [ -n "$REAL_KEYS" ]; then
    echo "❌ ERROR: 发现真实 API Key 格式:"
    echo "$REAL_KEYS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 无真实 ark- API Key 硬编码"
fi

# 3. 检查端点ID硬编码
echo ""
echo "--- 3. 检查端点ID ---"
REAL_EPS=$(git grep -rn "ep-20[0-9]\{12\}-[a-z0-9]\{5\}" -- '*.js' '*.ts' '*.json' '*.md' 2>/dev/null | grep -v "ENDPOINT_STD\|ENDPOINT_FAST\|ENDPOINT_IMG\|PRESET_ENDPOINT\|YOUR_ENDPOINT\|ep-xxxxxxxx\|\.env\.example" || true)
if [ -n "$REAL_EPS" ]; then
    echo "❌ ERROR: 发现真实端点ID:"
    echo "$REAL_EPS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 无真实端点ID硬编码"
fi

# 4. 检查预签名URL
echo ""
echo "--- 4. 检查预签名URL ---"
URLS=$(git grep -rn "tos-cn-.*volces\.com" -- '*.js' '*.ts' '*.json' '*.md' 2>/dev/null || true)
if [ -n "$URLS" ]; then
    echo "❌ ERROR: 发现预签名URL:"
    echo "$URLS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 无预签名URL"
fi

# 5. 检查真实人名
echo ""
echo "--- 5. 检查真实人名 ---"
NAMES=$(git grep -rn "香香\|大鹏\|陈卓\|李大鹏" -- '*.js' '*.ts' '*.json' '*.md' 2>/dev/null || true)
if [ -n "$NAMES" ]; then
    echo "❌ ERROR: 发现真实人名:"
    echo "$NAMES"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 无真实人名泄露"
fi

# 6. 检查生产数据目录
echo ""
echo "--- 6. 检查生产数据目录 ---"
for dir in characters products projects stories debug_llm output temp tmp; do
    if git ls-files | grep -q "^$dir/"; then
        echo "❌ ERROR: $dir/ 目录被 git 跟踪"
        ERRORS=$((ERRORS + 1))
    fi
done
echo "✅ 生产数据目录检查完成"

# 7. 检查 GitHub Token
echo ""
echo "--- 7. 检查 GitHub Token ---"
TOKENS=$(git grep -rn "ghp_[a-zA-Z0-9]\{36\}" -- '*.js' '*.ts' '*.json' '*.md' '*.sh' 2>/dev/null || true)
if [ -n "$TOKENS" ]; then
    echo "❌ ERROR: 发现 GitHub Token:"
    echo "$TOKENS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ 无 GitHub Token 泄露"
fi

# 8. 检查 volcengine.json 是否仍在跟踪中
echo ""
echo "--- 8. 检查 volcengine.json ---"
if git ls-files | grep -q "volcengine\.json"; then
    echo "❌ ERROR: volcengine.json 仍在 git 跟踪中:"
    git ls-files | grep "volcengine\.json"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ volcengine.json 未被 git 跟踪"
fi

# 总结
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "  ✅ 全部通过！可以安全推送"
    echo "=========================================="
    exit 0
else
    echo "  ❌ 发现 $ERRORS 个问题，请修复后再推送"
    echo "=========================================="
    exit 1
fi
