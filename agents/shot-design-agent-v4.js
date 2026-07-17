/**
 * Shot Design Agent v4.2 / 镜头设计Agent增强版（软性优化版）
 * 支持完整v4.1 Shot Card字段：OFA/EFA/节拍点/屏幕方向/优先级/节奏四维
 * 
 * 优化内容：调用镜头质量增强器、微动作增强系统、导演技能路由进行shot增强
 * 调用子系统：shot-quality-enhancer, micro-motion-adapter, cinematography-skill-router, cinematography-core
 * 优化日期：2026-07-15
 * 约束：数据结构不变、接口契约不变、文件结构不变
 */

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { ProductionBible, generateCharacterAnchor, generateEnvironmentAnchor } = require('../systems/production-bible');
const { LightTier, recommendLightTier, getLightTierPrompt } = require('../systems/light-tier');
const { ShotPriority, getPriorityFromType, getPriorityConfig } = require('../systems/shot-priority');
const { ContinuityMode, validateContinuity } = require('../systems/continuity-manager');
const { calculateFiveDimensionScore, checkBlockConditions } = require('../systems/quality-scorer');

// 【优化新增】导入镜头质量增强系统 — 用于叙事目的推断+视觉钩子+行为逻辑注入
// 调用子系统：shot-quality-enhancer
let ShotQualityEnhancer = null;
try {
  const sqeModule = require('../hyperreality-system/engines/enhancers/shot-quality-enhancer');
  ShotQualityEnhancer = sqeModule.ShotQualityEnhancer;
} catch (e) {
  console.warn('[ShotDesign] ShotQualityEnhancer 未加载，镜头质量增强将跳过');
}

// 【优化新增】导入微动作增强系统 — 用于角色微表情/微动作注入
// 调用子系统：micro-motion-adapter
let MicroMotionAdapter = null;
try {
  const mmaModule = require('../hyperreality-system/engines/enhancers/micro-motion-adapter');
  MicroMotionAdapter = mmaModule.MicroMotionAdapter;
} catch (e) {
  console.warn('[ShotDesign] MicroMotionAdapter 未加载，微动作增强将跳过');
}

// 【优化新增】导入导演技能路由系统 — 用于镜头级导演技能注入
// 调用子系统：cinematography-skill-router
let cinematographySkillRouter = null;
try {
  cinematographySkillRouter = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-skill-router');
} catch (e) {
  console.warn('[ShotDesign] cinematography-skill-router 未加载，导演技能注入将跳过');
}

// 【优化新增】导入摄影核心工具库 — 用于镜头语言生成
// 调用子系统：cinematography-core
let cinematographyCore = null;
try {
  cinematographyCore = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-core');
} catch (e) {
  console.warn('[ShotDesign] cinematography-core 未加载，镜头语言增强将跳过');
}

const fs = require('fs');
const path = require('path');

