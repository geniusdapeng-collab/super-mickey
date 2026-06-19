# 卓越系统 (zhuoyue-system) - CONFIG 模块

> 导出时间: 2026-06-18T07:15:48.339Z

---

## config/degradation-matrix.js

> 文件大小: 15503 bytes

```javascript
/**
 * Degradation Matrix v1.0 — 优雅降级矩阵
 * 系统核心基础设施：每个Stage的"Plan B"配置，不再一刀切
 *
 * 职责：
 * - 每个Stage的降级策略：跳过、Mock、简化、降级服务
 * - 用户消息：失败时告诉用户发生了什么（而非崩溃）
 * - 与Saga编排器集成：失败时自动选择降级路径
 * - 与Stage Health Monitor集成：根据健康评分选择降级级别
 * - 与Event Bus集成：发布降级事件
 *
 * 核心能力：
 * 1. StageDegradationConfig: 每个Stage的降级配置
 * 2. DegradationMatrix: 管理所有Stage的降级策略
 * 3. DegradationStrategy: 内置策略（skip、mock、simplify、fallback）
 * 4. UserMessage: 用户友好的降级通知
 * 5. AutoDegradation: 根据健康评分自动降级
 *
 * 降级策略：
 * - skip: 跳过Stage（非阻塞时）
 * - mock: 返回预生成数据
 * - simplify: 简化执行（如减少镜头数量）
 * - fallback: 使用备用服务（如切换到另一个LLM Provider）
 * - partial: 部分执行（如只处理部分镜头）
 * - cache: 使用缓存数据
 * - degrade_quality: 降低质量但继续（如减少渲染质量）
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 稳定性工程
 */

'use strict';

const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、降级策略定义
// ============================================================

const DEGRADATION_STRATEGIES = {
  skip: {
    name: '跳过',
    description: '跳过该Stage，继续后续链路',
    userMessage: '该环节已跳过，不影响最终输出',
    impact: 'low'
  },
  mock: {
    name: 'Mock数据',
    description: '返回预生成的Mock数据',
    userMessage: '使用默认数据继续生成',
    impact: 'medium'
  },
  simplify: {
    name: '简化',
    description: '简化执行（如减少镜头数量）',
    userMessage: '简化该环节以加速生成',
    impact: 'medium'
  },
  fallback: {
    name: '备用服务',
    description: '切换到备用服务',
    userMessage: '切换到备用服务继续处理',
    impact: 'low'
  },
  partial: {
    name: '部分执行',
    description: '只处理部分数据（如部分镜头）',
    userMessage: '部分处理完成，继续后续步骤',
    impact: 'medium'
  },
  cache: {
    name: '缓存',
    description: '使用上次成功的缓存数据',
    userMessage: '使用缓存数据继续',
    impact: 'low'
  },
  degrade_quality: {
    name: '降低质量',
    description: '降低质量但继续（如减少渲染质量）',
    userMessage: '略微降低质量以继续生成',
    impact: 'medium'
  }
};

// ============================================================
// 二、每个Stage的降级配置
// ============================================================

const STAGE_DEGRADATION_CONFIG = {
  'STAGE-0': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: 'Mock数据检查已跳过'
  },
  'STAGE-1': {
    strategies: ['mock', 'skip'],
    defaultStrategy: 'mock',
    mockData: {
      prd: {
        title: '未命名项目',
        duration: { total: 15, min: 10, max: 15 },
        targetBeast: '未指定',
        genre: '纪录片',
        style: '写实风格',
        tone: '中性'
      }
    },
    userMessage: 'PRD生成失败，使用默认配置继续'
  },
  'STAGE-2': {
    strategies: ['skip', 'mock'],
    defaultStrategy: 'skip',
    userMessage: '需求对齐检查已跳过，继续生成'
  },
  'STAGE-3': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: 'Schema校验已跳过'
  },
  'STAGE-4': {
    strategies: ['mock', 'simplify'],
    defaultStrategy: 'mock',
    mockData: {
      characters: [
        { id: 'protagonist', name: '主角', role: 'protagonist', appearance: '未指定外貌' }
      ]
    },
    userMessage: '角色加载失败，使用默认角色继续'
  },
  'STAGE-5': {
    strategies: ['mock', 'simplify'],
    defaultStrategy: 'mock',
    mockData: {
      scenes: [
        { id: 'S01', scene: '开场', content: '开场场景', narration: '开场旁白' }
      ]
    },
    userMessage: '剧本生成失败，使用基础剧本继续'
  },
  'STAGE-5.5': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: 'FPV决策已跳过'
  },
  'STAGE-6': {
    strategies: ['mock', 'skip'],
    defaultStrategy: 'mock',
    mockData: { durations: [{ shot: 'S01', duration: 5 }] },
    userMessage: '时长分配失败，使用默认时长'
  },
  'STAGE-7': {
    strategies: ['mock', 'simplify'],
    defaultStrategy: 'mock',
    mockData: {
      storyboard: {
        shots: [
          { id: 'S01', sequence: 1, scene: '开场', visualPrompt: '开场画面' }
        ]
      }
    },
    userMessage: '故事板生成失败，使用基础故事板继续'
  },
  'STAGE-7.2': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '主角主动性注入已跳过'
  },
  'STAGE-7.3': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '口播精简已跳过'
  },
  'STAGE-7.4': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '时长校准已跳过'
  },
  'STAGE-7.5': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '片头生成已跳过'
  },
  'STAGE-8': {
    strategies: ['skip', 'mock'],
    defaultStrategy: 'skip',
    userMessage: '故事板校验已跳过'
  },
  'STAGE-8.5': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '五要素检查已跳过'
  },
  'STAGE-9': {
    strategies: ['mock', 'skip'],
    defaultStrategy: 'mock',
    mockData: { cameraMovements: [{ shot: 'S01', type: 'static' }] },
    userMessage: '运镜系统失败，使用静态运镜'
  },
  'STAGE-10': {
    strategies: ['skip', 'mock'],
    defaultStrategy: 'skip',
    userMessage: '连续性检查已跳过'
  },
  'STAGE-10.5': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '渲染前置检查已跳过'
  },
  'STAGE-11': {
    strategies: ['mock', 'degrade_quality', 'partial'],
    defaultStrategy: 'mock',
    mockData: { renderOutput: { videoPath: null, frameCount: 0, qualityScore: 0 } },
    userMessage: '渲染失败，该镜头将跳过渲染'
  },
  'STAGE-11.5': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: 'Prompt质量检查已跳过'
  },
  'STAGE-12': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '合规检查已跳过'
  },
  'STAGE-13': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '前置验证已跳过'
  },
  'STAGE-14': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '风格注入已跳过'
  },
  'STAGE-15': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '后期规则已跳过'
  },
  'STAGE-16': {
    strategies: ['skip', 'simplify'],
    defaultStrategy: 'skip',
    userMessage: '导演优化已跳过，不影响输出'
  },
  'STAGE-17': {
    strategies: ['skip'],
    defaultStrategy: 'skip',
    userMessage: '导演-编剧循环已跳过'
  }
};

// ============================================================
// 三、降级矩阵
// ============================================================

class DegradationMatrix {
  constructor(options = {}) {
    this.configs = { ...STAGE_DEGRADATION_CONFIG };
    this.strategies = { ...DEGRADATION_STRATEGIES };
    this.eventBus = new NirathEventBus({ name: 'degradation', enabled: true });
    this.degradationLog = [];
    this.autoDegrade = options.autoDegrade !== false;
  }

  /**
   * 获取Stage的降级配置
   */
  getConfig(stageId) {
    return this.configs[stageId] || {
      strategies: ['skip'],
      defaultStrategy: 'skip',
      userMessage: '该环节已跳过'
    };
  }

  /**
   * 选择降级策略
   */
  selectStrategy(stageId, healthScore = 50) {
    const config = this.getConfig(stageId);
    
    // 健康评分高，优先选择影响小的策略
    if (healthScore >= 80) {
      return config.strategies[0] || config.defaultStrategy;
    }
    
    // 健康评分中等，选择默认策略
    if (healthScore >= 60) {
      return config.defaultStrategy;
    }
    
    // 健康评分低，使用最安全的策略（通常是skip或mock）
    return config.strategies.find(s => s === 'skip' || s === 'mock') || config.defaultStrategy;
  }

  /**
   * 执行降级
   */
  async degrade(stageId, context, options = {}) {
    const healthScore = options.healthScore || 50;
    const strategy = options.strategy || this.selectStrategy(stageId, healthScore);
    const config = this.getConfig(stageId);

    console.log(`[DegradationMatrix] ⚠️ ${stageId} 降级 | 策略:${strategy} | 健康分:${healthScore}`);

    const degradation = {
      timestamp: Date.now(),
      stageId,
      strategy,
      healthScore,
      userMessage: config.userMessage
    };

    this.degradationLog.push(degradation);

    // 发布事件
    this.eventBus.publish('stage.degraded', degradation, { traceId: context.traceId || `deg_${Date.now()}` });

    // 执行降级策略
    switch (strategy) {
      case 'skip':
        return {
          status: 'degraded',
          strategy: 'skip',
          output: context,
          userMessage: config.userMessage
        };

      case 'mock':
        const mockData = config.mockData || {};
        return {
          status: 'degraded',
          strategy: 'mock',
          output: { ...context, ...mockData },
          userMessage: config.userMessage
        };

      case 'simplify':
        const simplified = this.simplifyContext(stageId, context);
        return {
          status: 'degraded',
          strategy: 'simplify',
          output: simplified,
          userMessage: config.userMessage
        };

      case 'partial':
        const partial = this.partialContext(stageId, context);
        return {
          status: 'degraded',
          strategy: 'partial',
          output: partial,
          userMessage: config.userMessage
        };

      case 'cache':
        const cached = this.loadFromCache(stageId, context);
        return {
          status: 'degraded',
          strategy: 'cache',
          output: cached || context,
          userMessage: config.userMessage
        };

      case 'degrade_quality':
        const degraded = this.degradeQuality(stageId, context);
        return {
          status: 'degraded',
          strategy: 'degrade_quality',
          output: degraded,
          userMessage: config.userMessage
        };

      default:
        return {
          status: 'degraded',
          strategy: 'unknown',
          output: context,
          userMessage: '未知降级策略'
        };
    }
  }

  /**
   * 简化上下文
   */
  simplifyContext(stageId, context) {
    // 简化逻辑：根据Stage类型减少数据量
    if (stageId === 'STAGE-5') {
      // 剧本简化：只保留前3个场景
      if (context.scenes) {
        return { ...context, scenes: context.scenes.slice(0, 3) };
      }
    }
    if (stageId === 'STAGE-7') {
      // 故事板简化：只保留前5个镜头
      if (context.storyboard?.shots) {
        return {
          ...context,
          storyboard: {
            ...context.storyboard,
            shots: context.storyboard.shots.slice(0, 5)
          }
        };
      }
    }
    return context;
  }

  /**
   * 部分处理
   */
  partialContext(stageId, context) {
    // 部分处理：只处理一半数据
    if (context.shots) {
      return { ...context, shots: context.shots.slice(0, Math.ceil(context.shots.length / 2)) };
    }
    return context;
  }

  /**
   * 从缓存加载
   */
  loadFromCache(stageId, context) {
    // 简化实现：实际应该使用文件缓存或Redis
    console.log(`[DegradationMatrix] 📦 ${stageId} 尝试从缓存加载...`);
    return null;
  }

  /**
   * 降低质量
   */
  degradeQuality(stageId, context) {
    if (context.renderOutput) {
      return {
        ...context,
        renderOutput: {
          ...context.renderOutput,
          qualityScore: (context.renderOutput.qualityScore || 1) * 0.7  // 降低30%质量
        }
      };
    }
    return context;
  }

  /**
   * 获取降级报告
   */
  getDegradationReport() {
    const total = this.degradationLog.length;
    const byStrategy = {};
    const byStage = {};

    for (const deg of this.degradationLog) {
      byStrategy[deg.strategy] = (byStrategy[deg.strategy] || 0) + 1;
      byStage[deg.stageId] = (byStage[deg.stageId] || 0) + 1;
    }

    return {
      totalDegradations: total,
      byStrategy,
      byStage,
      recent: this.degradationLog.slice(-10),
      impact: total === 0 ? 'none' : total < 3 ? 'low' : total < 5 ? 'medium' : 'high'
    };
  }

  /**
   * 获取用户消息
   */
  getUserMessage(stageId) {
    return this.getConfig(stageId).userMessage || '该环节已跳过';
  }

  /**
   * 获取所有Stage的降级策略
   */
  getAllConfigs() {
    return { ...this.configs };
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  DegradationMatrix,
  DEGRADATION_STRATEGIES,
  STAGE_DEGRADATION_CONFIG,

  // 快速创建
  createDegradationMatrix: (options) => new DegradationMatrix(options)
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Degradation Matrix 集成测试 ===\n');

    const matrix = new DegradationMatrix();

    // 测试1：获取配置
    console.log('--- 测试1：获取配置 ---');
    const config = matrix.getConfig('STAGE-1');
    console.log('STAGE-1 策略:', config.strategies);
    console.log('默认策略:', config.defaultStrategy);
    console.log('用户消息:', config.userMessage);

    // 测试2：选择策略
    console.log('\n--- 测试2：选择策略 ---');
    console.log('健康分100:', matrix.selectStrategy('STAGE-1', 100));
    console.log('健康分70:', matrix.selectStrategy('STAGE-1', 70));
    console.log('健康分40:', matrix.selectStrategy('STAGE-1', 40));

    // 测试3：执行降级
    console.log('\n--- 测试3：执行降级 ---');
    const result = await matrix.degrade('STAGE-1', { prd: null }, { healthScore: 50 });
    console.log('降级状态:', result.status);
    console.log('降级策略:', result.strategy);
    console.log('输出:', result.output.prd);
    console.log('用户消息:', result.userMessage);

    // 测试4：简化降级
    console.log('\n--- 测试4：简化降级 ---');
    const context = {
      scenes: [
        { id: 'S01', scene: '开场' },
        { id: 'S02', scene: '发展' },
        { id: 'S03', scene: '高潮' },
        { id: 'S04', scene: '结局' },
        { id: 'S05', scene: '尾声' }
      ]
    };
    const simplified = await matrix.degrade('STAGE-5', context, { strategy: 'simplify' });
    console.log('简化后场景数:', simplified.output.scenes.length);

    // 测试5：报告
    console.log('\n--- 测试5：降级报告 ---');
    console.log(matrix.getDegradationReport());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## config/error-codes.js

> 文件大小: 433 bytes

```javascript
// 全局错误码统一
module.exports = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1,
  TIMEOUT: 2,
  OOM: 3,
  API_ERROR: 4,
  PARSE_ERROR: 5,
  QUALITY_FAIL: 6,

  // 描述
  getDescription(code) {
    const map = {
      0: '成功',
      1: '未知错误',
      2: '超时',
      3: '内存不足',
      4: 'API调用失败',
      5: '解析失败',
      6: '质量检查未通过'
    };
    return map[code] || '未知';
  }
};

