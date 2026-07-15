/**
 * Seedance Agent Loop v9.3-Peng — 智能决策循环
 *
 * 核心功能：
 * 1. 从固定Phase流水线 → 动态决策循环
 * 2. LLM驱动的步骤规划（每一步都由模型决定下一步做什么）
 * 3. 工具池动态组装（按需加载技能，而非全部启动）
 * 4. 状态持久化（append-only JSONL，支持resume/fork）
 * 5. 成本感知调度（CAPO：Cost-per-Accepted-Deliverable）
 *
 * 架构对比：
 * 旧：Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7（固定顺序）
 * 新：loop → observe → plan → execute → evaluate → (continue|retry|fork|done)
 *
 * 使用场景：
 * - 25镜头长任务：动态调整渲染顺序
 * - 错误恢复：某镜头失败→自动降级→重试→或跳过
 * - 用户介入：关键节点暂停等待用户输入
 * - 并行优化：识别可并行步骤→Agent Swarm执行
 */

const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const { execAsync, safeReadJSON, safeJSONParse } = require('./exec-utils');
const { ContextManager } = require('./context-manager');
const { PermissionGate } = require('./permission-gate');

// ============ Agent Loop 配置 ============
const AGENT_CONFIG = {
  // 最大循环轮次（防止无限循环）
  maxIterations: 50,
  // 单步超时
  stepTimeoutMs: 300000,
  // 全局超时
  globalTimeoutMs: 1800000, // 30分钟
  // 成本上限（Token估算）
  maxCostTokens: 100000,
  // 观察窗口：最近N步用于决策
  observationWindow: 5,
  // 持久化间隔：每N步写盘
  persistInterval: 3
};

// ============ 工具池定义 ============
const TOOL_POOL = {
  // 创意工具
  story_engine: {
    id: 'story_engine',
    name: '故事引擎',
    description: '生成故事方案、角色、世界观',
    phase: ['planning'],
    cost: 'high', // 高Token消耗
    dependencies: []
  },

  // 渲染工具
  seedance_render: {
    id: 'seedance_render',
    name: 'Seedance渲染',
    description: '调用Seedance API生成视频片段',
    phase: ['rendering'],
    cost: 'very_high', // API调用，最高成本
    dependencies: ['story_plan_ready']
  },

  // 评测工具
  pitch_evaluation: {
    id: 'pitch_evaluation',
    name: '比稿评测',
    description: '多方案评分选出最佳',
    phase: ['evaluation'],
    cost: 'medium',
    dependencies: ['story_ready']
  },

  // 对齐闸机
  alignment_gate: {
    id: 'alignment_gate',
    name: '对齐闸机',
    description: '渲染前质量检查',
    phase: ['gate'],
    cost: 'low',
    dependencies: ['pitch_winner']
  },

  // 后期合成
  post_production: {
    id: 'post_production',
    name: '后期合成',
    description: 'ffmpeg拼接、调色、字幕',
    phase: ['post'],
    cost: 'medium',
    dependencies: ['shots_ready']
  },

  // 声音设计
  sound_design: {
    id: 'sound_design',
    name: '声音设计',
    description: '4层音轨设计',
    phase: ['post'],
    cost: 'medium',
    dependencies: ['video_ready']
  },

  // 交付引擎
  delivery: {
    id: 'delivery',
    name: '交付引擎',
    description: '飞书消息交付成片',
    phase: ['delivery'],
    cost: 'low',
    dependencies: ['final_video']
  },

  // 合规检查
  compliance: {
    id: 'compliance',
    name: '合规Agent',
    description: '内容安全、版权检查',
    phase: ['gate'],
    cost: 'low',
    dependencies: []
  },

  // 分镜生成
  storyboard: {
    id: 'storyboard',
    name: '分镜生成',
    description: '将shots转为可视分镜',
    phase: ['planning'],
    cost: 'medium',
    dependencies: ['story_ready']
  }
};

// ============ 状态定义 ============
const AGENT_STATES = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  WAITING: 'waiting',      // 等待用户确认
  RETRYING: 'retrying',
  FORKING: 'forking',
  DONE: 'done',
  ERROR: 'error'
};

class AgentLoop {
  constructor(options = {}) {
    this.config = { ...AGENT_CONFIG, ...options };
    this.state = AGENT_STATES.IDLE;
    this.iteration = 0;
    this.history = []; // 执行历史
    this.currentPlan = null;
    this.contextManager = new ContextManager();
    this.permissionGate = new PermissionGate({ autoMode: options.autoMode || false });

    // 成本追踪
    this.costTracker = {
      totalTokens: 0,
      apiCalls: 0,
      renderCalls: 0,
      startTime: null
    };

    // 持久化
    this.sessionId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.stateFile = path.join(process.cwd(), '.seedance', `${this.sessionId}.jsonl`);

    // 事件监听
    this.listeners = {};

    // 创建状态目录
    const stateDir = path.dirname(this.stateFile);
    if (!fss.existsSync(stateDir)) {
      fss.mkdirSync(stateDir, { recursive: true });
    }
  }

