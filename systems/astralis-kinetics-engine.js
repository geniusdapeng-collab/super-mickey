/**
 * ASTRALIS KINETICS ENGINE — Nirath Title Motion Effects Library
 * ASTRALIS v3.0
 * 
 * 5 types × 20 variants of Nirath-native title animation effects.
 * Each variant includes: timeline, physics, visual signature, unique factor.
 * 
 * Phase 1: astralEvent + geomorphic (concrete, AI-friendly)
 * Phase 2: symbiotic (medium abstraction)
 * Phase 3: chronos + voidResonance (experimental, high abstraction)
 * 
 * @module astralis-kinetics-engine
 * @version 3.0
 */

// ═══════════════════════════════════════
// 3.1 五大动效类型（20种变体）
// ═══════════════════════════════════════

const ASTRALIS_KINETICS = {
  // ═══════════════════════════════════════
  // 类型一：ASTRAL EVENT 天文事件型
  // ═══════════════════════════════════════
  astralEvent: {
    name: 'ASTRAL EVENT 天文事件型',
    philosophy: 'Nirath天空中的壮观天象自然形成标题 — 敬畏宇宙',
    variants: [
      {
        id: 'binary_convergence',
        name: '双星交汇',
        phase: 1,
        timeline: {
          '0.0-1.5s': 'Aurelius与Silvana从画面两侧天际线升起，金色与银白两道光柱穿透Nirath大气层',
          '1.5-3.0s': '双星在标题预定位置交汇，光芒叠加产生圣白热（#FFFFFF），光柱中尘埃粒子形成丁达尔效应的可见轨迹',
          '3.0-4.5s': '交汇点的强光在磁场作用下弯曲，光线被扭曲成"{{TITLE}}"的形状 — 不是粒子组成字，是光本身被磁场弯成字',
          '4.5-6.0s': '双星继续各自轨道，交汇光柱拉长，标题在延伸的光带中稳定呈现，每个字母都是一道被弯曲的光束'
        },
        physics: '爱因斯坦交叉效应的Nirath版本 — 强磁场作为引力透镜弯曲恒星光线',
        visualSignature: '每个字母内部可见光谱分解 — 金色核心+银白边缘+量子青干涉纹',
        uniqueFactor: '这是v3.0独有的"无粒子标题" — 标题是纯光，没有实体，无法触摸'
      },
      {
        id: 'magnetic_storm_birth',
        name: '磁暴孕育',
        phase: 1,
        timeline: {
          '0.0-1.0s': '低光照环境，Aurelius金色主星被磁暴前驱云层部分遮蔽但仍提供暖金基调光照，Silvana银白伴星从云层间隙洒下清冷银白光柱，30Hz磁场共鸣产生淡紫蓝色环境光晕遍布画面，不是黑暗而是神秘的光影交织',
          '1.0-2.5s': '磁极点爆发出蓝紫色电弧，如巨大的特斯拉线圈苏醒，电弧沿磁场线向天空蔓延',
          '2.5-4.0s': '电弧在标题预定位置聚集，磁流体从地面被吸入空中，在电弧中熔化蒸发',
          '4.0-5.5s': '蒸发的磁流体在强磁场中冷凝，以"{{TITLE}}"的形状重新固化 — 每个字母都是刚从等离子态冷却的金属',
          '5.5-7.0s': '新生成的磁流体标题表面仍有高温余辉，从白热渐变到橙红再到银白，最后稳定在镜面反射态'
        },
        physics: '磁约束核聚变级别的能量释放，磁流体经历固-液-气-等离子-气的相变轮回',
        visualSignature: '标题诞生过程中有真实的物理相变痕迹 — 表面凝固纹理、气泡、流痕',
        uniqueFactor: '标题的"出生过程"比最终状态更震撼 — 这是关于诞生的动效'
      },
      {
        id: 'eclipse_corona',
        name: '星蚀日冕',
        phase: 1,
        timeline: {
          '0.0-2.0s': 'Silvana从Aurelius前方经过，双星蚀开始。金色光芒逐渐被银白边缘包围',
          '2.0-3.5s': '全蚀瞬间，Aurelius的金色日冕从Silvana边缘爆发，形成巨大的光环。光环被Nirath磁场扭曲成双螺旋结构',
          '3.5-5.0s': '双螺旋日冕光环的螺旋臂自然构成"{{TITLE}}"的笔画 — 标题是恒星日冕的临时形态',
          '5.0-6.5s': 'Silvana继续移动，日冕光环拉长变形，标题在日冕拉伸中改变字形，如融化的太阳',
          '6.5-8.0s': '蚀结束，双星光芒重新照亮世界，但标题已刻在观众视网膜上 — 残像渐消'
        },
        physics: '恒星日冕 + 磁场双螺旋 + 相对运动造成的视觉暂留',
        visualSignature: '标题由纯光构成，核心温度百万度，但通过磁场过滤后呈温暖的金色',
        uniqueFactor: '利用视觉暂留 — 标题在物理上从未稳定存在，是记忆创造了它'
      },
      {
        id: 'aurora_weave',
        name: '极光编织',
        phase: 1,
        timeline: {
          '0.0-2.0s': 'Nirath双螺旋极光从磁极点升起，如两条发光巨蛇在天际舞动，量子青与磁质体紫交织',
          '2.0-3.5s': '极光触须向下延伸，如手指般触碰地面，所到之处量子苔藓同步亮起',
          '3.5-5.0s': '极光触须在地面上方交织编织，如巨大的3D打印机，逐笔"绣"出"{{TITLE}}"',
          '5.0-6.5s': '编织完成，极光标题在空中稳定发光，底部与苔藓发光网连接，如天地之间的桥梁',
          '6.5-8.0s': '极光触须缓缓收回天际，但标题的"残影"留在空气中 — 电离气体的余辉持续发光'
        },
        physics: '带电粒子沿磁场线沉降到大气层，激发氮氧分子发光 + 量子苔藓的生物电响应',
        visualSignature: '标题有织物的纹理感 — 可见编织的经纬线，极光丝线的交叉点更亮',
        uniqueFactor: '天地联动的创作过程 — 天空的极光和地面苔藓共同完成标题'
      }
    ]
  },

  // ═══════════════════════════════════════
  // 类型二：GEOMORPHIC 地貌塑造型
  // ═══════════════════════════════════════
  geomorphic: {
    name: 'GEOMORPHIC 地貌塑造型',
    philosophy: 'Nirath的地壳、磁场和生态在 geological time 中雕刻出标题 — 敬畏大地',
    variants: [
      {
        id: 'tectonic_emergence',
        name: '构造浮现',
        phase: 1,
        timeline: {
          '0.0-1.5s': '地面开始震动，量子苔藓的同步闪烁被打乱，发光波纹从中心向外扩散',
          '1.5-3.0s': '地面沿磁场线裂开，裂缝中透出熔岩般的金光 — 是地壳下的磁流体上升',
          '3.0-4.5s': '整块地壳如电梯般抬升，抬升面的形状精确是"{{TITLE}}"的轮廓 — Nirath板块运动恰好形成这个字形',
          '4.5-6.0s': '抬升的岩块表面风化剥落，露出内部的紫磁质体层，磁质体内部全息影像显现为副标题',
          '6.0-8.0s': '新的地貌稳定下来，量子苔藓迅速覆盖新地表，标题成为Nirath地形的一部分 — 永久但会被生态改造'
        },
        physics: '板块构造 + 磁流体上涌 + 风化侵蚀 + 生态演替，压缩在8秒内',
        visualSignature: '标题不是装饰，是地形 — 有海拔高度、地质剖面、生态覆盖',
        uniqueFactor: '标题会"变老" — 最后moss覆盖时标题与自然融为一体'
      },
      {
        id: 'aether_cathedral',
        name: '磁质体大教堂',
        phase: 1,
        timeline: {
          '0.0-2.0s': '地面出现{{N}}个发光点，每个点是一颗种子磁质体，开始以肉眼可见速度生长',
          '2.0-3.5s': '磁质体沿磁场方向生长（非地球垂直向上），相互倾斜交汇，如哥特式教堂的拱顶结构',
          '3.5-5.0s': '磁质体交汇形成"{{TITLE}}"的骨架 — 每个字母是一座磁质体拱门的组合',
          '5.0-6.5s': '磁质体表面开始全反射，内部的全息影像被激活：每颗磁质体内部都封存着Nirath的一段历史影像',
          '6.5-8.0s': '双星光穿过磁质体大教堂，在地面投射出彩虹光谱的标题阴影 — 实体的字和彩色的影同时存在'
        },
        physics: '晶体学 + 建筑结构力学 + 光学全息 + 光谱分解',
        visualSignature: '标题是一座可走入的建筑 — 有内部空间、支撑结构、彩色玻璃窗',
        uniqueFactor: '磁质体内部的holographic memory使标题成为历史博物馆'
      },
      {
        id: 'spore_terraformation',
        name: '孢子地球化',
        phase: 1,
        timeline: {
          '0.0-1.5s': '画面是荒芜的岩石地表 — Nirath形成初期的景象',
          '1.5-3.0s': '第一颗以太孢子降落，着陆处量子苔藓开始生长，发出微弱的青绿光',
          '3.0-4.5s': '孢子雨加速，苔藓以时间流逝摄影的速度蔓延，路径精确追踪"{{TITLE}}"的笔画',
          '4.5-6.0s': '苔藓生长完成，但继续演化 — 颜色从青绿渐变为量子青（成熟标志），菌丝网络形成复杂图案',
          '6.0-8.0s': '银木树苗从苔藓中发芽，迅速成长为小树，环绕标题形成微型森林 — 标题成为一个生态系统的起点'
        },
        physics: '生态演替压缩 — 原核生物→地衣→植物群落，在8秒内完成千万年演化',
        visualSignature: '标题不是结果，是过程 — 观众看到的是生命的扩散本身',
        uniqueFactor: '最终状态不是标题最清晰的时候，是生态最丰富的时候 — 标题融入生态'
      },
      {
        id: 'waterfall_reverse',
        name: '逆流瀑布',
        phase: 1,
        timeline: {
          '0.0-1.5s': '瀑布从悬崖正常倾泻，但在接近标题预定位置时，水流开始违反重力向上流动',
          '1.5-3.0s': '磁悬浮水柱在空中形成"{{TITLE}}"的形状 — 不是水流组成字，是水流在强磁场区自然上浮成字',
          '3.0-4.5s': '色层流体从瀑布中分离 — 深渊紫在下，圣光白在上，各层在磁悬浮水柱中形成彩虹分层的标题',
          '4.5-6.0s': '磁暴脉冲，磁悬浮瞬间失效，水柱坠落 — 但在坠落过程中，每滴水珠的表面张力维持字母形状的短暂记忆',
          '6.0-8.0s': '水流重新磁悬浮，但这次形成的是副标题 — 主标题的"倒影"在水雾中浮现'
        },
        physics: '磁悬浮（抗磁性水的磁场悬浮）+ 表面张力 + 层流稳定性 + 色层分离',
        visualSignature: '水的行为违反直觉 — 向上流、悬浮在空中、分层而不混',
        uniqueFactor: '标题两次诞生 — 第一次被磁暴摧毁，第二次以更美的形式重生'
      }
    ]
  },

  // ═══════════════════════════════════════
  // 类型三：CHRONOS 时间扭曲型 [EXPERIMENTAL]
  // ═══════════════════════════════════════
  chronos: {
    name: 'CHRONOS 时间扭曲型',
    philosophy: '利用Nirath强磁场的时间膨胀效应（视觉化），创造非线性时间体验',
    variants: [
      {
        id: 'temporal_echo',
        name: '时间回声',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '标题"{{TITLE}}"以正常速度出现',
          '2.0-3.0s': '时间开始"折叠" — 同一画面上同时出现标题的3个时间版本：现在的（清晰）、1秒前的（半透）、2秒前的（虚化）',
          '3.0-4.5s': '时间折叠加剧，5个时间版本叠加，最老的版本开始消散为粒子，最新的版本还在形成',
          '4.5-6.0s': '时间"反转" — 最新的版本开始倒退消散，而最老的版本从虚空中重新凝聚 — 因果倒置',
          '6.0-8.0s': '时间恢复线性，但留下"时间伤痕" — 标题表面有涟漪般的时空气泡，证明这里曾经发生过时间扭曲'
        },
        physics: '强磁场区的时间膨胀可视化 — 不同位置时间流速不同造成的视觉叠加',
        visualSignature: '标题有"残影"但不是运动模糊，是时间叠加 — 每个残影来自不同的时间点',
        uniqueFactor: '观众无法确定标题是"正在出现"还是"正在消失" — 时间方向模糊了'
      },
      {
        id: 'fractal_zoom',
        name: '分形-zoom',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '画面显示Nirath星球全景，标题"{{TITLE}}"以行星尺度呈现 — 每个字母是一座大陆',
          '2.0-3.5s': '摄像机以指数速度zoom in进入第一个字母的"A"的海岸线',
          '3.5-5.0s': 'zoom进入后发现"A"的海岸线纹理中，有更小的"{{TITLE}}"在微观尺度重复出现 — 每个字母的纹理就是整个标题的缩小版',
          '5.0-6.5s': '继续zoom in，进入更小层的标题纹理，再更小层 — 无限套娃',
          '6.5-8.0s': 'zoom速度超越认知极限，所有尺度的标题同时可见 — 从行星到原子，标题存在于所有尺度'
        },
        physics: '分形几何 + 尺度不变性 + 无限zoom的视觉效果',
        visualSignature: '标题是自相似的 — 任何放大都reveals更小的完整标题',
        uniqueFactor: '打破"片头是2D画面"的假设 — 这是跨越尺度的旅程'
      },
      {
        id: 'probability_collapse',
        name: '概率坍缩',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '屏幕上同时显示标题的1000种"可能版本" — 不同字体、不同材质、不同位置，全部叠加成一片混沌',
          '2.0-3.5s': '1000个版本开始两两合并，每次合并保留更"合适"的特征 — 这是一个视觉进化过程',
          '3.5-5.0s': '合并到只剩10个候选版本，每个都很美但都不同 — 如同平行宇宙的10个分支',
          '5.0-6.0s': '最终的"观测"发生 — 一个版本被"选中"（不一定是最好的，是最适合这个瞬间的），其他版本瞬间坍缩为光点消散',
          '6.0-8.0s': '被选中的版本稳定存在，但偶尔闪烁 — 那是其他平行宇宙泄漏的微光'
        },
        physics: '量子力学多世界诠释的可视化 — 波函数坍缩的宏观模拟',
        visualSignature: '标题的"选择过程"比结果更震撼 — 观众见证了从混沌到秩序的创造',
        uniqueFactor: '每次生成应该产生不同的"选中版本" — 真正的不确定性'
      },
      {
        id: 'palindrome_loop',
        name: '回环时间晶体',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '正常的时间流动，标题"{{TITLE}}"的字母依次出现',
          '2.0-4.0s': '时间开始加速，字母出现得越来越快 — 但序列开始重复：T-H-E... T-H-E...',
          '4.0-5.5s': '时间达到临界速度，标题的出现和消失完全同步 — 第四秒的第一帧与最后一帧完全相同',
          '5.5-7.0s': '时间开始倒流，但倒流的画面与正流的画面叠加 — 标题在"生长"的同时"衰亡"',
          '7.0-9.0s': '片头最后一帧与第一帧无缝连接 — 这是一个时间晶体，永无止境的循环'
        },
        physics: '时间平移对称性破缺 + 时间晶体概念 + 无缝循环',
        visualSignature: '标题处于一个永恒的创世-毁灭-重生的轮回中',
        uniqueFactor: '如果观众仔细看第二遍，会发现"新"的细节 — 每次循环都有微小变化'
      }
    ]
  },

  // ═══════════════════════════════════════
  // 类型四：SYMBIOTIC 生态共生型 [Phase 2]
  // ═══════════════════════════════════════
  symbiotic: {
    name: 'SYMBIOTIC 生态共生型',
    philosophy: 'Nirath的生物与标题形成共生关系 — 标题是生物，生物是标题',
    variants: [
      {
        id: 'spore_creature',
        name: '孢子生物',
        phase: 2,
        timeline: {
          '0.0-2.0s': '以太孢子在空气中自发聚集，不是随机聚集 — 是某种群体智能在组织它们',
          '2.0-3.5s': '孢子群形成模糊的"{{TITLE}}"轮廓，但群体不稳定，如活物般蠕动变形',
          '3.5-5.0s': '孢子生物"学习"稳定形态，轮廓逐渐清晰，边缘孢子如触须般探索环境',
          '5.0-6.5s': '孢子生物完全成型，开始有"行为" — 对双星光做出反应（向光移动），对磁场波动做出反应（改变形状）',
          '6.5-8.0s': '孢子生物"繁殖" — 分裂成两个较小的群体，各自形成标题的一半，如细胞分裂'
        },
        physics: '群体智能（鸟群/鱼群算法）+ 生物荧光 + 趋光性 + 磁场感应',
        visualSignature: '标题不是死的，是活的 — 在呼吸、蠕动、对环境做出反应',
        uniqueFactor: '如果这是系列片头，每次标题的"行为"可以不同 — 它有自己的"情绪"'
      },
      {
        id: 'mycelium_mind',
        name: '菌丝心智',
        phase: 2,
        timeline: {
          '0.0-2.0s': '地面量子苔藓的菌丝网络以电脉冲形式活跃，脉冲在菌丝间传播如神经网络放电',
          '2.0-3.5s': '脉冲在特定节点汇聚，那些节点的苔藓特别明亮 — 亮节点的空间分布恰好是"{{TITLE}}"',
          '3.5-5.0s': '"{{TITLE}}"作为电信号在整个菌丝网络中传播 — 不是静态图像，是动态信息，每个字母都是一波神经冲动',
          '5.0-6.5s': '脉冲到达网络边缘后反射回来，与outgoing脉冲干涉 — 标题产生"思考"的视觉效果（思考即干涉图案）',
          '6.5-8.0s': '网络达到稳态，"{{TITLE}}"以驻波形式稳定存在 — 这是Nirath星球的"集体意识"在表达'
        },
        physics: '神经网络电信号传播 + 反射干涉 + 驻波 + 生物电发光',
        visualSignature: '标题的每个部分都在"思考" — 亮度波动对应神经活动',
        uniqueFactor: '标题是Nirath星球的大脑活动可视化 — 这是星球在"想"这个字'
      },
      {
        id: 'silverbloom_chorus',
        name: '银木合唱',
        phase: 2,
        timeline: {
          '0.0-2.0s': '{{N}}棵银木树分布在画面中，各自独立发光，光纤枝条随机闪烁',
          '2.0-3.5s': '银木开始"同步" — 一棵树的闪光引发邻近树的闪光，如森林火灾的蔓延但更加优雅',
          '3.5-5.0s': '所有银木达到完全同步，光纤枝条的光流collectively在空间中拼出"{{TITLE}}" — 单棵树看不出，整体才显现',
          '5.0-6.5s': '同步模式切换 — 从拼出标题切换为拼出副标题，再切换回标题，如视觉节拍器',
          '6.5-8.0s': '银木进入"合唱高潮" — 所有树同时最亮，collective image如超新星爆发，然后同时暗下，只剩余辉中的标题残影'
        },
        physics: '耦合振荡器同步（Kuramoto模型）+ 光纤光传导 + 集体行为涌现',
        visualSignature: '从局部看不到标题，必须从整体看 — 涌现性',
        uniqueFactor: '银木是Nirath的"神经元"，这片森林是一个视觉皮层'
      },
      {
        id: 'phoenix_cycle',
        name: '凤凰循环',
        phase: 2,
        timeline: {
          '0.0-2.0s': '画面中心是一团等离子触须交织成的巢，触须缓慢燃烧',
          '2.0-3.5s': '触须突然剧烈燃烧，温度飙升，巢中诞生出一个由纯能量构成的生物 — 类似凤凰但由Nirath等离子构成',
          '3.5-5.0s': '等离子凤凰展翅飞翔，飞行轨迹在天空中划出"{{TITLE}}" — 不是留下痕迹，是飞行路径本身就是字',
          '5.0-6.0s': '凤凰燃尽自己，化为漫天星火降落，每颗火星是一个发光的孢子',
          '6.0-8.0s': '降落的孢子中，有一颗在画面中心重新聚集成巢 — 循环准备再次开始，但巢的形状已经是"{{TITLE}}"的轮廓'
        },
        physics: '等离子体生命周期 + 轨迹可视化 + 物质循环 + 永恒轮回',
        visualSignature: '创造-毁灭-重生的完整叙事弧线',
        uniqueFactor: '9秒讲完一个创世神话 — 这是Nirath的宇宙论'
      }
    ]
  },

  // ═══════════════════════════════════════
  // 类型五：VOID_RESONANCE 虚空共鸣型 [EXPERIMENTAL]
  // ═══════════════════════════════════════
  voidResonance: {
    name: 'VOID RESONANCE 虚空共鸣型',
    philosophy: '利用"看不见的东西"来形成标题 — 负空间、阴影、缺席、沉默',
    variants: [
      {
        id: 'negative_space_carve',
        name: '负空间雕刻',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '画面被浓密的以太孢子雾填满，亮度均匀，没有任何特征 — 如白色噪音',
          '2.0-3.5s': '某些区域的孢子开始被"吸走" — 不是消散，是被某种看不见的力量精确移除',
          '3.5-5.0s': '被移除孢子形成的空白区域，形状恰好是"{{TITLE}}" — 标题是"不存在"的部分',
          '5.0-6.5s': '空白区域的边缘，剩余的孢子形成发光轮廓 — 如剪影的反向，是"光剪影"',
          '6.5-8.0s': '被吸走的孢子从空白区域的"背面"涌出，如瀑布逆流，在标题后方形成发光背景墙 — 标题从负空间转正空间'
        },
        physics: '真空极化 + 粒子-反粒子对产生 + 负空间美学',
        visualSignature: '标题首先以"缺席"的形式存在 — 它在那里，因为它是空的',
        uniqueFactor: '观众的大脑会自动填补空白 — 这是格式塔心理学的视觉应用'
      },
      {
        id: 'shadow_symphony',
        name: '影之乐章',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '双恒星从精确相对的位置同时照射，所有物体的影子完全抵消 — 画面中没有阴影',
          '2.0-3.5s': 'Silvana开始移动，阴影开始出现 — 但Nirath的双光源产生两个不同颜色的影子：金色影和银蓝影',
          '3.5-5.0s': '精心布置的银木林、悬浮磁质体、磁流体雕塑的dual shadows在地面/空中叠加，collective shadow形成"{{TITLE}}"',
          '5.0-6.5s': '继续移动光源，阴影变形、拉伸、分裂 — 标题在影子的变形中经历一系列字形变化',
          '6.5-8.0s': '双恒星回到初始位置，影子再次抵消 — 标题"消失"，但观众的记忆中它还在'
        },
        physics: '双光源投影 + 影子的颜色（Nirath影子不是黑色）+ 相对运动',
        visualSignature: '标题存在于影子中 — 是实体世界的"暗面"',
        uniqueFactor: 'Nirath的双光源让影子有了颜色 — 金色影+银蓝影的叠加产生彩虹效果'
      },
      {
        id: 'silence_impact',
        name: '沉默冲击',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '画面充满视觉噪音 — 磁暴、孢子风暴、等离子爆发，chaos至极',
          '2.0-3.0s': '所有噪音突然"冻结" — 不是渐弱，是瞬间绝对静止，如有人按了暂停键',
          '3.0-4.5s': '在冻结的chaos中，有一个区域是"真正的空" — 冻结的粒子被精确移除，形成"{{TITLE}}"形状的绝对宁静区',
          '4.5-6.0s': '宁静区开始"发声" — 30Hz磁场共鸣在这个区域特别强烈，可见为低频光脉冲，如标题在呼吸',
          '6.0-8.0s': '周围的chaos开始恢复，但宁静区依然存在 — 标题是风暴中的沉默之眼'
        },
        physics: '冲击波传播 + 驻波节点 + 混沌边缘的秩序岛',
        visualSignature: '标题不是"出现"的，是"在混乱中保持不变"的',
        uniqueFactor: '对比美学 — 越乱的环境，标题越显宁静'
      },
      {
        id: 'gravitational_null',
        name: '引力零点',
        phase: 3,
        experimental: true,
        timeline: {
          '0.0-2.0s': '画面展示Nirath的悬浮群岛正常漂浮，各自有稳定的轨道',
          '2.0-3.5s': '群岛开始向某个点聚集，不是坠落，是沿磁场螺旋线向中心汇集',
          '3.5-5.0s': '群岛在中心点周围形成精确的环形阵列 — 环中心的引力/磁力恰好为零，是一个"拉格朗日点"',
          '5.0-6.5s': '零引力区的空间本身开始发光（量子真空效应），光芒自然形成"{{TITLE}}" — 标题是空间扭曲的可视化',
          '6.5-8.0s': '群岛开始从中心散开，回到各自轨道，但零引力区的发光痕迹残留 — 如伤口愈合后的疤痕'
        },
        physics: '多体引力平衡点 + 量子真空极化 + 空间弯曲可视化',
        visualSignature: '标题存在于"无"之中 — 是引力归零后暴露的宇宙底色',
        uniqueFactor: '宏大到行星尺度的构图 — 标题用整个星球当画布'
      }
    ]
  }
};

