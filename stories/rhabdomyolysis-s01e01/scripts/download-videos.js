const https = require('https');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';

const tasks = [
  { id: 'cgt-20260521160457-x7f2m', shot: 'S01' },
  { id: 'cgt-20260521160521-jdh5g', shot: 'S02' },
  { id: 'cgt-20260521160540-smfts', shot: 'S03' },
  { id: 'cgt-20260521160557-rvt8b', shot: 'S04' },
  { id: 'cgt-20260521160616-7rkl9', shot: 'S05' },
  { id: 'cgt-20260521160635-646fk', shot: 'S06' },
  { id: 'cgt-20260521160649-dg89j', shot: 'S07' }
];

const outputDir = '/root/.openclaw/workspace/stories/rhabdomyolysis-s01e01/production/videos';

if (!fss.existsSync(outputDir)) {
  fss.mkdirSync(outputDir, { recursive: true });
}

async function downloadVideo(task) {
  return new Promise((resolve) => {
    // 首先查询任务获取下载URL
    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: `/api/v3/contents/generations/tasks/${task.id}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const videoUrl = result.content?.video_url;
          
          if (!videoUrl) {
            console.log(`  ❌ ${task.shot}: 未找到视频URL`);
            console.log('  返回结构:', JSON.stringify(result, null, 2).substring(0, 200));
            resolve({ shot: task.shot, success: false });
            return;
          }

          console.log(`  📥 ${task.shot}: 找到视频URL，开始下载...`);

          // 下载视频
          const videoReq = https.get(videoUrl, (videoRes) => {
            const filePath = path.join(outputDir, `${task.shot}.mp4`);
            const fileStream = fss.createWriteStream(filePath);
            videoRes.pipe(fileStream);
            
            fileStream.on('finish', () => {
              const stats = fss.statSync(filePath);
              console.log(`  ✅ ${task.shot}: 下载完成 (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
              resolve({ shot: task.shot, success: true, size: stats.size });
            });
            
            fileStream.on('error', (err) => {
              console.log(`  ❌ ${task.shot}: 写入失败 - ${err.message}`);
              resolve({ shot: task.shot, success: false });
            });
          });
          
          videoReq.on('error', (err) => {
            console.log(`  ❌ ${task.shot}: 下载失败 - ${err.message}`);
            resolve({ shot: task.shot, success: false });
          });
        } catch (e) {
          console.log(`  ❌ ${task.shot}: 解析失败 - ${e.message}`);
          resolve({ shot: task.shot, success: false });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`  ❌ ${task.shot}: 查询失败 - ${err.message}`);
      resolve({ shot: task.shot, success: false });
    });
    
    req.setTimeout(30000, () => { req.destroy(); resolve({ shot: task.shot, success: false, error: 'timeout' }); });
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('🎬 视频下载');
  console.log('========================================');
  
  for (const task of tasks) {
    await downloadVideo(task);
  }
  
  console.log('\n========================================');
  console.log('📊 下载完成');
  console.log('========================================');
}

main();
