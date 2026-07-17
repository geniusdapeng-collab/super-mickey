const { ClosingShotEmotionalBoosterV2 } = require('./closing-shot-emotional-booster-v2');
const { PromptNormalizer } = require('./prompt-normalizer-v1');

class ClosingShotEmotionalBoosterBridge {
  constructor(options = {}) {
    this.booster = new ClosingShotEmotionalBoosterV2(options);
    this.normalizer = new PromptNormalizer({ maxLength: options.maxLength || 1500 });
  }

  /**
   * 推荐新用法：直接增强字段
   */
  boostFields(fields = {}, shot = {}) {
    return this.booster.boost(fields, shot);
  }

  /**
   * 兼容旧用法：如果传入整段prompt，则尽量转成字段后再增强
   */
  boostLegacy(renderResult = {}, shot = {}) {
    const rawPrompt = renderResult.prompt || '';
    const approxFields = {
      ACTION: shot.narration || shot.action || '',
      SCENE: shot.scene || shot.visualPrompt || '',
      MOOD: shot.emotionPhase || shot.mood || '',
      CAMERA: shot.camera || '',
      LIGHTING: shot.lighting?.description || '',
      DIRECTOR: ''
    };

    const boosted = this.booster.boost(approxFields, shot);
    const normalized = this.normalizer.normalize(boosted.fields);

    return {
      ...renderResult,
      prompt: normalized.prompt,
      fields: normalized.fields,
      boosted: boosted.enhanced,
      legacySourcePrompt: rawPrompt
    };
  }
}

module.exports = { ClosingShotEmotionalBoosterBridge };
