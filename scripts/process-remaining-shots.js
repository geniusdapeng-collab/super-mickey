// 单独处理S04（修复截断问题）
const fs = require('fs');
const path = require('path');
const { LLMEngine } = require('../systems/llm-reasoning-engine');

async function fixS04() {
  const shotFile = path.join(__dirname, '../output/prompts/S04-prompt.md');
  
  console.log('[修复S04] 重新处理星骸终宴...');
  
  const promptContent = fs.readFileSync(shotFile, 'utf8');
  
  // 提取关键信息
  const visualMatch = promptContent.match(/【视觉】(.+?)(?=【|$)/s);
  const visualDesc = visualMatch ? visualMatch[1] : '';
  
  const envMatch = promptContent.match(/【环境布景】(.+?)(?=【|$)/s);
  const envDesc = envMatch ? envMatch[1].substring(0, 300) : '';
  
  const lightingMatch = promptContent.match(/【照明方案】(.+?)(?=【|$)/s);
  const lightingDesc = lightingMatch ? lightingMatch[1].substring(0, 200) : '';
  
  const optimizationPrompt = `你是一位电影导演优化专家。请优化以下高潮镜头描述，提升视觉冲击力到90分。

场景: 星骸终宴
类型: climax（高潮/决战）

当前视觉描述:
${visualDesc}

环境布景:
${envDesc}

照明方案:
${lightingDesc}

请提供完整的优化后镜头描述，要求：
1. 增强的视觉细节：星骸崩塌、能量爆发、巨兽咆哮、粒子风暴
2. 光影设计优化：双恒星极端光照、能量爆发光效、角色轮廓光
3. 运镜方案优化：从宏观史诗到微观情感的镜头转换
4. 角色表现优化：xiaoG的决绝、taotie的狂暴、终极对决的张力

要求：
- 使用电影级镜头语言（IMAX、史诗级、震撼）
- 强化Nirath异世界特征（双恒星、荧光生态、低重力、星骸废墟）
- 保持角色一致性（xiaoG、taotie的定妆照特征）
- 输出完整Prompt格式，可以直接用于视频渲染
- 中文字数控制在490字以内
- 重点：这是高潮决战场景，必须有毁灭性的视觉冲击和情感爆发力`;

  const engine = new LLMEngine({ model: 'kimi-k2p6' });
  
  console.log(`  [LLM] 调用 | Prompt: ${optimizationPrompt.length}字符 | maxTokens: 2000`);
  
  const result = await engine.reason(optimizationPrompt, {
    maxTokens: 2000,
    temperature: 1
  });
  
  console.log(`  LLM输出: ${result.tokenCount} tokens | ${result.content.length}字符`);
  
  // 将优化建议追加到文件（标记为修复版）
  const optimizationSection = `\n\n---\n\n**导演优化建议 (PromptForge-修复版):**\n\n${result.content}\n\n**目标评分**: 未评分 → 90分\n**修复时间**: ${new Date().toISOString()}\n**使用参数**: 输入${optimizationPrompt.length}字符 | 输出2000tokens\n`;
  fs.appendFileSync(shotFile, optimizationSection);
  console.log(`  ✅ S04修复完成，已追加到文件`);
}

fixS04().catch(console.error);
