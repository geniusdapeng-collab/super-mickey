# 跨集内容边界守护 — 实际系统落地方案 v1.0

> 基于我们现有超现实系统架构，最小侵入实现跨集边界守护。
> 专家意见择优录取，核心吸收：置信度分级、两层校验思想、上下文感知。

---

## 一、我们现有系统的实际情况

### 1.1 预生产链路（串行）

```
用户输入 → ScriptGenerator → SceneDesign → VisualLanguage → AudioDesign
         → OpeningDesign → PromptFusion → ContinuityReview → RenderSubmitter
```

**关键特征：**
- 每个环节是独立Agent，有自己的system prompt
- 链路是**串行**的：一集跑完，才跑下一集
- 已有**断点续跑**机制（checkpoint-phase1/2/3.json）
- 已有**配置注入**体系（index.js统一管理）

### 1.2 多集任务的处理现状

当前：用户说"做三集科普"
- 我们的做法：分三次调用`run-ep02-v5.js`，每次改episodeIndex
- 问题：三次调用完全独立，ScriptGenerator不知道其他集讲了什么

### 1.3 核心痛点（从实际生产数据看）

| 问题 | 出现频率 | 影响 |
|------|---------|------|
| 下集预告语 | 高（约30%的多集任务） | 单集完整性破坏 |
| 禁区内容深入展开 | 中（约15%） | 内容重复、后续集废掉 |
| 前一集内容重复 | 中（约20%） | 观众流失 |

---

## 二、落地方案：最小侵入，融入现有链路

### 2.1 核心思路

**不改现有Agent内部逻辑，只在外层做三件事：**

1. **规划时**：多集任务先跑一个轻量级规划，明确每集边界
2. **生成时**：ScriptGenerator注入"跨集边界约束"提示词
3. **校验时**：ContinuityReview后加一道"跨集边界校验"

### 2.2 架构图

```
用户输入（多集任务）
    ↓
【新增/可选】SeriesContentPlanner
    → 输出：seriesContentPlan（三集内容划分+边界）
    ↓
第1集预生产
    → ScriptGenerator（注入：无前一集，告知后两集规划）
    → ...完整链路...
    → 【新增】EpisodeSummaryRecorder → 保存摘要到 checkpoint/episode1-summary.json
    ↓
第2集预生产
    → ScriptGenerator（注入：前一集摘要 + 本集边界 + 后一集规划）
    → ...完整链路...
    → 【新增】EpisodeSummaryRecorder → 保存摘要到 checkpoint/episode2-summary.json
    ↓
第3集预生产
    → ScriptGenerator（注入：前两集摘要 + 本集边界）
    → ...完整链路...
    → 【新增】EpisodeSummaryRecorder → 保存摘要
```

### 2.3 新增/修改的文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `series-content-planner.js` | 新增 | 轻量级多集内容规划Agent |
| `boundary-prompt-templates.js` | 新增 | 边界约束提示词模板 |
| `script-generator.js` | 修改 | 注入跨集边界约束 |
| `cross-episode-validator.js` | 新增 | 跨集边界校验（轻量） |
| `continuity-review-agent.js` | 修改 | 集成边界校验报告 |
| `index.js` | 修改 | 配置注入：enableBoundaryGuard |

**只有2个纯新增文件，4个修改文件，完全融入现有体系。**

---

## 三、详细设计

### 3.1 SeriesContentPlanner（新增）

**定位**：多集任务的"前置规划"，一次性跑，输出三集的内容划分。

**触发条件**：用户输入包含"多集/系列/第X集"或totalEpisodes > 1

**输入**：
```javascript
{
  userRequirement: "做三集横纹肌溶解科普，穿警服的陈卓女士讲解",
  totalEpisodes: 3,
  episodeThemes: ["症状与检查", "为什么会发生", "怎么处理与预防"] // 可选，用户已指定
}
```

