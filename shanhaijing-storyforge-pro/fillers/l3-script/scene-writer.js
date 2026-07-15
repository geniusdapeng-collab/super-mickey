#!/usr/bin/env node
/**
 * Scene Writer v3.6-Peng
 * L3 脚本层 — 场景编剧
 * 
 * 根据 Plot 生成完整场景列表，包含 shots、情绪、角色分配
 */

const fs = require('fs').promises;
const fss = require('fs');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const scenes = generateScenes(input);
  
  const output = { output: { scenes } };
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log('✅ Scene Writer: 场景生成完成');
}

function generateScenes(data) {
  const plot = data.plot || {};
  const characterData = data.characterData || {};
  const world = data.world || {};
  const characters = characterData.characters || [];
  
  // 从 plot 提取 acts，或回退到默认五幕
  const acts = plot.acts || [
    { name: '起', duration: 20, focus: '引入' },
    { name: '承', duration: 30, focus: '发展' },
    { name: '转', duration: 20, focus: '转折' },
    { name: '高潮', duration: 25, focus: '冲突' },
    { name: '合', duration: 5, focus: '结局' }
  ];
  
  const scenes = [];
  let sceneCounter = 1;
  
  // 为每幕生成场景
  for (const act of acts) {
    const actName = act.name || act.actName || '起';
    const actDuration = act.duration || 20;
    const actFocus = act.focus || act.purpose || '';
    
    // 每幕场景数：基于时长和内容密度
    let scenesPerAct = 1;
    if (actDuration >= 30) scenesPerAct = 2;
    if (actDuration >= 50) scenesPerAct = 3;
    if (actName === '高潮') scenesPerAct = Math.max(scenesPerAct, 2); // 高潮至少2场
    
    // 为每幕生成多个场景
    for (let s = 0; s < scenesPerAct; s++) {
      const sceneId = `SC${String(sceneCounter).padStart(3, '0')}`;
      const sceneNumInAct = s + 1;
      
      // 场景描述：基于幕的功能和场景序号
      const sceneDesc = generateSceneDescription(actName, actFocus, sceneNumInAct, s, scenesPerAct, world);
      
      // 为该场景生成 shots
      const sceneShots = generateShotsForScene(actName, actDuration, sceneNumInAct, scenesPerAct, characters, world);
      
      // 情绪弧线
      const emotionalTone = generateEmotionalTone(actName, sceneNumInAct, scenesPerAct);
      
      // 场景角色：根据幕功能选择
      const sceneChars = selectCharactersForScene(actName, characters, sceneNumInAct);
      
      scenes.push({
        sceneId,
        slugLine: `${world.name || '现代都市'} · ${actName}幕第${sceneNumInAct}场`,
        slugline: `${world.name || '现代都市'} · ${actName}幕第${sceneNumInAct}场`,
        purpose: sceneDesc.purpose,
        emotionalTone,
        emotional_arc: emotionalTone,
        characters: sceneChars,
        shots: sceneShots,
        lightingSetup: sceneDesc.lighting,
        visual_notes: sceneDesc.visual,
        audio_notes: sceneDesc.audio,
        act: actName, // v5.5-Peng: 标记所属幕，供 video-renderer 使用
        actIndex: getActIndex(actName)
      });
      
      sceneCounter++;
    }
  }
  
  return scenes;
}

function getActIndex(actName) {
  const map = { '起': 1, '承': 2, '转': 3, '高潮': 4, '合': 5 };
  return map[actName] || 1;
}

function generateSceneDescription(actName, focus, sceneNum, sceneIdx, totalScenes, world) {
  const locations = world.locations || ['办公室', '街道', '咖啡厅'];
  const location = locations[sceneIdx % locations.length];
  
  const templates = {
    '起': {
      purposes: [
        '建置主角世界，展示日常状态',
        '引入核心冲突的种子',
        '建立主角与关键人物的关系'
      ],
      lighting: '柔和自然光，营造日常氛围',
      visual: '平稳构图，环境细节丰富',
      audio: '环境音为主，节奏舒缓'
    },
    '承': {
      purposes: [
        '冲突升级，主角面临挑战',
        '关系深化，盟友与对手显现',
        '世界扩展，揭示更多背景'
      ],
      lighting: '对比增强，阴影加深',
      visual: '动态构图，运动增加',
      audio: ' tension 上升，音乐渐强'
    },
    '转': {
      purposes: [
        '关键转折，主角做出选择',
        '真相揭示，局势逆转',
        '内心觉醒，角色成长'
      ],
      lighting: '戏剧性光影，明暗对比强烈',
      visual: '视角突变，节奏加速',
      audio: '情绪爆发，音乐高潮'
    },
    '高潮': {
      purposes: [
        '最终对决，正面对抗',
        '情感爆发，一切推向顶点',
        '命运抉择，胜负在此一举'
      ],
      lighting: '强烈对比， spotlight 效果',
      visual: '高速运动，冲击力强',
      audio: '全频段爆发，震撼音效'
    },
    '合': {
      purposes: [
        '余韵悠长，情感沉淀',
        '新平衡建立，角色归于平静',
        '主题升华，留下思考'
      ],
      lighting: '温暖柔和，余晖般的光',
      visual: '开阔构图，留白增多',
      audio: '渐弱，余音绕梁'
    }
  };
  
  const tmpl = templates[actName] || templates['起'];
  const purposeIdx = Math.min(sceneIdx, tmpl.purposes.length - 1);
  
  return {
    purpose: `${location} — ${tmpl.purposes[purposeIdx]}`,
    lighting: tmpl.lighting,
    visual: tmpl.visual,
    audio: tmpl.audio
  };
}

