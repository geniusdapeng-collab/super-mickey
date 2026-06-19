const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f';

// 角色配置 - v2版超写实CG风格
const characters = [
  {
    id: 'xiaoG',
    name: '小G',
    basePrompt: `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理与皮下血管隐约可见，次表面散射使皮肤通透真实，亚洲面孔中国8岁男孩，圆脸婴儿肥，内双棕色大眼睛瞳孔清澈，黑色短发蓬松额前呆毛翘起，深绿色探险夹克肘部补丁拉链磨损，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针表盘裂痕，背包彩色编织绳结，健康小麦色皮肤，{angle}，纯白背景，摄影棚三点布光，超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`,
    angles: [
      { name: 'front', desc: '正面全身视角，站立姿态标准，全身可见，面部清晰' },
      { name: 'threeQuarter', desc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', desc: '面部特写，上半身，表情清晰，棕色瞳孔细节' },
      { name: 'side', desc: '侧面90度视角，行走或站立姿态，侧面轮廓清晰' }
    ],
    outputDir: '/root/.openclaw/workspace/characters/xiaoG/portraits'
  },
  {
    id: 'chen-nurse',
    name: '陈女士v2',
    basePrompt: `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理与皮下血管隐约可见，次表面散射使皮肤通透真实，亚洲面孔中国年轻女性警官，28岁，端庄站姿挺拔如松肩平背直体现军人气质，鹅蛋脸轮廓柔和但不失坚毅感，深棕色杏仁眼双眼皮眼神坚定有力不怒自威，黑色短发低马尾一丝不苟发尾微卷刘海整齐向右，深蓝色警服外套笔挺无褶皱肩章银色警衔闪闪发光金属质感，左胸警号金属牌01245清晰可见，右胸警徽立体精致，白色衬衫领口洁白无瑕深色领带系法标准规范，深蓝色警帽佩戴端正帽徽银色闪亮帽檐水平，表情庄重严肃嘴角微抿展现专业威严，淡粉色唇膏气色健康肤色自然偏白有血色，{angle}，纯白背景，摄影棚三点布光（主光+补光+轮廓光），超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`,
    angles: [
      { name: 'front', desc: '正面全身视角，站立姿态标准挺拔如松，全身可见，面部清晰' },
      { name: 'threeQuarter', desc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', desc: '面部特写，上半身，表情清晰，深棕色杏仁眼细节' },
      { name: 'side', desc: '侧面90度视角，行走或站立姿态，警帽侧面轮廓' }
    ],
    outputDir: '/root/.openclaw/workspace/characters/chen-nurse/portraits'
  },
  {
    id: 'coach-li',
    name: '李明教练',
    basePrompt: `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理与皮下血管隐约可见，次表面散射使皮肤通透真实，亚洲面孔中国年轻男性运动康复专家，32岁，阳光自信站姿挺拔专业，方圆脸小麦色皮肤，深棕色单眼皮眼神坚定专业，黑色短发利落两侧剃短顶部微蓬松，深灰色运动polo衫左胸白色运动康复汉字标识，袖子卷至肘部露出结实小臂，黑色运动长裤侧边灰色条纹，白色运动鞋，左手黑色运动手表，右手灰色护腕，银色哨子挂脖，嘴角自信微笑下巴淡淡胡茬，{angle}，纯白背景，摄影棚三点布光，超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`,
    angles: [
      { name: 'front', desc: '正面全身视角，站立姿态标准挺拔，全身可见，面部清晰' },
      { name: 'threeQuarter', desc: '3/4侧面视角，经典人像角度，面部转向左侧45度' },
      { name: 'closeup', desc: '面部特写，上半身，表情清晰，深棕色单眼皮细节' },
      { name: 'side', desc: '侧面90度视角，行走或站立姿态，侧面轮廓清晰' }
    ],
    outputDir: '/root/.openclaw/workspace/characters/coach-li/portraits'
  }
];

function generatePortrait(char, angle) {
  return new Promise((resolve, reject) => {
    const prompt = char.basePrompt.replace('{angle}', angle.desc);
    
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
        console.log('   ✅ 下载完成: ' + outputPath.split('/').pop() + ' (' + Math.round(size/1024) + 'KB)');
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎨 批量生成v2版超写实CG多角度定妆照\n');
  console.log('📸 每个角色4个角度：正面、3/4侧面、特写、侧面\n');
  
  let totalGenerated = 0;
  
  for (const char of characters) {
    console.log('📸 ' + char.name + ':');
    
    for (const angle of char.angles) {
      const outputPath = char.outputDir + '/' + char.id + '-cg-v2-' + angle.name + '.png';
      
      try {
        console.log('  生成 ' + angle.name + ' 角度...');
        const imageUrl = await generatePortrait(char, angle);
        await downloadImage(imageUrl, outputPath);
        totalGenerated++;
        await new Promise(r => setTimeout(r, 3000)); // 间隔3秒
      } catch (e) {
        console.error('  ❌ ' + angle.name + ' 失败:', e.message || e);
      }
    }
    console.log('');
  }
  
  console.log('🎉 全部生成完成！总计 ' + totalGenerated + ' 张定妆照');
  console.log('\n📁 文件汇总:');
  
  for (const char of characters) {
    console.log('\n' + char.name + ':');
    for (const angle of char.angles) {
      const path = char.outputDir + '/' + char.id + '-cg-v2-' + angle.name + '.png';
      if (fss.existsSync(path)) {
        console.log('  ✅ ' + angle.name + ': ' + path);
      }
    }
  }
}

main().catch(console.error);
