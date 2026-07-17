const fs = require('fs');
const path = require('path');

/**
 * 创意指数解析器 (Creativity Index Parser)
 * 
 * 职责：将用户输入的自然语言转换为 0.0-1.0 的量化指数
 * 支持：明确数值、模糊描述、程度副词、比喻表达
 */

class CreativityIndexParser {
  constructor() {
    this.version = '1.0.0';
    
    // 关键词映射表
    this.keywordMappings = {
      // 极低 (0.0-0.2)
      '极简': 0.1, 'minimal': 0.1, '最简单': 0.1, '基础': 0.15,
      'basic': 0.15, 'standard': 0.2, '标准': 0.2, '默认': 0.2,
      'normal': 0.2, '普通': 0.2, '不干预': 0.2, '无创意': 0.1,
      
      // 低 (0.2-0.4)
      '轻度': 0.3, 'light': 0.3, '轻微': 0.3, '简单': 0.35,
      'slight': 0.3, 'subtle': 0.35, '含蓄': 0.35, '保守': 0.35,
      '保守一点': 0.35, '稍微': 0.3, '一点点': 0.25, '有点': 0.3,
      
      // 中 (0.4-0.6)
      '中等': 0.5, 'moderate': 0.5, '适度': 0.5, '适中': 0.5,
      'medium': 0.5, 'balanced': 0.5, '平衡': 0.5, '一般': 0.5,
      '正常': 0.5, '普通': 0.5, '还可以': 0.55, '不错': 0.55,
      '增强': 0.6, 'enhanced': 0.6, '加强': 0.6, '提升': 0.6,
      
      // 高 (0.6-0.8)
      '高': 0.7, 'high': 0.7, '较高': 0.7, '有创意': 0.7,
      'creative': 0.7, '有想法': 0.7, '独特': 0.75, 'unusual': 0.75,
      '特别': 0.75, 'special': 0.75, '非常有创意': 0.75, '很有创意': 0.75,
      '艺术': 0.8, 'artistic': 0.8, '艺术化': 0.8, '风格化': 0.8,
      'stylized': 0.8, '个性化': 0.8, '电影级': 0.75, 'cinematic': 0.75,
      '好莱坞': 0.8, 'hollywood': 0.8, '大片感': 0.8, '大片': 0.8,
      
      // 极高 (0.8-1.0)
      '极高': 0.9, 'extreme': 0.9, '极致': 0.95, 'maximum': 0.95,
      '极限': 0.95, '拉满': 0.95, '拉满': 0.95, '天花板': 0.95,
      '创意天花板': 0.95, '顶格': 0.95, '顶级': 0.95, '顶配': 0.95,
      '满分': 0.95, 'max': 0.95, 'maximum': 0.95, '全开': 0.95,
      '疯狂': 0.9, 'crazy': 0.9, '爆发': 0.9, '炸裂': 0.9,
      '惊艳': 0.9, '震撼': 0.9, '突破性': 0.9, 'breakthrough': 0.9,
      '史诗': 0.9, 'epic': 0.9, '传奇': 0.9, 'legendary': 0.9,
      '神级': 0.95, 'god-tier': 0.95, '超神': 0.95, '封神': 0.95
    };
    
    // 程度副词修饰器
    this.modifiers = {
      '很': 0.1, '非常': 0.15, '特别': 0.1, '超级': 0.15,
      '极度': 0.2, '极端': 0.2, '极其': 0.2, '十分': 0.1,
      '稍微': -0.1, '有点': -0.05, '略': -0.05, '比较': 0.05,
      '还算': 0.0, '挺': 0.05, '蛮': 0.05, '怪': 0.1,
      '太': 0.1, '真': 0.05, '够': 0.1, '挺': 0.05
    };
    
    // 否定词
    this.negations = ['不', '没', '无', '非', '别', '勿', '莫', '不要', '不能', '不会', '没有'];
  }
  
