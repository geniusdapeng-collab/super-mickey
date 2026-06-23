'use strict';

/**
 * 全局字段守门器 v1.0
 * 适配超现实系统四层架构
 * 
 * 在关键节点强制校验字段完整性，防止字段丢失和降级不透明
 */

const { standardizeShots, validateShots, markDegraded } = require('./field-standardizer');

class FieldGuard {
  constructor(options = {}) {
    this.strict = options.strict !== false;
    this.allowWarnings = options.allowWarnings !== false;
    this.logPrefix = options.logPrefix || '[FieldGuard]';
  }

  /**
   * 标准化并校验镜头数组
   * @param {Array} shots - 原始镜头数组
   * @param {string} context - 校验上下文（如 'Layer2-Production'）
   * @returns {Object} { shots, report }
   */
  normalizeAndValidate(shots = [], context = 'unknown') {
    const normalized = standardizeShots(shots);
    const report = validateShots(normalized);

    if (!report.passed && this.strict) {
      const err = new Error(
        `${this.logPrefix} ${context} validation failed: ${report.errors.join(' | ')}`
      );
      err.report = report;
      err.normalized = normalized;
      err.context = context;
      throw err;
    }

    if (report.warnings?.length > 0 && this.allowWarnings) {
      console.warn(`${this.logPrefix} ${context} warnings:\n- ${report.warnings.join('\n- ')}`);
    }

    return {
      shots: normalized,
      report
    };
  }

  /**
   * 快速校验（不抛异常，返回报告）
   */
  check(shots = [], context = 'unknown') {
    const normalized = standardizeShots(shots);
    const report = validateShots(normalized);
    
    return {
      shots: normalized,
      report,
      passed: report.passed
    };
  }

  /**
   * 标记降级并记录原因
   */
  markDegraded(shot, reason) {
    return markDegraded(shot, reason);
  }

  /**
   * 批量标记降级
   */
  markDegradedArray(shots, reason) {
    return shots.map(shot => markDegraded(shot, reason));
  }

  /**
   * 断言关键片头字段
   */
  assertOpeningFields(shots = []) {
    const openingShots = shots.filter(s => 
      s.sceneType === 'opening' || /^S00($|-|_)/.test(s.shotId || '')
    );
    
    for (const shot of openingShots) {
      if (!shot.title) {
        throw new Error(`[FieldGuard] Opening shot ${shot.shotId} missing [title]`);
      }
      if (!shot.subtitle) {
        throw new Error(`[FieldGuard] Opening shot ${shot.shotId} missing [subtitle]`);
      }
    }
    
    return true;
  }

  /**
   * 打印镜头字段摘要（用于调试和日志）
   * v2.1.4-fix9-P25: 适配25字段标准输出
   */
  printShotSummary(shots = [], context = 'unknown') {
    console.log(`\n${this.logPrefix} ${context} shot summary:`);
    for (const shot of shots) {
      // v2.1.4-fix9-P25: 统计25字段完整性
      const p0Fields = CRITICAL_FIELDS.p0;
      const p1Fields = CRITICAL_FIELDS.p1;
      const p0Present = p0Fields.filter(f => !!shot[f]).length;
      const p1Present = p1Fields.filter(f => !!shot[f]).length;
      
      // 台词统计
      const dialogueStr = typeof shot.dialogue === 'string' ? shot.dialogue : String(shot.dialogue || '');
      const dialogueCount = dialogueStr === 'NONE' || !dialogueStr ? 0 : dialogueStr.split('||').length;
      
      // 定妆照统计
      const refCount = (typeof shot.characterRef === 'string' && shot.characterRef !== 'NONE')
        ? (shot.characterRef.split('image://').length - 1)
        : 0;

      const summary = {
        shotId: shot.shotId,
        sceneType: shot.sceneType || '',
        duration: shot.duration || shot.timing?.duration || 0,
        scene: (shot.scene || '').substring(0, 40),
        character: (shot.character || 'NONE').substring(0, 30),
        p0Fields: `${p0Present}/${p0Fields.length}`,
        p1Fields: `${p1Present}/${p1Fields.length}`,
        characterRefCount: refCount,
        dialogueCount,
        promptLength: shot.promptCharCount || (typeof shot.prompt === 'string' ? shot.prompt.length : 0),
        degraded: !!shot.degraded,
        degradeReason: shot.degradeReason || ''
      };
      console.log(JSON.stringify(summary, null, 2));
    }
  }
}

module.exports = { FieldGuard };
