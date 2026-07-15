/**
 * BaseValidator - 基础校验器
 * 所有主题类型校验器的基类
 */

const ThemeConfig = require('../../../config/theme-config');

class BaseValidator {
  constructor(type) {
    this.type = type;
    this.config = ThemeConfig.getType(type);
    this.errors = [];
    this.warnings = [];
  }

  validate(input, expectations = {}) {
    this.errors = [];
    this.warnings = [];

    // 1. 基础字段校验
    this._validateBasicFields(input);

    // 2. 类型校验
    this._validateType(input);

    // 3. 资源配额校验
    this._validateResourceQuota(input);

    // 4. 内容安全校验
    this._validateContentSafety(input);

    // 5. 时长校验
    this._validateDuration(input);

    // 6. 子类特定校验
    this._validateSpecific(input);

    const valid = this.errors.length === 0;
    const result = {
      valid,
      type: this.type,
      errors: this.errors,
      warnings: this.warnings,
      rejected: this.errors.some(e => e.severity === 'P0' || e.severity === 'P1')
    };

    // 检查是否应该降级
    if (!valid && this.errors.some(e => e.code === 'RESOURCE_OVERFLOW')) {
      result.shouldDegrade = true;
      result.degradation = this._calculateDegradation(input);
    }

    return result;
  }

  _validateBasicFields(input) {
    if (!input) {
      this.errors.push({ code: 'MISSING_INPUT', message: '输入为空', severity: 'P0' });
      return;
    }

    if (!input.type) {
      this.errors.push({ code: 'MISSING_TYPE', message: '缺少类型字段', severity: 'P0' });
    }

    if (!input.content && !input.title) {
      this.warnings.push({ code: 'MINIMAL_CONTENT', message: '内容和标题都为空', severity: 'P2' });
    }
  }

  _validateType(input) {
    if (!input.type) return;

    // 类型必须是字符串
    if (typeof input.type !== 'string') {
      this.errors.push({ code: 'INVALID_TYPE_FORMAT', message: `类型必须是字符串，实际是 ${typeof input.type}`, severity: 'P1' });
      return;
    }

    // 检查是否在允许的类型列表中
    const allowedTypes = Object.keys(ThemeConfig.types || {});
    if (!allowedTypes.includes(input.type)) {
      this.errors.push({ code: 'UNKNOWN_TYPE', message: `未知类型: ${input.type}，允许的类型: ${allowedTypes.join(', ')}`, severity: 'P1' });
      return;
    }

    // 检查类型是否匹配（如果输入声明了特定类型）
    if (input.type !== this.type) {
      this.errors.push({ code: 'TYPE_MISMATCH', message: `类型不匹配: 期望 ${this.type}, 实际 ${input.type}`, severity: 'P1' });
    }
  }

  _validateResourceQuota(input) {
    if (!this.config || !this.config.resourceQuota) return;

    const quota = this.config.resourceQuota;

    // 分辨率检查
    if (input.resolution) {
      const resolutionOrder = { '720P': 1, '1080P': 2, '2K': 3, '4K': 4, '8K': 5 };
      const maxRes = resolutionOrder[quota.maxResolution] || 4;
      const reqRes = resolutionOrder[input.resolution] || 0;
      if (reqRes > maxRes) {
        this.errors.push({
          code: 'RESOURCE_OVERFLOW',
          field: 'resolution',
          message: `分辨率 ${input.resolution} 超出类型 ${this.type} 限制 (最大 ${quota.maxResolution})`,
          severity: 'P1'
        });
      }
    }

    // 特效数量检查
    if (input.effects !== undefined) {
      if (input.effects > quota.maxEffects) {
        this.errors.push({
          code: 'RESOURCE_OVERFLOW',
          field: 'effects',
          message: `特效数量 ${input.effects} 超出限制 (最大 ${quota.maxEffects})`,
          severity: 'P1'
        });
      }
    }

    // 场景数量检查
    if (input.scenes !== undefined) {
      if (input.scenes > (this.config.maxScenes || 10)) {
        this.errors.push({
          code: 'RESOURCE_OVERFLOW',
          field: 'scenes',
          message: `场景数量 ${input.scenes} 超出限制 (最大 ${this.config.maxScenes})`,
          severity: 'P1'
        });
      }
    }

    // 角色数量检查
    if (input.characters !== undefined) {
      if (typeof input.characters === 'number' && input.characters > (this.config.maxCharacters || 5)) {
        this.errors.push({
          code: 'RESOURCE_OVERFLOW',
          field: 'characters',
          message: `角色数量 ${input.characters} 超出限制 (最大 ${this.config.maxCharacters})`,
          severity: 'P1'
        });
      }
    }
  }

  _validateContentSafety(input) {
    if (!input.content) return;

    const content = String(input.content);

    // 通用违禁词检查
    const forbiddenWords = ['色情', '暴力', '恐怖', '赌博', '毒品', '诈骗'];
    for (const word of forbiddenWords) {
      if (content.includes(word)) {
        this.errors.push({
          code: 'FORBIDDEN_CONTENT',
          message: `内容包含违禁词: ${word}`,
          severity: 'P0'
        });
      }
    }

    // 类型特定敏感词
    if (this.config && this.config.promptConstraints && this.config.promptConstraints.forbidden) {
      const typeForbidden = this.config.promptConstraints.forbidden;
      for (const word of typeForbidden) {
        if (content.includes(word)) {
          this.warnings.push({
            code: 'TYPE_FORBIDDEN',
            message: `内容包含类型${this.type}的禁用词: ${word}`,
            severity: 'P2'
          });
        }
      }
    }
  }

  _validateDuration(input) {
    if (input.duration === undefined) return;

    const duration = Number(input.duration);
    if (isNaN(duration)) {
      this.errors.push({ code: 'INVALID_DURATION', message: '时长必须是数字', severity: 'P1' });
      return;
    }

    if (duration < 0) {
      this.errors.push({ code: 'NEGATIVE_DURATION', message: `时长不能为负数: ${duration}`, severity: 'P1' });
      return;
    }

    const range = this.config?.durationRange || [15, 300];
    if (duration < range[0] || duration > range[1]) {
      this.warnings.push({
        code: 'DURATION_OUT_OF_RANGE',
        message: `时长 ${duration}s 超出建议范围 [${range[0]}, ${range[1]}]`,
        severity: 'P2'
      });
    }
  }

  _calculateDegradation(input) {
    const matrix = ThemeConfig.getDegradationConfig(this.type);
    if (!matrix) return null;

    return {
      type: this.type,
      original: {
        resolution: input.resolution,
        effects: input.effects,
        scenes: input.scenes
      },
      degraded: {
        resolution: matrix.maxResolution || '2K',
        effects: Math.min(input.effects || 0, matrix.maxEffects || 0),
        scenes: Math.min(input.scenes || 1, this.config?.maxScenes || 5)
      }
    };
  }

  // 子类必须实现
  _validateSpecific(input) {
    // 默认空实现，子类覆盖
  }
}

module.exports = BaseValidator;
