/**
 * 叙事约束引擎 + 高级画面指令系统 v1.0
 * 
 * 核心思想：
 * - 叙事元素 → 负面约束（避免连环画风格）
 * - 画面描述 → 电影级术语（cinematic vocabulary）
 * - 情感传达 → 光影/构图/材质（非文字叙事）
 * 
 * 版本: v1.0
 * 日期: 2026-05-19
 */

// ========== 叙事约束提取规则 ==========

/**
 * 叙事动词黑名单 — 这些动作描述容易生成故事插图
 * 应转为：光影变化、材质反应、环境反馈
 */
const NARRATIVE_VERBS = [
  'shooting', '射', 'killing', '杀', 'pushing', '推', 'pulling', '拉',
  'running', '跑', 'jumping', '跳', 'climbing', '爬', 'hiding', '躲',
  'screaming', '尖叫', 'crying', '哭', 'laughing', '笑',
  'fighting', '战斗', 'attacking', '攻击', 'defending', '防御',
  'chasing', '追逐', 'escaping', '逃跑', 'falling', '坠落'
];

/**
 * 叙事概念黑名单 — 这些概念会触发故事性生成
 * 应转为：视觉等效描述（光体、能量、形态）
 */
const NARRATIVE_CONCEPTS = [
  '后羿', 'houyi', '十日', 'ten suns', '射日', 'shooting sun',
  '英雄', 'hero', '神话', 'myth', '传说', 'legend',
  '战斗', 'battle', '战争', 'war', '敌人', 'enemy',
  '拯救', 'save', '毁灭', 'destroy', '死亡', 'death',
  '太阳车', 'sun chariot', '金乌', 'golden crow'
];

/**
 * 叙事形容词黑名单 — 这些词引导故事性解读
 * 应转为：光影/材质/色彩描述
 */
const NARRATIVE_ADJECTIVES = [
  '害怕的', 'scared', '勇敢的', 'brave', '愤怒的', 'angry',
  '悲伤的', 'sad', '快乐的', 'happy', '绝望的', 'desperate',
  '胜利的', 'victorious', '失败的', 'defeated',
  '伟大的', 'great', '邪恶的', 'evil', '善良的', 'kind'
];

// ========== 电影级画面指令库 ==========

const CINEMATIC_VOCABULARY = {
  // 摄影术语
  camera: {
    movement: [
      'tracking shot with smooth dolly motion',
      'whip pan with motion blur',
      'crane shot descending from above',
      'steadicam walk through environment',
      'aerial drone shot with slow push-in',
      'dolly zoom (Vertigo effect)',
      'handheld documentary style',
      'gimbal-stabilized glide'
    ],
    lens: [
      'anamorphic lens with oval bokeh',
      'macro lens with shallow depth of field',
      'wide-angle 24mm with distortion',
      'telephoto 85mm with compressed perspective',
      'f/1.4 aperture with creamy bokeh',
      'f/8 aperture with deep focus',
      'tilt-shift miniature effect'
    ],
    framing: [
      'extreme close-up (ECU) on iris',
      'close-up (CU) on facial feature',
      'medium shot (MS) with environment context',
      'wide shot (WS) with subject in lower third',
      'extreme wide shot (EWS) with vast landscape',
      'over-the-shoulder (OTS) shot',
      'Dutch angle with dynamic tension',
      'bird\'s eye view looking straight down'
    ]
  },
  
  // 光影质量术语
  lighting: {
    quality: [
      'High contrast',
      'Cinematic lighting',
      'Volumetric smoke/fog',
      'Sparks',
      'golden hour with long shadows',
      'blue hour with cool ambient',
      'magic hour with warm glow',
      'overcast with soft diffused light',
      'hard sunlight with sharp shadows',
      'volumetric god rays through particles',
      'practical light sources in frame',
      'bounced fill light on shadow side',
      'chiaroscuro dramatic light and shadow',
      'neon rim light on silhouette',
      'subsurface scattering on skin'
    ],
    direction: [
      'key light from upper left at 45°',
      'backlight with rim separation',
      'underlight with dramatic shadows',
      'top light with eye socket shadows',
      'side light with texture emphasis',
      'three-point lighting with fill ratio 2:1',
      'single source with deep shadows',
      'ambient only with no direction'
    ],
    color: [
      'warm tungsten 3200K',
      'cool daylight 5600K',
      'mixed color temperature',
      'monochromatic with single hue',
      'complementary color contrast',
      'analogous color harmony',
      'high saturation with vibrancy',
      'desaturated with muted tones'
    ]
  },
  
  // 构图术语
  composition: {
    rules: [
      'rule of thirds with subject on intersection',
      'golden ratio spiral leading to subject',
      'symmetrical balance with central subject',
      'asymmetrical balance with visual weight',
      'leading lines converging to focal point',
      'frame within frame using natural arch',
      'foreground interest with depth layers',
      'negative space with minimal subject'
    ],
    depth: [
      'shallow depth of field with creamy bokeh',
      'deep focus with everything sharp',
      'rack focus from foreground to background',
      'split diopter with two focal planes',
      'atmospheric perspective with haze layers',
      'foreground framing element out of focus',
      'middle ground subject in sharp focus',
      'background detail with soft blur'
    ]
  },
  
  // 材质与纹理
  texture: {
    surface: [
      'micro-detail with visible pores',
      'subsurface scattering on organic material',
      'metallic reflectivity with environment map',
      'translucency with light transmission',
      'roughness with micro-scratches',
      'wet surface with specular highlights',
      'dry surface with dust particles',
      'weathered with patina and age'
    ],
    material: [
      'crystal with caustic light patterns',
      'bioluminescent with self-illumination',
      'iridescent with color shift',
      'translucent with internal glow',
      'fibrous with visible weave pattern',
      'geological with stratification layers',
      'organic with cellular structure',
      'mineral with crystalline formation'
    ]
  },
  
  // 氛围
  atmosphere: {
    particles: [
      'volumetric fog with depth',
      'dust motes dancing in light beam',
      'spore particles floating in air',
      'pollen drifting on breeze',
      'ash falling from above',
      'steam rising from thermal vents',
      'mist rolling across ground',
      'haze with atmospheric perspective'
    ],
    weather: [
      'clear with sharp visibility',
      'overcast with diffused light',
      'stormy with dramatic clouds',
      'foggy with limited visibility',
      'rainy with wet surfaces',
      'snowy with soft blanket',
      'windy with motion blur',
      'calm with still water reflection'
    ]
  }
};

