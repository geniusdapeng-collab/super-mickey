const { ConfigUnifier } = require('./deprecated/config-unifier-v1');
const { FieldMapper } = require('./deprecated/field-mapper-v1');
const { ShotSchemaValidator } = require('./deprecated/shot-schema-validator-v1');
const { SubsystemOrchestratorV2 } = require('./deprecated/subsystem-orchestrator-v2');
const { CreativeLLMRouter } = require('./deprecated/creative-llm-router-v1');
const { NegativeFieldBuilder } = require('./deprecated/negative-field-builder-v1');
const { ClosingShotEmotionalBoosterV2 } = require('./closing-shot-emotional-booster-v2');
const { PromptNormalizer } = require('./deprecated/prompt-normalizer-v1');
const { PromptTrimmer } = require('./deprecated/prompt-trimmer-v1');
const { PromptValidator } = require('./deprecated/prompt-validator-v1');
const { ShotDebugRecorder } = require('./deprecated/shot-debug-recorder-v1');

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
    // 【v2.1.4-fix10-P25-fix5】25 字段全集：LLM 优先 → 子系统 → shot 原始数据 → 默认
    const pick = (key, ...fallbackPaths) => {
      if (llmFields[key]) return llmFields[key];
      if (subsystemFields[key]) return subsystemFields[key];
      for (const p of fallbackPaths) {
        const v = p.split('.').reduce((o, k) => o?.[k], shot);
        if (v) return v;
      }
      return '';
    };

    return {
      // 旧 10 维度（保持兼容）
      CHARACTER: pick('CHARACTER', 'characters', 'character.name'),
      ACTION: pick('ACTION', 'action', 'narration'),
      SCENE: pick('SCENE', 'scene', 'visualPrompt'),
      MOOD: pick('MOOD', 'emotionPhase', 'mood'),
      CAMERA: pick('CAMERA', 'camera', 'cameraMovement'),
      LIGHTING: pick('LIGHTING', 'lighting'),
      NEGATIVE: subsystemFields.NEGATIVE || llmFields.NEGATIVE || '',
      AUDIO: pick('AUDIO', 'audio'),
      RENDER: pick('RENDER', 'renderStyle') || '电影级、超写实、细节丰富',
      DIRECTOR: pick('DIRECTOR'),
      // 🆕 新增 15 字段（与 PromptFusion 25 字段对齐）
      DIALOGUE: pick('DIALOGUE', 'dialogue', 'dialogue.lines'),
      TIMELINE: pick('TIMELINE', 'timeline'),
      COSTUME: pick('COSTUME', 'costume'),
      MAKEUP: pick('MAKEUP', 'makeup'),
      PROPS: pick('PROPS', 'props'),
      PORTRAITS: pick('PORTRAITS', 'portraits', 'characterRef'),
      DEPTH_OF_FIELD: pick('DEPTH_OF_FIELD', 'depth_of_field'),
      COLOR_PALETTE: pick('COLOR_PALETTE', 'color_palette'),
      PACING: pick('PACING', 'pacing'),
      TRANSITION: pick('TRANSITION', 'transition'),
      BRIGHT_CONSTRAINT: pick('BRIGHT_CONSTRAINT', 'bright_constraint') || '保持画面明亮清晰',
      CHARACTER_CONSTRAINT: pick('CHARACTER_CONSTRAINT', 'character_constraint') || '保持角色跨镜头一致',
      CONSISTENCY: pick('CONSISTENCY', 'consistency') || '与前后镜头保持连续',
      DIRECTOR_INSTRUCTION: pick('DIRECTOR_INSTRUCTION', 'director_instruction') || pick('DIRECTOR')
    };
  }
}

module.exports = { FinalPromptBuilderV3 };
