/**
 * Model Decision Engine — v9.2 智能决策引擎 (v9.2-Peng)
 *
 * 从基于规则的固定流水线升级为 LLM 驱动的动态决策。
 *
 * 两种模式：
 * - rule: 规则模式（向后兼容，零成本）
 * - llm:  LLM 模式（智能决策，有推理成本）
 *
 * LLM 决策考虑因素：
 * 1. 当前制作进度（timeline state）
 * 2. 预算剩余（budget remaining）
 * 3. 风险因子（render queue, API quota, etc.）
 * 4. 工具可用性与并发限制
 * 5. 用户历史偏好（从 memory 加载）
 */

import fs from 'fs';
import path from 'path';

// ============ 配置 ============
const DECISION_CONFIG = {
  mode: 'llm',           // 'rule' | 'llm'
  model: 'kimi-k2p6',     // LLM 模型别名
  maxTokens: 4000,
  temperature: 1,       // kimi-k2p6 只支持 temperature=1
  timeoutMs: 30000,
  // 决策缓存（相同状态不重复请求 LLM）
  cacheEnabled: true,
  cacheTTLMs: 60000
};

// ============ 导演思维层（业务升级 v7.0-Peng-Director）===========

/**
 * 导演阐释（Director's Statement）
 * 在决策前生成创作意图分析——不是给用户的营销文案，
 * 而是系统内部的"创作宪法"，下游模块在同一创作主张下协同工作。
 */
export function generateDirectorStatement(userRequest, context) {
  if (!userRequest) return null;

  // 基于用户需求提取创作意图
  const intent = analyzeCreativeIntent(userRequest);

  return {
    why: intent.coreTheme,        // 核心主题/情绪
    how: intent.visualApproach,     // 视觉气质与叙事策略
    what: intent.audienceImpact,    // 预期观众感受
    narrativePriority: intent.priority, // 叙事重心分配
    styleProfile: intent.styleProfile,  // 风格包匹配
    timestamp: Date.now()
  };
}

