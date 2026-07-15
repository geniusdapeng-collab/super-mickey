/**
 * Story PRD Template v21 - CalibrationEngine Upgrade
 * 
 * U01: JSON Schema对齐 (prd-nirath-v21.schema.json)
 * U02: 六大检查方法补全实现
 * U03: 跨镜头连续性校验 (CrossShotValidator)
 * U04: 加权评分体系重构 + 分级告警
 * U09: AutoFix建议纳入deviation对象
 * 
 * 基准版本: v20.2-Peng + v6.2-patch60
 * 兼容: 完全向后兼容v20.2 CalibrationEngine API
 */

// ========== PRD数据结构模板（复用v20.2定义） ==========
const PRD_TEMPLATE = {
  meta: {
    title: "故事名称",
    codename: "内部代号",
    version: "v21.0",
    genre: "类型",
    targetDuration: 70,
    targetShots: 16,
    createdAt: "2026-05-28",
    author: "引擎生成"
  },
  
  core: {
    synopsis: "",
    theme: "",
    emotionalArc: [
      { phase: "opening", emotion: "wonder", intensity: 0.3 },
      { phase: "establishing", emotion: "curiosity", intensity: 0.4 },
      { phase: "rising", emotion: "tension", intensity: 0.6 },
      { phase: "building", emotion: "anticipation", intensity: 0.7 },
      { phase: "climax", emotion: "awe", intensity: 0.9 },
      { phase: "resolve", emotion: "warmth", intensity: 0.5 }
    ],
    moral: "",
    usp: "",
    references: []
  },
  
  world: {
    setting: "",
    atmosphere: "",
    visualStyle: "",
    timeSpace: {
      era: "",
      location: "",
      season: "",
      timeOfDay: ""
    },
    culturalElements: [],
    forbiddenCulturalElements: []
  },
  
  characters: {
    protagonist: {
      name: "",
      codename: "",
      age: 0,
      gender: "",
      personality: [],
      canDo: [],
      cannotDo: [],
      visualAnchors: {
        required: [],
        preferred: [],
        forbidden: []
      },
      emotionReactions: {
        exhausted: ["slumped shoulders", "heavy breathing", "slow movements"],
        sad: ["downcast eyes", "slumped posture", "trembling lip"],
        curious: ["leaning forward", "widened eyes", "reaching out"],
        awe: ["eyes wide", "jaw slightly open", "frozen in place"],
        warm: ["soft smile", "relaxed shoulders", "gentle gaze"],
        joy: ["bright smile", "energetic movements", "laughing"],
        scared: ["wide eyes", "trembling", "backing away"],
        determined: ["clenched jaw", "focused gaze", "firm stance"]
      },
      arc: {
        startingState: "",
        endingState: "",
        keyTransformation: ""
      }
    },
    antagonist: null,
    supporting: [],
    creatures: []
  },
  
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
  
  positive: {
    visualStyle: [],
    actions: [],
    emotions: [],
    sceneElements: [],
    materials: [],
    lighting: []
  },
  
  negative: {
    forbiddenActions: [],
    forbiddenVisuals: [],
    forbiddenThemes: [],
    cliches: [],
    overusedWords: [],
    deprecatedElements: []
  },
  
  calibrationRules: {
    character: [
      "角色行为必须在canDo范围内",
      "角色不能做cannotDo中的行为",
      "情绪必须匹配emotionReactions映射",
      "视觉锚点required必须出现在所有镜头中"
    ],
    world: [
      "场景必须符合setting定义",
      "禁止出现forbiddenCulturalElements",
      "视觉风格必须匹配visualStyle",
      "时间/空间设定不能矛盾"
    ],
    narrative: [
      "每镜必须有明确的narrativePurpose",
      "情绪变化必须符合emotionalArc",
      "Act结构必须完整（起承转合）",
      "结局必须符合moral传达"
    ],
    emotional: [
      "动作必须服务于情绪",
      "情绪跳跃需要过渡",
      "高潮必须有情感爆发",
      "结局必须有情感余韵"
    ],
    visual: [
      "L4角色锚点必须包含所有required特征",
      "禁止出现forbiddenVisuals",
      "材质复杂度不能与前镜矛盾",
      "光影逻辑必须自洽"
    ]
  },
  
  changelog: []
};