```

---

## config/llm-policy.js

> 文件大小: 321 bytes

```javascript
'use strict';

module.exports = {
  defaultProvider: 'kimi',
  timeoutMs: 240000,
  retry: {
    maxAttempts: 3,
    backoffMs: 2000
  },
  maxTokens: {
    default: 4096,
    stage1: 8192,
    director: 16000,
    screenwriter: 16000,
    storycraft: 32000
  },
  temperature: {
    default: 1.0,
    stable: 0.4
  }
};

```

---

## config/mode-profile.js

> 文件大小: 1627 bytes

```javascript
'use strict';

const MODE_PROFILES = {
  nirath: {
    mode: 'nirath',
    description: '山海经 / Nirath 叙事模式',
    enabledStages: [
      'STAGE-1', 'STAGE-2', 'STAGE-3', 'STAGE-4',
      'STAGE-5', 'STAGE-6', 'STAGE-7',
      'STAGE-7.2', 'STAGE-7.3', 'STAGE-7.4', 'STAGE-7.5',
      'STAGE-8', 'STAGE-8.5',
      'STAGE-9', 'STAGE-10', 'STAGE-10.5',
      'STAGE-11', 'STAGE-11.5',
      'STAGE-12', 'STAGE-13', 'STAGE-14', 'STAGE-15',
      'STAGE-16', 'STAGE-17'
    ],
    enabledCapabilities: [
      'scriptService', 'durationService', 'storyboardService',
      'cameraService', 'renderPrepService', 'qualityGate'
    ],
    rules: {
      requirePortraits: true,
      enableDirectorReview: true,
      enableScreenwriterOptimization: true,
      enableStoryCraft: true,
      enableNirathStyle: true
    }
  },

  generic: {
    mode: 'generic',
    description: '通用视频模式',
    enabledStages: [
      'STAGE-1', 'STAGE-2', 'STAGE-3', 'STAGE-4',
      'STAGE-5', 'STAGE-6', 'STAGE-7',
      'STAGE-8', 'STAGE-9', 'STAGE-10',
      'STAGE-11', 'STAGE-12', 'STAGE-13', 'STAGE-15'
    ],
    enabledCapabilities: [
      'scriptService', 'durationService', 'storyboardService',
      'cameraService', 'renderPrepService', 'qualityGate'
    ],
    rules: {
      requirePortraits: true,
      enableDirectorReview: false,
      enableScreenwriterOptimization: false,
      enableStoryCraft: false,
      enableNirathStyle: false
    }
  }
};

