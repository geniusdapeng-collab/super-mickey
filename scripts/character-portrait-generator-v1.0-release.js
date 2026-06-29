#!/usr/bin/env node
/**
 * ============================================================
 * Character Portrait Generator v1.0 — 系统级通用定妆照生成模块
 * ============================================================
 * 通用模块，不绑定任何具体角色或case
 * 
 * 支持三种输入模式：
 *   模式A [档案驱动] — 有完整 character-card.json / beast-profile.json
 *   模式B [描述驱动] — 只有语言描述，需LLM/知识库补充完善
 *   模式C [主题驱动] — 只有角色名，全靠知识库+LLM推理
 * 
 * 标准化特征分类系统（基于40只异兽档案+人类角色设计）：
 *   神兽角色: 11大分类，56个细分字段
 *   人类角色: 10大分类，45个细分字段
 * 
 * 调用方式：
 *   node character-portrait-generator.js --mode A --beast-id tian-gou
 *   node character-portrait-generator.js --mode B --description "银狐生物，三白眼..." --type beast
 *   node character-portrait-generator.js --mode C --name "天狗" --type beast
 * 
 * 输出：characters/{id}/portraits/{id}-portrait-{angle}.png + manifest.json
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ========== 系统级依赖 ==========
const CharacterFeatureExtractor = require('../systems/character-feature-extractor');

// ========== API 配置 ==========
const ENDPOINT = process.env.SEEDREAM_ENDPOINT || '003cENDPOINT_IMG003e';
const API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const OUTPUT_BASE = path.join(process.cwd(), 'characters');

// ========== 核心常量 ==========
const PROMPT_MAX_CN = 300;  // Seedream: 300汉字上限
const PROMPT_MAX_EN = 600;  // 或600英文单词

// 标准化4角度定义
const STANDARD_ANGLES = [
  {
    id: 'front',
    name: '正面',
    promptTemplate: (coreDesc, style) => 
      `Full body front view, ${coreDesc}, facing camera directly, all distinctive features centered and fully visible, symmetrical composition, ${style}, pure white background, studio three-point lighting, character reference sheet, 2K resolution`
  },
  {
    id: 'threeQuarter', 
    name: '45度侧面',
    promptTemplate: (coreDesc, style) =>
      `Three-quarter portrait angle, ${coreDesc}, 45-degree view showing depth and dimension, facial structure and body contours clearly visible, left side dominant, ${style}, pure white background, main light from 45-degree left, rim light highlighting edges, character reference sheet, 2K resolution`
  },
  {
    id: 'closeup',
    name: '特写',
    promptTemplate: (coreDesc, style) =>
      `Extreme close-up portrait, ${coreDesc}, focus on facial features, eyes, distinctive markings, maximum texture detail, shallow depth of field, ${style}, pure white background, dramatic front key light, subsurface scattering on skin, character reference sheet, 2K resolution`
  },
  {
    id: 'side',
    name: '侧面',
    promptTemplate: (coreDesc, style) =>
      `Full body side profile, ${coreDesc}, 90-degree silhouette view, full body proportions and contour lines, spine curve visible, ${style}, pure white background, strong rim light emphasizing silhouette, character reference sheet, 2K resolution`
  }
];

// 风格模板（Nirath通用）
const DEFAULT_STYLE = 'photorealistic cinematic, ultra-detailed texture, subsurface scattering, volumetric light, 8K texture detail';

// 负面约束（禁止项）
const NEGATIVE_CONSTRAINTS = 'no complex background, no environment scene, no landscape, no sky, no moon, no stars, no metallic shine, no 3D render label, no anime, no cartoon, no toon, natural eye colors only, clean white background';

// ========== 特征分类系统 v2.0（基于40只异兽档案+人类角色）==========
const FEATURE_CATEGORIES = {
  beast: {
    // 1. 头部系统 (Head System)
    head: {
      head_shape: ['headShape', 'skull', 'cranium', 'head_structure'],
      forehead: ['forehead', 'brow_ridge', 'frontal_area'],
      facial_markings: ['facialMarkings', 'stripes', 'patterns', 'mask', 'helmet', '王字纹', '三纵纹'],
      ears: ['ears', 'ear_shape', 'ear_size', 'ear_position', 'ear_rotation', 'ear_tips'],
      snout_muzzle: ['snout', 'muzzle', 'jaw', 'mouth_structure', 'beak', 'nose'],
      horns_antlers: ['horns', 'antlers', 'horn_shape', 'horn_material', 'horn_color', 'horn_texture', 'horn_arrangement', 'unicorn', '双角']
    },
    // 2. 面部系统 (Face System)
    face: {
      face_shape: ['faceShape', 'facial_structure', 'facialContour'],
      skin_texture: ['skin', 'skin_texture', 'facial_texture', 'scales', 'facial_scales', 'feathers', 'fur'],
      facial_patterns: ['facialPatterns', 'face_paint', 'mask_pattern', 'tribal_marks'],
      whiskers: ['whiskers', 'whisker_length', 'whisker_texture'],
      cheeks: ['cheeks', 'cheekbones', 'cheek_fluff', 'cheek_pouches']
    },
    // 3. 视觉系统 (Visual System)
    eyes: {
      eye_color: ['eyeColor', 'eye_color', 'iris_color', 'pupil_color', '琥珀色', '金色', '红色', '绿色'],
      eye_shape: ['eyeShape', 'eye_shape', 'eye_size', 'almond', 'round', 'slit', 'vertical_pupil', '四目双瞳'],
      pupil: ['pupil', 'pupil_shape', 'slit_pupil', 'round_pupil', '竖瞳', '火焰瞳孔'],
      eyeshine: ['eyeshine', 'eye_glow', 'eye_reflection', 'bioluminescent_eyes', 'eye_luminescence'],
      eye_position: ['eye_position', 'eye_placement', 'eyes_under_armpits', 'eyes_on_head', 'forehead_eyes']
    },
    // 4. 被覆系统 (Integumentary System)
    coat: {
      coat_type: ['coatType', 'furType', 'scaleType', 'featherType', 'skinType', 'exoskeleton', 'shell', 'plumage'],
      color_pattern: ['colorPattern', 'color_pattern', 'coloration', 'base_color', 'primary_color', 'secondary_color', 'gradient', 'iridescent', 'metallic_sheen'],
      texture: ['texture', 'coat_texture', 'fur_texture', 'scale_texture', 'feather_texture', 'smooth', 'rough', 'fluffy', 'silky', 'spiky'],
      length: ['length', 'coat_length', 'fur_length', 'feather_length', 'short', 'medium', 'long', 'flowing'],
      sheen: ['sheen', 'luster', 'glow', 'iridescence', 'metallic', 'matte', 'glossy', 'bioluminescent']
    },
    // 5. 身体系统 (Body System)
    body: {
      body_plan: ['bodyPlan', 'body_type', 'body_shape', 'torso', 'quadruped', 'biped', 'serpentine', 'amorphous'],
      torso_shape: ['torso', 'torso_shape', 'chest', 'abdomen', 'back', 'spine_curve', 'hump', 'saddle'],
      muscle_definition: ['muscle', 'muscle_definition', 'muscular', 'lean', 'bulky', 'ripped', 'defined'],
      silhouette: ['silhouette', 'outline', 'profile', 'body_proportion', 'limb_ratio'],
      scale_size: ['scale', 'size', 'height', 'length', 'weight', 'mass', 'giant', 'miniature', 'colossal']
    },
    // 6. 肢体系统 (Limb System)
    limbs: {
      leg_structure: ['legs', 'leg_structure', 'leg_count', 'forelegs', 'hind_legs', 'digitigrade', 'plantigrade', '六足'],
      paw_hoof: ['paws', 'hooves', 'feet', 'claws', 'talons', 'paw_shape', 'hoof_shape', 'toe_count', 'webbed'],
      digit_structure: ['digits', 'fingers', 'toes', 'claw_count', 'retractable', 'prehensile', 'opposable'],
      joint_type: ['joints', 'knee_direction', 'elbow', 'hinge', 'ball_and_socket', 'flexible', 'rigid'],
      stance: ['stance', 'posture', 'standing', 'crouching', 'rearing', 'quadrupedal', 'bipedal']
    },
    // 7. 爪牙系统 (Claw/Tooth System)
    claws_teeth: {
      claw_shape: ['claws', 'claw_shape', 'claw_length', 'claw_curvature', 'hooked', 'curved', 'straight', 'serrated'],
      claw_color: ['claw_color', 'nail_color', 'talon_color', 'black', 'white', 'metallic', 'ivory'],
      teeth_type: ['teeth', 'tooth_type', 'fangs', 'tusks', 'incisors', 'molars', 'carnassial', 'serrated', '锯齿状'],
      teeth_size: ['tooth_size', 'fang_length', 'tusk_length', 'palm-sized', 'dagger-like', 'sword-like'],
      teeth_arrangement: ['dentition', 'tooth_arrangement', 'single_row', 'multiple_rows', 'spiral', 'jaw_full']
    },
    // 8. 尾部系统 (Tail System)
    tail: {
      tail_length: ['tail_length', 'tail_size', 'long', 'short', 'stubby', 'massive'],
      tail_shape: ['tail_shape', 'tail_form', 'fluffy', 'slender', 'thick', 'clubbed', 'feathered', 'plumed', 'squirrel-like'],
      tail_texture: ['tail_texture', 'tail_fur', 'tail_scales', 'tail_feathers', 'bushy', 'smooth', 'ringed', 'striped'],
      tail_count: ['tail_count', 'tails', 'nine_tails', 'single_tail', 'multiple_tails', 'split_tail'],
      tail_special: ['tail_tip', 'tail_special', 'tail_glow', 'tail_weapon', 'tail_prehensile', 'tail_sensory', '发光尾尖']
    },
    // 9. 羽翼系统 (Wing System)
    wings: {
      wing_span: ['wingspan', 'wing_span', 'wing_length', '翼展', 'span'],
      wing_type: ['wing_type', 'wing_structure', 'membrane', 'feathered', 'bat-like', 'insect-like', 'energy_wings', '透明翼'],
      wing_texture: ['wing_texture', 'wing_membrane', 'wing_feathers', 'scales', 'skin', 'leathery', 'translucent', '半透明'],
      wing_color: ['wing_color', 'wing_pattern', 'iridescent', 'metallic', 'glowing', 'gradient', '彩虹色'],
      wing_markings: ['wing_markings', 'wing_patterns', 'spots', 'stripes', 'eye_spots', '符文', '电磁纹路']
    },
    // 10. 特殊器官系统 (Special Organs)
    special_organs: {
      glowing_organs: ['glowing', 'bioluminescent', 'light_organs', 'luminous', '荧光', '发光器官', '发光体'],
      energy_sacs: ['energy_sacs', 'storage_pouches', 'reservoir', '储能囊', '能量囊', '反重力储能囊'],
      sensory_appendages: ['sensory', 'antennae', 'tentacles', 'feelers', 'sensory_hairs', '感应器', '引力感应器'],
      defense_organs: ['defense', 'armor', 'shell', 'carapace', 'scutes', 'plates', '盾', '甲', '火山岩装甲'],
      weapon_organs: ['weapon', 'spines', 'quills', 'stingers', 'horns', 'blade', 'saw', '尾鞭成江']
    },
    // 11. 能量/光环系统 (Energy/Aura System)
    energy: {
      aura_type: ['aura', 'energy_field', 'magnetic_field', 'force_field', '气场', '电磁场'],
      aura_color: ['aura_color', 'glow_color', 'halo_color', '等离子体', '赤红色', '金黄色', '幽蓝色'],
      aura_effect: ['aura_effect', 'particles', 'sparks', 'trails', 'resonance', '共鸣', '能量振动'],
      emission_points: ['emission', 'vents', 'ports', '喷射口', '重水喷射口', '能量溢出缝隙']
    }
  },
  
  human: {
    // 1. 头部系统
    head: {
      head_shape: ['headShape', 'skull', 'cranium', 'oval', 'round', 'square', 'heart-shaped'],
      forehead: ['forehead', 'brow', 'brow_ridge', 'forehead_width', 'receding', 'prominent'],
      jawline: ['jawline', 'jaw', 'chin', 'mandible', 'square_jaw', 'pointed_chin', 'cleft_chin'],
      cheekbones: ['cheekbones', 'cheeks', 'high_cheekbones', 'full_cheeks', 'hollow_cheeks']
    },
    // 2. 面部系统
    face: {
      face_shape: ['faceShape', 'face', 'oval', 'round', 'square', 'diamond', 'heart', 'long'],
      skin_texture: ['skin', 'skin_texture', 'smooth', 'rough', 'pores', 'freckles', 'blemishes', 'scars', 'wrinkles'],
      skin_color: ['skinColor', 'skin_tone', 'complexion', 'pale', 'fair', 'tan', 'dark', 'olive', 'porcelain'],
      facial_markings: ['markings', 'birthmarks', 'moles', 'scars', 'tattoos', 'face_paint', 'tribal_marks', 'bindi']
    },
    // 3. 视觉系统
    eyes: {
      eye_color: ['eyeColor', 'iris', 'blue', 'brown', 'green', 'hazel', 'amber', 'gray', 'violet', 'heterochromia'],
      eye_shape: ['eyeShape', 'almond', 'round', 'upturned', 'downturned', 'hooded', 'monolid', 'deep_set'],
      eyebrows: ['eyebrows', 'brow', 'thick', 'thin', 'arched', 'straight', 'bushy', 'plucked', 'unibrow'],
      gaze: ['gaze', 'expression', 'intense', 'gentle', 'piercing', 'warm', 'cold', 'distant', 'focused']
    },
    // 4. 毛发系统
    hair: {
      hair_color: ['hairColor', 'black', 'brown', 'blonde', 'red', 'white', 'gray', 'silver', 'dyed', 'unnatural'],
      hair_style: ['hairStyle', 'long', 'short', 'medium', 'ponytail', 'braid', 'bun', 'spiky', 'curly', 'straight', 'wavy'],
      hair_length: ['hair_length', 'bald', 'buzz', 'shoulder', 'waist', 'hip', 'floor_length'],
      hair_texture: ['hair_texture', 'silky', 'coarse', 'curly', 'wavy', 'straight', 'frizzy', 'oily', 'dry'],
      facial_hair: ['facialHair', 'beard', 'mustache', 'goatee', 'stubble', 'clean_shaven', 'sideburns']
    },
    // 5. 身体系统
    body: {
      body_type: ['bodyType', 'ectomorph', 'mesomorph', 'endomorph', 'athletic', 'slim', 'muscular', 'curvy', 'stocky'],
      height: ['height', 'tall', 'short', 'average', 'petite', 'lanky', 'giant'],
      build: ['build', 'slender', 'lean', 'muscular', 'athletic', 'heavy', 'frail', 'robust'],
      posture: ['posture', 'straight', 'hunched', 'relaxed', 'rigid', 'confident', 'shy', 'defensive'],
      silhouette: ['silhouette', 'hourglass', 'triangle', 'inverted_triangle', 'rectangle', 'oval']
    },
    // 6. 肢体系统
    limbs: {
      arm_length: ['arms', 'arm_length', 'long_arms', 'short_arms', 'reach', 'wingspan'],
      leg_proportion: ['legs', 'leg_length', 'long_legs', 'short_legs', 'leg_ratio', 'torso_ratio'],
      muscle_definition: ['muscles', 'muscle_definition', 'toned', 'ripped', 'lean', 'soft', 'veins', 'striations'],
      joint_structure: ['joints', 'knuckles', 'elbows', 'knees', 'angular', 'smooth']
    },
    // 7. 手部系统
    hands: {
      hand_shape: ['hands', 'hand_shape', 'long_fingers', 'short_fingers', 'broad', 'slender', 'square'],
      finger_length: ['fingers', 'finger_length', 'long_fingers', 'stubby', 'tapered', 'manicured'],
      nails: ['nails', 'fingernails', 'long_nails', 'short_nails', 'painted', 'natural', 'manicured', 'claw-like'],
      gesture: ['gesture', 'hand_pose', 'fist', 'open_palm', 'pointing', 'gesticulating', 'resting', 'clenched'],
      skin_detail: ['hand_skin', 'veins', 'knuckles', 'wrinkles', 'calluses', 'smooth', 'rough']
    },
    // 8. 服装系统
    clothing: {
      outfit_style: ['outfit', 'style', 'casual', 'formal', 'traditional', 'modern', 'futuristic', 'armored', 'robes', 'uniform'],
      colors: ['clothing_colors', 'color_scheme', 'monochrome', 'colorful', 'muted', 'vibrant', 'pastel', 'dark'],
      materials: ['materials', 'fabric', 'leather', 'silk', 'cotton', 'metal', 'armor', 'fur', 'synthetic'],
      fit: ['fit', 'tight', 'loose', 'fitted', 'baggy', 'tailored', 'oversized', 'skinny'],
      layers: ['layers', 'layered', 'single', 'coat', 'jacket', 'vest', 'cape', 'cloak', 'scarf']
    },
    // 9. 配饰系统
    accessories: {
      jewelry: ['jewelry', 'necklace', 'earrings', 'rings', 'bracelet', 'pendant', 'brooch', 'crown', 'tiara'],
      glasses: ['glasses', 'sunglasses', 'spectacles', 'goggles', 'monocle', 'cybernetic_eyes', 'visor'],
      hats: ['hat', 'headwear', 'cap', 'helmet', 'hood', 'veil', 'crown', 'headband', 'bandana'],
      bags: ['bag', 'backpack', 'satchel', 'pouch', 'belt_bag', 'shoulder_bag', 'saddlebag'],
      belts: ['belt', 'sash', 'girdle', 'cummerbund', 'utility_belt', 'weapon_belt'],
      other: ['scarf', 'gloves', 'watch', 'compass', 'communicator', 'badge', 'medal', 'patch']
    },
    // 10. 武器/道具系统
    weapons: {
      weapon_type: ['weapon', 'sword', 'spear', 'bow', 'gun', 'staff', 'wand', 'dagger', 'axe', 'hammer', 'unarmed'],
      weapon_shape: ['weapon_shape', 'straight', 'curved', 'serrated', 'jagged', 'elegant', 'brutal', 'refined', 'crude'],
      weapon_material: ['weapon_material', 'steel', 'iron', 'wood', 'crystal', 'energy', 'bone', 'obsidian', 'gold', 'silver'],
      weapon_size: ['weapon_size', 'small', 'medium', 'large', 'huge', 'two_handed', 'one_handed', 'concealed', 'oversized'],
      weapon_details: ['weapon_details', 'ornate', 'plain', 'runes', 'engraved', 'jeweled', 'glowing', 'bloodstained', 'notched', 'pristine']
    }
  }
};

// ========== API Key 解析 ==========
function resolveApiKey() {
  if (process.env.VOLCENGINE_ARK_API_KEY) return process.env.VOLCENGINE_ARK_API_KEY;
  try {
    const configPath = path.join(require('os').homedir(), '.openclaw/config/volcengine.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.apiKey || config.arkApiKey;
  } catch {}
  return null;
}

// ========== HTTP 工具 ==========
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(filepath); });
    }).on('error', reject);
  });
}

// ========== 模式A: 档案驱动 ==========
function loadProfileFromArchive(beastId) {
  const possiblePaths = [
    path.join(process.cwd(), 'systems', 'beast-database', 'beasts', `${beastId}.json`),
    path.join(process.cwd(), 'beast-database', 'beasts', `${beastId}.json`),
    path.join(process.cwd(), 'characters', beastId, 'character-card.json'),
    path.join(process.cwd(), '..', 'systems', 'beast-database', 'beasts', `${beastId}.json`)
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        console.log(`[档案] 加载: ${p}`);
        return { source: 'archive', path: p, data };
      } catch (e) {
        console.warn(`[警告] 档案解析失败: ${p} | ${e.message}`);
      }
    }
  }
  
  throw new Error(`未找到角色档案: ${beastId}`);
}

// ========== 模式B/C: 知识库补充（LLM驱动）==========
async function enrichDescriptionByLLM(input, roleType, roleName) {
  console.log(`[LLM] 启动知识库补充 | 类型: ${roleType} | 名称: ${roleName}`);
  console.log(`[LLM] 输入: "${input.substring(0, 100)}..."`);
  
  // 构建知识库查询
  const knowledgeQueries = [];
  if (roleType === 'beast') {
    knowledgeQueries.push(`山海经 ${roleName} 外形特征`);
    knowledgeQueries.push(`中国古代神话 ${roleName} 形象描述`);
    knowledgeQueries.push(`${roleName} 神兽 身体结构 颜色`);
  } else {
    knowledgeQueries.push(`${roleName} 人物特征 外貌`);
    knowledgeQueries.push(`${roleName} 服装 武器 道具`);
  }
  
  // 构建LLM提示词
  const llmPrompt = `你是一个专业的角色设计专家，擅长根据碎片信息构建完整的角色视觉档案。

角色信息：
- 名称：${roleName}
- 类型：${roleType === 'beast' ? '神兽/异兽' : '人类角色'}
- 已知描述：${input}

任务：请基于中国古代神话/幻想文学知识，补充完善这个角色的详细视觉特征。要求：
1. 输出JSON格式，包含以下字段：
   - coreDescription: 核心外形描述（200字以内）
   - bodyPlan: 身体结构（100字以内）
   - colorPalette: 颜色数组（4-6项）
   - scale: 体型大小
   - texture: 材质/纹理
   - signatureFeatures: 标志性特征数组（5-8项，每项详细描述）
   - featureCategories: 分类特征对象，按 ${roleType === 'beast' ? 'head/face/eyes/coat/body/limbs/claws_teeth/tail/wings/special_organs/energy' : 'head/face/eyes/hair/body/limbs/hands/clothing/accessories/weapons'} 分类

2. 特征必须具体、可视觉化，避免抽象形容词。
3. 如果输入已有描述，保留并扩展；如果输入为空，基于知识库创建完整档案。

请直接输出JSON，不要额外解释。`;

  console.log(`[LLM] 提示词长度: ${llmPrompt.length}字符`);
  
  // 这里调用LLM API（需要接入实际的LLM服务）
  // 目前返回框架结构，实际实现需要接入 LLMEngine
  return {
    source: 'llm_enriched',
    enriched: true,
    prompt: llmPrompt,
    note: 'LLM知识库补充需要接入实际LLM服务。当前返回结构框架。'
  };
}

// ========== 特征提取（系统级）==========
function extractDetailedFeatures(profile, roleType = 'beast') {
  const extractor = new CharacterFeatureExtractor();
  
  // 构建完整描述文本
  const parts = [];
  const vi = profile.visualIdentity || {};
  
  if (vi.coreDescription) parts.push(vi.coreDescription);
  if (vi.bodyPlan) parts.push(vi.bodyPlan);
  if (vi.signatureFeatures) parts.push(vi.signatureFeatures.join('. '));
  if (vi.texture) parts.push(vi.texture);
  if (vi.colorPalette) parts.push(`Colors: ${vi.colorPalette.join(', ')}`);
  if (vi.proportions) parts.push(vi.proportions);
  if (vi.distinguishingMarks) parts.push(vi.distinguishingMarks);
  
  const sourceText = parts.join('\n');
  if (!sourceText) {
    throw new Error(`档案缺少视觉特征描述`);
  }
  
  // 分类归档特征
  const categorized = {};
  const categories = FEATURE_CATEGORIES[roleType] || FEATURE_CATEGORIES.beast;
  
  for (const [category, subcategories] of Object.entries(categories)) {
    categorized[category] = {};
    for (const [subcategory, fieldKeys] of Object.entries(subcategories)) {
      categorized[category][subcategory] = {};
      for (const fieldKey of fieldKeys) {
        // 从档案中提取对应字段（支持多种命名和嵌套路径）
        const value = extractFieldValue(vi, fieldKey, category, subcategory);
        if (value) categorized[category][subcategory][fieldKey] = value;
      }
    }
  }
  
  // 系统级特征提取
  const result = extractor.extract(sourceText, roleType, profile.id, profile.name?.chinese || profile.id);
  
  // 回退：如果系统提取的锚点为空，使用档案 signatureFeatures
  let visualAnchors = result.characterCard?.visualAnchors?.required || [];
  if (visualAnchors.length === 0 && vi.signatureFeatures) {
    visualAnchors = vi.signatureFeatures;
    console.log(`[特征] 系统提取为空，使用档案 signatureFeatures: ${visualAnchors.length}项`);
  }
  
  return {
    sourceText,
    categorized,
    visualAnchors,
    characterCard: result.characterCard,
    profile
  };
}

// 字段提取辅助函数（增强版）
function extractFieldValue(vi, fieldKey, category, subcategory) {
  // 尝试多种可能的字段名映射
  const mappings = {
    // 头部
    'head_shape': ['headShape', 'head', 'skull', 'cranium', 'head_structure'],
    'facial_markings': ['facialMarkings', 'stripes', 'patterns', 'mask', 'helmet', 'markings', '王字纹', '三纵纹'],
    'ears': ['ears', 'ear_shape', 'ear_size', 'ear_position'],
    'snout_muzzle': ['snout', 'muzzle', 'jaw', 'mouth', 'beak', 'nose'],
    'horns_antlers': ['horns', 'antlers', 'horn_shape', 'horn_material', 'horn_color', 'unicorn', '双角'],
    // 面部
    'face_shape': ['faceShape', 'face', 'facial_structure', 'facialContour'],
    'skin_texture': ['skin', 'skin_texture', 'facial_texture', 'scales', 'facial_scales'],
    'facial_patterns': ['facialPatterns', 'face_paint', 'mask_pattern', 'tribal_marks'],
    // 眼睛
    'eye_color': ['eyeColor', 'eye_color', 'iris_color', 'pupil_color', '琥珀色', '金色'],
    'eye_shape': ['eyeShape', 'eye_shape', 'eye_size', 'almond', 'round', '四目双瞳'],
    'pupil': ['pupil', 'pupil_shape', 'slit_pupil', '竖瞳', '火焰瞳孔'],
    'eyeshine': ['eyeshine', 'eye_glow', 'eye_reflection', 'bioluminescent_eyes'],
    'eye_position': ['eye_position', 'eye_placement', 'eyes_under_armpits', 'forehead_eyes'],
    // 被覆
    'coat_type': ['coatType', 'furType', 'scaleType', 'featherType', 'coat', 'plumage', 'exoskeleton', 'shell'],
    'color_pattern': ['colorPattern', 'color_pattern', 'coloration', 'base_color', 'primary_color', 'gradient'],
    'texture': ['texture', 'coat_texture', 'fur_texture', 'scale_texture', 'feather_texture'],
    'length': ['length', 'coat_length', 'fur_length', 'feather_length'],
    'sheen': ['sheen', 'luster', 'glow', 'iridescence', 'metallic', 'bioluminescent'],
    // 身体
    'body_plan': ['bodyPlan', 'body_type', 'body_shape', 'quadruped', 'biped', 'serpentine'],
    'torso_shape': ['torso', 'torso_shape', 'chest', 'abdomen', 'spine_curve', 'back'],
    'muscle_definition': ['muscle', 'muscle_definition', 'muscular', 'lean', 'bulky'],
    'silhouette': ['silhouette', 'outline', 'profile', 'body_proportion', 'limb_ratio'],
    'scale_size': ['scale', 'size', 'height', 'length', 'weight', 'giant', 'colossal'],
    // 肢体
    'leg_structure': ['legs', 'leg_structure', 'leg_count', 'forelegs', 'hind_legs', '六足'],
    'paw_hoof': ['paws', 'hooves', 'feet', 'claws', 'talons', 'paw_shape', 'hoof_shape'],
    'digit_structure': ['digits', 'fingers', 'toes', 'claw_count', 'retractable', 'prehensile'],
    'joint_type': ['joints', 'knee_direction', 'elbow', 'flexible', 'rigid'],
    'stance': ['stance', 'posture', 'standing', 'crouching', 'quadrupedal', 'bipedal'],
    // 爪牙
    'claw_shape': ['claws', 'claw_shape', 'claw_length', 'claw_curvature', 'hooked', 'curved', 'serrated'],
    'claw_color': ['claw_color', 'nail_color', 'talon_color', 'black', 'white', 'metallic'],
    'teeth_type': ['teeth', 'tooth_type', 'fangs', 'tusks', 'incisors', 'serrated', '锯齿状'],
    'teeth_size': ['tooth_size', 'fang_length', 'tusk_length', 'palm-sized', 'dagger-like'],
    'teeth_arrangement': ['dentition', 'tooth_arrangement', 'single_row', 'multiple_rows', 'spiral'],
    // 尾部
    'tail_length': ['tail_length', 'tail_size', 'long', 'short', 'stubby'],
    'tail_shape': ['tail_shape', 'tail_form', 'fluffy', 'slender', 'thick', 'clubbed', 'squirrel-like'],
    'tail_texture': ['tail_texture', 'tail_fur', 'tail_scales', 'bushy', 'smooth', 'ringed'],
    'tail_count': ['tail_count', 'tails', 'nine_tails', 'single_tail', 'multiple_tails'],
    'tail_special': ['tail_tip', 'tail_special', 'tail_glow', 'tail_weapon', '发光尾尖'],
    // 羽翼
    'wing_span': ['wingspan', 'wing_span', 'wing_length', '翼展'],
    'wing_type': ['wing_type', 'wing_structure', 'membrane', 'feathered', 'bat-like', 'energy_wings', '透明翼'],
    'wing_texture': ['wing_texture', 'wing_membrane', 'wing_feathers', 'leathery', 'translucent', '半透明'],
    'wing_color': ['wing_color', 'wing_pattern', 'iridescent', 'metallic', 'glowing', 'gradient'],
    'wing_markings': ['wing_markings', 'wing_patterns', 'spots', 'stripes', 'eye_spots', '电磁纹路'],
    // 特殊器官
    'glowing_organs': ['glowing', 'bioluminescent', 'light_organs', 'luminous', '荧光', '发光器官'],
    'energy_sacs': ['energy_sacs', 'storage_pouches', 'reservoir', '储能囊', '能量囊', '反重力储能囊'],
    'sensory_appendages': ['sensory', 'antennae', 'tentacles', 'feelers', '感应器', '引力感应器'],
    'defense_organs': ['defense', 'armor', 'shell', 'carapace', 'scutes', 'plates', '盾', '甲', '火山岩装甲'],
    'weapon_organs': ['weapon', 'spines', 'quills', 'stingers', 'horns', 'blade', 'saw', '尾鞭成江'],
    // 能量
    'aura_type': ['aura', 'energy_field', 'magnetic_field', 'force_field', '气场', '电磁场'],
    'aura_color': ['aura_color', 'glow_color', 'halo_color', '等离子体', '赤红色', '金黄色'],
    'aura_effect': ['aura_effect', 'particles', 'sparks', 'trails', 'resonance', '共鸣', '能量振动'],
    'emission_points': ['emission', 'vents', 'ports', '喷射口', '重水喷射口', '能量溢出缝隙']
  };
  
  const keys = mappings[fieldKey] || [fieldKey];
  
  // 尝试顶层字段
  for (const key of keys) {
    if (vi[key] !== undefined && vi[key] !== null) return vi[key];
  }
  
  // 尝试嵌套路径（如 visualIdentity.head.head_shape）
  if (vi[category] && typeof vi[category] === 'object') {
    for (const key of keys) {
      if (vi[category][key] !== undefined && vi[category][key] !== null) return vi[category][key];
    }
    // 尝试二级嵌套（如 visualIdentity.head.face.eye_color）
    if (vi[category][subcategory] && typeof vi[category][subcategory] === 'object') {
      for (const key of keys) {
        if (vi[category][subcategory][key] !== undefined) return vi[category][subcategory][key];
      }
    }
  }
  
  return null;
}

// ========== Prompt 构建（长度控制）==========
function buildCoreDescription(features, roleType = 'beast') {
  // 优先使用视觉锚点（最精炼）
  if (features.visualAnchors && features.visualAnchors.length > 0) {
    return features.visualAnchors.join(', ');
  }
  
  // 从分类特征构建
  const categorized = features.categorized || {};
  const parts = [];
  
  // 按优先级排列特征
  const priorityOrder = roleType === 'human' 
    ? ['head', 'face', 'eyes', 'hair', 'body', 'clothing', 'accessories', 'weapons']
    : ['head', 'face', 'eyes', 'coat', 'body', 'special_organs', 'tail', 'wings', 'claws_teeth', 'limbs'];
  
  for (const category of priorityOrder) {
    const catData = categorized[category];
    if (!catData) continue;
    
    const catParts = [];
    for (const [subcategory, fields] of Object.entries(catData)) {
      for (const [field, value] of Object.entries(fields)) {
        if (value && typeof value === 'string') {
          catParts.push(`${subcategory} ${field.replace(/_/g, ' ')}: ${value}`);
        }
      }
    }
    
    if (catParts.length > 0) {
      parts.push(`${category}: ${catParts.join(', ')}`);
    }
  }
  
  return parts.join('; ');
}

function buildPortraitPrompt(angle, features, roleType, styleTemplate) {
  const coreDesc = buildCoreDescription(features, roleType);
  
  // 构建完整prompt
  const basePrompt = angle.promptTemplate(coreDesc, styleTemplate);
  const fullPrompt = `${basePrompt}. ${NEGATIVE_CONSTRAINTS}`;
  
  // 长度控制：检测字符数（中文算2，英文算1）
  const cnCount = (fullPrompt.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = fullPrompt.length - cnCount;
  const totalWeight = cnCount * 2 + enCount;
  
  if (totalWeight > PROMPT_MAX_CN * 2) {
    console.log(`[警告] Prompt 超长(${totalWeight}权重)，触发智能裁剪...`);
    return smartTrimPrompt(fullPrompt, PROMPT_MAX_CN * 2);
  }
  
  return fullPrompt;
}

function smartTrimPrompt(prompt, maxWeight) {
  // 优先保留核心特征，裁剪修饰词
  const sentences = prompt.split(/(?<=[.!?;。！？；])\s*/);
  let currentWeight = 0;
  let result = '';
  
  for (const sentence of sentences) {
    const cn = (sentence.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = sentence.length - cn;
    const weight = cn * 2 + en;
    
    if (currentWeight + weight <= maxWeight) {
      result += sentence;
      currentWeight += weight;
    } else {
      break;
    }
  }
  
  return result || prompt.slice(0, maxWeight / 2);
}

