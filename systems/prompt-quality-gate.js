/**
 * Prompt质量门禁系统 v1.0 (P0-3)
 * 多级质量评分与阻断机制
 *
 * 核心设计：
 * - Gate-1 Prompt级评分: ≥75分放行, 60-74分警告待审, <60分阻断重生成
 * - Gate-2 完整性校验: 保持现有16项检查
 * - 评分维度: Tier完整性/视觉纯度/利用率/技术有效性/情绪一致性/约束完整性
 *
 * @version v1.0
 * @author 小G
 */

class PromptQualityGate {
  constructor(options = {}) {
    this.thresholds = {
      pass: options.passThreshold || 75,
      warning: options.warningThreshold || 60,
      block: options.blockThreshold || 0
    };
    
    this.weights = {
      tier1Completeness: 25,    // Tier-1完整性（最重要）
      visualPurity: 20,          // 视觉纯度（无旁白污染）
      utilization: 15,           // 字符利用率
      techValidity: 15,           // 技术规格有效性
      emotionConsistency: 15,   // 情绪-表情一致性
      negativeCompleteness: 10  // 负面约束完整性
    };
    
    // 无效技术声明清单（P0-3与P1-4共享）
    this.invalidTechTerms = [
      '虚幻引擎5', 'Lumen', 'Nanite',
      '超写实 3D 数字人渲染',
      '8K分辨率', '写实概念美术',
      '光线追踪', '全局光照'
    ];
    
    // 情绪-表情映射（P0-3与P1-5共享）
    this.emotionExpressionMap = {
      'establishing': ['neutral', 'relaxed', 'calm', 'peaceful', '平静', '放松', '安详', '舒展', '安宁'],
      'rising': ['alert', 'tense', 'widening eyes', 'anticipation', '警觉', '紧张', '睁大', '期待', '凝视', '屏息'],
      'building': ['intense', 'focused', 'jaw set', 'determined', '专注', '坚定', '咬牙', '紧绷', '集中'],
      'climax': ['powerful', 'sharp', 'dynamic', 'transformative', '强烈', '锐利', '激动', '震撼', '爆发', '颤抖'],
      'resolve': ['gentle', 'soft', 'peaceful', 'relaxed', '温柔', '柔和', '平静', '释然', '微笑', '放松'],
      'opening': ['awe', 'wonder', 'grand', 'majestic', '敬畏', '惊叹', '壮观', '宏大', '震撼', '仰望']
    };
    
    // 必需负面约束（P0-3与全局负面提示词共享）
    this.requiredNegatives = [
      'no metallic shine',
      'no traditional Chinese symbols',
      'natural eye colors only'
    ];
  }

  /**
   * 主入口：质量评分
   * @param {Object} promptData - Prompt数据
   * @param {string} promptData.prompt - 最终Prompt文本
   * @param {Object} promptData.tiers - Tier分层数据
   * @param {string} promptData.emotionPhase - 情绪阶段
   * @param {boolean} promptData.hasDialogue - 是否有对话
   * @param {string} promptData.narration - 原始旁白（用于纯度检查）
   * @returns {Object} { score, grade, passed, report }
   */
  evaluate(promptData) {
    const startTime = Date.now();
    console.log(`[QualityGate] 🔍 质量评分开始`);
    
    const scores = {};
    const details = [];
    
    // 维度1: Tier-1完整性
    const tier1Result = this._evaluateTier1(promptData);
    scores.tier1Completeness = tier1Result.score;
    details.push(tier1Result);
    
    // 维度2: 视觉纯度
    const purityResult = this._evaluateVisualPurity(promptData);
    scores.visualPurity = purityResult.score;
    details.push(purityResult);
    
    // 维度3: 字符利用率
    const utilResult = this._evaluateUtilization(promptData);
    scores.utilization = utilResult.score;
    details.push(utilResult);
    
    // 维度4: 技术规格有效性
    const techResult = this._evaluateTechValidity(promptData);
    scores.techValidity = techResult.score;
    details.push(techResult);
    
    // 维度5: 情绪-表情一致性
    const emotionResult = this._evaluateEmotionConsistency(promptData);
    scores.emotionConsistency = emotionResult.score;
    details.push(emotionResult);
    
    // 维度6: 负面约束完整性
    const negativeResult = this._evaluateNegativeCompleteness(promptData);
    scores.negativeCompleteness = negativeResult.score;
    details.push(negativeResult);
    
    // 计算总分
    let totalScore = 0;
    for (const [key, weight] of Object.entries(this.weights)) {
      totalScore += (scores[key] / 100) * weight;
    }
    totalScore = Math.round(totalScore);
    
    // 评级
    let grade, passed, action;
    if (totalScore >= this.thresholds.pass) {
      grade = 'A';
      passed = true;
      action = '放行';
    } else if (totalScore >= this.thresholds.warning) {
      grade = 'B';
      passed = true;
      action = '警告待审';
    } else {
      grade = 'C';
      passed = false;
      action = '阻断重生成';
    }
    
    const duration = Date.now() - startTime;
    console.log(`[QualityGate] ✅ 评分完成 | 总分: ${totalScore} | 评级: ${grade} | 动作: ${action} | 耗时: ${duration}ms`);
    
    return {
      score: totalScore,
      grade,
      passed,
      action,
      scores,
      details,
      duration,
      report: this._generateReport(totalScore, grade, passed, action, scores, details)
    };
  }

