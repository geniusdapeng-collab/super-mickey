const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const MODEL = 'ep-20260518004750-lz76f';

// 先生成正面照基准（黄色衣服 + 真人风格）
const frontPrompt = `极致写实照片级渲染，绝对真实摄影质感，绝非卡通绝非游戏角色，真实照片风格，中国杭州8岁男孩，典型中国南方小男孩长相，圆脸婴儿肥，内双棕色眼睛不大但清澈，黑色短发自然蓬松额前呆毛，鼻梁不高秀气，嘴唇偏薄，健康小麦色皮肤，穿亮黄色连帽外套（帽檐灰色抽绳），橙色条纹装饰，深蓝色牛仔裤，白色运动鞋，身高1米25标准8岁男孩身材，头身比约1:5，正常儿童比例不夸张，站姿自然放松，正面全身，纯白背景，自然柔和光，真实儿童摄影，毛孔可见皮肤纹理真实，接近真实照片`;

function generate(prompt, referenceBase64) {
  const payload = referenceBase64 ? JSON.stringify({
    model: MODEL,
    prompt: prompt,
    size: '2K',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,' + referenceBase64 }, role: 'reference_image' }
    ]
  }) : JSON.stringify({
    model: MODEL,
    prompt: prompt,
    size: '2K'
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com', port: 443,
      path: '/api/v3/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.data?.[0]?.url) resolve(result.data[0].url);
          else reject(result);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function download(url, path) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(path);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ ' + path.split('/').pop() + ' (' + Math.round(fss.statSync(path).size/1024) + 'KB)');
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎨 小G彻底重生成 - 黄色衣服 + 真人风格\n');
  
  // 1. 生成正面照基准
  console.log('📸 第一步：生成正面照基准（黄色衣服版）...');
  const frontUrl = await generate(frontPrompt);
  const frontPath = '/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-cg-v3-front.png';
  await download(frontUrl, frontPath);
  const frontBase64 = fss.readFileSync(frontPath).toString('base64');
  console.log('📸 正面照基准已生成，作为其他角度的参考图\n');
  
  // 2. 用正面照参考生成其他角度
  const angles = [
    { name: 'threeQuarter', desc: '3/4侧面视角经典人像角度，面部转向左侧45度，同一个男孩同一张脸同一件衣服' },
    { name: 'closeup', desc: '面部特写上半身胸部以上，同一个男孩同一张脸，表情自然微笑' },
    { name: 'side', desc: '侧面90度视角站立姿态自然，同一个男孩同一张脸的侧面轮廓，可以看到全身' }
  ];
  
  for (const angle of angles) {
    const prompt = `极致写实照片级渲染，绝对真实摄影质感，绝非卡通绝非游戏角色，真实照片风格，中国杭州8岁男孩，典型中国南方小男孩长相，圆脸婴儿肥，内双棕色眼睛不大但清澈，黑色短发自然蓬松额前呆毛，鼻梁不高秀气，嘴唇偏薄，健康小麦色皮肤，穿亮黄色连帽外套（帽檐灰色抽绳），橙色条纹装饰，深蓝色牛仔裤，白色运动鞋，身高1米25标准8岁男孩身材，头身比约1:5，正常儿童比例不夸张，${angle.desc}，纯白背景，自然柔和光，真实儿童摄影，毛孔可见皮肤纹理真实，接近真实照片`;
    
    const path = `/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-cg-v3-${angle.name}.png`;
    try {
      console.log('📸 生成 ' + angle.name + ' (使用正面照参考)...');
      const url = await generate(prompt, frontBase64);
      await download(url, path);
      await new Promise(r => setTimeout(r, 5000));
    } catch(e) {
      console.error('❌ ' + angle.name + ' 失败:', e.message || e);
    }
  }
  
  console.log('\n🎉 全部完成！');
}

main().catch(console.error);
