const path = require('path');
const fs = require('fs');

// 技能库根目录（可根据实际项目调整）
const SKILL_LIB_ROOT = path.join(__dirname, '..', '..', 'skills', '好莱坞工业电影技能工厂', '技能系列', '镜头级专项');

// 检查技能库是否存在（开源版本：技能文件可选）
const SKILL_LIB_AVAILABLE = fs.existsSync(SKILL_LIB_ROOT);

if (!SKILL_LIB_AVAILABLE) {
  console.log('[SkillRouter] 技能库未配置，运行在无技能增强模式（可通过添加技能文件到 skills/好莱坞工业电影技能工厂/技能系列/镜头级专项/ 启用）');
}

// ============================================================
// 技能索引构建
// ============================================================

let _skillIndex = null;
let _skillIndexBuildTime = 0;

function parseSkillFilename(filename) {
  const name = filename.replace('.md', '');
  const parts = name.split('_');
  
  const TYPE_MAP = {
    '剧情': 'drama', '动作': 'action', '喜剧': 'comedy', '恐怖': 'horror',
    '悬疑': 'suspense', '惊悚': 'thriller', '战争': 'war', '科幻': 'sci-fi',
    '孤独': 'loneliness', '微表情': 'micro-expression'
  };
  
  const DIRECTOR_MAP = {
    '维伦纽瓦': 'villeneuve', '诺兰': 'nolan', '卡梅隆': 'cameron',
    '卢卡斯': 'lucas', '库布里克': 'kubrick', '斯皮尔伯格': 'spielberg',
    '斯科塞斯': 'scorsese', '昆汀': 'tarantino', '达米恩': 'chazelle',
    '韦斯安德森': 'anderson', '索金': 'sorkin', '博伊尔': 'boyle',
    '大卫林奇': 'lynch', '芬奇': 'fincher', '希区柯克': 'hitchcock',
    '卡萨维茨': 'cassavetes', '德尼罗': 'deniro', '曼': 'mann',
    '斯派克琼斯': 'spike-jonze', '黑泽明': 'kurosawa', '奥卡萨姆': 'aucon'
  };
  
  const EMOTION_MAP = {
    '史诗': 'epic', '孤独': 'lonely', '情感': 'emotional',
    '紧张': 'tense', '浪漫': 'romantic', '告别': 'farewell',
    '救赎': 'redemption', '温情': 'tender', '雨夜': 'rainy-night',
    '舞蹈': 'dance', '神秘': 'mysterious', '悬疑': 'suspenseful',
    '荒诞': 'absurd', '压迫': 'oppressive', '紧张追逐': 'chase-tense',
    '史诗航拍': 'epic-aerial', '史诗手持': 'epic-handheld',
    '史诗斯坦尼康': 'epic-steadicam', '史诗定场': 'epic-establishing',
    '紧张斯坦尼康': 'tense-steadicam', '紧张手持': 'tense-handheld',
    '浪漫斯坦尼康': 'romantic-steadicam', '浪漫手持': 'romantic-handheld',
    '舞蹈斯坦尼康': 'dance-steadicam', '舞蹈手持': 'dance-handheld',
    '恐怖斯坦尼康': 'horror-steadicam', '悬疑手持': 'suspense-handheld',
    '悬疑斯坦尼康': 'suspense-steadicam', '史诗手持': 'epic-handheld',
    '紧张定场': 'tense-establishing',
    '粗粝真实': 'raw-real', '压抑喜悦': 'suppressed-joy',
    '压抑悲伤': 'suppressed-sadness', '厌恶': 'disgust', '嫌弃': 'scorn',
    '复杂情绪': 'complex', '复古优雅': 'vintage-elegant',
    '无人回应': 'no-response', '灵魂独行': 'soul-alone',
    '喜悦': 'joy', '方法演技': 'method-acting', '恍惚': 'trance',
    '恐惧': 'fear', '惊恐': 'panic', '恐惧颤抖': 'fear-shake',
    '哀伤': 'grief', '惊讶凝固': 'frozen-shock', '震惊': 'shocked',
    '愤怒克制': 'anger-suppressed', '暴烈': 'violent',
    '战栗': 'shiver', '神经质幽默': 'neurotic-humor',
    '热情外放': 'outgoing', '紧张内敛': 'tense-reserved',
    '破碎': 'broken', '心碎时刻': 'heartbreak', '空洞': 'hollow',
    '灵魂出窍': 'out-of-body', '窒息': 'suffocating',
    '话唠爆发': 'talking-burst', '冷峻逼近': 'cold-approach',
    '蔑视': 'contempt', '冷嘲': 'sarcasm', '迷醉': 'intoxicated',
    '超然状态': 'trance-state', '瞬间启示': 'flash-enlightenment',
    '无尽雨幕': 'endless-rain', '东方克制': 'oriental-restraint',
    '热闹中的寂静': 'quiet-in-chaos', '镜子里的陌生人': 'stranger-in-mirror',
    '午夜独醒': 'midnight-awake'
  };
  
  const type = parts[0] || '';
  const director = parts[1] || '';
  const rest = parts.slice(2);
  
  let tech = '';
  let shotType = '';
  let emotion = '';
  
  const SHOT_IN_EMOTION = ['航拍', '斯坦尼康', '手持', '定场'];
  const TECH_TAGS_SET = new Set(['IMAX', 'VR', '3D']);
  
  for (const r of rest) {
    if (TECH_TAGS_SET.has(r)) { tech = r; continue; }
    let matched = false;
    for (const st of SHOT_IN_EMOTION) {
      if (r.includes(st) || st.includes(r)) {
        shotType = st;
        const remaining = r.replace(st, '');
        if (remaining) emotion = emotion ? emotion + '_' + remaining : remaining;
        matched = true;
        break;
      }
    }
    if (!matched) {
      emotion = emotion ? emotion + '_' + r : r;
    }
  }
  
  return {
    filename,
    type: TYPE_MAP[type] || type,
    type_zh: type,
    director: DIRECTOR_MAP[director] || director,
    director_zh: director,
    emotion: EMOTION_MAP[emotion] || emotion,
    emotion_zh: emotion,
    shotType,
    tech
  };
}

