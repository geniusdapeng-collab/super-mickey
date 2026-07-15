/**
 * SchemaRuntimeValidator v5.1-Peng
 * 轻量级运行时Schema校验层（无ajv依赖）
 * 
 * 在Pipeline关键节点自动校验数据结构，防止脏数据流入下游。
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, 'schema');

class SchemaRuntimeValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false; // 默认严格
    this.schemas = {};
    this._loadSchemas();
  }

  _loadSchemas() {
    const files = fss.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.schema.json'));
    for (const file of files) {
      const name = file.replace('.schema.json', '');
      const content = fss.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
      this.schemas[name] = JSON.parse(content);
    }
  }

  /**
   * 校验对象是否符合指定Schema
   * @param {string} schemaName - 'story-plan' | 'shot-prompt' | 'character-asset'
   * @param {Object} data - 要校验的数据
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate(schemaName, data) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaName}' not found`] };
    }
    const errors = [];
    this._validateObject(data, schema, '', errors);
    return { valid: errors.length === 0, errors };
  }

  _validateObject(obj, schema, path, errors) {
    // required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (obj === undefined || obj === null || !(field in obj)) {
          errors.push(`${path}: missing required field '${field}'`);
        }
      }
    }

    if (obj === undefined || obj === null) return;

    // type checking
    if (schema.type === 'object' && typeof obj === 'object') {
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            this._validateValue(obj[key], propSchema, `${path}.${key}`, errors);
          }
        }
      }
    } else if (schema.type === 'array' && Array.isArray(obj)) {
      if (schema.minItems !== undefined && obj.length < schema.minItems) {
        errors.push(`${path}: array length ${obj.length} < min ${schema.minItems}`);
      }
      if (schema.items) {
        obj.forEach((item, i) => {
          this._validateValue(item, schema.items, `${path}[${i}]`, errors);
        });
      }
    } else {
      this._validateValue(obj, schema, path, errors);
    }
  }

  _validateValue(value, schema, path, errors) {
    if (value === undefined || value === null) {
      if (schema.type && !['null'].includes(schema.type)) {
        // null values in non-null fields are caught by required check
      }
      return;
    }

    // type
    const expectedType = schema.type;
    if (expectedType) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (expectedType === 'integer') {
        if (!Number.isInteger(value)) {
          errors.push(`${path}: expected integer, got ${actualType} (${value})`);
        }
      } else if (expectedType === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`${path}: expected number, got ${actualType} (${value})`);
        }
      } else if (expectedType === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${path}: expected string, got ${actualType} (${value})`);
        }
      } else if (expectedType === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`${path}: expected boolean, got ${actualType} (${value})`);
        }
      } else if (expectedType === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${path}: expected array, got ${actualType} (${value})`);
        }
      } else if (expectedType === 'object') {
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          errors.push(`${path}: expected object, got ${actualType} (${value})`);
        } else {
          this._validateObject(value, schema, path, errors);
        }
      }
    }

    // minLength / maxLength for strings
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path}: string length ${value.length} < min ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path}: string length ${value.length} > max ${schema.maxLength}`);
      }
      if (schema.pattern) {
        const re = new RegExp(schema.pattern);
        if (!re.test(value)) {
          errors.push(`${path}: string '${value}' does not match pattern ${schema.pattern}`);
        }
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: string '${value}' not in enum [${schema.enum.join(', ')}]`);
      }
    }

    // minimum / maximum for numbers
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: value ${value} < minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: value ${value} > maximum ${schema.maximum}`);
      }
    }

    // format
    if (schema.format && typeof value === 'string') {
      if (schema.format === 'date-time') {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          errors.push(`${path}: invalid date-time '${value}'`);
        }
      } else if (schema.format === 'uri') {
        const uriRe = /^https?:\/\/.+/;
        if (!uriRe.test(value)) {
          errors.push(`${path}: invalid URI '${value}'`);
        }
      }
    }
  }

  /**
   * Pipeline钩子：在关键节点自动校验
   * @param {string} stage - 'story-plan' | 'shot-prompt' | 'character-asset'
   * @param {Object} data
   * @param {Object} options - {throwOnError: boolean}
   */
  gate(stage, data, options = {}) {
    const result = this.validate(stage, data);
    if (!result.valid) {
      const errMsg = `[SchemaGate] ${stage} validation failed:\n` + result.errors.map(e => '  - ' + e).join('\n');
      if (options.throwOnError !== false && this.strictMode) {
        throw new Error(errMsg);
      } else {
        console.warn(errMsg);
      }
    }
    return result;
  }
}

module.exports = { SchemaRuntimeValidator };