# 香香彩虹桥（HyperrealitySystem）镜头字段规范 v2.1.4-fix9

> **文档目的**：明确预生产链路最终输出的完整字段列表、业务含义、生成来源及在渲染中的作用。
>
> **适用范围**：香香彩虹桥 v2.1.4-fix9+，所有预生产任务
>
> **版本**：v1.0 | 日期：2026-06-23

---

## 一、字段总览（12个核心字段）

| 序号 | 字段名 | 英文标识 | 优先级 | 渲染作用 | 生成环节 |
|------|--------|----------|--------|----------|----------|
| 1 | 【约束】 | constraint | P0 | 告诉Seedance基础参数 | PromptFusionAgent |
| 2 | 【基础】 | baseline | P0 | 画质基础词 | PromptFusionAgent |
| 3 | 【场景】 | scene | P0 | 环境空间描述 | SceneDesignAgent + PromptFusionAgent |
| 4 | 【角色】 | character | P0 | 人物身份/服装/姿态 | ScriptEngine + PromptFusionAgent |
| 5 | 【动作】 | action | P0 | 角色动作+镜头运动 | VisualLanguageAgent + PromptFusionAgent |
| 6 | 【定妆照】 | portraits | P0 | 角色一致性引用 | 系统注入（charactersDir） |
| 7 | 【台词】 | dialogue | P0 | 口型同步（Seedance原生） | ScriptEngine + PromptFusionAgent |
| 8 | 【时间轴】 | timeline | P1 | 镜头内部导演调度 | PromptFusionAgent |
| 9 | 【情绪】 | mood | P1 | 情绪氛围关键词 | VisualLanguageAgent + PromptFusionAgent |
| 10 | 【音频】 | audio | P2 | 环境音效+背景音乐 | AudioDesignAgent + PromptFusionAgent |
| 11 | 【负面约束】 | negative | P0 | 排除项（no text, no cartoon等） | global-negative-prompts.js + PromptFusionAgent |
| 12 | 【角色一致性】 | consistency | P0 | 跨镜角色形象统一 | 系统注入 + PromptFusionAgent |

---

## 二、字段详细规范

### 2.1 【约束】constraint

**业务含义**：画面基础参数约束，告诉渲染引擎"这是什么格式的画面"。

**应包含内容**：
```
16:9 cinematic, 24fps cinematic, no text, no subtitle, no caption, no watermark
```

**生成方式**：
- **主来源**：PromptFusionAgent system prompt 硬编码模板
- **辅助**：画幅比例从剧本 metadata（aspectRatio）传入

**在渲染中的作用**：
- Seedance 解析画幅比例（16:9）
- 设置帧率参数（24fps cinematic）
- 基础禁止项（text/subtitle/watermark）

---

### 2.2 【基础】baseline

**业务含义**：画质基础描述词，决定画面质感等级。

**应包含内容**：
```
hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film
```

**生成方式**：
- **主来源**：PromptFusionAgent system prompt 硬编码模板
- **风格适配**：根据用户指定的"全写实/好莱坞质感"调整（如增加 film grain, 35mm texture）

**在渲染中的作用**：
- 告诉 Seedance "这是电影级画质"
- 控制纹理细节级别（ultra-detailed）
- 光影层次（HDR, detail in highlights and shadows）

---

### 2.3 【场景】scene

**业务含义**：具体环境空间描述，这是画面"在哪里发生"。

**应包含内容**（按优先级）：
1. **地点**：医院健康宣教室 / 三甲医院检验科走廊 / 医生诊室
2. **照明**：白色荧光灯均匀照明 / 冷白色LED顶灯连续照射
3. **关键物体**：木质讲台 / 不锈钢检验窗口 / 听诊器与血压计
4. **材质细节**：墙面乳胶漆质感 / 地面浅色耐磨塑胶材质
5. **空间深度**：走廊纵深延伸 / 空间纵深约四米

