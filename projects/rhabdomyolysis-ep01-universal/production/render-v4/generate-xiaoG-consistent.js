const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f';

// 小G统一面部特征描述（所有角度共用，确保一致性）
const UNIFORM_FACE = `同一个人物面部特征完全一致，圆脸带婴儿肥脸型自然真实，内双棕色大眼睛两只眼睛大小完全相同对称，瞳孔清澈有神采直径约8mm，眼尾微微下垂显得温柔，睫毛浓密但自然，鼻梁不高但秀气，嘴唇偏薄嘴角常带倔强上扬，黑色短发蓬松额前有一缕呆毛翘起发梢微微卷曲后脑勺略扁，耳朵大小适中贴合头部`;

const UNIFORM_BODY = `标准正常儿童身材比例头身比严格1比5点5，脖子长度正常与头部协调不短不粗，身高1米25，瘦小但结实肩膀略窄，手臂有力量感，站姿自然不驼背`;

const UNIFORM_CLOTHES = `深绿色探险夹克合身自然褶皱肘部补丁，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针表盘玻璃裂痕，背包肩带彩色编织绳结，侧袋露出卷边地图一角`;

const ANGLES = [
  { name: 'front', desc: '正面全身视角站立姿态标准自然，全身从头部到脚部完全可见，面部正面朝向镜头' },
  { name: 'threeQuarter', desc: '3/4侧面视角经典人像角度，面部转向左侧45度，右脸比左脸稍多' },
  { name: 'closeup', desc: '面部特写上半身胸部以上，表情清晰专注，面部占画面60%' },
  { name: 'side', desc: '侧面90度视角站立姿态自然，面部朝向画面左侧，侧面轮廓清晰' }
];

function generate(angleDesc) {
  const prompt = `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理皮下血管隐约可见，次表面散射皮肤通透真实，${UNIFORM_FACE}，${UNIFORM_BODY}，${UNIFORM_CLOTHES}，${angleDesc}，健康小麦色皮肤手臂轻微晒痕手掌薄茧，纯白背景，摄影棚三点布光主光补光轮廓光，超高清8K细节，虚幻引擎5渲染，绝非卡通动漫插画，接近真人极限的CG写实`;

  const payload = JSON.stringify({ model: MODEL, prompt, size: '2K' });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: API_ENDPOINT, port: 443,
      path: '/api/v3/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.data && result.data[0] && result.data[0].url) resolve(result.data[0].url);
          else reject(result);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function download(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(outputPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ ' + outputPath.split('/').pop() + ' (' + Math.round(fss.statSync(outputPath).size/1024) + 'KB)');
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎨 小G一致性重生成开始');
  console.log('🔒 统一面部特征：眼睛大小对称、头身比1:5.5、圆脸婴儿肥\n');
  
  for (const angle of ANGLES) {
    const outputPath = `/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-cg-v2-consistent-${angle.name}.png`;
    try {
      console.log('📸 生成 ' + angle.name + '...');
      const imageUrl = await generate(angle.desc);
      await download(imageUrl, outputPath);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error('❌ ' + angle.name + ' 失败:', e.message || e);
    }
  }
  
  console.log('\n🎉 小G一致性版本生成完成！');
}

main().catch(console.error);
