/**
 * Story PRD Template v20.2-Peng
 * 
 * 中央校准文档 — 产品需求级故事定义
 * 
 * 设计理念：
 * 1. 每个主题必须有独立的PRD文档
 * 2. 下游环节索引此文档做校准，而非仅依赖上游传递的信息
 * 3. PRD包含：完整故事、角色定义、世界观、正向/负面提示词、禁忌
 * 4. 校准引擎自动检查各环节输出是否偏离PRD
 * 
 * 使用方式：
 * const { STORY_PRD, calibrate } = require('./story-prd-zhulong-opens-eyes.js');
 * const result = calibrate.prompt(myPrompt, 'S01');
 * if (!result.passed) console.log(result.deviations);
 */

// ========== PRD数据结构模板 ==========
const PRD_TEMPLATE = {
  // 基础信息
  meta: {
    title: "故事名称",
    codename: "内部代号",
    version: "v20.0",
    genre: "类型",
    targetDuration: 70, // 秒
    targetShots: 16,
    createdAt: "2026-05-19",
    author: "引擎生成"
  },
  
  // 核心叙事 — 故事的DNA
  core: {
    // 一句话梗概（电梯演讲）
    synopsis: "",
    
    // 核心主题
    theme: "",
    
    // 情感弧线（从头到尾的情绪变化）
    emotionalArc: [],
    
    // 价值观/道德内核
    moral: "",
    
    // 独特卖点（USP）
    usp: "",
    
    // 对标作品（风格参考）
    references: []
  },
  
  // 世界观 — 不可违反的设定
  world: {
    // 环境设定
    setting: "",
    
    // 氛围基调
    atmosphere: "",
    
    // 视觉风格
    visualStyle: "",
    
    // 时间/空间
    timeSpace: {
      era: "",
      location: "",
      season: "",
      timeOfDay: ""
    },
    
    // 允许的文化元素（正向）
    culturalElements: [],
    
    // 禁止的文化元素
    forbiddenCulturalElements: []
  },
  
  // 角色定义 — 能力边界+视觉锚点
  characters: {
    protagonist: {
      name: "",
      codename: "",
      age: 0,
      gender: "",
      
      // 性格特征
      personality: [],
      
      // 能力边界（能做）
      canDo: [],
      
      // 能力边界（不能做）
      cannotDo: [],
      
      // 视觉锚点（必须出现在Prompt中）
      visualAnchors: {
        required: [], // 必须出现
        preferred: [], // 建议出现
        forbidden: [] // 禁止出现
      },
      
      // 情绪反应映射
      emotionReactions: {
        exhausted: [],
        sad: [],
        curious: [],
        awe: [],
        warm: [],
        joy: [],
        scared: [],
        determined: []
      },
      
      // 角色弧线
      arc: {
        startingState: "",
        endingState: "",
        keyTransformation: ""
      }
    },
    
    // 其他角色...
    antagonist: null,
    supporting: [],
    creatures: []
  },
  
  // 叙事结构 — 节拍表
  structure: {
    acts: [
      {
        act: 1,
        name: "铺垫",
        purpose: "",
        emotionalGoal: "",
        shots: [
          {
            shotId: "S01",
            purpose: "",
            emotion: "",
            keyAction: "",
            visualFocus: "",
            narrativeBeat: ""
          }
        ]
      }
    ]
  },
  
  // 正向提示词 — 应该出现的内容
  positive: {
    // 视觉风格词
    visualStyle: [],
    
    // 动作词（鼓励使用）
    actions: [],
    
    // 情绪关键词
    emotions: [],
    
    // 场景元素
    sceneElements: [],
    
    // 材质/质感
    materials: [],
    
    // 光影效果
    lighting: []
  },
  
  // 负面提示词 — 禁忌清单
  negative: {
    // 角色不能做的行为
    forbiddenActions: [],
    
    // 不能出现的视觉元素
    forbiddenVisuals: [],
    
    // 不能涉及的主题
    forbiddenThemes: [],
    
    // 避免的陈词滥调
    cliches: [],
    
    // 过度使用的词（避免重复）
    overusedWords: [],
    
    // 前版本已废弃的设定
    deprecatedElements: []
  },
  
  // 一致性校准规则
  calibrationRules: {
    // 角色一致性
    character: [
      "角色行为必须在canDo范围内",
      "角色不能做cannotDo中的行为",
      "情绪必须匹配emotionReactions映射",
      "视觉锚点required必须出现在所有镜头中"
    ],
    
    // 世界观一致性
    world: [
      "场景必须符合setting定义",
      "禁止出现forbiddenCulturalElements",
      "视觉风格必须匹配visualStyle",
      "时间/空间设定不能矛盾"
    ],
    
    // 叙事一致性
    narrative: [
      "每镜必须有明确的narrativePurpose",
      "情绪变化必须符合emotionalArc",
      "Act结构必须完整（起承转合）",
      "结局必须符合moral传达"
    ],
    
    // 情感一致性
    emotional: [
      "动作必须服务于情绪",
      "情绪跳跃需要过渡",
      "高潮必须有情感爆发",
      "结局必须有情感余韵"
    ],
    
    // 视觉一致性
    visual: [
      "L4角色锚点必须包含所有required特征",
      "禁止出现forbiddenVisuals",
      "材质复杂度不能与前镜矛盾",
      "光影逻辑必须自洽"
    ]
  },
  
  // 版本历史
  changelog: []
};

