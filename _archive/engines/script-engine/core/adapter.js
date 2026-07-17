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