function getModeProfile(mode = 'nirath') {
  return MODE_PROFILES[mode] || MODE_PROFILES.nirath;
}

module.exports = {
  MODE_PROFILES,
  getModeProfile
};

```

---

## config/prompt-length.js

> 文件大小: 773 bytes

```javascript
// 统一 Prompt 长度配置（唯一真源）
// 超短裙系统：总长度稳定落在 1400-1500 字符区间

module.exports = {
  TARGET_MIN: 1400,
  TARGET_MAX: 1500,
  HARD_MAX: 1500,

  // 保留兼容字段，但不再依赖固定模板长度
  SYSTEM_TEMPLATE_LEN: 0,

  getCreativeTarget(systemTemplateLen = 0) {
    return {
      min: Math.max(0, this.TARGET_MIN - systemTemplateLen),
      max: Math.max(0, this.TARGET_MAX - systemTemplateLen)
    };
  },

  validate(length) {
    return length >= this.TARGET_MIN && length <= this.TARGET_MAX;
  },

  getStatus(length) {
    if (length > this.HARD_MAX) return 'overflow';
    if (length < this.TARGET_MIN) return 'underflow';
    if (length <= this.TARGET_MAX) return 'ideal';
    return 'unknown';
  }
};

```

---

## config/quality-dimensions.js

> 文件大小: 975 bytes

```javascript
'use strict';