// ═══════════════════════════════════════
// 3.2 动效库 API
// ═══════════════════════════════════════

/**
 * 生成Nirath动效Prompt
 * @param {string} templateType - 动效类型（astralEvent/geomorphic/chronos/symbiotic/voidResonance）
 * @param {string} variantId - 变体ID
 * @param {string} titleText - 标题文本
 * @param {Object} config - 配置项
 * @returns {string} 动效Prompt段落
 */
function generateKineticsPrompt(templateType, variantId, titleText, config = {}) {
  const template = ASTRALIS_KINETICS[templateType];
  if (!template) return '';
  const variant = template.variants.find(v => v.id === variantId);
  if (!variant) return '';

  let prompt = `【ASTRALIS KINETICS — ${template.name} | ${variant.name}】\n`;
  prompt += `核心理念：${template.philosophy}\n`;
  prompt += `物理机制：${variant.physics}\n\n`;

  // 时间线
  prompt += `【时间线】\n`;
  Object.entries(variant.timeline).forEach(([time, desc]) => {
    const processedDesc = desc.replace(/\{\{TITLE\}\}/g, `"${titleText}"`)
                               .replace(/\{\{N\}\}/g, config.nCount || '3');
    prompt += `${time}: ${processedDesc}\n`;
  });

  // 视觉签名
  prompt += `\n【视觉签名】${variant.visualSignature}\n`;
  prompt += `【独特性】${variant.uniqueFactor}\n`;

  // v3.0：自动叠加ASTRALIS光照模型
  prompt += `\n【ASTRALIS光照】双恒星（Aurelius 5800K金色 + Silvana 6500K银白），磁场可见光效应，30Hz环境共鸣。Nirath调色盘（深渊紫+琥珀金+量子青+磁质体紫+星尘粉）。\n`;

  return prompt;
}

