# 卓越系统 (zhuoyue-system) - ENGINES 模块

> 导出时间: 2026-06-18T07:15:48.340Z

---

## engines/script-engine/core/adapter.js

> 文件大小: 11872 bytes

```javascript
// engines/script-engine/core/adapter.js
// Adapter - 将 ScriptBlueprint 转换为现有系统可消费的格式
// 版本：v1.0 | 日期：2026-06-07

const path = require('path');

class ScriptBlueprintAdapter {
  constructor(options = {}) {
    this.config = {
      charactersDir: options.charactersDir || path.join(__dirname, '../../../characters'),
      maxPromptLength: options.maxPromptLength || 980,
      ...options
    };
  }

  /**
   * 主入口：将 ScriptBlueprint 转换为现有 Pipeline 输入格式
   * @param {ScriptBlueprint} blueprint - 剧本蓝图
   * @returns {object} 现有系统可消费的格式
   */
  adapt(blueprint) {
    console.log(`[Adapter] 适配剧本: ${blueprint.meta.title}`);

    const result = {
      // 基础配置
      config: this._adaptConfig(blueprint),
      
      // 场景列表（对应现有 SC00~SC04）
      scenes: this._adaptScenes(blueprint),
      
      // 角色系统（对应现有 characters/）
      characters: this._adaptCharacters(blueprint),
      
      // 台词系统
      dialogues: this._adaptDialogues(blueprint),
      
      // 世界观设定
      worldSetting: this._adaptWorldSetting(blueprint),
      
      // 元数据
      metadata: {
        blueprint_id: blueprint.blueprint_id,
        version: blueprint.version,
        title: blueprint.meta.title,
        narrative_mode: blueprint.meta.narrative_mode,
        target_duration: blueprint.meta.target_duration,
        total_scenes: blueprint.structure.scenes.length
      }
    };

    console.log(`[Adapter] 适配完成: ${result.scenes.length} 场景, ${result.characters.length} 角色`);
    return result;
  }

  /**
   * 适配配置
   */
  _adaptConfig(blueprint) {
    return {
      title: blueprint.meta.title,
      narrative_mode: blueprint.meta.narrative_mode,
      target_duration: blueprint.meta.target_duration,
      world_setting: blueprint.world_setting?.world_id || 'default',
      featured_beast_id: blueprint.extensions?.nirath_extension?.featured_beast_id || null,
      protagonist: blueprint.character_system?.characters?.find(c => c.role === 'protagonist')?.character_id || 'xiaoG',
      
      // 约束配置
      constraints: {
        max_prompt_length: this.config.maxPromptLength,
        reference_image_count: 2,
        forbidden_elements: ['voiceover', 'metal_gloss', 'unnatural_eye_color']
      },
      
      // 视觉配置
      visual: {
        style: 'hyper-realistic cinematic',
        color_temperature: 'warm',
        lighting: 'cinematic',
        forbidden: ['dark', 'night', 'metal_gloss']
      }
    };
  }

  /**
   * 适配场景列表
   */
  _adaptScenes(blueprint) {
    return blueprint.structure.scenes.map((scene, index) => {
      const adaptedScene = {
        scene_id: scene.scene_id || `SC${String(index).padStart(2, '0')}`,
        scene_name: scene.scene_name || `场景${index + 1}`,
        scene_type: scene.scene_type || 'establishing',
        scene_function: scene.scene_function || 'establish',
        
        // 时序
        timing: {
          start: scene.timing?.start || 0,
          duration: scene.timing?.duration || 20,
          end: scene.timing?.end || 20
        },
        
        // 设定
        setting: scene.setting || '',
        visual_notes: scene.visual_notes || '',
        
        // 角色
        characters: scene.characters || [],
        
        // 对话
        dialogue: scene.dialogue || { has_dialogue: false, lines: [] },
        
        // 情感目标
        emotional_target: scene.emotional_target || { valence: 0, arousal: 0.5, dominance: 0.5 },
        
        // 视觉方向（为制作引擎准备）
        visual_direction: {
          shot_type: this._inferShotType(scene.scene_type),
          camera_movement: this._inferCameraMovement(scene.scene_type),
          lighting: this._inferLighting(scene.scene_type),
          color_temperature: this._inferColorTemperature(scene.emotional_target)
        }
      };

      // 生成镜头 Prompt 的基础文本（供制作引擎使用）
      adaptedScene.prompt_base = this._generatePromptBase(adaptedScene, blueprint);

      return adaptedScene;
    });
  }

  /**
   * 推断镜头类型
   */
  _inferShotType(sceneType) {
    const shotMap = {
      'opening': 'wide',
      'establishing': 'medium',
      'conflict': 'close_up',
      'emotional_climax': 'extreme_close_up',
      'resolution': 'medium'
    };
    return shotMap[sceneType] || 'medium';
  }

  /**
   * 推断运镜方式
   */
  _inferCameraMovement(sceneType) {
    const movementMap = {
      'opening': '缓慢推进',
      'establishing': '稳定机位',
      'conflict': '手持晃动',
      'emotional_climax': '快速推近',
      'resolution': '缓慢后拉'
    };
    return movementMap[sceneType] || '稳定机位';
  }

  /**
   * 推断布光
   */
  _inferLighting(sceneType) {
    const lightingMap = {
      'opening': '自然光+环境光',
      'establishing': '均匀明亮',
      'conflict': '戏剧性明暗对比',
      'emotional_climax': '伦勃朗光',
      'resolution': '温暖柔光'
    };
    return lightingMap[sceneType] || '均匀明亮';
  }

  /**
   * 推断色温
   */
  _inferColorTemperature(emotionalTarget) {
    if (!emotionalTarget) return 'neutral';
    
    const valence = emotionalTarget.valence || 0;
    if (valence > 0.5) return 'warm';
    if (valence < -0.3) return 'cool';
    return 'neutral';
  }

  /**
   * 生成 Prompt 基础文本
   */
  _generatePromptBase(scene, blueprint) {
    const parts = [];
    
    // 1. 场景类型和风格
    parts.push(`电影级${scene.scene_function === 'climax' ? '高潮' : ''}镜头`);
    parts.push('超写实');
    
    // 2. 世界观
    if (blueprint.world_setting?.world_id === 'nirath') {
      parts.push('Nirath星球');
    }
    
    // 3. 设定
    if (scene.setting) {
      parts.push(scene.setting);
    }
    
    // 4. 角色
    if (scene.characters && scene.characters.length > 0) {
      const characterDescs = scene.characters.map(cid => {
        const char = blueprint.character_system?.characters?.find(c => c.character_id === cid);
        if (char) {
          return `${char.name}（${char.visual_anchor?.core_features?.join('、') || ''}）`;
        }
        return cid;
      });
      parts.push(characterDescs.join('，'));
    }
    
    // 5. 视觉方向
    if (scene.visual_direction) {
      parts.push(`${scene.visual_direction.shot_type}，${scene.visual_direction.camera_movement}`);
    }
    
    // 6. 对话提示（如果有）
    if (scene.dialogue?.has_dialogue && scene.dialogue.lines?.length > 0) {
      const line = scene.dialogue.lines[0];
      parts.push(`台词：「${line.text}」`);
    }
    
    return parts.join('，');
  }

  /**
   * 适配角色系统
   */
  _adaptCharacters(blueprint) {
    return (blueprint.character_system?.characters || []).map(char => {
      const adapted = {
        character_id: char.character_id,
        name: char.name,
        role: char.role,
        
        // 视觉锚点
        visual_anchor: {
          core_features: char.visual_anchor?.core_features || [],
          reference_images: char.visual_anchor?.reference_images || []
        },
        
        // 定妆照路径
        portraits: this._resolvePortraitPaths(char.character_id, char.visual_anchor?.reference_images)
      };

      return adapted;
    });
  }

  /**
   * 解析定妆照路径
   */
  _resolvePortraitPaths(characterId, referenceImages) {
    const paths = {};
    
    if (referenceImages && referenceImages.length > 0) {
      for (const imgPath of referenceImages) {
        const angle = this._extractAngleFromPath(imgPath);
        if (angle) {
          paths[angle] = imgPath;
        }
      }
    }
    
    // 如果没有提供路径，尝试默认路径
    if (Object.keys(paths).length === 0) {
      const defaultAngles = ['front', 'threeQuarter', 'closeup', 'side'];
      const charDir = characterId === 'taotie' ? 'tao-tie' : characterId;
      
      for (const angle of defaultAngles) {
        const defaultPath = path.join(this.config.charactersDir, charDir, `${angle}.jpg`);
        if (require('fs').existsSync(defaultPath)) {
          paths[angle] = defaultPath;
        }
      }
    }
    
    return paths;
  }

  /**
   * 从路径提取角度
   */
  _extractAngleFromPath(imgPath) {
    const basename = path.basename(imgPath, path.extname(imgPath));
    const angleMap = {
      'front': 'front',
      'threeQuarter': 'threeQuarter',
      'three_quarter': 'threeQuarter',
      'closeup': 'closeup',
      'side': 'side',
      'side_profile': 'side'
    };
    return angleMap[basename] || basename;
  }

  /**
   * 适配台词系统
   */
  _adaptDialogues(blueprint) {
    const dialogues = [];
    
    for (const scene of blueprint.structure.scenes || []) {
      if (scene.dialogue?.has_dialogue && scene.dialogue.lines) {
        for (const line of scene.dialogue.lines) {
          dialogues.push({
            scene_id: scene.scene_id,
            speaker: line.speaker,
            text: line.text,
            emotion: line.emotion || 'neutral',
            timing: {
              start: scene.timing?.start || 0,
              duration: scene.timing?.duration || 20
            }
          });
        }
      }
    }
    
    return dialogues;
  }

  /**
   * 适配世界观设定
   */
  _adaptWorldSetting(blueprint) {
    const ws = blueprint.world_setting;
    if (!ws) return null;
    
    return {
      world_id: ws.world_id,
      world_name: ws.world_name,
      era: ws.era,
      core_rules: ws.core_rules || [],
      environment_tags: ws.environment_tags || [],
      visual_constraints: {
        must_have: ws.world_id === 'nirath' ? [
          '明亮多色彩强质感',
          '超写实风格',
          'Nirath环境特征'
        ] : [],
        forbidden: [
          '暗黑风格',
          '夜晚场景',
          '金属光泽',
          '人物眼睛非自然色'
        ]
      }
    };
  }

  /**
   * 生成适配报告
   */
  generateReport(adaptedData) {
    return {
      blueprint_id: adaptedData.metadata.blueprint_id,
      adaptation_status: 'success',
      scenes_count: adaptedData.scenes.length,
      characters_count: adaptedData.characters.length,
      dialogues_count: adaptedData.dialogues.length,
      total_duration: adaptedData.scenes.reduce((sum, s) => sum + s.timing.duration, 0),
      warnings: this._generateWarnings(adaptedData),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成警告信息
   */
  _generateWarnings(adaptedData) {
    const warnings = [];
    
    // 检查场景时长
    const totalDuration = adaptedData.scenes.reduce((sum, s) => sum + s.timing.duration, 0);
    if (totalDuration !== adaptedData.metadata.target_duration) {
      warnings.push({
        type: 'duration_mismatch',
        message: `总时长 ${totalDuration}s 不等于目标时长 ${adaptedData.metadata.target_duration}s`,
        severity: 'warning'
      });
    }
    
    // 检查角色定妆照
    for (const char of adaptedData.characters) {
      const portraitCount = Object.keys(char.portraits || {}).length;
      if (portraitCount === 0) {
        warnings.push({
          type: 'missing_portraits',
          message: `角色 ${char.name} 没有定妆照`,
          severity: 'warning'
        });
      }
    }
    
    // 检查台词
    const scenesWithDialogue = adaptedData.scenes.filter(s => s.dialogue?.has_dialogue).length;
    if (scenesWithDialogue === 0) {
      warnings.push({
        type: 'no_dialogue',
        message: '没有场景包含台词',
        severity: 'critical'
      });
    }
    
    return warnings;
  }
}

module.exports = { ScriptBlueprintAdapter };

```

