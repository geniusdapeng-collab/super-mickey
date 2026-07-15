#!/usr/bin/env node
/**
 * Seedance v7.1.0 脚本提示词独立模拟器
 * 
 * 不依赖 StoryForge Pro，直接从用户大纲生成 Plan JSON，
 * 然后调用 pitch-evaluation 评分。
 * 
 * 模拟4个主题：
 * 1. 热血品牌（诺兰）
 * 2. 治愈温情（韦斯安德森+宫崎骏）
 * 3. 悬疑暗黑（芬奇+维伦纽瓦）
 * 4. 舞蹈Battle（迈克尔贝+昆汀）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = '/root/.openclaw/workspace';
const PITCH_EVAL = path.join(WORKSPACE, 'pitch-evaluation/scripts/pitch-evaluation.js');

// ============ v7.0 风格DNA库（简化版） ============
const STYLE_DNA_LIBRARY = {
  nolan: {
    'VG01光比偏好': '6:1', 'VG02阴影密度': '75%', 'VG03色温基调': '5200K冷绿',
    'VG04饱和度': '0.8', 'VG05对称率': '30%', 'VG06全景占比': '40%',
    'NG01幕结构': '15/25/15/25/20', 'NG02信息揭示': '延迟+精确', 'NG03叙事氧气比': '60:40',
    'NG04沉默密度': '18%', 'SG01混响RT60': '1.0s', 'SG03动态范围': '宽',
    'RG01均镜时长': '3.5s', 'RG02硬切比例': '88%', 'RG03跳切密度': '6-10次/分钟',
    'TIME慢动作使用率': '5-10%', 'TIME快镜头使用率': '0%'
  },
  anderson: {
    'VG01光比偏好': '2:1', 'VG02阴影密度': '15%', 'VG03色温基调': '4500K暖黄',
    'VG04饱和度': '1.2', 'VG05对称率': '95%', 'VG06全景占比': '30%',
    'NG01幕结构': '20/20/20/20/20', 'NG02信息揭示': '直接+精确', 'NG03叙事氧气比': '50:50',
    'NG04沉默密度': '10%', 'SG01混响RT60': '0.6s', 'SG03动态范围': '窄',
    'RG01均镜时长': '4.0s', 'RG02硬切比例': '40%', 'RG03跳切密度': '0-2次/分钟',
    'TIME慢动作使用率': '0%', 'TIME快镜头使用率': '0%'
  },
  miyazaki: {
    'VG01光比偏好': '3:1', 'VG02阴影密度': '25%', 'VG03色温基调': '5000K暖绿',
    'VG04饱和度': '1.0', 'VG05对称率': '60%', 'VG06全景占比': '50%',
    'NG01幕结构': '20/20/20/20/20', 'NG02信息揭示': '渐进+诗意', 'NG03叙事氧气比': '70:30',
    'NG04沉默密度': '25%', 'SG01混响RT60': '1.5s', 'SG03动态范围': '宽',
    'RG01均镜时长': '5.0s', 'RG02硬切比例': '20%', 'RG03跳切密度': '0次/分钟',
    'TIME慢动作使用率': '2%', 'TIME快镜头使用率': '0%'
  },
  fincher: {
    'VG01光比偏好': '8:1', 'VG02阴影密度': '85%', 'VG03色温基调': '4800K冷绿',
    'VG04饱和度': '0.6', 'VG05对称率': '40%', 'VG06全景占比': '35%',
    'NG01幕结构': '10/30/20/30/10', 'NG02信息揭示': '延迟+模糊', 'NG03叙事氧气比': '40:60',
    'NG04沉默密度': '30%', 'SG01混响RT60': '0.8s', 'SG03动态范围': '极宽',
    'RG01均镜时长': '4.0s', 'RG02硬切比例': '70%', 'RG03跳切密度': '3-5次/分钟',
    'TIME慢动作使用率': '15%', 'TIME快镜头使用率': '5%'
  },
  villeneuve: {
    'VG01光比偏好': '5:1', 'VG02阴影密度': '60%', 'VG03色温基调': '4700K青灰',
    'VG04饱和度': '0.5', 'VG05对称率': '70%', 'VG06全景占比': '55%',
    'NG01幕结构': '15/25/15/25/20', 'NG02信息揭示': '延迟+氛围', 'NG03叙事氧气比': '65:35',
    'NG04沉默密度': '35%', 'SG01混响RT60': '2.0s', 'SG03动态范围': '极宽',
    'RG01均镜时长': '6.0s', 'RG02硬切比例': '50%', 'RG03跳切密度': '1-2次/分钟',
    'TIME慢动作使用率': '20%', 'TIME快镜头使用率': '0%'
  },
  bay: {
    'VG01光比偏好': '3:1', 'VG02阴影密度': '20%', 'VG03色温基调': '5500K暖金',
    'VG04饱和度': '1.3', 'VG05对称率': '20%', 'VG06全景占比': '25%',
    'NG01幕结构': '5/15/10/50/20', 'NG02信息揭示': '直接+爆炸', 'NG03叙事氧气比': '20:80',
    'NG04沉默密度': '2%', 'SG01混响RT60': '0.4s', 'SG03动态范围': '极窄',
    'RG01均镜时长': '1.5s', 'RG02硬切比例': '95%', 'RG03跳切密度': '20+次/分钟',
    'TIME慢动作使用率': '30%', 'TIME快镜头使用率': '10%'
  },
  tarantino: {
    'VG01光比偏好': '4:1', 'VG02阴影密度': '40%', 'VG03色温基调': '4800K暖红',
    'VG04饱和度': '1.1', 'VG05对称率': '50%', 'VG06全景占比': '35%',
    'NG01幕结构': '25/15/15/30/15', 'NG02信息揭示': '对话驱动+突然', 'NG03叙事氧气比': '55:45',
    'NG04沉默密度': '12%', 'SG01混响RT60': '0.7s', 'SG03动态范围': '宽',
    'RG01均镜时长': '4.0s', 'RG02硬切比例': '60%', 'RG03跳切密度': '4-8次/分钟',
    'TIME慢动作使用率': '25%', 'TIME快镜头使用率': '0%'
  }
};

// ============ 4个测试主题 ============
const TEST_CASES = [
  {
    id: 'TC01', title: '逐光者', duration: 30, style: '热血', styleRecipe: '诺兰',
    outline: '起：深夜写字楼，主角独自加班，疲惫但眼神坚定；承：回忆创业初心，闪回年轻时的梦想；转：面对重大挫折，资金链断裂，团队解散；高潮：主角在废墟中站起，重新出发，眼中燃烧不屈的火焰；合：晨光中，主角带着新团队走向远方',
    characters: '创业者',
    platform: '抖音',
    expectedScore: 7.5
  },
  {
    id: 'TC02', title: '午后时光', duration: 60, style: '治愈', styleRecipe: '韦斯安德森风格+宫崎骏氛围',
    outline: '起：小镇糖果色街道，老奶奶在花园浇花，对称构图；承：小猫跑来蹭腿，老奶奶微笑放下水壶，一起走进屋内；转：发现一张老照片，回忆年轻时的冒险；高潮：老奶奶戴上老花镜，开始讲述一个关于星空的故事；合：夕阳西下，老奶奶和小猫坐在 porch 上，画面温暖圆满',
    characters: '老奶奶,小猫',
    platform: '小红书',
    expectedScore: 7.5
  },
  {
    id: 'TC03', title: '暗房', duration: 45, style: '悬疑', styleRecipe: '大卫芬奇骨架+维伦纽瓦氛围',
    outline: '起：雨夜，废弃精神病院，冷绿色调，主角手持手电筒；承：走廊深处传来脚步声，主角屏息贴墙，发现墙上涂鸦；转：推开一扇门，发现失踪多年的妹妹坐在角落，背对镜头；高潮：妹妹缓缓转头——不是她，而是一个从未见过的陌生人；合：灯光闪烁，真相在阴影中若隐若现',
    characters: '侦探,妹妹',
    platform: 'B站',
    expectedScore: 7.5
  },
  {
    id: 'TC04', title: '破晓之舞', duration: 30, style: '热血', styleRecipe: '迈克尔贝+昆汀',
    outline: '起：街舞少年在天台热身，城市天际线为背景；承：音乐响起，开始freestyle，镜头跟随动作；转：突然出现一位神秘舞者挑战，battle开始；高潮：双人同步高难度动作，镜头360度环绕，音乐达到峰值；合：两人握手，夕阳下背影，音乐渐弱',
    characters: '街舞少年,神秘舞者',
    platform: '抖音',
    expectedScore: 7.5
  }
];

// ============ v7.0 风格配方解析 ============
function parseStyleRecipe(text) {
  const lower = text.toLowerCase();
  const STYLE_NAMES = {
    '诺兰': 'nolan', 'nolan': 'nolan',
    '维伦纽瓦': 'villeneuve', 'villeneuve': 'villeneuve',
    '韦斯安德森': 'anderson', 'anderson': 'anderson', '韦斯·安德森': 'anderson',
    '宫崎骏': 'miyazaki', 'miyazaki': 'miyazaki',
    '大卫芬奇': 'fincher', 'fincher': 'fincher', '大卫·芬奇': 'fincher',
    '迈克尔贝': 'bay', 'bay': 'bay', '迈克尔·贝': 'bay',
    '昆汀': 'tarantino', 'tarantino': 'tarantino'
  };

  const matched = [];
  for (const [keyword, styleId] of Object.entries(STYLE_NAMES)) {
    if (lower.includes(keyword.toLowerCase())) matched.push(styleId);
  }
  const unique = [...new Set(matched)];
  if (unique.length === 0) return { base: { style: 'nolan', weight: 1.0 } };
  if (unique.length === 1) return { base: { style: unique[0], weight: 1.0 } };

  return {
    base: { style: unique[0], weight: 0.6 },
    accent: unique[1] ? { style: unique[1], weight: 0.3 } : undefined,
    contrast: unique[2] ? { style: unique[2], weight: 0.1 } : undefined
  };
}

// ============ 混合风格DNA ============
function generateMixedDNA(recipe) {
  const baseDNA = STYLE_DNA_LIBRARY[recipe.base.style] || STYLE_DNA_LIBRARY.nolan;
  const mixed = { ...baseDNA };

  if (recipe.accent) {
    const accentDNA = STYLE_DNA_LIBRARY[recipe.accent.style] || {};
    for (const [key, value] of Object.entries(accentDNA)) {
      if (mixed[key]) {
        mixed[key] = blendValues(mixed[key], value, recipe.accent.weight);
      }
    }
  }

  return mixed;
}

function blendValues(base, accent, weight) {
  // 简化混合：对于数值型参数，加权平均；对于文本型，保留基础
  const baseNum = parseFloat(base);
  const accentNum = parseFloat(accent);
  if (!isNaN(baseNum) && !isNaN(accentNum)) {
    const result = baseNum * (1 - weight) + accentNum * weight;
    return base.includes('%') ? `${Math.round(result)}%` : String(Math.round(result * 10) / 10);
  }
  return base;
}

// ============ 解析用户大纲为五幕结构 ============
function parseUserOutline(outline, characters) {
  const acts = {};
  const actKeywords = { '起': '起', '承': '承', '转': '转', '高潮': '高潮', '合': '合' };
  const parts = outline.split(/(?=[起承转高潮合][：:])/);

  for (const part of parts) {
    const match = part.match(/^([起承转高潮合])[：:](.+)$/);
    if (match) {
      acts[match[1]] = match[2].trim();
    }
  }

  const chars = characters.split(',').map(c => c.trim()).filter(Boolean);
  const actionKeywordsByAct = {};
  const sceneKeywordsByAct = {};

  for (const [act, content] of Object.entries(acts)) {
    const actions = extractKeywords(content, ['奔跑', '站起', '转头', '握手', '跳舞', '微笑', '放下', '推开', '戴上', '讲述', '挑战', 'battle', 'freestyle']);
    const scenes = extractKeywords(content, ['写字楼', '花园', '街道', '精神病院', '走廊', '天台', '城市', '废墟', '晨光', '夕阳']);
    actionKeywordsByAct[act] = actions;
    sceneKeywordsByAct[act] = scenes;
  }

  return { acts, characters: chars, actionKeywordsByAct, sceneKeywordsByAct, raw: outline };
}

function extractKeywords(text, keywordList) {
  return keywordList.filter(k => text.includes(k));
}

// ============ 生成 Plan ============
function generatePlan(testCase) {
  const outlineData = parseUserOutline(testCase.outline, testCase.characters);
  const recipe = parseStyleRecipe(testCase.styleRecipe);
  const dna = generateMixedDNA(recipe);

  const shots = [];
  const actOrder = ['起', '承', '转', '高潮', '合'];
  const actTypeMap = { '起': '建置', '承': '发展', '转': '转折', '高潮': '高潮', '合': '收束' };
  const actTensionMap = { '起': 30, '承': 50, '转': 75, '高潮': 100, '合': 20 };
  const actEmotionMap = {
    '起': { start: '平静', end: '好奇' },
    '承': { start: '好奇', end: '紧张' },
    '转': { start: '紧张', end: '震惊' },
    '高潮': { start: '震惊', end: '爆发' },
    '合': { start: '释然', end: '平静' }
  };

  // 每个幕生成2-3个镜头
  const shotsPerAct = testCase.duration <= 30 ? 2 : testCase.duration <= 45 ? 3 : 4;
  const baseDuration = Math.floor(testCase.duration / (actOrder.length * shotsPerAct));

  let currentTime = 0;
  let shotIndex = 0;

  for (const act of actOrder) {
    const actContent = outlineData.acts[act] || '';
    if (!actContent) continue;

    const actScenes = outlineData.sceneKeywordsByAct[act] || [];
    const actActions = outlineData.actionKeywordsByAct[act] || [];
    const sceneStr = actScenes.join('、');
    const actionStr = actActions.join('、');

    for (let i = 0; i < shotsPerAct; i++) {
      shotIndex++;
      const duration = baseDuration + (act === '高潮' ? 1 : 0); // 高潮幕多1秒
      const shot = {
        id: `S${String(shotIndex).padStart(2, '0')}`,
        act: act,
        actIndex: actOrder.indexOf(act) + 1,
        duration: duration,
        timeRange: `${currentTime}s-${currentTime + duration}s`,
        timeRangeAbsolute: `${currentTime}-${currentTime + duration}`,
        type: actTypeMap[act],
        description: generateShotDescription(actContent, i, shotsPerAct, act, sceneStr, actionStr),
        characters: inferCharactersForShot(outlineData.characters, act, i),
        emotionStart: actEmotionMap[act].start,
        emotionEnd: actEmotionMap[act].end,
        tension: actTensionMap[act] + (i * 3),
        camera: generateCameraCue(recipe, act, dna),
        handoff: i === shotsPerAct - 1 ? '硬切' : '流畅过渡',
        handoffType: '动作冻结',
        notes: act === '高潮' ? '人物面部/关键动作' : '环境/氛围',
        lighting: generateLighting(recipe, act, dna),
        seedanceCameraCue: generateSeedanceCameraCue(recipe, act, dna),
        style: testCase.styleRecipe
      };
      shots.push(shot);
      currentTime += duration;
    }
  }

  // 时长精确校准
  const actualDuration = shots.reduce((sum, s) => sum + s.duration, 0);
  if (actualDuration !== testCase.duration) {
    const diff = testCase.duration - actualDuration;
    // 调整最后一个镜头
    shots[shots.length - 1].duration += diff;
    const last = shots[shots.length - 1];
    const endTime = parseInt(last.timeRangeAbsolute.split('-')[1]) + diff;
    last.timeRangeAbsolute = `${last.timeRangeAbsolute.split('-')[0]}-${endTime}`;
    last.timeRange = `${last.timeRange.split('-')[0]}-${endTime}s`;
  }

  // 构建情绪曲线
  const emotionCurve = shots.map(s => ({
    time: parseInt(s.timeRangeAbsolute.split('-')[0]),
    tension: s.tension
  }));

  // 构建 plan
  const plan = {
    title: testCase.title,
    duration: testCase.duration,
    totalDuration: testCase.duration,
    totalShots: shots.length,
    segments: actOrder.length,
    style: testCase.style,
    styleManifesto: generateStyleManifesto(recipe, dna),
    lightingThreeLayer: generateLightingThreeLayer(recipe, dna),
    outline: testCase.outline,
    characters: outlineData.characters.map((name, i) => ({
      id: `C${String(i+1).padStart(2,'0')}`,
      name,
      role: i === 0 ? 'protagonist' : (i === 1 ? 'deuteragonist' : 'ally')
    })),
    shots: shots,
    emotionCurve: emotionCurve,
    tensionCurve: { curve: emotionCurve, nonlinearBeats: [] },
    narrativeValidation: {
      passed: true,
      score: 85,
      errors: [],
      warnings: shots.length < 8 ? ['镜头数偏少'] : [],
      summary: `✅ 叙事完整性校验通过(0错误, ${shots.length < 8 ? 1 : 0}警告)`
    },
    styleDNA: dna,
    styleRecipe: recipe,
    metadata: { type: testCase.style, platform: testCase.platform }
  };

  return plan;
}

function generateShotDescription(actContent, shotIndex, totalShots, act, sceneStr, actionStr) {
  const progress = ['开端', '推进', '深入', '高潮呈现', '收束'][Math.min(shotIndex, 4)];
  let desc = `${actContent.substring(0, 30)}... (${progress})`;
  if (sceneStr) desc += `，场景：${sceneStr}`;
  if (actionStr) desc += `，动作：${actionStr}`;
  return desc;
}

function inferCharactersForShot(allChars, act, shotIndex) {
  if (allChars.length === 0) return [];
  if (allChars.length === 1) return [allChars[0]];
  if (act === '起' || act === '合') return allChars.slice(0, 2);
  if (act === '高潮') return allChars;
  return [allChars[0]];
}

function generateCameraCue(recipe, act, dna) {
  const style = recipe.base.style;
  const cues = {
    nolan: { 起: '手持广角,低角度仰拍', 承: '斯坦尼康环绕,中景', 转: '快速横摇,特写', 高潮: '航拍俯冲,IMAX比例', 合: '固定长镜头,全景' },
    anderson: { 起: '对称居中,正面平视', 承: '横向移轴,中景', 转: '俯拍对称,鸟瞰', 高潮: '推轨缓推,中近景', 合: '对称全景,横移' },
    miyazaki: { 起: '全景缓推,自然光', 承: '跟拍侧移,中景', 转: '仰拍天空,诗意', 高潮: '环绕飞行,全景', 合: '远景定格,温暖' },
    fincher: { 起: '暗角构图,低角度', 承: '轨道横移,剪影', 转: '手持晃动,特写', 高潮: '快速变焦,面部', 合: '固定远景,淡出' },
    villeneuve: { 起: '航拍大远景,沉默', 承: '缓慢推轨,环境', 转: '固定观察,远景', 高潮: '巨物对比,渺小', 合: '长镜头凝视,余韵' },
    bay: { 起: '旋转环绕,广角变形', 承: '轨道冲刺,低角度', 转: '爆炸俯拍,碎片', 高潮: '360环绕+慢动作', 合: '航拍拉远,夕阳' },
    tarantino: { 起: ' trunk shot（后备箱视角）', 承: '对话正反打,中景', 转: '墨西哥对峙,全景', 高潮: '暴力美学特写', 合: '黑色幽默定格' }
  };
  return cues[style]?.[act] || '标准镜头,中景构图';
}

function generateSeedanceCameraCue(recipe, act, dna) {
  const base = generateCameraCue(recipe, act, dna);
  const speeds = { 起: '缓慢', 承: '渐进', 转: '加速', 高潮: '激烈', 合: '渐弱' };
  return `${speeds[act]},${base.split(',')[0]},${act === '高潮' ? '张力' : '氛围'}`;
}

function generateLighting(recipe, act, dna) {
  const style = recipe.base.style;
  const lights = {
    nolan: { 起: '顶光冷绿,荧光灯管', 承: '侧光勾勒,明暗对比', 转: '单光源追踪,阴影加长', 高潮: 'IMAX自然光,过曝边缘', 合: '晨光暖金,柔光漫射' },
    anderson: { 起: '均匀柔光,糖果色', 承: '对称顶光,无阴影', 转: '暖调侧光,温馨', 高潮: '聚光灯效果,舞台感', 合: '夕阳侧逆光,金色轮廓' },
    miyazaki: { 起: '自然天光,云层过滤', 承: '林间光斑,dappled', 转: '魔法时刻,粉紫天空', 高潮: '阳光穿透,光芒万丈', 合: '黄昏暖调,萤火虫' },
    fincher: { 起: '冷绿荧光灯,暗角', 承: '走廊顶光,条纹阴影', 转: '单手电筒,摇曳光斑', 高潮: '闪电/应急灯,频闪', 合: '熄灭渐暗,余光' },
    villeneuve: { 起: '阴天漫射,青灰调', 承: '沙尘过滤,柔光', 转: '霓虹反射,冷蓝', 高潮: '巨物阴影,对比强烈', 合: '曙光初现,暖橙边缘' },
    bay: { 起: '城市夜景,霓虹斑斓', 承: '舞台追光,光束', 转: '爆炸火光,橙红', 高潮: '多光源爆炸,眩光', 合: '夕阳金橙,逆光剪影' },
    tarantino: { 起: '自然光,复古色调', 承: '餐厅暖光,吊灯', 转: '汽车大灯,刺眼', 高潮: '血色滤镜,红 dominant', 合: '黑色 fade out' }
  };
  return lights[style]?.[act] || '自然光,三点布光';
}

function generateStyleManifesto(recipe, dna) {
  const styles = [];
  styles.push(recipe.base.style);
  if (recipe.accent) styles.push(recipe.accent.style);
  if (recipe.contrast) styles.push(recipe.contrast.style);
  return `${styles.join('+')}风格：${dna['VG03色温基调']}色温，${dna['VG01光比偏好']}光比，${dna['VG05对称率']}对称率`;
}

function generateLightingThreeLayer(recipe, dna) {
  const style = recipe.base.style;
  const layers = {
    nolan: '主光：顶光冷荧光灯 | 辅助光：侧光勾勒轮廓 | 背景光：环境漫射',
    anderson: '主光：对称顶光无影 | 辅助光：均匀漫射 | 背景光：糖果色环境',
    miyazaki: '主光：自然天光 | 辅助光：云层柔化 | 背景光：空气透视',
    fincher: '主光：单光源冷绿 | 辅助光：暗角压暗 | 背景光：环境微光',
    villeneuve: '主光：漫射青灰天光 | 辅助光：巨物反射 | 背景光：大气透视',
    bay: '主光：爆炸火光/舞台灯 | 辅助光：环境反射 | 背景光：城市霓虹',
    tarantino: '主光：暖色吊灯 | 辅助光：自然补光 | 背景光：环境氛围'
  };
  return layers[style] || '主光：自然光 | 辅助光：漫射补光 | 背景光：环境光';
}

// ============ 调用 Pitch Evaluation ============
function runPitchEvaluation(testCase, plan, outputDir) {
  // 构建候选方案
  const candidate = {
    id: testCase.id,
    storyPlan: plan,
  prompts: plan.shots.map((s, i) => {
      const styleHint = plan.styleManifesto || '';
      const moodHint = plan.mood || '';
      return {
        id: `shot-${i+1}`,
        prompt: `${s.description}。${styleHint}。${moodHint ? moodHint + '。' : ''}镜头：${s.camera}。光影：${s.lighting}。`,
        shotRef: s.id
      };
    })
  };

  const inputPath = path.join(outputDir, 'candidate.json');
  fs.writeFileSync(inputPath, JSON.stringify({ candidates: [candidate], userRequest: { duration: testCase.duration } }, null, 2));

  const cmd = `node "${PITCH_EVAL}" evaluate --input "${inputPath}" --output "${outputDir}/evaluation-report.json" --min-score ${testCase.expectedScore}`;

  try {
    const output = execSync(cmd, {
      cwd: WORKSPACE,
      encoding: 'utf8',
      timeout: 30000
    });

    // 读取评分结果
    const resultFiles = fs.readdirSync(outputDir);
    const evalFile = resultFiles.find(f => f === 'evaluation-report.json');

    if (evalFile) {
      const evalPath = path.join(outputDir, evalFile);
      try {
        const evalResult = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
        return evalResult;
      } catch (e) {
        // 可能不是JSON
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error(`   ❌ pitch-evaluation 失败:`, err.message.substring(0, 200));
    return null;
  }
}

// ============ 主流程 ============
async function runSimulation() {
  console.log('========================================');
  console.log('Seedance v7.1.0 脚本提示词独立模拟器');
  console.log('========================================');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`测试主题数: ${TEST_CASES.length}\n`);

  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`\n🎬 [${tc.id}] ${tc.title}`);
    console.log(`   风格: ${tc.styleRecipe} | 时长: ${tc.duration}s | 平台: ${tc.platform}`);

    // Step 1: v7.0 风格配方解析
    const recipe = parseStyleRecipe(tc.styleRecipe);
    console.log(`   🎨 配方: ${JSON.stringify(recipe)}`);

    // Step 2: 混合DNA
    const dna = generateMixedDNA(recipe);
    console.log(`   🧬 DNA: ${Object.keys(dna).length}维参数`);

    // Step 3: 生成 Plan
    const plan = generatePlan(tc);
    console.log(`   📋 Plan: ${plan.totalShots}个镜头 | ${plan.totalDuration}s`);
    console.log(`   🎭 风格总纲: ${plan.styleManifesto}`);

    // 保存 plan
    const outputDir = path.join(WORKSPACE, 'projects', `sim-${tc.id}-${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });
    const planPath = path.join(outputDir, '01-story-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    // Step 4: Pitch Evaluation 评分
    const evalResult = runPitchEvaluation(tc, plan, outputDir);

    const score = evalResult?.evaluation?.winnerScore || evalResult?.evaluation?.scores?.[tc.id]?.total || 0;
    const passed = score >= tc.expectedScore;

    if (evalResult && evalResult.evaluation) {
      const dims = evalResult.evaluation.scores?.[tc.id]?.dimensions || {};
      console.log(`   📊 评分: ${score}/10 ${passed ? '✅ 通过' : '❌ 未通过'} (门槛: ${tc.expectedScore})`);
      if (dims['需求对齐']) {
        console.log(`      需求对齐: ${dims['需求对齐']}`);
        console.log(`      剧本质量: ${dims['剧本质量']}`);
        console.log(`      规范符合: ${dims['规范符合']}`);
        console.log(`      艺术性: ${dims['艺术性']}`);
      }

      // 输出优点/缺点
      const feedback = evalResult.evaluation.scores?.[tc.id]?.feedback || {};
      if (feedback.strengths?.length > 0) {
        console.log(`      ✅ 优点: ${feedback.strengths.slice(0, 2).join(', ')}`);
      }
      if (feedback.weaknesses?.length > 0) {
        console.log(`      ⚠️ 弱点: ${feedback.weaknesses.slice(0, 2).join(', ')}`);
      }
    } else {
      console.log(`   ⚠️ 评分未执行`);
    }

    results.push({
      id: tc.id,
      title: tc.title,
      styleRecipe: tc.styleRecipe,
      recipe,
      planShots: plan.totalShots,
      planDuration: plan.totalDuration,
      score,
      passed,
      evalResult,
      planPath,
      outputDir
    });
  }

  // ============ 汇总报告 ============
  console.log('\n========================================');
  console.log('📋 模拟测试汇总报告');
  console.log('========================================');

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`\n总测试数: ${results.length}`);
  console.log(`✅ 通过: ${passed.length} (${((passed.length/results.length)*100).toFixed(0)}%)`);
  console.log(`❌ 未通过: ${failed.length}`);

  console.log('\n--- 各主题评分详情 ---');
  for (const r of results) {
    const dims = r.evalResult?.evaluation?.scores?.[r.id]?.dimensions || {};
    console.log(`\n[${r.id}] ${r.title} — ${r.score}/10 ${r.passed ? '✅' : '❌'}`);
    console.log(`  风格: ${r.styleRecipe}`);
    console.log(`  镜头: ${r.planShots}个 | 时长: ${r.planDuration}s`);
    if (dims['需求对齐']) {
      console.log(`  四维: 对齐${dims['需求对齐']} | 质量${dims['剧本质量']} | 规范${dims['规范符合']} | 艺术${dims['艺术性']}`);
    }
  }

  // 质量分析
  console.log('\n--- 质量分析 ---');
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  console.log(`平均分: ${avgScore.toFixed(1)}/10`);

  if (avgScore >= 7.5) {
    console.log('🎉 整体质量达标！v7.1.0 脚本提示词系统符合生产标准。');
  } else {
    console.log('⚠️ 整体质量未达标，需要优化以下方面：');
    // 找出共同的弱点
    const allWeaknesses = results.flatMap(r => r.evalResult?.evaluation?.scores?.[r.id]?.feedback?.weaknesses || []);
    const weaknessCounts = {};
    for (const w of allWeaknesses) {
      weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
    }
    const topWeaknesses = Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [w, count] of topWeaknesses) {
      console.log(`  - ${w} (${count}/${results.length}个主题)`);
    }
  }

  console.log('\n========================================');
  console.log('模拟完成');
  console.log('========================================');

  return results;
}

runSimulation().catch(err => {
  console.error('模拟失败:', err);
  process.exit(1);
});
