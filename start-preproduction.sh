#!/bin/bash
# SuperMickey v2.1.8 预生产启动脚本 - 京剧《霸王别姬》

cd /root/.openclaw/workspace/github-repos/super-mickey

echo "========================================"
echo "Step 1: 清理旧数据"
echo "========================================"
rm -rf checkpoints output debug_llm
mkdir -p checkpoints output debug_llm
echo "✓ 目录已清理并重建"
echo ""

echo "========================================"
echo "设置环境变量"
echo "========================================"
export STORMAXE_USER_INTENT="京剧《霸王别姬》——虞姬的剑舞与自刎。完整复刻梅兰芳版《霸王别姬》中虞姬的剑舞段落：从'劝君王饮酒听虞歌'的唱腔开始，经历水袖、云步、剑花的完整程式，最终在'汉兵已略地，四面楚歌声'中自刎。需要展现京剧的虚拟化表演美学。剑舞需包含至少12个标准京剧程式动作：云手、亮相、鹞子翻身、探海、射雁、卧鱼、剑花（正反各3组）、涮腰、跨腿、转身、云步、最后的'自刎'（剑横颈、水袖抛出的'尸'）。水袖布料解算需达到丝绸级精度（长度1.2米）。'自刎'后的'尸'（僵尸摔）需有真实身体僵直与倒地物理。背景需有真实的京剧乐队（京胡、月琴、板鼓、大锣），乐手动作与唱腔同步。"
echo "STORMAXE_USER_INTENT 已设置"
echo ""

echo "========================================"
echo "启动预生产流程"
echo "========================================"
node run-preproduction-iron-pot-star.js "$STORMAXE_USER_INTENT"
