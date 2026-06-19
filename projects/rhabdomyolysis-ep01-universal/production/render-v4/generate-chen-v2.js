const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

// Seedream API配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f';

// 重新生成陈女士更写实端庄版
const prompt = `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理与皮下血管隐约可见，次表面散射使皮肤通透真实，亚洲面孔中国年轻女性警官，28岁，\n端庄站姿挺拔如松肩平背直体现军人气质，鹅蛋脸轮廓柔和但不失坚毅感，深棕色杏仁眼双眼皮眼神坚定有力不怒自威，黑色短发低马尾一丝不苟发尾微卷刘海整齐向右露出光洁额头，\n深蓝色警服外套笔挺无褶皱肩章银色警衔闪闪发光金属质感，左胸警号金属牌01245清晰可见，右胸警徽立体精致，白色衬衫领口洁白无瑕深色领带系法标准规范，\n深蓝色警帽佩戴端正帽徽银色闪亮帽檐水平，表情庄重严肃嘴角微抿展现专业威严，淡粉色唇膏气色健康肤色自然偏白有血色，\n正面全身视角，纯白背景，摄影棚三点布光（主光+补光+轮廓光），\n超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`;

const payload = {
  model: MODEL,
  prompt: prompt,
  size: '2K'
};

const postData = JSON.stringify(payload);

const options = {
  hostname: API_ENDPOINT,
  port: 443,
  path: '/api/v3/images/generations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + API_KEY,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.data && result.data[0] && result.data[0].url) {
        const imageUrl = result.data[0].url;
        console.log('✅ 陈女士v2-端庄版 生成成功');
        console.log('URL:', imageUrl.substring(0, 60) + '...');
        
        // 下载
        const outputPath = '/root/.openclaw/workspace/characters/chen-nurse/portraits/chen-cg-v2-dignified.png';
        const file = fss.createWriteStream(outputPath);
        https.get(imageUrl, (res2) => {
          res2.pipe(file);
          file.on('finish', () => {
            const size = fss.statSync(outputPath).size;
            console.log('✅ 下载完成:', outputPath, Math.round(size/1024) + 'KB');
          });
        });
      } else {
        console.error('❌ 生成失败:', result);
      }
    } catch (e) {
      console.error('❌ 错误:', e);
    }
  });
});

req.on('error', (e) => console.error('请求错误:', e));
req.write(postData);
req.end();
