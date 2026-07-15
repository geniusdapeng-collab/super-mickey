const PROMPT_LENGTH = require('./prompt-length');

module.exports = {
  prompt: {
    targetMin: PROMPT_LENGTH.TARGET_MIN,
    targetMax: PROMPT_LENGTH.TARGET_MAX,
    hardMax: PROMPT_LENGTH.HARD_MAX
  },

  memory: {
    nodeMaxOldSpaceMB: 4096,
    enableManualGC: true,
    writeSlimResultOnly: true
  },

  pipeline: {
    useLLM: true,
    skipDirectorReview: false,
    skipScreenwriterOptimization: false
  },

  report: {
    includeFullPrompts: true,
    includeTimeline: true,
    maxPromptLengthInReport: 5000
  }
};
