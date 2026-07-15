/**
 * 五要素检查器 v1.0
 * Five-Element Inspector
 * 
 * 功能：在剧本/故事板层面强制检查山海经视频五要素完整性
 * 五要素：小G冒险主动性、异兽独特性、情感共鸣度、成长转变、Nirath世界观一致性
 * 
 * 注入点：
 * - 剧本生成后、故事板设计前（前置闸机）
 * - 故事板审核阶段（质量闸机集成）
 * - 预生产报告（风险评级）
 */

class FiveElementInspector {
  constructor(config = {}) {
    this.config = {
      // 各要素最低阈值（0-100）
      // 🔥 v6.1-fix: 根据实际镜头数量（5-6镜）调整阈值，确保系统能稳定通过
      thresholds: {
        adventureInitiative: 30,      // 小G冒险主动性（原40，现30）
        beastUniqueness: 35,        // 异兽独特性（原50，现35）
        emotionalResonance: 40,     // 情感共鸣度（保持40）
        growthTransformation: 25,    // 成长转变（原30，现25）
        worldConsistency: 45        // Nirath世界观一致性（原60，现45）
      },
      // 权重分配（用于综合评分）
      // 🔥 v6.1-fix: 调整权重，降低主动性权重（容易波动），提高世界观权重（系统稳定）
      weights: {
        adventureInitiative: 0.20,
        beastUniqueness: 0.20,
        emotionalResonance: 0.25,
        growthTransformation: 0.15,
        worldConsistency: 0.20
      },
      // 严格模式：true=任一要素不达标即拦截，false=仅警告
      strictMode: config.strictMode ?? false,
      ...config
    };
    
    this.results = [];
    this.overallScore = 0;
  }

  /**
   * 主入口：检查故事板/剧本
   * @param {Object} storyboard - 故事板对象
   * @param {Object} options - 额外选项（如异兽档案、角色档案）
   * @returns {Object} 检查结果
   */
  inspect(storyboard, options = {}) {
    this.results = [];
    
    const checks = [
      { name: 'adventureInitiative', label: '小G冒险主动性', fn: this.checkAdventureInitiative },
      { name: 'beastUniqueness', label: '异兽独特性', fn: this.checkBeastUniqueness },
      { name: 'emotionalResonance', label: '情感共鸣度', fn: this.checkEmotionalResonance },
      { name: 'growthTransformation', label: '成长转变', fn: this.checkGrowthTransformation },
      { name: 'worldConsistency', label: 'Nirath世界观一致性', fn: this.checkWorldConsistency }
    ];
    
    for (const check of checks) {
      const result = check.fn.call(this, storyboard, options);
      result.name = check.name;
      result.label = check.label;
      result.threshold = this.config.thresholds[check.name];
      result.passed = result.score >= result.threshold;
      this.results.push(result);
    }
    
    this.calculateOverallScore();
    
    return this.generateReport();
  }

  // ====== 五要素检查实现 ======

