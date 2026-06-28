# 🐉 神兽档案库架构设计 v1.0

> **目标**：建立统一的《山海经》神兽数字资产库，与Nirath视频生成系统深度耦合，实现"档案→Prompt→渲染"的全自动链路。
> **规模**：支持100+神兽（当前40只，预留扩展至200只）
> **耦合原则**：神兽不是独立数据，而是视频生产链路的**活性原料**

---

## 一、核心架构：三层模型

```
┌─────────────────────────────────────────────────────────┐
│  数据层：神兽档案库 (JSON + 文件系统)                      │
│  ├── 神兽元数据 (40+字段标准Schema)                        │
│  ├── 视觉资产 (定妆照/概念图/参考图)                       │
│  ├── 声音资产 (TTS音色/音效特征)                          │
│  └── 关系图谱 (神兽间关联网络)                            │
├─────────────────────────────────────────────────────────┤
│  耦合层：神兽引擎 (JavaScript API)                        │
│  ├── 角色注入器 → 自动将神兽特性注入Prompt                │
│  ├── 一致性守卫 → 确保跨镜头神兽形象统一                   │
│  ├── 世界观校准器 → Nirath生态/栖息地自动适配              │
│  ├── 运镜推荐器 → 基于神兽特性推荐运镜方案                │
│  └── 场景生成器 → 基于栖息地自动生成场景描述              │
├─────────────────────────────────────────────────────────┤
│  应用层：生产链路 (直接驱动渲染)                            │
│  ├── 剧本创作Agent → 自动引用神兽档案编写叙事              │
│  ├── Prompt构建器 → 神兽特征自动转译为Seedance Prompt      │
│  ├── 角色合规检查 → 神兽专属合规规则库                     │
│  ├── 预生产报告 → 神兽完整度自动检查                       │
│  └── 后期合成 → 神兽专属字幕/音效模板                      │
└─────────────────────────────────────────────────────────┘
```

---

## 二、神兽档案Schema（标准字段）

### 2.1 身份层 (Identity)

```json
{
  "id": "zhu-long",           // 唯一标识（小写连字符）
  "catalogNo": "01",        // 图鉴编号（01-40）
  "name": {
    "chinese": "烛龙",
    "pinyin": "Zhú Lóng",
    "aliases": ["烛九阴", "烛阴", "逴龙", "火精"]
  },
  "classification": {
    "tier": "创世神祇",     // 神兽级别：创世神祇/上古凶兽/四方灵兽/异界灵兽/灾厄之兽/奇幻生灵
    "category": "时空主宰",  // 细分类别
    "originText": "《山海经·大荒北经》"  // 原始出处
  },
  "nirathStatus": {
    "isNative": true,         // 是否为Nirath原生神兽
    "habitat": "永夜裂谷",   // Nirath栖息地
    "ecosystemRole": "星球级生态调节器", // 生态位
    "firstAppearance": "EP03" // 首次登场剧集
  }
}
```

### 2.2 视觉层 (Visual)

```json
{
  "visualIdentity": {
    "coreDescription": "人面蛇身而赤，身长千里，直目正乘", // 核心视觉特征（30字内）
    "bodyPlan": "人首蛇身",    // 身体结构类型
    "colorPalette": ["赤红", "金色", "暗紫"], // 主色调
    "scale": "超巨型",        // 体型等级：微型/小型/中型/大型/巨型/超巨型
    "texture": "鳞片",        // 表面材质：鳞片/毛发/羽毛/甲壳/皮肤/能量体
    "signatureFeatures": [     // 标志性特征（Prompt直接引用）
      "竖直生长的双目（直目正乘）",
      "身长千里横亘山脉",
      "口中衔持永恒火精"
    ],
    "promptFragments": {       // 各部位Prompt片段
      "head": "人面头部眉目深邃目光如炬",
      "body": "绵延蛇身长达千里赤红鳞片",
      "eyes": "竖直双目炯炯有神开合决定昼夜",
      "special": "口中衔持火精永恒燃烧的等离子体光芒"
    }
  },
  "portraitConfig": {         // 定妆照配置（复用角色档案库v2标准）
    "model": "seedream-5-0",
    "size": "2K",
    "style": "超写实CG渲染，东方神话史诗风格，IMAX级视觉",
    "background": "Nirath永夜裂谷岩浆海洋背景",
    "angles": ["front", "threeQuarter", "closeup", "side", "aerial"],
    "lighting": "岩浆火精双重光源，侧逆光勾勒千里龙身",
    "priority": "critical"
  }
}
```

