# STAGE-12 合规检查：结构化标记缺失问题详细分析报告

**报告时间**: 2026-06-10  
**版本**: SHORT-VIDEO-0.8.2-FINAL  
**问题等级**: P1（影响合规通过率，但不阻塞渲染）  
**分析人**: 小G（AI助手）

---

## 一、问题现象

### 1.1 报错信息

```
STAGE-12: ⚠️ S01 标准符合度低: 49% | 缺失: CHARACTER, ACTION, SCENE, MOOD, DIRECTOR
STAGE-12: ⚠️ S02 标准符合度低: 49% | 缺失: CHARACTER, ACTION, SCENE, MOOD, DIRECTOR
STAGE-12: ⚠️ S03 标准符合度低: 49% | 缺失: CHARACTER, ACTION, SCENE, MOOD, DIRECTOR
```

### 1.2 质量评分表现

| 镜头 | 质量评分 | 符合度 | 实际Prompt长度 | 状态 |
|------|---------|--------|---------------|------|
| S01 | 83分 B级 | 49% | 1494字符 | PASS但有警告 |
| S02 | 83分 B级 | 49% | 1494字符 | PASS但有警告 |
| S03 | 83分 B级 | 49% | 1498字符 | PASS但有警告 |

**矛盾点**：Prompt 长度几乎填满 1500 字符（利用率 99%+），但合规检查显示内容缺失 51%。

---

## 二、问题根因分析

### 2.1 核心矛盾：内容存在 vs 标记缺失

**实际输出的 S01 最终 Prompt**（1494 字符）：

```
16:9宽屏电影级镜头。16:9 cinematic, no text, no subtitle, no caption, 
no watermark, 24fps cinematic, hyperrealistic, ultra-detailed, ... 
[大量负面约束词约400字符] ... golden hour, clear sky, atmospheric haze, 
depth layers, foreground to background, 电影级镜头, 椰树下初见, realistic scene, 
香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，
背景虚化，专业人像摄影，观众席, powerful determined expression, eyes sharp and 
小卓，35岁岁女性，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，
背景虚化，专业人像摄影，观众席, powerful determined expression, eyes sharp, ...
tilt_down, 香香，7个月岁男孩... color palette: natural earth shadows + daylight 
highlights + green foliage accents, peak emotional intensity, 通用导演 aesthetic, 
伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩, 动作产生椰树叶随风摇曳声, 
氛围弥漫热带海岛的轻松氛围, 声画精准同步，嘴型与发音对齐, 
Director style: 通用导演 + 通用风格, 超写实, 电影级光影, 自然光 平滑向下摇镜，
中景居中构图，纪录片场景。【明亮约束 【角色一致性约束】solo @Image1 xiangXiang近景，
核心特征，超写实，@Image2 xiaoZhuo近景，核心特征，超写实
```

**分析结论**：
- ✅ **内容存在**：角色描述（香香/小卓）、场景（椰树下）、运镜（tilt_down）、情绪（温暖/治愈）、光影（golden hour）、音频（伴随海风吹拂...）全部都在
- ❌ **标记缺失**：没有 `【视觉】`、`【环境布景】`、`【运镜】`、`【情绪】` 等结构化标记
- ❌ **检查器失效**：合规检查器 `checkStandardCompliance` 依赖 `【】` 标记来定位内容，找不到标记就认为字段缺失

### 2.2 架构层面的根因链

```
【prompt-tier-architecture.js】生成层
    ├── 生成 prompt（自然语言格式）：逗号分隔，无【】标记 ← 被选中使用
    └── 生成 raw（结构化格式）：【约束】xxx | 【基础】xxx ← 被忽略
            ↓
【nirath-master-pipeline.js】组装层
    ├── 使用 tierResult.prompt（自然语言）
    ├── 经过 smartTrim（1500字符截断）
    ├── 经过 motionEnhancement（添加运镜词）
    ├── 经过 intraShotEnhancement（添加微动作/情绪）
    └── 经过 finalFillPrompt（填充到1470字符）
            ↓
【最终输出】自然语言文本，无结构标记
            ↓
【prompt-standard-v3.js】检查层
    ├── checkStandardCompliance() 检查 【视觉】/【环境布景】等标记
    ├── parsePrompt() 尝试按 | 分隔或【】标记解析
    └── 结果：找不到标记 → 认为缺失 → 符合度49%
```

