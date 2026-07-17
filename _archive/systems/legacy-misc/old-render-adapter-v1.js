const { MainPipelineHookExample } = require('./main-pipeline-hook-example');

class OldRenderAdapterV1 {
  constructor(options = {}) {
    this.hook = new MainPipelineHookExample({
      debug: options.debug !== false,
      llmEnabled: options.llmEnabled !== false,
      llmModel: options.llmModel,
      debugOutputDir: options.debugOutputDir
    });
  }

  /**
   * 把旧shot转换成可提交渲染的payload
   * @param {Object} rawShot
   * @param {Object} context
   * @returns {Object} renderPayload
   */
  async buildRenderPayload(rawShot, context = {}) {
    const finalPrompt = await this.hook.buildPrompt(rawShot, context);

    return {
      shotId: rawShot.id || rawShot.shotId || 'unknown',
      prompt: finalPrompt,
      duration: rawShot.duration || 5,
      aspectRatio: rawShot.aspectRatio || '16:9',
      referenceImages: context.referenceImages || [],
      metadata: {
        characters: rawShot.characters || [],
        scene: rawShot.scene || rawShot.sceneName || '',
        emotionPhase: rawShot.emotionPhase || rawShot.mood || ''
      }
    };
  }

  /**
   * 批量构建渲染payload
   */
  async buildBatchRenderPayload(rawShots = [], context = {}) {
    const payloads = [];

    for (const rawShot of rawShots) {
      const payload = await this.buildRenderPayload(rawShot, context);
      payloads.push(payload);
    }

    return payloads;
  }

  /**
   * 提供给旧渲染引擎的兼容入口
   * 假设旧引擎有 submitRender(payload)
   */
  async submitWithLegacyRenderer(legacyRenderer, rawShot, context = {}) {
    const payload = await this.buildRenderPayload(rawShot, context);
    return await legacyRenderer.submitRender(payload);
  }
}

module.exports = { OldRenderAdapterV1 };

/**
 * ===== 使用示例 =====
 *
 * const { OldRenderAdapterV1 } = require('./systems/old-render-adapter-v1');
 * const adapter = new OldRenderAdapterV1({ debug: true });
 *
 * const payload = await adapter.buildRenderPayload(rawShot, context);
 * await legacyRenderer.submitRender(payload);
 */