function buildSkillIndex() {
  if (_skillIndex && Date.now() - _skillIndexBuildTime < 60_000) {
    return _skillIndex;
  }
  
  if (!fs.existsSync(SKILL_LIB_ROOT)) {
    console.warn(`[SkillRouter] 技能库目录不存在: ${SKILL_LIB_ROOT}`);
    return {};
  }
  
  const files = fs.readdirSync(SKILL_LIB_ROOT).filter(f => f.endsWith('.md'));
  const index = {};
  
  for (const file of files) {
    const meta = parseSkillFilename(file);
    
    const key1 = `${meta.type}_${meta.director}`;
    const key2 = `${meta.type}_${meta.emotion}`;
    const key3 = `${meta.type}_${meta.shotType}`;
    const key4 = `${meta.director}_${meta.emotion}`;
    const key5 = `${meta.type}_${meta.director}_${meta.shotType}`;
    const key6 = `${meta.type}_${meta.director}_${meta.emotion}`;
    
    [key1, key2, key3, key4, key5, key6].forEach(k => {
      if (!index[k]) index[k] = [];
      index[k].push({ file, meta });
    });
  }
  
  _skillIndex = index;
  _skillIndexBuildTime = Date.now();
  return index;
}

// ============================================================
// 技能内容解析
// ============================================================

