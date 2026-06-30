# SuperMickey 25维核心提示词字段 — 产出机制深度审计报告

**版本:** v2.1.6-production
**审计日期:** 2026-06-30
**审计范围:** 25个P0核心字段的完整产出链路、质量保障机制、风险点

---

## 一、报告概述

### 1.1 为什么要做这个审计

当前系统的25维提示词字段，**不是每个都有强保障机制**。部分字段来自LLM创作（有灵气但不可控），部分字段来自规则兜底（有保障但缺乏灵气），部分字段完全没有产出机制（依赖硬编码默认值）。

**核心问题：字段质量参差不齐。** 导演指令、约束、负面约束等字段被硬编码为通用模板；时间轴字段虽然生成但缺乏叙事节奏设计；运镜与情绪不同步。

### 1.2 审计方法

- **代码走读:** 逐字段追踪从Layer 0到Layer 3的完整流转路径
- **机制分析:** 识别每个字段的"生成Agent"、"校验规则"、"兜底机制"
- **质量评估:** 判断字段是"LLM创作"、"规则生成"还是"硬编码"，评估质量保障强度

---

## 二、25维字段完整产出机制图谱

### 字段产出链路总览

```
用户意图
  ↓
Layer 0: ScriptEngine → 剧本结构、场景大纲、角色、台词
  ↓
Layer 1: ProductionEngine Phase 1
  ├─ SceneDesignAgent → scene, mood, action, emotional_target
  └─ OpeningDesignAgent → 片头数据 (title, subtitle, audioLayer)
  ↓
Layer 2: ProductionEngine Phase 2
  ├─ VisualLanguageAgent → cameraString, lightingString, timeline(结构化)
  ├─ AudioDesignAgent → audioString
  └─ ContinuityReviewAgent → 连续性审查建议
  ↓
Layer 3: ProductionEngine Phase 3
  └─ PromptFusionAgent → 25维字段融合输出
     ├─ 主LLM调用：一次性生成25个字段
     ├─ 缺失补齐：定向调用LLM补缺失字段
     ├─ 最小降级：逐个字段调用LLM
     └─ 规则兜底：硬编码默认值
  ↓
最终输出：标准化Prompt（【导演指令】【约束】【基础】...）
```

---

## 三、逐字段深度分析

### 字段分类体系

按产出机制强度分为四类：
- **A级（强保障）**: 有LLM创作 + 校验规则 + 兜底机制
- **B级（中保障）**: 有LLM创作 + 简单校验，兜底较弱
- **C级（弱保障）**: 主要依赖规则生成，缺乏LLM创作
- **D级（无保障）**: 硬编码默认值，无动态生成

---

### 字段1: director_instruction（导演指令）

**当前机制:**
- **来源:** PromptFusionAgent._defaultFieldValue()
- **生成方式:** 硬编码默认值
- **默认值:** "好莱坞电影级质感，写实风格，专业摄影布光，8K超高清"
- **校验规则:** 无
- **兜底机制:** 无（本身就是兜底）

**问题分析:**
- ❌ **完全无LLM创作**：所有镜头使用同一个导演指令
- ❌ **无个性化**：孙悟空vs二郎神的史诗战斗和科普视频的导演指令一模一样
- ❌ **无动态适配**：不根据情绪弧线、风格、时长调整

**建议:**
1. 从blueprint的`style` + `mood` + `creativeIntensity`动态生成
2. 增加导演风格数据库：史诗/悬疑/温情/恐怖等风格模板
3. 让导演指令在Phase 1就生成，而不是Phase 3兜底

**质量评级: D级（无保障）**

---

### 字段2: constraint（技术约束）

**当前机制:**
- **来源:** PromptFusionAgent._assembleStandardPrompt()
- **生成方式:** 规则生成（硬编码模板 + 动态参数）
- **动态参数:** 画幅比例（ratio）、分辨率、格式、帧率
- **校验规则:** 无
- **兜底机制:** 无（本身就是兜底）

**问题分析:**
- ⚠️ 有基础动态参数（ratio），但大部分是硬编码
- ⚠️ "no text"重复出现多次，冗长但有效
- ✅ 至少包含画幅、分辨率、格式、帧率等核心技术参数

**建议:**
1. 从blueprint的`platform`（抖音/视频号/YouTube）动态调整分辨率
2. 从`style`动态调整帧率（24fps电影感 vs 60fps流畅感）
3. 从`duration`动态调整格式（短视频MP4 vs 长视频MOV）

**质量评级: C级（弱保障）**

---

### 字段3: baseline（画质基础）

**当前机制:**
- **来源:** PromptFusionAgent._defaultFieldValue()
- **生成方式:** 硬编码默认值
- **默认值:** "8K resolution, cinematic quality, highly detailed, photorealistic..."
- **校验规则:** 无
- **兜底机制:** 无

