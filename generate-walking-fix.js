const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const MODEL = 'ep-20260518004750-lz76f';

const REFERENCE_PATH = '/root/.openclaw/workspace/characters/chen-nurse/reference-photos/reference-real.jpg';
const OUTPUT_DIR = '/root/.openclaw/workspace/characters/chen-nurse/portraits-v4';

const referenceImage = fs.readFileSync(REFERENCE_PATH).toString('base64');
const FACE_ANCHOR = `round oval face with soft smooth contours, fan-shaped double eyelids with almond-shaped eyes, small straight nose with rounded tip, thin lips with natural slight upturn, warm ivory skin tone, dark brown hair`;

async function generate() {
  console.log('重新生成行走全身像（清晰度修复版）...');
  
  // 关键修复：
  // 1. 使用 2K 分辨率提高清晰度
  // 2. 改为中景+全身，面部更大更清晰
  // 3. 强调面部细节和眼睛清晰度
  // 4. 增加 "sharp focus on face" 等关键词
  const prompt = `Warm casual summer portrait, medium-full shot showing body from knees up to head, Chinese woman wearing light breathable pastel summer dress, natural walking stride in modern bright home hallway with large windows, bright natural daylight, ${FACE_ANCHOR}, dark brown hair naturally styled with gentle movement, warm approachable expression with clear visible face, natural skin texture, photorealistic, high quality, sharp focus on face and eyes, detailed facial features, clear eyes with natural catchlights, marketing-friendly mother character, summer season vibe, dynamic natural pose, 8k resolution, ultra detailed`;

  const payload = {
    model: MODEL,
    prompt: prompt,
    image: [`data:image/jpeg;base64,${referenceImage}`],
    size: '2048x2048',  // 2K 分辨率
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
      
      const outputPath = path.join(OUTPUT_DIR, 'chen-nurse-life-walking-fullBody-v2.png');
      fs.writeFileSync(outputPath, imgBuffer);
      
      console.log('✅ 行走全身像(修复版)完成 ->', outputPath);
      return true;
    } else {
      console.log('❌ 失败:', JSON.stringify(data).slice(0, 300));
      return false;
    }
  } catch (err) {
    console.log('❌ 错误:', err.message);
    return false;
  }
}

generate();
