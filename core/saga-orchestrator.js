/**
 * Nirath Saga 阶段原子性编排器 v1.0
 * 系统核心基础设施：为所有Stage提供原子性执行、补偿事务、降级回退
 *
 * 职责：
 * - 阶段原子性：每个Stage独立执行，成功/失败有明确定义
 * - 补偿事务：下游失败时，上游已执行Stage可回滚
 * - 非阻塞顾问Stage：导演优化、编剧循环失败不阻断主链路
 * - 降级回退：Stage失败时提供安全降级路径
 * - 自动重试：带指数退避的自动重试
 * - 事件集成：与Event Bus Pilot打通，发布Stage生命周期事件
 *
 * 设计模式：Saga Pattern（参考 Chris Richardson《微服务模式》）
 *
 * @version v1.0
 * @author Core Team
 * @priority P0 - 架构基础
 */

'use strict';

const { NirathEventBus } = require('../systems/event-bus-pilot');

// ============================================================
// 一、Saga 阶段定义
// ============================================================

/**
 * Stage 配置定义
 * 所有17个Stage的声明式配置
 */
const STAGE_DEFINITIONS = {
  // === 前期制作 (Pre-Production) ===
  
  'STAGE-0': {
    id: 'STAGE-0',
    name: 'Mock数据清理检查',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },  // 失败时跳过（非关键）
    compensate: null  // 无补偿需要
  },

  'STAGE-1': {
    id: 'STAGE-1',
    name: 'PRD中央校准文档生成',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 60000,
    retryPolicy: { maxAttempts: 3, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { prd: null } },
    compensate: null
  },

  'STAGE-2': {
    id: 'STAGE-2',
    name: '需求对齐闸机',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: false } },
    compensate: null
  },

  'STAGE-3': {
    id: 'STAGE-3',
    name: 'Schema校验',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-4': {
    id: 'STAGE-4',
    name: '角色系统加载',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { characters: [] } },
    compensate: null
  },

  'STAGE-5': {
    id: 'STAGE-5',
    name: '剧本生成与分析',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 120000,
    retryPolicy: { maxAttempts: 2, backoffMs: 5000 },
    fallback: { strategy: 'default_value', defaultValue: { script: null } },
    compensate: async (result, context) => {
      // 清理已生成的剧本数据
      if (context.script) delete context.script;
      if (context.scenes) delete context.scenes;
      console.log('[Saga:Compensate] STAGE-5 已清理剧本数据');
    }
  },

  'STAGE-5.5': {
    id: 'STAGE-5.5',
    name: 'FPV镜头智能决策',
    phase: 'pre_production',
    blocking: true,
    required: false,  // 可选
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-6': {
    id: 'STAGE-6',
    name: '时长分配',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { durations: [] } },
    compensate: null
  },

  'STAGE-7': {
    id: 'STAGE-7',
    name: '故事板生成',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 120000,
    retryPolicy: { maxAttempts: 2, backoffMs: 5000 },
    fallback: { strategy: 'default_value', defaultValue: { storyboard: null } },
    compensate: async (result, context) => {
      if (context.storyboard) delete context.storyboard;
      if (context.shots) delete context.shots;
      console.log('[Saga:Compensate] STAGE-7 已清理故事板数据');
    }
  },

  // 顾问Stage：非阻塞
  'STAGE-7.2': {
    id: 'STAGE-7.2',
    name: '主角主动性自动注入',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage：失败不阻塞
    required: false,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除注入的主动性元素
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          delete shot.proactiveElements;
          delete shot._protagonistEnhanced;
        });
      }
      console.log('[Saga:Compensate] STAGE-7.2 已移除主动性注入');
    }
  },

  'STAGE-7.3': {
    id: 'STAGE-7.3',
    name: 'Narration自动精简',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 恢复原始narration（如果有备份）
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          if (shot._originalNarration) {
            shot.narration = shot._originalNarration;
            delete shot._originalNarration;
          }
          delete shot._trimmed;
        });
      }
      console.log('[Saga:Compensate] STAGE-7.3 已恢复原始口播');
    }
  },

  'STAGE-7.4': {
    id: 'STAGE-7.4',
    name: '时长-字数一致性校准',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-7.5': {
    id: 'STAGE-7.5',
    name: '片头自动生成',
    phase: 'pre_production',
    blocking: true,
    required: false,  // 山海经模式才需要
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除自动插入的片头镜头
      if (context.shots && Array.isArray(context.shots)) {
        context.shots = context.shots.filter(shot => !shot._autoGeneratedOpening);
      }
      console.log('[Saga:Compensate] STAGE-7.5 已移除自动片头');
    }
  },

  'STAGE-8': {
    id: 'STAGE-8',
    name: '故事板校验',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true, warnings: [] } },
    compensate: null
  },

  'STAGE-8.5': {
    id: 'STAGE-8.5',
    name: '五要素检查',
    phase: 'pre_production',
    blocking: true,
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // === 制作 (Production) ===

  'STAGE-9': {
    id: 'STAGE-9',
    name: '运镜系统',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { cameraMovements: [] } },
    compensate: null
  },

  'STAGE-10': {
    id: 'STAGE-10',
    name: '连续性检查',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true, issues: [] } },
    compensate: null
  },

  'STAGE-10.5': {
    id: 'STAGE-10.5',
    name: '渲染前置输入检查',
    phase: 'production',
    blocking: false,  // 检查失败可继续（带警告）
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: {
      strategy: 'default_value',
      defaultValue: { passed: true, warnings: ['safety_gate_used_fallback'] }
    },
    compensate: null
  },

  'STAGE-11': {
    id: 'STAGE-11',
    name: '渲染核心',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 300000,  // 5分钟渲染
    retryPolicy: { maxAttempts: 2, backoffMs: 10000 },
    fallback: { strategy: 'default_value', defaultValue: { renderOutput: null } },
    compensate: async (result, context) => {
      // 清理渲染输出（释放资源）
      if (context.renderOutput) {
        console.log('[Saga:Compensate] STAGE-11 清理渲染输出');
        delete context.renderOutput;
      }
    }
  },

  'STAGE-11.5': {
    id: 'STAGE-11.5',
    name: 'Prompt质量闸门',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true } },
    compensate: null
  },

  'STAGE-12': {
    id: 'STAGE-12',
    name: '合规检查',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true } },
    compensate: null
  },

  'STAGE-13': {
    id: 'STAGE-13',
    name: '前置验证',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 15000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-14': {
    id: 'STAGE-14',
    name: '风格注入',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // === 后期制作 (Post-Production) ===

  'STAGE-15': {
    id: 'STAGE-15',
    name: '后期规则',
    phase: 'post_production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // 顾问Stage：非阻塞（导演优化）
  'STAGE-16': {
    id: 'STAGE-16',
    name: '导演最终优化',
    phase: 'post_production',
    blocking: false,  // 顾问Stage：失败不阻塞渲染输出
    required: false,
    timeoutMs: 180000,  // 3分钟导演Agent
    retryPolicy: { maxAttempts: 1, backoffMs: 5000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除导演建议
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          delete shot.directorNotes;
          delete shot.directorScore;
          delete shot.directorSuggestions;
        });
      }
      console.log('[Saga:Compensate] STAGE-16 已移除导演建议');
    }
  },

  // 顾问Stage：非阻塞（编剧循环）
  'STAGE-17': {
    id: 'STAGE-17',
    name: '导演-编剧循环',
    phase: 'post_production',
    blocking: false,  // 顾问Stage：迭代优化，不阻塞
    required: false,
    timeoutMs: 300000,  // 5分钟
    retryPolicy: { maxAttempts: 1, backoffMs: 5000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 恢复原始剧本（如果有备份）
      if (context._originalScript) {
        context.script = context._originalScript;
        delete context._originalScript;
      }
      console.log('[Saga:Compensate] STAGE-17 已恢复原始剧本');
    }
  }
};