module.exports = {
  dimensions: {
    promptQuality: {
      name: 'Prompt质量',
      weight: 0.20,
      passScore: 70,
      warnScore: 55
    },
    storyQuality: {
      name: '故事质量',
      weight: 0.20,
      passScore: 70,
      warnScore: 55
    },
    continuityQuality: {
      name: '连续性质量',
      weight: 0.15,
      passScore: 70,
      warnScore: 55
    },
    directorQuality: {
      name: '导演质量',
      weight: 0.20,
      passScore: 75,
      warnScore: 60
    },
    renderReadiness: {
      name: '渲染就绪度',
      weight: 0.15,
      passScore: 80,
      warnScore: 60
    },
    systemIntegrity: {
      name: '系统完整性',
      weight: 0.10,
      passScore: 90,
      warnScore: 70
    }
  },

  total: {
    passScore: 75,
    warnScore: 60
  },

  hardBlockRules: {
    requireSystemIntegrity: true,
    requireRenderReadiness: true,
    requirePromptText: true,
    requireShots: true
  }
};
```

---

## config/render-policy.js

> 文件大小: 216 bytes

```javascript
'use strict';

module.exports = {
  defaultRatio: '16:9',
  defaultResolution: '720p',
  minDuration: 3,
  maxDuration: 15,
  maxConcurrent: 3,
  requirePortraitsInProduction: true,
  requireReferenceImages: true
};

