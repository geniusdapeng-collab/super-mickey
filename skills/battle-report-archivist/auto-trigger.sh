#!/bin/bash
# 战报复盘官自动触发脚本
# 在每次发布新版本后自动执行

WORKSPACE="/root/.openclaw/workspace"
MEMORY_DIR="$WORKSPACE/memory"
SKILL_DIR="$WORKSPACE/skills/battle-report-archivist"

# 获取今天的日期
TODAY=$(date +%Y-%m-%d)

# 读取今天的memory
MEMORY_FILE="$MEMORY_DIR/$TODAY.md"

if [ ! -f "$MEMORY_FILE" ]; then
    echo "❌ 今日memory不存在: $MEMORY_FILE"
    exit 1
fi

# 检查是否有"发布"关键词
if grep -q "发布\|上线\|提交渲染" "$MEMORY_FILE"; then
    echo "✅ 检测到发布事件，触发战报复盘"
    
    # 调用Node.js生成战报
    node "$SKILL_DIR/generator.js" "$MEMORY_FILE"
else
    echo "ℹ️ 今日无发布事件，跳过战报"
fi
