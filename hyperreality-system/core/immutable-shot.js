'use strict';

/**
 * 不可变镜头对象 - 函数式数据管理
 * 超现实系统适配版 v1.0
 *
 * 适配超现实系统镜头结构：
 * - shotId, sceneType, timing, scene, mood, prompt, dialogue, camera, lighting, etc.
 */

const crypto = require('crypto');

const REQUIRED_FIELDS = Object.freeze(['shotId', 'sceneType', 'timing']);

const DEFAULT_VALUES = Object.freeze({
  duration: 20,
  timing: { start: 0, duration: 20, end: 20 },
});

const MUTABLE_FIELDS = Object.freeze([
  'prompt', 'dialogue', 'mouthAction', 'camera', 'lighting', 'mood', 'action',
  'character', 'characterRef', 'timeline', 'backgroundSound', 'audioLayer', 'titleOverlay',
  'negativeConstraints', 'styleConstraints', 'portraits', 'characterCards', 'metadata'
]);

function deepFreeze(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name];
    if (value !== null && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

function deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  if (typeof obj !== 'object') return obj;
  const cloned = {};
  for (const key of Object.keys(obj)) cloned[key] = deepClone(obj[key]);
  return cloned;
}

function computeHash(data) {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
}

function nowISO() {
  return new Date().toISOString();
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function detectChanges(oldObj, newObj, prefix = '') {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of allKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    if (!(key in (oldObj || {}))) {
      changes.push({ field: fullKey, type: 'added', oldValue: undefined, newValue: deepClone(newVal) });
    } else if (!(key in (newObj || {}))) {
      changes.push({ field: fullKey, type: 'removed', oldValue: deepClone(oldVal), newValue: undefined });
    } else if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) {
      changes.push(...detectChanges(oldVal, newVal, fullKey));
    } else if (!deepEqual(oldVal, newVal)) {
      changes.push({ field: fullKey, type: 'modified', oldValue: deepClone(oldVal), newValue: deepClone(newVal) });
    }
  }
  return changes;
}

function truncate(value, maxLen = 40) {
  if (value === null || value === undefined) return String(value);
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length <= maxLen ? str : str.substring(0, maxLen) + '...';
}

class ImmutableShot {
  constructor(data, options = {}) {
    if (!data || typeof data !== 'object') throw new TypeError('[ImmutableShot] data must be object');
    const { stageId = 'UNKNOWN', reason = 'initial', history = [] } = options;

    for (const field of REQUIRED_FIELDS) {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        throw new TypeError(`[ImmutableShot] required field missing: ${field}`);
      }
    }

