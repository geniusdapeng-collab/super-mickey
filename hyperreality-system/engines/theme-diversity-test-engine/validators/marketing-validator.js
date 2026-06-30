/**
 * MarketingValidator - 商业营销类型校验器
 */

const BaseValidator = require('./base-validator');

class MarketingValidator extends BaseValidator {
  constructor() {
    super('MARKETING');
  }

  _validateSpecific(input) {
    // 1. 品牌安全检查
    if (this.config.requiresBrandSafety) {
      if (!input.brand) {
        this.warnings.push({
          code: 'MISSING_BRAND',
          message: '商业营销内容建议明确品牌信息',
          severity: 'P2'
        });
      }
    }

    // 2. 广告标识检查
    if (this.config.requiresDisclaimer) {
      const content = String(input.content || '');
      const promoMarkers = ['广告', '推广', '赞助', '合作'];
      let hasMarker = false;
      for (const marker of promoMarkers) {
        if (content.includes(marker)) {
          hasMarker = true;
          break;
        }
      }
      if (!hasMarker && input.promo) {
        this.warnings.push({
          code: 'MISSING_PROMO_MARKER',
          message: '商业推广内容建议添加广告标识',
          severity: 'P1'
        });
      }
    }

    // 3. 竞品检查
    if (input.competitors) {
      this.warnings.push({
        code: 'COMPETITOR_MENTION',
        message: '内容提及竞品，建议谨慎处理',
        severity: 'P2'
      });
    }

    // 4. 夸大宣传检查
    const exaggeratedWords = ['最好', '第一', '唯一', '绝对', '完美', '万能'];
    const content = String(input.content || '');
    for (const word of exaggeratedWords) {
      if (content.includes(word)) {
        this.warnings.push({
          code: 'EXAGGERATED_CLAIM',
          message: `内容可能包含夸大宣传: ${word}`,
          severity: 'P2'
        });
      }
    }

    // 5. 促销限制
    if (input.promoCount !== undefined && input.promoCount > 3) {
      this.warnings.push({
        code: 'TOO_MANY_PROMOS',
        message: `促销信息 ${input.promoCount} 条较多，建议精简`,
        severity: 'P3'
      });
    }
  }
}

module.exports = MarketingValidator;