function extractSection(content, startMarker, endMarker) {
  const lines = content.split('\n');
  let inSection = false;
  let sectionLines = [];
  
  for (const line of lines) {
    if (line.includes(startMarker)) { inSection = true; continue; }
    if (inSection && (line.includes(endMarker) || line.match(/^#{1,3} /))) {
      if (line.includes(endMarker)) continue;
      break;
    }
    if (inSection) sectionLines.push(line);
  }
  
  return sectionLines.join('\n').trim();
}

function extractSkillEnhancement(skillPath) {
  try {
    const content = fs.readFileSync(skillPath, 'utf-8');
    
    return {
      promptBlock: extractSection(content, 'AI提示词构建', '第五部分'),
      forbiddenBlock: extractSection(content, '禁止词清单', '禁止词'),
      shotBlock: extractSection(content, '镜头类型', '镜头设计'),
      emotionBlock: extractSection(content, '情绪设计', '第四部分'),
      raw: content
    };
  } catch (e) {
    return null;
  }
}

// ============================================================
// 镜头元数据提取
// ============================================================

function extractShotMetadata(shot) {
  const meta = {
    type: 'drama',
    director: '',
    emotion: '',
    shotType: '',
    lighting: '',
    hasAerial: false,
    hasRain: false,
    hasNight: false,
    isEpic: false,
    isLonely: false,
    isDance: false
  };
  
  const desc = (shot.description || shot.scene || shot.sceneDesc || shot.prompt || '').toLowerCase(); // 【fix-1A1】scene 入扫描
  // 【v2.1.4-fix9-P8】安全获取camera字符串：强制转换为字符串
  const cameraStr = String(shot.cameraString || '');
  const cameraMovementStr = String(shot.cameraMovement || '');
  const cameraObjStr = (typeof shot.camera === 'string' ? shot.camera : '');
  const camera = (cameraStr || cameraMovementStr || cameraObjStr).toLowerCase();
  const MOOD_SYNONYM_MAP = { 'sadness':'grief','sad':'grief','grief':'grief','heartbroken':'heartbreak','amazed':'joy','amazing':'joy','awe':'epic','serene':'oriental-restraint','calm':'oriental-restraint','quiet':'oriental-restraint','tender':'tender','tense':'tense','warm':'tender','nostalgic':'farewell','melancholy':'grief','lonely':'lonely' }; // 【fix-1A2】
  const rawMood = String(shot.mood || shot.emotion || (shot.emotional_target && shot.emotional_target.emotion) || '').toLowerCase().trim();
  const mood = (MOOD_SYNONYM_MAP[rawMood] || rawMood);
  // 【v2.1.4-patch2】兼容lighting对象/字符串两种格式
  const lighting = (shot.lightingString || (typeof shot.lighting === 'string' ? shot.lighting : '') || '').toLowerCase();
  
  // 检测影片类型
  if (/科幻|alien|space|planet|starship|robot/i.test(desc)) meta.type = 'sci-fi';
  else if (/战争|battle|army|soldier|war/i.test(desc)) meta.type = 'war';
  else if (/恐怖|horror|fear|monster/i.test(desc)) meta.type = 'horror';
  else if (/喜剧|comedy|funny|laugh/i.test(desc)) meta.type = 'comedy';
  else if (/悬疑|suspense|mystery/i.test(desc)) meta.type = 'suspense';
  else if (/惊悚|thriller/i.test(desc)) meta.type = 'thriller';
  
  // 检测镜头类型
  if (/航拍|aerial|helicopter|drone/i.test(camera + desc)) meta.shotType = 'aerial';
  else if (/斯坦尼康|steadicam/i.test(camera)) meta.shotType = 'steadicam';
  else if (/手持|handheld/i.test(camera)) meta.shotType = 'handheld';
  else if (/定场|establishing/i.test(camera + desc)) meta.shotType = 'establishing';
  if (/IMAX|imax/i.test(camera + desc + lighting)) meta.tech = 'IMAX';
  
  // 检测情绪（归一后的 mood 优先）【fix-1A3】
  if (mood && MOOD_SYNONYM_MAP[rawMood]) { meta.emotion = mood; }
  else if (/哀伤|悲恸|悲伤|心碎|grief/i.test(mood + desc)) meta.emotion = 'grief';
  else if (/克制|静谧|安静|restraint/i.test(mood + desc)) meta.emotion = 'oriental-restraint';
  else if (/史诗|epic|grand/i.test(mood + desc)) { meta.emotion = 'epic'; meta.isEpic = true; }
  else if (/舞蹈|dance|dancing/i.test(desc + camera)) { meta.emotion = 'dance'; meta.isDance = true; }
  else if (/无人回应|no.response/i.test(mood + desc)) meta.emotion = 'lonely';
  else if (/灵魂独行|soul.alone/i.test(mood + desc)) { meta.emotion = 'lonely'; meta.isLonely = true; }
  else if (/孤独|lonely|solitude|alone/i.test(mood + desc)) { meta.emotion = 'lonely'; meta.isLonely = true; }
  else if (/紧张追逐|tense.chase/i.test(mood + desc)) meta.emotion = 'tense';
  else if (/紧张|tense|nervous/i.test(mood + desc)) meta.emotion = 'tense';
  else if (/浪漫|romantic|love/i.test(mood + desc)) meta.emotion = 'romantic';
  else if (/告别|farewell|depart/i.test(mood + desc)) meta.emotion = 'farewell';
  else if (/救赎|redemption/i.test(mood + desc)) meta.emotion = 'redemption';
  else if (/温情|tender|warm/i.test(mood + desc)) meta.emotion = 'tender';
  else if (/神秘|mysterious|mystery/i.test(mood + desc)) meta.emotion = 'mysterious';
  else if (/情感|emotional|feelings/i.test(mood + desc)) meta.emotion = 'emotional';
  
  // 检测导演风格
  if (/维伦纽瓦|villeneuve|dune|arrival/i.test(desc)) meta.director = 'villeneuve';
  else if (/诺兰|nolan|inception|batman/i.test(desc)) meta.director = 'nolan';
  else if (/卡梅隆|cameron|avatar|terminator/i.test(desc)) meta.director = 'cameron';
  else if (/库布里克|kubrick|2001|shining/i.test(desc)) meta.director = 'kubrick';
  else if (/斯科塞斯|scorsese|departed/i.test(desc)) meta.director = 'scorsese';
  else if (/斯皮尔伯格|spielberg|jaws|et/i.test(desc)) meta.director = 'spielberg';
  else if (/昆汀|tarantino|pulp/i.test(desc)) meta.director = 'tarantino';
  else if (/韦斯安德森|anderson|budapest/i.test(desc)) meta.director = 'anderson';
  else if (/芬奇|fincher|social|dragon/i.test(desc)) meta.director = 'fincher';
  else if (/希区柯克|hitchcock|psycho/i.test(desc)) meta.director = 'hitchcock';
  else if (/达米恩|chazelle|lalaland/i.test(desc)) meta.director = 'chazelle';
  else if (/卢卡斯|lucas|starwars|graffiti/i.test(desc)) meta.director = 'lucas';
  else if (/索金|sorkin|westwing|social/i.test(desc)) meta.director = 'sorkin';
  else if (/博伊尔|boyle|trainspot|slumdog/i.test(desc)) meta.director = 'boyle';
  else if (/大卫林奇|lynch|mulholland/i.test(desc)) meta.director = 'lynch';
  else if (/卡萨维茨|cassavetes|faces|shadows/i.test(desc)) meta.director = 'cassavetes';
  else if (/德尼罗|deniro|raging|taxi/i.test(desc)) meta.director = 'deniro';
  else if (/曼|mann|heat|collateral/i.test(desc)) meta.director = 'mann';
  else if (/斯派克琼斯|spike-jonze|her|adaptation/i.test(desc)) meta.director = 'spike-jonze';
  else if (/黑泽明|kurosawa|seven|samurai|ran/i.test(desc)) meta.director = 'kurosawa';
  else if (/奥卡萨姆|aucon/i.test(desc)) meta.director = 'aucon';
  
  // 检测特殊元素
  if (/雨|rain|雨夜/i.test(desc + mood)) meta.hasRain = true;
  if (/夜|night|黑暗/i.test(desc + mood)) meta.hasNight = true;
  if (/航拍|aerial|helicopter/i.test(camera + desc)) meta.hasAerial = true;
  
  meta.rawCamera = cameraStr || cameraMovementStr || cameraObjStr; // 【fix-1A3】运镜原文透传评分器
  return meta;
}

// ============================================================
// 技能匹配引擎
// ============================================================

function matchSkills(shotMeta, limit = 3) {
  const index = buildSkillIndex();
  if (Object.keys(index).length === 0) return [];
  
  const candidates = new Map();
  
  // 优先级1：类型+导演+情绪（最精确）
  if (shotMeta.type && shotMeta.director && shotMeta.emotion) {
    const key1 = `${shotMeta.type}_${shotMeta.director}`;
    const key2 = `${shotMeta.type}_${shotMeta.director}_${shotMeta.emotion}`;
    (index[key2] || index[key1] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 30);
    });
  }
  
  // 优先级2：类型+导演
  if (shotMeta.type && shotMeta.director) {
    const key = `${shotMeta.type}_${shotMeta.director}`;
    (index[key] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 20);
    });
  }
  
  // 优先级3：类型+情绪
  if (shotMeta.type && shotMeta.emotion) {
    const key = `${shotMeta.type}_${shotMeta.emotion}`;
    (index[key] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 15);
    });
  }
  
  // 优先级3.5：微表情演技技能跨类型匹配（36 个 acting 技能 type=micro-expression，
  // 此前剧情片永远够不到；情绪命中时给独立通道）【fix-1A4】
  if (shotMeta.emotion) {
    const actingKey = 'micro-expression_' + shotMeta.emotion;
    (index[actingKey] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 18);
    });
    // 兼容复合情绪键（如 微表情_tense-reserved）：包含即命中
    Object.keys(index).forEach(k => {
      if (k.startsWith('micro-expression_') && k.includes('_' + shotMeta.emotion)) {
        index[k].forEach(item => {
          candidates.set(item.file, (candidates.get(item.file) || 0) + 12);
        });
      }
    });
  }

  // 优先级4：类型匹配
  if (shotMeta.type) {
    // 【fix-1A5】按文件去重后只加一次（+5→+1）：同一文件挂在 6 个索引键下，
    // 不去重会被重复加分，同类型技能集体灌水霸榜
    const blanketSeen = new Set();
    Object.keys(index).forEach(k => {
      if (k.startsWith(shotMeta.type + '_')) {
        index[k].forEach(item => {
          if (blanketSeen.has(item.file)) return;
          blanketSeen.add(item.file);
          candidates.set(item.file, (candidates.get(item.file) || 0) + 1);
        });
      }
    });
  }
  
  // 优先级5：航拍特殊处理
  if (shotMeta.shotType === 'aerial' || shotMeta.hasAerial) {
    if (shotMeta.type && shotMeta.director) {
      const key5 = `${shotMeta.type}_${shotMeta.director}_${shotMeta.shotType}`;
      const key5b = `${shotMeta.type}_${shotMeta.director}_航拍`;
      (index[key5] || index[key5b] || []).forEach(item => {
        candidates.set(item.file, (candidates.get(item.file) || 0) + 35);
      });
    }
    const key3 = `${shotMeta.type}_航拍`;
    (index[key3] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 20);
    });
  }
  
  // 优先级6：IMAX技术标签
  if (shotMeta.tech === 'IMAX' || shotMeta.hasAerial) {
    const keyImax = `${shotMeta.type}_${shotMeta.director}_IMAX`;
    (index[keyImax] || []).forEach(item => {
      candidates.set(item.file, (candidates.get(item.file) || 0) + 40);
    });
  }
  
  // 优先级7：雨夜特殊处理
  if (shotMeta.hasRain && shotMeta.emotion) {
    const rainKey = `${shotMeta.type || 'drama'}_${shotMeta.director || ''}`;
    (index[rainKey] || []).forEach(item => {
      if (item.meta.filename.includes('雨夜')) {
        candidates.set(item.file, (candidates.get(item.file) || 0) + 20);
      }
    });
  }
  
  // 【fix-1A6】运镜冲突惩罚：定镜/缓推镜头配手持技能是反指导
  const FIXED_CAM = /static|固定机位|静置|push_in|缓推|dolly_in/i;
  if (FIXED_CAM.test(String(shotMeta.rawCamera || ''))) {
    for (const [file, score] of candidates.entries()) {
      if (/手持|handheld/i.test(file)) candidates.set(file, score - 15); // 手持与定镜直接冲突
      else if (/斯坦尼康|steadicam/i.test(file)) candidates.set(file, score - 6); // 斯坦尼康半兼容缓推，轻扣
    }
  }

  // 排序并返回top N
  const sorted = [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  
  return sorted.map(([file, score]) => {
    const skillPath = path.join(SKILL_LIB_ROOT, file);
    const meta = parseSkillFilename(file);
    const enhancement = extractSkillEnhancement(skillPath);
    return { skillPath, meta, score, enhancement };
  }).filter(r => r.enhancement);
}

