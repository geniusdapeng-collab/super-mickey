const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const https = require('https');

// 配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';
const API_ENDPOINT = 'ark.cn-beijing.volces.com';
// 使用自定义接入点（之前成功的端点）
const MODEL = 'ep-20260518004622-jp46s';
const MAX_CONCURRENT = 1; // 改为1，方便测试

// 读取任务
const renderDir = '/root/.openclaw/workspace/projects/rhabdomyolysis-ep01-universal/production/render-v4';
const tasks = JSON.parse(fss.readFileSync(renderDir + '/render-tasks-v5.json', 'utf8'));
const imageCache = JSON.parse(fss.readFileSync(renderDir + '/image-cache.json', 'utf8'));

// 状态跟踪
const statusFile = renderDir + '/render-status.json';
let status = {};
if (fss.existsSync(statusFile)) {
  status = JSON.parse(fss.readFileSync(statusFile, 'utf8'));
}

// 提交单个任务（修正版：content数组传入参考图）
function submitTask(task) {
  return new Promise((resolve, reject) => {
    // 构建content数组（包含prompt + 参考图）
    const content = [
      {
        type: 'text',
        text: task.prompt
      }
    ];
    
    // 添加参考图到content数组（带role字段）
    if (task.referenceImages && task.referenceImages.length > 0) {
      task.referenceImages.forEach(imgPath => {
        const base64Data = imageCache[imgPath];
        if (base64Data) {
          content.push({
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,' + base64Data
            },
            role: 'reference_image'  // ← 关键！必须设置role
          });
        }
      });
    }
    
    const payload = {
      model: MODEL,
      content: content,
      parameters: {
        duration: task.duration,
        ratio: task.ratio
      }
    };
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: API_ENDPOINT,
      port: 443,
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
        try {
          const result = JSON.parse(data);
          if (result.id) {
            status[task.id] = {
              taskId: result.id,
              state: 'submitted',
              submittedAt: new Date().toISOString()
            };
            saveStatus();
            console.log('✅ ' + task.id + ' 已提交 | taskId: ' + result.id);
            resolve(result);
          } else {
            console.error('❌ ' + task.id + ' 提交失败:', result);
            reject(result);
          }
        } catch (e) {
          console.error('❌ ' + task.id + ' 解析失败:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ ' + task.id + ' 请求错误:', e.message);
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

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
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 保存状态
function saveStatus() {
  fss.writeFileSync(statusFile, JSON.stringify(status, null, 2));
}

// 批量提交（控制并发）
async function batchSubmit() {
  console.log('🚀 开始批量提交 ' + tasks.length + ' 个镜头');
  console.log('⏱️  预计完成时间: 15-20分钟');
  console.log('');
  
  for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
    const batch = tasks.slice(i, i + MAX_CONCURRENT);
    console.log('📦 批次 ' + (Math.floor(i/MAX_CONCURRENT) + 1) + ': ' + batch.map(t => t.id).join(', '));
    
    try {
      await Promise.all(batch.map(task => submitTask(task)));
    } catch (e) {
      console.error('批次提交出错:', e);
    }
    
    // 批次间隔
    if (i + MAX_CONCURRENT < tasks.length) {
      console.log('⏳ 等待5秒...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log('\n✅ 全部提交完成！');
  console.log('📊 状态:');
  Object.keys(status).forEach(key => {
    console.log('  ' + key + ': ' + status[key].state + ' (taskId: ' + status[key].taskId + ')');
  });
}

// 轮询状态
async function pollAllStatus() {
  console.log('\n🔍 开始轮询任务状态...');
  
  const pendingTasks = Object.keys(status).filter(key => 
    status[key].state === 'submitted' || status[key].state === 'running'
  );
  
  if (pendingTasks.length === 0) {
    console.log('✅ 所有任务已完成或失败');
    return;
  }
  
  for (const shotId of pendingTasks) {
    try {
      const result = await checkTaskStatus(status[shotId].taskId);
      const state = result.status || result.state || 'unknown';
      
      if (state === 'succeeded') {
        status[shotId].state = 'succeeded';
        status[shotId].completedAt = new Date().toISOString();
        status[shotId].videoUrl = result.content?.url || result.output?.url || result.video_url;
        console.log('✅ ' + shotId + ' 渲染完成！');
      } else if (state === 'failed') {
        status[shotId].state = 'failed';
        status[shotId].error = result.error?.message || JSON.stringify(result);
        console.log('❌ ' + shotId + ' 渲染失败: ' + status[shotId].error);
      } else {
        status[shotId].state = state;
        console.log('⏳ ' + shotId + ' 状态: ' + state);
      }
      
      saveStatus();
    } catch (e) {
      console.error('❌ 查询 ' + shotId + ' 状态失败:', e.message);
    }
  }
  
  // 如果还有pending的，继续轮询
  const stillPending = Object.keys(status).filter(key => 
    status[key].state === 'submitted' || status[key].state === 'running'
  );
  
  if (stillPending.length > 0) {
    console.log('\n⏳ ' + stillPending.length + ' 个任务仍在处理，30秒后再次查询...');
    await new Promise(r => setTimeout(r, 30000));
    await pollAllStatus();
  } else {
    console.log('\n🎉 所有任务处理完成！');
  }
}

// 主流程
async function main() {
  // 提交任务
  await batchSubmit();
  
  // 等待一段时间让任务开始
  console.log('\n⏳ 等待10秒让任务启动...');
  await new Promise(r => setTimeout(r, 10000));
  
  // 轮询状态
  await pollAllStatus();
  
  // 最终报告
  console.log('\n📊 最终报告:');
  const succeeded = Object.keys(status).filter(key => status[key].state === 'succeeded');
  const failed = Object.keys(status).filter(key => status[key].state === 'failed');
  console.log('✅ 成功: ' + succeeded.length + ' 镜');
  console.log('❌ 失败: ' + failed.length + ' 镜');
  
  if (failed.length > 0) {
    console.log('\n❌ 失败详情:');
    failed.forEach(key => {
      console.log('  ' + key + ': ' + status[key].error);
    });
  }
}

main().catch(console.error);
