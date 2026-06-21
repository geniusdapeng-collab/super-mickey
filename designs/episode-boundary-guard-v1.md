# 跨集内容边界守护系统 — 设计方案 v1.0

## 业务背景

### 我们是谁 & 在做什么

我们是一个**AI驱动的视频生成系统**研发团队，致力于打造**世界顶级的AI视频生成平台**。当前核心产品是一套**多集系列视频自动化生产系统**，能够根据用户输入的主题，自动生成完整的系列短片（如科普、故事、广告等），并直接提交到渲染引擎（Seedance）产出最终视频。

我们的系统已经支持**多系列并行生产**，包括：
- 超现实系统（叙事类影片）
- 超短裙系统（15秒短视频）
- 作业系统（通用视频任务）

### 当前业务痛点

在实际生产过程中，我们频繁遭遇**"跨集内容越界"**问题，导致：

**1. 内容质量受损**
- 第二集提前讲完了第三集的核心内容 → 第三集变成"废集"
- 第一集已经在结尾预告了"下一集讲症状" → 破坏了单集完整性
- 重复冗余：第二集花30秒回顾第一集已讲过的症状 → 观众流失

**2. 生产效率浪费**
- 一集越界 → 需要重跑预生产链路（8-10分钟/次）
- 严重时需要重新规划整季内容架构
- 已经渲染好的视频需要废弃重渲，成本极高

**3. 用户体验断裂**
- 观众看完第二集发现"怎么已经在讲治疗了？"
- 系列内容节奏混乱，信任感下降

**真实案例（2026-06-20横纹肌溶解科普三集）：**
> 第一集：症状与检查  
> 第二集：为什么会发生（病因）  
> 第三集：怎么处理与预防  
> 
> 第二集预生产时，AI在结尾处写了："下一集我们来讲如何预防横纹肌溶解" → 直接预告了第三集内容。  
> 更隐蔽的问题是：第二集在讲病因时，深入展开了"如果出现酱油色尿要立即就医"——这其实是第一集的症状内容，属于重复冗余。

### 为什么这个问题难解决

**1. 叙事灵活性 vs. 边界约束的矛盾**
- 完全禁止提及其他集内容 → 叙事生硬、逻辑断裂（如第二集讲病因，不能提到"症状"吗？）
- 完全放开 → 必然越界，每集变成"全集"
- 需要找到"可以提及但不能深入"的精细平衡点

**2. AI的"讨好型"生成倾向**
- LLM倾向于"给用户提供更多价值" → 自然会把相关内容全讲
- 需要设计机制让AI理解"少即是多"，"留白是叙事的一部分"

**3. 多集并行时的信息不对称**
- 如果三集同时生成，每集AI不知道其他集具体写了什么
- 容易"撞车"——三集都写了同样的内容

### 业务目标

我们希望设计一套**"灵巧的跨集内容边界守护机制"**，实现：

| 目标 | 描述 | 衡量标准 |
|------|------|---------|
| **内容不越界** | 每集只讲本集该讲的内容 | 越界率 < 5% |
| **叙事不僵硬** | 提及前后集内容时自然流畅 | 人工审阅"自然度"评分 > 4/5 |
| **不重复冗余** | 已讲内容不再展开 | 重复内容占比 < 10% |
| **责任区全覆盖** | 本集必须讲的内容不遗漏 | 责任区覆盖率 = 100% |
| **自动化** | 无需人工逐集检查 | 边界守护全流程自动运行 |

### 目标用户与场景

**直接用户：AI系统本身**（通过提示词和校验机制约束LLM行为）
**最终用户：观看视频的观众**（获得节奏合理、结构清晰的系列内容）
**间接受益者：运营团队**（减少返工、提高生产效率）

### 为什么需要外部专家

这是一个**交叉领域难题**：
- 涉及**内容策划/编剧**的知识（如何拆分多集内容）
- 涉及**AI提示工程**（如何让LLM理解边界）
- 涉及**系统架构设计**（校验与修复的自动化）
- 涉及**叙事学**（如何在约束下保持叙事流畅）

我们希望在实施前，引入外部专家（内容策划、编剧、AI系统架构）进行评审，确保设计方案的**业务合理性**和**技术可行性**。