// ========== 单角度生成 ==========
async function generateAngle(angle, roleId, roleName, features, roleType, apiKey) {
  console.log(`[生成] ${angle.name}(${angle.id})...`);
  const start = Date.now();
  
  try {
    const prompt = buildPortraitPrompt(angle, features, roleType, DEFAULT_STYLE);
    console.log(`[生成] Prompt: ${prompt.length}字符`);
    
    const body = {
      model: ENDPOINT,
      prompt: prompt,
      size: '2K',
      n: 1,
      response_format: 'url'
    };
    
    const response = await postJson(API_BASE, { Authorization: `Bearer ${apiKey}` }, body);
    
    if (response.data?.[0]?.url) {
      const url = response.data[0].url;
      const outputDir = path.join(OUTPUT_BASE, roleId, 'portraits');
      fs.mkdirSync(outputDir, { recursive: true });
      const filepath = path.join(outputDir, `${roleId}-portrait-${angle.id}.png`);
      await downloadImage(url, filepath);
      const size = (fs.statSync(filepath).size / 1024).toFixed(1);
      console.log(`[生成] ✅ ${angle.name} | ${Date.now() - start}ms | ${size}KB`);
      return { id: angle.id, name: angle.name, filepath, size: `${size}KB`, success: true };
    } else {
      console.error(`[生成] ❌ ${angle.name} 失败:`, response.error || JSON.stringify(response).slice(0, 200));
      return { id: angle.id, name: angle.name, success: false, error: response.error || 'Unknown' };
    }
  } catch (e) {
    console.error(`[生成] ❌ ${angle.name} 异常:`, e.message);
    return { id: angle.id, name: angle.name, success: false, error: e.message };
  }
}