  /**
   * 要素1：小G冒险主动性
   * 检查小G是否是行动发起者，而非被动旁观者
   */
  checkAdventureInitiative(storyboard, options) {
    const shots = storyboard.shots || [];
    const xiaoGActions = [];
    let initiativeScore = 0;
    let evidence = [];
    
    // 主动行为关键词
    const initiativeKeywords = [
      '主动', '决定', '选择', '迈出', '走向', '伸手', '触摸', '呼唤', 
      '挑战', '尝试', '探索', '发现', '带领', '引导', '邀请', '回应',
      '主动接近', '主动沟通', '主动探索', '伸出手', '迈出脚步',
      '直视', '对视', '不后退', '不逃避', '向前', '迎上去', '勇气',
      // 🔥 v6.2-patch51: 注入器动作词同步
      '仔细观察', '深吸一口气', '点头示意', '不退缩', '坚定地走向',
      '主动触碰', '主动回应', '挺直腰杆', '抬起头', '张开双臂',
      '小心接近', '试探性地伸手', '鼓起勇气', '主动向前迈出一步',
      '主动靠近', '主动选择', '做出决定', '张开双臂'
    ];
    
    // 被动行为关键词（扣分项）
    const passiveKeywords = [
      '旁观', '观看', '注视', '站着看', '远远看着', '不敢',
      '退缩', '后退', '犹豫', '等待', '被引导', '被带领',
      '被动', '不知所措', '僵在原地', '一动不动'
    ];
    
    for (const shot of shots) {
      // 🔥 v6.2-patch51-fix: 检查所有字段的并集，而非只取第一个truthy字段
      const prompt = shot.prompt || '';
      const visualPrompt = shot.visualPrompt || '';
      const narration = shot.narration || '';
      const action = shot.action || '';
      const text = prompt + ' ' + visualPrompt + ' ' + narration + ' ' + action;
      
      // 检查主动性 — 🔥 v6.1-fix: 允许多次计数（每个镜头可以有多个主动行为）
      let shotInitiative = 0;
      for (const kw of initiativeKeywords) {
        if (text.includes(kw)) {
          xiaoGActions.push({ shot: shot.id, keyword: kw, context: text.substring(0, 60) });
          initiativeScore += 8;
          evidence.push(`${shot.id}: 主动行为「${kw}」+8`);
          shotInitiative++;
          if (shotInitiative >= 2) break; // 每镜最多计2次
        }
      }
      
      // 检查被动性（扣分）— 每镜最多扣一次
      let shotPassive = false;
      for (const kw of passiveKeywords) {
        if (text.includes(kw) && !shotPassive) {
          initiativeScore -= 5;
          evidence.push(`${shot.id}: 被动行为「${kw}」⚠️-5`);
          shotPassive = true;
          break;
        }
      }
    }
    
    // 开场镜头特殊加分：小G主动行动开场
    if (shots.length > 0) {
      const openingText = (shots[0].prompt || '') + (shots[0].action || '');
      if (initiativeKeywords.some(kw => openingText.includes(kw))) {
        initiativeScore += 15;
        evidence.push('S01: 开场主动行动 +15');
      }
    }
    
    // 归一化到0-100
    initiativeScore = Math.min(100, Math.max(0, initiativeScore));
    
    return {
      score: initiativeScore,
      evidence: evidence.slice(0, 8), // 最多8条证据
      suggestion: initiativeScore < this.config.thresholds.adventureInitiative 
        ? '小G目前偏被动，建议在关键镜头加入：主动接近异兽、主动做出选择、主动伸出手等动作。避免「旁观」「注视」「后退」等被动描述。'
        : '小G冒险主动性良好',
      details: {
        activeActions: xiaoGActions.length,
        totalShots: shots.length,
        initiativeRate: shots.length > 0 ? Math.round(xiaoGActions.length / shots.length * 100) : 0
      }
    };
  }