```

---

## config/runtime-standard.js

> 文件大小: 528 bytes

```javascript
const PROMPT_LENGTH = require('./prompt-length');

module.exports = {
  prompt: {
    targetMin: PROMPT_LENGTH.TARGET_MIN,
    targetMax: PROMPT_LENGTH.TARGET_MAX,
    hardMax: PROMPT_LENGTH.HARD_MAX
  },

  memory: {
    nodeMaxOldSpaceMB: 4096,
    enableManualGC: true,
    writeSlimResultOnly: true
  },

  pipeline: {
    useLLM: true,
    skipDirectorReview: false,
    skipScreenwriterOptimization: false
  },

  report: {
    includeFullPrompts: true,
    includeTimeline: true,
    maxPromptLengthInReport: 5000
  }
};

```

---

## config/stage-map.js

> 文件大小: 2357 bytes

```javascript
'use strict';

const STAGE_MAP = [
  { stageId: 'STAGE-1', title: 'PRD生成', progress: 5, capability: null },
  { stageId: 'STAGE-2', title: '需求对齐', progress: 8, capability: null },
  { stageId: 'STAGE-3', title: 'Schema校验', progress: 10, capability: null },
  { stageId: 'STAGE-4', title: '角色系统', progress: 15, capability: null },
  { stageId: 'STAGE-5', title: '剧本生成', progress: 20, capability: 'scriptService' },
  { stageId: 'STAGE-6', title: '时长分配', progress: 30, capability: 'durationService' },
  { stageId: 'STAGE-7', title: '故事板生成', progress: 40, capability: 'storyboardService' },
  { stageId: 'STAGE-7.2', title: '主角主动性注入', progress: 43, capability: null },
  { stageId: 'STAGE-7.3', title: 'Narration精简', progress: 45, capability: null },
  { stageId: 'STAGE-7.4', title: '时长对齐', progress: 47, capability: null },
  { stageId: 'STAGE-7.5', title: '片头生成', progress: 49, capability: null },
  { stageId: 'STAGE-8', title: '故事板校验', progress: 52, capability: null },
  { stageId: 'STAGE-8.5', title: '五要素检查', progress: 54, capability: null },
  { stageId: 'STAGE-9', title: '运镜生成', progress: 58, capability: 'cameraService' },
  { stageId: 'STAGE-10', title: '连续性检查', progress: 62, capability: null },
  { stageId: 'STAGE-10.5', title: '渲染前置检查', progress: 65, capability: null },
  { stageId: 'STAGE-11', title: '渲染前准备', progress: 70, capability: 'renderPrepService' },
  { stageId: 'STAGE-11.5', title: 'Prompt质量闸门', progress: 73, capability: 'qualityGate' },
  { stageId: 'STAGE-12', title: '合规检查', progress: 78, capability: null },
  { stageId: 'STAGE-13', title: '定妆照/引用图检查', progress: 82, capability: null },
  { stageId: 'STAGE-14', title: '风格注入', progress: 86, capability: null },
  { stageId: 'STAGE-15', title: '后期规则', progress: 90, capability: null },
  { stageId: 'STAGE-16', title: '导演优化', progress: 94, capability: null },
  { stageId: 'STAGE-17', title: '编剧闭环优化', progress: 97, capability: null }
];

