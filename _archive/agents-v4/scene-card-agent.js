/**
 * Scene Card Agent / 场景卡生成Agent（软性优化版）
 * v4.2上游控制层：在Shot Card之前生成，控制整场次的视觉、情绪、光线策略
 * 
 * 优化内容：调用叙事节奏引擎+摄影核心库进行场景卡增强
 * 调用子系统：narrative-rhythm-adapter, cinematography-core
 * 优化日期：2026-07-15
 * 约束：数据结构不变、接口契约不变、文件结构不变
 */

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { ProductionBible } = require('../systems/production-bible');
const { recommendLightTier } = require('../systems/light-tier');
const { ContinuityMode } = require('../systems/continuity-manager');

// 【优化新增】导入叙事节奏引擎 — 用于为场景卡注入三幕式结构和情绪曲线
// 调用子系统：narrative-rhythm-adapter
let NarrativeRhythmAdapter = null;
try {
  const nraModule = require('../hyperreality-system/engines/enhancers/narrative-rhythm-adapter');
  NarrativeRhythmAdapter = nraModule.NarrativeRhythmAdapter;
} catch (e) {
  console.warn('[SceneCard] NarrativeRhythmAdapter 未加载，叙事节奏注入将跳过');
}

// 【优化新增】导入摄影核心工具库 — 用于色彩理论推荐
// 调用子系统：cinematography-core
let cinematographyCore = null;
try {
  cinematographyCore = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-core');
} catch (e) {
  console.warn('[SceneCard] cinematography-core 未加载，色彩理论注入将跳过');
}

const fs = require('fs');
const path = require('path');