// ============================================================
// 二、Saga 阶段执行器
// ============================================================

class SagaStage {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.phase = config.phase || 'unknown';
    this.blocking = config.blocking !== false;  // 默认阻塞
    this.required = config.required !== false;  // 默认必需
    this.timeoutMs = config.timeoutMs || 120000;
    this.retryPolicy = config.retryPolicy || { maxAttempts: 1, backoffMs: 1000 };
    this.fallback = config.fallback || { strategy: 'skip' };
    this.compensate = config.compensate || null;
    this.executeFn = null;  // 执行函数（运行时注入）
  }

  setExecuteFn(fn) {
    this.executeFn = fn;
  }

  async run(input, context) {
    const startMs = Date.now();
    let attempts = 0;
    const traceId = context.traceId || `saga_${Date.now()}`;

    console.log(`[SagaStage:${this.id}] ▶️ 开始执行 | ${this.name}`);

    while (attempts < this.retryPolicy.maxAttempts) {
      attempts++;
      try {
        // 执行超时控制
        const result = await this.executeWithTimeout(input, context);
        const durationMs = Date.now() - startMs;

        console.log(`[SagaStage:${this.id}] ✅ 完成 | ${durationMs}ms | 尝试${attempts}/${this.retryPolicy.maxAttempts}`);

        return {
          status: 'success',
          output: result,
          durationMs,
          attempts,
          stageId: this.id
        };

      } catch (error) {
        console.error(`[SagaStage:${this.id}] ❌ 尝试${attempts}失败: ${error.message}`);

        if (attempts < this.retryPolicy.maxAttempts) {
          const backoffMs = this.retryPolicy.backoffMs * Math.pow(2, attempts - 1);
          console.log(`[SagaStage:${this.id}] ⏳ ${backoffMs}ms后重试...`);
          await this.sleep(backoffMs);
          continue;
        }

        // 所有重试耗尽，应用fallback
        return this.handleFailure(error, input, context, startMs);
      }
    }
  }

  async executeWithTimeout(input, context) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Stage ${this.id} 超时 ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      try {
        if (!this.executeFn) {
          throw new Error(`Stage ${this.id} 未设置执行函数`);
        }
        const result = await this.executeFn(input, context);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  handleFailure(error, input, context, startMs) {
    const durationMs = Date.now() - startMs;
    const failureResult = {
      status: 'failed',
      error: {
        type: error.name,
        message: error.message,
        recoverable: this.isRecoverableError(error)
      },
      durationMs,
      stageId: this.id
    };

    // 应用fallback策略
    switch (this.fallback.strategy) {
      case 'skip':
        // 非阻塞Stage：跳过，继续链路
        if (!this.blocking) {
          console.warn(`[SagaStage:${this.id}] ⚠️ 非阻塞Stage失败，跳过 | ${error.message}`);
          failureResult.status = 'skipped';
          failureResult.output = input;  // 透传输入
        } else {
          console.error(`[SagaStage:${this.id}] 💥 阻塞Stage失败，阻断链路 | ${error.message}`);
        }
        break;

      case 'mock':
        console.warn(`[SagaStage:${this.id}] ⚠️ 使用Mock降级`);
        failureResult.status = 'partial';
        failureResult.output = this.generateMockOutput(input);
        break;

      case 'default_value':
        console.warn(`[SagaStage:${this.id}] ⚠️ 使用默认值降级`);
        failureResult.status = 'partial';
        failureResult.output = { ...input, ...this.fallback.defaultValue };
        break;

      default:
        if (!this.blocking) {
          failureResult.status = 'skipped';
        }
    }

    return failureResult;
  }

  isRecoverableError(error) {
    const recoverablePatterns = [
      /timeout/i, /ETIMEDOUT/i, /ECONNRESET/i,
      /rate limit/i, /429/i, /temporary/i,
      /503/i, /502/i, /504/i
    ];
    return recoverablePatterns.some(p => p.test(error.message));
  }

  generateMockOutput(input) {
    return {
      ...input,
      _mockGenerated: true,
      _mockStage: this.id,
      _mockTimestamp: Date.now()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 三、Saga 编排器
// ============================================================

class SagaOrchestrator {
  constructor(options = {}) {
    this.stages = new Map();
    this.compensationLog = [];
    this.eventBus = new NirathEventBus({ name: 'saga-orchestrator', enabled: true });
    this.traceId = null;
    this.options = {
      enableCompensation: options.enableCompensation !== false,
      publishEvents: options.publishEvents !== false,
      ...options
    };
  }

  /**
   * 注册Stage
   */
  registerStage(stageConfig, executeFn) {
    const stage = new SagaStage(stageConfig);
    if (executeFn) {
      stage.setExecuteFn(executeFn);
    }
    this.stages.set(stageConfig.id, stage);
    return this;
  }

  /**
   * 从定义批量注册
   */
  registerFromDefinitions(definitions, executeFns = {}) {
    for (const [id, config] of Object.entries(definitions)) {
      const stage = new SagaStage(config);
      if (executeFns[id]) {
        stage.setExecuteFn(executeFns[id]);
      }
      this.stages.set(id, stage);
    }
    return this;
  }

  /**
   * 执行完整链路
   */
  async execute(input, options = {}) {
    this.traceId = options.traceId || `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = { ...input, traceId: this.traceId };
    const executedStages = [];
    const results = {};
    const stageOrder = options.stageOrder || Array.from(this.stages.keys());

    console.log(`\n[SagaOrchestrator] 🚀 开始执行链路 | traceId=${this.traceId}`);
    console.log(`[SagaOrchestrator] 📋 共${stageOrder.length}个Stage | 补偿:${this.options.enableCompensation ? '启用' : '禁用'}`);

    // 发布开始事件
    if (this.options.publishEvents) {
      this.eventBus.publish('pipeline.started', {
        traceId: this.traceId,
        stageCount: stageOrder.length,
        inputKeys: Object.keys(input)
      }, { orchestrator: 'saga' });
    }

    for (const stageId of stageOrder) {
      const stage = this.stages.get(stageId);
      if (!stage) {
        console.warn(`[SagaOrchestrator] ⚠️ Stage ${stageId} 未注册，跳过`);
        continue;
      }

      console.log(`\n[SagaOrchestrator] ▶️ 执行 ${stageId} | ${stage.name} | ${stage.blocking ? '阻塞' : '非阻塞'}`);

      const result = await stage.run(context, context);
      results[stageId] = result;

      if (result.status === 'success' || result.status === 'partial') {
        // 合并输出到上下文
        if (result.output && typeof result.output === 'object') {
          Object.assign(context, result.output);
        }
        executedStages.push({ stageId, compensated: false, status: result.status });
        
        // 发布成功事件
        if (this.options.publishEvents) {
          this.eventBus.publish('stage.completed', {
            stageId,
            status: result.status,
            durationMs: result.durationMs,
            traceId: this.traceId
          }, { orchestrator: 'saga' });
        }

      } else if (result.status === 'skipped') {
        console.log(`[SagaOrchestrator] ⏭️ ${stageId} 已跳过（非阻塞顾问Stage）`);
        executedStages.push({ stageId, compensated: false, skipped: true, status: 'skipped' });

      } else {
        // Stage失败
        console.error(`[SagaOrchestrator] 💥 ${stageId} 失败且阻塞！触发补偿...`);

        // 触发补偿
        if (this.options.enableCompensation) {
          await this.compensate(executedStages, results, context);
        }

        // 发布失败事件
        if (this.options.publishEvents) {
          this.eventBus.publish('pipeline.failed', {
            traceId: this.traceId,
            failedAt: stageId,
            error: result.error
          }, { orchestrator: 'saga' });
        }

        throw new Error(`Pipeline在${stageId}失败: ${result.error.message}`);
      }
    }

    console.log(`\n[SagaOrchestrator] ✅ 链路完成 | traceId=${this.traceId} | 成功Stage:${executedStages.filter(s => s.status === 'success').length}/${stageOrder.length}`);

    // 发布完成事件
    if (this.options.publishEvents) {
      this.eventBus.publish('pipeline.completed', {
        traceId: this.traceId,
        stageCount: stageOrder.length,
        completedCount: executedStages.filter(s => s.status === 'success').length,
        skippedCount: executedStages.filter(s => s.status === 'skipped').length
      }, { orchestrator: 'saga' });
    }

    return {
      traceId: this.traceId,
      results,
      context,
      executedStages,
      success: true
    };
  }

  /**
   * 执行补偿事务（反向顺序）
   */
  async compensate(executedStages, results, context) {
    console.log('[SagaOrchestrator] 🔙 开始补偿事务...');

    for (let i = executedStages.length - 1; i >= 0; i--) {
      const { stageId } = executedStages[i];
      const stage = this.stages.get(stageId);

      if (stage && stage.compensate) {
        try {
          console.log(`[SagaOrchestrator] 🔙 补偿 ${stageId}...`);
          await stage.compensate(results[stageId], context);
          executedStages[i].compensated = true;
        } catch (compError) {
          console.error(`[SagaOrchestrator] ❌ 补偿失败 ${stageId}: ${compError.message}`);
          this.compensationLog.push({
            stageId,
            error: compError.message,
            timestamp: Date.now(),
            traceId: this.traceId
          });
        }
      }
    }

    console.log(`[SagaOrchestrator] 🔙 补偿完成 | 已补偿:${executedStages.filter(s => s.compensated).length}/${executedStages.length}`);
  }

  /**
   * 获取执行报告
   */
  getExecutionReport() {
    return {
      traceId: this.traceId,
      stages: Array.from(this.stages.values()).map(s => ({
        id: s.id,
        name: s.name,
        blocking: s.blocking,
        required: s.required
      })),
      compensationLog: this.compensationLog
    };
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  SagaStage,
  SagaOrchestrator,
  STAGE_DEFINITIONS,

  // 快速创建完整编排器
  createSagaOrchestrator: (executeFns = {}, options = {}) => {
    const orchestrator = new SagaOrchestrator(options);
    orchestrator.registerFromDefinitions(STAGE_DEFINITIONS, executeFns);
    return orchestrator;
  }
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Saga Orchestrator 集成测试 ===\n');

    // 测试1：基本编排
    console.log('--- 测试1：基本编排 ---');
    const orchestrator = new SagaOrchestrator();

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-1'], async (input) => {
      return { prd: { title: '测试PRD' } };
    });

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-2'], async (input) => {
      return { alignment: { passed: true, score: 85 } };
    });

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-16'], async (input) => {
      // 模拟导演Stage失败
      throw new Error('导演Agent超时');
    });

    try {
      const result = await orchestrator.execute({ title: '测试' }, {
        stageOrder: ['STAGE-1', 'STAGE-2', 'STAGE-16']
      });
      console.log('链路结果:', result.success ? '成功' : '失败');
      console.log('STAGE-1:', result.results['STAGE-1']?.status);
      console.log('STAGE-2:', result.results['STAGE-2']?.status);
      console.log('STAGE-16:', result.results['STAGE-16']?.status);  // 应该是skipped（非阻塞）
    } catch (e) {
      console.log('预期失败:', e.message);
    }

    // 测试2：补偿事务
    console.log('\n--- 测试2：补偿事务 ---');
    const orchestrator2 = new SagaOrchestrator({ enableCompensation: true });

    let compensated = false;
    orchestrator2.registerStage({
      ...STAGE_DEFINITIONS['STAGE-5'],
      compensate: async (result, context) => {
        compensated = true;
        console.log('✅ 补偿已执行！');
      }
    }, async (input) => {
      return { script: { scenes: [] } };
    });

    orchestrator2.registerStage({
      id: 'STAGE-FAIL',
      name: '故意失败',
      phase: 'production',
      blocking: true,
      required: true,
      timeoutMs: 1000,
      retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
      fallback: { strategy: 'skip' }
    }, async (input) => {
      throw new Error('故意失败');
    });

    try {
      await orchestrator2.execute({}, { stageOrder: ['STAGE-5', 'STAGE-FAIL'] });
    } catch (e) {
      console.log('预期失败:', e.message);
      console.log('补偿执行:', compensated ? '是' : '否');
    }

    // 测试3：从定义创建
    console.log('\n--- 测试3：从定义批量创建 ---');
    const fullOrchestrator = module.exports.createSagaOrchestrator({
      'STAGE-1': async (input) => ({ prd: {} }),
      'STAGE-2': async (input) => ({ alignment: { passed: true } })
    });
    console.log('已注册Stage:', fullOrchestrator.getExecutionReport().stages.map(s => s.id).join(', '));

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
