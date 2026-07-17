/**
 * Stage 性能基线模块 (Stage Performance Baseline) v1.0
 * v6.2-patch68: 耗时基线记录与报警系统
 * 
 * 职责：
 * 1. 记录每次各Stage真实耗时
 * 2. 偏离历史基线50%自动报警
 * 3. 关键Stage计算量验证（防止空转/短路）
 * 
 * 约束：
 * - 纯本地执行时基线不触发（本地Stage本身耗时极短）
 * - 仅在疑似"预期应有外部API调用但实际未调用"时报警
 * 
 * @version v1.0 (v6.2-patch68)
 */

const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', 'output', '.stage-baseline.json');

// 各Stage的合理耗时基线（毫秒）——纯本地模式
const LOCAL_BASELINES = {
  'STAGE-0': 50,      // Mock数据清理
  'STAGE-1': 1,       // PRD生成
  'STAGE-2': 1,       // 需求对齐
  'STAGE-3': 1,       // Schema校验
  'STAGE-4': 5,       // 角色系统
  'STAGE-5': 10,      // 剧本生成（StoryCraft本地模板）
  'STAGE-5.5': 1,     // FPV决策
  'STAGE-6': 5,       // 时长分配
  'STAGE-7': 10,      // 故事板生成
  'STAGE-7.2': 1,     // 主动性注入
  'STAGE-7.3': 1,     // Narration精简
  'STAGE-7.4': 1,     // 时长校准
  'STAGE-7.5': 50,    // 片头生成（含字符串拼接）
  'STAGE-8': 5,       // 故事板校验
  'STAGE-8.5': 5,     // 五要素检查
  'STAGE-9': 10,      // 运镜系统
  'STAGE-10': 1,      // 连续性检查
  'STAGE-10.5': 1,    // 前置验证
  'STAGE-11': 20,     // 渲染核心（字符串拼接 + smartTrim）
  'STAGE-11.5': 1,    // Prompt质量闸门
  'STAGE-12': 1,      // 合规检查
  'STAGE-13': 3,      // 前置验证
  'STAGE-14': 1,      // 风格注入
  'STAGE-15': 1,      // 后期规则
  'STAGE-16': 5,      // 最终输出
  'STAGE-16-DIRECTOR-OPTIMIZE': 50,  // 导演优化
  'STAGE-17': 50      // 导演-编剧闭环
};

