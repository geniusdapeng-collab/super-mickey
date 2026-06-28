// baseline-template-registry.js
// 基线模板注册中心 v1.0.0
// 提供确定性基线模板，减少LLM调用，提升稳定性
// 日期: 2026-06-26

const path = require('path');
const fs = require('fs');

const BASELINE_DIR = path.join(__dirname, '../../output/baselines');

// 默认基线模板：【P0-8-审计修复】删除硬编码医院/警察基线，改为空对象
// 基线只能通过 extractFromProject + 人工审核后注册，不再内置硬编码内容
const DEFAULT_BASELINES = {};

class BaselineTemplateRegistry {
  constructor() {
    this.baselines = new Map();
    this._ensureDir();
    this._loadAll();
  }

  _ensureDir() {
    if (!fs.existsSync(BASELINE_DIR)) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
    }
  }

  _loadAll() {
    // 加载内置默认基线
    for (const [key, value] of Object.entries(DEFAULT_BASELINES)) {
      this.baselines.set(key, value);
    }
    
    // 加载持久化基线
    try {
      const files = fs.readdirSync(BASELINE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = path.basename(file, '.json');
          const data = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, file), 'utf8'));
          this.baselines.set(key, data);
          console.log(`[BaselineRegistry] 加载基线: ${key}`);
        }
      }
    } catch (e) {
      console.warn('[BaselineRegistry] 加载持久化基线失败:', e.message);
    }
  }

  /**
   * 获取基线模板（支持模糊匹配）
   * @param {string} type - 类型如 'EDU_health' 或 'EDU_REAL'
   * @param {string} version - 版本如 'v1.0'，不传则取最新
   * @returns {object|null}
   */
  get(type, version = null) {
    if (version) {
      const key = `${type}_${version}`;
      return this.baselines.get(key) || null;
    }
    // 找最新版本（前缀精确匹配）
    let keys = Array.from(this.baselines.keys()).filter(k => k.startsWith(`${type}_`));
    if (keys.length > 0) {
      keys.sort((a, b) => {
        const va = this._extractVersion(a);
        const vb = this._extractVersion(b);
        return vb.localeCompare(va); // 降序
      });
      return this.baselines.get(keys[0]);
    }
    // 【修复v2.0.1】模糊匹配：按 filmType 回退
    // 例如 'EDU_REAL' -> 找所有 'EDU_' 开头的基线
    const filmType = type.split('_')[0];
    if (filmType && filmType !== type) {
      keys = Array.from(this.baselines.keys()).filter(k => k.startsWith(`${filmType}_`));
      if (keys.length > 0) {
        keys.sort((a, b) => {
          const va = this._extractVersion(a);
          const vb = this._extractVersion(b);
          return vb.localeCompare(va);
        });
        console.log(`[BaselineRegistry] 模糊匹配: ${type} -> ${keys[0]}`);
        return this.baselines.get(keys[0]);
      }
    }
    return null;
  }

  _extractVersion(key) {
    const match = key.match(/v(\d+\.\d+)$/);
    return match ? match[1] : '0.0';
  }

  /**
   * 注册新基线（需审核后锁定）
   * @param {string} type - 类型
   * @param {string} version - 版本
   * @param {object} baseline - 基线数据
   * @param {object} meta - 元数据
   */
  register(type, version, baseline, meta = {}) {
    const key = `${type}_${version}`;
    const fullBaseline = {
      ...baseline,
      _meta: {
        name: type,
        version: version,
        locked: false, // 默认未锁定，需人工审核
        createdAt: new Date().toISOString(),
        ...meta
      }
    };
    this.baselines.set(key, fullBaseline);
    this._persist(key, fullBaseline);
    console.log(`[BaselineRegistry] 注册基线: ${key} (未锁定)`);
    return fullBaseline;
  }

  /**
   * 锁定基线（人工审核通过）
   * @param {string} type 
   * @param {string} version 
   * @param {string} approver 
   */
  lock(type, version, approver = 'system') {
    const key = `${type}_${version}`;
    const baseline = this.baselines.get(key);
    if (!baseline) throw new Error(`基线不存在: ${key}`);
    
    baseline._meta.locked = true;
    baseline._meta.approvedBy = approver;
    baseline._meta.approvedAt = new Date().toISOString();
    this._persist(key, baseline);
    console.log(`[BaselineRegistry] 基线已锁定: ${key} by ${approver}`);
    return baseline;
  }

  /**
   * 合并基线 + LLM增量
   * @param {string} type 
   * @param {object} llmFields - LLM生成的字段
   * @returns {object}
   */
  merge(type, llmFields) {
    const baseline = this.get(type);
    if (!baseline) {
      console.warn(`[BaselineRegistry] 未找到基线 ${type}，使用全LLM生成`);
      return llmFields;
    }

    // 提取基线的稳定字段（排除_meta和_llmFields）
    const stableFields = {};
    for (const [key, value] of Object.entries(baseline)) {
      if (key.startsWith('_')) continue; // 跳过元数据
      stableFields[key] = value;
    }

    // 合并：LLM字段覆盖基线（如果LLM提供了相同字段）
    const merged = { ...stableFields, ...llmFields };
    
    // 检查必填字段
    const required = baseline._llmRequired || [];
    const missing = required.filter(f => !merged[f] || merged[f] === '(空)' || merged[f] === '');
    
    if (missing.length > 0) {
      console.warn(`[BaselineRegistry] LLM字段缺失: ${missing.join(', ')}`);
    }

    merged._baselineVersion = baseline._meta?.version || 'unknown';
    merged._baselineType = baseline._meta?.name || type;
    
    console.log(`[BaselineRegistry] 合并完成: ${type} v${baseline._meta?.version} | 基线字段${Object.keys(stableFields).length} + LLM字段${Object.keys(llmFields).length} = 总字段${Object.keys(merged).length}`);
    
    return merged;
  }

  /**
   * 检查基线是否适合当前项目（支持模糊匹配）
   * @param {string} type 
   * @param {object} requirement 
   * @returns {boolean}
   */
  isCompatible(type, requirement) {
    // 1. 精确匹配
    let baseline = this.get(type);
    if (!baseline) {
      // 2. 【修复v2.0.1】模糊匹配：按 filmType 回退
      const filmType = type.split('_')[0];
      if (filmType && filmType !== type) {
        baseline = this.get(filmType);
      }
    }
    if (!baseline) return false;
    
    // 检查关键参数匹配
    const meta = baseline._meta || {};
    if (meta.filmType && requirement.filmType && meta.filmType !== requirement.filmType) {
      return false;
    }
    if (meta.visualStyle && requirement.visualStyle && meta.visualStyle !== requirement.visualStyle) {
      return false;
    }
    return true;
  }

  _persist(key, baseline) {
    try {
      const filePath = path.join(BASELINE_DIR, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(baseline, null, 2));
    } catch (e) {
      console.error('[BaselineRegistry] 持久化失败:', e.message);
    }
  }

  /**
   * 列出所有基线
   */
  list() {
    return Array.from(this.baselines.entries()).map(([key, value]) => ({
      key,
      name: value._meta?.name,
      version: value._meta?.version,
      locked: value._meta?.locked,
      approvedBy: value._meta?.approvedBy,
      approvedAt: value._meta?.approvedAt
    }));
  }

  /**
   * 从现有项目提取基线（供人工审核后注册）
   * @param {object} projectResult - 项目生成结果
   * @param {string} type - 基线类型
   */
  extractFromProject(projectResult, type) {
    // 提取稳定字段作为候选基线
    const candidate = {
      directorInstruction: projectResult.directorInstruction,
      constraint: projectResult.constraint,
      baseline: projectResult.baseline,
      negative: projectResult.negative,
      brightConstraint: projectResult.brightConstraint,
      characterConstraint: projectResult.characterConstraint,
      consistency: projectResult.consistency,
      costume: projectResult.costume,
      makeup: projectResult.makeup,
      colorPalette: projectResult.colorPalette,
      depthOfField: projectResult.depthOfField,
      composition: projectResult.composition
    };
    
    return this.register(type, 'v1.0-draft', candidate, { 
      source: 'project-extraction',
      extractedAt: new Date().toISOString()
    });
  }
}

module.exports = { BaselineTemplateRegistry };
