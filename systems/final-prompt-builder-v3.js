const { ConfigUnifier } = require('./config-unifier-v1');
const { FieldMapper } = require('./field-mapper-v1');
const { ShotSchemaValidator } = require('./shot-schema-validator-v1');
const { SubsystemOrchestratorV2 } = require('./subsystem-orchestrator-v2');
const { CreativeLLMRouter } = require('./creative-llm-router-v1');
const { NegativeFieldBuilder } = require('./negative-field-builder-v1');
const { ClosingShotEmotionalBoosterV2 } = require('./closing-shot-emotional-booster-v2');
const { PromptNormalizer } = require('./prompt-normalizer-v1');
const { PromptTrimmer } = require('./prompt-trimmer-v1');
const { PromptValidator } = require('./prompt-validator-v1');
const { ShotDebugRecorder } = require('./shot-debug-recorder-v1');

class FinalPromptBuilderV3 {
  constructor(options = {}) {
    this.config = new ConfigUnifier();
    this.maxLength = options.maxLength || this.config.getPromptMaxLength();

    this.mapper = new FieldMapper();
    this.schemaValidator = new ShotSchemaValidator({ strict: false });
    this.orchestrator = new SubsystemOrchestratorV2(options.subsystems || {});
    this.creativeRouter = new CreativeLLMRouter({
      enabled: options.llmEnabled !== false,
      model: options.llmModel || this.config.getLLMModel('kimi-k2p6'),
      timeoutMs: this.config.getLLMTimeout('creative'),
      maxRetries: this.config.getLLMMaxRetries()
    });

    this.negativeBuilder = new NegativeFieldBuilder({ maxLength: 220 });
    this.closingBooster = new ClosingShotEmotionalBoosterV2();
    this.normalizer = new PromptNormalizer({ maxLength: this.maxLength });
    this.trimmer = new PromptTrimmer({ maxLength: this.maxLength });
    this.validator = new PromptValidator({ maxLength: this.maxLength });

    this.debugRecorder = new ShotDebugRecorder({
      enabled: options.debug !== false,
      outputDir: options.debugOutputDir
    });
  }

  async build(rawShot, context = {}) {
    const shot = this.mapper.mapShot(rawShot, context);
    const shotId = shot.id || 'unknown';

    // 1. schema 校验
    const schemaCheck = this.schemaValidator.validate(shot);

    // 2. 子系统字段
    const subsystemFields = await this.orchestrator.run(shot, context);

    // 3. LLM 创作字段（优先给 opening / reveal / climax）
    const useLLM = this._shouldUseLLM(shot);
    let llmFields = {};
    if (useLLM) {
      llmFields = await this.creativeRouter.decideShotCreative(shot, context);
    }

    // 4. 合并字段
    let merged = this._mergeFields(subsystemFields, llmFields, shot);

    // 5. NEGATIVE 统一构建
    merged.NEGATIVE = this.negativeBuilder.build({
      sceneType: context.sceneType || shot.sceneType || 'nature_epic',
      hasCharacter: (shot.characters || []).length > 0,
      isRealistic: true,
      extraNegatives: context.extraNegatives || []
    });

    // 6. 结尾镜增强
    const boosted = this.closingBooster.boost(merged, shot);
    merged = boosted.fields;

    // 7. normalize
    let normalized = this.normalizer.normalize(merged);

    // 8. trim
    const trimmed = this.trimmer.trim(
      normalized.fields,
      (fields) => this.normalizer.compose(fields)
    );

    // 9. trim 后再 normalize
    normalized = this.normalizer.normalize(trimmed.fields);

    // 10. final validate
    const validation = this.validator.validate(normalized);

    // 11. debug record
    this.debugRecorder.record(shotId, {
      rawShot,
      mappedShot: shot,
      context,
      schemaCheck,
      subsystemFields,
      llmFields,
      mergedFields: merged,
      normalizedFields: normalized.fields,
      finalPrompt: normalized.prompt,
      validation,
      meta: {
        boosted: boosted.enhanced,
        trimmed: trimmed.trimmed,
        trimmedFields: trimmed.trimmedFields || [],
        usedLLM: useLLM
      }
    });

    return {
      success: validation.valid,
      prompt: normalized.prompt,
      fields: normalized.fields,
      length: normalized.length,
      schemaCheck,
      validation,
      meta: {
        boosted: boosted.enhanced,
        trimmed: trimmed.trimmed,
        trimmedFields: trimmed.trimmedFields || [],
        usedLLM: useLLM,
        subsystemFields,
        llmFields
      }
    };
  }

  async buildBatch(rawShots = [], context = {}) {
    const results = [];
    for (let i = 0; i < rawShots.length; i++) {
      const shot = rawShots[i];
      const result = await this.build(shot, {
        ...context,
        index: i,
        totalShots: rawShots.length
      });
      results.push({
        shotId: shot.id || shot.shotId || `shot_${i}`,
        ...result
      });
    }

    return {
      success: results.every(r => r.success),
      total: results.length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  _shouldUseLLM(shot) {
    const type = (shot.type || '').toLowerCase();
    return (
      type.includes('opening') ||
      type.includes('reveal') ||
      type.includes('climax') ||
      shot.isOpening ||
      (shot.tension || 0) > 80
    );
  }

  _mergeFields(subsystemFields, llmFields, shot) {
    return {
      CHARACTER: subsystemFields.CHARACTER || llmFields.CHARACTER || (shot.characters || []).join('，'),
      ACTION: subsystemFields.ACTION || llmFields.ACTION || shot.narration || shot.action || '',
      SCENE: subsystemFields.SCENE || llmFields.SCENE || shot.scene || shot.visualPrompt || '',
      MOOD: subsystemFields.MOOD || llmFields.MOOD || shot.emotionPhase || '',
      CAMERA: subsystemFields.CAMERA || llmFields.CAMERA || shot.camera || '',
      LIGHTING: subsystemFields.LIGHTING || llmFields.LIGHTING || '',
      NEGATIVE: subsystemFields.NEGATIVE || '',
      AUDIO: subsystemFields.AUDIO || llmFields.AUDIO || shot.audio || '',
      RENDER: subsystemFields.RENDER || shot.renderStyle || '电影级、超写实、细节丰富',
      DIRECTOR: subsystemFields.DIRECTOR || llmFields.DIRECTOR || ''
    };
  }
}

module.exports = { FinalPromptBuilderV3 };
