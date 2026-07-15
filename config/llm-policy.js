'use strict';

module.exports = {
  defaultProvider: 'kimi',
  timeoutMs: 240000,
  retry: {
    maxAttempts: 3,
    backoffMs: 2000
  },
  maxTokens: {
    default: 4096,
    stage1: 8192,
    director: 16000,
    screenwriter: 16000,
    storycraft: 32000
  },
  temperature: {
    default: 1.0,
    stable: 0.4
  }
};
