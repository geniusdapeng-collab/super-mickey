// ASTRALIS EP02 片头渲染提交 — v3.0-patch4（队长4个反馈修复）
// 系统级升级，所有集数自动受益

const { generateOpeningV3, preProductionCheck } = require('../systems/opening-system-v3');
const { translateTitleToEnglish, generatePixarStyleTitleTreatment, generateProducerEnglish } = require('../systems/opening-system-v3');
const fs = require('fs');
const path = require('path');

console.log('🎬 ASTRALIS 通用片头系统 v3.0-patch4 — 队长反馈修复版');
console.log('═══════════════════════════════════════');
console.log('系统级修复，非单集定制！后续所有集数自动受益。');
console.log('');
console.log('队长反馈修复：');
console.log('  1. 眼睛红色问题 → 强化约束（正面描述+精简负面）');
console.log('  2. 标题英文 → 标题翻译引擎（山海经系列全部英文）');
console.log('  3. 出品人英文 → "A Nirath Original by Genius"');
console.log('  4. 皮克斯风格 → 字体3D深度+金色轮廓光');
console.log('');

const config = {
  episodeTitle: '九尾狐·迷局',
  episodeTheme: 'mysterious',
  episodeSummary: '小G初到青丘群岛，被九尾狐幻术迷惑，九尾狐测试小G分辨力，两者建立信任签订真相契约。',
  protagonistId: 'xiaoG',
  featuredBeastId: 'jiu-wei-hu',
  duration: 9,
  mood: 'mysterious'
};

console.log('=== 预生产检查 ===');
const check = preProductionCheck(config);
console.log(`✅ 可继续: ${check.canProceed}`);
check.issues.forEach(i => console.log(`${i.level === 'error' ? '❌' : '⚠️'} ${i.message}`));
console.log(`定妆照: 主角=${check.portraits.protagonist ? '✅' : '❌'}, 异兽=${check.portraits.beast ? '✅' : '❌'}`);

if (!check.canProceed) {
  console.error('❌ 预生产检查未通过，无法继续');
  process.exit(1);
}

console.log('\n=== 生成片头Prompt（通用系统 v3.0-patch4）===');
const opening = generateOpeningV3(config);

console.log(`时长: ${opening.duration}秒`);
console.log(`Prompt长度: ${opening.promptLength}/980 ${opening.promptLength > 980 ? '🔴 超限!' : '✅ 合规'}`);
console.log(`是否裁剪: ${opening.truncationApplied ? '是' : '否'}`);
console.log(`合规检查: ${opening.complianceCheck.allChecksPass ? '✅ 全部通过' : '❌ 未通过'}`);

if (opening.promptLength > 980) {
  console.error('❌ Prompt长度超过980字符，无法提交');
  console.error('系统已自动裁剪，但仍超限。需要手动精简剧情描述。');
  process.exit(1);
}

console.log('\n三幕叙事:');
Object.values(opening.acts).forEach(act => {
  console.log(`  ${act.phase} (${act.timeRange}): ${act.content.substring(0, 60)}...`);
});

console.log('\n角色:');
console.log(`  主角: ${opening.characters.protagonist?.name}`);
console.log(`  异兽: ${opening.characters.beast?.name}`);

console.log('\n📄 完整Prompt:');
console.log(opening.prompt);

// 保存预生产记录
const outputDir = path.join(__dirname, '..', 'output', 'astralis-ep02-opening-v3.0-patch4');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const preproductionRecord = {
  version: 'v3.0-patch4',
  timestamp: new Date().toISOString(),
  config,
  promptLength: opening.promptLength,
  truncationApplied: opening.truncationApplied,
  complianceCheck: opening.complianceCheck,
  acts: {
    act1: { phase: opening.acts.act1.phase, timeRange: opening.acts.act1.timeRange, content: opening.acts.act1.content },
    act2: { phase: opening.acts.act2.phase, timeRange: opening.acts.act2.timeRange, content: opening.acts.act2.content },
    act3: { phase: opening.acts.act3.phase, timeRange: opening.acts.act3.timeRange, content: opening.acts.act3.content }
  },
  titleEnglish: 'The Enigma of the Nine-Tailed Fox',
  pixarStyle: { fontStyle: 'elegant serif with geometric flourishes, letters have soft 3D depth with golden rim light' },
  producerEnglish: 'A Nirath Original by Genius — thin serif, golden 5800K, silver-white highlights, 8-10% height'
};

