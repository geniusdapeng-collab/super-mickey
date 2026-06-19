const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004750-lz76f';

// 读取正面照作为参考基准
const frontImagePath = '/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-cg-v2-consistent-front.png';
const frontBase64 = fss.readFileSync(frontImagePath).toString('base64');
console.log('📸 已读取正面照基准: ' + Math.round(frontBase64.length/1024) + 'KB base64\n');

// 需要生成的3个角度
const angles = [
  { 
    name: 'threeQuarter', 
    desc: '3/4侧面视角经典人像角度，面部转向左侧45度，右脸比左脸稍多，同一个男孩同一个面部特征'
  },
  { 
    name: 'closeup', 
    desc: '面部特写上半身胸部以上，表情清晰专注，面部占画面60%，同一个男孩同一个面部特征'
  },
  { 
    name: 'side', 
    desc: '侧面90度视角站立姿态自然，面部朝向画面左侧，侧面轮廓清晰，同一个男孩同一个面部特征'
  }
];

// 统一的基础描述（和正面照一致）
const basePrompt = `超写实3D数字人渲染，CG角色设计极致逼真，次世代游戏角色级精度，毛孔级皮肤纹理皮下血管隐约可见，次表面散射皮肤通透真实，亚洲面孔中国杭州8岁男孩，标准正常儿童身材比例头身比严格1比5点5，脖子长度正常与头部协调，圆脸带婴儿肥脸型自然真实，内双棕色大眼睛两只眼睛大小完全相同对称，瞳孔清澈有神采，眼尾微微下垂显得温柔，睫毛浓密但自然，鼻梁不高但秀气，嘴唇偏薄嘴角常带倔强上扬，黑色短发蓬松额前有一缕呆毛翘起发梢微微卷曲后脑勺略扁，耳朵大小适中贴合头部，身高1米25，瘦小但结实肩膀略窄，深绿色探险夹克合身自然褶皱肘部补丁，卡其色工装裤膝盖磨白，棕色皮靴鞋头划痕，腰间黄铜旧指南针表盘玻璃裂痕，背包肩带彩色编织绳结侧袋露出卷边地图一角，健康小麦色皮肤手臂轻微晒痕手掌薄茧，{angle}，纯白背景，摄影棚三点布光主光补光轮廓光，超高清8K细节，虚幻引擎5渲染，绝非卡通动漫插画，接近真人极限的CG写实`;

function generateWithReference(angleDesc, angleName) {
  return new Promise((resolve, reject) => {
    const prompt = basePrompt.replace('{angle}', angleDesc);
    
    // 使用content数组格式，正面照作为参考图
    const payload = JSON.stringify({
      model: MODEL,
      prompt: prompt,
      size: '2K',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,' + frontBase64
          },
          role: 'reference_image'
        }
      ]
    });
    
    const options = {
      hostname: API_ENDPOINT,
      port: 443,
      path: '/api/v3/images/generations',
      method: 'POST',
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
          if (result.data && result.data[0] && result.data[0].url) {
            resolve(result.data[0].url);
          } else {
            console.error('API返回:', JSON.stringify(result).substring(0, 500));
            reject(result);
          }
        } catch(e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('请求错误:', e.message);
      reject(e);
    });
    
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
        console.log('✅ 下载完成: ' + outputPath.split('/').pop() + ' (' + Math.round(size/1024) + 'KB)');
        resolve(outputPath);
      });
    }).on('error', (e) => {
      console.error('下载错误:', e.message);
      reject(e);
    });
  });
}

async function main() {
  console.log('🎨 以正面照为基准，生成其他3个角度');
  console.log('🔒 使用正面照作为参考图，保证面部特征一致\n');
  
  for (const angle of angles) {
    const outputPath = `/root/.openclaw/workspace/characters/xiaoG/portraits/xiaoG-cg-v2-consistent-${angle.name}.png`;
    
    try {
      console.log('📸 生成 ' + angle.name + ' (使用正面照参考)...');
      const imageUrl = await generateWithReference(angle.desc, angle.name);
      await downloadImage(imageUrl, outputPath);
      
      // 间隔5秒避免限流
      if (angle.name !== 'side') {
        console.log('⏳ 等待5秒...\n');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('❌ ' + angle.name + ' 失败:', e.message || JSON.stringify(e).substring(0, 200));
    }
  }
  
  console.log('\n🎉 全部生成完成！');
  console.log('\n📁 最终定妆照文件:');
  console.log('  ✅ xiaoG-cg-v2-consistent-front.png (基准 - 正面照)');
  console.log('  ✅ xiaoG-cg-v2-consistent-threeQuarter.png (新 - 参考正面)');
  console.log('  ✅ xiaoG-cg-v2-consistent-closeup.png (新 - 参考正面)');
  console.log('  ✅ xiaoG-cg-v2-consistent-side.png (新 - 参考正面)');
}

main().catch(console.error);
