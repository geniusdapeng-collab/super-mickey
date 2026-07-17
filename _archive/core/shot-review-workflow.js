/**
 * Shot Review Workflow v1.0 — 镜头评审工作流
 * 系统核心基础设施：Dailies风格的镜头评审流程
 *
 * 职责：
 * - 镜头评审：每个镜头可独立评审（通过/需要修改/重做）
 * - 评审状态机：镜头在评审流程中的状态流转
 * - 评审意见：记录评审意见（如"角色不一致"、"Prompt过短"）
 * - 批量操作：批量通过/批量拒绝
 * - 与Render Quality Loop集成：质量评分自动触发评审
 * - 与Event Bus集成：发布评审事件
 * - 与AMS集成：关联渲染输出资产
 *
 * 核心能力：
 * 1. ShotReview: 单个镜头的评审记录
 * 2. ReviewStateMachine: 评审状态机（draft → pending → approved → rejected → revised）
 * 3. ReviewComment: 评审意见
 * 4. ShotReviewWorkflow: 主工作流
 * 5. ReviewBatch: 批量评审
 *
 * 评审状态：
 * - draft: 草稿（未提交评审）
 * - pending: 待评审（已提交，等待评审）
 * - approved: 已通过（可直接使用）
 * - rejected: 已拒绝（需要重做）
 * - needs_fix: 需要修改（可修改后重新提交）
 * - revised: 已修改（修改后等待重新评审）
 *
 * 评审维度：
 * - visual_quality: 视觉质量
 * - character_consistency: 角色一致性
 * - narrative_fit: 叙事契合度
 * - camera_quality: 运镜质量
 * - prompt_quality: Prompt质量
 * - overall: 综合评分
 *
 * @version v1.0
 * @author Core Team
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、评审状态机
// ============================================================

const REVIEW_STATES = {
  draft: { name: '草稿', next: ['pending', 'approved'] },
  pending: { name: '待评审', next: ['approved', 'rejected', 'needs_fix'] },
  approved: { name: '已通过', next: [] },
  rejected: { name: '已拒绝', next: ['revised'] },
  needs_fix: { name: '需要修改', next: ['revised'] },
  revised: { name: '已修改', next: ['pending'] }
};

const REVIEW_STATE_TRANSITIONS = {
  'draft→pending': '提交评审',
  'draft→approved': '快速通过（草稿直接通过）',
  'pending→approved': '评审通过',
  'pending→rejected': '评审拒绝',
  'pending→needs_fix': '需要修改',
  'rejected→revised': '重新修改',
  'needs_fix→revised': '修改完成',
  'revised→pending': '重新提交评审'
};

// ============================================================
// 二、评审意见
// ============================================================

class ReviewComment {
  constructor({ reviewer, dimension, comment, severity, suggestion, timestamp }) {
    this.id = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.reviewer = reviewer || 'system';
    this.dimension = dimension;  // visual_quality, character_consistency, etc.
    this.comment = comment;
    this.severity = severity || 'suggestion';  // suggestion, minor, major, critical
    this.suggestion = suggestion || '';
    this.timestamp = timestamp || Date.now();
    this.resolved = false;
  }

  resolve() {
    this.resolved = true;
  }

  toJSON() {
    return {
      id: this.id,
      reviewer: this.reviewer,
      dimension: this.dimension,
      comment: this.comment,
      severity: this.severity,
      suggestion: this.suggestion,
      timestamp: this.timestamp,
      resolved: this.resolved
    };
  }
}

// ============================================================
// 三、镜头评审
// ============================================================

class ShotReview {
  constructor(shotId, options = {}) {
    this.shotId = shotId;
    this.state = options.state || 'draft';
    this.comments = [];
    this.scores = {};
    this.overallScore = 0;
    this.reviewer = options.reviewer || null;
    this.reviewedAt = null;
    this.submittedAt = options.submittedAt || Date.now();
    this.version = options.version || 1;
    this.renderOutput = options.renderOutput || null;
    this.history = [{ state: this.state, timestamp: Date.now(), action: '创建' }];
  }

  /**
   * 提交评审
   */
  submit() {
    this.transitionTo('pending');
    this.submittedAt = Date.now();
  }

  /**
   * 通过评审
   */
  approve(scores = {}, reviewer = 'system') {
    this.scores = scores;
    this.overallScore = this.calculateOverall(scores);
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('approved');
  }

  /**
   * 拒绝评审
   */
  reject(comments, reviewer = 'system') {
    this.comments = comments.map(c => c instanceof ReviewComment ? c : new ReviewComment(c));
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('rejected');
  }

  /**
   * 标记需要修改
   */
  requestFix(comments, reviewer = 'system') {
    this.comments = comments.map(c => c instanceof ReviewComment ? c : new ReviewComment(c));
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('needs_fix');
  }

  /**
   * 修改完成
   */
  markRevised() {
    this.version++;
    this.transitionTo('revised');
  }

  /**
   * 重新提交
   */
  resubmit() {
    this.transitionTo('pending');
  }

  /**
   * 状态流转
   */
  transitionTo(newState) {
    const transitionKey = `${this.state}→${newState}`;
    const transition = REVIEW_STATE_TRANSITIONS[transitionKey];
    
    if (!transition) {
      throw new Error(`非法状态流转: ${this.state} → ${newState}`);
    }

    this.state = newState;
    this.history.push({
      state: newState,
      timestamp: Date.now(),
      action: transition
    });
  }

  /**
   * 计算综合评分
   */
  calculateOverall(scores) {
    const values = Object.values(scores).filter(s => typeof s === 'number');
    if (values.length === 0) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  /**
   * 添加评论
   */
  addComment(comment) {
    this.comments.push(comment instanceof ReviewComment ? comment : new ReviewComment(comment));
  }

  /**
   * 解决评论
   */
  resolveComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolve();
    }
  }

  /**
   * 获取未解决评论
   */
  getUnresolvedComments() {
    return this.comments.filter(c => !c.resolved);
  }

  toJSON() {
    return {
      shotId: this.shotId,
      state: this.state,
      stateName: REVIEW_STATES[this.state]?.name,
      comments: this.comments.map(c => c.toJSON()),
      scores: this.scores,
      overallScore: this.overallScore,
      reviewer: this.reviewer,
      reviewedAt: this.reviewedAt,
      submittedAt: this.submittedAt,
      version: this.version,
      history: this.history
    };
  }
}

