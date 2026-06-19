'use strict';

/**
 * 全局字段标准化器 v1.0
 * 适配超现实系统四层架构
 * 
 * 设计原则：
 * 1. 兼容中英文字段并存（不强制全中文，保持与下游API兼容性）
 * 2. 统一字段真相源，消除多模块重复组装
 * 3. 自动归一化历史遗留字段名
 * 4. 关键字段强制保留
 */

const FIELD_ALIAS_MAP = {
  // 基础标识
  id: 'shotId',
  shotId: 'shotId',
  镜头编号: 'shotId',
  type: 'sceneType',
  shotType: 'sceneType',
  sceneType: 'sceneType',
  镜头类型: 'sceneType',
  duration: 'duration',
  镜头时长: 'duration',
  timing: 'timing',
  时序: 'timing',
  
  // 场景
  scene: 'scene',
  sceneName: 'scene',
  场景名称: 'scene',
  sceneDescription: 'sceneDescription',
  场景描述: 'sceneDescription',
  
  // Prompt
  prompt: 'prompt',
  visualPrompt: 'prompt',
  renderPrompt: 'prompt',
  视觉提示词: 'prompt',
  
  // 台词
  narration: 'dialogue',
  dialogue: 'dialogue',
  line: 'dialogue',
  lines: 'dialogue',
  beastLines: 'dialogue',
  台词: 'dialogue',
  
  // 口型
  mouthAction: 'mouthAction',
  mouth_action: 'mouthAction',
  口型动作: 'mouthAction',
  
  // 运镜/时间轴
  cameraMovement: 'cameraMovement',
  运镜设计: 'cameraMovement',
  timeline: 'timeline',
  _timeline: 'timeline',
  镜头时间轴: 'timeline',
  
  // 角色/定妆照
  characters: 'characters',
  角色列表: 'characters',
  portraits: 'portraits',
  referenceImages: 'portraits',
  绑定定妆照: 'portraits',
  
  // 人物卡片
  characterCards: 'characterCards',
  peopleCards: 'characterCards',
  人物介绍卡片: 'characterCards',
  
  // 片头
  title: 'title',
  mainTitle: 'title',
  主标题: 'title',
  subTitle: 'subtitle',
  subtitle: 'subtitle',
  副标题: 'subtitle',
  producer: 'producer',
  出品信息: 'producer',
  beastVoice: 'beastVoice',
  神兽开场白: 'beastVoice',
  openingHook: 'openingHook',
  片头钩子文案: 'openingHook',
  
  // 情绪/质量
  emotionPhase: 'emotionPhase',
  情绪阶段: 'emotionPhase',
  qualityScore: 'qualityScore',
  质量评分: 'qualityScore',
  
  // 降级标记
  degraded: 'degraded',
  降级标记: 'degraded',
  degradeReason: 'degradeReason',
  降级原因: 'degradeReason',
  
  // 其他
  mood: 'mood',
  情绪: 'mood',
  action: 'action',
  动作: 'action',
  character: 'character',
  角色: 'character',
  characterRef: 'characterRef',
  角色引用: 'characterRef',
  lighting: 'lighting',
  灯光: 'lighting',
  camera: 'camera',
  镜头: 'camera',
  
  // 超现实系统特有
  sceneFunction: 'sceneFunction',
  场景功能: 'sceneFunction',
  emotionalTarget: 'emotionalTarget',
  情绪目标: 'emotionalTarget',
  visualDirection: 'visualDirection',
  视觉方向: 'visualDirection',
  worldId: 'worldId',
  世界ID: 'worldId',
  
  // 后期字段
  backgroundSound: 'backgroundSound',
  背景音效: 'backgroundSound',
  audioLayer: 'audioLayer',
  音频层: 'audioLayer',
  titleOverlay: 'titleOverlay',
  标题叠加: 'titleOverlay',
  
  // 约束
  negativeConstraints: 'negativeConstraints',
  负面约束: 'negativeConstraints',
  styleConstraints: 'styleConstraints',
  风格约束: 'styleConstraints'
};

