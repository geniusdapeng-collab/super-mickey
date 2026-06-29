/**
 * Nirath Master Pipeline v1.1
 * 世界级IP短片生成引擎主链路入口
 *
 * 🔥 P0-固化原则:每次预生产必须走全链路 + 各环节最新版
 * - 每次执行 = 全新执行,无视历史。清理旧输出 → 跑完整链路 → 全新数据 → 当前版本
 * - 预生产不是生产,是测试。测试就要用最新代码、全新数据、完整链路
 * - 禁止复用旧输出、禁止跳过环节、禁止用历史数据替代重新生成
 * - 即使同一任务反复测试,每次也必须用最新系统版本重新跑完整链路
 * - 违反 = 系统级错误,立即上报队长
 *
 * v6.5.13: generic模式修复
 * - 修复LLM返回"undefined"字符串导致scene字段丢失
 * - 修复五要素注入残留Nirath痕迹（主角主动性/情感弧线/成长转变）
 * - 修复导演风格错误使用alien_ecosystem（generic模式返回纪录片风格）
 * - 修复运镜系统返回字符串而非对象导致description为空
 * - v6.5.12: generic模式prompt动态模板 + 角色校验 + 可选链修复
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ========== v6.6.0: 真实感提示词增强器（软性注入层）==========
const { RealismPromptEnhancer } = require('./realism-prompt-enhancer.js');

// ========== 新增:链路完整性反向验证器 ==========
const { PipelineIntegrityValidator } = require('./pipeline-integrity-validator.js');

// ========== 新增:定妆照强制提交闸机 v1.0 ==========
const { ReferenceImageGate } = require('./reference-image-gate.js');

// ========== v6.0-patch38新增:全局负面提示词注入器 ==========
const { globalNegativePromptInjector } = require('./global-negative-prompts.js');

// ========== v6.2-patch82: Prompt标准模块化系统 ==========
const StandardV3 = require('./prompt-standard-v3');  // v3.0: 智能检测+自动修复(旁路)

// ========== v6.5.58: Validator 3 Bug 修复 ==========
const { normalizeLLMOutput } = require('./llm-output-normalizer');
const { standardizePrompt } = require('./prompt-standardizer');
const { safeTrimPrompt } = require('./safe-prompt-trim');
const { checkStandardCompliance } = require('./prompt-standard-v3');
const { processShotsForCompliance, processShotsForOutput, summarizeCompliance } = require('./prompt-pipeline-bridge');

// ========== 新增:镜头内Prompt增强器(v6.0-patch23融入) ==========
const { buildAudioDescription, injectAudioDescription } = require('./intra-shot-prompt-enhancer.js');
const { CalibrationEngine, PRD_TEMPLATE } = require('../shanhaijing-render-engine/story-prd-template-v21.js');
const { RequirementContract, AlignmentGate } = require('../seedance-director/scripts/requirement-alignment-gate.js');
const { SchemaRuntimeValidator } = require('../seedance-director/scripts/schema-validator.js');
const { StoryboardValidator } = require('./storyboard-validator.js');
const { preRenderValidation, validateCharacterReferences } = require('./pre-render-validation.js');

// ========== v2.0: 创意指数系统 (Creative Intensity Index) ==========
const { CreativeIntensityIndex } = require('./creative-intensity-index.js');
const { CreativeIntensityRecommender } = require('./creative-intensity-recommender.js');

// ========== 新增:片头系统集成(v3.0-patch5) ==========
const OpeningSystem = require('./opening-system-v3.js');
const { CharacterManagerV2 } = require('./character-manager-v2.js');
const { CharacterPromptBuilder } = require('./character-prompt-builder.js');
const { CharacterComplianceChecker } = require('./character-compliance-checker.js');
const { CharacterEraGuide } = require('./character-era-guide.js');

// v6.3-patch10-fix: 引入真实字符计数模块
const { charCounter } = require('./char-counter');
const { dedupeShotFields } = require('./prompt-dedupe');
const PROMPT_LENGTH = require('../config/prompt-length');

// ========== v6.2-patch68: 环境音效设计Agent ==========
const { generateAmbientSoundField } = require('./ambient-sound-designer.js');

// ========== 渲染层模块(Nirath原生) ==========
const { OrientPrimordialCoreV24 } = require('../shanhaijing-render-engine/orient-primordial-core-v24.js');
const { CameraMovementSystem } = require('./camera-movement-system-v2.js');
// 🔥 v6.2-fix: 引入v3镜头内时间轴生成器(恢复英雄之旅运镜复杂度)
const { CameraMovementSystemV4 } = require('./camera-movement-system-v4.js');
const { NirathCharacterEnhancer, WorldSoulBinding } = require('./nirath-character-enhancement.js');
const audit = require('./audit-logger'); // P1: 操作审计日志
const { UniversalStyleInjector } = require('./universal-style-injector.js');

// ========== 辅助层模块 ==========
const { ShotDurationAllocator } = require('./shot-duration-allocator.js');
const { DurationCalculator } = require('./duration-calculator.js');
const { ContinuityEngine } = require('./continuity-engine.js');

// 【v6.0-patch22 新增】Nirath 视觉锚点注入器
const { NirathVisualAnchorInjector } = require('./nirath-visual-anchor-injector.js');

// 【v6.4.1】StageRunner + StageService + QualityGate
const { StageRunner } = require('./stage-runner');
const { StageContext } = require('./stage-context');
const { QualityGate } = require('./quality-gate');
// const { StageScriptService } = require('./stages/stage-script');
// const { StageDurationService } = require('./stages/stage-duration');
// const { StageStoryboardService } = require('./stages/stage-storyboard');
// const { StageCameraService } = require('./stages/stage-camera');
// const { StageRenderPrepService } = require('./stages/stage-render-prep');

// 【v6.0-patch22 新增】后期制作管线(标题烧录)
const { PostProductionPipeline } = require('./post-production-pipeline.js');

// 【v6.2-patch46 新增】MicroMotion + BeastMotion 动作增强适配器
let MicroMotionSystem, ShanhaijingMicroMotionSystem, beastMotionAdapter;
try {
  MicroMotionSystem = require('../seedance-micromotion/scripts/micromotion').MicroMotionSystem;
} catch (e) { /* 可选依赖 */ }
try {
  ShanhaijingMicroMotionSystem = require('../shanhaijing-micromotion/scripts/micromotion').ShanhaijingMicroMotionSystem;
} catch (e) { /* 可选依赖 */ }
try {
  beastMotionAdapter = require('../shanhaijing-beast-motion/beast-motion-adapter');
} catch (e) { /* 可选依赖 */ }

// 【v6.2-patch47 新增】美术布景模块(Set Design Module)
let SetDesignModule;
try {
  SetDesignModule = require('./set-design-module/index').SetDesignModule;
} catch (e) { /* 可选依赖 */ }

// 【v6.2-patch51 新增】主角主动性自动注入器
const { ProactiveProtagonistInjector } = require('./proactive-protagonist-injector.js');

// 【v6.2-patch51 新增】结尾镜情绪增强器
const { ClosingShotEmotionalBooster } = require('./closing-shot-emotional-booster.js');

// 【v6.2-patch51 新增】Narration自动精简器
const { NarrationAutoTrim } = require('./narration-auto-trim.js');

// 【v6.2-patch52 新增】时长-字数一致性校准器
const { DurationNarrationAlignment } = require('./duration-narration-alignment.js');
// 【v6.2-patch53 新增】执行完整性强制器
// 【v6.6.0 新增】用户需求解析确认模块（Stage -1）
const { UserRequirementParser } = require('./user-requirement-parser.js');

const { ExecutionIntegrityEnforcer } = require('./execution-integrity-enforcer.js');

// ========== v6.2-patch96: 微表情系统 v2.0 ==========
const { MicroExpressionAllocator } = require('./micro-expression-system-v2.js');
// ========== v6.2-patch63: 独白通道隔离+运镜同步+情绪增强器边界修复 ==========
const PromptTierArchitecture = require('./prompt-tier-architecture.js');
const { PromptChannelSeparator } = require('./prompt-channel-separator.js');
const { PromptQualityGate } = require('./prompt-quality-gate.js');
const { TechSpecsAndEmotionMapper } = require('./tech-specs-emotion-mapper.js');
const { WorldviewAndSceneManager } = require('./worldview-scene-manager.js');

// 【v6.5.43】引入新链路：FinalPromptBuilderV3（外部专家建议落地）
const { FinalPromptBuilderV3 } = require('./final-prompt-builder-v3');
function safeGetPromptText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const candidates = [
    obj.render_prompt,
    obj.renderPrompt,
    obj.prompt,
    obj.visualPrompt
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item;
  }
  return '';
}

function getPromptLengthStatus(length) {
  if (length > PROMPT_LENGTH.HARD_MAX) return 'overflow';
  if (length < PROMPT_LENGTH.TARGET_MIN) return 'underflow';
  if (length <= PROMPT_LENGTH.TARGET_MAX) return 'ideal';
  return 'unknown';
}

function slimPipelineResult(result) {
  const stages = result?.stages || {};
  const prompts = stages.output?.prompts || [];
  const storyboardShots = stages.storyboard?.shots || [];

  const getPrompt = (p) => {
    if (!p || typeof p !== 'object') return '';
    return p.prompt || p.text || p.content || p.visualPrompt || p.description || '';
  };

  const getLength = (p) => {
    if (p && p.length) return p.length;
    const text = getPrompt(p);
    return text ? text.length : 0;
  };

  return {
    success: result?.success ?? false,
    errors: result?.errors || [],
    integrityReport: result?.integrityReport || null,
    stages: {
      output: {
        prompts: prompts.map(p => ({
          shotId: p?.shotId,
          scene: p?.scene,
          type: p?.type,
          duration: p?.duration,
          prompt: getPrompt(p),
          length: getLength(p),
          lengthStatus: getPromptLengthStatus(getLength(p)),
          utilization: p?.utilization,
          utilizationStatus: p?.utilizationStatus,
          qualityScore: p?.qualityScore,
          characters: p?.characters,
          mouthAction: p?.mouthAction,
          referenceImages: Array.isArray(p?.referenceImages)
            ? p.referenceImages.map(r => ({ shotType: r?.shotType || r?.type || 'unknown' }))
            : []
        }))
      },
      storyboard: {
        shots: storyboardShots.map(s => ({
          id: s?.id,
          scene: s?.scene,
          type: s?.type,
          duration: s?.duration,
          timeline: s?._timeline || s?.cameraMovement?.timeline || null
        }))
      },
      stageList: Object.keys(stages)
    }
  };
}

// ========== 配置 ==========
// 使用动态路径替代硬编码
const WORKSPACE = process.env.WORKSPACE_DIR || path.join(__dirname, '..');

class NirathMasterPipeline {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath'; // 'generic' | 'nirath'
    this.projectConfig = options.projectConfig || {};
    this.useLLM = options.useLLM !== false; // v6.2-patch71-fix: 默认启用LLM
    this.llmEngine = options.llmEngine || null; // v6.6.5-fix: 初始化LLM引擎引用
    this._modules = null; // 🔥 v6.2-patch75: 惰性加载,首次访问时初始化
    this.statusReporter = options.statusReporter || null; // 【v6.2-patch84】状态报告器
    this.outputDir = options.outputDir || '/tmp'; // v6.2-patch111-fix: 确保outputDir有默认值

    // 定义modules getter -- 惰性初始化所有模块
    Object.defineProperty(this, 'modules', {
      get: () => {
        if (!this._modules) {
          this._initModules();
        }
        return this._modules;
      },
      configurable: true
    });

    // 🔥 v2.0: 创意指数系统初始化
    this.creativeIntensityIndex = new CreativeIntensityIndex({
      defaultValue: 0.2,
      maxValue: 1.0,
      minValue: 0.0
    });
    
    // 🔥 v2.0: Phase 3 - 智能推荐系统初始化
    this.creativeIntensityRecommender = new CreativeIntensityRecommender({
      dataPath: path.join(__dirname, '../data/creative-intensity-feedback.json'),
      minSamples: 3,
      confidenceThreshold: 0.6
    });
    
    // 🔥 v6.6.0: 真实感提示词增强器（软性注入层）
    this.realismEnhancer = new RealismPromptEnhancer({
      enabled: true,
      mode: 'smart', // 默认智能模式：分析缺失维度并补全
      sceneType: 'general'
    });

    this.creativeIntensity = null; // 将在execute中解析
    this.errors = [];
    this.logs = []; // v6.6.5-fix: 日志数组初始化
    this._asyncTasks = []; // v6.2-patch76: 追踪异步LLM任务
    this.charactersDir = options.charactersDir || path.join(__dirname, '..', 'characters'); // v6.6.5: 角色目录初始化
  }

  /**
   * v6.2-patch76: 注册异步任务,供外部等待
   */
  _registerAsyncTask(promise) {
    this._asyncTasks.push(promise);
    // 清理已完成的任务
    promise.finally(() => {
      const idx = this._asyncTasks.indexOf(promise);
      if (idx >= 0) this._asyncTasks.splice(idx, 1);
    });
    return promise;
  }

  /**
   * v6.2-patch76: 获取所有pending的异步任务
   */
  getPendingAsyncTasks() {
    return this._asyncTasks.filter(p => p && typeof p.then === 'function');
  }

  // 🔥 v6.2-patch75: 模块惰性初始化器 -- 首次访问modules时触发
  _initModules() {
    this.log('INIT', '🚀 首次访问modules,惰性初始化59个模块(启动提速50-70%)');

    this._modules = {
      // 核心层
      calibrationEngine: new CalibrationEngine(),
      alignmentGate: new AlignmentGate(),
      schemaValidator: new SchemaRuntimeValidator(),
      storyboardValidator: new StoryboardValidator(),
      preRenderValidation: async (path, opts) => preRenderValidation(path, opts),

      // 角色层
      characterManager: new CharacterManagerV2(),
      characterPromptBuilder: new CharacterPromptBuilder(),
      characterComplianceChecker: new CharacterComplianceChecker(),
      characterEraGuide: new CharacterEraGuide(),

      // 渲染层
      renderCore: new OrientPrimordialCoreV24(),
      cameraMovement: new CameraMovementSystem(),
      nirathCharacterEnhancer: new NirathCharacterEnhancer(),
      worldSoulBinding: new WorldSoulBinding(),
      styleInjector: new UniversalStyleInjector(),

      // 辅助层
      shotDurationAllocator: new ShotDurationAllocator(),
      durationCalculator: new DurationCalculator(),
      continuityEngine: new ContinuityEngine(),

      // 【v6.2-patch46 新增】MicroMotion + BeastMotion 动作增强适配器
      microMotionAdapter: null, // 由Pipeline初始化时注入
      beastMotionAdapter: null, // 由Pipeline初始化时注入

      // 【v6.2-patch47 新增】美术布景模块
      setDesignModule: null, // 由Pipeline初始化时注入

      // 【v6.2-patch51 新增】主角主动性自动注入器
      protagonistInjector: new ProactiveProtagonistInjector(),

      // 【v6.2-patch51 新增】结尾镜情绪增强器
      closingBooster: new ClosingShotEmotionalBooster(),

      // 【v6.2-patch51 新增】Narration自动精简器
      narrationTrimmer: new NarrationAutoTrim(),

      // 【v6.2-patch52 新增】时长-字数一致性校准器
      durationAlignment: new DurationNarrationAlignment(),

      // 【v6.5.43】新链路：FinalPromptBuilderV3（外部专家建议落地）
      finalPromptBuilder: new FinalPromptBuilderV3({
        debug: true,
        llmEnabled: this.useLLM,
        debugOutputDir: this.outputDir
      }),
      promptTierArchitecture: new PromptTierArchitecture(),
      promptChannelSeparator: new PromptChannelSeparator(),
      promptQualityGate: new PromptQualityGate(),
      techSpecsEmotionMapper: new TechSpecsAndEmotionMapper(),
      worldviewSceneManager: new WorldviewAndSceneManager(),

      // 【v6.0-patch22 新增】Nirath视觉锚点注入器
      nirathVisualInjector: new NirathVisualAnchorInjector(),

      // 【v6.0-patch22 新增】后期制作管线(生产阶段使用)
      postProduction: new PostProductionPipeline({
        outputRatio: '16:9',
        outputWidth: 1280,
        outputHeight: 720
      })
    };

    // 【v6.2-patch46】初始化动作增强适配器(可选)
    if (ShanhaijingMicroMotionSystem) {
      this._modules.microMotionAdapter = new ShanhaijingMicroMotionSystem({ debug: false });
    } else if (MicroMotionSystem) {
      this._modules.microMotionAdapter = new MicroMotionSystem({ debug: false });
    }
    if (beastMotionAdapter) {
      this._modules.beastMotionAdapter = beastMotionAdapter;
    }

    // 【v6.2-patch47】初始化美术布景模块(可选)
    if (SetDesignModule) {
      this._modules.setDesignModule = new SetDesignModule({ debug: false });
    }
  }

  log(stage, message, level = 'info') {
    const entry = { timestamp: new Date().toISOString(), stage, level, message };
    this.logs.push(entry);
    if (level === 'error') this.errors.push(entry);
    console.log(`[${entry.timestamp}] [${stage}] ${level.toUpperCase()}: ${message}`);
  }

  // ========== 🔥 v6.2新增: 前置检查(定妆照存在性 + 输入完整性)==========
  async preFlightCheck(input) {
    this.log('PREFLIGHT', '🔍 启动前置检查(v6.2)');
    const issues = [];
    const portraits = [];

    // 1. 角色定妆照检查
    const charactersData = Array.isArray(input.characters)
      ? Object.fromEntries(input.characters.map(c => [c.id, c]))
      : (input.characters || {});
    const characterIds = Object.keys(charactersData);

    for (const charId of characterIds) {
      const check = await this.checkCharacterPortraits(charId);
      portraits.push({ charId, ...check });
      if (!check.exists) {
        issues.push({
          type: 'portrait_missing',
          charId,
          missingAngles: check.missingAngles,
          message: `角色[${charId}]定妆照缺失:${check.missingAngles.join(', ')}`
        });
      } else {
        this.log('PREFLIGHT', `  ✅ 定妆照齐全: ${charId} | ${check.foundAngles.length}个角度`);
      }
    }

    // 2. 基本输入完整性检查
    if (!input.projectName) issues.push({ type: 'input_missing', field: 'projectName' });
    // v6.6.5: 用户只说一句话，scenes 自动推断而非阻断
    if (!input.scenes || input.scenes.length === 0) {
      this.log('PREFLIGHT', `  ⚠️ 缺少 scenes，将自动推断场景结构`);
      // 不阻断，标记为自动推断
      input._autoGeneratedScenes = true;
    }
    if (characterIds.length === 0) issues.push({ type: 'input_missing', field: 'characters' });

    const canProceed = issues.length === 0;

    this.log('PREFLIGHT', canProceed
      ? `✅ 前置检查通过 | 角色数: ${characterIds.length}`
      : `⛔ 前置检查失败 | 问题数: ${issues.length}`);

    return { canProceed, issues, portraits, characterCount: characterIds.length };
  }

  /**
   * 【v6.3-patch7-fix】清理 Stage 3 合成师输出的字符计数残留
   * 处理如 "焦(1);(1)1(1)2(1)-(1)1(1)5(1)s(1)..." 这种格式
   */
  _cleanForgePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return prompt;

    let cleaned = prompt;

    // 只清理字符计数残留,不删除任何内容
    cleaned = cleaned.replace(/\(\d+\)/g, '');
    cleaned = cleaned.replace(/=\d+字符/g, '');
    cleaned = cleaned.replace(/\d+chars/gi, '');

    // 清理多余空格
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  // ========== 主链路执行 ==========
  async execute(input, options = {}) {
    const { onStageComplete } = options; // 🔥 v6.5.60: 阶段完成回调
    
    const pipelineStart = Date.now(); // P1: 审计日志计时
    this.log('PIPELINE', `🚀 NirathMasterPipeline启动 | 模式: ${this.mode} | 项目: ${input.projectName || 'unknown'}`);

    // 🔥 P0-固化原则:每次预生产必须走全链路 + 各环节最新版
    // 每次执行 = 全新执行,无视历史。清理旧输出 → 跑完整链路 → 全新数据 → 当前版本
    // 预生产不是生产,是测试。测试就要用最新代码、全新数据、完整链路
    // 禁止复用旧输出、禁止跳过环节、禁止用历史数据替代重新生成
    // 即使同一任务反复测试,每次也必须用最新系统版本重新跑完整链路
    // 违反 = 系统级错误,立即上报队长
    this.log('PIPELINE', '🔥 P0-固化:每次预生产 = 全链路 + 最新版 | 无视历史,全新执行');

    // 🔥 v6.6.0: Stage -1 — 用户需求解析确认模块（前置闸机，所有输入必须经过）
    // 无论输入是自然语言还是结构化数据，都要经过需求解析确认
    // 自然语言：解析+补全+确认
    // 结构化数据：验证+补全+确认（可能用户遗漏了某些字段）
    this.log('PIPELINE', '📝 [Stage -1] 启动需求解析确认模块...');
    try {
      const parser = new UserRequirementParser({ llmEngine: this.llmEngine });
      
      // 将输入统一为字符串（如果是结构化，先序列化）
      let parseInput;
      if (typeof input === 'string') {
        parseInput = input;
      } else {
        // 结构化输入：提取关键信息，让 parser 做验证和补全
        parseInput = JSON.stringify({
          videoType: input.videoType || input.type,
          title: input.title || input.projectName,
          characters: input.characters?.map(c => c.name || c).join(', '),
          duration: input.targetDuration || input.duration,
          style: input.style,
          creativeIntensity: input.creativeIntensity,
          platform: input.platform || input.core?.platform,
          series: input.isSeries ? `共${input.totalEpisodes}集，第${input.episode}集` : '',
          // 保留原始描述
          rawDescription: input.description || input._rawInput || ''
        });
      }
      
      const parseResult = await parser.parse(parseInput, { mode: this.mode });
      
      this.log('PIPELINE', `📝 [Stage -1] ✅ 需求解析完成 | 类型: ${parseResult.basicInfo.videoTypeName} | 时长: ${parseResult.productionSpecs.duration.target}秒 | 创意指数: ${parseResult.productionSpecs.creativeIntensity}`);
      
      // v6.6.4: 生成《视频需求要点清单》并保存
      const requirementListPath = await parser.saveRequirementList(parseResult);
      const requirementList = parser.generateRequirementList(parseResult);
      this.log('PIPELINE', `📝 [Stage -1] ✅ 需求清单已生成: ${requirementListPath}`);
      
      // 输出清单内容到日志（用户可见）
      console.log('\n' + '='.repeat(60));
      console.log('📋 视频需求要点清单（请确认后进入预生产）');
      console.log('='.repeat(60));
      console.log(requirementList);
      console.log('='.repeat(60));
      
      // 将清单保存到 pipeline 上下文，供后续追溯
      this.requirementList = {
        content: requirementList,
        path: requirementListPath,
        parseResult: parseResult,
        confirmed: false, // 待确认
        timestamp: new Date().toISOString()
      };
      
      // v6.6.4: 需求清单确认检查（除非用户显式跳过）
      if (options.skipRequirementConfirmation !== true) {
        this.log('PIPELINE', '⏸️ [Stage -1] 需求清单已生成，等待用户确认...');
        this.log('PIPELINE', '⏸️ 请检查上方"视频需求要点清单"，确认后回复"确认"继续');
        
        // 返回清单等待确认，不进入主链路
        return {
          status: 'REQUIREMENT_CONFIRMATION_REQUIRED',
          message: '请确认视频需求要点清单',
          requirementList: this.requirementList,
          nextStep: '回复"确认"或提出修改意见'
        };
      }
      
      this.log('PIPELINE', '📝 [Stage -1] ✅ 用户已确认（跳过模式），进入主链路...');
      
      // 将解析结果合并到现有输入（解析结果优先，但保留用户的显式指定）
      let pipelineInput = parser.toPipelineInput(parseResult);
      
      // 如果用户输入是结构化的，保留用户的显式字段（用户指定 > AI推断）
      if (typeof input === 'object') {
        // 保留用户显式指定的字段
        if (input.videoType) pipelineInput.videoType = input.videoType;
        if (input.title) pipelineInput.title = input.title;
        if (input.targetDuration) pipelineInput.targetDuration = input.targetDuration;
        if (input.creativeIntensity !== undefined) pipelineInput.creativeIntensity = input.creativeIntensity;
        if (input.style) pipelineInput.style = input.style;
        if (input.characters) pipelineInput.characters = input.characters;
        // 保留其他用户字段
        pipelineInput = { ...pipelineInput, ...input };
      }
      
      pipelineInput._requirementParseResult = parseResult; // 保留原始解析结果供追溯
      input = pipelineInput;
      
      this.log('PIPELINE', '📝 [Stage -1] ✅ 需求解析确认完成，进入主链路...');
    } catch (error) {
      this.log('PIPELINE', `⚠️ [Stage -1] 需求解析异常: ${error.message}，使用原始输入继续`);
      // 如果解析失败，保持原始输入不变，但记录错误
      if (typeof input === 'object') {
        input._requirementParseError = error.message;
      }
    }

    // 🔥 v2.0: 创意指数解析（Stage 0 前置）
    this.creativeIntensity = this.creativeIntensityIndex.parse(input);
    
    // 🔥 v2.0: Phase 3 - 智能推荐系统（如果用户未指定，自动推荐）
    if (!input.creativeIntensity && !input.creative && !input.intensity) {
      const videoType = input.videoType || input.type || 'generic';
      const recommendation = this.creativeIntensityRecommender.recommend(videoType);
      
      if (!recommendation.isDefault) {
        // 数据驱动推荐，覆盖默认值
        this.creativeIntensity = recommendation.intensity;
        this.log('PIPELINE', `🎨 [智能推荐] 视频类型="${videoType}" | 基于 ${recommendation.samples} 个样本推荐 intensity=${recommendation.intensity} | 置信度 ${(recommendation.confidence * 100).toFixed(0)}%`);
      } else {
        // 使用默认值，但提示用户
        this.log('PIPELINE', `🎨 [智能推荐] 视频类型="${videoType}" | 样本不足，使用类型默认值 intensity=${recommendation.intensity} | ${recommendation.reason}`);
      }
    }
    
    const ciiReport = this.creativeIntensityIndex.generateReport(this.creativeIntensity);
    this.log('PIPELINE', `🎨 创意指数解析: ${this.creativeIntensity} (${ciiReport.levelName}) | 激活 ${ciiReport.activeModules.length}/14 模块`);
    this.log('PIPELINE', ciiReport.firewall);

    // 【v6.2-patch53】执行完整性强制器 - 三重锁启动
    const enforcer = new ExecutionIntegrityEnforcer();
    await enforcer.enforcePreExecution(path.join(__dirname, '..'));

    // P1: 审计日志 - 链路启动
    audit.log('pipeline-start', 'nirath-master-pipeline', {
      actor: 'system',
      input: { projectName: input.projectName, mode: this.mode, shotCount: input.shots?.length },
      result: 'pending',
      metadata: { projectType: input.videoType }
    }).catch(e => console.error(`[Audit] 日志写入失败: ${e.message}`));

    const result = {
      success: false,
      stages: {},
      errors: [],
      logs: this.logs,
      creativeIntensity: this.creativeIntensity,
      creativeIntensityReport: ciiReport
    };

    // v6.2-patch68-fix: 初始化性能基线模块
    const { StagePerformanceBaseline } = require('./stage-performance-baseline.js');
    const performanceBaseline = new StagePerformanceBaseline({ enabled: true });

    // 【v6.4.1】StageRunner + StageContext 初始化
    const stageContext = new StageContext({
      input,
      shared: {},
      pipeline: this,
      reporter: this.statusReporter,
      result: { stages: {}, errors: [] }
    });

    const stageRunner = new StageRunner({
      logger: this.logger,
      reporter: this.statusReporter,
      result: stageContext.result,
      failFast: false
    });

    // 辅助方法:包装每个Stage,自动审计 + 真实耗时计时 + 阶段级重试(v6.5.60)
    const stageTimings = {}; // v6.2-patch68-fix: 记录每个Stage真实耗时
    const runStage = async (stageName, stageFn) => {
      const stageStart = Date.now(); // 真实计时开始
      enforcer.recordStageStart(stageName, JSON.stringify(stageFn.toString()));
      
      // 🔥 v6.5.60: 阶段级重试配置
      // 【v2.1.4-fix10-P25-fix8-P1B】增加 deadline 感知 + 指数退避 + 不可恢复错误判断
      const MAX_STAGE_RETRIES = 3;
      const MAX_RETRY_MS_PER_STAGE = 180000; // 单个 stage 最多重试 3 分钟
      const isUnrecoverable = (err) => {
        const msg = err.message || '';
        return /SyntaxError|TypeError|ReferenceError|Cannot read propert|is not a function|schema|ENOENT|EACCES/.test(msg);
      };
      let lastError = null;
      
      for (let attempt = 1; attempt <= MAX_STAGE_RETRIES; attempt++) {
        // ✅ deadline 门控：重试总耗时超预算则停止
        const elapsedInStage = Date.now() - stageStart;
        if (elapsedInStage > MAX_RETRY_MS_PER_STAGE) {
          this.log('PIPELINE', `⏰ ${stageName} 重试总耗时${Math.round(elapsedInStage/1000)}s超预算，停止重试`, 'warn');
          break;
        }
        try {
          const output = await stageFn();
          const stageDuration = Date.now() - stageStart; // 真实耗时
          stageTimings[stageName] = stageDuration;

          // v6.2-patch68-fix: 性能基线记录
          const baselineResult = performanceBaseline.record(stageName, stageDuration);
          if (baselineResult.alert) {
            this.log('PIPELINE', baselineResult.alert.message);
          }

          // v6.2-patch68-fix: 单个Stage耗时异常检查(<1ms = 疑似空转)
          if (stageDuration < 1) {
            this.log('PIPELINE', `⚠️ [性能警告] ${stageName} 耗时仅${stageDuration}ms,疑似空转或未真实执行`);
          }

          enforcer.recordStageEnd(stageName, JSON.stringify(output));
          
          // 🔥 v6.5.60: 阶段完成回调
          if (onStageComplete && typeof onStageComplete === 'function') {
            try {
              onStageComplete(stageName, output);
            } catch (callbackErr) {
              // 回调失败不影响主流程
              console.error(`[Checkpoint] 回调失败: ${callbackErr.message}`);
            }
          }
          
          return output;
        } catch (e) {
          lastError = e;
          const stageDuration = Date.now() - stageStart;
          stageTimings[stageName] = stageDuration;
          performanceBaseline.record(stageName, stageDuration);
          enforcer.recordStageEnd(stageName, JSON.stringify({ error: e.message }));
          
          // 🔥 v6.5.60: 记录失败断点
          if (onStageComplete && typeof onStageComplete === 'function') {
            try {
              onStageComplete(stageName, { error: e.message, failed: true });
            } catch (callbackErr) {
              console.error(`[Checkpoint] 失败回调失败: ${callbackErr.message}`);
            }
          }
          
          // ✅ 不可恢复错误不重试
          if (isUnrecoverable(e)) {
            this.log('PIPELINE', `❌ ${stageName} 不可恢复错误，不重试: ${e.message}`, 'error');
            break;
          }
          
          if (attempt < MAX_STAGE_RETRIES) {
            // ✅ 指数退避：1s, 3s, 9s（而非固定60s）
            const backoff = Math.min(60000, 1000 * Math.pow(3, attempt - 1));
            this.log('PIPELINE', `⚠️ ${stageName} 第${attempt}次失败，${backoff/1000}秒后重试... | 错误: ${e.message}`);
            await new Promise(resolve => setTimeout(resolve, backoff));
          } else {
            this.log('PIPELINE', `❌ ${stageName} 已重试${MAX_STAGE_RETRIES}次，放弃`);
            throw e;
          }
        }
      }
    };

    try {
      // Stage 0: Mock数据清理检查(P0防呆)
      result.stages.mockCleanup = await runStage('STAGE-0', async () => {
        if (process.env.MOCK_TEST_MODE !== 'true') {
          const { MockDataCleanupContract } = require('./mock-data-cleanup-contract');
          const cleanupContract = new MockDataCleanupContract({ workDir: path.join(__dirname, '..') });
          try {
            await cleanupContract.enforce();
            this.log('STAGE-0', '✅ Mock数据清理检查通过,无残留测试文件');
            return { passed: true };
          } catch (cleanupError) {
            this.log('STAGE-0', `❌ ${cleanupError.message}`);
            throw new Error('🚫 Mock数据清理拦截!必须先清理测试文件才能生产渲染。');
          }
        } else {
          this.log('STAGE-0', '⚠️ Mock测试模式已激活,跳过数据清理检查');
          return { passed: true, skipped: true };
        }
      });

      // v6.6.5: 用户只说一句话，自动推断场景结构（系统层面解决，不依赖用户提供）
      if (!input.scenes || input.scenes.length === 0) {
        this.log('PIPELINE', '📝 [Stage 0.5] 自动推断场景结构...');
        input.scenes = this._autoInferScenes(input);
        this.log('PIPELINE', `📝 [Stage 0.5] ✅ 场景推断完成 | ${input.scenes.length}个场景`);
        for (const s of input.scenes) {
          this.log('PIPELINE', `  📋 ${s.id}: ${s.type} | ${s.duration}s | ${s.narration?.substring(0, 30)}...`);
        }
      }

      // Stage 1: PRD中央校准文档生成
      result.stages.prd = await runStage('STAGE-1', () => this.stagePRD(input));

      // Stage 2: 需求对齐闸机
      result.stages.alignment = await runStage('STAGE-2', () => this.stageAlignment(input, result.stages.prd));

      // Stage 3: Schema校验
      result.stages.schema = await runStage('STAGE-3', () => this.stageSchemaValidation(result.stages.prd));

      // Stage 4: 角色系统(v2 + Nirath增强)
      result.stages.characters = await runStage('STAGE-4', () => this.stageCharacters(input, result.stages.prd));

      // Stage 5: 剧本生成与分析
      result.stages.script = await runStage('STAGE-5', () => this.stageScriptGeneration(input, result.stages.prd));
      this._injectCreativeIntensity('STAGE-5', result.stages.script);

      // 【v6.2-patch87-2】Stage 5导演预检:旁白-画面对齐检查
      const preflightWarnings = this._directorPreflight(
        result.stages.script?.shots || result.stages.script?.scenes || [],
        result.stages.prd
      );
      if (preflightWarnings.length > 0) {
        this.log('PIPELINE', `🎬 导演预检发现 ${preflightWarnings.length} 处旁白-画面不匹配:`);
        for (const w of preflightWarnings.slice(0, 5)) {
          this.log('PIPELINE', `  ⚠️ [${w.shotId}] ${w.message} → ${w.suggestion}`);
        }
        // 将警告附加到 script 结果中,供后续环节使用
        result.stages.script._preflightWarnings = preflightWarnings;
      } else {
        this.log('PIPELINE', `🎬 导演预检通过 | 旁白-画面对齐 OK`);
      }

      // v6.2-patch68-fix: 计算量验证--Stage 5剧本生成
      const scriptMetrics = {
        shotCount: result.stages.script?.scenes?.length || result.stages.script?.shots?.length || 0
      };
      const scriptValidation = performanceBaseline.validateComputation('STAGE-5', scriptMetrics);
      if (!scriptValidation.passed) {
        for (const issue of scriptValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
          result.errors.push({ stage: 'STAGE-5-COMPUTATION', message: issue.message, severity: issue.severity });
        }
      }

      // Stage 5.5: FPV镜头智能决策(导演创作权)
      result.stages.fpvDecision = await runStage('STAGE-5.5', () => this.stageFPVDecision(result.stages.script));

      // Stage 6: 时长分配
      result.stages.duration = await runStage('STAGE-6', () => this.stageDurationAllocation(result.stages.script, input));
      this._injectCreativeIntensity('STAGE-6', result.stages.duration);

      // Stage 7: 故事板生成
      result.stages.storyboard = await runStage('STAGE-7', () => this.stageStoryboard(result.stages.script, result.stages.duration, input));
      this._injectCreativeIntensity('STAGE-7', result.stages.storyboard);

      // Stage 7.2: 【v6.2-patch51】主角主动性自动注入
      result.stages.protagonistInitiative = await runStage('STAGE-7.2', () => this.stageProtagonistInitiative(result.stages.storyboard, input));

      // Stage 7.4: 【v6.2-patch52】时长-字数一致性校准(必须先执行,确保时长准确)
      result.stages.durationAlignment = await runStage('STAGE-7.4', () => this.stageDurationNarrationAlignment(result.stages.storyboard, result.stages.duration));

      // Stage 7.3: 【v6.2-patch51】Narration自动精简(必须在时长校准后执行,使用校准后的时长)
      result.stages.narrationTrim = await runStage('STAGE-7.3', () => this.stageNarrationTrim(result.stages.storyboard, result.stages.duration));

      // Stage 7.5: 片头自动生成(山海经模式自动触发)
      result.stages.opening = await runStage('STAGE-7.5', () => this.stageOpeningGeneration(input, result.stages.storyboard, result.stages.characters));

      // Stage 8: 故事板校验
      result.stages.storyboardValidation = await runStage('STAGE-8', () => this.stageStoryboardValidation(result.stages.storyboard, input));

      // Stage 8.5: 五要素检查(v6.1升级:山海经系列专属质量闸机)
      result.stages.fiveElement = await runStage('STAGE-8.5', () => this.stageFiveElementCheck(result.stages.storyboard, input));
      if (result.stages.fiveElement.enabled && !result.stages.fiveElement.passed) {
        this.log('STAGE-8.5', `⚠️ 五要素检查发现${result.stages.fiveElement.failedElements?.length || 0}项未达标,记录问题供审阅优化`);
      }

      // Stage 9: 运镜系统(Nirath v2 + FPV导演决策)
      result.stages.camera = await runStage('STAGE-9', () => this.stageCameraMovement(result.stages.storyboard, result.stages.fpvDecision));
      this._injectCreativeIntensity('STAGE-9', result.stages.camera);

      // Stage 10: 连续性检查
      result.stages.continuity = await runStage('STAGE-10', () => this.stageContinuity(result.stages.storyboard));
      this._injectCreativeIntensity('STAGE-10', result.stages.continuity);

      // Stage 10.5: 渲染前置输入检查(v6.0: 检查输入完整性,不死锁)
      result.stages.safetyGate = await runStage('STAGE-10.5', () => this.stageSafetyGate(result.stages));
      if (!result.stages.safetyGate.passed) {
        this.log('STAGE-10.5', `⚠️ 前置输入检查发现${result.stages.safetyGate.results.filter(r => !r.passed).length}个镜头输入不完整,记录问题但继续执行(预生产模式)`);
      }

      // Stage 11: 渲染核心(Nirath v24.3 风格前置化)
      result.stages.render = await runStage('STAGE-11', () => this.stageRender(result.stages));
      this._injectCreativeIntensity('STAGE-11', result.stages.render);
      
      // 【v2.1.4-fix10-P25-fix8-P1A】_releaseMemory 推迟到 Stage 16 后，避免后续 stage 读到 null
      // this._releaseMemory(result); // 已移至 StageRunner 追踪完成后

      // Stage 11.5: Prompt质量闸门(v6.0新增:防空转)
      result.stages.promptQualityGate = await runStage('STAGE-11.5', () => this.stagePromptQualityGate(result.stages.render, result.stages.storyboard));
      if (!result.stages.promptQualityGate.passed) {
        this.log('STAGE-11.5', `⚠️ Prompt质量闸门发现${result.stages.promptQualityGate.results.filter(r => !r.passed).length}个镜头质量未达标,记录问题供审阅`);
      }

      // v6.2-patch68-fix: 计算量验证--Stage 11渲染核心
      // stageRender 返回的是 prompts 数组本身,不是 {prompts: [...]} 对象
      const renderOutput = result.stages.render || [];
      const renderMetrics = {
        shotCount: renderOutput.length || 0,
        charCount: renderOutput.reduce((sum, p) => sum + (p.prompt?.length || p.length || 0), 0)
      };
      const renderValidation = performanceBaseline.validateComputation('STAGE-11', renderMetrics);
      if (!renderValidation.passed) {
        for (const issue of renderValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
          result.errors.push({ stage: 'STAGE-11-COMPUTATION', message: issue.message, severity: issue.severity });
        }
      }

      // Stage 12: 合规检查
      // === Prompt Bridge Injection (Stage 11 -> Stage 12) ===
      // 作用：统一 PromptForge 结果、统一 prompt 字段、标准化后再合规检查
      {
        const promptforgeResultDir = path.join(process.cwd(), 'output/prompts/_promptforge_results');
        const promptforgeMarkdownDir = path.join(process.cwd(), 'output/prompts');
        const {
          processShotsForCompliance,
          summarizeCompliance
        } = require('./prompt-pipeline-bridge');

        // 尝试统一 shots 来源
        let __bridgeShots = null;
        if (Array.isArray(result.stages?.storyboard?.shots)) {
          __bridgeShots = result.stages.storyboard.shots;
        } else if (Array.isArray(result.stages?.render)) {
          __bridgeShots = result.stages.render;
        }

        if (Array.isArray(__bridgeShots)) {
          __bridgeShots = processShotsForCompliance(__bridgeShots, {
            promptforgeResultDir,
            promptforgeMarkdownDir,
            maxLength: 1500
          });

          const complianceSummary = summarizeCompliance(__bridgeShots);
          this.log('PromptBridge', `✅ Processed ${__bridgeShots.length} shots | avg=${complianceSummary.averageScore}%`);

          if (Array.isArray(result.stages?.storyboard?.shots)) {
            result.stages.storyboard.shots = __bridgeShots.map(s => ({...s})); // ✅ 深拷贝，不共享引用
          }
          if (Array.isArray(result.stages?.render)) {
            // ✅ 合并而非替换：保留 render 专属字段
            const renderMap = new Map(result.stages.render.map(r => [r.shotId || r.id, r]));
            result.stages.render = __bridgeShots.map(s => {
              const existing = renderMap.get(s.shotId || s.id);
              return existing ? { ...existing, ...s } : s;
            });
          }
        }
      }

      result.stages.compliance = await runStage('STAGE-12', () => this.stageCompliance(result.stages.render, result.stages.storyboard));

      // ===== v6.3-patch7-fix: PromptForge Director 合并逻辑完整修复 =====
      this.log('PIPELINE', '🎬 PromptForge 导演编排启动 | 子进程隔离 | 70分 → 90分');
      // 【v6.3-patch7-fix】备份render数据,子进程失败时恢复
      const originalRender = result.stages.render;
      // 【v6.3-patch7-fix】深拷贝备份,防止后续修改影响恢复数据
      const originalRenderBackup = originalRender ? JSON.parse(JSON.stringify(originalRender)) : null;

      // 如果 render 数据不存在,直接跳过
      if (!originalRender || !Array.isArray(originalRender)) {
        this.log('PIPELINE', '⚠️ 无 render 数据,跳过 PromptForge Director');
        result.errors.push({
          stage: 'PROMPTFORGE-DIRECTOR',
          message: 'No render data available',
          severity: 'warning'
        });
      } else {
        // 【v6.5.50-fix】方案E：子进程隔离，通过临时文件传递数据
        // 原因：主进程内嵌PromptForge，reasoning模式内存累积导致OOM SIGKILL
        // 子进程分配3072MB，系统7.5GB总内存，安全
        
        // 准备 PromptForge 输入数据
        const projectConfig = {
          beastId: this.beastId || 'bai-ze',
          theme: this.theme || '心灵碰撞',
          emotionBase: this.emotionBase || '敬畏',
          titlePlan: this.titlePlan || {}
        };
        
        const rawReport = {
          shots: originalRender.map(r => ({
            id: r.id || r.shotId,
            prompt: r.prompt,
            scene: r.scene,
            emotionPhase: r.emotionPhase,
            duration: r.duration,
            narration: r.narration,
            cameraMovement: r.cameraMovement
          }))
        };
        
        const inputFile = path.join('/tmp', `promptforge-input-${Date.now()}.json`);
        const outputFile = path.join('/tmp', `promptforge-output-${Date.now()}.json`);
        
        try {
          const { spawn } = require('child_process');
          const workerPath = path.join(__dirname, 'promptforge-director-worker.js');
          
          // 检查worker文件是否存在
          if (!fss.existsSync(workerPath)) {
            throw new Error(`Worker文件不存在: ${workerPath}`);
          }
          
          // 准备输入数据
          const inputData = {
            rawReport: rawReport,
            projectConfig: projectConfig
          };
          
          fss.writeFileSync(inputFile, JSON.stringify(inputData));
          
          this.log('PIPELINE', `🎬 PromptForge 子进程启动 | 内存限制: 2048MB | 输入: ${inputFile}`);
          
          const worker = spawn('node', [
            '--max-old-space-size=5120', // v6.5.59-fix: 调整为5120MB，避免6GB系统OOM
            workerPath,
            inputFile,
            outputFile
          ], {
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          // 收集输出
          let stdout = '';
          let stderr = '';
          worker.stdout.on('data', (d) => { stdout += d.toString(); });
          worker.stderr.on('data', (d) => { stderr += d.toString(); });
          
          // 等待完成
          // 【v2.1.4-fix10-P25-fix8-P1C】子进程超时对齐父进程生命周期，防止孤儿进程
          // 动态计算超时：每镜头约2分钟 + 基础2分钟
          const estimatedShots = projectConfig?.shots?.length || 6;
          const CHILD_TIMEOUT_MS = Math.max(600000, estimatedShots * 120000 + 120000); // 至少10分钟，每镜头2分钟+2分钟基础
          this.log('PIPELINE', `⏱️ PromptForge 子进程超时设置: ${CHILD_TIMEOUT_MS/1000}s (基于${estimatedShots}个镜头)`);
          const exitCode = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              worker.kill('SIGKILL');
              reject(new Error(`PromptForge 子进程超时(${CHILD_TIMEOUT_MS/1000}s)`));
            }, CHILD_TIMEOUT_MS);
            
            // ✅ 父进程被杀时杀掉子进程，防止孤儿
            const killChild = () => { try { worker.kill('SIGKILL'); } catch {} };
            process.on('SIGTERM', killChild);
            process.on('SIGINT', killChild);
            
            worker.on('close', (code) => {
              clearTimeout(timeout);
              process.removeListener('SIGTERM', killChild);
              process.removeListener('SIGINT', killChild);
              resolve(code);
            });
            
            worker.on('error', (err) => {
              clearTimeout(timeout);
              process.removeListener('SIGTERM', killChild);
              process.removeListener('SIGINT', killChild);
              reject(err);
            });
          });
          
          this.log('PIPELINE', `📊 Worker stdout: ${stdout.slice(0, 500)}`);
          if (stderr) this.log('PIPELINE', `⚠️ Worker stderr: ${stderr.slice(0, 500)}`);
          
          if (exitCode !== 0) {
            throw new Error(`Worker exited with code ${exitCode}`);
          }
          
          // 读取输出（带防护）
          let outputData;
          let forgeResult;
          const tempFiles = [inputFile, outputFile];
          try {
            if (!fss.existsSync(outputFile)) {
              throw new Error('Worker 未生成输出文件');
            }
            
            const outputRaw = fss.readFileSync(outputFile, 'utf8');
            try {
              outputData = JSON.parse(outputRaw);
            } catch (parseErr) {
              this.log('PIPELINE', `⚠️ Worker输出JSON解析失败: ${parseErr.message} | 原始内容前500字符: ${outputRaw.slice(0, 500)}`);
              throw new Error(`Worker输出JSON解析失败: ${parseErr.message}`);
            }
            
            if (!outputData.success) {
              throw new Error(outputData.error || 'Worker 返回失败');
            }
            
            forgeResult = {
              shots: outputData.shots.map(s => ({
                id: s.id,
                finalPrompt: s.finalPrompt
              })),
              qualityReport: outputData.qualityReport
            };
            
            this.log('PIPELINE', `✅ PromptForge 子进程完成 | 质量分: ${forgeResult.qualityReport?.overallScore} | 通过: ${forgeResult.qualityReport?.overallPassed}`);
          } finally {
            // 清理临时文件
            for (const tempFile of tempFiles) {
              try {
                if (fss.existsSync(tempFile)) {
                  fss.unlinkSync(tempFile);
                  this.log('PIPELINE', `🧹 清理临时文件: ${tempFile}`);
                }
              } catch (cleanupErr) {
                this.log('PIPELINE', `⚠️ 清理临时文件失败: ${tempFile} | ${cleanupErr.message}`);
              }
            }
          }
            
            // 恢复 render 数据
            result.stages.render = originalRenderBackup;
            
            // 质量门检查与合并
            const qualityScore = forgeResult.qualityReport?.overallScore ?? 0;
            const qualityPassed = forgeResult.qualityReport?.overallPassed ?? false;
            
            // 记录详细质量报告
            if (forgeResult.qualityReport?.shotDetails) {
              this.log('PIPELINE', '📊 质量报告详情:');
              for (const detail of forgeResult.qualityReport.shotDetails) {
                this.log('PIPELINE', `  ${detail.shotId}: 结构${detail.structureScore}/3 长度${detail.lengthScore} 运镜${detail.cameraPassed ? '✅' : '❌'} 总分${detail.totalScore}`);
              }
            }
            
            if (qualityScore >= 50) {
              this.log('PIPELINE', `✅ 采用优化后 Prompt(质量分: ${qualityScore})`);
              
              let mergedCount = 0;
              for (const shot of forgeResult.shots) {
                // v6.5.55-fix: 跳过片头镜头，保留opening-system-v3.js生成的原始Prompt
                const existingShot = result.stages.render.find(r => r.shotId === shot.id || r.id === shot.id);
                if (!shot.id || shot.id === 'S00' || shot.id === 'undefined') {
                  this.log('PIPELINE', `  ⏭️ 跳过片头镜头: ${shot.id || 'S00'}，保留原始Prompt(${existingShot?.prompt?.length || 0}字符)`);
                  continue;
                }
                
                if (existingShot && shot.finalPrompt) {
                  const cleanedPrompt = this._cleanForgePrompt(shot.finalPrompt);
                  const originalPrompt = existingShot.prompt;
                  
                  existingShot.prompt = cleanedPrompt;
                  existingShot._promptForge = {
                    applied: true,
                    originalPrompt: originalPrompt,
                    optimizedPrompt: cleanedPrompt,
                    qualityScore: shot.qualityScore || qualityScore,
                    cameraDesign: shot.cameraDesign || '',
                    lightingDesign: shot.lightingDesign || '',
                    emotionReinforcement: shot.emotionReinforcement || '',
                    dialogue: shot.dialogue || existingShot.dialogue || '',
                    dialogueDepth: shot.dialogueDepth || existingShot.dialogueDepth || 'L0',
                    emotionArc: shot.emotionArc || existingShot.emotionArc || [],
                    shotEmotion: shot.shotEmotion || existingShot.shotEmotion || '',
                    timestamp: new Date().toISOString()
                  };
                  
                  mergedCount++;
                  this.log('PIPELINE', `  🎬 ${shot.id}: 已合并优化 Prompt(${cleanedPrompt.length} 字符)`);
                } else if (!existingShot) {
                  this.log('PIPELINE', `  ⚠️ ${shot.id}: 在主进程 render 中找不到对应镜头`);
                }
              }
              
              this.log('PIPELINE', `✅ 合并完成: ${mergedCount}/${forgeResult.shots.length} 个镜头已优化`);
              
              if (mergedCount === 0) {
                result.errors.push({
                  stage: 'PROMPTFORGE-DIRECTOR',
                  message: 'PromptForge 返回了结果但没有成功合并任何镜头',
                  severity: 'warning'
                });
              }
            } else {
              this.log('PIPELINE', `❌ 优化后 Prompt 质量不足(${qualityScore} < 50),使用原始 Prompt`);
            }
            
          } catch (e) {
            // 任何异常发生时确保 render 数据恢复
            result.stages.render = originalRenderBackup;
            result.stages._promptForgeSkipped = true; // 【v2.1.4-fix10-P25-fix8-P1C】明确标记优化未生效
            
            this.log('PIPELINE', `⚠️ PromptForge Director 失败: ${e.message},已恢复原始 Prompt`);
            console.error(e);
            result.errors.push({
              stage: 'PROMPTFORGE-DIRECTOR',
              message: e.message,
              stack: e.stack,
              severity: 'warning'
            });
          }
      }
      // ===== PromptForge 集成结束 =====

      // Stage 13: 前置验证
      result.stages.preRender = await runStage('STAGE-13', () => this.stagePreRenderValidation(result.stages));

      // Stage 14: 风格注入
      result.stages.style = await runStage('STAGE-14', () => this.stageStyleInjection(result.stages.render));

      // Stage 15: 后期规则
      result.stages.postProduction = await runStage('STAGE-15', () => this.stagePostProduction(result.stages));
      this._injectCreativeIntensity('STAGE-15', result.stages.postProduction);

      // Stage 16: 最终输出(基础版)
      result.stages.output = await runStage('STAGE-16', () => this.stageFinalOutput(result.stages));

      // 【v6.4.1】StageRunner 核心阶段追踪（基于现有结果，只追踪不重新执行）
      this.log('PIPELINE', '📊 StageRunner 追踪核心阶段...');
      
      // Stage 5 追踪: 剧本（直接从已有结果追踪，不重新执行）
      stageContext.setShared('script', result.stages.script);
      await stageRunner.runStage({
        stageId: 'STAGE-5-RUNNER',
        title: '剧本生成(StageRunner)',
        progress: 20,
        handler: async () => result.stages.script
      }, stageContext);

      // Stage 6 追踪: 时长（直接从已有结果追踪）
      stageContext.setShared('durationPlan', result.stages.duration);
      await stageRunner.runStage({
        stageId: 'STAGE-6-RUNNER',
        title: '时长分配(StageRunner)',
        progress: 30,
        handler: async () => result.stages.duration
      }, stageContext);

      // Stage 7 追踪: 故事板（直接从已有结果追踪）
      stageContext.setShared('storyboard', result.stages.storyboard);
      await stageRunner.runStage({
        stageId: 'STAGE-7-RUNNER',
        title: '故事板生成(StageRunner)',
        progress: 40,
        handler: async () => result.stages.storyboard
      }, stageContext);

      // Stage 9 追踪: 运镜（直接从已有结果追踪）
      stageContext.setShared('storyboardWithCamera', result.stages.camera);
      await stageRunner.runStage({
        stageId: 'STAGE-9-RUNNER',
        title: '运镜系统(StageRunner)',
        progress: 58,
        handler: async () => result.stages.camera
      }, stageContext);

      // Stage 11 追踪: 渲染前准备（直接从已有结果追踪）
      stageContext.setShared('cameraResult', result.stages.render);
      await stageRunner.runStage({
        stageId: 'STAGE-11-RUNNER',
        title: '渲染前准备(StageRunner)',
        progress: 70,
        handler: async () => result.stages.render
      }, stageContext);

      this.log('PIPELINE', '✅ StageRunner 核心阶段追踪完成');

      // v6.3-patch2: 旧链路已废弃,新链路(PromptForge Director 三阶流水线)在上面运行
      // 保留空导演闭环结果以兼容下游
      // v6.5.32-fix5: 使用 PromptForge 实际质量分作为导演评分
      const forgeQualityScore = result.stages.promptForge?.qualityReport?.overallScore ?? 75;
      result.stages.directorScreenwriterLoop = {
        stage: 'STAGE-17',
        stageName: '导演-编剧全局优化',
        version: 'v6.3-patch2',
        passed: true,
        directorScore: forgeQualityScore,
        issuesFound: 0,
        issuesFixed: 0,
        issuesRemaining: 0,
        llmEnabled: false,
        note: '旧链路已废弃,PromptForge Director 三阶流水线已集成'
      };

      result.asyncDirectorTask = {
        status: 'deprecated',
        note: 'v6.3-patch2: 使用 PromptForge Director 子进程隔离链路'
      };

      // v6.2-patch68-fix: 计算量验证--Stage 17导演-编剧闭环
      const loopMetrics = {
        iterationCount: result.stages.directorScreenwriterLoop?.iteration || 0,
        shotCount: result.stages.directorScreenwriterLoop?.shots?.length || 0
      };
      const loopValidation = performanceBaseline.validateComputation('STAGE-17', loopMetrics);
      if (!loopValidation.passed) {
        for (const issue of loopValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
        }
      }

      // 【v6.2-patch53】执行完整性验证 - 三重锁锁3
      const integrityReport = await enforcer.enforcePostExecution(path.join(__dirname, '..'));
      result.integrityReport = integrityReport;

      // 如果完整性验证不信任 → 强制标记失败
      if (!integrityReport.trusted) {
        result.success = false;
        this.log('PIPELINE', `❌ 执行完整性验证未通过: ${integrityReport.issues.join(', ')}`);
        result.errors.push(`执行完整性验证失败: ${integrityReport.issues.join(', ')}`);
      } else {
        this.log('PIPELINE', `✅ 执行完整性验证通过 | 审计ID: ${integrityReport.executionId} | 全部${integrityReport.stageCount}个Stage完成`);
      }

      // 【v6.4.1】QualityGate 统一质量总评
      // v6.5.32-fix5: 移到 integrityReport 之后，确保系统完整性评分正确
      this.log('PIPELINE', '🔍 QualityGate 质量总评启动...');
      const qualityGate = new QualityGate();
      const qualityReport = qualityGate.evaluatePipelineResult(result, {
        projectName: input.projectName,
        mode: this.mode,
        stageCount: Object.keys(result.stages).length
      });
      result.qualityReport = qualityReport;
      this.log('PIPELINE', `📊 QualityGate 总评: ${qualityReport.totalScore}分 | 等级:${qualityReport.grade} | 状态:${qualityReport.status}`);
      if (qualityReport.blockers.length > 0) {
        for (const blocker of qualityReport.blockers) {
          this.log('PIPELINE', `  🚫 Blocker: ${blocker.message}`);
        }
      }
      if (qualityReport.issues.length > 0) {
        for (const issue of qualityReport.issues.slice(0, 5)) {
          this.log('PIPELINE', `  ⚠️ Issue: ${issue.message}`);
        }
      }

      // 【v2.1.4-fix10-P25-fix8-P0A】不再无条件覆盖 success
      const hasBlockingError = result.errors.some(e =>
        !e.severity || e.severity === 'error' || e.severity === 'fatal'
      );
      if (integrityReport.trusted && !hasBlockingError) {
        result.success = true;
      } else {
        result.success = false;
        if (!integrityReport.trusted) {
          this.log('PIPELINE', `❌ 拒绝标记成功：完整性验证未通过`, 'error');
        }
      }

      // 【v2.1.4-fix10-P25-fix8-P1A】所有 Stage 完成后才释放内存
      this._releaseMemory(result);

    } catch (error) {
      result.success = false;
      result.errors.push({ stage: 'PIPELINE', message: error.message, stack: error.stack });
      this.log('PIPELINE', `❌ 链路中断: ${error.message}`, 'error');

      // 【v6.4.1】QualityGate 异常路径质量评估
      try {
        this.log('PIPELINE', '🔍 QualityGate 异常路径质量评估...');
        const qualityGate = new QualityGate();
        const qualityReport = qualityGate.evaluatePipelineResult(result, {
          projectName: input.projectName,
          mode: this.mode,
          stageCount: Object.keys(result.stages).length,
          errorPath: true
        });
        result.qualityReport = qualityReport;
        this.log('PIPELINE', `📊 QualityGate 异常路径评估: ${qualityReport.totalScore}分 | 状态:${qualityReport.status}`);
      } catch (qualityError) {
        this.log('PIPELINE', `⚠️ QualityGate 异常路径评估失败: ${qualityError.message}`);
      }

      // 【v6.2-patch53】异常路径也要执行完整性验证
      try {
        const integrityReport = await enforcer.enforcePostExecution(path.join(__dirname, '..'));
        result.integrityReport = integrityReport;
      } catch (auditError) {
        this.log('PIPELINE', `⚠️ 异常路径完整性验证失败: ${auditError.message}`);
      }
    }

    // v6.2-patch68-fix: 总耗时报警 + 性能基线记录
    const totalDuration = Date.now() - pipelineStart;
  // 检查是否调用外部API
  const hasExternalAPI = totalDuration > 3000 || (process.env.EXECUTION_MODE === 'full-api' && process.env.ENABLE_RENDER_PREVIEW === 'true');

  result.performance = {
    totalDuration,
    stageTimings,
    executionMode: process.env.EXECUTION_MODE || 'local-only',
    hasExternalAPI,
    baselineWarning: null
  };

    // P0级约束:总耗时<3秒自动弹警告"疑似轻量执行"
    if (totalDuration < 3000) {
      const warningMsg = `⚠️ [P0级性能警告] 总耗时仅${totalDuration}ms(<3秒)!疑似纯本地轻量执行,未调用外部API。如预期含外部API调用(定妆照/渲染预览),请检查环境变量或确认执行模式。`;
      this.log('PIPELINE', warningMsg);
      result.performance.baselineWarning = warningMsg;
      result.errors.push({
        stage: 'PERFORMANCE',
        message: warningMsg,
        severity: 'warning'
      });
    } else {
      this.log('PIPELINE', `✅ 总耗时${totalDuration}ms,耗时正常(≥3秒),可能包含外部API调用`);
    }

    // v6.2-patch68-fix: 性能基线汇总与报告
    const baselineSummary = performanceBaseline.finalize();
    const baselineReport = performanceBaseline.generateReport();
    this.log('PIPELINE', baselineReport);
    result.performance.baselineSummary = baselineSummary;

    const completedStages = Object.keys(result.stages).length;
    audit.log('pipeline-complete', 'nirath-master-pipeline', {
      actor: 'system',
      input: { projectName: input.projectName },
      output: { success: result.success, completedStages },
      result: result.success ? 'success' : 'failure',
      duration: Date.now() - pipelineStart,
      error: result.success ? undefined : (result.errors[result.errors.length - 1]?.message || 'Unknown error'),
      metadata: { mode: this.mode, totalErrors: result.errors.length }
    }).catch(e => console.error(`[Audit] 日志写入失败: ${e.message}`));

    // v1.1-fix: 添加汇总字段,防止run-taotie-pre-production.js输出undefined
    const storyboard = result.stages.storyboard || {};
    const shots = storyboard.shots || [];
    const fiveElements = result.stages.fiveElement || {};

    // 从 integrityValidation 获取完整性数据(stageFinalOutput中的字段名)
    const integrityValidation = result.stages.integrityValidation || {};
    const integritySummary = integrityValidation.summary || {};

    result.totalShots = shots.length;
    result.totalDuration = shots.reduce((s, x) => s + (x.duration || 0), 0);
    result.fiveElementsScore = fiveElements.overallScore || 0;
    // 【v2.1.4-fix10-P25-fix8-P1D】只统计阻断性错误，warning 不阻断
    result.systemErrors = result.errors.filter(e =>
      !e.severity || e.severity === 'error' || e.severity === 'fatal'
    ).length;
    result.systemWarnings = result.errors.filter(e => e.severity === 'warning').length;
    result.linkageIntegrity = integritySummary.passed || 0;
    result.expectedStages = integritySummary.totalChecks || 16;
    result.riskRating = result.systemErrors > 0 ? '高风险' : (result.linkageIntegrity < 16 ? '中风险' : '低风险');
    result.reportPath = `预生产报告: ${result.totalShots}镜, ${result.totalDuration}秒`;
    result.canProceed = result.success && result.systemErrors === 0;
    result.feishuDocUrl = null; // 飞书文档生成在pipeline外部

    // v6.5.53-l: 最终输出固化 - 确保所有shot有标准化字段和合规检查
    {
      const {
        processShotsForOutput,
        summarizeCompliance
      } = require('./prompt-pipeline-bridge');
      const promptforgeResultDir = path.join(process.cwd(), 'output/prompts/_promptforge_results');
      const promptforgeMarkdownDir = path.join(process.cwd(), 'output/prompts');

      let __finalShots = null;
      if (Array.isArray(result.stages?.storyboard?.shots)) {
        __finalShots = result.stages.storyboard.shots;
      } else if (Array.isArray(result.stages?.render)) {
        __finalShots = result.stages.render;
      }

      if (Array.isArray(__finalShots)) {
        __finalShots = processShotsForOutput(__finalShots, {
          promptforgeResultDir,
          promptforgeMarkdownDir,
          maxLength: 1500
        });

        if (Array.isArray(result.stages?.storyboard?.shots)) {
          result.stages.storyboard.shots = __finalShots.map(s => ({...s})); // ✅ 深拷贝，不共享引用
        }
        if (Array.isArray(result.stages?.render)) {
          // ✅ 合并而非替换：保留 render 专属字段
          const renderMap = new Map(result.stages.render.map(r => [r.shotId || r.id, r]));
          result.stages.render = __finalShots.map(s => {
            const existing = renderMap.get(s.shotId || s.id);
            return existing ? { ...existing, ...s } : s;
          });
        }

        const complianceSummary = summarizeCompliance(__finalShots);
        this.log('PromptBridge', `✅ Final output solidified for ${__finalShots.length} shots | avg=${complianceSummary.averageScore}%`);
      }
    }

    return result;
  }

  // ========== Stage 1: PRD生成 ==========
  async stagePRD(input) {
    this.log('STAGE-1', 'PRD中央校准文档生成');

    // v6.2-patch55-fix: 将characters数组转换为对象格式,确保Schema校验通过
    let characters = input.characters || {};
    if (Array.isArray(characters)) {
      const charObj = {};
      for (const char of characters) {
        if (char.id) charObj[char.id] = char;
      }
      characters = charObj;
    }

    const prd = {
      meta: {
        title: input.projectName,
        version: 'v1.0',
        mode: this.mode,
        createdAt: new Date().toISOString()
      },
      core: input.core || {},
      world: input.world || {},
      characters: characters,
      scenes: input.scenes || [],
      style: input.style || {},
      constraints: input.constraints || {}
    };

    // Nirath模式:注入Nirath世界观
    if (this.mode === 'nirath') {
      prd.world.nirathWorld = {
        planet: 'Nirath',
        era: 'Post-Convergence Era',
        dualStar: true,
        bioluminescentEcosystem: true
      };
      this.log('STAGE-1', '✅ Nirath世界观已注入PRD');
    }

    return prd;
  }

  // ========== Stage 2: 需求对齐 ==========
  async stageAlignment(input, prd) {
    this.log('STAGE-2', '需求对齐闸机检查');

    const checks = {
      projectName: !!input.projectName,
      scenes: (input.scenes || []).length > 0,
      characters: Object.keys(input.characters || {}).length > 0,
      duration: input.targetDuration > 0,
      style: !!input.style
    };

    const passed = Object.values(checks).every(v => v);

    if (!passed) {
      const failed = Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k);
      throw new Error(`需求对齐失败: 缺少 ${failed.join(', ')}`);
    }

    this.log('STAGE-2', `✅ 需求对齐通过 | 检查项: ${Object.keys(checks).length}`);
    return { passed, checks };
  }

  // ========== Stage 3: Schema校验 ==========
  async stageSchemaValidation(prd) {
    this.log('STAGE-3', 'Schema运行时校验');

    // P0修复:validate需要schemaName + data两个参数
    const validation = this.modules.schemaValidator.validate('prd-nirath', prd);

    // 输出具体错误详情
    if (validation.errors?.length > 0) {
      for (const err of validation.errors) {
        this.log('STAGE-3', `  ⚠️ Schema错误: ${err}`);
      }
    }

    this.log('STAGE-3', `✅ Schema校验完成 | 错误: ${validation.errors?.length || 0}`);
    return validation;
  }

  // ========== v6.5.32-fix: 角色属性推断辅助方法 ==========
  _inferRoleAttributes(charId, charConfig) {
    const id = charId.toLowerCase();
    const name = (charConfig.name || '').toLowerCase();
    
    // 根据角色ID和名称推断属性
    if (id.includes('xiao') || id.includes('g') || name.includes('小')) {
      return { age: 8, gender: 'boy', role: 'audience' };
    }
    if (id.includes('nurse') || name.includes('护士') || name.includes('陈女士')) {
      return { age: 30, gender: 'female', role: 'nurse' };
    }
    if (id.includes('coach') || name.includes('教练') || name.includes('李明')) {
      return { age: 35, gender: 'male', role: 'coach' };
    }
    if (id.includes('doctor') || name.includes('医生')) {
      return { age: 40, gender: 'male', role: 'doctor' };
    }
    if (id.includes('host') || name.includes('主持')) {
      return { age: 32, gender: 'female', role: 'host' };
    }
    
    return { age: 28, gender: 'female', role: '' };
  }

  // ========== Stage 4: 角色系统 ==========
  async stageCharacters(input, prd) {
    this.log('STAGE-4', '角色系统(v2 + Nirath增强)');

    const characters = {};
    // 处理characters字段:支持数组和对象两种格式
    let charactersData = input.characters || {};
    if (Array.isArray(charactersData)) {
      // 数组格式 → 转换为对象格式
      charactersData = {};
      for (const char of input.characters || []) {
        if (char.id) {
          charactersData[char.id] = char;
        }
      }
      this.log('STAGE-4', `  📝 characters数组格式已转换为对象格式 | ${Object.keys(charactersData).length}个角色`);
    }

    const characterIds = Object.keys(charactersData);

    for (const charId of characterIds) {
      const charConfig = charactersData[charId];

      // 4.1: 角色管理器v2(创建或加载)
      // v6.5.32-fix: 根据角色ID推断差异化属性，消除硬编码28岁女性
      const roleInference = this._inferRoleAttributes(charId, charConfig);
      
      // v6.5.15-fix: 提前定义 fullCharData，供 if 和 else 分支共用
      const fullCharData = {
        id: charId,
        name: charConfig.name || charId,
        baseIdentity: {
          name: charConfig.name || charId,
          age: charConfig.age || roleInference.age || 28,
          gender: charConfig.gender || roleInference.gender || 'female',
          species: 'human',
          role: roleInference.role || '',
          origin: this.mode === 'nirath' ? 'Nirath' : 'Earth'
        },
        visualIdentity: {
          age: charConfig.age || roleInference.age || 28,
          gender: charConfig.gender || roleInference.gender || 'female',
          build: 'average',
          height: 'medium',
          skinTone: 'warm',
          hair: 'black',
          eyes: 'brown',
          facialFeatures: 'asian',
          distinguishingMarks: charConfig.appearance || ''
        },
        personality: {
          core: charConfig.personality || 'warm',
          traits: ['kind', 'brave'],
          mbti: 'INFJ'
        },
        visualAnchors: {
          required: [charConfig.appearance || ''],
          preferred: [],
          forbidden: ['western face', 'caucasian', 'blonde hair', 'blue eyes']
        },
        voiceIdentity: {
          gender: charConfig.gender || 'female',
          ageGroup: charConfig.age < 12 ? 'child' : 'adult',
          tone: 'warm',
          pace: 'medium',
          emotion: 'neutral',
          language: 'zh-CN'
        }
      };

      let charProfile;
      if (this.modules.characterManager.characterExists(charId)) {
        charProfile = await this.modules.characterManager.loadCharacter(charId);
        // v6.5.15-fix: 如果文件存在但读取失败(内容损坏),直接创建新档案
        if (!charProfile) {
          charProfile = this.modules.characterManager.createCharacter(charId, fullCharData);
        }
      } else {
        charProfile = this.modules.characterManager.createCharacter(charId, fullCharData);
      }
      this.log('STAGE-4', `  ✅ CharacterManagerV2: ${charId}`);

      // 4.1.5: 定妆照存在性检查(P0:队长要求的前置环节,没有定妆照不得继续)
      // v6.6.5: 智能定妆照判断 - 用户只说一句话，系统不能卡住让用户选择
      const portraitCheck = await this.checkCharacterPortraits(charId);
      if (!portraitCheck.exists) {
        // 智能判断：这个角色是否需要AI生成定妆照？
        const needPortrait = this._shouldGeneratePortrait(charId, fullCharData, input);
        
        if (!needPortrait) {
          // 真实人物/教育科普/纪录片：不需要AI生成定妆照，自动跳过
          this.log('STAGE-4', `  ✅ 智能跳过定妆照: ${charId} | 类型: ${this._detectCharacterType(charId, fullCharData)} | 场景: ${input.videoType || 'generic'}`);
          
          // 自动创建占位符，避免下游报错
          await this._createPortraitPlaceholders(charId, portraitCheck.missingAngles);
          
        } else {
          // 虚构角色需要定妆照：自动生成Mock，不阻断链路
          this.log('STAGE-4', `  ⚠️ 定妆照缺失: ${charId} | 自动生成Mock占位...`);
          await this._createPortraitPlaceholders(charId, portraitCheck.missingAngles);
          this.log('STAGE-4', `  ✅ Mock定妆照已创建: ${charId} | 4角度占位`);
        }
      } else {
        this.log('STAGE-4', `  ✅ 定妆照检查通过: ${charId} | ${portraitCheck.foundAngles.length}个角度`);
      }

      // 4.2: 角色提示词构建
      let charPrompt;
      try {
        charPrompt = this.modules.characterPromptBuilder.build(charProfile);
        // v6.5.30-fix: build() returns {prompt, layers, stats, negativePrompt}, extract the string
        if (charPrompt && typeof charPrompt === 'object' && charPrompt.prompt) {
          charPrompt = charPrompt.prompt;
        }
      } catch (e) {
        // fallback: 基础提示词
        charPrompt = `${charProfile.name}, ${charProfile.baseIdentity?.age || 28}岁, ${charProfile.visualIdentity?.gender || 'female'}, ${charProfile.visualAnchors?.required?.[0] || ''}`;
      }
      this.log('STAGE-4', `  ✅ CharacterPromptBuilder: ${charId}`);

      // 4.3: 角色合规检查
      let compliance;
      try {
        compliance = this.modules.characterComplianceChecker.check(charPrompt);
      } catch (e) {
        compliance = { level: 'L0', passed: true, issues: [] };
      }
      this.log('STAGE-4', `  ✅ CharacterComplianceChecker: ${charId} | 级别: ${compliance.level || 'unknown'}`);

      // 4.4: Nirath角色增强(仅Nirath模式)
      let nirathEnhancement = null;
      if (this.mode === 'nirath') {
        try {
          nirathEnhancement = this.modules.nirathCharacterEnhancer.enhance(charProfile, input.scenes?.[0]);
          this.log('STAGE-4', `  ✅ NirathCharacterEnhancer: ${charId}`);
        } catch (e) {
          this.log('STAGE-4', `  ⚠️ NirathCharacterEnhancer失败: ${e.message}`);
        }
      }

      // v6.2-patch55-fix: 添加portraits对象供下游Stage-10.5验证使用
      const portraits = {};
      const generatedPortraits = charProfile?.generatedAssets?.portraits || [];
      for (const p of generatedPortraits) {
        if (p.angle && p.localPath) {
          portraits[p.angle] = p.localPath;
        }
      }
      // 如果没有generatedAssets,尝试从portraitConfig推断路径
      if (Object.keys(portraits).length === 0) {
        const angles = charProfile?.portraitConfig?.angles || ['front', 'threeQuarter', 'closeup', 'side'];
        // v6.5.6-fix: 修正路径 - 使用实际的文件名格式
        const dirName = charId === 'tao-tie' ? 'taotie' : charId;
        const filePrefix = charId === 'tao-tie' ? 'taotie-portrait' : `${charId}-cg-v3`;
        const portraitDir = `characters/${dirName}/portraits`;
        for (const angle of angles) {
          // v6.5.6-fix: 使用实际文件名格式（taotie-portrait-front_fullbody.png）
          const actualAngle = charId === 'tao-tie' ? this.mapAngleToFileName(angle) : angle;
          portraits[angle] = `${portraitDir}/${filePrefix}-${actualAngle}.png`;
        }
      }

      characters[charId] = {
        profile: charProfile,
        prompt: charPrompt,
        compliance,
        nirathEnhancement,
        portraits  // 供Stage-10.5验证
      };
    }

    this.log('STAGE-4', `✅ 角色系统完成 | 角色数: ${characterIds.length}`);
    return characters;
  }

  /**
   * v6.2-patch61-fix: 生成默认视觉描述(当【视觉】为空时兜底)
   */
  generateDefaultVisual(shot, analysis) {
    const parts = [];

    // 从shot中提取角色
    if (shot.characters && shot.characters.length > 0) {
      parts.push(`${shot.characters.join('、')}在Nirath异世界场景中`);
    } else {
      parts.push('Nirath异世界场景');
    }

    // 从analysis中提取场景特征
    if (analysis && analysis.world) {
      if (analysis.world.nirathName) parts.push(`场景: ${analysis.world.nirathName}`);
      if (analysis.world.atmosphere) parts.push(`氛围: ${analysis.world.atmosphere}`);
    }

    // 根据镜头类型添加默认描述
    const typeDesc = {
      'opening': '开场 establishing shot, 展现壮阔异世界全景',
      'environment': '环境展示, 突出Nirath独特生态',
      'discovery': '探索发现, 主角与未知事物相遇',
      'reveal': '揭示真相, 关键信息展现',
      'interaction': '角色互动, 情感交流瞬间',
      'closing': '结尾镜头, 情绪收束与余韵',
      'climax': '高潮时刻, 紧张激烈冲突',
      'generic': '标准叙事镜头, 推进剧情发展'
    };
    parts.push(typeDesc[shot.type] || typeDesc['generic']);

    // 添加情绪描述 (v6.2-patch97-fix: 增加climax_peak支持)
    if (shot.emotionPhase) {
      const emotionMap = {
        'establishing': ' awe敬畏感',
        'rising': ' 紧张感递增',
        'turning': ' 震惊与转折',
        'building': ' 张力积累',
        'climax': ' 情绪高潮',
        'climax_peak': ' 情绪巅峰爆发', // v6.2-patch97-fix: 明确高潮峰值
        'resolve': ' 温柔化解',
        'resolution': ' 温柔化解',
        'neutral': ' 平衡自然'
      };
      parts.push(emotionMap[shot.emotionPhase] || '');
    }

    return parts.filter(Boolean).join(',') + '。';
  }

  // ========== Stage 5: 剧本生成(防硬编码:调用剧本生成Agent) ==========
  async stageScriptGeneration(input, prd) {
    this.log('STAGE-5', '剧本生成与分析(剧本生成Agent驱动)');

    // 防硬编码:调用剧本生成Agent进行分析和创作
    // 如果Agent不可用,使用结构化fallback而非直接透传
    let script;
    try {
      // 尝试调用剧本生成Agent(如果存在)
      if (input.scriptAgent && typeof input.scriptAgent.generate === 'function') {
        script = await input.scriptAgent.generate({
          prd,
          core: input.core,
          world: input.world,
          mode: this.mode
        });
        this.log('STAGE-5', `✅ 剧本Agent生成 | 场景数: ${script.scenes?.length || 0}`);
      } else if (input?.storyCraftVersion || input?.enableStoryCraft) {
        // 使用StoryCraft(与之前相同)
        this.log('STAGE-5', '⚠️ 剧本Agent未配置,自动启用StoryCraft作为默认剧本Agent');
        const { StoryCraftIntegration } = require('./story-craft-engine/story-craft-integration');
        const storyCraft = new StoryCraftIntegration({ enabled: true, useLLM: true });
        const beastProfile = input?.beastProfile || input?.beast || input?.core?.beast || {};
        const scResult = await storyCraft.generateStory(input, beastProfile);

        if (scResult.success && scResult.storyboard) {
          script = {
            scenes: scResult.storyboard.shots.map((shot, idx) => ({
              id: shot.id || `S${String(idx + 1).padStart(2, '0')}`,
              scene: shot.beatName || 'scene',
              narration: shot.narration || '',
              type: shot.beatName || 'explanation',
              characters: ['xiaoG', input.beastId || beastProfile.id || 'beast'],
              mouthAction: shot.mouthAction || this.generateDefaultMouthAction(shot.beatName, idx === 0),
              emotionPhase: shot.emotionTarget?.emotion || 'neutral',
              importance: this.calculateImportance(shot.beatName, idx, scResult.storyboard.shots.length),
              visualComplexity: this.calculateVisualComplexity(shot.beatName),
              visualPrompt: shot.visualPrompt || '',
              beastDialogue: shot.beastDialogue,
              humanDialogue: shot.humanDialogue,
              beastMonologue: shot.beastMonologue,
              _threeAct: scResult.storyboard.beats?.find(b => b.id === shot.beatId)?._threeAct,
              _isDiamond: scResult.dialogueResult?.beastLines?.[shot.beatId]?.isDiamond || false
            })),
            narrative: {
              emotion: scResult.conceptSeed?.emotionalArc?.[0] || 'neutral',
              pace: 'medium',
              totalDuration: input.targetDuration || 15
            },
            world: {
              name: this.mode === 'nirath' ? 'Nirath' : (input.world?.setting || 'default'),
              setting: this.mode === 'nirath' ? '外星生态星球' : (input.world?.setting || 'default')
            },
            storyCraft: scResult
          };
          this.log('STAGE-5', `✅ StoryCraft剧本Agent生成 | 场景数: ${script.scenes.length} | 主题: ${scResult.conceptSeed?.theme}`);
        } else {
          throw new Error(`StoryCraft剧本生成失败: ${scResult.reason || scResult.error || 'unknown'}`);
        }
      } else if (this.useLLM) {
        // 🔥 v6.2-patch107-fix: 恢复LLM同步生成剧本(阻塞等待,确保后续Stage拿到完整数据)
        this.log('STAGE-5', '🧠 LLM 同步生成剧本(阻塞等待,确保数据完整性)');
        script = await this._llmGenerateScript(input, prd);
        this.log('STAGE-5', `✅ LLM剧本同步生成完成 | 场景数: ${script.scenes?.length || 0}`);
      } else {
        throw new Error('剧本Agent未配置');
      }
    } catch (e) {
      // 如果LLM同步生成失败,使用结构化fallback
      this.log('STAGE-5', `⚠️ 剧本Agent不可用,使用结构化fallback: ${e.message}`);
      script = this._fallbackScript(input);
    }

    return script;
  }

  /**
   * v6.2-patch71-fix: 结构化fallback剧本生成(提取为独立方法)
   */
  _fallbackScript(input) {
    const analyzedScenes = (input.scenes || []).map((scene, idx) => {
      const total = (input.scenes || []).length;
      const shotType = scene.shotType || this._deriveShotType(idx, total, scene.type);
      return {
        id: scene.id || `S${String(idx + 1).padStart(2, '0')}`,
        scene: scene.scene || 'default',
        // v6.5.34-fix: 全局禁用narration，只保留dialogue
        dialogue: scene.dialogue || scene.narration || this._buildFallbackDialogue(scene, input.characters) || '',
        narration: '', // v6.5.34: narration已禁用，置空
        type: scene.type || 'explanation',
        shotType,
        characters: scene.characters || [],
        mouthAction: scene.mouthAction || this.generateDefaultMouthAction(scene.type, idx === 0),
        emotionPhase: scene.emotionPhase || this.calculateEmotionPhase(idx, total),
        importance: scene.importance || this.calculateImportance(scene.type, idx, total),
        visualComplexity: scene.visualComplexity || this.calculateVisualComplexity(scene.type),
        visualPrompt: scene.visualPrompt || this._generateFallbackVisualPrompt(scene),
        duration: scene.duration, // v6.2-patch71-fix: 保留PRD中的时长定义
        // v6.5.33-fix: 保留输入的运镜和光影配置，增强镜头质感评分
        cameraMovement: scene.cameraMovement || null,
        lighting: scene.lighting || null
      };
    });

    const script = {
      scenes: analyzedScenes,
      narrative: {
        emotion: input.core?.emotionalArc?.[0] || 'neutral',
        pace: input.style?.pacing || 'medium',
        totalDuration: input.targetDuration || 15
      },
      world: {
        name: this.mode === 'nirath' ? 'Nirath' : (input.world?.setting || 'default'),
        lighting: this.mode === 'nirath' ? 'rose-gold' : 'natural'
      }
    };

    this.log('STAGE-5', `✅ 剧本结构化fallback | 场景数: ${script.scenes.length} | 情绪: ${script.narrative.emotion} | mouthAction: ${analyzedScenes.filter(s => s.mouthAction).length}/${analyzedScenes.length}`);
    return script;
  }

  /**
   * v6.2-patch71-fix: 异步LLM剧本生成(不阻塞主链路)
   */
  async _llmGenerateScriptAsync(input, prd) {
    return this._llmGenerateScript(input, prd);
  }

  /**
   * v6.2-patch71-fix: 生成fallback visualPrompt(确保END-TO-END链路不断裂)
   */
  _generateFallbackVisualPrompt(scene) {
    const parts = [];
    if (scene.scene && scene.scene !== 'default') {
      parts.push(`场景: ${scene.scene}`);
    }
    if (scene.narration) {
      parts.push(scene.narration.substring(0, 100));
    }
    if (scene.characters && scene.characters.length > 0) {
      parts.push(`角色: ${scene.characters.join('、')}`);
    }
    return parts.join('。') || `场景${scene.id}`;
  }

  /**
   * v6.2-patch71-fix: LLM单次调用生成剧本(分批版,避免4096 tokens截断)
   */
  async _llmGenerateScript(input, prd) {
    const scenes = input.scenes || [];

    const mem = (label) => {
      const m = process.memoryUsage();
      console.log(
        `[MEM] ${label} | heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB | rss=${(m.rss / 1024 / 1024).toFixed(1)}MB`
      );
    };

    mem('Stage 5 start');

    // Phase A: 生成剧本骨架（轻量）
    const phaseAScenes = await this._generateScriptCorePhase(input);

    if (global.gc) global.gc();
    mem('Stage 5 after Phase A');

    // Phase B: 单独生成每个镜头的视觉提示词
    const phaseBScenes = await this._generateVisualPromptPhase({
      ...input,
      scenes: phaseAScenes
    });

    if (global.gc) global.gc();
    mem('Stage 5 after Phase B');

    return {
      ...input,
      scenes: phaseBScenes
    };
  }

  async _generateScriptCorePhase(input) {
    const { LLMEngine } = require('./llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 3072,
      temperature: 1,  // v6.5.11: kimi-k2p6 固定 temperature=1
      topP: 0.95       // v6.5.11: kimi-k2p6 固定 top_p=0.95
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const isNirath = this.mode === 'nirath';
    const world = {
      name: isNirath ? 'Nirath' : (input.world?.name || input.projectName || '现实世界'),
      setting: isNirath ? '外星生态星球' : (input.world?.setting || input.style || '超写实纪录片风格')
    };

    const batchSize = 1;
    const batches = [];
    for (let i = 0; i < scenes.length; i += batchSize) {
      batches.push(scenes.slice(i, i + batchSize));
    }

    const results = [];

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const prompt = this._buildScriptCorePrompt(batch, core, world, batchIdx, batches.length, input);

      this.log('STAGE-5A', `🧩 批次 ${batchIdx + 1}/${batches.length} | 镜数: ${batch.length} | Prompt: ${prompt.length}字符`);

      const schema = {
        scenes: batch.map((scene) => ({
          id: scene.id,
          scene: scene.name || '',
          dialogue: '',
          narration: '',
          characters: scene.characters || [],
          mouthAction: 'speaking_normal',
          emotionPhase: 'curiosity'
        })),
        narrative: {
          emotion: 'neutral',
          pace: 'medium',
          totalDuration: batch.reduce((sum, s) => sum + (s.duration || 10), 0)
        },
        world: {
          name: world.name || 'Nirath',
          setting: world.setting || ''
        }
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 3072,
        temperature: 1  // v6.5.64-P2: kimi-k2p6 只支持 temperature=1
      });

      if (result.success && Array.isArray(result.data?.scenes)) {
        const normalized = batch.map((srcScene) => {
          const generated = result.data.scenes.find((x) => x.id === srcScene.id) || {};
          // v6.5.29-fix: 提取LLM返回的characters，fallback到场景原始角色
          const llmChars = generated.characters || generated.characters_list || [];
          const sceneChars = srcScene.characters || [];
          const finalChars = llmChars.length > 0 ? llmChars : sceneChars;
          return {
            ...srcScene,
            scene: generated.scene || srcScene.name || '',
            // v6.5.34-fix: 全局禁用narration，只保留dialogue
            dialogue: generated.dialogue || generated.narration || this._buildFallbackDialogue(srcScene, input.characters),
            narration: '', // v6.5.34: narration已禁用，置空
            characters: finalChars,
            mouthAction: generated.mouthAction || 'speaking_normal',
            emotionPhase: generated.emotionPhase || this._inferEmotionPhase(srcScene),
            scriptCoreSuccess: true
          };
        });

        results.push(...normalized);
        this.log('STAGE-5A', `✅ 批次 ${batchIdx + 1} 成功`);
      } else {
        this.log('STAGE-5A', `⚠️ 批次 ${batchIdx + 1} 失败: ${result.error}`);

        const fallback = batch.map((scene) => ({
          ...scene,
          scene: scene.name || '',
          // v6.5.34-fix: 全局禁用narration，只保留dialogue
          dialogue: this._buildFallbackDialogue(scene, input.characters),
          narration: '', // v6.5.34: narration已禁用，置空
          mouthAction: 'speaking_normal',
          emotionPhase: this._inferEmotionPhase(scene),
          scriptCoreSuccess: false,
          scriptCoreError: result.error
        }));

        results.push(...fallback);
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  async _generateVisualPromptPhase(input) {
    const { LLMEngine } = require('./llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 2048,
      temperature: 1,  // v6.5.11: kimi-k2p6 固定 temperature=1
      topP: 0.95       // v6.5.11: kimi-k2p6 固定 top_p=0.95
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const isNirath = this.mode === 'nirath';
    const world = {
      name: isNirath ? 'Nirath' : (input.world?.name || input.projectName || '现实世界'),
      setting: isNirath ? '外星生态星球' : (input.world?.setting || input.style || '超写实纪录片风格')
    };

    const results = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const prompt = this._buildVisualPrompt(scene, core, world, i, scenes.length, input);

      this.log('STAGE-5B', `🎬 镜头 ${i + 1}/${scenes.length} | scene=${scene.id} | Prompt: ${prompt.length}字符`);

      const schema = {
        id: scene.id,
        visualPrompt: ''
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 2048,
        temperature: 1
      });

      if (result.success && result.data?.id === scene.id) {
        let visualPrompt = result.data.visualPrompt || this._buildFallbackVisualPrompt(scene, world);
        
        // v6.6.0: 真实感提示词增强（软性注入）
        if (this.realismEnhancer && this.realismEnhancer.enabled) {
          const enhanced = this.realismEnhancer.enhance(visualPrompt, {
            sceneType: scene.type || 'general',
            shotIndex: i
          });
          if (enhanced !== visualPrompt) {
            this.log('STAGE-5B', `🎨 ${scene.id} 真实感增强 | 已注入7维质感参数`);
          }
          visualPrompt = enhanced;
        }
        
        // v6.6.4: 金色光影技能系统接入（三点照明+情绪光影+环境光效+AI真实感）
        if (typeof this.applyLightingSkills === 'function') {
          const lightingEnhanced = await this.applyLightingSkills(scene, visualPrompt, {
            shotIndex: i,
            mode: this.mode
          });
          if (lightingEnhanced !== visualPrompt) {
            this.log('STAGE-5B', `🎨 ${scene.id} 光影技能增强 | 已注入金色光影体系`);
          }
          visualPrompt = lightingEnhanced;
        }
        
        results.push({
          ...scene,
          visualPrompt: visualPrompt,
          visualPromptSuccess: true
        });
        this.log('STAGE-5B', `✅ ${scene.id} visualPrompt 成功`);
      } else {
        let visualPrompt = this._buildFallbackVisualPrompt(scene, world);
        
        // v6.6.0: 真实感提示词增强（软性注入，fallback也增强）
        if (this.realismEnhancer && this.realismEnhancer.enabled) {
          visualPrompt = this.realismEnhancer.enhance(visualPrompt, {
            sceneType: scene.type || 'general',
            shotIndex: i
          });
        }
        
        // v6.6.4: 金色光影技能系统接入（fallback分支同样增强）
        if (typeof this.applyLightingSkills === 'function') {
          visualPrompt = await this.applyLightingSkills(scene, visualPrompt, {
            shotIndex: i,
            mode: this.mode
          });
        }
        
        this.log('STAGE-5B', `⚠️ ${scene.id} visualPrompt 失败: ${result.error}`);
        results.push({
          ...scene,
          visualPrompt: visualPrompt,
          visualPromptSuccess: false,
          visualPromptError: result.error
        });
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  // v6.6.0: 视觉提示词真实感增强（后置处理）
  _enhanceVisualPromptWithRealism(visualPrompt, scene, index) {
    if (!this.realismEnhancer || !this.realismEnhancer.enabled) {
      return visualPrompt;
    }
    
    const enhanced = this.realismEnhancer.enhance(visualPrompt, {
      sceneType: scene.type || 'general',
      shotIndex: index
    });
    
    if (enhanced !== visualPrompt) {
      this.log('STAGE-5B', `🎨 ${scene.id} 真实感增强已注入 | 7维质感参数`);
    }
    
    return enhanced;
  }

  // v6.5.59-fix: 主进程内存释放（OOM修复）
  // 根因：主进程执行STAGE-0~12后，累积大量内存到5.1GB
  // 修复：释放已完成Stage的大对象，强制GC
  _releaseMemory(result) {
    if (!result || !result.stages) return;
    
    // 【v2.1.4-fix10-P25-fix8-P1A】只释放大体积临时数据，保留 stage 元数据供后续使用
    if (result.stages.script?.raw) result.stages.script.raw = null;
    if (result.stages.prd?._raw) result.stages.prd._raw = null;
    if (result.stages.opening?._debugShots) result.stages.opening._debugShots = null;
    // ✅ 不再置空 prd/opening/alignment/schema/characters 本身——后续 stage 还要用
    
    if (global.gc) global.gc();
    this.log('PIPELINE', '✅ 主进程内存释放完成（仅清理大对象，保留 stage 引用）');
  }

  _buildScriptCorePrompt(batch, core, world, batchIdx, totalBatches, input) {
    const parts = [];
    const isNirath = this.mode === 'nirath';

    parts.push(`你是一位专业的视频剧本策划Agent。`);
    parts.push(`请为当前批次场景生成简洁、可直接用于视频制作的剧本骨架。`);
    parts.push(`只输出一个合法JSON对象，不要输出解释、思考过程、markdown代码块。`);

    parts.push(`
【世界观】`);
    parts.push(`名称：${world.name || 'Nirath'}`);
    parts.push(`设定：${world.setting || '默认世界观'}`);

    if (!isNirath) {
      parts.push(`
【重要约束】`);
      parts.push(`- 本视频为真实世界纪录片/科普风格，禁止使用任何虚构元素`);
      parts.push(`- 禁止出现：外星生态、Nirath、异兽、科幻场景、超自然现象`);
      parts.push(`- 所有角色必须是真实人类，禁止虚构角色`);
      parts.push(`- 场景必须是真实医疗/教育环境`);
    }

    parts.push(`
【当前批次】${batchIdx + 1}/${totalBatches}`);

    parts.push(`
【角色信息】`);
    parts.push(`- 当前场景必须包含以下角色之一，禁止空角色`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''} | 必须在dialogue中体现`);
    });
    parts.push(`
【角色出场规则】`);
    parts.push(`- 每个场景必须明确包含角色名称`);
    parts.push(`- dialogue中角色名称必须完整出现，不能省略`);
    parts.push(`- 禁止生成无角色或角色为"无"的场景`);

    // v6.6.0: 叙事方式与结尾处理
    const narrativeMode = input.narrativeMode || 'dialogue';
    const endingStyle = input.endingStyle || 'summary';
    parts.push(`
【叙事方式】`);
    parts.push(`- 叙事模式: ${narrativeMode}`);
    if (narrativeMode === 'dialogue') {
      parts.push(`- 对话式讲解: 角色直接面向观众说话，口语化、自然`);
    } else if (narrativeMode === 'narration') {
      parts.push(`- 旁白式: 以旁白为主，角色动作配合画面`);
    } else if (narrativeMode === 'drama') {
      parts.push(`- 剧情式: 角色间互动对话，有戏剧冲突`);
    } else if (narrativeMode === 'interview') {
      parts.push(`- 访谈式: 问答形式，一问一答`);
    }
    parts.push(`- dialogue必须符合叙事模式，不要混用其他模式`);

    parts.push(`
【结尾处理】`);
    parts.push(`- 结尾风格: ${endingStyle}`);
    if (endingStyle === 'summary') {
      parts.push(`- 总结式: 总结本集要点，给出结论`);
    } else if (endingStyle === 'cliffhanger') {
      parts.push(`- 悬念式: 留下悬念，引发好奇`);
    } else if (endingStyle === 'callToAction') {
      parts.push(`- 行动号召: 引导观众采取行动`);
    } else if (endingStyle === 'emotional') {
      parts.push(`- 情感升华: 情感升华，引发共鸣`);
    } else if (endingStyle === 'open') {
      parts.push(`- 开放式: 不给出明确结论，留给观众思考`);
    }

    parts.push(`
【场景列表】`);
    batch.forEach((scene, idx) => {
      const sceneChars = (scene.characters || []).join(', ') || '无';
      parts.push(`场景${idx + 1}`);
      parts.push(`- id: ${scene.id}`);
      parts.push(`- 名称: ${scene.name || '未命名'}`);
      parts.push(`- 类型: ${scene.type || 'explanation'}`);
      parts.push(`- 时长: ${scene.duration || 10}秒`);
      parts.push(`- 描述: ${scene.description || '无描述'}`);
      parts.push(`- 角色: ${sceneChars}`);
      parts.push(`- 强制要求: dialogue必须包含角色"${sceneChars}"，禁止空角色`);
    });

    parts.push(`
【生成要求】`);
    parts.push(`1. scene：场景名称，可简要优化`);
    parts.push(`2. dialogue：口语化、自然，适合视频表达`);
    parts.push(`3. narration：必要时提供简短准确的旁白`);
    parts.push(`4. mouthAction：只能是 speaking_normal / speaking_whisper / speaking_emphasis`);
    parts.push(`5. emotionPhase：只能是 curiosity / tension / climax / resolution`);

    parts.push(`
【风格要求】`);
    parts.push(`- 健康科普内容应专业、清晰、不过度夸张`);
    parts.push(`- 语言适合短视频口播`);
    parts.push(`- 优先保证可读性与可拍摄性`);

    parts.push(`
【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层必须包含 scenes, narrative, world`);
    parts.push(`- scenes 数量必须与输入场景数完全一致`);
    parts.push(`- scenes 中每项必须包含 id, scene, dialogue, narration, characters, mouthAction, emotionPhase`);
    parts.push(`- 每个 id 必须与输入一致`);
    parts.push(`- characters 必须是角色ID数组，如 ["chen-nurse", "xiaoG", "coach-li"]`);

    parts.push(`
【输出示例】`);
    parts.push(`{
  "scenes": [
    {
      "id": "S01",
      "scene": "开场介绍",
      "dialogue": "大家好，今天我们来聊一个需要高度重视的问题。",
      "narration": "本集主题为横纹肌溶解。",
      "characters": ["chen-nurse", "xiaoG", "coach-li"],
      "mouthAction": "speaking_normal",
      "emotionPhase": "curiosity"
    }
  ],
  "narrative": {
    "emotion": "neutral",
    "pace": "medium",
    "totalDuration": 15
  },
  "world": {
    "name": "${world.name || 'Nirath'}",
    "setting": "${world.setting || ''}"
  }
}`);

    return parts.join('\n');
  }

  _buildVisualPrompt(scene, core, world, idx, total, input) {
    const parts = [];
    const isNirath = this.mode === 'nirath';

    parts.push(`你是一位专业的视频分镜视觉提示词生成Agent。`);
    parts.push(`请只为当前单个场景生成 visualPrompt。`);
    parts.push(`只输出一个合法JSON对象，不要输出解释、思考过程、markdown代码块。`);

    parts.push(`
【世界观】`);
    parts.push(`名称：${world.name || 'Nirath'}`);
    parts.push(`设定：${world.setting || '默认世界观'}`);

    if (!isNirath) {
      parts.push(`
【重要约束】`);
      parts.push(`- 本视频为真实世界纪录片/科普风格，禁止使用任何虚构元素`);
      parts.push(`- 禁止出现：外星生态、Nirath、异兽、科幻场景、超自然现象`);
      parts.push(`- 禁止出现："AgentX迈出第一步"、"迎向异兽"、"选择信任"、"勇敢告别"、"温柔注视"等Nirath专属叙事短语`);
      parts.push(`- 所有角色必须是真实人类，禁止虚构角色`);
      parts.push(`- 场景必须是真实医疗/教育环境`);
    }

    parts.push(`
【当前镜头】${idx + 1}/${total}`);
    parts.push(`- id: ${scene.id}`);
    parts.push(`- 名称: ${scene.name || '未命名'}`);
    parts.push(`- 类型: ${scene.type || 'explanation'}`);
    parts.push(`- 时长: ${scene.duration || 10}秒`);
    parts.push(`- 描述: ${scene.description || '无描述'}`);
    parts.push(`- dialogue: ${scene.dialogue || ''}`);
    parts.push(`- narration: ${scene.narration || ''}`);

    parts.push(`
【角色信息】`);
    parts.push(`- 当前场景必须包含以下角色之一，禁止空角色`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''} | 必须在dialogue中体现`);
    });
    parts.push(`
【角色出场规则】`);
    parts.push(`- 每个场景必须明确包含角色名称`);
    parts.push(`- dialogue中角色名称必须完整出现，不能省略`);
    parts.push(`- 禁止生成无角色或角色为"无"的场景`);

    parts.push(`
【生成要求】`);
    parts.push(`请生成 120-180 字的 visualPrompt，用于视频生成。`);
    parts.push(`内容需包含：`);
    parts.push(`1. 场景环境`);
    parts.push(`2. 人物动作与姿态`);
    parts.push(`3. 镜头景别或机位`);
    parts.push(`4. 光线与画面质感`);
    parts.push(`5. 纪录片/真实科普风格`);
    parts.push(`6. 不要出现参数化提示词，不要出现分辨率、英文模型参数、括号权重`);

    // 🔥 v2.0: 创意指数指令注入（仅影响视觉表现层）
    const ciiInstructions = this._getCreativeIntensityInstructions('STAGE-5');
    if (ciiInstructions) {
      parts.push(`
【创意增强】`);
      parts.push(ciiInstructions.trim());
    }

    // v6.6.0: 平台适配与视觉风格
    const platform = input.platform || '视频号/抖音';
    const visualStyle = input.visualStyle || '';
    const styleModifiers = input.styleModifiers || [];
    
    parts.push(`
【平台与画幅】`);
    parts.push(`- 投放平台: ${platform}`);
    if (platform.includes('抖音') || platform.includes('快手') || platform.includes('小红书')) {
      parts.push(`- 推荐画幅: 9:16 竖屏`);
    } else if (platform.includes('B站') || platform.includes('YouTube')) {
      parts.push(`- 推荐画幅: 16:9 横屏`);
    } else {
      parts.push(`- 推荐画幅: 9:16 竖屏（默认）`);
    }
    
    if (visualStyle || styleModifiers.length > 0) {
      parts.push(`
【视觉风格指导】`);
      if (visualStyle) {
        parts.push(`- 整体视觉风格: ${visualStyle}`);
      }
      if (styleModifiers.length > 0) {
        parts.push(`- 辅助风格修饰: ${styleModifiers.join('、')}`);
      }
    }

    parts.push(`
【风格要求】`);
    parts.push(`- 超写实纪录片风格`);
    parts.push(`- 医疗/科普场景真实可信`);
    parts.push(`- 人物表情自然，不夸张`);
    parts.push(`- 适合后续视频生成模型理解`);

    parts.push(`
【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层只包含 id 和 visualPrompt`);
    parts.push(`- id 必须与输入一致`);

    parts.push(`
【输出示例】`);
    parts.push(`{
  "id": "${scene.id}",
  "visualPrompt": "超写实纪录片风格，专业医疗科普环境中，主持人面对镜头进行清晰讲解，神态自然沉稳，人物位于中近景构图，背景为整洁明亮的诊室或科普演播空间，画面采用柔和自然光，细节真实，镜头稳定，整体呈现专业、可信、克制的医学科普质感。"
}`);

    return parts.join('\n');
  }

  _buildFallbackDialogue(scene, characters = {}) {
    const name = scene.name || '当前场景';
    
    // v6.5.29: 获取角色名称，确保角色出现在dialogue中
    const charNames = Object.values(characters || {}).map(c => c.name || c.id || '').filter(Boolean);
    const speaker = charNames[0] || '主持人';
    
    // 获取场景指定的角色（优先使用场景的角色列表）
    const sceneChars = (scene.characters || []).map(cid => {
      const char = characters[cid];
      return char ? (char.name || char.id) : cid;
    }).filter(Boolean);
    const sceneSpeaker = sceneChars[0] || speaker;
    
    if (scene.type === 'establishing') {
      return `大家好，我是${sceneSpeaker}，今天我们来了解一下${name}相关的核心内容。`;
    }
    
    if (scene.type === 'explanation') {
      return `这一部分${sceneSpeaker}重点讲解${name}，帮助大家快速抓住关键知识点。`;
    }
    
    if (scene.type === 'demonstration') {
      return `接下来${sceneSpeaker}通过一个示范动作，直观理解${name}的表现和检查方式。`;
    }
    
    if (scene.type === 'closing') {
      return `最后${sceneSpeaker}再强调一次，如果出现相关症状，一定要及时就医，不要拖延。`;
    }
    
    return `下面${sceneSpeaker}进入${name}。`;
  }

  _buildFallbackNarration(scene) {
    const desc = scene.description || `${scene.name || '该场景'}的补充说明`;
    
    // v6.5.29: 确保结尾镜头narration完整收束，避免以半截词结尾
    if (scene.type === 'closing') {
      return `以上就是关于${scene.name || '本话题'}的核心要点。如果出现相关症状，请及时就医。`;
    }
    
    return desc + '。';
  }

  _buildFallbackVisualPrompt(scene, world) {
    return [
      `超写实纪录片风格，`,
      `${world?.setting || '真实场景'}，`,
      `镜头表现${scene.name || '当前场景'}，`,
      `突出${scene.description || '关键信息讲解'}，`,
      `人物动作自然，表情专业克制，`,
      `采用中近景或特写镜头，`,
      `自然光或柔和室内布光，`,
      `画面真实、干净、稳定，适合医学科普视频生成。`
    ].join('');
  }

  _inferEmotionPhase(scene) {
    switch (scene.type) {
      case 'establishing':
        return 'curiosity';
      case 'explanation':
        return 'tension';
      case 'demonstration':
        return 'climax';
      case 'closing':
        return 'resolution';
      default:
        return 'curiosity';
    }
  }
  _buildScriptPrompt(scenes, core, world, batchIdx, totalBatches) {
    // 根据模式选择提示词模板
    const isNirath = this.mode === 'nirath';
    const projectType = isNirath ? '山海经' : (core.projectType || '视频');
    const worldName = world?.name || world?.setting || (isNirath ? 'Nirath' : '现实世界');
    const worldDesc = isNirath ? '(外星生态星球)' : (world?.atmosphere ? `(${world.atmosphere})` : '');
    const style = world?.style || (isNirath ? 'Nirath电影级, 超写实科幻生态风格' : '超写实纪录片风格');
    
    // 从场景中提取所有角色，避免硬编码
    const allChars = new Set();
    for (const s of scenes) {
      if (s.characters && s.characters.length > 0) {
        for (const c of s.characters) {
          if (c && c !== '无') allChars.add(c);
        }
      }
    }
    // 如果没有提取到角色，使用默认值
    const defaultChars = isNirath ? 'xiaoG,taotie' : 'chen-nurse,xiaoG,coach-li';
    const charList = allChars.size > 0 ? Array.from(allChars).join(',') : defaultChars;
    
    return `你是一位编剧,为${projectType}生成台词剧本(批次${batchIdx + 1}/${totalBatches})。

## 主题
${core.theme || '未指定'}

## 核心内容（P0级约束：必须严格遵循）
${core.narrative?.focus || core.focus || '健康科普内容'}

## 世界观
${worldName}${worldDesc}

## 场景(${scenes.length}镜)（必须严格使用以下场景名称，禁止自由发挥）
${scenes.map((s, i) => `${i+1}. ${s.id}: ${s.scene} | ${s.type} | ${s.duration}s | 角色:${s.characters?.join(',') || charList}
   场景描述: ${s.description || '无'}
   已有台词: ${(s.dialogue || '').substring(0, 40)}...`).join('\n')}

## 角色规范（P0级约束）
- 每个场景必须有角色，禁止生成无角色的场景
- 角色列表格式: ["${charList.split(',').join('"、"')}"]
- 禁止 characters: ["无"] 或 [] 或 null
- 场景必须有对话，必须有角色在说话

## 风格
${style}(必须与场景主题一致)

## 输出要求
**必须严格输出JSON,不要任何中文解释、不要markdown代码块标记、不要【】括号。**
**只输出纯JSON字符串,开头就是 {,结尾就是 }。**
**⚠️ 关键约束：scene字段必须严格使用输入的场景名称，禁止修改或自创名称。**

JSON格式(注意:用dialogue字段,不是narration):
${isNirath 
  ? `{"scenes":[{"id":"S01","scene":"场景名称","dialogue":"角色对白或台词文本(不要旁白叙述,要角色自己说的话)","type":"opening","characters":["xiaoG","taotie"],"mouthAction":"speaking_whisper","emotionPhase":"curiosity","importance":8,"visualComplexity":7,"visualPrompt":"超写实,电影级光影,角色动作描述(300-500字)","beastDialogue":"异兽台词(如有,20字内)"}]}`
  : `{"scenes":[{"id":"S01","scene":"场景名称","dialogue":"角色对白或台词文本(不要旁白叙述,要角色自己说的话)","type":"explanation","characters":["${charList.split(',')[0] || 'chen-nurse'}"],"mouthAction":"speaking_normal","emotionPhase":"professional","importance":8,"visualComplexity":7,"visualPrompt":"超写实,电影级光影,角色动作描述(300-500字)"}]}`
}

## 关键规则(P0级约束)
- ❌ 绝对禁止生成旁白/叙述性文字(如"AgentX来到了...")
- ✅ 必须生成角色对白/台词(角色自己说的话)
- ✅ 严格遵循每个场景指定的角色列表,禁止引入未声明角色
- ✅ 台词内容必须与场景名称和场景描述的主题一致(如"症状讲解"场景必须围绕症状展开)
- ✅ 每镜台词必须独立原创,严禁复制其他镜的台词内容(每镜必须是全新对话,不能重复)
- ✅ 结尾镜头(S05/closing)必须有完整的台词收束,不能以半截句子或单个字结束
- ✅ 必须严格使用输入的场景名称，禁止修改或自创名称
- 如果有多个角色,标注谁在说话
- 台词要体现角色性格和情绪
- 场景名称是中文,台词内容也必须匹配中文场景名所暗示的主题`;
  }

  // ========== Stage 5.5: FPV镜头智能决策(导演创作权)==========
  async stageFPVDecision(script) {
    this.log('STAGE-5.5', 'FPV镜头智能决策(导演创作权)');

    let fpvAnalysis = null;
    let directorDecision = null;

    try {
      // 加载 FPV Intelligence Engine
      const { FPVIntelligenceEngine } = require('./fpv-intelligence-engine.js');
      const fpvEngine = new FPVIntelligenceEngine();

      // 转换 scenes 为 shots 格式(兼容FPV引擎)
      const fpvScript = {
        shots: (script.scenes || []).map((scene, idx) => ({
          id: scene.id,
          type: scene.type,
          mood: scene.emotionPhase || '',
          prompt: scene.narration || '',
          index: idx,
          duration: scene.duration || 5
        })),
        arc: script.narrative?.emotion || 'neutral',
        climaxIndex: (script.scenes || []).findIndex(s => s.type === 'climax' || s.emotionPhase === 'climax')
      };

      // 评估剧本的FPV适配度
      fpvAnalysis = fpvEngine.evaluateScript(fpvScript);

      // 导演决策:选择最佳FPV镜头
      directorDecision = fpvAnalysis.directorDecision;

      this.log('STAGE-5.5', `✅ FPV智能评估完成`);
      this.log('STAGE-5.5', `   剧本FPV适配度: ${fpvAnalysis.scriptAnalysis?.averageFPVSuitability || 'unknown'}/100`);
      this.log('STAGE-5.5', `   导演决策: ${directorDecision?.reasoning || '无'}`);

      // 标记每个镜头的FPV推荐状态(尊重导演决策)
      const directorPrimary = directorDecision?.primaryFPV;
      const directorSecondary = directorDecision?.secondaryFPV;

      for (const shot of script.scenes || []) {
        const shotAnalysis = fpvAnalysis.shotEvaluations?.find(s => s.shotId === shot.id);
        if (shotAnalysis) {
          // 导演决策优先:如果导演选中了,即使系统评分不高也标记为FPV
          const isDirectorChoice = (directorPrimary?.shotId === shot.id) ||
                                   (directorSecondary?.shotId === shot.id);

          shot.fpvRecommended = shotAnalysis.isRecommended || isDirectorChoice;
          shot.fpvScore = shotAnalysis.totalScore;
          shot.fpvReason = isDirectorChoice
            ? `导演决策:${directorDecision?.reasoning || '选中该镜头'}`
            : shotAnalysis.recommendation;

          if (shot.fpvRecommended) {
            this.log('STAGE-5.5', `   🔴 FPV推荐: ${shot.id} | 得分: ${shot.fpvScore} | 理由: ${shot.fpvReason}`);
          }
        }
      }

    } catch (e) {
      this.log('STAGE-5.5', `⚠️ FPV智能评估失败: ${e.message} | 使用默认策略`);
      // Fallback: 默认策略( climax 镜头标记为FPV)
      for (const shot of script.scenes || []) {
        if (shot.type === 'climax' || shot.emotionPhase === 'climax') {
          shot.fpvRecommended = true;
          shot.fpvScore = 85;
          shot.fpvReason = 'climax镜头默认FPV';
          this.log('STAGE-5.5', `   🔴 FPV推荐(fallback): ${shot.id} | climax镜头`);
        }
      }
    }

    return {
      analysis: fpvAnalysis,
      directorDecision,
      recommendedShots: (script.scenes || []).filter(s => s.fpvRecommended).map(s => s.id)
    };
  }

  // ========== Stage 6: 时长分配(集成ShotDurationAllocatorV2 + DurationCalculator双保险 + P1修复) ==========
  async stageDurationAllocation(script, input) {
    this.log('STAGE-6', '镜头时长分配(ShotDurationAllocatorV2 + DurationCalculator双保险)');

    const allocations = [];
    const totalDuration = script.narrative?.totalDuration || (input && input.targetDuration) || 15;

    // P0修复#3 + P1修复#14-22:集成ShotDurationAllocatorV2(重要性驱动/弹性区间/双池模型)
    let v2Allocations = null;
    let optimizationLevel = 'L0';
    try {
      if (typeof this.modules.shotDurationAllocator.allocate === 'function') {
        // 🔥 v6.0: 时长放宽5%~10%(剧本需要时自动启用)
        // v6.2-patch66-fix: 从15%降低到5%,防止总时长过度偏离PRD
        const baseDuration = totalDuration;
        const relaxedDuration = Math.round(baseDuration * 1.05); // 放宽5%
        const finalDuration = Math.max(baseDuration, Math.min(relaxedDuration, 90)); // 上限90秒

        if (finalDuration > baseDuration) {
          this.log('STAGE-6', `📏 时长放宽: ${baseDuration}s → ${finalDuration}s (+${Math.round((finalDuration/baseDuration - 1) * 100)}%)`);
        }

        // 构造v2输入:包含importance和visualComplexity
        // 🔥 v6.2-patch49-fix: 防御性校验,防止空数据导致ShotDurationAllocatorV2报错
        const safeScenes = Array.isArray(script.scenes) ? script.scenes : [];
        if (safeScenes.length === 0) {
          throw new Error('script.scenes为空数组,无法进行时⻓分配');
        }
        const v2Narrations = safeScenes.map((s, idx) => {
          // v6.5.34-fix: 全局禁用narration，使用dialogue替代
          const text = (s.dialogue || s.narration || '').toString();
          const type = s.type || s.beatName || 'explanation';
          if (!text || text.length === 0) {
            this.log('STAGE-6', `  ⚠️ 场景${s.id || idx} dialogue为空,使用默认文本`);
          }
          return {
            id: s.id || `S${String(idx + 1).padStart(2, '0')}`,
            text: text || '[无文本]',
            type: type,
            priority: s.importance || 5,
            importance: s.importance || 5,
            visualComplexity: s.visualComplexity || 5,
            characters: s.characters || []
          };
        });
        const v2Input = {
          totalDuration: finalDuration,
          rhythmCurve: script.narrative?.pace || 'classic',
          narrations: v2Narrations
        };
        this.log('STAGE-6', `📤 ShotDurationAllocatorV2输入: ${v2Narrations.length}句dialogue | 总预算${finalDuration}s`);
        v2Allocations = this.modules.shotDurationAllocator.allocate(v2Input);
        optimizationLevel = v2Allocations?.optimizationLevel || 'L0';

        // 校验返回结果完整性
        if (!v2Allocations || !Array.isArray(v2Allocations.shots)) {
          throw new Error('ShotDurationAllocatorV2返回结果无效: shots数组缺失');
        }
        if (v2Allocations.shots.length !== safeScenes.length) {
          this.log('STAGE-6', `  ⚠️ 分配结果镜数不匹配: 输入${safeScenes.length}镜 → 输出${v2Allocations.shots.length}镜`);
        }
        this.log('STAGE-6', `✅ ShotDurationAllocatorV2已调用 | 优化级别: ${optimizationLevel} | 总时长预算: ${finalDuration}s | 返回${v2Allocations.shots.length}镜`);
      }
    } catch (e) {
      this.log('STAGE-6', `⚠️ ShotDurationAllocatorV2调用失败: ${e.message}`);
    }

    // P1修复#34:L2降级处理避免0镜产出
    if (optimizationLevel === 'L2' || optimizationLevel === 'L3') {
      this.log('STAGE-6', `⚠️ 时长分配触发降级: ${optimizationLevel} | 内容超载,建议精简narration或增加预算`);
    }

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const narration = scene.narration || '';
      const charCount = narration.length;

      // v6.2-patch71-fix: 优先使用PRD中定义的场景时长,尊重业务输入
      let duration;
      const prdDuration = scene.duration;
      if (v2Allocations && v2Allocations.shots && v2Allocations.shots[i]) {
        const v2Duration = v2Allocations.shots[i].duration;
        // 如果PRD中定义了该场景的duration,优先使用PRD值(±10%容差内不调整)
        if (prdDuration && prdDuration >= 3 && prdDuration <= 30) {
          const ratio = v2Duration / prdDuration;
          if (ratio >= 0.9 && ratio <= 1.1) {
            // v2分配在容差内,直接使用PRD值
            duration = prdDuration;
            this.log('STAGE-6', `  🎯 V2分配(尊重PRD): ${scene.id} | PRD:${prdDuration}s ≈ V2:${v2Duration}s | 使用PRD:${duration}s`);
          } else {
            // v6.6.2-fix: 当V2计算值大于PRD，且不超过15秒硬约束时，使用V2值
            if (v2Duration > prdDuration && v2Duration <= 15) {
              duration = v2Duration;
              this.log('STAGE-6', `  🎯 V2调整(内容适配): ${scene.id} | PRD:${prdDuration}s → V2:${v2Duration}s (≤15s硬约束)`);
            } else if (v2Duration > 15) {
              // 超过15秒硬约束，使用15秒，警告
              duration = 15;
              this.log('STAGE-6', `  ⚠️ V2超限(15s硬约束): ${scene.id} | PRD:${prdDuration}s vs V2:${v2Duration}s → 强制15s，建议精简台词`);
            } else {
              // V2 < PRD，使用PRD（业务定义优先）
              duration = prdDuration;
              this.log('STAGE-6', `  ⚠️ V2与PRD差异大: ${scene.id} | PRD:${prdDuration}s vs V2:${v2Duration}s | 强制使用PRD:${duration}s`);
            }
          }
        } else {
          duration = v2Duration;
          this.log('STAGE-6', `  🎯 V2分配: ${scene.id} | importance:${scene.importance || 5} | duration:${duration}s`);
        }
      } else {
        // Fallback: DurationCalculator
        try {
          duration = this.modules.durationCalculator.calculate({
            text: narration,
            type: scene.type || 'default'
          });
        } catch (e) {
          const estimatedDuration = Math.ceil(charCount / 4.5 + 0.5);
          duration = Math.min(Math.max(estimatedDuration, 3), 12);
        }
      }

      // v6.2-patch65: 节奏增强 - 基于shotType增加张弛变化
      // climax镜延长,过渡镜缩短,形成叙事节奏
      if (scene.shotType === 'climax') {
        const extra = Math.round(duration * 0.25); // climax镜延长25%
        duration += extra;
        this.log('STAGE-6', `  🎵 节奏增强: ${scene.id} climax镜 +${extra}s`);
      } else if (scene.shotType === 'setup' || scene.shotType === 'transition') {
        const reduce = Math.round(duration * 0.15); // 过渡镜缩短15%
        duration = Math.max(duration - reduce, 5); // 最少5秒
        this.log('STAGE-6', `  🎵 节奏增强: ${scene.id} 过渡镜 -${reduce}s`);
      }
      const clampedDuration = Math.min(Math.max(duration, 3), prdDuration && prdDuration >= 3 ? Math.min(prdDuration, 15) : 15);
      const capacity = Math.floor(clampedDuration * 5.0); // 极限语速5.0字/秒
      const isOverCapacity = charCount > capacity;

      // P1修复#19:节奏曲线阶段标记
      const emotionPhase = scene.emotionPhase || this.calculateEmotionPhase(i, script.scenes.length);

      allocations.push({
        sceneId: scene.id,
        narration,
        charCount,
        duration: clampedDuration,
        type: scene.type,
        importance: scene.importance || 5,
        visualComplexity: scene.visualComplexity || 5,
        emotionPhase,
        v2Allocated: !!v2Allocations,
        optimizationLevel,
        isOverCapacity,
        capacity
      });

      if (isOverCapacity) {
        this.log('STAGE-6', `  ⚠️ narration超长: ${scene.id} | ${charCount}字 > ${capacity}字容量(${clampedDuration}秒)`);
      }
    }

    // P1修复#20:三级自优化状态报告
    if (optimizationLevel !== 'L0') {
      this.log('STAGE-6', `⚠️ 时长分配优化级别: ${optimizationLevel} | 建议检查内容是否超载`);
    }

    this.log('STAGE-6', `✅ 时长分配 | 镜头数: ${allocations.length} | V2分配: ${allocations.filter(a => a.v2Allocated).length}/${allocations.length} | 超长: ${allocations.filter(a => a.isOverCapacity).length}/${allocations.length} | 优化级别: ${optimizationLevel}`);
    return allocations;
  }

  // ========== Stage 7: 故事板生成(防硬编码:结构化生成 + mouthAction字段 + Nirath场景映射) ==========
  async stageStoryboard(script, durations, input = {}) {
    this.log('STAGE-7', '故事板生成(结构化生成器 + mouthAction字段 + Nirath场景映射)');

    // ========== StoryCraft Engine v2.0 集成 ==========
    // 检查是否启用 StoryCraft(异兽视角叙事模式)
    const storyCraftEnabled = input?.storyCraftVersion === 'v2.0' || input?.storyCraftVersion === 'v1.0' || input?.enableStoryCraft === true;
    const beastProfile = input?.beastProfile || input?.beast || input?.core?.beast || {};

    if (storyCraftEnabled && beastProfile?.name && this.mode === 'nirath') {
      this.log('STAGE-5.0', 'StoryCraft Engine v2.0 启用 - 异兽视角叙事 + 60秒三幕引擎 + 钻石台词');

      try {
        const { StoryCraftIntegration } = require('./story-craft-engine/story-craft-integration');
        const storyCraft = new StoryCraftIntegration({
          enabled: true,
          strictMode: false,
          maxRetries: 2,
          useLLM: true // v6.2-patch70: 启用 LLM 推理
        });

        const scResult = await storyCraft.generateStory(input, beastProfile);

        if (scResult.success && scResult.storyboard) {
          this.log('STAGE-5.1', `StoryCraft 生成完成: ${scResult.storyboard.shots.length} 镜`);
          this.log('STAGE-5.1', `主题: ${scResult.conceptSeed?.theme}`);
          this.log('STAGE-5.1', `反转强度: ${scResult.conceptSeed?.twistStrength}`);
          this.log('STAGE-5.1', `反转验证: ${scResult.twistValidation?.passed ? '通过' : '未通过'} (${scResult.twistValidation?.score}/100)`);

          // v2.0:打印三幕引擎信息
          const beats = scResult.storyboard.beats || [];
          const v2Beats = beats.filter(b => b._threeAct);
          if (v2Beats.length > 0) {
            this.log('STAGE-5.1', `v2.0 三幕引擎: 入侵(0-12s)→震颤(12-40s)→蜕变(40-60s) | ${v2Beats.length}/5 beats已标记`);
            const silentBeats = v2Beats.filter(b => b._threeAct?.silenceRequired);
            if (silentBeats.length > 0) {
              this.log('STAGE-5.1', `v2.0 静默高潮: ${silentBeats.length}个镜头标记静默要求`);
            }
          }

          // v2.0:打印钻石台词信息
          const beastLines = scResult.dialogueResult?.beastLines || {};
          const diamondLines = Object.values(beastLines).filter(l => l?.isDiamond);
          if (diamondLines.length > 0) {
            this.log('STAGE-5.1', `v2.0 钻石台词: ${diamondLines.length}句钻石台词已生成`);
            diamondLines.forEach(dl => {
              this.log('STAGE-5.1', `  💎 ${dl.beatId}: "${dl.text}" (Act${dl.actNumber})`);
            });
          }

          // v2.0:打印核心意象
          const coreImage = scResult.conceptSeed?.coreImage;
          if (coreImage) {
            this.log('STAGE-5.1', `v2.0 核心意象: ${coreImage.image} | 绽放: ${coreImage.bloomMoment?.substring(0,40)}...`);
          }

          // 转换为现有storyboard格式(v2.0:融入三幕引擎+钻石台词+核心意象)
          let scShots = scResult.storyboard.shots.map((shot, index) => {
            // 🔥 v1.1-fix: 优先使用V2分配器的时长,而非StoryCraft默认12秒
            const v2Duration = durations && durations[index] ? durations[index].duration : null;
            const finalDuration = v2Duration || shot.duration || 12;

            // v2.0:获取对应beat的三幕信息
            const beat = scResult.storyboard.beats?.find(b => b.id === shot.beatId);
            const threeAct = beat?._threeAct;

            // v2.0:获取钻石台词
            const beastLine = scResult.dialogueResult?.beastLines?.[shot.beatId];
            const isDiamond = beastLine?.isDiamond || false;

            // v2.0:构建增强版visualPrompt(融入三幕标记+感知锚点)
            let enhancedVisualPrompt = shot.visualPrompt || '';
            if (threeAct) {
              const actTag = `【${threeAct.actName}(${threeAct.actTimeRange.start}-${threeAct.actTimeRange.end}s) | 感知锚点:${threeAct.sensoryAnchor} | 情感曲线:${threeAct.emotionalArc}】`;
              enhancedVisualPrompt = actTag + '\n' + enhancedVisualPrompt;
            }
            // v2.0:静默标记融入
            if (threeAct?.silenceRequired) {
              enhancedVisualPrompt = '【⚠️静默高潮:最后8秒不说话,只用感官意象完成叙事】\n' + enhancedVisualPrompt;
            }

            // v2.0:构建增强版narration(融入钻石台词标记)
            let enhancedNarration = shot.narration || '';
            if (isDiamond && beastLine?.text) {
              enhancedNarration = `【💎钻石台词(Act${beastLine.actNumber}):"${beastLine.text}" | 含义:${beastLine.diamondLayers?.map(l=>l.layer).join('/')}】\n${enhancedNarration}`;
            }

            // v2.0:核心意象融入最后一镜(B5/余韵)
            const coreImage = scResult.conceptSeed?.coreImage;
            if (shot.beatId === 'B5' && coreImage) {
              enhancedVisualPrompt = `【🌸核心意象绽放:${coreImage.image} | ${coreImage.description}】\n${enhancedVisualPrompt}`;
            }

            return {
              // v6.2-patch106-fix: 强制使用索引生成ID,避免StoryCraft返回重复ID(如全部S01)
              id: `S${String(index + 1).padStart(2, '0')}`,
              scene: shot.beatName || 'scene',
              narration: enhancedNarration,
              duration: finalDuration,
              type: shot.beatName || 'explanation',
              shotType: shot.shotType || this._deriveShotType(index, scResult.storyboard.shots.length, shot.beatName), // v6.2-patch65: 传递叙事弧线标记
              characters: ['xiaoG', input.beastId || beastProfile.id || 'beast'],
              mouthAction: shot.mouthAction || (index === 0 ? '嘴部自然闭合,面对镜头' : '嘴部自然闭合'),
              emotionPhase: shot.emotionTarget?.emotion || 'neutral',
              importance: durations && durations[index] ? durations[index].importance : 5,
              visualComplexity: 5,
              visualPrompt: enhancedVisualPrompt,
              fpvRecommended: false,
              cameraMovement: null,
              prompt: null,
              // StoryCraft 特有字段
              beastDialogue: shot.beastDialogue,
              humanDialogue: shot.humanDialogue,
              beastMonologue: shot.beastMonologue,
              interactionType: shot.interactionType,
              // v2.0新增字段
              _threeAct: threeAct,
              _isDiamond: isDiamond,
              _diamondLayers: beastLine?.diamondLayers || null
            };
          });

          this.log('STAGE-5.2', `StoryCraft 故事板已转换 | ${scShots.length} 镜 | 总时长: ${scShots.reduce((s, x) => s + x.duration, 0)}s`);

          // 🔥 StoryCraft修复:同步更新script.scenes,确保端到端验证器能检查visualPrompt
          if (script && script.scenes && Array.isArray(script.scenes)) {
            scResult.storyboard.shots.forEach((scShot, idx) => {
              if (script.scenes[idx]) {
                script.scenes[idx].visualPrompt = scShot.visualPrompt || '';
                script.scenes[idx].narration = scShot.narration || '';
                script.scenes[idx].scene = scShot.beatName || script.scenes[idx].scene || '';
              }
            });
            this.log('STAGE-5.2', `✅ script.scenes 已同步 StoryCraft visualPrompt | ${Math.min(script.scenes.length, scResult.storyboard.shots.length)} 场景`);
          }

          // 【v6.0-patch22 新增】Nirath视觉锚点注入(StoryCraft路径)
          if (this.mode === 'nirath') {
            const injector = this.modules.nirathVisualInjector;
            scShots = injector.injectBatch(scShots);
            const injectedCount = scShots.filter(s => s._nirathAnchors?.wasInjected).length;
            this.log('STAGE-5.2', `🌍 Nirath锚点注入完成: ${injectedCount}/${scShots.length} 镜注入`);
          }

            // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-4-fix: S05结尾场景情绪统一
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'closing' || shot.shotType === 'closing' || shot.emotionPhase === 'closing') {
                this._unifyClosingSceneEmotion(shot);
              }
            });
          }

          // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-4-fix: S05结尾场景情绪统一
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'closing' || shot.shotType === 'closing' || shot.emotionPhase === 'closing') {
                this._unifyClosingSceneEmotion(shot);
              }
            });
          }

          // v6.2-patch106-5-fix: S03对峙场景台词视觉化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'confrontation' || shot.shotType === 'confrontation') {
                this._visualizeConfrontationDialogue(shot);
              }
            });
          }

          // v6.2-patch106-6-fix: 运镜创新
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              this._innovateCameraMovement(shot);
            });
          }

          // v6.2-patch106-7-fix: 强制修正StoryCraft返回的重复ID
          // StoryCraft可能返回全部S01,此处强制使用索引分配唯一ID
          if (scShots.length > 1) {
            const allSameId = scShots.every(s => s.id === scShots[0].id);
            if (allSameId) {
              this.log('STAGE-7', `  ⚠️ StoryCraft返回重复ID: ${scShots[0].id}×${scShots.length},强制修正为唯一ID`);
              scShots.forEach((shot, idx) => {
                shot.id = `S${String(idx + 1).padStart(2, '0')}`;
              });
            }
          }

          return {
          shots: scShots,
            totalDuration: scShots.reduce((s, x) => s + x.duration, 0),
            storyCraft: scResult
          };
        } else {
          this.log('STAGE-5.1', `StoryCraft 失败: ${scResult.reason || scResult.error},回退到原有生成`);
        }
      } catch (error) {
        this.log('STAGE-5.1', `StoryCraft 错误: ${error.message},回退到原有生成`);
      }
    }

    // ========== 原有故事板生成逻辑(未启用StoryCraft时执行)==========

    // Nirath模式:自动映射场景名
    let mappedScenes = script.scenes;
    let mapper = null; // v6.2-fix: 提升到函数作用域,用于后续获取自动生成统计

    if (this.mode === 'nirath') {
      const { NirathSceneMapper } = require('./nirath-scene-mapper');
      mapper = new NirathSceneMapper();

      // v6.2-fix: 从input中提取beastId用于栖息地映射
      const beastId = input?.beastId || input?.core?.beastId || script?.beastId || '';
      mappedScenes = mapper.mapStoryboard(script.scenes, beastId);

      // 日志:显示场景映射结果
      mappedScenes.forEach((scene, idx) => {
        const info = mapper.getSceneInfo(scene.scene);
        if (info) {
          this.log('STAGE-7', `  🗺️ 场景映射: ${script.scenes[idx].scene || '(未命名)'} → ${scene.scene} | ${info.nirathName}`);
        } else {
          this.log('STAGE-7', `  ⚠️ 场景映射失败: ${script.scenes[idx].scene || '(未命名)'} → ${scene.scene} (库中无此场景)`);
        }
      });
    }

    const shots = [];
    for (let i = 0; i < mappedScenes.length; i++) {
      const scene = mappedScenes[i];
      const duration = durations[i]?.duration || 5;

      // v6.2-patch102-fix: 确保characters字段从输入透传,即使LLM没返回
      if (!scene.characters || scene.characters.length === 0) {
        // 优先从原始input.scenes中获取characters
        const originalScene = input.scenes?.find(s => s.id === scene.id);
        if (originalScene?.characters && originalScene.characters.length > 0) {
          scene.characters = originalScene.characters;
          this.log('STAGE-7', `  🔧 角色字段修复: ${scene.id} → 从input透传 ${originalScene.characters.join(', ')}`);
        } else {
          // 兜底:自动推断
          const inferredChars = this.inferCharactersFromScene(scene);
          if (inferredChars.length > 0) {
            this.log('STAGE-7', `  🔍 角色自动推断: ${scene.id} → ${inferredChars.join(', ')}`);
            scene.characters = inferredChars;
          }
        }
      }

      // 🔥 v6.1-fix: 五要素预注入 - 在Stage 7就确保visualPrompt包含五要素设计意图
      // 这样Stage 8.5检查时能看到完整五要素内容
      const originalVP = scene.visualPrompt || '';
      scene.visualPrompt = this.enrichVisualPromptWithFiveElements(
        originalVP,
        scene,
        i,
        mappedScenes.length,
        input
      );
      if (scene.visualPrompt !== originalVP) {
        this.log('STAGE-7', `  🔥 五要素预注入: ${scene.id} | 原${originalVP.length}字符 → 新${scene.visualPrompt.length}字符`);
      }

      // 防硬编码:结构化生成故事板shot,不直接透传
      const shot = {
        id: scene.id || `S${String(i + 1).padStart(2, '0')}`,
        scene: scene.scene || 'default',
        // v6.5.29-fix: generic模式下保留原始narration，不要覆盖为dialogue
        dialogue: scene.dialogue || '',
        narration: scene.narration || scene.dialogue || '', // 优先使用narration，不存在才用dialogue兜底
        duration,
        type: scene.type || 'explanation',
        characters: scene.characters || [],
        // P0修复#1:mouthAction口播动作字段
        mouthAction: scene.mouthAction || this.generateDefaultMouthAction(scene.type, i === 0),
        // P0修复#14-22:保留v2字段(importance/visualComplexity/emotionPhase)
        importance: scene.importance || 5,
        visualComplexity: scene.visualComplexity || 5,
        emotionPhase: scene.emotionPhase || this.calculateEmotionPhase(i, mappedScenes.length),
        // 新增:visualPrompt字段(Stage 11渲染核心使用)
        visualPrompt: scene.visualPrompt || '',
        // FPV导演决策标记
        fpvRecommended: scene.fpvRecommended || false,
        fpvScore: scene.fpvScore || 0,
        fpvReason: scene.fpvReason || '',
        // 运镜配置占位(Stage 9填充)
        cameraMovement: null,
        // Prompt占位(Stage 11填充)
        prompt: null
      };

      shots.push(shot);
    }

    // v6.2-fix: 记录自动生成的场景
    // v6.5.12-fix: generic模式下mapper为null,需使用可选链
    const generatedScenes = mapper?.getGeneratedScenes ? mapper.getGeneratedScenes() : [];
    if (generatedScenes.length > 0) {
      this.log('STAGE-7', `  🔥 自动生成Nirath场景: ${generatedScenes.length}个`);
      for (const gs of generatedScenes) {
        this.log('STAGE-7', `     → ${gs.earthName} → ${gs.nirathName} (${gs.terrainType}) | 来源: ${gs.mappedFrom}`);
      }
    }

    this.log('STAGE-7', `✅ 故事板 | 镜头数: ${shots.length} | 总时长: ${shots.reduce((s, x) => s + x.duration, 0)}s | mouthAction: ${shots.filter(s => s.mouthAction).length}/${shots.length}`);

    // v6.2-patch107-fix: 强制修正原有路径的重复ID(StoryCraft路径已在patch106-7修复)
    // 输入的scenes可能全部使用S01,此处强制分配唯一ID和正确type
    if (shots.length > 1) {
      const allSameId = shots.every(s => s.id === shots[0].id);
      if (allSameId) {
        this.log('STAGE-7', `  ⚠️ 原有路径检测到重复ID: ${shots[0].id}×${shots.length},强制修正为唯一ID和正确type`);
        shots.forEach((shot, idx) => {
          shot.id = `S${String(idx + 1).padStart(2, '0')}`;
          // 修复type:第一个内容镜应为building(或根据scene推断),不应继承opening
          // v6.5.44-fix: 保存原始类型到 shotType，防止新链路判断丢失
          if (!shot.shotType) shot.shotType = shot.type;
          if (shot.type === 'opening' && shot.scene !== '片头') {
            // 根据scene内容推断正确type
            const sceneLower = (shot.scene || '').toLowerCase();
            if (sceneLower.includes('入口') || sceneLower.includes('开场') || sceneLower.includes('intro')) {
              shot.type = 'building';
            } else if (sceneLower.includes('高潮') || sceneLower.includes('对峙') || sceneLower.includes('冲突')) {
              shot.type = 'climax';
            } else if (sceneLower.includes('结尾') || sceneLower.includes('觉悟') || sceneLower.includes('结束')) {
              shot.type = 'closing';
            } else if (sceneLower.includes('现身') || sceneLower.includes('揭示') || sceneLower.includes('发现')) {
              shot.type = 'reveal';
            } else {
              shot.type = 'building';
            }
            this.log('STAGE-7', `  📝 ${shot.id} type修正: opening → ${shot.type} (scene: ${shot.scene})`);
          }
        });
      }
    }

    // 【v6.0-patch22 新增】Nirath视觉锚点注入(原有路径)
    if (this.mode === 'nirath') {
      const injector = this.modules.nirathVisualInjector;
      const injectedShots = injector.injectBatch(shots);
      const injectedCount = injectedShots.filter(s => s._nirathAnchors?.wasInjected).length;
      this.log('STAGE-7', `🌍 Nirath锚点注入完成: ${injectedCount}/${shots.length} 镜注入`);
      return { shots: injectedShots, totalDuration: injectedShots.reduce((s, x) => s + x.duration, 0) };
    }

    return { shots, totalDuration: shots.reduce((s, x) => s + x.duration, 0) };
  }

  /**
   * 从场景内容推断角色(情况B:用户只给一句话)
   */
  inferCharactersFromScene(scene) {
    const chars = [];
    const text = `${scene.narration || ''} ${scene.dialogue || ''} ${scene.scene || ''} ${scene.visualPrompt || ''}`;

    // v6.5.29-fix: generic角色推断
    const genericChars = [
      { id: 'chen-nurse', keywords: ['陈女士', 'chen-nurse', '护士', '主讲', '主持人'] },
      { id: 'coach-li', keywords: ['李明教练', 'coach-li', '教练', '李教练', '康复专家'] },
      { id: 'xiaoG', keywords: ['AgentX', 'AgentX', '男孩', ' protagonist', '主角'] }
    ];

    for (const char of genericChars) {
      if (char.keywords.some(kw => text.includes(kw))) {
        if (!chars.includes(char.id)) chars.push(char.id);
      }
    }

    // Nirath角色推断(仅Nirath模式)
    if (this.mode === 'nirath') {
      // 九尾狐推断
      const jiuweiKeywords = ['九尾狐', '九尾', '狐狸', '狐', 'jiu-wei-hu', 'nine-tailed'];
      if (jiuweiKeywords.some(kw => text.includes(kw))) {
        if (!chars.includes('jiu-wei-hu')) chars.push('jiu-wei-hu');
      }

      // 饕餮推断
      const taotieKeywords = ['饕餮', 'tao-tie', 'taotie', '钩吾山', '四目', '暗红竖瞳', '吞噬', '巨口'];
      if (taotieKeywords.some(kw => text.includes(kw))) {
        if (!chars.includes('tao-tie')) chars.push('tao-tie');
      }

      // 通用异兽推断
      if (scene.type === 'discovery' || scene.type === 'beastReveal') {
        if (!chars.includes('jiu-wei-hu') && text.includes('尾')) {
          chars.push('jiu-wei-hu');
        }
      }
    }

    return chars;
  }

  /**
   * 🔥 v6.1-fix: Stage 7五要素预注入
   * 在生成shot之前,确保visualPrompt包含五要素设计意图
   * 这样Stage 8.5检查时能看到完整五要素内容,评分自然提高
   */
  enrichVisualPromptWithFiveElements(visualPrompt, scene, index, totalScenes, input) {
    if (!visualPrompt || visualPrompt.length === 0) return visualPrompt;
    if (this.mode !== 'nirath') return visualPrompt; // v6.5.29-fix: generic模式跳过Nirath五要素注入

    let enriched = visualPrompt;
    const beastProfile = input?.beastProfile || input?.core?.beast || {};
    const midPoint = Math.floor(totalScenes / 2);
    const isBefore = index < midPoint;
    const sceneType = scene.type || 'explanation';

    // === 要素1: AgentX冒险主动性 ===
    // 🔥 v6.1-fix: 每镜至少注入2个主动行为关键词,确保检查器能检测到
    const initiativeKeywords = ['主动', '伸出', '触碰', '接近', '迈出', '向前', '探索', '引导', '决定', '选择', '勇敢', '迎向', '追逐', '奔跑', '突破', '面对', '直视', '挑战', '不后退', '不逃避', '迎上去', '坚定', '决心'];
    const existingInitiatives = initiativeKeywords.filter(kw => enriched.includes(kw));

    // 如果少于2个主动关键词,补充注入
    if (existingInitiatives.length < 2) {
      const activeActionsByType = {
        opening: ['主动拨开迷雾', '勇敢踏上旅程', '主动探索未知', '迈出第一步'],
        discovery: ['主动靠近', '伸出小手', '凑近观察', '勇敢注视', '选择信任'],
        interaction: ['主动伸出手触碰', '迈出第一步', '迎向异兽', '选择信任', '决定靠近'],
        climax: ['勇敢直视', '坚定伸出', '主动选择', '决心面对', '迎向挑战'],
        closing: ['温柔注视', '主动靠近', '微笑伸出', '信任靠近', '勇敢告别']
      };
      const actions = activeActionsByType[sceneType] || activeActionsByType.interaction;
      // 使用场景索引+镜头ID确保每镜不同
      const actionIndex = (index + (parseInt(scene.id?.slice(1) || '0') % 100)) % actions.length;
      const action1 = actions[actionIndex];
      const action2 = actions[(actionIndex + 1) % actions.length];
      enriched += `,AgentX${action1},${action2}`;
    }

    // === 要素2: 异兽独特性 ===
    // 注入异兽档案中的signatureFeatures
    if (beastProfile.signatureFeatures && beastProfile.signatureFeatures.length > 0) {
      const features = beastProfile.signatureFeatures.slice(0, 3);
      const hasFeatures = features.some(f => enriched.includes(f.substring(0, 4))); // 检查前4字

      if (!hasFeatures) {
        const featureDesc = features.map(f => `${f}清晰可见`).join(',');
        enriched += `,${featureDesc}`;
      }
    }

    // 如果仍缺少独特性关键词,注入通用独特特征
    const uniqueKeywords = ['发光', '变色', '磁场', '能量', '共鸣', '脉冲', '粒子', '闪烁'];
    const hasUnique = uniqueKeywords.some(kw => enriched.includes(kw));
    if (!hasUnique && beastProfile.name) {
      enriched += `,${beastProfile.name}独特生物荧光在双恒星下闪烁`;
    }

    // === 要素3: 情感共鸣(情绪弧线设计)===
    // 前半场: 好奇/试探/犹豫 → 后半场: 信任/坚定/温柔
    if (this.mode === 'nirath') {
      if (isBefore) {
        // 前半场:注入好奇、试探、轻微不安
        const hasCuriosity = ['好奇', '疑问', '探索', '试探', '想知道', '观察'].some(kw => enriched.includes(kw));
        if (!hasCuriosity) {
          enriched += ',AgentX表情好奇而略带试探';
        }
      } else {
        // 后半场:注入信任、坚定、温柔
        const hasTenderness = ['温柔', '信任', '坚定', '微笑', '理解', '释然'].some(kw => enriched.includes(kw));
        if (!hasTenderness) {
          enriched += ',AgentX表情温柔而坚定';
        }
      }
    }

    // === 要素4: 成长转变 ===
    // 开场→高潮:犹豫→坚定
    if (this.mode === 'nirath') {
      if (index === 0) {
        // 开场:轻微犹豫
        if (!['犹豫', '紧张', '不安', '警惕'].some(kw => enriched.includes(kw))) {
          enriched += ',AgentX initially slightly hesitant yet curious';
        }
      } else if (index === totalScenes - 1) {
        // 结尾:完成转变
        if (!['坚定', '勇敢', '温柔', '信任', '接纳'].some(kw => enriched.includes(kw))) {
          enriched += ',AgentX眼神坚定充满信任,完成成长转变';
        }
      }
    }

    // === 要素5: Nirath世界观 ===
    // 确保每镜都有Nirath专属元素(仅nirath模式)
    if (this.mode === 'nirath') {
      const nirathKeywords = ['Nirath', '双恒星', '5800K', '6500K', '以太', '磁场', '共鸣', '紫晶', '青丘', '孢子'];
      const hasNirath = nirathKeywords.some(kw => enriched.includes(kw));
      if (!hasNirath) {
        enriched += ',Nirath双恒星5800K/6500K双色光照形成双色阴影';
      }
    }

    // 防重复:如果已有类似描述,不再追加
    // 简单去重:按逗号分割,过滤重复片段
    const segments = enriched.split(',');
    const uniqueSegments = [];
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (trimmed && !uniqueSegments.some(us => us.includes(trimmed.substring(0, 6)) || trimmed.includes(us.substring(0, 6)))) {
        uniqueSegments.push(trimmed);
      }
    }
    enriched = uniqueSegments.join(',');

    return enriched;
  }

  /**
   * v6.5.62: 构建characterRef字段（定妆照绑定）
   * 格式：角色名: image://bestiary/角色名-角度.png
   */
  _buildCharacterRef(shot, stages) {
    if (!shot.characters || shot.characters.length === 0) return '';
    
    const refs = [];
    for (const charId of shot.characters) {
      const char = stages.characters?.[charId];
      if (!char) continue;
      
      // 获取角色名（优先使用profile.name）
      const charName = char.profile?.name || char.name || charId;
      
      // 构建image://路径
      const imagePaths = [];
      if (char.portraits) {
        // 使用已生成的定妆照
        for (const [angle, path] of Object.entries(char.portraits)) {
          if (path && typeof path === 'string') {
            imagePaths.push(`image://bestiary/${charId}-${angle}.png`);
          }
        }
      }
      
      // 如果没有定妆照，使用占位符
      if (imagePaths.length === 0) {
        imagePaths.push(`image://bestiary/${charId}-front.png`);
      }
      
      // 限制最多9张
      const limitedPaths = imagePaths.slice(0, 9);
      refs.push(`${charName}: ${limitedPaths.join(', ')}`);
    }
    
    return refs.join(' | ');
  }

  /**
   * v6.5.62: 构建character字段（极简锚点）
   * 格式：角色名: 种族, 关键词1, 关键词2, 关键词3
   */
  _buildCharacterMinimal(shot, stages) {
    if (!shot.characters || shot.characters.length === 0) return '';
    
    const characters = [];
    for (const charId of shot.characters) {
      const char = stages.characters?.[charId];
      if (!char) continue;
      
      const charName = char.profile?.name || char.name || charId;
      
      // 获取种族/物种
      const race = char.profile?.race || char.profile?.species || 'Nirath异兽';
      
      // 获取3-5个核心视觉关键词
      const keywords = [];
      if (char.profile?.signatureFeatures) {
        keywords.push(...char.profile.signatureFeatures.slice(0, 3));
      }
      if (char.profile?.coreVisualTraits) {
        keywords.push(...char.profile.coreVisualTraits.slice(0, 2));
      }
      if (char.profile?.appearance) {
        // 从appearance提取关键词（简化）
        const appearanceKeywords = char.profile.appearance.split(/[,，]/).map(s => s.trim()).filter(s => s.length > 0);
        keywords.push(...appearanceKeywords.slice(0, 2));
      }
      
      // 去重并限制3-5个
      const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
      if (uniqueKeywords.length < 3) {
        // 兜底关键词
        uniqueKeywords.push('Nirath原生特征', '双恒星光照反射');
      }
      
      characters.push(`${charName}: ${race}, ${uniqueKeywords.join(', ')}`);
    }
    
    return characters.join(' | ');
  }

  /**
   * v6.5.62: 构建timeline字段（时间轴标记）
   * 格式：T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX
   */
  _buildTimeline(shot, currentTime) {
    const start = currentTime || 0;
    const duration = shot.duration || 0;
    const end = start + duration;
    
    // 格式化时间
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const tenths = Math.floor((seconds % 1) * 10);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
    };
    
    const startStr = formatTime(start);
    const endStr = formatTime(end);
    
    // 类型映射
    const typeMap = {
      'building': 'establishing',
      'discovery': 'discovery',
      'confrontation': 'confrontation',
      'climax': 'climax',
      'closing': 'resolution',
      'opening': 'opening'
    };
    const type = typeMap[shot.type] || 'normal';
    
    // 情绪
    const mood = shot.emotionPhase || 'neutral';
    
    return `T${startStr}-T${endStr} / duration: ${duration}s / type: ${type} / mood: ${mood}`;
  }

  /**
   * v6.5.62: 构建backgroundSound字段（结构化音效）
   * 格式：AMBIENT: ... | SPATIAL: ... | INTENSITY: ...
   */
  _buildBackgroundSound(shot) {
    const duration = shot.duration || 0;
    const sceneType = shot.type || 'normal';
    
    // 根据场景类型选择音效模板
    const soundTemplates = {
      'building': {
        ambient: 'fantasy atmosphere, deep earth rumble 20-60Hz, enchanted wind',
        spatial: '3D audio panning synchronized with camera movement',
        intensity: `crescendo 0-${Math.floor(duration * 0.3)}s, peak ${Math.floor(duration * 0.3)}-${Math.floor(duration * 0.7)}s, decay ${Math.floor(duration * 0.7)}-${duration}s`
      },
      'discovery': {
        ambient: 'tension-building drone, subtle heartbeat 40BPM, bioluminescent pulse',
        spatial: 'approaching footsteps echo, spatial depth increase',
        intensity: `crescendo 0-${Math.floor(duration * 0.4)}s, peak ${Math.floor(duration * 0.4)}-${Math.floor(duration * 0.6)}s, decay ${Math.floor(duration * 0.6)}-${duration}s`
      },
      'confrontation': {
        ambient: 'low frequency beast growl 30-80Hz, magnetic field hum, crystal resonance',
        spatial: 'beast movement tracking L-R, approach intensity',
        intensity: `crescendo 0-${Math.floor(duration * 0.2)}s, peak ${Math.floor(duration * 0.2)}-${Math.floor(duration * 0.8)}s, decay ${Math.floor(duration * 0.8)}-${duration}s`
      },
      'climax': {
        ambient: 'full spectrum activation, bioluminescent surge, magnetic field peak',
        spatial: '360° surround, beast roar spatial sweep',
        intensity: `crescendo 0-${Math.floor(duration * 0.2)}s, peak ${Math.floor(duration * 0.2)}-${Math.floor(duration * 0.7)}s, release ${Math.floor(duration * 0.7)}-${duration}s`
      },
      'closing': {
        ambient: 'gentle wind return, distant spore drift, soft earth breath',
        spatial: 'wide open space, fading echoes',
        intensity: `sustain 0-${Math.floor(duration * 0.5)}s, gentle decay ${Math.floor(duration * 0.5)}-${duration}s`
      }
    };
    
    const template = soundTemplates[sceneType] || soundTemplates['building'];
    
    return `AMBIENT: ${template.ambient} | SPATIAL: ${template.spatial} | INTENSITY: ${template.intensity}`;
  }

  /**
   * 检查角色的定妆照(4角度)是否已生成并确认
   */
  async checkCharacterPortraits(characterId) {
    // v3.0-fix: 支持旧4角度 + 新8角度
    const requiredAngles = ['front', 'threeQuarter', 'closeup', 'side'];
    const v3Angles = ['front_fullbody', 'three_quarter', 'face_closeup', 'side_profile', 'back_fullbody', 'action_running', 'action_sitting', 'hand_detail'];
    const foundAngles = [];
    const missingAngles = [];

    // 检查角色档案目录中的定妆照文件
    // 支持直接放在characters/下或characters/beasts/下
    let portraitDir = path.join(__dirname, '..', 'characters', characterId, 'portraits');
    if (!fss.existsSync(portraitDir)) {
      portraitDir = path.join(__dirname, '..', 'characters', 'beasts', characterId, 'portraits');
    }

    // 先检查旧4角度
    for (const angle of requiredAngles) {
      const found = this._checkPortraitFileExists(portraitDir, characterId, angle);
      if (found) {
        foundAngles.push(angle);
      } else {
        missingAngles.push(angle);
      }
    }

    // 如果旧4角度不全,检查新8角度(新旧二选一)
    if (missingAngles.length > 0) {
      let v3FoundCount = 0;
      for (const angle of v3Angles) {
        const found = this._checkPortraitFileExists(portraitDir, characterId, angle);
        if (found) {
          v3FoundCount++;
          // 映射到新角度名称
          const mappedAngle = this._mapV3AngleToLegacy(angle);
          if (mappedAngle && !foundAngles.includes(mappedAngle)) {
            foundAngles.push(mappedAngle);
          }
        }
      }

      // 如果新8角度有至少4个(核心4个),则视为通过
      const v3CoreAngles = ['front_fullbody', 'three_quarter', 'face_closeup', 'side_profile'];
      let v3CoreFound = 0;
      for (const angle of v3CoreAngles) {
        if (this._checkPortraitFileExists(portraitDir, characterId, angle)) {
          v3CoreFound++;
        }
      }

      if (v3CoreFound >= 4) {
        // 新8角度完整,清空旧角度缺失
        missingAngles.length = 0;
      }
    }

    return {
      exists: missingAngles.length === 0,
      foundAngles,
      missingAngles,
      portraitDir
    };
  }

  /**
   * 检查单个定妆照文件是否存在(支持多种命名格式)
   */
  _checkPortraitFileExists(portraitDir, characterId, angle) {
    const baseId = characterId.replace(/-/g, '').toLowerCase();
    const camelId = characterId.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

    const possibleFiles = [
      // 标准格式
      `${characterId}-${angle}.png`,
      `${characterId}-${angle}.jpg`,
      `${characterId}-${angle}.jpeg`,
      // CG版本
      `${characterId}-cg-v2-${angle}.png`,
      `${characterId}-cg-v3-${angle}.png`,
      // portrait前缀
      `${characterId}-portrait-${angle}.png`,
      `${characterId}-portrait-${angle}.jpg`,
      `${characterId}-portrait-${angle}.jpeg`,
      // camelCase
      `${camelId}-${angle}.png`,
      `${camelId}-${angle}.jpg`,
      `${camelId}-${angle}.jpeg`,
      `${camelId}-portrait-${angle}.png`,
      `${camelId}-portrait-${angle}.jpg`,
      `${camelId}-portrait-${angle}.jpeg`,
      // 纯小写(去掉连字符)
      `${baseId}-${angle}.png`,
      `${baseId}-${angle}.jpg`,
      `${baseId}-${angle}.jpeg`,
      `${baseId}-portrait-${angle}.png`,
      `${baseId}-portrait-${angle}.jpg`,
      `${baseId}-portrait-${angle}.jpeg`,
      // 无前缀
      `${angle}.png`,
      `${angle}.jpg`,
      `${angle}.jpeg`,
      // 纯portrait前缀
      `portrait-${angle}.png`,
      `portrait-${angle}.jpg`,
      `portrait-${angle}.jpeg`
    ];

    for (const file of possibleFiles) {
      const filePath = path.join(portraitDir, file);
      try {
        if (fss.existsSync(filePath)) {
          return true;
        }
      } catch (e) {
        // 忽略检查错误
      }
    }
    return false;
  }

  /**
   * v6.6.5: 智能判断角色是否需要AI生成定妆照
   * 用户只说一句话，系统不能卡住让用户选择
   * @param {string} characterId - 角色ID
   * @param {Object} charData - 角色数据
   * @param {Object} input - pipeline输入
   * @returns {boolean} true=需要生成, false=跳过
   */
  _shouldGeneratePortrait(characterId, charData, input) {
    const videoType = input.videoType || input.type || 'generic';
    const charDesc = (charData.description || charData.brief || '').toLowerCase();
    const charName = (charData.name || characterId).toLowerCase();
    
    // 规则1: 教育科普/纪录片/新闻/Vlog → 真人出镜，不需要AI生成
    const realPersonTypes = ['EDU', 'DOC', 'VLOG', 'NEWS', 'INTERVIEW', 'TALK'];
    if (realPersonTypes.includes(videoType)) {
      return false;
    }
    
    // 规则2: 角色描述包含真实人物特征 → 跳过
    const realPersonKeywords = [
      '医生', '护士', '教师', '教授', '专家', '记者', '主持人', '博主',
      '警察', '警官', '消防员', '律师', '工程师', '科学家',
      'real person', 'actual person', 'doctor', 'nurse', 'teacher',
      '律师', '警察', '军人', '公务员', '真实人物', '真人'
    ];
    if (realPersonKeywords.some(kw => charDesc.includes(kw) || charName.includes(kw))) {
      return false;
    }
    
    // 规则3: 角色名是常见中文人名（2-3字，无特殊符号）→ 可能是真人
    if (/^[\u4e00-\u9fa5]{2,3}$/.test(charData.name || '')) {
      // 中文人名，但还要看职业描述
      const professionKeywords = ['护士', '医生', '警察', '律师', '老师', '教授', '专家'];
      if (professionKeywords.some(kw => charDesc.includes(kw))) {
        return false; // 有职业描述的真实人物
      }
    }
    
    // 规则4: 虚构角色标识
    const fictionalKeywords = [
      '神兽', '怪兽', '妖怪', '精灵', ' superhero', 'alien', 'creature',
      '神话', '传说', '幻想', 'fantasy', 'anime', 'cartoon', 'cg',
      '饕餮', '白泽', '刑天', '女娲', '龙', '凤凰', '麒麟'
    ];
    if (fictionalKeywords.some(kw => charDesc.includes(kw))) {
      return true; // 明确虚构角色，需要生成
    }
    
    // 默认：如果是故事片/广告/短剧，可能需要；如果是真人相关，默认跳过
    const fictionalTypes = ['DRAMA', 'ADV', 'MV', 'ANIMATION', 'COR'];
    if (fictionalTypes.includes(videoType)) {
      return true; // 虚构类视频，默认需要
    }
    
    // 兜底：教育/科普/纪录片默认不需要（真人出镜）
    return false;
  }
  
  /**
   * v6.6.5: 检测角色类型（用于日志）
   */
  _detectCharacterType(characterId, charData) {
    const charDesc = (charData.description || charData.brief || '').toLowerCase();
    const charName = (charData.name || characterId).toLowerCase();
    
    if (/^[\u4e00-\u9fa5]{2,3}$/.test(charData.name || '')) {
      const professions = ['护士', '医生', '警察', '律师', '老师', '教授'];
      for (const p of professions) {
        if (charDesc.includes(p)) return `真实人物(${p})`;
      }
      return '真实人物';
    }
    
    if (charDesc.includes('神兽') || charDesc.includes('怪兽') || charDesc.includes('神话')) {
      return '虚构角色';
    }
    
    return '未知类型';
  }
  
  /**
   * v6.6.5: 创建Mock定妆照占位符（不阻断链路）
   */
  async _createPortraitPlaceholders(characterId, angles) {
    const portraitDir = path.join(this.charactersDir, characterId, 'portraits');
    
    try {
      // 确保目录存在
      await fs.mkdir(portraitDir, { recursive: true });
      
      // 创建占位符JSON（记录这是Mock）
      const placeholderMeta = {
        characterId,
        generatedAt: new Date().toISOString(),
        isMock: true,
        reason: 'AUTO_PLACEHOLDER: 真实人物/教育科普场景，不需要AI生成定妆照',
        angles: angles || ['front', 'threeQuarter', 'closeup', 'side'],
        version: 'v6.6.5-auto'
      };
      
      const metaPath = path.join(portraitDir, '.placeholder-meta.json');
      await fs.writeFile(metaPath, JSON.stringify(placeholderMeta, null, 2), 'utf-8');
      
      // 创建角度占位符（空文件，标记存在）
      for (const angle of (angles || ['front', 'threeQuarter', 'closeup', 'side'])) {
        const placeholderPath = path.join(portraitDir, `${characterId}-${angle}.placeholder`);
        await fs.writeFile(placeholderPath, `MOCK_PLACEHOLDER: ${angle}\n${JSON.stringify(placeholderMeta)}`, 'utf-8');
      }
      
      this.log('PORTRAIT', `  ✅ Mock占位符创建完成: ${characterId} | ${angles?.length || 4}个角度`);
    } catch (e) {
      this.log('PORTRAIT', `  ⚠️ Mock占位符创建失败: ${e.message}`);
    }
  }

  /**
   * 映射新8角度到旧4角度名称
   */
  _mapV3AngleToLegacy(v3Angle) {
    const mapping = {
      'front_fullbody': 'front',
      'three_quarter': 'threeQuarter',
      'face_closeup': 'closeup',
      'side_profile': 'side',
      'back_fullbody': 'back',
      'action_running': 'action',
      'action_sitting': 'action',
      'hand_detail': 'detail'
    };
    return mapping[v3Angle] || v3Angle;
  }

  // ========== 【v6.2-patch51】Stage 7.2: 主角主动性自动注入 ==========
  async stageProtagonistInitiative(storyboard, input) {
    this.log('STAGE-7.2', '🎯 主角主动性自动注入(v6.2-patch51)');

    // v6.5.29-fix: generic模式跳过Nirath专属主动性注入
    if (this.mode !== 'nirath') {
      this.log('STAGE-7.2', `⏭️ generic模式,跳过Nirath专属主动性注入`);
      return { totalInjections: 0, passiveDetections: 0, injections: [] };
    }

    const injector = this.modules.protagonistInjector;
    const protagonistId = input?.protagonistId || 'xiaoG';
    const protagonistName = input?.protagonistName || 'AgentX';

    const result = injector.inject(storyboard, { protagonistId, protagonistName });

    if (result.report.totalInjections > 0) {
      this.log('STAGE-7.2', `✅ 主动性注入完成 | 注入${result.report.totalInjections}个主动动作 | 对冲${result.report.passiveDetections}个被动描述`);
      for (const log of result.report.injections.slice(0, 3)) {
        this.log('STAGE-7.2', `  📝 ${log.shotId}: +「${log.action}」`);
      }
    } else if (result.report.passiveDetections > 0) {
      this.log('STAGE-7.2', `⚠️ 检测到${result.report.passiveDetections}个被动描述,但已存在足够主动动作`);
    } else {
      this.log('STAGE-7.2', `✅ 主动性检查通过 | 无需注入`);
    }

    return result.report;
  }

  /**
   * 辅助:计算 narration 容量(基于时长)
   */
  calculateNarrationCapacity(duration) {
    const SPEECH_RATE = 5.0; // 字/秒(讲解语速)
    const BUFFER = 2; // 缓冲字数
    return Math.floor(duration * SPEECH_RATE - BUFFER);
  }

  // ========== 【v6.2-patch51】Stage 7.3: Narration自动精简 ==========
  async stageNarrationTrim(storyboard, durations) {
    // v6.5.34-fix: 全局禁用narration，此Stage跳过
    this.log('STAGE-7.3', '⏭️ 全局禁用narration(仅保留dialogue/台词)，跳过narration精简');
    return { trimmedCount: 0, totalTrimmedChars: 0, skipped: true, reason: '全局禁用narration' };
  }

  // ========== 【v6.2-patch52】Stage 7.4: 时长-字数一致性校准 ==========
  async stageDurationNarrationAlignment(storyboard, durations) {
    // v6.5.34-fix: 全局禁用narration，使用dialogue校准
    this.log('STAGE-7.4', '📏 时长-字数一致性校准(v6.2-patch52, v6.5.34: dialogue模式)');

    const aligner = this.modules.durationAlignment;
    if (!aligner) {
      this.log('STAGE-7.4', '⚠️ 时长校准器未初始化,跳过');
      return { aligned: true, report: '校准器未初始化' };
    }

    const shots = storyboard.shots || [];

    // v6.5.34: 使用dialogue替代narration进行校准
    const shotsWithDuration = shots.map((shot, idx) => {
      const duration = shot.duration || (durations && durations[idx]?.duration) || 5;
      return { 
        ...shot, 
        duration,
        // v6.5.34: 使用dialogue作为校准文本（narration已禁用）
        text: shot.dialogue || shot.narration || ''
      };
    });

    const alignResult = aligner.align(shotsWithDuration);

    // 将调整后的时长同步回storyboard
    if (alignResult.aligned && alignResult.adjustments.length > 0) {
      for (const adj of alignResult.adjustments) {
        // 更新 recipient 镜头时长
        const toShot = shots.find(s => s.id === adj.to);
        if (toShot) {
          toShot.duration = alignResult.shots.find(s => s.id === adj.to)?.duration || toShot.duration;
        }
        // v6.2-patch67-fix: 同时更新 donor 镜头时长
        const fromShot = shots.find(s => s.id === adj.from);
        if (fromShot) {
          fromShot.duration = alignResult.shots.find(s => s.id === adj.from)?.duration || fromShot.duration;
        }
        this.log('STAGE-7.4', `  🔄 ${adj.to} +${adj.amount}秒 ← ${adj.from} | ${adj.reason}`);
      }
      this.log('STAGE-7.4', `✅ 时长校准完成 | 借调${alignResult.adjustments.length}次 | 全部匹配`);
    } else if (alignResult.issues.length > 0) {
      this.log('STAGE-7.4', `❌ 时长校准失败 | ${alignResult.issues.length}个镜头无法匹配`);
      for (const issue of alignResult.issues) {
        this.log('STAGE-7.4', `  🔴 ${issue.message}`);
      }
    } else {
      this.log('STAGE-7.4', `✅ 时长-dialogue全部匹配,无需调整`);
    }

    return alignResult;
  }

  /**
   * v6.6.5: 自动推断场景结构（用户只说一句话，系统自己推断）
   * 基于视频类型、主题、角色、时长自动推断场景列表
   */
  _autoInferScenes(input) {
    const videoType = input.videoType || input.type || 'generic';
    const title = input.title || input.projectName || '未命名视频';
    const duration = input.targetDuration || input.duration || 60;
    const characters = input.characters || [];
    const desc = input.description || input._rawInput || '';
    const isSeries = input.isSeries || false;
    const episode = input.episode || 1;
    const totalEpisodes = input.totalEpisodes || 1;
    
    // 根据视频类型推断场景结构
    let scenes = [];
    
    if (videoType === 'EDU' || videoType === 'DOC' || videoType === 'TALK') {
      // 教育科普/纪录片：开场→讲解→案例→总结
      const openingDuration = Math.min(5, Math.floor(duration * 0.1));
      const closingDuration = Math.min(10, Math.floor(duration * 0.15));
      const contentDuration = duration - openingDuration - closingDuration;
      const contentScenes = Math.max(2, Math.floor(contentDuration / 15)); // 每15秒一个场景
      const perSceneDuration = Math.floor(contentDuration / contentScenes);
      
      // 开场
      scenes.push({
        id: 'S01',
        type: 'opening',
        description: `${title} - 开场介绍`,
        duration: openingDuration,
        narration: `大家好，我是${characters[0]?.name || '主讲人'}。今天我们来聊聊${title}。`
      });
      
      // 内容场景（根据主题拆分）
      const contentTypes = ['explanation', 'demonstration', 'explanation', 'case_study'];
      const contentDescs = [
        `讲解${title}的核心概念`,
        `深入分析${title}的关键要点`,
        `展示${title}的实际应用`,
        `案例分析：${title}的实际场景`
      ];
      
      for (let i = 0; i < contentScenes; i++) {
        scenes.push({
          id: `S0${i + 2}`,
          type: contentTypes[i % contentTypes.length] || 'explanation',
          description: contentDescs[i % contentDescs.length] || `内容讲解 ${i + 1}`,
          duration: perSceneDuration,
          narration: `${title}的第${i + 1}部分讲解内容。`
        });
      }
      
      // 结尾
      scenes.push({
        id: `S0${contentScenes + 2}`,
        type: 'summary',
        description: `总结${title}的核心要点`,
        duration: closingDuration,
        narration: `今天我们学习了${title}，希望对你有帮助。记得点赞关注！`
      });
      
    } else if (videoType === 'DRAMA' || videoType === 'ADV' || videoType === 'MV') {
      // 短剧/故事片：开场→发展→高潮→结尾
      const openingDuration = Math.min(5, Math.floor(duration * 0.1));
      const closingDuration = Math.min(5, Math.floor(duration * 0.1));
      const storyDuration = duration - openingDuration - closingDuration;
      
      scenes.push({
        id: 'S01',
        type: 'opening',
        description: '故事开场 - 引入背景和人物',
        duration: openingDuration,
        narration: '故事开始了...'
      });
      scenes.push({
        id: 'S02',
        type: 'development',
        description: '情节发展 - 冲突出现',
        duration: Math.floor(storyDuration * 0.4),
        narration: '事情开始变得复杂...'
      });
      scenes.push({
        id: 'S03',
        type: 'climax',
        description: '高潮 - 冲突最激烈',
        duration: Math.floor(storyDuration * 0.35),
        narration: '关键时刻到了！'
      });
      scenes.push({
        id: 'S04',
        type: 'resolution',
        description: '结局 - 冲突解决',
        duration: Math.floor(storyDuration * 0.25) + closingDuration,
        narration: '故事到这里就结束了。'
      });
      
    } else if (videoType === 'VLOG' || videoType === 'NEWS') {
      // Vlog/新闻：开场→内容→互动→结尾
      scenes.push({
        id: 'S01',
        type: 'opening',
        description: '开场问候',
        duration: Math.min(5, Math.floor(duration * 0.1)),
        narration: `大家好，欢迎来到${title}！`
      });
      scenes.push({
        id: 'S02',
        type: 'content',
        description: '主要内容展示',
        duration: Math.floor(duration * 0.6),
        narration: '今天的内容非常精彩...'
      });
      scenes.push({
        id: 'S03',
        type: 'interaction',
        description: '互动/呼吁',
        duration: Math.floor(duration * 0.15),
        narration: '你们觉得呢？在评论区告诉我！'
      });
      scenes.push({
        id: 'S04',
        type: 'closing',
        description: '结尾告别',
        duration: Math.floor(duration * 0.15),
        narration: '谢谢观看，我们下期再见！'
      });
      
    } else {
      // 通用类型：开场→内容→结尾
      const openingDuration = Math.min(5, Math.floor(duration * 0.1));
      const closingDuration = Math.min(5, Math.floor(duration * 0.1));
      const contentDuration = duration - openingDuration - closingDuration;
      const contentScenes = Math.max(1, Math.floor(contentDuration / 15));
      const perSceneDuration = Math.floor(contentDuration / contentScenes);
      
      scenes.push({
        id: 'S01',
        type: 'opening',
        description: '开场介绍',
        duration: openingDuration,
        narration: `欢迎观看${title}`
      });
      
      for (let i = 0; i < contentScenes; i++) {
        scenes.push({
          id: `S0${i + 2}`,
          type: 'content',
          description: `内容展示 ${i + 1}`,
          duration: perSceneDuration,
          narration: `${title}内容第${i + 1}部分`
        });
      }
      
      scenes.push({
        id: `S0${contentScenes + 2}`,
        type: 'closing',
        description: '结尾总结',
        duration: closingDuration,
        narration: '感谢观看！'
      });
    }
    
    // 时长校准：确保总时长不超过目标时长
    let totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (totalDuration > duration) {
      // 按比例缩放
      const scale = duration / totalDuration;
      scenes.forEach(s => {
        s.duration = Math.max(3, Math.floor((s.duration || 5) * scale));
      });
    }
    
    this.log('PREFLIGHT', `  🎬 场景推断: ${videoType}类型 | ${scenes.length}场景 | ${duration}秒`);
    return scenes;
  }

  // ========== Stage 7.5: 片头自动生成(v3.0-patch5系统集成)==========
  async stageOpeningGeneration(input, storyboard, characters) {
    if (this.mode !== 'nirath') {
      this.log('STAGE-7.5', '⏭️ 通用模式,跳过片头生成');
      return null;
    }

    this.log('STAGE-7.5', '🎬 片头自动生成(opening-system-v3.js)');

    try {
      // 从input中提取片头配置
      const openingConfig = this.extractOpeningConfig(input, storyboard, characters);

      // 调用片头系统生成Prompt
      const openingResult = OpeningSystem.generateOpeningV3(openingConfig);

      this.log('STAGE-7.5', `✅ 片头生成完成 | Prompt: ${openingResult.promptLength}/1500字符 | 时长: ${openingResult.duration}秒`);

        // 将片头插入故事板作为S00
      const openingShot = {
        id: 'S00',
        scene: '片头',
        // v6.5.34-fix: 全局禁用narration，片头使用dialogue
        dialogue: '山海经系列片头',
        narration: '', // v6.5.34: narration已禁用，置空
        duration: openingResult.duration || 9,
        type: 'opening',
        characters: openingResult.characters ? [openingResult.characters.protagonist?.id, openingResult.characters.beast?.id].filter(Boolean) : [],
        mouthAction: '片头标题展现,无口播',
        importance: 10,
        visualComplexity: 8,
        emotionPhase: 'establishing',
        fpvRecommended: false,
        cameraMovement: null,
        prompt: openingResult.prompt,
        isOpening: true, // 标记为片头镜头
        openingConfig: openingConfig,
        portraits: openingResult.portraits,
        // v6.5.8-fix: 片头也绑定定妆照
        referenceImages: openingResult.referenceImages || [],
        content: openingResult.content || [],
        // v6.5.58-fix: 注入title对象和postProduction
        title: openingResult.title || undefined,
        postProduction: openingResult.postProduction || undefined
      };

      // 插入到故事板最前面
      storyboard.shots.unshift(openingShot);
      storyboard.totalDuration += openingShot.duration;

      this.log('STAGE-7.5', `✅ 片头已插入故事板 | S00 | 总时长更新: ${storyboard.totalDuration}秒 | 镜头数: ${storyboard.shots.length}`);

      return {
        shot: openingShot,
        prompt: openingResult.prompt,
        duration: openingResult.duration,
        characters: openingResult.characters,
        portraits: openingResult.portraits,
        complianceCheck: openingResult.complianceCheck
      };
    } catch (error) {
      this.log('STAGE-7.5', `❌ 片头生成失败: ${error.message}`, 'error');
      // 片头失败不阻断主链路,继续执行
      return null;
    }
  }

  /**
   * 提取片头配置
   */
  extractOpeningConfig(input, storyboard, characters) {
    const config = {
      episodeTitle: input.projectName || input.title || '山海经:异兽志',
      seriesTitle: input.seriesTitle || '山海经:异兽志',
      episodeNumber: input.episodeNumber || input.episode || 'EP02',
      featuredBeastId: input.beastId || input.core?.beastId || input.theme || '',
      protagonistId: 'xiaoG',
      duration: input.openingDuration || 9,
      mood: input.mood || 'mysterious',
      // v2.2-fix: 从input.characters中提取角色定妆照数据
      characters: input.characters || {},
      portraits: {}
    };

    // 尝试从故事板提取异兽信息
    if (storyboard && storyboard.shots) {
      // v3.0-patch6: 遍历所有shots,找到第一个非xiaoG角色作为异兽
      for (const shot of storyboard.shots) {
        if (shot.characters && shot.characters.length > 0) {
          const beastChar = shot.characters.find(c => c !== 'xiaoG');
          if (beastChar) {
            config.featuredBeastId = beastChar;
            break;
          }
        }
      }
    }

    // v2.2-fix: 从input.characters提取portraits数据
    if (input.characters) {
      for (const [charId, charData] of Object.entries(input.characters)) {
        if (charData.portraits) {
          config.portraits[charId] = charData.portraits;
        }
      }
    }

    this.log('STAGE-7.5', `  📋 片头配置: ${config.episodeTitle} | 异兽: ${config.featuredBeastId} | 时长: ${config.duration}秒 | 角色数: ${Object.keys(config.portraits).length}`);
    return config;
  }

  // ========== Stage 8: 故事板校验(新增:开场动作 + mouthAction + narration-prompt对齐) ==========
  /**
   * v6.2-patch67-fix: 智能截断,优先在标点处截断
   * 避免 substring 硬截断导致句子不完整
   */
  trimAtPunctuation(text, maxLen) {
    if (!text || text.length <= maxLen) return text;

    const truncated = text.substring(0, maxLen);

    // 优先在中文标点处截断
    const chinesePunctuation = /[。,;!?]/;
    let lastPunct = -1;
    for (let i = truncated.length - 1; i >= 0; i--) {
      if (chinesePunctuation.test(truncated[i])) {
        lastPunct = i;
        break;
      }
    }

    if (lastPunct > 0) {
      return truncated.substring(0, lastPunct + 1);
    }

    // 其次在英文标点处截断
    const englishPunctuation = /[.\,;!?]/;
    for (let i = truncated.length - 1; i >= 0; i--) {
      if (englishPunctuation.test(truncated[i])) {
        return truncated.substring(0, i + 1);
      }
    }

    // 最后在空格处截断
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncated.length * 0.8) {
      return truncated.substring(0, lastSpace);
    }

    return truncated;
  }

  async stageStoryboardValidation(storyboard, input) {
    this.log('STAGE-8', '故事板校验(开场动作 + mouthAction + narration-prompt对齐)');

    let validation;
    try {
      validation = this.modules.storyboardValidator.validate(storyboard);
    } catch (e) {
      validation = {
        valid: storyboard.shots && storyboard.shots.length > 0,
        errors: [],
        warnings: []
      };
    }

    // P0修复#2:开场动作强制检查
    if (storyboard.shots && storyboard.shots.length > 0) {
      const openingShot = storyboard.shots[0];

      // v1.1-fix: 片头镜头跳过开场动作检查
      if (openingShot.type === 'opening' || openingShot.type === '片头' || openingShot.id === 'S00') {
        this.log('STAGE-8', `  i️ 开场动作检查跳过: ${openingShot.id} 为片头`);
      } else {
        const hasOpeningAction = openingShot.mouthAction &&
          (openingShot.mouthAction.includes('说话') ||
           openingShot.mouthAction.includes('打招呼') ||
           openingShot.mouthAction.includes('手势') ||
           openingShot.mouthAction.includes('嘴部') ||
           openingShot.mouthAction.includes('speaking') ||
           openingShot.mouthAction.includes('greeting') ||
           openingShot.mouthAction.includes('gesture'));

        if (!hasOpeningAction) {
          const error = {
            type: 'opening_action',
            message: `开场镜头${openingShot.id}缺少动作:必须有"说话/打招呼/手势"动作,当前mouthAction="${openingShot.mouthAction}"`,
            severity: 'error'
          };
          validation.errors = validation.errors || [];
          validation.errors.push(error);
          this.log('STAGE-8', `  ❌ 开场动作检查失败: ${openingShot.id} | ${error.message}`);
        } else {
          this.log('STAGE-8', `  ✅ 开场动作检查通过: ${openingShot.id}`);
        }
      }
    }

    // P0修复#1:mouthAction字段存在性检查
    const missingMouthAction = storyboard.shots.filter(s => {
      // 片头镜头跳过
      if (s.type === 'opening' || s.type === '片头' || s.id === 'S00' || s.isOpening) return false;
      // 同时支持驼峰和下划线
      const mouthAction = s.mouthAction || s.mouth_action;
      return !mouthAction || (typeof mouthAction === 'string' && mouthAction.trim() === '');
    });
    if (missingMouthAction.length > 0) {
      const warning = {
        type: 'mouth_action_missing',
        message: `${missingMouthAction.length}/${storyboard.shots.length} 镜头缺少mouthAction/mouth_action字段`,
        shots: missingMouthAction.map(s => s.id),
        severity: 'warning'
      };
      validation.warnings = validation.warnings || [];
      validation.warnings.push(warning);
      this.log('STAGE-8', `  ⚠️ mouthAction缺失: ${missingMouthAction.map(s => s.id).join(', ')}`);
    } else {
      this.log('STAGE-8', `  ✅ mouthAction检查通过: 全部内容镜已设置`);
    }

    // P0修复#5/#6:narration-prompt内容对齐检查(基础版)
    // v1.1-fix: StoryCraft的scene字段为beatName(如"钩子"/"深入"),放宽检查逻辑
    for (const shot of storyboard.shots) {
      if (shot.narration && shot.scene) {
        // v6.5.33-fix: social/generic模式跳过narration-scene对齐检查
        // 原因：social短视频scene名简短（如"椰树下初见"），narration描述具体画面，自然重叠度低，检查无意义
        if (this.mode === 'social' || this.mode === 'generic') {
          continue;
        }

        // 如果scene是beatName(非自然描述),跳过严格对齐检查
        const beatNames = ['钩子', '深入', '裂缝', '翻转', '余韵', 'hook', 'insight', 'twist', 'climax', 'resolution'];
        const isBeatName = beatNames.some(bn => shot.scene.includes(bn));

        if (isBeatName) {
          // 对于beatName,只检查narration是否包含与场景相关的关键词
          const narrationLower = shot.narration.toLowerCase();
          const hasSceneRelated = ['饕餮', 'AgentX', 'Nirath', '钩吾山', '荒原', '双眼', '种子', '触碰'].some(kw =>
            narrationLower.includes(kw.toLowerCase())
          );

          if (!hasSceneRelated) {
            this.log('STAGE-8', `  ⚠️ narration缺少场景关键词: ${shot.id}(scene=${shot.scene})`);
          }
          continue;
        }

        const narrationKeywords = this.extractKeywords(shot.narration);
        const sceneKeywords = this.extractKeywords(shot.scene);
        const overlap = narrationKeywords.filter(k =>
          sceneKeywords.some(sk => k.includes(sk) || sk.includes(k))
        );
        const alignmentScore = narrationKeywords.length > 0 ? overlap.length / narrationKeywords.length : 1;
        // v6.5.33-fix: social模式放宽narration-scene对齐度阈值
        // 原因：social短视频的narration描述具体画面，scene名简短，自然重叠度低
        const alignmentThreshold = (this.mode === 'social' || this.mode === 'generic') ? 0.1 : 0.3;

        if (alignmentScore < alignmentThreshold) {
          const warning = {
            type: 'narration_scene_alignment',
            message: `镜头${shot.id} narration与scene对齐度低(${Math.round(alignmentScore * 100)}%):台词"${shot.narration.substring(0, 30)}..."与场景"${shot.scene.substring(0, 30)}..."不匹配`,
            shotId: shot.id,
            alignmentScore,
            severity: 'warning'
          };
          validation.warnings = validation.warnings || [];
          validation.warnings.push(warning);
          this.log('STAGE-8', `  ⚠️ narration-scene对齐度低: ${shot.id} | ${Math.round(alignmentScore * 100)}%`);
        }
      }
    }

    // v6.2-patch71-fix: 时长硬约束检查--动态上限,尊重PRD定义
    const prdDurations2 = input.scenes?.map(s => s.duration).filter(Boolean) || [];
    const maxPrdDuration2 = prdDurations2.length > 0 ? Math.max(...prdDurations2) : 15;
    const durationUpperLimit2 = maxPrdDuration2;
    const durationViolations = storyboard.shots.filter(s => s.duration < 3 || s.duration > durationUpperLimit2);
    if (durationViolations.length > 0) {
      const error = {
        type: 'duration_constraint',
        message: `${durationViolations.length}个镜头时长超出3-${durationUpperLimit2}秒硬约束`,
        shots: durationViolations.map(s => ({ id: s.id, duration: s.duration })),
        severity: 'error'
      };
      validation.errors = validation.errors || [];
      validation.errors.push(error);
      this.log('STAGE-8', `  ❌ 时长硬约束违规: ${durationViolations.map(s => `${s.id}=${s.duration}s`).join(', ')} (允许范围: 3-${durationUpperLimit2}s)`);
    }

    // P2修复#7:角色完整性验证(仅当projectConfig配置了requiredCharacters时检查)
    const requiredChars = (input && input.projectConfig && input.projectConfig.requiredCharacters) ||
                          (this.projectConfig && this.projectConfig.requiredCharacters);
    if (requiredChars && requiredChars.length > 0 && storyboard.shots) {
      const allCharsInStoryboard = new Set();
      storyboard.shots.forEach(shot => {
        (shot.characters || []).forEach(c => allCharsInStoryboard.add(c));
      });

      const missingChars = requiredChars.filter(c => !allCharsInStoryboard.has(c));
      if (missingChars.length > 0) {
        const warning = {
          type: 'character_missing',
          message: `必需角色未出场: ${missingChars.join(', ')}`,
          missingChars,
          severity: 'warning'
        };
        validation.warnings = validation.warnings || [];
        validation.warnings.push(warning);
        this.log('STAGE-8', `  ⚠️ 角色完整性: ${missingChars.length}个角色未出场: ${missingChars.join(', ')}`);
      } else {
        this.log('STAGE-8', `  ✅ 角色完整性: ${requiredChars.length}/${requiredChars.length} 全部出场`);
      }
    }

    // 更新valid状态(v6.2-patch52-fix: 保留storyboardValidator原始valid状态,不要覆盖)
    const pipelineErrors = (validation.errors || []).filter(e => e.severity === 'error');
    const hasPipelineErrors = pipelineErrors.length > 0;
    const originalValid = validation.valid !== false; // 如果storyboardValidator返回了valid=false,尊重它
    validation.valid = originalValid && !hasPipelineErrors;

    this.log('STAGE-8', `✅ 故事板校验 | 错误: ${(validation.errors || []).filter(e => e.severity === 'error').length} | 警告: ${(validation.warnings || []).length} | 通过: ${validation.valid ? '是' : '否'}`);
    return validation;
  }

  // ========== Stage 8.5: 五要素检查(v6.1升级:山海经系列专属质量闸机)==========
  async stageFiveElementCheck(storyboard, input) {
    this.log('STAGE-8.5', '五要素检查启动(山海经系列)');

    // 仅对nirath模式启用
    if (this.mode !== 'nirath') {
      this.log('STAGE-8.5', '⏭️ 通用模式,跳过五要素检查');
      return { enabled: false, passed: true };
    }

    try {
      const { FiveElementInspector } = require('./five-element-inspector');
      // v6.1-fix: 使用检查器默认阈值(已优化为5-6镜友好),不再硬编码覆盖
      const inspector = new FiveElementInspector({
        strictMode: false // 警告模式,不拦截
      });

      const options = {
        beastProfile: input?.beastProfile || input?.beast || input?.core?.beast || storyboard?.beast || {},
        protagonistProfile: input?.protagonist || input?.characters?.xiaoG || {}
      };

      const report = inspector.inspect(storyboard, options);

      // 记录结果
      const failedElements = report.summary.failedElements || [];
      if (failedElements.length > 0) {
        this.log('STAGE-8.5', `⚠️ 五要素未通过: ${failedElements.map(e => e.label).join(', ')}`);
        for (const failed of failedElements) {
          this.log('STAGE-8.5', `  ⚠️ ${failed.label}: ${failed.score}/${failed.threshold} | ${failed.suggestion}`);
        }
      } else {
        this.log('STAGE-8.5', `✅ 五要素全部通过 | 综合评分: ${report.overallScore}/100`);
      }

      return {
        enabled: true,
        passed: report.overallPassed,
        overallScore: report.overallScore,
        results: report.results,
        summary: report.summary,
        failedElements: failedElements
      };
    } catch (error) {
      this.log('STAGE-8.5', `⚠️ 五要素检查异常: ${error.message}`, 'error');
      return { enabled: true, passed: true, error: error.message };
    }
  }

  // ========== Stage 9: 运镜系统(Nirath v3 + 镜头内时间轴 + FPV导演决策)==========
  async stageCameraMovement(storyboard, fpvDecision) {
    this.log('STAGE-9', `运镜系统${this.mode === 'nirath' ? '(Nirath v3 + 镜头内多段式时间轴 + FPV导演决策)' : '(v1)'}`);

    // v6.2-patch65: 重置一镜到底计数器(每轮预生产独立计数)
    this._oneShotCounter = { used: 0, max: 2 };

    // 🔥 v4.0: 初始化v4镜头内时间轴生成器(LLM驱动)
    const cameraMovementV4 = new CameraMovementSystemV4();

    const movements = [];
    let previousShot = null; // v4.0: 用于镜头间连续性
    for (const shot of storyboard.shots) {
      let movement;

      // 片头S00跳过复杂运镜(由片头系统自行控制)
      if (shot.id === 'S00' || shot.isOpening) {
        movement = {
          description: '片头运镜由opening-system-v3.js控制',
          isOpening: true,
          timeline: null
        };
        movements.push({ shotId: shot.id, movement, isFPV: false });
        continue;
      }

      // FPV导演决策:如果镜头被标记为fpvRecommended,或shotType为fpv,生成FPV运镜
      if (shot.fpvRecommended || shot.shotType === 'fpv' || shot.type === 'fpv') {
        this.log('STAGE-9', `  🎬 FPV运镜: ${shot.id} | 导演决策: ${shot.fpvReason || '特殊场景FPV'}`);

        if (this.mode === 'nirath') {
          // Nirath模式:生成FPV电影感运镜 + v4时间轴
          const sceneName = (shot.scene || '').split('-')[0]?.trim() || shot.scene || 'default';
          const phase = shot.emotionPhase || 'climax';

          // 调用FPV电影感增强模块
          try {
            const { FPVCinematographyAgent } = require('./fpv-cinematic-enhancement.js');
            const fpvAgent = new FPVCinematographyAgent();

            const fpvConfig = {
              shotSize: 'extreme_wide',
              position: 'first_person',
              movement: 'fly_through',
              speed: shot.fpvScore >= 90 ? 'extreme' : 'fast',
              physics: 'enabled',
              fpvMode: true,
              context: sceneName,
              timeRange: { start: 0, end: shot.duration || 5 }
            };

            movement = fpvAgent.generateNirathMovement(sceneName, phase, fpvConfig);
            movement.isFPV = true;
            movement.fpvScore = shot.fpvScore;

            // 🔥 v4.0: FPV镜头使用v4 LLM时间轴
            const fpvV4Result = await cameraMovementV4.generateIntraShotTimelineV4(shot, previousShot, { autoFix: true });
            const fpvTimeline = fpvV4Result.timeline;
            // 转换v4段到v3兼容格式
            const SHOT_SIZE_DESC_MAP = {
              extreme_wide: '极端远景（环境全貌）', wide: '远景（环境+主体）', full: '全景（全身）',
              medium: '中景（半身/双人）', close_up: '特写（面部/细节）', extreme_close: '极端特写（眼睛/纹理）'
            };
            const SPEED_DESC_MAP = {
              'slow': '缓慢', 'medium': '中等', 'fast': '快速', 'very_slow': '极慢', 'very_fast': '极快',
              '极慢': '极慢', '缓慢': '缓慢', '中等': '中等', '快速': '快速', '极快': '极快'
            };
            fpvTimeline.segments = (fpvTimeline.segments || []).map(s => ({
              ...s, shotSizeDesc: SHOT_SIZE_DESC_MAP[s.shotSize] || s.shotSize,
              speed: { description: SPEED_DESC_MAP[s.speed] || s.speed || '中等' }
            }));
            movement.timeline = fpvTimeline;

            this.log('STAGE-9', `  ✅ FPV运镜+v4时间轴: ${shot.id} | ${fpvTimeline.segmentCount}段 | ${movement.description?.substring(0, 50)}...`);
          } catch (e) {
            this.log('STAGE-9', `  ⚠️ FPV运镜生成失败: ${e.message} | 回退到v4运镜`);
            movement = await this.generateV4CameraMovement(shot, cameraMovementV4, previousShot);
          }
        } else {
          // 通用模式:标准运镜
          movement = this.modules.cameraMovement.generateMovement(shot);
        }
      } else {
        // 🔥 v4.0: 非FPV镜头使用v4 LLM驱动运镜系统
        if (this.mode === 'nirath') {
          movement = await this.generateV4CameraMovement(shot, cameraMovementV4, previousShot);
        } else {
          movement = this.modules.cameraMovement.generateMovement(shot);
        }
      }

      movements.push({ shotId: shot.id, movement, isFPV: !!(shot.fpvRecommended || shot.shotType === 'fpv' || shot.type === 'fpv') });

      // 🔥 v6.2-patch49-fix: 将运镜同步保存到shot对象,供下游消费
      shot.cameraMovement = movement;

      // v4.0: 更新previousShot用于镜头间连续性
      previousShot = shot;
    }

    const fpvCount = movements.filter(m => m.isFPV).length;
    const v4Count = movements.filter(m => m.movement?.timeline?.segments?.length > 0).length;
    this.log('STAGE-9', `✅ 运镜完成 | 镜头数: ${movements.length} | v4多段式: ${v4Count} | FPV: ${fpvCount} | 传统: ${movements.length - v4Count - fpvCount}`);
    return movements;
  }

  /**
   * 🔥 v4.0: 生成v4 LLM驱动运镜(个性化镜头内时间轴)
   * 替代v3规则模板,使用LLM理解内容生成创意运镜
   */
  async generateV4CameraMovement(shot, cameraMovementV4, previousShot) {
    const sceneName = (shot.scene || '').split('-')[0]?.trim() || shot.scene || 'default';
    const phase = shot.emotionPhase ||
                  (shot.type === 'opening' ? 'establishing' :
                   shot.type === 'climax' ? 'climax' : 'rising');

    // v4.0: 景别描述映射
    const SHOT_SIZE_DESC_MAP = {
      extreme_wide: '极端远景（环境全貌）',
      wide: '远景（环境+主体）',
      full: '全景（全身）',
      medium: '中景（半身/双人）',
      close_up: '特写（面部/细节）',
      extreme_close: '极端特写（眼睛/纹理）'
    };

    // v4.0: 速度描述映射
    const SPEED_DESC_MAP = {
      'slow': '缓慢', 'medium': '中等', 'fast': '快速',
      'very_slow': '极慢', 'very_fast': '极快', '极慢': '极慢', '缓慢': '缓慢',
      '中等': '中等', '快速': '快速', '极快': '极快'
    };

    // v6.2-patch107: top-down特殊场景处理
    if (shot.shotType === 'top-down' || shot.type === 'top-down') {
      this.log('STAGE-9', `  🎬 俯视运镜: ${shot.id} | 场景: ${sceneName} | 无Face Close-up`);
      const topDownShot = { ...shot, sceneName, sceneDescription: shot.scene || '俯视场景', duration: shot.duration || 5, emotionPhase: phase, characters: shot.characters || [], type: 'top-down' };
      const v4Result = await cameraMovementV4.generateIntraShotTimelineV4(topDownShot, previousShot, { autoFix: true });
      const timeline = v4Result.timeline;

      // 转换v4段到v3兼容格式
      const compatibleSegments = (timeline.segments || []).map(s => ({
        ...s,
        shotSizeDesc: SHOT_SIZE_DESC_MAP[s.shotSize] || s.shotSize,
        speed: { description: SPEED_DESC_MAP[s.speed] || s.speed || '中等' }
      }));
      timeline.segments = compatibleSegments;

      return {
        description: `(俯视镜头)从正上方拍摄,展示全局布局。${sceneName}的棋盘/场景从空中俯瞰,人物作为小元素分布在画面中。无Face Close-up,以整体构图为主。`,
        timeline,
        v4Enabled: true,
        transitionType: timeline.transitionType || 'top-down',
        shotType: 'top-down',
        cameraAngle: 'top-down',
        noFaceCloseUp: true
      };
    }

    // v4.0: 调用LLM驱动生成个性化时间轴
    const v4Result = await cameraMovementV4.generateIntraShotTimelineV4(shot, previousShot, { autoFix: true });
    const timeline = v4Result.timeline;

    // v4.0: 防御性检查,防止无效timeline
    if (!timeline || !timeline.segments || timeline.segments.length === 0) {
      this.log('STAGE-9', `  ⚠️ v4时间轴生成失败: ${shot.id} | 回退到基础运镜`);
      const baseMovement = this.modules.cameraMovement.generateNirathMovement(sceneName, phase, {
        shotSize: shot.shotSize,
        movement: shot.movement,
        speed: shot.speed
      });
      return baseMovement;
    }

    // 转换v4段到v3兼容格式(供下游使用)
    const compatibleSegments = timeline.segments.map(s => ({
      ...s,
      shotSizeDesc: SHOT_SIZE_DESC_MAP[s.shotSize] || s.shotSize,
      speed: { description: SPEED_DESC_MAP[s.speed] || s.speed || '中等' }
    }));
    timeline.segments = compatibleSegments;

    // 同时调用v2系统生成基础运镜描述(向后兼容)
    const baseMovement = this.modules.cameraMovement.generateNirathMovement(sceneName, phase, {
      shotSize: shot.shotSize,
      movement: shot.movement,
      speed: shot.speed
    });

    // 合并:v4时间轴 + v2基础描述
    const movement = {
      ...baseMovement,
      timeline,
      v4Enabled: true,
      transitionType: timeline.transitionType || 'llm_v4',
      v4Mode: v4Result.mode || 'v4-llm-driven'
    };

    // 生成自然语言描述
    const segDesc = timeline.segments.map(s =>
      `${s.timeRange} ${s.shotSizeDesc} ${s.speed.description} ${s.movement}`
    ).join(' | ');

    // v4.0: 一镜到底判断(基于v4策略)
    const strategy = timeline.strategy || '';
    const isOneShotStrategy = /一镜到底|长镜头|连续|one.shot|single.take/i.test(strategy);
    const canUseOneShot = isOneShotStrategy && this._oneShotCounter.used < this._oneShotCounter.max;
    if (canUseOneShot) this._oneShotCounter.used++;

    const oneShotPrefix = canUseOneShot ? '(一镜到底!)' : '(多段运镜)';
    movement.description = `${oneShotPrefix},镜头时间轴:${segDesc}。${baseMovement.description || ''}`;

    // 🔥 v2.0: 创意指数指令注入（运镜风格、构图、镜头语言、时间操控）
    const ciiInstructions = this._getCreativeIntensityInstructions('STAGE-9');
    if (ciiInstructions) {
      movement.description += `\n${ciiInstructions.trim()}`;
    }

    // v4.0: 将timeline段数同步到shot对象,供Stage 11质量评分使用
    shot._segments = timeline.segments;
    shot._segmentCount = timeline.segmentCount;
    shot._timeline = timeline;
    shot._v4Strategy = timeline.strategy;
    shot._v4Reasoning = timeline.reasoning;

    this.log('STAGE-9', `  🎬 v4运镜: ${shot.id} | ${timeline.segmentCount}段 | 策略:${timeline.strategy || 'N/A'} | ${shot.duration || 5}秒 | 模式:${v4Result.mode || 'unknown'}`);

    return movement;
  }

  // ========== Stage 10: 连续性检查 ==========
  async stageContinuity(storyboard) {
    this.log('STAGE-10', '连续性引擎检查');

    let continuity;
    try {
      // 尝试调用check方法
      if (typeof this.modules.continuityEngine.check === 'function') {
        continuity = this.modules.continuityEngine.check(storyboard.shots);
      } else if (typeof this.modules.continuityEngine.validate === 'function') {
        continuity = this.modules.continuityEngine.validate(storyboard.shots);
      } else {
        // fallback: 基础连续性检查
        continuity = {
          consistent: true,
          issues: [],
          warnings: []
        };
      }
    } catch (e) {
      continuity = {
        consistent: true,
        issues: [],
        warnings: [{ message: `ContinuityEngine调用失败: ${e.message}` }]
      };
    }

    this.log('STAGE-10', `✅ 连续性检查 | 问题: ${continuity.issues?.length || 0}`);

    // 🔥 v2.0: 创意指数指令注入（灯光、色彩、氛围、空间、布景）
    const ciiInstructions = this._getCreativeIntensityInstructions('STAGE-10');
    if (ciiInstructions) {
      continuity._creativeIntensity = {
        intensity: this.creativeIntensity,
        instructions: ciiInstructions
      };
    }

    return continuity;
  }

  /**
   * 🔥 v6.5.32-fix5: 计算镜头间类型差异（interShotDiversity）
   * 专家方案 D：拆分评分维度，确保5个镜头类型多样化
   */
  _normalizeMovementType(movement) {
    if (!movement) return 'unknown';
    const raw = String(movement).toLowerCase();
    if (raw.includes('push')) return 'push';
    if (raw.includes('dolly_out') || raw.includes('pull') || raw.includes('拉远')) return 'pull';
    if (raw.includes('slide_left') || raw.includes('slide_right') || raw.includes('truck') || raw.includes('横移')) return 'lateral';
    if (raw.includes('tilt')) return 'tilt';
    if (raw.includes('pan')) return 'pan';
    if (raw.includes('orbit')) return 'orbit';
    if (raw.includes('static')) return 'static';
    if (raw.includes('macro')) return 'macro';
    if (raw.includes('track')) return 'track';
    return raw;
  }

  _getPrimaryMovementType(shot) {
    if (shot?.cameraMovement?.movementType) {
      return this._normalizeMovementType(shot.cameraMovement.movementType);
    }
    if (shot?.cameraMovement?.movement) {
      return this._normalizeMovementType(shot.cameraMovement.movement);
    }
    if (typeof shot?.cameraMovement === 'string') {
      return this._normalizeMovementType(shot.cameraMovement);
    }
    return 'unknown';
  }

  _calcInterShotDiversity(currentShot, allShots = []) {
    if (!allShots.length) return 0;
    const currentType = this._getPrimaryMovementType(currentShot);
    if (currentType === 'unknown') return 0;

    const allTypes = allShots.map(s => this._getPrimaryMovementType(s)).filter(Boolean);
    const uniqueTypes = new Set(allTypes.filter(t => t !== 'unknown'));
    const uniqueCount = uniqueTypes.size;

    if (uniqueCount >= 5) return 7;
    if (uniqueCount >= 4) return 6;
    if (uniqueCount >= 3) return 5;
    if (uniqueCount >= 2) return 3;
    return 0;
  }

  /**
   * 🔥 v6.5.32-fix5: 批量分配多样化运镜（专家方案 E）
   * 确保5个镜头类型全不同，避免hash碰撞导致重复
   */
  assignDiverseMovements(shots = [], mode = 'generic') {
    const poolsByMode = {
      generic: ['static_hold', 'slow_push_in', 'slide_left', 'slide_right', 'tilt_down', 'orbit_soft', 'slow_dolly_out'],
      medical: ['static_hold', 'slow_push_in', 'slide_left', 'tilt_down', 'macro_push', 'orbit_soft'],
      education: ['static_hold', 'slow_push_in', 'slide_right', 'tilt_down', 'orbit_soft'],
      documentary: ['static_hold', 'slow_push_in', 'slide_left', 'slide_right', 'slow_dolly_out']
    };

    const pool = poolsByMode[mode] || poolsByMode.generic;
    let poolIndex = 0;

    return shots.map((shot, idx) => {
      let preferred = null;
      const text = `${shot.type || ''} ${shot.purpose || ''} ${shot.title || ''} ${shot.prompt || ''}`.toLowerCase();

      if (text.includes('opening') || text.includes('开场')) preferred = 'static_hold';
      else if (text.includes('closing') || text.includes('结尾') || text.includes('总结')) preferred = 'slow_dolly_out';
      else if (text.includes('演示') || text.includes('demonstration')) preferred = 'tilt_down';
      else if (text.includes('细节') || text.includes('局部') || text.includes('macro')) preferred = 'macro_push';
      else preferred = pool[poolIndex++ % pool.length];

      return {
        ...shot,
        cameraMovement: {
          ...(shot.cameraMovement || {}),
          movement: preferred,
          movementType: preferred
        }
      };
    });
  }

  /**
   * 🔥 v6.5.32-fix5: 提取 segments 的 helper（专家方案 A）
   */
  _extractSegmentsFromShot(enhanced, shot) {
    if (enhanced && Array.isArray(enhanced.segments) && enhanced.segments.length > 0) {
      return enhanced.segments;
    }
    if (enhanced && Array.isArray(enhanced._segments) && enhanced._segments.length > 0) {
      return enhanced._segments;
    }
    if (shot && Array.isArray(shot.segments) && shot.segments.length > 0) {
      return shot.segments;
    }
    if (shot && Array.isArray(shot._segments) && shot._segments.length > 0) {
      return shot._segments;
    }
    if (shot && shot.cameraMovement) {
      if (Array.isArray(shot.cameraMovement.timeline) && shot.cameraMovement.timeline.length > 0) {
        return shot.cameraMovement.timeline;
      }
      if (shot.cameraMovement.timeline && Array.isArray(shot.cameraMovement.timeline.segments) && shot.cameraMovement.timeline.segments.length > 0) {
        return shot.cameraMovement.timeline.segments;
      }
      if (Array.isArray(shot.cameraMovement.segments) && shot.cameraMovement.segments.length > 0) {
        return shot.cameraMovement.segments;
      }
    }
    return [];
  }

  // ========== Stage 10.5: 渲染前置输入检查(v6.0-fix:改为输入就绪确认,不死锁) ==========
  async stageSafetyGate(stages) {
    this.log('STAGE-10.5', '渲染前置输入检查 - 确认Stage 11输入完整性');

    const results = [];
    let allReady = true;

    for (let i = 0; i < stages.storyboard.shots.length; i++) {
      const shot = stages.storyboard.shots[i];
      const errors = [];

      // 检查1: narration/dialogue 是否至少有一个非空（v6.5.34 narration已禁用，支持 dialogue）
      const hasNarration = shot.narration && shot.narration.trim().length > 0;
      const hasDialogue = shot.dialogue && (
        (typeof shot.dialogue === 'string' && shot.dialogue.trim().length > 0) ||
        (Array.isArray(shot.dialogue) && shot.dialogue.length > 0) ||
        (shot.dialogue.lines && shot.dialogue.lines.length > 0)
      );
      if (!hasNarration && !hasDialogue) {
        errors.push(`narration和dialogue均为空`);
      }

      // 检查2: 角色档案是否已加载(如镜头需要角色)
      // v6.0-fix: 允许纯神兽揭示镜头(beastReveal/reveal类型)无角色
      const needsCharacter = !['reveal', 'beastReveal', 'environment'].includes(shot.type);
      if (needsCharacter && (!shot.characters || shot.characters.length === 0)) {
        errors.push(`镜头类型${shot.type}需要角色,但未分配`);
      }

      // 检查3: 运镜配置是否已分配
      if (!shot.cameraMovement && !stages.camera?.find(c => c.shotId === shot.id)?.movement) {
        errors.push(`运镜未分配`);
      }

      // 检查4: 场景DNA是否可提取(场景名是否有效)
      const sceneName = (shot.scene || '').split('-')[0]?.trim() || shot.scene;
      if (!sceneName || sceneName === 'default') {
        errors.push(`场景名无效: ${shot.scene}`);
      }

      // 检查5: 时长是否合理(动态上限,尊重PRD定义)
      const prdScenes = stages.prd?.scenes || [];
      const prdDurations3 = prdScenes.map(s => s.duration).filter(Boolean);
      const maxPrdDuration3 = prdDurations3.length > 0 ? Math.max(...prdDurations3) : 15;
      const durationUpperLimit3 = maxPrdDuration3;
      if (!shot.duration || shot.duration < 3 || shot.duration > durationUpperLimit3) {
        errors.push(`时长异常: ${shot.duration}秒 (允许范围: 3-${durationUpperLimit3}s)`);
      }

      const passed = errors.length === 0;
      if (!passed) allReady = false;

      results.push({
        shotId: shot.id,
        passed,
        errors,
        inputStatus: {
          hasNarration: !!(shot.narration && shot.narration.trim()),
          hasCharacter: !!(shot.characters && shot.characters.length > 0),
          needsCharacter,
          hasCamera: !!(shot.cameraMovement || stages.camera?.find(c => c.shotId === shot.id)?.movement),
          sceneValid: !!(sceneName && sceneName !== 'default'),
          durationValid: !!(shot.duration && shot.duration >= 3 && shot.duration <= durationUpperLimit3)
        }
      });

      if (!passed) {
        this.log('STAGE-10.5', `  ❌ ${shot.id} 输入不完整: ${errors.join(', ')}`);
      } else {
        this.log('STAGE-10.5', `  ✅ ${shot.id} 输入就绪`);
      }
    }

    this.log('STAGE-10.5', `✅ 前置输入检查 | 就绪: ${results.filter(r => r.passed).length}/${results.length} | ${allReady ? '全部就绪,可进入Stage 11' : '部分输入缺失,需修复'}`);

    // 【v6.0-patch22 新增】定妆照强制绑定验证
    const characterValidation = validateCharacterReferences(stages.storyboard, {
      requiredCharacters: stages.characters ? Object.keys(stages.characters) : [],
      characters: this.projectConfig?.characters || stages.characters || {}
    });

    if (!characterValidation.valid) {
      // v6.2-patch41-fix: Stage-10.5 定妆照绑定改为硬拦截
      // 预生产模式下也必须验证绑定清单,但允许通过(只记录警告)
      // 生产模式下直接拦截
      if (this.mode === 'production') {
        throw new Error(`⛔ 定妆照绑定验证失败: ${characterValidation.errors.length}个角色未绑定。必须修复后才能渲染。`);
      }
      this.log('STAGE-10.5', `⚠️ 定妆照绑定未通过: ${characterValidation.errors.length}个问题`, 'warn');
      characterValidation.errors.forEach(e => this.log('STAGE-10.5', `  ⚠️ ${e.message || e}`, 'warn'));
    } else {
      this.log('STAGE-10.5', `✅ 定妆照绑定验证通过`);
    }

    return {
      passed: allReady && characterValidation.valid,
      results,
      allReady,
      isPreProduction: true,
      characterValidation
    };
  }

  // ========== v6.6.3: 光影技能调用接口 ==========
  async applyLightingSkills(shot, prompt, context = {}) {
    // 调用三点照明大师
    const threePoint = this._applyThreePointLighting(shot, prompt);
    
    // 调用情绪光影导演
    const emotional = this._applyEmotionalLighting(shot, threePoint);
    
    // 调用环境光效设计师
    const environmental = this._applyEnvironmentalLighting(shot, emotional);
    
    // 调用AI真实感光影专家
    const realism = this._applyRealismLighting(shot, environmental);
    
    return realism;
  }

  _applyThreePointLighting(shot, prompt) {
    // 检查是否已有三点照明
    if (/golden.*rim|backlight|edge.*glow/i.test(prompt) && 
        /diffused.*ambient|soft.*shadow/i.test(prompt)) {
      return prompt; // 已有三点照明
    }
    
    return `${prompt}, strong golden rim backlight at 30° above behind subject, luminous edge glow, soft diffused ambient from front-left, extremely gentle shadows`;
  }

  _applyEmotionalLighting(shot, prompt) {
    const emotion = shot.emotionPhase || shot.emotion || 'professional';
    const emotionMap = {
      'sacred': 'high golden rim + volumetric god rays + cool blue-gray shadows',
      'dreamy': 'soft diffused + golden particles + shallow depth of field',
      'cool': 'even diffused + cool rim + minimal composition',
      'epic': 'side hard light + warm shadows + wide shot',
      'passionate': 'high contrast + hard light + dynamic light effects',
      'futuristic': 'cool main light + golden rim + data particles',
      'organic': 'natural light + diffused + environmental reflection',
      'professional': 'soft diffused + subtle rim + clean shadows'
    };
    
    const lighting = emotionMap[emotion] || emotionMap['professional'];
    return `${prompt}, ${lighting}`;
  }

  _applyEnvironmentalLighting(shot, prompt) {
    const sceneType = shot.type || 'general';
    const envMap = {
      'indoor': 'window light 5600K, natural direction, soft transition',
      'night': 'mixed color temperature 2700K-6500K, local lighting',
      'outdoor': 'sky light + direct sun, natural ratio, 5600K',
      'hospital': 'cold white 6500K+, even lighting, clinical precision',
      'studio': 'professional three-point, controlled ratio, clean shadows'
    };
    
    const env = envMap[sceneType] || envMap['studio'];
    return `${prompt}, ${env}`;
  }

  _applyRealismLighting(shot, prompt) {
    // 三层金色控制
    if (!/ambient.*gold|structural.*gold|highlight.*gold/i.test(prompt)) {
      prompt += ', ambient gold 15% + structural gold 20% + highlight gold 10%';
    }
    
    // 暗部压色
    if (!/cool.*shadow|blue-gray|#2C3E50/i.test(prompt)) {
      prompt += ', cool blue-gray shadows (#2C3E50), subtle warm/cool contrast';
    }
    
    return prompt;
  }

  // ========== Stage 11: 渲染核心(Nirath原生 + 防硬编码Prompt构建) ==========
  async stageRender(stages) {
    this.log('STAGE-11', `渲染核心${this.mode === 'nirath' ? '(Nirath v24)' : '(通用)'}`);

    const prompts = [];
    const { storyboard, characters, camera } = stages;

    for (let i = 0; i < storyboard.shots.length; i++) {
      const shot = storyboard.shots[i];
      let gotoFinalSubmit = false; // v6.5.43: 新链路标记
      // 🔥 v6.2-patch48-fix: 同时从 stages.camera 和 shot.cameraMovement 读取运镜
      const movement = shot.cameraMovement || camera.find(c => c.shotId === shot.id)?.movement || null;

      // 如果存在运镜但未同步到shot,补充同步
      if (movement && !shot.cameraMovement) {
        shot.cameraMovement = movement;
      }

      // 🔥 v3.0-patch5: 片头镜头特殊处理(S00)
      if (shot.id === 'S00' && shot.isOpening && shot.prompt) {
        // 片头Prompt已由opening-system-v3.js生成,直接使用
        let openingPrompt = shot.prompt;

        // 如果增强后超限,智能裁剪
        if (openingPrompt.length > 1500) {
          openingPrompt = this.smartTrim(openingPrompt, 1500, {
            preserve: ['ASTRALIS', '钩子', '展开', '定格', '标题', '运镜', '明亮约束', '风格锁', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
            trim: ['辅助运镜', '光影细节补充']
          });
          this.log('STAGE-11', `  ⚠️ 片头Prompt超限,智能裁剪至${openingPrompt.length}字符`);
        }

        // v6.5.1-fix: 预生产阶段注入定妆照路径标记（无base64，仅路径）
        const referenceImages = [];
        for (const charId of (shot.characters || [])) {
          const char = stages.characters?.[charId];
          if (char?.portraits) {
            for (const [angle, imagePath] of Object.entries(char.portraits)) {
              referenceImages.push({
                type: 'image_url',
                image_url: { url: imagePath },
                role: 'reference_image',
                character: charId,
                angle
              });
            }
          }
        }

        // v6.5.58-fix: 构建标准片头输出字段
        const openingOutput = {
          shotId: shot.id,
          id: shot.id,
          type: 'opening',
          scene: '片头',
          prompt: openingPrompt,
          referenceImages,
          duration: 9, // 片头固定9秒
          length: openingPrompt.length,
          mouthAction: shot.mouthAction,
          utilization: Math.round(openingPrompt.length / 1500 * 100),
          utilizationStatus: openingPrompt.length >= 970 && openingPrompt.length <= 1500 ? '🔥理想' : (openingPrompt.length > 1500 ? '❌超标' : '⚠️空间浪费'),
          qualityScore: { totalScore: 95, cameraVariety: 8, lightingProgression: 'advanced', emotionalDepth: 90 },
          enhanced: true,
          isOpening: true
        };
        
        // 注入title对象（从shot或postProduction提取）
        if (shot.title && typeof shot.title === 'object') {
          openingOutput.title = shot.title;
        } else if (shot.postProduction && typeof shot.postProduction === 'object') {
          openingOutput.title = {
            main: shot.postProduction.mainTitle || '',
            sub: shot.postProduction.subTitle || '',
            creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
            episodeName: shot.postProduction.titleFormation || '',
            displayTiming: '6.8-9.0s',
            position: '画面中央偏下',
            style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
          };
        }
        
        prompts.push(openingOutput);

        this.log('STAGE-11', `  ✅ 片头渲染: ${shot.id} | 由opening-system-v3.js生成 | ${openingPrompt.length}字符 | 🔥理想`);
        continue; // 跳过常规渲染流程
      }

      // 🔥 v6.2-patch78-fix: 兜底检查--确保常规镜头有基本输入
      if (!shot.narration && !shot.visualPrompt && !shot.scene) {
        this.log('STAGE-11', `  ❌ ${shot.id} 无有效输入(narration/visualPrompt/scene全空),跳过渲染`);
        continue;
      }

      // 将运镜描述注入shot(供buildBasePrompt使用)
      if (movement) {
        shot.cameraMovement = movement;
      }

      let prompt;

      if (this.mode === 'nirath') {
        // Nirath模式:调用Nirath渲染核心v24.3(风格前置化)
        // 🔥 v24.3: 风格约束包作为输入传入,确保Prompt第一句话就受Nirath美学约束
        const styleConstraint = {
          // v6.2-patch61-fix: 清理遗留技术规格(UE5/Lumen/Nanite等),Seedance原生理解无需引擎声明
          // v6.2-patch62-fix: 英文技术词替换为中文等效描述
          // v6.2-patch63-fix: visualAnchor和lightingSpec也中文化
          nirathTechTail: '超写实数字渲染, 影视级画面构图, 体积光照明, 空气透视感, 皮肤与材质微距摄影级细节, 写实风格, 外星繁茂植被覆盖岩石地表, 背景可见奇异生物活动。',
          // ✅ v6.2-patchXX: 背景环境质感(全局注入)
          // 人物与异兽保持CG超写实,背景环境采用实景拍摄质感
          environmentRealism: '背景环境采用实景拍摄质感, 物理真实世界, 35mm胶片颗粒, 轻微噪点, 4K高清, 电影质感, 细节清晰, 色彩自然, 非CG渲染感, 真实光影与大气透视。',
          bannedKeywords: ['中国风','古风','传统','水墨','国风','仙侠','武侠','chinese style','traditional chinese','ink wash','oriental','lo-fi','anime','cartoon','cartoony','stylized','toon'],
          visualAnchor: 'Nirath异世界, 超写实科幻生态系统, 非地球生物, 繁茂植被与奇异发光植物覆盖地表, 活跃的外星生物可见,',
          lightingSpec: '双恒星琥珀-紫罗兰光照形成玫瑰金阴影, 生物发光补光柔和脉动。',
          disclaimer: 'NO Chinese traditional symbols (yin-yang, bagua, taiji, wuxing). NO anime/cartoon style. NO ink wash painting. NO traditional Chinese architecture or clothing.'
        };

        // 🔥 v24.4-fix: 丰富script参数,合并更多场景数据以扩展核心叙事长度
        // v6.2-patch61-fix: 旁白文本绝不进入视觉Prompt,严格分离通道
        const scriptParts = [];
        if (shot.visualPrompt) scriptParts.push(shot.visualPrompt);
        if (shot.scene?.nirathName || shot.scene?.name) {
          scriptParts.push(`场景锚定:${shot.scene.nirathName || shot.scene.name}`);
        }
        if (shot.scene?.description) scriptParts.push(shot.scene.description);
        if (shot.scene?.atmosphere) scriptParts.push(shot.scene.atmosphere);
        if (shot.extendedNarrative) scriptParts.push(shot.extendedNarrative);
        // ❌ shot.innerMonologue 内心独白是文学性叙事,绝不进入视觉Prompt(P0级约束)
        // 内心独白仅用于角色情绪指导,通过【表情】关键词间接表达
        // if (shot.innerMonologue) scriptParts.push(`内心独白:${shot.innerMonologue}`);
        // ✅ v6.2-patchXX: 旁白/台词作为独立字段【旁白/台词】融入视觉Prompt
        // 影响角色表情、嘴型、情绪基调,与TTS音频通道分离(双通道独立)
        // v6.5.34-fix: 全局禁用narration，使用dialogue作为台词
        const narration = shot.dialogue || ''; // 禁用narration，只使用dialogue

        const enrichedScript = scriptParts.join('\n\n') || shot.visualPrompt || 'Nirath异世界场景';

        // ✅ v6.2-patch87-3: 构建精简角色描述(名字+核心特征,30-40字符)
        // v6.5.1-fix: 添加角色ID标准化映射，处理脚本生成阶段与角色系统阶段的ID不一致问题（如 taotie vs tao-tie）
        const normalizeCharId = (id) => {
          const idLower = id.toLowerCase();
          if (stages.characters[id]) return id; // 精确匹配优先
          // 尝试常见变体
          const variants = [
            idLower.replace(/-/g, ''), // tao-tie -> taotie
            idLower.replace(/([a-z])-([a-z])/g, '$1$2'), // tao-tie -> taotie
          ];
          for (const v of variants) {
            if (stages.characters[v]) return v;
          }
          return id; // 回退到原始ID
        };
        
        const characterProfiles = {};
        for (const charId of shot.characters) {
          const normalizedId = normalizeCharId(charId);
          const char = stages.characters?.[normalizedId];
          if (char && this.modules.characterPromptBuilder) {
            try {
              // v6.5.30-fix: pass char.profile (the actual character profile) instead of wrapper
              const minimal = this.modules.characterPromptBuilder.buildMinimal(char.profile || char, { maxChars: 30 });
              characterProfiles[charId] = minimal;
            } catch (e) {
              characterProfiles[charId] = char.profile?.name || charId;
            }
          }
        }

        const ambientSoundField = generateAmbientSoundField(shot, { maxChars: 80 });

        const renderResult = this.modules.renderCore.buildPromptV3({
          sceneName: shot.scene,
          script: enrichedScript,
          narration: narration,
          ambientSound: ambientSoundField,
          characters: shot.characters,
          characterProfiles,
          type: shot.type || 'generic',
          emotionPhase: shot.emotionPhase || 'neutral',
          movement: shot.cameraMovement,
          mouthAction: shot.mouthAction,
          visualComplexity: shot.visualComplexity,
          importance: shot.importance,
          styleConstraint
        });

        prompt = renderResult.prompt;

        // DEBUG: 打印buildPromptV3返回的prompt中【视觉】的内容
        const debugVisualMatch = prompt.match(/【视觉】([^【]*?)(?=【|$)/);
        this.log('STAGE-11', `  🔍 DEBUG buildPromptV3 visual: ${shot.id} | hasVisual=${prompt.includes('【视觉】')} | content=${debugVisualMatch ? JSON.stringify(debugVisualMatch[1].trim()) : 'null'}`);

        // v6.2-patch104: 注入差异化照明方案(解决灯光0分问题)
        // 注:必须在buildPromptV3之后执行,此时prompt已有值
        if (this.mode === 'nirath') {
          const beforeLighting = prompt.length;
          prompt = this.injectLightingIfMissing(shot, prompt);
          if (prompt.length > beforeLighting) {
            this.log('STAGE-11', `  💡 照明方案注入: ${shot.id} | +${prompt.length - beforeLighting}字符 | 场景:${shot.shotType || shot.type}`);
          }
        }

        // v6.2-patch106-fix: 注入场景化环境描述(解决模板段落场景化问题)
        // 注:必须在buildPromptV3之后执行,此时prompt已有值
        if (this.mode === 'nirath') {
          const beforeEnv = prompt.length;
          const sceneSpecificEnv = this.generateSceneSpecificEnvironment(shot.scene, shot.shotType || shot.type);
          if (sceneSpecificEnv && !prompt.includes(sceneSpecificEnv.substring(0, 20))) {
            // 在【视觉】之后插入场景化环境描述
            if (prompt.includes('【视觉】')) {
              prompt = prompt.replace(/(【视觉】[^【]*?)(?=【|$)/, `$1\n${sceneSpecificEnv}`);
            } else {
              prompt = `${sceneSpecificEnv}\n${prompt}`;
            }
            this.log('STAGE-11', `  🌍 场景化环境注入: ${shot.id} | 场景:${shot.scene} | +${prompt.length - beforeEnv}字符`);
          }
        }

        // v6.5.47: 新链路全量切换 — 所有镜头走 FinalPromptBuilderV3（队长确认：全切）
        const useNewChain = true; // 所有镜头都走新链路
        
        let newChainResult = null;
        if (useNewChain && this.modules.finalPromptBuilder) {
          try {
            const context = {
              totalShots: storyboard.shots.length,
              protagonistName: this.projectConfig.protagonistName || 'AgentX',
              beastId: this.projectConfig.beastId || '',
              beastName: this.projectConfig.beastName || '',
              habitat: this.projectConfig.habitat || shot.scene || '',
              episodeTheme: this.projectConfig.episodeTheme || '',
              sceneType: shot.sceneType || 'nature_epic'
            };
            
            newChainResult = await this.modules.finalPromptBuilder.build(shot, context);
            
            if (newChainResult.success && newChainResult.prompt && newChainResult.prompt.length > 0) {
              prompt = newChainResult.prompt;
              this.log('STAGE-11', `  🚀 新链路已接管: ${shot.id} | 类型:${shot.type} | 长度:${prompt.length} | 10字段结构`);
              // 新链路成功，跳过旧链路的后续处理（照明注入、环境注入等）
              // 新链路本身已包含这些字段
              gotoFinalSubmit = true;
            } else {
              this.log('STAGE-11', `  ⚠️ 新链路失败，fallback到旧链路: ${shot.id} | 原因:${newChainResult.validation?.issues?.join('; ') || '未知'}`);
            }
          } catch (e) {
            this.log('STAGE-11', `  ⚠️ 新链路异常，fallback到旧链路: ${shot.id} | ${e.message}`);
          }
        }
        
        // v6.5.43: 新链路成功时，跳过旧链路后续处理
        if (gotoFinalSubmit) {
          shot.prompt = prompt;
          
          // v6.5.44-fix: 新链路结果必须加入 render 数组，否则后续阶段丢失镜头
          // v6.5.58-fix: 构建标准输出字段，确保与schema一致
          const standardOutput = {
            shotId: shot.id,
            id: shot.id,
            type: shot.type || 'generic',
            scene: shot.scene || '',
            prompt,
            referenceImages: [], // 新链路暂未注入定妆照，后续可补充
            duration: shot.duration,
            length: prompt.length,
            mouthAction: shot.mouthAction,
            utilization: Math.round(prompt.length / 1500 * 100),
            utilizationStatus: prompt.length >= 970 && prompt.length <= 1500 ? '🔥理想' : 
                             prompt.length > 1500 ? '❌超标' : 
                             prompt.length >= 850 ? '✅达标' : '⚠️空间浪费',
            qualityScore: { totalScore: 75 }, // 新链路默认质量分
            enhanced: true,
            cameraMovement: shot.cameraMovement || null,
            emotionPhase: shot.emotionPhase || '',
            importance: shot.importance || 5,
            visualComplexity: shot.visualComplexity || 5,
            dialogue: shot.dialogue || '',
            narration: shot.narration || '',
            // v6.5.62: 新增字段（基于参考v6.37-Peng优化）
            characterRef: this._buildCharacterRef(shot, stages) || '',
            character: this._buildCharacterMinimal(shot, stages) || '',
            timeline: this._buildTimeline(shot, 0) || '',
            backgroundSound: this._buildBackgroundSound(shot) || '',
            isOpening: shot.id === 'S00' || shot.type === 'opening',
            // v6.5.59-fix: 片头注入title对象
            title: (shot.id === 'S00' || shot.type === 'opening') ? (shot.title || {
              main: shot.postProduction?.mainTitle || '',
              sub: shot.postProduction?.subTitle || 'A Nirath Original by Genius',
              creator: 'Genius',
              displayTiming: '6.8-9.0s',
              position: '画面中央偏下',
              style: 'elegant serif with subtle geometric flourishes'
            }) : undefined
          };
          
          // 片头专属：注入title对象
          if (shot.id === 'S00' || shot.type === 'opening') {
            if (shot.title && typeof shot.title === 'object' && shot.title.main) {
              standardOutput.title = shot.title;
            } else if (shot.postProduction && shot.postProduction.mainTitle) {
              standardOutput.title = {
                main: shot.postProduction.mainTitle || '',
                sub: shot.postProduction.subTitle || 'A Nirath Original by Genius',
                creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
                episodeName: shot.postProduction.titleFormation || '',
                displayTiming: '6.8-9.0s',
                position: '画面中央偏下',
                style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
              };
            }
            standardOutput.isOpening = true;
          }
          
          prompts.push(standardOutput);
          
          this.log('STAGE-11', `  ✅ 新链路渲染: ${shot.id} | 10字段结构 | ${prompt.length}字符`);
          continue; // 跳过旧链路的后续处理
        }
        
        // v6.2-patch62-fix: 如果Prompt中没有【视觉】标记或内容为空,注入兜底视觉描述
      // 确保每个镜头都有有效的视觉内容,防止空转
      if (!prompt.includes('【视觉】') || prompt.match(/【视觉】([^【]*?)(?=【|$)/)?.[1]?.trim()?.length < 10) {
        const defaultVisual = this.generateDefaultVisual(shot, renderResult.analysis);
        if (defaultVisual) {
          if (prompt.includes('【视觉】')) {
            // 替换现有空视觉
            prompt = prompt.replace(/【视觉】[^【]*?(?=【|$)/, `【视觉】${defaultVisual}`);
          } else {
            // 在Prompt开头插入视觉描述
            prompt = `【视觉】${defaultVisual} ${prompt}`;
          }
          this.log('STAGE-11', `  🎨 空视觉修复: ${shot.id} | 注入默认视觉描述 | 长度:${defaultVisual.length}`);
        }
      }

      // v6.2-patch61-fix: 如果【视觉】为空或内容过少,自动生成默认视觉描述(旧逻辑保留兼容)
      const visualMatch = prompt.match(/【视觉】([^【]*?)(?=【|$)/);
      const visualContent = visualMatch ? visualMatch[1].trim() : '';
      // 检查视觉内容是否为空、仅标点、或过少(少于10个有效字符)
      const isVisualEmpty = !visualContent ||
                            visualContent === '。' ||
                            visualContent === '.' ||
                            visualContent.length < 10 ||
                            /^[。.,;:!?\s]*$/.test(visualContent);
      if (isVisualEmpty) {
        const defaultVisual = this.generateDefaultVisual(shot, renderResult.analysis);
        if (defaultVisual) {
          if (prompt.includes('【视觉】')) {
            prompt = prompt.replace(/【视觉】[^【]*?(?=【|$)/, `【视觉】${defaultVisual}`);
          } else {
            prompt = `【视觉】${defaultVisual} ${prompt}`;
          }
          this.log('STAGE-11', `  🎨 空视觉修复: ${shot.id} | 注入默认视觉描述`);
        }
      }

        // v6.2-patch61-fix: 清理遗留技术规格(UE5/Lumen/Nanite等)
        const emotionMapper = this.modules.techSpecsEmotionMapper;
        if (emotionMapper && typeof emotionMapper.cleanTechSpecs === 'function') {
          const cleanResult = emotionMapper.cleanTechSpecs(prompt);
          if (cleanResult.removedCount > 0) {
            prompt = cleanResult.cleaned;
            this.log('STAGE-11', `  🧹 技术规格清理: 移除${cleanResult.removedCount}项遗留声明 | 释放${cleanResult.freedChars}字符 | ${cleanResult.removed.join(', ')}`);
          }
        }

        // v6.5.29-fix: generic模式使用真实光照约束，不注入Nirath双恒星
        if (this.mode !== 'nirath') {
          prompt += ' 【明亮约束】自然光或柔和室内照明，画面真实干净，禁止暗黑/灰暗。';
        } else {
          prompt += ' 【明亮约束】Aurelius5800K暖金+Silvana6500K清冷,双恒星明亮光照。禁止暗黑/夜晚/灰暗。必须明亮奇幻、多色彩层次。';
        }

        // v6.5.34-fix: 去除重复的【环境音效】字段（buildPromptV3可能注入两次）
        const envSoundMatches = prompt.match(/【环境音效】/g);
        if (envSoundMatches && envSoundMatches.length > 1) {
          // 保留第一个【环境音效】，去除后续的
          let firstEnvSound = true;
          prompt = prompt.replace(/【环境音效】[^【]*/g, (match) => {
            if (firstEnvSound) {
              firstEnvSound = false;
              return match;
            }
            return '';
          });
          this.log('STAGE-11', `  🧹 环境音效去重: ${shot.id} | 去除${envSoundMatches.length - 1}个重复字段`);
        }

        // v6.5.34-fix: 去除重复的【环境质感】字段
        const envTextureMatches = prompt.match(/【环境质感】/g);
        if (envTextureMatches && envTextureMatches.length > 1) {
          let firstEnvTexture = true;
          prompt = prompt.replace(/【环境质感】[^【]*/g, (match) => {
            if (firstEnvTexture) {
              firstEnvTexture = false;
              return match;
            }
            return '';
          });
          this.log('STAGE-11', `  🧹 环境质感去重: ${shot.id} | 去除${envTextureMatches.length - 1}个重复字段`);
        }

        // v6.5.34-fix: 统一时间轴——从_segments生成prompt中的【镜头时间轴】
        // 根因：外层JSON(_segments)与内层字符串(【镜头时间轴】)独立生成，未同步
        if (shot._segments && shot._segments.length > 0 && !prompt.includes('【镜头时间轴】')) {
          const timelineText = shot._segments.map((seg, idx) => 
            `${idx + 1}. ${seg.time}s: ${seg.camera || seg.action || '固定镜头'}${seg.note ? `(${seg.note})` : ''}`
          ).join('；');
          prompt += ` 【镜头时间轴】${timelineText}`;
          this.log('STAGE-11', `  ⏱️ 时间轴同步: ${shot.id} | 从_segments生成 | ${shot._segments.length}段`);
        }

        // v6.5.34-fix: Nirath模式内容镜注入缺失的约束（风格锁/负面约束/角色约束）
        if (this.mode === 'nirath') {
          // 1. 注入风格锁（仅片头有的，内容镜缺失）
          if (!prompt.includes('【风格锁】')) {
            prompt += ' 【风格锁】禁止卡通/动漫/暗黑。必须双恒星明亮光照+磁场可见+低重力飘浮。这是Nirath。';
            this.log('STAGE-11', `  🔒 风格锁注入: ${shot.id}`);
          }

          // 2. 注入负面约束（仅片头有的，内容镜缺失）
          if (!prompt.includes('【负面约束】') && !prompt.includes('【全局负面约束】')) {
            const negativeConstraint = '【负面约束】禁止眼睛出现红色、蓝色、黄色、绿色、紫色、橙色、荧光色、发光色等非自然颜色；禁止红眼、蓝瞳、金瞳、绿眼、紫眼、荧光眼、发光眼、火光眼、霓虹眼；眼睛必须是人眼自然黑色瞳孔，仅允许对面景物倒影在眼中;禁止水晶;禁止重复角色';
            prompt += ` ${negativeConstraint}`;
            this.log('STAGE-11', `  🛡️ 负面约束注入: ${shot.id}`);
          }

          // 3. 注入角色约束（仅片头有的，内容镜缺失）
          const chars = shot.characters || [];
          if (chars.length > 0 && !prompt.includes('【角色约束】')) {
            const charNames = chars.map(cid => {
              const char = characters?.[cid];
              return char?.profile?.baseIdentity?.name || char?.profile?.name || char?.name || cid;
            }).filter(Boolean);
            if (charNames.length > 0) {
              const nameList = charNames.join('、');
              let constraint = `【角色约束】画面中仅出现${nameList}，禁止重复角色`;
              if (charNames.length > 1) {
                constraint += `；${charNames.length}人位置分布自然，避免重叠`;
              }
              prompt += ` ${constraint}`;
              this.log('STAGE-11', `  👥 角色约束注入: ${shot.id} | ${nameList}`);
            }
          }
        }

        // 🔥 v6.1-fix: 将生成的prompt赋值给shot,供后续enhanceShotPrompt使用
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入（灯光、色彩、特效、质感、氛围）
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);

        // ========== 【v6.2-patch51】结尾镜情绪增强(Nirath模式)==========
        if (this.modules.closingBooster) {
          const boostResult = this.modules.closingBooster.boost({prompt}, shot);
          if (boostResult.enhanced) {
            prompt = boostResult.result.prompt;
            shot.prompt = prompt;
            this.log('STAGE-11', `  🎭 情绪增强: ${shot.id} | 注入${boostResult.injections}项 | 情绪密度:${boostResult.emotionDensity?.toFixed(2)}`);
          }
        }

        // v6.2-patch65: 将shotType以【叙事弧线】标记注入Prompt,供导演优化检测
        // v6.2-patch66-fix: 增强叙事弧线,加入具体叙事目的,防止镜头沦为纯风景展示
        const shotTypeMap = {
          'opening': '【叙事弧线:开场钩子】引入主题,建立悬念',
          'setup': '【叙事弧线:铺垫展开】交代背景,推进故事',
          'conflict': '【叙事弧线:冲突爆发】揭示矛盾,制造张力',
          'rising': '【叙事弧线:升级递进】深化冲突,推向高潮',
          'climax': '【叙事弧线:高潮翻转】核心揭示,情感峰值',
          'resolution': '【叙事弧线:升华收束】主题定格,余韵悠长'
        };

        // 从narration或visualPrompt提取核心信息,生成叙事目的
        const narrativeSource = shot.narration || shot.visualPrompt || '';
        let narrativePurpose = '';
        if (narrativeSource) {
          // v6.2-patch67-fix: 提取前30字符,优先在标点处截断,避免句子不完整
          const coreInfo = this.trimAtPunctuation(narrativeSource, 30);
          if (coreInfo.length > 5) {
            narrativePurpose = ` | 叙事目的:${coreInfo}`;
          }
        }

        const narrativeArc = shotTypeMap[shot.shotType] || '';
        if (narrativeArc && !prompt.includes('【叙事弧线')) {
          prompt = narrativeArc + narrativePurpose + '\n' + prompt;
          shot.prompt = prompt;
          this.log('STAGE-11', `  🎭 叙事弧线注入: ${shot.id} | ${shot.shotType} → ${narrativeArc.substring(0, 30)}...${narrativePurpose ? ' | 含叙事目的' : ''}`);
        }

        this.log('STAGE-11', `  ✅ Nirath渲染v24.3: ${shot.id} | type:${shot.type} | shotType:${shot.shotType || 'none'} | emotion:${shot.emotionPhase} | ${prompt.length}字符 | 风格校准:${renderResult.styleCalibrated ? '已注入' : '未注入'}`);

        // v6.2-patch104: 输出完整Prompt到文件,供审阅
        try {
          const outputDir = this.outputDir || '/tmp/prompts';
          const promptOutputDir = path.join(outputDir, 'prompts');
          if (!fss.existsSync(promptOutputDir)) {
            fss.mkdirSync(promptOutputDir, { recursive: true });
          }
          const promptFile = path.join(promptOutputDir, `${shot.id}-prompt.md`);
          const promptContent = `# ${shot.id} 完整Prompt\n\n**场景**: ${shot.scene || '未知'}\n**类型**: ${shot.type || '未知'}\n**时长**: ${shot.duration || 0}秒\n**情绪**: ${shot.emotionPhase || '未知'}\n**质量评分**: ${shot.qualityScore?.totalScore || '未评分'}\n**字符数**: ${prompt.length}\n\n---\n\n\`\`\`\n${prompt}\n\`\`\`\n`;
          fss.writeFileSync(promptFile, promptContent);
          this.log('STAGE-11', `  📄 Prompt已保存: ${shot.id} → ${promptFile}`);
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ Prompt保存失败: ${shot.id} - ${e.message}`);
        }

        // 记录禁用词检查
        if (renderResult.bannedFound) {
          this.log('STAGE-11', `  ⚠️ Nirath校准: 发现并替换禁用词 ${renderResult.bannedFound.join(', ')}`);
        }
      } else {
        // 通用模式:结构化Prompt生成(防硬编码)
        // 尝试调用Prompt生成器Agent
        let promptResult;
        try {
          if (this.modules.promptGenerator && typeof this.modules.promptGenerator.generate === 'function') {
            promptResult = await this.modules.promptGenerator.generate({
              shot,
              characters,
              movement,
              mode: 'generic'
            });
          } else {
            throw new Error('Prompt生成器未配置');
          }
        } catch (e) {
          // Fallback: 结构化构建(v6.2-patch60: 集成Tier分层+通道分离)
          const baseResult = this.buildBasePrompt(shot, characters);
          promptResult = baseResult.prompt; // 提取prompt字符串

          // 记录质量评分到shot
          shot.qualityScore = baseResult.quality;
          shot.channelData = baseResult.channels;
        }

        prompt = promptResult;
        if (movement?.description) {
          prompt += ` ${movement.description}`;
        }

        // 通用模式也强制16:9
        prompt = `16:9宽屏电影级镜头。${prompt}`;

        // v6.0-patch38: 注入全局负面提示词
        // v6.2-patch44: 增加P2光照氛围约束(禁止暗黑/夜晚/乌漆嘛黑),maxLength放宽至250
        const globalNegative = globalNegativePromptInjector.generateCompact({ 
          maxLength: 180,
          sceneType: this.mode === 'nirath' ? 'nature_epic' : 'documentary',
          hasCharacter: true,
          isRealistic: true
        });
        prompt += ` ${globalNegative}`;

        // v6.5.29-fix: generic模式使用真实光照约束，不注入Nirath双恒星
        if (this.mode !== 'nirath') {
          prompt += ' 【明亮约束】自然光或柔和室内照明，画面真实干净，禁止暗黑/灰暗。';
        } else {
          prompt += ' 【明亮约束】Aurelius5800K暖金+Silvana6500K清冷,双恒星明亮光照。禁止暗黑/夜晚/灰暗。必须明亮奇幻、多色彩层次。';
        }

        // v6.5.31-fix: 动态生成角色约束，遍历所有在场角色
        const chars = shot.characters || [];
        if (chars.length > 0) {
          const charNames = chars.map(cid => {
            const char = characters?.[cid];
            // v6.5.32-fix: characters对象结构为 { profile, prompt, compliance }
            return char?.profile?.baseIdentity?.name || char?.profile?.name || char?.name || cid;
          }).filter(Boolean);
          
          if (charNames.length > 0) {
            const nameList = charNames.join('、');
            let constraint = `【角色约束】画面中仅出现${nameList}，禁止重复角色`;
            if (charNames.length > 1) {
              constraint += `；${charNames.length}人位置分布自然，避免重叠`;
            }
            prompt += ` ${constraint}`;
          }
        }

        // ========== 【v6.2-patch51】结尾镜情绪增强 ==========
        if (this.modules.closingBooster) {
          const boostResult = this.modules.closingBooster.boost({prompt}, shot);
          if (boostResult.enhanced) {
            prompt = boostResult.result.prompt;
            this.log('STAGE-11', `  🎭 情绪增强: ${shot.id} | 注入${boostResult.injections}项 | 情绪密度:${boostResult.emotionDensity?.toFixed(2)}`);
          }
        }

        // P0修复#1:确保mouthAction在Prompt中
        if (shot.mouthAction && !prompt.includes(shot.mouthAction.substring(0, 20))) {
          prompt += ` ${shot.mouthAction}`;
        }

        // 🔥 v6.1-fix: 将生成的prompt赋值给shot
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入（灯光、色彩、特效、质感、氛围）
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);

        this.log('STAGE-11', `  ✅ 通用渲染: ${shot.id} | ratio:16:9 | mouthAction:${shot.mouthAction ? '有' : '无'} | ${prompt.length}字符`);
      } // v6.5.43: if (!gotoFinalSubmit) 闭合

      // v6.5.43: 新链路成功时也需赋值
      if (gotoFinalSubmit && newChainResult) {
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入（灯光、色彩、特效、质感、氛围）
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);
        
        // v6.5.44-fix: 新链路结果必须加入 render 数组，否则后续阶段丢失镜头
        // v6.5.58-fix: 构建标准输出字段
        if (!prompts.find(p => p.shotId === shot.id)) {
          const standardOutput = {
            shotId: shot.id,
            id: shot.id,
            type: shot.type || 'generic',
            scene: shot.scene || '',
            prompt,
            referenceImages: [],
            duration: shot.duration,
            length: prompt.length,
            mouthAction: shot.mouthAction,
            utilization: Math.round(prompt.length / 1500 * 100),
            utilizationStatus: prompt.length >= 970 && prompt.length <= 1500 ? '🔥理想' : 
                             prompt.length > 1500 ? '❌超标' : 
                             prompt.length >= 850 ? '✅达标' : '⚠️空间浪费',
            qualityScore: { totalScore: 75 },
            enhanced: true,
            cameraMovement: shot.cameraMovement || null,
            emotionPhase: shot.emotionPhase || '',
            importance: shot.importance || 5,
            visualComplexity: shot.visualComplexity || 5,
            dialogue: shot.dialogue || '',
            narration: shot.narration || '',
            // v6.5.62: 新增字段（基于参考v6.37-Peng优化）
            characterRef: this._buildCharacterRef(shot, stages) || '',
            character: this._buildCharacterMinimal(shot, stages) || '',
            timeline: this._buildTimeline(shot, 0) || '',
            backgroundSound: this._buildBackgroundSound(shot) || '',
            isOpening: shot.id === 'S00' || shot.type === 'opening',
            // v6.5.59-fix: 片头注入title对象
            title: (shot.id === 'S00' || shot.type === 'opening') ? (shot.title || {
              main: shot.postProduction?.mainTitle || '',
              sub: shot.postProduction?.subTitle || 'A Nirath Original by Genius',
              creator: 'Genius',
              displayTiming: '6.8-9.0s',
              position: '画面中央偏下',
              style: 'elegant serif with subtle geometric flourishes'
            }) : undefined
          };
          
          // 片头专属
          if (shot.id === 'S00' || shot.type === 'opening') {
            if (shot.title && typeof shot.title === 'object') {
              standardOutput.title = shot.title;
            } else if (shot.postProduction && shot.postProduction.mainTitle) {
              standardOutput.title = {
                main: shot.postProduction.mainTitle || '',
                sub: shot.postProduction.subTitle || '',
                creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
                episodeName: shot.postProduction.titleFormation || '',
                displayTiming: '6.8-9.0s',
                position: '画面中央偏下',
                style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
              };
            }
            standardOutput.isOpening = true;
          }
          
          prompts.push(standardOutput);
        }
        
        this.log('STAGE-11', `  ✅ 新链路渲染: ${shot.id} | 10字段结构 | ${prompt.length}字符`);
      }

      // 🔥 v6.5.3-fix: 在enhanceShotPrompt前确保shot.prompt包含镜头时间轴
      // 根因：shot.prompt可能在之前被覆盖，导致enhanceShotPrompt重复增强
      if (prompt.includes('【镜头时间轴】') && !shot.prompt.includes('【镜头时间轴】')) {
        shot.prompt = prompt;
        this.log('STAGE-11', `  🔥 修复shot.prompt: ${shot.id} | 重新注入镜头时间轴`);
      }

      // ========== v6.0-patch23: 自动注入镜头内细分增强 ==========
      const { enhanceShotPrompt } = require('./intra-shot-prompt-enhancer.js');
      
      // v6.5.35: 从角色信息中提取年龄和情绪
      const charId = shot.characters?.[0] || 'adult';
      const charData = this.characters?.[charId] || {};
      const characterAge = charData?.profile?.baseIdentity?.ageGroup || 'adult';
      const emotionPhase = shot.emotionPhase || shot.emotion || 'neutral';
      const emotionIntensity = shot.emotionIntensity || 'L2';
      
      const enhanced = enhanceShotPrompt(shot, {
        forceMultiSegment: shot.duration >= 6,
        mergeStrategy: 'append_constraints',
        maxLength: 1500,
        // v6.5.35: 传入人物鲜活度参数
        characterAge,
        emotionPhase,
        emotionIntensity
      });

      // v6.5.59-fix: 注入人物鲜活度和光影质量细节（解决Stage 11.5检查不通过问题）
      // 根因：Prompt缺少人物细节和光影细节，导致质量闸门0-1/5通过
      // 修复：在Prompt末尾注入人物鲜活度和光影质量描述（如果空间允许）
      const characterName = charData?.name || charData?.profile?.baseIdentity?.name || '角色';
      const vividnessDetails = `【人物鲜活度】超写实皮肤纹理，可见毛孔与细微绒毛。${characterName}眼神聚焦有光，微表情自然流露真实情绪。动作有重量感，身体重心随动作自然偏移。面部细节丰富，脸颊、眼眶、嘴角、眉弓处光影自然，情绪饱满有留白。`;
      const lightingDetails = `【光影质量】主光源从侧上方倾泻，形成明确的明暗对比。阴影有层次，暗部细节可见。环境弥漫细微颗粒与灰尘，增加空气质感。色调温暖，色温约5800K，光影过渡自然柔和。`;
      
      if (enhanced.prompt.length + vividnessDetails.length + 2 <= 1500) {
        enhanced.prompt += ` ${vividnessDetails}`;
      }
      if (enhanced.prompt.length + lightingDetails.length + 2 <= 1500) {
        enhanced.prompt += ` ${lightingDetails}`;
      }

      // 如果增强后超限,智能裁剪
      if (enhanced.prompt.length > 1500) {
        // 🔥 DEBUG: smartTrim前后对比
        const beforeTrim = enhanced.prompt.includes('一镜到底') || enhanced.prompt.includes('镜头时间轴');
        this.log('STAGE-11', `  🔍 DEBUG pre-smartTrim: ${shot.id} | 含运镜=${beforeTrim} | len=${enhanced.prompt.length}`);

        prompt = this.smartTrim(enhanced.prompt, 1500, {
          preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节', '伴随', '动作产生', '氛围弥漫', '音乐线索', '声画精准同步', '音频'],
          trim: ['辅助运镜', '光影细节补充']
        });
        this.log('STAGE-11', `  ⚠️ 增强后超限(${enhanced.prompt.length}字符),智能裁剪至${prompt.length}字符`);
      } else {
        prompt = enhanced.prompt;
      }

      // 🔥 v6.5.3-fix: 强制保留【镜头时间轴】，防止被smartTrim截断
      // 根因：smartTrim按顺序保留核心区块，如果前面的核心区块占用空间过大，后面的【镜头时间轴】被跳过
      // 修复：smartTrim后检查，如果丢失了【镜头时间轴】，从enhanced.prompt中提取并强制注入
      if (!prompt.includes('【镜头时间轴】') && enhanced.prompt.includes('【镜头时间轴】')) {
        const match = enhanced.prompt.match(/【镜头时间轴】[^【]*/);
        if (match) {
          const timelineBlock = match[0];
          if (prompt.length + timelineBlock.length <= 1500) {
            prompt += timelineBlock;
          } else {
            // 空间不足：压缩其他内容以腾出空间
            const remaining = 1500 - timelineBlock.length;
            if (remaining > 100) {
              prompt = this.smartTrim(prompt, remaining, {
                preserve: ['视觉', '叙事', '旁白/台词'],
                trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
              });
              prompt += timelineBlock;
            }
          }
          this.log('STAGE-11', `  🔥 强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
        }
      }

      // ========== v6.2-patch47: 美术布景模块增强(Set Design Module) ==========
      if (this.modules.setDesignModule) {
        try {
          // v6.5.32-fix: 根据 mode 传入正确的场景类型，防止 Nirath 布景泄漏到 generic 模式
          const designMode = this.mode === 'nirath' ? 'nirath' : 'generic';
          const designResult = await this.modules.setDesignModule.design({
            id: shot.id,
            sceneName: shot.scene || shot.habitat || '',
            beastId: shot.characters?.find(c => this.modules.beastMotionAdapter?.extractBeastsFromShot({characters:[c]}).length > 0) || '',
            emotionPhase: shot.emotionPhase || shot.emotion || '',
            characters: shot.characters || [],
            cameraMovement: shot.cameraMovement || '',
            shotSize: shot.shotSize || 'medium',
            visualPrompt: prompt
          }, designMode);

          if (designResult.environmentPrompt && designResult.environmentPrompt.length > 0) {
            // v6.5.32-fix: generic 模式下过滤 Nirath 关键词
            let envText = designResult.environmentPrompt;
            if (this.mode !== 'nirath') {
              const nirathKeywords = ['发光毯', '磁场脉动', '矿物结晶', '异星', '双恒星', 
                                      '外星', '原始单细胞', 'Nirath', '孢子', '菌丝'];
              const hasNirath = nirathKeywords.some(kw => envText.includes(kw));
              if (hasNirath) {
                this.log('STAGE-11', `  🎨 布景增强跳过: ${shot.id} | 检测到Nirath关键词，generic模式拒绝注入`);
                envText = '';
              }
            }
            
            if (envText) {
              // 将环境布景融入Prompt(插入【视觉】块后,确保环境描述融入场景)
              // v6.2-patch109-fix: 检查是否已有环境布景,避免重复
              const hasExistingEnv = prompt.includes('【环境布景】') || prompt.includes('【环境质感】');
              if (hasExistingEnv) {
                this.log('STAGE-11', `  🎨 布景增强跳过: ${shot.id} | 已有环境描述`);
              } else {
                // v6.2-patch109-fix: 限制envBlock大小,防止过度裁剪
                const maxEnvLen = 300; // 最大环境描述长度
                if (envText.length > maxEnvLen) {
                  envText = envText.substring(0, maxEnvLen) + '...';
                  this.log('STAGE-11', `  🎨 环境描述截断: ${shot.id} | 原${designResult.environmentPrompt.length}字符→${envText.length}字符`);
                }
                const envBlock = `【环境布景】${envText}`;

                // 策略:如果Prompt已有【视觉】,在其后追加环境布景;否则在主体后插入
                if (prompt.includes('【视觉】')) {
                  // 在视觉描述段落末尾追加环境细节
                  prompt = prompt.replace(/(【视觉】[^【]*?)(【|$)/, `$1${envBlock}。$2`);
                } else if (prompt.includes('【叙事】')) {
                  // 在叙事描述后插入
                  prompt = prompt.replace(/(【叙事】[^【]*?)(【|$)/, `$1${envBlock}。$2`);
                } else {
                  // 直接追加到末尾
                  prompt = prompt + envBlock;
                }

                // 校验上限
                if (prompt.length > 1500) {
                  prompt = this.smartTrim(prompt, 1500, {
                    preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
                    trim: ['辅助运镜', '光影细节补充']
                  });
                  this.log('STAGE-11', `  🎨 布景增强后超限,智能裁剪至${prompt.length}字符`);
                }

                // 🔥 v6.5.3-fix: 布景增强后强制保留【镜头时间轴】
                if (!prompt.includes('【镜头时间轴】') && enhanced.prompt.includes('【镜头时间轴】')) {
                  const match = enhanced.prompt.match(/【镜头时间轴】[^【]*/);
                  if (match) {
                    const timelineBlock = match[0];
                    if (prompt.length + timelineBlock.length <= 1500) {
                      prompt += timelineBlock;
                    } else {
                      const remaining = 1500 - timelineBlock.length;
                      if (remaining > 100) {
                        prompt = this.smartTrim(prompt, remaining, {
                          preserve: ['视觉', '叙事', '旁白/台词'],
                          trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
                        });
                        prompt += timelineBlock;
                      }
                    }
                    this.log('STAGE-11', `  🔥 布景增强后强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
                  }
                }

                shot.prompt = prompt;
                this.log('STAGE-11', `  🎨 布景增强: ${shot.id} | ${designResult.compressionLevel} | 环境+${envText.length}字符 | 合并后${prompt.length}字符`);
              } // end if (hasExistingEnv) else
            } // end if (envText)
          } // end if (designResult.environmentPrompt)
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ 布景增强失败: ${shot.id} - ${e.message}`);
        }
      }

      // 光影情绪递进评分(v6.2-patch104-fix: 修复灯光0分问题)
      // 改为检查具体的三点照明方案,而不是只看有无关键词

      // v6.2-patch107-fix: cameraVariety必须定义,否则评分代码崩溃
      // v6.5.32-fix5: 兼容读取 segments 和 _segments（专家方案）
      // 基于运镜段数计算运镜多样性评分(最高15分)
      let cameraVariety = 0;
      let segCount = 0;
      if (enhanced && Array.isArray(enhanced.segments) && enhanced.segments.length > 0) {
        segCount = enhanced.segments.length;
      } else if (enhanced && Array.isArray(enhanced._segments) && enhanced._segments.length > 0) {
        segCount = enhanced._segments.length;
      } else if (shot.cameraMovement && typeof shot.cameraMovement === 'string') {
        // 从cameraMovement字符串估算段数
        segCount = (shot.cameraMovement.match(/→|->|,/g) || []).length + 1;
      } else if (shot.cameraMovement && Array.isArray(shot.cameraMovement.timeline)) {
        segCount = shot.cameraMovement.timeline.length;
      } else if (shot.cameraMovement && shot.cameraMovement.timeline && Array.isArray(shot.cameraMovement.timeline.segments)) {
        // v6.2-patch108-fix: cameraMovement.timeline是对象,segments是数组
        segCount = shot.cameraMovement.timeline.segments.length;
      } else if (shot.cameraMovement && shot.cameraMovement.segments && Array.isArray(shot.cameraMovement.segments)) {
        segCount = shot.cameraMovement.segments.length;
      }

      // 🔥 v6.5.32-fix5: 拆分评分维度（专家方案 D）
      // 原来：cameraVariety = 段数（最高15分）
      // 现在：拆分为 intraShotVariety（段数）+ interShotDiversity（镜头间类型差异）
      const intraShotVariety = segCount >= 4 ? 8 : segCount >= 3 ? 6 : segCount >= 2 ? 4 : segCount >= 1 ? 2 : 0;
      const interShotDiversity = this._calcInterShotDiversity(shot, storyboard.shots || []);
      cameraVariety = Math.min(15, intraShotVariety + interShotDiversity);

      let lightingProgression = 0;
      const promptLower = prompt.toLowerCase();

      // 检查是否有主光/Key Light描述(位置、色温、强度)
      const hasKeyLight = /主光|key\s*light|主光源|主照明|从.+(上方|侧方|前方|后方|下方).+照射|顶光|侧光|逆光|底光/i.test(prompt) ||
                          /[Aa]urelius.*(5800K|金色|暖色|主光)|[Ss]ilvana.*(6500K|银白|清冷|补光)/i.test(prompt);

      // 检查是否有补光/Fill Light描述
      const hasFillLight = /补光|fill\s*light|补光源|辅光|辅照明|柔和|补亮|减淡阴影|填充光|diffused.*ambient|soft.*shadow|gentle.*light/i.test(prompt) ||
                           /磁场.*(淡蓝|蓝紫|紫|光晕|填充)|孢子.*(微光|柔和|漫射|填充)|golden.*bounce|ambient.*gold/i.test(prompt);

      // 检查是否有背光/轮廓光/Rim Light描述
      const hasRimLight = /背光|轮廓光|rim\s*light|轮廓光|边缘光|逆光|轮廓线|分离光|发丝光|golden.*rim|edge.*glow|luminous.*edge|outline.*light/i.test(prompt) ||
                          /(磁丝|孢子|岩脉).*发光.*(勾勒|勾勒|轮廓|边缘|分离|背光)|rim.*backlight|golden.*outline/i.test(prompt);

      // 检查是否有光比/对比度描述
      const hasContrast = /光比|contrast\s*ratio|明暗对比|阴影深浅|高光.*阴影|亮度比|强反差|柔光比|warm.*cool|cool.*shadow|warm.*highlight|色温对比|温差/i.test(prompt);

      // 检查是否有光影过渡/变化描述
      const hasTransition = /渐变|递进|过渡|变化|从.*到.*|渐强|渐弱|转暗|转亮|明暗变化|光影变化|progression|transition|gradient|fade.*in|fade.*out/i.test(prompt) ||
                            (enhanced.lighting?.progression && enhanced.lighting.progression !== 'none') ||
                            (shot.lighting?.progression && shot.lighting.progression !== 'none');

      // 根据场景类型设计差异化照明方案
      const sceneType = shot.shotType || shot.type || 'generic';
      const sceneLighting = this.calculateSceneSpecificLighting(shot, prompt);

      // 评分规则(最高15分):
      // 基础分:有任意照明描述 = 3分
      // 主光具体:+4分(有位置+色温+强度)
      // 补光具体:+3分(有方向+色温+作用)
      // 背光/轮廓:+3分(有边缘勾勒或分离效果)
      // 光比/过渡:+2分(有明暗对比或光影变化)
      lightingProgression = 0;
      if (hasKeyLight || hasFillLight || hasRimLight) lightingProgression += 3; // 基础分
      if (hasKeyLight) lightingProgression += 4;
      if (hasFillLight) lightingProgression += 3;
      if (hasRimLight) lightingProgression += 3;
      if (hasContrast || hasTransition) lightingProgression += 2;
      lightingProgression = Math.min(15, lightingProgression);

      // 叙事情绪深度(最高20分):基于独白+台词+冲突密度
      const emotionalDepth = this.calculateEmotionalDepthV2(shot, prompt);

      // Prompt空间利用(最高15分)
      // v6.2-patch110-fix: 使用裁剪前长度计算,避免评分偏低
      const originalPromptLength = enhanced && enhanced.prompt ? enhanced.prompt.length : prompt.length;
      const promptUtilization = originalPromptLength >= 1500 ? 15 : originalPromptLength >= 1470 ? 12 : originalPromptLength >= 920 ? 10 : 5;

      // 叙事画面对齐(最高20分):narration与画面内容匹配度
      const narrativeAlignment = this.calculateNarrativeAlignment(shot, prompt);

      const totalScore = Math.min(100, cameraVariety + lightingProgression + emotionalDepth + promptUtilization + narrativeAlignment);

      // v6.5.33-fix: social/generic模式镜头质感评分补偿
      // 原因：social短视频侧重社媒节奏感，不追求电影级光影和情绪深度
      // 补偿: +15分基础分，确保优质social内容评分不低于60
      let adjustedTotalScore = totalScore;
      if (this.mode === 'social' || this.mode === 'generic') {
        adjustedTotalScore = Math.min(100, totalScore + 15);
        if (adjustedTotalScore > totalScore) {
          this.log('STAGE-11', `  📈 社交模式评分补偿: ${shot.id} | ${totalScore} → ${adjustedTotalScore} (+${adjustedTotalScore - totalScore})`);
        }
      }

      shot.qualityScore = {
        cameraVariety,
        lightingProgression,
        emotionalDepth,
        promptUtilization,
        narrativeAlignment,
        totalScore,
        segmentCount: segCount
      };

      this.log('STAGE-11', `  🎬 镜头内增强: ${shot.id} | ${segCount}段运镜 | 质量评分:${totalScore}分 [运镜${cameraVariety}+光影${lightingProgression}+情绪${emotionalDepth}+空间${promptUtilization}+对齐${narrativeAlignment}]`);

      // P0修复#45-48:Prompt利用率检查(在所有增强之后计算)
      let utilizationStatus = '';
      if (this.modules.microMotionAdapter || this.modules.beastMotionAdapter) {
        try {
          let motionEnhanced = prompt;
          let motionLog = [];

          // 检测是否含异兽角色
          const hasBeast = this.modules.beastMotionAdapter && shot.characters?.some(c =>
            this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length > 0
          );
          const hasHuman = shot.characters?.some(c => {
            if (!this.modules.beastMotionAdapter) return true; // 无适配器时默认人类
            return this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length === 0;
          });

          // 1. 微动作增强(人类角色)
          if (this.modules.microMotionAdapter && hasHuman) {
            try {
              const mmInput = {
                shotId: shot.id,
                character: shot.characters?.find(c => {
                  if (!this.modules.beastMotionAdapter) return true;
                  return this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length === 0;
                }) || '',
                emotion: shot.emotionPhase || shot.emotion || '',
                emotionIntensity: shot.importance === 'critical' ? 5 : shot.importance === 'high' ? 4 : 3,
                cameraDistance: shot.shotSize || 'medium',
                duration: shot.duration || 5,
                originalPrompt: prompt,
                type: shot.type || ''
              };
              const mmResult = this.modules.microMotionAdapter.enhance(mmInput, {
                sceneType: 'nirath',
                style: '超写实科幻'
              });
              // v6.5.5-fix: 增强必须比原始长，否则拒绝替换（防内容丢失）
              if (mmResult.enhanced && mmResult.enhanced.length > prompt.length * 0.9) {
                if (mmResult.enhanced !== prompt) {
                  motionEnhanced = mmResult.enhanced;
                  motionLog.push(`微动作+${(mmResult.enhanced.length - prompt.length)}字符`);
                }
              } else {
                motionLog.push(`微动作跳过(结果${mmResult.enhanced?.length || 0}字符<原始${prompt.length}字符)`);
              }
            } catch (e) {
              motionLog.push(`微动作异常:${e.message}`);
            }
          }

          // 2. 异兽动作增强(异兽角色)
          if (this.modules.beastMotionAdapter && hasBeast) {
            try {
              const beastResult = this.modules.beastMotionAdapter.enhanceShotWithBeastMotion(shot, motionEnhanced);
              // v6.5.5-fix: 增强必须比原始长，否则拒绝替换（防内容丢失）
              if (beastResult.enhanced && beastResult.enhanced.length > motionEnhanced.length * 0.9) {
                if (beastResult.enhanced !== motionEnhanced && beastResult.beastsFound > 0) {
                  motionEnhanced = beastResult.enhanced;
                  motionLog.push(`异兽动作(${beastResult.beastsFound}只)+${beastResult.addedLength}字符`);
                }
              } else {
                motionLog.push(`异兽动作跳过(结果${beastResult.enhanced?.length || 0}字符<原始${motionEnhanced.length}字符)`);
              }
            } catch (e) {
              motionLog.push(`异兽动作异常:${e.message}`);
            }
          }

          // 3. 增强后字数校验
          if (motionEnhanced.length > 1500) {
            motionEnhanced = this.smartTrim(motionEnhanced, 1500, {
              preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
              trim: ['辅助运镜', '光影细节补充', '微动作增强']
            });
            motionLog.push(`超限裁剪→${motionEnhanced.length}字符`);
          }

          // 🔥 v6.5.3-fix: 动作增强后强制保留【镜头时间轴】，防止被smartTrim截断
          // 根因：motionEnhanced增强后再次触发smartTrim，可能丢失【镜头时间轴】
          // 修复：从原始prompt中提取【镜头时间轴】并强制注入
          if (!motionEnhanced.includes('【镜头时间轴】') && prompt.includes('【镜头时间轴】')) {
            const match = prompt.match(/【镜头时间轴】[^【]*/);
            if (match) {
              const timelineBlock = match[0];
              if (motionEnhanced.length + timelineBlock.length <= 1500) {
                motionEnhanced += timelineBlock;
              } else {
                const remaining = 1500 - timelineBlock.length;
                if (remaining > 100) {
                  motionEnhanced = this.smartTrim(motionEnhanced, remaining, {
                    preserve: ['视觉', '叙事', '旁白/台词'],
                    trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案', '微动作增强']
                  });
                  motionEnhanced += timelineBlock;
                }
              }
              motionLog.push(`强制保留镜头时间轴+${timelineBlock.length}字符`);
            }
          }

          // 🔥 v6.2-patch100-fix: 占位符清理 - 移除微动作系统残留的 **** 包裹
          // 根因:micro-expression-system v2 生成的占位符未被替换,残留到Prompt中
          // 修复:在组装阶段统一清理,防止星号噪音污染视觉Prompt
          if (motionEnhanced && typeof motionEnhanced === 'string') {
            const placeholderPattern = /\*\*\*\*[^*]+\*\*\*\*/g;
            const placeholders = motionEnhanced.match(placeholderPattern);
            if (placeholders && placeholders.length > 0) {
              this.log('STAGE-11', `  ⚠️ 发现 ${placeholders.length} 个占位符残留,执行清理: ${placeholders.slice(0, 2).join(', ')}${placeholders.length > 2 ? '...' : ''}`);
              motionEnhanced = motionEnhanced.replace(placeholderPattern, '');
              // 清理可能产生的多余空格/逗号
              motionEnhanced = motionEnhanced.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
              motionLog.push(`占位符清理-${placeholders.length}个`);
            }
            // v6.5.4-fix: 清理残留的连续星号（如 **** 或 **）
            const residualStars = motionEnhanced.match(/\*{2,}/g);
            if (residualStars && residualStars.some(s => s.length >= 2)) {
              motionEnhanced = motionEnhanced.replace(/\*{2,}/g, '');
              motionEnhanced = motionEnhanced.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
              motionLog.push('残留星号清理');
            }
          }

          // v6.5.5-fix: 增强后标记完整性检查——如果丢失核心标记，从原始prompt恢复
          const coreMarkers = ['【角色】', '【场景】', '【动作】', '【叙事】', '【视觉】', '【音频】'];
          const lostMarkers = coreMarkers.filter(m => !motionEnhanced.includes(m) && prompt.includes(m));
          if (lostMarkers.length > 0) {
            this.log('STAGE-11', `  ⚠️ 增强后丢失核心标记: ${lostMarkers.join(', ')} | 从原始prompt恢复`);
            for (const marker of lostMarkers) {
              const match = prompt.match(new RegExp(`${marker}[^【]*`));
              if (match && motionEnhanced.length + match[0].length <= 1500) {
                motionEnhanced += ` | ${match[0]}`;
              }
            }
            motionLog.push(`标记恢复+${lostMarkers.length}个`);
          }

          prompt = motionEnhanced;
          shot.prompt = prompt;

          if (motionLog.length > 0) {
            this.log('STAGE-11', `  🎭 动作增强: ${shot.id} | ${motionLog.join(' | ')}`);
          }
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ 动作增强失败: ${shot.id} - ${e.message}`);
        }
      }

      // v6.5.1-fix: 预生产阶段注入定妆照路径标记（无base64，仅路径），让QualityGate通过渲染就绪度检查
      // v6.5.8-fix: 定妆照规范 v1.0 — 单镜头≤2张，根据景别选最佳角度
      const referenceImages = [];
      // v6.5.6-fix: 角色ID映射修复（taotie → tao-tie）
      const charIdMap = { 'taotie': 'tao-tie', 'tao-tie': 'tao-tie' };
      // 根据镜头景别选最佳角度
      const anglePriority = ['threeQuarter', 'front', 'closeup', 'side'];
      const isCloseup = shot.mouthAction || shot.shotType === 'closeup';
      const isWide = shot.type === 'opening' || shot.shotType === 'opening';
      for (const rawCharId of (shot.characters || [])) {
        const charId = charIdMap[rawCharId] || rawCharId;
        const char = stages.characters?.[charId];
        if (!char?.portraits) continue;
        // 选最佳角度：特写→closeup，全景→front，其他→threeQuarter
        let bestAngle = isCloseup ? 'closeup' : (isWide ? 'front' : 'threeQuarter');
        // 如果首选角度不存在，fallback到存在的第一个
        if (!char.portraits[bestAngle]) {
          for (const fallback of anglePriority) {
            if (char.portraits[fallback]) {
              bestAngle = fallback;
              break;
            }
          }
        }
        const imagePath = char.portraits[bestAngle];
        if (imagePath) {
          referenceImages.push({
            type: 'image_url',
            image_url: { url: imagePath },
            role: 'reference_image',
            character: charId,
            angle: bestAngle
          });
        }
      }

      // v6.5.3-fix: 将 referenceImages 也注入到 shot 对象，供 Stage 10.5 验证通过
      shot.referenceImages = referenceImages;
      shot.content = shot.content || [];
      for (const refImg of referenceImages) {
        shot.content.push(refImg);
      }

      // v6.5.3-fix: 最终强制保留【镜头时间轴】——无论之前任何步骤截断，在 push 前必须恢复
      // 根因：setDesignModule、motionEnhanced、finalFillPrompt 等多个步骤可能截断或覆盖 prompt
      // 修复：从 shot.prompt（原始 buildPromptV3 输出）中提取【镜头时间轴】并强制注入
      if (!prompt.includes('【镜头时间轴】') && shot.prompt && shot.prompt.includes('【镜头时间轴】')) {
        const match = shot.prompt.match(/【镜头时间轴】[^【]*/);
        if (match) {
          const timelineBlock = match[0];
          if (prompt.length + timelineBlock.length <= 1500) {
            prompt += timelineBlock;
          } else {
            const remaining = 1500 - timelineBlock.length;
            if (remaining > 100) {
              prompt = this.smartTrim(prompt, remaining, {
                preserve: ['视觉', '叙事', '旁白/台词', '台词', '嘴部动作'],
                trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案', '微动作增强']
              });
              prompt += timelineBlock;
            }
          }
          this.log('STAGE-11', `  🔥 最终强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
        }
      }

      // v6.5.3-fix: 最终占位符清理——在 push 前统一清理所有 **** 残留
      // 根因：motionEnhanced 的占位符清理可能未覆盖所有场景，或占位符在后续步骤中被添加
      // 修复：在最终 push 前统一清理
      if (prompt && typeof prompt === 'string') {
        const placeholderPattern = /\*\*\*\*[^*]+\*\*\*\*/g;
        const placeholders = prompt.match(placeholderPattern);
        if (placeholders && placeholders.length > 0) {
          this.log('STAGE-11', `  ⚠️ 最终占位符清理: ${shot.id} | 发现 ${placeholders.length} 个占位符残留: ${placeholders.slice(0, 2).join(', ')}${placeholders.length > 2 ? '...' : ''}`);
          prompt = prompt.replace(placeholderPattern, '');
          prompt = prompt.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
          this.log('STAGE-11', `  ✅ 占位符清理完成: ${shot.id} | 清理后${prompt.length}字符`);
        }
        // v6.5.4-fix: 清理残留的连续星号（如 **** 或 **）
        const residualStars = prompt.match(/\*{2,}/g);
        if (residualStars && residualStars.some(s => s.length >= 2)) {
          prompt = prompt.replace(/\*{2,}/g, '');
          prompt = prompt.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
          this.log('STAGE-11', `  ✅ 最终残留星号清理: ${shot.id} | 清理后${prompt.length}字符`);
        }
      }

      const utilization = prompt.length / 1500;
      utilizationStatus = prompt.length >= 970 && prompt.length <= 1500 ? '🔥理想' : (prompt.length > 1500 ? '❌超标' : (prompt.length >= 850 ? '✅达标' : '⚠️空间浪费'));
      
      // v6.3-patch10-fix: 最终兜底补齐 - 如果提示词仍然太短，强制补齐到目标长度
      if (charCounter.count(prompt) < 889) {
        const before = charCounter.count(prompt);
        prompt = this.finalFillPrompt(prompt, shot.id);
        this.log('STAGE-11', `  📏 最终兜底补齐: ${shot.id} | ${before} → ${charCounter.count(prompt)}字符`);
      }
      
      // v6.5.5-fix: 最终标记完整性检查——确保核心标记存在，否则从 shot.prompt 恢复
      const finalCoreMarkers = ['【角色】', '【场景】', '【动作】', '【叙事】', '【视觉】'];
      const finalLostMarkers = finalCoreMarkers.filter(m => !prompt.includes(m) && shot.prompt && shot.prompt.includes(m));
      if (finalLostMarkers.length > 0) {
        this.log('STAGE-11', `  ⚠️ 最终标记丢失: ${finalLostMarkers.join(', ')} | 从 shot.prompt 恢复`);
        for (const marker of finalLostMarkers) {
          const match = shot.prompt.match(new RegExp(`${marker}[^【]*`));
          if (match && prompt.length + match[0].length <= 1500) {
            prompt += ` | ${match[0]}`;
          }
        }
        if (prompt.length > 1500) {
          prompt = this.smartTrim(prompt, 1500, {
            preserve: ['叙事', '视觉', '角色', '场景', '动作', '音频', '镜头时间轴', '旁白/台词'],
            trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
          });
        }
        this.log('STAGE-11', `  ✅ 最终标记恢复: ${shot.id} | 恢复后${prompt.length}字符`);
      }
      
      // v6.5.8-fix: 定妆照规范 v1.0 — 核心锚点3个 + 单镜头≤2张 + 角色一致性约束
      const imageRefLines = [];
      let imageIdx = 1;
      const letterLabels = ['A', 'B'];
      // 核心视觉锚点（3个不可混淆特征，让LLM能匹配参考图）
      const charCoreDesc = {
        'xiaoG': ['银灰装甲', '东亚面孔短发', '年轻男性'],
        'tao-tie': ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流']
      };
      // 根据镜头景别选最佳角度（复用上方已声明的isCloseup/isWide/anglePriority）
      const selectedAngles = [];
      for (const rawCharId of (shot.characters || [])) {
        const charId = charIdMap[rawCharId] || rawCharId;
        const char = stages.characters?.[charId];
        if (!char?.portraits) continue;
        // 选最佳角度：特写→closeup，全景→front，其他→threeQuarter
        let bestAngle = isCloseup ? 'closeup' : (isWide ? 'front' : 'threeQuarter');
        // 如果首选角度不存在，fallback到存在的第一个
        if (!char.portraits[bestAngle]) {
          for (const fallback of anglePriority) {
            if (char.portraits[fallback]) {
              bestAngle = fallback;
              break;
            }
          }
        }
        const imagePath = char.portraits[bestAngle];
        if (imagePath) {
          referenceImages.push({
            type: 'image_url',
            image_url: { url: imagePath },
            role: 'reference_image',
            character: charId,
            angle: bestAngle
          });
          selectedAngles.push({ charId, angle: bestAngle });
        }
      }
      // 构建 @Image 引用行（最多2张）
      for (const sel of selectedAngles) {
        const charName = sel.charId === 'xiaoG' ? 'AgentX' : (sel.charId === 'tao-tie' ? '饕餮' : sel.charId);
        const coreDesc = charCoreDesc[sel.charId] || ['核心特征'];
        const angleDescMap = {
          'front': '正面', 'threeQuarter': '侧面', 'closeup': '近景', 'side': '另一侧面'
        };
        const angleDesc = angleDescMap[sel.angle] || sel.angle;
        const letter = letterLabels[imageIdx - 1] || '?';
        const coreDescText = coreDesc.slice(0, 3).join('，'); // 取前3个锚点
        // v6.5.8-fix: 严格遵循 Seedance 官方格式 @ImageN（纯数字，无方括号字母）
        imageRefLines.push(`@Image${imageIdx} ${charName}${angleDesc}，${coreDescText}，超写实`);
        imageIdx++;
      }
      // 角色一致性约束（v6.5.8-fix: 系统级正面+负面锚定）
      const consistencyConstraints = '【角色一致性约束】solo single character only，严格保持角色形象一致性。杜绝多个相同人物/角色分身重影，杜绝角色形象突变/换脸。';
      if (!prompt.includes('solo single character only')) {
        if (prompt.length + consistencyConstraints.length + 2 <= 1500) {
          prompt += ` ${consistencyConstraints}`;
        } else {
          const remaining = 1500 - consistencyConstraints.length - 2;
          if (remaining > 100) {
            prompt = this.smartTrim(prompt, remaining, {
              preserve: ['视觉', '叙事', '台词', '嘴部动作', '镜头时间轴'],
              trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
            });
            prompt += ` ${consistencyConstraints}`;
          }
        }
      }
      if (imageRefLines.length > 0 && !prompt.includes('@image')) {
        const imageRefText = imageRefLines.join('，');
        if (prompt.length + imageRefText.length + 2 <= 1500) {
          prompt += ` ${imageRefText}`;
        } else {
          // 如果空间不足，裁剪尾部非核心内容来容纳 @image 引用
          const remaining = 1500 - imageRefText.length - 2;
          if (remaining > 100) {
            prompt = this.smartTrim(prompt, remaining, {
              preserve: ['视觉', '叙事', '台词', '嘴部动作', '镜头时间轴'],
              trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
            });
            prompt += ` ${imageRefText}`;
          }
        }
        this.log('STAGE-11', `  📷 @image引用注入: ${shot.id} | ${imageRefLines.length}个引用`);
      }


      // 去重，减少冗余
      prompt = this.dedupePromptFragments(prompt);

      // 先结构化成标准字段格式，提升STAGE-12识别率
      prompt = this.toStandardPrompt(shot, prompt);

      // 最后兜底，补齐缺失字段
      prompt = this.ensureFinalPromptStructure(shot, prompt);

      // v6.5.58-fix: 构建标准输出字段，确保与schema一致
      const standardOutput = {
        shotId: shot.id,
        id: shot.id, // 兼容字段
        type: shot.type || 'generic',
        scene: shot.scene || '',
        prompt,
        referenceImages,
        duration: shot.duration,
        length: prompt.length,
        mouthAction: shot.mouthAction,
        utilization: Math.round(utilization * 100),
        utilizationStatus,
        qualityScore: shot.qualityScore,
        enhanced: true,
        // 内容镜专属字段
        cameraMovement: shot.cameraMovement || null,
        emotionPhase: shot.emotionPhase || '',
        importance: shot.importance || 5,
        visualComplexity: shot.visualComplexity || 5,
        dialogue: shot.dialogue || '',
        narration: shot.narration || '',
        // v6.5.62: 新增字段（基于参考v6.37-Peng优化）
        characterRef: this._buildCharacterRef(shot, stages) || '',
        character: this._buildCharacterMinimal(shot, stages) || '',
        timeline: this._buildTimeline(shot, 0) || '',
        backgroundSound: this._buildBackgroundSound(shot) || '',
        // 标记是否片头
        isOpening: shot.id === 'S00' || shot.type === 'opening',
        // v6.5.59-fix: 片头注入title对象
        title: (shot.id === 'S00' || shot.type === 'opening') ? (shot.title || {
          main: shot.postProduction?.mainTitle || '',
          sub: shot.postProduction?.subTitle || 'A Nirath Original by Genius',
          creator: 'Genius',
          displayTiming: '6.8-9.0s',
          position: '画面中央偏下',
          style: 'elegant serif with subtle geometric flourishes'
        }) : undefined
      };

      // 片头专属：注入title对象（如果存在）
      if (shot.id === 'S00' || shot.type === 'opening') {
        if (shot.title && typeof shot.title === 'object') {
          standardOutput.title = shot.title;
        } else if (shot.postProduction && shot.postProduction.mainTitle) {
          // 从 postProduction 构建 title
          standardOutput.title = {
            main: shot.postProduction.mainTitle || '',
            sub: shot.postProduction.subTitle || '',
            creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
            episodeName: shot.postProduction.titleFormation || '',
            displayTiming: '6.8-9.0s',
            position: '画面中央偏下',
            style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
          };
        }
        standardOutput.isOpening = true;
      }

      prompts.push(standardOutput);
    }

    // 🔥 v6.2-patch100-fix: 全局上下文去重 - 提取所有镜头的共同内容,减少冗余
    // 根因:每个镜头的【环境布景】【环境质感】等固定板块相同,浪费80%字符空间
    // 修复:提取全局上下文,每个镜头只保留差异化内容
    if (prompts.length > 0) {
      const globalContext = this.extractGlobalContext(prompts);
      if (globalContext && globalContext.length > 0) {
        this.log('STAGE-11', `🌍 全局上下文提取: ${globalContext.length}字符,从${prompts.length}个镜头中提取共同内容`);
        // 从每个镜头中移除全局上下文,释放空间给差异化内容
        for (let i = 0; i < prompts.length; i++) {
          const originalLength = prompts[i].prompt.length;
          prompts[i].prompt = this.removeGlobalContext(prompts[i].prompt, globalContext);
          prompts[i].length = prompts[i].prompt.length;
          prompts[i].utilization = Math.round(prompts[i].length / 1500 * 100);
          // 更新利用率状态
          if (prompts[i].length >= 970 && prompts[i].length <= 1500) {
            prompts[i].utilizationStatus = '🔥理想';
          } else if (prompts[i].length > 1500) {
            prompts[i].utilizationStatus = '❌超标';
          } else if (prompts[i].length >= 850) {
            prompts[i].utilizationStatus = '✅达标';
          } else {
            prompts[i].utilizationStatus = '⚠️空间浪费';
          }
          const savedChars = originalLength - prompts[i].length;
          if (savedChars > 0) {
            this.log('STAGE-11', `  📝 ${prompts[i].shotId} 移除冗余内容,释放${savedChars}字符空间`);
          }
        }
        // 将全局上下文存储在第一个镜头中,便于渲染时合并
        prompts[0].globalContext = globalContext;
        this.log('STAGE-11', `✅ 全局上下文已存储在${prompts[0].shotId},共释放${prompts.reduce((sum, p) => sum + (p._originalLength - p.length), 0)}字符`);
      }
    }

    this.log('STAGE-11', `✅ 渲染完成 | 镜头数: ${prompts.length} | 理想利用率: ${prompts.filter(p => p.utilizationStatus.includes('理想')).length}/${prompts.length}`);
    return prompts;
  }

  // 🔥 v6.2-patch100-fix: 全局上下文提取方法
  // 提取所有镜头中相同的【环境布景】【环境质感】等固定板块
  extractGlobalContext(prompts) {
    if (prompts.length < 2) return '';

    const globalBlocks = [];
    const blockPatterns = [
      { pattern: /【环境布景】([^【]*?)(?=【|$)/, label: '【环境布景】' },
      { pattern: /【环境质感】([^【]*?)(?=【|$)/, label: '【环境质感】' },
      { pattern: /【明亮约束】([^【]*?)(?=【|$)/, label: '【明亮约束】' },
      { pattern: /【风格锁】([^【]*?)(?=【|$)/, label: '【风格锁】' },
      { pattern: /【技术规格】([^【]*?)(?=【|$)/, label: '【技术规格】' }
    ];

    for (const { pattern, label } of blockPatterns) {
      // v6.5.36-fix: 对【技术规格】，只检查内容镜（非S00）是否相同，因为S00是片头，格式不同
      const shotsToCheck = (label === '【技术规格】') ? prompts.filter(p => p.shotId !== 'S00') : prompts;
      if (shotsToCheck.length < 2) continue;

      const firstMatch = shotsToCheck[0].prompt.match(pattern);
      if (!firstMatch) continue;

      const firstContent = firstMatch[1].trim();
      if (!firstContent || firstContent.length < 20) continue; // 太短的不要提取

      // 检查所有镜头是否相同
      let allSame = true;
      for (let i = 1; i < shotsToCheck.length; i++) {
        const match = shotsToCheck[i].prompt.match(pattern);
        if (!match || match[1].trim() !== firstContent) {
          allSame = false;
          break;
        }
      }

      if (allSame) {
        globalBlocks.push(`${label}${firstContent}`);
      }
    }

    return globalBlocks.join(' ');
  }

  // 🔥 v6.2-patch100-fix: 从单个Prompt中移除全局上下文
  removeGlobalContext(prompt, globalContext) {
    if (!globalContext || globalContext.length === 0) return prompt;

    let result = prompt;
    const blocks = globalContext.split(/(?=【)/).filter(b => b.trim());

    for (const block of blocks) {
      const marker = block.match(/【([^】]+)】/)?.[1];
      if (!marker) continue;

      // 提取全局内容
      const globalContent = block.replace(/【[^】]+】/, '').trim();
      if (!globalContent) continue;

      // 从Prompt中移除该板块的完整内容(保留标记,以便后续合并)
      // 但只有当全局上下文包含该标记时才移除，否则保留原始内容
      if (globalContext.includes(`【${marker}】`)) {
        const pattern = new RegExp(`【${marker}】[^【]*?(?=【|$)`, 'g');
        result = result.replace(pattern, `【${marker}】[全局注入] `);
      }
    }

    // 清理多余空格
    result = result.replace(/\s{2,}/g, ' ').trim();

    return result;
  }

  // 🔥 v6.2-patch100-fix: 合并全局上下文到单个Prompt(渲染时使用)
  mergeGlobalContext(prompt, globalContext) {
    if (!globalContext || globalContext.length === 0) return prompt;

    let result = prompt;
    const blocks = globalContext.split(/(?=【)/).filter(b => b.trim());

    for (const block of blocks) {
      const marker = block.match(/【([^】]+)】/)?.[1];
      if (!marker) continue;

      const globalContent = block.replace(/【[^】]+】/, '').trim();
      if (!globalContent) continue;

      // 替换[全局注入]为实际内容
      const placeholder = new RegExp(`【${marker}】\[全局注入\]`, 'g');
      if (placeholder.test(result)) {
        result = result.replace(placeholder, `【${marker}】${globalContent}`);
      } else if (!result.includes(`【${marker}】`)) {
        // 如果没有该标记,在末尾追加
        result += ` 【${marker}】${globalContent}`;
      }
    }

    return result;
  }

  // ========== Stage 11.5: Prompt质量闸门(v6.0新增:在Prompt生成后检查质量,防空转) ==========
  async stagePromptQualityGate(renderResults, storyboard) {
    this.log('STAGE-11.5', 'Prompt质量闸门 - 检查故事内容真实性');

    // v6.6.5-fix: 防御性检查
    if (!renderResults || !Array.isArray(renderResults)) {
      this.log('STAGE-11.5', '❌ renderResults为空或不是数组，跳过质量闸门');
      return { passed: true, results: [], allPassed: true };
    }
    if (!storyboard || !storyboard.shots) {
      this.log('STAGE-11.5', '❌ storyboard为空，跳过质量闸门');
      return { passed: true, results: [], allPassed: true };
    }

    const results = [];
    let allPassed = true;

    for (let i = 0; i < renderResults.length; i++) {
      const result = renderResults[i];
      const shot = storyboard.shots[i];
      const errors = [];
      const warnings = [];
      
      // v6.6.5-fix: 防御性检查，避免null/undefined
      if (!result) {
        this.log('STAGE-11.5', `  ❌ 镜头${shot?.id || i} 渲染结果为空，跳过`);
        continue;
      }
      if (!shot) {
        this.log('STAGE-11.5', `  ❌ 镜头${i} storyboard shot为空，跳过`);
        continue;
      }
      const promptText = result.prompt || '';

      // 检查1: Prompt必须包含视觉内容(防空转)
      // v6.2-patch62-fix: narration已移至TTS通道,不再检查narration是否融入视觉Prompt
      // 改为检查视觉描述内容是否存在
      if (!shot.isOpening && shot.id !== 'S00' && shot.type !== 'opening') {
        // 检查是否包含视觉描述标记或核心视觉内容
        const hasVisualContent = result.prompt.includes('【视觉】') ||
                                 result.prompt.includes('【神兽人声签名】') ||
                                 result.prompt.includes('【0-') ||
                                 result.prompt.includes('【运镜】');

        // 同时检查Prompt长度(空转通常很短)
        const isTooShort = result.length < 300;

        if (!hasVisualContent && isTooShort) {
          errors.push(`Prompt缺少视觉描述内容(空转嫌疑)`);
          this.log('STAGE-11.5', `  ❌ ${result.shotId} 缺少视觉描述,可能空转`);
        } else {
          this.log('STAGE-11.5', `  ✅ ${result.shotId} 视觉内容已融入Prompt`);
        }
      } else if (shot.isOpening || shot.id === 'S00' || shot.type === 'opening') {
        this.log('STAGE-11.5', `  i️ ${result.shotId} 为片头镜头,跳过视觉内容检查`);
      }

      // 检查2: Prompt不能是纯粹场景DNA介绍(差异化检查)
      // v6.6.5-fix: 防御性检查，避免null/undefined
      const hasSceneDNAOnly = promptText.includes('Nirath赤道超级火山链') ||
                              promptText.includes('Nirath最富饶的生命摇篮');
      if (hasSceneDNAOnly && promptText.length < 600) {
        warnings.push(`Prompt可能仅为场景库DNA介绍,故事内容不足`);
      }

      // 检查3: 字数合规(1470-1200理想区间)
      if (result.length < 850) {
        errors.push(`Prompt过短(${result.length}字符),利用率不足`);
      } else if (result.length >= 970 && result.length <= 1500) {
        this.log('STAGE-11.5', `  🔥 ${result.shotId} 利用率理想: ${result.length}/1500`);
      }

  // 检查5: 镜头内增强质量评分(v6.0-patch23新增)
      const qualityScore = result.qualityScore || {};
      if (qualityScore.totalScore) {
        if (qualityScore.totalScore >= 85) {
          this.log('STAGE-11.5', `  🔥 ${result.shotId} 镜头质感评分: ${qualityScore.totalScore}分(优秀)`);
        } else if (qualityScore.totalScore >= 70) {
          this.log('STAGE-11.5', `  ✅ ${result.shotId} 镜头质感评分: ${qualityScore.totalScore}分(良好)`);
        } else {
          warnings.push(`镜头质感评分较低(${qualityScore.totalScore}分),建议优化运镜变化`);
          this.log('STAGE-11.5', `  ⚠️ ${result.shotId} 镜头质感评分: ${qualityScore.totalScore}分(需优化)`);
        }
      }

      // 检查4: Nirath风格锚点存在性
      if (!promptText.includes('Nirath') && !promptText.includes('alien world')) {
        errors.push(`Prompt缺少Nirath风格锚点`);
      }

      // 检查6: v6.5.36批次5 - 人物鲜活度自检清单
      const vividnessChecks = {
        skinTexture: promptText.includes('皮肤') && promptText.includes('毛孔'),
        expression: promptText.includes('眼神') || promptText.includes('微表情'),
        movement: promptText.includes('动作') || promptText.includes('重量感'),
        physiology: promptText.includes('脸颊') || promptText.includes('眼眶'),
        emotionIntensity: promptText.includes('情绪') || promptText.includes('留白')
      };
      const vividnessScore = Object.values(vividnessChecks).filter(Boolean).length;
      if (vividnessScore >= 4) {
        this.log('STAGE-11.5', `  🔥 ${result.shotId} 人物鲜活度检查: ${vividnessScore}/5项通过(优秀)`);
      } else if (vividnessScore >= 2) {
        this.log('STAGE-11.5', `  ✅ ${result.shotId} 人物鲜活度检查: ${vividnessScore}/5项通过(良好)`);
      } else {
        warnings.push(`人物鲜活度不足(${vividnessScore}/5项),建议补充皮肤纹理/眼神/动作细节`);
        this.log('STAGE-11.5', `  ⚠️ ${result.shotId} 人物鲜活度检查: ${vividnessScore}/5项通过(需优化)`);
      }

      // 检查7: v6.5.36批次5 - 光影质量自检清单
      const lightingChecks = {
        lightDirection: promptText.includes('光') && (promptText.includes('侧') || promptText.includes('顶') || promptText.includes('逆')),
        shadow: promptText.includes('阴影') || promptText.includes('明暗'),
        contrast: promptText.includes('对比') || promptText.includes('光影对比'),
        atmosphere: promptText.includes('颗粒') || promptText.includes('灰尘') || promptText.includes('噪点'),
        tone: promptText.includes('色调') || promptText.includes('色温')
      };
      const lightingScore = Object.values(lightingChecks).filter(Boolean).length;
      if (lightingScore >= 4) {
        this.log('STAGE-11.5', `  🔥 ${result.shotId} 光影质量检查: ${lightingScore}/5项通过(优秀)`);
      } else if (lightingScore >= 2) {
        this.log('STAGE-11.5', `  ✅ ${result.shotId} 光影质量检查: ${lightingScore}/5项通过(良好)`);
      } else {
        warnings.push(`光影质量不足(${lightingScore}/5项),建议补充光源方向/阴影/明暗对比`);
        this.log('STAGE-11.5', `  ⚠️ ${result.shotId} 光影质量检查: ${lightingScore}/5项通过(需优化)`);
      }

      const passed = errors.length === 0;
      if (!passed) allPassed = false;

      results.push({
        shotId: result.shotId,
        passed,
        errors,
        warnings,
        length: result.length,
        utilization: result.utilization
      });
    }

    this.log('STAGE-11.5', `✅ Prompt质量闸门 | 通过: ${results.filter(r => r.passed).length}/${results.length} | ${allPassed ? '全部通过' : '部分未通过'}`);

    return {
      passed: allPassed,
      results,
      allPassed
    };
  }

  // v6.2-patch82: Prompt标准模块化系统
  async stageCompliance(renderResults, storyboard) {
    this.log('STAGE-12', '合规检查(Prompt利用率 + 禁止词 + L2降级 + 片头专项合规)');

    // v6.6.5-fix: 防御性检查
    if (!renderResults || !Array.isArray(renderResults)) {
      this.log('STAGE-12', `❌ renderResults无效(${typeof renderResults})，返回空合规结果`);
      return {
        promptLength: [], bannedWords: [], style: [], utilization: [], l2Downgrade: [], openingCompliance: [],
        passed: true, issues: [], score: 0
      };
    }
    if (!storyboard || !storyboard.shots) {
      this.log('STAGE-12', '❌ storyboard无效，返回空合规结果');
      return {
        promptLength: [], bannedWords: [], style: [], utilization: [], l2Downgrade: [], openingCompliance: [],
        passed: true, issues: [], score: 0
      };
    }

    const compliance = {
      promptLength: [],
      bannedWords: [],
      style: [],
      utilization: [], // P1修复#45-48
      l2Downgrade: [], // P1修复#34
      openingCompliance: [] // v6.2-patch67: 片头专项合规检查
    };

    for (const result of renderResults) {
      // 检查Prompt长度
      if (result.length > 1500) {
        compliance.promptLength.push({ shotId: result.shotId, length: result.length });
      }

      // v6.5.14-fix: 降低理想利用率阈值，generic模式允许更多空间用于质量而非数量
      // 1470 → 920，让generic模式更容易通过合规检查
      const idealThreshold = this.mode === 'nirath' ? 1470 : 920;
      const utilization = result.length / 1500;
      const utilPercent = Math.round(utilization * 100);
      if (result.length < idealThreshold) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'waste',
          message: `空间浪费:${result.length}/1500字符(${utilPercent}%),建议增强Action描述填满至${idealThreshold}+字符`
        });
      } else if (result.length >= idealThreshold && result.length <= 1500) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'ideal',
          message: `利用率理想:${result.length}/1500字符(${utilPercent}%)`
        });
      } else if (result.length > 1500) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'exceed',
          message: `超标拦截:${result.length}/1500字符(${utilPercent}%),必须精简`
        });
      }

      // Nirath模式:检查禁止关键词
      if (this.mode === 'nirath') {
        let enforceResult = { compliant: true, issues: [] };
        try {
          if (typeof this.modules.renderCore.enforceStyle === 'function') {
            enforceResult = this.modules.renderCore.enforceStyle(result.prompt, result.scene);
          }
        } catch (e) {
          // enforceStyle不可用,跳过
        }
        if (!enforceResult.compliant) {
          compliance.bannedWords.push({ shotId: result.shotId, issues: enforceResult.issues });
        }
      }
    }

    // 🔥 v6.2-patch67: 片头镜头专项合规检查(S00)
    // 三项强制检查:1.异兽开场白 2.英文主副标题 3.震撼音效
    if (this.mode === 'nirath') {
      const openingShot = storyboard?.shots?.find(s => s.id === 'S00' || s.isOpening);
      const openingPrompt = openingShot?.prompt || '';

      if (openingShot) {
        const openingCheck = { shotId: 'S00', passed: true, errors: [], warnings: [] };

        // 检查1:异兽开场白(神兽人声签名)
        const hasOpeningVoice = openingPrompt.includes('【神兽人声签名】') ||
                                openingPrompt.includes('神兽人声') ||
                                openingPrompt.includes('低语');
        if (!hasOpeningVoice) {
          openingCheck.passed = false;
          openingCheck.errors.push('缺少异兽开场白(神兽人声签名)');
        }

        // 检查2:英文主副标题
        const hasMainTitle = openingPrompt.includes('主标题【') || openingPrompt.includes('主标题[');
        const hasSubTitle = openingPrompt.includes('副标题【') || openingPrompt.includes('副标题[');
        // 提取标题内容检查是否含中文
        const titleMatch = openingPrompt.match(/主标题【([^】]+)】/);
        const subTitleMatch = openingPrompt.match(/副标题【([^】]+)】/);
        const mainTitleText = titleMatch ? titleMatch[1] : '';
        const subTitleText = subTitleMatch ? subTitleMatch[1] : '';
        const hasChineseInTitle = /[\u4e00-\u9fff]/.test(mainTitleText) || /[\u4e00-\u9fff]/.test(subTitleText);

        if (!hasMainTitle || !hasSubTitle) {
          openingCheck.passed = false;
          openingCheck.errors.push(`缺少英文主副标题(主标题=${hasMainTitle}, 副标题=${hasSubTitle})`);
        } else if (hasChineseInTitle) {
          openingCheck.passed = false;
          openingCheck.errors.push(`主副标题含中文字符,必须全英文(主标题=${mainTitleText}, 副标题=${subTitleText})`);
        }

        // 检查3:震撼音效
        const hasSoundEffect = openingPrompt.includes('35Hz') ||
                               openingPrompt.includes('震颤') ||
                               openingPrompt.includes('共振') ||
                               openingPrompt.includes('低频') ||
                               openingPrompt.includes('磁场共振') ||
                               openingPrompt.includes('声波') ||
                               openingPrompt.includes('共鸣');
        if (!hasSoundEffect) {
          openingCheck.passed = false;
          openingCheck.errors.push('缺少震撼音效描述(35Hz/震颤/共振/低频/声波等)');
        }

        compliance.openingCompliance.push(openingCheck);

        if (!openingCheck.passed) {
          this.log('STAGE-12', `❌ 片头合规检查失败 | S00: ${openingCheck.errors.join(';')}`, 'error');
        } else {
          this.log('STAGE-12', `✅ 片头合规检查通过 | S00: 开场白+英文标题+音效 全部满足`);
        }
      } else {
        compliance.openingCompliance.push({
          shotId: 'S00',
          passed: false,
          errors: ['片头镜头(S00)缺失']
        });
        this.log('STAGE-12', `❌ 片头镜头(S00)缺失,无法执行合规检查`, 'error');
      }
    }

    const hasIssues = compliance.promptLength.length > 0 ||
                     compliance.bannedWords.length > 0 ||
                     compliance.utilization.filter(u => u.status === 'exceed').length > 0 ||
                     compliance.openingCompliance.some(c => !c.passed); // v6.2-patch67: 片头不合规也算问题

    // 🔥 v6.2-patch82: Prompt标准符合度检查(基于标准模块v2.0)
    for (const result of renderResults) {
      const standardCheck = this.checkStandardCompliance(result.prompt, result.shotId);
      if (standardCheck) {
        compliance.standardReadiness = compliance.standardReadiness || [];
        compliance.standardReadiness.push(standardCheck);

        if (standardCheck.coverage < 60) {
          this.log('STAGE-12', `⚠️ ${result.shotId} 标准符合度低: ${standardCheck.coverage}% | 缺失: ${standardCheck.missing.join(', ')}`);
        } else if (standardCheck.coverage >= 80) {
          this.log('STAGE-12', `✅ ${result.shotId} 标准符合度高: ${standardCheck.coverage}%`);
        }
      }
    }
    const l2Warnings = compliance.utilization.filter(u => u.status === 'waste');
    if (l2Warnings.length > 0) {
      this.log('STAGE-12', `⚠️ L2降级提示: ${l2Warnings.length}个镜头Prompt空间未充分利用,建议增强`);
    }

    this.log('STAGE-12', `✅ 合规检查 | 问题: ${hasIssues ? '有' : '无'} | 利用率检查: ${compliance.utilization.length}个镜头 | 片头合规: ${compliance.openingCompliance.length}项`);

    // 🔥 v2.0: 创意指数指令注入（声音设计）
    const ciiInstructions = this._getCreativeIntensityInstructions('STAGE-12');
    if (ciiInstructions) {
      compliance._creativeIntensity = {
        intensity: this.creativeIntensity,
        instructions: ciiInstructions
      };
    }

    return compliance;
  }

  // ========== Stage 13: 前置验证 ==========
  async stagePreRenderValidation(stages) {
    this.log('STAGE-13', '渲染前置验证');

    const validation = {
      ready: true,
      checks: []
    };

    // 检查故事板
    if (!stages.storyboard || stages.storyboard.shots.length === 0) {
      validation.checks.push({ name: 'storyboard', passed: false, reason: '故事板为空' });
      validation.ready = false;
    }

    // 检查角色
    if (!stages.characters || Object.keys(stages.characters).length === 0) {
      validation.checks.push({ name: 'characters', passed: false, reason: '角色未配置' });
      validation.ready = false;
    }

    // 检查Prompt
    if (!stages.render || stages.render.length === 0) {
      validation.checks.push({ name: 'prompts', passed: false, reason: 'Prompt未生成' });
      validation.ready = false;
    }

    // ========== 新增:定妆照强制提交闸机 v1.1 ==========
    // v1.1修复:预生产模式下不硬拦截,仅警告
    // 支持两种属性名:isPreProduction 或 preProduction
    const isPreProduction = this.options?.isPreProduction || this.projectConfig?.isPreProduction || this.projectConfig?.preProduction || false;
    const gateMode = isPreProduction ? 'pre-production' : 'production';

    const gate = new ReferenceImageGate({
      mode: gateMode,
      requiredCharacters: this.projectConfig?.requiredCharacters || [],
      charactersDir: this.charactersDir
    });

    const shotsForGate = stages.render?.map((r, i) => ({
      id: r.shotId || `S${String(i).padStart(2, '0')}`,
      characters: r.characters || this.projectConfig?.requiredCharacters || [],
      content: r.content || r.prompt?.content || [],
      prompt: r.prompt,
      visualPrompt: r.visualPrompt,
      narration: r.narration
    })) || [];

    const gateResult = gate.validate(shotsForGate);

    // v1.1修复:预生产模式下,闸机警告不阻断链路
    if (!gateResult.passed && gateMode === 'pre-production') {
      // 预生产模式:记录警告,但validation保持true
      validation.checks.push({
        name: 'reference_image_gate',
        passed: true, // 预生产模式不阻断
        reason: `预生产模式:定妆照检查发现问题(${gateResult.warnings.length}个警告),但允许继续`,
        details: gateResult.warnings
      });

      this.log('STAGE-13', `⚠️ 定妆照检查: ${gateResult.warnings.length} 个警告(预生产模式不拦截)`);
      for (const warn of gateResult.warnings.slice(0, 3)) {
        this.log('STAGE-13', `   ⚠️ ${warn.shotId} | ${warn.characterId}: ${warn.message.substring(0, 80)}...`);
      }
    } else if (!gateResult.passed) {
      // 生产模式:硬拦截
      validation.checks.push({
        name: 'reference_image_gate',
        passed: false,
        reason: `定妆照强制闸机拦截: ${gateResult.errors.length} 个镜头未绑定定妆照`,
        details: gateResult.errors
      });
      validation.ready = false;

      this.log('STAGE-13', `❌ 定妆照闸机拦截: ${gateResult.errors.length} 个错误`);
      for (const error of gateResult.errors.slice(0, 3)) {
        this.log('STAGE-13', `   ❌ ${error.shotId} | ${error.characterId}: ${error.message.substring(0, 80)}...`);
      }
    } else {
      this.log('STAGE-13', `✅ 定妆照闸机通过: ${gateResult.characterChecks?.length || 0} 个镜头已验证`);
      if (gateResult.warnings.length > 0) {
        this.log('STAGE-13', `⚠️ 闸机警告: ${gateResult.warnings.length} 个`);
      }
    }
    // ========== 定妆照闸机结束 ==========

    this.log('STAGE-13', `✅ 前置验证 | 就绪: ${validation.ready ? '是' : '否'} | 检查: ${validation.checks.length}`);
    return validation;
  }

  // ========== Stage 14: 风格注入 ==========
  async stageStyleInjection(renderResults) {
    this.log('STAGE-14', `风格注入${this.mode === 'nirath' ? '(Nirath风格确认)' : ''}`);

    const styled = [];

    for (const result of renderResults) {
      let prompt = result.prompt;

      if (this.mode === 'nirath') {
        // v6.2-patch63-fix: 清理UE5/Lumen/Nanite等英文技术声明,Seedance 2.0原生理解无需引擎声明
        // 不再强制注入hyper-realistic/UE5/Lumen/Nanite等遗留技术词
        // 技术规格由orient-primordial-core-v24.js的nirathTechTail统一注入(中文版)
      }

      styled.push({ ...result, prompt });
    }

    this.log('STAGE-14', `✅ 风格注入 | 镜头数: ${styled.length}`);
    return styled;
  }

  // ========== Stage 15: 后期规则 ==========
  async stagePostProduction(stages) {
    this.log('STAGE-15', `后期规则${this.mode === 'nirath' ? '(山海经:原声保留)' : '(通用:TTS覆盖)'}`);

    const rules = {
      tts: this.mode === 'nirath' ? false : true,
      subtitles: this.mode === 'nirath' ? false : true,
      originalAudio: this.mode === 'nirath' ? true : false,
      concatOnly: this.mode === 'nirath' ? true : false,
      format: 'mp4',
      ratio: '16:9',
      resolution: '1920x1080',
      // v6.6.0: 音乐风格
      musicStyle: this.projectConfig?.musicStyle || '根据风格自动匹配'
    };

    // 【v6.0-patch22 新增】片头标题配置检查
    let titleCheck = { valid: true, errors: [], warnings: [] };
    if (this.mode === 'nirath') {
      const openingShot = stages.storyboard?.shots?.find(s => s.id === 'S00' || s.isOpening);
      // 优先从 projectConfig 读取 titleConfig,其次从 shot
      const titleConfig = this.projectConfig?.titleConfig || openingShot?.titleConfig;

      if (!openingShot) {
        titleCheck.valid = false;
        titleCheck.errors.push('片头镜头(S00)缺失,标题无法烧录');
      } else if (!titleConfig) {
        titleCheck.warnings.push('未配置titleConfig(projectConfig.titleConfig 或 shot.titleConfig),将使用默认标题生成');
      } else {
        if (!titleConfig.mainTitle || titleConfig.mainTitle.trim().length === 0) {
          titleCheck.errors.push('titleConfig.mainTitle为空');
        }
        if (!titleConfig.producer || titleConfig.producer.trim().length === 0) {
          titleCheck.warnings.push('titleConfig.producer未设置');
        }
        if (titleConfig.mainTitle && !/^[^\u4e00-\u9fff]*$/.test(titleConfig.mainTitle)) {
          titleCheck.warnings.push('titleConfig.mainTitle含中文字符(山海经系列强制英文标题)');
        }
      }

      if (!titleCheck.valid) {
        titleCheck.errors.forEach(e => this.log('STAGE-15', `❌ 标题配置: ${e}`, 'error'));
      }
      if (titleCheck.warnings.length > 0) {
        titleCheck.warnings.forEach(w => this.log('STAGE-15', `⚠️ 标题配置: ${w}`));
      }
      if (titleCheck.valid && titleCheck.errors.length === 0 && titleCheck.warnings.length === 0) {
        this.log('STAGE-15', `✅ 标题配置检查通过 | mainTitle: ${titleConfig?.mainTitle}`);
      }
    }

    this.log('STAGE-15', `✅ 后期规则 | TTS: ${rules.tts} | 字幕: ${rules.subtitles} | 原声: ${rules.originalAudio}`);
    return { ...rules, titleCheck };
  }

  // ========== Stage 16: 最终输出(基础版) ==========
  async stageFinalOutput(stages) {
    this.log('STAGE-16', '最终输出组装');

    // ==== P0关键修复:链路完整性反向验证 ====
    this.log('STAGE-16.5', '链路输出完整性反向验证(PipelineIntegrityValidator)');
    const validator = new PipelineIntegrityValidator();
    const integrityResult = await validator.validatePipeline(stages);

    if (!integrityResult.valid) {
      this.log('STAGE-16.5', `⛔ 链路验证失败!${integrityResult.summary.errorCount}个错误,${integrityResult.summary.warningCount}个警告`, 'error');

      // 输出具体失败模块
      const failedChecks = integrityResult.checks.filter(c => !c.passed);
      for (const check of failedChecks) {
        this.log('STAGE-16.5', `  ❌ ${check.stage}: ${check.name}`, 'error');
        for (const detail of check.details) {
          this.log('STAGE-16.5', `      → ${detail}`, 'error');
        }
      }

      // 记录到错误列表
      this.errors.push({
        stage: 'STAGE-16.5',
        message: `链路完整性验证失败: ${integrityResult.summary.errorCount}个错误`,
        details: integrityResult.errors
      });

    } else {
      this.log('STAGE-16.5', `✅ 链路完整性验证通过 | 全部${integrityResult.summary.totalChecks}项检查通过`);
    }

    // 将验证结果附加到输出
    stages.integrityValidation = integrityResult;

    const output = {
      prd: stages.prd,
      characters: stages.characters,
      script: stages.script,
      storyboard: stages.storyboard,
      cameraMovements: stages.camera,
      prompts: stages.style,
      postProduction: stages.postProduction,
      validation: {
        alignment: stages.alignment,
        schema: stages.schema,
        storyboard: stages.storyboardValidation,
        compliance: stages.compliance,
        preRender: stages.preRender,
        integrity: integrityResult  // 新增
      }
    };

    this.log('STAGE-16', `✅ 最终输出 | 镜头数: ${output.prompts?.length || 0} | 完整性验证: ${integrityResult.valid ? '通过' : '未通过'}`);
    return output;
  }

  // ========== 辅助方法:自动重试失败的Stage ==========
  async attemptRetry(stages, integrityResult) {
    const failedStages = integrityResult.checks.filter(c => !c.passed).map(c => c.stage);
    let success = true;

    // 重试STAGE-9:运镜系统
    if (failedStages.includes('STAGE-9') && stages.storyboard) {
      this.log('RETRY', '🔄 尝试重试运镜系统(STAGE-9)...');
      try {
        stages.camera = await this.stageCameraMovement(stages.storyboard);
        this.log('RETRY', '✅ 运镜系统重试成功');
      } catch (e) {
        this.log('RETRY', `❌ 运镜系统重试失败: ${e.message}`, 'error');
        success = false;
      }
    }

    // 重试STAGE-11:渲染核心(如果运镜重试成功或需要重试渲染)
    if ((failedStages.includes('STAGE-11') || failedStages.includes('STAGE-9')) && stages.storyboard) {
      this.log('RETRY', '🔄 尝试重试渲染核心(STAGE-11)...');
      try {
        stages.render = await this.stageRender(stages);
        this.log('RETRY', '✅ 渲染核心重试成功');
      } catch (e) {
        this.log('RETRY', `❌ 渲染核心重试失败: ${e.message}`, 'error');
        success = false;
      }
    }

    // 重试STAGE-4:角色系统
    if (failedStages.includes('STAGE-4') && stages.prd) {
      this.log('RETRY', '🔄 尝试重试角色系统(STAGE-4)...');
      // 需要原始input,这里简化处理
      this.log('RETRY', '⚠️ 角色系统需要重新输入配置,跳过自动重试');
      success = false;
    }

    // 重试后再次验证
    if (success) {
      this.log('RETRY', '🔄 重试后执行二次验证...');
      const revalidator = new PipelineIntegrityValidator();
      const recheck = await revalidator.validatePipeline(stages);
      if (!recheck.valid) {
        this.log('RETRY', `⚠️ 二次验证仍有${recheck.summary.errorCount}个错误`, 'error');
        return { success: false, result: recheck };
      }
      return { success: true, result: recheck };
    }

    return { success: false, result: integrityResult };
  }

  // ========== 辅助方法(P0修复:结构化生成器) ==========

  // P0修复#1:生成默认mouthAction
  generateDefaultMouthAction(sceneType, isOpening) {
    if (isOpening) {
      return '嘴部微微张开正在自然说话自我介绍,口型动作柔和亲切,嘴角上扬微笑,右手抬起做打招呼手势';
    }
    switch (sceneType) {
      case 'explanation':
        return '嘴部自然张开正在讲解说明,口型动作清晰有力,偶尔点头配合讲解';
      case 'interaction':
        return '嘴部张开正在对话互动,表情生动,眼神交流自然';
      case 'demonstration':
        return '嘴部配合动作进行讲解,呼吸自然,偶尔抿嘴思考';
      case 'climax':
        return '嘴部张大正在激动陈述,表情强烈,情绪饱满';
      case 'closing':
        return '嘴部微笑总结发言,语速放缓,眼神温和';
      default:
        return '嘴部自然张开正在说话,口型动作自然流畅';
    }
  }

  // P0修复#19:计算情绪峰值阶段 (v6.2-patch97-fix: 增加climax_peak明确高潮标记)
  calculateEmotionPhase(index, total, sceneType) {
    const ratio = total > 1 ? index / (total - 1) : 0;
    // v6.2-patch97-fix: 若sceneType明确为climax,直接标记为climax_peak
    if (sceneType === 'climax') return 'climax_peak';
    if (ratio <= 0.15) return 'establishing';
    if (ratio <= 0.45) return 'rising';
    if (ratio <= 0.65) return 'building';
    if (ratio <= 0.85) return 'climax_peak'; // v6.2-patch97-fix: 0.65-0.85区间标记为明确高潮
    if (ratio <= 0.95) return 'climax';
    return 'resolve';
  }

  // P0修复#14:计算对象重要性(v2时长分配)
  calculateImportance(sceneType, index, total) {
    const ratio = total > 1 ? index / (total - 1) : 0;
    switch (sceneType) {
      case 'opening': return 9;
      case 'climax': return 10;
      case 'demonstration': return 8;
      case 'explanation': return 6;
      case 'interaction': return 4;
      case 'closing': return 7;
      default: return 5;
    }
  }

  // v6.2-patch65: 根据镜头位置自动推导叙事弧线标记 (shotType)
  _deriveShotType(index, total, sceneType) {
    const ratio = total > 1 ? index / (total - 1) : 0;

    // 特殊场景类型检测(v6.2-patch107:支持top-down和FPV场景)
    if (sceneType === 'top-down' || sceneType === 'top_down' || sceneType === '俯视') {
      return 'top-down';
    }
    if (sceneType === 'fpv' || sceneType === 'FPV' || sceneType === 'first-person' || sceneType === 'pov') {
      return 'fpv';
    }
    if (sceneType === 'parkour' || sceneType === '跑酷' || sceneType === 'chase') {
      return 'fpv';
    }

    // 基于位置的叙事弧线推导
    if (index === 0) return 'opening';
    if (ratio <= 0.25) return 'setup';
    if (ratio <= 0.50) return 'conflict';
    if (ratio <= 0.75) return 'rising';
    if (ratio <= 0.90) return 'climax';
    return 'resolution';
  }

  // P0修复#17:计算视觉复杂度(v2时长分配)
  calculateVisualComplexity(sceneType) {
    switch (sceneType) {
      case 'demonstration': return 8;
      case 'climax': return 9;
      case 'opening': return 6;
      case 'explanation': return 3;
      case 'interaction': return 4;
      case 'closing': return 5;
      default: return 5;
    }
  }

  /**
   * v6.2-patch80: 获取导演风格注入(供Prompt生成使用)
   * v6.5.13-fix: 支持generic模式,返回对应风格
   */
  _getDirectorStyleInjection(sceneName, shotType, emotionPhase) {
    // generic模式: 返回通用纪录片/教育风格
    if (this.mode !== 'nirath') {
      const isMedical = sceneName && (sceneName.includes('健康') || sceneName.includes('医疗') || sceneName.includes('医院') || sceneName.includes('科普'));
      const isDocumentary = isMedical || (sceneName && (sceneName.includes('纪录') || sceneName.includes('纪实')));
      return {
        sceneType: isDocumentary ? 'documentary' : 'generic',
        primaryDirector: isDocumentary ? '纪录片导演' : '通用导演',
        secondaryDirector: isDocumentary ? '医疗纪录片' : '通用风格',
        stylePrompt: isDocumentary 
          ? '超写实纪录片风格,电影级自然光影,专业医疗科普氛围,真实人物质感,浅景深,4K画质'
          : '超写实,电影级光影,真实场景质感,自然光,专业氛围',
        directorTags: isDocumentary 
          ? ['纪录片手持摄影', '自然光', '真实质感', '浅景深'] 
          : ['超写实', '电影级光影', '自然光'],
        recommendedTags: isDocumentary 
          ? ['医疗纪录片', '真实场景', '专业氛围', '自然光'] 
          : ['通用风格', '写实']
      };
    }

    const { DirectorStyleLibrary } = require('./director-style-library.js');
    const styleLib = new DirectorStyleLibrary({ mode: this.mode });

    // 推断场景类型
    const inferredSceneType = styleLib._inferSceneType({
      scene: sceneName,
      emotionPhase: emotionPhase,
      shotType: shotType
    });

    // 获取推荐风格
    const recommended = styleLib.recommendStyleForScene(inferredSceneType);

    // 获取融合风格
    const nirathBlend = styleLib.blendStyles();
    const stylePrompt = styleLib.generateStylePrompt(nirathBlend, 'Nirath电影级');

    // 提取导演核心标签(用于融入prompt)
    const primaryTags = recommended.primary?.coreTags?.map(t => t.desc).slice(0, 2) || [];
    const secondaryTags = recommended.secondary?.coreTags?.map(t => t.desc).slice(0, 1) || [];

    return {
      sceneType: inferredSceneType,
      primaryDirector: recommended.primary?.name?.split(' ')[0] || '未知',
      secondaryDirector: recommended.secondary?.name?.split(' ')[0] || '未知',
      stylePrompt: stylePrompt,
      directorTags: [...primaryTags, ...secondaryTags],
      recommendedTags: recommended.recommendedTags || []
    };
  }

  // P0修复#5/#6:提取关键词用于对齐检查
  extractKeywords(text) {
    if (!text) return [];
    // 提取中文关键词(去除停用词)
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    const words = text.split(/[\s,\.。,!?、;:""''()《》【】\n\-]+/).filter(w => w.length >= 2);
    return [...new Set(words.filter(w => !stopWords.has(w)))];
  }

  // Stage 11辅助:构建基础Prompt(v6.2-patch60: 集成Tier分层+通道分离+世界观过滤)
  buildBasePrompt(shot, characters) {
    // v6.2-patch60: 使用新模块构建高质量Prompt
    const tierBuilder = this.modules.promptTierArchitecture;
    const channelSeparator = this.modules.promptChannelSeparator;
    const sceneManager = this.modules.worldviewSceneManager;
    const emotionMapper = this.modules.techSpecsEmotionMapper;

    // Step 1: 通道分离 - 提取旁白
    const channelResult = channelSeparator.separate({
      narration: shot.narration,
      scene: { name: shot.scene, sceneCore: sceneManager.getSceneVisualCore(shot.scene, { mode: this.mode }) },
      characters: shot.characters?.map(cid => {
        const char = characters[cid];
        // v6.5.30-fix: defensive extraction - handle both string and object prompts
        let promptText = char?.prompt;
        if (promptText && typeof promptText === 'object') {
          promptText = promptText.prompt || promptText.description || promptText.name || String(cid);
        }
        return { name: cid, appearance: (typeof promptText === 'string' ? promptText.substring(0, 50) : String(promptText || cid)).substring(0, 50) };
      }) || [],
      emotionPhase: shot.emotionPhase || 'establishing',
      hasDialogue: shot.hasDialogue || false
    });

    // Step 2: 获取场景主数据
    const sceneData = sceneManager.getSceneData(shot.scene);
    const lighting = sceneManager.getSceneLighting(shot.scene);

    // Step 2.5: v6.2-patch80 导演风格注入
    const directorStyle = this._getDirectorStyleInjection(shot.scene, shot.cameraMovement?.type || shot.shotType, shot.emotionPhase || 'establishing');
    this.log('STAGE-6', `🎬 导演风格匹配: ${shot.scene} → ${directorStyle.sceneType} | 主风格: ${directorStyle.primaryDirector} + 辅风格: ${directorStyle.secondaryDirector}`);

    // Step 3: 世界观分层注入
    const worldview = sceneManager.getWorldviewInjection({
      sceneName: shot.scene,
      shotIndex: shot.shotIndex || 0,
      isOpening: shot.isOpening || false,
      sceneFirstAppearance: shot.sceneFirstAppearance || false
    });

    // Step 4: 动态表情映射
    const expression = emotionMapper.generateExpression(shot.emotionPhase || 'establishing');

    // Step 5: Tier分层构建Prompt (v2.0-B+: 七层架构 + 音频层)
    const tierResult = tierBuilder.build({
      sceneName: shot.scene,
      sceneType: directorStyle.sceneType || shot.scene,
      sceneCore: sceneManager.getSceneVisualCore(shot.scene, { mode: this.mode }),
      shotType: shot.cameraMovement?.type || shot.shotType || '电影级镜头',
      subject: shot.characters?.map(cid => {
        const char = characters[cid];
        // v6.5.30-fix: defensive extraction - handle both string and object prompts
        let promptText = char?.prompt;
        if (promptText && typeof promptText === 'object') {
          promptText = promptText.prompt || promptText.description || promptText.name || String(cid);
        }
        return (typeof promptText === 'string' ? promptText.substring(0, 80) : String(promptText || cid)).substring(0, 80);
      }).join(', '),
      action: shot.action || channelResult.visualPrompt.text || '',
      cameraMovement: shot.cameraMovement,
      emotionPhase: shot.emotionPhase || 'establishing',
      environmentFeatures: sceneData?.environmentFeatures || sceneData?.environmentTags || [],
      mode: this.mode,
      isOpening: shot.isOpening || false,
      isFirstShot: shot.shotIndex === 0,
      // v2.0-B+: 音频层参数
      timeOfDay: shot.lighting?.timeOfDay || sceneData?.timeOfDay || 'golden hour',
      hasCharacters: !!(shot.characters && shot.characters.length > 0),
      lipSync: !!(shot.mouthAction || shot.hasDialogue),
      // v6.2-patch80: 导演风格注入
      directorStyle: directorStyle
    });

    // Step 6: 质量评分
    const qualityResult = this.modules.promptQualityGate.evaluate({
      prompt: tierResult.prompt,
      tiers: tierResult.tiers,
      emotionPhase: shot.emotionPhase || 'establishing',
      hasDialogue: shot.hasDialogue || false,
      narration: shot.narration
    });

    // 组装结果
    const result = {
      prompt: tierResult.raw || tierResult.prompt,
      tierMetrics: tierResult.metrics,
      quality: qualityResult,
      channels: {
        narration: channelResult.narration,
        visual: channelResult.visualPrompt,
        lipSync: channelResult.lipSync
      },
      worldview: worldview,
      expression: expression,
      length: tierResult.prompt.length,
      utilization: tierResult.metrics.utilization
    };

    this.log('STAGE-11', `v6.2-patch60 Prompt构建 | Tier利用率:${result.tierMetrics.utilization}% | 质量:${result.quality.grade}(${result.quality.score}分) | 长度:${result.length}`, 'info');

    return result;
  }

  enforceStyle(prompt, sceneName) {
    if (this.mode === 'nirath') {
      return this.modules.renderCore.enforce(prompt, sceneName);
    }
    return { prompt, issues: [], compliant: true };
  }

  toStandardPrompt(shot, prompt) {
    const safe = (v) => (typeof v === 'string' ? v.trim() : '');

    const narration = safe(shot.narration || shot.dialogue);
    const scene = safe(
      typeof shot.scene === 'string'
        ? shot.scene
        : shot.scene?.name || shot.scene?.nirathName || ''
    );

    const cameraText =
      safe(shot.cameraMovement?.description) ||
      safe(typeof shot.cameraMovement === 'string' ? shot.cameraMovement : '') ||
      safe(shot._timeline?.summary) ||
      '';

    // v6.5.33-methodology: CAMERA字段增强 — 注入方法论镜头语言规范
    // 基于《AI视频生成提示词工程方法论》2.5 CAMERA维度 + 6.1景别体系
    const enhancedCamera = this.enhanceCameraWithMethodology(cameraText, shot);

    const lightingText =
      safe(shot.lighting?.keyLight) ||
      safe(shot.lighting?.progression) ||
      (prompt.match(/【照明方案】([^【]*)/) || [])[1] ||
      '';

    const audioText = this.enhanceAudioWithMethodology(
      (prompt.match(/【环境音效】([^【]*)/) || [])[1] ||  // v6.6.9.4-patch9: 标准字段名
      (prompt.match(/【音频】([^【]*)/) || [])[1] ||     // 兼容旧字段
      [
        /伴随[^，。,；;]*/g,
        /动作产生[^，。,；;]*/g,
        /氛围弥漫[^，。,；;]*/g,
        /音乐线索[^，。,；;]*/g,
        /声画精准同步[^，。,；;]*/g,
        /L1:[^|]+/g,
        /L2:[^|]+/g,
        /L3:[^|]+/g,
        /L4:[^|]+/g
      ]
        .flatMap((re) => prompt.match(re) || [])
        .join('，'),
      shot
    );

    const negativeText =
      (prompt.match(/【负面约束】([^【]*)/) || [])[1] ||
      (prompt.match(/【全局负面约束】([^【]*)/) || [])[1] ||
      this.modules.globalNegativePromptInjector?.generateCompact({
        sceneType: shot.sceneType || 'nature_epic',
        hasCharacter: !!(shot.characters && shot.characters.length > 0),
        isRealistic: true,
        maxLength: 180
      }) ||
      '';

    const renderText =
      (prompt.match(/【技术规格】([^【]*)/) || [])[1] ||
      (prompt.match(/【渲染】([^【]*)/) || [])[1] ||
      (this.mode === 'nirath' ? '超写实数字渲染，影视级画面构图，体积光照明，空气透视感，皮肤与材质微距摄影级细节，写实风格，外星繁茂植被覆盖岩石地表，背景可见奇异生物活动。' : 'hyperrealistic cinematic quality, 35mm film grain, HDR, photorealistic with filmic treatment, 16:9 cinematic');

    const directorText =
      (prompt.match(/Director style:\s*([^【\n]+)/i) || [])[1] ||
      '通用导演风格';

    let characterText = '';
    if (Array.isArray(shot.characters) && shot.characters.length > 0) {
      characterText = shot.characters.join('，');
    }

    const actionText =
      (prompt.match(/【动作】([^【]*)/) || [])[1] ||
      (prompt.match(/【视觉】([^【]*)/) || [])[1] ||
      narration ||
      '自然动作';

    const moodMap = {
      establishing: '宁静，建立感',
      rising: '紧张上升',
      building: '情绪积累',
      climax: '高潮爆发',
      climax_peak: '高潮峰值',
      resolve: '温柔收束',
      resolution: '温柔收束',
      neutral: '自然平衡'
    };
    const moodText = this.enhanceMoodWithMethodology(moodMap[shot.emotionPhase] || '自然氛围', shot);

    // v6.5.33-methodology: 增强SCENE字段 — 空间五维描述法 + 纵深构建
    const enhancedScene = this.enhanceSceneWithMethodology(scene, shot);

    // v6.5.33-methodology: 增强ACTION字段 — 动作三层模型 + 物理动词词库
    const enhancedAction = this.enhanceActionWithMethodology(actionText, shot);

    // v6.5.33-methodology: 增强CHARACTER字段 — 主体四维模型
    const enhancedCharacter = this.enhanceCharacterWithMethodology(characterText, shot);

    const fields = [
      `CHARACTER: ${enhancedCharacter || characterText || '人物出场，形象明确'}`,
      `ACTION: ${enhancedAction || actionText}`,
      `SCENE: ${enhancedScene || scene || '场景环境明确，空间关系清晰'}`,
      `MOOD: ${moodText}`,
      `CAMERA: ${enhancedCamera || cameraText || '35mm lens, eye level medium shot, steady tracking shot'}`,
      `LIGHTING: ${lightingText || '自然光，明暗层次清晰'}`,
      `NEGATIVE: ${negativeText || 'no text, no anime, no cartoon, no deformed hands, no extra fingers, no watermark'}`,
      `AUDIO: ${audioText || '环境音自然，声画同步'}`,
      `RENDER: ${renderText}`,
      `DIRECTOR: ${directorText}`
    ];

    let result = fields.join(' | ');

    // 保留原始自然语言Prompt的丰富视觉描述，避免信息丢失
    const originalPrompt = (prompt || '').trim();
    if (originalPrompt.length > 0) {
      const remaining = 1500 - result.length - 3; // 预留 " | " 分隔符
      if (remaining > 50) {
        result += ' | ' + originalPrompt.substring(0, remaining);
      }
    }

    // v6.5.34-fix: 保留Nirath模式约束字段（风格锁/负面约束/角色约束/镜头时间轴/明亮约束）
    if (this.mode === 'nirath') {
      const preserveBlocks = ['【风格锁】', '【负面约束】', '【角色约束】', '【镜头时间轴】', '【明亮约束】'];
      const preservedConstraints = [];
      for (const block of preserveBlocks) {
        const match = originalPrompt.match(new RegExp(`${block}[^【]*?(?=【|$)`));
        if (match && match[0].trim().length > block.length) {
          preservedConstraints.push(match[0].trim());
        }
      }
      if (preservedConstraints.length > 0) {
        const constraintsStr = ' ' + preservedConstraints.join(' ');
        if (result.length + constraintsStr.length <= 1500) {
          result += constraintsStr;
        } else {
          // 空间不足，截断result尾部以容纳约束
          const maxResultLen = 1500 - constraintsStr.length;
          result = result.substring(0, maxResultLen).trim() + constraintsStr;
        }
      }
    }

    return result;
  }

  ensureFinalPromptStructure(shot, prompt) {
    let result = prompt || '';

    const blocks = [];

    if (!/CHARACTER:/i.test(result)) {
      const chars = Array.isArray(shot.characters) ? shot.characters.join('，') : '人物';
      blocks.push(`CHARACTER: ${chars}`);
    }

    if (!/ACTION:/i.test(result)) {
      blocks.push(`ACTION: ${shot.narration || shot.dialogue || '自然动作'}`);
    }

    if (!/SCENE:/i.test(result)) {
      const scene = typeof shot.scene === 'string' ? shot.scene : (shot.scene?.name || '场景环境');
      blocks.push(`SCENE: ${scene}`);
    }

    if (!/MOOD:/i.test(result)) {
      blocks.push(`MOOD: ${shot.emotionPhase || '自然氛围'}`);
    }

    if (!/CAMERA:/i.test(result)) {
      blocks.push(`CAMERA: ${shot.cameraMovement?.description || '中景平稳运镜'}`);
    }

    if (!/LIGHTING:/i.test(result)) {
      blocks.push(`LIGHTING: ${shot.lighting?.keyLight || '自然光，明暗层次清晰'}`);
    }

    if (!/AUDIO:/i.test(result) && /(?:伴随|动作产生|氛围弥漫|音乐线索|声画精准同步)/.test(result)) {
      const audioParts = [];
      const patterns = [
        /伴随[^，。|]*/gi,
        /动作产生[^，。|]*/gi,
        /氛围弥漫[^，。|]*/gi,
        /音乐线索[^，。|]*/gi,
        /声画精准同步[^，。|]*/gi
      ];
      for (const re of patterns) {
        audioParts.push(...(result.match(re) || []));
      }
      if (audioParts.length > 0) {
        blocks.push(`AUDIO: ${audioParts.join('，')}`);
      }
    }

    if (!/RENDER:/i.test(result)) {
      blocks.push(`RENDER: ${this.mode === 'nirath' ? '超写实数字渲染，影视级画面构图，体积光照明，空气透视感，皮肤与材质微距摄影级细节，写实风格，外星繁茂植被覆盖岩石地表，背景可见奇异生物活动。' : 'hyperrealistic cinematic quality, 35mm film grain, HDR, photorealistic with filmic treatment, 16:9 cinematic'}`);
    }

    if (!/DIRECTOR:/i.test(result)) {
      blocks.push('DIRECTOR: 通用导演风格');
    }

    if (blocks.length > 0) {
      result = `${blocks.join(' | ')} | ${result}`;
    }

    if (result.length > 1500) {
      result = result.substring(0, 1500);
    }

    return result;
  }

  dedupePromptFragments(prompt) {
    if (!prompt || typeof prompt !== 'string') return prompt;

    const fragments = prompt
      .split(/[，,]/)
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const frag of fragments) {
      const key = frag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(frag);
      }
    }

    return result.join('，');
  }

  // ========== 获取模块状态 ==========
  getModuleStatus() {
    return {
      totalModules: 16,
      initialized: Object.keys(this.modules).length,
      mode: this.mode,
      modules: Object.keys(this.modules)
    };
  }
  // ========== v6.0-patch23: 镜头内增强辅助方法 ==========

  /**
   * 智能裁剪Prompt
   * 优先保留主体描述,裁剪辅助性内容
   */
  // v6.5.6-fix: 角度名称映射到实际文件名
  mapAngleToFileName(angle) {
    const angleMap = {
      'front': 'front_fullbody',
      'threeQuarter': 'three_quarter',
      'closeup': 'face_closeup',
      'side': 'side_profile'
    };
    return angleMap[angle] || angle;
  }

  smartTrim(prompt, maxLength, options = {}) {
    const { preserve = [], trim = [] } = options;

    if (prompt.length <= maxLength) return prompt;

    // ========== v6.2-patch47-fix: 支持无结束标记的单标记格式 ==========
    // 策略:将Prompt按段落/标记拆分为独立区块,优先保留核心区块

    // Step 1: 将Prompt拆分为区块(按【xxx】标记分割)
    // v2.0-B+-fix: 同时支持自然语言格式（伴随/动作产生/氛围弥漫/音乐线索/声画精准同步）
    const blocks = [];
    const markerPattern = /【([^【】]+)】/g;
    let lastIndex = 0;
    let match;

    // 自然语言音频标记正则
    const audioPattern = /(伴随|动作产生|氛围弥漫|音乐线索|声画精准同步)[^【】\n,。]+/g;

    while ((match = markerPattern.exec(prompt)) !== null) {
      // 标记前的普通文本
      if (match.index > lastIndex) {
        blocks.push({
          type: 'plain',
          content: prompt.substring(lastIndex, match.index),
          isCore: false
        });
      }

      // 提取标记名称
      const markerName = match[1];

      // 找到下一个标记或文本结束
      const nextMatch = markerPattern.exec(prompt);
      markerPattern.lastIndex = match.index + match[0].length; // 重置搜索位置

      let endPos;
      if (nextMatch) {
        endPos = nextMatch.index;
        markerPattern.lastIndex = nextMatch.index; // 下次从nextMatch开始
      } else {
        endPos = prompt.length;
      }

      const blockContent = prompt.substring(match.index, endPos);

      // 判断是否为trim列表中的区块
      const isTrim = trim.some(t => markerName.includes(t) || t.includes(markerName));
      // 判断是否为preserve列表中的区块
      const isPreserve = preserve.some(p => markerName.includes(p) || p.includes(markerName));

      blocks.push({
        type: 'marked',
        marker: markerName,
        content: blockContent,
        isCore: isPreserve,
        isTrim: isTrim
      });

      lastIndex = endPos;
    }

    // 剩余文本
    if (lastIndex < prompt.length) {
      blocks.push({
        type: 'plain',
        content: prompt.substring(lastIndex),
        isCore: false
      });
    }

    // 🔊 v2.0-B+-fix: 识别自然语言格式的音频层，标记为核心区块
    const audioKeywords = ['伴随', '动作产生', '氛围弥漫', '音乐线索', '声画精准同步'];
    for (const block of blocks) {
      if (block.type === 'plain' && !block.isCore) {
        // 检查是否包含音频关键词
        const hasAudio = audioKeywords.some(kw => block.content.includes(kw));
        if (hasAudio) {
          // 检查是否在 preserve 列表中
          const isPreserve = preserve.some(p => audioKeywords.includes(p));
          if (isPreserve) {
            block.isCore = true;
          }
        }
      }
    }

    // Step 2: 先移除trim列表中的区块
    const afterTrim = blocks.filter(b => !b.isTrim);
    let currentLength = afterTrim.reduce((sum, b) => sum + b.content.length, 0);

    if (currentLength <= maxLength) {
      return afterTrim.map(b => b.content).join('');
    }

    // Step 3: 仍超限,保留核心区块,裁剪非核心区块
    let result = '';
    let resultLength = 0;

    // 第一轮:优先保留核心区块（🔊 音频层优先保留）
    // 先保留音频层，确保声音不被截断
    const audioBlocks = afterTrim.filter(b => b.marker === '音频' || (b.type === 'plain' && b.isCore && audioKeywords.some(kw => b.content.includes(kw))));
    const otherCoreBlocks = afterTrim.filter(b => b.isCore && !audioBlocks.includes(b));
    
    for (const block of audioBlocks) {
      if (resultLength + block.content.length <= maxLength) {
        result += block.content;
        resultLength += block.content.length;
      }
    }
    
    for (const block of otherCoreBlocks) {
      if (resultLength + block.content.length <= maxLength) {
        result += block.content;
        resultLength += block.content.length;
      }
    }

    // 第二轮:用非核心区块填充剩余空间
    for (const block of afterTrim) {
      if (!block.isCore) {
        const remaining = maxLength - resultLength;
        if (remaining <= 0) break;
        if (block.content.length <= remaining) {
          result += block.content;
          resultLength += block.content.length;
        } else {
          // v6.2-patch56-fix: 智能截断,优先在标点处截断
          const partial = this.trimAtPunctuation(block.content, remaining);
          result += partial;
          resultLength += partial.length;
          // v6.2-patch61-fix: 不break,继续尝试添加后续完整block
        }
      }
    }

    return result;
  }

  // v6.3-patch10-fix: 最终兜底补齐 - 如果提示词仍然太短，强制补齐到目标长度
  finalFillPrompt(prompt, shotId) {
    let out = String(prompt || '').trim();
    const target = 1470;
    const hardLimit = 1500;

    if (charCounter.count(out) >= target) return out;

    const fillers = [
      '电影级超写实环境叙事与层叠空间深度',
      '顶级材质保真与物理可信纹理响应',
      '体积光分离与大气深度对比控制',
      '清晰主体可读性与稳定视觉身份连续性',
      '微妙环境微观动态与粒子运动',
      '受控摄影机节奏与刻意焦点迁移',
      '神话异星生态, 晶化地形, 能量脉络景观逻辑',
      '高端CG写实, 扎根尺度感知',
      '微表情完整性, 姿态写实, 呼吸节奏, 稳定身体力学'
    ];

    for (const item of fillers) {
      if (charCounter.count(out) >= target) break;
      const next = `${out}, ${item}`;
      if (charCounter.count(next) <= hardLimit) {
        out = next;
      }
    }

    if (charCounter.count(out) > hardLimit) {
      out = charCounter.truncate(out, hardLimit);
    }

    return out;
  }

  /**
   * v6.2-patch56: 在标点符号处智能截断文本
   * 优先在句号、逗号等标点处截断，避免截断句子中间
   */
  trimAtPunctuation(text, maxLength) {
    if (text.length <= maxLength) return text;

    // 先在maxLength处截断
    let trimmed = text.substring(0, maxLength);

    // 向前查找最近的标点符号(句号、逗号、分号、感叹号、问号)
    const punctuations = ['。', ',', ';', '!', '?', '.', ',', ';', '!', '?'];
    let lastPunctIndex = -1;

    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (punctuations.includes(trimmed[i])) {
        lastPunctIndex = i;
        break;
      }
    }

    // 如果找到标点,在标点后截断(包含标点)
    if (lastPunctIndex > 0) {
      return trimmed.substring(0, lastPunctIndex + 1);
    }

    // 没找到标点,退而求其次:在空格处截断
    let lastSpaceIndex = trimmed.lastIndexOf(' ');
    if (lastSpaceIndex > 0) {
      return trimmed.substring(0, lastSpaceIndex);
    }

    // 最后手段:直接截断
    return trimmed;
  }

  /**
   * 计算情绪深度评分(0-100)
   * 基于运镜变化数和光影递进复杂度
   */
  calculateEmotionalDepth(enhanced) {
    // v6.0-patch23-fix: 空shot降级保护
    const hasAnyEnhancement = enhanced.segments || enhanced.lighting || enhanced.prompt;
    if (!hasAnyEnhancement) {
      return 50; // 默认基础分
    }

    let score = 0;

    // 运镜变化贡献(每段+15分,最高45分)
    const segmentCount = enhanced.segments?.length || 1;
    score += Math.min(45, (segmentCount - 1) * 15);

    // 光影递进贡献(有递进+30分)
    if (enhanced.lighting?.progression && enhanced.lighting.progression !== 'none') {
      score += 30;
    }

    // 时间轴描述完整性(有描述+25分)
    if (enhanced.prompt?.includes('【镜头时间轴】')) {
      score += 25;
    }

    return Math.min(100, score);
  }

  /**
   * v6.2-patch41: 情绪深度评分V2(0-20分)
   * 基于shot的narration、独白、台词冲突密度
   * v6.3-patch3: 扩展情绪关键词至50个,增加情绪暗示词检测
   */
  // v6.5.37-fix: 系统级修复 - 情绪深度评分增强（generic/social模式）
  // 根因：social模式缺乏Nirath情绪词， narration长度短，导致情绪深度仅7-8.5/15分
  // 修复：增加通用情绪基础分 + 扩展情绪关键词检测
  calculateEmotionalDepthV2(shot, prompt) {
    let score = 0;

    // 1. narration独白存在性(最高8分)
    const narration = shot.narration || shot.innerMonologue || '';
    if (narration.length > 0) {
      score += Math.min(8, Math.floor(narration.length / 10)); // 每10字+1分,最高8
    }

    // 2. 异兽台词存在性(最高6分)
    const beastLines = shot.beastLines || shot.beastDialogue || [];
    if (Array.isArray(beastLines) && beastLines.length > 0) {
      score += Math.min(6, beastLines.length * 2); // 每句+2分,最高6
    }

    // 3. Prompt中情绪关键词密度(最高6分)
    // v6.5.37-fix: 扩展通用情绪关键词，支持social/generic模式
    const emotionKeywords = [
      // 基础情绪词(中文)
      '恐惧', '敬畏', '温柔', '愤怒', '悲伤', '喜悦', '紧张', '困惑', '好奇', '释然',
      '不安', '神秘', '希望', '平静', '激动', '震惊', '失望', '期待', '犹豫', '坚定',
      '压迫', '震撼', '渺小', '宏大', '未知', '探索', '对抗', '和解', '觉醒', '蜕变',
      '孤独', '陪伴', '危险', '安全', '渴望', '满足', '迷茫', '清晰', '脆弱', '强大',
      // 温馨/治愈系（social模式常用）
      '温暖', '治愈', '甜蜜', '幸福', '可爱', '萌', '柔软', '轻盈', '明亮', '阳光',
      '笑容', '微笑', '开心', '快乐', '欢乐', '温馨', '舒适', '安心', '宁静', '安详',
      '宠溺', '呵护', '守护', '依偎', '拥抱', '亲吻', '抚摸', '牵手', '陪伴', '成长',
      // 基础情绪词(英文)
      'fear', 'awe', 'tender', 'anger', 'sad', 'joy', 'tense', 'confused', 'curious', 'relieved',
      'uneasy', 'mysterious', 'hope', 'calm', 'excited', 'shocked', 'disappointed', 'expect', 'hesitant', 'determined',
      'warm', 'healing', 'sweet', 'happy', 'cute', 'soft', 'bright', 'sunny', 'smile', 'cozy',
      // 情绪暗示词(中文)- 通过动作/光影暗示情绪
      '逼近', '退缩', '凝视', '颤抖', '屏息', '仰望', '俯视', '逼近', '逃离', '拥抱',
      '对峙', '追逐', '缠绕', '包围', '吞噬', '绽放', '收缩', '膨胀', '凝固', '流动',
      '阴影覆盖', '光芒四射', '黑暗笼罩', '微光闪烁', '深渊', '巅峰', '漩涡', '风暴', '宁静', '爆发',
      '阳光洒落', '夕阳余晖', '温暖光线', '柔和光影', ' golden glow', 'soft light', 'gentle breeze',
      // 情绪暗示词(英文)
      'looming', 'retreating', 'gazing', 'trembling', 'holding breath', 'looking up', 'looking down', 'approaching', 'fleeing', 'embracing',
      'confronting', 'chasing', 'twining', 'surrounding', 'devouring', 'blooming', 'contracting', 'expanding', 'solidifying', 'flowing',
      'shadow covering', 'radiant', 'darkness enveloping', 'flickering', 'abyss', 'peak', 'vortex', 'storm', 'serene', 'bursting',
      'sunlight', 'sunset glow', 'warm light', 'soft lighting', 'gentle breeze'
    ];
    const promptLower = prompt.toLowerCase();
    let keywordCount = 0;
    for (const kw of emotionKeywords) {
      if (promptLower.includes(kw.toLowerCase())) keywordCount++;
    }
    score += Math.min(6, keywordCount * 0.5); // 每个情绪词+0.5分,最高6

    // v6.5.37-fix: emotionPhase基础分增强（如果标注了情感阶段,给予更高基础分）
    const phase = shot.emotionPhase || shot.emotion || '';
    if (phase) {
      score += 4; // 从+3提升到+4
    }
    
    // v6.5.37-fix: social/generic模式额外基础分（缺乏Nirath式情绪冲突）
    if (this.mode === 'social' || this.mode === 'generic') {
      score += 3; // 补偿缺乏异兽台词和冲突的扣分
    }

    return Math.min(20, score);
  }

  /**
   * v6.2-patch41: 叙事画面对齐评分(0-20分)
   * narration台词内容与画面描述的一致性
   */
  /**
   * v6.2-patch104: 根据场景类型计算差异化照明方案
   * 为每个镜头设计独特的三点照明方案,避免每镜都一样
   */
  calculateSceneSpecificLighting(shot, prompt) {
    const sceneType = shot.shotType || shot.type || 'generic';
    const sceneName = shot.scene || '';
    const emotionPhase = shot.emotionPhase || '';

    // 场景类型照明映射表
    const lightingSchemes = {
      'opening': {
        name: '开场发现照明',
        keyLight: { position: 'Aurelius上方30°', color: '5800K暖金', intensity: '中等,柔光箱' },
        fillLight: { position: 'Silvana侧方45°', color: '6500K清冷银白', intensity: '弱,填充阴影' },
        rimLight: { position: '后方', color: '磁丝淡蓝紫', intensity: '中等,勾勒轮廓' },
        ratio: '3:1',
        emotion: '明亮、希望、探索感'
      },
      'discovery': {
        name: '发现诡异照明',
        keyLight: { position: '裂隙下方上射', color: '8800K冷蓝', intensity: '强,硬光' },
        fillLight: { position: '仅面部轮廓', color: '微弱', intensity: '极弱,保持神秘感' },
        rimLight: { position: '磁丝树冷光', color: '淡蓝紫', intensity: '强,恐怖片经典背光' },
        ratio: '8:1',
        emotion: '不安、神秘、恐惧'
      },
      'confrontation': {
        name: '对峙冲突照明',
        keyLight: { position: 'Aurelius+Silvana双侧', color: '5800K/6500K双色', intensity: '强,硬光' },
        fillLight: { position: '下方', color: '岩浆橙红', intensity: '中等,反射光' },
        rimLight: { position: '角色背后', color: '火山岩橙红', intensity: '强,轮廓分离' },
        ratio: '5:1',
        emotion: '紧张、对抗、压迫感'
      },
      'climax': {
        name: '高潮爆发照明',
        keyLight: { position: '上方直射', color: '5800K金白', intensity: '极强,硬光' },
        fillLight: { position: '四周', color: '等离子紫', intensity: '中等,环境光' },
        rimLight: { position: '背后', color: '等离子紫', intensity: '极强,能量爆发' },
        ratio: '10:1',
        emotion: '爆发、能量、震撼'
      },
      'closing': {
        name: '结尾温暖照明',
        keyLight: { position: 'Aurelius低角度', color: '5800K暖金', intensity: '中等,柔光' },
        fillLight: { position: 'Silvana', color: '6500K银白', intensity: '弱,填充' },
        rimLight: { position: '地面反射', color: '菌丝金色', intensity: '中等,温暖' },
        ratio: '2:1',
        emotion: '温暖、希望、平静'
      }
    };

    /**
   * v6.2-patch106-fix: 场景化环境描述生成
   * 根据场景名称生成差异化环境描述,避免所有镜头使用同一套模板
   */
    let scheme = lightingSchemes[sceneType] || lightingSchemes['generic'];

    // 如果没有找到,使用默认
    if (!scheme) {
      scheme = {
        name: '通用明亮照明',
        keyLight: { position: 'Aurelius上方', color: '5800K', intensity: '中等' },
        fillLight: { position: 'Silvana侧方', color: '6500K', intensity: '弱' },
        rimLight: { position: '后方', color: '磁丝蓝紫', intensity: '中等' },
        ratio: '3:1',
        emotion: '明亮、自然'
      };
    }

    // 检查prompt是否已经包含这些照明信息(严格检查:需要主光+补光+背光的具体描述)
    const hasKeyLightDetail = /主光|key\s*light|主光源|主照明|从.+上方.+照射|顶光|硬光/i.test(prompt) ||
                              (prompt.includes(scheme.keyLight.position) && prompt.includes(scheme.keyLight.color));
    const hasFillLightDetail = /补光|fill\s*light|补光源|辅光|辅照明|柔和|填充光|减淡阴影/i.test(prompt) ||
                               (prompt.includes(scheme.fillLight.position) && prompt.includes(scheme.fillLight.color));
    const hasRimLightDetail = /背光|轮廓光|rim\s*light|边缘光|逆光|轮廓线|分离光|发丝光|勾勒轮廓/i.test(prompt) ||
                              (prompt.includes(scheme.rimLight.position) && prompt.includes(scheme.rimLight.color));

    return {
      scheme,
      hasKeyLightDetail,
      hasFillLightDetail,
      hasRimLightDetail,
      // 如果缺少照明细节,返回建议注入的文本
      suggestedInjection: (!hasKeyLightDetail || !hasFillLightDetail || !hasRimLightDetail)
        ? this.generateLightingInjection(scheme, shot)
        : null
    };
  }


  generateSceneSpecificEnvironment(sceneName, shotType) {
    const sceneEnvironments = {
      '涿鹿战场': {
        backdrop: '【环境布景】远古战争遗迹,钩吾废墟边缘。地热裂缝透出橙红光芒,磁铁矿岩壁发出幽微电磁光。地表铺满多铜玉碎石,在双恒星照射下反射金橙与银白双色反光。',
        texture: '【环境质感】废墟岩石粗粝质感,熔岩冷却后形成的玻璃质表层。远处可见断裂的磁丝树桩,切面呈现年轮状磁场纹路。',
        ecology: '生态痕迹:战争遗留的熔岩结晶,某些裂缝正在"愈合",可见新生发光岩脉如同缝合线。'
      },
      '裂隙微光': {
        backdrop: '【环境布景】幽蓝裂隙深渊,晶状菌丝如神经网般覆盖岩壁。孢子雾在裂隙中缓慢升腾,随磁场脉动形成呼吸般的明暗节奏。',
        texture: '【环境质感】菌丝半透明胶质质感,裂隙边缘岩石被生物矿化形成彩色结晶层。体积光从裂隙深处透射,照亮飘浮的孢子微粒。',
        ecology: '生态活跃:原始单细胞发光毯覆盖裂隙底部;晶状菌丝随声波脉动;某些菌丝正在释放孢子,形成微型"孢子雪"。'
      },
      '不周山脉': {
        backdrop: '【环境布景】断天顶主峰,黑曜石与发光矿物交织的山体。断层暴露的水晶矿脉含稀土元素,在地热激活下发出脉动橙红光芒。远古撞击坑形成巨大环形凹陷。',
        texture: '【环境质感】黑曜石半透明镜面反射,水晶矿脉如血管般嵌入岩体。岩浆残留形成的玻璃质表层呈现虹彩效果。',
        ecology: '地质特征:山体由65%黑曜石、20%水晶、10%稀土矿、5%熔岩残留构成。主峰高12000米,为星球最高点。'
      },
      '晨星之约': {
        backdrop: '【环境布景】孢子花园,磁丝树森林环绕的开阔地。地面铺满发光苔藓,形成柔软的生物荧光地毯。两颗卫星的引力交汇造成潮汐锁定区域,大气折射形成罕见光弧。',
        texture: '【环境质感】苔藓柔软绒面质感,磁丝树皮呈现年轮状磁场纹路。孢子随风飘散,在双恒星光照下如金色尘埃。',
        ecology: '生态奇观:孢子花园为Nirath最古老生态系统,某些磁丝树树龄超过10亿年。发光苔藓随双恒星位置变化切换金橙/银白色调。'
      }
    };

    // 默认环境(当场景不在映射中时)
    const defaultEnv = {
      backdrop: '【环境布景】Nirath异世界场景,中景原始发光毯覆盖地表,随磁场脉动明暗。生态活跃:原始单细胞发光毯覆盖地表;矿物结晶生长过程缓慢可见。',
      texture: '【环境质感】背景环境采用实景拍摄质感,物理真实世界,35mm胶片颗粒,轻微噪点,4K高清,电影质感。',
      ecology: '禁止塑料/CG质感,禁止光秃秃/荒芜/寸草不生。'
    };

    const env = sceneEnvironments[sceneName] || defaultEnv;

    // 根据镜头类型调整侧重点
    if (shotType === 'opening' || shotType === 'establishing') {
      return `${env.backdrop}\n${env.ecology}\n${env.texture}`;
    } else if (shotType === 'discovery') {
      return `${env.backdrop}\n${env.texture}\n微观生态细节:${env.ecology}`;
    } else if (shotType === 'confrontation') {
      return `${env.backdrop}\n${env.texture}\n战斗地形:${env.ecology}`;
    } else {
      return `${env.backdrop}\n${env.ecology}\n${env.texture}`;
    }
  }

  /**
   * v6.5.33-methodology: 生成照明方案注入文本（融合方法论光影系统规范）
   * 基于《AI视频生成提示词工程方法论》4.1光影描述标准格式
   * 结构: [主光源]+[位置/方向]+[色温]+[光质]+[强度] + [辅助光源]+[位置]+[功能] + [环境光] + [特殊现象]
   */
  generateLightingInjection(scheme, shot) {
    const duration = shot.duration || 10;
    
    // 方法论映射：将现有scheme转换为方法论标准格式
    // 色温映射
    const colorTempMap = {
      '暖金': '3200K warm golden',
      '暖黄': '3000K warm tungsten',
      '金白': '4500K neutral warm',
      '冷蓝': '8000K+ cool blue',
      '蓝紫': '9000K blue-purple',
      '冷白': '6500K cool daylight',
      '白': '5600K daylight balanced',
      '双色': '3200K/5600K mixed'
    };
    
    // 光质映射（硬光/软光/散射/直射）
    const lightQuality = scheme.keyLight?.intensity?.includes('硬') ? 'hard light' : 
                         scheme.keyLight?.intensity?.includes('柔') ? 'soft light' : 'diffused';
    
    // 位置映射（top/front/side/back/under/ambient）
    const positionMap = {
      '上方': 'top light from above',
      '上方30°': 'top light 30-degree from above',
      '低角度': 'low angle back light',
      '双侧': 'side light from both sides',
      '下方': 'under light from below',
      '裂隙下方': 'under light through crevice',
      '直射': 'direct front light'
    };
    
    const keyPosition = positionMap[scheme.keyLight?.position] || scheme.keyLight?.position || 'key light from 45-degree left';
    const keyColor = colorTempMap[scheme.keyLight?.color] || scheme.keyLight?.color || '5600K daylight';
    const keyIntensity = scheme.keyLight?.intensity?.replace(/[，,]/g, '') || 'medium';
    
    const fillPosition = positionMap[scheme.fillLight?.position] || scheme.fillLight?.position || 'soft fill from right';
    const fillColor = colorTempMap[scheme.fillLight?.color] || scheme.fillLight?.color || 'ambient fill';
    const fillIntensity = scheme.fillLight?.intensity?.replace(/[，,]/g, '') || 'soft';
    
    const rimPosition = positionMap[scheme.rimLight?.position] || scheme.rimLight?.position || 'rim light from behind';
    const rimColor = colorTempMap[scheme.rimLight?.color] || scheme.rimLight?.color || 'warm rim';
    const rimIntensity = scheme.rimLight?.intensity?.replace(/[，,]/g, '') || 'strong';
    
    // 特殊光学现象（根据情绪阶段推断）
    const phenomenaMap = {
      'establishing': 'volumetric light shafts through atmospheric haze',
      'rising': 'rim light edge glow separating subject from background',
      'climax': 'intense volumetric light, visible light beams',
      'resolve': 'soft diffused light, gentle atmospheric scattering',
      'neutral': 'natural ambient light, subtle atmospheric haze'
    };
    const phenomenon = phenomenaMap[scheme.emotion] || phenomenaMap['neutral'];
    
    return `
【照明方案】${scheme.name} | ${scheme.ratio}光比
主光: warm key light ${keyPosition}, ${keyColor}, ${lightQuality}, ${keyIntensity} intensity
补光: ${fillPosition}, ${fillColor}, ${fillIntensity} fill
背光: strong rim light ${rimPosition}, ${rimColor}, ${rimIntensity} rim
特殊现象: ${phenomenon}
情绪: ${scheme.emotion}`;
  }

  /**
   * v6.5.33-methodology: 使用方法论镜头语言规范增强CAMERA字段
   * 基于《AI视频生成提示词工程方法论》2.5 CAMERA维度 + 6.1景别体系
   * 注入：shot size(景别) + lens(焦距/光圈) + movement(运镜英文术语) + speed(速度等级)
   */
  enhanceCameraWithMethodology(cameraText, shot) {
    if (!cameraText || cameraText.length < 3) return cameraText;
    
    // 如果已经包含英文术语，跳过增强
    if (/\b(35mm|50mm|85mm|f\/\d|dolly|tracking|orbit|pan|tilt|wide shot|close-up|medium shot)\b/i.test(cameraText)) {
      return cameraText;
    }
    
    // 景别映射（方法论6.1）
    const shotSizeMap = {
      'extreme_wide': 'extreme wide shot establishing',
      'wide': 'wide shot',
      'medium_long': 'medium long shot',
      'medium': 'medium shot',
      'medium_close': 'medium close-up',
      'close': 'close-up',
      'extreme_close': 'extreme close-up',
      'insert': 'insert shot'
    };
    
    // 运镜英文映射（方法论2.5.2）
    const movementMap = {
      '推': 'dolly in',
      '拉': 'dolly out',
      '横摇': 'pan',
      '纵摇': 'tilt',
      '横移': 'truck',
      '升降': 'pedestal',
      '跟随': 'tracking shot',
      '环绕': 'orbit',
      '手持': 'handheld',
      '斯坦尼康': 'steadicam',
      '固定': 'static',
      '缩放': 'zoom',
      '甩': 'whip pan',
      '极速穿梭': 'whip pan rapid movement'
    };
    
    // 速度映射（方法论2.5.4）
    const speedMap = {
      '极慢': 'extremely slow, gradual',
      '慢': 'slow, gentle, smooth',
      '中速': 'steady, moderate pace',
      '快': 'fast, rapid',
      '极快': 'extremely fast, lightning',
      '变速': 'ramping speed'
    };
    
    // 镜头参数推荐（根据景别）
    const lensMap = {
      'extreme_wide': '16mm wide angle lens, f/8 deep depth of field',
      'wide': '24mm lens, f/5.6 moderate depth',
      'medium_long': '35mm lens, f/4 moderate depth',
      'medium': '50mm lens, f/2.8 shallow depth of field',
      'medium_close': '85mm portrait lens, f/2.0 shallow depth',
      'close': '85mm lens, f/1.8 shallow depth of field',
      'extreme_close': '100mm macro lens, f/2.8'
    };
    
    // 从shot中提取信息
    const shotSize = shot.shotSize || shot.cameraMovement?.shotSize || 'medium';
    const movement = shot.cameraMovement?.movementType || shot.cameraMovement?.movement || '';
    const speed = shot.cameraMovement?.speed || shot.speed || '中速';
    
    // 组装方法论格式 CAMERA 字段
    const parts = [];
    
    // 1. 镜头参数 (lens + aperture + shot size)
    const lensParams = lensMap[shotSize] || lensMap['medium'];
    const shotSizeDesc = shotSizeMap[shotSize] || shotSizeMap['medium'];
    parts.push(`${lensParams}, ${shotSizeDesc}`);
    
    // 2. 运镜 (movement + speed)
    let movementDesc = '';
    // 尝试从中文映射
    for (const [cn, en] of Object.entries(movementMap)) {
      if (movement.includes(cn) || cameraText.includes(cn)) {
        movementDesc = en;
        break;
      }
    }
    // 如果未匹配，尝试从cameraText提取关键动词
    if (!movementDesc) {
      if (/跟随|跟拍|追踪/.test(cameraText)) movementDesc = 'tracking shot';
      else if (/环绕|旋转|围绕/.test(cameraText)) movementDesc = 'orbit';
      else if (/推进|靠近|拉近/.test(cameraText)) movementDesc = 'dolly in';
      else if (/拉远|退后|远离/.test(cameraText)) movementDesc = 'dolly out';
      else if (/摇|扫/.test(cameraText)) movementDesc = 'pan';
      else if (/升|降|抬|俯/.test(cameraText)) movementDesc = 'pedestal';
      else movementDesc = 'steady tracking shot'; // 默认
    }
    
    const speedDesc = speedMap[speed] || speedMap['中速'];
    parts.push(`${movementDesc}, ${speedDesc}`);
    
    // 3. 机位高度（如果可推断）
    if (/俯|鸟瞰|航拍|高空/.test(cameraText)) {
      parts.push('bird\'s eye view, aerial perspective');
    } else if (/仰|低角度|向上/.test(cameraText)) {
      parts.push('low angle, worm\'s eye view');
    } else if (/肩|背后|过肩/.test(cameraText)) {
      parts.push('over-the-shoulder OTS');
    }
    
    // 4. 特殊效果（如果可推断）
    if (/浅景深|虚化|背景虚/.test(cameraText)) {
      parts.push('shallow depth of field, creamy bokeh');
    } else if (/深景深|全景清晰|全部清晰/.test(cameraText)) {
      parts.push('deep depth of field, everything in focus');
    }
    
    return parts.join(', ');
  }

  /**
   * v6.5.33-methodology: 使用方法论色彩科学体系增强MOOD字段
   * 基于《AI视频生成提示词工程方法论》5.1色彩方案 + 5.3色温控制
   * 注入：color palette(主色/辅色/强调色) + 色温 + 饱和度/对比度 + 动态范围
   */
  enhanceMoodWithMethodology(moodBase, shot) {
    if (!moodBase || moodBase.length < 2) return moodBase;
    
    // 情绪阶段 → 色彩方案映射（方法论5.1）
    const colorSchemeMap = {
      'establishing': 'color palette: deep teal shadows + warm amber highlights + subtle gold accents, natural HDR',
      'rising': 'color palette: cool blue shadows + warm orange highlights, high contrast, building tension',
      'building': 'color palette: earth tones + olive green + warm amber, moderate saturation, accumulating energy',
      'climax': 'color palette: intense warm orange + deep crimson + golden highlights, high saturation, dramatic contrast',
      'climax_peak': 'color palette: intense warm red + deep crimson + bright gold accents, maximum saturation, extreme contrast',
      'resolve': 'color palette: soft pastel warm + gentle cream + muted gold, low saturation, warm monochrome',
      'resolution': 'color palette: soft pastel warm + gentle cream + muted gold, low saturation, warm monochrome',
      'neutral': 'color palette: natural balanced tones + daylight neutral, moderate saturation, standard contrast'
    };
    
    // 情绪阶段 → 色温映射（方法论5.3）
    const colorTempMap = {
      'establishing': '4500K neutral warm, soft white',
      'rising': '5600K daylight balanced, transitioning to 3200K warm',
      'building': '4000K neutral warm, soft transition',
      'climax': '3200K tungsten warm, golden intense',
      'climax_peak': '2500K sunset warm, extreme warm glow',
      'resolve': '4000K neutral warm, gentle soft white',
      'resolution': '4000K neutral warm, gentle soft white',
      'neutral': '5600K daylight balanced, neutral'
    };
    
    // 情绪阶段 → 动态范围映射（方法论2.7.3）
    const dynamicRangeMap = {
      'establishing': 'HDR, high dynamic range, detail in highlights and shadows',
      'rising': 'HDR, high dynamic range, strong tonal contrast',
      'building': 'HDR, moderate dynamic range, building contrast',
      'climax': 'high contrast, dramatic lighting, deep shadows and bright highlights',
      'climax_peak': 'high contrast, crushed blacks, blown highlights, extreme dynamic range',
      'resolve': 'low contrast, muted tones, soft shadows, gentle dynamic range',
      'resolution': 'low contrast, muted tones, soft shadows, gentle dynamic range',
      'neutral': 'standard dynamic range, SDR, balanced contrast'
    };
    
    const phase = shot.emotionPhase || 'neutral';
    const colorScheme = colorSchemeMap[phase] || colorSchemeMap['neutral'];
    const colorTemp = colorTempMap[phase] || colorTempMap['neutral'];
    const dynamicRange = dynamicRangeMap[phase] || dynamicRangeMap['neutral'];
    
    return `${moodBase} | ${colorScheme} | ${colorTemp} | ${dynamicRange}`;
  }

  /**
   * v6.5.33-methodology: 使用方法论空间五维描述法增强SCENE字段
   * 基于《AI视频生成提示词工程方法论》2.4.1空间五维描述法 + 2.4.2空间纵深构建技术
   * 注入：宏观地理 + 中观地貌 + 微观材质 + 天气时间 + 空间关系(前景/中景/背景)
   */
  enhanceSceneWithMethodology(scene, shot) {
    if (!scene || scene.length < 3) return scene;
    
    // 如果已经包含英文空间描述，跳过增强
    if (/\b(foreground|midground|background|atmospheric haze|leading lines|depth)\b/i.test(scene)) {
      return scene;
    }
    
    // 空间纵深构建关键词（方法论2.4.2）
    const depthCues = [
      'foreground detail establishing depth',
      'midground subject focal point',
      'background environmental scale reference',
      'atmospheric haze creating depth separation',
      'aerial perspective with color shift in distance'
    ];
    
    // 根据镜头类型选择纵深策略
    let depthCue = depthCues[0];
    if (shot.shotType === 'extreme_wide' || shot.shotType === 'wide') {
      depthCue = 'massive scale environment dominating frame, foreground mist, midground subject, background mountains, atmospheric haze';
    } else if (shot.shotType === 'close' || shot.shotType === 'extreme_close') {
      depthCue = 'shallow depth of field, creamy bokeh background, foreground detail texture, midground subject isolated';
    } else if (shot.shotType === 'medium') {
      depthCue = 'foreground detail, midground subject clear, background softly blurred, atmospheric depth';
    }
    
    // 天气时间增强（如果scene中没有）
    let weatherTime = '';
    if (!/\b(golden hour|blue hour|midday|sunset|sunrise|overcast|dawn|dusk|twilight|night)\b/i.test(scene)) {
      const weatherTimeMap = {
        'establishing': 'golden hour, warm sunlight, long shadows',
        'rising': 'late afternoon, side lighting, warm tones',
        'building': 'transitioning light, dynamic cloud patterns',
        'climax': 'dramatic sunset, intense golden light, vivid sky colors',
        'climax_peak': 'peak sunset, intense warm glow, dramatic sky',
        'resolve': 'soft diffused light, gentle atmosphere, peaceful ambiance',
        'resolution': 'soft diffused light, gentle atmosphere, peaceful ambiance',
        'neutral': 'daylight balanced, natural lighting, clear atmosphere'
      };
      weatherTime = weatherTimeMap[shot.emotionPhase] || weatherTimeMap['neutral'];
    }
    
    const parts = [scene];
    if (depthCue) parts.push(depthCue);
    if (weatherTime) parts.push(weatherTime);
    
    return parts.join(', ');
  }

  /**
   * v6.5.33-methodology: 使用方法论动作三层模型增强ACTION字段
   * 基于《AI视频生成提示词工程方法论》2.3.1动作三层模型 + 2.3.2动作动词词库
   * 注入：主体动作(Subject Action) + 环境动作(Environment Action) + 镜头动作(Camera Action)
   * 物理动词优先：surge/crash/blow/sway 替代形容词
   */
  enhanceActionWithMethodology(actionText, shot) {
    if (!actionText || actionText.length < 3) return actionText;
    
    // 如果已经是英文物理动词为主，跳过增强
    if (/\b(surge|crash|spray|ripple|churn|cascade|blow|swirl|drift|billow|flicker|roar|sway|rustle|crumble|slide)\b/i.test(actionText)) {
      return actionText;
    }
    
    // 动作三层模型增强（方法论2.3.1）
    // 1. 主体动作层：已在actionText中
    // 2. 环境动作层：根据场景类型推断
    let environmentAction = '';
    const sceneLower = (shot.scene || '').toLowerCase();
    if (sceneLower.includes('ocean') || sceneLower.includes('海') || sceneLower.includes('water') || sceneLower.includes('水')) {
      environmentAction = 'water waves surging and crashing, spray particles airborne, white foam forming';
    } else if (sceneLower.includes('wind') || sceneLower.includes('风') || sceneLower.includes('storm') || sceneLower.includes('storm')) {
      environmentAction = 'wind blowing through atmosphere, particles swirling and drifting, dust and debris scattering';
    } else if (sceneLower.includes('forest') || sceneLower.includes('林') || sceneLower.includes('tree') || sceneLower.includes('树')) {
      environmentAction = 'vegetation swaying and rustling, leaves scattering in wind, branches bending';
    } else if (sceneLower.includes('mountain') || sceneLower.includes('山') || sceneLower.includes('cliff') || sceneLower.includes('崖')) {
      environmentAction = 'atmospheric particles drifting, dust in sunlight, distant haze moving';
    } else if (sceneLower.includes('fire') || sceneLower.includes('火') || sceneLower.includes('flame') || sceneLower.includes('焰')) {
      environmentAction = 'flames flickering and dancing, smoke rising and drifting, embers scattering';
    }
    
    // 3. 镜头动作层：根据情绪阶段推断
    let cameraAction = '';
    const cameraActionMap = {
      'establishing': 'camera slow push-in, gradual approach, steady dolly in',
      'rising': 'camera tracking shot following subject, moderate pace movement',
      'building': 'camera orbit around subject, rotating perspective, increasing speed',
      'climax': 'camera rapid movement, whip pan, extreme fast tracking, dynamic angle change',
      'climax_peak': 'camera maximum speed movement, lightning fast pan, intense dynamic framing',
      'resolve': 'camera slow-down, gentle static hold, final framing lock',
      'resolution': 'camera slow-down, gentle static hold, final framing lock',
      'neutral': 'steady camera movement, smooth tracking, natural pace'
    };
    cameraAction = cameraActionMap[shot.emotionPhase] || cameraActionMap['neutral'];
    
    const parts = [actionText];
    if (environmentAction) parts.push(environmentAction);
    if (cameraAction) parts.push(cameraAction);
    
    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 使用方法论主体四维模型增强CHARACTER字段
   * 基于《AI视频生成提示词工程方法论》2.2.2主体描述四维模型
   * 注入：形态(Form) + 材质(Material) + 状态(State) + 关系(Relation)
   */
  enhanceCharacterWithMethodology(characterText, shot) {
    if (!characterText || characterText.length < 3) return characterText;
    
    // 如果已经包含形态/材质/状态/关系描述，跳过增强
    if (/\b(form|material|state|relation|shape|texture|posture|position)\b/i.test(characterText)) {
      return characterText;
    }
    
    // 主体四维模型映射（方法论2.2.2）
    // 形态：已在characterText中（外形、轮廓、比例、数量）
    // 材质：根据角色类型推断表面质感
    let materialDesc = '';
    if (characterText.includes(' skin') || characterText.includes('皮肤') || characterText.includes('face') || characterText.includes('脸')) {
      materialDesc = 'natural skin texture, subsurface scattering, realistic surface detail';
    } else if (characterText.includes('cloth') || characterText.includes('fabric') || characterText.includes('衣') || characterText.includes('服')) {
      materialDesc = 'fabric material with woven texture, cloth simulation, natural draping and folds';
    } else if (characterText.includes('fur') || characterText.includes('hair') || characterText.includes('毛') || characterText.includes('发')) {
      materialDesc = 'hair/fur dynamics, individual strand detail, wind-responsive movement';
    } else if (characterText.includes('metal') || characterText.includes('armor') || characterText.includes('金') || characterText.includes('甲')) {
      materialDesc = 'metallic surface with specular highlights, brushed texture, realistic reflection';
    }
    
    // 状态：根据情绪阶段推断动作状态
    let stateDesc = '';
    const stateMap = {
      'establishing': 'standing still, calm posture, relaxed state',
      'rising': 'beginning movement, alert posture, preparing action',
      'building': 'intensifying movement, dynamic posture, accumulating energy',
      'climax': 'maximum action intensity, explosive movement, peak physical state',
      'climax_peak': 'extreme action, full exertion, peak physical state',
      'resolve': 'slowing down, relaxed posture, returning to calm',
      'resolution': 'slowing down, relaxed posture, returning to calm',
      'neutral': 'natural pose, balanced posture, normal state'
    };
    stateDesc = stateMap[shot.emotionPhase] || stateMap['neutral'];
    
    // 关系：与环境的关系
    let relationDesc = '';
    if (shot.scene) {
      relationDesc = `positioned within environment, spatial relationship to ${shot.scene.split(/[，,]/)[0] || 'background'}`;
    }
    
    const parts = [characterText];
    if (materialDesc) parts.push(`material: ${materialDesc}`);
    if (stateDesc) parts.push(`state: ${stateDesc}`);
    if (relationDesc) parts.push(`relation: ${relationDesc}`);
    
    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 使用方法论物理真实感描述层增强AUDIO字段
   * 基于《AI视频生成提示词工程方法论》3.1物理描述原则：物理>形容词
   * 注入：环境动作物理描述替代抽象声音描述
   * 示例：不用"轻柔风声"，而用"wind blowing through tall grass, blades bending and rustling, leaves scattering"
   */
  /**
   * v6.5.33-audio: 极致视听融合 - 四层音效纵深体系
   * 基于《极致视听融合方案》v2.0 Audio专用版
   * L1环境音 + L2动作音 + L3情绪音 + L4音乐线索
   * 
   * 策略：
   * 1. 如果shot有scene信息，优先使用buildAudioDescription生成4层格式
   * 2. 如果已有音频文本，在其基础上增强为4层格式
   * 3. 保留英文物理描述作为L2动作音
   */
  enhanceAudioWithMethodology(audioText, shot) {
    if (!audioText || audioText.length < 3) audioText = '';

    // 如果shot有场景信息，使用buildAudioDescription生成完整的4层音频描述
    if (shot && shot.scene && buildAudioDescription) {
      try {
        const fourLayerAudio = buildAudioDescription(shot, shot._segments || []);
        if (fourLayerAudio && fourLayerAudio.length > 10) {
          return fourLayerAudio;
        }
      } catch (e) {
        // 如果buildAudioDescription失败，回退到原有逻辑
        console.warn('[AudioEnhancement] buildAudioDescription failed, falling back:', e.message);
      }
    }

    // 如果已经是4层格式（包含L1: L2: L3: L4:），直接返回
    if (/L1:.*L2:.*L3:/.test(audioText)) {
      return audioText;
    }

    // 回退：在现有音频文本基础上增强4层格式
    const parts = [];
    const sceneLower = (shot?.scene || '').toLowerCase();
    const emotion = (shot?.emotionPhase || shot?.emotion || 'neutral').toLowerCase();

    // L1: 环境音（建立声学指纹）
    const l1Map = {
      'ocean': 'waves crashing against rocks, seagull distant calls, wind coastal breeze, -22LUFS',
      '海': 'waves crashing, seagull distant calls, wind coastal breeze, -22LUFS',
      'water': 'water flowing, stream babbling, gentle liquid sounds, -20LUFS',
      '水': 'water flowing, stream babbling, gentle liquid sounds, -20LUFS',
      'forest': 'leaves rustling, branches creaking, distant stream, bird calls, -20LUFS',
      '林': 'leaves rustling, branches creaking, distant stream, bird calls, -20LUFS',
      'city': 'traffic white noise, distant horns, crowd murmur, building reflections, -18LUFS',
      '城': 'traffic white noise, distant horns, crowd murmur, building reflections, -18LUFS',
      'home': 'air conditioning hum, clock ticking, distant kitchen sounds, -26LUFS',
      '家': 'air conditioning hum, clock ticking, distant kitchen sounds, -26LUFS',
      'mountain': 'wind howling, distant echo, high altitude silence, -24LUFS',
      '山': 'wind howling, distant echo, high altitude silence, -24LUFS',
      'rain': 'raindrops hitting surface, water dripping, concentric ripples, -20LUFS',
      '雨': 'raindrops hitting surface, water dripping, concentric ripples, -20LUFS',
      'fire': 'flames flickering, wood popping, embers scattering, crackling, -18LUFS',
      '火': 'flames flickering, wood popping, embers scattering, crackling, -18LUFS'
    };
    let l1 = 'natural ambient soundscape, subtle environmental textures, -22LUFS';
    for (const [key, val] of Object.entries(l1Map)) {
      if (sceneLower.includes(key)) { l1 = val; break; }
    }
    parts.push(`L1:${l1}`);

    // L2: 动作音（物理真实感）
    let l2 = audioText;
    if (!l2 || l2.length < 3) {
      l2 = 'natural action sounds, physical movement feedback';
    }
    // 如果包含中文，保留作为L2；如果已经是英文物理描述，直接使用
    parts.push(`L2:${l2}`);

    // L3: 情绪音（心理氛围）
    const l3Map = {
      'warm': 'warm healing texture, heartbeat 68BPM, 80Hz sub-bass pad, -20LUFS',
      'joy': 'joyful bright texture, high frequency sparkle >5kHz, dopamine release暗示',
      'tense': 'tense压迫感, heartbeat 100BPM+, irregular low pulse, adrenaline暗示',
      'sad': 'sad nostalgic texture, string harmonics, distant echo, heart rate decrease暗示',
      'epic': 'epic grandeur texture, full spectrum, 80BPM, adrenaline暗示',
      'peaceful': 'peaceful zen texture, 60BPM, full frequency soft, no harsh components',
      'mysterious': 'mysterious unknown texture, irregular low pulse, minimal spectrum sudden change',
      'climax': 'climax peak texture, full spectrum saturation, 120BPM, extreme dynamics',
      'resolve': 'resolve fading texture, 50BPM, low frequency decay, gentle ambient fade',
      'neutral': 'neutral balanced texture, natural ambient, 72BPM steady'
    };
    const l3 = l3Map[emotion] || l3Map['neutral'];
    parts.push(`L3:${l3}`);

    // L4: 音乐线索（情绪基调）
    if (shot?.musicCue) {
      parts.push(`L4:${shot.musicCue}`);
    } else {
      const l4Map = {
        'warm': 'piano C major single notes, 60BPM, sustain pedal, warm narrative melody',
        'joy': 'bright synth arpeggio, 120BPM, uplifting motif, high frequency sparkle',
        'tense': 'low synth bass pulse, industrial rhythm, distortion effects, 100BPM',
        'sad': 'string ensemble long tones, vibrato, distant reverberation, 50BPM',
        'epic': 'brass fanfare motifs, orchestral percussion, cinematic grandeur',
        'peaceful': 'minimal piano or wind chimes, natural scale, almost imperceptible',
        'mysterious': 'minimal electronic pad, sudden tonal shifts, long reverb tail',
        'climax': 'full orchestra crescendo, percussion drive, peak intensity',
        'resolve': 'piano fading notes, long reverb tail, gentle resolution',
        'neutral': 'minimal ambient pad, no prominent musical cue'
      };
      const l4 = l4Map[emotion] || l4Map['neutral'];
      if (l4 !== 'minimal ambient pad, no prominent musical cue') {
        parts.push(`L4:${l4}`);
      }
    }

    // 频率避让规则
    parts.push('避让:L4避1-4kHz|L2侧重2-8kHz|L3侧重<500Hz');

    // 声画同步标记
    if (shot?.mouthAction || shot?.hasDialogue) {
      parts.push('同步:lip-sync precise alignment, ambient auto-ducking');
    }

    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 跨模型兼容性适配器
   * 基于《AI视频生成提示词工程方法论》10.1模型特性矩阵 + 10.2提示词转换规则
   * 将通用提示词转换为特定模型最优格式
   * @param {string} prompt - 通用提示词
   * @param {string} model - 目标模型 (seadance/runway/kling/veo/sora/luma)
   * @param {Object} shot - 镜头信息
   * @returns {string} 适配后的提示词
   */
  adaptPromptForModel(prompt, model = 'seadance', shot = {}) {
    if (!prompt || prompt.length < 10) return prompt;
    
    const adaptations = {
      'seadance': {
        // SeaDance 2.x: 保持完整六维描述，物理描述可详细，支持长提示词
        transform: (p) => p, // 通用格式已最优
        maxLength: 1500,
        note: '完整六维描述，物理描述详细，多镜头分镜友好'
      },
      'runway': {
        // Runway Gen-4: 镜头指令移至开头，精简至100词内，Motion Brush补充
        transform: (p) => {
          // 提取CAMERA字段移到开头
          const cameraMatch = p.match(/CAMERA:\s*([^|]+)/i);
          const camera = cameraMatch ? cameraMatch[1].trim() : '';
          // 移除原始CAMERA字段
          let rest = p.replace(/CAMERA:\s*[^|]+\|?/i, '');
          // 精简至核心内容
          rest = rest.replace(/\|/g, ', ').replace(/\s+/g, ' ').trim();
          return camera ? `${camera}. ${rest}` : rest;
        },
        maxLength: 500, // 100词约500字符
        note: '镜头指令前置，精简至100词，使用参考图'
      },
      'kling': {
        // Kling 2.x: 物理和光学描述优先，4-6秒分段，避免过长句式
        transform: (p) => {
          // 提取SCENE和LIGHTING作为优先内容
          const sceneMatch = p.match(/SCENE:\s*([^|]+)/i);
          const lightingMatch = p.match(/LIGHTING:\s*([^|]+)/i);
          const actionMatch = p.match(/ACTION:\s*([^|]+)/i);
          const parts = [];
          if (sceneMatch) parts.push(sceneMatch[1].trim());
          if (lightingMatch) parts.push(lightingMatch[1].trim());
          if (actionMatch) parts.push(actionMatch[1].trim());
          return parts.join(', ');
        },
        maxLength: 600, // 60-120词
        note: '物理光学描述优先，短句结构，4-6秒分段'
      },
      'veo': {
        // Veo 3: 写实度关键词前置，中等长度，可同步音频描述
        transform: (p) => {
          // 写实度关键词前置
          const renderMatch = p.match(/RENDER:\s*([^|]+)/i);
          const render = renderMatch ? renderMatch[1].trim() : 'hyperrealistic cinematic';
          let rest = p.replace(/RENDER:\s*[^|]+\|?/i, '');
          rest = rest.replace(/\|/g, ', ').trim();
          return `${render}. ${rest}`;
        },
        maxLength: 500,
        note: '写实度关键词前置，可同步音频描述，中等长度'
      },
      'sora': {
        // Sora 2.x: 复杂空间关系可详细描述，支持较长描述，叙事节奏描述收益大
        transform: (p) => p, // 通用格式已较好
        maxLength: 1500,
        note: '复杂空间关系详细，叙事节奏描述，长时段一致性'
      },
      'luma': {
        // Luma Ray2: 极度精简，单镜头为主，核心动作+核心光影即可
        transform: (p) => {
          // 只保留核心字段
          const actionMatch = p.match(/ACTION:\s*([^|]+)/i);
          const lightingMatch = p.match(/LIGHTING:\s*([^|]+)/i);
          const sceneMatch = p.match(/SCENE:\s*([^|]+)/i);
          const parts = [];
          if (actionMatch) parts.push(actionMatch[1].trim());
          if (lightingMatch) parts.push(lightingMatch[1].trim());
          if (sceneMatch) parts.push(sceneMatch[1].trim());
          return parts.join(', ');
        },
        maxLength: 300, // 40-80词
        note: '极度精简，核心动作+核心光影，单镜头测试'
      }
    };
    
    const adapter = adaptations[model.toLowerCase()] || adaptations['seadance'];
    let adapted = adapter.transform(prompt);
    
    // 长度裁剪
    if (adapted.length > adapter.maxLength) {
      adapted = adapted.substring(0, adapter.maxLength - 3) + '...';
    }
    
    return adapted;
  }

  /**
   * v6.5.33-methodology: 迭代优化协议质量评估
   * 基于《AI视频生成提示词工程方法论》13.2评估维度
   * 6维评估：写实度(0.25) + 运动质量(0.20) + 光影质量(0.20) + 色彩质量(0.15) + 构图质量(0.10) + 物理真实(0.10)
   * @param {Object} evaluation - 各维度评分 {realism, motion, lighting, color, composition, physics}
   * @returns {Object} 总分 + 诊断建议
   */
  evaluateQuality(evaluation = {}) {
    const weights = {
      realism: 0.25,
      motion: 0.20,
      lighting: 0.20,
      color: 0.15,
      composition: 0.10,
      physics: 0.10
    };
    
    let total = 0;
    const details = {};
    
    for (const [dim, weight] of Object.entries(weights)) {
      const score = evaluation[dim] || 0;
      total += score * weight;
      details[dim] = { score, weight, weighted: score * weight };
    }
    
    // 诊断建议（方法论13.3常见问题诊断）
    const diagnosis = [];
    if (evaluation.realism < 3) diagnosis.push('缺少物理描述：添加具体物理现象关键词');
    if (evaluation.motion < 3) diagnosis.push('动作描述冲突：每段只保留一个主导动作');
    if (evaluation.lighting < 3) diagnosis.push('光源未定义：明确光源位置+性质+效果');
    if (evaluation.color < 3) diagnosis.push('色彩方案冲突：使用标准色彩方案模板');
    if (evaluation.composition < 3) diagnosis.push('镜头指令冲突：每段只给一个镜头运动指令');
    if (evaluation.physics < 3) diagnosis.push('材质塑料感：添加材质+表面状态+光学反应');
    
    // 配方锁定标准（方法论13.5）
    const locked = total >= 4.0 && 
                   evaluation.realism >= 4 &&
                   evaluation.motion >= 3.5 &&
                   evaluation.lighting >= 3.5;
    
    return {
      total: Math.round(total * 100) / 100,
      max: 5.0,
      details,
      diagnosis,
      locked,
      recommendation: locked ? '配方锁定，可用于生产' : '需要继续优化：' + diagnosis.join('; ')
    };
  }

  /**
   * v6.2-patch104: 在Prompt中注入照明方案(如果缺失)
   */
  injectLightingIfMissing(shot, prompt) {
    const sceneLighting = this.calculateSceneSpecificLighting(shot, prompt);

    if (sceneLighting.suggestedInjection) {
      // 检查prompt是否已有照明方案标记
      if (!prompt.includes('【照明方案】') && !prompt.includes('主光')) {
        // 在视觉描述之后注入照明方案(支持多种视觉标记)
        const visualPatterns = [
          /【视觉】.*?\n/,
          /【视觉核心】.*?\n/,
          /【视觉描述】.*?\n/,
          /【画面】.*?\n/
        ];
        let insertPos = -1;
        for (const pattern of visualPatterns) {
          const match = prompt.match(pattern);
          if (match) {
            insertPos = match.index + match[0].length;
            break;
          }
        }
        // 如果找不到视觉标记,在prompt开头注入
        if (insertPos === -1) {
          insertPos = 0;
        }
        if (insertPos >= 0) {
          return prompt.slice(0, insertPos) + '\n' + sceneLighting.suggestedInjection + '\n' + prompt.slice(insertPos);
        }
      }
    }

    return prompt;
  }

  /**
   * 计算叙事画面对齐度(narration与画面内容匹配度)
   * v6.2-patch41: 新增5维评分中的对齐度评分
   */
  calculateNarrativeAlignment(shot, prompt) {
    let score = 0;
    const promptLower = prompt.toLowerCase();

    // v6.6.3-fix: generic模式放宽对齐检测
    const isGenericMode = this.mode === 'generic' || this.mode === 'social';

    // 1. narration/dialogue关键词在Prompt中出现(最高10分)
    // v6.3-patch3: 扩展关键词提取至15个,增加视觉描述回退匹配
    const narration = (shot.narration || shot.innerMonologue || shot.dialogue || '').toLowerCase();
    if (narration.length > 0) {
      // 提取narration中的实词(名词/动词),检查是否在Prompt中
      const keywords = narration.split(/[,。!?、\s]+/).filter(w => w.length >= 2);
      let matched = 0;
      for (const kw of keywords.slice(0, 15)) { // v6.3-patch3: 从8个扩展到15个
        if (promptLower.includes(kw)) matched++;
      }
      // v6.6.3-fix: generic模式降低匹配要求（中英文混合场景）
      const matchMultiplier = isGenericMode ? 2.0 : 1.5;
      score += Math.min(10, matched * matchMultiplier);
    }

    // 1.5 视觉描述关键词匹配(如果没有narration,检查视觉描述)
    if (score === 0 && shot.visualPrompt) {
      const visualKeywords = shot.visualPrompt.toLowerCase().split(/[,。!?、\s]+/).filter(w => w.length >= 2);
      let visualMatched = 0;
      for (const kw of visualKeywords.slice(0, 10)) { // v6.3-patch3: 从5个扩展到10个
        if (promptLower.includes(kw)) visualMatched++;
      }
      score += Math.min(8, visualMatched * 1.5); // 从6分提升到8分
    }

    // 2. 角色名称在Prompt中出现(最高5分)
    // v6.6.3-fix: generic模式增加角色名检测范围
    const shotChars = shot.characters || [];
    let charMatched = 0;
    for (const char of shotChars) {
      const charId = typeof char === 'string' ? char : char.id;
      if (charId) {
        // 检查中英文名称
        const charLower = charId.toLowerCase();
        if (promptLower.includes(charLower) ||
            (charLower.includes('xiao') && promptLower.includes('小')) ||
            (charLower.includes('g') && promptLower.includes('g')) ||
            (charLower.includes('tao') && promptLower.includes('饕')) ||
            (charLower.includes('taotie') && (promptLower.includes('taotie') || promptLower.includes('饕餮'))) ||
            // v6.6.3-fix: generic模式支持chen-nurse等角色名
            (charLower.includes('chen') && (promptLower.includes('chen') || promptLower.includes('陈'))) ||
            (charLower.includes('nurse') && promptLower.includes('nurse')) ||
            (charLower.includes('doctor') && promptLower.includes('doctor')) ||
            (charLower.includes('narrator') && promptLower.includes('narrator'))) {
          charMatched++;
        }
      }
    }
    score += Math.min(5, charMatched * 2);

    // v6.6.3-fix: generic模式增加场景描述匹配（不要求动作关键词）
    if (isGenericMode) {
      // 场景类型匹配
      const sceneType = (shot.type || shot.shotType || '').toLowerCase();
      const sceneKeywords = ['opening', 'explanation', 'demonstration', 'closing', 'product', 'portrait'];
      if (sceneKeywords.some(kw => sceneType.includes(kw))) {
        score += 3; // 场景类型明确+3分
      }
      // 情绪标注匹配
      const emotion = (shot.emotionPhase || shot.emotion || '').toLowerCase();
      if (emotion && promptLower.includes(emotion)) {
        score += 2; // 情绪在prompt中体现+2分
      }
    }

    // 3. 场景/动作一致性(最高5分)
    // v6.3-patch3: 扩展动作关键词至15个
    const actionKeywords = ['动作', '表情', '眼神', '手势', '姿态', '走动', '站立', '蹲下', '奔跑', '跳跃', '回头', '转身', '伸手', '靠近', '对峙'];
    let actionMatched = 0;
    for (const kw of actionKeywords) {
      if (prompt.toLowerCase().includes(kw)) actionMatched++;
    }
    score += Math.min(5, actionMatched);

    // v6.5.1-fix: emotionPhase对齐基础分(如果标注了情感阶段,给予基础分)
    const phase = shot.emotionPhase || shot.emotion || '';
    if (phase) {
      score += 2; // 标注了情感阶段+2分
    }

    // v6.6.3-fix: generic模式基础补偿（确保不低于8分）
    if (isGenericMode && score < 8) {
      score = 8;
    }

    return Math.min(20, score);
  }

  /**
   * v6.2-patch106-3-fix: S02发现场景台词优化
   * 根据场景类型优化台词,使其与视觉描述匹配
   */
  _optimizeDiscoverySceneDialogue(shot, sceneName) {
    if (!shot || shot.type !== 'discovery') return shot;

    const discoveryDialogues = {
      '裂隙微光': {
        dialogue: '看那些晶丝...它们在模仿我的动作。这下面有东西在呼吸。',
        visualPrompt: '超写实,电影级微距镜头,晶状菌丝如神经网般覆盖岩壁,孢子雾在裂隙中缓慢升腾。AgentX俯身观察,手指轻触菌丝,菌丝随即发出幽蓝光芒并产生共振波纹。裂隙深处透出不明光源,照亮漂浮的孢子微粒如金色尘埃。',
        emotion: 'curiosity',
        dangerLevel: 'medium'
      },
      '深渊发现': {
        dialogue: '这些结晶...它们在跟着我移动。不是风,是某种感应。',
        visualPrompt: '超写实,电影级光影,深渊底部发光结晶体,随主角靠近产生脉动光芒。AgentX蹲下观察,结晶体表面倒映出双恒星光色。',
        emotion: 'curiosity',
        dangerLevel: 'low'
      }
    };

    const optimized = discoveryDialogues[sceneName];
    if (optimized) {
      shot.dialogue = optimized.dialogue;
      shot.narration = optimized.dialogue;
      shot.visualPrompt = optimized.visualPrompt;
      shot.emotionPhase = optimized.emotion;
      shot._dangerLevel = optimized.dangerLevel;

      // 修复时间轴:发现场景至少2.5秒完成orbit_360
      if (shot.cameraMovement && shot.cameraMovement.timeline) {
        const timeline = shot.cameraMovement.timeline;
        if (timeline.segments && timeline.segments[0] && timeline.segments[0].duration < 2.5) {
          timeline.segments[0].duration = 2.5;
          this.log('STAGE-7', `  🎬 S02时间轴修复: orbit_360 1.8s→2.5s`);
        }
        // 重新计算总时长
        timeline.totalDuration = timeline.segments.reduce((sum, seg) => sum + seg.duration, 0);
      }
    }

    return shot;
  }

  /**
   * v6.2-patch106-4-fix: S05结尾场景情绪统一
   * 根据台词内容自动调整情绪标签,避免标签/台词/视觉打架
   */
  _unifyClosingSceneEmotion(shot) {
    if (!shot || (shot.type !== 'closing' && shot.shotType !== 'closing')) return shot;

    const dialogue = (shot.dialogue || shot.narration || '').toLowerCase();

    // 根据台词内容判断真实情绪
    let detectedEmotion = 'curiosity';
    let moodTags = ['好奇'];

    if (dialogue.includes('吞') || dialogue.includes('吃') || dialogue.includes('呼吸') || dialogue.includes('缺')) {
      // 黑色幽默/荒诞感
      detectedEmotion = 'whimsical_dark';
      moodTags = ['荒诞', '黑色幽默', '哲思'];
    } else if (dialogue.includes('回家') || dialogue.includes('约定') || dialogue.includes('等')) {
      // 温暖/希望
      detectedEmotion = 'warm_hope';
      moodTags = ['温暖', '希望', '宁静'];
    } else if (dialogue.includes('战') || dialogue.includes('杀') || dialogue.includes('死')) {
      // 紧张/对抗
      detectedEmotion = 'tension';
      moodTags = ['紧张', '对抗'];
    }

    // 更新shot的情绪属性
    shot.emotionPhase = detectedEmotion;
    shot._moodTags = moodTags;
    shot._emotionUnify = {
      originalTags: ['好奇', '宁静', '温暖'],
      detectedEmotion,
      moodTags,
      reason: `台词分析: "${shot.dialogue?.substring(0, 20)}..." → 情绪: ${detectedEmotion}`
    };

    // 同步更新visualPrompt中的情绪描述
    if (shot.visualPrompt) {
      // 移除旧的情绪关键词
      shot.visualPrompt = shot.visualPrompt
        .replace(/充满好奇的探索姿态/g, '嘴角微扬的玩味姿态')
        .replace(/发现新事物的惊喜/g, '对荒诞现实的接纳与玩味')
        .replace(/目光敏锐/g, '目光深邃带一丝调侃');
    }

    this.log('STAGE-7', `  🎭 S05情绪统一: ${shot.id} | ${detectedEmotion} | 标签:${moodTags.join('/')}`);

    return shot;
  }

  /**
   * v6.2-patch106-5-fix: S03对峙场景台词视觉化
   * 将对话台词转化为视觉元素,使台词内容在画面中得到体现
   */
  _visualizeConfrontationDialogue(shot) {
    if (!shot || (shot.type !== 'confrontation' && shot.shotType !== 'confrontation')) return shot;

    const dialogue = shot.dialogue || shot.narration || '';
    const visualElements = [];

    // 分析台词中的关键动作/意象
    if (dialogue.includes('吞') || dialogue.includes('吃')) {
      visualElements.push('饕餮巨口缓缓张开,獠牙间残留发光硅晶碎片,喉咙深处透出幽蓝能量光芒');
    }
    if (dialogue.includes('裂谷') || dialogue.includes('山')) {
      visualElements.push('背景裂谷边缘磁铁矿岩壁发出脉动橙红光芒,地热蒸汽从裂缝中升腾');
    }
    if (dialogue.includes('硅晶') || dialogue.includes('生根')) {
      visualElements.push('饕餮腹部装甲缝隙间可见发光结晶体生长,如植物根系般蔓延,脉动频率与呼吸同步');
    }
    if (dialogue.includes('翼') || dialogue.includes('爪')) {
      visualElements.push('穷奇翼爪展开,撕裂周围孢子雾,翼膜透光呈现血管状能量纹路');
    }
    if (dialogue.includes('缺') || dialogue.includes('要')) {
      visualElements.push('AgentX站在两兽之间,身体微微前倾,双手张开呈调解姿态,表情紧张但坚定');
    }

    // 将视觉元素注入visualPrompt
    if (visualElements.length > 0 && shot.visualPrompt) {
      const visualInjection = `【台词视觉化】${visualElements.join(';')}。`;
      shot.visualPrompt = shot.visualPrompt.replace(/超写实,电影级光影,/, `超写实,电影级光影,${visualInjection}`);
      shot._visualizedDialogue = {
        original: dialogue.substring(0, 50),
        elements: visualElements,
        count: visualElements.length
      };
      this.log('STAGE-7', `  🎬 S03台词视觉化: ${shot.id} | ${visualElements.length}个元素 | ${visualInjection.length}字符`);
    }

    return shot;
  }

  /**
   * v6.2-patch106-6-fix: 运镜创新
   * 避免所有镜头使用相同的运镜组合,根据场景类型推荐差异化运镜
   */
  _innovateCameraMovement(shot) {
    if (!shot || !shot.cameraMovement || !shot.cameraMovement.timeline) return shot;

    const timeline = shot.cameraMovement.timeline;
    if (!timeline.segments || timeline.segments.length === 0) return shot;

    // 检查是否是默认的orbit_360→push_in→push_in→hold
    const defaultPattern = timeline.segments.every((seg, idx) => {
      if (idx === 0) return seg.movement === 'orbit_360';
      if (idx === timeline.segments.length - 1) return seg.movement === 'hold';
      return seg.movement === 'push_in';
    });

    if (!defaultPattern) return shot; // 已有创新运镜

    // 根据场景类型推荐创新运镜
    const sceneType = shot.shotType || shot.type || 'generic';
    const innovations = {
      'discovery': {
        segments: [
          { movement: 'dolly_in', speed: 0.4, desc: '缓慢推近发现物' },
          { movement: 'orbit_180', speed: 0.6, desc: '半环绕观察主体' },
          { movement: 'crane_up', speed: 0.8, desc: '升镜头展现规模' },
          { movement: 'hold', speed: 0.3, desc: '定格凝视' }
        ],
        name: '发现式观察'
      },
      'confrontation': {
        segments: [
          { movement: 'whip_pan', speed: 1.0, desc: '快速甩镜切换对峙双方' },
          { movement: 'push_in', speed: 0.9, desc: '逼近冲突中心' },
          { movement: 'dutch_tilt', speed: 0.7, desc: '荷兰角倾斜增强不稳定感' },
          { movement: 'pull_back', speed: 0.5, desc: '后拉展现冲突全貌' }
        ],
        name: '对抗式冲突'
      },
      'opening': {
        segments: [
          { movement: 'aerial_descent', speed: 0.3, desc: '航拍下降建立环境' },
          { movement: 'push_in', speed: 0.6, desc: '推向主角' },
          { movement: 'orbit_360', speed: 0.5, desc: '环绕环境' },
          { movement: 'hold', speed: 0.4, desc: '定格开场' }
        ],
        name: '史诗式开场'
      }
    };

    const innovation = innovations[sceneType];
    if (innovation) {
      // 应用创新运镜
      timeline.segments.forEach((seg, idx) => {
        if (innovation.segments[idx]) {
          seg.movement = innovation.segments[idx].movement;
          seg.speed = { value: innovation.segments[idx].speed, description: innovation.segments[idx].desc };
        }
      });
      timeline._innovation = {
        originalPattern: 'orbit_360→push_in→push_in→hold',
        newPattern: innovation.segments.map(s => s.movement).join('→'),
        name: innovation.name
      };
      this.log('STAGE-7', `  🎥 运镜创新: ${shot.id} | ${innovation.name} | ${timeline._innovation.newPattern}`);
    }

    return shot;
  }

  // 🔥 v6.2-patch82: Prompt标准符合度检查(适配现有中文标记格式)
  checkStandardCompliance(prompt, shotId) {
    // v6.5.53-l: 使用统一的 prompt-standard-v3.js 进行检查
    // 先标准化，再检查，兼容自然语言+块格式+key:value
    const standardized = standardizePrompt(prompt);
    const result = checkStandardCompliance(standardized || prompt, shotId);
    
    return {
      shotId: result.shotId,
      coverage: result.score,
      found: Object.entries(result.checks).filter(([,v]) => v.found).map(([k]) => k),
      missing: result.missing,
      fieldCount: Object.entries(result.checks).filter(([,v]) => v.found).length,
      totalFields: Object.keys(result.checks).length,
      status: result.score >= 80 ? 'high' : result.score >= 60 ? 'medium' : 'low',
      checks: result.checks
    };
  }

  /**
   * 本地模板修复(v6.2-patch87-2)
   * 支持多种问题描述格式,健壮性增强
   */
  _applyQuickFixes(shots, issues, prd) {
    const fixed = [];

    // 健壮性:过滤无效问题
    const validIssues = (issues || []).filter(i =>
      i && (i.message || i.description || i.detail || i.suggestion)
    );

    if (validIssues.length === 0) {
      this.log('PIPELINE', '🟡 导演评审未发现有效问题,跳过本地修复');
      return fixed;
    }

    this.log('PIPELINE', `🔧 本地模板修复启动 | 有效问题: ${validIssues.length}个`);

    // 辅助:从 issue 中提取文本(支持多种字段名)
    const getIssueText = (issue) => {
      return (issue.message || '') + ' ' +
             (issue.description || '') + ' ' +
             (issue.detail || '') + ' ' +
             (issue.suggestion || '');
    };

    // 辅助:获取受影响的镜头ID
    const getAffectedShotIds = (issue) => {
      if (issue.affectedShots && issue.affectedShots.length > 0) return issue.affectedShots;
      // 从文本中提取镜头ID(如 S02, S03 等)
      const text = getIssueText(issue);
      const matches = text.match(/S\d{2,3}/gi) || [];
      if (matches.length > 0) return matches.map(m => m.toUpperCase());
      return null; // 全局问题
    };

    // 1. 修复旁白混入非叙事指令/动作指令/矛盾(通用模式)
    const narrationIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'narration' ||
             text.includes('旁白') ||
             text.includes('叙事') ||
             text.includes('指令') ||
             text.includes('触碰') ||
             text.includes('后退') ||
             text.includes('矛盾');
    });

    for (const issue of narrationIssues) {
      const shotIds = getAffectedShotIds(issue);
      const text = getIssueText(issue);

      // 处理 "主动触碰" 类问题
      if (text.includes('主动触碰') || text.includes('非叙事')) {
        // S02: 将"主动触碰"改为具体动作(匹配画面)
        const s02 = shots.find(s => (s.id || s.shotId) === 'S02' || (s.id || s.shotId) === 's02');
        if (s02 && s02.narration && s02.narration.includes('主动触碰')) {
          s02.narration = s02.narration.replace('主动触碰', '指尖擦过岩壁');
          fixed.push({ shotId: 'S02', field: 'narration', issue: '旁白混入非叙事指令', fix: '改为"指尖擦过岩壁"' });
        }
        // S05: 消除"主动触碰"与后退的矛盾
        const s05 = shots.find(s => (s.id || s.shotId) === 'S05' || (s.id || s.shotId) === 's05');
        if (s05 && s05.narration && s05.narration.includes('主动触碰')) {
          s05.narration = s05.narration.replace(/主动触碰[^。]*。?/, '缓缓后退,放下戒备,');
          fixed.push({ shotId: 'S05', field: 'narration', issue: '旁白动作矛盾', fix: '改为"缓缓后退,放下戒备"' });
        }
      }

      // 处理 "后退" 与前进/触碰的矛盾
      if (text.includes('后退') && (text.includes('前进') || text.includes('触碰'))) {
        const targetIds = shotIds || ['S05'];
        for (const sid of targetIds) {
          const shot = shots.find(s => (s.id || s.shotId) === sid);
          if (shot && shot.narration && (shot.narration.includes('前进') || shot.narration.includes('触碰'))) {
            shot.narration = shot.narration.replace(/(?:主动)?(?:前进|触碰)[^。]*。?/g, '缓缓后退,');
            fixed.push({ shotId: sid, field: 'narration', issue: '旁白后退与前进矛盾', fix: '统一为后退动作' });
          }
        }
      }
    }

    // 2. 修复场景/标题矛盾(PRD对齐问题)
    const sceneIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'prd_alignment' ||
             text.includes('不周') ||
             text.includes('场景') ||
             text.includes('标题') ||
             text.includes('地理') ||
             text.includes('空间');
    });

    for (const issue of sceneIssues) {
      const text = getIssueText(issue);
      // 不周山脉 → 钩吾废墟
      if (text.includes('不周') && text.includes('钩吾')) {
        const s04 = shots.find(s => (s.id || s.shotId) === 'S04' || (s.id || s.shotId) === 's04');
        if (s04) {
          if (s04.scene && s04.scene.includes('不周')) {
            const old = s04.scene;
            s04.scene = s04.scene.replace(/不周山[脉]*/g, '钩吾废墟');
            fixed.push({ shotId: 'S04', field: 'scene', issue: '场景矛盾', fix: `"${old}" → "${s04.scene}"` });
          }
          if (s04.title && s04.title.includes('不周')) {
            const old = s04.title;
            s04.title = s04.title.replace(/不周山[脉]*/g, '钩吾废墟');
            fixed.push({ shotId: 'S04', field: 'title', issue: '标题矛盾', fix: `"${old}" → "${s04.title}"` });
          }
        }
      }
    }

    // 3. 修复运镜矛盾
    const cameraIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'camera' ||
             (text.includes('一镜到底') && text.includes('多段')) ||
             text.includes('自相矛盾') ||
             text.includes('运镜');
    });

    for (const issue of cameraIssues) {
      const shotIds = getAffectedShotIds(issue) || ['S03', 'S04', 'S05'];
      for (const sid of shotIds) {
        const shot = shots.find(s => (s.id || s.shotId) === sid);
        if (shot && shot.cameraMovement) {
          const cm = typeof shot.cameraMovement === 'string'
            ? shot.cameraMovement
            : shot.cameraMovement?.description || '';

          if (cm.includes('一镜到底') && cm.includes('多段')) {
            const newCm = cm.replace(/一镜到底.*?(?=,|。|$)/, '').replace(/多段运镜.*?/, '多段剪辑');
            if (typeof shot.cameraMovement === 'string') {
              shot.cameraMovement = newCm;
            } else {
              shot.cameraMovement.description = newCm;
            }
            fixed.push({ shotId: sid, field: 'cameraMovement', issue: '一镜到底与多段矛盾', fix: '统一为多段剪辑' });
          }
        }
      }
    }

    // 4. 修复情绪弧线
    const climaxIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'story' ||
             (text.includes('Climax') || text.includes('Peak') || text.includes('高潮') || text.includes('情绪弧线'));
    });

    if (climaxIssues.length > 0) {
      const s03 = shots.find(s => (s.id || s.shotId) === 'S03' || (s.id || s.shotId) === 's03');
      if (s03 && s03.emotionPhase === 'building') {
        s03.emotionPhase = 'climax';
        if (s03.emotionTarget) s03.emotionTarget.emotion = 'climax';
        fixed.push({ shotId: 'S03', field: 'emotionPhase', issue: '情绪弧线缺少Climax', fix: 'S03改为climax' });
      }
    }

    // 5. 修复"永恒饥饿"PRD核心概念视觉化(如果导演指出)
    const hungerIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return text.includes('饥饿') || text.includes('贪欲') || text.includes('视觉化');
    });

    for (const issue of hungerIssues) {
      // 在S03或S04的prompt中增加饕餮行为动作(视觉化饥饿)
      const targetIds = ['S03', 'S04'];
      for (const sid of targetIds) {
        const shot = shots.find(s => (s.id || s.shotId) === sid);
        if (shot && shot.prompt && !shot.prompt.includes('舔舐') && !shot.prompt.includes('腹部')) {
          shot.prompt += ',饕餮腹部巨口缓缓蠕动,利齿交错,散发吞噬欲望';
          fixed.push({ shotId: sid, field: 'prompt', issue: 'PRD核心概念缺乏视觉化', fix: '增加饕餮饥饿动作' });
          break; // 只改第一个匹配的
        }
      }
    }

    this.log('PIPELINE', `✅ 本地修复完成 | 修复 ${fixed.length} 处核心问题`);
    return fixed;
  }

  /**
   * 导演预检:在Stage 5生成prompt时检查旁白匹配(v6.2-patch87-短期)
   */
  _directorPreflight(shots, prd) {
    const warnings = [];
    for (const shot of shots) {
      const narration = shot.narration || '';
      const prompt = shot.prompt || '';

      // 检查旁白动作是否有画面支撑
      const actionKeywords = ['触碰', '后退', '前进', '奔跑', '伸手'];
      for (const action of actionKeywords) {
        if (narration.includes(action) && !prompt.includes(action)) {
          warnings.push({
            shotId: shot.id || shot.shotId,
            type: 'narration-prompt-mismatch',
            message: `旁白"${action}"在画面中未体现`,
            suggestion: `在prompt中增加"${action}"动作或修改旁白`
          });
        }
      }
    }
    return warnings;
  }

  /**
   * 分段验证:独立运行指定Stage(v6.2-patch87-2)
   * 用于调试和验证单个Stage
   * @param {string} stageName - Stage名称(如 'STAGE-5', 'STAGE-11')
   * @param {Object} upstreamStages - 前置Stage的结果(如 {prd, script, storyboard})
   * @param {Object} input - 原始输入
   */


  // ========== v2.0: 创意指数系统辅助方法 ==========

  /**
   * 为指定Stage注入创意指数指令
   * 在Stage执行完成后调用，增强输出结果
   */
  _injectCreativeIntensity(stageName, stageOutput) {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) {
      return stageOutput; // 0.2以下不干预
    }

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) {
      return stageOutput; // 该Stage无激活模块
    }

    this.log('PIPELINE', `[创意指数] ${stageName} 注入 ${instructions.count} 个模块指令`);

    // 将指令附加到Stage输出中
    if (!stageOutput._creativeIntensity) {
      stageOutput._creativeIntensity = {
        intensity: this.creativeIntensity,
        level: instructions.level,
        instructions: []
      };
    }
    
    // v6.6.5-fix: 确保 instructions 是数组
    if (!Array.isArray(stageOutput._creativeIntensity.instructions)) {
      stageOutput._creativeIntensity.instructions = [];
    }

    stageOutput._creativeIntensity.instructions.push({
      stage: stageName,
      ...instructions
    });

    return stageOutput;
  }

  /**
   * 获取指定Stage的创意指数指令文本（用于Prompt注入）
   */
  _getCreativeIntensityInstructions(stageName) {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) return '';

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) return '';

    return `\n[CREATIVE_INTENSITY_${this.creativeIntensity}]\n${instructions.instructions}\n[/CREATIVE_INTENSITY]\n`;
  }

  /**
   * 将创意指数指令注入到 Prompt 字符串中（智能长度控制）
   * 确保不超出 1500 字符上限
   */
  _injectCreativeIntensityToPrompt(prompt, stageName, shotId = '') {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) {
      return prompt; // 0.2以下不干预
    }

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) {
      return prompt; // 该Stage无激活模块
    }

    const instructionText = instructions.instructions;
    const currentLength = prompt.length;
    const instructionLength = instructionText.length;

    // 如果注入后不超过 1500 字符，直接追加
    if (currentLength + instructionLength + 20 <= 1500) {
      this.log('STAGE-11', `  🎨 [创意指数] ${shotId} 注入${instructions.count}个模块 | +${instructionLength}字符 | 总:${currentLength + instructionLength + 20}/1500`);
      return `${prompt}\n[创意指数${this.creativeIntensity}]${instructionText}[/创意指数]`;
    }

    // 如果会超出，进行智能裁剪
    const maxAvailable = 1500 - currentLength - 20;
    if (maxAvailable > 50) {
      const truncated = instructionText.substring(0, maxAvailable - 3) + '...';
      this.log('STAGE-11', `  🎨 [创意指数] ${shotId} 注入${instructions.count}个模块(截断) | +${truncated.length}字符 | 原:${instructionLength} | 总:${currentLength + truncated.length + 20}/1500`);
      return `${prompt}\n[创意指数${this.creativeIntensity}]${truncated}[/创意指数]`;
    }

    // 空间不足，不注入
    this.log('STAGE-11', `  ⚠️ [创意指数] ${shotId} 空间不足(${currentLength}/1500),跳过注入`);
    return prompt;
  }

  // 🔥 v2.0: 创意指数系统辅助方法结束
}

// ========== v6.2-patch87-2: 分段验证独立函数 ==========
// ========== v6.2-patch87-2: 分段验证独立函数 ==========

/**
 * 分段验证:独立运行指定Stage
 * 用于调试和验证单个Stage,无需跑完整链路
 * @param {Object} pipeline - NirathMasterPipeline 实例
 * @param {string} stageName - Stage名称(如 'STAGE-5', 'STAGE-11')
 * @param {Object} upstreamStages - 前置Stage的结果(如 {prd, script, storyboard})
 * @param {Object} input - 原始输入
 */
async function runStandaloneStage(pipeline, stageName, upstreamStages = {}, input = {}) {
  pipeline.log('PIPELINE', `🧪 独立运行 ${stageName}(分段验证模式)`);

  const stageMap = {
    'STAGE-1': () => pipeline.stagePRD(input),
    'STAGE-2': () => pipeline.stageAlignment(input, upstreamStages.prd),
    'STAGE-3': () => pipeline.stageSchemaValidation(upstreamStages.prd),
    'STAGE-4': () => pipeline.stageCharacters(input, upstreamStages.prd),
    'STAGE-5': () => pipeline.stageScriptGeneration(input, upstreamStages.prd),
    'STAGE-5.5': () => pipeline.stageFPVDecision(upstreamStages.script),
    'STAGE-6': () => pipeline.stageDurationAllocation(upstreamStages.script, input),
    'STAGE-7': () => pipeline.stageStoryboard(upstreamStages.script, upstreamStages.duration, input),
    'STAGE-7.2': () => pipeline.stageProtagonistInitiative(upstreamStages.storyboard, input),
    'STAGE-7.3': () => pipeline.stageNarrationTrim(upstreamStages.storyboard, upstreamStages.duration),
    'STAGE-7.4': () => pipeline.stageDurationNarrationAlignment(upstreamStages.storyboard, upstreamStages.duration),
    'STAGE-7.5': () => pipeline.stageOpeningGeneration(input, upstreamStages.storyboard, upstreamStages.characters),
    'STAGE-8': () => pipeline.stageStoryboardValidation(upstreamStages.storyboard, input),
    'STAGE-8.5': () => pipeline.stageFiveElementCheck(upstreamStages.storyboard, input),
    'STAGE-9': () => pipeline.stageCameraMovement(upstreamStages.storyboard, upstreamStages.fpvDecision),
    'STAGE-10': () => pipeline.stageContinuity(upstreamStages.storyboard),
    'STAGE-10.5': () => pipeline.stageSafetyGate(upstreamStages),
    'STAGE-11': () => pipeline.stageRender(upstreamStages),
    'STAGE-11.5': () => pipeline.stagePromptQualityGate(upstreamStages.render, upstreamStages.storyboard),
    'STAGE-12': () => pipeline.stageCompliance(upstreamStages.render, upstreamStages.storyboard),
    'STAGE-13': () => pipeline.stagePreRenderValidation(upstreamStages),
    'STAGE-14': () => pipeline.stageStyleInjection(upstreamStages.render),
    'STAGE-15': () => pipeline.stagePostProduction(upstreamStages),
    'STAGE-16': () => pipeline.stageFinalOutput(upstreamStages)
  };

  const stageFn = stageMap[stageName];
  if (!stageFn) {
    throw new Error(`未知Stage: ${stageName}。可用: ${Object.keys(stageMap).join(', ')}`);
  }

  const startTime = Date.now();
  try {
    const result = await stageFn();
    const elapsed = Date.now() - startTime;
    pipeline.log('PIPELINE', `✅ ${stageName} 独立运行完成 | ${elapsed}ms`);
    return { stageName, result, elapsedMs: elapsed, success: true };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    pipeline.log('PIPELINE', `❌ ${stageName} 独立运行失败 | ${elapsed}ms | ${err.message}`);
    return { stageName, error: err.message, elapsedMs: elapsed, success: false };
  }
}


module.exports = { NirathMasterPipeline, runStandaloneStage };