// ========== 约束生成引擎 ==========

class NarrativeConstraintEngine {
  constructor() {
    this.verbPatterns = NARRATIVE_VERBS;
    this.conceptPatterns = NARRATIVE_CONCEPTS;
    this.adjectivePatterns = NARRATIVE_ADJECTIVES;
  }
  
  /**
   * 从action中提取叙事约束
   * @param {string} action - 原始action描述
   * @returns {string[]} - 负面约束列表
   */
  extractConstraints(action) {
    const constraints = [];
    const actionLower = action.toLowerCase();
    
    // 检查叙事动词
    for (const verb of this.verbPatterns) {
      if (actionLower.includes(verb.toLowerCase())) {
        constraints.push(`no ${verb} action`);
      }
    }
    
    // 检查叙事概念
    for (const concept of this.conceptPatterns) {
      if (actionLower.includes(concept.toLowerCase())) {
        constraints.push(`no ${concept} depiction`);
      }
    }
    
    // 检查叙事形容词
    for (const adj of this.adjectivePatterns) {
      if (actionLower.includes(adj.toLowerCase())) {
        constraints.push(`no ${adj} emotional portrayal`);
      }
    }
    
    // 通用约束（避免连环画风格）
    constraints.push(
      'no narrative illustration',
      'no story telling',
      'no comic book style',
      'no sequential art',
      'no cartoon panel',
      'no text overlay',
      'no speech bubble',
      'no literal myth depiction',
      'no storyboard style',
      'no children book style',
      'no anime sequence',
      'no dramatic acting pose',
      'no theatrical gesture',
      'no exaggerated expression'
    );
    
    return [...new Set(constraints)];
  }
  
  /**
   * 生成增强版负面Prompt
   */
  buildEnhancedNegative(baseNegative, action) {
    const constraints = this.extractConstraints(action);
    return `${baseNegative}, ${constraints.join(', ')}`;
  }
}

// ========== 高级画面指令生成器 ==========

class CinematicInstructionBuilder {
  constructor() {
    this.vocab = CINEMATIC_VOCABULARY;
  }
  
  /**
   * 根据镜头类型选择画面指令
   */
  buildInstructions(shotType, emotion, sceneType) {
    const instructions = [];
    
    // 摄影指令
    if (shotType === 'close-up') {
      instructions.push(
        this.randomPick(this.vocab.camera.framing.slice(0, 2)),
        this.randomPick(this.vocab.camera.lens.slice(0, 2))
      );
    } else if (shotType === 'wide') {
      instructions.push(
        this.randomPick(this.vocab.camera.framing.slice(4, 6)),
        this.randomPick(this.vocab.composition.depth.slice(2, 4))
      );
    } else if (shotType === 'action') {
      instructions.push(
        this.randomPick(this.vocab.camera.movement.slice(0, 3)),
        this.randomPick(this.vocab.composition.rules.slice(2, 4))
      );
    }
    
    // 光影指令（基于情绪）
    const lightInstructions = this.getLightingForEmotion(emotion);
    instructions.push(...lightInstructions);
    
    // 材质指令
    if (sceneType === 'crystal' || sceneType === 'bioluminescent') {
      instructions.push(
        this.randomPick(this.vocab.texture.material.slice(0, 3))
      );
    }
    
    // 氛围指令
    instructions.push(
      this.randomPick(this.vocab.atmosphere.particles.slice(0, 3))
    );
    
    return instructions.filter(i => i); // 移除空值
  }
  
