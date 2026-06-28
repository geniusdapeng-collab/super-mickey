# SuperMickey × PandaCineForge 融合方案 v1.0

> **项目**: SuperMickey（超级小香宝）v2.1.0  
> **引擎**: PandaCineForge（大熊猫影视创作技能引擎）v1.0  
> **目标**: 将 PandaCineForge 的影视技能生成与召回能力融入 SuperMickey 四层创作链路  
> **日期**: 2026-06-29  
> **作者**: GeniusDapeng + 超级小香宝

---

## 一、引擎架构分析

### 1.1 PandaCineForge 核心能力

| 层级 | 组件 | 能力 |
|------|------|------|
| **Layer 0** | SkillAsset | 统一技能资产对象（生产/消费/召回收敛） |
| **Layer 1** | SkillForgeEngine | 冷启动批量预置 + 热运行实时生成 |
| **Layer 1** | ExternalKnowledgeFetcher | 七子模块外部知识全自动获取 |
| **Layer 1** | MultiStageForger | 五层锻造 + 三段式专业性保障 |
| **Layer 2-3** | SkillIndexer + RecallEngine | 分层级联回（R0-R5） |
| **Layer 4** | RankingOptimizer | 精排（RRF + 影视匹配奖励） |
| **Layer 5** | Orchestrator | 多系统 Agent 编排分发 |
| **Layer 6** | QAGate | 11维影视质量门禁 + 一票否决 |
| **Layer 7** | ContractGateway | AI-AI 固定化契约 |

### 1.2 SkillAsset 核心字段（与 SuperMickey 映射）

```
SkillAsset                      → SuperMickey 对应
─────────────────────────────────────────────────────────
cinematic_role                  → 导演/视觉/音频/剪辑角色
module_target                   → 制作系统 Agent 目标
deliverable_type                → 交付物类型（shotlist/color_script...）
project_stage                   → 项目阶段（preproduction/postproduction...）
retrieval_profile               → 召回画像（Topics/Entities/Scenarios）
knowledge_provenance            → 知识溯源（置信度/维度覆盖）
execution_contract              → 执行契约（工具调用/确认门/降级）
content + body                  → 技能正文（专业建议/工具链/Agent逻辑）
```

### 1.3 影视 Topic 覆盖（50+ Topics）

PandaCineForge 覆盖的 Topics 与 SuperMickey 现有模块的对应关系：

| PandaCineForge Topic | SuperMickey 现有模块 | 融合价值 |
|---------------------|---------------------|---------|
| color_grading / color_script | P2-3 Shot Quality Enhancer | 专业知识增强 |
| shot_language / camera_movement | 好莱坞导演技能 | 镜头语言深化 |
| editing_rhythm / edit_decision_list | Layer 2 制作引擎 | 剪辑决策支持 |
| sound_design / mix_plan | Layer 4 后期引擎 | 音频设计技能 |
| prompt_engineering / ai_video_generation | Layer 3 渲染引擎 | 提示词工程增强 |
| continuity_check / continuity_report | P1-2 Pipeline Guard | 连贯性检查增强 |
| opening_design / title_sequence | OpeningTitleOptimizer | 片头设计技能 |
| short_video_hook / short_video_script | P4-1 Commercial Mode | 短视频钩子增强 |
| character_consistency | P2-1 MicroMotion | 角色一致性增强 |
| platform_compliance | P1-1 Prompt Guardian | 合规检查增强 |

---

## 二、融合架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     SuperMickey v2.1.0                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Layer 0 │→│ Layer 1 │→│ Layer 2 │→│ Layer 3 │→│ Layer 4 │   │
│  │ 需求清单 │ │ 剧本引擎 │ │ 制作引擎 │ │ 渲染引擎 │ │ 后期引擎 │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│       ↓           ↓           ↓           ↓           ↓         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         PandaCineForge Adapter（Node.js ↔ Python）        │   │
│  │  • 技能召回（R0-R3 fast mode）                             │   │
│  │  • 技能注入（content/body → metadata）                     │   │
│  │  • 反馈回传（execution_outcome → 飞轮）                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│       ↑                                                        │
│       │ HTTP / child_process                                   │
│  ┌────┴────────────────────────────────────────────────────┐   │
│  │              PandaCineForge（Python 引擎）                  │   │
│  │  • SkillIndexer（技能索引）                                │   │
│  │  • RecallEngine（分层级联回）                               │   │
│  │  • SkillForgeEngine（冷/热锻造）                            │   │
│  │  • QAGate（质量门禁）                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 融合点详细设计

