const https = require('https');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';

const tasks = [
  { id: 'cgt-20260521171826-kv4qh', shot: 'S04' },
  { id: 'cgt-20260521171844-g57z7', shot: 'S05' },
  { id: 'cgt-20260521171905-72jh8', shot: 'S06' },
  { id: 'cgt-20260521171920-9g4l7', shot: 'S07' }
];

const outputDir = '/root/.openclaw/workspace/stories/rhabdomyolysis-s01e01/production/videos-v42';

if (!fss.existsSync(outputDir)) {
  fss.mkdirSync(outputDir, { recursive: true });
}

async function checkTask(task) {
  return new Promise((resolve) => {
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
          resolve({ ...task, status: result.status, data: result });
        } catch (e) {
          resolve({ ...task, status: 'error', error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ ...task, status: 'error', error: err.message });
    });
    req.setTimeout(10000, () => { req.destroy(); resolve({ ...task, status: 'timeout' }); });
    req.end();
  });
}

async function downloadVideo(url, outputPath) {
  return new Promise((resolve) => {
    const file = fss.createWriteStream(outputPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ success: true });
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

async function main() {
  console.log('========================================');
  console.log('🎬 检查S04-S07渲染状态 + 自动下载');
  console.log('========================================');
  
  let allDone = false;
  let attempts = 0;
  const maxAttempts = 120; // 最多120次×5秒=10分钟
  
  while (!allDone && attempts < maxAttempts) {
    attempts++;
    console.log(`\n⏳ 第${attempts}轮检查...`);
    
    const results = [];
    let succeeded = 0;
    
    for (const task of tasks) {
      const result = await checkTask(task);
      results.push(result);
      
      if (result.status === 'succeeded') {
        succeeded++;
        
        // 检查是否已下载
        const outputPath = path.join(outputDir, `${result.shot}-v42.mp4`);
        if (!fss.existsSync(outputPath)) {
          const videoUrl = result.data?.content?.video_url;
          if (videoUrl) {
            console.log(`  📥 下载 ${result.shot}...`);
            const dlResult = await downloadVideo(videoUrl, outputPath);
            if (dlResult.success) {
              const stats = fss.statSync(outputPath);
              console.log(`  ✅ ${result.shot} 下载完成 (${(stats.size/1024/1024).toFixed(2)}MB)`);
            } else {
              console.log(`  ❌ ${result.shot} 下载失败: ${dlResult.error}`);
            }
          }
        } else {
          console.log(`  ✅ ${result.shot}: 已下载`);
        }
      } else if (result.status === 'running') {
        console.log(`  ⏳ ${result.shot}: 渲染中`);
      } else {
        console.log(`  ❌ ${result.shot}: ${result.status}`);
        if (result.error) console.log(`     - ${result.error}`);
      }
    }
    
    if (succeeded === tasks.length) {
      allDone = true;
      console.log('\n========================================');
      console.log('🎉 全部渲染完成并下载！');
      console.log('========================================');
    } else {
      console.log(`\n  进度: ${succeeded}/${tasks.length} 完成`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  if (!allDone) {
    console.log('\n⚠️ 超时，部分任务可能仍在渲染中');
  }
}

main();
