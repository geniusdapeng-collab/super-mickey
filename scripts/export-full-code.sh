#!/bin/bash
# 超现实系统全量代码导出脚本 - 无截断版
set -e

OUTPUT_DIR="/root/.openclaw/workspace/output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="${OUTPUT_DIR}/hyperreality-system-FULL-CODE-${TIMESTAMP}.txt"

echo "开始导出全量代码..."

# 创建输出文件
cat > "${OUTPUT_FILE}" << 'HEADER'
================================================================================
超现实系统 (Hyperreality System) - 全量代码导出
版本: v2.0.0-LLM-Agent
导出时间: TIMESTAMP_PLACEHOLDER
说明: 本文件包含系统全部源代码，无截断
================================================================================

目录结构:
- hyperreality-system/          # 主系统目录
  - engines/                    # 引擎目录
    - production-engine/        # 制作引擎
      - agents/                 # LLM Agent (6个)
      - production-engine.js    # 主引擎
    - script-engine/            # 剧本引擎
    - adapter/                  # 适配层
  - run.js                      # 入口文件
  - package.json                # 依赖配置
- systems/                      # 共享模块
  - llm-reasoning-engine.js     # LLM引擎
  - config/                     # 配置文件
- core/                         # 核心模块
- scripts/                      # 工具脚本
- docs/                         # 文档

================================================================================

HEADER

# 替换时间戳
sed -i "s/TIMESTAMP_PLACEHOLDER/$(date '+%Y-%m-%d %H:%M:%S')/" "${OUTPUT_FILE}"

# 定义要导出的目录和文件
# 注意: 排除 node_modules, .git, 日志文件等
declare -a SOURCES=(
    "hyperreality-system/run.js"
    "hyperreality-system/package.json"
    "hyperreality-system/engines"
    "systems"
    "core"
    "scripts"
    "docs"
    "config"
)

# 导出函数
export_file() {
    local file="$1"
    local rel_path="$2"
    
    echo "" >> "${OUTPUT_FILE}"
    echo "================================================================================" >> "${OUTPUT_FILE}"
    echo "FILE: ${rel_path}" >> "${OUTPUT_FILE}"
    echo "SIZE: $(wc -c < "$file") bytes" >> "${OUTPUT_FILE}"
    echo "================================================================================" >> "${OUTPUT_FILE}"
    echo "" >> "${OUTPUT_FILE}"
    
    # 直接追加文件内容，不截断
    cat "$file" >> "${OUTPUT_FILE}"
    
    echo "" >> "${OUTPUT_FILE}"
}

# 遍历所有源
cd /root/.openclaw/workspace

for src in "${SOURCES[@]}"; do
    if [ -f "$src" ]; then
        # 是文件，直接导出
        export_file "$src" "$src"
        echo "  导出文件: $src"
    elif [ -d "$src" ]; then
        # 是目录，遍历所有文件
        find "$src" -type f \
            ! -path "*/node_modules/*" \
            ! -path "*/.git/*" \
            ! -path "*/output/*" \
            ! -path "*/media/*" \
            ! -path "*/memorized_*/*" \
            ! -path "*/memory_consolidation/*" \
            ! -name "*.log" \
            ! -name "*.tmp" \
            ! -name ".DS_Store" \
            ! -name "*.png" \
            ! -name "*.jpg" \
            ! -name "*.jpeg" \
            ! -name "*.gif" \
            ! -name "*.mp4" \
            ! -name "*.mp3" \
            ! -name "*.wav" \
            | sort | while read -r file; do
            rel_path="${file#./}"
            export_file "$file" "$rel_path"
            echo "  导出文件: $rel_path"
        done
    else
        echo "  跳过 (不存在): $src"
    fi
done

# 添加尾部信息
cat >> "${OUTPUT_FILE}" << 'FOOTER'

================================================================================
导出完成
总文件数: 请见上方各FILE标记
================================================================================
FOOTER

FILE_SIZE=$(wc -c < "${OUTPUT_FILE}")
FILE_LINES=$(wc -l < "${OUTPUT_FILE}")

echo ""
echo "========================================"
echo "导出完成!"
echo "文件: ${OUTPUT_FILE}"
echo "大小: ${FILE_SIZE} bytes ($((FILE_SIZE / 1024 / 1024)) MB)"
echo "行数: ${FILE_LINES}"
echo "========================================"
