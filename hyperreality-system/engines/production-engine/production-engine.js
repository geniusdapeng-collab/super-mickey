// hyperreality-system/engines/production-engine/production-engine.js
// Production Engine - 制作引擎(Layer 2)
// 深度融合:直接消费 ScriptBlueprint 输出,驱动镜头生成
// 版本:v1.0.0 | 日期:2026-06-08

const path = require('path');

// v2.1.5-refactor: 提取工具函数
const { safeStringify } = require('./utils/safe-stringify');
const { CheckpointManager } = require('./utils/checkpoint-manager');
const { LLMOutputNormalizer } = require('./utils/llm-output-normalizer');
const { ContentBoundaryGuard } = require('./utils/content-boundary-guard');
const { RuleFallbackEngine } = require('./utils/rule-fallback');
const { QualityGate } = require('./utils/quality-gate');
const { ContinuityChecker } = require('./utils/continuity-checker');
const { ShotNormalizer } = require('./utils/shot-normalizer');
const { PromptBuilder } = require('./utils/prompt-builder');

// v2.0.0-LLM-Agent: 导入Agent
const { SceneDesignAgent } = require('./agents/scene-design-agent');
const { VisualLanguageAgent } = require('./agents/visual-language-agent');
const { AudioDesignAgent } = require('./agents/audio-design-agent');
const { PromptFusionAgent } = require('./agents/prompt-fusion-agent');
const { OpeningDesignAgent } = require('./agents/opening-design-agent');
const { ContinuityReviewAgent } = require('./agents/continuity-review-agent');

// v6.6.10-fix: 全局负面提示词注入器
const { globalNegativePromptInjector } = require('../../../systems/global-negative-prompts.js');

// v2.0.0-LLM-Agent: Agent配置
const DEFAULT_AGENT_CONFIG = {
  enableLLMAgents: true,
  llmTimeout: 300000,        // 【v2.1.9-fix】180秒→300秒，匹配PromptFusion实际耗时
  llmMaxRetries: 2,          // 【v2.1.8-fix】恢复2次重试（时间预算增加后）
  llmModel: process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
  fastModel: process.env.STORMAXE_LLM_FAST_MODEL || process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
  totalDeadlineMs: parseInt(process.env.STORMAXE_TOTAL_DEADLINE_MS || '3600000'), // 【v2.1.8-fix】从环境变量读取，默认 60 分钟
  memThresholdMB: 1800,
  promptFusionConcurrency: 1, // 【v2.1.8-fix】串行模式（预算增加后更稳定）
  maxMsPerShot: 180000,      // 3分钟/镜头
  enableSegmentedExecution: true,
};
// 注:实际部署时这些模块会从 systems/ 复制到 production-engine/modules/
const SYSTEMS_PATH = path.join(__dirname, '../../../systems');

// 动态加载现有模块
function loadModule(name, required = false) {
  try {
    return require(path.join(SYSTEMS_PATH, name));
  } catch (e) {
    if (required) {
      throw new Error(`[ProductionEngine] 关键模块加载失败: ${name} - ${e.message}`);
    }
    console.warn(`[ProductionEngine] 模块加载失败: ${name} - ${e.message}`);
    return null;
  }
}

class ProductionEngine {
  constructor(options = {}) {
    this.config = {
      maxPromptLength: 12000, // 【审计修复】与 config/prompt-length.js 保持一致
      targetPromptLength: 12000, // 【审计修复】与 config/prompt-length.js 保持一致
      referenceImageCount: 2,
      outputDir: options.outputDir || process.env.OUTPUT_DIR || './output/super-mickey-output',
      ...options
    };

    // v2.0.0-LLM-Agent: 初始化Agent配置
    this.agentConfig = {
      ...DEFAULT_AGENT_CONFIG,
      ...options.agentConfig,
      maxPromptLength: this.config.maxPromptLength
    };

    // v2.0.0-LLM-Agent: 初始化Agents
    this._initAgents();

    this.modules = {};
    this.logs = [];
    this._initResourceGuard();
    this._initModules();
    
    // v2.1.5-refactor: 初始化 Phase 执行器（渐进式重构）
    this._initPhases();
  }

  /**
   * v2.1.5-refactor: 初始化 Phase 执行器
   * 通过环境变量 HYPERREALITY_USE_PHASES 控制是否启用新架构
   */
  _initPhases() {
    // v2.1.5-refactor: 默认启用新 Phase 架构
    const { Phase1SceneDesign } = require('./phases/phase-1-scene-design');
    const { Phase2VisualAudio } = require('./phases/phase-2-visual-audio');
    const { Phase3PromptFusion } = require('./phases/phase-3-prompt-fusion');
    const { Phase35FieldQuality } = require('./phases/phase-3-5-field-quality');
    
    const commonOptions = {
      agents: this.agents,
      logFn: this.log.bind(this),
      saveCheckpoint: this._saveCheckpoint.bind(this),
      canAfford: this._canAfford.bind(this),
      budgetRemaining: this._budgetRemaining.bind(this),
      checkMemory: this._checkMemory.bind(this),
      cloneShots: this._cloneShots.bind(this),
      mergeShots: this._mergeShotsByShotId.bind(this)
    };
    
    this.phase1 = new Phase1SceneDesign(commonOptions);
    this.phase2 = new Phase2VisualAudio(commonOptions);
    this.phase3 = new Phase3PromptFusion(commonOptions);
    this.phase35 = new Phase35FieldQuality({
      ...commonOptions,
      llmModel: this.llmModel,
      globalDeadline: this._globalDeadline
    });
    
    // v2.1.5-refactor: 初始化辅助模块
    this.boundaryGuard = new ContentBoundaryGuard(this.log.bind(this));
    this.ruleFallback = new RuleFallbackEngine({
      logFn: this.log.bind(this),
      config: this.config,
      llmModel: this.llmModel
    });
    this.qualityGate = new QualityGate(this.config);
    this.continuityChecker = new ContinuityChecker();
    this.shotNormalizer = new ShotNormalizer(this.config);
    this.promptBuilder = new PromptBuilder(this.config);
    
    // 【v2.1.6-fix】系统级修复：传递 healthMonitor 给 Phase 执行器
    this.healthMonitor = null;
  }

  /**
   * 【v2.1.6-fix】系统级修复：设置 HealthMonitor 引用，供 Phase 长时间任务使用
   * @param {HealthMonitor} healthMonitor - HealthMonitor 实例
   */
  setHealthMonitor(healthMonitor) {
    console.log('[ProductionEngine] setHealthMonitor called with', healthMonitor ? 'HealthMonitor instance' : 'null');
    this.healthMonitor = healthMonitor;
    // 重新初始化 Phase 执行器，传递 healthMonitor
    const { Phase1SceneDesign } = require('./phases/phase-1-scene-design');
    const { Phase2VisualAudio } = require('./phases/phase-2-visual-audio');
    const { Phase3PromptFusion } = require('./phases/phase-3-prompt-fusion');
    const { Phase35FieldQuality } = require('./phases/phase-3-5-field-quality');
    const commonOptions = {
      agents: this.agents,
      logFn: this.log.bind(this),
      saveCheckpoint: this._saveCheckpoint.bind(this),
      canAfford: this._canAfford.bind(this),
      budgetRemaining: this._budgetRemaining.bind(this),
      checkMemory: this._checkMemory.bind(this),
      cloneShots: this._cloneShots.bind(this),
      mergeShots: this._mergeShotsByShotId.bind(this),
      healthMonitor: this.healthMonitor
    };
    this.phase1 = new Phase1SceneDesign(commonOptions);
    this.phase2 = new Phase2VisualAudio(commonOptions);
    this.phase3 = new Phase3PromptFusion(commonOptions);
    this.phase35 = new Phase35FieldQuality({
      ...commonOptions,
      llmModel: this.llmModel,
      globalDeadline: this._globalDeadline
    });
    console.log('[ProductionEngine] Phases re-initialized with healthMonitor:', this.phase3.healthMonitor ? 'yes' : 'no');
  }

  /**
   * 【新增】运行时更新 Agent 配置
   * 修复:create() 中收到的 agentConfig 可在此应用到已实例化的引擎
   * 【P1-ARCH-05 修复】添加配置锁，防止并发更新导致状态不一致
   */
  updateAgentConfig(agentConfig = {}) {
    // 【P1-ARCH-05 修复】简单的配置锁：如果正在更新中，跳过重复更新
    if (this._configUpdating) {
      console.warn('[ProductionEngine] ⚠️ 配置更新冲突，跳过重复更新');
      return;
    }
    this._configUpdating = true;
    try {
      const before = this.agentConfig.enableLLMAgents;
      this.agentConfig = {
        ...this.agentConfig,
        ...agentConfig,
        maxPromptLength: this.config.maxPromptLength
      };
      // 重新初始化 Agent 以应用新配置
      this._initAgents();
      if (before !== this.agentConfig.enableLLMAgents) {
        console.log(`[ProductionEngine] ⚠️ 运行时配置切换: enableLLMAgents ${before} → ${this.agentConfig.enableLLMAgents}`);
      }
    } finally {
      this._configUpdating = false;
    }
  }

