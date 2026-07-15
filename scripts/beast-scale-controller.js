/**
 * 异兽尺寸比例控制系统 v1.0
 * 根据异兽档案中的尺寸数据，自动调整Prompt中的人物比例描述
 */

const fs = require('fs');
const path = require('path');

// 人类角色参考高度（米） - AgentX为8岁男孩，身高1.2米
const HUMAN_HEIGHT = 1.2;

/**
 * 读取异兽档案
 * 支持新格式：systems/beast-database/beasts/{beastId}.json
 */
function loadBeastArchive(beastId) {
  try {
    const beastPath = path.join(__dirname, '..', 'systems', 'beast-database', 'beasts', `${beastId}.json`);
    if (!fs.existsSync(beastPath)) {
      console.warn(`⚠️ 异兽档案不存在: ${beastPath}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(beastPath, 'utf8'));
  } catch (e) {
    console.warn('⚠️ 无法加载异兽档案:', e.message);
    return null;
  }
}

/**
 * 获取异兽身高（米）
 * @param {object} beastData - 异兽档案数据
 * @returns {number} 身高（米）
 */
function getBeastHeight(beastData) {
  if (!beastData) return 20;
  
  // 优先从visualIdentity.scale解析
  const scale = beastData.visualIdentity?.scale || '';
  const heightMatch = scale.match(/身长\s*(\d+(?:\.\d+)?)\s*米/);
  if (heightMatch) return parseFloat(heightMatch[1]);
  
  // 备选：从bodyPlan解析
  const bodyPlan = beastData.visualIdentity?.bodyPlan || '';
  const bodyMatch = bodyPlan.match(/身长约?\s*(\d+(?:\.\d+)?)\s*米/);
  if (bodyMatch) return parseFloat(bodyMatch[1]);
  
  return 20; // 默认值
}

/**
 * 计算尺寸比例
 * @param {number} beastHeight - 异兽身高（米）
 * @returns {number} 比例倍数
 */
function calculateSizeRatio(beastHeight) {
  return beastHeight / HUMAN_HEIGHT;
}

/**
 * 根据景别生成尺寸描述
 * @param {string} beastId - 异兽ID
 * @param {string} shotSize - 景别：wide/medium/closeup
 * @param {number} beastHeight - 异兽身高（米）
 * @returns {string} 尺寸描述文本
 */
function generateSizeDescription(beastId, shotSize, beastHeight) {
  const beastName = beastId === 'jiu-wei-hu' ? '九尾狐' : beastId;
  const ratio = calculateSizeRatio(beastHeight);
  
  const descriptions = {
    wide: [
      `【巨物感】${beastName}身长达${beastHeight}米，AgentX在其脚下如昆虫般渺小，`,
      `【尺度对比】20层楼房高的${beastName}全貌，AgentX站在其脚趾旁仰望，`,
      `【全景震撼】${beastName}占据画面80%，AgentX仅在画面边缘如黑点般存在，`
    ],
    medium: [
      `【局部特写】${beastName}一只琥珀色眼睛占据画面40%，瞳孔中倒映着AgentX的身影（如人眼中的蚂蚁），`,
      `【中景对比】${beastName}的前爪特写，爪垫纹理清晰如岩石，AgentX站在爪尖旁（仅爪尖的1/5大小），`,
      `【半身震撼】${beastName}上半身特写，银色毛发如瀑布般垂落，AgentX在毛发间穿行（如人在森林中），`
    ],
    closeup: [
      `【人物主导】AgentX面部坚毅表情特写，背景虚化中${beastName}的巨大尾巴如山脉般横亘，`,
      `【渺小感】AgentX半身特写，身后${beastName}的脚趾如山丘般巨大（仅展示脚趾局部），`,
      `【压迫感】AgentX面部汗水特写，背景中${beastName}的一只眼睛缓缓睁开（占背景60%），`
    ]
  };
  
  // 根据比例选择描述强度
  const templates = descriptions[shotSize] || descriptions.medium;
  
  if (ratio > 50) {
    // 超巨型（如烛龙100米+）
    return templates[0];
  } else if (ratio > 10) {
    // 巨型（如九尾狐20米）
    return templates[1];
  } else {
    // 大型（如凤凰5米）
    return templates[2];
  }
}

/**
 * 根据故事板场景推荐景别
 * @param {string} scene - 场景描述
 * @param {number} tension - 紧张度
 * @returns {string} 推荐景别
 */
function recommendShotSize(scene, tension = 0.5) {
  const sceneLower = scene.toLowerCase();
  
  // 根据场景关键词判断
  if (sceneLower.includes('全貌') || sceneLower.includes('全景') || 
      sceneLower.includes('远景') || tension < 0.3) {
    return 'wide';
  }
  
  if (sceneLower.includes('特写') || sceneLower.includes('面部') || 
      sceneLower.includes('表情') || tension > 0.8) {
    return 'closeup';
  }
  
  return 'medium';
}

/**
 * 主函数：为指定镜头生成比例增强的Prompt片段
 * @param {string} beastId - 异兽ID
 * @param {object} shot - 镜头数据
 * @returns {object} 比例描述结果
 */
function generateScalePrompt(beastId, shot) {
  const beastData = loadBeastArchive(beastId);
  
  if (!beastData) {
    console.warn(`⚠️ 异兽档案中未找到: ${beastId}`);
    return null;
  }
  
  const beastHeight = getBeastHeight(beastData);
  const shotSize = recommendShotSize(shot.scene || '', shot.tension || 0.5);
  const scaleDesc = generateSizeDescription(beastId, shotSize, beastHeight);
  
  return {
    shotSize,
    scaleDescription: scaleDesc,
    beastHeight,
    humanHeight: HUMAN_HEIGHT,
    ratio: calculateSizeRatio(beastHeight)
  };
}

module.exports = {
  generateScalePrompt,
  calculateSizeRatio,
  recommendShotSize,
  generateSizeDescription,
  getBeastHeight,
  loadBeastArchive,
  HUMAN_HEIGHT
};

// 测试
if (require.main === module) {
  const testShot = {
    scene: '青丘群岛·核心区域',
    tension: 0.8,
    narration: '九尾狐不再隐藏'
  };
  
  const result = generateScalePrompt('jiu-wei-hu', testShot);
  if (result) {
    console.log('🐉 异兽尺寸比例控制系统测试');
    console.log('异兽: 九尾狐');
    console.log(`身高: ${result.beastHeight}米`);
    console.log(`人类: ${result.humanHeight}米`);
    console.log(`比例: ${result.ratio.toFixed(1)}倍`);
    console.log(`推荐景别: ${result.shotSize}`);
    console.log('比例描述:', result.scaleDescription);
  } else {
    console.log('❌ 测试失败：无法加载异兽档案');
  }
}