  getLightingForEmotion(emotion) {
    const emotionLighting = {
      peaceful: [
        'golden hour with long shadows',
        'soft diffused light with gentle gradient',
        'warm ambient with subtle rim light'
      ],
      scared: [
        'hard light with sharp shadows',
        'single source creating deep shadows',
        'cold blue fill with high contrast'
      ],
      determined: [
        'key light from upper left at 45°',
        'strong rim separation from background',
        'practical light source in frame'
      ],
      focused: [
        'sharp directional light on subject',
        'minimal fill with dramatic shadows',
        'eye light reflection in iris'
      ],
      compassionate: [
        'soft wrap-around light',
        'warm bounce fill on shadow side',
        'gentle gradient from light to shadow'
      ]
    };
    
    return emotionLighting[emotion] || emotionLighting.peaceful;
  }
  
  randomPick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}

// ========== 集成到Prompt构建 ==========

function buildCinematicPrompt(shot, options = {}) {
  const constraintEngine = new NarrativeConstraintEngine();
  const cinematicBuilder = new CinematicInstructionBuilder();
  
  // 1. 提取叙事约束
  const constraints = constraintEngine.extractConstraints(shot.action);
  const enhancedNegative = constraintEngine.buildEnhancedNegative(
    options.baseNegative || '',
    shot.action
  );
  
  // 2. 生成高级画面指令
  const shotType = shot.action.includes('close-up') ? 'close-up' :
                   shot.action.includes('wide') ? 'wide' : 'action';
  const instructions = cinematicBuilder.buildInstructions(
    shotType,
    shot.endingExpression || 'peaceful',
    'bioluminescent'
  );
  
  // 3. 重组Prompt（叙事→视觉）
  const visualAction = convertNarrativeToVisual(shot.action);
  
  return {
    prompt: `${options.l1 || ''} ${options.l2 || ''} ${visualAction} ${instructions.join('. ')}. ${enhancedNegative}.`,
    constraints,
    instructions,
    visualAction,
    negative: enhancedNegative
  };
}

/**
 * 叙事描述 → 视觉描述转换
 * 将典故名称转为视觉元素描述（如：光体轨迹+能量散射+水晶折射）
 */
function convertNarrativeToVisual(action) {
  let visualDesc = action;
  
  // 叙事动词 → 视觉等效
  const replacements = {
    'shooting': 'energy trajectory with light trail',
    'drawing bow': 'hands positioned with tension lines',
    'scared eyes': 'wide iris with dilated pupil in shadow',
    'running': 'motion blur with displaced particles',
    'climbing': 'sequential grip positions with muscle tension',
    'hiding': 'partial occlusion with shadow gradient',
    'screaming': 'open mouth with visible breath vapor',
    'crying': 'tear refraction with light spectrum',
    'laughing': 'facial muscle contraction with eye crease'
  };
  
  for (const [narrative, visualEq] of Object.entries(replacements)) {
    visualDesc = visualDesc.replace(new RegExp(narrative, 'gi'), visualEq);
  }
  
  return visualDesc;
}

// ========== 导出 ==========
module.exports = {
  NarrativeConstraintEngine,
  CinematicInstructionBuilder,
  buildCinematicPrompt,
  convertNarrativeToVisual,
  CINEMATIC_VOCABULARY,
  NARRATIVE_VERBS,
  NARRATIVE_CONCEPTS,
  NARRATIVE_ADJECTIVES
};

// CLI测试
if (require.main === module) {
  const engine = new NarrativeConstraintEngine();
  const builder = new CinematicInstructionBuilder();
  
  const testAction = "slow motion of Valnir hunter drawing crystal Biobow to full draw, tracking first arrow loosing with cyan streak trail, whip pan across sky cutting golden light thread, close-up of bowstring vibrating with crystal resonance, determined gaze tracking arrow flight";
  
  console.log('\n🎬 叙事约束引擎测试\n');
  console.log('='.repeat(80));
  
  const constraints = engine.extractConstraints(testAction);
  console.log('\n📋 提取的约束:');
  constraints.forEach(c => console.log(`   - ${c}`));
  
  const instructions = builder.buildInstructions('action', 'focused', 'bioluminescent');
  console.log('\n🎥 高级画面指令:');
  instructions.forEach(i => console.log(`   - ${i}`));
  
  const visual = convertNarrativeToVisual(testAction);
  console.log('\n🎨 视觉转换:');
  console.log(`   原始: ${testAction.substring(0, 80)}...`);
  console.log(`   视觉: ${visual.substring(0, 80)}...`);
  
  console.log('\n' + '='.repeat(80));
}