/**
 * 获取动效推荐（基于标题内容和场景氛围）
 * @param {string} titleText - 标题文本
 * @param {string} mood - 氛围（epic/mysterious/living/dramatic/cosmic/ancient/organic/intense）
 * @param {string} scale - 尺度（planetary/continental/forest/intimate）
 * @returns {Array} 推荐动效列表
 */
function recommendKinetics(titleText, mood, scale) {
  const recommendations = [];

  // Phase 1推荐（优先）
  if (mood === 'epic' || mood === 'cosmic') {
    recommendations.push('astralEvent.binary_convergence');
    recommendations.push('astralEvent.magnetic_storm_birth');
  }
  if (mood === 'mysterious' || mood === 'ancient') {
    recommendations.push('geomorphic.aether_cathedral');
    recommendations.push('astralEvent.aurora_weave');
  }
  if (mood === 'living' || mood === 'organic') {
    recommendations.push('geomorphic.spore_terraformation');
    recommendations.push('astralEvent.aurora_weave');
  }
  if (mood === 'dramatic' || mood === 'intense') {
    recommendations.push('astralEvent.magnetic_storm_birth');
    recommendations.push('geomorphic.tectonic_emergence');
  }
  if (mood === 'serene' || mood === 'contemplative') {
    recommendations.push('geomorphic.waterfall_reverse');
    recommendations.push('astralEvent.eclipse_corona');
  }

  return recommendations;
}