---

## engines/script-engine/core/intent-parser.js

> 文件大小: 8187 bytes

```javascript
// engines/script-engine/core/intent-parser.js
// Intent Parser - 解析用户意图，识别叙事模式，提取元数据
// 版本：v1.0 | 日期：2026-06-07

class IntentParser {
  constructor(options = {}) {
    this.config = {
      // 快速分类器：关键词匹配
      keywordDict: {
        dramatic: ['短剧', '剧情', '故事', '角色', '冲突', '反转', '结局', '情感', '感动', '逆袭', '人设', '剧本', '台词', '山海经', 'Nirath'],
        educational: ['科普', '讲解', '知识', '教程', '学会', '原理', '什么是', '如何', '为什么'],
        documentary: ['纪录片', '纪实', '采访', '真实', '调查', '记录'],
        lifelog: ['家庭', '聚会', '旅行', '回忆', 'Vlog', '日常', '记录生活'],
        commercial: ['广告', '品牌', '营销', '推广', '产品', '转化', '带货', 'CTA']
      },
      // 混合模式信号
      hybridSignals: {
        '知识营销': { primary: 'educational', secondary: 'commercial', keywords: ['科普种草', '知识带货', '专业测评'] },
        '品牌叙事': { primary: 'dramatic', secondary: 'commercial', keywords: ['品牌故事', '情感广告', '微电影广告'] },
        '纪实营销': { primary: 'documentary', secondary: 'commercial', keywords: ['品牌纪录片', '真实故事广告'] },
        '科普短剧': { primary: 'educational', secondary: 'dramatic', keywords: ['剧情科普', '故事学习'] }
      },
      // Nirath 世界观检测
      nirathSignals: ['Nirath', 'nirath', '山海经', '异兽', '饕餮', '小G', '硅基', '碳化硅'],
      // 默认配置
      defaultMode: 'dramatic',
      confidenceThreshold: 0.85,
      ...options
    };
  }

  /**
   * 主入口：解析用户意图
   * @param {string} rawInput - 用户原始输入
   * @param {object} metadata - 附加元数据（如标题、时长等）
   * @returns {object} UserIntent 对象
   */
  parse(rawInput, metadata = {}) {
    const text = rawInput || '';
    
    // 第一层：快速分类器
    const fastResult = this._fastClassify(text);
    
    // 如果置信度足够高，直接返回
    if (fastResult.confidence >= 0.90) {
      return this._buildUserIntent(fastResult, metadata, 'fast_classifier', text);
    }

    // 第二层：深度分析（检测混合模式、Nirath世界观等）
    const deepResult = this._deepAnalysis(text, fastResult);
    
    return this._buildUserIntent(deepResult, metadata, 'deep_analysis', text);
  }

  /**
   * 快速分类器：基于关键词匹配
   */
  _fastClassify(text) {
    const scores = {};
    let totalMatches = 0;

    // 统计各类型关键词命中数
    for (const [type, keywords] of Object.entries(this.config.keywordDict)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matches++;
        }
      }
      scores[type] = matches;
      totalMatches += matches;
    }

    // 计算置信度
    let maxScore = 0;
    let primaryType = this.config.defaultMode;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryType = type;
      }
    }

    const confidence = totalMatches > 0 ? maxScore / totalMatches : 0;

    return {
      primary_type: primaryType,
      confidence: Math.min(confidence, 1.0),
      scores,
      layer: 'fast_classifier'
    };
  }

  /**
   * 深度分析：检测混合模式、世界观、元数据提取
   */
  _deepAnalysis(text, fastResult) {
    let result = { ...fastResult };

    // 检测混合模式
    const hybridMode = this._detectHybridMode(text);
    if (hybridMode) {
      result.primary_type = hybridMode.primary;
      result.secondary_type = hybridMode.secondary;
      result.hybrid_mode = hybridMode.name;
      result.confidence = 0.88; // 混合模式默认置信度
    }

    // 检测 Nirath 世界观
    const isNirath = this._detectNirath(text);
    if (isNirath) {
      result.world_setting = 'Nirath';
      result.nirath_signals = isNirath.matches;
    }

    // 提取时长信息
    const duration = this._extractDuration(text);
    if (duration) {
      result.target_duration = duration;
    }

    // 提取异兽 ID
    const beastId = this._extractBeastId(text);
    if (beastId) {
      result.featured_beast_id = beastId;
    }

    return result;
  }

  /**
   * 检测混合模式
   */
  _detectHybridMode(text) {
    for (const [name, config] of Object.entries(this.config.hybridSignals)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          return {
            name,
            primary: config.primary,
            secondary: config.secondary
          };
        }
      }
    }
    return null;
  }

  /**
   * 检测 Nirath 世界观
   */
  _detectNirath(text) {
    const matches = [];
    for (const signal of this.config.nirathSignals) {
      if (text.includes(signal)) {
        matches.push(signal);
      }
    }
    return matches.length > 0 ? { matches } : null;
  }

  /**
   * 提取时长（秒）
   */
  _extractDuration(text) {
    // 匹配 "120秒", "2分钟", "120s", "2min" 等
    const patterns = [
      /(\d+)\s*秒/,
      /(\d+)\s*分钟/,
      /(\d+)\s*s/i,
      /(\d+)\s*min/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let value = parseInt(match[1]);
        // 分钟转秒
        if (pattern.toString().includes('分钟') || pattern.toString().includes('min')) {
          value *= 60;
        }
        return value;
      }
    }
    return null;
  }

  /**
   * 提取异兽 ID
   */
  _extractBeastId(text) {
    const beastPatterns = {
      'taotie': ['饕餮', 'tao-tie', 'taotie'],
      'qilin': ['麒麟', 'qilin'],
      'fenghuang': ['凤凰', '凤凰', 'fenghuang'],
      'xiezhi': ['獬豸', 'xiezhi'],
      'bixie': ['辟邪', 'bixie']
    };

    for (const [id, keywords] of Object.entries(beastPatterns)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return id;
        }
      }
    }
    return null;
  }

  /**
   * 构建 UserIntent 对象
   */
  _buildUserIntent(analysis, metadata, layer, rawInput) {
    const isHybrid = !!analysis.hybrid_mode;
    
    return {
      intent_id: this._generateUUID(),
      raw_input: metadata.raw_input || rawInput || '',
      parsed: {
        narrative_mode: isHybrid ? 'hybrid' : analysis.primary_type,
        primary_mode: analysis.primary_type,
        secondary_modes: analysis.secondary_type ? [analysis.secondary_type] : [],
        hybrid_config: isHybrid ? {
          mode_weights: { [analysis.primary_type]: 0.6, [analysis.secondary_type]: 0.4 },
          handover_points: ['climax', 'resolution'],
          hybrid_mode_name: analysis.hybrid_mode
        } : null
      },
      metadata: {
        title: metadata.title || '未命名项目',
        target_duration: analysis.target_duration || metadata.target_duration || 120,
        target_platform: metadata.target_platform || ['tiktok', 'bilibili'],
        language: metadata.language || 'zh-CN',
        style_tags: metadata.style_tags || ['hyper-realistic', 'cinematic', 'epic'],
        world_setting: analysis.world_setting || metadata.world_setting || 'default',
        featured_beast_id: analysis.featured_beast_id || metadata.featured_beast_id || null,
        protagonist: metadata.protagonist || 'xiaoG',
        ...metadata
      },
      constraints: {
        max_prompt_length: metadata.max_prompt_length || 980,
        reference_image_count: metadata.reference_image_count || 2,
        forbidden_elements: metadata.forbidden_elements || ['voiceover', 'metal_gloss', 'unnatural_eye_color']
      },
      analysis: {
        layer,
        confidence: analysis.confidence,
        scores: analysis.scores
      }
    };
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = { IntentParser };

```

---

## engines/script-engine/core/script-blueprint.js

> 文件大小: 4595 bytes

