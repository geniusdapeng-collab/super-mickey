const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const MODEL = 'ep-20260518004750-lz76f';

// 小G 修正版 - 正常身材比例，脑袋正常大小
const xiaoGAngles = [
  { name: "front", desc: "正面全身视角，站立姿态标准自然，全身可见包括头部到脚部" },
  { name: "threeQuarter", desc: "3/4侧面视角，经典人像角度，面部转向左侧45度" },
  { name: "closeup", desc: "面部特写，上半身，表情清晰，头部比例正常" },
  { name: "side", desc: "侧面90度视角，侧面轮廓清晰，身材比例标准" }
];

const xiaoGBasePrompt = `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理，次表面散射使皮肤通透真实，亚洲面孔中国杭州8岁男孩，标准正常儿童身材比例，头身比例约为1:5.5（头部大小适中不 oversized），脖子长度正常与头部协调，圆脸带婴儿肥但脸型自然，内双棕色大眼睛清澈有神，黑色短发蓬松额前呆毛翘起发梢微卷，身高约1米25符合正常8岁男孩标准，深绿色探险夹克合身，卡其色工装裤膝盖磨白，棕色皮靴，腰间黄铜旧指南针，背包彩色编织绳结，健康小麦色皮肤手臂轻微晒痕，{angle}，纯白背景，摄影棚三点布光，超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`;

// 陈女士 修正版 - 警徽警号弱化模糊
const chenAngles = [
  { name: "front", desc: "正面全身视角，站立姿态标准挺拔" },
  { name: "threeQuarter", desc: "3/4侧面视角，经典人像角度" },
  { name: "closeup", desc: "面部特写，上半身，表情清晰" },
  { name: "side", desc: "侧面90度视角" }
];

const chenBasePrompt = `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理，次表面散射使皮肤通透真实，亚洲面孔中国年轻女性警官，28岁，端庄站姿挺拔如松，鹅蛋脸轮廓柔和，深棕色杏仁眼双眼皮眼神坚定，黑色短发低马尾发尾微卷刘海整齐向右，深蓝色警服外套笔挺无褶皱肩章银色警衔反光，左胸金属编号牌模糊不清不显示具体数字，右胸警徽轮廓模糊弱化处理不可辨识具体图案，白色衬衫领口整洁深色领带，深蓝色警帽佩戴端正帽徽轮廓柔和，表情庄重严肃嘴角微抿展现专业，淡粉色唇膏肤色自然偏白有血色，{angle}，纯白背景，摄影棚三点布光，超高清8K细节，虚幻引擎5渲染，绝非真人照片，绝非卡通动漫，接近真人极限的CG写实`;

function generatePortrait(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: MODEL, prompt, size: '2K' });
    
    const options = {
      hostname: 'ark.cn-beijing.volces.com', port: 443,
      path: '/api/v3/images/generations', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res) => {
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

function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(outputPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fss.statSync(outputPath).size;
        console.log('   ✅ ' + outputPath.split('/').pop() + ' (' + Math.round(size/1024) + 'KB)');
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

async function generateCharacter(name, angles, basePrompt, outputDir, prefix) {
  console.log('\n📸 ' + name + ' - 修正版生成:');
  
  for (const angle of angles) {
    const prompt = basePrompt.replace('{angle}', angle.desc);
    const outputPath = outputDir + '/' + prefix + '-cg-v2-fixed-' + angle.name + '.png';
    
    try {
      console.log('  生成 ' + angle.name + '...');
      const imageUrl = await generatePortrait(prompt);
      await downloadImage(imageUrl, outputPath);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error('  ❌ ' + angle.name + ' 失败:', e.message || e);
    }
  }
}

async function main() {
  console.log('🎨 修正版定妆照生成开始\n');
  console.log('📋 修正内容:');
  console.log('   小G: 正常头身比例(1:5.5)，脖子长度正常，身材标准');
  console.log('   陈女士: 警徽警号模糊处理，不显示具体数字\n');
  
  // 生成小G修正版
  await generateCharacter(
    '小G', 
    xiaoGAngles, 
    xiaoGBasePrompt,
    '/root/.openclaw/workspace/characters/xiaoG/portraits',
    'xiaoG'
  );
  
  // 生成陈女士修正版
  await generateCharacter(
    '陈女士',
    chenAngles,
    chenBasePrompt,
    '/root/.openclaw/workspace/characters/chen-nurse/portraits',
    'chen'
  );
  
  console.log('\n🎉 全部修正完成！');
}

main().catch(console.error);