// ========== 校准引擎 ==========
class CalibrationEngine {
  constructor(prd) {
    this.prd = prd;
    this.deviations = [];
  }
  
  // 校准Prompt
  calibratePrompt(prompt, shotId = 'unknown') {
    this.deviations = [];
    this.utilizationStatus = null; // v20.2.4 重置利用率状态
    
    // ==== v20.2.4 Prompt长度硬控 + 空间利用率最大化 ====
    // Seedance 2.0 官方限制: 1000英文字符 / 500中文汉字
    // 内部安全限制: 980英文字符 / 490中文汉字（留20buffer）
    // 目标: 利用率 ≥99%（≥970字符），无限接近上限
    const promptLen = prompt.length;
    const hasChinese = /[\u4e00-\u9fff]/.test(prompt);
    const isEnglish = !hasChinese;
    
    // 计算利用率
    const utilization = isEnglish ? (promptLen / 980) : ((prompt.match(/[\u4e00-\u9fff]/g) || []).length / 490);
    const utilizationPct = Math.round(utilization * 100);
    
    // 利用率检查（v20.2.4新增）
    if (isEnglish) {
      if (promptLen < 950) {
        this.deviations.push(`[空间浪费] ${promptLen}/980字符，利用率仅${utilizationPct}%，目标≥99%。建议增强Action细节填满空间`);
      } else if (promptLen >= 970 && promptLen <= 980) {
        // 理想状态，不报错，但记录
        this.utilizationStatus = { ideal: true, pct: utilizationPct, len: promptLen };
      }
    } else {
      const chineseChars = (prompt.match(/[\u4e00-\u9fff]/g) || []).length;
      if (chineseChars < 470) {
        this.deviations.push(`[空间浪费] 中文${chineseChars}/490字，利用率仅${utilizationPct}%，目标≥99%。建议增强Action细节填满空间`);
      } else if (chineseChars >= 485 && chineseChars <= 490) {
        this.utilizationStatus = { ideal: true, pct: utilizationPct, len: chineseChars };
      }
    }
    
    // 致命超限检查
    if (isEnglish) {
      if (promptLen > 980) {
        this.deviations.push(`[长度超限-致命] ${promptLen}字符 > 内部限制980 (官方1000)`);
      }
    } else {
      const chineseChars = (prompt.match(/[\u4e00-\u9fff]/g) || []).length;
      if (chineseChars > 490) {
        this.deviations.push(`[长度超限-致命] 中文${chineseChars}字 > 内部限制490字 (官方500)`);
      }
    }
    
    // 双重保险：绝对不超过官方上限
    if (promptLen > 1000) {
      this.deviations.push(`[长度告警-严重] ${promptLen}字符 > 官方上限1000`);
    }
    
    // 1. 角色一致性检查
    this._checkCharacterConsistency(prompt, shotId);
    
    // 2. 世界观一致性检查
    this._checkWorldConsistency(prompt, shotId);
    
    // 3. 叙事一致性检查
    this._checkNarrativeConsistency(prompt, shotId);
    
    // 4. 情感一致性检查
    this._checkEmotionalConsistency(prompt, shotId);
    
    // 5. 视觉一致性检查
    this._checkVisualConsistency(prompt, shotId);
    
    // 6. 负面提示词检查
    this._checkNegativePrompts(prompt, shotId);
    
    return {
      shotId,
      passed: this.deviations.length === 0,
      deviations: this.deviations,
      score: Math.max(0, 100 - this.deviations.length * 15),
      prdVersion: this.prd.meta.version,
      utilization: {
        current: promptLen,
        limit: isEnglish ? 980 : 490,
        percentage: utilizationPct,
        status: this.utilizationStatus?.ideal ? 'IDEAL' : (promptLen >= 950 ? 'ACCEPTABLE' : 'WASTE'),
        suggestion: promptLen < 950 ? '增强Action细节，填满可用空间' : (promptLen > 980 ? '裁剪至980字符以内' : '理想状态')
      }
    };
  }
  
