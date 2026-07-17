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
 * @author Core Team
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