**输出**：
```javascript
{
  seriesTitle: "横纹肌溶解科普",
  totalEpisodes: 3,
  episodes: [
    {
      index: 1,
      title: "横纹肌溶解的症状与实验室检查",
      coreTopics: ["症状表现", "实验室检查指标", "早期识别"],
      mustCover: ["症状表现", "实验室检查"],
      canMention: ["发病原因一句话", "预防一句话"],
      mustNotCover: ["详细病因", "治疗方案", "预防策略"]
    },
    {
      index: 2,
      title: "为什么会发生横纹肌溶解",
      coreTopics: ["常见病因", "发病机制", "高危人群"],
      mustCover: ["常见病因", "发病机制"],
      canMention: ["症状回顾一句话", "预防引出一句话"],
      mustNotCover: ["详细症状", "检查指标解读", "治疗方案", "预防策略"]
    },
    {
      index: 3,
      title: "怎么处理与预防横纹肌溶解",
      coreTopics: ["治疗方法", "预防措施", "康复建议"],
      mustCover: ["治疗方法", "预防措施"],
      canMention: ["症状回顾一句话", "病因回顾一句话"],
      mustNotCover: ["详细症状", "详细病因"]
    }
  ]
}
```

**实现**：轻量级LLM调用，kimi-k2p6，一次调用即可，耗时<10秒。

**如果用户已明确每集内容**（如横纹肌溶解案例，用户明确给了三集主题），则**跳过此环节**，由用户输入直接构造seriesContentPlan。

---

### 3.2 BoundaryPromptTemplates（新增）

**定位**：提供标准化的跨集边界约束提示词，供ScriptGenerator注入。

**模板1：第一集（无前一集，有后集）**
```
【跨集内容边界约束 — 第1集/共3集】

你是本系列第1集的编剧。本系列共3集，主题如下：
- 第1集（本集）：{episode1Title} — {episode1CoreTopics}
- 第2集：{episode2Title} — {episode2CoreTopics}
- 第3集：{episode3Title} — {episode3CoreTopics}

✅ 本集必须覆盖：{mustCover}
🟡 可以提及但不展开（≤15秒）：{canMention}
🔴 绝对不要深入：{mustNotCover}

⚠️ 重要规则：
1. 本集结尾不要预告"下一集讲什么"，用自然收束结尾
2. 不要在结尾说"未完待续/敬请期待/下次分享"等引导语
3. 自然收束示例："了解症状是第一步，及时检查才能早发现"
4. 如果其他集的内容需要提及，严格控制在15秒内，一句话带过
```

**模板2：中间集（有前一集，有后集）**
```
【跨集内容边界约束 — 第2集/共3集】

你是本系列第2集的编剧。本系列共3集：
- 第1集（已讲完）：{episode1Title} — 已覆盖：{episode1Summary}
- 第2集（本集）：{episode2Title} — {episode2CoreTopics}
- 第3集（待讲）：{episode3Title} — {episode3CoreTopics}

✅ 本集必须覆盖：{mustCover}
🟡 可以提及但不展开（≤15秒）：{canMention}
🔴 绝对不要深入：{mustNotCover}

⚠️ 重要规则：
1. 第1集已详细讲过{episode1MustCover}，本集不需要重复展开
2. 第3集将讲{episode3MustCover}，本集不要预告或提前展开
3. 本集结尾不要预告"下一集讲什么"，用自然收束结尾
4. 如果提到第1集的内容，用"就像上一集说的"一句话带过即可
5. 自然收束示例："了解了原因，我们才能更好地应对"
```

**模板3：最后一集（有前一集，无后集）**
```
【跨集内容边界约束 — 第3集/共3集】

你是本系列第3集（最后一集）的编剧。本系列共3集：
- 第1集（已讲完）：{episode1Title} — 已覆盖：{episode1Summary}
- 第2集（已讲完）：{episode2Title} — 已覆盖：{episode2Summary}
- 第3集（本集）：{episode3Title} — {episode3CoreTopics}

✅ 本集必须覆盖：{mustCover}
🟡 可以提及但不展开（≤15秒）：{canMention}
🔴 绝对不要深入：{mustNotCover}

⚠️ 重要规则：
1. 第1集和第2集已详细讲过{episode1MustCover}、{episode2MustCover}，本集不需要重复展开
2. 如果提到前面集的内容，用"前面我们讲过"一句话带过即可
3. 本集是最后一集，不需要预告任何后续内容
4. 结尾自然收束即可，如"希望这些知识能帮到大家"
```

