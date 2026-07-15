/**
 * Beast Motion 集成适配器 v1.0-Peng
 * 桥接 Nirath Master Pipeline 与 Shanhaijing Beast Motion 子系统
 * 接入点: Phase4 批量渲染前，seedance-prompt 生成后
 * 
 * 功能: 为含异兽的镜头注入种族特异性动作描述
 */

const fs = require('fs');
const path = require('path');

const BEAST_PATH = path.join(__dirname, 'beast-motion.js');
const { SPECIES_COMPLEXITY, BEAST_MOTION_TEMPLATES } = require(BEAST_PATH);

// 异兽ID到物种类型的映射
const BEAST_ID_TO_SPECIES = {
  'tao-tie': 'taotie',
  'taotie': 'taotie',
  'jiuwei': 'fox',
  'jiuweihu': 'fox',
  'dijiang': 'dijiang',
  'baize': 'baize',
  'xuangui': 'xuangui',
  'yinglong': 'dragon',
  'zhulong': 'dragon',
  'zhu-long': 'dragon',
  'kunpeng': 'phoenix',
  'fenghuang': 'phoenix',
  'qilin': 'qilin',
  'zheng': 'zheng',
  'gudiao': 'gudiao',
  'jiaoren': 'jiaoren',
  'yingzhao': 'yingzhao',
  'kui': 'kui'
};

/**
 * 从镜头中提取异兽角色
 */
function extractBeastsFromShot(shot) {
  const beasts = [];
  const characters = shot.characters || [];
  
  for (const char of characters) {
    let species = BEAST_ID_TO_SPECIES[char];
    if (!species) continue;
    
    // 回退策略：如果特定物种模板不存在，使用通用 beast 模板
    if (!BEAST_MOTION_TEMPLATES[species]) {
      if (BEAST_MOTION_TEMPLATES['beast']) {
        species = 'beast';
      } else {
        continue;
      }
    }
    
    beasts.push({
      id: char,
      species: species,
      template: BEAST_MOTION_TEMPLATES[species]
    });
  }
  
  return beasts;
}

/**
 * 根据镜头类型选择动作类别
 */
function selectMotionCategory(shot) {
  const type = shot.type || '';
  const scene = (shot.scene || '').toLowerCase();
  
  // 根据镜头类型推断动作类别
  if (type.includes('fight') || type.includes('attack') || scene.includes('战')) {
    return 'attack';
  }
  if (type.includes('walk') || type.includes('run') || type.includes('move') || type.includes('locomotion')) {
    return 'locomotion';
  }
  if (type.includes('idle') || type.includes('rest') || type.includes('sleep')) {
    return 'idle';
  }
  
  // 默认根据情绪推断
  const emotion = (shot.emotionPhase || shot.emotion || '').toLowerCase();
  if (emotion.includes('anger') || emotion.includes('fear') || emotion.includes('战斗')) {
    return 'attack';
  }
  if (emotion.includes('calm') || emotion.includes('peace') || emotion.includes('serenity') || emotion.includes('rest')) {
    return 'idle';
  }
  
  // 默认返回 locomotion（最通用的）
  return 'locomotion';
}

/**
 * 从动作类别中选择具体动作
 */
function selectSpecificMotion(category, template, shot) {
  if (!template || !template[category]) return null;
  
  const motions = template[category];
  if (!motions || motions.length === 0) return null;
  
  // 根据镜头参数选择最合适的动作
  const shotSize = shot.shotSize || '';
  const duration = shot.duration || 5;
  
  // 简单策略：如果特写镜头，选择第一个（通常是最有细节的）
  // 如果全景，选择能体现尺度的
  if (shotSize.includes('extreme_wide') || shotSize.includes('wide')) {
    // 优先选择能体现尺度的动作
    const scaleMotion = motions.find(m => 
      m.description.includes('巨型') || 
      m.description.includes('大地') || 
      m.description.includes('震撼')
    );
    if (scaleMotion) return scaleMotion;
  }
  
  // 默认返回第一个
  return motions[0];
}

/**
 * 生成异兽动作增强描述
 */
function generateBeastMotionEnhancement(shot, beasts, category) {
  if (!beasts || beasts.length === 0) return null;
  
  const enhancements = [];
  
  for (const beast of beasts) {
    const motion = selectSpecificMotion(category, beast.template, shot);
    if (!motion) continue;
    
    // 获取物种复杂度
    const complexity = SPECIES_COMPLEXITY[beast.species] || 2;
    
    // 生成动作描述
    let actionDesc = motion.description;
    
    // 如果是 signature 动作（如光囊母兽的"无面表情系统"），额外注入
    if (beast.template.signature) {
      const sig = beast.template.signature;
      actionDesc += `。${sig.name}：${sig.description}`;
    }
    
    enhancements.push({
      beastId: beast.id,
      species: beast.species,
      complexity: complexity,
      category: category,
      motionName: motion.name,
      motionDescription: actionDesc,
      signature: beast.template.signature || null
    });
  }
  
  return enhancements;
}

/**
 * 将异兽动作增强合并到 Prompt
 */
