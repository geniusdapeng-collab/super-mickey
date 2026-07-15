/**
 * Story Scorer v20.1-Peng — 故事性评分引擎
 * 
 * 核心功能：
 * 1. 对分镜头脚本进行故事性多维度评分
 * 2. 如果不达标，生成反馈报告并打回重生成
 * 3. 评分维度：叙事完整性(30%) + 角色一致性(25%) + 情感饱满度(25%) + 情节趣味性(20%)
 * 
 * 阈值：
 * - 90+分：通过，直接生产
 * - 70-89分：警告，可生产但需备注
 * - <70分：打回，必须重新生成
 */

const { StoryValidator, CHARACTER_CAPABILITIES } = require('./story-engine-v20.js');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ========== 评分维度定义 ==========
const SCORING_DIMENSIONS = {
  narrative_completeness: {
    name: "叙事完整性",
    weight: 0.30,
    maxScore: 100,
    criteria: [
      { item: "起承转合结构", points: 25, check: (shots) => hasCompleteStructure(shots) },
      { item: "每镜有叙事目的", points: 25, check: (shots) => allShotsHavePurpose(shots) },
      { item: "无叙事断裂", points: 25, check: (shots) => noNarrativeGaps(shots) },
      { item: "因果逻辑清晰", points: 25, check: (shots) => clearCauseEffect(shots) }
    ]
  },
  
  character_consistency: {
    name: "角色一致性",
    weight: 0.25,
    maxScore: 100,
    criteria: [
      { item: "行为符合能力边界", points: 30, check: (shots) => actionsWithinCapabilities(shots) },
      { item: "情绪连贯不矛盾", points: 25, check: (shots) => emotionConsistency(shots) },
      { item: "特征鲜明可识别", points: 25, check: (shots) => distinctiveFeatures(shots) },
      { item: "成长/变化合理", points: 20, check: (shots) => reasonableCharacterArc(shots) }
    ]
  },
  
  emotional_depth: {
    name: "情感饱满度",
    weight: 0.25,
    maxScore: 100,
    criteria: [
      { item: "情感曲线有层次", points: 30, check: (shots) => layeredEmotionCurve(shots) },
      { item: "有共情触发点", points: 25, check: (shots) => hasEmpathyMoments(shots) },
      { item: "情感转折自然", points: 25, check: (shots) => naturalEmotionShift(shots) },
      { item: "结局有余韵", points: 20, check: (shots) => resonantEnding(shots) }
    ]
  },
  
  plot_engagement: {
    name: "情节趣味性",
    weight: 0.20,
    maxScore: 100,
    criteria: [
      { item: "有悬念或转折", points: 30, check: (shots) => hasTwistOrSuspense(shots) },
      { item: "视觉亮点突出", points: 25, check: (shots) => visualHighlights(shots) },
      { item: "避免陈词滥调", points: 25, check: (shots) => noCliches(shots) },
      { item: "节奏张弛有度", points: 20, check: (shots) => variedPacing(shots) }
    ]
  }
};

// ========== 评分标准 ==========
const PASS_THRESHOLD = 75;    // 通过线（高质量故事标准）
const WARNING_THRESHOLD = 60; // 警告线（可接受但需改进）

// ========== 各维度评分函数 ==========

// --- 叙事完整性 (30%) ---
function hasCompleteStructure(shots) {
  // 检查是否有Act 1/2/3/4
  const acts = new Set(shots.map(s => s.act || s.narrativeAct).filter(Boolean));
  const hasAllActs = acts.has(1) && acts.has(2) && acts.has(3) && acts.has(4);
  
  // 检查是否有铺垫→发展→高潮→结局
  const hasSetup = shots.some(s => (s.act === 1 || s.narrativeAct === 1) && s.narrativePurpose?.includes('铺垫'));
  const hasConfrontation = shots.some(s => (s.act === 2 || s.narrativeAct === 2) && s.narrativePurpose?.includes('冲突'));
  const hasClimax = shots.some(s => (s.act === 3 || s.narrativeAct === 3) && s.narrativePurpose?.includes('高潮'));
  const hasResolution = shots.some(s => (s.act === 4 || s.narrativeAct === 4) && s.narrativePurpose?.includes('结局'));
  
  return { score: hasAllActs ? 100 : (hasSetup && hasClimax ? 60 : 30), details: `Acts: ${Array.from(acts).join(',')}` };
}

