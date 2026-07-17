'use strict';

function createStageSuccess(stageId, data, meta = {}) {
  return {
    stageId,
    success: true,
    skipped: false,
    data,
    error: null,
    startedAt: meta.startedAt || null,
    endedAt: meta.endedAt || null,
    durationMs: meta.durationMs || 0,
    detail: meta.detail || '',
    metrics: meta.metrics || {}
  };
}

function createStageFailure(stageId, error, meta = {}) {
  return {
    stageId,
    success: false,
    skipped: false,
    data: null,
    error: {
      message: error?.message || String(error),
      code: error?.code || 'STAGE_ERROR',
      stage: error?.stage || stageId
    },
    startedAt: meta.startedAt || null,
    endedAt: meta.endedAt || null,
    durationMs: meta.durationMs || 0,
    detail: meta.detail || '',
    metrics: meta.metrics || {}
  };
}

function createStageSkipped(stageId, reason, meta = {}) {
  return {
    stageId,
    success: true,
    skipped: true,
    data: null,
    error: null,
    startedAt: meta.startedAt || null,
    endedAt: meta.endedAt || null,
    durationMs: meta.durationMs || 0,
    detail: reason || '',
    metrics: meta.metrics || {}
  };
}

module.exports = {
  createStageSuccess,
  createStageFailure,
  createStageSkipped
};
