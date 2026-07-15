#!/usr/bin/env node
/**
 * Dialogue Engine — 台词/对白生成器 v1.2.2-Peng
 * 
 * 输入：story-plan.json
 * 输出：shot-dialogues.json + 对白设计文档
 * 
 * 核心能力：
 *   1. 按videoType决定对白密度（剧情片>教育片>商业片>动作片）
 *   2. 按镜头类型决定对白长度和情绪
 *   3. 角色口吻差异化（主角/配角/旁白）
 *   4. 输出Seedance可理解的"说话"提示词增强
 * 
 * 用法：
 *   node dialogue-engine.js generate --plan <story-plan.json> --output-dir <dir>
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// ============ 对白密度配置 ============
// 每个视频类型的对白密度：0=无对白，1=偶尔，2=正常，3=密集
const DIALOGUE_DENSITY = {
  drama: 3,        // 剧情片：密集对白，推动叙事
  educational: 2,  // 教育片：旁白解说+偶尔角色对话
  commercial: 2,   // 商业片：CTA文案+产品解说
  documentary: 2,  // 纪录片：旁白为主+采访对白
  action: 1        // 动作片：少对白，战吼/短句为主
};

// 镜头类型 → 是否倾向于有对白
const SHOT_DIALOGUE_LIKELIHOOD = {
  // 剧情片镜头
  '日常建置': 0.3, '关系铺垫': 0.8, '细节暗示': 0.2, '冲突萌芽': 0.6,
  '情感升级': 0.9, '转折突变': 0.5, '情绪高潮': 0.7, '抉择时刻': 0.8,
  '真相揭示': 0.9, '情感释放': 0.8, '余韵留白': 0.1, '尾声定格': 0.2,
  '开放结局': 0.3,
  // 动作片镜头
  '建置': 0.2, '触发': 0.3, '反应': 0.4, '准备': 0.3,
  '升级': 0.2, '对抗': 0.3, '转折': 0.2, '逼近': 0.2,
  '高潮前': 0.3, '终极': 0.4, '爆发': 0.5, '结果': 0.3,
  '收束': 0.2, '定格': 0.1,
  // 教育片镜头
  '问题呈现': 0.4, '场景建置': 0.3, '人物引入': 0.5, '步骤演示': 0.6,
  '关键动作': 0.5, '强调重复': 0.7, '特写放大': 0.4, '效果展示': 0.3,
  '对比验证': 0.6, '总结回顾': 0.8, '正确示范': 0.5, '收尾定格': 0.3,
  // 商业片镜头
  '痛点呈现': 0.5, '吸引力钩子': 0.6, '产品亮相': 0.4, '功能展示': 0.7,
  '优势对比': 0.6, '场景应用': 0.5, '效果验证': 0.4, '用户见证': 0.9,
  '价值升华': 0.7, '行动号召': 0.9, '品牌定格': 0.3, '记忆锚点': 0.4,
  '结尾冲击': 0.5,
  // 纪录片镜头
  '环境建置': 0.2, '主题引入': 0.8, '人物登场': 0.6, '事件展开': 0.5,
  '细节挖掘': 0.3, '视角切换': 0.4, '冲突浮现': 0.6, '深度揭示': 0.7,
  '情感冲击': 0.5, '总结升华': 0.8, '反思留白': 0.3, '余韵定格': 0.2,
  '开放式收束': 0.2
};

// 对白长度（字数）按镜头时长
function getDialogueLength(duration, density) {
  // 基础字数：每秒1-2个字（正常语速）
  const baseChars = Math.floor(duration * 1.5);
  
  // 按密度调整
  const densityMultiplier = { 0: 0, 1: 0.3, 2: 0.7, 3: 1.0 }[density] || 0.5;
  
  // 最终字数
  const finalChars = Math.floor(baseChars * densityMultiplier);
  
  // 最少3个字（至少有个短句），最多不超过镜头时长的2倍语速
  return Math.max(3, Math.min(finalChars, Math.floor(duration * 2.5)));
}

// ============ 角色口吻库 ============
const CHARACTER_VOICES = {
  // 默认口吻
  default: {
    style: '自然流畅',
    vocabulary: '通用',
    emotionRange: ['平静', '关切', '坚定']
  },
  // 英雄/主角
  hero: {
    style: '坚定有力，简短直接',
    vocabulary: '战斗用语，誓言',
    emotionRange: ['愤怒', '决心', '悲壮'],
    patterns: ['我不会退缩', '为了...', '这就是...的终结']
  },
  // 反派
  villain: {
    style: '傲慢嘲讽，语调拉长',
    vocabulary: '威胁，蔑视',
    emotionRange: ['轻蔑', '狂怒', '阴险'],
    patterns: ['你太弱了', '这就是你的极限', '一切都结束了']
  },
  // 智者/导师
  mentor: {
    style: '沉稳缓慢，意味深长',
    vocabulary: '哲理，隐喻',
    emotionRange: ['深沉', '悲悯', '洞察'],
    patterns: ['记住，...', '真正的力量在于...', '有时候...']
  },
  // 喜剧角色
  comic: {
    style: '轻快夸张，节奏跳跃',
    vocabulary: '俚语，双关',
    emotionRange: ['兴奋', '慌张', '自嘲'],
    patterns: ['等等，什么情况？', '这下麻烦了', '我就知道！']
  },
  // 旁白/解说
  narrator: {
    style: '客观清晰，语调平稳',
    vocabulary: '专业术语，描述性',
    emotionRange: ['中性', '关切', '鼓励'],
    patterns: ['接下来，我们将...', '关键在于...', '记住这一点...']
  }
};

// ============ 对白模板库（按类型） ============
const DIALOGUE_TEMPLATES = {
  drama: {
    opening: [
      '（低声）你来了。',
      '我有话要对你说。',
      '这一切...是怎么开始的？',
      '这一切不能再继续了。'
    ],
    confrontation: [
      '你根本不懂！',
      '为什么？告诉我为什么！',
      '你变了，不再是以前的你了。',
      '这就是你的选择吗？'
    ],
    climax: [
      '我不会放弃的，无论发生什么。',
      '（哽咽）我以为...再也见不到你了。',
      '这一刻，我等了很久。',
      '这就是结局吗？不，这不是！'
    ],
    resolution: [
      '一切都结束了。',
      '我们走吧。',
      '谢谢你。',
      '（叹息）终于...'
    ]
  },
  action: {
    battleCry: [
      '来吧！',
      '受死吧！',
      '为了正义！',
      '绝不后退！'
    ],
    taunt: [
      '就这点本事？',
      '太慢了！',
      '你打不中我的。',
      '结束吧！'
    ],
    pain: [
      '呃啊！',
      '还没完...',
      '（喘息）',
      '该死！'
    ],
    victory: [
      '结束了。',
      '这就是你的下场。',
      '正义必胜。',
      '（战吼）'
    ]
  },
  educational: {
    intro: [
      '今天我们来学习...',
      '首先，让我们了解...',
      '关键步骤如下...',
      '记住，安全第一。'
    ],
    explanation: [
      '这一步的原理是...',
      '注意看这里...',
      '常见的错误是...',
      '正确的做法是...'
    ],
    emphasis: [
      '这一点非常重要。',
      '千万不要忽略这个细节。',
      '如果能掌握这一点，你就成功了一半。',
      '让我们再复习一遍。'
    ],
    conclusion: [
      '总结一下...',
      '关键要点是...',
      '记住这三个步骤...',
      '你学会了吗？'
    ]
  },
  commercial: {
    hook: [
      '还在为...烦恼吗？',
      '你知道吗？...',
      '想象一下，如果...',
      '告别...的时代到了。'
    ],
    product: [
      '这就是[产品名]。',
      '它采用了最新的...技术。',
      '只需三步，轻松搞定。',
      '与传统方法不同，它...'
    ],
    benefit: [
      '省时省力，效率提升...倍。',
      '用户好评率...%。',
      '现在下单，立享...优惠。',
      '错过今天，再等一年。'
    ],
    cta: [
      '立即点击链接！',
      '限时优惠，先到先得！',
      '改变，从今天开始。',
      '还在等什么？'
    ]
  },
  documentary: {
    opening: [
      '在这片土地上，发生着...',
      '这是一个关于...的故事。',
      '很少有人知道，...',
      '时间回到...年前。'
    ],
    interview: [
      '当时的情况是这样的...',
      '我从未见过如此...',
      '那一刻，我明白了...',
      '（沉思）如果重来一次...'
    ],
    revelation: [
      '数据显示，...',
      '调查发现，...',
      '专家认为，...',
      '真相远比想象的复杂。'
    ],
    closing: [
      '故事还在继续...',
      '这就是...的真相。',
      '留给我们的思考是...',
      '（画外音）未来，会告诉我们答案。'
    ]
  }
};

// ============ 主生成函数 ============
function generateDialogues(plan) {
  const videoType = plan.videoType || 'action';
  const density = DIALOGUE_DENSITY[videoType] || 1;
  const characters = plan.characters || [];
  const shots = plan.shots || [];
  
  const dialogues = [];
  
  for (const shot of shots) {
    const shotType = shot.type || '';
    const likelihood = SHOT_DIALOGUE_LIKELIHOOD[shotType] || 0.3;
    
    // 根据密度调整概率
    const adjustedLikelihood = likelihood * (density / 3);
    
    // 决定是否生成对白（基于概率）
    const shouldHaveDialogue = Math.random() < adjustedLikelihood;
    
    if (!shouldHaveDialogue) {
      dialogues.push({
        shotId: shot.id,
        hasDialogue: false,
        lines: [],
        promptEnhancement: ''
      });
      continue;
    }
    
    // 确定说话人
    const speaker = determineSpeaker(shot, characters);
    
    // 生成对白内容
    const lines = generateLines(shot, videoType, speaker, shot.duration);
    
    // 生成提示词增强（告诉Seedance角色在说话）
    const promptEnhancement = generatePromptEnhancement(lines, speaker, shot);
    
    dialogues.push({
      shotId: shot.id,
      hasDialogue: true,
      speaker: speaker,
      lines: lines,
      emotion: lines[0]?.emotion || '中性',
      promptEnhancement: promptEnhancement,
      audioType: determineAudioType(videoType, shotType) // 'dialogue' | 'narration' | 'battle_cry'
    });
  }
  
  return {
    title: plan.title,
    videoType: videoType,
    totalShots: shots.length,
    dialogueShots: dialogues.filter(d => d.hasDialogue).length,
    density: density,
    dialogues: dialogues
  };
}

// 确定说话人
function determineSpeaker(shot, characters) {
  const shotChars = shot.characters || [];
  
  if (shotChars.length === 0) {
    // 无角色镜头 → 旁白
    return { type: 'narrator', name: '旁白', id: 'NARRATOR' };
  }
  
  // 选择主要角色（通常是第一个）
  const mainChar = shotChars[0] || '';
  const charName = mainChar.includes('-') ? mainChar.split('-')[1] : mainChar;
  
  // 简单规则：如果角色名包含特定关键词，赋予特定口吻
  let voiceType = 'default';
  if (charName.includes('圣') || charName.includes('侠') || charName.includes('英雄')) voiceType = 'hero';
  else if (charName.includes('魔') || charName.includes('恶') || charName.includes('反')) voiceType = 'villain';
  else if (charName.includes('师') || charName.includes('老') || charName.includes('导')) voiceType = 'mentor';
  
  return {
    type: voiceType,
    name: charName,
    id: mainChar
  };
}

// 生成对白行（v1.2.2-Peng: 支持多角色对话+长对白+剧情片密度3）
function generateLines(shot, videoType, speaker, duration) {
  const templates = DIALOGUE_TEMPLATES[videoType] || DIALOGUE_TEMPLATES.action;
  
  // 根据镜头类型选择模板类别
  let category = 'opening';
  const shotType = shot.type || '';
  const actIndex = shot.actIndex || 1;
  
  if (videoType === 'drama') {
    if (actIndex <= 1) category = 'opening';
    else if (actIndex === 2) category = 'confrontation';
    else if (actIndex === 3) category = 'climax';
    else category = 'resolution';
  } else if (videoType === 'action') {
    if (shotType.includes('抗') || shotType.includes('战')) category = 'battleCry';
    else if (shotType.includes('逼') || shotType.includes('终')) category = 'taunt';
    else if (shotType.includes('痛') || shotType.includes('伤')) category = 'pain';
    else if (shotType.includes('发') || shotType.includes('利')) category = 'victory';
    else category = 'battleCry';
  } else if (videoType === 'educational') {
    if (actIndex <= 1) category = 'intro';
    else if (shotType.includes('示') || shotType.includes('解')) category = 'explanation';
    else if (shotType.includes('调') || shotType.includes('复')) category = 'emphasis';
    else category = 'conclusion';
  } else if (videoType === 'commercial') {
    if (actIndex <= 1) category = 'hook';
    else if (shotType.includes('品') || shotType.includes('亮')) category = 'product';
    else if (shotType.includes('益') || shotType.includes('比')) category = 'benefit';
    else category = 'cta';
  } else if (videoType === 'documentary') {
    if (actIndex <= 1) category = 'opening';
    else if (shotType.includes('访') || shotType.includes('谈')) category = 'interview';
    else if (shotType.includes('揭') || shotType.includes('现')) category = 'revelation';
    else category = 'closing';
  }
  
  const pool = templates[category] || templates[Object.keys(templates)[0]];
  
  // 🔴 v1.2.2-Peng: 多角色对话检测（镜头中有2+角色时，生成对话而非独白）
  const shotChars = shot.characters || [];
  const isMultiCharDialogue = shotChars.length >= 2 && videoType === 'drama' && (category === 'confrontation' || category === 'climax');
  
  if (isMultiCharDialogue) {
    return generateMultiCharDialogue(shot, videoType, duration, pool);
  }
  
  // 随机选择一条模板
  const template = pool[Math.floor(Math.random() * pool.length)];
  
  // 确定字数和时长
  const targetLength = getDialogueLength(duration, DIALOGUE_DENSITY[videoType] || 1);
  
  // 🔴 v1.2.2-Peng: 根据密度扩展对白长度
  let text = template;
  if (DIALOGUE_DENSITY[videoType] >= 2 && duration > 5) {
    // 密度高且镜头长 → 扩展为段落
    text = expandDialogue(template, targetLength, videoType);
  }
  
  // 情绪标签
  const emotions = ['平静', '关切', '坚定', '愤怒', '兴奋', '悲伤', '紧张'];
  const emotion = emotions[Math.floor(Math.random() * emotions.length)];
  
  return [{
    speaker: speaker.name,
    text: text,
    emotion: emotion,
    estimatedDuration: Math.min(duration, text.length * 0.4) // 正常语速：每个字0.4秒
  }];
}

// 🔴 v1.2.2-Peng: 多角色对话生成（争吵/对话交替）
function generateMultiCharDialogue(shot, videoType, duration, pool) {
  const chars = shot.characters || [];
  if (chars.length < 2) return generateLines(shot, videoType, { name: chars[0] || '角色' }, duration);
  
  // 为每个角色分配口吻
  const charSpeakers = chars.map((char, i) => ({
    id: char,
    name: char.split('-')[1] || char,
    voiceType: i === 0 ? 'hero' : 'villain' // 第一个=正方，第二个=反方
  }));
  
  // 生成2-4轮对话
  const rounds = Math.min(4, Math.max(2, Math.floor(duration / 3)));
  const lines = [];
  
  const confrontationPatterns = [
    ['你根本不懂！', '是你太天真了。', '别再说了！', '事实就是如此。'],
    ['为什么？告诉我为什么！', '你不配知道。', '我不信！', '你很快就会明白。'],
    ['你变了，不再是以前的你了。', '人都会变，你也一样。', '不，我不会！', '等着瞧吧。'],
    ['这就是你的选择吗？', '是，我选好了。', '你会后悔的。', '也许吧。']
  ];
  
  const patternPool = confrontationPatterns[Math.floor(Math.random() * confrontationPatterns.length)];
  
  for (let i = 0; i < rounds; i++) {
    const speaker = charSpeakers[i % 2]; // 交替发言
    const text = patternPool[i % patternPool.length] || '...';
    
    lines.push({
      speaker: speaker.name,
      text: text,
      emotion: i % 2 === 0 ? '愤怒' : '冷漠',
      estimatedDuration: Math.min(3, text.length * 0.4)
    });
  }
  
  return lines;
}

// 🔴 v1.1-Peng: 扩展对白为段落（针对剧情片/教育片长镜头）
function expandDialogue(template, targetLength, videoType) {
  const expansions = {
    drama: {
      '（低声）你来了。': '（低声）你来了。我一直在等你，从黄昏等到午夜。我以为...你再也不会出现了。',
      '我有话要对你说。': '我有话要对你说。这些话在我心里憋了很久，每次看到你，我都想开口，但总是说不出口。',
      '这一切...是怎么开始的？': '这一切...是怎么开始的？是从那个雨夜吗？还是更早，从我们第一次见面开始，命运就已经写好了剧本。',
      '这一切不能再继续了。': '这一切不能再继续了。每一天都像是在演戏，演给别人看，演给自己看。真的需要改变了。'
    },
    educational: {
      '今天我们来学习...': '今天我们来学习一个非常重要的知识点。在开始之前，请大家回忆一下上节课的内容，这将帮助我们更好地理解今天的新概念。',
      '首先，让我们了解...': '首先，让我们了解这个概念的基本定义。简单来说，它是指在一定条件下，系统表现出的特定行为模式。',
      '关键步骤如下...': '关键步骤如下：第一步，确认环境安全；第二步，检查所有设备是否正常运行；第三步，按照标准流程执行操作。',
      '记住，安全第一。': '记住，安全第一。这不仅仅是一句口号，而是每一次操作前都必须牢记的原则。一个小小的疏忽，可能导致严重的后果。'
    }
  };
  
  // 如果有扩展版本，优先使用
  if (expansions[videoType] && expansions[videoType][template]) {
    return expansions[videoType][template];
  }
  
  // 否则在模板后追加解释
  if (videoType === 'educational') {
    return template + '。这个步骤非常重要，请仔细观察，确保每一个细节都做到位。理解原理比死记硬背更有效。';
  }
  
  if (videoType === 'drama') {
    return template + '。你不知道的是，这句话在我心里已经排练了无数次，但真正说出口的那一刻，我依然感到心在颤抖。';
  }
  
  return template;
}

// 生成提示词增强（告诉Seedance角色在说话，支持多角色对话v1.1-Peng）
function generatePromptEnhancement(lines, speaker, shot) {
  if (!lines || lines.length === 0) return '';
  
  // 🔴 v1.1-Peng: 多角色对话场景
  if (lines.length > 1) {
    const charNames = [...new Set(lines.map(l => l.speaker))];
    if (charNames.length >= 2) {
      const dialoguePreview = lines.slice(0, 3).map(l => `${l.speaker}: "${l.text}"`).join('；');
      return `，${charNames.join('与')}正在进行激烈对话（${dialoguePreview}）——口型同步，语音对白，非画面文字`;
    }
  }
  
  const line = lines[0];
  const isNarrator = speaker.type === 'narrator';
  
  if (isNarrator) {
    return `，伴随旁白解说（画外音，非画面文字）`;
  }
  
  // 动作片简短台词
  if (shot.duration <= 3) {
    return `，角色${speaker.name}口中喊出简短有力的台词（口型同步，非画面文字）`;
  }
  
  // 一般对话（长对白截断显示）
  const displayText = line.text.length > 20 ? line.text.substring(0, 20) + '...' : line.text;
  return `，角色${speaker.name}正在说话："${displayText}"（口型同步，语音对白，非画面文字）`;
}

// 确定音频类型
function determineAudioType(videoType, shotType) {
  if (videoType === 'action' && (shotType.includes('抗') || shotType.includes('战'))) {
    return 'battle_cry';
  }
  if (videoType === 'educational' || videoType === 'documentary') {
    return 'narration';
  }
  return 'dialogue';
}

// ============ 输出格式化 ============
function formatDialogueDocument(result) {
  let md = `# ${result.title} — 对白设计文档\n\n`;
  md += `**视频类型**: ${result.videoType} | **对白密度**: ${result.density}/3 | **对白镜头**: ${result.dialogueShots}/${result.totalShots}\n\n`;
  md += `---\n\n`;
  
  for (const d of result.dialogues) {
    if (!d.hasDialogue) {
      md += `### ${d.shotId} — 无对白\n\n`;
      continue;
    }
    
    // 🔴 v1.1-Peng: 多角色对话标题
    const speakerNames = [...new Set(d.lines.map(l => l.speaker))].join(' vs ');
    md += `### ${d.shotId} — ${speakerNames} (${d.emotion})\n\n`;
    
    for (const line of d.lines) {
      md += `> **${line.speaker}**: ${line.text}\n`;
      md += `> 情绪: ${line.emotion} | 预估时长: ${line.estimatedDuration.toFixed(1)}秒\n\n`;
    }
    
    md += `**提示词增强**: ${d.promptEnhancement}\n\n`;
    md += `**音频类型**: ${d.audioType}\n\n`;
    md += `---\n\n`;
  }
  
  return md;
}

// ============ 主函数 ============
function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const rawKey = process.argv[i];
    if (!rawKey.startsWith('--')) continue;
    const key = rawKey.replace(/^--/, '');
    const value = process.argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  
  if (!args.plan) {
    console.error('Usage: node dialogue-engine.js generate --plan <story-plan.json> --output-dir <dir>');
    process.exit(1);
  }
  
  const planPath = args.plan;
  const outputDir = args['output-dir'] || path.dirname(planPath);
  
  if (!fss.existsSync(planPath)) {
    console.error(`Error: story-plan.json not found at ${planPath}`);
    process.exit(1);
  }
  
  const plan = JSON.parse(fss.readFileSync(planPath, 'utf8'));
  
  console.log(`🎬 Dialogue Engine: 生成 "${plan.title}" 的对白...`);
  console.log(`   类型: ${plan.videoType || 'action'} | 镜头数: ${plan.shots?.length || 0}`);
  
  const result = generateDialogues(plan);
  
  // 保存JSON
  const jsonPath = path.join(outputDir, '08-dialogues.json');
  fss.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`✅ 对白数据: ${jsonPath}`);
  
  // 保存文档
  const mdPath = path.join(outputDir, '08-dialogues.md');
  fss.writeFileSync(mdPath, formatDialogueDocument(result));
  console.log(`✅ 对白文档: ${mdPath}`);
  
  // 保存提示词增强（给director.js用）
  const enhancementPath = path.join(outputDir, '08-prompt-enhancements.json');
  const enhancements = {};
  for (const d of result.dialogues) {
    enhancements[d.shotId] = d.promptEnhancement || '';
  }
  fss.writeFileSync(enhancementPath, JSON.stringify(enhancements, null, 2));
  console.log(`✅ 提示词增强: ${enhancementPath}`);
  
  console.log(`\n📊 统计: ${result.dialogueShots}/${result.totalShots} 个镜头有对白`);
  console.log(`🎉 对白生成完成！`);
}

main();