**问题分析:**
- ❌ 完全硬编码，所有项目相同
- ❌ 没有根据风格调整（写实vs动画vs纪录片）
- ❌ 没有根据时长调整（30秒短视频不需要8K，浪费token）

**建议:**
1. 从`style`动态选择：写实→photorealistic，动画→cartoon style，纪录片→documentary
2. 从`duration`调整分辨率：30秒→4K够用，90秒→8K合理
3. 从`creativeIntensity`调整细节词：低→standard，高→intricate textures

**质量评级: D级（无保障）**

---

### 字段4: scene（场景）

**当前机制:**
- **来源1:** SceneDesignAgent（LLM生成）
- **来源2:** PromptFusionAgent（LLM补齐）
- **生成方式:** 
  1. Phase 1 SceneDesignAgent 根据剧本生成场景描述
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:** 
  1. 禁止词汇检查（全息、虚拟、投影等）
  2. 最低字符数 ≥ 120
  3. 强制写实（替换科幻场景）
- **兜底机制:** 
  1. 含禁止词汇→使用兜底场景池
  2. LLM失败→使用兜底场景池

**问题分析:**
- ✅ 有LLM创作（SceneDesignAgent）
- ✅ 有校验规则（禁止词汇 + 最低字符数）
- ✅ 有兜底机制（兜底场景池）
- ⚠️ 兜底场景池是硬编码的（医院场景），缺乏个性化
- ⚠️ 最低字符数120是固定值，不根据镜头时长调整

**建议:**
1. 兜底场景池从blueprint动态生成，不是硬编码
2. 根据镜头时长调整场景描述长度：5秒→80字，15秒→150字
3. 增加场景与情绪的关联校验（紧张场景不能是明亮温馨的）

**质量评级: B级（中保障）**

---

### 字段5: lighting（灯光）

**当前机制:**
- **来源1:** VisualLanguageAgent（LLM生成lightingString）
- **来源2:** PromptFusionAgent（LLM补齐）
- **生成方式:**
  1. Phase 2 VisualLanguageAgent 根据场景和情绪生成灯光方案
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:**
  1. 最低字符数 ≥ 150
  2. 必须包含主光/辅光/色温等要素（隐含在prompt中）
- **兜底机制:** 规则兜底默认值

**问题分析:**
- ✅ 有LLM创作（VisualLanguageAgent）
- ✅ 有校验规则（最低字符数）
- ⚠️ 灯光与情绪关联较弱：紧张场景可能生成"柔和灯光"
- ⚠️ 没有校验"色温与场景时间匹配"（白天5600K vs 黄昏3200K）

**建议:**
1. 增加灯光-情绪关联表：紧张→硬光/高对比，温馨→柔光/低对比
2. 增加灯光-时间关联表：白天→5600K，黄昏→3200K，夜晚→2800K
3. 从blueprint的`timeOfDay`读取并强制匹配

**质量评级: B级（中保障）**

---

### 字段6: composition（构图）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 最低字符数 ≥ 100
- **兜底机制:** 规则默认值

**问题分析:**
- ❌ 没有专门的Agent负责构图
- ❌ 构图与运镜没有关联校验（构图说"中景"但运镜说"特写"）
- ❌ 没有构图与情绪的关联（紧张情绪应该用对称/居中构图，而不是分散）

**建议:**
1. 新增CompositionAgent（或在VisualLanguageAgent中增加）
2. 建立构图-情绪关联表：紧张→对称/居中，自由→三分法/对角线
3. 建立构图-运镜校验规则：构图的景别必须与运镜的shot_size一致

**质量评级: C级（弱保障）**

---

### 字段7: color_palette（色彩）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 最低字符数 ≥ 80
- **兜底机制:** 规则默认值

**问题分析:**
- ❌ 没有专门的Agent负责色彩
- ❌ 色彩与情绪没有强关联（悲伤情绪用暖色调是错误）
- ❌ 没有跨镜头色彩一致性校验

**建议:**
1. 新增ColorPaletteAgent（或在VisualLanguageAgent中增加）
2. 建立色彩-情绪关联表：紧张→高对比/冷色，温馨→暖色/低对比，史诗→金色/饱和
3. 增加跨镜头色彩一致性校验：同一场景的所有镜头色彩方案必须一致

**质量评级: C级（弱保障）**

---

### 字段8: depth_of_field（景深）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 最低字符数 ≥ 80
- **兜底机制:** 规则默认值

**问题分析:**
- ❌ 没有专门的Agent负责景深
- ❌ 景深与叙事重点没有关联（特写应该用浅景深，全景应该用深景深）
- ❌ 没有景深与镜头类型的关联

