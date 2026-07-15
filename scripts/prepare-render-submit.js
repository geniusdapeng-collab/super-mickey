const fs = require('fs');
const path = require('path');
const { DialogueDistributor } = require('../systems/dialogue-distributor');

// 读取预生产结果
const preprodPath = '/root/.openclaw/workspace/output/taotie-ep01-preproduction-2026-05-31T13-15-33-118Z.json';
const preprod = JSON.parse(fs.readFileSync(preprodPath, 'utf8'));

// 初始化台词分配器
const dialogueDistributor = new DialogueDistributor();

// 提取 prompts 和 storyboard 数据
const prompts = preprod.stages.output.prompts;
const storyboard = preprod.stages.output.storyboard;

// 为每个 prompt 补充 characters 信息（从 storyboard 匹配）
const enrichedPrompts = prompts.map(p => {
  const shot = storyboard.shots?.find(s => s.id === p.shotId || s.shotId === p.shotId);
  
  // 【v6.2-patch88-fix】台词/旁白分离
  let voiceover = '';
  let dialogue = [];
  let hasDialogue = false;
  
  if (shot) {
    // 使用 DialogueDistributor 自动分离 narration → voiceover + dialogue
    const distributed = dialogueDistributor.distribute({
      shotId: shot.id || shot.shotId,
      narration: shot.narration || '',
      characters: shot.characters || [],
      mouthAction: shot.mouthAction || ''
    });
    
    voiceover = distributed.voiceover;
    dialogue = distributed.dialogue;
    hasDialogue = distributed.hasDialogue;
    
    // 验证嘴型动作与台词硬关联
    const lipSyncValidation = dialogueDistributor.validateLipSync({
      shotId: shot.id || shot.shotId,
      dialogue: distributed.dialogue,
      mouthAction: shot.mouthAction || ''
    });
    
    if (!lipSyncValidation.valid) {
      console.warn(`⚠️ 镜头 ${shot.id || shot.shotId} 嘴型/台词关联警告:`);
      for (const issue of lipSyncValidation.issues) {
        console.warn(`  [${issue.severity}] ${issue.message}`);
        console.warn(`  建议修复: ${issue.fix}`);
      }
    }
  }
  
  return {
    ...p,
    characters: shot?.characters || [],
    duration: shot?.duration || p.duration || 12,
    scene: shot?.scene || '',
    type: shot?.type || 'generic',
    narration: shot?.narration || '',
    // 【v6.2-patch88-fix】新增字段
    voiceover: voiceover,
    dialogue: dialogue,
    hasDialogue: hasDialogue,
    mouthAction: shot?.mouthAction || ''
  };
});

// 构建提交格式
const submitData = {
  project: preprod.stages.prd?.meta?.title || '山海经：饕餮·永恒饥饿 EP01',
  prompts: enrichedPrompts,
  characters: preprod.stages.output.characters || {},
  timestamp: new Date().toISOString(),
  // 【v6.2-patch88-fix】标记使用新格式
  formatVersion: 'v6.2-patch88',
  dialogueSystem: 'DialogueDistributor-v1.0'
};

// 保存为提交文件
const outputPath = '/root/.openclaw/workspace/output/taotie-ep01-prompts-full.json';
fs.writeFileSync(outputPath, JSON.stringify(submitData, null, 2));

console.log('✅ 提交文件已生成:', outputPath);
console.log('📊 镜头数:', enrichedPrompts.length);
console.log('🎬 镜头列表:', enrichedPrompts.map(p => p.shotId).join(', '));
console.log('👥 角色信息已补充');

// 【v6.2-patch88-fix】统计台词/旁白分离情况
const stats = {
  totalShots: enrichedPrompts.length,
  withVoiceover: enrichedPrompts.filter(p => p.voiceover).length,
  withDialogue: enrichedPrompts.filter(p => p.dialogue.length > 0).length,
  totalDialogueLines: enrichedPrompts.reduce((sum, p) => sum + p.dialogue.length, 0),
  lipSyncWarnings: enrichedPrompts.filter(p => {
    const validation = dialogueDistributor.validateLipSync({
      shotId: p.shotId,
      dialogue: p.dialogue,
      mouthAction: p.mouthAction
    });
    return !validation.valid;
  }).length
};

console.log('\n📊 台词/旁白分离统计:');
console.log(`  总镜头: ${stats.totalShots}`);
console.log(`  含旁白: ${stats.withVoiceover}`);
console.log(`  含台词: ${stats.withDialogue}`);
console.log(`  台词总数: ${stats.totalDialogueLines}`);
console.log(`  嘴型警告: ${stats.lipSyncWarnings}`);

// 打印每个镜头的台词详情
for (const p of enrichedPrompts) {
  if (p.dialogue.length > 0 || p.voiceover) {
    console.log(`\n🎬 ${p.shotId}:`);
    if (p.voiceover) {
      console.log(`  [旁白] ${p.voiceover.substring(0, 50)}${p.voiceover.length > 50 ? '...' : ''}`);
    }
    for (const line of p.dialogue) {
      console.log(`  [${line.type}] ${line.speaker}(${line.emotion}): ${line.text.substring(0, 50)}${line.text.length > 50 ? '...' : ''}`);
    }
    if (p.mouthAction) {
      console.log(`  [嘴型] ${p.mouthAction}`);
    }
  }
}