// ============================================================
// 四、镜头评审工作流
// ============================================================

class ShotReviewWorkflow {
  constructor(options = {}) {
    this.reviews = new Map();  // shotId -> ShotReview
    this.eventBus = new NirathEventBus({ name: 'review', enabled: true });
    this.autoReview = options.autoReview !== false;
    this.passThreshold = options.passThreshold || 0.7;  // 70分通过
    this.reviewHistory = [];
  }

  /**
   * 创建评审
   */
  createReview(shotId, options = {}) {
    const review = new ShotReview(shotId, options);
    this.reviews.set(shotId, review);

    this.eventBus.publish('review.created', {
      shotId,
      state: review.state
    }, { traceId: `review_${Date.now()}` });

    return review;
  }

  /**
   * 提交评审
   */
  submit(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.submit();

    this.eventBus.publish('review.submitted', { shotId }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 通过评审
   */
  approve(shotId, scores, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.approve(scores, reviewer);

    this.recordReview(shotId, 'approved', scores);
    this.eventBus.publish('review.approved', { shotId, scores }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 拒绝评审
   */
  reject(shotId, comments, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.reject(comments, reviewer);

    this.recordReview(shotId, 'rejected', null, comments);
    this.eventBus.publish('review.rejected', { shotId, comments }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 请求修改
   */
  requestFix(shotId, comments, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.requestFix(comments, reviewer);

    this.recordReview(shotId, 'needs_fix', null, comments);
    this.eventBus.publish('review.needs_fix', { shotId, comments }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 标记修改完成
   */
  markRevised(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.markRevised();
    return review;
  }

  /**
   * 重新提交
   */
  resubmit(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.resubmit();
    return review;
  }

  /**
   * 自动评审（基于质量评分）
   */
  autoReview(shotId, qualityAnalysis) {
    if (!this.autoReview) return null;

    const review = this.reviews.get(shotId);
    if (!review) return null;

    const overall = qualityAnalysis?.overall || 0;
    const scores = {};
    for (const [key, val] of Object.entries(qualityAnalysis?.scores || {})) {
      scores[key] = val.score;
    }

    if (overall >= this.passThreshold) {
      return this.approve(shotId, scores, 'auto');
    } else {
      const comments = Object.entries(qualityAnalysis?.scores || {})
        .filter(([, v]) => v.score < this.passThreshold)
        .map(([k, v]) => new ReviewComment({
          reviewer: 'auto',
          dimension: k,
          comment: `${v.name}评分过低: ${(v.score * 100).toFixed(0)}分`,
          severity: v.score < 0.5 ? 'major' : 'minor',
          suggestion: `优化${v.name}相关描述`
        }));
      return this.requestFix(shotId, comments, 'auto');
    }
  }

  /**
   * 批量通过
   */
  batchApprove(shotIds, reviewer = 'system') {
    const results = [];
    for (const shotId of shotIds) {
      try {
        const review = this.approve(shotId, {}, reviewer);
        results.push({ shotId, success: true, state: review.state });
      } catch (error) {
        results.push({ shotId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 批量拒绝
   */
  batchReject(shotIds, reason, reviewer = 'system') {
    const comment = new ReviewComment({
      reviewer,
      dimension: 'overall',
      comment: reason,
      severity: 'major'
    });

    const results = [];
    for (const shotId of shotIds) {
      try {
        const review = this.reject(shotId, [comment], reviewer);
        results.push({ shotId, success: true, state: review.state });
      } catch (error) {
        results.push({ shotId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 获取评审
   */
  getReview(shotId) {
    return this.reviews.get(shotId);
  }

  /**
   * 获取所有评审
   */
  getAllReviews() {
    return Array.from(this.reviews.values()).map(r => r.toJSON());
  }

  /**
   * 获取统计
   */
  getStats() {
    const reviews = Array.from(this.reviews.values());
    const byState = {};
    for (const review of reviews) {
      byState[review.state] = (byState[review.state] || 0) + 1;
    }

    return {
      total: reviews.length,
      byState,
      approved: byState.approved || 0,
      pending: byState.pending || 0,
      rejected: byState.rejected || 0,
      needsFix: byState.needs_fix || 0,
      averageScore: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.overallScore, 0) / reviews.length
        : 0
    };
  }

  /**
   * 记录评审历史
   */
  recordReview(shotId, action, scores, comments) {
    this.reviewHistory.push({
      timestamp: Date.now(),
      shotId,
      action,
      scores,
      commentCount: comments?.length || 0
    });
  }

  /**
   * 获取历史
   */
  getHistory() {
    return [...this.reviewHistory];
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  ShotReviewWorkflow,
  ShotReview,
  ReviewComment,
  REVIEW_STATES,

  // 快速创建
  createReviewWorkflow: (options) => new ShotReviewWorkflow(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Shot Review Workflow 集成测试 ===\n');

    const workflow = new ShotReviewWorkflow();

    // 测试1：创建评审
    console.log('--- 测试1：创建评审 ---');
    const review1 = workflow.createReview('S01', { renderOutput: { videoPath: 'video1.mp4' } });
    console.log('创建状态:', review1.state);

    // 测试2：提交并评审
    console.log('\n--- 测试2：提交并评审 ---');
    workflow.submit('S01');
    workflow.approve('S01', {
      visual_quality: 0.8,
      character_consistency: 0.9,
      overall: 0.85
    }, '导演');
    console.log('评审后状态:', review1.state);
    console.log('综合评分:', review1.overallScore);

    // 测试3：创建并拒绝
    console.log('\n--- 测试3：创建并拒绝 ---');
    const review2 = workflow.createReview('S02');
    workflow.submit('S02');
    workflow.reject('S02', [
      new ReviewComment({
        reviewer: '导演',
        dimension: 'character_consistency',
        comment: '角色服装不一致',
        severity: 'major',
        suggestion: '统一角色服装为白衣'
      })
    ], '导演');
    console.log('拒绝状态:', review2.state);
    console.log('评论数:', review2.comments.length);

    // 测试4：自动评审
    console.log('\n--- 测试4：自动评审 ---');
    const review3 = workflow.createReview('S03');
    workflow.submit('S03');
    const autoResult = workflow.autoReview('S03', {
      overall: 0.6,
      scores: {
        visual_quality: { score: 0.7, name: '视觉质量' },
        character_consistency: { score: 0.5, name: '角色一致性' }
      }
    });
    console.log('自动评审状态:', autoResult?.state);
    console.log('未解决评论:', autoResult?.getUnresolvedComments().length);

    // 测试5：统计
    console.log('\n--- 测试5：统计 ---');
    console.log(workflow.getStats());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