**建议:**
1. 建立景深-景别关联表：特写→浅景深(f/2.8)，全景→深景深(f/8)
2. 建立景深-情绪关联表：紧张→浅景深（聚焦主体），史诗→深景深（展示环境）
3. 从composition的shot_size自动推导

**质量评级: C级（弱保障）**

---

### 字段9: camera_movement（运镜）

**当前机制:**
- **来源1:** VisualLanguageAgent（LLM生成cameraString + timeline）
- **来源2:** PromptFusionAgent（LLM补齐）
- **生成方式:**
  1. Phase 2 VisualLanguageAgent 根据场景、情绪、台词生成运镜方案
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:** 最低字符数 ≥ 100
- **兜底机制:** 规则默认值（"0-3s固定机位...3-6s缓慢推近..."）

**问题分析:**
- ✅ 有LLM创作（VisualLanguageAgent）
- ✅ 有结构化数据（camera对象：shot_size, movement, angle, lens, speed）
- ⚠️ 运镜与时间轴(timeline)不同步：timeline说"高潮"但运镜说"固定机位"
- ⚠️ 没有运镜与情绪的关联校验：紧张情绪应该用 handheld/dolly_fast，而不是static
- ⚠️ 没有相邻镜头运镜的衔接校验（上一个pull_out，下一个应该static或push_in）

**建议:**
1. 建立运镜-情绪关联表：紧张→handheld/fast，平静→static/slow
2. 建立相邻镜头衔接规则：pull_out→static（缓冲），push_in→handheld（紧张升级）
3. 强制运镜与timeline同步：timeline的"高潮"必须有对应camera_movement的"fast push"

**质量评级: B级（中保障）**

---

### 字段10: character（角色）

**当前机制:**
- **来源1:** 剧本中的角色设定（character_system）
- **来源2:** PromptFusionAgent（LLM补齐）
- **生成方式:**
  1. Layer 1 ScriptGenerator 从角色系统读取角色描述
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:**
  1. 角色服装锁定（从原始角色设定提取）
  2. 禁止LLM擅自更改角色服装
- **兜底机制:** 规则默认值

**问题分析:**
- ✅ 有角色系统作为源头
- ✅ 有服装锁定机制（防止LLM擅自改服装）
- ⚠️ 角色描述与角色性格没有强关联（没有"暴躁"→"眉头紧锁"的推导）
- ⚠️ 没有角色与场景的空间关系（角色在场景中的位置、与环境的互动）

**建议:**
1. 从角色系统的`personality` + `appearance`动态生成角色描述
2. 增加角色-情绪关联：愤怒→"肌肉紧绷，咬牙切齿"，悲伤→"肩膀下沉，眼神涣散"
3. 增加角色-场景关联：角色在场景中的位置、移动路径、与环境的互动

**质量评级: B级（中保障）**

---

### 字段11: costume（服装）

**当前机制:**
- **来源:** 角色系统的 costume 字段
- **生成方式:** 直接从角色系统读取
- **校验规则:** 角色服装锁定（防止LLM擅自更改）
- **兜底机制:** 规则默认值

**问题分析:**
- ✅ 有角色系统作为源头
- ✅ 有服装锁定机制
- ✅ 与character字段一致（从同一来源读取）
- ⚠️ 服装与场景没有关联（沙滩场景穿西装？虽然用户指定但可能不合理）
- ⚠️ 服装与动作没有关联（舞蹈场景穿紧身衣 vs 战斗场景穿铠甲）

**建议:**
1. 增加服装-场景合理性校验（非强制，仅warning）
2. 增加服装-动作关联：战斗场景→服装有破损/磨损细节
3. 从角色系统的`costume`字段直接读取，不经过LLM创作（避免被篡改）

**质量评级: B级（中保障）**

---

### 字段12: makeup（化妆）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 无
- **兜底机制:** 规则默认值（"素颜或淡妆，妆容自然真实..."）

**问题分析:**
- ❌ 没有专门的Agent负责化妆
- ❌ 化妆与场景没有关联（手术室场景应该无菌/无妆，而不是淡妆）
- ❌ 化妆与情绪没有关联（悲伤→泪痕，愤怒→面红，战斗→汗水/血迹）

**建议:**
1. 建立化妆-场景关联表：手术室→无菌/无妆，战场→汗水/血迹/泥土，舞会→精致妆容
2. 建立化妆-情绪关联表：悲伤→泪痕/黑眼圈，愤怒→面红/青筋，疲惫→苍白/黑眼圈
3. 从角色系统的`appearance`字段提取基础特征

**质量评级: C级（弱保障）**

---

### 字段13: action（动作）

**当前机制:**
- **来源1:** SceneDesignAgent（LLM生成）
- **来源2:** PromptFusionAgent（LLM补齐）
- **生成方式:**
  1. Phase 1 SceneDesignAgent 根据剧本和台词生成动作描述
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:**
  1. 禁止词汇检查（全息、空间扭曲等）
  2. 最低字符数 ≥ 120
  3. 强制写实（替换科幻动作）
