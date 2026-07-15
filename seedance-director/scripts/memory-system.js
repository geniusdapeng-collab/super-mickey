/**
 * Seedance Memory System v9.4-Peng — 跨会话学习 + 经验积累
 *
 * 核心功能：
 * 1. 经验捕获：记录每次生产的关键决策、失败原因、优化效果
 * 2. 模式识别：识别重复出现的问题（"这个角色上次渲染失败了"）
 * 3. 知识检索：基于当前任务上下文，检索相关历史经验
 * 4. 自动建议：根据历史经验，主动给出优化建议
 * 5. 知识持久化：经验写入MEMORY.md，跨会话可用
 * 6. 遗忘机制：旧经验自动衰减，避免知识膨胀
 *
 * 经验类型：
 * - render: 渲染经验（模型选择、参数调优、降级策略）
 * - story: 故事经验（大纲结构、情绪配方、角色设计）
 * - character: 角色经验（一致性维护、外观变更）
 * - post: 后期经验（转场选择、调色LUT、音轨配比）
 * - error: 错误经验（失败原因、修复方案）
 * - cost: 成本经验（Token消耗、API调用次数）
 *
 * 旧痛点：每次生产独立，不积累历史经验
 * 新方案：自动捕获→模式识别→主动建议
 */

const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const { safeJSONParse } = require('./exec-utils');

// ============ 经验类型定义 ============
const EXPERIENCE_TYPES = {
  RENDER: 'render',       // 渲染经验
  STORY: 'story',         // 故事经验
  CHARACTER: 'character', // 角色经验
  POST: 'post',           // 后期经验
  ERROR: 'error',         // 错误经验
  COST: 'cost',           // 成本经验
  STYLE: 'style',         // 风格经验
  SOUND: 'sound'          // 声音经验
};

// ============ 经验重要性衰减配置 ============
const MEMORY_CONFIG = {
  maxExperiences: 1000,      // 最多保留1000条经验
  decayHalfLife: 30,         // 30天半衰期
  minRelevance: 0.3,         // 最低相关性阈值
  suggestionThreshold: 0.7,  // 建议触发阈值
  autoCapture: true,         // 自动捕获
  persistInterval: 10        // 每10条经验持久化一次
};

class MemorySystem {
  constructor(options = {}) {
    this.workspace = options.workspace || path.join(require('os').homedir(), '.openclaw/workspace');
    this.memoryDir = path.join(this.workspace, '.seedance', 'memory');
    this.memoryFile = path.join(this.memoryDir, 'experiences.jsonl');
    this.config = { ...MEMORY_CONFIG, ...options };

    // 内存中的经验
    this.experiences = [];

    // 统计
    this.stats = {
      total: 0,
      byType: {},
      captured: 0,
      retrieved: 0
    };

    // 创建目录
    if (!fss.existsSync(this.memoryDir)) {
      fss.mkdirSync(this.memoryDir, { recursive: true });
    }

    // 加载已有经验
    this._load();
  }

  /**
   * 捕获经验（核心方法）
   * @param {string} type - 经验类型
   * @param {Object} data - 经验数据
   * @param {Object} context - 上下文（用于检索匹配）
   */
  capture(type, data, context = {}) {
    if (!Object.values(EXPERIENCE_TYPES).includes(type)) {
      throw new Error(`未知经验类型: ${type}`);
    }

    const experience = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      data,
      context: {
        taskId: context.taskId,
        title: context.title,
        style: context.style,
        characters: context.characters,
        timestamp: new Date().toISOString(),
        ...context
      },
      relevance: 1.0, // 初始相关性
      accessCount: 0, // 被检索次数
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };

    this.experiences.push(experience);
    this.stats.captured++;
    this.stats.total++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

    // 自动持久化
    if (this.experiences.length % this.config.persistInterval === 0) {
      this._persist();
    }

    // 限制数量
    if (this.experiences.length > this.config.maxExperiences) {
      this._prune();
    }

    console.log(`[MemorySystem] 📝 捕获经验: ${type} (${experience.id})`);

