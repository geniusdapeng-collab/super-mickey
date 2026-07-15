#!/usr/bin/env node
/**
 * Structure Engine v3.6-Peng
 * L2 叙事层 — 结构引擎
 * 
 * 基于世界观和主题，设计叙事结构和幕结构
 * 支持多种结构模板 + 卡点注入（模式C）
 */

const fs = require('fs').promises;
const fss = require('fs');

const STRUCTURE_TEMPLATES = {
  'three-act': {
    name: '三幕结构',
    acts: [
      { number: 1, name: '起/Setup', durationRatio: 0.25, tensionRange: [0, 40] },
      { number: 2, name: '承/Confrontation', durationRatio: 0.50, tensionRange: [40, 80] },
      { number: 3, name: '转/Resolution', durationRatio: 0.25, tensionRange: [80, 100] }
    ]
  },
  'four-act': {
    name: '四幕结构',
    acts: [
      { number: 1, name: '第一幕', durationRatio: 0.20, tensionRange: [0, 30] },
      { number: 2, name: '第二幕（上）', durationRatio: 0.30, tensionRange: [30, 60] },
      { number: 3, name: '第二幕（下）', durationRatio: 0.30, tensionRange: [60, 90] },
      { number: 4, name: '第三幕', durationRatio: 0.20, tensionRange: [90, 100] }
    ]
  },
  'hero-journey': {
    name: '英雄之旅',
    acts: [
      { number: 1, name: '平凡世界', durationRatio: 0.15, tensionRange: [0, 20] },
      { number: 2, name: '冒险召唤', durationRatio: 0.20, tensionRange: [20, 50] },
      { number: 3, name: '终极考验', durationRatio: 0.35, tensionRange: [50, 90] },
      { number: 4, name: '归来', durationRatio: 0.30, tensionRange: [90, 100] }
    ]
  },
  'five-act': {
    name: '五幕结构（含独立高潮）',
    acts: [
      { number: 1, name: '起', durationRatio: 0.20, tensionRange: [0, 25] },
      { number: 2, name: '承', durationRatio: 0.25, tensionRange: [25, 50] },
      { number: 3, name: '转', durationRatio: 0.20, tensionRange: [50, 75] },
      { number: 4, name: '高潮', durationRatio: 0.20, tensionRange: [75, 95] },
      { number: 5, name: '合', durationRatio: 0.15, tensionRange: [95, 100] }
    ]
  },
};

const BEAT_TEMPLATES = {
  'action': [
    { name: '开场铺垫', duration: 15 },
    { name: '干扰事件', duration: 10 },
    { name: '冲突升级', duration: 10 },
    { name: '局势转折', duration: 15 },
    { name: '力量集结', duration: 15 },
    { name: '逼近核心', duration: 20 },
    { name: '终极考验', duration: 30 },
    { name: '收束结局', duration: 20 }
  ],
  'drama': [
    { name: '关系建立', duration: 20 },
    { name: '矛盾萌芽', duration: 20 },
    { name: '冲突爆发', duration: 30 },
    { name: '内心挣扎', duration: 20 },
    { name: '尝试修复', duration: 30 },
    { name: '抉择时刻', duration: 25 },
    { name: '和解或分离', duration: 20 }
  ],
  'educational': [
    { name: '问题引入', duration: 15 },
    { name: '背景铺垫', duration: 25 },
    { name: '核心知识', duration: 30 },
    { name: '实例分析', duration: 30 },
    { name: '实践演示', duration: 25 },
    { name: '总结回顾', duration: 15 }
  ]
};

