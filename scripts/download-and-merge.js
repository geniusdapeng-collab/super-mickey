const fs = require('fs');
const { execSync } = require('child_process');

// 读取视频URL
const urlsData = JSON.parse(fs.readFileSync('/root/.openclaw/workspace/output/taotie-ep01-video-urls.json', 'utf8'));

const outputDir = '/root/.openclaw/workspace/output/videos';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 下载每个视频
async function downloadVideos() {
  console.log('📥 下载视频片段...\n');
  
  for (const item of urlsData) {
    const outputFile = `${outputDir}/${item.shotId}.mp4`;
    console.log(`下载 ${item.shotId}...`);
    
    try {
      execSync(`curl -L "${item.videoUrl}" -o "${outputFile}" --max-time 120`, {
        stdio: 'pipe'
      });
      const stats = fs.statSync(outputFile);
      console.log(`  ✅ ${item.shotId}: ${(stats.size / 1024 / 1024).toFixed(2)}MB\n`);
    } catch (error) {
      console.error(`  ❌ ${item.shotId} 下载失败: ${error.message}\n`);
    }
  }
}

// 合并视频
function mergeVideos() {
  console.log('🎬 合并视频...\n');
  
  // 创建concat列表文件
  const concatList = urlsData.map(item => `file '${outputDir}/${item.shotId}.mp4'`).join('\n');
  fs.writeFileSync(`${outputDir}/concat-list.txt`, concatList);
  
  const finalOutput = '/root/.openclaw/workspace/output/taotie-ep01-final.mp4';
  
  try {
    // 使用ffmpeg合并，不重新编码（快速合并）
    execSync(`ffmpeg -f concat -safe 0 -i "${outputDir}/concat-list.txt" -c copy "${finalOutput}" -y`, {
      stdio: 'pipe'
    });
    
    const stats = fs.statSync(finalOutput);
    console.log(`✅ 合并完成: ${finalOutput}`);
    console.log(`📊 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
    return finalOutput;
  } catch (error) {
    console.error(`❌ 合并失败: ${error.message}`);
    return null;
  }
}

// 压缩视频到30MB以内
function compressVideo(inputFile) {
  const stats = fs.statSync(inputFile);
  const sizeMB = stats.size / 1024 / 1024;
  
  if (sizeMB <= 30) {
    console.log(`✅ 视频已小于30MB (${sizeMB.toFixed(2)}MB)，无需压缩`);
    return inputFile;
  }
  
  console.log(`📦 压缩视频 (${sizeMB.toFixed(2)}MB → 目标<30MB)...`);
  
  const compressedOutput = '/root/.openclaw/workspace/output/taotie-ep01-final-compressed.mp4';
  
  // 计算目标码率 (25MB / 视频时长秒数)
  // 先获取视频时长
  const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputFile}"`, {
    encoding: 'utf8'
  }).trim();
  const duration = parseFloat(durationStr);
  
  // 目标25MB (留5MB余量)
  const targetBitrate = Math.floor((25 * 8 * 1024 * 1024) / duration);
  
  try {
    execSync(`ffmpeg -i "${inputFile}" -c:v libx264 -b:v ${targetBitrate} -maxrate ${Math.floor(targetBitrate * 1.2)} -bufsize ${targetBitrate * 2} -c:a aac -b:a 128k "${compressedOutput}" -y`, {
      stdio: 'pipe'
    });
    
    const compressedStats = fs.statSync(compressedOutput);
    console.log(`✅ 压缩完成: ${(compressedStats.size / 1024 / 1024).toFixed(2)}MB`);
    
    return compressedOutput;
  } catch (error) {
    console.error(`❌ 压缩失败: ${error.message}`);
    return inputFile;
  }
}

async function main() {
  // 下载
  await downloadVideos();
  
  // 合并
  const mergedFile = mergeVideos();
  if (!mergedFile) {
    console.error('❌ 合并失败，中止');
    process.exit(1);
  }
  
  // 压缩（如果需要）
  const finalFile = compressVideo(mergedFile);
  
  // 复制为最终输出
  const finalPath = '/root/.openclaw/workspace/output/taotie-ep01-final-for-upload.mp4';
  fs.copyFileSync(finalFile, finalPath);
  
  const finalStats = fs.statSync(finalPath);
  console.log(`\n🎉 最终成片: ${finalPath}`);
  console.log(`📊 文件大小: ${(finalStats.size / 1024 / 1024).toFixed(2)}MB`);
  console.log(`✅ 可用于上传！`);
}

main().catch(console.error);
