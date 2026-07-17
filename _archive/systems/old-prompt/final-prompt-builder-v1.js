const { SubsystemOrchestrator } = require('./subsystem-orchestrator-v1');
const { CreativeLLMRouter } = require('./creative-llm-router-v1');
const { PromptNormalizer } = require('./prompt-normalizer-v1');
const { PromptValidator } = require('./prompt-validator-v1');

class FinalPromptBuilder {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 1500;

    this.orchestrator = new SubsystemOrchestrator(options.subsystems || {});
    this.creativeRouter = new CreativeLLMRouter(options.llm || {});
    this.normalizer = new PromptNormalizer({ maxLength: this.maxLength });
    this.validator = new PromptValidator({ maxLength: this.maxLength });
  }

  async build(shot, context = {}) {
    // 1. 子系统结果
    const subsystemFields = await this.orchestrator.run(shot, context);

    // 2. LLM创意字段
    const llmFields = await this.creativeRouter.decideShotCreative(shot, context);

    // 3. 合并（LLM优先补创意，子系统优先补专业模块）
    const merged = {
      ...llmFields,
      ...subsystemFields,
      CHARACTER: subsystemFields.CHARACTER || llmFields.CHARACTER,
      ACTION: subsystemFields.ACTION || llmFields.ACTION,
      SCENE: subsystemFields.SCENE || llmFields.SCENE,
      MOOD: subsystemFields.MOOD || llmFields.MOOD,
      CAMERA: subsystemFields.CAMERA || llmFields.CAMERA,
      LIGHTING: subsystemFields.LIGHTING || llmFields.LIGHTING,
      AUDIO: subsystemFields.AUDIO || llmFields.AUDIO,
      DIRECTOR: subsystemFields.DIRECTOR || llmFields.DIRECTOR
    };

    // 4. 标准化
    const normalized = this.normalizer.normalize(merged);

    // 5. 校验
    const validation = this.validator.validate(normalized);

    return {
      success: validation.valid,
      prompt: normalized.prompt,
      fields: normalized.fields,
      length: normalized.length,
      validation
    };
  }
}

module.exports = { FinalPromptBuilder };