**生成方式**：
- **主来源**：SceneDesignAgent（LLM生成，基于剧本场景描述）
- **PromptFusion 融合**：LLM 创造性融合 L3-L7 元素
- **写实检查**：强制替换科幻/抽象词汇（全息→医院走廊）

**在渲染中的作用**：
- Seedance 根据描述生成对应 3D 环境
- 光影反射基于材质（不锈钢台面反射冷光）
- 空间深度影响景深效果

---

### 2.4 【角色】character

**业务含义**：画面中的人物身份、服装、姿态。

**应包含内容**：
1. **身份**：健康科普主讲人 / 穿警服的陈女士
2. **服装**：藏青色警服外套 / 内搭浅色衬衫
3. **外貌**：短发 / 站姿挺拔
4. **姿态**：面向镜头站立 / 双手自然张开

**生成方式**：
- **主来源**：ScriptEngine 剧本中的角色设定
- **PromptFusion 融合**：LLM 根据场景类型调整姿态
- **服装锁定**：v2.1.4-fix9-P4 强制使用原始角色设定中的服装（禁止LLM擅自更改）

**在渲染中的作用**：
- Seedance 根据描述生成人物形象
- 服装颜色/款式影响画面色调
- 姿态决定角色动势

---

### 2.5 【动作】action

**业务含义**：角色动作 + 镜头运动，这是"画面在怎么动"。

**应包含内容**（分镜式描述）：
1. **镜头运动**：镜头缓慢推近 / 稳定器跟拍 / 固定机位
2. **角色动作**：站立讲台前做介绍手势 / 沿走廊缓步前行 / 手指轻触医学挂图
3. **视线方向**：注视镜头 / 侧头指向检验窗口
4. **身体姿态**：身体微微前倾 / 双手交叠置于膝上

**生成方式**：
- **主来源**：VisualLanguageAgent（LLM根据场景类型推断运镜）
- **PromptFusion 融合**：LLM 创造性融合角色动作+镜头运动
- **写实检查**：v2.1.4-fix9-P9 禁止科幻/抽象动作（全息投影→自然手势）

**在渲染中的作用**：
- Seedance 根据描述生成镜头运动（推近/拉出/跟拍）
- 角色动作影响画面动态
- 视线方向决定观众注意力焦点

---

### 2.6 【定妆照】portraits

**业务含义**：角色定妆照引用路径，用于 Seedance 角色一致性渲染。

**应包含内容**：
```
image://characters/chen-zhuo/portraits/chen-zhuo-front.png
image://characters/chen-zhuo/portraits/chen-zhuo-threeQuarter.png
image://characters/chen-zhuo/portraits/chen-zhuo-closeup.png
image://characters/chen-zhuo/portraits/chen-zhuo-side.png
```

**生成方式**：
- **主来源**：系统从 `charactersDir` 自动注入
- **路径规则**：`image://characters/{character_id}/portraits/{filename}.png`
- **检查**：FieldGuard 校验文件存在性

**在渲染中的作用**：
- Seedance 读取定妆照作为角色参考图
- 确保跨镜头角色形象一致
- 多角度照片提升一致性成功率

---

### 2.7 【台词】dialogue

**业务含义**：角色直接说的话，用于 Seedance 原生口型渲染。

**应包含内容**：
```
【台词】"大家好，我是陈卓。今天说说横纹肌溶解的症状。"
```

**格式要求**：
- 必须用 `"` 包裹
- 不要写"画外音""旁白"（P0级约束：禁止旁白字段）
- 角色直接对镜头说话
- 多句台词用分号或句号分隔

**生成方式**：
- **主来源**：ScriptEngine 剧本台词生成
- **PromptFusion 提取**：从剧本台词字段提取
- **限制**：完整台词文本，禁止截断（120字符限制已移除）

**在渲染中的作用**：
- Seedance 原生口型同步（ lipsync ）
- 台词与画面同步渲染
- 不走单独TTS通道

---

### 2.8 【时间轴】timeline ⭐ 核心改进字段