  /**
   * 【新增】资源守卫初始化
   */
  _initResourceGuard() {
    this._memThresholdMB = this.agentConfig.memThresholdMB || 1200;
    this._lowResourceMode = false;
  }

  /**
   * 【新增】Checkpoint 初始化(断点续跑)
   */
  _initCheckpoint() {
    this._checkpointDir = this.agentConfig.checkpointDir || this.config.outputDir;
    this._enableResume = this.agentConfig.enableResume !== false;
  }

  /**
   * 【新增】加载最新 checkpoint(断点续跑)
   * 返回最近完成的 Phase 及其 shots
   */
  _loadLatestCheckpoint(expectedFingerprint = null) {
    if (!this._enableResume) return null;
    try {
      const fs = require('fs');
      const phases = ['phase3.5', 'phase3', 'phase2', 'phase1', 'phase0'];
      for (const phase of phases) {
        const file = path.join(this._checkpointDir, `checkpoint-${phase}.json`);
        if (!fs.existsSync(file)) continue;
        try {
          const data = fs.readFileSync(file, 'utf8');
          const parsed = JSON.parse(data);
          // 【P1-9 修复】校验 blueprint 指纹一致性
          if (expectedFingerprint && parsed.blueprintFingerprint) {
            if (parsed.blueprintFingerprint.hash !== expectedFingerprint.hash) {
              this.log('RESUME', `⚠️ ${phase} checkpoint 指纹不匹配(旧${parsed.blueprintFingerprint.hash}→新${expectedFingerprint.hash})，丢弃`);
              try { fs.unlinkSync(file); } catch (_) {}
              continue;
            }
          }
          this.log('RESUME', `📂 发现 ${phase} checkpoint(${parsed.shots?.length || 0} 镜头,保存于 ${parsed.savedAt || 'unknown'})`);
          return parsed;
        } catch (e) {
          this.log('RESUME', `⚠️ ${phase} checkpoint 损坏(${e.message})，已删除，继续搜索`);
          try { fs.unlinkSync(file); } catch (_) {}
          continue;
        }
      }
    } catch (e) {
      this.log('RESUME', `加载 checkpoint 失败: ${e.message}`);
    }
    this.log('RESUME', '无可用 checkpoint');
    return null;
  }