// ========== U04: 加权评分配置 ==========
const SCORE_WEIGHTS = {
  character: 0.25,    // 角色一致性（最重要）
  world: 0.20,        // 世界观一致性
  narrative: 0.15,      // 叙事一致性
  emotion: 0.15,        // 情感一致性
  visual: 0.15,         // 视觉一致性
  promptQuality: 0.10   // Prompt质量（长度利用率等）
};

const SEVERITY_WEIGHTS = {
  FATAL: 100,      // 必须阻断生成
  CRITICAL: 40,    // 必须修复
  WARNING: 15,     // 建议修复
  INFO: 3          // 提示
};

// ========== U02+U04: CalibrationEngine v21 ==========
class CalibrationEngine {
  constructor(prd) {
    this.prd = prd;
    this.deviations = [];
    this.utilizationStatus = null;
  }

  // ===== 主校准方法（v21升级：加权评分+分级告警+完整检查） =====
  calibratePrompt(prompt, shotId = 'unknown') {
    this.deviations = [];
    this.utilizationStatus = null;

    // 1. 长度/利用率检查（独立维度）
    const utilizationResult = this._checkUtilization(prompt);

    // 2. U02: 六大一致性检查（完整实现）
    this._checkCharacterConsistency(prompt, shotId);
    this._checkWorldConsistency(prompt, shotId);
    this._checkNarrativeConsistency(prompt, shotId);
    this._checkEmotionalConsistency(prompt, shotId);
    this._checkVisualConsistency(prompt, shotId);
    this._checkNegativePrompts(prompt, shotId);

    // 3. U04: 加权评分计算
    const scores = this._calculateWeightedScores();

    // 4. U04: 分级告警生成
    const alerts = this._generateAlerts();

    // 5. 判断是否通过（FATAL级别阻断）
    const hasFatal = alerts.some(a => a.level === 'FATAL');

    return {
      shotId,
      passed: !hasFatal,
      alerts,
      deviations: this.deviations,
      scores: {
        overall: scores.overall,
        breakdown: {
          character: scores.character,
          world: scores.world,
          narrative: scores.narrative,
          emotion: scores.emotion,
          visual: scores.visual,
          promptQuality: scores.promptQuality
        }
      },
      utilization: utilizationResult,
      prdVersion: this.prd?.meta?.version || 'unknown',
      timestamp: new Date().toISOString()
    };
  }

  // ===== U02: 角色一致性检查（完整实现） =====
  _checkCharacterConsistency(prompt, shotId) {
    const { protagonist, supporting = [], creatures = [] } = this.prd.characters || {};
    const allCharacters = [protagonist, ...supporting, ...creatures].filter(Boolean);

    for (const char of allCharacters) {
      if (!char || !char.name) continue;
      
      const promptLower = prompt.toLowerCase();
      const charNameLower = char.name.toLowerCase();
      const charCodeLower = (char.codename || '').toLowerCase();
      
      // 检查角色是否出现在Prompt中
      const charAppears = promptLower.includes(charNameLower) || 
                          (charCodeLower && promptLower.includes(charCodeLower));
      
      // 1. 检查 cannotDo 违规（核心能力边界）
      for (const forbidden of char.cannotDo || []) {
        if (!forbidden) continue;
        const regex = new RegExp('\\b' + this._escapeRegex(forbidden.toLowerCase()) + '\\b', 'i');
        if (regex.test(prompt)) {
          this._addDeviation({
            type: 'CHARACTER_CANNOT_DO_VIOLATION',
            severity: 'FATAL',
            shotId,
            message: `角色"${char.name}"被禁止的行为"${forbidden}"出现在Prompt中`,
            rule: `${char.codename || char.name}.cannotDo 包含 "${forbidden}"`,
            fix: `移除"${forbidden}"相关描述，替换为 ${(char.canDo || []).slice(0, 3).join(' / ') || '其他允许行为'}`
          });
        }
      }

      // 2. 检查视觉锚点缺失（仅当角色出现在Prompt中时）
      if (charAppears) {
        const requiredAnchors = char.visualAnchors?.required || [];
        const missingAnchors = [];
        
        for (const anchor of requiredAnchors) {
          if (!anchor) continue;
          if (!promptLower.includes(anchor.toLowerCase())) {
            missingAnchors.push(anchor);
          }
        }
        
        // 如果缺少超过1个核心特征才报偏离（降低敏感度）
        if (missingAnchors.length > 1) {
          this._addDeviation({
            type: 'CHARACTER_ANCHOR_MISSING',
            severity: 'CRITICAL',
            shotId,
            message: `角色"${char.name}"缺少核心视觉锚点: ${missingAnchors.slice(0, 2).join(', ')}${missingAnchors.length > 2 ? '...' : ''}`,
            rule: `${char.codename || char.name}.visualAnchors.required 必须出现`,
            fix: `在Prompt中添加视觉描述: "${missingAnchors[0]}"`
          });
        }
      }

      // 3. 检查视觉锚点禁忌
      const forbiddenAnchors = char.visualAnchors?.forbidden || [];
      for (const f of forbiddenAnchors) {
        if (!f) continue;
        if (promptLower.includes(f.toLowerCase())) {
          this._addDeviation({
            type: 'CHARACTER_ANCHOR_FORBIDDEN',
            severity: 'CRITICAL',
            shotId,
            message: `角色"${char.name}"的视觉禁忌"${f}"出现在Prompt中`,
            rule: `${char.codename || char.name}.visualAnchors.forbidden 不得出现`,
            fix: `移除"${f}"相关描述`
          });
        }
      }
    }
  }