---

## 系统目标（设计目标）

目标：设计一套"灵巧"的约束机制，让每集"有关系但不越界"。

- 不是简单禁止提及其他集内容
- 不是放任自由导致越界
- 而是让AI"知道边界，自主判断，灵活处理"

---

## 核心设计原则

### 1. 软约束优先，硬约束兜底
- **软约束**：提示词引导、叙事规划建议（占90%）
- **硬约束**：最终校验拦截、内容标记（占10%）
- 原因：叙事需要灵活性，完全硬约束会杀死创意

### 2. 内容边界契约制
每集与上下集签订"内容契约"，明确：
- **本集责任区**：必须覆盖的内容
- **共享缓冲区**：可以提及但不可深入的内容
- **禁区**：绝对不可触碰的内容

### 3. 上下文感知，非全局阻塞
- 让AI知道"前后集讲了什么"
- 但不是简单禁止提及，而是引导"点到为止"

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    跨集内容边界守护系统                        │
│                     (EpisodeBoundaryGuard)                    │
├─────────────────────────────────────────────────────────────┤
│  输入层                                                        │
│  ├── 当前集编号 (episodeIndex)                                 │
│  ├── 总集数 (totalEpisodes)                                  │
│  ├── 全系列内容规划 (seriesContentPlan)                       │
│  └── 历史已生成集摘要 (previousEpisodeSummaries)               │
├─────────────────────────────────────────────────────────────┤
│  核心引擎                                                      │
│  ├── 1. 边界契约生成器 (BoundaryContractGenerator)            │
│  ├── 2. 软约束注入器 (SoftConstraintInjector)                 │
│  ├── 3. 内容校验器 (ContentValidator)                         │
│  └── 4. 越界修复器 (BoundaryRepairAgent)                     │
├─────────────────────────────────────────────────────────────┤
│  输出层                                                        │
│  ├── 当前集内容边界契约 (episodeContract)                     │
│  ├── 注入叙事层的约束提示 (constraintPrompt)                  │
│  ├── 校验报告 (validationReport)                              │
│  └── 修复建议 (repairSuggestions)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 详细设计

### 阶段一：边界契约生成（预生产前）

**全系列内容规划 (seriesContentPlan)**
```json
{
  "seriesTitle": "横纹肌溶解科普",
  "totalEpisodes": 3,
  "episodes": [
    {
      "episodeIndex": 1,
      "title": "横纹肌溶解的症状与检查",
      "coreTopics": ["症状表现", "实验室检查指标", "早期识别"],
      "boundary": {
        "mustCover": ["症状表现", "实验室检查"],
        "canMention": ["发病原因(一句话带过)", "预防措施(一句话带过)"],
        "mustNotCover": ["详细病因分析", "治疗方案", "预防策略"]
      }
    },
    {
      "episodeIndex": 2,
      "title": "为什么会发生横纹肌溶解",
      "coreTopics": ["常见病因", "发病机制", "高危人群"],
      "boundary": {
        "mustCover": ["常见病因", "发病机制"],
        "canMention": ["症状(一句话回顾)", "预防(一句话引出)"],
        "mustNotCover": ["详细症状描述", "检查指标解读", "治疗方案", "预防策略"]
      }
    },
    {
      "episodeIndex": 3,
      "title": "怎么处理和预防横纹肌溶解",
      "coreTopics": ["治疗方法", "预防措施", "康复建议"],
      "boundary": {
        "mustCover": ["治疗方法", "预防措施"],
        "canMention": ["症状(一句话回顾)", "病因(一句话回顾)"],
        "mustNotCover": ["详细症状描述", "详细病因分析"]
      }
    }
  ]
}
```

