const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

// Seedream API配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f';

// 全部角色多角度配置
const characters = [
  {
    id: 'xiaoG',
    name: '小G',
    basePrompt: `超写实3D数字人渲染，CG角色设计，精细皮肤纹理与毛孔级清晰度，逼真光影与次表面散射，亚洲面孔中国8岁男孩，圆脸婴儿肥，内双棕色大眼睛，黑色短发蓬松额前呆毛翘起，深绿色探险夹克肘部补丁，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针表盘裂痕，背包彩色编织绳结，健康小麦色皮肤手掌薄茧，\n{angle}，纯白背景，摄影棚布光，超高清8K细节，电影级CG渲染，绝非真人照片，绝非卡通动漫`,
    angles: [
      { name: 'threeQuarter', angleDesc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', angleDesc: '面部特写，上半身，表情清晰，棕色瞳孔细节' }
    ]
  },
  {
    id: 'chen-nurse',
    name: '陈女士',
    basePrompt: `超写实3D数字人渲染，CG角色设计，精细皮肤纹理与毛孔级清晰度，逼真光影与次表面散射，亚洲面孔中国年轻女性28岁，鹅蛋脸杏仁眼双眼皮，黑色短发低马尾发尾微卷，刘海向右梳理，深蓝色警服外套笔挺，肩章银色警衔闪闪发光，左胸警号金属牌01245，右胸警徽，白色衬衫深色领带，深蓝色警帽佩戴端正帽徽银色，专业亲和微笑淡粉色唇膏，肤色自然偏白，\n{angle}，纯白背景，摄影棚布光，超高清8K细节，电影级CG渲染，绝非真人照片，绝非卡通动漫`,
    angles: [
      { name: 'threeQuarter', angleDesc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', angleDesc: '面部特写，上半身，表情清晰，深棕色杏仁眼细节' }
    ]
  },
  {
    id: 'coach-li',
    name: '李明教练',
    basePrompt: `超写实3D数字人渲染，CG角色设计，精细皮肤纹理与毛孔级清晰度，逼真光影与次表面散射，亚洲面孔中国年轻男性32岁，方圆脸深棕色单眼皮，黑色短发利落两侧剃短顶部微蓬松，深灰色运动polo衫左胸白色运动康复汉字标识，袖子卷至肘部露出结实小臂，黑色运动长裤侧边灰色条纹，白色运动鞋，阳光自信微笑下巴淡淡胡茬，肤色健康小麦色，左手黑色运动手表，右手灰色护腕，银色哨子挂脖，\n{angle}，纯白背景，摄影棚布光，超高清8K细节，电影级CG渲染，绝非真人照片，绝非卡通动漫`,
    angles: [
      { name: 'threeQuarter', angleDesc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', angleDesc: '面部特写，上半身，表情清晰，深棕色单眼皮细节' }
    ]
  }
];

// 已有正面照路径（需要确认）
const existingFrontPaths = {
  'xiaoG': '/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-v8-production-front.png',
  'chen-nurse': '/root/.openclaw/workspace/characters/chen-nurse/portraits/chen-cg-v1-front.png',
  'coach-li': '/root/.openclaw/workspace/characters/coach-li/portraits/coach-cg-v1-front.png'
};

function generatePortrait(char, angle) {
  return new Promise((resolve, reject) => {
    const prompt = char.basePrompt.replace('{angle}', angle.angleDesc);
    
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
            resolve(result.data[0].url);
          } else {
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
        console.log('   ✅ 下载完成: ' + outputPath + ' (' + Math.round(size/1024) + 'KB)');
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎨 批量生成CG版角色多角定妆照\n');
  
  for (const char of characters) {
    console.log('📸 ' + char.name + ':');
    
    for (const angle of char.angles) {
      const outputPath = '/root/.openclaw/workspace/characters/' + char.id + '/portraits/' + char.id + '-cg-v1-' + angle.name + '.png';
      
      try {
        console.log('  生成 ' + angle.name + ' 角度...');
        const imageUrl = await generatePortrait(char, angle);
        await downloadImage(imageUrl, outputPath);
        await new Promise(r => setTimeout(r, 3000)); // 间隔3秒避免限流
      } catch (e) {
        console.error('  ❌ ' + angle.name + ' 失败:', e.message || e);
      }
    }
    console.log('');
  }
  
  console.log('🎉 全部生成完成！');
  console.log('\n📁 定妆照文件汇总:');
  
  const allPortraits = [];
  for (const char of characters) {
    console.log('\n' + char.name + ':');
    // 正面
    const frontPath = existingFrontPaths[char.id];
    if (fss.existsSync(frontPath)) {
      console.log('  front: ' + frontPath);
      allPortraits.push(frontPath);
    }
    // 3/4侧面
    const tqPath = '/root/.openclaw/workspace/characters/' + char.id + '/portraits/' + char.id + '-cg-v1-threeQuarter.png';
    if (fss.existsSync(tqPath)) {
      console.log('  threeQuarter: ' + tqPath);
      allPortraits.push(tqPath);
    }
    // 特写
    const cuPath = '/root/.openclaw/workspace/characters/' + char.id + '/portraits/' + char.id + '-cg-v1-closeup.png';
    if (fss.existsSync(cuPath)) {
      console.log('  closeup: ' + cuPath);
      allPortraits.push(cuPath);
    }
  }
  
  console.log('\n📊 总计: ' + allPortraits.length + ' 张定妆照');
}

main().catch(console.error);
