/**
 * 配置统一读取器 v1
 * 作用：
 * 1. 屏蔽各模块配置来源不一致的问题
 * 2. 为新链路提供统一配置入口
 * 3. 对接 config-center-v2.js，没有时自动fallback
 */

let configCenter = null;

try {
  const { getConfigCenter } = require('./config-center-v2');
  configCenter = getConfigCenter();
} catch (e) {
  configCenter = null;
}

class ConfigUnifier {
  constructor(options = {}) {
    this.options = options;
  }

  get(path, fallbackValue) {
    try {
      if (configCenter && typeof configCenter.get === 'function') {
        const value = configCenter.get(path, fallbackValue);
        return value !== undefined ? value : fallbackValue;
      }
    } catch (e) {}
    return fallbackValue;
  }

  // ===== Prompt =====
  getPromptMaxLength() {
    return this.get('prompt.maxLength', 1500);
  }

  getPromptOptimalLength() {
    return this.get('prompt.optimalLength', 1350);
  }

  getPromptMinEffectiveLength() {
    return this.get('prompt.minEffectiveLength', 600);
  }

  // ===== Duration =====
  getMinShotDuration() {
    return this.get('duration.minShotDuration', 3);
  }

  getMaxShotDuration() {
    return this.get('duration.maxShotDuration', 15);
  }

  // ===== LLM =====
  getLLMTimeout(agentType = 'default') {
    const agentMap = {
      director: this.get('llm.timeoutMs', 180000),
      creative: this.get('llm.timeoutMs', 120000),
      short: 60000,
      default: this.get('llm.timeoutMs', 120000)
    };
    return agentMap[agentType] || agentMap.default;
  }

  getLLMMaxRetries() {
    return this.get('llm.maxRetries', 1);
  }

  getLLMModel(defaultModel = 'kimi-k2p6') {
    return this.get('llm.defaultModel', defaultModel);
  }

  // ===== Render =====
  getRenderEndpoint() {
    return this.get('render.endpoint', '');
  }

  // ===== Global constraints =====
  getGlobalNegativePrompts() {
    return this.get('constraints.globalNegativePrompts', []);
  }

  isStrictMode() {
    return this.get('pipeline.strictMode', false);
  }

  exportSummary() {
    return {
      promptMaxLength: this.getPromptMaxLength(),
      promptOptimalLength: this.getPromptOptimalLength(),
      minShotDuration: this.getMinShotDuration(),
      maxShotDuration: this.getMaxShotDuration(),
      llmTimeout: this.getLLMTimeout(),
      llmMaxRetries: this.getLLMMaxRetries(),
      strictMode: this.isStrictMode()
    };
  }
}

module.exports = { ConfigUnifier };
