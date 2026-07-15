#!/usr/bin/env node
/**
 * Paywall Engine v3.6-Peng
 * M2 增强模块 — 付费卡点节奏设计师
 * 
 * 标准三卡点模型 + 五种钩子类型
 */

const fs = require('fs').promises;
const fss = require('fs');

const STANDARD_PAYWALL = {
  positions: [10, 28, 58],
  zones: [
    { episodes: '1-8', name: '免费区', rhythm: '每集1钩子', hookType: '悬念/危机' },
    { episodes: '9-12', name: '🔴卡一', rhythm: '蓄力→爆发', hookType: '生死/重大reveal' },
    { episodes: '13-25', name: '已付费区', rhythm: '每3集1小高潮', hookType: '小悬念' },
    { episodes: '26-30', name: '🔴卡二', rhythm: '蓄力→爆发', hookType: '真相/背叛/反转' },
    { episodes: '31-55', name: '风暴区', rhythm: '每2集1转折', hookType: '连续钩子' },
    { episodes: '56-65', name: '🔴卡三', rhythm: '蓄力→爆发', hookType: '终极抉择' },
    { episodes: '66-80', name: '终局区', rhythm: '高潮→收尾', hookType: '情感释放' }
  ]
};

const HOOK_TYPES = {
  suspenseHook: { name: '悬念钩', formula: '强疑问→不给答案', example: '"下一个就是你"——谁写的？' },
  twistHook: { name: '反转钩', formula: '建立预期→打破预期', example: '救她的人竟是幕后主使！' },
  emotionHook: { name: '情绪钩', formula: '极致情绪→最高点切断', example: '"我爱你"——电话那头传来…' },
  infoHook: { name: '信息钩', formula: '铺垫秘密→即将reveal→切断', example: '打开信封，里面是——[定格]' },
  crisisHook: { name: '危机钩', formula: '危机爆发→最危险→切断', example: '刀尖距喉咙一厘米——' }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const paywall = designPaywall(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'paywall-engine',
    output: paywall
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log('✅ Paywall Engine: 卡点设计完成');
}

function designPaywall(input) {
  const structure = input.structure || {};
  const seriesConfig = input.seriesConfig || {};
  const episodes = seriesConfig.episodes || 80;
  const positions = seriesConfig.paywallPositions || STANDARD_PAYWALL.positions;
  
  // 生成每集节奏
  const episodeRhythm = [];
  for (let i = 1; i <= episodes; i++) {
    const zone = findZone(i, STANDARD_PAYWALL.zones);
    const isPaywall = positions.includes(i);
    const hookType = selectHookType(i, zone);
    
    episodeRhythm.push({
      episode: i,
      title: generateEpisodeTitle(i),
      hookType: hookType.name,
      endingHook: isPaywall ? 'crisisHook' : selectEndingHook(zone),
      isPaywall,
      tensionTarget: calculateTension(i, zone, isPaywall),
      zone: zone.name
    });
  }
  
  return {
    ...structure,
    paywallPositions: positions,
    episodeRhythm,
    freeZoneStrategy: '前8集建立人设+核心矛盾+让观众追下去',
    conversionStrategy: '卡一用生死悬念，卡二用真相揭露，卡三用终极抉择',
    singleEpisodeStructure: {
      '0-3s': '开场钩子（5种模板可选）',
      '3-10s': '人物亮相+核心矛盾闪现',
      '10-30s': '推进/小冲突',
      '30-50s': '升级/小高潮',
      '50-60s': '悬念钩子（集尾，驱动下一集）'
    },
    metadata: {
      ...structure.metadata,
      totalEpisodes: episodes,
      paywallCount: positions.length,
      paywallGeneratedAt: new Date().toISOString()
    }
  };
}

function findZone(episode, zones) {
  for (const zone of zones) {
    const [start, end] = zone.episodes.split('-').map(Number);
    if (episode >= start && episode <= end) return zone;
  }
  return zones[zones.length - 1];
}

function selectHookType(episode, zone) {
  const types = Object.values(HOOK_TYPES);
  const index = (episode - 1) % types.length;
  return types[index];
}

function selectEndingHook(zone) {
  if (zone.name.includes('卡')) return 'crisisHook';
  if (zone.name.includes('风暴')) return 'suspenseHook';
  return 'emotionHook';
}

function calculateTension(episode, zone, isPaywall) {
  if (isPaywall) return 95;
  if (zone.name.includes('风暴')) return 70 + Math.random() * 20;
  if (zone.name.includes('免费')) return 30 + episode * 2;
  return 50;
}

function generateEpisodeTitle(episode) {
  const titles = ['初现', '觉醒', '危机', '突破', '真相', '抉择', '重生', '终章'];
  return `第${episode}集：${titles[(episode - 1) % titles.length]}`;
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