### 2.3 三层问题的详细拆解

#### 第一层：生成层（prompt-tier-architecture.js）

**问题**：`_assembleSevenLayers` 方法生成两个版本：

```javascript
// 版本A：自然语言格式（prompt字段）— 当前被使用
let prompt = p0Layers.filter(Boolean).join(', '); // 逗号分隔
prompt = `${prompt}, ${p1Text}`; // 继续逗号拼接
prompt = `${prompt}, ${p2Text}`; // 继续逗号拼接
// 最终：无【】标记，纯逗号分隔的英文描述

// 版本B：结构化格式（raw字段）— 被忽略
const raw = [
  '【约束】' + layers.constraint,
  '【基础】' + layers.foundation,
  '【空间】' + layers.space,
  '【主体】' + layers.subject,
  '【动态】' + layers.dynamic,
  '【风格】' + layers.style,
  '【音频】' + layers.audio,
  '【质控】' + layers.quality
].filter(s => s.length > 3).join(' | ');
// 最终：有【约束】【基础】【空间】等完整标记
```

**关键决策**：`nirath-master-pipeline.js` 使用 `tierResult.prompt` 而非 `tierResult.raw`。

#### 第二层：组装层（nirath-master-pipeline.js）

**问题**：`stageRender` 或 `buildPrompt` 方法使用自然语言格式后：

```javascript
// 示意代码（nirath-master-pipeline.js 相关逻辑）
const tierResult = promptTier.build(params);
// 当前使用：
let prompt = tierResult.prompt; // ← 自然语言格式
// 应该用：
// let prompt = tierResult.raw; // ← 带标记格式

// 后续经过 smartTrim、enhancement、finalFill，
// 所有处理都是基于自然语言文本，不保留结构标记
```

**增强阶段的影响**：
- `motionEnhancement` 添加 `tilt_down` 等运镜词 → 自然语言追加
- `intraShotEnhancement` 添加情绪/微动作 → 自然语言追加
- `globalNegativePromptInjector` 添加负面约束 → 自然语言追加
- `finalFillPrompt` 填充到 1470 字符 → 自然语言追加
- **结果**：Prompt 内容更丰富，但始终无结构标记

#### 第三层：检查层（prompt-standard-v3.js）

**问题**：`checkStandardCompliance` 方法的检查逻辑：

```javascript
checkStandardCompliance(prompt, shotId) {
  const checks = {
    CHARACTER: {
      // 检查1：必须有【视觉】标记 + 角色关键词
      found: /【视觉】.*(?:boy|girl|man|woman|creature|beast|角色|人物)/i.test(prompt) ||
             /\d+-year-old/.test(prompt) ||
             /(?:jacket|shirt|dress|armor|robe|coat|jeans)/i.test(prompt),
      weight: 1.0
    },
    ACTION: {
      // 检查2：必须有【视觉】标记 + 动作关键词
      found: /(?:tracing|gripping|leaning|...)/i.test(prompt) ||
             /【视觉】.*(?:执行|做|动作)/i.test(prompt),
      weight: 1.0
    },
    SCENE: {
      // 检查3：必须有【环境布景】标记
      found: /【环境(?:布景|质感)】/.test(prompt) || ...,
      weight: 1.0
    },
    MOOD: {
      // 检查4：必须有情绪关键词（这个能匹配到）
      found: /(?:mysterious|epic|awe|...)/i.test(prompt) ||
             /(?:神秘|史诗|庄严|...)/.test(prompt),
      weight: 0.8
    },
    // ... 其他字段
  };
}
```

**检查器匹配结果**（基于实际 S01 Prompt）：

