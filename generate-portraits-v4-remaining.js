const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits-v4';

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');
const FACE_ANCHOR = `round oval face with soft smooth contours, fan-shaped double eyelids with almond-shaped eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown hair`;

const remainingAngles = [
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

async function generateImage(angle, index) {
  console.log(`[${index + 1}/5] 生成 ${angle.name}...`);
  
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
      
      const outputPath = path.join(OUTPUT_DIR, `chen-nurse-life-${angle.id}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log(`  ✅ ${angle.name} 完成 -> ${outputPath}`);
      return { success: true, path: outputPath };
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
  console.log('🎬 生成剩余生活照（5张）');
  console.log('================================');
  
  for (let i = 0; i < remainingAngles.length; i++) {
    await generateImage(remainingAngles[i], i);
    if (i < remainingAngles.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('');
  console.log('✅ 全部完成！');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
