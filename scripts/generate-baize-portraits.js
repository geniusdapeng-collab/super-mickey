#!/usr/bin/env node
/**
 * 白泽定妆照生成脚本
 * 使用 Seedream 2.0-lite 生成4个角度
 */
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f'; // Seedream-5.0-lite

const ANGLES = [
  { name: 'front', desc: '正面全身照，面对镜头' },
  { name: 'threeQuarter', desc: '四分之三侧面，展现身体曲线' },
  { name: 'closeup', desc: '面部特写，突出琥珀色眼睛和羊角' },
  { name: 'side', desc: '纯侧面轮廓，展现狮身和羊角弧度' }
];

const BASE_PROMPT = `Nirath神兽白泽，通体雪白的神兽，狮子的身体，弯曲的羊角，琥珀色温润眼睛，神话生物风格，奇幻插画风格，高细节，8K渲染，纯白色毛发，角尖散发淡淡金色光晕，背景为冰蓝色灵镜湖畔，画面干净，主体突出，电影级光影`;

async function generateImage(angleDesc, outputPath) {
  const prompt = `${BASE_PROMPT}，${angleDesc}。固定构图，无裁切，完整主体在画面中央。`;
  
  const body = JSON.stringify({
    model: MODEL,
    prompt: prompt,
    width: 1024,
    height: 1024,
    seed: Math.floor(Math.random() * 1000000)
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ENDPOINT,
      path: '/api/v3/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data[0] && json.data[0].url) {
            resolve(json.data[0].url);
          } else {
            reject(new Error(`API返回无效: ${JSON.stringify(json).slice(0, 200)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => fs.writeFile(outputPath, Buffer.concat(chunks)).then(resolve, reject));
        }).on('error', reject);
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => fs.writeFile(outputPath, Buffer.concat(chunks)).then(resolve, reject));
      }
    }).on('error', reject);
  });
}

async function main() {
  const charDir = '/root/.openclaw/workspace/characters/bai-ze';
  await fs.mkdir(charDir, { recursive: true });

  const results = [];
  for (const angle of ANGLES) {
    console.log(`[${new Date().toISOString()}] 生成 ${angle.name}...`);
    try {
      const url = await generateImage(angle.desc, path.join(charDir, `${angle.name}.png`));
      console.log(`[${new Date().toISOString()}] ${angle.name} URL: ${url.slice(0, 60)}...`);
      
      await downloadImage(url, path.join(charDir, `${angle.name}.png`));
      console.log(`[${new Date().toISOString()}] ${angle.name} 下载完成`);
      results.push({ angle: angle.name, success: true, path: path.join(charDir, `${angle.name}.png`) });
    } catch (e) {
      console.error(`[${new Date().toISOString()}] ${angle.name} 失败: ${e.message}`);
      results.push({ angle: angle.name, success: false, error: e.message });
    }
    // 间隔1秒，避免并发限制
    await new Promise(r => setTimeout(r, 1000));
  }

  // 更新 character-card.json
  const cardPath = path.join(charDir, 'character-card.json');
  const card = JSON.parse(await fs.readFile(cardPath, 'utf8'));
  card.generatedAssets = {
    portraits: results.filter(r => r.success).map(r => ({
      angle: r.angle,
      path: r.path,
      generatedAt: new Date().toISOString()
    })),
    referenceImages: results.filter(r => r.success).map(r => r.path)
  };
  await fs.writeFile(cardPath, JSON.stringify(card, null, 2));
  
  console.log(`\n✅ 白泽定妆照生成完成！`);
  console.log(results.map(r => `${r.angle}: ${r.success ? '✅' : '❌'} ${r.error || ''}`).join('\n'));
}

main().catch(e => {
  console.error('❌ 生成失败:', e);
  process.exit(1);
});
