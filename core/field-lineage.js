/**
 * Field Lineage Tracker v1.0 — 字段血缘追踪
 * 系统核心基础设施：自动检测"谁在不该改的时候改了字段"
 *
 * 职责：
 * - 字段级追踪：每个字段的修改历史（哪个Stage、什么时候、改了多少）
 * - 异常检测：检测字段被异常Stage修改（如Stage 7被Stage 9覆盖）
 * - 审计报告：每个traceId的字段变更报告
 * - 与Event Bus集成：发布异常检测事件
 * - 与Saga编排器集成：提供补偿数据
 *
 * 核心能力：
 * 1. 记录字段修改历史（stage, timestamp, sizeDelta）
 * 2. 检测越权修改（非所有者修改字段）
 * 3. 追踪Prompt瘦身（哪个字段被裁剪了多少）
 * 4. 生成审计报告（JSON/Table）
 *
 * @version v1.0
 * @author Core Team
 * @priority P0 - 数据完整性
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、字段所有权定义（哪个字段应该由哪个Stage修改）
// ============================================================

const FIELD_OWNERSHIP = {
  // 剧本阶段
  'narration': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-7.3', 'STAGE-17'] },
  'narrationDuration': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-7.4'] },
  'scene': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-17'] },
  'sceneName': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-17'] },
  'beatName': { owner: 'STAGE-5', allowed: ['STAGE-5'] },
  'type': { owner: 'STAGE-5', allowed: ['STAGE-5'] },

  // 角色阶段
  'characters': { owner: 'STAGE-4', allowed: ['STAGE-4', 'STAGE-5', 'STAGE-17'] },
  'characterRoles': { owner: 'STAGE-4', allowed: ['STAGE-4', 'STAGE-5'] },

  // 视觉阶段
  'visualPrompt': { owner: 'STAGE-7', allowed: ['STAGE-7', 'STAGE-14', 'STAGE-15'] },
  'prompt': { owner: 'STAGE-7', allowed: ['STAGE-7', 'STAGE-14', 'STAGE-15'] },
  'visualPromptValidated': { owner: 'STAGE-8', allowed: ['STAGE-8'] },

  // 运镜阶段
  'cameraMovement': { owner: 'STAGE-9', allowed: ['STAGE-9'] },
  'cameraMovement.type': { owner: 'STAGE-9', allowed: ['STAGE-9'] },
  'cameraMovement.direction': { owner: 'STAGE-9', allowed: ['STAGE-9'] },

  // 时长阶段
  'duration': { owner: 'STAGE-6', allowed: ['STAGE-6', 'STAGE-7.4'] },
  'shotDuration': { owner: 'STAGE-6', allowed: ['STAGE-6', 'STAGE-7.4'] },
  'targetDuration': { owner: 'STAGE-6', allowed: ['STAGE-6'] },

  // 情绪阶段
  'emotionPhase': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-7.2'] },
  'emotionalIntensity': { owner: 'STAGE-5', allowed: ['STAGE-5', 'STAGE-7.2'] },

  // 渲染输出
  'renderOutput': { owner: 'STAGE-11', allowed: ['STAGE-11'] },
  'renderOutput.videoPath': { owner: 'STAGE-11', allowed: ['STAGE-11'] },
  'renderOutput.frameCount': { owner: 'STAGE-11', allowed: ['STAGE-11'] },
  'renderOutput.qualityScore': { owner: 'STAGE-11', allowed: ['STAGE-11'] },

  // 导演阶段
  'directorScore': { owner: 'STAGE-16', allowed: ['STAGE-16'] },
  'directorNotes': { owner: 'STAGE-16', allowed: ['STAGE-16'] },

  // 质量评分
  'qualityScore': { owner: 'STAGE-16', allowed: ['STAGE-16', 'STAGE-8'] },

  // PromptForge Director 字段
  'cameraDesign': { owner: 'STAGE-2b', allowed: ['STAGE-2b', 'STAGE-3'] },
  'lightingDesign': { owner: 'STAGE-2b', allowed: ['STAGE-2b', 'STAGE-3'] },
  'visualElements': { owner: 'STAGE-2b', allowed: ['STAGE-2b', 'STAGE-3'] },
  'performance': { owner: 'STAGE-2b', allowed: ['STAGE-2b', 'STAGE-3'] },
  'promptEnhancement': { owner: 'STAGE-2b', allowed: ['STAGE-2b', 'STAGE-3'] },
  'finalPrompt': { owner: 'STAGE-3', allowed: ['STAGE-3', 'STAGE-qa'] },
  'creativePart': { owner: 'STAGE-3', allowed: ['STAGE-3'] },
  'dialogue': { owner: 'STAGE-2a', allowed: ['STAGE-2a', 'STAGE-3'] },
  'dialogueDepth': { owner: 'STAGE-2a', allowed: ['STAGE-2a', 'STAGE-3'] },
  'emotionArc': { owner: 'STAGE-1', allowed: ['STAGE-1', 'STAGE-2a', 'STAGE-2b', 'STAGE-3'] },
  'coreTheme': { owner: 'STAGE-1', allowed: ['STAGE-1'] },
  'directorStyle': { owner: 'STAGE-1', allowed: ['STAGE-1'] },
  'visualTone': { owner: 'STAGE-1', allowed: ['STAGE-1'] },
  'narrativeStrategy': { owner: 'STAGE-1', allowed: ['STAGE-1'] }
};

// ============================================================
// 二、字段血缘追踪器
// ============================================================

class FieldLineageTracker {
  constructor(options = {}) {
    this.lineage = new Map(); // traceId -> Map(field -> Array<change>)
    this.eventBus = options.emitEvents !== false ? new NirathEventBus({ name: 'lineage', enabled: true }) : null;
    this.emitEvents = options.emitEvents !== false;
    this.anomalyThreshold = options.anomalyThreshold || 5; // 5次异常后警告
  }

  /**
   * 记录字段变更
   */
  record(traceId, { stageId, shotId, field, previousValue, newValue, metadata = {} }) {
    if (!this.lineage.has(traceId)) {
      this.lineage.set(traceId, new Map());
    }

    const traceData = this.lineage.get(traceId);
    if (!traceData.has(field)) {
      traceData.set(field, []);
    }

    const change = {
      timestamp: Date.now(),
      stageId,
      shotId: shotId || null,
      previousHash: this.hashValue(previousValue),
      newHash: this.hashValue(newValue),
      sizeDelta: this.calculateSizeDelta(previousValue, newValue),
      metadata
    };

    traceData.get(field).push(change);

    // 检测异常
    this.detectAnomaly(traceId, stageId, field, change);

    return change;
  }

  /**
   * 记录批量变更（从mutations）
   */
  recordMutations(traceId, stageId, mutations, shotId) {
    for (const mutation of mutations) {
      this.record(traceId, {
        stageId,
        shotId: mutation.shotId || shotId,
        field: mutation.field,
        previousValue: mutation.previousValue,
        newValue: mutation.newValue
      });
    }
  }

  /**
   * 检测异常变更
   */
  detectAnomaly(traceId, stageId, field, change) {
    const ownership = FIELD_OWNERSHIP[field];
    if (!ownership) return; // 未定义所有权的字段不检查

    // 检查是否被非授权Stage修改
    if (!ownership.allowed.includes(stageId)) {
      const anomalies = this.getAnomalies(traceId);
      const fieldAnomalies = anomalies.filter(a => a.field === field && a.stageId === stageId);

      const severity = fieldAnomalies.length > this.anomalyThreshold ? 'warning' : 'info';

      const anomaly = {
        timestamp: Date.now(),
        traceId,
        stageId,
        field,
        severity,
        message: `字段 ${field}（所有者: ${ownership.owner}）被 ${stageId} 越权修改`,
        sizeDelta: change.sizeDelta,
        count: fieldAnomalies.length + 1
      };

      // 记录到变更历史中
      const traceData = this.lineage.get(traceId);
      if (!traceData.has('_anomalies')) {
        traceData.set('_anomalies', []);
      }
      traceData.get('_anomalies').push(anomaly);

      // 发布事件
      if (this.emitEvents) {
        this.eventBus.publish('data.anomaly', anomaly, { traceId });
      }

      if (severity === 'warning') {
        console.warn(`[Lineage] ⚠️ 严重越权: ${anomaly.message} (已发生${anomaly.count}次)`);
      } else {
        console.log(`[Lineage] ℹ️ 越权检测: ${anomaly.message}`);
      }
    }
  }

  /**
   * 获取字段历史
   */
  getFieldHistory(traceId, field) {
    const traceData = this.lineage.get(traceId);
    if (!traceData) return [];
    return traceData.get(field) || [];
  }

  /**
   * 获取所有字段历史
   */
  getAllFields(traceId) {
    const traceData = this.lineage.get(traceId);
    if (!traceData) return {};

    const result = {};
    for (const [field, changes] of traceData) {
      if (!field.startsWith('_')) {
        result[field] = changes;
      }
    }
    return result;
  }

  /**
   * 获取异常列表
   */
  getAnomalies(traceId) {
    const traceData = this.lineage.get(traceId);
    if (!traceData) return [];
    return traceData.get('_anomalies') || [];
  }

  /**
   * 生成审计报告
   */
  generateAuditReport(traceId) {
    const fields = this.getAllFields(traceId);
    const anomalies = this.getAnomalies(traceId);

    const report = {
      traceId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalFields: Object.keys(fields).length,
        totalChanges: Object.values(fields).reduce((sum, changes) => sum + changes.length, 0),
        totalAnomalies: anomalies.length,
        criticalAnomalies: anomalies.filter(a => a.severity === 'warning').length
      },
      fieldDetails: {},
      anomalies: anomalies.slice(-20), // 最近20个
      suspiciousStages: this.identifySuspiciousStages(traceId)
    };

    for (const [field, changes] of Object.entries(fields)) {
      const ownership = FIELD_OWNERSHIP[field];
      const fieldAnomalies = anomalies.filter(a => a.field === field);

      report.fieldDetails[field] = {
        owner: ownership?.owner || 'unknown',
        allowedStages: ownership?.allowed || [],
        changeCount: changes.length,
        lastModified: changes.length > 0 ? changes[changes.length - 1].timestamp : null,
        lastModifiedBy: changes.length > 0 ? changes[changes.length - 1].stageId : null,
        totalSizeDelta: changes.reduce((sum, c) => sum + c.sizeDelta, 0),
        anomalyCount: fieldAnomalies.length
      };
    }

    return report;
  }

  /**
   * 识别可疑Stage
   */
  identifySuspiciousStages(traceId) {
    const anomalies = this.getAnomalies(traceId);
    const stageStats = {};

    for (const anomaly of anomalies) {
      if (!stageStats[anomaly.stageId]) {
        stageStats[anomaly.stageId] = { count: 0, fields: new Set(), totalSizeDelta: 0 };
      }
      stageStats[anomaly.stageId].count++;
      stageStats[anomaly.stageId].fields.add(anomaly.field);
      stageStats[anomaly.stageId].totalSizeDelta += anomaly.sizeDelta;
    }

    return Object.entries(stageStats)
      .map(([stageId, stats]) => ({
        stageId,
        anomalyCount: stats.count,
        fieldsAffected: Array.from(stats.fields),
        totalSizeDelta: stats.totalSizeDelta
      }))
      .sort((a, b) => b.anomalyCount - a.anomalyCount);
  }

  /**
   * 追踪Prompt瘦身（哪个字段被裁剪了多少）
   */
  trackPromptTrimming(traceId, shotId, stageId, previousPrompt, newPrompt) {
    const prevLen = previousPrompt ? previousPrompt.length : 0;
    const newLen = newPrompt ? newPrompt.length : 0;
    const delta = newLen - prevLen;

    return this.record(traceId, {
      stageId,
      shotId,
      field: 'visualPrompt',
      previousValue: previousPrompt,
      newValue: newPrompt,
      metadata: { action: 'trim', delta }
    });
  }

  /**
   * 导出为表格（用于飞书文档）
   */
  exportToTable(traceId) {
    const fields = this.getAllFields(traceId);
    const rows = [];

    for (const [field, changes] of Object.entries(fields)) {
      for (const change of changes) {
        rows.push({
          字段: field,
          修改者: change.stageId,
          镜头: change.shotId || '-',
          时间: new Date(change.timestamp).toLocaleString('zh-CN'),
          大小变化: change.sizeDelta > 0 ? `+${change.sizeDelta}` : `${change.sizeDelta}`,
          前Hash: change.previousHash.substring(0, 8),
          后Hash: change.newHash.substring(0, 8)
        });
      }
    }

    return rows;
  }

  hashValue(value) {
    if (value === null || value === undefined) return 'null';
    const str = JSON.stringify(value);
    return str.length > 50 ? `${str.substring(0, 20)}...(${str.length})` : str;
  }

  calculateSizeDelta(prev, next) {
    const prevSize = prev ? JSON.stringify(prev).length : 0;
    const nextSize = next ? JSON.stringify(next).length : 0;
    return nextSize - prevSize;
  }

  clear(traceId) {
    this.lineage.delete(traceId);
  }

  getStats() {
    return {
      totalTraces: this.lineage.size,
      totalFields: Array.from(this.lineage.values()).reduce((sum, map) => sum + map.size, 0)
    };
  }
}

