const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';

const taskIds = [
  'cgt-20260521160457-x7f2m',
  'cgt-20260521160521-jdh5g',
  'cgt-20260521160540-smfts',
  'cgt-20260521160557-rvt8b',
  'cgt-20260521160616-7rkl9',
  'cgt-20260521160635-646fk',
  'cgt-20260521160649-dg89j'
];

async function checkTask(taskId) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: `/api/v3/contents/generations/tasks/${taskId}`,
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
          resolve({ id: taskId, status: result.status, data: result });
        } catch (e) {
          resolve({ id: taskId, status: 'error', error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ id: taskId, status: 'error', error: err.message });
    });
    req.setTimeout(10000, () => { req.destroy(); resolve({ id: taskId, status: 'timeout' }); });
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('🎬 渲染任务状态查询');
  console.log('========================================');
  
  let succeeded = 0, running = 0, failed = 0;
  
  for (const taskId of taskIds) {
    const result = await checkTask(taskId);
    const shot = taskId.split('-').pop();
    
    if (result.status === 'succeeded') {
      console.log(`  ✅ ${shot}: ${result.status}`);
      succeeded++;
    } else if (result.status === 'running') {
      console.log(`  ⏳ ${shot}: ${result.status}`);
      running++;
    } else {
      console.log(`  ❌ ${shot}: ${result.status}`);
      if (result.error) console.log(`     - ${result.error}`);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`📊 完成: ${succeeded}/7 | 渲染中: ${running}/7 | 失败: ${failed}/7`);
  console.log('========================================');
}

main();
