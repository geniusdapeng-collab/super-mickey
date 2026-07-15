/**
 * ArtValidator - 艺术级表达类型校验器
 */

const BaseValidator = require('./base-validator');

class ArtValidator extends BaseValidator {
  constructor() {
    super('ART');
  }

  _validateSpecific(input) {
    // 1. 风格描述检查
    if (!input.style) {
      this.warnings.push({
        code: 'MISSING_STYLE',
        message: '艺术级表达建议明确艺术风格',
        severity: 'P2'
      });
    }

    // 2. 风格强度检查
    if (input.styleIntensity !== undefined) {
      if (input.styleIntensity < 0 || input.styleIntensity > 1) {
        this.errors.push({
          code: 'INVALID_STYLE_INTENSITY',
          message: `风格强度 ${input.styleIntensity} 必须在 [0, 1] 范围内`,
          severity: 'P1'
        });
      }
    }

    // 3. 视觉描述检查
    const content = String(input.content || '');
    const visualKeywords = ['色彩', '光影', '构图', '线条', '纹理', '色调', '明暗'];
    let hasVisualDesc = false;
    for (const keyword of visualKeywords) {
      if (content.includes(keyword)) {
        hasVisualDesc = true;
        break;
      }
    }
    if (!hasVisualDesc) {
      this.warnings.push({
        code: 'MISSING_VISUAL_DESCRIPTION',
        message: '艺术级表达建议包含视觉元素描述',
        severity: 'P3'
      });
    }

    // 4. 抽象度检查
    if (input.abstraction !== undefined) {
      if (input.abstraction > 0.8) {
        this.warnings.push({
          code: 'HIGH_ABSTRACTION',
          message: '抽象度过高可能影响观众理解',
          severity: 'P3'
        });
      }
    }
  }
}

module.exports = ArtValidator;