// ============================================================
// 增强注入器
// ============================================================

function extractKeyTerms(blocks, maxTerms = 10) {
  if (!blocks || blocks.length === 0) return '';
  const allText = blocks.join(' ');
  
  const techTerms = allText.match(
    /\b(IMAX|aerial|steadicam|handheld|establishing|volumetric|god.?ray|deep.?focus|anamorphic|tungsten|during|dusk|golden.?hour|neon|noir|cinematic|epic|meditative|low.?key|high.?contrast|shallow.?depth|wide.?angle|telephoto|50mm|85mm|35mm|helicopter|drone|circular.?orbit|push.?in|pull.?out|track|pan|tilt|crane|fluid|smooth|handheld|shaky|steady)\b/gi
  ) || [];
  
  const zhTerms = allText.match(
    /[史诗|航拍|斯坦尼康|手持|定场|晨光|暮色|黄金时刻|霓虹|黑色电影|氛围|紧张|孤独|浪漫|沉默|宿命]+/g
  ) || [];
  
  const seen = new Set();
  const terms = [];
  for (const t of [...techTerms, ...zhTerms]) {
    const lower = t.toLowerCase();
    if (!seen.has(lower) && terms.length < maxTerms) {
      seen.add(lower);
      terms.push(t);
    }
  }
  
  return terms.join('; ');
}

