/**
 * ThemeDiversityTestEngine - 主题多样性测试引擎
 * Phase 2 实现：自动化测试 + 对抗测试
 * v2.2.0-phase2
 */

const { TestSuiteGenerator } = require('./test-suite-generator');
const { AuditReporter } = require('./audit-reporter');
const ThemeConfig = require('../../config/theme-config');

// 导入各类型校验器
const EduValidator = require('./validators/edu-validator');
const DocValidator = require('./validators/doc-validator');
const FamilyValidator = require('./validators/family-validator');
const MarketingValidator = require('./validators/marketing-validator');
const CineValidator = require('./validators/cine-validator');
const ArtValidator = require('./validators/art-validator');
const VfxValidator = require('./validators/vfx-validator');

const VALIDATORS = {
  EDU: EduValidator,
  DOC: DocValidator,
  FAMILY: FamilyValidator,
  MARKETING: MarketingValidator,
  CINE: CineValidator,
  ART: ArtValidator,
  VFX: VfxValidator
};

class ThemeDiversityTestEngine {
  constructor(options = {}) {
    this.generator = new TestSuiteGenerator();
    this.reporter = new AuditReporter();
    this.types = Object.keys(ThemeConfig.types || {});
    this.results = [];
    this.verbose = options.verbose || false;
  }

  async runAllTests(options = {}) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     Theme Diversity Test Engine v2.2.0-phase2              ║');
    console.log('║     主题多样性自动化测试引擎                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const testTypes = options.types || this.types;
    const modes = options.modes || ['normal', 'adversarial', 'boundary'];
    
    console.log(`📋 测试类型: ${testTypes.join(', ')}`);
    console.log(`🎯 测试模式: ${modes.join(', ')}`);
    console.log('');

    for (const type of testTypes) {
      for (const mode of modes) {
        await this._runTypeTests(type, mode);
      }
    }

    return this._generateReport();
  }

  async _runTypeTests(type, mode) {
    const tests = this.generator.generate(type, mode);
    const Validator = VALIDATORS[type];
    
    if (!Validator) {
      console.warn(`⚠️  类型 ${type} 没有专用校验器，跳过`);
      return;
    }

    const validator = new Validator();
    const modeEmoji = { normal: '✅', adversarial: '⚔️', boundary: '📐' };
    
    console.log(`${modeEmoji[mode]} [${type}] ${mode} 测试: ${tests.length} 用例`);

    for (const test of tests) {
      const startTime = Date.now();
      let result;

      try {
        // 运行校验
        const validation = validator.validate(test.input, test.expectations);
        
        // 检查预期行为
        const passed = this._checkExpectation(validation, test);
        
        result = {
          type,
          mode,
          testId: test.id,
          passed,
          duration: Date.now() - startTime,
          validation,
          expectedBehavior: test.expectedBehavior,
          severity: test.severity || 'P2'
        };

        const status = passed ? '✅' : (test.severity === 'P0' ? '🔴' : test.severity === 'P1' ? '🟠' : '🟡');
        if (this.verbose || !passed) {
          console.log(`  ${status} ${test.id}: ${test.description} ${passed ? '通过' : '失败'}`);
        }
      } catch (e) {
        result = {
          type,
          mode,
          testId: test.id,
          passed: false,
          error: e.message,
          duration: Date.now() - startTime,
          severity: 'P0'
        };
        console.error(`  🔴 ${test.id}: 执行异常 - ${e.message}`);
      }

      this.results.push(result);
    }

    console.log('');
  }

  _checkExpectation(validation, test) {
    const { expectedBehavior } = test;
    
    switch (expectedBehavior) {
      case 'pass':
        return validation.valid === true;
      case 'fail':
        return validation.valid === false;
      case 'warn':
        return validation.warnings && validation.warnings.length > 0;
      case 'degrade':
        return validation.shouldDegrade === true;
      case 'reject':
        return validation.valid === false && validation.rejected === true;
      default:
        return validation.valid !== undefined;
    }
  }

  _generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    
    const byType = {};
    const bySeverity = { P0: 0, P1: 0, P2: 0, P3: 0 };
    
    for (const r of this.results) {
      if (!byType[r.type]) byType[r.type] = { total: 0, passed: 0 };
      byType[r.type].total++;
      if (r.passed) byType[r.type].passed++;
      
      if (!r.passed && r.severity) {
        bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
      }
    }

    const report = {
      summary: { total, passed, failed, passRate: ((passed / total) * 100).toFixed(1) },
      byType,
      bySeverity,
      failures: this.results.filter(r => !r.passed),
      timestamp: new Date().toISOString()
    };

    // 打印摘要
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    测试报告摘要                            ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ 总计: ${String(total).padStart(3)} | 通过: ${String(passed).padStart(3)} | 失败: ${String(failed).padStart(3)} | 通过率: ${report.summary.passRate}% ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 按类型:                                                    ║');
    for (const [type, stats] of Object.entries(byType)) {
      const rate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`║  ${type.padEnd(12)} ${String(stats.passed).padStart(3)}/${String(stats.total).padStart(3)} (${rate}%)`);
    }
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 按严重程度:                                                ║');
    console.log(`║  P0 (严重): ${String(bySeverity.P0).padStart(3)} | P1 (高): ${String(bySeverity.P1).padStart(3)} | P2 (中): ${String(bySeverity.P2).padStart(3)} | P3 (低): ${String(bySeverity.P3).padStart(3)} ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (failed > 0) {
      console.log('🔴 失败用例详情:');
      for (const f of report.failures) {
        console.log(`  [${f.type}] ${f.testId}: ${f.error || '未通过预期检查'}`);
      }
    }

    return report;
  }

  async runQuickCheck(type) {
    // 快速检查：只跑 1 个正常 + 1 个对抗用例
    console.log(`\n⚡ [${type}] 快速检查...`);
    const quickTests = [
      ...this.generator.generate(type, 'normal').slice(0, 1),
      ...this.generator.generate(type, 'adversarial').slice(0, 1)
    ];
    
    const Validator = VALIDATORS[type];
    if (!Validator) return null;
    
    const validator = new Validator();
    const results = [];
    
    for (const test of quickTests) {
      const validation = validator.validate(test.input, test.expectations);
      results.push({
        testId: test.id,
        passed: this._checkExpectation(validation, test),
        validation
      });
    }
    
    const allPassed = results.every(r => r.passed);
    console.log(`  ${allPassed ? '✅' : '❌'} 快速检查${allPassed ? '通过' : '失败'}`);
    return { type, allPassed, results };
  }
}

module.exports = { ThemeDiversityTestEngine };

// CLI 运行
if (require.main === module) {
  (async () => {
    const engine = new ThemeDiversityTestEngine({ verbose: true });
    const report = await engine.runAllTests();
    
    // 保存报告
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../../output/theme-diversity-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告已保存: ${reportPath}`);
    
    process.exit(report.summary.failed > 0 ? 1 : 0);
  })();
}
