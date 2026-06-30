#!/bin/bash
# 代码版本一致性修复脚本
# 解决 super-mickey/systems/ 与 workspace/systems/ 版本不一致问题

set -euo pipefail

echo "=== 代码版本一致性修复 ==="
echo ""

# 1. 备份当前状态
echo "[1/5] 备份当前状态..."
BACKUP_DIR="/root/.openclaw/workspace/github-repos/super-mickey/systems-backup-$(date +%Y%m%d-%H%M%S)"
cp -r /root/.openclaw/workspace/github-repos/super-mickey/systems "$BACKUP_DIR"
echo "  备份至: $BACKUP_DIR"

# 2. 同步 workspace/systems/ 到 super-mickey/systems/
echo ""
echo "[2/5] 同步最新代码..."
rsync -av --delete \
  /root/.openclaw/workspace/systems/ \
  /root/.openclaw/workspace/github-repos/super-mickey/systems/
echo "  ✅ 同步完成"

# 3. 验证关键文件
echo ""
echo "[3/5] 验证关键文件..."
KEY_FILES=(
  "llm-reasoning-engine.js"
  "llm-output-normalizer.js"
  "llm-output-parser.js"
  "llm-output-validator.js"
)

for file in "${KEY_FILES[@]}"; do
  if [ -f "/root/.openclaw/workspace/github-repos/super-mickey/systems/$file" ]; then
    echo "  ✅ $file 已同步"
  else
    echo "  ❌ $file 缺失!"
  fi
done

# 4. 清理 hyperreality-system/systems/ 中的重复文件
echo ""
echo "[4/5] 清理重复目录..."
# hyperreality-system/systems/ 下的 llm-reasoning-engine.js 已过时，移除
rm -f /root/.openclaw/workspace/github-repos/super-mickey/hyperreality-system/systems/llm-reasoning-engine.js
echo "  ✅ 已清理 hyperreality-system/systems/llm-reasoning-engine.js"

# 5. 建立一致性检查机制
echo ""
echo "[5/5] 建立一致性检查..."
cat > /root/.openclaw/workspace/github-repos/super-mickey/scripts/check-code-consistency.sh << 'EOF'
#!/bin/bash
# 代码一致性检查脚本
# 应作为 CI/CD 的一部分运行

set -euo pipefail

SOURCE_DIR="/root/.openclaw/workspace/systems/"
TARGET_DIR="/root/.openclaw/workspace/github-repos/super-mickey/systems/"

echo "=== 代码一致性检查 ==="
echo ""

# 检查文件数量差异
SOURCE_COUNT=$(find "$SOURCE_DIR" -type f | wc -l)
TARGET_COUNT=$(find "$TARGET_DIR" -type f | wc -l)

echo "源目录文件数: $SOURCE_COUNT"
echo "目标目录文件数: $TARGET_COUNT"

if [ "$SOURCE_COUNT" -ne "$TARGET_COUNT" ]; then
  echo "❌ 文件数量不一致!"
  exit 1
fi

# 检查关键文件 MD5
KEY_FILES=(
  "llm-reasoning-engine.js"
  "llm-output-normalizer.js"
)

for file in "${KEY_FILES[@]}"; do
  SOURCE_MD5=$(md5sum "$SOURCE_DIR/$file" | awk '{print $1}')
  TARGET_MD5=$(md5sum "$TARGET_DIR/$file" | awk '{print $1}')
  
  if [ "$SOURCE_MD5" != "$TARGET_MD5" ]; then
    echo "❌ $file MD5 不一致!"
    exit 1
  fi
  echo "✅ $file 一致"
done

echo ""
echo "✅ 所有检查通过"
EOF

chmod +x /root/.openclaw/workspace/github-repos/super-mickey/scripts/check-code-consistency.sh
echo "  ✅ 一致性检查脚本已创建: scripts/check-code-consistency.sh"

echo ""
echo "=== 修复完成 ==="
echo ""
echo "重要提示:"
echo "1. 所有代码已统一至 super-mickey/systems/"
echo "2. hyperreality-system 不再维护独立的 systems/ 目录"
echo "3. 运行 ./scripts/check-code-consistency.sh 可随时检查一致性"
