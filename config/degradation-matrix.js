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
 * @author Core Team
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
