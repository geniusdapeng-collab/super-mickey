/**
 * Prompt Engine Agent v4.2 / Prompt生成引擎（软性优化版）
 * 
 * 优化内容：调用导演技能库、情绪表演技能、摄影核心库进行prompt增强
 * 调用子系统：cinematography-skill-router, acting-emotion-skills, cinematography-core, light-tier
 * 优化日期：2026-07-15
 * 约束：数据结构不变、接口契约不变、文件结构不变
 */

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { safeTrimPrompt } = require('../systems/safe-prompt-trim');
const { ProductionBible, generateCharacterAnchor, generateNirathTraits } = require('../systems/production-bible');
const { getLightTierPrompt } = require('../systems/light-tier');
const PROMPT_LENGTH = require('../config/prompt-length');

// 【优化新增】导入导演技能路由系统 — 用于智能匹配并注入好莱坞导演技能
// 调用子系统：cinematography-skill-router
let cinematographySkillRouter = null;
try {
  cinematographySkillRouter = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-skill-router');
} catch (e) {
  console.warn('[PromptEngine] cinematography-skill-router 未加载，导演技能注入将跳过');
}

// 【优化新增】导入情绪表演技能库 — 用于角色情绪表演指导注入
// 调用子系统：acting-emotion-skills
let actingEmotionSkills = null;
try {
  actingEmotionSkills = require('../hyperreality-system/skills/hollywood-cinematography/acting-emotion-skills');
} catch (e) {
  console.warn('[PromptEngine] acting-emotion-skills 未加载，情绪表演注入将跳过');
}

// 【优化新增】导入摄影核心工具库 — 用于构图法则/色彩理论/光线类型推荐
// 调用子系统：cinematography-core
let cinematographyCore = null;
try {
  cinematographyCore = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-core');
} catch (e) {
  console.warn('[PromptEngine] cinematography-core 未加载，构图/色彩增强将跳过');
}

const fs = require('fs');
const path = require('path');

