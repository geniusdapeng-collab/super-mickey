// promptforge-render.js - 兼容入口，自动路由到子进程架构
// 保持原有CLI接口，内部使用batch.js调度

const { spawn } = require('child_process');
const path = require('path');

/**
 * 精简Prompt主入口（向后兼容）
 * 内部调用 batch.js + worker.js 子进程架构
 * 
 * 使用方式：
 *   CLI: node promptforge-render.js [promptsDir]
 *   模块: const { optimizePrompts } = require('./promptforge-render'); optimizePrompts(dir)
 */

async function optimizePrompts(promptsDir) {
  const dir = promptsDir || path.join(__dirname, '../output/prompts');
  const batchScript = path.join(__dirname, 'promptforge-batch.js');

  return new Promise((resolve, reject) => {
    const child = spawn('node', [batchScript, dir], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data); // 透传实时输出
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data); // 透传错误
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Batch process exited with code ${code}\n${stderr}`));
      } else {
        resolve({ success: true, output: stdout });
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// CLI入口
if (require.main === module) {
  const promptsDir = process.argv[2] || path.join(__dirname, '../output/prompts');
  
  console.log(`[PromptForge] 启动子进程架构批量处理: ${promptsDir}`);
  
  optimizePrompts(promptsDir)
    .then(() => {
      console.log('[PromptForge] 全部完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[PromptForge] 失败:', err.message);
      process.exit(1);
    });
}

module.exports = { optimizePrompts };
