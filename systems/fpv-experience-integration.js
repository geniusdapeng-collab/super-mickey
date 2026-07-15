/**
 * FPV 经验包总库 — 系统链路集成器
 * 
 * 职责：
 * 1. 强制每个片子包含至少1个"一镜到底"镜头
 * 2. 从经验包总库中选择最适合的案例进行参考设计
 * 3. 确保系统链路一定会被调用（不可绕过）
 * 
 * 集成位置：
 * - 导演系统 (ShanhaiDirector) — 生成剧集计划时调用
 * - 运镜系统 (CameraMovementSystem) — 分配运镜方案时调用
 * - Prompt优化器 (PromptOptimizer) — 优化Prompt时调用
 * - 渲染前置验证 (PreRenderValidation) — 提交渲染前调用
 */

const { ExperiencePackSelector, FPV_EXPERIENCE_PACKS } = require('./fpv-experience-library.js');

// ========== 系统级约束配置 ==========
const SYSTEM_CONSTRAINTS = {
  // 强制一镜到底
  mandatoryOneShot: true,
  
  // 一镜到底最低要求
  oneShotRequirements: [
    '单一连续镜头，无跳切',
    'FPV穿越机风格运动（颤动/倾斜/旋转/翻滚）',
    '8-10mm超广角鱼眼镜头',
    '德式斜角（地平线倾斜）',
    '边缘畸变+暗角+色散',
    '约8-12秒时长',
    '音效：纯环境音（Diegetic），无音乐/旁白/文字'
  ],
  
  // 必须调用的系统模块（不可绕过）
  requiredModules: [
    'ExperiencePackSelector',
    'OneShotValidator',
    'FPV_EXPERIENCE_PACKS'
  ]
};

// ========== 一镜到底镜头生成器 ==========
class OneShotGenerator {
  constructor() {
    this.selector = new ExperiencePackSelector();
  }

  /**
   * 为指定场景生成一镜到底镜头
   * @param {Object} sceneParams - 场景参数
   * @param {string} sceneParams.sceneType - 场景类型
   * @param {string} sceneParams.subjectType - 主体类型
   * @param {string} sceneParams.tone - 情绪基调
   * @param {Array} sceneParams.techniques - 需要的技法
   * @returns {Object} 一镜到底镜头定义
   */
  generateOneShot(sceneParams) {
    // 1. 选择最适合的经验包
    const selection = this.selector.selectPack(sceneParams);
    const topPack = selection.topPick.pack;
    
    // 2. 生成一镜到底镜头定义
    const oneShot = {
      type: 'one-shot',
      name: `${topPack.name} — 一镜到底`,
      duration: 10, // 标准10秒
      description: `单一连续镜头，FPV穿越机风格，参考经验包 ${topPack.id}`,
      camera: {
        lens: '8-10mm超广角鱼眼',
        movement: 'FPV穿越机风格（颤动/倾斜/旋转/翻滚）',
        angle: '德式斜角（地平线倾斜）',
        style: '边缘畸变+暗角+色散'
      },
      experiencePack: {
        id: topPack.id,
        name: topPack.name,
        coreMethod: topPack.coreMethod,
        actionRhythm: topPack.actionRhythm,
        uniqueTechniques: topPack.uniqueTechniques,
        fullPrompt: topPack.fullPrompt
      },
      sound: {
        type: 'Diegetic',
        rule: '纯环境音，无音乐/旁白/文字'
      },
      // 标记为系统强制
      systemMandatory: true,
      generatedAt: new Date().toISOString()
    };
    
    return oneShot;
  }

  /**
   * 验证镜头列表是否包含一镜到底
   * @param {Array} shots - 镜头列表
   * @returns {Object} 验证结果
   */
  validateOneShotPresent(shots) {
    const oneShots = shots.filter(shot => 
      shot.type === 'one-shot' || 
      shot.camera?.movement?.includes('一镜到底') ||
      shot.description?.includes('单一连续镜头')
    );
    
    return {
      valid: oneShots.length >= 1,
      count: oneShots.length,
      oneShots: oneShots,
      error: oneShots.length < 1 ? '系统约束：每个片子必须包含至少1个"一镜到底"镜头' : null,
      // 强制拦截：如果没有一镜到底，系统不允许继续
      blockRendering: oneShots.length < 1
    };
  }

