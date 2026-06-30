/**
 * 导演-编剧闭环编排器 (Director-Screenwriter Loop Orchestrator) v1.0
 * Stage 17 主控模块
 * 
 * 职责：
 * 1. 编排 Stage 17 全流程：导演优化 → 连贯性检查 → 台词一致性检查 → 编剧优化
 * 2. 最多 3 轮迭代收敛
 * 3. 每轮重新评估，评分达标或达上限则终止
 * 4. 输出最终优化后的镜头方案
 * 
 * 约束：
 * - 不回流前序链路（Stage 1-16）
 * - 仅优化现有镜头 Prompt
 * - 导演风格库（Phase 2）暂不挂载
 * 
 * @version v1.0 (v6.2-patch68)
 * @author 小G
 */

const { DirectorFinalReview } = require('./director-final-review.js');
const { ContinuityEngine } = require('./continuity-engine.js');
const { DialogueConsistencyEngine } = require('./dialogue-consistency-engine.js');
const { ScreenwriterOptimizer } = require('./screenwriter-optimizer.js');

class DirectorScreenwriterLoop {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    this.maxIterations = options.maxIterations || 3;
    this.minPassScore = options.minPassScore || 75;
    this.useLLM = options.useLLM !== false; // v6.2-patch70: 默认启用 LLM
    
