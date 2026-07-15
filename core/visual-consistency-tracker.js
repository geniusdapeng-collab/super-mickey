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
 * @author Core Team
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
