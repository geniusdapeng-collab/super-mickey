/**
 * Camera Movement System v3.0 — 单镜头内部时间轴升级
 * 运镜控制系统：单镜头多段式时间轴 + 景别切换 + 灯光变化 + 转场效果
 * 
 * v3.0升级内容：
 * - 单镜头内部切分3-5个时间段，每个段独立运镜+景别+灯光
 * - 景别切换策略：extreme_wide→medium→close_up 渐进式揭示
 * - 灯光效果变化：色温/强度/方向随时间轴变化
 * - 转场效果：段与段之间的过渡方式（硬切/渐变/匹配/遮挡）
 * - 节奏强化：速度曲线变化（慢→快→慢，或快→慢→快）
 * - 向后兼容v1/v2 API
 * 
 * 版本: v3.0
 * 日期: 2026-05-24
 */

const { CameraMovementSystem, NirathCinematographyAgent, MOVEMENT_LIBRARY, SPEED_MODIFIERS } = require('./camera-movement-system-v2.js');

// ========== 景别切换策略库 ==========
const SHOT_SIZE_TRANSITIONS = {
  // 渐进式揭示（建立→发现→亲密）
  progressive_reveal: {
    name: '渐进式揭示',
    description: '从远景逐步推到特写，建立环境→发现主体→情感亲密',
    sequence: ['extreme_wide', 'wide', 'medium', 'close_up'],
    timing: [0.2, 0.3, 0.3, 0.2], // 各段时长占比
    emotion: 'establishing → rising → climax',
    useCase: '开场镜头、角色登场、环境揭示'
  },
  
  // 震撼式冲击（特写→全景→再特写）
  impact_shock: {
    name: '震撼式冲击',
    description: '从特写突然拉到全景展现规模，再推回特写强化情感',
    sequence: ['close_up', 'extreme_wide', 'extreme_close'],
    timing: [0.15, 0.5, 0.35],
    emotion: 'shocking → epic → intimate',
    useCase: ' reveal、发现、震惊时刻'
  },
  
  // 环绕式探索（中景→环绕→特写）
  orbit_explore: {
    name: '环绕式探索',
    description: '从中景开始环绕主体运动，最后锁定特写',
    sequence: ['medium', 'full', 'medium', 'close_up'],
    timing: [0.2, 0.3, 0.2, 0.3],
    emotion: 'curious → discovering → focused',
    useCase: '探索、发现、互动场景'
  },
  
  // 对话式切换（双人中景→说话者特写→倾听者反应→双人）
  dialogue_dance: {
    name: '对话式切换',
    description: '在说话者和倾听者之间切换，最后回到双人同框',
    sequence: ['medium', 'close_up', 'close_up', 'medium'],
    timing: [0.2, 0.3, 0.3, 0.2],
    emotion: 'neutral → speaker → listener → together',
    useCase: '对话场景、互动场景'
  },
  
  // 追逐式动态（远景→运动跟拍→中景→特写）
  chase_dynamic: {
    name: '追逐式动态',
    description: '从远景建立运动方向，跟拍主体，最后锁定主体表情',
    sequence: ['wide', 'full', 'medium', 'close_up'],
    timing: [0.15, 0.35, 0.3, 0.2],
    emotion: 'tense → fast → focused → emotional',
    useCase: '追逐、战斗、运动场景'
  },
  
  // 诗意式游走（特写细节→中景环境→全景意境→特写眼神）
  poetic_wander: {
    name: '诗意式游走',
    description: '在细节、环境和意境之间诗意切换',
    sequence: ['extreme_close', 'medium', 'extreme_wide', 'close_up'],
    timing: [0.2, 0.25, 0.35, 0.2],
    emotion: 'intimate → calm → epic → soul',
    useCase: '抒情、回忆、意境场景'
  },
  
  // 悬疑式窥视（遮挡物→缝隙→主体→环境）
  suspense_peek: {
    name: '悬疑式窥视',
    description: '从遮挡物开始，透过缝隙窥视，揭示主体，最后展现环境',
    sequence: ['close_up', 'medium', 'full', 'wide'],
    timing: [0.2, 0.3, 0.25, 0.25],
    emotion: 'mysterious → revealing → understanding',
    useCase: '悬疑、发现、侦查场景'
  }
};

