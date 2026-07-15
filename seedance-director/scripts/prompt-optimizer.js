#!/usr/bin/env node
/**
 * Prompt Optimizer v1.0-Peng
 * 提示词优化师 — 专业级Prompt压缩与重构
 * 
 * 位置: Compliance Agent之后, Pitch Evaluation之前
 * 角色: 不是简单删除, 而是\"语义理解 + 智能重构 + 质量预判\"
 */

const MAX_PROMPT_LENGTH = 490;

// P0要素: 绝对不可删除
const P0_ELEMENTS = {
  subject: ['主角', '人物', '角色', '大圣', '机甲', '茶农', '宇航员', '女孩', '精灵'],
  action: ['推', '拉', '摇', '移', '跟', '环绕', '手持', '升降', '旋转', '飞', '打', '追', '逃'],
  lighting: ['逆光', '侧光', '顶光', '底光', '自然光', '体积光', '霓虹', '柔光', '丁达尔'],
  style: ['国风', '水墨', 'cinematic', '写实', '3D', 'CG', '动漫', '纪录片', '文艺']
};

// 可压缩的高频冗余词
const REDUNDANT_PATTERNS = [
  { pattern: /非常|极其|特别|十分|相当/g, replace: '' },
  { pattern: /美丽的|漂亮的|好看的|优美的/g, replace: '绝美的' },
  { pattern: /很大的|巨大的|庞大的|宏伟的/g, replace: '宏大的' },
  { pattern: /慢慢地|缓缓地|逐渐地/g, replace: '' },
  { pattern: /看起来|看上去|显得/g, replace: '' },
  { pattern: /,\s*,+/g, replace: ',' },
  { pattern: /，\s*，+/g, replace: '，' }
];

// 专业术语替换表 (冗长 → 精炼)
const TERM_REPLACEMENTS = {
  '工业光魔级视觉特效': '工业级VFX',
  'UnrealEngine5渲染': 'UE5渲染',
  '电影级摄影': '电影摄影',
  '高清晰度': '高清',
  '三维动画': '3D动画',
  '计算机图形': 'CG',
  '虚拟现实': 'VR',
  '增强现实': 'AR',
  '人工智能': 'AI',
  '机器学习': 'ML'
};

class PromptOptimizer {
  constructor(options = {}) {
    this.maxLength = options.maxLength || MAX_PROMPT_LENGTH;
    this.debug = options.debug || false;
    this.strategy = options.strategy || 'semantic'; // semantic | layer | llm
  }

  /**
   * 主入口: 优化Prompt
   * @param {string} prompt - 原始提示词
   * @param {Object} shot - 镜头信息(用于P0守护)
   * @returns {Object} 优化结果
   */
  optimize(prompt, shot = {}) {
    const originalLength = prompt.length;

    // 1. 预检: ≤490字直接放行
    if (originalLength <= this.maxLength) {
      return {
        action: 'pass',
        gateDecision: 'PASS',
        optimized: false,
        optimizedPrompt: prompt,
        originalLength,
        finalLength: originalLength,
        compressionRatio: '0%',
        strategy: 'none',
        preserved: this._extractAllElements(prompt),
        removed: [],
        replaced: [],
        qualityScore: 1.0,
        qualityComment: '已合规,无需优化',
        warnings: []
      };
    }

    // 2. 分析溢出量
    const overflow = originalLength - this.maxLength;
    
    // 3. 选择优化策略
    let result;
    if (this.strategy === 'semantic') {
      result = this._semanticOptimize(prompt, overflow, shot);
    } else if (this.strategy === 'layer') {
      result = this._layerOptimize(prompt, overflow, shot);
    } else {
      result = this._ruleOptimize(prompt, overflow, shot);
    }

    // 4. P0守护验证
    const missingP0 = this._checkP0Integrity(result.optimizedPrompt, shot);
    
    // 5. 质量评估
    const qualityScore = this._assessQuality(result.optimizedPrompt, prompt, shot);
    
    // 6. 最终决策
    let gateDecision = 'PASS';
    let warnings = [];
    
    if (missingP0.length > 0) {
      gateDecision = 'BLOCK';
      warnings.push(`P0要素丢失: ${missingP0.join(', ')}`);
    } else if (result.finalLength > this.maxLength) {
      gateDecision = 'WARN';
      warnings.push(`优化后仍超标: ${result.finalLength} > ${this.maxLength}`);
    } else if (qualityScore < 0.8) {
      gateDecision = 'WARN';
      warnings.push(`质量分偏低: ${qualityScore.toFixed(2)} < 0.80`);
    }

    return {
      action: gateDecision === 'BLOCK' ? 'reject' : 'optimize',
      gateDecision,
      optimized: true,
      optimizedPrompt: result.optimizedPrompt,
      originalLength,
      finalLength: result.finalLength,
      compressionRatio: `${Math.round((1 - result.finalLength / originalLength) * 100)}%`,
      strategy: this.strategy,
      preserved: result.preserved,
      removed: result.removed,
      replaced: result.replaced,
      qualityScore,
      qualityComment: this._generateQualityComment(qualityScore, result),
      warnings,
      overflow
    };
  }

