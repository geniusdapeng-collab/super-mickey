/**
 * Seedance Context Manager v9.3-Peng — 上下文管理器
 * 
 * 核心功能：
 * 1. Token 估算与预算管理（防止上下文溢出）
 * 2. 五级素材压缩（从完整prompt到低token摘要）
 * 3. 渐进式上下文截断（保留关键信息，丢弃冗余）
 * 4. 与OpenClaw上下文管理对接
 * 
 * 使用场景：
 * - 25镜头长任务：自动压缩历史镜头描述
 * - 多角色场景：角色资产摘要化
 * - 跨Phase传递：story-plan → shots → 渲染 → 后期
 */

const path = require('path');

// ============ Token 估算配置 ============
const TOKEN_CONFIG = {
  // 中文字符：1字 ≈ 1 token（kimi k2p6 实测）
  chineseChar: 1.0,
  // 英文单词：1词 ≈ 1.3 token
  englishWord: 1.3,
  // 数字：1个 ≈ 0.5 token
  digit: 0.5,
  // 标点符号：1个 ≈ 0.3 token
  punctuation: 0.3,
  // 系统开销：每次消息传递约50 token
  systemOverhead: 50,
  // 安全缓冲：预留10%
  safetyBuffer: 0.1,
  // 最大上下文窗口（kimi k2p6 = 131072）
  maxContextWindow: 131072,
  // 警戒阈值：80%触发压缩
  warningThreshold: 0.8,
  // 硬限制：95%强制截断
  hardLimitThreshold: 0.95
};

// ============ 五级压缩策略 ============
const COMPRESSION_LEVELS = {
  // Level 0: 完整内容（100%保留）
  FULL: { 
    level: 0, 
    name: '完整', 
    retention: 1.0,
    description: '保留所有细节，用于当前活动镜头'
  },
  // Level 1: 轻度压缩（保留80%关键信息）
  LIGHT: { 
    level: 1, 
    name: '轻度', 
    retention: 0.8,
    description: '移除环境细节，保留动作+角色'
  },
  // Level 2: 中度压缩（保留50%核心信息）
  MEDIUM: { 
    level: 2, 
    name: '中度', 
    retention: 0.5,
    description: '仅保留角色+动作+情绪关键词'
  },
  // Level 3: 重度压缩（保留25%骨架信息）
  HEAVY: { 
    level: 3, 
    name: '重度', 
    retention: 0.25,
    description: '仅保留角色名+核心动作+关键道具'
  },
  // Level 4: 极端压缩（保留10%标签信息）
  EXTREME: { 
    level: 4, 
    name: '极端', 
    retention: 0.1,
    description: '仅保留角色标签+动作标签'
  }
};

class ContextManager {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || TOKEN_CONFIG.maxContextWindow;
    this.warningThreshold = options.warningThreshold || TOKEN_CONFIG.warningThreshold;
    this.hardLimitThreshold = options.hardLimitThreshold || TOKEN_CONFIG.hardLimitThreshold;
    
    // 当前上下文状态
    this.currentTokenCount = 0;
    this.contextItems = []; // [{ type, content, priority, compressedLevel }]
    