- **兜底机制:** 规则兜底（写实动作模板）

**问题分析:**
- ✅ 有LLM创作（SceneDesignAgent）
- ✅ 有校验规则（禁止词汇 + 最低字符数）
- ✅ 有兜底机制
- ⚠️ 动作与台词没有强关联（台词说"我爱你"但动作是"转身离去"）
- ⚠️ 动作与运镜没有关联（动作说"快速奔跑"但运镜是"固定机位"）
- ⚠️ 动作缺乏时间轴（动作何时开始、何时结束、何时变化）

**建议:**
1. 建立动作-台词同步校验：台词的情感必须与动作匹配
2. 建立动作-运镜同步校验：快速动作→fast camera，缓慢动作→slow camera
3. 将动作拆解到时间轴：T00:00站立→T00:02抬手→T00:04挥手

**质量评级: B级（中保障）**

---

### 字段14: props（道具）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 无
- **兜底机制:** 规则默认值（"场景中必要的写实道具..."）

**问题分析:**
- ❌ 没有专门的Agent负责道具
- ❌ 道具与场景没有强关联（厨房场景应该有锅碗瓢盆，而不是"必要道具"）
- ❌ 道具与动作没有关联（角色拿刀应该有刀，角色写字应该有笔）
- ❌ 没有道具与台词的关联（台词提到"报告单"但道具没有）

**建议:**
1. 从台词中提取关键词，自动推断道具（"报告单"→prop: report）
2. 从场景类型推断道具（厨房→cooking_utensils, 医院→medical_equipment）
3. 从动作推断道具（"拿刀"→prop: knife）

**质量评级: C级（弱保障）**

---

### 字段15: portraits（定妆照）

**当前机制:**
- **来源:** 角色系统的 portraitPaths / characterRef
- **生成方式:** 从角色系统读取路径，拼接成 image:// 格式
- **校验规则:** 文件路径存在性校验（在RenderingEngine中）
- **兜底机制:** 默认路径 "image://characters/default/portrait.png"

**问题分析:**
- ✅ 有角色系统作为源头
- ✅ 有文件路径校验
- ✅ 与角色字段一致
- ⚠️ 没有校验"角度匹配"（正面照用于特写镜头？）
- ⚠️ 没有校验"定妆照与场景光线匹配"（白天场景用暖色定妆照？）

**建议:**
1. 从镜头类型选择角度：正面→front，侧面→side，特写→closeup
2. 从场景光线选择定妆照色调：白天→冷色调，黄昏→暖色调
3. 增加定妆照与场景的一致性校验

**质量评级: B级（中保障）**

---

### 字段16: dialogue（台词）

**当前机制:**
- **来源1:** 剧本中的台词（ScriptGenerator生成）
- **来源2:** dialogueBlocks（对话块，包含speaker/trigger/manner/timing）
- **生成方式:**
  1. Layer 1 ScriptGenerator 根据剧本生成台词
  2. 在PromptFusionAgent中渲染为Seedance 2.0内联格式
- **校验规则:**
  1. 台词必须是角色直接对话（禁止旁白/画外音）
  2. 台词中不得出现文字（"no text anywhere in frame"）
- **兜底机制:** 无（如果剧本没有台词，则为空）

**问题分析:**
- ✅ 有剧本作为源头
- ✅ 有Seedance 2.0内联格式支持（dialogueBlocks）
- ✅ 有台词类型校验（禁止旁白）
- ⚠️ 台词与动作没有强关联（台词说"跑"但动作是"走"）
- ⚠️ 台词与情绪没有关联（悲伤台词用欢快语气？）
- ⚠️ 没有台词与时间的精确同步（台词何时开始、持续多久）

**建议:**
1. 从台词情感推断动作（"我爱你"→温柔动作，"杀"→激烈动作）
2. 从台词长度推断镜头时长（台词字数多→镜头长）
3. 从台词内容推断道具（"拿刀"→道具：刀）

**质量评级: A级（强保障）**

---

### 字段17: timeline（时间轴）

**当前机制:**
- **来源1:** VisualLanguageAgent（结构化数组：segment/timeRange/cameraMovement/shotType/purpose）
- **来源2:** PromptFusionAgent（LLM补齐或规则兜底）
- **生成方式:**
  1. Phase 2 VisualLanguageAgent 生成结构化时间轴
  2. Phase 3 PromptFusionAgent 将结构化数组转为文本
- **校验规则:**
  1. 最低字符数 ≥ 200
  2. 必须包含T00:XX格式的时间戳
- **兜底机制:** 规则生成（按镜头时长分3段：0-30%/30-60%/60-100%）