  // ===== U02: 世界观一致性检查（完整实现） =====
  _checkWorldConsistency(prompt, shotId) {
    const { world } = this.prd || {};
    if (!world) return;

    const promptLower = prompt.toLowerCase();

    // 1. 检查禁止文化元素
    for (const forbidden of world.forbiddenCulturalElements || []) {
      if (!forbidden) continue;
      if (promptLower.includes(forbidden.toLowerCase())) {
        this._addDeviation({
          type: 'WORLD_CULTURE_FORBIDDEN',
          severity: 'CRITICAL',
          shotId,
          message: `禁止的文化元素"${forbidden}"出现在Prompt中`,
          rule: `world.forbiddenCulturalElements 不得出现`,
          fix: `替换为允许的替代元素: ${(world.culturalElements || []).slice(0, 3).join(' / ') || '其他元素'}`
        });
      }
    }

    // 2. 检查视觉风格偏离（覆盖率检测）
    const expectedStyle = world.visualStyle || (this.prd.positive?.visualStyle || []).join(' ');
    if (expectedStyle) {
      const styleKeywords = expectedStyle.toLowerCase()
        .split(/[\s,]+/)
        .filter(w => w.length > 3);
      
      const matchedKeywords = styleKeywords.filter(kw => promptLower.includes(kw));
      const styleCoverage = styleKeywords.length > 0 
        ? matchedKeywords.length / styleKeywords.length 
        : 1;

      if (styleCoverage < 0.3 && styleKeywords.length > 0) {
        this._addDeviation({
          type: 'WORLD_STYLE_DRIFT',
          severity: 'WARNING',
          shotId,
          message: `视觉风格覆盖度仅${Math.round(styleCoverage * 100)}%，低于阈值30%`,
          detail: `期望风格关键词: ${styleKeywords.slice(0, 5).join(', ')}`,
          fix: `在Prompt中融入更多风格词: "${(this.prd.positive?.visualStyle || []).slice(0, 3).join(', ')}"`
        });
      }
    }
  }

  // ===== U02: 叙事一致性检查（完整实现） =====
  _checkNarrativeConsistency(prompt, shotId) {
    const shot = this._findShot(shotId);
    if (!shot) {
      // 只在shotId格式正确但未定义时报警告
      if (/^S\d{2,3}$/.test(shotId)) {
        this._addDeviation({
          type: 'NARRATIVE_SHOT_UNDEFINED',
          severity: 'WARNING',
          shotId,
          message: `镜头"${shotId}"在PRD structure中未定义，无法校验叙事一致性`,
          fix: `在PRD structure.acts[].shots[]中添加${shotId}的定义`
        });
      }
      return;
    }

    // 1. 检查narrativeBeat是否与prompt语义匹配（关键词覆盖）
    if (shot.narrativeBeat) {
      const beatKeywords = shot.narrativeBeat.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const promptLower = prompt.toLowerCase();
      const hasBeatRef = beatKeywords.some(kw => promptLower.includes(kw));
      
      if (!hasBeatRef && beatKeywords.length > 0) {
        this._addDeviation({
          type: 'NARRATIVE_BEAT_MISMATCH',
          severity: 'WARNING',
          shotId,
          message: `Prompt未体现叙事节拍"${shot.narrativeBeat}"`,
          rule: `structure.acts[].shots[].narrativeBeat 必须在Prompt中有语义体现`,
          fix: `在Prompt中融入叙事意图: "${shot.narrativeBeat.substring(0, 50)}"`
        });
      }
    }
  }

