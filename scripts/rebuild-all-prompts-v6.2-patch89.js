/**
 * 重新构建所有镜头 Prompt（v6.2-patch89-旁白归零）
 * 系统级约束：NO_VOICEOVER = true
 * 所有叙事必须通过角色台词（Dialogue）直接表达，禁止旁白
 */

const fs = require('fs');
const { PromptBuilder } = require('../systems/prompt-builder');
const { DialogueDistributor } = require('../systems/dialogue-distributor');

// 读取 enriched prompts
const promptsPath = '../output/taotie-ep01-prompts-full.json';
const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));

// 读取原始预生产数据（获取角色 appearance 信息）
const preprodPath = '../output/taotie-ep01-preproduction-2026-05-31T13-15-33-118Z.json';
const preprodData = JSON.parse(fs.readFileSync(preprodPath, 'utf8'));
const preprodCharacters = preprodData.stages.prd?.characters || {};

// 读取角色档案
const characters = promptsData.characters;

// 初始化构建器
const promptBuilder = new PromptBuilder({ mode: 'nirath', maxLength: 980, targetLength: 950 });
const dialogueDistributor = new DialogueDistributor();

console.log('🎬 重新构建所有镜头 Prompt（v6.2-patch89-旁白归零）\n');
console.log('⚠️ 底层约束：NO_VOICEOVER = true，禁止旁白，全部转为角色台词\n');

