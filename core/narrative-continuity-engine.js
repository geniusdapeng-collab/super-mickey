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
 * @author Core Team
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