  /**
   * 【新增】清除 checkpoint(成功完成后调用)
   * 【审计修复·P0】补全 phase0 和 phase3.5
   */
  _clearCheckpoints() {
    try {
      const fs = require('fs');
      const allPhases = ['phase0', 'phase1', 'phase2', 'phase3', 'phase3.5'];
      allPhases.forEach(phase => {
        const file = path.join(this._checkpointDir, `checkpoint-${phase}.json`);
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch (e) {
            this.log('CHECKPOINT', `清除 ${phase} 失败: ${e.message}`);
          }
        }
      });
    } catch (e) { /* 忽略 */ }
  }

  /**
   * 【新增】内存检查,超过阈值进入低资源模式
   */
  _checkMemory(tag = '') {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    if (heapMB > this._memThresholdMB) {
      this._lowResourceMode = true;
      this.log('MEM-WARN', `⚠️ 堆内存 ${heapMB}MB 超阈值 ${this._memThresholdMB}MB @ ${tag},进入低资源模式`);
      if (global.gc) {
        global.gc();
        const after = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        this.log('MEM-WARN', `GC 后堆内存 ${after}MB (${heapMB}→${after})`);
      }
    }
    return heapMB;
  }

  /**
   * 【新增】预算剩余(毫秒)
   */
  _budgetRemaining() {
    if (!this._globalDeadline) return Infinity;
    return Math.max(0, this._globalDeadline - Date.now());
  }

  /**
   * 【新增】预算守卫:是否还能承担 needMs
   */
  _canAfford(needMs) {
    return this._budgetRemaining() > needMs;
  }

  /**
   * 【新增】增量保存 checkpoint（已提取到 utils/checkpoint-manager.js）
   * 保持向后兼容，内部委托给 CheckpointManager
   */
  async _saveCheckpoint(phase, shots, extra = {}) {
    if (!this._checkpointManager) {
      this._checkpointManager = new CheckpointManager(this._checkpointDir);
    }
    // 【P1-9 修复】自动附加 blueprint 指纹
    const enrichedExtra = {
      ...extra,
      blueprintFingerprint: this._blueprintFingerprint
    };
    const result = this._checkpointManager.save(phase, shots, enrichedExtra, this.log.bind(this));
    if (!result.success) {
      // 保持原有行为：保存失败不抛异常
    }
  }

  /**
   * 【审计修复·P0】安全序列化（已提取到 utils/safe-stringify.js）
   * 保持向后兼容，内部委托给提取的工具函数
   */
  _safeStringify(obj) {
    return safeStringify(obj);
  }

  /**
   * v2.0.0-LLM-Agent: 初始化所有Agent
   */
  _initAgents() {
    const base = {
      llmTimeout: this.agentConfig.llmTimeout,
      llmMaxRetries: this.agentConfig.llmMaxRetries,
      enabled: this.agentConfig.enableLLMAgents
    };
    const deepModel = this.agentConfig.llmModel || 'kimi-k2p6';
    const fastModel = this.agentConfig.fastModel || deepModel;

    this.agents = {
      // 深度模型:创造性主任务
      sceneDesign: new SceneDesignAgent({ ...base, llmModel: deepModel }),
      visualLanguage: new VisualLanguageAgent({ ...base, llmModel: deepModel }),
      promptFusion: new PromptFusionAgent({ ...base, llmModel: deepModel, maxPromptLength: this.config.maxPromptLength }),

      // 快速模型:结构化小任务(音效/片头/审查),可用非推理模型加速
      audioDesign: new AudioDesignAgent({ ...base, llmModel: fastModel, llmMaxTokens: 8000 }),
      openingDesign: new OpeningDesignAgent({ ...base, llmModel: fastModel, llmMaxTokens: 8000 }),
      continuityReview: new ContinuityReviewAgent({ ...base, llmModel: fastModel, llmMaxTokens: 8000 })
    };

    console.log(`[ProductionEngine v2.0] LLM Agents ${this.agentConfig.enableLLMAgents ? '已启用' : '已禁用'} | deep=${deepModel} fast=${fastModel}`);
  }

  _initModules() {
    // 加载核心模块(从现有系统复用)
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
   * 主入口:从 ScriptBlueprint 生成完整镜头
   * @param {object} adaptedBlueprint - 适配器输出的剧本数据
   * @returns {object} { shots, prompts, report }
   */
  /**
   * v2.0.5-彻底修复: LLM Agent输出标准化层
   * 已提取到 utils/llm-output-normalizer.js
   * 保持向后兼容，内部委托给 LLMOutputNormalizer
   */
  _normalizeLLMOutput(shots, blueprint) {
    const normalized = LLMOutputNormalizer.normalizeShots(shots, blueprint);
    
    // 保留原有的角色信息补全逻辑（未提取到独立工具中）
    return normalized.map((shot, idx) => {
      const originalShot = shots[idx];
      
      // 5. 角色信息补全:如果shot没有characters,从blueprint补
      if (!originalShot.characters || originalShot.characters.length === 0) {
        shot.characters = blueprint.characters || [];
      }

      // 6. 角色引用补全:如果characterRef为NONE但有角色,生成描述性引用
      if ((!originalShot.characterRef || originalShot.characterRef === 'NONE') && blueprint.characters && blueprint.characters.length > 0) {
        const mainChar = blueprint.characters.find(c => c.role === 'protagonist') || blueprint.characters[0];
        if (mainChar) {
          shot.characterRef = `${mainChar.name}: ${mainChar.description || mainChar.persona || 'main character'}`;
        }
      }

      return shot;
    });
  }

  /**
   * v2.0.5-彻底修复: 质量门适配LLM融合模式
   * 当fusionText存在时,检查标准放宽(信息在融合段中)
   */
  _runQualityGateAdapted(prompts) {
    const checks = prompts.map(p => {
      const hasFusion = p.prompt && p.prompt.includes('fusion');
      // 有fusionText时,timeline/camera/lighting可以不在独立字段中
      const hasTimeline = !!p.timelineString || hasFusion;
      const hasCamera = !!p.cameraString || hasFusion;
      const hasLighting = !!p.lightingString || hasFusion;

      return {
        shotId: p.shotId,
        hasPrompt: !!p.prompt && p.prompt.length > 50,
        hasDuration: !!p.duration && p.duration > 0,
        hasTimeline,
        hasCharacter: p.character !== 'NONE' || p.characterRef !== 'NONE',
        hasMood: !!p.mood,
        hasDialogue: p.dialogue !== 'NONE' && p.dialogue !== '',
        lengthOk: p.promptCharCount > 0 && p.promptCharCount < 2000,
        passed: false // 后面计算
      };
    });

    checks.forEach(c => {
      c.passed = c.hasPrompt && c.hasDuration && c.hasTimeline &&
                 c.hasCharacter && c.hasMood && c.hasDialogue && c.lengthOk;
    });

    const allPassed = checks.every(c => c.passed);
    return { passed: allPassed, checks };
  }

  // 【v2.1.4-fix10-P25-fix3】暴露单镜头融合方法，供 run-phase3.js 单镜头粒度续跑
  async fuseSingleShotPublic(shot, ratio, characters) {
    if (!this.agents.promptFusion) {
      throw new Error('PromptFusionAgent 未初始化');
    }
    return this.agents.promptFusion._fuseSingleShot(shot, ratio, characters);
  }
  async produce(adaptedBlueprint, runtimeAgentConfig = null) {
    const startTime = Date.now();

    // 【修复】应用运行时配置(双保险:create() 已调 updateAgentConfig,这里再兜一次)
    if (runtimeAgentConfig) {
      this.updateAgentConfig(runtimeAgentConfig);
    }

    // 【P1-ARCH-01 修复】动态预算分配：根据剩余镜头数和阶段动态调整预算
    // 将总预算分为阶段预算池，前面节省的时间可流入后续阶段
    const HARD_BUDGET_MS = this.agentConfig.totalDeadlineMs || 1200000;
    const PHASE_BUDGET_RATIOS = {
      phase1: 0.08,   // Phase 1: 8% 总预算
      phase2: 0.15,   // Phase 2: 15% 总预算 (并行化后耗时减少)
      phase3: 0.70,   // Phase 3: 70% 总预算 (PromptFusion 最耗时，给予更多预算)
      phase3_5: 0.07  // Phase 3.5: 7% 总预算
    };
    const phaseBudgets = {};
    let accumulatedBudget = 0;
    for (const [phase, ratio] of Object.entries(PHASE_BUDGET_RATIOS)) {
      phaseBudgets[phase] = Math.floor(HARD_BUDGET_MS * ratio);
      accumulatedBudget += phaseBudgets[phase];
    }
    // 剩余预算分配给 Phase 3
    phaseBudgets.phase3 += (HARD_BUDGET_MS - accumulatedBudget);
    
    this.log('PRODUCE', `💰 动态预算分配: phase1=${phaseBudgets.phase1}ms phase2=${phaseBudgets.phase2}ms phase3=${phaseBudgets.phase3}ms phase3.5=${phaseBudgets.phase3_5}ms`);
    const SAFETY_MARGIN_MS = 60000; // 余量60s
    const globalDeadline = startTime + HARD_BUDGET_MS - SAFETY_MARGIN_MS;
    this._globalDeadline = globalDeadline;
    this._setAgentDeadline(globalDeadline);
    // 【P1-7 修复】Phase35 FieldQuality 同步下发 deadline
    if (this.phase35) {
      this.phase35.globalDeadline = globalDeadline;
      if (this.phase35.fieldQualityPipeline && typeof this.phase35.fieldQualityPipeline.setDeadline === 'function') {
        this.phase35.fieldQualityPipeline.setDeadline(globalDeadline);
      }
    }

    // 【P1-9 修复】生成 blueprint 指纹，用于 checkpoint 一致性校验
    const crypto = require('crypto');
    this._blueprintFingerprint = {
      sceneCount: adaptedBlueprint.scenes?.length || 0,
      shotIds: (adaptedBlueprint.scenes || []).map(s => s.scene_id).join(','),
      hash: crypto.createHash('md5').update(JSON.stringify(adaptedBlueprint.scenes || [])).digest('hex').slice(0, 8)
    };
    this.log('PRODUCE', `🔖 Blueprint 指纹: ${this._blueprintFingerprint.hash} (${this._blueprintFingerprint.sceneCount}场景)`);

    const result = {
      success: false, shots: [], prompts: [], stages: {}, errors: [],
      logs: this.logs, timing: {}, llmStats: {}, degraded: false, resumed: false
    };

    try {
      // ===== Stage 1-2:规则阶段(快)=====
      result.stages.sceneExtraction = await this._runStage('scene-extraction', () => this._extractScenes(adaptedBlueprint));
      result.stages.durationAllocation = await this._runStage('duration-allocation', () => this._allocateDuration(result.stages.sceneExtraction.shots));
      let currentShots = result.stages.durationAllocation.shots;

      // 规则降级路径(保留原行为)
      if (!this.agentConfig.enableLLMAgents) {
        return await this._produceViaRules(currentShots, adaptedBlueprint, result, startTime);
      }

      // ===== LLM 模式(主路径:断点续跑 + 预算守卫)=====
      let phase1Failed = false;

      // ===== 断点续跑:尝试加载已完成的 checkpoint =====
      const ckpt = this._loadLatestCheckpoint(this._blueprintFingerprint);
      let startPhase = 1;
      if (ckpt) {
        currentShots = ckpt.shots;
        result.opening = ckpt.opening || null;
        result.llmStats = ckpt.llmStats || {};
        if (ckpt.phase === 'phase1') startPhase = 2;
        else if (ckpt.phase === 'phase2') startPhase = 3;
        else if (ckpt.phase === 'phase3') startPhase = 4; // 【P1-8 修复】phase3完成后应进phase3.5
        else if (ckpt.phase === 'phase3.5') {
          startPhase = 99;
          this.log('RESUME', '✅ Phase3.5 已完成,跳过 LLM 直接进 Quality Gate');
        }
        result.resumed = true;
      }

      // ----- Phase 1:SceneDesign ∥ OpeningDesign -----
      // v2.1.5-refactor: 使用新 Phase 架构
      if (startPhase <= 1) {
        const phase1Result = await this.phase1.execute({ 
          shots: currentShots, 
          result, 
          adaptedBlueprint 
        });
        if (phase1Result.success) {
          currentShots = phase1Result.shots;
        } else {
          phase1Failed = true;
        }
      }

      // ----- Phase 2:VisualLanguage → AudioDesign → ContinuityReview -----
      // v2.1.5-refactor: 使用新 Phase 架构
      if (startPhase <= 2) {
        const phase2Result = await this.phase2.execute({ 
          shots: currentShots, 
          result, 
          adaptedBlueprint 
        });
        if (phase2Result.success) {
          currentShots = phase2Result.shots;
        }
      }

      // ----- Phase 3:PromptFusion -----
      // v2.1.5-refactor: 使用新 Phase 架构
      if (startPhase <= 3) {
        const phase3Result = await this.phase3.execute({ 
          shots: currentShots, 
          result, 
          adaptedBlueprint 
        });
        if (phase3Result.success) {
          currentShots = phase3Result.shots;
        }
      }

      // ===== Phase-3.5 前置：展平 shot.fields + 统一字段命名 =====
      // 【审计修复】PromptFusion 的 fields 是最终权威来源，允许覆盖顶层旧值
      currentShots = currentShots.map(shot => {
        const flat = { ...shot };
        if (shot.fields && typeof shot.fields === 'object') {
          for (const [key, value] of Object.entries(shot.fields)) {
            if (value === undefined || value === null || value === '') continue;
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            flat[key] = value; // 始终覆盖（fields 是最终权威）
            flat[camelKey] = value; // 驼峰也覆盖
          }
        }
        return flat;
      });

      // ===== Phase-3.5: 字段质量检查与修复（自适应预算）=====
      // v2.1.5-refactor: 使用新 Phase 架构
      let phase35Success = false;
      try {
        const phase35Result = await this.phase35.execute({ 
          shots: currentShots, 
          result, 
          adaptedBlueprint 
        });
        if (phase35Result.success) {
          currentShots = phase35Result.shots;
          phase35Success = true;
        }
      } catch (phase35Error) {
        this.log('PHASE-3.5', `❌ Phase 3.5 异常: ${phase35Error.message}`);
      }

      // 【v2.1.8-审计修复】Phase 3.5 失败后使用隔离的降级逻辑，确保不抛异常到外层
      if (!phase35Success) {
        try {
          this.log('PHASE-3.5', '⚠️ 字段质量检查失败，运行 FieldGuard 兜底修复');
          const { FieldGuard } = require('../field-guard');
          const fg = new FieldGuard({ strict: false });
          // 【修复】使用 normalizeAndValidate（检查+就地修复），而非仅 check（只检查不修复）
          const nv = fg.normalizeAndValidate(currentShots, 'Phase3.5-fallback');
          currentShots = nv.shots; // 使用修复后的 shots
          if (!nv.report.passed || nv.report.summary.fixedShots > 0) {
            this.log('PHASE-3.5', `⚠️ FieldGuard 已就地修复 ${nv.report.summary.fixedShots} 个镜头，已标记降级`);
          }
        } catch (fgError) {
          this.log('PHASE-3.5', `⚠️ FieldGuard兜底也失败: ${fgError.message}，继续使用当前shots`);
          // 【关键】标记降级但不中断流程
          currentShots = currentShots.map(s => ({ ...s, degraded: true, degradeReason: 'Phase3.5 完全失败' }));
        }
      }

      // ===== 内容边界后处理(最终防线)=====
      // v2.1.5-refactor: 使用 ContentBoundaryGuard
      try {
        currentShots = this.boundaryGuard.enforce(currentShots, adaptedBlueprint);
      } catch (bgError) {
        this.log('BOUNDARY-GUARD', `⚠️ 边界检查失败: ${bgError.message}，跳过`);
      }

      // ===== Quality Gate =====
      // v2.1.5-refactor: 使用 QualityGate 模块
      try {
        result.stages.qualityGate = await this._runStage('quality-gate', () => this.qualityGate.run(currentShots));
      } catch (qgError) {
        this.log('QUALITY-GATE', `⚠️ QualityGate失败: ${qgError.message}，继续`);
        result.stages.qualityGate = { passed: false, error: qgError.message, shots: currentShots };
      }

      result.shots = currentShots;
      result.prompts = currentShots;
      result.meta = this._buildMeta(adaptedBlueprint);
      result.success = true;
      result.timing.total = Date.now() - startTime;
      this.log('PRODUCE', `✅ LLM 制作完成${result.resumed ? '(断点续跑)' : ''} | ${currentShots.length} 镜头 | ${result.timing.total}ms`);
      this._clearCheckpoints(); // 成功完成,清理 checkpoint

    } catch (error) {
      result.success = false;
      result.errors.push({ stage: 'production', message: error.message });
      this.log('ERROR', `❌ ${error.message}`);
      this.log('ERROR', `💡 若为预算不足,直接重跑同一命令即可从 checkpoint 续跑,LLM 产出不会丢`);

      // 【新增】最后兜底:用规则引擎抢救产出
      try {
        this.log('RECOVERY', '尝试规则兜底恢复...');
        const baseShots = result.stages.durationAllocation?.shots || [];
        const fallbackShots = await this.ruleFallback.engineerPromptsFallback(baseShots, adaptedBlueprint);
        if (fallbackShots.length > 0) {
          result.shots = fallbackShots;
          result.prompts = fallbackShots;
          result.success = true;
          result.degraded = true;
          result.timing.total = Date.now() - startTime;
          this.log('RECOVERY', `✅ 规则兜底成功,产出 ${fallbackShots.length} 个镜头`);
        }
      } catch (e2) {
        result.errors.push({ stage: 'recovery', message: e2.message });
      }
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

  /** 是否需要生成片头 */
  _shouldGenerateOpening(adaptedBlueprint) {
    const _meta = adaptedBlueprint.config?._metadata || adaptedBlueprint._metadata || {};
    return _meta.isSeries ? (_meta.episodeNumber === 1) : (_meta.hasOpening !== false);
  }

  /** 【v2.1.4】从adaptedBlueprint构造边界契约 */
  /** 【v2.1.4】从adaptedBlueprint构造边界契约 */
  _buildEpisodeContract(adaptedBlueprint) {
    // adaptedBlueprint结构: { config: { _metadata: {...} }, scenes: [...] }
    const meta = adaptedBlueprint.config?._metadata || {};
    const series = meta.series || {};
    const plan = meta.seriesContentPlan || {};
    const episodeIndex = series.currentEpisode || meta.episode || 1;

    // 优先从seriesContentPlan提取
    if (plan.episodes && plan.episodes[episodeIndex - 1]) {
      const ep = plan.episodes[episodeIndex - 1];
      return {
        mustCover: ep.mustCover || ep.coreTopics || [],
        canMention: ep.canMention || [],
        mustNotCover: ep.mustNotCover || [],
        previousSummary: null
      };
    }

    // 回退:从series信息构造
    return {
      mustCover: series.episodeThemes || [],
      canMention: [],
      mustNotCover: [],
      previousSummary: null
    };
  }

  /** 把全局截止时间下发给所有 Agent */
  _setAgentDeadline(deadlineMs) {
    for (const a of Object.values(this.agents || {})) {
      if (a && typeof a.setDeadline === 'function') a.setDeadline(deadlineMs);
    }
  }

  /** 浅拷贝 shots(并行分支互不污染) */
  _cloneShots(shots) {
    if (!Array.isArray(shots)) return [];
    return shots.map(s => this._deepCloneShot(s));
  }

  /**
   * 【审计修复·P0】安全深拷贝单个 shot
   * 处理循环引用、跳过重型字段（_blueprint等）
   */
  _deepCloneShot(shot) {
    if (shot === null || typeof shot !== 'object') return shot;

    // 快速路径：无 _blueprint 等重型字段时直接 JSON 拷贝（最快）
    if (!shot._blueprint && !shot._adapter && !shot._llm && !shot._engine) {
      try {
        return JSON.parse(JSON.stringify(shot));
      } catch (e) {
        // 有循环引用，走慢路径
      }
    }

    // 慢路径：手动递归拷贝，处理循环引用
    const seen = new WeakMap();
    const clone = (obj) => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (typeof obj === 'function') return undefined; // 跳过函数
      if (seen.has(obj)) return seen.get(obj); // 循环引用：返回已拷贝的引用
      if (Array.isArray(obj)) {
        const arr = [];
        seen.set(obj, arr);
        for (const item of obj) {
          const c = clone(item);
          if (c !== undefined) arr.push(c);
        }
        return arr;
      }
      const result = {};
      seen.set(obj, result);
      for (const [key, value] of Object.entries(obj)) {
        // 跳过已知重型/循环引用字段（保留浅引用）
        if (['_blueprint', '_adapter', '_llm', '_engine', '_metadata_raw'].includes(key)) {
          continue;
        }
        const c = clone(value);
        if (c !== undefined) result[key] = c;
      }
      return result;
    };

    const result = clone(shot);
    // 保留 _blueprint 的浅引用（太重不便深拷贝，但下游需要读取）
    if (shot._blueprint) result._blueprint = shot._blueprint;
    return result;
  }

  /**
   * 【审计修复·P0】深拷贝单个字段值（用于 _mergeShotsByShotId）
   */
  _deepCloneValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map(v => this._deepCloneValue(v));
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      // 循环引用兜底：浅拷贝
      return { ...value };
    }
  }

  /**
   * 按 shotId 把 updatedShots 的指定字段合并回 baseShots
   * - 只在字段非空时覆盖,避免降级返回的空字符串冲掉已有数据
   * 【审计修复·P0】merged[f] = v 是引用赋值，改为深拷贝
   */
  _mergeShotsByShotId(baseShots, updatedShots, fields) {
    const map = new Map((updatedShots || []).map(s => [s.shotId, s]));
    return baseShots.map(shot => {
      const u = map.get(shot.shotId);
      if (!u) return shot;
      const merged = this._deepCloneShot(shot);
      // 若指定白名单，优先合并白名单字段；再合并 u 中其他非空字段（防止丢字段）
      const whiteSet = fields && fields.length ? new Set(fields) : null;
      const keys = whiteSet
        ? [...fields, ...Object.keys(u).filter(k => !whiteSet.has(k))]
        : Object.keys(u);
      for (const f of keys) {
        if (f === 'shotId') continue;
        const v = u[f];
        if (v === undefined || v === null || v === '') continue;
        // duration 的 0 不覆盖；其他数值 0 也不覆盖有效值
        if (typeof v === 'number' && v === 0) continue;
        merged[f] = this._deepCloneValue(v);
      }
      // 【审计修复】保留降级元数据字段（如果 updatedShots 中有）
      if (u.degraded !== undefined) merged.degraded = u.degraded;
      if (u.degradeReason !== undefined) merged.degradeReason = u.degradeReason;
      return merged;
    });
  }

  /**
   * 并行执行多个 Agent 任务(allSettled,单点失败不阻塞其余)
   * 【v2.1.4-fix13-审计修复】增加外层超时保护，防止单个task hang住拖垮整个并行阶段
   */
  async _runParallel(tasks, label, timeoutMs = 300000) {
    const keys = Object.keys(tasks);
    const starts = keys.map(() => Date.now());
    this.log(label, `${keys.join(' + ')} 并行启动...`);

    const wrapped = keys.map((k, i) =>
      Promise.resolve(tasks[k]).then(v => {
        this.log(k.toUpperCase(), `完成 (${Date.now() - starts[i]}ms)`);
        return v;
      })
    );

    // 【v2.1.4-fix13-审计修复】外层超时保护：整个并行阶段最多等timeoutMs
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}并行阶段超时(${timeoutMs}ms)`)), timeoutMs);
    });

    const allSettledPromise = Promise.allSettled(wrapped);
    allSettledPromise.catch(() => {}); // 【v2.1.6-fix】防止悬空 rejection

    const settled = await Promise.race([
      allSettledPromise,
      timeoutPromise
    ]).finally(() => clearTimeout(timer));

    const values = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        values.push(r.value);
      } else {
        this.log(label, `⚠️ ${keys[i]} 异常: ${r.reason?.message || r.reason}(降级处理,继续)`);
        values.push(this._emptyAgentResult(keys[i]));
      }
    });
    return values;
  }

  /** 并行任务异常时的兜底空结果(仅兜底,正常路径不会走到) */
  _emptyAgentResult(name) {
    if (name === 'opening-design-agent') return { opening: null, degraded: true, degradeReason: 'phase exception' };
    if (name === 'continuity-review-agent') return { review: { overallScore: 80, issues: [], summary: '并行阶段异常,跳过审查' }, degraded: true, degradeReason: 'phase exception' };
    return { shots: [], degraded: true, degradeReason: 'phase exception' };
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
   * v6.37-P1+: 构建角色极简锚点(专家反馈强化)
   * 规则:
   * 1. 强制3-5个视觉关键词(不含种族/物种)
   * 2. 禁止详细描述(如"十五米高的巨型身躯")
   * 3. 颜色词不超过2个
   * 4. 禁止形容词堆砌(超过3个连续形容词则截断)
   * 5. 格式:角色名: 种族/物种, 视觉关键词1, 视觉关键词2, 视觉关键词3
   *
   * 正例:白泽: lion-like beast, vertical eye, three white-flame tails, golden hooves
   * 反例:白泽: 一只十五米高的白色神兽,有着三根尾巴和金色的蹄子(太啰嗦)
   */
  _buildMinimalAnchor(cid, characters) {
    const char = characters.find(c => c.character_id === cid);
    if (!char) return `${cid}: unknown`;

    const race = char.species || char.race || char.gender || 'human';
    const features = char.visual_anchor?.core_features || [];

    // 颜色词列表(用于检查)
    const colorWords = ['white', 'black', 'red', 'blue', 'green', 'golden', 'silver', 'purple', 'brown', 'grey', 'gray', 'yellow', 'orange', 'pink', 'cyan', 'teal'];

    // 形容词列表(用于检查堆砌)
    const adjectiveWords = ['big', 'huge', 'giant', 'large', 'small', 'tiny', 'massive', 'tall', 'short', 'beautiful', 'magnificent', 'mysterious', 'ancient', 'powerful', 'fierce', 'gentle', 'elegant', 'majestic', 'terrifying', 'sacred', 'divine', 'mythical', 'legendary', 'noble', 'wise', 'brave', 'curious', 'young', 'old'];

    // 过滤并优化特征
    const processedFeatures = [];
    let colorCount = 0;
    let adjCount = 0;

    for (const feature of features) {
      const lower = feature.toLowerCase();

      // 跳过详细描述(超过15字符可能太啰嗦)
      if (feature.length > 15 && !feature.includes(' ') && !feature.includes('-')) {
        continue; // 跳过单个超长词(可能是详细描述)
      }

      // 检查颜色词
      const isColor = colorWords.some(c => lower.includes(c));
      if (isColor) {
        if (colorCount >= 2) continue; // 颜色词不超过2个
        colorCount++;
      }

      // 检查形容词堆砌(连续形容词计数)
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
   * Stage 1: 从适配蓝图提取场景,转换为内部镜头结构
   * v6.37-P0: 改造为符合参考文档的字段格式
   */
  _extractScenes(adaptedBlueprint) {
    const scenes = adaptedBlueprint.scenes || [];
    const characters = adaptedBlueprint.characters || [];
    const worldSetting = adaptedBlueprint.worldSetting || {};

    // v1.2.5: 系列作品非第一集处理
    // 修复:兼容adapter返回的顶层_metadata和config._metadata
    const _metadata = adaptedBlueprint.config?._metadata || adaptedBlueprint._metadata || {};
    const isSeriesNonFirst = _metadata.isSeries && _metadata.episodeNumber > 1;

    let shots = Array.isArray(scenes) ? scenes.map((scene, index) => {
      // v1.2.5: 非第一集将opening类型改为establishing
      let sceneType = scene.scene_type || 'establishing';
      if (isSeriesNonFirst && sceneType === 'opening') {
        console.log(`[ProductionEngine] 非第一集,场景 ${scene.scene_id} 从 opening 降级为 establishing`);
        sceneType = 'establishing';
      }

      // 构建角色描述(v6.37-P1+: 强制极简锚点,3-5关键词)
      const characterAnchors = Array.isArray(scene.characters) ? scene.characters.map(cid => {
        return this._buildMinimalAnchor(cid, characters);
      }) : [];

      // 构建对话(v6.37-P0: 统一格式 SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC:YES)
      // 【v2.1.5-fix-C】优先使用 blocks 字段，回退到 lines
      const dialogueSource = (scene.dialogue?.blocks && Array.isArray(scene.dialogue.blocks))
        ? scene.dialogue.blocks
        : (scene.dialogue?.lines && Array.isArray(scene.dialogue.lines))
          ? scene.dialogue.lines
          : [];
      const dialogueLines = dialogueSource.map(line => {
        const speaker = line.speaker || '角色';
        const type = line.type || (line.manner ? line.manner : '独白');
        const emotion = line.emotion || '平静';
        const text = line.text || line.line || '';
        return `${speaker}|${type}|${emotion}|${text}|LIP_SYNC:YES`;
      });

      // v6.37-P0: 构建五维空间描述(scene字段)
      const sceneDescription = this._buildFiveDimensionScene(scene, worldSetting);

      // v6.37-P0: 构建 mood(3-5情绪关键词)
      let mood = this.shotNormalizer.buildMood(scene);

      // 【审计修复】消费 EmotionArc: 此前 index.js 设计的 _emotionArc 挂在 blueprint 上后全库无人读取,
      // 情绪系统对成片完全不起作用。现将弧线目标注入镜头: 弧线情绪并入 mood, 目标详情挂上镜头。
      const arcTarget = (adaptedBlueprint._emotionArc && Array.isArray(adaptedBlueprint._emotionArc.targets))
        ? adaptedBlueprint._emotionArc.targets[index] || null
        : null;
      if (arcTarget && arcTarget.emotion) {
        mood = `${arcTarget.emotion}, ${mood}`;
      }

      // v6.37-P0: 构建 action(核心动词+交互目标)
      const action = this.shotNormalizer.buildAction(scene);

      return {
        shotId: scene.scene_id || `S${String(index + 1).padStart(2, '0')}`,
        sceneType: sceneType,
        sceneFunction: scene.scene_function || 'establish',

        // v6.37-P0: 时序(保留对象,后续转为字符串)
        timing: {
          start: scene.timing?.start || 0,
          duration: scene.timing?.duration || 20,
          end: scene.timing?.end || 20
        },

        // v1.2.5: 添加顶层duration字段供FieldGuard使用
        duration: scene.timing?.duration || 20,

        // v6.37-P0: 场景(五维空间描述法)
        scene: sceneDescription,

        // v6.37-P0: 情绪
        mood: mood,
        // 【审计修复】情绪弧线目标(供 PromptFusion/导演评审细粒度使用)
        emotionArcTarget: arcTarget,

        // v6.37-P0: 角色(极简锚点)
        // 【v2.1.4-patch5】将 | 改为逗号,避免Seedance渲染乱码
        character: characterAnchors.join(', '),
        characterRef: this.shotNormalizer.buildCharacterRef(scene, characters),

        // v6.37-P0: 动作
        action: action,

        // v6.37-P0: 对话(统一格式)
        dialogue: dialogueLines.join(' || '),

        // 【v2.1.5-fix-C】DIALOGUE_BLOCK 数组，供后续环节（VisualLanguage/AudioDesign/PromptFusion）读取
        dialogueBlocks: scene.dialogue?.blocks || [],

        // 保留原始数据(供内部使用)
        characters: scene.characters || [],
        // 【v2.1.4-patch5】将 | 改为逗号,避免Seedance渲染乱码
        characterDescs: characterAnchors.join(', '),
        dialogueText: (scene.dialogue?.lines && Array.isArray(scene.dialogue.lines))
          ? scene.dialogue.lines.map(l => l.text || l.line || '').filter(Boolean).join(';')
          : '',

        // 情感
        emotionalTarget: scene.emotional_target || { valence: 0, arousal: 0.5 },
        
        // 【v2.1.4-fix9-P1】附加 blueprint 引用，供 Agent 读取导演上下文
        _blueprint: adaptedBlueprint,

        // 视觉方向
        visualDirection: scene.visual_direction || {},

        // Prompt 基础
        promptBase: scene.prompt_base || '',

        // 世界设定
        worldId: worldSetting.world_id || 'default',

        // 状态
        status: 'pending'
      };
    }) : [];

    // v1.2.5: 时长归一化--确保总时长严格等于目标时长
    const targetDuration = adaptedBlueprint.config?.target_duration || adaptedBlueprint.meta?.target_duration || 120;
    shots = this._normalizeDurations(shots, targetDuration);

    return { shots, sceneCount: shots.length };
  }

  /**
   * v1.2.5: 时长归一化
   * 将场景时长按比例缩放,使总时长严格等于目标时长
   */
  _normalizeDurations(shots, targetDuration) {
    if (!shots || shots.length === 0) return shots;

    // 计算当前总时长(取最后一个场景的end时间)
    const currentEnd = Math.max(...shots.map(s => s.timing?.end || 0));
    if (currentEnd <= 0) return shots;

    // 如果已经精确匹配,无需调整
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

      // 缩放时长,至少保留3秒
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

    // 最后微调:确保总时长精确等于目标
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
   * 【v2.1.6】删除硬编码场景池，完全信任剧本生成的 setting，由 LLM 自由设计写实场景
   */
  _buildFiveDimensionScene(scene, worldSetting) {
    // 完全信任剧本生成的 setting
    if (scene.setting && scene.setting.length > 10) {
      return scene.setting;
    }
    
    // 兜底：返回空字符串，由 SceneDesignAgent 的 LLM 调用根据上下文自由生成
    // 系统通过 prompt 中的写实约束（禁止科幻词汇、要求真实光源等）保证质量
    return '';
  }

  /**
   * v6.37-P0: 构建 mood(3-5情绪关键词)
   */
  /**
   * Stage 2: 时长分配(精细化)
   * v6.37-P0: 新增 timeline 字段
   */
  _allocateDuration(shots) {
    const allocator = this.modules.shotDurationAllocator;
    if (!allocator) {
      // 回退:使用剧本引擎的时长
      return { shots };
    }

    // 基于内容重要性、台词长度、视觉复杂度三维度重新分配
    const allocatedShots = shots.map((shot, index) => {
      // 台词越长,时长越长
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

      // v6.37-P1+: 构建 timeline 字段(结构化对象 + 字符串)
      // v1.2.5: 使用已归一化的时长,不再重新分配
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
   * 格式:T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX
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
   * v6.37-P0: 改造 camera 字段为字符串格式,新增 lighting 字段
   */
  _designCameraMovement(shots) {
    const cameraSystem = this.modules.cameraMovement;

    const designedShots = shots.map(shot => {
      // 基于场景类型推断运镜
      const cameraConfig = this._inferCameraConfig(shot);

      // v6.37-P1+: 构建 camera 字段(结构化对象 + 字符串)
      const cameraResult = this._buildCameraString(cameraConfig, shot);

      // v6.37-P1+: 构建 lighting 字段(结构化对象 + 字符串)
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
   * v6.37-P0: 构建 camera 字符串(12级机位+14运镜+焦距+速度)
   */
  /**
   * v6.37-P1+: 构建 camera 字段(结构化对象 + 字符串)
   * 专家反馈:字段级结构化,对象用于程序解析,字符串用于Prompt融合
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

    // 字符串格式(用于Prompt融合)
    const cameraStr = `${cameraObj.shotSize} shot, ${cameraObj.movement}, ${cameraObj.lens} lens, speed ${cameraObj.speed}`;

    return {
      object: cameraObj,
      string: cameraStr
    };
  }

  /**
   * v6.37-P0: 构建 lighting 字段(主光方向+色温K值+特效光)
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

    // 字符串格式(用于Prompt融合)
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
   * Stage 4: Prompt 工程(核心)
   * v6.37-P0: 按参考文档融合顺序构建 Prompt,产出标准字段格式
   * 保留卓越系统特有字段:mouthAction, importance, visualComplexity, qualityScore, enhanced
   */
  _engineerPrompts(shots, blueprint) {
    const prompts = [];
    const engineeredShots = [];
    
    // 【v2.1.4-fix9-P13】兜底路径(_engineerPrompts)也强制写实场景和动作
    const sceneForbidden = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    const fallbackScenes = [
      '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有无文字骨骼肌解剖图与运动损伤海报（纯图形版），木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
      '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，无文字箭头标识牌指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
      '医生诊室，白色墙面悬挂无文字人体解剖示意图（纯图形版），办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
      '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列无文字健康宣传展板（纯图形版），前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
    ];
    const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画', '湿版摄影', '黑色电影'];
    const fallbackActions = [
      '镜头缓慢推近，示例角色站立讲台前，自然手势讲解，眼神注视镜头，警服在荧光灯下轮廓清晰',
      '稳定机位中景，示例角色沿走廊缓步前行，侧头指向检验窗口，白大褂医生从背景走过',
      '手持微晃跟拍，示例角色靠近检查床，手指轻触医学挂图，无影灯在头顶形成柔和光晕',
      '固定机位中景，示例角色坐于沙发边缘，双手交叠置于膝上，LED灯带在身后形成均匀轮廓光',
      '缓慢后拉全景，示例角色站立检验窗口前，转身面向镜头，不锈钢台面反射冷白色光源'
    ];

    for (const shot of shots) {
      // 【v2.1.4-fix9-P13】强制写实过滤
      let filteredScene = shot.scene || '';
      if (sceneForbidden.some(w => filteredScene.includes(w))) {
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        filteredScene = fallbackScenes[idx % fallbackScenes.length];
        console.warn(`[ProductionEngine] ⚠️ 镜头 ${shot.shotId} 场景含禁止词汇，兜底替换为写实场景`);
      }
      
      let filteredAction = shot.action || '';
      if (actionForbidden.some(w => filteredAction.includes(w))) {
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        filteredAction = fallbackActions[idx % fallbackActions.length];
        console.warn(`[ProductionEngine] ⚠️ 镜头 ${shot.shotId} 动作含禁止词汇，兜底替换为写实动作`);
      }
      
      const filteredShot = {
        ...shot,
        scene: filteredScene,
        action: filteredAction
      };

      // v2.0.5-彻底修复: 优先使用标准化后的字段(由_normalizeLLMOutput处理过)
      // 如果标准化字段存在,直接使用;否则做兜底处理
      const cameraStr = filteredShot.cameraString ||
                        filteredShot.camera?.string ||
                        (typeof filteredShot.camera === 'string' ? filteredShot.camera : '') || '';
      const lightingStr = filteredShot.lightingString ||
                          filteredShot.lighting?.string ||
                          (typeof filteredShot.lighting === 'string' ? filteredShot.lighting : '') || '';

      // v2.0.5-彻底修复: timeline优先使用标准化后的timelineString
      let timelineStr = filteredShot.timelineString || '';
      if (!timelineStr) {
        if (filteredShot.timeline?.string && typeof filteredShot.timeline.string === 'string') {
          timelineStr = filteredShot.timeline.string;
        } else if (typeof filteredShot.timeline === 'string') {
          timelineStr = filteredShot.timeline;
        } else if (Array.isArray(filteredShot.timeline)) {
          timelineStr = filteredShot.timeline.map(seg => 
            `${seg.timeRange || ''}: ${seg.cameraMovement || ''}`
          ).join('; ');
        }
      }

      // v2.0.5-彻底修复: 确保backgroundSound有string版本
      let bgSoundResult;
      if (filteredShot.backgroundSoundString && typeof filteredShot.backgroundSoundString === 'string') {
        bgSoundResult = {
          object: filteredShot.backgroundSound || {},
          string: filteredShot.backgroundSoundString
        };
      } else {
        bgSoundResult = this.shotNormalizer.buildBackgroundSound(filteredShot);
      }

      // v2.0.5-彻底修复: 构建shotWithSound供_buildShotPrompt使用
      const shotWithSound = {
        ...filteredShot,
        backgroundSound: bgSoundResult
      };
      const prompt = this.promptBuilder.buildShotPrompt(shotWithSound, blueprint, { cameraStr, lightingStr, timelineStr }, globalNegativePromptInjector);

      // 字符计数
      const promptLength = this.promptBuilder.countChars(prompt.fullPrompt);

      // v6.37-P1+: 构建标准输出对象(严格按 25 字段标准)
      // 正片 S01+: 25 核心字段 | 片头 S00: + audioLayer + titleOverlay
      // v2.0.4-fix: 添加人物介绍卡片
      const characterCards = this._buildCharacterCards(filteredShot, blueprint);

      const standardOutput = {
        // === 标准字段(v6.37-production+)===
        shotId: filteredShot.shotId,
        duration: filteredShot.timing?.duration || 20,
        scene: filteredShot.scene || '',
        mood: filteredShot.mood || '',
        camera: filteredShot.camera?.object || filteredShot.camera || '',
        cameraString: cameraStr,
        lighting: filteredShot.lighting?.object || filteredShot.lighting || '',
        lightingString: lightingStr,
        characterRef: filteredShot.characterRef || 'NONE',
        // v2.0.5-fix: 如果shot.character不存在,从blueprint获取主角名
        character: filteredShot.character || this._getMainCharacterName(blueprint) || 'NONE',
        action: filteredShot.action || '',
        dialogue: filteredShot.dialogue || 'NONE',
        dialogueText: filteredShot.dialogueText || '',
        timeline: filteredShot.timeline?.object || filteredShot.timeline || {},
        timelineString: timelineStr,
        backgroundSound: bgSoundResult.object,
        backgroundSoundString: bgSoundResult.string,
        prompt: prompt.fullPrompt,
        promptCharCount: promptLength,
        // v2.0.4-fix: 人物介绍卡片
        characterCards: characterCards,
        // v2.1.4-fix12: 片头专属字段占位（OpeningTitleOptimizer后处理填充）
        title_content: '',
        subtitle_content: '',
        title_animation: '',
        title_font_design: '',
        opening_audio_design: '',
        // 【v2.1.5-fix】兜底路径也生成P0字段，避免FieldGuard报错
        director_instruction: '好莱坞大导演质感，电影级画面，写实风格，无特效，无科幻元素，自然光效与人工照明融合',
        constraint: 'Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark',
        baseline: '8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus',
        negative: 'no text, no watermark, no logo, no cartoon style, no flat lighting, no blurry, no distorted, no deformed, no extra limbs',
        consistency: '保持角色形象一致，服装发型每帧统一，禁止角色变形或分身',
        // fields 对象 — 25 字段完整版（兜底路径也提供完整默认值，避免空字段穿透）
        fields: {
          director_instruction: '好莱坞大导演质感，电影级画面，写实风格，无特效，无科幻元素，自然光效与人工照明融合',
          constraint: 'Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark',
          baseline: '8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus',
          scene: filteredShot.scene || '',
          lighting: lightingStr || '主光：自然光5600K柔光漫射；补光：反光板填充；整体明亮清晰',
          composition: cameraStr || '景别：中景；主体位置：画面黄金分割点；线条引导：纵深层次感',
          color_palette: '主色调：自然偏暖；辅助色：环境本色；肤色：自然健康；饱和度：中等自然；对比度：中高清晰',
          depth_of_field: '焦点：主体面部；景深：中等；前景背景适度虚化',
          camera_movement: cameraStr || '0-3s固定机位；3-6s缓慢推近',
          character: filteredShot.character || this._getMainCharacterName(blueprint) || '主角',
          costume: '符合角色身份的写实服装，面料质感真实，颜色自然',
          makeup: '素颜或淡妆，妆容自然真实，发型整洁',
          action: filteredShot.action || '',
          props: '场景中必要的写实道具，材质真实，无文字标识',
          portraits: filteredShot.characterRef || 'image://characters/default/portrait.png',
          dialogue: filteredShot.dialogue || 'NONE',
          timeline: timelineStr || 'T00:00 - 开场构图；T00:03 - 主体进入画面；T00:06 - 核心动作',
          mood: filteredShot.mood || 'calm, natural',
          pacing: '整体：沉稳中等节奏；开头：平缓引入；中段：自然推进；结尾：平稳收尾',
          transition: '自然切换，无特效转场，直接硬切或微淡入淡出',
          audio: '环境底噪真实自然，无明显配乐干扰，人声音量适中清晰',
          negative: 'no text, no watermark, no logo, no cartoon style, no flat lighting, no blurry, no distorted, no deformed, no extra limbs',
          bright_constraint: 'bright lighting, well-lit scene, clear visibility, no dark shadows on face',
          character_constraint: `只出现${filteredShot.character || this._getMainCharacterName(blueprint) || '主角'}一人，禁止其他人物入镜，禁止同一角色重复出现`,
          consistency: '保持角色形象一致，服装发型每帧统一，禁止角色变形或分身'
        }
      };

      // 片头专属字段(仅 S00)
      const _meta = blueprint.config?._metadata || blueprint._metadata || {};
      const isSeries = _meta.isSeries || false;
      const episodeNumber = _meta.episodeNumber || 1;
      const hasOpening = isSeries ? (episodeNumber === 1) : true;

      if (filteredShot.sceneType === 'opening' && hasOpening) {
        const audioLayer = this.shotNormalizer.buildAudioLayer(filteredShot);
        const titleOverlay = this.shotNormalizer.buildTitleOverlay(blueprint);
        standardOutput.audioLayer = audioLayer.object;
        standardOutput.audioLayerString = audioLayer.string;
        standardOutput.titleOverlay = titleOverlay.object;
        standardOutput.titleOverlayString = titleOverlay.string;
      }

      engineeredShots.push(standardOutput);
      // 【v2.1.6-fix-bug36】分离 shots 和 prompts 的引用，防止影分身问题
      prompts.push({ ...standardOutput });
    }

    return { shots: engineeredShots, prompts };
  }

  /**
   * v6.37-P0: 构建 mouthAction 字段(供Seedance对口型)
   */
  _buildMouthAction(shot) {
    const actionMap = {
      'opening': '嘴部自然闭合,面对镜头,准备开口',
      'establishing': '嘴部微张,观察时自然呼吸',
      'conflict': '嘴部紧闭,紧张时咬紧牙关',
      'emotional_climax': '嘴部张大,情感爆发时大声呼喊',
      'resolution': '嘴部放松,微笑,平静呼吸'
    };

    return actionMap[shot.sceneType] || '嘴部自然闭合';
  }

  /**
   * 🔊 v2.0-B+: 音频场景映射(极致视听融合)
   */
  _getAudioSceneMap() {
    return {
      'beach': { env: '海浪轻拍沙滩的白噪音,海鸟远处鸣叫', action: '白沙从指缝流下沙沙声', emotion: '温暖治愈的氛围音' },
      'ocean': { env: '海浪拍打礁石,海风呼啸', action: '水花溅起声', emotion: '自由辽阔的海洋气息' },
      'forest': { env: '风吹树叶沙沙声,远处溪流潺潺', action: '脚步声踩落叶', emotion: '宁静安详的自然氛围' },
      'city': { env: '车流白噪音,远处鸣笛', action: '快门声、键盘敲击', emotion: '都市节奏感' },
      'home': { env: '室内温暖环境音', action: '婴儿咯咯笑声', emotion: '温馨家庭氛围' },
      'mountain': { env: '山风呼啸,远处鸟鸣', action: '雪粉飞扬声', emotion: '壮丽寂静的高山氛围' },
      'studio': { env: '摄影棚安静环境', action: '快门咔嚓声', emotion: '专业专注的工作氛围' }
    };
  }

  /**
   * 🔊 v2.0-B+: 构建音频描述(自然语言格式,Seedance可理解)
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

    // 回退:基于时间
    if (!template) {
      if (timeOfDay.includes('night') || timeOfDay.includes('dusk')) {
        template = { env: '夜晚虫鸣,远处低语', action: '轻柔脚步声', emotion: '神秘宁静的夜晚氛围' };
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
      'establishing': '环境音渐显,氛围建立',
      'climax': '全频段饱满,情绪峰值',
      'resolve': '音乐渐弱,余音缭绕'
    };
    const emotionSound = emotionAudioMap[emotion] || template.emotion;
    parts.push(`氛围弥漫${emotionSound}`);

    // L4: 声画同步(如果含对话)
    if (shot.dialogueText || shot.hasDialogue) {
      parts.push('声画精准同步,嘴型与发音对齐');
    }

    return parts.join(',');
  }

  /**
   * 构建单个镜头的完整 Prompt(v2.0-B+: 七层架构 + 极致视听融合 + v6.37-P0 字段对齐)
   *
   * 融合顺序(按参考文档 v6.37-Peng):
   * CharacterRef → Timeline → Dialogue → AudioLayer(片头) → TitleOverlay(片头) →
   * BackgroundSound → Character → Action → Scene → Mood → Camera → Lighting →
   * PhysicsLayer → ColorScience → NegativePrompt → RenderStyle → DirectorStyle
   *
   * 七层结构:
   * L1: 约束层(P0必加)- 画幅/帧率/无字幕
   * L2: 基础层(P0必加)- 写实度/HDR/胶片质感
   * L3: 空间层(P1防平庸)- scene字段(五维空间)
   * L4: 主体层(P2防漂移)- character/action/dialogue
   * L5: 动态层(P1防平庸)- camera/timeline
   * L6: 风格层(P2防漂移)- mood/lighting
   * L7: 音频层(🔊 新增)- backgroundSound/audioLayer
   * L8: 内部层(扩展)- PhysicsLayer/ColorScience/NegativePrompt/RenderStyle/DirectorStyle
   * L9: 质控层(P0必加)- 负面约束/角色一致性
   */
  /**
   * Stage 6: 片头生成
   * 产出符合 25 字段标准（片头为空景，角色相关字段留空）
   */
  _generateOpening(blueprint) {
    const config = blueprint.config || {};
    const worldSetting = blueprint.worldSetting || {};
    // B6-fix: 移除 featured_beast_id 强制要求,通用项目也生成片头
    // const beastId = config.featured_beast_id;
    // if (!beastId) { return { generated: false, reason: '无 featured_beast_id' }; }

    // B7-fix: 复用 _buildBackgroundSound 保证格式一致
    const openingBgSound = this.shotNormalizer.buildBackgroundSound({ sceneType: 'opening' });
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
        producer: `by ${config.producer || 'HAVS Team'}`,
        titleAnim: 'light-vein carving growth 3.0-5.0s'
      },
      titleOverlayString: `MAIN_TITLE: "${config.title || '未命名'}"; SUBTITLE: "${worldSetting.name || '系列作品'}"; PRODUCER: "by ${config.producer || 'HAVS Team'}"; TITLE_ANIM: light-vein carving growth 3.0-5.0s`,
      // 【v2.1.4-patch2】FieldGuard兼容:添加顶层title/subtitle字段
      title: config.title || '未命名',
      subtitle: worldSetting.name || '系列作品',
      // B7-fix: 复用 _buildBackgroundSound 保证格式一致
      backgroundSound: openingBgSound.object,
      backgroundSoundString: openingBgSound.string,
      prompt: '', // 由 Prompt 工程构建
      promptCharCount: 0,
      // 25 字段完整填充（片头为空景，角色相关留空）
      director_instruction: '史诗级片头，大气磅礴，电影级质感，超写实风格',
      constraint: 'Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark',
      baseline: '8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus',
      composition: 'extreme wide shot, symmetrical composition, horizon line at lower third, vast scale',
      color_palette: 'golden hour warm tones, deep shadows, rich contrast, cinematic color grading',
      depth_of_field: 'deep focus, atmospheric haze, infinite spatial depth',
      camera_movement: 'slow dolly in, 0.3 speed, 24mm wide lens, rack focus from atmosphere to ground',
      costume: '',
      makeup: '',
      props: '',
      portraits: '',
      pacing: 'slow, majestic, building tension',
      transition: 'fade in from black, gradual reveal',
      audio: 'sub-bass earth rumble, distant wind, string section, timpani strike, cinematic epic soundtrack',
      negative: 'no text, no watermark, no logo, no cartoon style, no flat lighting, no blurry',
      bright_constraint: 'well-lit scene, clear visibility, natural lighting',
      character_constraint: '',
      consistency: '片头风格与正片保持一致，色调统一'
    };

    // 构建片头 Prompt(传入结构化字符串)
    const prompt = this.promptBuilder.buildShotPrompt(openingData, blueprint, {
      cameraStr: openingData.cameraString,
      lightingStr: openingData.lightingString,
      timelineStr: openingData.timelineString
    }, globalNegativePromptInjector);
    openingData.prompt = prompt.fullPrompt;
    openingData.promptCharCount = this.promptBuilder.countChars(prompt.fullPrompt);

    return {
      generated: true,
      openingData,
      shotId: 'S00',
      type: 'opening',
      beastId: null
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
   * v2.0.5-fix: 从blueprint获取主角名称
   */
  _getMainCharacterName(blueprint) {
    const characters = blueprint.characters || [];
    // 找 protagonist 角色,或第一个角色
    const protagonist = characters.find(c => c.role === 'protagonist') || characters[0];
    return protagonist?.name || null;
  }

  /**
   * v6.37+: 构建 portraits 数组(FieldGuard 要求的关键字段)
   */
  _buildPortraits(shot, blueprint) {
    const portraits = [];
    const characters = shot.characters || blueprint.characters || [];

    for (const char of characters) {
      // v6.37+: 预生产阶段如果没有定妆照,生成占位符记录,避免FieldGuard警告
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
   * v6.37+: 构建 characterCards 数组(FieldGuard 要求的关键字段)
   */
  _buildCharacterCards(shot, blueprint) {
    const cards = [];
    // v2.0.5-彻底修复: 优先从blueprint获取完整角色信息
    // _normalizeLLMOutput已经确保shot.characters被填充,但blueprint.characters更完整
    const characters = blueprint.characters || shot.characters || [];

    if (characters.length === 0) {
      // 兜底:如果完全没有角色信息,尝试从blueprint.config或meta提取
      const config = blueprint.config || {};
      const meta = blueprint.meta || {};
      if (config.character || meta.character) {
        const char = config.character || meta.character;
        cards.push({
          characterId: char.character_id || char.id || char.name || 'unknown',
          name: char.name || '未知角色',
          role: char.role || 'protagonist',
          description: char.description || char.persona || '',
          voiceProfile: char.voiceProfile || char.voice_profile || {}
        });
      }
      return cards;
    }

    for (const char of characters) {
      cards.push({
        // v2.0.5-彻底修复: 支持character_id和id两种字段名
        characterId: char.character_id || char.id || char.name || 'unknown',
        name: char.name || char.id || char.character_id || '未知角色',
        role: char.role || 'supporting',
        description: char.description || char.persona || char.personality || '',
        voiceProfile: char.voiceProfile || char.voice_profile || {}
      });
    }

    return cards;
  }

  /**
   * 生成生产报告
   */
  generateReport(result) {
    // v1.2.6-fix: 标准输出对象没有 timing 字段,用顶层 duration;prompts 用 promptCharCount
    const totalDuration = (result.shots || []).reduce((sum, s) => {
      return sum + (s.duration || s.timing?.duration || 0);
    }, 0);

    const prompts = result.prompts || [];
    const avgPromptLength = prompts.length > 0
      ? prompts.reduce((sum, p) => sum + (p.promptCharCount || (typeof p.prompt === 'string' ? p.prompt.length : 0) || 0), 0) / prompts.length
      : 0;

    return {
      engine: 'ProductionEngine',
      version: '1.0.0',
      success: result.success,
      summary: {
        totalShots: (result.shots || []).length,
        totalPrompts: prompts.length,
        totalDuration,
        avgPromptLength: Math.round(avgPromptLength)
      },
      stages: Object.fromEntries(
        Object.entries(result.stages || {}).map(([k, v]) => [k, {
          duration: v._stageDuration || 0,
          success: !v.error
        }])
      ),
      errors: result.errors,
      timing: result.timing
    };
  }
  /**
   * 【v2.1.4-fix10-P25-fix3】暴露给外部（如 index.js FieldGuard 重算 prompt）
   */
  assemblePromptFromFields(shot, fields, ratio) {
    // 委托给 PromptFusionAgent 的 _assembleStandardPrompt
    const agent = this.agents?.promptFusion || new PromptFusionAgent({ maxPromptLength: this.config.maxPromptLength });
    return agent._assembleStandardPrompt(shot, fields, ratio);
  }

  countChars(s) {
    const agent = this.agents?.promptFusion || new PromptFusionAgent({ maxPromptLength: this.config.maxPromptLength });
    return agent._countChars(s);
  }
}

module.exports = { ProductionEngine };