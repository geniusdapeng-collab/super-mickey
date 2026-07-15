/**
 * Seedance State Machine v9.4-Peng — 任务状态管理 + 持久化
 *
 * 核心功能：
 * 1. 状态机：定义任务生命周期状态 + 状态转换规则
 * 2. 持久化：append-only JSONL，支持resume/fork/rewind
 * 3. 检查点：每N步自动保存，手动save/load
 * 4. 分叉：从任意检查点创建分支任务
 * 5. 回退：回到上一个检查点
 * 6. 事件驱动：状态转换触发事件回调
 *
 * 状态定义（完整的任务生命周期）：
 *   idle → planning → [review] → rendering → [pause] → post-production → sound → delivering → done
 *              ↓          ↓          ↓            ↓
 *           error → retry → abort
 *
 * 旧痛点：任务中断后无法resume，必须从头开始
 * 新方案：任意时刻可save，任意时刻可resume，任意检查点可fork
 */

const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const { safeJSONParse } = require('./exec-utils');

// ============ 状态定义 ============
const STATES = {
  IDLE: 'idle',              // 初始状态
  PLANNING: 'planning',      // 故事规划
  REVIEW: 'review',          // 等待用户确认（Human-in-the-loop）
  RENDERING: 'rendering',    // 渲染中
  PAUSED: 'paused',          // 暂停（用户手动）
  POST_PRODUCTION: 'post',   // 后期合成
  SOUND: 'sound',            // 声音设计
  DELIVERING: 'delivering',  // 交付中
  DONE: 'done',              // 完成
  ERROR: 'error',            // 错误
  RETRY: 'retry',            // 重试中
  ABORTED: 'aborted'         // 已中止
};

// ============ 状态转换规则（有效转换） ============
const VALID_TRANSITIONS = {
  [STATES.IDLE]: [STATES.PLANNING, STATES.ABORTED],
  [STATES.PLANNING]: [STATES.REVIEW, STATES.RENDERING, STATES.ERROR, STATES.ABORTED],
  [STATES.REVIEW]: [STATES.RENDERING, STATES.PLANNING, STATES.ABORTED],
  [STATES.RENDERING]: [STATES.POST_PRODUCTION, STATES.PAUSED, STATES.RETRY, STATES.ERROR, STATES.ABORTED],
  [STATES.PAUSED]: [STATES.RENDERING, STATES.ABORTED],
  [STATES.POST_PRODUCTION]: [STATES.SOUND, STATES.PAUSED, STATES.RETRY, STATES.ERROR, STATES.ABORTED],
  [STATES.SOUND]: [STATES.DELIVERING, STATES.PAUSED, STATES.ERROR, STATES.ABORTED],
  [STATES.DELIVERING]: [STATES.DONE, STATES.ERROR, STATES.ABORTED],
  [STATES.DONE]: [STATES.IDLE], // 可以重新开始
  [STATES.ERROR]: [STATES.RETRY, STATES.ABORTED],
  [STATES.RETRY]: [STATES.RENDERING, STATES.POST_PRODUCTION, STATES.ERROR, STATES.ABORTED],
  [STATES.ABORTED]: [STATES.IDLE] // 可以重新开始
};

// ============ 检查点配置 ============
const CHECKPOINT_CONFIG = {
  autoSaveInterval: 5,     // 每5步自动保存
  maxCheckpoints: 20,      // 最多保留20个检查点
  compressAfter: 10        // 超过10个时压缩旧检查点
};

