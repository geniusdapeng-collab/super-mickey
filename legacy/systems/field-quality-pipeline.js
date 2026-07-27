/**
 * FieldQualityPipeline v6.7.0 — 字段质量管线
 * 串联【检查环节】+【修复环节】，支持多轮迭代
 */

const { FieldCheckAgent } = require('./field-check/field-check-agent');
const { FieldRepairAgent } = require('./field-repair/field-repair-agent');

class FieldQualityPipeline {
  constructor(options = {}) {
    this.checker = new FieldCheckAgent(options);
    this.repairer = new FieldRepairAgent(options);
    this.maxRounds = options.maxRounds || 2;
    this.log = options.log || console.log;
  }

  async run(shot, shotId = 'shot_001') {
    let currentShot = { ...shot };
    const reports = [];
    const logs = [];

    // v6.7.0-patch: 每轮运行前确保 repairer 持有最新 prd
    if (this.prd && this.repairer) {
      const { PRD } = require('./field-repair/field-repair-agent');
      this.repairer.prd = this.repairer.prd || new PRD(this.prd);
    }

    for (let roundNum = 1; roundNum <= this.maxRounds; roundNum++) {
      // 检查环节
      const report = await this.checker.check(currentShot, shotId);
      report.shot_id = `${shotId}_round${roundNum}`;
      reports.push(report);

      this.log('FIELD-QUALITY', `\n${'='.repeat(60)}`);
      this.log('FIELD-QUALITY', `第 ${roundNum} 轮检查：${report.summary()}`);

      // 如果通过，结束
      if (report.passed) {
        this.log('FIELD-QUALITY', '✅ 检查通过，管线结束');
        break;
      }

      // 如果是最后一轮，不再修复
      if (roundNum === this.maxRounds) {
        this.log('FIELD-QUALITY', `⚠️ 达到最大轮次 ${this.maxRounds}，仍有问题需人工介入`);
        break;
      }

      // 修复环节
      const { repaired: repairedShot, log } = await this.repairer.repair(currentShot, report, shotId);
      log.shot_id = `${shotId}_round${roundNum}`;
      logs.push(log);

      this.log('FIELD-QUALITY', `第 ${roundNum} 轮修复：完成 ${log.actions.length} 项修复动作`);
      for (const action of log.actions) {
        this.log('FIELD-QUALITY', `  [${action.method}] ${action.field_en}: ${action.before.slice(0, 30)}... → ${action.after.slice(0, 30)}...`);
      }

      currentShot = repairedShot;
    }

    return { finalShot: currentShot, reports, logs };
  }
}

module.exports = { FieldQualityPipeline };