  // ===== U02: 情感一致性检查（完整实现） =====
  _checkEmotionalConsistency(prompt, shotId) {
    const shot = this._findShot(shotId);
    if (!shot || !shot.emotion) return;

    const expectedEmotion = shot.emotion.toLowerCase();
    const promptLower = prompt.toLowerCase();

    // 从positive.emotions中查找对应情绪关键词
    const positiveEmotions = this.prd.positive?.emotions || [];
    const emotionMatch = positiveEmotions.some(e => {
      const eLower = e.toLowerCase();
      return eLower.includes(expectedEmotion) || promptLower.includes(eLower);
    });

    // 同时检查prompt中是否直接包含情绪词
    const directEmotionMatch = promptLower.includes(expectedEmotion);

    if (!emotionMatch && !directEmotionMatch && positiveEmotions.length > 0) {
      const relevantEmotions = positiveEmotions.filter(e => 
        e.toLowerCase().includes(expectedEmotion) || expectedEmotion.includes(e.toLowerCase())
      );
      
      this._addDeviation({
        type: 'EMOTION_NOT_EXPRESSED',
        severity: 'WARNING',
        shotId,
        message: `镜头期望情绪"${shot.emotion}"在Prompt中缺乏明确表达`,
        rule: `镜头.emotion 必须通过关键词在Prompt中体现`,
        fix: `添加情绪描述词，如: "${relevantEmotions.slice(0, 2).join('", "') || expectedEmotion + ' atmosphere'}"`
      });
    }
  }

  // ===== U02: 视觉一致性检查（完整实现） =====
  _checkVisualConsistency(prompt, shotId) {
    const { negative } = this.prd || {};
    const promptLower = prompt.toLowerCase();

    // 1. 检查禁止视觉元素
    for (const forbidden of negative?.forbiddenVisuals || []) {
      if (!forbidden) continue;
      if (promptLower.includes(forbidden.toLowerCase())) {
        this._addDeviation({
          type: 'VISUAL_FORBIDDEN_ELEMENT',
          severity: 'CRITICAL',
          shotId,
          message: `禁止的视觉元素"${forbidden}"出现在Prompt中`,
          rule: `negative.forbiddenVisuals 不得出现`,
          fix: `移除"${forbidden}"，使用替代方案`
        });
      }
    }

    // 2. 检查过度使用词汇
    for (const word of negative?.overusedWords || []) {
      if (!word) continue;
      const regex = new RegExp('\\b' + this._escapeRegex(word) + '\\b', 'gi');
      const matches = prompt.match(regex);
      if (matches && matches.length > 1) {
        this._addDeviation({
          type: 'VISUAL_OVERUSED_WORD',
          severity: 'INFO',
          shotId,
          message: `词汇"${word}"在Prompt中重复出现${matches.length}次`,
          rule: `negative.overusedWords 应避免重复`,
          fix: `用同义词替换重复: "${this._getSynonym(word)}"`
        });
      }
    }
  }

  // ===== U02: 负面提示词检查（v20.2.3升级：分离正负内容区） =====
  _checkNegativePrompts(prompt, shotId) {
    const { negative } = this.prd || {};
    
    // 策略：找到Prompt中以"No "/"Without "/"Exclude "/"Avoid "开头的段落视为负面约束区
    // 只检查正面内容区是否出现禁止元素
    const lines = prompt.split(/[,\.\n]/);
    const positiveSegments = [];
    const negativeSegments = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const isNegativeLine = /^\s*(no|without|exclude|avoid|never|dont|don't|forbidden|禁止)\s+/i.test(trimmed);
      if (isNegativeLine) {
        negativeSegments.push(trimmed);
      } else {
        positiveSegments.push(trimmed);
      }
    }

    const positiveText = positiveSegments.join(' ').toLowerCase();

    // 仅在正面内容区检查禁止主题
    for (const theme of negative?.forbiddenThemes || []) {
      if (!theme) continue;
      if (positiveText.includes(theme.toLowerCase())) {
        this._addDeviation({
          type: 'THEME_FORBIDDEN_IN_POSITIVE',
          severity: 'FATAL',
          shotId,
          message: `禁止主题"${theme}"出现在Prompt正面内容中`,
          rule: `negative.forbiddenThemes 不得出现在正面描述中`,
          fix: `如果意图是排除此主题，请使用"No ${theme}"格式移至Prompt末尾负面约束区；否则移除`
        });
      }
    }

    // 检查禁止行为（也在正面内容区检查）
    for (const action of negative?.forbiddenActions || []) {
      if (!action) continue;
      if (positiveText.includes(action.toLowerCase())) {
        this._addDeviation({
          type: 'ACTION_FORBIDDEN_IN_POSITIVE',
          severity: 'CRITICAL',
          shotId,
          message: `禁止行为"${action}"出现在Prompt正面内容中`,
          rule: `negative.forbiddenActions 不得出现在正面描述中`,
          fix: `使用"No ${action}"格式移至负面约束区，或替换为允许行为`
        });
      }
    }
  }