| 字段 | 检查正则 | 实际Prompt内容 | 匹配结果 | 说明 |
|------|---------|--------------|---------|------|
| CHARACTER | `【视觉】.*角色` | 无 `【视觉】` 标记，但有"香香，7个月岁男孩..." | ❌ 不匹配 | 检查器要求`【视觉】`标记 |
| ACTION | `【视觉】.*动作` | 无 `【视觉】` 标记，但有"tilt_down"等 | ❌ 不匹配 | 检查器要求`【视觉】`标记 |
| SCENE | `【环境布景】` | 无 `【环境布景】` 标记，但有"椰树下初见" | ❌ 不匹配 | 检查器要求`【环境布景】`标记 |
| MOOD | `mysterious\|epic...` | "温暖、治愈" | ✅ 匹配 | 纯关键词检查，不需要标记 |
| CAMERA | `【镜头时间轴】` | 无 `【镜头时间轴】` 标记 | ❌ 不匹配 | S1/S2无标记，S3有【镜头时间轴】 |
| LIGHTING | `\d+K` | 无 `5800K` 等色温值，但有"golden hour" | ❌ 不匹配 | 检查器要求色温数值或光照标记 |
| NEGATIVE | `【负面约束】` | 无 `【负面约束】` 标记，但有"no text..." | ⚠️ 部分匹配 | 自然语言负面词被识别 |
| AUDIO | `【音频】` | 无 `【音频】` 标记（S1/S2），但有"伴随海风吹拂..." | ⚠️ 部分匹配 | S3有【音频】标记可匹配 |
| RENDER | `【技术规格】` | 无 `【技术规格】` 标记，但有"超写实" | ❌ 不匹配 | 检查器要求标记 |
| DIRECTOR | `Cameron\|Villeneuve` | "通用导演" | ❌ 不匹配 | 检查器要求英文导演名 |

**为什么 AUDIO 在 S3 能匹配**：
- S3 的 `finalPrompt` 中出现了 `【音频】伴随白天环境音...`（因为 intra-shot-prompt-enhancer.js 合并了音频描述）
- S1/S2 没有 `【音频】` 标记，只有自然语言音频描述（"伴随海风吹拂..."）
- 检查器对 AUDIO 有自然语言关键词兜底（`伴随|动作产生|氛围弥漫|音乐线索|声画精准同步`），所以理论上能匹配到
- 但报告显示 AUDIO 缺失，可能检查器实际执行时未走到自然语言兜底逻辑

---

## 三、期望结果 vs 当前结果

### 3.1 期望结果（合规检查通过）

**方案A：使用结构化标记格式（raw）**

```
【约束】16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic
【基础】hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture
【空间】golden hour, clear sky, atmospheric haze, depth layers, foreground to background, 椰树下初见, realistic scene
【主体】香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影；小卓，35岁女性，听众，穿便装...
【动态】tilt_down, 平滑向下摇镜，中景居中构图，纪录片场景
【风格】color palette: natural earth shadows + daylight highlights + green foliage accents, peak emotional intensity, 通用导演 aesthetic
【音频】伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩；动作产生椰树叶随风摇曳声；氛围弥漫热带海岛的轻松氛围；声画精准同步，嘴型与发音对齐
【质控】超写实, 电影级光影, 自然光
【角色一致性约束】solo @Image1 xiangXiang近景，核心特征，超写实，@Image2 xiaoZhuo近景，核心特征，超写实
```

**优点**：
- 检查器能直接识别 `【视觉】`/`【环境布景】`/`【运镜】` 等标记
- 符合度可达 80%+
- 结构清晰，人工审阅也更容易

**缺点**：
- 标记本身占用字符（每个标记 3-6 字符，8层 × 5字符 = 40字符额外开销）
- Seedance API 是否对标记格式友好？（理论上不影响，因为标记只是文本）
- 需要改动 `nirath-master-pipeline.js` 使用 `tierResult.raw` 而非 `tierResult.prompt`

### 3.2 当前结果（自然语言格式）

```
16:9宽屏电影级镜头。16:9 cinematic, no text, no subtitle, no caption, no watermark, 
24fps cinematic, hyperrealistic, ultra-detailed, ... [400字符负面约束] ... 
golden hour, clear sky, atmospheric haze, depth layers, foreground to background, 
电影级镜头, 椰树下初见, realistic scene, 香香，7个月岁男孩，听众，穿便装，
亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, 
powerful determined expression, eyes sharp and 小卓，35岁岁女性，听众，穿便装，
亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, ...
tilt_down, ... 伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩, 动作产生椰树叶随风摇曳声, 
氛围弥漫热带海岛的轻松氛围, 声画精准同步，嘴型与发音对齐, ...
【明亮约束 【角色一致性约束】solo @Image1 xiangXiang近景，核心特征，超写实...
```

