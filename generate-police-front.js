const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits';

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');

async function generateFront() {
  console.log('生成正面照 (front)...');
  
  // 修改 prompt：明确是专业证件照/工作照，非敏感内容
  const prompt = `Professional female police officer ID photo, front view, upper body portrait, Chinese woman wearing standard dark navy blue police uniform with formal police cap, white background, studio portrait lighting, official work identification photo style, formal and professional, the woman has round oval face with soft contours, fan-shaped double eyelids, small straight nose with rounded tip, thin lips with slight natural upturn, warm ivory skin tone, calm composed expression, dark brown hair neatly styled in standard police updo under cap, clean sharp focus, high resolution portrait, photorealistic, official documentation photograph`;

  const payload = {
    model: MODEL,
    prompt: prompt,
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
      
      const outputPath = path.join(OUTPUT_DIR, 'chen-nurse-police-front.png');
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log('✅ 正面照完成 ->', outputPath);
      return { success: true, path: outputPath };
    } else {
      console.log('❌ 失败:', JSON.stringify(data).slice(0, 300));
      return { success: false, error: data };
    }
  } catch (err) {
    console.log('❌ 错误:', err.message);
    return { success: false, error: err.message };
  }
}

generateFront().then(r => {
  console.log(r.success ? '✅ 成功' : '❌ 失败');
  process.exit(r.success ? 0 : 1);
});
