const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits-v4';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

const FACE_ANCHOR = `round oval face with soft smooth contours, fan-shaped double eyelids with almond-shaped eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown hair`;

// 警服：头发扎起来（职业要求）
const policeAngles = [
  {
    id: 'front',
    name: '警服-正面照（扎发）',
    prompt: `Professional female police officer portrait, front view, head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap and badge, white clean background, studio portrait lighting, official work ID photo style, ${FACE_ANCHOR}, hair neatly tied back in a tight bun under police cap, no loose hair, professional regulation hairstyle, calm composed expression, photorealistic, high resolution, sharp focus, official documentation photograph`
  },
  {
    id: 'threeQuarter',
    name: '警服-四分之三侧面（扎发）',
    prompt: `Professional female police officer portrait, three-quarter angle (45 degrees), head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap, ${FACE_ANCHOR}, hair neatly tied back in a tight bun under cap, no loose hair, looking slightly to the side, calm professional expression, soft studio lighting, clean background, photorealistic, high resolution portrait`
  },
  {
    id: 'side',
    name: '警服-侧面照（扎发）',
    prompt: `Professional female police officer portrait, side profile view, head and shoulders, Chinese woman wearing standard dark navy blue police uniform with formal police cap, ${FACE_ANCHOR}, hair neatly tied back in a tight bun under cap, no loose hair visible, elegant profile with smooth jawline, soft studio lighting, clean background, photorealistic, high resolution portrait`
  },
  {
    id: 'closeup',
    name: '警服-面部特写（扎发）',
    prompt: `Professional female police officer portrait, front view, upper body and head, Chinese woman wearing standard dark navy blue police uniform with formal police cap, studio portrait lighting, white clean background, official work photo style, ${FACE_ANCHOR}, hair neatly tied back in a tight bun under cap, no loose hair, calm professional expression, looking at camera, photorealistic, high resolution, sharp focus on face`
  },
  {
    id: 'fullBody',
    name: '警服-全身像（扎发）',
    prompt: `Professional female police officer full body portrait, standing pose, full body visible from head to toe, Chinese woman wearing standard dark navy blue police uniform with formal police cap, police belt and badge, black police shoes, ${FACE_ANCHOR}, hair neatly tied back in a tight bun under cap, no loose hair, confident professional stance, hands by sides, clean white background, studio lighting, photorealistic, high resolution, official documentation photograph`
  }
];

