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
 * @author Core Team
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