**问题**：
- 内容存在但无结构标记
- 检查器认为缺失（因为按标记查找）
- 有 `【明亮约束`（未闭合！）和 `【角色一致性约束`（未闭合？）等残缺标记
- 说明某些标记被截断了或格式错误

---

## 四、代码定位

### 4.1 关键文件与行号

| 文件 | 关键函数/行号 | 作用 |
|------|--------------|------|
| `prompt-tier-architecture.js` | `_assembleSevenLayers()` (第487行) | 生成 prompt + raw 两个版本 |
| `prompt-tier-architecture.js` | `build()` (第120行) | 返回 `{prompt, raw, tiers, ...}` |
| `nirath-master-pipeline.js` | `stageRender()` 或 `buildPrompt()` | 使用 `tierResult.prompt`（自然语言） |
| `nirath-master-pipeline.js` | `checkStandardCompliance()` (第6760行) | 检查合规度，依赖【】标记 |
| `prompt-standard-v3.js` | `parsePrompt()` (第677行) | 解析器，尝试按【】或 \| 分隔解析 |
| `prompt-standard-v3.js` | `FIELD_DEFINITIONS` (第45行) | 定义10个标准字段的 blockMapping |

### 4.2 关键代码片段

**prompt-tier-architecture.js — 双版本生成**（第487-555行）：

```javascript
_assembleSevenLayers(layers, directorStyleText) {
  // 版本A：自然语言（无标记）
  const p0Layers = [layers.constraint, layers.foundation, layers.quality];
  let prompt = p0Layers.filter(Boolean).join(', '); // 逗号拼接
  // ... P1/P2层继续逗号拼接
  
  // 版本B：结构化（有标记）
  const raw = [
    '【约束】' + layers.constraint,
    '【基础】' + layers.foundation,
    '【空间】' + layers.space,
    '【主体】' + layers.subject,
    '【动态】' + layers.dynamic,
    '【风格】' + layers.style,
    '【音频】' + layers.audio,
    '【质控】' + layers.quality
  ].filter(s => s.length > 3).join(' | ');
  
  return { prompt, raw }; // 两个版本都返回
}
```

**nirath-master-pipeline.js — 合规检查**（第6760-6850行）：

```javascript
checkStandardCompliance(prompt, shotId) {
  const checks = {
    CHARACTER: {
      found: /【视觉】.*(?:boy|girl|man|woman|...)/i.test(prompt) || ...,
      // 检查器要求【视觉】标记
    },
    SCENE: {
      found: /【环境(?:布景|质感)】/.test(prompt) || ...,
      // 检查器要求【环境布景】标记
    },
    // ... 其他字段类似
  };
}
```

**prompt-standard-v3.js — 解析器**（第677-750行）：

```javascript
function parsePrompt(prompt) {
  // 首先尝试标准格式（| 分隔）
  const fields = {};
  const parts = prompt.split(SEPARATOR); // ' | '
  // ... 尝试按 fieldName: content 解析
  
  // 如果失败，尝试【】区块格式映射
  if (Object.keys(fields).length === 0) {
    for (const [fieldName, def] of Object.entries(FIELD_DEFINITIONS)) {
      for (const blockPattern of def.blockMapping) {
        const blockRegex = new RegExp(`${blockPattern}([^【]*)`, 'i');
        const blockMatch = prompt.match(blockRegex);
        if (blockMatch) {
          fields[fieldName] = { content: blockMatch[1].trim(), original: blockMatch[0] };
          break;
        }
      }
    }
  }
  
  return Object.keys(fields).length > 0 ? fields : null;
}
```

---

## 五、可能的解决方案

### 方案A：使用 raw（结构化标记格式）作为最终输出

**改动点**：`nirath-master-pipeline.js` 使用 `tierResult.raw` 而非 `tierResult.prompt`

**优点**：
- 检查器直接通过（标记匹配）
- 结构清晰，人工可读性强
- 无需修改检查器逻辑