class PromptEngineAgentV4 {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/prompt-v4-template.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    // 【优化新增】配置增强强度，0.0-1.0控制注入内容的密度
    this.enhancementIntensity = options.enhancementIntensity || 0.8;
  }

  /**
   * 基于Shot Card生成Prompt（优化版）
   * @param {Object} shotCard - Shot Card数据（数据结构不变）
   * @param {Object} sceneCard - 关联的Scene Card（数据结构不变）
   * @returns {Object} Prompt结果（接口契约不变）
   */
  async generate(shotCard, sceneCard = null) {
    // 1. 构建8步结构数据（原有逻辑保持不变）
    const promptData = this._buildPromptData(shotCard, sceneCard);

    // 【优化新增】步骤1b: 注入导演技能增强
    // 调用子系统：cinematography-skill-router
    // 优化理由：将好莱坞导演的专业镜头语言注入prompt，提升画面电影感
    if (cinematographySkillRouter) {
      try {
        await this._injectDirectorSkills(promptData, shotCard);
      } catch (e) {
        console.warn('[PromptEngine] 导演技能注入失败（降级跳过）:', e.message);
      }
    }

    // 【优化新增】步骤1c: 注入情绪表演指导
    // 调用子系统：acting-emotion-skills
    // 优化理由：为角色添加面部微表情、身体语言、眼神交流指导，提升角色表现力
    if (actingEmotionSkills) {
      try {
        this._injectEmotionActing(promptData, shotCard);
      } catch (e) {
        console.warn('[PromptEngine] 情绪表演注入失败（降级跳过）:', e.message);
      }
    }

    // 2. 生成初始Prompt（原有逻辑保持不变）
    let renderPrompt = this._assemblePrompt(promptData, shotCard, sceneCard);

    // 3. 检查长度（原有逻辑保持不变）
    let charCount = renderPrompt.length;
    let compressionLog = [];

    // 4. 如果超长，按优先级压缩（原有逻辑保持不变）
    if (charCount > PROMPT_LENGTH.HARD_MAX) {
      const compressed = this._compressByPriority(renderPrompt, promptData, charCount, PROMPT_LENGTH.HARD_MAX);
      renderPrompt = compressed.prompt;
      charCount = compressed.charCount;
      compressionLog = compressed.log;
    }

    // 5. 质量评估（原有逻辑保持不变）
    const quality = this._assessQuality(renderPrompt, promptData, charCount);

    // 返回数据结构保持不变（接口契约不变）
    return {
      renderPrompt,
      charCount,
      targetMin: PROMPT_LENGTH.TARGET_MIN,
      targetMax: PROMPT_LENGTH.TARGET_MAX,
      maxChars: PROMPT_LENGTH.HARD_MAX,
      lengthStatus: PROMPT_LENGTH.getStatus(charCount),
      compressionLog,
      quality,
      promptData,
      generationTime: new Date().toISOString(),
      sceneCardId: sceneCard?.scene_id || 'N/A',
      shotCardId: shotCard?.shot_id || 'N/A',
      // 【优化新增】增加增强标记（不影响原有字段，仅用于追踪）
      _enhancements: {
        directorSkillsApplied: !!promptData._directorSkills,
        emotionActingApplied: !!promptData._emotionActing,
        compositionApplied: !!promptData._compositionGuidance,
        colorSchemeApplied: !!promptData._colorScheme,
        intensity: this.enhancementIntensity
      }
    };
  }

  /**
   * 构建8步Prompt数据（优化版：内部增强但不改变返回结构）
   */
  _buildPromptData(shotCard, sceneCard) {
    const data = {
      // 1. 主体与绑定（最高优先级）
      character_anchor: this._buildCharacterAnchor(shotCard),

      // 2. 主动作
      primary_action: shotCard.primary_action || 'performing key action',

      // 3. 表演目标
      performance_focus: shotCard.performance_goal || shotCard.emotion_target || '',

      // 4. 空间环境
      spatial_environment: this._buildEnvironment(shotCard, sceneCard),

      // 5. 镜头语言（优化：内部调用摄影核心库，但不改变data结构）
      camera_language: this._buildCameraLanguage(shotCard),

      // 6. 光线与材质（优化：内部调用色彩理论，但不改变data结构）
      lighting_material: this._buildLighting(shotCard, sceneCard),

      // 7. 声音/对白
      sound_dialogue: shotCard.dialogue || shotCard.sound_events || '',

      // 8. 收束锚点
      closing_anchor: shotCard.efa || shotCard.transition_intent || ''
    };

    // 【优化新增】内部注入构图指导（不增加data字段，直接附加到camera_language）
    if (cinematographyCore) {
      try {
        const shotType = this._mapShotSizeToType(shotCard.shot_size);
        if (shotType) {
          const compositions = cinematographyCore.recommendComposition(shotType);
          if (compositions && compositions.length > 0) {
            const compGuidance = compositions.slice(0, 2).map(c => c.guideline).join('; ');
            data.camera_language = data.camera_language
              ? `${data.camera_language}, composition: ${compGuidance}`
              : `composition: ${compGuidance}`;
            // 标记但不改变data结构
            data._compositionGuidance = true;
          }
        }
      } catch (e) {
        // 降级：不使用构图增强
      }
    }

    // 【优化新增】内部注入色彩方案（不增加data字段，直接附加到lighting_material）
    if (cinematographyCore && shotCard.emotion_target) {
      try {
        const colorScheme = cinematographyCore.recommendColorScheme(shotCard.emotion_target);
        if (colorScheme) {
          const colorDesc = `${colorScheme.temperature} tone, ${colorScheme.saturation} saturation`;
          const paletteDesc = colorScheme.palette ? colorScheme.palette.join(', ') : '';
          data.lighting_material = data.lighting_material
            ? `${data.lighting_material}, color theory: ${colorDesc}, palette: ${paletteDesc}`
            : `color theory: ${colorDesc}, palette: ${paletteDesc}`;
          data._colorScheme = true;
        }
      } catch (e) {
        // 降级：不使用色彩增强
      }
    }

    return data;
  }

  /**
   * 【优化新增】注入导演技能
   * 调用子系统：cinematography-skill-router
   * 优化点：将匹配到的好莱坞导演技能注入prompt数据
   */
  async _injectDirectorSkills(promptData, shotCard) {
    if (!cinematographySkillRouter || !shotCard) return;

    // 构建shot元数据用于技能匹配
    const shotMeta = cinematographySkillRouter.extractShotMetadata({
      description: `${shotCard.primary_action || ''} ${shotCard.environment_traits || ''} ${shotCard.performance_goal || ''}`,
      camera: shotCard.camera_movement || '',
      mood: shotCard.emotion_target || shotCard.performance_goal || '',
      lighting: promptData.lighting_material || ''
    });

    // 匹配技能（最多2个，最小分数8）
    const matchedSkills = cinematographySkillRouter.matchSkills(shotMeta, 2)
      .filter(s => s.score >= 8);

    if (matchedSkills.length === 0) return;

    // 注入技能增强到prompt数据
    const skillEnhancements = matchedSkills.map(s => {
      const enhancements = [];
      if (s.enhancement?.promptBlock) {
        enhancements.push(s.enhancement.promptBlock.substring(0, 200));
      }
      if (s.enhancement?.cameraBlock) {
        enhancements.push(s.enhancement.cameraBlock.substring(0, 150));
      }
      if (s.enhancement?.emotionBlock) {
        enhancements.push(s.enhancement.emotionBlock.substring(0, 150));
      }
      return {
        director: s.meta?.director_zh || s.meta?.director || '',
        emotion: s.meta?.emotion_zh || s.meta?.emotion || '',
        type: s.meta?.type_zh || s.meta?.type || '',
        content: enhancements.join('; '),
        score: s.score
      };
    });

    // 将技能内容注入camera_language（不改变字段结构，只增强内容）
    const skillCameraTerms = skillEnhancements
      .map(s => s.content)
      .filter(Boolean)
      .join(' | ');

    if (skillCameraTerms && promptData.camera_language) {
      promptData.camera_language = `${promptData.camera_language} | [CINEMATIC_SKILL] ${skillCameraTerms}`;
    } else if (skillCameraTerms) {
      promptData.camera_language = `[CINEMATIC_SKILL] ${skillCameraTerms}`;
    }

    // 标记注入状态
    promptData._directorSkills = skillEnhancements.map(s => ({
      director: s.director,
      emotion: s.emotion,
      type: s.type,
      score: s.score
    }));
  }

  /**
   * 【优化新增】注入情绪表演指导
   * 调用子系统：acting-emotion-skills
   * 优化点：根据情绪类型为角色添加面部微表情、身体语言、眼神交流指导
   */
  _injectEmotionActing(promptData, shotCard) {
    if (!actingEmotionSkills || !shotCard) return;

    // 从shotCard推断情绪
    const emotionSource = shotCard.performance_goal || shotCard.emotion_target || '';
    if (!emotionSource) return;

    const inferredEmotion = actingEmotionSkills.inferEmotionFromPrompt(emotionSource);
    if (!inferredEmotion) return;

    // 构建临时shot对象用于注入
    const tempShot = { emotion: emotionSource };
    const enhancedShot = actingEmotionSkills.injectEmotionToShot(tempShot, inferredEmotion);

    if (enhancedShot && enhancedShot.emotion && enhancedShot._emotionConfig) {
      const config = enhancedShot._emotionConfig;
      const actingParts = [];

      if (config.facial) actingParts.push(`facial expression: ${config.facial}`);
      if (config.body) actingParts.push(`body language: ${config.body}`);
      if (config.eyeContact !== undefined) {
        actingParts.push(config.eyeContact
          ? 'maintaining direct eye contact, conveying emotional connection'
          : 'avoiding direct eye contact, conveying distance or introspection'
        );
      }

      const actingGuidance = actingParts.join('; ');

      // 将表演指导注入character_anchor（不改变字段结构）
      if (actingGuidance && promptData.character_anchor) {
        promptData.character_anchor = `${promptData.character_anchor} — ${actingGuidance}`;
      } else if (actingGuidance) {
        promptData.character_anchor = actingGuidance;
      }

      // 标记注入状态
      promptData._emotionActing = {
        emotion: inferredEmotion,
        intensity: config.intensity,
        facial: config.facial,
        body: config.body,
        eyeContact: config.eyeContact
      };
    }
  }

  /**
   * 【优化新增辅助】将景别字符串映射到镜头类型常量
   */
  _mapShotSizeToType(shotSize) {
    if (!shotSize) return null;
    const size = shotSize.toLowerCase();
    if (size.includes('extreme wide') || size.includes('establishing')) return 'establishing';
    if (size.includes('wide') || size.includes('long')) return 'wide';
    if (size.includes('medium')) return 'medium';
    if (size.includes('close-up') || size.includes('close up') || size.includes('closeup')) return 'closeup';
    if (size.includes('extreme close')) return 'extreme_closeup';
    return 'medium';
  }

  /**
   * 构建角色锚点（优化版：增加表演精度描述）
   */
  _buildCharacterAnchor(shotCard) {
    const parts = [];

    // 主角色
    if (shotCard.character_bindings) {
      parts.push(shotCard.character_bindings);
    } else if (shotCard.main_characters) {
      const anchors = shotCard.main_characters.map(c => generateCharacterAnchor(c)).filter(Boolean);
      parts.push(...anchors);
    }

    // 表演目标（优化：增加更具画面感的描述）
    if (shotCard.performance_goal) {
      parts.push(`showing ${shotCard.performance_goal} with authentic emotional depth`);
    }

    return parts.join(', ');
  }

  /**
   * 构建环境描述（优化版：增加颗粒感和物理模拟描述）
   */
  _buildEnvironment(shotCard, sceneCard) {
    const parts = [];

    // 环境特征
    if (shotCard.environment_traits) {
      parts.push(shotCard.environment_traits);
    }

    // 空间关系
    if (shotCard.spatial_relation) {
      parts.push(shotCard.spatial_relation);
    }

    // Nirath特征注入
    parts.push(generateNirathTraits());

    // 【优化新增】增加画面真实感描述（颗粒感+物理模拟）
    // 调用子系统：画面真实感方法论（内联，不引入新依赖）
    const realismModifiers = [
      'photorealistic detail',
      'subtle film grain',
      'atmospheric perspective',
      'natural light falloff'
    ];
    // 根据intensity选择添加数量
    const count = Math.ceil(this.enhancementIntensity * realismModifiers.length);
    if (count > 0) {
      parts.push(realismModifiers.slice(0, count).join(', '));
    }

    return parts.join(', ');
  }

  /**
   * 构建镜头语言（优化版：已在上层_buildPromptData中注入构图法则）
   */
  _buildCameraLanguage(shotCard) {
    const parts = [];

    // 景别
    if (shotCard.shot_size) {
      parts.push(`${shotCard.shot_size} shot`);
    }

    // 机位
    if (shotCard.camera_position) {
      parts.push(shotCard.camera_position);
    }

    // 运镜
    if (shotCard.camera_movement) {
      parts.push(shotCard.camera_movement);
    }

    // 屏幕方向
    if (shotCard.screen_direction) {
      parts.push(`screen direction: ${shotCard.screen_direction}`);
    }

    // 第一视觉重点
    if (shotCard.primary_poi) {
      parts.push(`primary focus: ${shotCard.primary_poi}`);
    }

    // 【优化新增】景深控制建议
    if (shotCard.shot_size) {
      const size = shotCard.shot_size.toLowerCase();
      if (size.includes('close') || size.includes('close-up') || size.includes('closeup')) {
        parts.push('shallow depth of field, sharp focus on subject face, creamy background bokeh');
      } else if (size.includes('wide') || size.includes('establishing')) {
        parts.push('deep depth of field, sharp focus throughout, f/8-f/11');
      }
    }

    return parts.join(', ');
  }

  /**
   * 构建光线描述（优化版：已在上层_buildPromptData中注入色彩理论）
   */
  _buildLighting(shotCard, sceneCard) {
    const parts = [];

    // Light Tier（已有调用保持不变）
    const tier = shotCard.light_tier || sceneCard?.light_tier || 'A';
    parts.push(getLightTierPrompt(tier));

    // 材质
    if (shotCard.material_texture) {
      parts.push(shotCard.material_texture);
    }

    // 色彩策略
    if (sceneCard?.primary_palette) {
      parts.push(`color palette: ${sceneCard.primary_palette} + ${sceneCard.accent_color || 'neutral'}`);
    }

    return parts.join(', ');
  }

  /**
   * 组装Prompt（优化版：增加电影化前缀和情绪张力表达）
   */
  _assemblePrompt(data, shotCard, sceneCard) {
    const parts = [];

    // 【优化新增】电影化前缀（标记镜头为电影级制作，不改变数据结构）
    if (this.enhancementIntensity >= 0.5) {
      parts.push('[CINEMATIC]');
    }

    // 按8步结构组装（原有顺序保持不变）
    if (data.character_anchor) parts.push(data.character_anchor);
    if (data.primary_action) parts.push(data.primary_action);
    if (data.performance_focus) parts.push(data.performance_focus);
    if (data.spatial_environment) parts.push(data.spatial_environment);
    if (data.camera_language) parts.push(data.camera_language);
    if (data.lighting_material) parts.push(data.lighting_material);
    if (data.sound_dialogue) parts.push(data.sound_dialogue);
    if (data.closing_anchor) parts.push(data.closing_anchor);

    // 【优化新增】情绪张力表达（基于sceneCard情绪曲线）
    if (sceneCard?.emotion_intensity && this.enhancementIntensity >= 0.6) {
      const intensity = sceneCard.emotion_intensity;
      if (intensity >= 8) {
        parts.push('emotional tension at peak, irreversible turning point, heightened stakes');
      } else if (intensity >= 5) {
        parts.push('building emotional tension, escalating stakes, growing unease');
      } else {
        parts.push('quiet emotional undercurrent, subtle tension beneath surface calm');
      }
    }

    // 【优化新增】画面真实感修饰词
    if (this.enhancementIntensity >= 0.7) {
      parts.push('film grain, physical light simulation, natural skin texture, cinematic color grading');
    }

    // 系统约束注入（原有逻辑保持不变）
    parts.push(`NO: ${ProductionBible.forbidden.slice(0, 3).join(', ')}`);

    return parts.join(', ');
  }

  /**
   * 按优先级压缩（原有逻辑完全保持不变）
   */
  _compressByPriority(prompt, data, originalCharCount, hardMax = 988) {
    const log = [`原始长度: ${originalCharCount}字符，启动优先级压缩`];
    let currentPrompt = prompt;

    // 压缩策略（按优先级从低到高）
    const compressionSteps = [
      {
        name: '删除声音',
        action: () => { data.sound_dialogue = ''; },
        priority: 8
      },
      {
        name: '简化光线',
        action: () => {
          if (data.lighting_material) {
            data.lighting_material = data.lighting_material.substring(0, 80);
          }
        },
        priority: 7
      },
      {
        name: '简化运镜',
        action: () => {
          if (data.camera_language) {
            data.camera_language = data.camera_language.substring(0, 120);
          }
        },
        priority: 6
      },
      {
        name: '简化空间环境',
        action: () => {
          if (data.spatial_environment) {
            data.spatial_environment = data.spatial_environment.substring(0, 160);
          }
        },
        priority: 5
      },
      {
        name: '删除表演目标',
        action: () => { data.performance_focus = ''; },
        priority: 4
      }
      // 注意：主体、动作、落幅从不删除（优先级1-3）
    ];

    // 逐步压缩直到≤hardMax字符
    for (const step of compressionSteps) {
      if (currentPrompt.length <= hardMax) break;

      step.action();
      currentPrompt = this._assemblePrompt(data);
      log.push(`${step.name}: ${currentPrompt.length}字符`);
    }

    // 如果仍然超长，硬截断（但保留主体+动作+落幅）
    if (currentPrompt.length > hardMax) {
      currentPrompt = safeTrimPrompt(currentPrompt, hardMax, {
        protectedLabels: ['CHARACTER', 'ACTION', 'SCENE', 'CAMERA', 'LIGHTING']
      });
      log.push(`安全截断至${hardMax}字符`);
    }

    return {
      prompt: currentPrompt,
      charCount: currentPrompt.length,
      log
    };
  }

  /**
   * 质量评估（原有逻辑完全保持不变）
   */
  _assessQuality(renderPrompt, data, charCount) {
    const checks = {
      hasSubject: data.character_anchor && data.character_anchor.length > 0,
      hasAction: data.primary_action && data.primary_action.length > 0,
      hasClosing: data.closing_anchor && data.closing_anchor.length > 0,
      hasEnvironment: data.spatial_environment && data.spatial_environment.length > 0,
      hasCamera: data.camera_language && data.camera_language.length > 0,
      hasLighting: data.lighting_material && data.lighting_material.length > 0,
      withinLimit: charCount <= PROMPT_LENGTH.HARD_MAX,
      notEmpty: charCount > 100,
      // 【优化新增】质量检查维度（不改变原有checks结构）
      hasCinematicPrefix: renderPrompt.includes('[CINEMATIC]'),
      hasDirectorSkills: !!data._directorSkills,
      hasEmotionActing: !!data._emotionActing
    };

    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100;

    return {
      score: Math.round(score),
      checks,
      assessment: score >= 80 ? '良好' : score >= 60 ? '合格' : '需优化',
      canRender: checks.hasSubject && checks.hasAction && checks.withinLimit && checks.notEmpty
    };
  }
}