  // ========== 策略1: 语义优化 ==========
  _semanticOptimize(prompt, overflow, shot) {
    let optimized = prompt;
    const removed = [];
    const replaced = [];
    const preserved = this._extractAllElements(prompt);

    // 阶段1: 术语替换 (无损压缩)
    for (const [long, short] of Object.entries(TERM_REPLACEMENTS)) {
      if (optimized.includes(long)) {
        optimized = optimized.replace(new RegExp(long, 'g'), short);
        replaced.push({ from: long, to: short, reason: '术语精简' });
      }
    }

    // 阶段2: 冗余词删除
    for (const { pattern, replace } of REDUNDANT_PATTERNS) {
      const before = optimized;
      optimized = optimized.replace(pattern, replace);
      if (optimized !== before) {
        removed.push({ content: pattern.toString(), reason: '冗余词删除' });
      }
    }

    // 阶段3: 重复语义合并
    optimized = this._mergeDuplicateDescriptions(optimized, removed);

    // 阶段4: 如果还超长, 删除修饰层
    if (optimized.length > this.maxLength) {
      optimized = this._removeDecorativeLayer(optimized, removed);
    }

    // 阶段5: 如果还超长, 压缩增强层
    if (optimized.length > this.maxLength) {
      optimized = this._compressEnhanceLayer(optimized, replaced);
    }

    // 阶段6: 最后手段, 删除次要动作
    if (optimized.length > this.maxLength) {
      optimized = this._removeSecondaryActions(optimized, removed, shot);
    }
    
    // 阶段7: 如果还超长, 删除重复描述
    if (optimized.length > this.maxLength) {
      optimized = this._mergeDuplicateDescriptions(optimized, removed);
    }
    
    // 阶段8: 如果还超长, 强制截断(最后手段)
    if (optimized.length > this.maxLength) {
      const truncated = optimized.substring(0, this.maxLength);
      removed.push({ content: optimized.substring(this.maxLength), reason: '强制截断' });
      optimized = truncated;
    }

    return {
      optimizedPrompt: optimized,
      finalLength: optimized.length,
      preserved,
      removed,
      replaced
    };
  }

  // ========== 策略2: 分层优化 ==========
  _layerOptimize(prompt, overflow, shot) {
    // 将prompt分为三层
    const layers = this._splitIntoLayers(prompt, shot);
    
    let optimized = layers.core; // 核心层绝对保留
    const removed = [];
    const replaced = [];

    // 优先保留增强层
    if (layers.enhance) {
      if ((optimized + layers.enhance).length <= this.maxLength) {
        optimized += layers.enhance;
      } else {
        // 压缩增强层
        const compressed = this._compressEnhanceLayer(layers.enhance, replaced);
        if ((optimized + compressed).length <= this.maxLength) {
          optimized += compressed;
        } else {
          removed.push({ content: 'enhance_layer', reason: '空间不足' });
        }
      }
    }

    // 修饰层最后考虑
    if (layers.decor && optimized.length + layers.decor.length <= this.maxLength) {
      optimized += layers.decor;
    } else if (layers.decor) {
      removed.push({ content: 'decor_layer', reason: '空间不足' });
    }

    return {
      optimizedPrompt: optimized,
      finalLength: optimized.length,
      preserved: this._extractAllElements(optimized),
      removed,
      replaced
    };
  }

