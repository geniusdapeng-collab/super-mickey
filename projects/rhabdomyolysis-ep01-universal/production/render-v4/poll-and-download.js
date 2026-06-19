const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
let status = JSON.parse(fss.readFileSync(renderDir + '/render-status-v5.json', 'utf8'));

function checkStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ark.cn-beijing.volces.com', port: 443,
      path: '/api/v3/contents/generations/tasks/' + taskId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function downloadVideo(taskId, outputPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ark.cn-beijing.volces.com', port: 443,
      path: '/api/v3/contents/generations/tasks/' + taskId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const videoUrl = result.content?.video_url;
          if (videoUrl) {
            const file = fss.createWriteStream(outputPath);
            https.get(videoUrl, (res2) => {
              res2.pipe(file);
              file.on('finish', () => {
                file.close();
                const size = fss.statSync(outputPath).size;
                console.log('✅ 下载完成: ' + outputPath.split('/').pop() + ' (' + Math.round(size/1024) + 'KB)');
                resolve(outputPath);
              });
            }).on('error', reject);
          } else {
            reject('No video URL');
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function pollAndDownload() {
  console.log('🔍 轮询未完成任务并下载...\n');
  
  let hasPending = true;
  while (hasPending) {
    hasPending = false;
    
    for (const [shotId, info] of Object.entries(status)) {
      if (info.state === 'succeeded' && !fss.existsSync(renderDir + '/' + shotId + '-v5.mp4')) {
        // 已succeeded但未下载
        console.log('📥 ' + shotId + ' 已succeeded，开始下载...');
        try {
          await downloadVideo(info.taskId, renderDir + '/' + shotId + '-v5.mp4');
        } catch (e) {
          console.error('❌ ' + shotId + ' 下载失败:', e);
        }
      } else if (info.state === 'running' || info.state === 'queued' || info.state === 'submitted') {
        // 还在处理中，查询状态
        hasPending = true;
        try {
          const result = await checkStatus(info.taskId);
          const newState = result.status || result.state || 'unknown';
          
          if (newState === 'succeeded') {
            status[shotId].state = 'succeeded';
            console.log('✅ ' + shotId + ' 渲染完成！开始下载...');
            try {
              await downloadVideo(info.taskId, renderDir + '/' + shotId + '-v5.mp4');
            } catch (e) {
              console.error('❌ ' + shotId + ' 下载失败:', e);
            }
          } else if (newState === 'failed') {
            status[shotId].state = 'failed';
            status[shotId].error = result.error?.message || JSON.stringify(result);
            console.log('❌ ' + shotId + ' 渲染失败: ' + status[shotId].error);
          } else {
            console.log('⏳ ' + shotId + ' 状态: ' + newState);
          }
          
          fss.writeFileSync(renderDir + '/render-status-v5.json', JSON.stringify(status, null, 2));
        } catch (e) {
          console.error('❌ ' + shotId + ' 查询失败:', e.message);
        }
      }
    }
    
    if (hasPending) {
      console.log('\n⏳ 还有任务在处理中，30秒后再次查询...\n');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
  
  console.log('\n🎉 全部完成！');
  
  // 最终报告
  const succeeded = Object.keys(status).filter(k => status[k].state === 'succeeded');
  const failed = Object.keys(status).filter(k => status[k].state === 'failed');
  console.log('✅ 成功: ' + succeeded.length + ' 镜');
  console.log('❌ 失败: ' + failed.length + ' 镜');
}

pollAndDownload().catch(console.error);
