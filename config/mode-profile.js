'use strict';

const MODE_PROFILES = {
  nirath: {
    mode: 'nirath',
    description: '山海经 / Nirath 叙事模式',
    enabledStages: [
      'STAGE-1', 'STAGE-2', 'STAGE-3', 'STAGE-4',
      'STAGE-5', 'STAGE-6', 'STAGE-7',
      'STAGE-7.2', 'STAGE-7.3', 'STAGE-7.4', 'STAGE-7.5',
      'STAGE-8', 'STAGE-8.5',
      'STAGE-9', 'STAGE-10', 'STAGE-10.5',
      'STAGE-11', 'STAGE-11.5',
      'STAGE-12', 'STAGE-13', 'STAGE-14', 'STAGE-15',
      'STAGE-16', 'STAGE-17'
    ],
    enabledCapabilities: [
      'scriptService', 'durationService', 'storyboardService',
      'cameraService', 'renderPrepService', 'qualityGate'
    ],
    rules: {
      requirePortraits: true,
      enableDirectorReview: true,
      enableScreenwriterOptimization: true,
      enableStoryCraft: true,
      enableNirathStyle: true
    }
  },

  generic: {
    mode: 'generic',
    description: '通用视频模式',
    enabledStages: [
      'STAGE-1', 'STAGE-2', 'STAGE-3', 'STAGE-4',
      'STAGE-5', 'STAGE-6', 'STAGE-7',
      'STAGE-8', 'STAGE-9', 'STAGE-10',
      'STAGE-11', 'STAGE-12', 'STAGE-13', 'STAGE-15'
    ],
    enabledCapabilities: [
      'scriptService', 'durationService', 'storyboardService',
      'cameraService', 'renderPrepService', 'qualityGate'
    ],
    rules: {
      requirePortraits: true,
      enableDirectorReview: false,
      enableScreenwriterOptimization: false,
      enableStoryCraft: false,
      enableNirathStyle: false
    }
  }
};

function getModeProfile(mode = 'nirath') {
  return MODE_PROFILES[mode] || MODE_PROFILES.nirath;
}

module.exports = {
  MODE_PROFILES,
  getModeProfile
};
