// pipeline-state-machine.js
// Pipeline 状态机 + 真·断点续跑 v1.0.0
// 状态机驱动、原子提交、Stage级恢复
// 日期: 2026-06-26

const fs = require('fs');
const path = require('path');

const CHECKPOINT_DIR = path.join(__dirname, '../../checkpoints');

// 标准Stage定义（有序）
const STANDARD_STAGES = [
  { name: 'INIT', description: '初始化', retryable: false },
  { name: 'REQUIREMENT_PARSED', description: '需求解析完成', retryable: false },
  { name: 'SCRIPT_COMPLETE', description: '剧本生成完成', retryable: true, agent: 'script-generator' },
  { name: 'SCENE_DESIGN_COMPLETE', description: '场景设计完成', retryable: true, agent: 'scene-design' },
  { name: 'OPENING_DESIGN_COMPLETE', description: '片头设计完成', retryable: true, agent: 'opening-design' },
  { name: 'VISUAL_LANGUAGE_COMPLETE', description: '视觉语言完成', retryable: true, agent: 'visual-language' },
  { name: 'AUDIO_DESIGN_COMPLETE', description: '音频设计完成', retryable: true, agent: 'audio-design' },
  { name: 'CONTINUITY_REVIEW_COMPLETE', description: '连续性审查完成', retryable: true, agent: 'continuity-review' },
  { name: 'PROMPT_FUSION_COMPLETE', description: 'Prompt融合完成', retryable: true, agent: 'prompt-fusion' },
  { name: 'QUALITY_CHECK_COMPLETE', description: '质量检查完成', retryable: true, agent: 'quality-check' },
  { name: 'RENDER_READY', description: '可渲染状态', retryable: false }
];

class PipelineStateMachine {
  constructor(projectId, options = {}) {
    this.projectId = projectId;
    this.options = options;
    this.stages = STANDARD_STAGES;
    this.currentState = 'INIT';
    this.stateIndex = 0;
    this.checkpointData = {};
    this.failureLog = [];
    this.compensationStack = [];
    
    this._ensureDir();
    this._loadCheckpoint();
  }
  
  _ensureDir() {
    if (!fs.existsSync(CHECKPOINT_DIR)) {
      fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }
  }
  
  _checkpointPath() {
    return path.join(CHECKPOINT_DIR, `state-${this.projectId}.json`);
  }
  
  _tempCheckpointPath() {
    return path.join(CHECKPOINT_DIR, `.state-${this.projectId}.json.tmp`);
  }
  
  /**
   * 加载已有checkpoint（断点续跑）
   */
  _loadCheckpoint() {
    const cpPath = this._checkpointPath();
    if (fs.existsSync(cpPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
        this.currentState = data.currentState || 'INIT';
        this.stateIndex = this.stages.findIndex(s => s.name === this.currentState);
        this.checkpointData = data.checkpointData || {};
        this.failureLog = data.failureLog || [];
        console.log(`[StateMachine] 加载checkpoint: ${this.projectId} @ ${this.currentState}`);
      } catch (e) {
        console.warn('[StateMachine] checkpoint加载失败，从头开始:', e.message);
      }
    }
  }
  
  /**
   * 原子提交checkpoint
   */
  async _atomicCheckpoint(stageName, data = {}) {
    this.checkpointData[stageName] = {
      timestamp: Date.now(),
      data
    };
    
    const payload = {
      projectId: this.projectId,
      currentState: stageName,
      checkpointData: this.checkpointData,
      failureLog: this.failureLog,
      updatedAt: new Date().toISOString()
    };
    
    try {
      // 先写临时文件
      fs.writeFileSync(this._tempCheckpointPath(), JSON.stringify(payload, null, 2));
      // 原子rename
      fs.renameSync(this._tempCheckpointPath(), this._checkpointPath());
      console.log(`[StateMachine] checkpoint原子提交: ${stageName}`);
    } catch (e) {
      console.error('[StateMachine] checkpoint提交失败:', e.message);
    }
  }
  
  /**
   * 获取当前状态信息
   */
  getStatus() {
    const stage = this.stages[this.stateIndex];
    return {
      projectId: this.projectId,
      currentState: this.currentState,
      stateIndex: this.stateIndex,
      totalStages: this.stages.length,
      progress: ((this.stateIndex / (this.stages.length - 1)) * 100).toFixed(1) + '%',
      currentStage: stage?.description || '未知',
      retryable: stage?.retryable || false,
      failureCount: this.failureLog.length,
      lastFailure: this.failureLog[this.failureLog.length - 1] || null
    };
  }
  