// 生活照：夏天装束 + 修复瞳孔 + 多种姿势
const lifeAngles = [
  {
    id: 'front-summer',
    name: '生活-夏天正面照',
    prompt: `Warm casual summer portrait photo, front view, head and shoulders, Chinese woman wearing light breathable summer clothes, pastel colored short-sleeve top, warm and gentle motherly smile, natural relaxed expression, bright natural daylight, modern living room background, ${FACE_ANCHOR}, dark brown hair naturally styled, clean and approachable, photorealistic, high quality portrait, natural skin texture, marketing-friendly appearance, warm mother character, summer season vibe`
  },
  {
    id: 'threeQuarter-summer',
    name: '生活-夏天四分之三侧面',
    prompt: `Warm casual summer portrait photo, three-quarter angle (45 degrees), head and shoulders, Chinese woman wearing light breathable summer clothes, pastel colored short-sleeve top, gentle smile looking slightly to side, natural relaxed expression, bright natural daylight, cozy home background, ${FACE_ANCHOR}, dark brown hair naturally styled, photorealistic, high quality portrait, natural skin texture, warm mother character, summer season vibe`
  },
  {
    id: 'side-summer',
    name: '生活-夏天侧面照',
    prompt: `Warm casual summer portrait photo, side profile view, head and shoulders, Chinese woman wearing light breathable summer clothes, pastel colored short-sleeve top, elegant profile with soft facial contours, small straight nose, smooth jawline, ${FACE_ANCHOR}, dark brown hair naturally styled, bright natural daylight, clean home background, photorealistic, high quality portrait, natural skin texture, warm mother character, summer season vibe`
  },
  {
    id: 'closeup-summer',
    name: '生活-夏天面部特写',
    prompt: `Warm casual summer portrait close-up, front view, tight crop on face, Chinese woman wearing light summer clothes, warm genuine motherly smile, ${FACE_ANCHOR}, dark brown hair naturally styled, looking directly at camera with warm natural eyes, bright natural daylight, clean background, photorealistic, high quality portrait, natural skin texture, sharp focus on facial features, warm mother character, summer season vibe`
  },
  {
    id: 'fullBody-summer-fix',
    name: '生活-夏天全身像（瞳孔修复）',
    prompt: `Warm casual summer full body portrait, standing pose, full body visible from head to toe, Chinese woman wearing light breathable summer dress or pastel top with white pants, natural relaxed motherly stance, one hand on hip, bright natural daylight, modern home interior with large windows, ${FACE_ANCHOR}, dark brown hair naturally styled, warm approachable pose, natural skin texture, photorealistic, high quality, marketing-friendly mother character, summer season vibe, natural eye pupils with realistic catchlights`
  },
  // 新增姿势
  {
    id: 'sitting-fullBody',
    name: '生活-坐姿全身像',
    prompt: `Warm casual summer portrait, sitting pose on sofa, full body visible from head to toe, Chinese woman wearing light breathable summer clothes, pastel colored outfit, relaxed sitting posture with hands on knees, bright natural daylight, modern cozy living room, ${FACE_ANCHOR}, dark brown hair naturally styled, warm approachable expression, natural skin texture, photorealistic, high quality, marketing-friendly mother character, summer season vibe`
  },
  {
    id: 'walking-fullBody',
    name: '生活-行走全身像',
    prompt: `Warm casual summer portrait, walking pose, full body visible from head to toe, Chinese woman wearing light breathable summer clothes, pastel colored outfit, natural walking stride in modern home hallway, bright natural daylight, ${FACE_ANCHOR}, dark brown hair naturally styled with gentle movement, warm approachable expression, natural skin texture, photorealistic, high quality, marketing-friendly mother character, summer season vibe, dynamic natural pose`
  },
  {
    id: 'holdingBaby-fullBody',
    name: '生活-抱宝宝全身像',
    prompt: `Warm casual summer portrait, standing pose holding baby, full body visible from head to toe, Chinese woman wearing light breathable summer clothes, pastel colored outfit, gently holding a baby in arms, loving motherly expression, bright natural daylight, modern nursery or living room, ${FACE_ANCHOR}, dark brown hair naturally styled, warm tender expression, natural skin texture, photorealistic, high quality, marketing-friendly mother character, summer season vibe, mother and baby bonding moment`
  }
];

async function generateImage(angle, outfit, index, total) {
  console.log(`[${index + 1}/${total}] 生成 ${angle.name}...`);
  
  const payload = {
    model: MODEL,
    prompt: angle.prompt,
    image: [`data:image/jpeg;base64,${referenceImage}`],
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
  console.log('🎬 生成陈女士定妆照 v4（警服扎发+生活夏天+更多姿势）');
  console.log('================================');
  console.log('参考照片:', REFERENCE_PATH);
  console.log('输出目录:', OUTPUT_DIR);
  console.log('');

  const total = policeAngles.length + lifeAngles.length;
  let currentIndex = 0;

  console.log('👮‍♀️ 生成警服定妆照（头发扎起来）...');
  const policeResults = await generateSet(policeAngles, 'police', currentIndex, total);
  currentIndex += policeAngles.length;
  console.log('');

  console.log('🏠 生成生活照（夏天装束+多姿势）...');
  const lifeResults = await generateSet(lifeAngles, 'life', currentIndex, total);
  console.log('');

  console.log('================================');
  console.log('📊 生成结果汇总:');
  console.log('');
  console.log('👮‍♀️ 警服定妆照（扎发）:');
  policeResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.angle.name}: ${r.path || r.error}`);
  });
  console.log('');
  console.log('🏠 生活照（夏天+多姿势）:');
  lifeResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.angle.name}: ${r.path || r.error}`);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    character: 'chen-nurse',
    characterName: '陈卓（陈女士/香香妈妈）',
    referencePhoto: REFERENCE_PATH,
    apiParameter: 'image',
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
    path.join(OUTPUT_DIR, 'portraits-v4-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('');
  console.log('✅ 报告已保存');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
