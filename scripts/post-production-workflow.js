#!/usr/bin/env node
/**
 * 【通用后期处理工作流】
 * 功能：视频合并 + 调色统一 + 字幕烧录 → 最终成片
 * 
 * 使用方法：
 *   node post-production-workflow.js <生产目录> <字幕文件> [选项]
 * 
 * 示例：
 *   node post-production-workflow.js \
 *     /root/.openclaw/workspace/jingwei-v20.0-production \
 *     jingwei-v20.0-complete.srt \
 *     --title "精卫-v20.0-最终成片"
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ============ 配置 ============
const CONFIG = {
  // 输出规格
  resolution: '1920x1080',
  fps: 30,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  audioBitrate: '192k',
  preset: 'fast',        // 可选: ultrafast/superfast/veryfast/faster/fast/medium/slow
  crf: 21,               // 质量 (0=无损, 23=默认, 越小越好)
  
  // 调色参数
  colorGrade: {
    brightness: 0.02,    // 亮度微调
    contrast: 1.05,      // 对比度
    saturation: 1.1,     // 饱和度
    redShift: 0.02,      // 红色偏移
    greenShift: 0.01,    // 绿色偏移
    blueShift: -0.01,    // 蓝色偏移
    sharpen: '3:3:0.5:3:3:0.5'  // 锐化参数
  },
  
  // 字幕样式
  subtitle: {
    font: 'Noto Sans CJK SC',
    fontSize: 28,
    primaryColor: '&H00FFFFFF',    // 白色
    outlineColor: '&H00000000',    // 黑色描边
    outline: 3,
    shadow: 1,
    marginV: 120                   // 底部边距（1080P下约1/9高度）
  }
};

// ============ 工具函数 ============
function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function exec(cmd, desc, timeout = 300000) {
  log(`🔧 ${desc}...`);
  try {
    execSync(cmd, { stdio: 'pipe', timeout });
    log(`✅ ${desc}完成`);
    return true;
  } catch (err) {
    log(`❌ ${desc}失败: ${err.message.substring(0, 100)}`);
    return false;
  }
}

function getVideoDuration(file) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`,
      { encoding: 'utf8' }
    );
    return parseFloat(out.trim());
  } catch {
    return 0;
  }
}

async function getFileSizeMB(file) {
  try {
    const stat = await fs.stat(file);
    return (stat.size / 1024 / 1024).toFixed(1);
  } catch {
    return '0.0';
  }
}

// ============ 核心流程 ============
class PostProductionPipeline {
  constructor(prodDir, srtFile, options = {}) {
    this.prodDir = prodDir;
    this.srtFile = path.join(prodDir, srtFile);
    this.title = options.title || '最终成片';
    this.tempDir = path.join(prodDir, 'temp');
    this.finalDir = path.join(prodDir, 'final');
    this.config = { ...CONFIG, ...options.config };
  }
  
  async init() {
    try { await fs.access(this.tempDir); } catch { await fs.mkdir(this.tempDir, { recursive: true }); }
    try { await fs.access(this.finalDir); } catch { await fs.mkdir(this.finalDir, { recursive: true }); }
  }
  
  // Step 1: 标准化所有镜头（统一分辨率/帧率/编码）
  async normalizeShots() {
    log('\n📐 === Step 1: 镜头标准化 ===');
    
    const dirEntries = await fs.readdir(this.prodDir);
    const mp4Files = dirEntries
      .filter(f => f.endsWith('.mp4') && !f.includes('normalized') && !f.includes('final'))
      .sort();
    
    if (mp4Files.length === 0) {
      throw new Error('未找到MP4镜头文件');
    }
    
    log(`找到 ${mp4Files.length} 个镜头`);
    const normalizedFiles = [];
    
    for (let i = 0; i < mp4Files.length; i++) {
      const file = mp4Files[i];
      const input = path.join(this.prodDir, file);
      const output = path.join(this.tempDir, `${String(i+1).padStart(3,'0')}_${file.replace('.mp4','')}_norm.mp4`);
      
      const [width, height] = this.config.resolution.split('x');
      
      const ok = exec(
        `ffmpeg -y -i "${input}" ` +
        `-vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" ` +
        `-c:v ${this.config.videoCodec} -preset ${this.config.preset} -crf ${this.config.crf} ` +
        `-r ${this.config.fps} ` +
        `-c:a ${this.config.audioCodec} -b:a ${this.config.audioBitrate} -ar 44100 ` +
        `-movflags +faststart "${output}"`,
        `标准化 ${file}`
      );
      
      if (ok) {
        try {
          await fs.access(output);
          normalizedFiles.push(output);
        } catch {
          // 文件不存在，跳过
        }
      }
    }
    
    log(`✅ 标准化完成: ${normalizedFiles.length}/${mp4Files.length}`);
    return normalizedFiles;
  }
  
  // Step 2: 合并 + 调色
  async mergeAndGrade(files) {
    log('\n🎨 === Step 2: 合并 + 调色统一 ===');
    
    // 生成concat列表
    const concatFile = path.join(this.tempDir, 'concat_list.txt');
    const concatContent = files.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);
    
    const mergedFile = path.join(this.tempDir, 'merged.mp4');
    const cg = this.config.colorGrade;
    
    const ok = exec(
      `ffmpeg -y -f concat -safe 0 -i "${concatFile}" ` +
      `-vf "` +
        `eq=brightness=${cg.brightness}:contrast=${cg.contrast}:saturation=${cg.saturation},` +
        `colorbalance=rs=${cg.redShift}:gs=${cg.greenShift}:bs=${cg.blueShift},` +
        `unsharp=${cg.sharpen}` +
      `" ` +
      `-c:v ${this.config.videoCodec} -preset ${this.config.preset} -crf ${this.config.crf} ` +
      `-c:a ${this.config.audioCodec} -b:a ${this.config.audioBitrate} ` +
      `-movflags +faststart "${mergedFile}"`,
      '合并+调色',
      600000  // 10分钟超时
    );
    
    if (!ok) throw new Error('合并+调色失败');
    
    const duration = getVideoDuration(mergedFile);
    log(`✅ 合并完成: ${duration.toFixed(1)}秒`);
    
    return mergedFile;
  }
  
  // Step 3: 字幕烧录
  async burnSubtitles(videoFile) {
    log('\n📝 === Step 3: 字幕烧录 ===');
    
    const finalFile = path.join(this.finalDir, `${this.title}.mp4`);
    const st = this.config.subtitle;
    
    try {
      await fs.access(this.srtFile);
    } catch {
      log('⚠️ 字幕文件不存在，跳过字幕烧录');
      await fs.copyFile(videoFile, finalFile);
      return finalFile;
    }
    
    const ok = exec(
      `ffmpeg -y -i "${videoFile}" ` +
      `-vf "subtitles='${this.srtFile}':` +
        `force_style='` +
          `FontName=${st.font},` +
          `FontSize=${st.fontSize},` +
          `PrimaryColour=${st.primaryColor},` +
          `OutlineColour=${st.outlineColor},` +
          `Outline=${st.outline},` +
          `Shadow=${st.shadow},` +
          `MarginV=${st.marginV}` +
        `'" ` +
      `-c:v ${this.config.videoCodec} -preset ${this.config.preset} -crf ${this.config.crf} ` +
      `-c:a copy ` +
      `-movflags +faststart "${finalFile}"`,
      '字幕烧录',
      300000
    );
    
    if (!ok) {
      log('⚠️ 字幕烧录失败，使用无字幕版本');
      fss.copyFileSync(videoFile, finalFile);
    }
    
    return finalFile;
  }
  
  // Step 4: 验证
  async verify(finalFile) {
    log('\n🔍 === Step 4: 成片验证 ===');
    
    try {
      await fs.access(finalFile);
    } catch {
      throw new Error('最终成片不存在');
    }
    
    const duration = getVideoDuration(finalFile);
    const size = await getFileSizeMB(finalFile);
    
    log(`📊 成片信息:`);
    log(`   文件: ${finalFile}`);
    log(`   大小: ${size} MB`);
    log(`   时长: ${duration.toFixed(1)}秒`);
    log(`   分辨率: ${this.config.resolution}`);
    log(`   帧率: ${this.config.fps}fps`);
    
    return { duration, size, file: finalFile };
  }
  
  // 清理临时文件
  async cleanup() {
    log('\n🧹 === 清理临时文件 ===');
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      log('✅ 临时文件已清理');
    } catch (err) {
      log(`⚠️ 清理失败: ${err.message}`);
    }
  }
  
  // 完整流水线
  async run() {
    log(`\n🎬 ==========================================`);
    log(`   后期处理工作流启动`);
    log(`   生产目录: ${this.prodDir}`);
    log(`   成片标题: ${this.title}`);
    log(`   ==========================================\n`);
    
    // 异步初始化目录
    await this.init();
    
    const startTime = Date.now();
    
    try {
      // Step 1: 标准化
      const normalizedFiles = await this.normalizeShots();
      
      if (normalizedFiles.length === 0) {
        throw new Error('没有成功标准化的镜头');
      }
      
      // Step 2: 合并+调色
      const mergedFile = await this.mergeAndGrade(normalizedFiles);
      
      // Step 3: 字幕烧录
      const finalFile = await this.burnSubtitles(mergedFile);
      
      // Step 4: 验证
      const result = await this.verify(finalFile);
      
      // 清理
      await this.cleanup();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      log(`\n✨ ==========================================`);
      log(`   🎉 后期处理完成！`);
      log(`   成片: ${result.file}`);
      log(`   时长: ${result.duration.toFixed(1)}秒`);
      log(`   大小: ${result.size} MB`);
      log(`   耗时: ${elapsed}秒`);
      log(`   ==========================================\n`);
      
      return result;
      
    } catch (err) {
      log(`\n💥 工作流失败: ${err.message}`);
      throw err;
    }
  }
}

// ============ CLI入口 ============
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
使用方法:
  node post-production-workflow.js <生产目录> <字幕文件> [选项]

选项:
  --title <名称>     成片文件名 (默认: 最终成片)
  --preset <级别>    编码速度 (ultrafast/faster/fast/medium/slow, 默认: fast)
  --crf <数值>       质量系数 (0-51, 默认: 21)

示例:
  node post-production-workflow.js \\
    /root/.openclaw/workspace/jingwei-v20.0-production \\
    jingwei-v20.0-complete.srt \\
    --title "精卫-v20.0-最终成片" \\
    --preset fast
`);
    process.exit(1);
  }
  
  const prodDir = args[0];
  const srtFile = args[1];
  
  const options = {};
  for (let i = 2; i < args.length; i += 2) {
    if (args[i] === '--title') options.title = args[i + 1];
    if (args[i] === '--preset') options.preset = args[i + 1];
    if (args[i] === '--crf') options.crf = parseInt(args[i + 1]);
  }
  
  const pipeline = new PostProductionPipeline(prodDir, srtFile, options);
  pipeline.run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// 导出模块供其他脚本使用
module.exports = { PostProductionPipeline, CONFIG };

// 如果直接运行
if (require.main === module) {
  main();
}
