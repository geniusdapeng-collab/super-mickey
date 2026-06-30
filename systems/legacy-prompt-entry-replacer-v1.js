const { PipelineIntegrationPatchV1 } = require('./pipeline-integration-patch-v1');

class LegacyPromptEntryReplacer {
  constructor(options = {}) {
    this.integration = new PipelineIntegrationPatchV1({
      debug: options.debug !== false,
      llmEnabled: options.llmEnabled !== false,
      llmModel: options.llmModel,
      debugOutputDir: options.debugOutputDir
    });
  }

  /**
   * 旧链路替换入口
   * @param {Object} rawShot
   * @param {Object} context
   * @returns {string} finalPrompt
   */
  async replace(rawShot, context = {}) {
    const result = await this.integration.buildShotPrompt(rawShot, context);

    if (!result.success) {
      const issues = [
        ...(result.issues || []),
        ...((result.validation && result.validation.issues) || [])
      ];
      throw new Error(
        `LegacyPromptEntryReplacer failed [${result.shotId || 'unknown'}]: ${issues.join('; ')}`
      );
    }

    return result.prompt;
  }

  /**
   * 批量替换
   */
  async replaceBatch(rawShots = [], context = {}) {
    const result = await this.integration.buildAllShotPrompts(rawShots, context);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      prompts: result.results.map(r => ({
        shotId: r.shotId,
        prompt: r.prompt
      })),
      summary: result.summary
    };
  }
}

module.exports = { LegacyPromptEntryReplacer };
