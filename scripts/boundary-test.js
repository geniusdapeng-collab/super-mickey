// 边界测试：找到系统能处理的最大Prompt和输出大小
const fs = require('fs');
const path = require('path');
const { LLMEngine } = require('../systems/llm-reasoning-engine');

async function testBoundary(shotFile, inputLength, outputTokens) {
  console.log(`\n[边界测试] 测试文件: ${shotFile}`);
  console.log(`[边界测试] 输入长度: ${inputLength}字符 | 输出限制: ${outputTokens}tokens`);
  
  const promptContent = fs.readFileSync(shotFile, 'utf8');
  
  // 提取不同长度的输入
  const visualMatch = promptContent.match(/【视觉】(.+?)(?=【|$)/s);
  const fullVisual = visualMatch ? visualMatch[1] : '';
  
  // 截取指定长度
  const testInput = fullVisual.substring(0, inputLength);
  
  const prompt = `你是一位电影导演优化专家。请优化以下镜头描述，提升视觉冲击力。

场景: 星骸终宴
类型: climax
当前描述: ${testInput}

请提供完整的优化后镜头描述，包含视觉细节、光影设计、运镜方案。目标：让画面冲击力达到90分。`;

  const engine = new LLMEngine({ model: 'kimi-k2p6' });
  
  try {
    const result = await engine.reason(prompt, {
      maxTokens: outputTokens,
      temperature: 1
    });
    
    console.log(`✅ 成功 | 输出: ${result.content.length}字符 | Tokens: ${result.tokenCount}`);
    return {
      success: true,
      inputLength,
      outputTokens,
      outputLength: result.content.length,
      tokenCount: result.tokenCount
    };
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
    return {
      success: false,
      inputLength,
      outputTokens,
      error: error.message
    };
  }
}

async function main() {
  const shotFile = path.join(__dirname, '../output/prompts/S04-prompt.md');
  
  // 测试不同边界
  const tests = [
    { input: 150, output: 600 },   // 当前限制
    { input: 300, output: 800 },   // 放宽限制
    { input: 500, output: 1000 },  // 更大限制
    { input: 800, output: 1200 },  // 更大限制
    { input: 1000, output: 1500 }, // 接近完整Prompt
    { input: 1349, output: 2000 }, // 完整Prompt（S04实际长度）
  ];
  
  console.log('=== 边界测试开始 ===');
  console.log('测试系统能处理的最大输入和输出大小\n');
  
  const results = [];
  
  for (const test of tests) {
    // 每次测试间隔，避免内存累积
    await new Promise(r => setTimeout(r, 3000));
    
    const result = await testBoundary(shotFile, test.input, test.output);
    results.push(result);
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }
  
  console.log('\n=== 边界测试结果 ===');
  results.forEach(r => {
    if (r.success) {
      console.log(`输入${r.inputLength} | 输出${r.outputTokens} | ✅ 成功 | 产出${r.outputLength}字符 | Tokens:${r.tokenCount}`);
    } else {
      console.log(`输入${r.inputLength} | 输出${r.outputTokens} | ❌ 失败 | ${r.error}`);
    }
  });
  
  // 找出最大成功边界
  const lastSuccess = results.reverse().find(r => r.success);
  if (lastSuccess) {
    console.log(`\n🏆 最大成功边界: 输入${lastSuccess.inputLength}字符 | 输出${lastSuccess.outputTokens}tokens`);
    console.log(`💡 建议: 使用输入${lastSuccess.inputLength} | 输出${lastSuccess.outputTokens}作为PromptForge-Lite参数`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBoundary };
