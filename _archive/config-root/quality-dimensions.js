'use strict';

module.exports = {
  dimensions: {
    promptQuality: {
      name: 'Prompt质量',
      weight: 0.20,
      passScore: 70,
      warnScore: 55
    },
    storyQuality: {
      name: '故事质量',
      weight: 0.20,
      passScore: 70,
      warnScore: 55
    },
    continuityQuality: {
      name: '连续性质量',
      weight: 0.15,
      passScore: 70,
      warnScore: 55
    },
    directorQuality: {
      name: '导演质量',
      weight: 0.20,
      passScore: 75,
      warnScore: 60
    },
    renderReadiness: {
      name: '渲染就绪度',
      weight: 0.15,
      passScore: 80,
      warnScore: 60
    },
    systemIntegrity: {
      name: '系统完整性',
      weight: 0.10,
      passScore: 90,
      warnScore: 70
    }
  },

  total: {
    passScore: 75,
    warnScore: 60
  },

  hardBlockRules: {
    requireSystemIntegrity: true,
    requireRenderReadiness: true,
    requirePromptText: true,
    requireShots: true
  }
};