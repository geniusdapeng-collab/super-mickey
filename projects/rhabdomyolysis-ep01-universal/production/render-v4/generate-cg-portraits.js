const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

// Seedream API配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f'; // Seedream 5.0 自定义接入点

// 角色配置
const characters = [
  {
    id: 'chen-nurse',
    name: '陈女士',
    prompt: `超写实3D数字人渲染，CG角色设计，精细皮肤纹理与毛孔级清晰度，逼真光影与次表面散射，亚洲面孔中国年轻女性，28岁，鹅蛋脸，深棕色杏仁眼双眼皮，眼神温柔专业，黑色短发低马尾发尾微卷，刘海向右梳理，\n蓝色警服外套笔挺，肩章银色警衔，左胸警号金属牌，右胸警徽，白色衬衫深色领带，深蓝色警帽佩戴端正帽徽银色，\n专业亲和微笑，淡粉色唇膏，肤色自然偏白，\n正面全身视角，纯白背景，摄影棚布光，\n超高清8K细节，电影级CG渲染，绝非真人照片，绝非卡通动漫`,
    size: '2K',
    outputPath: '/root/.openclaw/workspace/characters/chen-nurse/portraits/chen-cg-v1-front.png'
  },
  {
    id: 'coach-li',
    name: '李明教练',
    prompt: `超写实3D数字人渲染，CG角色设计，精细皮肤纹理与毛孔级清晰度，逼真光影与次表面散射，亚洲面孔中国年轻男性，32岁，方圆脸，深棕色单眼皮眼神坚定专业，黑色短发利落两侧剃短顶部微蓬松，\n深灰色运动polo衫左胸白色运动康复汉字标识，袖子卷至肘部露出结实小臂，黑色运动长裤侧边灰色条纹，白色运动鞋，\n阳光自信微笑，下巴淡淡胡茬，肤色健康小麦色，\n正面全身视角，纯白背景，摄影棚布光，\n超高清8K细节，电影级CG渲染，绝非真人照片，绝非卡通动漫`,
    size: '2K',
    outputPath: '/root/.openclaw/workspace/characters/coach-li/portraits/coach-cg-v1-front.png'
  }
];

function generatePortrait(char) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: MODEL,
      prompt: char.prompt,
      size: char.size
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
            console.log('✅ ' + char.name + ' 生成成功');
            console.log('   URL: ' + imageUrl.substring(0, 60) + '...');
            resolve({ char, imageUrl });
          } else {
            console.error('❌ ' + char.name + ' 生成失败:', result);
            reject(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(outputPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fss.statSync(outputPath).size;
        console.log('   下载完成: ' + outputPath + ' (' + Math.round(size/1024) + 'KB)');
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎨 开始生成超写实CG版角色定妆照\n');
  
  for (const char of characters) {
    try {
      console.log('📸 生成 ' + char.name + '...');
      const result = await generatePortrait(char);
      await downloadImage(result.imageUrl, char.outputPath);
      console.log('');
    } catch (e) {
      console.error('❌ ' + char.name + ' 错误:', e.message || e);
    }
  }
  
  console.log('🎉 全部生成完成！');
}

main().catch(console.error);
