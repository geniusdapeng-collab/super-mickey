/**
 * FamilyValidator - 家庭聚会类型校验器
 */

const BaseValidator = require('./base-validator');

class FamilyValidator extends BaseValidator {
  constructor() {
    super('FAMILY');
  }

  _validateSpecific(input) {
    // 1. 照片数量限制
    if (input.photoCount !== undefined && input.photoCount > 50) {
      this.warnings.push({
        code: 'TOO_MANY_PHOTOS',
        message: `家庭聚会照片数量 ${input.photoCount} 较多，建议精选`,
        severity: 'P3'
      });
    }

    // 2. 关系深度检查
    if (input.relations) {
      const requiredRelations = ['爷爷', '奶奶', '爸爸', '妈妈', '外公', '外婆'];
      const content = String(input.content || '');
      let hasElder = false;
      for (const relation of requiredRelations) {
        if (content.includes(relation)) {
          hasElder = true;
          break;
        }
      }
      if (!hasElder && input.relations.length > 0) {
        this.warnings.push({
          code: 'MISSING_ELDER',
          message: '家庭聚会场景建议包含长辈角色',
          severity: 'P3'
        });
      }
    }

    // 3. 人脸数量检查
    if (input.faceCount !== undefined && input.faceCount > 20) {
      this.errors.push({
        code: 'TOO_MANY_FACES',
        message: `人脸数量 ${input.faceCount} 超出处理能力`,
        severity: 'P1'
      });
    }

    // 4. 隐私检查
    const privacyKeywords = ['住址', '电话', '身份证号', '银行卡'];
    const content = String(input.content || '');
    for (const keyword of privacyKeywords) {
      if (content.includes(keyword)) {
        this.errors.push({
          code: 'PRIVACY_LEAK',
          message: `内容可能泄露隐私: ${keyword}`,
          severity: 'P0'
        });
      }
    }
  }
}

module.exports = FamilyValidator;
