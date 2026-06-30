'use strict';

const { createLogger } = require('./logger');
const { buildQualityReport, normalizeScore } = require('./quality-reporter');
const qualityConfig = require('../config/quality-dimensions');

const logger = createLogger('quality-gate');

class QualityGate {
  constructor(options = {}) {
    this.options = options;
  }

  evaluatePipelineResult(result, context = {}) {
    const scores = {};
    const issues = [];
    const blockers = [];

    const shots = result?.stages?.output?.prompts || [];
    const errors = result?.errors || [];

    // 1. Prompt质量
    scores.promptQuality = this.evaluatePromptQuality(result, shots, issues);

    // 2. 故事质量
    scores.storyQuality = this.evaluateStoryQuality(result, issues);

    // 3. 连续性质量
    scores.continuityQuality = this.evaluateContinuityQuality(result, issues);

    // 4. 导演质量
    scores.directorQuality = this.evaluateDirectorQuality(result, issues);

    // 5. 渲染就绪度
    scores.renderReadiness = this.evaluateRenderReadiness(result, shots, issues, blockers);

    // 6. 系统完整性
    scores.systemIntegrity = this.evaluateSystemIntegrity(result, issues, blockers);

    // 全局硬拦截
    this.applyHardBlockRules(result, shots, blockers);

    if (errors.length > 0) {
      for (const err of errors) {
        issues.push({
          type: 'pipeline-error',
          severity: 'error',
          message: `${err.stage || 'UNKNOWN'}: ${err.message || String(err)}`
        });
      }
    }

    const report = buildQualityReport({
      scores,
      issues,
      blockers,
      context
    });

    logger.info('质量总评完成', {
      totalScore: report.totalScore,
      grade: report.grade,
      status: report.status,
      blockerCount: report.summary.blockerCount
    });

    return report;
  }

  evaluatePromptQuality(result, shots, issues) {
    if (!shots.length) {
      issues.push({
        type: 'prompt-quality',
        severity: 'error',
        message: '没有可评估的Prompt镜头'
      });
      return { score: 0, detail: '无镜头' };
    }

    let total = 0;

    for (const shot of shots) {
      const text =
        shot.render_prompt ||
        shot.renderPrompt ||
        shot.prompt ||
        shot.visualPrompt ||
        '';

      let shotScore = 0;

      // 长度
      if (text.length >= 889 && text.length <= 988) {
        shotScore += 40;
      } else if (text.length >= 700) {
        shotScore += 25;
      } else if (text.length > 0) {
        shotScore += 10;
      }

      // 结构标记
      const markers = ['【视觉】', '【镜头时间轴】', '【环境音效】', '【嘴部动作】'];
      const markerCount = markers.filter(m => text.includes(m)).length;
      shotScore += Math.min(30, markerCount * 8);

      // 核心视觉信息（Nirath模式）
      if (text.includes('Nirath') || text.includes('双恒星') || text.includes('生机勃勃')) {
        shotScore += 15;
      }
      // 核心视觉信息（generic模式：真实场景/纪录片/医疗教育等高质量关键词）
      else if (text.includes('realistic') || text.includes('documentary') || text.includes(' cinematic') || text.includes('电影级') || text.includes('超写实') || text.includes('超高清') || text.includes('专业') || text.includes('纪录片')) {
        shotScore += 15;
      }
      // 基础关键词兜底（generic模式仍有基础内容）
      else if (text.includes('镜头') || text.includes('画面') || text.includes('场景')) {
        shotScore += 8;
      }

      // 非空和基本可用（generic模式兜底）
      if (text.trim().length > 0) {
        shotScore += 15;
      }
      // 长度 bonus（generic模式：长文本=更多信息）
      if (text.length >= 600 && text.length < 889) {
        shotScore += 10; // 中长文本 bonus
      }

      total += Math.min(100, shotScore);
    }

    const score = Math.round(total / shots.length);

    if (score < qualityConfig.dimensions.promptQuality.warnScore) {
      issues.push({
        type: 'prompt-quality',
        severity: 'warning',
        message: `Prompt质量偏低: ${score}分`
      });
    }

    return {
      score,
      detail: `共${shots.length}镜`
    };
  }

  evaluateStoryQuality(result, issues) {
    let score = 50;

    const fiveElement = result?.stages?.fiveElement || result?.stages?.fiveElements;
    if (fiveElement) {
      // v6.5.33: generic模式五要素检查被跳过(enabled=false)，视为通过而非失败
      if (fiveElement.enabled === false && fiveElement.passed !== false) {
        score = Math.max(score, 70); // 跳过检查 = 视为合格
      } else {
        const fiveElementScore =
          normalizeScore(fiveElement.totalScore || fiveElement.score || 0, 0);
        score = Math.max(score, fiveElementScore);
      }
    }

    const storyCraft = result?.stages?.storyCraft;
    if (storyCraft?.success) {
      score += 10;
    }

    const storyboardValidation = result?.stages?.storyboardValidation;
    if (storyboardValidation?.valid === true) {
      score += 10;
    }

    // v6.5.33: integrityValidation 通过也可加分
    const integrityValidation = result?.stages?.integrityValidation;
    if (integrityValidation?.valid === true) {
      score += 5;
    }

    score = Math.min(100, score);

    if (score < qualityConfig.dimensions.storyQuality.warnScore) {
      issues.push({
        type: 'story-quality',
        severity: 'warning',
        message: `故事质量偏低: ${score}分`
      });
    }

    return {
      score,
      detail: '基于五要素、StoryCraft、故事板校验'
    };
  }

