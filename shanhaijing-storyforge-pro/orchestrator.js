#!/usr/bin/env node
/**
 * StoryForge Pro v3.6-Peng — 整合编排器
 * 支持三种模式：原创 / IP重构 / 系列短剧
 * 
 * 整合 ScreenplayCraft 精华：
 * - IP解析五步法
 * - 系列化卡点设计
 * - 竖屏镜头语言
 * - 钩子工厂
 * - 奇观设计
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const PersonaVaultBridge = require('./persona-vault-bridge.js');
const VoiceCraftBridge = require('./voice-craft-bridge.js');
const { execAsync } = require('../seedance-director/scripts/exec-utils');

// ============ 配置 ============
const SKILLS_DIR = path.join(__dirname, 'fillers');
const ENHANCERS_DIR = path.join(__dirname, 'enhancers');
const RENDERERS_DIR = path.join(__dirname, 'renderers');
const UNIVERSE_DIR = path.join(__dirname, 'universe');

// ============ 主入口 ============
async function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  
  console.log('\n🎬 StoryForge Pro v3.6-Peng');
  console.log('   专业剧本创作系统（ScreenplayCraft整合版）\n');
  
  switch (command) {
    case 'create':
      await runOriginalMode(args);
      break;
    case 'adapt':
      await runIPReconstructionMode(args);
      break;
    case 'series':
      await runSeriesMode(args);
      break;
    case 'render':
      await runRenderOnly(args);
      break;
    default:
      printHelp();
  }
}

// ============ 模式 A: 原创 ============
async function runOriginalMode(args) {
  console.log('📖 模式: 原创\n');
  
  const outputDir = args.output || './storyforge-output';
  ensureDir(outputDir);
  
  // Step 1: 主题提炼
  console.log('▶️ Step 1: 主题提炼...');
  const theme = await runFiller('l1-concept/theme-extractor.js', {
    mode: 'original',
    concept: args.concept,
    userIntent: args.userIntent || args.concept
  });
  
  // Step 2: 世界观构建
  console.log('▶️ Step 2: 世界观构建...');
  const world = await runFiller('l1-concept/world-builder.js', {
    mode: 'original',
    theme: theme,
    styleHint: args.style
  });
  
  // Step 3: 并行构建叙事层
  console.log('▶️ Step 3: 叙事层（并行）...');
  // v5.5-Peng-CinePrompt: 检测用户大纲是否包含高潮段落，决定是否使用五幕结构
  const hasClimaxInOutline = /高潮[：:]|高潮幕|climax[：:]/i.test(args.concept || '');
  const structurePreference = hasClimaxInOutline ? 'five-act' : 'kishotenketsu';
  console.log(`   📐 结构偏好: ${structurePreference} (${hasClimaxInOutline ? '大纲含高潮段落' : '默认四幕'})`);
  
  const [structure, characters] = await Promise.all([
    runFiller('l2-narrative/structure-engine.js', { theme, world, duration: args.duration, videoType: args.videoType, structurePreference }),
    runFiller('l2-narrative/character-forge.js', { theme, world, characterCount: args.characterCount || 3 })
  ]);
  
  // Step 3.5: PersonaVault 角色灵魂铸造
  const pvBridge = new PersonaVaultBridge(outputDir);
  const forgedCharacters = await pvBridge.forgeCharacters(characters, theme, world);
  
  // Step 3.6: VoiceCraft 声纹提取
  const vcBridge = new VoiceCraftBridge(outputDir + '/voice-craft', outputDir);
  const voiceSignatures = await vcBridge.forgeVoiceSignatures(forgedCharacters.characters || characters);
  
  // Step 4: 情节编织（需要structure和characters）
  console.log('▶️ Step 4: 情节编织...');
  const plot = await runFiller('l2-narrative/plot-weaver.js', { 
    theme, world, structure, characterData: { characters: forgedCharacters.characters || characters }, videoType: args.videoType 
  });
  
  // Step 5: 并行构建剧本层
  console.log('▶️ Step 5: 剧本层（并行）...');
  const [scenes, dialogues, cinematography] = await Promise.all([
    runFiller('l3-script/scene-writer.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world }),
    runFiller('l3-script/dialogue-master.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world }),
    runFiller('l3-script/cinematography-planner.js', { plot, world, visualStyle: args.style, duration: args.duration, videoType: args.videoType })
  ]);
  
  // Step 5.5: PersonaVault 场景张力增强
  await pvBridge.enhanceScenes(scenes, forgedCharacters.characters || characters);
  
  // Step 5.6: VoiceCraft 声音注入（潜台词+对白+失控+沉默+校验）
  await vcBridge.enhanceScenes(scenes, forgedCharacters.characters || characters, {
    characterWounds: extractWounds(forgedCharacters.characters || characters)
  });
  
  // Step 6: 组装 Story Universe
  console.log('▶️ Step 6: 组装 Story Universe...');
  const universe = buildUniverse({ theme, world, structure, characters, plot, scenes, dialogues, cinematography, metadata: { title: args.title, concept: args.concept, duration: args.duration, mode: 'create', style: args.style, videoType: args.videoType } });
  
  // Step 7: 条件增强
  if (args.aspect === '9:16') {
    console.log('▶️ Step 7: 竖屏转换...');
    const verticalResult = await runEnhancer('m1-vertical-engine.js', universe.scenes);
    if (verticalResult && verticalResult.shots) universe.scenes = verticalResult;
  }
  
  if (args.spectacle !== 'minimal') {
    console.log('▶️ Step 8: 奇观设计...');
    const spectacleResult = await runEnhancer('m5-spectacle-designer.js', { scenes: universe.scenes, level: args.spectacle });
    if (spectacleResult && Array.isArray(spectacleResult.scenes)) {
      universe.scenes = spectacleResult.scenes;
    }
  }
  
  // Step 8: 保存 Universe
  const universePath = path.join(outputDir, 'story-universe.json');
  fss.writeFileSync(universePath, JSON.stringify(universe, null, 2));
  console.log(`✅ Universe 已保存: ${universePath}`);
  
  // Step 9: 渲染输出
  await renderAll(universe, outputDir, args);
  
  // Step 9.5: PersonaVault 生成角色报告
  await pvBridge.generateReport('md');
  
  // Step 9.6: VoiceCraft 生成声音报告
  // v7.1.0-fix: 使用 universe.scenes（已提取的数组）而非 scenes 对象
  const voiceReport = vcBridge.generateReport({ scenes: universe.scenes, number: 1 }, 'md');
  fss.writeFileSync(path.join(outputDir, 'voice-report.md'), voiceReport);
  console.log('   ✅ voice-report.md');
  
  console.log('\n✅ 原创模式完成！');
  console.log(`   输出目录: ${outputDir}`);
}

// ============ 模式 B: IP重构 ============
async function runIPReconstructionMode(args) {
  console.log('📚 模式: IP 重构\n');
  
  const outputDir = args.output || './storyforge-output';
  ensureDir(outputDir);
  
  // Step 1: IP解析（五步解析法）
  console.log('▶️ Step 1: IP 解析...');
  const ipAnalysis = await runFiller('l1-concept/ip-deconstructor.js', {
    source: args.source,
    sourceType: args.sourceType || 'auto',
    extractDepth: args.depth || 'medium',
    retentionRatio: args.retention || 0.4,
    userCreativeDirection: args.essence || args.setting
  });
  
  // Step 2-8: 同原创模式，但从IP分析开始
  const theme = await runFiller('l1-concept/theme-extractor.js', { mode: 'ip-based', ipAnalysis });
  const world = await runFiller('l1-concept/world-builder.js', { mode: 'ip-rebuild', theme, ipAnalysis });
  
  // Step 3: 并行构建叙事层
  const [structure, characters] = await Promise.all([
    runFiller('l2-narrative/structure-engine.js', { theme, world }),
    runFiller('l2-narrative/character-forge.js', { theme, world, ipCharacterMapping: ipAnalysis.characterMatrix })
  ]);
  
  // Step 3.5: PersonaVault 角色灵魂铸造
  const pvBridge = new PersonaVaultBridge(outputDir);
  const forgedCharacters = await pvBridge.forgeCharacters(characters, theme, world);
  
  // Step 3.6: VoiceCraft 声纹提取
  const vcBridge = new VoiceCraftBridge(outputDir + '/voice-craft', outputDir);
  const voiceSignatures = await vcBridge.forgeVoiceSignatures(forgedCharacters.characters || characters);
  
  // Step 4: 情节编织
  const plot = await runFiller('l2-narrative/plot-weaver.js', { 
    theme, world, structure, characterData: { characters: forgedCharacters.characters || characters }, videoType: args.videoType 
  });
  
  // Step 5: 剧本层
  const [scenes, dialogues, cinematography] = await Promise.all([
    runFiller('l3-script/scene-writer.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world }),
    runFiller('l3-script/dialogue-master.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world }),
    runFiller('l3-script/cinematography-planner.js', { plot, world, visualStyle: args.style, duration: args.duration, videoType: args.videoType })
  ]);
  
  // Step 5.5: PersonaVault 场景张力增强
  await pvBridge.enhanceScenes(scenes, forgedCharacters.characters || characters);
  
  // Step 5.6: VoiceCraft 声音注入
  await vcBridge.enhanceScenes(scenes, forgedCharacters.characters || characters, {
    characterWounds: extractWounds(forgedCharacters.characters || characters)
  });
  
  const universe = buildUniverse({ theme, world, structure, characters, plot, scenes, dialogues, cinematography, ipAnalysis, metadata: { title: args.title, source: args.source, essence: args.essence, setting: args.setting, duration: args.duration, mode: 'adapt', style: args.style, videoType: args.videoType } });
  
  // 保存 Universe
  const universePath = path.join(outputDir, 'story-universe.json');
  fss.writeFileSync(universePath, JSON.stringify(universe, null, 2));
  
  // 额外输出 IP 分析报告
  fss.writeFileSync(path.join(outputDir, 'ip-analysis-report.md'), generateIPReport(ipAnalysis));
  
  // 渲染
  await renderAll(universe, outputDir, args);
  
  // Step 9.5: PersonaVault 生成角色报告
  await pvBridge.generateReport('md');
  
  // Step 9.6: VoiceCraft 生成声音报告
  const voiceReport = vcBridge.generateReport({ scenes, number: 1 }, 'md');
  fss.writeFileSync(path.join(outputDir, 'voice-report.md'), voiceReport);
  console.log('   ✅ voice-report.md');
  
  console.log('\n✅ IP 重构模式完成！');
  console.log(`   输出目录: ${outputDir}`);
  console.log(`   IP报告: ${path.join(outputDir, 'ip-analysis-report.md')}`);
}

// ============ 模式 C: 系列短剧 ============
async function runSeriesMode(args) {
  console.log('📺 模式: 系列短剧\n');
  
  const outputDir = args.output || './storyforge-output';
  ensureDir(outputDir);
  
  // Step 1-3: 同原创/IP模式
  const ipAnalysis = args.source ? await runFiller('l1-concept/ip-deconstructor.js', { source: args.source }) : null;
  const theme = await runFiller('l1-concept/theme-extractor.js', { mode: ipAnalysis ? 'ip-based' : 'original', ipAnalysis });
  const world = await runFiller('l1-concept/world-builder.js', { theme, ipAnalysis });
  
  // Step 4: 系列化架构（M4）
  console.log('▶️ Step 4: 系列化架构...');
  const seriesPlan = await runEnhancer('m4-series-arc.js', {
    world, theme,
    totalEpisodes: parseInt(args.episodes) || 10,
    worldRevealingPlan: { layer1: '1-10', layer2: '11-40', layer3: '41-80' }
  });
  
  // Step 5: 结构 + 卡点（M2）
  console.log('▶️ Step 5: 结构设计 + 卡点...');
  let structure = await runFiller('l2-narrative/structure-engine.js', { theme, world, seriesConfig: seriesPlan });
  structure = await runEnhancer('m2-paywall-engine.js', { structure, paywallPositions: args.paywallPositions || '10,28,58' });
  
  // Step 6: 角色生成
  const characters = await runFiller('l2-narrative/character-forge.js', { theme, world });
  
  // Step 6.5: PersonaVault 角色灵魂铸造
  const pvBridge = new PersonaVaultBridge(outputDir);
  const forgedCharacters = await pvBridge.forgeCharacters(characters, theme, world);
  
  // Step 6.6: VoiceCraft 声纹提取
  const vcBridge = new VoiceCraftBridge(outputDir + '/voice-craft', outputDir);
  const voiceSignatures = await vcBridge.forgeVoiceSignatures(forgedCharacters.characters || characters);
  
  // Step 7: 情节编织
  const plot = await runFiller('l2-narrative/plot-weaver.js', { 
    theme, world, structure, seriesConfig: seriesPlan,
    characterData: { characters: forgedCharacters.characters || characters }
  });
  
  // Step 8: 剧本层 + 钩子（M3）
  let [scenesResult, dialogues, cinematography] = await Promise.all([
    runFiller('l3-script/scene-writer.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world }),
    runFiller('l3-script/dialogue-master.js', { plot, characterData: { characters: forgedCharacters.characters || characters }, world, seriesMode: true }),
    runFiller('l3-script/cinematography-planner.js', { plot, world, duration: args.duration, videoType: args.videoType })
  ]);
  
  // v7.1.0-fix: 提取 scenes 数组（scene-writer.js 输出格式为 { scenes: [...] }）
  let scenes = (scenesResult && scenesResult.scenes) ? scenesResult.scenes : scenesResult;
  
  console.log(`   🔍 [DEBUG] scenesResult type: ${typeof scenesResult}, isArray: ${Array.isArray(scenesResult)}, has .scenes: ${scenesResult && !!scenesResult.scenes}`);
  console.log(`   🔍 [DEBUG] extracted scenes type: ${typeof scenes}, isArray: ${Array.isArray(scenes)}`);
  
  // 确保 scenes 是数组
  if (!Array.isArray(scenes)) {
    console.log('   ⚠️ scenes 不是数组，回退到空数组');
    scenes = [];
  }
  
  // 注入钩子
  scenes = await runEnhancer('m3-hook-factory.js', { scenes, hookDensity: 'high' });
  
  // Step 8.5: PersonaVault 场景张力增强
  await pvBridge.enhanceScenes(scenes, forgedCharacters.characters || characters);
  
  // Step 8.6: VoiceCraft 声音注入
  await vcBridge.enhanceScenes(scenes, forgedCharacters.characters || characters, {
    characterWounds: extractWounds(forgedCharacters.characters || characters)
  });
  
  // Step 9: 奇观（M5）
  scenes = await runEnhancer('m5-spectacle-designer.js', { scenes, level: 'standard' });
  
  // Step 10: 竖屏（M1）
  if (args.aspect === '9:16' || !args.aspect) {
    scenes = await runEnhancer('m1-vertical-engine.js', scenes);
  }
  
  // Step 11: 组装 Universe
  const universe = buildUniverse({ theme, world, structure, characters, plot, scenes, dialogues, cinematography, seriesPlan, metadata: { title: args.title, concept: args.concept, episodes: parseInt(args.episodes) || 10, duration: args.duration, mode: 'series', style: args.style, videoType: args.videoType, aspect: args.aspect } });
  
  // Step 12: 分集生成
  console.log('▶️ Step 12: 分集生成...');
  const episodes = generateEpisodes(universe, seriesPlan);
  
  // 保存
  fss.writeFileSync(path.join(outputDir, 'story-universe.json'), JSON.stringify(universe, null, 2));
  fss.writeFileSync(path.join(outputDir, 'series-plan.json'), JSON.stringify(seriesPlan, null, 2));
  
  // 分集保存
  const episodesDir = path.join(outputDir, 'episodes');
  ensureDir(episodesDir);
  for (const ep of episodes) {
    const epDir = path.join(episodesDir, `E${String(ep.number).padStart(3, '0')}`);
    ensureDir(epDir);
    fss.writeFileSync(path.join(epDir, 'screenplay.json'), JSON.stringify(ep.screenplay, null, 2));
    fss.writeFileSync(path.join(epDir, 'story-plan.json'), JSON.stringify(ep.storyPlan, null, 2));
  }
  
  // Step 13: PersonaVault 生成角色报告
  await pvBridge.generateReport('md');
  
  // Step 14: VoiceCraft 生成声音报告
  const voiceReport = vcBridge.generateReport({ scenes, number: 1 }, 'md');
  fss.writeFileSync(path.join(outputDir, 'voice-report.md'), voiceReport);
  console.log('   ✅ voice-report.md');
  
  console.log('\n✅ 系列短剧模式完成！');
  console.log(`   输出目录: ${outputDir}`);
  console.log(`   分集数: ${episodes.length}`);
}

// ============ 工具函数 ============
async function runFiller(scriptPath, input) {
  const fullPath = path.join(SKILLS_DIR, scriptPath);
  if (!fss.existsSync(fullPath)) {
    console.log(`   ⚠️ Filler未实现: ${scriptPath}`);
    return generateMockOutput(path.basename(scriptPath, '.js'), input);
  }
  
  // 写入临时输入
  const tmpDir = '/tmp/storyforge-pro';
  ensureDir(tmpDir);
  const inputPath = path.join(tmpDir, `${Date.now()}-input.json`);
  fss.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  
  const outputPath = path.join(tmpDir, `${Date.now()}-output.json`);
  
  try {
    
    await execAsync(`node "${fullPath}" --input "${inputPath}" --output "${outputPath}"`, { 
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (fss.existsSync(outputPath)) {
      const raw = JSON.parse(fss.readFileSync(outputPath, 'utf8'));
      // filler输出格式: { output: { ... } }
      return raw.output || raw;
    }
    return generateMockOutput(path.basename(scriptPath, '.js'), input);
  } catch (e) {
    console.log(`   ⚠️ Filler执行失败: ${e.message}`);
    return generateMockOutput(path.basename(scriptPath, '.js'), input);
  }
}

async function runEnhancer(scriptPath, input) {
  const fullPath = path.join(ENHANCERS_DIR, scriptPath);
  if (!fss.existsSync(fullPath)) {
    console.log(`   ⚠️ Enhancer未实现: ${scriptPath}`);
    return input;
  }
  
  const tmpDir = '/tmp/storyforge-pro';
  ensureDir(tmpDir);
  const inputPath = path.join(tmpDir, `${Date.now()}-enhancer-input.json`);
  const outputPath = path.join(tmpDir, `${Date.now()}-enhancer-output.json`);
  
  fss.writeFileSync(inputPath, JSON.stringify(input, null, 2));
  
  try {
    
    await execAsync(`node "${fullPath}" --input "${inputPath}" --output "${outputPath}"`, {
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (fss.existsSync(outputPath)) {
      const raw = JSON.parse(fss.readFileSync(outputPath, 'utf8'));
      return raw.output || raw;
    }
    return input;
  } catch (e) {
    console.log(`   ⚠️ Enhancer执行失败: ${e.message}`);
    return input;
  }
}

function buildUniverse(data) {
  // v7.1.0-fix: 正确处理各 filler 的输出格式（可能嵌套在 output 字段中，或嵌套同名字段如 scenes: { scenes: [...] }）
  const extractField = (fieldName) => {
    const extract = (obj) => {
      if (obj === undefined || obj === null) return null;
      if (Array.isArray(obj)) return obj;
      if (obj[fieldName] !== undefined) {
        const val = obj[fieldName];
        // 如果值是对象且包含同名字段（嵌套），继续提取
        if (val && typeof val === 'object' && !Array.isArray(val) && val[fieldName] !== undefined) {
          return extract(val);
        }
        return val;
      }
      if (obj.output && obj.output[fieldName] !== undefined) {
        return extract(obj.output);
      }
      return null;
    };
    return extract(data);
  };
  
  return {
    version: '3.5-Peng',
    createdAt: new Date().toISOString(),
    metadata: data.metadata || null,
    theme: extractField('theme'),
    world: extractField('world'),
    plot: extractField('structure') || extractField('plot'),
    characters: extractField('characters')?.characters || extractField('characters'),
    scenes: extractField('scenes'),
    dialogues: extractField('dialogues'),
    cinematography: extractField('cinematography'),
    ipAnalysis: data.ipAnalysis || null,
    seriesPlan: data.seriesPlan || null
  };
}

async function renderAll(universe, outputDir, args) {
  console.log('▶️ 渲染输出...');
  
  // 剧本视图
  const scriptRenderer = path.join(RENDERERS_DIR, 'script-renderer.js');
  if (fss.existsSync(scriptRenderer)) {
    const { ScriptRenderer } = require(scriptRenderer);
    const renderer = new ScriptRenderer();
    const script = renderer.render(universe);
    fss.writeFileSync(path.join(outputDir, 'screenplay.md'), script);
    console.log('   ✅ screenplay.md');
  }
  
  // 视频视图（对接Seedance）
  const videoRenderer = path.join(RENDERERS_DIR, 'video-renderer.js');
  if (fss.existsSync(videoRenderer)) {
    const { VideoViewRenderer } = require(videoRenderer);
    const renderer = new VideoViewRenderer();
    const videoView = renderer.render(universe);
    fss.writeFileSync(path.join(outputDir, 'video-view.json'), JSON.stringify(videoView, null, 2));
    
    // 导演适配
    const adapter = path.join(RENDERERS_DIR, 'director-adapter.js');
    if (fss.existsSync(adapter)) {
      const { DirectorAdapter } = require(adapter);
      new DirectorAdapter().generateFilesFromView(videoView, outputDir);
      console.log('   ✅ story-plan.json (Seedance对接)');
    }
  }
  
  // 音频视图
  const audioRenderer = path.join(RENDERERS_DIR, 'audio-renderer.js');
  if (fss.existsSync(audioRenderer)) {
    const { AudioRenderer } = require(audioRenderer);
    const renderer = new AudioRenderer();
    const audioView = renderer.render(universe);
    fss.writeFileSync(path.join(outputDir, 'audio-view.json'), JSON.stringify(audioView, null, 2));
    console.log('   ✅ audio-view.json');
  }
}

function generateIPReport(ipAnalysis) {
  return `# IP 解析报告

## 精神内核 DNA
${ipAnalysis.spiritualCore?.coreDNA || '未提取'}

## 不可简化元素
${(ipAnalysis.spiritualCore?.irreducibleElements || []).map(e => `- ${e}`).join('\n')}

## 保留/转化/舍弃计划
### 保留
${(ipAnalysis.retentionPlan?.elementsToKeep || []).map(e => `- ${e}`).join('\n')}

### 转化
${(ipAnalysis.retentionPlan?.elementsToTransform || []).map(e => `- ${e}`).join('\n')}

### 舍弃
${(ipAnalysis.retentionPlan?.elementsToDiscard || []).map(e => `- ${e}`).join('\n')}

## 对比矩阵
| 维度 | 原作 | 新创作 |
|------|------|--------|
| 设定 | ${ipAnalysis.comparisonMatrix?.original?.setting || '-'} | ${ipAnalysis.comparisonMatrix?.rebuild?.setting || '-'} |
| 基调 | ${ipAnalysis.comparisonMatrix?.original?.tone || '-'} | ${ipAnalysis.comparisonMatrix?.rebuild?.tone || '-'} |
| 主角 | ${ipAnalysis.comparisonMatrix?.original?.protagonist || '-'} | ${ipAnalysis.comparisonMatrix?.rebuild?.protagonist || '-'} |
`;
}

function generateEpisodes(universe, seriesPlan) {
  // 简化：为每集提取相关场景
  const episodes = [];
  const totalEpisodes = seriesPlan.totalEpisodes || 80;
  
  for (let i = 1; i <= totalEpisodes; i++) {
    episodes.push({
      number: i,
      title: `第${i}集`,
      screenplay: { scenes: [] },
      storyPlan: {}
    });
  }
  
  return episodes;
}

function extractWounds(characters) {
  const wounds = {};
  // v5.1-Peng: 防御式编程，确保characters是数组
  const charArray = Array.isArray(characters) ? characters : (characters ? [characters] : []);
  for (const char of charArray) {
    const id = char.id || char.characterId;
    if (id) {
      wounds[id] = {
        triggers: char.wound?.triggers || [char.wound?.surface || ''].filter(Boolean)
      };
    }
  }
  return wounds;
}

function generateMockOutput(name, input) {
  const characterCount = input.characterCount || 3;
  
  switch(name) {
    case 'theme-extractor':
      return {
        coreTheme: '奋斗与突破',
        mainTheme: '在逆境中寻找希望',
        emotionalTone: '热血、励志',
        visualMotif: '光与暗的对比',
        targetAudience: '18-35岁职场人群'
      };
    case 'world-builder':
      return {
        name: '现代都市',
        description: '繁华都市中的创业故事',
        atmosphere: '紧张、充满希望',
        visualStyle: '现代、简洁',
        locations: ['办公室', '咖啡厅', '天台']
      };
    case 'structure-engine':
      return {
        acts: [
          { name: '起', duration: 20, focus: '引入' },
          { name: '承', duration: 30, focus: '发展' },
          { name: '转', duration: 20, focus: '转折' },
          { name: '高潮', duration: 25, focus: '冲突' },
          { name: '合', duration: 5, focus: '结局' }
        ],
        totalDuration: input.duration || 15
      };
    case 'character-forge':
      // v5.1-Peng: 生成角色数组，确保可被迭代
      const characters = [];
      for (let i = 0; i < characterCount; i++) {
        const roles = ['protagonist', 'ally', 'mentor', 'antagonist', 'trickster'];
        const role = roles[i % roles.length];
        characters.push({
          id: `C${String(i+1).padStart(2, '0')}`,
          name: `角色${i+1}`,
          role: role,
          description: `${role === 'protagonist' ? '主角' : role === 'ally' ? '盟友' : role === 'mentor' ? '导师' : role === 'antagonist' ? '对手' : '捣蛋鬼'}，在故事中起到关键作用`,
          personality: {
            coreFear: '失败',
            lieTheyBelieve: '我不够好',
            truthTheyNeed: '我本来就足够'
          },
          backstory: {
            wound: '童年创伤',
            coreLie: '我不值得被爱',
            coreNeed: '被认可'
          },
          wound: {
            surface: '童年创伤',
            structure: {
              coreLie: '我不值得被爱',
              coreNeed: '被认可'
            },
            existential: '存在焦虑'
          },
          breathing: {
            pace: '正常',
            volume: '中等',
            silencePattern: '常规沉默'
          }
        });
      }
      return characters;
    case 'plot-weaver':
      return {
        mainPlot: '主角克服困难实现梦想',
        subplots: ['友情线', '爱情线'],
        conflicts: ['内心冲突', '外部冲突'],
        twists: ['身份反转', '真相揭露'],
        pacing: '紧凑'
      };
    case 'scene-writer':
      return [
        { id: 'S01', name: '开场', description: '主角在深夜工作', characters: ['C01'], duration: 10 },
        { id: 'S02', name: '冲突', description: '遇到困难', characters: ['C01', 'C02'], duration: 15 },
        { id: 'S03', name: '转折', description: '灵感闪现', characters: ['C01'], duration: 10 },
        { id: 'S04', name: '高潮', description: '最终对决', characters: ['C01', 'C02', 'C03'], duration: 15 },
        { id: 'S05', name: '结局', description: '成功时刻', characters: ['C01'], duration: 10 }
      ];
    case 'dialogue-master':
      return [
        { sceneId: 'S01', lines: [{ speaker: 'C01', text: '我一定能做到' }] },
        { sceneId: 'S02', lines: [{ speaker: 'C02', text: '你不行' }, { speaker: 'C01', text: '我会证明给你看' }] },
        { sceneId: 'S03', lines: [{ speaker: 'C01', text: '我明白了！' }] },
        { sceneId: 'S04', lines: [{ speaker: 'C01', text: '这就是答案' }] },
        { sceneId: 'S05', lines: [{ speaker: 'C01', text: '我们成功了' }] }
      ];
    case 'cinematography-planner':
      return {
        visualStyle: input.visualStyle || '现代',
        colorPalette: ['深蓝', '金色', '白色'],
        lighting: '自然光+人工补光',
        cameraWork: ['推轨', '手持', '航拍'],
        keyShots: [
          { scene: 'S01', shot: '特写', description: '主角眼神坚定' },
          { scene: 'S02', shot: '中景', description: '两人对峙' },
          { scene: 'S03', shot: '全景', description: '城市夜景' },
          { scene: 'S04', shot: '特写', description: '关键道具' },
          { scene: 'S05', shot: '航拍', description: '日出城市' }
        ]
      };
    default:
      return { mock: true, filler: name, input };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].replace(/^--/, '');
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function ensureDir(dir) {
  if (!fss.existsSync(dir)) {
    fss.mkdirSync(dir, { recursive: true });
  }
}

function printHelp() {
  console.log(`
用法:
  node storyforge-pro.js create --title "作品名" --concept "概念" [options]
  node storyforge-pro.js adapt --source "西游记" --essence "反抗权威" [options]
  node storyforge-pro.js series --title "作品名" --episodes 80 [options]

选项:
  --title          作品标题
  --concept        核心概念（原创模式）
  --source         IP来源（改编模式）
  --essence        保留的精神内核
  --setting        新背景设定
  --genre          类型
  --duration       时长（秒）
  --aspect         画幅（16:9 或 9:16）
  --episodes       集数（系列模式）
  --spectacle      奇观级别（minimal/standard/maximum）
  --output         输出目录
  --help           显示帮助
`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});