---

### 3.3 ScriptGenerator修改（注入边界约束）

**修改点**：在ScriptGenerator的system prompt中，**追加**跨集边界约束段落。

**实现逻辑**：
```javascript
// script-generator.js 修改

async generateScript(params) {
  const { taskInfo, episodeIndex, totalEpisodes, seriesContentPlan } = params;
  
  // 【新增】构造跨集边界约束提示词
  let boundaryPrompt = '';
  if (totalEpisodes > 1 && seriesContentPlan) {
    boundaryPrompt = this.buildBoundaryPrompt({
      episodeIndex,
      totalEpisodes,
      seriesContentPlan,
      previousSummaries: await this.loadPreviousSummaries(episodeIndex)
    });
  }
  
  // 原有system prompt + 边界约束
  const systemPrompt = this.baseSystemPrompt + '\n\n' + boundaryPrompt;
  
  // 原有生成逻辑...
}

buildBoundaryPrompt({ episodeIndex, totalEpisodes, seriesContentPlan, previousSummaries }) {
  const template = getTemplateByPosition(episodeIndex, totalEpisodes); // 模板1/2/3
  return fillTemplate(template, {
    episodeIndex,
    totalEpisodes,
    ...seriesContentPlan.episodes[episodeIndex - 1],
    previousSummaries
  });
}
```

**关键**：不改动ScriptGenerator的核心生成逻辑，只在system prompt末尾追加约束。ScriptGenerator原有的创造力、叙事能力完全保留。

---

### 3.4 EpisodeSummaryRecorder（融入checkpoint）

**定位**：每集预生产完成后，自动生成本集内容摘要，保存到checkpoint。

**实现**：
```javascript
// 在预生产完成后调用
async recordEpisodeSummary(episodeIndex, script, scenes) {
  const summary = await this.llm.complete({
    prompt: `请总结第${episodeIndex}集的核心内容（50字以内）：\n\n${script}`,
    model: 'kimi-k2p6'
  });
  
  // 保存到 checkpoint
  const checkpointPath = `checkpoint-episode${episodeIndex}-summary.json`;
  await fs.writeFile(checkpointPath, JSON.stringify({
    episodeIndex,
    summary,
    coreTopics: extractCoreTopics(script),
    timestamp: Date.now()
  }));
}
```

**用途**：后续集的ScriptGenerator加载前一集摘要，知道"前面已经讲了什么"。

---

### 3.5 CrossEpisodeValidator（新增，轻量）

**定位**：在ContinuityReview之后，RenderSubmitter之前，加一道轻量校验。

**校验项（两层，吸收专家思想）**：

**第一层：正则快筛（低成本）**
- 检测明显的下集预告语："下一集"、"下次我们讲"、"敬请期待"、"未完待续"
- 检测明显的越界标记：如果本集是第2集，但脚本中出现"治疗方案"且篇幅>100字

**第二层：LLM语义校验（高准确）**
- 仅当第一层命中或队长要求高严格度时触发
- 输入：脚本 + 本集边界契约
- 输出：越界报告（含置信度）

**置信度分级（吸收专家思想）**：
```javascript
{
  violations: [
    {
      type: 'next_episode_preview',
      content: '下一集我们来讲如何预防',
      confidence: 0.95,  // 高置信度
      severity: 'high',
      action: 'block'    // 阻断，需修复
    },
    {
      type: 'forbidden_zone',
      content: '出现酱油色尿后，要立即补液、碱化尿液...',
      confidence: 0.82,
      severity: 'high', 
      action: 'block'
    },
    {
      type: 'buffer_over_expansion',
      content: '预防措施包括多喝水、避免过度运动...',
      confidence: 0.55,  // 中置信度
      severity: 'medium',
      action: 'warn'     // 警告，不阻断
    }
  ]
}
```

**处置策略**：
- `action: 'block'` → 标记问题，**不自动修复**，输出报告给队长确认
- `action: 'warn'` → 记录警告，继续流程，报告附加到预生产输出