  evaluateContinuityQuality(result, issues) {
    let score = 60;

    const continuity = result?.stages?.continuity;
    if (continuity?.valid === true || continuity?.passed === true || continuity?.consistent === true) {
      score = 85;
    }

    const crossShot = result?.stages?.crossShotConsistency;
    if (crossShot?.passed === true) {
      score = Math.max(score, 88);
    }
    // v6.5.33: 无crossShot数据时，如果continuity通过，给80分保底
    else if (continuity?.consistent === true && !crossShot) {
      score = Math.max(score, 80);
    }

    const integrity = result?.stages?.integrityValidation;
    if (integrity?.valid === true) {
      score += 5;
    }

    score = Math.min(100, score);

    if (score < qualityConfig.dimensions.continuityQuality.warnScore) {
      issues.push({
        type: 'continuity-quality',
        severity: 'warning',
        message: `连续性质量偏低: ${score}分`
      });
    }

    return {
      score,
      detail: '基于continuity / cross-shot / integrity'
    };
  }

  evaluateDirectorQuality(result, issues) {
    let score = 50;

    const director =
      result?.stages?.directorFinalReview ||
      result?.stages?.directorOptimize ||
      result?.stages?.directorReview ||
      result?.stages?.directorScreenwriterLoop;

    if (director) {
      score = normalizeScore(
        director.directorScore ||
        director.totalScore ||
        director.score ||
        director.qualityScore?.totalScore ||
        50,
        50
      );
    }

    if (score < qualityConfig.dimensions.directorQuality.warnScore) {
      issues.push({
        type: 'director-quality',
        severity: 'warning',
        message: `导演质量偏低: ${score}分`
      });
    }

    return {
      score,
      detail: '基于导演终审/导演优化结果'
    };
  }

  evaluateRenderReadiness(result, shots, issues, blockers) {
    let score = 100;

    if (!shots.length) {
      score = 0;
      blockers.push({
        type: 'render-readiness',
        message: '没有可渲染镜头'
      });
      return { score, detail: '无镜头' };
    }

    for (const shot of shots) {
      const text =
        shot.render_prompt ||
        shot.renderPrompt ||
        shot.prompt ||
        shot.visualPrompt ||
        '';

      if (!text.trim()) {
        score -= 30;
      }

      const duration = Number(shot.duration || 0);
      if (!(duration >= 3 && duration <= 15)) {
        score -= 15;
      }

      const references = shot.referenceImages || shot.reference_images || [];
      if (Array.isArray(references) && references.length === 0) {
        score -= 10;
      }
    }

    score = Math.max(0, score);

    if (score < qualityConfig.dimensions.renderReadiness.warnScore) {
      issues.push({
        type: 'render-readiness',
        severity: 'warning',
        message: `渲染就绪度偏低: ${score}分`
      });
    }

    if (score < 40) {
      blockers.push({
        type: 'render-readiness',
        message: '渲染就绪度过低，不建议提交渲染'
      });
    }

    return {
      score,
      detail: `检查${shots.length}镜`
    };
  }

  evaluateSystemIntegrity(result, issues, blockers) {
    const integrityReport = result?.integrityReport;
    if (!integrityReport) {
      issues.push({
        type: 'system-integrity',
        severity: 'warning',
        message: '缺少执行完整性报告'
      });
      return { score: 50, detail: '无integrityReport' };
    }

    let score = 100;

    if (integrityReport.trusted === false) {
      score -= 50;
      blockers.push({
        type: 'system-integrity',
        message: '执行完整性不可信（trusted=false）'
      });
    } else if (integrityReport.trusted === true) {
      score = 100;
    }

    // v6.5.32-fix5: integrityReport 可能没有 result 字段
    if (integrityReport.result?.success === false) {
      score -= 20;
    }

    if (integrityReport.summary && typeof integrityReport.summary.errorCount === 'number') {
      score -= integrityReport.summary.errorCount * 10;
    }

    score = Math.max(0, score);

    if (score < qualityConfig.dimensions.systemIntegrity.warnScore) {
      issues.push({
        type: 'system-integrity',
        severity: 'warning',
        message: `系统完整性偏低: ${score}分`
      });
    }

    return {
      score,
      detail: `trusted=${integrityReport.trusted}`
    };
  }

  applyHardBlockRules(result, shots, blockers) {
    const rules = qualityConfig.hardBlockRules;

    if (rules.requireShots && (!Array.isArray(shots) || shots.length === 0)) {
      blockers.push({
        type: 'hard-rule',
        message: '硬规则失败：必须存在镜头输出'
      });
    }

    if (rules.requirePromptText) {
      const hasEmptyPrompt = shots.some(shot => {
        const text =
          shot.render_prompt ||
          shot.renderPrompt ||
          shot.prompt ||
          shot.visualPrompt ||
          '';
        return !text.trim();
      });

      if (hasEmptyPrompt) {
        blockers.push({
          type: 'hard-rule',
          message: '硬规则失败：存在空Prompt镜头'
        });
      }
    }

    if (rules.requireSystemIntegrity) {
      if (result?.integrityReport?.trusted === false) {
        blockers.push({
          type: 'hard-rule',
          message: '硬规则失败：系统完整性未通过'
        });
      }
    }

    if (rules.requireRenderReadiness) {
      const prompts = result?.stages?.output?.prompts || [];
      const hasInvalidDuration = prompts.some(shot => {
        const duration = Number(shot.duration || 0);
        // v6.5.35-fix: 硬规则上限15秒，全局固定
        // 默认允许3-15秒
        return !(duration >= 3 && duration <= 15);
      });

      if (hasInvalidDuration) {
        blockers.push({
          type: 'hard-rule',
          message: '硬规则失败：存在非法时长镜头'
        });
      }
    }
  }
}

module.exports = {
  QualityGate
};