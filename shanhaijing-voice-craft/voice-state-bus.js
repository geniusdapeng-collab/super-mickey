const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

/**
 * Voice State Bus v9.2.0-Peng
 * voice-state.json 共享状态总线
 */
class VoiceStateBus {
  constructor(dataDir = './voice-craft-data') {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, 'voice-state.json');
    ensureDir(dataDir);
    this.state = this.loadState();
  }

  loadState() {
    if (fss.existsSync(this.statePath)) {
      try {
        return JSON.parse(fss.readFileSync(this.statePath, 'utf8'));
      } catch (e) {
        return this.createEmptyState();
      }
    }
    return this.createEmptyState();
  }

  createEmptyState() {
    return {
      version: '1.0-Peng',
      project: '',
      lastUpdated: new Date().toISOString(),
      signatures: {},
      subtexts: {},
      dialogues: {},
      silences: {},
      consistencyLog: []
    };
  }

  async saveState() {
    this.state.lastUpdated = new Date().toISOString();
    fss.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  // 签名相关
  getSignature(characterId) {
    return this.state.signatures[characterId] || null;
  }

  async updateSignature(characterId, signature) {
    this.state.signatures[characterId] = signature;
    await this.saveState();
  }

  // 潜台词相关
  getSubtext(sceneId) {
    return this.state.subtexts[sceneId] || null;
  }

  async updateSubtext(sceneId, subtextMap) {
    this.state.subtexts[sceneId] = subtextMap;
    await this.saveState();
  }

  // 对白相关
  getDialogue(sceneId) {
    return this.state.dialogues[sceneId] || null;
  }

  async updateDialogue(sceneId, stage, data) {
    if (!this.state.dialogues[sceneId]) {
      this.state.dialogues[sceneId] = {};
    }
    this.state.dialogues[sceneId][stage] = data;
    await this.saveState();
  }

  // 沉默设计相关
  getSilences(sceneId) {
    return this.state.silences[sceneId] || null;
  }

  async updateSilences(sceneId, silenceDesign) {
    this.state.silences[sceneId] = silenceDesign;
    await this.saveState();
  }

  // 一致性日志
  async appendConsistencyLog(entry) {
    this.state.consistencyLog.push({
      timestamp: new Date().toISOString(),
      ...entry
    });
    await this.saveState();
  }

  getFullState() {
    return { ...this.state };
  }
}

function ensureDir(dir) {
  if (!fss.existsSync(dir)) {
    fss.mkdirSync(dir, { recursive: true });
  }
}

module.exports = VoiceStateBus;