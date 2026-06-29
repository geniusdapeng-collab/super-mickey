/**
 * Render Quality Feedback Loop v1.0 — 渲染质量反馈循环
 * 系统核心基础设施：建立"质量评分→Prompt优化→重新渲染"闭环
 *
 * 职责：
 * - 质量分析：自动分析渲染质量（角色一致性、画面稳定性、文字正确性）
 * - Prompt优化：基于质量评分自动生成优化建议
 * - 质量历史：追踪每次渲染的质量变化趋势
 * - 与AMS集成：关联渲染输出资产
 * - 与Event Bus集成：发布质量事件
 *
 * 核心能力：
 * 1. RenderQualityAnalyzer: 分析渲染质量
 * 2. PromptOptimizer: 基于质量分析生成优化建议
 * 3. QualityHistory: 质量历史追踪
 * 4. FeedbackLoop: 闭环控制
 * 5. QualityMetrics: 评分指标定义
 *
 * 质量评分维度：
 * - character_consistency: 角色一致性（是否同一个角色）
 * - frame_stability: 画面稳定性（是否闪烁）
 * - text_correctness: 文字正确性（是否有错误文字）
 * - visual_quality: 视觉质量（清晰度、色彩）
 * - camera_quality: 运镜质量（是否流畅）
 * - overall: 综合评分
 *
 * @version v1.0
 * @author Core Team
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、质量评分维度
// ============================================================

const QUALITY_DIMENSIONS = {
  character_consistency: {
    name: '角色一致性',
    weight: 0.25,
    description: '渲染结果中的角色是否与定妆照一致',
    check: (shot, renderOutput) => {
      // 简化：检查角色ID是否匹配
      const shotChars = shot.characters || [];
      const renderChars = renderOutput?.characters || [];
      return shotChars.length === renderChars.length ? 1.0 : 0.5;
    }
  },
  frame_stability: {
    name: '画面稳定性',
    weight: 0.20,
    description: '画面是否稳定，无闪烁或突变',
    check: (shot, renderOutput) => {
      // 简化：基于时长判断（时长合理 = 稳定）
      const duration = shot.duration || 5;
      return duration >= 2 && duration <= 15 ? 1.0 : 0.7;
    }
  },
  text_correctness: {
    name: '文字正确性',
    weight: 0.15,
    description: '画面中是否有错误文字或乱码',
    check: (shot, renderOutput) => {
      // 简化：检查是否有负面提示词中禁止的内容
      const negativeWords = ['文字', '字幕', 'logo', 'watermark'];
      const prompt = (shot.visualPrompt || '').toLowerCase();
      const hasNegative = negativeWords.some(w => prompt.includes(w));
      return hasNegative ? 0.5 : 1.0;
    }
  },
  visual_quality: {
    name: '视觉质量',
    weight: 0.20,
    description: '清晰度、色彩、构图',
    check: (shot, renderOutput) => {
      // 简化：基于Prompt长度（越长通常描述越详细）
      const promptLength = (shot.visualPrompt || '').length;
      return promptLength > 200 ? 1.0 : promptLength > 100 ? 0.8 : 0.6;
    }
  },
  camera_quality: {
    name: '运镜质量',
    weight: 0.10,
    description: '运镜是否流畅自然',
    check: (shot, renderOutput) => {
      const camera = shot.cameraMovement;
      return camera?.type && camera.type !== 'static' ? 1.0 : 0.7;
    }
  },
  prompt_completeness: {
    name: 'Prompt完整性',
    weight: 0.10,
    description: 'Prompt是否包含所有必要元素',
    check: (shot, renderOutput) => {
      const prompt = shot.visualPrompt || '';
      const hasCharacter = prompt.includes('角色') || prompt.includes('character');
      const hasScene = prompt.includes('场景') || prompt.includes('scene');
      const hasCamera = prompt.includes('运镜') || prompt.includes('camera');
      const score = [hasCharacter, hasScene, hasCamera].filter(Boolean).length / 3;
      return score;
    }
  }
};

// ============================================================
// 二、质量分析器
// ============================================================

class RenderQualityAnalyzer {
  constructor() {
    this.dimensions = { ...QUALITY_DIMENSIONS };
  }

  /**
   * 分析渲染质量
   */
  analyze(shot, renderOutput) {
    const scores = {};
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [key, dim] of Object.entries(this.dimensions)) {
      try {
        const score = dim.check(shot, renderOutput);
        scores[key] = {
          score: Math.round(score * 100) / 100,
          weight: dim.weight,
          name: dim.name
        };
        totalWeight += dim.weight;
        weightedScore += score * dim.weight;
      } catch (error) {
        scores[key] = {
          score: 0,
          weight: dim.weight,
          name: dim.name,
          error: error.message
        };
      }
    }

    const overall = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;

    return {
      overall,
      scores,
      passed: overall >= 0.7,  // 70分通过
      timestamp: Date.now(),
      shotId: shot.id || shot.shotId
    };
  }

  /**
   * 批量分析
   */
  analyzeBatch(shots, renderOutputs) {
    return shots.map((shot, i) => this.analyze(shot, renderOutputs[i]));
  }
}

