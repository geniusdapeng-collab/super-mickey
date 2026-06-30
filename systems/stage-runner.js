'use strict';

const { createLogger } = require('./logger');
const {
  createStageSuccess,
  createStageFailure,
  createStageSkipped
} = require('./stage-result');
const { StageExecutionError } = require('./errors');

class StageRunner {
  constructor(options = {}) {
    this.logger = options.logger || createLogger('stage-runner');
    this.reporter = options.reporter || null;
    this.result = options.result || { stages: {}, errors: [] };
    this.failFast = options.failFast !== undefined ? options.failFast : true;
  }

  async runStage(config, ctx) {
    const {
      stageId,
      title,
      progress = 0,
      detail = '',
      skip = false,
      skipReason = '',
      handler
    } = config;

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    if (this.reporter && typeof this.reporter.stage === 'function') {
      this.reporter.stage(title || stageId, progress, detail);
    }

    if (skip) {
      const skipped = createStageSkipped(stageId, skipReason, {
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: 0,
        detail
      });

      this.result.stages[stageId] = skipped;
      this.logger.warn(`Stage跳过: ${stageId}`, { reason: skipReason });
      return skipped;
    }

    this.logger.info(`Stage开始: ${stageId}`, { title, detail });

    try {
      const data = await handler(ctx);
      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      const success = createStageSuccess(stageId, data, {
        startedAt,
        endedAt,
        durationMs,
        detail
      });

      this.result.stages[stageId] = success;

      this.logger.info(`Stage完成: ${stageId}`, {
        durationMs,
        success: true
      });

      return success;
    } catch (err) {
      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;

      const failure = createStageFailure(stageId, err, {
        startedAt,
        endedAt,
        durationMs,
        detail
      });

      this.result.stages[stageId] = failure;
      if (!this.result.errors) this.result.errors = [];
      this.result.errors.push({
        stage: stageId,
        message: err.message,
        code: err.code || 'STAGE_ERROR'
      });

      this.logger.error(`Stage失败: ${stageId}`, {
        durationMs,
        error: err.message
      });

      if (this.failFast) {
        throw new StageExecutionError(`Stage执行失败: ${stageId} - ${err.message}`, {
          stage: stageId,
          details: err
        });
      }

      return failure;
    }
  }

  getResult() {
    return this.result;
  }
}

module.exports = { StageRunner };
