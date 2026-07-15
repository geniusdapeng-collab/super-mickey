#!/usr/bin/env node
/**
 * PersonaVault Bridge v1.1-Peng
 * StoryForge Pro ↔ PersonaVault 集成桥接
 * v5.1-Peng: 防御式编程，确保数组迭代安全
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// 动态加载 PersonaVault
let PersonaVault;
try {
  PersonaVault = require('../persona-vault/persona-vault.js');
} catch (e) {
  console.log('⚠️ PersonaVault 未安装，跳过角色灵魂铸造');
}

class PersonaVaultBridge {
  constructor(outputDir) {
    this.enabled = !!PersonaVault;
    if (this.enabled) {
      this.vault = new PersonaVault(path.join(outputDir, 'persona-vault'));
      this.outputDir = outputDir;
    }
  }

  // ========== 阶段 1: 角色铸造 ==========
  async forgeCharacters(characters, theme, world) {
    if (!this.enabled) return characters;
    
    console.log('\n🔥 [PersonaVault Bridge] 开始角色灵魂铸造...');
    
    // v5.1-Peng: 防御式编程，确保characters是数组
    const charArray = Array.isArray(characters) ? characters : 
                      (characters && Array.isArray(characters.characters)) ? characters.characters : 
                      (characters ? [characters] : []);
    
    const forged = [];
    for (const char of charArray) {
      const role = char.role || (char.isAntagonist ? 'antagonist' : 'protagonist');
      const charId = char.id || `C${String(forged.length + 1).padStart(2, '0')}`;
      
      const profile = await this.vault.womb({
        name: char.name,
        desc: char.description || char.bio || `${char.name} - ${role}`,
        role,
        worldContext: world.description || world.summary || '',
        themeAnchor: theme.coreTheme || theme.mainTheme || '',
        characterId: charId
      });
      
      // 将灵魂档案注入角色对象
      char.personaVault = {
        characterId: charId,
        woundProfile: profile.woundProfile,
        gravityMap: profile.gravityMap,
        empathyMatrix: profile.empathyMatrix
      };
      
      forged.push(char);
    }
    
    // 计算全局镜像关系
    await this.vault.mirror();
    
    console.log(`✅ [PersonaVault Bridge] ${forged.length} 个角色灵魂铸造完成`);
    return { characters: forged, vault: this.vault };
  }

  // ========== 阶段 2: 场景张力增强 ==========
  async enhanceScenes(scenes, characters) {
    if (!this.enabled) return scenes;
    
    console.log('\n🌐 [PersonaVault Bridge] 注入场景张力...');
    
    // v5.1-Peng: 防御式编程
    const sceneArray = Array.isArray(scenes) ? scenes : 
                       (scenes && Array.isArray(scenes.scenes)) ? scenes.scenes : 
                       (scenes ? [scenes] : []);
    const charArray = Array.isArray(characters) ? characters : 
                      (characters && Array.isArray(characters.characters)) ? characters.characters : [];
    
    // 为每个场景注入引力场影响
    for (const scene of sceneArray) {
      const sceneChars = scene.characters || [];
      if (sceneChars.length < 2) continue;
      
      // 找到场景中最强的引力对
      let maxTension = 0;
      let tensionSource = null;
      
      for (let i = 0; i < sceneChars.length; i++) {
        for (let j = i + 1; j < sceneChars.length; j++) {
          const charA = charArray.find(c => c.name === sceneChars[i] || c.personaVault?.characterId === sceneChars[i]);
          const charB = charArray.find(c => c.name === sceneChars[j] || c.personaVault?.characterId === sceneChars[j]);
          
          if (charA?.personaVault?.gravityMap?.gravityMap) {
            const gravity = charA.personaVault.gravityMap.gravityMap;
            const targetKey = Object.keys(gravity).find(k => 
              k.includes(sceneChars[j]) || sceneChars[j].includes(k)
            );
            if (targetKey && gravity[targetKey]) {
              const tension = this.calculateTension(gravity[targetKey]);
              if (tension > maxTension) {
                maxTension = tension;
                tensionSource = {
                  source: sceneChars[i],
                  target: sceneChars[j],
                  gravity: gravity[targetKey]
                };
              }
            }
          }
        }
      }
      
      if (tensionSource) {
        scene.personaTension = {
          level: maxTension,
          source: tensionSource,
          suggestedDirection: tensionSource.gravity?.sceneImpact || '自然互动'
        };
      }
    }
    
    console.log('✅ [PersonaVault Bridge] 场景张力注入完成');
    return scenes;
  }

  calculateTension(gravity) {
    let tension = 50;
    const forceType = (gravity.forceType || '').toLowerCase();
    
    if (forceType.includes('拉扯')) tension = 90;
    else if (forceType.includes('推动')) tension = 75;
    else if (forceType.includes('试探')) tension = 70;
    else if (forceType.includes('追逐')) tension = 65;
    else if (forceType.includes('相斥')) tension = 80;
    
    return Math.min(100, tension);
  }

  // ========== 阶段 3: 一致性校验 ==========
  async guardEpisode(episodeData, episodeNum) {
    if (!this.enabled) return null;
    
    const epId = `E${String(episodeNum).padStart(3, '0')}`;
    console.log(`\n🛡️ [PersonaVault Bridge] 校验 ${epId}...`);
    
    // 构建简化剧本格式
    const script = {
      scenes: episodeData.scenes || [],
      dialogue: episodeData.dialogue || [],
      actions: episodeData.actions || [],
      emotionalMarkers: episodeData.emotionalMarkers || []
    };
    
    try {
      const report = await this.vault.guard({
        episode: epId,
        episodeScript: JSON.stringify(script)
      });
      
      console.log(`✅ [PersonaVault Bridge] ${epId} 一致性得分: ${report?.overallScore || 'N/A'}/100`);
      
      // 保存报告
      const reportPath = path.join(this.outputDir, 'persona-vault', `consistency-${epId}.json`);
      fss.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      return report;
    } catch (e) {
      console.log(`⚠️ [PersonaVault Bridge] 校验跳过: ${e.message}`);
      return null;
    }
  }

  // ========== 阶段 4: 生成角色报告 ==========
  async generateReport(format = 'md') {
    if (!this.enabled) return null;
    
    console.log('\n📊 [PersonaVault Bridge] 生成角色灵魂报告...');
    
    const report = this.vault.report({ format });
    
    if (typeof report === 'string') {
      const reportPath = path.join(this.outputDir, 'persona-vault', `persona-report.${format}`);
      fss.writeFileSync(reportPath, report);
      console.log(`✅ [PersonaVault Bridge] 报告已保存: ${reportPath}`);
    }
    
    return report;
  }

  // ========== 工具方法 ==========
  getState() {
    if (!this.enabled) return null;
    return this.vault.state();
  }

  getCharacterWound(characterId) {
    if (!this.enabled) return null;
    const char = this.vault.state({ characterId });
    return char?.wound || null;
  }
}

module.exports = PersonaVaultBridge;