for (const shot of promptsData.prompts) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`🎬 ${shot.shotId}: ${shot.scene}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  
  // 1. 重新构建角色描述（保留文字锚点）
  const charDescs = [];
  for (const charId of shot.characters || []) {
    const charData = characters[charId];
    const preprodCharData = preprodCharacters[charId];
    if (!charData && !preprodCharData) {
      console.warn(`  ⚠️ 角色 ${charId} 无档案`);
      continue;
    }
    
    let desc = charData?.name || preprodCharData?.name || charId;
    const appearance = preprodCharData?.appearance || charData?.appearance;
    if (appearance) {
      if (charId === 'tao-tie' || charId === 'taotie') {
        const taotieFeatures = [];
        if (appearance.includes('羊身')) taotieFeatures.push('羊身');
        if (appearance.includes('人面')) taotieFeatures.push('人面');
        if (appearance.includes('腋下')) taotieFeatures.push('腋下生双眼');
        if (appearance.includes('巨口')) taotieFeatures.push('巨口');
        if (appearance.includes('利齿')) taotieFeatures.push('利齿');
        if (taotieFeatures.length > 0) {
          desc += `，${taotieFeatures.join('、')}神兽，${taotieFeatures.join('，')}，肩高30米火山岩装甲覆盖，禁止蜥蜴/恐龙/爬行动物特征`;
        } else {
          desc += '，羊身人面神兽，腋下生双眼，巨口布满利齿，禁止蜥蜴/恐龙/爬行动物特征';
        }
      } else if (charId === 'xiaoG') {
        desc += '，8岁男孩，蓝色条纹睡衣，赤脚，Nirath旧世界幸存者';
      }
    }
    
    charDescs.push(desc);
    console.log(`  👤 ${charId}: ${desc} (${desc.length}字符)`);
  }
  
  // 2. 【v6.2-patch89-底层约束】台词/旁白分离（全部转为台词，无旁白）
  const distributed = dialogueDistributor.distribute({
    shotId: shot.shotId,
    narration: shot.narration || '',
    characters: shot.characters || [],
    mouthAction: shot.mouthAction || ''
  });
  
  // 旁白归零：voiceover 字段设为空字符串
  shot.voiceover = '';
  
  console.log(`  🎭 台词: ${distributed.dialogue.length} 句`);
  for (const line of distributed.dialogue) {
    console.log(`     [${line.type}] ${line.speaker}(${line.emotion}): ${line.text.substring(0, 40)}${line.text.length > 40 ? '...' : ''}`);
  }
  
  if (distributed.dialogue.length === 0) {
    console.warn(`  ⚠️ 警告：镜头 ${shot.shotId} 无台词！需检查 narration 是否为空`);
  }
  
  // 3. 验证嘴型关联
  const lipSyncValidation = dialogueDistributor.validateLipSync({
    shotId: shot.shotId,
    dialogue: distributed.dialogue,
    mouthAction: shot.mouthAction || ''
  });
  
  if (!lipSyncValidation.valid) {
    console.warn(`  ⚠️ 嘴型/台词关联警告:`);
    for (const issue of lipSyncValidation.issues) {
      console.warn(`     [${issue.severity}] ${issue.message}`);
    }
  } else {
    console.log(`  ✅ 嘴型/台词关联正确`);
  }
  
  // 4. 构建新 prompt（无旁白，只有台词）
  const buildParams = {
    sceneName: shot.scene,
    script: shot.narration, // 向后兼容
    dialogue: distributed.dialogue,
    characters: charDescs,
    type: shot.type,
    emotionPhase: shot.emotionPhase || shot.type,
    movement: shot.cameraMovement || shot.movement,
    mouthAction: shot.mouthAction
  };
  
  const result = promptBuilder.build(buildParams);
  
  console.log(`\n  📊 新Prompt: ${result.length}字符 | 利用率: ${result.utilization}% | 状态: ${result.utilizationStatus}`);
  console.log(`  📝 Prompt预览:`);
  console.log(`  ${result.prompt.substring(0, 200)}...`);
  
  // 5. 保存到 shot
  shot.prompt = result.prompt;
  shot.dialogue = distributed.dialogue;
  shot.hasDialogue = distributed.hasDialogue;
  shot.characterDescriptions = charDescs;
  shot.promptBuildVersion = 'v6.2-patch89';
  
  // 6. 保存新 prompt 到独立文件
  const shotPromptPath = `../output/${shot.shotId}-prompt-v6.2-patch89.txt`;
  fs.writeFileSync(shotPromptPath, result.prompt);
  console.log(`  💾 Prompt已保存: ${shotPromptPath}`);
}

// 保存更新后的 prompts
const updatedPath = '../output/taotie-ep01-prompts-full-v6.2-patch89.json';
fs.writeFileSync(updatedPath, JSON.stringify(promptsData, null, 2));
console.log(`\n✅ 更新后的 prompts 已保存: ${updatedPath}`);

// 输出所有镜头的完整 prompt 供队长审阅
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`📋 全部镜头完整 Prompt（v6.2-patch89-旁白归零）`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

for (const shot of promptsData.prompts) {
  console.log(`\n🎬 ${shot.shotId}: ${shot.scene}`);
  console.log(`-`.repeat(60));
  console.log(`角色: ${shot.characterDescriptions?.join(' + ') || '无'}`);
  console.log(`类型: ${shot.type}`);
  console.log(`旁白: 【无】（v6.2-patch89-旁白归零）`);
  if (shot.dialogue?.length > 0) {
    console.log(`台词:`);
    for (const line of shot.dialogue) {
      console.log(`  [${line.type}] ${line.speaker}(${line.emotion}): ${line.text}`);
    }
  } else {
    console.log(`台词: 【无】⚠️ 需补充`);
  }
  console.log(`嘴型: ${shot.mouthAction || '无'}`);
  console.log(`\n【完整Prompt】(${shot.prompt.length}字符):`);
  console.log(shot.prompt);
  console.log(`\n`);
}

// 统计
const stats = {
  totalShots: promptsData.prompts.length,
  withDialogue: promptsData.prompts.filter(p => p.dialogue.length > 0).length,
  totalDialogueLines: promptsData.prompts.reduce((sum, p) => sum + p.dialogue.length, 0),
  avgDialoguePerShot: (promptsData.prompts.reduce((sum, p) => sum + p.dialogue.length, 0) / promptsData.prompts.length).toFixed(1)
};

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`📊 统计`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`总镜头: ${stats.totalShots}`);
console.log(`含台词: ${stats.withDialogue}`);
console.log(`台词总数: ${stats.totalDialogueLines}`);
console.log(`平均每镜台词: ${stats.avgDialoguePerShot}`);
console.log(`\n✅ 全部镜头 Prompt 重建完成（v6.2-patch89-旁白归零）！`);
console.log(`底层约束已生效：NO_VOICEOVER = true`);
