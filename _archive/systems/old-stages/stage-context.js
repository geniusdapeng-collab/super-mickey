'use strict';

class StageContext {
  constructor(options = {}) {
    this.input = options.input || {};
    this.shared = options.shared || {};
    this.pipeline = options.pipeline || null;
    this.reporter = options.reporter || null;
    this.logger = options.logger || null;
    this.result = options.result || { stages: {}, errors: [] };
  }

  getStageOutput(stageId) {
    return this.result?.stages?.[stageId] || null;
  }

  setStageOutput(stageId, output) {
    if (!this.result.stages) this.result.stages = {};
    this.result.stages[stageId] = output;
    return output;
  }

  addError(error) {
    if (!this.result.errors) this.result.errors = [];
    this.result.errors.push(error);
  }

  getInput() {
    return this.input;
  }

  getShared(key, defaultValue = null) {
    if (key === undefined) return this.shared;
    return this.shared[key] !== undefined ? this.shared[key] : defaultValue;
  }

  setShared(key, value) {
    this.shared[key] = value;
    return value;
  }
}

module.exports = { StageContext };