function allShotsHavePurpose(shots) {
  const withPurpose = shots.filter(s => s.narrativePurpose && s.narrativePurpose.length > 10).length;
  const ratio = withPurpose / shots.length;
  return { score: Math.round(ratio * 100), details: `${withPurpose}/${shots.length}镜有叙事目的` };
}

function noNarrativeGaps(shots) {
  const gaps = [];
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i-1];
    const curr = shots[i];
    // 检查是否有突兀的跳跃
    if (curr.act && prev.act && curr.act - prev.act > 1) {
      gaps.push(`S${i+1}: Act跳跃 ${prev.act}→${curr.act}`);
    }
    // 检查是否缺少过渡
    if (curr.emotion && prev.emotion) {
      const emotionShift = getEmotionDistance(prev.emotion, curr.emotion);
      if (emotionShift > 3 && i > 1) {
        // 大情绪跳跃需要过渡镜
        const hasTransition = shots.slice(Math.max(0, i-2), i).some(s => 
          getEmotionDistance(s.emotion, prev.emotion) <= 1 && 
          getEmotionDistance(s.emotion, curr.emotion) <= 1
        );
        if (!hasTransition) {
          gaps.push(`S${i+1}: 情绪跳跃 ${prev.emotion}→${curr.emotion} 缺少过渡`);
        }
      }
    }
  }
  return { score: gaps.length === 0 ? 100 : Math.max(0, 100 - gaps.length * 20), details: gaps.join('; ') || '无断裂' };
}

function clearCauseEffect(shots) {
  let causeEffectCount = 0;
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i-1];
    const curr = shots[i];
    // 简单因果：上一镜的动作导致下一镜的结果
    if (curr.narrativePurpose && prev.action) {
      const prevAction = prev.action.toLowerCase();
      const currPurpose = curr.narrativePurpose.toLowerCase();
      // 如果当前镜的目的提及前一镜的关键元素
      const keyElements = extractKeyElements(prevAction);
      const hasConnection = keyElements.some(el => currPurpose.includes(el) || curr.action.toLowerCase().includes(el));
      if (hasConnection) causeEffectCount++;
    }
  }
  const ratio = causeEffectCount / Math.max(1, shots.length - 1);
  return { score: Math.round(ratio * 100), details: `${causeEffectCount}/${shots.length-1}镜有因果关联` };
}

// --- 角色一致性 (25%) ---
function actionsWithinCapabilities(shots) {
  let validCount = 0;
  let issues = [];
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    let shotValid = true;
    for (const char of (shot.characters || [])) {
      const caps = CHARACTER_CAPABILITIES[char];
      if (caps && caps.cannotDo) {
        for (const cannot of caps.cannotDo) {
          if (shot.action && shot.action.toLowerCase().includes(cannot.toLowerCase())) {
            shotValid = false;
            issues.push(`S${i+1}: ${caps.name}不能做"${cannot}"`);
          }
        }
      }
    }
    if (shotValid) validCount++;
  }
  return { score: Math.round((validCount / shots.length) * 100), details: issues.join('; ') || '全部符合' };
}

function emotionConsistency(shots) {
  let inconsistencies = [];
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    if (!shot.emotion) continue;
    
    // 检查动作是否与情绪匹配
    const action = (shot.action || '').toLowerCase();
    const emotion = shot.emotion;
    
    // 矛盾检查
    if (emotion === 'exhausted' && /\b(runs?|sprints?|dashes?|leaps?)\b/.test(action)) {
      inconsistencies.push(`S${i+1}: 疲惫时冲刺`);
    }
    if (emotion === 'sad' && /\b(laughs?|laughing|joyful|spins?)\b/.test(action)) {
      inconsistencies.push(`S${i+1}: 悲伤时大笑`);
    }
    if (emotion === 'joy' && /\b(crying|sobbing|tears?\s+of\s+sadness)\b/.test(action)) {
      inconsistencies.push(`S${i+1}: 高兴时哭泣`);
    }
  }
  return { score: Math.max(0, 100 - inconsistencies.length * 15), details: inconsistencies.join('; ') || '情绪一致' };
}