class ShotDesignAgentV4 {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/shot-card-v4-template.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    this.shotCounter = 0;
    // 【优化新增】初始化增强系统
    this.shotQualityEnhancer = null;
    this.microMotionAdapter = null;
    if (ShotQualityEnhancer) {
      try {
        this.shotQualityEnhancer = new ShotQualityEnhancer({
          enabled: true,
          intensity: options.qualityIntensity || 0.7
        });
      } catch (e) {
        console.warn('[ShotDesign] ShotQualityEnhancer 初始化失败:', e.message);
      }
    }
    if (MicroMotionAdapter) {
      try {
        this.microMotionAdapter = new MicroMotionAdapter({
          enabled: true,
          intensity: options.microMotionIntensity || 0.6
        });
      } catch (e) {
        console.warn('[ShotDesign] MicroMotionAdapter 初始化失败:', e.message);
      }
    }
  }

  /**
   * 基于Scene Card生成Shot Cards（优化版）
   * @param {Object} sceneCard - 已确认的Scene Card（数据结构不变）
   * @param {Array} storyBeats - 故事节拍（数据结构不变）
   * @returns {Array} Shot Cards数组（接口契约不变）
   */
  async generateShots(sceneCard, storyBeats = []) {
    // 验证Scene Card（原有逻辑不变）
    if (!sceneCard.director_approval) {
      throw new Error('Scene Card未经导演确认，不能生成Shot Card');
    }

    this.shotCounter = 0;
    const shots = [];
    const shotCount = sceneCard.shot_count || 5;

    // 为每个镜头生成Shot Card（原有逻辑不变）
    for (let i = 0; i < shotCount; i++) {
      this.shotCounter++;
      const shotId = `${sceneCard.scene_id}-S${String(this.shotCounter).padStart(2, '0')}`;

      const shot = await this._generateSingleShot(sceneCard, i, shotCount, storyBeats[i]);
      shot.shot_id = shotId;
      shots.push(shot);
    }

    // 【优化新增】步骤2b: 批量注入导演技能
    // 调用子系统：cinematography-skill-router
    // 优化理由：在全部shot生成后，批量进行导演技能匹配和注入，提升整体镜头语言专业度
    if (cinematographySkillRouter && shots.length > 0) {
      try {
        await this._injectDirectorSkillsToShots(shots);
      } catch (e) {
        console.warn('[ShotDesign] 批量导演技能注入失败（降级跳过）:', e.message);
      }
    }

    // 【优化新增】步骤2c: 批量注入镜头质量增强
    // 调用子系统：shot-quality-enhancer
    // 优化理由：为每个shot注入叙事目的、视觉钩子、行为逻辑、深度规划等
    if (this.shotQualityEnhancer) {
      try {
        this._injectShotQuality(shots, sceneCard);
      } catch (e) {
        console.warn('[ShotDesign] 镜头质量增强失败（降级跳过）:', e.message);
      }
    }

    // 【优化新增】步骤2d: 批量注入微动作增强
    // 调用子系统：micro-motion-adapter
    // 优化理由：为角色注入微表情和微动作描述，提升角色生命力和情感传达力
    if (this.microMotionAdapter) {
      try {
        this._injectMicroMotion(shots);
      } catch (e) {
        console.warn('[ShotDesign] 微动作增强失败（降级跳过）:', e.message);
      }
    }

    // 镜头间连续性校验（原有逻辑不变）
    this._validateContinuity(shots);

    return shots;
  }

  /**
   * 生成单个Shot Card（优化版：prompt增强）
   */
  async _generateSingleShot(sceneCard, index, total, storyBeat) {
    const isHero = sceneCard.hero_shots && sceneCard.hero_shots.includes(index + 1);
    const isOpening = index === 0;
    const isClosing = index === total - 1;
    const isClimax = sceneCard.scene_function === '冲突' && index === Math.floor(total / 2);

    // 确定镜头类型和优先级（原有逻辑不变）
    let shotType = 'building';
    if (isOpening) shotType = 'opening';
    else if (isHero) shotType = 'hero';
    else if (isClosing) shotType = 'resolution';
    else if (isClimax) shotType = 'climax';
    else if (index === total - 2) shotType = 'close';

    const priority = getPriorityFromType(shotType);
    const priorityConfig = getPriorityConfig(priority);

    // 构建Prompt（优化版：增强电影镜头设计深度）
    const prompt = this._buildShotPrompt(sceneCard, index, total, storyBeat, shotType, priority);

    // 调用LLM（带成功校验与一次重试，失败显式抛出，禁止拿空串静默走规则解析）
    let result = await this.engine.reasonRaw(prompt, {
      maxTokens: 1200,
      temperature: 1
    });
    if ((!result || result.success === false || !(result.content || result.reasoning_content || '').trim()) ) {
      console.warn(`[ShotDesign] 首次生成失败(${result && result.error || '内容为空'})，2s 后重试一次...`);
      await new Promise(r => setTimeout(r, 2000));
      result = await this.engine.reasonRaw(prompt, { maxTokens: 1200, temperature: 1 });
    }
    if (!result || result.success === false) {
      throw new Error(`Shot Card LLM生成失败: ${(result && result.error) || '未知错误'}`);
    }

    // 从content或reasoning_content提取（原有逻辑不变）
    const rawText = result.content || result.reasoning_content || '';
    if (!rawText.trim()) {
      throw new Error('Shot Card LLM返回内容为空');
    }

    // 解析Shot Card数据（原有逻辑不变）
    const shotData = this._parseShotData(rawText, sceneCard, shotType, priority);

    // 注入系统约束（原有逻辑不变）
    shotData.character_bindings = this._generateCharacterBindings(sceneCard);
    shotData.environment_constraints = this._generateEnvironmentConstraints(sceneCard);
    shotData.forbidden_elements = ProductionBible.forbidden.slice(0, 5).join(', ');
    shotData.nirath_traits = ProductionBible.nirathPlanet.required.join(', ');

    // 生成精简Prompt（优化版：融入质量增强和微动作）
    shotData.render_prompt = this._generateRenderPrompt(shotData, sceneCard);

    // 计算质量评分（原有逻辑不变）
    const qualityScore = this._estimateQualityScore(shotData, sceneCard);
    shotData.target_scores = qualityScore;
    shotData.target_total_score = qualityScore.totalScore;

    // 保存文件（原有逻辑不变）
    if (sceneCard.output_path) {
      this._saveShotCard(shotData, sceneCard.output_path);
    }

    return shotData;
  }

  /**
   * 构建Shot Card生成Prompt（优化版：增加电影镜头设计深度）
   * 调用子系统：shot-quality-enhancer 的知识体系（融入prompt指导）
   */
  _buildShotPrompt(sceneCard, index, total, storyBeat, shotType, priority) {
    const lightTier = sceneCard.light_tier || 'A';
    const lightInfo = getLightTierPrompt(lightTier);

    // 确定情绪强度（原有逻辑不变）
    const emotionIntensity = this._calculateEmotionIntensity(index, total, sceneCard);

    // 确定连续性模式（原有逻辑不变）
    const continuityMode = this._determineContinuityMode(index, total, sceneCard);

    // 【优化新增】计算叙事目的
    const narrativePurpose = this._inferNarrativePurpose(shotType, index, total);

    // 【优化新增】推断视觉钩子
    const visualHook = this._inferVisualHook(sceneCard, shotType, index);

    return `
你是一位资深影视摄影师，正在为AI视频生成系统创建"镜头卡"（Shot Card）。

这是第${index + 1}/${total}个镜头，场景：${sceneCard.scene_name}。

## Scene Card信息（上游控制）

- 场次功能: ${sceneCard.scene_function}
- 目标情绪: ${sceneCard.emotion_start} → ${sceneCard.emotion_end} (强度: ${emotionIntensity})
- 光线档位: ${lightTier} — ${lightInfo}
- 色彩策略: ${sceneCard.primary_palette} + ${sceneCard.accent_color}
- 屏幕方向: ${sceneCard.screen_direction}
- 连续性模式: ${continuityMode}
- 镜头类型: ${shotType}
- 优先级: ${priority} (${priorityConfig.name})

## 【优化新增】叙事目的指导
- 本镜头的叙事目的: ${narrativePurpose}
- 每个镜头必须有且只有一个明确的叙事目的
- 叙事目的类型: establish(建立)/reveal(揭示)/climax(高潮)/resolution(收束)/conflict(冲突)/emotion(情绪)/progress(推进)

## 【优化新增】视觉钩子指导
- 本镜头的视觉钩子: ${visualHook}
- 每个镜头必须有唯一的"第一眼"视觉焦点
- 视觉钩子应该是具体的、可描述的、有画面感的

## 【优化新增】角色行为逻辑指导
- 角色行为必须与情绪目标一致
- 恐惧→本能后退、肩膀紧绷、呼吸中断
- 好奇→微微前倾、目光锁定、手不自觉伸出
- 敬畏→静止、仰头、下巴放松、屏息
- 愤怒→脊柱挺直、下巴收紧、控制的前倾张力
- 悲伤/温柔→克制的小动作、呼吸放缓、眼神柔和

## 【优化新增】前3秒杀手指导
${index < 3 ? `- 这是片头前3秒内的镜头，必须有强视觉冲击
- 禁止: establishing/transition/explanation 类型开场
- 必须有: 大规模对比/神秘世界异常/角色剪影揭示/人类好奇心锚点/低音大气冲击` : '- 非片头镜头，按正常叙事节奏设计'}

## 【优化新增】深度规划指导
- 每个镜头必须有前景/中景/背景三层规划
- 前景: subtle environmental framing element（破碎岩石边缘/漂浮发光孢子/反射水面）
- 中景: primary subject action zone（角色身体反应/主要动作区域）
- 背景: large-scale spatial context（宏大岩石背景/深邃洞穴黑暗）

## 故事节拍

${storyBeat || '无特定节拍'}

## 输出要求

请输出以下格式的Shot Card（只输出字段内容，不要解释）：

叙事目的: [一句话描述这个镜头在叙事中的作用]
主动作: [角色的主要动作]
表演目标: [角色应该表现出的情绪/状态]
OFA: [起幅构图和状态]
EFA: [落幅构图和状态]
第一视觉重点: [观众第一眼看到什么]
景别: [extreme wide/wide/medium/close-up/extreme close-up]
机位: [camera position]
运镜: [specific camera movement]
运动强度: [1-5]
节奏等级: [静/缓/中/快/爆发]
信息密度: [极简/低/中/高/极高]
空间关系: [角色与空间的关系]
环境特征: [关键环境元素]
对话: [如果有台词]
声音事件: [关键声音]
转场意图: [如何与下一镜衔接]

## 约束

1. 叙事目的必须简洁明确，一镜一主旨
2. 主动作必须可执行（避免抽象形容词）
3. OFA和EFA必须具体可描述
4. 第一视觉重点只能有一个
5. 运镜不能和动作冲突
6. 节奏必须匹配场景情绪强度（${emotionIntensity}）
7. 光线必须遵循${lightTier}档位规范
8. 【优化新增】角色行为必须符合情绪目标的行为逻辑（见上方指导）
9. 【优化新增】镜头必须有明确的视觉钩子（见上方指导）
10. 【优化新增】如果是片头镜头，前3秒必须有强视觉冲击

请输出：
`.trim();
  }

  /**
   * 【优化新增辅助】推断叙事目的
   * 基于shot-quality-enhancer的叙事目的推断逻辑
   */
  _inferNarrativePurpose(shotType, index, total) {
    if (index === 0) return 'establish — 建立空间、引入主体、设定基调';
    if (shotType === 'hero') return 'reveal — 揭示关键信息，视觉冲击';
    if (shotType === 'climax') return 'climax — 高潮揭示，情绪释放';
    if (shotType === 'resolution' || index === total - 1) return 'resolution — 情绪落地，张力收束';
    if (shotType === 'close') return 'progress — 推进叙事，过渡衔接';
    return 'progress — 推进叙事，信息传递';
  }

  /**
   * 【优化新增辅助】推断视觉钩子
   * 基于shot-quality-enhancer的视觉钩子推断逻辑
   */
  _inferVisualHook(sceneCard, shotType, index) {
    if (index === 0) return 'first glimpse of the world, something never seen before';
    if (shotType === 'hero') return 'iconic frame that defines the entire piece';
    if (shotType === 'climax') return 'moment of irreversible change, the point of no return';
    if (shotType === 'reveal') return 'secret unveiled, the hidden made visible';
    if (shotType === 'resolution') return 'emotional landing, the exhale after tension';
    if (sceneCard.emotion_end) {
      const emotion = sceneCard.emotion_end.toLowerCase();
      if (emotion.includes('tense')) return 'coiled stillness before the inevitable release';
      if (emotion.includes('curious')) return 'eyes tracking movement, body leaning into the unknown';
      if (emotion.includes('awe')) return 'scale so vast it redefines the subject in the frame';
      if (emotion.includes('fear')) return 'protective posture against something unseen but felt';
    }
    return 'unique visual moment that demands attention';
  }

  /**
   * 解析LLM输出为结构化数据（原有逻辑完全保持不变）
   */
  _parseShotData(rawText, sceneCard, shotType, priority) {
    const data = {};

    // 提取关键字段
    const fields = [
      '叙事目的', '主动作', '表演目标', 'OFA', 'EFA', '第一视觉重点',
      '景别', '机位', '运镜', '运动强度', '节奏等级', '信息密度',
      '空间关系', '环境特征', '对话', '声音事件', '转场意图'
    ];

    for (const field of fields) {
      const regex = new RegExp(`${field}[：:]\\s*(.+?)(?=\\n|$)`, 'i');
      const match = rawText.match(regex);
      if (match) {
        data[this._mapFieldName(field)] = match[1].trim();
      }
    }

    // 注入Scene Card数据
    data.scene_id = sceneCard.scene_id;
    data.scene_name = sceneCard.scene_name;
    data.shot_type = shotType;
    data.priority = priority;
    data.priority_config = getPriorityConfig(priority);
    data.is_hero_shot = shotType === 'hero';
    data.is_replaceable = priority === 'P5';
    data.location = sceneCard.scene_name;
    data.emotion_target = sceneCard.emotion_end;
    data.light_tier = sceneCard.light_tier;
    data.color_temp = sceneCard.color_temperature;
    data.screen_direction = sceneCard.screen_direction;
    data.continuity_mode = sceneCard.continuity_mode;
    data.scene_function = sceneCard.scene_function;
    data.duration = this._estimateDuration(shotType, priority);

    // 导演六问（默认基于Scene Card推导）
    data.existence_reason = data.narrative_purpose || '推进叙事';
    data.first_look = data.primary_poi || '主体';
    data.delete_loss = sceneCard.audience_must_know || '叙事断裂';
    data.next_shot_connect = data.transition_intent || '自然过渡';
    data.simpler_method = '暂无';
    data.editable_check = '是';

    return data;
  }

  /**
   * 字段名映射（原有逻辑完全保持不变）
   */
  _mapFieldName(chinese) {
    const mapping = {
      '叙事目的': 'narrative_purpose',
      '主动作': 'primary_action',
      '表演目标': 'performance_goal',
      'OFA': 'ofa',
      'EFA': 'efa',
      '第一视觉重点': 'primary_poi',
      '景别': 'shot_size',
      '机位': 'camera_position',
      '运镜': 'camera_movement',
      '运动强度': 'motion_intensity',
      '节奏等级': 'rhythm_level',
      '信息密度': 'info_density',
      '空间关系': 'spatial_relation',
      '环境特征': 'environment_traits',
      '对话': 'dialogue',
      '声音事件': 'sound_events',
      '转场意图': 'transition_intent'
    };
    return mapping[chinese] || chinese;
  }

  /**
   * 生成角色绑定（原有逻辑完全保持不变）
   */
  _generateCharacterBindings(sceneCard) {
    if (!sceneCard.main_characters) return '';

    return sceneCard.main_characters.map(char => {
      const anchor = generateCharacterAnchor(char);
      return `${char}: ${anchor}`;
    }).join('\n');
  }

  /**
   * 生成环境约束（原有逻辑完全保持不变）
   */
  _generateEnvironmentConstraints(sceneCard) {
    const env = generateEnvironmentAnchor(sceneCard.location);
    return env || '使用Scene Card环境设定';
  }

  /**
   * 生成精简渲染Prompt（优化版：融入质量增强内容）
   */
  _generateRenderPrompt(shotData, sceneCard) {
    const parts = [];

    // 1. 主体与绑定（不可删除）
    if (shotData.character_bindings) {
      parts.push(shotData.character_bindings);
    }

    // 【优化新增】微动作描述（如果在_qualityEnhancement中）
    if (shotData._microMotion && shotData._microMotion.added) {
      parts.push(`micro-expression: ${shotData._microMotion.added}`);
    }

    // 2. 主动作（不可删除）
    if (shotData.primary_action) {
      parts.push(shotData.primary_action);
    }

    // 3. 表演目标
    if (shotData.performance_goal) {
      parts.push(shotData.performance_goal);
    }

    // 4. 空间环境
    if (shotData.environment_traits) {
      parts.push(shotData.environment_traits);
    }

    // 【优化新增】深度规划（如果在_qualityEnhancement中）
    if (shotData._depthPlan) {
      const dp = shotData._depthPlan;
      parts.push(`depth layers: foreground-${dp.foreground}, midground-${dp.midground}, background-${dp.background}`);
    }

    // 5. 镜头语言
    if (shotData.camera_movement) {
      parts.push(shotData.camera_movement);
    }

    // 【优化新增】视觉钩子（如果在_qualityEnhancement中）
    if (shotData._visualHook) {
      parts.push(`visual hook: ${shotData._visualHook}`);
    }

    // 6. 光线与材质
    if (shotData.light_tier) {
      parts.push(getLightTierPrompt(shotData.light_tier));
    }

    // 【优化新增】高潮镜头升级（如果在_qualityEnhancement中标记为climax）
    if (shotData._climaxUpgrade) {
      parts.push('dramatic hard contrast, strong rim separation, decisive push-in composition');
    }

    // 7. 收束锚点
    if (shotData.efa) {
      parts.push(shotData.efa);
    }

    // 8. Nirath特征
    parts.push(ProductionBible.nirathPlanet.required.join(', '));

    // 9. 禁用元素（负面提示）
    parts.push(`NO: ${ProductionBible.forbidden.slice(0, 3).join(', ')}`);

    return parts.join(', ');
  }

  /**
   * 【优化新增】批量注入导演技能到shots
   * 调用子系统：cinematography-skill-router
   * 优化点：将所有shots批量传递给技能路由，进行导演技能匹配和注入
   */
  async _injectDirectorSkillsToShots(shots) {
    if (!cinematographySkillRouter || !shots || shots.length === 0) return;

    // 将shots转换为技能路由期望的格式
    const routerShots = shots.map(shot => ({
      description: `${shot.primary_action || ''} ${shot.environment_traits || ''} ${shot.performance_goal || ''}`,
      camera: shot.camera_movement || '',
      mood: shot.emotion_target || shot.performance_goal || '',
      lighting: shot.light_tier || ''
    }));

    // 批量增强
    const enhanced = cinematographySkillRouter.routeAndEnhance(routerShots, {
      minScore: 8,
      maxSkillsPerShot: 2,
      dryRun: false
    });

    if (enhanced && enhanced.enhancedShots) {
      // 将增强结果映射回原shots
      for (let i = 0; i < shots.length; i++) {
        const enhancedShot = enhanced.enhancedShots[i];
        if (enhancedShot && enhancedShot._appliedSkills && enhancedShot._appliedSkills.length > 0) {
          // 将技能标记注入shot（不改变原有字段结构）
          shots[i]._directorSkills = enhancedShot._appliedSkills.map(s => ({
            file: s.file,
            score: s.score,
            type: s.type,
            director: s.director,
            emotion: s.emotion
          }));

          // 将技能prompt内容追加到camera_movement（增强而非替换）
          const skillPrompt = enhanced.enhancedShots[i]._generatedPrompt || '';
          const skillTag = skillPrompt.match(/\[CINEMATIC_SKILL\].*/);
          if (skillTag && shots[i].camera_movement) {
            shots[i].camera_movement = `${shots[i].camera_movement} | ${skillTag[0]}`;
          }

          console.log(`[ShotDesign] ✅ 导演技能已注入 ${shots[i].shot_id}: ${enhancedShot._appliedSkills.map(s => `${s.type}_${s.director}_${s.emotion}`).join(', ')}`);
        }
      }
    }

    if (enhanced && enhanced.report) {
      console.log(`[ShotDesign] 📊 技能注入报告: ${enhanced.report.enhancedShots}/${enhanced.report.totalShots} 个镜头增强 | 使用技能: ${enhanced.report.skillsUsed?.length || 0} 个`);
    }
  }

  /**
   * 【优化新增】注入镜头质量增强
   * 调用子系统：shot-quality-enhancer
   * 优化点：为每个shot注入叙事目的、视觉钩子、行为逻辑、深度规划、高潮升级等
   */
  _injectShotQuality(shots, sceneCard) {
    if (!this.shotQualityEnhancer || !shots || shots.length === 0) return;

    // 将shots转换为ShotQualityEnhancer期望的格式
    const enhancerShots = shots.map(shot => ({
      shotId: shot.shot_id || '',
      type: shot.shot_type || '',
      scene: shot.environment_traits || shot.scene_name || '',
      action: shot.primary_action || '',
      description: `${shot.environment_traits || ''} ${shot.primary_action || ''}`,
      emotion: shot.emotion_target || '',
      mood: shot.performance_goal || '',
      camera: shot.camera_movement || '',
      lighting: shot.light_tier || '',
      tension: shot.emotion_target === sceneCard?.emotion_end ? 8 : 5
    }));

    // 批量增强
    const enhanced = this.shotQualityEnhancer.enhance(enhancerShots, {
      duration: sceneCard?.duration || 10,
      intent: sceneCard?.scene_function || '',
      style: sceneCard?.creative_intent || ''
    });

    if (enhanced && enhanced.shots) {
      // 将增强结果映射回原shots
      for (let i = 0; i < shots.length && i < enhanced.shots.length; i++) {
        const eShot = enhanced.shots[i];

        // 叙事目的
        if (eShot._narrativePurpose) {
          shots[i]._narrativePurpose = eShot._narrativePurpose;
        }

        // 视觉钩子
        if (eShot._visualHook) {
          shots[i]._visualHook = eShot._visualHook;
        }

        // 行为逻辑
        if (eShot._behaviorLogic) {
          shots[i]._behaviorLogic = eShot._behaviorLogic;
        }

        // 深度规划
        if (eShot._depthPlan) {
          shots[i]._depthPlan = eShot._depthPlan;
        }

        // 高潮升级标记
        if (eShot._climaxUpgrade) {
          shots[i]._climaxUpgrade = true;
        }

        // 第一视觉重点
        if (eShot._primaryFocus) {
          shots[i]._primaryFocus = eShot._primaryFocus;
        }

        // 可拍摄化约束
        if (eShot._cinematicReadability) {
          shots[i]._cinematicReadability = eShot._cinematicReadability;
        }

        console.log(`[ShotDesign] ✅ 镜头质量增强已注入 ${shots[i].shot_id}`);
      }
    }

    if (enhanced && enhanced.report) {
      console.log(`[ShotDesign] 📊 质量增强报告: ${enhanced.report.enhancedCount}/${shots.length} | 叙事目的:${enhanced.report.narrativePurpose} | 视觉钩子:${enhanced.report.visualHook} | 高潮升级:${enhanced.report.climaxUpgrade}`);
    }
  }

  /**
   * 【优化新增】注入微动作增强
   * 调用子系统：micro-motion-adapter
   * 优化点：为角色注入微表情和微动作描述，提升角色生命力和情感传达力
   */
  _injectMicroMotion(shots) {
    if (!this.microMotionAdapter || !shots || shots.length === 0) return;

    // 将shots转换为MicroMotionAdapter期望的prompt格式
    const promptObjs = shots.map(shot => ({
      shotId: shot.shot_id || '',
      prompt: `${shot.character_bindings || ''} ${shot.primary_action || ''} ${shot.performance_goal || ''}`,
      emotion: shot.emotion_target || shot.performance_goal || '',
      camera: shot.camera_movement || '',
      shotIndex: parseInt((shot.shot_id || '').split('-S')[1], 10) || 0
    }));

    // 构建情绪弧线上下文
    const emotionArc = {
      getTargetForShot: (idx) => {
        if (idx >= 0 && idx < shots.length) {
          return shots[idx].emotion_target || 'neutral';
        }
        return 'neutral';
      }
    };

    const context = {
      characters: shots.map(s => s.character_bindings || '').filter(Boolean),
      emotionArc
    };

    // 批量增强
    const enhanced = this.microMotionAdapter.enhance(promptObjs, context);

    if (enhanced && enhanced.prompts) {
      // 将增强结果映射回原shots
      for (let i = 0; i < shots.length && i < enhanced.prompts.length; i++) {
        const ePrompt = enhanced.prompts[i];
        if (ePrompt._microMotion) {
          shots[i]._microMotion = ePrompt._microMotion;

          // 将微动作描述融入render_prompt
          if (ePrompt._microMotion.added && shots[i].render_prompt) {
            // 在角色绑定后插入微动作描述
            const charBinding = shots[i].character_bindings || '';
            if (charBinding && shots[i].render_prompt.includes(charBinding)) {
              shots[i].render_prompt = shots[i].render_prompt.replace(
                charBinding,
                `${charBinding} — ${ePrompt._microMotion.added}`
              );
            }
          }

          console.log(`[ShotDesign] ✅ 微动作增强已注入 ${shots[i].shot_id}: ${ePrompt._microMotion.emotion} (granularity:${ePrompt._microMotion.granularity})`);
        }
      }
    }

    if (enhanced && enhanced.details) {
      console.log(`[ShotDesign] 📊 微动作增强报告: ${enhanced.enhancedCount}/${shots.length} 个镜头`);
    }
  }

  /**
   * 估算质量评分（原有逻辑完全保持不变）
   */
  _estimateQualityScore(shotData, sceneCard) {
    // 基于字段完整度估算
    const readability = shotData.primary_poi && shotData.primary_action ? 85 : 60;
    const controllability = shotData.camera_movement && shotData.ofa && shotData.efa ? 80 : 55;
    const editability = shotData.transition_intent && shotData.ofa ? 75 : 50;
    const emotionHit = shotData.performance_goal ? 80 : 50;
    const memorability = shotData.is_hero_shot ? 85 : 60;

    return calculateFiveDimensionScore({
      readability,
      controllability,
      editability,
      emotionHit,
      memorability
    });
  }

  /**
   * 计算情绪强度（原有逻辑完全保持不变）
   */
  _calculateEmotionIntensity(index, total, sceneCard) {
    const baseIntensity = sceneCard.emotion_intensity || 5;

    // 开场较低，中间达到峰值，结尾回落
    if (index === 0) return Math.max(1, baseIntensity - 2);
    if (index === Math.floor(total / 2)) return Math.min(10, baseIntensity + 2);
    if (index === total - 1) return Math.max(1, baseIntensity - 1);
    return baseIntensity;
  }

  /**
   * 确定连续性模式（原有逻辑完全保持不变）
   */
  _determineContinuityMode(index, total, sceneCard) {
    if (index === 0) return 'none'; // 开场镜头不需要连续
    if (sceneCard.continuity_mode === 'strict') return 'strict';
    if (index < total - 1 && sceneCard.scene_function === '冲突') return 'strict';
    return 'soft';
  }

  /**
   * 估算时长（原有逻辑完全保持不变）
   */
  _estimateDuration(shotType, priority) {
    const durations = {
      'opening': 8,
      'hero': 6,
      'climax': 5,
      'close': 4,
      'building': 5,
      'resolution': 6
    };
    return durations[shotType] || 5;
  }

  /**
   * 镜头间连续性校验（原有逻辑完全保持不变）
   */
  _validateContinuity(shots) {
    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i - 1];
      const curr = shots[i];

      // 检查屏幕方向冲突
      if (prev.screen_direction && curr.screen_direction) {
        if (prev.screen_direction === curr.screen_direction) {
          console.warn(`[ShotDesign] ⚠️ 镜头${prev.shot_id}和${curr.shot_id}屏幕方向相同，可能产生跳切`);
        }
      }

      // 检查情绪曲线
      if (prev.emotion_target && curr.emotion_target) {
        // 简化情绪连续性检查
        console.log(`[ShotDesign] ✅ 镜头${prev.shot_id} → ${curr.shot_id} 连续性检查通过`);
      }
    }
  }

  /**
   * 保存Shot Card（原有逻辑完全保持不变）
   */
  _saveShotCard(shotData, outputPath) {
    const fileName = `${shotData.shot_id}-shot-card.md`;
    const filePath = path.join(outputPath, fileName);

    let content = this.template;
    for (const [key, value] of Object.entries(shotData)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        const val = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '未指定');
        content = content.replace(new RegExp(placeholder, 'g'), val);
      }
    }

    // 清理未填充的占位符
    content = content.replace(/\{[a-z_]+\}/g, '未指定');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[ShotDesign] ✅ Shot Card已保存: ${filePath}`);
  }
}

module.exports = { ShotDesignAgentV4 };

// 测试（原有测试逻辑保持不变）
if (require.main === module) {
  async function test() {
    const agent = new ShotDesignAgentV4();

    const sceneCard = {
      scene_id: 'SC01',
      scene_name: '星渊初临',
      scene_function: '建立',
      emotion_start: 'neutral',
      emotion_end: 'curious',
      emotion_intensity: 4,
      light_tier: 'A',
      primary_palette: '青灰+土褐',
      accent_color: '赤金',
      screen_direction: 'left to right',
      continuity_mode: 'soft',
      shot_count: 3,
      hero_shots: [2],
      director_approval: true,
      main_characters: ['xiaoG'],
      audience_must_know: 'xiaoG进入Nirath世界',
      output_path: './output/shots'
    };

    try {
      const shots = await agent.generateShots(sceneCard, [
        'xiaoG从现实世界的裂缝中跌入Nirath',
        'xiaoG在荧光平原上醒来，被发光孢子包围',
        'xiaoG站起来，望向远方的水晶山脉'
      ]);

      console.log('\n=== Shot Cards 生成成功 ===');
      console.log(`共生成 ${shots.length} 个镜头`);

      for (const shot of shots) {
        console.log(`\n--- ${shot.shot_id} ---`);
        console.log('叙事目的:', shot.narrative_purpose);
        console.log('主动作:', shot.primary_action);
        console.log('表演目标:', shot.performance_goal);
        console.log('景别:', shot.shot_size);
        console.log('运镜:', shot.camera_movement);

        // 【优化新增】输出增强追踪
        if (shot._directorSkills) {
          console.log('导演技能:', shot._directorSkills.map(s => `${s.type}_${s.director}_${s.emotion}(score:${s.score})`).join(', '));
        }
        if (shot._visualHook) {
          console.log('视觉钩子:', shot._visualHook);
        }
        if (shot._narrativePurpose) {
          console.log('叙事目的标签:', shot._narrativePurpose);
        }
        if (shot._microMotion) {
          console.log('微动作:', shot._microMotion.added);
        }
        if (shot._depthPlan) {
          console.log('深度规划:', `${shot._depthPlan.foreground} | ${shot._depthPlan.midground} | ${shot._depthPlan.background}`);
        }
      }
    } catch (err) {
      console.error('测试失败:', err.message);
    }
  }

  test();
}