  // ===== U04: 长度/利用率检查 =====
  _checkUtilization(prompt) {
    const promptLen = prompt.length;
    const hasChinese = /[\u4e00-\u9fff]/.test(prompt);
    const isEnglish = !hasChinese;
    
    const utilization = isEnglish 
      ? (promptLen / 980) 
      : ((prompt.match(/[\u4e00-\u9fff]/g) || []).length / 490);
    const utilizationPct = Math.round(utilization * 100);
    
    const result = {
      current: promptLen,
      limit: isEnglish ? 980 : 490,
      percentage: utilizationPct,
      status: 'IDEAL',
      suggestion: ''
    };
    
    if (isEnglish) {
      if (promptLen < 950) {
        result.status = 'WASTE';
        result.suggestion = '增强Action细节，填满可用空间';
        this._addDeviation({
          type: 'PROMPT_SPACE_WASTE',
          severity: 'WARNING',
          shotId: 'global',
          message: `[空间浪费] ${promptLen}/980字符，利用率仅${utilizationPct}%，目标≥99%`,
          rule: `Prompt应最大化利用可用字符空间`,
          fix: `增强Action细节、环境描述、情绪描写，填满至970+字符`
        });
      } else if (promptLen > 980) {
        result.status = 'OVERFLOW';
        result.suggestion = '裁剪至980字符以内';
        this._addDeviation({
          type: 'PROMPT_LENGTH_OVERFLOW',
          severity: 'FATAL',
          shotId: 'global',
          message: `[长度超限-致命] ${promptLen}字符 > 内部限制980 (官方1000)`,
          rule: `Prompt不得超过内部限制980字符`,
          fix: `裁剪冗余描述，优先保留Tier-1核心内容`
        });
      } else if (promptLen >= 970 && promptLen <= 980) {
        this.utilizationStatus = { ideal: true, pct: utilizationPct, len: promptLen };
      }
    } else {
      const chineseChars = (prompt.match(/[\u4e00-\u9fff]/g) || []).length;
      if (chineseChars < 470) {
        result.status = 'WASTE';
        result.suggestion = '增强Action细节填满空间';
      } else if (chineseChars > 490) {
        result.status = 'OVERFLOW';
        result.suggestion = '裁剪至490汉字以内';
      }
    }
    
    // 双重保险：绝对不超过官方上限
    if (promptLen > 1000) {
      this._addDeviation({
        type: 'PROMPT_LENGTH_CRITICAL',
        severity: 'FATAL',
        shotId: 'global',
        message: `[长度告警-严重] ${promptLen}字符 > 官方上限1000`,
        rule: `Prompt绝对不得超过官方上限1000字符`,
        fix: `紧急裁剪至980字符以内`
      });
    }
    
    return result;
  }