  // ========== 策略3: 规则优化(兜底) ==========
  _ruleOptimize(prompt, overflow, shot) {
    let optimized = prompt;
    const removed = [];
    const replaced = [];

    // 按优先级逐步裁剪
    const steps = [
      () => this._removeRedundantAdjectives(optimized, removed),
      () => this._simplifyConnectors(optimized, replaced),
      () => this._removeSecondaryDetails(optimized, removed, shot),
      () => this._truncateEnd(optimized, removed, this.maxLength)
    ];

    for (const step of steps) {
      if (optimized.length > this.maxLength) {
        optimized = step();
      }
    }

    return {
      optimizedPrompt: optimized,
      finalLength: optimized.length,
      preserved: this._extractAllElements(optimized),
      removed,
      replaced
    };
  }

  // ========== 工具方法 ==========

  _extractAllElements(prompt) {
    const elements = [];
    for (const [category, keywords] of Object.entries(P0_ELEMENTS)) {
      for (const kw of keywords) {
        if (prompt.includes(kw)) {
          elements.push({ type: category, content: kw });
        }
      }
    }
    return elements;
  }

  _checkP0Integrity(prompt, shot) {
    const missing = [];
    
    // 检查主体
    if (shot.subject && !prompt.includes(shot.subject)) {
      missing.push(`主体[${shot.subject}]`);
    }
    
    // 检查动作
    if (shot.action && !prompt.includes(shot.action)) {
      // 动作可能是同义词, 需要模糊匹配
      const actionKeywords = P0_ELEMENTS.action;
      const hasAction = actionKeywords.some(kw => prompt.includes(kw));
      if (!hasAction) {
        missing.push(`动作元素`);
      }
    }
    
    // 检查光影
    const hasLighting = P0_ELEMENTS.lighting.some(kw => prompt.includes(kw));
    if (!hasLighting) {
      missing.push('光影');
    }
    
    // 检查风格
    const hasStyle = P0_ELEMENTS.style.some(kw => prompt.includes(kw));
    if (!hasStyle) {
      missing.push('风格');
    }

    return missing;
  }

  _mergeDuplicateDescriptions(prompt, removed) {
    // 合并重复描述: \"美丽的场景, 漂亮的风景\" → \"绝美风景\"
    const duplicates = [
      { pattern: /(美丽的|漂亮的|绝美的|好看的)\s*(场景|风景|画面|背景)/g, replace: '绝美风景' },
      { pattern: /(巨大的|庞大的|宏伟的|宏大的)\s*(建筑|城市|空间|场景)/g, replace: '宏大场景' }
    ];
    
    let result = prompt;
    for (const { pattern, replace } of duplicates) {
      const before = result;
      result = result.replace(pattern, replace);
      if (result !== before) {
        removed.push({ content: pattern.toString(), reason: '重复语义合并' });
      }
    }
    return result;
  }

  _removeDecorativeLayer(prompt, removed, preserved) {
    // 删除修饰性形容词和副词
    const decorativePatterns = [
      /非常地|极其地|十分地|相当/g,
      /看起来是|看上去是|显得/g,
      /仿佛|好像|如同|好似/g
    ];
    
    let result = prompt;
    for (const pattern of decorativePatterns) {
      const before = result;
      result = result.replace(pattern, '');
      if (result !== before) {
        removed.push({ content: pattern.toString(), reason: '修饰层删除' });
      }
    }
    return result;
  }