/**
 * 获取动效详情
 * @param {string} templateType - 动效类型
 * @param {string} variantId - 变体ID
 * @returns {Object|null} 动效定义
 */
function getKineticsVariant(templateType, variantId) {
  const template = ASTRALIS_KINETICS[templateType];
  if (!template) return null;
  return template.variants.find(v => v.id === variantId) || null;
}

/**
 * 获取指定Phase的所有动效
 * @param {number} phase - Phase编号（1/2/3）
 * @returns {Array} [{type, variant, name, phase, experimental}]
 */
function getKineticsByPhase(phase) {
  const results = [];
  Object.entries(ASTRALIS_KINETICS).forEach(([typeKey, typeData]) => {
    typeData.variants.forEach(v => {
      if (v.phase === phase) {
        results.push({
          type: typeKey,
          variant: v.id,
          name: `${typeData.name} | ${v.name}`,
          phase: v.phase,
          experimental: v.experimental || false
        });
      }
    });
  });
  return results;
}

/**
 * 获取所有动效列表
 * @returns {Array} 所有动效概览
 */
function getAllKineticsList() {
  const results = [];
  Object.entries(ASTRALIS_KINETICS).forEach(([typeKey, typeData]) => {
    typeData.variants.forEach(v => {
      results.push({
        type: typeKey,
        variantId: v.id,
        name: v.name,
        phase: v.phase,
        experimental: v.experimental || false,
        category: typeData.name
      });
    });
  });
  return results;
}

module.exports = {
  ASTRALIS_KINETICS,
  generateKineticsPrompt,
  recommendKinetics,
  getKineticsVariant,
  getKineticsByPhase,
  getAllKineticsList
};