// ========== 灯光变化策略库 ==========
const LIGHTING_TRANSITIONS = {
  // 晨曦渐亮（暗→微光→明亮→ golden hour）
  dawn_break: {
    name: '晨曦渐亮',
    description: '从黑暗中逐渐亮起，模拟日出效果',
    stages: [
      { intensity: 0.1, colorTemp: 2000, direction: 'low_back', effect: '仅轮廓可见' },
      { intensity: 0.3, colorTemp: 2800, direction: 'side', effect: '侧光渐强' },
      { intensity: 0.6, colorTemp: 4500, direction: '45_degree', effect: '主体清晰' },
      { intensity: 1.0, colorTemp: 5600, direction: 'front_top', effect: '全面照亮' }
    ],
    emotion: 'hope → awakening → clarity',
    useCase: '开场、希望、觉醒'
  },
  
  // 戏剧聚光（环境光→聚光灯→全暗→再聚焦）
  spotlight_drama: {
    name: '戏剧聚光',
    description: '环境光突然聚焦到主体，营造戏剧性',
    stages: [
      { intensity: 0.4, colorTemp: 4000, direction: 'ambient', effect: '均匀环境光' },
      { intensity: 0.8, colorTemp: 3200, direction: 'spot', effect: '主体被聚光灯照亮' },
      { intensity: 0.2, colorTemp: 2500, direction: 'spot', effect: '周围变暗仅主体可见' },
      { intensity: 1.0, colorTemp: 3000, direction: 'rim', effect: '轮廓光强化' }
    ],
    emotion: 'normal → focus → isolation → highlight',
    useCase: '揭示、关键瞬间、角色登场'
  },
  
  // 能量爆发（常态→微光→强光→余波）
  energy_burst: {
    name: '能量爆发',
    description: '模拟能量从积聚到爆发再到消散的光照变化',
    stages: [
      { intensity: 0.5, colorTemp: 4500, direction: 'front', effect: '正常光照' },
      { intensity: 0.6, colorTemp: 5500, direction: 'front', effect: '微微发亮' },
      { intensity: 1.5, colorTemp: 8000, direction: 'omni', effect: '强光爆发，色温升高' },
      { intensity: 0.7, colorTemp: 4000, direction: 'diffuse', effect: '余波散射' }
    ],
    emotion: 'calm → building → explosive → aftermath',
    useCase: '能量释放、战斗、觉醒'
  },
  
  // 情绪冷暖（暖→冷→暖）
  emotion_temperature: {
    name: '情绪冷暖',
    description: '色温冷暖变化映射情绪变化',
    stages: [
      { intensity: 0.7, colorTemp: 3200, direction: 'warm_front', effect: '暖色温馨' },
      { intensity: 0.5, colorTemp: 7000, direction: 'cool_side', effect: '冷色疏离' },
      { intensity: 0.8, colorTemp: 2800, direction: 'warm_rim', effect: '回归温暖' },
      { intensity: 0.6, colorTemp: 4500, direction: 'neutral', effect: '平衡色调' }
    ],
    emotion: 'warm → cold → warm → neutral',
    useCase: '情感变化、回忆、冲突'
  },
  
  // 探索式手电（暗→手电光→发现→环境光）
  flashlight_explore: {
    name: '探索式手电',
    description: '模拟手电/光源在黑暗中探索的效果',
    stages: [
      { intensity: 0.05, colorTemp: 2000, direction: 'none', effect: '几乎全黑' },
      { intensity: 0.4, colorTemp: 4500, direction: 'flashlight_beam', effect: '手电光束扫过' },
      { intensity: 0.7, colorTemp: 5000, direction: 'flashlight_beam', effect: '光束锁定发现物' },
      { intensity: 0.8, colorTemp: 4500, direction: 'ambient', effect: '环境光渐亮' }
    ],
    emotion: 'fear → curiosity → discovery → understanding',
    useCase: '探索、洞穴、未知场景'
  }
};

