#!/usr/bin/env node
/**
 * Dialogue Master v3.6-Peng
 * L3 剧本层 — 对白大师
 * 
 * 生成高质量角色对白，支持多语言风格
 * 短剧模式：简短有力，每集台词≤150字
 */

const fs = require('fs').promises;
const fss = require('fs');

const EMOTION_MAP = {
  '愤怒': { delivery: '语速加快，音量提高', subtext: '恐惧的伪装' },
  '悲伤': { delivery: '语速放缓，声音低沉', subtext: '未表达的爱' },
  '喜悦': { delivery: '轻快活泼，带笑声', subtext: ' relief ' },
  '恐惧': { delivery: '颤抖，断断续续', subtext: '失去控制的焦虑' },
  '决心': { delivery: '坚定有力，一字一顿', subtext: '自我说服' },
  '温柔': { delivery: '柔和缓慢，带停顿', subtext: '深层关怀' }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const dialogues = masterDialogue(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'dialogue-master',
    output: dialogues
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Dialogue Master: ${dialogues.length}个场景对白完成`);
}

function masterDialogue(input) {
  // 支持两种输入格式：{ sceneData: { scenes } } 或 { plot: { sceneBreakdown } }
  const sceneData = input.sceneData || {};
  const plotData = input.plot || {};
  const characterData = input.characterData || input.characters || {};
  const theme = input.theme || {};
  const seriesMode = input.seriesMode || false;
  
  // 从 sceneData 或 plotData 获取场景列表
  const scenes = sceneData.scenes || plotData.sceneBreakdown || [];
  const characters = characterData.characters || characterData || [];
  
  const dialogueScript = scenes.map((scene, index) => {
    // 标准化场景对象
    const normalizedScene = {
      sceneId: scene.sceneId || `SC${String(index + 1).padStart(2, '0')}`,
      characters: scene.characters || [],
      emotionalTone: scene.emotionalTone || scene.emotionalTurn || '中性',
      purpose: scene.purpose || '场景',
      durationEstimate: scene.durationEstimate || 15
    };
    
    const sceneDialogues = generateSceneDialogue(normalizedScene, characters, theme, seriesMode);
    return {
      sceneId: normalizedScene.sceneId,
      lines: sceneDialogues,
      promptEnhancement: generatePromptEnhancement(normalizedScene, characters)
    };
  });
  
  return {
    dialogueScript,
    statistics: {
      totalLines: dialogueScript.reduce((sum, s) => sum + s.lines.length, 0),
      totalWords: countTotalWords(dialogueScript),
      seriesMode,
      avgWordsPerLine: countTotalWords(dialogueScript) / Math.max(1, dialogueScript.reduce((sum, s) => sum + s.lines.length, 0))
    }
  };
}

function generateSceneDialogue(scene, characters, theme, seriesMode) {
  const lines = [];
  const sceneChars = scene.characters || [];
  const charObjects = sceneChars.map(cid => characters.find(c => c.id === cid)).filter(Boolean);
  
  if (charObjects.length === 0) return lines;
  
  // 确定场景情绪
  const sceneEmotion = scene.emotionalTone || '中性';
  
  // 计算 shot 数量（从 scene.shots 或估算）
  const shotCount = scene.shots?.length || Math.max(2, Math.round((scene.durationEstimate || 15) / 8));
  
  // 对白密度：每个 shot 至少1句，drama/action类型更多
  const emotionType = sceneEmotion.toLowerCase();
  const isDialogueHeavy = emotionType.includes('对话') || emotionType.includes('争吵') || 
                         emotionType.includes('谈判') || emotionType.includes('告白');
  const linesPerShot = isDialogueHeavy ? 2 : (seriesMode ? 1 : 1.5);
  const lineCount = Math.max(shotCount, Math.round(shotCount * linesPerShot));
  
  // 生成对白：每个 shot 分配对白
  let currentShotIdx = 0;
  let shotLinesCount = 0;
  const linesPerCurrentShot = isDialogueHeavy ? 2 : 1;
  
  for (let i = 0; i < lineCount; i++) {
    const speaker = charObjects[i % charObjects.length];
    const emotion = inferEmotion(sceneEmotion, i);
    const emotionData = EMOTION_MAP[emotion] || EMOTION_MAP['温柔'];
    
    const text = generateLineText(speaker, emotion, theme, seriesMode);
    
    lines.push({
      speaker: `${speaker.id}-${speaker.name}`,
      text,
      emotion: `${emotion}中带着${emotionData.subtext}`,
      deliveryNote: emotionData.delivery,
      subText: emotionData.subtext,
      duration: estimateDuration(text),
      shotIndex: currentShotIdx,  // 标记属于哪个shot
      shotId: scene.shots?.[currentShotIdx]?.shotId || `${scene.sceneId}-S${currentShotIdx + 1}`
    });
    
    shotLinesCount++;
    if (shotLinesCount >= linesPerCurrentShot) {
      shotLinesCount = 0;
      currentShotIdx = (currentShotIdx + 1) % shotCount;
    }
  }
  
  return lines;
}

function inferEmotion(sceneEmotion, index) {
  const emotions = ['愤怒', '悲伤', '决心', '温柔', '恐惧', '喜悦'];
  
  if (sceneEmotion.includes('沸')) return '愤怒';
  if (sceneEmotion.includes('冷')) return '悲伤';
  if (sceneEmotion.includes('暖')) return '温柔';
  
  return emotions[index % emotions.length];
}

function generateLineText(speaker, emotion, theme, seriesMode) {
  const templates = {
    '愤怒': [
      '你根本不明白！',
      '不能再这样下去了！',
      '这太过分了！'
    ],
    '悲伤': [
      '我以为...再也见不到你了。',
      '为什么会变成这样？',
      '我真的尽力了...'
    ],
    '决心': [
      '这一次，我不会退缩。',
      '我不会放弃的。',
      '一起去面对吧。'
    ],
    '温柔': [
      '没关系，我在这里。',
      '你不必一个人扛。',
      '谢谢你。'
    ],
    '恐惧': [
      '那...那是什么？',
      '我们快离开这里！',
      '不要丢下我！'
    ],
    '喜悦': [
      '太好了！我们做到了！',
      '你看，多美啊。',
      '终于...终于等到这一天。'
    ]
  };
  
  const templateList = templates[emotion] || templates['温柔'];
  
  if (seriesMode) {
    // 短剧模式：简短有力，单句≤20字
    const shortLines = templateList.filter(l => l.length <= 20);
    return shortLines[Math.floor(Math.random() * shortLines.length)] || templateList[0];
  }
  
  return templateList[Math.floor(Math.random() * templateList.length)];
}

function estimateDuration(text) {
  // 中文字数 / 3.5 ≈ 秒数
  const charCount = text.length;
  return Math.max(1.5, charCount / 3.5);
}

function generatePromptEnhancement(scene, characters) {
  const charNames = characters.map(c => c.name).join('、');
  return `场景包含角色：${charNames}。情绪基调：${scene.emotionalTone || '中性'}。`;
}

function countTotalWords(dialogueScript) {
  return dialogueScript.reduce((sum, scene) => {
    return sum + scene.lines.reduce((lineSum, line) => lineSum + line.text.length, 0);
  }, 0);
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
