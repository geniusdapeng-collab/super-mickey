const fs = require('fs');
const path = require('path');

class ShotDebugRecorder {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'debug-shot-records');
    this.enabled = options.enabled !== false;

    if (this.enabled && !fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  record(shotId, payload = {}) {
    if (!this.enabled) return null;

    const safeShotId = String(shotId || 'unknown').replace(/[^\w\-]/g, '_');
    const filePath = path.join(this.outputDir, `${safeShotId}.json`);

    const enriched = {
      shotId,
      recordedAt: new Date().toISOString(),
      ...payload
    };

    fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2), 'utf8');
    return filePath;
  }

  append(shotId, partialPayload = {}) {
    if (!this.enabled) return null;

    const safeShotId = String(shotId || 'unknown').replace(/[^\w\-]/g, '_');
    const filePath = path.join(this.outputDir, `${safeShotId}.json`);

    let existing = {};
    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        existing = {};
      }
    }

    const merged = {
      ...existing,
      ...partialPayload,
      shotId,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
    return filePath;
  }
}

module.exports = { ShotDebugRecorder };