### 2.3 能力层 (Abilities)

```json
{
  "abilities": [
    {
      "name": "掌控昼夜",
      "description": "睁眼为白昼，闭眼为黑夜",
      "visualCue": "瞳孔光芒如日出日落绽放收束",  // 视觉提示词（用于Prompt）
      "nirathSciFi": "能量输出开关控制极地光照",   // Nirath科幻解释
      "sfxTemplate": "昼夜交替_光芒绽放_黑暗潮涌",   // 关联音效模板
      "rarity": "legendary"  // 稀有度：common/rare/epic/legendary/mythic
    }
  ]
}
```

### 2.4 叙事层 (Narrative)

```json
{
  "narrative": {
    "originStory": "烛龙为钟山之神，掌控时空运转...",
    "keyLegends": ["大禹之父鲧的守护神", "屈原天问", "烛照九幽"],
    "symbolism": ["光明与希望", "自然力量与时空掌控", "永恒守护"],
    "modernLesson": "保持内心光明与秩序，用恒久坚持照亮前行道路",
    "relationships": [         // 关系图谱（驱动故事线）
      { "target": "ying-long", "type": "同族", "dynamic": "同为神龙地位相当" },
      { "target": "xiaoG", "type": "守护者", "dynamic": "选中记录者传承记忆" }
    ],
    "storyArcs": [             // 可用故事线
      { "id": "zhu-long-awakening", "title": "烛龙觉醒", "episodes": ["EP03", "EP08"] }
    ]
  }
}
```

### 2.5 影视层 (Production)

```json
{
  "production": {
    "visualStyle": {
      "referenceFilms": ["《降临》", "《哥斯拉》", "《阿凡达》"],
      "coreConcept": "巨大感为核心视觉概念，IMAX摄影机远景展现千里龙身",
      "vfxHighlights": [
        "睁眼时瞳孔光芒如日出绽放",
        "呼吸化为四季的环境粒子系统",
        "火精流动态等离子体光芒"
      ],
      "cameraPresets": [        // 预设运镜方案
        {
          "name": "巨物压迫感",
          "shotSize": "extreme_wide",
          "movement": "slow_push",
          "speed": "silky",
          "physics": "none"
        }
      ]
    },
    "nirathIntegration": {
      "habitatDescription": "永夜裂谷绵延数千公里地壳裂缝，深处岩浆海洋",
      "sciFiAdaptation": "半能量态生物，赤红鳞片为高密度能量晶体",
      "humanRelation": "人类成立烛龙守望协议，承诺不干涉其活动",
      "storylines": [
        "探索队发现烛龙可能是远古文明制造的生物恒星",
        "烛龙休眠导致全球气候崩溃",
        "科学家与烛龙建立精神链接"
      ]
    }
  }
}
```

---

## 三、深度耦合方案：五大引擎

### 3.1 神兽Prompt注入器 (BeastPromptInjector)

**功能**：剧本中的神兽名 → 自动展开为完整视觉Prompt

**流程**：
```
剧本: "小G在永夜裂谷遇见了烛龙"
    ↓
[BeastPromptInjector]
    ↓
展开为:
"8岁男孩小G站在Nirath星球永夜裂谷边缘，
 面前是绵延千里的烛龙——人面蛇身通体赤红，
 竖直双目如炬，口中衔持永恒火精照亮九幽...
 超写实CG渲染，IMAX级巨物美学，
 岩浆火光侧逆光，冷暖对比调色..."
```

