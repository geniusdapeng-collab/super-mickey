const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');
const path = require('path');

// 配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';

const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
const status = JSON.parse(fss.readFileSync(renderDir + '/render-status.json', 'utf8'));

// 查询任务状态
function checkTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_ENDPOINT,
      port: 443,
      path: '/api/v3/contents/generations/tasks/' + taskId,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + API_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 下载视频
function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(outputPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', reject);
  });
}

// 主流程
async function main() {
  console.log('🔍 查询任务状态并下载视频...\n');
  
  for (const [shotId, taskStatus] of Object.entries(status)) {
    if (taskStatus.state === 'succeeded') {
      try {
        console.log('📥 ' + shotId + ' 查询中...');
        const result = await checkTaskStatus(taskStatus.taskId);
        
        // 获取视频URL
        let videoUrl = null;
        if (result.content && result.content.video_url) {
          videoUrl = result.content.video_url;
        } else if (result.content && result.content.url) {
          videoUrl = result.content.url;
        } else if (result.output && result.output.url) {
          videoUrl = result.output.url;
        } else if (result.video_url) {
          videoUrl = result.video_url;
        }
        
        if (videoUrl) {
          console.log('  🎬 视频URL: ' + videoUrl.substring(0, 60) + '...');
          const outputPath = renderDir + '/' + shotId + '.mp4';
          
          if (!fss.existsSync(outputPath)) {
            await downloadVideo(videoUrl, outputPath);
            const stats = fss.statSync(outputPath);
            console.log('  ✅ 下载完成 (' + Math.round(stats.size/1024) + 'KB)\n');
          } else {
            console.log('  ✅ 已存在\n');
          }
        } else {
          console.log('  ❌ 未找到视频URL');
          console.log('  响应:', JSON.stringify(result, null, 2).substring(0, 200));
        }
      } catch (e) {
        console.error('❌ ' + shotId + ' 错误:', e.message);
      }
    }
  }
  
  console.log('📊 全部处理完成！');
}

main().catch(console.error);