**问题分析:**
- ✅ 有LLM创作（VisualLanguageAgent）
- ✅ 有结构化数据（数组格式）
- ✅ 有校验规则（最低字符数 + 时间戳格式）
- ❌ **时间轴与运镜没有同步**：timeline说"T00:02高潮"但camera_movement是"static"
- ❌ **时间轴与动作没有同步**：timeline说"T00:03挥手"但action是"站立"
- ❌ **时间轴与情绪没有同步**：timeline说"T00:05情绪释放"但mood是"calm"
- ❌ **时间轴节拍数不按时长调整**：5秒和15秒都分3段，节奏不合理

**建议:**
1. 建立时间轴-运镜同步规则：timeline的每个节拍必须有对应的camera_movement
2. 建立时间轴-动作同步规则：timeline的每个节拍必须有对应的action变化
3. 按时长动态调整节拍数：5秒→2节拍，10秒→4节拍，15秒→5节拍
4. 从时间轴自动推导mood和pacing

**质量评级: B级（中保障）**（有创作但缺乏同步校验）

---

### 字段18: mood（情绪）

**当前机制:**
- **来源1:** SceneDesignAgent（LLM生成）
- **来源2:** EmotionArcDesigner（情绪弧线设计）
- **生成方式:**
  1. Phase 1 SceneDesignAgent 生成场景情绪
  2. Layer 0 EmotionArcDesigner 设计整体情绪弧线
  3. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:** 无明确字符数要求
- **兜底机制:** 规则默认值（"calm, professional, natural"）

**问题分析:**
- ✅ 有LLM创作（SceneDesignAgent）
- ✅ 有情绪弧线设计（EmotionArcDesigner）
- ✅ 有情绪-场景关联（剧本层面的情绪目标）
- ⚠️ 情绪与灯光没有强关联：mood是"tense"但lighting是"柔和灯光"
- ⚠️ 情绪与运镜没有强关联：mood是"tense"但camera_movement是"static"
- ⚠️ 情绪与色彩没有强关联：mood是"sad"但color_palette是"暖色调"

**建议:**
1. 建立情绪-灯光关联表：tense→硬光/高对比，sad→柔光/低对比，epic→侧光/轮廓光
2. 建立情绪-运镜关联表：tense→handheld/fast，sad→slow/static，epic→wide/slow_push
3. 建立情绪-色彩关联表：tense→冷色/高对比，sad→低饱和/冷色，epic→金色/高饱和
4. 增加跨模块校验：mood、lighting、camera_movement、color_palette必须一致

**质量评级: B级（中保障）**

---

### 字段19: pacing（节奏）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 无
- **兜底机制:** 规则默认值（"整体：沉稳中等节奏；开头：平缓引入；中段：自然推进；结尾：平稳收尾"）

**问题分析:**
- ❌ 没有专门的Agent负责节奏
- ❌ 节奏与情绪弧线没有关联：情绪是build-up但节奏是"沉稳中等"
- ❌ 节奏与镜头时长没有关联：30秒和60秒都是"五段式"
- ❌ 节奏与运镜没有关联：节奏说"紧凑"但运镜是"slow"
- ❌ 没有根据情绪弧线动态调整

**建议:**
1. 从情绪弧线自动推导：build→gradual，peak→fast/intense，catharsis→slow/release
2. 从镜头时长自动推导：30秒→compact（3段），60秒→standard（5段），90秒→extended（7段）
3. 与timeline同步：pacing的每个段必须有对应的timeline节拍
4. 与camera_movement同步：pacing说"fast"则camera_movement必须包含"fast"

**质量评级: C级（弱保障）**

---

### 字段20: transition（转场）

**当前机制:**
- **来源:** PromptFusionAgent（主LLM或补齐LLM）
- **生成方式:** Phase 3 一次性生成或补齐
- **校验规则:** 无
- **兜底机制:** 规则默认值（"自然切换，无特效转场，直接硬切或微淡入淡出"）

**问题分析:**
- ❌ 没有专门的Agent负责转场
- ❌ 转场与情绪没有关联：紧张场景用"hard cut"，温馨场景用"fade"
- ❌ 转场与相邻镜头没有关联：上一个static→下一个hard cut？不连贯
- ❌ 没有转场数据库：只有"硬切/淡入淡出"两种

**建议:**
1. 建立转场-情绪关联表：tense→hard cut，sad→fade/dissolve，epic→wipe/slide
2. 建立相邻镜头转场规则：static→static用fade，movement→movement用cut
3. 从相邻镜头的camera_movement推导转场：push_in→pull_out用match cut
4. 增加转场时长与情绪强度关联：hard cut→0s，fade→1-2s，wipe→0.5s

**质量评级: C级（弱保障）**

---

### 字段21: audio（音频）