class StateMachine {
  constructor(options = {}) {
    this.taskId = options.taskId || `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.taskName = options.taskName || '未命名任务';
    this.state = STATES.IDLE;
    this.step = 0;
    this.data = {}; // 任务数据（各阶段产出）
    this.checkpoints = []; // 检查点历史
    this.transitions = []; // 状态转换历史
    this.listeners = {}; // 事件监听

    // 持久化
    this.workspace = options.workspace || path.join(require('os').homedir(), '.openclaw/workspace');
    this.stateDir = path.join(this.workspace, '.seedance', 'states');
    this.stateFile = path.join(this.stateDir, `${this.taskId}.jsonl`);

    // 配置
    this.config = { ...CHECKPOINT_CONFIG, ...options };

    // 创建目录
    if (!fss.existsSync(this.stateDir)) {
      fss.mkdirSync(this.stateDir, { recursive: true });
    }

    // 自动保存计数
    this._autoSaveCounter = 0;
  }

  /**
   * 注册状态转换监听
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
   * 状态转换（核心方法）
   * @param {string} newState - 目标状态
   * @param {Object} context - 转换上下文（可选）
   */
  transition(newState, context = {}) {
    const oldState = this.state;

    // 验证转换是否有效
    const validTargets = VALID_TRANSITIONS[oldState] || [];
    if (!validTargets.includes(newState)) {
      throw new Error(
        `无效状态转换: ${oldState} → ${newState}\n` +
        `允许: ${validTargets.join(', ') || '无'}`
      );
    }

    // 执行转换
    this.state = newState;
    this.step++;

    // 记录转换
    const transition = {
      from: oldState,
      to: newState,
      step: this.step,
      timestamp: new Date().toISOString(),
      context
    };
    this.transitions.push(transition);

    // 自动保存检查点
    this._autoSaveCounter++;
    if (this._autoSaveCounter >= this.config.autoSaveInterval) {
      this.saveCheckpoint('auto');
      this._autoSaveCounter = 0;
    }

    // 触发事件
    this.emit('transition', transition);
    this.emit(`enter:${newState}`, { from: oldState, context });
    this.emit(`leave:${oldState}`, { to: newState, context });

    console.log(`[StateMachine] 🔄 ${oldState} → ${newState} (step ${this.step})`);

    return transition;
  }

  /**
   * 设置任务数据
   */
  setData(key, value) {
    this.data[key] = value;
  }

  /**
   * 获取任务数据
   */
  getData(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  /**
   * 获取全部数据
   */
  getAllData() {
    return { ...this.data };
  }

  /**
   * 手动保存检查点
   */
  saveCheckpoint(label = 'manual') {
    const checkpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      taskId: this.taskId,
      label,
      state: this.state,
      step: this.step,
      data: { ...this.data },
      transitions: [...this.transitions],
      timestamp: new Date().toISOString()
    };

    this.checkpoints.push(checkpoint);

    // 限制检查点数量
    if (this.checkpoints.length > this.config.maxCheckpoints) {
      // 保留最新的，压缩旧的
      const toCompress = this.checkpoints.splice(0, this.checkpoints.length - this.config.maxCheckpoints);
      console.log(`[StateMachine] 🗜️ 压缩${toCompress.length}个旧检查点`);
    }

    // 持久化
    this._persist();

    console.log(`[StateMachine] 💾 检查点已保存: ${checkpoint.id} (${label})`);

    return checkpoint;
  }

  /**
   * 加载检查点（resume/fork）
   */
  loadCheckpoint(checkpointId) {
    const cp = this.checkpoints.find(c => c.id === checkpointId);
    if (!cp) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    this.state = cp.state;
    this.step = cp.step;
    this.data = { ...cp.data };
    this.transitions = [...cp.transitions];

    console.log(`[StateMachine] 📂 加载检查点: ${checkpointId} → ${this.state} (step ${this.step})`);

    this.emit('load', cp);

    return cp;
  }

  /**
   * 从检查点分叉（创建新任务分支）
   */
  fork(checkpointId, newTaskName) {
    const cp = this.checkpoints.find(c => c.id === checkpointId);
    if (!cp) {
      throw new Error(`检查点不存在: ${checkpointId}`);
    }

    // 创建新状态机
    const forked = new StateMachine({
      taskName: newTaskName || `${this.taskName} (fork)`,
      workspace: this.workspace
    });

    // 复制检查点数据
    forked.state = cp.state;
    forked.step = cp.step;
    forked.data = { ...cp.data, forkedFrom: this.taskId, forkCheckpoint: checkpointId };
    forked.transitions = [...cp.transitions, {
      from: cp.state,
      to: cp.state,
      step: cp.step + 1,
      timestamp: new Date().toISOString(),
      context: { action: 'fork', parent: this.taskId }
    }];

    forked.saveCheckpoint('fork');

    console.log(`[StateMachine] 🌿 分叉任务: ${forked.taskId} 从 ${checkpointId}`);

    this.emit('fork', { parent: this.taskId, child: forked.taskId, checkpoint: checkpointId });

    return forked;
  }

  /**
   * 回退到上一个检查点
   */
  rewind() {
    if (this.checkpoints.length < 2) {
      throw new Error('没有可回退的检查点');
    }

    const previous = this.checkpoints[this.checkpoints.length - 2];
    return this.loadCheckpoint(previous.id);
  }

  /**
   * 获取状态报告
   */
  getReport() {
    return {
      taskId: this.taskId,
      taskName: this.taskName,
      state: this.state,
      step: this.step,
      checkpoints: this.checkpoints.length,
      transitions: this.transitions.length,
      dataKeys: Object.keys(this.data),
      duration: this.transitions.length > 0
        ? new Date() - new Date(this.transitions[0].timestamp)
        : 0
    };
  }

  /**
   * 获取完整状态（用于持久化）
   */
  getState() {
    return {
      taskId: this.taskId,
      taskName: this.taskName,
      state: this.state,
      step: this.step,
      data: this.data,
      checkpoints: this.checkpoints,
      transitions: this.transitions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 设置完整状态（用于恢复）
   */
  setState(state) {
    this.taskId = state.taskId || this.taskId;
    this.taskName = state.taskName || this.taskName;
    this.state = state.state || STATES.IDLE;
    this.step = state.step || 0;
    this.data = state.data || {};
    this.checkpoints = state.checkpoints || [];
    this.transitions = state.transitions || [];
  }

  /**
   * 从持久化文件恢复
   */
  static load(taskId, workspace) {
    const stateDir = path.join(workspace || path.join(require('os').homedir(), '.openclaw/workspace'), '.seedance', 'states');
    const stateFile = path.join(stateDir, `${taskId}.jsonl`);

    if (!fss.existsSync(stateFile)) {
      throw new Error(`状态文件不存在: ${stateFile}`);
    }

    const lines = fss.readFileSync(stateFile, 'utf8').trim().split('\n');
    const lastState = safeJSONParse(lines[lines.length - 1], null);

    if (!lastState) {
      throw new Error('状态文件损坏');
    }

    const sm = new StateMachine({
      taskId: lastState.taskId,
      taskName: lastState.taskName,
      workspace
    });
    sm.setState(lastState);

    console.log(`[StateMachine] 📂 恢复任务: ${taskId} → ${sm.state} (step ${sm.step})`);

    return sm;
  }

  /**
   * 列出所有持久化的任务
   */
  static listSavedTasks(workspace) {
    const stateDir = path.join(workspace || path.join(require('os').homedir(), '.openclaw/workspace'), '.seedance', 'states');

    if (!fss.existsSync(stateDir)) {
      return [];
    }

    const files = fss.readdirSync(stateDir).filter(f => f.endsWith('.jsonl'));

    return files.map(f => {
      const taskId = f.replace('.jsonl', '');
      try {
        const lines = fss.readFileSync(path.join(stateDir, f), 'utf8').trim().split('\n');
        const lastState = safeJSONParse(lines[lines.length - 1], {});
        return {
          taskId,
          taskName: lastState.taskName || '未知',
          state: lastState.state || 'unknown',
          step: lastState.step || 0,
          lastUpdate: lastState.timestamp || 'unknown'
        };
      } catch {
        return { taskId, taskName: '损坏', state: 'error', step: 0 };
      }
    });
  }

  // ============ 内部方法 ============

  /**
   * 持久化到文件
   */
  _persist() {
    try {
      const state = this.getState();
      fss.appendFileSync(this.stateFile, JSON.stringify(state) + '\n');
    } catch (err) {
      console.error(`[StateMachine] ❌ 持久化失败: ${err.message}`);
    }
  }
}

// ============ 快捷方法 ============

/**
 * 创建并启动任务（快捷方法）
 */
async function createTask(taskName, options = {}) {
  const sm = new StateMachine({ taskName, ...options });
  sm.transition(STATES.PLANNING);
  return sm;
}

// ============ 导出 ============
module.exports = {
  StateMachine,
  STATES,
  VALID_TRANSITIONS,
  createTask
};

// CLI测试
if (require.main === module) {
  (async () => {
    console.log('📊 State Machine v9.4-Peng 测试\n');

    // 测试1：创建任务
    const sm = new StateMachine({ taskName: '赛博朋克猫短片' });
    console.log(`✅ 创建任务: ${sm.taskId}`);

    // 测试2：状态转换
    sm.transition(STATES.PLANNING, { plan: '初步方案' });
    sm.setData('title', '赛博朋克猫');
    sm.setData('duration', 30);

    sm.transition(STATES.RENDERING, { shots: 5 });
    sm.setData('renderProgress', 0.5);

    sm.transition(STATES.POST_PRODUCTION);
    sm.setData('ffmpegCmd', 'concat + LUT');

    sm.transition(STATES.SOUND);  // post → sound
    sm.setData('audioLayers', 4);

    sm.transition(STATES.DELIVERING);  // sound → delivering
    sm.transition(STATES.DONE);

    // 测试3：检查点
    const cp = sm.saveCheckpoint('test');
    console.log(`\n💾 检查点: ${cp.id}`);

    // 测试4：分叉
    const forked = sm.fork(cp.id, '赛博朋克猫 v2');
    console.log(`🌿 分叉任务: ${forked.taskId}`);

    // 测试5：报告
    const report = sm.getReport();
    console.log(`\n📊 报告:`);
    console.log(`   任务: ${report.taskName}`);
    console.log(`   状态: ${report.state}`);
    console.log(`   步骤: ${report.step}`);
    console.log(`   检查点: ${report.checkpoints}`);
    console.log(`   转换: ${report.transitions}`);

    // 测试6：持久化列表
    const tasks = StateMachine.listSavedTasks();
    console.log(`\n📂 已保存任务: ${tasks.length}`);

    console.log('\n✅ State Machine 测试完成！');
  })();
}
