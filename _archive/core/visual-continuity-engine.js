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
 * @author Core Team
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