**Prompt字数优化**：
- 神兽核心特征自动提取为40-60字紧凑描述
- 与角色档案库共享`promptFragment`机制
- 自动叠加Nirath环境描述（永夜裂谷/岩浆海洋/双恒星）

### 3.2 神兽一致性守卫 (BeastConsistencyGuard)

**功能**：确保同一神兽在跨镜头、跨剧集中形象统一

**检查点**：
1. **颜色一致性**：烛龙必须是赤红+金色，不能变成蓝色
2. **形态一致性**：烛龙必须是人面蛇身，不能混入西方龙特征
3. **能力一致性**：掌控昼夜的神兽不能突然变成吐水
4. **规模一致性**：千里龙身不能在一镜中变成百米

**拦截机制**：
```javascript
// 如果检测到Prompt中烛龙颜色被改为蓝色
if (prompt.includes('蓝色') && beastId === 'zhu-long') {
  return { 
    blocked: true, 
    reason: '烛龙主色调为赤红/金色，禁止改为蓝色',
    fix: '将"蓝色"替换为"赤红"或"暗紫"'
  };
}
```

### 3.3 Nirath世界观校准器 (NirathWorldSync)

**功能**：确保神兽在Nirath的表现符合世界观设定

**校准规则**：
- **栖息地匹配**：烛龙只出现在永夜裂谷，不会在青丘灵原
- **生态逻辑**：食火兽祸斗不会出现在水泽地带
- **科技水平**：Nirath没有现代科技，神兽不能穿机甲
- **能量体系**：双恒星光照、地核辐射、生物电磁场统一

### 3.4 神兽运镜推荐器 (BeastCameraAdvisor)

**功能**：基于神兽特性推荐最佳运镜方案

**映射表**：
| 神兽类型 | 推荐运镜 | 情绪曲线 |
|----------|----------|----------|
| 超巨型（烛龙/鲲鹏） | extreme_wide + slow_push | 敬畏→震撼 |
| 飞行类（应龙/朱雀） | aerial_tracking + fast_pan | 自由→激昂 |
| 灵巧类（九尾狐/英招） | medium_close + smooth_follow | 神秘→魅惑 |
| 凶兽类（饕餮/穷奇） | close_up + sudden_shake | 紧张→恐惧 |
| 守护类（麒麟/白泽） | wide + silky_orbit | 庄严→安宁 |

### 3.5 神兽场景生成器 (BeastSceneGenerator)

**功能**：基于神兽栖息地自动生成完整场景描述

**示例**：
```
输入：夫诸 + 敖岸山
输出：
"清晨薄雾笼罩的敖岸山，山体呈现翡翠色玉石光泽。
 山涧溪流中，四角白鹿夫诸踏水而行，蹄下泛起水晶般涟漪。
 四只冰棱般的角折射双恒星光芒，在山壁上投射彩虹光斑。
 远处黄河故道蜿蜒，空气中弥漫着秦椒与山药的草木清香..."
```

---

## 四、批量导入方案（支持多批次）

### 4.1 MD→JSON转换流水线

```
MD档案文件
    ↓
[MD Parser] 提取10大维度字段
    ↓
[Schema Validator] 验证必填字段完整性
    ↓
[Auto Enricher] 自动补全：
  - Prompt片段拆分（头部/身体/特征/环境）
  - 颜色提取为主色调
  - 体型分类（基于描述关键词）
  - 关系图谱构建（基于"相关神兽"字段）
    ↓
[JSON Output] 标准化神兽档案
    ↓
[Asset Pipeline] 触发定妆照生成任务
```

### 4.2 多批次扩展策略

| 批次 | 数量 | 状态 | 处理方式 |
|------|------|------|----------|
| 第一批 | 40只 | ✅ 已接收 | 立即导入 |
| 第二批 | 待接收 | ⏳ 等待 | MD Parser就绪 |
| 第三批 | 待接收 | ⏳ 等待 | MD Parser就绪 |
| 第四批 | 待接收 | ⏳ 等待 | MD Parser就绪 |