// ========== 转场效果库 ==========
const TRANSITION_EFFECTS = {
  hard_cut: {
    name: '硬切',
    description: '瞬间切换，无过渡',
    duration: 0,
    useCase: '冲击、惊讶、节奏快'
  },
  smooth_dissolve: {
    name: '平滑渐变',
    description: '0.5-1秒平滑过渡',
    duration: 0.8,
    useCase: '情绪过渡、回忆、柔和'
  },
  match_cut: {
    name: '匹配剪辑',
    description: '形状/动作/颜色匹配切换',
    duration: 0.3,
    useCase: '关联揭示、蒙太奇'
  },
  whip_pan: {
    name: '快速摇镜',
    description: '镜头快速摇动模糊后切到新画面',
    duration: 0.5,
    useCase: '速度感、追逐、紧张'
  },
  rack_focus: {
    name: '移焦过渡',
    description: '焦点从前景移到后景（或反之）实现切换',
    duration: 1.0,
    useCase: '发现、揭示、空间关系'
  },
  object_occlusion: {
    name: '物体遮挡',
    description: '物体经过镜头实现遮挡转场',
    duration: 0.6,
    useCase: '自然过渡、跟随'
  },
  light_flash: {
    name: '闪光转场',
    description: '强光闪白后切换',
    duration: 0.4,
    useCase: '能量、冲击、时间跳跃'
  },
  zoom_blur: {
    name: '缩放模糊',
    description: '快速缩放产生径向模糊后切换',
    duration: 0.5,
    useCase: '眩晕、冲击、心理'
  }
};

// ========== 速度曲线库 ==========
const SPEED_CURVES = {
  slow_fast_slow: {
    name: '慢快慢',
    description: '开始缓慢，中间加速，最后减速',
    curve: [0.3, 0.8, 1.0, 0.6, 0.2],
    emotion: 'establish → build → climax → settle',
    useCase: '通用节奏'
  },
  fast_slow_fast: {
    name: '快慢快',
    description: '开始快速，中间慢下来，最后冲刺',
    curve: [0.9, 0.5, 0.3, 0.7, 1.0],
    emotion: 'rush → reflect → final_push',
    useCase: '追逐、竞赛'
  },
  building: {
    name: '递进加速',
    description: '逐渐加速，无减速',
    curve: [0.2, 0.4, 0.6, 0.8, 1.0],
    emotion: 'building → building → peak',
    useCase: '追逐、紧张升级'
  },
  exploding: {
    name: '爆发式',
    description: '慢→突然爆发→余波',
    curve: [0.2, 0.3, 1.0, 0.5, 0.2],
    emotion: 'calm → BOOM → aftermath',
    useCase: '爆炸、能量释放'
  },
  breathing: {
    name: '呼吸式',
    description: '如呼吸般起伏',
    curve: [0.4, 0.7, 0.5, 0.8, 0.4],
    emotion: 'gentle → intense → gentle',
    useCase: '抒情、意境'
  }
};

// ========== 镜头内时间轴生成器（v3.0核心）==========
class IntraShotTimelineGenerator {
  constructor() {
    this.shotTransitions = SHOT_SIZE_TRANSITIONS;
    this.lightingTransitions = LIGHTING_TRANSITIONS;
    this.transitions = TRANSITION_EFFECTS;
    this.speedCurves = SPEED_CURVES;
  }
  
