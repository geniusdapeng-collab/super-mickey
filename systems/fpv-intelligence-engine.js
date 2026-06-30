/**
 * FPV镜头智能决策引擎 (FPV Lens Intelligence Engine)
 * 
 * 融入导演/剧本环节的FPV适配度评估系统
 * 不是硬性分配，而是智能推荐，让导演在创作阶段就确定最佳FPV镜头
 * 
 * 版本: v2.0 (导演环节融合版)
 * 日期: 2026-05-23
 */

const FPV_SUITABILITY_DIMENSIONS = {
  // 维度1: 剧情类型适配度 (0-100)
  narrativeFit: {
    climax: 100,        // 高潮 = FPV最佳选择
    reveal: 95,         // 揭示 = 强烈冲击
    transformation: 90,   // 变身 = 主观体验
    chase: 85,          // 追逐 = 速度感
    breakthrough: 80,   // 突破 = 力量感
    exploration: 70,    // 探索 = 沉浸感
    interaction: 60,    // 互动 = 可选
    building: 50,       // 铺垫 = 传统更合适
    opening: 40,        // 开场 = 需要稳定建立
    ending: 35          // 结尾 = 需要情感沉淀
  },
  
  // 维度2: 情绪强度 (0-100)
  emotionalIntensity: {
    threshold: 70,      // 情绪强度>70才考虑FPV
    weights: {
      awe: 100,         // 敬畏
      terror: 95,       // 恐惧
      wonder: 90,       // 惊奇
      triumph: 85,      // 胜利
      tension: 80,      // 紧张
      mystery: 70,      // 神秘
      calm: 30,         // 平静 = 不适合
      melancholy: 20    // 忧伤 = 不适合
    }
  },
  
  // 维度3: 视觉复杂度 (0-100)
  visualComplexity: {
    threshold: 50,
    factors: {
      particleEffects: 20,    // 粒子特效加分
      cameraMovement: 20,     // 需要复杂运镜加分
      scaleContrast: 15,      // 大小对比加分
      speedVariation: 15,     // 速度变化加分
      depthLayers: 15,        // 景深层次加分
      lightingDrama: 15       // 光影戏剧性加分
    }
  },
  
  // 维度4: 运动需求 (0-100)
  motionRequirement: {
    highSpeed: 100,     // 高速 = FPV必需
    dynamic: 80,        // 动态 = 强烈建议
    moderate: 50,       // 中等 = 可选
    static: 20          // 静态 = 不适合
  },
  
  // 维度5: 叙事重要性 (0-100)
  narrativeWeight: {
    pivotal: 100,       // 转折点 = FPV加分
    important: 75,      // 重要 = 可以考虑
    supporting: 50,       // 辅助 = 传统即可
    background: 25      // 背景 = 不需要
  }
};

class FPVIntelligenceEngine {
  constructor() {
    this.dimensions = FPV_SUITABILITY_DIMENSIONS;
  }
  
  /**
   * 导演环节主入口：评估单镜头FPV适配度
   * 在剧本创作阶段调用，为每个镜头生成FPV适配报告
   */
  evaluateShot(shot, context = {}) {
    const scores = {
      narrativeFit: this._scoreNarrativeFit(shot),
      emotionalIntensity: this._scoreEmotionalIntensity(shot),
      visualComplexity: this._scoreVisualComplexity(shot),
      motionRequirement: this._scoreMotionRequirement(shot),
      narrativeWeight: this._scoreNarrativeWeight(shot, context)
    };
    
    // 加权总分 (各维度权重可调)
    const weights = {
      narrativeFit: 0.30,
      emotionalIntensity: 0.25,
      visualComplexity: 0.20,
      motionRequirement: 0.15,
      narrativeWeight: 0.10
    };
    
    const totalScore = Object.keys(scores).reduce((sum, dim) => {
      return sum + scores[dim] * weights[dim];
    }, 0);
    
    const roundedTotal = Math.round(totalScore);
    
    // 生成适配建议
    const recommendation = this._generateRecommendation(roundedTotal, shot, scores);
    
    return {
      shotId: shot.id || 'unknown',
      shotType: shot.type,
      totalScore: roundedTotal,
      dimensionScores: scores,
      recommendation,
      isRecommended: roundedTotal >= 75,  // 75分以上推荐FPV
      isMandatory: roundedTotal >= 90,    // 90分以上强烈建议FPV
      reasoning: this._generateReasoning(scores, recommendation)
    };
  }
  
