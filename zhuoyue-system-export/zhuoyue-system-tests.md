# 卓越系统 (zhuoyue-system) - TESTS 模块

> 导出时间: 2026-06-18T07:15:48.351Z

---

## tests/test-promptforge-worker-llm.js

> 文件大小: 3181 bytes

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = process.cwd();
const inputFile = path.join(root, 'tmp-promptforge-input.json');
const outputFile = path.join(root, 'tmp-promptforge-output.json');
const workerFile = path.join(root, 'core', 'promptforge-director-worker.js');

const inputData = {
  projectConfig: {
    theme: '测试主题',
    mode: 'generic'
  },
  rawReport: {
    shots: [
      {
        id: 'S01',
        scene: '医院诊室',
        visualPrompt: '一位医生在诊室中面对镜头讲解横纹肌溶解的风险',
        dialogue: '大家好，今天我们来了解横纹肌溶解。',
        emotionPhase: 'professional',
        duration: 5,
        cameraMovement: {
          description: '中景稳定构图'
        }
      }
    ]
  }
};

fs.writeFileSync(inputFile, JSON.stringify(inputData, null, 2), 'utf8');

console.log('🚀 启动 PromptForge Worker 自测...');
console.log('worker: ' + workerFile);

const child = spawn('node', [workerFile, inputFile, outputFile], {
  cwd: root,
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (buf) => {
  const text = buf.toString();
  stdout += text;
  process.stdout.write(text);
});

child.stderr.on('data', (buf) => {
  const text = buf.toString();
  stderr += text;
  process.stderr.write(text);
});

child.on('close', (code) => {
  console.log('\n====================');
  console.log('退出码: ' + code);
  console.log('====================');

  if (!fs.existsSync(outputFile)) {
    console.error('❌ 未生成输出文件');
    process.exit(1);
  }

  const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'));

  const hasLLMStartLog = stdout.includes('🤖 LLM调用开始');
  const hasLLMSuccessLog = stdout.includes('✅ LLM调用成功');
  const hasFallbackLog = stdout.includes('回退到本地合成');

  console.log('\n📊 验证结果:');
  console.log('- 检测到 LLM 调用开始日志: ' + (hasLLMStartLog ? 'YES' : 'NO'));
  console.log('- 检测到 LLM 调用成功日志: ' + (hasLLMSuccessLog ? 'YES' : 'NO'));
  console.log('- 检测到 fallback 日志: ' + (hasFallbackLog ? 'YES' : 'NO'));
  console.log('- output.success: ' + output.success);
  console.log('- output.fallbackUsed: ' + output.fallbackUsed);
  console.log('- output.fallbackCount: ' + output.fallbackCount);

  if (output.shots && output.shots[0]) {
    console.log('- finalPrompt长度: ' + (output.shots[0].finalPrompt || '').length);
    console.log('- fallbackUsed(shot): ' + output.shots[0].fallbackUsed);
    console.log('- finalPrompt预览: ' + (output.shots[0].finalPrompt || '').slice(0, 200) + '...');
  }

  if (!hasLLMStartLog) {
    console.error('\n❌ 失败：没有出现 LLM 调用日志，worker 可能根本没调到 LLM');
    process.exit(2);
  }

  if (hasFallbackLog && !hasLLMSuccessLog) {
    console.error('\n⚠️ 警告：worker 发生了 fallback，说明 LLM 仍未稳定成功');
    process.exit(3);
  }

  console.log('\n✅ Worker LLM 调用链路看起来已恢复');
  process.exit(0);
});

```

---

## tests/test-stage12-compliance.js

> 文件大小: 2521 bytes

```javascript
'use strict';

const { checkStandardCompliance } = require('../systems/prompt-standard-v3');
const { buildStandardPromptFromShot } = require('../systems/prompt-standard-bridge');
const { safeStructuredTrim } = require('../systems/safe-structured-trim');

const rawShot = {
  shotId: 'S01',
  scene: '椰树下初见',
  visualPrompt: '香香与小卓在椰树下初次相遇，海风吹拂，阳光温暖，画面具有纪录片真实质感',
  action: '小卓低头看向香香，香香抬手回应，双方自然对视',
  dialogue: '你看，风来了。',
  emotionPhase: '温暖、治愈',
  cameraString: '中景稳定运镜，轻微向下摇镜',
  timelineString: '0-30% 建立环境，30-70% 人物互动，70-100% 情绪收束',
  lightingString: 'golden hour 自然光，柔和逆光勾边，明暗层次清晰',
  backgroundSoundString: '伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩，环境音自然，声画同步',
  negativePrompt: 'no text, no watermark, no subtitle, no deformed hands, no extra fingers',
  renderStyle: 'hyperrealistic cinematic quality, 35mm film grain, HDR',
  directorStyle: '通用导演风格'
};

const oldPrompt = `
16:9 cinematic, golden hour, clear sky, 香香，7个月男孩，小卓，35岁女性，椰树下初见，
tilt_down, 中景居中构图，纪录片场景，伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩，
Director style: 通用导演, hyperrealistic, no text, no watermark
`.trim();

const newPrompt = safeStructuredTrim(buildStandardPromptFromShot({
  ...rawShot,
  prompt: oldPrompt
}), 1500);

const oldResult = checkStandardCompliance(oldPrompt, 'S01');
const newResult = checkStandardCompliance(newPrompt, 'S01');

console.log('================ OLD PROMPT ================');
console.log(oldPrompt);
console.log('\n旧合规结果:');
console.log(JSON.stringify(oldResult, null, 2));

console.log('\n================ NEW PROMPT ================');
console.log(newPrompt);
console.log('\n新合规结果:');
console.log(JSON.stringify(newResult, null, 2));

console.log('\n================ SUMMARY ================');
console.log(`旧 coverage: ${oldResult.coverage}%`);
console.log(`新 coverage: ${newResult.coverage}%`);

if (newResult.coverage <= oldResult.coverage) {
  console.error('❌ 合规率没有提升');
  process.exit(1);
}

if (newResult.coverage < 60) {
  console.error('❌ 合规率仍低于通过线 60%');
  process.exit(2);
}

console.log('✅ 合规率已提升，并达到基本通过线');
process.exit(0);

```

---

