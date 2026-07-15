#!/usr/bin/env node
/**
 * 后期合成：重新合成完整成片（v6.2-patch90）
 * 使用新的 S04/S05 替换旧版本
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const productionDir = '/tmp/super-mickey-production';
const finalOutput = '/tmp/super-mickey-final-output.mp4';

// 视频URL列表（请替换为你自己的渲染结果URL）
const shotUrls = {
  'S00': 'https://your-video-cdn.com/shot-s00.mp4',
  'S01': 'https://your-video-cdn.com/shot-s01.mp4',
  'S02': 'https://your-video-cdn.com/shot-s02.mp4',
  'S03': 'https://your-video-cdn.com/shot-s03.mp4',
  'S04': 'https://your-video-cdn.com/shot-s04.mp4',
  'S05': 'https://your-video-cdn.com/shot-s05.mp4'
};

async function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, { headers: { 'X-Tos-SignedHeaders': 'host' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('🎬 后期合成：重新合成完整成片（v6.2-patch90）\n');
  
  // 创建生产目录
  if (!fs.existsSync(productionDir)) {
    fs.mkdirSync(productionDir, { recursive: true });
  }
  
  // 下载所有视频
  const videoFiles = [];
  for (const [shotId, url] of Object.entries(shotUrls)) {
    const outputPath = path.join(productionDir, `${shotId}.mp4`);
    
    // 如果已存在则删除旧版本
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    
    console.log(`📥 下载 ${shotId}...`);
    try {
      await downloadVideo(url, outputPath);
      const stats = fs.statSync(outputPath);
      console.log(`  ✅ ${shotId} 下载完成 (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      videoFiles.push(outputPath);
    } catch (e) {
      console.error(`  ❌ ${shotId} 下载失败: ${e.message}`);
      process.exit(1);
    }
  }
  
  // 创建 concat 列表文件
  const listPath = path.join(productionDir, 'concat-list.txt');
  const listContent = videoFiles.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  
  // 使用 ffmpeg 合并
  console.log('\n🎞️ 合并所有镜头...');
  const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalOutput}" -y`;
  
  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
    
    const stats = fs.statSync(finalOutput);
    console.log(`\n✅ 成片合成完成！`);
    console.log(`📁 文件: ${finalOutput}`);
    console.log(`📦 大小: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    
    // 获取视频信息
    const ffprobeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=s=x:p=0 "${finalOutput}"`;
    const info = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
    console.log(`📊 信息: ${info}`);
    
  } catch (e) {
    console.error('\n❌ 合并失败:', e.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('❌ 失败:', e);
  process.exit(1);
});