// ============================================================
// 三、导出
// ============================================================

module.exports = {
  FieldLineageTracker,
  FIELD_OWNERSHIP,

  // 快速创建
  createLineageTracker: (options) => new FieldLineageTracker(options)
};

// ============================================================
// 四、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Field Lineage Tracker 集成测试 ===\n');

    const tracker = new FieldLineageTracker();
    const traceId = 'test-pipeline-123';

    // 测试1：记录正常变更
    console.log('--- 测试1：正常变更 ---');
    tracker.record(traceId, {
      stageId: 'STAGE-7',
      shotId: 'S01',
      field: 'visualPrompt',
      previousValue: '少年在山顶',
      newValue: '少年在山顶，风吹动衣角'
    });
    console.log('记录完成');

    // 测试2：检测越权（异常）
    console.log('\n--- 测试2：越权检测 ---');
    tracker.record(traceId, {
      stageId: 'STAGE-9',  // 运镜Stage不应该修改visualPrompt
      shotId: 'S01',
      field: 'visualPrompt',
      previousValue: '少年在山顶',
      newValue: '少年在山顶，风吹动衣角（被运镜覆盖）'
    });

    const anomalies = tracker.getAnomalies(traceId);
    console.log('异常数:', anomalies.length);
    console.log('异常:', anomalies[0]?.message);

    // 测试3：生成审计报告
    console.log('\n--- 测试3：审计报告 ---');
    const report = tracker.generateAuditReport(traceId);
    console.log('摘要:', JSON.stringify(report.summary, null, 2));
    console.log('可疑Stage:', report.suspiciousStages.map(s => s.stageId).join(', '));

    // 测试4：导出表格
    console.log('\n--- 测试4：导出表格 ---');
    const table = tracker.exportToTable(traceId);
    console.log('行数:', table.length);
    console.log('首行:', table[0]);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}