**边界契约生成逻辑：**
```javascript
function generateBoundaryContract(currentEpisode, seriesPlan) {
  const contract = {
    // 本集核心责任区（必须讲）
    responsibilityZone: currentEpisode.boundary.mustCover,
    
    // 共享缓冲区（可以提及但不可深入）
    sharedBuffer: currentEpisode.boundary.canMention,
    
    // 禁区（绝对不可深入）
    forbiddenZone: currentEpisode.boundary.mustNotCover,
    
    // 前后集关联提示
    contextAwareness: {
      previousEpisode: getPreviousSummary(seriesPlan, currentEpisode.episodeIndex),
      nextEpisode: getNextPreview(seriesPlan, currentEpisode.episodeIndex)
    },
    
    // 叙事引导策略
    narrativeGuidance: generateNarrativeGuidance(currentEpisode, seriesPlan)
  };
  
  return contract;
}
```

### 阶段二：软约束注入（叙事规划时）

**软约束提示词模板：**
```
【跨集内容边界约束】

你是本系列第{currentIndex}集（共{total}集）的编剧。

✅ 本集核心任务（必须完成）：
{responsibilityZone}

🟡 共享缓冲区（可以提及，但严格限制）：
{sharedBuffer} —— 每处提及不超过15秒，一句话带过，不展开

🔴 绝对禁区（本集不可深入）：
{forbiddenZone} —— 如果剧情需要提及，必须控制在5秒内，且不给出具体细节

📚 前后集上下文：
- 上一集已讲：{previousEpisodeSummary}
- 下一集将讲：{nextEpisodePreview}

🎬 叙事策略：
{specificNarrativeGuidance}
```

**叙事策略示例（第二集）：**
```
你是第二集，负责"为什么会发生横纹肌溶解"。

- 上一集已经详细讲了症状和检查，所以本集不需要再展开症状描述
- 如果提到症状，用"就像上一集说的"一句话带过即可
- 下一集要讲治疗和预防，所以本集结尾不要预告"下一集教你怎么治"
- 本集结尾可以自然收束，如"了解了原因，我们才能更好地应对"
- 不需要告诉观众"下一集更精彩"之类的引导语
```

### 阶段三：内容校验（预生产后）

**三层校验机制：**

#### 校验1：禁区扫描（硬性）
```javascript
function scanForbiddenZone(script, forbiddenZone) {
  const violations = [];
  
  for (const forbiddenTopic of forbiddenZone) {
    if (script.containsDetailedExplanation(forbiddenTopic)) {
      violations.push({
        topic: forbiddenTopic,
        severity: "high",
        location: script.findLocation(forbiddenTopic),
        suggestion: `移除详细展开，改为一句话带过，或完全删除`
      });
    }
  }
  
  return violations;
}
```

#### 校验2：下集预告检测（硬性）
```javascript
function detectNextEpisodePreview(script) {
  const previewPatterns = [
    "下一集",
    "下次我们讲",
    "敬请期待",
    "未完待续",
    "我们下期",
    "下次分享",
    "记住这点，下次告诉你"
  ];
  
  const violations = [];
  for (const pattern of previewPatterns) {
    if (script.contains(pattern)) {
      violations.push({
        type: "next_episode_preview",
        severity: "medium",
        location: script.findLocation(pattern),
        suggestion: "删除预告语，用自然收束替代，如'了解了这些，我们就能更好地理解这个疾病'"
      });
    }
  }
  
  return violations;
}
```

#### 校验3：责任区覆盖检查（软性）
```javascript
function checkResponsibilityCoverage(script, responsibilityZone) {
  const coverage = [];
  
  for (const topic of responsibilityZone) {
    const isCovered = script.contains(topic);
    coverage.push({
      topic: topic,
      isCovered: isCovered,
      severity: isCovered ? "none" : "high",
      suggestion: isCovered ? null : `本集必须包含：${topic}`
    });
  }
  
  return coverage;
}
```

### 阶段四：越界修复（校验失败时）

**修复策略矩阵：**

| 违规类型 | 严重程度 | 修复策略 | 是否自动 |
|---------|---------|---------|---------|
| 禁区详细展开 | 高 | 删除/压缩为一句话 | 是 |
| 下集预告语 | 中 | 替换为自然收束 | 是 |
| 责任区缺失 | 高 | 补充内容段落 | 否（需人工确认） |
| 缓冲区过度展开 | 低 | 压缩时长 | 是 |
| 重复上一集内容 | 中 | 标记为"回顾"并压缩 | 是 |

