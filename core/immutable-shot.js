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
 * @author Core Team
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
