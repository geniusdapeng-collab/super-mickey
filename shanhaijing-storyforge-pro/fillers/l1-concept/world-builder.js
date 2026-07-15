#!/usr/bin/env node
/**
 * World Builder v3.6-Peng
 * L1 概念层 — 世界观架构师
 * 
 * 从零构建完整的世界观体系，或基于IP解析结果重建
 */

const fs = require('fs').promises;
const fss = require('fs');

const WORLD_TEMPLATES = {
  'sci-fi': {
    worldName: '新纪元',
    worldTagline: '技术与人性的终极博弈',
    era: '近未来2147年',
    geography: '巨型城市集群与荒芜废土',
    socialStructure: '企业统治与地下抵抗组织',
    powerSystem: 'AI辅助决策+生物增强',
    coreConflicts: ['效率vs人性', '控制vs自由', '记忆vs遗忘'],
    atmosphereKeywords: ['霓虹', '废土', '数据流', '机械义肢'],
    visualMotifs: ['全息投影', '巨大建筑', '废弃工厂'],
    races: ['改造人', '纯人类', 'AI意识']
  },
  'fantasy': {
    worldName: '艾瑟兰',
    worldTagline: '魔法与剑的古老大陆',
    era: '诸神黄昏后的第三纪元',
    geography: '浮空岛屿与深渊裂谷',
    socialStructure: '法师议会与骑士团',
    powerSystem: '元素魔法+古代符文',
    coreConflicts: ['传统vs变革', '魔法vs科技', '种族共存'],
    atmosphereKeywords: ['古老', '神秘', '壮丽', '危险'],
    visualMotifs: ['浮空城', '魔法阵', '巨龙'],
    races: ['人类', '精灵', '矮人', '龙族']
  },
  'drama': {
    worldName: '现代都市',
    worldTagline: '平凡生活中的不凡故事',
    era: '当代2026年',
    geography: '繁华都市与隐秘角落',
    socialStructure: '阶层分化与社交网络',
    powerSystem: '资本与影响力',
    coreConflicts: ['理想vs现实', '个人vs集体', '过去vs未来'],
    atmosphereKeywords: ['繁忙', '孤独', '温暖', '冷漠'],
    visualMotifs: ['霓虹灯', '雨夜', '咖啡杯'],
    races: ['人类']
  }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const world = buildWorld(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'world-builder',
    output: world
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ World Builder: ${world.worldName}`);
}

function buildWorld(input) {
  const mode = input.mode || 'original';
  const theme = input.theme || {};
  const styleHint = input.styleHint || '';
  const ipAnalysis = input.ipAnalysis || null;
  const userPrompt = input.userPrompt || '';
  
  const genre = inferGenre(theme, styleHint, userPrompt);
  const template = WORLD_TEMPLATES[genre] || WORLD_TEMPLATES['drama'];
  
  // 基于用户提示深度定制
  const customized = customizeWorld(template, userPrompt, theme);
  
  // 基于IP分析重建（模式B/C）
  if (ipAnalysis) {
    return rebuildWorldFromIP(customized, ipAnalysis, theme);
  }
  
  // 原创模式
  return {
    worldName: customized.worldName,
    worldTagline: customized.worldTagline,
    era: customized.era,
    geography: customized.geography,
    socialStructure: customized.socialStructure,
    powerSystem: customized.powerSystem,
    coreConflicts: customized.coreConflicts,
    atmosphereKeywords: customized.atmosphereKeywords,
    visualMotifs: customized.visualMotifs,
    races: customized.races,
    visual_style: {
      style: styleHint || '写实',
      mood: theme.emotionalFormula?.primaryEmotion || '中性',
      color_palette: inferColorPalette(genre),
      cinematography_style: inferCinematographyStyle(genre, styleHint)
    },
    loreEntries: generateLoreEntries(customized),
    worldRules: generateWorldRules(customized),
    locations: generateLocations(customized),
    factions: generateFactions(customized),
    metadata: {
      mode,
      genre,
      generatedAt: new Date().toISOString()
    }
  };
}

function customizeWorld(template, userPrompt, theme) {
  const promptLower = userPrompt.toLowerCase();
  
  return {
    worldName: extractWorldName(userPrompt) || template.worldName,
    worldTagline: template.worldTagline,
    era: promptLower.includes('未来') || promptLower.includes('科技') ? '近未来2147年' : template.era,
    geography: promptLower.includes('城市') ? '巨型霓虹城市与地下世界' : template.geography,
    socialStructure: template.socialStructure,
    powerSystem: promptLower.includes('魔法') ? '元素魔法+古代符文' : template.powerSystem,
    coreConflicts: [...template.coreConflicts, '新旧冲突', '身份认同'],
    atmosphereKeywords: [...template.atmosphereKeywords, '未知', '神秘'],
    visualMotifs: [...template.visualMotifs],
    races: template.races
  };
}

function extractWorldName(prompt) {
  const patterns = [
    /(\w+)世界/,
    /(\w+)大陆/,
    /(\w+)纪元/,
    /(\w+)时代/
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function inferCinematographyStyle(genre, styleHint) {
  const styles = {
    'sci-fi': '高对比+霓虹光效+长焦压缩',
    'fantasy': '柔和光+魔法光晕+广角宏大',
    'drama': '自然光+手持跟拍+浅景深',
    'action': '高速快门+动态追焦+冷暖对比'
  };
  return styleHint || styles[genre] || '标准摄影';
}

function generateWorldRules(world) {
  return {
    physical: `${world.powerSystem}驱动的世界运转规则`,
    social: `${world.socialStructure}下的阶层流动规则`,
    moral: '善恶边界模糊，选择决定立场'
  };
}

function generateLocations(world) {
  const baseLocations = [
    { name: '主城', type: '城市', significance: '故事起点' },
    { name: '禁区', type: '危险区域', significance: '试炼之地' },
    { name: ' sanctuary', type: '安全区', significance: '喘息与反思' }
  ];
  return baseLocations;
}

function generateFactions(world) {
  return [
    { name: '主导势力', alignment: '秩序', goal: '维持现状' },
    { name: '反抗者', alignment: '混乱', goal: '推翻旧秩序' },
    { name: '中立者', alignment: '平衡', goal: '保护无辜' }
  ];
}

function rebuildWorldFromIP(template, ipAnalysis, theme) {
  const rebuild = ipAnalysis.worldviewRebuild || {};
  const retention = ipAnalysis.retentionPlan || {};
  
  return {
    worldName: `${rebuild.newSettingSuggestion || template.worldName}·重构`,
    worldTagline: `${rebuild.recommendedGenre || template.worldTagline}`,
    era: `重构时代`,
    geography: rebuild.visualDirection || template.geography,
    socialStructure: template.socialStructure,
    powerSystem: template.powerSystem,
    coreConflicts: ipAnalysis.spiritualCore?.coreDNA ? [ipAnalysis.spiritualCore.coreDNA] : template.coreConflicts,
    atmosphereKeywords: template.atmosphereKeywords,
    visualMotifs: template.visualMotifs,
    races: template.races,
    visual_style: {
      style: rebuild.visualDirection || '写实',
      mood: theme.emotionalFormula?.primaryEmotion || '中性',
      color_palette: inferColorPalette('sci-fi')
    },
    loreEntries: generateLoreEntries(template),
    ipBased: true,
    retentionPlan: {
      kept: retention.elementsToKeep || [],
      transformed: retention.elementsToTransform || [],
      discarded: retention.elementsToDiscard || []
    },
    metadata: {
      mode: 'ip-rebuild',
      source: ipAnalysis.metadata?.source || '未知',
      generatedAt: new Date().toISOString()
    }
  };
}

function inferGenre(theme, styleHint) {
  const combined = `${theme.coreTheme || ''} ${styleHint || ''}`.toLowerCase();
  if (combined.includes('未来') || combined.includes('科技') || combined.includes('AI')) return 'sci-fi';
  if (combined.includes('魔法') || combined.includes('龙') || combined.includes('剑')) return 'fantasy';
  return 'drama';
}

function inferColorPalette(genre) {
  const palettes = {
    'sci-fi': ['#00FFFF', '#FF00FF', '#000000'],
    'fantasy': ['#FFD700', '#8B4513', '#228B22'],
    'drama': ['#808080', '#A9A9A9', '#D3D3D3']
  };
  return palettes[genre] || palettes['drama'];
}

function generateLoreEntries(template) {
  return [
    { title: '世界起源', content: `${template.worldName}的诞生故事`, importance: 1 },
    { title: '核心冲突', content: template.coreConflicts?.[0] || '主要矛盾', importance: 1 },
    { title: '重要种族', content: template.races?.join('、') || '人类', importance: 2 }
  ];
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--output') args.output = argv[++i];
  }
  return args;
}

main();