fs.writeFileSync(
  path.join(outputDir, 'preproduction-record.json'),
  JSON.stringify(preproductionRecord, null, 2)
);
console.log(`\n预生产记录已保存: ${path.join(outputDir, 'preproduction-record.json')}`);

// 保存Prompt文本
fs.writeFileSync(
  path.join(outputDir, 'prompt-for-review.txt'),
  opening.prompt
);

console.log('\n=== 角色定妆照绑定 ===');
console.log(`  ✅ 主角(小G): ${check.portraits.protagonist}`);
console.log(`  ✅ 异兽(九尾狐): ${check.portraits.beast}`);

// 提交渲染
console.log('\n=== 提交渲染 ===');
const seed = Math.floor(Math.random() * 1000000);
console.log(`Seed: ${seed}`);

const ENDPOINT = '003cENDPOINT_STD003e';
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}

// 读取定妆照
const protagonistPortrait = fs.readFileSync(check.portraits.protagonist);
const beastPortrait = fs.readFileSync(check.portraits.beast);

const content = [
  { type: 'text', text: opening.prompt },
  {
    type: 'image_url',
    image_url: { url: 'data:image/png;base64,' + protagonistPortrait.toString('base64') },
    role: 'reference_image'
  },
  {
    type: 'image_url',
    image_url: { url: 'data:image/jpeg;base64,' + beastPortrait.toString('base64') },
    role: 'reference_image'
  }
];

const payload = {
  model: ENDPOINT,
  content: content,
  metadata: { max_new_tokens: 8192, seed: seed },
  ratio: '16:9',
  duration: opening.duration
};

console.log(`Reference images: 2`);
console.log(`Payload size: ${(JSON.stringify(payload).length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Endpoint: ${ENDPOINT}`);
console.log(`Duration: ${opening.duration} seconds`);
console.log(`Ratio: 16:9`);

console.log('\nSubmitting to Seedance 2.0...\n');

// 提交任务
const https = require('https');
const { URL } = require('url');

const apiUrl = new URL('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks');

const options = {
  hostname: apiUrl.hostname,
  path: apiUrl.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response: ${JSON.stringify(response, null, 2)}`);
      
      if (response.id) {
        console.log('\n✅✅✅ TASK SUBMITTED SUCCESSFULLY ✅✅✅');
        console.log(`Task ID: ${response.id}`);
        
        // 保存提交状态
        fs.writeFileSync(
          path.join(outputDir, 'task-status.json'),
          JSON.stringify({
            taskId: response.id,
            status: 'submitted',
            timestamp: new Date().toISOString(),
            promptLength: opening.promptLength,
            duration: opening.duration
          }, null, 2)
        );
        
        console.log('\n🎬 通用片头系统 v3.0-patch4 队长反馈修复版已提交！');
        console.log('   英文标题 + 皮克斯风格 + 出品人英文 + 眼睛约束强化');
        console.log('   后续所有集数自动受益此系统！');
        console.log(`\n📁 输出目录: ${outputDir}`);
        console.log('   - preproduction-record.json (预生产记录)');
        console.log('   - task-status.json (提交状态)');
        console.log('   - prompt-for-review.txt (Prompt文本)');
      } else {
        console.error('\n❌ 提交失败:', response);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ 解析响应失败:', e.message);
      console.error('原始响应:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 请求失败:', e.message);
  process.exit(1);
});

req.write(JSON.stringify(payload));
req.end();