**当前机制:**
- **来源1:** AudioDesignAgent（LLM生成audioString）
- **来源2:** SceneDesignAgent（audioString）
- **来源3:** PromptFusionAgent（LLM补齐）
- **生成方式:**
  1. Phase 2 AudioDesignAgent 根据场景、情绪、台词生成音频方案
  2. Phase 3 PromptFusionAgent 校验并补齐
- **校验规则:** 最低字符数 ≥ 100
- **兜底机制:** 规则默认值

**问题分析:**
- ✅ 有LLM创作（AudioDesignAgent）
- ✅ 有校验规则（最低字符数）
- ⚠️ 音频与情绪没有强关联：mood是"tense"但audio是"环境底噪真实自然"
- ⚠️ 音频与场景没有强关联：战场场景应该有 explosions/刀剑碰撞，但可能被忽略
- ⚠️ 没有音频与时间的关联：何时有音乐、何时有环境音、何时有音效

**建议:**
1. 建立音频-情绪关联表：tense→紧张配乐/心跳声，sad→悲伤钢琴/雨声，epic→管弦乐/鼓声
2. 建立音频-场景关联表：医院→心电监护声，战场→爆炸/枪声，森林→鸟鸣/风声
3. 增加音频时间轴：与timeline同步，T00:00→环境音，T00:03→配乐进入，T00:06→音效高潮

**质量评级: B级（中保障）**

---

### 字段22: negative（负面约束）

**当前机制:**
- **来源:** PromptFusionAgent._assembleStandardPrompt()
- **生成方式:** 规则生成（硬编码模板）
- **校验规则:** 无
- **兜底机制:** 无（本身就是兜底）

**问题分析:**
- ✅ 有完善的负面约束词库（no text, no watermark, no cartoon等）
- ✅ 有场景特定的负面约束（医疗场景：no text on medical charts）
- ⚠️ 负面约束与风格没有关联：写实风格应该禁止"cartoon/anime/illustration"
- ⚠️ 负面约束与场景没有关联：医院场景应该禁止"blood/gore"（如果不适）
- ⚠️ 负面约束冗长，浪费token

**建议:**
1. 从`style`动态选择负面约束：写实→禁止cartoon/anime，动画→禁止photorealistic
2. 从`genre`动态选择：医疗→禁止blood/gore，儿童→禁止violence/horror
3. 精简负面约束：核心词（no text, no watermark）+ 风格词（no cartoon）+ 场景词（no text on charts）

**质量评级: C级（弱保障）**

---

### 字段23: bright_constraint（明亮约束）

**当前机制:**
- **来源:** PromptFusionAgent（规则生成）
- **生成方式:** 硬编码默认值
- **校验规则:** 无
- **兜底机制:** 无

**问题分析:**
- ❌ 完全硬编码（"bright lighting, well-lit scene, clear visibility..."）
- ❌ 没有根据场景调整：夜晚场景不应该"bright lighting"
- ❌ 没有根据情绪调整：恐怖场景不应该"well-lit"
- ❌ 与lighting字段矛盾：lighting说"dark shadow"但bright_constraint说"well-lit"

**建议:**
1. 从lighting字段自动推导：如果lighting含"dark"则bright_constraint改为"atmospheric lighting"
2. 从场景时间推导：白天→bright，黄昏→warm，夜晚→dim/moody
3. 从情绪推导：恐怖→low-key/dark，温馨→bright/warm，史诗→high-key/bright
4. 或者：删除此字段，将其内容合并到lighting字段中

**质量评级: D级（无保障）**

---

### 字段24: character_constraint（角色约束）

**当前机制:**
- **来源:** PromptFusionAgent（规则生成）
- **生成方式:** 从shot.characters动态生成角色名，拼接成模板
- **校验规则:** 无
- **兜底机制:** 规则默认值（"只出现指定角色一人，禁止其他人物入镜..."）

**问题分析:**
- ✅ 有角色名动态提取（从shot.characters）
- ✅ 有角色一致性约束（禁止分身/克隆）
- ⚠️ 没有根据角色数量调整：单角色→"只出现一人"，多角色→"只出现指定角色"
- ⚠️ 没有角色与角色的互动约束（禁止不相关的角色同框）

**建议:**
1. 根据角色数量动态调整：1角色→"只出现指定角色"，2角色→"只出现角色A和角色B"
2. 增加角色互动约束：如果剧本有互动→"角色A和角色B必须有互动"，无互动→"禁止无关互动"
3. 增加角色与场景匹配：孙悟空只能出现在神话场景，不能出现在现代场景

**质量评级: C级（弱保障）**

---

### 字段25: consistency（一致性）

**当前机制:**
- **来源:** PromptFusionAgent（规则生成）
- **生成方式:** 硬编码默认值
- **校验规则:** 无
- **兜底机制:** 无