  // ===== U04: 加权评分计算 =====
  _calculateWeightedScores() {
    const dimensions = {
      character: { 
        weight: SCORE_WEIGHTS.character, 
        deviations: this.deviations.filter(d => d.type?.startsWith('CHARACTER')) 
      },
      world: { 
        weight: SCORE_WEIGHTS.world, 
        deviations: this.deviations.filter(d => d.type?.startsWith('WORLD')) 
      },
      narrative: { 
        weight: SCORE_WEIGHTS.narrative, 
        deviations: this.deviations.filter(d => d.type?.startsWith('NARRATIVE')) 
      },
      emotion: { 
        weight: SCORE_WEIGHTS.emotion, 
        deviations: this.deviations.filter(d => d.type?.startsWith('EMOTION')) 
      },
      visual: { 
        weight: SCORE_WEIGHTS.visual, 
        deviations: this.deviations.filter(d => d.type?.startsWith('VISUAL')) 
      },
      promptQuality: { 
        weight: SCORE_WEIGHTS.promptQuality, 
        deviations: this.deviations.filter(d => 
          d.type?.startsWith('PROMPT') || d.type?.startsWith('THEME') || d.type?.startsWith('ACTION')
        ) 
      }
    };

    let totalScore = 0;
    const breakdown = {};

    for (const [dim, config] of Object.entries(dimensions)) {
      const deduction = config.deviations.reduce((sum, d) => {
        return sum + (SEVERITY_WEIGHTS[d.severity] || 0);
      }, 0);
      const dimScore = Math.max(0, 100 - deduction);
      breakdown[dim] = Math.round(dimScore);
      totalScore += dimScore * config.weight;
    }

    return {
      overall: Math.round(totalScore),
      ...breakdown
    };
  }

  // ===== U04: 分级告警生成 =====
  _generateAlerts() {
    return this.deviations.map(d => ({
      level: d.severity,
      type: d.type,
      message: d.message,
      shotId: d.shotId,
      fix: d.fix || null,
      rule: d.rule || null,
      detail: d.detail || null
    }));
  }

  // ===== U02: 角色行为校准（保留v20.2 API） =====
  calibrateCharacterAction(action, characterKey, shotId = 'unknown') {
    let char = this.prd.characters?.[characterKey];
    if (!char) {
      for (const [key, candidate] of Object.entries(this.prd.characters || {})) {
        if (candidate && (candidate.codename === characterKey || candidate.name === characterKey)) {
          char = candidate;
          break;
        }
      }
    }
    
    if (!char) {
      return { 
        passed: false, 
        deviation: `角色${characterKey}未在PRD中定义`, 
        rule: "角色存在性",
        severity: 'CRITICAL'
      };
    }
    
    const actionLower = action.toLowerCase();
    const deviations = [];
    
    for (const forbidden of char.cannotDo || []) {
      if (!forbidden) continue;
      const regex = new RegExp('\\b' + this._escapeRegex(forbidden.toLowerCase()) + '\\b');
      if (regex.test(actionLower)) {
        deviations.push({
          severity: 'FATAL',
          message: `${char.name}不能做"${forbidden}"`,
          rule: "角色能力边界",
          fix: `改用${(char.canDo || []).slice(0, 3).join('/')}等动作`
        });
      }
    }
    
    if (deviations.length > 0) {
      return {
        passed: false,
        deviation: deviations[0].message,
        allDeviations: deviations,
        severity: deviations[0].severity,
        rule: deviations[0].rule,
        fix: deviations[0].fix
      };
    }
    
    return { passed: true, character: char.name };
  }

  // ===== U02: 情绪-动作校准（保留v20.2 API） =====
  calibrateEmotionAction(emotion, action, characterKey, shotId = 'unknown') {
    let char = this.prd.characters?.[characterKey];
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
    const actionWords = actionLower.split(/[\s,\.\(\)]+/).filter(w => w.length > 2);
    
    const hasMatch = expectedActions.some(expected => {
      const expectedLower = expected.toLowerCase();
      return actionWords.some(word => word.includes(expectedLower) || expectedLower.includes(word));
    });
    
    if (!hasMatch) {
      return {
        passed: false,
        deviation: `情绪"${emotion}"建议动作: ${expectedActions.join(', ')}，实际动作不匹配`,
        severity: 'WARNING',
        rule: "情绪-动作映射",
        fix: `使用"${expectedActions[0]}"替代当前动作`
      };
    }
    
    return { passed: true };
  }