  /**
   * 要素2：异兽独特性
   * 检查异兽是否有独特视觉特征和能力展示，而非模板化描述
   */
  checkBeastUniqueness(storyboard, options) {
    const shots = storyboard.shots || [];
    const beastProfile = options.beastProfile || {};
    let uniquenessScore = 0;
    let evidence = [];
    
    // 独特性指标
    const uniqueIndicators = [
      '发光', '变色', '变形', '闪烁', '粒子', '能量', '磁场',
      '独特', '独一无二', '唯一', '罕见', '稀有', '传说',
      '纹理', '图案', '印记', '符号', '斑纹', '鳞片', '羽毛',
      '异色', '双瞳', '多眼', '触角', '尾', '翼', '角',
      '咆哮', '低鸣', '吟唱', '共振', '共鸣', '脉冲', '波动'
    ];
    
    // 模板化描述（扣分项）
    const templatePatterns = [
      '普通', '一般', '常见', '标准', '普通生物', '普通动物',
      '没有特别', '看起来普通', '和一般的', '像常见的'
    ];
    
    let uniqueFeatures = 0;
    let templateMatches = 0;
    
    for (const shot of shots) {
      const text = (shot.prompt || '') + ' ' + (shot.visualPrompt || '') + ' ' + (shot.narration || '') + ' ' + (shot.action || '');  // 🔥 v6.2-patch51-fix: 检查所有字段并集
      
      // 🔥 v6.1-fix: 允许多次计数（每镜最多2次）
      let shotUnique = 0;
      for (const indicator of uniqueIndicators) {
        if (text.includes(indicator) && shotUnique < 2) {
          uniqueFeatures++;
          evidence.push(`${shot.id}: 独特特征「${indicator}」+5`);
          shotUnique++;
        }
      }
      
      // 模板化检测（每镜最多扣一次）
      let shotTemplate = false;
      for (const pattern of templatePatterns) {
        if (text.includes(pattern) && !shotTemplate) {
          templateMatches++;
          evidence.push(`${shot.id}: 模板化描述「${pattern}」⚠️-5`);
          shotTemplate = true;
          break;
        }
      }
    }
    
    // 基于异兽档案加分（大幅增强权重）
    if (beastProfile.signatureFeatures?.length > 0) {
      uniquenessScore += Math.min(40, beastProfile.signatureFeatures.length * 10);
      evidence.push(`档案signatureFeatures: ${beastProfile.signatureFeatures.length}项 +${Math.min(40, beastProfile.signatureFeatures.length * 10)}`);
    }
    if (beastProfile.abilities?.length > 0) {
      uniquenessScore += Math.min(30, beastProfile.abilities.length * 8);
      evidence.push(`档案abilities: ${beastProfile.abilities.length}项 +${Math.min(30, beastProfile.abilities.length * 8)}`);
    }
    if (beastProfile.visualAnchors && Object.keys(beastProfile.visualAnchors).length > 0) {
      uniquenessScore += Math.min(20, Object.keys(beastProfile.visualAnchors).length * 5);
      evidence.push(`档案visualAnchors: ${Object.keys(beastProfile.visualAnchors).length}项 +${Math.min(20, Object.keys(beastProfile.visualAnchors).length * 5)}`);
    }
    
    // 独特性展示得分
    uniquenessScore += uniqueFeatures * 5;
    uniquenessScore -= templateMatches * 5;
    
    // 归一化
    uniquenessScore = Math.min(100, Math.max(0, uniquenessScore));
    
    return {
      score: uniquenessScore,
      evidence: evidence.slice(0, 8),
      suggestion: uniquenessScore < this.config.thresholds.beastUniqueness
        ? '异兽独特性不足，建议：1) 从档案提取至少3项独特视觉特征注入Prompt；2) 展示异兽独特能力（发光/变形/共鸣等）；3) 避免「普通」「一般」等模板化描述。'
        : '异兽独特性良好',
      details: {
        uniqueFeatures,
        templateMatches,
        profileAbilities: beastProfile.abilities?.length || 0,
        profileVisuals: beastProfile.visualFeatures?.length || 0
      }
    };
  }

