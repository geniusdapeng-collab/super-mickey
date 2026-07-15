/**
 * Context Manager — 五级素材分辨率管理系统 (v9.2-Peng)
 * 
 * 基于 Claude Code 五层上下文压缩管道的视频制作适配：
 * Layer 1: 代理文件索引（零成本）
 * Layer 2: 可见范围裁剪（零成本）
 * Layer 3: 智能帧缓存（低成本）
 * Layer 4: 时间线虚拟投影（中等成本）
 * Layer 5: AI素材摘要（高成本）
 * 
 * 核心目标：在有限带宽/存储/预览性能下，智能管理素材分辨率
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ============ 五级分辨率配置 ============
const RESOLUTION_LEVELS = {
  'proxy': {
    name: '代理文件',
    resolution: '480p',
    scale: 'iw/4:ih/4',
    codec: 'libx264',
    preset: 'ultrafast',
    crf: 28,
    cost: 0,
    purpose: '快速预览、AI分析'
  },
  'edit': {
    name: '剪辑级',
    resolution: '720p',
    scale: 'iw/2:ih/2',
    codec: 'libx264',
    preset: 'fast',
    crf: 23,
    cost: 0,
    purpose: '时间线编辑、粗剪'
  },
  'color': {
    name: '调色级',
    resolution: '1080p',
    scale: 'iw:ih',
    codec: 'prores_ks',
    preset: null,
    profile: 2,
    cost: 0.05,
    purpose: '色彩校正、LUT预览'
  },
  'fine': {
    name: '精剪级',
    resolution: '2k',
    scale: 'iw*1.33:ih*1.33',
    codec: 'prores_ks',
    profile: 3,
    cost: 0.2,
    purpose: '精细调整、特效预览'
  },
  'master': {
    name: '成片级',
    resolution: '4k',
    scale: 'iw*2:ih*2',
    codec: 'prores_ks',
    profile: 4,
    cost: 1.0,
    purpose: '最终交付'
  }
};

// ============ Context Manager 主类 ============
export class ContextManager {
  constructor(projectId, config = {}) {
    this.projectId = projectId;
    this.projectDir = this.getProjectDir(projectId);
    this.proxyDir = path.join(this.projectDir, '.proxy');
    this.cacheDir = path.join(this.projectDir, '.cache');
    this.indexPath = path.join(this.projectDir, '.context-index.json');
    
    // 配置
    this.maxCacheSizeMB = config.maxCacheSizeMB || 5000;
    this.cacheTTLHours = config.cacheTTLHours || 24;
    this.enableVirtualProjection = config.enableVirtualProjection !== false;
    
    // 运行时状态
    this.loadedAssets = new Map();   // 当前加载的素材
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.proxyGenerated = 0;
    
    // 确保目录存在
    this.ensureDirectories();
    this.loadIndex();
  }
  
  ensureDirectories() {
    [this.proxyDir, this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  // ============ Layer 1: 代理文件索引 ============
  async loadProxyIndex(assets) {
    const loaded = [];
    
    for (const asset of assets) {
      const assetId = this.getAssetId(asset);
      const proxyPath = path.join(this.proxyDir, `${assetId}_480p.mp4`);
      
      // 检查代理文件是否存在
      if (fs.existsSync(proxyPath)) {
        loaded.push({
          assetId,
          original: asset,
          proxy: proxyPath,
          level: 'proxy',
          loaded: true
        });
      } else {
        // 标记为需要生成
        loaded.push({
          assetId,
          original: asset,
          proxy: null,
          level: 'proxy',
          loaded: false
        });
      }
    }
    
    return loaded;
  }
  
  async generateProxy(assetPath, assetId) {
    const proxyPath = path.join(this.proxyDir, `${assetId}_480p.mp4`);
    
    if (fs.existsSync(proxyPath)) {
      return proxyPath;
    }
    
    try {
      const cmd = `ffmpeg -i "${assetPath}" -vf "scale=${RESOLUTION_LEVELS.proxy.scale}" -c:v ${RESOLUTION_LEVELS.proxy.codec} -preset ${RESOLUTION_LEVELS.proxy.preset} -crf ${RESOLUTION_LEVELS.proxy.crf} -an -y "${proxyPath}"`;
      
      execSync(cmd, { stdio: 'pipe', timeout: 300000 });
      this.proxyGenerated++;
      
      return proxyPath;
    } catch (error) {
      console.error(`[ContextManager] 代理生成失败: ${assetPath}`, error.message);
      return null;
    }
  }
  
  // ============ Layer 2: 可见范围裁剪 ============
  async loadVisibleRange(asset, timeRange) {
    const { inPoint, outPoint } = timeRange;
    const assetId = this.getAssetId(asset);
    const cacheKey = `${assetId}_${inPoint}_${outPoint}`;
    const cachedPath = path.join(this.cacheDir, `${cacheKey}.mp4`);
    
    // 检查缓存
    if (fs.existsSync(cachedPath)) {
      this.cacheHits++;
      return { path: cachedPath, fromCache: true };
    }
    
    // 生成裁剪片段
    try {
      const proxyPath = await this.getProxyPath(asset, assetId);
      const duration = outPoint - inPoint;
      
      const cmd = `ffmpeg -i "${proxyPath}" -ss ${inPoint} -t ${duration} -c copy -y "${cachedPath}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 60000 });
      
      this.cacheMisses++;
      return { path: cachedPath, fromCache: false };
    } catch (error) {
      console.error(`[ContextManager] 裁剪失败: ${asset}`, error.message);
      return { path: asset, fromCache: false, error: true };
    }
  }
  
  // ============ Layer 3: 智能帧缓存 ============
  async getCachedFrames(asset, frameRange) {
    const assetId = this.getAssetId(asset);
    const { startFrame, endFrame } = frameRange;
    const frames = [];
    
    for (let i = startFrame; i <= endFrame; i++) {
      const framePath = path.join(this.cacheDir, `${assetId}_frame_${i.toString().padStart(6, '0')}.jpg`);
      
      if (fs.existsSync(framePath)) {
        frames.push({ frame: i, path: framePath, cached: true });
        this.cacheHits++;
      } else {
        frames.push({ frame: i, path: null, cached: false });
      }
    }
    
    return frames;
  }
  
  async cacheFrame(asset, frameNum) {
    const assetId = this.getAssetId(asset);
    const framePath = path.join(this.cacheDir, `${assetId}_frame_${frameNum.toString().padStart(6, '0')}.jpg`);
    
    if (fs.existsSync(framePath)) {
      return framePath;
    }
    
    try {
      const proxyPath = await this.getProxyPath(asset, assetId);
      const time = frameNum / 30; // 假设 30fps
      
      const cmd = `ffmpeg -i "${proxyPath}" -ss ${time} -vframes 1 -q:v 2 -y "${framePath}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 30000 });
      
      this.cacheMisses++;
      return framePath;
    } catch (error) {
      console.error(`[ContextManager] 帧缓存失败: ${asset} frame ${frameNum}`);
      return null;
    }
  }
  
  // ============ Layer 4: 时间线虚拟投影 ============
  async projectTimeline(timeline, viewportRange) {
    if (!this.enableVirtualProjection) {
      return timeline;
    }
    
    const { start, end } = viewportRange;
    const projected = [];
    
    for (const clip of timeline) {
      // 判断剪辑是否在可视范围内
      if (clip.out < start || clip.in > end) {
        // 范围外：虚拟投影为缩略图摘要
        projected.push({
          ...clip,
          _projected: true,
          _projectionType: 'thumbnail',
          thumbnail: await this.getThumbnail(clip.asset, clip.in),
          detail: null // 不加载完整数据
        });
      } else {
        // 范围内：加载完整数据
        projected.push({
          ...clip,
          _projected: false,
          detail: await this.loadVisibleRange(clip.asset, { inPoint: clip.in, outPoint: clip.out })
        });
      }
    }
    
    return projected;
  }
  
  async getThumbnail(asset, time) {
    const assetId = this.getAssetId(asset);
    const thumbPath = path.join(this.cacheDir, `${assetId}_thumb_${Math.floor(time)}.jpg`);
    
    if (fs.existsSync(thumbPath)) {
      return thumbPath;
    }
    
    try {
      const proxyPath = await this.getProxyPath(asset, assetId);
      const cmd = `ffmpeg -i "${proxyPath}" -ss ${time} -vframes 1 -s 160x90 -y "${thumbPath}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 30000 });
      return thumbPath;
    } catch (error) {
      return null;
    }
  }
  
  // ============ Layer 5: AI素材摘要 ============
  async generateAssetSummary(asset) {
    const assetId = this.getAssetId(asset);
    const summaryPath = path.join(this.cacheDir, `${assetId}_summary.json`);
    
    if (fs.existsSync(summaryPath)) {
      return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    }
    
    // 生成素材摘要（此处简化实现）
    const summary = {
      assetId,
      duration: await this.getDuration(asset),
      resolution: await this.getResolution(asset),
      sceneTypes: ['interview', 'b-roll'], // 占位
      keyFrames: [],
      colorProfile: 'Rec.709',
      audioTracks: 2,
      generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    return summary;
  }
  
  // ============ 分辨率升级 ============
  async upgradeResolution(assetId, targetLevel) {
    const level = RESOLUTION_LEVELS[targetLevel];
    if (!level) {
      throw new Error(`未知分辨率级别: ${targetLevel}`);
    }
    
    const originalPath = this.findOriginalAsset(assetId);
    if (!originalPath) {
      throw new Error(`找不到原始素材: ${assetId}`);
    }
    
    const outputPath = path.join(this.projectDir, 'renders', `${assetId}_${targetLevel}.mov`);
    
    try {
      let cmd;
      if (targetLevel === 'proxy' || targetLevel === 'edit') {
        cmd = `ffmpeg -i "${originalPath}" -vf "scale=${level.scale}" -c:v ${level.codec} -preset ${level.preset} -crf ${level.crf} -an -y "${outputPath}"`;
      } else {
        cmd = `ffmpeg -i "${originalPath}" -c:v ${level.codec} -profile:v ${level.profile} -an -y "${outputPath}"`;
      }
      
      execSync(cmd, { stdio: 'pipe', timeout: 600000 });
      return outputPath;
    } catch (error) {
      throw new Error(`分辨率升级失败: ${error.message}`);
    }
  }
  
  // ============ 批量生成代理 ============
  async batchGenerateProxies(assets) {
    const results = [];
    
    for (const asset of assets) {
      const assetId = this.getAssetId(asset);
      const proxyPath = await this.generateProxy(asset, assetId);
      results.push({ assetId, proxyPath, success: !!proxyPath });
    }
    
    this.saveIndex();
    return results;
  }
  
  // ============ 缓存清理 ============
  async cleanCache() {
    const now = Date.now();
    const ttlMs = this.cacheTTLHours * 3600000;
    let cleaned = 0;
    let freedBytes = 0;
    
    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      const stat = fs.statSync(filePath);
      
      if (now - stat.mtimeMs > ttlMs) {
        freedBytes += stat.size;
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    
    return { cleaned, freedBytes: Math.round(freedBytes / 1024 / 1024) };
  }
  
  // ============ 缓存统计 ============
  getStats() {
    const totalHits = this.cacheHits;
    const totalMisses = this.cacheMisses;
    const hitRate = totalHits + totalMisses > 0 
      ? (totalHits / (totalHits + totalMisses) * 100).toFixed(1)
      : 0;
    
    return {
      cacheHits: totalHits,
      cacheMisses: totalMisses,
      hitRate: `${hitRate}%`,
      proxyGenerated: this.proxyGenerated,
      loadedAssets: this.loadedAssets.size,
      maxCacheSizeMB: this.maxCacheSizeMB,
      cacheTTLHours: this.cacheTTLHours
    };
  }
  
  // ============ 辅助方法 ============
  getAssetId(assetPath) {
    // 基于文件路径生成唯一ID
    const hash = this.simpleHash(assetPath);
    return `${path.basename(assetPath, path.extname(assetPath))}_${hash}`;
  }
  
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
  
  getProxyPath(asset, assetId) {
    const proxyPath = path.join(this.proxyDir, `${assetId}_480p.mp4`);
    if (fs.existsSync(proxyPath)) {
      return proxyPath;
    }
    return this.generateProxy(asset, assetId);
  }
  
  findOriginalAsset(assetId) {
    const assetDir = path.join(this.projectDir, 'assets');
    if (!fs.existsSync(assetDir)) return null;
    
    const files = fs.readdirSync(assetDir);
    const match = files.find(f => f.includes(assetId.split('_')[0]));
    return match ? path.join(assetDir, match) : null;
  }
  
  async getDuration(assetPath) {
    try {
      const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${assetPath}"`;
      const duration = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
      return parseFloat(duration.trim());
    } catch {
      return 0;
    }
  }
  
  async getResolution(assetPath) {
    try {
      const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${assetPath}"`;
      const resolution = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
      return resolution.trim();
    } catch {
      return 'unknown';
    }
  }
  
  // ============ 索引管理 ============
  loadIndex() {
    if (fs.existsSync(this.indexPath)) {
      this.index = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    } else {
      this.index = { assets: {}, lastUpdated: new Date().toISOString() };
    }
  }
  
  saveIndex() {
    this.index.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }
  
  getProjectDir(projectId) {
    return path.join(process.cwd(), 'projects', projectId);
  }
}

// ============ 便捷函数 ============
export function createContextManager(projectId, config) {
  return new ContextManager(projectId, config);
}

export { RESOLUTION_LEVELS };

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const cm = new ContextManager('test-project');
  
  console.log('=== Context Manager 测试 ===');
  console.log('分辨率级别:', Object.keys(RESOLUTION_LEVELS));
  console.log('统计:', cm.getStats());
}