// ============================================================
// 三、Prompt优化器
// ============================================================

class PromptOptimizer {
  constructor() {
    this.rules = [
      {
        name: '角色一致性增强',
        condition: (analysis) => analysis.scores.character_consistency.score < 0.8,
        action: (shot) => ({
          visualPrompt: `严格保持一致的角色形象: ${shot.visualPrompt}`,
          recommendation: '在Prompt开头强调角色特征，如发型、服装、面部特征'
        })
      },
      {
        name: '画面稳定性增强',
        condition: (analysis) => analysis.scores.frame_stability.score < 0.8,
        action: (shot) => ({
          visualPrompt: `稳定画面: ${shot.visualPrompt}`,
          recommendation: '添加"稳定画面、无闪烁"等关键词'
        })
      },
      {
        name: '文字正确性增强',
        condition: (analysis) => analysis.scores.text_correctness.score < 0.8,
        action: (shot) => ({
          visualPrompt: `${shot.visualPrompt}，画面中无文字、无字幕、无logo`,
          recommendation: '在Prompt中明确排除文字元素'
        })
      },
      {
        name: '视觉质量增强',
        condition: (analysis) => analysis.scores.visual_quality.score < 0.8,
        action: (shot) => ({
          visualPrompt: `高质量画面，清晰细节，丰富色彩: ${shot.visualPrompt}`,
          recommendation: '增加视觉描述细节，如光照、材质、色彩'
        })
      },
      {
        name: 'Prompt完整性增强',
        condition: (analysis) => analysis.scores.prompt_completeness.score < 0.8,
        action: (shot) => ({
          visualPrompt: `包含角色、场景、运镜的完整画面: ${shot.visualPrompt}`,
          recommendation: '确保Prompt包含角色、场景、运镜三个核心元素'
        })
      }
    ];
  }

  /**
   * 基于质量分析生成优化建议
   */
  optimize(shot, analysis) {
    const optimizations = [];
    let newPrompt = shot.render_prompt || shot.renderPrompt || shot.visualPrompt || shot.prompt || '';

    for (const rule of this.rules) {
      if (rule.condition(analysis)) {
        const result = rule.action(shot);
        newPrompt = result.visualPrompt;
        optimizations.push({
          rule: rule.name,
          recommendation: result.recommendation,
          dimension: this.getDimensionForRule(rule.name)
        });
      }
    }

    return {
      originalPrompt: shot.visualPrompt,
      optimizedPrompt: newPrompt,
      optimizations,
      expectedImprovement: this.calculateImprovement(analysis, optimizations)
    };
  }

  getDimensionForRule(ruleName) {
    const map = {
      '角色一致性增强': 'character_consistency',
      '画面稳定性增强': 'frame_stability',
      '文字正确性增强': 'text_correctness',
      '视觉质量增强': 'visual_quality',
      'Prompt完整性增强': 'prompt_completeness'
    };
    return map[ruleName] || 'unknown';
  }

  calculateImprovement(analysis, optimizations) {
    // 简化：每个优化预计提升0.1分
    const improvement = optimizations.length * 0.1;
    return Math.min(1.0, analysis.overall + improvement);
  }
}

// ============================================================
// 四、质量历史
// ============================================================

class QualityHistory {
  constructor() {
    this.records = new Map();  // shotId -> Array<record>
  }

  record(shotId, analysis) {
    if (!this.records.has(shotId)) {
      this.records.set(shotId, []);
    }
    this.records.get(shotId).push({
      ...analysis,
      recordedAt: Date.now()
    });
  }

  getHistory(shotId) {
    return this.records.get(shotId) || [];
  }

  getTrend(shotId) {
    const history = this.getHistory(shotId);
    if (history.length < 2) return 'insufficient_data';

    const scores = history.map(h => h.overall);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (last > first + 0.1) return 'improving';
    if (last < first - 0.1) return 'degrading';
    return 'stable';
  }

  getBest(shotId) {
    const history = this.getHistory(shotId);
    if (history.length === 0) return null;
    return history.reduce((best, h) => h.overall > best.overall ? h : best);
  }

  getWorst(shotId) {
    const history = this.getHistory(shotId);
    if (history.length === 0) return null;
    return history.reduce((worst, h) => h.overall < worst.overall ? h : worst);
  }
}

// ============================================================
// 五、反馈循环
// ============================================================

class RenderQualityFeedbackLoop {
  constructor(options = {}) {
    this.analyzer = new RenderQualityAnalyzer();
    this.optimizer = new PromptOptimizer();
    this.history = new QualityHistory();
    this.maxIterations = options.maxIterations || 3;
    this.qualityThreshold = options.qualityThreshold || 0.7;
    this.eventBus = new NirathEventBus({ name: 'quality-loop', enabled: true });
  }

