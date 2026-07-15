/**
 * Story Calibration Hub v20.2-Peng
 *
 * 统一校准入口 — 所有下游环节通过此文件索引PRD做校准
 *
 * 使用方式:
 * const { calibrate, getPRD } = require('./story-calibration-hub.js');
 *
 * // 校准Prompt
 * const result = calibrate.prompt(prompt, 'ZLKM', 'S01');
 *
 * // 校准角色行为
 * const result = calibrate.characterAction(action, 'ZLKM', 'xiaog', 'S01');
 *
 * // 校准情绪-动作
 * const result = calibrate.emotionAction(emotion, action, 'ZLKM', 'xiaog', 'S01');
 *
 * // 获取PRD内容
 * const prd = getPRD('ZLKM');
 */

// 动态加载PRD —— 从stories/目录读取各故事PRD
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'stories');

// 动态加载PRD
function loadPRDs() {
  const registry = {};
  try {
    const storyDirs = fss.readdirSync(STORIES_DIR).filter(d => 
      fss.statSync(path.join(STORIES_DIR, d)).isDirectory()
    );
    
    for (const dir of storyDirs) {
      const prdPath = path.join(STORIES_DIR, dir, 'story-prd.json');
      if (fss.existsSync(prdPath)) {
        const prd = JSON.parse(fss.readFileSync(prdPath, 'utf8'));
        if (prd.meta?.codename) {
          registry[prd.meta.codename] = prd;
          // 同时注册标题作为别名
          if (prd.meta.title) {
            registry[prd.meta.title] = prd;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[CalibrationHub] 无法加载PRD:', e.message);
  }
  return registry;
}

// PRD注册表（懒加载）
let PRD_REGISTRY = null;

function getRegistry() {
  if (!PRD_REGISTRY) {
    PRD_REGISTRY = loadPRDs();
  }
  return PRD_REGISTRY;
}

function reloadPRDs() {
  PRD_REGISTRY = loadPRDs();
  return PRD_REGISTRY;
}

/**
 * 获取指定主题的PRD
 * @param {string} codename - 主题代号 (ZLKM/KFRZ)
 * @returns {Object} PRD文档
 */
function getPRD(codename) {
  const registry = getRegistry();
  const prd = registry[codename];
  if (!prd) {
    throw new Error(`未知主题代号: ${codename}. 可用: ${Object.keys(registry).join(', ')}`);
  }
  return prd;
}

/**
 * 列出所有可用主题
 * @returns {Array} 主题列表
 */
function listTopics() {
  const registry = getRegistry();
  return Object.entries(registry).map(([code, prd]) => ({
    code,
    title: prd.meta?.title || '未知',
    version: prd.meta?.version || '未知'
  }));
}

/**
 * 统一校准接口
 */
const calibrate = {
  /**
   * 校准Prompt
   * @param {string} prompt - Prompt文本
   * @param {string} codename - 主题代号
   * @param {string} shotId - 镜头ID
   * @returns {Object} 校准结果
   */
  prompt(prompt, codename, shotId = 'unknown') {
    const prd = getPRD(codename);
    // PRD现在为JSON格式，校准逻辑内联
    return calibratePromptJSON(prd, prompt, shotId);
  },

  /**
   * 校准角色行为
   * @param {string} action - 动作描述
   * @param {string} codename - 主题代号
   * @param {string} characterKey - 角色代号 (xiaog/zhulong/kuafoo)
   * @param {string} shotId - 镜头ID
   * @returns {Object} 校准结果
   */
  characterAction(action, codename, characterKey, shotId = 'unknown') {
    const prd = getPRD(codename);
    return calibrateCharacterActionJSON(prd, action, characterKey, shotId);
  },

  /**
   * 校准情绪-动作匹配
   * @param {string} emotion - 情绪
   * @param {string} action - 动作
   * @param {string} codename - 主题代号
   * @param {string} characterKey - 角色代号
   * @param {string} shotId - 镜头ID
   * @returns {Object} 校准结果
   */
  emotionAction(emotion, action, codename, characterKey, shotId = 'unknown') {
    const prd = getPRD(codename);
    return calibrateEmotionActionJSON(prd, emotion, action, characterKey, shotId);
  },

  /**
   * 校准世界观
   * @param {string} sceneDescription - 场景描述
   * @param {string} codename - 主题代号
   * @param {string} shotId - 镜头ID
   * @returns {Object} 校准结果
   */
  world(sceneDescription, codename, shotId = 'unknown') {
    const prd = getPRD(codename);
    return calibrateWorldJSON(prd, sceneDescription, shotId);
  },

  /**
   * 批量校准多个Prompt
   * @param {Array} prompts - [{prompt, shotId}]
   * @param {string} codename - 主题代号
   * @returns {Object} 批量校准报告
   */
  batch(prompts, codename) {
    const prd = getPRD(codename);
    const results = [];
    for (const { prompt, shotId } of prompts) {
      results.push(calibratePromptJSON(prd, prompt, shotId));
    }
    return generateCalibrationReport(results);
  }
};

// ========== JSON PRD 校准函数 ==========

function calibratePromptJSON(prd, prompt, shotId) {
  const deviations = [];
  const forbidden = prd.forbidden || [];
  
  // 检查禁止项
  for (const item of forbidden) {
    if (prompt.toLowerCase().includes(item.toLowerCase())) {
      deviations.push(`❌ 禁止项: "${item}"`);
    }
  }
  
  // 检查世界观偏离
  const worldRules = prd.world?.visualRules || [];
  for (const rule of worldRules) {
    if (!prompt.includes(rule)) {
      deviations.push(`⚠️ 世界观缺失: "${rule}"`);
    }
  }
  
  return {
    passed: deviations.length === 0,
    deviations,
    shotId,
    prdTitle: prd.meta?.title
  };
}

function calibrateCharacterActionJSON(prd, action, characterKey, shotId) {
  const character = prd.characters?.[characterKey];
  if (!character) {
    return { passed: true, deviations: [], shotId };
  }
  
  const deviations = [];
  const capabilities = character.capabilities || [];
  
  // 简单检查：动作是否包含不可能的能力
  const impossibleTerms = ['flying', 'magic', 'teleport', 'shapeshift'];
  for (const term of impossibleTerms) {
    if (action.toLowerCase().includes(term) && !capabilities.includes(term)) {
      deviations.push(`❌ 角色能力偏离: "${characterKey}" 不应 "${term}"`);
    }
  }
  
  return { passed: deviations.length === 0, deviations, shotId };
}

function calibrateEmotionActionJSON(prd, emotion, action, characterKey, shotId) {
  const character = prd.characters?.[characterKey];
  const deviations = [];
  
  // 检查情绪-动作匹配
  const emotionActions = prd.core?.emotionalArc || [];
  
  // 简单矛盾检测
  const contradictions = {
    'joy': ['crying', 'screaming', 'huddles', 'fear'],
    'sad': ['laughing', 'celebrating', 'dancing'],
    'exhausted': ['sprints', 'running fast', 'jumping']
  };
  
  const badTerms = contradictions[emotion] || [];
  for (const term of badTerms) {
    if (action.toLowerCase().includes(term.toLowerCase())) {
      deviations.push(`❌ 情绪-动作矛盾: "${emotion}" 时不应 "${term}"`);
    }
  }
  
  return { passed: deviations.length === 0, deviations, shotId };
}

function calibrateWorldJSON(prd, sceneDescription, shotId) {
  const deviations = [];
  const forbiddenElements = prd.world?.forbiddenCulturalElements || [];
  
  for (const elem of forbiddenElements) {
    if (sceneDescription.includes(elem)) {
      deviations.push(`❌ 世界观禁止元素: "${elem}"`);
    }
  }
  
  return { passed: deviations.length === 0, deviations, shotId };
}

function generateCalibrationReport(results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  
  return {
    total,
    passed,
    failed,
    passRate: Math.round((passed / total) * 100),
    details: results
  };
}
module.exports = {
  calibrate,
  getPRD,
  listTopics,
  reloadPRDs,
  getRegistry
};

// 如果直接运行，执行初始化检查
if (require.main === module) {
  console.log('🔥 Story Calibration Hub v20.2-Peng\n');

  // 列出可用主题
  console.log('📚 可用主题:');
  const topics = listTopics();
  if (topics.length === 0) {
    console.log('  ⚠️ 未找到任何故事PRD');
    console.log('  请在 stories/目录下创建 story-prd.json 文件');
  } else {
    for (const topic of topics) {
      console.log(`  ${topic.code} — 《${topic.title}》${topic.version}`);
    }
  }
  
  console.log('\n✅ 校准枢纽初始化完成（动态加载模式）');
}