**扩展上限**：当前架构支持200只神兽无压力扩展。

---

## 五、与现有系统的集成点

### 5.1 与角色档案库v2的集成

```
角色档案库        神兽档案库
├─ 小G            ├─ 烛龙
├─ 暖暖(帝江)      ├─ 应龙
├─ 白泽           ├─ 九尾狐
├─ 陈女士          └─ ...
└─ 教练
       ↓
[统一Prompt构建器]
  人类角色引用定妆照(role: reference_image)
  神兽角色展开promptFragments
       ↓
[Seedance 2.0 API]
```

**关键区别**：
- **人类角色**：依赖定妆照保持跨镜头一致性
- **神兽角色**：依赖promptFragments+神兽一致性守卫（因为没有定妆照参考图）

### 5.2 与预生产报告系统的集成

新增检查项：
1. ✅ 神兽档案完整性检查（40个字段）
2. ✅ 神兽形象一致性检查（跨镜头）
3. ✅ Nirath栖息地匹配检查
4. ✅ 神兽-人类角色同框合规检查

### 5.3 与运镜控制系统的集成

新增`beastCameraProfile`字段，每只神兽自带运镜配置：
```json
{
  "beastCameraProfile": {
    "defaultShotSize": "extreme_wide",
    "defaultMovement": "slow_push",
    "preferredAngles": ["low_angle", "aerial"],
    "avoidAngles": ["close_up"],
    "lightingPreference": "背光剪影"
  }
}
```

---

## 六、文件目录结构

```
/workspace/
├── systems/
│   ├── beast-archive/                    # 神兽档案库核心
│   │   ├── beast-archive-schema.json     # JSON Schema定义
│   │   ├── beast-prompt-injector.js      # Prompt注入器
│   │   ├── beast-consistency-guard.js    # 一致性守卫
│   │   ├── nirath-world-sync.js          # 世界观校准器
│   │   ├── beast-camera-advisor.js       # 运镜推荐器
│   │   ├── beast-scene-generator.js      # 场景生成器
│   │   ├── md-beast-parser.js            # MD→JSON转换器
│   │   └── beast-index.json              # 神兽索引（100+只）
│   │
│   └── beast-database/                   # 神兽数据存储
│       ├── beasts/                       # 个体档案
│       │   ├── zhu-long.json             # 烛龙
│       │   ├── ying-long.json            # 应龙
│       │   └── ... (40+ files)
│       ├── habitats/                     # 栖息地模板
│       │   ├── yongye-lieg.json          # 永夜裂谷
│       │   ├── qingqiu-lingyuan.json     # 青丘灵原
│       │   └── ...
│       ├── relationships.json            # 神兽关系图谱
│       └── camera-presets.json          # 运镜预设库
│
└── characters/                           # 人类角色（已有）
    ├── xiaoG/
    └── ...
```

---

## 七、里程碑计划

| 阶段 | 任务 | 预计时长 | 产出 |
|------|------|----------|------|
| P0 | Schema设计+核心引擎编码 | 2小时 | 6个.js文件 |
| P1 | 第一批40只神兽JSON导入 | 1.5小时 | 40个.json文件 |
| P2 | 与人类角色档案库集成测试 | 1小时 | 集成验证报告 |
| P3 | 与Prompt构建器耦合 | 1小时 | Prompt自动注入 |
| P4 | 与预生产报告系统集成 | 0.5小时 | 神兽检查项 |
| P5 | Mock测试+生产发布 | 1小时 | v6.0-patch20 |

---

## 八、技术亮点

1. **Prompt碎片系统**：每只神兽被拆解为可组合的Prompt片段，像乐高一样拼接
2. **一致性守卫**：硬规则拦截（颜色/形态/能力），防止AI"发挥过度"
3. **关系图谱**：神兽间的关系驱动故事线自动生成
4. **栖息地模板**：复用场景描述，减少Prompt字数浪费
5. **多批次即插即用**：MD文件来了直接灌入，自动解析

---

*设计完成 | 等待队长确认后进入编码阶段*