function injectSkillEnhancement(shot, matchedSkills) {
  if (!matchedSkills || matchedSkills.length === 0) return shot;
  
  const enhanced = JSON.parse(JSON.stringify(shot));
  
  const forbiddenBlocks = matchedSkills
    .map(s => s.enhancement?.forbiddenBlock).filter(Boolean);
  const cameraBlocks = matchedSkills
    .map(s => s.enhancement?.shotBlock).filter(Boolean);
  const moodBlocks = matchedSkills
    .map(s => s.enhancement?.emotionBlock).filter(Boolean);
  
  const cameraTerms = extractKeyTerms(cameraBlocks, 8);
  const moodTerms = extractKeyTerms(moodBlocks, 6);
  const forbidTerms = extractKeyTerms(forbiddenBlocks, 8);
  
  enhanced._appliedSkills = matchedSkills.map(s => ({
    file: path.basename(s.skillPath),
    score: s.score,
    type: s.meta.type_zh,
    director: s.meta.director_zh,
    emotion: s.meta.emotion_zh
  }));
  enhanced._skillForbidden = forbidTerms || ''; // 【fix-1B】供【负面约束】合并
  
  const skillTag = `[CINEMATIC_SKILL] ${matchedSkills.map(s => s.meta.type_zh + '_' + s.meta.director_zh + '_' + s.meta.emotion_zh).join(' | ')}`;
  const cameraLine = cameraTerms ? `Camera增强: ${cameraTerms}` : '';
  const moodLine = moodTerms ? `Mood增强: ${moodTerms}` : '';
  const forbidLine = forbidTerms ? `禁止词: ${forbidTerms}` : '';
  
  const skillBlock = [skillTag, cameraLine, moodLine, forbidLine]
    .filter(Boolean)
    .join(' | ');
  
  // 追加到 _generatedPrompt 或 prompt 末尾
  const targetPrompt = enhanced._generatedPrompt || enhanced.prompt || '';
  if (targetPrompt && skillBlock) {
    const promptField = enhanced._generatedPrompt ? '_generatedPrompt' : 'prompt';
    enhanced[promptField] = targetPrompt.trimEnd() + '\n' + skillBlock;
  }
  
  return enhanced;
}