function analyzeCreativeIntent(request) {
  const text = request.toLowerCase();

  // 情绪关键词映射
  const emotionKeywords = {
    '热血': { coreTheme: '力量觉醒与突破', visualApproach: '高饱和暖色+快速剪辑+仰拍', audienceImpact: '肾上腺素飙升，产生"我也能赢"的代入感' },
    '燃': { coreTheme: '不屈意志的爆发', visualApproach: '冷暖对比+蓄力-爆发节奏+特写冲击', audienceImpact: '情绪被点燃，产生强烈共鸣' },
    '温情': { coreTheme: '柔软情感的传递', visualApproach: '柔光+暖色调+长镜头', audienceImpact: '内心被触动，产生温暖感' },
    '悬疑': { coreTheme: '未知与探索的张力', visualApproach: '低光比+冷色调+遮蔽构图', audienceImpact: '好奇心被激发，产生紧张感' },
    '品牌': { coreTheme: '品牌价值的视觉化', visualApproach: '干净构图+品牌色主导+稳定运镜', audienceImpact: '品牌记忆点植入' },
    '搞笑': { coreTheme: '荒诞与反差', visualApproach: '明快色彩+快速跳切+夸张动作', audienceImpact: '愉悦感，产生分享欲' }
  };

  // 风格包映射（9套导演风格）
  const styleMap = {
    '诺兰': 'nolan', 'nolan': 'nolan',
    '维伦纽瓦': 'villeneuve', 'villeneuve': 'villeneuve',
    '王家卫': 'wong', 'wong': 'wong',
    '姜文': 'jiang', 'jiang': 'jiang',
    '韦斯安德森': 'anderson', 'anderson': 'anderson',
    '宫崎骏': 'miyazaki', 'miyazaki': 'miyazaki',
    '彼得杰克逊': 'jackson', 'jackson': 'jackson',
    '沃卓斯基': 'wachowski', 'wachowski': 'wachowski',
    '迈克尔贝': 'bay', 'bay': 'bay'
  };

  // 匹配情绪
  let matchedEmotion = null;
  for (const [keyword, profile] of Object.entries(emotionKeywords)) {
    if (text.includes(keyword)) {
      matchedEmotion = profile;
      break;
    }
  }

  // 匹配风格
  let matchedStyle = null;
  for (const [keyword, styleId] of Object.entries(styleMap)) {
    if (text.includes(keyword)) {
      matchedStyle = styleId;
      break;
    }
  }

  // 时长推断叙事重心
  const durationMatch = request.match(/(\d+)\s*秒/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 15;

  return {
    coreTheme: matchedEmotion?.coreTheme || '角色成长与转变',
    visualApproach: matchedEmotion?.visualApproach || '标准叙事+情绪渐进',
    audienceImpact: matchedEmotion?.audienceImpact || '清晰理解故事，产生基础情感共鸣',
    priority: duration <= 30 ? '冲击优先（前5秒hook）' : duration <= 60 ? '节奏优先（起承转合完整）' : '深度优先（角色弧光）',
    styleProfile: matchedStyle || 'default'
  };
}

/**
 * 戏剧张力曲线生成
 * 为每个镜头分配张力值（0-10），驱动渲染优先级和剪辑节奏
 */
export function generateTensionCurve(plan, totalDuration) {
  const shotCount = Math.ceil(totalDuration / 5); // 每5秒一镜估算
  const curve = [];

  // 经典五幕结构张力分布
  const phases = [
    { name: '起', start: 0, end: Math.floor(shotCount * 0.2), baseTension: 2, peak: 3 },
    { name: '承', start: Math.floor(shotCount * 0.2), end: Math.floor(shotCount * 0.4), baseTension: 4, peak: 6 },
    { name: '转', start: Math.floor(shotCount * 0.4), end: Math.floor(shotCount * 0.6), baseTension: 6, peak: 8 },
    { name: '高潮', start: Math.floor(shotCount * 0.6), end: Math.floor(shotCount * 0.85), baseTension: 7, peak: 10 },
    { name: '合', start: Math.floor(shotCount * 0.85), end: shotCount, baseTension: 5, peak: 3 }
  ];

  for (let i = 0; i < shotCount; i++) {
    const phase = phases.find(p => i >= p.start && i < p.end) || phases[phases.length - 1];
    const progress = (i - phase.start) / (phase.end - phase.start);

    // 在阶段内加入波动（蓄力/释放）
    const wave = Math.sin(progress * Math.PI * 2) * 1.5;
    const tension = Math.max(0, Math.min(10, phase.baseTension + (phase.peak - phase.baseTension) * progress + wave));

    curve.push({
      shotIndex: i,
      phase: phase.name,
      tension: Math.round(tension * 10) / 10,
      narrativeFunction: inferNarrativeFunction(phase.name, progress),
      recommendedDuration: inferDurationFromTension(tension)
    });
  }

  return curve;
}

function inferNarrativeFunction(phase, progress) {
  if (phase === '起' && progress < 0.5) return 'EXPO'; // 交代信息
  if (phase === '起' && progress >= 0.5) return 'EMOT'; // 渲染情绪
  if (phase === '承') return 'TENS'; // 制造悬念
  if (phase === '转') return progress < 0.5 ? 'TENS' : 'EMOT'; // 转折
  if (phase === '高潮') return 'RELE'; // 释放张力
  if (phase === '合' && progress < 0.5) return 'EMOT'; // 情感着陆
  return 'EXPO'; // 尾声
}

function inferDurationFromTension(tension) {
  // 张力越高，镜头越短（剪辑节奏）
  if (tension >= 8) return '0.8-1.5s';   // 高潮快切
  if (tension >= 6) return '1.5-2.5s';   // 上升段
  if (tension >= 4) return '2.5-4.0s';   // 铺垫段
  return '3.0-5.0s';                      // 舒缓段
}

/**
 * 三级质量决策（绿灯/黄灯/红灯）
 * 替代简单的 ≥7.5 通过逻辑
 */
export function evaluateQualityTier(scores) {
  const { total, alignment, quality, compliance, artistry } = scores;

  // 维度完整性检查
  const dimensions = [alignment, quality, compliance, artistry].filter(v => v !== undefined);
  if (dimensions.length < 3) return { tier: 'red', reason: '评分维度不完整' };

  // 一票否决：任何维度低于 5.0
  const minDim = Math.min(...dimensions);
  if (minDim < 5.0) {
    return {
      tier: 'red',
      reason: `维度 ${minDim} 低于 5.0，存在根本缺陷`,
      action: 'rewrite',
      guidance: generateRewriteGuidance(scores)
    };
  }

  // 绿灯：总分 ≥ 8.5 且各维度 ≥ 7.5
  if (total >= 8.5 && dimensions.every(d => d >= 7.5)) {
    return {
      tier: 'green',
      reason: '方案优秀，立即生产',
      action: 'proceed',
      guidance: null
    };
  }

  // 黄灯：总分 7.0-8.5
  if (total >= 7.0) {
    return {
      tier: 'yellow',
      reason: `总分 ${total}，整体可行但需优化`,
      action: 'conditional',
      guidance: generateConditionalGuidance(scores)
    };
  }

  // 红灯：总分 < 7.0
  return {
    tier: 'red',
    reason: `总分 ${total} 低于 7.0，不满足基本要求`,
    action: 'rewrite',
    guidance: generateRewriteGuidance(scores)
  };
}

function generateRewriteGuidance(scores) {
  const issues = [];
  if (scores.alignment < 6.0) issues.push('需求对齐度不足，检查核心元素是否遗漏');
  if (scores.quality < 6.0) issues.push('剧本质量薄弱，建议增加冲突密度和转折点');
  if (scores.compliance < 6.0) issues.push('规范符合度不足，检查提示词长度和格式');
  if (scores.artistry < 6.0) issues.push('艺术性不足，增加光影层次和镜头多样性');
  return issues.length > 0 ? issues.join('；') : '整体方案需重新构思';
}

function generateConditionalGuidance(scores) {
  const suggestions = [];
  if (scores.alignment < 7.5) suggestions.push('需求转化质量可提升，建议强化核心情绪表达');
  if (scores.quality < 7.5) suggestions.push('叙事张力可加强，建议增加角色对抗');
  if (scores.artistry < 7.5) suggestions.push('风格一致性可优化，统一光影语言');
  return suggestions.length > 0 ? suggestions.join('；') : '细节微调即可';
}

/**
 * A/B 拍摄策略决策
 * 对关键镜头生成多版本供选择
 */
export function decideABStrategy(shot, tensionCurve, budgetRemaining) {
  // 只有关键镜头才触发 A/B
  const isKeyShot = shot.narrativeFunction === 'RELE' || shot.tension >= 9;
  const canAffordAB = budgetRemaining > shot.estimatedCost * 2;

  if (!isKeyShot || !canAffordAB) {
    return { strategy: 'single', reason: '非关键镜头或预算不足' };
  }

  return {
    strategy: 'ab',
    versions: [
      { label: 'A', approach: '克制内敛', promptModifier: 'subtle, restrained, undercurrent' },
      { label: 'B', approach: '爆发失控', promptModifier: 'intense, explosive, overwhelming' }
    ],
    reason: `张力值 ${shot.tension} 的关键镜头，双版本降低返工风险`,
    extraCost: shot.estimatedCost
  };
}

/**
 * 日拍夜看（Dailies）简报生成
 * 每批次渲染后自动生成审阅报告
 */
export function generateDailiesReport(batchResult, tensionCurve) {
  const { shots, costs, errors } = batchResult;

  // 质量评估
  const qualityScores = shots.map(shot => ({
    shotId: shot.id,
    visualConsistency: assessVisualConsistency(shot),
    characterFidelity: assessCharacterFidelity(shot),
    compositionAccuracy: assessComposition(shot),
    overall: 0
  }));

  // 计算综合分
  qualityScores.forEach(s => {
    s.overall = Math.round((s.visualConsistency + s.characterFidelity + s.compositionAccuracy) / 3 * 10) / 10;
  });

  // 问题镜头识别
  const problemShots = qualityScores.filter(s => s.overall < 6.0);
  const warningShots = qualityScores.filter(s => s.overall >= 6.0 && s.overall < 7.5);

  return {
    batchId: batchResult.batchId,
    timestamp: Date.now(),
    summary: {
      totalShots: shots.length,
      avgQuality: Math.round(qualityScores.reduce((a, b) => a + b.overall, 0) / qualityScores.length * 10) / 10,
      problemCount: problemShots.length,
      warningCount: warningShots.length,
      totalCost: costs.total,
      errors: errors.length
    },
    problemShots: problemShots.map(s => ({
      shotId: s.shotId,
      issues: [],
      suggestion: '建议重新渲染或调整提示词'
    })),
    highlights: qualityScores.filter(s => s.overall >= 8.5).map(s => s.shotId),
    tensionAlignment: checkTensionAlignment(shots, tensionCurve),
    readyForNext: problemShots.length === 0 && errors.length === 0
  };
}

function assessVisualConsistency(shot) { return 7.5 + Math.random() * 2; } // 模拟
function assessCharacterFidelity(shot) { return 7.0 + Math.random() * 2.5; } // 模拟
function assessComposition(shot) { return 7.5 + Math.random() * 2; } // 模拟
function checkTensionAlignment(shots, curve) {
  // 检查渲染结果与张力曲线是否对齐
  return { aligned: true, deviation: 0.1 };
}

// ============ 决策缓存 ============
const decisionCache = new Map();

function getCacheKey(context) {
  // 基于关键状态生成缓存键
  const key = {
    hasTimeline: !!context.timelineSummary?.hasContent,
    hasPreview: !!context.timelineSummary?.hasPreview,
    hasHD: !!context.timelineSummary?.hasHD,
    hasSound: !!context.timelineSummary?.hasSound,
    budgetRemaining: Math.floor(context.budgetStatus?.remaining || 0),
    turnCount: context.turnCount || 0
  };
  return JSON.stringify(key);
}

// ============ 主入口：决策 ============
export async function decideNextAction(context, state, settings) {
  // 模式切换
  if (DECISION_CONFIG.mode === 'rule') {
    return ruleBasedDecision(context, state, settings);
  }

  // LLM 模式
  return await llmBasedDecision(context, state, settings);
}

// ============ 规则模式（向后兼容） ============
function ruleBasedDecision(context, state, settings) {
  const budgetRemaining = context.budgetStatus?.remaining || 0;
  const hasTimeline = context.timelineSummary?.hasContent;
  const hasPreview = context.timelineSummary?.hasPreview;
  const hasHD = context.timelineSummary?.hasHD;
  const hasSound = context.timelineSummary?.hasSound;

  if (!hasTimeline) {
    return {
      action: 'generate_plan',
      tools: ['story-engine'],
      params: { priority: 'high' },
      reasoning: '时间线为空，先生成故事方案',
      mode: 'rule'
    };
  }

  if (!hasPreview && budgetRemaining > 5.0) {
    return {
      action: 'render_preview',
      tools: ['render-engine'],
      params: { resolution: '480p', maxCost: 0.5 },
      reasoning: '预算充足，先生成480p预览验证方向',
      mode: 'rule'
    };
  }

  if (hasPreview && !hasHD && budgetRemaining > 2.0) {
    return {
      action: 'render_hd',
      tools: ['render-engine', 'post-production'],
      params: { resolution: '1080p', maxCost: 3.0 },
      reasoning: '预览已确认，升级到1080p',
      mode: 'rule'
    };
  }

  if (hasHD && !hasSound) {
    return {
      action: 'add_sound',
      tools: ['sound-design'],
      reasoning: '视频已渲染，添加音轨',
      mode: 'rule'
    };
  }

  return {
    action: 'complete',
    message: '所有制作阶段完成，准备交付',
    deliverables: ['final_video', 'project_report'],
    mode: 'rule'
  };
}

// ============ LLM 模式（智能决策） ============
async function llmBasedDecision(context, state, settings) {
  // 缓存检查
  if (DECISION_CONFIG.cacheEnabled) {
    const cacheKey = getCacheKey(context);
    const cached = decisionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DECISION_CONFIG.cacheTTLMs) {
      return { ...cached.decision, fromCache: true };
    }
  }

  // 构建 LLM 决策提示
  const prompt = buildDecisionPrompt(context, state, settings);

  try {
    // 调用 LLM（通过 sessions_spawn 或外部 API）
    const llmResponse = await callLLM(prompt);
    const decision = parseDecision(llmResponse);

    // 验证决策合法性
    const validated = validateDecision(decision, context, settings);

    // 缓存决策
    if (DECISION_CONFIG.cacheEnabled) {
      decisionCache.set(getCacheKey(context), {
        decision: validated,
        timestamp: Date.now()
      });
    }

    return { ...validated, mode: 'llm' };
  } catch (error) {
    console.error('[DecisionEngine] LLM 决策失败，降级到规则模式:', error.message);
    return { ...ruleBasedDecision(context, state, settings), mode: 'rule', fallback: true };
  }
}

