const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits';

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

const angles = [
  {
    id: 'front',
    name: '正面照',
    prompt: `Professional portrait photo, front-facing, head and shoulders, Chinese woman in casual comfortable home clothes, warm and gentle motherly smile, natural relaxed expression, soft warm indoor lighting, home living room background slightly blurred, round oval face with soft contours, fan-shaped double eyelids with almond-round eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown hair naturally styled, clean and approachable, photorealistic, high quality portrait, marketing-friendly appearance, warm and nurturing mother character`
  },
  {
    id: 'threeQuarter',
    name: '四分之三侧面',
    prompt: `Professional portrait photo, three-quarter angle (45 degrees), head and shoulders, Chinese woman in casual comfortable home clothes, warm gentle smile looking slightly to side, natural relaxed expression, soft warm indoor lighting, home living room background slightly blurred, round oval face with soft contours visible from angle, fan-shaped double eyelids with almond-round eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown hair naturally styled, clean and approachable, photorealistic, high quality portrait, marketing-friendly appearance, warm and nurturing mother character`
  },
  {
    id: 'side',
    name: '侧面照',
    prompt: `Professional portrait photo, side profile view, head and shoulders, Chinese woman in casual comfortable home clothes, elegant profile with soft facial contours, small straight nose with rounded tip, thin lips with slight upturn, smooth jawline, warm ivory skin tone, dark brown hair naturally styled, soft warm indoor lighting, clean and approachable, photorealistic, high quality portrait, marketing-friendly appearance, warm and nurturing mother character`
  },
  {
    id: 'closeup',
    name: '面部特写',
    prompt: `Professional portrait close-up, front-facing, tight crop on face, Chinese woman in casual comfortable home clothes, warm genuine motherly smile, round oval face with soft contours, fan-shaped double eyelids with almond-round eyes looking directly at camera, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone with subtle natural glow, calm and gentle expression, dark brown hair naturally styled, soft warm indoor lighting, clean background, photorealistic, high quality portrait, sharp focus on facial features, marketing-friendly appearance, warm and nurturing mother character`
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
      const imgResponse = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      
      const outputPath = path.join(OUTPUT_DIR, `chen-nurse-life-${angle.id}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log(`  ✅ ${angle.name} 完成 -> ${outputPath}`);
      return { success: true, path: outputPath, url: imageUrl };
    } else if (data.id) {
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
  console.log('🎬 生成陈女士生活照 4 角度');
  console.log('================================');
  console.log('参考照片:', REFERENCE_PATH);
  console.log('输出目录:', OUTPUT_DIR);
  console.log('');

  const results = [];
  for (let i = 0; i < angles.length; i++) {
    const result = await generateImage(angles[i], i);
    results.push(result);
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

  const report = {
    generatedAt: new Date().toISOString(),
    character: 'chen-nurse',
    characterName: '陈卓（陈女士/香香妈妈）',
    outfit: 'life/casual home clothes',
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
    path.join(OUTPUT_DIR, 'life-portraits-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log('✅ 报告已保存');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