// ============================================================
// 主入口：批量处理shots
// ============================================================

function routeAndEnhance(shots, options = {}) {
  const { minScore = 5, maxSkillsPerShot = 2, dryRun = false } = options;
  
  const report = {
    totalShots: shots.length,
    enhancedShots: 0,
    skippedShots: 0,
    skillsUsed: new Set(),
    details: []
  };
  
  const enhancedShots = shots.map((shot, idx) => {
    const meta = extractShotMetadata(shot);
    let matched = matchSkills(meta, maxSkillsPerShot)
      .filter(s => s.score >= minScore);

    // 【fix-1A6】冲突惩罚把唯一匹配也扣死时，回退取原始最高分并标记 fallback
    if (matched.length === 0 && meta.rawCamera) {
      const relaxed = matchSkills({ ...meta, rawCamera: '' }, 1)
        .filter(s => s.score >= minScore);
      if (relaxed.length > 0) {
        relaxed[0].fallback = true;
        matched = relaxed;
      }
    }

    if (matched.length === 0) {
      report.skippedShots++;
      report.details.push({ shotIdx: idx, status: 'no_match', meta });
      return shot;
    }
    
    matched.forEach(s => report.skillsUsed.add(path.basename(s.skillPath)));
    
    if (dryRun) {
      report.details.push({
        shotIdx: idx,
        status: 'matched',
        score: matched[0].score,
        skills: matched.map(s => ({ file: path.basename(s.skillPath), score: s.score }))
      });
      return shot;
    }
    
    const newShot = injectSkillEnhancement(shot, matched);
    report.enhancedShots++;
    report.details.push({
      shotIdx: idx,
      status: 'enhanced',
      score: matched[0].score,
      skills: matched.map(s => ({ file: path.basename(s.skillPath), score: s.score }))
    });
    return newShot;
  });
  
  report.skillsUsed = [...report.skillsUsed];
  return { enhancedShots, report };
}

// ============================================================
// CLI 调试
// ============================================================