  /**
   * 为山海经系列生成一镜到底镜头（特殊适配）
   * @param {Object} episodeData - 剧集数据
   * @returns {Object} 一镜到底镜头定义
   */
  generateShanhaiOneShot(episodeData) {
    const { template, beastId, dominantEmotion } = episodeData;
    
    // 根据模板和情绪选择经验包
    let sceneType = '自然/极地';
    let subjectType = '人物/战士';
    
    // 模板映射
    if (template === 'origin_myth') {
      sceneType = '自然/极地';
      subjectType = '纯环境/灾难';
    } else if (template === 'encounter_fable') {
      sceneType = '洞穴/地下';
      subjectType = '精灵/奇幻生物';
    } else if (template === 'transformation_journey') {
      sceneType = '自然/极地';
      subjectType = '昆虫类';
    } else if (template === 'divine_conflict') {
      sceneType = '雷雨/能量';
      subjectType = '载具/飞行器';
    } else if (template === 'chorus_harmony') {
      sceneType = '洞穴/地下';
      subjectType = '昆虫类';
    }
    
    // 根据异兽调整
    if (beastId === 'zhulong' || beastId === 'taisu') {
      sceneType = '雷雨/能量';
      subjectType = '载具/飞行器';
    } else if (beastId === 'warm') {
      sceneType = '家居室内';
      subjectType = '精灵/奇幻生物';
    } else if (beastId === 'map') {
      sceneType = '洞穴/地下';
      subjectType = '昆虫类';
    } else if (beastId === 'teacher') {
      sceneType = '实验室/科幻';
      subjectType = '精灵/奇幻生物';
    } else if (beastId === 'granny') {
      sceneType = '洞穴/地下';
      subjectType = '昆虫类';
    }
    
    return this.generateOneShot({
      sceneType,
      subjectType,
      tone: dominantEmotion || '神秘',
      techniques: ['单一连续镜头', 'FPV穿越机']
    });
  }

  /**
   * 为通用视频系列生成一镜到底镜头
   * @param {Object} projectData - 项目数据
   * @returns {Object} 一镜到底镜头定义
   */
  generateUniversalOneShot(projectData) {
    const { sceneType, subjectType, tone, techniques = [] } = projectData;
    
    return this.generateOneShot({
      sceneType: sceneType || '家居室内',
      subjectType: subjectType || '昆虫类',
      tone: tone || '紧张',
      techniques: [...techniques, '单一连续镜头', 'FPV穿越机']
    });
  }
}

// ========== 链路集成器 ==========
class FPVLIntegration {
  constructor() {
    this.generator = new OneShotGenerator();
    this.constraints = SYSTEM_CONSTRAINTS;
  }

  /**
   * 集成到导演系统 — 生成剧集计划时调用
   * @param {Object} episodePlan - 原始剧集计划
   * @returns {Object} 集成后的剧集计划
   */
  integrateWithDirector(episodePlan) {
    // 1. 检查是否已有一镜到底
    const validation = this.generator.validateOneShotPresent(episodePlan.acts || []);
    
    if (!validation.valid) {
      // 2. 生成一镜到底镜头
      const oneShot = this.generator.generateShanhaiOneShot({
        template: episodePlan.template,
        beastId: episodePlan.beastId,
        dominantEmotion: episodePlan.emotionalArc?.[2] || '神秘'
      });
      
      // 3. 插入到五幕结构中最适合的位置（通常是第三幕"力量觉醒/加速混乱"）
      const insertIndex = 2; // 第三幕
      if (episodePlan.acts && episodePlan.acts.length > insertIndex) {
        // 将一镜到底作为该幕的核心镜头
        episodePlan.acts[insertIndex].oneShot = oneShot;
        episodePlan.acts[insertIndex].requiredShots = [
          ...(episodePlan.acts[insertIndex].requiredShots || []),
          '一镜到底FPV'
        ];
      }
      
      // 4. 标记系统约束
      episodePlan.systemConstraints = {
        mandatoryOneShot: true,
        oneShotPack: oneShot.experiencePack,
        integratedAt: new Date().toISOString()
      };
    }
    
    return episodePlan;
  }

