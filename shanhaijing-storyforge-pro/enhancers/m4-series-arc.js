#!/usr/bin/env node
/**
 * Series Arc v3.6-Peng
 * M4 增强模块 — 系列世界观展开与连续性管理
 * 
 * 三层世界观展开 + 连续性检查 + 前情提要生成
 */

const fs = require('fs').promises;
const fss = require('fs');

const WORLD_REVEALING_PLAN = {
  layer1: {
    episodes: '1-10',
    revealPercent: 20,
    content: [
      '主角是谁，在做什么',
      '核心矛盾',
      '基本世界规则',
      '主要对立双方'
    ],
    hidden: [
      '完整背景',
      '反派真正目的',
      '伏笔只埋不收'
    ]
  },
  layer2: {
    episodes: '11-40',
    revealPercent: 50,
    content: [
      '主角过去/隐藏身份逐步揭露',
      '更深层世界规则',
      '新势力和新角色',
      '前期伏笔开始回收'
    ]
  },
  layer3: {
    episodes: '41-80',
    revealPercent: 100,
    content: [
      '终极真相',
      '所有伏笔回收',
      '角色最终选择',
      '世界观完整面貌'
    ]
  }
};

const CONTINUITY_RULES = [
  '角色外貌（发型/服装/特征）前后一致',
  '角色能力/法术使用前后一致',
  '角色关系状态按剧情线推进',
  '法宝/武器出现和消失有交代',
  '集与集时间流逝合理',
  '力量体系前后一致'
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const seriesPlan = buildSeriesPlan(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'series-arc',
    output: seriesPlan
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Series Arc: ${seriesPlan.totalEpisodes}集系列规划完成`);
}

function buildSeriesPlan(input) {
  const world = input.world || {};
  const theme = input.theme || {};
  const config = input.seriesConfig || {};
  
  // 支持两种传参方式: input.seriesConfig.totalEpisodes 或 input.totalEpisodes
  const totalEpisodes = config.totalEpisodes || input.totalEpisodes || 10;
  
  // 生成分集目录
  const episodeDirectory = generateEpisodeDirectory(totalEpisodes);
  
  // 连续性规则
  const continuityRules = CONTINUITY_RULES;
  
  return {
    totalEpisodes,
    worldRevealingPlan: WORLD_REVEALING_PLAN,
    episodeDirectory,
    continuityRules,
    previouslyOn: generatePreviouslyOn(episodeDirectory, totalEpisodes),
    metadata: {
      worldName: world.worldName || '未命名世界',
      coreTheme: theme.coreTheme || '未指定主题',
      generatedAt: new Date().toISOString()
    }
  };
}

function generateEpisodeDirectory(totalEpisodes) {
  const directory = [];
  const arcNames = ['觉醒篇', '成长篇', '真相篇', '终章篇'];
  
  for (let i = 1; i <= totalEpisodes; i++) {
    const arcIndex = Math.min(Math.floor((i - 1) / (totalEpisodes / 4)), 3);
    const isPaywall = [10, 28, 58].includes(i);
    
    directory.push({
      episode: i,
      title: generateEpisodeTitle(i),
      arc: arcNames[arcIndex],
      hook: isPaywall ? '🔴' : '💥',
      paywall: isPaywall,
      keyEvent: generateKeyEvent(i),
      worldLayer: getWorldLayer(i)
    });
  }
  
  return directory;
}

function generateEpisodeTitle(episode) {
  const titles = [
    '九尾初现', '觉醒之力', '危机降临', '师父的秘密', '第一次战斗',
    '失去与获得', '真相碎片', '黑暗逼近', '背叛与忠诚', '终极考验'
  ];
  return titles[(episode - 1) % titles.length] || `第${episode}集`;
}

function generateKeyEvent(episode) {
  const events = [
    '主角身份reveal', '新角色登场', '能力觉醒', '关系破裂', '重大发现',
    '战斗胜利', '情感转折', '真相揭露', '牺牲', '最终对决'
  ];
  return events[(episode - 1) % events.length];
}

function getWorldLayer(episode) {
  if (episode <= 10) return '表层（20%）';
  if (episode <= 40) return '深度（50%）';
  return '核心（100%）';
}

function generatePreviouslyOn(episodeDirectory, currentEpisode) {
  if (currentEpisode <= 1) return '';
  
  const relevantEpisodes = episodeDirectory.slice(0, currentEpisode - 1);
  const keyEvents = relevantEpisodes
    .filter(ep => ep.paywall || ep.episode % 5 === 0)
    .map(ep => `${ep.title}：${ep.keyEvent}`);
  
  return `前情提要：${keyEvents.slice(-3).join(' → ')}`;
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