    return experience;
  }

  /**
   * 检索经验（基于上下文匹配）
   * @param {Object} query - 查询上下文
   * @param {Object} options - 检索选项
   */
  retrieve(query, options = {}) {
    const {
      type,           // 按类型过滤
      limit = 5,      // 最多返回条数
      minRelevance = this.config.minRelevance,
      decay = true    // 是否考虑时间衰减
    } = options;

    // 计算每条经验的相关性
    const scored = this.experiences.map(exp => {
      let score = this._calculateRelevance(exp, query, decay);

      // 类型过滤
      if (type && exp.type !== type) {
        score = 0;
      }

      return { ...exp, score };
    });

    // 过滤并排序
    const results = scored
      .filter(exp => exp.score >= minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // 更新访问统计
    for (const result of results) {
      const exp = this.experiences.find(e => e.id === result.id);
      if (exp) {
        exp.accessCount++;
        exp.lastAccessed = Date.now();
      }
    }

    this.stats.retrieved += results.length;

    console.log(`[MemorySystem] 🔍 检索: ${results.length} 条经验 (查询: ${JSON.stringify(query)})`);

    return results;
  }

  /**
   * 生成建议（基于检索结果）
   * @param {Object} context - 当前任务上下文
   */
  suggest(context) {
    // 检索相关经验
    const experiences = this.retrieve(context, { limit: 10 });

    if (experiences.length === 0) {
      return null;
    }

    // 按类型分组
    const byType = {};
    for (const exp of experiences) {
      if (!byType[exp.type]) byType[exp.type] = [];
      byType[exp.type].push(exp);
    }

    // 生成建议
    const suggestions = [];

    for (const [type, exps] of Object.entries(byType)) {
      // 按分数排序，取最高分
      const best = exps.sort((a, b) => b.score - a.score)[0];

      if (best.score >= this.config.suggestionThreshold) {
        suggestions.push({
          type,
          relevance: best.score,
          suggestion: this._generateSuggestionText(type, best),
          experience: best
        });
      }
    }

    // 按相关性排序
    suggestions.sort((a, b) => b.relevance - a.relevance);

    return suggestions.length > 0 ? suggestions : null;
  }

  /**
   * 渲染经验快捷方法
   */
  captureRender(data, context) {
    return this.capture(EXPERIENCE_TYPES.RENDER, data, context);
  }

  /**
   * 错误经验快捷方法
   */
  captureError(error, context, recovery) {
    return this.capture(EXPERIENCE_TYPES.ERROR, {
      error: error.message || error,
      recovery: recovery || null,
      stack: error.stack || null
    }, context);
  }

  /**
   * 成本经验快捷方法
   */
  captureCost(data, context) {
    return this.capture(EXPERIENCE_TYPES.COST, data, context);
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      ...this.stats,
      memorySize: this.experiences.length,
      avgAccessCount: this.experiences.length > 0
        ? this.experiences.reduce((sum, e) => sum + e.accessCount, 0) / this.experiences.length
        : 0
    };
  }

  /**
   * 导出经验到Markdown（人类可读）
   */
  exportToMarkdown() {
    const sections = {};
    for (const exp of this.experiences) {
      if (!sections[exp.type]) sections[exp.type] = [];
      sections[exp.type].push(exp);
    }

    let md = `# Seedance 生产经验库\n\n`;
    md += `> 累计 ${this.experiences.length} 条经验 | 最后更新: ${new Date().toISOString()}\n\n`;

    for (const [type, exps] of Object.entries(sections)) {
      md += `## ${type.toUpperCase()} 经验 (${exps.length})\n\n`;

      // 按相关性排序
      const sorted = exps.sort((a, b) => (b.relevance * b.accessCount) - (a.relevance * a.accessCount));

      for (const exp of sorted.slice(0, 10)) { // 每类最多10条
        md += `### ${exp.context.title || '无标题'}\n`;
        md += `- **时间**: ${exp.context.timestamp || '未知'}\n`;
        md += `- **相关性**: ${exp.relevance.toFixed(2)} | **访问**: ${exp.accessCount}\n`;
        md += `- **数据**: \`${JSON.stringify(exp.data).substring(0, 200)}...\`\n\n`;
      }
    }

    return md;
  }

  // ============ 内部方法 ============

  /**
   * 计算相关性得分
   */
  _calculateRelevance(exp, query, applyDecay = true) {
    let score = 0;
    let factors = 0;

    // 1. 标题匹配
    if (query.title && exp.context.title) {
      const titleSim = this._similarity(query.title, exp.context.title);
      score += titleSim * 0.3;
      factors++;
    }

    // 2. 风格匹配
    if (query.style && exp.context.style) {
      if (query.style === exp.context.style) {
        score += 0.25;
      }
      factors++;
    }

    // 3. 角色匹配
    if (query.characters && exp.context.characters) {
      const common = query.characters.filter(c =>
        exp.context.characters.some(ec =>
          this._similarity(c, ec) > 0.7
        )
      );
      if (common.length > 0) {
        score += 0.25 * (common.length / Math.max(query.characters.length, exp.context.characters.length));
      }
      factors++;
    }

    // 4. 类型匹配（如果是同类型查询）
    if (query.type && query.type === exp.type) {
      score += 0.2;
      factors++;
    }

    // 5. 访问频率加权
    score *= (1 + Math.log(exp.accessCount + 1) * 0.1);

    // 6. 时间衰减
    if (applyDecay) {
      const age = (Date.now() - exp.createdAt) / (1000 * 60 * 60 * 24); // 天数
      const decay = Math.pow(0.5, age / this.config.decayHalfLife);
      score *= decay;
    }

    return factors > 0 ? score : 0;
  }

  /**
   * 简单字符串相似度（Jaccard）
   */
  _similarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(''));
    const setB = new Set(b.toLowerCase().split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  /**
   * 生成建议文本
   */
  _generateSuggestionText(type, exp) {
    const texts = {
      [EXPERIENCE_TYPES.RENDER]: `渲染建议: ${exp.data.tip || '参考历史参数'}`,
      [EXPERIENCE_TYPES.STORY]: `故事建议: ${exp.data.tip || '参考历史结构'}`,
      [EXPERIENCE_TYPES.CHARACTER]: `角色建议: ${exp.data.tip || '注意一致性'}`,
      [EXPERIENCE_TYPES.POST]: `后期建议: ${exp.data.tip || '参考历史配置'}`,
      [EXPERIENCE_TYPES.ERROR]: `⚠️ 历史错误: ${exp.data.error || '未知错误'} — ${exp.data.recovery || '未记录修复'}`,
      [EXPERIENCE_TYPES.COST]: `成本建议: ${exp.data.tip || '参考历史消耗'}`,
      [EXPERIENCE_TYPES.STYLE]: `风格建议: ${exp.data.tip || '参考历史配置'}`,
      [EXPERIENCE_TYPES.SOUND]: `声音建议: ${exp.data.tip || '参考历史配置'}`
    };

    return texts[type] || `建议: ${JSON.stringify(exp.data).substring(0, 100)}`;
  }

  /**
   * 剪枝：删除低相关性经验
   */
  _prune() {
    // 按综合得分排序（相关性 × 访问次数）
    this.experiences.sort((a, b) => {
      const scoreA = a.relevance * (a.accessCount + 1);
      const scoreB = b.relevance * (b.accessCount + 1);
      return scoreB - scoreA;
    });

    // 保留前maxExperiences条
    const removed = this.experiences.splice(this.config.maxExperiences);
    console.log(`[MemorySystem] 🗑️ 剪枝: 删除${removed.length}条旧经验`);

    this._persist();
  }

  /**
   * 持久化到文件
   */
  _persist() {
    try {
      const lines = this.experiences.map(e => JSON.stringify(e)).join('\n');
      fss.writeFileSync(this.memoryFile, lines + '\n');
    } catch (err) {
      console.error(`[MemorySystem] ❌ 持久化失败: ${err.message}`);
    }
  }

  /**
   * 从文件加载
   */
  _load() {
    if (!fss.existsSync(this.memoryFile)) return;

    try {
      const lines = fss.readFileSync(this.memoryFile, 'utf8').trim().split('\n');
      for (const line of lines) {
        const exp = safeJSONParse(line, null);
        if (exp) this.experiences.push(exp);
      }
      console.log(`[MemorySystem] 📂 加载: ${this.experiences.length} 条经验`);
    } catch (err) {
      console.error(`[MemorySystem] ❌ 加载失败: ${err.message}`);
    }
  }
}