    // 子模块初始化
    this.directorReview = new DirectorFinalReview({ mode: this.mode, minPassScore: this.minPassScore, useLLM: this.useLLM });
    this.continuityEngine = new ContinuityEngine({ mode: this.mode });
    this.dialogueEngine = new DialogueConsistencyEngine({ mode: this.mode });
    this.screenwriter = new ScreenwriterOptimizer({ 
      mode: this.mode, 
      maxIterations: this.maxIterations,
      minPassScore: this.minPassScore,
      useLLM: this.useLLM // v6.2-patch70: 启用 LLM 推理
    });
  }

  /**
   * Stage 17 主入口：导演-编剧闭环
   * @param {Object} input
   * @param {Array} input.shots - 当前镜头方案（Stage 16 输出）
   * @param {Object} input.prd - 原始PRD需求
   * @param {Object} input.directorPlan - 导演前期方案（如果有）
   * @param {String} input.projectName - 项目名称
   * @returns {Object} 闭环结果
   */
  async execute(input) {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 STAGE 17: 导演-编剧全局优化 (v6.2-patch68)`);
    console.log(`${'='.repeat(70)}`);
    console.log(`项目: ${input.projectName || 'unknown'} | 模式: ${this.mode} | 最大迭代: ${this.maxIterations}`);
    console.log(`${'='.repeat(70)}\n`);

    let currentShots = JSON.parse(JSON.stringify(input.shots)); // 深拷贝
    let finalReviewResult = null;
    let finalContinuityResult = null;
    let finalDialogueResult = null;
    let finalOptimizeResult = null;
    let iteration = 0;

    // ===== 第 0 轮：基线评估 =====
    console.log(`[Stage17] 📊 第 0 轮：基线评估...`);
    const baseline = await this._runReviewCycle(currentShots, input);
    console.log(`[Stage17] 📊 基线评分: 导演${baseline.director.score}/100 | 连贯性${baseline.continuity.score}/100 | 台词${baseline.dialogue.score}/100`);

    // 判断是否需要进入优化循环
    const needsOptimization = baseline.director.score < this.minPassScore || 
                              baseline.continuity.score < this.minPassScore ||
                              baseline.dialogue.score < this.minPassScore ||
                              baseline.director.issues.length > 0;

    if (!needsOptimization) {
      console.log(`[Stage17] ✅ 基线全部通过，无需优化循环`);
      finalReviewResult = baseline.director;
      finalContinuityResult = baseline.continuity;
      finalDialogueResult = baseline.dialogue;
      
      return this._assembleResult({
        iteration: 0,
        shots: currentShots,
        reviewResult: finalReviewResult,
        continuityResult: finalContinuityResult,
        dialogueResult: finalDialogueResult,
        optimizeResult: null,
        totalTime: Date.now() - startTime,
        passed: true
      });
    }

    // ===== 进入优化循环（最多 3 轮）=====
    for (iteration = 1; iteration <= this.maxIterations; iteration++) {
      console.log(`\n${'-'.repeat(70)}`);
      console.log(`[Stage17] 🔄 第 ${iteration}/${this.maxIterations} 轮优化`);
      console.log(`${'-'.repeat(70)}`);

      // Step 1: 编剧优化（基于上一轮评估结果）
      console.log(`[Stage17] ✍️ 调用编剧优化 Agent...`);
      const optimizeInput = {
        shots: currentShots,
        directorReview: finalReviewResult || baseline.director,
        continuityReport: finalContinuityResult || baseline.continuity,
        dialogueReport: finalDialogueResult || baseline.dialogue,
        prd: input.prd,
        directorPlan: input.directorPlan
      };

      const optimizeResult = await this.screenwriter.optimize(optimizeInput);
      currentShots = optimizeResult.optimizedShots;
      finalOptimizeResult = optimizeResult;

      console.log(`[Stage17] ✅ 编剧优化完成 | 修复: ${optimizeResult.issuesFixed.length} | 遗留: ${optimizeResult.issuesRemaining.length}`);

      // Step 2: 重新评估（导演优化 + 连贯性 + 台词）
      console.log(`[Stage17] 📊 重新评估优化后方案...`);
      const review = await this._runReviewCycle(currentShots, input);
      finalReviewResult = review.director;
      finalContinuityResult = review.continuity;
      finalDialogueResult = review.dialogue;

      console.log(`[Stage17] 📊 第 ${iteration} 轮评分: 导演${review.director.score}/100 | 连贯性${review.continuity.score}/100 | 台词${review.dialogue.score}/100`);
      console.log(`[Stage17] 📊 问题统计: 导演${review.director.issues.length} | 连贯性${review.continuity.issues.length} | 台词${review.dialogue.issues.length}`);

      // Step 3: 收敛判断
      const allPassed = review.director.score >= this.minPassScore &&
                        review.continuity.score >= this.minPassScore &&
                        review.dialogue.score >= this.minPassScore;
      
      const noFatalIssues = review.director.issues.filter(i => i.severity === 'high' || i.severity === 'fatal').length === 0;
      
      if (allPassed && noFatalIssues) {
        console.log(`[Stage17] ✅ 第 ${iteration} 轮收敛！全部通过`);
        break;
      }
      
      // 检查是否还有可修复的问题（编剧能处理的）
      const hasFixableIssues = review.director.issues.some(i => i.severity !== 'fatal') ||
                               review.continuity.issues.length > 0 ||
                               review.dialogue.issues.length > 0;
      
      if (!hasFixableIssues) {
        console.log(`[Stage17] ⚠️ 无可修复问题，但仍有硬性约束未满足，终止循环`);
        break;
      }

      if (iteration >= this.maxIterations) {
        console.log(`[Stage17] ⚠️ 达到最大迭代次数 ${this.maxIterations}，强制终止`);
      }
    }

    // ===== 组装最终结果 =====
    const totalTime = Date.now() - startTime;
    const passed = finalReviewResult.score >= this.minPassScore &&
                   finalContinuityResult.score >= this.minPassScore &&
                   finalDialogueResult.score >= this.minPassScore;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 Stage 17 闭环完成 | 迭代: ${iteration}轮 | 总耗时: ${totalTime}ms | ${passed ? '✅ 通过' : '⚠️ 未完全通过'}`);
    console.log(`${'='.repeat(70)}\n`);

    return this._assembleResult({
      iteration,
      shots: currentShots,
      reviewResult: finalReviewResult,
      continuityResult: finalContinuityResult,
      dialogueResult: finalDialogueResult,
      optimizeResult: finalOptimizeResult,
      totalTime,
      passed
    });
  }

  /**
   * 运行一轮完整评估（导演 + 连贯性 + 台词）
   */
  async _runReviewCycle(shots, input) {
    // 1. 导演优化
    console.log(`[Stage17]   🎬 调用导演评审...`);
    const directorResult = await this.directorReview.review({
      projectName: input.projectName,
      prd: input.prd,
      shots: shots,
      directorPlan: input.directorPlan
    });
    console.log(`[Stage17]   ✅ 导演评审完成 | 评分:${directorResult.score}/100 | 问题:${directorResult.issues?.length || 0}`);

    // 2. 连贯性引擎
    console.log(`[Stage17]   🔗 调用连贯性引擎...`);
    const continuityResult = this.continuityEngine.analyze(shots);
    console.log(`[Stage17]   ✅ 连贯性引擎完成 | 评分:${continuityResult.score}/100 | 问题:${continuityResult.issues?.length || 0}`);

    // 3. 台词一致性引擎
    console.log(`[Stage17]   📝 调用台词一致性引擎...`);
    const dialogueResult = this.dialogueEngine.analyze(shots);
    console.log(`[Stage17]   ✅ 台词一致性引擎完成 | 评分:${dialogueResult.score}/100 | 问题:${dialogueResult.issues?.length || 0}`);

    return {
      director: directorResult,
      continuity: continuityResult,
      dialogue: dialogueResult
    };
  }

  /**
   * 组装闭环结果
   */
  _assembleResult(params) {
    return {
      stage: 'STAGE-17',
      stageName: '导演-编剧全局优化',
      version: 'v6.2-patch68',
      passed: params.passed,
      iteration: params.iteration,
      totalTime: params.totalTime,
      
      // 优化后的镜头方案
      shots: params.shots,
      
      // 详细评估结果
      review: {
        directorFinalReview: params.reviewResult,
        continuityCheck: params.continuityResult,
        dialogueConsistency: params.dialogueResult
      },
      
      // 优化记录（如果有）
      optimization: params.optimizeResult ? {
        iterations: params.optimizeResult.iteration,
        issuesFixed: params.optimizeResult.issuesFixed.length,
        issuesRemaining: params.optimizeResult.issuesRemaining.length,
        scoreBefore: params.optimizeResult.scoreBefore,
        scoreAfter: params.optimizeResult.scoreAfter
      } : null,
      
      // 统计摘要
      summary: {
        totalShots: params.shots.length,
        directorScore: params.reviewResult?.score || 0,
        continuityScore: params.continuityResult?.score || 0,
        dialogueScore: params.dialogueResult?.score || 0,
        totalIssues: (params.reviewResult?.issues?.length || 0) + 
                     (params.continuityResult?.issues?.length || 0) + 
                     (params.dialogueResult?.issues?.length || 0),
        status: params.passed ? 'OPTIMIZED_PASS' : 'OPTIMIZED_PARTIAL'
      }
    };
  }

  /**
   * 输出最终报告
   */
  printFinalReport(result) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 Stage 17 最终报告`);
    console.log(`${'='.repeat(70)}`);
    console.log(`状态: ${result.passed ? '✅ 优化通过' : '⚠️ 部分优化'} (${result.summary.status})`);
    console.log(`迭代: ${result.iteration} 轮`);
    console.log(`耗时: ${result.totalTime}ms`);
    console.log(`镜头数: ${result.summary.totalShots}`);
    console.log(`\n评分:`);
    console.log(`  导演优化: ${result.summary.directorScore}/100`);
    console.log(`  连贯性: ${result.summary.continuityScore}/100`);
    console.log(`  台词一致性: ${result.summary.dialogueScore}/100`);
    console.log(`\n问题:`);
    console.log(`  导演: ${result.review.directorFinalReview?.issues?.length || 0}`);
    console.log(`  连贯性: ${result.review.continuityCheck?.issues?.length || 0}`);
    console.log(`  台词: ${result.review.dialogueConsistency?.issues?.length || 0}`);
    console.log(`  总计: ${result.summary.totalIssues}`);
    
    if (result.optimization) {
      console.log(`\n优化:`);
      console.log(`  修复: ${result.optimization.issuesFixed}`);
      console.log(`  遗留: ${result.optimization.issuesRemaining}`);
      console.log(`  分数: ${result.optimization.scoreBefore} → ${result.optimization.scoreAfter}`);
    }
    console.log(`${'='.repeat(70)}\n`);
  }
}

module.exports = { DirectorScreenwriterLoop };
// v6.2-patch68: 导演-编剧闭环编排器 — Stage 17 主控模块
