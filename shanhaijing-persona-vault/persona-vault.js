#!/usr/bin/env node
/**
 * PersonaVault v1.0-Peng — 角色灵魂铸造系统
 * 主入口 / CLI
 * 
 * 命令:
 *   pv womb --name "xxx" --desc "..." [--role protagonist] [--world "..."] [--theme "..."]
 *   pv gravity --id C01 [--with C02,C03]
 *   pv empathy --id C05
 *   pv evolve --id C01 --episodes 80
 *   pv mirror --characters C01,C02,C05,C06
 *   pv guard --episode E25 --script ./E25.json
 *   pv state [--character C01]
 *   pv report --episode E25 [--format md]
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const WoundMiner = require('./agents/wound-miner');
const GravityWeaver = require('./agents/gravity-weaver');
const EmpathyEngine = require('./agents/empathy-engine');
const EvolutionTracker = require('./agents/evolution-tracker');
// mirror-engine.js 在仓库中已丢失(见 guardian.js 尾部残留的原始路径标记)
// 改为可选加载: 缺失时镜像矩阵功能降级, 不影响其他 Agent
let MirrorEngine = null;
try {
  MirrorEngine = require('./agents/mirror-engine');
} catch (e) {
  console.warn('[PersonaVault] mirror-engine 模块缺失, 镜像矩阵功能已降级');
}
const Guardian = require('./agents/guardian');
const StateBus = require('./state-bus');

class PersonaVault {
  constructor(projectDir = './persona-vault-data') {
    this.projectDir = projectDir;
    this.stateBus = new StateBus(projectDir);
    this.miner = new WoundMiner(this.stateBus);
    this.weaver = new GravityWeaver(this.stateBus);
    this.empathyEngine = new EmpathyEngine(this.stateBus);
    this.evolutionTracker = new EvolutionTracker(this.stateBus);
    this.mirrorEngine = MirrorEngine ? new MirrorEngine(this.stateBus) : null;
    this.guardian = new Guardian(this.stateBus);
  }

  // 1. 孵化角色
  async womb(opts = {}) {
    const { name, desc, role = 'protagonist', worldContext = '', themeAnchor = '', characterId } = opts || {};
    console.log(`\n🔥 [PersonaVault] 孵化角色: ${name}`);
    const id = characterId || `C${String(this.stateBus.getCharacterCount() + 1).padStart(2, '0')}`;
    
    // 阶段1: Wound Miner 挖掘伤口
    const woundProfile = await this.miner.mine({
      characterId: id,
      characterName: name,
      oneLiner: desc,
      role,
      worldContext,
      themeAnchor
    });
    
    // 阶段2: Gravity Weaver 计算引力场
    const otherChars = this.stateBus.getAllCharacterIds().filter(cid => cid !== id);
    const gravityMap = await this.weaver.weave({
      sourceCharacter: id,
      woundProfile,
      otherCharacters: otherChars
    });
    
    // 阶段3: Empathy Engine (如果是反派)
    let empathyMatrix = null;
    if (role === 'antagonist' || role === 'tragic-hero') {
      empathyMatrix = await this.empathyEngine.calculate({
        characterId: id,
        characterName: name,
        woundProfile,
        storyFunction: desc,
        themeAnchor
      });
    }
    
    // 保存到状态总线
    await this.stateBus.updateCharacter(id, {
      name,
      role,
      desc,
      wound: woundProfile.wound,
      breathing: woundProfile.breathing,
      gravity: gravityMap,
      empathy: empathyMatrix
    });
    
    console.log(`✅ [PersonaVault] ${name}(${id}) 灵魂铸造完成`);
    console.log(`   伤口层级: 表层/结构性/存在性`);
    console.log(`   引力关系: ${otherChars.length}个角色`);
    if (empathyMatrix) console.log(`   共情矩阵: 同情${empathyMatrix.empathyMatrix?.sympathyScore}/反感${empathyMatrix.empathyMatrix?.repulsionScore}`);
    
    return { characterId: id, name, woundProfile, gravityMap, empathyMatrix };
  }

  // 2. 计算引力场
  async gravity(opts = {}) {
    const { characterId, withCharacters = [] } = opts || {};
    console.log(`\n🌐 [PersonaVault] 计算引力场: ${characterId}`);
    const char = this.stateBus.getCharacter(characterId);
    if (!char) throw new Error(`角色 ${characterId} 不存在`);
    
    const targetIds = withCharacters.length > 0 
      ? withCharacters 
      : this.stateBus.getAllCharacterIds().filter(cid => cid !== characterId);
    
    const gravityMap = await this.weaver.weave({
      sourceCharacter: characterId,
      woundProfile: { wound: char.wound, breathing: char.breathing },
      otherCharacters: targetIds
    });
    
    await this.stateBus.updateCharacter(characterId, { gravity: gravityMap });
    console.log(`✅ 引力场更新完成: ${Object.keys(gravityMap.gravityMap || {}).length} 个关系`);
    return gravityMap;
  }

  // 3. 反派同情术
  async empathy(opts = {}) {
    const { characterId } = opts || {};
    console.log(`\n💔 [PersonaVault] 共情引擎: ${characterId}`);
    const char = this.stateBus.getCharacter(characterId);
    if (!char) throw new Error(`角色 ${characterId} 不存在`);
    
    if (char.role !== 'antagonist' && char.role !== 'tragic-hero') {
      console.log(`⚠️ ${characterId} 不是反派/悲剧英雄，跳过共情计算`);
      return null;
    }
    
    const empathyMatrix = await this.empathyEngine.calculate({
      characterId,
      characterName: char.name,
      woundProfile: { wound: char.wound },
      storyFunction: char.desc,
      themeAnchor: char.themeAnchor || ''
    });
    
    await this.stateBus.updateCharacter(characterId, { empathy: empathyMatrix });
    console.log(`✅ 共情矩阵: 同情${empathyMatrix.empathyMatrix?.sympathyScore}/反感${empathyMatrix.empathyMatrix?.repulsionScore}/复杂度${empathyMatrix.empathyMatrix?.complexityScore}`);
    return empathyMatrix;
  }

  // 4. 设计成长轨迹
  async evolve(opts = {}) {
    const { characterId, episodes = 80, structureOutline = null } = opts || {};
    console.log(`\n📈 [PersonaVault] 进化追踪: ${characterId} (${episodes}集)`);
    const char = this.stateBus.getCharacter(characterId);
    if (!char) throw new Error(`角色 ${characterId} 不存在`);
    
    const gravityMap = char.gravity || {};
    const evolutionTrack = await this.evolutionTracker.track({
      characterId,
      woundProfile: { wound: char.wound },
      gravityMap,
      totalEpisodes: episodes,
      structureOutline
    });
    
    await this.stateBus.updateCharacter(characterId, { evolution: evolutionTrack });
    console.log(`✅ 进化轨迹: ${evolutionTrack.evolutionTrack?.keyTurningPoints?.length} 个关键转折点`);
    console.log(`   ${episodes}集状态快照已生成`);
    return evolutionTrack;
  }

  // 5. 计算镜像关系
  async mirror(opts = {}) {
    const { characterIds = null } = opts || {};
    const ids = characterIds || this.stateBus.getAllCharacterIds();
    console.log(`\n🪞 [PersonaVault] 镜像引擎: ${ids.join(', ')}`);
    
    const personas = ids.map(id => this.stateBus.getCharacter(id)).filter(Boolean);
    const mirrorMatrix = this.mirrorEngine
      ? await this.mirrorEngine.calculate({ allPersonas: ids, personaStates: personas })
      : null; // mirror-engine 缺失时降级
    
    await this.stateBus.updateGlobal({ mirrors: mirrorMatrix.mirrors });
    console.log(`✅ 镜像关系: ${mirrorMatrix.mirrors?.length} 对`);
    return mirrorMatrix;
  }

  // 6. 一致性校验
  async guard(opts = {}) {
    const { episode, episodeScript, scriptPath = null } = opts || {};
    console.log(`\n🛡️ [PersonaVault] Guardian 校验: ${episode}`);
    
    let script = episodeScript;
    if (!script && scriptPath) {
      script = JSON.parse(fss.readFileSync(scriptPath, 'utf8'));
    }
    if (!script) throw new Error('需要提供 episodeScript 或 scriptPath');
    
    const report = await this.guardian.check({
      episode,
      episodeScript: script,
      characterIds: this.stateBus.getAllCharacterIds(),
      personaState: this.stateBus.getFullState(),
      evolutionSnapshots: this.stateBus.getAllEvolutionSnapshots()
    });
    
    await this.stateBus.appendConsistencyLog({ episode, ...report });
    console.log(`✅ 一致性得分: ${report.overallScore}/100`);
    if (report.corrections?.length > 0) {
      console.log(`⚠️ 发现 ${report.corrections.length} 处偏差，已生成修复建议`);
    }
    return report;
  }

  // 查看状态
  state(opts = {}) {
    const { characterId = null } = opts || {};
    if (characterId) {
      return this.stateBus.getCharacter(characterId);
    }
    return this.stateBus.getFullState();
  }

  // 生成报告
  report(opts = {}) {
    const { episode, format = 'md' } = opts || {};
    const state = this.stateBus.getFullState();
    const log = this.stateBus.getConsistencyLog(episode);
    
    if (format === 'md') {
      return this.generateMarkdownReport(state, log, episode);
    }
    return { state, log };
  }

  generateMarkdownReport(state, log, episode) {
    const chars = Object.entries(state.characters || {});
    let md = `# PersonaVault 角色报告 — ${state.project || '未命名项目'}\n\n`;
    md += `**集数**: ${episode || '全局'}\n`;
    md += `**角色数**: ${chars.length}\n`;
    md += `**更新时间**: ${state.lastUpdated || new Date().toISOString()}\n\n`;
    
    md += `## 角色灵魂档案\n\n`;
    chars.forEach(([id, char]) => {
      md += `### ${char.name} (${id}) — ${char.role}\n\n`;
      if (char.wound) {
        md += `- **表层伤口**: ${char.wound.surface?.event || '未定义'}\n`;
        md += `- **核心谎言**: ${char.wound.structure?.coreLie || '未定义'}\n`;
        md += `- **核心需求**: ${char.wound.structure?.coreNeed || '未定义'}\n`;
        md += `- **存在性恐惧**: ${char.wound.existential?.fundamentalFear || '未定义'}\n`;
      }
      if (char.breathing) {
        md += `- **语言指纹**: ${char.breathing.sentenceSignature || '未定义'}\n`;
      }
      md += '\n';
    });
    
    if (state.mirrors?.length > 0) {
      md += `## 角色镜像关系\n\n`;
      state.mirrors.forEach(m => {
        md += `- **${m.pair?.join(' ↔ ')}**: ${m.mirrorType}\n`;
        md += `  - 伤口相似度: ${m.woundSimilarity}%\n`;
        md += `  - 主题意义: ${m.thematicMeaning}\n\n`;
      });
    }
    
    if (log) {
      md += `## 一致性校验 — ${episode}\n\n`;
      md += `**总体得分**: ${log.overallScore}/100\n\n`;
      (log.checks || []).forEach(check => {
        const icon = check.status === 'PASS' ? '✅' : (check.status === 'FAIL' ? '❌' : '⚠️');
        md += `- ${icon} **${check.characterId}** ${check.checkType}: ${check.status}\n`;
        if (check.note) md += `  - ${check.note}\n`;
      });
      
      if (log.corrections?.length > 0) {
        md += `\n### 修复建议\n\n`;
        log.corrections.forEach(c => {
          md += `- **${c.characterId}**: ${c.type}\n`;
          md += `  - 原文: "${c.original}"\n`;
          md += `  - 建议: "${c.suggested}"\n`;
        });
      }
    }
    
    return md;
  }
}

// CLI 入口
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vault = new PersonaVault(args.projectDir || './persona-vault-data');
  
  switch (args.command) {
    case 'womb':
      await vault.womb({
        name: args.name,
        desc: args.desc || args.description,
        role: args.role || 'protagonist',
        worldContext: args.world,
        themeAnchor: args.theme,
        characterId: args.id
      });
      break;
    case 'gravity':
      await vault.gravity({
        characterId: args.id || args.characterId,
        withCharacters: (args.with || '').split(',').filter(Boolean)
      });
      break;
    case 'empathy':
      await vault.empathy({ characterId: args.id || args.characterId });
      break;
    case 'evolve':
      await vault.evolve({
        characterId: args.id || args.characterId,
        episodes: parseInt(args.episodes) || 80
      });
      break;
    case 'mirror':
      await vault.mirror({
        characterIds: args.characters ? args.characters.split(',').filter(Boolean) : null
      });
      break;
    case 'guard':
      await vault.guard({
        episode: args.episode,
        scriptPath: args.script
      });
      break;
    case 'state':
      const state = vault.state(args.character ? args.character : null);
      console.log(JSON.stringify(state, null, 2));
      break;
    case 'report':
      const report = vault.report({ episode: args.episode, format: args.format || 'md' });
      if (typeof report === 'string') {
        const outPath = args.output || `./persona-report-${args.episode || 'global'}.md`;
        fss.writeFileSync(outPath, report);
        console.log(`✅ 报告已生成: ${outPath}`);
      } else {
        console.log(JSON.stringify(report, null, 2));
      }
      break;
    default:
      console.log(`
🎭 PersonaVault — 角色灵魂铸造系统 v1.0-Peng

用法: node persona-vault.js <command> [options]

命令:
  womb      孵化角色        --name "xxx" --desc "..." [--role protagonist]
  gravity   计算引力场      --id C01 [--with C02,C03]
  empathy   反派同情术      --id C05
  evolve    设计成长轨迹    --id C01 --episodes 80
  mirror    计算镜像关系    --characters C01,C02,C05,C06
  guard     一致性校验      --episode E25 --script ./E25.json
  state     查看状态总线    [--character C01]
  report    生成角色报告    --episode E25 [--format md]

示例:
  node persona-vault.js womb --name "神话主角A" --desc "石猴出身的妖王" --role protagonist
  node persona-vault.js evolve --id C01 --episodes 80
  node persona-vault.js guard --episode E25 --script ./episode-25.json
      `);
  }
}

function parseArgs(argv) {
  const args = { command: argv[0] };
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = PersonaVault;