    // 压缩统计
    this.compressionStats = {
      totalCompressed: 0,
      totalSaved: 0,
      byLevel: {}
    };
  }

  /**
   * 估算字符串的token数量
   * @param {string} str - 输入字符串
   * @returns {number} - 估算token数
   */
  estimateTokens(str) {
    if (!str || typeof str !== 'string') return 0;
    
    let tokens = 0;
    
    // 逐字符统计
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const code = char.charCodeAt(0);
      
      if (code >= 0x4e00 && code <= 0x9fff) {
        // 中文字符
        tokens += TOKEN_CONFIG.chineseChar;
      } else if (code >= 0x30 && code <= 0x39) {
        // 数字
        tokens += TOKEN_CONFIG.digit;
      } else if (code >= 0x41 && code <= 0x5a || code >= 0x61 && code <= 0x7a) {
        // 英文字母（按单词计数，简化处理）
        // 实际上应该用分词器，这里简化估算
        tokens += TOKEN_CONFIG.englishWord / 5; // 假设平均5字母/词
      } else if (code <= 0x20) {
        // 空白字符
        continue;
      } else {
        // 标点符号
        tokens += TOKEN_CONFIG.punctuation;
      }
    }
    
    // 加上系统开销
    tokens += TOKEN_CONFIG.systemOverhead;
    
    // 加上安全缓冲
    tokens *= (1 + TOKEN_CONFIG.safetyBuffer);
    
    return Math.ceil(tokens);
  }

  /**
   * 批量估算多个内容的token
   * @param {Array<{type: string, content: string}>} items
   * @returns {number}
   */
  estimateBatch(items) {
    let total = 0;
    for (const item of items) {
      total += this.estimateTokens(item.content || '');
    }
    return total;
  }

  /**
   * 添加上下文项
   * @param {string} type - 类型：shot/story-plan/character/dialogue/etc
   * @param {string} content - 内容
   * @param {number} priority - 优先级：0=最高（当前镜头），1=高（相邻镜头），2=中，3=低
   * @param {string} id - 唯一标识
   */
  addContextItem(type, content, priority = 2, id = null) {
    const item = {
      id: id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      content,
      originalContent: content, // 保留原始内容
      priority,
      compressedLevel: COMPRESSION_LEVELS.FULL.level,
      originalTokens: this.estimateTokens(content),
      currentTokens: this.estimateTokens(content)
    };
    
    this.contextItems.push(item);
    this._recalculateTokenCount();
    
    // 检查是否需要压缩
    this._checkAndCompress();
    
    return item.id;
  }

  /**
   * 添加故事计划（Phase 1产出）
   * @param {Object} storyPlan - 故事计划对象
   */
  addStoryPlan(storyPlan) {
    const content = JSON.stringify(storyPlan, null, 2);
    return this.addContextItem('story-plan', content, 1, 'story-plan-main');
  }

  /**
   * 添加镜头描述（shots）
   * @param {Array<Object>} shots - 镜头数组
   */
  addShots(shots) {
    // 当前镜头：priority=0（完整保留）
    // 已渲染镜头：priority=2（可压缩）
    // 未来镜头：priority=3（可高度压缩）
    
    const now = Date.now();
    let totalTokens = 0;
    
    shots.forEach((shot, index) => {
      const content = JSON.stringify(shot, null, 2);
      const priority = index === 0 ? 0 : (index < 3 ? 1 : (index < 6 ? 2 : 3));
      const id = this.addContextItem('shot', content, priority, `shot_${shot.id || index}`);
      totalTokens += this.estimateTokens(content);
    });
    
    return totalTokens;
  }

  /**
   * 添加角色资产
   * @param {Array<Object>} characters - 角色数组
   */
  addCharacters(characters) {
    let totalTokens = 0;
    
    characters.forEach(char => {
      // 角色资产：首次完整，后续压缩
      const content = JSON.stringify({
        name: char.name,
        appearance: char.appearance,
        personality: char.personality,
        voice: char.voice
      }, null, 2);
      
      const id = this.addContextItem('character', content, 1, `char_${char.name}`);
      totalTokens += this.estimateTokens(content);
    });
    
    return totalTokens;
  }

  /**
   * 压缩单个上下文项
   * @param {Object} item - 上下文项
   * @param {number} targetLevel - 目标压缩级别
   * @returns {string} - 压缩后的内容
   */
  compressItem(item, targetLevel) {
    const strategy = Object.values(COMPRESSION_LEVELS).find(l => l.level === targetLevel);
    if (!strategy) return item.content;
    
    let compressed = item.content;
    
    try {
      // 尝试解析为JSON（shot/story-plan等）
      const data = JSON.parse(item.content);
      compressed = this._compressStructured(data, targetLevel);
    } catch {
      // 纯文本：按规则压缩
      compressed = this._compressText(item.content, targetLevel);
    }
    
    // 更新统计
    const savedTokens = item.currentTokens - this.estimateTokens(compressed);
    this.compressionStats.totalCompressed++;
    this.compressionStats.totalSaved += savedTokens;
    this.compressionStats.byLevel[strategy.name] = 
      (this.compressionStats.byLevel[strategy.name] || 0) + 1;
    
    item.compressedLevel = targetLevel;
    item.currentTokens = this.estimateTokens(compressed);
    item.content = compressed;
    
    return compressed;
  }

  /**
   * 结构化数据压缩
   * @param {Object} data - 结构化数据
   * @param {number} level - 压缩级别
   */
  _compressStructured(data, level) {
    switch (level) {
      case COMPRESSION_LEVELS.LIGHT.level:
        // 轻度：移除环境描述，保留动作+角色
        return JSON.stringify(this._lightCompress(data));
      
      case COMPRESSION_LEVELS.MEDIUM.level:
        // 中度：仅保留角色+动作+情绪
        return JSON.stringify(this._mediumCompress(data));
      
      case COMPRESSION_LEVELS.HEAVY.level:
        // 重度：仅保留角色名+核心动作+关键道具
        return JSON.stringify(this._heavyCompress(data));
      
      case COMPRESSION_LEVELS.EXTREME.level:
        // 极端：仅保留标签
        return JSON.stringify(this._extremeCompress(data));
      
      default:
        return JSON.stringify(data);
    }
  }

  /**
   * 轻度压缩：保留80%
   */
  _lightCompress(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this._lightCompress(item));
    }
    
    const compressed = {};
    for (const [key, value] of Object.entries(data)) {
      // 保留关键字段，简化环境描述
      if (key.includes('environment') || key.includes('background') || key.includes('setting')) {
        compressed[key] = typeof value === 'string' ? value.substring(0, 50) + '...' : value;
      } else if (key.includes('description') && typeof value === 'string' && value.length > 100) {
        compressed[key] = value.substring(0, 100) + '...';
      } else {
        compressed[key] = this._lightCompress(value);
      }
    }
    
    return compressed;
  }

  /**
   * 中度压缩：保留50%
   */
  _mediumCompress(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    if (Array.isArray(data)) {
      return data.slice(0, Math.ceil(data.length * 0.5)).map(item => this._mediumCompress(item));
    }
    
    const keepKeys = ['name', 'character', 'action', 'emotion', 'mood', 'camera', 'duration'];
    const compressed = {};
    
    for (const key of keepKeys) {
      if (data[key] !== undefined) {
        compressed[key] = typeof data[key] === 'string' && data[key].length > 50 
          ? data[key].substring(0, 50) 
          : data[key];
      }
    }
    
    return compressed;
  }

  /**
   * 重度压缩：保留25%
   */
  _heavyCompress(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    const compressed = {};
    
    // 仅保留最关键的字段
    if (data.name || data.character) {
      compressed.name = data.name || data.character;
    }
    if (data.action) {
      compressed.action = typeof data.action === 'string' 
        ? data.action.split(' ').slice(0, 3).join(' ') 
        : data.action;
    }
    if (data.emotion || data.mood) {
      compressed.emotion = data.emotion || data.mood;
    }
    if (data.prop || data.props) {
      compressed.prop = Array.isArray(data.props) ? data.props[0] : data.prop;
    }
    
    return compressed;
  }

  /**
   * 极端压缩：保留10%标签
   */
  _extremeCompress(data) {
    const tags = [];
    
    if (data.name || data.character) {
      tags.push(`[${data.name || data.character}]`);
    }
    if (data.action) {
      const action = typeof data.action === 'string' ? data.action.split(' ')[0] : 'act';
      tags.push(`{${action}}`);
    }
    if (data.emotion || data.mood) {
      tags.push(`<${data.emotion || data.mood}>`);
    }
    
    return { tags: tags.join(' ') };
  }

  /**
   * 纯文本压缩
   */
  _compressText(text, level) {
    if (!text || typeof text !== 'string') return text;
    
    switch (level) {
      case COMPRESSION_LEVELS.LIGHT.level:
        return text.length > 200 ? text.substring(0, 200) + '...' : text;
      case COMPRESSION_LEVELS.MEDIUM.level:
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      case COMPRESSION_LEVELS.HEAVY.level:
        return text.length > 50 ? text.substring(0, 50) + '...' : text;
      case COMPRESSION_LEVELS.EXTREME.level:
        return text.length > 20 ? text.substring(0, 20) + '...' : text;
      default:
        return text;
    }
  }

  /**
   * 检查并执行压缩
   */
  _checkAndCompress() {
    const ratio = this.currentTokenCount / this.maxTokens;
    
    if (ratio >= this.hardLimitThreshold) {
      // 硬限制：强制压缩到最低
      console.error(`[ContextManager] ⚠️ 上下文超限${(ratio * 100).toFixed(1)}%！强制极端压缩...`);
      this._compressAllToLevel(COMPRESSION_LEVELS.EXTREME.level);
    } else if (ratio >= this.warningThreshold) {
      // 警戒：渐进压缩
      console.warn(`[ContextManager] ⚠️ 上下文达到${(ratio * 100).toFixed(1)}%，启动渐进压缩...`);
      this._compressProgressively();
    }
  }

  /**
   * 渐进压缩：从低优先级项目开始
   */
  _compressProgressively() {
    // 按优先级排序（低优先级的先压缩）
    const sorted = [...this.contextItems].sort((a, b) => b.priority - a.priority);
    
    for (const item of sorted) {
      if (this.currentTokenCount / this.maxTokens < this.warningThreshold) {
        break; // 已降到安全范围
      }
      
      // 跳过已极端压缩的
      if (item.compressedLevel >= COMPRESSION_LEVELS.EXTREME.level) continue;
      
      // 提升压缩级别
      const newLevel = Math.min(item.compressedLevel + 1, COMPRESSION_LEVELS.EXTREME.level);
      this.compressItem(item, newLevel);
      this._recalculateTokenCount();
    }
  }

  /**
   * 强制所有项目压缩到指定级别
   */
  _compressAllToLevel(level) {
    for (const item of this.contextItems) {
      if (item.compressedLevel < level) {
        this.compressItem(item, level);
      }
    }
    this._recalculateTokenCount();
  }

  /**
   * 重新计算总token数
   */
  _recalculateTokenCount() {
    this.currentTokenCount = this.contextItems.reduce((sum, item) => {
      return sum + (item.currentTokens || this.estimateTokens(item.content));
    }, 0);
  }

  /**
   * 获取当前上下文摘要
   */
  getContextSummary() {
    const ratio = this.currentTokenCount / this.maxTokens;
    
    return {
      totalTokens: this.currentTokenCount,
      maxTokens: this.maxTokens,
      ratio,
      status: ratio >= this.hardLimitThreshold ? 'CRITICAL' : 
              ratio >= this.warningThreshold ? 'WARNING' : 'OK',
      itemCount: this.contextItems.length,
      compressionStats: { ...this.compressionStats },
      items: this.contextItems.map(item => ({
        id: item.id,
        type: item.type,
        priority: item.priority,
        compressedLevel: item.compressedLevel,
        originalTokens: item.originalTokens,
        currentTokens: item.currentTokens
      }))
    };
  }

  /**
   * 获取用于LLM调用的上下文内容
   */
  getLLMContext() {
    // 按优先级排序：高优先级的在前
    const sorted = [...this.contextItems].sort((a, b) => a.priority - b.priority);
    
    return sorted.map(item => ({
      role: 'system',
      content: `[${item.type}] ${item.content}`
    }));
  }

  /**
   * 清空上下文
   */
  clear() {
    this.contextItems = [];
    this.currentTokenCount = 0;
    this.compressionStats = { totalCompressed: 0, totalSaved: 0, byLevel: {} };
  }

  /**
   * 移除指定上下文项
   */
  removeContextItem(id) {
    const index = this.contextItems.findIndex(item => item.id === id);
    if (index >= 0) {
      const item = this.contextItems[index];
      this.contextItems.splice(index, 1);
      this._recalculateTokenCount();
      return item;
    }
    return null;
  }

  /**
   * 恢复指定上下文项到原始内容
   */
  restoreItem(id) {
    const item = this.contextItems.find(i => i.id === id);
    if (item && item.originalContent) {
      item.content = item.originalContent;
      item.compressedLevel = COMPRESSION_LEVELS.FULL.level;
      item.currentTokens = item.originalTokens;
      this._recalculateTokenCount();
      return true;
    }
    return false;
  }
}

