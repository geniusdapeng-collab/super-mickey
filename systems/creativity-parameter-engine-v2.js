const fs = require('fs');
const path = require('path');

/**
 * 创意参数引擎 v2.0 — 14模块细粒度控制
 * 
 * 融合设计：
 * - 吸收对方14模块的细粒度控制思想
 * - 与现有161技能库联动（Stage 8.4）
 * - 安全边界：所有模块 scope: exterior_only
 * - 动态阈值：根据影片类型自动调整
 * - 向后兼容：默认CP=0.5
 * 
 * 14个模块：
 * 1. 运镜风格 (camera)
 * 2. 灯光设计 (lighting)
 * 3. 美术布景 (production)
 * 4. 剪辑节奏 (editing)
 * 5. 声音设计 (sound)
 * 6. 色彩分级 (color)
 * 7. 构图风格 (composition)
 * 8. 表演指导 (performance)
 * 9. 特效程度 (vfx)
 * 10. 镜头语言 (cinematic)
 * 11. 氛围营造 (atmosphere)
 * 12. 质感处理 (texture)
 * 13. 时间操控 (time)
 * 14. 空间设计 (space)
 */

class CreativityParameterEngineV2 {
  constructor(creativityParameter = 0.5, filmType = 'educational') {
    this.cp = Math.max(0.0, Math.min(1.0, creativityParameter));
    this.filmType = filmType;
    this.version = '2.0.0';
    
    // 14个模块定义（含动态阈值）
    this.modules = this._defineModules();
    
    // 5个等级定义
    this.levels = [
      { max: 0.2, name: '极简', key: 'minimal', description: '基础功能，最小干预' },
      { max: 0.4, name: '标准', key: 'standard', description: '标准质量，适度增强' },
      { max: 0.6, name: '增强', key: 'enhanced', description: '电影级质量，专业效果' },
      { max: 0.8, name: '艺术', key: 'artistic', description: '艺术级表现，风格化' },
      { max: 1.0, name: '极致', key: 'extreme', description: '极致表现，突破常规' }
    ];
    
    // 影片类型调整系数（科普片阈值更高）
    this.typeAdjustments = {
      'educational': { thresholdBoost: 0.15, maxIntensity: 0.8, name: '科普片' },
      'documentary': { thresholdBoost: 0.1, maxIntensity: 0.9, name: '纪录片' },
      'commercial': { thresholdBoost: -0.05, maxIntensity: 1.0, name: '广告片' },
      'brand': { thresholdBoost: -0.05, maxIntensity: 1.0, name: '品牌片' },
      'drama': { thresholdBoost: -0.1, maxIntensity: 1.0, name: '剧情片' },
      'action': { thresholdBoost: -0.1, maxIntensity: 1.0, name: '动作片' },
      'sci-fi': { thresholdBoost: -0.1, maxIntensity: 1.0, name: '科幻片' },
      'horror': { thresholdBoost: -0.05, maxIntensity: 1.0, name: '恐怖片' },
      'universal': { thresholdBoost: 0.0, maxIntensity: 1.0, name: '通用' }
    };
    
    // 安全边界声明
    this.SAFE_DIMENSIONS = [
      'visual_style', 'movement_style', 'lighting', 'color_grading',
      'composition', 'texture', 'shot_complexity', 'production_design',
      'sound_design', 'atmosphere', 'spatial_design', 'temporal_manipulation',
      'vfx_level', 'cinematic_language'
    ];
    
    this.PROTECTED_DIMENSIONS = [
      'script_content', 'medical_facts', 'character_identity',
      'dialogue_meaning', 'narrative_structure', 'core_message',
      'educational_accuracy', 'brand_information'
    ];
  }

