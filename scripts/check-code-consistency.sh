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