function getStageMap(mode = 'nirath') {
  return STAGE_MAP;
}

function getStageMeta(stageId) {
  return STAGE_MAP.find(s => s.stageId === stageId) || null;
}

module.exports = {
  STAGE_MAP,
  getStageMap,
  getStageMeta
};
```

---

## config/system-manifest.json

> 文件大小: 1695 bytes

```javascript
{
  "systemName": "nirath-master-pipeline",
  "version": "v6.5.0",
  "currentMode": "nirath",
  "entrypoints": {
    "cli": "app/cli.js",
    "preproduction": "app/commands/preproduction.js",
    "legacyPreproduction": "run-taotie-preproduction.js"
  },
  "coreConfigs": [
    "config/prompt-length.js",
    "config/runtime-standard.js",
    "config/llm-policy.js",
    "config/render-policy.js",
    "config/quality-dimensions.js",
    "config/mode-profile.js",
    "config/stage-map.js"
  ],
  "coreSystems": [
    "systems/env.js",
    "systems/logger.js",
    "systems/errors.js",
    "systems/output-cleaner.js",
    "systems/report-writer.js",
    "systems/preproduction-service.js",
    "systems/prompt-resolver.js",
    "systems/portrait-resolver.js",
    "systems/render-request-builder.js",
    "systems/render-submitter.js",
    "systems/quality-reporter.js",
    "systems/quality-gate.js",
    "systems/stage-context.js",
    "systems/stage-result.js",
    "systems/stage-runner.js",
    "systems/capability-registry.js",
    "systems/release-manifest.js"
  ],
  "stageServices": [
    "systems/stages/stage-script.js",
    "systems/stages/stage-duration.js",
    "systems/stages/stage-storyboard.js",
    "systems/stages/stage-camera.js",
    "systems/stages/stage-render-prep.js"
  ],
  "requiredDirectories": [
    "app",
    "app/commands",
    "config",
    "systems",
    "systems/stages",
    "stories",
    "scripts",
    "output"
  ],
  "keyCapabilities": [
    "cli-entry",
    "preproduction-service",
    "unified-render-submitter",
    "unified-quality-gate",
    "stage-runner",
    "stage-services",
    "capability-registry",
    "mode-profile",
    "stage-map"
  ]
}
```

---

