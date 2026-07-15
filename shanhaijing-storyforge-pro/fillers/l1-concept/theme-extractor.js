#!/usr/bin/env node
/**
 * Theme Extractor v3.6-Peng
 * L1 概念层 — 主题提炼引擎
 * 
 * 输入：用户创意概念或IP分析结果
 * 输出：主题包（填充 universe.theme）
 */

const fs = require('fs').promises;
const fss = require('fs');

const TEMPLATE_THEMES = {
  'sci-fi': {
    coreTheme: '技术与人性的边界',
    themeMatrix: {
      surface: 'AI与人类的对立',
      underlying: '工具理性对情感价值的侵蚀',
      universal: '自由意志vs系统控制'
    },
    emotionalFormula: {
      primaryEmotion: '孤独',
      emotionalArc: '从冰冷到觉醒的温暖',
      resonancePoints: ['被理解', '自我认同', '反抗']
    }
  },
  'drama': {
    coreTheme: '爱与失去的重逢',
    themeMatrix: {
      surface: '两个人的分离与重聚',
      underlying: '创伤如何被时间治愈',
      universal: '记忆的保存与遗忘'
    },
    emotionalFormula: {
      primaryEmotion: '怀旧',
      emotionalArc: '从遗憾到和解',
      resonancePoints: ['错过', '坚持', '释然']
    }
  },
  'action': {
    coreTheme: '正义的代价',
    themeMatrix: {
      surface: '英雄对抗邪恶',
      underlying: '暴力循环中的道德模糊',
      universal: '牺牲与救赎'
    },
    emotionalFormula: {
      primaryEmotion: '热血',
      emotionalArc: '从愤怒到担当',
      resonancePoints: ['勇气', '牺牲', '正义']
    }
  }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const theme = extractTheme(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'theme-extractor',
    output: theme
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Theme Extractor: ${theme.coreTheme}`);
}

function extractTheme(input) {
  const mode = input.mode || 'original';
  const concept = input.concept || input.userIntent || '未命名概念';
  
  // 深度分析概念
  const analysis = analyzeConcept(concept);
  const genre = analysis.genre;
  const subGenre = analysis.subGenre;
  const emotionalCore = analysis.emotionalCore;
  
  const template = TEMPLATE_THEMES[genre] || TEMPLATE_THEMES['drama'];
  
  // 基于深度分析定制主题
  const customized = {
    coreTheme: generateCoreTheme(concept, template, emotionalCore),
    themeMatrix: generateThemeMatrix(concept, template, analysis),
    emotionalFormula: generateEmotionalFormula(concept, template, emotionalCore),
    motifs: generateMotifs(concept, analysis),
    thematicQuestions: generateQuestions(concept, analysis),
    philosophicalAnchor: generatePhilosophicalAnchor(genre, subGenre),
    culturalDNA: generateCulturalDNA(concept, genre),
    conceptAnalysis: analysis,
    metadata: {
      genre,
      subGenre,
      mode,
      generatedAt: new Date().toISOString()
    }
  };
  
  return customized;
}

function analyzeConcept(concept) {
  const lower = concept.toLowerCase();
  
  // 类型检测
  const genreMap = {
    'sci-fi': ['AI', '未来', '科技', '机器人', '太空', '赛博', '机械', '未来'],
    'fantasy': ['魔法', '龙', '精灵', '神话', '仙侠', '修真', '玄幻'],
    'drama': ['爱情', '家庭', '成长', '回忆', '离别', '重逢', '人生'],
    'action': ['战斗', '英雄', '拯救', '战争', '冒险', '功夫', '武侠'],
    'horror': ['恐怖', '鬼', '惊悚', '诡异', '灵异'],
    'comedy': ['搞笑', '喜剧', '幽默', '荒诞']
  };
  
  let genre = 'drama';
  for (const [g, words] of Object.entries(genreMap)) {
    if (words.some(w => lower.includes(w))) {
      genre = g;
      break;
    }
  }
  
  // 子类型检测
  const subGenreMap = {
    '赛博朋克': ['赛博', '黑客', '霓虹', '义肢'],
    '太空歌剧': ['太空', '星际', '宇宙', '舰队'],
    '神话改编': ['神话', '传说', '经典', '西游', '封神'],
    '都市情感': ['都市', '职场', '恋爱', '婚姻'],
    '武侠': ['武侠', '江湖', '门派', '内功'],
    '末世': ['末世', '废土', '末日', '幸存']
  };
  
  let subGenre = 'general';
  for (const [sg, words] of Object.entries(subGenreMap)) {
    if (words.some(w => lower.includes(w))) {
      subGenre = sg;
      break;
    }
  }
  
  // 情感核心检测
  const emotionMap = {
    '热血': ['战斗', '英雄', '拯救', '正义'],
    '孤独': ['AI', '机器人', '未来', '一人'],
    '怀旧': ['回忆', '过去', '童年', '老'],
    '悬疑': ['谜', '真相', '秘密', '调查'],
    '浪漫': ['爱', '恋', '情', '缘'],
    '恐惧': ['恐怖', '惊悚', '死亡', '危险']
  };
  
  let emotionalCore = '复杂';
  for (const [em, words] of Object.entries(emotionMap)) {
    if (words.some(w => lower.includes(w))) {
      emotionalCore = em;
      break;
    }
  }
  
  return { genre, subGenre, emotionalCore, conceptLength: concept.length };
}

function generateCoreTheme(concept, template, emotionalCore) {
  const baseTheme = template.coreTheme;
  const conceptSnippet = concept.substring(0, 30);
  return `${baseTheme} — ${conceptSnippet}（${emotionalCore}内核）`;
}

function generateThemeMatrix(concept, template, analysis) {
  const { genre, subGenre } = analysis;
  return {
    surface: `${template.themeMatrix.surface}（${concept.substring(0, 20)}）`,
    underlying: `${template.themeMatrix.underlying} + ${subGenre}元素`,
    universal: `${template.themeMatrix.universal} — ${genre}语境下的新诠释`
  };
}

function generateEmotionalFormula(concept, template, emotionalCore) {
  const base = template.emotionalFormula;
  return {
    primaryEmotion: emotionalCore || base.primaryEmotion,
    emotionalArc: base.emotionalArc,
    resonancePoints: [...base.resonancePoints, '身份认同', '选择困境'].slice(0, 5)
  };
}

function generateMotifs(concept, analysis) {
  const baseMotifs = ['光与影', '记忆', '时间'];
  const conceptMotifs = [];
  
  if (concept.includes('水') || concept.includes('海')) conceptMotifs.push('水流/潮汐');
  if (concept.includes('火') || concept.includes('焰')) conceptMotifs.push('火焰/灰烬');
  if (concept.includes('镜') || concept.includes('影')) conceptMotifs.push('镜像/倒影');
  if (concept.includes('门') || concept.includes('窗')) conceptMotifs.push('边界/通道');
  if (concept.includes('路') || concept.includes('途')) conceptMotifs.push('旅程/方向');
  if (concept.includes('战') || concept.includes('斗')) conceptMotifs.push('武器/伤痕');
  if (concept.includes('星') || concept.includes('空')) conceptMotifs.push('星空/尘埃');
  if (concept.includes('机') || concept.includes('械')) conceptMotifs.push('齿轮/电路');
  
  return [...baseMotifs, ...conceptMotifs].slice(0, 6);
}

function generateQuestions(concept, analysis) {
  const { genre, emotionalCore } = analysis;
  const conceptShort = concept.substring(0, 15);
  
  const questions = [
    `${conceptShort}的本质是什么？`,
    `在${genre}语境下，${emotionalCore}意味着什么？`,
    '当一切结束时，什么会留下？',
    '选择的代价由谁承担？'
  ];
  
  return questions;
}

function generatePhilosophicalAnchor(genre, subGenre) {
  const anchors = {
    'sci-fi': '技术哲学 — 工具理性批判',
    'fantasy': '神话学 — 原型与集体无意识',
    'drama': '存在主义 — 此在与选择',
    'action': '伦理学 — 正义与暴力的边界',
    'horror': '精神分析 — 恐惧与欲望',
    'comedy': '荒诞哲学 — 意义消解与重构'
  };
  return `${anchors[genre] || '存在主义'} + ${subGenre}语境`;
}

function generateCulturalDNA(concept, genre) {
  const hasChinese = /[\u4e00-\u9fa5]/.test(concept);
  const culture = hasChinese ? '东方叙事' : '普世叙事';
  return `${culture} + ${genre}类型传统 + 当代语境重构`;
}

function inferGenre(concept) {
  const analysis = analyzeConcept(concept);
  return analysis.genre;
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