  _defineModules() {
    return {
      camera: {
        name: '运镜风格',
        threshold: 0.35,
        stages: ['9'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础运镜：推轨、简单环绕、固定切换',
          standard: '标准运镜：手持跟拍、轨道滑动、基础景深',
          enhanced: '电影级运镜：斯坦尼康长镜头、轨道滑动、浅景深跟随',
          artistic: '艺术级运镜：无人机航拍、微距探入、旋转环绕、POV主观',
          extreme: '极致运镜：维伦纽瓦式史诗构图、诺兰式时间操控、王家卫式抽帧、IMAX画幅'
        }
      },
      lighting: {
        name: '灯光设计',
        threshold: 0.30,
        stages: ['10', '11'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础灯光：三点布光、柔光、自然光模拟',
          standard: '标准灯光：标准布光、柔光箱、反光板',
          enhanced: '电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充',
          artistic: '艺术级灯光：霓虹色温、体积光、光绘、投影纹理',
          extreme: '极致灯光：德金斯特式黑色电影、罗杰·迪金斯式环境光、光作为叙事角色'
        }
      },
      production: {
        name: '美术布景',
        threshold: 0.40,
        stages: ['5B', '10'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础布景：简洁背景、功能化道具、最少装饰',
          standard: '标准布景：标准场景、基础道具、环境元素',
          enhanced: '电影级布景：场景层次、前景遮挡、背景故事化道具',
          artistic: '艺术级布景：概念化场景、超现实比例、象征性道具',
          extreme: '极致布景：定制化场景建筑、色彩编码空间、沉浸式环境叙事'
        }
      },
      editing: {
        name: '剪辑节奏',
        threshold: 0.45,
        stages: ['6', '7'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础节奏：标准镜头时长、匀速切换',
          standard: '标准节奏：标准时长分配、平滑过渡',
          enhanced: '电影级节奏：情绪匹配时长、紧张处快切、情感处延长',
          artistic: '艺术级节奏：变速剪辑、J型L型剪辑、节奏对比',
          extreme: '极致节奏：音乐同步剪辑、帧率切换、时间膨胀/压缩'
        }
      },
      sound: {
        name: '声音设计',
        threshold: 0.35,
        stages: ['12'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础声音：清晰对白、环境音填充、标准配乐',
          standard: '标准声音：标准音频、清晰对白、环境音',
          enhanced: '电影级声音：ASMR细节、3D空间音频、情绪配乐',
          artistic: '艺术级声音：声音景观设计、动态音乐、情绪音效',
          extreme: '极致声音：汉斯·季默式史诗配乐、声音作为叙事驱动、每个视觉元素专属音景'
        }
      },
      color: {
        name: '色彩分级',
        threshold: 0.30,
        stages: ['10', '11'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础色彩：自然色温、标准饱和度、白平衡',
          standard: '标准色彩：标准调色、自然色温、适度饱和度',
          enhanced: '电影级色彩：电影LUT、冷暖对比、单色调色',
          artistic: '艺术级色彩：赛博朋克色、青橙对比、去饱和+单色强调',
          extreme: '极致色彩：维伦纽瓦式琥珀色、王家卫式霓虹色、诺兰式冷蓝、单色世界'
        }
      },
      composition: {
        name: '构图风格',
        threshold: 0.35,
        stages: ['9', '10'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础构图：三分法、中心对称、标准景别',
          standard: '标准构图：标准景别、标准角度、平衡构图',
          enhanced: '电影级构图：框架构图、引导线、前景遮挡、深度层次',
          artistic: '艺术级构图：极端对称、负空间、几何分割、打破三分法',
          extreme: '极致构图：维伦纽瓦式宏大比例、韦斯·安德森式对称、抽象构图'
        }
      },
      performance: {
        name: '表演指导',
        threshold: 0.40,
        stages: ['5B'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础表演：自然表情、标准肢体语言、专业稳重',
          standard: '标准表演：标准表情、标准肢体语言、专业表现',
          enhanced: '电影级表演：情感层次、微表情、眼神变化、手势设计',
          artistic: '艺术级表演：情绪化表演、即兴感、打破第四面墙、象征性动作',
          extreme: '极致表演：方法派表演、情绪爆发、角色化肢体语言、表演即叙事'
        }
      },
      vfx: {
        name: '特效程度',
        threshold: 0.50,
        stages: ['11'],
        scope: 'exterior_only',
        instructions: {
          minimal: '无特效：纯实拍、无后期特效',
          standard: '基础特效：粒子光斑、简单过渡、环境粒子',
          enhanced: '电影级特效：光效粒子、镜头光晕、环境互动粒子',
          artistic: '艺术级特效：复杂粒子系统、流体模拟、光绘轨迹',
          extreme: '极致特效：全息投影、空间扭曲、时间残影、量子可视化'
        }
      },
      cinematic: {
        name: '镜头语言',
        threshold: 0.45,
        stages: ['9'],
        scope: 'exterior_only',
        instructions: {
          minimal: '标准镜头：标准景别切换、客观视角',
          standard: '标准语言：标准镜头切换、标准视角',
          enhanced: '电影级语言：主观视角插入、反应镜头、过肩镜头',
          artistic: '艺术级语言：元叙事镜头、打破第四面墙、观众意识',
          extreme: '极致语言：自我反射式电影、多重现实、镜头即角色'
        }
      },
      atmosphere: {
        name: '氛围营造',
        threshold: 0.35,
        stages: ['10'],
        scope: 'exterior_only',
        instructions: {
          minimal: '基础氛围：标准环境、轻微雾效',
          standard: '标准氛围：标准环境感、基础氛围',
          enhanced: '电影级氛围：环境雾、体积雾、光雾交互、季节感',
          artistic: '艺术级氛围：超现实氛围、梦境感、时间错位感',
          extreme: '极致氛围：塔可夫斯基式诗意、毕赣式梦境、时间流动性'
        }
      },
      texture: {
        name: '质感处理',
        threshold: 0.55,
        stages: ['11'],
        scope: 'exterior_only',
        instructions: {
          minimal: '数字清晰：标准数字质感、无颗粒',
          standard: '标准质感：轻微胶片颗粒、标准锐度',
          enhanced: '电影级质感：胶片颗粒、柯达2383质感、轻微柔光',
          artistic: '艺术级质感：16mm胶片感、变形宽银幕、光学瑕疵',
          extreme: '极致质感：湿版摄影质感、手绘动画质感、AI生成瑕疵美学'
        }
      },
      time: {
        name: '时间操控',
        threshold: 0.50,
        stages: ['6', '9'],
        scope: 'exterior_only',
        instructions: {
          minimal: '标准时间：标准速度、正常时间流',
          standard: '标准操控：标准时间流、标准节奏',
          enhanced: '电影级操控：慢动作强调、快切压缩、时间标记',
          artistic: '艺术级操控：时间膨胀、时间倒流、平行时间线',
          extreme: '极致操控：诺兰式时间操控、时间作为角色、非线性时间'
        }
      },
      space: {
        name: '空间设计',
        threshold: 0.45,
        stages: ['10'],
        scope: 'exterior_only',
        instructions: {
          minimal: '标准空间：标准景深、单平面构图',
          standard: '标准空间：标准景深、标准层次',
          enhanced: '电影级空间：多层景深、前景中景背景、空间层次',
          artistic: '艺术级空间：超现实空间、不可能几何、空间错位',
          extreme: '极致空间：埃舍尔式空间、多维空间、空间作为叙事'
        }
      }
    };
  }