class StagePerformanceBaseline {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.alertThreshold = options.alertThreshold || 0.50; // 偏离50%报警
    this.minAlertMs = options.minAlertMs || 500; // 仅对耗时>500ms的Stage报警（避免本地抖动）
    this.baselines = this._loadBaselines();
    this.currentRun = {};
    this.alerts = [];
  }

  _loadBaselines() {
    try {
      if (fs.existsSync(BASELINE_FILE)) {
        const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
        return data.baselines || {};
      }
    } catch (e) {
      console.error(`[Baseline] 加载基线失败: ${e.message}`);
    }
    return {};
  }

  _saveBaselines() {
    try {
      const dir = path.dirname(BASELINE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(BASELINE_FILE, JSON.stringify({
        lastUpdate: new Date().toISOString(),
        baselines: this.baselines,
        version: 'v1.0'
      }, null, 2));
    } catch (e) {
      console.error(`[Baseline] 保存基线失败: ${e.message}`);
    }
  }

  /**
   * 记录Stage耗时
   */
  record(stageName, durationMs) {
    if (!this.enabled) return { alert: null };

    this.currentRun[stageName] = durationMs;

    // 检查是否低于本地基线（疑似短路/空转）
    const localBaseline = LOCAL_BASELINES[stageName];
    if (localBaseline !== undefined && durationMs < 1) {
      return {
        alert: {
          type: 'suspiciously_fast',
          stage: stageName,
          duration: durationMs,
          baseline: localBaseline,
          message: `[性能报警] ${stageName} 耗时仅${durationMs}ms，低于本地基线${localBaseline}ms，疑似空转或短路`
        }
      };
    }

    // 检查历史基线偏离
    const history = this.baselines[stageName];
    if (history && history.avg > this.minAlertMs) {
      const deviation = Math.abs(durationMs - history.avg) / history.avg;
      if (deviation > this.alertThreshold) {
        return {
          alert: {
            type: 'baseline_deviation',
            stage: stageName,
            duration: durationMs,
            baseline: history.avg,
            deviation: Math.round(deviation * 100) + '%',
            message: `[性能报警] ${stageName} 耗时${durationMs}ms，偏离历史基线${history.avg}ms ${Math.round(deviation * 100)}%`
          }
        };
      }
    }

    return { alert: null };
  }

  /**
   * 关键Stage计算量验证
   * @param {String} stageName
   * @param {Object} metrics - 计算量指标
   * @param {Number} metrics.shotCount - 处理的镜头数
   * @param {Number} metrics.charCount - 处理的字符数
   * @param {Number} metrics.iterationCount - 迭代次数
   */
  validateComputation(stageName, metrics = {}) {
    const { shotCount = 0, charCount = 0, iterationCount = 0 } = metrics;
    const issues = [];

    // Stage 11: 渲染核心——必须真实遍历所有镜头
    if (stageName === 'STAGE-11' || stageName.includes('render')) {
      if (shotCount === 0) {
        issues.push({
          severity: 'error',
          message: `Stage 11 渲染核心计算量验证失败：遍历镜头数为0，疑似未真实执行渲染`
        });
      }
      if (charCount < shotCount * 50) {
        issues.push({
          severity: 'warning',
          message: `Stage 11 字符处理量过低(${charCount})，预期至少${shotCount * 50}字符（每镜50+）`
        });
      }
    }

    // Stage 5: 剧本生成——必须产出有效场景
    if (stageName === 'STAGE-5' || stageName.includes('script')) {
      if (shotCount === 0) {
        issues.push({
          severity: 'error',
          message: `Stage 5 剧本生成计算量验证失败：产出场景数为0，疑似未真实生成剧本`
        });
      }
    }

    // Stage 17: 导演-编剧闭环——必须执行至少1轮评估
    if (stageName === 'STAGE-17' || stageName.includes('director-screenwriter')) {
      if (iterationCount === 0) {
        issues.push({
          severity: 'warning',
          message: `Stage 17 导演-编剧闭环计算量验证：迭代轮次为0，可能为基线直接通过`
        });
      }
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * 结束本次运行，更新基线
   */
  finalize() {
    if (!this.enabled) return { alerts: [], summary: 'disabled' };

    // 更新历史基线（指数移动平均）
    for (const [stage, duration] of Object.entries(this.currentRun)) {
      const existing = this.baselines[stage];
      if (existing) {
        existing.avg = Math.round((existing.avg * 0.7 + duration * 0.3) * 10) / 10;
        existing.count++;
      } else {
        this.baselines[stage] = {
          avg: duration,
          count: 1,
          firstSeen: new Date().toISOString()
        };
      }
    }

    this._saveBaselines();

    // 生成摘要
    const totalDuration = Object.values(this.currentRun).reduce((a, b) => a + b, 0);
    const suspiciousStages = Object.entries(this.currentRun)
      .filter(([name, d]) => {
        const baseline = LOCAL_BASELINES[name];
        return baseline !== undefined && d < baseline * 0.5 && d < 1;
      })
      .map(([name]) => name);

    return {
      alerts: this.alerts,
      summary: {
        totalDuration,
        stagesRecorded: Object.keys(this.currentRun).length,
        suspiciousStages,
        baselineUpdated: true
      }
    };
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const lines = [];
    lines.push('');
    lines.push('=' .repeat(60));
    lines.push('📊 Stage性能基线报告 (v6.2-patch68)');
    lines.push('=' .repeat(60));

    for (const [stage, duration] of Object.entries(this.currentRun)) {
      const baseline = LOCAL_BASELINES[stage];
      const history = this.baselines[stage];
      const status = baseline !== undefined && duration < 1 ? '⚠️ 疑似空转' : '✅';
      lines.push(`  ${status} ${stage}: ${duration}ms | 本地基线: ${baseline || 'N/A'}ms | 历史基线: ${history ? history.avg + 'ms' : 'N/A'}`);
    }

    lines.push('=' .repeat(60));
    return lines.join('\n');
  }
}

module.exports = { StagePerformanceBaseline };
// v6.2-patch68: Stage性能基线模块
