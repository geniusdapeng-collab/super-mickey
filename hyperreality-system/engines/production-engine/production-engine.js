// hyperreality-system/engines/production-engine/production-engine.js
// Production Engine - 制作引擎（Layer 2）
// 深度融合：直接消费 ScriptBlueprint 输出，驱动镜头生成
// 版本：v1.0.0 | 日期：2026-06-08

const path = require('path');

// 复用现有系统的核心模块（从 systems/ 复制过来）
// 注：实际部署时这些模块会从 systems/ 复制到 production-engine/modules/
const SYSTEMS_PATH = path.join(__dirname, '../../../systems');

// 动态加载现有模块
function loadModule(name) {
  try {
    return require(path.join(SYSTEMS_PATH, name));
  } catch (e) {
    console.warn(`[ProductionEngine] 模块加载失败: ${name} - ${e.message}`);
    return null;
  }
}

class ProductionEngine {
  constructor(options = {}) {
    this.config = {
      maxPromptLength: 1500,  // v2.0-B+: 从980提升至1500，支持七层架构+音频层
      targetPromptLength: 1470,  // v2.0-B+: 对应提升
      referenceImageCount: 2,
      outputDir: options.outputDir || '/tmp/hyperreality-output',
      ...options
    };
    
    this.modules = {};
    this.logs = [];
    this._initModules();
  }

  _initModules() {
    // 加载核心模块（从现有系统复用）
    this.modules = {
      // 时长分配
      shotDurationAllocator: loadModule('shot-duration-allocator.js')?.ShotDurationAllocator,
      durationCalculator: loadModule('duration-calculator.js')?.DurationCalculator,
      
      // 运镜系统
      cameraMovement: loadModule('camera-movement-system-v2.js')?.CameraMovementSystem,
      intraShotTimeline: loadModule('camera-movement-system-v3.js')?.IntraShotTimelineGenerator,
      
      // 连续性
      continuityEngine: loadModule('continuity-engine.js')?.ContinuityEngine,
      
      // Prompt 增强
      promptEnhancer: loadModule('intra-shot-prompt-enhancer.js')?.IntraShotPromptEnhancer,
      styleInjector: loadModule('universal-style-injector.js')?.UniversalStyleInjector,
      
      // 质量门
      promptQualityGate: loadModule('prompt-quality-gate.js')?.PromptQualityGate,
      
      // 字符计数
      charCounter: loadModule('char-counter')?.charCounter,
      
      // 片头系统
      openingSystem: loadModule('opening-system-v3.js'),
      
      // 角色系统
      characterManager: loadModule('character-manager-v2.js')?.CharacterManagerV2,
      characterPromptBuilder: loadModule('character-prompt-builder.js')?.CharacterPromptBuilder,
      
      // 校验
      storyboardValidator: loadModule('storyboard-validator.js')?.StoryboardValidator,
      preRenderValidation: loadModule('pre-render-validation.js')?.preRenderValidation,
      
      // 后期
      postProduction: loadModule('post-production-pipeline.js')?.PostProductionPipeline,
    };
    
    // 初始化实例
    for (const [key, Module] of Object.entries(this.modules)) {
      if (Module && typeof Module === 'function') {
        try {
          this.modules[key] = new Module();
        } catch (e) {
          // 已经是实例或无需 new
        }
      }
    }
  }

  log(stage, message) {
    const entry = { stage, message, timestamp: Date.now() };
    this.logs.push(entry);
    console.log(`[${stage}] ${message}`);
  }