**问题分析:**
- ❌ 完全硬编码（"保持角色形象一致，造型不变，面部特征与体型每帧统一"）
- ❌ 没有根据具体角色生成：不同角色的一致性要求不同
- ❌ 没有跨镜头校验机制：Phase 3是单镜头处理，不知道其他镜头的内容
- ❌ 与character_constraint重复

**建议:**
1. 从角色系统提取具体特征：发型/服装/配饰，写入一致性约束
2. 从场景系统提取光线/色调，写入跨镜头一致性
3. 在ContinuityReviewAgent中增加跨镜头一致性校验
4. 或者：删除此字段，将内容合并到character_constraint中

**质量评级: D级（无保障）**

---

## 四、综合评估矩阵

| 字段 | 来源Agent | 生成方式 | 校验规则 | 兜底机制 | 质量评级 | 关键问题 |
|------|-----------|---------|---------|---------|---------|---------|
| director_instruction | 无 | 硬编码 | 无 | 无 | D | 无个性化 |
| constraint | PromptFusionAgent | 规则生成 | 无 | 无 | C | 动态参数少 |
| baseline | 无 | 硬编码 | 无 | 无 | D | 无风格适配 |
| scene | SceneDesignAgent | LLM | 禁止词汇+字数 | 场景池 | B | 兜底场景池硬编码 |
| lighting | VisualLanguageAgent | LLM | 字数 | 规则 | B | 无情绪关联 |
| composition | 无 | LLM补齐 | 字数 | 规则 | C | 无专门Agent |
| color_palette | 无 | LLM补齐 | 字数 | 规则 | C | 无情绪关联 |
| depth_of_field | 无 | LLM补齐 | 字数 | 规则 | C | 无景别关联 |
| camera_movement | VisualLanguageAgent | LLM | 字数 | 规则 | B | 无情绪关联 |
| character | 角色系统 | 规则读取 | 服装锁定 | 规则 | B | 无性格关联 |
| costume | 角色系统 | 规则读取 | 服装锁定 | 规则 | B | 无场景关联 |
| makeup | 无 | LLM补齐 | 无 | 规则 | C | 无场景/情绪关联 |
| action | SceneDesignAgent | LLM | 禁止词汇+字数 | 规则 | B | 无台词/运镜关联 |
| props | 无 | LLM补齐 | 无 | 规则 | C | 无台词/场景关联 |
| portraits | 角色系统 | 规则读取 | 路径存在 | 默认路径 | B | 无角度匹配 |
| dialogue | ScriptGenerator | 剧本生成 | 禁止旁白 | 无 | A | 无时间同步 |
| timeline | VisualLanguageAgent | LLM | 字数+格式 | 规则 | B | 无运镜/动作同步 |
| mood | SceneDesignAgent | LLM | 无 | 规则 | B | 无灯光/运镜/色彩关联 |
| pacing | 无 | LLM补齐 | 无 | 规则 | C | 无情绪关联 |
| transition | 无 | LLM补齐 | 无 | 规则 | C | 无情绪/相邻镜头关联 |
| audio | AudioDesignAgent | LLM | 字数 | 规则 | B | 无情绪/时间关联 |
| negative | 无 | 规则生成 | 无 | 无 | C | 无风格/场景适配 |
| bright_constraint | 无 | 硬编码 | 无 | 无 | D | 与lighting矛盾 |
| character_constraint | 无 | 规则生成 | 无 | 规则 | C | 无角色数量适配 |
| consistency | 无 | 硬编码 | 无 | 无 | D | 无具体特征 |

**统计:**
- A级（强保障）: 1个（4%）— dialogue
- B级（中保障）: 10个（40%）— scene, lighting, camera_movement, character, costume, action, portraits, timeline, mood, audio
- C级（弱保障）: 9个（36%）— constraint, composition, color_palette, depth_of_field, makeup, props, pacing, transition, negative, character_constraint
- D级（无保障）: 5个（20%）— director_instruction, baseline, bright_constraint, consistency

---

## 五、核心问题总结

### 5.1 字段间缺乏同步校验

**最致命的问题：25个字段各自为政，没有跨字段一致性校验。**

典型矛盾：
- mood = "tense"，但 lighting = "柔和灯光"，camera_movement = "static"
- timeline = "T00:02高潮"，但 camera_movement = "0-3s固定机位"
- scene = "夜晚战场"，但 bright_constraint = "bright lighting"
- action = "快速奔跑"，但 camera_movement = "slow dolly"

**解决方案：**
1. 增加跨字段校验模块（FieldConsistencyChecker）
2. 建立字段关联规则库（mood-lighting-camera_movement-color_palette 四维映射表）
3. 在PromptFusionAgent中增加一致性校验步骤

### 5.2 硬编码字段过多

