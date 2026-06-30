const { PROMPT_FIELDS } = require('./prompt-schema-v1');

class PromptValidator {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 1500;
    this.minLength = options.minLength || 80;
    this.requiredFields = options.requiredFields || ['CHARACTER', 'ACTION', 'SCENE'];
  }

  validate(normalizedResult = {}) {
    const fields = normalizedResult.fields || {};
    const prompt = normalizedResult.prompt || '';

    const issues = [];
    const warnings = [];

    // 1. 必填字段
    for (const field of this.requiredFields) {
      if (!fields[field] || !String(fields[field]).trim()) {
        issues.push(`缺少必填字段: ${field}`);
      }
    }

    // 2. 全字段合法性
    for (const field of PROMPT_FIELDS) {
      if (fields[field] !== undefined && typeof fields[field] !== 'string') {
        issues.push(`字段不是字符串: ${field}`);
      }
    }

    // 3. 长度检查
    if (!prompt || prompt.length < this.minLength) {
      warnings.push(`最终prompt过短: ${prompt.length}`);
    }

    if (prompt.length > this.maxLength) {
      issues.push(`最终prompt超长: ${prompt.length} > ${this.maxLength}`);
    }

    // 4. 空字段比例
    const emptyFields = PROMPT_FIELDS.filter(f => !fields[f]);
    if (emptyFields.length > 5) {
      warnings.push(`空字段过多: ${emptyFields.join(', ')}`);
    }

    // 5. 格式检查
    if (!prompt.startsWith('{') || !prompt.endsWith('}')) {
      issues.push('最终prompt格式错误：必须是 { ... }');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      stats: {
        length: prompt.length,
        emptyFields,
        filledFields: PROMPT_FIELDS.filter(f => !!fields[f])
      }
    };
  }
}

module.exports = { PromptValidator };
