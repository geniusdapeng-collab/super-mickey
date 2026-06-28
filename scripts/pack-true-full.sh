#!/bin/bash
OUTPUT="output/seedance-video-platform-v6.0-patch33-TRUE-FULL.md"

echo "# Seedance视频生成统一平台 — 完整全量代码" > "$OUTPUT"
echo "" >> "$OUTPUT"
echo "**版本**: v6.0-patch33 | **生成时间**: $(date -Iseconds)" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# 打包所有代码文件（排除废弃版本、媒体文件、旧打包文件）
find . -type f \( -name '*.js' -o -name '*.json' -o -name '*.md' -o -name '*.py' -o -name '*.sh' -o -name '*.yaml' -o -name '*.yml' \) \
  | grep -v node_modules | grep -v '.openclaw' | grep -v '.git' \
  | grep -v -E 'output/' \
  | grep -v -E 'v[0-9]+\.[0-9]+.*backup|backup.*v[0-9]+|deprecated|obsolete' \
  | grep -v -E '\.(mp4|mp3|wav|png|jpg|jpeg|gif|webp|avi|mov|mkv|m4v|m4a|ogg|webm)$' \
  | grep -v -E '^\./(山海经|视频制作|SEEDANCE|NIRATH|seedance-video-platform|NIRATH_FULL|SEEDANCE-UNIFIED|SEEDANCE-v|视频制作系统|CHARACTER-PORTRAIT|CHARACTER_PORTRAIT|INTRA-SHOT|PLAN-v|EPISODE|NIRATH_WORLD|NIRATH_FULL_SYSTEM|cinematography-agent|color-grading|api-key|external-analysis).*(\.md|\.zip)$' \
  | grep -v -E '^\./(memory|memorized_|memory_consolidation|memorized_media|memorized_diary|logs|trash|tmp|\.archive|archive)/' \
  | grep -v -E 'image-cache|\.tmp$|\.temp$|\.log$' \
  | grep -v -E '^\./(HEARTBEAT|IDENTITY|MEMORY_APPEND|MEMORY|DREAMS|AGENTS|SOUL|TOOLS|USER|BOOTSTRAP|SYSTEM)\.md$' \
  | sort | while read file; do
    clean="${file#./}"
    echo "" >> "$OUTPUT"
    echo "### $clean" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "\`\`\`" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "\`\`\`" >> "$OUTPUT"
  done

echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "**END**" >> "$OUTPUT"

echo "Done. Size:"
ls -lh "$OUTPUT"