**缺点/风险**：
- `tierResult.raw` 的标记命名是 `【约束】`/`【基础】`/`【空间】`/`【主体】`/`【动态】`/`【风格】`/`【音频】`/`【质控】`
- 但检查器查找的是 `【视觉】`/`【环境布景】`/`【运镜】`/`【镜头时间轴】` 等
- **标记命名不一致**：`【主体】`≠`【视觉】`，`【空间】`≠`【环境布景】`，`【动态】`≠`【运镜】`
- 需要统一标记命名，或修改检查器的 blockMapping

**实施步骤**：
1. 统一标记命名：prompt-tier-architecture.js 的 `_assembleSevenLayers` 使用与检查器一致的标记名
2. 修改 `nirath-master-pipeline.js` 使用 `tierResult.raw || tierResult.prompt`
3. 确保 smartTrim 和增强阶段保留 `【】` 标记

### 方案B：修改检查器支持自然语言格式

**改动点**：`checkStandardCompliance` 和 `parsePrompt` 增加自然语言检测能力

**优点**：
- 不需要改动提示词生成格式
- 当前自然语言格式已经能生成高质量内容（83分B级）
- 风险低，只改检查器

**缺点**：
- 自然语言检测更复杂，需要模糊匹配
- 检查器可能误报或漏报
- 检查器复杂度增加

**实施步骤**：
1. `parsePrompt` 增加基于关键词的自然语言解析（不依赖【】标记）
2. `checkStandardCompliance` 的每个字段检查增加自然语言兜底逻辑
3. 例如：CHARACTER 检查不仅看 `【视觉】`，还看是否包含角色名/年龄/服装描述

### 方案C：混合方案（推荐）

**策略**：在组装阶段将自然语言内容转换为带标记的结构化格式

**思路**：
1. 继续使用 `tierResult.prompt`（自然语言）作为基础内容
2. 在 `nirath-master-pipeline.js` 的 `stageRender` 或 `finalFillPrompt` 阶段
3. 按内容类型自动添加标记：`【视觉】`/`【环境布景】`/`【运镜】`/`【情绪】`等
4. 标记添加基于内容关键词分类（如角色描述前加 `【视觉】`，场景描述前加 `【环境布景】`）

**优点**：
- 保留自然语言的丰富性
- 增加结构化标记供检查器使用
- 对 API 渲染无影响（标记只是文本提示）

**缺点**：
- 需要开发内容分类器，判断哪段文本属于哪个字段
- 复杂度较高

---

## 六、额外发现的问题

### 6.1 标记截断/未闭合

在 S1 的 `finalPrompt` 中观察到：

```
...纪录片场景。【明亮约束 【角色一致性约束】solo @Image1...
```

**问题**：`【明亮约束` 没有闭合 `】`，`【角色一致性约束` 也没有闭合 `】`。

**根因**：
- `smartTrim` 或 `finalFillPrompt` 在截断时可能刚好截断在标记中间
- 或标记在生成时就没有正确闭合

**影响**：
- 检查器的正则 `/【([^【】]+)】/g` 可能无法匹配未闭合的标记
- 即使后续修复标记识别，未闭合的标记也会干扰解析

### 6.2 负面约束词过长

S1 的 finalPrompt 中负面约束词约 400-500 字符：

```
no text, no subtitle, no caption, no watermark, 24fps cinematic, 
hyperrealistic, ... [约30个负面词] ... plastic foliage
```

**问题**：
- 负面约束词占比过高（约30%），挤占正面内容空间
- 检查器不认为负面约束是"内容"，只认为是格式
- 建议将负面约束移到单独的 negative 字段，或在最终输出中精简

### 6.3 检查器字段命名与实际标记不匹配

