const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
const status = JSON.parse(fss.readFileSync(renderDir + '/render-status-v5.json', 'utf8'));

// 检查哪些视频已下载
const existingFiles = fss.readdirSync(renderDir)
  .filter(f => f.endsWith('-v5.mp4'))
  .map(f => f.replace('-v5.mp4', ''));

console.log('📥 已下载:', existingFiles.join(', '));

// 需要下载的
const toDownload = Object.keys(status).filter(s => 
  status[s].state === 'succeeded' && !existingFiles.includes(s)
);

console.log('📥 待下载:', toDownload.join(', '));

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
                console.log('✅ ' + outputPath.split('/').pop() + ' (' + Math.round(size/1024) + 'KB)');
                resolve(outputPath);
              });
            }).on('error', (e) => {
              console.error('下载错误:', e.message);
              reject(e);
            });
          } else {
            console.error('无video URL:', JSON.stringify(result).substring(0, 200));
            reject('No video URL');
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (e) => {
      console.error('请求错误:', e.message);
      reject(e);
    });
    req.end();
  });
}

async function main() {
  for (const shotId of toDownload) {
    const info = status[shotId];
    const outputPath = renderDir + '/' + shotId + '-v5.mp4';
    console.log('\n📥 下载 ' + shotId + '...');
    try {
      await downloadVideo(info.taskId, outputPath);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error('❌ ' + shotId + ' 失败:', e.message || e);
    }
  }
  console.log('\n🎉 全部下载完成！');
}

main().catch(console.error);