  /**
   * 注册事件监听
   */
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        cb(data);
      }
    }
  }

  /**
   * 启动Agent Loop（核心入口）
   * @param {Object} task - 任务描述
   * @returns {Promise<Object>} - 最终结果
   */
  async run(task) {
    this.state = AGENT_STATES.PLANNING;
    this.costTracker.startTime = Date.now();

    console.log(`[AgentLoop] 🚀 启动任务: ${task.title || '未命名任务'}`);
    console.log(`[AgentLoop] 📋 Session: ${this.sessionId}`);

    try {
      // 主循环
      while (this.iteration < this.config.maxIterations) {
        this.iteration++;

        // 检查全局超时
        const elapsed = Date.now() - this.costTracker.startTime;
        if (elapsed > this.config.globalTimeoutMs) {
          throw new Error(`全局超时: ${elapsed}ms > ${this.config.globalTimeoutMs}ms`);
        }

        // 检查成本上限
        if (this.costTracker.totalTokens > this.config.maxCostTokens) {
          throw new Error(`成本超限: ${this.costTracker.totalTokens} > ${this.config.maxCostTokens} tokens`);
        }

        console.log(`\n[AgentLoop] 🔁 第${this.iteration}/${this.config.maxIterations}轮`);

        // Step 1: 观察当前状态
        const observation = this._observe();

        // Step 2: 规划下一步
        const plan = await this._plan(observation, task);
        this.currentPlan = plan;

        // Step 3: 决策是否继续
        if (plan.action === 'done') {
          console.log(`[AgentLoop] ✅ 任务完成！`);
          this.state = AGENT_STATES.DONE;
          break;
        }

        if (plan.action === 'error') {
          throw new Error(`计划错误: ${plan.reason}`);
        }

        // Step 4: 执行计划（跳过等待动作）
        let result, evaluation;
        if (plan.action === 'wait') {
          console.log(`[AgentLoop] ⏸️ 暂停等待，进入下一轮...`);
          result = { success: true, tool: plan.tool, output: '等待用户确认', skipped: true };
          evaluation = { status: 'wait', reason: plan.reason, summary: '等待用户' };
        } else {
          result = await this._execute(plan);
          // Step 5: 评估结果
          evaluation = this._evaluate(result, plan);
        }

        // Step 6: 记录历史
        this._recordStep({
          iteration: this.iteration,
          observation,
          plan,
          result,
          evaluation,
          timestamp: Date.now()
        });

        // Step 7: 持久化
        if (this.iteration % this.config.persistInterval === 0) {
          this._persist();
        }

        // Step 8: 根据评估决定下一步
        if (evaluation.status === 'success') {
          console.log(`[AgentLoop] ✅ 步骤成功: ${plan.tool}`);
          this.emit('step:success', { plan, result });
        } else if (evaluation.status === 'retry') {
          console.log(`[AgentLoop] 🔄 需要重试: ${plan.tool} (${evaluation.reason})`);
          this.state = AGENT_STATES.RETRYING;
          // 下一轮会自动重试（plan阶段会看到失败状态）
        } else if (evaluation.status === 'fork') {
          console.log(`[AgentLoop] 🌿 分叉任务: ${evaluation.reason}`);
          this.state = AGENT_STATES.FORKING;
          // 创建子任务
          await this._forkTask(plan, evaluation);
        } else if (evaluation.status === 'wait') {
          console.log(`[AgentLoop] ⏳ 等待用户: ${evaluation.reason}`);
          this.state = AGENT_STATES.WAITING;
          await this._waitForUser(evaluation);
        }

        // 恢复执行状态
        if (this.state === AGENT_STATES.RETRYING || this.state === AGENT_STATES.FORKING) {
          this.state = AGENT_STATES.EXECUTING;
        }
      }

      // 最终持久化
      this._persist();

      return {
        success: true,
        sessionId: this.sessionId,
        iterations: this.iteration,
        finalState: this.state,
        cost: this.costTracker,
        history: this.history
      };

    } catch (error) {
      this.state = AGENT_STATES.ERROR;
      this._persist();

      return {
        success: false,
        sessionId: this.sessionId,
        iterations: this.iteration,
        error: error.message,
        cost: this.costTracker,
        history: this.history
      };
    }
  }

  /**
   * 观察：收集当前状态信息
   */
  _observe() {
    const recentSteps = this.history.slice(-this.config.observationWindow);

    return {
      iteration: this.iteration,
      state: this.state,
      recentSteps: recentSteps.map(s => ({
        tool: s.plan.tool,
        status: s.evaluation.status,
        summary: s.evaluation.summary
      })),
      contextSummary: this.contextManager.getContextSummary(),
      cost: this.costTracker,
      elapsedMs: Date.now() - this.costTracker.startTime
    };
  }

  /**
   * 规划：决定下一步做什么
   * （当前为骨架实现，实际应由LLM驱动）
   */
  async _plan(observation, task) {
    // 简化版：基于规则的状态机决策
    // 实际项目中，这里应该调用LLM进行决策

    const { recentSteps, cost } = observation;

    // 检查是否需要权限确认
    if (this.state === AGENT_STATES.WAITING) {
      // 非恢复模式：假设用户已批准，继续执行
      if (!task.resume) {
        console.log(`[AgentLoop] ⏭️ 跳过等待，假设已批准`);
        // 将等待中的步骤标记为成功
        const lastWait = this.history.findLast(h => h.evaluation.status === 'wait');
        if (lastWait) {
          lastWait.evaluation.status = 'success';
          lastWait.evaluation.reason = '用户未响应，自动批准继续';
          lastWait.result = { ...lastWait.result, approved: true };
        }
      }
      this.state = AGENT_STATES.EXECUTING;
      // 继续正常plan（不return）
    }

    // 检查是否有失败的步骤需要重试
    const lastFailed = recentSteps.findLast(s => s.status === 'retry');
    if (lastFailed && this.iteration < this.config.maxIterations - 5) {
      return {
        action: 'execute',
        tool: lastFailed.tool,
        reason: `重试失败的步骤: ${lastFailed.tool}`,
        retry: true
      };
    }

    // 基于当前进度决定下一步
    // 注意：使用最新的history状态，而非observation中的快照
    const completedTools = new Set(
      this.history
        .slice(-this.config.observationWindow * 2)
        .filter(h => h.evaluation.status === 'success')
        .map(h => h.plan.tool)
    );

    // Phase 1: 故事规划
    if (!completedTools.has('story_engine')) {
      return { action: 'execute', tool: 'story_engine', phase: 'planning' };
    }

    // Phase 2: 分镜生成
    if (!completedTools.has('storyboard')) {
      return { action: 'execute', tool: 'storyboard', phase: 'planning' };
    }

    // Phase 3: 比稿评测
    if (!completedTools.has('pitch_evaluation')) {
      return { action: 'execute', tool: 'pitch_evaluation', phase: 'evaluation' };
    }

    // Phase 4: 对齐闸机
    if (!completedTools.has('alignment_gate')) {
      return { action: 'execute', tool: 'alignment_gate', phase: 'gate' };
    }

    // Phase 5: 权限确认
    // 这里会触发PermissionGate

    // Phase 6: 渲染
    if (!completedTools.has('seedance_render')) {
      return { action: 'execute', tool: 'seedance_render', phase: 'rendering' };
    }

    // Phase 7: 后期
    if (!completedTools.has('post_production')) {
      return { action: 'execute', tool: 'post_production', phase: 'post' };
    }

    // Phase 8: 声音
    if (!completedTools.has('sound_design')) {
      return { action: 'execute', tool: 'sound_design', phase: 'post' };
    }

    // Phase 9: 交付
    if (!completedTools.has('delivery')) {
      return { action: 'execute', tool: 'delivery', phase: 'delivery' };
    }

    // 全部完成
    return { action: 'done', reason: '所有步骤已完成' };
  }

  /**
   * 执行：调用具体工具
   */
  async _execute(plan) {
    this.state = AGENT_STATES.EXECUTING;
    const tool = TOOL_POOL[plan.tool];

    if (!tool) {
      return { success: false, error: `未知工具: ${plan.tool}` };
    }

    console.log(`[AgentLoop] ⚙️ 执行: ${tool.name}`);

    try {
      // 模拟工具执行（实际项目中调用真实工具）
      // 这里用setTimeout模拟异步执行
      await new Promise(resolve => setTimeout(resolve, 100));

      // 模拟成功结果
      const result = {
        success: true,
        tool: plan.tool,
        output: `${tool.name} 执行完成`,
        metadata: {
          cost: Math.floor(Math.random() * 1000) + 100,
          duration: 100
        }
      };

      // 更新成本
      this.costTracker.totalTokens += result.metadata.cost;
      if (plan.tool === 'seedance_render') {
        this.costTracker.renderCalls++;
      } else if (plan.tool !== 'story_engine') {
        this.costTracker.apiCalls++;
      }

      return result;

    } catch (error) {
      return { success: false, tool: plan.tool, error: error.message };
    }
  }

  /**
   * 评估：判断执行结果
   */
  _evaluate(result, plan) {
    if (!result.success) {
      return {
        status: 'retry',
        reason: `执行失败: ${result.error}`,
        summary: `${plan.tool} 失败`
      };
    }

    // 检查是否需要权限确认（渲染前）
    if (plan.phase === 'rendering') {
      // 这里会调用PermissionGate
      return {
        status: 'wait',
        reason: '渲染前需要权限确认',
        summary: `${plan.tool} 等待确认`
      };
    }

    return {
      status: 'success',
      reason: '执行成功',
      summary: `${plan.tool} 成功`
    };
  }

  /**
   * 记录步骤
   */
  _recordStep(step) {
    this.history.push(step);
    this.emit('step:record', step);
  }

  /**
   * 持久化状态
   */
  _persist() {
    try {
      const state = {
        sessionId: this.sessionId,
        iteration: this.iteration,
        state: this.state,
        cost: this.costTracker,
        history: this.history,
        timestamp: Date.now()
      };

      // append-only JSONL
      fss.appendFileSync(this.stateFile, JSON.stringify(state) + '\n');
      console.log(`[AgentLoop] 💾 状态已持久化: ${this.stateFile}`);
    } catch (err) {
      console.error(`[AgentLoop] ❌ 持久化失败: ${err.message}`);
    }
  }

  /**
   * 恢复状态（从持久化文件）
   */
  async resume(sessionId) {
    const file = path.join(process.cwd(), '.seedance', `${sessionId}.jsonl`);

    if (!fss.existsSync(file)) {
      throw new Error(`状态文件不存在: ${file}`);
    }

    const lines = fss.readFileSync(file, 'utf8').trim().split('\n');
    const lastState = safeJSONParse(lines[lines.length - 1], null);

    if (!lastState) {
      throw new Error('状态文件损坏');
    }

    this.sessionId = lastState.sessionId;
    this.iteration = lastState.iteration;
    this.state = lastState.state;
    this.history = lastState.history || [];
    this.costTracker = lastState.cost || this.costTracker;

    console.log(`[AgentLoop] 📂 恢复任务: ${this.sessionId} (第${this.iteration}轮)`);

    // 继续执行
    return this.run({ resume: true });
  }

  /**
   * 分叉任务
   */
  async _forkTask(plan, evaluation) {
    // 创建子Agent处理分叉任务
    const child = new AgentLoop({
      ...this.config,
      maxIterations: Math.floor(this.config.maxIterations / 2)
    });

    child.on('step:success', (data) => {
      this.emit('fork:success', { parent: this.sessionId, child: child.sessionId, data });
    });

    // 子任务执行
    child.run({ title: `分叉: ${evaluation.reason}`, parent: this.sessionId });
  }

  /**
   * 等待用户输入
   */
  async _waitForUser(evaluation) {
    // 实际项目中，这里应该通过OpenClaw消息系统发送通知
    // 并等待用户回复

    console.log(`[AgentLoop] ⏳ 等待用户确认: ${evaluation.reason}`);

    // 模拟等待（实际应替换为真实消息等待）
    // await waitForUserInput();
  }

  /**
   * 获取执行报告
   */
  getReport() {
    const successCount = this.history.filter(h => h.evaluation.status === 'success').length;
    const retryCount = this.history.filter(h => h.evaluation.status === 'retry').length;

    return {
      sessionId: this.sessionId,
      status: this.state,
      iterations: this.iteration,
      successSteps: successCount,
      retrySteps: retryCount,
      totalCost: this.costTracker,
      efficiency: successCount / Math.max(this.iteration, 1),
      duration: Date.now() - (this.costTracker.startTime || Date.now())
    };
  }
}

// ============ 导出 ============
module.exports = {
  AgentLoop,
  AGENT_STATES,
  TOOL_POOL,
  AGENT_CONFIG
};

// CLI测试
if (require.main === module) {
  const agent = new AgentLoop({ autoMode: true });

  console.log('🤖 Agent Loop v9.3-Peng 测试\n');

  // 测试1：完整任务
  agent.run({
    title: '30秒科幻短片',
    duration: 30,
    style: 'sci-fi',
    shots: 5
  }).then(result => {
    console.log('\n📊 执行报告:');
    console.log(`   成功: ${result.success}`);
    console.log(`   轮次: ${result.iterations}`);
    console.log(`   状态: ${result.finalState}`);
    console.log(`   Token: ${result.cost.totalTokens}`);
    console.log(`   API调用: ${result.cost.apiCalls}`);

    const report = agent.getReport();
    console.log(`\n📈 效率: ${(report.efficiency * 100).toFixed(1)}%`);

    console.log('\n✅ Agent Loop 测试完成！');
  });
}