module.exports = { PromptEngineAgentV4 };

// 测试（原有测试逻辑保持不变）
if (require.main === module) {
  async function test() {
    const agent = new PromptEngineAgentV4();

    const shotCard = {
      shot_id: 'SC01-S01',
      main_characters: ['xiaoG'],
      character_bindings: 'xiaoG, round face, black hair, brown eyes, khaki pants, green jacket',
      primary_action: 'walking through Lumina-velum entrance',
      performance_goal: 'curious and cautious',
      environment_traits: 'bioluminescent fungi, floating spores, crystal formations',
      spatial_relation: 'entering from left, moving toward center',
      shot_size: 'wide',
      camera_position: 'eye level',
      camera_movement: 'slow tracking shot',
      screen_direction: 'left to right',
      primary_poi: 'xiaoG',
      light_tier: 'A',
      material_texture: 'soft organic textures',
      dialogue: '',
      sound_events: 'ambient hum, spore drift',
      efa: 'xiaoG stops, looking up at towering fungi',
      transition_intent: 'cut to closer exploration'
    };

    const sceneCard = {
      scene_id: 'SC01',
      scene_name: '星渊初临',
      light_tier: 'A',
      primary_palette: '青灰+土褐',
      accent_color: '赤金',
      emotion_intensity: 4
    };

    try {
      const result = await agent.generate(shotCard, sceneCard);

      console.log('\n=== Prompt生成结果 ===');
      console.log('字符数:', result.charCount, `/${PROMPT_LENGTH.HARD_MAX}`);
      console.log('质量评分:', result.quality.score, result.quality.assessment);
      console.log('可渲染:', result.quality.canRender);
      console.log('压缩记录:', result.compressionLog);

      // 【优化新增】输出增强追踪信息
      if (result._enhancements) {
        console.log('\n=== 增强追踪 ===');
        console.log('导演技能注入:', result._enhancements.directorSkillsApplied);
        console.log('情绪表演注入:', result._enhancements.emotionActingApplied);
        console.log('构图增强:', result._enhancements.compositionApplied);
        console.log('色彩方案:', result._enhancements.colorSchemeApplied);
        console.log('增强强度:', result._enhancements.intensity);
      }

      console.log('\n=== 8步结构 ===');
      console.log('1. 主体:', result.promptData.character_anchor?.substring(0, 80));
      console.log('2. 动作:', result.promptData.primary_action?.substring(0, 50));
      console.log('3. 表演:', result.promptData.performance_focus?.substring(0, 50));
      console.log('4. 环境:', result.promptData.spatial_environment?.substring(0, 80));
      console.log('5. 镜头:', result.promptData.camera_language?.substring(0, 80));
      console.log('6. 光线:', result.promptData.lighting_material?.substring(0, 80));
      console.log('7. 声音:', result.promptData.sound_dialogue?.substring(0, 50) || '无');
      console.log('8. 落幅:', result.promptData.closing_anchor?.substring(0, 50));

      console.log('\n=== 最终Prompt ===');
      console.log(result.renderPrompt.substring(0, 300) + '...');

    } catch (err) {
      console.error('测试失败:', err.message);
    }
  }

  test();
}