  /**
   * 导演环节批量评估：评估整个剧本的所有镜头
   * 返回按FPV适配度排序的镜头列表
   */
  evaluateScript(script) {
    const results = script.shots.map(shot => this.evaluateShot(shot, {
      totalShots: script.shots.length,
      storyArc: script.arc,
      climaxIndex: script.climaxIndex
    }));
    
    // 按FPV适配度排序
    const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
    
    // 导演级决策：选择最佳1-2个FPV镜头
    const selected = this._directorSelect(results, sorted);
    
    return {
      shotEvaluations: results,
      rankedByFPV: sorted,
      directorDecision: selected,
      scriptAnalysis: this._analyzeScript(results)
    };
  }
  
  /**
   * 导演级选择逻辑：不是硬性分配，而是智能匹配
   */
  _directorSelect(allResults, sortedResults) {
    // 策略1: 如果有90+分的镜头，选最高分的1个
    const mandatory = sortedResults.filter(r => r.isMandatory);
    if (mandatory.length > 0) {
      return {
        primaryFPV: mandatory[0],
        secondaryFPV: mandatory[1] || null,
        reasoning: `${mandatory[0].shotId} 是剧本高潮/转折点，FPV适配度${mandatory[0].totalScore}分，强烈建议FPV`
      };
    }
    
    // 策略2: 如果有75+分的镜头，选最高分
    const recommended = sortedResults.filter(r => r.isRecommended);
    if (recommended.length > 0) {
      return {
        primaryFPV: recommended[0],
        secondaryFPV: recommended[1] || null,
        reasoning: `${recommended[0].shotId} 视觉复杂度高+情绪强度足，FPV适配度${recommended[0].totalScore}分，推荐FPV`
      };
    }
    
    // 策略3: 如果没有高适配度镜头，保底选1个最高分
    return {
      primaryFPV: sortedResults[0],
      secondaryFPV: null,
      reasoning: `无强烈FPV适配镜头，${sortedResults[0].shotId}相对最佳(${sortedResults[0].totalScore}分)，可选FPV增强`
    };
  }
  
  // ============ 各维度评分 ============
  
  _scoreNarrativeFit(shot) {
    return this.dimensions.narrativeFit[shot.type] || 50;
  }
  
  _scoreEmotionalIntensity(shot) {
    const mood = shot.mood || '';
    let maxScore = 0;
    
    // 中文情绪词映射
    const emotionMap = {
      '敬畏': 'awe', '震撼': 'awe', '神圣': 'awe', '庄严': 'awe',
      '恐惧': 'terror', '害怕': 'terror', '惊恐': 'terror', '战栗': 'terror',
      '惊奇': 'wonder', '惊叹': 'wonder', '震撼': 'wonder', '好奇': 'wonder',
      '胜利': 'triumph', '喜悦': 'triumph', '兴奋': 'triumph', '激动': 'triumph',
      '紧张': 'tension', '压迫': 'tension', '危急': 'tension', '紧迫': 'tension',
      '神秘': 'mystery', '未知': 'mystery', '诡异': 'mystery', '魔幻': 'mystery',
      '平静': 'calm', '宁静': 'calm', '安详': 'calm', '温馨': 'calm',
      '忧伤': 'melancholy', '悲伤': 'melancholy', '惆怅': 'melancholy', '失落': 'melancholy'
    };
    
    // 检查中文情绪词
    for (const [cnWord, enEmotion] of Object.entries(emotionMap)) {
      if (mood.includes(cnWord)) {
        const score = this.dimensions.emotionalIntensity.weights[enEmotion] || 0;
        maxScore = Math.max(maxScore, score);
      }
    }
    
    // 检查英文情绪词
    for (const [emotion, score] of Object.entries(this.dimensions.emotionalIntensity.weights)) {
      if (mood.includes(emotion) || mood.includes(this._translateEmotion(emotion))) {
        maxScore = Math.max(maxScore, score);
      }
    }
    
    return maxScore;
  }
  
  _scoreVisualComplexity(shot) {
    let score = 50; // 基础分
    
    // 根据Prompt内容分析视觉复杂度
    const prompt = shot.prompt || '';
    
    if (prompt.includes('粒子') || prompt.includes('光芒') || prompt.includes('能量')) score += 20;
    if (prompt.includes('环绕') || prompt.includes('推进') || prompt.includes('穿越')) score += 20;
    if (prompt.includes('巨大') || prompt.includes('微小') || prompt.includes('对比')) score += 15;
    if (prompt.includes('高速') || prompt.includes('加速') || prompt.includes('爆发')) score += 15;
    if (prompt.includes('多层次') || prompt.includes('景深') || prompt.includes('前景')) score += 15;
    if (prompt.includes('戏剧性') || prompt.includes('对比光') || prompt.includes('剪影')) score += 15;
    
    return Math.min(100, score);
  }
  