function generateShotsForScene(actName, actDuration, sceneNum, totalScenes, characters, world) {
  const shots = [];
  
  // 每个场景的镜头数
  let shotsPerScene = 2;
  if (actName === '高潮') shotsPerScene = 3;
  if (actName === '起' && sceneNum === 1) shotsPerScene = 3; // 开场多建置
  
  // 每个镜头的平均时长
  const avgShotDuration = Math.max(3, Math.floor(actDuration / (totalScenes * shotsPerScene)));
  
  for (let i = 0; i < shotsPerScene; i++) {
    const shotId = `${actName}-S${sceneNum}-${i + 1}`;
    const shotType = getShotType(actName, i, shotsPerScene);
    const shotDesc = getShotDescription(actName, i, shotsPerScene, characters, world);
    const cameraDir = getCameraDirection(actName, i, shotsPerScene);
    const lighting = getLighting(actName, i);
    
    shots.push({
      shotId,
      type: shotType,
      duration: avgShotDuration,
      description: shotDesc,
      cameraDirection: cameraDir,
      lighting,
      tension: getTension(actName, i, shotsPerScene)
    });
  }
  
  return shots;
}

function getShotType(actName, shotIndex, totalShots) {
  const types = {
    '起': ['建置', '入场', '关系'],
    '承': ['发展', '冲突', '揭示'],
    '转': ['转折', '选择', '觉醒'],
    '高潮': ['对抗', '爆发', '顶点'],
    '合': ['收束', '余韵', '升华']
  };
  
  const actTypes = types[actName] || ['建置', '发展', '转折'];
  return actTypes[shotIndex % actTypes.length];
}

function getShotDescription(actName, shotIndex, totalShots, characters, world) {
  const charNames = characters.map(c => c.name || c.id).filter(Boolean);
  const mainChar = charNames[0] || '主角';
  const secondChar = charNames[1] || '配角';
  
  const descs = {
    '起': [
      `${mainChar}在${world.locations?.[0] || '办公室'}中，日常状态展示`,
      `${mainChar}与${secondChar}初次互动，关系建立`,
      `环境全景，${world.name || '世界'}氛围建置`
    ],
    '承': [
      `${mainChar}遇到困难，开始挣扎`,
      `${secondChar}提供帮助或制造障碍`,
      `冲突升级，局势复杂化`
    ],
    '转': [
      `${mainChar}面对关键抉择`,
      `真相揭示，${mainChar}内心震动`,
      `局势逆转，${mainChar}做出改变`
    ],
    '高潮': [
      `${mainChar}与${secondChar}正面对抗`,
      `情感爆发，所有矛盾集中释放`,
      `${mainChar}全力以赴，命运时刻`
    ],
    '合': [
      `${mainChar}归于平静，新状态建立`,
      `余韵镜头，情感沉淀`,
      `主题升华，留给观众思考空间`
    ]
  };
  
  const actDescs = descs[actName] || descs['起'];
  return actDescs[shotIndex % actDescs.length];
}

function getCameraDirection(actName, shotIndex, totalShots) {
  const cameras = {
    '起': ['全景固定，环境展示', '中景缓推，人物入场', '近景切换，关系建立'],
    '承': ['中景跟随，动作展开', '特写插入，情绪细节', '快速切换，节奏加快'],
    '转': ['手持晃动，不安感', '视角突变，冲击力', '环绕拍摄，戏剧性'],
    '高潮': ['快速横移，对抗感', '仰拍推进，力量感', '特写冻结，情绪顶点'],
    '合': ['航拍下降，视野开阔', '缓慢推轨，余韵悠长', '固定长镜头，沉淀感']
  };
  
  const actCams = cameras[actName] || cameras['起'];
  return actCams[shotIndex % actCams.length];
}

function getLighting(actName, shotIndex) {
  const lights = {
    '起': '自然光，柔和明亮',
    '承': '侧光，对比增强',
    '转': '戏剧光，明暗强烈',
    '高潮': '聚光效果，高光强烈',
    '合': '柔光，温暖余晖'
  };
  return lights[actName] || '中性光';
}

function getTension(actName, shotIndex, totalShots) {
  const base = { '起': 20, '承': 50, '转': 80, '高潮': 90, '合': 40 };
  const b = base[actName] || 50;
  // 同一场景内，张力递增
  const progress = totalShots > 1 ? shotIndex / (totalShots - 1) : 0;
  return Math.min(100, Math.round(b + progress * 10));
}

function selectCharactersForScene(actName, characters, sceneNum) {
  if (!characters || characters.length === 0) return [];
  
  const charNames = characters.map(c => c.name || c.id).filter(Boolean);
  
  // 不同幕的角色选择策略
  switch(actName) {
    case '起':
      // 主角 + 1-2个关键配角
      return charNames.slice(0, Math.min(3, charNames.length));
    case '承':
      // 主角 + 盟友/对手
      return charNames.slice(0, Math.min(3, charNames.length));
    case '转':
      // 主角 + 关键对手
      return charNames.slice(0, Math.min(2, charNames.length));
    case '高潮':
      // 所有主要角色
      return charNames.slice(0, Math.min(4, charNames.length));
    case '合':
      // 主角 + 核心关系角色
      return charNames.slice(0, Math.min(2, charNames.length));
    default:
      return charNames.slice(0, 2);
  }
}

function generateEmotionalTone(actName, sceneNum, totalScenes) {
  const tones = {
    '起': ['从平静到不安', '从希望到疑虑'],
    '承': ['从紧张到绝望', '从冲突到僵持'],
    '转': ['从绝望到希望', '从困惑到觉醒'],
    '高潮': ['从坚定到爆发', '从对抗到胜负'],
    '合': ['从释然到平静', '从平静到温馨']
  };
  
  const actTones = tones[actName] || ['中性'];
  return actTones[(sceneNum - 1) % actTones.length];
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
