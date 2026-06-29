# AI视频生成提示词工程方法论 — 系统融合参考

> 本文档是《AI视频生成提示词工程方法论—通用系统级规范》的**系统融合版**。
> 将方法论知识映射到卓越系统的现有字段和模块中，**不新增字段**。

---

## 一、字段映射总表

| 方法论维度 | 卓越系统字段 | 注入模块 | 优先级 |
|-----------|------------|---------|--------|
| SUBJECT 主体定义 | `CHARACTER` | 角色系统/角色描述生成 | P2 |
| ACTION 动作编排 | `ACTION` | 剧本生成/动作描述 | P2 |
| SCENE 场景建构 | `SCENE` | 场景系统/环境描述 | P2 |
| CAMERA 镜头语言 | `CAMERA` | 运镜系统 | **P1** |
| LIGHTING 光影系统 | `LIGHTING` | 光影系统 | **P1** |
| STYLE 风格锚定 | `RENDER` + `DIRECTOR` | 渲染核心/导演风格 | P2 |
| MOOD 情绪调性 | `MOOD` | 情绪/色彩系统 | P2 |
| NEGATIVE 负面约束 | `NEGATIVE` | 全局负面提示词 | **P1** |
| AUDIO 音频 | `AUDIO` | 音频系统 | P3 |

---

## 二、第一批：P1级注入（CAMERA + LIGHTING + NEGATIVE）

### 2.1 CAMERA 字段注入 — 运镜系统升级

**注入内容**：
- 机位高度体系（9级机位 + 视觉心理）
- 运镜方式完整词库（15种运镜 + 英文术语 + 情绪效果）
- 镜头光学参数（焦距/光圈/画幅）
- 景别体系（8种景别）
- 运动速度描述词库（6级速度）
- 特殊镜头效果（浅景深、选择性对焦、长焦压缩等）

**注入方式**：
在 `xtreme-shot-library.js` / `camera-movement-system.js` 中：
1. 运镜生成时引用英文术语（dolly in, tracking shot, orbit 等）
2. 添加光学参数（焦距mm + 光圈f/值）
3. 添加景别信息（shot size）
4. 速度等级对应到具体数值（极慢/慢/中速/快/极快/变速）

**示例输出**：
```
CAMERA: 35mm lens, f/2.8 shallow depth of field | dolly in slowly | eye level MCU | smooth tracking shot following subject
```

### 2.2 LIGHTING 字段注入 — 光影系统升级

**注入内容**：
- 光源定义模型：位置 + 性质 + 效果
- 自然光时段词库（10个时段 + 色温 + 情绪）
- 光影现象词库（11种现象 + 触发条件 + 描述关键词）
- 三点布光映射（Key/Fill/Back）
- 自然光模拟系统（晴天/阴天/室内）

**注入方式**：
在光影系统生成逻辑中：
1. 明确光源位置（top/front/side/back/under/ambient）
2. 明确光质（hard/soft/diffused/direct）
3. 明确效果（rim/fill/key/background）
4. 添加色温（3000K/5600K/8000K+）
5. 添加特殊现象（volumetric light, caustics, lens flare等）

**示例输出**：
```
LIGHTING: golden hour side light 3200K warm, hard key light from 45-degree left, soft fill from right, strong rim light from behind, volumetric light shafts through atmospheric haze
```

### 2.3 NEGATIVE 字段注入 — 负面提示词升级

**注入内容**：
- 6层分层体系：基础质量/风格排除/结构排除/光影排除/人物专项/物理排除
- 场景类型适配（不同场景触发不同负面词层）
- 质量检查清单（10项Pre-Generation检查）

**注入方式**：
替换 `global-negative-prompts.js` 的 `generateCompact()`：
1. 基础质量层（必加）：blurry, low resolution, pixelated...
2. 风格排除层（写实类必加）：cartoon, anime, CGI look...
3. 结构排除层：distorted perspective, floating objects...
4. 光影排除层：flat lighting, overexposed...
5. 人物专项（含人物时）：distorted face, extra fingers...
6. 物理排除层（自然场景）：fake water, plastic foliage...

**示例输出**：
```
NEGATIVE: no blurry, no low resolution, no cartoon, no CGI look, no distorted perspective, no flat lighting, no fake water, no plastic skin, no extra fingers, no deformed hands
```

---

## 三、第二批：P2级注入（SCENE + RENDER + MOOD + ACTION + CHARACTER）

### 3.1 SCENE 字段注入

**注入内容**：
- 空间五维描述法（宏观地理/中观地貌/微观材质/天气时间/空间关系）
- 纵深构建技术（前景-中景-背景三分法/大气透视/引导线/多层穿越）
- 物理真实感（水体/大气/材质/布料柔体）