  /**
   * 解析用户输入，提取创意指数
   * @param {string|number} input - 用户输入
   * @returns {object} - 解析结果
   */
  parse(input) {
    // 如果已经是数字，直接返回
    if (typeof input === 'number') {
      return this._validateAndReturn(input, 'numeric');
    }
    
    // 如果是字符串，尝试解析
    if (typeof input === 'string') {
      return this._parseString(input);
    }
    
    // 默认值
    return this._validateAndReturn(0.2, 'default');
  }
  
  _parseString(str) {
    // 1. 尝试直接提取数字（如 "0.7", "创意指数 0.8", "cp 0.9"）
    const numericMatch = str.match(/(?:创意指数|cp|CI|ci| creativity |index|指数)?[:\s]*([0-9]*\.?[0-9]+)/i);
    if (numericMatch) {
      const value = parseFloat(numericMatch[1]);
      if (value >= 0 && value <= 1) {
        return this._validateAndReturn(value, 'numeric-explicit');
      }
      // 可能是 0-100 或 0-10 的表示
      if (value > 1 && value <= 10) {
        return this._validateAndReturn(value / 10, 'numeric-scaled-10');
      }
      if (value > 10 && value <= 100) {
        return this._validateAndReturn(value / 100, 'numeric-scaled-100');
      }
    }
    
    // 2. 尝试关键词匹配
    const keywordResult = this._matchKeywords(str);
    if (keywordResult && keywordResult.metadata && keywordResult.metadata.found) {
      return keywordResult;
    }
    
    // 3. 语义分析（模糊匹配）
    const semanticResult = this._semanticAnalysis(str);
    if (semanticResult && semanticResult.metadata && semanticResult.metadata.found) {
      return semanticResult;
    }
    
    // 4. 默认返回
    return this._validateAndReturn(0.2, 'default');
  }
  