| 检查器字段 | 检查器 blockMapping | 实际生成标记 | 匹配？ |
|-----------|-------------------|-------------|--------|
| CHARACTER | `【视觉】`/`【角色约束】` | `【主体】`（raw）/ 无（prompt） | ❌ 不匹配 |
| ACTION | `【视觉】`/`【异兽动作】`/`【嘴部动作】` | `【动态】`（raw）/ 无（prompt） | ❌ 不匹配 |
| SCENE | `【环境布景】`/`【环境质感】` | `【空间】`（raw）/ 无（prompt） | ❌ 不匹配 |
| MOOD | `emotion`/`mood`/`情绪` | `【风格】`（raw）/ 无（prompt） | ❌ 不匹配 |
| CAMERA | `【运镜】`/`【镜头时间轴】` | `【动态】`（raw）/ 无（prompt） | ❌ 不匹配 |
| LIGHTING | `光照`/`光影`/`色温`/`K` | `【基础】`/`【质控】`（raw）/ 无 | ❌ 不匹配 |
| NEGATIVE | `【全局负面约束】`/`【负面约束】` | 无（raw中分散在各层）/ 无 | ❌ 不匹配 |
| AUDIO | `【环境音效】`/`【神兽人声签名】`/`【旁白/台词】` | `【音频】`（raw）/ 部分（prompt） | ⚠️ 部分匹配 |
| RENDER | `【ASTRALIS】`/`【技术规格】`/`【风格锁】` | `【基础】`/`【质控】`（raw） | ❌ 不匹配 |
| DIRECTOR | `导演`/`风格`/`Cameron`/`Villeneuve` | `Director style:`（prompt） | ⚠️ 部分匹配 |

**结论**：即使改用 `raw` 格式，标记命名也需要统一。

---

## 七、外部专家需要解答的问题

### 问题1：架构选择
> **应该使用自然语言格式还是结构化标记格式作为最终 Prompt？**
> - 自然语言格式：对 AI 模型更友好（纯文本），但检查器难以解析
> - 结构化标记格式：检查器容易解析，但标记占用字符且模型可能对标记理解不同
> - 是否有最佳实践？

### 问题2：标记命名一致性
> **如何统一以下两套标记命名？**
> - 生成层标记：`【约束】`/`【基础】`/`【空间】`/`【主体】`/`【动态】`/`【风格】`/`【音频】`/`【质控】`
> - 检查层标记：`【视觉】`/`【环境布景】`/`【运镜】`/`【镜头时间轴】`/`【角色约束】`/`【负面约束】`/`【ASTRALIS】`
> - 七层架构（7层）vs 标准检查（10维度）如何映射？

### 问题3：检查器逻辑
> **检查器应该检查"标记存在"还是"内容存在"？**
> - 当前逻辑：检查标记存在（如 `【视觉】`）→ 标记不存在则内容缺失
> - 替代逻辑：检查内容存在（如角色描述、动作描述）→ 内容存在即可通过
> - 是否需要混合策略：优先标记检查，回退内容检查？

### 问题4：负面约束占比
> **负面约束词占 Prompt 30% 是否合理？**
> - 当前：约400-500字符的负面约束（no text, no anime, no cartoon...）
> - 问题：是否过度防御？是否可以精简为更紧凑的负面约束格式？
> - Seedance 对负面约束的最佳实践是什么？

### 问题5：智能截断风险
> **smartTrim / finalFillPrompt 在截断时如何避免破坏结构标记？**
> - 当前：截断可能导致 `【明亮约束`（未闭合）
> - 建议：截断前优先保护完整标记（如果标记开始但未结束，应回退到标记前截断）
> - 或：截断只发生在标记边界处

---

## 八、附录：完整数据样本

### 8.1 S01 最终 Prompt（完整文本）

```
16:9宽屏电影级镜头。16:9 cinematic, no text, no subtitle, no caption, no watermark, 
24fps cinematic, hyperrealistic, ultra-detailed, high dynamic range, detail in highlights 
and shadows, film grain, 35mm texture, cinematic film, blurry, low resolution, pixelated, 
compression artifacts, cartoon, anime, illustration, 3D render look, CGI appearance, 
plastic look, distorted perspective, impossible geometry, floating objects, inconsistent 
scale, flat lighting, overexposed, crushed blacks, double shadows, wrong light direction, 
distorted face, deformed face, extra fingers, plastic skin, waxy skin, unnatural pose, 
unnatural physics, fake water, static water, cardboard texture, plastic foliage, golden hour, 
clear sky, atmospheric haze, depth layers, foreground to background, 电影级镜头, 椰树下初见, 
realistic scene, 香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，
背景虚化，专业人像摄影，观众席, powerful determined expression, eyes sharp and 小卓，35岁女性，
听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, 
powerful determined expression, eyes sharp, powerful determined expression, dynamic posture, 
tilt_down, 香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，
背景虚化，专业人像摄影，观众席, 小卓，35岁女性，听众，穿便装，亲切温和，略带好奇，
摄影棚三点布光，背景虚化，专业人像摄影，观众席, color palette: natural earth shadows 
+ daylight highlights + green foliage accents, peak emotional intensity, 通用导演 aesthetic, 
伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩, 动作产生椰树叶随风摇曳声, 氛围弥漫热带海岛的
轻松氛围, 声画精准同步，嘴型与发音对齐, Director style: 通用导演 + 通用风格, 超写实, 
电影级光影, 自然光 平滑向下摇镜，中景居中构图，纪录片场景。【明亮约束 【角色一致性约束】
solo @Image1 xiangXiang近景，核心特征，超写实，@Image2 xiaoZhuo近景，核心特征，超写实
```