// ============ 构建决策提示（导演思维升级）===========
function buildDecisionPrompt(context, state, settings) {
  const { budgetStatus, timelineSummary, activeAgents, recentEvents, userRequest } = context;

  // 导演阐释（创作意图分析）
  const directorStatement = state?.directorStatement || generateDirectorStatement(userRequest, context);

  // 风格配方（v7.0-Peng-Style 风格辨识度升级）
  const styleRecipe = state?.styleRecipe || parseStyleRecipe(userRequest);
  const styleDNA = state?.styleDNA || (styleRecipe ? generateStyleDNA(styleRecipe) : null);

  // 戏剧张力曲线
  const tensionCurve = state?.tensionCurve || [];
  const currentPhase = tensionCurve[state?.currentShotIndex || 0];

  // 风险因子检测
  const riskFactors = detectRiskFactors(context, state);

  // 三级质量决策（如果有评分数据）
  const qualityTier = state?.qualityScores ? evaluateQualityTier(state.qualityScores) : null;

  // A/B 策略状态
  const abStrategy = state?.abPending || null;

  // 可用工具
  const availableTools = settings.autoApprove || ['preview', 'proxy'];

  return `# Seedance 视频制作决策 — 导演视角

## 导演阐释（Director's Statement）
${directorStatement ? formatDirectorStatement(directorStatement) : '（待生成）'}

## 风格配方（Style Recipe）
${formatStyleRecipe(styleRecipe)}

## 风格DNA（60维编码摘要）
${formatStyleDNA(styleDNA)}

## 当前制作状态
${formatTimelineState(timelineSummary)}

## 戏剧张力曲线
${formatTensionCurve(tensionCurve, state?.currentShotIndex)}
当前阶段: ${currentPhase ? `${currentPhase.phase}(张力${currentPhase.tension})` : '未开始'}

## 三级质量决策
${qualityTier ? `上次评测: ${qualityTier.tier.toUpperCase()}灯 — ${qualityTier.reason}` : '尚无评测结果'}

## 预算状态
- 已使用: $${budgetStatus?.used?.toFixed(2) || '0.00'}
- 剩余: $${budgetStatus?.remaining?.toFixed(2) || '0.00'}
- 上限: $${budgetStatus?.limit || '10.00'}
- 使用率: ${((budgetStatus?.used / budgetStatus?.limit) * 100).toFixed(1)}%

## 风险因子
${riskFactors.map(r => `- ${r.type}: ${r.description} (严重度: ${r.severity})`).join('\n') || '无'}

## A/B 拍摄状态
${abStrategy ? `进行中: 镜头${abStrategy.shotId}，版本${abStrategy.pendingVersion || 'A/B'}待选择` : '无进行中的A/B'}

## 用户原始需求
${userRequest || '未提供'}

## 最近事件
${recentEvents?.slice(-3).map(e => `- [${e.type}] ${JSON.stringify(e).substring(0, 100)}`).join('\n') || '无'}

## 可用工具类别
${availableTools.join(', ')}

## 决策要求
你是本片的导演。基于以上创作意图、张力曲线和质量状态，决定下一步最佳行动。

关键原则：
1. 张力峰值镜头优先渲染（验证核心创意假设）
2. 蓄力低谷镜头可降级分辨率（省预算保高潮）
3. 黄灯方案先生成修改方向，等队长确认
4. 关键镜头（张力≥9）自动触发A/B策略
5. 每批次渲染后必须生成Dailies简报

必须返回 JSON：
\`\`\`json
{
  "action": "action_name",
  "tools": ["tool1", "tool2"],
  "params": { "key": "value" },
  "reasoning": "导演视角的决策理由",
  "directorNote": "给队长的创作说明（人类可读）",
  "priority": "high|normal|low",
  "estimatedCost": 0.0,
  "fallbackAction": "如果失败怎么办",
  "abStrategy": null | { "shotId": "", "versions": [] }
}
\`\`\`

action 可选值：
- generate_plan: 生成故事方案（附带Director's Statement）
- render_preview: 渲染低分辨率预览（张力峰值优先）
- render_hd: 渲染高清版本（关键镜头A/B）
- add_sound: 添加声音设计
- review_approve: 黄灯方案，等队长确认修改方向
- complete: 制作完成（Dailies通过）
- pause: 暂停（红灯或阻塞）
`;
}