if (require.main === module) {
  const testShots = [
    {
      description: 'aerial shot of alien desert planet, vast sand dunes extending in IMAX frame, Villeneuve style',
      camera: 'aerial, helicopter, IMAX 1.90:1',
      mood: 'epic, vast, destiny approaching',
      lighting: 'golden hour, volumetric god rays'
    },
    {
      description: '角色在雨夜的城市街头，手持跟拍',
      camera: 'handheld, close follow',
      mood: 'tense, lonely, noir atmosphere',
      lighting: 'neon reflections on wet pavement'
    },
    {
      description: '舞蹈场景，斯坦尼康环绕拍摄',
      camera: 'steadicam, circular orbit',
      mood: 'romantic, tender',
      lighting: 'warm spotlight'
    }
  ];
  
  console.log('=== 技能路由测试 ===\n');
  const result = routeAndEnhance(testShots, { dryRun: true });
  console.log(JSON.stringify(result.report, null, 2));
}

// ============================================================
// 匹配引擎 2.0（Phase 2）：结构化双端标签 + 硬约束 + 多样性 + 回退链
// 优先读编译索引 skills-index.json，缺失时回退旧 buildSkillIndex()（双轨）
// ============================================================

const TAXONOMY = require('./taxonomy.json');
const COMPILED_INDEX_PATH = path.join(__dirname, 'skills-index.json');

function loadCompiledIndex() {
 try {
 if (fs.existsSync(COMPILED_INDEX_PATH)) {
 const data = JSON.parse(fs.readFileSync(COMPILED_INDEX_PATH, 'utf8'));
 if (Array.isArray(data.skills) && data.skills.length > 0) return data.skills;
 }
 } catch (e) {
 console.warn(`[SkillRouter V2] 编译索引读取失败，回退文件名解析: ${e.message}`);
 }
 // 回退：从旧索引构建器重建为 V2 元数据形态
 const legacy = buildSkillIndex();
 const skills = new Map();
 for (const list of Object.values(legacy)) {
 for (const item of list) {
 if (skills.has(item.file)) continue;
 const m = item.meta;
 skills.set(item.file, {
 file: m.filename,
 skill_id: m.filename.replace('.md', ''),
 domain: m.type_zh === '微表情' ? 'acting' : 'cinematography',
 type: TAXONOMY.type_alias[m.type_zh] || m.type,
 director: m.director_zh || '',
 emotions: [TAXONOMY.emotion_alias[m.emotion_zh] || m.emotion].filter(Boolean),
 camera_modes: m.shotType ? [m.shotType] : []
 });
 }
 }
 return [...skills.values()];
}

/** shot 侧结构化元数据（不再靠正则猜） */
function normalizeShotMeta(shot) {
 const rawMood = String(shot.mood || shot.emotion || shot.emotional_target?.emotion || '').toLowerCase().trim();
 const rawCam = String(shot.camera?.movement || shot.cameraString || shot.cameraMovement || '').toLowerCase();
 let cameraMode = 'any';
 for (const [alias, mode] of Object.entries(TAXONOMY.camera_alias)) {
 if (rawCam && rawCam.includes(alias.toLowerCase())) { cameraMode = mode; break; }
 }
 return {
 shotId: shot.shotId || shot.shot_id,
 type: 'drama',
 emotion: TAXONOMY.emotion_alias[rawMood] || rawMood || '',
 cameraMode,
 director: '',
 intensity: shot._creativeIntensity || null
 };
}

