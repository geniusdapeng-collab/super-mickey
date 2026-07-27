/**
 * CineValidator - 电影级叙事类型校验器
 */

const BaseValidator = require('./base-validator');

class CineValidator extends BaseValidator {
  constructor() {
    super('CINE');
  }

  _validateSpecific(input) {
    // 1. 场景数量检查
    if (input.scenes !== undefined) {
      if (input.scenes < 3) {
        this.warnings.push({
          code: 'TOO_FEW_SCENES',
          message: `电影级叙事场景数 ${input.scenes} 较少，建议至少3幕`,
          severity: 'P3'
        });
      }
    }

    // 2. 情绪归一化检查
    if (input.emotion) {
      const validEmotions = ['happy', 'sad', 'angry', 'fear', 'surprise', 'disgust', 'neutral', 'excited', 'tense'];
      if (!validEmotions.includes(input.emotion)) {
        this.warnings.push({
          code: 'UNKNOWN_EMOTION',
          message: `未知情绪标签: ${input.emotion}`,
          severity: 'P3'
        });
      }
    }

    // 3. 结构有效性检查
    if (input.structure) {
      const validStructures = ['三幕式', '五幕式', '英雄之旅', '线性', '非线性'];
      if (!validStructures.includes(input.structure)) {
        this.warnings.push({
          code: 'UNKNOWN_STRUCTURE',
          message: `未知叙事结构: ${input.structure}`,
          severity: 'P3'
        });
      }
    }

    // 4. 角色一致性检查
    if (input.characters && typeof input.characters === 'number' && input.characters > 10) {
      this.warnings.push({
        code: 'TOO_MANY_CHARACTERS',
        message: `角色数量 ${input.characters} 较多，注意角色区分度`,
        severity: 'P3'
      });
    }

    // 5. 时长合理性
    if (input.duration !== undefined && input.duration < 60) {
      this.warnings.push({
        code: 'SHORT_DURATION',
        message: `电影级叙事时长 ${input.duration}s 较短，建议至少60秒`,
        severity: 'P3'
      });
    }
  }
}

module.exports = CineValidator;