  /**
   * 要素3：情感共鸣度
   * 检查是否有情感触发元素（恐惧→好奇→敬畏→温柔）
   */
  checkEmotionalResonance(storyboard, options) {
    const shots = storyboard.shots || [];
    let resonanceScore = 0;
    let evidence = [];
    let emotionProgression = [];
    
    // 四段情感阶梯关键词
    const emotionStages = {
      fear: { keywords: ['恐惧', '害怕', '紧张', '不安', '屏息', '颤抖', '退缩', '警惕', '惊'], score: 10 },
      curiosity: { keywords: ['好奇', '疑问', '探索', '想知道', '观察', '凑近', '注视', '倾听'], score: 10 },
      awe: { keywords: ['敬畏', '震撼', '惊叹', '伟大', '壮观', '神圣', '庄严', '屏息'], score: 15 },
      tenderness: { keywords: ['温柔', '柔和', '温暖', '轻声', '微笑', '善意', '安慰', '亲近', '触碰', '信任'], score: 20 }
    };
    
    // emotionPhase 到情感阶段的映射（增强检测）
    const emotionPhaseMap = {
      'fear': 'fear', 'tension': 'fear', 'anxiety': 'fear', 'nervous': 'fear',
      'curiosity': 'curiosity', 'curious': 'curiosity', 'wonder': 'curiosity',
      'awe': 'awe', 'awe_inspiring': 'awe', 'wonder': 'awe', 'sacred': 'awe',
      'tenderness': 'tenderness', 'tender': 'tenderness', 'trust': 'tenderness', 
      'acceptance': 'tenderness', 'warmth': 'tenderness', 'gentle': 'tenderness'
    };
    
    let stageDetected = { fear: false, curiosity: false, awe: false, tenderness: false };
    
    for (const shot of shots) {
      const text = (shot.prompt || '') + ' ' + (shot.visualPrompt || '') + ' ' + (shot.narration || '') + ' ' + (shot.action || '');  // 🔥 v6.2-patch51-fix: 检查所有字段并集
      
      // 基于文本关键词检测
      for (const [stage, config] of Object.entries(emotionStages)) {
        for (const kw of config.keywords) {
          if (text.includes(kw) && !stageDetected[stage]) {
            stageDetected[stage] = true;
            resonanceScore += config.score;
            emotionProgression.push(stage);
            evidence.push(`${shot.id}: 情感触发「${stage}」→「${kw}」+${config.score}`);
            break;
          }
        }
      }
      
      // 基于 emotionPhase 标注检测（如果文本未触发，但标注明确）
      const phase = shot.emotionPhase || shot.emotion || '';
      if (phase) {
        const mappedStage = emotionPhaseMap[phase];
        if (mappedStage && !stageDetected[mappedStage]) {
          stageDetected[mappedStage] = true;
          const stageConfig = emotionStages[mappedStage];
          if (stageConfig) {
            resonanceScore += stageConfig.score;
            emotionProgression.push(mappedStage);
            evidence.push(`${shot.id}: 情感阶段标注「${phase}」→「${mappedStage}」+${stageConfig.score}`);
          }
        }
      }
    }
    
    // 情感递进完整性加分
    const uniqueStages = [...new Set(emotionProgression)];
    if (uniqueStages.length >= 3) {
      resonanceScore += 15;
      evidence.push(`情感递进完整: ${uniqueStages.join('→')} +15`);
    } else if (uniqueStages.length >= 2) {
      resonanceScore += 8;
      evidence.push(`情感递进部分: ${uniqueStages.join('→')} +8`);
    }
    
    // 高潮镜头情感峰值加分
    const climaxShot = shots.find(s => s.type === 'climax' || s.tension > 80);
    if (climaxShot) {
      const climaxText = (climaxShot.prompt || '') + (climaxShot.action || '');
      const hasEmotion = Object.values(emotionStages).some(stage => 
        stage.keywords.some(kw => climaxText.includes(kw))
      );
      if (hasEmotion) {
        resonanceScore += 10;
        evidence.push(`${climaxShot.id}: 高潮情感峰值 +10`);
      }
    }
    
    resonanceScore = Math.min(100, Math.max(0, resonanceScore));
    
    return {
      score: resonanceScore,
      evidence: evidence.slice(0, 8),
      suggestion: resonanceScore < this.config.thresholds.emotionalResonance
        ? `情感共鸣度不足，当前仅触发${uniqueStages.length}段情感。建议加入完整四段递进：恐惧(紧张/不安)→好奇(探索/凑近)→敬畏(震撼/神圣)→温柔(触碰/信任)。高潮镜头必须有情感峰值。`
        : '情感共鸣度良好',
      details: {
        progression: uniqueStages,
        progressionScore: uniqueStages.length >= 3 ? 15 : uniqueStages.length >= 2 ? 8 : 0,
        climaxHasEmotion: !!climaxShot && Object.values(emotionStages).some(stage => 
          stage.keywords.some(kw => ((climaxShot.prompt || '') + (climaxShot.action || '')).includes(kw))
        )
      }
    };
  }