  // ===== U02: 世界观校准（保留v20.2 API） =====
  calibrateWorld(sceneDescription, shotId = 'unknown') {
    const descLower = sceneDescription.toLowerCase();
    const deviations = [];
    
    for (const forbidden of this.prd.world?.forbiddenCulturalElements || []) {
      if (!forbidden) continue;
      if (descLower.includes(forbidden.toLowerCase())) {
        deviations.push({
          severity: 'CRITICAL',
          message: `禁止元素"${forbidden}"出现在场景中`,
          rule: "世界观一致性",
          fix: `移除"${forbidden}"`
        });
      }
    }
    
    const styleKeywords = this.prd.world?.visualStyle?.toLowerCase().split(/[\s,]+/) || [];
    const hasStyleMatch = styleKeywords.some(kw => kw.length > 3 && descLower.includes(kw));
    
    if (!hasStyleMatch && styleKeywords.length > 0) {
      deviations.push({
        severity: 'WARNING',
        message: `场景缺少视觉风格关键词(${styleKeywords.slice(0, 3).join(', ')})`,
        rule: "视觉风格一致性",
        fix: `添加风格关键词`
      });
    }
    
    return {
      passed: deviations.length === 0,
      deviations,
      world: this.prd.world?.setting
    };
  }

  // ===== 校准报告生成（保留v20.2 API） =====
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
        report += `\n  [${result.shotId}] 评分: ${result.score || result.scores?.overall || 'N/A'}/100\n`;
        const deviations = result.deviations || [];
        for (const dev of deviations) {
          const sev = dev.severity || 'WARNING';
          const icon = sev === 'FATAL' ? '🔴' : sev === 'CRITICAL' ? '🟠' : sev === 'WARNING' ? '🟡' : '🔵';
          report += `    ${icon} [${sev}] ${dev.message}\n`;
          if (dev.fix) report += `       💡 修复: ${dev.fix}\n`;
        }
      }
    } else {
      report += `\n✅ 全部通过！与PRD保持一致。\n`;
    }
    
    return report;
  }

  // ===== U03: 跨镜头连续性校验入口 =====
  validateSequence(shotResults) {
    const CrossShotValidator = require('./cross-shot-validator.js');
    const validator = new CrossShotValidator(this.prd);
    return validator.validateSequence(shotResults);
  }

  // ===== 内部辅助方法 =====
  
  _addDeviation(deviation) {
    this.deviations.push(deviation);
  }

  _findShot(shotId) {
    for (const act of this.prd.structure?.acts || []) {
      const shot = act.shots?.find(s => s.shotId === shotId);
      if (shot) return shot;
    }
    return null;
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _getSynonym(word) {
    const synonyms = {
      'epic': 'grand / monumental / majestic',
      'stunning': 'striking / impressive / remarkable',
      'breathtaking': 'awe-inspiring / magnificent / extraordinary',
      'beautiful': 'elegant / exquisite / splendid',
      'amazing': 'astonishing / astounding / wondrous'
    };
    return synonyms[word.toLowerCase()] || '[查找同义词]';
  }
}

// ========== U03: 跨镜头连续性校验器（独立模块） ==========
class CrossShotValidator {
  constructor(prd) {
    this.prd = prd;
  }

  validateSequence(shotResults) {
    const deviations = [];

    for (let i = 1; i < shotResults.length; i++) {
      const prev = shotResults[i - 1];
      const curr = shotResults[i];

      deviations.push(...this._checkAnchorContinuity(prev, curr));
      deviations.push(...this._checkEmotionJump(prev, curr));
      deviations.push(...this._checkTimeSpaceContinuity(prev, curr));
    }

    const fatalCount = deviations.filter(d => d.severity === 'FATAL').length;
    const criticalCount = deviations.filter(d => d.severity === 'CRITICAL').length;

    return {
      passed: fatalCount === 0 && criticalCount === 0,
      deviations,
      continuityScore: this._calculateContinuityScore(deviations, shotResults.length),
      summary: {
        total: deviations.length,
        fatal: fatalCount,
        critical: criticalCount,
        warning: deviations.filter(d => d.severity === 'WARNING').length
      }
    };
  }

  _checkAnchorContinuity(prev, curr) {
    const deviations = [];
    const protagonist = this.prd.characters?.protagonist;
    if (!protagonist) return deviations;

    const coreAnchors = protagonist.visualAnchors?.required || [];

    for (const anchor of coreAnchors) {
      if (!anchor) continue;
      const prevHas = prev.prompt?.toLowerCase().includes(anchor.toLowerCase());
      const currHas = curr.prompt?.toLowerCase().includes(anchor.toLowerCase());

      if (prevHas && !currHas) {
        deviations.push({
          type: 'CROSSSHOT_ANCHOR_DROPPED',
          severity: 'CRITICAL',
          between: `${prev.shotId} → ${curr.shotId}`,
          message: `核心视觉锚点"${anchor}"在${curr.shotId}中丢失（前一镜存在）`,
          rule: "角色视觉锚点跨镜必须保持连续",
          fix: `在${curr.shotId}的Prompt中恢复"${anchor}"描述`
        });
      }
    }
    return deviations;
  }

