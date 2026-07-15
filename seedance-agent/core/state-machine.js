/**
 * State Machine — 状态管理引擎 (v9.2-Peng)
 *
 * 基于 Claude Code 的追加式持久化设计：
 * - 追加式状态存储（永不修改已有记录）
 * - 支持 resume（恢复会话）
 * - 支持 fork（分叉创建新版本）
 * - 支持 rewind（回退到任意历史点）
 * - 读取时链修补（read-time chain patching）
 *
 * 核心原则：原始状态永不修改，所有变更作为追加事件
 */

import fs from 'fs';
import path from 'path';

// ============ 状态机主类 ============
export class StateMachine {
  constructor(projectId, config = {}) {
    this.projectId = projectId;
    this.projectDir = path.join(process.cwd(), 'projects', projectId);
    this.statesDir = path.join(this.projectDir, '.states');
    this.transcriptPath = path.join(this.projectDir, 'transcript.jsonl');

    // 配置
    this.maxSnapshots = config.maxSnapshots || 50;
    this.autoSaveInterval = config.autoSaveInterval || 60000; // 1分钟

    // 运行时状态
    this.currentState = null;
    this.transcript = [];
    this.snapshots = [];
    this.forks = [];

    this.ensureDirectories();
    this.loadTranscript();
  }