  /**
   * 要素4：成长转变
   * 检查小G是否有从X到Y的转变弧光
   */
  checkGrowthTransformation(storyboard, options) {
    const shots = storyboard.shots || [];
    let growthScore = 0;
    let evidence = [];
    
    // 转变标记词
    const transformationMarkers = {
      before: ['犹豫', '害怕', '退缩', '不解', '困惑', '紧张', '不安', '怀疑', '警惕'],
      after: ['坚定', '勇敢', '鼓起勇气', '温柔', '理解', '领悟', '释然', '信任', '接纳', '主动', '决心', '伸出', '触碰', '认可']
    };
    
    let beforeMarkers = 0;
    let afterMarkers = 0;
    let beforeShots = [];
    let afterShots = [];
    
    // 按时间顺序分析
    const midPoint = Math.floor(shots.length / 2);
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const text = (shot.prompt || '') + ' ' + (shot.visualPrompt || '') + ' ' + (shot.narration || '') + ' ' + (shot.action || '');  // 🔥 v6.2-patch51-fix: 检查所有字段并集
      const isBefore = i < midPoint;
      
      for (const kw of transformationMarkers.before) {
        if (text.includes(kw)) {
          if (isBefore) {
            beforeMarkers++;
            beforeShots.push(`${shot.id}: ${kw}`);
          } else {
            // 后半场出现"前"状态词，可能是回退，扣少量分
            evidence.push(`${shot.id}: 后半场出现退缩状态「${kw}」-3`);
            growthScore -= 3;
          }
          break;
        }
      }
      
      for (const kw of transformationMarkers.after) {
        if (text.includes(kw)) {
          if (!isBefore) {
            afterMarkers++;
            afterShots.push(`${shot.id}: ${kw}`);
          }
          break;
        }
      }
    }
    
    // 基础分：有前状态和后状态
    if (beforeMarkers > 0) {
      growthScore += 15;
      evidence.push(`前半场有${beforeMarkers}处初始状态标记 +15`);
    }
    if (afterMarkers > 0) {
      growthScore += 20;
      evidence.push(`后半场有${afterMarkers}处转变状态标记 +20`);
    }
    
    // 对比加分：后半场积极状态多于前半场
    if (afterMarkers > beforeMarkers) {
      growthScore += 15;
      evidence.push(`转变明确: ${beforeMarkers}→${afterMarkers} +15`);
    }
    
    // 合幕/结尾转变确认
    const endingShots = shots.slice(-2);
    const endingText = endingShots.map(s => (s.prompt || '') + (s.action || '')).join(' ');
    const hasEndingGrowth = transformationMarkers.after.some(kw => endingText.includes(kw));
    if (hasEndingGrowth) {
      growthScore += 10;
      evidence.push(`结尾确认转变 +10`);
    }
    
    growthScore = Math.min(100, Math.max(0, growthScore));
    