  /**
   * 生成单镜头内部时间轴
   * @param {Object} config - 配置
   * @param {string} config.transitionType - 景别切换类型
   * @param {string} config.lightingType - 灯光变化类型
   * @param {string} config.speedCurve - 速度曲线类型
   * @param {number} config.duration - 镜头总时长（秒）
   * @param {string} config.emotionPhase - 情绪阶段
   * @param {string} config.sceneName - 场景名称
   * @param {Array} config.movementSequence - 自定义运镜序列（可选）
   * @returns {Object} 完整时间轴
   */
  generateTimeline(config) {
    const {
      transitionType = 'progressive_reveal',
      lightingType = 'dawn_break',
      speedCurve = 'slow_fast_slow',
      duration = 8,
      emotionPhase = 'establishing',
      sceneName = '',
      movementSequence = null
    } = config;
    
    const transition = this.shotTransitions[transitionType];
    const lighting = this.lightingTransitions[lightingType];
    const curve = this.speedCurves[speedCurve];
    
    if (!transition || !lighting || !curve) {
      return { error: '无效的参数类型' };
    }
    
    // 计算各段时间
    const segmentCount = transition.sequence.length;
    const segmentTimings = this.calculateSegmentTimings(duration, transition.timing);
    
    // 生成各段
    const segments = [];
    let currentTime = 0;
    
    for (let i = 0; i < segmentCount; i++) {
      // v6.2-patch59: 粗粒度时间轴 — 使用相对阶段代替精确秒级
      const phaseLabels = ['早期', '中期', '后期', '尾声'];
      const timeRange = phaseLabels[i] || `阶段${i + 1}`;
      
      const segDuration = segmentTimings[i];
      const startTime = currentTime;
      const endTime = currentTime + segDuration;
      
      // 景别
      const shotSize = transition.sequence[i];
      
      // 灯光
      const lightingStage = lighting.stages[Math.min(i, lighting.stages.length - 1)];
      
      // 速度（从曲线获取）
      const speedValue = curve.curve[Math.min(i, curve.curve.length - 1)];
      const speedDesc = this.mapSpeedValue(speedValue);
      
      // 运镜动作
      const movement = movementSequence ? movementSequence[i] : this.selectMovementForSegment(sceneName, emotionPhase, i, segmentCount);
      
      // 转场效果（段与段之间）
      const transitionEffect = i < segmentCount - 1 ? 
        this.selectTransitionEffect(emotionPhase, i, segmentCount) : null;
      
      segments.push({
        index: i,
        timeRange: timeRange,  // v6.2-patch59: 粗粒度时间轴
        duration: segDuration,
        shotSize: shotSize,
        shotSizeDesc: this.getShotSizeDesc(shotSize),
        movement: movement,
        speed: {
          value: speedValue,
          description: speedDesc
        },
        lighting: lightingStage,
        transition: transitionEffect
      });
      
      currentTime = endTime;
    }
    
    return {
      totalDuration: duration,
      segmentCount,
      transitionName: transition.name,
      transitionDesc: transition.description,
      lightingName: lighting.name,
      lightingDesc: lighting.description,
      speedCurveName: curve.name,
      speedCurveDesc: curve.description,
      segments,
      summary: this.generateSummary(segments, transition, lighting, curve)
    };
  }
  
  /**
   * 计算各段时间
   */
  calculateSegmentTimings(totalDuration, timingRatios) {
    const totalRatio = timingRatios.reduce((a, b) => a + b, 0);
    return timingRatios.map(r => (r / totalRatio) * totalDuration);
  }
  
  /**
   * 映射速度值到描述
   */
  mapSpeedValue(value) {
    if (value < 0.2) return '极慢/静止';
    if (value < 0.4) return '缓慢';
    if (value < 0.6) return '中等';
    if (value < 0.8) return '快速';
    if (value < 0.95) return '很快';
    return '极限速度';
  }
  
  /**
   * 获取景别描述
   */
  getShotSizeDesc(shotSize) {
    const map = {
      extreme_wide: '极端远景（环境全貌）',
      wide: '远景（环境+主体）',
      full: '全景（全身）',
      medium: '中景（半身/双人）',
      close_up: '特写（面部/细节）',
      extreme_close: '极端特写（眼睛/纹理）'
    };
    return map[shotSize] || shotSize;
  }
  
  /**
   * 为每段选择运镜动作
   */
  selectMovementForSegment(sceneName, emotionPhase, segmentIndex, totalSegments) {
    // 默认运镜序列
    const defaultSequences = {
      establishing: ['orbit_360', 'push_in', 'push_in', 'hold'],
      rising: ['wide_shot', 'push_in', 'fast_push', 'hold'],
      climax: ['hold', 'fast_orbit', 'extreme_push', 'freeze'],
      resolve: ['medium_shot', 'pull_out', 'pull_out', 'wide_shot']
    };
    
    const sequence = defaultSequences[emotionPhase] || defaultSequences.establishing;
    return sequence[Math.min(segmentIndex, sequence.length - 1)];
  }
  