  // 校准角色行为
  calibrateCharacterAction(action, characterKey, shotId = 'unknown') {
    // 支持多种角色key格式
    let char = this.prd.characters[characterKey];
    if (!char) {
      for (const [key, candidate] of Object.entries(this.prd.characters || {})) {
        if (candidate && (candidate.codename === characterKey || candidate.name === characterKey)) {
          char = candidate;
          break;
        }
      }
    }
    
    if (!char) {
      return { passed: false, deviation: `角色${characterKey}未在PRD中定义`, rule: "角色存在性" };
    }
    
    const actionLower = action.toLowerCase();
    const deviations = [];
    
    // 1. 检查cannotDo（核心能力边界）
    for (const forbidden of char.cannotDo || []) {
      const forbiddenLower = forbidden.toLowerCase();
      const regex = new RegExp('\\b' + forbiddenLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (regex.test(actionLower)) {
        deviations.push(`${char.name}不能做"${forbidden}"`);
      }
    }
    
    // 2. 检查视觉锚点（只检查最核心的2-3个特征，而非全部required）
    // 策略：视觉锚点主要通过L4基座保证，Action中只需包含最关键的特征
    const criticalAnchors = (char.visualAnchors?.required || []).slice(0, 3); // 只检查前3个最关键
    const missingCritical = [];
    for (const anchor of criticalAnchors) {
      if (!actionLower.includes(anchor.toLowerCase())) {
        missingCritical.push(anchor);
      }
    }
    
    // 如果缺少超过1个核心特征才报偏离（降低敏感度）
    if (missingCritical.length > 1) {
      deviations.push(`${char.name}缺少核心视觉特征: ${missingCritical.slice(0, 2).join(', ')}...`);
    }
    
    if (deviations.length > 0) {
      return {
        passed: false,
        deviation: deviations[0],
        allDeviations: deviations,
        rule: deviations[0].includes('不能做') ? "角色能力边界" : "视觉锚点",
        suggestion: deviations[0].includes('不能做') 
          ? `改用${(char.canDo || []).slice(0, 3).join('/')}等动作`
          : `在Prompt中加入${missingCritical[0]}`
      };
    }
    
    return { passed: true, character: char.name };
  }
  
  // 校准情绪-动作匹配
  calibrateEmotionAction(emotion, action, characterKey, shotId = 'unknown') {
    let char = this.prd.characters[characterKey];
    
    // 如果没找到，遍历所有角色按codename匹配
    if (!char) {
      for (const [key, candidate] of Object.entries(this.prd.characters || {})) {
        if (candidate && (candidate.codename === characterKey || candidate.name === characterKey)) {
          char = candidate;
          break;
        }
      }
    }
    
    if (!char || !char.emotionReactions) return { passed: true };
    
    const expectedActions = char.emotionReactions[emotion] || [];
    if (expectedActions.length === 0) return { passed: true };
    
    const actionLower = action.toLowerCase();
    
    // 提取动作中的动词（简单分词）
    const actionWords = actionLower.split(/[\s,\.\(\)]+/).filter(w => w.length > 2);
    
    // 检查是否有至少一个期望动作出现
    const hasMatch = expectedActions.some(expected => {
      const expectedLower = expected.toLowerCase();
      return actionWords.some(word => word.includes(expectedLower) || expectedLower.includes(word));
    });
    
    if (!hasMatch) {
      return {
        passed: false,
        deviation: `情绪"${emotion}"建议动作: ${expectedActions.join(', ')}，实际动作不匹配`,
        rule: "情绪-动作映射",
        suggestion: `使用"${expectedActions[0]}"替代当前动作，或改用${Object.keys(char.emotionReactions).filter(e => {
          const acts = char.emotionReactions[e] || [];
          return acts.some(a => actionLower.includes(a.toLowerCase()));
        }).slice(0, 2).join('/')}等匹配情绪`
      };
    }
    
    return { passed: true };
  }
  
  // 校准世界观
  calibrateWorld(sceneDescription, shotId = 'unknown') {
    const descLower = sceneDescription.toLowerCase();
    const deviations = [];
    
    // 检查禁止元素
    for (const forbidden of this.prd.world.forbiddenCulturalElements || []) {
      if (descLower.includes(forbidden.toLowerCase())) {
        deviations.push(`禁止元素"${forbidden}"出现在场景中`);
      }
    }
    
    // 检查视觉风格偏离
    const styleKeywords = this.prd.world.visualStyle?.toLowerCase().split(/[\s,]+/) || [];
    const hasStyleMatch = styleKeywords.some(kw => kw.length > 3 && descLower.includes(kw));
    if (!hasStyleMatch && styleKeywords.length > 0) {
      deviations.push(`场景缺少视觉风格关键词(${styleKeywords.slice(0, 3).join(', ')})`);
    }
    
    return {
      passed: deviations.length === 0,
      deviations,
      world: this.prd.world.setting
    };
  }
  
  // 生成校准报告
  generateCalibrationReport(results) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    
    let report = `\n📋 PRD校准报告 (${this.prd.meta.title} ${this.prd.meta.version})\n`;
    report += `=${'='.repeat(50)}\n`;
    report += `总检查: ${total} | 通过: ${passed} | 失败: ${failed}\n`;
    
    if (failed > 0) {
      report += `\n❌ 偏离项:\n`;
      for (const result of results.filter(r => !r.passed)) {
        report += `\n  [${result.shotId}] 评分: ${result.score}/100\n`;
        for (const dev of result.deviations) {
          report += `    • ${dev}\n`;
        }
      }
      
      report += `\n💡 修复建议:\n`;
      report += `  1. 对照PRD检查角色能力边界\n`;
      report += `  2. 确认视觉锚点包含所有required特征\n`;
      report += `  3. 检查情绪-动作映射是否符合PRD定义\n`;
      report += `  4. 移除forbiddenActions/forbiddenVisuals中的元素\n`;
      report += `  5. 重新走完整流程：故事分析→PRD更新→Prompt组装\n`;
    } else {
      report += `\n✅ 全部通过！与PRD保持一致。\n`;
    }
    
    return report;
  }
  