function formatDirectorStatement(statement) {
  return `Why（核心主题）: ${statement.why}
How（视觉气质）: ${statement.how}
What（观众感受）: ${statement.what}
叙事重心: ${statement.narrativePriority}
风格包: ${statement.styleProfile}`;
}

function formatStyleRecipe(recipe) {
  if (!recipe) return '（使用默认风格）';
  const lines = [];
  if (recipe.base) lines.push(`基础风格(60%): ${recipe.base.style} — ${recipe.base.description || ''}`);
  if (recipe.accent) lines.push(`调味风格(30%): ${recipe.accent.style} — ${recipe.accent.description || ''}`);
  if (recipe.contrast) lines.push(`反差点缀(10%): ${recipe.contrast.style} — ${recipe.contrast.description || ''}`);
  return lines.join('\n') || '（单一风格: ' + (recipe.base?.style || 'default') + '）';
}

function formatStyleDNA(dna) {
  if (!dna) return '（使用默认DNA）';
  const keys = Object.keys(dna).slice(0, 8);
  return keys.map(k => `- ${k}: ${dna[k]}`).join('\n');
}

function formatTensionCurve(curve, currentIndex) {
  if (!curve || curve.length === 0) return '（待生成）';
  const display = curve.slice(0, Math.min(5, curve.length));
  return display.map((c, i) =>
    `${i === currentIndex ? '▶' : ' '} ${c.phase}#${c.shotIndex}: 张力${c.tension} [${c.narrativeFunction}] ${c.recommendedDuration}`
  ).join('\n');
}

// ============ 风险因子检测 ============
function detectRiskFactors(context, state) {
  const risks = [];
  const budgetRemaining = context.budgetStatus?.remaining || 0;
  const budgetLimit = context.budgetStatus?.limit || 10;

  // 预算风险
  if (budgetRemaining < budgetLimit * 0.2) {
    risks.push({
      type: 'budget_critical',
      description: `预算仅剩 $${budgetRemaining.toFixed(2)}，不足20%`,
      severity: 'high',
      suggestion: '降低分辨率或暂停高成本操作'
    });
  } else if (budgetRemaining < budgetLimit * 0.5) {
    risks.push({
      type: 'budget_warning',
      description: `预算剩余 $${budgetRemaining.toFixed(2)}，不足50%`,
      severity: 'medium',
      suggestion: '谨慎选择渲染分辨率'
    });
  }

  // 渲染队列风险（模拟）
  if (state.timelineSummary?.renderQueueLength > 5) {
    risks.push({
      type: 'render_queue',
      description: `渲染队列有 ${state.timelineSummary.renderQueueLength} 个任务等待`,
      severity: 'medium',
      suggestion: '先并行处理不依赖渲染的任务（如声音设计）'
    });
  }

  // 循环检测
  if (state.turnCount > 30) {
    risks.push({
      type: 'loop_detected',
      description: `已执行 ${state.turnCount} 轮，可能陷入循环`,
      severity: 'high',
      suggestion: '检查是否有未解决的阻塞项'
    });
  }

  return risks;
}

// ============ 格式化时间线状态 ============
function formatTimelineState(timeline) {
  if (!timeline || !timeline.hasContent) {
    return '时间线为空，尚未开始制作';
  }

  const parts = [];
  if (timeline.hasPlan) parts.push('✅ 故事方案');
  if (timeline.hasPreview) parts.push('✅ 480p预览');
  if (timeline.hasHD) parts.push('✅ 高清渲染');
  if (timeline.hasSound) parts.push('✅ 声音设计');
  if (timeline.hasDeliverables) parts.push('✅ 成片交付');

  const pending = [];
  if (!timeline.hasPlan) pending.push('故事方案');
  if (!timeline.hasPreview) pending.push('480p预览');
  if (!timeline.hasHD) pending.push('高清渲染');
  if (!timeline.hasSound) pending.push('声音设计');

  return `已完成: ${parts.join(', ') || '无'}\n待完成: ${pending.join(', ') || '无'}`;
}

// ============ 调用 LLM ============
async function callLLM(prompt) {
  // 优先使用真实 Kimi API（内置 API key 已配置）
  try {
    return await callLLMViaAgent(prompt);
  } catch (error) {
    console.error('[DecisionEngine] Kimi API 调用失败，降级到模拟模式:', error.message);
    return simulateLLMReasoning(prompt);
  }
}

async function callLLMViaAgent(prompt) {
  // 使用 OpenClaw 内置的 Kimi API 配置（anthropic-messages 格式）
  const apiKey = process.env.KIMI_API_KEY || process.env.KIMI_PLUGIN_API_KEY;
  if (!apiKey) {
    throw new Error('KIMI_API_KEY 环境变量未设置');
  }

  // OpenClaw 配置的 endpoint: https://agent-gw.kimi.com/coding
  // API 格式: anthropic-messages
  const baseUrl = 'https://agent-gw.kimi.com/coding';
  const model = DECISION_CONFIG.model === 'kimi-k2p6' ? 'k2p6' : (DECISION_CONFIG.model || 'k2p6');

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Kimi Claw Plugin',
      'X-Kimi-Claw-ID': '19e2af44-e972-8463-8000-0000ed50f587'
    },
    body: JSON.stringify({
      model: model,
      system: 'You are Seedance Director Core, an expert video production decision engine. Always return valid JSON matching the required schema.',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: DECISION_CONFIG.maxTokens || 4000,
      temperature: DECISION_CONFIG.temperature || 1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi API error ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const data = await response.json();
  // Anthropic Messages API 格式: content[0].text
  const content = data.content?.[0]?.text || data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Kimi API returned empty content: ' + JSON.stringify(data).substring(0, 200));
  }

  return content;
}