  /**
   * 选择转场效果
   */
  selectTransitionEffect(emotionPhase, segmentIndex, totalSegments) {
    // 根据情绪和位置选择
    if (emotionPhase === 'climax' && segmentIndex === Math.floor(totalSegments / 2)) {
      return 'light_flash'; // 高潮中间用闪光
    }
    
    if (segmentIndex === 0) {
      return 'smooth_dissolve'; // 第一段用平滑渐变
    }
    
    if (segmentIndex === totalSegments - 2) {
      return 'rack_focus'; // 倒数第二段用移焦
    }
    
    return 'hard_cut'; // 默认硬切
  }
  
  /**
   * 生成时间轴摘要（自然语言）
   */
  generateSummary(segments, transition, lighting, curve) {
    let summary = `【镜头时间轴 - ${transition.name}】\n`;
    summary += `策略：${transition.description}\n`;
    summary += `灯光：${lighting.name} - ${lighting.description}\n`;
    summary += `速度：${curve.name} - ${curve.description}\n\n`;
    
    for (const seg of segments) {
      summary += `${seg.timeRange}｜${seg.shotSizeDesc}｜${seg.speed.description}｜${seg.movement}`;
      if (seg.lighting) {
        summary += `｜灯光：${seg.lighting.effect}`;
      }
      if (seg.transition) {
        summary += `\n  → 转场：${this.transitions[seg.transition]?.name || seg.transition}`;
      }
      summary += '\n';
    }
    
    return summary;
  }
  
  /**
   * 生成Seedance Prompt段落（可直接插入Prompt）
   */
  generatePromptParagraph(timeline, options = {}) {
    const { includeTechnical = true, includeEmotion = true } = options;
    
    let prompt = `【运镜时间轴 - 一镜到底多段式】\n`;
    prompt += `本镜头共${timeline.segmentCount}段，总时长${timeline.totalDuration}秒。\n`;
    prompt += `景别切换策略：${timeline.transitionName}（${timeline.transitionDesc}）\n`;
    prompt += `灯光变化：${timeline.lightingName}（${timeline.lightingDesc}）\n`;
    prompt += `速度曲线：${timeline.speedCurveName}（${timeline.speedCurveDesc}）\n\n`;
    
    for (const seg of timeline.segments) {
      prompt += `${seg.timeRange}：\n`;
      prompt += `  景别：${seg.shotSizeDesc}\n`;
      prompt += `  运镜：${seg.movement}\n`;
      prompt += `  速度：${seg.speed.description}（强度${seg.speed.value}）\n`;
      
      if (includeTechnical && seg.lighting) {
        prompt += `  灯光：${seg.lighting.effect}，色温${seg.lighting.colorTemp}K，强度${seg.lighting.intensity}\n`;
      }
      
      if (seg.transition) {
        const trans = this.transitions[seg.transition];
        if (trans) {
          prompt += `  → 转场：${trans.name}（${trans.description}）\n`;
        }
      }
      
      prompt += '\n';
    }
    
    return prompt;
  }
}

// ========== v3.0 运镜控制系统 ==========
class CameraMovementSystemV3 extends CameraMovementSystem {
  constructor(config = {}) {
    super(config);
    this.timelineGenerator = new IntraShotTimelineGenerator();
  }
  
  /**
   * v3.0核心：生成带内部时间轴的运镜方案
   * @param {string} sceneName - 场景名称
   * @param {string} emotionPhase - 情绪阶段
   * @param {Object} options - 选项
   * @param {number} options.duration - 时长（秒）
   * @param {string} options.transitionType - 景别切换类型
   * @param {string} options.lightingType - 灯光变化类型
   * @param {string} options.speedCurve - 速度曲线类型
   * @returns {Object} 完整运镜方案（含内部时间轴）
   */
  generateIntraShotTimeline(sceneName, emotionPhase = 'establishing', options = {}) {
    const {
      duration = 8,
      transitionType,
      lightingType,
      speedCurve,
      ...otherOptions
    } = options;
    
    // 1. 先获取基础运镜（v2兼容）
    const baseMovement = this.generateNirathMovement(sceneName, emotionPhase, {
      ...otherOptions,
      duration
    });
    
    // 2. 智能选择参数
    const autoTransitionType = transitionType || this.selectTransitionType(emotionPhase);
    const autoLightingType = lightingType || this.selectLightingType(emotionPhase, sceneName);
    const autoSpeedCurve = speedCurve || this.selectSpeedCurve(emotionPhase);
    
    // 3. 生成内部时间轴
    const timeline = this.timelineGenerator.generateTimeline({
      transitionType: autoTransitionType,
      lightingType: autoLightingType,
      speedCurve: autoSpeedCurve,
      duration,
      emotionPhase,
      sceneName
    });
    
    // 4. 生成Prompt段落
    const promptParagraph = this.timelineGenerator.generatePromptParagraph(timeline);
    
    return {
      // 基础信息
      scene: sceneName,
      emotionPhase,
      duration,
      
      // v2兼容
      baseMovement,
      description: baseMovement.description,
      
      // v3新增：内部时间轴
      intraShotTimeline: timeline,
      intraShotPrompt: promptParagraph,
      
      // v6.5.62-P1: camera字段（12级机位+14运镜+焦距+速度）
      camera: this._buildCameraSpec(timeline, baseMovement),
      
      // v6.5.62-P1: lighting字段（主光方向+色温K值+特效光）
      lighting: this._buildLightingSpec(timeline),
      
      // 配置信息
      config: {
        transitionType: autoTransitionType,
        lightingType: autoLightingType,
        speedCurve: autoSpeedCurve
      }
    };
  }
  