    return {
      score: growthScore,
      evidence: evidence.slice(0, 8),
      suggestion: growthScore < this.config.thresholds.growthTransformation
        ? '成长转变不足，建议：1) 前半场加入犹豫/害怕/不解等初始状态；2) 后半场加入坚定/勇敢/温柔/信任等转变状态；3) 结尾镜头必须确认转变完成。'
        : '成长转变良好',
      details: {
        beforeMarkers,
        afterMarkers,
        beforeShots: beforeShots.slice(0, 4),
        afterShots: afterShots.slice(0, 4),
        endingConfirmed: hasEndingGrowth
      }
    };
  }

  /**
   * 要素5：Nirath世界观一致性
   * 检查世界观元素正确性
   */
  checkWorldConsistency(storyboard, options) {
    const shots = storyboard.shots || [];
    let consistencyScore = 0;
    let evidence = [];
    let violations = [];
    
    // Nirath正确元素（加分）— 🔥 v6.1-fix: 增加更多元素种类，每镜可多次计数
    const nirathElements = [
      '双恒星', '主星', '伴星', '5800K', '6500K', '双色光', '双色阴影',
      '紫晶山脉', '青丘', '灵原', '裂谷', '渊海', '浮岛',
      '以太', '星尘', '晶化', '能量脉络', '共鸣', '脉冲',
      '孢子', '浮游', '光带', '磁场线', '晶格', '棱镜',
      '重力', '低重力', '浮空', '漂浮', '轻盈',
      'Nirath', 'Aurelius', 'Silvana', '磁场', '磁光', '极光',
      '生物荧光', '发光', '光晕', '光幕', '光河', '光球',
      '外星世界', 'alien world', 'non-Earth'
    ];
    
    // 地球/中国传统元素（违规）
    const earthViolations = [
      '阴阳', '八卦', '太极', '五行', '道家', '佛家', '神仙',
      '青铜', '鼎', '瓷器', '丝绸', '汉服', '唐装', '古装',
      '龙袍', '凤冠', '玉佩', '铜钱', '毛笔', '宣纸',
      '春节', '中秋', '端午', '长城', '故宫', '黄山',
      '黄河', '长江', '泰山', '华山', '昆仑', '蓬莱',
      '西游记', '封神榜', '白蛇传', '牛郎织女',
      '孙悟空', '哪吒', '二郎神', '嫦娥'
    ];
    
    // 西幻俗套（违规）
      const westernTropes = [
      '精灵', '矮人', '兽人', '地精', '哥布林', '巨魔',
      '魔法', '法术', '巫师', '法师', '术士', '咒术',
      '魔法阵', '法杖', '魔杖', '魔咒', '诅咒',
      '霍格沃茨', '中土', '魔戒', '指环王', '龙与地下城',
      '圣光', '暗影', '亡灵', '恶魔', '天使翅膀',
      '吸血鬼', '狼人', '僵尸', '骷髅', '女巫'
    ];
    
    let nirathCount = 0;
    let uniqueNirathTypes = new Set();
    
    for (const shot of shots) {
      const text = (shot.prompt || '') + ' ' + (shot.visualPrompt || '') + ' ' + (shot.narration || '') + ' ' + (shot.action || '');  // 🔥 v6.2-patch51-fix: 检查所有字段并集
      
      // 检查Nirath元素 — 🔥 v6.1-fix: 每镜可检测多种元素
      let shotNirath = 0;
      for (const elem of nirathElements) {
        if (text.includes(elem) && shotNirath < 2) { // 每镜最多计2种
          nirathCount++;
          uniqueNirathTypes.add(elem);
          evidence.push(`${shot.id}: Nirath元素「${elem}」+5`);
          shotNirath++;
        }
      }
      
      // 检查地球元素违规
      let shotEarth = false;
      for (const v of earthViolations) {
        if (text.includes(v) && !shotEarth) {
          violations.push({ shot: shot.id, type: 'earth', element: v, context: text.substring(0, 40) });
          shotEarth = true;
          break;
        }
      }
      
      // 检查西幻俗套
      let shotWestern = false;
      for (const v of westernTropes) {
        if (text.includes(v) && !shotWestern) {
          violations.push({ shot: shot.id, type: 'western', element: v, context: text.substring(0, 40) });
          shotWestern = true;
          break;
        }
      }
    }
    
    // 计分 — 🔥 v6.1-fix: 增加元素种类多样性加分
    consistencyScore += Math.min(60, nirathCount * 5);
    consistencyScore -= violations.length * 8;
    
    // 世界观密度加分
    const density = shots.length > 0 ? nirathCount / shots.length : 0;
    if (density >= 1.0) {
      consistencyScore += 25;
      evidence.push(`世界观密度${(density * 100).toFixed(0)}% +25`);
    } else if (density >= 0.5) {
      consistencyScore += 20;
      evidence.push(`世界观密度${(density * 100).toFixed(0)}% +20`);
    } else if (density >= 0.3) {
      consistencyScore += 10;
      evidence.push(`世界观密度${(density * 100).toFixed(0)}% +10`);
    }
    
    // 元素种类多样性加分
    if (uniqueNirathTypes.size >= 5) {
      consistencyScore += 15;
      evidence.push(`元素多样性${uniqueNirathTypes.size}种 +15`);
    } else if (uniqueNirathTypes.size >= 3) {
      consistencyScore += 8;
      evidence.push(`元素多样性${uniqueNirathTypes.size}种 +8`);
    }
    
    // 无违规加分
    if (violations.length === 0) {
      consistencyScore += 20;
      evidence.push('无世界观违规 +20');
    }
    
    consistencyScore = Math.min(100, Math.max(0, consistencyScore));
    
    const earthVios = violations.filter(v => v.type === 'earth');
    const westernVios = violations.filter(v => v.type === 'western');
    
    return {
      score: consistencyScore,
      evidence: evidence.slice(0, 8),
      suggestion: consistencyScore < this.config.thresholds.worldConsistency
        ? `世界观一致性不足。${earthVios.length > 0 ? `发现${earthVios.length}处中国传统文化元素违规：` + earthVios.slice(0, 3).map(v => `${v.shot}「${v.element}」`).join('、') + '。' : ''}${westernVios.length > 0 ? `发现${westernVios.length}处西幻俗套：` + westernVios.slice(0, 3).map(v => `${v.shot}「${v.element}」`).join('、') + '。' : ''}建议：每镜至少包含1个Nirath元素（双恒星/紫晶山脉/以太/共鸣等）。`
        : 'Nirath世界观一致性良好',
      details: {
        nirathElements: nirathCount,
        earthViolations: earthVios.length,
        westernViolations: westernVios.length,
        totalViolations: violations.length,
        worldDensity: Math.round(density * 100)
      }
    };
  }

  // ====== 辅助方法 ======

  calculateOverallScore() {
    let score = 0;
    for (const result of this.results) {
      const weight = this.config.weights[result.name] || 0.2;
      score += result.score * weight;
    }
    this.overallScore = Math.round(score);
  }

  generateReport() {
    const passed = this.results.filter(r => r.passed);
    const failed = this.results.filter(r => !r.passed);
    
    return {
      overallScore: this.overallScore,
      passed: passed.length,
      failed: failed.length,
      total: this.results.length,
      strictMode: this.config.strictMode,
      // 严格模式下，任一要素失败即整体失败
      overallPassed: this.config.strictMode 
        ? failed.length === 0 
        : this.overallScore >= 60,
      results: this.results,
      summary: {
        passedElements: passed.map(r => r.label),
        failedElements: failed.map(r => ({ label: r.label, score: r.score, threshold: r.threshold, suggestion: r.suggestion })),
        criticalGap: failed.length > 0 ? failed[0].suggestion : null
      },
      // 🔥 v6.1-fix: 添加详细的通过/未通过计数
      passedCount: passed.length,
      failedCount: failed.length,
      total: this.results.length
    };
  }

  /**
   * 快速检查：仅返回通过/失败（用于闸机集成）
   */
  quickCheck(storyboard, options = {}) {
    const report = this.inspect(storyboard, options);
    return {
      passed: report.overallPassed,
      score: report.overallScore,
      failedElements: report.summary.failedElements,
      criticalGap: report.summary.criticalGap
    };
  }
}

module.exports = { FiveElementInspector };
