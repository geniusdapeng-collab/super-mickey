/**
 * Nirath异兽定妆数据 v2.0 — 山海经原著 + Nirath世界观融合
 * 
 * 核心原则：
 * 1. 每个异兽必须同时包含《山海经》原著原文和Nirath世界观设定
 * 2. Prompt生成时融合两者，既有山海经传统韵味，又有Nirath科技废墟美学
 * 3. 视觉锚定以山海经原文为准，Nirath设定为美学重构层
 * 
 * 山海经原文对照：
 * - 旋龟：《山海经·南山经》"其状如龟而鸟首虺尾，其名曰旋龟，其鸣自叫"
 * - 帝江：《山海经·西山经》"其状如黄囊，赤如丹火，六足四翼，浑敦无面目，是识歌舞"
 * - 白泽：《山海经》"通万物之情，能说人话，王者有德则出"
 * - 九尾狐：《山海经·南山经》"其状如狐而九尾，其音如婴儿"
 * - 烛龙：《山海经·大荒北经》"钟山之神，名曰烛阴，视为昼，瞑为夜"
 */

const NIRATH_CREATURE_DATA = {
  // 旋龟"地图" — 旧世界城市交通网络的拓扑映射
  // 《山海经·南山经》原文："其状如龟而鸟首虺尾，其名曰旋龟，其鸣自叫"
  map: {
    name: '地图（旋龟）',
    source: '《山海经·南山经》+ Nirath世界观v2.0',
    shanhaijingOriginal: '其状如龟而鸟首虺尾，其名曰旋龟，其鸣自叫',
    nirathCore: '旧世界地铁网络拓扑映射，背甲纹路如全息地图',
    description: '融合山海经"龟身鸟首虺尾"特征与Nirath科技废墟美学。背甲上天然生长着复杂纹路——2147年城市交通网络的拓扑映射，旧世界记忆的活体载体。',
    appearance: {
      body: '巨龟身 — 背甲上天然生长着复杂纹路，像地铁线路图般精密交织，龟壳质感如高科技合金装甲，山海经龟身形态+Nirath科技纹理',
      head: '鸟首 — 尖锐鸟喙如精密探测仪器，头部有发光的导航标记，融合猛禽锋利感与科技感，山海经鸟首+Nirath导航仪器',
      tail: '虺尾 — 蛇形尾巴末端有微弱的光脉闪烁，如数据传输线般流动光芒，山海经虺尾+Nirath光脉',
      special: '旧世界记忆的活体载体，背甲纹路会随环境变化而重新排列，如实时更新的全息地图，山海经"其鸣自叫"对应Nirath导航系统的自动播报',
      colors: '深褐与青绿交织，背甲纹路发出幽蓝微光，如科技废墟中的荧光苔藓'
    },
    promptTemplate: 'Nirath原创异兽旋龟，融合《山海经》龟身鸟首虺尾特征与2147年科技废墟美学，巨龟身背甲生长复杂地铁网络拓扑纹路如全息地图，鸟首尖锐带发光导航标记如探测仪器，虺尾蛇形末端光脉闪烁如数据传输线，旧世界记忆活体载体，背甲纹路随环境重新排列，深褐青绿交织幽蓝微光，超写实CG渲染，{scene}',
    negativePrompt: 'normal turtle, sea turtle, cartoon turtle, Earth turtle, dragon, western creature, cute animal, pet'
  },

  // 帝江"暖暖" — 2147年巨型恒温系统的残留
  // 《山海经·西山经》原文："其状如黄囊，赤如丹火，六足四翼，浑敦无面目，是识歌舞"
  warm: {
    name: '暖暖（帝江）',
    source: '《山海经·西山经》+ Nirath世界观v2.0',
    shanhaijingOriginal: '其状如黄囊，赤如丹火，六足四翼，浑敦无面目，是识歌舞',
    nirathCore: '2147年巨型恒温系统残留，能量体形态',
    description: '融合山海经"黄囊/赤如丹火/无面目"核心特征与Nirath科技美学。暖黄色能量体如一团会呼吸的暖云，没有面孔但能感知情绪，身体温度恒定如旧世界供暖系统。',
    appearance: {
      body: '黄囊状 — 如《山海经》描述的黄色囊袋形态，由暖金色光雾与能量凝聚而成，非实体非生物，边缘半透明消散，山海经"黄囊"=Nirath能量囊',
      face: '无面目 — 浑敦无面目，没有任何五官，光滑能量曲面，身体正中央悬浮金色太阳核心，山海经"无面目"严格还原',
      legs: '六足 — 六条光带从能量体底部自然下垂，呈三排排列（每排2条），绝非腿部足肢，山海经"六足"=Nirath能量流',
      wings: '四翼 — 四片半透明能量翼膜呈十字交叉排列，翼脉如金色叶脉发光，绝非羽毛，山海经"四翼"=Nirath散热鳍片',
      special: '情绪共鸣者，身体温度恒定如旧世界供暖系统，能包裹住AgentX给予温暖，山海经"是识歌舞"=Nirath情绪共振频率',
      colors: '暖黄色为主（如黄囊），情绪波动时赤如丹火转橙红，金色太阳光芒四射，山海经"赤如丹火"=Nirath过热警报色'
    },
    promptTemplate: 'Nirath原创异兽帝江暖暖，融合《山海经》黄囊赤如丹火六足四翼浑敦无面目特征与2147年科技恒温系统美学，暖黄色发光能量体如呼吸暖云，无面目光滑能量曲面，六条光带底部下垂三排排列，四片透明能量翼膜十字交叉翼脉金色发光，身体中央金色太阳核心，情绪共鸣温度恒定，超写实CG渲染，{scene}',
    negativePrompt: 'monster with face, creature with eyes, beast with mouth, animal face, sheep, turtle, cartoon cloud, western creature, Earth creature, cute, fluffy'
  },

  // 白泽"老师" — 人类文明记忆的意识化身
  // 《山海经》相关记载：通万物之情，能说人话，王者有德则出
  teacher: {
    name: '老师（白泽）',
    source: '《山海经》白泽传说 + Nirath世界观v2.0',
    shanhaijingOriginal: '通万物之情，能说人话，王者有德则出',
    nirathCore: '人类文明"记忆雾"凝聚体，数据意识的具象化',
    description: '融合山海经"通万物之情/能说人话"智慧特征与Nirath科技美学。通体雪白，鹿身狮鬃山羊角，双瞳重明。人类文明的全部数据弥散成的"记忆雾"的意识化身。',
    appearance: {
      body: '鹿身 — 优雅鹿形身体，肌肉线条流畅，通体雪白如月光凝成，毛发边缘散发银蓝光晕',
      head: '山羊头 — 头部如山羊，两角弯曲如旧世界天线，角上刻有数据流光纹路',
      mane: '狮鬃 — 颈部环绕浓密雪白鬃毛，如光纤束般发光，每一根都承载记忆片段',
      eyes: '双瞳重明 — 能看穿物质表象直达本质，瞳孔中偶尔闪过数据流光，如两个微型全息投影屏',
      special: '能说人话教AgentX万物有灵与记录的方法，人类文明记忆雾凝聚体，通万物之情',
      colors: '通体雪白，鬃毛边缘散发银蓝光晕，双瞳中数据流光呈淡金色'
    },
    promptTemplate: 'Nirath原创异兽白泽老师，融合《山海经》通万物之情能说人话智慧特征与人类文明记忆雾凝聚体，鹿身优雅雪白如月光，山羊头双角弯曲如天线带数据纹路，狮鬃雪白如光纤束发光，双瞳重明瞳孔闪过数据流光如全息屏，教导AgentX万物有灵，通体雪白银蓝光晕，超写实CG渲染，{scene}',
    negativePrompt: 'normal deer, normal goat, normal lion, cartoon creature, Earth animal, western unicorn, western creature, anime, cute pet'
  },

  // 九尾狐长老"奶奶" — 基因库释放的基因样本与植物融合
  // 《山海经·南山经》原文："其状如狐而九尾，其音如婴儿"
  granny: {
    name: '奶奶（九尾狐长老）',
    source: '《山海经·南山经》+ Nirath世界观v2.0',
    shanhaijingOriginal: '其状如狐而九尾，其音如婴儿',
    nirathCore: '中央公园基因库释放样本与植物融合的生命',
    description: '融合山海经"狐身九尾"核心特征与Nirath科技美学。九尾狐最古老的智慧种族长老，九条尾巴中三条已变银白。基因库爆炸释放的样本与植物融合诞生的生命。',
    appearance: {
      body: '狐身 — 优雅狐形身体，毛发如发光丝线般柔顺，绝非地球狐狸，山海经狐身+Nirath基因改造',
      head: '狐首 — 尖耳竖立，面部有发光的智慧纹路如电路板图腾，双瞳呈现数据流金色，山海经狐首+Nirath智慧标记',
      tails: '九尾 — 九条尾巴蓬松如发光植物藤蔓，三条已变银白色记载着古老记忆，每条尾巴都有独特光纹，山海经"九尾"=Nirath基因表达',
      special: '最古老智慧种族长老，用尾巴为AgentX编织光环宣布AgentX为山海之民，山海经"其音如婴儿"=Nirath频率共鸣的空灵声波',
      colors: '银白与深红交织，尾巴如发光藤蔓，老年三条银白尾散发月白光晕'
    },
    promptTemplate: 'Nirath原创异兽九尾狐长老奶奶，融合《山海经》狐身九尾其音如婴儿特征与基因库样本植物融合生命，狐身优雅毛发如发光丝线，尖耳竖立面部发光智慧纹路如电路板图腾，九尾蓬松如发光藤蔓三条已变银白记载古老记忆，古老智慧种族长老，银白深红交织月白光晕，超写实CG渲染，{scene}',
    negativePrompt: 'normal fox, cartoon fox, Earth fox, western kitsune, anime fox, cute furry, pet animal'
  },

  // 烛龙"太素之眼" — 太素机制的直接显化
  // 《山海经·大荒北经》原文："钟山之神，名曰烛阴，视为昼，瞑为夜"
  taisu: {
    name: '太素之眼（烛龙）',
    source: '《山海经·大荒北经》+ Nirath世界观v2.0',
    shanhaijingOriginal: '钟山之神，名曰烛阴，视为昼，瞑为夜',
    nirathCore: '太素机制的直接显化，宇宙法则的具象',
    description: '融合山海经"烛阴/视为昼瞑为夜"核心特征与Nirath科技美学。幽蓝色蛇身无翼无爪，表面星尘纹理与电路板纹路交织。双瞳奇点：左眼睁开时光子风暴照亮Nirath，右眼闭合时黑暗降临。太素机制的直接显化——不是生物，是宇宙法则的具象。',
    appearance: {
      body: '幽蓝色蛇身 — 无翼无爪如《山海经》烛阴，表面星尘纹理与电路板纹路交织如宇宙法则具象化，山海经蛇身+Nirath法则纹理',
      eyes: '双瞳奇点 — 左眼睁开时光子风暴照亮Nirath（视为昼），右眼闭合时黑暗降临（瞑为夜），瞳孔如黑洞般深邃，山海经"烛阴"=Nirath太素之眼',
      special: '太素机制直接显化，宇宙法则具象，不食不寝不息，钟山之神威压震慑万物，山海经"钟山之神"=Nirath太素核心',
      colors: '幽蓝色为主，纹理散发银白光晕，双瞳睁开时呈炽白，闭合时呈绝对漆黑，山海经"视为昼瞑为夜"=Nirath光暗双态'
    },
    promptTemplate: 'Nirath原创异兽烛龙太素之眼，融合《山海经》钟山之神烛阴视为昼瞑为夜特征与太素机制显化，幽蓝色蛇身无翼无爪，表面星尘纹理电路板纹路交织，双瞳奇点左眼睁开光子风暴照亮Nirath右眼闭合黑暗降临，宇宙法则具象不食不寝不息，钟山之神威压，幽蓝银白炽白绝对漆黑，超写实CG渲染，{scene}',
    negativePrompt: 'normal dragon, western dragon, western creature, Earth creature, cartoon dragon, anime dragon, cute, wings, claws'
  },
  // 默认回退 creature（用于未知ID查询）
  'default': {
    name: '未知异兽',
    source: '《山海经》+ Nirath世界观v2.0',
    shanhaijingOriginal: '未记录于山海经',
    nirathCore: 'Nirath未分类物种',
    description: '未记录的异兽类型，使用通用生物模板',
    appearance: {
      body: '中型生物形态 — 具体特征待记录',
      special: '新发现物种，档案待完善',
      colors: '中性色调'
    },
    promptTemplate: '未知异兽，中型生物形态，中性色调，{scene}',
    negativePrompt: 'human, modern, cartoon, western creature'
  }
};

module.exports = NIRATH_CREATURE_DATA;