  /**
   * 主入口：从 ScriptBlueprint 生成完整镜头
   * @param {object} adaptedBlueprint - 适配器输出的剧本数据
   * @returns {object} { shots, prompts, report }
   */
  async produce(adaptedBlueprint) {
    const startTime = Date.now();
    this.log('PRODUCE', '🎬 ProductionEngine 启动 | 深度融合模式');
    
    const result = {
      success: false,
      shots: [],
      prompts: [],
      stages: {},
      errors: [],
      logs: this.logs,
      timing: {}
    };

    try {
      // === Stage 1: 从蓝图提取场景并转换为镜头结构 ===
      result.stages.sceneExtraction = await this._runStage('scene-extraction', () =>
        this._extractScenes(adaptedBlueprint)
      );
      
      // === Stage 2: 时长分配（基于剧本已有时长）===
      result.stages.durationAllocation = await this._runStage('duration-allocation', () =>
        this._allocateDuration(result.stages.sceneExtraction.shots)
      );
      
      // === Stage 3: 运镜设计（每镜头独立）===
      result.stages.cameraDesign = await this._runStage('camera-design', () =>
        this._designCameraMovement(result.stages.durationAllocation.shots)
      );
      
      // === Stage 4: Prompt 工程（核心阶段）===
      result.stages.promptEngineering = await this._runStage('prompt-engineering', () =>
        this._engineerPrompts(result.stages.cameraDesign.shots, adaptedBlueprint)
      );
      
      // === Stage 5: 质量门校验 ===
      result.stages.qualityGate = await this._runStage('quality-gate', () =>
        this._runQualityGate(result.stages.promptEngineering.prompts)
      );
      
      // === Stage 6: 片头生成（如有需要）===
      if (adaptedBlueprint.config?.featured_beast_id) {
        result.stages.opening = await this._runStage('opening', () =>
          this._generateOpening(adaptedBlueprint)
        );
      }
      
      // === Stage 7: 连续性检查 ===
      result.stages.continuity = await this._runStage('continuity', () =>
        this._checkContinuity(result.stages.promptEngineering.prompts)
      );
      
      // 汇总
      result.shots = result.stages.promptEngineering.shots;
      result.prompts = result.stages.promptEngineering.prompts;
      
      // v6.37-P0: 构建标准输出结构（meta + opening + shots）
      result.meta = this._buildMeta(adaptedBlueprint);
      result.opening = result.stages.opening?.openingData || null;
      
      result.success = true;
      result.timing.total = Date.now() - startTime;
      
      this.log('PRODUCE', `✅ 制作完成: ${result.shots.length} 镜头, ${result.prompts.length} Prompts`);
      
    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'PRODUCE',
        message: error.message,
        stack: error.stack
      });
      this.log('ERROR', `❌ 制作失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 运行单个 Stage 并计时
   */
  async _runStage(stageName, stageFn) {
    const start = Date.now();
    this.log(stageName.toUpperCase(), `开始...`);
    
    try {
      const output = await stageFn();
      const duration = Date.now() - start;
      this.log(stageName.toUpperCase(), `完成 (${duration}ms)`);
      return { ...output, _stageDuration: duration };
    } catch (error) {
      const duration = Date.now() - start;
      this.log(stageName.toUpperCase(), `失败 (${duration}ms): ${error.message}`);
      throw error;
    }
  }

  /**
   * v6.37-P0: 构建 Meta 元信息
   */
  _buildMeta(adaptedBlueprint) {
    const worldSetting = adaptedBlueprint.worldSetting || {};
    const config = adaptedBlueprint.config || {};
    
    return {
      title: config.title || '未命名短片',
      worldview: worldSetting.world_id || 'default',
      totalDuration: this._calculateTotalDuration(adaptedBlueprint.scenes),
      openingDuration: config.opening_duration || 10,
      fps: 24,
      resolution: '1920x1080',
      styleNotes: config.style_notes || 'cinematic, hyperrealistic'
    };
  }
  
  _calculateTotalDuration(scenes) {
    if (!scenes || scenes.length === 0) return 0;
    return scenes.reduce((sum, scene) => sum + (scene.timing?.duration || 20), 0);
  }

  /**
   * v6.37-P1+: 构建角色极简锚点（专家反馈强化）
   * 规则：
   * 1. 强制3-5个视觉关键词（不含种族/物种）
   * 2. 禁止详细描述（如"十五米高的巨型身躯"）
   * 3. 颜色词不超过2个
   * 4. 禁止形容词堆砌（超过3个连续形容词则截断）
   * 5. 格式：角色名: 种族/物种, 视觉关键词1, 视觉关键词2, 视觉关键词3
   * 
   * 正例：白泽: lion-like beast, vertical eye, three white-flame tails, golden hooves
   * 反例：白泽: 一只十五米高的白色神兽，有着三根尾巴和金色的蹄子（太啰嗦）
   */
  _buildMinimalAnchor(cid, characters) {
    const char = characters.find(c => c.character_id === cid);
    if (!char) return `${cid}: unknown`;
    
    const race = char.species || char.race || char.gender || 'human';
    const features = char.visual_anchor?.core_features || [];
    
    // 颜色词列表（用于检查）
    const colorWords = ['white', 'black', 'red', 'blue', 'green', 'golden', 'silver', 'purple', 'brown', 'grey', 'gray', 'yellow', 'orange', 'pink', 'cyan', 'teal'];
    
    // 形容词列表（用于检查堆砌）
    const adjectiveWords = ['big', 'huge', 'giant', 'large', 'small', 'tiny', 'massive', 'tall', 'short', 'beautiful', 'magnificent', 'mysterious', 'ancient', 'powerful', 'fierce', 'gentle', 'elegant', 'majestic', 'terrifying', 'sacred', 'divine', 'mythical', 'legendary', 'noble', 'wise', 'brave', 'curious', 'young', 'old'];
    
    // 过滤并优化特征
    const processedFeatures = [];
    let colorCount = 0;
    let adjCount = 0;
    
    for (const feature of features) {
      const lower = feature.toLowerCase();
      
      // 跳过详细描述（超过15字符可能太啰嗦）
      if (feature.length > 15 && !feature.includes(' ') && !feature.includes('-')) {
        continue; // 跳过单个超长词（可能是详细描述）
      }
      
      // 检查颜色词
      const isColor = colorWords.some(c => lower.includes(c));
      if (isColor) {
        if (colorCount >= 2) continue; // 颜色词不超过2个
        colorCount++;
      }
      
      // 检查形容词堆砌（连续形容词计数）
      const isAdjective = adjectiveWords.some(a => lower.includes(a));
      if (isAdjective) {
        adjCount++;
        if (adjCount > 3) continue; // 形容词不超过3个
      } else {
        adjCount = 0; // 重置计数
      }
      
      processedFeatures.push(feature);
      
      // 强制3-5个关键词
      if (processedFeatures.length >= 5) break;
    }
    
    // 确保至少3个关键词
    while (processedFeatures.length < 3 && features.length > processedFeatures.length) {
      const next = features[processedFeatures.length];
      if (next) processedFeatures.push(next);
      else break;
    }
    
    const keywords = processedFeatures.slice(0, 5).join(', ');
    return `${char.name}: ${race}, ${keywords}`;
  }
  
  /**
   * Stage 1: 从适配蓝图提取场景，转换为内部镜头结构
   * v6.37-P0: 改造为符合参考文档的字段格式
   */
  _extractScenes(adaptedBlueprint) {
    const scenes = adaptedBlueprint.scenes || [];
    const characters = adaptedBlueprint.characters || [];
    const worldSetting = adaptedBlueprint.worldSetting || {};
    
    // v1.2.5: 系列作品非第一集处理
    // 修复：兼容adapter返回的顶层_metadata和config._metadata
    const _metadata = adaptedBlueprint.config?._metadata || adaptedBlueprint._metadata || {};
    const isSeriesNonFirst = _metadata.isSeries && _metadata.episodeNumber > 1;
    
    let shots = scenes.map((scene, index) => {
      // v1.2.5: 非第一集将opening类型改为establishing
      let sceneType = scene.scene_type || 'establishing';
      if (isSeriesNonFirst && sceneType === 'opening') {
        console.log(`[ProductionEngine] 非第一集，场景 ${scene.scene_id} 从 opening 降级为 establishing`);
        sceneType = 'establishing';
      }
      
      // 构建角色描述（v6.37-P1+: 强制极简锚点，3-5关键词）
      const characterAnchors = (scene.characters || []).map(cid => {
        return this._buildMinimalAnchor(cid, characters);
      });
      
      // 构建对话（v6.37-P0: 统一格式 SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC:YES）
      const dialogueLines = (scene.dialogue?.lines || []).map(line => {
        const speaker = line.speaker || '角色';
        const type = line.type || '独白';
        const emotion = line.emotion || '平静';
        const text = line.text || '';
        return `${speaker}|${type}|${emotion}|${text}|LIP_SYNC:YES`;
      });
      
      // v6.37-P0: 构建五维空间描述（scene字段）
      const sceneDescription = this._buildFiveDimensionScene(scene, worldSetting);
      
      // v6.37-P0: 构建 mood（3-5情绪关键词）
      const mood = this._buildMood(scene);
      
      // v6.37-P0: 构建 action（核心动词+交互目标）
      const action = this._buildAction(scene);
      
      return {
        shotId: scene.scene_id || `S${String(index + 1).padStart(2, '0')}`,
        sceneType: sceneType,
        sceneFunction: scene.scene_function || 'establish',
        
        // v6.37-P0: 时序（保留对象，后续转为字符串）
        timing: {
          start: scene.timing?.start || 0,
          duration: scene.timing?.duration || 20,
          end: scene.timing?.end || 20
        },
        
        // v1.2.5: 添加顶层duration字段供FieldGuard使用
        duration: scene.timing?.duration || 20,
        
        // v6.37-P0: 场景（五维空间描述法）
        scene: sceneDescription,
        
        // v6.37-P0: 情绪
        mood: mood,
        
        // v6.37-P0: 角色（极简锚点）
        character: characterAnchors.join(' | '),
        characterRef: this._buildCharacterRef(scene, characters),
        
        // v6.37-P0: 动作
        action: action,
        
        // v6.37-P0: 对话（统一格式）
        dialogue: dialogueLines.join(' || '),
        
        // 保留原始数据（供内部使用）
        characters: scene.characters || [],
        characterDescs: characterAnchors.join(' | '),
        dialogueText: (scene.dialogue?.lines || []).map(l => l.text).join('；'),
        
        // 情感
        emotionalTarget: scene.emotional_target || { valence: 0, arousal: 0.5 },
        
        // 视觉方向
        visualDirection: scene.visual_direction || {},
        
        // Prompt 基础
        promptBase: scene.prompt_base || '',
        
        // 世界设定
        worldId: worldSetting.world_id || 'default',
        
        // 状态
        status: 'pending'
      };
    });
    
    // v1.2.5: 时长归一化——确保总时长严格等于目标时长
    const targetDuration = adaptedBlueprint.config?.target_duration || adaptedBlueprint.meta?.target_duration || 120;
    shots = this._normalizeDurations(shots, targetDuration);
    
    return { shots, sceneCount: shots.length };
  }
  
  /**
   * v1.2.5: 时长归一化
   * 将场景时长按比例缩放，使总时长严格等于目标时长
   */
  _normalizeDurations(shots, targetDuration) {
    if (!shots || shots.length === 0) return shots;
    
    // 计算当前总时长（取最后一个场景的end时间）
    const currentEnd = Math.max(...shots.map(s => s.timing?.end || 0));
    if (currentEnd <= 0) return shots;
    
    // 如果已经精确匹配，无需调整
    if (currentEnd === targetDuration) {
      console.log(`[ProductionEngine] 时长已精确匹配: ${targetDuration}s`);
      return shots;
    }
    
    // 计算缩放比例
    const scale = targetDuration / currentEnd;
    console.log(`[ProductionEngine] 时长归一化: ${currentEnd}s → ${targetDuration}s (缩放: ${scale.toFixed(3)})`);
    
    // 按比例缩放每个场景的timing
    let accumulatedEnd = 0;
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const origDuration = shot.timing?.duration || 10;
      
      // 缩放时长，至少保留3秒
      const newDuration = Math.max(3, Math.round(origDuration * scale));
      
      // 更新timing和顶层duration
      shot.timing = {
        start: accumulatedEnd,
        duration: newDuration,
        end: accumulatedEnd + newDuration
      };
      shot.duration = newDuration;
      
      accumulatedEnd += newDuration;
    }
    
    // 最后微调：确保总时长精确等于目标
    const lastShot = shots[shots.length - 1];
    const diff = targetDuration - lastShot.timing.end;
    if (diff !== 0) {
      lastShot.timing.duration += diff;
      lastShot.timing.end = targetDuration;
      console.log(`[ProductionEngine] 最后微调: ${lastShot.shotId} 时长调整为 ${lastShot.timing.duration}s`);
    }
    
    return shots;
  }
  
  /**
   * v6.37-P0: 构建五维空间描述
   */
  _buildFiveDimensionScene(scene, worldSetting) {
    const dimensions = [];
    
    // 1. 宏观地理：星球/大陆/区域
    const worldName = worldSetting.name || worldSetting.world_id || '未知世界';
    dimensions.push(worldName);
    
    // 2. 中观地貌：地形/地貌
    const setting = scene.setting || '';
    if (setting) dimensions.push(setting);
    
    // 3. 微观材质：表面材质/纹理
    const materials = scene.materials || scene.surface_details || '';
    if (materials) dimensions.push(materials);
    
    // 4. 天气时间：时间/天气/光照
    const timeOfDay = scene.time_of_day || scene.lighting?.time_of_day || '';
    if (timeOfDay) dimensions.push(timeOfDay);
    
    // 5. 空间深度：前景/中景/背景层次
    const depth = scene.depth_layers || scene.spatial_depth || 'atmospheric perspective';
    dimensions.push(`spatial depth: ${depth}`);
    
    return dimensions.join(', ');
  }
  
  /**
   * v6.37-P0: 构建 mood（3-5情绪关键词）
   */
  _buildMood(scene) {
    const moodMap = {
      'opening': 'epic, mysterious, awe-inspiring',
      'establishing': 'mysterious, anticipation, wonder',
      'conflict': 'tense, determined, brave, confrontational',
      'emotional_climax': 'epic, emotional, powerful, cathartic',
      'resolution': 'peaceful, warm, nostalgic, hopeful',
      'discovery': 'curious, excited, surprised, wondrous',
      'transition': 'flowing, continuous, seamless'
    };
    
    return moodMap[scene.scene_type] || 'neutral, calm, steady';
  }
  
  /**
   * v6.37-P0: 构建 action（核心动词+交互目标）
   */
  _buildAction(scene) {
    const actionMap = {
      'opening': 'establishing shot, camera slowly descending through atmospheric layers',
      'establishing': 'protagonist steps forward, observing surroundings with focused gaze',
      'conflict': 'confrontation stance, direct eye contact, tension building in posture',
      'emotional_climax': 'dramatic gesture, emotional peak, decisive movement',
      'resolution': 'gentle release, returning to calm, peaceful closure',
      'discovery': 'leaning forward, reaching out, examining with curiosity'
    };
    
    return actionMap[scene.scene_type] || 'neutral stance, steady breathing';
  }
  
  /**
   * v6.37-P0: 构建 characterRef（image://格式）
   */
  _buildCharacterRef(scene, characters) {
    const refs = (scene.characters || []).map(cid => {
      const char = characters.find(c => c.character_id === cid);
      if (!char) return null;
      
      // 构建 image:// 路径
      const paths = [];
      const angles = ['front', 'profile', 'three-quarter', 'closeup', 'detail'];
      angles.forEach(angle => {
        paths.push(`image://characters/${cid}-${angle}.png`);
      });
      
      return `${char.name}: ${paths.join(', ')}`;
    }).filter(Boolean);
    
    return refs.join(' | ') || 'NONE';
  }

  /**
   * Stage 2: 时长分配（精细化）
   * v6.37-P0: 新增 timeline 字段
   */
  _allocateDuration(shots) {
    const allocator = this.modules.shotDurationAllocator;
    if (!allocator) {
      // 回退：使用剧本引擎的时长
      return { shots };
    }
    
    // 基于内容重要性、台词长度、视觉复杂度三维度重新分配
    const allocatedShots = shots.map((shot, index) => {
      // 台词越长，时长越长
      const dialogueLength = shot.dialogue?.length || 0;
      const dialogueFactor = Math.min(dialogueLength / 30, 1.5); // 30字基准
      
      // 场景类型权重
      const typeWeights = {
        'opening': 1.2,
        'emotional_climax': 1.5,
        'conflict': 1.3,
        'resolution': 1.0,
        'establishing': 1.0
      };
      const typeWeight = typeWeights[shot.sceneType] || 1.0;
      
      // 基础时长 × 调整因子
      const baseDuration = shot.timing.duration;
      const adjustedDuration = Math.round(baseDuration * typeWeight * (1 + dialogueFactor * 0.2));
      
      // 限制在合理范围
      const finalDuration = Math.max(10, Math.min(40, adjustedDuration));
      
      // v6.37-P1+: 构建 timeline 字段（结构化对象 + 字符串）
      // v1.2.5: 使用已归一化的时长，不再重新分配
      const timelineResult = this._buildTimeline(shot, index, baseDuration);
      
      return {
        ...shot,
        // v6.37-P1+: timeline 结构化对象
        timeline: timelineResult,
        allocation: {
          baseDuration,
          dialogueFactor,
          typeWeight,
          // v1.2.5: 标记为保留原始时长
          preserved: true
        }
      };
    });
    
    return { shots: allocatedShots };
  }
  
  /**
   * v6.37-P0: 构建 timeline 字段
   * 格式：T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX
   */
  _buildTimeline(shot, index, duration) {
    const startTime = shot.timing.start || 0;
    const endTime = startTime + duration;
    const type = shot.sceneType || 'normal';
    const mood = shot.mood || 'neutral';
    
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    // v6.37-P1+: 结构化对象 + 字符串
    const timelineObj = {
      start: `T${formatTime(startTime)}`,
      end: `T${formatTime(endTime)}`,
      duration: duration,
      type: type,
      mood: mood
    };
    
    const timelineStr = `${timelineObj.start}-${timelineObj.end} / duration: ${timelineObj.duration}s / type: ${timelineObj.type} / mood: ${timelineObj.mood}`;
    
    return {
      object: timelineObj,
      string: timelineStr
    };
  }

  /**
   * Stage 3: 运镜设计
   * v6.37-P0: 改造 camera 字段为字符串格式，新增 lighting 字段
   */
  _designCameraMovement(shots) {
    const cameraSystem = this.modules.cameraMovement;
    
    const designedShots = shots.map(shot => {
      // 基于场景类型推断运镜
      const cameraConfig = this._inferCameraConfig(shot);
      
      // v6.37-P1+: 构建 camera 字段（结构化对象 + 字符串）
      const cameraResult = this._buildCameraString(cameraConfig, shot);
      
      // v6.37-P1+: 构建 lighting 字段（结构化对象 + 字符串）
      const lightingResult = this._buildLighting(shot, cameraConfig);
      
      return {
        ...shot,
        camera: cameraResult, // 结构化对象
        lighting: lightingResult, // 结构化对象
        cameraMovement: {
          ...cameraConfig,
          // 4段式运镜时间轴
          timeline: this._generateCameraTimeline(shot.timing.duration, cameraConfig)
        }
      };
    });
    
    return { shots: designedShots };
  }
  
  /**
   * v6.37-P0: 构建 camera 字符串（12级机位+14运镜+焦距+速度）
   */
  /**
   * v6.37-P1+: 构建 camera 字段（结构化对象 + 字符串）
   * 专家反馈：字段级结构化，对象用于程序解析，字符串用于Prompt融合
   */
  _buildCameraString(cameraConfig, shot) {
    const shotSizeMap = {
      'wide': 'wide',
      'medium': 'medium',
      'close_up': 'close-up',
      'extreme_close_up': 'extreme close-up',
      'establishing': 'establishing'
    };
    
    const movementMap = {
      '缓慢推进': 'dolly in',
      '稳定机位': 'static',
      '手持晃动': 'handheld',
      '快速推近': 'push in',
      '缓慢后拉': 'pull back'
    };
    
    const focalMap = {
      'slow': '24mm',
      'normal': '35mm',
      'fast': '85mm',
      'dynamic': '50mm'
    };
    
    const speedMap = {
      'slow': 0.3,
      'normal': 1.0,
      'fast': 1.5,
      'dynamic': 0.8
    };
    
    // 结构化对象
    const cameraObj = {
      shotSize: shotSizeMap[cameraConfig.shotType] || 'medium',
      movement: movementMap[cameraConfig.movement] || 'static',
      lens: focalMap[cameraConfig.speed] || '35mm',
      speed: speedMap[cameraConfig.speed] || 1.0,
      aperture: 'f/2.8', // 默认值
      focus: 'normal' // 默认值
    };
    
    // 字符串格式（用于Prompt融合）
    const cameraStr = `${cameraObj.shotSize} shot, ${cameraObj.movement}, ${cameraObj.lens} lens, speed ${cameraObj.speed}`;
    
    return {
      object: cameraObj,
      string: cameraStr
    };
  }
  
  /**
   * v6.37-P0: 构建 lighting 字段（主光方向+色温K值+特效光）
   */
  _buildLighting(shot, cameraConfig) {
    const lightingMap = {
      'opening': {
        keyLight: { direction: 'backlight', colorTemp: 3200, effect: 'golden hour rim' },
        fillLight: { direction: 'ambient', colorTemp: 6500, effect: 'cool fill' },
        special: 'volumetric god rays'
      },
      'establishing': {
        keyLight: { direction: 'front', colorTemp: 4500, effect: 'neutral balanced' },
        fillLight: { direction: 'ambient', colorTemp: 4500, effect: 'soft fill' },
        special: ''
      },
      'conflict': {
        keyLight: { direction: 'top', colorTemp: 5600, effect: 'harsh shadows' },
        fillLight: { direction: 'none', colorTemp: 0, effect: 'dramatic contrast' },
        special: 'high contrast noir'
      },
      'emotional_climax': {
        keyLight: { direction: 'omni', colorTemp: 8000, effect: 'bright key' },
        fillLight: { direction: 'ambient', colorTemp: 8000, effect: 'volumetric glow' },
        special: 'volumetric glow'
      },
      'resolution': {
        keyLight: { direction: 'backlight', colorTemp: 2800, effect: 'warm sunset' },
        fillLight: { direction: 'ambient', colorTemp: 3200, effect: 'soft diffusion' },
        special: 'soft diffusion'
      },
      'discovery': {
        keyLight: { direction: 'side', colorTemp: 4500, effect: 'cool blue accent' },
        fillLight: { direction: 'ambient', colorTemp: 5500, effect: 'practical source' },
        special: 'practical source'
      }
    };
    
    const lightingObj = lightingMap[shot.sceneType] || lightingMap['establishing'];
    
    // 字符串格式（用于Prompt融合）
    const keyLight = lightingObj.keyLight;
    const fillLight = lightingObj.fillLight;
    let lightingStr = `${keyLight.direction} ${keyLight.colorTemp}K, ${keyLight.effect}`;
    if (fillLight.direction !== 'none') {
      lightingStr += `, ${fillLight.direction} ${fillLight.colorTemp}K, ${fillLight.effect}`;
    }
    if (lightingObj.special) {
      lightingStr += `, ${lightingObj.special}`;
    }
    
    return {
      object: lightingObj,
      string: lightingStr
    };
  }

  /**
   * 推断运镜配置
   */
  _inferCameraConfig(shot) {
    const configs = {
      'opening': {
        shotType: 'wide',
        movement: '缓慢推进',
        speed: 'slow',
        transition: 'none'
      },
      'establishing': {
        shotType: 'medium',
        movement: '稳定机位',
        speed: 'normal',
        transition: 'smooth'
      },
      'conflict': {
        shotType: 'close_up',
        movement: '手持晃动',
        speed: 'fast',
        transition: 'cut'
      },
      'emotional_climax': {
        shotType: 'extreme_close_up',
        movement: '快速推近',
        speed: 'dynamic',
        transition: 'dramatic'
      },
      'resolution': {
        shotType: 'medium',
        movement: '缓慢后拉',
        speed: 'slow',
        transition: 'fade'
      }
    };
    
    return configs[shot.sceneType] || configs['establishing'];
  }

  /**
   * 生成 4 段式运镜时间轴
   */
  _generateCameraTimeline(duration, cameraConfig) {
    const segments = 4;
    const segmentDuration = duration / segments;
    
    const timeline = [];
    for (let i = 0; i < segments; i++) {
      const start = i * segmentDuration;
      const end = (i + 1) * segmentDuration;
      
      timeline.push({
        segment: i + 1,
        timeRange: `${start.toFixed(1)}s-${end.toFixed(1)}s`,
        duration: segmentDuration.toFixed(1) + 's',
        cameraMovement: this._getSegmentMovement(i, cameraConfig.movement),
        shotType: this._getSegmentShotType(i, cameraConfig.shotType),
        purpose: this._getSegmentPurpose(i, cameraConfig)
      });
    }
    
    return timeline;
  }

  _getSegmentMovement(index, baseMovement) {
    const variations = {
      '缓慢推进': ['远景缓推', '中景推进', '近景聚焦', '特写定格'],
      '稳定机位': ['全景稳定', '中景观察', '近景注视', '特写定格'],
      '手持晃动': ['全景晃动', '中景逼近', '近景紧张', '特写冲击'],
      '快速推近': ['远景突袭', '中景冲刺', '近景逼近', '特写定格'],
      '缓慢后拉': ['近景特写', '中景展开', '全景揭示', '远景收尾']
    };
    
    const movements = variations[baseMovement] || variations['稳定机位'];
    return movements[index] || movements[movements.length - 1];
  }

  _getSegmentShotType(index, baseType) {
    const progression = {
      'wide': ['远景', '全景', '中景', '近景'],
      'medium': ['中景', '近景', '中景', '近景'],
      'close_up': ['中景', '近景', '特写', '极特写'],
      'extreme_close_up': ['近景', '特写', '极特写', '微距']
    };
    
    const types = progression[baseType] || progression['medium'];
    return types[index] || types[types.length - 1];
  }

  _getSegmentPurpose(index, config) {
    const purposes = [
      '建立空间/环境',
      '展示角色/关系',
      '推进情绪/冲突',
      '定格核心瞬间'
    ];
    return purposes[index] || '推进叙事';
  }

  /**
   * Stage 4: Prompt 工程（核心）
   * v6.37-P0: 按参考文档融合顺序构建 Prompt，产出标准字段格式
   * 保留卓越系统特有字段：mouthAction, importance, visualComplexity, qualityScore, enhanced
   */
  _engineerPrompts(shots, blueprint) {
    const prompts = [];
    const engineeredShots = [];
    
    for (const shot of shots) {
      // 处理结构化对象（取字符串用于Prompt融合）
      const cameraStr = shot.camera?.string || shot.camera || '';
      const lightingStr = shot.lighting?.string || shot.lighting || '';
      const timelineStr = shot.timeline?.string || shot.timeline || '';
      
      // 构建 Prompt 各部分（按融合顺序，带优先级截断）
      const prompt = this._buildShotPrompt(shot, blueprint, { cameraStr, lightingStr, timelineStr });
      
      // 字符计数
      const promptLength = this._countChars(prompt.fullPrompt);
      
      // v6.37-P1+: 构建标准输出对象（严格按 v6.37 标准字段）
      // 正片 S01+: 14 核心字段 | 片头 S00: + audioLayer + titleOverlay
      const standardOutput = {
        // === 标准字段（v6.37-production+）===
        shotId: shot.shotId,
        duration: shot.timing?.duration || 20,
        scene: shot.scene || '',
        mood: shot.mood || '',
        camera: shot.camera?.object || shot.camera || '',
        cameraString: cameraStr,
        lighting: shot.lighting?.object || shot.lighting || '',
        lightingString: lightingStr,
        characterRef: shot.characterRef || 'NONE',
        character: shot.character || 'NONE',
        action: shot.action || '',
        dialogue: shot.dialogue || 'NONE',
        timeline: shot.timeline?.object || shot.timeline || {},
        timelineString: timelineStr,
        backgroundSound: this._buildBackgroundSound(shot).object,
        backgroundSoundString: this._buildBackgroundSound(shot).string,
        prompt: prompt.fullPrompt,
        promptCharCount: promptLength
      };
      
      // 片头专属字段（仅 S00）
      const _meta = blueprint.config?._metadata || blueprint._metadata || {};
      const isSeries = _meta.isSeries || false;
      const episodeNumber = _meta.episodeNumber || 1;
      const hasOpening = isSeries ? (episodeNumber === 1) : true;
      
      if (shot.sceneType === 'opening' && hasOpening) {
        const audioLayer = this._buildAudioLayer(shot);
        const titleOverlay = this._buildTitleOverlay(blueprint);
        standardOutput.audioLayer = audioLayer.object;
        standardOutput.audioLayerString = audioLayer.string;
        standardOutput.titleOverlay = titleOverlay.object;
        standardOutput.titleOverlayString = titleOverlay.string;
      }
      
      engineeredShots.push(standardOutput);
      prompts.push(standardOutput);
    }
    
    return { shots: engineeredShots, prompts };
  }
  
  /**
   * v6.37-P0: 构建 mouthAction 字段（供Seedance对口型）
   */
  _buildMouthAction(shot) {
    const actionMap = {
      'opening': '嘴部自然闭合，面对镜头，准备开口',
      'establishing': '嘴部微张，观察时自然呼吸',
      'conflict': '嘴部紧闭，紧张时咬紧牙关',
      'emotional_climax': '嘴部张大，情感爆发时大声呼喊',
      'resolution': '嘴部放松，微笑，平静呼吸'
    };
    
    return actionMap[shot.sceneType] || '嘴部自然闭合';
  }
  
  /**
   * v6.37-P0: 构建 backgroundSound 字段（三段式）
   */
  _buildBackgroundSound(shot) {
    const type = shot.sceneType || 'normal';
    
    const soundMap = {
      'opening': {
        ambient: 'deep earth rumble 20-60Hz, epic atmosphere',
        spatial: '3D audio pan synchronized with camera movement',
        intensity: { crescendo: '0-3s', peak: '3-7s', decay: '7-10s' }
      },
      'establishing': {
        ambient: 'natural environment, wind and distant sounds',
        spatial: 'ambient stereo field',
        intensity: { steady: '0-100%', variations: 'subtle' }
      },
      'conflict': {
        ambient: 'tension building, low frequency rumble',
        spatial: 'directional audio pan',
        intensity: { building: '0-5s', peak: '5-8s', decay: '8-10s' }
      },
      'emotional_climax': {
        ambient: 'full frequency spectrum, rich harmonics',
        spatial: 'immersive surround',
        intensity: { maximum: '0-3s', sustain: '3-10s' }
      },
      'resolution': {
        ambient: 'gentle atmosphere, soft reverb',
        spatial: 'wide stereo field',
        intensity: { fading: '0-5s', quiet: '5-10s' }
      }
    };
    
    const soundObj = soundMap[type] || {
      ambient: 'neutral atmosphere',
      spatial: 'centered mono',
      intensity: { steady: '100%' }
    };
    
    // 字符串格式（用于Prompt融合）
    const intensityStr = Object.entries(soundObj.intensity).map(([k, v]) => `${k} ${v}`).join(', ');
    const soundStr = `AMBIENT: ${soundObj.ambient} | SPATIAL: ${soundObj.spatial} | INTENSITY: ${intensityStr}`;
    
    return {
      object: soundObj,
      string: soundStr
    };
  }
  
  /**
   * v6.37-P1+: 构建 audioLayer 字段（片头专属，结构化对象）
   */
  _buildAudioLayer(shot) {
    const segments = [
      { time: '0-3s', sound: 'sub-bass earth rumble fade in' },
      { time: '3-5s', sound: 'distant wind and environmental sounds' },
      { time: '5-8s', sound: 'string section long note' },
      { time: '8-10s', sound: 'timpani strike' }
    ];
    
    const audioStr = segments.map(s => s.sound).join(', ');
    
    return {
      object: { segments },
      string: audioStr
    };
  }
  
  /**
   * v6.37-P1+: 构建 titleOverlay 字段（片头专属，结构化对象）
   */
  _buildTitleOverlay(blueprint) {
    const config = blueprint.config || {};
    const worldSetting = blueprint.worldSetting || {};
    // v1.2.5-fix: 兼容顶层_metadata和config._metadata
    const _metadata = config._metadata || blueprint._metadata || {};
    
    // v1.2.5: 系列作品片头逻辑
    const isSeries = _metadata.isSeries || false;
    const episodeNumber = _metadata.episodeNumber || 1;
    const totalEpisodes = _metadata.totalEpisodes || 1;
    
    // 只有第一集显示完整片头title
    const showTitle = isSeries ? (episodeNumber === 1) : true;
    
    const titleObj = {
      mainTitle: showTitle ? (config.title || '未命名') : '',
      subtitle: showTitle ? (worldSetting.name || '系列作品') : '',
      producer: showTitle ? `by ${config.producer || 'Genius'}` : '',
      titleAnim: showTitle ? 'light-vein carving growth 3.0-5.0s' : 'none',
      episodeInfo: isSeries ? `第${episodeNumber}集 / 共${totalEpisodes}集` : ''
    };
    
    const titleStr = showTitle 
      ? `MAIN_TITLE: "${titleObj.mainTitle}" | SUBTITLE: "${titleObj.subtitle}" | PRODUCER: "${titleObj.producer}" | TITLE_ANIM: ${titleObj.titleAnim}`
      : `EPISODE: ${titleObj.episodeInfo} | TITLE_ANIM: none`;
    
    return {
      object: titleObj,
      string: titleStr
    };
  }

  /**
   * 🔊 v2.0-B+: 音频场景映射（极致视听融合）
   */
  _getAudioSceneMap() {
    return {
      'beach': { env: '海浪轻拍沙滩的白噪音，海鸟远处鸣叫', action: '白沙从指缝流下沙沙声', emotion: '温暖治愈的氛围音' },
      'ocean': { env: '海浪拍打礁石，海风呼啸', action: '水花溅起声', emotion: '自由辽阔的海洋气息' },
      'forest': { env: '风吹树叶沙沙声，远处溪流潺潺', action: '脚步声踩落叶', emotion: '宁静安详的自然氛围' },
      'city': { env: '车流白噪音，远处鸣笛', action: '快门声、键盘敲击', emotion: '都市节奏感' },
      'home': { env: '室内温暖环境音', action: '婴儿咯咯笑声', emotion: '温馨家庭氛围' },
      'mountain': { env: '山风呼啸，远处鸟鸣', action: '雪粉飞扬声', emotion: '壮丽寂静的高山氛围' },
      'studio': { env: '摄影棚安静环境', action: '快门咔嚓声', emotion: '专业专注的工作氛围' }
    };
  }

  /**
   * 🔊 v2.0-B+: 构建音频描述（自然语言格式，Seedance可理解）
   */
  _buildAudioDescription(shot) {
    const parts = [];
    const sceneName = (shot.sceneName || shot.scene || shot.setting || '').toLowerCase();
    const emotion = (shot.emotionPhase || shot.emotion || 'neutral').toLowerCase();
    const timeOfDay = (shot.timeOfDay || shot.lighting?.timeOfDay || 'golden hour').toLowerCase();
    
    const audioMap = this._getAudioSceneMap();
    let template = null;
    
    // 匹配场景类型
    for (const [key, t] of Object.entries(audioMap)) {
      if (sceneName.includes(key)) {
        template = t;
        break;
      }
    }
    
    // 回退：基于时间
    if (!template) {
      if (timeOfDay.includes('night') || timeOfDay.includes('dusk')) {
        template = { env: '夜晚虫鸣，远处低语', action: '轻柔脚步声', emotion: '神秘宁静的夜晚氛围' };
      } else {
        template = { env: '白天环境音', action: '自然动作声', emotion: '明亮日常氛围' };
      }
    }
    
    // L1: 环境音 - 自然语言格式
    parts.push(`伴随${template.env}`);
    
    // L2: 动作音 - 自然语言格式
    parts.push(`动作产生${template.action}`);
    
    // L3: 情绪音 - 自然语言格式
    const emotionAudioMap = {
      'warm': '温暖治愈的轻音乐渐入',
      'joy': '欢快的节奏音',
      'tense': '紧张的心跳声渐强',
      'sad': '低沉的弦乐余韵',
      'epic': '宏大的交响乐铺垫',
      'peaceful': '宁静的钢琴轻弹',
      'establishing': '环境音渐显，氛围建立',
      'climax': '全频段饱满，情绪峰值',
      'resolve': '音乐渐弱，余音缭绕'
    };
    const emotionSound = emotionAudioMap[emotion] || template.emotion;
    parts.push(`氛围弥漫${emotionSound}`);
    
    // L4: 声画同步（如果含对话）
    if (shot.dialogueText || shot.hasDialogue) {
      parts.push('声画精准同步，嘴型与发音对齐');
    }
    
    return parts.join('，');
  }

  /**
   * 构建单个镜头的完整 Prompt（v2.0-B+: 七层架构 + 极致视听融合 + v6.37-P0 字段对齐）
   * 
   * 融合顺序（按参考文档 v6.37-Peng）：
   * CharacterRef → Timeline → Dialogue → AudioLayer(片头) → TitleOverlay(片头) → 
   * BackgroundSound → Character → Action → Scene → Mood → Camera → Lighting → 
   * PhysicsLayer → ColorScience → NegativePrompt → RenderStyle → DirectorStyle
   * 
   * 七层结构：
   * L1: 约束层（P0必加）- 画幅/帧率/无字幕
   * L2: 基础层（P0必加）- 写实度/HDR/胶片质感
   * L3: 空间层（P1防平庸）- scene字段（五维空间）
   * L4: 主体层（P2防漂移）- character/action/dialogue
   * L5: 动态层（P1防平庸）- camera/timeline
   * L6: 风格层（P2防漂移）- mood/lighting
   * L7: 音频层（🔊 新增）- backgroundSound/audioLayer
   * L8: 内部层（扩展）- PhysicsLayer/ColorScience/NegativePrompt/RenderStyle/DirectorStyle
   * L9: 质控层（P0必加）- 负面约束/角色一致性
   */
  /**
   * 构建单个镜头的完整 Prompt（v6.37-P1+: 优先级截断 + 结构化对象）
   */
  _buildShotPrompt(shot, blueprint, structuredStrings = {}) {
    const { cameraStr, lightingStr, timelineStr } = structuredStrings;
    
    // v1.2.5: 从blueprint metadata中提取系列信息，控制片头和结尾
    // 修复：兼容顶层_metadata和config._metadata
    const _meta = blueprint._metadata || blueprint.config?._metadata || {};
    const isSeries = _meta.isSeries || false;
    const episodeNumber = _meta.episodeNumber || 1;
    const hasOpening = _meta.hasOpening !== false; // 默认true
    const noNextEpisodePreview = blueprint._metadata?.noNextEpisodePreview || false;
    
    // 检查当前镜头是否为片头/结尾，根据系列规则调整
    const isOpeningShot = shot.sceneType === 'opening' || shot.sceneType === 'establish';
    const isResolutionShot = shot.sceneType === 'resolution';
    
    // 定义优先级和截断策略（专家反馈）
    const priorityMap = {
      'L1_constraint': { priority: 'P0', strategy: 'never' },
      'L2_base': { priority: 'P0', strategy: 'never' },
      'L3_scene': { priority: 'P1', strategy: 'keep_core_location' },
      'L4_character': { priority: 'P0', strategy: 'minimal_anchor' },
      'L4_action': { priority: 'P1', strategy: 'keep_core_verb' },
      'L4_dialogue': { priority: 'P0', strategy: 'keep_core_dialogue' },
      'L5_camera': { priority: 'P1', strategy: 'keep_core_movement' },
      'L5_timeline': { priority: 'P2', strategy: 'keep_duration_type' },
      'L6_mood': { priority: 'P2', strategy: 'keyword_list' },
      'L6_lighting': { priority: 'P1', strategy: 'keep_main_light' },
      'L7_audio': { priority: 'P1', strategy: 'keep_core_sound' },
      'L8_internal': { priority: 'P2', strategy: 'truncate' },
      'L9_negative': { priority: 'P0', strategy: 'keep_top_3' }
    };
    
    const parts = [];
    const partMeta = [];
    
    // === L1: 约束层（P0必加）===
    // v1.2.5: 从blueprint.config读取画幅，默认16:9横屏
    const ratio = blueprint.config?.aspectRatio || '16:9';
    parts.push(`${ratio} cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic`);
    partMeta.push({ id: 'L1_constraint', priority: 'P0' });
    
    // === L2: 基础层（P0必加）===
    parts.push('hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film');
    partMeta.push({ id: 'L2_base', priority: 'P0' });
    
    // === L3: 空间层（P1）===
    if (shot.scene) {
      parts.push(shot.scene);
      partMeta.push({ id: 'L3_scene', priority: 'P1' });
    }
    
    // === L4: 主体层（P0-P1）===
    if (shot.character && shot.character !== 'NONE') {
      parts.push(shot.character);
      partMeta.push({ id: 'L4_character', priority: 'P0' });
    }
    
    if (shot.action) {
      parts.push(shot.action);
      partMeta.push({ id: 'L4_action', priority: 'P1' });
    }
    
    if (shot.dialogue && shot.dialogue !== '') {
      parts.push(`dialogue: ${shot.dialogue}`);
      partMeta.push({ id: 'L4_dialogue', priority: 'P0' });
    }
    
    // === L5: 动态层（P1-P2）===
    const camera = cameraStr || shot.camera;
    if (camera) {
      parts.push(camera);
      partMeta.push({ id: 'L5_camera', priority: 'P1' });
    }
    
    const timeline = timelineStr || shot.timeline;
    if (timeline) {
      parts.push(`timeline: ${timeline}`);
      partMeta.push({ id: 'L5_timeline', priority: 'P2' });
    }
    
    // === L6: 风格层（P1-P2）===
    if (shot.mood) {
      parts.push(`mood: ${shot.mood}`);
      partMeta.push({ id: 'L6_mood', priority: 'P2' });
    }
    
    const lighting = lightingStr || shot.lighting;
    if (lighting) {
      parts.push(lighting);
      partMeta.push({ id: 'L6_lighting', priority: 'P1' });
    }
    
    // === L7: 音频层（P1）===
    // v6.37-P1+: 使用字符串版本（避免对象输出）
    const bgSound = shot.backgroundSound?.string || shot.backgroundSound;
    if (bgSound && typeof bgSound === 'string') {
      parts.push(`audio: ${bgSound}`);
      partMeta.push({ id: 'L7_audio', priority: 'P1' });
    }
    
    const audioLayer = shot.audioLayer?.string || shot.audioLayer;
    if (audioLayer && audioLayer !== '' && typeof audioLayer === 'string') {
      parts.push(`audioLayer: ${audioLayer}`);
      partMeta.push({ id: 'L7_audio', priority: 'P1' });
    }
    
    // === L8: 内部层（P2）===
    if (shot.physicsLayer && shot.physicsLayer !== '') {
      parts.push(`physics: ${shot.physicsLayer}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.colorScience && shot.colorScience !== '') {
      parts.push(`color: ${shot.colorScience}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.renderStyle && shot.renderStyle !== '') {
      parts.push(`style: ${shot.renderStyle}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.directorStyle && shot.directorStyle !== '') {
      parts.push(`director: ${shot.directorStyle}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    // === L9: 质控层（P0）===
    if (shot.worldId && shot.worldId !== 'default') {
      parts.push(`${shot.worldId} world`);
    }
    
    const negativeConstraints = [
      'no watermark, no logo, no text overlay, no subtitle, no caption',
      'blurry, low resolution, pixelated, compression artifacts',
      'cartoon, anime, illustration, 3D render look, CGI appearance, plastic look',
      'distorted perspective, impossible geometry, floating objects',
      'flat lighting, overexposed, crushed blacks, double shadows',
      'unnatural physics, fake water, static water, cardboard texture, plastic foliage'
    ];
    
    if (shot.characters?.length > 0 || shot.character) {
      negativeConstraints.push('distorted face, deformed face, extra fingers, plastic skin, waxy skin, unnatural pose');
    }
    
    if (shot.worldId && shot.worldId !== 'default') {
      negativeConstraints.push('natural eye colors only, no metallic shine');
    }
    parts.push(...negativeConstraints);
    partMeta.push({ id: 'L9_negative', priority: 'P0' });
    
    if (shot.characters?.length > 0) {
      parts.push(`角色一致性：保持${shot.characters.join('、')}形象一致，杜绝分身重影`);
    }
    
    const fullPrompt = parts.join('，');
    
    // v6.37-P1+: 优先级截断（专家反馈）
    const truncated = this._truncateWithPriority(fullPrompt, this.config.maxPromptLength, partMeta, parts);
    
    return {
      fullPrompt: truncated,
      rawPrompt: fullPrompt,
      parts,
      partMeta,
      wasTruncated: fullPrompt.length !== truncated.length,
      audioIncluded: !!shot.backgroundSound
    };
  }
  
  /**
   * v6.37-P1+: 优先级截断策略（专家反馈）
   * P0: 永不截断（characterRef/dialogue/titleOverlay/character/negative）
   * P1: 保留核心（camera/action/scene/lighting/backgroundSound/audioLayer）
   * P2: 可截断（mood/timeline/physicsLayer/colorScience/renderStyle/directorStyle）
   */
  _truncateWithPriority(prompt, maxLength, partMeta, parts) {
    if (prompt.length <= maxLength) return prompt;
    
    // 按优先级排序（P2优先截断，P1次之，P0永不截断）
    const p2Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P2');
    const p1Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P1');
    const p0Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P0');
    
    // 先截断P2字段（保留最少信息）
    let reduced = p0Parts.concat(p1Parts).concat(p2Parts.map(p => this._minimizePart(p, 'P2')));
    let result = reduced.join('，');
    
    if (result.length <= maxLength) return result;
    
    // 再截断P1字段（保留核心信息）
    reduced = p0Parts.concat(p1Parts.map(p => this._minimizePart(p, 'P1'))).concat(p2Parts.map(p => this._minimizePart(p, 'P2')));
    result = reduced.join('，');
    
    if (result.length <= maxLength) return result;
    
    // 如果还超长，截断到maxLength（保留开头和结尾的P0字段）
    const startP0 = p0Parts.slice(0, 2).join('，');
    const endP0 = p0Parts.slice(-2).join('，');
    const mid = result.substring(startP0.length, result.length - endP0.length);
    const available = maxLength - startP0.length - endP0.length - 2;
    
    return startP0 + '，' + mid.substring(0, available) + '，' + endP0;
  }
  
  /**
   * 最小化部分（按策略）
   */
  _minimizePart(part, priority) {
    if (priority === 'P2') {
      // P2: 只保留前20字符
      return part.substring(0, 20) + '...';
    }
    if (priority === 'P1') {
      // P1: 保留核心（逗号前的主语）
      const core = part.split('，')[0];
      return core.length < part.length ? core + '...' : part;
    }
    return part;
  }

  /**
   * 🔊 v2.0-B+: 截断保护（保留音频层和角色一致性）
   */
  _truncatePromptWithAudioProtection(prompt, maxLength) {
    if (prompt.length <= maxLength) return prompt;
    
    // 保护末尾：角色一致性 + 音频层（如果存在）
    const lastPart = '角色一致性：保持形象一致，杜绝分身重影';
    
    // 检查是否包含音频描述
    const hasAudio = prompt.includes('伴随') && prompt.includes('氛围弥漫');
    let audioPart = '';
    if (hasAudio) {
      const audioMatch = prompt.match(/伴随[^，]*，[^，]*氛围弥漫[^，]*(?:，[^，]*声画精准同步[^，]*)?/);
      if (audioMatch) {
        audioPart = audioMatch[0];
      }
    }
    
    const protectParts = [lastPart];
    if (audioPart) protectParts.unshift(audioPart);
    
    const protectText = protectParts.join('，');
    const availableLength = maxLength - protectText.length - 2;
    
    if (availableLength > 50) {
      return prompt.substring(0, availableLength) + '，' + protectText;
    }
    
    return prompt.substring(0, maxLength);
  }

  /**
   * 截断 Prompt（旧方法，保留向后兼容）
   */
  _truncatePrompt(prompt, maxLength) {
    return this._truncatePromptWithAudioProtection(prompt, maxLength);
  }

  /**
   * 构建定妆照引用
   */
  _buildImageReferences(shot, blueprint) {
    const refs = [];
    const characters = blueprint.characters || [];
    
    for (const cid of (shot.characters || [])) {
      const char = characters.find(c => c.character_id === cid);
      if (!char) continue;
      
      const portraits = char.portraits || {};
      
      // 选择最佳角度
      const angle = this._selectBestAngle(shot.sceneType, Object.keys(portraits));
      const path = portraits[angle];
      
      if (path) {
        refs.push({
          characterId: cid,
          characterName: char.name,
          angle,
          path,
          description: this._buildImageDescription(char, angle)
        });
      }
    }
    
    return refs;
  }

  /**
   * 选择最佳角度
   */
  _selectBestAngle(sceneType, availableAngles) {
    if (!availableAngles || availableAngles.length === 0) return null;
    
    const priority = {
      'opening': ['front', 'threeQuarter', 'closeup'],
      'establishing': ['threeQuarter', 'front', 'closeup'],
      'conflict': ['closeup', 'threeQuarter', 'front'],
      'emotional_climax': ['closeup', 'front', 'threeQuarter'],
      'resolution': ['threeQuarter', 'front', 'closeup']
    };
    
    const preferred = priority[sceneType] || ['threeQuarter', 'front', 'closeup'];
    
    for (const angle of preferred) {
      if (availableAngles.includes(angle)) return angle;
    }
    
    return availableAngles[0];
  }

  /**
   * 构建定妆照描述
   */
  _buildImageDescription(character, angle) {
    const angleDesc = {
      'front': '正面',
      'threeQuarter': '侧面',
      'closeup': '近景',
      'side': '另一侧面'
    };
    
    const features = character.visual_anchor?.core_features || [];
    return `${character.name}${angleDesc[angle] || angle}，${features.join('，')}，超写实`;
  }

  /**
   * v6.37-P0: 字符计数
   */
  _countChars(text) {
    if (!text) return 0;
    // 计算字符数（包括中英文）
    let count = 0;
    for (const char of text) {
      count++;
    }
    return count;
  }

  /**
   * Stage 5: 质量门校验
   * v6.37-P2: 审核增强 - 检查新字段格式与完整性
   */
  _runQualityGate(prompts) {
    const checks = [];
    
    for (const p of prompts) {
      const check = {
        shotId: p.shotId,
        promptLength: p.promptCharCount || p.length || 0,
        
        // v6.37-P2: 核心字段检查（适配结构化对象）
        hasScene: !!p.scene && p.scene.length > 10,
        hasMood: !!p.mood && p.mood.split(',').length >= 3,
        hasCamera: !!(p.camera?.string || p.camera) && (p.camera?.string || p.camera).toString().length > 10,
        hasLighting: !!(p.lighting?.string || p.lighting) && (p.lighting?.string || p.lighting).toString().includes('K'),
        hasCharacter: !!p.character && p.character !== 'NONE',
        hasAction: !!p.action && p.action.length > 5,
        hasDialogue: !!p.dialogue && p.dialogue !== 'NONE',
        hasTimeline: !!(p.timeline?.string || p.timeline) && (p.timeline?.string || p.timeline).toString().includes('T00:'),
        hasBackgroundSound: !!(p.backgroundSound?.string || p.backgroundSound) && (p.backgroundSound?.string || p.backgroundSound).toString().includes('AMBIENT:'),
        
        // 片头专属检查
        isOpening: p.shotId === 'S00',
        hasAudioLayer: p.shotId === 'S00' ? (!!p.audioLayer?.string && p.audioLayer.string.length > 10) : true,
        hasTitleOverlay: p.shotId === 'S00' ? (!!p.titleOverlay?.string && p.titleOverlay.string.includes('MAIN_TITLE:')) : true,
        
        // 字符数检查
        withinLimit: (p.promptCharCount || p.length || 0) <= this.config.maxPromptLength,
        
        // 格式检查
        characterRefFormat: p.characterRef === 'NONE' || p.characterRef.includes('image://'),
        dialogueFormat: p.dialogue === 'NONE' || p.dialogue.includes('|'),
        timelineFormat: (p.timeline?.string || p.timeline) === 'NONE' || (p.timeline?.string || p.timeline).toString().includes('T00:'),
        
        // 通用检查
        noForbidden: !p.prompt.includes('暗黑风') || p.prompt.includes('暗黑风') && p.prompt.indexOf('暗黑风') > p.prompt.length - 50
      };
      
      // v6.37-P2: 综合通过条件（更严格）
      check.passed = 
        check.hasScene && 
        check.hasMood && 
        check.hasCamera && 
        check.hasLighting &&
        check.hasAction &&
        check.hasTimeline &&
        check.hasBackgroundSound &&
        check.withinLimit &&
        check.characterRefFormat &&
        check.dialogueFormat &&
        check.timelineFormat &&
        check.hasAudioLayer &&
        check.hasTitleOverlay;
      
      checks.push(check);
    }
    
    const allPassed = checks.every(c => c.passed);
    
    return {
      passed: allPassed,
      checks,
      totalPrompts: prompts.length,
      passedCount: checks.filter(c => c.passed).length,
      failedFields: checks.filter(c => !c.passed).map(c => ({
        shotId: c.shotId,
        failed: Object.entries(c).filter(([k, v]) => k.startsWith('has') && !v).map(([k]) => k)
      }))
    };
  }

  /**
   * Stage 6: 片头生成
   * v6.37-P0: 产出符合片头结构（15字段）
   */
  _generateOpening(blueprint) {
    const config = blueprint.config || {};
    const worldSetting = blueprint.worldSetting || {};
    const beastId = config.featured_beast_id;
    
    if (!beastId) {
      return { generated: false, reason: '无 featured_beast_id' };
    }
    
    // v6.37-P1+: 构建标准片头结构（结构化对象 + 字符串）
    const openingData = {
      shotId: 'S00',
      duration: config.opening_duration || 10,
      scene: this._buildOpeningScene(worldSetting),
      mood: 'epic, mysterious, awe-inspiring',
      // 结构化 camera 对象
      camera: {
        shotSize: 'extreme wide',
        movement: 'dolly in',
        lens: '24mm',
        speed: 0.3,
        aperture: 'f/2.8',
        focus: 'rack focus from atmosphere to ground'
      },
      cameraString: 'epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed',
      // 结构化 lighting 对象
      lighting: {
        keyLight: { direction: 'backlight', colorTemp: 3200, effect: 'golden hour rim' },
        fillLight: { direction: 'ambient', colorTemp: 6500, effect: 'cool fill' },
        special: 'volumetric god rays'
      },
      lightingString: 'backlight 3200K, golden hour rim, volumetric god rays',
      characterRef: 'NONE',
      character: 'NONE',
      action: 'establishing shot, camera slowly descending through atmospheric layers',
      dialogue: 'NONE',
      // 结构化 timeline 对象
      timeline: {
        start: 'T00:00',
        end: 'T00:10',
        duration: 10,
        type: 'opening',
        mood: 'epic'
      },
      timelineString: 'T00:00-T00:10 / duration: 10s / type: opening / mood: epic',
      // 结构化 audioLayer 对象
      audioLayer: {
        segments: [
          { time: '0-3s', sound: 'sub-bass earth rumble fade in' },
          { time: '3-5s', sound: 'distant wind and environmental sounds' },
          { time: '5-8s', sound: 'string section long note' },
          { time: '8-10s', sound: 'timpani strike' }
        ]
      },
      audioLayerString: 'Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s',
      // 结构化 titleOverlay 对象
      titleOverlay: {
        mainTitle: config.title || '未命名',
        subtitle: worldSetting.name || '系列作品',
        producer: `by ${config.producer || 'Genius'}`,
        titleAnim: 'light-vein carving growth 3.0-5.0s'
      },
      titleOverlayString: `MAIN_TITLE: "${config.title || '未命名'}" | SUBTITLE: "${worldSetting.name || '系列作品'}" | PRODUCER: "by ${config.producer || 'Genius'}" | TITLE_ANIM: light-vein carving growth 3.0-5.0s`,
      // 结构化 backgroundSound 对象
      backgroundSound: {
        ambient: 'deep earth rumble 20-60Hz, epic atmosphere',
        spatial: '3D audio pan synchronized with camera movement',
        intensity: { crescendo: '0-3s', peak: '3-7s', decay: '7-10s' }
      },
      backgroundSoundString: 'AMBIENT: epic atmosphere, deep earth rumble 20-60Hz | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s',
      prompt: '', // 由 Prompt 工程构建
      promptCharCount: 0
    };
    
    // 构建片头 Prompt（传入结构化字符串）
    const prompt = this._buildShotPrompt(openingData, blueprint, {
      cameraStr: openingData.cameraString,
      lightingStr: openingData.lightingString,
      timelineStr: openingData.timelineString
    });
    openingData.prompt = prompt.fullPrompt;
    openingData.promptCharCount = this._countChars(prompt.fullPrompt);
    
    return { 
      generated: true,
      openingData,
      shotId: 'S00',
      type: 'opening',
      beastId
    };
  }
  
  _buildOpeningScene(worldSetting) {
    const worldName = worldSetting.name || worldSetting.world_id || 'Unknown World';
    const atmosphere = worldSetting.atmosphere || 'mysterious';
    const timeOfDay = worldSetting.time_of_day || 'golden hour';
    const depth = worldSetting.spatial_depth || 'atmospheric layers';
    
    return `${worldName}, ${atmosphere} atmosphere, ${timeOfDay} lighting, ${depth}, spatial depth: infinite`;
  }

  /**
   * Stage 7: 连续性检查
   * v6.37-P0: 适配新字段结构（characterRef 替代 imageRefs）
   */
  _checkContinuity(prompts) {
    const issues = [];
    
    // 检查角色连续性（从 characterRef 解析）
    const characterMentions = prompts.map((p, idx) => {
      const chars = this._parseCharacterRefForContinuity(p.characterRef);
      return { idx, chars };
    });
    
    // 检查时序连续性
    for (let i = 1; i < prompts.length; i++) {
      const prev = prompts[i - 1];
      const curr = prompts[i];
      
      const prevChars = this._parseCharacterRefForContinuity(prev.characterRef);
      const currChars = this._parseCharacterRefForContinuity(curr.characterRef);
      
      // 检查是否有共享角色
      const sharedChars = prevChars.filter(c => currChars.includes(c));
      
      if (sharedChars.length === 0 && prevChars.length > 0 && currChars.length > 0) {
        issues.push({
          type: 'character_gap',
          between: [prev.shotId, curr.shotId],
          message: '相邻镜头无共享角色，可能导致叙事断裂'
        });
      }
    }
    
    return {
      passed: issues.length === 0,
      issues,
      promptCount: prompts.length
    };
  }
  
  /**
   * v6.37-P0: 从 characterRef 解析角色名（用于连续性检查）
   */
  _parseCharacterRefForContinuity(characterRef) {
    if (!characterRef || characterRef === 'NONE') return [];
    
    const chars = [];
    const parts = characterRef.split(' | ');
    
    for (const part of parts) {
      const match = part.match(/(.+?):\s*/);
      if (match) {
        chars.push(match[1].trim());
      }
    }
    
    return chars;
  }

  /**
   * v6.37+: 构建 portraits 数组（FieldGuard 要求的关键字段）
   */
  _buildPortraits(shot, blueprint) {
    const portraits = [];
    const characters = shot.characters || blueprint.characters || [];
    
    for (const char of characters) {
      // v6.37+: 预生产阶段如果没有定妆照，生成占位符记录，避免FieldGuard警告
      portraits.push({
        character: char.name || char.id || 'unknown',
        characterId: char.id || char.name || 'unknown',
        url: char.portraitUrl || 'PENDING_GENERATION',
        angle: 'default',
        source: char.portraitUrl ? 'character_system' : 'pending'
      });
    }
    
    return portraits;
  }

  /**
   * v6.37+: 构建 characterCards 数组（FieldGuard 要求的关键字段）
   */
  _buildCharacterCards(shot, blueprint) {
    const cards = [];
    const characters = shot.characters || blueprint.characters || [];
    
    for (const char of characters) {
      cards.push({
        characterId: char.id || char.name || 'unknown',
        name: char.name || char.id || '未知角色',
        role: char.role || 'supporting',
        description: char.description || char.persona || '',
        voiceProfile: char.voiceProfile || char.voice_profile || {}
      });
    }
    
    return cards;
  }

  /**
   * 生成生产报告
   */
  generateReport(result) {
    return {
      engine: 'ProductionEngine',
      version: '1.0.0',
      success: result.success,
      summary: {
        totalShots: result.shots.length,
        totalPrompts: result.prompts.length,
        totalDuration: result.shots.reduce((sum, s) => sum + s.timing.duration, 0),
        avgPromptLength: result.prompts.reduce((sum, p) => sum + p.length, 0) / result.prompts.length
      },
      stages: Object.fromEntries(
        Object.entries(result.stages).map(([k, v]) => [k, {
          duration: v._stageDuration || 0,
          success: !v.error
        }])
      ),
      errors: result.errors,
      timing: result.timing
    };
  }
}

module.exports = { ProductionEngine };