  /**
   * 维度1: Tier-1完整性
   * 检查Tier-1是否包含：主体、动作、核心场景、运镜
   */
  _evaluateTier1(promptData) {
    const prompt = promptData.prompt || '';
    const tier1 = promptData.tiers?.tier1?.text || '';
    
    const checks = {
      hasSubject: /(小G|饕餮|taotie|xiaoG|beast|character|explorer|boy|角色|人物|主体)/i.test(tier1),
      hasAction: /(站|走|跑|伸|推|蹲|看|踏|移动|行动|动作|交互|触碰|抬头|转身|前进|后退|爬|跃|飞|游)/i.test(tier1),
      hasScene: /(Mountain|Lake|Forest|Plains|Nirath|山|海|森林|平原|湖|丘|原|域|环境|场景|钩吾|不周|归墟|青丘|钟山|建木|昆仑|幽都|流沙|银色湖泊)/i.test(tier1),
      hasCamera: /(shot|wide|close|medium|tracking|push|pull|pan|镜头|运镜|推|拉|摇|移|跟|升|降|环绕|俯视|仰视|特写|中景|远景|全景|近景)/i.test(tier1)
    };
    
    const passCount = Object.values(checks).filter(Boolean).length;
    const score = Math.round((passCount / 4) * 100);
    
    const missing = [];
    if (!checks.hasSubject) missing.push('主体');
    if (!checks.hasAction) missing.push('动作');
    if (!checks.hasScene) missing.push('场景');
    if (!checks.hasCamera) missing.push('运镜');
    
    return {
      dimension: 'Tier-1完整性',
      score,
      weight: this.weights.tier1Completeness,
      checks,
      missing: missing.length > 0 ? missing : null,
      comment: score >= 75 ? 'Tier-1完整' : `缺失: ${missing.join(', ')}`
    };
  }

  /**
   * 维度2: 视觉纯度
   * 检查Prompt是否被旁白/叙事语言污染
   */
  _evaluateVisualPurity(promptData) {
    const prompt = promptData.prompt || '';
    const narration = promptData.narration || '';
    
    // 检查旁白原文是否直接出现在Prompt中
    let contaminationScore = 0;
    if (narration && narration.length > 0) {
      // 取旁白前15个字符作为指纹
      const fingerprint = narration.substring(0, 15);
      if (prompt.includes(fingerprint)) {
        contaminationScore += 50;
      }
    }
    
    // 检查叙事性词汇（仅严重叙事性词汇扣分，常见过渡词降低权重）
    const narrativeWords = ['然后', '接着', '突然', '感到', '心中', '回忆'];
    for (const word of narrativeWords) {
      if (prompt.includes(word)) contaminationScore += 3; // v6.2-patch63: 从10分降至3分，避免过度惩罚中文自然表达
    }
    
    const score = Math.max(0, 100 - contaminationScore);
    
    return {
      dimension: '视觉纯度',
      score,
      weight: this.weights.visualPurity,
      contaminationScore,
      comment: score >= 80 ? '视觉纯净' : score >= 60 ? '轻度污染' : '严重污染'
    };
  }

  /**
   * 维度3: 字符利用率
   * 理想区间: 850-1500 (95-100%)
   * 可接受: 750-849 (85-94%)
   * 不足: <750 (<85%)
   */
  _evaluateUtilization(promptData) {
    const prompt = promptData.prompt || '';
    const length = prompt.length;
    
    let score;
    if (length >= 1470 && length <= 1500) {
      score = 100;
    } else if (length >= 850 && length < 1470) {
      score = 85 + Math.round((length - 850) / 10);
    } else if (length >= 750 && length < 850) {
      score = 60 + Math.round((length - 750) / 5);
    } else if (length > 1500) {
      score = 50; // 超标
    } else {
      score = Math.max(0, length / 10);
    }
    
    return {
      dimension: '字符利用率',
      score,
      weight: this.weights.utilization,
      length,
      maxLength: 1500,
      utilization: Math.round((length / 1500) * 100),
      comment: score >= 85 ? '利用率良好' : score >= 60 ? '利用率偏低' : '严重不足'
    };
  }