```javascript
// engines/script-engine/core/script-blueprint.js
// ScriptBlueprint 数据模型 - 系统的"单一真相源"
// 版本：v1.0 | 日期：2026-06-07

class ScriptBlueprint {
  constructor(data = {}) {
    this.blueprint_id = data.blueprint_id || this._generateUUID();
    this.version = data.version || '1.0.0';
    this.intent_ref = data.intent_ref || null;

    this.meta = {
      title: data.meta?.title || 'Untitled',
      narrative_mode: data.meta?.narrative_mode || 'dramatic',
      target_duration: data.meta?.target_duration || 120,
      acts_count: data.meta?.acts_count || 3,
      scenes_count: data.meta?.scenes_count || 5,
      ...data.meta
    };

    this.structure = {
      acts: data.structure?.acts || [],
      scenes: data.structure?.scenes || []
    };

    this.character_system = {
      characters: data.character_system?.characters || []
    };

    this.voice_system = {
      global_voice_policy: data.voice_system?.global_voice_policy || 'dialogue_only_no_voiceover',
      voice_profiles: data.voice_system?.voice_profiles || []
    };

    this.world_setting = {
      world_id: data.world_setting?.world_id || 'default',
      world_name: data.world_setting?.world_name || 'Default World',
      era: data.world_setting?.era || 'modern',
      core_rules: data.world_setting?.core_rules || [],
      environment_tags: data.world_setting?.environment_tags || []
    };

    this.extensions = {
      dramatic_extension: data.extensions?.dramatic_extension || {},
      nirath_extension: data.extensions?.nirath_extension || {},
      ...data.extensions
    };

    this.quality_report = {
      evaluator: data.quality_report?.evaluator || 'DramaBench',
      scores: data.quality_report?.scores || {},
      passed: data.quality_report?.passed || false
    };
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 获取指定场景
  getScene(sceneId) {
    return this.structure.scenes.find(s => s.scene_id === sceneId);
  }

  // 获取指定角色
  getCharacter(characterId) {
    return this.character_system.characters.find(c => c.character_id === characterId);
  }

  // 获取所有包含对话的场景
  getScenesWithDialogue() {
    return this.structure.scenes.filter(s => s.dialogue?.has_dialogue);
  }

  // 获取指定幕的所有场景
  getScenesByAct(actId) {
    return this.structure.scenes.filter(s => s.act_id === actId);
  }

  // 获取剧本总时长
  getTotalDuration() {
    return this.structure.scenes.reduce((sum, s) => sum + (s.timing?.duration || 0), 0);
  }

  // 验证剧本完整性
  validate() {
    const errors = [];

    if (!this.meta.title) errors.push('Missing title');
    if (!this.meta.narrative_mode) errors.push('Missing narrative_mode');
    if (!this.structure.acts.length) errors.push('No acts defined');
    if (!this.structure.scenes.length) errors.push('No scenes defined');

    // 验证场景完整性
    this.structure.scenes.forEach((scene, idx) => {
      if (!scene.scene_id) errors.push(`Scene ${idx}: Missing scene_id`);
      if (!scene.scene_type) errors.push(`Scene ${scene.scene_id || idx}: Missing scene_type`);
      if (!scene.timing) errors.push(`Scene ${scene.scene_id || idx}: Missing timing`);
    });

    // 验证角色一致性
    const characterIds = this.character_system.characters.map(c => c.character_id);
    this.structure.scenes.forEach(scene => {
      if (scene.characters) {
        scene.characters.forEach(cid => {
          if (!characterIds.includes(cid)) {
            errors.push(`Scene ${scene.scene_id}: Character ${cid} not defined`);
          }
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 导出为 JSON
  toJSON() {
    return JSON.stringify({
      blueprint_id: this.blueprint_id,
      version: this.version,
      intent_ref: this.intent_ref,
      meta: this.meta,
      structure: this.structure,
      character_system: this.character_system,
      voice_system: this.voice_system,
      world_setting: this.world_setting,
      extensions: this.extensions,
      quality_report: this.quality_report
    }, null, 2);
  }

  // 从 JSON 导入
  static fromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    return new ScriptBlueprint(data);
  }

  // 创建副本
  clone() {
    return new ScriptBlueprint(JSON.parse(this.toJSON()));
  }
}

module.exports = { ScriptBlueprint };

```

---

## engines/script-engine/core/script-generator.js

> 文件大小: 12110 bytes

```javascript
// engines/script-engine/core/script-generator.js
// Script Generator - 调用 LLM 生成结构化剧本
// 版本：v1.0 | 日期：2026-06-07

const fs = require('fs');
const path = require('path');
const { ScriptBlueprint } = require('./script-blueprint');

class ScriptGenerator {
  constructor(options = {}) {
    this.config = {
      llmEndpoint: options.llmEndpoint || process.env.LLM_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      model: options.model || 'ep-20260518004622-jp46s', // 使用文本模型
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
      promptTemplateDir: options.promptTemplateDir || path.join(__dirname, '../prompts'),
      templateDir: options.templateDir || path.join(__dirname, '../templates'),
      timeout: options.timeout || 180000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
  }

  /**
   * 主入口：生成剧本
   * @param {object} userIntent - 用户意图对象
   * @param {object} templateData - 模板数据（可选）
   * @returns {ScriptBlueprint} 生成的剧本蓝图
   */
  async generate(userIntent, templateData = null) {
    console.log(`[ScriptGenerator] 开始生成剧本: ${userIntent.metadata?.title}`);

    // 1. 加载模板
    const template = templateData || await this._loadTemplate(userIntent);

    // 2. 构建 LLM Prompt
    const prompt = this._buildGenerationPrompt(userIntent, template);

    // 3. 调用 LLM
    const llmResponse = await this._callLLM(prompt);

    // 4. 解析并构建 Blueprint
    const blueprint = this._parseLLMResponse(llmResponse, userIntent);

    console.log(`[ScriptGenerator] 剧本生成完成: ${blueprint.blueprint_id}, ${blueprint.structure.scenes.length} 场景`);
    return blueprint;
  }

  /**
   * 加载模板
   */
  async _loadTemplate(userIntent) {
    const mode = userIntent.parsed?.primary_mode || 'dramatic';
    const templatePath = path.join(this.config.templateDir, `${mode}-template.json`);

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      return JSON.parse(templateContent);
    } catch (err) {
      console.warn(`[ScriptGenerator] 模板加载失败: ${templatePath}, 使用默认模板`);
      return this._getDefaultTemplate();
    }
  }

  /**
   * 获取默认模板
   */
  _getDefaultTemplate() {
    return {
      structure: {
        acts: [
          { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', beats: [] },
          { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', beats: [] },
          { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', beats: [] }
        ]
      },
      default_scene_count: 5,
      default_duration_per_scene: 20
    };
  }

  /**
   * 构建 LLM 生成 Prompt
   */
  _buildGenerationPrompt(userIntent, template) {
    const meta = userIntent.metadata;
    const constraints = userIntent.constraints;
    const parsed = userIntent.parsed;

    const prompt = `你是一位顶级短视频编剧，专门为AI视频生成系统创作结构化剧本。

## 任务
为以下项目创作完整的结构化剧本，输出必须是严格的 JSON 格式。

## 项目信息
- 标题：${meta.title}
- 叙事类型：${parsed.primary_mode} ${parsed.hybrid_config ? '+ ' + parsed.secondary_modes.join(', ') : ''}
- 目标时长：${meta.target_duration}秒
- 世界观：${meta.world_setting}
${meta.featured_beast_id ? '- 主角异兽：' + meta.featured_beast_id : ''}
- 主角：${meta.protagonist}
- 平台：${meta.target_platform.join(', ')}
- 语言：${meta.language}

## 系统约束（不可违反）
1. 禁止旁白（Voiceover），只保留角色对话（Dialogue）
2. 每个场景必须有角色对话（台词）
3. 台词必须口语化，适合短视频节奏（每句不超过30字）
4. 场景时长分配：根据内容重要性、台词长度、视觉复杂度三维度分配
5. 总时长必须严格等于 ${meta.target_duration} 秒
6. 角色视觉锚点必须保持一致（定妆照引用）

## 剧本结构模板
采用三幕式结构：
${JSON.stringify(template.structure.acts, null, 2)}

## 世界观设定（Nirath）
- Nirath是地球前身，一个硅基与碳基生命共存的星球
- 《山海经》实为Nirath往事的记录
- 核心主题：记忆即存在
- 环境特征：硅晶草原、双月当空、等离子河流、晶体森林
- 禁止暗黑风格，要求明亮多色彩强质感

## 输出格式要求
你必须输出一个严格的 JSON 对象，符合以下 Schema：