// ============ 快捷方法 ============

/**
 * 创建或获取Memory System实例（单例）
 */
let _instance = null;
function getMemorySystem(options) {
  if (!_instance) {
    _instance = new MemorySystem(options);
  }
  return _instance;
}

// ============ 导出 ============
module.exports = {
  MemorySystem,
  EXPERIENCE_TYPES,
  getMemorySystem
};

// CLI测试
if (require.main === module) {
  (async () => {
    console.log('🧠 Memory System v9.4-Peng 测试\n');

    const mem = new MemorySystem();

    // 测试1：捕获经验
    mem.captureRender(
      { model: 'seedance-2.0', motionStrength: 0.8, cfgScale: 7.5, tip: '赛博朋克风格用冷色调' },
      { taskId: 't1', title: '赛博朋克猫', style: 'cyberpunk', characters: ['猫', '机器人'] }
    );

    mem.captureError(
      new Error('Seedance API 429'),
      { taskId: 't1', title: '赛博朋克猫' },
      '降级到seedance-1.5-pro后成功'
    );

    mem.captureRender(
      { model: 'seedance-1.5-pro', motionStrength: 0.6, tip: '降级后更稳定' },
      { taskId: 't2', title: '古风少女', style: 'ancient', characters: ['少女'] }
    );

    // 测试2：检索
    const results = mem.retrieve(
      { title: '赛博朋克', style: 'cyberpunk', characters: ['猫'] },
      { type: 'render', limit: 5 }
    );
    console.log(`\n🔍 检索结果: ${results.length} 条`);
    for (const r of results) {
      console.log(`   ${r.type}: ${r.score.toFixed(2)} — ${r.context.title}`);
    }

    // 测试3：建议
    const suggestions = mem.suggest({ title: '赛博朋克猫', style: 'cyberpunk' });
    console.log(`\n💡 建议: ${suggestions ? suggestions.length : 0} 条`);
    if (suggestions) {
      for (const s of suggestions) {
        console.log(`   ${s.type} (${s.relevance.toFixed(2)}): ${s.suggestion}`);
      }
    }

    // 测试4：统计
    const stats = mem.getStats();
    console.log(`\n📊 统计:`);
    console.log(`   总数: ${stats.total}`);
    console.log(`   已捕获: ${stats.captured}`);
    console.log(`   已检索: ${stats.retrieved}`);

    // 测试5：导出
    const md = mem.exportToMarkdown();
    console.log(`\n📝 Markdown导出: ${md.length} 字符`);

    console.log('\n✅ Memory System 测试完成！');
  })();
}