  /**
   * 维度4: 技术规格有效性
   * 检查是否含有已知的无效技术声明
   */
  _evaluateTechValidity(promptData) {
    const prompt = promptData.prompt || '';
    
    let invalidCount = 0;
    const foundInvalid = [];
    
    for (const term of this.invalidTechTerms) {
      if (prompt.includes(term)) {
        invalidCount++;
        foundInvalid.push(term);
      }
    }
    
    const score = Math.max(0, 100 - (invalidCount * 20));
    
    return {
      dimension: '技术规格有效性',
      score,
      weight: this.weights.techValidity,
      invalidCount,
      foundInvalid: foundInvalid.length > 0 ? foundInvalid : null,
      comment: score >= 80 ? '技术声明有效' : `发现${invalidCount}个无效声明`
    };
  }

  /**
   * 维度5: 情绪-表情一致性
   * 检查Prompt中的表情词汇是否与情绪阶段匹配
   */
  _evaluateEmotionConsistency(promptData) {
    const prompt = promptData.prompt || '';
    const phase = promptData.emotionPhase || 'neutral';
    
    const validExpressions = this.emotionExpressionMap[phase] || [];
    if (validExpressions.length === 0) {
      return {
        dimension: '情绪-表情一致性',
        score: 70,
        weight: this.weights.emotionConsistency,
        comment: '未定义情绪阶段，默认评分'
      };
    }
    
    // 检查Prompt中是否含有匹配的表情词
    let matchCount = 0;
    for (const expr of validExpressions) {
      if (prompt.toLowerCase().includes(expr.toLowerCase())) {
        matchCount++;
      }
    }
    
    // 检查是否有明显错配（如establishing阶段出现紧张表情）
    let mismatchPenalty = 0;
    const mismatchMap = {
      'establishing': ['tense', 'fear', 'panic', 'screaming', 'shouting', '紧张', '恐惧', '惊慌', '尖叫', '大喊'],
      'resolve': ['tense', 'fear', 'panic', '紧张', '恐惧', '惊慌'],
      'climax': ['relaxed', 'sleepy', 'bored', '放松', '困倦', '无聊', ' sleepy']
    };
    
    const mismatches = mismatchMap[phase] || [];
    for (const mm of mismatches) {
      if (prompt.toLowerCase().includes(mm)) {
        mismatchPenalty += 25;
      }
    }
    
    const score = Math.max(0, Math.min(100, (matchCount / validExpressions.length) * 80 + 20 - mismatchPenalty));
    
    return {
      dimension: '情绪-表情一致性',
      score,
      weight: this.weights.emotionConsistency,
      phase,
      matchCount,
      mismatchPenalty,
      comment: score >= 75 ? '情绪-表情匹配' : score >= 50 ? '轻度错配' : '严重错配'
    };
  }

  /**
   * 维度6: 负面约束完整性
   * 检查必需负面约束是否全部包含
   */
  _evaluateNegativeCompleteness(promptData) {
    const prompt = promptData.prompt || '';
    
    let foundCount = 0;
    const found = [];
    const missing = [];
    
    for (const constraint of this.requiredNegatives) {
      // 支持多种变体匹配
      const variants = [
        constraint,
        constraint.replace('no ', 'without '),
        constraint.replace('no ', 'avoid ')
      ];
      
      const hasConstraint = variants.some(v => prompt.toLowerCase().includes(v.toLowerCase()));
      if (hasConstraint) {
        foundCount++;
        found.push(constraint);
      } else {
        missing.push(constraint);
      }
    }
    
    const score = Math.round((foundCount / this.requiredNegatives.length) * 100);
    
    return {
      dimension: '负面约束完整性',
      score,
      weight: this.weights.negativeCompleteness,
      foundCount,
      total: this.requiredNegatives.length,
      missing: missing.length > 0 ? missing : null,
      comment: score >= 80 ? '约束完整' : `缺失: ${missing.join(', ')}`
    };
  }

  /**
   * 生成质量报告
   */
  _generateReport(totalScore, grade, passed, action, scores, details) {
    const lines = [
      `===== Prompt质量门禁报告 =====`,
      ``,
      `总分: ${totalScore}/100 | 评级: ${grade} | 动作: ${action}`,
      ``,
      `各维度评分:`,
    ];
    
    for (const detail of details) {
      const weighted = Math.round((detail.score / 100) * detail.weight);
      lines.push(`  ${detail.dimension}: ${detail.score}/100 (权重${detail.weight}% → ${weighted}分) — ${detail.comment}`);
    }
    
    lines.push('');
    lines.push(`综合: ${passed ? '✅ 通过门禁' : '❌ 阻断'}`);
    
    if (!passed) {
      lines.push('');
      lines.push('阻断原因:');
      for (const detail of details) {
        if (detail.score < 60) {
          lines.push(`  • ${detail.dimension}: ${detail.score}分 — ${detail.comment}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

module.exports = { PromptQualityGate };