  getLevelInfo() {
    for (const level of this.levels) {
      if (this.cp <= level.max) {
        return {
          cp: this.cp,
          level: level.name,
          levelKey: level.key,
          style: level.key, // 兼容 v1 的 style 字段
          description: level.description
        };
      }
    }
    return {
      ...this.levels[this.levels.length - 1],
      style: this.levels[this.levels.length - 1].key
    };
  }

  getActiveModules() {
    const adjustment = this.typeAdjustments[this.filmType] || this.typeAdjustments['universal'];
    const adjustedCP = Math.min(this.cp, adjustment.maxIntensity);
    
    const active = [];
    for (const [id, module] of Object.entries(this.modules)) {
      const adjustedThreshold = Math.max(0.1, module.threshold + adjustment.thresholdBoost);
      if (adjustedCP >= adjustedThreshold) {
        const intensity = Math.min(1.0, adjustedCP / adjustment.maxIntensity);
        active.push({
          id,
          name: module.name,
          threshold: adjustedThreshold,
          intensity,
          stages: module.stages,
          scope: module.scope,
          instruction: this._getModuleInstruction(module, adjustedCP)
        });
      }
    }
    
    return {
      filmType: this.filmType,
      filmTypeName: adjustment.name,
      adjustedCP,
      maxIntensity: adjustment.maxIntensity,
      totalModules: Object.keys(this.modules).length,
      activeModules: active.length,
      modules: active
    };
  }

