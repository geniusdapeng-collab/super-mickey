#!/usr/bin/env node
/**
 * Spectacle Designer v3.6-Peng
 * M5 增强模块 — AI视觉奇观规划器
 * 
 * 6大奇观类型：异兽登场 / 变身化形 / 法术释放 / 场景奇观 / 战斗冲击 / 情绪视觉
 */

const fs = require('fs').promises;
const fss = require('fs');

const SPECTACLE_TYPES = {
  creatureReveal: {
    name: '异兽登场',
    description: '神话生物首次登场',
    formula: '宏大环境 + 全貌reveal + 动态光影',
    duration: '5-8s',
    promptTemplate: '{creature}，{environment}，{lighting}，竖屏构图'
  },
  transformation: {
    name: '变身化形',
    description: '角色形态转换',
    formula: '当前形态 → 粒子转换 → 新形态',
    duration: '3-5s',
    promptTemplate: '{character}变身，粒子特效，{newForm}，震撼转换'
  },
  spellCast: {
    name: '法术释放',
    description: '法术/技能视觉',
    formula: '手势 → 能量聚集 → 释放 → 击中',
    duration: '2-4s',
    promptTemplate: '{character}施法，{spellEffect}，能量流动，{color}'
  },
  sceneSpectacle: {
    name: '场景奇观',
    description: '宏大场景reveal',
    formula: '遮挡物 → 逐渐reveal → 全景震撼',
    duration: '5-10s',
    promptTemplate: '宏大场景，{scene}，云雾散开，reveal，震撼全景'
  },
  combatImpact: {
    name: '战斗冲击',
    description: '动作戏视觉高潮',
    formula: '对峙 → 冲击瞬间 → 冲击波扩散',
    duration: '3-5s',
    promptTemplate: '战斗冲击，{action}，冲击波，{effect}，慢动作'
  },
  emotionVisual: {
    name: '情绪视觉',
    description: '情绪外化为环境',
    formula: '人物表情 + 环境呼应情绪 + 特效',
    duration: '2-3s',
    promptTemplate: '{emotion}情绪，{character}表情，环境呼应，{effect}'
  }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const spectacles = designSpectacles(input);
  
  fss.writeFileSync(args.output, JSON.stringify(spectacles, null, 2));
  console.log('✅ Spectacle Designer: 奇观设计完成');
}

function designSpectacles(data) {
  // v7.1.0-fix: 防御式编程，确保 scenes 是数组
  let scenes = data.scenes || [];
  if (!Array.isArray(scenes)) {
    if (typeof scenes === 'object' && scenes !== null) {
      scenes = Object.values(scenes);
    } else {
      scenes = [];
    }
  }
  const level = data.level || 'standard';
  
  const densityMap = {
    minimal: { total: 5, big: 1, small: 4 },
    standard: { total: 15, big: 5, small: 10 },
    maximum: { total: 30, big: 10, small: 20 }
  };
  
  const density = densityMap[level] || densityMap.standard;
  const spectacleList = [];
  
  // 为场景分配奇观
  const types = Object.keys(SPECTACLE_TYPES);
  let spectacleCount = 0;
  
  scenes.forEach((scene, index) => {
    // 关键场景分配奇观
    if (isKeyScene(scene, index) && spectacleCount < density.total) {
      const type = types[spectacleCount % types.length];
      const template = SPECTACLE_TYPES[type];
      const isBig = spectacleCount < density.big;
      
      spectacleList.push({
        sceneId: scene.sceneId || index,
        type,
        name: template.name,
        description: template.description,
        seedancePrompt: generatePrompt(template, scene),
        duration: isBig ? '5-8s' : '2-4s',
        isBig,
        emotionalContext: scene.emotionalArc || '中性'
      });
      
      spectacleCount++;
    }
  });
  
  return {
    spectacles: spectacleList,
    density,
    level
  };
}

function isKeyScene(scene, index) {
  // 判断是否为关键场景（需要奇观）
  if (index === 0) return true; // 开场
  if (scene.isClimax) return true; // 高潮
  if (scene.emotionalArc?.includes('沸')) return true; // 情绪顶点
  if (scene.purpose?.includes('登场')) return true; // 角色登场
  return false;
}

function generatePrompt(template, scene) {
  return template.promptTemplate
    .replace('{creature}', scene.characters?.[0] || '神秘生物')
    .replace('{environment}', scene.slugline || '宏大场景')
    .replace('{lighting}', '月光/霓虹')
    .replace('{character}', scene.characters?.[0] || '主角')
    .replace('{newForm}', '新形态')
    .replace('{spellEffect}', '能量爆发')
    .replace('{color}', '金色/蓝色')
    .replace('{scene}', scene.slugline || '场景')
    .replace('{action}', '战斗')
    .replace('{effect}', '冲击波')
    .replace('{emotion}', scene.emotionalArc || '强烈');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--output') args.output = argv[++i];
  }
  return args;
}

main();