const CRITICAL_FIELDS = {
  common: ['shotId', 'sceneType', 'prompt', 'dialogue', 'timeline', 'characterRef'],
  opening: ['title', 'subtitle'],
  content: ['scene']
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj ?? {}));
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeDialogue(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') {
        return { speaker: '', text: item };
      }
      if (item && typeof item === 'object') {
        return {
          speaker: item.speaker || item.说话人 || item.role || '',
          text: item.text || item.内容 || item.line || item.text || ''
        };
      }
      return { speaker: '', text: String(item || '') };
    });
  }
  if (typeof value === 'string') {
    return [{ speaker: '', text: value }];
  }
  return [];
}

function normalizeTimeline(value, raw = {}) {
  if (Array.isArray(value)) return value;
  // v6.37+: 支持对象格式（如 {object, string}）转数组
  if (value && typeof value === 'object' && !Array.isArray(value)) return [value];
  if (Array.isArray(raw._timeline)) return raw._timeline;
  if (Array.isArray(raw.timeline)) return raw.timeline;
  if (Array.isArray(raw.cameraMovement?.timeline)) return raw.cameraMovement.timeline;
  return [];
}

function normalizePortraits(value, raw = {}) {
  const result = [];
  if (Array.isArray(value)) result.push(...value);
  if (Array.isArray(raw.referenceImages)) result.push(...raw.referenceImages);
  if (Array.isArray(raw.portraits)) result.push(...raw.portraits);
  if (raw.generatedAssets?.portraits) {
    const gp = raw.generatedAssets.portraits;
    if (Array.isArray(gp)) {
      result.push(...gp);
    } else if (typeof gp === 'object') {
      Object.entries(gp).forEach(([angle, path]) => {
        result.push({ character: raw.id || raw.name || '', angle, path });
      });
    }
  }
  return result;
}

function createEmptyShot() {
  return {
    shotId: '',
    sceneType: 'establishing',
    duration: 0,
    timing: { start: 0, duration: 0, end: 0 },
    scene: '',
    sceneDescription: '',
    prompt: '',
    dialogue: [],
    mouthAction: '',
    cameraMovement: {},
    timeline: [],
    characters: [],
    portraits: [],  // v6.37-deprecated: 保留兼容但不再使用
    characterCards: [],  // v6.37-deprecated: 保留兼容但不再使用
    mood: '',
    action: '',
    character: '',
    characterRef: '',
    lighting: null,
    camera: null,
    emotionPhase: '',
    qualityScore: null,
    degraded: false,
    degradeReason: '',
    worldId: 'default',
    negativeConstraints: [],
    styleConstraints: [],
    // 超现实系统特有
    sceneFunction: '',
    emotionalTarget: { valence: 0, arousal: 0.5 },
    visualDirection: {},
    backgroundSound: null,
    audioLayer: null,
    titleOverlay: null,
    // 片头字段
    title: '',
    subtitle: '',
    producer: '',
    beastVoice: '',
    openingHook: ''
  };
}

function inferShotType(raw = {}) {
  const id = raw.id || raw.shotId || '';
  const type = raw.type || raw.sceneType || raw.shotType || '';
  if (type === 'opening' || type === '片头') return 'opening';
  if (/^S00($|-|_)/.test(id) || raw.mainTitle || raw.title) return 'opening';
  return 'content';
}

