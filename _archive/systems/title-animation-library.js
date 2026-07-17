/**
 * 英文标题动效库 v1.0（通用模块）
 * 多种标题呈现方式，适用于所有山海经系列片头
 */

const TITLE_ANIMATION_TEMPLATES = {
  // 类型1：异兽互动型
  beastInteraction: {
    name: '异兽互动型',
    description: '异兽跑过/飞出/缠绕，带来或形成标题',
    variants: [
      {
        id: 'beast_run_through',
        name: '异兽狂奔穿过',
        timing: '0-1秒: 异兽从画面一侧狂奔而入',
        action: '1-2秒: 异兽奔跑带起的气流/火焰/粒子在空中凝结',
        formation: '2-3秒: 凝结的粒子形成英文标题字母',
        settle: '3-4秒: 标题稳定呈现，异兽停在画面另一侧回望',
        example: '九尾狐狂奔，九条尾巴火焰拖尾形成"NINE-TAILED FOX"'
      },
      {
        id: 'beast_fly_in',
        name: '异兽飞入盘旋',
        timing: '0-1秒: 异兽从天空俯冲而下',
        action: '1-2秒: 翅膀扇动产生涡流，涡流中显现标题',
        formation: '2-3秒: 涡流凝固成字母形态',
        settle: '3-4秒: 标题悬浮空中，异兽盘旋守护',
        example: '应龙俯冲，翅膀涡流形成"DRAGON OF YING"'
      },
      {
        id: 'beast_wrap',
        name: '异兽缠绕环绕',
        timing: '0-1秒: 异兽身体从画面边缘缓缓进入',
        action: '1-2秒: 身体缠绕成环形，鳞片/毛发发光',
        formation: '2-3秒: 发光的身体轮廓形成字母形状',
        settle: '3-4秒: 标题在异兽身体环绕中完整呈现',
        example: '烛龙身体缠绕，赤红鳞片形成"ZHULONG"'
      }
    ]
  },

  // 类型2：环境融合型
  environmentFusion: {
    name: '环境融合型',
    description: '标题从自然环境元素中自然生长/凝结/浮现',
    variants: [
      {
        id: 'waterfall_mist',
        name: '瀑布水雾凝结',
        timing: '0-1秒: 瀑布倾泻，水雾弥漫',
        action: '1-2秒: 水雾在双恒星光芒下折射',
        formation: '2-3秒: 水雾粒子凝结成字母形态',
        settle: '3-4秒: 标题如冰雕般晶莹，底部有水流滴落',
        example: '瀑布水雾凝结成"MYSTERY"'
      },
      {
        id: 'light_column',
        name: '双恒星光柱投影',
        timing: '0-1秒: 云层裂开',
        action: '1-2秒: 双恒星金色光柱穿透云层',
        formation: '2-3秒: 光柱在地面/水面投射出文字阴影',
        settle: '3-4秒: 光柱中的尘埃粒子形成文字轮廓',
        example: '光柱投射"EPIC OF BEASTS"'
      },
      {
        id: 'particle_gather',
        name: '星尘粒子汇聚',
        timing: '0-1秒: 发光孢子从四面八方飘来',
        action: '1-2秒: 粒子在空中汇聚成流',
        formation: '2-3秒: 粒子流编织成字母形态',
        settle: '3-4秒: 字母如银河般闪烁，粒子持续环绕',
        example: '孢子汇聚成"LEGENDS"'
      },
      {
        id: 'crystal_grow',
        name: '水晶生长成型',
        timing: '0-1秒: 地面紫色水晶开始生长',
        action: '1-2秒: 水晶生长伴随碎裂声和光芒',
        formation: '2-3秒: 水晶内部折射形成文字',
        settle: '3-4秒: 标题在水晶内部清晰可见',
        example: '水晶生长显示"CRYSTAL"'
      },
      {
        id: 'moss_spread',
        name: '发光苔藓蔓延',
        timing: '0-1秒: 地面苔藓开始发光',
        action: '1-2秒: 苔藓沿着地面蔓延成图案',
        formation: '2-3秒: 蔓延轨迹形成字母',
        settle: '3-4秒: 标题由发光苔藓组成',
        example: '苔藓蔓延成"NIRATH"'
      }
    ]
  },

  // 类型3：物理破坏型
  physicalDestruction: {
    name: '物理破坏型',
    description: '通过破坏/崩裂/碎裂等物理过程形成标题',
    variants: [
      {
        id: 'rock_crack',
        name: '岩石崩裂显现',
        timing: '0-1秒: 悬崖表面出现裂缝',
        action: '1-2秒: 岩石崩裂，碎片飞溅',
        formation: '2-3秒: 裂缝中透出光芒，形成字母形状',
        settle: '3-4秒: 标题如刻在岩石中，碎片悬浮周围',
        example: '岩石崩裂显示"ANCIENT"'
      },
      {
        id: 'ground_explode',
        name: '地面爆发',
        timing: '0-1秒: 地面开始震动',
        action: '1-2秒: 地面爆发，能量柱冲天而起',
        formation: '2-3秒: 能量柱中文字显现',
        settle: '3-4秒: 标题悬浮在爆发中心',
        example: '能量爆发显示"POWER"'
      }
    ]
  },

  // 类型4：光影魔术型
  lightMagic: {
    name: '光影魔术型',
    description: '通过光影变化形成标题',
    variants: [
      {
        id: 'shadow_play',
        name: '光影剪影',
        timing: '0-1秒: 强光源从背后照射',
        action: '1-2秒: 前景物体投射阴影',
        formation: '2-3秒: 阴影巧妙组合成字母',
        settle: '3-4秒: 标题由阴影构成',
        example: '树木阴影形成"FOREST"'
      },
      {
        id: 'reflection_form',
        name: '水面倒影成型',
        timing: '0-1秒: 平静水面如镜',
        action: '1-2秒: 空中物体变化',
        formation: '2-3秒: 水面倒影形成文字',
        settle: '3-4秒: 标题倒影完美对称',
        example: '倒影显示"MIRROR"'
      }
    ]
  }
};

/**
 * 生成标题动效Prompt
 * @param {string} templateType - 模板类型
 * @param {string} variantId - 变体ID
 * @param {string} titleText - 标题文字
 * @returns {string} 动效描述
 */
function generateTitleAnimationPrompt(templateType, variantId, titleText) {
  const template = TITLE_ANIMATION_TEMPLATES[templateType];
  if (!template) return '';

  const variant = template.variants.find(v => v.id === variantId);
  if (!variant) return '';

  let prompt = `【标题动效 - ${variant.name}】\n`;
  prompt += `${variant.timing}\n`;
  prompt += `${variant.action}\n`;
  prompt += `${variant.formation.replace(/标题/g, `"${titleText}"`)}\n`;
  prompt += `${variant.settle}\n`;

  return prompt;
}

/**
 * 获取所有可用模板列表
 * @returns {Array} 模板列表
 */
function getAvailableTemplates() {
  return Object.entries(TITLE_ANIMATION_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
    variantCount: value.variants.length
  }));
}

/**
 * 获取模板变体列表
 * @param {string} templateType - 模板类型
 * @returns {Array} 变体列表
 */
function getTemplateVariants(templateType) {
  const template = TITLE_ANIMATION_TEMPLATES[templateType];
  if (!template) return [];

  return template.variants.map(v => ({
    id: v.id,
    name: v.name,
    example: v.example
  }));
}

module.exports = {
  TITLE_ANIMATION_TEMPLATES,
  generateTitleAnimationPrompt,
  getAvailableTemplates,
  getTemplateVariants
};
