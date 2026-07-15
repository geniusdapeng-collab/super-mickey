#!/usr/bin/env node
/**
 * PersonaVault State Bus — 状态总线管理
 * 
 * 管理 persona-state.json 的读写、版本控制、字符化序列
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

class StateBus {
  constructor(projectDir = './persona-vault-data') {
    this.projectDir = projectDir;
    this.statePath = path.join(projectDir, 'persona-state.json');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fss.existsSync(this.projectDir)) {
      fss.mkdirSync(this.projectDir, { recursive: true });
    }
  }

  loadState() {
    if (fss.existsSync(this.statePath)) {
      return JSON.parse(fss.readFileSync(this.statePath, 'utf8'));
    }
    return {
      version: '1.0',
      project: '未命名项目',
      lastUpdated: new Date().toISOString(),
      characters: {},
      wounds: {},
      gravity: {},
      empathy: {},
      evolution: {},
      mirrors: [],
      consistencyLog: []
    };
  }

  saveState(state) {
    state.lastUpdated = new Date().toISOString();
    fss.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  getCharacterCount() {
    const state = this.loadState();
    return Object.keys(state.characters || {}).length;
  }

  getAllCharacterIds() {
    const state = this.loadState();
    return Object.keys(state.characters || {});
  }

  getCharacter(characterId) {
    const state = this.loadState();
    return state.characters?.[characterId] || null;
  }

  updateCharacter(characterId, data) {
    const state = this.loadState();
    state.characters = state.characters || {};
    state.characters[characterId] = {
      ...state.characters[characterId],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // 同步到 wounds/gravity/empathy/evolution
    if (data.wound) state.wounds[characterId] = data.wound;
    if (data.gravity) state.gravity[characterId] = data.gravity;
    if (data.empathy) state.empathy[characterId] = data.empathy;
    if (data.evolution) state.evolution[characterId] = data.evolution;
    
    this.saveState(state);
  }

  updateGlobal(data) {
    const state = this.loadState();
    Object.assign(state, data);
    this.saveState(state);
  }

  getFullState() {
    return this.loadState();
  }

  getAllEvolutionSnapshots() {
    const state = this.loadState();
    const snapshots = {};
    Object.entries(state.evolution || {}).forEach(([id, evo]) => {
      snapshots[id] = evo.evolutionTrack?.episodeSnapshots || [];
    });
    return snapshots;
  }

  appendConsistencyLog(logEntry) {
    const state = this.loadState();
    state.consistencyLog = state.consistencyLog || [];
    state.consistencyLog.push({
      ...logEntry,
      timestamp: new Date().toISOString()
    });
    this.saveState(state);
  }

  getConsistencyLog(episode) {
    const state = this.loadState();
    return state.consistencyLog?.find(l => l.episode === episode) || null;
  }
}

module.exports = StateBus;