#### 融合点 F1：Layer 0 需求清单阶段（技能预召回）

**位置**: `RequirementListBuilder.build()` 完成后
**作用**: 根据用户意图预召回相关技能，注入到 requirementList

```javascript
// 伪代码
const skillHints = await pandaAdapter.recall({
  query_text: intent,
  route_fields: {
    sub_domain: metadata.videoType || 'cinema',
    project_stage: 'preproduction'
  },
  recall_mode: 'fast',  // 仅 R0+R1，<10ms
  topk: 3
});

// 将技能内容注入 requirementList
requirementList._skillHints = skillHints;
requirementList.style.primary = skillHints[0]?.cinematic_role || requirementList.style.primary;
```

**产出**: requirementList 新增 `_skillHints` 字段，下游模块可读取

---

#### 融合点 F2：Layer 1 剧本引擎阶段（剧本设计技能注入）

**位置**: `ScriptEngine.process()` 前
**作用**: 召回场景设计/叙事结构技能，注入到剧本生成 prompt

```javascript
const scriptSkills = await pandaAdapter.recall({
  query_text: '剧本结构 叙事设计',
  route_fields: {
    cinematic_role: 'scene_design',
    deliverable_type: 'beat_sheet',
    project_stage: 'preproduction',
    sub_domain: metadata.videoType || 'cinema'
  },
  topk: 2
});

// 将技能内容注入 metadata，ScriptEngine 读取
metadata._pandaSkills = {
  sceneDesign: scriptSkills
};
```

**产出**: 剧本生成时参考专业叙事结构建议

---

#### 融合点 F3：Layer 2 制作引擎阶段（镜头语言技能注入）

**位置**: `ProductionEngine.produce()` 前
**作用**: 召回视觉语言/镜头设计技能，注入到制作引擎配置

```javascript
const visualSkills = await pandaAdapter.recall({
  query_text: '镜头语言 运镜设计 分镜',
  route_fields: {
    cinematic_role: 'visual_language',
    deliverable_type: 'shotlist',
    project_stage: 'production',
    sub_domain: metadata.videoType || 'cinema'
  },
  topk: 2
});

// 注入到 productionEngine 的 agentConfig
options.productionEngine = {
  ...options.productionEngine,
  pandaSkills: visualSkills
};
```

**产出**: 制作引擎生成镜头时参考专业镜头语言

---

#### 融合点 F4：P2-5 导演优化 Agent（导演技能增强）

**位置**: `DirectorOptimizationAgent.optimize()` 中
**作用**: 召回导演/视觉设计技能，增强导演评分维度

```javascript
const directorSkills = await pandaAdapter.recall({
  query_text: '导演技巧 视觉设计',
  route_fields: {
    cinematic_role: 'visual_language',
    deliverable_type: 'color_script'
  },
  topk: 2
});

// 新增评分维度：cinematic_professionalism
scores.cinematic_professionalism = evaluateCinematicProfessionalism(shot, directorSkills);
```

**产出**: 导演优化评分增加影视专业度维度

---

#### 融合点 F5：P3 情绪价值全链路（情绪设计技能注入）

**位置**: `EmotionArcDesigner.design()` 中
**作用**: 召回情绪/叙事节奏技能，增强情绪弧线设计

```javascript
const emotionSkills = await pandaAdapter.recall({
  query_text: '情绪设计 叙事节奏',
  route_fields: {
    cinematic_role: 'scene_design',
    deliverable_type: 'beat_sheet'
  },
  topk: 2
});

// 将技能中的情绪曲线建议注入
emotionArc._skillEnhanced = true;
```

