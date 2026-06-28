#!/bin/bash
# 打包视频制作系统完整全量代码（含全部模块，排除媒体文件）

OUTPUT_FILE="output/seedance-video-platform-v6.0-patch33-FULL.md"

echo "开始打包 FULL 版本..."

# 创建MD头部
cat > $OUTPUT_FILE << 'HEADER'
# Seedance视频生成统一平台 — 完整全量代码一键安装包

**系统名称**: Seedance视频生成统一平台
**版本**: v6.0-patch33
**生成时间**: 2026-05-26
**包含内容**: 完整全量核心代码（含全部子系统模块 + 项目配置 + 角色配置，排除视频/图片等媒体文件）

---

## 🎯 系统概述

本系统为统一视频生成平台，同时支持：
- **通用视频系列**: 科普/纪录片/宣传片/剧情短片
- **山海经系列**: 《山海经：异兽志》等IP内容

两大系列共享同一套底层基础设施，仅在业务层做差异化配置。

---

## 📁 安装说明

1. 在目标OpenClaw工作目录创建以下目录结构
2. 按下方文件列表创建各文件
3. 每个文件内容见对应代码块
4. 配置API密钥后运行系统

---

HEADER

# 统计文件
echo "统计文件..."

TOTAL_LINES=0
TOTAL_FILES=0

# 函数：打包单个文件
pack_file() {
  local file="$1"
  local clean_path="${file#./}"
  
  # 检查文件是否为空
  if [ ! -s "$file" ]; then
    return
  fi
  
  echo "" >> $OUTPUT_FILE
  echo "### $clean_path" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
  
  # 根据扩展名确定代码块语言
  if [[ "$file" == *.js ]]; then
    echo "\`\`\`javascript" >> $OUTPUT_FILE
  elif [[ "$file" == *.json ]]; then
    echo "\`\`\`json" >> $OUTPUT_FILE
  elif [[ "$file" == *.md ]]; then
    echo "\`\`\`markdown" >> $OUTPUT_FILE
  elif [[ "$file" == *.sh ]]; then
    echo "\`\`\`bash" >> $OUTPUT_FILE
  elif [[ "$file" == *.py ]]; then
    echo "\`\`\`python" >> $OUTPUT_FILE
  elif [[ "$file" == *.yaml ]] || [[ "$file" == *.yml ]]; then
    echo "\`\`\`yaml" >> $OUTPUT_FILE
  else
    echo "\`\`\`" >> $OUTPUT_FILE
  fi
  
  cat "$file" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
  echo "\`\`\`" >> $OUTPUT_FILE
  
  TOTAL_FILES=$((TOTAL_FILES + 1))
  lines=$(wc -l < "$file")
  TOTAL_LINES=$((TOTAL_LINES + lines))
}

# 定义要打包的目录
PACK_DIRS="
systems
scripts
projects
seedance-agent
seedance-character-manager
seedance-choreography
seedance-delivery-engine
seedance-director
seedance-micromotion
seedance-post-production
seedance-render-engine
seedance-shot-design
seedance-sound-design
seedance-story-engine
shanhaijing-ark-seedance-skill
shanhaijing-beast-motion
shanhaijing-bestiary
shanhaijing-character-forge
shanhaijing-character-manager
shanhaijing-choreography
shanhaijing-cinematography
shanhaijing-delivery-engine
shanhaijing-director
shanhaijing-e2e-test
shanhaijing-emotion-calculator
shanhaijing-integrator
shanhaijing-ip-asset-manager
shanhaijing-micromotion
shanhaijing-narrative-consistency
shanhaijing-persona-vault
shanhaijing-pipeline
shanhaijing-pitch-evaluation
shanhaijing-post-production
shanhaijing-quality-oracle
shanhaijing-render-engine
shanhaijing-sensory-generator
shanhaijing-shot-design
shanhaijing-soul-forge
shanhaijing-sound-design
shanhaijing-story-engine
shanhaijing-story-forge
shanhaijing-storyforge-pro
shanhaijing-style-router
shanhaijing-voice-craft
shanhaijing-voice-forge
shanhaijing-world-engine
shanhaijing2-storyboard-generator
seedance2-storyboard-generator
byted-ark-seedance-skill
shanhaijing-ark-seedance-skill
shanhaijing-beast-motion
characters
data
config
templates
rules
utils
tests
skills
zhulong-opens-eyes-v20.0-production
jingwei-v20.0-production
pre-production-reports
"

# 打包每个目录
for dir in $PACK_DIRS; do
  if [ -d "$dir" ]; then
    echo "📦 打包 $dir/ ..."
    find "$dir" -type f | sort | while read file; do
      # 排除媒体文件
      if echo "$file" | grep -qE '\.(mp4|mp3|wav|png|jpg|jpeg|gif|webp|avi|mov|mkv|m4v|m4a|ogg|webm)$'; then
        continue
      fi
      # 排除废弃版本（精确匹配版本号模式）
      if echo "$file" | grep -qE 'v[0-9]+\.[0-9]+\.[0-9]+|v[0-9]+\.[0-9]+-.*backup|.*backup.*\.js|.*deprecated.*'; then
        continue
      fi
      # 排除缓存文件
      if echo "$file" | grep -qE 'cache|\.tmp|\.temp|\.log$'; then
        continue
      fi
      # 排除旧存档
      if echo "$file" | grep -qE '\.archive/|archive-views/'; then
        continue
      fi
      pack_file "$file"
    done
  fi
done

# 打包根目录关键文件
echo "📦 打包根目录配置..."
for file in SYSTEM.md TOOLS.md AGENTS.md USER.md SOUL.md; do
  if [ -f "$file" ]; then
    pack_file "$file"
  fi
done

echo "" >> $OUTPUT_FILE
echo "---" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "## 📊 统计信息" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "- 总文件数: $TOTAL_FILES" >> $OUTPUT_FILE
echo "- 总行数: $TOTAL_LINES" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "---" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "## ✅ 安装完成" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "完整全量代码已就绪，请配置API密钥后运行系统。" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "**关键配置项**:" >> $OUTPUT_FILE
echo "- \`VOLCENGINE_ARK_API_KEY\` — 火山引擎API密钥" >> $OUTPUT_FILE
echo "- \`OPENAI_API_KEY\` — OpenAI API密钥（如需）" >> $OUTPUT_FILE
echo "- 角色定妆照目录: \`characters/\`（需自行准备图片）" >> $OUTPUT_FILE
echo "- 输出目录: \`output/\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "**系统常量**:" >> $OUTPUT_FILE
echo "- MAX_PROMPT_LENGTH: 980 英文字符" >> $OUTPUT_FILE
echo "- DEFAULT_RATIO: 16:9" >> $OUTPUT_FILE
echo "- MAX_DURATION: 15秒" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "---" >> $OUTPUT_FILE
echo "**END OF INSTALLATION PACKAGE**" >> $OUTPUT_FILE

echo ""
echo "✅ 打包完成: $OUTPUT_FILE"
ls -lh $OUTPUT_FILE
echo "总文件数: $TOTAL_FILES"
echo "总行数: $TOTAL_LINES"
