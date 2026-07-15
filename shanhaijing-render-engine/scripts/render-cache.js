/**
 * 渲染缓存层 (P1-4.2)
 * 避免重复提交相同的提示词+参数组合
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// 缓存存储路径
const CACHE_DIR = path.join(require('os').homedir(), '.openclaw', 'render-cache');
if (!fss.existsSync(CACHE_DIR)) {
  fss.mkdirSync(CACHE_DIR, { recursive: true });
}

// 内存缓存
const memoryCache = new Map();

/**
 * 生成缓存键 (SHA-256 哈希)
 */
function generateCacheKey(prompt, model, seed, duration, ratio) {
  const content = JSON.stringify({ prompt, model, seed, duration, ratio });
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * 检查缓存是否存在且有效
 */
function checkCache(key, maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 默认7天
  // 先查内存
  const memHit = memoryCache.get(key);
  if (memHit && Date.now() - memHit.timestamp < maxAgeMs) {
    return { hit: true, videoPath: memHit.videoPath, source: 'memory' };
  }

  // 再查磁盘
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  if (fss.existsSync(cacheFile)) {
    try {
      const diskCache = JSON.parse(fss.readFileSync(cacheFile, 'utf8'));
      if (diskCache.videoPath && fss.existsSync(diskCache.videoPath)) {
        if (Date.now() - diskCache.timestamp < maxAgeMs) {
          // 回填内存
          memoryCache.set(key, diskCache);
          return { hit: true, videoPath: diskCache.videoPath, source: 'disk' };
        }
      }
    } catch (e) {
      // 缓存损坏，静默忽略
    }
  }

  return { hit: false };
}

/**
 * 写入缓存
 */
function setCache(key, videoPath) {
  const entry = {
    videoPath,
    timestamp: Date.now()
  };

  // 写内存
  memoryCache.set(key, entry);

  // 写磁盘
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  try {
    fss.writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
  } catch (e) {
    // 磁盘写入失败不影响流程
    console.warn(`[RenderCache] 磁盘缓存写入失败: ${e.message}`);
  }
}

/**
 * 清理过期缓存
 */
function cleanupCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const files = fss.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file);
    try {
      const cache = JSON.parse(fss.readFileSync(filePath, 'utf8'));
      if (Date.now() - cache.timestamp > maxAgeMs) {
        fss.unlinkSync(filePath);
        if (cache.videoPath && fss.existsSync(cache.videoPath)) {
          fss.unlinkSync(cache.videoPath);
        }
        cleaned++;
      }
    } catch (e) {
      // 损坏文件直接删除
      fss.unlinkSync(filePath);
      cleaned++;
    }
  }

  // 清理内存中过期项
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (now - entry.timestamp > maxAgeMs) {
      memoryCache.delete(key);
    }
  }

  return { cleaned, remaining: memoryCache.size };
}

module.exports = {
  generateCacheKey,
  checkCache,
  setCache,
  cleanupCache
};