// ===== v5.1-Peng: 非线性情绪节拍类型 =====
const NONLINEAR_BEAT_TYPES = {
  // 假高潮：观众以为高潮到了，然后急转直下
  falsePeak: {
    name: '假高潮',
    description: '让观众以为高潮到了，然后突然坠落',
    tensionDelta: +25,      // 先冲高
    tensionDrop: -35,       // 再急坠
    duration: 8,            // 持续时间（秒）
    shotCue: '极速推轨→画面定格→突然黑屏/切到反打',
    emotionalEffect: '期望落空→不安倍增',
    genreAffinity: { action: 0.8, drama: 0.6, horror: 0.9, suspense: 0.85 }
  },
  // 情绪回弹：紧张之后的情绪反弹
  emotionalRecoil: {
    name: '情绪回弹',
    description: '紧张之后的短暂释放，然后重新收紧',
    tensionDelta: -20,      // 先释放
    tensionRebound: +15,    // 再回弹
    duration: 10,
    shotCue: '从欢呼/放松慢推→面部凝固→重新紧张',
    emotionalEffect: '短暂慰藉→更深的恐惧',
    genreAffinity: { action: 0.7, drama: 0.9, horror: 0.8, suspense: 0.75 }
  },
  // 情感伪装：表面一种情绪，实际另一种
  emotionalMask: {
    name: '情感伪装',
    description: '角色表面微笑，内心死寂',
    tensionDelta: +10,      // 表层平静，深层暗流
    subtextTension: +30,    // 潜台词张力
    duration: 12,
    shotCue: '面部特写+眼神死寂→镜头缓缓揭示真相',
    emotionalEffect: '信任→怀疑→震惊',
    genreAffinity: { drama: 0.9, suspense: 0.9, horror: 0.7, action: 0.5 }
  },
  // 累积释放：多个小情绪累积后一次性爆发
  accumulativeRelease: {
    name: '累积释放',
    description: '前两次快速切，第三次长镜头不cut，情绪爆发',
    tensionDelta: +40,      // 累积后爆发
    duration: 15,
    shotCue: '前两次3秒快切→第三次10秒长镜头不切换→面部崩溃特写',
    emotionalEffect: '压抑→临界点→彻底崩溃',
    genreAffinity: { drama: 0.85, action: 0.6, horror: 0.7, suspense: 0.6 }
  },
  // 间离效果：让观众从沉浸中抽离思考
  alienationBeat: {
    name: '间离效果',
    description: '打破第四面墙或风格突变，让观众思考而非感受',
    tensionDelta: -15,      // 抽离降低张力
    cognitiveLoad: +40,     // 但增加认知负荷
    duration: 6,
    shotCue: '角色直视镜头/风格突变/黑白定格',
    emotionalEffect: '沉浸→反思→重新进入',
    genreAffinity: { drama: 0.8, horror: 0.6, suspense: 0.7, action: 0.3 }
  },
  // 静默冲击：声音真空后爆发
  silenceShock: {
    name: '静默冲击',
    description: '先完全静音2-3秒，再出现剧烈声响/画面',
    tensionDelta: +30,
    duration: 5,
    shotCue: '画面正常但静音→持续2秒→突然巨响/闪光',
    emotionalEffect: '不安→耳膜压力→惊吓反射',
    genreAffinity: { horror: 0.95, suspense: 0.9, action: 0.7, drama: 0.4 }
  },
  // 加速坠落：剪辑速度加倍
  accelerationFall: {
    name: '加速坠落',
    description: '剪辑间隔从2秒→1秒→0.5秒→硬切',
    tensionDelta: +25,
    duration: 10,
    shotCue: '剪辑速度逐渐加倍，手持晃动增加',
    emotionalEffect: '肾上腺素飙升→无法逃避',
    genreAffinity: { action: 0.9, horror: 0.8, suspense: 0.85, drama: 0.4 }
  }
};