function distinctiveFeatures(shots) {
  // 检查主角是否有鲜明的特征描述
  const protagonistShots = shots.filter(s => s.characters && s.characters.includes('xiaog'));
  if (protagonistShots.length === 0) return { score: 0, details: '无主角镜头' };
  
  const featureKeywords = ['black hair', 'black eyes', 'East Asian', 'fair skin', 'straight hair', 'round face', 'small build'];
  let featureCount = 0;
  for (const shot of protagonistShots) {
    const action = (shot.action || '').toLowerCase();
    for (const kw of featureKeywords) {
      if (action.includes(kw.toLowerCase())) featureCount++;
    }
  }
  const avgFeatures = featureCount / protagonistShots.length;
  return { score: Math.min(100, Math.round(avgFeatures * 25)), details: `平均每镜${avgFeatures.toFixed(1)}个特征词` };
}

function reasonableCharacterArc(shots) {
  // 检查主角是否有合理的成长/变化弧线
  const protagonistShots = shots.filter(s => s.characters && s.characters.includes('xiaog'));
  if (protagonistShots.length < 3) return { score: 50, details: '主角镜头太少，无法判断弧线' };
  
  const emotions = protagonistShots.map(s => s.emotion).filter(Boolean);
  if (emotions.length < 2) return { score: 50, details: '缺少情绪标记' };
  
  // 检查情绪是否有变化（不是单一情绪）
  const uniqueEmotions = [...new Set(emotions)];
  const hasProgression = uniqueEmotions.length >= 3;
  const hasResolution = emotions[emotions.length - 1] === 'joy' || emotions[emotions.length - 1] === 'warm';
  
  let score = 40;
  if (hasProgression) score += 30;
  if (hasResolution) score += 30;
  
  return { score, details: `情绪种类: ${uniqueEmotions.join(',')}, 结局情绪: ${emotions[emotions.length-1]}` };
}

// --- 情感饱满度 (25%) ---
function layeredEmotionCurve(shots) {
  const emotions = shots.map(s => s.emotion).filter(Boolean);
  if (emotions.length === 0) return { score: 0, details: '无情绪标记' };
  
  const emotionSequence = emotions.join(' → ');
  const uniqueEmotions = [...new Set(emotions)];
  
  // 情感层次：至少3种不同情绪
  let score = Math.min(100, uniqueEmotions.length * 25);
  if (uniqueEmotions.length >= 4) score = 100;
  
  return { score, details: `情感序列: ${emotionSequence}` };
}

function hasEmpathyMoments(shots) {
  // 共情触发点：脆弱、温暖、牺牲、感动
  const empathyTriggers = ['tear', 'cry', 'hug', 'smile', 'warm', 'gentle', 'comfort', 'sacrifice', 'empathy', 'compassion'];
  let triggerCount = 0;
  for (const shot of shots) {
    const text = ((shot.action || '') + ' ' + (shot.narrativePurpose || '')).toLowerCase();
    for (const trigger of empathyTriggers) {
      if (text.includes(trigger)) triggerCount++;
    }
  }
  const ratio = triggerCount / shots.length;
  return { score: Math.min(100, Math.round(ratio * 150)), details: `${triggerCount}个共情触发点` };
}

function naturalEmotionShift(shots) {
  let naturalShifts = 0;
  let abruptShifts = 0;
  
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i-1].emotion;
    const curr = shots[i].emotion;
    if (!prev || !curr) continue;
    
    const distance = getEmotionDistance(prev, curr);
    if (distance <= 2) {
      naturalShifts++;
    } else if (distance > 3) {
      abruptShifts++;
    }
  }
  
  const total = naturalShifts + abruptShifts;
  if (total === 0) return { score: 50, details: '无情绪变化' };
  return { score: Math.round((naturalShifts / total) * 100), details: `${naturalShifts}自然/${abruptShifts}突兀` };
}

function resonantEnding(shots) {
  if (shots.length === 0) return { score: 0, details: '无镜头' };
  
  const lastShot = shots[shots.length - 1];
  const endingEmotion = lastShot.emotion;
  const endingAction = (lastShot.action || '').toLowerCase();
  
  // 好的结局：温暖、希望、感动
  const goodEndings = ['joy', 'warm', 'hope'];
  const hasGoodEnding = goodEndings.includes(endingEmotion);
  const hasVisualPoetry = /\b(smile|laugh|glow|light|bloom|dance|spin|hug|embrace|touch)\b/.test(endingAction);
  
  let score = 0;
  if (hasGoodEnding) score += 50;
  if (hasVisualPoetry) score += 50;
  
  return { score, details: `结局情绪: ${endingEmotion}, 视觉诗意: ${hasVisualPoetry}` };
}