**注入方式**：
在场景描述生成时：
1. 明确前景/中景/背景层次
2. 添加大气透视（atmospheric haze）
3. 添加微观材质细节
4. 使用物理描述替代形容词

### 3.2 RENDER 字段注入

**注入内容**：
- 写实度分级（0-5级，默认4级超写实）
- 画面质感词库（胶片/大画幅/纪录片/商业广告等）
- 动态范围控制（HDR/SDR/LOG/高反差/低反差）
- 光学参数（画幅、帧率、分辨率）

**注入方式**：
在渲染规格生成时：
1. 默认超写实（hyperrealistic cinematic quality）
2. 添加胶片质感（35mm film grain）或数字清晰（digital clean）
3. 添加HDR
4. 添加画幅比（16:9 cinematic）

### 3.3 MOOD 字段注入

**注入内容**：
- 12种色彩方案（Teal&Orange/Neon Noir/Earth Tones等）
- 色温控制词库（2000K-8000K+）
- 情绪曲线模板（建立→发展→高潮→凝固）

**注入方式**：
在情绪和色彩生成时：
1. 明确色彩方案（如 Teal & Orange）
2. 明确色温（如 3200K warm golden）
3. 明确饱和度/对比度

### 3.4 ACTION 字段注入

**注入内容**：
- 动作三层模型（主体动作/环境动作/镜头动作）
- 速度等级动词库（6级速度 + 情绪指向）
- 动作设计原则（单一主导/动静对比/渐进强度）

**注入方式**：
在动作描述生成时：
1. 每2-3秒一个主导动作
2. 使用物理动词（surge, crash, ripple, billow）
3. 动静交替

### 3.5 CHARACTER 字段注入

**注入内容**：
- 主体四维模型（Form/Material/State/Relation）
- 主体占比构图策略（6级占比）

**注入方式**：
在角色描述生成时：
1. 描述形态（form）
2. 描述材质（material）
3. 描述状态（state）
4. 描述关系（relation）

---

## 四、第三批：P3级注入（AUDIO + 跨模型兼容 + 迭代优化）

### 4.1 AUDIO 字段注入

**注入内容**：
- 环境动作物理声学（水体/大气/材质声学）
- 声画同步规范

### 4.2 跨模型兼容

**注入内容**：
- 模型特性矩阵（SeaDance/Runway/Kling/Veo/Sora/Luma）
- 转换规则（英文术语优先/关键词前置/短句结构）

### 4.3 迭代优化协议

**注入内容**：
- 评估维度（写实度/运动/光影/色彩/构图/物理）
- 诊断修复矩阵（问题→原因→修复）
- A/B测试规范（单变量变更）

---

## 五、实施路线图

```
Phase 1 (P1): CAMERA + LIGHTING + NEGATIVE
  └─ 文件: xtreme-shot-library.js, camera-system.js, global-negative-prompts.js
  └─ 预期效果: 画面质量显著提升，镜头语言专业化，负面词精准覆盖
  
Phase 2 (P2): SCENE + RENDER + MOOD + ACTION + CHARACTER
  └─ 文件: prompt-tier-architecture.js, scene-builder.js, mood-system.js
  └─ 预期效果: 场景深度增强，色彩科学应用，动作编排优化
  
Phase 3 (P3): AUDIO + 跨模型 + 迭代优化
  └─ 文件: audio-system.js, model-adapter.js, quality-gate.js
  └─ 预期效果: 声画同步，多模型适配，系统化迭代
```

---

## 六、关键原则

1. **字段结构不变**：10个标准字段不变，只丰富字段内容
2. **英文术语优先**：模型对英文术语识别精度更高
3. **物理>形容词**：用物理过程替代形容词描述
4. **短句结构**：逗号分隔的短语，避免复杂长句
5. **分层注入**：按P1→P2→P3顺序实施，每批次验证后再推进
6. **场景适配**：不同场景类型（自然史诗/人物叙事/城市/科幻）应用不同权重

---

## 七、Prompt 组装流水线（对应系统流程）

```
输入层（用户意图）
  ↓
解析层（提取六维信息）→ 对应 STAGE-1~STAGE-5
  ↓
构建层（六维填充 + 场景适配器）→ 对应 STAGE-6~STAGE-11
  ↓
优化层（术语标准化 + 冲突检测 + 冗余消除）→ 对应 STAGE-12
  ↓
输出层（10字段标准格式）→ 对应 STAGE-13~STAGE-16
```

---

*融合版本: v1.0 | 基于方法论 v1.0 | 映射至卓越系统 SHORT-VIDEO-0.8.4*
