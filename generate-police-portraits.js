const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f'; // Seedream-5.0-lite

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits';

// 读取参考照片为 base64
const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

// 4个角度定义
const angles = [
  {
    id: 'front',
    name: '正面照',
    prompt: `Professional police portrait photo, front-facing, head and shoulders, Chinese female police officer in formal dark blue police uniform with cap, round oval face with soft contours, fan-shaped double eyelids with almond-round eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, calm and composed expression, dark brown hair in standard police updo, clean background, studio lighting, official ID photo style, highly detailed, photorealistic, 4K`
  },
  {
    id: 'threeQuarter',
    name: '四分之三侧面',
    prompt: `Professional police portrait photo, three-quarter angle (45 degrees), head and shoulders, Chinese female police officer in formal dark blue police uniform with cap, round oval face with soft contours visible from angle, fan-shaped double eyelids with almond-round eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, calm and composed expression, dark brown hair in standard police updo, clean background, studio lighting, official portrait style, highly detailed, photorealistic, 4K`
  },
  {
    id: 'side',
    name: '侧面照',
    prompt: `Professional police portrait photo, side profile view, head and shoulders, Chinese female police officer in formal dark blue police uniform with cap, showing elegant profile with soft facial contours, straight nose bridge with rounded tip, thin lips with slight upturn, smooth jawline, warm ivory skin tone, dark brown hair in standard police updo tucked under cap, clean background, studio lighting, official portrait style, highly detailed, photorealistic, 4K`
  },
  {
    id: 'closeup',
    name: '面部特写',
    prompt: `Professional police portrait close-up, front-facing, tight crop on face, Chinese female police officer in formal dark blue police uniform with cap visible, round oval face with soft contours, fan-shaped double eyelids with almond-round eyes looking directly at camera, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone with subtle natural glow, calm and composed gentle expression, dark brown hair in standard police updo, clean background, studio lighting, official ID photo style, highly detailed, photorealistic, 4K, sharp focus on facial features`
  }
];

async function generateImage(angle, index) {
  console.log(`[${index + 1}/4] 生成 ${angle.name} (${angle.id})...`);
  
  const payload = {
    model: MODEL,
    prompt: angle.prompt,
    reference_images: [
      {
        image_url: `data:image/jpeg;base64,${referenceImage}`,
        reference_type: 'character'
      }
    ],
    size: '1920x1920',
    n: 1
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (data.data && data.data[0] && data.data[0].url) {
      const imageUrl = data.data[0].url;
      
      // 下载图片
      const imgResponse = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      
      const outputPath = path.join(OUTPUT_DIR, `chen-nurse-police-${angle.id}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log(`  ✅ ${angle.name} 完成 -> ${outputPath}`);
      return { success: true, path: outputPath, url: imageUrl };
    } else if (data.id) {
      // 异步任务，需要轮询
      console.log(`  ⏳ ${angle.name} 异步任务，taskId: ${data.id}`);
      return { success: false, taskId: data.id, angle: angle.id };
    } else {
      console.log(`  ❌ ${angle.name} 失败:`, JSON.stringify(data).slice(0, 200));
      return { success: false, error: data };
    }
  } catch (err) {
    console.log(`  ❌ ${angle.name} 错误:`, err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🎬 生成陈女士警服定妆照 4 角度');
  console.log('================================');
  console.log('参考照片:', REFERENCE_PATH);
  console.log('输出目录:', OUTPUT_DIR);
  console.log('模型:', MODEL);
  console.log('');

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = [];
  for (let i = 0; i < angles.length; i++) {
    const result = await generateImage(angles[i], i);
    results.push(result);
    
    // 间隔2秒，避免并发限制
    if (i < angles.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('');
  console.log('================================');
  console.log('📊 生成结果:');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : r.taskId ? '⏳' : '❌';
    console.log(`  ${status} ${angles[i].name}: ${r.path || r.taskId || r.error}`);
  });

  // 保存报告
  const report = {
    generatedAt: new Date().toISOString(),
    character: 'chen-nurse',
    characterName: '陈卓（陈女士/香香妈妈）',
    outfit: 'police uniform',
    referencePhoto: REFERENCE_PATH,
    model: MODEL,
    results: results.map((r, i) => ({
      angle: angles[i].id,
      name: angles[i].name,
      prompt: angles[i].prompt,
      ...r
    }))
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'police-portraits-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log('✅ 报告已保存');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
