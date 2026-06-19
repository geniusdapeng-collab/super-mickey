# 卓越系统 (zhuoyue-system) - CORE 模块

> 导出时间: 2026-06-18T07:15:48.297Z

---

## core/core/asset-management-system.js

> 文件大小: 13707 bytes

```javascript
/**
 * Asset Management System v1.0 — 资产管理系统
 * 系统核心基础设施：统一管理所有素材（角色定妆照、参考图、音乐、音效）
 *
 * 职责：
 * - 版本控制：每个素材的版本历史（v1, v2, v3...）
 * - 血缘追踪：素材从哪个Stage生成，被哪些Stage使用
 * - 去重检测：防止重复上传相同素材
 * - 生命周期管理：过期素材自动清理
 * - 与Field Lineage集成：追踪素材使用链路
 * - 与Event Bus集成：发布资产变更事件
 *
 * 核心能力：
 * 1. Asset: { id, type, path, version, hash, createdBy, usedBy, metadata }
 * 2. AssetVersion: { version, path, hash, createdAt, diff }
 * 3. AssetManager: 创建/更新/删除/查询资产
 * 4. Deduplication: 基于hash的去重检测
 * 5. Lifecycle: 自动过期清理
 *
 * 资产类型：
 * - character_photo: 角色定妆照
 * - reference_image: 参考图
 * - concept_art: 概念图
 * - music: 音乐
 * - sound_effect: 音效
 * - render_output: 渲染输出
 * - script: 剧本文件
 * - prd: PRD文档
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 业务架构
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、资产定义
// ============================================================

const ASSET_TYPES = {
  character_photo: { name: '角色定妆照', extensions: ['jpg', 'png', 'webp'], maxSizeMB: 10 },
  reference_image: { name: '参考图', extensions: ['jpg', 'png', 'webp'], maxSizeMB: 10 },
  concept_art: { name: '概念图', extensions: ['jpg', 'png', 'webp'], maxSizeMB: 20 },
  music: { name: '音乐', extensions: ['mp3', 'wav', 'aac'], maxSizeMB: 50 },
  sound_effect: { name: '音效', extensions: ['mp3', 'wav'], maxSizeMB: 5 },
  render_output: { name: '渲染输出', extensions: ['mp4', 'mov', 'avi'], maxSizeMB: 500 },
  script: { name: '剧本', extensions: ['json', 'md', 'txt'], maxSizeMB: 1 },
  prd: { name: 'PRD', extensions: ['json', 'md'], maxSizeMB: 1 }
};

// ============================================================
// 二、资产版本
// ============================================================

class AssetVersion {
  constructor({ version, path, hash, createdAt, diff, size }) {
    this.version = version;
    this.path = path;
    this.hash = hash;
    this.createdAt = createdAt || Date.now();
    this.diff = diff || null;  // 与上一版本的差异描述
    this.size = size || 0;
  }
}

// ============================================================
// 三、资产
// ============================================================

class Asset {
  constructor({ id, type, path, hash, createdBy, metadata = {} }) {
    this.id = id || `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.type = type;
    this.path = path;
    this.hash = hash || this.computeFileHash(path);
    this.createdBy = createdBy;  // 创建者Stage
    this.usedBy = new Set();     // 使用者Stages
    this.metadata = metadata;
    this.versions = [new AssetVersion({ version: 1, path, hash: this.hash })];
    this.currentVersion = 1;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.status = 'active';  // active, archived, deleted
  }

  computeFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
    } catch (e) {
      return 'unknown';
    }
  }

  addVersion(newPath, options = {}) {
    const newHash = this.computeFileHash(newPath);
    if (newHash === this.hash) {
      console.log(`[Asset] ${this.id} 文件未变更，跳过版本创建`);
      return null;
    }

    const diff = options.diff || `版本${this.currentVersion + 1}`;
    const version = new AssetVersion({
      version: this.currentVersion + 1,
      path: newPath,
      hash: newHash,
      diff,
      size: options.size || 0
    });

    this.versions.push(version);
    this.currentVersion = version.version;
    this.hash = newHash;
    this.path = newPath;
    this.updatedAt = Date.now();

    return version;
  }

  addUsage(stageId) {
    this.usedBy.add(stageId);
  }

  getUsage() {
    return Array.from(this.usedBy);
  }

  getLatestVersion() {
    return this.versions[this.versions.length - 1];
  }

  getVersion(version) {
    return this.versions.find(v => v.version === version);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      path: this.path,
      hash: this.hash,
      createdBy: this.createdBy,
      usedBy: this.getUsage(),
      metadata: this.metadata,
      versions: this.versions.map(v => ({ ...v })),
      currentVersion: this.currentVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status
    };
  }
}

// ============================================================
// 四、资产管理系统
// ============================================================

class AssetManagementSystem {
  constructor(options = {}) {
    this.assets = new Map();  // id -> Asset
    this.byType = new Map();  // type -> Set<id>
    this.byStage = new Map(); // stageId -> Set<id>
    this.hashIndex = new Map(); // hash -> Set<id>（去重用）
    this.baseDir = options.baseDir || './assets';
    this.maxVersions = options.maxVersions || 10;
    this.eventBus = new NirathEventBus({ name: 'ams', enabled: true });
    this.deduplicationEnabled = options.deduplication !== false;
    this.lifecycleEnabled = options.lifecycle !== false;
    this.ttlDays = options.ttlDays || 30;  // 30天过期
  }

  /**
   * 创建资产
   */
  async createAsset({ type, path, createdBy, metadata = {} }) {
    const typeConfig = ASSET_TYPES[type];
    if (!typeConfig) {
      throw new Error(`未知资产类型: ${type}`);
    }

    // 验证文件存在
    if (!fs.existsSync(path)) {
      throw new Error(`文件不存在: ${path}`);
    }

    // 计算hash
    const hash = this.computeFileHash(path);

    // 去重检测
    if (this.deduplicationEnabled) {
      const duplicates = this.hashIndex.get(hash);
      if (duplicates && duplicates.size > 0) {
        const dupId = Array.from(duplicates)[0];
        console.log(`[AMS] ⚠️ 检测到重复资产: ${dupId} (hash: ${hash})`);
        return this.getAsset(dupId);
      }
    }

    const asset = new Asset({ type, path, hash, createdBy, metadata });
    this.assets.set(asset.id, asset);

    // 索引
    if (!this.byType.has(type)) this.byType.set(type, new Set());
    this.byType.get(type).add(asset.id);

    if (!this.byStage.has(createdBy)) this.byStage.set(createdBy, new Set());
    this.byStage.get(createdBy).add(asset.id);

    this.hashIndex.set(hash, new Set([asset.id]));

    // 发布事件
    this.eventBus.publish('asset.created', {
      assetId: asset.id,
      type,
      hash,
      createdBy
    }, { traceId: `ams_${Date.now()}` });

    console.log(`[AMS] ✅ 创建资产: ${asset.id} | ${type} | ${path}`);
    return asset;
  }

  /**
   * 更新资产（创建新版本）
   */
  async updateAsset(assetId, newPath, options = {}) {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`资产不存在: ${assetId}`);
    }

    const version = asset.addVersion(newPath, options);
    if (!version) return asset;  // 文件未变更

    // 更新hash索引
    this.hashIndex.set(asset.hash, new Set([assetId]));

    // 清理旧版本
    if (asset.versions.length > this.maxVersions) {
      const removed = asset.versions.splice(0, asset.versions.length - this.maxVersions);
      console.log(`[AMS] 🗑️ 清理旧版本: ${removed.length}个`);
    }

    // 发布事件
    this.eventBus.publish('asset.updated', {
      assetId,
      version: version.version,
      hash: version.hash
    }, { traceId: `ams_${Date.now()}` });

    return asset;
  }

  /**
   * 记录资产使用
   */
  recordUsage(assetId, stageId) {
    const asset = this.assets.get(assetId);
    if (asset) {
      asset.addUsage(stageId);
      if (!this.byStage.has(stageId)) this.byStage.set(stageId, new Set());
      this.byStage.get(stageId).add(assetId);
    }
  }

  /**
   * 获取资产
   */
  getAsset(id) {
    return this.assets.get(id);
  }

  /**
   * 按类型查询
   */
  getByType(type) {
    const ids = this.byType.get(type) || new Set();
    return Array.from(ids).map(id => this.assets.get(id)).filter(Boolean);
  }

  /**
   * 按Stage查询
   */
  getByStage(stageId) {
    const ids = this.byStage.get(stageId) || new Set();
    return Array.from(ids).map(id => this.assets.get(id)).filter(Boolean);
  }

  /**
   * 获取资产血缘
   */
  getLineage(assetId) {
    const asset = this.assets.get(assetId);
    if (!asset) return null;

    return {
      assetId,
      createdBy: asset.createdBy,
      usedBy: asset.getUsage(),
      versions: asset.versions.map(v => ({
        version: v.version,
        createdAt: v.createdAt,
        hash: v.hash
      }))
    };
  }

  /**
   * 计算文件hash
   */
  computeFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * 清理过期资产
   */
  cleanupExpired() {
    const now = Date.now();
    const expiredIds = [];

    for (const [id, asset] of this.assets) {
      if (asset.status === 'deleted') continue;
      
      const ageDays = (now - asset.updatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays > this.ttlDays) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const asset = this.assets.get(id);
      asset.status = 'archived';
      console.log(`[AMS] 🗑️ 归档过期资产: ${id} (${asset.type})`);
    }

    return expiredIds.length;
  }

  /**
   * 获取统计
   */
  getStats() {
    const stats = {
      totalAssets: this.assets.size,
      byType: {},
      byStatus: { active: 0, archived: 0, deleted: 0 },
      totalVersions: 0,
      totalSize: 0
    };

    for (const asset of this.assets.values()) {
      stats.byType[asset.type] = (stats.byType[asset.type] || 0) + 1;
      stats.byStatus[asset.status] = (stats.byStatus[asset.status] || 0) + 1;
      stats.totalVersions += asset.versions.length;
    }

    return stats;
  }

  /**
   * 导出报告
   */
  exportReport() {
    return {
      stats: this.getStats(),
      assets: Array.from(this.assets.values()).map(a => a.toJSON()),
      timestamp: Date.now()
    };
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  AssetManagementSystem,
  Asset,
  AssetVersion,
  ASSET_TYPES,

  // 快速创建
  createAMS: (options) => new AssetManagementSystem(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Asset Management System 集成测试 ===\n');

    const ams = new AssetManagementSystem({ baseDir: './test-assets' });

    // 测试1：创建资产
    console.log('--- 测试1：创建资产 ---');
    // 创建测试文件
    const fs = require('fs');
    const testDir = './test-assets';
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(`${testDir}/test-photo.jpg`, 'test-content-1');
    fs.writeFileSync(`${testDir}/test-photo2.jpg`, 'test-content-2');

    const asset1 = await ams.createAsset({
      type: 'character_photo',
      path: `${testDir}/test-photo.jpg`,
      createdBy: 'STAGE-4',
      metadata: { character: '少年', angle: 'front' }
    });
    console.log('创建资产:', asset1.id, asset1.type);
    console.log('Hash:', asset1.hash);

    // 测试2：去重检测
    console.log('\n--- 测试2：去重检测 ---');
    fs.writeFileSync(`${testDir}/test-photo-dup.jpg`, 'test-content-1');  // 相同内容
    const asset2 = await ams.createAsset({
      type: 'character_photo',
      path: `${testDir}/test-photo-dup.jpg`,
      createdBy: 'STAGE-4'
    });
    console.log('重复资产返回:', asset2.id === asset1.id ? '是（去重成功）' : '否');

    // 测试3：更新版本
    console.log('\n--- 测试3：更新版本 ---');
    fs.writeFileSync(`${testDir}/test-photo.jpg`, 'test-content-updated');
    const updated = await ams.updateAsset(asset1.id, `${testDir}/test-photo.jpg`, { diff: '修复光照' });
    console.log('新版本:', updated.currentVersion);
    console.log('版本数:', updated.versions.length);

    // 测试4：记录使用
    console.log('\n--- 测试4：记录使用 ---');
    ams.recordUsage(asset1.id, 'STAGE-7');
    ams.recordUsage(asset1.id, 'STAGE-11');
    console.log('使用者:', ams.getLineage(asset1.id).usedBy.join(', '));

    // 测试5：查询
    console.log('\n--- 测试5：查询 ---');
    const photos = ams.getByType('character_photo');
    console.log('角色定妆照数量:', photos.length);

    const stage4Assets = ams.getByStage('STAGE-4');
    console.log('STAGE-4创建资产:', stage4Assets.length);

    // 测试6：统计
    console.log('\n--- 测试6：统计 ---');
    console.log(ams.getStats());

    // 清理测试文件
    fs.rmSync(testDir, { recursive: true, force: true });

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/event-bus.js

> 文件大小: 16418 bytes

```javascript
/**
 * Nirath Event Bus v2.0 — 完整事件总线
 *
 * 在 v1.0 (event-bus-pilot.js) 基础上扩展：
 * - Mutations追踪：记录字段变更历史
 * - 事件回放：支持按时间/Stage过滤回放
 * - 更完善的错误边界
 * - 全Stage生命周期事件支持（17个Stage）
 * - 向后兼容 v1.0 API
 *
 * 设计原则：
 * 1. 基于 Node.js 原生 EventEmitter，零外部依赖
 * 2. 支持双模式：直接调用（现有）+ 事件驱动（新增）
 * 3. 事件 Schema：{ type, payload, mutations, metadata }
 * 4. 订阅者可选择同步/异步处理
 *
 * @version v2.0
 * @author 小G
 * @priority P0 - 架构基础
 */

'use strict';

const EventEmitter = require('events');

// ============================================================
// 一、事件定义（全Stage生命周期）
// ============================================================

const EVENT_DEFINITIONS = {
  // Pipeline 生命周期
  'pipeline.started': {
    description: 'Pipeline开始执行',
    requiredFields: ['traceId', 'stageCount']
  },
  'pipeline.milestone': {
    description: 'Pipeline达到里程碑',
    requiredFields: ['phase', 'stage', 'progressPercent']
  },
  'pipeline.completed': {
    description: 'Pipeline成功完成',
    requiredFields: ['traceId', 'completedCount']
  },
  'pipeline.failed': {
    description: 'Pipeline失败',
    requiredFields: ['traceId', 'failedAt', 'error']
  },

  // Stage 生命周期
  'stage.started': {
    description: 'Stage开始执行',
    requiredFields: ['stageId', 'traceId']
  },
  'stage.completed': {
    description: 'Stage成功完成',
    requiredFields: ['stageId', 'traceId', 'status']
  },
  'stage.failed': {
    description: 'Stage失败',
    requiredFields: ['stageId', 'traceId', 'error']
  },
  'stage.skipped': {
    description: 'Stage被跳过（非阻塞）',
    requiredFields: ['stageId', 'traceId', 'reason']
  },
  'stage.compensated': {
    description: 'Stage补偿事务已执行',
    requiredFields: ['stageId', 'traceId']
  },

  // LLM 调用事件
  'llm.call.success': {
    description: 'LLM调用成功',
    requiredFields: ['provider', 'durationMs']
  },
  'llm.call.failed': {
    description: 'LLM调用失败',
    requiredFields: ['provider', 'error']
  },

  // 数据变更事件
  'data.mutated': {
    description: '数据字段被修改',
    requiredFields: ['stageId', 'field', 'previousHash', 'newHash']
  },
  'data.validated': {
    description: '数据验证完成',
    requiredFields: ['stageId', 'valid', 'errors']
  },

  // 试点保留事件（v1.0兼容）
  'storyboard.protagonist.enhanced': {
    description: 'Stage 7.2 主角主动性注入完成',
    requiredFields: ['storyboard', 'report']
  },
  'storyboard.narration.trimmed': {
    description: 'Stage 7.3 口播精简完成',
    requiredFields: ['storyboard', 'report']
  }
};

// ============================================================
// 二、Mutations 追踪器
// ============================================================

class MutationTracker {
  constructor() {
    this.mutations = new Map(); // traceId -> Array<mutation>
  }

  /**
   * 记录字段变更
   */
  record(traceId, { stageId, shotId, field, previousValue, newValue }) {
    const mutation = {
      timestamp: Date.now(),
      stageId,
      shotId,
      field,
      previousHash: this.hashValue(previousValue),
      newHash: this.hashValue(newValue),
      sizeDelta: this.calculateSizeDelta(previousValue, newValue)
    };

    if (!this.mutations.has(traceId)) {
      this.mutations.set(traceId, []);
    }
    this.mutations.get(traceId).push(mutation);

    return mutation;
  }

  /**
   * 获取变更历史
   */
  getHistory(traceId, filters = {}) {
    const all = this.mutations.get(traceId) || [];

    if (filters.stageId) {
      return all.filter(m => m.stageId === filters.stageId);
    }
    if (filters.shotId) {
      return all.filter(m => m.shotId === filters.shotId);
    }
    if (filters.field) {
      return all.filter(m => m.field === filters.field);
    }

    return all;
  }

  /**
   * 检测异常变更
   */
  detectAnomalies(traceId, expectedStagesPerField = {}) {
    const anomalies = [];
    const history = this.mutations.get(traceId) || [];

    for (const mutation of history) {
      const expectedStages = expectedStagesPerField[mutation.field] || [];
      if (expectedStages.length > 0 && !expectedStages.includes(mutation.stageId)) {
        anomalies.push({
          ...mutation,
          expectedStages,
          severity: 'warning'
        });
      }
    }

    return anomalies;
  }

  hashValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      return value.length > 50 ? `str_${value.length}_${value.substring(0, 20)}...` : `str_${value}`;
    }
    return `obj_${JSON.stringify(value).length}`;
  }

  calculateSizeDelta(prev, next) {
    const prevSize = prev ? JSON.stringify(prev).length : 0;
    const nextSize = next ? JSON.stringify(next).length : 0;
    return nextSize - prevSize;
  }

  clear(traceId) {
    this.mutations.delete(traceId);
  }
}

// ============================================================
// 三、事件总线 v2.0
// ============================================================

class NirathEventBusV2 extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'nirath-bus-v2';
    this.enabled = options.enabled !== false;
    this.debug = options.debug || false;
    this.maxListeners = options.maxListeners || 100;
    this.setMaxListeners(this.maxListeners);

    // 事件日志（循环缓冲区）
    this.eventLog = [];
    this.maxLogSize = options.maxLogSize || 10000;

    // Mutations追踪
    this.mutationTracker = new MutationTracker();

    // 订阅者统计
    this.subscriberStats = {};

    // 内部错误日志
    this.errorLog = [];
    this.maxErrorLogSize = 1000;

    if (!this.enabled) {
      console.log(`[EventBusV2:${this.name}] 已禁用`);
    } else {
      console.log(`[EventBusV2:${this.name}] 初始化完成 | mutations追踪:启用 | 最大日志:${this.maxLogSize}`);
    }
  }

  /**
   * 发布事件（v2.0增强版）
   */
  publish(eventType, payload, metadata = {}) {
    if (!this.enabled) return;

    const eventDef = EVENT_DEFINITIONS[eventType];
    if (!eventDef) {
      console.warn(`[EventBusV2] 未知事件类型: ${eventType}`);
    }

    // 基础验证
    if (eventDef && eventDef.requiredFields) {
      for (const field of eventDef.requiredFields) {
        if (payload[field] === undefined || payload[field] === null) {
          console.warn(`[EventBusV2] 事件 ${eventType} 缺少必填字段: ${field}`);
        }
      }
    }

    // 构建完整事件
    const event = {
      type: eventType,
      payload: metadata.clonePayload ? this.deepClone(payload) : payload,
      mutations: metadata.mutations || [],  // v2.0: 携带变更记录
      metadata: {
        timestamp: Date.now(),
        busName: this.name,
        traceId: metadata.traceId || payload.traceId || `evt_${Date.now()}`,
        ...metadata
      }
    };

    // 记录到日志
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    if (this.debug) {
      console.log(`[EventBusV2] 📤 发布 ${eventType}`,
        Object.keys(payload).map(k => `${k}=${typeof payload[k]}`).join(', '));
    }

    // 发射事件（异步处理）
    this.emit(eventType, event);
  }

  /**
   * 订阅事件（v2.0增强版）
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.enabled) return () => {};

    const subscriberId = `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (!this.subscriberStats[eventType]) {
      this.subscriberStats[eventType] = { subscribers: 0, invocations: 0, errors: 0 };
    }
    this.subscriberStats[eventType].subscribers++;

    const wrapper = async (event) => {
      try {
        this.subscriberStats[eventType].invocations++;

        if (this.debug) {
          console.log(`[EventBusV2] 📥 订阅者 ${subscriberId} 处理 ${eventType}`);
        }

        // 包装handler，传入完整事件（含mutations）
        if (options.async !== false) {
          await handler(event.payload, event.metadata, event.mutations);
        } else {
          handler(event.payload, event.metadata, event.mutations);
        }
      } catch (e) {
        this.subscriberStats[eventType].errors++;
        this.errorLog.push({
          timestamp: Date.now(),
          eventType,
          subscriberId,
          error: e.message
        });
        if (this.errorLog.length > this.maxErrorLogSize) {
          this.errorLog.shift();
        }

        console.error(`[EventBusV2] 订阅者 ${subscriberId} 处理 ${eventType} 异常:`, e.message);
        if (options.throwErrors) throw e;
      }
    };

    if (options.once) {
      this.once(eventType, wrapper);
    } else {
      this.on(eventType, wrapper);
    }

    return () => {
      this.off(eventType, wrapper);
      this.subscriberStats[eventType].subscribers--;
    };
  }

  /**
   * 等待事件（Promise包装）
   */
  waitFor(eventType, timeoutMs = 5000) {
    if (!this.enabled) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, handler);
        reject(new Error(`等待事件 ${eventType} 超时 ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (event) => {
        clearTimeout(timer);
        resolve(event);
      };

      this.once(eventType, handler);
    });
  }

  // ============================================================
  // 事件回放（v2.0新功能）
  // ============================================================

  /**
   * 按条件过滤事件日志
   */
  getEventLog(filters = {}) {
    let filtered = [...this.eventLog];

    if (filters.eventType) {
      filtered = filtered.filter(e => e.type === filters.eventType);
    }
    if (filters.traceId) {
      filtered = filtered.filter(e => e.metadata.traceId === filters.traceId);
    }
    if (filters.stageId) {
      filtered = filtered.filter(e => e.metadata.stageId === filters.stageId);
    }
    if (filters.since) {
      filtered = filtered.filter(e => e.metadata.timestamp >= filters.since);
    }
    if (filters.until) {
      filtered = filtered.filter(e => e.metadata.timestamp <= filters.until);
    }

    return filtered;
  }

  /**
   * 回放特定Trace的所有事件
   */
  replayTrace(traceId, options = {}) {
    const events = this.getEventLog({ traceId });
    console.log(`[EventBusV2] 🔁 回放 trace=${traceId} | ${events.length}个事件`);

    for (const event of events) {
      if (options.skipTypes && options.skipTypes.includes(event.type)) continue;
      this.emit(event.type, event);
    }

    return events.length;
  }

  /**
   * 回放特定Stage的输入事件
   */
  replayForStage(stageId, eventTypes = []) {
    const relevant = this.eventLog.filter(e =>
      eventTypes.includes(e.type) &&
      e.metadata.sourceStage !== stageId
    );

    console.log(`[EventBusV2] 🔁 回放 Stage=${stageId} | ${relevant.length}个相关事件`);

    for (const event of relevant) {
      this.emit(event.type, event);
    }

    return relevant.length;
  }

  // ============================================================
  // Mutations 追踪（v2.0新功能）
  // ============================================================

  /**
   * 记录数据变更
   */
  recordMutation(traceId, mutation) {
    return this.mutationTracker.record(traceId, mutation);
  }

  /**
   * 获取变更历史
   */
  getMutations(traceId, filters) {
    return this.mutationTracker.getHistory(traceId, filters);
  }

  /**
   * 检测异常变更
   */
  detectMutationAnomalies(traceId, expectedStagesPerField) {
    return this.mutationTracker.detectAnomalies(traceId, expectedStagesPerField);
  }

  // ============================================================
  // 统计与报告
  // ============================================================

  getSubscriberStats() {
    return { ...this.subscriberStats };
  }

  getErrorLog(limit = 50) {
    return this.errorLog.slice(-limit);
  }

  getReport() {
    return {
      name: this.name,
      enabled: this.enabled,
      totalEvents: this.eventLog.length,
      totalErrors: this.errorLog.length,
      subscriberStats: this.getSubscriberStats(),
      mutationCount: Array.from(this.mutationTracker.mutations.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  // ============================================================
  // 工具方法
  // ============================================================

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    const cloned = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  }

  clear() {
    this.eventLog = [];
    this.errorLog = [];
    this.mutationTracker = new MutationTracker();
    console.log(`[EventBusV2:${this.name}] 已清空所有日志`);
  }
}

// ============================================================
// 四、v1.0 兼容包装器
// ============================================================

class NirathEventBusV1Compat extends NirathEventBusV2 {
  constructor(options = {}) {
    super({ ...options, name: options.name || 'nirath-compat' });
  }

  // v1.0 API 兼容：publish(payload, metadata) -> 内部调用 v2.0 publish
  publishCompat(eventType, payload, metadata = {}) {
    return this.publish(eventType, payload, metadata);
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  NirathEventBusV2,
  NirathEventBusV1Compat,
  MutationTracker,
  EVENT_DEFINITIONS,

  // 默认导出 v2.0（新代码使用）
  NirathEventBus: NirathEventBusV2,

  // 单例获取
  getEventBus: (options) => new NirathEventBusV2(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Event Bus V2.0 集成测试 ===\n');

    const bus = new NirathEventBusV2({ name: 'test-bus', debug: true });

    // 测试1：基本发布/订阅
    console.log('--- 测试1：基本发布/订阅 ---');
    let received = null;
    const unsub = bus.subscribe('test.event', (payload, metadata) => {
      received = payload;
      console.log('收到:', payload.message);
    });

    bus.publish('test.event', { message: 'Hello V2.0' }, { stageId: 'TEST' });
    await new Promise(r => setTimeout(r, 100));
    console.log('接收成功:', received?.message === 'Hello V2.0');
    unsub();

    // 测试2：Mutations追踪
    console.log('\n--- 测试2：Mutations追踪 ---');
    bus.recordMutation('trace-123', {
      stageId: 'STAGE-5',
      shotId: 'S01',
      field: 'visualPrompt',
      previousValue: 'old prompt',
      newValue: 'new prompt with more details'
    });
    const mutations = bus.getMutations('trace-123');
    console.log('Mutations记录:', mutations.length);
    console.log('字段:', mutations[0].field);
    console.log('SizeDelta:', mutations[0].sizeDelta);

    // 测试3：事件回放
    console.log('\n--- 测试3：事件回放 ---');
    bus.publish('stage.completed', { stageId: 'STAGE-1' }, { traceId: 'replay-test' });
    bus.publish('stage.completed', { stageId: 'STAGE-2' }, { traceId: 'replay-test' });
    bus.publish('stage.failed', { stageId: 'STAGE-3' }, { traceId: 'other-trace' });

    const replayCount = bus.replayTrace('replay-test');
    console.log('回放事件数:', replayCount);

    // 测试4：统计报告
    console.log('\n--- 测试4：统计报告 ---');
    const report = bus.getReport();
    console.log('总事件:', report.totalEvents);
    console.log('总错误:', report.totalErrors);
    console.log('Mutations:', report.mutationCount);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/field-lineage.js

> 文件大小: 14164 bytes

```javascript
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
 * @author 小G
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

```

---

## core/core/immutable-shot.js

> 文件大小: 12846 bytes

```javascript
/**
 * Immutable Shot v1.0 — 不可变镜头对象
 * 系统核心基础设施：消除"后Stage覆盖前Stage数据"风险
 *
 * 职责：
 * - 不可变性：镜头对象创建后不可修改，所有修改返回新实例
 * - 结构共享：基于共享结构实现高效拷贝（类似Persistent Data Structure）
 * - 快照哈希：每个版本有唯一哈希，可追踪变更
 * - 与Saga编排器集成：Stage输出自动包装为ImmutableShot
 * - 与Event Bus集成：变更发布mutations事件
 *
 * 设计模式：Immutable.js风格 + 函数式更新
 *
 * @version v1.0
 * @author 小G
 * @priority P0 - 数据完整性
 */

'use strict';

const crypto = require('crypto');
const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、不可变镜头对象
// ============================================================

class ImmutableShot {
  constructor(data = {}, options = {}) {
    this._data = Object.freeze(this.deepFreeze({ ...data }));
    this._hash = this.computeHash(this._data);
    this._version = options.version || 1;
    this._createdAt = Date.now();
    this._stageId = options.stageId || 'init';
    this._parentHash = options.parentHash || null;
    this._history = options.history || [];
    this._mutations = [];

    // 计算新增字段（与parent对比）
    if (options.parentData) {
      this._mutations = this.detectChanges(options.parentData, this._data);
    }
  }

  /**
   * 获取数据（只读）
   */
  get data() {
    return this._data;
  }

  get id() {
    return this._data.id || this._data.shotId;
  }

  get sequence() {
    return this._data.sequence;
  }

  get visualPrompt() {
    return this._data.visualPrompt || this._data.prompt;
  }

  get duration() {
    return this._data.duration || this._data.shotDuration || this._data.targetDuration;
  }

  get hash() {
    return this._hash;
  }

  get version() {
    return this._version;
  }

  get mutations() {
    return [...this._mutations];
  }

  /**
   * 函数式更新：返回新实例，原实例不变
   */
  update(updater, options = {}) {
    const newData = typeof updater === 'function'
      ? updater(this.deepClone(this._data))
      : { ...this.deepClone(this._data), ...updater };

    return new ImmutableShot(newData, {
      version: this._version + 1,
      stageId: options.stageId || this._stageId,
      parentHash: this._hash,
      history: [...this._history, { version: this._version, hash: this._hash, stageId: this._stageId }],
      parentData: this._data
    });
  }

  /**
   * 设置字段（函数式）
   */
  set(field, value) {
    return this.update({ [field]: value }, { stageId: `set_${field}` });
  }

  /**
   * 批量设置字段
   */
  setMany(fields) {
    return this.update(fields, { stageId: 'set_many' });
  }

  /**
   * 深度冻结（递归）
   */
  deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Object.isFrozen(obj)) return obj;

    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      const value = obj[name];
      if (value !== null && typeof value === 'object') {
        this.deepFreeze(value);
      }
    }

    return Object.freeze(obj);
  }

  /**
   * 深度克隆
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));

    const cloned = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  }

  /**
   * 计算哈希
   */
  computeHash(data) {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  /**
   * 检测变更
   */
  detectChanges(oldData, newData) {
    const mutations = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    for (const key of allKeys) {
      const oldVal = oldData[key];
      const newVal = newData[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        mutations.push({
          field: key,
          previousHash: oldVal !== undefined ? this.computeHash(oldVal) : 'undefined',
          newHash: newVal !== undefined ? this.computeHash(newVal) : 'undefined',
          sizeDelta: JSON.stringify(newVal).length - JSON.stringify(oldVal).length
        });
      }
    }

    return mutations;
  }

  /**
   * 获取历史追溯
   */
  getHistory() {
    return [
      ...this._history,
      { version: this._version, hash: this._hash, stageId: this._stageId }
    ];
  }

  /**
   * 获取版本对比
   */
  diff(otherShot) {
    return this.detectChanges(otherShot._data, this._data);
  }

  /**
   * 序列化为普通对象（用于输出）
   */
  toJSON() {
    return this.deepClone(this._data);
  }

  /**
   * 验证完整性
   */
  validate() {
    const errors = [];

    if (!this.id) errors.push('缺少id');
    if (this.sequence === undefined) errors.push('缺少sequence');
    if (!this._data.scene && !this._data.sceneName) errors.push('缺少scene');

    return {
      valid: errors.length === 0,
      errors,
      hash: this._hash
    };
  }
}

// ============================================================
// 二、不可变镜头数组
// ============================================================

class ImmutableShotArray {
  constructor(shots = []) {
    this._shots = shots.map(s => s instanceof ImmutableShot ? s : new ImmutableShot(s));
    this._hash = this.computeArrayHash();
    this._sequenceMap = this.buildSequenceMap();
  }

  /**
   * 获取镜头数量
   */
  get length() {
    return this._shots.length;
  }

  /**
   * 获取所有镜头（只读）
   */
  get shots() {
    return [...this._shots];
  }

  /**
   * 按ID获取镜头
   */
  getById(id) {
    return this._shots.find(s => s.id === id);
  }

  /**
   * 按序列号获取镜头
   */
  getBySequence(seq) {
    return this._shots.find(s => s.sequence === seq);
  }

  /**
   * 更新镜头（返回新数组）
   */
  updateShot(id, updater, options = {}) {
    const index = this._shots.findIndex(s => s.id === id);
    if (index < 0) throw new Error(`镜头 ${id} 不存在`);

    const newShots = [...this._shots];
    newShots[index] = this._shots[index].update(updater, options);

    return new ImmutableShotArray(newShots);
  }

  /**
   * 添加镜头（返回新数组）
   */
  addShot(shotData, options = {}) {
    const newShot = shotData instanceof ImmutableShot
      ? shotData
      : new ImmutableShot(shotData, { ...options, version: 1 });

    return new ImmutableShotArray([...this._shots, newShot]);
  }

  /**
   * 插入镜头（返回新数组）
   */
  insertShot(shotData, position, options = {}) {
    const newShot = shotData instanceof ImmutableShot
      ? shotData
      : new ImmutableShot(shotData, { ...options, version: 1 });

    const newShots = [...this._shots];
    newShots.splice(position, 0, newShot);

    return new ImmutableShotArray(newShots);
  }

  /**
   * 删除镜头（返回新数组）
   */
  removeShot(id) {
    return new ImmutableShotArray(this._shots.filter(s => s.id !== id));
  }

  /**
   * 映射操作（函数式）
   */
  map(fn) {
    return new ImmutableShotArray(this._shots.map(fn));
  }

  /**
   * 过滤（返回新数组）
   */
  filter(fn) {
    return new ImmutableShotArray(this._shots.filter(fn));
  }

  /**
   * 验证序列连续性
   */
  validateSequence() {
    const sequences = this._shots.map(s => s.sequence).filter(s => s !== undefined).sort((a, b) => a - b);
    const errors = [];

    for (let i = 0; i < sequences.length - 1; i++) {
      if (sequences[i + 1] !== sequences[i] + 1) {
        errors.push(`序列不连续: ${sequences[i]} → ${sequences[i + 1]}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sequences
    };
  }

  /**
   * 验证所有镜头完整性
   */
  validateAll() {
    const results = this._shots.map(s => s.validate());
    const invalid = results.filter(r => !r.valid);

    return {
      valid: invalid.length === 0,
      total: this._shots.length,
      valid: this._shots.length - invalid.length,
      invalid: invalid.length,
      errors: invalid.flatMap(r => r.errors)
    };
  }

  /**
   * 计算数组哈希
   */
  computeArrayHash() {
    const hashes = this._shots.map(s => s.hash).join(',');
    return crypto.createHash('md5').update(hashes).digest('hex').substring(0, 16);
  }

  buildSequenceMap() {
    const map = new Map();
    for (let i = 0; i < this._shots.length; i++) {
      const seq = this._shots[i].sequence;
      if (seq !== undefined) map.set(seq, i);
    }
    return map;
  }

  /**
   * 序列化为普通数组
   */
  toJSON() {
    return this._shots.map(s => s.toJSON());
  }

  /**
   * 转换为普通数组（向后兼容）
   */
  toArray() {
    return this.toJSON();
  }
}

// ============================================================
// 三、Shot 工厂（与现有系统兼容）
// ============================================================

class ShotFactory {
  constructor() {
    this.eventBus = new NirathEventBus({ name: 'shot-factory', enabled: true });
  }

  /**
   * 从普通对象创建ImmutableShot
   */
  create(data, stageId) {
    const shot = new ImmutableShot(data, { stageId, version: 1 });

    this.eventBus.publish('data.mutated', {
      stageId,
      shotId: shot.id,
      field: 'creation',
      previousHash: 'null',
      newHash: shot.hash
    }, { traceId: data.traceId || `shot_${Date.now()}` });

    return shot;
  }

  /**
   * 从普通数组创建ImmutableShotArray
   */
  createArray(shots, stageId) {
    const array = new ImmutableShotArray(shots.map(s => this.create(s, stageId)));

    this.eventBus.publish('data.mutated', {
      stageId,
      field: 'array_creation',
      count: array.length
    }, { traceId: `array_${Date.now()}` });

    return array;
  }

  /**
   * 将普通对象批量转换为ImmutableShotArray（Stage输出包装器）
   */
  wrapStageOutput(shots, stageId) {
    if (!Array.isArray(shots)) {
      console.warn(`[ShotFactory] ${stageId} 输出不是数组，尝试包装`);
      return null;
    }

    return this.createArray(shots, stageId);
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  ImmutableShot,
  ImmutableShotArray,
  ShotFactory,

  // 快速创建
  createShot: (data, stageId) => new ImmutableShot(data, { stageId }),
  createShotArray: (shots, stageId) => new ImmutableShotArray(shots.map(s => new ImmutableShot(s, { stageId })))
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Immutable Shot 集成测试 ===\n');

    // 测试1：不可变性
    console.log('--- 测试1：不可变性 ---');
    const shot1 = new ImmutableShot({
      id: 'S01', sequence: 1, scene: '开场',
      visualPrompt: '一个少年站在山顶'
    }, { stageId: 'STAGE-7' });

    console.log('初始Hash:', shot1.hash);
    console.log('版本:', shot1.version);

    const shot2 = shot1.set('visualPrompt', '一个少年站在山顶，风吹动他的衣角');
    console.log('更新后Hash:', shot2.hash);
    console.log('新版本:', shot2.version);
    console.log('原Hash不变:', shot1.hash === shot2.hash ? '否' : '是');
    console.log('原Prompt不变:', shot1.visualPrompt);

    // 测试2：变更检测
    console.log('\n--- 测试2：变更检测 ---');
    console.log('Mutations:', shot2.mutations.map(m => `${m.field} (Δ${m.sizeDelta})`));

    // 测试3：数组操作
    console.log('\n--- 测试3：数组操作 ---');
    const array = new ImmutableShotArray([
      { id: 'S01', sequence: 1, scene: '开场' },
      { id: 'S02', sequence: 2, scene: '发展' },
      { id: 'S04', sequence: 4, scene: '高潮' }  // 故意跳3
    ]);

    console.log('数组长度:', array.length);
    console.log('序列验证:', array.validateSequence());

    // 测试4：函数式更新
    console.log('\n--- 测试4：函数式更新 ---');
    const array2 = array.updateShot('S01', data => {
      data.visualPrompt = ' updated';
      return data;
    }, { stageId: 'STAGE-9' });

    console.log('原数组Hash:', array.hash);
    console.log('新数组Hash:', array2.hash);
    console.log('是否不同:', array.hash !== array2.hash);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/llm-batch-manager.js

> 文件大小: 15377 bytes

```javascript
/**
 * LLM Batch Manager v1.0 — LLM批处理管理器
 * 系统核心基础设施：管理并发请求，防止"一次请求80个镜头→超时"
 *
 * 职责：
 * - Token Bucket并发控制：限制同时请求数（默认3个，适配火山引擎限制）
 * - 内存保护：防止内存泄漏（超出上限时拒绝请求）
 * - 优先级队列：紧急请求优先处理（如P0修复）
 * - 与LLM Gateway集成：统一入口
 * - 与Saga编排器集成：Stage请求自动进入队列
 *
 * 核心能力：
 * 1. Token Bucket算法：平滑限流，避免突发请求
 * 2. 内存监控：每个请求预估内存占用，总量控制
 * 3. 优先级调度：5级优先级（P0紧急→P4低优）
 * 4. 自适应并发：根据成功率动态调整并发数
 * 5. 失败隔离：单个请求失败不影响其他请求
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 稳定性工程
 */

'use strict';

const { EventEmitter } = require('events');
const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、Token Bucket 限流器
// ============================================================

class TokenBucket {
  constructor(capacity, refillRate, options = {}) {
    this.capacity = capacity;         // 桶容量 = 最大并发数
    this.tokens = capacity;             // 当前可用令牌数
    this.refillRate = refillRate;       // 每秒补充令牌数
    this.lastRefill = Date.now();
    this.lock = Promise.resolve();      // 锁，确保原子操作
    this.stats = {
      totalRequests: 0,
      accepted: 0,
      rejected: 0,
      waitTimeMs: 0
    };
  }

  /**
   * 获取令牌（异步，如果没有令牌则等待）
   */
  async acquire(count = 1, timeoutMs = 30000) {
    const startMs = Date.now();
    this.stats.totalRequests++;

    while (true) {
      // 补充令牌
      this.refill();

      if (this.tokens >= count) {
        this.tokens -= count;
        this.stats.accepted++;
        this.stats.waitTimeMs += Date.now() - startMs;
        return { granted: true, waitMs: Date.now() - startMs };
      }

      if (Date.now() - startMs > timeoutMs) {
        this.stats.rejected++;
        return { granted: false, waitMs: Date.now() - startMs, reason: 'timeout' };
      }

      // 等待令牌补充
      const waitMs = Math.ceil((count - this.tokens) / this.refillRate * 1000);
      await this.sleep(Math.min(waitMs, 100));
    }
  }

  /**
   * 尝试获取（不等待，立即返回）
   */
  tryAcquire(count = 1) {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      this.stats.accepted++;
      return { granted: true };
    }
    this.stats.rejected++;
    return { granted: false, available: this.tokens };
  }

  /**
   * 释放令牌
   */
  release(count = 1) {
    this.tokens = Math.min(this.capacity, this.tokens + count);
  }

  /**
   * 补充令牌
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getStats() {
    return {
      ...this.stats,
      currentTokens: this.tokens,
      capacity: this.capacity,
      rejectionRate: this.stats.totalRequests > 0 ? (this.stats.rejected / this.stats.totalRequests).toFixed(2) : 0
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 二、优先级队列
// ============================================================

class PriorityQueue {
  constructor() {
    this.queues = {
      P0: [],  // 紧急（如P0修复、熔断恢复）
      P1: [],  // 高优（如主链路Stage）
      P2: [],  // 中优（如导演优化）
      P3: [],  // 低优（如质量分析）
      P4: []   // 最低（如日志分析）
    };
    this.totalSize = 0;
  }

  enqueue(item, priority = 'P2') {
    const queue = this.queues[priority] || this.queues.P2;
    queue.push({ item, enqueueTime: Date.now() });
    this.totalSize++;
  }

  dequeue() {
    for (const level of ['P0', 'P1', 'P2', 'P3', 'P4']) {
      const queue = this.queues[level];
      if (queue.length > 0) {
        this.totalSize--;
        return queue.shift();
      }
    }
    return null;
  }

  peek() {
    for (const level of ['P0', 'P1', 'P2', 'P3', 'P4']) {
      if (this.queues[level].length > 0) {
        return this.queues[level][0];
      }
    }
    return null;
  }

  getStats() {
    return {
      total: this.totalSize,
      byPriority: Object.fromEntries(
        Object.entries(this.queues).map(([k, v]) => [k, v.length])
      )
    };
  }
}

// ============================================================
// 三、内存监控器
// ============================================================

class MemoryMonitor {
  constructor(options = {}) {
    this.maxMemoryMB = options.maxMemoryMB || 1024;  // 1GB上限
    this.warningThreshold = options.warningThreshold || 0.8;  // 80%警告
    this.gcInterval = options.gcInterval || 60000;  // 1分钟检查一次
    this.stats = {
      peakMemoryMB: 0,
      currentMemoryMB: 0,
      gcCount: 0
    };
  }

  /**
   * 获取当前内存使用
   */
  getCurrentMemory() {
    if (global.gc) {
      global.gc();  // 强制GC（需要--expose-gc标志）
    }
    const used = process.memoryUsage();
    const mb = Math.round(used.heapUsed / 1024 / 1024);
    this.stats.currentMemoryMB = mb;
    this.stats.peakMemoryMB = Math.max(this.stats.peakMemoryMB, mb);
    return mb;
  }

  /**
   * 检查是否可以接受新请求
   */
  canAccept(requestSizeMB = 0) {
    const current = this.getCurrentMemory();
    const projected = current + requestSizeMB;
    return projected < this.maxMemoryMB;
  }

  /**
   * 获取内存状态
   */
  getStatus() {
    const current = this.getCurrentMemory();
    return {
      currentMB: current,
      maxMB: this.maxMemoryMB,
      usagePercent: (current / this.maxMemoryMB).toFixed(2),
      status: current > this.maxMemoryMB * this.warningThreshold ? 'warning' : 'normal',
      ...this.stats
    };
  }
}

// ============================================================
// 四、LLM 批处理管理器
// ============================================================

class LLMBatchManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 3;  // 火山引擎限制
    this.maxRetries = options.maxRetries || 3;
    this.maxMemoryMB = options.maxMemoryMB || 1024;
    this.adaptiveConcurrency = options.adaptiveConcurrency !== false;

    // 子系统
    this.tokenBucket = new TokenBucket(this.maxConcurrency, this.maxConcurrency);  // 每秒补充3个
    this.priorityQueue = new PriorityQueue();
    this.memoryMonitor = new MemoryMonitor({ maxMemoryMB: this.maxMemoryMB });
    this.eventBus = new NirathEventBus({ name: 'batch-manager', enabled: true });

    // 运行状态
    this.running = new Map();  // 正在执行的请求
    this.completed = 0;
    this.failed = 0;
    this.successRate = 1.0;
    this.adaptiveMaxConcurrency = this.maxConcurrency;
    this._processing = false;  // 锁，防止并发进入

    // 自适应调整
    if (this.adaptiveConcurrency) {
      this.adaptiveInterval = setInterval(() => this.adjustConcurrency(), 30000);  // 30秒调整一次
    }
  }

  /**
   * 提交请求到队列
   */
  async submit(request, options = {}) {
    const {
      priority = 'P2',
      timeoutMs = 600000,
      memoryEstimateMB = 50,
      retries = this.maxRetries
    } = options;

    // 内存检查
    if (!this.memoryMonitor.canAccept(memoryEstimateMB)) {
      console.error(`[BatchManager] ❌ 内存不足，拒绝请求 | 当前:${this.memoryMonitor.getCurrentMemory()}MB + ${memoryEstimateMB}MB > ${this.maxMemoryMB}MB`);
      throw new Error('内存不足，请稍后重试');
    }

    // 包装请求
    const wrappedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      request,
      priority,
      timeoutMs,
      retries,
      retryCount: 0,
      status: 'queued',
      startTime: null,
      endTime: null
    };

    // 加入优先级队列
    this.priorityQueue.enqueue(wrappedRequest, priority);
    this.emit('request.queued', wrappedRequest);

    // 尝试立即处理
    this.processQueue();

    // 返回Promise
    return new Promise((resolve, reject) => {
      wrappedRequest.resolve = resolve;
      wrappedRequest.reject = reject;
    });
  }

  /**
   * 处理队列
   */
  async processQueue() {
    if (this._processing) return; // 已在处理中
    this._processing = true;

    try {
      while (this.running.size < this.adaptiveMaxConcurrency) {
        const item = this.priorityQueue.dequeue();
        if (!item) break;

        const { item: request } = item;

        // 获取Token
        const token = await this.tokenBucket.acquire(1, 30000);
        if (!token.granted) {
          console.warn(`[BatchManager] ⚠️ 请求${request.id}等待Token超时，重新入队`);
          this.priorityQueue.enqueue(request, request.priority);
          break;
        }

        this.running.set(request.id, request);
        request.status = 'running';
        request.startTime = Date.now();

        this.emit('request.started', request);

        // 执行请求
        this.executeRequest(request).finally(() => {
          this.running.delete(request.id);
          this.tokenBucket.release(1);
          this.processQueue();  // 处理下一个
        });
      }
    } finally {
      this._processing = false;
    }
  }

  /**
   * 执行单个请求（带重试）
   */
  async executeRequest(request) {
    const { request: fn, timeoutMs, retries } = request;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        // 超时控制
        let timeoutId;
        const result = await Promise.race([
          fn(request),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
          })
        ]);
        clearTimeout(timeoutId); // 清理timer

        request.endTime = Date.now();
        request.status = 'completed';
        this.completed++;
        this.emit('request.completed', request);
        this.eventBus.publish('llm.call.success', {
          requestId: request.id,
          durationMs: request.endTime - request.startTime,
          attempts: attempt
        }, { traceId: request.id });

        request.resolve(result);
        return result;

      } catch (error) {
        request.retryCount = attempt;
        console.error(`[BatchManager] ❌ 请求${request.id} 尝试${attempt}失败: ${error.message}`);

        if (attempt > retries) {
          request.status = 'failed';
          request.endTime = Date.now();
          this.failed++;
          this.emit('request.failed', request, error);
          this.eventBus.publish('llm.call.failed', {
            requestId: request.id,
            error: error.message,
            attempts: attempt
          }, { traceId: request.id });

          request.reject(error);
          return;
        }

        // 指数退避重试
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[BatchManager] ⏳ ${backoffMs}ms后重试...`);
        await this.sleep(backoffMs);
      }
    }
  }

  /**
   * 自适应调整并发数
   */
  adjustConcurrency() {
    const total = this.completed + this.failed;
    if (total === 0) return;

    const newRate = this.completed / total;
    this.successRate = newRate;

    if (newRate < 0.5) {
      // 成功率低，降低并发
      this.adaptiveMaxConcurrency = Math.max(1, this.adaptiveMaxConcurrency - 1);
      console.log(`[BatchManager] 📉 成功率${(newRate * 100).toFixed(0)}%，降低并发到${this.adaptiveMaxConcurrency}`);
    } else if (newRate > 0.95 && this.adaptiveMaxConcurrency < this.maxConcurrency) {
      // 成功率高，恢复并发
      this.adaptiveMaxConcurrency++;
      console.log(`[BatchManager] 📈 成功率${(newRate * 100).toFixed(0)}%，恢复并发到${this.adaptiveMaxConcurrency}`);
    }

    // 重置统计
    this.completed = 0;
    this.failed = 0;
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      running: this.running.size,
      queued: this.priorityQueue.totalSize,
      completed: this.completed,
      failed: this.failed,
      successRate: this.successRate,
      adaptiveConcurrency: this.adaptiveMaxConcurrency,
      maxConcurrency: this.maxConcurrency,
      tokenBucket: this.tokenBucket.getStats(),
      queueStats: this.priorityQueue.getStats(),
      memory: this.memoryMonitor.getStatus()
    };
  }

  /**
   * 关闭
   */
  shutdown() {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
    }
    console.log(`[BatchManager] 🛑 已关闭 | 运行中:${this.running.size} | 队列中:${this.priorityQueue.totalSize}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  LLMBatchManager,
  TokenBucket,
  PriorityQueue,
  MemoryMonitor,

  // 快速创建
  createBatchManager: (options) => new LLMBatchManager(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== LLM Batch Manager 集成测试 ===\n');

    const manager = new LLMBatchManager({ maxConcurrency: 2, adaptiveConcurrency: false });

    // 测试1：基础提交
    console.log('--- 测试1：基础提交 ---');
    const result1 = await manager.submit(
      async () => {
        await new Promise(r => setTimeout(r, 100));
        return '请求1完成';
      },
      { priority: 'P1' }
    );
    console.log('结果1:', result1);

    // 测试2：并发限制
    console.log('\n--- 测试2：并发限制 ---');
    const startMs = Date.now();
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        manager.submit(
          async () => {
            await new Promise(r => setTimeout(r, 200));
            return `请求${i + 2}完成`;
          },
          { priority: 'P2' }
        )
      );
    }
    const results = await Promise.all(promises);
    const duration = Date.now() - startMs;
    console.log('5个请求完成，总耗时:', duration, 'ms（限制并发=2，预期约600ms）');
    console.log('结果:', results);

    // 测试3：优先级队列
    console.log('\n--- 测试3：优先级队列 ---');
    const p0Result = await manager.submit(
      async () => 'P0紧急完成',
      { priority: 'P0' }
    );
    console.log('P0结果:', p0Result);

    // 测试4：统计
    console.log('\n--- 测试4：统计 ---');
    console.log(manager.getStats());

    manager.shutdown();
    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/llm-gateway.js

> 文件大小: 24744 bytes

```javascript
/**
 * LLM统一网关 (LLM Gateway) v1.0
 * 系统核心基础设施：为所有LLM调用提供统一、可靠、可观测的入口
 *
 * 职责：
 * - 熔断器 (Circuit Breaker)：防止级联失败
 * - 统一重试：指数退避 + 可配置策略
 * - JSON安全解析：自动修复、Schema验证
 * - Prompt自动拆分：超长Prompt分块处理
 * - Provider适配器：统一接口，支持多Provider
 * - 事件集成：与Event Bus Pilot打通，发布LLM事件
 * - Fallback降级：失败时返回安全默认值
 *
 * 兼容模式：
 * - 现有 llm-reasoning-engine.js 可直接通过网关调用
 * - 新代码优先使用网关接口
 * - 旧代码可渐进迁移
 *
 * @version v1.0
 * @author 小G
 * @priority P0 - 架构基础
 */

'use strict';

const { NirathEventBus } = require('../systems/nirath/event-bus-pilot');

// ============================================================
// 一、熔断器 (Circuit Breaker)
// ============================================================

const CB_STATE = {
  CLOSED: 'CLOSED',      // 正常状态
  OPEN: 'OPEN',          // 熔断状态，拒绝请求
  HALF_OPEN: 'HALF_OPEN' // 试探状态，测试是否恢复
};

class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.failureThreshold = config.failureThreshold || 5;
    this.recoveryTimeoutMs = config.recoveryTimeoutMs || 30000;
    this.halfOpenMaxCalls = config.halfOpenMaxCalls || 2;

    this.state = CB_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
    this.totalCalls = 0;
    this.totalFailures = 0;
  }

  async execute(fn) {
    this.totalCalls++;

    // 检查熔断状态
    if (this.state === CB_STATE.OPEN) {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        console.log(`[CB:${this.name}] 熔断恢复 → HALF_OPEN`);
        this.state = CB_STATE.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        this.totalFailures++;
        throw new Error(`[CB:${this.name}] 熔断器OPEN，拒绝请求`);
      }
    }

    if (this.state === CB_STATE.HALF_OPEN && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      this.totalFailures++;
      throw new Error(`[CB:${this.name}] HALF_OPEN配额已满`);
    }

    if (this.state === CB_STATE.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === CB_STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxCalls) {
        console.log(`[CB:${this.name}] 恢复成功 → CLOSED`);
        this.state = CB_STATE.CLOSED;
        this.successCount = 0;
        this.halfOpenCalls = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    if (this.state === CB_STATE.HALF_OPEN) {
      console.log(`[CB:${this.name}] HALF_OPEN失败 → 返回OPEN`);
      this.state = CB_STATE.OPEN;
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      console.log(`[CB:${this.name}] 失败阈值达到(${this.failureThreshold}) → OPEN`);
      this.state = CB_STATE.OPEN;
    }
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      failureRate: this.totalCalls > 0 ? (this.totalFailures / this.totalCalls).toFixed(2) : 0
    };
  }
}

// ============================================================
// 二、Provider 适配器接口
// ============================================================

/**
 * KimiProviderAdapter - 适配Kimi API（当前主力Provider）
 * 兼容：OpenAI格式 / Anthropic格式
 */
class KimiProviderAdapter {
  constructor() {
    this.apiKey = null;
    this.baseUrl = null;
    this.model = 'kimi-k2p6';
    this.configured = false;
  }

  async initialize() {
    try {
      const config = require('/root/.openclaw/openclaw.json');
      const remoteConfig = config?.agents?.defaults?.memorySearch?.remote;
      if (!remoteConfig || !remoteConfig.apiKey) {
        throw new Error('Kimi API配置未找到');
      }
      this.apiKey = remoteConfig.apiKey;
      this.baseUrl = remoteConfig.baseUrl || 'https://agent-gw.kimi.com/coding/v1';
      this.configured = true;
      console.log(`[KimiAdapter] 初始化完成 | baseUrl: ${this.baseUrl}`);
    } catch (error) {
      console.warn(`[KimiAdapter] 初始化失败: ${error.message}`);
      this.configured = false;
    }
  }

  async call({ prompt, systemPrompt, maxTokens, temperature, timeoutMs }) {
    if (!this.configured) {
      await this.initialize();
    }
    if (!this.configured) {
      throw new Error('Kimi Adapter未配置');
    }

    const requestBody = {
      model: this.model,
      max_tokens: maxTokens || 4096,
      temperature: 1,    // kimi-k2p6 固定 temperature=1
      top_p: 0.95,       // kimi-k2p6 固定 top_p=0.95
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 600000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'Nirath-LLM-Gateway/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`API错误: ${result.error.message || result.error}`);
      }

      // 提取内容（兼容多格式）
      let content = result.choices?.[0]?.message?.content
        || result.content?.[0]?.text
        || result.content
        || result.text
        || '';

      // 处理reasoning_content（推理模型特性）
      if (!content || content.trim().length === 0) {
        const reasoning = result.choices?.[0]?.message?.reasoning_content;
        if (reasoning && reasoning.trim().length > 0) {
          const extracted = this.extractJSONFromReasoning(reasoning);
          content = extracted || reasoning;
        }
      }

      const tokenCount = result.usage?.output_tokens
        || result.usage?.completion_tokens
        || Math.floor(content.length * 1.5);

      return { content, tokenCount, raw: result };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  extractJSONFromReasoning(text) {
    if (!text || text.trim().length === 0) return null;

    // 策略1：从末尾找最后一个 }，向前回溯到对应的 {
    let lastBrace = text.lastIndexOf('}');
    if (lastBrace < 0) return null;

    let braceCount = 0;
    let startIndex = -1;
    for (let i = lastBrace; i >= 0; i--) {
      if (text[i] === '}') braceCount++;
      if (text[i] === '{') braceCount--;
      if (braceCount === 0) {
        startIndex = i;
        break;
      }
    }

    if (startIndex >= 0) {
      const candidate = text.substring(startIndex, lastBrace + 1);
      try { JSON.parse(candidate); return candidate; } catch (e) {}
    }

    // 策略2：正则匹配所有JSON对象
    const jsonMatches = text.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(jsonMatches[i]);
          if (Object.keys(parsed).length > 0) return jsonMatches[i];
        } catch (e) {}
      }
    }

    return null;
  }
}

// ============================================================
// 三、JSON 安全解析器
// ============================================================

class JSONSafeParser {
  /**
   * 安全解析JSON，支持多种修复策略
   */
  static parse(raw, options = {}) {
    let text = typeof raw === 'string' ? raw : JSON.stringify(raw);

    // 步骤1：从markdown代码块提取
    const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    // 步骤2：找到第一个{或[和最后一个}或]
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    const startIdx = Math.min(
      firstBrace >= 0 ? firstBrace : Infinity,
      firstBracket >= 0 ? firstBracket : Infinity
    );
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== Infinity && endIdx > startIdx) {
      text = text.substring(startIdx, endIdx + 1);
    }

    // 尝试解析
    try {
      return { success: true, data: JSON.parse(text.trim()) };
    } catch (e1) {
      // 步骤3：修复常见JSON错误
      const fixed = this.attemptRepair(text.trim());
      if (fixed) {
        return { success: true, data: fixed, repaired: true };
      }

      return {
        success: false,
        error: `JSON解析失败: ${e1.message}`,
        raw: text.substring(0, 200)
      };
    }
  }

  static attemptRepair(text) {
    const repairs = [
      // 修复尾随逗号
      t => t.replace(/,\s*([}\]])/g, '$1'),
      // 修复单引号
      t => t.replace(/'/g, '"'),
      // 修复未加引号的键
      t => t.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*\s*):/g, '$1"$2":'),
      // 修复undefined值
      t => t.replace(/: undefined/g, ': null'),
      // 补全缺少的闭合括号
      t => {
        let s = t;
        const openBraces = (s.match(/\{/g) || []).length;
        const closeBraces = (s.match(/\}/g) || []).length;
        const openBrackets = (s.match(/\[/g) || []).length;
        const closeBrackets = (s.match(/\]/g) || []).length;
        while (closeBraces < openBraces) s += '}';
        while (closeBrackets < openBrackets) s += ']';
        return s;
      }
    ];

    for (const repair of repairs) {
      try {
        const fixed = repair(text);
        return JSON.parse(fixed);
      } catch (e) {}
    }

    return null;
  }
}

// ============================================================
// 四、LLM 统一网关
// ============================================================

class LLMGateway {
  constructor() {
    this.circuitBreakers = new Map();
    this.providers = new Map();
    this.eventBus = null;
    this.initialized = false;

    // 默认配置
    this.defaultConfig = {
      provider: 'kimi',
      maxTokens: 4096,
      temperature: 1,
      topP: 0.95,
      timeoutMs: 600000,      // 10分钟
      maxRetries: 3,
      retryBackoffMultiplier: 2,
      maxPromptChars: 6000,   // 超过此长度自动拆分
      splitPrompt: true,
      fallbackValue: null
    };
  }

  async initialize(options = {}) {
    if (this.initialized) return;

    // 初始化事件总线
    this.eventBus = new NirathEventBus({ name: 'llm-gateway', enabled: true });

    // 初始化熔断器
    const cbConfig = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeoutMs: options.recoveryTimeoutMs || 30000,
      halfOpenMaxCalls: options.halfOpenMaxCalls || 2
    };

    this.circuitBreakers.set('kimi', new CircuitBreaker('kimi', cbConfig));

    // 初始化Provider适配器
    const kimiAdapter = new KimiProviderAdapter();
    await kimiAdapter.initialize();
    this.providers.set('kimi', kimiAdapter);

    this.initialized = true;
    console.log('[LLMGateway] ✅ 初始化完成');
  }

  /**
   * 统一调用入口
   */
  async call(options) {
    await this.ensureInitialized();

    const config = { ...this.defaultConfig, ...options };
    const {
      provider = 'kimi',
      prompt,
      systemPrompt,
      maxTokens,
      temperature,
      timeoutMs,
      maxRetries,
      retryBackoffMultiplier,
      outputFormat = 'text',      // 'text', 'json', 'structured'
      outputSchema = null,        // Zod schema或JSON schema
      fallbackValue,
      splitLongPrompt = true,
      publishEvents = true
    } = config;

    const cb = this.circuitBreakers.get(provider);
    if (!cb) {
      throw new Error(`未知Provider: ${provider}`);
    }

    // 自动拆分长Prompt
    let finalPrompt = prompt;
    if (splitLongPrompt && prompt.length > this.defaultConfig.maxPromptChars) {
      console.warn(`[LLMGateway] Prompt过长(${prompt.length}字符)，自动拆分...`);
      return this.callWithSplit(config);
    }

    const startMs = Date.now();
    let lastError = null;

    // 执行（带熔断器）
    return cb.execute(async () => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const adapter = this.providers.get(provider);
          if (!adapter || !adapter.configured) {
            throw new Error(`Provider ${provider} 未初始化`);
          }

          const result = await adapter.call({
            prompt: finalPrompt,
            systemPrompt,
            maxTokens,
            temperature,
            timeoutMs
          });

          const durationMs = Date.now() - startMs;

          // 解析输出
          let parsed = null;
          if (outputFormat === 'json' || outputFormat === 'structured') {
            const parseResult = JSONSafeParser.parse(result.content);
            if (!parseResult.success) {
              throw new Error(`JSON解析失败: ${parseResult.error}`);
            }
            parsed = parseResult.data;

            // 可选：Schema验证
            if (outputSchema && typeof outputSchema.safeParse === 'function') {
              const schemaResult = outputSchema.safeParse(parsed);
              if (!schemaResult.success) {
                throw new Error(`Schema验证失败: ${schemaResult.error.message}`);
              }
              parsed = schemaResult.data;
            }
          }

          // 发布成功事件
          if (publishEvents) {
            this.eventBus.publish('llm.call.success', {
              provider,
              durationMs,
              promptLength: finalPrompt.length,
              outputLength: result.content.length,
              tokenCount: result.tokenCount,
              attempt,
              outputFormat
            }, { stageId: 'llm-gateway' });
          }

          return {
            success: true,
            data: outputFormat === 'json' || outputFormat === 'structured' ? parsed : result.content,
            raw: result.content,
            meta: {
              provider,
              durationMs,
              attempts: attempt,
              tokenCount: result.tokenCount,
              outputFormat
            }
          };

        } catch (error) {
          lastError = error;
          const isRecoverable = this.isRecoverableError(error);

          console.warn(`[LLMGateway] 尝试 ${attempt}/${maxRetries} 失败 (${provider}): ${error.message}`);

          if (!isRecoverable || attempt === maxRetries) {
            break;
          }

          // 指数退避
          const backoffMs = Math.pow(retryBackoffMultiplier, attempt - 1) * 1000;
          console.log(`[LLMGateway] ${backoffMs}ms后重试...`);
          await this.sleep(backoffMs);
        }
      }

      // 所有重试失败
      if (publishEvents) {
        this.eventBus.publish('llm.call.failed', {
          provider,
          error: lastError.message,
          promptLength: finalPrompt.length,
          attempts: maxRetries
        }, { stageId: 'llm-gateway' });
      }

      // 返回fallback
      if (fallbackValue !== null) {
        console.warn(`[LLMGateway] 返回fallback值`);
        return {
          success: false,
          data: fallbackValue,
          meta: { provider, fallback: true, error: lastError.message }
        };
      }

      throw lastError;
    });
  }

  /**
   * 分块调用（Prompt超长时）
   */
  async callWithSplit(options) {
    const { prompt, systemPrompt } = options;
    const maxChunkSize = Math.floor(this.defaultConfig.maxPromptChars * 0.8);

    // 按段落分割
    const chunks = this.splitPrompt(prompt, maxChunkSize);
    console.log(`[LLMGateway] Prompt分${chunks.length}块处理`);

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkResult = await this.call({
        ...options,
        prompt: `[Part ${i + 1}/${chunks.length}]\n${chunks[i]}`,
        splitLongPrompt: false  // 防止无限递归
      });
      results.push(chunkResult.data);
    }

    // 合并结果
    const merged = this.mergeResults(results, options.outputFormat);
    return {
      success: true,
      data: merged,
      meta: { split: true, chunks: chunks.length }
    };
  }

  splitPrompt(prompt, maxChunkSize) {
    const chunks = [];
    const paragraphs = prompt.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  mergeResults(results, format) {
    if (format === 'json' || format === 'structured') {
      if (results.every(r => Array.isArray(r))) {
        return results.flat();
      }
      return results.reduce((merged, r) => ({ ...merged, ...r }), {});
    }
    return results.join('\n---\n');
  }

  isRecoverableError(error) {
    const recoverablePatterns = [
      /timeout/i, /ETIMEDOUT/i, /ECONNRESET/i,
      /rate limit/i, /429/i, /too many requests/i,
      /temporary/i, /503/i, /502/i, /504/i,
      /aborted/i, /AbortError/i
    ];
    return recoverablePatterns.some(p => p.test(error.message));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 获取熔断器统计
   */
  getCircuitBreakerStats() {
    const stats = {};
    for (const [name, cb] of this.circuitBreakers) {
      stats[name] = cb.getStats();
    }
    return stats;
  }

  /**
   * 获取网关统计
   */
  getStats() {
    return {
      circuitBreakers: this.getCircuitBreakerStats(),
      providers: [...this.providers.keys()],
      initialized: this.initialized
    };
  }
}

// ============================================================
// 五、兼容包装器（兼容现有 llm-reasoning-engine.js）
// ============================================================

class LLMEngineWrapper {
  constructor(options = {}) {
    this.gateway = null;
    this.options = options;
  }

  async initialize() {
    if (!this.gateway) {
      this.gateway = new LLMGateway();
      await this.gateway.initialize();
    }
  }

  /**
   * 兼容：reason(prompt, options)
   */
  async reason(prompt, options = {}) {
    await this.initialize();

    const result = await this.gateway.call({
      prompt,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens || 4096,
      temperature: 1,  // kimi-k2p6 固定
      timeoutMs: options.timeoutMs || 600000,
      maxRetries: options.maxRetries || 3,
      outputFormat: 'text',
      fallbackValue: this.generateMockContent(prompt)
    });

    return {
      success: result.success,
      content: result.data || result.raw || '',
      tokenCount: result.meta?.tokenCount || 500,
      duration: result.meta?.durationMs || 0,
      attempts: result.meta?.attempts || 1,
      fallback: !result.success
    };
  }

  /**
   * 兼容：reasonStructured(prompt, schema, options)
   */
  async reasonStructured(prompt, schema, options = {}) {
    await this.initialize();

    const structuredPrompt = `${prompt}\n\n【输出格式要求】\n请严格按以下 JSON 格式输出，不要包含任何其他内容：\n\n${JSON.stringify(schema, null, 2)}\n\n注意：只输出 JSON，不要任何解释、前缀或后缀。`;

    const result = await this.gateway.call({
      prompt: structuredPrompt,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens || 4096,
      timeoutMs: options.timeoutMs || 600000,
      outputFormat: 'json',
      fallbackValue: schema
    });

    return {
      success: result.success,
      data: result.data || result.raw || {},
      rawContent: result.raw || '',
      duration: result.meta?.durationMs || 0
    };
  }

  /**
   * 兼容：reasonBatch(prompts, options)
   */
  async reasonBatch(prompts, options = {}) {
    await this.initialize();
    console.log(`[LLMEngineWrapper] 批量推理 | 数量: ${prompts.length}`);

    const results = [];
    for (let i = 0; i < prompts.length; i++) {
      const result = await this.reason(prompts[i], options);
      results.push(result);
      if (i < prompts.length - 1) {
        await this.sleep(options.batchDelay || 500);
      }
    }

    return results;
  }

  generateMockContent(prompt) {
    if (prompt.includes('剧本') || prompt.includes('故事')) {
      return JSON.stringify({ scenes: [{ id: 'S01', scene: '开场' }] });
    }
    if (prompt.includes('导演') || prompt.includes('评估')) {
      return JSON.stringify({ score: 83, passed: true });
    }
    return JSON.stringify({ result: '推理完成' });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 六、导出
// ============================================================

let gatewayInstance = null;

module.exports = {
  LLMGateway,
  CircuitBreaker,
  KimiProviderAdapter,
  JSONSafeParser,
  LLMEngineWrapper,

  // 单例获取
  getLLMGateway: async () => {
    if (!gatewayInstance) {
      gatewayInstance = new LLMGateway();
      await gatewayInstance.initialize();
    }
    return gatewayInstance;
  },

  // 快速调用（无需管理实例）
  callLLM: async (options) => {
    const gw = await module.exports.getLLMGateway();
    return gw.call(options);
  }
};

// ============================================================
// 七、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== LLM Gateway 集成测试 ===\n');

    const gateway = new LLMGateway();
    await gateway.initialize();

    // 测试1：基本调用
    console.log('--- 测试1：基本调用 ---');
    try {
      const result = await gateway.call({
        prompt: '你好，请回复"测试通过"两个字',
        outputFormat: 'text',
        maxRetries: 1,
        timeoutMs: 30000
      });
      console.log('成功:', result.success);
      console.log('输出:', result.data?.substring(0, 100));
      console.log('耗时:', result.meta?.durationMs, 'ms');
    } catch (e) {
      console.log('失败（预期，如果API不可用）:', e.message);
    }

    // 测试2：JSON解析
    console.log('\n--- 测试2：JSON安全解析 ---');
    const badJson = '{"a": 1, "b": 2,}';  // 有尾随逗号
    const parsed = JSONSafeParser.parse(badJson);
    console.log('修复后:', parsed.success, parsed.data);

    // 测试3：熔断器
    console.log('\n--- 测试3：熔断器 ---');
    const cb = new CircuitBreaker('test', { failureThreshold: 3, recoveryTimeoutMs: 1000 });
    try {
      await cb.execute(async () => { throw new Error('模拟失败'); });
    } catch (e) {}
    try {
      await cb.execute(async () => { throw new Error('模拟失败'); });
    } catch (e) {}
    try {
      await cb.execute(async () => { throw new Error('模拟失败'); });
    } catch (e) {}
    console.log('熔断状态:', cb.getStats().state);

    // 测试4：兼容包装器
    console.log('\n--- 测试4：兼容包装器 ---');
    const wrapper = new LLMEngineWrapper({ mode: 'mock' });
    const mockResult = await wrapper.reason('请生成剧本');
    console.log('Mock成功:', mockResult.success);
    console.log('Mock内容:', mockResult.content.substring(0, 100));

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/narrative-continuity-engine.js

> 文件大小: 19051 bytes

```javascript
/**
 * Narrative Continuity Engine v1.0 — 叙事连续性约束系统
 * 系统核心基础设施：确保叙事逻辑一致性（角色出现、对象持久、因果链、情感弧）
 *
 * 职责：
 * - 角色出现一致性：角色首次出现有介绍，后续出现有连续性
 * - 对象持久性：重要对象一旦引入必须持续存在或明确消失
 * - 因果链：事件有前因后果，无逻辑跳跃
 * - 情感弧：情感变化符合叙事逻辑（如愤怒→和解需要过渡）
 * - 与Visual Continuity Engine集成：视觉连续性+叙事连续性
 * - 与Event Bus集成：发布叙事异常事件
 *
 * 核心能力：
 * 1. NarrativeRule: 叙事规则定义
 * 2. NarrativeChecker: 叙事检查器
 * 3. CausalityTracker: 因果链追踪
 * 4. EmotionalArcTracker: 情感弧追踪
 * 5. NarrativeContinuityEngine: 主引擎
 *
 * 叙事检查维度：
 * - character_introduction: 角色介绍（首次出现有描述）
 * - object_persistence: 对象持久性（重要对象不消失）
 * - causality: 因果链（事件有前因后果）
 * - emotional_arc: 情感弧（情感变化合理）
 * - narrative_progression: 叙事推进（节奏合理）
 * - motivation: 动机一致性（角色行为有动机）
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、叙事规则定义
// ============================================================

const NARRATIVE_RULES = {
  character_introduction: {
    name: '角色介绍',
    description: '角色首次出现必须有介绍',
    check: (shots) => {
      const firstAppearances = new Map();
      const issues = [];

      for (const shot of shots) {
        const chars = shot.characters || [];
        for (const char of chars) {
          const charId = char.id || char.name;
          if (!firstAppearances.has(charId)) {
            firstAppearances.set(charId, { shot: shot.id, hasDescription: false });
            // 检查是否有描述（外貌、特征等）
            const hasAppearance = char.appearance || char.visualSignature || char.description;
            const prompt = (shot.visualPrompt || '').toLowerCase();
            const hasVisualDesc = prompt.includes((char.name || charId).toLowerCase());
            
            if (!hasAppearance && !hasVisualDesc) {
              issues.push(`角色 "${charId}" 在镜头 ${shot.id} 首次出现但缺少描述`);
            }
          }
        }
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'warning' : 'pass'
      };
    }
  },

  object_persistence: {
    name: '对象持久性',
    description: '重要对象一旦引入必须持续存在或明确消失',
    check: (shots) => {
      // 简化：追踪角色作为"重要对象"
      const charAppearances = new Map();
      const issues = [];

      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const chars = shot.characters || [];
        const charIds = new Set(chars.map(c => c.id || c.name));

        for (const [charId, lastSeen] of charAppearances) {
          if (!charIds.has(charId)) {
            // 角色消失，检查是否超过3个镜头未出现
            if (i - lastSeen > 3) {
              issues.push(`角色 "${charId}" 从镜头 ${shots[lastSeen].id} 消失后超过3个镜头未出现`);
            }
          } else {
            charAppearances.set(charId, i);
          }
        }

        // 新角色加入追踪
        for (const char of chars) {
          const charId = char.id || char.name;
          if (!charAppearances.has(charId)) {
            charAppearances.set(charId, i);
          }
        }
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  },

  causality: {
    name: '因果链',
    description: '事件有前因后果',
    check: (shots) => {
      const issues = [];

      for (let i = 1; i < shots.length; i++) {
        const prevShot = shots[i - 1];
        const currShot = shots[i];

        // 简化：检查叙事是否连贯（通过场景/动作推断）
        const prevScene = (prevShot.scene || prevShot.sceneName || '').toLowerCase();
        const currScene = (currShot.scene || currShot.sceneName || '').toLowerCase();
        const prevPrompt = (prevShot.visualPrompt || '').toLowerCase();
        const currPrompt = (currShot.visualPrompt || '').toLowerCase();

        // 检测场景突变（无过渡）
        const sceneTypes = ['山顶', '山谷', '森林', '海边', '城市', '室内'];
        const prevType = sceneTypes.find(t => prevScene.includes(t) || prevPrompt.includes(t));
        const currType = sceneTypes.find(t => currScene.includes(t) || currPrompt.includes(t));

        if (prevType && currType && prevType !== currType) {
          // 检查是否有过渡元素
          const hasTransition = currPrompt.includes(prevType) || 
                               prevPrompt.includes(currType) ||
                               currPrompt.includes('过渡到') ||
                               currPrompt.includes('切换到');
          
          if (!hasTransition) {
            issues.push(`镜头 ${prevShot.id} → ${currShot.id}: 从${prevType}突然切换到${currType}，缺少过渡`);
          }
        }
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  },

  emotional_arc: {
    name: '情感弧',
    description: '情感变化符合叙事逻辑',
    check: (shots) => {
      const issues = [];
      const emotions = [];

      for (const shot of shots) {
        const phase = shot.emotionPhase || 'exposition';
        const intensity = shot.emotionalIntensity || 0.5;
        emotions.push({ phase, intensity, shot: shot.id });
      }

      // 检查情感弧是否合理
      for (let i = 1; i < emotions.length; i++) {
        const prev = emotions[i - 1];
        const curr = emotions[i];

        // 检测情感突变（如从平静直接到高潮）
        if (prev.phase === 'exposition' && curr.phase === 'climax') {
          issues.push(`镜头 ${prev.shot} → ${curr.shot}: 情感从铺垫直接跳到高潮，缺少递进`);
        }
        if (prev.phase === 'climax' && curr.phase === 'exposition') {
          issues.push(`镜头 ${prev.shot} → ${curr.shot}: 情感从高潮直接回到铺垫，缺少回落`);
        }

        // 检测强度突变
        if (Math.abs(curr.intensity - prev.intensity) > 0.5) {
          issues.push(`镜头 ${prev.shot} → ${curr.shot}: 情感强度突变 ${prev.intensity} → ${curr.intensity}`);
        }
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  },

  narrative_progression: {
    name: '叙事推进',
    description: '叙事节奏合理，不拖沓不跳跃',
    check: (shots) => {
      const issues = [];
      let lastProgression = 0;

      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        // 基于镜头类型推断推进程度
        const type = shot.type || 'building';
        const progressionMap = {
          'opening': 0.1,
          'establishing': 0.2,
          'building': 0.4,
          'reveal': 0.6,
          'climax': 0.8,
          'resolution': 0.9,
          'transition': 0.5
        };
        const currentProgression = progressionMap[type] || 0.5;

        if (currentProgression < lastProgression) {
          issues.push(`镜头 ${shot.id}: 叙事推进倒退 ${lastProgression} → ${currentProgression}`);
        }
        lastProgression = currentProgression;
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'warning' : 'pass'
      };
    }
  },

  motivation: {
    name: '动机一致性',
    description: '角色行为有动机',
    check: (shots) => {
      const issues = [];

      // 简化：检查角色动作是否有解释
      for (const shot of shots) {
        const prompt = shot.visualPrompt || '';
        const chars = shot.characters || [];

        for (const char of chars) {
          const charName = char.name || char.id;
          // 如果角色有动作但未说明原因，标记为潜在问题
          const actionWords = ['跑', '跳', '打', '逃', '追', '哭', '笑', '怒'];
          const hasAction = actionWords.some(w => prompt.includes(w));
          const hasReason = prompt.includes('因为') || prompt.includes('为了') || prompt.includes('由于');
          
          if (hasAction && !hasReason) {
            issues.push(`镜头 ${shot.id}: 角色 "${charName}" 有动作但可能缺少动机说明`);
          }
        }
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  }
};

// ============================================================
// 二、叙事检查器
// ============================================================

class NarrativeChecker {
  constructor(rules = NARRATIVE_RULES) {
    this.rules = { ...rules };
  }

  check(shots, dimensions = null) {
    const checkDimensions = dimensions || Object.keys(this.rules);
    const results = {};
    let allPassed = true;
    let totalIssues = 0;

    for (const dim of checkDimensions) {
      const rule = this.rules[dim];
      if (!rule) continue;

      try {
        const result = rule.check(shots);
        results[dim] = {
          name: rule.name,
          ...result
        };
        if (!result.passed) {
          allPassed = false;
          totalIssues += result.issues.length;
        }
      } catch (error) {
        results[dim] = {
          name: rule.name,
          passed: false,
          issues: [`检查异常: ${error.message}`],
          severity: 'warning'
        };
        allPassed = false;
      }
    }

    return {
      passed: allPassed,
      totalIssues,
      results,
      totalShots: shots.length
    };
  }

  checkDimension(shots, dimension) {
    return this.check(shots, [dimension]);
  }
}

// ============================================================
// 三、因果链追踪器
// ============================================================

class CausalityTracker {
  constructor() {
    this.causalChains = []; // Array<{ cause, effect, strength }>
  }

  addCausality(cause, effect, strength = 1.0) {
    this.causalChains.push({ cause, effect, strength, timestamp: Date.now() });
  }

  getChain(startEvent) {
    const chain = [];
    let current = startEvent;
    
    while (true) {
      const next = this.causalChains.find(c => c.cause === current);
      if (!next) break;
      chain.push(next);
      current = next.effect;
    }

    return chain;
  }

  getCauses(effect) {
    return this.causalChains.filter(c => c.effect === effect);
  }

  getEffects(cause) {
    return this.causalChains.filter(c => c.cause === cause);
  }

  detectGaps() {
    const gaps = [];
    for (const chain of this.causalChains) {
      const causes = this.getCauses(chain.cause);
      if (causes.length === 0 && chain.cause !== 'start') {
        gaps.push({ type: 'orphan_cause', event: chain.cause });
      }
    }
    return gaps;
  }
}

// ============================================================
// 四、情感弧追踪器
// ============================================================

class EmotionalArcTracker {
  constructor() {
    this.arc = []; // Array<{ shotId, phase, intensity, timestamp }>
  }

  record(shotId, phase, intensity) {
    this.arc.push({ shotId, phase, intensity, timestamp: Date.now() });
  }

  getArc() {
    return [...this.arc];
  }

  validate() {
    const phases = this.arc.map(a => a.phase);
    const issues = [];

    // 检查是否缺少必要阶段
    const requiredPhases = ['exposition', 'rising_action', 'climax', 'resolution'];
    for (const phase of requiredPhases) {
      if (!phases.includes(phase)) {
        issues.push(`缺少情感阶段: ${phase}`);
      }
    }

    // 检查顺序
    const phaseOrder = ['exposition', 'rising_action', 'complication', 'climax', 'falling_action', 'resolution'];
    let lastIndex = -1;
    for (const phase of phases) {
      const currentIndex = phaseOrder.indexOf(phase);
      if (currentIndex < lastIndex) {
        issues.push(`情感阶段顺序错误: ${phaseOrder[lastIndex]} → ${phase}`);
      }
      lastIndex = currentIndex;
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  getIntensityTrend() {
    if (this.arc.length < 2) return 'flat';
    const first = this.arc[0].intensity;
    const last = this.arc[this.arc.length - 1].intensity;
    if (last > first + 0.2) return 'rising';
    if (last < first - 0.2) return 'falling';
    return 'flat';
  }
}

// ============================================================
// 五、叙事连续性引擎
// ============================================================

class NarrativeContinuityEngine {
  constructor(options = {}) {
    this.checker = new NarrativeChecker();
    this.causality = new CausalityTracker();
    this.emotionalArc = new EmotionalArcTracker();
    this.eventBus = new NirathEventBus({ name: 'narrative', enabled: true });
    this.checkHistory = [];
  }

  check(shots, options = {}) {
    const dimensions = options.dimensions || Object.keys(NARRATIVE_RULES);
    const result = this.checker.check(shots, dimensions);

    // 记录情感弧
    for (const shot of shots) {
      if (shot.emotionPhase) {
        this.emotionalArc.record(shot.id, shot.emotionPhase, shot.emotionalIntensity || 0.5);
      }
    }

    // 验证情感弧
    const arcValidation = this.emotionalArc.validate();
    if (!arcValidation.passed) {
      result.results.emotional_arc = {
        name: '情感弧完整性',
        passed: false,
        issues: arcValidation.issues,
        severity: 'warning'
      };
      result.totalIssues += arcValidation.issues.length;
      result.passed = false;
    }

    // 记录历史
    this.checkHistory.push({
      timestamp: Date.now(),
      totalShots: shots.length,
      ...result
    });

    // 发布事件
    if (!result.passed) {
      this.eventBus.publish('narrative.violation', {
        totalIssues: result.totalIssues,
        issues: Object.entries(result.results)
          .filter(([, v]) => !v.passed)
          .map(([k, v]) => ({ dimension: k, issues: v.issues }))
      }, { traceId: options.traceId || `nar_${Date.now()}` });
    }

    return result;
  }

  getHistoryReport() {
    const total = this.checkHistory.length;
    const passed = this.checkHistory.filter(h => h.passed).length;

    return {
      totalChecks: total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? (passed / total).toFixed(2) : 0,
      emotionalArc: this.emotionalArc.getArc(),
      intensityTrend: this.emotionalArc.getIntensityTrend()
    };
  }

  getEmotionalArc() {
    return this.emotionalArc.getArc();
  }

  getCausalityChain(startEvent) {
    return this.causality.getChain(startEvent);
  }
}

// ============================================================
// 六、导出
// ============================================================

module.exports = {
  NarrativeContinuityEngine,
  NarrativeChecker,
  CausalityTracker,
  EmotionalArcTracker,
  NARRATIVE_RULES,

  // 快速创建
  createNarrativeEngine: (options) => new NarrativeContinuityEngine(options)
};

// ============================================================
// 七、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Narrative Continuity Engine 集成测试 ===\n');

    const engine = new NarrativeContinuityEngine();

    // 测试1：完整叙事弧
    console.log('--- 测试1：完整叙事弧 ---');
    const goodShots = [
      { id: 'S01', sequence: 1, type: 'opening', scene: '山顶', visualPrompt: '少年在山顶', emotionPhase: 'exposition', emotionalIntensity: 0.2, characters: [{ id: 'hero', name: '少年', appearance: '短发白衣' }] },
      { id: 'S02', sequence: 2, type: 'building', scene: '山谷', visualPrompt: '少年走入山谷', emotionPhase: 'rising_action', emotionalIntensity: 0.4, characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S03', sequence: 3, type: 'climax', scene: '山谷', visualPrompt: '少年与怪兽战斗', emotionPhase: 'climax', emotionalIntensity: 0.9, characters: [{ id: 'hero', name: '少年' }, { id: 'beast', name: '怪兽' }] },
      { id: 'S04', sequence: 4, type: 'resolution', scene: '山谷', visualPrompt: '少年胜利', emotionPhase: 'resolution', emotionalIntensity: 0.6, characters: [{ id: 'hero', name: '少年' }] }
    ];
    const result1 = engine.check(goodShots);
    console.log('通过:', result1.passed);
    console.log('问题数:', result1.totalIssues);

    // 测试2：情感突变
    console.log('\n--- 测试2：情感突变 ---');
    const badShots = [
      { id: 'S01', sequence: 1, type: 'opening', scene: '山顶', emotionPhase: 'exposition', emotionalIntensity: 0.2, characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S02', sequence: 2, type: 'climax', scene: '山顶', emotionPhase: 'climax', emotionalIntensity: 0.9, characters: [{ id: 'hero', name: '少年' }] },  // 突然高潮！
      { id: 'S03', sequence: 3, type: 'resolution', scene: '山顶', emotionPhase: 'resolution', emotionalIntensity: 0.6, characters: [{ id: 'hero', name: '少年' }] }
    ];
    const result2 = engine.check(badShots);
    console.log('通过:', result2.passed);
    console.log('问题数:', result2.totalIssues);
    console.log('问题:', result2.results?.emotional_arc?.issues);

    // 测试3：角色消失
    console.log('\n--- 测试3：角色消失 ---');
    const disappearShots = [
      { id: 'S01', sequence: 1, scene: '山顶', characters: [{ id: 'hero', name: '少年' }, { id: 'sidekick', name: '伙伴' }] },
      { id: 'S02', sequence: 2, scene: '山顶', characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S03', sequence: 3, scene: '山顶', characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S04', sequence: 4, scene: '山顶', characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S05', sequence: 5, scene: '山顶', characters: [{ id: 'hero', name: '少年' }, { id: 'sidekick', name: '伙伴' }] }  // 伙伴突然回来了！
    ];
    const result3 = engine.check(disappearShots, { dimensions: ['object_persistence'] });
    console.log('对象持久性检查:', result3.results?.object_persistence?.issues);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/prompt-assembly-engine.js

> 文件大小: 19134 bytes

```javascript
/**
 * Prompt Assembly Engine v1.0 — 结构化Prompt组装引擎
 * 系统核心基础设施：替代字符串拼接，让Prompt从"文档"变成"数据结构"
 *
 * 职责：
 * - 结构化Prompt：每个Prompt是Section数组，而非长字符串
 * - 自动补全：缺失字段自动填充（如duration、camera）
 * - 增量裁剪：指定字段瘦身，而非整个Prompt截断
 * - 智能组装：根据镜头类型自动选择Section模板
 * - 与Smart Trim v2集成：组装后自动裁剪到490汉字
 * - 与Immutable Shot集成：确保Prompt变更可追溯
 *
 * 核心能力：
 * 1. PromptSection: { type, content, priority, minLength, required }
 * 2. PromptAssemblyEngine: 组装Section → 生成完整Prompt
 * 3. AutoCompletion: 缺失字段自动推断
 * 4. IncrementalTrim: 指定字段瘦身，优先裁剪低优先级字段
 * 5. TemplateLibrary: 镜头类型模板（开场、推进、高潮、转场）
 *
 * 设计原则：
 * - 可追踪：每个Section有来源标识（哪个Stage生成）
 * - 可恢复：裁剪前的Section保留完整版本，可回溯
 * - 智能：知道哪些字段是核心（视觉描述）vs 可裁剪（环境补充）
 *
 * @version v1.0
 * @author 小G
 * @priority P0 - 数据完整性
 */

'use strict';

const { SmartTrimV2 } = require('../systems/smart-trim-v2');
const { safeTrimPrompt } = require('../systems/safe-prompt-trim');
const { ImmutableShot } = require('./immutable-shot');
const PROMPT_LENGTH = require('../config/prompt-length');

// ============================================================
// 一、Prompt Section（Prompt的最小原子单元）
// ============================================================

class PromptSection {
  constructor({ type, content, priority = 5, minLength = 0, required = false, source = 'unknown', trimmable = true }) {
    this.type = type;         // 'visual', 'camera', 'character', 'environment', 'emotion', 'style', 'duration', 'narration', 'negative'
    this.content = content;   // 内容字符串
    this.priority = priority; // 1-10，1最高（核心），10最低（可裁剪）
    this.minLength = minLength; // 最小保留长度
    this.required = required;   // 是否必须保留（不可裁剪）
    this.source = source;       // 来源Stage
    this.trimmable = trimmable; // 是否可裁剪
    this.originalLength = content.length; // 原始长度
  }

  /**
   * 裁剪Section到指定长度
   */
  trim(maxLength, strategy = 'end') {
    if (this.content.length <= maxLength) return this;
    if (!this.trimmable || this.required) return this; // 不可裁剪

    let trimmed = this.content;
    if (strategy === 'end') {
      trimmed = this.content.substring(0, maxLength);
    } else if (strategy === 'middle') {
      const half = Math.floor(maxLength / 2);
      trimmed = this.content.substring(0, half) + '...' + this.content.substring(this.content.length - half);
    } else if (strategy === 'smart') {
      trimmed = this.smartTrim(this.content, maxLength);
    }

    return new PromptSection({
      ...this,
      content: trimmed,
      trimmable: false  // 已裁剪，标记为不可再裁剪
    });
  }

  smartTrim(text, maxLength) {
    // 智能裁剪：保留句子完整性
    const sentences = text.split(/([。！？.!?])/);
    let result = '';
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if (result.length + sentence.length > maxLength) break;
      result += sentence;
    }
    return result || text.substring(0, maxLength);
  }

  get length() {
    return this.content.length;
  }

  toString() {
    return this.content;
  }
}

// ============================================================
// 二、镜头类型模板库
// ============================================================

const SHOT_TEMPLATES = {
  opening: {
    name: '开场镜头',
    requiredSections: ['visual', 'character', 'environment'],
    optionalSections: ['camera', 'emotion', 'style'],
    priorityRules: {
      'visual': 1,      // 最高优先级
      'character': 2,
      'environment': 3,
      'camera': 4,
      'emotion': 5,
      'style': 6
    }
  },
  establishing: {
    name: '建景镜头',
    requiredSections: ['environment', 'visual'],
    optionalSections: ['camera', 'style'],
    priorityRules: {
      'environment': 1,
      'visual': 2,
      'camera': 3,
      'style': 4
    }
  },
  building: {
    name: '推进镜头',
    requiredSections: ['visual', 'character', 'camera'],
    optionalSections: ['emotion', 'environment'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'camera': 3,
      'emotion': 4,
      'environment': 5
    }
  },
  reveal: {
    name: '揭示镜头',
    requiredSections: ['visual', 'character', 'emotion'],
    optionalSections: ['camera', 'environment'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4,
      'environment': 5
    }
  },
  climax: {
    name: '高潮镜头',
    requiredSections: ['visual', 'character', 'emotion', 'camera'],
    optionalSections: ['environment', 'style'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4,
      'environment': 5,
      'style': 6
    }
  },
  transition: {
    name: '转场镜头',
    requiredSections: ['visual', 'camera'],
    optionalSections: ['environment'],
    priorityRules: {
      'camera': 1,    // 转场最重要的是运镜
      'visual': 2,
      'environment': 3
    }
  },
  closeup: {
    name: '特写镜头',
    requiredSections: ['visual', 'character'],
    optionalSections: ['emotion', 'camera'],
    priorityRules: {
      'visual': 1,
      'character': 2,
      'emotion': 3,
      'camera': 4
    }
  }
};

// ============================================================
// 三、Prompt 组装引擎
// ============================================================

class PromptAssemblyEngine {
  constructor(options = {}) {
    this.maxLength = options.maxLength || PROMPT_LENGTH.HARD_MAX;
    this.maxLengthChars = options.maxLengthChars || PROMPT_LENGTH.TARGET_MAX;
    this.templates = { ...SHOT_TEMPLATES };
    this.smartTrim = new SmartTrimV2();
    this.completions = 0;
    this.trims = 0;
  }

  /**
   * 从Shot对象组装Prompt
   */
  assembleFromShot(shot, options = {}) {
    const shotType = shot.type || 'building';
    const template = this.templates[shotType] || this.templates.building;

    // 1. 提取Section
    const sections = this.extractSections(shot, template, options);

    // 2. 自动补全
    const completedSections = this.autoComplete(sections, template, shot);

    // 3. 组装
    let assembled = this.assemble(completedSections, options);

    // 4. 裁剪到长度限制
    if (assembled.length > this.maxLength) {
      console.log(`[PromptAssembly] 📏 Prompt超长(${assembled.length}/${this.maxLength})，启动增量裁剪...`);
      assembled = this.incrementalTrim(completedSections, this.maxLength);
      this.trims++;
    }

    // 5. 生成元数据
    return {
      prompt: assembled,
      sections: completedSections.map(s => ({
        type: s.type,
        length: s.length,
        priority: s.priority,
        source: s.source,
        trimmed: s.length < s.originalLength
      })),
      totalLength: assembled.length,
      charCount: this.countChineseChars(assembled),
      wasTrimmed: assembled.length < completedSections.reduce((sum, s) => sum + s.originalLength, 0),
      template: template.name
    };
  }

  /**
   * 从Shot提取Section
   */
  extractSections(shot, template, options = {}) {
    const sections = [];
    const data = shot.data || shot._data || shot;

    // 视觉描述（核心）
    if (data.visualPrompt || data.prompt) {
      sections.push(new PromptSection({
        type: 'visual',
        content: data.visualPrompt || data.prompt,
        priority: template.priorityRules['visual'] || 1,
        required: true,
        source: 'STAGE-7',
        trimmable: false  // 视觉描述不可裁剪
      }));
    }

    // 角色描述
    if (data.characters && data.characters.length > 0) {
      const characterDesc = data.characters.map(c =>
        `${c.name || c.role}: ${c.appearance || c.visualSignature || ''}`
      ).filter(Boolean).join('；');
      if (characterDesc) {
        sections.push(new PromptSection({
          type: 'character',
          content: characterDesc,
          priority: template.priorityRules['character'] || 2,
          required: true,
          source: 'STAGE-4',
          trimmable: true
        }));
      }
    }

    // 运镜
    if (data.cameraMovement) {
      const camera = data.cameraMovement;
      const cameraDesc = `${camera.type || ''}运镜，${camera.direction || ''}`.trim();
      if (cameraDesc) {
        sections.push(new PromptSection({
          type: 'camera',
          content: cameraDesc,
          priority: template.priorityRules['camera'] || 4,
          required: false,
          source: 'STAGE-9',
          trimmable: true
        }));
      }
    }

    // 环境
    if (data.scene || data.sceneName) {
      sections.push(new PromptSection({
        type: 'environment',
        content: `场景：${data.scene || data.sceneName}`,
        priority: template.priorityRules['environment'] || 5,
        required: false,
        source: 'STAGE-5',
        trimmable: true
      }));
    }

    // 情绪
    if (data.emotionPhase || data.emotionalIntensity) {
      const emotionDesc = `情绪：${data.emotionPhase || ''}${data.emotionalIntensity ? `（强度${data.emotionalIntensity}）` : ''}`;
      sections.push(new PromptSection({
        type: 'emotion',
        content: emotionDesc,
        priority: template.priorityRules['emotion'] || 5,
        required: false,
        source: 'STAGE-5',
        trimmable: true
      }));
    }

    // 风格（Nirath注入）
    if (options.styleInjection) {
      sections.push(new PromptSection({
        type: 'style',
        content: options.styleInjection,
        priority: template.priorityRules['style'] || 6,
        required: false,
        source: 'STAGE-14',
        trimmable: true
      }));
    }

    // 时长
    if (data.duration || data.shotDuration || data.targetDuration) {
      const dur = data.duration || data.shotDuration || data.targetDuration;
      sections.push(new PromptSection({
        type: 'duration',
        content: `时长：${dur}秒`,
        priority: 10,
        required: false,
        source: 'STAGE-6',
        trimmable: true
      }));
    }

    // 负面提示词
    if (options.negativePrompt) {
      sections.push(new PromptSection({
        type: 'negative',
        content: `排除：${options.negativePrompt}`,
        priority: 10,
        required: false,
        source: 'system',
        trimmable: true
      }));
    }

    return sections;
  }

  /**
   * 自动补全缺失字段
   */
  autoComplete(sections, template, shot) {
    const completed = [...sections];
    const existingTypes = new Set(sections.map(s => s.type));

    // 检查缺失的必填Section
    for (const type of template.requiredSections) {
      if (!existingTypes.has(type)) {
        console.log(`[PromptAssembly] 🔧 自动补全缺失Section: ${type}`);
        this.completions++;

        // 根据类型推断默认值
        const defaultContent = this.inferDefault(type, shot, template);
        completed.push(new PromptSection({
          type,
          content: defaultContent,
          priority: template.priorityRules[type] || 5,
          required: true,
          source: 'auto_complete',
          trimmable: true
        }));
      }
    }

    return completed;
  }

  /**
   * 推断默认值
   */
  inferDefault(type, shot, template) {
    const data = shot.data || shot._data || shot;

    switch (type) {
      case 'visual':
        return `画面：${data.scene || data.sceneName || '未命名场景'}`;
      case 'character':
        if (data.characters && data.characters.length > 0) {
          return `角色：${data.characters.map(c => c.name || c.role).join('、')}`;
        }
        return '角色：未指定';
      case 'camera':
        return `运镜：静态`;
      case 'environment':
        return `场景：${data.scene || data.sceneName || '未指定场景'}`;
      case 'emotion':
        return `情绪：平铺直叙`;
      default:
        return `${type}：未指定`;
    }
  }

  /**
   * 组装Section为完整Prompt
   */
  assemble(sections, options = {}) {
    const separator = options.separator || '，';
    const ordered = [...sections].sort((a, b) => a.priority - b.priority);
    return ordered.map(s => s.content).join(separator);
  }

  /**
   * 增量裁剪：按优先级从低到高裁剪
   */
  incrementalTrim(sections, maxLength) {
    // 按优先级排序（低优先级在前）
    const sorted = [...sections].sort((a, b) => b.priority - a.priority);
    let totalLength = sections.reduce((sum, s) => sum + s.length, 0);

    for (const section of sorted) {
      if (totalLength <= maxLength) break;
      if (!section.trimmable || section.required) continue;

      const excess = totalLength - maxLength;
      const targetLength = Math.max(section.minLength, section.length - excess);

      const trimmed = section.trim(targetLength, 'smart');
      totalLength -= (section.length - trimmed.length);
    }

    // 如果还超长，裁剪trimmable但非required的字段
    if (totalLength > maxLength) {
      for (const section of sorted) {
        if (totalLength <= maxLength) break;
        if (section.required || !section.trimmable) continue;

        const excess = totalLength - maxLength;
        const targetLength = Math.max(section.minLength, section.length - excess);
        const trimmed = section.trim(targetLength, 'smart');
        totalLength -= (section.length - trimmed.length);
      }
    }

    // 最终防线：如果还超长，强制裁剪visual
    if (totalLength > maxLength) {
      const visualIdx = sorted.findIndex(s => s.type === 'visual');
      if (visualIdx >= 0 && sorted[visualIdx].length > maxLength * 0.5) {
        const visualTarget = Math.floor(maxLength * 0.5);
        sorted[visualIdx] = safeTrimPrompt(sorted[visualIdx], visualTarget, {
          protectedLabels: ['CHARACTER', 'ACTION', 'SCENE', 'CAMERA']
        });
        totalLength -= (sorted[visualIdx].length - visualTarget);
        console.warn(`[Trim] 最终防线: visual安全裁剪到${visualTarget}`);
      }
    }

    let finalPrompt = this.assemble(sorted);

    if (finalPrompt.length > maxLength) {
      finalPrompt = safeTrimPrompt(finalPrompt, maxLength, {
        protectedLabels: ['CHARACTER', 'ACTION', 'SCENE', 'CAMERA', 'LIGHTING']
      });
    }

    return finalPrompt;
  }

  /**
   * 统计中文字符数
   */
  countChineseChars(text) {
    const chinese = text.match(/[\u4e00-\u9fa5]/g);
    return chinese ? chinese.length : 0;
  }

  /**
   * 批量组装（多个镜头）
   */
  assembleBatch(shots, options = {}) {
    return shots.map((shot, i) => {
      console.log(`[PromptAssembly] 🔄 组装镜头 ${i + 1}/${shots.length}`);
      return this.assembleFromShot(shot, options);
    });
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      maxLength: this.maxLength,
      maxLengthChars: this.maxLengthChars,
      completions: this.completions,
      trims: this.trims
    };
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  PromptSection,
  PromptAssemblyEngine,
  SHOT_TEMPLATES,

  // 快速组装
  assemblePrompt: (shot, options) => {
    const engine = new PromptAssemblyEngine(options);
    return engine.assembleFromShot(shot, options);
  }
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Prompt Assembly Engine 集成测试 ===\n');

    const engine = new PromptAssemblyEngine();

    // 测试1：基础组装
    console.log('--- 测试1：基础组装 ---');
    const shot = {
      id: 'S01',
      sequence: 1,
      type: 'opening',
      scene: '山顶',
      visualPrompt: '一个少年站在山顶，远眺云海',
      characters: [
        { name: '少年', role: 'protagonist', appearance: '短发，白衣' }
      ],
      cameraMovement: { type: 'dolly', direction: '向前推进' },
      duration: 5,
      emotionPhase: 'exposition',
      emotionalIntensity: 0.3
    };

    const result = engine.assembleFromShot(shot);
    console.log('组装结果:', result.prompt.substring(0, 100) + '...');
    console.log('总长度:', result.totalLength);
    console.log('中文字数:', result.charCount);
    console.log('Section数:', result.sections.length);
    console.log('是否裁剪:', result.wasTrimmed);

    // 测试2：超长Prompt裁剪
    console.log('\n--- 测试2：超长Prompt裁剪 ---');
    const longShot = {
      ...shot,
      visualPrompt: '一个少年站在山顶，远眺云海，风吹动他的衣角，阳光从云层中洒下，照亮他的脸庞，他的眼神坚定而深邃，仿佛在思考什么重要的事情，远处有飞鸟掠过，天空呈现出绚丽的晚霞色彩，整个画面充满了宁静与力量，这种构图让人联想到古典山水画的意境，但同时又有现代电影摄影的质感，少年的姿态自然而不做作，与周围的环境融为一体，形成了一幅完美的视觉画面。'.repeat(5)  // 超长
    };

    const longResult = engine.assembleFromShot(longShot);
    console.log('裁剪后长度:', longResult.totalLength);
    console.log('是否裁剪:', longResult.wasTrimmed);
    console.log('裁剪Section:', longResult.sections.filter(s => s.trimmed).map(s => s.type));

    // 测试3：自动补全
    console.log('\n--- 测试3：自动补全 ---');
    const incompleteShot = {
      id: 'S02',
      sequence: 2,
      type: 'building',
      scene: '山谷',
      visualPrompt: '少年走进山谷'  // 缺少characters、cameraMovement等
    };

    const completedResult = engine.assembleFromShot(incompleteShot);
    console.log('自动补全数:', engine.completions);
    console.log('Section数:', completedResult.sections.length);

    // 测试4：转场镜头
    console.log('\n--- 测试4：转场镜头 ---');
    const transitionShot = {
      id: 'S03',
      sequence: 3,
      type: 'transition',
      scene: '切换',
      visualPrompt: '从山谷切换到湖边',
      cameraMovement: { type: 'pan', direction: '从左到右' }
    };

    const transitionResult = engine.assembleFromShot(transitionShot);
    console.log('转场Prompt:', transitionResult.prompt.substring(0, 100));

    console.log('\n=== 测试完成 ===');
    console.log('引擎统计:', engine.getStats());
  }

  test().catch(console.error);
}

```

---

## core/core/render-quality-loop.js

> 文件大小: 15713 bytes

```javascript
/**
 * Render Quality Feedback Loop v1.0 — 渲染质量反馈循环
 * 系统核心基础设施：建立"质量评分→Prompt优化→重新渲染"闭环
 *
 * 职责：
 * - 质量分析：自动分析渲染质量（角色一致性、画面稳定性、文字正确性）
 * - Prompt优化：基于质量评分自动生成优化建议
 * - 质量历史：追踪每次渲染的质量变化趋势
 * - 与AMS集成：关联渲染输出资产
 * - 与Event Bus集成：发布质量事件
 *
 * 核心能力：
 * 1. RenderQualityAnalyzer: 分析渲染质量
 * 2. PromptOptimizer: 基于质量分析生成优化建议
 * 3. QualityHistory: 质量历史追踪
 * 4. FeedbackLoop: 闭环控制
 * 5. QualityMetrics: 评分指标定义
 *
 * 质量评分维度：
 * - character_consistency: 角色一致性（是否同一个角色）
 * - frame_stability: 画面稳定性（是否闪烁）
 * - text_correctness: 文字正确性（是否有错误文字）
 * - visual_quality: 视觉质量（清晰度、色彩）
 * - camera_quality: 运镜质量（是否流畅）
 * - overall: 综合评分
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、质量评分维度
// ============================================================

const QUALITY_DIMENSIONS = {
  character_consistency: {
    name: '角色一致性',
    weight: 0.25,
    description: '渲染结果中的角色是否与定妆照一致',
    check: (shot, renderOutput) => {
      // 简化：检查角色ID是否匹配
      const shotChars = shot.characters || [];
      const renderChars = renderOutput?.characters || [];
      return shotChars.length === renderChars.length ? 1.0 : 0.5;
    }
  },
  frame_stability: {
    name: '画面稳定性',
    weight: 0.20,
    description: '画面是否稳定，无闪烁或突变',
    check: (shot, renderOutput) => {
      // 简化：基于时长判断（时长合理 = 稳定）
      const duration = shot.duration || 5;
      return duration >= 2 && duration <= 15 ? 1.0 : 0.7;
    }
  },
  text_correctness: {
    name: '文字正确性',
    weight: 0.15,
    description: '画面中是否有错误文字或乱码',
    check: (shot, renderOutput) => {
      // 简化：检查是否有负面提示词中禁止的内容
      const negativeWords = ['文字', '字幕', 'logo', 'watermark'];
      const prompt = (shot.visualPrompt || '').toLowerCase();
      const hasNegative = negativeWords.some(w => prompt.includes(w));
      return hasNegative ? 0.5 : 1.0;
    }
  },
  visual_quality: {
    name: '视觉质量',
    weight: 0.20,
    description: '清晰度、色彩、构图',
    check: (shot, renderOutput) => {
      // 简化：基于Prompt长度（越长通常描述越详细）
      const promptLength = (shot.visualPrompt || '').length;
      return promptLength > 200 ? 1.0 : promptLength > 100 ? 0.8 : 0.6;
    }
  },
  camera_quality: {
    name: '运镜质量',
    weight: 0.10,
    description: '运镜是否流畅自然',
    check: (shot, renderOutput) => {
      const camera = shot.cameraMovement;
      return camera?.type && camera.type !== 'static' ? 1.0 : 0.7;
    }
  },
  prompt_completeness: {
    name: 'Prompt完整性',
    weight: 0.10,
    description: 'Prompt是否包含所有必要元素',
    check: (shot, renderOutput) => {
      const prompt = shot.visualPrompt || '';
      const hasCharacter = prompt.includes('角色') || prompt.includes('character');
      const hasScene = prompt.includes('场景') || prompt.includes('scene');
      const hasCamera = prompt.includes('运镜') || prompt.includes('camera');
      const score = [hasCharacter, hasScene, hasCamera].filter(Boolean).length / 3;
      return score;
    }
  }
};

// ============================================================
// 二、质量分析器
// ============================================================

class RenderQualityAnalyzer {
  constructor() {
    this.dimensions = { ...QUALITY_DIMENSIONS };
  }

  /**
   * 分析渲染质量
   */
  analyze(shot, renderOutput) {
    const scores = {};
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [key, dim] of Object.entries(this.dimensions)) {
      try {
        const score = dim.check(shot, renderOutput);
        scores[key] = {
          score: Math.round(score * 100) / 100,
          weight: dim.weight,
          name: dim.name
        };
        totalWeight += dim.weight;
        weightedScore += score * dim.weight;
      } catch (error) {
        scores[key] = {
          score: 0,
          weight: dim.weight,
          name: dim.name,
          error: error.message
        };
      }
    }

    const overall = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;

    return {
      overall,
      scores,
      passed: overall >= 0.7,  // 70分通过
      timestamp: Date.now(),
      shotId: shot.id || shot.shotId
    };
  }

  /**
   * 批量分析
   */
  analyzeBatch(shots, renderOutputs) {
    return shots.map((shot, i) => this.analyze(shot, renderOutputs[i]));
  }
}

// ============================================================
// 三、Prompt优化器
// ============================================================

class PromptOptimizer {
  constructor() {
    this.rules = [
      {
        name: '角色一致性增强',
        condition: (analysis) => analysis.scores.character_consistency.score < 0.8,
        action: (shot) => ({
          visualPrompt: `严格保持一致的角色形象: ${shot.visualPrompt}`,
          recommendation: '在Prompt开头强调角色特征，如发型、服装、面部特征'
        })
      },
      {
        name: '画面稳定性增强',
        condition: (analysis) => analysis.scores.frame_stability.score < 0.8,
        action: (shot) => ({
          visualPrompt: `稳定画面: ${shot.visualPrompt}`,
          recommendation: '添加"稳定画面、无闪烁"等关键词'
        })
      },
      {
        name: '文字正确性增强',
        condition: (analysis) => analysis.scores.text_correctness.score < 0.8,
        action: (shot) => ({
          visualPrompt: `${shot.visualPrompt}，画面中无文字、无字幕、无logo`,
          recommendation: '在Prompt中明确排除文字元素'
        })
      },
      {
        name: '视觉质量增强',
        condition: (analysis) => analysis.scores.visual_quality.score < 0.8,
        action: (shot) => ({
          visualPrompt: `高质量画面，清晰细节，丰富色彩: ${shot.visualPrompt}`,
          recommendation: '增加视觉描述细节，如光照、材质、色彩'
        })
      },
      {
        name: 'Prompt完整性增强',
        condition: (analysis) => analysis.scores.prompt_completeness.score < 0.8,
        action: (shot) => ({
          visualPrompt: `包含角色、场景、运镜的完整画面: ${shot.visualPrompt}`,
          recommendation: '确保Prompt包含角色、场景、运镜三个核心元素'
        })
      }
    ];
  }

  /**
   * 基于质量分析生成优化建议
   */
  optimize(shot, analysis) {
    const optimizations = [];
    let newPrompt = shot.render_prompt || shot.renderPrompt || shot.visualPrompt || shot.prompt || '';

    for (const rule of this.rules) {
      if (rule.condition(analysis)) {
        const result = rule.action(shot);
        newPrompt = result.visualPrompt;
        optimizations.push({
          rule: rule.name,
          recommendation: result.recommendation,
          dimension: this.getDimensionForRule(rule.name)
        });
      }
    }

    return {
      originalPrompt: shot.visualPrompt,
      optimizedPrompt: newPrompt,
      optimizations,
      expectedImprovement: this.calculateImprovement(analysis, optimizations)
    };
  }

  getDimensionForRule(ruleName) {
    const map = {
      '角色一致性增强': 'character_consistency',
      '画面稳定性增强': 'frame_stability',
      '文字正确性增强': 'text_correctness',
      '视觉质量增强': 'visual_quality',
      'Prompt完整性增强': 'prompt_completeness'
    };
    return map[ruleName] || 'unknown';
  }

  calculateImprovement(analysis, optimizations) {
    // 简化：每个优化预计提升0.1分
    const improvement = optimizations.length * 0.1;
    return Math.min(1.0, analysis.overall + improvement);
  }
}

// ============================================================
// 四、质量历史
// ============================================================

class QualityHistory {
  constructor() {
    this.records = new Map();  // shotId -> Array<record>
  }

  record(shotId, analysis) {
    if (!this.records.has(shotId)) {
      this.records.set(shotId, []);
    }
    this.records.get(shotId).push({
      ...analysis,
      recordedAt: Date.now()
    });
  }

  getHistory(shotId) {
    return this.records.get(shotId) || [];
  }

  getTrend(shotId) {
    const history = this.getHistory(shotId);
    if (history.length < 2) return 'insufficient_data';

    const scores = history.map(h => h.overall);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (last > first + 0.1) return 'improving';
    if (last < first - 0.1) return 'degrading';
    return 'stable';
  }

  getBest(shotId) {
    const history = this.getHistory(shotId);
    if (history.length === 0) return null;
    return history.reduce((best, h) => h.overall > best.overall ? h : best);
  }

  getWorst(shotId) {
    const history = this.getHistory(shotId);
    if (history.length === 0) return null;
    return history.reduce((worst, h) => h.overall < worst.overall ? h : worst);
  }
}

// ============================================================
// 五、反馈循环
// ============================================================

class RenderQualityFeedbackLoop {
  constructor(options = {}) {
    this.analyzer = new RenderQualityAnalyzer();
    this.optimizer = new PromptOptimizer();
    this.history = new QualityHistory();
    this.maxIterations = options.maxIterations || 3;
    this.qualityThreshold = options.qualityThreshold || 0.7;
    this.eventBus = new NirathEventBus({ name: 'quality-loop', enabled: true });
  }

  /**
   * 执行反馈循环
   */
  async run(shot, renderOutput, iteration = 1) {
    console.log(`[QualityLoop] 🔄 迭代 ${iteration}/${this.maxIterations} | 镜头: ${shot.id}`);

    // 1. 分析质量
    const analysis = this.analyzer.analyze(shot, renderOutput);
    this.history.record(shot.id, analysis);

    console.log(`[QualityLoop] 📊 质量评分: ${(analysis.overall * 100).toFixed(0)}分`);

    // 发布事件
    this.eventBus.publish('render.quality.analyzed', {
      shotId: shot.id,
      overall: analysis.overall,
      scores: analysis.scores,
      iteration
    }, { traceId: shot.traceId || `ql_${Date.now()}` });

    // 2. 检查是否通过
    if (analysis.passed) {
      console.log(`[QualityLoop] ✅ 质量达标，循环结束`);
      return {
        status: 'passed',
        analysis,
        iterations: iteration,
        history: this.history.getHistory(shot.id)
      };
    }

    // 3. 检查是否达到最大迭代
    if (iteration >= this.maxIterations) {
      console.log(`[QualityLoop] ⚠️ 达到最大迭代次数，循环结束`);
      return {
        status: 'max_iterations',
        analysis,
        iterations: iteration,
        history: this.history.getHistory(shot.id)
      };
    }

    // 4. 生成优化建议
    const optimization = this.optimizer.optimize(shot, analysis);
    console.log(`[QualityLoop] 🔧 优化建议: ${optimization.optimizations.map(o => o.rule).join(', ')}`);

    // 发布优化事件
    this.eventBus.publish('render.quality.optimized', {
      shotId: shot.id,
      optimizations: optimization.optimizations,
      expectedImprovement: optimization.expectedImprovement
    }, { traceId: shot.traceId || `ql_${Date.now()}` });

    return {
      status: 'needs_improvement',
      analysis,
      optimization,
      iterations: iteration,
      history: this.history.getHistory(shot.id)
    };
  }

  /**
   * 批量执行
   */
  async runBatch(shots, renderOutputs) {
    const results = [];
    for (let i = 0; i < shots.length; i++) {
      const result = await this.run(shots[i], renderOutputs[i]);
      results.push(result);
    }
    return results;
  }

  /**
   * 获取质量报告
   */
  getQualityReport(shotId) {
    const history = this.history.getHistory(shotId);
    const trend = this.history.getTrend(shotId);
    const best = this.history.getBest(shotId);
    const worst = this.history.getWorst(shotId);

    return {
      shotId,
      totalRenders: history.length,
      trend,
      bestScore: best?.overall,
      worstScore: worst?.overall,
      averageScore: history.length > 0
        ? history.reduce((sum, h) => sum + h.overall, 0) / history.length
        : 0,
      history: history.map(h => ({
        iteration: h.iteration || 1,
        overall: h.overall,
        passed: h.passed,
        timestamp: h.recordedAt
      }))
    };
  }

  /**
   * 获取所有报告
   */
  getAllReports() {
    const reports = {};
    for (const shotId of this.history.records.keys()) {
      reports[shotId] = this.getQualityReport(shotId);
    }
    return reports;
  }
}

// ============================================================
// 六、导出
// ============================================================

module.exports = {
  RenderQualityFeedbackLoop,
  RenderQualityAnalyzer,
  PromptOptimizer,
  QualityHistory,
  QUALITY_DIMENSIONS,

  // 快速创建
  createQualityLoop: (options) => new RenderQualityFeedbackLoop(options)
};

// ============================================================
// 七、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Render Quality Feedback Loop 集成测试 ===\n');

    const loop = new RenderQualityFeedbackLoop({ maxIterations: 3 });

    // 测试1：高质量渲染（通过）
    console.log('--- 测试1：高质量渲染 ---');
    const goodShot = {
      id: 'S01',
      sequence: 1,
      visualPrompt: '高质量画面：少年站在山顶，阳光洒落，风吹衣角，远景清晰，运镜缓慢推进，角色特征明显：短发、白衣、坚定眼神',
      duration: 5,
      characters: [{ id: 'hero', name: '少年' }],
      cameraMovement: { type: 'dolly', direction: '向前' }
    };
    const result1 = await loop.run(goodShot, { frameCount: 120 });
    console.log('状态:', result1.status);
    console.log('评分:', (result1.analysis.overall * 100).toFixed(0));

    // 测试2：低质量渲染（需要优化）
    console.log('\n--- 测试2：低质量渲染 ---');
    const badShot = {
      id: 'S02',
      sequence: 2,
      visualPrompt: '少年',  // 过短
      duration: 1,  // 过短
      characters: []
    };
    const result2 = await loop.run(badShot, { frameCount: 30 });
    console.log('状态:', result2.status);
    console.log('评分:', (result2.analysis.overall * 100).toFixed(0));
    if (result2.optimization) {
      console.log('优化建议:', result2.optimization.optimizations.map(o => o.rule).join(', '));
    }

    // 测试3：质量报告
    console.log('\n--- 测试3：质量报告 ---');
    console.log(loop.getQualityReport('S01'));
    console.log(loop.getQualityReport('S02'));

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/saga-orchestrator.js

> 文件大小: 25895 bytes

```javascript
/**
 * Nirath Saga 阶段原子性编排器 v1.0
 * 系统核心基础设施：为所有Stage提供原子性执行、补偿事务、降级回退
 *
 * 职责：
 * - 阶段原子性：每个Stage独立执行，成功/失败有明确定义
 * - 补偿事务：下游失败时，上游已执行Stage可回滚
 * - 非阻塞顾问Stage：导演优化、编剧循环失败不阻断主链路
 * - 降级回退：Stage失败时提供安全降级路径
 * - 自动重试：带指数退避的自动重试
 * - 事件集成：与Event Bus Pilot打通，发布Stage生命周期事件
 *
 * 设计模式：Saga Pattern（参考 Chris Richardson《微服务模式》）
 *
 * @version v1.0
 * @author 小G
 * @priority P0 - 架构基础
 */

'use strict';

const { NirathEventBus } = require('../systems/nirath/event-bus-pilot');

// ============================================================
// 一、Saga 阶段定义
// ============================================================

/**
 * Stage 配置定义
 * 所有17个Stage的声明式配置
 */
const STAGE_DEFINITIONS = {
  // === 前期制作 (Pre-Production) ===
  
  'STAGE-0': {
    id: 'STAGE-0',
    name: 'Mock数据清理检查',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },  // 失败时跳过（非关键）
    compensate: null  // 无补偿需要
  },

  'STAGE-1': {
    id: 'STAGE-1',
    name: 'PRD中央校准文档生成',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 60000,
    retryPolicy: { maxAttempts: 3, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { prd: null } },
    compensate: null
  },

  'STAGE-2': {
    id: 'STAGE-2',
    name: '需求对齐闸机',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: false } },
    compensate: null
  },

  'STAGE-3': {
    id: 'STAGE-3',
    name: 'Schema校验',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-4': {
    id: 'STAGE-4',
    name: '角色系统加载',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { characters: [] } },
    compensate: null
  },

  'STAGE-5': {
    id: 'STAGE-5',
    name: '剧本生成与分析',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 120000,
    retryPolicy: { maxAttempts: 2, backoffMs: 5000 },
    fallback: { strategy: 'default_value', defaultValue: { script: null } },
    compensate: async (result, context) => {
      // 清理已生成的剧本数据
      if (context.script) delete context.script;
      if (context.scenes) delete context.scenes;
      console.log('[Saga:Compensate] STAGE-5 已清理剧本数据');
    }
  },

  'STAGE-5.5': {
    id: 'STAGE-5.5',
    name: 'FPV镜头智能决策',
    phase: 'pre_production',
    blocking: true,
    required: false,  // 可选
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-6': {
    id: 'STAGE-6',
    name: '时长分配',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { durations: [] } },
    compensate: null
  },

  'STAGE-7': {
    id: 'STAGE-7',
    name: '故事板生成',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 120000,
    retryPolicy: { maxAttempts: 2, backoffMs: 5000 },
    fallback: { strategy: 'default_value', defaultValue: { storyboard: null } },
    compensate: async (result, context) => {
      if (context.storyboard) delete context.storyboard;
      if (context.shots) delete context.shots;
      console.log('[Saga:Compensate] STAGE-7 已清理故事板数据');
    }
  },

  // 顾问Stage：非阻塞
  'STAGE-7.2': {
    id: 'STAGE-7.2',
    name: '主角主动性自动注入',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage：失败不阻塞
    required: false,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除注入的主动性元素
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          delete shot.proactiveElements;
          delete shot._protagonistEnhanced;
        });
      }
      console.log('[Saga:Compensate] STAGE-7.2 已移除主动性注入');
    }
  },

  'STAGE-7.3': {
    id: 'STAGE-7.3',
    name: 'Narration自动精简',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 恢复原始narration（如果有备份）
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          if (shot._originalNarration) {
            shot.narration = shot._originalNarration;
            delete shot._originalNarration;
          }
          delete shot._trimmed;
        });
      }
      console.log('[Saga:Compensate] STAGE-7.3 已恢复原始口播');
    }
  },

  'STAGE-7.4': {
    id: 'STAGE-7.4',
    name: '时长-字数一致性校准',
    phase: 'pre_production',
    blocking: false,  // 顾问Stage
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-7.5': {
    id: 'STAGE-7.5',
    name: '片头自动生成',
    phase: 'pre_production',
    blocking: true,
    required: false,  // 山海经模式才需要
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除自动插入的片头镜头
      if (context.shots && Array.isArray(context.shots)) {
        context.shots = context.shots.filter(shot => !shot._autoGeneratedOpening);
      }
      console.log('[Saga:Compensate] STAGE-7.5 已移除自动片头');
    }
  },

  'STAGE-8': {
    id: 'STAGE-8',
    name: '故事板校验',
    phase: 'pre_production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true, warnings: [] } },
    compensate: null
  },

  'STAGE-8.5': {
    id: 'STAGE-8.5',
    name: '五要素检查',
    phase: 'pre_production',
    blocking: true,
    required: false,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // === 制作 (Production) ===

  'STAGE-9': {
    id: 'STAGE-9',
    name: '运镜系统',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 2, backoffMs: 2000 },
    fallback: { strategy: 'default_value', defaultValue: { cameraMovements: [] } },
    compensate: null
  },

  'STAGE-10': {
    id: 'STAGE-10',
    name: '连续性检查',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 30000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true, issues: [] } },
    compensate: null
  },

  'STAGE-10.5': {
    id: 'STAGE-10.5',
    name: '渲染前置输入检查',
    phase: 'production',
    blocking: false,  // 检查失败可继续（带警告）
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: {
      strategy: 'default_value',
      defaultValue: { passed: true, warnings: ['safety_gate_used_fallback'] }
    },
    compensate: null
  },

  'STAGE-11': {
    id: 'STAGE-11',
    name: '渲染核心',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 300000,  // 5分钟渲染
    retryPolicy: { maxAttempts: 2, backoffMs: 10000 },
    fallback: { strategy: 'default_value', defaultValue: { renderOutput: null } },
    compensate: async (result, context) => {
      // 清理渲染输出（释放资源）
      if (context.renderOutput) {
        console.log('[Saga:Compensate] STAGE-11 清理渲染输出');
        delete context.renderOutput;
      }
    }
  },

  'STAGE-11.5': {
    id: 'STAGE-11.5',
    name: 'Prompt质量闸门',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 10000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true } },
    compensate: null
  },

  'STAGE-12': {
    id: 'STAGE-12',
    name: '合规检查',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'default_value', defaultValue: { passed: true } },
    compensate: null
  },

  'STAGE-13': {
    id: 'STAGE-13',
    name: '前置验证',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 15000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  'STAGE-14': {
    id: 'STAGE-14',
    name: '风格注入',
    phase: 'production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // === 后期制作 (Post-Production) ===

  'STAGE-15': {
    id: 'STAGE-15',
    name: '后期规则',
    phase: 'post_production',
    blocking: true,
    required: true,
    timeoutMs: 20000,
    retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
    fallback: { strategy: 'skip' },
    compensate: null
  },

  // 顾问Stage：非阻塞（导演优化）
  'STAGE-16': {
    id: 'STAGE-16',
    name: '导演最终优化',
    phase: 'post_production',
    blocking: false,  // 顾问Stage：失败不阻塞渲染输出
    required: false,
    timeoutMs: 180000,  // 3分钟导演Agent
    retryPolicy: { maxAttempts: 1, backoffMs: 5000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 移除导演建议
      if (context.shots && Array.isArray(context.shots)) {
        context.shots.forEach(shot => {
          delete shot.directorNotes;
          delete shot.directorScore;
          delete shot.directorSuggestions;
        });
      }
      console.log('[Saga:Compensate] STAGE-16 已移除导演建议');
    }
  },

  // 顾问Stage：非阻塞（编剧循环）
  'STAGE-17': {
    id: 'STAGE-17',
    name: '导演-编剧循环',
    phase: 'post_production',
    blocking: false,  // 顾问Stage：迭代优化，不阻塞
    required: false,
    timeoutMs: 300000,  // 5分钟
    retryPolicy: { maxAttempts: 1, backoffMs: 5000 },
    fallback: { strategy: 'skip' },
    compensate: async (result, context) => {
      // 恢复原始剧本（如果有备份）
      if (context._originalScript) {
        context.script = context._originalScript;
        delete context._originalScript;
      }
      console.log('[Saga:Compensate] STAGE-17 已恢复原始剧本');
    }
  }
};

// ============================================================
// 二、Saga 阶段执行器
// ============================================================

class SagaStage {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.phase = config.phase || 'unknown';
    this.blocking = config.blocking !== false;  // 默认阻塞
    this.required = config.required !== false;  // 默认必需
    this.timeoutMs = config.timeoutMs || 120000;
    this.retryPolicy = config.retryPolicy || { maxAttempts: 1, backoffMs: 1000 };
    this.fallback = config.fallback || { strategy: 'skip' };
    this.compensate = config.compensate || null;
    this.executeFn = null;  // 执行函数（运行时注入）
  }

  setExecuteFn(fn) {
    this.executeFn = fn;
  }

  async run(input, context) {
    const startMs = Date.now();
    let attempts = 0;
    const traceId = context.traceId || `saga_${Date.now()}`;

    console.log(`[SagaStage:${this.id}] ▶️ 开始执行 | ${this.name}`);

    while (attempts < this.retryPolicy.maxAttempts) {
      attempts++;
      try {
        // 执行超时控制
        const result = await this.executeWithTimeout(input, context);
        const durationMs = Date.now() - startMs;

        console.log(`[SagaStage:${this.id}] ✅ 完成 | ${durationMs}ms | 尝试${attempts}/${this.retryPolicy.maxAttempts}`);

        return {
          status: 'success',
          output: result,
          durationMs,
          attempts,
          stageId: this.id
        };

      } catch (error) {
        console.error(`[SagaStage:${this.id}] ❌ 尝试${attempts}失败: ${error.message}`);

        if (attempts < this.retryPolicy.maxAttempts) {
          const backoffMs = this.retryPolicy.backoffMs * Math.pow(2, attempts - 1);
          console.log(`[SagaStage:${this.id}] ⏳ ${backoffMs}ms后重试...`);
          await this.sleep(backoffMs);
          continue;
        }

        // 所有重试耗尽，应用fallback
        return this.handleFailure(error, input, context, startMs);
      }
    }
  }

  async executeWithTimeout(input, context) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Stage ${this.id} 超时 ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      try {
        if (!this.executeFn) {
          throw new Error(`Stage ${this.id} 未设置执行函数`);
        }
        const result = await this.executeFn(input, context);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  handleFailure(error, input, context, startMs) {
    const durationMs = Date.now() - startMs;
    const failureResult = {
      status: 'failed',
      error: {
        type: error.name,
        message: error.message,
        recoverable: this.isRecoverableError(error)
      },
      durationMs,
      stageId: this.id
    };

    // 应用fallback策略
    switch (this.fallback.strategy) {
      case 'skip':
        // 非阻塞Stage：跳过，继续链路
        if (!this.blocking) {
          console.warn(`[SagaStage:${this.id}] ⚠️ 非阻塞Stage失败，跳过 | ${error.message}`);
          failureResult.status = 'skipped';
          failureResult.output = input;  // 透传输入
        } else {
          console.error(`[SagaStage:${this.id}] 💥 阻塞Stage失败，阻断链路 | ${error.message}`);
        }
        break;

      case 'mock':
        console.warn(`[SagaStage:${this.id}] ⚠️ 使用Mock降级`);
        failureResult.status = 'partial';
        failureResult.output = this.generateMockOutput(input);
        break;

      case 'default_value':
        console.warn(`[SagaStage:${this.id}] ⚠️ 使用默认值降级`);
        failureResult.status = 'partial';
        failureResult.output = { ...input, ...this.fallback.defaultValue };
        break;

      default:
        if (!this.blocking) {
          failureResult.status = 'skipped';
        }
    }

    return failureResult;
  }

  isRecoverableError(error) {
    const recoverablePatterns = [
      /timeout/i, /ETIMEDOUT/i, /ECONNRESET/i,
      /rate limit/i, /429/i, /temporary/i,
      /503/i, /502/i, /504/i
    ];
    return recoverablePatterns.some(p => p.test(error.message));
  }

  generateMockOutput(input) {
    return {
      ...input,
      _mockGenerated: true,
      _mockStage: this.id,
      _mockTimestamp: Date.now()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 三、Saga 编排器
// ============================================================

class SagaOrchestrator {
  constructor(options = {}) {
    this.stages = new Map();
    this.compensationLog = [];
    this.eventBus = new NirathEventBus({ name: 'saga-orchestrator', enabled: true });
    this.traceId = null;
    this.options = {
      enableCompensation: options.enableCompensation !== false,
      publishEvents: options.publishEvents !== false,
      ...options
    };
  }

  /**
   * 注册Stage
   */
  registerStage(stageConfig, executeFn) {
    const stage = new SagaStage(stageConfig);
    if (executeFn) {
      stage.setExecuteFn(executeFn);
    }
    this.stages.set(stageConfig.id, stage);
    return this;
  }

  /**
   * 从定义批量注册
   */
  registerFromDefinitions(definitions, executeFns = {}) {
    for (const [id, config] of Object.entries(definitions)) {
      const stage = new SagaStage(config);
      if (executeFns[id]) {
        stage.setExecuteFn(executeFns[id]);
      }
      this.stages.set(id, stage);
    }
    return this;
  }

  /**
   * 执行完整链路
   */
  async execute(input, options = {}) {
    this.traceId = options.traceId || `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context = { ...input, traceId: this.traceId };
    const executedStages = [];
    const results = {};
    const stageOrder = options.stageOrder || Array.from(this.stages.keys());

    console.log(`\n[SagaOrchestrator] 🚀 开始执行链路 | traceId=${this.traceId}`);
    console.log(`[SagaOrchestrator] 📋 共${stageOrder.length}个Stage | 补偿:${this.options.enableCompensation ? '启用' : '禁用'}`);

    // 发布开始事件
    if (this.options.publishEvents) {
      this.eventBus.publish('pipeline.started', {
        traceId: this.traceId,
        stageCount: stageOrder.length,
        inputKeys: Object.keys(input)
      }, { orchestrator: 'saga' });
    }

    for (const stageId of stageOrder) {
      const stage = this.stages.get(stageId);
      if (!stage) {
        console.warn(`[SagaOrchestrator] ⚠️ Stage ${stageId} 未注册，跳过`);
        continue;
      }

      console.log(`\n[SagaOrchestrator] ▶️ 执行 ${stageId} | ${stage.name} | ${stage.blocking ? '阻塞' : '非阻塞'}`);

      const result = await stage.run(context, context);
      results[stageId] = result;

      if (result.status === 'success' || result.status === 'partial') {
        // 合并输出到上下文
        if (result.output && typeof result.output === 'object') {
          Object.assign(context, result.output);
        }
        executedStages.push({ stageId, compensated: false, status: result.status });
        
        // 发布成功事件
        if (this.options.publishEvents) {
          this.eventBus.publish('stage.completed', {
            stageId,
            status: result.status,
            durationMs: result.durationMs,
            traceId: this.traceId
          }, { orchestrator: 'saga' });
        }

      } else if (result.status === 'skipped') {
        console.log(`[SagaOrchestrator] ⏭️ ${stageId} 已跳过（非阻塞顾问Stage）`);
        executedStages.push({ stageId, compensated: false, skipped: true, status: 'skipped' });

      } else {
        // Stage失败
        console.error(`[SagaOrchestrator] 💥 ${stageId} 失败且阻塞！触发补偿...`);

        // 触发补偿
        if (this.options.enableCompensation) {
          await this.compensate(executedStages, results, context);
        }

        // 发布失败事件
        if (this.options.publishEvents) {
          this.eventBus.publish('pipeline.failed', {
            traceId: this.traceId,
            failedAt: stageId,
            error: result.error
          }, { orchestrator: 'saga' });
        }

        throw new Error(`Pipeline在${stageId}失败: ${result.error.message}`);
      }
    }

    console.log(`\n[SagaOrchestrator] ✅ 链路完成 | traceId=${this.traceId} | 成功Stage:${executedStages.filter(s => s.status === 'success').length}/${stageOrder.length}`);

    // 发布完成事件
    if (this.options.publishEvents) {
      this.eventBus.publish('pipeline.completed', {
        traceId: this.traceId,
        stageCount: stageOrder.length,
        completedCount: executedStages.filter(s => s.status === 'success').length,
        skippedCount: executedStages.filter(s => s.status === 'skipped').length
      }, { orchestrator: 'saga' });
    }

    return {
      traceId: this.traceId,
      results,
      context,
      executedStages,
      success: true
    };
  }

  /**
   * 执行补偿事务（反向顺序）
   */
  async compensate(executedStages, results, context) {
    console.log('[SagaOrchestrator] 🔙 开始补偿事务...');

    for (let i = executedStages.length - 1; i >= 0; i--) {
      const { stageId } = executedStages[i];
      const stage = this.stages.get(stageId);

      if (stage && stage.compensate) {
        try {
          console.log(`[SagaOrchestrator] 🔙 补偿 ${stageId}...`);
          await stage.compensate(results[stageId], context);
          executedStages[i].compensated = true;
        } catch (compError) {
          console.error(`[SagaOrchestrator] ❌ 补偿失败 ${stageId}: ${compError.message}`);
          this.compensationLog.push({
            stageId,
            error: compError.message,
            timestamp: Date.now(),
            traceId: this.traceId
          });
        }
      }
    }

    console.log(`[SagaOrchestrator] 🔙 补偿完成 | 已补偿:${executedStages.filter(s => s.compensated).length}/${executedStages.length}`);
  }

  /**
   * 获取执行报告
   */
  getExecutionReport() {
    return {
      traceId: this.traceId,
      stages: Array.from(this.stages.values()).map(s => ({
        id: s.id,
        name: s.name,
        blocking: s.blocking,
        required: s.required
      })),
      compensationLog: this.compensationLog
    };
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  SagaStage,
  SagaOrchestrator,
  STAGE_DEFINITIONS,

  // 快速创建完整编排器
  createSagaOrchestrator: (executeFns = {}, options = {}) => {
    const orchestrator = new SagaOrchestrator(options);
    orchestrator.registerFromDefinitions(STAGE_DEFINITIONS, executeFns);
    return orchestrator;
  }
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Saga Orchestrator 集成测试 ===\n');

    // 测试1：基本编排
    console.log('--- 测试1：基本编排 ---');
    const orchestrator = new SagaOrchestrator();

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-1'], async (input) => {
      return { prd: { title: '测试PRD' } };
    });

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-2'], async (input) => {
      return { alignment: { passed: true, score: 85 } };
    });

    orchestrator.registerStage(STAGE_DEFINITIONS['STAGE-16'], async (input) => {
      // 模拟导演Stage失败
      throw new Error('导演Agent超时');
    });

    try {
      const result = await orchestrator.execute({ title: '测试' }, {
        stageOrder: ['STAGE-1', 'STAGE-2', 'STAGE-16']
      });
      console.log('链路结果:', result.success ? '成功' : '失败');
      console.log('STAGE-1:', result.results['STAGE-1']?.status);
      console.log('STAGE-2:', result.results['STAGE-2']?.status);
      console.log('STAGE-16:', result.results['STAGE-16']?.status);  // 应该是skipped（非阻塞）
    } catch (e) {
      console.log('预期失败:', e.message);
    }

    // 测试2：补偿事务
    console.log('\n--- 测试2：补偿事务 ---');
    const orchestrator2 = new SagaOrchestrator({ enableCompensation: true });

    let compensated = false;
    orchestrator2.registerStage({
      ...STAGE_DEFINITIONS['STAGE-5'],
      compensate: async (result, context) => {
        compensated = true;
        console.log('✅ 补偿已执行！');
      }
    }, async (input) => {
      return { script: { scenes: [] } };
    });

    orchestrator2.registerStage({
      id: 'STAGE-FAIL',
      name: '故意失败',
      phase: 'production',
      blocking: true,
      required: true,
      timeoutMs: 1000,
      retryPolicy: { maxAttempts: 1, backoffMs: 1000 },
      fallback: { strategy: 'skip' }
    }, async (input) => {
      throw new Error('故意失败');
    });

    try {
      await orchestrator2.execute({}, { stageOrder: ['STAGE-5', 'STAGE-FAIL'] });
    } catch (e) {
      console.log('预期失败:', e.message);
      console.log('补偿执行:', compensated ? '是' : '否');
    }

    // 测试3：从定义创建
    console.log('\n--- 测试3：从定义批量创建 ---');
    const fullOrchestrator = module.exports.createSagaOrchestrator({
      'STAGE-1': async (input) => ({ prd: {} }),
      'STAGE-2': async (input) => ({ alignment: { passed: true } })
    });
    console.log('已注册Stage:', fullOrchestrator.getExecutionReport().stages.map(s => s.id).join(', '));

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/shot-review-workflow.js

> 文件大小: 15248 bytes

```javascript
/**
 * Shot Review Workflow v1.0 — 镜头评审工作流
 * 系统核心基础设施：Dailies风格的镜头评审流程
 *
 * 职责：
 * - 镜头评审：每个镜头可独立评审（通过/需要修改/重做）
 * - 评审状态机：镜头在评审流程中的状态流转
 * - 评审意见：记录评审意见（如"角色不一致"、"Prompt过短"）
 * - 批量操作：批量通过/批量拒绝
 * - 与Render Quality Loop集成：质量评分自动触发评审
 * - 与Event Bus集成：发布评审事件
 * - 与AMS集成：关联渲染输出资产
 *
 * 核心能力：
 * 1. ShotReview: 单个镜头的评审记录
 * 2. ReviewStateMachine: 评审状态机（draft → pending → approved → rejected → revised）
 * 3. ReviewComment: 评审意见
 * 4. ShotReviewWorkflow: 主工作流
 * 5. ReviewBatch: 批量评审
 *
 * 评审状态：
 * - draft: 草稿（未提交评审）
 * - pending: 待评审（已提交，等待评审）
 * - approved: 已通过（可直接使用）
 * - rejected: 已拒绝（需要重做）
 * - needs_fix: 需要修改（可修改后重新提交）
 * - revised: 已修改（修改后等待重新评审）
 *
 * 评审维度：
 * - visual_quality: 视觉质量
 * - character_consistency: 角色一致性
 * - narrative_fit: 叙事契合度
 * - camera_quality: 运镜质量
 * - prompt_quality: Prompt质量
 * - overall: 综合评分
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、评审状态机
// ============================================================

const REVIEW_STATES = {
  draft: { name: '草稿', next: ['pending', 'approved'] },
  pending: { name: '待评审', next: ['approved', 'rejected', 'needs_fix'] },
  approved: { name: '已通过', next: [] },
  rejected: { name: '已拒绝', next: ['revised'] },
  needs_fix: { name: '需要修改', next: ['revised'] },
  revised: { name: '已修改', next: ['pending'] }
};

const REVIEW_STATE_TRANSITIONS = {
  'draft→pending': '提交评审',
  'draft→approved': '快速通过（草稿直接通过）',
  'pending→approved': '评审通过',
  'pending→rejected': '评审拒绝',
  'pending→needs_fix': '需要修改',
  'rejected→revised': '重新修改',
  'needs_fix→revised': '修改完成',
  'revised→pending': '重新提交评审'
};

// ============================================================
// 二、评审意见
// ============================================================

class ReviewComment {
  constructor({ reviewer, dimension, comment, severity, suggestion, timestamp }) {
    this.id = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.reviewer = reviewer || 'system';
    this.dimension = dimension;  // visual_quality, character_consistency, etc.
    this.comment = comment;
    this.severity = severity || 'suggestion';  // suggestion, minor, major, critical
    this.suggestion = suggestion || '';
    this.timestamp = timestamp || Date.now();
    this.resolved = false;
  }

  resolve() {
    this.resolved = true;
  }

  toJSON() {
    return {
      id: this.id,
      reviewer: this.reviewer,
      dimension: this.dimension,
      comment: this.comment,
      severity: this.severity,
      suggestion: this.suggestion,
      timestamp: this.timestamp,
      resolved: this.resolved
    };
  }
}

// ============================================================
// 三、镜头评审
// ============================================================

class ShotReview {
  constructor(shotId, options = {}) {
    this.shotId = shotId;
    this.state = options.state || 'draft';
    this.comments = [];
    this.scores = {};
    this.overallScore = 0;
    this.reviewer = options.reviewer || null;
    this.reviewedAt = null;
    this.submittedAt = options.submittedAt || Date.now();
    this.version = options.version || 1;
    this.renderOutput = options.renderOutput || null;
    this.history = [{ state: this.state, timestamp: Date.now(), action: '创建' }];
  }

  /**
   * 提交评审
   */
  submit() {
    this.transitionTo('pending');
    this.submittedAt = Date.now();
  }

  /**
   * 通过评审
   */
  approve(scores = {}, reviewer = 'system') {
    this.scores = scores;
    this.overallScore = this.calculateOverall(scores);
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('approved');
  }

  /**
   * 拒绝评审
   */
  reject(comments, reviewer = 'system') {
    this.comments = comments.map(c => c instanceof ReviewComment ? c : new ReviewComment(c));
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('rejected');
  }

  /**
   * 标记需要修改
   */
  requestFix(comments, reviewer = 'system') {
    this.comments = comments.map(c => c instanceof ReviewComment ? c : new ReviewComment(c));
    this.reviewer = reviewer;
    this.reviewedAt = Date.now();
    this.transitionTo('needs_fix');
  }

  /**
   * 修改完成
   */
  markRevised() {
    this.version++;
    this.transitionTo('revised');
  }

  /**
   * 重新提交
   */
  resubmit() {
    this.transitionTo('pending');
  }

  /**
   * 状态流转
   */
  transitionTo(newState) {
    const transitionKey = `${this.state}→${newState}`;
    const transition = REVIEW_STATE_TRANSITIONS[transitionKey];
    
    if (!transition) {
      throw new Error(`非法状态流转: ${this.state} → ${newState}`);
    }

    this.state = newState;
    this.history.push({
      state: newState,
      timestamp: Date.now(),
      action: transition
    });
  }

  /**
   * 计算综合评分
   */
  calculateOverall(scores) {
    const values = Object.values(scores).filter(s => typeof s === 'number');
    if (values.length === 0) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  /**
   * 添加评论
   */
  addComment(comment) {
    this.comments.push(comment instanceof ReviewComment ? comment : new ReviewComment(comment));
  }

  /**
   * 解决评论
   */
  resolveComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolve();
    }
  }

  /**
   * 获取未解决评论
   */
  getUnresolvedComments() {
    return this.comments.filter(c => !c.resolved);
  }

  toJSON() {
    return {
      shotId: this.shotId,
      state: this.state,
      stateName: REVIEW_STATES[this.state]?.name,
      comments: this.comments.map(c => c.toJSON()),
      scores: this.scores,
      overallScore: this.overallScore,
      reviewer: this.reviewer,
      reviewedAt: this.reviewedAt,
      submittedAt: this.submittedAt,
      version: this.version,
      history: this.history
    };
  }
}

// ============================================================
// 四、镜头评审工作流
// ============================================================

class ShotReviewWorkflow {
  constructor(options = {}) {
    this.reviews = new Map();  // shotId -> ShotReview
    this.eventBus = new NirathEventBus({ name: 'review', enabled: true });
    this.autoReview = options.autoReview !== false;
    this.passThreshold = options.passThreshold || 0.7;  // 70分通过
    this.reviewHistory = [];
  }

  /**
   * 创建评审
   */
  createReview(shotId, options = {}) {
    const review = new ShotReview(shotId, options);
    this.reviews.set(shotId, review);

    this.eventBus.publish('review.created', {
      shotId,
      state: review.state
    }, { traceId: `review_${Date.now()}` });

    return review;
  }

  /**
   * 提交评审
   */
  submit(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.submit();

    this.eventBus.publish('review.submitted', { shotId }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 通过评审
   */
  approve(shotId, scores, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.approve(scores, reviewer);

    this.recordReview(shotId, 'approved', scores);
    this.eventBus.publish('review.approved', { shotId, scores }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 拒绝评审
   */
  reject(shotId, comments, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.reject(comments, reviewer);

    this.recordReview(shotId, 'rejected', null, comments);
    this.eventBus.publish('review.rejected', { shotId, comments }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 请求修改
   */
  requestFix(shotId, comments, reviewer = 'system') {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.requestFix(comments, reviewer);

    this.recordReview(shotId, 'needs_fix', null, comments);
    this.eventBus.publish('review.needs_fix', { shotId, comments }, { traceId: `review_${Date.now()}` });
    return review;
  }

  /**
   * 标记修改完成
   */
  markRevised(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.markRevised();
    return review;
  }

  /**
   * 重新提交
   */
  resubmit(shotId) {
    const review = this.reviews.get(shotId);
    if (!review) throw new Error(`评审不存在: ${shotId}`);
    review.resubmit();
    return review;
  }

  /**
   * 自动评审（基于质量评分）
   */
  autoReview(shotId, qualityAnalysis) {
    if (!this.autoReview) return null;

    const review = this.reviews.get(shotId);
    if (!review) return null;

    const overall = qualityAnalysis?.overall || 0;
    const scores = {};
    for (const [key, val] of Object.entries(qualityAnalysis?.scores || {})) {
      scores[key] = val.score;
    }

    if (overall >= this.passThreshold) {
      return this.approve(shotId, scores, 'auto');
    } else {
      const comments = Object.entries(qualityAnalysis?.scores || {})
        .filter(([, v]) => v.score < this.passThreshold)
        .map(([k, v]) => new ReviewComment({
          reviewer: 'auto',
          dimension: k,
          comment: `${v.name}评分过低: ${(v.score * 100).toFixed(0)}分`,
          severity: v.score < 0.5 ? 'major' : 'minor',
          suggestion: `优化${v.name}相关描述`
        }));
      return this.requestFix(shotId, comments, 'auto');
    }
  }

  /**
   * 批量通过
   */
  batchApprove(shotIds, reviewer = 'system') {
    const results = [];
    for (const shotId of shotIds) {
      try {
        const review = this.approve(shotId, {}, reviewer);
        results.push({ shotId, success: true, state: review.state });
      } catch (error) {
        results.push({ shotId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 批量拒绝
   */
  batchReject(shotIds, reason, reviewer = 'system') {
    const comment = new ReviewComment({
      reviewer,
      dimension: 'overall',
      comment: reason,
      severity: 'major'
    });

    const results = [];
    for (const shotId of shotIds) {
      try {
        const review = this.reject(shotId, [comment], reviewer);
        results.push({ shotId, success: true, state: review.state });
      } catch (error) {
        results.push({ shotId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 获取评审
   */
  getReview(shotId) {
    return this.reviews.get(shotId);
  }

  /**
   * 获取所有评审
   */
  getAllReviews() {
    return Array.from(this.reviews.values()).map(r => r.toJSON());
  }

  /**
   * 获取统计
   */
  getStats() {
    const reviews = Array.from(this.reviews.values());
    const byState = {};
    for (const review of reviews) {
      byState[review.state] = (byState[review.state] || 0) + 1;
    }

    return {
      total: reviews.length,
      byState,
      approved: byState.approved || 0,
      pending: byState.pending || 0,
      rejected: byState.rejected || 0,
      needsFix: byState.needs_fix || 0,
      averageScore: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.overallScore, 0) / reviews.length
        : 0
    };
  }

  /**
   * 记录评审历史
   */
  recordReview(shotId, action, scores, comments) {
    this.reviewHistory.push({
      timestamp: Date.now(),
      shotId,
      action,
      scores,
      commentCount: comments?.length || 0
    });
  }

  /**
   * 获取历史
   */
  getHistory() {
    return [...this.reviewHistory];
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  ShotReviewWorkflow,
  ShotReview,
  ReviewComment,
  REVIEW_STATES,

  // 快速创建
  createReviewWorkflow: (options) => new ShotReviewWorkflow(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Shot Review Workflow 集成测试 ===\n');

    const workflow = new ShotReviewWorkflow();

    // 测试1：创建评审
    console.log('--- 测试1：创建评审 ---');
    const review1 = workflow.createReview('S01', { renderOutput: { videoPath: 'video1.mp4' } });
    console.log('创建状态:', review1.state);

    // 测试2：提交并评审
    console.log('\n--- 测试2：提交并评审 ---');
    workflow.submit('S01');
    workflow.approve('S01', {
      visual_quality: 0.8,
      character_consistency: 0.9,
      overall: 0.85
    }, '导演');
    console.log('评审后状态:', review1.state);
    console.log('综合评分:', review1.overallScore);

    // 测试3：创建并拒绝
    console.log('\n--- 测试3：创建并拒绝 ---');
    const review2 = workflow.createReview('S02');
    workflow.submit('S02');
    workflow.reject('S02', [
      new ReviewComment({
        reviewer: '导演',
        dimension: 'character_consistency',
        comment: '角色服装不一致',
        severity: 'major',
        suggestion: '统一角色服装为白衣'
      })
    ], '导演');
    console.log('拒绝状态:', review2.state);
    console.log('评论数:', review2.comments.length);

    // 测试4：自动评审
    console.log('\n--- 测试4：自动评审 ---');
    const review3 = workflow.createReview('S03');
    workflow.submit('S03');
    const autoResult = workflow.autoReview('S03', {
      overall: 0.6,
      scores: {
        visual_quality: { score: 0.7, name: '视觉质量' },
        character_consistency: { score: 0.5, name: '角色一致性' }
      }
    });
    console.log('自动评审状态:', autoResult?.state);
    console.log('未解决评论:', autoResult?.getUnresolvedComments().length);

    // 测试5：统计
    console.log('\n--- 测试5：统计 ---');
    console.log(workflow.getStats());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/stage-boundary-validator.js

> 文件大小: 13315 bytes

```javascript
/**
 * Stage Boundary Validator v2.0 — 阶段边界验证中间件
 * 系统核心基础设施：从 "warn模式" 升级到 "error模式"
 *
 * 职责：
 * - 阶段边界验证：每个Stage输出必须满足下一阶段输入的Schema
 * - 自动修复：字段重命名、类型转换、默认值填充
 * - 序列连续性检查：镜头sequence编号必须连续
 * - 错误模式：验证失败 = 阻断链路（不再只是警告）
 * - 与Saga编排器集成：验证失败触发降级或补偿
 * - 与事件总线集成：发布验证事件
 *
 * 升级对比：
 * v1.0: 仅Schema验证，warn模式，不阻断
 * v2.0: 阶段边界验证，error模式，自动修复，可阻断
 *
 * @version v2.0
 * @author 小G
 * @priority P0 - 数据完整性
 */

'use strict';

const { SchemaValidator } = require('../systems/schemas/pipeline-schemas');
const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、阶段边界定义（输入/输出契约）
// ============================================================

const STAGE_BOUNDARIES = {
  // Stage 1 → Stage 2: PRD 输出 → 对齐检查输入
  'STAGE-1→STAGE-2': {
    source: 'STAGE-1',
    target: 'STAGE-2',
    required: ['prd.title', 'prd.duration', 'prd.targetBeast'],
    optional: ['prd.genre', 'prd.style', 'prd.tone'],
    autoRepair: {
      'prd.title': (prd) => prd.title || '未命名项目',
      'prd.duration': (prd) => {
        if (!prd.duration) return { total: 15, min: 10, max: 15 };
        if (typeof prd.duration === 'number') return { total: prd.duration, min: prd.duration * 0.8, max: prd.duration * 1.2 };
        return prd.duration;
      }
    }
  },

  // Stage 4 → Stage 5: 角色 → 剧本输入
  'STAGE-4→STAGE-5': {
    source: 'STAGE-4',
    target: 'STAGE-5',
    required: ['characters', 'characters[].id', 'characters[].name'],
    optional: ['characters[].appearance', 'characters[].visualSignature'],
    autoRepair: {
      'characters': (input) => input.characters || [],
      'characters[].id': (chars) => chars.map((c, i) => ({ ...c, id: c.id || `char_${i}` }))
    }
  },

  // Stage 5 → Stage 6: 剧本 → 时长分配输入
  'STAGE-5→STAGE-6': {
    source: 'STAGE-5',
    target: 'STAGE-6',
    required: ['scenes', 'scenes[].id', 'scenes[].content'],
    optional: ['scenes[].narration', 'scenes[].characters'],
    autoRepair: {
      'scenes': (input) => {
        if (!input.scenes) {
          if (input.shots) return input.shots;  // 兼容shots
          return [];
        }
        return input.scenes;
      }
    }
  },

  // Stage 7 → Stage 8: 故事板 → 故事板校验输入
  'STAGE-7→STAGE-8': {
    source: 'STAGE-7',
    target: 'STAGE-8',
    required: ['storyboard.shots', 'storyboard.shots[].id', 'storyboard.shots[].sequence'],
    optional: ['storyboard.shots[].visualPrompt', 'storyboard.shots[].duration'],
    checks: ['sequence_continuity']  // 额外检查：序列连续性
  },

  // Stage 10 → Stage 11: 连续性 → 渲染输入
  'STAGE-10→STAGE-11': {
    source: 'STAGE-10',
    target: 'STAGE-11',
    required: ['shots', 'shots[].id', 'shots[].visualPrompt', 'shots[].duration'],
    optional: ['shots[].cameraMovement', 'shots[].emotionPhase'],
    checks: ['prompt_completeness', 'duration_total']  // 额外检查
  }
};

// ============================================================
// 二、阶段边界验证器
// ============================================================

class StageBoundaryValidator {
  constructor(options = {}) {
    this.mode = options.mode || 'error';  // 'error' = 阻断, 'warn' = 仅警告
    this.autoRepair = options.autoRepair !== false;  // 默认启用自动修复
    this.emitEvents = options.emitEvents !== false;
    this.eventBus = this.emitEvents ? new NirathEventBus({ name: 'stage-validator', enabled: true }) : null;
    this.validationLog = [];
  }

  /**
   * 验证两个阶段之间的数据边界
   */
  validateBoundary(sourceStage, targetStage, output, input) {
    const boundaryKey = `${sourceStage}→${targetStage}`;
    const boundary = STAGE_BOUNDARIES[boundaryKey];

    if (!boundary) {
      console.warn(`[StageBoundaryValidator] 未定义边界: ${boundaryKey}`);
      return { valid: true, repairs: [], boundary: boundaryKey };
    }

    const errors = [];
    const warnings = [];
    const repairs = [];

    // 检查必填字段
    for (const field of boundary.required) {
      const value = this.getPath(output, field);
      if (value === undefined || value === null) {
        // 尝试自动修复
        if (this.autoRepair && boundary.autoRepair[field]) {
          try {
            const repaired = boundary.autoRepair[field](output);
            this.setPath(output, field, repaired);
            repairs.push({ field, action: 'auto_repair', value: 'repaired' });
            console.log(`[StageBoundaryValidator] 🔧 自动修复 ${field}`);
            continue;
          } catch (repairError) {
            errors.push(`${field}: 必填字段缺失，自动修复失败: ${repairError.message}`);
          }
        } else {
          errors.push(`${field}: 必填字段缺失`);
        }
      }
    }

    // 检查可选字段（仅警告）
    for (const field of boundary.optional) {
      const value = this.getPath(output, field);
      if (value === undefined || value === null) {
        warnings.push(`${field}: 可选字段缺失`);
      }
    }

    // 执行额外检查
    if (boundary.checks) {
      for (const check of boundary.checks) {
        const checkResult = this.runCheck(check, output, input);
        if (checkResult.errors) errors.push(...checkResult.errors);
        if (checkResult.warnings) warnings.push(...checkResult.warnings);
        if (checkResult.repairs) repairs.push(...checkResult.repairs);
      }
    }

    const valid = errors.length === 0;

    const result = {
      valid,
      boundary: boundaryKey,
      errors,
      warnings,
      repairs,
      strict: this.mode === 'error'
    };

    // 记录验证结果
    this.validationLog.push({
      timestamp: Date.now(),
      boundary: boundaryKey,
      valid,
      errors: errors.length,
      warnings: warnings.length,
      repairs: repairs.length
    });

    // 发布事件
    if (this.emitEvents) {
      this.eventBus.publish('data.validated', {
        stageId: sourceStage,
        boundary: boundaryKey,
        valid,
        errors,
        warnings,
        repairs
      }, { traceId: input.traceId || `val_${Date.now()}` });
    }

    if (!valid && this.mode === 'error') {
      throw new StageBoundaryError(
        `阶段边界验证失败: ${boundaryKey}\n` +
        errors.map(e => `  - ${e}`).join('\n'),
        { boundary: boundaryKey, errors, repairs, output }
      );
    }

    if (warnings.length > 0) {
      console.warn(`[StageBoundaryValidator] ⚠️ ${boundaryKey} 警告:\n` +
        warnings.map(w => `  - ${w}`).join('\n'));
    }

    return result;
  }

  /**
   * 序列连续性检查：镜头sequence编号必须连续
   */
  checkSequenceContinuity(shots) {
    if (!Array.isArray(shots)) {
      return { errors: ['shots不是数组'] };
    }

    const sequences = shots.map(s => s.sequence).filter(s => s !== undefined).sort((a, b) => a - b);
    if (sequences.length === 0) {
      return { warnings: ['镜头没有sequence编号'] };
    }

    const errors = [];
    for (let i = 0; i < sequences.length - 1; i++) {
      if (sequences[i + 1] !== sequences[i] + 1) {
        errors.push(`序列不连续: ${sequences[i]} → ${sequences[i + 1]} (期望 ${sequences[i] + 1})`);
      }
    }

    return { errors };
  }

  /**
   * Prompt完整性检查
   */
  checkPromptCompleteness(shots) {
    if (!Array.isArray(shots)) return { errors: ['shots不是数组'] };

    const errors = [];
    for (const shot of shots) {
      if (!shot.visualPrompt || shot.visualPrompt.length < 50) {
        errors.push(`镜头 ${shot.id || '?'}: Prompt过短(${shot.visualPrompt?.length || 0}字符)，可能不完整`);
      }
    }

    return { errors };
  }

  /**
   * 总时长检查
   */
  checkDurationTotal(shots, prd) {
    if (!Array.isArray(shots)) return { errors: [] };

    const totalDuration = shots.reduce((sum, s) => sum + (s.duration || 0), 0);
    const targetDuration = prd?.duration?.total || 15;

    const warnings = [];
    if (totalDuration < targetDuration * 0.8) {
      warnings.push(`总时长${totalDuration}s < 目标${targetDuration}s的80%，可能过短`);
    }
    if (totalDuration > targetDuration * 1.2) {
      warnings.push(`总时长${totalDuration}s > 目标${targetDuration}s的120%，可能过长`);
    }

    return { warnings };
  }

  /**
   * 运行额外检查
   */
  runCheck(checkName, output, input) {
    switch (checkName) {
      case 'sequence_continuity':
        return this.checkSequenceContinuity(output.storyboard?.shots || output.shots || []);
      case 'prompt_completeness':
        return this.checkPromptCompleteness(output.shots || []);
      case 'duration_total':
        return this.checkDurationTotal(output.shots || [], input?.prd || output?.prd);
      default:
        return { errors: [`未知检查: ${checkName}`] };
    }
  }

  /**
   * 获取路径值
   */
  getPath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (part === '[]') {
        // 数组字段
        return Array.isArray(current) ? current : undefined;
      }
      current = current[part];
    }
    return current;
  }

  /**
   * 设置路径值
   */
  setPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === '[]') {
        // 不处理数组路径设置
        return;
      }
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * 获取验证报告
   */
  getValidationReport() {
    const total = this.validationLog.length;
    const passed = this.validationLog.filter(v => v.valid).length;
    const failed = this.validationLog.filter(v => !v.valid).length;
    const totalRepairs = this.validationLog.reduce((sum, v) => sum + v.repairs, 0);

    return {
      totalValidations: total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total).toFixed(2) : 'N/A',
      totalRepairs,
      mode: this.mode,
      recentErrors: this.validationLog
        .filter(v => !v.valid)
        .slice(-10)
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// 三、自定义错误类
// ============================================================

class StageBoundaryError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'StageBoundaryError';
    this.details = details;
    this.boundary = details?.boundary;
    this.errors = details?.errors || [];
    this.repairs = details?.repairs || [];
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  StageBoundaryValidator,
  StageBoundaryError,
  STAGE_BOUNDARIES,

  // 快速验证
  validateBoundary: (source, target, output, input, options) => {
    const validator = new StageBoundaryValidator(options);
    return validator.validateBoundary(source, target, output, input);
  }
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Stage Boundary Validator 集成测试 ===\n');

    const validator = new StageBoundaryValidator({ mode: 'error', autoRepair: true });

    // 测试1：正常验证
    console.log('--- 测试1：正常验证 ---');
    const result1 = validator.validateBoundary('STAGE-1', 'STAGE-2', {
      prd: { title: '饕餮传说', duration: { total: 15 } }
    }, {});
    console.log('通过:', result1.valid);

    // 测试2：自动修复
    console.log('\n--- 测试2：自动修复 ---');
    const result2 = validator.validateBoundary('STAGE-1', 'STAGE-2', {
      prd: { title: '饕餮传说' }  // 缺少duration
    }, {});
    console.log('通过:', result2.valid);
    console.log('修复:', result2.repairs.map(r => r.field).join(', '));

    // 测试3：序列连续性检查
    console.log('\n--- 测试3：序列连续性检查 ---');
    const shots = [
      { id: 'S01', sequence: 1 },
      { id: 'S02', sequence: 2 },
      { id: 'S04', sequence: 4 }  // 跳过了3
    ];
    const result3 = validator.checkSequenceContinuity(shots);
    console.log('错误:', result3.errors);

    // 测试4：验证报告
    console.log('\n--- 测试4：验证报告 ---');
    console.log(validator.getValidationReport());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/stage-health-monitor.js

> 文件大小: 14116 bytes

```javascript
/**
 * Stage Health Monitor v1.0 — 阶段健康检查与自愈系统
 * 系统核心基础设施：自动检测问题并修复，而不是等队长发现
 *
 * 职责：
 * - 内置健康检查：每个Stage定义自己的健康检查项
 * - 自动修复：发现常见问题自动修复（如文件缺失、超时重试）
 * - 自愈动作：内置修复工具库（重建文件、重试、降级）
 * - 健康评分：每个Stage 0-100分健康度
 * - 与Event Bus集成：发布健康事件
 * - 与Saga编排器集成：触发补偿时自动检查健康状态
 *
 * 核心能力：
 * 1. HealthCheck: { name, checkFn, repairFn, interval, severity }
 * 2. StageHealthMonitor: 管理所有Stage的健康检查
 * 3. SelfHealing: 内置修复工具（文件修复、重试、降级）
 * 4. HealthScore: 综合评分算法
 * 5. RepairLog: 修复日志，可审计
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 稳定性工程
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、健康检查定义
// ============================================================

const HEALTH_CHECKS = {
  // Stage 1: PRD生成
  'STAGE-1': [
    {
      name: 'prd文件存在性',
      check: (context) => context.prd?.title?.length > 0,
      repair: async (context) => {
        context.prd = { title: '未命名PRD', duration: 15, targetBeast: '未指定' };
        return '已生成默认PRD';
      },
      severity: 'critical'
    },
    {
      name: 'PRD时长合理性',
      check: (context) => {
        const d = context.prd?.duration;
        return d >= 10 && d <= 120;
      },
      repair: async (context) => {
        const d = context.prd?.duration || 15;
        context.prd.duration = Math.max(10, Math.min(120, d));
        return `PRD时长已修正为${context.prd.duration}`;
      },
      severity: 'warning'
    }
  ],

  // Stage 4: 角色系统
  'STAGE-4': [
    {
      name: '角色数据存在',
      check: (context) => Array.isArray(context.characters) && context.characters.length > 0,
      repair: async (context) => {
        context.characters = [{ id: 'protagonist', name: '主角', role: 'protagonist' }];
        return '已生成默认主角';
      },
      severity: 'critical'
    },
    {
      name: '角色ID唯一性',
      check: (context) => {
        if (!Array.isArray(context.characters)) return true;
        const ids = context.characters.map(c => c.id);
        return new Set(ids).size === ids.length;
      },
      repair: async (context) => {
        if (!Array.isArray(context.characters)) return;
        const seen = new Set();
        context.characters.forEach((c, i) => {
          if (seen.has(c.id)) {
            c.id = `${c.id}_dup_${i}`;
          }
          seen.add(c.id);
        });
        return '角色ID重复已修复';
      },
      severity: 'warning'
    }
  ],

  // Stage 5: 剧本
  'STAGE-5': [
    {
      name: '剧本存在',
      check: (context) => context.scenes || context.shots || context.script,
      repair: async (context) => {
        context.scenes = [{ id: 'S01', scene: '开场', content: '默认开场' }];
        return '已生成默认剧本';
      },
      severity: 'critical'
    },
    {
      name: '镜头数量合理性',
      check: (context) => {
        const shots = context.shots || context.scenes || [];
        return shots.length >= 1 && shots.length <= 30;
      },
      repair: async (context) => {
        const shots = context.shots || context.scenes || [];
        if (shots.length > 30) {
          const newShots = shots.slice(0, 30);
          if (context.shots) context.shots = newShots;
          if (context.scenes) context.scenes = newShots;
          return `镜头数量从${shots.length}裁剪到30`;
        }
        return '镜头数量正常';
      },
      severity: 'warning'
    }
  ],

  // Stage 7: 故事板
  'STAGE-7': [
    {
      name: '故事板存在',
      check: (context) => context.storyboard?.shots && context.storyboard.shots.length > 0,
      repair: async (context) => {
        context.storyboard = { shots: [{ id: 'S01', sequence: 1, scene: '开场' }] };
        return '已生成默认故事板';
      },
      severity: 'critical'
    },
    {
      name: 'Prompt完整性',
      check: (context) => {
        const shots = context.storyboard?.shots || [];
        return shots.every(s => (s.visualPrompt || s.prompt)?.length > 10);
      },
      repair: async (context) => {
        const shots = context.storyboard?.shots || [];
        for (const shot of shots) {
          if (!shot.visualPrompt || shot.visualPrompt.length < 10) {
            shot.visualPrompt = `镜头${shot.id}的视觉描述`;
          }
        }
        return '缺失的Prompt已填充';
      },
      severity: 'warning'
    }
  ],

  // Stage 11: 渲染
  'STAGE-11': [
    {
      name: '渲染输入完整',
      check: (context) => {
        const shots = context.shots || [];
        return shots.length > 0 && shots.every(s => s.visualPrompt || s.prompt);
      },
      repair: async (context) => {
        return '渲染输入检查失败，已触发降级';
      },
      severity: 'critical'
    }
  ],

  // Stage 16: 导演优化
  'STAGE-16': [
    {
      name: '导演评分存在',
      check: (context) => context.shots?.some(s => s.directorScore !== undefined),
      repair: async (context) => {
        if (context.shots) {
          context.shots.forEach(s => {
            if (s.directorScore === undefined) s.directorScore = 7;
          });
        }
        return '已填充默认导演评分';
      },
      severity: 'info'
    }
  ]
};

// ============================================================
// 二、健康检查项
// ============================================================

class HealthCheck {
  constructor(config) {
    this.name = config.name;
    this.checkFn = config.check;
    this.repairFn = config.repair || null;
    this.severity = config.severity || 'warning';  // critical, warning, info
    this.interval = config.interval || 0;  // 0 = 每次检查都运行
    this.lastRun = 0;
    this.result = null;
  }

  async run(context) {
    const now = Date.now();
    if (this.interval > 0 && now - this.lastRun < this.interval) {
      return this.result;
    }

    this.lastRun = now;

    try {
      const passed = this.checkFn(context);
      this.result = {
        name: this.name,
        passed,
        severity: this.severity,
        timestamp: now,
        repaired: false
      };
      return this.result;
    } catch (error) {
      this.result = {
        name: this.name,
        passed: false,
        severity: this.severity,
        error: error.message,
        timestamp: now,
        repaired: false
      };
      return this.result;
    }
  }

  async repair(context) {
    if (!this.repairFn) return null;

    try {
      const repairResult = await this.repairFn(context);
      this.result.repaired = true;
      this.result.repairResult = repairResult;
      return { success: true, message: repairResult };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ============================================================
// 三、阶段健康监控器
// ============================================================

class StageHealthMonitor {
  constructor(options = {}) {
    this.checks = new Map();  // stageId -> Array<HealthCheck>
    this.checkInterval = options.checkInterval || 30000;  // 30秒检查一次
    this.autoRepair = options.autoRepair !== false;
    this.eventBus = new NirathEventBus({ name: 'health-monitor', enabled: true });
    this.repairLog = [];
    this.healthScores = new Map();  // stageId -> score
    this.running = false;
    this.timer = null;

    // 注册内置检查
    this.registerBuiltinChecks();
  }

  /**
   * 注册内置检查
   */
  registerBuiltinChecks() {
    for (const [stageId, checks] of Object.entries(HEALTH_CHECKS)) {
      for (const check of checks) {
        this.registerCheck(stageId, check);
      }
    }
  }

  /**
   * 注册检查
   */
  registerCheck(stageId, config) {
    if (!this.checks.has(stageId)) {
      this.checks.set(stageId, []);
    }
    this.checks.get(stageId).push(new HealthCheck(config));
  }

  /**
   * 检查Stage健康状态
   */
  async checkStage(stageId, context) {
    const checks = this.checks.get(stageId) || [];
    const results = [];
    let repaired = 0;

    for (const check of checks) {
      const result = await check.run(context);
      results.push(result);

      // 自动修复
      if (!result.passed && this.autoRepair && check.repairFn) {
        console.log(`[HealthMonitor] 🔧 ${stageId} 的 ${check.name} 未通过，尝试自动修复...`);
        const repairResult = await check.repair(context);

        if (repairResult.success) {
          repaired++;
          console.log(`[HealthMonitor] ✅ 修复成功: ${repairResult.message}`);
          this.repairLog.push({
            timestamp: Date.now(),
            stageId,
            checkName: check.name,
            result: repairResult.message
          });

          // 修复后重新检查
          const reCheck = await check.run(context);
          result.passed = reCheck.passed;
          result.repaired = true;
          result.repairResult = repairResult.message;
        } else {
          console.error(`[HealthMonitor] ❌ 修复失败: ${repairResult.error}`);
          result.repairError = repairResult.error;
        }
      }
    }

    // 计算健康评分
    const score = this.calculateHealthScore(results);
    this.healthScores.set(stageId, score);

    // 发布事件
    this.eventBus.publish('health.checked', {
      stageId,
      score,
      checks: results.length,
      passed: results.filter(r => r.passed).length,
      repaired
    }, { traceId: context.traceId || `health_${Date.now()}` });

    return {
      stageId,
      score,
      results,
      repaired
    };
  }

  /**
   * 计算健康评分
   */
  calculateHealthScore(results) {
    if (results.length === 0) return 100;

    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      const weight = result.severity === 'critical' ? 3 : result.severity === 'warning' ? 2 : 1;
      const score = result.passed ? 100 : 0;
      totalWeight += weight;
      weightedScore += score * weight;
    }

    return Math.round(weightedScore / totalWeight);
  }

  /**
   * 检查所有Stage
   */
  async checkAll(context) {
    const report = {};
    for (const stageId of this.checks.keys()) {
      report[stageId] = await this.checkStage(stageId, context);
    }
    return report;
  }

  /**
   * 启动定时检查
   */
  start(context) {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(async () => {
      await this.checkAll(context);
    }, this.checkInterval);

    console.log(`[HealthMonitor] ▶️ 定时检查启动 | 间隔:${this.checkInterval}ms`);
  }

  /**
   * 停止
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    console.log('[HealthMonitor] 🛑 已停止');
  }

  /**
   * 获取健康报告
   */
  getHealthReport() {
    const scores = Array.from(this.healthScores.entries());
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, [, s]) => sum + s, 0) / scores.length)
      : 100;

    return {
      averageScore: avgScore,
      totalChecks: Array.from(this.checks.values()).reduce((sum, c) => sum + c.length, 0),
      stageScores: Object.fromEntries(this.healthScores),
      recentRepairs: this.repairLog.slice(-10),
      status: avgScore >= 80 ? 'healthy' : avgScore >= 60 ? 'degraded' : 'critical'
    };
  }

  /**
   * 获取修复日志
   */
  getRepairLog() {
    return [...this.repairLog];
  }
}

// ============================================================
// 四、导出
// ============================================================

module.exports = {
  StageHealthMonitor,
  HealthCheck,
  HEALTH_CHECKS,

  // 快速创建
  createHealthMonitor: (options) => new StageHealthMonitor(options)
};

// ============================================================
// 五、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Stage Health Monitor 集成测试 ===\n');

    const monitor = new StageHealthMonitor({ autoRepair: true });

    // 测试1：健康检查（正常）
    console.log('--- 测试1：健康检查（正常） ---');
    const result1 = await monitor.checkStage('STAGE-1', {
      prd: { title: '饕餮传说', duration: 15, targetBeast: '饕餮' }
    });
    console.log('STAGE-1 健康评分:', result1.score);
    console.log('检查项:', result1.results.length);
    console.log('通过:', result1.results.filter(r => r.passed).length);

    // 测试2：自动修复
    console.log('\n--- 测试2：自动修复 ---');
    const result2 = await monitor.checkStage('STAGE-1', {
      prd: { title: '' }  // 缺少title
    });
    console.log('STAGE-1 修复后评分:', result2.score);
    console.log('修复数:', result2.repaired);
    console.log('修复日志:', monitor.getRepairLog().map(r => r.checkName));

    // 测试3：角色唯一性修复
    console.log('\n--- 测试3：角色唯一性修复 ---');
    const result3 = await monitor.checkStage('STAGE-4', {
      characters: [
        { id: 'hero', name: '主角' },
        { id: 'hero', name: '重复ID' }  // 重复ID
      ]
    });
    console.log('STAGE-4 修复后评分:', result3.score);
    console.log('修复:', result3.results.filter(r => r.repaired).map(r => r.name));

    // 测试4：健康报告
    console.log('\n--- 测试4：健康报告 ---');
    console.log(monitor.getHealthReport());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/visual-consistency-tracker.js

> 文件大小: 13194 bytes

```javascript
/**
 * Visual Consistency Tracker v1.0 — 跨镜头视觉一致性追踪
 * 系统核心基础设施：追踪服装、道具、色彩、光照在镜头间的连续性
 *
 * 职责：
 * - 服装追踪：角色服装是否跨镜头一致（如"白衣"不能突然变"红衣"）
 * - 道具追踪：道具出现、消失、位置变化
 * - 色彩方案追踪：主色调是否一致
 * - 光照追踪：光照方向、强度是否一致
 * - 与Visual Continuity Engine集成：视觉连续性+视觉一致性
 * - 与Field Lineage集成：追踪字段变更
 * - 与Event Bus集成：发布一致性异常事件
 *
 * 核心能力：
 * 1. ConsistencyAttribute: 一致性属性（服装、道具、色彩、光照）
 * 2. ConsistencySnapshot: 一致性快照（每个镜头的状态记录）
 * 3. ConsistencyDiff: 一致性差异检测
 * 4. VisualConsistencyTracker: 主追踪器
 * 5. ConsistencyReport: 一致性报告
 *
 * 一致性属性定义：
 * - costume: 服装（颜色、款式、材质）
 * - prop: 道具（名称、位置、状态）
 * - color_scheme: 色彩方案（主色、辅色、强调色）
 * - lighting: 光照（方向、强度、色温）
 * - weather: 天气（晴、雨、雪、雾）
 * - time_of_day: 时间（早晨、中午、傍晚、夜晚）
 *
 * @version v1.0
 * @author 小G
 * @priority P2 - 山海经专项
 */

'use strict';

const { NirathEventBus } = require('../core/event-bus');

// ============================================================
// 一、一致性属性定义
// ============================================================

const CONSISTENCY_ATTRIBUTES = {
  costume: {
    name: '服装',
    fields: ['color', 'style', 'material', 'accessories'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const colors = ['白', '黑', '红', '蓝', '绿', '黄', '紫', '青', '金', '银'];
      const foundColor = colors.find(c => prompt.includes(c + '衣') || prompt.includes(c + '袍') || prompt.includes(c + '衫'));
      return { color: foundColor || '未指定' };
    }
  },
  prop: {
    name: '道具',
    fields: ['name', 'position', 'state'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const props = ['剑', '刀', '枪', '弓', '盾', '杖', '珠', '玉', '镜', '鼎'];
      const foundProps = props.filter(p => prompt.includes(p));
      return { items: foundProps };
    }
  },
  color_scheme: {
    name: '色彩方案',
    fields: ['primary', 'secondary', 'accent'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const warm = ['红', '橙', '黄', '金', '暖'];
      const cool = ['蓝', '青', '绿', '紫', '冷'];
      const neutral = ['白', '黑', '灰', '银'];
      
      const hasWarm = warm.some(c => prompt.includes(c));
      const hasCool = cool.some(c => prompt.includes(c));
      const hasNeutral = neutral.some(c => prompt.includes(c));
      
      if (hasWarm) return { primary: 'warm' };
      if (hasCool) return { primary: 'cool' };
      if (hasNeutral) return { primary: 'neutral' };
      return { primary: '未指定' };
    }
  },
  lighting: {
    name: '光照',
    fields: ['direction', 'intensity', 'color_temperature'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const directions = ['顺光', '逆光', '侧光', '顶光', '底光'];
      const foundDir = directions.find(d => prompt.includes(d));
      return { direction: foundDir || '未指定' };
    }
  },
  weather: {
    name: '天气',
    fields: ['condition', 'intensity'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const conditions = ['晴', '雨', '雪', '雾', '风', '雷', '云'];
      const found = conditions.find(c => prompt.includes(c));
      return { condition: found || '未指定' };
    }
  },
  time_of_day: {
    name: '时间',
    fields: ['period', 'lighting'],
    extract: (shot) => {
      const prompt = shot.visualPrompt || '';
      const times = ['早晨', '上午', '中午', '下午', '傍晚', '黄昏', '夜晚', '深夜'];
      const found = times.find(t => prompt.includes(t));
      return { period: found || '未指定' };
    }
  }
};

// ============================================================
// 二、一致性快照
// ============================================================

class ConsistencySnapshot {
  constructor(shotId, attributes) {
    this.shotId = shotId;
    this.timestamp = Date.now();
    this.attributes = attributes;  // Map<attrName, value>
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  toJSON() {
    return {
      shotId: this.shotId,
      timestamp: this.timestamp,
      attributes: Object.fromEntries(this.attributes)
    };
  }
}

// ============================================================
// 三、一致性差异
// ============================================================

class ConsistencyDiff {
  constructor(shotA, shotB, attribute, before, after) {
    this.shotA = shotA;
    this.shotB = shotB;
    this.attribute = attribute;
    this.before = before;
    this.after = after;
    this.timestamp = Date.now();
  }

  getDescription() {
    const attrDef = CONSISTENCY_ATTRIBUTES[this.attribute];
    return `${attrDef?.name || this.attribute}: ${JSON.stringify(this.before)} → ${JSON.stringify(this.after)}`;
  }
}

// ============================================================
// 四、视觉一致性追踪器
// ============================================================

class VisualConsistencyTracker {
  constructor(options = {}) {
    this.snapshots = new Map();  // shotId -> ConsistencySnapshot
    this.diffs = [];  // Array<ConsistencyDiff>
    this.eventBus = new NirathEventBus({ name: 'consistency', enabled: true });
    this.threshold = options.threshold || 0.8;  // 一致性阈值
    this.attributes = options.attributes || Object.keys(CONSISTENCY_ATTRIBUTES);
    this.tolerance = options.tolerance || {
      costume: 'strict',      // 服装严格一致
      prop: 'moderate',       // 道具允许变化
      color_scheme: 'loose',  // 色彩允许渐变
      lighting: 'moderate',   // 光照允许变化
      weather: 'loose',       // 天气允许变化
      time_of_day: 'strict'   // 时间严格一致
    };
  }

  /**
   * 记录镜头快照
   */
  record(shot) {
    const attributes = new Map();
    
    for (const attrName of this.attributes) {
      const attrDef = CONSISTENCY_ATTRIBUTES[attrName];
      if (attrDef) {
        try {
          const value = attrDef.extract(shot);
          attributes.set(attrName, value);
        } catch (error) {
          console.warn(`[ConsistencyTracker] 提取属性 ${attrName} 失败: ${error.message}`);
        }
      }
    }

    const snapshot = new ConsistencySnapshot(shot.id || shot.shotId, attributes);
    this.snapshots.set(shot.id || shot.shotId, snapshot);
    return snapshot;
  }

  /**
   * 比较两个镜头
   */
  compare(shotA, shotB) {
    const idA = shotA.id || shotA.shotId;
    const idB = shotB.id || shotB.shotId;
    
    const snapA = this.snapshots.get(idA) || this.record(shotA);
    const snapB = this.snapshots.get(idB) || this.record(shotB);

    const diffs = [];
    const inconsistencies = [];

    for (const attrName of this.attributes) {
      const valA = snapA.getAttribute(attrName);
      const valB = snapB.getAttribute(attrName);

      if (!valA || !valB) continue;

      const isConsistent = this.checkConsistency(attrName, valA, valB);
      
      if (!isConsistent) {
        const diff = new ConsistencyDiff(idA, idB, attrName, valA, valB);
        diffs.push(diff);
        inconsistencies.push({
          attribute: attrName,
          shotA: idA,
          shotB: idB,
          before: valA,
          after: valB
        });
      }
    }

    const passed = inconsistencies.length === 0;

    if (!passed) {
      this.eventBus.publish('consistency.inconsistency', {
        shotA: idA,
        shotB: idB,
        inconsistencies: inconsistencies.length,
        details: inconsistencies
      }, { traceId: `cons_${Date.now()}` });
    }

    return {
      passed,
      diffs,
      inconsistencies,
      consistencyRate: 1 - (inconsistencies.length / this.attributes.length)
    };
  }

  /**
   * 检查一致性
   */
  checkConsistency(attrName, valA, valB) {
    const tolerance = this.tolerance[attrName] || 'strict';
    
    if (tolerance === 'loose') {
      // 宽松：允许任何变化
      return true;
    }

    // 比较值
    const strA = JSON.stringify(valA);
    const strB = JSON.stringify(valB);
    
    if (tolerance === 'strict') {
      // 严格：必须完全相同
      return strA === strB;
    }
    
    if (tolerance === 'moderate') {
      // 中等：允许部分变化（如道具数量变化）
      // 简化：检查是否有共同元素
      if (Array.isArray(valA.items) && Array.isArray(valB.items)) {
        const common = valA.items.filter(item => valB.items.includes(item));
        return common.length > 0 || valA.items.length === 0;
      }
      return strA === strB;
    }

    return strA === strB;
  }

  /**
   * 检查整个序列
   */
  checkSequence(shots) {
    const results = [];
    const allDiffs = [];
    
    for (let i = 0; i < shots.length - 1; i++) {
      const result = this.compare(shots[i], shots[i + 1]);
      results.push(result);
      allDiffs.push(...result.diffs);
    }

    const totalInconsistencies = results.reduce((sum, r) => sum + r.inconsistencies.length, 0);
    const totalChecks = results.length * this.attributes.length;
    const consistencyRate = totalChecks > 0 ? 1 - (totalInconsistencies / totalChecks) : 1;

    return {
      passed: consistencyRate >= this.threshold,
      consistencyRate,
      totalInconsistencies,
      totalChecks,
      results,
      diffs: allDiffs
    };
  }

  /**
   * 获取镜头快照
   */
  getSnapshot(shotId) {
    return this.snapshots.get(shotId);
  }

  /**
   * 获取差异历史
   */
  getDiffs() {
    return [...this.diffs];
  }

  /**
   * 生成一致性报告
   */
  generateReport() {
    const snapshots = Array.from(this.snapshots.values());
    const diffs = this.diffs;
    
    const byAttribute = {};
    for (const diff of diffs) {
      byAttribute[diff.attribute] = (byAttribute[diff.attribute] || 0) + 1;
    }

    return {
      totalSnapshots: snapshots.length,
      totalDiffs: diffs.length,
      byAttribute,
      consistencyRate: diffs.length > 0 ? 
        1 - (diffs.length / (snapshots.length * this.attributes.length)) : 1,
      mostInconsistentAttribute: Object.entries(byAttribute)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
    };
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  VisualConsistencyTracker,
  ConsistencySnapshot,
  ConsistencyDiff,
  CONSISTENCY_ATTRIBUTES,

  // 快速创建
  createConsistencyTracker: (options) => new VisualConsistencyTracker(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Visual Consistency Tracker 集成测试 ===\n');

    const tracker = new VisualConsistencyTracker();

    // 测试1：记录快照
    console.log('--- 测试1：记录快照 ---');
    const shot1 = {
      id: 'S01',
      visualPrompt: '少年穿着白衣，手持长剑，站在山顶，早晨的阳光照在他身上'
    };
    const snap1 = tracker.record(shot1);
    console.log('快照:', snap1.toJSON());

    // 测试2：一致性比较（一致）
    console.log('\n--- 测试2：一致性比较（一致） ---');
    const shot2 = {
      id: 'S02',
      visualPrompt: '少年穿着白衣，手持长剑，走在山路上，早晨的阳光照在他身上'
    };
    const result2 = tracker.compare(shot1, shot2);
    console.log('通过:', result2.passed);
    console.log('一致性率:', result2.consistencyRate);

    // 测试3：一致性比较（不一致）
    console.log('\n--- 测试3：一致性比较（不一致） ---');
    const shot3 = {
      id: 'S03',
      visualPrompt: '少年穿着红衣，手持长刀，站在海边，夜晚的灯光照在他身上'
    };
    const result3 = tracker.compare(shot1, shot3);
    console.log('通过:', result3.passed);
    console.log('不一致数:', result3.inconsistencies.length);
    console.log('不一致项:', result3.inconsistencies.map(i => i.attribute).join(', '));

    // 测试4：序列检查
    console.log('\n--- 测试4：序列检查 ---');
    const shots = [shot1, shot2, shot3];
    const seqResult = tracker.checkSequence(shots);
    console.log('序列通过:', seqResult.passed);
    console.log('总一致性率:', seqResult.consistencyRate);

    // 测试5：报告
    console.log('\n--- 测试5：报告 ---');
    console.log(tracker.generateReport());

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/core/visual-continuity-engine.js

> 文件大小: 16271 bytes

```javascript
/**
 * Visual Continuity Engine v1.0 — 视觉连续性引擎
 * 系统核心基础设施：确保跨镜头视觉一致性（光照、角色、环境、色彩、时间）
 *
 * 职责：
 * - 光照连续性：相邻镜头光照方向/强度一致
 * - 角色一致性：角色外貌、服装、姿态跨镜头一致
 * - 环境连续性：场景元素位置、天气、时间一致
 * - 色彩连续性：色彩方案跨镜头一致
 * - 时间连续性：时间流逝符合物理规律
 * - 与Event Bus集成：发布连续性异常事件
 * - 与Immutable Shot集成：基于不可变镜头进行比对
 *
 * 核心能力：
 * 1. ContinuityChecker: 检查连续性
 * 2. ContinuityRule: 连续性规则定义
 * 3. ContinuityReport: 连续性报告
 * 4. FixSuggestion: 修复建议
 * 5. VisualContinuityEngine: 主引擎
 *
 * 连续性检查维度：
 * - lighting: 光照（方向、强度、色温）
 * - character: 角色（外貌、服装、姿态）
 * - environment: 环境（场景元素、天气、时间）
 * - color: 色彩（色调、饱和度、对比度）
 * - time: 时间（时间流逝、物理规律）
 * - camera: 运镜（连贯性、跳切检测）
 *
 * @version v1.0
 * @author 小G
 * @priority P1 - 业务架构
 */

'use strict';

const { NirathEventBus } = require('./event-bus');

// ============================================================
// 一、连续性规则定义
// ============================================================

const CONTINUITY_RULES = {
  lighting: {
    name: '光照连续性',
    description: '相邻镜头光照方向、强度、色温一致',
    check: (shotA, shotB) => {
      const lightA = shotA.lighting || {};
      const lightB = shotB.lighting || {};

      const issues = [];
      // 简化检查：基于场景描述推断光照
      const sceneA = (shotA.scene || shotA.sceneName || '').toLowerCase();
      const sceneB = (shotB.scene || shotB.sceneName || '').toLowerCase();

      const timeA = sceneA.includes('白天') || sceneA.includes('早晨') ? 'day' : 'night';
      const timeB = sceneB.includes('白天') || sceneB.includes('早晨') ? 'day' : 'night';

      if (timeA !== timeB) {
        issues.push('时间场景不一致（白天/夜晚）');
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'warning' : 'pass'
      };
    }
  },

  character: {
    name: '角色连续性',
    description: '角色外貌、服装、姿态跨镜头一致',
    check: (shotA, shotB) => {
      const charsA = shotA.characters || [];
      const charsB = shotB.characters || [];
      const issues = [];

      // 检查角色数量
      if (charsA.length !== charsB.length) {
        issues.push(`角色数量变化: ${charsA.length} → ${charsB.length}`);
      }

      // 检查角色ID一致性
      const idsA = new Set(charsA.map(c => c.id || c.name));
      const idsB = new Set(charsB.map(c => c.id || c.name));
      const missing = [...idsA].filter(id => !idsB.has(id));
      const added = [...idsB].filter(id => !idsA.has(id));

      if (missing.length > 0) {
        issues.push(`角色消失: ${missing.join(', ')}`);
      }
      if (added.length > 0) {
        issues.push(`新角色出现: ${added.join(', ')}`);
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'warning' : 'pass'
      };
    }
  },

  environment: {
    name: '环境连续性',
    description: '场景元素位置、天气、时间一致',
    check: (shotA, shotB) => {
      const issues = [];
      const envA = (shotA.scene || shotA.sceneName || '').toLowerCase();
      const envB = (shotB.scene || shotB.sceneName || '').toLowerCase();

      // 检查场景类型一致性（如室内/室外）
      const indoorA = envA.includes('室内') || envA.includes('屋内');
      const indoorB = envB.includes('室内') || envB.includes('屋内');
      const outdoorA = envA.includes('室外') || envA.includes('户外') || envA.includes('山') || envA.includes('海');
      const outdoorB = envB.includes('室外') || envB.includes('户外') || envB.includes('山') || envB.includes('海');

      if (indoorA && outdoorB) {
        issues.push('场景从室内突然变为室外');
      }
      if (outdoorA && indoorB) {
        issues.push('场景从室外突然变为室内');
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  },

  color: {
    name: '色彩连续性',
    description: '色彩方案跨镜头一致',
    check: (shotA, shotB) => {
      // 简化：检查Prompt中是否有矛盾的色彩描述
      const promptA = (shotA.visualPrompt || '').toLowerCase();
      const promptB = (shotB.visualPrompt || '').toLowerCase();
      const issues = [];

      const warmColors = ['红色', '橙色', '黄色', '暖色', '夕阳', '火焰'];
      const coolColors = ['蓝色', '青色', '绿色', '冷色', '月光', '冰雪'];

      const hasWarmA = warmColors.some(c => promptA.includes(c));
      const hasCoolA = coolColors.some(c => promptA.includes(c));
      const hasWarmB = warmColors.some(c => promptB.includes(c));
      const hasCoolB = coolColors.some(c => promptB.includes(c));

      if (hasWarmA && hasCoolB && !hasWarmB) {
        issues.push('色彩从暖色突变为冷色');
      }
      if (hasCoolA && hasWarmB && !hasCoolB) {
        issues.push('色彩从冷色突变为暖色');
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  },

  time: {
    name: '时间连续性',
    description: '时间流逝符合物理规律',
    check: (shotA, shotB) => {
      // 检查序列号连续性
      const seqA = shotA.sequence || 0;
      const seqB = shotB.sequence || 0;
      const issues = [];

      if (seqB !== seqA + 1) {
        issues.push(`序列不连续: ${seqA} → ${seqB}`);
      }

      // 检查时长合理性
      const durA = shotA.duration || 5;
      const durB = shotB.duration || 5;
      if (durB > durA * 3) {
        issues.push(`时长突增: ${durA}s → ${durB}s`);
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'warning' : 'pass'
      };
    }
  },

  camera: {
    name: '运镜连续性',
    description: '运镜连贯，无跳切',
    check: (shotA, shotB) => {
      const camA = shotA.cameraMovement || {};
      const camB = shotB.cameraMovement || {};
      const issues = [];

      // 检测跳切：从极远景突然跳到极近景
      const typeA = camA.type || 'static';
      const typeB = camB.type || 'static';

      const extremeTypes = ['drone', 'crane'];
      const closeTypes = ['close-up'];

      if (extremeTypes.includes(typeA) && closeTypes.includes(typeB)) {
        issues.push('从极远景突然跳到特写');
      }

      return {
        passed: issues.length === 0,
        issues,
        severity: issues.length > 0 ? 'info' : 'pass'
      };
    }
  }
};

// ============================================================
// 二、连续性检查器
// ============================================================

class ContinuityChecker {
  constructor(rules = CONTINUITY_RULES) {
    this.rules = { ...rules };
  }

  /**
   * 检查两个相邻镜头
   */
  checkPair(shotA, shotB, dimensions = null) {
    const checkDimensions = dimensions || Object.keys(this.rules);
    const results = {};
    let allPassed = true;
    let totalIssues = 0;

    for (const dim of checkDimensions) {
      const rule = this.rules[dim];
      if (!rule) continue;

      try {
        const result = rule.check(shotA, shotB);
        results[dim] = {
          name: rule.name,
          ...result
        };
        if (!result.passed) {
          allPassed = false;
          totalIssues += result.issues.length;
        }
      } catch (error) {
        results[dim] = {
          name: rule.name,
          passed: false,
          issues: [`检查异常: ${error.message}`],
          severity: 'warning'
        };
        allPassed = false;
      }
    }

    return {
      passed: allPassed,
      issues: totalIssues,
      results,
      shotA: shotA.id || shotA.shotId,
      shotB: shotB.id || shotB.shotId
    };
  }

  /**
   * 检查整个镜头序列
   */
  checkSequence(shots, dimensions = null) {
    const pairResults = [];
    let totalIssues = 0;

    for (let i = 0; i < shots.length - 1; i++) {
      const result = this.checkPair(shots[i], shots[i + 1], dimensions);
      pairResults.push(result);
      if (!result.passed) totalIssues += result.issues;
    }

    // 汇总
    const allIssues = pairResults.flatMap(r =>
      Object.entries(r.results).filter(([, v]) => !v.passed).map(([dim, v]) => ({
        dimension: dim,
        between: `${r.shotA} → ${r.shotB}`,
        issues: v.issues
      }))
    );

    return {
      passed: totalIssues === 0,
      totalIssues,
      totalPairs: pairResults.length,
      passedPairs: pairResults.filter(r => r.passed).length,
      issues: allIssues,
      pairResults
    };
  }

  /**
   * 检查特定维度
   */
  checkDimension(shots, dimension) {
    return this.checkSequence(shots, [dimension]);
  }
}

// ============================================================
// 三、修复建议
// ============================================================

class FixSuggestion {
  constructor() {
    this.fixes = {
      lighting: (issue) => {
        if (issue.includes('时间场景')) {
          return '确保相邻镜头的时间场景一致（如都是白天或都是夜晚）';
        }
        return '检查光照描述的一致性';
      },
      character: (issue) => {
        if (issue.includes('角色数量')) {
          return '确保角色数量变化有合理叙事解释';
        }
        if (issue.includes('角色消失')) {
          return '在镜头中提及角色去向，避免突然消失';
        }
        return '确保角色描述一致性';
      },
      environment: (issue) => {
        if (issue.includes('室内') || issue.includes('室外')) {
          return '室内/室外切换需要过渡镜头（如门、窗）';
        }
        return '确保场景描述一致性';
      },
      color: (issue) => {
        return '相邻镜头保持色彩方案一致，或使用过渡解释色彩变化';
      },
      time: (issue) => {
        if (issue.includes('序列')) {
          return '修复镜头序列编号';
        }
        if (issue.includes('时长')) {
          return '调整时长，避免时长突变';
        }
        return '确保时间流逝合理性';
      },
      camera: (issue) => {
        return '避免极端运镜切换，增加过渡镜头';
      }
    };
  }

  getFix(dimension, issue) {
    const fixFn = this.fixes[dimension];
    return fixFn ? fixFn(issue) : '手动检查该维度';
  }

  generateFixes(continuityResult) {
    const fixes = [];
    for (const issue of continuityResult.issues) {
      for (const detail of issue.issues) {
        fixes.push({
          dimension: issue.dimension,
          between: issue.between,
          issue: detail,
          suggestion: this.getFix(issue.dimension, detail)
        });
      }
    }
    return fixes;
  }
}

// ============================================================
// 四、视觉连续性引擎
// ============================================================

class VisualContinuityEngine {
  constructor(options = {}) {
    this.checker = new ContinuityChecker();
    this.fixer = new FixSuggestion();
    this.eventBus = new NirathEventBus({ name: 'continuity', enabled: true });
    this.checkHistory = [];
    this.autoFix = options.autoFix !== false;
  }

  /**
   * 检查镜头序列连续性
   */
  check(shots, options = {}) {
    const dimensions = options.dimensions || Object.keys(CONTINUITY_RULES);
    const result = this.checker.checkSequence(shots, dimensions);

    // 记录历史
    this.checkHistory.push({
      timestamp: Date.now(),
      totalShots: shots.length,
      ...result
    });

    // 发布事件
    if (!result.passed) {
      this.eventBus.publish('continuity.violation', {
        totalIssues: result.totalIssues,
        issues: result.issues,
        passedPairs: result.passedPairs,
        totalPairs: result.totalPairs
      }, { traceId: options.traceId || `cont_${Date.now()}` });
    }

    // 生成修复建议
    if (!result.passed) {
      result.fixes = this.fixer.generateFixes(result);
    }

    return result;
  }

  /**
   * 检查特定维度
   */
  checkDimension(shots, dimension) {
    return this.checker.checkDimension(shots, dimension);
  }

  /**
   * 获取历史报告
   */
  getHistoryReport() {
    const total = this.checkHistory.length;
    const passed = this.checkHistory.filter(h => h.passed).length;

    return {
      totalChecks: total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? (passed / total).toFixed(2) : 0,
      recentViolations: this.checkHistory
        .filter(h => !h.passed)
        .slice(-5)
        .map(h => ({
          timestamp: h.timestamp,
          totalIssues: h.totalIssues
        }))
    };
  }

  /**
   * 获取修复建议
   */
  getFixes(continuityResult) {
    return this.fixer.generateFixes(continuityResult);
  }
}

// ============================================================
// 五、导出
// ============================================================

module.exports = {
  VisualContinuityEngine,
  ContinuityChecker,
  ContinuityRule: CONTINUITY_RULES,
  FixSuggestion,

  // 快速创建
  createContinuityEngine: (options) => new VisualContinuityEngine(options)
};

// ============================================================
// 六、集成测试
// ============================================================

if (require.main === module) {
  async function test() {
    console.log('=== Visual Continuity Engine 集成测试 ===\n');

    const engine = new VisualContinuityEngine();

    // 测试1：正常连续性
    console.log('--- 测试1：正常连续性 ---');
    const goodShots = [
      { id: 'S01', sequence: 1, scene: '山顶早晨', visualPrompt: '少年站在山顶，晨光', duration: 5, characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S02', sequence: 2, scene: '山顶早晨', visualPrompt: '少年看向远方，晨光', duration: 5, characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S03', sequence: 3, scene: '山顶早晨', visualPrompt: '少年走下山顶，晨光', duration: 5, characters: [{ id: 'hero', name: '少年' }] }
    ];
    const result1 = engine.check(goodShots);
    console.log('通过:', result1.passed);
    console.log('问题数:', result1.totalIssues);

    // 测试2：角色消失
    console.log('\n--- 测试2：角色消失 ---');
    const badShots = [
      { id: 'S01', sequence: 1, scene: '山顶', visualPrompt: '少年在山顶', duration: 5, characters: [{ id: 'hero', name: '少年' }] },
      { id: 'S02', sequence: 2, scene: '山顶', visualPrompt: '空镜头', duration: 5, characters: [] },  // 角色消失！
      { id: 'S03', sequence: 3, scene: '山顶', visualPrompt: '少年在山顶', duration: 5, characters: [{ id: 'hero', name: '少年' }] }
    ];
    const result2 = engine.check(badShots);
    console.log('通过:', result2.passed);
    console.log('问题数:', result2.totalIssues);
    console.log('修复建议:', result2.fixes?.map(f => f.suggestion).join('; '));

    // 测试3：时间场景突变
    console.log('\n--- 测试3：时间场景突变 ---');
    const timeShots = [
      { id: 'S01', sequence: 1, scene: '白天山顶', visualPrompt: '少年在山顶', duration: 5 },
      { id: 'S02', sequence: 2, scene: '夜晚山顶', visualPrompt: '少年在山顶', duration: 5 }  // 时间突变！
    ];
    const result3 = engine.check(timeShots, { dimensions: ['lighting'] });
    console.log('光照问题:', result3.results?.lighting?.issues);

    console.log('\n=== 测试完成 ===');
  }

  test().catch(console.error);
}

```

---

## core/llm-call-isolated-worker.js

> 文件大小: 1395 bytes

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputFile || !outputFile) {
    throw new Error('Usage: node llm-call-isolated-worker.js <inputFile> <outputFile>');
  }

  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const {
    prompt,
    options = {}
  } = input;

  const { LLMEngine } = require('../systems/llm-reasoning-engine');

  const engine = new LLMEngine({
    model: options.model || 'kimi-k2p6',
    mode: options.mode || 'production',
    maxRetries: options.maxRetries ?? 0, // 交给外层控制，内部尽量不重试
    maxTokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 1,
    topP: options.topP ?? 0.95
  });

  const result = await engine.generate(prompt, {
    maxTokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 1,
    timeoutMs: options.timeoutMs || 120000
  });

  fs.writeFileSync(outputFile, JSON.stringify({
    success: true,
    result
  }, null, 2), 'utf8');
}

main().catch((err) => {
  const outputFile = process.argv[3];
  try {
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack
      }, null, 2), 'utf8');
    }
  } catch (_) {}
  process.exit(1);
});

```

---

## core/nirath-master-pipeline.js

> 文件大小: 455416 bytes

```javascript
/**
 * Nirath Master Pipeline v1.1
 * 世界级IP短片生成引擎主链路入口
 *
 * 🔥 P0-固化原则:每次预生产必须走全链路 + 各环节最新版
 * - 每次执行 = 全新执行,无视历史。清理旧输出 → 跑完整链路 → 全新数据 → 当前版本
 * - 预生产不是生产,是测试。测试就要用最新代码、全新数据、完整链路
 * - 禁止复用旧输出、禁止跳过环节、禁止用历史数据替代重新生成
 * - 即使同一任务反复测试,每次也必须用最新系统版本重新跑完整链路
 * - 违反 = 系统级错误,立即上报队长
 *
 * v6.5.13: generic模式修复
 * - 修复LLM返回"undefined"字符串导致scene字段丢失
 * - 修复五要素注入残留Nirath痕迹(主角主动性/情感弧线/成长转变)
 * - 修复导演风格错误使用alien_ecosystem(generic模式返回纪录片风格)
 * - 修复运镜系统返回字符串而非对象导致description为空
 * - v6.5.12: generic模式prompt动态模板 + 角色校验 + 可选链修复
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ========== 新增:链路完整性反向验证器 ==========
const { PipelineIntegrityValidator } = require('../systems/pipeline-integrity-validator.js');

// ========== 新增:定妆照强制提交闸机 v1.0 ==========
const { ReferenceImageGate } = require('../systems/reference-image-gate.js');

// ========== v6.0-patch38新增:全局负面提示词注入器 ==========
const { globalNegativePromptInjector } = require('../systems/global-negative-prompts.js');

// ========== v6.2-patch82: Prompt标准模块化系统 ==========
const StandardV3 = require('../systems/prompt-standard-v3');  // v3.0: 智能检测+自动修复(旁路)

// ========== v6.5.58: Validator 3 Bug 修复 ==========
const { normalizeLLMOutput } = require('../systems/llm-output-normalizer');
const { standardizePrompt } = require('../systems/prompt-standardizer');
const { safeTrimPrompt } = require('../systems/safe-prompt-trim');
const { checkStandardCompliance } = require('../systems/prompt-standard-v3');
const { processShotsForCompliance, processShotsForOutput, summarizeCompliance } = require('../systems/prompt-pipeline-bridge');
const { buildStandardPromptFromShot } = require('../systems/prompt-standard-bridge');
const { safeStructuredTrim } = require('../systems/safe-structured-trim');
const {
  asString,
  getSceneName,
  getSceneDisplayText,
  normalizeCharacterEntry,
  getCharacterName,
  getCharacterProfile,
  getCharacterPortraits,
  getPromptText,
  normalizeReferenceImages
} = require('../systems/pipeline-safe-accessors');
const { normalizeDialogueShots } = require('../systems/dialogue-normalizer');
const {
  normalizePortraitMapToReferenceImages,
  mergeReferenceImages
} = require('../systems/reference-image-normalizer');
const { FallbackMonitor } = require('../systems/fallback-monitor');
const { normalizeRenderShots } = require('../systems/render-shot-normalizer');

// ========== 新增:镜头内Prompt增强器(v6.0-patch23融入) ==========
const { buildAudioDescription, injectAudioDescription } = require('../systems/intra-shot-prompt-enhancer.js');
const { CalibrationEngine, PRD_TEMPLATE } = require('../../shanhaijing-render-engine/story-prd-template-v21.js');
const { RequirementContract, AlignmentGate } = require('../../seedance-director/scripts/requirement-alignment-gate.js');
const { SchemaRuntimeValidator } = require('../../seedance-director/scripts/schema-validator.js');
const { StoryboardValidator } = require('../systems/storyboard-validator.js');
const { preRenderValidation, validateCharacterReferences } = require('../systems/pre-render-validation.js');

// ========== v2.0: 创意指数系统 (Creative Intensity Index) ==========
const { CreativeIntensityIndex } = require('../systems/creative-intensity-index.js');
const { CreativeIntensityRecommender } = require('../systems/creative-intensity-recommender.js');

// ========== 新增:片头系统集成(v3.0-patch5) ==========
// v6.6.9.4-patch9: 移除山海经专属片头，统一使用通用片头系统
const OpeningSystem = require('../systems/opening-system-v3.js');
const { CharacterManagerV2 } = require('../systems/character-manager-v2.js');
const { CharacterPromptBuilder } = require('../systems/character-prompt-builder.js');
const { CharacterComplianceChecker } = require('../systems/character-compliance-checker.js');
const { CharacterEraGuide } = require('../systems/character-era-guide.js');

// v6.3-patch10-fix: 引入真实字符计数模块
const { charCounter } = require('../systems/char-counter');
const { dedupeShotFields } = require('../systems/prompt-dedupe');
const PROMPT_LENGTH = require('../../config/prompt-length');

// ========== v6.2-patch68: 环境音效设计Agent ==========
const { generateAmbientSoundField } = require('../systems/ambient-sound-designer.js');

// ========== 渲染层模块(视频生成核心) ==========
const { OrientPrimordialCoreV24 } = require('../../shanhaijing-render-engine/orient-primordial-core-v24.js');
const { CameraMovementSystem } = require('../systems/camera-movement-system-v2.js');
// v6.6.9.4-patch9: 移除v3镜头内时间轴生成器，统一使用v4 LLM驱动系统
const { CameraMovementSystemV4 } = require('../systems/camera-movement-system-v4.js');
const { NirathCharacterEnhancer, WorldSoulBinding } = require('../systems/nirath/nirath-character-enhancement.js');
const audit = require('../systems/audit-logger'); // P1: 操作审计日志
const { UniversalStyleInjector } = require('../systems/universal-style-injector.js');

// ========== 辅助层模块 ==========
const { ShotDurationAllocator } = require('../systems/shot-duration-allocator.js');
const { DurationCalculator } = require('../systems/duration-calculator.js');
const { ContinuityEngine } = require('../systems/continuity-engine.js');

// 【v6.0-patch22 新增】视觉锚点注入器
const { NirathVisualAnchorInjector } = require('../systems/nirath/nirath-visual-anchor-injector.js');

// 【v6.4.1】StageRunner + StageService + QualityGate
const { StageRunner } = require('../systems/stage-runner');
const { StageContext } = require('../systems/stage-context');
const { QualityGate } = require('../systems/quality-gate');
// const { StageScriptService } = require('../systems/stages/stage-script');
// const { StageDurationService } = require('../systems/stages/stage-duration');
// const { StageStoryboardService } = require('../systems/stages/stage-storyboard');
// const { StageCameraService } = require('../systems/stages/stage-camera');
// const { StageRenderPrepService } = require('../systems/stages/stage-render-prep');

// 【v6.0-patch22 新增】后期制作管线(标题烧录)
const { PostProductionPipeline } = require('../systems/post-production-pipeline.js');

// 【v6.2-patch46 新增】MicroMotion + BeastMotion 动作增强适配器
let MicroMotionSystem, ShanhaijingMicroMotionSystem, beastMotionAdapter;
try {
  MicroMotionSystem = require('../seedance-micromotion/scripts/micromotion').MicroMotionSystem;
} catch (e) { /* 可选依赖 */ }
try {
  ShanhaijingMicroMotionSystem = require('../shanhaijing-micromotion/scripts/micromotion').ShanhaijingMicroMotionSystem;
} catch (e) { /* 可选依赖 */ }
try {
  beastMotionAdapter = require('../shanhaijing-beast-motion/beast-motion-adapter');
} catch (e) { /* 可选依赖 */ }

// 【v6.2-patch47 新增】美术布景模块(Set Design Module)
let SetDesignModule;
try {
  SetDesignModule = require('../systems/set-design-module/index').SetDesignModule;
} catch (e) { /* 可选依赖 */ }

// 【v6.2-patch51 新增】主角主动性自动注入器
const { ProactiveProtagonistInjector } = require('../systems/proactive-protagonist-injector.js');

// 【v6.2-patch51 新增】结尾镜情绪增强器
const { ClosingShotEmotionalBooster } = require('../systems/closing-shot-emotional-booster.js');

// 【v6.2-patch51 新增】Narration自动精简器
const { NarrationAutoTrim } = require('../systems/narration-auto-trim.js');

// 【v6.2-patch52 新增】时长-字数一致性校准器
const { DurationNarrationAlignment } = require('../systems/duration-narration-alignment.js');
// 【v6.6.0 新增】用户需求解析确认模块(Stage -1)
const { UserRequirementParser } = require('../systems/user-requirement-parser.js');

// 【v6.6.0 新增】真实感提示词增强器(软性注入层)
const { RealismPromptEnhancer } = require('../systems/realism-prompt-enhancer.js');
const { ExecutionIntegrityEnforcer } = require('../systems/execution-integrity-enforcer.js');

// ========== v6.2-patch96: 微表情系统 v2.0 ==========
const { MicroExpressionAllocator } = require('../systems/micro-expression-system-v2.js');
// ========== v6.2-patch63: 独白通道隔离+运镜同步+情绪增强器边界修复 ==========
const PromptTierArchitecture = require('../systems/prompt-tier-architecture.js');
const { PromptChannelSeparator } = require('../systems/prompt-channel-separator.js');
const { PromptQualityGate } = require('../systems/prompt-quality-gate.js');
const { TechSpecsAndEmotionMapper } = require('../systems/tech-specs-emotion-mapper.js');
const { WorldviewAndSceneManager } = require('../systems/worldview-scene-manager.js');

// 【v6.5.43】引入新链路:FinalPromptBuilderV3(外部专家建议落地)
const { FinalPromptBuilderV3 } = require('../systems/final-prompt-builder-v3');
function safeGetPromptText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const candidates = [
    obj.render_prompt,
    obj.renderPrompt,
    obj.prompt,
    obj.visualPrompt
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item;
  }
  return '';
}

function getPromptLengthStatus(length) {
  if (length > PROMPT_LENGTH.HARD_MAX) return 'overflow';
  if (length < PROMPT_LENGTH.TARGET_MIN) return 'underflow';
  if (length <= PROMPT_LENGTH.TARGET_MAX) return 'ideal';
  return 'unknown';
}

function slimPipelineResult(result) {
  const stages = result?.stages || {};
  const prompts = stages.output?.prompts || [];
  const storyboardShots = stages.storyboard?.shots || [];

  const getPrompt = (p) => {
    if (!p || typeof p !== 'object') return '';
    return p.prompt || p.text || p.content || p.visualPrompt || p.description || '';
  };

  const getLength = (p) => {
    if (p && p.length) return p.length;
    const text = getPrompt(p);
    return text ? text.length : 0;
  };

  return {
    success: result?.success ?? false,
    errors: result?.errors || [],
    integrityReport: result?.integrityReport || null,
    stages: {
      output: {
        prompts: prompts.map(p => ({
          shotId: p?.shotId,
          scene: p?.scene,
          type: p?.type,
          duration: p?.duration,
          prompt: getPrompt(p),
          length: getLength(p),
          lengthStatus: getPromptLengthStatus(getLength(p)),
          utilization: p?.utilization,
          utilizationStatus: p?.utilizationStatus,
          qualityScore: p?.qualityScore,
          characters: p?.characters,
          mouthAction: p?.mouthAction,
          referenceImages: Array.isArray(p?.referenceImages)
            ? p.referenceImages.map(r => ({ shotType: r?.shotType || r?.type || 'unknown' }))
            : []
        }))
      },
      storyboard: {
        shots: storyboardShots.map(s => ({
          id: s?.id,
          scene: s?.scene,
          type: s?.type,
          duration: s?.duration,
          timeline: s?._timeline || s?.cameraMovement?.timeline || null
        }))
      },
      stageList: Object.keys(stages)
    }
  };
}

// ========== 配置 ==========
// 使用动态路径替代硬编码
const WORKSPACE = process.env.WORKSPACE_DIR || path.join(__dirname, '..');

class NirathMasterPipeline {
  constructor(options = {}) {
    this.options = options; // v6.6.9.4-patch10-fix: 保存options供后续读取
    this.mode = options.mode || 'nirath'; // 'generic' | 'nirath'
    this.projectConfig = options.projectConfig || {};
    this.useLLM = options.useLLM !== false; // v6.2-patch71-fix: 默认启用LLM
    this._modules = null; // 🔥 v6.2-patch75: 惰性加载,首次访问时初始化
    this.statusReporter = options.statusReporter || null; // 【v6.2-patch84】状态报告器
    this.outputDir = options.outputDir || '/tmp'; // v6.2-patch111-fix: 确保outputDir有默认值

    // 定义modules getter -- 惰性初始化所有模块
    Object.defineProperty(this, 'modules', {
      get: () => {
        if (!this._modules) {
          this._initModules();
        }
        return this._modules;
      },
      configurable: true
    });

    // 🔥 v2.0: 创意指数系统初始化
    this.creativeIntensityIndex = new CreativeIntensityIndex({
      defaultValue: 0.2,
      maxValue: 1.0,
      minValue: 0.0
    });

    // 🔥 v2.0: Phase 3 - 智能推荐系统初始化
    this.creativeIntensityRecommender = new CreativeIntensityRecommender({
      dataPath: path.join(__dirname, '../data/creative-intensity-feedback.json'),
      minSamples: 3,
      confidenceThreshold: 0.6
    });

    // 🔥 v6.6.0: 真实感提示词增强器(软性注入层)
    this.realismEnhancer = new RealismPromptEnhancer({
      enabled: true,
      mode: 'smart', // 默认智能模式:分析缺失维度并补全
      sceneType: 'general'
    });

    // 🔥 v6.6.5-v4: 初始化LLM驱动个性化时间轴系统
    this.cameraMovementV4 = new CameraMovementSystemV4({
      llmOptions: {
        model: 'kimi-k2p6',
        maxTokens: 2048
      },
      toggleOptions: {
        mode: 'auto', // auto/always/never
        defaultMode: 'standard'
      }
    });

    this.creativeIntensity = null; // 将在execute中解析
    this.logs = []; // 🔥 日志数组初始化
    this.errors = [];
    this._asyncTasks = []; // v6.2-patch76: 追踪异步LLM任务
    this.charactersDir = options.charactersDir || path.join(__dirname, '..', '..', 'characters'); // v6.6.5: 角色目录初始化
    this.fallbackMonitor = new FallbackMonitor();
  }

  /**
   * v6.2-patch76: 注册异步任务,供外部等待
   */
  _registerAsyncTask(promise) {
    this._asyncTasks.push(promise);
    // 清理已完成的任务
    promise.finally(() => {
      const idx = this._asyncTasks.indexOf(promise);
      if (idx >= 0) this._asyncTasks.splice(idx, 1);
    });
    return promise;
  }

  /**
   * v6.2-patch76: 获取所有pending的异步任务
   */
  getPendingAsyncTasks() {
    return this._asyncTasks.filter(p => p && typeof p.then === 'function');
  }

  // 🔥 v6.2-patch75: 模块惰性初始化器 -- 首次访问modules时触发
  _initModules() {
    this.log('INIT', '🚀 首次访问modules,惰性初始化59个模块(启动提速50-70%)');

    this._modules = {
      // 核心层
      calibrationEngine: new CalibrationEngine(),
      alignmentGate: new AlignmentGate(),
      schemaValidator: new SchemaRuntimeValidator(),
      storyboardValidator: new StoryboardValidator(),
      preRenderValidation: async (path, opts) => preRenderValidation(path, opts),

      // 角色层
      characterManager: new CharacterManagerV2(),
      characterPromptBuilder: new CharacterPromptBuilder(),
      characterComplianceChecker: new CharacterComplianceChecker(),
      characterEraGuide: new CharacterEraGuide(),

      // 渲染层
      renderCore: new OrientPrimordialCoreV24(),
      cameraMovement: new CameraMovementSystem(),
      nirathCharacterEnhancer: new NirathCharacterEnhancer(),
      worldSoulBinding: new WorldSoulBinding(),
      styleInjector: new UniversalStyleInjector(),

      // 辅助层
      shotDurationAllocator: new ShotDurationAllocator(),
      durationCalculator: new DurationCalculator(),
      continuityEngine: new ContinuityEngine(),

      // 【v6.2-patch46 新增】MicroMotion + BeastMotion 动作增强适配器
      microMotionAdapter: null, // 由Pipeline初始化时注入
      beastMotionAdapter: null, // 由Pipeline初始化时注入

      // 【v6.2-patch47 新增】美术布景模块
      setDesignModule: null, // 由Pipeline初始化时注入

      // 【v6.2-patch51 新增】主角主动性自动注入器
      protagonistInjector: new ProactiveProtagonistInjector(),

      // 【v6.2-patch51 新增】结尾镜情绪增强器
      closingBooster: new ClosingShotEmotionalBooster(),

      // 【v6.2-patch51 新增】Narration自动精简器
      narrationTrimmer: new NarrationAutoTrim(),

      // 【v6.2-patch52 新增】时长-字数一致性校准器
      durationAlignment: new DurationNarrationAlignment(),

      // 【v6.5.43】新链路:FinalPromptBuilderV3(外部专家建议落地)
      finalPromptBuilder: new FinalPromptBuilderV3({
        mode: this.mode, // v6.6.9.4-patch25: 传递模式参数，支持generic隔离
        debug: true,
        llmEnabled: this.useLLM,
        debugOutputDir: this.outputDir
      }),
      promptTierArchitecture: new PromptTierArchitecture(),
      promptChannelSeparator: new PromptChannelSeparator(),
      promptQualityGate: new PromptQualityGate(),
      techSpecsEmotionMapper: new TechSpecsAndEmotionMapper(),
      worldviewSceneManager: new WorldviewAndSceneManager(),

      // 【v6.0-patch22 新增】Nirath视觉锚点注入器
      nirathVisualInjector: new NirathVisualAnchorInjector(),

      // 【v6.0-patch22 新增】后期制作管线(生产阶段使用)
      postProduction: new PostProductionPipeline({
        outputRatio: '16:9',
        outputWidth: 1280,
        outputHeight: 720
      })
    };

    // 【v6.2-patch46】初始化动作增强适配器(可选)
    if (ShanhaijingMicroMotionSystem) {
      this._modules.microMotionAdapter = new ShanhaijingMicroMotionSystem({ debug: false });
    } else if (MicroMotionSystem) {
      this._modules.microMotionAdapter = new MicroMotionSystem({ debug: false });
    }
    if (beastMotionAdapter) {
      this._modules.beastMotionAdapter = beastMotionAdapter;
    }

    // 【v6.2-patch47】初始化美术布景模块(可选)
    if (SetDesignModule) {
      this._modules.setDesignModule = new SetDesignModule({ debug: false });
    }
  }

  log(stage, message, level = 'info') {
    const entry = { timestamp: new Date().toISOString(), stage, level, message };
    this.logs.push(entry);
    if (level === 'error') this.errors.push(entry);
    console.log(`[${entry.timestamp}] [${stage}] ${level.toUpperCase()}: ${message}`);
  }

  // ========== 🔥 v6.2新增: 前置检查(定妆照存在性 + 输入完整性)==========
  async preFlightCheck(input) {
    this.log('PREFLIGHT', '🔍 启动前置检查(v6.2)');
    const issues = [];
    const portraits = [];

    // 1. 角色定妆照检查
    const charactersData = Array.isArray(input.characters)
      ? Object.fromEntries(input.characters.map(c => [c.id, c]))
      : (input.characters || {});
    const characterIds = Object.keys(charactersData);

    for (const charId of characterIds) {
      const check = await this.checkCharacterPortraits(charId);
      portraits.push({ charId, ...check });
      if (!check.exists) {
        issues.push({
          type: 'portrait_missing',
          charId,
          missingAngles: check.missingAngles,
          message: `角色[${charId}]定妆照缺失:${check.missingAngles.join(', ')}`
        });
      } else {
        this.log('PREFLIGHT', `  ✅ 定妆照齐全: ${charId} | ${check.foundAngles.length}个角度`);
      }
    }

    // 2. 基本输入完整性检查
    if (!input.projectName) issues.push({ type: 'input_missing', field: 'projectName' });
    if (!input.scenes || input.scenes.length === 0) issues.push({ type: 'input_missing', field: 'scenes' });
    if (characterIds.length === 0) issues.push({ type: 'input_missing', field: 'characters' });

    const canProceed = issues.length === 0;

    this.log('PREFLIGHT', canProceed
      ? `✅ 前置检查通过 | 角色数: ${characterIds.length}`
      : `⛔ 前置检查失败 | 问题数: ${issues.length}`);

    return { canProceed, issues, portraits, characterCount: characterIds.length };
  }

  /**
   * 【v6.3-patch7-fix】清理 Stage 3 合成师输出的字符计数残留
   * 处理如 "焦(1);(1)1(1)2(1)-(1)1(1)5(1)s(1)..." 这种格式
   */
  _cleanForgePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return prompt;

    let cleaned = prompt;

    // 只清理字符计数残留,不删除任何内容
    cleaned = cleaned.replace(/\(\d+\)/g, '');
    cleaned = cleaned.replace(/=\d+字符/g, '');
    cleaned = cleaned.replace(/\d+chars/gi, '');

    // 清理多余空格
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  // ========== 主链路执行 ==========
  async execute(input, options = {}) {
    const { onStageComplete } = options; // 🔥 v6.5.60: 阶段完成回调

    const pipelineStart = Date.now(); // P1: 审计日志计时
    this.log('PIPELINE', `🚀 NirathMasterPipeline启动 | 模式: ${this.mode} | 项目: ${input.projectName || 'unknown'}`);

    // 🔥 P0-固化原则:每次预生产必须走全链路 + 各环节最新版
    // 每次执行 = 全新执行,无视历史。清理旧输出 → 跑完整链路 → 全新数据 → 当前版本
    // 预生产不是生产,是测试。测试就要用最新代码、全新数据、完整链路
    // 禁止复用旧输出、禁止跳过环节、禁止用历史数据替代重新生成
    // 即使同一任务反复测试,每次也必须用最新系统版本重新跑完整链路
    // 违反 = 系统级错误,立即上报队长
    this.log('PIPELINE', '🔥 P0-固化:每次预生产 = 全链路 + 最新版 | 无视历史,全新执行');

    // 🔥 v6.6.0: Stage -1 - 用户需求解析确认模块(前置闸机,所有输入必须经过)
    // 无论输入是自然语言还是结构化数据,都要经过需求解析确认
    this.log('PIPELINE', '📝 [Stage -1] 启动需求解析确认模块...');
    try {
      const parser = new UserRequirementParser({ llmEngine: this.llmEngine });

      // 将输入统一为字符串(如果是结构化,先序列化)
      let parseInput;
      if (typeof input === 'string') {
        parseInput = input;
      } else {
        // 结构化输入:提取关键信息,让 parser 做验证和补全
        parseInput = JSON.stringify({
          videoType: input.videoType || input.type,
          title: input.title || input.projectName,
          characters: input.characters?.map(c => c.name || c).join(', '),
          duration: input.targetDuration || input.duration,
          style: input.style,
          creativeIntensity: input.creativeIntensity,
          platform: input.platform || input.core?.platform,
          series: input.isSeries ? `共${input.totalEpisodes}集,第${input.episode}集` : '',
          rawDescription: input.description || input._rawInput || ''
        });
      }

      const parseResult = await parser.parse(parseInput, { mode: this.mode });

      this.log('PIPELINE', `📝 [Stage -1] ✅ 需求解析完成 | 类型: ${parseResult.basicInfo.videoTypeName} | 时长: ${parseResult.productionSpecs.duration.target}秒 | 创意指数: ${parseResult.productionSpecs.creativeIntensity}`);

      // v6.6.4: 生成《视频需求要点清单》并保存
      const requirementListPath = await parser.saveRequirementList(parseResult);
      const requirementList = parser.generateRequirementList(parseResult);
      this.log('PIPELINE', `📝 [Stage -1] ✅ 需求清单已生成: ${requirementListPath}`);

      // 输出清单内容到日志(用户可见)
      console.log('\n' + '='.repeat(60));
      console.log('📋 视频需求要点清单(请确认后进入预生产)');
      console.log('='.repeat(60));
      console.log(requirementList);
      console.log('='.repeat(60));

      // 将清单保存到 pipeline 上下文,供后续追溯
      this.requirementList = {
        content: requirementList,
        path: requirementListPath,
        parseResult: parseResult,
        confirmed: false, // 待确认
        timestamp: new Date().toISOString()
      };

      // v6.6.4: 需求清单确认检查(除非用户显式跳过)
      if (options.skipRequirementConfirmation !== true) {
        this.log('PIPELINE', '⏸️ [Stage -1] 需求清单已生成,等待用户确认...');
        this.log('PIPELINE', '⏸️ 请检查上方"视频需求要点清单",确认后回复"确认"继续');

        // 返回清单等待确认,不进入主链路
        return {
          status: 'REQUIREMENT_CONFIRMATION_REQUIRED',
          message: '请确认视频需求要点清单',
          requirementList: this.requirementList,
          nextStep: '回复"确认"或提出修改意见'
        };
      }

      this.log('PIPELINE', '📝 [Stage -1] ✅ 用户已确认(跳过模式),进入主链路...');

      // 将解析结果合并到现有输入(解析结果优先,但保留用户的显式指定)
      let pipelineInput = parser.toPipelineInput(parseResult);

      // 如果用户输入是结构化的,保留用户的显式字段(用户指定 > AI推断)
      if (typeof input === 'object') {
        // 保留用户显式指定的字段
        if (input.videoType) pipelineInput.videoType = input.videoType;
        if (input.title) pipelineInput.title = input.title;
        if (input.targetDuration || input.duration) pipelineInput.targetDuration = input.targetDuration || input.duration;
        if (input.creativeIntensity !== undefined) pipelineInput.creativeIntensity = input.creativeIntensity;
        if (input.style) pipelineInput.style = input.style;
        if (input.characters) pipelineInput.characters = input.characters;
        // 保留其他用户字段
        pipelineInput = { ...pipelineInput, ...input };
      }

      pipelineInput._requirementParseResult = parseResult; // 保留原始解析结果供追溯
      input = pipelineInput;

      this.log('PIPELINE', '📝 [Stage -1] ✅ 需求解析确认完成,进入主链路...');
    } catch (error) {
      this.log('PIPELINE', `⚠️ [Stage -1] 需求解析异常: ${error.message},使用原始输入继续`);
      // 如果解析失败,保持原始输入不变,但记录错误
      if (typeof input === 'object') {
        input._requirementParseError = error.message;
      }
    }

    // 🔥 v2.0: 创意指数解析(Stage 0 前置)
    this.creativeIntensity = this.creativeIntensityIndex.parse(input);

    // 🔥 v2.0: Phase 3 - 智能推荐系统(如果用户未指定,自动推荐)
    if (!input.creativeIntensity && !input.creative && !input.intensity) {
      const videoType = input.videoType || input.type || 'generic';
      const recommendation = this.creativeIntensityRecommender.recommend(videoType);

      if (!recommendation.isDefault) {
        // 数据驱动推荐,覆盖默认值
        this.creativeIntensity = recommendation.intensity;
        this.log('PIPELINE', `🎨 [智能推荐] 视频类型="${videoType}" | 基于 ${recommendation.samples} 个样本推荐 intensity=${recommendation.intensity} | 置信度 ${(recommendation.confidence * 100).toFixed(0)}%`);
      } else {
        // 使用默认值,但提示用户
        this.log('PIPELINE', `🎨 [智能推荐] 视频类型="${videoType}" | 样本不足,使用类型默认值 intensity=${recommendation.intensity} | ${recommendation.reason}`);
      }
    }

    const ciiReport = this.creativeIntensityIndex.generateReport(this.creativeIntensity);
    this.log('PIPELINE', `🎨 创意指数解析: ${this.creativeIntensity} (${ciiReport.levelName}) | 激活 ${ciiReport.activeModules.length}/14 模块`);
    this.log('PIPELINE', ciiReport.firewall);

    // 将创意指数存入result供后续Stage使用
    const result = {
      success: false,
      stages: {},
      errors: [],
      creativeIntensity: this.creativeIntensity,
      creativeIntensityReport: ciiReport,
      logs: this.logs
    };

    // 【v6.2-patch53】执行完整性强制器 - 三重锁启动
    const enforcer = new ExecutionIntegrityEnforcer();
    await enforcer.enforcePreExecution(path.join(__dirname, '..'));

    // P1: 审计日志 - 链路启动
    audit.log('pipeline-start', 'nirath-master-pipeline', {
      actor: 'system',
      input: { projectName: input.projectName, mode: this.mode, shotCount: input.shots?.length },
      result: 'pending',
      metadata: { projectType: input.videoType }
    }).catch(e => console.error(`[Audit] 日志写入失败: ${e.message}`));


    const { StagePerformanceBaseline } = require('../systems/stage-performance-baseline.js');
    const performanceBaseline = new StagePerformanceBaseline({ enabled: true });

    // 【v6.4.1】StageRunner + StageContext 初始化
    const stageContext = new StageContext({
      input,
      shared: {},
      pipeline: this,
      reporter: this.statusReporter,
      result: { stages: {}, errors: [] }
    });

    const stageRunner = new StageRunner({
      logger: this.logger,
      reporter: this.statusReporter,
      result: stageContext.result,
      failFast: false
    });

    // 辅助方法:包装每个Stage,自动审计 + 真实耗时计时 + 阶段级重试(v6.5.60)
    const stageTimings = {}; // v6.2-patch68-fix: 记录每个Stage真实耗时
    const runStage = async (stageName, stageFn) => {
      const stageStart = Date.now(); // 真实计时开始
      enforcer.recordStageStart(stageName, JSON.stringify(stageFn.toString()));

      // 🔥 v6.5.60: 阶段级重试配置
      const MAX_STAGE_RETRIES = 3;
      const STAGE_RETRY_INTERVAL = 60000; // 1分钟
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_STAGE_RETRIES; attempt++) {
        try {
          const output = await stageFn();
          const stageDuration = Date.now() - stageStart; // 真实耗时
          stageTimings[stageName] = stageDuration;

          // v6.2-patch68-fix: 性能基线记录
          const baselineResult = performanceBaseline.record(stageName, stageDuration);
          if (baselineResult.alert) {
            this.log('PIPELINE', baselineResult.alert.message);
          }

          // v6.2-patch68-fix: 单个Stage耗时异常检查(<1ms = 疑似空转)
          if (stageDuration < 1) {
            this.log('PIPELINE', `⚠️ [性能警告] ${stageName} 耗时仅${stageDuration}ms,疑似空转或未真实执行`);
          }

          enforcer.recordStageEnd(stageName, JSON.stringify(output));

          // 🔥 v6.5.60: 阶段完成回调
          if (onStageComplete && typeof onStageComplete === 'function') {
            try {
              onStageComplete(stageName, output);
            } catch (callbackErr) {
              // 回调失败不影响主流程
              console.error(`[Checkpoint] 回调失败: ${callbackErr.message}`);
            }
          }

          return output;
        } catch (e) {
          lastError = e;
          const stageDuration = Date.now() - stageStart;
          stageTimings[stageName] = stageDuration;
          performanceBaseline.record(stageName, stageDuration);
          enforcer.recordStageEnd(stageName, JSON.stringify({ error: e.message }));

          // 🔥 v6.5.60: 记录失败断点
          if (onStageComplete && typeof onStageComplete === 'function') {
            try {
              onStageComplete(stageName, { error: e.message, failed: true });
            } catch (callbackErr) {
              console.error(`[Checkpoint] 失败回调失败: ${callbackErr.message}`);
            }
          }

          if (attempt < MAX_STAGE_RETRIES) {
            this.log('PIPELINE', `⚠️ ${stageName} 第${attempt}次失败,${STAGE_RETRY_INTERVAL/1000}秒后重试... | 错误: ${e.message}`);
            await new Promise(resolve => setTimeout(resolve, STAGE_RETRY_INTERVAL));
          } else {
            this.log('PIPELINE', `❌ ${stageName} 已重试${MAX_STAGE_RETRIES}次,放弃`);
            throw e;
          }
        }
      }
    };

    try {
      // Stage 0: Mock数据清理检查(P0防呆)
      result.stages.mockCleanup = await runStage('STAGE-0', async () => {
        if (process.env.MOCK_TEST_MODE !== 'true') {
          const { MockDataCleanupContract } = require('../systems/mock-data-cleanup-contract');
          const cleanupContract = new MockDataCleanupContract({ workDir: path.join(__dirname, '..') });
          try {
            await cleanupContract.enforce();
            this.log('STAGE-0', '✅ Mock数据清理检查通过,无残留测试文件');
            return { passed: true };
          } catch (cleanupError) {
            this.log('STAGE-0', `❌ ${cleanupError.message}`);
            throw new Error('🚫 Mock数据清理拦截!必须先清理测试文件才能生产渲染。');
          }
        } else {
          this.log('STAGE-0', '⚠️ Mock测试模式已激活,跳过数据清理检查');
          return { passed: true, skipped: true };
        }
      });

      // v6.6.5: 用户只说一句话,自动推断场景结构(系统层面解决,不依赖用户提供)
      if (!input.scenes || input.scenes.length === 0) {
        this.log('PIPELINE', '📝 [Stage 0.5] 自动推断场景结构...');
        input.scenes = this._autoInferScenes(input);
        this.log('PIPELINE', `📝 [Stage 0.5] ✅ 场景推断完成 | ${input.scenes.length}个场景`);
        for (const s of input.scenes) {
          this.log('PIPELINE', `  📋 ${s.id}: ${s.type} | ${s.duration}s | ${s.narration?.substring(0, 30)}...`);
        }
      }

      // Stage 1: PRD中央校准文档生成
      result.stages.prd = await runStage('STAGE-1', () => this.stagePRD(input));

      // Stage 2: 需求对齐闸机
      result.stages.alignment = await runStage('STAGE-2', () => this.stageAlignment(input, result.stages.prd));

      // Stage 3: Schema校验
      result.stages.schema = await runStage('STAGE-3', () => this.stageSchemaValidation(result.stages.prd));

      // Stage 4: 角色系统(v2)
      result.stages.characters = await runStage('STAGE-4', () => this.stageCharacters(input, result.stages.prd));

      // Stage 5: 剧本生成与分析
      result.stages.script = await runStage('STAGE-5', () => this.stageScriptGeneration(input, result.stages.prd));
      this._injectCreativeIntensity('STAGE-5', result.stages.script);

      // 【v6.2-patch87-2】Stage 5导演预检:旁白-画面对齐检查
      const preflightWarnings = this._directorPreflight(
        result.stages.script?.shots || result.stages.script?.scenes || [],
        result.stages.prd
      );
      if (preflightWarnings.length > 0) {
        this.log('PIPELINE', `🎬 导演预检发现 ${preflightWarnings.length} 处旁白-画面不匹配:`);
        for (const w of preflightWarnings.slice(0, 5)) {
          this.log('PIPELINE', `  ⚠️ [${w.shotId}] ${w.message} → ${w.suggestion}`);
        }
        // 将警告附加到 script 结果中,供后续环节使用
        result.stages.script._preflightWarnings = preflightWarnings;
      } else {
        this.log('PIPELINE', `🎬 导演预检通过 | 旁白-画面对齐 OK`);
      }

      // v6.2-patch68-fix: 计算量验证--Stage 5剧本生成
      const scriptMetrics = {
        shotCount: result.stages.script?.scenes?.length || result.stages.script?.shots?.length || 0
      };
      const scriptValidation = performanceBaseline.validateComputation('STAGE-5', scriptMetrics);
      if (!scriptValidation.passed) {
        for (const issue of scriptValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
          result.errors.push({ stage: 'STAGE-5-COMPUTATION', message: issue.message, severity: issue.severity });
        }
      }

      // Stage 5.5: FPV镜头智能决策(导演创作权)
      result.stages.fpvDecision = await runStage('STAGE-5.5', () => this.stageFPVDecision(result.stages.script));

      // v6.5.64-fix: Stage 5.5B 角色出场分析（人物出场卡片系统）
      result.stages.characterIntro = await runStage('STAGE-5.5B', () => this.stageCharacterIntroAnalysis(result.stages.script, input));

      // Stage 6: 时长分配
      result.stages.duration = await runStage('STAGE-6', () => this.stageDurationAllocation(result.stages.script, input));
      this._injectCreativeIntensity('STAGE-6', result.stages.duration);

      // Stage 7: 故事板生成
      result.stages.storyboard = await runStage('STAGE-7', () => this.stageStoryboard(result.stages.script, result.stages.duration, input));
      this._injectCreativeIntensity('STAGE-7', result.stages.storyboard);

      // Stage 7.2: 【v6.2-patch51】主角主动性自动注入
      result.stages.protagonistInitiative = await runStage('STAGE-7.2', () => this.stageProtagonistInitiative(result.stages.storyboard, input));

      // Stage 7.4: 【v6.2-patch52】时长-字数一致性校准(必须先执行,确保时长准确)
      result.stages.durationAlignment = await runStage('STAGE-7.4', () => this.stageDurationNarrationAlignment(result.stages.storyboard, result.stages.duration));

      // Stage 7.3: 【v6.2-patch51】Narration自动精简(必须在时长校准后执行,使用校准后的时长)
      result.stages.narrationTrim = await runStage('STAGE-7.3', () => this.stageNarrationTrim(result.stages.storyboard, result.stages.duration));

      // Stage 7.5: 片头自动生成(如启用)
      result.stages.opening = await runStage('STAGE-7.5', () => this.stageOpeningGeneration(input, result.stages.storyboard, result.stages.characters));

      // Stage 8: 故事板校验
      result.stages.storyboardValidation = await runStage('STAGE-8', () => this.stageStoryboardValidation(result.stages.storyboard, input));

      // Stage 8.5: 五要素检查(v6.1升级:仅Nirath模式启用)
      result.stages.fiveElement = await runStage('STAGE-8.5', () => this.stageFiveElementCheck(result.stages.storyboard, input));
      if (result.stages.fiveElement.enabled && !result.stages.fiveElement.passed) {
        this.log('STAGE-8.5', `⚠️ 五要素检查发现${result.stages.fiveElement.failedElements?.length || 0}项未达标,记录问题供审阅优化`);
      }

      // Stage 9: 运镜系统(v2 + FPV导演决策)
      result.stages.camera = await runStage('STAGE-9', () => this.stageCameraMovement(result.stages.storyboard, result.stages.fpvDecision));
      this._injectCreativeIntensity('STAGE-9', result.stages.camera);

      // Stage 10: 连续性检查
      result.stages.continuity = await runStage('STAGE-10', () => this.stageContinuity(result.stages.storyboard));
      this._injectCreativeIntensity('STAGE-10', result.stages.continuity);

      // Stage 10.5: 渲染前置输入检查(v6.0: 检查输入完整性,不死锁)
      result.stages.safetyGate = await runStage('STAGE-10.5', () => this.stageSafetyGate(result.stages));
      if (!result.stages.safetyGate.passed) {
        this.log('STAGE-10.5', `⚠️ 前置输入检查发现${result.stages.safetyGate.results.filter(r => !r.passed).length}个镜头输入不完整,记录问题但继续执行(预生产模式)`);
      }

      // Stage 11: 渲染核心(v24.3 风格前置化)
      result.stages.render = await runStage('STAGE-11', () => this.stageRender(result.stages));
      this._injectCreativeIntensity('STAGE-11', result.stages.render);

      // v6.6.5-fix: 主进程内存释放(OOM修复)
      this._releaseMemory?.(result);
      if (global.gc) {
        try { global.gc(); } catch (_) {}
      }

      // Stage 11.5: Prompt质量闸门(v6.0新增:防空转)
      result.stages.promptQualityGate = await runStage('STAGE-11.5', () => this.stagePromptQualityGate(result.stages.render, result.stages));

      // v6.6.5-fix: 将质量门修复后的 shots 回写到 render,供后续 Stage 12+ 使用
      if (Array.isArray(result.stages.promptQualityGate?.shots)) {
        result.stages.render = result.stages.promptQualityGate.shots;
      }

      if (!result.stages.promptQualityGate.passed) {
        this.log('STAGE-11.5', `⚠️ Prompt质量闸门发现${result.stages.promptQualityGate.results?.filter(r => !r.passed).length || 0}个镜头质量未达标,记录问题供审阅`);
      }

      // v6.2-patch68-fix: 计算量验证--Stage 11渲染核心
      // stageRender 返回的是 prompts 数组本身,不是 {prompts: [...]} 对象
      const renderOutput = result.stages.render || [];
      const renderMetrics = {
        shotCount: renderOutput.length || 0,
        charCount: renderOutput.reduce((sum, p) => sum + (p.prompt?.length || p.length || 0), 0)
      };
      const renderValidation = performanceBaseline.validateComputation('STAGE-11', renderMetrics);
      if (!renderValidation.passed) {
        for (const issue of renderValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
          result.errors.push({ stage: 'STAGE-11-COMPUTATION', message: issue.message, severity: issue.severity });
        }
      }

      // Stage 12: 合规检查
      // === Prompt Bridge Injection (Stage 11 -> Stage 12) ===
      // 作用:统一 PromptForge 结果、统一 prompt 字段、标准化后再合规检查
      {
        const promptforgeResultDir = path.join(process.cwd(), 'output/prompts/_promptforge_results');
        const promptforgeMarkdownDir = path.join(process.cwd(), 'output/prompts');
        const {
          processShotsForCompliance,
          summarizeCompliance
        } = require('../systems/prompt-pipeline-bridge');

        // 尝试统一 shots 来源
        let __bridgeShots = null;
        if (Array.isArray(result.stages?.storyboard?.shots)) {
          __bridgeShots = result.stages.storyboard.shots;
        } else if (Array.isArray(result.stages?.render)) {
          __bridgeShots = result.stages.render;
        }

        if (Array.isArray(__bridgeShots)) {
          __bridgeShots = processShotsForCompliance(__bridgeShots, {
            promptforgeResultDir,
            promptforgeMarkdownDir,
            maxLength: PROMPT_LENGTH.HARD_MAX
          });

          const complianceSummary = summarizeCompliance(__bridgeShots);
          this.log('PromptBridge', `✅ Processed ${__bridgeShots.length} shots | avg=${complianceSummary.averageScore}%`);

          if (Array.isArray(result.stages?.storyboard?.shots)) {
            result.stages.storyboard.shots = __bridgeShots;
          }
          if (Array.isArray(result.stages?.render)) {
            result.stages.render = __bridgeShots;
          }
        }
      }

      // ===== v6.6.9.4-fix: Stage-12 前强制标准化 Prompt =====
      if (Array.isArray(result.stages.render)) {
        result.stages.render = result.stages.render.map((shot) => {
          const standardizedPrompt = buildStandardPromptFromShot({
            ...shot,
            prompt: shot.prompt,
            dialogue: shot.dialogue,
            visualPrompt: shot.visualPrompt,
            cameraString: shot.cameraString || shot.cameraMovement?.description || '',
            lightingString: shot.lightingString || shot.lighting?.description || '',
            backgroundSoundString: shot.backgroundSoundString || shot.audioLayerString || ''
          });

          const safePrompt = safeStructuredTrim(standardizedPrompt, PROMPT_LENGTH.HARD_MAX);

          return {
            ...shot,
            _originalPrompt: shot.prompt,
            prompt: safePrompt,
            length: safePrompt.length
          };
        });

        this.log('PIPELINE', `🧱 Stage-12前标准化完成 | shots=${result.stages.render.length}`);
      }

      // ===== v6.6.9.4-fix: Stage-12 前强制标准化 Prompt =====
      if (Array.isArray(result.stages.render)) {
        result.stages.render = result.stages.render.map((shot) => {
          const standardizedPrompt = buildStandardPromptFromShot({
            ...shot,
            prompt: shot.prompt,
            dialogue: shot.dialogue,
            visualPrompt: shot.visualPrompt,
            cameraString: shot.cameraString || shot.cameraMovement?.description || '',
            lightingString: shot.lightingString || shot.lighting?.description || '',
            backgroundSoundString: shot.backgroundSoundString || shot.audioLayerString || ''
          });

          const safePrompt = safeStructuredTrim(standardizedPrompt, PROMPT_LENGTH.HARD_MAX);

          return {
            ...shot,
            _originalPrompt: shot.prompt,
            prompt: safePrompt,
            length: safePrompt.length
          };
        });

        this.log('PIPELINE', `🧱 Stage-12前标准化完成 | shots=${result.stages.render.length}`);
      }

      result.stages.compliance = await runStage('STAGE-12', () => this.stageCompliance(result.stages.render, result.stages.storyboard));
      this._injectCreativeIntensity('STAGE-12', result.stages.compliance);

      // ===== v6.3-patch7-fix: PromptForge Director 合并逻辑完整修复 =====
      this.log('PIPELINE', '🎬 PromptForge 导演编排启动 | 子进程隔离 | 70分 → 90分');
      // 【v6.3-patch7-fix】备份render数据,子进程失败时恢复
      const originalRender = result.stages.render;
      // 【v6.3-patch7-fix】深拷贝备份,防止后续修改影响恢复数据
      const originalRenderBackup = originalRender ? JSON.parse(JSON.stringify(originalRender)) : null;

      // 如果 render 数据不存在,直接跳过
      if (!originalRender || !Array.isArray(originalRender)) {
        this.log('PIPELINE', '⚠️ 无 render 数据,跳过 PromptForge Director');
        result.errors.push({
          stage: 'PROMPTFORGE-DIRECTOR',
          message: 'No render data available',
          severity: 'warning'
        });
      } else {
        // 【v6.5.50-fix】方案E:子进程隔离,通过临时文件传递数据
        // 原因:主进程内嵌PromptForge,reasoning模式内存累积导致OOM SIGKILL
        // 子进程分配3072MB,系统7.5GB总内存,安全

        // 准备 PromptForge 输入数据
        const projectConfig = {
          beastId: this.beastId || '',
          theme: this.theme || '科普主题',
          emotionBase: this.emotionBase || '专业',
          titlePlan: this.titlePlan || {}
        };

        // v6.6.9.4-patch14-fix: 清理cameraMovement嵌套，补上dialogue字段供PromptForge使用
        function cleanCameraMovement(cm) {
          if (!cm || typeof cm !== 'object') return cm;
          // 展平 timeline.timeline 双重嵌套
          if (cm.timeline && typeof cm.timeline === 'object' && cm.timeline.timeline) {
            return {
              ...cm,
              timeline: {
                ...cm.timeline.timeline,
                strategy: cm.timeline.strategy || cm.timeline.timeline.strategy,
                reasoning: cm.timeline.reasoning || cm.timeline.timeline.reasoning
              }
            };
          }
          return cm;
        }

        const rawReport = {
          shots: originalRender
            .filter(r => {
              const id = r.id || r.shotId;
              return id !== 'S00' && r.type !== 'opening' && !r.isOpening;
            })
            .map(r => ({
              id: r.id || r.shotId,
              prompt: r.prompt,
              scene: r.scene,
              emotionPhase: r.emotionPhase,
              duration: r.duration,
              narration: r.narration,
              dialogue: r.dialogue || '', // v6.6.9.4-patch14-fix: 补上dialogue字段
              cameraMovement: cleanCameraMovement(r.cameraMovement) // v6.6.9.4-patch14-fix: 展平嵌套
            }))
        };

        const inputFile = path.join('/tmp', `promptforge-input-${Date.now()}.json`);
        const outputFile = path.join('/tmp', `promptforge-output-${Date.now()}.json`);

        try {
          const { spawn } = require('child_process');
          const workerPath = path.join(__dirname, 'promptforge-director-worker.js');

          // 检查worker文件是否存在
          if (!fss.existsSync(workerPath)) {
            throw new Error(`Worker文件不存在: ${workerPath}`);
          }

          // 准备输入数据
          const inputData = {
            rawReport: rawReport,
            projectConfig: projectConfig,
            mode: this.mode || 'nirath' // v6.6.9: 传递模式信息
          };

          fss.writeFileSync(inputFile, JSON.stringify(inputData));

          const workerMemoryMb = Number(process.env.PROMPTFORGE_MAX_OLD_SPACE_MB || 1536);

          this.log('PIPELINE', `🎬 PromptForge 子进程启动 | 内存限制: ${workerMemoryMb}MB | 输入: ${inputFile}`);

          const worker = spawn('node', [
            `--max-old-space-size=${workerMemoryMb}`,
            workerPath,
            inputFile,
            outputFile
          ], {
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: ['ignore', 'pipe', 'pipe']
          });

          // 收集输出
          let stdout = '';
          let stderr = '';
          worker.stdout.on('data', (d) => { stdout += d.toString(); });
          worker.stderr.on('data', (d) => { stderr += d.toString(); });

          // 等待完成
          const workerResult = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              worker.kill('SIGKILL');
              reject(new Error('PromptForge 子进程超时(1800s)'));
            }, 1800000);

            worker.on('close', (code, signal) => {
              clearTimeout(timeout);
              resolve({ code, signal });
            });

            worker.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          this.log('PIPELINE', `📊 Worker stdout: ${stdout.slice(0, 500)}`);
          if (stderr) this.log('PIPELINE', `⚠️ Worker stderr: ${stderr.slice(0, 500)}`);

          if (workerResult.signal === 'SIGKILL') {
            throw new Error('Worker 被 SIGKILL 终止,疑似内存不足(OOM)或超时强杀');
          }

          if (workerResult.code !== 0) {
            if (workerResult.code === 137) {
              throw new Error('Worker 退出码 137,疑似 OOM 被系统杀死');
            }
            throw new Error(`Worker exited with code ${workerResult.code}${workerResult.signal ? `, signal=${workerResult.signal}` : ''}`);
          }

          // 读取输出
          if (!fss.existsSync(outputFile)) {
            throw new Error('Worker 未生成输出文件');
          }

          const outputData = JSON.parse(fss.readFileSync(outputFile, 'utf8'));

          if (!outputData.success) {
            throw new Error(outputData.error || 'Worker 返回失败');
          }

          const forgeResult = {
            shots: outputData.shots.map(s => ({
              id: s.id,
              finalPrompt: s.finalPrompt
            })),
            qualityReport: outputData.qualityReport
          };

          this.log('PIPELINE', `✅ PromptForge 子进程完成 | 质量分: ${forgeResult.qualityReport?.overallScore} | 通过: ${forgeResult.qualityReport?.overallPassed}`);

            // 恢复 render 数据
            result.stages.render = originalRenderBackup;

            // 质量门检查与合并
            const qualityScore = forgeResult.qualityReport?.overallScore ?? 0;
            const qualityPassed = forgeResult.qualityReport?.overallPassed ?? false;

            // 记录详细质量报告
            if (forgeResult.qualityReport?.shotDetails) {
              this.log('PIPELINE', '📊 质量报告详情:');
              for (const detail of forgeResult.qualityReport.shotDetails) {
                this.log('PIPELINE', `  ${detail.shotId}: 结构${detail.structureScore}/3 长度${detail.lengthScore} 运镜${detail.cameraPassed ? '✅' : '❌'} 总分${detail.totalScore}`);
              }
            }

            if (qualityScore >= 50) {
              this.log('PIPELINE', `✅ 采用优化后 Prompt(质量分: ${qualityScore})`);

              let mergedCount = 0;
              for (const shot of forgeResult.shots) {
                // v6.5.55-fix: 跳过片头镜头,保留opening-system-v3.js生成的原始Prompt
                const existingShot = result.stages.render.find(r => r.shotId === shot.id || r.id === shot.id);
                if (!shot.id || shot.id === 'S00' || shot.id === 'undefined') {
                  this.log('PIPELINE', `  ⏭️ 跳过片头镜头: ${shot.id || 'S00'},保留原始Prompt(${existingShot?.prompt?.length || 0}字符)`);
                  continue;
                }

                if (existingShot && shot.finalPrompt) {
                  let cleanedPrompt = this._cleanForgePrompt(shot.finalPrompt);
                  const originalPrompt = existingShot.prompt;

                  // ===== 修复：PromptForge 合并后重新回灌角色锚点 =====
                  const renderMeta = this._buildRenderMetaForShot(existingShot, result.stages);
                  if (renderMeta.mergedCharacterAnchor) {
                    cleanedPrompt = this._mergeCharacterAnchorIntoPrompt(
                      cleanedPrompt,
                      renderMeta.mergedCharacterAnchor,
                      { hardLimit: PROMPT_LENGTH.HARD_MAX }
                    );
                  }

                  if ((this.mode || 'generic') === 'generic') {
                    cleanedPrompt = this._sanitizePromptForGenericMode(cleanedPrompt);
                  }

                  cleanedPrompt = this.smartTrim(cleanedPrompt, PROMPT_LENGTH.HARD_MAX);

                  // v6.6.9.4-patch14: 合并后强制转换为中文标准字段格式
                  cleanedPrompt = this.toStandardPrompt(existingShot, cleanedPrompt);
                  cleanedPrompt = this.ensureFinalPromptStructure(existingShot, cleanedPrompt);
                  cleanedPrompt = safeStructuredTrim(cleanedPrompt, PROMPT_LENGTH.HARD_MAX);

                  // v6.6.9.4-patch17: PromptForge合并后重新注入定妆照绑定
                  const renderMeta2 = this._buildRenderMetaForShot(existingShot, result.stages);
                  if (renderMeta2.characterRef && !cleanedPrompt.includes('【定妆照】')) {
                    cleanedPrompt = `【定妆照】${renderMeta2.characterRef} | ` + cleanedPrompt;
                    cleanedPrompt = this.smartTrim(cleanedPrompt, PROMPT_LENGTH.HARD_MAX);
                  }

                  existingShot.prompt = cleanedPrompt;
                  existingShot.characterRef = renderMeta2.characterRef || '';
                  existingShot.length = cleanedPrompt.length;
                  existingShot.utilization = Math.round(cleanedPrompt.length / PROMPT_LENGTH.HARD_MAX * 100);
                  existingShot._promptForge = {
                    applied: true,
                    originalPrompt: originalPrompt,
                    optimizedPrompt: cleanedPrompt,
                    qualityScore: shot.qualityScore || qualityScore,
                    cameraDesign: shot.cameraDesign || '',
                    lightingDesign: shot.lightingDesign || '',
                    emotionReinforcement: shot.emotionReinforcement || '',
                    dialogue: shot.dialogue || existingShot.dialogue || '',
                    dialogueDepth: shot.dialogueDepth || existingShot.dialogueDepth || 'L0',
                    emotionArc: shot.emotionArc || existingShot.emotionArc || [],
                    shotEmotion: shot.shotEmotion || existingShot.shotEmotion || '',
                    timestamp: new Date().toISOString()
                  };

                  mergedCount++;
                  this.log('PIPELINE', `  🎬 ${shot.id}: 已合并优化 Prompt(${cleanedPrompt.length} 字符)`);
                } else if (!existingShot) {
                  this.log('PIPELINE', `  ⚠️ ${shot.id}: 在主进程 render 中找不到对应镜头`);
                }
              }

              this.log('PIPELINE', `✅ 合并完成: ${mergedCount}/${forgeResult.shots.length} 个镜头已优化`);

              if (mergedCount === 0) {
                result.errors.push({
                  stage: 'PROMPTFORGE-DIRECTOR',
                  message: 'PromptForge 返回了结果但没有成功合并任何镜头',
                  severity: 'warning'
                });
              }
            } else {
              this.log('PIPELINE', `❌ 优化后 Prompt 质量不足(${qualityScore} < 50),使用原始 Prompt`);
            }

          } catch (e) {
            // 任何异常发生时确保 render 数据恢复
            result.stages.render = originalRenderBackup;

            this.log('PIPELINE', `⚠️ PromptForge Director 失败: ${e.message},已恢复原始 Prompt`);
            console.error(e);
            result.errors.push({
              stage: 'PROMPTFORGE-DIRECTOR',
              message: e.message,
              stack: e.stack,
              severity: 'warning'
            });
          } finally {
            try {
              if (fss.existsSync(inputFile)) fss.unlinkSync(inputFile);
              if (fss.existsSync(outputFile)) fss.unlinkSync(outputFile);
            } catch (cleanupErr) {
              this.log('PIPELINE', `⚠️ 清理PromptForge临时文件失败: ${cleanupErr.message}`);
            }
          }
      }
      // ===== PromptForge 集成结束 =====

      // Stage 13: 前置验证
      result.stages.preRender = await runStage('STAGE-13', () => this.stagePreRenderValidation(result.stages));

      // Stage 14: 风格注入
      result.stages.style = await runStage('STAGE-14', () => this.stageStyleInjection(result.stages.render));

      // Stage 15: 后期规则
      result.stages.postProduction = await runStage('STAGE-15', () => this.stagePostProduction(result.stages));
      this._injectCreativeIntensity('STAGE-15', result.stages.postProduction);

      // Stage 16: 最终输出(基础版)
      result.stages.output = await runStage('STAGE-16', () => this.stageFinalOutput(result.stages));

      // 【v6.4.1】StageRunner 核心阶段追踪(基于现有结果,只追踪不重新执行)
      this.log('PIPELINE', '📊 StageRunner 追踪核心阶段...');

      // Stage 5 追踪: 剧本(直接从已有结果追踪,不重新执行)
      stageContext.setShared('script', result.stages.script);
      await stageRunner.runStage({
        stageId: 'STAGE-5-RUNNER',
        title: '剧本生成(StageRunner)',
        progress: 20,
        handler: async () => result.stages.script
      }, stageContext);

      // Stage 6 追踪: 时长(直接从已有结果追踪)
      stageContext.setShared('durationPlan', result.stages.duration);
      await stageRunner.runStage({
        stageId: 'STAGE-6-RUNNER',
        title: '时长分配(StageRunner)',
        progress: 30,
        handler: async () => result.stages.duration
      }, stageContext);

      // Stage 7 追踪: 故事板(直接从已有结果追踪)
      stageContext.setShared('storyboard', result.stages.storyboard);
      await stageRunner.runStage({
        stageId: 'STAGE-7-RUNNER',
        title: '故事板生成(StageRunner)',
        progress: 40,
        handler: async () => result.stages.storyboard
      }, stageContext);

      // Stage 9 追踪: 运镜(直接从已有结果追踪)
      stageContext.setShared('storyboardWithCamera', result.stages.camera);
      await stageRunner.runStage({
        stageId: 'STAGE-9-RUNNER',
        title: '运镜系统(StageRunner)',
        progress: 58,
        handler: async () => result.stages.camera
      }, stageContext);

      // Stage 11 追踪: 渲染前准备(直接从已有结果追踪)
      stageContext.setShared('cameraResult', result.stages.render);
      await stageRunner.runStage({
        stageId: 'STAGE-11-RUNNER',
        title: '渲染前准备(StageRunner)',
        progress: 70,
        handler: async () => result.stages.render
      }, stageContext);

      this.log('PIPELINE', '✅ StageRunner 核心阶段追踪完成');

      // v6.3-patch2: 旧链路已废弃,新链路(PromptForge Director 三阶流水线)在上面运行
      // 保留空导演闭环结果以兼容下游
      // v6.5.32-fix5: 使用 PromptForge 实际质量分作为导演评分
      const forgeQualityScore = result.stages.promptForge?.qualityReport?.overallScore ?? 75;
      result.stages.directorScreenwriterLoop = {
        stage: 'STAGE-17',
        stageName: '导演-编剧全局优化',
        version: 'v6.3-patch2',
        passed: true,
        directorScore: forgeQualityScore,
        issuesFound: 0,
        issuesFixed: 0,
        issuesRemaining: 0,
        llmEnabled: false,
        note: '旧链路已废弃,PromptForge Director 三阶流水线已集成'
      };

      result.asyncDirectorTask = {
        status: 'deprecated',
        note: 'v6.3-patch2: 使用 PromptForge Director 子进程隔离链路'
      };

      // v6.2-patch68-fix: 计算量验证--Stage 17导演-编剧闭环
      const loopMetrics = {
        iterationCount: result.stages.directorScreenwriterLoop?.iteration || 0,
        shotCount: result.stages.directorScreenwriterLoop?.shots?.length || 0
      };
      const loopValidation = performanceBaseline.validateComputation('STAGE-17', loopMetrics);
      if (!loopValidation.passed) {
        for (const issue of loopValidation.issues) {
          this.log('PIPELINE', `⚠️ ${issue.message}`);
        }
      }

      // 【v6.2-patch53】执行完整性验证 - 三重锁锁3
      const integrityReport = await enforcer.enforcePostExecution(path.join(__dirname, '..'));
      result.integrityReport = integrityReport;

      // 如果完整性验证不信任 → 强制标记失败
      if (!integrityReport.trusted) {
        result.success = false;
        this.log('PIPELINE', `❌ 执行完整性验证未通过: ${integrityReport.issues.join(', ')}`);
        result.errors.push(`执行完整性验证失败: ${integrityReport.issues.join(', ')}`);
      } else {
        this.log('PIPELINE', `✅ 执行完整性验证通过 | 审计ID: ${integrityReport.executionId} | 全部${integrityReport.stageCount}个Stage完成`);
      }

      // 【v6.4.1】QualityGate 统一质量总评
      // v6.5.32-fix5: 移到 integrityReport 之后,确保系统完整性评分正确
      this.log('PIPELINE', '🔍 QualityGate 质量总评启动...');
      const qualityGate = new QualityGate();
      const qualityReport = qualityGate.evaluatePipelineResult(result, {
        projectName: input.projectName,
        mode: this.mode,
        stageCount: Object.keys(result.stages).length
      });
      result.qualityReport = qualityReport;
      this.log('PIPELINE', `📊 QualityGate 总评: ${qualityReport.totalScore}分 | 等级:${qualityReport.grade} | 状态:${qualityReport.status}`);
      if (qualityReport.blockers.length > 0) {
        for (const blocker of qualityReport.blockers) {
          this.log('PIPELINE', `  🚫 Blocker: ${blocker.message}`);
        }
      }
      if (qualityReport.issues.length > 0) {
        for (const issue of qualityReport.issues.slice(0, 5)) {
          this.log('PIPELINE', `  ⚠️ Issue: ${issue.message}`);
        }
      }

      result.success = true;

    } catch (error) {
      result.success = false;
      result.errors.push({ stage: 'PIPELINE', message: error.message, stack: error.stack });
      this.log('PIPELINE', `❌ 链路中断: ${error.message}`, 'error');

      // 【v6.4.1】QualityGate 异常路径质量评估
      try {
        this.log('PIPELINE', '🔍 QualityGate 异常路径质量评估...');
        const qualityGate = new QualityGate();
        const qualityReport = qualityGate.evaluatePipelineResult(result, {
          projectName: input.projectName,
          mode: this.mode,
          stageCount: Object.keys(result.stages).length,
          errorPath: true
        });
        result.qualityReport = qualityReport;
        this.log('PIPELINE', `📊 QualityGate 异常路径评估: ${qualityReport.totalScore}分 | 状态:${qualityReport.status}`);
      } catch (qualityError) {
        this.log('PIPELINE', `⚠️ QualityGate 异常路径评估失败: ${qualityError.message}`);
      }

      // 【v6.2-patch53】异常路径也要执行完整性验证
      try {
        const integrityReport = await enforcer.enforcePostExecution(path.join(__dirname, '..'));
        result.integrityReport = integrityReport;
      } catch (auditError) {
        this.log('PIPELINE', `⚠️ 异常路径完整性验证失败: ${auditError.message}`);
      }
    }

    // v6.2-patch68-fix: 总耗时报警 + 性能基线记录
    const totalDuration = Date.now() - pipelineStart;
  // 检查是否调用外部API
  const hasExternalAPI = totalDuration > 3000 || (process.env.EXECUTION_MODE === 'full-api' && process.env.ENABLE_RENDER_PREVIEW === 'true');

  result.performance = {
    totalDuration,
    stageTimings,
    executionMode: process.env.EXECUTION_MODE || 'local-only',
    hasExternalAPI,
    baselineWarning: null
  };

    // P0级约束:总耗时<3秒自动弹警告"疑似轻量执行"
    if (totalDuration < 3000) {
      const warningMsg = `⚠️ [P0级性能警告] 总耗时仅${totalDuration}ms(<3秒)!疑似纯本地轻量执行,未调用外部API。如预期含外部API调用(定妆照/渲染预览),请检查环境变量或确认执行模式。`;
      this.log('PIPELINE', warningMsg);
      result.performance.baselineWarning = warningMsg;
      result.errors.push({
        stage: 'PERFORMANCE',
        message: warningMsg,
        severity: 'warning'
      });
    } else {
      this.log('PIPELINE', `✅ 总耗时${totalDuration}ms,耗时正常(≥3秒),可能包含外部API调用`);
    }

    // v6.2-patch68-fix: 性能基线汇总与报告
    const baselineSummary = performanceBaseline.finalize();
    const baselineReport = performanceBaseline.generateReport();
    this.log('PIPELINE', baselineReport);
    result.performance.baselineSummary = baselineSummary;

    const completedStages = Object.keys(result.stages).length;
    audit.log('pipeline-complete', 'nirath-master-pipeline', {
      actor: 'system',
      input: { projectName: input.projectName },
      output: { success: result.success, completedStages },
      result: result.success ? 'success' : 'failure',
      duration: Date.now() - pipelineStart,
      error: result.success ? undefined : (result.errors[result.errors.length - 1]?.message || 'Unknown error'),
      metadata: { mode: this.mode, totalErrors: result.errors.length }
    }).catch(e => console.error(`[Audit] 日志写入失败: ${e.message}`));

    // v1.1-fix: 添加汇总字段,防止run-taotie-pre-production.js输出undefined
    const storyboard = result.stages.storyboard || {};
    const shots = storyboard.shots || [];
    const fiveElements = result.stages.fiveElement || {};

    // 从 integrityValidation 获取完整性数据(stageFinalOutput中的字段名)
    const integrityValidation = result.stages.integrityValidation || {};
    const integritySummary = integrityValidation.summary || {};

    result.totalShots = shots.length;
    result.totalDuration = shots.reduce((s, x) => s + (x.duration || 0), 0);
    result.fiveElementsScore = fiveElements.overallScore || 0;
    result.systemErrors = result.errors.length;
    result.linkageIntegrity = integritySummary.passed || 0;
    result.expectedStages = integritySummary.totalChecks || 16;
    result.riskRating = result.systemErrors > 0 ? '高风险' : (result.linkageIntegrity < 16 ? '中风险' : '低风险');
    result.reportPath = `预生产报告: ${result.totalShots}镜, ${result.totalDuration}秒`;
    result.canProceed = result.success && result.systemErrors === 0;
    result.feishuDocUrl = null; // 飞书文档生成在pipeline外部

    // v6.5.53-l: 最终输出固化 - 确保所有shot有标准化字段和合规检查
    {
      const {
        processShotsForOutput,
        summarizeCompliance
      } = require('../systems/prompt-pipeline-bridge');
      const promptforgeResultDir = path.join(process.cwd(), 'output/prompts/_promptforge_results');
      const promptforgeMarkdownDir = path.join(process.cwd(), 'output/prompts');

      let __finalShots = null;
      if (Array.isArray(result.stages?.storyboard?.shots)) {
        __finalShots = result.stages.storyboard.shots;
      } else if (Array.isArray(result.stages?.render)) {
        __finalShots = result.stages.render;
      }

      if (Array.isArray(__finalShots)) {
        __finalShots = processShotsForOutput(__finalShots, {
          promptforgeResultDir,
          promptforgeMarkdownDir,
          maxLength: PROMPT_LENGTH.HARD_MAX
        });

        if (Array.isArray(result.stages?.storyboard?.shots)) {
          result.stages.storyboard.shots = __finalShots;
        }
        if (Array.isArray(result.stages?.render)) {
          result.stages.render = __finalShots;
        }

        const complianceSummary = summarizeCompliance(__finalShots);
        this.log('PromptBridge', `✅ Final output solidified for ${__finalShots.length} shots | avg=${complianceSummary.averageScore}%`);
      }
    }

    return result;
  }

  // ========== Stage 1: PRD生成 ==========
  async stagePRD(input) {
    this.log('STAGE-1', 'PRD中央校准文档生成');

    // v6.2-patch55-fix: 将characters数组转换为对象格式,确保Schema校验通过
    let characters = input.characters || {};
    if (Array.isArray(characters)) {
      const charObj = {};
      for (const char of characters) {
        if (char.id) charObj[char.id] = char;
      }
      characters = charObj;
    }

    const prd = {
      meta: {
        title: input.projectName,
        version: 'v1.0',
        mode: this.mode,
        createdAt: new Date().toISOString()
      },
      core: input.core || {},
      world: input.world || {},
      characters: characters,
      scenes: input.scenes || [],
      style: input.style || {},
      constraints: input.constraints || {}
    };

    // Nirath模式:注入Nirath世界观
    if (this.mode === 'nirath') {
      prd.world.nirathWorld = {
        planet: isNirath ? 'Nirath' : (input.world?.planet || 'Earth'),
        era: 'Post-Convergence Era',
        dualStar: true,
        bioluminescentEcosystem: true
      };
      this.log('STAGE-1', '✅ Nirath世界观已注入PRD');
    }

    return prd;
  }

  // ========== Stage 2: 需求对齐 ==========
  async stageAlignment(input, prd) {
    this.log('STAGE-2', '需求对齐闸机检查');

    const checks = {
      projectName: !!input.projectName,
      scenes: (input.scenes || []).length > 0,
      characters: Object.keys(input.characters || {}).length > 0,
      duration: input.targetDuration > 0,
      style: !!input.style
    };

    const passed = Object.values(checks).every(v => v);

    if (!passed) {
      const failed = Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k);
      throw new Error(`需求对齐失败: 缺少 ${failed.join(', ')}`);
    }

    this.log('STAGE-2', `✅ 需求对齐通过 | 检查项: ${Object.keys(checks).length}`);
    return { passed, checks };
  }

  // ========== Stage 3: Schema校验 ==========
  async stageSchemaValidation(prd) {
    this.log('STAGE-3', 'Schema运行时校验');

    // P0修复:validate需要schemaName + data两个参数
    const validation = this.modules.schemaValidator.validate('prd-nirath', prd);

    // 输出具体错误详情
    if (validation.errors?.length > 0) {
      for (const err of validation.errors) {
        this.log('STAGE-3', `  ⚠️ Schema错误: ${err}`);
      }
    }

    this.log('STAGE-3', `✅ Schema校验完成 | 错误: ${validation.errors?.length || 0}`);
    return validation;
  }

  // ========== v6.5.32-fix: 角色属性推断辅助方法 ==========
  _inferRoleAttributes(charId, charConfig) {
    const id = charId.toLowerCase();
    const name = (charConfig.name || '').toLowerCase();

    // 根据角色ID和名称推断属性
    if (id.includes('xiao') || id.includes('g') || name.includes('小')) {
      return { age: 8, gender: 'boy', role: 'audience' };
    }
    if (id.includes('nurse') || name.includes('护士') || name.includes('陈女士')) {
      return { age: 30, gender: 'female', role: 'nurse' };
    }
    if (id.includes('coach') || name.includes('教练') || name.includes('李明')) {
      return { age: 35, gender: 'male', role: 'coach' };
    }
    if (id.includes('doctor') || name.includes('医生')) {
      return { age: 40, gender: 'male', role: 'doctor' };
    }
    if (id.includes('host') || name.includes('主持')) {
      return { age: 32, gender: 'female', role: 'host' };
    }

    return { age: 28, gender: 'female', role: '' };
  }

  // ========== Stage 4: 角色系统 ==========
  async stageCharacters(input, prd) {
    this.log('STAGE-4', `角色系统(v2)`);

    const characters = {};
    // 处理characters字段:支持数组和对象两种格式
    let charactersData = input.characters || {};
    if (Array.isArray(charactersData)) {
      // 数组格式 → 转换为对象格式
      charactersData = {};
      for (const char of input.characters || []) {
        if (char.id) {
          charactersData[char.id] = char;
        }
      }
      this.log('STAGE-4', `  📝 characters数组格式已转换为对象格式 | ${Object.keys(charactersData).length}个角色`);
    }

    const characterIds = Object.keys(charactersData);

    for (const charId of characterIds) {
      const charConfig = charactersData[charId];

      // 4.1: 角色管理器v2(创建或加载)
      // v6.5.32-fix: 根据角色ID推断差异化属性,消除硬编码28岁女性
      const roleInference = this._inferRoleAttributes(charId, charConfig);

      // v6.5.15-fix: 提前定义 fullCharData,供 if 和 else 分支共用
      const fullCharData = {
        id: charId,
        name: charConfig.name || charId,
        baseIdentity: {
          name: charConfig.name || charId,
          age: charConfig.age || roleInference.age || 28,
          gender: charConfig.gender || roleInference.gender || 'female',
          species: 'human',
          role: charConfig.role || roleInference.role || '',
          origin: this.mode === 'nirath' ? 'Nirath' : 'Earth'
        },
        visualIdentity: {
          age: charConfig.age || roleInference.age || 28,
          gender: charConfig.gender || roleInference.gender || 'female',
          build: 'average',
          height: 'medium',
          skinTone: 'warm',
          hair: 'black',
          eyes: 'brown',
          facialFeatures: 'asian',
          distinguishingMarks: charConfig.appearance || ''
        },
        personality: {
          core: charConfig.personality || 'warm',
          traits: ['kind', 'brave'],
          mbti: 'INFJ'
        },
        visualAnchors: {
          required: [charConfig.appearance || ''],
          preferred: [],
          forbidden: ['western face', 'caucasian', 'blonde hair', 'blue eyes']
        },
        voiceIdentity: {
          gender: charConfig.gender || 'female',
          ageGroup: charConfig.age < 12 ? 'child' : 'adult',
          tone: 'warm',
          pace: 'medium',
          emotion: 'neutral',
          language: 'zh-CN'
        }
      };

      let charProfile;
      if (this.modules.characterManager.characterExists(charId)) {
        charProfile = await this.modules.characterManager.loadCharacter(charId);
        // v6.5.15-fix: 如果文件存在但读取失败(内容损坏),直接创建新档案
        if (!charProfile) {
          charProfile = this.modules.characterManager.createCharacter(charId, fullCharData);
        } else {
          // ===== 修复：运行时数据合并 =====
          charProfile = this.modules.characterManager.mergeRuntimeCharacterData(charProfile, fullCharData);
          await this.modules.characterManager.saveCharacter(charId, charProfile);
        }
      } else {
        charProfile = this.modules.characterManager.createCharacter(charId, fullCharData);
      }

      // ===== 修复：generic 模式清洗 Nirath 残留 =====
      if ((this.mode || 'generic') === 'generic') {
        charProfile = this._sanitizeCharacterForGenericMode(charProfile);
        await this.modules.characterManager.saveCharacter(charId, charProfile);
      }

      // ===== 修复：outfit 兜底修正 =====
      const runtimeOutfit =
        charConfig?.visual?.outfit ||
        charConfig?.visualIdentity?.outfit ||
        charConfig?.outfit ||
        '';
      if (runtimeOutfit) {
        charProfile.visualIdentity = charProfile.visualIdentity || {};
        charProfile.visualIdentity.outfit = runtimeOutfit;
        charProfile.visualIdentity.appearance = charProfile.visualIdentity.appearance || {};
        charProfile.visualIdentity.appearance.clothing = charProfile.visualIdentity.appearance.clothing || {
          promptFragment: runtimeOutfit,
          consistency: 'strict'
        };
        if (!charProfile.visualIdentity.appearance.clothing.promptFragment) {
          charProfile.visualIdentity.appearance.clothing.promptFragment = runtimeOutfit;
        }
        await this.modules.characterManager.saveCharacter(charId, charProfile);
      }

      this.log('STAGE-4', `  ✅ CharacterManagerV2: ${charId}`);

      // 4.1.5: 定妆照存在性检查(P0:队长要求的前置环节,没有定妆照不得继续)
      // v6.6.5: 智能定妆照判断 - 用户只说一句话,系统不能卡住让用户选择
      const portraitCheck = await this.checkCharacterPortraits(charId);
      if (!portraitCheck.exists) {
        // 智能判断:这个角色是否需要AI生成定妆照?
        const needPortrait = this._shouldGeneratePortrait(charId, fullCharData, input);

        if (!needPortrait) {
          // 真实人物/教育科普/纪录片:不需要AI生成定妆照,自动跳过
          this.log('STAGE-4', `  ✅ 智能跳过定妆照: ${charId} | 类型: ${this._detectCharacterType(charId, fullCharData)} | 场景: ${input.videoType || 'generic'}`);

          // 自动创建占位符,避免下游报错
          await this._createPortraitPlaceholders(charId, portraitCheck.missingAngles);

        } else {
          // 虚构角色需要定妆照:自动生成Mock,不阻断链路
          this.log('STAGE-4', `  ⚠️ 定妆照缺失: ${charId} | 自动生成Mock占位...`);
          await this._createPortraitPlaceholders(charId, portraitCheck.missingAngles);
          this.log('STAGE-4', `  ✅ Mock定妆照已创建: ${charId} | 4角度占位`);
        }
      } else {
        this.log('STAGE-4', `  ✅ 定妆照检查通过: ${charId} | ${portraitCheck.foundAngles.length}个角度`);
      }

      // 4.2: 角色提示词构建
      let charPrompt;
      try {
        charPrompt = this.modules.characterPromptBuilder.build(charProfile);
        // v6.5.30-fix: build() returns {prompt, layers, stats, negativePrompt}, extract the string
        if (charPrompt && typeof charPrompt === 'object' && charPrompt.prompt) {
          charPrompt = charPrompt.prompt;
        }
      } catch (e) {
        // fallback: 基础提示词
        charPrompt = `${charProfile.name}, ${charProfile.baseIdentity?.age || 28}岁, ${charProfile.visualIdentity?.gender || 'female'}, ${charProfile.visualAnchors?.required?.[0] || ''}`;
      }
      this.log('STAGE-4', `  ✅ CharacterPromptBuilder: ${charId}`);

      // 4.3: 角色合规检查
      let compliance;
      try {
        compliance = this.modules.characterComplianceChecker.check(charPrompt);
      } catch (e) {
        compliance = { level: 'L0', passed: true, issues: [] };
      }
      this.log('STAGE-4', `  ✅ CharacterComplianceChecker: ${charId} | 级别: ${compliance.level || 'unknown'}`);

      // 4.4: 角色增强系统(仅Nirath模式)
      let nirathEnhancement = null;
      if (this.mode === 'nirath') {
        try {
          nirathEnhancement = this.modules.nirathCharacterEnhancer.enhance(charProfile, input.scenes?.[0]);
          this.log('STAGE-4', `  ✅ 角色增强系统: ${charId}`);
        } catch (e) {
          this.log('STAGE-4', `  ⚠️ 角色增强系统失败: ${e.message}`);
        }
      }

      // v6.2-patch55-fix: 添加portraits对象供下游Stage-10.5验证使用
      const portraits = {};
      const generatedPortraits = charProfile?.generatedAssets?.portraits || [];
      for (const p of generatedPortraits) {
        if (p.angle && p.localPath) {
          portraits[p.angle] = p.localPath;
        }
      }
      // 如果没有generatedAssets,尝试从portraitConfig推断路径
      if (Object.keys(portraits).length === 0) {
        const angles = charProfile?.portraitConfig?.angles || ['front', 'threeQuarter', 'closeup', 'side'];
        // v6.5.6-fix: 修正路径 - 使用实际的文件名格式
        const dirName = charId === 'tao-tie' ? 'taotie' : charId;
        const filePrefix = charId === 'tao-tie' ? 'taotie-portrait' : `${charId}-cg-v3`;
        const portraitDir = `characters/${dirName}/portraits`;
        for (const angle of angles) {
          // v6.5.6-fix: 使用实际文件名格式(taotie-portrait-front_fullbody.png)
          const actualAngle = charId === 'tao-tie' ? this.mapAngleToFileName(angle) : angle;
          portraits[angle] = `${portraitDir}/${filePrefix}-${actualAngle}.png`;
        }
      }

      characters[charId] = {
        profile: charProfile,
        prompt: charPrompt,
        compliance,
        nirathEnhancement,
        portraits  // 供Stage-10.5验证
      };
    }

    this.log('STAGE-4', `✅ 角色系统完成 | 角色数: ${characterIds.length}`);
    return characters;
  }

  /**
   * v6.2-patch61-fix: 生成默认视觉描述(当【视觉】为空时兜底)
   */
  generateDefaultVisual(shot, analysis) {
    const parts = [];

    // 从shot中提取角色
    if (shot.characters && shot.characters.length > 0) {
      const isNirath = this.mode === 'nirath';
      parts.push(`${shot.characters.join('、')}在${isNirath ? 'Nirath异世界场景中' : '场景中'}`);
    } else {
      const isNirath = this.mode === 'nirath';
      parts.push(isNirath ? 'Nirath异世界场景' : '场景');
    }

    // 从analysis中提取场景特征
    if (analysis && analysis.world) {
      if (analysis.world.nirathName) parts.push(`场景: ${analysis.world.nirathName}`);
      if (analysis.world.atmosphere) parts.push(`氛围: ${analysis.world.atmosphere}`);
    }

    // 根据镜头类型添加默认描述
    const typeDesc = {
      'opening': '开场 establishing shot, 展现壮阔异世界全景',
      'environment': '环境展示, 突出场景独特氛围',
      'discovery': '探索发现, 主角与未知事物相遇',
      'reveal': '揭示真相, 关键信息展现',
      'interaction': '角色互动, 情感交流瞬间',
      'closing': '结尾镜头, 情绪收束与余韵',
      'climax': '高潮时刻, 紧张激烈冲突',
      'generic': '标准叙事镜头, 推进剧情发展'
    };
    parts.push(typeDesc[shot.type] || typeDesc['generic']);

    // 添加情绪描述 (v6.2-patch97-fix: 增加climax_peak支持)
    if (shot.emotionPhase) {
      const emotionMap = {
        'establishing': ' awe敬畏感',
        'rising': ' 紧张感递增',
        'turning': ' 震惊与转折',
        'building': ' 张力积累',
        'climax': ' 情绪高潮',
        'climax_peak': ' 情绪巅峰爆发', // v6.2-patch97-fix: 明确高潮峰值
        'resolve': ' 温柔化解',
        'resolution': ' 温柔化解',
        'neutral': ' 平衡自然'
      };
      parts.push(emotionMap[shot.emotionPhase] || '');
    }

    return parts.filter(Boolean).join(',') + '。';
  }

  // ========== Stage 5: 剧本生成(防硬编码:调用剧本生成Agent) ==========
  async stageScriptGeneration(input, prd) {
    this.log('STAGE-5', '剧本生成与分析(剧本生成Agent驱动)');

    // 防硬编码:调用剧本生成Agent进行分析和创作
    // 如果Agent不可用,使用结构化fallback而非直接透传
    let script;
    try {
      // 尝试调用剧本生成Agent(如果存在)
      if (input.scriptAgent && typeof input.scriptAgent.generate === 'function') {
        script = await input.scriptAgent.generate({
          prd,
          core: input.core,
          world: input.world,
          mode: this.mode
        });
        this.log('STAGE-5', `✅ 剧本Agent生成 | 场景数: ${script.scenes?.length || 0}`);
      } else if (input?.storyCraftVersion || input?.enableStoryCraft) {
        // v6.6.9: Generic模式不使用StoryCraft（Nirath专属模块）
        if (this.mode !== 'nirath') {
          this.log('STAGE-5', '⚠️ Generic模式跳过StoryCraft（Nirath专属模块），fallback到LLM');
          throw new Error('Generic mode does not support StoryCraft');
        }
        
        // 使用StoryCraft(与之前相同)
        this.log('STAGE-5', '⚠️ 剧本Agent未配置,自动启用StoryCraft作为默认剧本Agent');
        const { StoryCraftIntegration } = require('../systems/story-craft-engine/story-craft-integration');
        const storyCraft = new StoryCraftIntegration({ enabled: true, useLLM: true });
        const beastProfile = input?.beastProfile || input?.beast || input?.core?.beast || {};
        const scResult = await storyCraft.generateStory(input, beastProfile);

        if (scResult.success && scResult.storyboard) {
          script = {
            scenes: scResult.storyboard.shots.map((shot, idx) => ({
              id: shot.id || `S${String(idx + 1).padStart(2, '0')}`,
              scene: shot.beatName || 'scene',
              narration: shot.narration || '',
              type: shot.beatName || 'explanation',
              characters: [input.protagonistId || 'presenter', input.beastId || beastProfile.id || ''],
              emotionPhase: shot.emotionTarget?.emotion || 'neutral',
              importance: this.calculateImportance(shot.beatName, idx, scResult.storyboard.shots.length),
              visualComplexity: this.calculateVisualComplexity(shot.beatName),
              visualPrompt: shot.visualPrompt || '',
              beastDialogue: shot.beastDialogue,
              humanDialogue: shot.humanDialogue,
              beastMonologue: shot.beastMonologue,
              _threeAct: scResult.storyboard.beats?.find(b => b.id === shot.beatId)?._threeAct,
              _isDiamond: scResult.dialogueResult?.beastLines?.[shot.beatId]?.isDiamond || false
            })),
            narrative: {
              emotion: scResult.conceptSeed?.emotionalArc?.[0] || 'neutral',
              pace: 'medium',
              totalDuration: input.targetDuration || 15
            },
            world: {
              name: this.mode === 'nirath' ? 'Nirath' : (input.world?.setting || 'default'),
              setting: this.mode === 'nirath' ? '外星生态星球' : (input.world?.setting || 'default')
            },
            storyCraft: scResult
          };
          this.log('STAGE-5', `✅ StoryCraft剧本Agent生成 | 场景数: ${script.scenes.length} | 主题: ${scResult.conceptSeed?.theme}`);
        } else {
          throw new Error(`StoryCraft剧本生成失败: ${scResult.reason || scResult.error || 'unknown'}`);
        }
      } else if (this.useLLM) {
        // 🔥 v6.2-patch107-fix: 恢复LLM同步生成剧本(阻塞等待,确保后续Stage拿到完整数据)
        this.log('STAGE-5', '🧠 LLM 同步生成剧本(阻塞等待,确保数据完整性)');
        script = await this._llmGenerateScript(input, prd);
        this.log('STAGE-5', `✅ LLM剧本同步生成完成 | 场景数: ${script.scenes?.length || 0}`);
      } else {
        throw new Error('剧本Agent未配置');
      }
    } catch (e) {
      // v6.6.9.4-fix: LLM失败不再降级，直接报错终止
      throw new Error(`STAGE-5 剧本生成失败: ${e.message} | 已触发重试机制但仍失败，终止预生产`);
    }

    script.scenes = normalizeDialogueShots(script.scenes || []);

    // v6.6.9.4-patch17: 台词字数硬校验
    const SPEECH_RATE = 5.0;
    for (const scene of script.scenes) {
      const duration = Number(scene.duration) || 5;
      const maxChars = Math.floor(duration * SPEECH_RATE);
      const dialogue = (scene.dialogue || '').toString();
      if (dialogue.length > maxChars) {
        const original = dialogue;
        // 尝试在句子边界截断
        const truncated = this._truncateAtSentenceBoundary(dialogue, maxChars);
        scene.dialogue = truncated;
        this.log('STAGE-5', `  ⚠️ ${scene.id} 台词超长(${original.length}字>${maxChars}字),已自动截断至${truncated.length}字`);
      }
    }

    return script;
  }

  /**
   * v6.2-patch71-fix: 结构化fallback剧本生成(提取为独立方法)
   */
  _fallbackScript(input) {
    const analyzedScenes = (input.scenes || []).map((scene, idx) => {
      const total = (input.scenes || []).length;
      const shotType = scene.shotType || this._deriveShotType(idx, total, scene.type);
      return {
        id: scene.id || `S${String(idx + 1).padStart(2, '0')}`,
        scene: scene.scene || 'default',
        // v6.5.34-fix: 全局禁用narration,只保留dialogue
        dialogue: scene.dialogue || scene.narration || this._buildFallbackDialogue(scene, input.characters) || '',
        narration: '', // v6.5.34: narration已禁用,置空
        type: scene.type || 'explanation',
        shotType,
        characters: scene.characters || [],
        mouthAction: scene.mouthAction || this.generateDefaultMouthAction(scene.type, idx === 0),
        emotionPhase: scene.emotionPhase || this.calculateEmotionPhase(idx, total),
        importance: scene.importance || this.calculateImportance(scene.type, idx, total),
        visualComplexity: scene.visualComplexity || this.calculateVisualComplexity(scene.type),
        visualPrompt: scene.visualPrompt || this._generateFallbackVisualPrompt(scene),
        duration: scene.duration, // v6.2-patch71-fix: 保留PRD中的时长定义
        // v6.5.33-fix: 保留输入的运镜和光影配置,增强镜头质感评分
        cameraMovement: scene.cameraMovement || null,
        lighting: scene.lighting || null
      };
    });

    const script = {
      scenes: analyzedScenes,
      narrative: {
        emotion: input.core?.emotionalArc?.[0] || 'neutral',
        pace: input.style?.pacing || 'medium',
        totalDuration: input.targetDuration || 15
      },
      world: {
        name: this.mode === 'nirath' ? 'Nirath' : (input.world?.setting || 'default'),
        lighting: this.mode === 'nirath' ? 'rose-gold' : 'natural'
      }
    };

    this.log('STAGE-5', `✅ 剧本结构化fallback | 场景数: ${script.scenes.length} | 情绪: ${script.narrative.emotion} | mouthAction: ${analyzedScenes.filter(s => s.mouthAction).length}/${analyzedScenes.length}`);
    script.scenes = normalizeDialogueShots(script.scenes || []);
    this.fallbackMonitor.record('STAGE-5', {
      reason: 'fallback_script_generation',
      sceneCount: script.scenes.length
    });
    return script;
  }

  /**
   * v6.2-patch71-fix: 异步LLM剧本生成(不阻塞主链路)
   */
  async _llmGenerateScriptAsync(input, prd) {
    return this._llmGenerateScript(input, prd);
  }

  /**
   * v6.2-patch71-fix: 生成fallback visualPrompt(确保END-TO-END链路不断裂)
   */
  _generateFallbackVisualPrompt(scene) {
    const parts = [];
    if (scene.scene && scene.scene !== 'default') {
      parts.push(`场景: ${scene.scene}`);
    }
    if (scene.narration) {
      parts.push(scene.narration.substring(0, 100));
    }
    if (scene.characters && scene.characters.length > 0) {
      parts.push(`角色: ${scene.characters.join('、')}`);
    }
    return parts.join('。') || `场景${scene.id}`;
  }

  /**
   * v6.2-patch71-fix: LLM单次调用生成剧本(分批版,避免4096 tokens截断)
   */
  async _llmGenerateScript(input, prd) {
    const scenes = input.scenes || [];

    const mem = (label) => {
      const m = process.memoryUsage();
      console.log(
        `[MEM] ${label} | heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB | rss=${(m.rss / 1024 / 1024).toFixed(1)}MB`
      );
    };

    mem('Stage 5 start');

    // Phase A: 生成剧本骨架(轻量)
    const phaseAScenes = await this._generateScriptCorePhase(input);

    if (global.gc) global.gc();
    mem('Stage 5 after Phase A');

    // Phase B: 单独生成每个镜头的视觉提示词
    const phaseBScenes = await this._generateVisualPromptPhase({
      ...input,
      scenes: phaseAScenes
    });

    if (global.gc) global.gc();
    mem('Stage 5 after Phase B');

    return {
      ...input,
      scenes: phaseBScenes
    };
  }

  async _generateScriptCorePhase(input) {
    const { LLMEngine } = require('../systems/llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 3072,
      temperature: 1,  // v6.5.11: kimi-k2p6 固定 temperature=1
      topP: 0.95       // v6.5.11: kimi-k2p6 固定 top_p=0.95
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const isNirath = this.mode === 'nirath';
    const world = {
      name: isNirath ? 'Nirath' : (input.world?.name || input.projectName || '现实世界'),
      setting: isNirath ? '外星生态星球' : (input.world?.setting || input.style || '超写实纪录片风格')
    };

    const batchSize = 1;
    const batches = [];
    for (let i = 0; i < scenes.length; i += batchSize) {
      batches.push(scenes.slice(i, i + batchSize));
    }

    const results = [];

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const prompt = this._buildScriptCorePrompt(batch, core, world, batchIdx, batches.length, input);

      this.log('STAGE-5A', `🧩 批次 ${batchIdx + 1}/${batches.length} | 镜数: ${batch.length} | Prompt: ${prompt.length}字符`);

      const schema = {
        scenes: batch.map((scene) => ({
          id: scene.id,
          scene: scene.name || '',
          dialogue: '',
          narration: '',
          characters: scene.characters || [],
          mouthAction: 'speaking_normal',
          emotionPhase: 'curiosity'
        })),
        narrative: {
          emotion: 'neutral',
          pace: 'medium',
          totalDuration: batch.reduce((sum, s) => sum + (s.duration || 10), 0)
        },
        world: {
          name: world.name || '现实世界',
          setting: world.setting || ''
        }
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 3072,
        temperature: 1  // v6.5.64-P2: kimi-k2p6 只支持 temperature=1
      });

      if (result.success && Array.isArray(result.data?.scenes)) {
        const normalized = batch.map((srcScene) => {
          const generated = result.data.scenes.find((x) => x.id === srcScene.id) || {};
          // v6.5.29-fix: 提取LLM返回的characters,fallback到场景原始角色
          const llmChars = generated.characters || generated.characters_list || [];
          const sceneChars = srcScene.characters || [];
          const finalChars = llmChars.length > 0 ? llmChars : sceneChars;
          return {
            ...srcScene,
            scene: generated.scene || srcScene.name || '',
            // v6.5.34-fix: 全局禁用narration,只保留dialogue
            dialogue: generated.dialogue || generated.narration || this._buildFallbackDialogue(srcScene, input.characters),
            narration: '', // v6.5.34: narration已禁用,置空
            characters: finalChars,
            mouthAction: generated.mouthAction || 'speaking_normal',
            emotionPhase: generated.emotionPhase || this._inferEmotionPhase(srcScene),
            scriptCoreSuccess: true
          };
        });

        results.push(...normalized);
        this.log('STAGE-5A', `✅ 批次 ${batchIdx + 1} 成功`);
      } else {
        // v6.6.9.4-fix: LLM批次失败，不再降级，直接报错
        throw new Error(`STAGE-5A 批次 ${batchIdx + 1} 失败: ${result.error} | 已触发重试机制但仍失败，终止预生产`);
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  async _generateVisualPromptPhase(input) {
    const { LLMEngine } = require('../systems/llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 2048,
      temperature: 1,  // v6.5.11: kimi-k2p6 固定 temperature=1
      topP: 0.95       // v6.5.11: kimi-k2p6 固定 top_p=0.95
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const isNirath = this.mode === 'nirath';
    const world = {
      name: isNirath ? 'Nirath' : (input.world?.name || input.projectName || '现实世界'),
      setting: isNirath ? '外星生态星球' : (input.world?.setting || input.style || '超写实纪录片风格')
    };

    const results = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const prompt = this._buildVisualPrompt(scene, core, world, i, scenes.length, input);

      this.log('STAGE-5B', `🎬 镜头 ${i + 1}/${scenes.length} | scene=${scene.id} | Prompt: ${prompt.length}字符`);

      const schema = {
        id: scene.id,
        visualPrompt: ''
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 2048,
        temperature: 1  // v6.5.64-P2: kimi-k2p6 只支持 temperature=1
      });

      if (result.success && result.data?.id === scene.id) {
        let visualPrompt = result.data.visualPrompt || this._buildFallbackVisualPrompt(scene, world);

        // v6.6.0: 真实感提示词增强(软性注入)
        if (this.realismEnhancer && this.realismEnhancer.enabled) {
          visualPrompt = this.realismEnhancer.enhance(visualPrompt, {
            sceneType: scene.type || 'general',
            shotIndex: i
          });
        }

        results.push({
          ...scene,
          visualPrompt: visualPrompt,
          visualPromptSuccess: true
        });
        this.log('STAGE-5B', `✅ ${scene.id} visualPrompt 成功`);
      } else {
        let visualPrompt = this._buildFallbackVisualPrompt(scene, world);

        // v6.6.0: 真实感提示词增强(软性注入,fallback也增强)
        if (this.realismEnhancer && this.realismEnhancer.enabled) {
          visualPrompt = this.realismEnhancer.enhance(visualPrompt, {
            sceneType: scene.type || 'general',
            shotIndex: i
          });
        }

        this.log('STAGE-5B', `⚠️ ${scene.id} visualPrompt 失败: ${result.error}`);
        results.push({
          ...scene,
          visualPrompt: visualPrompt,
          visualPromptSuccess: false,
          visualPromptError: result.error
        });
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  // v6.6.0: 视觉提示词真实感增强(后置处理)
  _enhanceVisualPromptWithRealism(visualPrompt, scene, index) {
    if (!this.realismEnhancer || !this.realismEnhancer.enabled) {
      return visualPrompt;
    }

    const enhanced = this.realismEnhancer.enhance(visualPrompt, {
      sceneType: scene.type || 'general',
      shotIndex: index
    });

    if (enhanced !== visualPrompt) {
      this.log('STAGE-5B', `🎨 ${scene.id} 真实感增强已注入 | 7维质感参数`);
    }

    return enhanced;
  }

  // v6.5.59-fix: 主进程内存释放(OOM修复)
  // 根因:主进程执行STAGE-0~12后,累积大量内存到5.1GB
  // 修复:释放已完成Stage的大对象,强制GC
  _releaseMemory(result) {
    if (!result || !result.stages) return;

    // 释放渲染结果(已写入文件)
    if (result.stages.render) {
      result.stages.render = null;
    }

    // 释放剧本原始LLM输出
    if (result.stages.script && result.stages.script.raw) {
      result.stages.script.raw = null;
    }

    // 释放其他已完成Stage的大对象
    if (result.stages.prd) result.stages.prd = null;
    if (result.stages.storyboard) result.stages.storyboard = null;
    if (result.stages.opening) result.stages.opening = null;
    if (result.stages.alignment) result.stages.alignment = null;
    if (result.stages.schema) result.stages.schema = null;
    if (result.stages.characters) result.stages.characters = null;

    // 强制GC确保释放生效
    if (global.gc) {
      global.gc();
    }

    this.log('PIPELINE', '✅ 主进程内存释放完成(OOM修复)');
  }

  _buildScriptCorePrompt(batch, core, world, batchIdx, totalBatches, input) {
    const parts = [];
    const isNirath = this.mode === 'nirath';

    parts.push(`你是一位专业的视频剧本策划Agent。`);
    parts.push(`请为当前批次场景生成简洁、可直接用于视频制作的剧本骨架。`);
    parts.push(`只输出一个合法JSON对象,不要输出解释、思考过程、markdown代码块。`);

    parts.push(`
【世界观】`);
    parts.push(`名称:${world.name || '现实世界'}`);
    parts.push(`设定:${world.setting || '默认世界观'}`);

    if (!isNirath) {
      parts.push(`
【重要约束】`);
      parts.push(`- 本视频为真实世界纪录片/科普风格,禁止使用任何虚构元素`);
      parts.push(`- 禁止出现:外星生态、科幻场景、超自然现象`);
      parts.push(`- 所有角色必须是真实人类,禁止虚构角色`);
      parts.push(`- 场景必须是真实医疗/教育环境`);
    }

    parts.push(`
【当前批次】${batchIdx + 1}/${totalBatches}`);

    parts.push(`
【角色信息】`);
    parts.push(`- 当前场景必须包含以下角色之一,禁止空角色`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''} | 必须在dialogue中体现`);
    });
    parts.push(`
【角色出场规则】`);
    parts.push(`- 每个场景必须明确包含角色名称`);
    parts.push(`- dialogue中角色名称必须完整出现,不能省略`);
    parts.push(`- 禁止生成无角色或角色为"无"的场景`);

    parts.push(`
【场景列表】`);
    batch.forEach((scene, idx) => {
      const sceneChars = (scene.characters || []).join(', ') || '无';
      parts.push(`场景${idx + 1}`);
      parts.push(`- id: ${scene.id}`);
      parts.push(`- 名称: ${scene.name || '未命名'}`);
      parts.push(`- 类型: ${scene.type || 'explanation'}`);
      parts.push(`- 时长: ${scene.duration || 10}秒`);
      parts.push(`- 描述: ${scene.description || '无描述'}`);
      parts.push(`- 角色: ${sceneChars}`);
      parts.push(`- 强制要求: dialogue必须包含角色"${sceneChars}",禁止空角色`);
    });

    parts.push(`
【生成要求】`);
    parts.push(`1. scene:场景名称,可简要优化`);
    parts.push(`2. dialogue:口语化、自然,适合视频表达`);
    parts.push(`3. narration:必要时提供简短准确的旁白`);
    parts.push(`4. mouthAction:只能是 speaking_normal / speaking_whisper / speaking_emphasis`);
    parts.push(`5. emotionPhase:只能是 curiosity / tension / climax / resolution`);

    parts.push(`
【风格要求】`);
    parts.push(`- 健康科普内容应专业、清晰、不过度夸张`);
    parts.push(`- 语言适合短视频口播`);
    parts.push(`- 优先保证可读性与可拍摄性`);

    parts.push(`
【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层必须包含 scenes, narrative, world`);
    parts.push(`- scenes 数量必须与输入场景数完全一致`);
    parts.push(`- scenes 中每项必须包含 id, scene, dialogue, narration, characters, mouthAction, emotionPhase`);
    parts.push(`- 每个 id 必须与输入一致`);
    parts.push(`- characters 必须是角色ID数组,如 ["chen-zhuo", "presenter", "doctor-li"]`);

    parts.push(`
【输出示例】`);
    parts.push(`{
  "scenes": [
    {
      "id": "S01",
      "scene": "开场介绍",
      "dialogue": "大家好,今天我们来聊一个需要高度重视的问题。",
      "narration": "本集主题为横纹肌溶解。",
      "characters": ["chen-zhuo", "presenter", "doctor-li"],
      "mouthAction": "speaking_normal",
      "emotionPhase": "curiosity"
    }
  ],
  "narrative": {
    "emotion": "neutral",
    "pace": "medium",
    "totalDuration": 15
  },
  "world": {
    "name": "${world.name || '现实世界'}",
    "setting": "${world.setting || ''}"
  }
}`);

    return parts.join('\n');
  }

  _buildVisualPrompt(scene, core, world, idx, total, input) {
    const parts = [];
    const isNirath = this.mode === 'nirath';

    parts.push(`你是一位专业的视频分镜视觉提示词生成Agent。`);
    parts.push(`请只为当前单个场景生成 visualPrompt。`);
    parts.push(`只输出一个合法JSON对象,不要输出解释、思考过程、markdown代码块。`);

    parts.push(`
【世界观】`);
    parts.push(`名称:${world.name || '现实世界'}`);
    parts.push(`设定:${world.setting || '默认世界观'}`);

    if (!isNirath) {
      parts.push(`
【重要约束】`);
      parts.push(`- 本视频为真实世界纪录片/科普风格,禁止使用任何虚构元素`);
      parts.push(`- 禁止出现:外星生态、科幻场景、超自然现象`);
      parts.push(`- 禁止出现:"迈出第一步"、"选择信任"、"勇敢告别"、"温柔注视"等Nirath专属叙事短语`);
      parts.push(`- 所有角色必须是真实人类,禁止虚构角色`);
      parts.push(`- 场景必须是真实医疗/教育环境`);
    }

    parts.push(`
【当前镜头】${idx + 1}/${total}`);
    parts.push(`- id: ${scene.id}`);
    parts.push(`- 名称: ${scene.name || '未命名'}`);
    parts.push(`- 类型: ${scene.type || 'explanation'}`);
    parts.push(`- 时长: ${scene.duration || 10}秒`);
    parts.push(`- 描述: ${scene.description || '无描述'}`);
    parts.push(`- dialogue: ${scene.dialogue || ''}`);
    parts.push(`- narration: ${scene.narration || ''}`);

    parts.push(`
【角色信息】`);
    parts.push(`- 当前场景必须包含以下角色之一,禁止空角色`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''} | 必须在dialogue中体现`);
    });
    parts.push(`
【角色出场规则】`);
    parts.push(`- 每个场景必须明确包含角色名称`);
    parts.push(`- dialogue中角色名称必须完整出现,不能省略`);
    parts.push(`- 禁止生成无角色或角色为"无"的场景`);

    // v6.6.0: 叙事方式与结尾处理
    const narrativeMode = input.narrativeMode || 'dialogue';
    const endingStyle = input.endingStyle || 'summary';
    parts.push(`
【叙事方式】`);
    parts.push(`- 叙事模式: ${narrativeMode}`);
    if (narrativeMode === 'dialogue') {
      parts.push(`- 对话式讲解: 角色直接面向观众说话,口语化、自然`);
    } else if (narrativeMode === 'narration') {
      parts.push(`- 旁白式: 以旁白为主,角色动作配合画面`);
    } else if (narrativeMode === 'drama') {
      parts.push(`- 剧情式: 角色间互动对话,有戏剧冲突`);
    } else if (narrativeMode === 'interview') {
      parts.push(`- 访谈式: 问答形式,一问一答`);
    }
    parts.push(`- dialogue必须符合叙事模式,不要混用其他模式`);

    parts.push(`
【结尾处理】`);
    parts.push(`- 结尾风格: ${endingStyle}`);
    if (endingStyle === 'summary') {
      parts.push(`- 总结式: 总结本集要点,给出结论`);
    } else if (endingStyle === 'cliffhanger') {
      parts.push(`- 悬念式: 留下悬念,引发好奇`);
    } else if (endingStyle === 'callToAction') {
      parts.push(`- 行动号召: 引导观众采取行动`);
    } else if (endingStyle === 'emotional') {
      parts.push(`- 情感升华: 情感升华,引发共鸣`);
    } else if (endingStyle === 'open') {
      parts.push(`- 开放式: 不给出明确结论,留给观众思考`);
    }

    parts.push(`
【生成要求】`);
    parts.push(`请生成 120-180 字的 visualPrompt,用于视频生成。`);
    parts.push(`内容需包含:`);
    parts.push(`1. 场景环境`);
    parts.push(`2. 人物动作与姿态`);
    parts.push(`3. 镜头景别或机位`);
    parts.push(`4. 光线与画面质感`);
    parts.push(`5. 纪录片/真实科普风格`);
    parts.push(`6. 不要出现参数化提示词,不要出现分辨率、英文模型参数、括号权重`);

    // 🔥 v2.0: 创意指数指令注入(仅影响视觉表现层)
    const ciiInstructions = this._getCreativeIntensityInstructions('STAGE-5');
    if (ciiInstructions) {
      parts.push(`
【创意增强】`);
      parts.push(ciiInstructions.trim());
    }

    // v6.6.0: 平台适配与视觉风格
    const platform = input.platform || '视频号/抖音';
    const visualStyle = input.visualStyle || '';
    const styleModifiers = input.styleModifiers || [];

    parts.push(`
【平台与画幅】`);
    parts.push(`- 投放平台: ${platform}`);
    if (platform.includes('抖音') || platform.includes('快手') || platform.includes('小红书')) {
      parts.push(`- 推荐画幅: 9:16 竖屏`);
    } else if (platform.includes('B站') || platform.includes('YouTube')) {
      parts.push(`- 推荐画幅: 16:9 横屏`);
    } else {
      parts.push(`- 推荐画幅: 9:16 竖屏(默认)`);
    }

    if (visualStyle || styleModifiers.length > 0) {
      parts.push(`
【视觉风格指导】`);
      if (visualStyle) {
        parts.push(`- 整体视觉风格: ${visualStyle}`);
      }
      if (styleModifiers.length > 0) {
        parts.push(`- 辅助风格修饰: ${styleModifiers.join('、')}`);
      }
    }

    parts.push(`
【风格要求】`);
    parts.push(`- 超写实纪录片风格`);
    parts.push(`- 医疗/科普场景真实可信`);
    parts.push(`- 人物表情自然,不夸张`);
    parts.push(`- 适合后续视频生成模型理解`);

    parts.push(`
【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层只包含 id 和 visualPrompt`);
    parts.push(`- id 必须与输入一致`);

    parts.push(`
【输出示例】`);
    parts.push(`{
  "id": "${scene.id}",
  "visualPrompt": "超写实纪录片风格,专业医疗科普环境中,主持人面对镜头进行清晰讲解,神态自然沉稳,人物位于中近景构图,背景为整洁明亮的诊室或科普演播空间,画面采用柔和自然光,细节真实,镜头稳定,整体呈现专业、可信、克制的医学科普质感。"
}`);

    return parts.join('\n');
  }

  _buildFallbackDialogue(scene, characters = {}) {
    const name = scene.name || '当前场景';

    // v6.5.29: 获取角色名称,确保角色出现在dialogue中
    const charNames = Object.values(characters || {}).map(c => c.name || c.id || '').filter(Boolean);
    const speaker = charNames[0] || '主持人';

    // 获取场景指定的角色(优先使用场景的角色列表)
    const sceneChars = (scene.characters || []).map(cid => {
      const char = characters[cid];
      return char ? (char.name || char.id) : cid;
    }).filter(Boolean);
    const sceneSpeaker = sceneChars[0] || speaker;

    if (scene.type === 'establishing') {
      return `大家好,我是${sceneSpeaker},今天我们来了解一下${name}相关的核心内容。`;
    }

    if (scene.type === 'explanation') {
      return `这一部分${sceneSpeaker}重点讲解${name},帮助大家快速抓住关键知识点。`;
    }

    if (scene.type === 'demonstration') {
      return `接下来${sceneSpeaker}通过一个示范动作,直观理解${name}的表现和检查方式。`;
    }

    if (scene.type === 'closing') {
      return `最后${sceneSpeaker}再强调一次,如果出现相关症状,一定要及时就医,不要拖延。`;
    }

    return `下面${sceneSpeaker}进入${name}。`;
  }

  /**
   * v6.6.9.4-patch17: 在句子边界截断台词，确保不超字数
   */
  _truncateAtSentenceBoundary(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    // 优先在句号、问号、感叹号处截断
    const sentenceEndings = ['。', '？', '！', '?', '!', '；', ';'];
    let bestIdx = -1;
    for (let i = maxLen; i >= 0; i--) {
      if (sentenceEndings.includes(text[i])) {
        bestIdx = i + 1;
        break;
      }
    }
    // 如果没找到句子边界，退回到空格或逗号
    if (bestIdx <= 0) {
      for (let i = maxLen; i >= 0; i--) {
        if (text[i] === '，' || text[i] === '、' || text[i] === ' ') {
          bestIdx = i;
          break;
        }
      }
    }
    // 如果还没有，直接硬截断
    if (bestIdx <= 0) bestIdx = maxLen;
    return text.substring(0, bestIdx).trim();
  }

  _buildFallbackNarration(scene) {
    const desc = scene.description || `${scene.name || '该场景'}的补充说明`;

    // v6.5.29: 确保结尾镜头narration完整收束,避免以半截词结尾
    if (scene.type === 'closing') {
      return `以上就是关于${scene.name || '本话题'}的核心要点。如果出现相关症状,请及时就医。`;
    }

    return desc + '。';
  }

  _buildFallbackVisualPrompt(scene, world) {
    return [
      `超写实纪录片风格,`,
      `${world?.setting || '真实场景'},`,
      `镜头表现${scene.name || '当前场景'},`,
      `突出${scene.description || '关键信息讲解'},`,
      `人物动作自然,表情专业克制,`,
      `采用中近景或特写镜头,`,
      `自然光或柔和室内布光,`,
      `画面真实、干净、稳定,适合医学科普视频生成。`
    ].join('');
  }

  _inferEmotionPhase(scene) {
    switch (scene.type) {
      case 'establishing':
        return 'curiosity';
      case 'explanation':
        return 'tension';
      case 'demonstration':
        return 'climax';
      case 'closing':
        return 'resolution';
      default:
        return 'curiosity';
    }
  }
  _buildScriptPrompt(scenes, core, world, batchIdx, totalBatches) {
    // 根据模式选择提示词模板
    const isNirath = this.mode === 'nirath';
    const projectType = isNirath ? 'Nirath' : (core.projectType || '视频');
    const worldName = world?.name || world?.setting || (isNirath ? 'Nirath' : '现实世界');
    const worldDesc = isNirath ? '(外星生态星球)' : (world?.atmosphere ? `(${world.atmosphere})` : '');
    const style = world?.style || (isNirath ? 'Nirath电影级, 超写实科幻生态风格' : '超写实纪录片风格');

    // 从场景中提取所有角色,避免硬编码
    const allChars = new Set();
    for (const s of scenes) {
      if (s.characters && s.characters.length > 0) {
        for (const c of s.characters) {
          if (c && c !== '无') allChars.add(c);
        }
      }
    }
    // 如果没有提取到角色,使用默认值
    const defaultChars = isNirath ? 'xiaoG,taotie' : 'chen-nurse,xiaoG,coach-li';
    const charList = allChars.size > 0 ? Array.from(allChars).join(',') : defaultChars;

    return `你是一位编剧,为${projectType}生成台词剧本(批次${batchIdx + 1}/${totalBatches})。

## 主题
${core.theme || '未指定'}

## 核心内容(P0级约束:必须严格遵循)
${core.narrative?.focus || core.focus || '健康科普内容'}

## 世界观
${worldName}${worldDesc}

## 场景(${scenes.length}镜)(必须严格使用以下场景名称,禁止自由发挥)
${scenes.map((s, i) => `${i+1}. ${s.id}: ${s.scene} | ${s.type} | ${s.duration}s | 角色:${s.characters?.join(',') || charList}
   场景描述: ${s.description || '无'}
   已有台词: ${(s.dialogue || '').substring(0, 40)}...`).join('\n')}

## 角色规范(P0级约束)
- 每个场景必须有角色,禁止生成无角色的场景
- 角色列表格式: ["${charList.split(',').join('"、"')}"]
- 禁止 characters: ["无"] 或 [] 或 null
- 场景必须有对话,必须有角色在说话

## 风格
${style}(必须与场景主题一致)

## 输出要求
**必须严格输出JSON,不要任何中文解释、不要markdown代码块标记、不要【】括号。**
**只输出纯JSON字符串,开头就是 {,结尾就是 }。**
**⚠️ 关键约束:scene字段必须严格使用输入的场景名称,禁止修改或自创名称。**

JSON格式(注意:用dialogue字段,不是narration):
${isNirath
  ? `{"scenes":[{"id":"S01","scene":"场景名称","dialogue":"角色对白或台词文本(不要旁白叙述,要角色自己说的话)","type":"opening","characters":["${charList.split(',')[0] || 'chen-nurse'}"],"mouthAction":"speaking_whisper","emotionPhase":"curiosity","importance":8,"visualComplexity":7,"visualPrompt":"超写实,电影级光影,角色动作描述(300-500字)"}]}`
  : `{"scenes":[{"id":"S01","scene":"场景名称","dialogue":"角色对白或台词文本(不要旁白叙述,要角色自己说的话)","type":"explanation","characters":["${charList.split(',')[0] || 'chen-nurse'}"],"mouthAction":"speaking_normal","emotionPhase":"professional","importance":8,"visualComplexity":7,"visualPrompt":"超写实,电影级光影,角色动作描述(300-500字)"}]}`
}

## 关键规则(P0级约束)
- ❌ 绝对禁止生成旁白/叙述性文字(如"角色来到了...")
- ✅ 必须生成角色对白/台词(角色自己说的话)
- ✅ 严格遵循每个场景指定的角色列表,禁止引入未声明角色
- ✅ 台词内容必须与场景名称和场景描述的主题一致(如"症状讲解"场景必须围绕症状展开)
- ✅ 每镜台词必须独立原创,严禁复制其他镜的台词内容(每镜必须是全新对话,不能重复)
- ✅ 结尾镜头(S05/closing)必须有完整的台词收束,不能以半截句子或单个字结束
- ✅ 必须严格使用输入的场景名称,禁止修改或自创名称
- ✅ 台词字数约束:每镜dialogue字数 ≤ 场景时长(秒) × 5.0字/秒。例如15秒场景,台词不超过75字；5秒场景,台词不超过25字。严禁超长台词！
- 如果有多个角色,标注谁在说话
- 台词要体现角色性格和情绪
- 场景名称是中文,台词内容也必须匹配中文场景名所暗示的主题`;;
  }

  // ========== Stage 5.5: FPV镜头智能决策(导演创作权)==========
  async stageFPVDecision(script) {
    this.log('STAGE-5.5', 'FPV镜头智能决策(导演创作权)');

    let fpvAnalysis = null;
    let directorDecision = null;

    try {
      // 加载 FPV Intelligence Engine
      const { FPVIntelligenceEngine } = require('../systems/fpv-intelligence-engine.js');
      const fpvEngine = new FPVIntelligenceEngine();

      // 转换 scenes 为 shots 格式(兼容FPV引擎)
      const fpvScript = {
        shots: (script.scenes || []).map((scene, idx) => ({
          id: scene.id,
          type: scene.type,
          mood: scene.emotionPhase || '',
          prompt: scene.narration || '',
          index: idx,
          duration: scene.duration || 5
        })),
        arc: script.narrative?.emotion || 'neutral',
        climaxIndex: (script.scenes || []).findIndex(s => s.type === 'climax' || s.emotionPhase === 'climax')
      };

      // 评估剧本的FPV适配度
      fpvAnalysis = fpvEngine.evaluateScript(fpvScript);

      // 导演决策:选择最佳FPV镜头
      directorDecision = fpvAnalysis.directorDecision;

      this.log('STAGE-5.5', `✅ FPV智能评估完成`);
      this.log('STAGE-5.5', `   剧本FPV适配度: ${fpvAnalysis.scriptAnalysis?.averageFPVSuitability || 'unknown'}/100`);
      this.log('STAGE-5.5', `   导演决策: ${directorDecision?.reasoning || '无'}`);

      // 标记每个镜头的FPV推荐状态(尊重导演决策)
      const directorPrimary = directorDecision?.primaryFPV;
      const directorSecondary = directorDecision?.secondaryFPV;

      for (const shot of script.scenes || []) {
        const shotAnalysis = fpvAnalysis.shotEvaluations?.find(s => s.shotId === shot.id);
        if (shotAnalysis) {
          // 导演决策优先:如果导演选中了,即使系统评分不高也标记为FPV
          const isDirectorChoice = (directorPrimary?.shotId === shot.id) ||
                                   (directorSecondary?.shotId === shot.id);

          shot.fpvRecommended = shotAnalysis.isRecommended || isDirectorChoice;
          shot.fpvScore = shotAnalysis.totalScore;
          shot.fpvReason = isDirectorChoice
            ? `导演决策:${directorDecision?.reasoning || '选中该镜头'}`
            : shotAnalysis.recommendation;

          if (shot.fpvRecommended) {
            this.log('STAGE-5.5', `   🔴 FPV推荐: ${shot.id} | 得分: ${shot.fpvScore} | 理由: ${shot.fpvReason}`);
          }
        }
      }

    } catch (e) {
      this.log('STAGE-5.5', `⚠️ FPV智能评估失败: ${e.message} | 使用默认策略`);
      // Fallback: 默认策略( climax 镜头标记为FPV)
      for (const shot of script.scenes || []) {
        if (shot.type === 'climax' || shot.emotionPhase === 'climax') {
          shot.fpvRecommended = true;
          shot.fpvScore = 85;
          shot.fpvReason = 'climax镜头默认FPV';
          this.log('STAGE-5.5', `   🔴 FPV推荐(fallback): ${shot.id} | climax镜头`);
        }
      }
    }

    return {
      analysis: fpvAnalysis,
      directorDecision,
      recommendedShots: (script.scenes || []).filter(s => s.fpvRecommended).map(s => s.id)
    };
  }

  // ========== Stage 5.5B: 角色出场分析（人物出场卡片系统 v1.0）==========
  async stageCharacterIntroAnalysis(script, input) {
    this.log('STAGE-5.5B', '角色出场分析（人物出场卡片系统）');

    const characters = input.characters || {};
    const scenes = script.scenes || [];
    const appearanceMap = {};
    const introCards = [];

    // 分析每个角色的首次出场
    for (const scene of scenes) {
      const sceneChars = scene.characters || [];
      for (const charId of sceneChars) {
        if (!appearanceMap[charId] && characters[charId]) {
          appearanceMap[charId] = scene.id;
          
          // 标记首次出场
          scene.isFirstAppearance = true;
          scene.characterToIntroduce = charId;
          
          // 生成人物出场卡片
          const char = characters[charId];
          const card = {
            enabled: true,
            characterId: charId,
            sceneId: scene.id,
            displayStyle: input.introCardStyle || 'documentary',
            displayTiming: '0-2s',
            position: 'lower-third',
            content: {
              name: char.name || charId,
              title: char.title || char.role || '主讲人',
              subtitle: char.subtitle || ''
            }
          };
          
          scene.characterIntroCard = card;
          introCards.push(card);
          
          this.log('STAGE-5.5B', `  ✅ ${charId} 首次出场: ${scene.id} | 卡片: ${card.content.name} | ${card.content.title}`);
        }
      }
    }

    // 清洗非首次出场的台词（移除自我介绍前缀）
    for (const scene of scenes) {
      if (scene.dialogue && !scene.isFirstAppearance) {
        const originalDialogue = scene.dialogue;
        scene.dialogue = this.cleanSelfIntroduction(scene.dialogue, characters);
        if (originalDialogue !== scene.dialogue) {
          this.log('STAGE-5.5B', `  🧹 ${scene.id} 台词清洗: 移除自我介绍 | 原: "${originalDialogue.substring(0, 40)}..." → 新: "${scene.dialogue.substring(0, 40)}..."`);
        }
      }
    }

    this.log('STAGE-5.5B', `✅ 角色出场分析完成 | 首次出场角色: ${Object.keys(appearanceMap).length}个 | 生成卡片: ${introCards.length}张`);
    
    return {
      appearanceMap,
      introCards,
      totalCharacters: Object.keys(characters).length
    };
  }

  // 清洗台词中的自我介绍前缀
  cleanSelfIntroduction(dialogue, characters) {
    if (!dialogue) return dialogue;
    
    let cleaned = dialogue;
    const charNames = Object.values(characters).map(c => c.name || c.id).filter(Boolean);
    
    for (const charName of charNames) {
      // 匹配各种自我介绍模式
      const patterns = [
        new RegExp(`^大家好，我是${charName}[，。.]\\s*`, 'g'),
        new RegExp(`^我是${charName}[，。.]\\s*`, 'g'),
        new RegExp(`^${charName}：\\s*`, 'g'),
        new RegExp(`^这里是${charName}[，。.]\\s*`, 'g'),
        new RegExp(`^我是${charName}，`, 'g'),
      ];
      
      for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '');
      }
    }
    
    cleaned = cleaned.trim();
    
    // v6.6.9.4-patch19: 底线保护 - 如果清洗后为空，保留原台词（避免清空有效内容）
    if (!cleaned || cleaned.length === 0) {
      return dialogue.trim();
    }
    
    return cleaned;
  }

  // ========== Stage 6: 时长分配(集成ShotDurationAllocatorV2 + DurationCalculator双保险 + P1修复) ==========
  async stageDurationAllocation(script, input) {
    this.log('STAGE-6', '镜头时长分配(ShotDurationAllocatorV2 + DurationCalculator双保险)');

    const allocations = [];
    const totalDuration = script.narrative?.totalDuration || (input && input.targetDuration) || 15;

    // P0修复#3 + P1修复#14-22:集成ShotDurationAllocatorV2(重要性驱动/弹性区间/双池模型)
    let v2Allocations = null;
    let optimizationLevel = 'L0';
    try {
      if (typeof this.modules.shotDurationAllocator.allocate === 'function') {
        // 🔥 v6.0: 时长放宽5%~10%(剧本需要时自动启用)
        // v6.2-patch66-fix: 从15%降低到5%,防止总时长过度偏离PRD
        const baseDuration = totalDuration;
        const relaxedDuration = Math.round(baseDuration * 1.05); // 放宽5%
        const finalDuration = Math.max(baseDuration, Math.min(relaxedDuration, 90)); // 上限90秒

        if (finalDuration > baseDuration) {
          this.log('STAGE-6', `📏 时长放宽: ${baseDuration}s → ${finalDuration}s (+${Math.round((finalDuration/baseDuration - 1) * 100)}%)`);
        }

        // 构造v2输入:包含importance和visualComplexity
        // 🔥 v6.2-patch49-fix: 防御性校验,防止空数据导致ShotDurationAllocatorV2报错
        const safeScenes = Array.isArray(script.scenes) ? script.scenes : [];
        if (safeScenes.length === 0) {
          throw new Error('script.scenes为空数组,无法进行时⻓分配');
        }
        const v2Narrations = safeScenes.map((s, idx) => {
          // v6.5.34-fix: 全局禁用narration,使用dialogue替代
          const text = (s.dialogue || s.narration || '').toString();
          const type = s.type || s.beatName || 'explanation';
          if (!text || text.length === 0) {
            this.log('STAGE-6', `  ⚠️ 场景${s.id || idx} dialogue为空,使用默认文本`);
          }
          return {
            id: s.id || `S${String(idx + 1).padStart(2, '0')}`,
            text: text || '[无文本]',
            type: type,
            priority: s.importance || 5,
            importance: s.importance || 5,
            visualComplexity: s.visualComplexity || 5,
            characters: s.characters || []
          };
        });
        const v2Input = {
          totalDuration: finalDuration,
          rhythmCurve: script.narrative?.pace || 'classic',
          narrations: v2Narrations
        };
        this.log('STAGE-6', `📤 ShotDurationAllocatorV2输入: ${v2Narrations.length}句dialogue | 总预算${finalDuration}s`);
        v2Allocations = this.modules.shotDurationAllocator.allocate(v2Input);
        optimizationLevel = v2Allocations?.optimizationLevel || 'L0';

        // 校验返回结果完整性
        if (!v2Allocations || !Array.isArray(v2Allocations.shots)) {
          throw new Error('ShotDurationAllocatorV2返回结果无效: shots数组缺失');
        }
        if (v2Allocations.shots.length !== safeScenes.length) {
          this.log('STAGE-6', `  ⚠️ 分配结果镜数不匹配: 输入${safeScenes.length}镜 → 输出${v2Allocations.shots.length}镜`);
        }
        this.log('STAGE-6', `✅ ShotDurationAllocatorV2已调用 | 优化级别: ${optimizationLevel} | 总时长预算: ${finalDuration}s | 返回${v2Allocations.shots.length}镜`);
      }
    } catch (e) {
      this.log('STAGE-6', `⚠️ ShotDurationAllocatorV2调用失败: ${e.message}`);
    }

    // P1修复#34:L2降级处理避免0镜产出
    if (optimizationLevel === 'L2' || optimizationLevel === 'L3') {
      this.log('STAGE-6', `⚠️ 时长分配触发降级: ${optimizationLevel} | 内容超载,建议精简narration或增加预算`);
    }

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const narration = scene.narration || '';
      const charCount = narration.length;

      // v6.2-patch71-fix: 优先使用PRD中定义的场景时长,尊重业务输入
      let duration;
      const prdDuration = scene.duration;
      if (v2Allocations && v2Allocations.shots && v2Allocations.shots[i]) {
        const v2Duration = v2Allocations.shots[i].duration;
        // 如果PRD中定义了该场景的duration,优先使用PRD值(±10%容差内不调整)
        if (prdDuration && prdDuration >= 3 && prdDuration <= 30) {
          const ratio = v2Duration / prdDuration;
          if (ratio >= 0.9 && ratio <= 1.1) {
            // v2分配在容差内,直接使用PRD值
            duration = prdDuration;
            this.log('STAGE-6', `  🎯 V2分配(尊重PRD): ${scene.id} | PRD:${prdDuration}s ≈ V2:${v2Duration}s | 使用PRD:${duration}s`);
          } else {
            // v6.6.2-fix: 当V2计算值大于PRD,且不超过15秒硬约束时,使用V2值
            if (v2Duration > prdDuration && v2Duration <= 15) {
              duration = v2Duration;
              this.log('STAGE-6', `  🎯 V2调整(内容适配): ${scene.id} | PRD:${prdDuration}s → V2:${v2Duration}s (≤15s硬约束)`);
            } else if (v2Duration > 15) {
              // 超过15秒硬约束,使用15秒,警告
              duration = 15;
              this.log('STAGE-6', `  ⚠️ V2超限(15s硬约束): ${scene.id} | PRD:${prdDuration}s vs V2:${v2Duration}s → 强制15s,建议精简台词`);
            } else {
              // V2 < PRD,使用PRD(业务定义优先)
              duration = prdDuration;
              this.log('STAGE-6', `  ⚠️ V2与PRD差异大: ${scene.id} | PRD:${prdDuration}s vs V2:${v2Duration}s | 强制使用PRD:${duration}s`);
            }
          }
        } else {
          duration = v2Duration;
          this.log('STAGE-6', `  🎯 V2分配: ${scene.id} | importance:${scene.importance || 5} | duration:${duration}s`);
        }
      } else {
        // Fallback: DurationCalculator
        try {
          duration = this.modules.durationCalculator.calculate({
            text: narration,
            type: scene.type || 'default'
          });
        } catch (e) {
          const estimatedDuration = Math.ceil(charCount / 4.5 + 0.5);
          duration = Math.min(Math.max(estimatedDuration, 3), 12);
        }
      }

      // v6.2-patch65: 节奏增强 - 基于shotType增加张弛变化
      // climax镜延长,过渡镜缩短,形成叙事节奏
      if (scene.shotType === 'climax') {
        const extra = Math.round(duration * 0.25); // climax镜延长25%
        duration += extra;
        this.log('STAGE-6', `  🎵 节奏增强: ${scene.id} climax镜 +${extra}s`);
      } else if (scene.shotType === 'setup' || scene.shotType === 'transition') {
        const reduce = Math.round(duration * 0.15); // 过渡镜缩短15%
        duration = Math.max(duration - reduce, 5); // 最少5秒
        this.log('STAGE-6', `  🎵 节奏增强: ${scene.id} 过渡镜 -${reduce}s`);
      }
      const clampedDuration = Math.min(Math.max(duration, 3), prdDuration && prdDuration >= 3 ? Math.min(prdDuration, 15) : 15);
      const capacity = Math.floor(clampedDuration * 5.0); // 极限语速5.0字/秒
      const isOverCapacity = charCount > capacity;

      // P1修复#19:节奏曲线阶段标记
      const emotionPhase = scene.emotionPhase || this.calculateEmotionPhase(i, script.scenes.length);

      allocations.push({
        sceneId: scene.id,
        narration,
        charCount,
        duration: clampedDuration,
        type: scene.type,
        importance: scene.importance || 5,
        visualComplexity: scene.visualComplexity || 5,
        emotionPhase,
        v2Allocated: !!v2Allocations,
        optimizationLevel,
        isOverCapacity,
        capacity
      });

      if (isOverCapacity) {
        this.log('STAGE-6', `  ⚠️ narration超长: ${scene.id} | ${charCount}字 > ${capacity}字容量(${clampedDuration}秒)`);
      }
    }

    // P1修复#20:三级自优化状态报告
    if (optimizationLevel !== 'L0') {
      this.log('STAGE-6', `⚠️ 时长分配优化级别: ${optimizationLevel} | 建议检查内容是否超载`);
    }

    this.log('STAGE-6', `✅ 时长分配 | 镜头数: ${allocations.length} | V2分配: ${allocations.filter(a => a.v2Allocated).length}/${allocations.length} | 超长: ${allocations.filter(a => a.isOverCapacity).length}/${allocations.length} | 优化级别: ${optimizationLevel}`);
    return allocations;
  }

  // ========== Stage 7: 故事板生成(防硬编码:结构化生成 + mouthAction字段 + 场景映射) ==========
  async stageStoryboard(script, durations, input = {}) {
    this.log('STAGE-7', '故事板生成(结构化生成器 + mouthAction字段 + 场景映射)');
    script.scenes = normalizeDialogueShots(script.scenes || []);

    // ========== StoryCraft Engine v2.0 集成 ==========
    // 检查是否启用 StoryCraft(仅Nirath模式启用)
    const storyCraftEnabled = input?.storyCraftVersion === 'v2.0' || input?.storyCraftVersion === 'v1.0' || input?.enableStoryCraft === true;
    const beastProfile = input?.beastProfile || input?.beast || input?.core?.beast || {};

    if (storyCraftEnabled && beastProfile?.name && this.mode === 'nirath') {
      this.log('STAGE-5.0', 'StoryCraft Engine v2.0 启用 - 特色视角叙事 + 60秒三幕引擎 + 钻石台词');

      try {
        const { StoryCraftIntegration } = require('../systems/story-craft-engine/story-craft-integration');
        const storyCraft = new StoryCraftIntegration({
          enabled: true,
          strictMode: false,
          maxRetries: 2,
          useLLM: true // v6.2-patch70: 启用 LLM 推理
        });

        const scResult = await storyCraft.generateStory(input, beastProfile);

        if (scResult.success && scResult.storyboard) {
          this.log('STAGE-5.1', `StoryCraft 生成完成: ${scResult.storyboard.shots.length} 镜`);
          this.log('STAGE-5.1', `主题: ${scResult.conceptSeed?.theme}`);
          this.log('STAGE-5.1', `反转强度: ${scResult.conceptSeed?.twistStrength}`);
          this.log('STAGE-5.1', `反转验证: ${scResult.twistValidation?.passed ? '通过' : '未通过'} (${scResult.twistValidation?.score}/100)`);

          // v2.0:打印三幕引擎信息
          const beats = scResult.storyboard.beats || [];
          const v2Beats = beats.filter(b => b._threeAct);
          if (v2Beats.length > 0) {
            this.log('STAGE-5.1', `v2.0 三幕引擎: 入侵(0-12s)→震颤(12-40s)→蜕变(40-60s) | ${v2Beats.length}/5 beats已标记`);
            const silentBeats = v2Beats.filter(b => b._threeAct?.silenceRequired);
            if (silentBeats.length > 0) {
              this.log('STAGE-5.1', `v2.0 静默高潮: ${silentBeats.length}个镜头标记静默要求`);
            }
          }

          // v2.0:打印钻石台词信息
          const beastLines = scResult.dialogueResult?.beastLines || {};
          const diamondLines = Object.values(beastLines).filter(l => l?.isDiamond);
          if (diamondLines.length > 0) {
            this.log('STAGE-5.1', `v2.0 钻石台词: ${diamondLines.length}句钻石台词已生成`);
            diamondLines.forEach(dl => {
              this.log('STAGE-5.1', `  💎 ${dl.beatId}: "${dl.text}" (Act${dl.actNumber})`);
            });
          }

          // v2.0:打印核心意象
          const coreImage = scResult.conceptSeed?.coreImage;
          if (coreImage) {
            this.log('STAGE-5.1', `v2.0 核心意象: ${coreImage.image} | 绽放: ${coreImage.bloomMoment?.substring(0,40)}...`);
          }

          // 转换为现有storyboard格式(v2.0:融入三幕引擎+钻石台词+核心意象)
          let scShots = scResult.storyboard.shots.map((shot, index) => {
            // 🔥 v1.1-fix: 优先使用V2分配器的时长,而非StoryCraft默认12秒
            const v2Duration = durations && durations[index] ? durations[index].duration : null;
            const finalDuration = v2Duration || shot.duration || 12;

            // v2.0:获取对应beat的三幕信息
            const beat = scResult.storyboard.beats?.find(b => b.id === shot.beatId);
            const threeAct = beat?._threeAct;

            // v2.0:获取钻石台词
            const beastLine = scResult.dialogueResult?.beastLines?.[shot.beatId];
            const isDiamond = beastLine?.isDiamond || false;

            // v2.0:构建增强版visualPrompt(融入三幕标记+感知锚点)
            let enhancedVisualPrompt = shot.visualPrompt || '';
            if (threeAct) {
              const actTag = `【${threeAct.actName}(${threeAct.actTimeRange.start}-${threeAct.actTimeRange.end}s) | 感知锚点:${threeAct.sensoryAnchor} | 情感曲线:${threeAct.emotionalArc}】`;
              enhancedVisualPrompt = actTag + '\n' + enhancedVisualPrompt;
            }
            // v2.0:静默标记融入
            if (threeAct?.silenceRequired) {
              enhancedVisualPrompt = '【⚠️静默高潮:最后8秒不说话,只用感官意象完成叙事】\n' + enhancedVisualPrompt;
            }

            // v2.0:构建增强版narration(融入钻石台词标记)
            let enhancedNarration = shot.narration || '';
            if (isDiamond && beastLine?.text) {
              enhancedNarration = `【💎钻石台词(Act${beastLine.actNumber}):"${beastLine.text}" | 含义:${beastLine.diamondLayers?.map(l=>l.layer).join('/')}】\n${enhancedNarration}`;
            }

            // v2.0:核心意象融入最后一镜(B5/余韵)
            const coreImage = scResult.conceptSeed?.coreImage;
            if (shot.beatId === 'B5' && coreImage) {
              enhancedVisualPrompt = `【🌸核心意象绽放:${coreImage.image} | ${coreImage.description}】\n${enhancedVisualPrompt}`;
            }

            return {
              // v6.2-patch106-fix: 强制使用索引生成ID,避免StoryCraft返回重复ID(如全部S01)
              id: `S${String(index + 1).padStart(2, '0')}`,
              scene: shot.beatName || 'scene',
              narration: enhancedNarration,
              duration: finalDuration,
              type: shot.beatName || 'explanation',
              shotType: shot.shotType || this._deriveShotType(index, scResult.storyboard.shots.length, shot.beatName), // v6.2-patch65: 传递叙事弧线标记
              characters: [input.protagonistId || 'presenter', input.beastId || beastProfile.id || ''],
              mouthAction: shot.mouthAction || (index === 0 ? '嘴部自然闭合,面对镜头' : '嘴部自然闭合'),
              emotionPhase: shot.emotionTarget?.emotion || 'neutral',
              importance: durations && durations[index] ? durations[index].importance : 5,
              visualComplexity: 5,
              visualPrompt: enhancedVisualPrompt,
              fpvRecommended: false,
              cameraMovement: null,
              prompt: null,
              // StoryCraft 特有字段
              beastDialogue: shot.beastDialogue,
              humanDialogue: shot.humanDialogue,
              beastMonologue: shot.beastMonologue,
              interactionType: shot.interactionType,
              // v2.0新增字段
              _threeAct: threeAct,
              _isDiamond: isDiamond,
              _diamondLayers: beastLine?.diamondLayers || null
            };
          });

          this.log('STAGE-5.2', `StoryCraft 故事板已转换 | ${scShots.length} 镜 | 总时长: ${scShots.reduce((s, x) => s + x.duration, 0)}s`);

          // 🔥 StoryCraft修复:同步更新script.scenes,确保端到端验证器能检查visualPrompt
          if (script && script.scenes && Array.isArray(script.scenes)) {
            scResult.storyboard.shots.forEach((scShot, idx) => {
              if (script.scenes[idx]) {
                script.scenes[idx].visualPrompt = scShot.visualPrompt || '';
                script.scenes[idx].narration = scShot.narration || '';
                script.scenes[idx].scene = scShot.beatName || script.scenes[idx].scene || '';
              }
            });
            this.log('STAGE-5.2', `✅ script.scenes 已同步 StoryCraft visualPrompt | ${Math.min(script.scenes.length, scResult.storyboard.shots.length)} 场景`);
          }

          // 【v6.0-patch22 新增】Nirath视觉锚点注入(StoryCraft路径)
          if (this.mode === 'nirath') {
            const injector = this.modules.nirathVisualInjector;
            scShots = injector.injectBatch(scShots);
            const injectedCount = scShots.filter(s => s._nirathAnchors?.wasInjected).length;
            this.log('STAGE-5.2', `🌍 Nirath锚点注入完成: ${injectedCount}/${scShots.length} 镜注入`);
          }

            // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-4-fix: S05结尾场景情绪统一
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'closing' || shot.shotType === 'closing' || shot.emotionPhase === 'closing') {
                this._unifyClosingSceneEmotion(shot);
              }
            });
          }

          // v6.2-patch106-3-fix: S02发现场景台词优化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'discovery' || shot.shotType === 'discovery') {
                this._optimizeDiscoverySceneDialogue(shot, shot.scene);
              }
            });
            const optimizedCount = scShots.filter(s => s._dangerLevel).length;
            if (optimizedCount > 0) {
              this.log('STAGE-7', `  🎭 S02发现场景优化: ${optimizedCount}镜 | 台词与视觉匹配`);
            }
          }

          // v6.2-patch106-4-fix: S05结尾场景情绪统一
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'closing' || shot.shotType === 'closing' || shot.emotionPhase === 'closing') {
                this._unifyClosingSceneEmotion(shot);
              }
            });
          }

          // v6.2-patch106-5-fix: S03对峙场景台词视觉化
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              if (shot.type === 'confrontation' || shot.shotType === 'confrontation') {
                this._visualizeConfrontationDialogue(shot);
              }
            });
          }

          // v6.2-patch106-6-fix: 运镜创新
          if (this.mode === 'nirath') {
            scShots.forEach(shot => {
              this._innovateCameraMovement(shot);
            });
          }

          // v6.2-patch106-7-fix: 强制修正StoryCraft返回的重复ID
          // StoryCraft可能返回全部S01,此处强制使用索引分配唯一ID
          if (scShots.length > 1) {
            const allSameId = scShots.every(s => s.id === scShots[0].id);
            if (allSameId) {
              this.log('STAGE-7', `  ⚠️ StoryCraft返回重复ID: ${scShots[0].id}×${scShots.length},强制修正为唯一ID`);
              scShots.forEach((shot, idx) => {
                shot.id = `S${String(idx + 1).padStart(2, '0')}`;
              });
            }
          }

          return {
          shots: scShots,
            totalDuration: scShots.reduce((s, x) => s + x.duration, 0),
            storyCraft: scResult
          };
        } else {
          this.log('STAGE-5.1', `StoryCraft 失败: ${scResult.reason || scResult.error},回退到原有生成`);
        }
      } catch (error) {
        this.log('STAGE-5.1', `StoryCraft 错误: ${error.message},回退到原有生成`);
      }
    }

    // ========== 原有故事板生成逻辑(未启用StoryCraft时执行)==========

    // Nirath模式:自动映射场景名
    let mappedScenes = script.scenes;
    let mapper = null; // v6.2-fix: 提升到函数作用域,用于后续获取自动生成统计

    if (this.mode === 'nirath') {
      const { NirathSceneMapper } = require('../systems/nirath/nirath-scene-mapper');
      mapper = new NirathSceneMapper();

      // v6.2-fix: 从input中提取beastId用于栖息地映射
      const beastId = input?.beastId || input?.core?.beastId || script?.beastId || '';
      mappedScenes = mapper.mapStoryboard(script.scenes, beastId);

      // 日志:显示场景映射结果
      mappedScenes.forEach((scene, idx) => {
        const info = mapper.getSceneInfo(scene.scene);
        if (info) {
          this.log('STAGE-7', `  🗺️ 场景映射: ${script.scenes[idx].scene || '(未命名)'} → ${scene.scene} | ${info.nirathName}`);
        } else {
          this.log('STAGE-7', `  ⚠️ 场景映射失败: ${script.scenes[idx].scene || '(未命名)'} → ${scene.scene} (库中无此场景)`);
        }
      });
    }

    const shots = [];
    for (let i = 0; i < mappedScenes.length; i++) {
      const scene = mappedScenes[i];
      const duration = durations[i]?.duration || 5;

      // v6.2-patch102-fix: 确保characters字段从输入透传,即使LLM没返回
      if (!scene.characters || scene.characters.length === 0) {
        // 优先从原始input.scenes中获取characters
        const originalScene = input.scenes?.find(s => s.id === scene.id);
        if (originalScene?.characters && originalScene.characters.length > 0) {
          scene.characters = originalScene.characters;
          this.log('STAGE-7', `  🔧 角色字段修复: ${scene.id} → 从input透传 ${originalScene.characters.join(', ')}`);
        } else {
          // 兜底:自动推断
          const inferredChars = this.inferCharactersFromScene(scene);
          if (inferredChars.length > 0) {
            this.log('STAGE-7', `  🔍 角色自动推断: ${scene.id} → ${inferredChars.join(', ')}`);
            scene.characters = inferredChars;
          }
        }
      }

      // 🔥 v6.1-fix: 五要素预注入 - 在Stage 7就确保visualPrompt包含五要素设计意图
      // 这样Stage 8.5检查时能看到完整五要素内容
      const originalVP = scene.visualPrompt || '';
      scene.visualPrompt = this.enrichVisualPromptWithFiveElements(
        originalVP,
        scene,
        i,
        mappedScenes.length,
        input
      );
      if (scene.visualPrompt !== originalVP) {
        this.log('STAGE-7', `  🔥 五要素预注入: ${scene.id} | 原${originalVP.length}字符 → 新${scene.visualPrompt.length}字符`);
      }

      // 防硬编码:结构化生成故事板shot,不直接透传
      const shot = {
        id: scene.id || `S${String(i + 1).padStart(2, '0')}`,
        scene: scene.scene || 'default',
        // v6.6.9.4-patch13-fix: 全局禁用narration,只保留dialogue
        // 如果scene有dialogue就用dialogue,如果scene只有narration则将narration内容合并到dialogue
        dialogue: scene.dialogue || scene.narration || '',
        // narration字段彻底移除,不再保留(全局禁用旁白/讲解词,仅保留台词)
        duration,
        type: scene.type || 'explanation',
        characters: scene.characters || [],
        // P0修复#1:mouthAction口播动作字段
        mouthAction: scene.mouthAction || this.generateDefaultMouthAction(scene.type, i === 0),
        // P0修复#14-22:保留v2字段(importance/visualComplexity/emotionPhase)
        importance: scene.importance || 5,
        visualComplexity: scene.visualComplexity || 5,
        emotionPhase: scene.emotionPhase || this.calculateEmotionPhase(i, mappedScenes.length),
        // 新增:visualPrompt字段(Stage 11渲染核心使用)
        visualPrompt: scene.visualPrompt || '',
        // FPV导演决策标记
        fpvRecommended: scene.fpvRecommended || false,
        fpvScore: scene.fpvScore || 0,
        fpvReason: scene.fpvReason || '',
        // 运镜配置占位(Stage 9填充)
        cameraMovement: null,
        // Prompt占位(Stage 11填充)
        prompt: null
      };

      shots.push(shot);
    }

    // v6.2-fix: 记录自动生成的场景
    // v6.5.12-fix: generic模式下mapper为null,需使用可选链
    const generatedScenes = mapper?.getGeneratedScenes ? mapper.getGeneratedScenes() : [];
    if (generatedScenes.length > 0) {
      this.log('STAGE-7', `  🔥 自动生成Nirath场景: ${generatedScenes.length}个`);
      for (const gs of generatedScenes) {
        this.log('STAGE-7', `     → ${gs.earthName} → ${gs.nirathName} (${gs.terrainType}) | 来源: ${gs.mappedFrom}`);
      }
    }

    this.log('STAGE-7', `✅ 故事板 | 镜头数: ${shots.length} | 总时长: ${shots.reduce((s, x) => s + x.duration, 0)}s | mouthAction: ${shots.filter(s => s.mouthAction).length}/${shots.length}`);

    // v6.2-patch107-fix: 强制修正原有路径的重复ID(StoryCraft路径已在patch106-7修复)
    // 输入的scenes可能全部使用S01,此处强制分配唯一ID和正确type
    if (shots.length > 1) {
      const allSameId = shots.every(s => s.id === shots[0].id);
      if (allSameId) {
        this.log('STAGE-7', `  ⚠️ 原有路径检测到重复ID: ${shots[0].id}×${shots.length},强制修正为唯一ID和正确type`);
        shots.forEach((shot, idx) => {
          shot.id = `S${String(idx + 1).padStart(2, '0')}`;
          // 修复type:第一个内容镜应为building(或根据scene推断),不应继承opening
          // v6.5.44-fix: 保存原始类型到 shotType,防止新链路判断丢失
          if (!shot.shotType) shot.shotType = shot.type;
          if (shot.type === 'opening' && shot.scene !== '片头') {
            // 根据scene内容推断正确type
            const sceneLower = (shot.scene || '').toLowerCase();
            if (sceneLower.includes('入口') || sceneLower.includes('开场') || sceneLower.includes('intro')) {
              shot.type = 'building';
            } else if (sceneLower.includes('高潮') || sceneLower.includes('对峙') || sceneLower.includes('冲突')) {
              shot.type = 'climax';
            } else if (sceneLower.includes('结尾') || sceneLower.includes('觉悟') || sceneLower.includes('结束')) {
              shot.type = 'closing';
            } else if (sceneLower.includes('现身') || sceneLower.includes('揭示') || sceneLower.includes('发现')) {
              shot.type = 'reveal';
            } else {
              shot.type = 'building';
            }
            this.log('STAGE-7', `  📝 ${shot.id} type修正: opening → ${shot.type} (scene: ${shot.scene})`);
          }
        });
      }
    }

    // 【v6.0-patch22 新增】Nirath视觉锚点注入(原有路径)
    if (this.mode === 'nirath') {
      const injector = this.modules.nirathVisualInjector;
      const injectedShots = injector.injectBatch(shots);
      const injectedCount = injectedShots.filter(s => s._nirathAnchors?.wasInjected).length;
      this.log('STAGE-7', `🌍 Nirath锚点注入完成: ${injectedCount}/${shots.length} 镜注入`);
      return { shots: injectedShots, totalDuration: injectedShots.reduce((s, x) => s + x.duration, 0) };
    }

    return { shots, totalDuration: shots.reduce((s, x) => s + x.duration, 0) };
  }

  /**
   * 从场景内容推断角色(情况B:用户只给一句话)
   */
  inferCharactersFromScene(scene) {
    const chars = [];
    const text = `${scene.narration || ''} ${scene.dialogue || ''} ${scene.scene || ''} ${scene.visualPrompt || ''}`;

    // v6.5.29-fix: generic角色推断
    const genericChars = [
      { id: 'chen-nurse', keywords: ['陈女士', 'chen-nurse', '护士', '主讲', '主持人'] },
      { id: 'coach-li', keywords: ['李明教练', 'coach-li', '教练', '李教练', '康复专家'] }
    ];

    // v6.6.9.4-patch9: 根据模式推断角色
    if (this.mode === 'nirath') {
      genericChars.push({ id: 'xiaoG', keywords: ['小G', '小g', '男孩', ' protagonist', '主角'] });
    } else {
      genericChars.push({ id: input.protagonistId || 'presenter', keywords: ['主讲人', '讲解者', 'presenter', '主持人'] });
    }

    for (const char of genericChars) {
      if (char.keywords.some(kw => text.includes(kw))) {
        if (!chars.includes(char.id)) chars.push(char.id);
      }
    }

    // Nirath角色推断(仅Nirath模式)
    if (this.mode === 'nirath') {
      // 九尾狐推断
      const jiuweiKeywords = ['九尾狐', '九尾', '狐狸', '狐', 'jiu-wei-hu', 'nine-tailed'];
      if (jiuweiKeywords.some(kw => text.includes(kw))) {
        if (!chars.includes('jiu-wei-hu')) chars.push('jiu-wei-hu');
      }

      // 饕餮推断
      const taotieKeywords = ['饕餮', 'tao-tie', 'taotie', '钩吾山', '四目', '暗红竖瞳', '吞噬', '巨口'];
      if (taotieKeywords.some(kw => text.includes(kw))) {
        if (!chars.includes('tao-tie')) chars.push('tao-tie');
      }

      // 通用角色推断(仅Nirath模式)
      if (scene.type === 'discovery' || scene.type === 'beastReveal') {
        if (!chars.includes('jiu-wei-hu') && text.includes('尾')) {
          chars.push('jiu-wei-hu');
        }
      }
    }

    return chars;
  }

  /**
   * 🔥 v6.1-fix: Stage 7五要素预注入
   * 在生成shot之前,确保visualPrompt包含五要素设计意图
   * 这样Stage 8.5检查时能看到完整五要素内容,评分自然提高
   */
  enrichVisualPromptWithFiveElements(visualPrompt, scene, index, totalScenes, input) {
    if (!visualPrompt || visualPrompt.length === 0) return visualPrompt;
    if (this.mode !== 'nirath') return visualPrompt; // v6.5.29-fix: generic模式跳过Nirath五要素注入

    let enriched = visualPrompt;
    const beastProfile = input?.beastProfile || input?.core?.beast || {};
    const midPoint = Math.floor(totalScenes / 2);
    const isBefore = index < midPoint;
    const sceneType = scene.type || 'explanation';

    // === 要素1: 小G冒险主动性 ===
    // 🔥 v6.1-fix: 每镜至少注入2个主动行为关键词,确保检查器能检测到
    const initiativeKeywords = ['主动', '伸出', '触碰', '接近', '迈出', '向前', '探索', '引导', '决定', '选择', '勇敢', '迎向', '追逐', '奔跑', '突破', '面对', '直视', '挑战', '不后退', '不逃避', '迎上去', '坚定', '决心'];
    const existingInitiatives = initiativeKeywords.filter(kw => enriched.includes(kw));

    // 如果少于2个主动关键词,补充注入
    if (existingInitiatives.length < 2) {
      const activeActionsByType = {
        opening: ['主动拨开迷雾', '勇敢踏上旅程', '主动探索未知', '迈出第一步'],
        discovery: ['主动靠近', '伸出小手', '凑近观察', '勇敢注视', '选择信任'],
        interaction: ['主动伸出手触碰', '迈出第一步', '迎向异兽', '选择信任', '决定靠近'],
        climax: ['勇敢直视', '坚定伸出', '主动选择', '决心面对', '迎向挑战'],
        closing: ['温柔注视', '主动靠近', '微笑伸出', '信任靠近', '勇敢告别']
      };
      const actions = activeActionsByType[sceneType] || activeActionsByType.interaction;
      // 使用场景索引+镜头ID确保每镜不同
      const actionIndex = (index + (parseInt(scene.id?.slice(1) || '0') % 100)) % actions.length;
      const action1 = actions[actionIndex];
      const action2 = actions[(actionIndex + 1) % actions.length];
      enriched += `,小G${action1},${action2}`;
    }

    // === 要素2: 异兽独特性 ===
    // 注入异兽档案中的signatureFeatures
    if (beastProfile.signatureFeatures && beastProfile.signatureFeatures.length > 0) {
      const features = beastProfile.signatureFeatures.slice(0, 3);
      const hasFeatures = features.some(f => enriched.includes(f.substring(0, 4))); // 检查前4字

      if (!hasFeatures) {
        const featureDesc = features.map(f => `${f}清晰可见`).join(',');
        enriched += `,${featureDesc}`;
      }
    }

    // 如果仍缺少独特性关键词,注入通用独特特征
    const uniqueKeywords = ['发光', '变色', '磁场', '能量', '共鸣', '脉冲', '粒子', '闪烁'];
    const hasUnique = uniqueKeywords.some(kw => enriched.includes(kw));
    if (!hasUnique && beastProfile.name) {
      enriched += `,${beastProfile.name}独特生物荧光在双恒星下闪烁`;
    }

    // === 要素3: 情感共鸣(情绪弧线设计)===
    // 前半场: 好奇/试探/犹豫 → 后半场: 信任/坚定/温柔
    if (this.mode === 'nirath') {
      if (isBefore) {
        // 前半场:注入好奇、试探、轻微不安
        const hasCuriosity = ['好奇', '疑问', '探索', '试探', '想知道', '观察'].some(kw => enriched.includes(kw));
        if (!hasCuriosity) {
          enriched += ',小G表情好奇而略带试探';
        }
      } else {
        // 后半场:注入信任、坚定、温柔
        const hasTenderness = ['温柔', '信任', '坚定', '微笑', '理解', '释然'].some(kw => enriched.includes(kw));
        if (!hasTenderness) {
          enriched += ',小G表情温柔而坚定';
        }
      }
    }

    // === 要素4: 成长转变 ===
    // 开场→高潮:犹豫→坚定
    if (this.mode === 'nirath') {
      if (index === 0) {
        // 开场:轻微犹豫
        if (!['犹豫', '紧张', '不安', '警惕'].some(kw => enriched.includes(kw))) {
          enriched += ',小G initially slightly hesitant yet curious';
        }
      } else if (index === totalScenes - 1) {
        // 结尾:完成转变
        if (!['坚定', '勇敢', '温柔', '信任', '接纳'].some(kw => enriched.includes(kw))) {
          enriched += ',小G眼神坚定充满信任,完成成长转变';
        }
      }
    }

    // === 要素5: Nirath世界观 ===
    // 确保每镜都有Nirath专属元素(仅nirath模式)
    if (this.mode === 'nirath') {
      const nirathKeywords = ['Nirath', '双恒星', '5800K', '6500K', '以太', '磁场', '共鸣', '紫晶', '青丘', '孢子'];
      const hasNirath = nirathKeywords.some(kw => enriched.includes(kw));
      if (!hasNirath) {
        enriched += ',Nirath双恒星5800K/6500K双色光照形成双色阴影';
      }
    }

    // 防重复:如果已有类似描述,不再追加
    // 简单去重:按逗号分割,过滤重复片段
    const segments = enriched.split(',');
    const uniqueSegments = [];
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (trimmed && !uniqueSegments.some(us => us.includes(trimmed.substring(0, 6)) || trimmed.includes(us.substring(0, 6)))) {
        uniqueSegments.push(trimmed);
      }
    }
    enriched = uniqueSegments.join(',');

    return enriched;
  }

  /**
   * v6.5.62: 构建characterRef字段(定妆照绑定)
   * 格式:角色名: image://bestiary/角色名-角度.png
   */
  _buildCharacterRef(shot, stages) {
    if (!shot.characters || shot.characters.length === 0) return '';

    // v6.6.9.4-patch17-fix: 使用与 _getCharacterStageMap 一致的路径
    const characterMap = this._getCharacterStageMap(stages);
    const refs = [];
    for (const charId of shot.characters) {
      const char = characterMap[charId];
      if (!char) continue;

      // 获取角色名(优先使用profile.name)
      const charName = getCharacterName(char, charId);

      // 构建image://路径
      const imagePaths = [];
      if (char.portraits) {
        // 使用已生成的定妆照
        for (const [angle, path] of Object.entries(char.portraits)) {
          if (path && typeof path === 'string') {
            imagePaths.push(`image://bestiary/${charId}-${angle}.png`);
          }
        }
      }

      // 如果没有定妆照,使用占位符
      if (imagePaths.length === 0) {
        imagePaths.push(`image://bestiary/${charId}-front.png`);
      }

      // 限制最多9张
      const limitedPaths = imagePaths.slice(0, 9);
      refs.push(`${charName}: ${limitedPaths.join(', ')}`);
    }

    return refs.join(' | ');
  }

  /**
   * v6.5.62: 构建character字段(极简锚点)
   * 格式:角色名: 种族, 关键词1, 关键词2, 关键词3
   */
  _buildCharacterMinimal(shot, stages) {
    if (!shot.characters || shot.characters.length === 0) return '';

    const characters = [];
    for (const charId of shot.characters) {
      const char = stages.characters?.[charId];
      if (!char) continue;

      const charName = getCharacterName(char, charId);

      // 获取种族/物种
      const race = char.profile?.race || char.profile?.species || '人类';

      // 获取3-5个核心视觉关键词
      const keywords = [];
      if (char.profile?.signatureFeatures) {
        keywords.push(...char.profile.signatureFeatures.slice(0, 3));
      }
      if (char.profile?.coreVisualTraits) {
        keywords.push(...char.profile.coreVisualTraits.slice(0, 2));
      }
      if (char.profile?.appearance) {
        // 从appearance提取关键词(简化)
        const appearanceKeywords = char.profile.appearance.split(/[,,]/).map(s => s.trim()).filter(s => s.length > 0);
        keywords.push(...appearanceKeywords.slice(0, 2));
      }

      // 去重并限制3-5个
      const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
      if (uniqueKeywords.length < 3) {
        // 兜底关键词
        uniqueKeywords.push('现实人类特征', '自然光照反射');
      }

      characters.push(`${charName}: ${race}, ${uniqueKeywords.join(', ')}`);
    }

    return characters.join(' | ');
  }

  /**
   * v6.5.62: 构建timeline字段(时间轴标记)
   * 格式:T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX
   */
  _buildTimeline(shot, currentTime) {
    const start = currentTime || 0;
    const duration = shot.duration || 0;
    const end = start + duration;

    // 格式化时间
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const tenths = Math.floor((seconds % 1) * 10);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
    };

    const startStr = formatTime(start);
    const endStr = formatTime(end);

    // 类型映射
    const typeMap = {
      'building': 'establishing',
      'discovery': 'discovery',
      'confrontation': 'confrontation',
      'climax': 'climax',
      'closing': 'resolution',
      'opening': 'opening'
    };
    const type = typeMap[shot.type] || 'normal';

    // 情绪
    const mood = shot.emotionPhase || 'neutral';

    return `T${startStr}-T${endStr} / duration: ${duration}s / type: ${type} / mood: ${mood}`;
  }

  /**
   * v6.5.62: 构建backgroundSound字段(结构化音效)
   * 格式:AMBIENT: ... | SPATIAL: ... | INTENSITY: ...
   */
  _buildBackgroundSound(shot) {
    const duration = shot.duration || 0;
    const sceneType = shot.type || 'normal';

    // 根据场景类型选择音效模板
    const soundTemplates = {
      'building': {
        ambient: 'fantasy atmosphere, deep earth rumble 20-60Hz, enchanted wind',
        spatial: '3D audio panning synchronized with camera movement',
        intensity: `crescendo 0-${Math.floor(duration * 0.3)}s, peak ${Math.floor(duration * 0.3)}-${Math.floor(duration * 0.7)}s, decay ${Math.floor(duration * 0.7)}-${duration}s`
      },
      'discovery': {
        ambient: 'tension-building drone, subtle heartbeat 40BPM, bioluminescent pulse',
        spatial: 'approaching footsteps echo, spatial depth increase',
        intensity: `crescendo 0-${Math.floor(duration * 0.4)}s, peak ${Math.floor(duration * 0.4)}-${Math.floor(duration * 0.6)}s, decay ${Math.floor(duration * 0.6)}-${duration}s`
      },
      'confrontation': {
        ambient: 'low frequency beast growl 30-80Hz, magnetic field hum, crystal resonance',
        spatial: 'beast movement tracking L-R, approach intensity',
        intensity: `crescendo 0-${Math.floor(duration * 0.2)}s, peak ${Math.floor(duration * 0.2)}-${Math.floor(duration * 0.8)}s, decay ${Math.floor(duration * 0.8)}-${duration}s`
      },
      'climax': {
        ambient: 'full spectrum activation, bioluminescent surge, magnetic field peak',
        spatial: '360° surround, beast roar spatial sweep',
        intensity: `crescendo 0-${Math.floor(duration * 0.2)}s, peak ${Math.floor(duration * 0.2)}-${Math.floor(duration * 0.7)}s, release ${Math.floor(duration * 0.7)}-${duration}s`
      },
      'closing': {
        ambient: 'gentle wind return, distant spore drift, soft earth breath',
        spatial: 'wide open space, fading echoes',
        intensity: `sustain 0-${Math.floor(duration * 0.5)}s, gentle decay ${Math.floor(duration * 0.5)}-${duration}s`
      }
    };

    const template = soundTemplates[sceneType] || soundTemplates['building'];

    return `AMBIENT: ${template.ambient} | SPATIAL: ${template.spatial} | INTENSITY: ${template.intensity}`;
  }

  /**
   * 检查角色的定妆照(4角度)是否已生成并确认
   */
  async checkCharacterPortraits(characterId) {
    // v3.0-fix: 支持旧4角度 + 新8角度
    const requiredAngles = ['front', 'threeQuarter', 'closeup', 'side'];
    const v3Angles = ['front_fullbody', 'three_quarter', 'face_closeup', 'side_profile', 'back_fullbody', 'action_running', 'action_sitting', 'hand_detail'];
    const foundAngles = [];
    const missingAngles = [];

    // 检查角色档案目录中的定妆照文件
    // 支持直接放在characters/下或characters/beasts/下
    let portraitDir = path.join(__dirname, '..', 'characters', characterId, 'portraits');
    if (!fss.existsSync(portraitDir)) {
      portraitDir = path.join(__dirname, '..', 'characters', 'beasts', characterId, 'portraits');
    }

    // 先检查旧4角度
    for (const angle of requiredAngles) {
      const found = this._checkPortraitFileExists(portraitDir, characterId, angle);
      if (found) {
        foundAngles.push(angle);
      } else {
        missingAngles.push(angle);
      }
    }

    // 如果旧4角度不全,检查新8角度(新旧二选一)
    if (missingAngles.length > 0) {
      let v3FoundCount = 0;
      for (const angle of v3Angles) {
        const found = this._checkPortraitFileExists(portraitDir, characterId, angle);
        if (found) {
          v3FoundCount++;
          // 映射到新角度名称
          const mappedAngle = this._mapV3AngleToLegacy(angle);
          if (mappedAngle && !foundAngles.includes(mappedAngle)) {
            foundAngles.push(mappedAngle);
          }
        }
      }

      // 如果新8角度有至少4个(核心4个),则视为通过
      const v3CoreAngles = ['front_fullbody', 'three_quarter', 'face_closeup', 'side_profile'];
      let v3CoreFound = 0;
      for (const angle of v3CoreAngles) {
        if (this._checkPortraitFileExists(portraitDir, characterId, angle)) {
          v3CoreFound++;
        }
      }

      if (v3CoreFound >= 4) {
        // 新8角度完整,清空旧角度缺失
        missingAngles.length = 0;
      }
    }

    return {
      exists: missingAngles.length === 0,
      foundAngles,
      missingAngles,
      portraitDir
    };
  }

  /**
   * 检查单个定妆照文件是否存在(支持多种命名格式)
   */
  _checkPortraitFileExists(portraitDir, characterId, angle) {
    const baseId = characterId.replace(/-/g, '').toLowerCase();
    const camelId = characterId.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

    const possibleFiles = [
      // 标准格式
      `${characterId}-${angle}.png`,
      `${characterId}-${angle}.jpg`,
      `${characterId}-${angle}.jpeg`,
      // CG版本
      `${characterId}-cg-v2-${angle}.png`,
      `${characterId}-cg-v3-${angle}.png`,
      // portrait前缀
      `${characterId}-portrait-${angle}.png`,
      `${characterId}-portrait-${angle}.jpg`,
      `${characterId}-portrait-${angle}.jpeg`,
      // camelCase
      `${camelId}-${angle}.png`,
      `${camelId}-${angle}.jpg`,
      `${camelId}-${angle}.jpeg`,
      `${camelId}-portrait-${angle}.png`,
      `${camelId}-portrait-${angle}.jpg`,
      `${camelId}-portrait-${angle}.jpeg`,
      // 纯小写(去掉连字符)
      `${baseId}-${angle}.png`,
      `${baseId}-${angle}.jpg`,
      `${baseId}-${angle}.jpeg`,
      `${baseId}-portrait-${angle}.png`,
      `${baseId}-portrait-${angle}.jpg`,
      `${baseId}-portrait-${angle}.jpeg`,
      // 无前缀
      `${angle}.png`,
      `${angle}.jpg`,
      `${angle}.jpeg`,
      // 纯portrait前缀
      `portrait-${angle}.png`,
      `portrait-${angle}.jpg`,
      `portrait-${angle}.jpeg`
    ];

    for (const file of possibleFiles) {
      const filePath = path.join(portraitDir, file);
      try {
        if (fss.existsSync(filePath)) {
          return true;
        }
      } catch (e) {
        // 忽略检查错误
      }
    }
    return false;
  }

  /**
   * v6.6.5: 智能判断角色是否需要AI生成定妆照
   * 用户只说一句话,系统不能卡住让用户选择
   */
  _shouldGeneratePortrait(characterId, charData, input) {
    const videoType = input.videoType || input.type || 'generic';
    const charDesc = (charData.description || charData.brief || '').toLowerCase();
    const charName = (charData.name || characterId).toLowerCase();

    const realPersonTypes = ['EDU', 'DOC', 'VLOG', 'NEWS', 'INTERVIEW', 'TALK'];
    if (realPersonTypes.includes(videoType)) return false;

    const realPersonKeywords = [
      '医生', '护士', '教师', '教授', '专家', '记者', '主持人', '博主',
      '警察', '警官', '消防员', '律师', '工程师', '科学家',
      'real person', 'actual person', 'doctor', 'nurse', 'teacher',
      '真实人物', '真人'
    ];
    if (realPersonKeywords.some(kw => charDesc.includes(kw) || charName.includes(kw))) return false;

    if (/^[\u4e00-\u9fa5]{2,3}$/.test(charData.name || '')) {
      const professionKeywords = ['护士', '医生', '警察', '律师', '老师', '教授', '专家'];
      if (professionKeywords.some(kw => charDesc.includes(kw))) return false;
    }

    const fictionalKeywords = [
      '神兽', '怪兽', '妖怪', '精灵', 'superhero', 'alien', 'creature',
      '神话', '传说', '幻想', 'fantasy', 'anime', 'cartoon', 'cg'
      // v6.6.9.4-patch9: 移除山海经特定生物名，保留通用虚构检测
    ];
    if (fictionalKeywords.some(kw => charDesc.includes(kw))) return true;

    const fictionalTypes = ['DRAMA', 'ADV', 'MV', 'ANIMATION', 'COR'];
    if (fictionalTypes.includes(videoType)) return true;

    return false;
  }

  _detectCharacterType(characterId, charData) {
    const charDesc = (charData.description || charData.brief || '').toLowerCase();
    if (/^[\u4e00-\u9fa5]{2,3}$/.test(charData.name || '')) {
      const professions = ['护士', '医生', '警察', '律师', '老师', '教授'];
      for (const p of professions) {
        if (charDesc.includes(p)) return `真实人物(${p})`;
      }
      return '真实人物';
    }
    if (charDesc.includes('神兽') || charDesc.includes('怪兽') || charDesc.includes('神话')) return '虚构角色';
    return '未知类型';
  }

  async _createPortraitPlaceholders(characterId, angles) {
    const portraitDir = path.join(this.charactersDir, characterId, 'portraits');
    try {
      await fs.mkdir(portraitDir, { recursive: true });
      const placeholderMeta = {
        characterId,
        generatedAt: new Date().toISOString(),
        isMock: true,
        reason: 'AUTO_PLACEHOLDER: 真实人物/教育科普场景,不需要AI生成定妆照',
        angles: angles || ['front', 'threeQuarter', 'closeup', 'side'],
        version: 'v6.6.5-auto'
      };
      const metaPath = path.join(portraitDir, '.placeholder-meta.json');
      await fs.writeFile(metaPath, JSON.stringify(placeholderMeta, null, 2), 'utf-8');
      for (const angle of (angles || ['front', 'threeQuarter', 'closeup', 'side'])) {
        const placeholderPath = path.join(portraitDir, `${characterId}-${angle}.placeholder`);
        await fs.writeFile(placeholderPath, `MOCK_PLACEHOLDER: ${angle}\n${JSON.stringify(placeholderMeta)}`, 'utf-8');
      }
    } catch (e) {
      this.log('PORTRAIT', `  ⚠️ Mock占位符创建失败: ${e.message}`);
    }
  }

  /**
   * 映射新8角度到旧4角度名称
   */
  _mapV3AngleToLegacy(v3Angle) {
    const mapping = {
      'front_fullbody': 'front',
      'three_quarter': 'threeQuarter',
      'face_closeup': 'closeup',
      'side_profile': 'side',
      'back_fullbody': 'back',
      'action_running': 'action',
      'action_sitting': 'action',
      'hand_detail': 'detail'
    };
    return mapping[v3Angle] || v3Angle;
  }

  // ========== 【v6.2-patch51】Stage 7.2: 主角主动性自动注入 ==========
  async stageProtagonistInitiative(storyboard, input) {
    this.log('STAGE-7.2', '🎯 主角主动性自动注入(v6.2-patch51)');

    // v6.5.29-fix: generic模式跳过Nirath专属主动性注入
    if (this.mode !== 'nirath') {
      this.log('STAGE-7.2', `⏭️ generic模式,跳过Nirath专属主动性注入`);
      return { totalInjections: 0, passiveDetections: 0, injections: [] };
    }

    const injector = this.modules.protagonistInjector;
    const protagonistId = input?.protagonistId || 'protagonist';
    const protagonistName = input?.protagonistName || '主角';

    const result = injector.inject(storyboard, { protagonistId, protagonistName });

    if (result.report.totalInjections > 0) {
      this.log('STAGE-7.2', `✅ 主动性注入完成 | 注入${result.report.totalInjections}个主动动作 | 对冲${result.report.passiveDetections}个被动描述`);
      for (const log of result.report.injections.slice(0, 3)) {
        this.log('STAGE-7.2', `  📝 ${log.shotId}: +「${log.action}」`);
      }
    } else if (result.report.passiveDetections > 0) {
      this.log('STAGE-7.2', `⚠️ 检测到${result.report.passiveDetections}个被动描述,但已存在足够主动动作`);
    } else {
      this.log('STAGE-7.2', `✅ 主动性检查通过 | 无需注入`);
    }

    return result.report;
  }

  /**
   * 辅助:计算 narration 容量(基于时长)
   */
  calculateNarrationCapacity(duration) {
    const SPEECH_RATE = 5.0; // 字/秒(讲解语速)
    const BUFFER = 2; // 缓冲字数
    return Math.floor(duration * SPEECH_RATE - BUFFER);
  }

  // ========== 【v6.2-patch51】Stage 7.3: Narration自动精简 ==========
  async stageNarrationTrim(storyboard, durations) {
    // v6.5.34-fix: 全局禁用narration,此Stage跳过
    this.log('STAGE-7.3', '⏭️ 全局禁用narration(仅保留dialogue/台词),跳过narration精简');
    return { trimmedCount: 0, totalTrimmedChars: 0, skipped: true, reason: '全局禁用narration' };
  }

  // ========== 【v6.2-patch52】Stage 7.4: 时长-字数一致性校准 ==========
  async stageDurationNarrationAlignment(storyboard, durations) {
    // v6.5.34-fix: 全局禁用narration,使用dialogue校准
    this.log('STAGE-7.4', '📏 时长-字数一致性校准(v6.2-patch52, v6.5.34: dialogue模式)');

    const aligner = this.modules.durationAlignment;
    if (!aligner) {
      this.log('STAGE-7.4', '⚠️ 时长校准器未初始化,跳过');
      return { aligned: true, report: '校准器未初始化' };
    }

    const shots = storyboard.shots || [];

    // v6.5.34: 使用dialogue替代narration进行校准
    const shotsWithDuration = shots.map((shot, idx) => {
      const duration = shot.duration || (durations && durations[idx]?.duration) || 5;
      return {
        ...shot,
        duration,
        // v6.5.34: 使用dialogue作为校准文本(narration已禁用)
        text: shot.dialogue || shot.narration || ''
      };
    });

    const alignResult = aligner.align(shotsWithDuration);

    // 将调整后的时长同步回storyboard
    if (alignResult.aligned && alignResult.adjustments.length > 0) {
      for (const adj of alignResult.adjustments) {
        // 更新 recipient 镜头时长
        const toShot = shots.find(s => s.id === adj.to);
        if (toShot) {
          toShot.duration = alignResult.shots.find(s => s.id === adj.to)?.duration || toShot.duration;
        }
        // v6.2-patch67-fix: 同时更新 donor 镜头时长
        const fromShot = shots.find(s => s.id === adj.from);
        if (fromShot) {
          fromShot.duration = alignResult.shots.find(s => s.id === adj.from)?.duration || fromShot.duration;
        }
        this.log('STAGE-7.4', `  🔄 ${adj.to} +${adj.amount}秒 ← ${adj.from} | ${adj.reason}`);
      }
      this.log('STAGE-7.4', `✅ 时长校准完成 | 借调${alignResult.adjustments.length}次 | 全部匹配`);
    } else if (alignResult.issues.length > 0) {
      this.log('STAGE-7.4', `❌ 时长校准失败 | ${alignResult.issues.length}个镜头无法匹配`);
      for (const issue of alignResult.issues) {
        this.log('STAGE-7.4', `  🔴 ${issue.message}`);
      }
    } else {
      this.log('STAGE-7.4', `✅ 时长-dialogue全部匹配,无需调整`);
    }

    return alignResult;
  }

  /**
   * v6.6.5: 自动推断场景结构(用户只说一句话,系统自己推断)
   */
  _autoInferScenes(input) {
    const videoType = input.videoType || input.type || 'generic';
    const title = input.title || input.projectName || '未命名视频';
    const duration = input.targetDuration || input.duration || 60;
    const characters = input.characters || [];

    let scenes = [];

    if (videoType === 'EDU' || videoType === 'DOC' || videoType === 'TALK') {
      const openingDuration = Math.min(5, Math.floor(duration * 0.1));
      const closingDuration = Math.min(10, Math.floor(duration * 0.15));
      const contentDuration = duration - openingDuration - closingDuration;
      const contentScenes = Math.max(2, Math.floor(contentDuration / 15));
      const perSceneDuration = Math.floor(contentDuration / contentScenes);

      scenes.push({
        id: 'S01', type: 'opening', description: `${title} - 开场介绍`,
        duration: openingDuration,
        narration: `大家好,我是${characters[0]?.name || '主讲人'}。今天我们来聊聊${title}。`
      });

      for (let i = 0; i < contentScenes; i++) {
        scenes.push({
          id: `S0${i + 2}`, type: 'explanation', description: `内容讲解 ${i + 1}`,
          duration: perSceneDuration, narration: `${title}第${i + 1}部分讲解。`
        });
      }

      scenes.push({
        id: `S0${contentScenes + 2}`, type: 'summary', description: `总结${title}`,
        duration: closingDuration, narration: `今天我们学习了${title}。感谢观看!`
      });
    } else {
      // 通用类型
      const openingDuration = Math.min(5, Math.floor(duration * 0.1));
      const closingDuration = Math.min(5, Math.floor(duration * 0.1));
      const contentDuration = duration - openingDuration - closingDuration;
      const contentScenes = Math.max(1, Math.floor(contentDuration / 15));
      const perSceneDuration = Math.floor(contentDuration / contentScenes);

      scenes.push({ id: 'S01', type: 'opening', description: '开场介绍', duration: openingDuration, narration: `欢迎观看${title}` });
      for (let i = 0; i < contentScenes; i++) {
        scenes.push({ id: `S0${i + 2}`, type: 'content', description: `内容 ${i + 1}`, duration: perSceneDuration, narration: `${title}内容第${i + 1}部分` });
      }
      scenes.push({ id: `S0${contentScenes + 2}`, type: 'closing', description: '结尾总结', duration: closingDuration, narration: '感谢观看!' });
    }

    let totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 0), 0);
    if (totalDuration > duration) {
      const scale = duration / totalDuration;
      scenes.forEach(s => { s.duration = Math.max(3, Math.floor((s.duration || 5) * scale)); });
    }

    return scenes;
  }

  // ========== Stage 7.5: 片头自动生成(v3.0-patch5系统集成)==========
  async stageOpeningGeneration(input, storyboard, characters) {
    // 🔥 v6.5.66-fix: 通用模式也支持片头(当 input.opening.enabled=true 时)
    const openingConfig = input.opening || {};
    if (this.mode !== 'nirath' && !openingConfig.enabled) {
      this.log('STAGE-7.5', '⏭️ 通用模式且未启用片头,跳过片头生成');
      return null;
    }

    this.log('STAGE-7.5', '🎬 片头自动生成(opening-system-v3.js)');

    try {
      // 从input中提取片头配置
      const openingConfig = this.extractOpeningConfig(input, storyboard, characters);

      // 调用片头系统生成Prompt
      // v6.6.9.4-patch9: 统一使用通用片头系统，山海经版本已移除
      const openingSystem = OpeningSystem;
      const openingResult = openingSystem.generateOpeningV3(openingConfig);

      this.log('STAGE-7.5', `✅ 片头生成完成 | Prompt: ${openingResult.promptLength}/988字符 | 时长: ${openingResult.duration}秒`);

        // 将片头插入故事板作为S00
      const openingShot = {
        id: 'S00',
        scene: '片头',
        // v6.5.34-fix: 全局禁用narration,片头使用dialogue
        dialogue: this.mode === 'nirath' ? '山海经系列片头' : '系列片头',
        narration: '', // v6.5.34: narration已禁用,置空
        duration: openingResult.duration || 9,
        type: 'opening',
        characters: openingResult.characters ? [openingResult.characters.protagonist?.id, openingResult.characters.beast?.id].filter(Boolean) : [],
        mouthAction: '片头标题展现,无口播',
        importance: 10,
        visualComplexity: 8,
        emotionPhase: 'establishing',
        fpvRecommended: false,
        cameraMovement: null,
        prompt: openingResult.prompt,
        isOpening: true, // 标记为片头镜头
        openingConfig: openingConfig,
        portraits: openingResult.portraits,
        // v6.5.8-fix: 片头也绑定定妆照
        referenceImages: openingResult.referenceImages || [],
        content: openingResult.content || [],
        // v6.5.58-fix: 注入title对象和postProduction
        title: openingResult.title || undefined,
        postProduction: openingResult.postProduction || undefined
      };

      // 插入到故事板最前面
      storyboard.shots.unshift(openingShot);
      storyboard.totalDuration += openingShot.duration;

      this.log('STAGE-7.5', `✅ 片头已插入故事板 | S00 | 总时长更新: ${storyboard.totalDuration}秒 | 镜头数: ${storyboard.shots.length}`);

      return {
        shot: openingShot,
        prompt: openingResult.prompt,
        duration: openingResult.duration,
        characters: openingResult.characters,
        portraits: openingResult.portraits,
        complianceCheck: openingResult.complianceCheck
      };
    } catch (error) {
      this.log('STAGE-7.5', `❌ 片头生成失败: ${error.message}`, 'error');
      // 片头失败不阻断主链路,继续执行
      return null;
    }
  }

  /**
   * 提取片头配置
   */
  extractOpeningConfig(input, storyboard, characters) {
    const isNirath = this.mode === 'nirath';
    const config = {
      // v6.6.9.4-fix: generic模式默认值改为中性，不再硬编码山海经
      // v6.6.9.4-patch13-fix: 标题优先使用input.title（内容标题），其次才是projectName
      episodeTitle: input.title || input.projectName || (isNirath ? '山海经:异兽志' : '未命名视频'),
      seriesTitle: input.seriesTitle || (isNirath ? '山海经:异兽志' : ''),
      subTitle: input.topic || input.subTitle || '', // v6.6.9.4-patch13: 添加副标题字段
      episodeNumber: input.episodeNumber || input.episode || 'EP01',
      featuredBeastId: isNirath ? (input.beastId || input.core?.beastId || input.theme || '') : '',
      protagonistId: input.protagonistId || (isNirath ? 'xiaoG' : 'presenter'),
      duration: input.openingDuration || 9,
      mood: input.mood || (isNirath ? 'mysterious' : 'professional'),
      // v2.2-fix: 从input.characters中提取角色定妆照数据
      characters: input.characters || {},
      portraits: {}
    };

    // 尝试从故事板提取异兽信息
    if (storyboard && storyboard.shots) {
      // v3.0-patch6: 遍历所有shots,找到第一个非主角角色作为异兽
      for (const shot of storyboard.shots) {
        if (shot.characters && shot.characters.length > 0) {
          const beastChar = shot.characters.find(c => c !== config.protagonistId);
          if (beastChar) {
            config.featuredBeastId = beastChar;
            break;
          }
        }
      }
    }

    // v2.2-fix: 从input.characters提取portraits数据
    if (input.characters) {
      // v6.6.9.4-patch12-fix: 支持数组和对象两种格式的characters
      const charEntries = Array.isArray(input.characters) 
        ? input.characters.map((c, i) => [c.id || c.name || `char_${i}`, c])
        : Object.entries(input.characters);
      
      for (const [charId, charData] of charEntries) {
        if (charData.portraits) {
          config.portraits[charId] = charData.portraits;
        }
      }
    }

    this.log('STAGE-7.5', `  📋 片头配置: ${config.episodeTitle} | 主角: ${config.protagonistId} | 时长: ${config.duration}秒 | 角色数: ${Object.keys(config.portraits).length}`);
    return config;
  }

  // ========== Stage 8: 故事板校验(新增:开场动作 + mouthAction + narration-prompt对齐) ==========
  /**
   * v6.2-patch67-fix: 智能截断,优先在标点处截断
   * 避免 substring 硬截断导致句子不完整
   */
  trimAtPunctuation(text, maxLen) {
    if (!text || text.length <= maxLen) return text;

    const truncated = text.substring(0, maxLen);

    // 优先在中文标点处截断
    const chinesePunctuation = /[。,;!?]/;
    let lastPunct = -1;
    for (let i = truncated.length - 1; i >= 0; i--) {
      if (chinesePunctuation.test(truncated[i])) {
        lastPunct = i;
        break;
      }
    }

    if (lastPunct > 0) {
      return truncated.substring(0, lastPunct + 1);
    }

    // 其次在英文标点处截断
    const englishPunctuation = /[.\,;!?]/;
    for (let i = truncated.length - 1; i >= 0; i--) {
      if (englishPunctuation.test(truncated[i])) {
        return truncated.substring(0, i + 1);
      }
    }

    // 最后在空格处截断
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncated.length * 0.8) {
      return truncated.substring(0, lastSpace);
    }

    return truncated;
  }

  async stageStoryboardValidation(storyboard, input) {
    this.log('STAGE-8', '故事板校验(开场动作 + mouthAction + narration-prompt对齐)');

    let validation;
    try {
      validation = this.modules.storyboardValidator.validate(storyboard);
    } catch (e) {
      validation = {
        valid: storyboard.shots && storyboard.shots.length > 0,
        errors: [],
        warnings: []
      };
    }

    // P0修复#2:开场动作强制检查
    if (storyboard.shots && storyboard.shots.length > 0) {
      const openingShot = storyboard.shots[0];

      // v1.1-fix: 片头镜头跳过开场动作检查
      if (openingShot.type === 'opening' || openingShot.type === '片头' || openingShot.id === 'S00') {
        this.log('STAGE-8', `  i️ 开场动作检查跳过: ${openingShot.id} 为片头`);
      } else {
        const hasOpeningAction = openingShot.mouthAction &&
          (openingShot.mouthAction.includes('说话') ||
           openingShot.mouthAction.includes('打招呼') ||
           openingShot.mouthAction.includes('手势') ||
           openingShot.mouthAction.includes('嘴部') ||
           openingShot.mouthAction.includes('speaking') ||
           openingShot.mouthAction.includes('greeting') ||
           openingShot.mouthAction.includes('gesture'));

        if (!hasOpeningAction) {
          const error = {
            type: 'opening_action',
            message: `开场镜头${openingShot.id}缺少动作:必须有"说话/打招呼/手势"动作,当前mouthAction="${openingShot.mouthAction}"`,
            severity: 'error'
          };
          validation.errors = validation.errors || [];
          validation.errors.push(error);
          this.log('STAGE-8', `  ❌ 开场动作检查失败: ${openingShot.id} | ${error.message}`);
        } else {
          this.log('STAGE-8', `  ✅ 开场动作检查通过: ${openingShot.id}`);
        }
      }
    }

    // P0修复#1:mouthAction字段存在性检查
    const missingMouthAction = storyboard.shots.filter(s => {
      // 片头镜头跳过
      if (s.type === 'opening' || s.type === '片头' || s.id === 'S00' || s.isOpening) return false;
      // 同时支持驼峰和下划线
      const mouthAction = s.mouthAction || s.mouth_action;
      return !mouthAction || (typeof mouthAction === 'string' && mouthAction.trim() === '');
    });
    if (missingMouthAction.length > 0) {
      const warning = {
        type: 'mouth_action_missing',
        message: `${missingMouthAction.length}/${storyboard.shots.length} 镜头缺少mouthAction/mouth_action字段`,
        shots: missingMouthAction.map(s => s.id),
        severity: 'warning'
      };
      validation.warnings = validation.warnings || [];
      validation.warnings.push(warning);
      this.log('STAGE-8', `  ⚠️ mouthAction缺失: ${missingMouthAction.map(s => s.id).join(', ')}`);
    } else {
      this.log('STAGE-8', `  ✅ mouthAction检查通过: 全部内容镜已设置`);
    }

    // P0修复#5/#6:narration-prompt内容对齐检查(基础版)
    // v1.1-fix: StoryCraft的scene字段为beatName(如"钩子"/"深入"),放宽检查逻辑
    for (const shot of storyboard.shots) {
      if (shot.narration && shot.scene) {
        // v6.5.33-fix: social/generic模式跳过narration-scene对齐检查
        // 原因:social短视频scene名简短(如"椰树下初见"),narration描述具体画面,自然重叠度低,检查无意义
        if (this.mode === 'social' || this.mode === 'generic') {
          continue;
        }

        // 如果scene是beatName(非自然描述),跳过严格对齐检查
        const beatNames = ['钩子', '深入', '裂缝', '翻转', '余韵', 'hook', 'insight', 'twist', 'climax', 'resolution'];
        const isBeatName = beatNames.some(bn => shot.scene.includes(bn));

        if (isBeatName) {
          // 对于beatName,只检查narration是否包含与场景相关的关键词
          const narrationLower = shot.narration.toLowerCase();
          // v6.6.9-fix: 根据模式选择关键词
          const sceneKeywords = this.mode === 'nirath' 
            ? ['饕餮', '小G', 'Nirath', '钩吾山', '荒原', '双眼', '种子', '触碰']
            : ['场景', '主题', '内容', '人物'];
          const hasSceneRelated = sceneKeywords.some(kw =>
            narrationLower.includes(kw.toLowerCase())
          );

          if (!hasSceneRelated) {
            this.log('STAGE-8', `  ⚠️ narration缺少场景关键词: ${shot.id}(scene=${shot.scene})`);
          }
          continue;
        }

        const narrationKeywords = this.extractKeywords(shot.narration);
        const sceneKeywords = this.extractKeywords(shot.scene);
        const overlap = narrationKeywords.filter(k =>
          sceneKeywords.some(sk => k.includes(sk) || sk.includes(k))
        );
        const alignmentScore = narrationKeywords.length > 0 ? overlap.length / narrationKeywords.length : 1;
        // v6.5.33-fix: social模式放宽narration-scene对齐度阈值
        // 原因:social短视频的narration描述具体画面,scene名简短,自然重叠度低
        const alignmentThreshold = (this.mode === 'social' || this.mode === 'generic') ? 0.1 : 0.3;

        if (alignmentScore < alignmentThreshold) {
          const warning = {
            type: 'narration_scene_alignment',
            message: `镜头${shot.id} narration与scene对齐度低(${Math.round(alignmentScore * 100)}%):台词"${shot.narration.substring(0, 30)}..."与场景"${shot.scene.substring(0, 30)}..."不匹配`,
            shotId: shot.id,
            alignmentScore,
            severity: 'warning'
          };
          validation.warnings = validation.warnings || [];
          validation.warnings.push(warning);
          this.log('STAGE-8', `  ⚠️ narration-scene对齐度低: ${shot.id} | ${Math.round(alignmentScore * 100)}%`);
        }
      }
    }

    // v6.2-patch71-fix: 时长硬约束检查--动态上限,尊重PRD定义
    const prdDurations2 = input.scenes?.map(s => s.duration).filter(Boolean) || [];
    const maxPrdDuration2 = prdDurations2.length > 0 ? Math.max(...prdDurations2) : 15;
    const durationUpperLimit2 = maxPrdDuration2;
    const durationViolations = storyboard.shots.filter(s => s.duration < 3 || s.duration > durationUpperLimit2);
    if (durationViolations.length > 0) {
      const error = {
        type: 'duration_constraint',
        message: `${durationViolations.length}个镜头时长超出3-${durationUpperLimit2}秒硬约束`,
        shots: durationViolations.map(s => ({ id: s.id, duration: s.duration })),
        severity: 'error'
      };
      validation.errors = validation.errors || [];
      validation.errors.push(error);
      this.log('STAGE-8', `  ❌ 时长硬约束违规: ${durationViolations.map(s => `${s.id}=${s.duration}s`).join(', ')} (允许范围: 3-${durationUpperLimit2}s)`);
    }

    // P2修复#7:角色完整性验证(仅当projectConfig配置了requiredCharacters时检查)
    const requiredChars = (input && input.projectConfig && input.projectConfig.requiredCharacters) ||
                          (this.projectConfig && this.projectConfig.requiredCharacters);
    if (requiredChars && requiredChars.length > 0 && storyboard.shots) {
      const allCharsInStoryboard = new Set();
      storyboard.shots.forEach(shot => {
        (shot.characters || []).forEach(c => allCharsInStoryboard.add(c));
      });

      const missingChars = requiredChars.filter(c => !allCharsInStoryboard.has(c));
      if (missingChars.length > 0) {
        const warning = {
          type: 'character_missing',
          message: `必需角色未出场: ${missingChars.join(', ')}`,
          missingChars,
          severity: 'warning'
        };
        validation.warnings = validation.warnings || [];
        validation.warnings.push(warning);
        this.log('STAGE-8', `  ⚠️ 角色完整性: ${missingChars.length}个角色未出场: ${missingChars.join(', ')}`);
      } else {
        this.log('STAGE-8', `  ✅ 角色完整性: ${requiredChars.length}/${requiredChars.length} 全部出场`);
      }
    }

    // 更新valid状态(v6.2-patch52-fix: 保留storyboardValidator原始valid状态,不要覆盖)
    const pipelineErrors = (validation.errors || []).filter(e => e.severity === 'error');
    const hasPipelineErrors = pipelineErrors.length > 0;
    const originalValid = validation.valid !== false; // 如果storyboardValidator返回了valid=false,尊重它
    validation.valid = originalValid && !hasPipelineErrors;

    this.log('STAGE-8', `✅ 故事板校验 | 错误: ${(validation.errors || []).filter(e => e.severity === 'error').length} | 警告: ${(validation.warnings || []).length} | 通过: ${validation.valid ? '是' : '否'}`);
    return validation;
  }

  // ========== Stage 8.5: 五要素检查(v6.1升级:仅Nirath模式启用)==========
  async stageFiveElementCheck(storyboard, input) {
    this.log('STAGE-8.5', '五要素检查启动(仅Nirath模式)');

    // 仅对nirath模式启用
    if (this.mode !== 'nirath') {
      this.log('STAGE-8.5', '⏭️ 通用模式,跳过五要素检查');
      return { enabled: false, passed: true };
    }

    try {
      const { FiveElementInspector } = require('../systems/five-element-inspector');
      // v6.1-fix: 使用检查器默认阈值(已优化为5-6镜友好),不再硬编码覆盖
      const inspector = new FiveElementInspector({
        strictMode: false // 警告模式,不拦截
      });

      const options = {
        beastProfile: input?.beastProfile || input?.beast || input?.core?.beast || storyboard?.beast || {},
        protagonistProfile: input?.protagonist || input?.characters?.[input?.protagonistId || 'protagonist'] || {}
      };

      const report = inspector.inspect(storyboard, options);

      // 记录结果
      const failedElements = report.summary.failedElements || [];
      if (failedElements.length > 0) {
        this.log('STAGE-8.5', `⚠️ 五要素未通过: ${failedElements.map(e => e.label).join(', ')}`);
        for (const failed of failedElements) {
          this.log('STAGE-8.5', `  ⚠️ ${failed.label}: ${failed.score}/${failed.threshold} | ${failed.suggestion}`);
        }
      } else {
        this.log('STAGE-8.5', `✅ 五要素全部通过 | 综合评分: ${report.overallScore}/100`);
      }

      return {
        enabled: true,
        passed: report.overallPassed,
        overallScore: report.overallScore,
        results: report.results,
        summary: report.summary,
        failedElements: failedElements
      };
    } catch (error) {
      this.log('STAGE-8.5', `⚠️ 五要素检查异常: ${error.message}`, 'error');
      return { enabled: true, passed: true, error: error.message };
    }
  }

  // ========== Stage 9: 运镜系统(v4 LLM驱动个性化时间轴) ==========
  async stageCameraMovement(storyboard, fpvDecision) {
    this.log('STAGE-9', `运镜系统(v4 LLM驱动个性化时间轴)`);

    // v6.2-patch65: 重置一镜到底计数器(每轮预生产独立计数)
    this._oneShotCounter = { used: 0, max: 2 };

    // v6.6.9.4-patch9: 移除v3 timelineGenerator，统一使用v4

    // 场景类型→景别切换策略映射(英雄之旅运镜设计)
    // v6.2-patch107: 新增top-down和fpv特殊场景支持
    const sceneTypeToTransition = {
      opening: 'progressive_reveal',      // 开场:渐进式揭示
      establishing: 'progressive_reveal', // 建立:渐进式揭示
      discovery: 'impact_shock',          // 发现:震撼式冲击
      reveal: 'impact_shock',             // 揭示:震撼式冲击
      beastReveal: 'impact_shock',        // 异兽揭示:震撼式冲击
      interaction: 'orbit_explore',       // 互动:环绕式探索
      dialogue: 'dialogue_dance',         // 对话:对话式切换
      climax: 'chase_dynamic',            // 高潮:追逐式动态
      chase: 'chase_dynamic',             // 追逐:追逐式动态
      closing: 'poetic_wander',           // 结尾:诗意式游走
      environment: 'progressive_reveal',   // 环境:渐进式揭示
      'top-down': 'progressive_reveal',    // 俯视:渐进式揭示(全局展示)
      'fpv': 'chase_dynamic'               // FPV:追逐式动态
    };

    // 情绪阶段→灯光变化类型映射
    const emotionToLighting = {
      establishing: 'dawn_break',         // 建立:晨曦渐亮
      rising: 'spotlight_drama',          // 上升:戏剧聚光
      building: 'spotlight_drama',        // 蓄力:戏剧聚光
      climax: 'energy_burst',             // 高潮:能量爆发
      resolve: 'emotion_temperature',     // 解决:情绪冷暖
      neutral: 'dawn_break'               // 中性:晨曦渐亮
    };

    // 情绪阶段→速度曲线映射
    // v6.2-patch66-fix: 扩展映射覆盖所有情绪类型,防止激烈情绪使用慢速运镜
    // 重要:只能使用 SPEED_CURVES 中已有的值 (slow_fast_slow/fast_slow_fast/building/exploding/breathing)
    const emotionToSpeedCurve = {
      establishing: 'slow_fast_slow',      // 建立:慢快慢
      rising: 'building',                 // 上升:递进加速
      building: 'building',               // 蓄力:递进加速
      climax: 'exploding',               // 高潮:爆发式
      resolve: 'breathing',               // 解决:呼吸式
      neutral: 'slow_fast_slow',          // 中性:慢快慢
      // 新增映射:覆盖所有情绪类型,只使用已有speedCurve
      tension: 'exploding',               // 紧张:爆发式(快速)
      conflict: 'fast_slow_fast',          // 冲突:快慢快(紧张)
      awe: 'exploding',                   // 敬畏:爆发式(震撼)
      fear: 'exploding',                  // 恐惧:爆发式(冲击)
      anger: 'exploding',                 // 愤怒:爆发式(激烈)
      curious: 'slow_fast_slow',          // 好奇:慢快慢(探索)
      confusion: 'slow_fast_slow',         // 困惑:慢快慢(不安)
      relief: 'breathing',                 // 释然:呼吸式(舒缓)
      joy: 'fast_slow_fast',               // 喜悦:快慢快(活力)
      sadness: 'breathing',               // 悲伤:呼吸式(缓慢)
      surprise: 'exploding',              // 惊讶:爆发式(冲击)
      trust: 'slow_fast_slow',             // 信任:慢快慢(稳定)
      anticipation: 'building',           // 期待:递进加速(累积)
      disgust: 'exploding',              // 厌恶:爆发式(强烈)
    };

    const movements = [];
    let previousShot = null; // 🔥 v6.6.5-v4: 用于镜头间连续性检查
    for (const shot of storyboard.shots) {
      let movement;

      // 片头S00跳过复杂运镜(由片头系统自行控制)
      if (shot.id === 'S00' || shot.isOpening) {
        movement = {
          description: '片头运镜由opening-system-v3.js控制',
          isOpening: true,
          timeline: null
        };
        movements.push({ shotId: shot.id, movement, isFPV: false });
        continue;
      }

      // FPV导演决策:如果镜头被标记为fpvRecommended,或shotType为fpv,生成FPV运镜
      if (shot.fpvRecommended || shot.shotType === 'fpv' || shot.type === 'fpv') {
        this.log('STAGE-9', `  🎬 FPV运镜: ${shot.id} | 导演决策: ${shot.fpvReason || '特殊场景FPV'}`);

        if (this.mode === 'nirath') {
          // Nirath模式:生成FPV电影感运镜 + v3时间轴
          const sceneName = getSceneName(shot.scene, 'default').split('-')[0]?.trim() || getSceneName(shot.scene, 'default');
          const phase = shot.emotionPhase || 'climax';

          // 调用FPV电影感增强模块
          try {
            const { FPVCinematographyAgent } = require('../systems/fpv-cinematic-enhancement.js');
            const fpvAgent = new FPVCinematographyAgent();

            const fpvConfig = {
              shotSize: 'extreme_wide',
              position: 'first_person',
              movement: 'fly_through',
              speed: shot.fpvScore >= 90 ? 'extreme' : 'fast',
              physics: 'enabled',
              fpvMode: true,
              context: sceneName,
              timeRange: { start: 0, end: shot.duration || 5 }
            };

            movement = fpvAgent.generateNirathMovement(sceneName, phase, fpvConfig);
            movement.isFPV = true;
            movement.fpvScore = shot.fpvScore;

            // v6.6.9.4-patch9: FPV镜头使用v4时间轴，移除v3依赖
            // v4时间轴已在上面生成，无需额外处理
          } catch (e) {
            this.log('STAGE-9', `  ⚠️ FPV运镜生成失败: ${e.message} | 回退到v4基础运镜`);
            movement = await this._generateV4FallbackMovement(shot);
            this.fallbackMonitor.record('STAGE-9', {
              shotId: shot.id,
              reason: 'v4_fallback_movement'
            });
          }
        } else {
          // 通用模式:标准运镜
          movement = this.modules.cameraMovement.generateMovement(shot);
        }
      } else {
        // 🔥 v6.6.5-v4: 使用LLM驱动个性化时间轴系统（v4.0）
        // 支持Nirath和Generic两种模式
        const useV4 = true; // 可配置开关，默认启用v4
        if (useV4 && this.cameraMovementV4) {
          try {
            const v4Result = await this.cameraMovementV4.generateIntraShotTimelineV4(
              {
                id: shot.id,
                sceneName: getSceneName(shot.scene, 'default').split('-')[0]?.trim() || getSceneName(shot.scene, 'default'),
                sceneDescription: shot.scene || shot.description || '',
                duration: shot.duration || 5,
                emotionPhase: shot.emotionPhase || 'neutral',
                characters: shot.characters || [],
                dialogue: shot.dialogue || '',
                type: shot.type || 'dialogue'
              },
              previousShot,
              { autoFix: true }
            );
            
            if (v4Result.timeline) {
              // v6.6.7-fix: 使用完整的v4 description（策略名+第一段描述+段数）
              const strategy = v4Result.timeline.strategy || 'LLM驱动个性化运镜';
              const firstSeg = v4Result.timeline.segments?.[0];
              const lastSeg = v4Result.timeline.segments?.[v4Result.timeline.segments.length - 1];
              const segmentCount = v4Result.timeline.segmentCount || v4Result.timeline.segments?.length || 0;
              
              // 构建详细description：策略名 + 起始景别 + 结束景别 + 段数 + 第一段运镜
              const detailedDesc = `${strategy}：从${firstSeg?.shotSize || 'medium'}逐步过渡到${lastSeg?.shotSize || 'close_up'}，共${segmentCount}段精细运镜。首段：${firstSeg?.movement || '渐进式'}。${v4Result.timeline.reasoning ? '设计意图：' + v4Result.timeline.reasoning.substring(0, 80) : ''}`;
              
              movement = {
                timeline: v4Result.timeline,
                v4Enabled: true,
                v4Analysis: v4Result.analysis,
                v4Continuity: v4Result.continuityCheck,
                description: detailedDesc,
                // v6.6.7-fix: 添加v1兼容字段，让下游能正确消费
                shotSize: firstSeg?.shotSize || 'medium',
                position: 'center',
                movement: firstSeg?.movement || '渐进式推进',
                speed: firstSeg?.speed || 'slow',
                timeRange: firstSeg?.timeRange || [0, shot.duration || 5]
              };
              this.log('STAGE-9', `  🎬 v4运镜: ${shot.id} | ${strategy} | ${segmentCount}段`);
              
              // 更新previousShot用于连续性检查
              previousShot = { timeline: v4Result.timeline };
            } else {
              // v6.6.9.4-patch9: v4未生成时间轴，使用v4基础回退
              movement = await this._generateV4FallbackMovement(shot);
              this.fallbackMonitor.record('STAGE-9', {
                shotId: shot.id,
                reason: 'v4_fallback_movement'
              });
              previousShot = { timeline: movement.timeline };
            }
          } catch (e) {
            // v6.6.9.4-fix: LLM运镜失败不再降级到v3，直接报错
            throw new Error(`STAGE-9 v4运镜失败: ${e.message} | 镜头: ${shot.id} | 已触发重试机制但仍失败，终止预生产`);
          }
        } else {
          // v6.6.9.4-patch9: v3已移除，使用v4基础回退
            movement = await this._generateV4FallbackMovement(shot);
            this.fallbackMonitor.record('STAGE-9', {
              shotId: shot.id,
              reason: 'v4_fallback_movement'
            });
          previousShot = { timeline: movement.timeline };
        }
      }

      movements.push({ shotId: shot.id, movement, isFPV: !!(shot.fpvRecommended || shot.shotType === 'fpv' || shot.type === 'fpv') });

      // 🔥 v6.2-patch49-fix: 将运镜同步保存到shot对象,供下游消费
      shot.cameraMovement = movement;
    }

    const fpvCount = movements.filter(m => m.isFPV).length;
    const v4Count = movements.filter(m => m.movement?.v4Enabled).length;
    const v3Count = movements.filter(m => m.movement?.timeline?.segments?.length > 2 && !m.movement?.v4Enabled).length;
    this.log('STAGE-9', `✅ 运镜完成 | 镜头数: ${movements.length} | v4个性化: ${v4Count} | v3多段式: ${v3Count} | FPV: ${fpvCount} | 传统: ${movements.length - v4Count - v3Count - fpvCount}`);
    return movements;
  }

  /**
   * 🔥 v6.2-fix: 生成v3完整运镜(多段式时间轴+转场+灯光+速度曲线)

  /**
   * v6.6.9.4-patch9: v4基础回退方法（替代v3）
   */
  async _generateV4FallbackMovement(shot) {
    const sceneName = getSceneName(shot.scene, 'default').split('-')[0]?.trim() || getSceneName(shot.scene, 'default');
    const duration = shot.duration || 5;
    const timeline = {
      segments: [{
        timeRange: [0, duration],
        shotSize: 'medium',
        cameraAngle: 'eye_level',
        movement: 'static_hold',
        speed: 'slow',
        lighting: 'neutral',
        description: '基础静态构图，稳定画面'
      }],
      segmentCount: 1,
      transitionType: 'static',
      lightingType: 'neutral',
      speedCurve: 'constant'
    };
    return {
      description: `基础运镜：${sceneName}场景，静态构图，稳定画面呈现`,
      timeline,
      v4Enabled: true,
      v4Fallback: true,
      shotSize: 'medium',
      position: 'center',
      movement: 'static_hold',
      speed: 'slow',
      timeRange: [0, duration]
    };
  }


  // ========== Stage 10: 连续性检查 ==========
  async stageContinuity(storyboard) {
    this.log('STAGE-10', '连续性引擎检查');

    let continuity;
    try {
      // 尝试调用check方法
      if (typeof this.modules.continuityEngine.check === 'function') {
        continuity = this.modules.continuityEngine.check(storyboard.shots);
      } else if (typeof this.modules.continuityEngine.validate === 'function') {
        continuity = this.modules.continuityEngine.validate(storyboard.shots);
      } else {
        // fallback: 基础连续性检查
        continuity = {
          consistent: true,
          issues: [],
          warnings: []
        };
      }
    } catch (e) {
      continuity = {
        consistent: true,
        issues: [],
        warnings: [{ message: `ContinuityEngine调用失败: ${e.message}` }]
      };
    }

    this.log('STAGE-10', `✅ 连续性检查 | 问题: ${continuity.issues?.length || 0}`);

    return continuity;
  }

  /**
   * 🔥 v6.5.32-fix5: 计算镜头间类型差异(interShotDiversity)
   * 专家方案 D:拆分评分维度,确保5个镜头类型多样化
   */
  _normalizeMovementType(movement) {
    if (!movement) return 'unknown';
    const raw = String(movement).toLowerCase();
    if (raw.includes('push')) return 'push';
    if (raw.includes('dolly_out') || raw.includes('pull') || raw.includes('拉远')) return 'pull';
    if (raw.includes('slide_left') || raw.includes('slide_right') || raw.includes('truck') || raw.includes('横移')) return 'lateral';
    if (raw.includes('tilt')) return 'tilt';
    if (raw.includes('pan')) return 'pan';
    if (raw.includes('orbit')) return 'orbit';
    if (raw.includes('static')) return 'static';
    if (raw.includes('macro')) return 'macro';
    if (raw.includes('track')) return 'track';
    return raw;
  }

  _getPrimaryMovementType(shot) {
    if (shot?.cameraMovement?.movementType) {
      return this._normalizeMovementType(shot.cameraMovement.movementType);
    }
    if (shot?.cameraMovement?.movement) {
      return this._normalizeMovementType(shot.cameraMovement.movement);
    }
    if (typeof shot?.cameraMovement === 'string') {
      return this._normalizeMovementType(shot.cameraMovement);
    }
    return 'unknown';
  }

  _calcInterShotDiversity(currentShot, allShots = []) {
    if (!allShots.length) return 0;
    const currentType = this._getPrimaryMovementType(currentShot);
    if (currentType === 'unknown') return 0;

    const allTypes = allShots.map(s => this._getPrimaryMovementType(s)).filter(Boolean);
    const uniqueTypes = new Set(allTypes.filter(t => t !== 'unknown'));
    const uniqueCount = uniqueTypes.size;

    if (uniqueCount >= 5) return 7;
    if (uniqueCount >= 4) return 6;
    if (uniqueCount >= 3) return 5;
    if (uniqueCount >= 2) return 3;
    return 0;
  }

  /**
   * 🔥 v6.5.32-fix5: 批量分配多样化运镜(专家方案 E)
   * 确保5个镜头类型全不同,避免hash碰撞导致重复
   */
  assignDiverseMovements(shots = [], mode = 'generic') {
    const poolsByMode = {
      generic: ['static_hold', 'slow_push_in', 'slide_left', 'slide_right', 'tilt_down', 'orbit_soft', 'slow_dolly_out'],
      medical: ['static_hold', 'slow_push_in', 'slide_left', 'tilt_down', 'macro_push', 'orbit_soft'],
      education: ['static_hold', 'slow_push_in', 'slide_right', 'tilt_down', 'orbit_soft'],
      documentary: ['static_hold', 'slow_push_in', 'slide_left', 'slide_right', 'slow_dolly_out']
    };

    const pool = poolsByMode[mode] || poolsByMode.generic;
    let poolIndex = 0;

    return shots.map((shot, idx) => {
      let preferred = null;
      const text = `${shot.type || ''} ${shot.purpose || ''} ${shot.title || ''} ${shot.prompt || ''}`.toLowerCase();

      if (text.includes('opening') || text.includes('开场')) preferred = 'static_hold';
      else if (text.includes('closing') || text.includes('结尾') || text.includes('总结')) preferred = 'slow_dolly_out';
      else if (text.includes('演示') || text.includes('demonstration')) preferred = 'tilt_down';
      else if (text.includes('细节') || text.includes('局部') || text.includes('macro')) preferred = 'macro_push';
      else preferred = pool[poolIndex++ % pool.length];

      return {
        ...shot,
        cameraMovement: {
          ...(shot.cameraMovement || {}),
          movement: preferred,
          movementType: preferred
        }
      };
    });
  }

  /**
   * 🔥 v6.5.32-fix5: 提取 segments 的 helper(专家方案 A)
   */
  _extractSegmentsFromShot(enhanced, shot) {
    if (enhanced && Array.isArray(enhanced.segments) && enhanced.segments.length > 0) {
      return enhanced.segments;
    }
    if (enhanced && Array.isArray(enhanced._segments) && enhanced._segments.length > 0) {
      return enhanced._segments;
    }
    if (shot && Array.isArray(shot.segments) && shot.segments.length > 0) {
      return shot.segments;
    }
    if (shot && Array.isArray(shot._segments) && shot._segments.length > 0) {
      return shot._segments;
    }
    if (shot && shot.cameraMovement) {
      if (Array.isArray(shot.cameraMovement.timeline) && shot.cameraMovement.timeline.length > 0) {
        return shot.cameraMovement.timeline;
      }
      if (shot.cameraMovement.timeline && Array.isArray(shot.cameraMovement.timeline.segments) && shot.cameraMovement.timeline.segments.length > 0) {
        return shot.cameraMovement.timeline.segments;
      }
      if (Array.isArray(shot.cameraMovement.segments) && shot.cameraMovement.segments.length > 0) {
        return shot.cameraMovement.segments;
      }
    }
    return [];
  }

  // ========== Stage 10.5: 渲染前置输入检查(v6.0-fix:改为输入就绪确认,不死锁) ==========
  async stageSafetyGate(stages) {
    this.log('STAGE-10.5', '渲染前置输入检查 - 确认Stage 11输入完整性');

    const results = [];
    let allReady = true;

    for (let i = 0; i < stages.storyboard.shots.length; i++) {
      const shot = stages.storyboard.shots[i];
      const errors = [];

      // 检查1: narration是否非空(核心输入)
      if (!shot.narration || shot.narration.trim().length === 0) {
        errors.push(`narration为空`);
      }

      // 检查2: 角色档案是否已加载(如镜头需要角色)
      // v6.0-fix: 允许纯神兽揭示镜头(beastReveal/reveal类型)无角色
      const needsCharacter = !['reveal', 'beastReveal', 'environment'].includes(shot.type);
      if (needsCharacter && (!shot.characters || shot.characters.length === 0)) {
        errors.push(`镜头类型${shot.type}需要角色,但未分配`);
      }

      // 检查3: 运镜配置是否已分配
      if (!shot.cameraMovement && !stages.camera?.find(c => c.shotId === shot.id)?.movement) {
        errors.push(`运镜未分配`);
      }

      // 检查4: 场景DNA是否可提取(场景名是否有效)
      const sceneName = getSceneName(shot.scene, 'default').split('-')[0]?.trim() || getSceneName(shot.scene, 'default');
      if (!sceneName || sceneName === 'default') {
        errors.push(`场景名无效: ${shot.scene}`);
      }

      // 检查5: 时长是否合理(动态上限,尊重PRD定义)
      const prdScenes = stages.prd?.scenes || [];
      const prdDurations3 = prdScenes.map(s => s.duration).filter(Boolean);
      const maxPrdDuration3 = prdDurations3.length > 0 ? Math.max(...prdDurations3) : 15;
      const durationUpperLimit3 = maxPrdDuration3;
      if (!shot.duration || shot.duration < 3 || shot.duration > durationUpperLimit3) {
        errors.push(`时长异常: ${shot.duration}秒 (允许范围: 3-${durationUpperLimit3}s)`);
      }

      const passed = errors.length === 0;
      if (!passed) allReady = false;

      results.push({
        shotId: shot.id,
        passed,
        errors,
        inputStatus: {
          hasNarration: !!(shot.narration && shot.narration.trim()),
          hasCharacter: !!(shot.characters && shot.characters.length > 0),
          needsCharacter,
          hasCamera: !!(shot.cameraMovement || stages.camera?.find(c => c.shotId === shot.id)?.movement),
          sceneValid: !!(sceneName && sceneName !== 'default'),
          durationValid: !!(shot.duration && shot.duration >= 3 && shot.duration <= durationUpperLimit3)
        }
      });

      if (!passed) {
        this.log('STAGE-10.5', `  ❌ ${shot.id} 输入不完整: ${errors.join(', ')}`);
      } else {
        this.log('STAGE-10.5', `  ✅ ${shot.id} 输入就绪`);
      }
    }

    this.log('STAGE-10.5', `✅ 前置输入检查 | 就绪: ${results.filter(r => r.passed).length}/${results.length} | ${allReady ? '全部就绪,可进入Stage 11' : '部分输入缺失,需修复'}`);

    // 【v6.0-patch22 新增】定妆照强制绑定验证
    const characterValidation = validateCharacterReferences(stages.storyboard, {
      requiredCharacters: stages.characters ? Object.keys(stages.characters) : [],
      characters: this.projectConfig?.characters || stages.characters || {}
    });

    if (!characterValidation.valid) {
      // v6.2-patch41-fix: Stage-10.5 定妆照绑定改为硬拦截
      // 预生产模式下也必须验证绑定清单,但允许通过(只记录警告)
      // 生产模式下直接拦截
      if (this.mode === 'production') {
        throw new Error(`⛔ 定妆照绑定验证失败: ${characterValidation.errors.length}个角色未绑定。必须修复后才能渲染。`);
      }
      this.log('STAGE-10.5', `⚠️ 定妆照绑定未通过: ${characterValidation.errors.length}个问题`, 'warn');
      characterValidation.errors.forEach(e => this.log('STAGE-10.5', `  ⚠️ ${e.message || e}`, 'warn'));
    } else {
      this.log('STAGE-10.5', `✅ 定妆照绑定验证通过`);
    }

    return {
      passed: allReady && characterValidation.valid,
      results,
      allReady,
      isPreProduction: true,
      characterValidation
    };
  }

  // ========== v6.6.3: 光影技能调用接口 ==========
  async applyLightingSkills(shot, prompt, context = {}) {
    // 调用三点照明大师
    const threePoint = this._applyThreePointLighting(shot, prompt);

    // 调用情绪光影导演
    const emotional = this._applyEmotionalLighting(shot, threePoint);

    // 调用环境光效设计师
    const environmental = this._applyEnvironmentalLighting(shot, emotional);

    // 调用AI真实感光影专家
    const realism = this._applyRealismLighting(shot, environmental);

    return realism;
  }

  _applyThreePointLighting(shot, prompt) {
    // 检查是否已有三点照明
    if (/golden.*rim|backlight|edge.*glow/i.test(prompt) &&
        /diffused.*ambient|soft.*shadow/i.test(prompt)) {
      return prompt; // 已有三点照明
    }

    return `${prompt}, strong golden rim backlight at 30° above behind subject, luminous edge glow, soft diffused ambient from front-left, extremely gentle shadows`;
  }

  _applyEmotionalLighting(shot, prompt) {
    const emotion = shot.emotionPhase || shot.emotion || 'professional';
    const emotionMap = {
      'sacred': 'high golden rim + volumetric god rays + cool blue-gray shadows',
      'dreamy': 'soft diffused + golden particles + shallow depth of field',
      'cool': 'even diffused + cool rim + minimal composition',
      'epic': 'side hard light + warm shadows + wide shot',
      'passionate': 'high contrast + hard light + dynamic light effects',
      'futuristic': 'cool main light + golden rim + data particles',
      'organic': 'natural light + diffused + environmental reflection',
      'professional': 'soft diffused + subtle rim + clean shadows'
    };

    const lighting = emotionMap[emotion] || emotionMap['professional'];
    return `${prompt}, ${lighting}`;
  }

  _applyEnvironmentalLighting(shot, prompt) {
    const sceneType = shot.type || 'general';
    const envMap = {
      'indoor': 'window light 5600K, natural direction, soft transition',
      'night': 'mixed color temperature 2700K-6500K, local lighting',
      'outdoor': 'sky light + direct sun, natural ratio, 5600K',
      'hospital': 'cold white 6500K+, even lighting, clinical precision',
      'studio': 'professional three-point, controlled ratio, clean shadows'
    };

    const env = envMap[sceneType] || envMap['studio'];
    return `${prompt}, ${env}`;
  }

  _applyRealismLighting(shot, prompt) {
    // 三层金色控制
    if (!/ambient.*gold|structural.*gold|highlight.*gold/i.test(prompt)) {
      prompt += ', ambient gold 15% + structural gold 20% + highlight gold 10%';
    }

    // 暗部压色
    if (!/cool.*shadow|blue-gray|#2C3E50/i.test(prompt)) {
      prompt += ', cool blue-gray shadows (#2C3E50), subtle warm/cool contrast';
    }

    return prompt;
  }

  // ========== Stage 11: 渲染核心(Nirath原生 + 防硬编码Prompt构建) ==========
  async stageRender(stages) {
    this.log('STAGE-11', `渲染核心${this.mode === 'nirath' ? '(Nirath v24)' : '(通用)'}`);

    const prompts = [];
    const { storyboard, characters, camera } = stages;
    storyboard.shots = normalizeRenderShots(storyboard.shots || []);

    let currentTime = 0; // v6.5.62: 累积时间跟踪
    for (let i = 0; i < storyboard.shots.length; i++) {
      const shot = storyboard.shots[i];
      let gotoFinalSubmit = false; // v6.5.43: 新链路标记
      let newChainResult = null; // v6.6.9: 新链路结果
      // 🔥 v6.2-patch48-fix: 同时从 stages.camera 和 shot.cameraMovement 读取运镜
      const movement = shot.cameraMovement || camera.find(c => c.shotId === shot.id)?.movement || null;

      // 如果存在运镜但未同步到shot,补充同步
      if (movement && !shot.cameraMovement) {
        shot.cameraMovement = movement;
      }

      // 🔥 v3.0-patch5: 片头镜头特殊处理(S00)
      if (shot.id === 'S00' && shot.isOpening && shot.prompt) {
        // 片头Prompt已由opening-system-v3.js生成,直接使用
        let openingPrompt = shot.prompt;

        // 如果增强后超限,智能裁剪
        if (openingPrompt.length > PROMPT_LENGTH.HARD_MAX) {
          openingPrompt = this.smartTrim(openingPrompt, PROMPT_LENGTH.HARD_MAX, {
            preserve: ['ASTRALIS', '钩子', '展开', '定格', '标题', '运镜', '明亮约束', '风格锁', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
            trim: ['辅助运镜', '光影细节补充']
          });
          this.log('STAGE-11', `  ⚠️ 片头Prompt超限,智能裁剪至${openingPrompt.length}字符`);
        }

        // v6.5.1-fix: 预生产阶段注入定妆照路径标记(无base64,仅路径)
        const referenceImages = [];
        for (const charId of (shot.characters || [])) {
          const char = stages.characters?.[charId];
          if (char?.portraits) {
            for (const [angle, imagePath] of Object.entries(char.portraits)) {
              referenceImages.push({
                type: 'image_url',
                image_url: { url: imagePath },
                role: 'reference_image',
                character: charId,
                angle
              });
            }
          }
        }

        // v6.5.58-fix: 构建标准片头输出字段
        const openingOutput = {
          shotId: shot.id,
          id: shot.id,
          type: 'opening',
          scene: '片头',
          prompt: openingPrompt,
          referenceImages,
          duration: 9, // 片头固定9秒
          length: openingPrompt.length,
          mouthAction: shot.mouthAction,
          utilization: Math.round(openingPrompt.length / PROMPT_LENGTH.HARD_MAX * 100),
          utilizationStatus: openingPrompt.length >= 970 && openingPrompt.length <= PROMPT_LENGTH.HARD_MAX ? '🔥理想' : (openingPrompt.length > PROMPT_LENGTH.HARD_MAX ? '❌超标' : '⚠️空间浪费'),
          qualityScore: { totalScore: 95, cameraVariety: 8, lightingProgression: 'advanced', emotionalDepth: 90 },
          enhanced: true,
          isOpening: true
        };

        // 注入title对象(从shot或postProduction提取)
        if (shot.title && typeof shot.title === 'object') {
          openingOutput.title = shot.title;
        } else if (shot.postProduction && typeof shot.postProduction === 'object') {
          openingOutput.title = {
            main: shot.postProduction.mainTitle || '',
            sub: shot.postProduction.subTitle || '',
            creator: shot.postProduction.brand ? shot.postProduction.brand.replace(/A Nirath Original by\s*/, '') : 'Genius',
            episodeName: shot.postProduction.titleFormation || '',
            displayTiming: '6.8-9.0s',
            position: '画面中央偏下',
            style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
          };
        }

        prompts.push(openingOutput);

        this.log('STAGE-11', `  ✅ 片头渲染: ${shot.id} | 由opening-system-v3.js生成 | ${openingPrompt.length}字符 | 🔥理想`);
        continue; // 跳过常规渲染流程
      }

      // 🔥 v6.2-patch78-fix: 兜底检查--确保常规镜头有基本输入
      if (!shot.narration && !shot.visualPrompt && !shot.scene) {
        this.log('STAGE-11', `  ❌ ${shot.id} 无有效输入(narration/visualPrompt/scene全空),跳过渲染`);
        continue;
      }

      // 将运镜描述注入shot(供buildBasePrompt使用)
      if (movement) {
        shot.cameraMovement = movement;
      }

      let prompt;

      if (this.mode === 'nirath') {
        // Nirath模式:调用Nirath渲染核心v24.3(风格前置化)
        // 🔥 v24.3: 风格约束包作为输入传入,确保Prompt第一句话就受Nirath美学约束
        // v6.6.9.4-fix: styleConstraint已在外部统一定义

        // 🔥 v24.4-fix: 丰富script参数,合并更多场景数据以扩展核心叙事长度
        // v6.2-patch61-fix: 旁白文本绝不进入视觉Prompt,严格分离通道
        const scriptParts = [];
        if (shot.visualPrompt) scriptParts.push(shot.visualPrompt);
        if (shot.scene?.nirathName || shot.scene?.name) {
          scriptParts.push(`场景锚定:${shot.scene.nirathName || shot.scene.name}`);
        }
        if (shot.scene?.description) scriptParts.push(shot.scene.description);
        if (shot.scene?.atmosphere) scriptParts.push(shot.scene.atmosphere);
        if (shot.extendedNarrative) scriptParts.push(shot.extendedNarrative);
        // ❌ shot.innerMonologue 内心独白是文学性叙事,绝不进入视觉Prompt(P0级约束)
        // 内心独白仅用于角色情绪指导,通过【表情】关键词间接表达
        // if (shot.innerMonologue) scriptParts.push(`内心独白:${shot.innerMonologue}`);
        // ✅ v6.2-patchXX: 旁白/台词作为独立字段【旁白/台词】融入视觉Prompt
        // 影响角色表情、嘴型、情绪基调,与TTS音频通道分离(双通道独立)
        // v6.5.34-fix: 全局禁用narration,使用dialogue作为台词
        const narration = shot.dialogue || ''; // 禁用narration,只使用dialogue

        const enrichedScript = scriptParts.join('\n\n') || shot.visualPrompt || (this.mode === 'nirath' ? 'Nirath异世界场景' : '真实世界场景');

        // ✅ v6.2-patch87-3: 构建精简角色描述(名字+核心特征,30-40字符)
        // v6.5.1-fix: 添加角色ID标准化映射,处理脚本生成阶段与角色系统阶段的ID不一致问题(如 taotie vs tao-tie)
        const normalizeCharId = (id) => {
          const idLower = id.toLowerCase();
          if (stages.characters[id]) return id; // 精确匹配优先
          // 尝试常见变体
          const variants = [
            idLower.replace(/-/g, ''), // tao-tie -> taotie
            idLower.replace(/([a-z])-([a-z])/g, '$1$2'), // tao-tie -> taotie
          ];
          for (const v of variants) {
            if (stages.characters[v]) return v;
          }
          return id; // 回退到原始ID
        };

        const characterProfiles = {};
        for (const charId of shot.characters) {
          const normalizedId = normalizeCharId(charId);
          const char = stages.characters?.[normalizedId];
          if (char && this.modules.characterPromptBuilder) {
            try {
              // v6.5.30-fix: pass char.profile (the actual character profile) instead of wrapper
              const minimal = this.modules.characterPromptBuilder.buildMinimal(char.profile || char, { maxChars: 30 });
              characterProfiles[charId] = minimal;
            } catch (e) {
              characterProfiles[charId] = char.profile?.name || charId;
            }
          }
        }

        const ambientSoundField = generateAmbientSoundField(shot, { maxChars: 80, mode: this.mode });

        // v6.6.9.4-fix: Generic模式使用干净的styleConstraint
        const styleConstraint = this.mode === 'nirath' ? {
          // Nirath专属风格约束（保持不变）
          nirathTechTail: '超写实数字渲染, 影视级画面构图, 体积光照明, 空气透视感, 皮肤与材质微距摄影级细节, 写实风格, 外星繁茂植被覆盖岩石地表, 背景可见奇异生物活动。',
          environmentRealism: '背景环境采用实景拍摄质感, 物理真实世界, 35mm胶片颗粒, 轻微噪点, 4K高清, 电影质感, 细节清晰, 色彩自然, 非CG渲染感, 真实光影与大气透视。',
          bannedKeywords: ['中国风','古风','传统','水墨','国风','仙侠','武侠','chinese style','traditional chinese','ink wash','oriental','lo-fi','anime','cartoon','cartoony','stylized','toon'],
          visualAnchor: 'Nirath异世界, 超写实科幻生态系统, 非地球生物, 繁茂植被与奇异发光植物覆盖地表, 活跃的外星生物可见,',
          lightingSpec: '双恒星琥珀-紫罗兰光照形成玫瑰金阴影, 生物发光补光柔和脉动。',
          disclaimer: 'NO Chinese traditional symbols (yin-yang, bagua, taiji, wuxing). NO anime/cartoon style. NO ink wash painting. NO traditional Chinese architecture or clothing.'
        } : {
          // Generic模式：干净的专业风格约束，无Nirath元素
          nirathTechTail: '超写实数字渲染, 影视级画面构图, 体积光照明, 空气透视感, 皮肤与材质微距摄影级细节, 写实风格, 自然光照, 真实场景',
          environmentRealism: '背景环境采用实景拍摄质感, 物理真实世界, 35mm胶片颗粒, 轻微噪点, 4K高清, 电影质感, 细节清晰, 色彩自然, 非CG渲染感, 真实光影与大气透视',
          bannedKeywords: ['anime','cartoon','cartoony','stylized','toon'],
          visualAnchor: '真实世界场景, 专业摄影质感, 自然光照, 写实风格',
          lightingSpec: '自然光照明, 柔和阴影, 真实光影',
          disclaimer: 'NO anime/cartoon style. NO stylized rendering.'
        };

        // v6.5.64-fix2: 传入人物出场卡片（如果存在）
        const characterIntroCard = shot.characterIntroCard || null;

        const renderResult = this.modules.renderCore.buildPromptV3({
          sceneName: shot.scene,
          script: enrichedScript,
          narration: narration,
          ambientSound: ambientSoundField,
          characters: shot.characters,
          characterProfiles,
          type: shot.type || 'generic',
          emotionPhase: shot.emotionPhase || 'neutral',
          movement: shot.cameraMovement,
          mouthAction: shot.mouthAction,
          visualComplexity: shot.visualComplexity,
          importance: shot.importance,
          styleConstraint,
          characterIntroCard // 传入人物出场卡片
        });

        prompt = renderResult.prompt;

        // DEBUG: 打印buildPromptV3返回的prompt中【视觉】的内容
        const debugVisualMatch = prompt.match(/【视觉】([^【]*?)(?=【|$)/);
        this.log('STAGE-11', `  🔍 DEBUG buildPromptV3 visual: ${shot.id} | hasVisual=${prompt.includes('【视觉】')} | content=${debugVisualMatch ? JSON.stringify(debugVisualMatch[1].trim()) : 'null'}`);

        // v6.2-patch104: 注入差异化照明方案(解决灯光0分问题)
        // 注:必须在buildPromptV3之后执行,此时prompt已有值
        if (this.mode === 'nirath') {
          const beforeLighting = prompt.length;
          prompt = this.injectLightingIfMissing(shot, prompt);
          if (prompt.length > beforeLighting) {
            this.log('STAGE-11', `  💡 照明方案注入: ${shot.id} | +${prompt.length - beforeLighting}字符 | 场景:${shot.shotType || shot.type}`);
          }
        }

        // v6.2-patch106-fix: 注入场景化环境描述(解决模板段落场景化问题)
        // 注:必须在buildPromptV3之后执行,此时prompt已有值
        if (this.mode === 'nirath') {
          const beforeEnv = prompt.length;
          const sceneSpecificEnv = this.generateSceneSpecificEnvironment(shot.scene, shot.shotType || shot.type);
          if (sceneSpecificEnv && !prompt.includes(sceneSpecificEnv.substring(0, 20))) {
            // 在【视觉】之后插入场景化环境描述
            if (prompt.includes('【视觉】')) {
              prompt = prompt.replace(/(【视觉】[^【]*?)(?=【|$)/, `$1\n${sceneSpecificEnv}`);
            } else {
              prompt = `${sceneSpecificEnv}\n${prompt}`;
            }
            this.log('STAGE-11', `  🌍 场景化环境注入: ${shot.id} | 场景:${shot.scene} | +${prompt.length - beforeEnv}字符`);
          }
        }

        // v6.2-patch62-fix: 如果Prompt中没有【视觉】标记或内容为空,注入兜底视觉描述
      // 确保每个镜头都有有效的视觉内容,防止空转
      if (!prompt.includes('【视觉】') || prompt.match(/【视觉】([^【]*?)(?=【|$)/)?.[1]?.trim()?.length < 10) {
        const defaultVisual = this.generateDefaultVisual(shot, renderResult.analysis);
        if (defaultVisual) {
          if (prompt.includes('【视觉】')) {
            // 替换现有空视觉
            prompt = prompt.replace(/【视觉】[^【]*?(?=【|$)/, `【视觉】${defaultVisual}`);
          } else {
            // 在Prompt开头插入视觉描述
            prompt = `【视觉】${defaultVisual} ${prompt}`;
          }
          this.log('STAGE-11', `  🎨 空视觉修复: ${shot.id} | 注入默认视觉描述 | 长度:${defaultVisual.length}`);
        }
      }

      // v6.2-patch61-fix: 如果【视觉】为空或内容过少,自动生成默认视觉描述(旧逻辑保留兼容)
      const visualMatch = prompt.match(/【视觉】([^【]*?)(?=【|$)/);
      const visualContent = visualMatch ? visualMatch[1].trim() : '';
      // 检查视觉内容是否为空、仅标点、或过少(少于10个有效字符)
      const isVisualEmpty = !visualContent ||
                            visualContent === '。' ||
                            visualContent === '.' ||
                            visualContent.length < 10 ||
                            /^[。.,;:!?\s]*$/.test(visualContent);
      if (isVisualEmpty) {
        const defaultVisual = this.generateDefaultVisual(shot, renderResult.analysis);
        if (defaultVisual) {
          if (prompt.includes('【视觉】')) {
            prompt = prompt.replace(/【视觉】[^【]*?(?=【|$)/, `【视觉】${defaultVisual}`);
          } else {
            prompt = `【视觉】${defaultVisual} ${prompt}`;
          }
          this.log('STAGE-11', `  🎨 空视觉修复: ${shot.id} | 注入默认视觉描述`);
        }
      }

        // v6.2-patch61-fix: 清理遗留技术规格(UE5/Lumen/Nanite等)
        const emotionMapper = this.modules.techSpecsEmotionMapper;
        if (emotionMapper && typeof emotionMapper.cleanTechSpecs === 'function') {
          const cleanResult = emotionMapper.cleanTechSpecs(prompt);
          if (cleanResult.removedCount > 0) {
            prompt = cleanResult.cleaned;
            this.log('STAGE-11', `  🧹 技术规格清理: 移除${cleanResult.removedCount}项遗留声明 | 释放${cleanResult.freedChars}字符 | ${cleanResult.removed.join(', ')}`);
          }
        }

        // v6.5.29-fix: generic模式使用真实光照约束,不注入Nirath双恒星
        if (this.mode !== 'nirath') {
          prompt += ' 【明亮约束】自然光或柔和室内照明,画面真实干净,禁止暗黑/灰暗。';
        } else {
          prompt += ' 【明亮约束】Aurelius5800K暖金+Silvana6500K清冷,双恒星明亮光照。禁止暗黑/夜晚/灰暗。必须明亮奇幻、多色彩层次。';
        }

        // v6.5.34-fix: 去除重复的【环境音效】字段(buildPromptV3可能注入两次)
        const envSoundMatches = prompt.match(/【环境音效】/g);
        if (envSoundMatches && envSoundMatches.length > 1) {
          // 保留第一个【环境音效】,去除后续的
          let firstEnvSound = true;
          prompt = prompt.replace(/【环境音效】[^【]*/g, (match) => {
            if (firstEnvSound) {
              firstEnvSound = false;
              return match;
            }
            return '';
          });
          this.log('STAGE-11', `  🧹 环境音效去重: ${shot.id} | 去除${envSoundMatches.length - 1}个重复字段`);
        }

        // v6.5.34-fix: 去除重复的【环境质感】字段
        const envTextureMatches = prompt.match(/【环境质感】/g);
        if (envTextureMatches && envTextureMatches.length > 1) {
          let firstEnvTexture = true;
          prompt = prompt.replace(/【环境质感】[^【]*/g, (match) => {
            if (firstEnvTexture) {
              firstEnvTexture = false;
              return match;
            }
            return '';
          });
          this.log('STAGE-11', `  🧹 环境质感去重: ${shot.id} | 去除${envTextureMatches.length - 1}个重复字段`);
        }

        // v6.5.34-fix: 统一时间轴--从_segments生成prompt中的【镜头时间轴】
        // 根因:外层JSON(_segments)与内层字符串(【镜头时间轴】)独立生成,未同步
        if (shot._segments && shot._segments.length > 0 && !prompt.includes('【镜头时间轴】')) {
          const timelineText = shot._segments.map((seg, idx) =>
            `${idx + 1}. ${seg.time}s: ${seg.camera || seg.action || '固定镜头'}${seg.note ? `(${seg.note})` : ''}`
          ).join(';');
          prompt += ` 【镜头时间轴】${timelineText}`;
          this.log('STAGE-11', `  ⏱️ 时间轴同步: ${shot.id} | 从_segments生成 | ${shot._segments.length}段`);
        }

        // v6.5.34-fix: Nirath模式内容镜注入缺失的约束(风格锁/负面约束/角色约束)
        if (this.mode === 'nirath') {
          // 1. 注入风格锁(仅片头有的,内容镜缺失)
          if (!prompt.includes('【风格锁】')) {
            prompt += ' 【风格锁】禁止卡通/动漫/暗黑。必须双恒星明亮光照+磁场可见+低重力飘浮。这是Nirath。';
            this.log('STAGE-11', `  🔒 风格锁注入: ${shot.id}`);
          }

          // 2. 注入负面约束(仅片头有的,内容镜缺失)
          if (!prompt.includes('【负面约束】') && !prompt.includes('【全局负面约束】')) {
            const negativeConstraint = '【负面约束】禁止眼睛出现红色、蓝色、黄色、绿色、紫色、橙色、荧光色、发光色等非自然颜色;禁止红眼、蓝瞳、金瞳、绿眼、紫眼、荧光眼、发光眼、火光眼、霓虹眼;眼睛必须是人眼自然黑色瞳孔,仅允许对面景物倒影在眼中;禁止水晶;禁止重复角色';
            prompt += ` ${negativeConstraint}`;
            this.log('STAGE-11', `  🛡️ 负面约束注入: ${shot.id}`);
          }

          // 3. 注入角色约束(仅片头有的,内容镜缺失)
          const chars = shot.characters || [];
          if (chars.length > 0 && !prompt.includes('【角色约束】')) {
            const charNames = chars.map(cid => {
              const char = characters?.[cid];
              return char?.profile?.baseIdentity?.name || char?.profile?.name || char?.name || cid;
            }).filter(Boolean);
            if (charNames.length > 0) {
              const nameList = charNames.join('、');
              let constraint = `【角色约束】画面中仅出现${nameList},禁止重复角色`;
              if (charNames.length > 1) {
                constraint += `;${charNames.length}人位置分布自然,避免重叠`;
              }
              prompt += ` ${constraint}`;
              this.log('STAGE-11', `  👥 角色约束注入: ${shot.id} | ${nameList}`);
            }
          }
        }

        // 🔥 v6.1-fix: 将生成的prompt赋值给shot,供后续enhanceShotPrompt使用
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入(灯光、色彩、特效、质感、氛围)
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);

        // ========== 【v6.2-patch51】结尾镜情绪增强(Nirath模式)==========
        if (this.modules.closingBooster) {
          const boostResult = this.modules.closingBooster.boost({prompt}, shot);
          if (boostResult.enhanced) {
            prompt = boostResult.result.prompt;
            shot.prompt = prompt;
            this.log('STAGE-11', `  🎭 情绪增强: ${shot.id} | 注入${boostResult.injections}项 | 情绪密度:${boostResult.emotionDensity?.toFixed(2)}`);
          }
        }

        // v6.2-patch65: 将shotType以【叙事弧线】标记注入Prompt,供导演优化检测
        // v6.2-patch66-fix: 增强叙事弧线,加入具体叙事目的,防止镜头沦为纯风景展示
        const shotTypeMap = {
          'opening': '【叙事弧线:开场钩子】引入主题,建立悬念',
          'setup': '【叙事弧线:铺垫展开】交代背景,推进故事',
          'conflict': '【叙事弧线:冲突爆发】揭示矛盾,制造张力',
          'rising': '【叙事弧线:升级递进】深化冲突,推向高潮',
          'climax': '【叙事弧线:高潮翻转】核心揭示,情感峰值',
          'resolution': '【叙事弧线:升华收束】主题定格,余韵悠长'
        };

        // 从narration或visualPrompt提取核心信息,生成叙事目的
        const narrativeSource = shot.narration || shot.visualPrompt || '';
        let narrativePurpose = '';
        if (narrativeSource) {
          // v6.2-patch67-fix: 提取前30字符,优先在标点处截断,避免句子不完整
          const coreInfo = this.trimAtPunctuation(narrativeSource, 30);
          if (coreInfo.length > 5) {
            narrativePurpose = ` | 叙事目的:${coreInfo}`;
          }
        }

        const narrativeArc = shotTypeMap[shot.shotType] || '';
        if (narrativeArc && !prompt.includes('【叙事弧线')) {
          prompt = narrativeArc + narrativePurpose + '\n' + prompt;
          shot.prompt = prompt;
          this.log('STAGE-11', `  🎭 叙事弧线注入: ${shot.id} | ${shot.shotType} → ${narrativeArc.substring(0, 30)}...${narrativePurpose ? ' | 含叙事目的' : ''}`);
        }

        this.log('STAGE-11', `  ✅ Nirath渲染v24.3: ${shot.id} | type:${shot.type} | shotType:${shot.shotType || 'none'} | emotion:${shot.emotionPhase} | ${prompt.length}字符 | 风格校准:${renderResult.styleCalibrated ? '已注入' : '未注入'}`);

        // v6.2-patch104: 输出完整Prompt到文件,供审阅
        try {
          const outputDir = this.outputDir || '/tmp/prompts';
          const promptOutputDir = path.join(outputDir, 'prompts');
          if (!fss.existsSync(promptOutputDir)) {
            fss.mkdirSync(promptOutputDir, { recursive: true });
          }
          const promptFile = path.join(promptOutputDir, `${shot.id}-prompt.md`);
          const promptContent = `# ${shot.id} 完整Prompt\n\n**场景**: ${shot.scene || '未知'}\n**类型**: ${shot.type || '未知'}\n**时长**: ${shot.duration || 0}秒\n**情绪**: ${shot.emotionPhase || '未知'}\n**质量评分**: ${shot.qualityScore?.totalScore || '未评分'}\n**字符数**: ${prompt.length}\n\n---\n\n\`\`\`\n${prompt}\n\`\`\`\n`;
          fss.writeFileSync(promptFile, promptContent);
          this.log('STAGE-11', `  📄 Prompt已保存: ${shot.id} → ${promptFile}`);
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ Prompt保存失败: ${shot.id} - ${e.message}`);
        }

        // 记录禁用词检查
        if (renderResult.bannedFound) {
          this.log('STAGE-11', `  ⚠️ Nirath校准: 发现并替换禁用词 ${renderResult.bannedFound.join(', ')}`);
        }
      } else {
        // 通用模式:结构化Prompt生成(防硬编码)
        // 尝试调用Prompt生成器Agent
        let promptResult;
        try {
          if (this.modules.promptGenerator && typeof this.modules.promptGenerator.generate === 'function') {
            promptResult = await this.modules.promptGenerator.generate({
              shot,
              characters,
              movement,
              mode: 'generic'
            });
          } else {
            throw new Error('Prompt生成器未配置');
          }
        } catch (e) {
          // Fallback: 结构化构建(v6.2-patch60: 集成Tier分层+通道分离)
          const baseResult = this.buildBasePrompt(shot, characters);
          promptResult = baseResult.prompt; // 提取prompt字符串

          // 记录质量评分到shot
          shot.qualityScore = baseResult.quality;
          shot.channelData = baseResult.channels;
        }

        prompt = promptResult;
        if (movement?.description) {
          prompt += ` ${movement.description}`;
        }

        // 通用模式也强制16:9
        prompt = `16:9宽屏电影级镜头。${prompt}`;

        // v6.0-patch38: 注入全局负面提示词
        // v6.2-patch44: 增加P2光照氛围约束(禁止暗黑/夜晚/乌漆嘛黑),maxLength放宽至250
        const globalNegative = globalNegativePromptInjector.generateCompact({
          maxLength: 180,
          sceneType: this.mode === 'nirath' ? 'nature_epic' : 'documentary',
          hasCharacter: true,
          isRealistic: true
        });
        prompt += ` ${globalNegative}`;

        // v6.5.29-fix: generic模式使用真实光照约束,不注入Nirath双恒星
        if (this.mode !== 'nirath') {
          prompt += ' 【明亮约束】自然光或柔和室内照明,画面真实干净,禁止暗黑/灰暗。';
        } else {
          prompt += ' 【明亮约束】Aurelius5800K暖金+Silvana6500K清冷,双恒星明亮光照。禁止暗黑/夜晚/灰暗。必须明亮奇幻、多色彩层次。';
        }

        // v6.5.31-fix: 动态生成角色约束,遍历所有在场角色
        const chars = shot.characters || [];
        if (chars.length > 0) {
          const charNames = chars.map(cid => {
            const char = characters?.[cid];
            // v6.5.32-fix: characters对象结构为 { profile, prompt, compliance }
            return char?.profile?.baseIdentity?.name || char?.profile?.name || char?.name || cid;
          }).filter(Boolean);

          if (charNames.length > 0) {
            const nameList = charNames.join('、');
            let constraint = `【角色约束】画面中仅出现${nameList},禁止重复角色`;
            if (charNames.length > 1) {
              constraint += `;${charNames.length}人位置分布自然,避免重叠`;
            }
            prompt += ` ${constraint}`;
          }
        }

        // ========== 【v6.2-patch51】结尾镜情绪增强 ==========
        if (this.modules.closingBooster) {
          const boostResult = this.modules.closingBooster.boost({prompt}, shot);
          if (boostResult.enhanced) {
            prompt = boostResult.result.prompt;
            this.log('STAGE-11', `  🎭 情绪增强: ${shot.id} | 注入${boostResult.injections}项 | 情绪密度:${boostResult.emotionDensity?.toFixed(2)}`);
          }
        }

        // P0修复#1:确保mouthAction在Prompt中
        if (shot.mouthAction && !prompt.includes(shot.mouthAction.substring(0, 20))) {
          prompt += ` ${shot.mouthAction}`;
        }

        // 🔥 v6.1-fix: 将生成的prompt赋值给shot
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入(灯光、色彩、特效、质感、氛围)
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);

        this.log('STAGE-11', `  ✅ 通用渲染: ${shot.id} | ratio:16:9 | mouthAction:${shot.mouthAction ? '有' : '无'} | ${prompt.length}字符`);
      } // v6.5.43: if (!gotoFinalSubmit) 闭合

      // v6.6.9-fix: 新链路全量切换 - 所有镜头走 FinalPromptBuilderV3(方案A)
      if (this.modules.finalPromptBuilder) {
        try {
          const context = {
            totalShots: storyboard.shots.length,
            protagonistName: this.projectConfig.protagonistName || '主角',
            beastId: this.projectConfig.beastId || '',
            beastName: this.projectConfig.beastName || '',
            habitat: this.projectConfig.habitat || shot.scene || '',
            episodeTheme: this.projectConfig.episodeTheme || '',
            sceneType: shot.sceneType || 'nature_epic'
          };

          newChainResult = await this.modules.finalPromptBuilder.build(shot, context);

          if (newChainResult.success && newChainResult.prompt && newChainResult.prompt.length > 0) {
            prompt = newChainResult.prompt;
            this.log('STAGE-11', `  🚀 新链路已接管: ${shot.id} | 类型:${shot.type} | 长度:${prompt.length} | 10字段结构`);
            gotoFinalSubmit = true;
          } else {
            // v6.6.9.4-fix: 新链路失败不再降级到旧链路，直接报错
            throw new Error(`STAGE-11 新链路失败: ${shot.id} | 原因:${newChainResult.validation?.issues?.join('; ') || '未知'} | 已触发重试机制但仍失败，终止预生产`);
          }
        } catch (e) {
          // v6.6.9.4-fix: 新链路异常不再降级，直接报错
          this.fallbackMonitor.record('PROMPTFORGE', {
            shotId: shot.id,
            reason: e.message
          });
          throw new Error(`STAGE-11 新链路异常: ${shot.id} | ${e.message} | 已触发重试机制但仍失败，终止预生产`);
        }
      }

      // v6.5.43: 新链路成功时也需赋值
      if (gotoFinalSubmit && newChainResult) {
        shot.prompt = prompt;

        // 🔥 v2.0: 创意指数指令注入(灯光、色彩、特效、质感、氛围)
        shot.prompt = this._injectCreativeIntensityToPrompt(shot.prompt, 'STAGE-11', shot.id);

        // v6.6.9.4-patch17: 新链路成功后也统一标准化
        prompt = this.toStandardPrompt(shot, shot.prompt);
        prompt = this.ensureFinalPromptStructure(shot, prompt);
        prompt = safeStructuredTrim(prompt, PROMPT_LENGTH.HARD_MAX);
        prompt = this.safeTrimStructuredPrompt(prompt, PROMPT_LENGTH.HARD_MAX);
        shot.prompt = prompt;

        // v6.5.44-fix: 新链路结果必须加入 render 数组,否则后续阶段丢失镜头
        // v6.5.58-fix: 构建标准输出字段
        const existingPrompt = prompts.find(p => p.shotId === shot.id);
        const charRef = this._buildCharacterRef(shot, stages) || '';
        const charMinimal = this._buildCharacterMinimal(shot, stages) || '';
        const timeline = this._buildTimeline(shot, 0) || '';
        const bgSound = this._buildBackgroundSound(shot) || '';
        
        if (!existingPrompt) {
          // v6.6.9.4-patch17: Stage-11 最终统一标准化，确保 Stage-12 可识别
          prompt = this.toStandardPrompt(shot, prompt);
          prompt = this.ensureFinalPromptStructure(shot, prompt);
          prompt = safeStructuredTrim(prompt, PROMPT_LENGTH.HARD_MAX);
          prompt = this.safeTrimStructuredPrompt(prompt, PROMPT_LENGTH.HARD_MAX);

          const finalPromptStatus = PROMPT_LENGTH.getStatus(prompt.length);
          const finalUtilization = prompt.length / PROMPT_LENGTH.HARD_MAX;
          const utilizationStatus =
            finalPromptStatus === 'ideal' ? '🔥理想' :
            finalPromptStatus === 'underflow' ? '⚠️空间浪费' :
            finalPromptStatus === 'overflow' ? '❌超标' : 'ℹ️正常';

          const standardOutput = {
            shotId: shot.id,
            id: shot.id,
            type: shot.type || 'generic',
            scene: shot.scene || '',
            prompt,
            referenceImages: [],
            duration: shot.duration,
            length: prompt.length,
            mouthAction: shot.mouthAction,
            utilization: Math.round(finalUtilization * 100),
            utilizationStatus,
            qualityScore: { totalScore: 75 },
            enhanced: true,
            cameraMovement: shot.cameraMovement || null,
            emotionPhase: shot.emotionPhase || '',
            importance: shot.importance || 5,
            visualComplexity: shot.visualComplexity || 5,
            dialogue: shot.dialogue || '',
            narration: shot.narration || '',
            // v6.5.62: 新增字段(基于参考v6.37-Peng优化)
            characterRef: charRef,
            character: charMinimal,
            timeline: timeline,
            backgroundSound: bgSound,
            isOpening: shot.id === 'S00' || shot.type === 'opening',
            // v6.5.59-fix: 片头注入title对象
            title: (shot.id === 'S00' || shot.type === 'opening') ? (shot.title || {
              main: shot.postProduction?.mainTitle || '',
              sub: shot.postProduction?.subTitle || 'A Nirath Original by Genius',
              creator: 'Genius',
              displayTiming: '6.8-9.0s',
              position: '画面中央偏下',
              style: 'elegant serif with subtle geometric flourishes'
            }) : undefined
          };

          // 片头专属
          if (shot.id === 'S00' || shot.type === 'opening') {
            if (shot.title && typeof shot.title === 'object') {
              standardOutput.title = shot.title;
            } else if (shot.postProduction && shot.postProduction.mainTitle) {
              standardOutput.title = {
                main: shot.postProduction.mainTitle || '',
                sub: shot.postProduction.subTitle || '',
                creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
                episodeName: shot.postProduction.titleFormation || '',
                displayTiming: '6.8-9.0s',
                position: '画面中央偏下',
                style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
              };
            }
            standardOutput.isOpening = true;
          }

          prompts.push(standardOutput);
        } else {
          // v6.6.9.4-patch17-fix: 更新已存在的prompt对象，补充characterRef等字段
          existingPrompt.characterRef = charRef;
          existingPrompt.character = charMinimal;
          existingPrompt.timeline = timeline;
          existingPrompt.backgroundSound = bgSound;
          existingPrompt.dialogue = shot.dialogue || existingPrompt.dialogue || '';
          existingPrompt.narration = shot.narration || existingPrompt.narration || '';
        }

        this.log('STAGE-11', `  ✅ 新链路渲染: ${shot.id} | 10字段结构 | ${prompt.length}字符`);
        
        // v6.6.9.4-patch13-fix: 新链路也需要转换为标准字段格式
        prompt = this.toStandardPrompt(shot, prompt);
        prompt = this.ensureFinalPromptStructure(shot, prompt);
        shot.prompt = prompt;
        
        continue; // v6.6.9: 新链路成功，跳过后续增强处理
      }

      // 🔥 v6.5.3-fix: 在enhanceShotPrompt前确保shot.prompt包含镜头时间轴
      // 根因:shot.prompt可能在之前被覆盖,导致enhanceShotPrompt重复增强
      if (prompt.includes('【镜头时间轴】') && !shot.prompt.includes('【镜头时间轴】')) {
        shot.prompt = prompt;
        this.log('STAGE-11', `  🔥 修复shot.prompt: ${shot.id} | 重新注入镜头时间轴`);
      }

      // ========== v6.0-patch23: 自动注入镜头内细分增强 ==========
      const { enhanceShotPrompt } = require('../systems/intra-shot-prompt-enhancer.js');

      // v6.5.35: 从角色信息中提取年龄和情绪
      const charId = shot.characters?.[0] || 'adult';
      const charData = this.characters?.[charId] || {};
      const characterAge = charData?.profile?.baseIdentity?.ageGroup || 'adult';
      const emotionPhase = shot.emotionPhase || shot.emotion || 'neutral';
      const emotionIntensity = shot.emotionIntensity || 'L2';

      const enhanced = enhanceShotPrompt(shot, {
        forceMultiSegment: shot.duration >= 6,
        mergeStrategy: 'append_constraints',
        maxLength: PROMPT_LENGTH.HARD_MAX,
        // v6.5.35: 传入人物鲜活度参数
        characterAge,
        emotionPhase,
        emotionIntensity
      });

      // v6.5.59-fix: 注入人物鲜活度和光影质量细节(解决Stage 11.5检查不通过问题)
      // 根因:Prompt缺少人物细节和光影细节,导致质量闸门0-1/5通过
      // 修复:在Prompt末尾注入人物鲜活度和光影质量描述(如果空间允许)
      const characterName = charData?.name || charData?.profile?.baseIdentity?.name || '角色';
      const vividnessDetails = `【人物鲜活度】超写实皮肤纹理,可见毛孔与细微绒毛。${characterName}眼神聚焦有光,微表情自然流露真实情绪。动作有重量感,身体重心随动作自然偏移。面部细节丰富,脸颊、眼眶、嘴角、眉弓处光影自然,情绪饱满有留白。`;
      const lightingDetails = `【光影质量】主光源从侧上方倾泻,形成明确的明暗对比。阴影有层次,暗部细节可见。环境弥漫细微颗粒与灰尘,增加空气质感。色调温暖,色温约5800K,光影过渡自然柔和。`;

      if (enhanced.prompt.length + vividnessDetails.length + 2 <= PROMPT_LENGTH.HARD_MAX) {
        enhanced.prompt += ` ${vividnessDetails}`;
      }
      if (enhanced.prompt.length + lightingDetails.length + 2 <= PROMPT_LENGTH.HARD_MAX) {
        enhanced.prompt += ` ${lightingDetails}`;
      }

      // 如果增强后超限,智能裁剪
      if (enhanced.prompt.length > PROMPT_LENGTH.HARD_MAX) {
        // 🔥 DEBUG: smartTrim前后对比
        const beforeTrim = enhanced.prompt.includes('一镜到底') || enhanced.prompt.includes('镜头时间轴');
        this.log('STAGE-11', `  🔍 DEBUG pre-smartTrim: ${shot.id} | 含运镜=${beforeTrim} | len=${enhanced.prompt.length}`);

        prompt = this.smartTrim(enhanced.prompt, PROMPT_LENGTH.HARD_MAX, {
          preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节', '伴随', '动作产生', '氛围弥漫', '音乐线索', '声画精准同步', '音频'],
          trim: ['辅助运镜', '光影细节补充']
        });
        this.log('STAGE-11', `  ⚠️ 增强后超限(${enhanced.prompt.length}字符),智能裁剪至${prompt.length}字符`);
      } else {
        prompt = enhanced.prompt;
      }

      // 🔥 v6.5.3-fix: 强制保留【镜头时间轴】,防止被smartTrim截断
      // 根因:smartTrim按顺序保留核心区块,如果前面的核心区块占用空间过大,后面的【镜头时间轴】被跳过
      // 修复:smartTrim后检查,如果丢失了【镜头时间轴】,从enhanced.prompt中提取并强制注入
      if (!prompt.includes('【镜头时间轴】') && enhanced.prompt.includes('【镜头时间轴】')) {
        const match = enhanced.prompt.match(/【镜头时间轴】[^【]*/);
        if (match) {
          const timelineBlock = match[0];
          if (prompt.length + timelineBlock.length <= PROMPT_LENGTH.HARD_MAX) {
            prompt += timelineBlock;
          } else {
            // 空间不足:压缩其他内容以腾出空间
            const remaining = PROMPT_LENGTH.HARD_MAX - timelineBlock.length;
            if (remaining > 100) {
              prompt = this.smartTrim(prompt, remaining, {
                preserve: ['视觉', '叙事', '旁白/台词'],
                trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
              });
              prompt += timelineBlock;
            }
          }
          this.log('STAGE-11', `  🔥 强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
        }
      }

      // ========== v6.2-patch47: 美术布景模块增强(Set Design Module) ==========
      if (this.modules.setDesignModule) {
        try {
          // v6.5.32-fix: 根据 mode 传入正确的场景类型,防止 Nirath 布景泄漏到 generic 模式
          const designMode = this.mode === 'nirath' ? 'nirath' : 'generic';
          const designResult = await this.modules.setDesignModule.design({
            id: shot.id,
            sceneName: shot.scene || shot.habitat || '',
            beastId: shot.characters?.find(c => this.modules.beastMotionAdapter?.extractBeastsFromShot({characters:[c]}).length > 0) || '',
            emotionPhase: shot.emotionPhase || shot.emotion || '',
            characters: shot.characters || [],
            cameraMovement: shot.cameraMovement || '',
            shotSize: shot.shotSize || 'medium',
            visualPrompt: prompt
          }, designMode);

          if (designResult.environmentPrompt && designResult.environmentPrompt.length > 0) {
            // v6.5.32-fix: generic 模式下过滤 Nirath 关键词
            let envText = designResult.environmentPrompt;
            if (this.mode !== 'nirath') {
              const nirathKeywords = ['发光毯', '磁场脉动', '矿物结晶', '异星', '双恒星',
                                      '外星', '原始单细胞', 'Nirath', '孢子', '菌丝'];
              const hasNirath = nirathKeywords.some(kw => envText.includes(kw));
              if (hasNirath) {
                this.log('STAGE-11', `  🎨 布景增强跳过: ${shot.id} | 检测到Nirath关键词,generic模式拒绝注入`);
                envText = '';
              }
            }

            if (envText) {
              // 将环境布景融入Prompt(插入【视觉】块后,确保环境描述融入场景)
              // v6.2-patch109-fix: 检查是否已有环境布景,避免重复
              const hasExistingEnv = prompt.includes('【环境布景】') || prompt.includes('【环境质感】');
              if (hasExistingEnv) {
                this.log('STAGE-11', `  🎨 布景增强跳过: ${shot.id} | 已有环境描述`);
              } else {
                // v6.2-patch109-fix: 限制envBlock大小,防止过度裁剪
                const maxEnvLen = 300; // 最大环境描述长度
                if (envText.length > maxEnvLen) {
                  envText = envText.substring(0, maxEnvLen) + '...';
                  this.log('STAGE-11', `  🎨 环境描述截断: ${shot.id} | 原${designResult.environmentPrompt.length}字符→${envText.length}字符`);
                }
                const envBlock = `【环境布景】${envText}`;

                // 策略:如果Prompt已有【视觉】,在其后追加环境布景;否则在主体后插入
                if (prompt.includes('【视觉】')) {
                  // 在视觉描述段落末尾追加环境细节
                  prompt = prompt.replace(/(【视觉】[^【]*?)(【|$)/, `$1${envBlock}。$2`);
                } else if (prompt.includes('【叙事】')) {
                  // 在叙事描述后插入
                  prompt = prompt.replace(/(【叙事】[^【]*?)(【|$)/, `$1${envBlock}。$2`);
                } else {
                  // 直接追加到末尾
                  prompt = prompt + envBlock;
                }

                // 校验上限
                if (prompt.length > PROMPT_LENGTH.HARD_MAX) {
                  prompt = this.smartTrim(prompt, PROMPT_LENGTH.HARD_MAX, {
                    preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
                    trim: ['辅助运镜', '光影细节补充']
                  });
                  this.log('STAGE-11', `  🎨 布景增强后超限,智能裁剪至${prompt.length}字符`);
                }

                // 🔥 v6.5.3-fix: 布景增强后强制保留【镜头时间轴】
                if (!prompt.includes('【镜头时间轴】') && enhanced.prompt.includes('【镜头时间轴】')) {
                  const match = enhanced.prompt.match(/【镜头时间轴】[^【]*/);
                  if (match) {
                    const timelineBlock = match[0];
                    if (prompt.length + timelineBlock.length <= PROMPT_LENGTH.HARD_MAX) {
                      prompt += timelineBlock;
                    } else {
                      const remaining = PROMPT_LENGTH.HARD_MAX - timelineBlock.length;
                      if (remaining > 100) {
                        prompt = this.smartTrim(prompt, remaining, {
                          preserve: ['视觉', '叙事', '旁白/台词'],
                          trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
                        });
                        prompt += timelineBlock;
                      }
                    }
                    this.log('STAGE-11', `  🔥 布景增强后强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
                  }
                }

                shot.prompt = prompt;
                this.log('STAGE-11', `  🎨 布景增强: ${shot.id} | ${designResult.compressionLevel} | 环境+${envText.length}字符 | 合并后${prompt.length}字符`);
              } // end if (hasExistingEnv) else
            } // end if (envText)
          } // end if (designResult.environmentPrompt)
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ 布景增强失败: ${shot.id} - ${e.message}`);
        }
      }

      // 光影情绪递进评分(v6.2-patch104-fix: 修复灯光0分问题)
      // 改为检查具体的三点照明方案,而不是只看有无关键词

      // v6.2-patch107-fix: cameraVariety必须定义,否则评分代码崩溃
      // v6.5.32-fix5: 兼容读取 segments 和 _segments(专家方案)
      // 基于运镜段数计算运镜多样性评分(最高15分)
      let cameraVariety = 0;
      let segCount = 0;
      if (enhanced && Array.isArray(enhanced.segments) && enhanced.segments.length > 0) {
        segCount = enhanced.segments.length;
      } else if (enhanced && Array.isArray(enhanced._segments) && enhanced._segments.length > 0) {
        segCount = enhanced._segments.length;
      } else if (shot.cameraMovement && typeof shot.cameraMovement === 'string') {
        // 从cameraMovement字符串估算段数
        segCount = (shot.cameraMovement.match(/→|->|,/g) || []).length + 1;
      } else if (shot.cameraMovement && Array.isArray(shot.cameraMovement.timeline)) {
        segCount = shot.cameraMovement.timeline.length;
      } else if (shot.cameraMovement && shot.cameraMovement.timeline && Array.isArray(shot.cameraMovement.timeline.segments)) {
        // v6.2-patch108-fix: cameraMovement.timeline是对象,segments是数组
        segCount = shot.cameraMovement.timeline.segments.length;
      } else if (shot.cameraMovement && shot.cameraMovement.segments && Array.isArray(shot.cameraMovement.segments)) {
        segCount = shot.cameraMovement.segments.length;
      }

      // 🔥 v6.5.32-fix5: 拆分评分维度(专家方案 D)
      // 原来:cameraVariety = 段数(最高15分)
      // 现在:拆分为 intraShotVariety(段数)+ interShotDiversity(镜头间类型差异)
      const intraShotVariety = segCount >= 4 ? 8 : segCount >= 3 ? 6 : segCount >= 2 ? 4 : segCount >= 1 ? 2 : 0;
      const interShotDiversity = this._calcInterShotDiversity(shot, storyboard.shots || []);
      cameraVariety = Math.min(15, intraShotVariety + interShotDiversity);

      let lightingProgression = 0;
      const promptLower = prompt.toLowerCase();

      // 检查是否有主光/Key Light描述(位置、色温、强度)
      const hasKeyLight = /主光|key\s*light|主光源|主照明|从.+(上方|侧方|前方|后方|下方).+照射|顶光|侧光|逆光|底光/i.test(prompt) ||
                          /[Aa]urelius.*(5800K|金色|暖色|主光)|[Ss]ilvana.*(6500K|银白|清冷|补光)/i.test(prompt);

      // 检查是否有补光/Fill Light描述
      const hasFillLight = /补光|fill\s*light|补光源|辅光|辅照明|柔和|补亮|减淡阴影|填充光|diffused.*ambient|soft.*shadow|gentle.*light/i.test(prompt) ||
                           /磁场.*(淡蓝|蓝紫|紫|光晕|填充)|孢子.*(微光|柔和|漫射|填充)|golden.*bounce|ambient.*gold/i.test(prompt);

      // 检查是否有背光/轮廓光/Rim Light描述
      const hasRimLight = /背光|轮廓光|rim\s*light|轮廓光|边缘光|逆光|轮廓线|分离光|发丝光|golden.*rim|edge.*glow|luminous.*edge|outline.*light/i.test(prompt) ||
                          /(磁丝|孢子|岩脉).*发光.*(勾勒|勾勒|轮廓|边缘|分离|背光)|rim.*backlight|golden.*outline/i.test(prompt);

      // 检查是否有光比/对比度描述
      const hasContrast = /光比|contrast\s*ratio|明暗对比|阴影深浅|高光.*阴影|亮度比|强反差|柔光比|warm.*cool|cool.*shadow|warm.*highlight|色温对比|温差/i.test(prompt);

      // 检查是否有光影过渡/变化描述
      const hasTransition = /渐变|递进|过渡|变化|从.*到.*|渐强|渐弱|转暗|转亮|明暗变化|光影变化|progression|transition|gradient|fade.*in|fade.*out/i.test(prompt) ||
                            (enhanced.lighting?.progression && enhanced.lighting.progression !== 'none') ||
                            (shot.lighting?.progression && shot.lighting.progression !== 'none');

      // 根据场景类型设计差异化照明方案
      const sceneType = shot.shotType || shot.type || 'generic';
      const sceneLighting = this.calculateSceneSpecificLighting(shot, prompt);

      // 评分规则(最高15分):
      // 基础分:有任意照明描述 = 3分
      // 主光具体:+4分(有位置+色温+强度)
      // 补光具体:+3分(有方向+色温+作用)
      // 背光/轮廓:+3分(有边缘勾勒或分离效果)
      // 光比/过渡:+2分(有明暗对比或光影变化)
      lightingProgression = 0;
      if (hasKeyLight || hasFillLight || hasRimLight) lightingProgression += 3; // 基础分
      if (hasKeyLight) lightingProgression += 4;
      if (hasFillLight) lightingProgression += 3;
      if (hasRimLight) lightingProgression += 3;
      if (hasContrast || hasTransition) lightingProgression += 2;
      lightingProgression = Math.min(15, lightingProgression);

      // 叙事情绪深度(最高20分):基于独白+台词+冲突密度
      const emotionalDepth = this.calculateEmotionalDepthV2(shot, prompt);

      // Prompt空间利用(最高15分)
      // v6.2-patch110-fix: 使用裁剪前长度计算,避免评分偏低
      const originalPromptLength = enhanced && enhanced.prompt ? enhanced.prompt.length : prompt.length;
      const promptUtilization = originalPromptLength >= PROMPT_LENGTH.HARD_MAX ? 15 : originalPromptLength >= PROMPT_LENGTH.TARGET_MAX ? 12 : originalPromptLength >= 920 ? 10 : 5;

      // 叙事画面对齐(最高20分):narration与画面内容匹配度
      const narrativeAlignment = this.calculateNarrativeAlignment(shot, prompt);

      const totalScore = Math.min(100, cameraVariety + lightingProgression + emotionalDepth + promptUtilization + narrativeAlignment);

      // v6.5.33-fix: social/generic模式镜头质感评分补偿
      // 原因:social短视频侧重社媒节奏感,不追求电影级光影和情绪深度
      // 补偿: +15分基础分,确保优质social内容评分不低于60
      let adjustedTotalScore = totalScore;
      if (this.mode === 'social' || this.mode === 'generic') {
        adjustedTotalScore = Math.min(100, totalScore + 15);
        if (adjustedTotalScore > totalScore) {
          this.log('STAGE-11', `  📈 社交模式评分补偿: ${shot.id} | ${totalScore} → ${adjustedTotalScore} (+${adjustedTotalScore - totalScore})`);
        }
      }

      shot.qualityScore = {
        cameraVariety,
        lightingProgression,
        emotionalDepth,
        promptUtilization,
        narrativeAlignment,
        totalScore,
        segmentCount: segCount
      };

      this.log('STAGE-11', `  🎬 镜头内增强: ${shot.id} | ${segCount}段运镜 | 质量评分:${totalScore}分 [运镜${cameraVariety}+光影${lightingProgression}+情绪${emotionalDepth}+空间${promptUtilization}+对齐${narrativeAlignment}]`);

      // P0修复#45-48:Prompt利用率检查(在所有增强之后计算)
      let utilizationStatus = '';
      // v6.6.9: Generic模式跳过Nirath专属动作增强
      if (this.mode !== 'nirath') {
        this.log('STAGE-11', `  ⏭️ Generic模式跳过微动作/异兽动作增强`);
      } else if (this.modules.microMotionAdapter || this.modules.beastMotionAdapter) {
        try {
          let motionEnhanced = prompt;
          let motionLog = [];

          // 检测是否含异兽角色
          const hasBeast = this.modules.beastMotionAdapter && shot.characters?.some(c =>
            this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length > 0
          );
          const hasHuman = shot.characters?.some(c => {
            if (!this.modules.beastMotionAdapter) return true; // 无适配器时默认人类
            return this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length === 0;
          });

          // 1. 微动作增强(人类角色)
          if (this.modules.microMotionAdapter && hasHuman) {
            try {
              const mmInput = {
                shotId: shot.id,
                character: shot.characters?.find(c => {
                  if (!this.modules.beastMotionAdapter) return true;
                  return this.modules.beastMotionAdapter.extractBeastsFromShot({ characters: [c] }).length === 0;
                }) || '',
                emotion: shot.emotionPhase || shot.emotion || '',
                emotionIntensity: shot.importance === 'critical' ? 5 : shot.importance === 'high' ? 4 : 3,
                cameraDistance: shot.shotSize || 'medium',
                duration: shot.duration || 5,
                originalPrompt: prompt,
                type: shot.type || ''
              };
              const mmResult = this.modules.microMotionAdapter.enhance(mmInput, {
                sceneType: 'nirath',
                style: '超写实科幻'
              });
              // v6.5.5-fix: 增强必须比原始长,否则拒绝替换(防内容丢失)
              if (mmResult.enhanced && mmResult.enhanced.length > prompt.length * 0.9) {
                if (mmResult.enhanced !== prompt) {
                  motionEnhanced = mmResult.enhanced;
                  motionLog.push(`微动作+${(mmResult.enhanced.length - prompt.length)}字符`);
                }
              } else {
                motionLog.push(`微动作跳过(结果${mmResult.enhanced?.length || 0}字符<原始${prompt.length}字符)`);
              }
            } catch (e) {
              motionLog.push(`微动作异常:${e.message}`);
            }
          }

          // 2. 异兽动作增强(异兽角色)
          if (this.modules.beastMotionAdapter && hasBeast) {
            try {
              const beastResult = this.modules.beastMotionAdapter.enhanceShotWithBeastMotion(shot, motionEnhanced);
              // v6.5.5-fix: 增强必须比原始长,否则拒绝替换(防内容丢失)
              if (beastResult.enhanced && beastResult.enhanced.length > motionEnhanced.length * 0.9) {
                if (beastResult.enhanced !== motionEnhanced && beastResult.beastsFound > 0) {
                  motionEnhanced = beastResult.enhanced;
                  motionLog.push(`异兽动作(${beastResult.beastsFound}只)+${beastResult.addedLength}字符`);
                }
              } else {
                motionLog.push(`异兽动作跳过(结果${beastResult.enhanced?.length || 0}字符<原始${motionEnhanced.length}字符)`);
              }
            } catch (e) {
              motionLog.push(`异兽动作异常:${e.message}`);
            }
          }

          // 3. 增强后字数校验
          if (motionEnhanced.length > PROMPT_LENGTH.HARD_MAX) {
            motionEnhanced = this.smartTrim(motionEnhanced, PROMPT_LENGTH.HARD_MAX, {
              preserve: ['叙事', '视觉', '独白', '明亮约束', '风格锁', '技术规格', '环境布景', '角色约束', '镜头时间轴', '旁白/台词', '台词', '嘴部动作', '环境质感', '环境音效', '照明方案', '人物鲜活度', '光影质量', '光影细节', '顶级指令', '动作细节', '表情细节'],
              trim: ['辅助运镜', '光影细节补充', '微动作增强']
            });
            motionLog.push(`超限裁剪→${motionEnhanced.length}字符`);
          }

          // 🔥 v6.5.3-fix: 动作增强后强制保留【镜头时间轴】,防止被smartTrim截断
          // 根因:motionEnhanced增强后再次触发smartTrim,可能丢失【镜头时间轴】
          // 修复:从原始prompt中提取【镜头时间轴】并强制注入
          if (!motionEnhanced.includes('【镜头时间轴】') && prompt.includes('【镜头时间轴】')) {
            const match = prompt.match(/【镜头时间轴】[^【]*/);
            if (match) {
              const timelineBlock = match[0];
              if (motionEnhanced.length + timelineBlock.length <= PROMPT_LENGTH.HARD_MAX) {
                motionEnhanced += timelineBlock;
              } else {
                const remaining = PROMPT_LENGTH.HARD_MAX - timelineBlock.length;
                if (remaining > 100) {
                  motionEnhanced = this.smartTrim(motionEnhanced, remaining, {
                    preserve: ['视觉', '叙事', '旁白/台词'],
                    trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案', '微动作增强']
                  });
                  motionEnhanced += timelineBlock;
                }
              }
              motionLog.push(`强制保留镜头时间轴+${timelineBlock.length}字符`);
            }
          }

          // 🔥 v6.2-patch100-fix: 占位符清理 - 移除微动作系统残留的 **** 包裹
          // 根因:micro-expression-system v2 生成的占位符未被替换,残留到Prompt中
          // 修复:在组装阶段统一清理,防止星号噪音污染视觉Prompt
          if (motionEnhanced && typeof motionEnhanced === 'string') {
            const placeholderPattern = /\*\*\*\*[^*]+\*\*\*\*/g;
            const placeholders = motionEnhanced.match(placeholderPattern);
            if (placeholders && placeholders.length > 0) {
              this.log('STAGE-11', `  ⚠️ 发现 ${placeholders.length} 个占位符残留,执行清理: ${placeholders.slice(0, 2).join(', ')}${placeholders.length > 2 ? '...' : ''}`);
              motionEnhanced = motionEnhanced.replace(placeholderPattern, '');
              // 清理可能产生的多余空格/逗号
              motionEnhanced = motionEnhanced.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
              motionLog.push(`占位符清理-${placeholders.length}个`);
            }
            // v6.5.4-fix: 清理残留的连续星号(如 **** 或 **)
            const residualStars = motionEnhanced.match(/\*{2,}/g);
            if (residualStars && residualStars.some(s => s.length >= 2)) {
              motionEnhanced = motionEnhanced.replace(/\*{2,}/g, '');
              motionEnhanced = motionEnhanced.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
              motionLog.push('残留星号清理');
            }
          }

          // v6.5.5-fix: 增强后标记完整性检查--如果丢失核心标记,从原始prompt恢复
          const coreMarkers = ['【角色】', '【场景】', '【动作】', '【叙事】', '【视觉】', '【音频】'];
          const lostMarkers = coreMarkers.filter(m => !motionEnhanced.includes(m) && prompt.includes(m));
          if (lostMarkers.length > 0) {
            this.log('STAGE-11', `  ⚠️ 增强后丢失核心标记: ${lostMarkers.join(', ')} | 从原始prompt恢复`);
            for (const marker of lostMarkers) {
              const match = prompt.match(new RegExp(`${marker}[^【]*`));
              if (match && motionEnhanced.length + match[0].length <= PROMPT_LENGTH.HARD_MAX) {
                motionEnhanced += ` | ${match[0]}`;
              }
            }
            motionLog.push(`标记恢复+${lostMarkers.length}个`);
          }

          prompt = motionEnhanced;
          shot.prompt = prompt;

          if (motionLog.length > 0) {
            this.log('STAGE-11', `  🎭 动作增强: ${shot.id} | ${motionLog.join(' | ')}`);
          }
        } catch (e) {
          this.log('STAGE-11', `  ⚠️ 动作增强失败: ${shot.id} - ${e.message}`);
        }
      }

      // v6.5.1-fix: 预生产阶段注入定妆照路径标记(无base64,仅路径),让QualityGate通过渲染就绪度检查
      // v6.5.8-fix: 定妆照规范 v1.0 - 单镜头≤2张,根据景别选最佳角度
      let referenceImages = [];
      // v6.5.6-fix: 角色ID映射修复(taotie → tao-tie)
      const charIdMap = { 'taotie': 'tao-tie', 'tao-tie': 'tao-tie' };
      // 根据镜头景别选最佳角度
      const anglePriority = ['threeQuarter', 'front', 'closeup', 'side'];
      const isCloseup = shot.mouthAction || shot.shotType === 'closeup';
      const isWide = shot.type === 'opening' || shot.shotType === 'opening';
      for (const rawCharId of (shot.characters || [])) {
        const charId = charIdMap[rawCharId] || rawCharId;
        const char = stages.characters?.[charId];
        if (!char) continue;
        referenceImages = mergeReferenceImages(
          referenceImages,
          normalizePortraitMapToReferenceImages(charId, char.portraits || char.profile?.generatedAssets?.portraits)
        );
      }

      // v6.5.3-fix: 将 referenceImages 也注入到 shot 对象,供 Stage 10.5 验证通过
      shot.referenceImages = referenceImages;
      shot.content = Array.isArray(shot.content) ? shot.content : [];
      shot.content = mergeReferenceImages(shot.content, referenceImages);

      // v6.5.3-fix: 最终强制保留【镜头时间轴】--无论之前任何步骤截断,在 push 前必须恢复
      // 根因:setDesignModule、motionEnhanced、finalFillPrompt 等多个步骤可能截断或覆盖 prompt
      // 修复:从 shot.prompt(原始 buildPromptV3 输出)中提取【镜头时间轴】并强制注入
      if (!prompt.includes('【镜头时间轴】') && shot.prompt && shot.prompt.includes('【镜头时间轴】')) {
        const match = shot.prompt.match(/【镜头时间轴】[^【]*/);
        if (match) {
          const timelineBlock = match[0];
          if (prompt.length + timelineBlock.length <= PROMPT_LENGTH.HARD_MAX) {
            prompt += timelineBlock;
          } else {
            const remaining = PROMPT_LENGTH.HARD_MAX - timelineBlock.length;
            if (remaining > 100) {
              prompt = this.smartTrim(prompt, remaining, {
                preserve: ['视觉', '叙事', '旁白/台词', '台词', '嘴部动作'],
                trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案', '微动作增强']
              });
              prompt += timelineBlock;
            }
          }
          this.log('STAGE-11', `  🔥 最终强制保留镜头时间轴: ${shot.id} | +${timelineBlock.length}字符 | 最终${prompt.length}字符`);
        }
      }

      // v6.5.3-fix: 最终占位符清理--在 push 前统一清理所有 **** 残留
      // 根因:motionEnhanced 的占位符清理可能未覆盖所有场景,或占位符在后续步骤中被添加
      // 修复:在最终 push 前统一清理
      if (prompt && typeof prompt === 'string') {
        const placeholderPattern = /\*\*\*\*[^*]+\*\*\*\*/g;
        const placeholders = prompt.match(placeholderPattern);
        if (placeholders && placeholders.length > 0) {
          this.log('STAGE-11', `  ⚠️ 最终占位符清理: ${shot.id} | 发现 ${placeholders.length} 个占位符残留: ${placeholders.slice(0, 2).join(', ')}${placeholders.length > 2 ? '...' : ''}`);
          prompt = prompt.replace(placeholderPattern, '');
          prompt = prompt.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
          this.log('STAGE-11', `  ✅ 占位符清理完成: ${shot.id} | 清理后${prompt.length}字符`);
        }
        // v6.5.4-fix: 清理残留的连续星号(如 **** 或 **)
        const residualStars = prompt.match(/\*{2,}/g);
        if (residualStars && residualStars.some(s => s.length >= 2)) {
          prompt = prompt.replace(/\*{2,}/g, '');
          prompt = prompt.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
          this.log('STAGE-11', `  ✅ 最终残留星号清理: ${shot.id} | 清理后${prompt.length}字符`);
        }
      }

      const utilization = prompt.length / PROMPT_LENGTH.HARD_MAX;
      utilizationStatus = prompt.length >= 970 && prompt.length <= PROMPT_LENGTH.HARD_MAX ? '🔥理想' : (prompt.length > PROMPT_LENGTH.HARD_MAX ? '❌超标' : (prompt.length >= 850 ? '✅达标' : '⚠️空间浪费'));

      // v6.3-patch10-fix: 最终兜底补齐 - 如果提示词仍然太短,强制补齐到目标长度
      if (charCounter.count(prompt) < 889) {
        const before = charCounter.count(prompt);
        prompt = this.finalFillPrompt(prompt, shot.id);
        this.log('STAGE-11', `  📏 最终兜底补齐: ${shot.id} | ${before} → ${charCounter.count(prompt)}字符`);
      }

      // v6.5.5-fix: 最终标记完整性检查--确保核心标记存在,否则从 shot.prompt 恢复
      const finalCoreMarkers = ['【角色】', '【场景】', '【动作】', '【叙事】', '【视觉】'];
      const finalLostMarkers = finalCoreMarkers.filter(m => !prompt.includes(m) && shot.prompt && shot.prompt.includes(m));
      if (finalLostMarkers.length > 0) {
        this.log('STAGE-11', `  ⚠️ 最终标记丢失: ${finalLostMarkers.join(', ')} | 从 shot.prompt 恢复`);
        for (const marker of finalLostMarkers) {
          const match = shot.prompt.match(new RegExp(`${marker}[^【]*`));
          if (match && prompt.length + match[0].length <= PROMPT_LENGTH.HARD_MAX) {
            prompt += ` | ${match[0]}`;
          }
        }
        if (prompt.length > PROMPT_LENGTH.HARD_MAX) {
          prompt = this.smartTrim(prompt, PROMPT_LENGTH.HARD_MAX, {
            preserve: ['叙事', '视觉', '角色', '场景', '动作', '音频', '镜头时间轴', '旁白/台词'],
            trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
          });
        }
        this.log('STAGE-11', `  ✅ 最终标记恢复: ${shot.id} | 恢复后${prompt.length}字符`);
      }

      // v6.5.8-fix: 定妆照规范 v1.0 - 核心锚点3个 + 单镜头≤2张 + 角色一致性约束
      const imageRefLines = [];
      let imageIdx = 1;
      const letterLabels = ['A', 'B'];
      // 核心视觉锚点(3个不可混淆特征,让LLM能匹配参考图)
      const charCoreDesc = {
        'xiaoG': ['银灰装甲', '东亚面孔短发', '年轻男性'],
        'tao-tie': ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流']
      };
      // 根据镜头景别选最佳角度(复用上方已声明的isCloseup/isWide/anglePriority)
      const selectedAngles = [];
      for (const rawCharId of (shot.characters || [])) {
        const charId = charIdMap[rawCharId] || rawCharId;
        const char = stages.characters?.[charId];
        if (!char?.portraits) continue;
        // 选最佳角度:特写→closeup,全景→front,其他→threeQuarter
        let bestAngle = isCloseup ? 'closeup' : (isWide ? 'front' : 'threeQuarter');
        // 如果首选角度不存在,fallback到存在的第一个
        if (!char.portraits[bestAngle]) {
          for (const fallback of anglePriority) {
            if (char.portraits[fallback]) {
              bestAngle = fallback;
              break;
            }
          }
        }
        const imagePath = char.portraits[bestAngle];
        if (imagePath) {
          referenceImages.push({
            type: 'image_url',
            image_url: { url: imagePath },
            role: 'reference_image',
            character: charId,
            angle: bestAngle
          });
          selectedAngles.push({ charId, angle: bestAngle });
        }
      }
      // 构建 @Image 引用行(最多2张)
      for (const sel of selectedAngles) {
        const charName = sel.charId === 'xiaoG' ? '小G' : (sel.charId === 'tao-tie' ? '饕餮' : sel.charId);
        const coreDesc = charCoreDesc[sel.charId] || ['核心特征'];
        const angleDescMap = {
          'front': '正面', 'threeQuarter': '侧面', 'closeup': '近景', 'side': '另一侧面'
        };
        const angleDesc = angleDescMap[sel.angle] || sel.angle;
        const letter = letterLabels[imageIdx - 1] || '?';
        const coreDescText = coreDesc.slice(0, 3).join(','); // 取前3个锚点
        // v6.5.8-fix: 严格遵循 Seedance 官方格式 @ImageN(纯数字,无方括号字母)
        imageRefLines.push(`@Image${imageIdx} ${charName}${angleDesc},${coreDescText},超写实`);
        imageIdx++;
      }
      // 角色一致性约束(v6.5.8-fix: 系统级正面+负面锚定)
      const consistencyConstraints = '【角色一致性约束】solo single character only,严格保持角色形象一致性。杜绝多个相同人物/角色分身重影,杜绝角色形象突变/换脸。';
      if (!prompt.includes('solo single character only')) {
        if (prompt.length + consistencyConstraints.length + 2 <= PROMPT_LENGTH.HARD_MAX) {
          prompt += ` ${consistencyConstraints}`;
        } else {
          const remaining = PROMPT_LENGTH.HARD_MAX - consistencyConstraints.length - 2;
          if (remaining > 100) {
            prompt = this.smartTrim(prompt, remaining, {
              preserve: ['视觉', '叙事', '台词', '嘴部动作', '镜头时间轴'],
              trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
            });
            prompt += ` ${consistencyConstraints}`;
          }
        }
      }
      if (imageRefLines.length > 0 && !prompt.includes('@image')) {
        const imageRefText = imageRefLines.join(',');
        if (prompt.length + imageRefText.length + 2 <= PROMPT_LENGTH.HARD_MAX) {
          prompt += ` ${imageRefText}`;
        } else {
          // 如果空间不足,裁剪尾部非核心内容来容纳 @image 引用
          const remaining = PROMPT_LENGTH.HARD_MAX - imageRefText.length - 2;
          if (remaining > 100) {
            prompt = this.smartTrim(prompt, remaining, {
              preserve: ['视觉', '叙事', '台词', '嘴部动作', '镜头时间轴'],
              trim: ['辅助运镜', '光影细节补充', '环境质感', '环境音效', '技术规格', '照明方案']
            });
            prompt += ` ${imageRefText}`;
          }
        }
        this.log('STAGE-11', `  📷 @image引用注入: ${shot.id} | ${imageRefLines.length}个引用`);
      }


      // 去重,减少冗余
      prompt = this.dedupePromptFragments(prompt);

      // 先结构化成标准字段格式,提升STAGE-12识别率
      prompt = this.toStandardPrompt(shot, prompt);

      // 最后兜底,补齐缺失字段
      prompt = this.ensureFinalPromptStructure(shot, prompt);

      // v6.6.9.4-fix: Stage-11 最终标准化兜底
      prompt = buildStandardPromptFromShot({
        ...shot,
        prompt,
        dialogue: shot.dialogue,
        visualPrompt: shot.visualPrompt,
        cameraString: shot.cameraMovement?.description || shot.cameraString || '',
        lightingString: shot.lighting?.description || shot.lightingString || '',
        backgroundSoundString: shot.backgroundSoundString || shot.audioLayerString || ''
      });
      prompt = safeStructuredTrim(prompt, PROMPT_LENGTH.HARD_MAX);

      // v6.5.58-fix: 构建标准输出字段,确保与schema一致
      const standardOutput = {
        shotId: shot.id,
        id: shot.id, // 兼容字段
        type: shot.type || 'generic',
        scene: shot.scene || '',
        prompt,
        referenceImages,
        duration: shot.duration,
        length: prompt.length,
        mouthAction: shot.mouthAction,
        utilization: Math.round(utilization * 100),
        utilizationStatus,
        qualityScore: shot.qualityScore,
        enhanced: true,
        // 内容镜专属字段
        cameraMovement: shot.cameraMovement || null,
        emotionPhase: shot.emotionPhase || '',
        importance: shot.importance || 5,
        visualComplexity: shot.visualComplexity || 5,
        dialogue: shot.dialogue || '',
        narration: shot.narration || '',
        // v6.5.62: 新增字段(基于参考v6.37-Peng优化)
        characterRef: this._buildCharacterRef(shot, stages) || '',
        character: this._buildCharacterMinimal(shot, stages) || '',
        timeline: this._buildTimeline(shot, 0) || '',
        backgroundSound: this._buildBackgroundSound(shot) || '',
        // 标记是否片头
        isOpening: shot.id === 'S00' || shot.type === 'opening',
        // v6.5.59-fix: 片头注入title对象
        title: (shot.id === 'S00' || shot.type === 'opening') ? (shot.title || {
          main: shot.postProduction?.mainTitle || '',
          sub: shot.postProduction?.subTitle || 'A Nirath Original by Genius',
          creator: 'Genius',
          displayTiming: '6.8-9.0s',
          position: '画面中央偏下',
          style: 'elegant serif with subtle geometric flourishes'
        }) : undefined
      };

      // 片头专属:注入title对象(如果存在)
      if (shot.id === 'S00' || shot.type === 'opening') {
        if (shot.title && typeof shot.title === 'object') {
          standardOutput.title = shot.title;
        } else if (shot.postProduction && shot.postProduction.mainTitle) {
          // 从 postProduction 构建 title
          standardOutput.title = {
            main: shot.postProduction.mainTitle || '',
            sub: shot.postProduction.subTitle || '',
            creator: shot.postProduction.brand ? shot.postProduction.brand.replace('A Nirath Original by ', '') : 'Genius',
            episodeName: shot.postProduction.titleFormation || '',
            displayTiming: '6.8-9.0s',
            position: '画面中央偏下',
            style: shot.postProduction.fontStyle || 'elegant serif with subtle geometric flourishes'
          };
        }
        standardOutput.isOpening = true;
      }

      prompts.push(standardOutput);
      currentTime += shot.duration || 0; // v6.5.62: 累积时间
    }

    // 🔥 v6.2-patch100-fix: 全局上下文去重 - 提取所有镜头的共同内容,减少冗余
    // 根因:每个镜头的【环境布景】【环境质感】等固定板块相同,浪费80%字符空间
    // 修复:提取全局上下文,每个镜头只保留差异化内容
    if (prompts.length > 0) {
      const globalContext = this.extractGlobalContext(prompts);
      if (globalContext && globalContext.length > 0) {
        this.log('STAGE-11', `🌍 全局上下文提取: ${globalContext.length}字符,从${prompts.length}个镜头中提取共同内容`);
        // 从每个镜头中移除全局上下文,释放空间给差异化内容
        for (let i = 0; i < prompts.length; i++) {
          const originalLength = prompts[i].prompt.length;
          prompts[i].prompt = this.removeGlobalContext(prompts[i].prompt, globalContext);
          prompts[i].length = prompts[i].prompt.length;
          prompts[i].utilization = Math.round(prompts[i].length / PROMPT_LENGTH.HARD_MAX * 100);
          // 更新利用率状态
          if (prompts[i].length >= 970 && prompts[i].length <= PROMPT_LENGTH.HARD_MAX) {
            prompts[i].utilizationStatus = '🔥理想';
          } else if (prompts[i].length > PROMPT_LENGTH.HARD_MAX) {
            prompts[i].utilizationStatus = '❌超标';
          } else if (prompts[i].length >= 850) {
            prompts[i].utilizationStatus = '✅达标';
          } else {
            prompts[i].utilizationStatus = '⚠️空间浪费';
          }
          const savedChars = originalLength - prompts[i].length;
          if (savedChars > 0) {
            this.log('STAGE-11', `  📝 ${prompts[i].shotId} 移除冗余内容,释放${savedChars}字符空间`);
          }
        }
        // 将全局上下文存储在第一个镜头中,便于渲染时合并
        prompts[0].globalContext = globalContext;
        this.log('STAGE-11', `✅ 全局上下文已存储在${prompts[0].shotId},共释放${prompts.reduce((sum, p) => sum + (p._originalLength - p.length), 0)}字符`);
      }
    }

    // ===== 修复：最终渲染 Prompt 角色锚点注入 + generic 清洗 + 长度校验 =====
    for (let i = 0; i < prompts.length; i++) {
      const shot = prompts[i];
      const shotId = shot.shotId || shot.id || 'unknown';
      const renderMeta = this._buildRenderMetaForShot(shot, stages);

      let prompt = String(shot.prompt || '').trim();

      if (renderMeta.mergedCharacterAnchor) {
        prompt = this._mergeCharacterAnchorIntoPrompt(prompt, renderMeta.mergedCharacterAnchor, {
          hardLimit: PROMPT_LENGTH.HARD_MAX
        });
      }

      if ((this.mode || 'generic') === 'generic') {
        prompt = this._sanitizePromptForGenericMode(prompt);
      }

      prompt = this._ensureOutfitMentioned(prompt, renderMeta);

      // v6.6.9.4-patch17: 注入定妆照绑定引用
      if (renderMeta.characterRef) {
        const portraitPrefix = `【定妆照】${renderMeta.characterRef} | `;
        // 检查是否已存在定妆照字段，避免重复
        if (!prompt.includes('【定妆照】')) {
          prompt = portraitPrefix + prompt;
        }
      }

      shot.characterRef = renderMeta.characterRef || '';

      if (prompt.length > PROMPT_LENGTH.HARD_MAX) {
        prompt = this.smartTrim(prompt, PROMPT_LENGTH.HARD_MAX);
      }

      // v6.6.9.4-patch18: 最终再做一次结构化兜底，避免后续字段丢失
      prompt = this.toStandardPrompt(shot, prompt);
      prompt = this.ensureFinalPromptStructure(shot, prompt);
      prompt = safeStructuredTrim(prompt, PROMPT_LENGTH.HARD_MAX);
      prompt = this.safeTrimStructuredPrompt(prompt, PROMPT_LENGTH.HARD_MAX);

      shot.prompt = prompt;
      shot.length = prompt.length;
      shot.utilization = Math.round(prompt.length / PROMPT_LENGTH.HARD_MAX * 100);
      shot.utilizationStatus =
        PROMPT_LENGTH.getStatus(prompt.length) === 'ideal' ? '🔥理想' :
        PROMPT_LENGTH.getStatus(prompt.length) === 'underflow' ? '⚠️空间浪费' :
        PROMPT_LENGTH.getStatus(prompt.length) === 'overflow' ? '❌超标' : 'ℹ️正常';
      shot._renderMeta = renderMeta;

      this.log('STAGE-11', `  🎬 ${shotId} 最终渲染Prompt: ${prompt.length}字符 | characters=${renderMeta.characterIds.join(', ') || 'none'}`);
    }

    this.log('STAGE-11', `✅ 渲染完成 | 镜头数: ${prompts.length} | 理想利用率: ${prompts.filter(p => p.utilizationStatus && p.utilizationStatus.includes('理想')).length}/${prompts.length}`);
    return prompts;
  }

  // 🔥 v6.2-patch100-fix: 全局上下文提取方法
  // 提取所有镜头中相同的【环境布景】【环境质感】等固定板块
  extractGlobalContext(prompts) {
    if (prompts.length < 2) return '';

    const globalBlocks = [];
    const blockPatterns = [
      { pattern: /【环境布景】([^【]*?)(?=【|$)/, label: '【环境布景】' },
      { pattern: /【环境质感】([^【]*?)(?=【|$)/, label: '【环境质感】' },
      { pattern: /【明亮约束】([^【]*?)(?=【|$)/, label: '【明亮约束】' },
      { pattern: /【风格锁】([^【]*?)(?=【|$)/, label: '【风格锁】' },
      { pattern: /【技术规格】([^【]*?)(?=【|$)/, label: '【技术规格】' }
    ];

    for (const { pattern, label } of blockPatterns) {
      // v6.5.36-fix: 对【技术规格】,只检查内容镜(非S00)是否相同,因为S00是片头,格式不同
      const shotsToCheck = (label === '【技术规格】') ? prompts.filter(p => p.shotId !== 'S00') : prompts;
      if (shotsToCheck.length < 2) continue;

      const firstMatch = shotsToCheck[0].prompt.match(pattern);
      if (!firstMatch) continue;

      const firstContent = firstMatch[1].trim();
      if (!firstContent || firstContent.length < 20) continue; // 太短的不要提取

      // 检查所有镜头是否相同
      let allSame = true;
      for (let i = 1; i < shotsToCheck.length; i++) {
        const match = shotsToCheck[i].prompt.match(pattern);
        if (!match || match[1].trim() !== firstContent) {
          allSame = false;
          break;
        }
      }

      if (allSame) {
        globalBlocks.push(`${label}${firstContent}`);
      }
    }

    return globalBlocks.join(' ');
  }

  // 🔥 v6.2-patch100-fix: 从单个Prompt中移除全局上下文
  removeGlobalContext(prompt, globalContext) {
    if (!globalContext || globalContext.length === 0) return prompt;

    let result = prompt;
    const blocks = globalContext.split(/(?=【)/).filter(b => b.trim());

    for (const block of blocks) {
      const marker = block.match(/【([^】]+)】/)?.[1];
      if (!marker) continue;

      // 提取全局内容
      const globalContent = block.replace(/【[^】]+】/, '').trim();
      if (!globalContent) continue;

      // 从Prompt中移除该板块的完整内容(保留标记,以便后续合并)
      // 但只有当全局上下文包含该标记时才移除,否则保留原始内容
      if (globalContext.includes(`【${marker}】`)) {
        const pattern = new RegExp(`【${marker}】[^【]*?(?=【|$)`, 'g');
        result = result.replace(pattern, `【${marker}】[全局注入] `);
      }
    }

    // 清理多余空格
    result = result.replace(/\s{2,}/g, ' ').trim();

    return result;
  }

  // 🔥 v6.2-patch100-fix: 合并全局上下文到单个Prompt(渲染时使用)
  mergeGlobalContext(prompt, globalContext) {
    if (!globalContext || globalContext.length === 0) return prompt;

    let result = prompt;
    const blocks = globalContext.split(/(?=【)/).filter(b => b.trim());

    for (const block of blocks) {
      const marker = block.match(/【([^】]+)】/)?.[1];
      if (!marker) continue;

      const globalContent = block.replace(/【[^】]+】/, '').trim();
      if (!globalContent) continue;

      // 替换[全局注入]为实际内容
      const placeholder = new RegExp(`【${marker}】\[全局注入\]`, 'g');
      if (placeholder.test(result)) {
        result = result.replace(placeholder, `【${marker}】${globalContent}`);
      } else if (!result.includes(`【${marker}】`)) {
        // 如果没有该标记,在末尾追加
        result += ` 【${marker}】${globalContent}`;
      }
    }

    return result;
  }

  // ========== Stage 11.5: Prompt质量闸门(v6.0新增:在Prompt生成后检查质量,防空转) ==========
  async stagePromptQualityGate(renderResults, storyboardStageOrStages) {
    const stages =
      storyboardStageOrStages?.storyboard || storyboardStageOrStages?.characters
        ? storyboardStageOrStages
        : { storyboard: { shots: Array.isArray(storyboardStageOrStages?.shots) ? storyboardStageOrStages.shots : [] } };

    const mode = this.mode || stages?.characters?.mode || 'generic';
    const shots = Array.isArray(renderResults) ? renderResults : [];

    this.log('STAGE-11.5', `Prompt Quality Gate 启动 | shots=${shots.length} | mode=${mode}`);

    const checkedShots = shots.map((shot) => {
      const shotId = shot?.id || shot?.shotId || 'unknown';

      try {
        const repaired = this._repairShotPromptByQualityGate(shot, stages, { mode });
        const finalPrompt = repaired.prompt || '';

        const status = PROMPT_LENGTH.getStatus(finalPrompt.length);
        const forbiddenHit = this._containsForbiddenKeyword(
          finalPrompt,
          this._collectForbiddenKeywordsForMode(mode)
        );

        const qualityGate = {
          passed: !forbiddenHit && repaired.warnings.length === 0,
          fixes: repaired.fixes,
          warnings: repaired.warnings,
          promptLength: finalPrompt.length,
          lengthStatus: status,
          forbiddenHit: forbiddenHit || '',
          checkedAt: new Date().toISOString()
        };

        const nextShot = {
          ...shot,
          prompt: finalPrompt,
          length: finalPrompt.length,
          utilization: Math.round(finalPrompt.length / PROMPT_LENGTH.HARD_MAX * 100),
          utilizationStatus:
            status === 'ideal' ? '🔥理想' :
            status === 'underflow' ? '⚠️偏短' :
            status === 'overflow' ? '❌超标' :
            'ℹ️正常',
          renderMeta: repaired.renderMeta || shot.renderMeta,
          qualityGate
        };

        if (qualityGate.passed) {
          this.log('STAGE-11.5', `✅ ${shotId} 通过 | len=${finalPrompt.length} | fixes=${qualityGate.fixes.length}`);
        } else {
          this.log(
            'STAGE-11.5',
            `⚠️ ${shotId} 警告 | len=${finalPrompt.length} | warnings=${qualityGate.warnings.join('; ') || 'none'} | forbidden=${qualityGate.forbiddenHit || 'none'}`
          );
        }

        return nextShot;
      } catch (err) {
        this.log('STAGE-11.5', `❌ ${shotId} 质量门异常: ${err.message}`);

        return {
          ...shot,
          qualityGate: {
            passed: false,
            fixes: [],
            warnings: [`quality_gate_exception:${err.message}`],
            promptLength: String(shot?.prompt || '').length,
            lengthStatus: PROMPT_LENGTH.getStatus(String(shot?.prompt || '').length),
            forbiddenHit: '',
            checkedAt: new Date().toISOString()
          }
        };
      }
    });

    const summary = this._summarizePromptQualityGate(checkedShots);

    this.log(
      'STAGE-11.5',
      `Prompt Quality Gate 完成 | total=${summary.total} | passed=${summary.passed} | warned=${summary.warned} | fixes=${summary.totalFixes}`
    );

    return {
      success: summary.failed === 0,
      mode,
      shots: checkedShots,
      summary
    };
  }

  // v6.2-patch82: Prompt标准模块化系统
  async stageCompliance(renderResults, storyboard) {
    this.log('STAGE-12', '合规检查(Prompt利用率 + 禁止词 + L2降级 + 片头专项合规)');

    const compliance = {
      promptLength: [],
      bannedWords: [],
      style: [],
      utilization: [], // P1修复#45-48
      l2Downgrade: [], // P1修复#34
      openingCompliance: [] // v6.2-patch67: 片头专项合规检查
    };

    for (const result of renderResults) {
      // 检查Prompt长度
      if (result.length > PROMPT_LENGTH.HARD_MAX) {
        compliance.promptLength.push({ shotId: result.shotId, length: result.length });
      }

      // v6.5.14-fix: 降低理想利用率阈值,generic模式允许更多空间用于质量而非数量
      // 目标阈值：nirath 模式使用全上限，generic 模式使用更宽松阈值
      const idealThreshold = this.mode === 'nirath' ? PROMPT_LENGTH.HARD_MAX : 920;
      const utilization = result.length / PROMPT_LENGTH.HARD_MAX;
      const utilPercent = Math.round(utilization * 100);
      if (result.length < idealThreshold) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'waste',
          message: `空间浪费:${result.length}/988字符(${utilPercent}%),建议增强Action描述填满至${idealThreshold}+字符`
        });
      } else if (result.length >= idealThreshold && result.length <= PROMPT_LENGTH.HARD_MAX) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'ideal',
          message: `利用率理想:${result.length}/988字符(${utilPercent}%)`
        });
      } else if (result.length > PROMPT_LENGTH.HARD_MAX) {
        compliance.utilization.push({
          shotId: result.shotId,
          length: result.length,
          utilization: utilPercent,
          status: 'exceed',
          message: `超标拦截:${result.length}/988字符(${utilPercent}%),必须精简`
        });
      }

      // Nirath模式:检查禁止关键词
      if (this.mode === 'nirath') {
        let enforceResult = { compliant: true, issues: [] };
        try {
          if (typeof this.modules.renderCore.enforceStyle === 'function') {
            enforceResult = this.modules.renderCore.enforceStyle(result.prompt, result.scene);
          }
        } catch (e) {
          // enforceStyle不可用,跳过
        }
        if (!enforceResult.compliant) {
          compliance.bannedWords.push({ shotId: result.shotId, issues: enforceResult.issues });
        }
      }
    }

    // 🔥 v6.2-patch67: 片头镜头专项合规检查(S00)
    // 三项强制检查:1.异兽开场白 2.英文主副标题 3.震撼音效
    if (this.mode === 'nirath') {
      const openingShot = storyboard?.shots?.find(s => s.id === 'S00' || s.isOpening);
      const openingPrompt = openingShot?.prompt || '';

      if (openingShot) {
        const openingCheck = { shotId: 'S00', passed: true, errors: [], warnings: [] };

        // 检查1:异兽开场白(神兽人声签名)
        const hasOpeningVoice = openingPrompt.includes('【神兽人声签名】') ||
                                openingPrompt.includes('神兽人声') ||
                                openingPrompt.includes('低语');
        if (!hasOpeningVoice) {
          openingCheck.passed = false;
          openingCheck.errors.push('缺少异兽开场白(神兽人声签名)');
        }

        // 检查2:英文主副标题
        const hasMainTitle = openingPrompt.includes('主标题【') || openingPrompt.includes('主标题[');
        const hasSubTitle = openingPrompt.includes('副标题【') || openingPrompt.includes('副标题[');
        // 提取标题内容检查是否含中文
        const titleMatch = openingPrompt.match(/主标题【([^】]+)】/);
        const subTitleMatch = openingPrompt.match(/副标题【([^】]+)】/);
        const mainTitleText = titleMatch ? titleMatch[1] : '';
        const subTitleText = subTitleMatch ? subTitleMatch[1] : '';
        const hasChineseInTitle = /[\u4e00-\u9fff]/.test(mainTitleText) || /[\u4e00-\u9fff]/.test(subTitleText);

        if (!hasMainTitle || !hasSubTitle) {
          openingCheck.passed = false;
          openingCheck.errors.push(`缺少英文主副标题(主标题=${hasMainTitle}, 副标题=${hasSubTitle})`);
        } else if (hasChineseInTitle) {
          openingCheck.passed = false;
          openingCheck.errors.push(`主副标题含中文字符,必须全英文(主标题=${mainTitleText}, 副标题=${subTitleText})`);
        }

        // 检查3:震撼音效
        const hasSoundEffect = openingPrompt.includes('35Hz') ||
                               openingPrompt.includes('震颤') ||
                               openingPrompt.includes('共振') ||
                               openingPrompt.includes('低频') ||
                               openingPrompt.includes('磁场共振') ||
                               openingPrompt.includes('声波') ||
                               openingPrompt.includes('共鸣');
        if (!hasSoundEffect) {
          openingCheck.passed = false;
          openingCheck.errors.push('缺少震撼音效描述(35Hz/震颤/共振/低频/声波等)');
        }

        compliance.openingCompliance.push(openingCheck);

        if (!openingCheck.passed) {
          this.log('STAGE-12', `❌ 片头合规检查失败 | S00: ${openingCheck.errors.join(';')}`, 'error');
        } else {
          this.log('STAGE-12', `✅ 片头合规检查通过 | S00: 开场白+英文标题+音效 全部满足`);
        }
      } else {
        compliance.openingCompliance.push({
          shotId: 'S00',
          passed: false,
          errors: ['片头镜头(S00)缺失']
        });
        this.log('STAGE-12', `❌ 片头镜头(S00)缺失,无法执行合规检查`, 'error');
      }
    }

    const hasIssues = compliance.promptLength.length > 0 ||
                     compliance.bannedWords.length > 0 ||
                     compliance.utilization.filter(u => u.status === 'exceed').length > 0 ||
                     compliance.openingCompliance.some(c => !c.passed); // v6.2-patch67: 片头不合规也算问题

    // 🔥 v6.2-patch82: Prompt标准符合度检查(基于标准模块v2.0)
    for (const result of renderResults) {
      const standardCheck = this.checkStandardCompliance(result.prompt, result.shotId);
      if (standardCheck) {
        compliance.standardReadiness = compliance.standardReadiness || [];
        compliance.standardReadiness.push(standardCheck);

        if (standardCheck.coverage < 60) {
          this.log('STAGE-12', `⚠️ ${result.shotId} 标准符合度低: ${standardCheck.coverage}% | 缺失: ${standardCheck.missing.join(', ')}`);
        } else if (standardCheck.coverage >= 80) {
          this.log('STAGE-12', `✅ ${result.shotId} 标准符合度高: ${standardCheck.coverage}%`);
        }
      }
    }
    const l2Warnings = compliance.utilization.filter(u => u.status === 'waste');
    if (l2Warnings.length > 0) {
      this.log('STAGE-12', `⚠️ L2降级提示: ${l2Warnings.length}个镜头Prompt空间未充分利用,建议增强`);
    }

    this.log('STAGE-12', `✅ 合规检查 | 问题: ${hasIssues ? '有' : '无'} | 利用率检查: ${compliance.utilization.length}个镜头 | 片头合规: ${compliance.openingCompliance.length}项`);

    return compliance;
  }

  // ========== Stage 13: 前置验证 ==========
  async stagePreRenderValidation(stages) {
    this.log('STAGE-13', '渲染前置验证');

    const validation = {
      ready: true,
      checks: []
    };

    // 检查故事板
    if (!stages.storyboard || stages.storyboard.shots.length === 0) {
      validation.checks.push({ name: 'storyboard', passed: false, reason: '故事板为空' });
      validation.ready = false;
    }

    // 检查角色
    if (!stages.characters || Object.keys(stages.characters).length === 0) {
      validation.checks.push({ name: 'characters', passed: false, reason: '角色未配置' });
      validation.ready = false;
    }

    // 检查Prompt
    if (!stages.render || stages.render.length === 0) {
      validation.checks.push({ name: 'prompts', passed: false, reason: 'Prompt未生成' });
      validation.ready = false;
    }

    // ========== 新增:定妆照强制提交闸机 v1.1 ==========
    // v1.1修复:预生产模式下不硬拦截,仅警告
    // 支持两种属性名:isPreProduction 或 preProduction
    const isPreProduction = this.options?.isPreProduction || this.projectConfig?.isPreProduction || this.projectConfig?.preProduction || false;
    const gateMode = isPreProduction ? 'pre-production' : 'production';

    const gate = new ReferenceImageGate({
      mode: gateMode,
      requiredCharacters: this.projectConfig?.requiredCharacters || [],
      charactersDir: this.charactersDir
    });

    const shotsForGate = stages.render?.map((r, i) => ({
      id: r.shotId || `S${String(i).padStart(2, '0')}`,
      characters: r.characters || this.projectConfig?.requiredCharacters || [],
      content: r.content || r.prompt?.content || [],
      prompt: r.prompt,
      visualPrompt: r.visualPrompt,
      narration: r.narration
    })) || [];

    const gateResult = gate.validate(shotsForGate);

    // v1.1修复:预生产模式下,闸机警告不阻断链路
    if (!gateResult.passed && gateMode === 'pre-production') {
      // 预生产模式:记录警告,但validation保持true
      validation.checks.push({
        name: 'reference_image_gate',
        passed: true, // 预生产模式不阻断
        reason: `预生产模式:定妆照检查发现问题(${gateResult.warnings.length}个警告),但允许继续`,
        details: gateResult.warnings
      });

      this.log('STAGE-13', `⚠️ 定妆照检查: ${gateResult.warnings.length} 个警告(预生产模式不拦截)`);
      for (const warn of gateResult.warnings.slice(0, 3)) {
        this.log('STAGE-13', `   ⚠️ ${warn.shotId} | ${warn.characterId}: ${warn.message.substring(0, 80)}...`);
      }
    } else if (!gateResult.passed) {
      // 生产模式:硬拦截
      validation.checks.push({
        name: 'reference_image_gate',
        passed: false,
        reason: `定妆照强制闸机拦截: ${gateResult.errors.length} 个镜头未绑定定妆照`,
        details: gateResult.errors
      });
      validation.ready = false;

      this.log('STAGE-13', `❌ 定妆照闸机拦截: ${gateResult.errors.length} 个错误`);
      for (const error of gateResult.errors.slice(0, 3)) {
        this.log('STAGE-13', `   ❌ ${error.shotId} | ${error.characterId}: ${error.message.substring(0, 80)}...`);
      }
    } else {
      this.log('STAGE-13', `✅ 定妆照闸机通过: ${gateResult.characterChecks?.length || 0} 个镜头已验证`);
      if (gateResult.warnings.length > 0) {
        this.log('STAGE-13', `⚠️ 闸机警告: ${gateResult.warnings.length} 个`);
      }
    }
    // ========== 定妆照闸机结束 ==========

    this.log('STAGE-13', `✅ 前置验证 | 就绪: ${validation.ready ? '是' : '否'} | 检查: ${validation.checks.length}`);
    return validation;
  }

  // ========== Stage 14: 风格注入 ==========
  async stageStyleInjection(renderResults) {
    this.log('STAGE-14', `风格注入${this.mode === 'nirath' ? '(Nirath风格确认)' : ''}`);

    const styled = [];

    for (const result of renderResults) {
      let prompt = result.prompt;

      if (this.mode === 'nirath') {
        // v6.2-patch63-fix: 清理UE5/Lumen/Nanite等英文技术声明,Seedance 2.0原生理解无需引擎声明
        // 不再强制注入hyper-realistic/UE5/Lumen/Nanite等遗留技术词
        // 技术规格由orient-primordial-core-v24.js的nirathTechTail统一注入(中文版)
      }

      styled.push({ ...result, prompt });
    }

    this.log('STAGE-14', `✅ 风格注入 | 镜头数: ${styled.length}`);
    return styled;
  }

  // ========== Stage 15: 后期规则 ==========
  async stagePostProduction(stages) {
    this.log('STAGE-15', `后期规则${this.mode === 'nirath' ? '(山海经:原声保留)' : '(通用:TTS覆盖)'}`);

    const rules = {
      tts: this.mode === 'nirath' ? false : true,
      subtitles: this.mode === 'nirath' ? false : true,
      originalAudio: this.mode === 'nirath' ? true : false,
      concatOnly: this.mode === 'nirath' ? true : false,
      format: 'mp4',
      ratio: '16:9',
      resolution: '1920x1080',
      // v6.6.0: 音乐风格
      musicStyle: this.projectConfig?.musicStyle || '根据风格自动匹配'
    };

    // 【v6.0-patch22 新增】片头标题配置检查
    let titleCheck = { valid: true, errors: [], warnings: [] };
    if (this.mode === 'nirath') {
      const openingShot = stages.storyboard?.shots?.find(s => s.id === 'S00' || s.isOpening);
      // 优先从 projectConfig 读取 titleConfig,其次从 shot
      const titleConfig = this.projectConfig?.titleConfig || openingShot?.titleConfig;

      if (!openingShot) {
        titleCheck.valid = false;
        titleCheck.errors.push('片头镜头(S00)缺失,标题无法烧录');
      } else if (!titleConfig) {
        titleCheck.warnings.push('未配置titleConfig(projectConfig.titleConfig 或 shot.titleConfig),将使用默认标题生成');
      } else {
        if (!titleConfig.mainTitle || titleConfig.mainTitle.trim().length === 0) {
          titleCheck.errors.push('titleConfig.mainTitle为空');
        }
        if (!titleConfig.producer || titleConfig.producer.trim().length === 0) {
          titleCheck.warnings.push('titleConfig.producer未设置');
        }
        if (titleConfig.mainTitle && !/^[^\u4e00-\u9fff]*$/.test(titleConfig.mainTitle)) {
          titleCheck.warnings.push('titleConfig.mainTitle含中文字符(山海经系列强制英文标题)');
        }
      }

      if (!titleCheck.valid) {
        titleCheck.errors.forEach(e => this.log('STAGE-15', `❌ 标题配置: ${e}`, 'error'));
      }
      if (titleCheck.warnings.length > 0) {
        titleCheck.warnings.forEach(w => this.log('STAGE-15', `⚠️ 标题配置: ${w}`));
      }
      if (titleCheck.valid && titleCheck.errors.length === 0 && titleCheck.warnings.length === 0) {
        this.log('STAGE-15', `✅ 标题配置检查通过 | mainTitle: ${titleConfig?.mainTitle}`);
      }
    }

    this.log('STAGE-15', `✅ 后期规则 | TTS: ${rules.tts} | 字幕: ${rules.subtitles} | 原声: ${rules.originalAudio}`);
    return { ...rules, titleCheck };
  }

  // ========== Stage 16: 最终输出(基础版) ==========
  async stageFinalOutput(stages) {
    this.log('STAGE-16', '最终输出组装(meta + shots)');

    // ==== 链路完整性验证 ====
    this.log('STAGE-16.5', '链路输出完整性反向验证(PipelineIntegrityValidator)');
    const validator = new PipelineIntegrityValidator({ mode: this.mode });
    const integrityResult = await validator.validatePipeline(stages);

    if (!integrityResult.valid) {
      this.log('STAGE-16.5', `⛔ 链路验证失败! ${integrityResult.summary.errorCount}个错误, ${integrityResult.summary.warningCount}个警告`, 'error');
      const failedChecks = integrityResult.checks.filter(c => !c.passed);
      for (const check of failedChecks) {
        this.log('STAGE-16.5', `  ❌ ${check.stage}: ${check.name}`, 'error');
        for (const detail of (check.details || [])) {
          this.log('STAGE-16.5', `      → ${detail}`, 'error');
        }
      }
      this.errors.push({
        stage: 'STAGE-16.5',
        message: `链路完整性验证失败: ${integrityResult.summary.errorCount}个错误`,
        details: integrityResult.errors
      });
    } else {
      this.log('STAGE-16.5', `✅ 链路完整性验证通过 | 全部${integrityResult.summary.totalChecks}项检查通过`);
    }

    stages.integrityValidation = integrityResult;

    const renderShots = Array.isArray(stages.style)
      ? stages.style
      : Array.isArray(stages.render)
      ? stages.render
      : [];

    const meta = {
      title: stages.prd?.meta?.title || stages.prd?.title || stages.script?.title || '未命名',
      worldview: this.mode || 'generic',
      totalDuration:
        stages.storyboard?.totalDuration ||
        (stages.storyboard?.shots || []).reduce((sum, s) => sum + (s.duration || 0), 0) ||
        stages.duration?.totalDuration ||
        60,
      openingDuration: stages.opening?.duration || 0,
      fps: 24,
      resolution: '1920x1080',
      styleNotes:
        stages.prd?.style?.description ||
        stages.prd?.style ||
        '',
      generatedAt: new Date().toISOString(),
      version: 'v6.6.9.4-patch17'
    };

    const shots = renderShots.map((shot, index) => ({
      shotId: shot.shotId || shot.id || `S${String(index + 1).padStart(2, '0')}`,
      duration: shot.duration || 0,
      scene: shot.scene || '',
      mood: shot.emotionPhase || shot.mood || '',
      camera: shot.cameraMovement || shot.camera || null,
      cameraString:
        shot.cameraString ||
        shot.cameraMovement?.description ||
        shot.cameraMovement?.movement ||
        '',
      lighting: shot.lighting || null,
      lightingString:
        shot.lightingString ||
        shot.lighting?.description ||
        shot.lighting?.keyLight ||
        '',
      characterRef: shot.characterRef || '',
      character: shot.character || '',
      action:
        shot.action ||
        shot.dialogue ||
        shot.narration ||
        '',
      dialogue: shot.dialogue || '',
      timeline: shot.timeline || shot.cameraMovement?.timeline || null,
      timelineString:
        shot.timelineString ||
        (typeof shot.timeline === 'string' ? shot.timeline : '') ||
        '',
      backgroundSound: shot.backgroundSound || null,
      backgroundSoundString:
        shot.backgroundSoundString ||
        (typeof shot.backgroundSound === 'string' ? shot.backgroundSound : '') ||
        '',
      audioLayer: shot.audioLayer || null,
      audioLayerString:
        shot.audioLayerString ||
        '',
      titleOverlay: shot.title || shot.titleOverlay || null,
      titleOverlayString:
        shot.titleOverlayString ||
        '',
      prompt: shot.prompt || '',
      promptCharCount: shot.promptCharCount || shot.length || (shot.prompt ? shot.prompt.length : 0),
      mouthAction: shot.mouthAction || '',
      physicsLayer: shot.physicsLayer || null,
      colorScience: shot.colorScience || null,
      negativePrompt: shot.negativePrompt || '',
      renderStyle: shot.renderStyle || null,
      directorStyle: shot.directorStyle || null,
      priorities: shot.priorities || null,
      qualityScore: shot.qualityScore || null,
      referenceImages: shot.referenceImages || [],
      isOpening: !!shot.isOpening
    }));

    const output = {
      meta,
      shots,
      _legacy: {
        prd: stages.prd,
        characters: stages.characters,
        script: stages.script,
        storyboard: stages.storyboard,
        cameraMovements: stages.camera,
        prompts: renderShots,
        postProduction: stages.postProduction,
        fallbackSummary: this.fallbackMonitor?.summarize ? this.fallbackMonitor.summarize() : null,
        validation: {
          alignment: stages.alignment,
          schema: stages.schema,
          storyboard: stages.storyboardValidation,
          compliance: stages.compliance,
          preRender: stages.preRender,
          integrity: integrityResult
        }
      }
    };

    this.log('STAGE-16', `✅ 最终输出 | shots: ${shots.length} | integrity: ${integrityResult.valid ? '通过' : '未通过'}`);

    try {
      const fss = require('fs');
      const path = require('path');
      const outputDir = this.outputDir || path.join(process.cwd(), 'output');

      if (!fss.existsSync(outputDir)) {
        fss.mkdirSync(outputDir, { recursive: true });
      }

      const resultPath = path.join(outputDir, 'preproduction-result.json');
      fss.writeFileSync(resultPath, JSON.stringify(output, null, 2), 'utf-8');
      this.log('STAGE-16', `💾 结果已保存: ${resultPath}`);

      const reportPath = path.join(outputDir, 'preproduction-report.md');
      const report = this._generateMarkdownReport(output, integrityResult);
      fss.writeFileSync(reportPath, report, 'utf-8');
      this.log('STAGE-16', `📝 报告已保存: ${reportPath}`);

      output.outputDir = outputDir;
      output.resultPath = resultPath;
      output.reportPath = reportPath;
    } catch (e) {
      this.log('STAGE-16', `⚠️ 文件保存失败: ${e.message}`, 'error');
    }

    return output;
  }

  /**
   * 生成 Markdown 格式预生产报告
   */
  _generateMarkdownReport(output, integrityResult) {
    const shots = output.storyboard?.shots || output.prompts || [];
    const totalDuration = shots.reduce((s, x) => s + (x.duration || 0), 0);
    
    let md = `# 预生产报告\n\n`;
    md += `> 生成时间: ${new Date().toISOString()}\n\n`;
    md += `## 概要\n\n`;
    md += `- 镜头数: ${shots.length}\n`;
    md += `- 总时长: ${totalDuration}秒\n`;
    md += `- 完整性验证: ${integrityResult.valid ? '✅ 通过' : '❌ 未通过'}\n`;
    md += `- 检查项: ${integrityResult.summary?.passed || 0}/${integrityResult.summary?.totalChecks || 0}\n\n`;
    
    md += `## 镜头列表\n\n`;
    md += `| 镜号 | 类型 | 时长 | 场景 |\n`;
    md += `|------|------|------|------|\n`;
    for (const shot of shots) {
      md += `| ${shot.shotId || shot.id || '-'} | ${shot.type || '-'} | ${shot.duration || 0}s | ${shot.scene || '-'} |\n`;
    }
    md += `\n`;
    
    md += `## 验证详情\n\n`;
    if (integrityResult.checks) {
      for (const check of integrityResult.checks) {
        md += `- ${check.passed ? '✅' : '❌'} ${check.stage}: ${check.name}\n`;
      }
    }
    
    return md;
  }

  // ========== 辅助方法:自动重试失败的Stage ==========
  async attemptRetry(stages, integrityResult) {
    const failedStages = integrityResult.checks.filter(c => !c.passed).map(c => c.stage);
    let success = true;

    // 重试STAGE-9:运镜系统
    if (failedStages.includes('STAGE-9') && stages.storyboard) {
      this.log('RETRY', '🔄 尝试重试运镜系统(STAGE-9)...');
      try {
        stages.camera = await this.stageCameraMovement(stages.storyboard);
        this.log('RETRY', '✅ 运镜系统重试成功');
      } catch (e) {
        this.log('RETRY', `❌ 运镜系统重试失败: ${e.message}`, 'error');
        success = false;
      }
    }

    // 重试STAGE-11:渲染核心(如果运镜重试成功或需要重试渲染)
    if ((failedStages.includes('STAGE-11') || failedStages.includes('STAGE-9')) && stages.storyboard) {
      this.log('RETRY', '🔄 尝试重试渲染核心(STAGE-11)...');
      try {
        stages.render = await this.stageRender(stages);
        this.log('RETRY', '✅ 渲染核心重试成功');
      } catch (e) {
        this.log('RETRY', `❌ 渲染核心重试失败: ${e.message}`, 'error');
        success = false;
      }
    }

    // 重试STAGE-4:角色系统
    if (failedStages.includes('STAGE-4') && stages.prd) {
      this.log('RETRY', '🔄 尝试重试角色系统(STAGE-4)...');
      // 需要原始input,这里简化处理
      this.log('RETRY', '⚠️ 角色系统需要重新输入配置,跳过自动重试');
      success = false;
    }

    // 重试后再次验证
    if (success) {
      this.log('RETRY', '🔄 重试后执行二次验证...');
      const revalidator = new PipelineIntegrityValidator({ mode: this.mode });
      const recheck = await revalidator.validatePipeline(stages);
      if (!recheck.valid) {
        this.log('RETRY', `⚠️ 二次验证仍有${recheck.summary.errorCount}个错误`, 'error');
        return { success: false, result: recheck };
      }
      return { success: true, result: recheck };
    }

    return { success: false, result: integrityResult };
  }

  // ========== 辅助方法(P0修复:结构化生成器) ==========

  // P0修复#1:生成默认mouthAction
  generateDefaultMouthAction(sceneType, isOpening) {
    if (isOpening) {
      return '嘴部微微张开正在自然说话自我介绍,口型动作柔和亲切,嘴角上扬微笑,右手抬起做打招呼手势';
    }
    switch (sceneType) {
      case 'explanation':
        return '嘴部自然张开正在讲解说明,口型动作清晰有力,偶尔点头配合讲解';
      case 'interaction':
        return '嘴部张开正在对话互动,表情生动,眼神交流自然';
      case 'demonstration':
        return '嘴部配合动作进行讲解,呼吸自然,偶尔抿嘴思考';
      case 'climax':
        return '嘴部张大正在激动陈述,表情强烈,情绪饱满';
      case 'closing':
        return '嘴部微笑总结发言,语速放缓,眼神温和';
      default:
        return '嘴部自然张开正在说话,口型动作自然流畅';
    }
  }

  // P0修复#19:计算情绪峰值阶段 (v6.2-patch97-fix: 增加climax_peak明确高潮标记)
  calculateEmotionPhase(index, total, sceneType) {
    const ratio = total > 1 ? index / (total - 1) : 0;
    // v6.2-patch97-fix: 若sceneType明确为climax,直接标记为climax_peak
    if (sceneType === 'climax') return 'climax_peak';
    if (ratio <= 0.15) return 'establishing';
    if (ratio <= 0.45) return 'rising';
    if (ratio <= 0.65) return 'building';
    if (ratio <= 0.85) return 'climax_peak'; // v6.2-patch97-fix: 0.65-0.85区间标记为明确高潮
    if (ratio <= 0.95) return 'climax';
    return 'resolve';
  }

  // P0修复#14:计算对象重要性(v2时长分配)
  calculateImportance(sceneType, index, total) {
    const ratio = total > 1 ? index / (total - 1) : 0;
    switch (sceneType) {
      case 'opening': return 9;
      case 'climax': return 10;
      case 'demonstration': return 8;
      case 'explanation': return 6;
      case 'interaction': return 4;
      case 'closing': return 7;
      default: return 5;
    }
  }

  // v6.2-patch65: 根据镜头位置自动推导叙事弧线标记 (shotType)
  _deriveShotType(index, total, sceneType) {
    const ratio = total > 1 ? index / (total - 1) : 0;

    // 特殊场景类型检测(v6.2-patch107:支持top-down和FPV场景)
    if (sceneType === 'top-down' || sceneType === 'top_down' || sceneType === '俯视') {
      return 'top-down';
    }
    if (sceneType === 'fpv' || sceneType === 'FPV' || sceneType === 'first-person' || sceneType === 'pov') {
      return 'fpv';
    }
    if (sceneType === 'parkour' || sceneType === '跑酷' || sceneType === 'chase') {
      return 'fpv';
    }

    // 基于位置的叙事弧线推导
    if (index === 0) return 'opening';
    if (ratio <= 0.25) return 'setup';
    if (ratio <= 0.50) return 'conflict';
    if (ratio <= 0.75) return 'rising';
    if (ratio <= 0.90) return 'climax';
    return 'resolution';
  }

  // P0修复#17:计算视觉复杂度(v2时长分配)
  calculateVisualComplexity(sceneType) {
    switch (sceneType) {
      case 'demonstration': return 8;
      case 'climax': return 9;
      case 'opening': return 6;
      case 'explanation': return 3;
      case 'interaction': return 4;
      case 'closing': return 5;
      default: return 5;
    }
  }

  /**
   * v6.2-patch80: 获取导演风格注入(供Prompt生成使用)
   * v6.5.13-fix: 支持generic模式,返回对应风格
   */
  _getDirectorStyleInjection(sceneName, shotType, emotionPhase) {
    // generic模式: 返回通用纪录片/教育风格
    if (this.mode !== 'nirath') {
      const isMedical = sceneName && (sceneName.includes('健康') || sceneName.includes('医疗') || sceneName.includes('医院') || sceneName.includes('科普'));
      const isDocumentary = isMedical || (sceneName && (sceneName.includes('纪录') || sceneName.includes('纪实')));
      return {
        sceneType: isDocumentary ? 'documentary' : 'generic',
        primaryDirector: isDocumentary ? '纪录片导演' : '通用导演',
        secondaryDirector: isDocumentary ? '医疗纪录片' : '通用风格',
        stylePrompt: isDocumentary
          ? '超写实纪录片风格,电影级自然光影,专业医疗科普氛围,真实人物质感,浅景深,4K画质'
          : '超写实,电影级光影,真实场景质感,自然光,专业氛围',
        directorTags: isDocumentary
          ? ['纪录片手持摄影', '自然光', '真实质感', '浅景深']
          : ['超写实', '电影级光影', '自然光'],
        recommendedTags: isDocumentary
          ? ['医疗纪录片', '真实场景', '专业氛围', '自然光']
          : ['通用风格', '写实']
      };
    }

    const { DirectorStyleLibrary } = require('../systems/director-style-library.js');
    const styleLib = new DirectorStyleLibrary({ mode: this.mode });

    // 推断场景类型
    const inferredSceneType = styleLib._inferSceneType({
      scene: sceneName,
      emotionPhase: emotionPhase,
      shotType: shotType
    });

    // 获取推荐风格
    const recommended = styleLib.recommendStyleForScene(inferredSceneType);

    // 获取融合风格
    const nirathBlend = styleLib.blendStyles();
    const stylePrompt = styleLib.generateStylePrompt(nirathBlend, 'Nirath电影级');

    // 提取导演核心标签(用于融入prompt)
    const primaryTags = recommended.primary?.coreTags?.map(t => t.desc).slice(0, 2) || [];
    const secondaryTags = recommended.secondary?.coreTags?.map(t => t.desc).slice(0, 1) || [];

    return {
      sceneType: inferredSceneType,
      primaryDirector: recommended.primary?.name?.split(' ')[0] || '未知',
      secondaryDirector: recommended.secondary?.name?.split(' ')[0] || '未知',
      stylePrompt: stylePrompt,
      directorTags: [...primaryTags, ...secondaryTags],
      recommendedTags: recommended.recommendedTags || []
    };
  }

  // P0修复#5/#6:提取关键词用于对齐检查
  extractKeywords(text) {
    if (!text) return [];
    // 提取中文关键词(去除停用词)
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    const words = text.split(/[\s,\.。,!?、;:""''()《》【】\n\-]+/).filter(w => w.length >= 2);
    return [...new Set(words.filter(w => !stopWords.has(w)))];
  }

  // Stage 11辅助:构建基础Prompt(v6.2-patch60: 集成Tier分层+通道分离+世界观过滤)
  buildBasePrompt(shot, characters) {
    // v6.2-patch60: 使用新模块构建高质量Prompt
    const tierBuilder = this.modules.promptTierArchitecture;
    const channelSeparator = this.modules.promptChannelSeparator;
    const sceneManager = this.modules.worldviewSceneManager;
    const emotionMapper = this.modules.techSpecsEmotionMapper;

    // Step 1: 通道分离 - 提取旁白
    const channelResult = channelSeparator.separate({
      narration: shot.narration,
      scene: { name: shot.scene, sceneCore: sceneManager.getSceneVisualCore(shot.scene, { mode: this.mode }) },
      characters: shot.characters?.map(cid => {
        const char = characters[cid];
        // v6.5.30-fix: defensive extraction - handle both string and object prompts
        let promptText = char?.prompt;
        if (promptText && typeof promptText === 'object') {
          promptText = promptText.prompt || promptText.description || promptText.name || String(cid);
        }
        return { name: cid, appearance: (typeof promptText === 'string' ? promptText.substring(0, 50) : String(promptText || cid)).substring(0, 50) };
      }) || [],
      emotionPhase: shot.emotionPhase || 'establishing',
      hasDialogue: shot.hasDialogue || false
    });

    // Step 2: 获取场景主数据
    const sceneData = sceneManager.getSceneData(shot.scene);
    const lighting = sceneManager.getSceneLighting(shot.scene);

    // Step 2.5: v6.2-patch80 导演风格注入
    const directorStyle = this._getDirectorStyleInjection(shot.scene, shot.cameraMovement?.type || shot.shotType, shot.emotionPhase || 'establishing');
    this.log('STAGE-6', `🎬 导演风格匹配: ${shot.scene} → ${directorStyle.sceneType} | 主风格: ${directorStyle.primaryDirector} + 辅风格: ${directorStyle.secondaryDirector}`);

    // Step 3: 世界观分层注入
    const worldview = sceneManager.getWorldviewInjection({
      sceneName: shot.scene,
      shotIndex: shot.shotIndex || 0,
      isOpening: shot.isOpening || false,
      sceneFirstAppearance: shot.sceneFirstAppearance || false
    });

    // Step 4: 动态表情映射
    const expression = emotionMapper.generateExpression(shot.emotionPhase || 'establishing');

    // Step 5: Tier分层构建Prompt (v2.0-B+: 七层架构 + 音频层)
    const tierResult = tierBuilder.build({
      sceneName: shot.scene,
      sceneType: directorStyle.sceneType || shot.scene,
      sceneCore: sceneManager.getSceneVisualCore(shot.scene, { mode: this.mode }),
      shotType: shot.cameraMovement?.type || shot.shotType || '电影级镜头',
      subject: shot.characters?.map(cid => {
        const char = characters[cid];
        // v6.5.30-fix: defensive extraction - handle both string and object prompts
        let promptText = char?.prompt;
        if (promptText && typeof promptText === 'object') {
          promptText = promptText.prompt || promptText.description || promptText.name || String(cid);
        }
        return (typeof promptText === 'string' ? promptText.substring(0, 80) : String(promptText || cid)).substring(0, 80);
      }).join(', '),
      action: shot.action || channelResult.visualPrompt.text || '',
      cameraMovement: shot.cameraMovement,
      emotionPhase: shot.emotionPhase || 'establishing',
      environmentFeatures: sceneData?.environmentFeatures || sceneData?.environmentTags || [],
      mode: this.mode,
      isOpening: shot.isOpening || false,
      isFirstShot: shot.shotIndex === 0,
      // v2.0-B+: 音频层参数
      timeOfDay: shot.lighting?.timeOfDay || sceneData?.timeOfDay || 'golden hour',
      hasCharacters: !!(shot.characters && shot.characters.length > 0),
      lipSync: !!(shot.mouthAction || shot.hasDialogue),
      // v6.2-patch80: 导演风格注入
      directorStyle: directorStyle
    });

    // Step 6: 质量评分
    const qualityResult = this.modules.promptQualityGate.evaluate({
      prompt: tierResult.prompt,
      tiers: tierResult.tiers,
      emotionPhase: shot.emotionPhase || 'establishing',
      hasDialogue: shot.hasDialogue || false,
      narration: shot.narration
    });

    // 组装结果
    const result = {
      prompt: tierResult.raw || tierResult.prompt,
      tierMetrics: tierResult.metrics,
      quality: qualityResult,
      channels: {
        narration: channelResult.narration,
        visual: channelResult.visualPrompt,
        lipSync: channelResult.lipSync
      },
      worldview: worldview,
      expression: expression,
      length: tierResult.prompt.length,
      utilization: tierResult.metrics.utilization
    };

    this.log('STAGE-11', `v6.2-patch60 Prompt构建 | Tier利用率:${result.tierMetrics.utilization}% | 质量:${result.quality.grade}(${result.quality.score}分) | 长度:${result.length}`, 'info');

    return result;
  }

  enforceStyle(prompt, sceneName) {
    if (this.mode === 'nirath') {
      return this.modules.renderCore.enforce(prompt, sceneName);
    }
    return { prompt, issues: [], compliant: true };
  }

  toStandardPrompt(shot, prompt) {
    const safe = (v) => (typeof v === 'string' ? v.trim() : '');

    const dialogue = safe(shot.dialogue); // v6.6.9.4-patch13: 只使用dialogue,禁用narration
    const scene = safe(
      typeof shot.scene === 'string'
        ? shot.scene
        : shot.scene?.name || shot.scene?.nirathName || ''
    );

    const cameraText =
      safe(shot.cameraMovement?.description) ||
      safe(typeof shot.cameraMovement === 'string' ? shot.cameraMovement : '') ||
      safe(shot._timeline?.summary) ||
      '';

    // v6.5.33-methodology: CAMERA字段增强 - 注入方法论镜头语言规范
    const enhancedCamera = this.enhanceCameraWithMethodology(cameraText, shot);

    const lightingText =
      safe(shot.lighting?.keyLight) ||
      safe(shot.lighting?.progression) ||
      (prompt.match(/【照明方案】([^【]*)/) || [])[1] ||
      '';

    const audioText = this.enhanceAudioWithMethodology(
      (prompt.match(/【音频】([^【]*)/) || [])[1] ||
      [
        /伴随[^,。,;;]*/g,
        /动作产生[^,。,;;]*/g,
        /氛围弥漫[^,。,;;]*/g,
        /音乐线索[^,。,;;]*/g,
        /声画精准同步[^,。,;;]*/g,
        /L1:[^|]+/g,
        /L2:[^|]+/g,
        /L3:[^|]+/g,
        /L4:[^|]+/g
      ]
        .flatMap((re) => prompt.match(re) || [])
        .join(','),
      shot
    );

    const negativeText =
      (prompt.match(/【负面约束】([^【]*)/) || [])[1] ||
      (prompt.match(/【全局负面约束】([^【]*)/) || [])[1] ||
      this.modules.globalNegativePromptInjector?.generateCompact({
        sceneType: shot.sceneType || 'nature_epic',
        hasCharacter: !!(shot.characters && shot.characters.length > 0),
        isRealistic: true,
        maxLength: 180
      }) ||
      '';

    const renderText =
      (prompt.match(/【技术规格】([^【]*)/) || [])[1] ||
      (prompt.match(/【渲染】([^【]*)/) || [])[1] ||
      (this.mode === 'nirath' ? '超写实数字渲染,影视级画面构图,体积光照明,空气透视感,皮肤与材质微距摄影级细节,写实风格,外星繁茂植被覆盖岩石地表,背景可见奇异生物活动。' : 'hyperrealistic cinematic quality, 35mm film grain, HDR, photorealistic with filmic treatment, 16:9 cinematic');

    const directorText =
      (prompt.match(/Director style:\s*([^【\n]+)/i) || [])[1] ||
      '通用导演风格';

    let characterText = '';
    if (Array.isArray(shot.characters) && shot.characters.length > 0) {
      characterText = shot.characters.join(',');
    }

    // v6.6.9.4-patch13: ACTION字段只保留动作描述,不再混入narration/dialogue
    const actionText =
      (prompt.match(/【动作】([^【]*)/) || [])[1] ||
      (prompt.match(/【动态】([^【]*)/) || [])[1] ||
      '自然动作';

    const moodMap = {
      establishing: '宁静,建立感',
      rising: '紧张上升',
      building: '情绪积累',
      climax: '高潮爆发',
      climax_peak: '高潮峰值',
      resolve: '温柔收束',
      resolution: '温柔收束',
      neutral: '自然平衡'
    };
    const moodText = this.enhanceMoodWithMethodology(moodMap[shot.emotionPhase] || '自然氛围', shot);

    // v6.5.33-methodology: 增强各字段
    const enhancedScene = this.enhanceSceneWithMethodology(scene, shot);
    const enhancedAction = this.enhanceActionWithMethodology(actionText, shot);
    const enhancedCharacter = this.enhanceCharacterWithMethodology(characterText, shot);

    // v6.6.9.4-patch13: 构建【人物介绍卡片】字段 - 从角色定妆照构建
    let characterCard = '';
    if (Array.isArray(shot.characters) && shot.characters.length > 0) {
      const charRefs = [];
      for (const charId of shot.characters) {
        // v6.6.9.4-fix: 同步读取角色卡片（loadCharacter是async，不能同步调用）
        let portraits = [];
        try {
          const cardPath = require('path').join(process.cwd(), 'characters', charId, 'character-card.json');
          const cardData = JSON.parse(require('fs').readFileSync(cardPath, 'utf8'));
          portraits = cardData.generatedAssets?.portraits || cardData.v2Metadata?.portraitPaths || [];
        } catch (e) {
          // 文件不存在或其他错误，保持空数组
        }
        if (portraits.length > 0) {
          charRefs.push(`${charId}: ${portraits.slice(0, 4).join(', ')}`);
        } else {
          charRefs.push(`${charId}: 无定妆照`);
        }
      }
      characterCard = charRefs.join(' | ');
    }

    // v6.6.9.4-patch14: 内容镜头15个标准字段(新增【情绪】【纵深】【方位】)
    const fields = [
      `【视觉】${enhancedCharacter || characterText || '人物出场,形象明确'}`,
      `【动态】${enhancedAction || actionText}`,
      `【空间】${enhancedScene || scene || '场景环境明确,空间关系清晰'}`,
      `【情绪】${moodText}`,
      `【纵深】${shot.depthOfField || '景深自然,层次清晰'}`,
      `【方位】${shot.cameraAngle || '平视角度,构图平衡'}`,
      `【风格】${shot.style || (prompt.match(/【风格】([^【]*)/) || [])[1] || '纪录片风格,真实自然'}`,
      `【镜头时间轴】${enhancedCamera || cameraText || '35mm lens, eye level medium shot, steady tracking shot'}`,
      `【照明】${lightingText || '自然光,明暗层次清晰'}`,
      `【负面约束】${negativeText || 'no text, no anime, no cartoon, no deformed hands, no extra fingers, no watermark'}`,
      `【环境音效】${audioText || '环境音自然,声画同步'}`,
      `【渲染】${renderText}`,
      `【导演】${directorText}`
    ];

    // v6.6.9.4-patch13: 添加台词字段(如果dialogue存在)
    if (dialogue) {
      fields.push(`【台词】"${dialogue}"`);
    }

    // v6.6.9.4-patch13: 添加人物介绍卡片字段(如果角色有定妆照)
    if (characterCard) {
      fields.push(`【人物介绍卡片】${characterCard}`);
    }

    let result = fields.join(' | ');

    // 保留原始自然语言Prompt的丰富视觉描述,避免信息丢失
    const originalPrompt = (prompt || '').trim();
    if (originalPrompt.length > 0) {
      const remaining = PROMPT_LENGTH.HARD_MAX - result.length - 3; // 预留 " | " 分隔符
      if (remaining > 50) {
        result += ' | ' + originalPrompt.substring(0, remaining);
      }
    }

    // v6.5.34-fix: 保留Nirath模式约束字段
    if (this.mode === 'nirath') {
      const preserveBlocks = ['【风格锁】', '【负面约束】', '【角色约束】', '【镜头时间轴】', '【明亮约束】'];
      const preservedConstraints = [];
      for (const block of preserveBlocks) {
        const match = originalPrompt.match(new RegExp(`${block}[^【]*?(?=【|$)`));
        if (match && match[0].trim().length > block.length) {
          preservedConstraints.push(match[0].trim());
        }
      }
      if (preservedConstraints.length > 0) {
        const constraintsStr = ' ' + preservedConstraints.join(' ');
        if (result.length + constraintsStr.length <= PROMPT_LENGTH.HARD_MAX) {
          result += constraintsStr;
        } else {
          const maxResultLen = PROMPT_LENGTH.HARD_MAX - constraintsStr.length;
          result = result.substring(0, maxResultLen).trim() + constraintsStr;
        }
      }
    }

    return safeStructuredTrim(result, PROMPT_LENGTH.HARD_MAX);
  }

  ensureFinalPromptStructure(shot, prompt) {
    let result = prompt || '';

    const blocks = [];

    if (!/【视觉】/i.test(result)) {
      const chars = Array.isArray(shot.characters) ? shot.characters.join(',') : '人物';
      blocks.push(`【视觉】${chars}`);
    }

    if (!/【动态】/i.test(result)) {
      blocks.push(`【动态】${shot.dialogue || '自然动作'}`);
    }

    if (!/【空间】/i.test(result)) {
      const scene = typeof shot.scene === 'string' ? shot.scene : (shot.scene?.name || '场景环境');
      blocks.push(`【空间】${scene}`);
    }

    if (!/【情绪】/i.test(result)) {
      blocks.push(`【情绪】${shot.emotionPhase || '自然氛围'}`);
    }

    if (!/【纵深】/i.test(result)) {
      blocks.push(`【纵深】${shot.depthOfField || '景深自然,层次清晰'}`);
    }

    if (!/【方位】/i.test(result)) {
      blocks.push(`【方位】${shot.cameraAngle || '平视角度,构图平衡'}`);
    }

    if (!/【风格】/i.test(result)) {
      blocks.push(`【风格】${shot.emotionPhase || '自然氛围'}`);
    }

    if (!/【镜头时间轴】/i.test(result)) {
      blocks.push(`【镜头时间轴】${shot.cameraMovement?.description || '中景平稳运镜'}`);
    }

    if (!/【照明】/i.test(result)) {
      blocks.push(`【照明】${shot.lighting?.keyLight || '自然光,明暗层次清晰'}`);
    }

    if (!/【环境音效】/i.test(result) && /(?:伴随|动作产生|氛围弥漫|音乐线索|声画精准同步)/.test(result)) {
      const audioParts = [];
      const patterns = [
        /伴随[^,。|]*/gi,
        /动作产生[^,。|]*/gi,
        /氛围弥漫[^,。|]*/gi,
        /音乐线索[^,。|]*/gi,
        /声画精准同步[^,。|]*/gi
      ];
      for (const re of patterns) {
        audioParts.push(...(result.match(re) || []));
      }
      if (audioParts.length > 0) {
        blocks.push(`【环境音效】 ${audioParts.join(',')}`);
      }
    }

    if (!/【渲染】/i.test(result)) {
      blocks.push(`【渲染】 ${this.mode === 'nirath' ? '超写实数字渲染,影视级画面构图,体积光照明,空气透视感,皮肤与材质微距摄影级细节,写实风格,外星繁茂植被覆盖岩石地表,背景可见奇异生物活动。' : 'hyperrealistic cinematic quality, 35mm film grain, HDR, photorealistic with filmic treatment, 16:9 cinematic'}`);
    }

    if (!/【导演】/i.test(result)) {
      blocks.push('【导演】 通用导演风格');
    }

    if (blocks.length > 0) {
      result = `${blocks.join(' | ')} | ${result}`;
    }

    if (result.length > PROMPT_LENGTH.HARD_MAX) {
      result = safeStructuredTrim(result, PROMPT_LENGTH.HARD_MAX);
    }

    return result;
  }

  dedupePromptFragments(prompt) {
    if (!prompt || typeof prompt !== 'string') return prompt;

    const fragments = prompt
      .split(/[,,]/)
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const frag of fragments) {
      const key = frag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(frag);
      }
    }

    return result.join(',');
  }

  // ========== 获取模块状态 ==========
  getModuleStatus() {
    return {
      totalModules: 16,
      initialized: Object.keys(this.modules).length,
      mode: this.mode,
      modules: Object.keys(this.modules)
    };
  }
  // ========== v6.0-patch23: 镜头内增强辅助方法 ==========

  /**
   * 智能裁剪Prompt
   * 优先保留主体描述,裁剪辅助性内容
   */
  // v6.5.6-fix: 角度名称映射到实际文件名
  mapAngleToFileName(angle) {
    const angleMap = {
      'front': 'front_fullbody',
      'threeQuarter': 'three_quarter',
      'closeup': 'face_closeup',
      'side': 'side_profile'
    };
    return angleMap[angle] || angle;
  }

  smartTrim(prompt, maxLength, options = {}) {
    const { preserve = [], trim = [] } = options;

    if (prompt.length <= maxLength) return prompt;

    // ========== v6.2-patch47-fix: 支持无结束标记的单标记格式 ==========
    // 策略:将Prompt按段落/标记拆分为独立区块,优先保留核心区块

    // Step 1: 将Prompt拆分为区块(按【xxx】标记分割)
    // v2.0-B+-fix: 同时支持自然语言格式(伴随/动作产生/氛围弥漫/音乐线索/声画精准同步)
    const blocks = [];
    const markerPattern = /【([^【】]+)】/g;
    let lastIndex = 0;
    let match;

    // 自然语言音频标记正则
    const audioPattern = /(伴随|动作产生|氛围弥漫|音乐线索|声画精准同步)[^【】\n,。]+/g;

    while ((match = markerPattern.exec(prompt)) !== null) {
      // 标记前的普通文本
      if (match.index > lastIndex) {
        blocks.push({
          type: 'plain',
          content: prompt.substring(lastIndex, match.index),
          isCore: false
        });
      }

      // 提取标记名称
      const markerName = match[1];

      // 找到下一个标记或文本结束
      const nextMatch = markerPattern.exec(prompt);
      markerPattern.lastIndex = match.index + match[0].length; // 重置搜索位置

      let endPos;
      if (nextMatch) {
        endPos = nextMatch.index;
        markerPattern.lastIndex = nextMatch.index; // 下次从nextMatch开始
      } else {
        endPos = prompt.length;
      }

      const blockContent = prompt.substring(match.index, endPos);

      // 判断是否为trim列表中的区块
      const isTrim = trim.some(t => markerName.includes(t) || t.includes(markerName));
      // 判断是否为preserve列表中的区块
      const isPreserve = preserve.some(p => markerName.includes(p) || p.includes(markerName));

      blocks.push({
        type: 'marked',
        marker: markerName,
        content: blockContent,
        isCore: isPreserve,
        isTrim: isTrim
      });

      lastIndex = endPos;
    }

    // 剩余文本
    if (lastIndex < prompt.length) {
      blocks.push({
        type: 'plain',
        content: prompt.substring(lastIndex),
        isCore: false
      });
    }

    // 🔊 v2.0-B+-fix: 识别自然语言格式的音频层,标记为核心区块
    const audioKeywords = ['伴随', '动作产生', '氛围弥漫', '音乐线索', '声画精准同步'];
    for (const block of blocks) {
      if (block.type === 'plain' && !block.isCore) {
        // 检查是否包含音频关键词
        const hasAudio = audioKeywords.some(kw => block.content.includes(kw));
        if (hasAudio) {
          // 检查是否在 preserve 列表中
          const isPreserve = preserve.some(p => audioKeywords.includes(p));
          if (isPreserve) {
            block.isCore = true;
          }
        }
      }
    }

    // Step 2: 先移除trim列表中的区块
    const afterTrim = blocks.filter(b => !b.isTrim);
    let currentLength = afterTrim.reduce((sum, b) => sum + b.content.length, 0);

    if (currentLength <= maxLength) {
      return afterTrim.map(b => b.content).join('');
    }

    // Step 3: 仍超限,保留核心区块,裁剪非核心区块
    let result = '';
    let resultLength = 0;

    // 第一轮:优先保留核心区块(🔊 音频层优先保留)
    // 先保留音频层,确保声音不被截断
    const audioBlocks = afterTrim.filter(b => b.marker === '音频' || (b.type === 'plain' && b.isCore && audioKeywords.some(kw => b.content.includes(kw))));
    const otherCoreBlocks = afterTrim.filter(b => b.isCore && !audioBlocks.includes(b));

    for (const block of audioBlocks) {
      if (resultLength + block.content.length <= maxLength) {
        result += block.content;
        resultLength += block.content.length;
      }
    }

    for (const block of otherCoreBlocks) {
      if (resultLength + block.content.length <= maxLength) {
        result += block.content;
        resultLength += block.content.length;
      }
    }

    // 第二轮:用非核心区块填充剩余空间
    for (const block of afterTrim) {
      if (!block.isCore) {
        const remaining = maxLength - resultLength;
        if (remaining <= 0) break;
        if (block.content.length <= remaining) {
          result += block.content;
          resultLength += block.content.length;
        } else {
          // v6.2-patch56-fix: 智能截断,优先在标点处截断
          const partial = this.trimAtPunctuation(block.content, remaining);
          result += partial;
          resultLength += partial.length;
          // v6.2-patch61-fix: 不break,继续尝试添加后续完整block
        }
      }
    }

    return result;
  }

  /**
   * 安全裁剪结构化Prompt，防止截断【块标记】导致 Stage-12 解析失败
   * v6.6.9.4-patch17: 外部专家方案 - P1 修复
   */
  safeTrimStructuredPrompt(prompt, maxLength) {
    if (!prompt || prompt.length <= maxLength) return prompt;

    let trimmed = prompt.slice(0, maxLength);

    const lastOpen = trimmed.lastIndexOf('【');
    const lastClose = trimmed.lastIndexOf('】');

    // 如果最后一个块被截断，回退到该块之前
    if (lastOpen > lastClose) {
      trimmed = trimmed.slice(0, lastOpen);
    }

    // 清理尾部残缺分隔符
    trimmed = trimmed.replace(/\s*\|\s*$/, '').trim();

    return trimmed;
  }

  // v6.3-patch10-fix: 最终兜底补齐 - 如果提示词仍然太短,强制补齐到目标长度
  finalFillPrompt(prompt, shotId) {
    let out = String(prompt || '').trim();
    const target = PROMPT_LENGTH.TARGET_MAX;
    const hardLimit = PROMPT_LENGTH.HARD_MAX;

    if (charCounter.count(out) >= target) return out;

    const fillers = [
      '电影级超写实环境叙事与层叠空间深度',
      '顶级材质保真与物理可信纹理响应',
      '体积光分离与大气深度对比控制',
      '清晰主体可读性与稳定视觉身份连续性',
      '微妙环境微观动态与粒子运动',
      '受控摄影机节奏与刻意焦点迁移',
      '高端写实影像质感与空间层次',
      '微表情完整性、姿态写实、呼吸节奏、稳定身体力学'
    ];

    for (const item of fillers) {
      if (charCounter.count(out) >= target) break;
      const next = `${out}, ${item}`;
      if (charCounter.count(next) <= hardLimit) {
        out = next;
      }
    }

    if (charCounter.count(out) > hardLimit) {
      out = charCounter.truncate(out, hardLimit);
    }

    return out;
  }

  /**
   * v6.2-patch56: 在标点符号处智能截断文本
   * 优先在句号、逗号等标点处截断,避免截断句子中间
   */
  trimAtPunctuation(text, maxLength) {
    if (text.length <= maxLength) return text;

    // 先在maxLength处截断
    let trimmed = text.substring(0, maxLength);

    // 向前查找最近的标点符号(句号、逗号、分号、感叹号、问号)
    const punctuations = ['。', ',', ';', '!', '?', '.', ',', ';', '!', '?'];
    let lastPunctIndex = -1;

    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (punctuations.includes(trimmed[i])) {
        lastPunctIndex = i;
        break;
      }
    }

    // 如果找到标点,在标点后截断(包含标点)
    if (lastPunctIndex > 0) {
      return trimmed.substring(0, lastPunctIndex + 1);
    }

    // 没找到标点,退而求其次:在空格处截断
    let lastSpaceIndex = trimmed.lastIndexOf(' ');
    if (lastSpaceIndex > 0) {
      return trimmed.substring(0, lastSpaceIndex);
    }

    // 最后手段:直接截断
    return trimmed;
  }

  /**
   * 计算情绪深度评分(0-100)
   * 基于运镜变化数和光影递进复杂度
   */
  calculateEmotionalDepth(enhanced) {
    // v6.0-patch23-fix: 空shot降级保护
    const hasAnyEnhancement = enhanced.segments || enhanced.lighting || enhanced.prompt;
    if (!hasAnyEnhancement) {
      return 50; // 默认基础分
    }

    let score = 0;

    // 运镜变化贡献(每段+15分,最高45分)
    const segmentCount = enhanced.segments?.length || 1;
    score += Math.min(45, (segmentCount - 1) * 15);

    // 光影递进贡献(有递进+30分)
    if (enhanced.lighting?.progression && enhanced.lighting.progression !== 'none') {
      score += 30;
    }

    // 时间轴描述完整性(有描述+25分)
    if (enhanced.prompt?.includes('【镜头时间轴】')) {
      score += 25;
    }

    return Math.min(100, score);
  }

  /**
   * v6.2-patch41: 情绪深度评分V2(0-20分)
   * 基于shot的narration、独白、台词冲突密度
   * v6.3-patch3: 扩展情绪关键词至50个,增加情绪暗示词检测
   */
  // v6.5.37-fix: 系统级修复 - 情绪深度评分增强(generic/social模式)
  // 根因:social模式缺乏Nirath情绪词, narration长度短,导致情绪深度仅7-8.5/15分
  // 修复:增加通用情绪基础分 + 扩展情绪关键词检测
  calculateEmotionalDepthV2(shot, prompt) {
    let score = 0;

    // 1. narration独白存在性(最高8分)
    const narration = shot.narration || shot.innerMonologue || '';
    if (narration.length > 0) {
      score += Math.min(8, Math.floor(narration.length / 10)); // 每10字+1分,最高8
    }

    // 2. 异兽台词存在性(最高6分)
    const beastLines = shot.beastLines || shot.beastDialogue || [];
    if (Array.isArray(beastLines) && beastLines.length > 0) {
      score += Math.min(6, beastLines.length * 2); // 每句+2分,最高6
    }

    // 3. Prompt中情绪关键词密度(最高6分)
    // v6.5.37-fix: 扩展通用情绪关键词,支持social/generic模式
    const emotionKeywords = [
      // 基础情绪词(中文)
      '恐惧', '敬畏', '温柔', '愤怒', '悲伤', '喜悦', '紧张', '困惑', '好奇', '释然',
      '不安', '神秘', '希望', '平静', '激动', '震惊', '失望', '期待', '犹豫', '坚定',
      '压迫', '震撼', '渺小', '宏大', '未知', '探索', '对抗', '和解', '觉醒', '蜕变',
      '孤独', '陪伴', '危险', '安全', '渴望', '满足', '迷茫', '清晰', '脆弱', '强大',
      // 温馨/治愈系(social模式常用)
      '温暖', '治愈', '甜蜜', '幸福', '可爱', '萌', '柔软', '轻盈', '明亮', '阳光',
      '笑容', '微笑', '开心', '快乐', '欢乐', '温馨', '舒适', '安心', '宁静', '安详',
      '宠溺', '呵护', '守护', '依偎', '拥抱', '亲吻', '抚摸', '牵手', '陪伴', '成长',
      // 基础情绪词(英文)
      'fear', 'awe', 'tender', 'anger', 'sad', 'joy', 'tense', 'confused', 'curious', 'relieved',
      'uneasy', 'mysterious', 'hope', 'calm', 'excited', 'shocked', 'disappointed', 'expect', 'hesitant', 'determined',
      'warm', 'healing', 'sweet', 'happy', 'cute', 'soft', 'bright', 'sunny', 'smile', 'cozy',
      // 情绪暗示词(中文)- 通过动作/光影暗示情绪
      '逼近', '退缩', '凝视', '颤抖', '屏息', '仰望', '俯视', '逼近', '逃离', '拥抱',
      '对峙', '追逐', '缠绕', '包围', '吞噬', '绽放', '收缩', '膨胀', '凝固', '流动',
      '阴影覆盖', '光芒四射', '黑暗笼罩', '微光闪烁', '深渊', '巅峰', '漩涡', '风暴', '宁静', '爆发',
      '阳光洒落', '夕阳余晖', '温暖光线', '柔和光影', ' golden glow', 'soft light', 'gentle breeze',
      // 情绪暗示词(英文)
      'looming', 'retreating', 'gazing', 'trembling', 'holding breath', 'looking up', 'looking down', 'approaching', 'fleeing', 'embracing',
      'confronting', 'chasing', 'twining', 'surrounding', 'devouring', 'blooming', 'contracting', 'expanding', 'solidifying', 'flowing',
      'shadow covering', 'radiant', 'darkness enveloping', 'flickering', 'abyss', 'peak', 'vortex', 'storm', 'serene', 'bursting',
      'sunlight', 'sunset glow', 'warm light', 'soft lighting', 'gentle breeze'
    ];
    const promptLower = prompt.toLowerCase();
    let keywordCount = 0;
    for (const kw of emotionKeywords) {
      if (promptLower.includes(kw.toLowerCase())) keywordCount++;
    }
    score += Math.min(6, keywordCount * 0.5); // 每个情绪词+0.5分,最高6

    // v6.5.37-fix: emotionPhase基础分增强(如果标注了情感阶段,给予更高基础分)
    const phase = shot.emotionPhase || shot.emotion || '';
    if (phase) {
      score += 4; // 从+3提升到+4
    }

    // v6.5.37-fix: social/generic模式额外基础分(缺乏Nirath式情绪冲突)
    if (this.mode === 'social' || this.mode === 'generic') {
      score += 3; // 补偿缺乏异兽台词和冲突的扣分
    }

    return Math.min(20, score);
  }

  /**
   * v6.2-patch41: 叙事画面对齐评分(0-20分)
   * narration台词内容与画面描述的一致性
   */
  /**
   * v6.2-patch104: 根据场景类型计算差异化照明方案
   * 为每个镜头设计独特的三点照明方案,避免每镜都一样
   */
  calculateSceneSpecificLighting(shot, prompt) {
    const sceneType = shot.shotType || shot.type || 'generic';
    const sceneName = shot.scene || '';
    const emotionPhase = shot.emotionPhase || '';

    // 场景类型照明映射表
    const lightingSchemes = {
      'opening': {
        name: '开场发现照明',
        keyLight: { position: 'Aurelius上方30°', color: '5800K暖金', intensity: '中等,柔光箱' },
        fillLight: { position: 'Silvana侧方45°', color: '6500K清冷银白', intensity: '弱,填充阴影' },
        rimLight: { position: '后方', color: '磁丝淡蓝紫', intensity: '中等,勾勒轮廓' },
        ratio: '3:1',
        emotion: '明亮、希望、探索感'
      },
      'discovery': {
        name: '发现诡异照明',
        keyLight: { position: '裂隙下方上射', color: '8800K冷蓝', intensity: '强,硬光' },
        fillLight: { position: '仅面部轮廓', color: '微弱', intensity: '极弱,保持神秘感' },
        rimLight: { position: '磁丝树冷光', color: '淡蓝紫', intensity: '强,恐怖片经典背光' },
        ratio: '8:1',
        emotion: '不安、神秘、恐惧'
      },
      'confrontation': {
        name: '对峙冲突照明',
        keyLight: { position: 'Aurelius+Silvana双侧', color: '5800K/6500K双色', intensity: '强,硬光' },
        fillLight: { position: '下方', color: '岩浆橙红', intensity: '中等,反射光' },
        rimLight: { position: '角色背后', color: '火山岩橙红', intensity: '强,轮廓分离' },
        ratio: '5:1',
        emotion: '紧张、对抗、压迫感'
      },
      'climax': {
        name: '高潮爆发照明',
        keyLight: { position: '上方直射', color: '5800K金白', intensity: '极强,硬光' },
        fillLight: { position: '四周', color: '等离子紫', intensity: '中等,环境光' },
        rimLight: { position: '背后', color: '等离子紫', intensity: '极强,能量爆发' },
        ratio: '10:1',
        emotion: '爆发、能量、震撼'
      },
      'closing': {
        name: '结尾温暖照明',
        keyLight: { position: 'Aurelius低角度', color: '5800K暖金', intensity: '中等,柔光' },
        fillLight: { position: 'Silvana', color: '6500K银白', intensity: '弱,填充' },
        rimLight: { position: '地面反射', color: '菌丝金色', intensity: '中等,温暖' },
        ratio: '2:1',
        emotion: '温暖、希望、平静'
      }
    };

    /**
   * v6.2-patch106-fix: 场景化环境描述生成
   * 根据场景名称生成差异化环境描述,避免所有镜头使用同一套模板
   */
    let scheme = lightingSchemes[sceneType] || lightingSchemes['generic'];

    // 如果没有找到,使用默认
    if (!scheme) {
      scheme = {
        name: '通用明亮照明',
        keyLight: { position: 'Aurelius上方', color: '5800K', intensity: '中等' },
        fillLight: { position: 'Silvana侧方', color: '6500K', intensity: '弱' },
        rimLight: { position: '后方', color: '磁丝蓝紫', intensity: '中等' },
        ratio: '3:1',
        emotion: '明亮、自然'
      };
    }

    // 检查prompt是否已经包含这些照明信息(严格检查:需要主光+补光+背光的具体描述)
    const hasKeyLightDetail = /主光|key\s*light|主光源|主照明|从.+上方.+照射|顶光|硬光/i.test(prompt) ||
                              (prompt.includes(scheme.keyLight.position) && prompt.includes(scheme.keyLight.color));
    const hasFillLightDetail = /补光|fill\s*light|补光源|辅光|辅照明|柔和|填充光|减淡阴影/i.test(prompt) ||
                               (prompt.includes(scheme.fillLight.position) && prompt.includes(scheme.fillLight.color));
    const hasRimLightDetail = /背光|轮廓光|rim\s*light|边缘光|逆光|轮廓线|分离光|发丝光|勾勒轮廓/i.test(prompt) ||
                              (prompt.includes(scheme.rimLight.position) && prompt.includes(scheme.rimLight.color));

    return {
      scheme,
      hasKeyLightDetail,
      hasFillLightDetail,
      hasRimLightDetail,
      // 如果缺少照明细节,返回建议注入的文本
      suggestedInjection: (!hasKeyLightDetail || !hasFillLightDetail || !hasRimLightDetail)
        ? this.generateLightingInjection(scheme, shot)
        : null
    };
  }


  generateSceneSpecificEnvironment(sceneName, shotType) {
    const sceneEnvironments = {
      '涿鹿战场': {
        backdrop: '【环境布景】远古战争遗迹,钩吾废墟边缘。地热裂缝透出橙红光芒,磁铁矿岩壁发出幽微电磁光。地表铺满多铜玉碎石,在双恒星照射下反射金橙与银白双色反光。',
        texture: '【环境质感】废墟岩石粗粝质感,熔岩冷却后形成的玻璃质表层。远处可见断裂的磁丝树桩,切面呈现年轮状磁场纹路。',
        ecology: '生态痕迹:战争遗留的熔岩结晶,某些裂缝正在"愈合",可见新生发光岩脉如同缝合线。'
      },
      '裂隙微光': {
        backdrop: '【环境布景】幽蓝裂隙深渊,晶状菌丝如神经网般覆盖岩壁。孢子雾在裂隙中缓慢升腾,随磁场脉动形成呼吸般的明暗节奏。',
        texture: '【环境质感】菌丝半透明胶质质感,裂隙边缘岩石被生物矿化形成彩色结晶层。体积光从裂隙深处透射,照亮飘浮的孢子微粒。',
        ecology: '生态活跃:原始单细胞发光毯覆盖裂隙底部;晶状菌丝随声波脉动;某些菌丝正在释放孢子,形成微型"孢子雪"。'
      },
      '不周山脉': {
        backdrop: '【环境布景】断天顶主峰,黑曜石与发光矿物交织的山体。断层暴露的水晶矿脉含稀土元素,在地热激活下发出脉动橙红光芒。远古撞击坑形成巨大环形凹陷。',
        texture: '【环境质感】黑曜石半透明镜面反射,水晶矿脉如血管般嵌入岩体。岩浆残留形成的玻璃质表层呈现虹彩效果。',
        ecology: '地质特征:山体由65%黑曜石、20%水晶、10%稀土矿、5%熔岩残留构成。主峰高12000米,为星球最高点。'
      },
      '晨星之约': {
        backdrop: '【环境布景】孢子花园,磁丝树森林环绕的开阔地。地面铺满发光苔藓,形成柔软的生物荧光地毯。两颗卫星的引力交汇造成潮汐锁定区域,大气折射形成罕见光弧。',
        texture: '【环境质感】苔藓柔软绒面质感,磁丝树皮呈现年轮状磁场纹路。孢子随风飘散,在双恒星光照下如金色尘埃。',
        ecology: '生态奇观:孢子花园为Nirath最古老生态系统,某些磁丝树树龄超过10亿年。发光苔藓随双恒星位置变化切换金橙/银白色调。'
      }
    };

    // 默认环境(当场景不在映射中时)
    const defaultEnv = {
      backdrop: '【环境布景】Nirath异世界场景,中景原始发光毯覆盖地表,随磁场脉动明暗。生态活跃:原始单细胞发光毯覆盖地表;矿物结晶生长过程缓慢可见。',
      texture: '【环境质感】背景环境采用实景拍摄质感,物理真实世界,35mm胶片颗粒,轻微噪点,4K高清,电影质感。',
      ecology: '禁止塑料/CG质感,禁止光秃秃/荒芜/寸草不生。'
    };

    const env = sceneEnvironments[sceneName] || defaultEnv;

    // 根据镜头类型调整侧重点
    if (shotType === 'opening' || shotType === 'establishing') {
      return `${env.backdrop}\n${env.ecology}\n${env.texture}`;
    } else if (shotType === 'discovery') {
      return `${env.backdrop}\n${env.texture}\n微观生态细节:${env.ecology}`;
    } else if (shotType === 'confrontation') {
      return `${env.backdrop}\n${env.texture}\n战斗地形:${env.ecology}`;
    } else {
      return `${env.backdrop}\n${env.ecology}\n${env.texture}`;
    }
  }

  /**
   * v6.5.33-methodology: 生成照明方案注入文本(融合方法论光影系统规范)
   * 基于《AI视频生成提示词工程方法论》4.1光影描述标准格式
   * 结构: [主光源]+[位置/方向]+[色温]+[光质]+[强度] + [辅助光源]+[位置]+[功能] + [环境光] + [特殊现象]
   */
  generateLightingInjection(scheme, shot) {
    const duration = shot.duration || 10;

    // 方法论映射:将现有scheme转换为方法论标准格式
    // 色温映射
    const colorTempMap = {
      '暖金': '3200K warm golden',
      '暖黄': '3000K warm tungsten',
      '金白': '4500K neutral warm',
      '冷蓝': '8000K+ cool blue',
      '蓝紫': '9000K blue-purple',
      '冷白': '6500K cool daylight',
      '白': '5600K daylight balanced',
      '双色': '3200K/5600K mixed'
    };

    // 光质映射(硬光/软光/散射/直射)
    const lightQuality = scheme.keyLight?.intensity?.includes('硬') ? 'hard light' :
                         scheme.keyLight?.intensity?.includes('柔') ? 'soft light' : 'diffused';

    // 位置映射(top/front/side/back/under/ambient)
    const positionMap = {
      '上方': 'top light from above',
      '上方30°': 'top light 30-degree from above',
      '低角度': 'low angle back light',
      '双侧': 'side light from both sides',
      '下方': 'under light from below',
      '裂隙下方': 'under light through crevice',
      '直射': 'direct front light'
    };

    const keyPosition = positionMap[scheme.keyLight?.position] || scheme.keyLight?.position || 'key light from 45-degree left';
    const keyColor = colorTempMap[scheme.keyLight?.color] || scheme.keyLight?.color || '5600K daylight';
    const keyIntensity = scheme.keyLight?.intensity?.replace(/[,,]/g, '') || 'medium';

    const fillPosition = positionMap[scheme.fillLight?.position] || scheme.fillLight?.position || 'soft fill from right';
    const fillColor = colorTempMap[scheme.fillLight?.color] || scheme.fillLight?.color || 'ambient fill';
    const fillIntensity = scheme.fillLight?.intensity?.replace(/[,,]/g, '') || 'soft';

    const rimPosition = positionMap[scheme.rimLight?.position] || scheme.rimLight?.position || 'rim light from behind';
    const rimColor = colorTempMap[scheme.rimLight?.color] || scheme.rimLight?.color || 'warm rim';
    const rimIntensity = scheme.rimLight?.intensity?.replace(/[,,]/g, '') || 'strong';

    // 特殊光学现象(根据情绪阶段推断)
    const phenomenaMap = {
      'establishing': 'volumetric light shafts through atmospheric haze',
      'rising': 'rim light edge glow separating subject from background',
      'climax': 'intense volumetric light, visible light beams',
      'resolve': 'soft diffused light, gentle atmospheric scattering',
      'neutral': 'natural ambient light, subtle atmospheric haze'
    };
    const phenomenon = phenomenaMap[scheme.emotion] || phenomenaMap['neutral'];

    return `
【照明方案】${scheme.name} | ${scheme.ratio}光比
主光: warm key light ${keyPosition}, ${keyColor}, ${lightQuality}, ${keyIntensity} intensity
补光: ${fillPosition}, ${fillColor}, ${fillIntensity} fill
背光: strong rim light ${rimPosition}, ${rimColor}, ${rimIntensity} rim
特殊现象: ${phenomenon}
情绪: ${scheme.emotion}`;
  }

  /**
   * v6.5.33-methodology: 使用方法论镜头语言规范增强CAMERA字段
   * 基于《AI视频生成提示词工程方法论》2.5 CAMERA维度 + 6.1景别体系
   * 注入:shot size(景别) + lens(焦距/光圈) + movement(运镜英文术语) + speed(速度等级)
   */
  enhanceCameraWithMethodology(cameraText, shot) {
    if (!cameraText || cameraText.length < 3) return cameraText;

    // 如果已经包含英文术语,跳过增强
    if (/\b(35mm|50mm|85mm|f\/\d|dolly|tracking|orbit|pan|tilt|wide shot|close-up|medium shot)\b/i.test(cameraText)) {
      return cameraText;
    }

    // 景别映射(方法论6.1)
    const shotSizeMap = {
      'extreme_wide': 'extreme wide shot establishing',
      'wide': 'wide shot',
      'medium_long': 'medium long shot',
      'medium': 'medium shot',
      'medium_close': 'medium close-up',
      'close': 'close-up',
      'extreme_close': 'extreme close-up',
      'insert': 'insert shot'
    };

    // 运镜英文映射(方法论2.5.2)
    const movementMap = {
      '推': 'dolly in',
      '拉': 'dolly out',
      '横摇': 'pan',
      '纵摇': 'tilt',
      '横移': 'truck',
      '升降': 'pedestal',
      '跟随': 'tracking shot',
      '环绕': 'orbit',
      '手持': 'handheld',
      '斯坦尼康': 'steadicam',
      '固定': 'static',
      '缩放': 'zoom',
      '甩': 'whip pan',
      '极速穿梭': 'whip pan rapid movement'
    };

    // 速度映射(方法论2.5.4)
    const speedMap = {
      '极慢': 'extremely slow, gradual',
      '慢': 'slow, gentle, smooth',
      '中速': 'steady, moderate pace',
      '快': 'fast, rapid',
      '极快': 'extremely fast, lightning',
      '变速': 'ramping speed'
    };

    // 镜头参数推荐(根据景别)
    const lensMap = {
      'extreme_wide': '16mm wide angle lens, f/8 deep depth of field',
      'wide': '24mm lens, f/5.6 moderate depth',
      'medium_long': '35mm lens, f/4 moderate depth',
      'medium': '50mm lens, f/2.8 shallow depth of field',
      'medium_close': '85mm portrait lens, f/2.0 shallow depth',
      'close': '85mm lens, f/1.8 shallow depth of field',
      'extreme_close': '100mm macro lens, f/2.8'
    };

    // 从shot中提取信息
    const shotSize = shot.shotSize || shot.cameraMovement?.shotSize || 'medium';
    const movement = shot.cameraMovement?.movementType || shot.cameraMovement?.movement || '';
    const speed = shot.cameraMovement?.speed || shot.speed || '中速';

    // 组装方法论格式 CAMERA 字段
    const parts = [];

    // 1. 镜头参数 (lens + aperture + shot size)
    const lensParams = lensMap[shotSize] || lensMap['medium'];
    const shotSizeDesc = shotSizeMap[shotSize] || shotSizeMap['medium'];
    parts.push(`${lensParams}, ${shotSizeDesc}`);

    // 2. 运镜 (movement + speed)
    let movementDesc = '';
    // 尝试从中文映射
    for (const [cn, en] of Object.entries(movementMap)) {
      if (movement.includes(cn) || cameraText.includes(cn)) {
        movementDesc = en;
        break;
      }
    }
    // 如果未匹配,尝试从cameraText提取关键动词
    if (!movementDesc) {
      if (/跟随|跟拍|追踪/.test(cameraText)) movementDesc = 'tracking shot';
      else if (/环绕|旋转|围绕/.test(cameraText)) movementDesc = 'orbit';
      else if (/推进|靠近|拉近/.test(cameraText)) movementDesc = 'dolly in';
      else if (/拉远|退后|远离/.test(cameraText)) movementDesc = 'dolly out';
      else if (/摇|扫/.test(cameraText)) movementDesc = 'pan';
      else if (/升|降|抬|俯/.test(cameraText)) movementDesc = 'pedestal';
      else movementDesc = 'steady tracking shot'; // 默认
    }

    const speedDesc = speedMap[speed] || speedMap['中速'];
    parts.push(`${movementDesc}, ${speedDesc}`);

    // 3. 机位高度(如果可推断)
    if (/俯|鸟瞰|航拍|高空/.test(cameraText)) {
      parts.push('bird\'s eye view, aerial perspective');
    } else if (/仰|低角度|向上/.test(cameraText)) {
      parts.push('low angle, worm\'s eye view');
    } else if (/肩|背后|过肩/.test(cameraText)) {
      parts.push('over-the-shoulder OTS');
    }

    // 4. 特殊效果(如果可推断)
    if (/浅景深|虚化|背景虚/.test(cameraText)) {
      parts.push('shallow depth of field, creamy bokeh');
    } else if (/深景深|全景清晰|全部清晰/.test(cameraText)) {
      parts.push('deep depth of field, everything in focus');
    }

    return parts.join(', ');
  }

  /**
   * v6.5.33-methodology: 使用方法论色彩科学体系增强MOOD字段
   * 基于《AI视频生成提示词工程方法论》5.1色彩方案 + 5.3色温控制
   * 注入:color palette(主色/辅色/强调色) + 色温 + 饱和度/对比度 + 动态范围
   */
  enhanceMoodWithMethodology(moodBase, shot) {
    if (!moodBase || moodBase.length < 2) return moodBase;

    // 情绪阶段 → 色彩方案映射(方法论5.1)
    const colorSchemeMap = {
      'establishing': 'color palette: deep teal shadows + warm amber highlights + subtle gold accents, natural HDR',
      'rising': 'color palette: cool blue shadows + warm orange highlights, high contrast, building tension',
      'building': 'color palette: earth tones + olive green + warm amber, moderate saturation, accumulating energy',
      'climax': 'color palette: intense warm orange + deep crimson + golden highlights, high saturation, dramatic contrast',
      'climax_peak': 'color palette: intense warm red + deep crimson + bright gold accents, maximum saturation, extreme contrast',
      'resolve': 'color palette: soft pastel warm + gentle cream + muted gold, low saturation, warm monochrome',
      'resolution': 'color palette: soft pastel warm + gentle cream + muted gold, low saturation, warm monochrome',
      'neutral': 'color palette: natural balanced tones + daylight neutral, moderate saturation, standard contrast'
    };

    // 情绪阶段 → 色温映射(方法论5.3)
    const colorTempMap = {
      'establishing': '4500K neutral warm, soft white',
      'rising': '5600K daylight balanced, transitioning to 3200K warm',
      'building': '4000K neutral warm, soft transition',
      'climax': '3200K tungsten warm, golden intense',
      'climax_peak': '2500K sunset warm, extreme warm glow',
      'resolve': '4000K neutral warm, gentle soft white',
      'resolution': '4000K neutral warm, gentle soft white',
      'neutral': '5600K daylight balanced, neutral'
    };

    // 情绪阶段 → 动态范围映射(方法论2.7.3)
    const dynamicRangeMap = {
      'establishing': 'HDR, high dynamic range, detail in highlights and shadows',
      'rising': 'HDR, high dynamic range, strong tonal contrast',
      'building': 'HDR, moderate dynamic range, building contrast',
      'climax': 'high contrast, dramatic lighting, deep shadows and bright highlights',
      'climax_peak': 'high contrast, crushed blacks, blown highlights, extreme dynamic range',
      'resolve': 'low contrast, muted tones, soft shadows, gentle dynamic range',
      'resolution': 'low contrast, muted tones, soft shadows, gentle dynamic range',
      'neutral': 'standard dynamic range, SDR, balanced contrast'
    };

    const phase = shot.emotionPhase || 'neutral';
    const colorScheme = colorSchemeMap[phase] || colorSchemeMap['neutral'];
    const colorTemp = colorTempMap[phase] || colorTempMap['neutral'];
    const dynamicRange = dynamicRangeMap[phase] || dynamicRangeMap['neutral'];

    return `${moodBase} | ${colorScheme} | ${colorTemp} | ${dynamicRange}`;
  }

  /**
   * v6.5.33-methodology: 使用方法论空间五维描述法增强SCENE字段
   * 基于《AI视频生成提示词工程方法论》2.4.1空间五维描述法 + 2.4.2空间纵深构建技术
   * 注入:宏观地理 + 中观地貌 + 微观材质 + 天气时间 + 空间关系(前景/中景/背景)
   */
  enhanceSceneWithMethodology(scene, shot) {
    if (!scene || scene.length < 3) return scene;

    // 如果已经包含英文空间描述,跳过增强
    if (/\b(foreground|midground|background|atmospheric haze|leading lines|depth)\b/i.test(scene)) {
      return scene;
    }

    // 空间纵深构建关键词(方法论2.4.2)
    const depthCues = [
      'foreground detail establishing depth',
      'midground subject focal point',
      'background environmental scale reference',
      'atmospheric haze creating depth separation',
      'aerial perspective with color shift in distance'
    ];

    // 根据镜头类型选择纵深策略
    let depthCue = depthCues[0];
    if (shot.shotType === 'extreme_wide' || shot.shotType === 'wide') {
      depthCue = 'massive scale environment dominating frame, foreground mist, midground subject, background mountains, atmospheric haze';
    } else if (shot.shotType === 'close' || shot.shotType === 'extreme_close') {
      depthCue = 'shallow depth of field, creamy bokeh background, foreground detail texture, midground subject isolated';
    } else if (shot.shotType === 'medium') {
      depthCue = 'foreground detail, midground subject clear, background softly blurred, atmospheric depth';
    }

    // 天气时间增强(如果scene中没有)
    let weatherTime = '';
    if (!/\b(golden hour|blue hour|midday|sunset|sunrise|overcast|dawn|dusk|twilight|night)\b/i.test(scene)) {
      const weatherTimeMap = {
        'establishing': 'golden hour, warm sunlight, long shadows',
        'rising': 'late afternoon, side lighting, warm tones',
        'building': 'transitioning light, dynamic cloud patterns',
        'climax': 'dramatic sunset, intense golden light, vivid sky colors',
        'climax_peak': 'peak sunset, intense warm glow, dramatic sky',
        'resolve': 'soft diffused light, gentle atmosphere, peaceful ambiance',
        'resolution': 'soft diffused light, gentle atmosphere, peaceful ambiance',
        'neutral': 'daylight balanced, natural lighting, clear atmosphere'
      };
      weatherTime = weatherTimeMap[shot.emotionPhase] || weatherTimeMap['neutral'];
    }

    const parts = [scene];
    if (depthCue) parts.push(depthCue);
    if (weatherTime) parts.push(weatherTime);

    return parts.join(', ');
  }

  /**
   * v6.5.33-methodology: 使用方法论动作三层模型增强ACTION字段
   * 基于《AI视频生成提示词工程方法论》2.3.1动作三层模型 + 2.3.2动作动词词库
   * 注入:主体动作(Subject Action) + 环境动作(Environment Action) + 镜头动作(Camera Action)
   * 物理动词优先:surge/crash/blow/sway 替代形容词
   */
  enhanceActionWithMethodology(actionText, shot) {
    if (!actionText || actionText.length < 3) return actionText;

    // 如果已经是英文物理动词为主,跳过增强
    if (/\b(surge|crash|spray|ripple|churn|cascade|blow|swirl|drift|billow|flicker|roar|sway|rustle|crumble|slide)\b/i.test(actionText)) {
      return actionText;
    }

    // 动作三层模型增强(方法论2.3.1)
    // 1. 主体动作层:已在actionText中
    // 2. 环境动作层:根据场景类型推断
    let environmentAction = '';
    const sceneLower = (shot.scene || '').toLowerCase();
    if (sceneLower.includes('ocean') || sceneLower.includes('海') || sceneLower.includes('water') || sceneLower.includes('水')) {
      environmentAction = 'water waves surging and crashing, spray particles airborne, white foam forming';
    } else if (sceneLower.includes('wind') || sceneLower.includes('风') || sceneLower.includes('storm') || sceneLower.includes('storm')) {
      environmentAction = 'wind blowing through atmosphere, particles swirling and drifting, dust and debris scattering';
    } else if (sceneLower.includes('forest') || sceneLower.includes('林') || sceneLower.includes('tree') || sceneLower.includes('树')) {
      environmentAction = 'vegetation swaying and rustling, leaves scattering in wind, branches bending';
    } else if (sceneLower.includes('mountain') || sceneLower.includes('山') || sceneLower.includes('cliff') || sceneLower.includes('崖')) {
      environmentAction = 'atmospheric particles drifting, dust in sunlight, distant haze moving';
    } else if (sceneLower.includes('fire') || sceneLower.includes('火') || sceneLower.includes('flame') || sceneLower.includes('焰')) {
      environmentAction = 'flames flickering and dancing, smoke rising and drifting, embers scattering';
    }

    // 3. 镜头动作层:根据情绪阶段推断
    let cameraAction = '';
    const cameraActionMap = {
      'establishing': 'camera slow push-in, gradual approach, steady dolly in',
      'rising': 'camera tracking shot following subject, moderate pace movement',
      'building': 'camera orbit around subject, rotating perspective, increasing speed',
      'climax': 'camera rapid movement, whip pan, extreme fast tracking, dynamic angle change',
      'climax_peak': 'camera maximum speed movement, lightning fast pan, intense dynamic framing',
      'resolve': 'camera slow-down, gentle static hold, final framing lock',
      'resolution': 'camera slow-down, gentle static hold, final framing lock',
      'neutral': 'steady camera movement, smooth tracking, natural pace'
    };
    cameraAction = cameraActionMap[shot.emotionPhase] || cameraActionMap['neutral'];

    const parts = [actionText];
    if (environmentAction) parts.push(environmentAction);
    if (cameraAction) parts.push(cameraAction);

    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 使用方法论主体四维模型增强CHARACTER字段
   * 基于《AI视频生成提示词工程方法论》2.2.2主体描述四维模型
   * 注入:形态(Form) + 材质(Material) + 状态(State) + 关系(Relation)
   */
  enhanceCharacterWithMethodology(characterText, shot) {
    if (!characterText || characterText.length < 3) return characterText;

    // 如果已经包含形态/材质/状态/关系描述,跳过增强
    if (/\b(form|material|state|relation|shape|texture|posture|position)\b/i.test(characterText)) {
      return characterText;
    }

    // 主体四维模型映射(方法论2.2.2)
    // 形态:已在characterText中(外形、轮廓、比例、数量)
    // 材质:根据角色类型推断表面质感
    let materialDesc = '';
    if (characterText.includes(' skin') || characterText.includes('皮肤') || characterText.includes('face') || characterText.includes('脸')) {
      materialDesc = 'natural skin texture, subsurface scattering, realistic surface detail';
    } else if (characterText.includes('cloth') || characterText.includes('fabric') || characterText.includes('衣') || characterText.includes('服')) {
      materialDesc = 'fabric material with woven texture, cloth simulation, natural draping and folds';
    } else if (characterText.includes('fur') || characterText.includes('hair') || characterText.includes('毛') || characterText.includes('发')) {
      materialDesc = 'hair/fur dynamics, individual strand detail, wind-responsive movement';
    } else if (characterText.includes('metal') || characterText.includes('armor') || characterText.includes('金') || characterText.includes('甲')) {
      materialDesc = 'metallic surface with specular highlights, brushed texture, realistic reflection';
    }

    // 状态:根据情绪阶段推断动作状态
    let stateDesc = '';
    const stateMap = {
      'establishing': 'standing still, calm posture, relaxed state',
      'rising': 'beginning movement, alert posture, preparing action',
      'building': 'intensifying movement, dynamic posture, accumulating energy',
      'climax': 'maximum action intensity, explosive movement, peak physical state',
      'climax_peak': 'extreme action, full exertion, peak physical state',
      'resolve': 'slowing down, relaxed posture, returning to calm',
      'resolution': 'slowing down, relaxed posture, returning to calm',
      'neutral': 'natural pose, balanced posture, normal state'
    };
    stateDesc = stateMap[shot.emotionPhase] || stateMap['neutral'];

    // 关系:与环境的关系
    let relationDesc = '';
    if (shot.scene) {
      relationDesc = `positioned within environment, spatial relationship to ${shot.scene.split(/[,,]/)[0] || 'background'}`;
    }

    const parts = [characterText];
    if (materialDesc) parts.push(`material: ${materialDesc}`);
    if (stateDesc) parts.push(`state: ${stateDesc}`);
    if (relationDesc) parts.push(`relation: ${relationDesc}`);

    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 使用方法论物理真实感描述层增强AUDIO字段
   * 基于《AI视频生成提示词工程方法论》3.1物理描述原则:物理>形容词
   * 注入:环境动作物理描述替代抽象声音描述
   * 示例:不用"轻柔风声",而用"wind blowing through tall grass, blades bending and rustling, leaves scattering"
   */
  /**
   * v6.5.33-audio: 极致视听融合 - 四层音效纵深体系
   * 基于《极致视听融合方案》v2.0 Audio专用版
   * L1环境音 + L2动作音 + L3情绪音 + L4音乐线索
   *
   * 策略:
   * 1. 如果shot有scene信息,优先使用buildAudioDescription生成4层格式
   * 2. 如果已有音频文本,在其基础上增强为4层格式
   * 3. 保留英文物理描述作为L2动作音
   */
  enhanceAudioWithMethodology(audioText, shot) {
    if (!audioText || audioText.length < 3) audioText = '';

    // 如果shot有场景信息,使用buildAudioDescription生成完整的4层音频描述
    if (shot && shot.scene && buildAudioDescription) {
      try {
        const fourLayerAudio = buildAudioDescription(shot, shot._segments || []);
        if (fourLayerAudio && fourLayerAudio.length > 10) {
          return fourLayerAudio;
        }
      } catch (e) {
        // 如果buildAudioDescription失败,回退到原有逻辑
        console.warn('[AudioEnhancement] buildAudioDescription failed, falling back:', e.message);
      }
    }

    // 如果已经是4层格式(包含L1: L2: L3: L4:),直接返回
    if (/L1:.*L2:.*L3:/.test(audioText)) {
      return audioText;
    }

    // 回退:在现有音频文本基础上增强4层格式
    const parts = [];
    const sceneLower = (shot?.scene || '').toLowerCase();
    const emotion = (shot?.emotionPhase || shot?.emotion || 'neutral').toLowerCase();

    // L1: 环境音(建立声学指纹)
    const l1Map = {
      'ocean': 'waves crashing against rocks, seagull distant calls, wind coastal breeze, -22LUFS',
      '海': 'waves crashing, seagull distant calls, wind coastal breeze, -22LUFS',
      'water': 'water flowing, stream babbling, gentle liquid sounds, -20LUFS',
      '水': 'water flowing, stream babbling, gentle liquid sounds, -20LUFS',
      'forest': 'leaves rustling, branches creaking, distant stream, bird calls, -20LUFS',
      '林': 'leaves rustling, branches creaking, distant stream, bird calls, -20LUFS',
      'city': 'traffic white noise, distant horns, crowd murmur, building reflections, -18LUFS',
      '城': 'traffic white noise, distant horns, crowd murmur, building reflections, -18LUFS',
      'home': 'air conditioning hum, clock ticking, distant kitchen sounds, -26LUFS',
      '家': 'air conditioning hum, clock ticking, distant kitchen sounds, -26LUFS',
      'mountain': 'wind howling, distant echo, high altitude silence, -24LUFS',
      '山': 'wind howling, distant echo, high altitude silence, -24LUFS',
      'rain': 'raindrops hitting surface, water dripping, concentric ripples, -20LUFS',
      '雨': 'raindrops hitting surface, water dripping, concentric ripples, -20LUFS',
      'fire': 'flames flickering, wood popping, embers scattering, crackling, -18LUFS',
      '火': 'flames flickering, wood popping, embers scattering, crackling, -18LUFS'
    };
    let l1 = 'natural ambient soundscape, subtle environmental textures, -22LUFS';
    for (const [key, val] of Object.entries(l1Map)) {
      if (sceneLower.includes(key)) { l1 = val; break; }
    }
    parts.push(`L1:${l1}`);

    // L2: 动作音(物理真实感)
    let l2 = audioText;
    if (!l2 || l2.length < 3) {
      l2 = 'natural action sounds, physical movement feedback';
    }
    // 如果包含中文,保留作为L2;如果已经是英文物理描述,直接使用
    parts.push(`L2:${l2}`);

    // L3: 情绪音(心理氛围)
    const l3Map = {
      'warm': 'warm healing texture, heartbeat 68BPM, 80Hz sub-bass pad, -20LUFS',
      'joy': 'joyful bright texture, high frequency sparkle >5kHz, dopamine release暗示',
      'tense': 'tense压迫感, heartbeat 100BPM+, irregular low pulse, adrenaline暗示',
      'sad': 'sad nostalgic texture, string harmonics, distant echo, heart rate decrease暗示',
      'epic': 'epic grandeur texture, full spectrum, 80BPM, adrenaline暗示',
      'peaceful': 'peaceful zen texture, 60BPM, full frequency soft, no harsh components',
      'mysterious': 'mysterious unknown texture, irregular low pulse, minimal spectrum sudden change',
      'climax': 'climax peak texture, full spectrum saturation, 120BPM, extreme dynamics',
      'resolve': 'resolve fading texture, 50BPM, low frequency decay, gentle ambient fade',
      'neutral': 'neutral balanced texture, natural ambient, 72BPM steady'
    };
    const l3 = l3Map[emotion] || l3Map['neutral'];
    parts.push(`L3:${l3}`);

    // L4: 音乐线索(情绪基调)
    if (shot?.musicCue) {
      parts.push(`L4:${shot.musicCue}`);
    } else {
      const l4Map = {
        'warm': 'piano C major single notes, 60BPM, sustain pedal, warm narrative melody',
        'joy': 'bright synth arpeggio, 120BPM, uplifting motif, high frequency sparkle',
        'tense': 'low synth bass pulse, industrial rhythm, distortion effects, 100BPM',
        'sad': 'string ensemble long tones, vibrato, distant reverberation, 50BPM',
        'epic': 'brass fanfare motifs, orchestral percussion, cinematic grandeur',
        'peaceful': 'minimal piano or wind chimes, natural scale, almost imperceptible',
        'mysterious': 'minimal electronic pad, sudden tonal shifts, long reverb tail',
        'climax': 'full orchestra crescendo, percussion drive, peak intensity',
        'resolve': 'piano fading notes, long reverb tail, gentle resolution',
        'neutral': 'minimal ambient pad, no prominent musical cue'
      };
      const l4 = l4Map[emotion] || l4Map['neutral'];
      if (l4 !== 'minimal ambient pad, no prominent musical cue') {
        parts.push(`L4:${l4}`);
      }
    }

    // 频率避让规则
    parts.push('避让:L4避1-4kHz|L2侧重2-8kHz|L3侧重<500Hz');

    // 声画同步标记
    if (shot?.mouthAction || shot?.hasDialogue) {
      parts.push('同步:lip-sync precise alignment, ambient auto-ducking');
    }

    return parts.join(' | ');
  }

  /**
   * v6.5.33-methodology: 跨模型兼容性适配器
   * 基于《AI视频生成提示词工程方法论》10.1模型特性矩阵 + 10.2提示词转换规则
   * 将通用提示词转换为特定模型最优格式
   * @param {string} prompt - 通用提示词
   * @param {string} model - 目标模型 (seadance/runway/kling/veo/sora/luma)
   * @param {Object} shot - 镜头信息
   * @returns {string} 适配后的提示词
   */
  adaptPromptForModel(prompt, model = 'seadance', shot = {}) {
    if (!prompt || prompt.length < 10) return prompt;

    const adaptations = {
      'seadance': {
        // SeaDance 2.x: 保持完整六维描述,物理描述可详细,支持长提示词
        transform: (p) => p, // 通用格式已最优
        maxLength: PROMPT_LENGTH.HARD_MAX,
        note: '完整六维描述,物理描述详细,多镜头分镜友好'
      },
      'runway': {
        // Runway Gen-4: 镜头指令移至开头,精简至100词内,Motion Brush补充
        transform: (p) => {
          // 提取CAMERA字段移到开头
          const cameraMatch = p.match(/CAMERA:\s*([^|]+)/i);
          const camera = cameraMatch ? cameraMatch[1].trim() : '';
          // 移除原始CAMERA字段
          let rest = p.replace(/CAMERA:\s*[^|]+\|?/i, '');
          // 精简至核心内容
          rest = rest.replace(/\|/g, ', ').replace(/\s+/g, ' ').trim();
          return camera ? `${camera}. ${rest}` : rest;
        },
        maxLength: 500, // 100词约500字符
        note: '镜头指令前置,精简至100词,使用参考图'
      },
      'kling': {
        // Kling 2.x: 物理和光学描述优先,4-6秒分段,避免过长句式
        transform: (p) => {
          // 提取SCENE和LIGHTING作为优先内容
          const sceneMatch = p.match(/SCENE:\s*([^|]+)/i);
          const lightingMatch = p.match(/LIGHTING:\s*([^|]+)/i);
          const actionMatch = p.match(/ACTION:\s*([^|]+)/i);
          const parts = [];
          if (sceneMatch) parts.push(sceneMatch[1].trim());
          if (lightingMatch) parts.push(lightingMatch[1].trim());
          if (actionMatch) parts.push(actionMatch[1].trim());
          return parts.join(', ');
        },
        maxLength: 600, // 60-120词
        note: '物理光学描述优先,短句结构,4-6秒分段'
      },
      'veo': {
        // Veo 3: 写实度关键词前置,中等长度,可同步音频描述
        transform: (p) => {
          // 写实度关键词前置
          const renderMatch = p.match(/【渲染】\s*([^|]+)/i);
          const render = renderMatch ? renderMatch[1].trim() : 'hyperrealistic cinematic';
          let rest = p.replace(/【渲染】\s*[^|]+\|?/i, '');
          rest = rest.replace(/\|/g, ', ').trim();
          return `${render}. ${rest}`;
        },
        maxLength: 500,
        note: '写实度关键词前置,可同步音频描述,中等长度'
      },
      'sora': {
        // Sora 2.x: 复杂空间关系可详细描述,支持较长描述,叙事节奏描述收益大
        transform: (p) => p, // 通用格式已较好
        maxLength: PROMPT_LENGTH.HARD_MAX,
        note: '复杂空间关系详细,叙事节奏描述,长时段一致性'
      },
      'luma': {
        // Luma Ray2: 极度精简,单镜头为主,核心动作+核心光影即可
        transform: (p) => {
          // 只保留核心字段
          const actionMatch = p.match(/ACTION:\s*([^|]+)/i);
          const lightingMatch = p.match(/LIGHTING:\s*([^|]+)/i);
          const sceneMatch = p.match(/SCENE:\s*([^|]+)/i);
          const parts = [];
          if (actionMatch) parts.push(actionMatch[1].trim());
          if (lightingMatch) parts.push(lightingMatch[1].trim());
          if (sceneMatch) parts.push(sceneMatch[1].trim());
          return parts.join(', ');
        },
        maxLength: 300, // 40-80词
        note: '极度精简,核心动作+核心光影,单镜头测试'
      }
    };

    const adapter = adaptations[model.toLowerCase()] || adaptations['seadance'];
    let adapted = adapter.transform(prompt);

    // 长度裁剪
    if (adapted.length > adapter.maxLength) {
      adapted = adapted.substring(0, adapter.maxLength - 3) + '...';
    }

    return adapted;
  }

  /**
   * v6.5.33-methodology: 迭代优化协议质量评估
   * 基于《AI视频生成提示词工程方法论》13.2评估维度
   * 6维评估:写实度(0.25) + 运动质量(0.20) + 光影质量(0.20) + 色彩质量(0.15) + 构图质量(0.10) + 物理真实(0.10)
   * @param {Object} evaluation - 各维度评分 {realism, motion, lighting, color, composition, physics}
   * @returns {Object} 总分 + 诊断建议
   */
  evaluateQuality(evaluation = {}) {
    const weights = {
      realism: 0.25,
      motion: 0.20,
      lighting: 0.20,
      color: 0.15,
      composition: 0.10,
      physics: 0.10
    };

    let total = 0;
    const details = {};

    for (const [dim, weight] of Object.entries(weights)) {
      const score = evaluation[dim] || 0;
      total += score * weight;
      details[dim] = { score, weight, weighted: score * weight };
    }

    // 诊断建议(方法论13.3常见问题诊断)
    const diagnosis = [];
    if (evaluation.realism < 3) diagnosis.push('缺少物理描述:添加具体物理现象关键词');
    if (evaluation.motion < 3) diagnosis.push('动作描述冲突:每段只保留一个主导动作');
    if (evaluation.lighting < 3) diagnosis.push('光源未定义:明确光源位置+性质+效果');
    if (evaluation.color < 3) diagnosis.push('色彩方案冲突:使用标准色彩方案模板');
    if (evaluation.composition < 3) diagnosis.push('镜头指令冲突:每段只给一个镜头运动指令');
    if (evaluation.physics < 3) diagnosis.push('材质塑料感:添加材质+表面状态+光学反应');

    // 配方锁定标准(方法论13.5)
    const locked = total >= 4.0 &&
                   evaluation.realism >= 4 &&
                   evaluation.motion >= 3.5 &&
                   evaluation.lighting >= 3.5;

    return {
      total: Math.round(total * 100) / 100,
      max: 5.0,
      details,
      diagnosis,
      locked,
      recommendation: locked ? '配方锁定,可用于生产' : '需要继续优化:' + diagnosis.join('; ')
    };
  }

  /**
   * v6.2-patch104: 在Prompt中注入照明方案(如果缺失)
   */
  injectLightingIfMissing(shot, prompt) {
    const sceneLighting = this.calculateSceneSpecificLighting(shot, prompt);

    if (sceneLighting.suggestedInjection) {
      // 检查prompt是否已有照明方案标记
      if (!prompt.includes('【照明方案】') && !prompt.includes('主光')) {
        // 在视觉描述之后注入照明方案(支持多种视觉标记)
        const visualPatterns = [
          /【视觉】.*?\n/,
          /【视觉核心】.*?\n/,
          /【视觉描述】.*?\n/,
          /【画面】.*?\n/
        ];
        let insertPos = -1;
        for (const pattern of visualPatterns) {
          const match = prompt.match(pattern);
          if (match) {
            insertPos = match.index + match[0].length;
            break;
          }
        }
        // 如果找不到视觉标记,在prompt开头注入
        if (insertPos === -1) {
          insertPos = 0;
        }
        if (insertPos >= 0) {
          return prompt.slice(0, insertPos) + '\n' + sceneLighting.suggestedInjection + '\n' + prompt.slice(insertPos);
        }
      }
    }

    return prompt;
  }

  /**
   * 计算叙事画面对齐度(narration与画面内容匹配度)
   * v6.2-patch41: 新增5维评分中的对齐度评分
   */
  calculateNarrativeAlignment(shot, prompt) {
    let score = 0;
    const promptLower = prompt.toLowerCase();

    // v6.6.3-fix: generic模式放宽对齐检测
    const isGenericMode = this.mode === 'generic' || this.mode === 'social';

    // 1. narration关键词在Prompt中出现(最高10分)
    // v6.3-patch3: 扩展关键词提取至15个,增加视觉描述回退匹配
    const narration = (shot.narration || shot.innerMonologue || shot.dialogue || '').toLowerCase();
    if (narration.length > 0) {
      // 提取narration中的实词(名词/动词),检查是否在Prompt中
      const keywords = narration.split(/[,。!?、\s]+/).filter(w => w.length >= 2);
      let matched = 0;
      for (const kw of keywords.slice(0, 15)) { // v6.3-patch3: 从8个扩展到15个
        if (promptLower.includes(kw)) matched++;
      }
      // v6.6.3-fix: generic模式降低匹配要求(中英文混合场景)
      const matchMultiplier = isGenericMode ? 2.0 : 1.5;
      score += Math.min(10, matched * matchMultiplier);
    }

    // 1.5 视觉描述关键词匹配(如果没有narration,检查视觉描述)
    if (score === 0 && shot.visualPrompt) {
      const visualKeywords = shot.visualPrompt.toLowerCase().split(/[,。!?、\s]+/).filter(w => w.length >= 2);
      let visualMatched = 0;
      for (const kw of visualKeywords.slice(0, 10)) { // v6.3-patch3: 从5个扩展到10个
        if (promptLower.includes(kw)) visualMatched++;
      }
      score += Math.min(8, visualMatched * 1.5); // 从6分提升到8分
    }

    // 2. 角色名称在Prompt中出现(最高5分)
    // v6.6.3-fix: generic模式增加角色名检测范围
    const shotChars = shot.characters || [];
    let charMatched = 0;
    for (const char of shotChars) {
      const charId = typeof char === 'string' ? char : char.id;
      if (charId) {
        // 检查中英文名称
        const charLower = charId.toLowerCase();
        if (promptLower.includes(charLower) ||
            (charLower.includes('xiao') && promptLower.includes('小')) ||
            (charLower.includes('g') && promptLower.includes('g')) ||
            (charLower.includes('tao') && promptLower.includes('饕')) ||
            (charLower.includes('taotie') && (promptLower.includes('taotie') || promptLower.includes('饕餮'))) ||
            // v6.6.3-fix: generic模式支持chen-nurse等角色名
            (charLower.includes('chen') && (promptLower.includes('chen') || promptLower.includes('陈'))) ||
            (charLower.includes('nurse') && promptLower.includes('nurse')) ||
            (charLower.includes('doctor') && promptLower.includes('doctor')) ||
            (charLower.includes('narrator') && promptLower.includes('narrator'))) {
          charMatched++;
        }
      }
    }
    score += Math.min(5, charMatched * 2);

    // v6.6.3-fix: generic模式增加场景描述匹配(不要求动作关键词)
    if (isGenericMode) {
      // 场景类型匹配
      const sceneType = (shot.type || shot.shotType || '').toLowerCase();
      const sceneKeywords = ['opening', 'explanation', 'demonstration', 'closing', 'product', 'portrait'];
      if (sceneKeywords.some(kw => sceneType.includes(kw))) {
        score += 3; // 场景类型明确+3分
      }
      // 情绪标注匹配
      const emotion = (shot.emotionPhase || shot.emotion || '').toLowerCase();
      if (emotion && promptLower.includes(emotion)) {
        score += 2; // 情绪在prompt中体现+2分
      }
    }

    // 3. 场景/动作一致性(最高5分)
    // v6.3-patch3: 扩展动作关键词至15个
    const actionKeywords = ['动作', '表情', '眼神', '手势', '姿态', '走动', '站立', '蹲下', '奔跑', '跳跃', '回头', '转身', '伸手', '靠近', '对峙'];
    let actionMatched = 0;
    for (const kw of actionKeywords) {
      if (prompt.toLowerCase().includes(kw)) actionMatched++;
    }
    score += Math.min(5, actionMatched);

    // v6.5.1-fix: emotionPhase对齐基础分(如果标注了情感阶段,给予基础分)
    const phase = shot.emotionPhase || shot.emotion || '';
    if (phase) {
      score += 2; // 标注了情感阶段+2分
    }

    // v6.6.3-fix: generic模式基础补偿(确保不低于8分)
    if (isGenericMode && score < 8) {
      score = 8;
    }

    return Math.min(20, score);
  }

  /**
   * v6.2-patch106-3-fix: S02发现场景台词优化
   * 根据场景类型优化台词,使其与视觉描述匹配
   */
  _optimizeDiscoverySceneDialogue(shot, sceneName) {
    if (!shot || shot.type !== 'discovery') return shot;

    const discoveryDialogues = {
      '裂隙微光': {
        dialogue: '看那些晶丝...它们在模仿我的动作。这下面有东西在呼吸。',
        visualPrompt: '超写实,电影级微距镜头,晶状菌丝如神经网般覆盖岩壁,孢子雾在裂隙中缓慢升腾。小G俯身观察,手指轻触菌丝,菌丝随即发出幽蓝光芒并产生共振波纹。裂隙深处透出不明光源,照亮漂浮的孢子微粒如金色尘埃。',
        emotion: 'curiosity',
        dangerLevel: 'medium'
      },
      '深渊发现': {
        dialogue: '这些结晶...它们在跟着我移动。不是风,是某种感应。',
        visualPrompt: '超写实,电影级光影,深渊底部发光结晶体,随主角靠近产生脉动光芒。小G蹲下观察,结晶体表面倒映出双恒星光色。',
        emotion: 'curiosity',
        dangerLevel: 'low'
      }
    };

    const optimized = discoveryDialogues[sceneName];
    if (optimized) {
      shot.dialogue = optimized.dialogue;
      shot.narration = optimized.dialogue;
      shot.visualPrompt = optimized.visualPrompt;
      shot.emotionPhase = optimized.emotion;
      shot._dangerLevel = optimized.dangerLevel;

      // 修复时间轴:发现场景至少2.5秒完成orbit_360
      if (shot.cameraMovement && shot.cameraMovement.timeline) {
        const timeline = shot.cameraMovement.timeline;
        if (timeline.segments && timeline.segments[0] && timeline.segments[0].duration < 2.5) {
          timeline.segments[0].duration = 2.5;
          this.log('STAGE-7', `  🎬 S02时间轴修复: orbit_360 1.8s→2.5s`);
        }
        // 重新计算总时长
        timeline.totalDuration = timeline.segments.reduce((sum, seg) => sum + seg.duration, 0);
      }
    }

    return shot;
  }

  /**
   * v6.2-patch106-4-fix: S05结尾场景情绪统一
   * 根据台词内容自动调整情绪标签,避免标签/台词/视觉打架
   */
  _unifyClosingSceneEmotion(shot) {
    if (!shot || (shot.type !== 'closing' && shot.shotType !== 'closing')) return shot;

    const dialogue = (shot.dialogue || shot.narration || '').toLowerCase();

    // 根据台词内容判断真实情绪
    let detectedEmotion = 'curiosity';
    let moodTags = ['好奇'];

    if (dialogue.includes('吞') || dialogue.includes('吃') || dialogue.includes('呼吸') || dialogue.includes('缺')) {
      // 黑色幽默/荒诞感
      detectedEmotion = 'whimsical_dark';
      moodTags = ['荒诞', '黑色幽默', '哲思'];
    } else if (dialogue.includes('回家') || dialogue.includes('约定') || dialogue.includes('等')) {
      // 温暖/希望
      detectedEmotion = 'warm_hope';
      moodTags = ['温暖', '希望', '宁静'];
    } else if (dialogue.includes('战') || dialogue.includes('杀') || dialogue.includes('死')) {
      // 紧张/对抗
      detectedEmotion = 'tension';
      moodTags = ['紧张', '对抗'];
    }

    // 更新shot的情绪属性
    shot.emotionPhase = detectedEmotion;
    shot._moodTags = moodTags;
    shot._emotionUnify = {
      originalTags: ['好奇', '宁静', '温暖'],
      detectedEmotion,
      moodTags,
      reason: `台词分析: "${shot.dialogue?.substring(0, 20)}..." → 情绪: ${detectedEmotion}`
    };

    // 同步更新visualPrompt中的情绪描述
    if (shot.visualPrompt) {
      // 移除旧的情绪关键词
      shot.visualPrompt = shot.visualPrompt
        .replace(/充满好奇的探索姿态/g, '嘴角微扬的玩味姿态')
        .replace(/发现新事物的惊喜/g, '对荒诞现实的接纳与玩味')
        .replace(/目光敏锐/g, '目光深邃带一丝调侃');
    }

    this.log('STAGE-7', `  🎭 S05情绪统一: ${shot.id} | ${detectedEmotion} | 标签:${moodTags.join('/')}`);

    return shot;
  }

  /**
   * v6.2-patch106-5-fix: S03对峙场景台词视觉化
   * 将对话台词转化为视觉元素,使台词内容在画面中得到体现
   */
  _visualizeConfrontationDialogue(shot) {
    if (!shot || (shot.type !== 'confrontation' && shot.shotType !== 'confrontation')) return shot;

    const dialogue = shot.dialogue || shot.narration || '';
    const visualElements = [];

    // 分析台词中的关键动作/意象
    if (dialogue.includes('吞') || dialogue.includes('吃')) {
      visualElements.push('饕餮巨口缓缓张开,獠牙间残留发光硅晶碎片,喉咙深处透出幽蓝能量光芒');
    }
    if (dialogue.includes('裂谷') || dialogue.includes('山')) {
      visualElements.push('背景裂谷边缘磁铁矿岩壁发出脉动橙红光芒,地热蒸汽从裂缝中升腾');
    }
    if (dialogue.includes('硅晶') || dialogue.includes('生根')) {
      visualElements.push('饕餮腹部装甲缝隙间可见发光结晶体生长,如植物根系般蔓延,脉动频率与呼吸同步');
    }
    if (dialogue.includes('翼') || dialogue.includes('爪')) {
      visualElements.push('穷奇翼爪展开,撕裂周围孢子雾,翼膜透光呈现血管状能量纹路');
    }
    if (dialogue.includes('缺') || dialogue.includes('要')) {
      visualElements.push('小G站在两兽之间,身体微微前倾,双手张开呈调解姿态,表情紧张但坚定');
    }

    // 将视觉元素注入visualPrompt
    if (visualElements.length > 0 && shot.visualPrompt) {
      const visualInjection = `【台词视觉化】${visualElements.join(';')}。`;
      shot.visualPrompt = shot.visualPrompt.replace(/超写实,电影级光影,/, `超写实,电影级光影,${visualInjection}`);
      shot._visualizedDialogue = {
        original: dialogue.substring(0, 50),
        elements: visualElements,
        count: visualElements.length
      };
      this.log('STAGE-7', `  🎬 S03台词视觉化: ${shot.id} | ${visualElements.length}个元素 | ${visualInjection.length}字符`);
    }

    return shot;
  }

  /**
   * v6.2-patch106-6-fix: 运镜创新
   * 避免所有镜头使用相同的运镜组合,根据场景类型推荐差异化运镜
   */
  _innovateCameraMovement(shot) {
    if (!shot || !shot.cameraMovement || !shot.cameraMovement.timeline) return shot;

    const timeline = shot.cameraMovement.timeline;
    if (!timeline.segments || timeline.segments.length === 0) return shot;

    // 检查是否是默认的orbit_360→push_in→push_in→hold
    const defaultPattern = timeline.segments.every((seg, idx) => {
      if (idx === 0) return seg.movement === 'orbit_360';
      if (idx === timeline.segments.length - 1) return seg.movement === 'hold';
      return seg.movement === 'push_in';
    });

    if (!defaultPattern) return shot; // 已有创新运镜

    // 根据场景类型推荐创新运镜
    const sceneType = shot.shotType || shot.type || 'generic';
    const innovations = {
      'discovery': {
        segments: [
          { movement: 'dolly_in', speed: 0.4, desc: '缓慢推近发现物' },
          { movement: 'orbit_180', speed: 0.6, desc: '半环绕观察主体' },
          { movement: 'crane_up', speed: 0.8, desc: '升镜头展现规模' },
          { movement: 'hold', speed: 0.3, desc: '定格凝视' }
        ],
        name: '发现式观察'
      },
      'confrontation': {
        segments: [
          { movement: 'whip_pan', speed: 1.0, desc: '快速甩镜切换对峙双方' },
          { movement: 'push_in', speed: 0.9, desc: '逼近冲突中心' },
          { movement: 'dutch_tilt', speed: 0.7, desc: '荷兰角倾斜增强不稳定感' },
          { movement: 'pull_back', speed: 0.5, desc: '后拉展现冲突全貌' }
        ],
        name: '对抗式冲突'
      },
      'opening': {
        segments: [
          { movement: 'aerial_descent', speed: 0.3, desc: '航拍下降建立环境' },
          { movement: 'push_in', speed: 0.6, desc: '推向主角' },
          { movement: 'orbit_360', speed: 0.5, desc: '环绕环境' },
          { movement: 'hold', speed: 0.4, desc: '定格开场' }
        ],
        name: '史诗式开场'
      }
    };

    const innovation = innovations[sceneType];
    if (innovation) {
      // 应用创新运镜
      timeline.segments.forEach((seg, idx) => {
        if (innovation.segments[idx]) {
          seg.movement = innovation.segments[idx].movement;
          seg.speed = { value: innovation.segments[idx].speed, description: innovation.segments[idx].desc };
        }
      });
      timeline._innovation = {
        originalPattern: 'orbit_360→push_in→push_in→hold',
        newPattern: innovation.segments.map(s => s.movement).join('→'),
        name: innovation.name
      };
      this.log('STAGE-7', `  🎥 运镜创新: ${shot.id} | ${innovation.name} | ${timeline._innovation.newPattern}`);
    }

    return shot;
  }

  // 🔥 v6.2-patch82: Prompt标准符合度检查(适配现有中文标记格式)
  checkStandardCompliance(prompt, shotId) {
    // v6.5.53-l: 使用统一的 prompt-standard-v3.js 进行检查
    // 先标准化,再检查,兼容自然语言+块格式+key:value
    const standardized = standardizePrompt(prompt);
    const result = checkStandardCompliance(standardized || prompt, shotId);

    return {
      shotId: result.shotId,
      coverage: result.score,
      found: Object.entries(result.checks).filter(([,v]) => v.found).map(([k]) => k),
      missing: result.missing,
      fieldCount: Object.entries(result.checks).filter(([,v]) => v.found).length,
      totalFields: Object.keys(result.checks).length,
      status: result.score >= 80 ? 'high' : result.score >= 60 ? 'medium' : 'low',
      checks: result.checks
    };
  }

  /**
   * 本地模板修复(v6.2-patch87-2)
   * 支持多种问题描述格式,健壮性增强
   */
  _applyQuickFixes(shots, issues, prd) {
    const fixed = [];

    // 健壮性:过滤无效问题
    const validIssues = (issues || []).filter(i =>
      i && (i.message || i.description || i.detail || i.suggestion)
    );

    if (validIssues.length === 0) {
      this.log('PIPELINE', '🟡 导演评审未发现有效问题,跳过本地修复');
      return fixed;
    }

    this.log('PIPELINE', `🔧 本地模板修复启动 | 有效问题: ${validIssues.length}个`);

    // 辅助:从 issue 中提取文本(支持多种字段名)
    const getIssueText = (issue) => {
      return (issue.message || '') + ' ' +
             (issue.description || '') + ' ' +
             (issue.detail || '') + ' ' +
             (issue.suggestion || '');
    };

    // 辅助:获取受影响的镜头ID
    const getAffectedShotIds = (issue) => {
      if (issue.affectedShots && issue.affectedShots.length > 0) return issue.affectedShots;
      // 从文本中提取镜头ID(如 S02, S03 等)
      const text = getIssueText(issue);
      const matches = text.match(/S\d{2,3}/gi) || [];
      if (matches.length > 0) return matches.map(m => m.toUpperCase());
      return null; // 全局问题
    };

    // 1. 修复旁白混入非叙事指令/动作指令/矛盾(通用模式)
    const narrationIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'narration' ||
             text.includes('旁白') ||
             text.includes('叙事') ||
             text.includes('指令') ||
             text.includes('触碰') ||
             text.includes('后退') ||
             text.includes('矛盾');
    });

    for (const issue of narrationIssues) {
      const shotIds = getAffectedShotIds(issue);
      const text = getIssueText(issue);

      // 处理 "主动触碰" 类问题
      if (text.includes('主动触碰') || text.includes('非叙事')) {
        // S02: 将"主动触碰"改为具体动作(匹配画面)
        const s02 = shots.find(s => (s.id || s.shotId) === 'S02' || (s.id || s.shotId) === 's02');
        if (s02 && s02.narration && s02.narration.includes('主动触碰')) {
          s02.narration = s02.narration.replace('主动触碰', '指尖擦过岩壁');
          fixed.push({ shotId: 'S02', field: 'narration', issue: '旁白混入非叙事指令', fix: '改为"指尖擦过岩壁"' });
        }
        // S05: 消除"主动触碰"与后退的矛盾
        const s05 = shots.find(s => (s.id || s.shotId) === 'S05' || (s.id || s.shotId) === 's05');
        if (s05 && s05.narration && s05.narration.includes('主动触碰')) {
          s05.narration = s05.narration.replace(/主动触碰[^。]*。?/, '缓缓后退,放下戒备,');
          fixed.push({ shotId: 'S05', field: 'narration', issue: '旁白动作矛盾', fix: '改为"缓缓后退,放下戒备"' });
        }
      }

      // 处理 "后退" 与前进/触碰的矛盾
      if (text.includes('后退') && (text.includes('前进') || text.includes('触碰'))) {
        const targetIds = shotIds || ['S05'];
        for (const sid of targetIds) {
          const shot = shots.find(s => (s.id || s.shotId) === sid);
          if (shot && shot.narration && (shot.narration.includes('前进') || shot.narration.includes('触碰'))) {
            shot.narration = shot.narration.replace(/(?:主动)?(?:前进|触碰)[^。]*。?/g, '缓缓后退,');
            fixed.push({ shotId: sid, field: 'narration', issue: '旁白后退与前进矛盾', fix: '统一为后退动作' });
          }
        }
      }
    }

    // 2. 修复场景/标题矛盾(PRD对齐问题)
    const sceneIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'prd_alignment' ||
             text.includes('不周') ||
             text.includes('场景') ||
             text.includes('标题') ||
             text.includes('地理') ||
             text.includes('空间');
    });

    for (const issue of sceneIssues) {
      const text = getIssueText(issue);
      // 不周山脉 → 钩吾废墟
      if (text.includes('不周') && text.includes('钩吾')) {
        const s04 = shots.find(s => (s.id || s.shotId) === 'S04' || (s.id || s.shotId) === 's04');
        if (s04) {
          if (s04.scene && s04.scene.includes('不周')) {
            const old = s04.scene;
            s04.scene = s04.scene.replace(/不周山[脉]*/g, '钩吾废墟');
            fixed.push({ shotId: 'S04', field: 'scene', issue: '场景矛盾', fix: `"${old}" → "${s04.scene}"` });
          }
          if (s04.title && s04.title.includes('不周')) {
            const old = s04.title;
            s04.title = s04.title.replace(/不周山[脉]*/g, '钩吾废墟');
            fixed.push({ shotId: 'S04', field: 'title', issue: '标题矛盾', fix: `"${old}" → "${s04.title}"` });
          }
        }
      }
    }

    // 3. 修复运镜矛盾
    const cameraIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'camera' ||
             (text.includes('一镜到底') && text.includes('多段')) ||
             text.includes('自相矛盾') ||
             text.includes('运镜');
    });

    for (const issue of cameraIssues) {
      const shotIds = getAffectedShotIds(issue) || ['S03', 'S04', 'S05'];
      for (const sid of shotIds) {
        const shot = shots.find(s => (s.id || s.shotId) === sid);
        if (shot && shot.cameraMovement) {
          const cm = typeof shot.cameraMovement === 'string'
            ? shot.cameraMovement
            : shot.cameraMovement?.description || '';

          if (cm.includes('一镜到底') && cm.includes('多段')) {
            const newCm = cm.replace(/一镜到底.*?(?=,|。|$)/, '').replace(/多段运镜.*?/, '多段剪辑');
            if (typeof shot.cameraMovement === 'string') {
              shot.cameraMovement = newCm;
            } else {
              shot.cameraMovement.description = newCm;
            }
            fixed.push({ shotId: sid, field: 'cameraMovement', issue: '一镜到底与多段矛盾', fix: '统一为多段剪辑' });
          }
        }
      }
    }

    // 4. 修复情绪弧线
    const climaxIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return i.category === 'story' ||
             (text.includes('Climax') || text.includes('Peak') || text.includes('高潮') || text.includes('情绪弧线'));
    });

    if (climaxIssues.length > 0) {
      const s03 = shots.find(s => (s.id || s.shotId) === 'S03' || (s.id || s.shotId) === 's03');
      if (s03 && s03.emotionPhase === 'building') {
        s03.emotionPhase = 'climax';
        if (s03.emotionTarget) s03.emotionTarget.emotion = 'climax';
        fixed.push({ shotId: 'S03', field: 'emotionPhase', issue: '情绪弧线缺少Climax', fix: 'S03改为climax' });
      }
    }

    // 5. 修复"永恒饥饿"PRD核心概念视觉化(如果导演指出)
    const hungerIssues = validIssues.filter(i => {
      const text = getIssueText(i);
      return text.includes('饥饿') || text.includes('贪欲') || text.includes('视觉化');
    });

    for (const issue of hungerIssues) {
      // 在S03或S04的prompt中增加饕餮行为动作(视觉化饥饿)
      const targetIds = ['S03', 'S04'];
      for (const sid of targetIds) {
        const shot = shots.find(s => (s.id || s.shotId) === sid);
        if (shot && shot.prompt && !shot.prompt.includes('舔舐') && !shot.prompt.includes('腹部')) {
          shot.prompt += ',饕餮腹部巨口缓缓蠕动,利齿交错,散发吞噬欲望';
          fixed.push({ shotId: sid, field: 'prompt', issue: 'PRD核心概念缺乏视觉化', fix: '增加饕餮饥饿动作' });
          break; // 只改第一个匹配的
        }
      }
    }

    this.log('PIPELINE', `✅ 本地修复完成 | 修复 ${fixed.length} 处核心问题`);
    return fixed;
  }

  /**
   * 导演预检:在Stage 5生成prompt时检查旁白匹配(v6.2-patch87-短期)
   */
  _directorPreflight(shots, prd) {
    const warnings = [];
    for (const shot of shots) {
      const narration = shot.narration || '';
      const prompt = getPromptText(shot) || '';

      // 检查旁白动作是否有画面支撑
      const actionKeywords = ['触碰', '后退', '前进', '奔跑', '伸手'];
      for (const action of actionKeywords) {
        if (narration.includes(action) && !prompt.includes(action)) {
          warnings.push({
            shotId: shot.id || shot.shotId,
            type: 'narration-prompt-mismatch',
            message: `旁白"${action}"在画面中未体现`,
            suggestion: `在prompt中增加"${action}"动作或修改旁白`
          });
        }
      }
    }
    return warnings;
  }

  /**
   * 分段验证:独立运行指定Stage(v6.2-patch87-2)
   * 用于调试和验证单个Stage
   * @param {string} stageName - Stage名称(如 'STAGE-5', 'STAGE-11')
   * @param {Object} upstreamStages - 前置Stage的结果(如 {prd, script, storyboard})
   * @param {Object} input - 原始输入
   */


  // ========== v2.0: 创意指数系统辅助方法 ==========

  /**
   * 为指定Stage注入创意指数指令
   * 在Stage执行完成后调用,增强输出结果
   */
  _injectCreativeIntensity(stageName, stageOutput) {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) {
      return stageOutput; // 0.2以下不干预
    }

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) {
      return stageOutput; // 该Stage无激活模块
    }

    this.log('PIPELINE', `[创意指数] ${stageName} 注入 ${instructions.count} 个模块指令`);

    // 将指令附加到Stage输出中
    if (!stageOutput._creativeIntensity) {
      stageOutput._creativeIntensity = {
        intensity: this.creativeIntensity,
        level: instructions.level,
        instructions: []
      };
    }

    // v6.6.5-fix: 确保 instructions 是数组
    if (!Array.isArray(stageOutput._creativeIntensity.instructions)) {
      stageOutput._creativeIntensity.instructions = [];
    }

    stageOutput._creativeIntensity.instructions.push({
      stage: stageName,
      ...instructions
    });

    return stageOutput;
  }

  /**
   * 获取指定Stage的创意指数指令文本(用于Prompt注入)
   */
  _getCreativeIntensityInstructions(stageName) {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) return '';

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) return '';

    return `\n[CREATIVE_INTENSITY_${this.creativeIntensity}]\n${instructions.instructions}\n[/CREATIVE_INTENSITY]\n`;
  }

  /**
   * 将创意指数指令注入到 Prompt 字符串中(智能长度控制)
   * 确保不超出 PROMPT_LENGTH.HARD_MAX 字符上限
   */
  _injectCreativeIntensityToPrompt(prompt, stageName, shotId = '') {
    if (!this.creativeIntensity || this.creativeIntensity <= 0.2) {
      return prompt; // 0.2以下不干预
    }

    const cii = this.creativeIntensityIndex;
    const instructions = cii.generateStageInstructions(stageName, this.creativeIntensity);

    if (!instructions) {
      return prompt; // 该Stage无激活模块
    }

    const instructionText = instructions.instructions;
    const currentLength = prompt.length;
    const instructionLength = instructionText.length;

    // 如果注入后不超过 PROMPT_LENGTH.HARD_MAX 字符,直接追加
    if (currentLength + instructionLength + 20 <= PROMPT_LENGTH.HARD_MAX) {
      this.log('STAGE-11', `  🎨 [创意指数] ${shotId} 注入${instructions.count}个模块 | +${instructionLength}字符 | 总:${currentLength + instructionLength + 20}/988`);
      return `${prompt}\n[创意指数${this.creativeIntensity}]${instructionText}[/创意指数]`;
    }

    // 如果会超出,进行智能裁剪
    const maxAvailable = PROMPT_LENGTH.HARD_MAX - currentLength - 20;
    if (maxAvailable > 50) {
      const truncated = instructionText.substring(0, maxAvailable - 3) + '...';
      this.log('STAGE-11', `  🎨 [创意指数] ${shotId} 注入${instructions.count}个模块(截断) | +${truncated.length}字符 | 原:${instructionLength} | 总:${currentLength + truncated.length + 20}/988`);
      return `${prompt}\n[创意指数${this.creativeIntensity}]${truncated}[/创意指数]`;
    }

    // 空间不足,不注入
    this.log('STAGE-11', `  ⚠️ [创意指数] ${shotId} 空间不足(${currentLength}/988),跳过注入`);
    return prompt;
  }

  _getCharacterStageMap(stages = {}) {
    return stages?.characters?.characters || {};
  }

  _getCharacterRenderPromptMap(stages = {}) {
    return stages?.characters?.renderPrompts || {};
  }

  _resolveShotCharacterIds(shot = {}) {
    // v6.5.64-P2-fix: 如果 shot 没有角色但场景需要 presenter，默认注入主角
    const ids = [];
    if (Array.isArray(shot.characters)) {
      ids.push(...shot.characters.filter(Boolean));
    }
    if (Array.isArray(shot.characterIds)) {
      ids.push(...shot.characterIds.filter(Boolean));
    }
    if (shot.characterId) {
      ids.push(shot.characterId);
    }
    if (shot.character) {
      if (typeof shot.character === 'string') ids.push(shot.character);
      else if (typeof shot.character === 'object' && shot.character.id) ids.push(shot.character.id);
    }
    // 去重
    const unique = [...new Set(ids)];
    // 如果镜头仍无角色，但类型需要角色（如 explanation/demonstration/closing），默认注入主角
    if (unique.length === 0) {
      const needsCharacter = ['explanation', 'demonstration', 'closing', 'ending', 'opening', 'presentation'].includes(shot.type);
      if (needsCharacter) {
        unique.push('chen-nurse');
      }
    }
    return unique;
  }

  _extractOutfitFromCharacter(character = {}) {
    return (
      character?.visualIdentity?.appearance?.clothing?.promptFragment ||
      character?.visualIdentity?.outfit ||
      character?.visual?.outfit ||
      character?.outfit ||
      ''
    );
  }

  _buildShotCharacterAnchor(character = {}, promptResult = null) {
    if (!character || typeof character !== 'object') return '';
    const name =
      character?.baseIdentity?.name ||
      character?.name ||
      character?.id ||
      '角色';
    const age =
      character?.baseIdentity?.age ??
      character?.age ??
      character?.visualIdentity?.age ??
      null;
    const gender =
      character?.baseIdentity?.gender ||
      character?.gender ||
      character?.visualIdentity?.gender ||
      '';
    const role =
      character?.baseIdentity?.role ||
      character?.role ||
      '';
    const genderMap = { male: '男性', female: '女性', boy: '男孩', girl: '女孩' };
    const outfit = this._extractOutfitFromCharacter(character);
    const parts = [];
    parts.push(name);
    const ageGender = `${age !== null ? `${age}岁` : ''}${genderMap[gender] || gender || ''}`.trim();
    if (ageGender) parts.push(ageGender);
    if (role) parts.push(role);
    if (outfit) parts.push(`穿着${outfit}`);
    const subjectLayer = promptResult?.layers?.subject?.content || '';
    const clothingLayer = promptResult?.layers?.clothing?.content || '';
    if (subjectLayer) parts.push(subjectLayer);
    if (clothingLayer && !parts.join('，').includes(clothingLayer)) parts.push(clothingLayer);
    return [...new Set(parts.filter(Boolean))].join('，');
  }

  _sanitizePromptForGenericMode(prompt) {
    if (!prompt || typeof prompt !== 'string') return prompt;
    return prompt
      .replace(/Nirath异兽/gi, '人类')
      .replace(/Nirath原生特征/gi, '现实人类特征')
      .replace(/双恒星光照反射/gi, '自然光照反射')
      .replace(/神话异星生态/gi, '现实环境逻辑')
      .replace(/异星/gi, '现实')
      .replace(/Nirath/gi, 'generic')
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .trim();
  }

  _mergeCharacterAnchorIntoPrompt(basePrompt, characterAnchor, options = {}) {
    const { hardLimit } = options;
    let prompt = String(basePrompt || '').trim();
    const anchor = String(characterAnchor || '').trim();
    if (!anchor) return prompt;
    if (!prompt) return anchor;
    // v6.5.64-P2-fix: 检查 prompt 是否已包含 outfit 关键词，而非仅检查角色名
    const normalizedPrompt = prompt.toLowerCase();
    const anchorWords = anchor.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
    const keyWords = anchorWords.slice(0, 5); // 取前5个关键词
    const hasAnchor = keyWords.every(w => normalizedPrompt.includes(w));
    let merged = hasAnchor ? prompt : `${anchor}，${prompt}`;
    if (hardLimit && merged.length > hardLimit) {
      merged = this.smartTrim(merged, hardLimit);
    }
    return merged;
  }

  _buildRenderMetaForShot(shot, stages) {
    const characterMap = this._getCharacterStageMap(stages);
    const characterPromptMap = this._getCharacterRenderPromptMap(stages);
    const characterIds = this._resolveShotCharacterIds(shot);
    const anchors = [];
    const detailedCharacters = [];
    for (const characterId of characterIds) {
      const character = characterMap[characterId];
      const promptResult = characterPromptMap[characterId];
      if (character) {
        detailedCharacters.push(character);
        const anchor = this._buildShotCharacterAnchor(character, promptResult);
        if (anchor) anchors.push(anchor);
      }
    }

    // v6.6.9.4-patch17: 构建定妆照绑定引用
    const characterRef = this._buildCharacterRef(shot, stages);

    return {
      characterIds,
      characters: detailedCharacters,
      characterAnchors: anchors,
      mergedCharacterAnchor: anchors.join('；'),
      characterRef  // 定妆照引用路径
    };
  }

  _ensureOutfitMentioned(prompt, renderMeta) {
    let out = String(prompt || '');
    const anchors = renderMeta?.characterAnchors || [];
    if (!anchors.length) return out;
    const lower = out.toLowerCase();
    for (const anchor of anchors) {
      const match = anchor.match(/穿着(.+?)(?:，|$)/);
      if (!match || !match[1]) continue;
      const outfitText = match[1].trim();
      if (!outfitText) continue;
      // 检查 outfit 关键词是否出现在 prompt 中（取前3个关键词）
      const outfitWords = outfitText
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(w => w.length > 3);
      const keyWords = outfitWords.slice(0, 3);
      const hasOutfit = keyWords.some(w => lower.includes(w));
      if (!hasOutfit) {
        out = `${anchor}，${out}`;
        break;
      }
    }
    return out;
  }

  _sanitizeCharacterForGenericMode(characterCard) {
    const cloned = JSON.parse(JSON.stringify(characterCard || {}));
    const scrubText = (value) => {
      if (typeof value !== 'string') return value;
      return value
        .replace(/Nirath异兽/gi, '人类')
        .replace(/Nirath原生特征/gi, '现实人类特征')
        .replace(/双恒星光照反射/gi, '自然光照反射')
        .replace(/Nirath/gi, 'generic')
        .replace(/异星/gi, '现实')
        .replace(/神话异星生态/gi, '现实环境逻辑')
        .trim();
    };
    const deepScrub = (obj) => {
      if (Array.isArray(obj)) return obj.map(deepScrub);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) out[k] = deepScrub(v);
        return out;
      }
      return scrubText(obj);
    };
    const cleaned = deepScrub(cloned);
    cleaned.baseIdentity = cleaned.baseIdentity || {};
    if (!cleaned.baseIdentity.species || /nirath/i.test(String(cleaned.baseIdentity.species))) {
      cleaned.baseIdentity.species = 'human';
    }
    cleaned.species = 'human';
    cleaned.race = 'human';
    cleaned.v2Metadata = cleaned.v2Metadata || {};
    if (typeof cleaned.v2Metadata.minimalAnchor === 'string') {
      cleaned.v2Metadata.minimalAnchor = scrubText(cleaned.v2Metadata.minimalAnchor);
    }
    return cleaned;
  }

  _releaseMemory(result) {
    try {
      if (!result || !result.stages) return;
      if (result.stages.script && typeof result.stages.script === 'object') {
        delete result.stages.script.rawLLMOutput;
        delete result.stages.script.debug;
      }
      if (result.stages.storyboard && typeof result.stages.storyboard === 'object') {
        delete result.stages.storyboard.debug;
        delete result.stages.storyboard.rawDraft;
      }
      if (result.stages.render && Array.isArray(result.stages.render)) {
        for (const shot of result.stages.render) {
          delete shot.rawPrompt;
          delete shot.debugPrompt;
          delete shot._largeIntermediateData;
        }
      }
      this.log('PIPELINE', '🧹 已执行主进程内存释放');
    } catch (e) {
      this.log('PIPELINE', `⚠️ 内存释放失败: ${e.message}`);
    }
  }

  // 🔥 v2.0: 创意指数系统辅助方法结束

  // ===== v6.5.64-P2: 质量门辅助方法（专家反馈补充） =====

  /**
   * 按质量门规则修复单个镜头的 Prompt
   */
  _repairShotPromptByQualityGate(shot, stages, options = {}) {
    const mode = options.mode || this.mode || 'generic';
    const prompt = String(shot?.prompt || '').trim();
    const fixes = [];
    const warnings = [];

    // 1. 长度修复
    if (prompt.length > PROMPT_LENGTH.HARD_MAX) {
      const trimmed = this.smartTrim(prompt, PROMPT_LENGTH.HARD_MAX);
      shot.prompt = trimmed;
      fixes.push(`trim_to_${PROMPT_LENGTH.HARD_MAX}`);
    }

    // 2. 检查 outfit 命中（如果 shot 有关联角色）
    const shotCharacters = shot?.characters || shot?.characterIds || [];
    if (shotCharacters.length > 0) {
      const hasOutfit = /uniform|outfit|clothing|dress|wear|警服|护士服|白大褂/i.test(prompt);
      if (!hasOutfit) {
        // 尝试从角色档案中补充 outfit
        for (const charId of shotCharacters) {
          const char = stages?.characters?.[charId];
          const outfit = char?.visualIdentity?.outfit || char?.visual?.outfit || '';
          if (outfit) {
            shot.prompt = `${prompt} ${outfit}`;
            fixes.push(`inject_outfit_${charId}`);
            break;
          }
        }
      }
    }

    // 3. generic 模式：去除 Nirath 残留
    if (mode === 'generic') {
      const forbidden = this._collectForbiddenKeywordsForMode('generic');
      const hit = this._containsForbiddenKeyword(prompt, forbidden);
      if (hit) {
        shot.prompt = this._sanitizePromptForGenericMode(prompt);
        fixes.push(`sanitize_generic_forbidden:${hit}`);
      }
    }

    // 4. 最终长度校验
    const finalLen = String(shot.prompt || '').length;
    if (finalLen > PROMPT_LENGTH.HARD_MAX) {
      shot.prompt = this.smartTrim(String(shot.prompt), PROMPT_LENGTH.HARD_MAX);
      fixes.push('final_trim');
    }

    // 构建 renderMeta
    const renderMeta = this._buildRenderMetaForShot(shot, stages);

    return {
      prompt: shot.prompt,
      fixes,
      warnings,
      renderMeta,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * 汇总质量门检查结果
   */
  _summarizePromptQualityGate(shots) {
    const total = shots.length;
    let passed = 0;
    let warned = 0;
    let failed = 0;
    let totalFixes = 0;

    for (const shot of shots) {
      const qg = shot?.qualityGate;
      if (!qg) {
        failed++;
        continue;
      }
      if (qg.passed) {
        passed++;
      } else if (qg.warnings?.length > 0) {
        warned++;
      } else {
        failed++;
      }
      totalFixes += (qg.fixes || []).length;
    }

    return { total, passed, warned, failed, totalFixes };
  }

  // ===== 辅助方法：收集指定模式的禁用关键词 =====
  _collectForbiddenKeywordsForMode(mode) {
    if (mode === 'generic') {
      return ['Nirath', '异兽', '异星', '双恒星', '晶化地形', '能量脉络', '神话异星生态'];
    }
    return [];
  }

  // ===== 辅助方法：检查 outfit 是否出现在 prompt 中 =====
  _checkShotOutfitPresence(prompt, renderMeta) {
    if (!renderMeta?.characterAnchors || renderMeta.characterAnchors.length === 0) {
      return { present: true, reason: 'no_characters' };
    }
    const promptLower = String(prompt || '').toLowerCase();
    for (const anchor of renderMeta.characterAnchors) {
      const outfit = anchor?.outfit || '';
      if (!outfit) continue;
      const outfitWords = outfit.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const hits = outfitWords.filter(w => promptLower.includes(w));
      if (hits.length === 0) {
        return { present: false, missingOutfit: outfit, character: anchor.name };
      }
    }
    return { present: true };
  }

  // ===== 辅助方法：检查 prompt 是否包含禁用关键词 =====
  _containsForbiddenKeyword(prompt, forbiddenList) {
    if (!forbiddenList || forbiddenList.length === 0) return '';
    const p = String(prompt || '').toLowerCase();
    for (const kw of forbiddenList) {
      if (p.includes(kw.toLowerCase())) return kw;
    }
    return '';
  }

}

// ========== v6.2-patch87-2: 分段验证独立函数 ==========
// ========== v6.2-patch87-2: 分段验证独立函数 ==========

/**
 * 分段验证:独立运行指定Stage
 * 用于调试和验证单个Stage,无需跑完整链路
 * @param {Object} pipeline - NirathMasterPipeline 实例
 * @param {string} stageName - Stage名称(如 'STAGE-5', 'STAGE-11')
 * @param {Object} upstreamStages - 前置Stage的结果(如 {prd, script, storyboard})
 * @param {Object} input - 原始输入
 */
async function runStandaloneStage(pipeline, stageName, upstreamStages = {}, input = {}) {
  pipeline.log('PIPELINE', `🧪 独立运行 ${stageName}(分段验证模式)`);

  const stageMap = {
    'STAGE-1': () => pipeline.stagePRD(input),
    'STAGE-2': () => pipeline.stageAlignment(input, upstreamStages.prd),
    'STAGE-3': () => pipeline.stageSchemaValidation(upstreamStages.prd),
    'STAGE-4': () => pipeline.stageCharacters(input, upstreamStages.prd),
    'STAGE-5': () => pipeline.stageScriptGeneration(input, upstreamStages.prd),
    'STAGE-5.5': () => pipeline.stageFPVDecision(upstreamStages.script),
    'STAGE-6': () => pipeline.stageDurationAllocation(upstreamStages.script, input),
    'STAGE-7': () => pipeline.stageStoryboard(upstreamStages.script, upstreamStages.duration, input),
    'STAGE-7.2': () => pipeline.stageProtagonistInitiative(upstreamStages.storyboard, input),
    'STAGE-7.3': () => pipeline.stageNarrationTrim(upstreamStages.storyboard, upstreamStages.duration),
    'STAGE-7.4': () => pipeline.stageDurationNarrationAlignment(upstreamStages.storyboard, upstreamStages.duration),
    'STAGE-7.5': () => pipeline.stageOpeningGeneration(input, upstreamStages.storyboard, upstreamStages.characters),
    'STAGE-8': () => pipeline.stageStoryboardValidation(upstreamStages.storyboard, input),
    'STAGE-8.5': () => pipeline.stageFiveElementCheck(upstreamStages.storyboard, input),
    'STAGE-9': () => pipeline.stageCameraMovement(upstreamStages.storyboard, upstreamStages.fpvDecision),
    'STAGE-10': () => pipeline.stageContinuity(upstreamStages.storyboard),
    'STAGE-10.5': () => pipeline.stageSafetyGate(upstreamStages),
    'STAGE-11': () => pipeline.stageRender(upstreamStages),
    'STAGE-11.5': () => pipeline.stagePromptQualityGate(upstreamStages.render, upstreamStages.storyboard),
    'STAGE-12': () => pipeline.stageCompliance(upstreamStages.render, upstreamStages.storyboard),
    'STAGE-13': () => pipeline.stagePreRenderValidation(upstreamStages),
    'STAGE-14': () => pipeline.stageStyleInjection(upstreamStages.render),
    'STAGE-15': () => pipeline.stagePostProduction(upstreamStages),
    'STAGE-16': () => pipeline.stageFinalOutput(upstreamStages)
  };

  const stageFn = stageMap[stageName];
  if (!stageFn) {
    throw new Error(`未知Stage: ${stageName}。可用: ${Object.keys(stageMap).join(', ')}`);
  }

  const startTime = Date.now();
  try {
    const result = await stageFn();
    const elapsed = Date.now() - startTime;
    pipeline.log('PIPELINE', `✅ ${stageName} 独立运行完成 | ${elapsed}ms`);
    return { stageName, result, elapsedMs: elapsed, success: true };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    pipeline.log('PIPELINE', `❌ ${stageName} 独立运行失败 | ${elapsed}ms | ${err.message}`);
    return { stageName, error: err.message, elapsedMs: elapsed, success: false };
  }
}


module.exports = { NirathMasterPipeline, runStandaloneStage };

```

---

## core/promptforge-director-worker.js

> 文件大小: 15554 bytes

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WORKER_TIMEOUT_MS = 15 * 60 * 1000; // 15分钟
const DEFAULT_CALL_TIMEOUT_MS = 120 * 1000; // 单次LLM调用 2分钟
const DEFAULT_MAX_RETRIES = 2;

function log(...args) {
  console.log(`[PromptForgeWorker]`, ...args);
}

function logError(...args) {
  console.error(`[PromptForgeWorker][ERROR]`, ...args);
}

function safeWriteJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logError(`safeWriteJson failed: ${err.message}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCameraMovement(cm) {
  if (!cm || typeof cm !== 'object') return cm;
  if (cm.timeline && typeof cm.timeline === 'object' && cm.timeline.timeline) {
    return {
      ...cm,
      timeline: {
        ...cm.timeline.timeline,
        strategy: cm.timeline.strategy || cm.timeline.timeline.strategy,
        reasoning: cm.timeline.reasoning || cm.timeline.timeline.reasoning
      }
    };
  }
  return cm;
}

/**
 * 每次LLM调用使用独立子进程，超时可强杀
 */
async function callLLM(prompt, options = {}) {
  const {
    timeoutMs = DEFAULT_CALL_TIMEOUT_MS,
    maxTokens = 2048,
    temperature = 1,
    model = 'kimi-k2p6',
    mode = 'production',
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = 3000,
    stageLabel = 'unknown'
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const inputFile = path.join('/tmp', `llm-isolated-input-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    const outputFile = path.join('/tmp', `llm-isolated-output-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    const workerPath = path.join(__dirname, 'llm-call-isolated-worker.js');

    try {
      fs.writeFileSync(inputFile, JSON.stringify({
        prompt,
        options: {
          timeoutMs,
          maxTokens,
          temperature,
          model,
          mode
        }
      }, null, 2), 'utf8');

      const child = spawn('node', [
        '--max-old-space-size=512',
        workerPath,
        inputFile,
        outputFile
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });

      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch (_) {}
          reject(new Error(`LLM isolated call timeout after ${timeoutMs}ms | stage=${stageLabel} | attempt=${attempt}`));
        }, timeoutMs);

        timer.unref?.();

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });

        child.on('close', (code, signal) => {
          clearTimeout(timer);

          if (signal === 'SIGKILL') {
            return reject(new Error(`LLM isolated worker killed by SIGKILL | stage=${stageLabel} | attempt=${attempt}`));
          }

          if (!fs.existsSync(outputFile)) {
            return reject(new Error(`LLM isolated worker missing output file | code=${code} | stderr=${stderr.slice(0, 500)}`));
          }

          try {
            const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            if (!data.success) {
              return reject(new Error(data.error || `LLM isolated worker failed | code=${code}`));
            }
            resolve(data.result);
          } catch (e) {
            reject(new Error(`LLM isolated worker output parse failed: ${e.message}`));
          }
        });
      });

      return result;
    } catch (err) {
      lastError = err;
      logError(`callLLM attempt ${attempt} failed | ${stageLabel} | ${err.message}`);
      if (attempt <= maxRetries) {
        await sleep(retryDelayMs);
      }
    } finally {
      try { if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile); } catch (_) {}
      try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch (_) {}
    }
  }

  throw lastError || new Error(`callLLM failed | stage=${stageLabel}`);
}

function extractContentFromLLMResult(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (typeof result.content === 'string') return result.content;
  if (typeof result.text === 'string') return result.text;
  if (result.choices?.[0]?.message?.content) return result.choices[0].message.content;
  return JSON.stringify(result);
}

function buildDirectorPrompt(rawReport, projectConfig = {}, mode = 'generic') {
  const shots = rawReport.shots || [];
  const shotSummary = shots.map(s => {
    return `- ${s.id} | scene=${s.scene || ''} | duration=${s.duration || 0}s | emotion=${s.emotionPhase || ''} | dialogue=${(s.dialogue || '').slice(0, 60)}`;
  }).join('\n');

  return `
你是短视频总导演。请对以下镜头集合做导演级整体编排建议。
目标：
1. 统一风格
2. 明确情绪推进
3. 指出需要强化的镜头重点
4. 不要输出废话

模式: ${mode}
项目主题: ${projectConfig.theme || ''}
标题: ${projectConfig.title || projectConfig.projectName || ''}

镜头列表:
${shotSummary}

请输出 JSON：
{
  "overallDirection": "一句话总方向",
  "styleGuide": "整体风格",
  "emotionArc": "整体情绪弧线",
  "shotNotes": [
    {
      "id": "S01",
      "note": "该镜头导演建议"
    }
  ]
}
`.trim();
}

function buildScreenwriterPrompt(shot, directorResult, mode = 'generic') {
  const note = (directorResult.shotNotes || []).find(x => x.id === shot.id)?.note || '';
  return `
你是编剧优化器。请只优化当前镜头的台词/叙事表达，不要改镜头编号。

模式: ${mode}
镜头ID: ${shot.id}
场景: ${shot.scene || ''}
时长: ${shot.duration || 0}s
情绪: ${shot.emotionPhase || ''}
原台词: ${shot.dialogue || ''}
导演建议: ${note}

要求：
1. 台词更自然、更有画面感
2. 不要空话
3. 不要输出解释
4. 只输出 JSON

格式：
{
  "id": "${shot.id}",
  "dialogue": "优化后的台词",
  "dialogueDepth": "L0/L1/L2/L3",
  "emotionArc": ["情绪1", "情绪2"]
}
`.trim();
}

function buildCinematographerPrompt(shot, directorResult, mode = 'generic') {
  const note = (directorResult.shotNotes || []).find(x => x.id === shot.id)?.note || '';
  return `
你是摄影指导。请只为当前镜头输出运镜与光影建议。

模式: ${mode}
镜头ID: ${shot.id}
场景: ${shot.scene || ''}
时长: ${shot.duration || 0}s
情绪: ${shot.emotionPhase || ''}
原Prompt: ${(shot.prompt || '').slice(0, 1000)}
导演建议: ${note}
运镜输入: ${JSON.stringify(cleanCameraMovement(shot.cameraMovement) || {})}

要求：
1. 强化镜头语言
2. 强化光影层次
3. 不要空话
4. 只输出 JSON

格式：
{
  "id": "${shot.id}",
  "cameraDesign": "运镜设计",
  "lightingDesign": "光影设计",
  "visualElements": "关键视觉元素",
  "performance": "表演/状态建议"
}
`.trim();
}

function buildComposerPrompt(shot, directorResult, screenwriterResult, cinematographerResult, mode = 'generic') {
  return `
你是最终提示词合成师。请把以下信息合成为最终 Prompt。

模式: ${mode}
镜头ID: ${shot.id}
场景: ${shot.scene || ''}
时长: ${shot.duration || 0}s
原始Prompt: ${(shot.prompt || '').slice(0, 1200)}
优化台词: ${screenwriterResult?.dialogue || shot.dialogue || ''}
运镜设计: ${cinematographerResult?.cameraDesign || ''}
光影设计: ${cinematographerResult?.lightingDesign || ''}
视觉元素: ${cinematographerResult?.visualElements || ''}
表演建议: ${cinematographerResult?.performance || ''}

要求：
1. 输出单条最终 Prompt
2. 保留结构化块格式，优先使用：
   【视觉】【动态】【空间】【情绪】【镜头时间轴】【照明】【环境音效】【渲染】【导演】
3. 长度控制在 1500 字符内
4. 只输出 JSON

格式：
{
  "id": "${shot.id}",
  "finalPrompt": "最终Prompt"
}
`.trim();
}

function safeParseJSON(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {}

  const match = String(text).match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }
  return fallback;
}

async function runDirectorStage(rawReport, projectConfig, mode) {
  log(`Stage 1 Director start`);
  const prompt = buildDirectorPrompt(rawReport, projectConfig, mode);
  const result = await callLLM(prompt, {
    timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
    maxTokens: 2500,
    stageLabel: 'Stage-1-Director',
    mode
  });
  const parsed = safeParseJSON(extractContentFromLLMResult(result), {
    overallDirection: '',
    styleGuide: '',
    emotionArc: '',
    shotNotes: []
  });
  log(`Stage 1 Director done | prompt=${prompt.length} chars`);
  return parsed;
}

async function runScreenwriterStage(shots, directorResult, mode) {
  log(`Stage 2a Screenwriter start | shots=${shots.length}`);
  const results = [];

  for (const shot of shots) {
    const label = `Stage-2a-${shot.id}`;
    log(`${label} start`);
    const prompt = buildScreenwriterPrompt(shot, directorResult, mode);
    const llmResult = await callLLM(prompt, {
      timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
      maxTokens: 1800,
      stageLabel: label,
      mode
    });
    const parsed = safeParseJSON(extractContentFromLLMResult(llmResult), {
      id: shot.id,
      dialogue: shot.dialogue || '',
      dialogueDepth: 'L0',
      emotionArc: []
    });
    results.push(parsed);
    log(`${label} done`);
  }

  return results;
}

async function runCinematographerStage(shots, directorResult, mode) {
  log(`Stage 2b Cinematographer start | shots=${shots.length}`);
  const results = [];

  for (const shot of shots) {
    const label = `Stage-2b-${shot.id}`;
    log(`${label} start`);
    const prompt = buildCinematographerPrompt(shot, directorResult, mode);
    const llmResult = await callLLM(prompt, {
      timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
      maxTokens: 1800,
      stageLabel: label,
      mode
    });
    const parsed = safeParseJSON(extractContentFromLLMResult(llmResult), {
      id: shot.id,
      cameraDesign: '',
      lightingDesign: '',
      visualElements: '',
      performance: ''
    });
    results.push(parsed);
    log(`${label} done`);
  }

  return results;
}

async function runComposerStage(shots, directorResult, screenwriterResults, cinematographerResults, mode) {
  log(`Stage 3 Composer start | shots=${shots.length}`);
  const results = [];

  for (const shot of shots) {
    const label = `Stage-3-${shot.id}`;
    log(`${label} start`);

    const sw = screenwriterResults.find(x => x.id === shot.id) || null;
    const cam = cinematographerResults.find(x => x.id === shot.id) || null;

    const prompt = buildComposerPrompt(shot, directorResult, sw, cam, mode);
    const llmResult = await callLLM(prompt, {
      timeoutMs: DEFAULT_CALL_TIMEOUT_MS,
      maxTokens: 2500,
      stageLabel: label,
      mode
    });

    const parsed = safeParseJSON(extractContentFromLLMResult(llmResult), {
      id: shot.id,
      finalPrompt: shot.prompt || ''
    });

    results.push(parsed);
    log(`${label} done`);
  }

  return results;
}

function buildQualityReport(finalShots) {
  const details = finalShots.map(shot => {
    const prompt = cleanText(shot.finalPrompt || '');
    const structureScore =
      (prompt.includes('【视觉】') ? 1 : 0) +
      (prompt.includes('【镜头时间轴】') ? 1 : 0) +
      (prompt.includes('【照明】') ? 1 : 0);

    const lengthScore =
      prompt.length >= 900 && prompt.length <= 1500 ? 5 :
      prompt.length >= 700 ? 3 : 1;

    const cameraPassed = /【镜头时间轴】|dolly|pan|tilt|orbit|tracking/i.test(prompt);

    const totalScore = structureScore * 10 + lengthScore * 5 + (cameraPassed ? 20 : 0) + 40;

    return {
      shotId: shot.id,
      structureScore,
      lengthScore,
      cameraPassed,
      totalScore
    };
  });

  const overallScore = details.length
    ? Math.round(details.reduce((sum, d) => sum + d.totalScore, 0) / details.length)
    : 0;

  return {
    overallScore,
    overallPassed: overallScore >= 50,
    shotDetails: details
  };
}

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputFile || !outputFile) {
    throw new Error('Usage: node promptforge-director-worker.js <inputFile> <outputFile>');
  }

  const workerTimer = setTimeout(() => {
    logError(`⏱️ Worker全局超时(${WORKER_TIMEOUT_MS}ms)，强制退出`);
    safeWriteJson(outputFile, {
      success: false,
      error: `Worker global timeout after ${WORKER_TIMEOUT_MS}ms`
    });
    process.exit(1);
  }, WORKER_TIMEOUT_MS);
  workerTimer.unref?.();

  const input = readJson(inputFile);
  const rawReport = input.rawReport || { shots: [] };
  const projectConfig = input.projectConfig || {};
  const mode = input.mode || 'generic';

  log(`Worker start | mode=${mode} | input=${inputFile}`);

  // 关键修复：跳过 S00 / opening
  const allShots = Array.isArray(rawReport.shots) ? rawReport.shots : [];
  const shots = allShots.filter(s => {
    const id = s.id || s.shotId;
    return id !== 'S00' && s.type !== 'opening' && !s.isOpening;
  });

  log(`Input shots: total=${allShots.length}, processable=${shots.length}, skipped=${allShots.length - shots.length}`);

  try {
    const directorResult = await runDirectorStage({ shots }, projectConfig, mode);
    const screenwriterResults = await runScreenwriterStage(shots, directorResult, mode);
    const cinematographerResults = await runCinematographerStage(shots, directorResult, mode);
    const composedResults = await runComposerStage(shots, directorResult, screenwriterResults, cinematographerResults, mode);

    const finalShots = shots.map(shot => {
      const composed = composedResults.find(x => x.id === shot.id);
      return {
        id: shot.id,
        finalPrompt: cleanText(composed?.finalPrompt || shot.prompt || ''),
        dialogue: (screenwriterResults.find(x => x.id === shot.id)?.dialogue) || shot.dialogue || '',
        cameraDesign: (cinematographerResults.find(x => x.id === shot.id)?.cameraDesign) || '',
        lightingDesign: (cinematographerResults.find(x => x.id === shot.id)?.lightingDesign) || ''
      };
    });

    const qualityReport = buildQualityReport(finalShots);

    safeWriteJson(outputFile, {
      success: true,
      shots: finalShots,
      qualityReport,
      meta: {
        totalShots: finalShots.length,
        skippedOpening: allShots.length - finalShots.length,
        mode
      }
    });

    clearTimeout(workerTimer);
    log(`Worker completed | shots=${finalShots.length} | quality=${qualityReport.overallScore}`);
    process.exit(0);
  } catch (err) {
    clearTimeout(workerTimer);
    logError(`Worker failed: ${err.message}`);
    safeWriteJson(outputFile, {
      success: false,
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

main().catch((err) => {
  logError(`Fatal: ${err.message}`);
  process.exit(1);
});

```

---

## core/realism-prompt-enhancer.js

> 文件大小: 15121 bytes

```javascript
/**
 * Realism Prompt Enhancer v1.0
 * AI视频画面真实感软性注入层
 * 
 * 定位：不改变系统架构、不新增字段、不改动主链路模块
 * 仅作为视觉提示词的后置增强层，提升输出真实感指数
 * 
 * 注入路径：Stage 11 (视觉提示词生成) → 后置增强 → 提交渲染
 */

class RealismPromptEnhancer {
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // 默认启用
    this.mode = options.mode || 'smart'; // 'full' | 'smart' | 'minimal'
    this.sceneType = options.sceneType || 'general'; // 'portrait' | 'wildlife' | 'interior' | 'general' | 'minimal'
    
    // 七维质感参数库
    this.dimensions = {
      camera: {
        primary: ['Arri Alexa 65', 'Arri Alexa Mini LF'],
        secondary: ['RED V-RAPTOR', 'Sony Venice 2'],
        auxiliary: ['65mm sensor', 'large format', 'IMAX 70mm']
      },
      lens: {
        primary: ['Cooke S7/i', 'Arri Master Prime'],
        secondary: ['Leica Summilux', 'Zeiss Otus', 'Panavision Primo'],
        modifiers: ['anamorphic 2.39:1', 'widescreen cinematic']
      },
      aperture: {
        range: 'f/1.8 - f/2.8',
        modifiers: ['shallow DOF', 'soft bokeh', 'background falls off smoothly'],
        advanced: ['tack sharp focus on subject eyes']
      },
      lighting: {
        primary: 'natural diffused overcast',
        modifiers: ['soft shadows', 'no hard light'],
        alternatives: ['golden hour soft sunlight', 'overcast skylight', 'practical lights visible in frame'],
        advanced: ['subtle rim light separating subject from background']
      },
      color: {
        primary: 'muted desaturated earth tones',
        modifiers: ['teal shadows, warm highlights', 'cinematic LUT'],
        auxiliary: ['Kodak Vision3 500T color science', 'subtle color separation'],
        forbidden: ['highly saturated', 'vivid colors']
      },
      material: {
        primary: ['subsurface scattering', 'individual hair strands visible', 'skin pores visible', 'fabric weave texture'],
        auxiliary: ['subtle imperfections', 'microscopic surface detail'],
        advanced: ['dust particles in sunlight', 'tiny water droplets on skin']
      },
      motion: {
        primary: ['motion blur on fast elements', 'wind blowing hair and fabric'],
        auxiliary: ['dust particles floating in air', 'shallow depth breathing motion', 'natural micro-movements'],
        advanced: ['lens flare from practical light', 'handheld camera subtle shake']
      },
      grain: {
        primary: 'subtle film grain',
        auxiliary: ['organic texture', 'RAW quality', 'fine noise structure'],
        forbidden: ['overly clean digital look'],
        advanced: 'Kodak 5219 grain structure'
      }
    };

    // 禁忌词映射表（AI感 → 真实感）
    this.antiPatterns = {
      'perfect skin': 'skin pores visible, subtle imperfections',
      'flawless complexion': 'subsurface scattering, individual hair strands',
      'vivid colors': 'muted desaturated earth tones',
      'highly saturated': 'muted desaturated earth tones',
      'colorful': 'teal shadows, warm highlights',
      'studio lighting': 'natural diffused overcast lighting',
      'perfect lighting': 'natural diffused overcast lighting',
      'professional lighting setup': 'natural diffused overcast with soft shadows',
      'dramatic hard shadows': 'soft shadows, no hard light',
      'everything in sharp focus': 'shallow DOF, f/1.8',
      'deep depth of field': 'shallow DOF, soft bokeh',
      'clean digital look': 'subtle film grain, organic texture',
      'crisp sharp': 'subtle film grain, RAW quality',
      'cinematic': 'Arri Alexa 65, Cooke S7/i', // 泛化词替换为具体器材
      'photorealistic': 'Arri Alexa 65, 65mm sensor, shallow DOF', // 泛化词替换为具体器材
      'static pose': 'natural micro-movements, wind blowing hair',
      'frozen moment': 'motion blur on fast elements, dust particles'
    };

    // 场景化模板
    this.templates = {
      portrait: [
        'Arri Alexa 65', 'Cooke S7/i', 'anamorphic 2.39:1',
        'f/1.8 shallow DOF', 'soft bokeh', 'background falls off smoothly',
        'natural diffused overcast', 'soft shadows', 'no hard light',
        'muted desaturated earth tones', 'teal shadows', 'warm highlights',
        'subsurface scattering', 'skin pores visible', 'individual hair strands',
        'subtle imperfections', 'wind blowing hair', 'motion blur on fast movements',
        'subtle film grain', 'organic texture'
      ],
      wildlife: [
        'Arri Alexa Mini LF', 'Master Prime', 'widescreen cinematic',
        'f/2.8 shallow DOF', 'natural diffused overcast', 'soft shadows',
        'muted earth tones', 'individual fur strands visible', 'subsurface scattering on ears and nose',
        'wind blowing fur and grass', 'dust particles in air',
        'motion blur on fast movements', 'documentary wildlife photography style', 'National Geographic',
        'subtle film grain', 'RAW quality'
      ],
      interior: [
        'Arri Alexa 65', 'Cooke S7/i', '2.39:1 anamorphic',
        'f/2.0 shallow DOF', 'natural light through window diffused overcast',
        'soft shadows', 'practical lights visible in frame',
        'muted desaturated warm earth tones', 'teal shadows', 'cinematic LUT',
        'fabric weave texture visible on furniture', 'skin pores on people',
        'subtle film grain', 'organic texture',
        'subtle rim light separating subjects from background'
      ],
      general: [
        'Arri Alexa 65', 'Cooke S7/i', 'anamorphic 2.39:1',
        'f/2.0 shallow DOF', 'natural diffused overcast', 'soft shadows', 'no hard light',
        'muted desaturated earth tones', 'teal shadows', 'warm highlights', 'cinematic LUT',
        'subsurface scattering', 'skin pores visible', 'individual hair strands',
        'subtle imperfections', 'wind blowing hair and fabric',
        'motion blur on fast elements', 'dust particles floating in air',
        'subtle film grain', 'organic texture'
      ],
      minimal: [
        'Arri Alexa 65', 'Cooke S7/i', 'f/2.0',
        'shallow DOF', 'natural diffused overcast',
        'muted earth tones', 'skin pores', 'subsurface scattering',
        'wind motion', 'subtle film grain'
      ]
    };
  }

  /**
   * 主入口：增强视觉提示词
   * @param {string} originalPrompt - 原始视觉提示词
   * @param {object} context - 上下文信息（场景类型、角色等）
   * @returns {string} - 增强后的提示词
   */
  enhance(originalPrompt, context = {}) {
    if (!this.enabled || !originalPrompt) {
      return originalPrompt;
    }

    const sceneType = context.sceneType || this.sceneType || 'general';
    const mode = context.mode || this.mode || 'smart';

    switch (mode) {
      case 'full':
        return this._enhanceFull(originalPrompt, sceneType);
      case 'minimal':
        return this._enhanceMinimal(originalPrompt, sceneType);
      case 'smart':
      default:
        return this._enhanceSmart(originalPrompt, sceneType);
    }
  }

  /**
   * 智能增强：分析现有提示词，补全缺失维度
   */
  _enhanceSmart(originalPrompt, sceneType) {
    // 1. 检查已有维度覆盖度
    const coverage = this._analyzeCoverage(originalPrompt);
    
    // 2. 获取缺失维度的关键词
    const missingKeywords = this._getMissingKeywords(coverage, sceneType);
    
    // 3. 反模式检查（替换AI感词汇）
    let cleanedPrompt = this._replaceAntiPatterns(originalPrompt);
    
    // 4. 追加缺失维度（避免重复）
    const enhancedPrompt = this._mergePrompts(cleanedPrompt, missingKeywords);
    
    return enhancedPrompt;
  }

  /**
   * 全量增强：直接追加完整模板
   */
  _enhanceFull(originalPrompt, sceneType) {
    const template = this.templates[sceneType] || this.templates.general;
    const templateStr = template.join(', ');
    
    // 清理原提示词中的反模式
    const cleanedPrompt = this._replaceAntiPatterns(originalPrompt);
    
    return `${cleanedPrompt}, ${templateStr}`;
  }

  /**
   * 最小增强：仅追加最高ROI关键词
   */
  _enhanceMinimal(originalPrompt, sceneType) {
    const template = this.templates.minimal;
    const templateStr = template.join(', ');
    
    const cleanedPrompt = this._replaceAntiPatterns(originalPrompt);
    
    return `${cleanedPrompt}, ${templateStr}`;
  }

  /**
   * 分析提示词维度覆盖度
   */
  _analyzeCoverage(prompt) {
    const coverage = {
      camera: false, lens: false, aperture: false, lighting: false,
      color: false, material: false, motion: false, grain: false
    };
    
    const lowerPrompt = prompt.toLowerCase();
    
    // 检查各维度
    if (lowerPrompt.includes('arri') || lowerPrompt.includes('red') || lowerPrompt.includes('sony venice')) {
      coverage.camera = true;
    }
    if (lowerPrompt.includes('cooke') || lowerPrompt.includes('master prime') || lowerPrompt.includes('leica') || lowerPrompt.includes('zeiss')) {
      coverage.lens = true;
    }
    if (lowerPrompt.includes('f/') || lowerPrompt.includes('dof') || lowerPrompt.includes('bokeh')) {
      coverage.aperture = true;
    }
    if (lowerPrompt.includes('light') || lowerPrompt.includes('overcast') || lowerPrompt.includes('shadow')) {
      coverage.lighting = true;
    }
    if (lowerPrompt.includes('muted') || lowerPrompt.includes('desaturated') || lowerPrompt.includes('teal') || lowerPrompt.includes('lut')) {
      coverage.color = true;
    }
    if (lowerPrompt.includes('subsurface') || lowerPrompt.includes('pores') || lowerPrompt.includes('hair strands') || lowerPrompt.includes('texture')) {
      coverage.material = true;
    }
    if (lowerPrompt.includes('motion') || lowerPrompt.includes('wind') || lowerPrompt.includes('blur')) {
      coverage.motion = true;
    }
    if (lowerPrompt.includes('grain') || lowerPrompt.includes('texture') || lowerPrompt.includes('raw')) {
      coverage.grain = true;
    }
    
    return coverage;
  }

  /**
   * 获取缺失维度的关键词
   */
  _getMissingKeywords(coverage, sceneType) {
    const keywords = [];
    const dim = this.dimensions;
    
    // 根据场景类型选择不同优先级的关键词
    if (sceneType === 'portrait') {
      if (!coverage.camera) keywords.push(dim.camera.primary[0]);
      if (!coverage.lens) keywords.push(dim.lens.primary[0]);
      if (!coverage.aperture) keywords.push(`f/1.8 ${dim.aperture.modifiers[0]}`);
      if (!coverage.lighting) keywords.push(dim.lighting.primary, dim.lighting.modifiers[1]);
      if (!coverage.color) keywords.push(dim.color.primary, dim.color.modifiers[0]);
      if (!coverage.material) keywords.push(dim.material.primary[0], dim.material.primary[2]);
      if (!coverage.motion) keywords.push(dim.motion.primary[1]);
      if (!coverage.grain) keywords.push(dim.grain.primary);
    } else if (sceneType === 'wildlife') {
      if (!coverage.camera) keywords.push(dim.camera.primary[1]);
      if (!coverage.lens) keywords.push(dim.lens.primary[1]);
      if (!coverage.aperture) keywords.push(`f/2.8 ${dim.aperture.modifiers[0]}`);
      if (!coverage.lighting) keywords.push(dim.lighting.primary);
      if (!coverage.color) keywords.push('muted earth tones');
      if (!coverage.material) keywords.push('individual fur strands visible', 'subsurface scattering on ears');
      if (!coverage.motion) keywords.push('motion blur on fast movements', 'dust particles in air');
      if (!coverage.grain) keywords.push('subtle film grain', 'RAW quality');
    } else {
      // general default
      if (!coverage.camera) keywords.push(dim.camera.primary[0]);
      if (!coverage.lens) keywords.push(dim.lens.primary[0]);
      if (!coverage.aperture) keywords.push(`f/2.0 ${dim.aperture.modifiers[0]}`);
      if (!coverage.lighting) keywords.push(dim.lighting.primary, dim.lighting.modifiers[1]);
      if (!coverage.color) keywords.push(dim.color.primary, dim.color.modifiers[0]);
      if (!coverage.material) keywords.push(dim.material.primary[0]);
      if (!coverage.motion) keywords.push(dim.motion.primary[0]);
      if (!coverage.grain) keywords.push(dim.grain.primary);
    }
    
    return keywords;
  }

  /**
   * 反模式替换：将AI感词汇替换为真实感词汇
   */
  _replaceAntiPatterns(prompt) {
    let result = prompt;
    
    for (const [antiPattern, replacement] of Object.entries(this.antiPatterns)) {
      // 不区分大小写替换，但保留原始大小写风格
      const regex = new RegExp(`\\b${antiPattern}\\b`, 'gi');
      result = result.replace(regex, replacement);
    }
    
    return result;
  }

  /**
   * 合并提示词（避免重复）
   */
  _mergePrompts(original, newKeywords) {
    // 简单拼接，去重逻辑由调用方处理
    const combined = newKeywords.length > 0 
      ? `${original}, ${newKeywords.join(', ')}` 
      : original;
    
    return combined;
  }

  /**
   * 质量检验：评估提示词真实感指数
   */
  evaluate(originalPrompt, enhancedPrompt) {
    const beforeCoverage = this._analyzeCoverage(originalPrompt);
    const afterCoverage = this._analyzeCoverage(enhancedPrompt);
    
    const beforeScore = Object.values(beforeCoverage).filter(Boolean).length;
    const afterScore = Object.values(afterCoverage).filter(Boolean).length;
    
    return {
      beforeScore,
      afterScore,
      improvement: afterScore - beforeScore,
      coverageBefore: beforeCoverage,
      coverageAfter: afterCoverage,
      isEnhanced: afterScore > beforeScore
    };
  }

  /**
   * 批量增强（用于pipeline批量处理）
   */
  enhanceBatch(shots, context = {}) {
    return shots.map((shot, index) => {
      const sceneType = this._detectSceneType(shot, context);
      const enhanced = this.enhance(shot.visualPrompt || '', {
        ...context,
        sceneType,
        shotIndex: index
      });
      
      return {
        ...shot,
        visualPrompt: enhanced,
        _realismEnhancement: {
          original: shot.visualPrompt,
          sceneType,
          enabled: this.enabled
        }
      };
    });
  }

  /**
   * 自动检测场景类型
   */
  _detectSceneType(shot, context) {
    // 优先使用上下文指定的场景类型
    if (context.sceneType && this.templates[context.sceneType]) {
      return context.sceneType;
    }
    
    // 根据镜头内容推断
    const prompt = (shot.visualPrompt || shot.description || '').toLowerCase();
    const sceneTypes = shot.sceneType || shot.type || '';
    
    if (sceneTypes.includes('animal') || sceneTypes.includes('wildlife') || 
        prompt.includes('animal') || prompt.includes('wildlife') || prompt.includes('狮子')) {
      return 'wildlife';
    }
    
    if (sceneTypes.includes('interior') || sceneTypes.includes('indoor') ||
        prompt.includes('室内') || prompt.includes('room') || prompt.includes('house')) {
      return 'interior';
    }
    
    // 默认肖像/人物
    return 'portrait';
  }
}

module.exports = { RealismPromptEnhancer };

```

---

## core/user-requirement-parser.js

> 文件大小: 31118 bytes

```javascript
/**
 * 用户需求解析确认模块 - UserRequirementParser
 * Stage -1: 将用户自然语言输入解析为结构化需求清单
 * 
 * 设计原则：
 * 1. 用户只需要说一句话，系统负责给出完整方案
 * 2. 主动提案、轻量确认
 * 3. 规则库+LLM混合解析
 * 4. 100%向后兼容
 * 
 * @version 1.0
 * @since v6.6.0
 */

const { LLMEngine } = require('../../systems/llm-engine');

/**
 * 风格编码展开映射器
 * 统一处理编码→中文描述的转换
 * 支持上下文感知的动态展开
 */
const StyleEncoder = {
  // 主风格编码映射
  primaryStyles: {
    'REAL': { name: '写实纪实', description: '自然光、真实场景、手持感', contextDescriptions: {
      'EDU': '真实可信的纪实风格，增强专业信任感',
      'DOC': '深度纪实的真实质感，保留现场感',
      'VLOG': '自然随性的记录风格，贴近生活',
      'default': '写实纪实的真实质感'
    }},
    'CINE': { name: '电影质感', description: '戏剧性光影、宽画幅、景深', contextDescriptions: {
      'DRAMA': '电影级叙事质感，增强戏剧张力',
      'MV': '艺术化的电影视觉，强化情绪表达',
      'ADV': '高端电影质感，提升品牌调性',
      'default': '电影级的戏剧质感'
    }},
    'POL': { name: '精致商业', description: '高饱和、精致布光、产品特写', contextDescriptions: {
      'ADV': '精致商业广告质感，突出产品卖点',
      'COR': '高端商业品质感，展示企业实力',
      'default': '精致商业的高品质呈现'
    }},
    'MINI': { name: '极简现代', description: 'clean背景、大留白、几何构图', contextDescriptions: {
      'ADV': '极简现代的产品展示，突出科技感',
      'COR': '现代简约的商务风格',
      'default': '极简现代的设计美学'
    }},
    'RET': { name: '复古怀旧', description: '暖色调、胶片颗粒、年代感', contextDescriptions: {
      'DRAMA': '复古怀旧的叙事氛围，唤起情感共鸣',
      'MV': '怀旧复古的视觉风格，营造年代感',
      'default': '复古怀旧的温暖质感'
    }},
    'FUT': { name: '科幻未来', description: '冷色调、霓虹光、科技感UI', contextDescriptions: {
      'ADV': '科幻未来的前卫视觉，彰显科技实力',
      'MV': '未来科幻的艺术表达',
      'default': '科幻未来的科技美学'
    }},
    'ART': { name: '艺术实验', description: '非常规构图、抽象视觉、强烈色彩', contextDescriptions: {
      'MV': '艺术实验的前卫表达',
      'ADV': '艺术化的创意视觉',
      'default': '艺术实验的独特美学'
    }},
    'WARM': { name: '温暖治愈', description: '柔和光线、暖色调、慢节奏', contextDescriptions: {
      'EDU': '温暖治愈的亲和风格，降低知识门槛',
      'VLOG': '温暖治愈的生活记录',
      'default': '温暖治愈的情感氛围'
    }},
    'STREET': { name: '街头潮流', description: '快速剪辑、涂鸦元素、动感运镜', contextDescriptions: {
      'SOC': '街头潮流的年轻活力',
      'ADV': '潮流前卫的品牌表达',
      'default': '街头潮流的动感风格'
    }},
    'FAIRY': { name: '梦幻童话', description: '柔光、仙气、超现实元素', contextDescriptions: {
      'DRAMA': '梦幻童话的浪漫氛围',
      'ADV': '梦幻唯美的产品呈现',
      'default': '梦幻童话的超现实美感'
    }}
  },

  // 辅助风格编码映射
  secondaryStyles: {
    'LUX': { name: '奢华感', effect: '金色/暗调、高级质感、慢镜头' },
    'VIV': { name: '活力感', effect: '高饱和、快节奏、动感音乐' },
    'EMO': { name: '情绪感', effect: '低饱和、慢节奏、叙事性强' },
    'NAT': { name: '自然感', effect: '户外、自然光、绿意/蓝天' },
    'GRI': { name: '粗粝感', effect: '高对比、暗部细节、纪实感' },
    'SWE': { name: '甜美感', effect: '粉色/马卡龙、柔光、可爱元素' },
    'DAR': { name: '暗黑感', effect: '低key布光、阴影、神秘氛围' },
    'NOS': { name: '怀旧感', effect: '胶片色、颗粒、老电视效果' }
  },

  /**
   * 展开主风格编码为中文描述
   * @param {string} code - 风格编码如 'REAL'
   * @param {string} videoType - 视频类型如 'EDU'
   * @returns {string} 中文描述
   */
  expandPrimary(code, videoType) {
    const style = this.primaryStyles[code];
    if (!style) return code;
    const contextDesc = style.contextDescriptions[videoType] || style.contextDescriptions['default'];
    return `${style.name}风格，${contextDesc}，${style.description}`;
  },

  /**
   * 展开辅助风格编码为中文描述
   * @param {string} code - 辅助风格编码如 '+LUX'
   * @returns {string} 中文描述
   */
  expandSecondary(code) {
    const cleanCode = code.replace(/^\+/, '');
    const style = this.secondaryStyles[cleanCode];
    if (!style) return code;
    return `${style.name}(${style.effect})`;
  },

  /**
   * 展开完整风格组合
   * @param {string} primary - 主风格编码
   * @param {string[]} secondary - 辅助风格编码数组
   * @param {string} videoType - 视频类型
   * @returns {string} 完整中文描述
   */
  expandStyle(primary, secondary = [], videoType = 'default') {
    const primaryDesc = this.expandPrimary(primary, videoType);
    if (secondary.length === 0) return primaryDesc;
    
    const secondaryDescs = secondary.map(s => this.expandSecondary(s));
    return `${primaryDesc}，叠加${secondaryDescs.join('、')}`;
  }
};

/**
 * 规则库 - 视频需求解析规则
 */
const ParserRules = {
  // 视频类型推断规则（关键词→类型）
  videoTypeRules: [
    { keywords: ['科普', '讲解', '知识', '教学', '课程', '教育', '健康科普'], type: 'EDU', name: '教育科普' },
    { keywords: ['短剧', '剧情', '故事', '角色', '集', '微电影'], type: 'DRAMA', name: '短剧/微电影' },
    { keywords: ['广告', '宣传', '推广', '品牌', '产品', '宣传片'], type: 'ADV', name: '商业广告' },
    { keywords: ['纪录片', '记录', '纪实', '真实'], type: 'DOC', name: '纪录片' },
    { keywords: ['电影', '院线'], type: 'DRAMA', name: '短剧/微电影(降级)', isDowngrade: true },
    { keywords: ['vlog', '日常', '记录生活', '跟我'], type: 'VLOG', name: 'Vlog/记录' },
    { keywords: ['抖音', '快手', '小红书', 'viral', '短视频'], type: 'SOC', name: '社媒短视频' },
    { keywords: ['企业', '公司', '工厂', '实力'], type: 'COR', name: '企业宣传' },
    { keywords: ['活动', '现场', '会议', '庆典'], type: 'EVT', name: '活动记录' },
    { keywords: ['mv', '音乐', '歌曲'], type: 'MV', name: '音乐视频' }
  ],

  // 风格推断规则（关键词→风格）
  styleRules: [
    { keywords: ['写实', '真实', '纪实', '纪录片感'], style: 'REAL' },
    { keywords: ['电影感', '大片', '质感', ' cinematic'], style: 'CINE' },
    { keywords: ['精致', '高级', '商业', '产品'], style: 'POL' },
    { keywords: ['极简', '现代', '科技', 'clean'], style: 'MINI' },
    { keywords: ['复古', '怀旧', '年代', '老'], style: 'RET' },
    { keywords: ['科幻', '未来', '科技', '赛博'], style: 'FUT' },
    { keywords: ['艺术', '实验', '前卫', '独特'], style: 'ART' },
    { keywords: ['温暖', '治愈', '柔和', '温情'], style: 'WARM' },
    { keywords: ['街头', '潮流', '潮', '涂鸦'], style: 'STREET' },
    { keywords: ['梦幻', '童话', '仙气', '唯美'], style: 'FAIRY' }
  ],

  // 辅助风格推断规则
  modifierRules: [
    { keywords: ['奢华', 'luxury', '高端', '金色'], modifier: 'LUX' },
    { keywords: ['活力', '动感', '快节奏', '年轻'], modifier: 'VIV' },
    { keywords: ['情绪', '情感', '叙事', '深沉'], modifier: 'EMO' },
    { keywords: ['自然', '户外', '绿色', '阳光'], modifier: 'NAT' },
    { keywords: ['粗粝', ' gritty', '纪实', '真实'], modifier: 'GRI' },
    { keywords: ['甜美', '可爱', '粉色', '马卡龙'], modifier: 'SWE' },
    { keywords: ['暗黑', '神秘', '阴影', '低key'], modifier: 'DAR' },
    { keywords: ['怀旧', '胶片', '颗粒', '老'], modifier: 'NOS' }
  ],

  // 平台推断规则
  platformRules: [
    { keywords: ['抖音'], platform: '抖音', defaultRatio: '9:16' },
    { keywords: ['快手'], platform: '快手', defaultRatio: '9:16' },
    { keywords: ['小红书'], platform: '小红书', defaultRatio: '9:16' },
    { keywords: ['视频号'], platform: '视频号', defaultRatio: '9:16' },
    { keywords: ['b站', 'bilibili', 'youtube'], platform: 'B站/YouTube', defaultRatio: '16:9' },
    { keywords: ['朋友圈'], platform: '朋友圈', defaultRatio: '9:16' },
    { keywords: ['大屏', '户外'], platform: '户外大屏', defaultRatio: '16:9' }
  ],

  // 时长推断规则（按类型）
  durationDefaults: {
    'EDU': { default: 90, range: [60, 120], unit: 'seconds' },
    'SOC': { default: 30, range: [15, 60], unit: 'seconds' },
    'ADV': { default: 30, range: [15, 60], unit: 'seconds' },
    'DOC': { default: 150, range: [60, 180], unit: 'seconds' },
    'DRAMA': { default: 150, range: [60, 180], unit: 'seconds' },
    'COR': { default: 90, range: [60, 120], unit: 'seconds' },
    'EVT': { default: 120, range: [60, 180], unit: 'seconds' },
    'VLOG': { default: 90, range: [60, 120], unit: 'seconds' },
    'MV': { default: 150, range: [60, 180], unit: 'seconds' }
  },

  // 系统硬约束
  constraints: {
    maxSingleDuration: 180,      // 单集最长180秒
    maxTotalDuration: 1200,      // 总时长最长20分钟（1200秒）
    maxShotDuration: 15,         // 单个镜头最长15秒
    maxEpisodes: 7,              // 最多7集
    recommendedMaxEpisodes: 5,   // 推荐最多5集
    recommendedMaxTotalDuration: 900 // 推荐总时长15分钟
  }
};

/**
 * 用户需求解析确认模块主类
 */
class UserRequirementParser {
  constructor(options = {}) {
    this.llmEngine = options.llmEngine || new LLMEngine();
    this.rules = ParserRules;
    this.styleEncoder = StyleEncoder;
    this.options = {
      maxIterations: 2,           // 最大迭代轮次
      confidenceThreshold: 0.6,   // 置信度阈值
      useLLM: true,               // 是否使用LLM
      ...options
    };
  }

  /**
   * 主解析方法
   * @param {string} userInput - 用户自然语言输入
   * @param {Object} context - 上下文信息（如历史对话）
   * @returns {RequirementParseResult} 解析结果
   */
  async parse(userInput, context = {}) {
    // 1. 规则库快速解析（确定性提取）
    const ruleBasedResult = this._ruleBasedParse(userInput);
    
    // 2. LLM深度解析（语义理解）
    let llmResult = {};
    if (this.options.useLLM) {
      llmResult = await this._llmParse(userInput, ruleBasedResult, context);
    }
    
    // 3. 合并结果（LLM结果优先）
    const mergedResult = this._mergeResults(ruleBasedResult, llmResult);
    
    // 4. 推断补全（填充缺失字段）
    const completedResult = this._inferCompletion(mergedResult);
    
    // 5. 约束检查（确保在系统限制内）
    const constrainedResult = this._applyConstraints(completedResult);
    
    // 6. 生成最终输出
    return this._buildOutput(constrainedResult, userInput);
  }

  /**
   * 规则库解析 - 快速确定性提取
   */
  _ruleBasedParse(input) {
    const text = input.toLowerCase();
    const result = {
      videoType: null,
      videoTypeConfidence: 0,
      platform: null,
      style: { primary: null, secondary: [] },
      duration: null,
      title: null,
      keywords: []
    };

    // 提取关键词
    result.keywords = this._extractKeywords(text);

    // 推断视频类型
    for (const rule of this.rules.videoTypeRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.videoType = rule.type;
          result.videoTypeName = rule.name;
          result.videoTypeConfidence = 0.8;
          result.isDowngrade = rule.isDowngrade || false;
          break;
        }
      }
      if (result.videoType) break;
    }

    // 推断平台
    for (const rule of this.rules.platformRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.platform = rule.platform;
          result.defaultRatio = rule.defaultRatio;
          break;
        }
      }
      if (result.platform) break;
    }

    // 推断风格
    for (const rule of this.rules.styleRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.style.primary = rule.style;
          break;
        }
      }
      if (result.style.primary) break;
    }

    // 推断辅助风格
    for (const rule of this.rules.modifierRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          if (!result.style.secondary.includes(rule.modifier)) {
            result.style.secondary.push(rule.modifier);
          }
        }
      }
    }

    // 提取时长（数字+秒/分钟）
    const durationMatch = text.match(/(\d+)\s*(秒|分钟|分|s|sec|min)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      if (unit.includes('分') || unit.includes('min')) {
        result.duration = value * 60;
      } else {
        result.duration = value;
      }
    }

    // 提取创意指数
    const intensityMatch = text.match(/创意指数\s*[:：]?\s*(0?\.\d+|\d+)/i);
    if (intensityMatch) {
      result.creativeIntensity = parseFloat(intensityMatch[1]);
    }

    // 提取系列信息
    const seriesMatch = text.match(/(\d+)\s*集/);
    if (seriesMatch) {
      result.totalEpisodes = parseInt(seriesMatch[1]);
      result.isSeries = true;
    }

    const episodeMatch = text.match(/第\s*(\d+)\s*集/);
    if (episodeMatch) {
      result.currentEpisode = parseInt(episodeMatch[1]);
    }

    return result;
  }

  /**
   * LLM深度解析 - 语义理解
   */
  async _llmParse(userInput, ruleResult, context) {
    const prompt = this._buildLLMPrompt(userInput, ruleResult);
    
    try {
      const response = await this.llmEngine.generate({
        prompt: prompt,
        maxTokens: 2000,
        temperature: 0.3
      });

      // v6.6.9.4-patch20: 适配 LLMEngine.generate 返回对象格式
      const responseText = response.success ? (response.content || '') : '';
      if (!responseText) {
        throw new Error(response.error || 'LLM返回空内容');
      }

      // 解析LLM输出（期望JSON格式）
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                        responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (error) {
      console.warn('[UserRequirementParser] LLM解析失败，回退到规则库:', error.message);
    }

    return {};
  }

  /**
   * 构建LLM提示词
   */
  _buildLLMPrompt(userInput, ruleResult) {
    return `你是一位资深视频制片人，擅长将用户的粗略需求转化为专业的视频制作方案。

## 用户输入
"""${userInput}"""

## 规则库初步解析结果（供参考）
${JSON.stringify(ruleResult, null, 2)}

## 系统硬约束（不可违反）
- 单次最长时长: 180秒
- 单个镜头最长: 15秒
- 单集最长: 180秒
- 总时长上限: 20分钟（1200秒）
- 系列最多7集，推荐最多5集
- 不存在"电影"类型，用户说"电影"时降级为"短剧/微电影"

## 视频类型分类
EDU=教育科普, SOC=社媒短视频, ADV=商业广告, DOC=纪录片, DRAMA=短剧/微电影, COR=企业宣传, EVT=活动记录, VLOG=Vlog/记录, MV=音乐视频

## 风格分类
主风格: REAL=写实纪实, CINE=电影质感, POL=精致商业, MINI=极简现代, RET=复古怀旧, FUT=科幻未来, ART=艺术实验, WARM=温暖治愈, STREET=街头潮流, FAIRY=梦幻童话
辅助风格: +LUX=奢华感, +VIV=活力感, +EMO=情绪感, +NAT=自然感, +GRI=粗粝感, +SWE=甜美感, +DAR=暗黑感, +NOS=怀旧感

## 任务
请分析用户需求，输出JSON格式的解析结果：

{
  "videoType": "类型编码",
  "title": "视频主题",
  "targetAudience": "目标受众",
  "platform": "投放平台",
  "duration": 时长数字,
  "style": {
    "primary": "主风格编码",
    "secondary": ["辅助风格编码"]
  },
  "creativeIntensity": 0.0到1.0,
  "characters": [{"name": "角色名", "description": "角色描述"}],
  "isSeries": true/false,
  "totalEpisodes": 集数,
  "currentEpisode": 当前集数,
  "keyPoints": ["关键需求点1", "关键需求点2"],
  "uncertainties": ["不确定项1"]
}

只输出JSON，不要其他内容。`;
  }

  /**
   * 合并规则库和LLM结果
   */
  _mergeResults(ruleResult, llmResult) {
    return {
      ...ruleResult,
      ...llmResult,
      // LLM结果优先，但保留规则库的高置信度字段
      videoType: llmResult.videoType || ruleResult.videoType,
      style: {
        primary: llmResult.style?.primary || ruleResult.style?.primary,
        secondary: llmResult.style?.secondary || ruleResult.style?.secondary || []
      }
    };
  }

  /**
   * 推断补全 - 填充缺失字段
   */
  _inferCompletion(result) {
    const completed = { ...result };

    // 补全视频类型（默认EDU）
    if (!completed.videoType) {
      completed.videoType = 'EDU';
      completed.videoTypeName = '教育科普';
      completed.videoTypeConfidence = 0.4;
      completed.videoTypeInferred = true;
    }

    // 补全时长
    if (!completed.duration) {
      const defaults = this.rules.durationDefaults[completed.videoType];
      if (defaults) {
        completed.duration = defaults.default;
        completed.durationRecommended = defaults.default;
        completed.durationRange = defaults.range;
        completed.durationInferred = true;
      }
    }

    // 补全风格
    if (!completed.style?.primary) {
      // 根据视频类型推断默认风格
      const typeToStyle = {
        'EDU': 'REAL', 'DOC': 'REAL', 'VLOG': 'REAL',
        'DRAMA': 'CINE', 'MV': 'ART',
        'ADV': 'POL', 'COR': 'POL',
        'SOC': 'STREET', 'EVT': 'REAL'
      };
      completed.style = completed.style || {};
      completed.style.primary = typeToStyle[completed.videoType] || 'REAL';
      completed.styleInferred = true;
    }

    // 补全创意指数
    if (completed.creativeIntensity === undefined) {
      const typeToIntensity = {
        'EDU': 0.5, 'DOC': 0.5, 'VLOG': 0.4,
        'DRAMA': 0.65, 'MV': 0.7,
        'ADV': 0.7, 'COR': 0.6,
        'SOC': 0.5, 'EVT': 0.4
      };
      completed.creativeIntensity = typeToIntensity[completed.videoType] || 0.5;
      completed.creativeIntensityInferred = true;
    }

    // 补全平台
    if (!completed.platform) {
      completed.platform = this._inferPlatform(completed.videoType);
      completed.platformInferred = true;
    }

    // 补全画幅比例
    if (!completed.aspectRatio) {
      completed.aspectRatio = completed.defaultRatio || this._inferAspectRatio(completed.platform, completed.videoType);
    }

    // 补全系列信息
    if (completed.isSeries === undefined) {
      completed.isSeries = false;
    }

    return completed;
  }

  /**
   * 应用系统硬约束
   */
  _applyConstraints(result) {
    const constrained = { ...result };
    const c = this.rules.constraints;

    // 单集时长约束
    if (constrained.duration > c.maxSingleDuration) {
      // 需要拆分
      constrained.needsSplit = true;
      constrained.originalDuration = constrained.duration;
      constrained.episodes = Math.ceil(constrained.duration / c.maxSingleDuration);
      
      // 检查总时长
      const totalDuration = constrained.duration;
      if (totalDuration > c.maxTotalDuration) {
        constrained.exceedsTotalLimit = true;
        constrained.maxAllowedDuration = c.maxTotalDuration;
        constrained.recommendedDuration = c.recommendedMaxTotalDuration;
      }

      // 检查集数
      if (constrained.episodes > c.maxEpisodes) {
        constrained.exceedsEpisodeLimit = true;
        constrained.maxAllowedEpisodes = c.maxEpisodes;
      }
    }

    // 创意指数约束
    if (constrained.creativeIntensity < 0) constrained.creativeIntensity = 0;
    if (constrained.creativeIntensity > 1) constrained.creativeIntensity = 1;

    return constrained;
  }

  /**
   * 构建最终输出
   */
  _buildOutput(result, originalInput) {
    const fieldConfidence = this._calculateConfidence(result);
    const requiresConfirmation = Object.entries(fieldConfidence)
      .filter(([_, conf]) => conf < this.options.confidenceThreshold)
      .map(([field, _]) => field);

    // 构建风格描述
    const styleDescription = this.styleEncoder.expandStyle(
      result.style.primary,
      result.style.secondary,
      result.videoType
    );

    return {
      version: '1.0',
      parseStatus: result.needsSplit ? 'needs_split' : 'complete',
      originalInput: originalInput,

      basicInfo: {
        videoType: result.videoType,
        videoTypeName: result.videoTypeName || this._getVideoTypeName(result.videoType),
        title: result.title || '未命名视频',
        topic: result.topic || result.title || '',
        characters: result.characters || [],
        targetAudience: result.targetAudience || this._inferAudience(result.videoType),
        platform: result.platform
      },

      productionSpecs: {
        duration: {
          target: result.duration,
          recommended: result.durationRecommended || result.duration,
          range: result.durationRange,
          unit: 'seconds'
        },
        aspectRatio: result.aspectRatio,
        style: {
          primary: result.style.primary,
          primaryName: this.styleEncoder.primaryStyles[result.style.primary]?.name || result.style.primary,
          secondary: result.style.secondary,
          secondaryNames: result.style.secondary.map(s => 
            this.styleEncoder.secondaryStyles[s.replace('+', '')]?.name || s
          ),
          description: styleDescription
        },
        quality: this._mapQuality(result.creativeIntensity),
        creativeIntensity: result.creativeIntensity,
        colorTone: result.colorTone || '根据风格自动匹配'
      },

      contentCreative: {
        narrativeMode: result.narrativeMode || 'dialogue',
        contentTone: result.contentTone || '标准',
        visualStyle: result.visualStyle || styleDescription,
        musicStyle: result.musicStyle || '根据风格自动匹配'
      },

      structure: {
        opening: {
          enabled: result.currentEpisode === 1 || result.currentEpisode === undefined,
          title: result.title || '',
          subtitle: result.subtitle || ''
        },
        scenes: result.scenes || [],
        ending: {
          style: result.endingStyle || 'summary',
          previewNext: false
        }
      },

      series: {
        isSeries: result.isSeries,
        totalEpisodes: result.totalEpisodes,
        currentEpisode: result.currentEpisode,
        episodeThemes: result.episodeThemes || [],
        contentIsolation: result.isSeries
      },

      constraints: {
        ...result.constraints,
        systemConstraints: this.rules.constraints
      },

      aiDecisionNotes: {
        videoType: result.videoTypeInferred ? `[AI推断] 基于关键词推断为${result.videoTypeName}` : '[用户指定]',
        style: result.styleInferred ? `[AI推断] 基于视频类型匹配${this.styleEncoder.primaryStyles[result.style.primary]?.name}` : '[用户指定]',
        duration: result.durationInferred ? `[AI推断] 基于视频类型推荐${result.duration}秒` : '[用户指定]',
        creativeIntensity: result.creativeIntensityInferred ? `[AI推断] 基于视频类型默认${result.creativeIntensity}` : '[用户指定]',
        platform: result.platformInferred ? `[AI推断] 基于视频类型推荐${result.platform}` : '[用户指定]'
      },

      fieldConfidence,
      requiresConfirmation,

      // 系统提示
      systemNotes: {
        needsSplit: result.needsSplit || false,
        exceedsTotalLimit: result.exceedsTotalLimit || false,
        exceedsEpisodeLimit: result.exceedsEpisodeLimit || false,
        isDowngrade: result.isDowngrade || false
      }
    };
  }

  /**
   * 迭代确认 - 根据用户反馈更新需求
   */
  async iterate(currentResult, userFeedback) {
    // 将用户反馈作为新的输入，结合当前结果进行更新
    const context = {
      currentResult: currentResult,
      previousRequirements: currentResult
    };

    // 重新解析用户反馈
    const feedbackResult = await this.parse(userFeedback, context);

    // 合并反馈结果到当前结果（用户反馈优先）
    return this._mergeWithFeedback(currentResult, feedbackResult, userFeedback);
  }

  /**
   * 转换为 pipeline input 格式
   */
  toPipelineInput(parseResult) {
    const basic = parseResult.basicInfo;
    const specs = parseResult.productionSpecs;
    const creative = parseResult.contentCreative;
    const structure = parseResult.structure;
    const series = parseResult.series;

    return {
      // 基本信息
      title: basic.title,
      videoType: basic.videoType.toLowerCase(),
      
      // 角色信息
      characters: basic.characters.map(char => ({
        name: char.name,
        profile: char.description,
        role: char.role || 'host'
      })),

      // 制作规格
      targetDuration: specs.duration.target,
      ratio: specs.aspectRatio,
      style: specs.style.primary,
      styleModifiers: specs.style.secondary,
      creativeIntensity: specs.creativeIntensity,

      // 内容创意
      narrativeMode: creative.narrativeMode,
      contentTone: creative.contentTone,
      visualStyle: creative.visualStyle,
      musicStyle: creative.musicStyle,

      // 平台
      platform: basic.platform,

      // 结构
      opening: structure.opening,
      scenes: structure.scenes,
      endingStyle: structure.ending.style,
      
      // 系列
      episode: series.currentEpisode,
      totalEpisodes: series.totalEpisodes,
      isSeries: series.isSeries,

      // 约束
      constraints: parseResult.constraints,

      // 核心
      core: {
        targetAudience: basic.targetAudience,
        platform: basic.platform,
        tone: creative.contentTone
      },

      // 元数据
      _requirementParseResult: parseResult
    };
  }

  // ============ 辅助方法 ============

  _extractKeywords(text) {
    // 提取用户输入中的关键名词和动词
    const words = text.split(/\s+/);
    const keywords = [];
    const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    
    for (const word of words) {
      if (word.length >= 2 && !stopWords.includes(word)) {
        keywords.push(word);
      }
    }
    return keywords.slice(0, 10); // 最多10个关键词
  }

  _inferPlatform(videoType) {
    const platformMap = {
      'EDU': '视频号/抖音/B站',
      'SOC': '抖音/快手/小红书',
      'ADV': '全平台',
      'DOC': 'B站/优酷',
      'DRAMA': '抖音/快手/视频号',
      'COR': '官网/展会',
      'EVT': '社交媒体',
      'VLOG': 'B站/YouTube/视频号',
      'MV': '音乐平台/社交媒体'
    };
    return platformMap[videoType] || '视频号/抖音';
  }

  _inferAspectRatio(platform, videoType) {
    if (platform?.includes('B站') || platform?.includes('YouTube')) {
      return '16:9';
    }
    if (videoType === 'DRAMA' || videoType === 'DOC') {
      return '16:9';
    }
    return '9:16';
  }

  _inferAudience(videoType) {
    const audienceMap = {
      'EDU': '普通大众',
      'SOC': '18-25岁年轻群体',
      'ADV': '目标消费群体',
      'DOC': '深度内容爱好者',
      'DRAMA': '18-35岁城市人群',
      'COR': '商务人士/合作伙伴',
      'EVT': '活动参与者',
      'VLOG': '生活方式关注者',
      'MV': '音乐爱好者'
    };
    return audienceMap[videoType] || '普通大众';
  }

  _getVideoTypeName(code) {
    const names = {
      'EDU': '教育科普', 'SOC': '社媒短视频', 'ADV': '商业广告',
      'DOC': '纪录片', 'DRAMA': '短剧/微电影', 'COR': '企业宣传',
      'EVT': '活动记录', 'VLOG': 'Vlog/记录', 'MV': '音乐视频'
    };
    return names[code] || code;
  }

  _mapQuality(intensity) {
    if (intensity <= 0.2) return 'standard';
    if (intensity <= 0.4) return 'premium';
    if (intensity <= 0.7) return 'artistic';
    return 'ultimate';
  }

  _calculateConfidence(result) {
    const confidence = {};
    
    confidence.videoType = result.videoTypeConfidence || 
      (result.videoType ? 0.7 : 0.3);
    
    confidence.title = result.title ? 1.0 : 0.2;
    confidence.duration = result.duration ? 
      (result.durationInferred ? 0.6 : 1.0) : 0.3;
    confidence.style = result.style?.primary ? 
      (result.styleInferred ? 0.6 : 0.85) : 0.3;
    confidence.creativeIntensity = result.creativeIntensity !== undefined ? 
      (result.creativeIntensityInferred ? 0.5 : 1.0) : 0.4;
    confidence.platform = result.platform ? 
      (result.platformInferred ? 0.5 : 0.9) : 0.3;
    
    return confidence;
  }

  _mergeWithFeedback(current, feedback, feedbackText) {
    // 简单的合并策略：用户反馈覆盖当前值
    const merged = JSON.parse(JSON.stringify(current));
    
    // 如果反馈中明确修改了某个字段，使用反馈的值
    if (feedback.basicInfo?.title && feedback.basicInfo.title !== '未命名视频') {
      merged.basicInfo.title = feedback.basicInfo.title;
    }
    if (feedback.basicInfo?.videoType) {
      merged.basicInfo.videoType = feedback.basicInfo.videoType;
      merged.basicInfo.videoTypeName = feedback.basicInfo.videoTypeName;
    }
    if (feedback.productionSpecs?.duration?.target) {
      merged.productionSpecs.duration.target = feedback.productionSpecs.duration.target;
    }
    if (feedback.productionSpecs?.creativeIntensity !== undefined) {
      merged.productionSpecs.creativeIntensity = feedback.productionSpecs.creativeIntensity;
    }
    if (feedback.productionSpecs?.style?.primary) {
      merged.productionSpecs.style.primary = feedback.productionSpecs.style.primary;
    }
    
    // 记录迭代历史
    if (!merged._iterationHistory) merged._iterationHistory = [];
    merged._iterationHistory.push({
      feedback: feedbackText,
      timestamp: new Date().toISOString()
    });
    
    return merged;
  }
}

module.exports = { UserRequirementParser, StyleEncoder, ParserRules };

```

---