  _scoreMotionRequirement(shot) {
    const prompt = shot.prompt || '';
    
    if (prompt.includes('高速') || prompt.includes('冲刺') || prompt.includes('追逐')) {
      return this.dimensions.motionRequirement.highSpeed;
    }
    if (prompt.includes('动态') || prompt.includes('移动') || prompt.includes('跟随')) {
      return this.dimensions.motionRequirement.dynamic;
    }
    if (prompt.includes('缓慢') || prompt.includes('静态') || prompt.includes('定格')) {
      return this.dimensions.motionRequirement.static;
    }
    
    return this.dimensions.motionRequirement.moderate;
  }
  
  _scoreNarrativeWeight(shot, context) {
    // 如果是剧本的高潮点，自动给高分
    if (context.climaxIndex && shot.index === context.climaxIndex) {
      return this.dimensions.narrativeWeight.pivotal;
    }
    
    // 根据镜头在剧本中的位置判断重要性
    const total = context.totalShots || 8;
    const position = shot.index / total;
    
    if (position > 0.6 && position < 0.9) return 85; // 高潮区域
    if (position > 0.3 && position < 0.6) return 70; // 发展区域
    return 50; // 开场/结尾
  }
  
  // ============ 辅助方法 ============
  
  _generateRecommendation(score, shot, dimensions) {
    if (score >= 90) return '强烈建议FPV：这是本剧最佳FPV镜头';
    if (score >= 75) return '推荐FPV：视觉+情绪双重加成';
    if (score >= 60) return '可选FPV：有潜力但非必需';
    return '建议传统运镜：情绪/视觉不适合FPV';
  }
  
  _generateReasoning(scores, recommendation) {
    const reasons = [];
    
    if (scores.narrativeFit >= 80) reasons.push(`剧情类型高度适配(${scores.narrativeFit}分)`);
    if (scores.emotionalIntensity >= 80) reasons.push(`情绪强度高(${scores.emotionalIntensity}分)`);
    if (scores.visualComplexity >= 70) reasons.push(`视觉复杂度足(${scores.visualComplexity}分)`);
    if (scores.motionRequirement >= 80) reasons.push(`运动需求强(${scores.motionRequirement}分)`);
    if (scores.narrativeWeight >= 80) reasons.push(`叙事转折点(${scores.narrativeWeight}分)`);
    
    return reasons;
  }
  
  _analyzeScript(results) {
    const fpvCount = results.filter(r => r.isRecommended).length;
    const mandatoryCount = results.filter(r => r.isMandatory).length;
    const avgScore = results.reduce((sum, r) => sum + r.totalScore, 0) / results.length;
    
    return {
      totalShots: results.length,
      fpvRecommended: fpvCount,
      fpvMandatory: mandatoryCount,
      averageFPVSuitability: Math.round(avgScore),
      distribution: results.map(r => ({ id: r.shotId, score: r.totalScore }))
    };
  }
  
  _translateEmotion(english) {
    const map = {
      awe: '敬畏', terror: '恐惧', wonder: '惊奇', triumph: '胜利',
      tension: '紧张', mystery: '神秘', calm: '平静', melancholy: '忧伤'
    };
    return map[english] || english;
  }
}

module.exports = { FPVIntelligenceEngine };

// CLI测试
if (require.main === module) {
  const engine = new FPVIntelligenceEngine();
  
  // 测试S06"火之眼觉醒"
  const s06 = {
    id: 'S06',
    type: 'climax',
    mood: '温暖→神圣',
    prompt: '烛龙竖直双目爆发金色光芒，小G获得火之眼，永夜裂谷照如白昼',
    index: 6,
    duration: 12
  };
  
  const result = engine.evaluateShot(s06, { totalShots: 8, climaxIndex: 6 });
  
  console.log('🎬 FPV Intelligence Engine 测试\n');
  console.log(`镜头: ${result.shotId} (${result.shotType})`);
  console.log(`FPV适配度: ${result.totalScore}/100`);
  console.log(`推荐: ${result.recommendation}`);
  console.log(`\n各维度得分:`);
  Object.entries(result.dimensionScores).forEach(([dim, score]) => {
    console.log(`  ${dim}: ${score}`);
  });
  console.log(`\n${result.isMandatory ? '🔴 强烈建议FPV' : result.isRecommended ? '🟡 推荐FPV' : '⚪ 传统运镜'}`);
}