**5个字段（20%）完全是硬编码，没有任何动态生成。**

director_instruction、baseline、bright_constraint、consistency、negative的部分内容。

**解决方案：**
1. 从blueprint动态生成 director_instruction 和 baseline
2. 从lighting动态推导 bright_constraint
3. 从角色系统动态生成 consistency

### 5.3 缺乏专门Agent的字段

**9个字段（36%）没有专门的Agent负责，依赖PromptFusionAgent的补齐。**

composition、color_palette、depth_of_field、makeup、props、pacing、transition、negative、character_constraint。

**解决方案：**
1. 在VisualLanguageAgent中增加 composition、color_palette、depth_of_field
2. 在SceneDesignAgent中增加 makeup、props
3. 新增PacingAgent（或合并到VisualLanguageAgent）
4. 新增TransitionAgent（或合并到ContinuityReviewAgent）

### 5.4 时间轴与运镜/动作/情绪不同步

**Timeline 字段有结构化数据，但与其他字段没有同步。**

**解决方案：**
1. 从timeline的每个节拍推导对应的camera_movement、action、mood
2. 从camera_movement验证timeline的节拍合理性
3. 建立时间轴-运镜-动作-情绪四维同步规则

### 5.5 缺乏时长适配

**5秒、10秒、15秒的镜头，字段生成逻辑完全相同。**

**解决方案：**
1. 按镜头时长调整最低字符数：5秒→80%标准，15秒→120%标准
2. 按镜头时长调整timeline节拍数：5秒→2节拍，10秒→4节拍，15秒→5节拍
3. 按镜头时长调整字段数量：5秒→核心字段（scene+action+camera），15秒→全部字段

---

## 六、改进建议（优先级排序）

### P0（最高优先级）

1. **增加跨字段一致性校验模块**
   - 建立 mood-lighting-camera_movement-color_palette 四维映射表
   - 建立 timeline-camera_movement-action 三维同步规则
   - 在PromptFusionAgent中增加一致性校验步骤

2. **从硬编码改为动态生成**
   - director_instruction：从blueprint.style + mood + creativeIntensity动态生成
   - baseline：从style + duration + creativeIntensity动态生成
   - bright_constraint：从lighting字段自动推导

### P1（高优先级）

3. **增加专门Agent负责缺失字段**
   - VisualLanguageAgent增加：composition、color_palette、depth_of_field
   - SceneDesignAgent增加：makeup、props
   - 新增PacingAgent：从情绪弧线推导节奏
   - 新增TransitionAgent：从相邻镜头推导转场

4. **时间轴与运镜/动作/情绪同步**
   - 从timeline推导camera_movement、action、mood
   - 从camera_movement验证timeline合理性
   - 建立时间轴-运镜-动作-情绪四维同步

### P2（中优先级）

5. **按镜头时长适配字段**
   - 按时长调整最低字符数
   - 按时长调整timeline节拍数
   - 按时长调整字段数量（短镜头减少非核心字段）

6. **负面约束动态生成**
   - 从style选择负面约束风格词
   - 从genre选择场景特定负面词
   - 精简负面约束，减少token浪费

### P3（低优先级）

7. **一致性字段合并**
   - 将 consistency 合并到 character_constraint
   - 将 bright_constraint 合并到 lighting
   - 减少字段冗余

8. **角色约束增强**
   - 根据角色数量动态调整约束
   - 增加角色互动约束
   - 增加角色-场景匹配约束

---

## 七、实施路线图

### 第一阶段（1-2天）：紧急修复
- 增加跨字段一致性校验模块
- 将硬编码字段改为动态生成
- 修复时间轴与运镜不同步

### 第二阶段（3-5天）：Agent增强
- VisualLanguageAgent增加composition/color_palette/depth_of_field
- SceneDesignAgent增加makeup/props
- 新增PacingAgent和TransitionAgent

### 第三阶段（1-2周）：系统优化
- 按镜头时长适配字段
- 负面约束动态生成
- 一致性字段合并
- 全面测试和验证

---

## 八、结语

25维提示词字段是SuperMickey系统的**核心资产**。当前系统虽然覆盖了25个字段，但质量保障参差不齐：40%中保障、36%弱保障、20%无保障。

**最关键的改进：** 不是增加更多字段，而是让现有字段之间有**强同步校验**。一个好的导演指令必须与情绪匹配，一个好的时间轴必须与运镜同步，一个好的灯光方案必须与情绪一致。

**字段之间的关联性，比单个字段的质量更重要。**

---

*审计完成时间: 2026-06-30*
*审计版本: v2.1.6-production*
*累计审计字段: 25个*
*发现问题: 核心问题5类，具体字段问题60+个*
*建议改进: 8项，分3阶段实施*

**SuperMickey — 驾驭想象力**
