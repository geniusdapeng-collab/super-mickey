const fs = require('fs');
const path = require('path');

// Seedance API 配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const ENDPOINT = '003cENDPOINT_STD003e';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

// 角色别名映射
const CHARACTER_ALIASES = {
  'xiaoG': ['xiaoG', 'AgentX', '小 g', '小季', 'xiaog'],
  'tao-tie': ['tao-tie', 'taotie', '饕餮', 'tāo tiè']
};

const REQUIRED_ANGLES = ['front', 'threeQuarter', 'closeup', 'side'];
const CHARACTERS_DIR = '/root/.openclaw/workspace/characters';

// 扫描角色定妆照
function scanCharacterPortraits() {
  const referenceImages = {};
  try {
    const characterDirs = fs.readdirSync(CHARACTERS_DIR);
    for (const charId of characterDirs) {
      const portraitPath = path.join(CHARACTERS_DIR, charId, 'portraits');
      if (!fs.existsSync(portraitPath)) continue;
      const files = fs.readdirSync(portraitPath);
      const portraits = {};
      for (const angle of REQUIRED_ANGLES) {
        // 支持两种命名: {charId}-{angle}.ext 或 {charId去掉连字符}-{angle}.ext
        const cleanCharId = charId.replace(/-/g, '');
        const patterns = [
          new RegExp(`${charId}.*-${angle}\\.(png|jpg|jpeg)$`, 'i'),
          new RegExp(`${cleanCharId}.*-${angle}\\.(png|jpg|jpeg)$`, 'i')
        ];
        let matchedFile = null;
        for (const pattern of patterns) {
          matchedFile = files.find(f => pattern.test(f));
          if (matchedFile) break;
        }
        if (matchedFile) portraits[angle] = path.join(portraitPath, matchedFile);
      }
      if (Object.keys(portraits).length > 0) referenceImages[charId] = portraits;
    }
  } catch (e) { console.warn('扫描角色目录失败:', e.message); }
  return referenceImages;
}

// 从Prompt提取角色
function extractCharactersFromPrompt(prompt) {
  const found = new Set();
  const lowerPrompt = prompt.toLowerCase();
  for (const [charId, aliases] of Object.entries(CHARACTER_ALIASES)) {
    for (const alias of aliases) {
      if (lowerPrompt.includes(alias.toLowerCase())) { found.add(charId); break; }
    }
  }
  return Array.from(found);
}

// 图片转base64
function imageToBase64(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath).toString('base64');
}