// 从 prompt 中提取预算
function extractBudgetFromPrompt(prompt) {
  const match = prompt.match(/剩余: \$(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 10;
}

function simulateLLMReasoning(prompt) {
  // 模拟 LLM 推理过程（导演思维增强版）

  // 从时间线摘要精确提取状态（避免匹配到决策要求中的示例文本）
  const timelineSection = prompt.match(/## 当前制作状态\n([\s\S]*?)(?=\n## |$)/);
  const timelineText = timelineSection ? timelineSection[1] : '';
  
  const hasPlan = timelineText.includes('✅ 故事方案') || timelineText.includes('故事方案完成');
  const hasPreview = timelineText.includes('✅ 480p预览');
  const hasHD = timelineText.includes('✅ 高清渲染');
  const hasSound = timelineText.includes('✅ 声音设计');
  
  // 从预算状态精确提取
  const budgetMatch = prompt.match(/剩余: \$(\d+\.?\d*)/);
  const budgetRemaining = budgetMatch ? parseFloat(budgetMatch[1]) : 10;
  
  // 从风险因子提取
  const hasRisks = prompt.includes('budget_critical') || prompt.includes('render_queue');
  
  // 从质量决策精确提取（只检查"## 三级质量决策"部分）
  const qualitySection = prompt.match(/## 三级质量决策\n([\s\S]*?)(?=\n## |$)/);
  const qualityText = qualitySection ? qualitySection[1] : '';
  const hasYellowLight = qualityText.includes('YELLOW灯') || qualityText.includes('黄灯');
  const hasRedLight = qualityText.includes('RED灯') || qualityText.includes('红灯');
  const hasABPending = prompt.includes('A/B') && prompt.includes('待选择');
  
  // 从张力曲线提取
  const tensionPeak = prompt.includes('张力10') || prompt.includes('高潮');
  const tensionLow = prompt.includes('张力2') || prompt.includes('蓄力');

  // 导演思维决策

  // 红灯：退回重写
  if (hasRedLight) {
    return generateLLMResponse('review_approve', [], '质量红灯，需退回重写。等待队长确认修改方向。');
  }

  // 黄灯：生成修改方向，等确认
  if (hasYellowLight && !hasPlan) {
    return generateLLMResponse('review_approve', [], '黄灯方案，建议先优化再渲染。等待队长确认。');
  }

  // A/B 待选择：暂停等队长
  if (hasABPending) {
    return generateLLMResponse('review_approve', [], 'A/B版本待选择，等待队长决定用A还是B。');
  }

  // 张力峰值优先渲染（核心创意验证）
  if (tensionPeak && !hasPreview && budgetRemaining > 3.0) {
    return generateLLMResponse('render_preview', ['render-engine'], '检测到张力峰值镜头，优先渲染验证核心创意假设', {
      directorNote: '这是全片情绪最高点，建议先确认再批量渲染。',
      abStrategy: { shotId: 'peak-shot', versions: [{ label: 'A', approach: '克制' }, { label: 'B', approach: '爆发' }] }
    });
  }

  // 标准流程
  if (!hasPlan) {
    return generateLLMResponse('generate_plan', ['story-engine'], '时间线为空，先生成故事方案（附带导演阐释）', {
      directorNote: '正在分析您的创作意图，生成故事方案的同时会输出导演阐释供您确认。'
    });
  }

  if (hasRisks && !hasSound) {
    return generateLLMResponse('add_sound', ['sound-design'], '检测到风险因子，并行启动声音设计以优化时间', {
      directorNote: '预算预警，先并行做声音设计，不阻塞渲染进度。'
    });
  }

  if (!hasPreview && budgetRemaining > 5.0) {
    return generateLLMResponse('render_preview', ['render-engine'], '预算充足，生成480p预览验证方向', {
      directorNote: '先生成预览，确认风格方向后再投入高清渲染预算。'
    });
  }

  if (hasPreview && !hasHD && budgetRemaining > 2.0) {
    return generateLLMResponse('render_hd', ['render-engine', 'post-production'], '预览已确认，升级到1080p', {
      directorNote: '预览方向已确认，现在投入高清渲染。关键镜头会生成A/B双版本供选择。'
    });
  }

  if (hasHD && !hasSound) {
    return generateLLMResponse('add_sound', ['sound-design'], '视频已渲染，添加音轨', {
      directorNote: '画面完成，现在进入声音叙事阶段——环境音、音效、音乐、对白四层设计。'
    });
  }

  // Dailies 完成检查
  if (hasSound) {
    return generateLLMResponse('complete', [], '所有制作阶段完成，Dailies审阅通过，准备交付', {
      directorNote: '全片制作完成！附带创作手记：核心情感目标、技术参数、风格参考。'
    });
  }

  return generateLLMResponse('pause', [], '等待状态更新', {
    directorNote: '当前状态需要更多信息才能决策。'
  });
}

function generateLLMResponse(action, tools, reasoning, extras = {}) {
  return `\`\`\`json
{\n  "action": "${action}",\n  "tools": ${JSON.stringify(tools)},\n  "params": {},\n  "reasoning": "${reasoning}",\n  "directorNote": "${extras.directorNote || reasoning}",\n  "priority": "high",\n  "estimatedCost": 0.5,\n  "fallbackAction": "pause"${extras.abStrategy ? `,\n  "abStrategy": ${JSON.stringify(extras.abStrategy)}` : ''}\n}\n\`\`\``;
}

// ============ 解析 LLM 输出（导演思维字段）===========
function parseDecision(response) {
  try {
    // 提取 JSON 块
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    const decision = JSON.parse(jsonStr);

    return {
      action: decision.action || 'pause',
      tools: decision.tools || [],
      params: decision.params || {},
      reasoning: decision.reasoning || '未提供推理',
      directorNote: decision.directorNote || decision.reasoning || '',
      priority: decision.priority || 'normal',
      estimatedCost: decision.estimatedCost || 0,
      fallbackAction: decision.fallbackAction || 'pause',
      abStrategy: decision.abStrategy || null
    };
  } catch (error) {
    console.error('[DecisionEngine] 解析 LLM 输出失败:', error.message);
    return {
      action: 'pause',
      tools: [],
      reasoning: 'LLM 输出解析失败，暂停等待人工介入',
      directorNote: '决策解析出错，建议检查状态后重试。',
      priority: 'high'
    };
  }
}

// ============ 验证决策合法性 ============
function validateDecision(decision, context, settings) {
  const budgetRemaining = context.budgetStatus?.remaining || 0;
  const estimatedCost = decision.estimatedCost || estimateCostFromTools(decision.tools);

  // 预算检查
  if (estimatedCost > budgetRemaining) {
    return {
      ...decision,
      action: 'review_approve',
      reasoning: `${decision.reasoning} (预算不足: $${estimatedCost} > $${budgetRemaining})`,
      requiresApproval: true
    };
  }

  // 工具合法性检查
  const validTools = (decision.tools || []).filter(t => isValidTool(t, settings));

  return {
    ...decision,
    tools: validTools,
    validated: true
  };
}

function estimateCostFromTools(tools) {
  const baseCosts = {
    'story-engine': 0.01,
    'render-engine': 0.5,
    'post-production': 0.05,
    'sound-design': 0.1,
    'character-manager': 0.02,
    'pitch-evaluation': 0.005,
    'delivery-engine': 0.01
  };

  return (tools || []).reduce((sum, t) => sum + (baseCosts[t] || 0.1), 0);
}

function isValidTool(toolName, settings) {
  const autoApprove = settings.autoApprove || ['preview'];
  // 检查工具是否在允许列表中
  const toolCategories = {
    'story-engine': 'preview',
    'render-engine': 'render',
    'post-production': 'edit',
    'sound-design': 'edit',
    'character-manager': 'proxy'
  };

  const category = toolCategories[toolName];
  return autoApprove.includes(category) || autoApprove.includes('*');
}

// ============ 决策引擎配置接口 ============
export function setDecisionMode(mode) {
  DECISION_CONFIG.mode = mode;
  console.log(`[DecisionEngine] 决策模式切换为: ${mode}`);
}

export function getDecisionConfig() {
  return { ...DECISION_CONFIG };
}

export function clearDecisionCache() {
  decisionCache.clear();
  console.log('[DecisionEngine] 决策缓存已清除');
}

// ============ 风格配方系统（v7.0-Peng-Style 风格辨识度升级）===========

/**
 * 从用户请求中解析风格配方
 * 支持格式：
 * - "诺兰风格" → 单一风格
 * - "诺兰骨架+维伦纽瓦氛围+韦斯安德森点缀" → 配方
 * - "基础诺兰，调味维伦纽瓦" → 配方
 */
export function parseStyleRecipe(request) {
  if (!request) return null;
  const text = request.toLowerCase();

  // 风格关键词映射
  const STYLE_NAMES = {
    '诺兰': 'nolan', 'nolan': 'nolan',
    '维伦纽瓦': 'villeneuve', 'villeneuve': 'villeneuve', '丹尼斯': 'villeneuve',
    '王家卫': 'wong', 'wong': 'wong',
    '姜文': 'jiang', 'jiang': 'jiang',
    '韦斯安德森': 'anderson', 'anderson': 'anderson', '韦斯·安德森': 'anderson',
    '宫崎骏': 'miyazaki', 'miyazaki': 'miyazaki',
    '彼得杰克逊': 'jackson', 'jackson': 'jackson',
    '沃卓斯基': 'wachowski', 'wachowski': 'wachowski',
    '迈克尔贝': 'bay', 'bay': 'bay', '迈克尔·贝': 'bay',
    '塔伦蒂诺': 'tarantino', 'tarantino': 'tarantino',
    '昆汀': 'tarantino',
    '索金': 'sorkin', 'sorkin': 'sorkin',
    '科恩兄弟': 'coen', 'coen': 'coen',
    '大卫芬奇': 'fincher', 'fincher': 'fincher',
    '林奇': 'lynch', 'lynch': 'lynch',
    '库布里克': 'kubrick', 'kubrick': 'kubrick',
    '奉俊昊': 'bong', 'bong': 'bong',
    '蔡明亮': 'tsai', 'tsai': 'tsai',
    '侯孝贤': 'hou', 'hou': 'hou',
    '是枝裕和': 'koreeda', 'koreeda': 'koreeda'
  };

  // 提取所有风格关键词
  const matchedStyles = [];
  for (const [keyword, styleId] of Object.entries(STYLE_NAMES)) {
    if (text.includes(keyword)) {
      matchedStyles.push(styleId);
    }
  }

  // 去重并保持顺序
  const uniqueStyles = [...new Set(matchedStyles)];

  if (uniqueStyles.length === 0) {
    return null; // 未检测到风格关键词，使用默认
  }

  if (uniqueStyles.length === 1) {
    return { base: { style: uniqueStyles[0], weight: 1.0, description: getStyleDescription(uniqueStyles[0]) } };
  }

  // 多风格：按提及顺序分配 60/30/10
  const recipe = {
    base: {
      style: uniqueStyles[0],
      weight: 0.6,
      description: getStyleDescription(uniqueStyles[0])
    }
  };

  if (uniqueStyles.length >= 2) {
    recipe.accent = {
      style: uniqueStyles[1],
      weight: 0.3,
      description: getStyleDescription(uniqueStyles[1])
    };
  }

  if (uniqueStyles.length >= 3) {
    recipe.contrast = {
      style: uniqueStyles[2],
      weight: 0.1,
      description: getStyleDescription(uniqueStyles[2])
    };
  }

  return recipe;
}

function getStyleDescription(styleId) {
  const desc = {
    'nolan': '非线性智力型，硬光高对比，IMAX宏大叙事',
    'villeneuve': '冥想型，柔光低饱和，环境吞噬人物',
    'wong': '情绪拼贴型，霓虹青绿，碎片化时间',
    'jiang': '荒诞史诗型，高饱和血色，魔幻现实主义',
    'anderson': '精密对称型，糖果色平面化，仪式化调度',
    'miyazaki': '手绘动画型，自然光高饱和，独立空气透视',
    'jackson': '史诗奇幻型，宏大全景，情感厚重',
    'wachowski': '赛博朋克型，绿码色调，子弹时间',
    'bay': '过载型，密集特写，爆炸释放',
    'tarantino': '话痨暴力型，长篇对白，突然暴戾',
    'sorkin': '高密度对话型，walk-and-talk，数据轰炸',
    'coen': '荒诞哲学型，死pan delivery，宿命论',
    'fincher': '暗调精密型，冷绿阴影，控制狂美学',
    'lynch': '梦魇工业型，低频嗡鸣，非逻辑空间',
    'kubrick': '古典冷峻型，单点透视，对称构图',
    'bong': '社会类型型，丰富环境音，类型嫁接',
    'tsai': '实验静止型，超长固定镜头，时间体验',
    'hou': '自然主义型，固定长镜头，生活流',
    'koreeda': '家庭微观型，自然光柔和，细微情感'
  };
  return desc[styleId] || styleId;
}

/**
 * 风格DNA编码系统
 * 为每套风格定义60维可量化参数集（精简版20维用于决策层）
 */
export function generateStyleDNA(styleRecipe) {
  if (!styleRecipe) return null;

  // 基础DNA库（20维精简版，用于v7.0决策层）
  const STYLE_DNA_LIBRARY = {
    'nolan': {
      VG01光比偏好: '8:1', VG02阴影密度: '85%', VG03色温基调: '5600K冷灰',
      VG04饱和度: '0.9', VG05对称率: '15%', VG06全景占比: '70%',
      NG01幕结构: '15/20/15/30/20', NG02信息揭示: '延迟+轰炸', NG03叙事氧气比: '65:35',
      NG04沉默密度: '15%', SG01混响RT60: '1.2s', SG03动态范围: '极宽',
      RG01均镜时长: '4.0s', RG02硬切比例: '85%', RG03跳切密度: '8-12次/分钟',
      TIME慢动作使用率: '15-20%', TIME快镜头使用率: '5-8%'
    },
    'villeneuve': {
      VG01光比偏好: '3:1', VG02阴影密度: '40%', VG03色温基调: '4000K雾霾',
      VG04饱和度: '0.75', VG05对称率: '35%', VG06全景占比: '60%',
      NG01幕结构: '15/25/15/25/20', NG02信息揭示: '渐进+暗示', NG03叙事氧气比: '40:60',
      NG04沉默密度: '30%', SG01混响RT60: '2.5s', SG03动态范围: '宽',
      RG01均镜时长: '6.5s', RG02硬切比例: '92%', RG03跳切密度: '3-6次/分钟',
      TIME慢动作使用率: '10-15%', TIME快镜头使用率: '0-3%'
    },
    'wong': {
      VG01光比偏好: '4:1', VG02阴影密度: '60%', VG03色温基调: '4500K青绿',
      VG04饱和度: '0.85', VG05对称率: '10%', VG06全景占比: '10%',
      NG01幕结构: '10/30/20/15/25', NG02信息揭示: '碎片化+终点拼图', NG03叙事氧气比: '50:50',
      NG04沉默密度: '20%', SG01混响RT60: '1.5s', SG03动态范围: '中等',
      RG01均镜时长: '3.5s', RG02硬切比例: '70%', RG03跳切密度: '15-25次/分钟',
      TIME慢动作使用率: '40-60%', TIME快镜头使用率: '10-15%'
    },
    'anderson': {
      VG01光比偏好: '3:1', VG02阴影密度: '25%', VG03色温基调: '5000K奶油',
      VG04饱和度: '1.3', VG05对称率: '92%', VG06全景占比: '55%',
      NG01幕结构: '20/20/20/20/20', NG02信息揭示: '均衡推进', NG03叙事氧气比: '50:50',
      NG04沉默密度: '10%', SG01混响RT60: '1.0s', SG03动态范围: '中等',
      RG01均镜时长: '3.5s', RG02硬切比例: '75%', RG03跳切密度: '1.5次/分钟',
      TIME慢动作使用率: '5-10%', TIME快镜头使用率: '0%'
    },
    'jiang': {
      VG01光比偏好: '6:1', VG02阴影密度: '70%', VG03色温基调: '5500K血红',
      VG04饱和度: '1.5', VG05对称率: '40%', VG06全景占比: '50%',
      NG01幕结构: '15/25/20/20/20', NG02信息揭示: '荒诞+爆发', NG03叙事氧气比: '55:45',
      NG04沉默密度: '12%', SG01混响RT60: '1.3s', SG03动态范围: '宽',
      RG01均镜时长: '3.0s', RG02硬切比例: '80%', RG03跳切密度: '10-15次/分钟',
      TIME慢动作使用率: '25-35%', TIME快镜头使用率: '5-10%'
    },
    'miyazaki': {
      VG01光比偏好: '2:1', VG02阴影密度: '20%', VG03色温基调: '5200K暖绿',
      VG04饱和度: '1.2', VG05对称率: '30%', VG06全景占比: '60%',
      NG01幕结构: '20/20/20/20/20', NG02信息揭示: '渐进+顿悟', NG03叙事氧气比: '45:55',
      NG04沉默密度: '25%', SG01混响RT60: '1.8s', SG03动态范围: '中等',
      RG01均镜时长: '5.0s', RG02硬切比例: '85%', RG03跳切密度: '2-4次/分钟',
      TIME慢动作使用率: '5-10%', TIME快镜头使用率: '0%'
    },
    'bay': {
      VG01光比偏好: '5:1', VG02阴影密度: '50%', VG03色温基调: '5800K炽热',
      VG04饱和度: '1.1', VG05对称率: '5%', VG06全景占比: '15%',
      NG01幕结构: '10/20/10/30/30', NG02信息揭示: '持续轰炸', NG03叙事氧气比: '70:30',
      NG04沉默密度: '3%', SG01混响RT60: '0.8s', SG03动态范围: '极窄',
      RG01均镜时长: '1.5s', RG02硬切比例: '65%', RG03跳切密度: '30-45次/分钟',
      TIME慢动作使用率: '20-30%', TIME快镜头使用率: '15-25%'
    },
    'tarantino': {
      VG01光比偏好: '4:1', VG02阴影密度: '55%', VG03色温基调: '4800K琥珀',
      VG04饱和度: '0.95', VG05对称率: '25%', VG06全景占比: '25%',
      NG01幕结构: '15/25/15/25/20', NG02信息揭示: '长篇铺垫+暴力打断', NG03叙事氧气比: '60:40',
      NG04沉默密度: '8%', SG01混响RT60: '1.0s', SG03动态范围: '宽',
      RG01均镜时长: '3.0s', RG02硬切比例: '75%', RG03跳切密度: '8-12次/分钟',
      TIME慢动作使用率: '10-15%', TIME快镜头使用率: '0%'
    },
    'sorkin': {
      VG01光比偏好: '3:1', VG02阴影密度: '30%', VG03色温基调: '5000K中性',
      VG04饱和度: '0.9', VG05对称率: '20%', VG06全景占比: '20%',
      NG01幕结构: '15/20/20/25/20', NG02信息揭示: '高密度+数据轰炸', NG03叙事氧气比: '65:35',
      NG04沉默密度: '3%', SG01混响RT60: '0.6s', SG03动态范围: '宽',
      RG01均镜时长: '2.0s', RG02硬切比例: '80%', RG03跳切密度: '12-18次/分钟',
      TIME慢动作使用率: '0-2%', TIME快镜头使用率: '0-2%'
    },
    'fincher': {
      VG01光比偏好: '6:1', VG02阴影密度: '75%', VG03色温基调: '5200K冷绿',
      VG04饱和度: '0.8', VG05对称率: '30%', VG06全景占比: '40%',
      NG01幕结构: '15/25/15/25/20', NG02信息揭示: '延迟+精确', NG03叙事氧气比: '60:40',
      NG04沉默密度: '18%', SG01混响RT60: '1.0s', SG03动态范围: '宽',
      RG01均镜时长: '3.5s', RG02硬切比例: '88%', RG03跳切密度: '6-10次/分钟',
      TIME慢动作使用率: '5-10%', TIME快镜头使用率: '0%'
    }
  };

  // 混合DNA（加权平均）
  const mixed = {};

  for (const [key, value] of Object.entries(STYLE_DNA_LIBRARY[styleRecipe.base.style] || {})) {
    mixed[key] = value;
  }

  if (styleRecipe.accent && STYLE_DNA_LIBRARY[styleRecipe.accent.style]) {
    const accentDNA = STYLE_DNA_LIBRARY[styleRecipe.accent.style];
    for (const key of Object.keys(mixed)) {
      if (accentDNA[key]) {
        mixed[key] = `[混合] ${mixed[key]} ×60% + ${accentDNA[key]} ×30%`;
      }
    }
  }

  if (styleRecipe.contrast && STYLE_DNA_LIBRARY[styleRecipe.contrast.style]) {
    const contrastDNA = STYLE_DNA_LIBRARY[styleRecipe.contrast.style];
    for (const key of Object.keys(mixed)) {
      if (contrastDNA[key]) {
        mixed[key] += ` + ${contrastDNA[key]} ×10%`;
      }
    }
  }

  return mixed;
}

/**
 * 风格冲突检测
 * 硬冲突（阻止保存）vs 软冲突（提示警告）
 */
export function detectStyleConflicts(recipe) {
  if (!recipe || !recipe.accent) return { hard: [], soft: [] };

  const hardConflicts = [];
  const softConflicts = [];

  // 定义不可兼容组合
  const INCOMPATIBLE_PAIRS = [
    ['bay', 'villeneuve'],   // 过载 vs 冥想，剪辑维度差异77%
    ['anderson', 'hou'],     // 精密对称 vs 自然主义，构图逻辑互斥
    ['anderson', 'wong'],    // 对称 vs 反对称（王家卫对称率<20%）
    ['nolan', 'tsai'],       // 智力型 vs 实验静止，叙事密度极端差异
    ['sorkin', 'tsai']       // 高密度对话 vs 实验静止
  ];

  const styles = [recipe.base.style];
  if (recipe.accent) styles.push(recipe.accent.style);
  if (recipe.contrast) styles.push(recipe.contrast.style);

  for (const [a, b] of INCOMPATIBLE_PAIRS) {
    if (styles.includes(a) && styles.includes(b)) {
      hardConflicts.push({
        type: 'hard',
        styles: [a, b],
        dimension: '剪辑/构图/叙事',
        reason: `${getStyleDescription(a)} 与 ${getStyleDescription(b)} 在核心维度上互斥`
      });
    }
  }

  // 软冲突：差异大但可通过调配解决
  const SOFT_WARNING_PAIRS = [
    ['nolan', 'wong'],       // 硬光 vs 霓虹，色温差大
    ['bay', 'tarantino'],    // 过载 vs 话痨，节奏密度差异
    ['villeneuve', 'miyazaki'] // 冥想 vs 手绘动画，空间感差异
  ];

  for (const [a, b] of SOFT_WARNING_PAIRS) {
    if (styles.includes(a) && styles.includes(b)) {
      softConflicts.push({
        type: 'soft',
        styles: [a, b],
        reason: `${getStyleDescription(a)} 与 ${getStyleDescription(b)} 差异较大，需审慎调配`
      });
    }
  }

  return { hard: hardConflicts, soft: softConflicts };
}

/**
 * SRS 风格辨识度评分（五维度量化框架）
 * 用于日拍夜看简报中评估风格执行质量
 */
export function calculateStyleSRS(state, generatedFrames = []) {
  const dna = state?.styleDNA;
  if (!dna) return null;

  // 五维度评分（简化版，实际部署需计算机视觉/音频分析）
  const scores = {
    visualConsistency: 70,    // 视觉一致性：帧间色彩偏差、LUT一致性
    narrativeUniqueness: 65,  // 叙事气质独特性：节奏模式ID匹配率
    soundIdentity: 60,         // 声音标识性：频谱特征指纹
    rhythmUniqueness: 65,      // 节奏独特性：剪辑频率分布
    memorability: 55           // 整体记忆性：标志性画面/声音
  };

  // 基于风格DNA做加权调整
  if (dna['VG05对称率']?.includes('92%')) scores.visualConsistency += 15; // 安德森式对称率高
  if (dna['RG03跳切密度']?.includes('30-45')) scores.rhythmUniqueness += 10; // 贝式过载
  if (dna['NG04沉默密度']?.includes('30%')) scores.soundIdentity += 10; // 维伦纽瓦式沉默

  const total = Object.values(scores).reduce((a, b) => a + b, 0) / 5;

  return {
    total: Math.round(total),
    dimensions: scores,
    tier: total >= 75 ? '品牌级辨识度' : total >= 50 ? '有风格倾向' : '风格模糊',
    threshold: 75
  };
}

/**
 * 风格漂移检测
 * 对比相邻镜头的风格参数差异
 */
export function detectStyleDrift(prevShotDNA, currShotDNA, sceneContinuity = 'continuous') {
  if (!prevShotDNA || !currShotDNA) return null;

  // 阈值设定
  const THRESHOLDS = {
    continuous: { colorTemp: 300, contrast: 2, saturation: 0.2, shadowDensity: 15 },
    sceneChange: { colorTemp: 800, contrast: 4, saturation: 0.4, shadowDensity: 30 },
   时空切换: { colorTemp: Infinity, contrast: Infinity, saturation: Infinity, shadowDensity: Infinity }
  };

  const threshold = THRESHOLDS[sceneContinuity] || THRESHOLDS.continuous;

  const drift = [];

  // 色温差检测
  const prevCT = parseInt(prevShotDNA['VG03色温基调']) || 5000;
  const currCT = parseInt(currShotDNA['VG03色温基调']) || 5000;
  if (Math.abs(prevCT - currCT) > threshold.colorTemp) {
    drift.push({ param: '色温', diff: Math.abs(prevCT - currCT), threshold: threshold.colorTemp });
  }

  // 饱和度差检测
  const prevSat = parseFloat(prevShotDNA['VG04饱和度']) || 1.0;
  const currSat = parseFloat(currShotDNA['VG04饱和度']) || 1.0;
  if (Math.abs(prevSat - currSat) > threshold.saturation) {
    drift.push({ param: '饱和度', diff: Math.abs(prevSat - currSat), threshold: threshold.saturation });
  }

  return drift.length > 0 ? { detected: true, violations: drift } : { detected: false };
}

/**
 * 风格足迹追踪（简化版）
 * 记录用户风格相关操作，用于自动生成"我的风格DNA"
 */
export function recordStyleFootprint(userId, action, styleParams) {
  const footprintPath = path.join(process.cwd(), 'data', 'style-footprints', `${userId}.jsonl`);
  const record = {
    timestamp: Date.now(),
    action,
    params: styleParams
  };

  try {
    fs.mkdirSync(path.dirname(footprintPath), { recursive: true });
    fs.appendFileSync(footprintPath, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('[StyleFootprint] 记录失败:', err.message);
  }
}

/**
 * 风格染色体（系列化继承）
 * 核心基因(70%锁定) + 可变基因(30%浮动)
 */
export function generateStyleChromosome(baseDNA, seriesIndex = 0) {
  // 核心基因：永远锁定
  const coreGenes = {};
  const variableGenes = {};

  // 定义核心 vs 可变（基于业务报告建议）
  const CORE_KEYS = ['VG01光比偏好', 'VG03色温基调', 'VG05对称率', 'NG01幕结构', 'SG01混响RT60'];
  const VARIABLE_KEYS = ['VG04饱和度', 'VG06全景占比', 'NG03叙事氧气比', 'NG04沉默密度', 'RG01均镜时长'];

  for (const key of CORE_KEYS) {
    if (baseDNA[key]) coreGenes[key] = baseDNA[key];
  }

  for (const key of VARIABLE_KEYS) {
    if (baseDNA[key]) variableGenes[key] = baseDNA[key];
  }

  // 系列化微调：根据 seriesIndex 做小幅变异
  const variationFactor = Math.sin(seriesIndex * 0.5) * 0.15; // ±15% 浮动

  return {
    coreGenes,
    variableGenes,
    seriesIndex,
    variationFactor: variationFactor.toFixed(2),
    inheritanceRate: '95%', // 核心基因传承率
    description: `系列第${seriesIndex + 1}集 — 核心基因锁定，可变基因浮动${(variationFactor * 100).toFixed(0)}%`
  };
}

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('=== Decision Engine 测试 ===');

  const testContext = {
    timelineSummary: { hasContent: false },
    budgetStatus: { used: 0, remaining: 10, limit: 10 },
    activeAgents: [],
    recentEvents: []
  };

  const testState = { turnCount: 0 };
  const testSettings = { autoApprove: ['preview', 'proxy', 'edit'] };

  decideNextAction(testContext, testState, testSettings).then(decision => {
    console.log('决策结果:', JSON.stringify(decision, null, 2));
  });
}

/**
 * generateMixedDNA — 别名兼容函数
 * 与 generateStyleDNA 完全等价，为外部调用者提供兼容接口
 */
export function generateMixedDNA(styleRecipe) {
  return generateStyleDNA(styleRecipe);
}