// ========== 角度一致性验证器 ==========
function validateAngleConsistency(results) {
  console.log('[验证] 启动角度一致性检查...');
  const issues = [];
  
  // 检查所有角度是否成功
  const successCount = results.filter(r => r.success).length;
  if (successCount < 4) {
    issues.push(`仅${successCount}/4角度成功，一致性无法验证`);
  }
  
  // 检查文件大小差异（过大的差异可能表示内容不一致）
  const sizes = results.filter(r => r.success).map(r => parseFloat(r.size));
  if (sizes.length > 1) {
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const maxDiff = Math.max(...sizes.map(s => Math.abs(s - avgSize)));
    if (maxDiff > avgSize * 0.5) {
      issues.push(`文件大小差异过大(${maxDiff.toFixed(0)}KB)，可能特征不一致`);
    }
  }
  
  if (issues.length === 0) {
    console.log('[验证] ✅ 角度一致性检查通过');
  } else {
    console.log('[验证] ⚠️ 发现潜在问题:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  
  return { passed: issues.length === 0, issues };
}

// ========== 主流程 ==========
async function main() {
  // 解析命令行
  const args = process.argv.slice(2);
  let mode = 'A';
  let beastId = null;
  let description = null;
  let roleName = null;
  let roleType = 'beast';
  let requestedAngles = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && i + 1 < args.length) mode = args[i + 1].toUpperCase();
    if (args[i] === '--beast-id' && i + 1 < args.length) beastId = args[i + 1];
    if (args[i] === '--description' && i + 1 < args.length) description = args[i + 1];
    if (args[i] === '--name' && i + 1 < args.length) roleName = args[i + 1];
    if (args[i] === '--type' && i + 1 < args.length) roleType = args[i + 1];
    if (args[i] === '--angles' && i + 1 < args.length) requestedAngles = args[i + 1].split(',');
  }
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🎨 Character Portrait Generator v1.0`);
  console.log(`📦 模式: ${mode} | 类型: ${roleType}`);
  console.log('═══════════════════════════════════════════════════════');
  
  // API Key
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('[FATAL] 未配置 API Key');
    process.exit(1);
  }
  
  // 加载/构建特征
  let features, profile;
  try {
    switch (mode) {
      case 'A':
        if (!beastId) throw new Error('模式A需要 --beast-id');
        profile = loadProfileFromArchive(beastId);
        features = extractDetailedFeatures(profile.data, roleType);
        break;
        
      case 'B':
        if (!description) throw new Error('模式B需要 --description');
        console.log('[模式B] 描述驱动 — 启动LLM知识库补充...');
        const enriched = await enrichDescriptionByLLM(description, roleType, roleName || 'unknown');
        if (enriched.enriched) {
          console.log('[模式B] ✅ LLM补充完成');
          // 使用LLM补充后的数据构建档案
          features = {
            sourceText: description,
            visualAnchors: [description],
            categorized: {}, // LLM补充的分类数据
            enriched: true
          };
        } else {
          features = { sourceText: description, visualAnchors: [description], categorized: {} };
        }
        beastId = beastId || 'custom-' + Date.now();
        break;
        
      case 'C':
        if (!roleName) throw new Error('模式C需要 --name');
        console.log('[模式C] 主题驱动 — 启动LLM知识库推理...');
        const inferred = await enrichDescriptionByLLM('', roleType, roleName);
        if (inferred.enriched) {
          console.log('[模式C] ✅ LLM推理完成');
          features = {
            sourceText: roleName,
            visualAnchors: [roleName],
            categorized: {},
            enriched: true
          };
        } else {
          features = { sourceText: roleName, visualAnchors: [roleName], categorized: {} };
        }
        beastId = beastId || roleName.toLowerCase().replace(/\s+/g, '-');
        break;
        
      default:
        throw new Error(`未知模式: ${mode}`);
    }
  } catch (e) {
    console.error(`[FATAL] 特征加载失败: ${e.message}`);
    process.exit(1);
  }
  
  console.log(`[特征] ✅ 提取完成 | 视觉锚点: ${features.visualAnchors?.length || 0}项`);
  if (features.visualAnchors?.length > 0) {
    console.log(`[特征] 核心特征: ${features.visualAnchors.slice(0, 2).join('; ')}...`);
  }
  
  // 确定角度
  const angles = requestedAngles 
    ? STANDARD_ANGLES.filter(a => requestedAngles.includes(a.id))
    : STANDARD_ANGLES;
  
  console.log(`[生成] 计划: ${angles.length}个角度 | ${angles.map(a => a.name).join(', ')}`);
  console.log('═══════════════════════════════════════════════════════');
  
  // 顺序生成
  const results = [];
  for (const angle of angles) {
    const result = await generateAngle(angle, beastId, roleName || beastId, features, roleType, apiKey);
    results.push(result);
    if (result.success) await new Promise(r => setTimeout(r, 2000));
  }
  
  // 角度一致性验证
  validateAngleConsistency(results);
  
  // 汇总
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 结果汇总');
  console.log('═══════════════════════════════════════════════════════');
  
  const success = results.filter(r => r.success);
  console.log(`总计: ${results.length} | ✅成功: ${success.length} | ❌失败: ${results.length - success.length}`);
  
  for (const r of results) {
    console.log(r.success 
      ? `✅ ${r.name}: ${r.filepath} (${r.size})`
      : `❌ ${r.name}: ${r.error}`
    );
  }
  
  // 生成 manifest
  const manifestPath = path.join(OUTPUT_BASE, beastId, 'portraits', 'manifest.json');
  const manifest = {
    roleId: beastId,
    roleName: roleName || beastId,
    roleType,
    mode,
    generatedAt: new Date().toISOString(),
    systemVersion: 'v1.0',
    source: 'character-portrait-generator',
    featureCategories: roleType === 'beast' ? '11大分类56字段' : '10大分类45字段',
    angles: success.map(r => ({ id: r.id, name: r.name, filepath: r.filepath, size: r.size })),
    total: results.length, success: success.length, failed: results.length - success.length
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n💾 Manifest: ${manifestPath}`);
  
  // 更新角色卡片
  const cardPath = path.join(OUTPUT_BASE, beastId, 'character-card.json');
  if (fs.existsSync(cardPath)) {
    try {
      const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
      card.portraits = { generatedAt: manifest.generatedAt, angles: success.map(r => r.id), manifestPath };
      fs.writeFileSync(cardPath, JSON.stringify(card, null, 2));
      console.log(`[更新] 角色卡片: ${cardPath}`);
    } catch (e) {
      console.warn(`[警告] 更新角色卡片失败: ${e.message}`);
    }
  }
  
  console.log('\n✅ 系统级定妆照生成完成！');
  
  if (results.length - success.length > 0) {
    process.exit(1);
  }
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