// 提交渲染
async function submitRender(shot, referenceImages) {
  const prompt = shot.prompt;
  const duration = shot.isOpening ? 9 : (shot.duration || 12);
  const content = [{ type: 'text', text: prompt }];
  
  const charactersInShot = extractCharactersFromPrompt(prompt);
  console.log(`🔍 ${shot.shotId} 检测到角色: ${charactersInShot.join(', ') || '无角色'}`);
  
  let refCount = 0;
  for (const charId of charactersInShot) {
    const charPortraits = referenceImages[charId];
    // v6.2-patch41-fix: 定妆照缺失=硬中止，不渲染
    if (!charPortraits) {
      const errorMsg = `⛔ RENDER_BLOCKED: 角色 ${charId} 定妆照缺失！扫描路径: ${CHARACTERS_DIR}/${charId}/portraits/`;
      console.error(errorMsg);
      console.error('❌ 渲染中止：必须修复定妆照后才能提交');
      throw new Error(errorMsg);
    }
    let charRefCount = 0;
    for (const angle of REQUIRED_ANGLES) {
      const filePath = charPortraits[angle];
      if (filePath && fs.existsSync(filePath)) {
        const base64 = imageToBase64(filePath);
        if (base64) {
          content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` }, role: 'reference_image' });
          charRefCount++;
          refCount++;
        }
      } else {
        console.error(`⛔ 角色 ${charId} 角度 ${angle} 文件不存在: ${filePath}`);
        throw new Error(`定妆照文件缺失: ${charId}/${angle}`);
      }
    }
    console.log(`📸 ${charId}: ${charRefCount}张参考图`);
  }
  
  const payload = {
    model: ENDPOINT,
    content: content,
    metadata: { max_new_tokens: 8192 },
    ratio: '16:9',
    duration: duration
  };
  
  console.log(`🎬 提交 ${shot.shotId} | 时长:${duration}s | Prompt:${prompt.length}字符 | 参考图:${refCount}张`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const result = await response.json();
    console.log(`✅ ${shot.shotId} 提交成功 | Task ID: ${result.id}`);
    return { success: true, shotId: shot.shotId, taskId: result.id, status: result.status };
  } catch (error) {
    console.error(`❌ ${shot.shotId} 提交失败: ${error.message}`);
    return { success: false, shotId: shot.shotId, error: error.message };
  }
}

// 查询任务状态
async function checkTaskStatus(taskId) {
  try {
    const response = await fetch(`${API_URL}/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) { console.error(`查询失败: ${error.message}`); return null; }
}

// 下载视频
async function downloadVideo(url, outputPath) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log(`📥 下载完成: ${outputPath} (${(buffer.length/1024/1024).toFixed(1)}MB)`);
    return true;
  } catch (error) { console.error(`❌ 下载失败: ${error.message}`); return false; }
}

// 主函数
async function main() {
  console.log('🔥 【饕餮EP01】S00 + S01 渲染提交');
  console.log('=' .repeat(50));
  
  const referenceImages = scanCharacterPortraits();
  console.log(`🎭 已扫描角色: ${Object.keys(referenceImages).join(', ')}`);
  
  // 读取最新prompts
  const outputFile = '/root/.openclaw/workspace/output/taotie-ep01-prompts-full.json';
  const output = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  
  // 只取S00和S01
  const shotsToSubmit = output.prompts.filter(s => s.shotId === 'S00' || s.shotId === 'S01');
  console.log(`\n🎬 提交 ${shotsToSubmit.length} 个镜头: ${shotsToSubmit.map(s => s.shotId).join(', ')}`);
  
  // 提交S00和S01
  const results = [];
  for (const shot of shotsToSubmit) {
    const result = await submitRender(shot, referenceImages);
    results.push(result);
    if (shot.shotId === 'S00') {
      console.log('⏳ S00提交后等待3秒再提交S01...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // 保存提交结果
  const resultFile = '/root/.openclaw/workspace/output/taotie-ep01-render-s00-s01.json';
  fs.writeFileSync(resultFile, JSON.stringify({
    project: output.project, episode: output.episode,
    submittedAt: new Date().toISOString(), withPortraits: true, results
  }, null, 2));
  console.log(`\n💾 提交结果已保存: ${resultFile}`);
  
  // 轮询S00和S01状态
  const succeeded = results.filter(r => r.success);
  if (succeeded.length > 0) {
    console.log('\n🔄 开始轮询S00+S01渲染状态...');
    const videoDir = '/root/.openclaw/workspace/videos';
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    
    const pending = [...succeeded];
    const maxPolls = 60;
    let pollCount = 0;
    
    while (pending.length > 0 && pollCount < maxPolls) {
      pollCount++;
      console.log(`\n🔄 第 ${pollCount} 轮轮询 (${pending.length} 个待完成)...`);
      const completed = [];
      
      for (const task of pending) {
        const status = await checkTaskStatus(task.taskId);
        if (!status) continue;
        console.log(`  ${task.shotId}: ${status.status} | 进度: ${status.progress || 'N/A'}%`);
        
        if (status.status === 'succeeded') {
          console.log(`  ✅ ${task.shotId} 渲染完成！`);
          if (status.video_url) {
            const outputPath = path.join(videoDir, `taotie-ep01-${task.shotId}-v40.mp4`);
            await downloadVideo(status.video_url, outputPath);
            task.videoPath = outputPath;
          }
          completed.push(task);
        } else if (status.status === 'failed') {
          console.log(`  ❌ ${task.shotId} 渲染失败: ${status.error || '未知'}`);
          completed.push(task);
        }
      }
      
      for (const task of completed) {
        const idx = pending.findIndex(t => t.taskId === task.taskId);
        if (idx >= 0) pending.splice(idx, 1);
      }
      
      if (pending.length > 0) {
        console.log(`⏳ ${pending.length} 个任务仍在渲染，30秒后再次轮询...`);
        await new Promise(r => setTimeout(r, 30000));
      }
    }
    
    // 更新结果文件
    fs.writeFileSync(resultFile, JSON.stringify({
      project: output.project, episode: output.episode,
      submittedAt: new Date().toISOString(), withPortraits: true, results
    }, null, 2));
    
    if (pending.length === 0) {
      console.log('\n🎉 S00 + S01 全部渲染完成！');
      const downloaded = results.filter(r => r.videoPath);
      console.log(`📹 已下载 ${downloaded.length}/${results.length} 个视频`);
      for (const r of downloaded) console.log(`  ${r.shotId}: ${r.videoPath}`);
    } else {
      console.log(`\n⚠️ ${pending.length} 个任务超时`);
    }
  }
  
  // 同时检查之前S02-S05的状态
  console.log('\n' + '='.repeat(50));
  console.log('🔍 检查之前S02-S05的渲染状态...');
  const prevTasksFile = '/root/.openclaw/workspace/output/taotie-ep01-render-tasks-v2.json';
  if (fs.existsSync(prevTasksFile)) {
    const prevTasks = JSON.parse(fs.readFileSync(prevTasksFile, 'utf8'));
    const s02s05 = prevTasks.results.filter(r => ['S02','S03','S04','S05'].includes(r.shotId));
    console.log(`找到 ${s02s05.length} 个S02-S05历史任务`);
    
    for (const task of s02s05) {
      const status = await checkTaskStatus(task.taskId);
      if (status) {
        console.log(`  ${task.shotId}: ${status.status}`);
        if (status.status === 'succeeded' && status.video_url) {
          const outputPath = path.join('/root/.openclaw/workspace/videos', `taotie-ep01-${task.shotId}-v36.mp4`);
          if (!fs.existsSync(outputPath)) {
            await downloadVideo(status.video_url, outputPath);
            task.videoPath = outputPath;
          } else {
            console.log(`  📁 ${task.shotId} 视频已存在: ${outputPath}`);
            task.videoPath = outputPath;
          }
        }
      }
    }
    
    // 更新历史任务文件
    fs.writeFileSync(prevTasksFile, JSON.stringify(prevTasks, null, 2));
  }
}

main().catch(console.error);