  /**
   * 智能选择景别切换类型
   */
  selectTransitionType(emotionPhase) {
    const map = {
      establishing: 'progressive_reveal',
      rising: 'orbit_explore',
      building: 'dialogue_dance',
      climax: 'impact_shock',
      resolve: 'poetic_wander'
    };
    return map[emotionPhase] || 'progressive_reveal';
  }
  
  /**
   * 智能选择灯光变化类型
   */
  selectLightingType(emotionPhase, sceneName) {
    // 根据场景和情绪选择
    if (sceneName.includes('雷') || sceneName.includes('能量') || emotionPhase === 'climax') {
      return 'energy_burst';
    }
    if (sceneName.includes('暗') || sceneName.includes('冥') || sceneName.includes('洞')) {
      return 'flashlight_explore';
    }
    if (emotionPhase === 'establishing') {
      return 'dawn_break';
    }
    if (emotionPhase === 'climax') {
      return 'spotlight_drama';
    }
    if (emotionPhase === 'resolve') {
      return 'emotion_temperature';
    }
    return 'dawn_break';
  }
  
  /**
   * 智能选择速度曲线
   */
  selectSpeedCurve(emotionPhase) {
    const map = {
      establishing: 'slow_fast_slow',
      rising: 'building',
      building: 'breathing',
      climax: 'exploding',
      resolve: 'breathing'
    };
    return map[emotionPhase] || 'slow_fast_slow';
  }
  
  /**
   * 批量生成带时间轴的运镜
   */
  batchGenerateWithTimeline(sceneEmotionPairs, options = {}) {
    return sceneEmotionPairs.map(({ scene, emotion, duration = 8 }) => 
      this.generateIntraShotTimeline(scene, emotion, { ...options, duration })
    );
  }
  
