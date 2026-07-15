/**
 * Shanhaijing MicroMotion System v1.0-Peng — 主入口
 * 为山海经系列定制的微动作增强系统
 * 编排5路Agent流水线
 */

const { FaceSculptorAgent } = require('../agents/face-sculptor');
const { BodyLanguageAgent } = require('../agents/body-language');
const { EyeDirectorAgent } = require('../agents/eye-director');
const { BreathEngineAgent } = require('../agents/breath-engine');
const { MergeAgent } = require('../agents/merge');

class ShanhaijingMicroMotionSystem {
  constructor(options = {}) {
    this.faceSculptor = new FaceSculptorAgent();
    this.bodyLanguage = new BodyLanguageAgent();
    this.eyeDirector = new EyeDirectorAgent();
    this.breathEngine = new BreathEngineAgent();
    this.mergeAgent = new MergeAgent();

    this.outputDir = options.outputDir || './output/shanhaijing-micromotion';
    this.debug = options.debug || false;
  }

  enhance(shot, context = {}) {
    if (this.debug) console.log(`[SHJ-MicroMotion] 增强镜头: ${shot.shotId}`);

    const faceEnhancement = this.faceSculptor.enhance(shot, context);
    const bodyEnhancement = this.bodyLanguage.enhance(shot, context);
    const eyeEnhancement = this.eyeDirector.enhance(shot, context);
    const breathEnhancement = this.breathEngine.enhance(shot, context);

    const enhancements = {
      face: faceEnhancement,
      body: bodyEnhancement,
      eye: eyeEnhancement,
      breath: breathEnhancement
    };

    const merged = this.mergeAgent.merge(shot, enhancements);

    return {
      shotId: shot.shotId,
      original: shot.originalPrompt || '',
      enhanced: merged.enhanced,
      agents: merged.enhancementSummary,
      specialEffects: merged.specialEffects
    };
  }

  enhanceBatch(shots, context = {}) {
    const results = [];
    for (const shot of shots) {
      try {
        results.push(this.enhance(shot, context));
      } catch (e) {
        console.error(`[SHJ-MicroMotion] ${shot.shotId} 失败:`, e.message);
        results.push({ shotId: shot.shotId, original: shot.originalPrompt || '', enhanced: shot.originalPrompt || '', error: e.message });
      }
    }
    return { results };
  }
}

module.exports = { ShanhaijingMicroMotionSystem };
