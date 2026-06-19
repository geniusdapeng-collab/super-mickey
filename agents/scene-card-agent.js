// agents/scene-card-agent.js
// Scene Card Agent / 场景卡生成Agent
// v4.1上游控制层：在Shot Card之前生成，控制整场次的视觉、情绪、光线策略

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { ProductionBible } = require('../systems/production-bible');
const { recommendLightTier } = require('../systems/light-tier');
const { ContinuityMode } = require('../systems/continuity-manager');
const fs = require('fs');
const path = require('path');

class SceneCardAgent {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/scene-card-template.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    this.sceneNumber = 0;
  }

  /**
   * 生成Scene Card
   * @param {Object} storyInput - 故事输入
   * @param {Object} options - 生成选项
   * @returns {Object} Scene Card数据
   */
  async generate(storyInput, options = {}) {
    this.sceneNumber++;
    const sceneId = `SC${String(this.sceneNumber).padStart(2, '0')}`;

    // 构建Scene Card Prompt
    const prompt = this._buildSceneCardPrompt(storyInput, sceneId, options);

    // 调用LLM生成
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
    
    // 保存Scene Card
    if (options.outputPath) {
      this._saveSceneCard(sceneCard, options.outputPath, sceneId);
    }

    return sceneCard;
  }

  /**
   * 构建Scene Card生成Prompt
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

    // 从Production Bible获取环境信息
    const envInfo = this._getEnvironmentInfo(location);
    
    // 推荐光线档位
    const recommendedLight = recommendLightTier(sceneName, emotionTarget);

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

请输出JSON：
`.trim();
  }

  /**
   * 获取环境信息
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
   * 丰富Scene Card数据
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
   * 保存Scene Card
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
   * 导演确认Scene Card
   * 只有确认后才能生成Shot Card
   */
  approve(sceneCard, directorNotes = '') {
    sceneCard.director_approval = true;
    sceneCard.approval_time = new Date().toISOString();
    sceneCard.director_notes = directorNotes;
    sceneCard.status = 'approved';
    
    return sceneCard;
  }

  /**
   * 验证Scene Card是否可进入Shot Card生成
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

// 测试
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
