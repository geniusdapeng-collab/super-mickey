const { PipelineIntegrationPatchV1 } = require('./pipeline-integration-patch-v1');
const { SystemHealthCheck } = require('./system-health-check-v1');

class MainPipelineHookExample {
  constructor(options = {}) {
    this.debug = options.debug !== false;
    this.integration = new PipelineIntegrationPatchV1({
      debug: this.debug,
      debugOutputDir: options.debugOutputDir,
      llmEnabled: options.llmEnabled !== false,
      llmModel: options.llmModel
    });
  }

  /**
   * 建议在主pipeline启动时先跑一次
   */
  runHealthCheck() {
    const checker = new SystemHealthCheck();
    const report = checker.run();

    if (!report.ok) {
      console.warn('[MainPipelineHook] ⚠️ 系统健康检查未完全通过');
      console.warn(report.errors);
    } else {
      console.log('[MainPipelineHook] ✅ 系统健康检查通过');
    }

    return report;
  }

  /**
   * 单镜头入口：给旧主流程直接调用
   */
  async buildPrompt(rawShot, context = {}) {
    const result = await this.integration.buildShotPrompt(rawShot, context);

    if (!result.success) {
      const issues = [
        ...(result.issues || []),
        ...(result.validation?.issues || [])
      ];
      throw new Error(`buildPrompt failed [${result.shotId}]: ${issues.join('; ')}`);
    }

    if (this.debug) {
      console.log(
        `[MainPipelineHook] 🎬 ${result.shotId} | len=${result.length} | valid=${result.validation?.valid}`
      );
    }

    return result.prompt;
  }

  /**
   * 批量镜头入口：整集/整段处理
   */
  async buildAllPrompts(rawShots = [], context = {}) {
    const result = await this.integration.buildAllShotPrompts(rawShots, context);

    if (this.debug) {
      console.log('[MainPipelineHook] batch summary:', result.summary);
    }

    return result;
  }
}

module.exports = { MainPipelineHookExample };

/**
 * ===== 使用方式示例 =====
 *
 * const { MainPipelineHookExample } = require('./systems/main-pipeline-hook-example');
 * const hook = new MainPipelineHookExample({ debug: true, llmEnabled: true });
 *
 * hook.runHealthCheck();
 *
 * // 单镜头
 * const finalPrompt = await hook.buildPrompt(rawShot, context);
 *
 * // 批量
 * const batch = await hook.buildAllPrompts(rawShots, context);
 */