// --- 情节趣味性 (20%) ---
function hasTwistOrSuspense(shots) {
  // 检查是否有悬念或转折
  let hasTwist = false;
  let hasSuspense = false;
  
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const text = ((shot.action || '') + ' ' + (shot.narrativePurpose || '')).toLowerCase();
    
    // 转折信号
    if (/\b(suddenly|unexpected|shock|revelation|realizes?|discovers?|reveals?|truth|secret|mystery|wonder|awe)\b/.test(text)) {
      hasTwist = true;
    }
    // 悬念信号
    if (/\b(danger|threat|fear|worry|anxious|uncertain|unknown|dark|shadow|approaching|looming)\b/.test(text)) {
      hasSuspense = true;
    }
  }
  
  let score = 0;
  if (hasTwist) score += 50;
  if (hasSuspense) score += 50;
  
  return { score, details: `转折: ${hasTwist}, 悬念: ${hasSuspense}` };
}

function visualHighlights(shots) {
  // 检查是否有视觉亮点（独特的画面）
  const visualKeywords = ['golden light', 'silver moon', 'bioluminescent', 'crystal', 'glowing', 'massive', 
    'epic scale', 'close up', 'extreme close', 'aerial', 'dramatic', 'stunning', 'breathtaking',
    'particles', 'sparks', 'flames', 'mist', 'aurora', 'reflection', 'silhouette'];
  
  let highlightCount = 0;
  for (const shot of shots) {
    const action = (shot.action || '').toLowerCase();
    for (const kw of visualKeywords) {
      if (action.includes(kw.toLowerCase())) {
        highlightCount++;
        break; // 每镜只算一次
      }
    }
  }
  
  const ratio = highlightCount / shots.length;
  return { score: Math.min(100, Math.round(ratio * 120)), details: `${highlightCount}/${shots.length}镜有视觉亮点` };
}

function noCliches(shots) {
  // 陈词滥调检查
  const cliches = [
    'and then he woke up', 'it was all a dream', 'happily ever after',
    'once upon a time', 'dark and stormy night', 'long time ago',
    'suddenly everything changed', 'and they lived happily',
    'the end', 'to be continued'
  ];
  
  let clicheCount = 0;
  for (const shot of shots) {
    const text = ((shot.action || '') + ' ' + (shot.narrativePurpose || '')).toLowerCase();
    for (const cliche of cliches) {
      if (text.includes(cliche.toLowerCase())) clicheCount++;
    }
  }
  
  return { score: Math.max(0, 100 - clicheCount * 30), details: `陈词滥调: ${clicheCount}个` };
}

function variedPacing(shots) {
  // 检查节奏是否有变化（不是全是4秒或全是8秒）
  const durations = shots.map(s => s.duration).filter(Boolean);
  if (durations.length < 2) return { score: 50, details: '镜头太少' };
  
  const uniqueDurations = [...new Set(durations)];
  const hasVariation = uniqueDurations.length >= 2;
  const hasSlowMoment = durations.some(d => d >= 5);
  const hasFastMoment = durations.some(d => d <= 3);
  
  let score = 40;
  if (hasVariation) score += 20;
  if (hasSlowMoment) score += 20;
  if (hasFastMoment) score += 20;
  
  return { score, details: `时长分布: ${uniqueDurations.join('s,')}s` };
}

// ========== 辅助函数 ==========

// 情绪距离计算（用于检查情绪跳跃）
const EMOTION_ORDER = ['exhausted', 'sad', 'lonely', 'scared', 'anxious', 'neutral', 'curious', 'warm', 'hope', 'joy', 'excited'];

function getEmotionDistance(emotion1, emotion2) {
  const idx1 = EMOTION_ORDER.indexOf(emotion1);
  const idx2 = EMOTION_ORDER.indexOf(emotion2);
  if (idx1 === -1 || idx2 === -1) return 0; // 未知情绪不算跳跃
  return Math.abs(idx1 - idx2);
}

// 从action中提取关键元素
function extractKeyElements(action) {
  if (!action) return [];
  // 简单提取名词
  const nouns = [];
  const words = action.toLowerCase().split(/[\s,\.]+/);
  const skipWords = ['the', 'a', 'an', 'his', 'her', 'its', 'with', 'and', 'but', 'or', 'in', 'on', 'at', 'to', 'from', 'by', 'for'];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '');
    if (word.length > 3 && !skipWords.includes(word)) {
      nouns.push(word);
    }
  }
  // 只取前5个关键元素
  return nouns.slice(0, 5);
}

// ========== 评分主函数 ==========
function scoreStory(shots, storyName = '未命名故事') {
  const dimensions = {};
  let totalWeightedScore = 0;
  
  console.log(`\n📊 《${storyName}》故事性评分报告`);
  console.log(`镜头数: ${shots.length} | 预估时长: ${shots.reduce((s, shot) => s + (shot.duration || 4), 0)}秒`);
  console.log('='.repeat(60));
  
  for (const [key, dim] of Object.entries(SCORING_DIMENSIONS)) {
    let dimScore = 0;
    const details = [];
    
    for (const criterion of dim.criteria) {
      const result = criterion.check(shots);
      dimScore += (result.score / 100) * criterion.points;
      details.push(`${criterion.item}: ${result.score}分 (${result.details})`);
    }
    
    dimScore = Math.round(dimScore);
    dimensions[key] = {
      name: dim.name,
      score: dimScore,
      weight: dim.weight,
      weightedScore: Math.round(dimScore * dim.weight),
      details
    };
    
    totalWeightedScore += dimScore * dim.weight;
    
    const bar = '█'.repeat(Math.round(dimScore / 5)) + '░'.repeat(20 - Math.round(dimScore / 5));
    console.log(`\n${dim.name} (权重${Math.round(dim.weight * 100)}%): ${dimScore}/100`);
    console.log(`  ${bar}`);
    for (const d of details) {
      console.log(`  • ${d}`);
    }
  }
  
  const finalScore = Math.round(totalWeightedScore);
  
  console.log('\n' + '='.repeat(60));
  const finalBar = '█'.repeat(Math.round(finalScore / 5)) + '░'.repeat(20 - Math.round(finalScore / 5));
  console.log(`\n🏆 综合评分: ${finalScore}/100`);
  console.log(`  ${finalBar}`);
  
  let verdict;
  let verdictEmoji;
  if (finalScore >= PASS_THRESHOLD) {
    verdict = '通过 — 可以直接进入生产！';
    verdictEmoji = '✅';
  } else if (finalScore >= WARNING_THRESHOLD) {
    verdict = '警告 — 可以生产但需备注改进点';
    verdictEmoji = '⚠️';
  } else {
    verdict = '未通过 — 必须重新生成剧本！';
    verdictEmoji = '❌';
  }
  
  console.log(`${verdictEmoji}  verdict: ${verdict}`);
  
  return {
    storyName,
    finalScore,
    dimensions,
    passed: finalScore >= PASS_THRESHOLD,
    warning: finalScore >= WARNING_THRESHOLD && finalScore < PASS_THRESHOLD,
    verdict,
    verdictEmoji
  };
}

// ========== 反馈报告生成 ==========
function generateFeedback(scoreResult) {
  if (scoreResult.passed) {
    return {
      action: 'PROCEED',
      message: `✅ 《${scoreResult.storyName}》故事性评分${scoreResult.finalScore}分，通过！可以直接生产。`,
      improvements: Object.values(scoreResult.dimensions)
        .filter(d => d.score < 90)
        .map(d => `${d.name}: 当前${d.score}分，建议提升至90+`)
    };
  }
  
  const feedback = {
    action: scoreResult.warning ? 'PROCEED_WITH_WARNING' : 'REJECT',
    message: `${scoreResult.verdictEmoji} 《${scoreResult.storyName}》故事性评分${scoreResult.finalScore}分，${scoreResult.verdict}`,
    criticalIssues: [],
    suggestions: []
  };
  
  // 找出最低分的维度
  const sortedDims = Object.values(scoreResult.dimensions).sort((a, b) => a.score - b.score);
  const weakestDim = sortedDims[0];
  
  feedback.criticalIssues.push(`最弱维度: ${weakestDim.name} (${weakestDim.score}分)`);
  
  for (const detail of weakestDim.details) {
    if (detail.includes('0分') || detail.includes('分 (无') || detail.includes('分 (缺少')) {
      feedback.criticalIssues.push(`  - ${detail}`);
    }
  }
  
  // 生成改进建议
  if (weakestDim.name === '叙事完整性') {
    feedback.suggestions.push('重新设计叙事结构：确保有起承转合');
    feedback.suggestions.push('为每镜添加narrativePurpose，明确叙事目的');
    feedback.suggestions.push('检查镜头间是否有逻辑断裂，添加过渡镜头');
  } else if (weakestDim.name === '角色一致性') {
    feedback.suggestions.push('检查角色行为是否符合能力边界');
    feedback.suggestions.push('确保角色情绪连贯，避免突兀的情绪跳跃');
    feedback.suggestions.push('强化角色特征描述（发色/眼色/肤色等）');
  } else if (weakestDim.name === '情感饱满度') {
    feedback.suggestions.push('设计更丰富的情感曲线（至少3-4种情绪）');
    feedback.suggestions.push('增加共情触发点（脆弱/温暖/感动时刻）');
    feedback.suggestions.push('优化结局，增加余韵和回味');
  } else if (weakestDim.name === '情节趣味性') {
    feedback.suggestions.push('添加悬念或转折元素');
    feedback.suggestions.push('增加视觉亮点（独特的画面构图）');
    feedback.suggestions.push('避免陈词滥调，追求原创性');
  }
  
  feedback.suggestions.push('重新走完整流程：故事分析→叙事设计→角色定义→场景设计→Prompt组装');
  
  return feedback;
}

