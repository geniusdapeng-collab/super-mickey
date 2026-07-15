#!/usr/bin/env node
/**
 * Hook Factory v3.6-Peng
 * M3 增强模块 — 开场与集尾钩子生成器
 * 
 * 5种开场钩子 + 集尾悬念生成
 */

const fs = require('fs').promises;
const fss = require('fs');

const HOOK_TEMPLATES = {
  crisis: {
    name: '危机开场',
    template: '直接切入最危险时刻',
    example: '刀尖抵住喉咙的第一视角',
    retentionRate: '85%+'
  },
  puzzle: {
    name: '谜题开场',
    template: '展示不解释的奇异现象',
    example: '镜子里的自己在微笑，但现实中没有',
    retentionRate: '80%+'
  },
  dialogue: {
    name: '台词钩子',
    template: '第一句就是爆炸信息',
    example: '"你杀了我父亲。"——女孩握着刀',
    retentionRate: '78%+'
  },
  visual: {
    name: '视觉奇观',
    template: '直接展示最强视觉画面',
    example: '九尾狐月光下展开九条尾巴',
    retentionRate: '82%+'
  },
  emotion: {
    name: '情绪冲击',
    template: '展示最极致情绪画面',
    example: '雨中崩溃大哭的无声画面',
    retentionRate: '75%+'
  }
};

const ENDING_HOOK_TEMPLATES = {
  suspense: (scene) => `${scene.climax} —— 但 ${scene.unansweredQuestion || '答案尚未揭晓'}`,
  twist: (scene) => `${scene.expectedOutcome || '预期发展'} —— 然而 ${scene.unexpectedTwist || '意想不到的转折'}`,
  emotion: (scene) => `${scene.emotionalPeak || '情感高潮'} —— 突然 ${scene.emotionalCut || '画面定格'}`,
  crisis: (scene) => `${scene.lifeThreateningMoment || '生死瞬间'} —— 画面定格`
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const hooked = injectHooks(input);
  
  fss.writeFileSync(args.output, JSON.stringify(hooked, null, 2));
  console.log('✅ Hook Factory: 钩子注入完成');
}

function injectHooks(data) {
  const scenes = data.scenes || {};
  const hookDensity = data.hookDensity || 'high';
  
  return Object.entries(scenes).map(([id, scene], index) => {
    // 第一集开场钩子
    const openingHook = index === 0 ? generateOpeningHook(scene, hookDensity) : null;
    
    // 集尾钩子
    const endingHook = generateEndingHook(scene);
    
    return {
      ...scene,
      openingHook,
      endingHook,
      hookInjected: true
    };
  });
}

function generateOpeningHook(scene, density) {
  const types = Object.keys(HOOK_TEMPLATES);
  const selectedType = types[Math.floor(Math.random() * types.length)];
  const template = HOOK_TEMPLATES[selectedType];
  
  return {
    type: selectedType,
    name: template.name,
    description: template.template,
    example: template.example,
    estimatedRetention: template.retentionRate,
    generatedFor: scene.slugline || '开场'
  };
}

function generateEndingHook(scene) {
  const types = Object.keys(ENDING_HOOK_TEMPLATES);
  const selectedType = types[Math.floor(Math.random() * types.length)];
  const generator = ENDING_HOOK_TEMPLATES[selectedType];
  
  return {
    type: selectedType,
    text: generator(scene),
    purpose: '驱动观众点击下一集'
  };
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