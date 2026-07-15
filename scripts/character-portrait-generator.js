#!/usr/bin/env node
/**
 * ============================================================
 * Character Portrait Generator v3.0 — 系统级通用定妆照生成模块
 * ============================================================
 * 通用模块，不绑定任何具体角色或case
 * 
 * v3.0 核心升级（基于v4.9-Peng经验系统级吸收）：
 * - 8角度定妆照：正面全身/侧面全身/背面全身/45度半身/面部特写/动作奔跑/动作坐姿/手部特写
 * - 恐怖谷二创系统：残缺人体异兽自动神话化重塑（刑天类）
 * - 武器标准化系统：WEAPON CONSISTENCY LOCK + 精确尺寸锁定 + 握持方向锁定
 * - 三层一致性约束：解剖锁定 + 美学引导 + 形态锁定
 * - Prompt场景叙事化：Nirath环境背景 + AgentX视角叙事，替代纯白背景
 * - 动态材质提取：移除硬编码natural fur texture，从档案texture字段动态提取
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
const OUTPUT_BASE = path.join(__dirname, '..', 'characters');

// ========== 核心常量 ==========
const PROMPT_MAX_CN = 300;  // Seedream: 300汉字上限
const PROMPT_MAX_EN = 600;  // 或600英文单词

// ============================================================
// v3.0: 8角度定妆照定义（基于v4.9-Peng经验吸收）
// 场景叙事化Prompt：Nirath环境 + AgentX视角，替代纯白背景
// ============================================================
const DEFAULT_STYLE = '超写实CG渲染，Unreal Engine 5，Octane渲染，8K画质，电影级光照，体积光，次表面散射，极其精细材质，3D立体体积感，照片级真实感，微观纹理清晰可见';

// v3.0: 异兽专用基础风格（自然质感版，消除塑料感）
const BEAST_BASE_STYLE = 'photorealistic wildlife photography, national geographic style, 8K texture detail, natural rough organic textures, matte finish, no gloss, no plastic shine, no synthetic smoothness, no CGI texture, natural lighting, pure white background';

// v3.0: 三层一致性约束系统（所有角色受益）
const ANATOMICAL_LOCK = 'STRICT anatomical consistency across all views: body structure must remain IDENTICAL in every shot, same number of limbs same proportions same body shape, NO adding or removing body parts between angles, NO morphological drift, NO random protrusions or growths';
const AESTHETIC_GUIDE = 'MAJESTIC sacred elegant divine aesthetic, harmonious rounded smooth forms, warm inviting gentle beauty, cosmic ritual grandeur, awe-inspiring transcendence, ABSOLUTELY NO horror NO disgust NO creepy elements NO sharp spikes NO barbs NO thorns, soft organic curves, pleasant approachable presence, gentle giant vibe, wholesome mythological creature, NO vampiric features NO grotesque textures NO diseased appearance, clean smooth skin surface';
const MORPHOLOGY_LOCK = 'uniform smooth rounded body contour locked to original text description, consistent body volume and silhouette across all angles, body shape precisely fixed no variation between shots, proportions permanently locked, smooth organic rounded surfaces NO sharp protrusions NO spiky elements NO bulbous growths NO tumor-like masses, clean elegant silhouette';

// v3.0: 异兽负面约束（增强版，禁止真人脸/人种不一致/科技风）
const BEAST_NEGATIVE_CONSTRAINTS = 'NO human characters, NO child, NO boy, NO girl, NO person, NO realistic human face, NO human portrait, NO different face, NO changing face, NO Asian face, NO Caucasian face, NO human skin texture, NO xiaoG, NO technology, NO sci-fi, NO modern elements, NO mechanical parts, NO robots, NO cyberpunk, NO metal armor, NO electronic devices, NO glowing artificial lights, NO plastic, NO synthetic materials, NO tech claws, NO mechanical claws, NO robotic joints, NO hydraulic limbs, NO glowing circuits, NO titanium, NO chrome, NO steel claws, NO cybernetic implants';

// v3.0: 统一材质约束（防止部分铠甲+部分裸露皮肤/羊毛）
const UNIFORM_MATERIAL_CONSTRAINT = 'full body uniformly covered in specified material, no exposed skin, no bare flesh, no mixed textures, no fur patches, no wool patches, consistent surface texture across entire body, no partially armored areas';

// v3.0: 面部特征强制约束（增强一致性，禁止真人照片感）
const FACE_CONSISTENCY_LOCK = 'SAME face across all angles, IDENTICAL facial features in every shot, consistent face structure, same eyes same nose same mouth, no face variation between views, face locked to reference image, NO realistic human portrait, NO photo-realistic human face, NO different ethnicity, NO changing expression, strictly follow mythological facial description';

// v3.0: 恐怖谷异兽二创系统（残缺人体异兽自动神话化重塑）
const UNCANNY_VALLEY_BEASTS = {
  '刑天': {
    originalFeatures: '无头巨人+以乳为目+以脐为口+操干戚以舞',
    creativeRemix: {
      bodyMaterial: '暗金色晶化金属与黑曜石交织的神话躯体，表面有类似火山玻璃的自然熔岩纹理，非人类皮肤，金属与晶体融合的超自然材质，带有微妙的生物发光脉络在表层下流动',
      headReplacement: '颈部以上不是平切伤口，而是一团永恒的赤金色能量漩涡缓缓旋转，漩涡中心有星云般的粒子流转，如同神性光环在呼吸',
      eyesRemix: '胸部镶嵌两颗发光的琥珀色能量核心，核心内部有熔岩般的金色光芒流动，如同神之眼眸凝视前方，边缘有微弱的光晕溢出',
      mouthRemix: '腹部是自然的能量裂隙，裂隙中透出温暖的橙红色光芒，如同神谕之口在呼吸，裂隙边缘有细腻的光脉纹理向四周蔓延',
      weaponRemix: '左手持巨大的矩形上古神盾（干），盾为竖直长方形平板状，宽约肩宽，高约从胸至膝，暗金晶化金属质地，边缘平直无弧度，表面仅有自然的熔岩脉络纹理，无装饰图案；右手握单刃短柄战斧（戚），斧刃只在头部一侧有弯曲锋利的半月形刃口，另一侧为平直钝背（顶部有小锤头结构），斧柄短粗约半臂长，整体呈简洁有力的上古武器风格，绝非西方骑士风格',
      overallVibe: '远古战神神像，威严庄重，神圣不可侵犯，完全没有人类恐怖感，如同远古神殿中苏醒的战神雕像，材质介于金属与晶体之间的超自然存在',
      horrorElimination: 'ABSOLUTELY NO human skin, NO human flesh, NO bloody wounds, NO decapitated neck stump, NO creepy body horror, NO uncanny valley, NO realistic human body parts, NO traditional Chinese cultural patterns, NO bronze ritual patterns, NO Chinese calligraphy or seal script, NO dragon patterns, NO phoenix patterns, NO Chinese knots, 纯粹神话艺术造型，超自然材质',
      weaponConsistency: 'WEAPON CONSISTENCY LOCK: 盾必须是同一竖直长方形平板，尺寸形状在所有角度中保持100%一致；斧必须是同一单刃短柄战斧（单刃侧始终朝向画面右侧或外侧），尺寸形状在所有角度中保持100%一致；左手始终握盾，右手始终持斧，不得换手；武器材质纹理必须在所有视图中完全匹配，不得变形或改变'
    }
  }
};

// v3.0: 敏感异兽处理（避免平台内容审核拦截）
const SENSITIVE_BEASTS = ['刑天'];
const SENSITIVE_BEAST_COMPLIANCE = 'CG神话艺术创作，古典雕塑风格，无真实暴力，无血腥，无恐怖，数字艺术作品，非真实人物，神话角色设计稿';

// v3.0: 8角度定义（扩展自4角度）
// 每个角度包含：场景叙事前缀 + 角度描述 + 核心特征 + 一致性约束
function buildAnglePrompts(beastDesc, artistPerspective, beastBg, consistencyLock, 
                            negativeConstraints, sensitiveCompliance, uncannyElimination, 
                            weaponConsistency, name, originalText, uniformMaterial, faceLock) {
  // v3.0-fix: 基于面部科学解析手册优化Prompt结构
  // 优先级：真人脸禁止 > 塑料禁止 > 陶瓷禁止 > 翅膀禁止 > 物种锚定 > 面部特征 > 风格
  const criticalNegative = 'NO realistic human face, NO human portrait, NO different face, NO plastic, NO ceramic, NO tech, NO smooth surface, NO wings';
  
  // 基于面部科学解析手册，添加面部特征描述
  const facialFeatures = 'thick skin texture, not human skin, monstrous visage, conical ivory-white fangs protruding beyond lips, massive canine teeth exposed, wide gape, ravenous expression, thick lips, powerful jaw muscles bulging';
  
  const basePrompt = `${beastDesc}, ${facialFeatures}, national geographic wildlife photography, 8K texture, 2K`;
  
  const shots = [
    {
      suffix: '正面全身',
      angle: 'front_fullbody',
      prompt: `${criticalNegative}, pure white background, studio lighting, full body front view + 3/4 side angle for depth, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '侧面全身',
      angle: 'side_profile',
      prompt: `${criticalNegative}, pure white background, studio lighting, full body side profile, 90-degree silhouette, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '背面全身',
      angle: 'back_fullbody',
      prompt: `${criticalNegative}, pure white background, studio lighting, full body back view, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '45度半身',
      angle: 'three_quarter',
      prompt: `${criticalNegative}, pure white background, studio lighting, three-quarter portrait, 45-degree angle, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '面部特写',
      angle: 'face_closeup',
      prompt: `${criticalNegative}, SAME face as reference, pure white background, studio lighting, extreme close-up face, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '动作奔跑',
      angle: 'action_running',
      prompt: `${criticalNegative}, pure white background, studio lighting, dynamic running pose, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '动作坐姿',
      angle: 'action_sitting',
      prompt: `${criticalNegative}, pure white background, studio lighting, natural resting pose, ${basePrompt}, ${faceLock}`
    },
    {
      suffix: '肢体特写',
      angle: 'hand_detail',
      prompt: `${criticalNegative}, pure white background, studio lighting, extreme close-up claws and limbs, ${basePrompt}, ${faceLock}`
    }
  ];
  
  return shots;
}

// v3.0: 8角度Prompt定义（精简版，确保在300汉字/600英文单词限制内）
// 负面约束前置，确保不被截断
const STANDARD_ANGLES_BEAST = [
  {
    id: 'front_fullbody',
    name: '正面全身',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, full body front view, ${speciesAnchor}, ${coreDesc}, realistic proportions, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'side_profile',
    name: '侧面全身',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, full body side profile, 90-degree silhouette, ${speciesAnchor}, ${coreDesc}, realistic proportions, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'back_fullbody',
    name: '背面全身',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, full body back view, ${speciesAnchor}, ${coreDesc}, realistic proportions, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'three_quarter',
    name: '45度半身',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, three-quarter portrait, 45-degree angle, ${speciesAnchor}, ${coreDesc}, realistic proportions, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'face_closeup',
    name: '面部特写',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO CGI, pure white background, studio lighting, extreme close-up face, ${speciesAnchor}, ${coreDesc}, focus on facial features, realistic eye size, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'action_running',
    name: '动作奔跑',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, dynamic running pose, ${speciesAnchor}, ${coreDesc}, muscular movement, natural motion, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'action_sitting',
    name: '动作坐姿',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO wings, NO CGI, pure white background, studio lighting, natural resting pose, ${speciesAnchor}, ${coreDesc}, relaxed posture, national geographic wildlife photography, 8K texture, 2K resolution`
  },
  {
    id: 'hand_detail',
    name: '肢体特写',
    promptTemplate: (coreDesc, style, speciesAnchor) =>
      `NO plastic, NO metal, NO tech, NO smooth surface, NO CGI, pure white background, studio lighting, extreme close-up claws and limbs, ${speciesAnchor}, ${coreDesc}, detailed texture, natural organic claws, national geographic wildlife photography, 8K texture, 2K resolution`
  }
];

// v3.0: 人类角色8角度（基于v4.9-Peng经验）
function buildHumanAnglePrompts(name, species, features, signature, originalText) {
  const baseStyle = '超写实真人风格，摄影级真实感，接近真人比例，非CG渲染，非动画，非皮克斯风格，非卡通化';
  const chineseFeatures = '中国人，东亚人特征，黑色短发，深棕色杏仁眼，黄皮肤，单眼皮或内双，圆脸方下巴，无雀斑，无欧美特征，无深眼窝，无高鼻梁';
  const childFeatures = '8岁男孩，儿童面部比例，大眼睛占面部比例较大，真实皮肤纹理有自然的毛孔和细微纹理，健康的东亚儿童肤色，略带婴儿肥，天真无邪的表情，自然抓拍感';
  const negativeConstraints = '不要雀斑，不要痘痘，不要西方特征，不要深眼窝，不要高鼻梁，不要卷发，不要金发，不要蓝眼睛，不要红眼睛，不要黄眼睛，不要发光眼睛，不要非自然瞳孔颜色，自然黑色瞳孔，眼睛干净，瞳孔中可有对面景物的微弱倒影';
  const clothing = '穿亮黄色短款户外冲锋衣，及腰长度，拉链微开，深蓝色直筒牛仔裤，白色低帮运动鞋，干净简洁';
  const accessories = '脖子挂着黄铜指南针，皮革挂绳垂到胸口位置，指南针为圆形黄铜外壳，表盘清晰可见；腰间右侧挂着军绿色圆柱形水壶，带有帆布保护套和背带扣；冲锋衣左胸口袋里插着半截黑色LED手电筒，手电筒头部露出口袋外，带有短挂绳';
  const bg = '纯黑背景，工作室布光，均匀照明，无环境干扰';
  const fullDesc = `${name}，${species}，${features}，${signature}，${childFeatures}，${chineseFeatures}，${clothing}`;
  
  const shots = [
    {
      suffix: '正面全身',
      angle: 'front_fullbody',
      prompt: `正面全身站立姿态，${fullDesc}，${baseStyle}，${bg}，全身完整可见，正面朝向镜头，双脚站立，双臂自然下垂，真实人体比例，服装细节清晰，光影立体感强，360度无死角展示正面特征，${negativeConstraints}`
    },
    {
      suffix: '侧面全身',
      angle: 'side_profile',
      prompt: `侧面全身轮廓，${fullDesc}，${baseStyle}，${bg}，90度侧面展示，完整侧面轮廓可见，体型比例清晰，从头部到脚部完整展示，侧面线条流畅，真实人体比例，${negativeConstraints}`
    },
    {
      suffix: '背面全身',
      angle: 'back_fullbody',
      prompt: `背面全身姿态，${fullDesc}，${baseStyle}，${bg}，背面朝向镜头，背部特征完整可见，后脑勺发型清晰，背部纹理真实，从后方展示整体体型，真实人体比例，${negativeConstraints}`
    },
    {
      suffix: '45度半身',
      angle: 'three_quarter',
      prompt: `45度角半身像，${fullDesc}，${baseStyle}，${bg}，经典肖像角度，腰部以上，面部和上半身立体展示，自然光影，真实皮肤纹理，略带自然肌理，${negativeConstraints}`
    },
    {
      suffix: '面部特写',
      angle: 'face_closeup',
      prompt: `面部特写，${fullDesc}，${baseStyle}，${bg}，面部占画面主体，五官清晰，眼神明亮有神，表情天真好奇，东亚儿童面部特征，真实皮肤有自然纹理和毛孔，健康的肤色，自然抓拍瞬间，柔和自然光影，发丝有自然杂乱感，${negativeConstraints}`
    },
    {
      suffix: '动作奔跑',
      angle: 'action_running',
      prompt: `自然奔跑姿态，${fullDesc}，${baseStyle}，${bg}，双腿自然奔跑，身体轻微前倾，真实儿童运动姿态，动态自然，无夸张变形，真实人体比例，${negativeConstraints}`
    },
    {
      suffix: '动作坐姿',
      angle: 'action_sitting',
      prompt: `自然坐姿，${fullDesc}，${baseStyle}，${bg}，盘腿坐或蹲坐，真实儿童坐姿，放松自然，真实人体比例，无夸张变形，${negativeConstraints}`
    },
    {
      suffix: '手部特写',
      angle: 'hand_detail',
      prompt: `手部极端特写，${fullDesc}，${baseStyle}，${bg}，儿童手部占画面主体，皮肤光滑细腻，指甲干净，真实儿童手部比例，无成人化特征，${negativeConstraints}`
    }
  ];
  
  if (originalText) {
    shots.forEach(shot => {
      shot.prompt += `，严格忠于《山海经》原著描述：${originalText}，不得偏离原著特征`;
    });
  }
  
  return shots;
}

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

// ========== 通用隐喻消毒与物种锚定系统 ==========
// 问题模式：图像模型将"[动物名]+[身体部位]"理解为物种定义（如"松鼠尾"→松鼠）
// 通用修复：检测隐喻模式 → 替换为抽象属性 → 添加负面约束防止物种漂移

const METAPHOR_PATTERNS = {
  // [模式] => [消毒后的抽象描述, 负面约束关键词]
  '松鼠尾': ['bushy tail', 'squirrel'],
  '松鼠': ['fluffy', 'squirrel'],
  '如松鼠': ['fluffy', 'squirrel'],
  '蓬松松鼠尾': ['thick fluffy tail', 'squirrel'],
  '鹿角': ['branched horns', 'deer'],
  '如鹿': ['graceful', 'deer'],
  '蛇身': ['serpentine body', 'snake'],
  '如蛇': ['elongated', 'snake'],
  '鹰爪': ['sharp talons', 'eagle'],
  '如鹰': ['predatory', 'eagle'],
  '鱼鳍': ['fin-like appendage', 'fish'],
  '如鱼': ['aquatic', 'fish'],
  '龟甲': ['shell-like carapace', 'turtle'],
  '如龟': ['armored', 'turtle'],
  '虎纹': ['striped pattern', 'tiger'],
  '如虎': ['fierce', 'tiger'],
  '狮鬃': ['mane-like fur', 'lion'],
  '如狮': ['majestic', 'lion'],
  '狼牙': ['fanged teeth', 'wolf'],
  '如狼': ['feral', 'wolf'],
  '兔耳': ['long ears', 'rabbit'],
  '如兔': ['alert', 'rabbit'],
  '熊掌': ['heavy paws', 'bear'],
  '如熊': ['massive', 'bear'],
  '猴脸': ['simian face', 'monkey'],
  '如猴': ['agile', 'monkey']
};

function sanitizeVisualAnchors(anchors) {
  if (!anchors || anchors.length === 0) return { sanitized: [], negativeSpecies: [] };
  
  const sanitized = [];
  const negativeSpecies = new Set();
  
  for (const anchor of anchors) {
    let cleaned = anchor;
    let trapped = false;
    
    for (const [pattern, [replacement, negative]] of Object.entries(METAPHOR_PATTERNS)) {
      if (cleaned.includes(pattern)) {
        cleaned = cleaned.replace(new RegExp(pattern, 'g'), replacement);
        negativeSpecies.add(negative);
        trapped = true;
        console.log(`[消毒] 隐喻陷阱: "${pattern}" → "${replacement}" (负面约束: ${negative})`);
      }
    }
    
    sanitized.push(cleaned);
  }
  
  return { sanitized, negativeSpecies: Array.from(negativeSpecies) };
}

function extractSpeciesIdentity(features, roleType) {
  const taxonomy = features.profile?.taxonomy;
  const hybridType = features.profile?.hybridType;
  const visualIdentity = features.profile?.visualIdentity;
  
  if (hybridType) return hybridType;
  if (taxonomy) return taxonomy;
  
  const bodyPlan = visualIdentity?.bodyPlan || '';
  if (bodyPlan.includes('狐') && bodyPlan.includes('猫')) return 'fox-cat hybrid mammal';
  if (bodyPlan.includes('龙')) return 'dragon-like creature';
  if (bodyPlan.includes('虎')) return 'tiger-like beast';
  if (bodyPlan.includes('鸟') || bodyPlan.includes('凰')) return 'avian creature';
  
  return roleType === 'beast' ? 'mythical creature' : 'human character';
}

function buildNegativeConstraints(detectedSpecies) {
  const constraints = ['no helmet', 'no armor', 'no suit', 'no plastic', 'no toy', 
                       'no robot', 'no metallic', 'no cartoon', 'no anime', 
                       'no background', 'no environment', 'no sky', 'no moon'];
  
  for (const species of detectedSpecies) {
    constraints.push(`no ${species}`);
  }
  
  return constraints.join(', ');
}

function extractSubjectDefinition(features, roleType) {
  // === v3.0: 主体优先架构升级 ===
  // 增强：支持战神/巨人/无头等特殊物种锚定
  // 原则：纯物理描述，不用抽象词，不用比喻词
  
  const bodyPlan = features.profile?.visualIdentity?.bodyPlan || '';
  const scale = features.profile?.visualIdentity?.scale || '';
  const name = features.profile?.name?.chinese || features.profile?.id || '';
  
  // v3.0: 恐怖谷检测 - 残缺人体异兽需要特殊锚定
  const isUncannyValley = isUncannyValleyBeast(name);
  if (isUncannyValley) {
    const remix = getCreativeRemix(name);
    if (remix) {
      return `headless giant warrior deity, ${remix.bodyMaterial}, energy vortex instead of head`;
    }
  }
  
  // v3.0: 战神/巨人检测
  const isWarrior = bodyPlan.includes('战神') || bodyPlan.includes('战士') || bodyPlan.includes('巨人') || 
                    name.includes('刑天') || name.includes('蚩尤') || name.includes('共工');
  if (isWarrior) {
    let warriorDesc = 'giant warrior body structure';
    if (bodyPlan.includes('无头') || bodyPlan.includes('没头')) {
      warriorDesc = 'headless giant warrior, energy vortex at neck';
    }
    if (scale.includes('80米') || scale.includes('100米') || scale.includes('巨大') || scale.includes('大型')) {
      warriorDesc = `massive colossal ${warriorDesc}`;
    }
    return warriorDesc;
  }
  
  // 体型
  let sizeDesc = 'medium-sized';
  if (scale.includes('30米') || scale.includes('巨大') || scale.includes('大型') || scale.includes('80米') || scale.includes('100米')) sizeDesc = 'massive colossal';
  else if (scale.includes('小') || scale.includes('家猫') || scale.includes('1米')) sizeDesc = 'small';
  else if (scale.includes('2米') || scale.includes('中型') || scale.includes('中等')) sizeDesc = 'medium-sized';
  
  // 骨架类型（纯物理，不指定物种）
  let skeleton = 'quadruped mammal body structure';
  if (bodyPlan.includes('羊身')) {
    // v3.0-fix: 基于面部科学解析手册，羊身人面 = 混合面型(人面+兽身)，非真人照片
    skeleton = 'quadruped beast, sheep body, chimeric anthropoid face, NOT realistic human portrait, mythological facial features, thick skin texture, monstrous visage, not a real person';
  } else if (bodyPlan.includes('人') && bodyPlan.includes('兽')) {
    skeleton = 'hybrid humanoid-animal body structure';
  } else if (bodyPlan.includes('人') || bodyPlan.includes('人身') || bodyPlan.includes('人面')) {
    if (isWarrior) {
      skeleton = 'giant humanoid warrior body structure';
    } else {
      skeleton = 'humanoid body structure';
    }
  } else if (bodyPlan.includes('鸟') || bodyPlan.includes('凰') || bodyPlan.includes('翼')) {
    skeleton = 'avian body structure with wings';
  } else if (bodyPlan.includes('蛇') || bodyPlan.includes('龙')) {
    skeleton = 'serpentine reptilian body structure';
  }
  
  // 身体颜色（从bodyPlan或colorPalette提取）
  let bodyColor = '';
  const colorPalette = features.profile?.visualIdentity?.colorPalette || [];
  const primaryColor = colorPalette[0] || '';
  
  // v3.0: 先从colorPalette提取颜色
  if (primaryColor) {
    const colorMap = {
      '灰褐': 'grey-brown', '灰白': 'grey-white', '灰黑': 'grey-black', '深灰黑': 'dark grey-black',
      '白色': 'white', '白': 'white', '黑色': 'black', '黑': 'black', '深黑': 'deep black',
      '赤色': 'red', '赤': 'red', '红色': 'red', '红': 'red',
      '橙色': 'orange', '橙': 'orange', '黄色': 'yellow', '黄': 'yellow', '硫磺黄': 'sulfur-yellow',
      '绿色': 'green', '绿': 'green', '青色': 'cyan', '青': 'cyan',
      '蓝色': 'blue', '蓝': 'blue', '紫色': 'purple', '紫': 'purple',
      '褐色': 'brown', '棕色': 'brown', '褐': 'brown',
      '深紫灰': 'dark purple-grey', '暗金': 'dark gold', '晶化金属': 'crystalline metallic'
    };
    for (const [cn, en] of Object.entries(colorMap)) {
      if (primaryColor.includes(cn)) { bodyColor = en; break; }
    }
  }
  
  // 如果从colorPalette没提取到，再从bodyPlan提取
  if (!bodyColor) {
    const colorMatch = bodyPlan.match(/([灰白黑赤红橙黄绿青蓝紫][褐色]*)毛发|([灰白黑赤红橙黄绿青蓝紫][褐色]*)身体|([灰白黑赤红橙黄绿青蓝紫][褐色]*)全身/);
    if (colorMatch) {
      const color = colorMatch[1] || colorMatch[2] || colorMatch[3];
      const colorMap = {
        '灰褐': 'grey-brown', '灰白': 'grey-white', '灰黑': 'grey-black',
        '白色': 'white', '白': 'white', '黑色': 'black', '黑': 'black',
        '赤色': 'red', '赤': 'red', '红色': 'red', '红': 'red',
        '橙色': 'orange', '橙': 'orange', '黄色': 'yellow', '黄': 'yellow',
        '绿色': 'green', '绿': 'green', '青色': 'cyan', '青': 'cyan',
        '蓝色': 'blue', '蓝': 'blue', '紫色': 'purple', '紫': 'purple',
        '褐色': 'brown', '棕色': 'brown', '褐': 'brown'
      };
      bodyColor = colorMap[color] || 'grey';
    }
  }
  
  // v3.0: 材质提取（科学级材质描述，基于SKILL.md表面材质分类学）
  // 关键：使用科学术语，避免模糊词汇，四维度描述（温度+质地+纹理+湿度）
  let texture = '';
  const textureDesc = features.profile?.visualIdentity?.texture || '';
  if (textureDesc.includes('疤痕')) texture = 'battle-scarred thick skin, rough leather-like texture';
  else if (textureDesc.includes('鳞片')) texture = 'keratinous scales, overlapping tile-like arrangement, smooth when stroked forward, rough backward';
  else if (textureDesc.includes('羽毛')) texture = 'feathered body, contour feathers with barbed hooks, downy underlayer for insulation';
  else if (textureDesc.includes('火山岩') || textureDesc.includes('火山')) texture = 'embedded osteoderm plates, dark grey-black dermal bone armor, surface covered with thin keratin layer, rough lava-like texture with cooling cracks, cool to touch, hard as armor yet slightly flexible at joints, not ceramic not man-made';
  else if (textureDesc.includes('装甲') || textureDesc.includes('陶瓷')) texture = 'natural armor plating, organic protective structure, not ceramic not man-made';
  else if (textureDesc.includes('晶体') || textureDesc.includes('晶化')) texture = 'crystalline mineral deposit on skin surface, natural geological formation';
  else if (textureDesc.includes('金属')) texture = 'metallic luster from mineral deposits, aged patina, organic origin';
  else if (textureDesc.includes('毛发') || textureDesc.includes('毛皮')) texture = 'thick fur coat, outer guard hairs coarse and directional, inner underfur dense and soft';
  else if (bodyPlan.includes('毛') || bodyPlan.includes('毛发')) texture = 'thick fur coat, outer guard hairs coarse and directional, inner underfur dense and soft';
  
  // v3.0-fix: 如果没有任何texture匹配，不设默认texture
  if (!texture && bodyPlan.includes('毛')) {
    texture = 'thick fur coat, outer guard hairs coarse and directional, inner underfur dense and soft';
  }
  
  let result = `${sizeDesc} ${skeleton}`;
  if (bodyColor) result += `, ${bodyColor} body`;
  if (texture) result += `, ${texture}`;
  
  return result;
}

function buildSignatureMarks(features, roleType) {
  // === 从signatureFeatures提取英文视觉指令 ===
  // 关键：不用中文描述性语言（AI读不懂"三纵纹白头盔"）
  // 用AI能理解的物理指令（"pure white head, three vertical dark stripes"）
  
  const signatureFeatures = features.profile?.signatureFeatures || [];
  const marks = [];
  
  for (const sf of signatureFeatures.slice(0, 2)) {
    let desc = typeof sf === 'string' ? sf : (sf.description || sf.name || '');
    const translations = [];
    
    // === 巨口 === v3.0-fix: 基于面部科学解析手册，精确描述饕餮面部特征
    if (desc.includes('巨口') || desc.includes('大嘴') || desc.includes('口占') || desc.includes('口占面部')) {
      translations.push('gigantic mouth, two-thirds of face, massive jaws, wide gape beyond cranial width');
    }
    if (desc.includes('永远饥饿') || desc.includes('永远张开') || desc.includes('饥饿')) {
      translations.push('perpetually hungry, mouth always open, ravenous expression');
    }
    
    // === 眼睛位置 === v3.0-fix: 基于面部科学解析手册
    if (desc.includes('腋下') || desc.includes('眼在') || desc.includes('双眼生于')) {
      translations.push('eyes located under armpits, eyes positioned below arms');
    }
    if (desc.includes('硫磺黄') || desc.includes('硫磺色')) {
      translations.push('sulfur-yellow eyes');
    }
    
    // === 火山岩/装甲 === v3.0-fix: 基于面部科学解析手册
    if (desc.includes('火山岩') || desc.includes('火山') || desc.includes('活火山')) {
      translations.push('volcanic rock armor');
    }
    if (desc.includes('装甲') || desc.includes('铠甲') || desc.includes('覆盖全身')) {
      translations.push('natural armor covering body');
    }
    
    // === 虎齿 === v3.0-fix: 基于面部科学解析手册新增
    if (desc.includes('虎齿') || desc.includes('虎牙') || desc.includes('獠牙')) {
      translations.push('massive canine teeth protruding beyond lip line, conical ivory-white fangs, exposed saber-like teeth');
    }
    
    // === 面部皮肤 === v3.0-fix: 基于面部科学解析手册
    if (desc.includes('人面') || desc.includes('人脸')) {
      translations.push('humanoid face but monstrous visage, thick skin texture, not realistic human portrait, mythological facial structure');
    }
    if (desc.includes('白头') || desc.includes('白色头部') || desc.includes('白头盔') || desc.includes('白 head')) {
      translations.push('pure white head');
    }
    if (desc.includes('三纵纹') || desc.includes('三条') || desc.includes('三条纹') || desc.includes('白纹') || desc.includes('条纹')) {
      translations.push('three bold vertical dark stripes on forehead');
    }
    if (desc.includes('人面') || desc.includes('人脸')) {
      translations.push('human-like face');
    }
    
    // === 尾巴 ===
    if (desc.includes('蓬松') || desc.includes('松鼠') || desc.includes('bushy') || desc.includes('fluffy')) {
      translations.push('unusually large fluffy tail');
    }
    if (desc.includes('发光') || desc.includes('荧光') || desc.includes('glowing')) {
      translations.push('glowing tip');
    }
    
    // === 眼睛 ===
    if (desc.includes('琥珀')) {
      translations.push('amber eyes');
    }
    if (desc.includes('金眼') || desc.includes('金色')) {
      translations.push('golden eyes');
    }
    
    // === 耳朵 ===
    if (desc.includes('耳朵') || desc.includes('耳')) {
      translations.push('pointed ears');
    }
    if (desc.includes('角') || desc.includes('鹿角')) {
      translations.push('antlers');
    }
    
    // === 武器/装备 === v3.0: 新增武器系统识别
    if (desc.includes('干') || desc.includes('盾') || desc.includes('盾牌') || desc.includes('神盾')) {
      translations.push('rectangular ancient divine shield in left hand, vertical flat tablet shape');
    }
    if (desc.includes('戚') || desc.includes('斧') || desc.includes('战斧') || desc.includes('巨斧')) {
      translations.push('single-edge short-handle battle axe in right hand, curved blade on one side');
    }
    if (desc.includes('武器') || desc.includes('装备') || desc.includes('持')) {
      translations.push('holding ancient weapons');
    }
    
    // === 特殊器官 === v3.0: 增强无头/能量涡流识别
    if (desc.includes('无头') || desc.includes('没头') || desc.includes('断头') || desc.includes('能量涡流') || desc.includes('能量漩涡')) {
      translations.push('headless, eternal energy vortex rotating at neck position');
    }
    if (desc.includes('以乳为目') || desc.includes('乳为目') || desc.includes('胸口眼') || desc.includes('能量核心')) {
      translations.push('glowing amber energy cores embedded in chest as eyes');
    }
    if (desc.includes('以脐为口') || desc.includes('脐为口') || desc.includes('腹部口') || desc.includes('能量裂隙')) {
      translations.push('energy fissure in abdomen functioning as mouth');
    }
    
    // === 特殊器官 ===
    if (desc.includes('翅膀') || desc.includes('翼')) {
      translations.push('wings');
    }
    if (desc.includes('鳞')) {
      translations.push('scales');
    }
    if (desc.includes('爪')) {
      translations.push('sharp claws');
    }
    
    if (translations.length > 0) {
      marks.push(translations.join(', '));
    }
  }
  
  return marks.slice(0, 2).join(', ');
}

function buildPhysicalTraits(features) {
  // 补充体征（从colorPalette和bodyPlan提取英文描述）
  const bodyPlan = features.profile?.visualIdentity?.bodyPlan || '';
  const colorPalette = features.profile?.visualIdentity?.colorPalette || [];
  let traits = [];
  
  // 从colorPalette提取第二颜色（通常是眼睛/爪子等特征色）
  if (colorPalette.length > 1) {
    const secondColor = colorPalette[1];
    if (secondColor.includes('琥珀')) traits.push('amber eyes');
    if (secondColor.includes('金')) traits.push('golden eyes');
    if (secondColor.includes('银')) traits.push('silver claws');
    if (secondColor.includes('白')) traits.push('white markings');
  }
  
  // 从bodyPlan提取体型特征
  if (bodyPlan.includes('强壮') || bodyPlan.includes('有力')) traits.push('muscular build');
  if (bodyPlan.includes('敏捷') || bodyPlan.includes('灵活')) traits.push('agile posture');
  
  // 耳朵（如果signatureMarks没覆盖）
  if (bodyPlan.includes('耳朵') || bodyPlan.includes('耳')) {
    const hasEarMark = features.profile?.signatureFeatures?.some(sf => {
      const desc = typeof sf === 'string' ? sf : (sf.description || '');
      return desc.includes('耳朵') || desc.includes('耳');
    });
    if (!hasEarMark) traits.push('pointed ears');
  }
  
  return traits.join(', ');
}

// v3.0: 恐怖谷辅助函数
function isUncannyValleyBeast(name) {
  return Object.keys(UNCANNY_VALLEY_BEASTS).includes(name);
}

function getCreativeRemix(name) {
  return UNCANNY_VALLEY_BEASTS[name]?.creativeRemix || null;
}

function isSensitiveBeast(name) {
  return SENSITIVE_BEASTS.includes(name);
}

function buildPortraitPrompt(angle, features, roleType, styleTemplate) {
  // 主体优先架构 v2.0
  // speciesAnchor = 主体定义（明确物种骨架）
  // coreDesc = 独特标志 + 体征（不含物种名）
  
  const speciesAnchor = extractSubjectDefinition(features, roleType);
  
  // 独特标志（消毒后的核心特征，不含动物物种名）
  const signatureMarks = buildSignatureMarks(features, roleType);
  
  // 补充体征（颜色、体型等中性描述）
  const physicalTraits = buildPhysicalTraits(features);
  
  // 组装coreDesc
  let coreDesc = signatureMarks;
  if (physicalTraits) {
    coreDesc = `${signatureMarks}, ${physicalTraits}`;
  }
  
  // 长度控制
  if (coreDesc.length > 80) {
    coreDesc = coreDesc.substring(0, 80) + '...';
  }
  
  // 动态负面约束
  const negativeConstraints = buildNegativeConstraints(features._negativeSpecies || []);
  
  // 构建完整prompt
  const basePrompt = angle.promptTemplate(coreDesc, styleTemplate, speciesAnchor);
  const fullPrompt = `${basePrompt}. ${negativeConstraints}`;
  
  // 长度控制
  const cnCount = (fullPrompt.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = fullPrompt.length - cnCount;
  const totalWeight = cnCount * 2 + enCount;
  
  if (totalWeight > PROMPT_MAX_CN * 2) {
    console.log(`[警告] Prompt 超长(${totalWeight}权重)，裁剪coreDesc...`);
    const shorterCore = coreDesc.substring(0, 50);
    const shorterPrompt = angle.promptTemplate(shorterCore, styleTemplate, speciesAnchor);
    return `${shorterPrompt}. ${negativeConstraints}`;
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
async function generateAngle(angle, roleId, roleName, features, roleType, apiKey, referenceImage = null) {
  // v3.0: 支持两种Prompt格式
  // 旧格式: angle = {id, name, promptTemplate} → 使用buildPortraitPrompt生成
  // 新格式: angle = {suffix, angle, prompt} → 直接使用预生成prompt
  
  const angleId = angle.id || angle.angle;
  const angleName = angle.name || angle.suffix;
  
  console.log(`[生成] ${angleName}(${angleId})...`);
  if (referenceImage) {
    console.log(`[生成] 使用锚点参考图: ${path.basename(referenceImage)}`);
  }
  const start = Date.now();
  
  try {
    // v3.0: 优先使用预生成prompt（新8角度系统）
    let prompt;
    if (angle.prompt) {
      prompt = angle.prompt;
      console.log(`[生成] 使用预生成Prompt(v3.0 8角度) | ${prompt.length}字符`);
    } else {
      // 旧格式回退
      prompt = buildPortraitPrompt(angle, features, roleType, DEFAULT_STYLE);
      console.log(`[生成] 使用legacy Prompt(v2.x 4角度) | ${prompt.length}字符`);
    }
    
    const body = {
      model: ENDPOINT,
      prompt: prompt,
      size: '2K',
      n: 1,
      response_format: 'url'
    };
    
    // 如果有参考图，加入reference_images参数（锚点一致性机制）
    if (referenceImage && fs.existsSync(referenceImage)) {
      const imageBuffer = fs.readFileSync(referenceImage);
      const base64Image = imageBuffer.toString('base64');
      body.reference_images = [{
        data: base64Image,
        mime_type: 'image/png'
      }];
      console.log(`[生成] 已注入参考图 (${(imageBuffer.length/1024).toFixed(1)}KB)`);
    }
    
    const response = await postJson(API_BASE, { Authorization: `Bearer ${apiKey}` }, body);
    
    if (response.data?.[0]?.url) {
      const url = response.data[0].url;
      const outputDir = path.join(OUTPUT_BASE, roleId, 'portraits');
      fs.mkdirSync(outputDir, { recursive: true });
      // v3.0: 支持新旧两种文件名格式
      const filenameSuffix = angle.id || angle.angle;
      const filepath = path.join(outputDir, `${roleId}-portrait-${filenameSuffix}.png`);
      await downloadImage(url, filepath);
      const size = (fs.statSync(filepath).size / 1024).toFixed(1);
      console.log(`[生成] ✅ ${angleName} | ${Date.now() - start}ms | ${size}KB`);
      return { 
        id: angleId, 
        name: angleName, 
        filepath, 
        size: `${size}KB`, 
        success: true, 
        usedReference: !!referenceImage 
      };
    } else {
      console.error(`[生成] ❌ ${angleName} 失败:`, response.error || JSON.stringify(response).slice(0, 200));
      return { id: angleId, name: angleName, success: false, error: response.error || 'Unknown' };
    }
  } catch (e) {
    console.error(`[生成] ❌ ${angleName} 异常:`, e.message);
    return { id: angleId, name: angleName, success: false, error: e.message };
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
  console.log(`🎨 Character Portrait Generator v3.0`);
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
  
  // v3.0: 构建8角度Prompt参数
  const name = roleName || beastId;
  const isBeast = roleType === 'beast';
  
  // 构建beastDesc：物种锚定 + 签名特征 + 恐怖谷二创 + 武器
  let beastDesc = '';
  if (isBeast) {
    const speciesAnchor = extractSubjectDefinition(features, roleType);
    const signatureMarks = buildSignatureMarks(features, roleType);
    const physicalTraits = buildPhysicalTraits(features);
    beastDesc = `${speciesAnchor}`;
    if (signatureMarks) beastDesc += `, ${signatureMarks}`;
    if (physicalTraits) beastDesc += `, ${physicalTraits}`;
    
    // v3.0: 恐怖谷二创注入
    const isUncannyValley = isUncannyValleyBeast(name);
    if (isUncannyValley) {
      const remix = getCreativeRemix(name);
      if (remix) {
        beastDesc = `${remix.bodyMaterial}, ${remix.headReplacement}, ${remix.eyesRemix}, ${remix.mouthRemix}, ${remix.overallVibe}`;
        if (remix.weaponRemix) beastDesc += `, ${remix.weaponRemix}`;
      }
    }
  }
  
  const artistPerspective = BEAST_BASE_STYLE;
  const beastBg = 'pure white background, studio three-point lighting, clean and uniform, no environment, no jungle, no trees, no background elements, subject occupies 85% of frame';
  const consistencyLock = `${ANATOMICAL_LOCK}, ${AESTHETIC_GUIDE}, ${MORPHOLOGY_LOCK}`;
  const negativeConstraints = BEAST_NEGATIVE_CONSTRAINTS;
  const sensitiveCompliance = isSensitiveBeast(name) ? `, ${SENSITIVE_BEAST_COMPLIANCE}` : '';
  const uncannyElimination = (isUncannyValleyBeast(name) && getCreativeRemix(name)) ? `, ${getCreativeRemix(name).horrorElimination}` : '';
  const weaponConsistency = (isUncannyValleyBeast(name) && getCreativeRemix(name) && getCreativeRemix(name).weaponConsistency) ? `, ${getCreativeRemix(name).weaponConsistency}` : '';
  const originalText = features.profile?.originalText || '';
  
  // v3.0: 8角度生成
  let angles;
  if (isBeast) {
    const uniformMaterial = UNIFORM_MATERIAL_CONSTRAINT;
    const faceLock = FACE_CONSISTENCY_LOCK;
    angles = buildAnglePrompts(beastDesc, artistPerspective, beastBg, consistencyLock,
                                negativeConstraints, sensitiveCompliance, uncannyElimination,
                                weaponConsistency, name, originalText, uniformMaterial, faceLock);
  } else {
    // 人类角色使用旧版4角度（向后兼容）
    angles = requestedAngles
      ? STANDARD_ANGLES_LEGACY.filter(a => requestedAngles.includes(a.id))
      : STANDARD_ANGLES_LEGACY;
  }
  
  console.log(`[生成] 计划: ${angles.length}个角度 | ${angles.map(a => a.suffix || a.name).join(', ')}`);
  console.log('═══════════════════════════════════════════════════════');
  
  // ========== v3.0: 锚点一致性机制升级 ==========
  // 锚点改为正面全身（第一张照片设为参考图，后续7张强制引用）
  // 敏感异兽跳过参考图机制（避免审核拦截）
  const isSensitive = isSensitiveBeast(name);
  const anchorShot = angles[0]; // 正面全身作为锚点
  const otherShots = angles.slice(1);
  
  console.log(`\n[锚点] 启动锚点一致性机制(v3.0)`);
  console.log(`[锚点] 选定锚点角度: ${anchorShot.suffix || anchorShot.name}(${anchorShot.angle || anchorShot.id})`);
  console.log(`[锚点] 其他角度: ${otherShots.map(a => a.suffix || a.name).join(', ')}`);
  if (isSensitive) console.log(`[锚点] 🔒 敏感异兽模式: 不使用参考图，独立生成`);
  console.log('═══════════════════════════════════════════════════════');
  
  // 步骤1: 生成锚点图
  console.log(`\n[锚点] 生成锚点图...`);
  const anchorResult = await generateAngle(anchorShot, beastId, name, features, roleType, apiKey);
  
  const results = [anchorResult];
  
  if (!anchorResult.success) {
    console.error(`[锚点] ❌ 锚点图生成失败，退化为独立生成模式`);
    for (const shot of otherShots) {
      const result = await generateAngle(shot, beastId, name, features, roleType, apiKey);
      results.push(result);
      if (result.success) await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    console.log(`[锚点] ✅ 锚点图已生成: ${anchorResult.filepath} (${anchorResult.size})`);
    console.log(`[锚点] 后续角度将以此图为参考生成，确保角色一致性`);
    console.log('═══════════════════════════════════════════════════════');
    
    // 步骤2: 用锚点图作为参考，生成其他角度
    // v3.0: 敏感异兽不使用参考图
    for (const shot of otherShots) {
      let refImage = null;
      if (!isSensitive && anchorResult.success) {
        refImage = anchorResult.filepath;
      }
      const result = await generateAngle(shot, beastId, name, features, roleType, apiKey, refImage);
      results.push(result);
      if (result.success) await new Promise(r => setTimeout(r, 2000));
    }
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
  
  // 生成 manifest v3.0
  const manifestPath = path.join(OUTPUT_BASE, beastId, 'portraits', 'manifest.json');
  const manifest = {
    roleId: beastId,
    roleName: name,
    roleType,
    mode,
    generatedAt: new Date().toISOString(),
    systemVersion: 'v3.0',
    source: 'character-portrait-generator',
    anchorMechanism: {
      enabled: true,
      anchorAngle: anchorShot.angle || anchorShot.id,
      anchorFilepath: anchorResult.success ? anchorResult.filepath : null,
      description: 'v3.0: 正面全身作为锚点图，后续角度以此参考生成；敏感异兽跳过参考图机制'
    },
    featureCategories: roleType === 'beast' ? '11大分类56字段' : '10大分类45字段',
    angles: success.map(r => ({ 
      id: r.id, 
      name: r.name, 
      filepath: r.filepath, 
      size: r.size,
      usedReference: r.usedReference || false
    })),
    total: results.length, 
    success: success.length, 
    failed: results.length - success.length
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