  /**
   * 集成到Prompt优化器 — 优化时检查一镜到底要素
   * @param {Object} optimizationResult - 优化结果
   * @param {Object} shot - 镜头信息
   * @returns {Object} 增强的优化结果
   */
  integrateWithOptimizer(optimizationResult, shot) {
    // 如果这是一镜到底镜头，确保保留核心要素
    if (shot.type === 'one-shot' || shot.camera?.movement?.includes('一镜到底')) {
      const oneShotKeywords = [
        '单一连续镜头', 'FPV', '穿越机', '鱼眼', '德式斜角',
        '边缘畸变', '暗角', '色散', 'Diegetic', '环境音'
      ];
      
      // 检查优化后的Prompt是否保留了一镜到底关键词
      const optimizedPrompt = optimizationResult.optimizedPrompt || '';
      const missingKeywords = oneShotKeywords.filter(kw => !optimizedPrompt.includes(kw));
      
      if (missingKeywords.length > 0) {
        // 强制追加缺失的关键词
        optimizationResult.optimizedPrompt = optimizedPrompt + 
          `, ${missingKeywords.join(', ')}`;
        optimizationResult.warnings = optimizationResult.warnings || [];
        optimizationResult.warnings.push(
          `一镜到底镜头强制保留: ${missingKeywords.join(', ')}`
        );
      }
      
      // 标记为一镜到底
      optimizationResult.isOneShot = true;
    }
    
    return optimizationResult;
  }

  /**
   * 集成到渲染前置验证 — 提交渲染前强制检查
   * @param {Array} shots - 所有镜头
   * @returns {Object} 验证结果
   */
  integrateWithPreRender(shots) {
    const validation = this.generator.validateOneShotPresent(shots);
    
    return {
      ...validation,
      // 系统级拦截
      canRender: validation.valid,
      systemBlock: !validation.valid,
      systemMessage: validation.error || '一镜到底验证通过'
    };
  }

  /**
   * 通用集成入口（生产级预生产流程调用）
   * @param {Object} params - 参数
   * @returns {Object} 集成结果
   */
  integrate(params = {}) {
    const { beastId, sceneType, scale } = params;
    
    // 1. 获取可用的经验包
    const packs = FPV_EXPERIENCE_PACKS?.packs || [];
    
    // 2. 根据场景类型筛选合适的模板
    const templates = packs.filter(p => {
      if (sceneType === 'encounter') return p.tags?.includes('微观飞行') || p.tags?.includes('洞穴探险');
      if (sceneType === 'flight') return p.tags?.includes('极限运动') || p.tags?.includes('军事科幻');
      if (sceneType === 'battle') return p.tags?.includes('灾难风暴') || p.tags?.includes('科幻穿越');
      return true;
    });
    
    // 3. 生成一镜到底方案
    const oneShot = this.generator.generateOneShot({
      sceneType: sceneType || '自然/极地',
      subjectType: '精灵/奇幻生物',
      tone: '神秘',
      techniques: ['单一连续镜头', 'FPV穿越机']
    });
    
    return {
      templates: templates.slice(0, 3),
      techniques: ['单一连续镜头', 'FPV穿越机', '桶滚', '德式斜角'],
      oneShot: oneShot,
      totalPacks: packs.length,
      matchedPacks: templates.length
    };
  }

  /**
   * 获取系统约束状态
   * @returns {Object} 约束状态
   */
  getSystemConstraints() {
    return {
      ...this.constraints,
      availablePacks: FPV_EXPERIENCE_PACKS.packs.length,
      selectorReady: true,
      generatorReady: true
    };
  }
}

// ========== 便捷导出 ==========
module.exports = {
  FPVLIntegration,
  OneShotGenerator,
  ExperiencePackSelector,
  FPV_EXPERIENCE_PACKS,
  SYSTEM_CONSTRAINTS,
  
  // 快捷方法
  generateOneShot: (params) => new OneShotGenerator().generateOneShot(params),
  validateOneShot: (shots) => new OneShotGenerator().validateOneShotPresent(shots),
  integrateWithDirector: (plan) => new FPVLIntegration().integrateWithDirector(plan),
  getConstraints: () => SYSTEM_CONSTRAINTS
};