function standardizeShot(rawInput = {}) {
  const raw = deepClone(rawInput);
  const shotType = inferShotType(raw);
  const standard = createEmptyShot();

  // 映射所有字段
  for (const [originalField, value] of Object.entries(raw)) {
    const targetField = FIELD_ALIAS_MAP[originalField] || originalField;
    if (targetField in standard) {
      standard[targetField] = value;
    }
  }

  // 强制填充关键字段
  standard.shotId = standard.shotId || raw.id || raw.shotId || '';
  standard.sceneType = shotType === 'opening' ? 'opening' : (standard.sceneType || 'establishing');
  standard.duration = standard.duration || raw.duration || raw.shotDuration || (raw.timing?.duration) || 0;
  standard.timing = standard.timing || raw.timing || { start: 0, duration: standard.duration, end: standard.duration };
  standard.scene = standard.scene || raw.scene || raw.sceneName || '';
  standard.sceneDescription = standard.sceneDescription || raw.sceneDescription || raw.setting || '';
  standard.prompt = standard.prompt || raw.visualPrompt || raw.prompt || raw.renderPrompt || '';
  standard.dialogue = normalizeDialogue(standard.dialogue || raw.dialogue || raw.narration || raw.line || raw.lines);
  standard.timeline = normalizeTimeline(standard.timeline, raw);
  standard.portraits = normalizePortraits(standard.portraits, raw);
  standard.characterCards = toArray(standard.characterCards || raw.characterCards || raw.peopleCards);
  standard.characters = toArray(standard.characters || raw.characters);
  standard.mouthAction = standard.mouthAction || raw.mouthAction || raw.mouth_action || '';
  standard.cameraMovement = standard.cameraMovement || raw.cameraMovement || {};
  standard.degraded = Boolean(standard.degraded || raw.degraded);
  standard.degradeReason = standard.degradeReason || raw.degradeReason || '';
  standard.emotionPhase = standard.emotionPhase || raw.emotionPhase || '';
  
  // 片头字段
  if (shotType === 'opening') {
    standard.title = standard.title || raw.mainTitle || raw.title || '';
    standard.subtitle = standard.subtitle || raw.subTitle || raw.subtitle || '';
    standard.producer = standard.producer || raw.producer || '';
    standard.beastVoice = standard.beastVoice || raw.beastVoice || '';
    standard.openingHook = standard.openingHook || raw.openingHook || '';
  }

  return standard;
}

function standardizeShots(shots = []) {
  return shots.map(standardizeShot);
}

function validateShot(shot) {
  const errors = [];
  const warnings = [];
  const isOpening = shot.sceneType === 'opening';

  for (const key of CRITICAL_FIELDS.common) {
    if (!(key in shot)) {
      errors.push(`Missing critical field: ${key}`);
      continue;
    }
    if (Array.isArray(shot[key]) && shot[key].length === 0) {
      warnings.push(`Empty critical array: ${key}`);
    }
    if (typeof shot[key] === 'string' && shot[key].trim() === '') {
      warnings.push(`Empty critical string: ${key}`);
    }
  }

  if (isOpening) {
    for (const key of CRITICAL_FIELDS.opening) {
      if (!shot[key] || String(shot[key]).trim() === '') {
        errors.push(`Opening shot missing: ${key}`);
      }
    }
  } else {
    for (const key of CRITICAL_FIELDS.content) {
      if (!shot[key] || String(shot[key]).trim() === '') {
        errors.push(`Content shot missing: ${key}`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

function validateShots(shots = []) {
  const details = shots.map(validateShot);
  return {
    passed: details.every(d => d.passed),
    errors: details.flatMap(d => d.errors),
    warnings: details.flatMap(d => d.warnings),
    details
  };
}

function markDegraded(shot, reason) {
  if (!shot || typeof shot !== 'object') return shot;
  shot.degraded = true;
  shot.degradeReason = reason || 'Unknown degradation';
  return shot;
}

function markDegradedArray(shots, reason) {
  return shots.map(shot => markDegraded(shot, reason));
}

module.exports = {
  FIELD_ALIAS_MAP,
  CRITICAL_FIELDS,
  standardizeShot,
  standardizeShots,
  validateShot,
  validateShots,
  markDegraded,
  markDegradedArray,
  inferShotType,
  createEmptyShot
};
