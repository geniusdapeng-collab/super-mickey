/**
 * Phase 1: SceneDesign + OpeningDesign 并行执行
 * 
 * 职责：
 * - 并行调用 sceneDesignAgent 和 openingDesignAgent
 * - 合并场景设计结果到 shots
 * - 注入片头数据到 sceneType=opening 的镜头
 * - 保存 checkpoint
 */

const { PhaseExecutor } = require('./phase-executor');

class Phase1SceneDesign extends PhaseExecutor {
  constructor(options) {
    super({ name: 'Phase1-SceneDesign', ...options });
  }

  async execute(state) {
    const { shots, result, adaptedBlueprint } = state;
    const startTime = Date.now();
    
    // 预算检查
    if (!this.checkBudget(140000, 'Phase 1')) {
      return { success: false, shots, result, timing: 0, error: '预算不足' };
    }

    this.log('PHASE-1', 'SceneDesign + OpeningDesign 并行启动...');

    try {
      // 并行执行两个 Agent
      const [sdResult, odResult] = await this._runParallel({
        'scene-design': this.agents.sceneDesign.process(this.cloneShots(shots), adaptedBlueprint),
        'opening-design': this._shouldGenerateOpening(adaptedBlueprint)
          ? this.agents.openingDesign.process(adaptedBlueprint)
          : Promise.resolve(null)
      });

      // 合并场景设计结果（sdResult.shots 可能因 Agent 内部降级而缺失）
      // 【修复 新-P0】白名单补齐 makeup/props：SceneDesign schema 输出 6 字段，
      // 严格白名单生效后这两个字段会被 MERGE-GUARD 误拦截
      let newShots = this.mergeShots(shots, sdResult.shots || [], [
        'scene', 'mood', 'action', 'emotional_target', 'makeup', 'props'
      ]);

      // 处理片头设计结果
      if (odResult && odResult.opening) {
        result.stages.opening = { agent: 'openingDesign', ...odResult };
        result.opening = odResult.opening;
        newShots = this._injectOpeningData(newShots, odResult);
      }

      // 更新统计
      result.llmStats.sceneDesign = sdResult.timing;
      result.llmStats.openingDesign = odResult?.timing;

      const timing = Date.now() - startTime;
      this.log('PHASE-1', `完成 (${timing}ms)`);

      // 保存 checkpoint
      await this.saveCheckpoint('phase1', newShots, { 
        opening: result.opening, 
        llmStats: result.llmStats 
      });
      this.checkMemory('phase1');

      return { success: true, shots: newShots, result, timing };
    } catch (e) {
      this.log('PHASE-1-FAIL', `❌ ${e.message}`);
      return { success: false, shots, result, timing: Date.now() - startTime, error: e.message };
    }
  }

  /**
   * 并行执行多个任务（部分容错版）
   * 【修复 P2-1】核心任务(scene-design)失败才算 Phase 失败；
   * 非核心任务(opening-design)失败降级为 null 继续，保住核心 LLM 产出
   */
  async _runParallel(tasks) {
    const entries = Object.entries(tasks);
    const results = await Promise.all(
      entries.map(([key, promise]) =>
        Promise.resolve(promise)
          .then(result => ({ key, result, success: true }))
          .catch(error => ({ key, error, success: false }))
      )
    );

    const output = {};
    const failed = [];
    for (const r of results) {
      if (r.success) output[r.key] = r.result;
      else failed.push(r);
    }

    // 核心任务失败 → Phase 失败（抛出由 execute 的 catch 统一处理）
    const coreFailure = failed.find(r => r.key === 'scene-design');
    if (coreFailure) throw coreFailure.error;

    // 非核心任务失败 → 降级继续
    for (const f of failed) {
      this.log('PHASE-1', `⚠️ 非核心任务 ${f.key} 失败(${f.error?.message})，降级继续`);
      output[f.key] = null;
    }
    return [output['scene-design'], output['opening-design']];
  }

  /**
   * 判断是否需要生成片头
   */
  _shouldGenerateOpening(adaptedBlueprint) {
    // 检查是否需要片头（可以扩展为更复杂的逻辑）
    return true;
  }

  /**
   * 注入片头数据到 sceneType=opening 的镜头
   */
  _injectOpeningData(shots, odResult) {
    const openingIdx = shots.findIndex(s => s.sceneType === 'opening');
    if (openingIdx < 0) return shots;

    const od = odResult.opening;
    const titleOverlay = od.titleOverlay || {};
    
    // 克隆并修改（避免直接变异原始对象）
    const newShots = [...shots];
    newShots[openingIdx] = this.cloneShots([shots[openingIdx]])[0];
    
    const openingShot = newShots[openingIdx];
    openingShot.title = od.title || titleOverlay.mainTitle || titleOverlay.main_title || '';
    openingShot.subtitle = od.subtitle || titleOverlay.subtitle || titleOverlay.sub_title || '';
    openingShot.titleOverlay = od.titleOverlay || null;
    openingShot.audioLayer = od.audioLayer || null;
    openingShot.lightingString = od.lightingString || openingShot.lightingString;
    openingShot.cameraString = od.cameraString || openingShot.cameraString;

    this.log('OPENING-INJECT', `片头数据已注入 ${openingShot.shotId}: title="${openingShot.title}"`);
    
    return newShots;
  }
}

module.exports = { Phase1SceneDesign };