const fs = require('fs').promises;
const fss = require('fs');
const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
const status = JSON.parse(fss.readFileSync(renderDir + '/render-status-v5.json', 'utf8'));

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
            }).on('error', reject);
          } else {
            reject('No video URL');
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('📥 开始下载v5版本视频（CG版角色一致性）\n');
  
  for (const [shotId, info] of Object.entries(status)) {
    if (info.state === 'succeeded') {
      const outputPath = renderDir + '/' + shotId + '-v5.mp4';
      try {
        await downloadVideo(info.taskId, outputPath);
      } catch (e) {
        console.error('❌ ' + shotId + ' 下载失败:', e);
      }
    }
  }
  
  console.log('\n🎉 全部下载完成！');
  
  // 生成concat列表
  const shots = Object.keys(status).sort();
  const concatList = shots
    .filter(s => status[s].state === 'succeeded')
    .map(s => `file '${renderDir}/${s}-v5.mp4'`)
    .join('\n');
  
  fss.writeFileSync(renderDir + '/concat-list-v5.txt', concatList);
  console.log('\n📄 concat列表已生成');
}

main().catch(console.error);