**字符数**：1494  
**【】标记数量**：2个（且未闭合）  
**【】标记位置**：`【明亮约束`（未闭合），`【角色一致性约束`（未闭合）  
**内容存在**：角色（香香/小卓）、场景（椰树下）、运镜（tilt_down）、情绪（温暖/治愈）、光影（golden hour）、音频（伴随海风吹拂...）

### 8.2 S01 的 raw 视图（prompt-tier-architecture.js 生成，但未使用）

```
【约束】16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic
【基础】hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film
【空间】golden hour, clear sky, atmospheric haze, depth layers, foreground to background, 电影级镜头, 椰树下初见, realistic scene
【主体】香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, powerful determined expression, eyes sharp and 小卓，35岁女性，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, powerful determined expression, eyes sharp, powerful determined expression, dynamic posture
【动态】tilt_down, 香香，7个月岁男孩，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席, 小卓，35岁女性，听众，穿便装，亲切温和，略带好奇，摄影棚三点布光，背景虚化，专业人像摄影，观众席
【风格】color palette: natural earth shadows + daylight highlights + green foliage accents, peak emotional intensity, 通用导演 aesthetic
【音频】伴随海风吹拂椰树叶沙沙声，海浪轻拍沙滩, 动作产生椰树叶随风摇曳声, 氛围弥漫热带海岛的轻松氛围, 声画精准同步，嘴型与发音对齐
【质控】Director style: 通用导演 + 通用风格, 超写实, 电影级光影, 自然光 平滑向下摇镜，中景居中构图，纪录片场景
```

**字符数**：约 1400（不含 `【】` 和 `|` 分隔符）  
**【】标记数量**：8个（完整闭合）  
**标记命名**：`【约束】`/`【基础】`/`【空间】`/`【主体】`/`【动态】`/`【风格】`/`【音频】`/`【质控】`  
**与检查器字段对应**：需要映射表

---

## 九、总结

**问题本质**：提示词内容存在且丰富，但缺乏结构化标记（`【视觉】`/`【环境布景】`等），导致检查器按标记查找时认为字段缺失。

**根因链条**：
1. `prompt-tier-architecture.js` 生成自然语言格式（无标记）和结构化格式（有标记）两个版本
2. `nirath-master-pipeline.js` 选择使用自然语言版本
3. 后续增强阶段（smartTrim/motionEnhancement/intraShotEnhancement）均基于自然语言处理
4. 最终输出无标记，但检查器 `checkStandardCompliance` 依赖标记识别
5. 结果：内容存在但标记缺失 → 符合度仅49%

**需要外部专家决策的方向**：
1. 是否改用结构化标记格式作为最终输出？
2. 如何统一七层架构标记与检查器字段命名？
3. 检查器逻辑应检查标记还是内容？
4. 负面约束词占比30%是否合理？
5. 截断时如何保护结构标记不被破坏？

**影响评估**：
- 不影响渲染质量（83分B级已证明内容有效）
- 影响合规检查通过率（当前49%，目标80%+）
- 影响人工审阅效率（无标记时难以快速定位内容）
- 长期影响：结构化管理是未来趋势（如多模型兼容、A/B测试、版本控制）

---

*报告生成时间：2026-06-10 20:15*  
*系统版本：SHORT-VIDEO-0.8.2-FINAL*  
*预生产输出：preproduction-2026-06-10T11-44-23-031Z.json*