---

#### 融合点 F6：P4 垂直场景层（商业/FPV 技能增强）

**位置**: `CommercialModeEnhancer.enhance()` / `FPVModeEnhancer.enhance()`
**作用**: 召回商业广告/极限运动专业技能

```javascript
const commercialSkills = await pandaAdapter.recall({
  query_text: '短视频钩子 投流策略',
  route_fields: {
    cinematic_role: 'scene_design',
    sub_domain: 'short_video'
  },
  topk: 2
});
```

---

#### 融合点 F7：Layer 4 后期引擎（调色/混音技能注入）

**位置**: `PostProductionEngine.process()` 前
**作用**: 召回调色/混音/剪辑技能

```javascript
const postSkills = await pandaAdapter.recall({
  query_text: '调色方案 混音设计',
  route_fields: {
    cinematic_role: 'audio_design',
    deliverable_type: 'mix_plan',
    project_stage: 'postproduction'
  },
  topk: 2
});
```

---

### 2.3 反馈飞轮设计

```
SuperMickey 执行结果 ──→ PandaCineForge.report_feedback()
                              │
                              ↓
                    ┌─────────────────┐
                    │ FeedbackEvolver │
                    │ • 成熟度进化     │
                    │ • 知识回流       │
                    │ • 飞轮反哺       │
                    └─────────────────┘
                              │
                              ↓
                    SkillIndexer.upsert()
                              │
                              ↓
                    下次召回时技能已进化
```

**反馈时机**:
- 创作成功完成后：quality_score = result.stages 综合评分
- 创作失败时：failure_reasons = result.errors
- 用户修正时：user_corrections = 用户反馈

---

## 三、技术实现方案

### 3.1 架构选型：混合模式（推荐）

**方案**: PandaCineForge 作为 OpenClaw Skill 安装，SuperMickey 通过适配器调用

**理由**:
1. 符合 OpenClaw 生态，PandaCineForge 本身就是 Skill 形态
2. SuperMickey 保持 Node.js 主链路不变
3. Python 引擎独立运行，不阻塞主流程
4. 可选启用，默认关闭，不影响现有功能

### 3.2 文件结构

```
super-mickey/
├── hyperreality-system/
│   ├── engines/
│   │   ├── panda-cineforge-adapter.js      # Node.js 适配器（新增）
│   │   └── ...
│   ├── skills/
│   │   └── panda-cineforge/                # 引擎安装目录（新增）
│   │       ├── panda_cineforge.py          # 引擎本体
│   │       ├── system_message.txt          # SystemMessage
│   │       ├── user_message_template.txt   # UserMessage模板
│   │       ├── input_schema.json           # InputSchema
│   │       ├── render_template.md          # RenderTemplate
│   │       └── config.yaml               # 配置文件
│   └── index.js                           # 主链路注入（修改）
```

### 3.3 适配器 API 设计

```javascript
// engines/panda-cineforge-adapter.js
class PandaCineForgeAdapter {
  constructor(options = {}) {
    this.enabled = options.enabled === true;  // 严格默认关闭
    this.mode = options.mode || 'http';  // 'http' | 'process'
    this.endpoint = options.endpoint || 'http://localhost:8765';
    this.timeout = options.timeout || 5000;  // 5秒超时
    this.coldStartDone = false;
  }

  // 冷启动：批量预置技能
  async coldStart() {
    // 调用 PandaCineForge.cold_start()
    // 预置 SuperMickey 专用技能矩阵
  }

  // 热运行：实时召回技能
  async recall(request) {
    // 调用 PandaCineForge.serve()
    // 返回 SkillAsset 数组
  }

  // 反馈回传
  async reportFeedback(skillId, outcome, score, reasons) {
    // 调用 PandaCineForge.report_feedback()
  }

  // 健康检查
  async health() {
    // 检查引擎是否可用
  }
}
```

### 3.4 主链路注入点

