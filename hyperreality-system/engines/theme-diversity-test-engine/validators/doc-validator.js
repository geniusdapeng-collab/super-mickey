/**
 * DocValidator - 纪录片类型校验器
 */

const BaseValidator = require('./base-validator');

class DocValidator extends BaseValidator {
  constructor() {
    super('DOC');
  }

  _validateSpecific(input) {
    // 1. 时间线校验
    if (this.config.requiresFactCheck) {
      if (!input.timeline || input.timeline.length === 0) {
        this.warnings.push({
          code: 'MISSING_TIMELINE',
          message: '纪录片建议提供拍摄时间线',
          severity: 'P2'
        });
      }
    }

    // 2. 地理位置校验
    if (input.locations) {
      const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s,，.。()-]+$/;
      for (const loc of input.locations) {
        if (!validPattern.test(loc)) {
          this.warnings.push({
            code: 'SUSPICIOUS_LOCATION',
            message: `地理位置格式可疑: ${loc}`,
            severity: 'P2'
          });
        }
      }
    }

    // 3. 真实性检查
    const content = String(input.content || '');
    const fictionalKeywords = ['虚构', '假设', '如果', '假设场景'];
    for (const keyword of fictionalKeywords) {
      if (content.includes(keyword) && !input.markedAsFictional) {
        this.warnings.push({
          code: 'POSSIBLE_FICTION',
          message: `纪录片包含可能虚构的内容标记: ${keyword}，建议明确标注`,
          severity: 'P2'
        });
      }
    }
  }
}

module.exports = DocValidator;
