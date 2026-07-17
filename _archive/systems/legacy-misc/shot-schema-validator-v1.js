/**
 * Shot Schema Validator v1
 * 作用：
 * 在进入 Prompt 构建链之前，校验shot结构
 */

class ShotSchemaValidator {
  constructor(options = {}) {
    this.strict = options.strict ?? false;
  }

  validate(shot = {}) {
    const issues = [];
    const warnings = [];

    // 必填基础字段
    if (!shot.id) issues.push('shot.id 缺失');
    if (!shot.type) warnings.push('shot.type 缺失');
    if (!shot.scene && !shot.visualPrompt) issues.push('shot.scene / shot.visualPrompt 至少需要一个');
    if (!shot.narration && !shot.action) warnings.push('shot.narration 与 shot.action 都为空');
    if (!Array.isArray(shot.characters)) warnings.push('shot.characters 不是数组');
    if (shot.duration && shot.duration < 0) issues.push('shot.duration 非法');
    if (shot.tension && shot.tension > 100) warnings.push('shot.tension > 100，可能数据异常');

    // 类型检查
    if (shot.cameraMovement && typeof shot.cameraMovement !== 'object' && typeof shot.cameraMovement !== 'string') {
      warnings.push('shot.cameraMovement 类型异常');
    }

    if (shot.lighting && typeof shot.lighting !== 'object' && typeof shot.lighting !== 'string') {
      warnings.push('shot.lighting 类型异常');
    }

    // 逻辑检查
    if (shot.isOpening && shot.isEnding) {
      warnings.push('同一镜头同时 isOpening 和 isEnding');
    }

    if (!shot.sceneType) {
      warnings.push('shot.sceneType 缺失，后续会使用默认值');
    }

    return {
      valid: this.strict ? issues.length === 0 && warnings.length === 0 : issues.length === 0,
      issues,
      warnings
    };
  }

  validateBatch(shots = []) {
    const results = shots.map(shot => ({
      shotId: shot.id || shot.shotId || 'unknown',
      ...this.validate(shot)
    }));

    return {
      valid: results.every(r => r.valid),
      results,
      issueCount: results.reduce((sum, r) => sum + r.issues.length, 0),
      warningCount: results.reduce((sum, r) => sum + r.warnings.length, 0)
    };
  }
}

module.exports = { ShotSchemaValidator };
