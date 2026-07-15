'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function runWorker(inputFile, outputFile, timeoutMs = 240000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(__dirname, 'promptforge-worker.js'),
      inputFile,
      outputFile
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`worker_timeout:${path.basename(inputFile)}`));
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, inputFile, outputFile, stdout, stderr });
      } else {
        reject(new Error(`worker_exit_${code}:${stderr || stdout}`));
      }
    });
  });
}

async function main() {
  const inputDir = process.argv[2] || path.join(process.cwd(), 'output/prompts');
  const files = fs.readdirSync(inputDir)
    .filter(f => /prompt\.(md|txt|json)$/i.test(f) || /-prompt\.md$/i.test(f))
    .sort();

  const resultDir = path.join(inputDir, '_promptforge_results');
  fs.mkdirSync(resultDir, { recursive: true });

  const summary = [];

  for (const file of files) {
    const inputFile = path.join(inputDir, file);
    const outputFile = path.join(resultDir, file.replace(/\.\w+$/, '.json'));

    let success = false;
    let lastError = '';

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await runWorker(inputFile, outputFile, 240000);
        const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        summary.push({
          file,
          success: true,
          length: data.length,
          source: data.source,
          attempt
        });
        success = true;
        break;
      } catch (err) {
        lastError = err.message;
        if (attempt < 2) await sleep(1500);
      }
    }

    if (!success) {
      summary.push({
        file,
        success: false,
        error: lastError
      });
    }

    await sleep(1000);
  }

  const summaryPath = path.join(resultDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`PromptForge batch done: ${summaryPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