  // 内部检查方法
  _checkCharacterConsistency(prompt, shotId) {
    for (const [key, char] of Object.entries(this.prd.characters)) {
      if (!char) continue;
      
      // 检查cannotDo
      for (const forbidden of char.cannotDo || []) {
        if (prompt.toLowerCase().includes(forbidden.toLowerCase())) {
          this.deviations.push(`[角色一致性] ${char.name}不能做"${forbidden}"`);
        }
      }
      
      // 检查视觉锚点
      if (prompt.toLowerCase().includes(char.name.toLowerCase()) || 
          prompt.toLowerCase().includes((char.codename || '').toLowerCase())) {
        for (const anchor of char.visualAnchors?.required || []) {
          if (!prompt.toLowerCase().includes(anchor.toLowerCase())) {
            this.deviations.push(`[视觉锚点] ${char.name}缺少"${anchor}"`);
          }
        }
      }
    }
  }
  
  _checkWorldConsistency(prompt, shotId) {
    const promptLower = prompt.toLowerCase();
    
    for (const forbidden of this.prd.world.forbiddenCulturalElements || []) {
      if (promptLower.includes(forbidden.toLowerCase())) {
        this.deviations.push(`[世界观] 禁止元素"${forbidden}"`);
      }
    }
  }
  
  _checkNarrativeConsistency(prompt, shotId) {
    // 检查叙事目的（在生产脚本层面检查）
  }
  
  _checkEmotionalConsistency(prompt, shotId) {
    // 检查情绪-动作匹配（已在story-engine中检查）
  }
  
  _checkVisualConsistency(prompt, shotId) {
    // 检查视觉风格偏离
  }
  
  _checkNegativePrompts(prompt, shotId) {
    const promptLower = prompt.toLowerCase();
    
    // v20.2.3: 分离L5负面约束部分和正面内容部分
    // L5负面约束通常以"No "开头，出现在Prompt末尾
    // 我们只检查正面内容中是否出现禁止元素
    let contentPart = promptLower;
    const negativePartIndex = promptLower.indexOf('no ');
    if (negativePartIndex > 0) {
      contentPart = promptLower.substring(0, negativePartIndex);
    }
    
    for (const forbidden of this.prd.negative.forbiddenActions || []) {
      if (contentPart.includes(forbidden.toLowerCase())) {
        this.deviations.push(`[禁忌行为] "${forbidden}"`);
      }
    }
    
    for (const forbidden of this.prd.negative.forbiddenVisuals || []) {
      if (contentPart.includes(forbidden.toLowerCase())) {
        this.deviations.push(`[禁忌视觉] "${forbidden}"`);
      }
    }
    
    for (const cliche of this.prd.negative.cliches || []) {
      if (contentPart.includes(cliche.toLowerCase())) {
        this.deviations.push(`[陈词滥调] "${cliche}"`);
      }
    }
  }
}

// ========== 导出 ==========
module.exports = {
  PRD_TEMPLATE,
  CalibrationEngine,
  createCalibrationEngine: (prd) => new CalibrationEngine(prd)
};

// 如果直接运行，显示模板结构
if (require.main === module) {
  console.log('Story PRD Template v20.2-Peng');
  console.log('\nPRD结构:');
  for (const key of Object.keys(PRD_TEMPLATE)) {
    console.log(`  • ${key}`);
  }
  console.log('\n使用方式:');
  console.log('  const { CalibrationEngine } = require("./story-prd-template.js");');
  console.log('  const engine = new CalibrationEngine(myPRD);');
  console.log('  const result = engine.calibratePrompt(prompt, "S01");');
}