// 为每种类型/风格定义非线性节拍注入策略
const NONLINEAR_STRATEGIES = {
  action: ['falsePeak', 'silenceShock', 'accelerationFall', 'emotionalRecoil'],
  drama: ['emotionalMask', 'accumulativeRelease', 'emotionalRecoil', 'alienationBeat'],
  horror: ['silenceShock', 'falsePeak', 'emotionalRecoil', 'accelerationFall'],
  suspense: ['emotionalMask', 'falsePeak', 'silenceShock', 'accelerationFall'],
  educational: ['alienationBeat', 'accumulativeRelease'],
  commercial: ['falsePeak', 'accelerationFall']
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const structure = buildStructure(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'structure-engine',
    output: structure
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Structure Engine: ${structure.structureType}结构完成`);
}

function buildStructure(input) {
  const world = input.world || {};
  const theme = input.theme || {};
  const duration = input.duration || 180;
  const videoType = input.videoType || 'action';
  const preference = input.structurePreference || 'three-act';
  const seriesConfig = input.seriesConfig || null;
  
  const template = STRUCTURE_TEMPLATES[preference] || STRUCTURE_TEMPLATES['three-act'];
  const beats = BEAT_TEMPLATES[videoType] || BEAT_TEMPLATES['action'];
  
  // 生成幕结构
  const acts = template.acts.map(act => ({
    actNumber: act.number,
    actName: act.name,
    purpose: generateActPurpose(act.number, videoType),
    durationRatio: act.durationRatio,
    duration: Math.round(duration * act.durationRatio),
    tensionRange: act.tensionRange,
    keyBeats: assignBeatsToAct(act, beats, duration),
    emotionalGoal: generateEmotionalGoal(act.number, videoType),
    turningPoint: generateTurningPoint(act.number),
    isPaywall: seriesConfig ? isPaywallAct(act.number, seriesConfig) : false
  }));
  
  return {
    structureType: template.name,
    acts,
    overallArc: {
      setup: acts[0]?.purpose || '铺垫',
      confrontation: acts[1]?.purpose || '对抗',
      resolution: acts[acts.length - 1]?.purpose || '收束'
    },
    pacingStrategy: generatePacingStrategy(videoType, duration),
    audienceEmotionalJourney: generateEmotionalJourney(acts),
    tensionCurve: generateTensionCurve(acts, duration, videoType),
    metadata: {
      videoType,
      duration,
      structurePreference: preference,
      seriesMode: !!seriesConfig,
      nonlinearEngineVersion: 'v5.1-Peng'
    }
  };
}

function generateActPurpose(actNumber, videoType) {
  // v4.2-Peng-fix: 使用通用描述，不硬编码具体场景名
  const purposes = {
    1: '铺垫与引入',
    2: '冲突升级',
    3: '高潮与解决',
    4: '收束与新平衡'
  };
  return purposes[actNumber] || '推进情节';
}

function assignBeatsToAct(act, allBeats, totalDuration) {
  const actBeats = allBeats.filter((_, i) => {
    const beatPosition = i / allBeats.length;
    return beatPosition >= (act.number - 1) / 4 && beatPosition < act.number / 4;
  });
  
  return actBeats.map(beat => ({
    beatName: beat.name,
    description: beat.description || beat.name,
    estimatedDuration: beat.duration || 15,
    isKeyMoment: beat.name.includes('终极') || beat.name.includes('高潮')
  }));
}

function generateEmotionalGoal(actNumber, videoType) {
  const goals = {
    1: videoType === 'action' ? '好奇+期待' : '温暖+共情',
    2: videoType === 'action' ? '紧张+兴奋' : '焦虑+牵挂',
    3: videoType === 'action' ? '高潮+释放' : '感动+释然',
    4: '满足+回味'
  };
  return goals[actNumber] || '推进';
}

function generateTurningPoint(actNumber) {
  const points = {
    1: '从日常到异常的转折',
    2: '从中点到危机的转折',
    3: '从低谷到高潮的转折',
    4: '从高潮到新平衡的转折'
  };
  return points[actNumber] || '情节推进';
}

function isPaywallAct(actNumber, seriesConfig) {
  const paywallPositions = seriesConfig.paywallPositions || [10, 28, 58];
  // 简化的卡点判断
  return actNumber === 2 || actNumber === 3;
}

function generatePacingStrategy(videoType, duration) {
  const strategies = {
    'action': '快节奏：每15秒一个情节点',
    'drama': '慢节奏：每30秒一个情感转折',
    'educational': '匀速：知识递进 + 小结',
    'commercial': '快节奏：前3秒钩子 + 快速展示',
    'documentary': '变速：叙事段落 + 信息段落'
  };
  return strategies[videoType] || '标准节奏';
}

function generateEmotionalJourney(acts) {
  return acts.map(act => ({
    act: act.actNumber,
    startEmotion: act.emotionalGoal,
    endEmotion: act.emotionalGoal,
    keyTransition: act.turningPoint
  }));
}

function generateTensionCurve(acts, duration, videoType = 'action') {
  const curve = [];
  const points = 20; // 20个张力采样点
  
  // v5.1-Peng: 注入非线性情绪节拍
  const nonlinearBeats = injectNonlinearBeats(acts, duration, videoType);
  
  for (let i = 0; i <= points; i++) {
    const time = (i / points) * duration;
    const actIndex = Math.min(Math.floor((i / points) * acts.length), acts.length - 1);
    const act = acts[actIndex];
    const tensionRange = act.tensionRange;
    const progress = (i / points) * acts.length - actIndex;
    let tension = tensionRange[0] + (tensionRange[1] - tensionRange[0]) * progress;
    
    // v5.1-Peng: 应用非线性节拍修正
    for (const beat of nonlinearBeats) {
      const halfDuration = beat.duration / 2;
      const dist = time - beat.time;
      
      // 只处理在 beat 影响范围内的点
      if (Math.abs(dist) > halfDuration) continue;
      
      // 计算 phase: -1 (开始) -> 0 (中心) -> +1 (结束)
      const phase = dist / halfDuration;
      
      // 余弦包络：中心最强，边缘衰减到0
      const envelope = 0.5 + 0.5 * Math.cos(phase * Math.PI);
      
      switch (beat.type) {
        case 'falsePeak': {
          // 假高潮：前半段冲高(+30)，后半段急坠(-40)
          const delta = phase < 0 ? 30 : -40;
          tension += delta * envelope;
          break;
        }
        case 'emotionalRecoil': {
          // 回弹：前半段释放(-20)，后半段回弹(+20)
          const delta = phase < 0 ? -20 : 20;
          tension += delta * envelope;
          break;
        }
        case 'emotionalMask': {
          // 伪装：表面小幅上升(+10)，但潜台词张力暗流
          tension += 12 * envelope;
          break;
        }
        case 'accumulativeRelease': {
          // 累积：S曲线爆发，前半段缓慢爬升，后半段快速爆发
          const sigmoid = phase < 0 
            ? (0.5 + phase / 2) * 0.3  // 前半段：30%强度
            : (0.5 + phase / 2) * 1.0; // 后半段：100%强度
          tension += 35 * sigmoid * envelope;
          break;
        }
        case 'alienationBeat': {
          // 间离：短暂抽离(-15)
          tension += -15 * envelope;
          break;
        }
        case 'silenceShock': {
          // 静默冲击：前半段蓄力(-5)，后半段爆发(+35)
          const delta = phase < 0 ? -5 : 35;
          tension += delta * envelope;
          break;
        }
        case 'accelerationFall': {
          // 加速坠落：线性爬升
          const intensity = 0.3 + 0.7 * (phase + 1) / 2; // 0.3 -> 1.0
          tension += 30 * intensity * envelope;
          break;
        }
      }
    }
    
    // 钳制在合理范围
    tension = Math.max(0, Math.min(100, Math.round(tension)));
    
    // 查找是否有非线性节拍标记
    const activeBeat = nonlinearBeats.find(b => Math.abs(time - b.time) <= b.duration / 2);
    
    curve.push({
      time: Math.round(time),
      tension,
      act: act.actNumber,
      nonlinearBeat: activeBeat ? { type: activeBeat.type, name: activeBeat.name } : null
    });
  }
  
  return { curve, nonlinearBeats };
}

// v5.1-Peng: 非线性节拍注入器
function injectNonlinearBeats(acts, duration, videoType) {
  const strategies = NONLINEAR_STRATEGIES[videoType] || NONLINEAR_STRATEGIES.action;
  const beats = [];
  
  // 根据视频类型选择合适的节拍类型
  const availableBeats = strategies.map(type => ({
    type,
    config: NONLINEAR_BEAT_TYPES[type],
    affinity: NONLINEAR_BEAT_TYPES[type].genreAffinity[videoType] || 0.5
  })).filter(b => b.affinity > 0.4);
  
  if (availableBeats.length === 0) return beats;
  
  // 在第二幕（承/冲突）和第三幕（转/高潮）交界处注入非线性节拍
  const injectionZones = [
    { start: duration * 0.25, end: duration * 0.45, label: '承→转过渡期' },
    { start: duration * 0.50, end: duration * 0.70, label: '转幕核心段' },
    { start: duration * 0.75, end: duration * 0.90, label: '高潮前夜' }
  ];
  
  for (const zone of injectionZones) {
    // 每个区域最多注入1个非线性节拍
    if (Math.random() < 0.8) { // 80%概率注入
      const beatType = availableBeats[Math.floor(Math.random() * availableBeats.length)];
      const time = zone.start + (zone.end - zone.start) * (0.3 + Math.random() * 0.4);
      
      beats.push({
        type: beatType.type,
        config: beatType.config,
        time: Math.round(time),
        duration: Math.round(duration * 0.08), // 影响范围：总时长的8%（约14秒@180秒）
        zone: zone.label,
        affinity: beatType.affinity,
        name: beatType.config.name // 直接存储name方便访问
      });
    }
  }
  
  // 按时间排序
  beats.sort((a, b) => a.time - b.time);
  
  // 确保节拍之间不重叠（至少间隔8秒）
  const filtered = [];
  for (const beat of beats) {
    if (filtered.length === 0 || beat.time - filtered[filtered.length - 1].time >= 10) {
      filtered.push(beat);
    }
  }
  
  return filtered;
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