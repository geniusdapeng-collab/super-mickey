const fs = require('fs');
const path = require('path');

class SystemHealthCheck {
  constructor(options = {}) {
    this.root = options.root || process.cwd();
    this.report = {
      ok: true,
      checks: [],
      warnings: [],
      errors: []
    };
  }

  run() {
    this._checkCoreFiles();
    this._checkDebugDirs();
    this._checkConfigConsistency();
    this._checkAsyncRiskFiles();
    this._checkLegacyPromptRisk();

    this.report.ok = this.report.errors.length === 0;
    return this.report;
  }

  _checkCoreFiles() {
    const requiredFiles = [
      'systems/final-prompt-builder-v2.js',
      'systems/prompt-normalizer-v1.js',
      'systems/prompt-validator-v1.js',
      'systems/prompt-trimmer-v1.js',
      'systems/pipeline-integration-patch-v1.js',
      'systems/field-mapper-v1.js',
      'systems/shot-schema-validator-v1.js'
    ];

    for (const rel of requiredFiles) {
      const abs = path.join(this.root, rel);
      if (fs.existsSync(abs)) {
        this.report.checks.push(`存在: ${rel}`);
      } else {
        this.report.errors.push(`缺失核心文件: ${rel}`);
      }
    }
  }

  _checkDebugDirs() {
    const debugDir = path.join(this.root, 'debug-shot-records');
    try {
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const testFile = path.join(debugDir, '__health_test__.tmp');
      fs.writeFileSync(testFile, 'ok', 'utf8');
      fs.unlinkSync(testFile);
      this.report.checks.push('debug-shot-records 可写');
    } catch (e) {
      this.report.errors.push(`debug-shot-records 不可写: ${e.message}`);
    }
  }

  _checkConfigConsistency() {
    const configPath = path.join(this.root, 'systems', 'config-center-v2.js');
    if (!fs.existsSync(configPath)) {
      this.report.warnings.push('未找到 config-center-v2.js，将依赖 fallback 配置');
      return;
    }

    const content = fs.readFileSync(configPath, 'utf8');

    if (!content.includes('prompt:') || !content.includes('maxLength')) {
      this.report.warnings.push('config-center-v2.js 里似乎没有明确 prompt.maxLength');
    } else {
      this.report.checks.push('config-center-v2.js 包含 prompt.maxLength');
    }
  }

  _checkAsyncRiskFiles() {
    const riskFiles = [
      'systems/character-portrait-enforcer-v2.js',
      'systems/async-director-agent.js',
      'systems/checkpoint-manager.js',
      'systems/context-manager.js'
    ];

    for (const rel of riskFiles) {
      const abs = path.join(this.root, rel);
      if (fs.existsSync(abs)) {
        this.report.warnings.push(`需人工审计 async 风险文件: ${rel}`);
      }
    }
  }

  _checkLegacyPromptRisk() {
    const systemsDir = path.join(this.root, 'systems');
    if (!fs.existsSync(systemsDir)) return;

    const files = fs.readdirSync(systemsDir).filter(f => f.endsWith('.js'));
    let legacyRiskCount = 0;

    for (const file of files) {
      const abs = path.join(systemsDir, file);
      const content = fs.readFileSync(abs, 'utf8');

      if (
        content.includes('prompt +=') &&
        !file.includes('final-prompt-builder') &&
        !file.includes('prompt-normalizer')
      ) {
        legacyRiskCount++;
      }
    }

    if (legacyRiskCount > 0) {
      this.report.warnings.push(`检测到 ${legacyRiskCount} 个文件仍可能使用旧式 prompt += 拼接`);
    } else {
      this.report.checks.push('未发现明显旧式 prompt += 风险');
    }
  }
}

module.exports = { SystemHealthCheck };

if (require.main === module) {
  const checker = new SystemHealthCheck();
  const report = checker.run();
  console.log(JSON.stringify(report, null, 2));
}
