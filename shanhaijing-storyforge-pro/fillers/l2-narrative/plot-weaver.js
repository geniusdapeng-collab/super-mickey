#!/usr/bin/env node
/**
 * Plot Weaver v3.6-Peng
 * L2 叙事层 — 情节编织器
 * 
 * 基于结构和角色，编织完整的情节网络
 * 支持钩子注入（模式C）
 */

const fs = require('fs').promises;
const fss = require('fs');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const plot = weavePlot(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'plot-weaver',
    output: plot
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Plot Weaver: 情节编织完成（${plot.sceneBreakdown.length}个场景）`);
}

function weavePlot(input) {
  const structure = input.structure || {};
  const characterData = input.characterData || {};
  const world = input.world || {};
  const theme = input.theme || {};
  const hookPlan = input.hookPlan || null;
  
  const characters = characterData.characters || [];
  const acts = structure.acts || [];
  
  // 编织主情节线
  const plotSpine = weavePlotSpine(theme, world, structure);
  
  // 生成支线
  const subPlots = weaveSubPlots(characters, theme, world);
  
  // 生成场景分解
  const sceneBreakdown = weaveScenes(acts, characters, world, hookPlan);
  
  // 因果链
  const causeEffectChain = buildCauseEffectChain(sceneBreakdown);
  
  // 信息揭露时间表
  const revelationSchedule = buildRevelationSchedule(sceneBreakdown, characters);
  
  // 反转点
  const twistPoints = identifyTwistPoints(sceneBreakdown);
  
  // 角色登场时间表
  const characterAppearances = buildCharacterAppearances(sceneBreakdown, characters);
  
  return {
    plotSpine,
    subPlots,
    sceneBreakdown,
    causeEffectChain,
    revelationSchedule,
    twistPoints,
    characterAppearances,
    acts: structure.acts || [], // v7.1.0-fix: 传递acts时长到下游scene-writer
    metadata: {
      totalScenes: sceneBreakdown.length,
      hookCount: hookPlan ? sceneBreakdown.filter(s => s.hookType).length : 0,
      totalCharacters: characters.length,
      estimatedDuration: sceneBreakdown.reduce((sum, s) => sum + (s.durationEstimate || 15), 0)
    }
  };
}

function weavePlotSpine(theme, world, structure) {
  const coreTheme = theme.coreTheme || '成长与改变';
  const worldTagline = world.worldTagline || '一个未知的世界';
  const structureType = structure.structureType || '三幕结构';
  
  return {
    oneLineSummary: `${worldTagline}中，一个${coreTheme}的故事`,
    threeLineSummary: [
      `在${world.worldName || '这个世界'}，${world.coreConflicts?.[0] || '核心矛盾'}`,
      `主角面对${world.coreConflicts?.[1] || '内心挣扎'}，必须在${structure.acts?.[1]?.actName || '关键时刻'}做出抉择`,
      `最终${theme.emotionalFormula?.emotionalArc || '完成转变'}，但代价是${world.coreConflicts?.[2] || '一切'}`
    ],
    centralConflict: world.coreConflicts?.[0] || '核心矛盾',
    emotionalCore: theme.emotionalFormula?.primaryEmotion || '成长'
  };
}

function weaveSubPlots(characters, theme, world) {
  const subPlots = [];
  
  // 为每对关系生成支线
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const c1 = characters[i];
      const c2 = characters[j];
      
      const relationType = determineRelationType(c1, c2);
      const emotionalFunction = determineEmotionalFunction(c1, c2, theme);
      
      subPlots.push({
        name: `${c1.name}与${c2.name}的${relationType}线`,
        description: `${c1.name}（${c1.role}）和${c2.name}（${c2.role}）从${relationType}出发，经历考验`,
        relatedChars: [c1.id, c2.id],
        emotionalFunction,
        plotFunction: determinePlotFunction(c1, c2),
        resolutionType: '开放式' // 或'闭合式'
      });
    }
  }
  
  // 限制支线数量，保持聚焦
  return subPlots.slice(0, Math.min(4, subPlots.length));
}

function determineRelationType(c1, c2) {
  const types = {
    'protagonist-antagonist': '对抗',
    'protagonist-mentor': '师徒',
    'protagonist-ally': '伙伴',
    'protagonist-love': '爱情',
    'antagonist-mentor': '昔日师生',
    'mentor-ally': '指引'
  };
  return types[`${c1.role}-${c2.role}`] || types[`${c2.role}-${c1.role}`] || '复杂关系';
}

function determineEmotionalFunction(c1, c2, theme) {
  if (theme.emotionalFormula?.primaryEmotion === '孤独') return '提供连接与温暖';
  if (theme.emotionalFormula?.primaryEmotion === '热血') return '激发勇气与决心';
  if (theme.emotionalFormula?.primaryEmotion === '怀旧') return '唤醒记忆与情感';
  return '深化主题';
}

function determinePlotFunction(c1, c2) {
  if (c1.role === 'protagonist' || c2.role === 'protagonist') return '推动主角成长';
  if (c1.role === 'antagonist' || c2.role === 'antagonist') return '制造冲突与阻力';
  return '丰富世界与背景';
}

function buildCharacterAppearances(sceneBreakdown, characters) {
  const appearances = {};
  characters.forEach(c => appearances[c.id] = []);
  
  sceneBreakdown.forEach((scene, index) => {
    (scene.characters || []).forEach(cid => {
      if (appearances[cid]) appearances[cid].push(index + 1);
    });
  });
  
  return appearances;
}

function weaveScenes(acts, characters, world, hookPlan) {
  const scenes = [];
  let sceneIndex = 1;
  
  acts.forEach(act => {
    const actScenes = act.keyBeats || [];
    
    actScenes.forEach(beat => {
      const scene = {
        sceneId: `SC${String(sceneIndex).padStart(2, '0')}`,
        act: act.actName,
        purpose: beat.beatName,
        setting: world.geography?.split('、')[0] || '主要场景',
        characters: selectCharactersForScene(characters, sceneIndex),
        sceneQuestion: `这个场景提出的疑问: ${beat.beatName}？`,
        sceneAnswer: `这个场景给出的答案: ${beat.description || '推进'}`,
        emotionalTurn: generateEmotionalTurn(act.actNumber, beat),
        durationEstimate: beat.estimatedDuration || 15,
        prerequisiteScenes: sceneIndex > 1 ? [`SC${String(sceneIndex - 1).padStart(2, '0')}`] : [],
        dependentScenes: [],
        hookType: hookPlan ? selectHookType(sceneIndex, hookPlan) : null,
        isClimax: beat.isKeyMoment || false,
        tension: calculateTension(act, beat)
      };
      
      scenes.push(scene);
      sceneIndex++;
    });
  });
  
  // 更新依赖关系
  scenes.forEach((scene, i) => {
    if (i < scenes.length - 1) {
      scene.dependentScenes.push(scenes[i + 1].sceneId);
    }
  });
  
  return scenes;
}

function selectCharactersForScene(characters, sceneIndex) {
  // 选择2-3个角色参与场景
  const selected = characters.slice(0, Math.min(3, characters.length));
  return selected.map(c => c.id);
}

function generateEmotionalTurn(actNumber, beat) {
  const turns = {
    1: '从平静到不安',
    2: '从希望到绝望',
    3: '从低谷到觉醒',
    4: '从紧张到释然'
  };
  return turns[actNumber] || '推进';
}

function selectHookType(sceneIndex, hookPlan) {
  const hooks = ['suspense', 'twist', 'emotion', 'crisis', 'info'];
  return hooks[sceneIndex % hooks.length];
}

function calculateTension(act, beat) {
  const baseTension = act.tensionRange ? (act.tensionRange[0] + act.tensionRange[1]) / 2 : 50;
  return beat.isKeyMoment ? Math.min(baseTension + 20, 100) : baseTension;
}

function buildCauseEffectChain(scenes) {
  const chain = scenes.map((scene, i) => {
    if (i === 0) return `开始: ${scene.purpose}`;
    return `${scenes[i - 1].purpose} → ${scene.purpose}`;
  });
  return chain.join(' → ');
}

function buildRevelationSchedule(scenes, characters) {
  const revelations = [];
  
  // 每3-4个场景安排一个信息揭露
  scenes.forEach((scene, i) => {
    if (i > 0 && i % 3 === 0) {
      revelations.push({
        sceneId: scene.sceneId,
        time: `场景${i + 1}`,
        revelation: `揭露${characters[0]?.name || '主角'}的隐藏信息`,
        impact: '改变观众对角色的理解'
      });
    }
  });
  
  return revelations;
}

function identifyTwistPoints(scenes) {
  const twists = [];
  
  scenes.forEach((scene, i) => {
    if (scene.isClimax || scene.hookType === 'twist') {
      twists.push({
        sceneId: scene.sceneId,
        description: `${scene.purpose}中的意外转折`,
        type: scene.hookType === 'twist' ? '预期打破' : '高潮反转'
      });
    }
  });
  
  return twists;
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