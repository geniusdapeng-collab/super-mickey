/**
 * VfxValidator - 极致特效类型校验器
 */

const BaseValidator = require('./base-validator');
const ThemeConfig = require('../../../config/theme-config');

class VfxValidator extends BaseValidator {
  constructor() {
    super('VFX');
  }

  _validateSpecific(input) {
    // 1. 特效白名单检查
    if (input.effectTypes) {
      const allowedEffects = ThemeConfig.getType('VFX')?.allowedEffects || [
        '粒子', '光效', '烟雾', '火焰', '爆炸', '水流', '风', '闪电'
      ];
      for (const effect of input.effectTypes) {
        if (!allowedEffects.includes(effect)) {
          this.warnings.push({
            code: 'UNALLOWED_EFFECT',
            message: `特效类型 ${effect} 不在白名单中`,
            severity: 'P2'
          });
        }
      }
    }

    // 2. 特效组合检查
    if (input.effectTypes && input.effectTypes.length > 5) {
      this.warnings.push({
        code: 'COMPLEX_EFFECT_COMBO',
        message: `特效组合 ${input.effectTypes.length} 种较复杂，注意性能`,
        severity: 'P3'
      });
    }

    // 3. 分辨率限制
    if (input.resolution) {
      const allowedResolutions = ['1080P', '2K', '4K'];
      if (!allowedResolutions.includes(input.resolution)) {
        this.warnings.push({
          code: 'HIGH_RESOLUTION_VFX',
          message: `特效场景使用 ${input.resolution} 分辨率，渲染成本较高`,
          severity: 'P3'
        });
      }
    }

    // 4. 特效数量与时长匹配
    if (input.effects !== undefined && input.duration !== undefined) {
      const effectsPerSecond = input.effects / input.duration;
      if (effectsPerSecond > 2) {
        this.warnings.push({
          code: 'DENSE_EFFECTS',
          message: `特效密度 ${effectsPerSecond.toFixed(1)}/s 较高，可能视觉混乱`,
          severity: 'P3'
        });
      }
    }

    // 5. 物理合理性检查
    const content = String(input.content || '');
    const physicsViolations = ['无视重力', '违反物理', '无限能量', '瞬间移动'];
    for (const violation of physicsViolations) {
      if (content.includes(violation)) {
        this.warnings.push({
          code: 'PHYSICS_VIOLATION',
          message: `特效描述可能违反物理规律: ${violation}`,
          severity: 'P3'
        });
      }
    }
  }
}

module.exports = VfxValidator;
