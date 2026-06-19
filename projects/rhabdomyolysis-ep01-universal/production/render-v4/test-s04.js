const fs = require('fs');
const https = require('https');

// 配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
const MODEL = 'ep-20260518004622-jp46s';

const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
const tasks = JSON.parse(fs.readFileSync(renderDir + '/render-tasks.json', 'utf8'));
const imageCache = JSON.parse(fs.readFileSync(renderDir + '/image-cache.json', 'utf8'));

// 只测试S04
const testTask = tasks.find(t => t.id === 'S04');

function submitTask(task) {
  return new Promise((resolve, reject) => {
    const content = [
      { type: 'text', text: task.prompt }
    ];
    
    if (task.referenceImages && task.referenceImages.length > 0) {
      task.referenceImages.forEach(imgPath => {
        const base64Data = imageCache[imgPath];
        if (base64Data) {
          content.push({
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,' + base64Data },
            role: 'reference_image'
          });
        }
      });
    }
    
    const payload = { model: MODEL, content: content };
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: API_ENDPOINT, port: 443,
      path: '/api/v3/contents/generations/tasks',
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
        const result = JSON.parse(data);
        if (result.id) {
          console.log('✅ 提交成功: ' + result.id);
          resolve(result.id);
        } else {
          console.log('❌ 失败:', result);
          reject(result);
        }
      });
    });
    req.write(postData);
    req.end();
  });
}

function checkStatus(taskId) {
  return new Promise((resolve) => {
    const options = {
      hostname: API_ENDPOINT, port: 443,
      path: '/api/v3/contents/generations/tasks/' + taskId,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
}

async function main() {
  console.log('🧪 测试S04角色一致性（修正API格式）\n');
  const taskId = await submitTask(testTask);
  
  console.log('⏳ 等待渲染完成...');
  let state = 'submitted';
  while (state !== 'succeeded' && state !== 'failed') {
    await new Promise(r => setTimeout(r, 30000));
    const result = await checkStatus(taskId);
    state = result.status || result.state;
    console.log('  状态: ' + state);
  }
  
  if (state === 'succeeded') {
    const videoUrl = result.content?.video_url || result.content?.url;
    console.log('\n✅ 渲染完成！');
    console.log('🎬 视频URL: ' + videoUrl);
    
    // 下载视频
    const outputPath = renderDir + '/S04-test.mp4';
    const file = fs.createWriteStream(outputPath);
    https.get(videoUrl, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        console.log('✅ 下载完成: ' + outputPath);
        process.exit(0);
      });
    });
  } else {
    console.log('\n❌ 渲染失败');
    process.exit(1);
  }
}

main().catch(console.error);
