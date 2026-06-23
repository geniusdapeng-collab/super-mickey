const { spawn } = require('child_process');
const fs = require('fs');

function runPhase(script, phase) {
  return new Promise((resolve) => {
    console.log(`\n🚀 [Supervisor] 启动 ${phase} ...`);
    const child = spawn('node', [script], { stdio: 'inherit' });
    child.on('exit', (code) => {
      console.log(`[Supervisor] ${phase} 退出码 ${code}`);
      resolve(code);
    });
  });
}

async function main() {
  // Phase 1 + 2（剧本 + 运镜灯光）一个进程
  let code = await runPhase('./run-phase12.js', 'Phase1-2');
  if (code !== 0) {
    console.log('\n⚠️ [Supervisor] Phase1-2 失败，终止');
    process.exit(code);
  }

  // Phase 3 单独进程，被杀也能续跑
  code = await runPhase('./run-phase3.js', 'Phase3');
  // 若 Phase3 非正常退出且有未完成镜头，自动续跑（最多 3 轮）
  for (let i = 0; i < 3 && code !== 0; i++) {
    console.log(`\n🔁 [Supervisor] Phase3 续跑第 ${i + 1} 轮 ...`);
    code = await runPhase('./run-phase3.js', 'Phase3-retry');
  }

  console.log(code === 0 ? '\n🎉 全部完成' : '\n⚠️ 仍有未完成镜头，请检查 checkpoint');
}

main();