  ensureDirectories() {
    [this.statesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // ============ 状态初始化 ============
  init(initialState = {}) {
    // 导演思维字段初始化
    const directorMindset = initialState.directorStatement || null;
    
    // 风格配方字段初始化（v7.0-Peng-Style）
    const styleRecipe = initialState.styleRecipe || null;
    const styleDNA = initialState.styleDNA || null;
    const styleChromosome = initialState.styleChromosome || null;
    const styleFootprint = initialState.styleFootprint || [];
    const styleSRS = initialState.styleSRS || null;
    const tensionCurve = initialState.tensionCurve || [];

    const state = {
      uuid: this.generateUUID(),
      parentUuid: null,
      timestamp: new Date().toISOString(),
      turn: 0,
      directorStatement: directorMindset,
      tensionCurve: tensionCurve,
      currentShotIndex: 0,
      qualityScores: null,
      abPending: null,
      styleRecipe: styleRecipe,
      styleDNA: styleDNA,
      styleChromosome: styleChromosome,
      styleFootprint: styleFootprint,
      styleSRS: styleSRS,
      sceneContinuity: 'continuous',
      ...initialState
    };

    this.currentState = state;
    this.appendEvent('init', state);
    this.saveSnapshot(state);

    return state;
  }

  // ============ 状态转移 ============
  transition(change, metadata = {}) {
    if (!this.currentState) {
      throw new Error('状态机未初始化');
    }

    const newState = {
      ...this.currentState,
      uuid: this.generateUUID(),
      parentUuid: this.currentState.uuid,
      timestamp: new Date().toISOString(),
      turn: this.currentState.turn + 1,
      ...change
    };

    // 记录状态转移事件（追加式）
    const event = {
      type: 'transition',
      fromUuid: this.currentState.uuid,
      toUuid: newState.uuid,
      change: Object.keys(change),
      metadata,
      timestamp: new Date().toISOString()
    };

    this.appendEvent('transition', event);
    this.currentState = newState;
    this.saveSnapshot(newState);

    return newState;
  }

  // ============ Resume（恢复会话） ============
  resume(targetUuid = null) {
    // 加载完整历史
    const history = this.loadFullHistory();

    if (!targetUuid) {
      // 恢复到最新状态
      targetUuid = history[history.length - 1]?.uuid;
    }

    // 重建状态链
    const stateChain = this.rebuildChain(history, targetUuid);

    if (stateChain.length === 0) {
      throw new Error(`找不到状态: ${targetUuid}`);
    }

    this.currentState = stateChain[stateChain.length - 1];
    this.transcript = history;

    this.appendEvent('resume', {
      targetUuid,
      chainLength: stateChain.length,
      timestamp: new Date().toISOString()
    });

    return this.currentState;
  }

  // ============ Fork（分叉） ============
  fork(forkName, stateOverride = {}) {
    if (!this.currentState) {
      throw new Error('状态机未初始化');
    }

    const forkState = {
      ...this.currentState,
      uuid: this.generateUUID(),
      parentUuid: this.currentState.uuid,
      forkName,
      forkTimestamp: new Date().toISOString(),
      ...stateOverride
    };

    // 记录分叉事件
    this.appendEvent('fork', {
      fromUuid: this.currentState.uuid,
      toUuid: forkState.uuid,
      forkName,
      timestamp: new Date().toISOString()
    });

    // 保存分叉状态
    const forkPath = path.join(this.statesDir, `fork_${forkName}_${forkState.uuid}.json`);
    fs.writeFileSync(forkPath, JSON.stringify(forkState, null, 2));

    this.forks.push({
      uuid: forkState.uuid,
      name: forkName,
      parentUuid: this.currentState.uuid,
      path: forkPath
    });

    // 创建独立的 StateMachine 实例管理分叉
    const forkMachine = new StateMachine(`${this.projectId}_${forkName}`);
    forkMachine.currentState = forkState;

    return forkMachine;
  }

  // ============ Rewind（回退） ============
  rewind(targetTurn = 0) {
    const history = this.loadFullHistory();

    // 找到目标轮次的状态
    const targetState = history.find(s => s.turn === targetTurn);

    if (!targetState) {
      throw new Error(`找不到轮次 ${targetTurn} 的状态`);
    }

    // 创建回退分支（不修改原始链）
    const rewindState = {
      ...targetState,
      uuid: this.generateUUID(),
      parentUuid: targetState.uuid,
      rewindFrom: this.currentState?.uuid,
      rewindTurn: targetTurn,
      timestamp: new Date().toISOString()
    };

    this.appendEvent('rewind', {
      fromUuid: this.currentState?.uuid,
      toUuid: rewindState.uuid,
      targetTurn,
      timestamp: new Date().toISOString()
    });

    this.currentState = rewindState;
    this.saveSnapshot(rewindState);

    return rewindState;
  }

  // ============ 快照管理 ============
  saveSnapshot(state) {
    const snapshotPath = path.join(this.statesDir, `state_${state.uuid}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(state, null, 2));

    this.snapshots.push({
      uuid: state.uuid,
      turn: state.turn,
      timestamp: state.timestamp,
      path: snapshotPath
    });

    // 清理旧快照
    if (this.snapshots.length > this.maxSnapshots) {
      const old = this.snapshots.shift();
      if (old && fs.existsSync(old.path)) {
        fs.unlinkSync(old.path);
      }
    }
  }

  // ============ 追加式事件记录 ============
  appendEvent(type, data) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      data
    };

    this.transcript.push(event);

    // 追加写入文件
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.transcriptPath, line);
  }

  // ============ 加载完整历史 ============
  loadFullHistory() {
    if (!fs.existsSync(this.transcriptPath)) {
      return [];
    }

    const lines = fs.readFileSync(this.transcriptPath, 'utf8')
      .split('\n')
      .filter(l => l.trim());

    const events = lines.map(l => JSON.parse(l));
    const states = [];

    // 从事件中重建状态链
    let currentState = null;
    for (const event of events) {
      if (event.type === 'init') {
        currentState = event.data;
        states.push(currentState);
      } else if (event.type === 'transition') {
        // 从快照加载状态
        const snapshotPath = path.join(this.statesDir, `state_${event.data.toUuid}.json`);
        if (fs.existsSync(snapshotPath)) {
          currentState = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
          states.push(currentState);
        }
      }
    }

    return states;
  }

  // ============ 重建状态链 ============
  rebuildChain(history, targetUuid) {
    const chain = [];
    const stateMap = new Map(history.map(s => [s.uuid, s]));

    let current = stateMap.get(targetUuid);
    while (current) {
      chain.unshift(current);
      current = stateMap.get(current.parentUuid);
    }

    return chain;
  }

  // ============ 状态查询 ============
  getCurrentState() {
    return this.currentState;
  }

  getHistory(options = {}) {
    const { limit = 50, fromTurn = 0 } = options;
    const history = this.loadFullHistory();
    return history
      .filter(s => s.turn >= fromTurn)
      .slice(-limit);
  }

  getForks() {
    return this.forks;
  }

  getTranscript() {
    return this.transcript;
  }

  // ============ 导出 ============
  exportState() {
    return {
      projectId: this.projectId,
      currentState: this.currentState,
      transcriptLength: this.transcript.length,
      snapshotCount: this.snapshots.length,
      forkCount: this.forks.length
    };
  }

  // ============ 辅助方法 ============
  generateUUID() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  loadTranscript() {
    if (fs.existsSync(this.transcriptPath)) {
      const lines = fs.readFileSync(this.transcriptPath, 'utf8')
        .split('\n')
        .filter(l => l.trim());
      this.transcript = lines.map(l => JSON.parse(l));
    }
  }
}

// ============ 便捷函数 ============
export function createStateMachine(projectId, config) {
  return new StateMachine(projectId, config);
}

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const sm = new StateMachine('test-project');

  // 测试状态机
  sm.init({ projectName: 'Test Video', budget: 10.0 });
  console.log('初始状态:', sm.getCurrentState());

  sm.transition({ turn: 1, action: 'generate_plan' });
  console.log('转移后:', sm.getCurrentState());

  sm.transition({ turn: 2, action: 'render_preview' });
  console.log('历史:', sm.getHistory());

  const fork = sm.fork('version-b', { variant: 'dark-theme' });
  console.log('分叉:', fork.getCurrentState());

  sm.rewind(1);
  console.log('回退后:', sm.getCurrentState());
}
