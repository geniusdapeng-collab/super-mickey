#!/usr/bin/env node
/**
 * Character Forge v3.6-Peng
 * L2 叙事层 — 角色锻造炉
 * 
 * 深度设计角色系统：人设 + 弧光 + 转变 + 关系网络
 */

const fs = require('fs');

// ============ 真人皮肤质感规范 v5.1-Peng ============
// 当角色为人类/写实风格时，在视觉描述中追加皮肤质感
// 避免AI典型的"磨皮塑料感"
const SKIN_TEXTURE_PRESETS = {
  wide: '自然肤质，非过度光滑',
  medium: '可见皮肤纹理与毛孔，真实肤质反光',
  closeup: '毛孔细节清晰，细微皮肤瑕疵，自然光泽，拒绝磨皮塑料感'
};

function getSkinTexture(shotDistance = 'medium', species = '人类', style = '') {
  const isHumanLike = /人类|真人|写实|现实|realistic|human|live-action/i.test(species + ' ' + style);
  if (!isHumanLike) return '';
  return SKIN_TEXTURE_PRESETS[shotDistance] || SKIN_TEXTURE_PRESETS.medium;
}

const ARCHETYPES = {
  'protagonist': {
    role: 'protagonist',
    desire: '获得认可/实现使命',
    fear: '被抛弃/失败',
    lie: '我需要变得更强才有价值',
    truth: '真正的价值在于选择'
  },
  'antagonist': {
    role: 'antagonist',
    desire: '控制/秩序',
    fear: '混乱/失控',
    lie: '只有我能保护这个世界',
    truth: '控制不是保护'
  },
  'mentor': {
    role: 'mentor',
    desire: '传承智慧',
    fear: '被遗忘',
    lie: '我已完成了使命',
    truth: '传承永无止境'
  },
  'ally': {
    role: 'ally',
    desire: '友谊/归属感',
    fear: '孤独/背叛',
    lie: '我需要取悦他人',
    truth: '真正的友谊不需要讨好'
  },
  'trickster': {
    role: 'trickster',
    desire: '自由/乐趣',
    fear: '无聊/束缚',
    lie: '规则是用来打破的',
    truth: '自由需要责任平衡'
  }
};

function generateFeatures(role, world) {
  const archetype = ARCHETYPES[role] || ARCHETYPES['protagonist'];
  const features = {
    desire: archetype.desire,
    fear: archetype.fear,
    lie: archetype.lie,
    truth: archetype.truth,
    transformation: {
      trigger: '关键事件触发转变',
      process: '内心挣扎与选择',
      result: '成长后的新自我'
    }
  };
  return features;
}

function generateName(role, world) {
  const names = {
    'protagonist': ['Alex', 'Luna', 'Kai'],
    'antagonist': ['Shadow', 'Vex', 'Mal'],
    'mentor': ['Elder', 'Sage', 'Guide'],
    'ally': ['Friend', 'Companion', 'Partner'],
    'trickster': ['Jester', 'Rogue', 'Mischief']
  };
  const roleNames = names[role] || names['protagonist'];
  return roleNames[Math.floor(Math.random() * roleNames.length)];
}

function generateSignature(role) {
  const signatures = {
    'protagonist': '坚定的眼神',
    'antagonist': '神秘的微笑',
    'mentor': '智慧的光芒',
    'ally': '温暖的笑容',
    'trickster': '调皮的眼神'
  };
  return signatures[role] || '独特的气质';
}

function generateMBTI(role) {
  const mbti = {
    'protagonist': 'ENFJ',
    'antagonist': 'INTJ',
    'mentor': 'INFJ',
    'ally': 'ESFP',
    'trickster': 'ENTP'
  };
  return mbti[role] || 'XXXX';
}

function generateCharacterArc(role) {
  return {
    startingState: '平凡/困惑',
    incitingIncident: '触发事件',
    risingAction: '成长过程',
    climax: '关键时刻',
    resolution: '蜕变完成'
  };
}

function generateVoiceProfile(role) {
  return {
    tone: '温暖而坚定',
    pitch: '中音',
    speed: '适中',
    accent: '标准'
  };
}

function generateVisualNotes(role, world) {
  return {
    appearance: '根据角色设定',
    clothing: '符合世界观',
    accessories: '标志性物品',
    overall: '视觉印象'
  };
}

// ============ 模块导出（v5.1-Peng：支持被require引入）============
module.exports = { getSkinTexture, generateFeatures, generateName, generateSignature, generateMBTI, generateCharacterArc, generateVoiceProfile, generateVisualNotes };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--output') args.output = argv[++i];
  }
  return args;
}

// 仅在直接执行时运行main()
if (require.main === module) {
  main();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('Character Forge v3.6-Peng');
  console.log('Usage: node character-forge.js --input <file> --output <file>');
}