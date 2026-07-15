#!/usr/bin/env node
/**
 * Seedance Render Engine v9.2.0-Peng
 * 从 Director v9.2-Peng 拆分独立的渲染引擎
 * 
 * 职责：将分镜片段批量提交到 Seedance API，处理 Multi-Shot / 单镜头策略，轮询下载，精确切分
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { execAsync, shellQuote } = require('../../seedance-director/scripts/exec-utils');
const { generateCacheKey, checkCache, setCache } = require('./render-cache'); // P1-4.2: 渲染缓存层

// ============ 配置（v5.1-Peng: 接入配置中心） ============
let CONFIG, MODEL_PRIORITY, FALLBACK_ERRORS, MAX_CONCURRENT_DEFAULT, 
    RETRY_DELAY_MS, QUOTA_RETRY_DELAYS, BATCH_COOLDOWN_MS, 
    OUTPUT_ROOT, PROMPT_MAX_LENGTH, DEGRADATION_STEPS;

function initConfig() {
  const { CONFIG: cfg } = require('../../seedance-director/scripts/config-center');
  CONFIG = cfg;
  
  MODEL_PRIORITY = cfg.render.modelPriority.map((m, i) => ({ ...m, priority: i }));
  FALLBACK_ERRORS = ['400', '429', '500', '503', '模型不可用', 'service_tier', 'insufficient_quota', 'rate_limit'];
  MAX_CONCURRENT_DEFAULT = cfg.render.maxConcurrent || 4;
  RETRY_DELAY_MS = cfg.render.retryDelayMs || 2000;
  QUOTA_RETRY_DELAYS = cfg.render.quotaRetryDelays || [5000, 15000, 30000];
  BATCH_COOLDOWN_MS = cfg.render.batchCooldownMs || 3000;
  OUTPUT_ROOT = cfg.render.outputDir || path.join(require('os').homedir(), '.openclaw/workspace/productions');
  PROMPT_MAX_LENGTH = cfg.render.promptMaxLength || 490;  // v7.1-Peng: 同步官方上限 490字
  DEGRADATION_STEPS = cfg.render.degradationSteps || [
    { promptTrim: 0, modelShift: 0 },      // 第1次重试: 不变
    { promptTrim: 100, modelShift: 0 },     // 第2次: 缩短提示词
    { promptTrim: 200, modelShift: 1 },     // 第3次: 缩短+降级模型
    { promptTrim: 300, modelShift: 1 },     // 第4次: 大幅缩短+降级
    { promptTrim: 400, modelShift: 2 }      // 第5次: 极简提示词+保底模型
  ];
}

// 日志工具
function log(scope, message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${scope}]`;
  if (level === 'error') console.error(`${prefix} ❌ ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ⚠️ ${message}`);
  else if (level === 'success') console.log(`${prefix} ✅ ${message}`);
  else if (level === 'progress') console.log(`${prefix} ⏳ ${message}`);
  else if (level === 'phase') console.log(`\n${prefix} 🎬 ${message}\n`);
  else console.log(`${prefix} ℹ️ ${message}`);
}

// 降级策略应用
function applyDegradation(prompt, modelConfig, retryCount) {
  const step = DEGRADATION_STEPS[Math.min(retryCount, DEGRADATION_STEPS.length - 1)];
  if (!step) return { prompt, modelConfig };
  
  let degradedPrompt = prompt;
  let degradedModel = { ...modelConfig };
  
  // 缩短提示词
  if (step.promptTrim > 0 && degradedPrompt.length > step.promptTrim + 10) {
    degradedPrompt = degradedPrompt.substring(0, degradedPrompt.length - step.promptTrim) + '...(精简版)';
    log('RenderEngine', `🔧 降级: prompt缩短${step.promptTrim}字符(${prompt.length}→${degradedPrompt.length})`, 'warn');
  }
  
  // 降级模型
  if (step.modelShift > 0) {
    const currentIdx = MODEL_PRIORITY.findIndex(m => m.id === modelConfig.id);
    const newIdx = currentIdx + step.modelShift;
    if (newIdx < MODEL_PRIORITY.length) {
      degradedModel = MODEL_PRIORITY[newIdx];
      log('RenderEngine', `🔧 降级: 模型 ${modelConfig.name}→${degradedModel.name}`, 'warn');
    }
  }
  
  return { prompt: degradedPrompt, modelConfig: degradedModel };
}

// Prompt长度验证
function validatePromptLength(prompt, maxLength = PROMPT_MAX_LENGTH) {
  const length = prompt?.length || 0;
  const tokens = Math.ceil(length * 1.5); // 粗略估算: 中文1.5x
  if (length > maxLength) {
    log('RenderEngine', `⚠️ Prompt超长(${length}/${maxLength}字符, ~${tokens}tokens)，将截断`, 'warn');
    return {
      valid: false,
      prompt: prompt.substring(0, maxLength - 3) + '...',
      length: maxLength,
      tokens: Math.ceil(maxLength * 1.5)
    };
  }
  if (tokens > maxLength * 1.5) {
    log('RenderEngine', `⚠️ Prompt tokens估算偏高(~${tokens})，可能影响生成质量`, 'warn');
  }
  return { valid: true, prompt, length, tokens };
}

// 判断是否可以用Multi-Shot策略
function canUseMultiShot(shots) {
  const hasDialogue = shots.some(s => s.dialogues && s.dialogues.length > 0);
  const hasSceneChange = shots.some((s, i) => i > 0 && s.act !== shots[i - 1].act);
  const hasComplexMultiChar = shots.some(s => (s.characters || []).length > 3);
  const hasVeryLongShot = shots.some(s => (s.duration || 5) > 12);
  return !hasDialogue && !hasSceneChange && !hasComplexMultiChar && !hasVeryLongShot;
}

// 🔴 v7.2-Peng: 提示词丰满度优化 - 主动填充到 400-490字区间
// 在 shot 元数据中提取未使用的细节，补充到提示词中
function expandPromptToTarget(prompt, shot, plan, targetLength = 480) {
  if (prompt.length >= targetLength) return prompt;
  
  const deficit = targetLength - prompt.length;
  const supplements = [];
  const usedTopics = new Set();
  
  function addSupplement(text, topic) {
    if (!usedTopics.has(topic) && !prompt.includes(text.substring(0, 6))) {
      supplements.push(text);
      usedTopics.add(topic);
    }
  }
  
  // 1. 景别细分补充
  const cameraDesc = shot.camera || '';
  const sizeMap = {
    '特写': '面部特写，皮肤纹理与毛孔可见，头部姿态清晰，面部立体感强，情绪通过身体姿态呈现',
    '近景': '胸像构图，肢体语言完整，肩部以上入画，表情与手势同时被捕捉，人物情绪透过镜头直接传递给观众',
    '中景': '腰部以上，人物与环境比例协调，动作范围完整适合叙事推进，人物与背景的关系清晰交代',
    '全景': '全身入镜，人与场景关系明确，空间定位清晰，肢体语言全貌展现，人物在环境中的位置一目了然',
    '远景': '大全景铺开，环境氛围主导，人物融入景致，格局与气势并存，空间纵深感强烈，视野开阔宏大',
    '航拍': '上帝视角俯瞰，空间纵深感强，地理格局一目了然，宏大叙事感扑面而来，格局感与史诗感兼具'
  };
  const matchedSize = Object.keys(sizeMap).find(sz => cameraDesc.includes(sz));
  if (matchedSize) addSupplement(sizeMap[matchedSize], 'sizeDetail');
  
  // 2. 构图法则补充
  const compositions = [
    '三分法构图，主体位于视觉黄金点，画面平衡自然，视线引导流畅',
    '对称构图，画面庄重稳定，仪式感强烈，视觉平衡感极佳',
    '框架构图，利用前景元素框住主体，引导视线聚焦，层次感丰富',
    '对角线构图，动态线条引导视线流动，画面富有张力与动感',
    '中心构图，主体占据视觉焦点，压迫感与重要性并存，视觉冲击力强烈'
  ];
  addSupplement(compositions[Math.floor(Math.random() * compositions.length)], 'composition');
  
  // 3. 光线细节补充
  const lightings = [
    '侧逆光勾勒轮廓，边缘金色发光分离主体与背景，人物从环境中脱颖而出',
    '顶光投射，面部阴影塑造立体感，鼻梁与眉骨突出，五官轮廓分明',
    '底光反打，营造不安或神秘氛围，人物显得威严或危险，戏剧性极强',
    '窗光入射，自然光影在地面形成图案，尘埃在光束中可见，神圣感弥漫',
    '漫反射柔光，阴影过渡自然无硬边，肤色柔和细腻，女性尤其温润',
    '伦勃朗光，三角形高光落在脸颊，戏剧感强烈，肖像画般的质感',
    '轮廓光从后方打出，人物从背景中剥离，层次分明，立体感强烈'
  ];
  addSupplement(lightings[Math.floor(Math.random() * lightings.length)], 'lighting');
  
  // 4. 色彩基调补充
  const colors = [
    '青橙色调对比，冷暖交织视觉冲击，城市夜景感强烈，现代感扑面而来',
    '暖金基调，夕阳般的怀旧氛围，回忆与温情涌动，时光倒流的感觉',
    '冷蓝主调，疏离感与科技感并存，冷静理性，未来感与孤独感交织',
    '高饱和度糖果色，平面化视觉风格，青春活力，明快愉悦的视觉体验',
    '低饱和度莫兰迪色系，高级灰调性，克制优雅，文艺气质浓厚',
    '黑白高对比，光影成为绝对主角，经典永恒，戏剧性极简美学',
    '赛博朋克紫粉配色，霓虹感与未来感交织，迷幻而前卫',
    '大地色系，自然质朴，回归本真，温暖而厚重的情感基调'
  ];
  addSupplement(colors[Math.floor(Math.random() * colors.length)], 'color');
  
  // 5. 景深与镜头补充
  const depths = [
    '浅景深 f/1.4，背景虚化如奶油般化开，主体突出，焦点锐利',
    '全景深 f/8，前后景皆清晰交代环境，信息量丰富，细节一览无余',
    '长焦 85mm 压缩空间，背景拉近与主体几乎在同一平面，压缩感强烈',
    '广角 24mm 透视夸张，前景放大后景收小，纵深感强，视觉冲击',
    '标准 50mm 接近人眼自然视角，真实亲切无变形，最自然的观感',
    '微距效果，细节放大到极致，纹理清晰可见，微观世界的震撼',
    '鱼眼镜头的桶形畸变，画面边缘弯曲，视觉冲击力，超现实感'
  ];
  addSupplement(depths[Math.floor(Math.random() * depths.length)], 'depth');
  
  // 6. 运镜节奏补充
  const movements = [
    '缓慢推轨靠近，情绪在静默中累积，观众心跳同步，紧张感渐起',
    '手持微晃跟拍，纪录片般的真实质感，临场感强烈，仿佛置身现场',
    '稳定器平滑环绕，360度展现空间关系，全方位审视，空间感完整',
    '急速甩镜切换，视觉冲击力瞬间爆发，节奏突变，肾上腺素飙升',
    '固定机位长镜头，时间感与仪式感，静观其变，沉淀思考的空间',
    '升降镜头从低角度升起，格局逐渐展开，气势提升，视野豁然开朗',
    '急速后拉揭示全景，从局部到整体，豁然开朗，格局瞬间打开'
  ];
  addSupplement(movements[Math.floor(Math.random() * movements.length)], 'movement');
  
  // 7. 环境氛围补充
  const atmospheres = [
    '薄雾弥漫，空气透视增强空间层次，朦胧诗意，如梦似幻',
    '尘埃在光束中飞舞，丁达尔效应明显，神圣感，时间仿佛静止',
    '雨滴在镜头前划过，前景虚化增加临场感，潮湿阴郁，情绪压抑',
    '烟雾缭绕，神秘感与戏剧张力并存，如梦似幻，虚实交错',
    '阳光穿透树叶间隙，光斑在地面跳动，斑驳陆离，生机盎然',
    '雪花缓缓飘落，时间仿佛凝固，宁静唯美，纯净而孤独',
    '风沙漫天，粗犷苍凉，末日感与生存意志，荒野的残酷美学'
  ];
  addSupplement(atmospheres[Math.floor(Math.random() * atmospheres.length)], 'atmosphere');
  
  // 8. 前景/背景层次补充
  const layers = [
    '前景虚化元素增加画面纵深感，层次分明，空间立体感强烈',
    '背景层次丰富，远景虚化处理，空间深度十足，环境信息完整',
    '中景主体清晰，前后景形成夹逼构图，聚焦强烈，视线集中',
    '镜面反射创造双重空间层次，虚实交错，现实与镜像的对话',
    '窗框或门框作为前景框架，画中画效果，窥视感与故事性',
    '地面水洼倒影，上下对称的镜像世界，诗意而神秘'
  ];
  addSupplement(layers[Math.floor(Math.random() * layers.length)], 'layer');
  
  // 9. 情绪节奏补充
  const rhythms = [
    '情绪从压抑逐渐释放，节奏由慢转快，张力递增，观众心跳加速',
    '紧张感层层递进，观众心跳同步加速，屏息凝神，悬念紧绷',
    '宁静中暗流涌动，暴风雨前的平静，蓄势待发，张力暗存',
    '情绪顶点爆发，随后归于余韵，余音绕梁，回味无穷',
    '反复拉扯的纠结感，在摇摆中推进，扣人心弦，欲罢不能',
    '温暖治愈的情绪流淌，如沐春风，心灵慰藉，温柔包裹',
    '孤独感弥漫，空旷空间中个体渺小，existential，哲学思考'
  ];
  addSupplement(rhythms[Math.floor(Math.random() * rhythms.length)], 'rhythm');
  
  // 10. 电影质感补充
  const cinematic = [
    '电影级画质，颗粒感细腻如35mm胶片，质感醇厚，复古而高级',
    'anamorphic镜头轻微桶形畸变和水平眩光，电影感，宽银幕叙事',
    'IMAX画幅的宏大叙事感，视野开阔震撼，身临其境的沉浸',
    '高动态范围，亮部过曝暗部欠曝的戏剧性反差，层次丰富',
    '快门角度 180度，运动模糊自然流畅，动态连贯，视觉舒适',
    'ARRI Alexa摄影机的肤色还原，自然真实，专业级质感',
    '胶片宽容度，高光暗部同时保留细节，层次丰富，过渡自然'
  ];
  addSupplement(cinematic[Math.floor(Math.random() * cinematic.length)], 'cinematic');
  
  // 11. 风格 DNA 维度补充
  if (plan?.styleDNA) {
    const dna = plan.styleDNA;
    const dnaParts = [];
    
    if (dna['VG01光比偏好']) {
      const ratio = dna['VG01光比偏好'].match(/[混合]s*(.+?)s*×/)?.[1] || '8:1';
      dnaParts.push('光比 ' + ratio + '，明暗对比强烈，戏剧性突出，立体感分明');
    }
    if (dna['VG02阴影密度']) {
      const density = dna['VG02阴影密度'].match(/[混合]s*(d+)%/)?.[1] || '85';
      dnaParts.push('阴影密度 ' + density + '%，暗部层次丰富不糊死，细节可见');
    }
    if (dna['VG03色温基调']) {
      const temp = dna['VG03色温基调'].match(/(d+)K/)?.[1] || '5600';
      dnaParts.push('色温 ' + temp + 'K，冷暖情绪明确，色调统一');
    }
    if (dna['VG04饱和度']) {
      const sat = dna['VG04饱和度'].match(/[混合]s*([d.]+)/)?.[1] || '0.9';
      dnaParts.push('饱和度 ' + sat + '，色彩情绪精准，视觉调性统一');
    }
    if (dna['VG05对称率']) {
      const sym = dna['VG05对称率'].match(/[混合]s*(d+)%/)?.[1] || '15';
      dnaParts.push('对称率 ' + sym + '%，构图平衡感恰到好处，视觉稳定');
    }
    if (dna['VG06全景占比']) {
      const wide = dna['VG06全景占比'].match(/[混合]s*(d+)%/)?.[1] || '70';
      dnaParts.push('全景占比 ' + wide + '%，空间开阔感强烈，格局宏大');
    }
    if (dna['NG01幕结构']) {
      dnaParts.push('幕结构节奏精准，叙事推进张弛有度，戏剧结构清晰');
    }
    if (dna['NG02信息揭示']) {
      dnaParts.push('信息揭示策略清晰，悬念与释放交替，观众期待管理精准');
    }
    if (dna['NG04沉默密度']) {
      const silence = dna['NG04沉默密度'].match(/[混合]s*(d+)%/)?.[1] || '15';
      dnaParts.push('沉默密度 ' + silence + '%，留白与信息交替得当，呼吸感');
    }
    if (dna['RG01均镜时长']) {
      const avg = dna['RG01均镜时长'].match(/[混合]s*([d.]+)s/)?.[1] || '4.0';
      dnaParts.push('均镜时长 ' + avg + 's，节奏稳定可控，观众舒适区');
    }
    if (dna['RG02硬切比例']) {
      const hardCut = dna['RG02硬切比例'].match(/[混合]s*(d+)%/)?.[1] || '85';
      dnaParts.push('硬切比例 ' + hardCut + '%，剪辑节奏干脆利落，无拖沓');
    }
    if (dna['RG03跳切密度']) {
      const jumpCut = dna['RG03跳切密度'].match(/[混合]s*(d+)-(d+)/)?.[1] || '8';
      dnaParts.push('跳切密度 ' + jumpCut + '次/分钟，动感与张力并存，节奏鲜活');
    }
    
    if (dnaParts.length > 0) {
      const shuffled = dnaParts.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(3, dnaParts.length));
      for (const part of selected) {
        addSupplement(part, 'dna_' + part.substring(0, 5));
      }
    }
  }
  
  // 12. 镜头情绪张力补充
  if (shot.tension >= 0 || shot.act) {
    const tensionMap = {
      '起': '情绪缓缓铺陈，伏笔暗埋，观众被悄然引入，期待感建立',
      '承': '情绪平稳推进，信息层递叠加，节奏有条不紊，铺垫扎实',
      '转': '情绪暗流涌动，转折一触即发，紧张感攀升，临界点迫近',
      '高潮': '情绪达到顶点，肾上腺素飙升，高潮炸裂，爆发力极强',
      '合': '情绪归于平静，余韵悠长，回味无穷，满足感与释然感'
    };
    const actName = shot.act || '';
    const tensionDesc = tensionMap[actName] || '情绪层次分明，节奏张弛有度，戏剧张力饱满';
    addSupplement(tensionDesc, 'tension');
  }
  
  // 13. 时间/季节补充
  const times = [
    '黄昏黄金时刻，光线温暖柔和，是一天中最美的时段，魔法时刻',
    '深夜月光清冷，蓝色调主导，静谧神秘，孤独感弥漫',
    '黎明破晓前，天际线微光初现，希望萌芽，新的一天开始',
    '正午阳光直射，阴影短促强烈，明晃晃的真实，时间感强烈',
    '深秋落叶满地，金黄与棕红交织，季节感浓厚，收获与离别',
    '初春嫩芽初绽，生机盎然，万物复苏，希望与新生'
  ];
  addSupplement(times[Math.floor(Math.random() * times.length)], 'time');
  
  // 14. 材质/纹理补充
  const textures = [
    '金属表面冷硬反光，工业质感强烈，冷峻而现代',
    '布料柔软褶皱，随风飘动，动态自然，生活气息',
    '木质纹理温暖质朴，岁月痕迹清晰可见，历史感',
    '水面波纹荡漾，倒影破碎又重组，流动的美感',
    '皮肤毛孔与汗珠细节，真实到令人心惊，纪实感',
    '岩石粗糙表面，风化侵蚀的自然雕刻，时间痕迹'
  ];
  addSupplement(textures[Math.floor(Math.random() * textures.length)], 'texture');
  
  // 按 deficit 组装补充内容，不超出目标
  let expanded = prompt;
  for (const sup of supplements) {
    if (expanded.length + sup.length + 1 <= targetLength) {
      expanded += '，' + sup;
    } else if (expanded.length < targetLength) {
      const remaining = targetLength - expanded.length - 1;
      if (remaining > 10) {
        expanded += '，' + sup.substring(0, remaining);
      }
      break;
    } else {
      break;
    }
  }
  
  return expanded;
}
// 生成单镜头提示词
function generateShotPrompt(shot, plan, refs, dialogueEnhancement, isMultiShot = false) {
  const styleManifesto = plan?.styleManifesto || '写实风格';
  const videoType = plan?.videoType || 'action';
  const styleNote = styleManifesto.length > 20 ? styleManifesto.split('，')[0] || styleManifesto.substring(0, 30) : styleManifesto;
  
  // 🔴 v5.1-Peng: 角色视觉签名注入
  let characterVisualNote = '';
  const shotChars = shot.characters || [];
  if (shotChars.length > 0 && plan?.characters) {
    const charDescriptions = [];
    for (const charName of shotChars) {
      const charData = plan.characters.find(c => c.name === charName);
      if (charData) {
        const parts = [];
        if (charData.species) parts.push(charData.species);
        if (charData.features && charData.features.length > 0) parts.push(charData.features.join('，'));
        if (charData.signature) parts.push(charData.signature);
        if (parts.length > 0) {
          charDescriptions.push(`${charName}(${parts.join('，')})`);
        }
      }
    }
    if (charDescriptions.length > 0) {
      characterVisualNote = `角色形象：${charDescriptions.join('；')}`;
    }
  }
  
  let subjectDesc = shot.description || '';
  // v7.2-Peng: 移除100字截断，让描述保持完整，后续由 expandPromptToTarget 控制总长度
  // 如果描述较短（<80字），自动扩充增加细节维度
  if (subjectDesc.length > 0 && subjectDesc.length < 80) {
    const expansions = [
      '，周围环境细节丰富，氛围感强烈',
      '，人物表情细腻，情绪层次递进',
      '，光影变化自然，质感真实',
      '，画面构图精致，视觉焦点突出',
      '，动作流畅自然，节奏感恰到好处',
      '，环境氛围浓厚，沉浸感强',
      '，色彩层次丰富，视觉冲击力',
      '，空间纵深感强，画面立体'
    ];
    const expansion = expansions[Math.floor(Math.random() * expansions.length)];
    if (!subjectDesc.includes(expansion.substring(1, 5))) {
      subjectDesc += expansion;
    }
  }
  
  const cameraDesc = shot.camera || '';
  const shotSize = cameraDesc.match(/(特写|近景|中景|全景|远景|大全景)/)?.[0] || '';
  const cameraMove = cameraDesc.match(/(推|拉|摇|移|跟|升|降|环绕|航拍|手持|固定)/)?.[0] || '';
  const lensNote = [shotSize, cameraMove].filter(Boolean).join('，');
  
  const lighting = plan?.lightingThreeLayer || '自然光';
  const lightingShort = lighting.split('，')[0] || lighting;
  
  let refNote = '';
  if ((refs || []).length > 0) refNote = `参考${refs.length}张角色图片`;
  
  let dialogueNote = '';
  if (dialogueEnhancement) {
    const clean = dialogueEnhancement.startsWith('，') ? dialogueEnhancement.slice(1) : dialogueEnhancement;
    dialogueNote = clean.length > 50 ? clean.substring(0, 50) + '...' : clean;
  }
  
  const parts = [
    characterVisualNote,
    refNote,
    subjectDesc,
    lensNote ? `(${lensNote})` : '',
    dialogueNote ? `对白："${dialogueNote}"` : '',
    `${styleNote}，${lightingShort}光影`
  ].filter(Boolean);
  
  let prompt = parts.join('，').replace(/，{2,}/g, '，');
  
  // v7.2-Peng: 根据单镜头/多镜头调整目标长度
  // 单镜头：目标 480字（充分利用官方 490字上限，留 10字缓冲）
  // 多镜头：每个镜头目标 140字（控制片段总长在 490以内）
  const targetLength = isMultiShot ? 140 : 480;
  prompt = expandPromptToTarget(prompt, shot, plan, targetLength);
  
  // v7.1-Peng: 提示词截断保护（中文≤490字/英文≤980字符）
  if (prompt.length > 490) prompt = prompt.substring(0, 490) + '...';
  
  // 🔴 v5.1-Peng: Token安全验证
  const validation = validatePromptLength(prompt);
  return validation.prompt;
}

// 生成多镜头片段提示词
function generateSegmentPrompt(segment, plan, refsMap, promptEnhancements) {
  const styleManifesto = plan?.styleManifesto || '写实风格';
  const lighting = plan?.lightingThreeLayer || '自然光';
  const styleNote = styleManifesto.length > 20 ? styleManifesto.split('，')[0] || styleManifesto.substring(0, 30) : styleManifesto;
  const lightingShort = lighting.split('，')[0] || lighting;
  
  let prompt = '';
  let currentTime = 0;
  
  for (let i = 0; i < segment.shots.length; i++) {
    const shot = segment.shots[i];
    const start = currentTime;
    const end = currentTime + (shot.duration || 5);
    const isMulti = segment.shots.length > 1;
    const shotPrompt = generateShotPrompt(shot, plan, (refsMap || {})[shot.id] || [], (promptEnhancements || {})[shot.id] || '', isMulti);
    if (i > 0) prompt += '；镜头切换：';
    prompt += `${start}-${end}s：${shotPrompt}`;
    currentTime = end;
  }
  
  prompt += `，${styleNote}，${lightingShort}光影，电影级运镜`;
  // v7.1-Peng: 提示词长度优化（中文≤490字/英文≤980字符，留缓冲）
  if (prompt.length > 490) prompt = prompt.replace(/；镜头切换：/g, '；');
  return prompt;
}

// 🔴 v5.1-Peng: 自动发现角色定妆照（Seedream生成）
// v8.1-Peng: 增加多角色优先级策略 — 主角3张/配角2张/动物1张，最多9张
// v8.1-Peng-fix: 按角色优先级分配配额，超限先截动物/道具，再截配角，保留主角
function discoverCharacterRefs(productionDir, segment, plan = null) {
  const charDir = path.join(productionDir, '03-characters');
  if (!fss.existsSync(charDir)) return [];
  
  const files = fss.readdirSync(charDir);
  const priorityOrder = { '全身': 1, '正面全身': 1, '特写': 2, '面部表情': 2, '动态': 3, '动作姿态': 3 };
  
  // 第一步：为每个角色收集候选图并按视图优先级排序
  const charCandidates = []; // { name, role, refs: [...] }
  
  for (const shot of segment.shots) {
    const shotChars = shot.characters || [];
    for (const charName of shotChars) {
      // 避免同一角色重复处理
      if (charCandidates.find(c => c.name === charName)) continue;
      
      // 查找匹配角色名的图片文件
      const matched = files.filter(f => {
        const base = path.basename(f, path.extname(f));
        return base.includes(charName) && /\.(png|jpg|jpeg|webp)$/i.test(f);
      });
      
      if (matched.length === 0) continue;
      
      // 确定角色优先级
      let maxRefs = 2; // 默认配角级
      let role = 'supporting';
      if (plan?.characters) {
        const charData = plan.characters.find(c => c.name === charName);
        if (charData) {
          role = charData.role || 'supporting';
          if (role === 'protagonist') maxRefs = 3;
          else if (role === 'supporting') maxRefs = 2;
          else if (role === 'animal' || role === 'prop') maxRefs = 1;
        }
      }
      
      // 按视图优先级排序
      const sorted = matched.sort((a, b) => {
        const pa = Object.entries(priorityOrder).find(([k]) => a.includes(k))?.[1] || 99;
        const pb = Object.entries(priorityOrder).find(([k]) => b.includes(k))?.[1] || 99;
        return pa - pb;
      });
      
      const refs = sorted.slice(0, maxRefs).map(f => path.join(charDir, f));
      charCandidates.push({ name: charName, role, refs, maxRefs });
    }
  }
  
  if (charCandidates.length === 0) return [];
  
  // 第二步：按角色重要性排序（主角 > 配角 > 动物/道具）
  const rolePriority = { 'protagonist': 1, 'supporting': 2, 'animal': 3, 'prop': 3 };
  charCandidates.sort((a, b) => (rolePriority[a.role] || 2) - (rolePriority[b.role] || 2));
  
  // 第三步：按优先级累加，直到达到9张上限
  const finalRefs = [];
  let remainingQuota = 9;
  
  for (const candidate of charCandidates) {
    const take = Math.min(candidate.refs.length, remainingQuota);
    for (let i = 0; i < take; i++) {
      const ref = candidate.refs[i];
      if (!finalRefs.includes(ref)) finalRefs.push(ref);
    }
    remainingQuota -= take;
    
    if (remainingQuota <= 0) {
      const dropped = charCandidates.slice(charCandidates.indexOf(candidate) + 1);
      if (dropped.length > 0) {
        const droppedNames = dropped.map(c => `${c.name}(${c.role})`).join(', ');
        log('RenderEngine', `⚠️ 角色参考图超过 9 张，已截断: ${droppedNames} 被降级`, 'warn');
      }
      break;
    }
  }
  
  return finalRefs;
}

// ============ 主渲染函数 ============
// v9.0-Peng: 重写为 Shot 级独立渲染 — 每个镜头独立 API 调用
// 变更点：
//   - 输入从 segmentsData 改为 shotsData
//   - 每个 shot 独立生成提示词、独立调用 API
//   - 首尾帧衔接粒度从 segment 降到 shot
//   - 超长 shot 自动拆分（API 上限 10s）
//   - 默认串行（质量优先），提供 --fast 并行选项
async function render(shotsData, options = {}) {
  // v9.0-Peng: 确保配置已初始化
  if (!CONFIG) initConfig();
  const {
    productionDir,
    skipRender = false,
    seed = Math.floor(Math.random() * 2147483647),
    maxConcurrent = 1,                    // v9.0: 默认串行（质量优先）
    generateAudio = true,
    enableFrameContinuity = true,         // v9.0: 默认启用首尾帧衔接
    plan = null,
    fast = false,                          // v9.0: --fast 并行模式
    // P2-4.2: 预算硬锁参数
    budgetLimitUSD = Infinity,
    budgetUsedUSD = 0,
    budgetCallback = null                   // 预算更新回调
  } = options;

  // P2-4.2: 预算硬锁 — 已耗尽时拒绝新渲染
  if (budgetUsedUSD >= budgetLimitUSD) {
    log('RenderEngine', `💰 预算已耗尽 (${budgetUsedUSD}/${budgetLimitUSD} USD)，拒绝新渲染请求`, 'error');
    return expandedShots.map(item => ({
      shot: item.shot,
      status: 'budget_exhausted',
      error: `Budget exceeded: ${budgetUsedUSD} >= ${budgetLimitUSD} USD`,
      budgetUsed: budgetUsedUSD,
      budgetLimit: budgetLimitUSD
    }));
  }

  const rawDir = path.join(productionDir, '05-raw-shots');
  ensureDir(rawDir);

  // v9.0-Peng: 超长 shot 自动拆分
  const expandedShots = expandLongShots(shotsData, productionDir, plan);
  log('RenderEngine', `🎬 开始 Shot 级渲染: ${shotsData.length}个镜头 → 展开为 ${expandedShots.length}个渲染单元`, 'phase');
  log('RenderEngine', `🎲 统一风格种子: ${seed}`, 'info');

  if (fast) {
    log('RenderEngine', `⚡ 快速模式: 并行渲染（禁用首尾帧衔接）`, 'warn');
  } else if (enableFrameContinuity) {
    log('RenderEngine', `🔗 首尾帧衔接模式: 启用（串行处理，shot 级尾帧接力）`, 'info');
  }

  if (!fss.existsSync(SEEDANCE_WRAPPER)) {
    throw new Error(`seedance-wrapper.js 未找到: ${SEEDANCE_WRAPPER}`);
  }

  if (skipRender) {
    log('RenderEngine', '⚠️ 跳过渲染模式，只生成命令', 'warn');
  }

  const tasks = [];
  let previousLastFrame = null;

  // v9.0-Peng: 快速模式并行，否则串行
  const effectiveMaxConcurrent = fast ? (options.maxConcurrent || MAX_CONCURRENT_DEFAULT) : 1;

  for (let i = 0; i < expandedShots.length; i += effectiveMaxConcurrent) {
    const batch = expandedShots.slice(i, i + effectiveMaxConcurrent);

    if (effectiveMaxConcurrent === 1) {
      log('RenderEngine', `⏳ Shot ${i+1}/${expandedShots.length}（串行，首尾帧衔接）`, 'progress');
    } else {
      log('RenderEngine', `⏳ 批次 ${Math.floor(i/effectiveMaxConcurrent)+1}/${Math.ceil(expandedShots.length/effectiveMaxConcurrent)}（并行×${effectiveMaxConcurrent}）`, 'progress');
    }

    const batchPromises = batch.map(async ({ shot, prompt, refs, isSplit, originalShot }) => {
      let lastError = null;

      // v9.0-Peng: 组装参考图（角色定妆照 + 前一 shot 尾帧）
      let shotRefs = [...(refs || [])];
      if (!fast && previousLastFrame && fss.existsSync(previousLastFrame)) {
        if (!shotRefs.includes(previousLastFrame)) {
          shotRefs.unshift(previousLastFrame);
          log('RenderEngine', `🔗 ${shot.id} 注入前一镜头尾帧作为首帧`, 'info');
        }
      }

      // v9.0-Peng: 为超长 shot 的后续 chunk 调整提示词
      let finalPrompt = prompt;
      if (isSplit && shot.chunkIndex > 0) {
        finalPrompt = `${prompt}（动作延续，承接上一段）`;
      }

      for (let modelIdx = 0; modelIdx < MODEL_PRIORITY.length; modelIdx++) {
        const modelConfig = MODEL_PRIORITY[modelIdx];
        const is2Point0 = modelConfig.id.includes('doubao-seedance-2-0');

        // 构建 API 命令
        const cmdParts = [
          'node', SEEDANCE_WRAPPER, 'create',
          '--prompt', shellQuote((finalPrompt || '').replace(/"/g, '\\"')),
          '--model', shellQuote(modelConfig.id),
          '--seed', String(seed),
          '--ratio', shellQuote('16:9'),
          '--duration', String(shot.duration || 5)
        ];

        // 注入参考图
        const finalRefs = shotRefs.slice(0, 9);
        if (finalRefs.length > 0) {
          for (const refPath of finalRefs) {
            if (fss.existsSync(refPath)) {
              cmdParts.push('--image-file', shellQuote(refPath));
            }
          }
          log('RenderEngine', `🖼️ ${shot.id} 注入 ${Math.min(finalRefs.length, 9)} 张参考图`, 'info');
        }

        // 请求尾帧（shot 级衔接）
        if (enableFrameContinuity && !fast) {
          cmdParts.push('--return-last-frame');
        }

        if (!is2Point0) cmdParts.push('--service-tier', shellQuote('flex'));

        // 运镜控制
        if (/(推|拉|摇|移|跟|升|降|环绕|航拍|变焦|甩镜)/.test(shot.camera || '')) {
          cmdParts.push('--camera-fixed', shellQuote('false'));
        }

        // 音频生成
        if (generateAudio) {
          cmdParts.push('--generate-audio');
        }

        const cmd = cmdParts.join(' ');

        if (skipRender) {
          const cmdFile = path.join(rawDir, `${shot.id}-command.sh`);
          fss.writeFileSync(cmdFile, `#!/bin/bash\n${cmd}\n`);
          log('RenderEngine', `📝 ${shot.id} 命令已保存`, 'info');
          return { shot, taskId: `DRY-RUN-${shot.id}`, status: 'dry-run', prompt: finalPrompt, cmd };
        }

        // P1-4.2: 渲染缓存检查
        const cacheKey = generateCacheKey(finalPrompt, modelConfig.id, seed, shot.duration || 5, '16:9');
        const cacheResult = await checkCache(cacheKey);
        if (cacheResult.hit) {
          log('RenderEngine', `💾 ${shot.id} 缓存命中 (${cacheResult.source})，跳过渲染`, 'success');
          const cachedVideoPath = cacheResult.videoPath;
          if (fss.existsSync(cachedVideoPath)) {
            const targetPath = path.join(rawDir, `${shot.id}-cached.mp4`);
            fss.copyFileSync(cachedVideoPath, targetPath);
            results.push({ shot, taskId: `CACHE-${cacheKey}`, videoPath: targetPath, status: 'cached', prompt: finalPrompt, cacheHit: true });
            continue;
          }
        }

        try {
          let currentPrompt = finalPrompt;
          let currentModel = modelConfig;

          const retryCount = shot._429RetryCount || 0;
          if (retryCount > 0) {
            const degraded = applyDegradation(currentPrompt, currentModel, retryCount - 1);
            currentPrompt = degraded.prompt;
            currentModel = degraded.modelConfig;
          }

          log('RenderEngine', `⏳ ${shot.id} 尝试 ${currentModel.name}...`, 'progress');
          const output = await execAsync(cmd, { encoding: 'utf8', timeout: 30000 });
          const match = output.match(/任务 ID:\s*(cgt-[a-z0-9-]+)/i);
          const taskId = match ? match[1] : null;

          if (taskId) {
            log('RenderEngine', `✅ ${shot.id} 已提交 (${taskId})`, 'success');

            // v9.0-Peng: shot 级尾帧轮询
            let lastFramePath = null;
            if (enableFrameContinuity && !fast) {
              log('RenderEngine', `⏳ ${shot.id} 轮询等待完成获取尾帧...`, 'progress');
              const pollResult = await pollTaskForLastFrame(taskId, { timeoutMs: 20 * 60 * 1000 });
              if (pollResult.success && pollResult.lastFrameUrl) {
                lastFramePath = await downloadLastFrame(pollResult.lastFrameUrl, shot.id, rawDir);
              } else {
                log('RenderEngine', `⚠️ ${shot.id} 未获取到尾帧: ${pollResult.error || 'unknown'}`, 'warn');
              }
            }

            return { shot, taskId, status: 'submitted', prompt: currentPrompt, model: currentModel.name, lastFramePath };
          }
          throw new Error('未能提取任务ID');
        } catch (e) {
          lastError = e;
          const errorMsg = e.message || '';

          const shouldRetry = FALLBACK_ERRORS.some(err => errorMsg.includes(err));
          if (shouldRetry && modelIdx < MODEL_PRIORITY.length - 1) {
            log('RenderEngine', `⚠️ ${shot.id} ${modelConfig.name} 失败，降级到下一模型...`, 'warn');
            if (errorMsg.includes('429') || errorMsg.includes('rate_limit') || errorMsg.includes('insufficient_quota')) {
              shot._429RetryCount = (shot._429RetryCount || 0) + 1;
            }
            continue;
          }

          log('RenderEngine', `❌ ${shot.id} 所有模型均失败: ${errorMsg}`, 'error');
          return { shot, error: errorMsg, status: 'failed', prompt: finalPrompt };
        }
      }

      return { shot, error: lastError?.message || '未知错误', status: 'failed', prompt: finalPrompt };
    });

    const batchResults = await Promise.all(batchPromises);
    tasks.push(...batchResults);

    // v9.0-Peng: 串行模式下更新 previousLastFrame（最后一个完成的 shot）
    if (!fast && enableFrameContinuity && batchResults.length > 0) {
      const lastResult = batchResults[batchResults.length - 1];
      if (lastResult.lastFramePath && fss.existsSync(lastResult.lastFramePath)) {
        previousLastFrame = lastResult.lastFramePath;
        log('RenderEngine', `🔗 尾帧接力: ${lastResult.shot.id} → 下一镜头`, 'info');
      }
    } else if (fast && i + effectiveMaxConcurrent < expandedShots.length) {
      // 快速模式批次冷却
      log('RenderEngine', `⏱️ 批次冷却 ${BATCH_COOLDOWN_MS}ms...`, 'info');
      await new Promise(r => setTimeout(r, BATCH_COOLDOWN_MS));
    }
  }

  return tasks;
}

// v9.0-Peng: 超长 Shot 自动拆分（API 上限 10s）
// 策略：greedy 拆分，每段尽可能取 maxDuration，最后一段取剩余
function expandLongShots(shotsData, productionDir, plan) {
  const MAX_DURATION = 10;
  const expanded = [];

  for (const item of shotsData) {
    const { shot, prompt, refs } = item;
    const duration = shot.duration || 5;

    if (duration <= MAX_DURATION) {
      expanded.push({ shot, prompt, refs, isSplit: false });
      continue;
    }

    // Greedy 拆分：每段尽可能取 MAX_DURATION
    let remaining = duration;
    let chunkIdx = 0;

    log('RenderEngine', `⚠️ ${shot.id} 时长 ${duration}s 超过 API 上限 ${MAX_DURATION}s，开始拆分`, 'warn');

    while (remaining > 0) {
      const chunkDuration = Math.min(remaining, MAX_DURATION);
      const subShot = {
        ...shot,
        id: `${shot.id}-${String.fromCharCode(65 + chunkIdx)}`,  // S03 → S03-A, S03-B
        duration: chunkDuration,
        originalShot: shot.id,
        chunkIndex: chunkIdx,
        totalChunks: Math.ceil(duration / MAX_DURATION)
      };

      // 后续 chunk 提示词注入动作延续
      const adjustedPrompt = chunkIdx === 0
        ? prompt
        : `${prompt}（动作延续，承接上一段，保持画面连贯）`;

      expanded.push({
        shot: subShot,
        prompt: adjustedPrompt,
        refs,
        isSplit: true,
        originalShot: shot.id
      });

      remaining -= chunkDuration;
      chunkIdx++;
    }
  }

  return expanded;
}

// v8.1-Peng: 轮询任务获取尾帧URL（保持兼容）
async function pollTaskForLastFrame(taskId, options = {}) {
  const timeoutMs = options.timeoutMs || 20 * 60 * 1000; // 20分钟
  const intervalMs = options.intervalMs || 5000; // 5秒轮询
  const startedAt = Date.now();
  const SEEDANCE_SCRIPT = path.join(__dirname, '..', '..', 'byted-ark-seedance-skill', 'scripts', 'seedance.js');
  
  while (true) {
    try {
      const output = await execAsync(
        `node "${SEEDANCE_SCRIPT}" get --task-id "${taskId}"`,
        { encoding: 'utf8', timeout: 30000 }
      );
      const task = JSON.parse(output);
      const status = String(task.status || '').toLowerCase();
      
      if (status === 'succeeded') {
        const lastFrameUrl = task.content?.last_frame_url || task.content?.video_url;
        return { success: true, lastFrameUrl, videoUrl: task.content?.video_url };
      }
      if (status === 'failed' || status === 'expired' || status === 'cancelled') {
        return { success: false, error: task.error?.message || `Task ${status}` };
      }
    } catch (e) {
      // 轮询出错继续
    }
    
    if (Date.now() - startedAt > timeoutMs) {
      return { success: false, error: 'Polling timeout' };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// v8.1-Peng: 下载尾帧图片到临时目录
async function downloadLastFrame(lastFrameUrl, segmentId, rawDir) {
  if (!lastFrameUrl) return null;
  try {
    const https = require('https');
    const tmpPath = path.join(rawDir, `${segmentId}_last_frame.png`);
    
    await new Promise((resolve, reject) => {
      const file = fss.createWriteStream(tmpPath);
      https.get(lastFrameUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    });
    
    log('RenderEngine', `📸 ${segmentId} 尾帧已下载: ${tmpPath}`, 'info');
    return tmpPath;
  } catch (e) {
    log('RenderEngine', `⚠️ 尾帧下载失败: ${e.message}`, 'warn');
    return null;
  }
}
function ensureDir(dir) {
  if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
}

// ============ CLI 入口 ============
// v9.0-Peng: 支持 Shot 级渲染（向后兼容 Segment 级）
const SEEDANCE_WRAPPER = path.join(__dirname, '..', '..', 'byted-ark-seedance-skill', 'scripts', 'seedance-wrapper.js');

async function main() {
  initConfig();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'render') {
    const productionDir = args.find(a => a.startsWith('--production-dir='))?.split('=')[1];
    const shotsFile = args.find(a => a.startsWith('--shots='))?.split('=')[1];
    const segmentsFile = args.find(a => a.startsWith('--segments='))?.split('=')[1];
    const skipRender = args.includes('--dry-run');
    const fast = args.includes('--fast');
    const planFile = args.find(a => a.startsWith('--plan='))?.split('=')[1];

    if (!productionDir) {
      console.error('用法: node seedance-render-engine.js render --production-dir=DIR [--shots=FILE | --segments=FILE] [--dry-run] [--fast] [--plan=FILE]');
      process.exit(1);
    }

    let plan = null;
    if (planFile) {
      try {
        plan = JSON.parse(fss.readFileSync(planFile, 'utf8'));
      } catch (err) {
        console.error(`❌ 计划文件解析失败: ${planFile} — ${err.message}`);
        process.exit(1);
      }
    }

    let shotsData;

    // v9.0-Peng: 优先读取 shots 文件（shot 级）
    if (shotsFile) {
      try {
        shotsData = JSON.parse(fss.readFileSync(shotsFile, 'utf8'));
      } catch (err) {
        console.error(`❌ Shots文件解析失败: ${shotsFile} — ${err.message}`);
        process.exit(1);
      }
      log('RenderEngine', `📂 Shot 级渲染: ${shotsData.length}个镜头`, 'info');
    }
    // 向后兼容：读取 segments 文件（segment 级，自动转换）
    else if (segmentsFile) {
      let segmentsData;
      try {
        segmentsData = JSON.parse(fss.readFileSync(segmentsFile, 'utf8'));
      } catch (err) {
        console.error(`❌ Segments文件解析失败: ${segmentsFile} — ${err.message}`);
        process.exit(1);
      }
      log('RenderEngine', `📂 Segment 级输入（自动转换为 Shot 级）: ${segmentsData.length}个片段`, 'info');

      // 自动转换 segment → shots
      shotsData = [];
      for (const { segment, prompt, refs } of segmentsData) {
        for (const shot of segment.shots || []) {
          shotsData.push({
            shot,
            prompt: generateShotPrompt(shot, plan, refs, '', false),  // 单镜头提示词
            refs: discoverCharacterRefs(productionDir, { shots: [shot] }, plan)
          });
        }
      }
    }
    // 默认读取 story-plan.json
    else {
      const storyPlanPath = path.join(productionDir, '01-story-plan.json');
      if (!fss.existsSync(storyPlanPath)) {
        console.error(`❌ 未找到 story-plan.json: ${storyPlanPath}`);
        process.exit(1);
      }
      try {
        plan = JSON.parse(fss.readFileSync(storyPlanPath, 'utf8'));
      } catch (err) {
        console.error(`❌ story-plan.json解析失败: ${storyPlanPath} — ${err.message}`);
        process.exit(1);
      }
      log('RenderEngine', `📂 从 story-plan.json 提取: ${plan.shots?.length || 0}个镜头`, 'info');

      shotsData = (plan.shots || []).map(shot => ({
        shot,
        prompt: generateShotPrompt(shot, plan, discoverCharacterRefs(productionDir, { shots: [shot] }, plan), '', false),
        refs: discoverCharacterRefs(productionDir, { shots: [shot] }, plan)
      }));
    }

    const results = await render(shotsData, { productionDir, skipRender, fast, plan });

    // 保存结果
    const resultFile = path.join(productionDir, '04-prompts', '04-render-results.json');
    ensureDir(path.dirname(resultFile));
    fss.writeFileSync(resultFile, JSON.stringify(results, null, 2));

    log('RenderEngine', `🎬 渲染完成: ${results.length}个渲染单元`, 'phase');
    const success = results.filter(r => r.status === 'submitted').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const split = results.filter(r => r.shot?.originalShot).length;
    log('RenderEngine', `✅ 成功: ${success} | ❌ 失败: ${failed} | 🔀 自动拆分: ${split}`, 'info');
  } else {
    console.log('Seedance Render Engine v9.0-Peng');
    console.log('用法:');
    console.log('  Shot 级: render --production-dir=DIR --shots=FILE [--dry-run] [--fast] [--plan=FILE]');
    console.log('  Segment 级(兼容): render --production-dir=DIR --segments=FILE [--dry-run] [--fast]');
    console.log('  自动提取: render --production-dir=DIR [--dry-run] [--fast] [--plan=FILE]');
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error('致命错误:', e);
    process.exit(1);
  });
}

module.exports = { render, generateShotPrompt, generateSegmentPrompt, validatePromptLength, canUseMultiShot, applyDegradation, expandPromptToTarget, expandLongShots, discoverCharacterRefs };