**业务含义**：**镜头内部的微观导演调度**，描述运镜/构图/情绪/灯光如何随时间变化。

> ⚠️ **注意**：不是"这个镜头在整片的位置"（如 T00:08-T00:20），而是"这个镜头内部发生了什么"。

**应包含内容**（分段式，至少3段）：

```
0-2s: 全景 establishing，冷白光均匀照明，冷静专业氛围，环境展示
→ 2-5s: 推近中景，人物入画，暖光渐入左前方，亲切感升温
→ 5-8s: 特写脸部，侧光从右上方45度强化，警示感峰值，台词高潮
→ 8-10s: 缓慢拉出中景，柔光平复，安心收尾，情绪回落
```

**每段必须包含**：
| 维度 | 说明 | 示例 |
|------|------|------|
| **时间区间** | 这一段占镜头的几秒 | 0-2s |
| **运镜动作** | 镜头怎么动 | 全景 establishing / 推近中景 / 特写 |
| **构图变化** | 画面内容怎么变 | 环境展示 → 人物入画 → 脸部特写 |
| **情绪走向** | 观众感受怎么变 | 冷静 → 亲切 → 警示 → 安心 |
| **灯光变化** | 光线怎么变 | 冷白光 → 暖光渐入 → 侧光强化 → 柔光平复 |

**生成方式**：
- **主来源**：PromptFusionAgent LLM 生成（基于场景类型+情绪阶段+时长）
- **system prompt 指导**：明确要求按5维度分段
- **兜底**：按 duration 自动分3段（0-25%-60%-100%）

**在渲染中的作用**：
- 告诉 Seedance "这个镜头内部有变化，不是静态画面"
- 指导镜头运动节奏（推近/拉出/跟拍的时间分布）
- 控制光影变化（何时加暖光、何时强化侧光）
- 影响角色动作节奏（何时做手势、何时停顿）

---

### 2.9 【情绪】mood

**业务含义**：情绪氛围关键词，影响画面色调和角色表情。

**应包含内容**：
```
冷静，专业，关切，警示，安心
```

**生成方式**：
- **主来源**：VisualLanguageAgent 根据情绪阶段（establishing/rising/climax/resolve）推断
- **PromptFusion 融合**：LLM 根据场景内容调整

**在渲染中的作用**：
- 影响 Seedance 色调生成（冷色调→暖色调）
- 影响角色表情（严肃→微笑）
- 影响光影对比度（紧张→高对比，温馨→柔光）

---

### 2.10 【音频】audio

**业务含义**：环境音效 + 背景音乐描述，用于后期音频设计。

**应包含内容**：
```
医院室内低频环境音，轻微空调气流声，柔和科普配乐渐入，无嘈杂人声
```

**生成方式**：
- **主来源**：AudioDesignAgent（LLM根据场景环境生成）
- **分类**：环境音（底噪）+ 音乐（情绪铺垫）

**在渲染中的作用**：
- Seedance 目前不支持音频渲染，此字段用于后期制作
- 指导视频编辑添加背景音乐
- 指导音效师添加环境音

---

### 2.11 【负面约束】negative

**业务含义**：排除项，告诉 Seedance "画面中不要出现什么"。

**应包含内容**：

**中文侧**（L1层）：
```
禁止画面内出现任何文字（片头主副标题除外），含墙面/物品/文件/屏幕/服饰上的中英文、字母、数字、标点、商标、标签、招牌、路牌等一切可读内容；禁止一切印刷体、手写体、电子屏文字、发光字、字幕、水印
```

**英文侧**（L3层）：
```
no text anywhere, no letters words numbers labels logos signs trademarks, no readable content on walls objects documents screens clothing packaging
```

**通用排除**：
```
no watermark, no logo, no cartoon style, no flat lighting, no 3D render, no anime, no sci-fi elements
```