// ============ 静态工具方法 ============

/**
 * 快速估算token（不创建实例）
 */
function quickEstimateTokens(str) {
  if (!str || typeof str !== 'string') return 0;
  
  let chinese = 0, english = 0, other = 0;
  
  for (const char of str) {
    const code = char.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) chinese++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) english++;
    else if (code >= 0x30 && code <= 0x39) other += 0.5;
    else other += 0.3;
  }
  
  return Math.ceil(
    chinese * TOKEN_CONFIG.chineseChar +
    (english / 5) * TOKEN_CONFIG.englishWord +
    other +
    TOKEN_CONFIG.systemOverhead
  ) * (1 + TOKEN_CONFIG.safetyBuffer);
}

/**
 * 检查是否需要压缩
 */
function shouldCompress(str, maxTokens = TOKEN_CONFIG.maxContextWindow) {
  const tokens = quickEstimateTokens(str);
  return tokens / maxTokens >= TOKEN_CONFIG.warningThreshold;
}

// ============ 导出 ============
module.exports = {
  ContextManager,
  TOKEN_CONFIG,
  COMPRESSION_LEVELS,
  quickEstimateTokens,
  shouldCompress
};

// CLI测试
if (require.main === module) {
  const cm = new ContextManager();
  
  console.log('🧪 Context Manager v9.3-Peng 测试\n');
  
  // 测试1：token估算
  const testStr = '这是一个测试字符串，包含中文和English words。';
  const tokens = cm.estimateTokens(testStr);
  console.log(`✅ Token估算: "${testStr.substring(0, 30)}..." = ${tokens} tokens`);
  
  // 测试2：添加上下文
  const shot1 = {
    id: 'shot_1',
    name: '开场镜头',
    description: '主角站在山顶，远眺城市夜景，灯火辉煌，微风拂面，表情坚毅',
    character: '主角',
    action: '站立远眺',
    emotion: '坚毅',
    camera: '广角远景',
    duration: 5
  };
  
  const id1 = cm.addContextItem('shot', JSON.stringify(shot1), 0, 'shot_1');
  console.log(`✅ 添加镜头: shot_1, 原始${cm.contextItems[0].originalTokens} tokens`);
  
  // 测试3：添加多个镜头
  for (let i = 2; i <= 10; i++) {
    const shot = { ...shot1, id: `shot_${i}`, description: `这是第${i}个镜头的详细描述，包含大量环境细节和角色动作描写`.repeat(5) };
    cm.addContextItem('shot', JSON.stringify(shot), i < 4 ? 1 : 3, `shot_${i}`);
  }
  
  const summary = cm.getContextSummary();
  console.log(`\n📊 上下文摘要:`);
  console.log(`   总Token: ${summary.totalTokens} / ${summary.maxTokens}`);
  console.log(`   使用率: ${(summary.ratio * 100).toFixed(1)}%`);
  console.log(`   状态: ${summary.status}`);
  console.log(`   项目数: ${summary.itemCount}`);
  console.log(`   压缩次数: ${summary.compressionStats.totalCompressed}`);
  console.log(`   节省Token: ${summary.compressionStats.totalSaved}`);
  
  // 测试4：获取LLM上下文
  const llmContext = cm.getLLMContext();
  console.log(`\n📝 LLM上下文: ${llmContext.length} 条消息`);
  
  console.log('\n✅ Context Manager 测试完成！');
}
