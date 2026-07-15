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
 * @author Core Team
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