  _matchKeywords(str) {
    // 清理字符串，去除多余空格和标点
    const cleanStr = str.toLowerCase().replace(/[，。！？.,!?]/g, '');
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [keyword, value] of Object.entries(this.keywordMappings)) {
      if (cleanStr.includes(keyword.toLowerCase())) {
        // 计算匹配得分（完整词匹配得分更高）
        const score = this._calculateMatchScore(cleanStr, keyword.toLowerCase());
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { keyword, value, score };
        }
      }
    }
    
    if (bestMatch) {
      // 检查否定词
      const hasNegation = this._hasNegationBeforeKeyword(cleanStr, bestMatch.keyword.toLowerCase());
      if (hasNegation) {
        // 否定词降低指数（但不能低于0.2）
        const adjustedValue = Math.max(0.2, bestMatch.value - 0.3);
        return this._validateAndReturn(adjustedValue, 'keyword-negated', {
          originalValue: bestMatch.value,
          keyword: bestMatch.keyword,
          negation: true,
          found: true
        });
      }
      
      // 检查程度副词
      const modifier = this._findModifierBeforeKeyword(cleanStr, bestMatch.keyword.toLowerCase());
      if (modifier) {
        const adjustedValue = Math.min(1.0, Math.max(0.0, bestMatch.value + modifier.value));
        return this._validateAndReturn(adjustedValue, 'keyword-modified', {
          originalValue: bestMatch.value,
          keyword: bestMatch.keyword,
          modifier: modifier.word,
          modifierValue: modifier.value,
          found: true
        });
      }
      
      return this._validateAndReturn(bestMatch.value, 'keyword', {
        keyword: bestMatch.keyword,
        found: true
      });
    }
    
    return { found: false };
  }
  
  _semanticAnalysis(str) {
    // 语义分析：根据句子整体情感倾向判断
    const positiveIndicators = ['创意', '艺术', '风格', '独特', '新颖', '突破', '惊艳', '震撼', '精彩', '高级', '质感', '调性'];
    const negativeIndicators = ['简单', '基础', '普通', '标准', '常规', '一般', '朴素', '清淡', '保守'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    for (const word of positiveIndicators) {
      if (str.includes(word)) positiveScore += 1;
    }
    
    for (const word of negativeIndicators) {
      if (str.includes(word)) negativeScore += 1;
    }
    
    if (positiveScore > 0 || negativeScore > 0) {
      const total = positiveScore + negativeScore;
      const ratio = positiveScore / total;
      
      // 映射到 0.2-0.8 范围
      const value = 0.2 + (ratio * 0.6);
      return this._validateAndReturn(value, 'semantic', {
        positiveScore,
        negativeScore,
        ratio,
        found: true
      });
    }
    
    return { found: false };
  }
  
  _calculateMatchScore(str, keyword) {
    // 完整词匹配得分更高
    const index = str.indexOf(keyword);
    if (index === -1) return 0;
    
    // 检查是否是完整词（前后不是汉字字符）
    const before = index > 0 ? str[index - 1] : ' ';
    const after = index + keyword.length < str.length ? str[index + keyword.length] : ' ';
    
    const isWordBoundary = !/[\u4e00-\u9fa5a-zA-Z]/.test(before) && !/[\u4e00-\u9fa5a-zA-Z]/.test(after);
    
    return isWordBoundary ? 2 : 1;
  }
  
  _hasNegationBeforeKeyword(str, keyword) {
    const index = str.indexOf(keyword);
    if (index === -1) return false;
    
    // 检查关键词前5个字符内是否有否定词
    const beforeText = str.substring(Math.max(0, index - 5), index);
    return this.negations.some(neg => beforeText.includes(neg));
  }
  
  _findModifierBeforeKeyword(str, keyword) {
    const index = str.indexOf(keyword);
    if (index === -1) return null;
    
    // 检查关键词前5个字符内是否有程度副词
    const beforeText = str.substring(Math.max(0, index - 5), index);
    
    for (const [word, value] of Object.entries(this.modifiers)) {
      if (beforeText.includes(word)) {
        return { word, value };
      }
    }
    
    return null;
  }
  
  _validateAndReturn(value, source, metadata = {}) {
    const clamped = Math.max(0.0, Math.min(1.0, value));
    
    return {
      success: true,
      value: clamped,
      source,
      metadata: { ...metadata, found: true },
      level: this._getLevelName(clamped),
      description: this._getLevelDescription(clamped)
    };
  }
  
  _getLevelName(value) {
    if (value <= 0.2) return '极简';
    if (value <= 0.4) return '轻度';
    if (value <= 0.6) return '中度';
    if (value <= 0.8) return '深度';
    return '极致';
  }
  
  _getLevelDescription(value) {
    if (value <= 0.2) return '系统默认，不干预创作';
    if (value <= 0.4) return '轻度干预，基础增强';
    if (value <= 0.6) return '中度干预，电影级质量';
    if (value <= 0.8) return '深度干预，艺术级表现';
    return '极致干预，突破常规';
  }
  
  /**
   * 批量测试解析器
   */
  testCases() {
    const cases = [
      { input: 0.7, expected: 0.7, desc: '直接数值' },
      { input: '创意指数 0.8', expected: 0.8, desc: '明确数值' },
      { input: 'cp 0.5', expected: 0.5, desc: '缩写' },
      { input: '非常有创意', expected: 0.75, desc: '程度描述' },
      { input: '创意天花板', expected: 0.95, desc: '比喻表达' },
      { input: '极简', expected: 0.1, desc: '极简风格' },
      { input: '标准', expected: 0.2, desc: '标准风格' },
      { input: '好莱坞级别', expected: 0.8, desc: '级别描述' },
      { input: '稍微有创意', expected: 0.6, desc: '程度副词修饰' },
      { input: '不要太创意', expected: 0.45, desc: '否定词' },
      { input: '普通', expected: 0.2, desc: '普通风格' },
      { input: '80分', expected: 0.8, desc: '百分制' },
      { input: '8分', expected: 0.8, desc: '十分制' },
      { input: 'unknown', expected: 0.2, desc: '未知输入' }
    ];
    
    const results = [];
    for (const test of cases) {
      const result = this.parse(test.input);
      const passed = Math.abs(result.value - test.expected) < 0.05;
      results.push({
        input: test.input,
        expected: test.expected,
        actual: result.value,
        passed,
        source: result.source,
        desc: test.desc
      });
    }
    
    return results;
  }
}

module.exports = { CreativityIndexParser };
