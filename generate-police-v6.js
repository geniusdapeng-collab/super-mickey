const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits-v6';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

const policeAngles = [
  {
    id: 'front',
    name: '警服-正面照（发髻+帽子）',
    prompt: `Preserve this exact person's face identity and all facial features completely unchanged. This is the same person wearing a standard Chinese police officer uniform with formal police cap. Her hair is neatly tied back in a tight professional bun under the police cap, no loose hair visible, regulation hairstyle for female officers. Professional ID photo style, front view, head and shoulders, white clean background, studio lighting, photorealistic, high resolution, sharp focus. Keep the exact same face, eyes, nose, mouth, skin tone as the reference photo. Only change the clothing to police uniform and hairstyle to professional bun under cap.`,
    negative_prompt: 'different face, changed facial features, different person, altered appearance, loose hair, hair down, hair flowing, casual hairstyle'
  },
  {
    id: 'threeQuarter',
    name: '警服-四分之三侧面（发髻+帽子）',
    prompt: `Preserve this exact person's face identity and all facial features completely unchanged. This is the same person wearing a standard Chinese police officer uniform with formal police cap. Her hair is neatly tied back in a tight professional bun under the police cap, no loose hair visible, regulation hairstyle for female officers. Three-quarter angle (45 degrees), head and shoulders, looking slightly to the side, calm professional expression, soft studio lighting, clean background. Keep the exact same face, eyes, nose, mouth, skin tone as the reference photo. Only change the clothing to police uniform and hairstyle to professional bun under cap.`,
    negative_prompt: 'different face, changed facial features, different person, altered appearance, loose hair, hair down, hair flowing, casual hairstyle'
  },
  {
    id: 'side',
    name: '警服-侧面照（发髻+帽子）',
    prompt: `Preserve this exact person's face identity and all facial features completely unchanged. This is the same person wearing a standard Chinese police officer uniform with formal police cap. Her hair is neatly tied back in a tight professional bun under the police cap, no loose hair visible at all, regulation hairstyle for female officers. Side profile view, head and shoulders, elegant profile with smooth jawline, soft studio lighting, clean background. Keep the exact same face shape, nose, lips, skin tone as the reference photo. Only change the clothing to police uniform and hairstyle to professional bun under cap.`,
    negative_prompt: 'different face, changed facial features, different person, altered appearance, loose hair, hair down, hair flowing, casual hairstyle'
  },
  {
    id: 'closeup',
    name: '警服-面部特写（发髻+帽子）',
    prompt: `Preserve this exact person's face identity and all facial features completely unchanged. This is the same person wearing a standard Chinese police officer uniform with formal police cap. Her hair is neatly tied back in a tight professional bun under the police cap, no loose hair visible, regulation hairstyle for female officers. Front view, upper body and head, studio portrait lighting, white clean background. Keep the exact same face, eyes, nose, mouth, skin tone as the reference photo. Only change the clothing to police uniform and hairstyle to professional bun under cap.`,
    negative_prompt: 'different face, changed facial features, different person, altered appearance, loose hair, hair down, hair flowing, casual hairstyle'
  },
  {
    id: 'fullBody',
    name: '警服-全身像（发髻+帽子）',
    prompt: `Preserve this exact person's face identity and all facial features completely unchanged. This is the same person wearing a standard Chinese police officer uniform with formal police cap. Her hair is neatly tied back in a tight professional bun under the police cap, no loose hair visible, regulation hairstyle for female officers. Full body portrait, standing pose, confident professional stance, hands by sides, clean white background, studio lighting. Keep the exact same face, eyes, nose, mouth, skin tone as the reference photo. Only change the clothing to police uniform and hairstyle to professional bun under cap.`,
    negative_prompt: 'different face, changed facial features, different person, altered appearance, loose hair, hair down, hair flowing, casual hairstyle'
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

  if (angle.negative_prompt) {
    payload.negative_prompt = angle.negative_prompt;
  }

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
      
      const outputPath = path.join(OUTPUT_DIR, `chen-nurse-police-${angle.id}.png`);
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
  console.log('🎬 生成警服定妆照 v6（发髻+帽子 + likeness优化）');
  console.log('================================');
  console.log('关键策略: Preserve face identity + 发髻发型');
  console.log('');

  for (let i = 0; i < policeAngles.length; i++) {
    await generateImage(policeAngles[i], i);
    if (i < policeAngles.length - 1) {
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
