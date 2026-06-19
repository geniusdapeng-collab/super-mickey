const https = require('https');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const ENDPOINT = 'ep-m-20260518003302-245xb';
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const MANDATORY_RATIO = '16:9';

const PROJECT_DIR = '/root/.openclaw/workspace/stories/rhabdomyolysis-s01e01';
const prompts = JSON.parse(fss.readFileSync(path.join(PROJECT_DIR, 'production', 'prompts-v44.json')));

// 只渲染过渡镜头
const TARGET_SHOTS = ['T3', 'T7'];
const targetPrompts = prompts.filter(p => TARGET_SHOTS.includes(p.id));

console.log('========================================');
console.log('🎬 渲染过渡镜头（T3, T7）');
console.log('========================================');

async function submitRender(shot) {
  return new Promise((resolve, reject) => {
    const seed = Math.floor(Math.random() * 2147483647);
    
    const content = [{ type: "text", text: shot.prompt }];
    
    // 添加角色参考图
    const refImages = [];
    for (const charId of shot.characters) {
      const charCardPath = path.join(PROJECT_DIR, '..', '..', 'characters', charId, 'character-card.json');
      if (fss.existsSync(charCardPath)) {
        const charCard = JSON.parse(fss.readFileSync(charCardPath, 'utf8'));
        const portraits = charCard.generatedAssets?.referenceImages || [];
        for (const imgPath of portraits) {
          const fullPath = path.join(PROJECT_DIR, '..', '..', imgPath);
          if (fss.existsSync(fullPath)) {
            const base64 = fss.readFileSync(fullPath, 'base64');
            content.push({
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64}` },
              role: "reference_image"
            });
          }
        }
      }
    }
    
    const payload = {
      model: ENDPOINT,
      content: content,
      metadata: { max_new_tokens: 8192, seed: seed },
      ratio: MANDATORY_RATIO,
      duration: 5
    };
    
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: '/api/v3/contents/generations/tasks',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`API响应解析失败: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`\n📋 目标镜头: ${targetPrompts.map(p => p.id).join(', ')}`);
  
  const results = [];
  
  for (let i = 0; i < targetPrompts.length; i++) {
    const shot = targetPrompts[i];
    console.log(`\n🎬 [${i+1}/${targetPrompts.length}] ${shot.id}`);
    console.log(`   Prompt: ${shot.promptLength}字 | Duration: ${shot.duration}秒`);
    
    try {
      const result = await submitRender(shot);
      if (result.id) {
        console.log(`   ✅ 提交成功: ${result.id}`);
        results.push({ id: shot.id, taskId: result.id });
      } else {
        console.log(`   ❌ 提交失败: ${JSON.stringify(result)}`);
        results.push({ id: shot.id, error: result });
      }
    } catch (e) {
      console.log(`   ❌ 错误: ${e.message}`);
      results.push({ id: shot.id, error: e.message });
    }
    
    if (i < targetPrompts.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  const taskIdsPath = path.join(PROJECT_DIR, 'production', 'task-ids-transitions.json');
  fss.writeFileSync(taskIdsPath, JSON.stringify(results, null, 2));
  
  console.log('\n========================================');
  console.log('📊 提交结果');
  console.log('========================================');
  for (const r of results) {
    if (r.taskId) {
      console.log(`  ✅ ${r.id}: ${r.taskId}`);
    } else {
      console.log(`  ❌ ${r.id}: ${r.error || '未知错误'}`);
    }
  }
}

main();