\`\`\`json
{
  "meta": {
    "title": "标题",
    "narrative_mode": "dramatic",
    "target_duration": ${meta.target_duration},
    "acts_count": 3,
    "scenes_count": 场景数量
  },
  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "幕名称",
        "act_function": "establish|confront|resolve",
        "start_time": 0,
        "end_time": 幕结束秒数,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook|setup|rising|climax|resolution",
            "description": "节拍描述",
            "target_emotion": "wonder|tension|joy|sadness|awe"
          }
        ]
      }
    ],
    "scenes": [
      {
        "scene_id": "SC00",
        "scene_name": "场景名称",
        "scene_type": "opening|establishing|conflict|emotional_climax|resolution",
        "scene_function": "establish|advance|conflict|climax|resolve",
        "act_id": "ACT-1",
        "timing": {
          "start": 开始秒数,
          "duration": 持续秒数,
          "end": 结束秒数
        },
        "characters": ["角色ID"],
        "setting": "场景时空设定",
        "dialogue": {
          "has_dialogue": true,
          "lines": [
            {
              "speaker": "角色ID",
              "text": "台词内容（口语化，不超过30字）",
              "emotion": "情绪标签"
            }
          ]
        },
        "visual_notes": "视觉指导备注",
        "emotional_target": {
          "valence": 0.8,
          "arousal": 0.6,
          "dominance": 0.5
        }
      }
    ]
  },
  "character_system": {
    "characters": [
      {
        "character_id": "xiaoG",
        "name": "小G",
        "role": "protagonist",
        "voice_profile": {
          "persona": "角色人设描述",
          "tone": "语气标签",
          "speaking_style": "说话风格"
        },
        "visual_anchor": {
          "core_features": ["核心特征1", "核心特征2", "核心特征3"],
          "reference_images": ["定妆照路径"]
        }
      }
    ]
  },
  "voice_system": {
    "global_voice_policy": "dialogue_only_no_voiceover",
    "voice_profiles": [
      {
        "voice_id": "V-角色ID",
        "character_id": "角色ID",
        "role": "角色定位",
        "tone": "语气",
        "pace": "语速",
        "constraints": {
          "forbidden_words": ["禁用词"],
          "max_line_length": 30
        }
      }
    ]
  },
  "world_setting": {
    "world_id": "nirath",
    "world_name": "Nirath星球",
    "era": "上古纪元",
    "core_rules": ["规则1", "规则2"],
    "environment_tags": ["环境标签1", "环境标签2"]
  }
}
\`\`\`

## 关键要求
1. 场景数量建议 5-7 个，总时长严格等于 ${meta.target_duration} 秒
2. 片头场景（SC00）必须有角色出场 + 对话，建立世界观
3. 高潮场景必须包含情感张力和视觉冲击力
4. 结尾场景必须有角色成长/感悟 + 下集钩子
5. 每个场景的台词必须包含在场景中（不能旁白）
6. 场景时长分配示例：SC00=15s, SC01=25s, SC02=30s, SC03=30s, SC04=20s（总120s）

请直接输出 JSON，不要包含任何其他解释文字。`;

    return prompt;
  }

  /**
   * 调用 LLM API
   */
  async _callLLM(prompt) {
    const axios = require('axios');
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[ScriptGenerator] LLM 调用尝试 ${attempt}/${this.config.maxRetries}`);

        const response = await axios.post(
          this.config.llmEndpoint,
          {
            model: this.config.model,
            messages: [
              { role: 'system', content: '你是一位专业的AI视频编剧，只输出严格格式的JSON。' },
              { role: 'user', content: prompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        );

        const content = response.data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('LLM 返回内容为空');
        }

        return content;

      } catch (error) {
        lastError = error;
        console.warn(`[ScriptGenerator] LLM 调用失败 (${attempt}/${this.config.maxRetries}): ${error.message}`);

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`LLM 调用失败，已重试 ${this.config.maxRetries} 次: ${lastError?.message}`);
  }

  /**
   * 解析 LLM 响应
   */
  _parseLLMResponse(response, userIntent) {
    try {
      // 清理响应中的 markdown 代码块标记
      let jsonStr = response;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      // 解析 JSON
      const parsed = JSON.parse(jsonStr);

      // 构建 Blueprint
      const blueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          ...parsed.meta,
          narrative_mode: userIntent.parsed?.narrative_mode || 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
        structure: parsed.structure,
        character_system: parsed.character_system,
        voice_system: parsed.voice_system,
        world_setting: parsed.world_setting,
        extensions: {
          dramatic_extension: parsed.dramatic_extension || {},
          nirath_extension: {
            featured_beast_id: userIntent.metadata?.featured_beast_id,
            memory_theme: '记忆即存在'
          }
        }
      });

      return blueprint;

    } catch (err) {
      console.error('[ScriptGenerator] JSON 解析失败:', err.message);
      console.error('[ScriptGenerator] 原始响应:', response.substring(0, 500));

      // 返回一个带有错误信息的 Blueprint
      const fallbackBlueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          title: userIntent.metadata?.title || '生成失败',
          narrative_mode: 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
        quality_report: {
          evaluator: 'Error',
          scores: { error: 0 },
          passed: false
        }
      });

      fallbackBlueprint._generation_error = {
        message: err.message,
        raw_response: response.substring(0, 1000)
      };

      return fallbackBlueprint;
    }
  }

  /**
   * 保存剧本到文件
   */
  async saveBlueprint(blueprint, outputPath) {
    const json = blueprint.toJSON();
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`[ScriptGenerator] 剧本已保存: ${outputPath}`);
    return outputPath;
  }

  /**
   * 从文件加载剧本
   */
  static loadBlueprint(filePath) {
    const json = fs.readFileSync(filePath, 'utf-8');
    return ScriptBlueprint.fromJSON(json);
  }
}

module.exports = { ScriptGenerator };

```

---

## engines/script-engine/core/script-validator.js

> 文件大小: 16543 bytes

```javascript
// engines/script-engine/core/script-validator.js
// Script Validator - 剧本校验与质量评估
// 版本：v1.0 | 日期：2026-06-07

class ScriptValidator {
  constructor(options = {}) {
    this.config = {
      // 时长约束
      minDuration: 15,
      maxDuration: 300,
      
      // 场景数量约束
      minScenes: 3,
      maxScenes: 10,
      
      // 台词约束
      maxLineLength: 30, // 字
      minScenesWithDialogue: 1,
      
      // 质量阈值
      qualityThresholds: {
        structural_integrity: 70,
        emotional_impact: 60,
        character_consistency: 80,
        dialogue_quality: 70,
        visual_feasibility: 60
      },
      
      // Nirath 约束
      nirathRequiredElements: ['Nirath', '硅', '双月', '晶体', '等离子'],
      forbiddenElements: ['旁白', 'voiceover', '解说', '金属光泽', 'unnatural_eye_color'],
      
      ...options
    };
  }

  /**
   * 主入口：完整校验剧本
   * @param {ScriptBlueprint} blueprint - 剧本蓝图
   * @returns {object} 校验报告
   */
  validate(blueprint) {
    const checks = [];
    
    // 1. 结构完整性检查
    const structuralChecks = this._checkStructure(blueprint);
    checks.push(...structuralChecks);
    
    // 2. 时长检查
    const durationChecks = this._checkDuration(blueprint);
    checks.push(...durationChecks);
    
    // 3. 台词检查
    const dialogueChecks = this._checkDialogue(blueprint);
    checks.push(...dialogueChecks);
    
    // 4. 角色一致性检查
    const characterChecks = this._checkCharacters(blueprint);
    checks.push(...characterChecks);
    
    // 5. Nirath 世界观检查（如果是 Nirath 世界观）
    if (blueprint.world_setting?.world_id === 'nirath') {
      const nirathChecks = this._checkNirathWorld(blueprint);
      checks.push(...nirathChecks);
    }
    
    // 6. 禁止元素检查
    const forbiddenChecks = this._checkForbiddenElements(blueprint);
    checks.push(...forbiddenChecks);
    
    // 7. 质量评分
    const scores = this._calculateScores(blueprint, checks);
    
    // 汇总
    const failedChecks = checks.filter(c => c.passed === false);
    const passed = failedChecks.length === 0 && scores.overall >= 60;
    
    return {
      blueprint_id: blueprint.blueprint_id,
      passed,
      overall_score: scores.overall,
      checks,
      scores: {
        detailed: scores.detailed,
        summary: scores.summary
      },
      issues: failedChecks.map(c => ({
        category: c.category,
        severity: c.severity,
        message: c.message,
        suggestion: c.suggestion
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 结构完整性检查
   */
  _checkStructure(blueprint) {
    const checks = [];
    const structure = blueprint.structure;
    
    // 检查幕结构
    checks.push({
      category: 'structure',
      name: 'acts_exist',
      passed: structure.acts && structure.acts.length > 0,
      severity: 'critical',
      message: structure.acts?.length ? `有 ${structure.acts.length} 幕` : '缺少幕结构',
      suggestion: '必须至少包含 1 幕'
    });
    
    // 检查场景数量
    const sceneCount = structure.scenes?.length || 0;
    checks.push({
      category: 'structure',
      name: 'scene_count',
      passed: sceneCount >= this.config.minScenes && sceneCount <= this.config.maxScenes,
      severity: 'critical',
      message: `有 ${sceneCount} 个场景`,
      suggestion: `场景数量应在 ${this.config.minScenes}-${this.config.maxScenes} 之间`
    });
    
    // 检查场景连续性
    let continuous = true;
    let lastEnd = 0;
    for (const scene of (structure.scenes || [])) {
      if (scene.timing) {
        if (Math.abs(scene.timing.start - lastEnd) > 1) {
          continuous = false;
        }
        lastEnd = scene.timing.end;
      }
    }
    checks.push({
      category: 'structure',
      name: 'scene_continuity',
      passed: continuous,
      severity: 'warning',
      message: continuous ? '场景时序连续' : '场景时序存在断层',
      suggestion: '确保场景时间轴连续无断层'
    });
    
    // 检查场景 ID 唯一性
    const sceneIds = (structure.scenes || []).map(s => s.scene_id);
    const uniqueIds = new Set(sceneIds);
    checks.push({
      category: 'structure',
      name: 'scene_id_unique',
      passed: sceneIds.length === uniqueIds.size,
      severity: 'critical',
      message: sceneIds.length === uniqueIds.size ? '场景 ID 唯一' : '存在重复场景 ID',
      suggestion: '确保每个场景 ID 唯一'
    });
    
    return checks;
  }

  /**
   * 时长检查
   */
  _checkDuration(blueprint) {
    const checks = [];
    const targetDuration = blueprint.meta?.target_duration || 120;
    const actualDuration = blueprint.getTotalDuration();
    
    checks.push({
      category: 'duration',
      name: 'total_duration_match',
      passed: Math.abs(actualDuration - targetDuration) <= 5,
      severity: 'critical',
      message: `目标时长 ${targetDuration}s, 实际时长 ${actualDuration}s`,
      suggestion: `总时长应与目标时长一致（误差≤5s）`
    });
    
    checks.push({
      category: 'duration',
      name: 'duration_in_range',
      passed: actualDuration >= this.config.minDuration && actualDuration <= this.config.maxDuration,
      severity: 'critical',
      message: `实际时长 ${actualDuration}s`,
      suggestion: `时长应在 ${this.config.minDuration}-${this.config.maxDuration}s 之间`
    });
    
    // 检查每个场景时长
    for (const scene of (blueprint.structure.scenes || [])) {
      if (scene.timing) {
        const duration = scene.timing.duration;
        checks.push({
          category: 'duration',
          name: `scene_${scene.scene_id}_duration`,
          passed: duration > 0 && duration <= 15,
          severity: 'warning',
          message: `场景 ${scene.scene_id} 时长 ${duration}s`,
          suggestion: '单个场景时长应在 1-60s 之间'
        });
      }
    }
    
    return checks;
  }

  /**
   * 台词检查
   */
  _checkDialogue(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    // 统计有台词的场景
    const scenesWithDialogue = scenes.filter(s => s.dialogue?.has_dialogue && s.dialogue?.lines?.length > 0);
    
    checks.push({
      category: 'dialogue',
      name: 'has_dialogue',
      passed: scenesWithDialogue.length >= this.config.minScenesWithDialogue,
      severity: 'critical',
      message: `${scenesWithDialogue.length}/${scenes.length} 场景有台词`,
      suggestion: '必须至少包含台词的场景'
    });
    
    // 检查台词长度
    let longLines = 0;
    for (const scene of scenes) {
      if (scene.dialogue?.lines) {
        for (const line of scene.dialogue.lines) {
          if (line.text && line.text.length > this.config.maxLineLength) {
            longLines++;
          }
        }
      }
    }
    
    checks.push({
      category: 'dialogue',
      name: 'line_length',
      passed: longLines === 0,
      severity: 'warning',
      message: longLines === 0 ? '所有台词长度合规' : `${longLines} 句台词超过 ${this.config.maxLineLength} 字`,
      suggestion: `台词每句不超过 ${this.config.maxLineLength} 字`
    });
    
    // 检查是否包含旁白（禁止）
    let hasVoiceover = false;
    for (const scene of scenes) {
      if (scene.voice_over?.text) {
        hasVoiceover = true;
        break;
      }
    }
    
    checks.push({
      category: 'dialogue',
      name: 'no_voiceover',
      passed: !hasVoiceover,
      severity: 'critical',
      message: hasVoiceover ? '检测到旁白（禁止）' : '无旁白，合规',
      suggestion: '全局禁止旁白，只保留角色对话'
    });
    
    return checks;
  }

  /**
   * 角色一致性检查
   */
  _checkCharacters(blueprint) {
    const checks = [];
    const characters = blueprint.character_system?.characters || [];
    const characterIds = characters.map(c => c.character_id);
    
    // 检查主角存在
    const hasProtagonist = characters.some(c => c.role === 'protagonist');
    checks.push({
      category: 'character',
      name: 'has_protagonist',
      passed: hasProtagonist,
      severity: 'critical',
      message: hasProtagonist ? '主角已定义' : '缺少主角定义',
      suggestion: '必须定义 protagonist 角色'
    });
    
    // 检查角色核心特征
    for (const character of characters) {
      if (character.visual_anchor?.core_features) {
        const featureCount = character.visual_anchor.core_features.length;
        checks.push({
          category: 'character',
          name: `character_${character.character_id}_features`,
          passed: featureCount >= 2 && featureCount <= 5,
          severity: 'warning',
          message: `角色 ${character.character_id} 有 ${featureCount} 个核心特征`,
          suggestion: '核心特征应在 2-5 个之间'
        });
      }
    }
    
    // 检查场景中引用的角色是否已定义
    for (const scene of (blueprint.structure.scenes || [])) {
      if (scene.characters) {
        for (const cid of scene.characters) {
          checks.push({
            category: 'character',
            name: `scene_${scene.scene_id}_character_${cid}`,
            passed: characterIds.includes(cid),
            severity: 'critical',
            message: characterIds.includes(cid) ? `角色 ${cid} 已定义` : `角色 ${cid} 未定义`,
            suggestion: '场景中引用的角色必须在 character_system 中定义'
          });
        }
      }
    }
    
    return checks;
  }

  /**
   * Nirath 世界观检查
   */
  _checkNirathWorld(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    // 检查是否包含 Nirath 环境元素
    let hasNirathElements = false;
    for (const scene of scenes) {
      if (scene.setting) {
        for (const element of this.config.nirathRequiredElements) {
          if (scene.setting.includes(element)) {
            hasNirathElements = true;
            break;
          }
        }
      }
      if (scene.visual_notes) {
        for (const element of this.config.nirathRequiredElements) {
          if (scene.visual_notes.includes(element)) {
            hasNirathElements = true;
            break;
          }
        }
      }
    }
    
    checks.push({
      category: 'nirath',
      name: 'nirath_elements',
      passed: hasNirathElements,
      severity: 'warning',
      message: hasNirathElements ? '包含 Nirath 环境元素' : '缺少 Nirath 环境元素',
      suggestion: `场景设定应包含 Nirath 特征元素：${this.config.nirathRequiredElements.join(', ')}`
    });
    
    // 检查是否违反明亮风格约束
    let hasDarkStyle = false;
    for (const scene of scenes) {
      if (scene.visual_notes) {
        const darkKeywords = ['暗黑', '黑暗', 'night', 'dark', '漆黑', '阴郁'];
        for (const keyword of darkKeywords) {
          if (scene.visual_notes.includes(keyword)) {
            hasDarkStyle = true;
            break;
          }
        }
      }
    }
    
    checks.push({
      category: 'nirath',
      name: 'bright_style',
      passed: !hasDarkStyle,
      severity: 'critical',
      message: hasDarkStyle ? '检测到暗黑风格（禁止）' : '明亮风格，合规',
      suggestion: 'Nirath 要求明亮多色彩强质感场景，禁止暗黑风格'
    });
    
    return checks;
  }

  /**
   * 禁止元素检查
   */
  _checkForbiddenElements(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    for (const forbidden of this.config.forbiddenElements) {
      let found = false;
      let location = '';
      
      for (const scene of scenes) {
        const allText = JSON.stringify(scene);
        if (allText.includes(forbidden)) {
          found = true;
          location = scene.scene_id;
          break;
        }
      }
      
      checks.push({
        category: 'forbidden',
        name: `forbidden_${forbidden}`,
        passed: !found,
        severity: 'critical',
        message: found ? `检测到禁用元素 "${forbidden}"（场景 ${location}）` : `无 "${forbidden}"`,
        suggestion: `全局禁止 "${forbidden}"`
      });
    }
    
    return checks;
  }

  /**
   * 计算质量评分
   */
  _calculateScores(blueprint, checks) {
    const detailed = {};
    
    // 结构完整性评分
    const structuralChecks = checks.filter(c => c.category === 'structure');
    const structuralPassed = structuralChecks.filter(c => c.passed).length;
    detailed.structural_integrity = Math.round((structuralPassed / structuralChecks.length) * 100) || 0;
    
    // 时长合规评分
    const durationChecks = checks.filter(c => c.category === 'duration');
    const durationPassed = durationChecks.filter(c => c.passed).length;
    detailed.duration_compliance = Math.round((durationPassed / durationChecks.length) * 100) || 0;
    
    // 台词质量评分
    const dialogueChecks = checks.filter(c => c.category === 'dialogue');
    const dialoguePassed = dialogueChecks.filter(c => c.passed).length;
    detailed.dialogue_quality = Math.round((dialoguePassed / dialogueChecks.length) * 100) || 0;
    
    // 角色一致性评分
    const characterChecks = checks.filter(c => c.category === 'character');
    const characterPassed = characterChecks.filter(c => c.passed).length;
    detailed.character_consistency = Math.round((characterPassed / characterChecks.length) * 100) || 0;
    
    // Nirath 世界观评分
    const nirathChecks = checks.filter(c => c.category === 'nirath');
    const nirathPassed = nirathChecks.filter(c => c.passed).length;
    detailed.nirath_compliance = nirathChecks.length > 0 ? Math.round((nirathPassed / nirathChecks.length) * 100) : 100;
    
    // 综合评分
    const overall = Math.round(
      (detailed.structural_integrity * 0.25 +
       detailed.duration_compliance * 0.20 +
       detailed.dialogue_quality * 0.25 +
       detailed.character_consistency * 0.20 +
       detailed.nirath_compliance * 0.10)
    );
    
    return {
      overall,
      detailed,
      summary: {
        total_checks: checks.length,
        passed_checks: checks.filter(c => c.passed).length,
        failed_checks: checks.filter(c => !c.passed).length,
        critical_issues: checks.filter(c => !c.passed && c.severity === 'critical').length
      }
    };
  }

  /**
   * 生成修复建议
   */
  generateRepairPlan(validationReport) {
    const issues = validationReport.issues || [];
    const repairs = [];
    
    for (const issue of issues) {
      switch (issue.category) {
        case 'structure':
          repairs.push({
            type: 'structure',
            action: 'adjust_structure',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'duration':
          repairs.push({
            type: 'duration',
            action: 'adjust_timing',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'dialogue':
          repairs.push({
            type: 'dialogue',
            action: 'rewrite_dialogue',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'character':
          repairs.push({
            type: 'character',
            action: 'add_character',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'nirath':
          repairs.push({
            type: 'world_setting',
            action: 'adjust_setting',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'forbidden':
          repairs.push({
            type: 'content',
            action: 'remove_forbidden',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
      }
    }
    
    return {
      blueprint_id: validationReport.blueprint_id,
      repairs,
      priority: issues.filter(i => i.severity === 'critical').length > 0 ? 'high' : 'medium'
    };
  }
}

module.exports = { ScriptValidator };

```

---

## engines/script-engine/extensions/nirath-extension.js

> 文件大小: 7818 bytes

```javascript
// engines/script-engine/extensions/nirath-extension.js
// Nirath World Extension - 世界观扩展模块
// 版本：v1.0 | 日期：2026-06-07

const NIRATH_WORLD = {
  world_id: 'nirath',
  world_name: 'Nirath星球',
  era: '上古纪元',
  
  // 核心设定
  core_rules: [
    'Nirath是地球前身，一个硅基与碳基生命共存的星球',
    '《山海经》实为Nirath往事的记录，异兽是硅基生命形态',
    '核心主题：记忆即存在，遗忘即消亡',
    '时间以"晶振"计量，1晶振 = 地球1天',
    '能量来源：等离子河流与双月光辉'
  ],
  
  // 环境特征
  environment: {
    terrain: ['硅晶草原', '晶体森林', '等离子河流', '碳硅山脉', '双月峡谷'],
    sky: '双月当空，紫蓝色天穹',
    light: '双月光晕提供柔和照明，等离子河流发出荧光',
    atmosphere: '充满硅微粒的稀薄大气，呼吸可见晶尘',
    gravity: '0.8G，比地球略轻'
  },
  
  // 生命形态
  lifeforms: {
    silicon_based: {
      description: '硅基生命，以晶体结构为骨骼，能量涡流为血液',
      examples: ['饕餮', '麒麟', '凤凰', '獬豸'],
      characteristics: ['碳化硅质甲壳', '等离子能量核心', '晶体复眼']
    },
    carbon_based: {
      description: '碳基生命，类似地球生物但更适应低重力',
      examples: ['Nirath先民', '探索者后裔'],
      characteristics: ['轻量化骨骼', '高氧代谢', '光敏皮肤']
    }
  },
  
  // 异兽档案模板
  beast_template: {
    beast_id: '',
    name: '',
    name_origin: 'Nirath古语',
    
    // 生物学特征
    biology: {
      skeleton: '碳化硅质晶体结构',
      energy_source: '等离子吸收',
      lifespan: '以晶振计',
      reproduction: '晶体分裂'
    },
    
    // 视觉锚点（核心特征，不可变）
    visual_anchor: {
      core_features: ['特征1', '特征2', '特征3'],
      color_palette: ['主色', '辅色', '高光色'],
      texture: '表面质感描述',
      scale: '体型比例（相对人类）'
    },
    
    // 行为特征
    behavior: {
      temperament: '性格描述',
      habitat: '栖息地',
      diet: '能量来源',
      social_structure: '社会结构'
    },
    
    // 叙事功能
    narrative_role: {
      archetype: '神话原型',
      symbolism: '象征意义',
      story_function: '在故事中的功能'
    }
  },
  
  // 视觉约束
  visual_constraints: {
    // 必须遵守
    must_have: [
      '明亮多色彩强质感',
      '超写实风格',
      '电影级光影',
      'Nirath环境特征（硅晶、双月、等离子）'
    ],
    
    // 禁止
    forbidden: [
      '暗黑风格',
      '夜晚场景',
      '金属光泽',
      '人物眼睛非自然色',
      '旁白/Voiceover'
    ],
    
    // 推荐
    recommended: [
      '黄金3秒开场',
      '每2-3秒转场或运镜切换',
      '多机位综合运动',
      'IMAX画幅感'
    ]
  },
  
  // 主角设定（小G）
  protagonist: {
    character_id: 'xiaoG',
    name: '小G',
    role: 'Nirath探索者',
    
    visual_anchor: {
      core_features: [
        '银灰装甲（Nirath探索者标准装备）',
        '东亚面孔短发年轻男性',
        '装甲表面有Nirath符文微光'
      ],
      color_palette: ['银灰', '深蓝', '等离子蓝'],
      texture: '哑光金属+能量纹路'
    },
    
    backstory: '来自地球的探索者，通过古老传送门抵达Nirath，',
    motivation: '记录Nirath的异兽与文明，证明"记忆即存在"',
    arc: '从旁观者到参与者，最终成为Nirath记忆守护者'
  }
};

// 异兽档案库
const BEAST_ARCHIVE = {
  taotie: {
    beast_id: 'taotie',
    name: '饕餮',
    name_origin: 'Nirath古语：吞噬者',
    
    biology: {
      skeleton: '碳化硅质晶体结构，六边形蜂窝状甲壳',
      energy_source: '吞噬等离子能量，体内转化为晶振储能',
      lifespan: '3000晶振',
      reproduction: '能量饱和后分裂出子体'
    },
    
    visual_anchor: {
      core_features: [
        '碳化硅质六边形蜂窝甲壳',
        '腋下双眼（非面部）',
        '巨口能量涡流（吞噬时的等离子旋涡）'
      ],
      color_palette: ['碳化硅黑', '等离子蓝', '能量金'],
      texture: '晶体磨砂质感，边缘发光',
      scale: '3倍人类体型'
    },
    
    behavior: {
      temperament: '贪婪但非恶意，本能驱动',
      habitat: '等离子河流交汇处',
      diet: '等离子能量，偶尔吞噬晶体矿物',
      social_structure: '独行者，领地意识极强'
    },
    
    narrative_role: {
      archetype: '贪婪之神',
      symbolism: '欲望与本能，但同时也是生存意志的象征',
      story_function: '迫使主角面对"欲望与节制"的主题'
    }
  }
};

class NirathExtension {
  constructor() {
    this.world = NIRATH_WORLD;
    this.beasts = BEAST_ARCHIVE;
  }

  /**
   * 获取世界观信息
   */
  getWorldInfo() {
    return this.world;
  }

  /**
   * 获取异兽档案
   */
  getBeastArchive(beastId) {
    return this.beasts[beastId] || null;
  }

  /**
   * 获取异兽视觉锚点
   */
  getBeastVisualAnchor(beastId) {
    const beast = this.beasts[beastId];
    if (!beast) return null;
    return beast.visual_anchor;
  }

  /**
   * 获取视觉约束
   */
  getVisualConstraints() {
    return this.world.visual_constraints;
  }

  /**
   * 获取主角设定
   */
  getProtagonist() {
    return this.world.protagonist;
  }

  /**
   * 验证场景是否符合 Nirath 世界观
   */
  validateScene(scene) {
    const issues = [];
    const constraints = this.world.visual_constraints;

    // 检查禁止元素
    const sceneText = JSON.stringify(scene);
    for (const forbidden of constraints.forbidden) {
      if (sceneText.includes(forbidden)) {
        issues.push({
          type: 'forbidden',
          message: `检测到禁止元素: ${forbidden}`,
          severity: 'critical'
        });
      }
    }

    // 检查是否包含 Nirath 环境特征
    let hasEnvironment = false;
    for (const terrain of this.world.environment.terrain) {
      if (sceneText.includes(terrain)) {
        hasEnvironment = true;
        break;
      }
    }
    if (!hasEnvironment) {
      issues.push({
        type: 'environment',
        message: '场景缺少 Nirath 环境特征',
        suggestion: `建议加入: ${this.world.environment.terrain.join(', ')}`,
        severity: 'warning'
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 生成场景设定文本
   */
  generateSceneSetting(baseSetting = '') {
    const env = this.world.environment;
    const elements = [
      env.sky,
      ...env.terrain,
      env.light
    ];
    
    // 随机选择 2-3 个环境元素
    const selected = this._shuffleArray(elements).slice(0, 2 + Math.floor(Math.random() * 2));
    
    return `${baseSetting}，${selected.join('，')}`;
  }

  /**
   * 生成角色视觉锚点文本
   */
  generateCharacterVisualAnchor(characterId) {
    if (characterId === 'xiaoG') {
      const protagonist = this.world.protagonist;
      return protagonist.visual_anchor.core_features.join('，');
    }
    
    const beast = this.beasts[characterId];
    if (beast) {
      return beast.visual_anchor.core_features.join('，');
    }
    
    return '';
  }

  _shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
}

module.exports = { NirathExtension, NIRATH_WORLD, BEAST_ARCHIVE };

```

---

## engines/script-engine/index.js

> 文件大小: 6699 bytes

```javascript
// engines/script-engine/index.js
// Script Engine - 剧本引擎入口
// 版本：v1.0 | 日期：2026-06-07

const { IntentParser } = require('./core/intent-parser');
const { ScriptBlueprint } = require('./core/script-blueprint');
const { ScriptGenerator } = require('./core/script-generator');
const { ScriptValidator } = require('./core/script-validator');
const { ScriptBlueprintAdapter } = require('./core/adapter');
const { NirathExtension } = require('./extensions/nirath-extension');

class ScriptEngine {
  constructor(options = {}) {
    this.intentParser = new IntentParser(options.intentParser);
    this.scriptGenerator = new ScriptGenerator(options.scriptGenerator);
    this.scriptValidator = new ScriptValidator(options.scriptValidator);
    this.adapter = new ScriptBlueprintAdapter(options.adapter);
    this.nirathExtension = new NirathExtension();
    
    this.version = '1.0.0';
  }

  /**
   * 主入口：从用户意图到适配后的剧本
   * @param {string} rawInput - 用户原始输入
   * @param {object} metadata - 附加元数据
   * @returns {object} { blueprint, adapted, validation, report }
   */
  async process(rawInput, metadata = {}) {
    console.log(`[ScriptEngine v${this.version}] 开始处理: ${metadata.title || '未命名'}`);

    // 1. 解析意图
    const userIntent = this.intentParser.parse(rawInput, metadata);
    console.log(`[ScriptEngine] 意图解析完成: ${userIntent.parsed.primary_mode}`);

    // 2. 生成剧本（需要 LLM）
    let blueprint;
    if (this.scriptGenerator.config.apiKey) {
      blueprint = await this.scriptGenerator.generate(userIntent);
    } else {
      console.log('[ScriptEngine] 无 API Key，使用模板生成');
      blueprint = this._generateFromTemplate(userIntent);
    }

    // 3. 校验剧本
    const validation = this.scriptValidator.validate(blueprint);
    console.log(`[ScriptEngine] 剧本校验: ${validation.passed ? '通过' : '失败'} (${validation.overall_score}分)`);

    // 4. 适配到现有系统格式
    const adapted = this.adapter.adapt(blueprint);
    const report = this.adapter.generateReport(adapted);

    // 5. 如果校验失败，生成修复计划
    let repairPlan = null;
    if (!validation.passed) {
      repairPlan = this.scriptValidator.generateRepairPlan(validation);
      console.log(`[ScriptEngine] 修复计划: ${repairPlan.repairs.length} 项`);
    }

    console.log(`[ScriptEngine] 处理完成: ${adapted.scenes.length} 场景, ${adapted.characters.length} 角色`);

    return {
      userIntent,
      blueprint,
      validation,
      adapted,
      report,
      repairPlan
    };
  }

  /**
   * 从模板生成剧本（无需 LLM）
   */
  _generateFromTemplate(userIntent) {
    const meta = userIntent.metadata;
    const duration = meta.target_duration || 120;
    const sceneCount = 5;
    const sceneDuration = Math.floor(duration / sceneCount);

    const scenes = [];
    const sceneTypes = ['opening', 'establishing', 'conflict', 'emotional_climax', 'resolution'];
    const sceneNames = ['片头', '探索', '冲突', '高潮', '结尾'];
    const settings = [
      'Nirath硅晶草原，双月当空',
      '晶体森林深处，荧光闪烁',
      '等离子河流旁，硅晶岩石',
      '等离子河流交汇处，能量风暴',
      '硅晶草原，双月落下'
    ];

    for (let i = 0; i < sceneCount; i++) {
      const start = i * sceneDuration;
      const end = (i === sceneCount - 1) ? duration : start + sceneDuration;
      
      scenes.push({
        scene_id: `SC0${i}`,
        scene_name: sceneNames[i],
        scene_type: sceneTypes[i],
        scene_function: i === 0 ? 'establish' : i === 3 ? 'climax' : i === 4 ? 'resolve' : 'advance',
        act_id: i < 2 ? 'ACT-1' : i < 4 ? 'ACT-2' : 'ACT-3',
        timing: { start, duration: end - start, end },
        characters: ['xiaoG'],
        setting: settings[i],
        dialogue: {
          has_dialogue: true,
          lines: [{
            speaker: 'xiaoG',
            text: `场景${i + 1}的台词...`,
            emotion: 'neutral'
          }]
        }
      });
    }

    return new ScriptBlueprint({
      intent_ref: userIntent.intent_id,
      meta: {
        title: meta.title,
        narrative_mode: userIntent.parsed?.primary_mode || 'dramatic',
        target_duration: duration,
        acts_count: 3,
        scenes_count: sceneCount
      },
      structure: {
        acts: [
          { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', start_time: 0, end_time: 40, beats: [] },
          { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', start_time: 40, end_time: 80, beats: [] },
          { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', start_time: 80, end_time: duration, beats: [] }
        ],
        scenes
      },
      character_system: {
        characters: [
          {
            character_id: 'xiaoG',
            name: '小G',
            role: 'protagonist',
            visual_anchor: {
              core_features: ['银灰装甲', '东亚面孔短发', '年轻男性'],
              reference_images: ['characters/xiaoG/front.jpg']
            }
          }
        ]
      },
      world_setting: {
        world_id: 'nirath',
        world_name: 'Nirath星球',
        era: '上古纪元',
        core_rules: ['Nirath是地球前身'],
        environment_tags: ['硅晶草原', '双月当空']
      }
    });
  }

  /**
   * 保存完整工作流结果
   */
  async saveResult(result, outputDir) {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 保存用户意图
    fs.writeFileSync(
      path.join(outputDir, `intent-${timestamp}.json`),
      JSON.stringify(result.userIntent, null, 2)
    );

    // 保存剧本蓝图
    fs.writeFileSync(
      path.join(outputDir, `blueprint-${timestamp}.json`),
      result.blueprint.toJSON()
    );

    // 保存校验报告
    fs.writeFileSync(
      path.join(outputDir, `validation-${timestamp}.json`),
      JSON.stringify(result.validation, null, 2)
    );

    // 保存适配结果
    fs.writeFileSync(
      path.join(outputDir, `adapted-${timestamp}.json`),
      JSON.stringify(result.adapted, null, 2)
    );

    console.log(`[ScriptEngine] 结果已保存到: ${outputDir}`);
    return outputDir;
  }
}

module.exports = {
  ScriptEngine,
  IntentParser,
  ScriptBlueprint,
  ScriptGenerator,
  ScriptValidator,
  ScriptBlueprintAdapter,
  NirathExtension
};

```

---

## engines/script-engine/templates/dramatic-template.json

> 文件大小: 5618 bytes

```javascript
{
  "$schema": "nirath://templates/dramatic/v1",
  "template_name": "三幕式戏剧结构",
  "template_version": "1.0.0",
  "description": "经典的戏剧性三幕结构，适用于故事片、短剧、情感叙事",
  
  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "第一幕：建立",
        "act_function": "establish",
        "description": "引入世界观、角色、核心冲突的种子",
        "typical_duration_ratio": 0.25,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook",
            "beat_name": "钩子",
            "description": "在3秒内抓住观众注意力",
            "function": "立即建立情绪张力或视觉奇观"
          },
          {
            "beat_id": "B-1.2",
            "beat_type": "setup",
            "beat_name": "设定",
            "description": "建立角色、世界、日常状态",
            "function": "让观众理解角色是谁，他们在哪里"
          },
          {
            "beat_id": "B-1.3",
            "beat_type": "inciting_incident",
            "beat_name": "激励事件",
            "description": "打破平衡的事件，推动角色行动",
            "function": "角色必须做出反应，无法回到日常"
          }
        ]
      },
      {
        "act_id": "ACT-2",
        "act_name": "第二幕：对抗",
        "act_function": "confront",
        "description": "冲突升级，角色面对障碍，情感深化",
        "typical_duration_ratio": 0.50,
        "beats": [
          {
            "beat_id": "B-2.1",
            "beat_type": "rising_action",
            "beat_name": "上升动作",
            "description": "冲突逐步升级，赌注增加",
            "function": "每一步都比上一步更难"
          },
          {
            "beat_id": "B-2.2",
            "beat_type": "midpoint",
            "beat_name": "中点",
            "description": "故事转折点，角色意识到真相或做出重大决定",
            "function": "从被动反应转为主动进攻"
          },
          {
            "beat_id": "B-2.3",
            "beat_type": "abyss",
            "beat_name": "深渊",
            "description": "最低谷，角色面临最大失败",
            "function": "看似一切希望都破灭"
          }
        ]
      },
      {
        "act_id": "ACT-3",
        "act_name": "第三幕：解决",
        "act_function": "resolve",
        "description": "高潮、角色转变、结局",
        "typical_duration_ratio": 0.25,
        "beats": [
          {
            "beat_id": "B-3.1",
            "beat_type": "climax",
            "beat_name": "高潮",
            "description": "最终对抗，核心冲突的解决",
            "function": "情感与视觉的双重峰值"
          },
          {
            "beat_id": "B-3.2",
            "beat_type": "transformation",
            "beat_name": "转变",
            "description": "角色完成内在成长",
            "function": "角色不是回到旧状态，而是进入新状态"
          },
          {
            "beat_id": "B-3.3",
            "beat_type": "resolution",
            "beat_name": "结局",
            "description": "收尾，余韵，下集钩子",
            "function": "给观众情感释放和期待"
          }
        ]
      }
    ]
  },
  
  "scene_types": {
    "opening": {
      "name": "片头",
      "function": "establish",
      "required_elements": ["角色出场", "世界观建立", "对话"],
      "typical_duration": 15,
      "visual_requirements": "电影级远景，超写实，环境特征标识"
    },
    "establishing": {
      "name": "建立场景",
      "function": "establish",
      "required_elements": ["角色状态", "环境细节"],
      "typical_duration": 20,
      "visual_requirements": "中景，展示角色与环境关系"
    },
    "conflict": {
      "name": "冲突场景",
      "function": "advance",
      "required_elements": ["对抗", "情感升级", "对话"],
      "typical_duration": 25,
      "visual_requirements": "特写+中景交替，运镜增强张力"
    },
    "emotional_climax": {
      "name": "情感高潮",
      "function": "climax",
      "required_elements": ["情感峰值", "角色转变", "对话"],
      "typical_duration": 30,
      "visual_requirements": "特写为主，光影戏剧性，运镜密集"
    },
    "resolution": {
      "name": "结局场景",
      "function": "resolve",
      "required_elements": ["角色成长", "余韵", "下集钩子"],
      "typical_duration": 20,
      "visual_requirements": "远景或中景，温暖色调，留白"
    }
  },
  
  "character_models": {
    "protagonist": {
      "role": "主角",
      "required_arcs": ["want", "need"],
      "arc_description": "Want = 外在目标，Need = 内在成长"
    },
    "antagonist": {
      "role": "对手/对立面",
      "required_arcs": ["motivation"],
      "arc_description": "必须有合理的动机，不是纯粹的恶"
    },
    "featured_beast": {
      "role": "异兽主角",
      "required_arcs": ["lore", "visual_anchor"],
      "arc_description": "必须有完整档案和视觉锚点"
    }
  },
  
  "dialogue_rules": {
    "max_line_length": 30,
    "style": "口语化，适合短视频节奏",
    "forbidden": ["旁白", "解说", "内心独白"],
    "required": ["对话", "情绪标签"]
  },
  
  "timing_rules": {
    "total_duration": 120,
    "scene_duration_range": [10, 40],
    "hook_duration": 3,
    "climax_duration_ratio": 0.25
  }
}

```

---

## engines/script-engine/tests/test-script-engine.js

> 文件大小: 12134 bytes

```javascript
// engines/script-engine/tests/test-script-engine.js
// 剧本引擎测试脚本 - 验证核心模块
// 运行: node engines/script-engine/tests/test-script-engine.js

const { IntentParser } = require('../core/intent-parser');
const { ScriptBlueprint } = require('../core/script-blueprint');
const { ScriptValidator } = require('../core/script-validator');
const { ScriptBlueprintAdapter } = require('../core/adapter');
const { NirathExtension } = require('../extensions/nirath-extension');

console.log('========================================');
console.log('  Script Engine 测试套件 v1.0');
console.log('========================================\n');

// 测试数据
const testIntents = [
  {
    name: 'Nirath 饕餮 EP01',
    raw: '创作山海经异兽志第一集，主角饕餮，120秒，Nirath星球，小G探索',
    metadata: {
      title: '山海经：异兽志 EP01 饕餮',
      target_duration: 120,
      world_setting: 'Nirath',
      featured_beast_id: 'taotie',
      protagonist: 'xiaoG'
    }
  },
  {
    name: '科普短剧',
    raw: '做一个剧情式科普视频，讲解量子力学，要有故事感',
    metadata: {
      title: '量子力学科普',
      target_duration: 180
    }
  }
];

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    results.passed++;
  } else {
    console.log(`  ❌ ${message}`);
    results.failed++;
  }
}

// ========== 测试 1: IntentParser ==========
console.log('\n📋 测试 1: IntentParser（意图解析）');
console.log('----------------------------------------');

const intentParser = new IntentParser();

for (const test of testIntents) {
  console.log(`\n  测试用例: ${test.name}`);
  const intent = intentParser.parse(test.raw, test.metadata);
  
  assert(intent.intent_id, '生成 intent_id');
  assert(intent.raw_input === test.raw, '保留原始输入');
  assert(intent.parsed.primary_mode, '识别主叙事模式');
  assert(intent.metadata.title === test.metadata.title, '保留元数据标题');
  assert(intent.metadata.target_duration === test.metadata.target_duration, '保留目标时长');
  
  if (test.metadata.world_setting === 'Nirath') {
    assert(intent.parsed.world_setting === 'Nirath' || intent.metadata.world_setting === 'Nirath', '识别 Nirath 世界观');
  }
  
  console.log(`  解析结果: ${intent.parsed.primary_mode} ${intent.parsed.hybrid_config ? '+ hybrid' : ''}`);
}

// ========== 测试 2: ScriptBlueprint ==========
console.log('\n📋 测试 2: ScriptBlueprint（数据模型）');
console.log('----------------------------------------');

const blueprint = new ScriptBlueprint({
  meta: {
    title: '测试剧本',
    narrative_mode: 'dramatic',
    target_duration: 120
  },
  structure: {
    acts: [
      { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', start_time: 0, end_time: 40, beats: [] },
      { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', start_time: 40, end_time: 80, beats: [] },
      { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', start_time: 80, end_time: 120, beats: [] }
    ],
    scenes: [
      {
        scene_id: 'SC00',
        scene_name: '片头',
        scene_type: 'opening',
        act_id: 'ACT-1',
        timing: { start: 0, duration: 15, end: 15 },
        characters: ['xiaoG'],
        setting: 'Nirath硅晶草原，双月当空',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '原来这就是Nirath...', emotion: 'awe' }]
        }
      },
      {
        scene_id: 'SC01',
        scene_name: '初遇',
        scene_type: 'conflict',
        act_id: 'ACT-1',
        timing: { start: 15, duration: 25, end: 40 },
        characters: ['xiaoG', 'taotie'],
        setting: '等离子河流旁，硅晶岩石',
        dialogue: {
          has_dialogue: true,
          lines: [
            { speaker: 'xiaoG', text: '那是什么？', emotion: 'surprise' },
            { speaker: 'taotie', text: '（能量涡流轰鸣）', emotion: 'neutral' }
          ]
        }
      },
      {
        scene_id: 'SC02',
        scene_name: '探索',
        scene_type: 'establishing',
        act_id: 'ACT-2',
        timing: { start: 40, duration: 30, end: 70 },
        characters: ['xiaoG'],
        setting: '晶体森林深处，荧光闪烁',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '这里的能量...好强大', emotion: 'wonder' }]
        }
      },
      {
        scene_id: 'SC03',
        scene_name: '高潮',
        scene_type: 'emotional_climax',
        act_id: 'ACT-2',
        timing: { start: 70, duration: 30, end: 100 },
        characters: ['xiaoG', 'taotie'],
        setting: '等离子河流交汇处，能量风暴',
        dialogue: {
          has_dialogue: true,
          lines: [
            { speaker: 'xiaoG', text: '我明白了，你是守护者！', emotion: 'realization' },
            { speaker: 'taotie', text: '（能量涡流平息）', emotion: 'calm' }
          ]
        }
      },
      {
        scene_id: 'SC04',
        scene_name: '结尾',
        scene_type: 'resolution',
        act_id: 'ACT-3',
        timing: { start: 100, duration: 20, end: 120 },
        characters: ['xiaoG'],
        setting: '硅晶草原，双月落下',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '记忆即存在...我会记住的', emotion: 'determined' }]
        }
      }
    ]
  },
  character_system: {
    characters: [
      {
        character_id: 'xiaoG',
        name: '小G',
        role: 'protagonist',
        visual_anchor: {
          core_features: ['银灰装甲', '东亚面孔短发', '年轻男性'],
          reference_images: ['characters/xiaoG/front.jpg']
        }
      },
      {
        character_id: 'taotie',
        name: '饕餮',
        role: 'featured_beast',
        visual_anchor: {
          core_features: ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流'],
          reference_images: ['characters/tao-tie/front.jpg']
        }
      }
    ]
  },
  world_setting: {
    world_id: 'nirath',
    world_name: 'Nirath星球',
    era: '上古纪元',
    core_rules: ['Nirath是地球前身'],
    environment_tags: ['硅晶草原', '双月当空']
  }
});

assert(blueprint.blueprint_id, '生成 blueprint_id');
assert(blueprint.meta.title === '测试剧本', '设置标题');
assert(blueprint.structure.scenes.length === 5, '5个场景');
assert(blueprint.getScene('SC00').scene_name === '片头', '获取指定场景');
assert(blueprint.getCharacter('xiaoG').role === 'protagonist', '获取指定角色');
assert(blueprint.getScenesWithDialogue().length === 5, '5个场景有台词');
assert(blueprint.getTotalDuration() === 120, '总时长 120s');

// 验证
const validation = blueprint.validate();
assert(validation.valid, '剧本验证通过');
assert(validation.errors.length === 0, '无错误');

// JSON 序列化
const json = blueprint.toJSON();
assert(json.includes('测试剧本'), 'JSON 包含标题');

const cloned = ScriptBlueprint.fromJSON(json);
assert(cloned.meta.title === '测试剧本', 'JSON 反序列化');

console.log(`\n  Blueprint 测试通过 ✓`);

// ========== 测试 3: ScriptValidator ==========
console.log('\n📋 测试 3: ScriptValidator（剧本校验）');
console.log('----------------------------------------');

const validator = new ScriptValidator();
const report = validator.validate(blueprint);

assert(report.passed, '校验通过');
assert(report.overall_score > 0, '有评分');
assert(report.checks.length > 0, '有检查项');
assert(report.issues.length === 0, '无问题');
assert(report.scores.detailed.structural_integrity > 0, '结构评分');

console.log(`  综合评分: ${report.overall_score}`);
console.log(`  检查项: ${report.checks.length}`);
console.log(`  通过项: ${report.checks.filter(c => c.passed).length}`);

// 调试：打印失败项
const failedChecks = report.checks.filter(c => !c.passed);
if (failedChecks.length > 0) {
  console.log('  失败项详情:');
  for (const fc of failedChecks) {
    console.log(`    ❌ ${fc.category}.${fc.name}: ${fc.message} [${fc.severity}]`);
    console.log(`       建议: ${fc.suggestion}`);
  }
}

// 测试修复计划生成
const repairPlan = validator.generateRepairPlan(report);
assert(repairPlan.repairs.length === 0, '无修复需求（因为剧本通过）');

console.log(`  修复计划: 无需修复 ✓`);

// ========== 测试 4: NirathExtension ==========
console.log('\n📋 测试 4: NirathExtension（世界观扩展）');
console.log('----------------------------------------');

const nirath = new NirathExtension();

assert(nirath.getWorldInfo().world_id === 'nirath', '获取世界观');
assert(nirath.getBeastArchive('taotie').name === '饕餮', '获取异兽档案');
assert(nirath.getBeastVisualAnchor('taotie').core_features.length > 0, '获取视觉锚点');
assert(nirath.getProtagonist().character_id === 'xiaoG', '获取主角设定');

const visualConstraints = nirath.getVisualConstraints();
assert(visualConstraints.must_have.length > 0, '有必须元素');
assert(visualConstraints.forbidden.length > 0, '有禁止元素');

// 验证场景
const sceneValidation = nirath.validateScene(blueprint.structure.scenes[0]);
assert(sceneValidation.valid, '场景符合世界观');

const setting = nirath.generateSceneSetting('测试场景');
assert(setting.includes('Nirath') || setting.includes('硅') || setting.includes('双月'), '生成场景设定');

const charAnchor = nirath.generateCharacterVisualAnchor('xiaoG');
assert(charAnchor.includes('银灰装甲'), '生成角色视觉锚点');

console.log(`  Nirath 扩展测试通过 ✓`);

// ========== 测试 5: Adapter ==========
console.log('\n📋 测试 5: ScriptBlueprintAdapter（适配层）');
console.log('----------------------------------------');

const adapter = new ScriptBlueprintAdapter();
const adapted = adapter.adapt(blueprint);

assert(adapted.config.title === '测试剧本', '适配配置');
assert(adapted.scenes.length === 5, '适配场景');
assert(adapted.characters.length === 2, '适配角色');
assert(adapted.dialogues.length === 7, '适配台词（7句）');
assert(adapted.worldSetting.world_id === 'nirath', '适配世界观');

// 检查场景 Prompt 基础
assert(adapted.scenes[0].prompt_base.includes('电影级'), 'Prompt 包含电影级');
assert(adapted.scenes[0].prompt_base.includes('Nirath'), 'Prompt 包含 Nirath');

// 检查视觉方向
assert(adapted.scenes[0].visual_direction.shot_type, '有镜头类型');
assert(adapted.scenes[0].visual_direction.camera_movement, '有运镜');
assert(adapted.scenes[0].visual_direction.lighting, '有布光');

// 生成报告
const adaptReport = adapter.generateReport(adapted);
assert(adaptReport.adaptation_status === 'success', '适配成功');
assert(adaptReport.scenes_count === 5, '报告场景数');

console.log(`  适配报告:`);
console.log(`    场景: ${adaptReport.scenes_count}`);
console.log(`    角色: ${adaptReport.characters_count}`);
console.log(`    台词: ${adaptReport.dialogues_count}`);
console.log(`    时长: ${adaptReport.total_duration}s`);
console.log(`    警告: ${adaptReport.warnings.length}`);

console.log(`  适配层测试通过 ✓`);

// ========== 汇总 ==========
console.log('\n========================================');
console.log('  测试完成');
console.log('========================================');
console.log(`  ✅ 通过: ${results.passed}`);
console.log(`  ❌ 失败: ${results.failed}`);
console.log(`  📊 总计: ${results.passed + results.failed}`);
console.log(`  🎯 成功率: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
console.log('========================================');

if (results.failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过！剧本引擎 MVP 就绪。\n');
  process.exit(0);
}

```

---