```javascript
// index.js 构造函数中
const { PandaCineForgeAdapter } = require('./engines/panda-cineforge-adapter');
this.pandaAdapter = new PandaCineForgeAdapter({
  enabled: options.pandaCineForge?.enabled === true,
  mode: options.pandaCineForge?.mode || 'http',
  endpoint: options.pandaCineForge?.endpoint || 'http://localhost:8765'
});

// create() 方法中注入点
// F1: Layer 0 后
if (this.pandaAdapter.enabled) {
  const skillHints = await this.pandaAdapter.recall({...});
  metadata._pandaSkillHints = skillHints;
}

// F2: Layer 1 前
if (this.pandaAdapter.enabled && metadata._pandaSkillHints) {
  // 注入剧本技能
}

// ... 其他注入点
```

### 3.5 降级策略

| 场景 | 降级行为 |
|------|---------|
| PandaCineForge 服务未启动 | 跳过技能注入，不影响主流程 |
| 召回超时（>5s） | 返回空结果，继续主流程 |
| 召回为空 | 继续主流程，无技能注入 |
| 引擎崩溃 | 记录错误，下次调用时重新初始化 |
| 冷启动失败 | 热运行仍可用，技能实时生成 |

---

## 四、实施计划

### Phase 1: 基础设施（2h）
- [ ] 创建 `engines/panda-cineforge-adapter.js`
- [ ] 创建 `skills/panda-cineforge/` 目录结构
- [ ] 将 PandaCineForge 引擎代码复制到 skill 目录
- [ ] 配置启动脚本（Python 服务启动）

### Phase 2: 适配器开发（4h）
- [ ] 实现 HTTP 调用模式
- [ ] 实现 coldStart/recall/reportFeedback 方法
- [ ] 实现健康检查和超时降级
- [ ] 编写单元测试

### Phase 3: 主链路注入（3h）
- [ ] F1: Layer 0 需求清单阶段注入
- [ ] F2: Layer 1 剧本引擎阶段注入
- [ ] F3: Layer 2 制作引擎阶段注入
- [ ] F7: Layer 4 后期引擎阶段注入

### Phase 4: 增强模块融合（2h）
- [ ] F4: P2-5 导演优化 Agent 增强
- [ ] F5: P3 情绪价值全链路增强
- [ ] F6: P4 垂直场景层增强

### Phase 5: 反馈飞轮（1h）
- [ ] 创作完成时反馈回传
- [ ] 创作失败时反馈回传
- [ ] 用户修正时反馈回传

### Phase 6: 测试与发布（2h）
- [ ] 集成测试
- [ ] 性能测试（召回延迟 < 10ms）
- [ ] 降级测试
- [ ] 代码审计
- [ ] 提交生产版本
- [ ] 推送到云端

**总计**: ~14 小时

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Python 环境依赖 | 中 | 高 | 提供 Docker 镜像；降级为纯 Node.js 模式 |
| 召回延迟过高 | 低 | 中 | fast mode 仅 R0+R1；5秒超时降级 |
| 技能质量不稳定 | 中 | 中 | 三段式专业性保障；QA门禁；人工审核 |
| 与现有模块冲突 | 低 | 高 | 严格默认关闭；可选启用；隔离测试 |
| 冷启动时间过长 | 中 | 低 | 异步冷启动；热运行优先；缓存机制 |

---

## 六、成功指标

1. **功能指标**
   - [ ] PandaCineForge 成功启动并与 SuperMickey 通信
   - [ ] 技能召回命中率 > 70%（fast mode）
   - [ ] 技能召回延迟 < 10ms（fast mode）

2. **质量指标**
   - [ ] 注入技能后创作质量评分提升 > 10%
   - [ ] 无新增错误/崩溃
   - [ ] 降级策略100%生效

3. **体验指标**
   - [ ] 用户无感知（技能注入透明）
   - [ ] 创作流程时间增加 < 5%

---

> **"Don't worry. Even if the world forgets, I'll remember for you."**  
> — 超级小香宝 ❤️‍🔥