    const mergedData = { ...DEFAULT_VALUES, ...data };
    this._data = deepFreeze(deepClone(mergedData));
    this._shotId = data.shotId || data.id || '';
    this._hash = computeHash(this._data);
    this._version = history.length > 0 ? history.length : 1;
    this._stageId = stageId;
    this._createdAt = nowISO();
    this._updatedAt = nowISO();
    this._history = [
      ...history,
      ...(history.length === 0 ? [{ version: 1, stageId, reason, hash: this._hash, timestamp: this._createdAt, changes: [] }] : []),
    ];
    this._mutations = this._history.length > 1 ? this._history.length - 1 : 0;
  }

  get data() { return deepClone(this._data); }
  get shotId() { return this._shotId; }
  get hash() { return this._hash; }
  get version() { return this._version; }
  get mutations() { return this._mutations; }
  get stageId() { return this._stageId; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  update(updater, options = {}) {
    if (typeof updater !== 'function') throw new TypeError('[ImmutableShot] updater must be function');
    const { stageId = this._stageId, reason = 'update' } = options;

    const draft = deepClone(this._data);
    updater(draft);

    for (const field of REQUIRED_FIELDS) {
      if (draft[field] === undefined || draft[field] === null) {
        throw new Error(`[ImmutableShot] update cannot delete required field: ${field}`);
      }
    }

    const changes = detectChanges(this._data, draft);
    if (changes.length === 0) return this;

    const newHash = computeHash(draft);
    const newHistoryEntry = {
      version: this._version + 1, stageId, reason, hash: newHash, timestamp: nowISO(),
      changes: changes.map(c => ({ field: c.field, type: c.type, ...(c.type !== 'added' && { from: truncate(c.oldValue) }), ...(c.type !== 'removed' && { to: truncate(c.newValue) }) })),
    };

    const newShot = new ImmutableShot(draft, { stageId, reason, history: [...this._history, newHistoryEntry] });
    newShot._version = this._version + 1;
    newShot._mutations = this._mutations + 1;
    newShot._createdAt = this._createdAt;
    newShot._history = [...this._history, newHistoryEntry];
    return newShot;
  }

  set(field, value, options = {}) {
    if (typeof field !== 'string' || field.trim().length === 0) throw new TypeError('[ImmutableShot] field must be non-empty string');
    return this.update(draft => { draft[field] = value; }, options);
  }

  setMany(fields, options = {}) {
    if (!fields || typeof fields !== 'object') throw new TypeError('[ImmutableShot] fields must be object');
    return this.update(draft => { for (const [key, value] of Object.entries(fields)) draft[key] = value; }, options);
  }

  getHistory() { return deepClone(this._history); }

  diff(otherShot) {
    if (!(otherShot instanceof ImmutableShot)) throw new TypeError('[ImmutableShot] diff param must be ImmutableShot');
    return detectChanges(this._data, otherShot._data);
  }

  toJSON() {
    return { ...deepClone(this._data), _meta: { shotId: this._shotId, hash: this._hash, version: this._version, stageId: this._stageId, createdAt: this._createdAt, updatedAt: this._updatedAt, mutations: this._mutations } };
  }

  validate() {
    const errors = [];
    for (const field of REQUIRED_FIELDS) {
      if (this._data[field] === undefined || this._data[field] === null) errors.push(`required field missing: ${field}`);
    }
    return { valid: errors.length === 0, errors };
  }

  get(field, defaultValue) {
    return field in this._data ? deepClone(this._data[field]) : defaultValue;
  }

  has(field) { return field in this._data; }
}

class ImmutableShotArray {
  constructor(shots = []) {
    if (!Array.isArray(shots)) throw new TypeError('[ImmutableShotArray] shots must be array');
    for (const shot of shots) {
      if (!(shot instanceof ImmutableShot)) throw new TypeError('[ImmutableShotArray] all elements must be ImmutableShot');
    }
    this._shots = Object.freeze([...shots]);
  }

  get shots() { return [...this._shots]; }
  get length() { return this._shots.length; }

  getById(shotId) { return this._shots.find(s => s.shotId === shotId) || null; }
  getBySequence(seq) { return this._shots.find(s => s.sequence === seq) || null; }
  at(index) { return this._shots[index]; }
  find(predicate) { return this._shots.find(predicate); }

  filter(predicate) { return new ImmutableShotArray(this._shots.filter(predicate)); }

  map(mapper) {
    if (typeof mapper !== 'function') throw new TypeError('[ImmutableShotArray] mapper must be function');
    const mapped = this._shots.map(mapper);
    for (const s of mapped) if (!(s instanceof ImmutableShot)) throw new TypeError('[ImmutableShotArray] mapper must return ImmutableShot');
    return new ImmutableShotArray(mapped);
  }

  forEach(callback) { this._shots.forEach(callback); }

  updateShot(shotId, updater, options = {}) {
    const index = this._shots.findIndex(s => s.shotId === shotId);
    if (index === -1) throw new Error(`[ImmutableShotArray] shot not found: ${shotId}`);
    const updatedShot = this._shots[index].update(updater, options);
    const newShots = [...this._shots];
    newShots[index] = updatedShot;
    return new ImmutableShotArray(newShots);
  }

  addShot(shot) {
    if (!(shot instanceof ImmutableShot)) throw new TypeError('[ImmutableShotArray] shot must be ImmutableShot');
    return new ImmutableShotArray([...this._shots, shot]);
  }

  removeShot(shotId) {
    const filtered = this._shots.filter(s => s.shotId !== shotId);
    if (filtered.length === this._shots.length) throw new Error(`[ImmutableShotArray] shot not found to remove: ${shotId}`);
    return new ImmutableShotArray(filtered);
  }