**生成方式**：
- **主来源**：global-negative-prompts.js 模块
- **动态注入**：ProductionEngine 根据镜头类型（片头/内容）选择不同策略
- **片头镜头**：`generateForOpeningShot()` — 仅允许主副标题
- **内容镜头**：`generateForContentShot()` — 全面禁止

**在渲染中的作用**：
- Seedance 负面提示词（negative prompt）
- 排除低质量/不符合要求的内容
- 确保角色一致性（no different face）

---

### 2.12 【角色一致性】consistency

**业务含义**：跨镜头角色形象统一约束。

**应包含内容**：
```
保持陈卓角色形象一致，短发警服造型不变，面部特征与体型每帧统一，同一人出镜
```

**生成方式**：
- **主来源**：系统注入（基于角色定妆照）
- **PromptFusion 强化**：LLM 根据角色信息生成

**在渲染中的作用**：
- 配合定妆照，确保6个镜头的陈卓是同一个人
- 防止角色形象漂移（如发型变化、服装变化）

---

## 三、业务视角规范（从导演/制片人角度）

### 3.1 字段分层

| 层级 | 字段 | 导演视角 | 制片人视角 |
|------|------|----------|-----------|
| **L1 画面基底** | 【约束】【基础】 | "用什么格式拍" | 技术规格确认 |
| **L2 空间建立** | 【场景】 | "在哪里拍" | 场地/布景需求 |
| **L3 人物建立** | 【角色】【定妆照】 | "谁出镜" | 演员/角色确认 |
| **L4 动态调度** | 【动作】【时间轴】 | "怎么拍+怎么动" | 分镜脚本 |
| **L5 情绪渲染** | 【情绪】【音频】 | "观众感受" | 后期方向 |
| **L6 质量控制** | 【负面约束】【角色一致性】 | "不要什么" | 风控检查 |
| **L7 叙事核心** | 【台词】 | "说什么" | 文案确认 |

### 3.2 各角色关注点

| 角色 | 关注字段 | 为什么 |
|------|----------|--------|
| **导演** | 【动作】【时间轴】【情绪】 | 这是导演分镜的核心 |
| **摄影师** | 【约束】【基础】【场景】 | 技术参数+环境光线 |
| **演员** | 【角色】【台词】【动作】 | 表演指导 |
| **后期** | 【音频】【情绪】 | 音乐+音效设计 |
| **制片人** | 【场景】【角色】 | 资源协调 |
| **AI工程师** | 【负面约束】【角色一致性】【定妆照】 | 质量控制 |

---

## 四、字段生产链路（完整数据流）

### 4.1 链路总图

```
用户意图输入
    ↓
[Layer 0] 需求清单确认（人工确认）
    ↓
[Layer 1] 剧本引擎（ScriptEngine）
    ├─ 意图解析 → 视频类型、风格、角色
    ├─ 剧本生成 → 场景列表、台词、角色动作
    ├─ 角色系统 → character对象（含portraitPaths）
    └─ 输出：ScriptBlueprint（6场景+16句台词+角色设定）
    ↓
[适配层] 格式转换
    ├─ 场景 → shot结构（timing/duration/sceneType）
    ├─ 角色 → character引用
    └─ 台词 → dialogueText
    ↓
[Layer 2] 制作引擎（ProductionEngine）
    ├─ [Phase 1] SceneDesignAgent → 【场景】描述
    ├─ [Phase 1] OpeningDesignAgent → 片头设计
    ├─ [Phase 2] VisualLanguageAgent → 【动作】【情绪】运镜+氛围
    ├─ [Phase 2] AudioDesignAgent → 【音频】音效+音乐
    ├─ [Phase 2] ContinuityReviewAgent → 连续性检查
    └─ [Phase 3] PromptFusionAgent → 12字段融合
    ↓
[导演技能] Hollywood Director Skills
    ├─ 剧情_斯皮尔伯格_雨夜手持.md → 增强动作描述
    ├─ 剧情_斯皮尔伯格_史诗斯坦尼康.md → 增强运镜
    └─ 剧情_斯皮尔伯格_温情斯坦尼康.md → 增强情绪
    ↓
[FieldGuard] 字段校验
    ├─ 检查必填字段（约束/基础/场景/角色/动作/台词/负面约束）
    ├─ 检查定妆照引用
    └─ 检查负面提示词注入
    ↓
输出：6个镜头的完整提示词（含12字段）
```

