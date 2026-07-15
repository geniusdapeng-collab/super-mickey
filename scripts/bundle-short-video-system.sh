#!/bin/bash
# 超短裙系统代码打包脚本
# 将 short-video-system + 相关 systems 文件打包为 MD 文件

OUTPUT="/root/.openclaw/workspace/short-video-system-code-bundle.md"
WORKDIR="/root/.openclaw/workspace"

echo "# 超短裙系统 (Short Video System) - 完整代码包" > "$OUTPUT"
echo "" >> "$OUTPUT"
echo "> 版本: SHORT-VIDEO-0.8.2" >> "$OUTPUT"
echo "> 生成时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTPUT"
echo "> 包含范围: short-video-system/ 目录 + 引用的共享系统" >> "$OUTPUT"
echo "> 排除: .git/, 版本记录, 图片, 视频, debug日志, 输出文件" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# 收集 short-video-system 下所有纯文本文件（排除 .git, 图片, debug, output）
find "$WORKDIR/short-video-system" -type f -not -path '*/.git/*' -not -path '*/debug_llm/*' -not -path '*/output/*' \
  \( -name '*.js' -o -name '*.json' -o -name '*.md' -o -name '*.txt' -o -name '*.html' -o -name '*.css' -o -name '*.yml' -o -name '*.yaml' -o -name '*.sh' \) | sort | while read -r file; do
    rel_path="${file#$WORKDIR/}"
    echo "## 📄 $rel_path" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "\`\`\`${file##*.}" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "\`\`\`" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "---" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
done

# 收集被引用的 systems/ 文件
# 关键文件列表（手动维护，基于 require 引用分析）
SYSTEM_FILES=(
  "systems/prompt-tier-architecture.js"
  "systems/prompt-standard-v3.js"
  "systems/nirath-master-pipeline.js"
  "systems/intra-shot-prompt-enhancer.js"
  "systems/global-negative-prompts.js"
  "systems/camera-movement-system-v3.js"
  "systems/camera-movement-system-v2.js"
  "systems/opening-system-v3.js"
  "systems/character-manager-v2.js"
  "systems/character-prompt-builder.js"
  "systems/character-compliance-checker.js"
  "systems/character-era-guide.js"
  "systems/char-counter.js"
  "systems/prompt-dedupe.js"
  "systems/ambient-sound-designer.js"
  "systems/nirath-character-enhancement.js"
  "systems/universal-style-injector.js"
  "systems/shot-duration-allocator.js"
  "systems/duration-calculator.js"
  "systems/pipeline-integrity-validator.js"
  "systems/reference-image-gate.js"
  "systems/storyboard-validator.js"
  "systems/pre-render-validation.js"
  "systems/audit-logger.js"
  "systems/logger.js"
  "systems/status-reporter.js"
  "systems/report-writer.js"
  "systems/output-cleaner.js"
  "systems/errors.js"
)

for file in "${SYSTEM_FILES[@]}"; do
    full_path="$WORKDIR/$file"
    if [ -f "$full_path" ]; then
        echo "## 📄 $file" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
        echo "\`\`\`${file##*.}" >> "$OUTPUT"
        cat "$full_path" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
        echo "\`\`\`" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
        echo "---" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
    fi
done

# 统计
echo "## 📊 代码包统计" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "- 总文件数: $(grep -c '^## 📄' "$OUTPUT")" >> "$OUTPUT"
echo "- 总字符数: $(wc -c < "$OUTPUT")" >> "$OUTPUT"
echo "- 总大小: $(du -sh "$OUTPUT" | cut -f1)" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"

echo "✅ 打包完成: $OUTPUT"
ls -lh "$OUTPUT"