  _getModuleInstruction(module, cp) {
    for (const level of this.levels) {
      if (cp <= level.max) {
        return {
          level: level.name,
          levelKey: level.key,
          instruction: module.instructions[level.key]
        };
      }
    }
    return {
      level: '极致',
      levelKey: 'extreme',
      instruction: module.instructions['extreme']
    };
  }

  getStageInjections(stageName) {
    const active = this.getActiveModules();
    const stageModules = active.modules.filter(m => m.stages.includes(stageName));
    
    if (stageModules.length === 0) {
      return null;
    }
    
    return {
      stage: stageName,
      moduleCount: stageModules.length,
      injections: stageModules.map(m => ({
        moduleId: m.id,
        moduleName: m.name,
        level: m.instruction.level,
        instruction: m.instruction.instruction,
        intensity: m.intensity,
        scope: m.scope
      }))
    };
  }

  getSkillInjectionParams() {
    const active = this.getActiveModules();
    const cameraModule = active.modules.find(m => m.id === 'camera');
    const lightingModule = active.modules.find(m => m.id === 'lighting');
    const compositionModule = active.modules.find(m => m.id === 'composition');
    
    let maxTerms = 0;
    if (this.cp >= 0.8) maxTerms = 8;
    else if (this.cp >= 0.6) maxTerms = 6;
    else if (this.cp >= 0.4) maxTerms = 4;
    else if (this.cp >= 0.2) maxTerms = 2;
    
    // v6.6.4-root-fix: 降低技能注入阈值，确保默认CP也能启用基础技能
    // 之前 threshold=0.4 导致默认CP=0.2时技能系统完全禁用，用户无法获得任何导演风格
    const enabled = this.cp >= 0.2;
    
    return {
      enabled,
      maxTerms,
      aggressiveness: this.cp >= 0.8 ? '极致技能，6-8个术语' : 
                     this.cp >= 0.6 ? '深度技能，4-6个术语' :
                     this.cp >= 0.4 ? '标准技能，2-4个术语' : '基础技能，1-2个术语',
      filmType: this.filmType,
      activeModules: active.modules.map(m => m.id),
      cameraLevel: cameraModule?.instruction.levelKey || 'none',
      lightingLevel: lightingModule?.instruction.levelKey || 'none',
      compositionLevel: compositionModule?.instruction.levelKey || 'none'
    };
  }

  getSafetyReport() {
    return {
      safeDimensions: this.SAFE_DIMENSIONS,
      protectedDimensions: this.PROTECTED_DIMENSIONS,
      scope: 'exterior_only',
      guarantee: '所有创意参数只影响外在表现维度，不修改内容层（剧本、事实、医学数据、角色、对白）'
    };
  }

  /**
   * 兼容 v1 的 getStageConfig 方法
   * 根据 stageName 返回该阶段的创意配置
   * @param {string} stageName - 阶段名称，如 '1-prd', '5-script', '9-camera', '11-render', '14-style'
   * @returns {object|null} - 该阶段的配置对象
   */
  getStageConfig(stageName) {
    const levelInfo = this.getLevelInfo();
    const levelKey = levelInfo.levelKey;
    
    // 将 v1 的 stageName 映射到 v2 的模块
    const stageModuleMap = {
      '1-prd': ['production', 'atmosphere'],
      '5-script': ['performance'],
      '5B': ['performance', 'production'],
      '6': ['editing', 'time'],
      '7': ['editing'],
      '7-storyboard': ['composition', 'camera'],
      '9': ['camera', 'composition', 'cinematic', 'time'],
      '9-camera': ['camera', 'composition'],
      '10': ['lighting', 'color', 'atmosphere', 'space'],
      '11': ['lighting', 'color', 'vfx', 'texture', 'atmosphere'],
      '11-render': ['lighting', 'color', 'texture', 'atmosphere'],
      '12': ['sound'],
      '14': ['color', 'texture'],
      '14-style': ['color', 'texture']
    };
    
    const moduleIds = stageModuleMap[stageName] || [];
    if (moduleIds.length === 0) {
      return null;
    }
    
    const activeModules = this.getActiveModules().modules;
    const result = {};
    
    for (const moduleId of moduleIds) {
      const module = activeModules.find(m => m.id === moduleId);
      if (module) {
        result[moduleId] = {
          level: module.instruction.level,
          instruction: module.instruction.instruction,
          intensity: module.intensity
        };
      } else {
        // 模块未激活，返回基础配置
        result[moduleId] = {
          level: '未激活',
          instruction: '系统默认',
          intensity: 0
        };
      }
    }
    
    // 添加兼容 v1 的字段
    result.visualStyle = this._getVisualStyle(levelKey);
    result.narrativeStyle = this._getNarrativeStyle(levelKey);
    result.promptQuality = this._getPromptQuality(levelKey);
    result.lightingComplexity = this._getLightingComplexity(levelKey);
    result.colorGrading = this._getColorGrading(levelKey);
    result.toneStyle = this._getToneStyle(levelKey);
    result.textureQuality = this._getTextureQuality(levelKey);
    
    return result;
  }
  