class SceneCardAgent {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/scene-card-template.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    this.sceneNumber = 0;
    // 【优化新增】配置叙事节奏引擎
    this.rhythmAdapter = null;
    if (NarrativeRhythmAdapter) {
      try {
        this.rhythmAdapter = new NarrativeRhythmAdapter({
          enabled: true,
          intensity: options.rhythmIntensity || 0.7
        });
      } catch (e) {
        console.warn('[SceneCard] 叙事节奏引擎初始化失败:', e.message);
      }
    }
  }

  /**
   * 生成Scene Card（优化版）
   * @param {Object} storyInput - 故事输入（数据结构不变）
   * @param {Object} options - 生成选项（数据结构不变）
   * @returns {Object} Scene Card数据（接口契约不变）
   */
  async generate(storyInput, options = {}) {
    this.sceneNumber++;
    const sceneId = `SC${String(this.sceneNumber).padStart(2, '0')}`;

    // 构建Scene Card Prompt（优化版prompt，增强电影工业级表达）
    const prompt = this._buildSceneCardPrompt(storyInput, sceneId, options);

    // 调用LLM生成（原有逻辑不变）
    const result = await this.engine.reasonStructured(prompt, {
      scene_number: '',
      scene_name: '',
      scene_function: '',
      emotion_start: '',
      emotion_end: '',
      light_tier: '',
      primary_palette: '',
      screen_direction: '',
      continuity_mode: '',
      shot_count: 0,
      hero_shots: [],
      risks: [],
      must_deliver: []
    }, {
      maxTokens: 1500,
      temperature: 1
    });

    if (!result.success) {
      throw new Error(`Scene Card生成失败: ${result.error}`);
    }

    const sceneCard = this._enrichSceneCard(result.data, storyInput, sceneId);

    // 【优化新增】注入叙事节奏档案
    // 调用子系统：narrative-rhythm-adapter
    // 优化理由：为场景卡注入整体叙事节奏描述，使场景在整集叙事中有明确定位
    if (this.rhythmAdapter) {
      try {
        this._injectRhythmProfile(sceneCard, storyInput);
      } catch (e) {
        console.warn('[SceneCard] 叙事节奏注入失败（降级跳过）:', e.message);
      }
    }

    // 【优化新增】注入色彩理论方案
    // 调用子系统：cinematography-core
    // 优化理由：根据场景情绪推荐专业色彩方案，提升画面色彩质感
    if (cinematographyCore) {
      try {
        this._injectColorTheory(sceneCard);
      } catch (e) {
        console.warn('[SceneCard] 色彩理论注入失败（降级跳过）:', e.message);
      }
    }

    // 保存Scene Card（原有逻辑不变）
    if (options.outputPath) {
      this._saveSceneCard(sceneCard, options.outputPath, sceneId);
    }

    return sceneCard;
  }

  /**
   * 构建Scene Card生成Prompt（优化版：增强电影工业级表达）
   * 调用子系统：narrative-rhythm-adapter（在prompt指导中融入三幕式结构）
   */
  _buildSceneCardPrompt(storyInput, sceneId, options) {
    const {
      sceneName,
      location,
      characters,
      plot,
      emotionTarget,
      duration,
      prevScene,
      nextScene
    } = storyInput;

    // 从Production Bible获取环境信息（原有逻辑不变）
    const envInfo = this._getEnvironmentInfo(location);

    // 推荐光线档位（原有逻辑不变）
    const recommendedLight = recommendLightTier(sceneName, emotionTarget);

    // 【优化新增】构建叙事节奏指导文本
    // 调用子系统：narrative-rhythm-adapter 的知识（不直接调用API，在prompt中融入指导原则）
    const rhythmGuidance = this._buildRhythmGuidance(storyInput);

    // 【优化新增】构建色彩理论指导文本
    const colorGuidance = this._buildColorGuidance(emotionTarget);

    return `
你是一位资深影视导演，正在为AI视频生成系统创建"场景卡"（Scene Card）。

场景卡是Shot Card的上游控制文档，定义整场的视觉、情绪、光线策略。你需要输出结构化的Scene Card数据。

## 输入信息

- 场次编号: ${sceneId}
- 场次名称: ${sceneName || '未命名'}
- 场景地点: ${location || '未指定'}
- 主要角色: ${characters ? characters.join(', ') : '未指定'}
- 剧情内容: ${plot || '未提供'}
- 目标情绪: ${emotionTarget || '未指定'}
- 时长预算: ${duration || '未指定'}秒
- 前接场次: ${prevScene || '无'}
- 后续场次: ${nextScene || '无'}

## 环境信息（来自Production Bible）

${envInfo}

## 推荐光线档位: ${recommendedLight}

## 【优化新增】叙事节奏设计指导
${rhythmGuidance}

## 【优化新增】色彩理论指导
${colorGuidance}

## 输出要求

请按以下JSON格式输出Scene Card（只输出JSON，不要任何解释）：

{
  "scene_number": "场次编号",
  "scene_name": "场次名称",
  "scene_function": "建立/推进/冲突/揭示/回收 之一",
  "audience_must_know": "观众必须知道的关键信息",
  "narrative_purpose": "叙事作用",
  "emotion_start": "起始情绪",
  "emotion_end": "目标情绪",
  "emotion_turning_point": "情绪转折点描述",
  "emotion_intensity": 1-10,
  "light_tier": "A/B/C/D之一",
  "light_change": "光线变化描述",
  "color_temperature": "色温",
  "primary_palette": "主色调",
  "accent_color": "强调色",
  "forbidden_colors": "禁用色",
  "screen_direction": "屏幕方向",
  "gaze_direction": "视线方向",
  "continuity_mode": "strict/soft/none",
  "continuous_shots": "需要严格连续的镜头段",
  "transition_intent": "转场意图",
  "shot_count": 镜头数量（建议3-8个）,
  "hero_shots": ["Hero Shot描述"],
  "key_shots": ["关键镜头描述"],
  "technical_risks": ["技术风险"],
  "content_risks": ["内容风险"],
  "must_deliver": ["必须交付的内容"],
  "creative_intent": "创作意图"
}

## 约束

1. 场景功能必须是：建立/推进/冲突/揭示/回收 之一
2. 光线档位必须基于情绪目标选择：A=明亮探索，B=神秘低照，C=对抗高反差，D=神圣显现
3. 情绪强度1-10分
4. 镜头数量建议3-8个
5. 必须包含至少1个Hero Shot
6. 【优化新增】色彩方案必须遵循色彩理论指导中的推荐，主色调与情绪目标必须匹配
7. 【优化新增】情绪曲线设计必须遵循叙事节奏指导，避免情绪跳变过于突兀

请输出JSON：
`.trim();
  }

  /**
   * 【优化新增】构建叙事节奏指导文本
   * 调用子系统：narrative-rhythm-adapter 的知识体系
   * 优化点：在prompt中融入三幕式结构和情绪曲线设计原则
   */
  _buildRhythmGuidance(storyInput) {
    const parts = [];

    // 三幕式结构指导
    parts.push(`### 三幕式结构参考`);
    parts.push(`- SETUP（建立期，0-40%时长）：建立空间、引入主体、设定基调，动作强度低，节奏缓慢或静止`);
    parts.push(`- DEVELOPMENT（发展期，30-70%时长）：动作展开、冲突/穿越、张力累积，动作强度中→高，节奏加速`);
    parts.push(`- CLIMAX/RESOLUTION（高潮/收束，60-100%时长）：高潮揭示、情绪释放、定格收束，动作强度峰值→凝固，节奏峰值→固化`);

    // 情绪曲线指导
    parts.push(`### 情绪曲线设计`);
    const emotionTarget = (storyInput.emotionTarget || '').toLowerCase();
    if (emotionTarget.includes('curious') || emotionTarget.includes('explor')) {
      parts.push(`- 建议曲线类型：build（渐进累积）`);
      parts.push(`- 阶段设计：[0s]安静建立 → [10%]信息积累 → [30%]节奏变化 → [50%]张力上升 → [70%]峰值体验 → [90%]定格余韵`);
    } else if (emotionTarget.includes('tense') || emotionTarget.includes('suspense')) {
      parts.push(`- 建议曲线类型：tensionRelease（紧张-释放交替）`);
      parts.push(`- 阶段设计：[0s]观众 settle → [1]呼吸缩短 → [2]短暂释放 → [3]屏息紧张 → [4]深度释放`);
    } else if (emotionTarget.includes('epic') || emotionTarget.includes('grand')) {
      parts.push(`- 建议曲线类型：wave（波浪起伏）`);
      parts.push(`- 阶段设计：[0s]平缓开场 → [25%]第一次波动 → [50%]回落 → [75%]更高波动 → [90%]峰值 → [100%]定格`);
    } else {
      parts.push(`- 默认曲线类型：build（渐进累积）`);
      parts.push(`- 阶段设计：[0s]安静建立 → [10%]发展 → [30%]转折 → [50%]加速 → [70%]高潮 → [90%]定格余韵`);
    }

    // 动静对比指导
    parts.push(`### 动静对比模式`);
    parts.push(`- 选择本场景最适合的动静对比模式，并在创作意图中说明`);
    parts.push(`- 动主体+静环境：主体突出，孤独感`);
    parts.push(`- 静主体+动环境：环境力量，主体脆弱`);
    parts.push(`- 动+动同步：和谐，融入`);
    parts.push(`- 动+动对抗：冲突，张力`);
    parts.push(`- 全动：混乱，失控`);
    parts.push(`- 全静：凝固，永恒`);

    // 呼吸节奏指导
    parts.push(`### 镜头呼吸节奏`);
    parts.push(`- 设计本场景的"呼吸节奏"：紧张镜头与放松镜头的交替模式`);
    parts.push(`- 建议紧张镜头:放松镜头比例在2:1到1:1之间`);
    parts.push(`- 高潮前最后一个镜头必须是"吸气"镜头（短暂放松），让高潮冲击力更强`);

    return parts.join('\n');
  }

  /**
   * 【优化新增】构建色彩理论指导文本
   * 调用子系统：cinematography-core 的知识体系
   * 优化点：根据情绪目标推荐专业色彩方案
   */
  _buildColorGuidance(emotionTarget) {
    if (!cinematographyCore || !emotionTarget) {
      return `- 根据情绪目标${emotionTarget || '（未指定）'}选择合适的主色调\n- 强调色应与主色调形成和谐或对比关系`;
    }

    try {
      const colorScheme = cinematographyCore.recommendColorScheme(emotionTarget);
      if (!colorScheme) {
        return `- 情绪"${emotionTarget}"的色彩方案：根据情绪直觉选择\n- 参考：暖色传递温暖/史诗，冷色传递紧张/悲伤`;
      }

      const parts = [];
      parts.push(`### 推荐色彩方案（基于情绪"${emotionTarget}"）`);
      parts.push(`- 色温方向: ${colorScheme.temperature || 'neutral'}`);
      parts.push(`- 饱和度: ${colorScheme.saturation || 'medium'}`);
      if (colorScheme.palette && colorScheme.palette.length > 0) {
        parts.push(`- 推荐色板: ${colorScheme.palette.join(', ')}`);

        // 色彩心理学指导
        const palette = colorScheme.palette;
        if (palette.some(c => c.includes('blue') || c.includes('cool'))) {
          parts.push(`- 蓝色/冷色系：传递冷静、疏离、神秘、科技感`);
        }
        if (palette.some(c => c.includes('gold') || c.includes('warm') || c.includes('amber'))) {
          parts.push(`- 金色/暖色系：传递温暖、史诗感、希望、神圣`);
        }
        if (palette.some(c => c.includes('red') || c.includes('crimson') || c.includes('orange'))) {
          parts.push(`- 红色/橙色系：传递紧张、冲突、激情、危险`);
        }
        if (palette.some(c => c.includes('grey') || c.includes('desaturated'))) {
          parts.push(`- 灰色/低饱和：传递压抑、悲伤、虚无、冷峻`);
        }
      }

      parts.push(`### 色彩理论应用`);
      parts.push(`- 主色调占画面60-70%，建立情绪基调`);
      parts.push(`- 强调色占画面10-20%，引导视觉焦点`);
      parts.push(`- 辅助色占画面20-30%，丰富层次`);
      parts.push(`- 禁用色：与主色调直接冲突的颜色，破坏情绪统一`);

      return parts.join('\n');
    } catch (e) {
      return `- 色彩方案推荐暂时不可用，请根据情绪直觉选择`;
    }
  }

  /**
   * 【优化新增】注入叙事节奏档案到sceneCard
   * 调用子系统：narrative-rhythm-adapter
   * 优化点：为场景卡注入整体叙事节奏描述，使场景在整集叙事中有明确定位
   */
  _injectRhythmProfile(sceneCard, storyInput) {
    if (!this.rhythmAdapter || !sceneCard) return;

    const duration = storyInput.duration || 10;
    const curveType = this._selectCurveType(sceneCard.emotion_end || storyInput.emotionTarget);
    const dynamicMode = this._selectDynamicMode(sceneCard.scene_function);

    // 构建叙事节奏档案
    const rhythmProfile = this.rhythmAdapter.engine.build({
      curveType,
      duration,
      dynamicMode,
      beatInterval: this.rhythmAdapter.engine.getRecommendedBeatInterval(duration),
      breathingPattern: 'tensionRelease'
    });

    if (rhythmProfile) {
      // 注入到sceneCard（不改变原有字段，新增 _rhythmProfile 扩展字段）
      sceneCard._rhythmProfile = {
        curveType,
        dynamicMode,
        profile: rhythmProfile,
        threeActPosition: this._calculateThreeActPosition(sceneCard.scene_number),
        breathingPattern: 'tensionRelease',
        injectedAt: new Date().toISOString()
      };

      console.log(`[SceneCard] ✅ 叙事节奏档案已注入: ${sceneCard.scene_id} | 曲线:${curveType} | 动静:${dynamicMode}`);
    }
  }

  /**
   * 【优化新增辅助】选择情绪曲线类型
   */
  _selectCurveType(emotion) {
    if (!emotion) return 'build';
    const e = emotion.toLowerCase();
    if (e.includes('tense') || e.includes('suspense') || e.includes('anxious')) return 'tensionRelease';
    if (e.includes('epic') || e.includes('grand') || e.includes('awe')) return 'wave';
    if (e.includes('fear') || e.includes('shock') || e.includes('collapse')) return 'collapse';
    if (e.includes('release') || e.includes('calm') || e.includes('peace')) return 'release';
    return 'build';
  }

  /**
   * 【优化新增辅助】选择动静对比模式
   */
  _selectDynamicMode(sceneFunction) {
    const mapping = {
      '建立': 'staticSubject_movingEnv',
      '推进': 'movingSubject_staticEnv',
      '冲突': 'conflict',
      '揭示': 'sync',
      '回收': 'allStatic'
    };
    return mapping[sceneFunction] || 'movingSubject_staticEnv';
  }

  /**
   * 【优化新增辅助】计算场景在三幕式中的位置
   */
  _calculateThreeActPosition(sceneNumber) {
    const num = parseInt(sceneNumber, 10);
    if (isNaN(num)) return 'unknown';
    if (num <= 2) return 'SETUP';
    if (num <= 5) return 'DEVELOPMENT';
    return 'CLIMAX/RESOLUTION';
  }

  /**
   * 【优化新增】注入色彩理论方案到sceneCard
   * 调用子系统：cinematography-core
   * 优化点：根据场景情绪推荐专业色彩方案
   */
  _injectColorTheory(sceneCard) {
    if (!cinematographyCore || !sceneCard || !sceneCard.emotion_end) return;

    const colorScheme = cinematographyCore.recommendColorScheme(sceneCard.emotion_end);
    if (!colorScheme) return;

    // 注入色彩方案到sceneCard（不改变原有字段，新增 _colorTheory 扩展字段）
    sceneCard._colorTheory = {
      emotion: sceneCard.emotion_end,
      temperature: colorScheme.temperature || 'neutral',
      saturation: colorScheme.saturation || 'medium',
      palette: colorScheme.palette || [],
      cinematographyGuidance: this._generateColorCinematographyGuidance(colorScheme),
      injectedAt: new Date().toISOString()
    };

    console.log(`[SceneCard] ✅ 色彩理论方案已注入: ${sceneCard.scene_id} | 色温:${colorScheme.temperature}`);
  }

  /**
   * 【优化新增辅助】生成色彩摄影指导
   */
  _generateColorCinematographyGuidance(colorScheme) {
    const guidance = [];
    if (colorScheme.palette) {
      if (colorScheme.palette.length >= 1) {
        guidance.push(`primary color: ${colorScheme.palette[0]} — dominant 60-70% of frame`);
      }
      if (colorScheme.palette.length >= 2) {
        guidance.push(`secondary color: ${colorScheme.palette[1]} — supporting 20-30% of frame`);
      }
      if (colorScheme.palette.length >= 3) {
        guidance.push(`accent color: ${colorScheme.palette[2]} — focal points 10-20% of frame`);
      }
    }
    guidance.push(`temperature: ${colorScheme.temperature || 'neutral'}`);
    guidance.push(`saturation: ${colorScheme.saturation || 'medium'}`);
    return guidance.join('; ');
  }

  /**
   * 获取环境信息（原有逻辑完全保持不变）
   */
  _getEnvironmentInfo(location) {
    if (!location) return '未指定环境';

    // 尝试匹配Production Bible中的环境
    for (const [key, env] of Object.entries(ProductionBible.environment)) {
      if (location.includes(key) || key.includes(location)) {
        return `
环境名称: ${env.name}
空间特征: ${env.spatialKeywords.join(', ')}
地标: ${env.landmarks.join(', ')}
色彩: ${env.palette.primary} + ${env.palette.accent}
地面: ${env.ground}
氛围: ${env.atmosphere}
光源: ${env.lightSources}
Nirath特征: ${env.nirathTraits.join(', ')}
禁用: ${env.palette.forbidden.join(', ')}
        `.trim();
      }
    }

    return '环境未在Production Bible中定义，使用通用Nirath设定';
  }

  /**
   * 丰富Scene Card数据（原有逻辑保持不变）
   */
  _enrichSceneCard(rawData, storyInput, sceneId) {
    return {
      ...rawData,
      scene_id: sceneId,
      generation_time: new Date().toISOString(),
      status: 'generated',
      director_approval: false, // 需要导演确认

      // 从Production Bible注入的约束
      system_constraints: {
        forbidden_elements: ProductionBible.forbidden,
        nirath_traits: ProductionBible.nirathPlanet.required,
        character_anchors: storyInput.characters ?
          storyInput.characters.map(c => ProductionBible.character[c]?.anchorFeatures || []).flat()
          : []
      },

      // 与Shot Card的关联
      downstream_control: {
        require_v4_fields: true,
        require_light_tier: true,
        require_priority: true,
        require_ofa_efa: true,
        require_beats: true,
        prompt_length_strategy: 'quality-first'
      }
    };
  }

  /**
   * 保存Scene Card（原有逻辑完全保持不变）
   */
  _saveSceneCard(sceneCard, outputPath, sceneId) {
    const fileName = `${sceneId}-scene-card.md`;
    const filePath = path.join(outputPath, fileName);

    // 填充模板
    let content = this.template;
    for (const [key, value] of Object.entries(sceneCard)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        content = content.replace(new RegExp(placeholder, 'g'),
          Array.isArray(value) ? value.join(', ') : String(value || '未指定'));
      }
    }

    // 处理未填充的占位符
    content = content.replace(/\{[a-z_]+\}/g, '未指定');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SceneCard] ✅ 已保存: ${filePath}`);
  }

  /**
   * 导演确认Scene Card（原有逻辑完全保持不变）
   */
  approve(sceneCard, directorNotes = '') {
    sceneCard.director_approval = true;
    sceneCard.approval_time = new Date().toISOString();
    sceneCard.director_notes = directorNotes;
    sceneCard.status = 'approved';

    return sceneCard;
  }

  /**
   * 验证Scene Card是否可进入Shot Card生成（原有逻辑完全保持不变）
   */
  validateForShotCard(sceneCard) {
    const required = ['scene_function', 'light_tier', 'emotion_start', 'emotion_end', 'shot_count'];
    const missing = required.filter(field => !sceneCard[field]);

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message: `Scene Card缺少必填字段: ${missing.join(', ')}`
      };
    }

    if (!sceneCard.director_approval) {
      return {
        valid: false,
        missing: ['director_approval'],
        message: 'Scene Card尚未经导演确认'
      };
    }

    return { valid: true };
  }
}

module.exports = { SceneCardAgent };

// 测试（原有测试逻辑保持不变）
if (require.main === module) {
  async function test() {
    const agent = new SceneCardAgent();

    const storyInput = {
      sceneName: '星渊初临',
      location: 'Lumina-velum',
      characters: ['xiaoG'],
      plot: 'xiaoG首次进入Nirath异世界，探索荧光平原',
      emotionTarget: 'curiosity',
      duration: 15,
      prevScene: '片头',
      nextScene: '深渊初遇'
    };

    try {
      const sceneCard = await agent.generate(storyInput, {
        outputPath: './output/scenes'
      });

      console.log('\n=== Scene Card 生成成功 ===');
      console.log(JSON.stringify(sceneCard, null, 2));

      // 验证
      const validation = agent.validateForShotCard(sceneCard);
      console.log('\n验证结果:', validation);

      // 【优化新增】输出增强追踪
      if (sceneCard._rhythmProfile) {
        console.log('\n=== 叙事节奏档案 ===');
        console.log('曲线类型:', sceneCard._rhythmProfile.curveType);
        console.log('动静模式:', sceneCard._rhythmProfile.dynamicMode);
        console.log('三幕位置:', sceneCard._rhythmProfile.threeActPosition);
      }
      if (sceneCard._colorTheory) {
        console.log('\n=== 色彩理论方案 ===');
        console.log('色温:', sceneCard._colorTheory.temperature);
        console.log('饱和度:', sceneCard._colorTheory.saturation);
        console.log('色板:', sceneCard._colorTheory.palette.join(', '));
      }

      // 导演确认
      if (!validation.valid) {
        agent.approve(sceneCard, '确认通过，情绪曲线需要微调');
        console.log('\n导演确认后:', agent.validateForShotCard(sceneCard));
      }
    } catch (err) {
      console.error('测试失败:', err.message);
    }
  }

  test();
}