function matchSkillsV2(shotMeta, opts = {}) {
 const { limit = 2, minScore = 5, usedSkillRatio = {} } = opts;
 const skills = loadCompiledIndex();

 const scored = [];
 for (const skill of skills) {
 let score = 0;
 const reasons = [];

 // 硬约束：运镜冲突直接排除（配回退链，见函数尾）
 const shotCam = shotMeta.cameraMode || 'any';
 const skillCams = skill.camera_modes.length ? skill.camera_modes : ['any'];
 const conflict = (TAXONOMY.camera_conflicts[shotCam] || []).some(c => skillCams.includes(c));
 if (conflict && !skillCams.includes('any')) {
 scored.push({ skill, score: -999, excluded: 'camera-conflict' });
 continue;
 }

 // 情绪匹配（主信号）
 if (shotMeta.emotion && skill.emotions.includes(shotMeta.emotion)) { score += 30; reasons.push('emotion'); }
 // 类型匹配
 if (shotMeta.type && skill.type === shotMeta.type) { score += 10; reasons.push('type'); }
 // 跨域补偿：acting 技能适配所有类型
 if (skill.domain === 'acting' && shotMeta.emotion && skill.emotions.includes(shotMeta.emotion)) { score += 12; reasons.push('acting-cross-domain'); }
 // 运镜兼容加分
 if (shotCam !== 'any' && skillCams.includes(shotCam)) { score += 8; reasons.push('camera'); }
 // 导演亲和
 if (shotMeta.director && skill.director === shotMeta.director) { score += 15; reasons.push('director'); }
 // 创意档位
 if (shotMeta.intensity && skill.intensity_range) {
 const [lo, hi] = skill.intensity_range;
 const lv = 'L' + shotMeta.intensity;
 if (lv >= lo && lv <= hi) { score += 5; reasons.push('intensity'); }
 }
 // 多样性惩罚：本 run 内已被 >1/3 镜头使用的技能降权
 const ratio = usedSkillRatio[skill.file] || 0;
 if (ratio > 0.34) score -= 12;

 scored.push({ skill, score, reasons });
 }

 let top = scored.filter(s => s.score >= minScore && !s.excluded)
 .sort((a, b) => b.score - a.score).slice(0, limit);
 // 回退链：硬约束杀光时，放宽运镜约束取情绪最高分并标记 fallback
 if (top.length === 0) {
 const relaxed = scored.filter(s => s.reasons?.includes('emotion') && s.score > -999)
 .sort((a, b) => b.score - a.score).slice(0, 1);
 relaxed.forEach(r => { r.fallback = true; r.score = Math.max(r.score, minScore); });
 top = relaxed;
 }
 return top;
}

/** 技能上下文文本构建：供 PromptFusion 生成前注入（L3 主通道） */
function buildSkillContextText(matched) {
 const parts = [];
 for (const m of matched) {
 const skillPath = path.join(SKILL_LIB_ROOT, m.skill.file);
 const enh = extractSkillEnhancement(skillPath);
 if (!enh) continue;
 const tag = `${m.skill.type}_${m.skill.director || '通用'}_${m.skill.emotions.join('/')}${m.fallback ? '(回退匹配)' : ''}`;
 const block = [`◆ 技能「${tag}」（匹配分 ${m.score}）`];
 if (enh.shotBlock) block.push(`镜头手法: ${enh.shotBlock.slice(0, 120)}`);
 if (enh.emotionBlock) block.push(`情绪设计: ${enh.emotionBlock.slice(0, 100)}`);
 if (enh.forbiddenBlock) block.push(`禁止词: ${enh.forbiddenBlock.slice(0, 100)}`);
 parts.push(block.join('\n'));
 }
 return parts.join('\n\n').slice(0, 900); // 单镜头技能上下文总长封顶 900 字符
}

/**
 * 批量预匹配（供 Phase 3 主通道调用）
 * @returns {Map} shotId → { matched, contextText }
 */
function routeAndEnhanceV2(shots, opts = {}) {
 const { minScore = 5, maxSkillsPerShot = 2 } = opts;
 const plan = new Map();
 const useCount = {};
 for (const shot of shots) {
 const meta = normalizeShotMeta(shot);
 const ratio = {};
 const total = Math.max(shots.length, 1);
 for (const [f, c] of Object.entries(useCount)) ratio[f] = c / total;
 const matched = matchSkillsV2(meta, { limit: maxSkillsPerShot, minScore, usedSkillRatio: ratio });
 matched.forEach(m => { useCount[m.skill.file] = (useCount[m.skill.file] || 0) + 1; });
 plan.set(meta.shotId, {
 matched: matched.map(m => ({ file: m.skill.file, score: m.score, fallback: !!m.fallback, reasons: m.reasons || [] })),
 contextText: buildSkillContextText(matched)
 });
 }
 return plan;
}

module.exports.matchSkillsV2 = matchSkillsV2;
module.exports.normalizeShotMeta = normalizeShotMeta;
module.exports.routeAndEnhanceV2 = routeAndEnhanceV2;
module.exports.buildSkillContextText = buildSkillContextText;

module.exports = {
  buildSkillIndex,
  extractShotMetadata,
  matchSkills,
  injectSkillEnhancement,
  routeAndEnhance,
  parseSkillFilename,
  SKILL_LIB_ROOT
};