### 4.2 各字段生成链路详解

#### 【场景】scene

```
用户意图 → ScriptEngine（剧本描述："医院健康宣教室"）
    ↓
SceneDesignAgent LLM 融合 → "白色荧光灯均匀照明，白墙面贴有骨骼肌解剖图..."
    ↓
写实检查（禁止全息/虚拟/投影）→ 强制替换为写实场景
    ↓
PromptFusionAgent 融合 → 最终场景描述
```

#### 【动作】action

```
VisualLanguageAgent（根据场景类型推断运镜）
    ├─ establishing → 缓慢推近/全景拉出
    ├─ conflict → 手持微晃/快速切换
    └─ emotional_climax → 特写强化/稳定器跟拍
    ↓
PromptFusionAgent 融合角色动作+镜头运动
    ↓
写实检查（禁止科幻动作）→ 强制替换为写实动作
```

#### 【时间轴】timeline

```
PromptFusionAgent system prompt 明确要求分段式调度
    ↓
LLM 根据以下输入生成分段：
    ├─ 镜头时长（duration: 12s）
    ├─ 场景类型（establishing/conflict/climax）
    ├─ 情绪阶段（冷静→紧张→警示）
    └─ 角色动作（站立→手势→注视）
    ↓
输出格式：
    0-2s: 全景 establishing，冷白光，冷静专业
    → 2-5s: 推近中景，人物入画，暖光渐入，亲切感
    → 5-8s: 特写脸部，台词高潮，侧光强化，警示感峰值
    → 8-10s: 缓慢拉出，柔光平复，安心收尾
```

#### 【负面约束】negative

```
global-negative-prompts.js 模块
    ├─ L1 约束（中文）→ 2条覆盖全部文字禁止
    ├─ L3 约束（英文）→ 1条覆盖全部
    ├─ generateForOpeningShot() → 片头允许主副标题
    └─ generateForContentShot() → 内容镜全面禁止
    ↓
ProductionEngine 动态注入
    ├─ 片头判断：shot.type === 'opening' → 允许标题
    └─ 内容判断：其他 → 全面禁止
    ↓
PromptFusionAgent 融合 → 最终负面约束字符串
```

---

## 五、字段质量检查清单

### 5.1 预生产输出检查

| 检查项 | 合格标准 | 检查工具 |
|--------|----------|----------|
| 字段数量 | ≥10个（P0字段必须全） | FieldGuard |
| 【场景】写实性 | 无科幻/抽象词汇 | 正则快筛 |
| 【动作】写实性 | 无全息/虚拟/投影 | 正则快筛 |
| 【台词】完整性 | 无截断，无旁白 | 长度检查 |
| 【时间轴】分段数 | ≥3段 | 正则检查 |
| 【负面约束】注入 | 含"no text"+"禁止文字" | 关键字检查 |
| 【定妆照】路径 | 正确引用角色目录 | 文件存在检查 |
| 跨集边界 | 无预告下集内容 | 正则快筛 |

### 5.2 常见问题

| 问题 | 根因 | 解决方案 |
|------|------|----------|
| 字段缺失 | Phase-3预算不足走兜底 | 提升预算到20分钟 |
| 时间轴错误 | LLM生成T00:00开始 | 修复system prompt定义 |
| 场景不写实 | LLM输出科幻词汇 | 强制替换写实场景池 |
| 角色服装错误 | LLM擅自更改服装 | 服装锁定（v2.1.4-fix9-P4） |
| 负面约束缺失 | 注入逻辑错误 | 检查片头/内容镜判断 |

---

## 六、版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-23 | 初始版本，基于 v2.1.4-fix9 |

---

*文档结束*
