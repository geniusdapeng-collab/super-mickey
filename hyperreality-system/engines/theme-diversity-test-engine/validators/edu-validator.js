/**
 * EduValidator - 教育科普类型校验器
 */

const BaseValidator = require('./base-validator');

class EduValidator extends BaseValidator {
  constructor() {
    super('EDU');
  }

  _validateSpecific(input) {
    // 1. 事实校验
    if (this.config.requiresFactCheck) {
      if (!input.facts || input.facts.length === 0) {
        this.warnings.push({
          code: 'MISSING_FACTS',
          message: '教育科普内容建议提供事实依据',
          severity: 'P2'
        });
      }
    }

    // 2. 免责声明检查
    if (this.config.requiresDisclaimer) {
      if (!input.disclaimer && !input.content?.includes('仅供参考')) {
        this.warnings.push({
          code: 'MISSING_DISCLAIMER',
          message: '教育科普内容建议添加免责声明',
          severity: 'P2'
        });
      }
    }

    // 3. 伪科学检查
    const pseudoscienceKeywords = ['偏方', '秘方', '神奇疗效', '立竿见影', '百分百治愈'];
    const content = String(input.content || '');
    for (const keyword of pseudoscienceKeywords) {
      if (content.includes(keyword)) {
        this.errors.push({
          code: 'PSEUDOSCIENCE',
          message: `内容可能包含伪科学表述: ${keyword}`,
          severity: 'P1'
        });
      }
    }

    // 4. 专业性检查
    if (content.length < 50) {
      this.warnings.push({
        code: 'LOW_PROFESSIONALISM',
        message: '教育科普内容建议更详细的专业解释',
        severity: 'P3'
      });
    }
  }
}

module.exports = EduValidator;