  _compressEnhanceLayer(prompt, replaced, preserved) {
    // 压缩增强层描述: \"温暖的金色阳光\" → \"暖金光\"
    const compressions = [
      { pattern: /温暖的\s*(金色|黄色|橙色)\s*阳光/g, replace: '暖金光' },
      { pattern: /冰冷的\s*(蓝色|青色|银色)\s*月光/g, replace: '冷银光' },
      { pattern: /柔和的\s*(白色|米色)\s*灯光/g, replace: '柔白光' }
    ];
    
    let result = prompt;
    for (const { pattern, replace } of compressions) {
      const before = result;
      result = result.replace(pattern, replace);
      if (result !== before) {
        replaced.push({ from: pattern.toString(), to: replace, reason: '增强层压缩' });
      }
    }
    return result;
  }

  _removeSecondaryActions(prompt, removed, shot) {
    // 保留主动作, 删除次要动作
    const mainAction = shot.action || '';
    const allActions = P0_ELEMENTS.action;
    const preserved = this._extractAllElements(prompt);
    
    let result = prompt;
    for (const action of allActions) {
      if (action !== mainAction && result.includes(action)) {
        // 检查这个动作是否是P0要素
        const isP0 = preserved.some(p => p.content === action);
        if (!isP0) {
          result = result.replace(new RegExp(action, 'g'), '');
          removed.push({ content: action, reason: '次要动作删除' });
        }
      }
    }
    return result;
  }

  _splitIntoLayers(prompt, shot) {
    // 将prompt分层
    const layers = {
      core: '',      // 主体+动作+光影+风格
      enhance: '',   // 情绪+运镜+材质+氛围
      decor: ''      // 冗余修饰
    };

    // 提取核心层
    const corePatterns = [
      new RegExp(`${shot.subject || '主角'}.+?(${P0_ELEMENTS.action.join('|')})`),
      new RegExp(`(${P0_ELEMENTS.lighting.join('|')})`),
      new RegExp(`(${P0_ELEMENTS.style.join('|')})`)
    ];
    
    // 简单实现: 假设前半部分为核心, 后半部分为增强+修饰
    const midPoint = Math.floor(prompt.length * 0.6);
    layers.core = prompt.substring(0, midPoint);
    layers.enhance = prompt.substring(midPoint, Math.floor(prompt.length * 0.85));
    layers.decor = prompt.substring(Math.floor(prompt.length * 0.85));

    return layers;
  }

  _assessQuality(optimized, original, shot) {
    // 质量评估: 对比优化前后的信息保留率
    const originalElements = this._extractAllElements(original);
    const optimizedElements = this._extractAllElements(optimized);
    
    const retentionRate = optimizedElements.length / originalElements.length;
    const lengthRatio = optimized.length / original.length;
    
    // 质量分 = 信息保留率 * (1 - 长度压缩惩罚)
    const compressionPenalty = Math.max(0, (490 - optimized.length) / 490);
    const quality = retentionRate * (0.7 + 0.3 * compressionPenalty);
    
    return Math.min(1.0, quality);
  }

  _generateQualityComment(score, result) {
    if (score >= 0.95) return '完美优化,无损压缩';
    if (score >= 0.85) return '优质优化,信息保留完整';
    if (score >= 0.75) return '良好优化,轻微信息损失';
    if (score >= 0.65) return '一般优化,部分信息损失';
    return '优化过度,建议人工复核';
  }
}

// ========== CLI接口 ==========
if (require.main === module) {
  const fs = require('fs').promises;
const fss = require('fs');
  
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('用法: node prompt-optimizer.js <input.json> [output.json]');
    console.log('  input.json: { prompt: "...", shot: {...} }');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace('.json', '-optimized.json');

  const input = JSON.parse(fss.readFileSync(inputFile, 'utf8'));
  const optimizer = new PromptOptimizer({ strategy: 'semantic', debug: true });
  const result = optimizer.optimize(input.prompt, input.shot);

  fss.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`✅ 优化完成: ${result.originalLength} → ${result.finalLength} (${result.compressionRatio})`);
  console.log(`📊 质量分: ${result.qualityScore.toFixed(2)}`);
  console.log(`🎯 决策: ${result.gateDecision}`);
  if (result.warnings.length > 0) {
    console.log(`⚠️ 警告: ${result.warnings.join(', ')}`);
  }
}

module.exports = { PromptOptimizer };