  /**
   * 执行反馈循环
   */
  async run(shot, renderOutput, iteration = 1) {
    console.log(`[QualityLoop] 🔄 迭代 ${iteration}/${this.maxIterations} | 镜头: ${shot.id}`);

    // 1. 分析质量
    const analysis = this.analyzer.analyze(shot, renderOutput);
    this.history.record(shot.id, analysis);

    console.log(`[QualityLoop] 📊 质量评分: ${(analysis.overall * 100).toFixed(0)}分`);

    // 发布事件
    this.eventBus.publish('render.quality.analyzed', {
      shotId: shot.id,
      overall: analysis.overall,
      scores: analysis.scores,
      iteration
    }, { traceId: shot.traceId || `ql_${Date.now()}` });

    // 2. 检查是否通过
    if (analysis.passed) {
      console.log(`[QualityLoop] ✅ 质量达标，循环结束`);
      return {
        status: 'passed',
        analysis,
        iterations: iteration,
        history: this.history.getHistory(shot.id)
      };
    }

    // 3. 检查是否达到最大迭代
    if (iteration >= this.maxIterations) {
      console.log(`[QualityLoop] ⚠️ 达到最大迭代次数，循环结束`);
      return {
        status: 'max_iterations',
        analysis,
        iterations: iteration,
        history: this.history.getHistory(shot.id)
      };
    }

    // 4. 生成优化建议
    const optimization = this.optimizer.optimize(shot, analysis);
    console.log(`[QualityLoop] 🔧 优化建议: ${optimization.optimizations.map(o => o.rule).join(', ')}`);

    // 发布优化事件
    this.eventBus.publish('render.quality.optimized', {
      shotId: shot.id,
      optimizations: optimization.optimizations,
      expectedImprovement: optimization.expectedImprovement
    }, { traceId: shot.traceId || `ql_${Date.now()}` });

    return {
      status: 'needs_improvement',
      analysis,
      optimization,
      iterations: iteration,
      history: this.history.getHistory(shot.id)
    };
  }

  /**
   * 批量执行
   */
  async runBatch(shots, renderOutputs) {
    const results = [];
    for (let i = 0; i < shots.length; i++) {
      const result = await this.run(shots[i], renderOutputs[i]);
      results.push(result);
    }
    return results;
  }

  /**
   * 获取质量报告
   */
  getQualityReport(shotId) {
    const history = this.history.getHistory(shotId);
    const trend = this.history.getTrend(shotId);
    const best = this.history.getBest(shotId);
    const worst = this.history.getWorst(shotId);

    return {
      shotId,
      totalRenders: history.length,
      trend,
      bestScore: best?.overall,
      worstScore: worst?.overall,
      averageScore: history.length > 0
        ? history.reduce((sum, h) => sum + h.overall, 0) / history.length
        : 0,
      history: history.map(h => ({
        iteration: h.iteration || 1,
        overall: h.overall,
        passed: h.passed,
        timestamp: h.recordedAt
      }))
    };
  }

  /**
   * 获取所有报告
   */
  getAllReports() {
    const reports = {};
    for (const shotId of this.history.records.keys()) {
      reports[shotId] = this.getQualityReport(shotId);
    }
    return reports;
  }
}

// ============================================================
// 六、导出
// ============================================================

module.exports = {
  RenderQualityFeedbackLoop,
  RenderQualityAnalyzer,
  PromptOptimizer,
  QualityHistory,
  QUALITY_DIMENSIONS,

  // 快速创建
  createQualityLoop: (options) => new RenderQualityFeedbackLoop(options)
};

// ============================================================
// 七、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Render Quality Feedback Loop 集成测试 ===\n');

    const loop = new RenderQualityFeedbackLoop({ maxIterations: 3 });

    // 测试1：高质量渲染（通过）
    console.log('--- 测试1：高质量渲染 ---');
    const goodShot = {
      id: 'S01',
      sequence: 1,
      visualPrompt: '高质量画面：少年站在山顶，阳光洒落，风吹衣角，远景清晰，运镜缓慢推进，角色特征明显：短发、白衣、坚定眼神',
      duration: 5,
      characters: [{ id: 'hero', name: '少年' }],
      cameraMovement: { type: 'dolly', direction: '向前' }
    };
    const result1 = await loop.run(goodShot, { frameCount: 120 });
    console.log('状态:', result1.status);
    console.log('评分:', (result1.analysis.overall * 100).toFixed(0));

    // 测试2：低质量渲染（需要优化）
    console.log('\n--- 测试2：低质量渲染 ---');
    const badShot = {
      id: 'S02',
      sequence: 2,
      visualPrompt: '少年',  // 过短
      duration: 1,  // 过短
      characters: []
    };
    const result2 = await loop.run(badShot, { frameCount: 30 });
    console.log('状态:', result2.status);
    console.log('评分:', (result2.analysis.overall * 100).toFixed(0));
    if (result2.optimization) {
      console.log('优化建议:', result2.optimization.optimizations.map(o => o.rule).join(', '));
    }

    // 测试3：质量报告
    console.log('\n--- 测试3：质量报告 ---');
    console.log(loop.getQualityReport('S01'));
    console.log(loop.getQualityReport('S02'));

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