  /**
   * 执行单个Stage
   * @param {Function} stageExecutor - 异步执行函数
   * @param {Function} compensator - 补偿函数（可选）
   */
  async executeStage(stageName, stageExecutor, compensator = null) {
    const stage = this.stages.find(s => s.name === stageName);
    if (!stage) {
      throw new Error(`未知Stage: ${stageName}`);
    }
    
    console.log(`[StateMachine] ====== 执行Stage: ${stageName} (${stage.description}) ======`);
    const startTime = Date.now();
    
    try {
      // 执行Stage
      const result = await stageExecutor();
      
      // 记录补偿方法
      if (compensator) {
        this.compensationStack.push({ stage: stageName, compensate: compensator });
      }
      
      // 更新状态
      this.currentState = stageName;
      this.stateIndex = this.stages.indexOf(stage);
      
      // 原子提交
      await this._atomicCheckpoint(stageName, { result: true, duration: Date.now() - startTime });
      
      console.log(`[StateMachine] Stage完成: ${stageName} (${Date.now() - startTime}ms)`);
      return result;
      
    } catch (err) {
      // 记录失败
      this.failureLog.push({
        stage: stageName,
        error: err.message,
        stack: err.stack,
        timestamp: Date.now()
      });
      
      console.error(`[StateMachine] Stage失败: ${stageName} - ${err.message}`);
      
      // 如果Stage可重试，尝试补偿后重跑
      if (stage.retryable) {
        console.log(`[StateMachine] Stage ${stageName} 可重试，执行补偿...`);
        await this._compensate();
        throw new RecoverableError(stageName, err);
      }
      
      throw err;
    }
  }
  
  /**
   * 执行补偿（倒序回滚）
   */
  async _compensate() {
    console.log(`[StateMachine] 执行补偿事务，回滚${this.compensationStack.length}个Stage...`);
    
    for (const item of this.compensationStack.reverse()) {
      try {
        await item.compensate();
        console.log(`[StateMachine] 补偿完成: ${item.stage}`);
      } catch (e) {
        console.error(`[StateMachine] 补偿失败: ${item.stage} - ${e.message}`);
      }
    }
    
    this.compensationStack = [];
  }
  
  /**
   * 从断点恢复运行
   * @param {Function} stageExecutors - 各Stage的执行函数映射 { stageName: executor }
   */
  async resume(stageExecutors) {
    console.log(`[StateMachine] 从状态 ${this.currentState} 恢复，当前进度 ${this.stateIndex}/${this.stages.length - 1}`);
    
    // 找到当前状态对应的索引
    const startIdx = this.stateIndex + 1; // 从下一个Stage开始
    
    for (let i = startIdx; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const executor = stageExecutors[stage.name];
      
      if (!executor) {
        console.warn(`[StateMachine] 未找到Stage ${stage.name} 的执行器，跳过`);
        continue;
      }
      
      await this.executeStage(stage.name, executor);
    }
    
    console.log(`[StateMachine] 项目完成: ${this.projectId}`);
    return { completed: true, finalState: this.currentState };
  }
  
  /**
   * 从头运行（忽略已有checkpoint）
   */
  async runFromStart(stageExecutors) {
    console.log(`[StateMachine] 从头运行项目: ${this.projectId}`);
    this.currentState = 'INIT';
    this.stateIndex = 0;
    this.checkpointData = {};
    this.failureLog = [];
    this.compensationStack = [];
    
    // 清理旧checkpoint
    try {
      if (fs.existsSync(this._checkpointPath())) {
        fs.unlinkSync(this._checkpointPath());
      }
    } catch (e) {
      console.warn('[StateMachine] 清理旧checkpoint失败:', e.message);
    }
    
    return this.resume(stageExecutors);
  }
  
  /**
   * 强制重跑某个Stage（从该Stage开始恢复）
   */
  async rerunFrom(stageName, stageExecutors) {
    const idx = this.stages.findIndex(s => s.name === stageName);
    if (idx === -1) {
      throw new Error(`未知Stage: ${stageName}`);
    }
    
    this.currentState = this.stages[idx - 1]?.name || 'INIT';
    this.stateIndex = idx - 1;
    
    console.log(`[StateMachine] 从Stage ${stageName} 重新运行`);
    return this.resume(stageExecutors);
  }
  
  /**
   * 清理项目checkpoint
   */
  cleanup() {
    try {
      const cpPath = this._checkpointPath();
      if (fs.existsSync(cpPath)) {
        fs.unlinkSync(cpPath);
        console.log(`[StateMachine] 清理checkpoint: ${this.projectId}`);
      }
    } catch (e) {
      console.warn('[StateMachine] 清理失败:', e.message);
    }
  }
}

/**
 * 可恢复错误
 */
class RecoverableError extends Error {
  constructor(stageName, originalError) {
    super(`Stage ${stageName} 可恢复失败: ${originalError.message}`);
    this.stageName = stageName;
    this.originalError = originalError;
    this.recoverable = true;
  }
}

module.exports = { PipelineStateMachine, RecoverableError, STANDARD_STAGES };
