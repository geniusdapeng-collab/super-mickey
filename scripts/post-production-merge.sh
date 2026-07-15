#!/bin/bash
# 《初遇》后期合成脚本 - 合并+字幕烧录
set -e

INPUT_DIR="/root/.openclaw/workspace/renders/chuyu-v6.0-patch21"
OUTPUT_DIR="/root/.openclaw/workspace/renders/chuyu-v6.0-patch21"
FINAL_OUTPUT="$OUTPUT_DIR/《初遇》-小G与烛龙-成片.mp4"

# 1. 生成concat文件
echo "🎬 生成合并列表..."
cat > "$INPUT_DIR/concat_list.txt" << 'EOF'
file 'S01-opening.mp4'
file 'S02-forest-approach.mp4'
file 'S03-first-glimpse.mp4'
file 'S04-encounter.mp4'
file 'S05-reaction.mp4'
file 'S06-bonding.mp4'
file 'S07-departure.mp4'
EOF

# 2. 合并视频（重新编码确保格式统一）
echo "🎬 合并7镜视频..."
ffmpeg -y -f concat -safe 0 -i "$INPUT_DIR/concat_list.txt" \
  -c:v libx264 -crf 23 -preset fast -pix_fmt yuv420p \
  -movflags +faststart \
  "$OUTPUT_DIR/merged_raw.mp4" 2>/dev/null

# 3. 获取合并后总时长
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/merged_raw.mp4")
echo "⏱️ 合并后总时长: ${DURATION}s"

# 4. 生成SRT字幕文件
echo "📝 生成字幕文件..."
cat > "$OUTPUT_DIR/subtitles.srt" << 'SUBS'
1
00:00:00,000 --> 00:00:11,000
小G独自走在永夜裂谷的黑暗中
四周一片寂静，只有脚下荧光草发出微弱的蓝光

2
00:00:11,000 --> 00:00:23,000
远处，两团赤红的光芒缓缓亮起
在绝对黑暗中越来越大，越来越亮

3
00:00:23,000 --> 00:00:34,000
那是烛龙的竖直双目，缓缓睁开
赤红光芒如恒星爆发照亮整个裂谷

4
00:00:34,000 --> 00:00:44,000
小G震惊地仰头
看见千里赤红龙身横亘于裂谷之上，鳞片如红宝石闪烁

5
00:00:44,000 --> 00:00:49,000
烛龙缓缓俯身，人面头部靠近小G
竖直双目中的光芒变得温柔而深邃

6
00:00:49,000 --> 00:00:55,000
烛龙眼中流出一滴金色泪珠
化为万千光点涌入小G额头，传递千万年记忆

7
00:00:55,000 --> 00:01:00,000
小G在金色光芒中微笑
他听懂了烛龙千万年的孤独与守护
SUBS

# 5. 烧录字幕到视频中
echo "🔥 烧录字幕到成片..."
ffmpeg -y -i "$OUTPUT_DIR/merged_raw.mp4" \
  -vf "subtitles=$OUTPUT_DIR/subtitles.srt:force_style='FontName=Noto Sans SC,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=3,Shadow=2,Alignment=2,MarginV=60'" \
  -c:v libx264 -crf 23 -preset fast -pix_fmt yuv420p \
  -c:a copy -movflags +faststart \
  "$FINAL_OUTPUT" 2>/dev/null

# 6. 清理中间文件
rm -f "$OUTPUT_DIR/merged_raw.mp4" "$OUTPUT_DIR/concat_list.txt"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 《初遇》成片合成完成！"
echo "📁 文件: $FINAL_OUTPUT"
ls -lh "$FINAL_OUTPUT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
