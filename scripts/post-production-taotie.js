const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const OUTPUT_DIR = '/root/.openclaw/workspace/taotie-ep01-production';
const FINAL_OUTPUT = '/root/.openclaw/workspace/taotie-ep01-final.mp4';

const taskIds = [
  { id: 'cgt-20260531213346-7h49b', shot: 'S00', name: 'S00-opening' },
  { id: 'cgt-20260531213338-g6mg8', shot: 'S01', name: 'S01-intro' },
  { id: 'cgt-20260531213342-mth5l', shot: 'S02', name: 'S02-progress' },
  { id: 'cgt-20260531213404-28v9l', shot: 'S03', name: 'S03-appearance' },
  { id: 'cgt-20260531214625-22d98', shot: 'S04', name: 'S04-climax' },
  { id: 'cgt-20260531213401-clm9g', shot: 'S05', name: 'S05-ending' }
];

// Step 1: Get full video URLs from API
async function getVideoUrl(task) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/contents/generations/tasks/' + task.id,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const resp = JSON.parse(data);
          const url = resp.content?.video_url || '';
          resolve({ ...task, url });
        } catch (e) {
          resolve({ ...task, url: '', error: e.message });
        }
      });
    });
    req.on('error', () => resolve({ ...task, url: '' }));
    req.end();
  });
}

// Step 2: Download video
function downloadVideo(task) {
  return new Promise((resolve) => {
    const outputPath = `${OUTPUT_DIR}/${task.name}.mp4`;
    const file = fs.createWriteStream(outputPath);
    
    https.get(task.url, (res) => {
      if (res.statusCode !== 200) {
        resolve({ shot: task.shot, success: false, status: res.statusCode });
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
        resolve({ shot: task.shot, success: true, size });
      });
    }).on('error', (err) => {
      resolve({ shot: task.shot, success: false, error: err.message });
    });
  });
}

// Step 3: Merge with ffmpeg
function mergeVideos(tasks) {
  console.log('\n🎬 拼接成片...');
  
  // Create concat file list
  const concatList = tasks.map(t => `file '${OUTPUT_DIR}/${t.name}.mp4'`).join('\n');
  const concatFile = `${OUTPUT_DIR}/concat_list.txt`;
  fs.writeFileSync(concatFile, concatList);
  
  // Merge with ffmpeg
  const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" ` +
    `-c copy -movflags +faststart "${FINAL_OUTPUT}"`;
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    const finalSize = (fs.statSync(FINAL_OUTPUT).size / 1024 / 1024).toFixed(1);
    console.log(`\n✅ 成片完成: ${FINAL_OUTPUT} (${finalSize} MB)`);
    return true;
  } catch (err) {
    console.error('\n❌ 拼接失败:', err.message);
    return false;
  }
}

// Main
async function main() {
  console.log('📥 下载饕餮EP01渲染视频...\n');
  
  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Get URLs
  console.log('Step 1: 获取视频URL...');
  const tasksWithUrls = await Promise.all(taskIds.map(getVideoUrl));
  
  for (const t of tasksWithUrls) {
    if (t.url) {
      console.log(`  ${t.shot}: ✅ URL获取成功`);
    } else {
      console.log(`  ${t.shot}: ❌ URL获取失败`);
    }
  }
  
  // Download
  console.log('\nStep 2: 下载视频...');
  const downloadResults = await Promise.all(
    tasksWithUrls.filter(t => t.url).map(downloadVideo)
  );
  
  for (const r of downloadResults) {
    if (r.success) {
      console.log(`  ${r.shot}: ✅ 下载完成 (${r.size} MB)`);
    } else {
      console.log(`  ${r.shot}: ❌ 下载失败`);
    }
  }
  
  // Merge
  const successCount = downloadResults.filter(r => r.success).length;
  if (successCount > 0) {
    console.log(`\n✅ 成功下载 ${successCount}/${taskIds.length} 个镜头`);
    mergeVideos(tasksWithUrls.filter(t => t.url));
  } else {
    console.log('\n❌ 所有镜头下载失败');
  }
}

main().catch(console.error);
