const fs = require('fs');
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

const tasksFile = '/root/.openclaw/workspace/output/taotie-ep01-render-tasks-v2.json';
const data = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));

async function checkTaskStatus(taskId) {
  try {
    const response = await fetch(`${API_URL}/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  const results = [];
  
  for (const result of data.results) {
    const status = await checkTaskStatus(result.taskId);
    const videoUrl = status.content?.video_url || null;
    
    results.push({
      shotId: result.shotId,
      taskId: result.taskId,
      status: status.status,
      videoUrl: videoUrl
    });
    
    if (videoUrl) {
      console.log(`${result.shotId}: ${videoUrl}`);
    } else {
      console.log(`${result.shotId}: no video URL`);
    }
  }
  
  // Save to file
  fs.writeFileSync('/root/.openclaw/workspace/output/taotie-ep01-video-urls.json', JSON.stringify(results, null, 2));
  console.log('\n✅ 视频URL已保存');
}

main().catch(console.error);
