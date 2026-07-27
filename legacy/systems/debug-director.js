const { AsyncDirectorAgent } = require('./async-director-agent.js');
const fs = require('fs');

async function test() {
  const inputPath = '/tmp/director-1780151819311-rsdc2k-input.json';
  const outputPath = '/tmp/director-debug-output.json';
  
  console.log('[Debug] 读取输入文件...');
  const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  
  console.log('[Debug] 创建Agent...');
  const agent = new AsyncDirectorAgent({
    mode: inputData.mode || 'nirath',
    projectName: inputData.projectName || 'unknown',
    shots: inputData.shots || [],
    prd: inputData.prd || {},
    directorPlan: inputData.directorPlan || null,
    outputPath,
    minPassScore: inputData.minPassScore || 75,
    maxIterations: inputData.maxIterations || 3
  });
  
  console.log('[Debug] 执行Agent...');
  const result = await agent.execute();
  
  console.log('[Debug] 结果:', JSON.stringify(result.summary, null, 2));
}

test().catch(err => {
  console.error('[Debug] 错误:', err.message);
  console.error(err.stack);
  process.exit(1);
});