function mergeBeastMotionIntoPrompt(prompt, enhancements, shot) {
  if (!enhancements || enhancements.length === 0) return prompt;
  
  // 构建异兽动作描述段落
  const beastActionTexts = enhancements.map(e => {
    return `【异兽动作】${e.beastId}执行「${e.motionName}」：${e.motionDescription}（复杂度${e.complexity}）`;
  });
  
  let beastActionBlock = beastActionTexts.join('；');
  
  // 如果存在 signature 系统，额外注入
  const signatureEnhancements = enhancements.filter(e => e.signature);
  if (signatureEnhancements.length > 0) {
    const sigTexts = signatureEnhancements.map(e => {
      const sig = e.signature;
      return `【专属特征】${sig.name}激活`;
    });
    beastActionBlock += '。' + sigTexts.join('；');
  }
  
  // 智能合并到 Prompt
  // 策略：在主体描述后追加，或在动作描述段落中替换
  if (prompt.includes('【动作】') || prompt.includes('动作：')) {
    // 如果有动作段落，追加到其后
    prompt = prompt.replace(/(【动作】[^】]*)([，。]|$)/, `$1；${beastActionBlock}$2`);
  } else {
    // 否则在主体描述后追加
    const insertPoint = prompt.indexOf('。') + 1;
    if (insertPoint > 0 && insertPoint < prompt.length) {
      prompt = prompt.slice(0, insertPoint) + beastActionBlock + '。' + prompt.slice(insertPoint);
    } else {
      prompt += ' ' + beastActionBlock + '。';
    }
  }
  
  return prompt;
}

/**
 * 增强单个镜头（主入口）
 */
function enhanceShotWithBeastMotion(shot, prompt) {
  // 提取异兽
  const beasts = extractBeastsFromShot(shot);
  if (beasts.length === 0) {
    return { enhanced: prompt, beastsFound: 0 };
  }
  
  // 选择动作类别
  const category = selectMotionCategory(shot);
  
  // 生成动作增强
  const enhancements = generateBeastMotionEnhancement(shot, beasts, category);
  if (!enhancements || enhancements.length === 0) {
    return { enhanced: prompt, beastsFound: beasts.length, category };
  }
  
  // 合并到 Prompt
  const enhancedPrompt = mergeBeastMotionIntoPrompt(prompt, enhancements, shot);
  
  return {
    enhanced: enhancedPrompt,
    beastsFound: beasts.length,
    category: category,
    enhancements: enhancements,
    addedLength: enhancedPrompt.length - prompt.length
  };
}

/**
 * 批量增强（Pipeline 调用入口）
 */
function enhanceBatchWithBeastMotion(shotsWithPrompts, logFn = console.log) {
  const log = logFn || (() => {});
  log('BeastMotion', '🐉 开始异兽动作增强...', 'phase');
  
  const results = [];
  let totalEnhanced = 0;
  let totalBeastsFound = 0;
  
  for (const item of shotsWithPrompts) {
    const { shot, prompt } = item;
    const result = enhanceShotWithBeastMotion(shot, prompt);
    
    results.push({
      shotId: shot.id,
      originalPrompt: prompt,
      enhancedPrompt: result.enhanced,
      beastsFound: result.beastsFound,
      category: result.category,
      enhancements: result.enhancements,
      addedLength: result.addedLength || 0
    });
    
    if (result.beastsFound > 0) {
      totalEnhanced++;
      totalBeastsFound += result.beastsFound;
    }
  }
  
  log('BeastMotion', `✅ 异兽动作增强完成: ${totalEnhanced}/${results.length} 个镜头已注入 | 发现 ${totalBeastsFound} 只异兽`, 'success');
  
  return results;
}

/**
 * 保存增强报告
 */
function saveBeastMotionReport(results, productionDir) {
  const reportDir = path.join(productionDir, '07-beast-motion');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, 'integration-report.json');
  const report = {
    version: '1.0-Peng',
    timestamp: new Date().toISOString(),
    totalShots: results.length,
    enhancedShots: results.filter(r => r.beastsFound > 0).length,
    totalBeasts: results.reduce((sum, r) => sum + r.beastsFound, 0),
    speciesBreakdown: {},
    shots: results.map(r => ({
      shotId: r.shotId,
      beastsFound: r.beastsFound,
      category: r.category,
      addedLength: r.addedLength,
      motions: r.enhancements?.map(e => ({
        beast: e.beastId,
        motion: e.motionName,
        complexity: e.complexity
      })) || []
    }))
  };
  
  // 统计物种分布
  for (const r of results) {
    for (const e of (r.enhancements || [])) {
      report.speciesBreakdown[e.species] = (report.speciesBreakdown[e.species] || 0) + 1;
    }
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

module.exports = {
  enhanceShotWithBeastMotion,
  enhanceBatchWithBeastMotion,
  saveBeastMotionReport,
  extractBeastsFromShot,
  selectMotionCategory,
  generateBeastMotionEnhancement,
  mergeBeastMotionIntoPrompt,
  // 导出映射供外部使用
  BEAST_ID_TO_SPECIES
};