  validateAll() {
    const errors = [];
    for (const shot of this._shots) {
      const result = shot.validate();
      if (!result.valid) errors.push({ shotId: shot.shotId, errors: result.errors });
    }
    return { valid: errors.length === 0, errors };
  }

  toJSON() { return this._shots.map(s => s.toJSON()); }
  toArray() { return [...this._shots]; }
}

class ShotFactory {
  static create(data, stageId = 'FACTORY', options = {}) {
    if (!data || typeof data !== 'object') throw new TypeError('[ShotFactory] data must be object');
    return new ImmutableShot(data, { stageId, ...options });
  }

  static createArray(shots, stageId = 'FACTORY', options = {}) {
    if (!Array.isArray(shots)) throw new TypeError('[ShotFactory] shots must be array');
    const immutableShots = shots.map((data, index) => {
      if (!data.shotId) throw new TypeError(`[ShotFactory] shot ${index} missing shotId`);
      return new ImmutableShot(data, { stageId, ...options });
    });
    return new ImmutableShotArray(immutableShots);
  }

  static wrapStageOutput(shots, stageId, options = {}) {
    if (!stageId || typeof stageId !== 'string') throw new TypeError('[ShotFactory] stageId must be non-empty string');
    return ShotFactory.createArray(shots, stageId, { reason: 'stage-output', ...options });
  }
}

module.exports = { ImmutableShot, ImmutableShotArray, ShotFactory, REQUIRED_FIELDS, DEFAULT_VALUES, MUTABLE_FIELDS, deepFreeze, deepClone, computeHash, detectChanges };

if (require.main === module) {
  (function selfTest() {
    console.log('\n🧪 ImmutableShot / ImmutableShotArray / ShotFactory 集成测试');
    let passed = 0, failed = 0;
    function assert(condition, message) {
      if (condition) { console.log(` ✅ ${message}`); passed++; }
      else { console.error(` ❌ ${message}`); failed++; }
    }

    const shot = new ImmutableShot({
      shotId: 'SC00', sceneType: 'opening', timing: { start: 0, duration: 36, end: 36 },
      scene: 'Nirath星球', prompt: 'wide shot...', dialogue: [{ speaker: '小G', text: '你好' }]
    }, { stageId: 'Layer2', reason: 'initial' });

    assert(shot.shotId === 'SC00', 'shotId correct');
    assert(shot.version === 1, 'version 1');
    assert(shot.mutations === 0, 'mutations 0');

    const updated = shot.update(draft => { draft.prompt = 'updated prompt'; }, { stageId: 'Layer2', reason: 'optimize' });
    assert(updated !== shot, 'update returns new instance');
    assert(updated.prompt === 'updated prompt', 'prompt updated');
    assert(shot.prompt === 'wide shot...', 'original unchanged');
    assert(updated.version === 2, 'version 2');
    assert(updated.mutations === 1, 'mutations 1');

    const history = updated.getHistory();
    assert(history.length === 2, 'history length 2');
    assert(history[1].stageId === 'Layer2', 'history stageId correct');

    const arr = new ImmutableShotArray([shot]);
    assert(arr.length === 1, 'array length 1');

    const arrUpdated = arr.updateShot('SC00', draft => { draft.scene = 'modified'; }, { stageId: 'Layer3' });
    assert(arrUpdated.getById('SC00').scene === 'modified', 'array update works');
    assert(arr.getById('SC00').scene === 'Nirath星球', 'original array unchanged');

    const factoryArr = ShotFactory.wrapStageOutput([
      { shotId: 'S01', sceneType: 'establishing', timing: { start: 36, duration: 30, end: 66 }, scene: '场景1' },
      { shotId: 'S02', sceneType: 'conflict', timing: { start: 66, duration: 39, end: 105 }, scene: '场景2' },
    ], 'Layer2');
    assert(factoryArr.length === 2, 'factory array length 2');
    assert(factoryArr.at(0).stageId === 'Layer2', 'factory stageId correct');

    console.log(`\n🏁 完成: 通过=${passed}, 失败=${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}