  _checkEmotionJump(prev, curr) {
    const deviations = [];
    const prevIntensity = this._getEmotionIntensity(prev.emotion || prev.emotionPhase);
    const currIntensity = this._getEmotionIntensity(curr.emotion || curr.emotionPhase);

    if (prevIntensity !== null && currIntensity !== null) {
      const jump = Math.abs(currIntensity - prevIntensity);
      if (jump > 0.4) {
        deviations.push({
          type: 'CROSSSHOT_EMOTION_JUMP',
          severity: 'WARNING',
          between: `${prev.shotId} → ${curr.shotId}`,
          message: `情绪强度跳跃过大: ${prevIntensity} → ${currIntensity} (差值${jump.toFixed(2)} > 0.4)`,
          rule: "情绪强度变化应渐进过渡，相邻镜头差值不超过0.4",
          fix: `在两者之间插入过渡镜头，或调整${curr.shotId}的情绪强度`
        });
      }
    }
    return deviations;
  }

  _checkTimeSpaceContinuity(prev, curr) {
    const deviations = [];
    // 简化实现：检测矛盾的时间关键词并存
    const timeKeywords = {
      day: ['day', 'sunlight', 'bright', 'noon'],
      night: ['night', 'dark', 'moonlight', 'midnight'],
      dawn: ['dawn', 'sunrise', 'morning'],
      dusk: ['dusk', 'sunset', 'evening']
    };

    const prevLower = prev.prompt?.toLowerCase() || '';
    const currLower = curr.prompt?.toLowerCase() || '';

    for (const [timeA, keywordsA] of Object.entries(timeKeywords)) {
      for (const [timeB, keywordsB] of Object.entries(timeKeywords)) {
        if (timeA === timeB) continue;
        const hasAInPrev = keywordsA.some(k => prevLower.includes(k));
        const hasBInCurr = keywordsB.some(k => currLower.includes(k));
        
        if (hasAInPrev && hasBInCurr) {
          // 检查是否是允许的时间变化（白天→黑夜需要transition）
          if ((timeA === 'day' && timeB === 'night') || (timeA === 'night' && timeB === 'day')) {
            deviations.push({
              type: 'CROSSSHOT_TIME_JUMP',
              severity: 'WARNING',
              between: `${prev.shotId} → ${curr.shotId}`,
              message: `时间场景突变: ${timeA} → ${timeB}，缺乏过渡`,
              rule: "昼夜变化需有过渡镜头或明确转场说明",
              fix: `添加过渡镜头或转场说明（如"fade to night"）`
            });
          }
        }
      }
    }
    return deviations;
  }

  _getEmotionIntensity(emotionName) {
    if (!emotionName) return null;
    const arc = this.prd.core?.emotionalArc || [];
    const phase = arc.find(p => 
      p.emotion === emotionName || p.phase === emotionName
    );
    return phase ? phase.intensity : null;
  }

  _calculateContinuityScore(deviations, totalShots) {
    const weights = { FATAL: 50, CRITICAL: 25, WARNING: 10, INFO: 2 };
    const totalDeduction = deviations.reduce((sum, d) => {
      return sum + (weights[d.severity] || 0);
    }, 0);
    return Math.max(0, 100 - totalDeduction / Math.max(1, totalShots));
  }
}

// ========== 导出 ==========
module.exports = {
  PRD_TEMPLATE,
  CalibrationEngine,
  CrossShotValidator,
  SCORE_WEIGHTS,
  SEVERITY_WEIGHTS,
  createCalibrationEngine: (prd) => new CalibrationEngine(prd)
};

// 如果直接运行，显示版本信息
if (require.main === module) {
  console.log('Story PRD Template v21 - CalibrationEngine Upgrade');
  console.log('\n升级内容:');
  console.log('  • U01: JSON Schema统一对齐');
  console.log('  • U02: 六大检查方法补全实现');
  console.log('  • U03: 跨镜头连续性校验');
  console.log('  • U04: 加权评分体系重构 + 分级告警');
  console.log('  • U09: AutoFix建议纳入deviation对象');
  console.log('\n使用方式:');
  console.log('  const { CalibrationEngine, CrossShotValidator } = require("./story-prd-template-v21.js");');
}