**为什么不做自动修复？**
- 队长反复强调"真实执行"、"不能投机取巧"
- 自动修复可能引入新问题（专家方案也提到"修复可能引入新越界"）
- 校验出问题 → 报告给队长 → 队长决定修复或override → 更可控

---

### 3.6 ContinuityReview集成（修改）

**修改点**：ContinuityReview的输出中，**附加**跨集边界校验报告。

```javascript
// continuity-review-agent.js 修改

async review(scenes, params) {
  // 原有连续性审查逻辑...
  const continuityReport = await this.originalReview(scenes, params);
  
  // 【新增】跨集边界校验（仅多集任务）
  let boundaryReport = null;
  if (params.totalEpisodes > 1) {
    const validator = new CrossEpisodeValidator();
    boundaryReport = await validator.validate({
      script: extractScriptFromScenes(scenes),
      contract: params.episodeContract,
      episodeIndex: params.episodeIndex
    });
  }
  
  return {
    ...continuityReport,
    boundaryReport  // 附加边界报告
  };
}
```

---

## 四、与专家方案的对比（择优录取）

| 维度 | 专家方案 | 我们的方案 | 选择理由 |
|------|---------|-----------|---------|
| **新增文件数** | 11个文件，完整子系统 | 2个纯新增 + 4个修改 | 最小侵入，融入现有体系 |
| **校验后处理** | 自动修复Agent | 标记问题，人工确认 | 队长要求"真实执行"，自动修复有风险 |
| **多集执行模式** | plan-then-parallel（并行） | plan-then-serial（串行） | 我们已有断点续跑，串行更稳定 |
| **置信度分级** | ✅ 采用 | ✅ 采用 | 专家核心创新，解决误报问题 |
| **两层校验** | ✅ 正则+LLM | ✅ 正则快筛+LLM语义 | 专家核心创新，提高准确率 |
| **override机制** | ✅ 有 | ✅ 有 | 保留导演控制权 |
| **LLMClient替换** | 要求实现completeJSON接口 | 复用现有llm调用 | 不增加新抽象层 |
| **自动规划** | ✅ SeriesPlannerAgent | ✅ SeriesContentPlanner | 吸收专家思想，但轻量实现 |

---

## 五、实施步骤

### Step 1：创建边界提示词模板（30分钟）
- 创建 `boundary-prompt-templates.js`
- 三个模板（首集/中集/末集）

### Step 2：修改ScriptGenerator（1小时）
- 在system prompt中注入边界约束
- 加载前一集摘要逻辑

### Step 3：创建CrossEpisodeValidator（1小时）
- 正则快筛层
- LLM语义校验层（置信度分级）

### Step 4：集成到ContinuityReview（30分钟）
- 附加边界报告到输出

### Step 5：创建SeriesContentPlanner（1小时）
- 轻量级多集规划Agent
- 融入index.js配置

### Step 6：测试验证（2小时）
- 用横纹肌溶解三集测试
- 验证：第2集是否还有下集预告？是否重复第1集内容？

**总工作量：约6小时**

---

## 六、风险与应对

| 风险 | 概率 | 应对 |
|------|------|------|
| 边界提示词占用过多prompt空间 | 中 | 模板精简，控制在200字以内 |
| 校验LLM调用增加成本 | 中 | 仅多集任务触发，单集不触发；正则快筛先过滤 |
| 前一集摘要加载失败 | 低 | fallback：用seriesContentPlan中的planned summary |
| 边界约束影响创意 | 低 | 只在system prompt末尾追加，不改动核心生成逻辑 |

---

## 七、成功标准

| 指标 | 目标 | 验证方式 |
|------|------|---------|
| 下集预告语检出率 | >90% | 横纹肌溶解第2集测试 |
| 禁区内容误报率 | <10% | 置信度<0.75的降级为warn |
| 单集完整性评分 | 人工>4/5 | 队长审阅 |
| 内容重复率 | <15% | 对比前一集摘要 |

---

*设计日期：2026-06-21*
*版本：v1.0 实际系统落地方案*
*状态：待队长确认后实施*