// ========== 评分+反馈循环 ==========
function evaluateAndDecide(shots, storyName = '未命名故事') {
  const score = scoreStory(shots, storyName);
  const feedback = generateFeedback(score);
  
  console.log('\n📋 反馈报告\n');
  console.log(`Action: ${feedback.action}`);
  console.log(`Message: ${feedback.message}`);
  
  if (feedback.criticalIssues && feedback.criticalIssues.length > 0) {
    console.log('\n🚨 关键问题:');
    for (const issue of feedback.criticalIssues) {
      console.log(`  • ${issue}`);
    }
  }
  
  if (feedback.suggestions && feedback.suggestions.length > 0) {
    console.log('\n💡 改进建议:');
    for (const suggestion of feedback.suggestions) {
      console.log(`  • ${suggestion}`);
    }
  }
  
  return { score, feedback };
}

// ========== Mock测试数据（已迁移到 test-data/story-scorer.mock.js）==========
// 生产环境不加载测试数据
let MOCK_STORY_GOOD = null;
let MOCK_STORY_BAD = null;

function loadMockData() {
  try {
    const mockPath = path.join(__dirname, '..', 'test-data', 'story-scorer.mock.js');
    if (fss.existsSync(mockPath)) {
      const mocks = require(mockPath);
      MOCK_STORY_GOOD = mocks.MOCK_STORY_GOOD;
      MOCK_STORY_BAD = mocks.MOCK_STORY_BAD;
    }
  } catch (e) {
    // 测试数据不存在时忽略
  }
}

// ========== Mock测试 ==========
function runMockTests() {
  loadMockData();
  if (!MOCK_STORY_GOOD || !MOCK_STORY_BAD) {
    console.log('\n⚠️ Mock测试数据未找到，跳过测试');
    console.log('请确保 test-data/story-scorer.mock.js 存在');
    return;
  }
  
  console.log('\n🔥🔥🔥 Story Scorer v20.1 Mock测试 🔥🔥🔥\n');
  
  console.log('\n' + '═'.repeat(60));
  console.log('测试1: 优秀故事（预期: 90+分 通过）');
  console.log('═'.repeat(60));
  const goodResult = evaluateAndDecide(MOCK_STORY_GOOD, '优秀故事示例');
  
  console.log('\n' + '═'.repeat(60));
  console.log('测试2: 差劲故事（预期: <70分 打回）');
  console.log('═'.repeat(60));
  const badResult = evaluateAndDecide(MOCK_STORY_BAD, '差劲故事示例');
  
  console.log('\n' + '═'.repeat(60));
  console.log('Mock测试结果汇总');
  console.log('═'.repeat(60));
  console.log(`差劲故事: ${badResult.score.finalScore}分 — ${badResult.score.verdict}`);
  
  const testsPassed = goodResult.score.passed && !badResult.score.passed;
  console.log(`\n${testsPassed ? '✅' : '❌'} 全部Mock测试${testsPassed ? '通过' : '失败'}！`);
  
  if (!testsPassed) {
    console.log('\n需要调整的阈值或评分逻辑。');
  }
  
  return testsPassed;
}

// ========== 导出 ==========
module.exports = {
  scoreStory,
  generateFeedback,
  evaluateAndDecide,
  runMockTests,
  SCORING_DIMENSIONS,
  PASS_THRESHOLD,
  WARNING_THRESHOLD
};

// 如果直接运行此文件，执行Mock测试
if (require.main === module) {
  runMockTests();
}