  _getVisualStyle(levelKey) {
    const styles = {
      minimal: '教科书式插图，静态展示，无设计感',
      standard: '标准纪录片视觉，中性色调，清晰呈现',
      enhanced: '温暖纪录片风格，自然光影，有质感',
      artistic: '电影级视觉，强烈光影，构图精致',
      extreme: '好莱坞大片质感，IMAX级视觉，史诗感'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getNarrativeStyle(levelKey) {
    const styles = {
      minimal: '直接讲解，无叙事结构，纯信息传递',
      standard: '平铺直叙，线性推进，标准讲解',
      enhanced: '故事化叙事，有情绪弧线，引人入胜',
      artistic: '电影叙事结构，角色驱动，情感张力',
      extreme: '英雄之旅结构，史诗叙事，强烈情感冲击'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getPromptQuality(levelKey) {
    const styles = {
      minimal: '基础描述，无修饰词，纯功能描述',
      standard: '标准描述，基本修饰，清晰呈现',
      enhanced: '电影级描述，丰富修饰，有质感',
      artistic: '好莱坞级描述，复杂光影，精致质感',
      extreme: '史诗级描述，极致光影，IMAX质感'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getLightingComplexity(levelKey) {
    const styles = {
      minimal: '平光，无设计，基础照明',
      standard: '标准三点光，基础照明设计',
      enhanced: '自然光模拟，有光影设计',
      artistic: '电影级灯光，复杂光影，体积光',
      extreme: '史诗级灯光，极致光影，黄金时刻/体积光'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getColorGrading(levelKey) {
    const styles = {
      minimal: '中性标准，无调色，原始色彩',
      standard: '温和调色，自然色调，轻微调整',
      enhanced: '电影级调色，温暖色调，有风格',
      artistic: '强烈调色，高对比，电影LUT',
      extreme: '极致调色，强烈色调，IMAX级质感'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getToneStyle(levelKey) {
    const styles = {
      minimal: '中性标准，无风格，原始质感',
      standard: '温暖纪录片，自然色调，有质感',
      enhanced: '电影级色调，温暖LUT，精致质感',
      artistic: '强烈色调，高对比LUT，电影质感',
      extreme: '极致色调，史诗LUT，IMAX质感'
    };
    return styles[levelKey] || styles.standard;
  }
  
  _getTextureQuality(levelKey) {
    const styles = {
      minimal: '基础质感，无纹理设计',
      standard: '标准质感，基本纹理',
      enhanced: '精致质感，有纹理层次',
      artistic: '电影级质感，丰富纹理',
      extreme: '极致质感，史诗纹理，细节丰富'
    };
    return styles[levelKey] || styles.standard;
  }

  getAllStageConfigs() {
    const stages = ['1', '5', '5B', '6', '7', '9', '10', '11', '12', '14'];
    const configs = {};
    
    for (const stage of stages) {
      const injection = this.getStageInjections(stage);
      if (injection) {
        configs[stage] = injection;
      }
    }
    
    return {
      cp: this.cp,
      filmType: this.filmType,
      level: this.getLevelInfo(),
      activeModules: this.getActiveModules(),
      stageConfigs: configs,
      safety: this.getSafetyReport(),
      skillParams: this.getSkillInjectionParams()
    };
  }
}

module.exports = { CreativityParameterEngine: CreativityParameterEngineV2 };
