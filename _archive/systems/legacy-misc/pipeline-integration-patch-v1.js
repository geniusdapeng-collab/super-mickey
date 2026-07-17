const { FieldMapper } = require('./field-mapper-v1');
const { ShotSchemaValidator } = require('./shot-schema-validator-v1');
const { FinalPromptBuilderV2 } = require('./final-prompt-builder-v2');
const { ConfigUnifier } = require('./config-unifier-v1');

class PipelineIntegrationPatchV1 {
  constructor(options = {}) {
    this.config = new ConfigUnifier();
    this.mapper = new FieldMapper();
    this.validator = new ShotSchemaValidator({ strict: false });

    this.promptBuilder = new FinalPromptBuilderV2({
      maxLength: this.config.getPromptMaxLength(),
      debug: options.debug !== false,
      debugOutputDir: options.debugOutputDir,
      llm: {
        enabled: options.llmEnabled !== false,
        model: options.llmModel || this.config.getLLMModel('kimi-k2p6'),
        timeoutMs: this.config.getLLMTimeout('creative'),
        maxRetries: this.config.getLLMMaxRetries()
      }
    });
  }

  /**
   * 生成单镜头最终Prompt
   */
  async buildShotPrompt(rawShot, context = {}) {
    const shot = this.mapper.mapShot(rawShot, context);
    const validation = this.validator.validate(shot);

    if (!validation.valid) {
      return {
        success: false,
        shotId: shot.id,
        error: 'shot-schema-invalid',
        issues: validation.issues,
        warnings: validation.warnings,
        shot
      };
    }

    const result = await this.promptBuilder.build(shot, context);

    return {
      success: result.success,
      shotId: shot.id,
      prompt: result.prompt,
      fields: result.fields,
      length: result.length,
      validation: result.validation,
      warnings: validation.warnings,
      meta: result.meta
    };
  }

  /**
   * 批量生成所有镜头Prompt
   */
  async buildAllShotPrompts(rawShots = [], context = {}) {
    const mappedShots = this.mapper.mapShots(rawShots, context);
    const batchValidation = this.validator.validateBatch(mappedShots);

    const results = [];
    for (const shot of mappedShots) {
      const result = await this.promptBuilder.build(shot, {
        ...context,
        totalShots: mappedShots.length
      });

      results.push({
        shotId: shot.id,
        success: result.success,
        prompt: result.prompt,
        fields: result.fields,
        length: result.length,
        validation: result.validation,
        meta: result.meta
      });
    }

    return {
      success: results.every(r => r.success),
      summary: {
        totalShots: mappedShots.length,
        schemaIssues: batchValidation.issueCount,
        schemaWarnings: batchValidation.warningCount,
        promptFailures: results.filter(r => !r.success).length
      },
      results
    };
  }

  /**
   * 一个方便你在旧pipeline里直接替换的入口
   */
  async patchLegacyGenerate(rawShot, context = {}) {
    const result = await this.buildShotPrompt(rawShot, context);

    if (!result.success) {
      throw new Error(
        `Prompt生成失败 [${result.shotId}] : ${[
          ...(result.issues || []),
          ...((result.validation && result.validation.issues) || [])
        ].join('; ')}`
      );
    }

    return result.prompt;
  }
}

module.exports = { PipelineIntegrationPatchV1 };
