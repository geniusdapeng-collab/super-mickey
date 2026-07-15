// PromptForge-修复版 - 从LLM输出中提取精简Prompt
const fs = require('fs');
const path = require('path');

function extractPromptFromOutput(llmOutput) {
  // 策略1：查找"让我构思一个Prompt："或类似标记后的内容
  const markers = [
    '让我构思一个Prompt：',
    '让我构思一个Prompt:',
    'Prompt:',
    '最终版本：',
    '最终版本:',
    '精简Prompt：',
    '精简Prompt:',
    '输出Prompt：',
    '输出Prompt:',
    'Cinematic shot,',
    'IMAX',
    '电影级镜头'
  ];
  
  let promptStart = -1;
  
  for (const marker of markers) {
    const idx = llmOutput.indexOf(marker);
    if (idx !== -1) {
      promptStart = idx;
      break;
    }
  }
  
  if (promptStart === -1) {
    // 如果没找到标记，尝试查找英文开头（Cinematic, IMAX等）
    const cinematicIdx = llmOutput.search(/Cinematic|IMAX|Extreme|Wide|Close-up/i);
    if (cinematicIdx !== -1) {
      promptStart = cinematicIdx;
    }
  }
  
  if (promptStart === -1) {
    console.log('  ⚠️ 无法找到Prompt起始位置，返回空');
    return '';
  }
  
  let prompt = llmOutput.substring(promptStart).trim();
  
  // 去除后续的说明文字（如"字数："，"检查"等）
  const endMarkers = [
    '\n字数：',
    '\n字数:',
    '\n检查',
    '\n约',
    '\n完美',
    '\n注意：',
    '\n注意:',
    '。\n'
  ];
  
  for (const endMarker of endMarkers) {
    const endIdx = prompt.indexOf(endMarker);
    if (endIdx !== -1 && endIdx > 50) { // 确保截取位置不是太靠前
      prompt = prompt.substring(0, endIdx);
      break;
    }
  }
  
  // 截取到990字符以内
  if (prompt.length > 990) {
    console.log(`  ⚠️ Prompt ${prompt.length}字符，截取到990字符`);
    prompt = prompt.substring(0, 990);
  }
  
  return prompt.trim();
}

async function fixRenderPrompt(shotFile) {
  console.log(`[修复精简Prompt] 处理: ${shotFile}`);
  
  const content = fs.readFileSync(shotFile, 'utf8');
  
  // 查找所有精简渲染Prompt区块
  const promptBlocks = content.split('**【精简渲染Prompt】');
  
  if (promptBlocks.length < 2) {
    console.log('  ⚠️ 未找到精简Prompt区块');
    return;
  }
  
  // 获取最后一个区块（最新的）
  const lastBlock = promptBlocks[promptBlocks.length - 1];
  
  // 提取```之间的内容
  const codeBlockMatch = lastBlock.match(/```\n([\s\S]*?)```/);
  if (!codeBlockMatch) {
    console.log('  ⚠️ 未找到代码块');
    return;
  }
  
  const llmOutput = codeBlockMatch[1];
  
  console.log(`  原始LLM输出: ${llmOutput.length}字符`);
  
  // 提取精简Prompt
  const extractedPrompt = extractPromptFromOutput(llmOutput);
  
  if (!extractedPrompt) {
    console.log('  ❌ 无法提取有效Prompt');
    return;
  }
  
  console.log(`  提取后Prompt: ${extractedPrompt.length}字符`);
  
  // 追加修复后的Prompt
  const fixSection = `\n\n---\n\n**【精简渲染Prompt-修复版】（${extractedPrompt.length}字符）**\n\n\`\`\`\n${extractedPrompt}\n\`\`\`\n\n**修复时间**: ${new Date().toISOString()}\n`;
  fs.appendFileSync(shotFile, fixSection);
  console.log(`  ✅ 修复版Prompt已追加`);
}

async function main() {
  const promptsDir = path.join(__dirname, '../output/prompts');
  const files = fs.readdirSync(promptsDir)
    .filter(f => f.endsWith('-prompt.md'))
    .sort();
  
  console.log(`[修复精简Prompt] 处理 ${files.length} 个镜头\n`);
  
  for (const file of files) {
    await fixRenderPrompt(path.join(promptsDir, file));
  }
  
  console.log('\n=== 修复完成 ===');
}

if (require.main === module) {
  main().catch(console.error);
}
