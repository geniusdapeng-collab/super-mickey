const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits-v3';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

// 核心面部特征（从参考图精确提取）
const FACE_ANCHOR = `round oval face with soft smooth contours, fan-shaped double eyelids with almond-shaped eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown shoulder-length hair with natural gentle waves`;

// 警服角度
const policeAngles = [
  {
    id: 'front',
    name: '警服-正面照',
    prompt: `Professional female police officer portrait, front view, head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap and badge, white clean background, studio portrait lighting, official work identification photo style, ${FACE_ANCHOR}, calm composed professional expression, photorealistic, high resolution, sharp focus, official documentation photograph`
  },
  {
    id: 'threeQuarter',
    name: '警服-四分之三侧面',
    prompt: `Professional female police officer portrait, three-quarter angle (45 degrees), head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap, ${FACE_ANCHOR}, looking slightly to the side, calm professional expression, soft studio lighting, clean background, photorealistic, high resolution portrait`
  },
  {
    id: 'side',
    name: '警服-侧面照',
    prompt: `Professional female police officer portrait, side profile view, head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap, ${FACE_ANCHOR}, elegant profile with smooth jawline, soft studio lighting, clean background, photorealistic, high resolution portrait`
  },
  {
    id: 'closeup',
    name: '警服-面部特写',
    prompt: `Professional female police officer portrait, front view, upper body and head, Chinese woman wearing standard dark navy blue police uniform with formal police cap, studio portrait lighting, white clean background, official work photo style, ${FACE_ANCHOR}, calm professional expression, looking at camera, photorealistic, high resolution, sharp focus on face`
  },
  {
    id: 'fullBody',
    name: '警服-全身像',
    prompt: `Professional female police officer full body portrait, standing pose, full body visible from head to toe, Chinese woman wearing standard dark navy blue police uniform with formal police cap, police belt and badge, black police shoes, ${FACE_ANCHOR}, confident professional stance, hands by sides, clean white background, studio lighting, photorealistic, high resolution, official documentation photograph`
  }
];

// 生活照角度
const lifeAngles = [
  {
    id: 'front',
    name: '生活-正面照',
    prompt: `Warm casual portrait photo, front view, head and shoulders, Chinese woman in comfortable home clothes, warm and gentle motherly smile, natural relaxed expression, soft warm indoor lighting, home living room background slightly blurred, ${FACE_ANCHOR}, clean and approachable, photorealistic, high quality portrait, marketing-friendly appearance, warm mother character`
  },
  {
    id: 'threeQuarter',
    name: '生活-四分之三侧面',
    prompt: `Warm casual portrait photo, three-quarter angle (45 degrees), head and shoulders, Chinese woman in comfortable home clothes, gentle smile looking slightly to side, natural relaxed expression, soft warm indoor lighting, cozy home background, ${FACE_ANCHOR}, photorealistic, high quality portrait, warm mother character`
  },
  {
    id: 'side',
    name: '生活-侧面照',
    prompt: `Warm casual portrait photo, side profile view, head and shoulders, Chinese woman in comfortable home clothes, elegant profile with soft facial contours, small straight nose with rounded tip, thin lips with slight upturn, smooth jawline, ${FACE_ANCHOR}, soft warm indoor lighting, clean home background, photorealistic, high quality portrait, warm mother character`
  },
  {
    id: 'closeup',
    name: '生活-面部特写',
    prompt: `Warm casual portrait close-up, front view, tight crop on face, Chinese woman in comfortable home clothes, warm genuine motherly smile, ${FACE_ANCHOR}, looking directly at camera with warm eyes, soft warm indoor lighting, clean background, photorealistic, high quality portrait, sharp focus on facial features, warm mother character`
  },
  {
    id: 'fullBody',
    name: '生活-全身像',
    prompt: `Warm casual full body portrait, standing pose, full body visible from head to toe, Chinese woman in comfortable home clothes, natural relaxed motherly stance, soft warm indoor lighting, cozy modern home interior background, ${FACE_ANCHOR}, warm approachable full body pose, photorealistic, high quality, marketing-friendly mother character for product advertisement`
  }
];

async function generateImage(angle, outfit, index, total) {
  console.log(`[${index + 1}/${total}] 生成 ${angle.name}...`);
  
  // 关键修复：使用 image 数组而非 reference_images
  // 参考图作为 data URL 放入 image 数组
  const payload = {
    model: MODEL,
    prompt: angle.prompt,
    image: [`data:image/jpeg;base64,${referenceImage}`],  // 正确参数！
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
      
      const outputPath = path.join(OUTPUT_DIR, `chen-nurse-${outfit}-${angle.id}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log(`  ✅ ${angle.name} 完成 -> ${outputPath}`);
      return { success: true, path: outputPath, url: imageUrl };
    } else {
      console.log(`  ❌ ${angle.name} 失败:`, JSON.stringify(data).slice(0, 200));
      return { success: false, error: data };
    }
  } catch (err) {
    console.log(`  ❌ ${angle.name} 错误:`, err.message);
    return { success: false, error: err.message };
  }
}

async function generateSet(angles, outfit, startIndex, total) {
  const results = [];
  for (let i = 0; i < angles.length; i++) {
    const result = await generateImage(angles[i], outfit, startIndex + i, total);
    results.push({ ...result, angle: angles[i] });
    if (i < angles.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  return results;
}

async function main() {
  console.log('🎬 生成陈女士定妆照 v3（修复 reference 参数）');
  console.log('================================');
  console.log('参考照片:', REFERENCE_PATH);
  console.log('输出目录:', OUTPUT_DIR);
  console.log('关键修复: 使用 image 数组替代 reference_images');
  console.log('');

  const total = policeAngles.length + lifeAngles.length;
  let currentIndex = 0;

  console.log('👮‍♀️ 生成警服定妆照...');
  const policeResults = await generateSet(policeAngles, 'police', currentIndex, total);
  currentIndex += policeAngles.length;
  console.log('');

  console.log('🏠 生成生活照...');
  const lifeResults = await generateSet(lifeAngles, 'life', currentIndex, total);
  console.log('');

  console.log('================================');
  console.log('📊 生成结果汇总:');
  console.log('');
  console.log('👮‍♀️ 警服定妆照:');
  policeResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.angle.name}: ${r.path || r.error}`);
  });
  console.log('');
  console.log('🏠 生活照:');
  lifeResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.angle.name}: ${r.path || r.error}`);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    character: 'chen-nurse',
    characterName: '陈卓（陈女士/香香妈妈）',
    referencePhoto: REFERENCE_PATH,
    apiParameter: 'image',  // 记录修复
    faceAnchor: FACE_ANCHOR,
    model: MODEL,
    policeResults: policeResults.map((r, i) => ({
      angle: r.angle.id,
      name: r.angle.name,
      prompt: r.angle.prompt,
      ...r
    })),
    lifeResults: lifeResults.map((r, i) => ({
      angle: r.angle.id,
      name: r.angle.name,
      prompt: r.angle.prompt,
      ...r
    }))
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'portraits-v3-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log('✅ 报告已保存');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