**修复Agent提示词：**
```
你是一名剧集内容边界修复专家。

当前任务：修复第{episodeIndex}集的越界内容

原始脚本：{script}

违规报告：{violations}

修复规则：
1. 删除所有"下集预告"类语句，替换为自然收束
2. 将禁区详细展开压缩为一句话或删除
3. 保留缓冲区提及但不超过15秒
4. 不要添加新的内容，只修复越界问题
5. 保持叙事流畅性，修复后不能显得生硬

输出：修复后的完整脚本
```

---

## 实施策略

### 与现有系统的集成点

```
预生产链路
├── 1. 需求解析 → 提取 seriesContentPlan
├── 2. 集数确认 → 生成 episodeBoundaryContract
├── 3. 脚本生成 → 注入 softConstraintPrompt
├── 4. 导演优化 → 附带 boundaryCheck
├── 5. 分镜生成 → 注入 boundaryAwareness
├── 6. 【新增】BoundaryValidator → 校验越界
├── 7. 【新增】BoundaryRepairAgent → 自动修复
├── 8. 预生产确认 → 附带 boundaryReport
└── 9. 提交渲染
```

### 配置化设计

```javascript
// config.js
module.exports = {
  boundaryGuard: {
    // 是否启用跨集边界守护
    enabled: true,
    
    // 软约束强度 (0-1)
    softConstraintStrength: 0.8,
    
    // 硬校验阈值
    hardValidation: {
      forbiddenZoneViolation: "block",      // 禁区违规：阻断
      nextEpisodePreview: "block",          // 下集预告：阻断
      responsibilityMissing: "warn",        // 责任区缺失：警告
      bufferOverExpansion: "warn"         // 缓冲区过度：警告
    },
    
    // 叙事灵活性参数
    narrativeFlexibility: {
      maxBufferMentionDuration: 15,        // 缓冲区提及最大时长(秒)
      maxForbiddenMentionDuration: 5,      // 禁区提及最大时长(秒)
      allowBriefRecap: true,              // 允许一句话回顾
      allowNaturalTransition: true        // 允许自然过渡提及
    }
  }
};
```

---

## 关键设计亮点

### 1. "三层缓冲"设计（软约束核心）
- **责任区**：必须覆盖（硬性）
- **缓冲区**：可以提及但限制时长（软性）
- **禁区**：禁止深入但可以一句话带过（弹性）

### 2. "自然收束"替代"预告"
不是简单禁止"下一集"，而是提供叙事替代方案：
- ❌ "下一集我们来讲如何预防" → ❌ 预告
- ✅ "了解了发病机制，我们才能有的放矢" → ✅ 自然收束
- ✅ "这些知识希望能帮到大家" → ✅ 自然收束

### 3. "上下文感知"提示词
让AI知道前后集内容，引导其自主判断边界，而非机械规则。

### 4. "修复而非阻断"
校验失败时，优先自动修复而非要求重跑，保持流程顺畅。

---

## 待探讨问题

1. **多集并行生成时**：如果三集同时跑，如何确保每集都感知到其他集的准确内容？
   - 方案A：先跑全系列内容规划，再并行生成各集
   - 方案B：每集生成时动态查询其他集状态

2. **系列内容规划的自动化**：用户只给一句话需求，如何自动生成三集的内容规划？
   - 建议：增加一个"系列规划Agent"，专门负责拆分多集内容

3. **边界冲突处理**：如果导演觉得"这里必须越界"怎么办？
   - 建议：增加 override 机制，但要求记录原因

4. **预告语的模糊检测**："未完待续"好检测，但"后续我们还会分享"这种模糊表达呢？
   - 建议：增加语义检测，而非关键词匹配

---

## 设计完成度

- ✅ 业务背景与痛点分析
- ✅ 业务目标与衡量标准
- ✅ 核心架构设计
- ✅ 边界契约生成逻辑
- ✅ 软约束注入模板
- ✅ 三层校验机制
- ✅ 修复策略矩阵
- ✅ 与现有系统集成方案
- ✅ 配置化设计
- ⏳ 待队长确认后实施

---

*设计日期：2026-06-21*
*版本：v1.0 设计稿*
*状态：待审阅*
