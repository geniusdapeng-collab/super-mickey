// 真实LLM版PromptForge - 单镜头处理，避免OOM
const fs = require('fs');
const path = require('path');

// 真实LLM调用（使用LLMEngine - 主链路使用的引擎）
async function callLLM(prompt, maxTokens = 1000) {
  const { LLMEngine } = require('../systems/llm-reasoning-engine');
  const engine = new LLMEngine({ model: 'kimi-k2p6' });
  
  console.log(`  [LLM] 调用 | Prompt: ${prompt.length}字符 | maxTokens: ${maxTokens}`);
  
  const result = await engine.reason(prompt, {
    maxTokens,
    temperature: 1
  });
  
  // 强制垃圾回收，释放内存
  if (global.gc) {
    global.gc();
  }
  
  return {
    content: result.content || '',
    tokens: result.tokenCount || 0
  };
}

async function runSingleShotPromptForge(shotFile) {
  console.log(`[PromptForge-Lite] 处理: ${shotFile}`);
  
  // 读取单个镜头Prompt
  const promptContent = fs.readFileSync(shotFile, 'utf8');
  
  // 提取关键信息
  const sceneMatch = promptContent.match(/\*\*场景\*\*: (.+)/);
  const typeMatch = promptContent.match(/\*\*类型\*\*: (.+)/);
  const scoreMatch = promptContent.match(/\*\*质量评分\*\*: (.+)/);
  
  const scene = sceneMatch ? sceneMatch[1] : 'unknown';
  const type = typeMatch ? typeMatch[1] : 'unknown';
  const score = scoreMatch ? scoreMatch[1] : '未评分';
  
  console.log(`  场景: ${scene} | 类型: ${type} | 当前评分: ${score}`);
  
  // 提取核心视觉描述（使用完整长度，不截断）
  const visualMatch = promptContent.match(/【视觉】(.+?)(?=【|$)/s);
  const visualDesc = visualMatch ? visualMatch[1] : '';
  
  // 提取完整Prompt上下文（环境、照明、运镜等）
  const envMatch = promptContent.match(/【环境布景】(.+?)(?=【|$)/s);
  const envDesc = envMatch ? envMatch[1].substring(0, 300) : '';
  
  const lightingMatch = promptContent.match(/【照明方案】(.+?)(?=【|$)/s);
  const lightingDesc = lightingMatch ? lightingMatch[1].substring(0, 200) : '';
  
  // 构建完整的优化Prompt（使用完整描述）
  const optimizationPrompt = `你是一位电影导演优化专家。请优化以下镜头描述，提升视觉冲击力到90分。

场景: ${scene}
类型: ${type}

当前视觉描述:
${visualDesc}

环境布景:
${envDesc}

照明方案:
${lightingDesc}

请提供完整的优化后镜头描述，包含：
1. 增强的视觉细节（更具体、更有画面感）
2. 光影设计优化（更有戏剧性、更震撼）
3. 运镜方案优化（更电影化、更有冲击力）
4. 角色表现优化（微表情、动作、情绪）

要求：
- 使用电影级镜头语言
- 强化Nirath异世界特征（双恒星、荧光生态、低重力）
- 保持角色一致性（xiaoG、taotie的定妆照特征）
- 输出完整Prompt格式，可以直接用于视频渲染
- 中文字数控制在490字以内（充分利用Seedance API上限）`;

  // 调用LLM（使用完整输入，不限制输出）
  const llmResult = await callLLM(optimizationPrompt, 2000); // 2000 tokens，完整输出
  
  console.log(`  LLM输出: ${llmResult.tokens} tokens`);
  console.log(`  优化建议: ${llmResult.content.substring(0, 100)}...`);
  
  // 将优化建议追加到Prompt文件
  const optimizationSection = `\n\n---\n\n**导演优化建议 (PromptForge-Lite):**\n\n${llmResult.content}\n\n**目标评分**: ${score} → 90分\n**优化时间**: ${new Date().toISOString()}\n`;
  fs.appendFileSync(shotFile, optimizationSection);
  console.log(`  ✅ 优化建议已追加到 ${shotFile}`);
  
  return {
    scene,
    type,
    originalScore: score,
    targetScore: 90,
    llmOutput: llmResult.content
  };
}

async function main() {
  const promptsDir = path.join(__dirname, '../output/prompts');
  const files = fs.readdirSync(promptsDir)
    .filter(f => f.endsWith('-prompt.md'))
    .sort();
  
  console.log(`[PromptForge-Lite] 发现 ${files.length} 个镜头Prompt`);
  console.log('='.repeat(50));
  
  const results = [];
  
  for (const file of files) {
    const result = await runSingleShotPromptForge(path.join(promptsDir, file));
    results.push(result);
    
    // 处理间隔，避免内存累积
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('='.repeat(50));
  console.log('[PromptForge-Lite] 全部处理完成');
  console.log('优化摘要:');
  results.forEach(r => {
    console.log(`  ${r.scene}: ${r.originalScore} → ${r.targetScore}`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runSingleShotPromptForge };