  /**
   * 获取所有景别切换策略
   */
  getShotTransitions() {
    return Object.entries(SHOT_SIZE_TRANSITIONS).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      sequence: value.sequence,
      useCase: value.useCase
    }));
  }
  
  /**
   * 获取所有灯光变化策略
   */
  getLightingTransitions() {
    return Object.entries(LIGHTING_TRANSITIONS).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      stages: value.stages.length,
      useCase: value.useCase
    }));
  }
  
  /**
   * 获取所有速度曲线
   */
  getSpeedCurves() {
    return Object.entries(SPEED_CURVES).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      useCase: value.useCase
    }));
  }
  
  /**
   * v3.1升级：注入冒险感运镜（山海经系列）
   * 为故事板注入主动镜头、探索运镜、互动镜头、魔幻揭示
   * @param {Array} shots - 故事板镜头数组
   * @param {Object} options - 冒险运镜配置
   * @returns {Array} 增强后的shots
   */
  injectAdventureCinematography(shots, options = {}) {
    const { AdventureCinematographySystem } = require('./adventure-cinematography-system');
    const adventureSystem = new AdventureCinematographySystem({
      intensity: options.intensity || 0.7,
      protagonistId: options.protagonistId || 'xiaoG',
      beastId: options.beastId || null
    });
    
    return adventureSystem.enhanceShots(shots, {
      protagonistName: options.protagonistName || '小G',
      beastName: options.beastName,
      habitat: options.habitat,
      ability: options.ability,
      ...options
    });
  }

  /**
   * v3.1：为单镜头生成冒险感运镜（便捷方法）
   */
  generateAdventureCamera(shot, index, totalShots, options = {}) {
    const { AdventureCinematographySystem } = require('./adventure-cinematography-system');
    const adventureSystem = new AdventureCinematographySystem(options);
    return adventureSystem.generateAdventureCamera(shot, index, totalShots, options);
  }

  /**
   * 获取所有转场效果
   */
  getTransitionEffects() {
    return Object.entries(TRANSITION_EFFECTS).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      duration: value.duration,
      useCase: value.useCase
    }));
  }
  
  /**
   * v6.5.62-P1: 构建 camera 字段（12级机位+14运镜+焦距+速度）
   */
  _buildCameraSpec(timeline, baseMovement) {
    const segments = timeline.segments || [];
    if (segments.length === 0) return '';
    
    // 提取景别（shot size）
    const shotSizes = segments.map(s => s.shotSize).filter(Boolean);
    const primaryShotSize = shotSizes[0] || 'medium';
    
    // 提取运镜（movement）
    const movements = segments.map(s => s.movement).filter(Boolean);
    const primaryMovement = movements[0] || 'static';
    
    // 提取焦距（从baseMovement或默认）
    const focalLength = baseMovement.focalLength || '50mm';
    
    // 提取速度（从timeline或默认）
    const speed = timeline.speedCurve || 'normal';
    
    // 构建 camera 字符串
    return `${primaryShotSize} ${primaryMovement}, ${focalLength} lens, ${speed} speed`;
  }
  
  /**
   * v6.5.62-P1: 构建 lighting 字段（主光方向+色温K值+特效光）
   */
  _buildLightingSpec(timeline) {
    const segments = timeline.segments || [];
    if (segments.length === 0) return '';
    
    // 提取第一个段的光照信息
    const firstSegment = segments[0];
    const lighting = firstSegment.lighting || {};
    
    const direction = lighting.direction || 'front';
    const colorTemp = lighting.colorTemp || 5600;
    const effect = lighting.effect || '';
    
    // 构建 lighting 字符串
    let lightingStr = `${direction} key ${colorTemp}K`;
    if (effect) {
      lightingStr += `, ${effect}`;
    }
    
    return lightingStr;
  }
}

// ========== 导出 ==========
module.exports = {
  CameraMovementSystemV3,
  IntraShotTimelineGenerator,
  SHOT_SIZE_TRANSITIONS,
  LIGHTING_TRANSITIONS,
  TRANSITION_EFFECTS,
  SPEED_CURVES,
  // v2兼容导出
  CameraMovementSystem,
  NirathCinematographyAgent,
  MOVEMENT_LIBRARY,
  SPEED_MODIFIERS
};

// CLI测试
if (require.main === module) {
  const cms = new CameraMovementSystemV3();
  
  console.log('\n🎬 Camera Movement System v3.0 — 单镜头内部时间轴升级\n');
  
  // 测试各情绪阶段
  const testCases = [
    { scene: '青丘灵原', emotion: 'establishing', duration: 8 },
    { scene: '永夜裂谷', emotion: 'climax', duration: 10 },
    { scene: '汤谷扶桑', emotion: 'rising', duration: 7 }
  ];
  
  for (const test of testCases) {
    console.log(`\n=== ${test.scene} - ${test.emotion} ===`);
    const result = cms.generateIntraShotTimeline(test.scene, test.emotion, {
      duration: test.duration
    });
    
    console.log(`景别切换: ${result.config.transitionType}`);
    console.log(`灯光变化: ${result.config.lightingType}`);
    console.log(`速度曲线: ${result.config.speedCurve}`);
    console.log(`\n时间轴摘要:`);
    console.log(result.intraShotTimeline.summary);
    console.log(`\nPrompt段落（前200字）:`);
    console.log(result.intraShotPrompt.substring(0, 200) + '...');
  }
  
  console.log('\n✅ v3.0 单镜头内部时间轴升级测试完成\n');
}
