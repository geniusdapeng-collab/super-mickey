const https = require('https');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY || '';

const taskId = 'cgt-20260521160457-x7f2m';

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
      console.log('API返回结构:');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (err) => console.log('请求失败:', err.message));
req.setTimeout(15000, () => { req.destroy(); });
req.end();
