#!/usr/bin/env node
/**
 * Cinematography Planner v3.6-Peng
 * L3 剧本层 — 镜头预规划器
 * 
 * 在剧本阶段规划镜头语言，为下游 shot-design 提供详细指导
 * 支持 ScreenplayCraft shotPlan 字段
 */

const fs = require('fs').promises;
const fss = require('fs');

const SHOT_TYPES = [
  { name: '全景', size: '全景', angle: '航拍', movement: '缓慢下降推轨', lens: '广角' },
  { name: '中景', size: '中景', angle: '平视', movement: '固定', lens: '标准' },
  { name: '特写', size: '特写', angle: '正面', movement: '缓慢推进', lens: '长焦' },
  { name: '主观', size: '主观镜头', angle: '角色视角', movement: '手持晃动', lens: '广角' }
];

const LIGHTING_PRESETS = {
  '晨光': '晨光逆光暖金',
  '夜景': '夜景冷蓝+暖色点缀',
  '室内': '室内柔光+阴影层次',
  '战斗': '高对比+动态光影'
};

const COLOR_PALETTES = {
  'warm': ['#FFD700', '#FF6347', '#8B4513'],
  'cool': ['#87CEEB', '#4169E1', '#191970'],
  'dramatic': ['#DC143C', '#000000', '#FFD700'],
  'neutral': ['#808080', '#A9A9A9', '#D3D3D3']
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const cinematography = planCinematography(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'cinematography-planner',
    output: cinematography
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Cinematography Planner: ${cinematography.shotPlan.length}个镜头规划完成`);
}

function planCinematography(input) {
  // 支持两种输入格式
  const sceneData = input.sceneData || {};
  const plotData = input.plot || {};
  const structureData = input.structure || {};
  const world = input.world || {};
  const videoType = input.videoType || 'action';
  const visualStyle = input.visualStyle || world.visual_style?.style || '写实';
  const totalDuration = input.totalDuration || input.duration || 180;
  const spectaclePlan = input.spectaclePlan || null;
  
  // 从 plotData 或 sceneData 获取场景列表
  const scenes = plotData.sceneBreakdown || plotData.scenes || sceneData.scenes || [];
  
  // 视觉风格宣言
  const visualManifesto = generateVisualManifesto(visualStyle, world);
  
  // 灯光系统
  const lightingSystem = generateLightingSystem(world, videoType);
  
  // 镜头规划
  const shotPlan = generateShotPlan(scenes, videoType, visualStyle, world, spectaclePlan);
  
  // 情绪曲线
  const emotionCurve = generateEmotionCurve(shotPlan, totalDuration);
  
  return {
    visualManifesto,
    lightingSystem,
    shotPlan,
    emotionCurve,
    metadata: {
      totalShots: shotPlan.length,
      totalDuration,
      videoType,
      visualStyle
    }
  };
}

function generateVisualManifesto(visualStyle, world) {
  const atmosphere = world.atmosphereKeywords?.join('、') || '未知氛围';
  return `${visualStyle}风格，${atmosphere}氛围，追求${world.visual_style?.mood || '情感真实'}`;
}

function generateLightingSystem(world, videoType) {
  const climate = world.climate || '温和气候';
  const preset = LIGHTING_PRESETS[climate] || LIGHTING_PRESETS['室内'];
  
  return {
    keyLight: preset,
    fillLight: '补光弱化阴影',
    backLight: '轮廓光分离背景',
    colorTemperature: videoType === 'action' ? '偏冷' : '偏暖',
    overallStyle: videoType === 'action' ? '高对比' : '柔和'
  };
}

function generateShotPlan(scenes, videoType, visualStyle, world, spectaclePlan) {
  const shots = [];
  let timeOffset = 0;
  
  scenes.forEach((scene, sceneIndex) => {
    // 每个场景至少3个镜头
    const sceneDuration = scene.durationEstimate || 15;
    const shotCount = scene.isClimax ? 5 : 3;
    
    const shotTypes = [
      { name: '全景', size: '全景', angle: '航拍', movement: '缓慢下降推轨', lens: '广角', type: 'establishing' },
      { name: '中景', size: '中景', angle: '平视', movement: '固定', lens: '标准', type: 'development' },
      { name: '特写', size: '特写', angle: '正面', movement: '缓慢推进', lens: '长焦', type: 'climax' },
      { name: '近景', size: '近景', angle: '侧视', movement: '微推', lens: '标准', type: 'reaction' },
      { name: '空镜', size: '远景', angle: '俯视', movement: '缓慢横移', lens: '广角', type: 'transition' }
    ];
    
    for (let i = 0; i < shotCount; i++) {
      const shotType = shotTypes[i % shotTypes.length];
      const duration = Math.round(sceneDuration / shotCount);
      const palette = selectColorPalette(scene.emotionalTone || scene.emotionalTurn || '中性');
      const isSpectacle = spectaclePlan?.spectacles?.some(s => s.shotId === `${scene.sceneId}-S${i+1}`) || false;
      
      const shot = {
        shotId: `${scene.sceneId || `SC${String(sceneIndex+1).padStart(2,'0')}`}-S${i + 1}`,
        act: scene.act || '未指定',
        actIndex: sceneIndex + 1,
        duration: duration,
        timeRange: `${timeOffset}-${timeOffset + duration}s`,
        type: shotType.type,
        description: `${shotType.size}镜头，${shotType.movement}，展示${scene.purpose || '场景内容'}`,
        camera: {
          shotSize: shotType.size,
          angle: shotType.angle,
          movement: shotType.movement,
          lens: shotType.lens
        },
        lighting: inferLighting(scene.emotionalTone || scene.emotionalTurn),
        composition: '三分法',
        colorPalette: palette,
        handoff: `${shotType.movement}至下一镜头`,
        transition: { type: '硬切', duration: 0.5 },
        tension: scene.tension || 50,
        emotionStart: scene.emotionalTone || scene.emotionalTurn || '中性',
        emotionEnd: scene.emotionalTone || scene.emotionalTurn || '中性',
        characters: scene.characters || [],
        isSpectacle,
        spectacleType: isSpectacle ? '视觉奇观' : null
      };
      
      shots.push(shot);
      timeOffset += shot.duration;
    }
  });
  
  return shots;
}

function inferLighting(emotion) {
  const lights = {
    '愤怒': '高对比+暖色侧光',
    '悲伤': '冷蓝+柔和补光',
    '喜悦': '暖金+高亮度',
    '恐惧': '绿/蓝冷光+长阴影',
    '决心': '单侧硬光+深色背景',
    '温柔': '柔光+暖色调',
    '中性': '自然光+中性色温'
  };
  return lights[emotion] || lights['中性'];
}

function selectColorPalette(emotion) {
  if (emotion.includes('怒') || emotion.includes('沸')) return COLOR_PALETTES.dramatic;
  if (emotion.includes('悲') || emotion.includes('冷')) return COLOR_PALETTES.cool;
  if (emotion.includes('暖') || emotion.includes('喜')) return COLOR_PALETTES.warm;
  return COLOR_PALETTES.neutral;
}

function generateEmotionCurve(shotPlan, totalDuration) {
  const curve = [];
  const points = 20;
  
  for (let i = 0; i <= points; i++) {
    const time = (i / points) * totalDuration;
    const shot = shotPlan.find(s => {
      const [start, end] = s.timeRange.split('-').map(t => parseInt(t));
      return time >= start && time <= end;
    }) || shotPlan[0];
    
    curve.push({
      time,
      tension: shot?.tension || 50,
      emotion: shot?.emotionStart || '中性'
    });
  }
  
  return curve;
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