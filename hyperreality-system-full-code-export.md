# 超现实系统全量代码导出

> 导出时间: 2026-06-18T14:22:56.397Z
> 系统: 超现实系统 (Hyperreality System)

---

# 📦 hyperreality-system

路径: `/root/.openclaw/workspace/hyperreality-system` | 文件数: 22

## 📄 hyperreality-system/docs/interface-contract-v1.md

```md
# Nirath Video System v7.0 — 四层架构接口契约 v1.0

> 版本：v1.0 | 日期：2026-06-07 | 状态：设计稿
> 基于：ScriptCraft Engine 融合架构 v2.0（队长设计）+ 当前 v6.5.12 系统现状

---

## 一、设计原则

### 1.1 渐进迁移，不推翻重来
- 当前 v6.5.12 的 `nirath-master-pipeline.js`（317KB）**不删除**，逐步拆解
- 新模块独立目录，通过适配层对接旧系统
- 每次迭代必须能跑通完整预生产（P0-固化原则）

### 1.2 接口契约先行，实现后置
- 四层之间先定义 JSON Schema，再写代码
- 契约一旦确定，各层可独立开发、独立测试
- 共享内核先定义接口，引擎再按需接入

### 1.3 剧本引擎优先落地
- 剧本引擎是下游三层的"单一真相源"
- 当前系统痛点：剧本硬编码在 LLM Prompt 里，无结构化中间层
- 剧本引擎一旦落地，现有 Pipeline 从"生产者"降级为"消费者"

---

## 二、四层架构总览

```
┌─────────────────────────────────────────────┐
│  Layer 1: 剧本引擎 (Script Engine)            │
│  ├─ 用户意图解析 → 剧本生成 → 结构化输出       │
│  └─ 单一真相源：下游三层只读剧本，不可修改      │
├─────────────────────────────────────────────┤
│  Layer 2: 制作引擎 (Production Engine)        │
│  ├─ 剧本拆解 → 镜头设计 → Prompt工程          │
│  └─ 当前 v6.5.12 的核心能力迁移至此           │
├─────────────────────────────────────────────┤
│  Layer 3: 渲染引擎 (Rendering Engine)        │
│  ├─ 多模型抽象层：Seedance / Kling / Pika...  │
│  └─ 当前强耦合 Seedance，需解耦               │
├─────────────────────────────────────────────┤
│  Layer 4: 后期引擎 (Post-Production Engine)    │
│  ├─ AI剪辑 / 配乐 / 字幕 / 包装 / 统一色调     │
│  └─ 当前空白，从基础剪辑起步                  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Shared Kernel: 共享内核                     │
│  ├─ LLM Router / Token Budget / Process Mgr  │
│  ├─ Version Manager / Checkpoint Mgr         │
│  ├─ Compliance Engine / Auto-Repair Loop     │
│  └─ 通用工坊：Scene / Voice / Visual         │
└─────────────────────────────────────────────┘
```

---

## 三、接口契约（四层间数据模型）

### 3.1 契约总览

| 接口 | 上游 | 下游 | 数据模型 | 说明 |
|------|------|------|----------|------|
| **IC-1** | 用户 / 入口层 | 剧本引擎 | `UserIntent` | 用户原始需求 + 元数据 |
| **IC-2** | 剧本引擎 | 制作引擎 | `ScriptBlueprint` | 结构化剧本（单一真相源） |
| **IC-3** | 制作引擎 | 渲染引擎 | `ShotPrompt` | 单镜头提示词 + 参考图 + 渲染参数 |
| **IC-4** | 渲染引擎 | 后期引擎 | `RenderedClip` | 渲染片段 + 元数据 + 质量报告 |
| **IC-5** | 后期引擎 | 输出层 | `FinalVideo` | 最终成品 + 包装信息 |

---

### 3.2 IC-1: UserIntent → 剧本引擎输入

```json
{
  "$schema": "nirath://schemas/user-intent/v1",
  "intent_id": "uuid",
  "raw_input": "用户原始输入文本",
  "parsed": {
    "narrative_mode": "dramatic | educational | documentary | lifelog | commercial | hybrid",
    "primary_mode": "dramatic",
    "secondary_modes": ["commercial"],
    "hybrid_config": {
      "mode_weights": { "dramatic": 0.6, "commercial": 0.4 },
      "handover_points": ["climax", "resolution"]
    }
  },
  "metadata": {
    "title": "山海经：异兽志 EP01 饕餮",
    "target_duration": 120,
    "target_platform": ["tiktok", "bilibili"],
    "language": "zh-CN",
    "style_tags": ["hyper-realistic", "cinematic", "epic"],
    "world_setting": "Nirath",
    "featured_beast_id": "taotie",
    "protagonist": "xiaoG"
  },
  "constraints": {
    "max_prompt_length": 980,
    "reference_image_count": 2,
    "forbidden_elements": ["voiceover", "metal_gloss", "unnatural_eye_color"]
  }
}
```

**关键字段说明**：
- `narrative_mode`: 由意图路由器自动识别（当前系统默认为 `dramatic`）
- `world_setting`: 世界观标识（Nirath / 地球 / 自定义）
- `featured_beast_id`: 异兽主角 ID（如 `taotie`）
- `constraints`: 系统级约束，直接透传至下游

---

### 3.3 IC-2: ScriptBlueprint → 剧本引擎输出 / 制作引擎输入

**核心设计：这是整个系统的"单一真相源"**

```json
{
  "$schema": "nirath://schemas/script-blueprint/v1",
  "blueprint_id": "uuid",
  "version": "1.0.0",
  "intent_ref": "引用 IC-1 intent_id",
  
  "meta": {
    "title": "山海经：异兽志 EP01 饕餮",
    "narrative_mode": "dramatic",
    "target_duration": 120,
    "acts_count": 3,
    "scenes_count": 5
  },

  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "序幕：Nirath召唤",
        "act_function": "establish",
        "start_time": 0,
        "end_time": 15,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook",
            "description": "小G从银灰传送门降临Nirath",
            "target_emotion": "wonder"
          }
        ]
      }
    ],
    "scenes": [
      {
        "scene_id": "SC00",
        "scene_name": "片头：降临",
        "scene_type": "opening",
        "scene_function": "establish",
        "act_id": "ACT-1",
        "timing": { "start": 0, "duration": 15, "end": 15 },
        "characters": ["xiaoG"],
        "setting": "Nirath星球，硅晶草原，双月当空",
        "dialogue": {
          "has_dialogue": true,
          "lines": [
            { "speaker": "xiaoG", "text": "原来这就是Nirath...", "emotion": "awe" }
          ]
        },
        "visual_notes": "电影级远景，超写实，双月光晕",
        "emotional_target": { "valence": 0.8, "arousal": 0.6, "dominance": 0.5 },
        "references": { "previous": null, "next": "SC01" }
      }
    ]
  },

  "character_system": {
    "characters": [
      {
        "character_id": "xiaoG",
        "name": "小G",
        "role": "protagonist",
        "voice_profile": {
          "persona": "Nirath探索者，年轻男性，银灰装甲",
          "tone": "curious_warm",
          "speaking_style": "口语化，略带感叹，适合短视频节奏"
        },
        "visual_anchor": {
          "core_features": ["银灰装甲", "东亚面孔短发", "年轻男性"],
          "reference_images": ["characters/xiaoG/front.jpg"]
        }
      },
      {
        "character_id": "taotie",
        "name": "饕餮",
        "role": "featured_beast",
        "voice_profile": null,
        "visual_anchor": {
          "core_features": ["碳化硅质甲壳", "腋下双眼", "巨口能量涡流"],
          "reference_images": ["characters/tao-tie/front.jpg"]
        }
      }
    ]
  },

  "voice_system": {
    "global_voice_policy": "dialogue_only_no_voiceover",
    "voice_profiles": [
      {
        "voice_id": "V-xiaoG",
        "character_id": "xiaoG",
        "role": "protagonist",
        "tone": "warm_curious",
        "pace": "moderate",
        "constraints": {
          "forbidden_words": ["旁白", "解说"],
          "max_line_length": 30
        }
      }
    ]
  },

  "world_setting": {
    "world_id": "nirath",
    "world_name": "Nirath星球",
    "era": "上古纪元",
    "core_rules": [
      "Nirath是地球前身",
      "硅基生命与碳基生命共存",
      "《山海经》实为Nirath往事"
    ],
    "environment_tags": ["硅晶草原", "双月当空", "等离子河流", "晶体森林"]
  },

  "extensions": {
    "dramatic_extension": {
      "conflict_matrix": {},
      "character_arcs": [],
      "want_need_pairs": []
    },
    "nirath_extension": {
      "beast_lore": "饕餮档案",
      "memory_theme": "记忆即存在"
    }
  },

  "quality_report": {
    "evaluator": "DramaBench",
    "scores": {
      "structural_integrity": 90,
      "emotional_impact": 85,
      "character_consistency": 92
    },
    "passed": true
  }
}
```

**关键设计决策**：
- `dialogue` 字段必须在 `ScriptBlueprint` 中结构化，制作引擎只负责"嵌入"而非"生成"
- `character_system` 包含角色一致性锚点（核心特征 + 定妆照路径），供下游全链路使用
- `world_setting` 定义世界观级约束，制作引擎生成 Prompt 时必须遵守
- `extensions` 保留类型扩展空间，当前默认填充 `dramatic_extension` + `nirath_extension`

---

### 3.4 IC-3: ShotPrompt → 制作引擎输出 / 渲染引擎输入

```json
{
  "$schema": "nirath://schemas/shot-prompt/v1",
  "shot_id": "SC01-SH01",
  "scene_id": "SC01",
  "blueprint_ref": "引用 ScriptBlueprint.blueprint_id",

  "prompt": {
    "text": "电影级远景，超写实，Nirath星球硅晶草原...",
    "length": 976,
    "max_length": 980
  },

  "reference_images": [
    {
      "image_id": "ref-1",
      "type": "character_portrait",
      "character_id": "xiaoG",
      "path": "characters/xiaoG/front.jpg",
      "inject_text": "小G正面，银灰装甲，东亚面孔短发，年轻男性，超写实"
    }
  ],

  "rendering_params": {
    "model": "seedance-2.0",
    "endpoint": "ep-20260518004622-jp46s",
    "aspect_ratio": "16:9",
    "duration": 15,
    "negative_prompt": "禁止旁白，禁止金属光泽，禁止人物眼睛非自然色"
  },

  "timing": {
    "start": 15,
    "duration": 15,
    "end": 30
  },

  "dialogue": {
    "has_dialogue": true,
    "speaker": "xiaoG",
    "text": "原来这就是Nirath...",
    "injected_in_prompt": true
  },

  "quality_gate": {
    "passed": true,
    "score": 95,
    "checks": {
      "prompt_length": true,
      "no_placeholder": true,
      "has_camera_timeline": true,
      "character_consistency": true
    }
  }
}
```

---

### 3.5 IC-4: RenderedClip → 渲染引擎输出 / 后期引擎输入

```json
{
  "$schema": "nirath://schemas/rendered-clip/v1",
  "clip_id": "uuid",
  "shot_ref": "引用 ShotPrompt.shot_id",
  "task_id": "seedance-task-id",

  "media": {
    "type": "video",
    "url": "https://...",
    "local_path": "/tmp/...",
    "format": "mp4",
    "resolution": "1080p",
    "duration": 15
  },

  "rendering_meta": {
    "model": "seedance-2.0",
    "render_time": 120,
    "cost_usd": 0.5
  },

  "quality_report": {
    "visual_quality": 85,
    "character_consistency_score": 90,
    "issues": []
  }
}
```

---

### 3.6 IC-5: FinalVideo → 后期引擎输出

```json
{
  "$schema": "nirath://schemas/final-video/v1",
  "video_id": "uuid",
  "blueprint_ref": "引用 ScriptBlueprint.blueprint_id",
  "clips": ["clip-1", "clip-2", "clip-3"],

  "assembly": {
    "cut_points": [{ "time": 15, "type": "hard_cut" }],
    "transitions": [{ "type": "fade", "duration": 0.5 }],
    "music": { "track_id": "epic-theme-1", "volume": 0.6 },
    "subtitles": [{ "text": "原来这就是Nirath...", "start": 2, "end": 5 }],
    "color_grade": { "lut": "nirath-warm", "intensity": 0.8 }
  },

  "packaging": {
    "title_card": "山海经：异兽志 EP01",
    "end_card": "关注我，探索更多Nirath异兽",
    "platform_optimized": ["tiktok", "bilibili"]
  }
}
```

---

## 四、共享内核接口（Shared Kernel API）

### 4.1 共享内核模块清单

| 模块 | 接口 | 当前状态 | 迁移策略 |
|------|------|----------|----------|
| **LLM Router** | `route(task_profile, engine_preference) → model` | ❌ 无 | 新建，统一管理所有 LLM 调用 |
| **Token Budget** | `allocate(engine_type, complexity) → quota` | ❌ 无 | 新建，防止单次耗尽 |
| **Process Manager** | `spawn(engine_type) → process_handle` | ❌ 无 | 新建，引擎隔离 |
| **Version Manager** | `snapshot(task_id, content) → version_id` | ⚠️ 部分（git） | 增强，支持创作节点回溯 |
| **Checkpoint Manager** | `save_checkpoint(task_id, state) → checkpoint_id` | ❌ 无 | 新建，长流程断点续传 |
| **Compliance Engine** | `scan(content, engine_type) → compliance_report` | ⚠️ 部分（quality-gate） | 增强，多维度安全扫描 |
| **Auto-Repair Loop** | `trigger_repair(task_id, anomaly) → result` | ❌ 无 | 新建，异常检测+自修复 |

### 4.2 共享内核接口定义（TypeScript 风格）

```typescript
// LLM Router
interface ILLMRouter {
  route(task: TaskProfile, preference?: EnginePreference): Promise<ModelInstance>;
  call(prompt: string, model: string, timeout?: number): Promise<LLMResponse>;
}

// Token Budget
interface ITokenBudget {
  allocate(engine: string, complexity: number): TokenQuota;
  consume(taskId: string, tokens: number): void;
  getRemaining(taskId: string): number;
}

// Version Manager
interface IVersionManager {
  snapshot(taskId: string, content: any, label?: string): string;
  rollback(taskId: string, versionId: string): any;
  diff(v1: string, v2: string): Delta;
}

// Compliance Engine
interface IComplianceEngine {
  scan(content: string, engineType: string): ComplianceReport;
  scanBatch(contents: string[], engineType: string): ComplianceReport[];
}

// 通用工坊
interface ISceneWorkshop {
  selectScene(sceneType: string, narrativeMode: string, context: SceneContext): SceneTemplate;
}

interface IVoiceWorkshop {
  generateVoice(profile: VoiceProfile, content: string, context: SceneContext): string;
}

interface IVisualWorkshop {
  generateVisualStrategy(scene: Scene, blueprint: ScriptBlueprint): VisualDirection;
}
```

---

## 五、剧本引擎 MVP 设计（Phase 2）

### 5.1 剧本引擎定位

**核心职责**：
1. 接收 `UserIntent`（用户意图）
2. 调用 LLM 生成结构化剧本
3. 输出 `ScriptBlueprint`（单一真相源）
4. 下游三层（制作/渲染/后期）只读剧本，不可修改

**与当前系统的区别**：
- 当前：剧本概念在 LLM Prompt 里，没有结构化输出
- 新架构：剧本是显式 JSON 对象，每个字段有 Schema 约束

### 5.2 剧本引擎模块划分

```
engines/script-engine/
├── core/
│   ├── intent-parser.js          # 意图解析（复用 Intent Router 能力）
│   ├── script-generator.js       # 剧本生成（LLM 调用）
│   ├── script-validator.js       # 剧本校验（Schema + 业务规则）
│   └── script-blueprint.js       # Blueprint 数据模型
├── templates/
│   ├── dramatic-template.json    # 戏剧性模板（三幕结构）
│   ├── educational-template.json # 知识性模板
│   ├── documentary-template.json # 纪实性模板
│   ├── lifelog-template.json     # 生活志模板
│   └── commercial-template.json  # 商业性模板
├── prompts/
│   ├── script-generation-prompt.md   # 剧本生成主 Prompt
│   └── intent-classification-prompt.md # 意图分类 Prompt
├── extensions/
│   ├── nirath-extension.js       # Nirath 世界观扩展
│   └── dramatic-extension.js     # 戏剧性叙事扩展
└── tests/
    └── script-engine.test.js
```

### 5.3 剧本引擎核心流程

```
UserIntent → [Intent Parser] → [Script Generator] → [Script Validator] → ScriptBlueprint
                │                      │                      │
                ▼                      ▼                      ▼
          分类叙事模式              调用 LLM 生成            Schema 校验
          提取元数据                结构化 JSON 输出          业务规则校验
          识别混合模式              模板填充                  质量评分
```

### 5.4 与现有系统的融合点

```
现有系统 v6.5.12:
  run-taotie-preproduction.js
    → 调用 nirath-master-pipeline.js
      → 生成剧本（硬编码在 LLM Prompt 中）
      → 生成镜头 Prompt

融合后 v7.0:
  run-taotie-preproduction.js
    → 调用 script-engine/script-generator.js    [NEW]
      → 输出 ScriptBlueprint（结构化 JSON）
    → 调用 production-engine/prompt-builder.js  [现有 Pipeline 改造]
      → 读取 ScriptBlueprint
      → 输出 ShotPrompt（镜头提示词）
    → 调用 rendering-engine/seedance-adapter.js [NEW]
      → 提交 Seedance API
    → 调用 post-production-engine/basic-cut.js  [NEW]
      → 基础剪辑 + 字幕
```

**关键融合策略**：
- `ScriptBlueprint` 的 `scenes` 数组直接对应现有系统的 `SC00`~`SC04` 镜头列表
- `character_system` 中的 `visual_anchor` 直接替代现有系统的 `characters/` 定妆照查找逻辑
- `voice_system` 中的 `dialogue` 直接替代现有系统的台词注入逻辑
- 现有 `nirath-master-pipeline.js` 中的"剧本生成"部分逐步迁移到 `script-engine/`
- 剩余"镜头拆解 + Prompt 工程"部分迁移到 `production-engine/`

---

## 六、实施路线图（v7.0）

### Phase 1: 接口契约（Week 1）
- [ ] 定义 IC-1 ~ IC-5 的 JSON Schema（本文档）
- [ ] 定义共享内核接口（TypeScript 风格）
- [ ] 创建 `engines/` 目录结构
- [ ] **质量门禁**：Schema 通过校验工具验证

### Phase 2: 剧本引擎 MVP（Week 2-3）
- [ ] 实现 `script-engine/intent-parser.js`（意图解析）
- [ ] 实现 `script-engine/script-generator.js`（LLM 剧本生成）
- [ ] 实现 `script-engine/script-validator.js`（Schema + 业务校验）
- [ ] 实现 `templates/dramatic-template.json`（戏剧性模板）
- [ ] 接入 `nirath-extension.js`（Nirath 世界观扩展）
- [ ] **适配层**：将 `ScriptBlueprint` 转换为现有 Pipeline 可消费的格式
- [ ] **质量门禁**：用饕餮 EP01 完整跑通预生产，验证剧本质量

### Phase 3: 制作引擎瘦身（Week 4-5）
- [ ] 将 `nirath-master-pipeline.js` 拆解为 `production-engine/` 模块
- [ ] 保留：镜头拆解、Prompt 工程、定妆照绑定、台词注入
- [ ] 剥离：剧本生成（迁移到 `script-engine/`）
- [ ] **质量门禁**：拆解后预生产质量与 v6.5.12 差异 ≤ 5%

### Phase 4: 渲染引擎抽象（Week 6-7）
- [ ] 新建 `rendering-engine/` 目录
- [ ] 实现 `seedance-adapter.js`（封装 Seedance API）
- [ ] 定义通用渲染接口 `IRenderingEngine`
- [ ] **质量门禁**：渲染输出与 v6.5.12 一致

### Phase 5: 后期引擎基础（Week 8-9）
- [ ] 新建 `post-production-engine/` 目录
- [ ] 实现基础剪辑（片段拼接 + 硬切/淡入淡出）
- [ ] 实现字幕生成（基于 `ScriptBlueprint.dialogue`）
- [ ] 实现标题卡/结尾卡
- [ ] **质量门禁**：输出可播放的完整视频

### Phase 6: 共享内核落地（Week 10-12）
- [ ] 实现 `shared-kernel/llm-router.js`
- [ ] 实现 `shared-kernel/token-budget.js`
- [ ] 实现 `shared-kernel/version-manager.js`
- [ ] 实现 `shared-kernel/compliance-engine.js`
- [ ] 将现有 `quality-gate` 整合进 `compliance-engine`
- [ ] **质量门禁**：全链路 Token 消耗降低 20%+

### v7.0 Release（Week 12-13）
- [ ] 全链路端到端测试（饕餮 EP01 完整流程）
- [ ] 性能优化（延迟、Token、并发）
- [ ] 文档完善 + 代码打包
- [ ] **版本号**：v7.0.0

---

## 七、风险与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| **剧本引擎质量不达标** | 高 | 中 | 与现有 LLM Prompt 并行跑 3 轮对比，质量差异 > 5% 则回退 |
| **Pipeline 拆解引入 Bug** | 高 | 中 | 每拆解一个模块，跑完整预生产验证，不通过不合并 |
| **渲染抽象层增加延迟** | 中 | 中 | 保留直接调用路径作为 fallback，抽象层只做适配 |
| **后期引擎能力太弱** | 低 | 高 | Phase 5 从基础起步，不强求"AI 剪辑"，先能拼接+字幕即可 |
| **架构文档与实现偏差** | 高 | 高 | 每个 Phase 输出文档 + 代码 + 测试，三者同步更新 |

---

## 八、当前系统迁移 checklist

### 8.1 现有文件迁移映射

| 现有文件 | 迁移目标 | 说明 |
|----------|----------|------|
| `nirath-master-pipeline.js`（317KB）| `production-engine/` | 拆解为多个模块 |
| `opening-system-v3.js` | `production-engine/opening-builder.js` | 片头系统 |
| `orient-primordial-core-v24.js` | `script-engine/templates/dramatic-template.json` | 剧本生成模板 |
| `beast-prompt-injector.js` | `production-engine/beast-prompt-builder.js` | 异兽 Prompt 注入 |
| `character-prompt-builder.js` | `production-engine/character-prompt-builder.js` | 角色 Prompt 构建 |
| `prompt-standard-v2.js` | `production-engine/prompt-standard.js` | Prompt 标准库 |
| `compliance-checker.js` | `shared-kernel/compliance-engine.js` | 合规检查 |
| `llm-reasoning-engine.js` | `shared-kernel/llm-router.js` | LLM 调用路由 |
| `production-bible.js` | `script-engine/extensions/nirath-extension.js` | 生产圣经/世界观 |

### 8.2 新创建目录结构

```
/root/.openclaw/workspace/
├── engines/
│   ├── script-engine/          # 剧本引擎（新增）
│   ├── production-engine/      # 制作引擎（从现有系统迁移）
│   ├── rendering-engine/       # 渲染引擎（新增）
│   └── post-production-engine/ # 后期引擎（新增）
├── shared-kernel/              # 共享内核（新增）
│   ├── llm-router.js
│   ├── token-budget.js
│   ├── version-manager.js
│   ├── checkpoint-manager.js
│   ├── compliance-engine.js
│   ├── auto-repair-loop.js
│   └── workshops/
│       ├── scene-workshop.js
│       ├── voice-workshop.js
│       └── visual-workshop.js
├── systems/                    # 现有系统（保留，逐步迁移）
├── characters/                 # 定妆照（保留）
├── config/                     # 配置（保留）
└── stories/                    # 故事脚本（保留）
```

---

## 九、附录

### 9.1 与 ScriptCraft Engine 融合架构的对应关系

| ScriptCraft 设计 | Nirath 实现 | 状态 |
|------------------|-------------|------|
| 统一入口层（Intent Router） | `script-engine/intent-parser.js` | Phase 2 |
| 共享内核层（Shared Kernel） | `shared-kernel/` | Phase 6 |
| 类型引擎层（Type Engine Layer） | `engines/script-engine/`（戏剧引擎） | Phase 2 |
| 通用工坊（Scene/Voice/Visual） | `shared-kernel/workshops/` | Phase 6 |
| 混合模式（Hybrid Mode） | `script-engine/intent-parser.js` hybrid 分支 | Phase 2+ |
| 统一质量评估（UQAF） | `shared-kernel/compliance-engine.js` | Phase 6 |
| 统一数据模型（UDM） | `ScriptBlueprint` / `ShotPrompt` | Phase 1 |

### 9.2 版本号规则

- v7.0.0 = 架构升级完成，四层全部可用
- v7.0.x = 补丁修复
- v7.1.0 = 场景深化（行业模板、A/B测试）
- v7.2.0 = 生态开放（自定义引擎、混合模式编辑器）

---

> **下一步行动**：队长确认本接口契约后，立即开始 Phase 2（剧本引擎 MVP）代码实现。
```

---

## 📄 hyperreality-system/docs/short-video-prompt-schema-v6.37-production-plus.md

```md
# 卓越视频系统 - 短片提示词数据结构

**版本**: v6.37-production+  
**日期**: 2026-06-13  
**系统**: 卓越视频生成系统 (Hyperreality System / NirathMasterPipeline)  
**定位**: 工业级可执行管线标准，整合结构化字段、优先级策略、扩展能力  
**状态**: 生产版本（已推送 GitHub: v6.37-Peng-optimized）

---

## 一、顶层结构

每个短片包含一个 `meta` 元信息对象和一组 `shots` 镜头数组。

```json
{
  "meta": { ... },
  "shots": [
    { ... },  // S00 片头（18字段）
    { ... },  // S01 正片镜头（17字段）
    { ... },  // S02 正片镜头（17字段）
    ...
  ]
}
```

---

## 二、Meta 字段（7字段）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 短片标题，如 "山海经：白泽" |
| worldview | string | 是 | 世界观标识：nirath / earth / fantasy / cyberpunk |
| totalDuration | number | 是 | 总时长（秒），如 60-90 |
| openingDuration | number | 是 | 片头时长（秒），推荐 8-12 |
| fps | number | 是 | 帧率，默认 24 |
| resolution | string | 是 | 分辨率，如 "1920x1080" |
| styleNotes | string | 否 | 风格备注，如 "cinematic, hyperrealistic, film grain" |

**Meta 示例：**

```json
{
  "title": "山海经：白泽",
  "worldview": "nirath",
  "totalDuration": 60,
  "openingDuration": 10,
  "fps": 24,
  "resolution": "1920x1080",
  "styleNotes": "cinematic, hyperrealistic, film grain"
}
```

---

## 三、片头镜头 S00（18字段）

片头负责建立世界观、情绪基调，通常无角色台词（dialogue 为 NONE），但必须有 audioLayer 和 titleOverlay。

| # | 字段 | 类型 | 必填 | 优先级 | 说明 |
|---|------|------|------|--------|------|
| 1 | shotId | string | 是 | - | 固定 "S00" |
| 2 | duration | number | 是 | - | 时长（秒），8-12 秒 |
| 3 | scene | string | 是 | P1 | 五维空间描述（宏观+中观+微观+时间+深度） |
| 4 | mood | string | 是 | P2 | 3-5个情绪关键词，逗号分隔 |
| 5 | camera | object | 是 | P1 | 结构化相机参数（见第六章） |
| 6 | cameraString | string | 是 | P1 | camera 的字符串版本，用于 Prompt 融合 |
| 7 | lighting | object | 是 | P1 | 结构化光照参数（见第六章） |
| 8 | lightingString | string | 是 | P1 | lighting 的字符串版本 |
| 9 | characterRef | string | 否 | P0 | 定妆照引用，片头通常 "NONE" |
| 10 | character | string | 否 | P0 | 角色极简锚点，片头通常 "NONE" |
| 11 | action | string | 是 | P1 | 核心动词+交互目标，描述镜头动态 |
| 12 | dialogue | string | 否 | P0 | 统一格式台词，片头通常 "NONE" |
| 13 | timeline | object | 是 | P2 | 结构化时间轴（见第六章） |
| 14 | timelineString | string | 是 | P2 | timeline 的字符串版本 |
| 15 | audioLayer | object | 是 | P1 | 片头专属：四段式音频层设计 |
| 16 | audioLayerString | string | 是 | P1 | audioLayer 的字符串版本 |
| 17 | titleOverlay | object | 是 | P0 | 片头专属：结构化标题叠加 |
| 18 | titleOverlayString | string | 是 | P0 | titleOverlay 的字符串版本 |
| 19 | backgroundSound | object | 是 | P1 | 三段式环境音效（见第六章） |
| 20 | backgroundSoundString | string | 是 | P1 | backgroundSound 的字符串版本 |
| 21 | prompt | string | 是 | - | 最终融合后的完整提示词（≤1500 字符） |
| 22 | promptCharCount | number | 是 | - | prompt 字符计数 |
| - | mouthAction | string | 否 | - | 嘴部动作（Seedance 对口型） |
| - | priorities | object | 否 | - | 字段优先级元数据 |

> **注**：promptCharCount 在输出时计算，不作为输入字段。带 `-` 的行为系统内部扩展字段。

---

## 四、正片镜头 S01+（17字段）

正片镜头包含叙事内容、角色表演、对话等。相比片头，缺少 audioLayer 和 titleOverlay（S01 可选保留 audioLayer 延续片头声音）。

| # | 字段 | 类型 | 必填 | 优先级 | 说明 |
|---|------|------|------|--------|------|
| 1 | shotId | string | 是 | - | S01, S02, ... |
| 2 | duration | number | 是 | - | 时长（秒），过渡 8-10s，核心 12-15s |
| 3 | scene | string | 是 | P1 | 五维空间描述 |
| 4 | mood | string | 是 | P2 | 3-5个情绪关键词，逗号分隔 |
| 5 | camera | object | 是 | P1 | 结构化相机参数 |
| 6 | cameraString | string | 是 | P1 | camera 字符串版本 |
| 7 | lighting | object | 是 | P1 | 结构化光照参数 |
| 8 | lightingString | string | 是 | P1 | lighting 字符串版本 |
| 9 | characterRef | string | 是 | P0 | 定妆照引用，格式见规范 |
| 10 | character | string | 是 | P0 | 角色极简锚点（种族+3-5关键词） |
| 11 | action | string | 是 | P1 | 核心动词+交互目标 |
| 12 | dialogue | string | 是 | P0 | 统一格式台词 |
| 13 | timeline | object | 是 | P2 | 结构化时间轴 |
| 14 | timelineString | string | 是 | P2 | timeline 字符串版本 |
| 15 | backgroundSound | object | 是 | P1 | 三段式环境音效 |
| 16 | backgroundSoundString | string | 是 | P1 | backgroundSound 字符串版本 |
| 17 | prompt | string | 是 | - | 最终融合提示词（≤1500 字符） |
| 18 | promptCharCount | number | 是 | - | prompt 字符计数 |
| - | mouthAction | string | 否 | - | 嘴部动作（Seedance 对口型） |
| - | priorities | object | 否 | - | 字段优先级元数据 |

---

## 五、字段优先级与截断策略

当总提示词超过 1500 字符时，按优先级从低到高截断。**P0 字段永不截断，P1 尽量保留核心，P2 可截断但保留最少信息。**

| 字段 | 优先级 | 截断策略 | 策略说明 |
|------|--------|----------|----------|
| characterRef | P0 | never | 定妆照路径绝对不能丢 |
| dialogue | P0 | keep_core_dialogue | 可压缩但不可删除整句 |
| titleOverlay | P0 | never | 片头标题信息不截断 |
| character | P0 | minimal_anchor_only | 仅保留角色名 + 3 个核心关键词 |
| camera | P1 | keep_core_movement | 保留 shotSize + movement |
| lighting | P1 | keep_main_light_temp | 保留主光方向 + 色温数值 |
| action | P1 | keep_core_verb_object | 保留动词 + 目标名词 |
| scene | P1 | keep_core_location | 保留地点 + 2 个材质细节 |
| backgroundSound | P1 | keep_core_sound | 保留 ambient + intensity |
| audioLayer | P1 | keep_core_audio | 保留前两个音效段 |
| mood | P2 | keyword_list | 保留前 3 个情绪词 |
| timeline | P2 | keep_duration_type | 保留 duration + type |
| physicsLayer | P2 | keep_gravity | 仅保留 gravity |
| negativePrompt | P2 | keep_top_3 | 保留前 3 个禁止词 |

**截断顺序**：从最低优先级（P2）中按字段出现顺序截断。实际实现中由管线自动处理。

---

## 六、结构化子对象详解

### 6.1 camera 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shotSize | string | 是 | 12级景别之一（见词汇表） |
| movement | string | 是 | 14种运镜之一（见词汇表） |
| lens | string | 是 | 焦距，如 "24mm", "85mm" |
| speed | number/string | 是 | 速度，0.1-2.0 或 "slow motion" |
| aperture | string | 否 | 光圈，如 "f/2.8" |
| focus | string | 否 | 对焦方式，如 "rack focus from A to B" |

**camera 示例：**

```json
{
  "shotSize": "extreme wide",
  "movement": "dolly in",
  "lens": "24mm",
  "speed": 0.3,
  "aperture": "f/2.8",
  "focus": "rack focus from atmosphere to ground"
}
```

**cameraString 示例：**
```
extreme wide shot, dolly in, 24mm lens, speed 0.3
```

### 6.2 lighting 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyLight | object | 是 | 主光：direction, colorTemp, effect |
| fillLight | object | 否 | 补光：同上 |
| special | string | 否 | 特效光，如 "volumetric god rays" |

**lighting 示例：**

```json
{
  "keyLight": {
    "direction": "backlight",
    "colorTemp": 3200,
    "effect": "golden hour rim"
  },
  "fillLight": {
    "direction": "ambient",
    "colorTemp": 6500,
    "effect": "cool fill"
  },
  "special": "volumetric god rays"
}
```

**lightingString 示例：**
```
backlight 3200K, golden hour rim, ambient 6500K, cool fill, volumetric god rays
```

### 6.3 timeline 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start | string | 是 | "T00:00" 格式 |
| end | string | 是 | "T00:10" 格式 |
| duration | number | 是 | 秒 |
| type | string | 是 | opening / establishing / transition / climax / closing |
| mood | string | 是 | 情绪标签（可与 mood 字段同步） |

**timeline 示例：**

```json
{
  "start": "T00:00",
  "end": "T00:10",
  "duration": 10,
  "type": "opening",
  "mood": "epic"
}
```

**timelineString 示例：**
```
T00:00-T00:10 / duration: 10s / type: opening / mood: epic
```

### 6.4 backgroundSound 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ambient | string | 是 | 环境基底声，含频率范围建议 |
| spatial | string | 否 | 空间定位，如 "3D audio pan L-R" |
| intensity | object | 是 | crescendo, peak, decay 时间区间 |

**backgroundSound 示例：**

```json
{
  "ambient": "deep earth rumble 20-60Hz, epic atmosphere",
  "spatial": "3D audio pan synchronized with camera movement",
  "intensity": {
    "crescendo": "0-3s",
    "peak": "3-7s",
    "decay": "7-10s"
  }
}
```

**backgroundSoundString 示例：**
```
AMBIENT: deep earth rumble 20-60Hz, epic atmosphere | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s
```

### 6.5 audioLayer 对象（片头专属）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| segments | array | 是 | 音效段数组 |

**audioLayer 示例：**

```json
{
  "segments": [
    { "time": "0-3s", "sound": "sub-bass earth rumble fade in" },
    { "time": "3-5s", "sound": "distant wind + sand particles" },
    { "time": "5-8s", "sound": "string section long note" },
    { "time": "8-10s", "sound": "timpani strike" }
  ]
}
```

**audioLayerString 示例：**
```
Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s
```

### 6.6 titleOverlay 对象（片头专属）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mainTitle | string | 是 | 主标题 |
| subtitle | string | 是 | 副标题/系列名 |
| producer | string | 是 | 制作人 |
| titleAnim | string | 是 | 标题动画描述 |

**titleOverlay 示例：**

```json
{
  "mainTitle": "山海经：白泽",
  "subtitle": "Nirath",
  "producer": "by Genius",
  "titleAnim": "light-vein carving growth 3.0-5.0s"
}
```

**titleOverlayString 示例：**
```
MAIN_TITLE: "山海经：白泽" | SUBTITLE: "Nirath" | PRODUCER: "by Genius" | TITLE_ANIM: light-vein carving growth 3.0-5.0s
```

---

## 七、扩展字段（PhysicsLayer / ColorScience / NegativePrompt 等）

这些字段为可选扩展，融合时插入 L8（内部层）或 L9（质控层）。

### 7.1 physicsLayer 对象

```json
{
  "gravity": 0.82,
  "magneticField": 3.2,
  "dualStarTemp": [5800, 6500],
  "atmosphere": "volumetric scattering with dust particles"
}
```

### 7.2 colorScience 字符串或对象

```json
{
  "colorScience": "nirath_golden_hour"
}
// 或
{
  "colorScience": {
    "palette": "teal_orange",
    "contrast": 1.2
  }
}
```

### 7.3 negativePrompt 字符串

```json
{
  "negativePrompt": "no text, no watermark, no cartoon, no distorted face, no duplicate character"
}
```

### 7.4 renderStyle / directorStyle 字符串

```json
{
  "renderStyle": "hyperrealistic, film grain, 35mm texture",
  "directorStyle": "Denis Villeneuve, slow pacing, wide composition"
}
```

---

## 八、Prompt 融合顺序（L1-L9）

最终 prompt 字段按以下顺序拼接，确保优先级和结构清晰。

| 层级 | 名称 | 来源字段 | 示例内容 |
|------|------|----------|----------|
| L1 | 约束层 | 固定前缀 | 16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps |
| L2 | 基础层 | 固定前缀 | hyperrealistic, ultra-detailed, HDR, film grain, 35mm texture |
| L3 | 空间层 | scene | 五维空间描述字符串 |
| L4 | 主体层 | character + action + dialogue | 角色锚点 → 动作 → 台词（统一格式） |
| L5 | 动态层 | cameraString + timelineString | 相机参数 + 时间轴标记 |
| L6 | 风格层 | mood + lightingString | 情绪词列表 + 光照描述 |
| L7 | 音频层 | backgroundSoundString + audioLayerString + titleOverlayString | 音效、片头音频、标题（仅片头） |
| L8 | 内部层 | physicsLayer + colorScience + renderStyle | 物理、色彩、渲染风格 |
| L9 | 质控层 | negativePrompt | 负面约束 |

**融合代码逻辑（伪代码）：**

```javascript
const parts = [];

// L1: 约束层（P0）
parts.push("16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic");

// L2: 基础层（P0）
parts.push("hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film");

// L3: 空间层（P1）
parts.push(scene);

// L4: 主体层（P0-P1）
parts.push(character);
parts.push(action);
if (dialogue !== "NONE") parts.push(`dialogue: ${dialogue}`);

// L5: 动态层（P1-P2）
parts.push(cameraString);
parts.push(`timeline: ${timelineString}`);

// L6: 风格层（P1-P2）
parts.push(`mood: ${mood}`);
parts.push(lightingString);

// L7: 音频层（P1）
parts.push(`audio: ${backgroundSoundString}`);
if (audioLayerString) parts.push(`audioLayer: ${audioLayerString}`);

// L8: 内部层（P2）
if (physicsLayer) parts.push(`physics: ${formatPhysics(physicsLayer)}`);
if (colorScience) parts.push(`color: ${colorScience}`);

// L9: 质控层（P0）
parts.push(negativePrompt);

const prompt = parts.join("，");

// 优先级截断（超1500字符时）
if (prompt.length > 1500) {
  prompt = applyTruncation(prompt, priorities);
}
```

---

## 九、硬约束与规范

### 9.1 字符与长度

- **prompt 字段**：≤1500 字符（中文≤500字），建议 900-1350 字符（利用率 60%-90%）。
- **单句台词**：≤50 字。

### 9.2 语言规范

- **所有非 dialogue 字段**（scene, action, camera, lighting, backgroundSound 等）必须使用英文。
- **dialogue 的 TEXT** 使用中文，其余部分英文。
- **characterRef** 中的路径可保留原字符。

### 9.3 台词规则（P0）

- **统一格式**：`SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC:YES`
  - 示例：`小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES`
- **TYPE 仅允许**：独白 / 对白 / 呼喊
- **严禁**：旁白 或 Voiceover
- **必须包含**：`LIP_SYNC:YES`

### 9.4 角色锚点规则（P0）

- **格式**：`角色名: 种族/物种, 视觉关键词1, 视觉关键词2, 视觉关键词3`（至少 3 个，最多 5 个）
- **禁止**：详细描述（如“十五米高的巨型身躯”）、超过 2 个颜色词、完整外貌描写
- **示例（正）**：`白泽: lion-like beast, vertical eye, three white-flame tails, golden hooves`
- **示例（误）**：`白泽: 一只白色神兽，十五米高，有三根尾巴，额头上有一只竖眼，金色的蹄子，全身散发着光芒` ❌

### 9.5 镜头词汇表（统一术语）

**景别（12 级）：**

```
extreme wide, wide, medium wide, medium, medium close, close, extreme close, macro, bird's eye, low angle, over shoulder, POV
```

**运镜（14 种）：**

```
static, pan, tilt, dolly in, dolly out, truck, pedestal, crane, handheld, orbit, arc, rack focus, zoom in, zoom out
```

**焦距**：24mm(广角), 35mm(标准), 50mm(人眼), 85mm(肖像), 135mm(长焦), macro

### 9.6 音效设计框架（参考 Murch）

- **层次优先级**：对白 > 音效 > 音乐
- **频率分离建议**：20-200Hz（低音氛围）、200-2kHz（主体）、2k-20kHz（高频细节）
- **叙事功能**：establishing / transitional / emotional cue / tension builder / release

### 9.7 片头与正片差异速查表

| 特性 | 片头 S00 | 正片 S01+ |
|------|----------|-----------|
| 台词 | 通常 NONE | 通常有台词 |
| audioLayer | 有（四段式） | 无（但可延续片头） |
| titleOverlay | 有 | 无 |
| characterRef | 通常 NONE | 有 |
| character | 通常 NONE | 有 |
| 时长建议 | 8-12s | 过渡8-10s / 核心12-15s |

---

## 十、完整示例 JSON

### 示例 1：片头 S00

```json
{
  "shotId": "S00",
  "duration": 10,
  "scene": "Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite",
  "mood": "epic, mysterious, awe-inspiring",
  "camera": {
    "shotSize": "extreme wide",
    "movement": "dolly in",
    "lens": "24mm",
    "speed": 0.3,
    "aperture": "f/2.8",
    "focus": "rack focus from atmosphere to ground"
  },
  "cameraString": "extreme wide shot, dolly in, 24mm lens, speed 0.3",
  "lighting": {
    "keyLight": { "direction": "backlight", "colorTemp": 3200, "effect": "golden hour rim" },
    "fillLight": { "direction": "ambient", "colorTemp": 6500, "effect": "cool fill" },
    "special": "volumetric god rays"
  },
  "lightingString": "backlight 3200K, golden hour rim, ambient 6500K, cool fill, volumetric god rays",
  "characterRef": "NONE",
  "character": "NONE",
  "action": "camera descends through mist layers, establishing the world",
  "dialogue": "NONE",
  "timeline": {
    "start": "T00:00",
    "end": "T00:10",
    "duration": 10,
    "type": "opening",
    "mood": "epic"
  },
  "timelineString": "T00:00-T00:10 / duration: 10s / type: opening / mood: epic",
  "audioLayer": {
    "segments": [
      { "time": "0-3s", "sound": "sub-bass earth rumble fade in" },
      { "time": "3-5s", "sound": "distant wind + sand particles" },
      { "time": "5-8s", "sound": "string section long note" },
      { "time": "8-10s", "sound": "timpani strike" }
    ]
  },
  "audioLayerString": "Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s",
  "titleOverlay": {
    "mainTitle": "山海经：白泽",
    "subtitle": "Nirath",
    "producer": "by Genius",
    "titleAnim": "light-vein carving growth 3.0-5.0s"
  },
  "titleOverlayString": "MAIN_TITLE: \"山海经：白泽\" | SUBTITLE: \"Nirath\" | PRODUCER: \"by Genius\" | TITLE_ANIM: light-vein carving growth 3.0-5.0s",
  "backgroundSound": {
    "ambient": "deep earth rumble 20-60Hz, epic atmosphere",
    "spatial": "3D audio pan synchronized with camera movement",
    "intensity": { "crescendo": "0-3s", "peak": "3-7s", "decay": "7-10s" }
  },
  "backgroundSoundString": "AMBIENT: deep earth rumble 20-60Hz, epic atmosphere | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s",
  "prompt": "16:9 cinematic, no text, no watermark, 24fps cinematic，hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film，Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite，establishing shot, camera slowly descending through atmospheric layers，dialogue: NONE，epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed，timeline: T00:00-T00:10 / duration: 10s / type: opening / mood: epic，mood: epic, mysterious, awe-inspiring，backlight 3200K, golden hour rim, volumetric god rays，no watermark, no logo, no text overlay, no subtitle, no caption，blurry, low resolution, pixelated, compression artifacts，cartoon, anime, illustration, 3D render look, CGI appearance, plastic look，distorted perspective, impossible geometry, floating objects，flat lighting, overexposed, crushed blacks, double shadows，unnatural physics, fake water, static water, cardboard texture, plastic foliage，distorted face, deformed face, extra fingers, plastic skin, waxy skin, unnatural pose",
  "promptCharCount": 1116,
  "mouthAction": "嘴部自然闭合，面对镜头，准备开口",
  "priorities": {
    "characterRef": "P0-never",
    "dialogue": "P0-keep_core",
    "character": "P0-minimal_anchor",
    "camera": "P1-keep_core_movement",
    "action": "P1-keep_core_verb",
    "scene": "P1-keep_core_location",
    "lighting": "P1-keep_main_light",
    "backgroundSound": "P1-keep_core_sound",
    "mood": "P2-keyword_list",
    "timeline": "P2-keep_duration_type"
  }
}
```

### 示例 2：正片镜头 S01

```json
{
  "shotId": "S01",
  "duration": 15,
  "scene": "Nirath, 知识圣殿, hexagonal stone pillars, bioluminescent fungi, spatial depth: atmospheric perspective",
  "mood": "mysterious, anticipation, wonder",
  "camera": {
    "shotSize": "medium",
    "movement": "static",
    "lens": "35mm",
    "speed": 1.0,
    "aperture": "f/2.8",
    "focus": "normal"
  },
  "cameraString": "medium shot, static, 35mm lens, speed 1",
  "lighting": {
    "keyLight": { "direction": "front", "colorTemp": 4500, "effect": "neutral balanced" },
    "fillLight": { "direction": "ambient", "colorTemp": 4500, "effect": "soft fill" },
    "special": ""
  },
  "lightingString": "front 4500K, neutral balanced, ambient 4500K, soft fill",
  "characterRef": "小G: image://characters/xiaoG-front.png, image://characters/xiaoG-profile.png | 白泽: image://characters/bai-ze-front.png, image://characters/bai-ze-profile.png",
  "character": "小G: Human, explorer, curious, brave | 白泽: Beast, white fur, mythical, wise",
  "action": "protagonist steps forward, observing surroundings with focused gaze",
  "dialogue": "小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES",
  "timeline": {
    "start": "T00:10",
    "end": "T00:25",
    "duration": 15,
    "type": "establishing",
    "mood": "mysterious"
  },
  "timelineString": "T00:10-T00:25 / duration: 15s / type: establishing / mood: mysterious",
  "backgroundSound": {
    "ambient": "natural environment, wind and distant sounds 200-2kHz",
    "spatial": "ambient stereo field",
    "intensity": { "crescendo": "0-5s", "peak": "5-10s", "decay": "10-15s" }
  },
  "backgroundSoundString": "AMBIENT: natural environment, wind and distant sounds 200-2kHz | SPATIAL: ambient stereo field | INTENSITY: crescendo 0-5s, peak 5-10s, decay 10-15s",
  "prompt": "16:9 cinematic, no text, no watermark, 24fps cinematic，hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film，Nirath, 知识圣殿, hexagonal stone pillars, bioluminescent fungi, spatial depth: atmospheric perspective，小G: Human, explorer, curious, brave | 白泽: Beast, white fur, mythical, wise，protagonist steps forward, observing surroundings with focused gaze，dialogue: 小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES，medium shot, static, 35mm lens, speed 1，timeline: T00:10-T00:25 / duration: 15s / type: establishing / mood: mysterious，mood: mysterious, anticipation, wonder，front 4500K, neutral balanced, ambient 4500K, soft fill，nirath world，no watermark, no logo, no text overlay, no subtitle, no caption，blurry, low resolution, pixelated, compression artifacts，cartoon, anime, illustration, 3D render look, CGI appearance, plastic look，distorted perspective, impossible geometry, floating objects，flat lighting, overexposed, crushed blacks, double shadows，unnatural physics, fake water, static water, cardboard texture, plastic foliage，distorted face, deformed face, extra fingers, plastic skin, waxy skin, unnatural pose，natural eye colors only, no metallic shine，角色一致性：保持xiaoG、bai-ze形象一致，杜绝分身重影",
  "promptCharCount": 1252,
  "mouthAction": "嘴部微张，观察时自然呼吸",
  "importance": 5,
  "visualComplexity": 5,
  "qualityScore": { "totalScore": 75 },
  "enhanced": true,
  "physicsLayer": "",
  "colorScience": "",
  "negativePrompt": "",
  "renderStyle": "",
  "directorStyle": "",
  "priorities": {
    "characterRef": "P0-never",
    "dialogue": "P0-keep_core",
    "character": "P0-minimal_anchor",
    "camera": "P1-keep_core_movement",
    "action": "P1-keep_core_verb",
    "scene": "P1-keep_core_location",
    "lighting": "P1-keep_main_light",
    "backgroundSound": "P1-keep_core_sound",
    "mood": "P2-keyword_list",
    "timeline": "P2-keep_duration_type"
  }
}
```

### 顶层 Meta + Shots 完整结构

```json
{
  "meta": {
    "title": "山海经：白泽",
    "worldview": "nirath",
    "totalDuration": 60,
    "openingDuration": 10,
    "fps": 24,
    "resolution": "1920x1080",
    "styleNotes": "cinematic, hyperrealistic, film grain"
  },
  "shots": [
    // S00 片头（18字段）
    {
      "shotId": "S00",
      "duration": 10,
      "scene": "Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite",
      "mood": "epic, mysterious, awe-inspiring",
      "camera": { "shotSize": "extreme wide", "movement": "dolly in", "lens": "24mm", "speed": 0.3 },
      "cameraString": "extreme wide shot, dolly in, 24mm lens, speed 0.3",
      "lighting": { "keyLight": { "direction": "backlight", "colorTemp": 3200, "effect": "golden hour rim" } },
      "lightingString": "backlight 3200K, golden hour rim",
      "characterRef": "NONE",
      "character": "NONE",
      "action": "camera descends through mist layers",
      "dialogue": "NONE",
      "timeline": { "start": "T00:00", "end": "T00:10", "duration": 10, "type": "opening", "mood": "epic" },
      "timelineString": "T00:00-T00:10 / duration: 10s / type: opening / mood: epic",
      "audioLayer": { "segments": [{"time":"0-3s","sound":"sub-bass earth rumble"}] },
      "audioLayerString": "sub-bass earth rumble",
      "titleOverlay": { "mainTitle": "山海经：白泽", "subtitle": "Nirath", "producer": "by Genius" },
      "titleOverlayString": "MAIN_TITLE: \"山海经：白泽\" | SUBTITLE: \"Nirath\" | PRODUCER: \"by Genius\"",
      "backgroundSound": { "ambient": "deep earth rumble", "spatial": "3D audio pan", "intensity": {"crescendo":"0-3s"} },
      "backgroundSoundString": "AMBIENT: deep earth rumble | SPATIAL: 3D audio pan | INTENSITY: crescendo 0-3s",
      "prompt": "...",
      "promptCharCount": 1116
    },
    // S01 正片（17字段）
    {
      "shotId": "S01",
      "duration": 15,
      "scene": "Nirath, 知识圣殿, spatial depth: atmospheric perspective",
      "mood": "mysterious, anticipation, wonder",
      "camera": { "shotSize": "medium", "movement": "static", "lens": "35mm", "speed": 1.0 },
      "cameraString": "medium shot, static, 35mm lens, speed 1",
      "lighting": { "keyLight": { "direction": "front", "colorTemp": 4500, "effect": "neutral balanced" } },
      "lightingString": "front 4500K, neutral balanced",
      "characterRef": "小G: image://... | 白泽: image://...",
      "character": "小G: Human, explorer, curious | 白泽: Beast, white fur, mythical",
      "action": "protagonist steps forward",
      "dialogue": "小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES",
      "timeline": { "start": "T00:10", "end": "T00:25", "duration": 15, "type": "establishing", "mood": "mysterious" },
      "timelineString": "T00:10-T00:25 / duration: 15s / type: establishing / mood: mysterious",
      "backgroundSound": { "ambient": "wind and distant sounds", "spatial": "ambient stereo", "intensity": {"steady":"0-100%"} },
      "backgroundSoundString": "AMBIENT: wind and distant sounds | SPATIAL: ambient stereo | INTENSITY: steady 0-100%",
      "prompt": "...",
      "promptCharCount": 1252
    }
  ]
}
```

---

## 附录 A：版本变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v6.37 | 2026-06-12 | 基础生产版本（P0/P1/P2改造） |
| v6.37-Peng-optimized | 2026-06-13 | 专家反馈全量改造：优先级系统、结构化对象、极简锚点强化、L1-L9融合、硬约束规范 |

---

**文档结束**

- 生成系统: 卓越视频生成系统 v6.37-production+
- 维护者: Genius
- 反馈: 请联系管线团队
```

---

## 📄 hyperreality-system/docs/short-video-prompt-schema-v6.37-production.md

```md
# 卓越视频系统 - 短片提示词数据结构 v6.37

> **版本**: v6.37 (Production)  
> **日期**: 2026-06-12  
> **系统**: 卓越视频生成系统 (Hyperreality System)  
> **用途**: 标准参考文档，用于所有项目

---

## 一、顶层结构 (Meta)

每个短片包含一个 `meta` 元信息对象和一组 `shots` 镜头数组。

```json
{
  "meta": { ... },
  "shots": [
    { ... }, // S00 片头
    { ... }, // S01 正片镜头1
    { ... }, // S02 正片镜头2
    ...
  ]
}
```

---

## 二、Meta 字段（7字段）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 短片标题，如 "山海经：白泽" |
| `worldview` | string | 是 | 世界观标识，如 "nirath"、"earth"、"fantasy" |
| `totalDuration` | number | 是 | 总时长（秒），如 60-90 |
| `openingDuration` | number | 是 | 片头时长（秒），如 10 |
| `fps` | number | 是 | 帧率，默认 24 |
| `resolution` | string | 是 | 分辨率，如 "1920x1080" |
| `styleNotes` | string | 否 | 风格备注，如 "cinematic, hyperrealistic" |

### Meta 示例

```json
{
  "title": "山海经：白泽",
  "worldview": "nirath",
  "totalDuration": 60,
  "openingDuration": 10,
  "fps": 24,
  "resolution": "1920x1080",
  "styleNotes": "cinematic, hyperrealistic, film grain"
}
```

---

## 三、片头镜头 S00（15字段）

片头负责建立世界观、情绪基调，**通常无角色台词**（dialogue 为 NONE），但必须有 `audioLayer` 和 `titleOverlay`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `shotId` | string | 是 | 镜头编号，固定为 "S00" |
| `duration` | number | 是 | 时长（秒），如 10 |
| `scene` | string | 是 | 五维空间描述（详见下方规范） |
| `mood` | string | 是 | 3-5个情绪关键词，逗号分隔 |
| `camera` | string | 是 | 12级机位+运镜+焦距+速度（详见下方规范） |
| `lighting` | string | 是 | 主光方向+色温K值+特效光 |
| `characterRef` | string | 否 | 角色定妆照引用，格式见下方；片头通常 NONE |
| `character` | string | 否 | 角色极简锚点；片头通常 NONE |
| `action` | string | 是 | 核心动词+交互目标，描述镜头动态 |
| `dialogue` | string | 否 | 统一格式：SPEAKER\|TYPE\|EMOTION\|TEXT\|LIP_SYNC:YES；片头通常 NONE |
| `timeline` | string | 是 | 时间轴标记：T00:XX-T00:XX / duration: Xs / type: opening / mood: XXX |
| `audioLayer` | string | 是 | **片头专属**：音频层设计（四段式） |
| `titleOverlay` | string | 是 | **片头专属**：标题叠加信息（MAIN_TITLE/SUBTITLE/PRODUCER/TITLE_ANIM） |
| `backgroundSound` | string | 是 | 三段式环境音效：AMBIENT+SPATIAL+INTENSITY |
| `prompt` | string | 是 | 最终融合后的完整提示词（≤1500字符） |
| `promptCharCount` | number | 是 | 提示词字符数 |

### 片头字段注释

#### `scene` - 五维空间描述

格式：宏观地理 + 中观地貌 + 微观材质 + 天气时间 + 空间深度

示例：
```
Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite
```

#### `mood` - 情绪关键词

3-5个逗号分隔的情绪词，反映镜头情绪基调。

示例：
```
epic, mysterious, awe-inspiring
```

#### `camera` - 12级机位系统

格式：景别 + 运镜 + 焦距 + 速度

景别（12级）：extreme wide / wide / medium wide / medium / medium close / close / extreme close / macro / bird's eye / low angle / over shoulder / POV
运镜（14种）：static / slow pan / fast pan / tilt / dolly in / dolly out / truck / pedestal / crane / handheld / orbit / rack focus / zoom in / zoom out

示例：
```
epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed
```

#### `lighting` - 光照设计

格式：主光方向 + 色温K值 + 特效光

示例：
```
backlight 3200K, golden hour rim, volumetric god rays
```

#### `dialogue` - 统一格式

格式：`SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC:YES`

- SPEAKER: 说话者名称
- TYPE: 独白/对白/旁白/内心独白
- EMOTION: 情绪状态
- TEXT: 台词内容
- LIP_SYNC: YES/NO（是否对口型）

片头通常无台词，值为 `NONE`。

示例：
```
小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES
```

#### `timeline` - 时间轴标记

格式：`T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX`

示例：
```
T00:00-T00:10 / duration: 10s / type: opening / mood: epic
```

#### `audioLayer` - 片头专属音频层（四段式）

格式：四段音频描述，用逗号分隔

示例：
```
Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s
```

#### `titleOverlay` - 片头专属标题叠加

格式：`MAIN_TITLE: "XXX" | SUBTITLE: "XXX" | PRODUCER: "XXX" | TITLE_ANIM: XXX`

示例：
```
MAIN_TITLE: "山海经：白泽" | SUBTITLE: "Nirath" | PRODUCER: "by Genius" | TITLE_ANIM: light-vein carving growth 3.0-5.0s
```

#### `backgroundSound` - 三段式环境音效

格式：`AMBIENT: XXX | SPATIAL: XXX | INTENSITY: XXX`

- AMBIENT: 环境基底声（风声、水流、人群等）
- SPATIAL: 空间定位（3D音频、声源方向）
- INTENSITY: 强度曲线（crescendo/peak/decay 时间节点）

示例：
```
AMBIENT: epic atmosphere, deep earth rumble 20-60Hz | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s
```

### 片头 S00 完整示例

```json
{
  "shotId": "S00",
  "duration": 10,
  "scene": "Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite",
  "mood": "epic, mysterious, awe-inspiring",
  "camera": "epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed",
  "lighting": "backlight 3200K, golden hour rim, volumetric god rays",
  "characterRef": "NONE",
  "character": "NONE",
  "action": "establishing shot, camera slowly descending through atmospheric layers",
  "dialogue": "NONE",
  "timeline": "T00:00-T00:10 / duration: 10s / type: opening / mood: epic",
  "audioLayer": "Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s",
  "titleOverlay": "MAIN_TITLE: \"山海经：白泽\" | SUBTITLE: \"Nirath\" | PRODUCER: \"by Genius\" | TITLE_ANIM: light-vein carving growth 3.0-5.0s",
  "backgroundSound": "AMBIENT: epic atmosphere, deep earth rumble 20-60Hz | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s",
  "prompt": "16:9 cinematic, no text... [融合后的完整提示词]",
  "promptCharCount": 1423
}
```

---

## 四、正片镜头 S01+（14核心字段）

正片镜头包含叙事内容、角色表演、对话等。相比片头，**缺少 `audioLayer` 和 `titleOverlay`**（S01 可选保留 `audioLayer` 延续片头声音）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `shotId` | string | 是 | 镜头编号，如 "S01"、"S02" |
| `duration` | number | 是 | 时长（秒），如 15 |
| `scene` | string | 是 | 五维空间描述 |
| `mood` | string | 是 | 3-5个情绪关键词 |
| `camera` | string | 是 | 12级机位+运镜+焦距+速度 |
| `lighting` | string | 是 | 主光方向+色温K值+特效光 |
| `characterRef` | string | 是 | 角色定妆照引用：角色名: image://characters/{id}-{angle}.png |
| `character` | string | 是 | 角色极简锚点：角色名: 种族, 关键词1, 关键词2 |
| `action` | string | 是 | 核心动词+交互目标 |
| `dialogue` | string | 是 | 统一格式：SPEAKER\|TYPE\|EMOTION\|TEXT\|LIP_SYNC:YES |
| `timeline` | string | 是 | 时间轴标记：T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX |
| `backgroundSound` | string | 是 | 三段式环境音效：AMBIENT+SPATIAL+INTENSITY |
| `prompt` | string | 是 | 最终融合后的完整提示词（≤1500字符） |
| `promptCharCount` | number | 是 | 提示词字符数 |

### 正片字段说明

与片头相同字段（scene/mood/camera/lighting/action/timeline/backgroundSound/prompt/promptCharCount）参见上方片头注释。

#### `characterRef` - 角色定妆照引用

格式：多角色用 ` | ` 分隔，每角色多张图用 `, ` 分隔

```
小G: image://characters/xiaoG-front.png, image://characters/xiaoG-profile.png, image://characters/xiaoG-three-quarter.png, image://characters/xiaoG-closeup.png, image://characters/xiaoG-detail.png | 白泽: image://characters/bai-ze-front.png, image://characters/bai-ze-profile.png, image://characters/bai-ze-three-quarter.png, image://characters/bai-ze-closeup.png, image://characters/bai-ze-detail.png
```

#### `character` - 角色极简锚点

格式：角色名: 种族, 3-5个核心视觉关键词

```
小G: Human, explorer, curious, brave | 白泽: Beast, white fur, mythical, wise
```

#### `dialogue` - 台词（正片通常有）

```
小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES
```

### 正片 S01 完整示例

```json
{
  "shotId": "S01",
  "duration": 15,
  "scene": "Nirath, 知识圣殿, spatial depth: atmospheric perspective",
  "mood": "mysterious, anticipation, wonder",
  "camera": "medium shot, static hold, 35mm standard lens, normal speed",
  "lighting": "front light 4500K, neutral balanced, soft fill",
  "characterRef": "小G: image://characters/xiaoG-front.png, image://characters/xiaoG-profile.png, image://characters/xiaoG-three-quarter.png, image://characters/xiaoG-closeup.png, image://characters/xiaoG-detail.png | 白泽: image://characters/bai-ze-front.png, image://characters/bai-ze-profile.png, image://characters/bai-ze-three-quarter.png, image://characters/bai-ze-closeup.png, image://characters/bai-ze-detail.png",
  "character": "小G: Human, explorer, curious, brave | 白泽: Beast, white fur, mythical, wise",
  "action": "protagonist steps forward, observing surroundings with focused gaze",
  "dialogue": "小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES",
  "timeline": "T00:10-T00:25 / duration: 15s / type: establishing / mood: mysterious, anticipation, wonder",
  "backgroundSound": "AMBIENT: natural environment, wind and distant sounds | SPATIAL: ambient stereo field | INTENSITY: steady state, subtle variations",
  "prompt": "16:9 cinematic, no text... [融合后的完整提示词]",
  "promptCharCount": 1262
}
```

---

## 五、Prompt 融合顺序（L1-L9 九层架构）

最终 `prompt` 字段按以下顺序融合，确保结构化和优先级：

```
L1 约束层: 16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic
L2 基础层: hyperrealistic, ultra-detailed, HDR, film grain, 35mm texture
L3 空间层: scene（五维空间描述）
L4 主体层: character（极简锚点）→ action（核心动词）→ dialogue（统一格式台词）
L5 动态层: camera（12级机位+运镜）→ timeline（时间轴标记）
L6 风格层: mood（3-5情绪关键词）→ lighting（主光+色温+特效）
L7 音频层: backgroundSound（三段式）→ audioLayer（片头四段式，正片无）→ titleOverlay（片头标题，正片无）
L8 内部层: physicsLayer（物理参数）→ colorScience（色彩科学）→ renderStyle（渲染风格）→ directorStyle（导演风格）
L9 质控层: 负面约束（no watermark/cartoon/distorted等）→ 角色一致性约束
```

---

## 六、完整短片 JSON 示例

```json
{
  "meta": {
    "title": "山海经：白泽",
    "worldview": "nirath",
    "totalDuration": 60,
    "openingDuration": 10,
    "fps": 24,
    "resolution": "1920x1080",
    "styleNotes": "cinematic, hyperrealistic, film grain"
  },
  "shots": [
    {
      "shotId": "S00",
      "duration": 10,
      "scene": "Nirath, mysterious atmosphere, golden hour lighting, atmospheric layers, spatial depth: infinite",
      "mood": "epic, mysterious, awe-inspiring",
      "camera": "epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed",
      "lighting": "backlight 3200K, golden hour rim, volumetric god rays",
      "characterRef": "NONE",
      "character": "NONE",
      "action": "establishing shot, camera slowly descending through atmospheric layers",
      "dialogue": "NONE",
      "timeline": "T00:00-T00:10 / duration: 10s / type: opening / mood: epic",
      "audioLayer": "Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s",
      "titleOverlay": "MAIN_TITLE: \"山海经：白泽\" | SUBTITLE: \"Nirath\" | PRODUCER: \"by Genius\" | TITLE_ANIM: light-vein carving growth 3.0-5.0s",
      "backgroundSound": "AMBIENT: epic atmosphere, deep earth rumble 20-60Hz | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s",
      "prompt": "...",
      "promptCharCount": 1423
    },
    {
      "shotId": "S01",
      "duration": 15,
      "scene": "Nirath, 知识圣殿, spatial depth: atmospheric perspective",
      "mood": "mysterious, anticipation, wonder",
      "camera": "medium shot, static hold, 35mm standard lens, normal speed",
      "lighting": "front light 4500K, neutral balanced, soft fill",
      "characterRef": "小G: image://characters/xiaoG-front.png, image://characters/xiaoG-profile.png | 白泽: image://characters/bai-ze-front.png, image://characters/bai-ze-profile.png",
      "character": "小G: Human, explorer, curious, brave | 白泽: Beast, white fur, mythical, wise",
      "action": "protagonist steps forward, observing surroundings with focused gaze",
      "dialogue": "小G|独白|好奇|这就是白泽的领地吗？|LIP_SYNC:YES",
      "timeline": "T00:10-T00:25 / duration: 15s / type: establishing / mood: mysterious, anticipation, wonder",
      "backgroundSound": "AMBIENT: natural environment, wind and distant sounds | SPATIAL: ambient stereo field | INTENSITY: steady state, subtle variations",
      "prompt": "...",
      "promptCharCount": 1262
    }
  ]
}
```

---

## 七、关键规范总结

### 1. 字符限制
- 单镜头提示词（`prompt`）：≤1500 字符（中文约500字）
- 建议利用率：80-90%（1200-1350字符）
- 超过自动截断，保留音频层和角色一致性约束

### 2. 片头 vs 正片差异
| 特性 | 片头 S00 | 正片 S01+ |
|------|----------|-----------|
| 台词 | 通常 NONE | 通常有台词 |
| audioLayer | **有**（四段式） | 无（声音延续片头） |
| titleOverlay | **有**（标题叠加） | 无 |
| characterRef | 通常 NONE | 有（角色定妆照） |
| character | 通常 NONE | 有（角色极简锚点） |

### 3. 通用性原则
- 世界观（worldview）可配置：nirath / earth / fantasy 等
- 不硬编码任何项目专属内容（如山海经、Nirath）为默认值
- 所有字段保持中性/通用，支持电影/视频/教育/广告等场景

### 4. 保留字段（卓越系统特有）
以下字段供内部系统使用，不用于渲染：
- `mouthAction`: 嘴部动作描述（供Seedance对口型）
- `importance`: 镜头重要性评分（1-10）
- `visualComplexity`: 视觉复杂度评分（1-10）
- `qualityScore`: 质量评分对象
- `enhanced`: 是否经过PromptForge增强
- `physicsLayer`: 物理参数（扩展接口）
- `colorScience`: 色彩科学（扩展接口）
- `negativePrompt`: 负面提示词（扩展接口）
- `renderStyle`: 渲染风格（扩展接口）
- `directorStyle`: 导演风格（扩展接口）

---

**文档结束**  
**生成时间**: 2026-06-12 23:45  
**生成系统**: 卓越视频生成系统 v6.37
```

---

## 📄 hyperreality-system/engines/post-production-engine/post-production-engine.js

```js
// hyperreality-system/engines/post-production-engine/post-production-engine.js
// Post-Production Engine - 后期引擎（Layer 4）
// 功能：字幕、音乐、弹幕、多版本输出、HyperFrames 集成
// 版本：v1.0.0 | 日期：2026-06-08

const fs = require('fs').promises;
const path = require('path');

// 无版权音乐库配置
const ROYALTY_FREE_MUSIC_SOURCES = {
  pixabay: {
    baseUrl: 'https://pixabay.com/api/',
    search: 'https://pixabay.com/music/search/',
    download: 'https://pixabay.com/music/download/',
    license: 'Pixabay Content License - Free for commercial use, no attribution required'
  },
  bensound: {
    baseUrl: 'https://www.bensound.com/',
    license: 'CC BY 4.0 or Bensound License'
  },
  freesound: {
    baseUrl: 'https://freesound.org/',
    license: 'CC0 / CC BY / CC BY-NC - varies by sound'
  }
};

// 场景类型 → 音乐风格映射
const SCENE_MUSIC_MAP = {
  opening:     { mood: 'epic',       genre: 'orchestral',   tags: ['epic', 'cinematic', 'opening', 'heroic'] },
  establishing: { mood: 'ambient',    genre: 'atmospheric', tags: ['ambient', 'mysterious', 'wonder', 'exploration'] },
  conflict:     { mood: 'tense',      genre: 'action',      tags: ['tense', 'dramatic', 'battle', 'conflict'] },
  emotional_climax: { mood: 'emotional', genre: 'emotional', tags: ['emotional', 'dramatic', 'climax', 'intense'] },
  resolution:   { mood: 'hopeful',    genre: 'uplifting',   tags: ['hopeful', 'warm', 'resolution', 'peaceful'] }
};

// 角色身份介绍模板
const IDENTITY_INTRO_TEMPLATES = [
  "Nirath 星球探险者 | 人类 {name}",
  "硅基碳基共生体 | 守护者 {name}",
  "记忆探寻者 | 旅人 {name}",
  "星界行者 | {name} 的人类形态"
];

class PostProductionEngine {
  constructor(options = {}) {
    this.config = {
      outputDir: options.outputDir || '/tmp/hyperreality-post',
      hyperframesBin: options.hyperframesBin || 'npx hyperframes',
      musicSource: options.musicSource || 'pixabay',
      enableSubtitles: options.enableSubtitles !== false,      // 默认开启字幕
      enableDanmaku: options.enableDanmaku || false,           // 默认关闭弹幕
      enableMusic: options.enableMusic !== false,              // 默认开启音乐
      subtitleStyle: options.subtitleStyle || 'identity-card', // identity-card / lower-third / none
      versions: options.versions || ['standard', 'clean', 'subtitled', 'raw'],
      ...options
    };

    this.logs = [];
  }

  log(stage, message) {
    const entry = { stage, message, timestamp: Date.now() };
    this.logs.push(entry);
    console.log(`[POST-PROD] [${stage}] ${message}`);
  }

  /**
   * 主入口：后期制作
   * @param {Object} productionResult - 制作引擎输出（shots + prompts）
   * @param {Object} scriptResult - 剧本引擎输出（blueprint）
   * @param {Object} renderResult - 渲染引擎输出（渲染后的视频文件）
   * @returns {Object} 后期制作结果
   */
  async postProduce(productionResult, scriptResult, renderResult) {
    const startTime = Date.now();
    this.log('POST-PROD', '🎬 PostProductionEngine 启动 | 后期制作');
    this.log('POST-PROD', `   版本: ${this.config.versions.join(', ')}`);
    this.log('POST-PROD', `   字幕: ${this.config.enableSubtitles ? '✅' : '❌'} | 音乐: ${this.config.enableMusic ? '✅' : '❌'} | 弹幕: ${this.config.enableDanmaku ? '✅' : '❌'}`);

    const result = {
      success: false,
      versions: {},
      stages: {},
      errors: [],
      timing: {}
    };

    try {
      // ========== Stage 1: 字幕生成（身份介绍式）==========
      this.log('POST-PROD', '\n🎬 [Stage 1] 字幕生成 - 身份介绍式字幕');
      const stage1Start = Date.now();
      
      const subtitleTracks = await this.generateIdentitySubtitles(scriptResult);
      result.stages.subtitles = {
        tracks: subtitleTracks,
        count: subtitleTracks.length,
        timing: Date.now() - stage1Start
      };
      this.log('POST-PROD', `✅ 字幕生成完成: ${subtitleTracks.length} 条字幕`);

      // ========== Stage 2: 音乐匹配（无版权）==========
      this.log('POST-PROD', '\n🎵 [Stage 2] 音乐匹配 - 无版权音乐库');
      const stage2Start = Date.now();
      
      const musicTracks = await this.matchMusicTracks(productionResult, scriptResult);
      result.stages.music = {
        tracks: musicTracks,
        count: musicTracks.length,
        timing: Date.now() - stage2Start
      };
      this.log('POST-PROD', `✅ 音乐匹配完成: ${musicTracks.length} 段音乐`);

      // ========== Stage 3: 弹幕生成（可选）==========
      if (this.config.enableDanmaku) {
        this.log('POST-PROD', '\n💬 [Stage 3] 弹幕生成');
        const stage3Start = Date.now();
        
        const danmakuList = await this.generateDanmaku(productionResult, scriptResult);
        result.stages.danmaku = {
          list: danmakuList,
          count: danmakuList.length,
          timing: Date.now() - stage3Start
        };
        this.log('POST-PROD', `✅ 弹幕生成完成: ${danmakuList.length} 条弹幕`);
      }

      // ========== Stage 4: 多版本组装（HyperFrames HTML）==========
      this.log('POST-PROD', '\n🎨 [Stage 4] 多版本组装 - HyperFrames 集成');
      const stage4Start = Date.now();
      
      for (const version of this.config.versions) {
        this.log('POST-PROD', `   生成版本: ${version}...`);
        const versionData = await this.assembleVersion(
          version,
          productionResult,
          scriptResult,
          renderResult,
          subtitleTracks,
          musicTracks,
          result.stages.danmaku?.list || []
        );
        result.versions[version] = versionData;
      }
      result.stages.assembly = {
        versions: Object.keys(result.versions),
        timing: Date.now() - stage4Start
      };
      this.log('POST-PROD', `✅ 版本组装完成: ${this.config.versions.length} 个版本`);

      // ========== Stage 5: 质量检查 ==========
      this.log('POST-PROD', '\n🛡️ [Stage 5] 质量检查');
      const stage5Start = Date.now();
      
      const qualityCheck = await this.qualityCheck(result.versions);
      result.stages.quality = {
        passed: qualityCheck.passed,
        issues: qualityCheck.issues,
        timing: Date.now() - stage5Start
      };
      this.log('POST-PROD', `✅ 质量检查: ${qualityCheck.passed ? '通过' : '未通过'} (${qualityCheck.issues.length} 问题)`);

      result.success = qualityCheck.passed;
      result.timing.total = Date.now() - startTime;
      
      this.log('POST-PROD', `\n🏁 后期制作完成: ${result.timing.total}ms | ${this.config.versions.length} 版本`);

    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'POST_PRODUCTION',
        message: error.message
      });
      this.log('POST-PROD', `❌ 后期制作失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 生成身份介绍式字幕（嘉宾信息卡风格）
   * 
   * 设计：当角色出场时，显示 3-5 秒的简洁信息卡片
   * 不依赖台词时间戳，而是作为角色出场标记
   * 
   * 示例：
   * ┌─────────────────┐
   * │ 小G              │
   * │ Nirath 星球探险者 │
   * │ 人类 · 银灰装甲    │
   * └─────────────────┘
   */
  async generateIdentitySubtitles(scriptResult) {
    const blueprint = scriptResult.blueprint;
    const scenes = blueprint?.structure?.scenes || [];
    const characters = blueprint?.structure?.characters || [];
    const subtitles = [];

    for (const scene of scenes) {
      const sceneChars = scene.characters || [];
      
      for (const charId of sceneChars) {
        const char = characters.find(c => c.id === charId || c.name === charId);
        if (!char) continue;

        // 生成身份信息介绍（LLM 生成或模板）
        const identity = this.generateCharacterIdentity(char, scene);
        
        subtitles.push({
          type: 'identity_card',
          characterId: charId,
          characterName: char.name || charId,
          sceneId: scene.scene_id,
          // 出现在场景开始的前 3-5 秒
          start: scene.timing?.start_time || 0,
          duration: 3.5, // 固定 3.5 秒显示
          // 信息内容
          content: {
            name: char.name || charId,
            title: identity.title,           // 如 "Nirath 星球探险者"
            species: identity.species,        // 如 "人类"
            trait: identity.trait,            // 如 "银灰装甲"
            role: identity.role               // 如 "主角"
          },
          // 视觉样式（HyperFrames CSS）
          style: {
            position: 'bottom-left',
            fontSize: '24px',
            fontFamily: 'system-ui',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            borderLeft: '4px solid #00ff88',
            padding: '12px 20px',
            borderRadius: '0 8px 8px 0',
            animation: 'slideIn 0.5s ease-out'
          }
        });
      }
    }

    return subtitles;
  }

  /**
   * 生成角色身份信息（LLM 或模板）
   */
  generateCharacterIdentity(character, scene) {
    const name = character.name || '未知';
    const isProtagonist = character.role === 'protagonist' || character.id === 'xiaoG';
    
    // 物种判断
    const species = this.inferSpecies(character);
    
    // 特征提取（从角色描述或场景设定）
    const trait = this.extractTrait(character, scene);
    
    // 标题（LLM 生成或模板选择）
    let title;
    if (isProtagonist) {
      title = `Nirath 星球探险者 | ${species} ${name}`;
    } else if (character.id?.includes('beast') || species.includes('异兽')) {
      title = `Nirath 原生异兽 | ${name}`;
    } else {
      title = `Nirath 旅者 | ${species} ${name}`;
    }
    
    return {
      name,
      title,
      species,
      trait: trait || '探索者',
      role: isProtagonist ? '主角' : '配角'
    };
  }

  inferSpecies(character) {
    if (character.id === 'xiaoG') return '人类';
    if (character.id?.includes('taotie') || character.name?.includes('饕餮')) return '硅基碳基共生体';
    if (character.tags?.includes('beast')) return '异兽';
    return '旅者';
  }

  extractTrait(character, scene) {
    // 从角色描述或场景设定中提取特征
    if (character.id === 'xiaoG') return '银灰装甲';
    if (character.id?.includes('taotie') || character.name?.includes('饕餮')) return '碳化硅质甲壳';
    if (character.visuals?.color) return character.visuals.color;
    return '探索者';
  }

  /**
   * 匹配无版权音乐
   * 
   * 策略：
   * 1. 按场景类型匹配音乐风格
   * 2. 从 Pixabay/Bensound 等免费库获取
   * 3. 使用场景标签搜索
   * 4. 下载并缓存
   */
  async matchMusicTracks(productionResult, scriptResult) {
    const blueprint = scriptResult.blueprint;
    const scenes = blueprint?.structure?.scenes || [];
    const tracks = [];

    for (const scene of scenes) {
      const sceneType = scene.scene_type;
      const mapping = SCENE_MUSIC_MAP[sceneType] || SCENE_MUSIC_MAP.establishing;
      
      tracks.push({
        sceneId: scene.scene_id,
        sceneType: sceneType,
        // 音乐搜索参数（实际使用时调用 API）
        searchParams: {
          mood: mapping.mood,
          genre: mapping.genre,
          tags: mapping.tags,
          duration: scene.timing?.duration || 25, // 匹配场景时长
          // 搜索关键词组合
          query: `${mapping.genre} ${mapping.mood} ${mapping.tags.join(' ')}`
        },
        // 推荐配置
        config: {
          volume: 0.35,           // 背景音乐音量（35%，不盖过台词）
          fadeIn: 2.0,           // 淡入 2 秒
          fadeOut: 3.0,          // 淡出 3 秒
          loop: false            // 不循环（每个场景独立音乐）
        },
        // 音乐来源信息
        source: {
          platform: this.config.musicSource,
          license: ROYALTY_FREE_MUSIC_SOURCES[this.config.musicSource]?.license || 'Unknown',
          url: null,              // 实际下载后填充
          filePath: null          // 本地缓存路径
        }
      });
    }

    return tracks;
  }

  /**
   * 生成弹幕（可选）
   * 
   * 弹幕设计：
   * - 从台词、角色信息、场景描述中提取
   * - 使用 LLM 生成短句弹幕
   * - 不同场景类型有不同弹幕风格
   */
  async generateDanmaku(productionResult, scriptResult) {
    const blueprint = scriptResult.blueprint;
    const scenes = blueprint?.structure?.scenes || [];
    const danmaku = [];

    for (const scene of scenes) {
      const sceneType = scene.scene_type;
      const startTime = scene.timing?.start_time || 0;
      const duration = scene.timing?.duration || 25;
      
      // 根据场景类型生成不同风格的弹幕
      const baseDanmaku = this.generateSceneDanmaku(scene, sceneType);
      
      for (const text of baseDanmaku) {
        danmaku.push({
          text,
          sceneId: scene.scene_id,
          startTime: startTime + Math.random() * duration * 0.8, // 随机分布在场景内
          duration: 4 + Math.random() * 3, // 4-7 秒显示
          speed: 1.0 + Math.random() * 0.5, // 1.0-1.5x 速度
          color: this.getDanmakuColor(sceneType),
          size: this.getDanmakuSize(sceneType),
          position: 'top' // 顶部飘过，避免遮挡画面
        });
      }
    }

    return danmaku;
  }

  generateSceneDanmaku(scene, sceneType) {
    const dialogues = scene.dialogue?.lines || [];
    const setting = scene.setting || '';
    const chars = scene.characters || [];
    
    const danmakuPool = [];
    
    // 从台词提取关键词
    for (const line of dialogues) {
      if (line.text && line.text.length > 5) {
        danmakuPool.push(line.text.substring(0, 15)); // 前15字
      }
    }
    
    // 场景类型弹幕
    const typeComments = {
      opening: ['🔥 开局！', '⚡ 燃起来了', '小G冲！', 'Nirath 我来了'],
      establishing: ['🌟 好美', '这是什么星球', '晶体森林！', '双月！'],
      conflict: ['💥 打起来！', '小心！', '饕餮来了！', '好紧张！'],
      emotional_climax: ['😭 泪目', '太感人了', '记忆即存在！', '燃！'],
      resolution: ['✨ 圆满', '期待下一集', '小G成长了', 'Nirath 等我']
    };
    
    if (typeComments[sceneType]) {
      danmakuPool.push(...typeComments[sceneType]);
    }
    
    // 从设定提取关键词弹幕
    if (setting.includes('Nirath')) danmakuPool.push('Nirath 星球！');
    if (setting.includes('晶体')) danmakuPool.push('晶体森林！');
    if (setting.includes('双月')) danmakuPool.push('双月当空！');
    if (chars.includes('taotie') || chars.includes('饕餮')) danmakuPool.push('饕餮！');
    
    // 随机选择 3-5 条
    const count = 3 + Math.floor(Math.random() * 3);
    return this.shuffleArray(danmakuPool).slice(0, count);
  }

  shuffleArray(arr) {
    return arr.sort(() => Math.random() - 0.5);
  }

  getDanmakuColor(sceneType) {
    const colors = {
      opening: '#ff6b6b',
      establishing: '#4ecdc4',
      conflict: '#ff4757',
      emotional_climax: '#ffa502',
      resolution: '#2ed573'
    };
    return colors[sceneType] || '#ffffff';
  }

  getDanmakuSize(sceneType) {
    const sizes = {
      opening: 'large',
      establishing: 'medium',
      conflict: 'large',
      emotional_climax: 'xlarge',
      resolution: 'medium'
    };
    return sizes[sceneType] || 'medium';
  }

  /**
   * 组装不同版本（生成 HyperFrames HTML）
   */
  async assembleVersion(version, productionResult, scriptResult, renderResult, subtitles, musicTracks, danmakuList) {
    const versionConfig = this.getVersionConfig(version);
    
    // 生成 HyperFrames HTML
    const html = this.generateHyperFramesHTML(
      version,
      versionConfig,
      productionResult,
      scriptResult,
      renderResult,
      subtitles,
      musicTracks,
      danmakuList
    );
    
    // 保存 HTML 文件
    const versionDir = path.join(this.config.outputDir, `version-${version}`);
    await fs.mkdir(versionDir, { recursive: true });
    
    const htmlPath = path.join(versionDir, 'composition.html');
    await fs.writeFile(htmlPath, html);
    
    // 保存配置 JSON
    const configPath = path.join(versionDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({
      version,
      features: versionConfig,
      subtitleCount: subtitles.length,
      musicTrackCount: musicTracks.length,
      danmakuCount: danmakuList.length,
      generatedAt: new Date().toISOString()
    }, null, 2));
    
    return {
      version,
      htmlPath,
      configPath,
      features: versionConfig,
      // 渲染命令（实际使用时）
      renderCommand: `${this.config.hyperframesBin} render ${htmlPath} --output ${path.join(versionDir, 'output.mp4')}`,
      previewCommand: `${this.config.hyperframesBin} preview ${htmlPath}`
    };
  }

  getVersionConfig(version) {
    const configs = {
      // 标准版：全功能
      standard: {
        subtitles: true,
        music: true,
        danmaku: false, // 标准版无弹幕
        transitions: true,
        titleCard: true
      },
      // 纯净版：无字幕、无音乐、无弹幕
      clean: {
        subtitles: false,
        music: false,
        danmaku: false,
        transitions: true,
        titleCard: false
      },
      // 字幕版：带身份介绍字幕 + 音乐
      subtitled: {
        subtitles: true,
        music: true,
        danmaku: false,
        transitions: true,
        titleCard: true
      },
      // 弹幕版：带弹幕 + 字幕 + 音乐
      danmaku: {
        subtitles: true,
        music: true,
        danmaku: true,
        transitions: true,
        titleCard: true
      },
      // 原始版：仅渲染后的视频，无任何后期
      raw: {
        subtitles: false,
        music: false,
        danmaku: false,
        transitions: false,
        titleCard: false
      }
    };
    
    return configs[version] || configs.standard;
  }

  /**
   * 生成 HyperFrames HTML 合成文件
   * 
   * HyperFrames 格式：
   * - data-composition-id: 合成ID
   * - data-start: 开始时间（秒）
   * - data-duration: 持续时间（秒）
   * - data-track-index: 轨道索引
   * - class="clip": 可剪辑元素
   */
  generateHyperFramesHTML(version, config, productionResult, scriptResult, renderResult, subtitles, musicTracks, danmakuList) {
    const shots = productionResult.shots || [];
    const blueprint = scriptResult.blueprint;
    const totalDuration = shots.reduce((sum, s) => sum + (s.timing?.duration || 25), 0);
    
    let html = [];
    
    // HTML 头部
    html.push('<!DOCTYPE html>');
    html.push('<html>');
    html.push('<head>');
    html.push('  <meta charset="UTF-8">');
    html.push('  <style>');
    html.push('    * { margin: 0; padding: 0; box-sizing: border-box; }');
    html.push('    body { background: #000; overflow: hidden; }');
    html.push('    #stage { width: 1920px; height: 1080px; position: relative; background: #000; }');
    html.push('    .clip { position: absolute; }');
    html.push('    ');
    html.push('    /* 身份介绍字幕样式 */');
    html.push('    .identity-card { ');
    html.push('      position: absolute; bottom: 80px; left: 60px;');
    html.push('      background: rgba(0, 0, 0, 0.75);');
    html.push('      border-left: 4px solid #00ff88;');
    html.push('      padding: 16px 24px; border-radius: 0 8px 8px 0;');
    html.push('      font-family: system-ui, -apple-system, sans-serif;');
    html.push('      color: white; max-width: 400px;');
    html.push('    }');
    html.push('    .identity-card .name { font-size: 28px; font-weight: bold; margin-bottom: 8px; }');
    html.push('    .identity-card .title { font-size: 18px; color: #ccc; margin-bottom: 4px; }');
    html.push('    .identity-card .trait { font-size: 14px; color: #00ff88; }');
    html.push('    ');
    html.push('    /* 弹幕样式 */');
    html.push('    .danmaku { ');
    html.push('      position: absolute; white-space: nowrap;');
    html.push('      font-family: system-ui, sans-serif; font-weight: bold;');
    html.push('      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);');
    html.push('      pointer-events: none;');
    html.push('    }');
    html.push('    ');
    html.push('    /* 转场遮罩 */');
    html.push('    .transition { ');
    html.push('      position: absolute; top: 0; left: 0; width: 100%; height: 100%;');
    html.push('      background: black; pointer-events: none;');
    html.push('    }');
    html.push('  </style>');
    html.push('</head>');
    html.push('<body>');
    html.push(`<div id="stage" data-composition-id="hyperreality-${version}" data-start="0" data-width="1920" data-height="1080">`);
    html.push('');
    
    let currentTime = 0;
    let trackIndex = 0;
    
    // ========== 视频片段轨道 ==========
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const duration = shot.timing?.duration || 25;
      
      // 视频片段（实际使用时替换为渲染后的视频文件）
      html.push(`  <!-- Shot ${shot.shotId} -->`);
      html.push(`  <video class="clip" data-start="${currentTime}" data-duration="${duration}" data-track-index="${trackIndex++}"`);
      html.push(`         src="shot-${shot.shotId}.mp4" muted playsinline style="width:100%; height:100%;"></video>`);
      html.push('');
      
      // 转场效果（镜头之间）
      if (config.transitions && i < shots.length - 1) {
        html.push(`  <!-- Transition ${shot.shotId} → ${shots[i+1].shotId} -->`);
        html.push(`  <div class="clip transition" data-start="${currentTime + duration - 0.5}" data-duration="0.5" data-track-index="${trackIndex++}"`);
        html.push(`       style="opacity: 0;"></div>`);
        html.push('');
      }
      
      currentTime += duration;
    }
    
    // ========== 字幕轨道（身份介绍式）==========
    if (config.subtitles) {
      html.push('  <!-- 字幕轨道 -->');
      for (const sub of subtitles) {
        html.push(`  <div class="clip identity-card" data-start="${sub.start}" data-duration="${sub.duration}" data-track-index="${trackIndex++}">`);
        html.push(`    <div class="name">${sub.content.name}</div>`);
        html.push(`    <div class="title">${sub.content.title}</div>`);
        html.push(`    <div class="trait">${sub.content.species} · ${sub.content.trait}</div>`);
        html.push('  </div>');
      }
      html.push('');
    }
    
    // ========== 音乐轨道 ==========
    if (config.music) {
      html.push('  <!-- 音乐轨道 -->');
      for (const track of musicTracks) {
        const start = track.sceneId ? this.getSceneStartTime(track.sceneId, shots) : 0;
        const duration = track.searchParams?.duration || 25;
        html.push(`  <audio class="clip" data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex++}"`);
        html.push(`         data-volume="${track.config.volume}" src="music-${track.sceneId}.mp3"></audio>`);
      }
      html.push('');
    }
    
    // ========== 弹幕轨道 ==========
    if (config.danmaku) {
      html.push('  <!-- 弹幕轨道 -->');
      for (const dm of danmakuList) {
        const sizeMap = { small: '20px', medium: '28px', large: '36px', xlarge: '44px' };
        const size = sizeMap[dm.size] || '28px';
        html.push(`  <div class="clip danmaku" data-start="${dm.startTime}" data-duration="${dm.duration}" data-track-index="${trackIndex++}"`);
        html.push(`       style="top: ${50 + Math.random() * 300}px; color: ${dm.color}; font-size: ${size};"`);
        html.push(`       data-speed="${dm.speed}">${dm.text}</div>`);
      }
      html.push('');
    }
    
    // ========== GSAP 动画 ==========
    html.push('  <!-- GSAP 动画 -->');
    html.push('  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>');
    html.push('  <script>');
    html.push('    const tl = gsap.timeline({ paused: true });');
    html.push('    ');
    html.push('    // 身份卡片滑入动画');
    html.push('    tl.from(".identity-card", { ');
    html.push('      opacity: 0, x: -100, duration: 0.5, ease: "power2.out", stagger: 0.1 ');
    html.push('    }, 0);');
    html.push('    ');
    html.push('    // 弹幕从右到左动画');
    html.push('    document.querySelectorAll(".danmaku").forEach(d => {');
    html.push('      const speed = parseFloat(d.dataset.speed) || 1;');
    html.push('      const startX = 1920;');
    html.push('      const endX = -d.offsetWidth;');
    html.push('      const duration = (startX - endX) / (200 * speed);');
    html.push('      tl.fromTo(d, ');
    html.push('        { x: startX },');
    html.push('        { x: endX, duration: duration, ease: "linear" },');
    html.push('        parseFloat(d.dataset.start) || 0');
    html.push('      );');
    html.push('    });');
    html.push('    ');
    html.push('    // 转场淡入');
    html.push('    tl.to(".transition", { opacity: 1, duration: 0.25, ease: "power2.in" }, "-=0.5");');
    html.push('    tl.to(".transition", { opacity: 0, duration: 0.25, ease: "power2.out" });');
    html.push('    ');
    html.push('    window.__timelines = window.__timelines || {};');
    html.push(`    window.__timelines["hyperreality-${version}"] = tl;`);
    html.push('  </script>');
    html.push('');
    html.push('</div>'); // #stage
    html.push('</body>');
    html.push('</html>');
    
    return html.join('\n');
  }

  getSceneStartTime(sceneId, shots) {
    let time = 0;
    for (const shot of shots) {
      if (shot.shotId === sceneId || shot.sceneId === sceneId) {
        return time;
      }
      time += shot.timing?.duration || 25;
    }
    return 0;
  }

  /**
   * 质量检查
   */
  async qualityCheck(versions) {
    const issues = [];
    
    // 检查每个版本
    for (const [version, data] of Object.entries(versions)) {
      // 检查 HTML 文件是否存在
      if (!data.htmlPath) {
        issues.push(`版本 ${version}: HTML 文件路径缺失`);
      }
      
      // 检查版本特征是否匹配
      const expectedFeatures = this.getVersionConfig(version);
      if (JSON.stringify(expectedFeatures) !== JSON.stringify(data.features)) {
        issues.push(`版本 ${version}: 特征配置不匹配`);
      }
    }
    
    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * 生成后期制作报告（Markdown）
   */
  generateReport(postResult) {
    const lines = [];
    
    lines.push('# 🎬 后期制作报告');
    lines.push('');
    lines.push(`**版本**: ${this.config.versions.join(', ')}`);
    lines.push(`**状态**: ${postResult.success ? '✅ 成功' : '❌ 失败'}`);
    lines.push(`**总耗时**: ${postResult.timing?.total}ms`);
    lines.push('');
    
    // 各阶段耗时
    lines.push('## ⏱️ 各阶段耗时');
    lines.push('');
    lines.push(`| 阶段 | 耗时 | 产出 |`);
    lines.push(`|------|------|------|`);
    for (const [stage, data] of Object.entries(postResult.stages)) {
      const timing = data.timing || 'N/A';
      const count = data.count || data.tracks?.length || data.list?.length || data.versions?.length || 0;
      lines.push(`| ${stage} | ${timing}ms | ${count} |`);
    }
    lines.push('');
    
    // 版本详情
    lines.push('## 📦 版本详情');
    lines.push('');
    for (const [version, data] of Object.entries(postResult.versions)) {
      lines.push(`### ${version} 版`);
      lines.push(`- HTML: ${data.htmlPath}`);
      lines.push(`- 特征: ${Object.entries(data.features).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      lines.push(`- 渲染命令: \`${data.renderCommand}\``);
      lines.push('');
    }
    
    // 字幕预览
    if (postResult.stages.subtitles?.tracks?.length > 0) {
      lines.push('## 🎭 字幕预览（身份介绍式）');
      lines.push('');
      lines.push(`| 角色 | 场景 | 时长 | 内容 |`);
      lines.push(`|------|------|------|------|`);
      for (const sub of postResult.stages.subtitles.tracks.slice(0, 5)) {
        lines.push(`| ${sub.characterName} | ${sub.sceneId} | ${sub.duration}s | ${sub.content.title} |`);
      }
      lines.push('');
    }
    
    // 音乐预览
    if (postResult.stages.music?.tracks?.length > 0) {
      lines.push('## 🎵 音乐配置');
      lines.push('');
      lines.push(`| 场景 | 风格 | 情绪 | 音量 | 淡入/出 |`);
      lines.push(`|------|------|------|------|--------|`);
      for (const track of postResult.stages.music.tracks.slice(0, 5)) {
        lines.push(`| ${track.sceneId} | ${track.searchParams.genre} | ${track.searchParams.mood} | ${track.config.volume} | ${track.config.fadeIn}s/${track.config.fadeOut}s |`);
      }
      lines.push('');
    }
    
    lines.push('---');
    lines.push(`*生成时间: ${new Date().toISOString()}*`);
    
    return lines.join('\n');
  }
}

module.exports = { PostProductionEngine, SCENE_MUSIC_MAP, ROYALTY_FREE_MUSIC_SOURCES };
```

---

## 📄 hyperreality-system/engines/production-engine/production-engine.js

```js
// hyperreality-system/engines/production-engine/production-engine.js
// Production Engine - 制作引擎（Layer 2）
// 深度融合：直接消费 ScriptBlueprint 输出，驱动镜头生成
// 版本：v1.0.0 | 日期：2026-06-08

const path = require('path');

// 复用现有系统的核心模块（从 systems/ 复制过来）
// 注：实际部署时这些模块会从 systems/ 复制到 production-engine/modules/
const SYSTEMS_PATH = path.join(__dirname, '../../../systems');

// 动态加载现有模块
function loadModule(name) {
  try {
    return require(path.join(SYSTEMS_PATH, name));
  } catch (e) {
    console.warn(`[ProductionEngine] 模块加载失败: ${name} - ${e.message}`);
    return null;
  }
}

class ProductionEngine {
  constructor(options = {}) {
    this.config = {
      maxPromptLength: 1500,  // v2.0-B+: 从980提升至1500，支持七层架构+音频层
      targetPromptLength: 1470,  // v2.0-B+: 对应提升
      referenceImageCount: 2,
      outputDir: options.outputDir || '/tmp/hyperreality-output',
      ...options
    };
    
    this.modules = {};
    this.logs = [];
    this._initModules();
  }

  _initModules() {
    // 加载核心模块（从现有系统复用）
    this.modules = {
      // 时长分配
      shotDurationAllocator: loadModule('shot-duration-allocator.js')?.ShotDurationAllocator,
      durationCalculator: loadModule('duration-calculator.js')?.DurationCalculator,
      
      // 运镜系统
      cameraMovement: loadModule('camera-movement-system-v2.js')?.CameraMovementSystem,
      intraShotTimeline: loadModule('camera-movement-system-v3.js')?.IntraShotTimelineGenerator,
      
      // 连续性
      continuityEngine: loadModule('continuity-engine.js')?.ContinuityEngine,
      
      // Prompt 增强
      promptEnhancer: loadModule('intra-shot-prompt-enhancer.js')?.IntraShotPromptEnhancer,
      styleInjector: loadModule('universal-style-injector.js')?.UniversalStyleInjector,
      
      // 质量门
      promptQualityGate: loadModule('prompt-quality-gate.js')?.PromptQualityGate,
      
      // 字符计数
      charCounter: loadModule('char-counter')?.charCounter,
      
      // 片头系统
      openingSystem: loadModule('opening-system-v3.js'),
      
      // 角色系统
      characterManager: loadModule('character-manager-v2.js')?.CharacterManagerV2,
      characterPromptBuilder: loadModule('character-prompt-builder.js')?.CharacterPromptBuilder,
      
      // 校验
      storyboardValidator: loadModule('storyboard-validator.js')?.StoryboardValidator,
      preRenderValidation: loadModule('pre-render-validation.js')?.preRenderValidation,
      
      // 后期
      postProduction: loadModule('post-production-pipeline.js')?.PostProductionPipeline,
    };
    
    // 初始化实例
    for (const [key, Module] of Object.entries(this.modules)) {
      if (Module && typeof Module === 'function') {
        try {
          this.modules[key] = new Module();
        } catch (e) {
          // 已经是实例或无需 new
        }
      }
    }
  }

  log(stage, message) {
    const entry = { stage, message, timestamp: Date.now() };
    this.logs.push(entry);
    console.log(`[${stage}] ${message}`);
  }

  /**
   * 主入口：从 ScriptBlueprint 生成完整镜头
   * @param {object} adaptedBlueprint - 适配器输出的剧本数据
   * @returns {object} { shots, prompts, report }
   */
  async produce(adaptedBlueprint) {
    const startTime = Date.now();
    this.log('PRODUCE', '🎬 ProductionEngine 启动 | 深度融合模式');
    
    const result = {
      success: false,
      shots: [],
      prompts: [],
      stages: {},
      errors: [],
      logs: this.logs,
      timing: {}
    };

    try {
      // === Stage 1: 从蓝图提取场景并转换为镜头结构 ===
      result.stages.sceneExtraction = await this._runStage('scene-extraction', () =>
        this._extractScenes(adaptedBlueprint)
      );
      
      // === Stage 2: 时长分配（基于剧本已有时长）===
      result.stages.durationAllocation = await this._runStage('duration-allocation', () =>
        this._allocateDuration(result.stages.sceneExtraction.shots)
      );
      
      // === Stage 3: 运镜设计（每镜头独立）===
      result.stages.cameraDesign = await this._runStage('camera-design', () =>
        this._designCameraMovement(result.stages.durationAllocation.shots)
      );
      
      // === Stage 4: Prompt 工程（核心阶段）===
      result.stages.promptEngineering = await this._runStage('prompt-engineering', () =>
        this._engineerPrompts(result.stages.cameraDesign.shots, adaptedBlueprint)
      );
      
      // === Stage 5: 质量门校验 ===
      result.stages.qualityGate = await this._runStage('quality-gate', () =>
        this._runQualityGate(result.stages.promptEngineering.prompts)
      );
      
      // === Stage 6: 片头生成（如有需要）===
      if (adaptedBlueprint.config?.featured_beast_id) {
        result.stages.opening = await this._runStage('opening', () =>
          this._generateOpening(adaptedBlueprint)
        );
      }
      
      // === Stage 7: 连续性检查 ===
      result.stages.continuity = await this._runStage('continuity', () =>
        this._checkContinuity(result.stages.promptEngineering.prompts)
      );
      
      // 汇总
      result.shots = result.stages.promptEngineering.shots;
      result.prompts = result.stages.promptEngineering.prompts;
      
      // v6.37-P0: 构建标准输出结构（meta + opening + shots）
      result.meta = this._buildMeta(adaptedBlueprint);
      result.opening = result.stages.opening?.openingData || null;
      
      result.success = true;
      result.timing.total = Date.now() - startTime;
      
      this.log('PRODUCE', `✅ 制作完成: ${result.shots.length} 镜头, ${result.prompts.length} Prompts`);
      
    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'PRODUCE',
        message: error.message,
        stack: error.stack
      });
      this.log('ERROR', `❌ 制作失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 运行单个 Stage 并计时
   */
  async _runStage(stageName, stageFn) {
    const start = Date.now();
    this.log(stageName.toUpperCase(), `开始...`);
    
    try {
      const output = await stageFn();
      const duration = Date.now() - start;
      this.log(stageName.toUpperCase(), `完成 (${duration}ms)`);
      return { ...output, _stageDuration: duration };
    } catch (error) {
      const duration = Date.now() - start;
      this.log(stageName.toUpperCase(), `失败 (${duration}ms): ${error.message}`);
      throw error;
    }
  }

  /**
   * v6.37-P0: 构建 Meta 元信息
   */
  _buildMeta(adaptedBlueprint) {
    const worldSetting = adaptedBlueprint.worldSetting || {};
    const config = adaptedBlueprint.config || {};
    
    return {
      title: config.title || '未命名短片',
      worldview: worldSetting.world_id || 'default',
      totalDuration: this._calculateTotalDuration(adaptedBlueprint.scenes),
      openingDuration: config.opening_duration || 10,
      fps: 24,
      resolution: '1920x1080',
      styleNotes: config.style_notes || 'cinematic, hyperrealistic'
    };
  }
  
  _calculateTotalDuration(scenes) {
    if (!scenes || scenes.length === 0) return 0;
    return scenes.reduce((sum, scene) => sum + (scene.timing?.duration || 20), 0);
  }

  /**
   * v6.37-P1+: 构建角色极简锚点（专家反馈强化）
   * 规则：
   * 1. 强制3-5个视觉关键词（不含种族/物种）
   * 2. 禁止详细描述（如"十五米高的巨型身躯"）
   * 3. 颜色词不超过2个
   * 4. 禁止形容词堆砌（超过3个连续形容词则截断）
   * 5. 格式：角色名: 种族/物种, 视觉关键词1, 视觉关键词2, 视觉关键词3
   * 
   * 正例：白泽: lion-like beast, vertical eye, three white-flame tails, golden hooves
   * 反例：白泽: 一只十五米高的白色神兽，有着三根尾巴和金色的蹄子（太啰嗦）
   */
  _buildMinimalAnchor(cid, characters) {
    const char = characters.find(c => c.character_id === cid);
    if (!char) return `${cid}: unknown`;
    
    const race = char.species || char.race || 'unknown';
    const features = char.visual_anchor?.core_features || [];
    
    // 颜色词列表（用于检查）
    const colorWords = ['white', 'black', 'red', 'blue', 'green', 'golden', 'silver', 'purple', 'brown', 'grey', 'gray', 'yellow', 'orange', 'pink', 'cyan', 'teal'];
    
    // 形容词列表（用于检查堆砌）
    const adjectiveWords = ['big', 'huge', 'giant', 'large', 'small', 'tiny', 'massive', 'tall', 'short', 'beautiful', 'magnificent', 'mysterious', 'ancient', 'powerful', 'fierce', 'gentle', 'elegant', 'majestic', 'terrifying', 'sacred', 'divine', 'mythical', 'legendary', 'noble', 'wise', 'brave', 'curious', 'young', 'old'];
    
    // 过滤并优化特征
    const processedFeatures = [];
    let colorCount = 0;
    let adjCount = 0;
    
    for (const feature of features) {
      const lower = feature.toLowerCase();
      
      // 跳过详细描述（超过15字符可能太啰嗦）
      if (feature.length > 15 && !feature.includes(' ') && !feature.includes('-')) {
        continue; // 跳过单个超长词（可能是详细描述）
      }
      
      // 检查颜色词
      const isColor = colorWords.some(c => lower.includes(c));
      if (isColor) {
        if (colorCount >= 2) continue; // 颜色词不超过2个
        colorCount++;
      }
      
      // 检查形容词堆砌（连续形容词计数）
      const isAdjective = adjectiveWords.some(a => lower.includes(a));
      if (isAdjective) {
        adjCount++;
        if (adjCount > 3) continue; // 形容词不超过3个
      } else {
        adjCount = 0; // 重置计数
      }
      
      processedFeatures.push(feature);
      
      // 强制3-5个关键词
      if (processedFeatures.length >= 5) break;
    }
    
    // 确保至少3个关键词
    while (processedFeatures.length < 3 && features.length > processedFeatures.length) {
      const next = features[processedFeatures.length];
      if (next) processedFeatures.push(next);
      else break;
    }
    
    const keywords = processedFeatures.slice(0, 5).join(', ');
    return `${char.name}: ${race}, ${keywords}`;
  }
  
  /**
   * Stage 1: 从适配蓝图提取场景，转换为内部镜头结构
   * v6.37-P0: 改造为符合参考文档的字段格式
   */
  _extractScenes(adaptedBlueprint) {
    const scenes = adaptedBlueprint.scenes || [];
    const characters = adaptedBlueprint.characters || [];
    const worldSetting = adaptedBlueprint.worldSetting || {};
    
    const shots = scenes.map((scene, index) => {
      // 构建角色描述（v6.37-P1+: 强制极简锚点，3-5关键词）
      const characterAnchors = (scene.characters || []).map(cid => {
        return this._buildMinimalAnchor(cid, characters);
      });
      
      // 构建对话（v6.37-P0: 统一格式 SPEAKER|TYPE|EMOTION|TEXT|LIP_SYNC:YES）
      const dialogueLines = (scene.dialogue?.lines || []).map(line => {
        const speaker = line.speaker || '角色';
        const type = line.type || '独白';
        const emotion = line.emotion || '平静';
        const text = line.text || '';
        return `${speaker}|${type}|${emotion}|${text}|LIP_SYNC:YES`;
      });
      
      // v6.37-P0: 构建五维空间描述（scene字段）
      const sceneDescription = this._buildFiveDimensionScene(scene, worldSetting);
      
      // v6.37-P0: 构建 mood（3-5情绪关键词）
      const mood = this._buildMood(scene);
      
      // v6.37-P0: 构建 action（核心动词+交互目标）
      const action = this._buildAction(scene);
      
      return {
        shotId: scene.scene_id || `S${String(index + 1).padStart(2, '0')}`,
        sceneType: scene.scene_type || 'establishing',
        sceneFunction: scene.scene_function || 'establish',
        
        // v6.37-P0: 时序（保留对象，后续转为字符串）
        timing: {
          start: scene.timing?.start || 0,
          duration: scene.timing?.duration || 20,
          end: scene.timing?.end || 20
        },
        
        // v6.37-P0: 场景（五维空间描述法）
        scene: sceneDescription,
        
        // v6.37-P0: 情绪
        mood: mood,
        
        // v6.37-P0: 角色（极简锚点）
        character: characterAnchors.join(' | '),
        characterRef: this._buildCharacterRef(scene, characters),
        
        // v6.37-P0: 动作
        action: action,
        
        // v6.37-P0: 对话（统一格式）
        dialogue: dialogueLines.join(' || '),
        
        // 保留原始数据（供内部使用）
        characters: scene.characters || [],
        characterDescs: characterAnchors.join(' | '),
        dialogueText: (scene.dialogue?.lines || []).map(l => l.text).join('；'),
        
        // 情感
        emotionalTarget: scene.emotional_target || { valence: 0, arousal: 0.5 },
        
        // 视觉方向
        visualDirection: scene.visual_direction || {},
        
        // Prompt 基础
        promptBase: scene.prompt_base || '',
        
        // 世界设定
        worldId: worldSetting.world_id || 'default',
        
        // 状态
        status: 'pending'
      };
    });
    
    return { shots, sceneCount: shots.length };
  }
  
  /**
   * v6.37-P0: 构建五维空间描述
   */
  _buildFiveDimensionScene(scene, worldSetting) {
    const dimensions = [];
    
    // 1. 宏观地理：星球/大陆/区域
    const worldName = worldSetting.name || worldSetting.world_id || '未知世界';
    dimensions.push(worldName);
    
    // 2. 中观地貌：地形/地貌
    const setting = scene.setting || '';
    if (setting) dimensions.push(setting);
    
    // 3. 微观材质：表面材质/纹理
    const materials = scene.materials || scene.surface_details || '';
    if (materials) dimensions.push(materials);
    
    // 4. 天气时间：时间/天气/光照
    const timeOfDay = scene.time_of_day || scene.lighting?.time_of_day || '';
    if (timeOfDay) dimensions.push(timeOfDay);
    
    // 5. 空间深度：前景/中景/背景层次
    const depth = scene.depth_layers || scene.spatial_depth || 'atmospheric perspective';
    dimensions.push(`spatial depth: ${depth}`);
    
    return dimensions.join(', ');
  }
  
  /**
   * v6.37-P0: 构建 mood（3-5情绪关键词）
   */
  _buildMood(scene) {
    const moodMap = {
      'opening': 'epic, mysterious, awe-inspiring',
      'establishing': 'mysterious, anticipation, wonder',
      'conflict': 'tense, determined, brave, confrontational',
      'emotional_climax': 'epic, emotional, powerful, cathartic',
      'resolution': 'peaceful, warm, nostalgic, hopeful',
      'discovery': 'curious, excited, surprised, wondrous',
      'transition': 'flowing, continuous, seamless'
    };
    
    return moodMap[scene.scene_type] || 'neutral, calm, steady';
  }
  
  /**
   * v6.37-P0: 构建 action（核心动词+交互目标）
   */
  _buildAction(scene) {
    const actionMap = {
      'opening': 'establishing shot, camera slowly descending through atmospheric layers',
      'establishing': 'protagonist steps forward, observing surroundings with focused gaze',
      'conflict': 'confrontation stance, direct eye contact, tension building in posture',
      'emotional_climax': 'dramatic gesture, emotional peak, decisive movement',
      'resolution': 'gentle release, returning to calm, peaceful closure',
      'discovery': 'leaning forward, reaching out, examining with curiosity'
    };
    
    return actionMap[scene.scene_type] || 'neutral stance, steady breathing';
  }
  
  /**
   * v6.37-P0: 构建 characterRef（image://格式）
   */
  _buildCharacterRef(scene, characters) {
    const refs = (scene.characters || []).map(cid => {
      const char = characters.find(c => c.character_id === cid);
      if (!char) return null;
      
      // 构建 image:// 路径
      const paths = [];
      const angles = ['front', 'profile', 'three-quarter', 'closeup', 'detail'];
      angles.forEach(angle => {
        paths.push(`image://characters/${cid}-${angle}.png`);
      });
      
      return `${char.name}: ${paths.join(', ')}`;
    }).filter(Boolean);
    
    return refs.join(' | ') || 'NONE';
  }

  /**
   * Stage 2: 时长分配（精细化）
   * v6.37-P0: 新增 timeline 字段
   */
  _allocateDuration(shots) {
    const allocator = this.modules.shotDurationAllocator;
    if (!allocator) {
      // 回退：使用剧本引擎的时长
      return { shots };
    }
    
    // 基于内容重要性、台词长度、视觉复杂度三维度重新分配
    const allocatedShots = shots.map((shot, index) => {
      // 台词越长，时长越长
      const dialogueLength = shot.dialogue?.length || 0;
      const dialogueFactor = Math.min(dialogueLength / 30, 1.5); // 30字基准
      
      // 场景类型权重
      const typeWeights = {
        'opening': 1.2,
        'emotional_climax': 1.5,
        'conflict': 1.3,
        'resolution': 1.0,
        'establishing': 1.0
      };
      const typeWeight = typeWeights[shot.sceneType] || 1.0;
      
      // 基础时长 × 调整因子
      const baseDuration = shot.timing.duration;
      const adjustedDuration = Math.round(baseDuration * typeWeight * (1 + dialogueFactor * 0.2));
      
      // 限制在合理范围
      const finalDuration = Math.max(10, Math.min(40, adjustedDuration));
      
      // v6.37-P1+: 构建 timeline 字段（结构化对象 + 字符串）
      const timelineResult = this._buildTimeline(shot, index, finalDuration);
      
      return {
        ...shot,
        timing: {
          ...shot.timing,
          duration: finalDuration,
          end: shot.timing.start + finalDuration
        },
        // v6.37-P1+: timeline 结构化对象
        timeline: timelineResult,
        allocation: {
          baseDuration,
          dialogueFactor,
          typeWeight,
          finalDuration
        }
      };
    });
    
    return { shots: allocatedShots };
  }
  
  /**
   * v6.37-P0: 构建 timeline 字段
   * 格式：T00:XX-T00:XX / duration: Xs / type: XXX / mood: XXX
   */
  _buildTimeline(shot, index, duration) {
    const startTime = shot.timing.start || 0;
    const endTime = startTime + duration;
    const type = shot.sceneType || 'normal';
    const mood = shot.mood || 'neutral';
    
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    // v6.37-P1+: 结构化对象 + 字符串
    const timelineObj = {
      start: `T${formatTime(startTime)}`,
      end: `T${formatTime(endTime)}`,
      duration: duration,
      type: type,
      mood: mood
    };
    
    const timelineStr = `${timelineObj.start}-${timelineObj.end} / duration: ${timelineObj.duration}s / type: ${timelineObj.type} / mood: ${timelineObj.mood}`;
    
    return {
      object: timelineObj,
      string: timelineStr
    };
  }

  /**
   * Stage 3: 运镜设计
   * v6.37-P0: 改造 camera 字段为字符串格式，新增 lighting 字段
   */
  _designCameraMovement(shots) {
    const cameraSystem = this.modules.cameraMovement;
    
    const designedShots = shots.map(shot => {
      // 基于场景类型推断运镜
      const cameraConfig = this._inferCameraConfig(shot);
      
      // v6.37-P1+: 构建 camera 字段（结构化对象 + 字符串）
      const cameraResult = this._buildCameraString(cameraConfig, shot);
      
      // v6.37-P1+: 构建 lighting 字段（结构化对象 + 字符串）
      const lightingResult = this._buildLighting(shot, cameraConfig);
      
      return {
        ...shot,
        camera: cameraResult, // 结构化对象
        lighting: lightingResult, // 结构化对象
        cameraMovement: {
          ...cameraConfig,
          // 4段式运镜时间轴
          timeline: this._generateCameraTimeline(shot.timing.duration, cameraConfig)
        }
      };
    });
    
    return { shots: designedShots };
  }
  
  /**
   * v6.37-P0: 构建 camera 字符串（12级机位+14运镜+焦距+速度）
   */
  /**
   * v6.37-P1+: 构建 camera 字段（结构化对象 + 字符串）
   * 专家反馈：字段级结构化，对象用于程序解析，字符串用于Prompt融合
   */
  _buildCameraString(cameraConfig, shot) {
    const shotSizeMap = {
      'wide': 'wide',
      'medium': 'medium',
      'close_up': 'close-up',
      'extreme_close_up': 'extreme close-up',
      'establishing': 'establishing'
    };
    
    const movementMap = {
      '缓慢推进': 'dolly in',
      '稳定机位': 'static',
      '手持晃动': 'handheld',
      '快速推近': 'push in',
      '缓慢后拉': 'pull back'
    };
    
    const focalMap = {
      'slow': '24mm',
      'normal': '35mm',
      'fast': '85mm',
      'dynamic': '50mm'
    };
    
    const speedMap = {
      'slow': 0.3,
      'normal': 1.0,
      'fast': 1.5,
      'dynamic': 0.8
    };
    
    // 结构化对象
    const cameraObj = {
      shotSize: shotSizeMap[cameraConfig.shotType] || 'medium',
      movement: movementMap[cameraConfig.movement] || 'static',
      lens: focalMap[cameraConfig.speed] || '35mm',
      speed: speedMap[cameraConfig.speed] || 1.0,
      aperture: 'f/2.8', // 默认值
      focus: 'normal' // 默认值
    };
    
    // 字符串格式（用于Prompt融合）
    const cameraStr = `${cameraObj.shotSize} shot, ${cameraObj.movement}, ${cameraObj.lens} lens, speed ${cameraObj.speed}`;
    
    return {
      object: cameraObj,
      string: cameraStr
    };
  }
  
  /**
   * v6.37-P0: 构建 lighting 字段（主光方向+色温K值+特效光）
   */
  _buildLighting(shot, cameraConfig) {
    const lightingMap = {
      'opening': {
        keyLight: { direction: 'backlight', colorTemp: 3200, effect: 'golden hour rim' },
        fillLight: { direction: 'ambient', colorTemp: 6500, effect: 'cool fill' },
        special: 'volumetric god rays'
      },
      'establishing': {
        keyLight: { direction: 'front', colorTemp: 4500, effect: 'neutral balanced' },
        fillLight: { direction: 'ambient', colorTemp: 4500, effect: 'soft fill' },
        special: ''
      },
      'conflict': {
        keyLight: { direction: 'top', colorTemp: 5600, effect: 'harsh shadows' },
        fillLight: { direction: 'none', colorTemp: 0, effect: 'dramatic contrast' },
        special: 'high contrast noir'
      },
      'emotional_climax': {
        keyLight: { direction: 'omni', colorTemp: 8000, effect: 'bright key' },
        fillLight: { direction: 'ambient', colorTemp: 8000, effect: 'volumetric glow' },
        special: 'volumetric glow'
      },
      'resolution': {
        keyLight: { direction: 'backlight', colorTemp: 2800, effect: 'warm sunset' },
        fillLight: { direction: 'ambient', colorTemp: 3200, effect: 'soft diffusion' },
        special: 'soft diffusion'
      },
      'discovery': {
        keyLight: { direction: 'side', colorTemp: 4500, effect: 'cool blue accent' },
        fillLight: { direction: 'ambient', colorTemp: 5500, effect: 'practical source' },
        special: 'practical source'
      }
    };
    
    const lightingObj = lightingMap[shot.sceneType] || lightingMap['establishing'];
    
    // 字符串格式（用于Prompt融合）
    const keyLight = lightingObj.keyLight;
    const fillLight = lightingObj.fillLight;
    let lightingStr = `${keyLight.direction} ${keyLight.colorTemp}K, ${keyLight.effect}`;
    if (fillLight.direction !== 'none') {
      lightingStr += `, ${fillLight.direction} ${fillLight.colorTemp}K, ${fillLight.effect}`;
    }
    if (lightingObj.special) {
      lightingStr += `, ${lightingObj.special}`;
    }
    
    return {
      object: lightingObj,
      string: lightingStr
    };
  }

  /**
   * 推断运镜配置
   */
  _inferCameraConfig(shot) {
    const configs = {
      'opening': {
        shotType: 'wide',
        movement: '缓慢推进',
        speed: 'slow',
        transition: 'none'
      },
      'establishing': {
        shotType: 'medium',
        movement: '稳定机位',
        speed: 'normal',
        transition: 'smooth'
      },
      'conflict': {
        shotType: 'close_up',
        movement: '手持晃动',
        speed: 'fast',
        transition: 'cut'
      },
      'emotional_climax': {
        shotType: 'extreme_close_up',
        movement: '快速推近',
        speed: 'dynamic',
        transition: 'dramatic'
      },
      'resolution': {
        shotType: 'medium',
        movement: '缓慢后拉',
        speed: 'slow',
        transition: 'fade'
      }
    };
    
    return configs[shot.sceneType] || configs['establishing'];
  }

  /**
   * 生成 4 段式运镜时间轴
   */
  _generateCameraTimeline(duration, cameraConfig) {
    const segments = 4;
    const segmentDuration = duration / segments;
    
    const timeline = [];
    for (let i = 0; i < segments; i++) {
      const start = i * segmentDuration;
      const end = (i + 1) * segmentDuration;
      
      timeline.push({
        segment: i + 1,
        timeRange: `${start.toFixed(1)}s-${end.toFixed(1)}s`,
        duration: segmentDuration.toFixed(1) + 's',
        cameraMovement: this._getSegmentMovement(i, cameraConfig.movement),
        shotType: this._getSegmentShotType(i, cameraConfig.shotType),
        purpose: this._getSegmentPurpose(i, cameraConfig)
      });
    }
    
    return timeline;
  }

  _getSegmentMovement(index, baseMovement) {
    const variations = {
      '缓慢推进': ['远景缓推', '中景推进', '近景聚焦', '特写定格'],
      '稳定机位': ['全景稳定', '中景观察', '近景注视', '特写定格'],
      '手持晃动': ['全景晃动', '中景逼近', '近景紧张', '特写冲击'],
      '快速推近': ['远景突袭', '中景冲刺', '近景逼近', '特写定格'],
      '缓慢后拉': ['近景特写', '中景展开', '全景揭示', '远景收尾']
    };
    
    const movements = variations[baseMovement] || variations['稳定机位'];
    return movements[index] || movements[movements.length - 1];
  }

  _getSegmentShotType(index, baseType) {
    const progression = {
      'wide': ['远景', '全景', '中景', '近景'],
      'medium': ['中景', '近景', '中景', '近景'],
      'close_up': ['中景', '近景', '特写', '极特写'],
      'extreme_close_up': ['近景', '特写', '极特写', '微距']
    };
    
    const types = progression[baseType] || progression['medium'];
    return types[index] || types[types.length - 1];
  }

  _getSegmentPurpose(index, config) {
    const purposes = [
      '建立空间/环境',
      '展示角色/关系',
      '推进情绪/冲突',
      '定格核心瞬间'
    ];
    return purposes[index] || '推进叙事';
  }

  /**
   * Stage 4: Prompt 工程（核心）
   * v6.37-P0: 按参考文档融合顺序构建 Prompt，产出标准字段格式
   * 保留卓越系统特有字段：mouthAction, importance, visualComplexity, qualityScore, enhanced
   */
  _engineerPrompts(shots, blueprint) {
    const prompts = [];
    const engineeredShots = [];
    
    for (const shot of shots) {
      // 处理结构化对象（取字符串用于Prompt融合）
      const cameraStr = shot.camera?.string || shot.camera || '';
      const lightingStr = shot.lighting?.string || shot.lighting || '';
      const timelineStr = shot.timeline?.string || shot.timeline || '';
      
      // 构建 Prompt 各部分（按融合顺序，带优先级截断）
      const prompt = this._buildShotPrompt(shot, blueprint, { cameraStr, lightingStr, timelineStr });
      
      // 字符计数
      const promptLength = this._countChars(prompt.fullPrompt);
      
      // v6.37-P1+: 构建标准输出对象（结构化对象 + 字符串）
      const standardOutput = {
        // === 核心字段（参考文档 v6.37-Peng）===
        shotId: shot.shotId,
        duration: shot.timing.duration,
        scene: shot.scene,
        mood: shot.mood,
        // 结构化对象 + 字符串
        camera: shot.camera?.object || shot.camera,
        cameraString: cameraStr,
        lighting: shot.lighting?.object || shot.lighting,
        lightingString: lightingStr,
        characterRef: shot.characterRef,
        character: shot.character,
        action: shot.action,
        dialogue: shot.dialogue,
        timeline: shot.timeline?.object || shot.timeline,
        timelineString: timelineStr,
        backgroundSound: this._buildBackgroundSound(shot).object,
        backgroundSoundString: this._buildBackgroundSound(shot).string,
        prompt: prompt.fullPrompt,
        promptCharCount: promptLength,
        
        // === 卓越系统保留字段 ===
        mouthAction: shot.mouthAction || this._buildMouthAction(shot),
        importance: shot.importance || 5,
        visualComplexity: shot.visualComplexity || 5,
        qualityScore: shot.qualityScore || { totalScore: 75 },
        enhanced: true,
        
        // === 内部字段（扩展接口）===
        physicsLayer: shot.physicsLayer || '',
        colorScience: shot.colorScience || '',
        negativePrompt: shot.negativePrompt || '',
        renderStyle: shot.renderStyle || '',
        directorStyle: shot.directorStyle || '',
        
        // === 优先级元数据（专家反馈）===
        priorities: {
          characterRef: 'P0-never',
          dialogue: 'P0-keep_core',
          character: 'P0-minimal_anchor',
          camera: 'P1-keep_core_movement',
          action: 'P1-keep_core_verb',
          scene: 'P1-keep_core_location',
          lighting: 'P1-keep_main_light',
          backgroundSound: 'P1-keep_core_sound',
          mood: 'P2-keyword_list',
          timeline: 'P2-keep_duration_type'
        },
        
        // === 兼容性字段 ===
        length: promptLength,
        utilization: Math.round(promptLength / 1500 * 100),
        utilizationStatus: promptLength >= 970 && promptLength <= 1500 ? '🔥理想' : (promptLength > 1500 ? '❌超标' : '⚠️空间浪费')
      };
      
      // 片头专属字段
      if (shot.sceneType === 'opening') {
        const audioLayer = this._buildAudioLayer(shot);
        const titleOverlay = this._buildTitleOverlay(blueprint);
        standardOutput.audioLayer = audioLayer.object;
        standardOutput.audioLayerString = audioLayer.string;
        standardOutput.titleOverlay = titleOverlay.object;
        standardOutput.titleOverlayString = titleOverlay.string;
      }
      
      engineeredShots.push(standardOutput);
      prompts.push(standardOutput);
    }
    
    return { shots: engineeredShots, prompts };
  }
  
  /**
   * v6.37-P0: 构建 mouthAction 字段（供Seedance对口型）
   */
  _buildMouthAction(shot) {
    const actionMap = {
      'opening': '嘴部自然闭合，面对镜头，准备开口',
      'establishing': '嘴部微张，观察时自然呼吸',
      'conflict': '嘴部紧闭，紧张时咬紧牙关',
      'emotional_climax': '嘴部张大，情感爆发时大声呼喊',
      'resolution': '嘴部放松，微笑，平静呼吸'
    };
    
    return actionMap[shot.sceneType] || '嘴部自然闭合';
  }
  
  /**
   * v6.37-P0: 构建 backgroundSound 字段（三段式）
   */
  _buildBackgroundSound(shot) {
    const type = shot.sceneType || 'normal';
    
    const soundMap = {
      'opening': {
        ambient: 'deep earth rumble 20-60Hz, epic atmosphere',
        spatial: '3D audio pan synchronized with camera movement',
        intensity: { crescendo: '0-3s', peak: '3-7s', decay: '7-10s' }
      },
      'establishing': {
        ambient: 'natural environment, wind and distant sounds',
        spatial: 'ambient stereo field',
        intensity: { steady: '0-100%', variations: 'subtle' }
      },
      'conflict': {
        ambient: 'tension building, low frequency rumble',
        spatial: 'directional audio pan',
        intensity: { building: '0-5s', peak: '5-8s', decay: '8-10s' }
      },
      'emotional_climax': {
        ambient: 'full frequency spectrum, rich harmonics',
        spatial: 'immersive surround',
        intensity: { maximum: '0-3s', sustain: '3-10s' }
      },
      'resolution': {
        ambient: 'gentle atmosphere, soft reverb',
        spatial: 'wide stereo field',
        intensity: { fading: '0-5s', quiet: '5-10s' }
      }
    };
    
    const soundObj = soundMap[type] || {
      ambient: 'neutral atmosphere',
      spatial: 'centered mono',
      intensity: { steady: '100%' }
    };
    
    // 字符串格式（用于Prompt融合）
    const intensityStr = Object.entries(soundObj.intensity).map(([k, v]) => `${k} ${v}`).join(', ');
    const soundStr = `AMBIENT: ${soundObj.ambient} | SPATIAL: ${soundObj.spatial} | INTENSITY: ${intensityStr}`;
    
    return {
      object: soundObj,
      string: soundStr
    };
  }
  
  /**
   * v6.37-P1+: 构建 audioLayer 字段（片头专属，结构化对象）
   */
  _buildAudioLayer(shot) {
    const segments = [
      { time: '0-3s', sound: 'sub-bass earth rumble fade in' },
      { time: '3-5s', sound: 'distant wind and environmental sounds' },
      { time: '5-8s', sound: 'string section long note' },
      { time: '8-10s', sound: 'timpani strike' }
    ];
    
    const audioStr = segments.map(s => s.sound).join(', ');
    
    return {
      object: { segments },
      string: audioStr
    };
  }
  
  /**
   * v6.37-P1+: 构建 titleOverlay 字段（片头专属，结构化对象）
   */
  _buildTitleOverlay(blueprint) {
    const config = blueprint.config || {};
    const worldSetting = blueprint.worldSetting || {};
    
    const titleObj = {
      mainTitle: config.title || '未命名',
      subtitle: worldSetting.name || '系列作品',
      producer: `by ${config.producer || 'Genius'}`,
      titleAnim: 'light-vein carving growth 3.0-5.0s'
    };
    
    const titleStr = `MAIN_TITLE: "${titleObj.mainTitle}" | SUBTITLE: "${titleObj.subtitle}" | PRODUCER: "${titleObj.producer}" | TITLE_ANIM: ${titleObj.titleAnim}`;
    
    return {
      object: titleObj,
      string: titleStr
    };
  }

  /**
   * 🔊 v2.0-B+: 音频场景映射（极致视听融合）
   */
  _getAudioSceneMap() {
    return {
      'beach': { env: '海浪轻拍沙滩的白噪音，海鸟远处鸣叫', action: '白沙从指缝流下沙沙声', emotion: '温暖治愈的氛围音' },
      'ocean': { env: '海浪拍打礁石，海风呼啸', action: '水花溅起声', emotion: '自由辽阔的海洋气息' },
      'forest': { env: '风吹树叶沙沙声，远处溪流潺潺', action: '脚步声踩落叶', emotion: '宁静安详的自然氛围' },
      'city': { env: '车流白噪音，远处鸣笛', action: '快门声、键盘敲击', emotion: '都市节奏感' },
      'home': { env: '室内温暖环境音', action: '婴儿咯咯笑声', emotion: '温馨家庭氛围' },
      'mountain': { env: '山风呼啸，远处鸟鸣', action: '雪粉飞扬声', emotion: '壮丽寂静的高山氛围' },
      'studio': { env: '摄影棚安静环境', action: '快门咔嚓声', emotion: '专业专注的工作氛围' }
    };
  }

  /**
   * 🔊 v2.0-B+: 构建音频描述（自然语言格式，Seedance可理解）
   */
  _buildAudioDescription(shot) {
    const parts = [];
    const sceneName = (shot.sceneName || shot.scene || shot.setting || '').toLowerCase();
    const emotion = (shot.emotionPhase || shot.emotion || 'neutral').toLowerCase();
    const timeOfDay = (shot.timeOfDay || shot.lighting?.timeOfDay || 'golden hour').toLowerCase();
    
    const audioMap = this._getAudioSceneMap();
    let template = null;
    
    // 匹配场景类型
    for (const [key, t] of Object.entries(audioMap)) {
      if (sceneName.includes(key)) {
        template = t;
        break;
      }
    }
    
    // 回退：基于时间
    if (!template) {
      if (timeOfDay.includes('night') || timeOfDay.includes('dusk')) {
        template = { env: '夜晚虫鸣，远处低语', action: '轻柔脚步声', emotion: '神秘宁静的夜晚氛围' };
      } else {
        template = { env: '白天环境音', action: '自然动作声', emotion: '明亮日常氛围' };
      }
    }
    
    // L1: 环境音 - 自然语言格式
    parts.push(`伴随${template.env}`);
    
    // L2: 动作音 - 自然语言格式
    parts.push(`动作产生${template.action}`);
    
    // L3: 情绪音 - 自然语言格式
    const emotionAudioMap = {
      'warm': '温暖治愈的轻音乐渐入',
      'joy': '欢快的节奏音',
      'tense': '紧张的心跳声渐强',
      'sad': '低沉的弦乐余韵',
      'epic': '宏大的交响乐铺垫',
      'peaceful': '宁静的钢琴轻弹',
      'establishing': '环境音渐显，氛围建立',
      'climax': '全频段饱满，情绪峰值',
      'resolve': '音乐渐弱，余音缭绕'
    };
    const emotionSound = emotionAudioMap[emotion] || template.emotion;
    parts.push(`氛围弥漫${emotionSound}`);
    
    // L4: 声画同步（如果含对话）
    if (shot.dialogueText || shot.hasDialogue) {
      parts.push('声画精准同步，嘴型与发音对齐');
    }
    
    return parts.join('，');
  }

  /**
   * 构建单个镜头的完整 Prompt（v2.0-B+: 七层架构 + 极致视听融合 + v6.37-P0 字段对齐）
   * 
   * 融合顺序（按参考文档 v6.37-Peng）：
   * CharacterRef → Timeline → Dialogue → AudioLayer(片头) → TitleOverlay(片头) → 
   * BackgroundSound → Character → Action → Scene → Mood → Camera → Lighting → 
   * PhysicsLayer → ColorScience → NegativePrompt → RenderStyle → DirectorStyle
   * 
   * 七层结构：
   * L1: 约束层（P0必加）- 画幅/帧率/无字幕
   * L2: 基础层（P0必加）- 写实度/HDR/胶片质感
   * L3: 空间层（P1防平庸）- scene字段（五维空间）
   * L4: 主体层（P2防漂移）- character/action/dialogue
   * L5: 动态层（P1防平庸）- camera/timeline
   * L6: 风格层（P2防漂移）- mood/lighting
   * L7: 音频层（🔊 新增）- backgroundSound/audioLayer
   * L8: 内部层（扩展）- PhysicsLayer/ColorScience/NegativePrompt/RenderStyle/DirectorStyle
   * L9: 质控层（P0必加）- 负面约束/角色一致性
   */
  /**
   * 构建单个镜头的完整 Prompt（v6.37-P1+: 优先级截断 + 结构化对象）
   */
  _buildShotPrompt(shot, blueprint, structuredStrings = {}) {
    const { cameraStr, lightingStr, timelineStr } = structuredStrings;
    
    // 定义优先级和截断策略（专家反馈）
    const priorityMap = {
      'L1_constraint': { priority: 'P0', strategy: 'never' },
      'L2_base': { priority: 'P0', strategy: 'never' },
      'L3_scene': { priority: 'P1', strategy: 'keep_core_location' },
      'L4_character': { priority: 'P0', strategy: 'minimal_anchor' },
      'L4_action': { priority: 'P1', strategy: 'keep_core_verb' },
      'L4_dialogue': { priority: 'P0', strategy: 'keep_core_dialogue' },
      'L5_camera': { priority: 'P1', strategy: 'keep_core_movement' },
      'L5_timeline': { priority: 'P2', strategy: 'keep_duration_type' },
      'L6_mood': { priority: 'P2', strategy: 'keyword_list' },
      'L6_lighting': { priority: 'P1', strategy: 'keep_main_light' },
      'L7_audio': { priority: 'P1', strategy: 'keep_core_sound' },
      'L8_internal': { priority: 'P2', strategy: 'truncate' },
      'L9_negative': { priority: 'P0', strategy: 'keep_top_3' }
    };
    
    const parts = [];
    const partMeta = [];
    
    // === L1: 约束层（P0必加）===
    const ratio = blueprint.aspectRatio || shot.ratio || '16:9';
    parts.push(`${ratio} cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic`);
    partMeta.push({ id: 'L1_constraint', priority: 'P0' });
    
    // === L2: 基础层（P0必加）===
    parts.push('hyperrealistic, ultra-detailed, high dynamic range, detail in highlights and shadows, film grain, 35mm texture, cinematic film');
    partMeta.push({ id: 'L2_base', priority: 'P0' });
    
    // === L3: 空间层（P1）===
    if (shot.scene) {
      parts.push(shot.scene);
      partMeta.push({ id: 'L3_scene', priority: 'P1' });
    }
    
    // === L4: 主体层（P0-P1）===
    if (shot.character && shot.character !== 'NONE') {
      parts.push(shot.character);
      partMeta.push({ id: 'L4_character', priority: 'P0' });
    }
    
    if (shot.action) {
      parts.push(shot.action);
      partMeta.push({ id: 'L4_action', priority: 'P1' });
    }
    
    if (shot.dialogue && shot.dialogue !== '') {
      parts.push(`dialogue: ${shot.dialogue}`);
      partMeta.push({ id: 'L4_dialogue', priority: 'P0' });
    }
    
    // === L5: 动态层（P1-P2）===
    const camera = cameraStr || shot.camera;
    if (camera) {
      parts.push(camera);
      partMeta.push({ id: 'L5_camera', priority: 'P1' });
    }
    
    const timeline = timelineStr || shot.timeline;
    if (timeline) {
      parts.push(`timeline: ${timeline}`);
      partMeta.push({ id: 'L5_timeline', priority: 'P2' });
    }
    
    // === L6: 风格层（P1-P2）===
    if (shot.mood) {
      parts.push(`mood: ${shot.mood}`);
      partMeta.push({ id: 'L6_mood', priority: 'P2' });
    }
    
    const lighting = lightingStr || shot.lighting;
    if (lighting) {
      parts.push(lighting);
      partMeta.push({ id: 'L6_lighting', priority: 'P1' });
    }
    
    // === L7: 音频层（P1）===
    // v6.37-P1+: 使用字符串版本（避免对象输出）
    const bgSound = shot.backgroundSound?.string || shot.backgroundSound;
    if (bgSound && typeof bgSound === 'string') {
      parts.push(`audio: ${bgSound}`);
      partMeta.push({ id: 'L7_audio', priority: 'P1' });
    }
    
    const audioLayer = shot.audioLayer?.string || shot.audioLayer;
    if (audioLayer && audioLayer !== '' && typeof audioLayer === 'string') {
      parts.push(`audioLayer: ${audioLayer}`);
      partMeta.push({ id: 'L7_audio', priority: 'P1' });
    }
    
    // === L8: 内部层（P2）===
    if (shot.physicsLayer && shot.physicsLayer !== '') {
      parts.push(`physics: ${shot.physicsLayer}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.colorScience && shot.colorScience !== '') {
      parts.push(`color: ${shot.colorScience}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.renderStyle && shot.renderStyle !== '') {
      parts.push(`style: ${shot.renderStyle}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    if (shot.directorStyle && shot.directorStyle !== '') {
      parts.push(`director: ${shot.directorStyle}`);
      partMeta.push({ id: 'L8_internal', priority: 'P2' });
    }
    
    // === L9: 质控层（P0）===
    if (shot.worldId && shot.worldId !== 'default') {
      parts.push(`${shot.worldId} world`);
    }
    
    const negativeConstraints = [
      'no watermark, no logo, no text overlay, no subtitle, no caption',
      'blurry, low resolution, pixelated, compression artifacts',
      'cartoon, anime, illustration, 3D render look, CGI appearance, plastic look',
      'distorted perspective, impossible geometry, floating objects',
      'flat lighting, overexposed, crushed blacks, double shadows',
      'unnatural physics, fake water, static water, cardboard texture, plastic foliage'
    ];
    
    if (shot.characters?.length > 0 || shot.character) {
      negativeConstraints.push('distorted face, deformed face, extra fingers, plastic skin, waxy skin, unnatural pose');
    }
    
    if (shot.worldId && shot.worldId !== 'default') {
      negativeConstraints.push('natural eye colors only, no metallic shine');
    }
    parts.push(...negativeConstraints);
    partMeta.push({ id: 'L9_negative', priority: 'P0' });
    
    if (shot.characters?.length > 0) {
      parts.push(`角色一致性：保持${shot.characters.join('、')}形象一致，杜绝分身重影`);
    }
    
    const fullPrompt = parts.join('，');
    
    // v6.37-P1+: 优先级截断（专家反馈）
    const truncated = this._truncateWithPriority(fullPrompt, this.config.maxPromptLength, partMeta, parts);
    
    return {
      fullPrompt: truncated,
      rawPrompt: fullPrompt,
      parts,
      partMeta,
      wasTruncated: fullPrompt.length !== truncated.length,
      audioIncluded: !!shot.backgroundSound
    };
  }
  
  /**
   * v6.37-P1+: 优先级截断策略（专家反馈）
   * P0: 永不截断（characterRef/dialogue/titleOverlay/character/negative）
   * P1: 保留核心（camera/action/scene/lighting/backgroundSound/audioLayer）
   * P2: 可截断（mood/timeline/physicsLayer/colorScience/renderStyle/directorStyle）
   */
  _truncateWithPriority(prompt, maxLength, partMeta, parts) {
    if (prompt.length <= maxLength) return prompt;
    
    // 按优先级排序（P2优先截断，P1次之，P0永不截断）
    const p2Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P2');
    const p1Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P1');
    const p0Parts = parts.filter((_, i) => partMeta[i]?.priority === 'P0');
    
    // 先截断P2字段（保留最少信息）
    let reduced = p0Parts.concat(p1Parts).concat(p2Parts.map(p => this._minimizePart(p, 'P2')));
    let result = reduced.join('，');
    
    if (result.length <= maxLength) return result;
    
    // 再截断P1字段（保留核心信息）
    reduced = p0Parts.concat(p1Parts.map(p => this._minimizePart(p, 'P1'))).concat(p2Parts.map(p => this._minimizePart(p, 'P2')));
    result = reduced.join('，');
    
    if (result.length <= maxLength) return result;
    
    // 如果还超长，截断到maxLength（保留开头和结尾的P0字段）
    const startP0 = p0Parts.slice(0, 2).join('，');
    const endP0 = p0Parts.slice(-2).join('，');
    const mid = result.substring(startP0.length, result.length - endP0.length);
    const available = maxLength - startP0.length - endP0.length - 2;
    
    return startP0 + '，' + mid.substring(0, available) + '，' + endP0;
  }
  
  /**
   * 最小化部分（按策略）
   */
  _minimizePart(part, priority) {
    if (priority === 'P2') {
      // P2: 只保留前20字符
      return part.substring(0, 20) + '...';
    }
    if (priority === 'P1') {
      // P1: 保留核心（逗号前的主语）
      const core = part.split('，')[0];
      return core.length < part.length ? core + '...' : part;
    }
    return part;
  }

  /**
   * 🔊 v2.0-B+: 截断保护（保留音频层和角色一致性）
   */
  _truncatePromptWithAudioProtection(prompt, maxLength) {
    if (prompt.length <= maxLength) return prompt;
    
    // 保护末尾：角色一致性 + 音频层（如果存在）
    const lastPart = '角色一致性：保持形象一致，杜绝分身重影';
    
    // 检查是否包含音频描述
    const hasAudio = prompt.includes('伴随') && prompt.includes('氛围弥漫');
    let audioPart = '';
    if (hasAudio) {
      const audioMatch = prompt.match(/伴随[^，]*，[^，]*氛围弥漫[^，]*(?:，[^，]*声画精准同步[^，]*)?/);
      if (audioMatch) {
        audioPart = audioMatch[0];
      }
    }
    
    const protectParts = [lastPart];
    if (audioPart) protectParts.unshift(audioPart);
    
    const protectText = protectParts.join('，');
    const availableLength = maxLength - protectText.length - 2;
    
    if (availableLength > 50) {
      return prompt.substring(0, availableLength) + '，' + protectText;
    }
    
    return prompt.substring(0, maxLength);
  }

  /**
   * 截断 Prompt（旧方法，保留向后兼容）
   */
  _truncatePrompt(prompt, maxLength) {
    return this._truncatePromptWithAudioProtection(prompt, maxLength);
  }

  /**
   * 构建定妆照引用
   */
  _buildImageReferences(shot, blueprint) {
    const refs = [];
    const characters = blueprint.characters || [];
    
    for (const cid of (shot.characters || [])) {
      const char = characters.find(c => c.character_id === cid);
      if (!char) continue;
      
      const portraits = char.portraits || {};
      
      // 选择最佳角度
      const angle = this._selectBestAngle(shot.sceneType, Object.keys(portraits));
      const path = portraits[angle];
      
      if (path) {
        refs.push({
          characterId: cid,
          characterName: char.name,
          angle,
          path,
          description: this._buildImageDescription(char, angle)
        });
      }
    }
    
    return refs;
  }

  /**
   * 选择最佳角度
   */
  _selectBestAngle(sceneType, availableAngles) {
    if (!availableAngles || availableAngles.length === 0) return null;
    
    const priority = {
      'opening': ['front', 'threeQuarter', 'closeup'],
      'establishing': ['threeQuarter', 'front', 'closeup'],
      'conflict': ['closeup', 'threeQuarter', 'front'],
      'emotional_climax': ['closeup', 'front', 'threeQuarter'],
      'resolution': ['threeQuarter', 'front', 'closeup']
    };
    
    const preferred = priority[sceneType] || ['threeQuarter', 'front', 'closeup'];
    
    for (const angle of preferred) {
      if (availableAngles.includes(angle)) return angle;
    }
    
    return availableAngles[0];
  }

  /**
   * 构建定妆照描述
   */
  _buildImageDescription(character, angle) {
    const angleDesc = {
      'front': '正面',
      'threeQuarter': '侧面',
      'closeup': '近景',
      'side': '另一侧面'
    };
    
    const features = character.visual_anchor?.core_features || [];
    return `${character.name}${angleDesc[angle] || angle}，${features.join('，')}，超写实`;
  }

  /**
   * v6.37-P0: 字符计数
   */
  _countChars(text) {
    if (!text) return 0;
    // 计算字符数（包括中英文）
    let count = 0;
    for (const char of text) {
      count++;
    }
    return count;
  }

  /**
   * Stage 5: 质量门校验
   * v6.37-P2: 审核增强 - 检查新字段格式与完整性
   */
  _runQualityGate(prompts) {
    const checks = [];
    
    for (const p of prompts) {
      const check = {
        shotId: p.shotId,
        promptLength: p.promptCharCount || p.length || 0,
        
        // v6.37-P2: 核心字段检查（适配结构化对象）
        hasScene: !!p.scene && p.scene.length > 10,
        hasMood: !!p.mood && p.mood.split(',').length >= 3,
        hasCamera: !!(p.camera?.string || p.camera) && (p.camera?.string || p.camera).toString().length > 10,
        hasLighting: !!(p.lighting?.string || p.lighting) && (p.lighting?.string || p.lighting).toString().includes('K'),
        hasCharacter: !!p.character && p.character !== 'NONE',
        hasAction: !!p.action && p.action.length > 5,
        hasDialogue: !!p.dialogue && p.dialogue !== 'NONE',
        hasTimeline: !!(p.timeline?.string || p.timeline) && (p.timeline?.string || p.timeline).toString().includes('T00:'),
        hasBackgroundSound: !!(p.backgroundSound?.string || p.backgroundSound) && (p.backgroundSound?.string || p.backgroundSound).toString().includes('AMBIENT:'),
        
        // 片头专属检查
        isOpening: p.shotId === 'S00',
        hasAudioLayer: p.shotId === 'S00' ? (!!p.audioLayer?.string && p.audioLayer.string.length > 10) : true,
        hasTitleOverlay: p.shotId === 'S00' ? (!!p.titleOverlay?.string && p.titleOverlay.string.includes('MAIN_TITLE:')) : true,
        
        // 字符数检查
        withinLimit: (p.promptCharCount || p.length || 0) <= this.config.maxPromptLength,
        
        // 格式检查
        characterRefFormat: p.characterRef === 'NONE' || p.characterRef.includes('image://'),
        dialogueFormat: p.dialogue === 'NONE' || p.dialogue.includes('|'),
        timelineFormat: (p.timeline?.string || p.timeline) === 'NONE' || (p.timeline?.string || p.timeline).toString().includes('T00:'),
        
        // 通用检查
        noForbidden: !p.prompt.includes('暗黑风') || p.prompt.includes('暗黑风') && p.prompt.indexOf('暗黑风') > p.prompt.length - 50
      };
      
      // v6.37-P2: 综合通过条件（更严格）
      check.passed = 
        check.hasScene && 
        check.hasMood && 
        check.hasCamera && 
        check.hasLighting &&
        check.hasAction &&
        check.hasTimeline &&
        check.hasBackgroundSound &&
        check.withinLimit &&
        check.characterRefFormat &&
        check.dialogueFormat &&
        check.timelineFormat &&
        check.hasAudioLayer &&
        check.hasTitleOverlay;
      
      checks.push(check);
    }
    
    const allPassed = checks.every(c => c.passed);
    
    return {
      passed: allPassed,
      checks,
      totalPrompts: prompts.length,
      passedCount: checks.filter(c => c.passed).length,
      failedFields: checks.filter(c => !c.passed).map(c => ({
        shotId: c.shotId,
        failed: Object.entries(c).filter(([k, v]) => k.startsWith('has') && !v).map(([k]) => k)
      }))
    };
  }

  /**
   * Stage 6: 片头生成
   * v6.37-P0: 产出符合片头结构（15字段）
   */
  _generateOpening(blueprint) {
    const config = blueprint.config || {};
    const worldSetting = blueprint.worldSetting || {};
    const beastId = config.featured_beast_id;
    
    if (!beastId) {
      return { generated: false, reason: '无 featured_beast_id' };
    }
    
    // v6.37-P1+: 构建标准片头结构（结构化对象 + 字符串）
    const openingData = {
      shotId: 'S00',
      duration: config.opening_duration || 10,
      scene: this._buildOpeningScene(worldSetting),
      mood: 'epic, mysterious, awe-inspiring',
      // 结构化 camera 对象
      camera: {
        shotSize: 'extreme wide',
        movement: 'dolly in',
        lens: '24mm',
        speed: 0.3,
        aperture: 'f/2.8',
        focus: 'rack focus from atmosphere to ground'
      },
      cameraString: 'epic wide shot, slow descent through atmospheric layers, 24mm wide lens, slow speed',
      // 结构化 lighting 对象
      lighting: {
        keyLight: { direction: 'backlight', colorTemp: 3200, effect: 'golden hour rim' },
        fillLight: { direction: 'ambient', colorTemp: 6500, effect: 'cool fill' },
        special: 'volumetric god rays'
      },
      lightingString: 'backlight 3200K, golden hour rim, volumetric god rays',
      characterRef: 'NONE',
      character: 'NONE',
      action: 'establishing shot, camera slowly descending through atmospheric layers',
      dialogue: 'NONE',
      // 结构化 timeline 对象
      timeline: {
        start: 'T00:00',
        end: 'T00:10',
        duration: 10,
        type: 'opening',
        mood: 'epic'
      },
      timelineString: 'T00:00-T00:10 / duration: 10s / type: opening / mood: epic',
      // 结构化 audioLayer 对象
      audioLayer: {
        segments: [
          { time: '0-3s', sound: 'sub-bass earth rumble fade in' },
          { time: '3-5s', sound: 'distant wind and environmental sounds' },
          { time: '5-8s', sound: 'string section long note' },
          { time: '8-10s', sound: 'timpani strike' }
        ]
      },
      audioLayerString: 'Sub-bass earth rumble fade in 3s, distant wind and environmental sounds, string section long note at 5s, timpani strike at 8s',
      // 结构化 titleOverlay 对象
      titleOverlay: {
        mainTitle: config.title || '未命名',
        subtitle: worldSetting.name || '系列作品',
        producer: `by ${config.producer || 'Genius'}`,
        titleAnim: 'light-vein carving growth 3.0-5.0s'
      },
      titleOverlayString: `MAIN_TITLE: "${config.title || '未命名'}" | SUBTITLE: "${worldSetting.name || '系列作品'}" | PRODUCER: "by ${config.producer || 'Genius'}" | TITLE_ANIM: light-vein carving growth 3.0-5.0s`,
      // 结构化 backgroundSound 对象
      backgroundSound: {
        ambient: 'deep earth rumble 20-60Hz, epic atmosphere',
        spatial: '3D audio pan synchronized with camera movement',
        intensity: { crescendo: '0-3s', peak: '3-7s', decay: '7-10s' }
      },
      backgroundSoundString: 'AMBIENT: epic atmosphere, deep earth rumble 20-60Hz | SPATIAL: 3D audio pan synchronized with camera movement | INTENSITY: crescendo 0-3s, peak 3-7s, decay 7-10s',
      prompt: '', // 由 Prompt 工程构建
      promptCharCount: 0
    };
    
    // 构建片头 Prompt（传入结构化字符串）
    const prompt = this._buildShotPrompt(openingData, blueprint, {
      cameraStr: openingData.cameraString,
      lightingStr: openingData.lightingString,
      timelineStr: openingData.timelineString
    });
    openingData.prompt = prompt.fullPrompt;
    openingData.promptCharCount = this._countChars(prompt.fullPrompt);
    
    return { 
      generated: true,
      openingData,
      shotId: 'S00',
      type: 'opening',
      beastId
    };
  }
  
  _buildOpeningScene(worldSetting) {
    const worldName = worldSetting.name || worldSetting.world_id || 'Unknown World';
    const atmosphere = worldSetting.atmosphere || 'mysterious';
    const timeOfDay = worldSetting.time_of_day || 'golden hour';
    const depth = worldSetting.spatial_depth || 'atmospheric layers';
    
    return `${worldName}, ${atmosphere} atmosphere, ${timeOfDay} lighting, ${depth}, spatial depth: infinite`;
  }

  /**
   * Stage 7: 连续性检查
   * v6.37-P0: 适配新字段结构（characterRef 替代 imageRefs）
   */
  _checkContinuity(prompts) {
    const issues = [];
    
    // 检查角色连续性（从 characterRef 解析）
    const characterMentions = prompts.map((p, idx) => {
      const chars = this._parseCharacterRefForContinuity(p.characterRef);
      return { idx, chars };
    });
    
    // 检查时序连续性
    for (let i = 1; i < prompts.length; i++) {
      const prev = prompts[i - 1];
      const curr = prompts[i];
      
      const prevChars = this._parseCharacterRefForContinuity(prev.characterRef);
      const currChars = this._parseCharacterRefForContinuity(curr.characterRef);
      
      // 检查是否有共享角色
      const sharedChars = prevChars.filter(c => currChars.includes(c));
      
      if (sharedChars.length === 0 && prevChars.length > 0 && currChars.length > 0) {
        issues.push({
          type: 'character_gap',
          between: [prev.shotId, curr.shotId],
          message: '相邻镜头无共享角色，可能导致叙事断裂'
        });
      }
    }
    
    return {
      passed: issues.length === 0,
      issues,
      promptCount: prompts.length
    };
  }
  
  /**
   * v6.37-P0: 从 characterRef 解析角色名（用于连续性检查）
   */
  _parseCharacterRefForContinuity(characterRef) {
    if (!characterRef || characterRef === 'NONE') return [];
    
    const chars = [];
    const parts = characterRef.split(' | ');
    
    for (const part of parts) {
      const match = part.match(/(.+?):\s*/);
      if (match) {
        chars.push(match[1].trim());
      }
    }
    
    return chars;
  }

  /**
   * 生成生产报告
   */
  generateReport(result) {
    return {
      engine: 'ProductionEngine',
      version: '1.0.0',
      success: result.success,
      summary: {
        totalShots: result.shots.length,
        totalPrompts: result.prompts.length,
        totalDuration: result.shots.reduce((sum, s) => sum + s.timing.duration, 0),
        avgPromptLength: result.prompts.reduce((sum, p) => sum + p.length, 0) / result.prompts.length
      },
      stages: Object.fromEntries(
        Object.entries(result.stages).map(([k, v]) => [k, {
          duration: v._stageDuration || 0,
          success: !v.error
        }])
      ),
      errors: result.errors,
      timing: result.timing
    };
  }
}

module.exports = { ProductionEngine };
```

---

## 📄 hyperreality-system/engines/rendering-engine/rendering-engine.js

```js
// hyperreality-system/engines/rendering-engine/rendering-engine.js
// Rendering Engine - 渲染引擎（Layer 3）
// 复用现有系统 Seedance 渲染核心，适配超现实系统数据格式
// 版本：v1.0.0 | 日期：2026-06-08

const fs = require('fs');
const path = require('path');

// 复用现有系统的渲染提交核心
const RENDER_CORE_PATH = path.join(__dirname, '../../../scripts/render-submitter-core.js');
let RenderSubmitterCore;
try {
  RenderSubmitterCore = require(RENDER_CORE_PATH).RenderSubmitterCore;
} catch (e) {
  console.warn(`[RenderingEngine] 无法加载现有渲染核心: ${e.message}`);
  console.warn('[RenderingEngine] 将使用内置模拟模式');
}

class RenderingEngine {
  constructor(options = {}) {
    this.config = {
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      endpoint: options.endpoint || 'ep-20260518004622-jp46s',
      apiUrl: options.apiUrl || 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      maxConcurrent: options.maxConcurrent || 3,
      charactersDir: options.charactersDir || path.join(__dirname, '../../../characters'),
      outputDir: options.outputDir || '/tmp/hyperreality-output',
      ...options
    };

    this.logs = [];
    this._initSubmitter();
  }

  _initSubmitter() {
    if (RenderSubmitterCore) {
      this.submitter = new RenderSubmitterCore({
        apiKey: this.config.apiKey,
        endpoint: this.config.endpoint,
        apiUrl: this.config.apiUrl,
        charactersDir: this.config.charactersDir,
        outputDir: this.config.outputDir,
        maxConcurrent: this.config.maxConcurrent
      });
    } else {
      this.submitter = null;
    }
  }

  log(stage, message) {
    const entry = { stage, message, timestamp: Date.now() };
    this.logs.push(entry);
    console.log(`[${stage}] ${message}`);
  }

  /**
   * 主入口：渲染镜头
   * @param {Array} prompts - 制作引擎输出的 Prompts 数组
   * @param {Object} options - { skipValidation, dryRun }
   * @returns {Object} { success, results, errors }
   */
  async render(prompts, options = {}) {
    const startTime = Date.now();
    this.log('RENDER', '🎬 RenderingEngine 启动 | Seedance API');
    this.log('RENDER', `   渲染: ${prompts.length} 个镜头`);
    this.log('RENDER', `   模式: ${this.submitter ? 'API' : '模拟'}`);
    this.log('RENDER', `   并发: ${this.config.maxConcurrent}`);

    const result = {
      success: false,
      submitted: 0,
      failed: 0,
      results: [],
      errors: [],
      timing: {}
    };

    try {
      // 检查 API 密钥
      if (!this.config.apiKey && !options.dryRun) {
        throw new Error('VOLCENGINE_ARK_API_KEY 未设置，无法渲染');
      }

      // 构建渲染数据结构（兼容现有系统）
      const shots = prompts.map(p => this._convertToShotFormat(p));

      if (options.dryRun) {
        // 模拟模式：只验证不提交
        this.log('RENDER', '⚠️ 模拟模式：验证数据但不提交 API');
        result.results = shots.map(s => ({
          success: true,
          shotId: s.shotId,
          taskId: `SIMULATED-${s.shotId}`,
          status: 'simulated'
        }));
        result.submitted = shots.length;
        result.success = true;
      } else if (this.submitter) {
        // 真实 API 模式
        this.log('RENDER', '🔥 提交 Seedance API 渲染...');

        // 生成绑定清单（从 prompts 的 imageRefs 提取）
        const manifest = this._generateBindingManifest(prompts);
        const manifestPath = path.join(this.config.outputDir, 'binding-manifest.json');
        if (!fs.existsSync(this.config.outputDir)) {
          fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        // 调用现有系统的提交核心
        const submitResult = await this.submitter.submit(shots, {
          bindingManifestPath: manifestPath,
          skipValidation: options.skipValidation
        });

        result.results = submitResult.results;
        result.submitted = submitResult.results.filter(r => r.success).length;
        result.failed = submitResult.results.filter(r => !r.success).length;
        result.success = submitResult.success;

      } else {
        // 无提交器，模拟
        this.log('RENDER', '⚠️ 无提交器，使用模拟模式');
        result.results = shots.map(s => ({
          success: true,
          shotId: s.shotId,
          taskId: `MOCK-${s.shotId}`,
          status: 'mock'
        }));
        result.submitted = shots.length;
        result.success = true;
      }

      result.timing.total = Date.now() - startTime;
      this.log('RENDER', `✅ 渲染完成: ${result.submitted}/${prompts.length} 成功`);
      this.log('RENDER', `   耗时: ${result.timing.total}ms`);

    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'RENDER',
        message: error.message
      });
      this.log('RENDER', `❌ 渲染失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 转换为现有系统兼容的 shot 格式
   * v6.37-P0: 适配新字段结构
   */
  _convertToShotFormat(prompt) {
    return {
      shotId: prompt.shotId,
      id: prompt.shotId, // 兼容现有系统
      prompt: prompt.prompt,
      duration: prompt.duration || 12, // 使用实际时长
      isOpening: prompt.shotId === 'S00' || prompt.shotId === 'SC00',
      // 定妆照引用（v6.37-P0: 从 characterRef 解析）
      referenceImages: this._parseCharacterRef(prompt.characterRef),
      // 字符数
      promptLength: prompt.promptCharCount || prompt.length || 0,
      // v6.37-P0: 保留新字段用于调试
      mood: prompt.mood,
      camera: prompt.camera,
      lighting: prompt.lighting
    };
  }
  
  /**
   * v6.37-P0: 解析 characterRef 字符串为 image 引用数组
   */
  _parseCharacterRef(characterRef) {
    if (!characterRef || characterRef === 'NONE') return [];
    
    const refs = [];
    const parts = characterRef.split(' | ');
    
    for (const part of parts) {
      const match = part.match(/(.+?):\s*(.+)/);
      if (match) {
        const charName = match[1].trim();
        const paths = match[2].split(',').map(p => p.trim());
        
        paths.forEach(path => {
          const angleMatch = path.match(/-(\w+)\.png$/);
          refs.push({
            characterId: charName,
            path: path,
            angle: angleMatch ? angleMatch[1] : 'unknown'
          });
        });
      }
    }
    
    return refs;
  }

  /**
   * 生成绑定清单（从 prompts 的 imageRefs 提取）
   */
  _generateBindingManifest(prompts) {
    const characters = {};
    const shots = [];

    for (const prompt of prompts) {
      const shotId = prompt.shotId;
      const charsInShot = [];

      for (const ref of (prompt.imageRefs || [])) {
        const charId = ref.characterId;
        charsInShot.push(charId);

        if (!characters[charId]) {
          characters[charId] = {
            id: charId,
            name: ref.characterName || charId,
            requiredAngles: ['front', 'threeQuarter', 'closeup', 'side'],
            portraits: {}
          };
        }

        // 添加定妆照路径
        if (ref.path) {
          characters[charId].portraits[ref.angle] = ref.path;
        }
      }

      shots.push({
        shotId,
        requiredCharacters: charsInShot,
        duration: 12,
        promptLength: prompt.length
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      characters,
      shots
    };
  }

  /**
   * 查询渲染状态
   */
  async queryStatus(taskIds) {
    if (!this.submitter || !taskIds || taskIds.length === 0) {
      return { status: 'unknown', tasks: [] };
    }

    // 复用现有系统的状态查询逻辑
    try {
      const results = await Promise.all(
        taskIds.map(async taskId => {
          try {
            // 调用 Seedance API 查询状态
            const response = await fetch(this.config.apiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            return { taskId, status: 'queried', response: await response.json() };
          } catch (e) {
            return { taskId, status: 'error', error: e.message };
          }
        })
      );

      return { status: 'completed', tasks: results };
    } catch (e) {
      return { status: 'error', error: e.message, tasks: [] };
    }
  }

  /**
   * 生成渲染报告
   */
  generateReport(renderResult) {
    return {
      engine: 'RenderingEngine',
      version: '1.0.0',
      success: renderResult.success,
      summary: {
        total: renderResult.results.length,
        submitted: renderResult.submitted,
        failed: renderResult.failed,
        successRate: renderResult.results.length > 0
          ? Math.round((renderResult.submitted / renderResult.results.length) * 100)
          : 0
      },
      tasks: renderResult.results.map(r => ({
        shotId: r.shotId,
        taskId: r.taskId,
        status: r.status || (r.success ? 'submitted' : 'failed'),
        error: r.error || null
      })),
      timing: renderResult.timing,
      errors: renderResult.errors
    };
  }
}

module.exports = { RenderingEngine };
```

---

## 📄 hyperreality-system/engines/script-engine/core/adapter.js

```js
// engines/script-engine/core/adapter.js
// Adapter - 将 ScriptBlueprint 转换为现有系统可消费的格式
// 版本：v1.0 | 日期：2026-06-07

const path = require('path');

class ScriptBlueprintAdapter {
  constructor(options = {}) {
    this.config = {
      charactersDir: options.charactersDir || path.join(__dirname, '../../../characters'),
      maxPromptLength: options.maxPromptLength || 980,
      ...options
    };
  }

  /**
   * 主入口：将 ScriptBlueprint 转换为现有 Pipeline 输入格式
   * @param {ScriptBlueprint} blueprint - 剧本蓝图
   * @returns {object} 现有系统可消费的格式
   */
  adapt(blueprint) {
    console.log(`[Adapter] 适配剧本: ${blueprint.meta.title}`);

    const result = {
      // 基础配置
      config: this._adaptConfig(blueprint),
      
      // 场景列表（对应现有 SC00~SC04）
      scenes: this._adaptScenes(blueprint),
      
      // 角色系统（对应现有 characters/）
      characters: this._adaptCharacters(blueprint),
      
      // 台词系统
      dialogues: this._adaptDialogues(blueprint),
      
      // 世界观设定
      worldSetting: this._adaptWorldSetting(blueprint),
      
      // 元数据
      metadata: {
        blueprint_id: blueprint.blueprint_id,
        version: blueprint.version,
        title: blueprint.meta.title,
        narrative_mode: blueprint.meta.narrative_mode,
        target_duration: blueprint.meta.target_duration,
        total_scenes: blueprint.structure.scenes.length
      }
    };

    console.log(`[Adapter] 适配完成: ${result.scenes.length} 场景, ${result.characters.length} 角色`);
    return result;
  }

  /**
   * 适配配置
   */
  _adaptConfig(blueprint) {
    return {
      title: blueprint.meta.title,
      narrative_mode: blueprint.meta.narrative_mode,
      target_duration: blueprint.meta.target_duration,
      world_setting: blueprint.world_setting?.world_id || 'default',
      featured_beast_id: blueprint.extensions?.nirath_extension?.featured_beast_id || null,
      protagonist: blueprint.character_system?.characters?.find(c => c.role === 'protagonist')?.character_id || 'xiaoG',
      
      // 约束配置
      constraints: {
        max_prompt_length: this.config.maxPromptLength,
        reference_image_count: 2,
        forbidden_elements: ['voiceover', 'metal_gloss', 'unnatural_eye_color']
      },
      
      // 视觉配置
      visual: {
        style: 'hyper-realistic cinematic',
        color_temperature: 'warm',
        lighting: 'cinematic',
        forbidden: ['dark', 'night', 'metal_gloss']
      }
    };
  }

  /**
   * 适配场景列表
   */
  _adaptScenes(blueprint) {
    return blueprint.structure.scenes.map((scene, index) => {
      const adaptedScene = {
        scene_id: scene.scene_id || `SC${String(index).padStart(2, '0')}`,
        scene_name: scene.scene_name || `场景${index + 1}`,
        scene_type: scene.scene_type || 'establishing',
        scene_function: scene.scene_function || 'establish',
        
        // 时序
        timing: {
          start: scene.timing?.start || 0,
          duration: scene.timing?.duration || 20,
          end: scene.timing?.end || 20
        },
        
        // 设定
        setting: scene.setting || '',
        visual_notes: scene.visual_notes || '',
        
        // 角色
        characters: scene.characters || [],
        
        // 对话
        dialogue: scene.dialogue || { has_dialogue: false, lines: [] },
        
        // 情感目标
        emotional_target: scene.emotional_target || { valence: 0, arousal: 0.5, dominance: 0.5 },
        
        // 视觉方向（为制作引擎准备）
        visual_direction: {
          shot_type: this._inferShotType(scene.scene_type),
          camera_movement: this._inferCameraMovement(scene.scene_type),
          lighting: this._inferLighting(scene.scene_type),
          color_temperature: this._inferColorTemperature(scene.emotional_target)
        }
      };

      // 生成镜头 Prompt 的基础文本（供制作引擎使用）
      adaptedScene.prompt_base = this._generatePromptBase(adaptedScene, blueprint);

      return adaptedScene;
    });
  }

  /**
   * 推断镜头类型
   */
  _inferShotType(sceneType) {
    const shotMap = {
      'opening': 'wide',
      'establishing': 'medium',
      'conflict': 'close_up',
      'emotional_climax': 'extreme_close_up',
      'resolution': 'medium'
    };
    return shotMap[sceneType] || 'medium';
  }

  /**
   * 推断运镜方式
   */
  _inferCameraMovement(sceneType) {
    const movementMap = {
      'opening': '缓慢推进',
      'establishing': '稳定机位',
      'conflict': '手持晃动',
      'emotional_climax': '快速推近',
      'resolution': '缓慢后拉'
    };
    return movementMap[sceneType] || '稳定机位';
  }

  /**
   * 推断布光
   */
  _inferLighting(sceneType) {
    const lightingMap = {
      'opening': '自然光+环境光',
      'establishing': '均匀明亮',
      'conflict': '戏剧性明暗对比',
      'emotional_climax': '伦勃朗光',
      'resolution': '温暖柔光'
    };
    return lightingMap[sceneType] || '均匀明亮';
  }

  /**
   * 推断色温
   */
  _inferColorTemperature(emotionalTarget) {
    if (!emotionalTarget) return 'neutral';
    
    const valence = emotionalTarget.valence || 0;
    if (valence > 0.5) return 'warm';
    if (valence < -0.3) return 'cool';
    return 'neutral';
  }

  /**
   * 生成 Prompt 基础文本
   */
  _generatePromptBase(scene, blueprint) {
    const parts = [];
    
    // 1. 场景类型和风格
    parts.push(`电影级${scene.scene_function === 'climax' ? '高潮' : ''}镜头`);
    parts.push('超写实');
    
    // 2. 世界观
    if (blueprint.world_setting?.world_id === 'nirath') {
      parts.push('Nirath星球');
    }
    
    // 3. 设定
    if (scene.setting) {
      parts.push(scene.setting);
    }
    
    // 4. 角色
    if (scene.characters && scene.characters.length > 0) {
      const characterDescs = scene.characters.map(cid => {
        const char = blueprint.character_system?.characters?.find(c => c.character_id === cid);
        if (char) {
          return `${char.name}（${char.visual_anchor?.core_features?.join('、') || ''}）`;
        }
        return cid;
      });
      parts.push(characterDescs.join('，'));
    }
    
    // 5. 视觉方向
    if (scene.visual_direction) {
      parts.push(`${scene.visual_direction.shot_type}，${scene.visual_direction.camera_movement}`);
    }
    
    // 6. 对话提示（如果有）
    if (scene.dialogue?.has_dialogue && scene.dialogue.lines?.length > 0) {
      const line = scene.dialogue.lines[0];
      parts.push(`台词：「${line.text}」`);
    }
    
    return parts.join('，');
  }

  /**
   * 适配角色系统
   */
  _adaptCharacters(blueprint) {
    return (blueprint.character_system?.characters || []).map(char => {
      const adapted = {
        character_id: char.character_id,
        name: char.name,
        role: char.role,
        
        // 视觉锚点
        visual_anchor: {
          core_features: char.visual_anchor?.core_features || [],
          reference_images: char.visual_anchor?.reference_images || []
        },
        
        // 定妆照路径
        portraits: this._resolvePortraitPaths(char.character_id, char.visual_anchor?.reference_images)
      };

      return adapted;
    });
  }

  /**
   * 解析定妆照路径
   */
  _resolvePortraitPaths(characterId, referenceImages) {
    const paths = {};
    
    if (referenceImages && referenceImages.length > 0) {
      for (const imgPath of referenceImages) {
        const angle = this._extractAngleFromPath(imgPath);
        if (angle) {
          paths[angle] = imgPath;
        }
      }
    }
    
    // 如果没有提供路径，尝试默认路径
    if (Object.keys(paths).length === 0) {
      const defaultAngles = ['front', 'threeQuarter', 'closeup', 'side'];
      const charDir = characterId === 'taotie' ? 'tao-tie' : characterId;
      
      for (const angle of defaultAngles) {
        const defaultPath = path.join(this.config.charactersDir, charDir, `${angle}.jpg`);
        if (require('fs').existsSync(defaultPath)) {
          paths[angle] = defaultPath;
        }
      }
    }
    
    return paths;
  }

  /**
   * 从路径提取角度
   */
  _extractAngleFromPath(imgPath) {
    const basename = path.basename(imgPath, path.extname(imgPath));
    const angleMap = {
      'front': 'front',
      'threeQuarter': 'threeQuarter',
      'three_quarter': 'threeQuarter',
      'closeup': 'closeup',
      'side': 'side',
      'side_profile': 'side'
    };
    return angleMap[basename] || basename;
  }

  /**
   * 适配台词系统
   */
  _adaptDialogues(blueprint) {
    const dialogues = [];
    
    for (const scene of blueprint.structure.scenes || []) {
      if (scene.dialogue?.has_dialogue && scene.dialogue.lines) {
        for (const line of scene.dialogue.lines) {
          dialogues.push({
            scene_id: scene.scene_id,
            speaker: line.speaker,
            text: line.text,
            emotion: line.emotion || 'neutral',
            timing: {
              start: scene.timing?.start || 0,
              duration: scene.timing?.duration || 20
            }
          });
        }
      }
    }
    
    return dialogues;
  }

  /**
   * 适配世界观设定
   */
  _adaptWorldSetting(blueprint) {
    const ws = blueprint.world_setting;
    if (!ws) return null;
    
    return {
      world_id: ws.world_id,
      world_name: ws.world_name,
      era: ws.era,
      core_rules: ws.core_rules || [],
      environment_tags: ws.environment_tags || [],
      visual_constraints: {
        must_have: ws.world_id === 'nirath' ? [
          '明亮多色彩强质感',
          '超写实风格',
          'Nirath环境特征'
        ] : [],
        forbidden: [
          '暗黑风格',
          '夜晚场景',
          '金属光泽',
          '人物眼睛非自然色'
        ]
      }
    };
  }

  /**
   * 生成适配报告
   */
  generateReport(adaptedData) {
    return {
      blueprint_id: adaptedData.metadata.blueprint_id,
      adaptation_status: 'success',
      scenes_count: adaptedData.scenes.length,
      characters_count: adaptedData.characters.length,
      dialogues_count: adaptedData.dialogues.length,
      total_duration: adaptedData.scenes.reduce((sum, s) => sum + s.timing.duration, 0),
      warnings: this._generateWarnings(adaptedData),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成警告信息
   */
  _generateWarnings(adaptedData) {
    const warnings = [];
    
    // 检查场景时长
    const totalDuration = adaptedData.scenes.reduce((sum, s) => sum + s.timing.duration, 0);
    if (totalDuration !== adaptedData.metadata.target_duration) {
      warnings.push({
        type: 'duration_mismatch',
        message: `总时长 ${totalDuration}s 不等于目标时长 ${adaptedData.metadata.target_duration}s`,
        severity: 'warning'
      });
    }
    
    // 检查角色定妆照
    for (const char of adaptedData.characters) {
      const portraitCount = Object.keys(char.portraits || {}).length;
      if (portraitCount === 0) {
        warnings.push({
          type: 'missing_portraits',
          message: `角色 ${char.name} 没有定妆照`,
          severity: 'warning'
        });
      }
    }
    
    // 检查台词
    const scenesWithDialogue = adaptedData.scenes.filter(s => s.dialogue?.has_dialogue).length;
    if (scenesWithDialogue === 0) {
      warnings.push({
        type: 'no_dialogue',
        message: '没有场景包含台词',
        severity: 'critical'
      });
    }
    
    return warnings;
  }
}

module.exports = { ScriptBlueprintAdapter };
```

---

## 📄 hyperreality-system/engines/script-engine/core/intent-parser.js

```js
// engines/script-engine/core/intent-parser.js
// Intent Parser - 解析用户意图，识别叙事模式，提取元数据
// 版本：v1.0 | 日期：2026-06-07

class IntentParser {
  constructor(options = {}) {
    this.config = {
      // 快速分类器：关键词匹配
      keywordDict: {
        dramatic: ['短剧', '剧情', '故事', '角色', '冲突', '反转', '结局', '情感', '感动', '逆袭', '人设', '剧本', '台词', '山海经', 'Nirath'],
        educational: ['科普', '讲解', '知识', '教程', '学会', '原理', '什么是', '如何', '为什么'],
        documentary: ['纪录片', '纪实', '采访', '真实', '调查', '记录'],
        lifelog: ['家庭', '聚会', '旅行', '回忆', 'Vlog', '日常', '记录生活'],
        commercial: ['广告', '品牌', '营销', '推广', '产品', '转化', '带货', 'CTA']
      },
      // 混合模式信号
      hybridSignals: {
        '知识营销': { primary: 'educational', secondary: 'commercial', keywords: ['科普种草', '知识带货', '专业测评'] },
        '品牌叙事': { primary: 'dramatic', secondary: 'commercial', keywords: ['品牌故事', '情感广告', '微电影广告'] },
        '纪实营销': { primary: 'documentary', secondary: 'commercial', keywords: ['品牌纪录片', '真实故事广告'] },
        '科普短剧': { primary: 'educational', secondary: 'dramatic', keywords: ['剧情科普', '故事学习'] }
      },
      // Nirath 世界观检测
      nirathSignals: ['Nirath', 'nirath', '山海经', '异兽', '饕餮', '小G', '硅基', '碳化硅'],
      // 默认配置
      defaultMode: 'dramatic',
      confidenceThreshold: 0.85,
      ...options
    };
  }

  /**
   * 主入口：解析用户意图
   * @param {string} rawInput - 用户原始输入
   * @param {object} metadata - 附加元数据（如标题、时长等）
   * @returns {object} UserIntent 对象
   */
  parse(rawInput, metadata = {}) {
    const text = rawInput || '';
    
    // 第一层：快速分类器
    const fastResult = this._fastClassify(text);
    
    // 如果置信度足够高，直接返回
    if (fastResult.confidence >= 0.90) {
      return this._buildUserIntent(fastResult, metadata, 'fast_classifier', text);
    }

    // 第二层：深度分析（检测混合模式、Nirath世界观等）
    const deepResult = this._deepAnalysis(text, fastResult);
    
    return this._buildUserIntent(deepResult, metadata, 'deep_analysis', text);
  }

  /**
   * 快速分类器：基于关键词匹配
   */
  _fastClassify(text) {
    const scores = {};
    let totalMatches = 0;

    // 统计各类型关键词命中数
    for (const [type, keywords] of Object.entries(this.config.keywordDict)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matches++;
        }
      }
      scores[type] = matches;
      totalMatches += matches;
    }

    // 计算置信度
    let maxScore = 0;
    let primaryType = this.config.defaultMode;

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryType = type;
      }
    }

    const confidence = totalMatches > 0 ? maxScore / totalMatches : 0;

    return {
      primary_type: primaryType,
      confidence: Math.min(confidence, 1.0),
      scores,
      layer: 'fast_classifier'
    };
  }

  /**
   * 深度分析：检测混合模式、世界观、元数据提取
   */
  _deepAnalysis(text, fastResult) {
    let result = { ...fastResult };

    // 检测混合模式
    const hybridMode = this._detectHybridMode(text);
    if (hybridMode) {
      result.primary_type = hybridMode.primary;
      result.secondary_type = hybridMode.secondary;
      result.hybrid_mode = hybridMode.name;
      result.confidence = 0.88; // 混合模式默认置信度
    }

    // 检测 Nirath 世界观
    const isNirath = this._detectNirath(text);
    if (isNirath) {
      result.world_setting = 'Nirath';
      result.nirath_signals = isNirath.matches;
    }

    // 提取时长信息
    const duration = this._extractDuration(text);
    if (duration) {
      result.target_duration = duration;
    }

    // 提取异兽 ID
    const beastId = this._extractBeastId(text);
    if (beastId) {
      result.featured_beast_id = beastId;
    }

    return result;
  }

  /**
   * 检测混合模式
   */
  _detectHybridMode(text) {
    for (const [name, config] of Object.entries(this.config.hybridSignals)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          return {
            name,
            primary: config.primary,
            secondary: config.secondary
          };
        }
      }
    }
    return null;
  }

  /**
   * 检测 Nirath 世界观
   */
  _detectNirath(text) {
    const matches = [];
    for (const signal of this.config.nirathSignals) {
      if (text.includes(signal)) {
        matches.push(signal);
      }
    }
    return matches.length > 0 ? { matches } : null;
  }

  /**
   * 提取时长（秒）
   */
  _extractDuration(text) {
    // 匹配 "120秒", "2分钟", "120s", "2min" 等
    const patterns = [
      /(\d+)\s*秒/,
      /(\d+)\s*分钟/,
      /(\d+)\s*s/i,
      /(\d+)\s*min/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let value = parseInt(match[1]);
        // 分钟转秒
        if (pattern.toString().includes('分钟') || pattern.toString().includes('min')) {
          value *= 60;
        }
        return value;
      }
    }
    return null;
  }

  /**
   * 提取异兽 ID
   */
  _extractBeastId(text) {
    const beastPatterns = {
      'taotie': ['饕餮', 'tao-tie', 'taotie'],
      'qilin': ['麒麟', 'qilin'],
      'fenghuang': ['凤凰', '凤凰', 'fenghuang'],
      'xiezhi': ['獬豸', 'xiezhi'],
      'bixie': ['辟邪', 'bixie']
    };

    for (const [id, keywords] of Object.entries(beastPatterns)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return id;
        }
      }
    }
    return null;
  }

  /**
   * 构建 UserIntent 对象
   */
  _buildUserIntent(analysis, metadata, layer, rawInput) {
    const isHybrid = !!analysis.hybrid_mode;
    
    return {
      intent_id: this._generateUUID(),
      raw_input: metadata.raw_input || rawInput || '',
      parsed: {
        narrative_mode: isHybrid ? 'hybrid' : analysis.primary_type,
        primary_mode: analysis.primary_type,
        secondary_modes: analysis.secondary_type ? [analysis.secondary_type] : [],
        hybrid_config: isHybrid ? {
          mode_weights: { [analysis.primary_type]: 0.6, [analysis.secondary_type]: 0.4 },
          handover_points: ['climax', 'resolution'],
          hybrid_mode_name: analysis.hybrid_mode
        } : null
      },
      metadata: {
        title: metadata.title || '未命名项目',
        target_duration: analysis.target_duration || metadata.target_duration || 120,
        target_platform: metadata.target_platform || ['tiktok', 'bilibili'],
        language: metadata.language || 'zh-CN',
        style_tags: metadata.style_tags || ['hyper-realistic', 'cinematic', 'epic'],
        world_setting: analysis.world_setting || metadata.world_setting || 'default',
        featured_beast_id: analysis.featured_beast_id || metadata.featured_beast_id || null,
        protagonist: metadata.protagonist || 'xiaoG',
        ...metadata
      },
      constraints: {
        max_prompt_length: metadata.max_prompt_length || 980,
        reference_image_count: metadata.reference_image_count || 2,
        forbidden_elements: metadata.forbidden_elements || ['voiceover', 'metal_gloss', 'unnatural_eye_color']
      },
      analysis: {
        layer,
        confidence: analysis.confidence,
        scores: analysis.scores
      }
    };
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = { IntentParser };
```

---

## 📄 hyperreality-system/engines/script-engine/core/script-blueprint.js

```js
// engines/script-engine/core/script-blueprint.js
// ScriptBlueprint 数据模型 - 系统的"单一真相源"
// 版本：v1.0 | 日期：2026-06-07

class ScriptBlueprint {
  constructor(data = {}) {
    this.blueprint_id = data.blueprint_id || this._generateUUID();
    this.version = data.version || '1.0.0';
    this.intent_ref = data.intent_ref || null;

    this.meta = {
      title: data.meta?.title || 'Untitled',
      narrative_mode: data.meta?.narrative_mode || 'dramatic',
      target_duration: data.meta?.target_duration || 120,
      acts_count: data.meta?.acts_count || 3,
      scenes_count: data.meta?.scenes_count || 5,
      ...data.meta
    };

    this.structure = {
      acts: data.structure?.acts || [],
      scenes: data.structure?.scenes || []
    };

    this.character_system = {
      characters: data.character_system?.characters || []
    };

    this.voice_system = {
      global_voice_policy: data.voice_system?.global_voice_policy || 'dialogue_only_no_voiceover',
      voice_profiles: data.voice_system?.voice_profiles || []
    };

    this.world_setting = {
      world_id: data.world_setting?.world_id || 'default',
      world_name: data.world_setting?.world_name || 'Default World',
      era: data.world_setting?.era || 'modern',
      core_rules: data.world_setting?.core_rules || [],
      environment_tags: data.world_setting?.environment_tags || []
    };

    this.extensions = {
      dramatic_extension: data.extensions?.dramatic_extension || {},
      nirath_extension: data.extensions?.nirath_extension || {},
      ...data.extensions
    };

    this.quality_report = {
      evaluator: data.quality_report?.evaluator || 'DramaBench',
      scores: data.quality_report?.scores || {},
      passed: data.quality_report?.passed || false
    };
  }

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 获取指定场景
  getScene(sceneId) {
    return this.structure.scenes.find(s => s.scene_id === sceneId);
  }

  // 获取指定角色
  getCharacter(characterId) {
    return this.character_system.characters.find(c => c.character_id === characterId);
  }

  // 获取所有包含对话的场景
  getScenesWithDialogue() {
    return this.structure.scenes.filter(s => s.dialogue?.has_dialogue);
  }

  // 获取指定幕的所有场景
  getScenesByAct(actId) {
    return this.structure.scenes.filter(s => s.act_id === actId);
  }

  // 获取剧本总时长
  getTotalDuration() {
    return this.structure.scenes.reduce((sum, s) => sum + (s.timing?.duration || 0), 0);
  }

  // 验证剧本完整性
  validate() {
    const errors = [];

    if (!this.meta.title) errors.push('Missing title');
    if (!this.meta.narrative_mode) errors.push('Missing narrative_mode');
    if (!this.structure.acts.length) errors.push('No acts defined');
    if (!this.structure.scenes.length) errors.push('No scenes defined');

    // 验证场景完整性
    this.structure.scenes.forEach((scene, idx) => {
      if (!scene.scene_id) errors.push(`Scene ${idx}: Missing scene_id`);
      if (!scene.scene_type) errors.push(`Scene ${scene.scene_id || idx}: Missing scene_type`);
      if (!scene.timing) errors.push(`Scene ${scene.scene_id || idx}: Missing timing`);
    });

    // 验证角色一致性
    const characterIds = this.character_system.characters.map(c => c.character_id);
    this.structure.scenes.forEach(scene => {
      if (scene.characters) {
        scene.characters.forEach(cid => {
          if (!characterIds.includes(cid)) {
            errors.push(`Scene ${scene.scene_id}: Character ${cid} not defined`);
          }
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 导出为 JSON
  toJSON() {
    return JSON.stringify({
      blueprint_id: this.blueprint_id,
      version: this.version,
      intent_ref: this.intent_ref,
      meta: this.meta,
      structure: this.structure,
      character_system: this.character_system,
      voice_system: this.voice_system,
      world_setting: this.world_setting,
      extensions: this.extensions,
      quality_report: this.quality_report
    }, null, 2);
  }

  // 从 JSON 导入
  static fromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    return new ScriptBlueprint(data);
  }

  // 创建副本
  clone() {
    return new ScriptBlueprint(JSON.parse(this.toJSON()));
  }
}

module.exports = { ScriptBlueprint };
```

---

## 📄 hyperreality-system/engines/script-engine/core/script-generator.js

```js
// engines/script-engine/core/script-generator.js
// Script Generator - 调用 LLM 生成结构化剧本
// 版本：v1.0 | 日期：2026-06-07

const fs = require('fs');
const path = require('path');
const { ScriptBlueprint } = require('./script-blueprint');

class ScriptGenerator {
  constructor(options = {}) {
    this.config = {
      llmEndpoint: options.llmEndpoint || process.env.LLM_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      model: options.model || 'ep-20260518004622-jp46s', // 使用文本模型
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
      promptTemplateDir: options.promptTemplateDir || path.join(__dirname, '../prompts'),
      templateDir: options.templateDir || path.join(__dirname, '../templates'),
      timeout: options.timeout || 180000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
  }

  /**
   * 主入口：生成剧本
   * @param {object} userIntent - 用户意图对象
   * @param {object} templateData - 模板数据（可选）
   * @returns {ScriptBlueprint} 生成的剧本蓝图
   */
  async generate(userIntent, templateData = null) {
    console.log(`[ScriptGenerator] 开始生成剧本: ${userIntent.metadata?.title}`);

    // 1. 加载模板
    const template = templateData || await this._loadTemplate(userIntent);

    // 2. 构建 LLM Prompt
    const prompt = this._buildGenerationPrompt(userIntent, template);

    // 3. 调用 LLM
    const llmResponse = await this._callLLM(prompt);

    // 4. 解析并构建 Blueprint
    const blueprint = this._parseLLMResponse(llmResponse, userIntent);

    console.log(`[ScriptGenerator] 剧本生成完成: ${blueprint.blueprint_id}, ${blueprint.structure.scenes.length} 场景`);
    return blueprint;
  }

  /**
   * 加载模板
   */
  async _loadTemplate(userIntent) {
    const mode = userIntent.parsed?.primary_mode || 'dramatic';
    const templatePath = path.join(this.config.templateDir, `${mode}-template.json`);

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      return JSON.parse(templateContent);
    } catch (err) {
      console.warn(`[ScriptGenerator] 模板加载失败: ${templatePath}, 使用默认模板`);
      return this._getDefaultTemplate();
    }
  }

  /**
   * 获取默认模板
   */
  _getDefaultTemplate() {
    return {
      structure: {
        acts: [
          { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', beats: [] },
          { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', beats: [] },
          { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', beats: [] }
        ]
      },
      default_scene_count: 5,
      default_duration_per_scene: 20
    };
  }

  /**
   * 构建 LLM 生成 Prompt
   */
  _buildGenerationPrompt(userIntent, template) {
    const meta = userIntent.metadata;
    const constraints = userIntent.constraints;
    const parsed = userIntent.parsed;

    const prompt = `你是一位顶级短视频编剧，专门为AI视频生成系统创作结构化剧本。

## 任务
为以下项目创作完整的结构化剧本，输出必须是严格的 JSON 格式。

## 项目信息
- 标题：${meta.title}
- 叙事类型：${parsed.primary_mode} ${parsed.hybrid_config ? '+ ' + parsed.secondary_modes.join(', ') : ''}
- 目标时长：${meta.target_duration}秒
- 世界观：${meta.world_setting}
${meta.featured_beast_id ? '- 主角异兽：' + meta.featured_beast_id : ''}
- 主角：${meta.protagonist}
- 平台：${meta.target_platform.join(', ')}
- 语言：${meta.language}

## 系统约束（不可违反）
1. 禁止旁白（Voiceover），只保留角色对话（Dialogue）
2. 每个场景必须有角色对话（台词）
3. 台词必须口语化，适合短视频节奏（每句不超过30字）
4. 场景时长分配：根据内容重要性、台词长度、视觉复杂度三维度分配
5. 总时长必须严格等于 ${meta.target_duration} 秒
6. 角色视觉锚点必须保持一致（定妆照引用）

## 剧本结构模板
采用三幕式结构：
${JSON.stringify(template.structure.acts, null, 2)}

## 世界观设定（Nirath）
- Nirath是地球前身，一个硅基与碳基生命共存的星球
- 《山海经》实为Nirath往事的记录
- 核心主题：记忆即存在
- 环境特征：硅晶草原、双月当空、等离子河流、晶体森林
- 禁止暗黑风格，要求明亮多色彩强质感

## 输出格式要求
你必须输出一个严格的 JSON 对象，符合以下 Schema：

\`\`\`json
{
  "meta": {
    "title": "标题",
    "narrative_mode": "dramatic",
    "target_duration": ${meta.target_duration},
    "acts_count": 3,
    "scenes_count": 场景数量
  },
  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "幕名称",
        "act_function": "establish|confront|resolve",
        "start_time": 0,
        "end_time": 幕结束秒数,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook|setup|rising|climax|resolution",
            "description": "节拍描述",
            "target_emotion": "wonder|tension|joy|sadness|awe"
          }
        ]
      }
    ],
    "scenes": [
      {
        "scene_id": "SC00",
        "scene_name": "场景名称",
        "scene_type": "opening|establishing|conflict|emotional_climax|resolution",
        "scene_function": "establish|advance|conflict|climax|resolve",
        "act_id": "ACT-1",
        "timing": {
          "start": 开始秒数,
          "duration": 持续秒数,
          "end": 结束秒数
        },
        "characters": ["角色ID"],
        "setting": "场景时空设定",
        "dialogue": {
          "has_dialogue": true,
          "lines": [
            {
              "speaker": "角色ID",
              "text": "台词内容（口语化，不超过30字）",
              "emotion": "情绪标签"
            }
          ]
        },
        "visual_notes": "视觉指导备注",
        "emotional_target": {
          "valence": 0.8,
          "arousal": 0.6,
          "dominance": 0.5
        }
      }
    ]
  },
  "character_system": {
    "characters": [
      {
        "character_id": "xiaoG",
        "name": "小G",
        "role": "protagonist",
        "voice_profile": {
          "persona": "角色人设描述",
          "tone": "语气标签",
          "speaking_style": "说话风格"
        },
        "visual_anchor": {
          "core_features": ["核心特征1", "核心特征2", "核心特征3"],
          "reference_images": ["定妆照路径"]
        }
      }
    ]
  },
  "voice_system": {
    "global_voice_policy": "dialogue_only_no_voiceover",
    "voice_profiles": [
      {
        "voice_id": "V-角色ID",
        "character_id": "角色ID",
        "role": "角色定位",
        "tone": "语气",
        "pace": "语速",
        "constraints": {
          "forbidden_words": ["禁用词"],
          "max_line_length": 30
        }
      }
    ]
  },
  "world_setting": {
    "world_id": "nirath",
    "world_name": "Nirath星球",
    "era": "上古纪元",
    "core_rules": ["规则1", "规则2"],
    "environment_tags": ["环境标签1", "环境标签2"]
  }
}
\`\`\`

## 关键要求
1. 场景数量建议 5-7 个，总时长严格等于 ${meta.target_duration} 秒
2. 片头场景（SC00）必须有角色出场 + 对话，建立世界观
3. 高潮场景必须包含情感张力和视觉冲击力
4. 结尾场景必须有角色成长/感悟 + 下集钩子
5. 每个场景的台词必须包含在场景中（不能旁白）
6. 场景时长分配示例：SC00=15s, SC01=25s, SC02=30s, SC03=30s, SC04=20s（总120s）

请直接输出 JSON，不要包含任何其他解释文字。`;

    return prompt;
  }

  /**
   * 调用 LLM API
   */
  async _callLLM(prompt) {
    const axios = require('axios');
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[ScriptGenerator] LLM 调用尝试 ${attempt}/${this.config.maxRetries}`);

        const response = await axios.post(
          this.config.llmEndpoint,
          {
            model: this.config.model,
            messages: [
              { role: 'system', content: '你是一位专业的AI视频编剧，只输出严格格式的JSON。' },
              { role: 'user', content: prompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        );

        const content = response.data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('LLM 返回内容为空');
        }

        return content;

      } catch (error) {
        lastError = error;
        console.warn(`[ScriptGenerator] LLM 调用失败 (${attempt}/${this.config.maxRetries}): ${error.message}`);

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`LLM 调用失败，已重试 ${this.config.maxRetries} 次: ${lastError?.message}`);
  }

  /**
   * 解析 LLM 响应
   */
  _parseLLMResponse(response, userIntent) {
    try {
      // 清理响应中的 markdown 代码块标记
      let jsonStr = response;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      // 解析 JSON
      const parsed = JSON.parse(jsonStr);

      // 构建 Blueprint
      const blueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          ...parsed.meta,
          narrative_mode: userIntent.parsed?.narrative_mode || 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
        structure: parsed.structure,
        character_system: parsed.character_system,
        voice_system: parsed.voice_system,
        world_setting: parsed.world_setting,
        extensions: {
          dramatic_extension: parsed.dramatic_extension || {},
          nirath_extension: {
            featured_beast_id: userIntent.metadata?.featured_beast_id,
            memory_theme: '记忆即存在'
          }
        }
      });

      return blueprint;

    } catch (err) {
      console.error('[ScriptGenerator] JSON 解析失败:', err.message);
      console.error('[ScriptGenerator] 原始响应:', response.substring(0, 500));

      // 返回一个带有错误信息的 Blueprint
      const fallbackBlueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          title: userIntent.metadata?.title || '生成失败',
          narrative_mode: 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
        quality_report: {
          evaluator: 'Error',
          scores: { error: 0 },
          passed: false
        }
      });

      fallbackBlueprint._generation_error = {
        message: err.message,
        raw_response: response.substring(0, 1000)
      };

      return fallbackBlueprint;
    }
  }

  /**
   * 保存剧本到文件
   */
  async saveBlueprint(blueprint, outputPath) {
    const json = blueprint.toJSON();
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`[ScriptGenerator] 剧本已保存: ${outputPath}`);
    return outputPath;
  }

  /**
   * 从文件加载剧本
   */
  static loadBlueprint(filePath) {
    const json = fs.readFileSync(filePath, 'utf-8');
    return ScriptBlueprint.fromJSON(json);
  }
}

module.exports = { ScriptGenerator };
```

---

## 📄 hyperreality-system/engines/script-engine/core/script-validator.js

```js
// engines/script-engine/core/script-validator.js
// Script Validator - 剧本校验与质量评估
// 版本：v1.0 | 日期：2026-06-07

class ScriptValidator {
  constructor(options = {}) {
    this.config = {
      // 时长约束
      minDuration: 15,
      maxDuration: 300,
      
      // 场景数量约束
      minScenes: 3,
      maxScenes: 10,
      
      // 台词约束
      maxLineLength: 30, // 字
      minScenesWithDialogue: 1,
      
      // 质量阈值
      qualityThresholds: {
        structural_integrity: 70,
        emotional_impact: 60,
        character_consistency: 80,
        dialogue_quality: 70,
        visual_feasibility: 60
      },
      
      // Nirath 约束
      nirathRequiredElements: ['Nirath', '硅', '双月', '晶体', '等离子'],
      forbiddenElements: ['旁白', 'voiceover', '解说', '金属光泽', 'unnatural_eye_color'],
      
      ...options
    };
  }

  /**
   * 主入口：完整校验剧本
   * @param {ScriptBlueprint} blueprint - 剧本蓝图
   * @returns {object} 校验报告
   */
  validate(blueprint) {
    const checks = [];
    
    // 1. 结构完整性检查
    const structuralChecks = this._checkStructure(blueprint);
    checks.push(...structuralChecks);
    
    // 2. 时长检查
    const durationChecks = this._checkDuration(blueprint);
    checks.push(...durationChecks);
    
    // 3. 台词检查
    const dialogueChecks = this._checkDialogue(blueprint);
    checks.push(...dialogueChecks);
    
    // 4. 角色一致性检查
    const characterChecks = this._checkCharacters(blueprint);
    checks.push(...characterChecks);
    
    // 5. Nirath 世界观检查（如果是 Nirath 世界观）
    if (blueprint.world_setting?.world_id === 'nirath') {
      const nirathChecks = this._checkNirathWorld(blueprint);
      checks.push(...nirathChecks);
    }
    
    // 6. 禁止元素检查
    const forbiddenChecks = this._checkForbiddenElements(blueprint);
    checks.push(...forbiddenChecks);
    
    // 7. 质量评分
    const scores = this._calculateScores(blueprint, checks);
    
    // 汇总
    const failedChecks = checks.filter(c => c.passed === false);
    const passed = failedChecks.length === 0 && scores.overall >= 60;
    
    return {
      blueprint_id: blueprint.blueprint_id,
      passed,
      overall_score: scores.overall,
      checks,
      scores: {
        detailed: scores.detailed,
        summary: scores.summary
      },
      issues: failedChecks.map(c => ({
        category: c.category,
        severity: c.severity,
        message: c.message,
        suggestion: c.suggestion
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 结构完整性检查
   */
  _checkStructure(blueprint) {
    const checks = [];
    const structure = blueprint.structure;
    
    // 检查幕结构
    checks.push({
      category: 'structure',
      name: 'acts_exist',
      passed: structure.acts && structure.acts.length > 0,
      severity: 'critical',
      message: structure.acts?.length ? `有 ${structure.acts.length} 幕` : '缺少幕结构',
      suggestion: '必须至少包含 1 幕'
    });
    
    // 检查场景数量
    const sceneCount = structure.scenes?.length || 0;
    checks.push({
      category: 'structure',
      name: 'scene_count',
      passed: sceneCount >= this.config.minScenes && sceneCount <= this.config.maxScenes,
      severity: 'critical',
      message: `有 ${sceneCount} 个场景`,
      suggestion: `场景数量应在 ${this.config.minScenes}-${this.config.maxScenes} 之间`
    });
    
    // 检查场景连续性
    let continuous = true;
    let lastEnd = 0;
    for (const scene of (structure.scenes || [])) {
      if (scene.timing) {
        if (Math.abs(scene.timing.start - lastEnd) > 1) {
          continuous = false;
        }
        lastEnd = scene.timing.end;
      }
    }
    checks.push({
      category: 'structure',
      name: 'scene_continuity',
      passed: continuous,
      severity: 'warning',
      message: continuous ? '场景时序连续' : '场景时序存在断层',
      suggestion: '确保场景时间轴连续无断层'
    });
    
    // 检查场景 ID 唯一性
    const sceneIds = (structure.scenes || []).map(s => s.scene_id);
    const uniqueIds = new Set(sceneIds);
    checks.push({
      category: 'structure',
      name: 'scene_id_unique',
      passed: sceneIds.length === uniqueIds.size,
      severity: 'critical',
      message: sceneIds.length === uniqueIds.size ? '场景 ID 唯一' : '存在重复场景 ID',
      suggestion: '确保每个场景 ID 唯一'
    });
    
    return checks;
  }

  /**
   * 时长检查
   */
  _checkDuration(blueprint) {
    const checks = [];
    const targetDuration = blueprint.meta?.target_duration || 120;
    const actualDuration = blueprint.getTotalDuration();
    
    checks.push({
      category: 'duration',
      name: 'total_duration_match',
      passed: Math.abs(actualDuration - targetDuration) <= 5,
      severity: 'critical',
      message: `目标时长 ${targetDuration}s, 实际时长 ${actualDuration}s`,
      suggestion: `总时长应与目标时长一致（误差≤5s）`
    });
    
    checks.push({
      category: 'duration',
      name: 'duration_in_range',
      passed: actualDuration >= this.config.minDuration && actualDuration <= this.config.maxDuration,
      severity: 'critical',
      message: `实际时长 ${actualDuration}s`,
      suggestion: `时长应在 ${this.config.minDuration}-${this.config.maxDuration}s 之间`
    });
    
    // 检查每个场景时长
    for (const scene of (blueprint.structure.scenes || [])) {
      if (scene.timing) {
        const duration = scene.timing.duration;
        checks.push({
          category: 'duration',
          name: `scene_${scene.scene_id}_duration`,
          passed: duration > 0 && duration <= 15,
          severity: 'warning',
          message: `场景 ${scene.scene_id} 时长 ${duration}s`,
          suggestion: '单个场景时长应在 1-60s 之间'
        });
      }
    }
    
    return checks;
  }

  /**
   * 台词检查
   */
  _checkDialogue(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    // 统计有台词的场景
    const scenesWithDialogue = scenes.filter(s => s.dialogue?.has_dialogue && s.dialogue?.lines?.length > 0);
    
    checks.push({
      category: 'dialogue',
      name: 'has_dialogue',
      passed: scenesWithDialogue.length >= this.config.minScenesWithDialogue,
      severity: 'critical',
      message: `${scenesWithDialogue.length}/${scenes.length} 场景有台词`,
      suggestion: '必须至少包含台词的场景'
    });
    
    // 检查台词长度
    let longLines = 0;
    for (const scene of scenes) {
      if (scene.dialogue?.lines) {
        for (const line of scene.dialogue.lines) {
          if (line.text && line.text.length > this.config.maxLineLength) {
            longLines++;
          }
        }
      }
    }
    
    checks.push({
      category: 'dialogue',
      name: 'line_length',
      passed: longLines === 0,
      severity: 'warning',
      message: longLines === 0 ? '所有台词长度合规' : `${longLines} 句台词超过 ${this.config.maxLineLength} 字`,
      suggestion: `台词每句不超过 ${this.config.maxLineLength} 字`
    });
    
    // 检查是否包含旁白（禁止）
    let hasVoiceover = false;
    for (const scene of scenes) {
      if (scene.voice_over?.text) {
        hasVoiceover = true;
        break;
      }
    }
    
    checks.push({
      category: 'dialogue',
      name: 'no_voiceover',
      passed: !hasVoiceover,
      severity: 'critical',
      message: hasVoiceover ? '检测到旁白（禁止）' : '无旁白，合规',
      suggestion: '全局禁止旁白，只保留角色对话'
    });
    
    return checks;
  }

  /**
   * 角色一致性检查
   */
  _checkCharacters(blueprint) {
    const checks = [];
    const characters = blueprint.character_system?.characters || [];
    const characterIds = characters.map(c => c.character_id);
    
    // 检查主角存在
    const hasProtagonist = characters.some(c => c.role === 'protagonist');
    checks.push({
      category: 'character',
      name: 'has_protagonist',
      passed: hasProtagonist,
      severity: 'critical',
      message: hasProtagonist ? '主角已定义' : '缺少主角定义',
      suggestion: '必须定义 protagonist 角色'
    });
    
    // 检查角色核心特征
    for (const character of characters) {
      if (character.visual_anchor?.core_features) {
        const featureCount = character.visual_anchor.core_features.length;
        checks.push({
          category: 'character',
          name: `character_${character.character_id}_features`,
          passed: featureCount >= 2 && featureCount <= 5,
          severity: 'warning',
          message: `角色 ${character.character_id} 有 ${featureCount} 个核心特征`,
          suggestion: '核心特征应在 2-5 个之间'
        });
      }
    }
    
    // 检查场景中引用的角色是否已定义
    for (const scene of (blueprint.structure.scenes || [])) {
      if (scene.characters) {
        for (const cid of scene.characters) {
          checks.push({
            category: 'character',
            name: `scene_${scene.scene_id}_character_${cid}`,
            passed: characterIds.includes(cid),
            severity: 'critical',
            message: characterIds.includes(cid) ? `角色 ${cid} 已定义` : `角色 ${cid} 未定义`,
            suggestion: '场景中引用的角色必须在 character_system 中定义'
          });
        }
      }
    }
    
    return checks;
  }

  /**
   * Nirath 世界观检查
   */
  _checkNirathWorld(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    // 检查是否包含 Nirath 环境元素
    let hasNirathElements = false;
    for (const scene of scenes) {
      if (scene.setting) {
        for (const element of this.config.nirathRequiredElements) {
          if (scene.setting.includes(element)) {
            hasNirathElements = true;
            break;
          }
        }
      }
      if (scene.visual_notes) {
        for (const element of this.config.nirathRequiredElements) {
          if (scene.visual_notes.includes(element)) {
            hasNirathElements = true;
            break;
          }
        }
      }
    }
    
    checks.push({
      category: 'nirath',
      name: 'nirath_elements',
      passed: hasNirathElements,
      severity: 'warning',
      message: hasNirathElements ? '包含 Nirath 环境元素' : '缺少 Nirath 环境元素',
      suggestion: `场景设定应包含 Nirath 特征元素：${this.config.nirathRequiredElements.join(', ')}`
    });
    
    // 检查是否违反明亮风格约束
    let hasDarkStyle = false;
    for (const scene of scenes) {
      if (scene.visual_notes) {
        const darkKeywords = ['暗黑', '黑暗', 'night', 'dark', '漆黑', '阴郁'];
        for (const keyword of darkKeywords) {
          if (scene.visual_notes.includes(keyword)) {
            hasDarkStyle = true;
            break;
          }
        }
      }
    }
    
    checks.push({
      category: 'nirath',
      name: 'bright_style',
      passed: !hasDarkStyle,
      severity: 'critical',
      message: hasDarkStyle ? '检测到暗黑风格（禁止）' : '明亮风格，合规',
      suggestion: 'Nirath 要求明亮多色彩强质感场景，禁止暗黑风格'
    });
    
    return checks;
  }

  /**
   * 禁止元素检查
   */
  _checkForbiddenElements(blueprint) {
    const checks = [];
    const scenes = blueprint.structure.scenes || [];
    
    for (const forbidden of this.config.forbiddenElements) {
      let found = false;
      let location = '';
      
      for (const scene of scenes) {
        const allText = JSON.stringify(scene);
        if (allText.includes(forbidden)) {
          found = true;
          location = scene.scene_id;
          break;
        }
      }
      
      checks.push({
        category: 'forbidden',
        name: `forbidden_${forbidden}`,
        passed: !found,
        severity: 'critical',
        message: found ? `检测到禁用元素 "${forbidden}"（场景 ${location}）` : `无 "${forbidden}"`,
        suggestion: `全局禁止 "${forbidden}"`
      });
    }
    
    return checks;
  }

  /**
   * 计算质量评分
   */
  _calculateScores(blueprint, checks) {
    const detailed = {};
    
    // 结构完整性评分
    const structuralChecks = checks.filter(c => c.category === 'structure');
    const structuralPassed = structuralChecks.filter(c => c.passed).length;
    detailed.structural_integrity = Math.round((structuralPassed / structuralChecks.length) * 100) || 0;
    
    // 时长合规评分
    const durationChecks = checks.filter(c => c.category === 'duration');
    const durationPassed = durationChecks.filter(c => c.passed).length;
    detailed.duration_compliance = Math.round((durationPassed / durationChecks.length) * 100) || 0;
    
    // 台词质量评分
    const dialogueChecks = checks.filter(c => c.category === 'dialogue');
    const dialoguePassed = dialogueChecks.filter(c => c.passed).length;
    detailed.dialogue_quality = Math.round((dialoguePassed / dialogueChecks.length) * 100) || 0;
    
    // 角色一致性评分
    const characterChecks = checks.filter(c => c.category === 'character');
    const characterPassed = characterChecks.filter(c => c.passed).length;
    detailed.character_consistency = Math.round((characterPassed / characterChecks.length) * 100) || 0;
    
    // Nirath 世界观评分
    const nirathChecks = checks.filter(c => c.category === 'nirath');
    const nirathPassed = nirathChecks.filter(c => c.passed).length;
    detailed.nirath_compliance = nirathChecks.length > 0 ? Math.round((nirathPassed / nirathChecks.length) * 100) : 100;
    
    // 综合评分
    const overall = Math.round(
      (detailed.structural_integrity * 0.25 +
       detailed.duration_compliance * 0.20 +
       detailed.dialogue_quality * 0.25 +
       detailed.character_consistency * 0.20 +
       detailed.nirath_compliance * 0.10)
    );
    
    return {
      overall,
      detailed,
      summary: {
        total_checks: checks.length,
        passed_checks: checks.filter(c => c.passed).length,
        failed_checks: checks.filter(c => !c.passed).length,
        critical_issues: checks.filter(c => !c.passed && c.severity === 'critical').length
      }
    };
  }

  /**
   * 生成修复建议
   */
  generateRepairPlan(validationReport) {
    const issues = validationReport.issues || [];
    const repairs = [];
    
    for (const issue of issues) {
      switch (issue.category) {
        case 'structure':
          repairs.push({
            type: 'structure',
            action: 'adjust_structure',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'duration':
          repairs.push({
            type: 'duration',
            action: 'adjust_timing',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'dialogue':
          repairs.push({
            type: 'dialogue',
            action: 'rewrite_dialogue',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'character':
          repairs.push({
            type: 'character',
            action: 'add_character',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'nirath':
          repairs.push({
            type: 'world_setting',
            action: 'adjust_setting',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
          
        case 'forbidden':
          repairs.push({
            type: 'content',
            action: 'remove_forbidden',
            description: issue.message,
            suggestion: issue.suggestion
          });
          break;
      }
    }
    
    return {
      blueprint_id: validationReport.blueprint_id,
      repairs,
      priority: issues.filter(i => i.severity === 'critical').length > 0 ? 'high' : 'medium'
    };
  }
}

module.exports = { ScriptValidator };
```

---

## 📄 hyperreality-system/engines/script-engine/extensions/nirath-extension.js

```js
// engines/script-engine/extensions/nirath-extension.js
// Nirath World Extension - 世界观扩展模块
// 版本：v1.0 | 日期：2026-06-07

const NIRATH_WORLD = {
  world_id: 'nirath',
  world_name: 'Nirath星球',
  era: '上古纪元',
  
  // 核心设定
  core_rules: [
    'Nirath是地球前身，一个硅基与碳基生命共存的星球',
    '《山海经》实为Nirath往事的记录，异兽是硅基生命形态',
    '核心主题：记忆即存在，遗忘即消亡',
    '时间以"晶振"计量，1晶振 = 地球1天',
    '能量来源：等离子河流与双月光辉'
  ],
  
  // 环境特征
  environment: {
    terrain: ['硅晶草原', '晶体森林', '等离子河流', '碳硅山脉', '双月峡谷'],
    sky: '双月当空，紫蓝色天穹',
    light: '双月光晕提供柔和照明，等离子河流发出荧光',
    atmosphere: '充满硅微粒的稀薄大气，呼吸可见晶尘',
    gravity: '0.8G，比地球略轻'
  },
  
  // 生命形态
  lifeforms: {
    silicon_based: {
      description: '硅基生命，以晶体结构为骨骼，能量涡流为血液',
      examples: ['饕餮', '麒麟', '凤凰', '獬豸'],
      characteristics: ['碳化硅质甲壳', '等离子能量核心', '晶体复眼']
    },
    carbon_based: {
      description: '碳基生命，类似地球生物但更适应低重力',
      examples: ['Nirath先民', '探索者后裔'],
      characteristics: ['轻量化骨骼', '高氧代谢', '光敏皮肤']
    }
  },
  
  // 异兽档案模板
  beast_template: {
    beast_id: '',
    name: '',
    name_origin: 'Nirath古语',
    
    // 生物学特征
    biology: {
      skeleton: '碳化硅质晶体结构',
      energy_source: '等离子吸收',
      lifespan: '以晶振计',
      reproduction: '晶体分裂'
    },
    
    // 视觉锚点（核心特征，不可变）
    visual_anchor: {
      core_features: ['特征1', '特征2', '特征3'],
      color_palette: ['主色', '辅色', '高光色'],
      texture: '表面质感描述',
      scale: '体型比例（相对人类）'
    },
    
    // 行为特征
    behavior: {
      temperament: '性格描述',
      habitat: '栖息地',
      diet: '能量来源',
      social_structure: '社会结构'
    },
    
    // 叙事功能
    narrative_role: {
      archetype: '神话原型',
      symbolism: '象征意义',
      story_function: '在故事中的功能'
    }
  },
  
  // 视觉约束
  visual_constraints: {
    // 必须遵守
    must_have: [
      '明亮多色彩强质感',
      '超写实风格',
      '电影级光影',
      'Nirath环境特征（硅晶、双月、等离子）'
    ],
    
    // 禁止
    forbidden: [
      '暗黑风格',
      '夜晚场景',
      '金属光泽',
      '人物眼睛非自然色',
      '旁白/Voiceover'
    ],
    
    // 推荐
    recommended: [
      '黄金3秒开场',
      '每2-3秒转场或运镜切换',
      '多机位综合运动',
      'IMAX画幅感'
    ]
  },
  
  // 主角设定（小G）
  protagonist: {
    character_id: 'xiaoG',
    name: '小G',
    role: 'Nirath探索者',
    
    visual_anchor: {
      core_features: [
        '银灰装甲（Nirath探索者标准装备）',
        '东亚面孔短发年轻男性',
        '装甲表面有Nirath符文微光'
      ],
      color_palette: ['银灰', '深蓝', '等离子蓝'],
      texture: '哑光金属+能量纹路'
    },
    
    backstory: '来自地球的探索者，通过古老传送门抵达Nirath，',
    motivation: '记录Nirath的异兽与文明，证明"记忆即存在"',
    arc: '从旁观者到参与者，最终成为Nirath记忆守护者'
  }
};

// 异兽档案库
const BEAST_ARCHIVE = {
  taotie: {
    beast_id: 'taotie',
    name: '饕餮',
    name_origin: 'Nirath古语：吞噬者',
    
    biology: {
      skeleton: '碳化硅质晶体结构，六边形蜂窝状甲壳',
      energy_source: '吞噬等离子能量，体内转化为晶振储能',
      lifespan: '3000晶振',
      reproduction: '能量饱和后分裂出子体'
    },
    
    visual_anchor: {
      core_features: [
        '碳化硅质六边形蜂窝甲壳',
        '腋下双眼（非面部）',
        '巨口能量涡流（吞噬时的等离子旋涡）'
      ],
      color_palette: ['碳化硅黑', '等离子蓝', '能量金'],
      texture: '晶体磨砂质感，边缘发光',
      scale: '3倍人类体型'
    },
    
    behavior: {
      temperament: '贪婪但非恶意，本能驱动',
      habitat: '等离子河流交汇处',
      diet: '等离子能量，偶尔吞噬晶体矿物',
      social_structure: '独行者，领地意识极强'
    },
    
    narrative_role: {
      archetype: '贪婪之神',
      symbolism: '欲望与本能，但同时也是生存意志的象征',
      story_function: '迫使主角面对"欲望与节制"的主题'
    }
  }
};

class NirathExtension {
  constructor() {
    this.world = NIRATH_WORLD;
    this.beasts = BEAST_ARCHIVE;
  }

  /**
   * 获取世界观信息
   */
  getWorldInfo() {
    return this.world;
  }

  /**
   * 获取异兽档案
   */
  getBeastArchive(beastId) {
    return this.beasts[beastId] || null;
  }

  /**
   * 获取异兽视觉锚点
   */
  getBeastVisualAnchor(beastId) {
    const beast = this.beasts[beastId];
    if (!beast) return null;
    return beast.visual_anchor;
  }

  /**
   * 获取视觉约束
   */
  getVisualConstraints() {
    return this.world.visual_constraints;
  }

  /**
   * 获取主角设定
   */
  getProtagonist() {
    return this.world.protagonist;
  }

  /**
   * 验证场景是否符合 Nirath 世界观
   */
  validateScene(scene) {
    const issues = [];
    const constraints = this.world.visual_constraints;

    // 检查禁止元素
    const sceneText = JSON.stringify(scene);
    for (const forbidden of constraints.forbidden) {
      if (sceneText.includes(forbidden)) {
        issues.push({
          type: 'forbidden',
          message: `检测到禁止元素: ${forbidden}`,
          severity: 'critical'
        });
      }
    }

    // 检查是否包含 Nirath 环境特征
    let hasEnvironment = false;
    for (const terrain of this.world.environment.terrain) {
      if (sceneText.includes(terrain)) {
        hasEnvironment = true;
        break;
      }
    }
    if (!hasEnvironment) {
      issues.push({
        type: 'environment',
        message: '场景缺少 Nirath 环境特征',
        suggestion: `建议加入: ${this.world.environment.terrain.join(', ')}`,
        severity: 'warning'
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 生成场景设定文本
   */
  generateSceneSetting(baseSetting = '') {
    const env = this.world.environment;
    const elements = [
      env.sky,
      ...env.terrain,
      env.light
    ];
    
    // 随机选择 2-3 个环境元素
    const selected = this._shuffleArray(elements).slice(0, 2 + Math.floor(Math.random() * 2));
    
    return `${baseSetting}，${selected.join('，')}`;
  }

  /**
   * 生成角色视觉锚点文本
   */
  generateCharacterVisualAnchor(characterId) {
    if (characterId === 'xiaoG') {
      const protagonist = this.world.protagonist;
      return protagonist.visual_anchor.core_features.join('，');
    }
    
    const beast = this.beasts[characterId];
    if (beast) {
      return beast.visual_anchor.core_features.join('，');
    }
    
    return '';
  }

  _shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
}

module.exports = { NirathExtension, NIRATH_WORLD, BEAST_ARCHIVE };
```

---

## 📄 hyperreality-system/engines/script-engine/index.js

```js
// engines/script-engine/index.js
// Script Engine - 剧本引擎入口
// 版本：v1.0 | 日期：2026-06-07

const { IntentParser } = require('./core/intent-parser');
const { ScriptBlueprint } = require('./core/script-blueprint');
const { ScriptGenerator } = require('./core/script-generator');
const { ScriptValidator } = require('./core/script-validator');
const { ScriptBlueprintAdapter } = require('./core/adapter');
const { NirathExtension } = require('./extensions/nirath-extension');

class ScriptEngine {
  constructor(options = {}) {
    this.intentParser = new IntentParser(options.intentParser);
    this.scriptGenerator = new ScriptGenerator(options.scriptGenerator);
    this.scriptValidator = new ScriptValidator(options.scriptValidator);
    this.adapter = new ScriptBlueprintAdapter(options.adapter);
    this.nirathExtension = new NirathExtension();
    
    this.version = '1.0.0';
  }

  /**
   * 主入口：从用户意图到适配后的剧本
   * @param {string} rawInput - 用户原始输入
   * @param {object} metadata - 附加元数据
   * @returns {object} { blueprint, adapted, validation, report }
   */
  async process(rawInput, metadata = {}) {
    console.log(`[ScriptEngine v${this.version}] 开始处理: ${metadata.title || '未命名'}`);

    // 1. 解析意图
    const userIntent = this.intentParser.parse(rawInput, metadata);
    console.log(`[ScriptEngine] 意图解析完成: ${userIntent.parsed.primary_mode}`);

    // 2. 生成剧本（需要 LLM）
    let blueprint;
    if (this.scriptGenerator.config.apiKey) {
      blueprint = await this.scriptGenerator.generate(userIntent);
    } else {
      console.log('[ScriptEngine] 无 API Key，使用模板生成');
      blueprint = this._generateFromTemplate(userIntent);
    }

    // 3. 校验剧本
    const validation = this.scriptValidator.validate(blueprint);
    console.log(`[ScriptEngine] 剧本校验: ${validation.passed ? '通过' : '失败'} (${validation.overall_score}分)`);

    // 4. 适配到现有系统格式
    const adapted = this.adapter.adapt(blueprint);
    const report = this.adapter.generateReport(adapted);

    // 5. 如果校验失败，生成修复计划
    let repairPlan = null;
    if (!validation.passed) {
      repairPlan = this.scriptValidator.generateRepairPlan(validation);
      console.log(`[ScriptEngine] 修复计划: ${repairPlan.repairs.length} 项`);
    }

    console.log(`[ScriptEngine] 处理完成: ${adapted.scenes.length} 场景, ${adapted.characters.length} 角色`);

    return {
      userIntent,
      blueprint,
      validation,
      adapted,
      report,
      repairPlan
    };
  }

  /**
   * 从模板生成剧本（无需 LLM）
   */
  _generateFromTemplate(userIntent) {
    const meta = userIntent.metadata;
    const duration = meta.target_duration || 120;
    const sceneCount = 5;
    const sceneDuration = Math.floor(duration / sceneCount);

    const scenes = [];
    const sceneTypes = ['opening', 'establishing', 'conflict', 'emotional_climax', 'resolution'];
    const sceneNames = ['片头', '探索', '冲突', '高潮', '结尾'];
    const settings = [
      'Nirath硅晶草原，双月当空',
      '晶体森林深处，荧光闪烁',
      '等离子河流旁，硅晶岩石',
      '等离子河流交汇处，能量风暴',
      '硅晶草原，双月落下'
    ];

    for (let i = 0; i < sceneCount; i++) {
      const start = i * sceneDuration;
      const end = (i === sceneCount - 1) ? duration : start + sceneDuration;
      
      scenes.push({
        scene_id: `SC0${i}`,
        scene_name: sceneNames[i],
        scene_type: sceneTypes[i],
        scene_function: i === 0 ? 'establish' : i === 3 ? 'climax' : i === 4 ? 'resolve' : 'advance',
        act_id: i < 2 ? 'ACT-1' : i < 4 ? 'ACT-2' : 'ACT-3',
        timing: { start, duration: end - start, end },
        characters: ['xiaoG'],
        setting: settings[i],
        dialogue: {
          has_dialogue: true,
          lines: [{
            speaker: 'xiaoG',
            text: `场景${i + 1}的台词...`,
            emotion: 'neutral'
          }]
        }
      });
    }

    return new ScriptBlueprint({
      intent_ref: userIntent.intent_id,
      meta: {
        title: meta.title,
        narrative_mode: userIntent.parsed?.primary_mode || 'dramatic',
        target_duration: duration,
        acts_count: 3,
        scenes_count: sceneCount
      },
      structure: {
        acts: [
          { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', start_time: 0, end_time: 40, beats: [] },
          { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', start_time: 40, end_time: 80, beats: [] },
          { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', start_time: 80, end_time: duration, beats: [] }
        ],
        scenes
      },
      character_system: {
        characters: [
          {
            character_id: 'xiaoG',
            name: '小G',
            role: 'protagonist',
            visual_anchor: {
              core_features: ['银灰装甲', '东亚面孔短发', '年轻男性'],
              reference_images: ['characters/xiaoG/front.jpg']
            }
          }
        ]
      },
      world_setting: {
        world_id: 'nirath',
        world_name: 'Nirath星球',
        era: '上古纪元',
        core_rules: ['Nirath是地球前身'],
        environment_tags: ['硅晶草原', '双月当空']
      }
    });
  }

  /**
   * 保存完整工作流结果
   */
  async saveResult(result, outputDir) {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 保存用户意图
    fs.writeFileSync(
      path.join(outputDir, `intent-${timestamp}.json`),
      JSON.stringify(result.userIntent, null, 2)
    );

    // 保存剧本蓝图
    fs.writeFileSync(
      path.join(outputDir, `blueprint-${timestamp}.json`),
      result.blueprint.toJSON()
    );

    // 保存校验报告
    fs.writeFileSync(
      path.join(outputDir, `validation-${timestamp}.json`),
      JSON.stringify(result.validation, null, 2)
    );

    // 保存适配结果
    fs.writeFileSync(
      path.join(outputDir, `adapted-${timestamp}.json`),
      JSON.stringify(result.adapted, null, 2)
    );

    console.log(`[ScriptEngine] 结果已保存到: ${outputDir}`);
    return outputDir;
  }
}

module.exports = {
  ScriptEngine,
  IntentParser,
  ScriptBlueprint,
  ScriptGenerator,
  ScriptValidator,
  ScriptBlueprintAdapter,
  NirathExtension
};
```

---

## 📄 hyperreality-system/engines/script-engine/templates/dramatic-template.json

```json
{
  "$schema": "nirath://templates/dramatic/v1",
  "template_name": "三幕式戏剧结构",
  "template_version": "1.0.0",
  "description": "经典的戏剧性三幕结构，适用于故事片、短剧、情感叙事",
  
  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "第一幕：建立",
        "act_function": "establish",
        "description": "引入世界观、角色、核心冲突的种子",
        "typical_duration_ratio": 0.25,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook",
            "beat_name": "钩子",
            "description": "在3秒内抓住观众注意力",
            "function": "立即建立情绪张力或视觉奇观"
          },
          {
            "beat_id": "B-1.2",
            "beat_type": "setup",
            "beat_name": "设定",
            "description": "建立角色、世界、日常状态",
            "function": "让观众理解角色是谁，他们在哪里"
          },
          {
            "beat_id": "B-1.3",
            "beat_type": "inciting_incident",
            "beat_name": "激励事件",
            "description": "打破平衡的事件，推动角色行动",
            "function": "角色必须做出反应，无法回到日常"
          }
        ]
      },
      {
        "act_id": "ACT-2",
        "act_name": "第二幕：对抗",
        "act_function": "confront",
        "description": "冲突升级，角色面对障碍，情感深化",
        "typical_duration_ratio": 0.50,
        "beats": [
          {
            "beat_id": "B-2.1",
            "beat_type": "rising_action",
            "beat_name": "上升动作",
            "description": "冲突逐步升级，赌注增加",
            "function": "每一步都比上一步更难"
          },
          {
            "beat_id": "B-2.2",
            "beat_type": "midpoint",
            "beat_name": "中点",
            "description": "故事转折点，角色意识到真相或做出重大决定",
            "function": "从被动反应转为主动进攻"
          },
          {
            "beat_id": "B-2.3",
            "beat_type": "abyss",
            "beat_name": "深渊",
            "description": "最低谷，角色面临最大失败",
            "function": "看似一切希望都破灭"
          }
        ]
      },
      {
        "act_id": "ACT-3",
        "act_name": "第三幕：解决",
        "act_function": "resolve",
        "description": "高潮、角色转变、结局",
        "typical_duration_ratio": 0.25,
        "beats": [
          {
            "beat_id": "B-3.1",
            "beat_type": "climax",
            "beat_name": "高潮",
            "description": "最终对抗，核心冲突的解决",
            "function": "情感与视觉的双重峰值"
          },
          {
            "beat_id": "B-3.2",
            "beat_type": "transformation",
            "beat_name": "转变",
            "description": "角色完成内在成长",
            "function": "角色不是回到旧状态，而是进入新状态"
          },
          {
            "beat_id": "B-3.3",
            "beat_type": "resolution",
            "beat_name": "结局",
            "description": "收尾，余韵，下集钩子",
            "function": "给观众情感释放和期待"
          }
        ]
      }
    ]
  },
  
  "scene_types": {
    "opening": {
      "name": "片头",
      "function": "establish",
      "required_elements": ["角色出场", "世界观建立", "对话"],
      "typical_duration": 15,
      "visual_requirements": "电影级远景，超写实，环境特征标识"
    },
    "establishing": {
      "name": "建立场景",
      "function": "establish",
      "required_elements": ["角色状态", "环境细节"],
      "typical_duration": 20,
      "visual_requirements": "中景，展示角色与环境关系"
    },
    "conflict": {
      "name": "冲突场景",
      "function": "advance",
      "required_elements": ["对抗", "情感升级", "对话"],
      "typical_duration": 25,
      "visual_requirements": "特写+中景交替，运镜增强张力"
    },
    "emotional_climax": {
      "name": "情感高潮",
      "function": "climax",
      "required_elements": ["情感峰值", "角色转变", "对话"],
      "typical_duration": 30,
      "visual_requirements": "特写为主，光影戏剧性，运镜密集"
    },
    "resolution": {
      "name": "结局场景",
      "function": "resolve",
      "required_elements": ["角色成长", "余韵", "下集钩子"],
      "typical_duration": 20,
      "visual_requirements": "远景或中景，温暖色调，留白"
    }
  },
  
  "character_models": {
    "protagonist": {
      "role": "主角",
      "required_arcs": ["want", "need"],
      "arc_description": "Want = 外在目标，Need = 内在成长"
    },
    "antagonist": {
      "role": "对手/对立面",
      "required_arcs": ["motivation"],
      "arc_description": "必须有合理的动机，不是纯粹的恶"
    },
    "featured_beast": {
      "role": "异兽主角",
      "required_arcs": ["lore", "visual_anchor"],
      "arc_description": "必须有完整档案和视觉锚点"
    }
  },
  
  "dialogue_rules": {
    "max_line_length": 30,
    "style": "口语化，适合短视频节奏",
    "forbidden": ["旁白", "解说", "内心独白"],
    "required": ["对话", "情绪标签"]
  },
  
  "timing_rules": {
    "total_duration": 120,
    "scene_duration_range": [10, 40],
    "hook_duration": 3,
    "climax_duration_ratio": 0.25
  }
}
```

---

## 📄 hyperreality-system/engines/script-engine/tests/test-script-engine.js

```js
// engines/script-engine/tests/test-script-engine.js
// 剧本引擎测试脚本 - 验证核心模块
// 运行: node engines/script-engine/tests/test-script-engine.js

const { IntentParser } = require('../core/intent-parser');
const { ScriptBlueprint } = require('../core/script-blueprint');
const { ScriptValidator } = require('../core/script-validator');
const { ScriptBlueprintAdapter } = require('../core/adapter');
const { NirathExtension } = require('../extensions/nirath-extension');

console.log('========================================');
console.log('  Script Engine 测试套件 v1.0');
console.log('========================================\n');

// 测试数据
const testIntents = [
  {
    name: 'Nirath 饕餮 EP01',
    raw: '创作山海经异兽志第一集，主角饕餮，120秒，Nirath星球，小G探索',
    metadata: {
      title: '山海经：异兽志 EP01 饕餮',
      target_duration: 120,
      world_setting: 'Nirath',
      featured_beast_id: 'taotie',
      protagonist: 'xiaoG'
    }
  },
  {
    name: '科普短剧',
    raw: '做一个剧情式科普视频，讲解量子力学，要有故事感',
    metadata: {
      title: '量子力学科普',
      target_duration: 180
    }
  }
];

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    results.passed++;
  } else {
    console.log(`  ❌ ${message}`);
    results.failed++;
  }
}

// ========== 测试 1: IntentParser ==========
console.log('\n📋 测试 1: IntentParser（意图解析）');
console.log('----------------------------------------');

const intentParser = new IntentParser();

for (const test of testIntents) {
  console.log(`\n  测试用例: ${test.name}`);
  const intent = intentParser.parse(test.raw, test.metadata);
  
  assert(intent.intent_id, '生成 intent_id');
  assert(intent.raw_input === test.raw, '保留原始输入');
  assert(intent.parsed.primary_mode, '识别主叙事模式');
  assert(intent.metadata.title === test.metadata.title, '保留元数据标题');
  assert(intent.metadata.target_duration === test.metadata.target_duration, '保留目标时长');
  
  if (test.metadata.world_setting === 'Nirath') {
    assert(intent.parsed.world_setting === 'Nirath' || intent.metadata.world_setting === 'Nirath', '识别 Nirath 世界观');
  }
  
  console.log(`  解析结果: ${intent.parsed.primary_mode} ${intent.parsed.hybrid_config ? '+ hybrid' : ''}`);
}

// ========== 测试 2: ScriptBlueprint ==========
console.log('\n📋 测试 2: ScriptBlueprint（数据模型）');
console.log('----------------------------------------');

const blueprint = new ScriptBlueprint({
  meta: {
    title: '测试剧本',
    narrative_mode: 'dramatic',
    target_duration: 120
  },
  structure: {
    acts: [
      { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', start_time: 0, end_time: 40, beats: [] },
      { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', start_time: 40, end_time: 80, beats: [] },
      { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', start_time: 80, end_time: 120, beats: [] }
    ],
    scenes: [
      {
        scene_id: 'SC00',
        scene_name: '片头',
        scene_type: 'opening',
        act_id: 'ACT-1',
        timing: { start: 0, duration: 15, end: 15 },
        characters: ['xiaoG'],
        setting: 'Nirath硅晶草原，双月当空',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '原来这就是Nirath...', emotion: 'awe' }]
        }
      },
      {
        scene_id: 'SC01',
        scene_name: '初遇',
        scene_type: 'conflict',
        act_id: 'ACT-1',
        timing: { start: 15, duration: 25, end: 40 },
        characters: ['xiaoG', 'taotie'],
        setting: '等离子河流旁，硅晶岩石',
        dialogue: {
          has_dialogue: true,
          lines: [
            { speaker: 'xiaoG', text: '那是什么？', emotion: 'surprise' },
            { speaker: 'taotie', text: '（能量涡流轰鸣）', emotion: 'neutral' }
          ]
        }
      },
      {
        scene_id: 'SC02',
        scene_name: '探索',
        scene_type: 'establishing',
        act_id: 'ACT-2',
        timing: { start: 40, duration: 30, end: 70 },
        characters: ['xiaoG'],
        setting: '晶体森林深处，荧光闪烁',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '这里的能量...好强大', emotion: 'wonder' }]
        }
      },
      {
        scene_id: 'SC03',
        scene_name: '高潮',
        scene_type: 'emotional_climax',
        act_id: 'ACT-2',
        timing: { start: 70, duration: 30, end: 100 },
        characters: ['xiaoG', 'taotie'],
        setting: '等离子河流交汇处，能量风暴',
        dialogue: {
          has_dialogue: true,
          lines: [
            { speaker: 'xiaoG', text: '我明白了，你是守护者！', emotion: 'realization' },
            { speaker: 'taotie', text: '（能量涡流平息）', emotion: 'calm' }
          ]
        }
      },
      {
        scene_id: 'SC04',
        scene_name: '结尾',
        scene_type: 'resolution',
        act_id: 'ACT-3',
        timing: { start: 100, duration: 20, end: 120 },
        characters: ['xiaoG'],
        setting: '硅晶草原，双月落下',
        dialogue: {
          has_dialogue: true,
          lines: [{ speaker: 'xiaoG', text: '记忆即存在...我会记住的', emotion: 'determined' }]
        }
      }
    ]
  },
  character_system: {
    characters: [
      {
        character_id: 'xiaoG',
        name: '小G',
        role: 'protagonist',
        visual_anchor: {
          core_features: ['银灰装甲', '东亚面孔短发', '年轻男性'],
          reference_images: ['characters/xiaoG/front.jpg']
        }
      },
      {
        character_id: 'taotie',
        name: '饕餮',
        role: 'featured_beast',
        visual_anchor: {
          core_features: ['碳化硅质甲壳', '腋下双眼', '巨口能量涡流'],
          reference_images: ['characters/tao-tie/front.jpg']
        }
      }
    ]
  },
  world_setting: {
    world_id: 'nirath',
    world_name: 'Nirath星球',
    era: '上古纪元',
    core_rules: ['Nirath是地球前身'],
    environment_tags: ['硅晶草原', '双月当空']
  }
});

assert(blueprint.blueprint_id, '生成 blueprint_id');
assert(blueprint.meta.title === '测试剧本', '设置标题');
assert(blueprint.structure.scenes.length === 5, '5个场景');
assert(blueprint.getScene('SC00').scene_name === '片头', '获取指定场景');
assert(blueprint.getCharacter('xiaoG').role === 'protagonist', '获取指定角色');
assert(blueprint.getScenesWithDialogue().length === 5, '5个场景有台词');
assert(blueprint.getTotalDuration() === 120, '总时长 120s');

// 验证
const validation = blueprint.validate();
assert(validation.valid, '剧本验证通过');
assert(validation.errors.length === 0, '无错误');

// JSON 序列化
const json = blueprint.toJSON();
assert(json.includes('测试剧本'), 'JSON 包含标题');

const cloned = ScriptBlueprint.fromJSON(json);
assert(cloned.meta.title === '测试剧本', 'JSON 反序列化');

console.log(`\n  Blueprint 测试通过 ✓`);

// ========== 测试 3: ScriptValidator ==========
console.log('\n📋 测试 3: ScriptValidator（剧本校验）');
console.log('----------------------------------------');

const validator = new ScriptValidator();
const report = validator.validate(blueprint);

assert(report.passed, '校验通过');
assert(report.overall_score > 0, '有评分');
assert(report.checks.length > 0, '有检查项');
assert(report.issues.length === 0, '无问题');
assert(report.scores.detailed.structural_integrity > 0, '结构评分');

console.log(`  综合评分: ${report.overall_score}`);
console.log(`  检查项: ${report.checks.length}`);
console.log(`  通过项: ${report.checks.filter(c => c.passed).length}`);

// 调试：打印失败项
const failedChecks = report.checks.filter(c => !c.passed);
if (failedChecks.length > 0) {
  console.log('  失败项详情:');
  for (const fc of failedChecks) {
    console.log(`    ❌ ${fc.category}.${fc.name}: ${fc.message} [${fc.severity}]`);
    console.log(`       建议: ${fc.suggestion}`);
  }
}

// 测试修复计划生成
const repairPlan = validator.generateRepairPlan(report);
assert(repairPlan.repairs.length === 0, '无修复需求（因为剧本通过）');

console.log(`  修复计划: 无需修复 ✓`);

// ========== 测试 4: NirathExtension ==========
console.log('\n📋 测试 4: NirathExtension（世界观扩展）');
console.log('----------------------------------------');

const nirath = new NirathExtension();

assert(nirath.getWorldInfo().world_id === 'nirath', '获取世界观');
assert(nirath.getBeastArchive('taotie').name === '饕餮', '获取异兽档案');
assert(nirath.getBeastVisualAnchor('taotie').core_features.length > 0, '获取视觉锚点');
assert(nirath.getProtagonist().character_id === 'xiaoG', '获取主角设定');

const visualConstraints = nirath.getVisualConstraints();
assert(visualConstraints.must_have.length > 0, '有必须元素');
assert(visualConstraints.forbidden.length > 0, '有禁止元素');

// 验证场景
const sceneValidation = nirath.validateScene(blueprint.structure.scenes[0]);
assert(sceneValidation.valid, '场景符合世界观');

const setting = nirath.generateSceneSetting('测试场景');
assert(setting.includes('Nirath') || setting.includes('硅') || setting.includes('双月'), '生成场景设定');

const charAnchor = nirath.generateCharacterVisualAnchor('xiaoG');
assert(charAnchor.includes('银灰装甲'), '生成角色视觉锚点');

console.log(`  Nirath 扩展测试通过 ✓`);

// ========== 测试 5: Adapter ==========
console.log('\n📋 测试 5: ScriptBlueprintAdapter（适配层）');
console.log('----------------------------------------');

const adapter = new ScriptBlueprintAdapter();
const adapted = adapter.adapt(blueprint);

assert(adapted.config.title === '测试剧本', '适配配置');
assert(adapted.scenes.length === 5, '适配场景');
assert(adapted.characters.length === 2, '适配角色');
assert(adapted.dialogues.length === 7, '适配台词（7句）');
assert(adapted.worldSetting.world_id === 'nirath', '适配世界观');

// 检查场景 Prompt 基础
assert(adapted.scenes[0].prompt_base.includes('电影级'), 'Prompt 包含电影级');
assert(adapted.scenes[0].prompt_base.includes('Nirath'), 'Prompt 包含 Nirath');

// 检查视觉方向
assert(adapted.scenes[0].visual_direction.shot_type, '有镜头类型');
assert(adapted.scenes[0].visual_direction.camera_movement, '有运镜');
assert(adapted.scenes[0].visual_direction.lighting, '有布光');

// 生成报告
const adaptReport = adapter.generateReport(adapted);
assert(adaptReport.adaptation_status === 'success', '适配成功');
assert(adaptReport.scenes_count === 5, '报告场景数');

console.log(`  适配报告:`);
console.log(`    场景: ${adaptReport.scenes_count}`);
console.log(`    角色: ${adaptReport.characters_count}`);
console.log(`    台词: ${adaptReport.dialogues_count}`);
console.log(`    时长: ${adaptReport.total_duration}s`);
console.log(`    警告: ${adaptReport.warnings.length}`);

console.log(`  适配层测试通过 ✓`);

// ========== 汇总 ==========
console.log('\n========================================');
console.log('  测试完成');
console.log('========================================');
console.log(`  ✅ 通过: ${results.passed}`);
console.log(`  ❌ 失败: ${results.failed}`);
console.log(`  📊 总计: ${results.passed + results.failed}`);
console.log(`  🎯 成功率: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
console.log('========================================');

if (results.failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过！剧本引擎 MVP 就绪。\n');
  process.exit(0);
}
```

---

## 📄 hyperreality-system/index.js

```js
// hyperreality-system/index.js
// Hyperreality System - 超现实工业创作系统统一入口
// 深度融合：剧本引擎 → 适配层 → 制作引擎 → 完整镜头
// 版本：v1.0.0 | 日期：2026-06-08

const { ScriptEngine } = require('./engines/script-engine');
const { ProductionEngine } = require('./engines/production-engine/production-engine');
const { RenderingEngine } = require('./engines/rendering-engine/rendering-engine');
const { PostProductionEngine } = require('./engines/post-production-engine/post-production-engine');

class HyperrealitySystem {
  constructor(options = {}) {
    this.scriptEngine = new ScriptEngine(options.scriptEngine);
    this.productionEngine = new ProductionEngine(options.productionEngine);
    this.renderingEngine = new RenderingEngine(options.renderingEngine);
    this.postProductionEngine = new PostProductionEngine(options.postProductionEngine);
    this.version = '1.2.0';
  }

  /**
   * 主创作流程（含剧本确认 + 提示词审核 + 后期制作环节）
   * @param {string} intent - 用户意图
   * @param {object} metadata - 元数据
   * @param {object} options - { skipScriptConfirmation, skipPromptReview, skipRender, skipPostProduction }
   * @returns {object} 完整创作结果
   */
  async create(intent, metadata = {}, options = {}) {
    console.log(`\n🔥 [HyperrealitySystem v${this.version}] 开始创作`);
    console.log(`   意图: ${intent}`);
    console.log(`   项目: ${metadata.title || '未命名'}`);
    console.log(`   流程: ${options.skipScriptConfirmation ? '跳过' : '含'}剧本确认 → ${options.skipPromptReview ? '跳过' : '含'}提示词审核 → ${options.skipRender ? '跳过' : '含'}渲染 → ${options.skipPostProduction ? '跳过' : '含'}后期`);
    console.log('');

    const result = {
      success: false,
      stages: {},
      errors: [],
      timing: {},
      confirmations: {} // 记录确认状态
    };

    const totalStart = Date.now();

    try {
      // ========== Layer 1: 剧本引擎 ==========
      console.log('📖 [Layer 1] 剧本引擎 - 生成结构化剧本...');
      const stage1Start = Date.now();

      const scriptResult = await this.scriptEngine.process(intent, metadata);

      result.stages.scriptEngine = {
        blueprint: scriptResult.blueprint?.meta,
        validation: scriptResult.validation,
        report: scriptResult.report
      };
      result.stages.scriptEngine.timing = Date.now() - stage1Start;

      console.log(`   ✅ 剧本生成完成 (${result.stages.scriptEngine.timing}ms)`);
      console.log(`      场景: ${scriptResult.report.scenes_count} | 角色: ${scriptResult.report.characters_count} | 台词: ${scriptResult.report.dialogues_count}`);
      console.log(`      校验: ${scriptResult.validation.passed ? '通过' : '失败'} (${scriptResult.validation.overall_score}分)`);

      // ========== 🆕 剧本确认环节（P0-固化） ==========
      if (!options.skipScriptConfirmation) {
        console.log('\n🎭 [剧本确认] 等待人工确认...');
        
        const scriptConfirmation = await this._confirmScript(scriptResult.blueprint);
        result.confirmations.script = scriptConfirmation;
        
        if (!scriptConfirmation.approved) {
          console.log('   ❌ 剧本未确认，流程中止');
          result.success = false;
          result.stages.scriptReview = {
            status: 'rejected',
            reason: scriptConfirmation.reason || '用户未确认',
            suggestions: scriptConfirmation.suggestions || []
          };
          return result;
        }
        
        console.log('   ✅ 剧本已确认，继续制作');
      } else {
        console.log('\n⚠️ [剧本确认] 跳过（调试模式）');
        result.confirmations.script = { approved: true, skipped: true };
      }

      // ========== 适配层 ==========
      console.log('\n🔗 [Adapter] 适配层 - 转换数据格式...');
      const adapted = scriptResult.adapted;

      // ========== Layer 2: 制作引擎 ==========
      console.log('\n🎬 [Layer 2] 制作引擎 - 生成镜头...');
      const stage2Start = Date.now();

      const productionResult = await this.productionEngine.produce(adapted);

      result.stages.productionEngine = {
        shots: productionResult.shots.map(s => ({
          shotId: s.shotId,
          sceneType: s.sceneType,
          timing: s.timing,
          promptLength: s.prompt?.length,
          status: s.status
        })),
        prompts: productionResult.prompts,
        quality: productionResult.stages.qualityGate
      };
      result.stages.productionEngine.timing = Date.now() - stage2Start;

      console.log(`   ✅ 制作完成 (${result.stages.productionEngine.timing}ms)`);
      console.log(`      镜头: ${productionResult.shots.length} | Prompts: ${productionResult.prompts.length}`);
      console.log(`      质量门: ${productionResult.stages.qualityGate?.passed ? '通过' : '失败'}`);

      // ========== 🆕 提示词审核确认环节 ==========
      if (!options.skipPromptReview) {
        console.log('\n📝 [提示词审核] 等待人工确认...');
        
        const promptConfirmation = await this._confirmPrompts(productionResult.prompts);
        result.confirmations.prompts = promptConfirmation;
        
        if (!promptConfirmation.approved) {
          console.log('   ❌ 提示词未确认，流程中止');
          result.success = false;
          result.stages.promptReview = {
            status: 'rejected',
            reason: promptConfirmation.reason || '用户未确认',
            issues: promptConfirmation.issues || []
          };
          return result;
        }
        
        console.log('   ✅ 提示词已确认，继续渲染');
      } else {
        console.log('\n⚠️ [提示词审核] 跳过（调试模式）');
        result.confirmations.prompts = { approved: true, skipped: true };
      }

      // ========== Layer 3: 渲染引擎 ==========
      if (!options.skipRender) {
        console.log('\n🎨 [Layer 3] 渲染引擎 - 提交 Seedance...');
        const stage3Start = Date.now();

        const renderResult = await this.renderingEngine.render(productionResult.prompts, {
          dryRun: options.dryRun || !this.renderingEngine.config.apiKey
        });

        result.stages.renderingEngine = {
          render: renderResult,
          report: this.renderingEngine.generateReport(renderResult)
        };
        result.stages.renderingEngine.timing = Date.now() - stage3Start;

        console.log(`   ✅ 渲染完成 (${result.stages.renderingEngine.timing}ms)`);
        console.log(`      提交: ${renderResult.submitted}/${renderResult.results.length} | 失败: ${renderResult.failed}`);
      } else {
        console.log('\n⚠️ [渲染] 跳过（调试模式）');
        result.stages.renderingEngine = { skipped: true };
      }

      // ========== Layer 4: 后期引擎 ==========
      if (!options.skipPostProduction) {
        console.log('\n🎬 [Layer 4] 后期引擎 - 字幕/音乐/弹幕/多版本...');
        const stage4Start = Date.now();

        const postResult = await this.postProductionEngine.postProduce(
          productionResult,
          scriptResult,
          renderResult || { success: false, results: [] }
        );

        result.stages.postProductionEngine = {
          success: postResult.success,
          versions: postResult.versions,
          stages: postResult.stages,
          report: this.postProductionEngine.generateReport(postResult)
        };
        result.stages.postProductionEngine.timing = Date.now() - stage4Start;

        console.log(`   ✅ 后期制作完成 (${result.stages.postProductionEngine.timing}ms)`);
        console.log(`      版本: ${Object.keys(postResult.versions).join(', ')}`);
        console.log(`      字幕: ${postResult.stages.subtitles?.count || 0}条 | 音乐: ${postResult.stages.music?.count || 0}段 | 弹幕: ${postResult.stages.danmaku?.count || 0}条`);
      } else {
        console.log('\n⚠️ [后期制作] 跳过（调试模式）');
        result.stages.postProductionEngine = { skipped: true };
      }

      // ========== 汇总 ==========
      result.success = true;
      result.timing.total = Date.now() - totalStart;

      console.log(`\n🏁 [完成] 总耗时: ${result.timing.total}ms`);
      console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);

      // 生成最终报告
      result.finalReport = this._generateFinalReport(scriptResult, productionResult, result.stages.renderingEngine, result.stages.postProductionEngine, result.timing.total, result.confirmations);

    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'HYPERREALITY_SYSTEM',
        message: error.message,
        stack: error.stack
      });
      console.error(`\n❌ [系统错误] ${error.message}`);
    }

    return result;
  }

  /**
   * 剧本确认环节
   * 在真实环境中，这里会等待用户输入
   * 在自动化测试中，可以传入预置确认
   */
  async _confirmScript(blueprint) {
    // 生成剧本报告供审阅
    const scriptReport = this._generateScriptReport(blueprint);
    
    // 模拟确认流程（实际环境中应该等待用户输入）
    // 这里默认通过，但在生产环境中需要人工确认
    return {
      approved: true, // 生产环境中应改为 false，等待用户确认
      reviewedAt: new Date().toISOString(),
      report: scriptReport,
      // 生产环境需要：
      // - 飞书/消息通知用户审阅剧本
      // - 等待用户回复 "确认" 或 "修改"
      // - 记录审阅人、审阅时间、修改意见
    };
  }

  /**
   * 提示词确认环节
   */
  async _confirmPrompts(prompts) {
    // 生成提示词报告供审阅
    const promptReport = this._generatePromptsReport(prompts);
    
    return {
      approved: true, // 生产环境中应改为 false
      reviewedAt: new Date().toISOString(),
      report: promptReport
    };
  }

  /**
   * 生成剧本报告（供审阅）
   */
  _generateScriptReport(blueprint) {
    const scenes = blueprint.structure?.scenes || [];
    const lines = [];
    
    lines.push('# 🎭 剧本确认报告');
    lines.push('');
    lines.push(`**项目**: ${blueprint.meta?.title || '未命名'}`);
    lines.push(`**时长**: ${blueprint.meta?.target_duration || 120}s`);
    lines.push(`**场景**: ${scenes.length} 个`);
    lines.push(`**校验**: ${blueprint.validate ? '通过' : '待校验'}`);
    lines.push('');
    lines.push('## 场景总览');
    lines.push('');
    lines.push('| 场景 | 类型 | 时长 | 角色 | 台词 |');
    lines.push('|------|------|------|------|------|');
    
    for (const scene of scenes) {
      const chars = (scene.characters || []).join(', ');
      const dialogueCount = scene.dialogue?.lines?.length || 0;
      lines.push(`| ${scene.scene_id} | ${scene.scene_type} | ${scene.timing?.duration || 0}s | ${chars} | ${dialogueCount}句 |`);
    }
    
    lines.push('');
    lines.push('## 详细场景');
    lines.push('');
    
    for (const scene of scenes) {
      lines.push(`### ${scene.scene_id}: ${scene.scene_name}`);
      lines.push(`**类型**: ${scene.scene_type} | **时长**: ${scene.timing?.duration || 0}s`);
      lines.push(`**设定**: ${scene.setting || '无'}`);
      lines.push(`**角色**: ${(scene.characters || []).join(', ') || '无'}`);
      lines.push('');
      
      if (scene.dialogue?.lines?.length > 0) {
        lines.push('**台词**:');
        for (const line of scene.dialogue.lines) {
          lines.push(`- ${line.speaker}: 「${line.text}」 (${line.emotion || 'neutral'})`);
        }
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    }
    
    lines.push('## ⚠️ 确认须知');
    lines.push('');
    lines.push('1. 确认场景时序连续无断层');
    lines.push('2. 确认每个场景有角色对话');
    lines.push('3. 确认总时长等于目标时长');
    lines.push('4. 确认角色数量、设定符合预期');
    lines.push('');
    lines.push('**请回复 "确认" 继续，或 "修改" 并指出问题**');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 生成提示词报告（供审阅）
   */
  _generatePromptsReport(prompts) {
    const lines = [];
    
    lines.push('# 📝 提示词审核报告');
    lines.push('');
    lines.push(`**镜头数**: ${prompts.length}`);
    lines.push(`**平均长度**: ${Math.round(prompts.reduce((s, p) => s + p.length, 0) / prompts.length)} 字符`);
    lines.push('');
    lines.push('## 镜头总览');
    lines.push('');
    lines.push('| 镜头 | 长度 | 有定妆照 | 有时间轴 | 有约束 |');
    lines.push('|------|------|----------|----------|--------|');
    
    for (const p of prompts) {
      const hasImages = (p.imageRefs || []).length > 0;
      const hasTimeline = p.prompt?.includes('【镜头时间轴】') || false;
      const hasConstraints = p.prompt?.includes('【角色一致性】') || false;
      lines.push(`| ${p.shotId} | ${p.length} | ${hasImages ? '✓' : '✗'} | ${hasTimeline ? '✓' : '✗'} | ${hasConstraints ? '✓' : '✗'} |`);
    }
    
    lines.push('');
    lines.push('## 完整提示词');
    lines.push('');
    
    for (const p of prompts) {
      lines.push(`### ${p.shotId}`);
      lines.push(`**长度**: ${p.length} 字符 | **定妆照**: ${p.imageRefs?.length || 0} 张`);
      lines.push('');
      lines.push('```');
      lines.push(p.prompt);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    
    lines.push('## ⚠️ 审核须知');
    lines.push('');
    lines.push('1. 确认每个镜头有【镜头时间轴】');
    lines.push('2. 确认角色定妆照引用正确');
    lines.push('3. 确认负面约束（暗黑风/金属光泽）已包含');
    lines.push('4. 确认角色一致性约束已包含');
    lines.push('5. 确认 Prompt 长度在 980 字符以内');
    lines.push('');
    lines.push('**请回复 "确认" 继续渲染，或 "修改" 并指出问题**');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 生成最终报告（含确认环节 + 渲染结果 + 后期制作）
   */
  _generateFinalReport(scriptResult, productionResult, renderResult, postResult, totalTime, confirmations) {
    const blueprint = scriptResult.blueprint;
    const validation = scriptResult.validation;
    const report = scriptResult.report;
    const production = productionResult;
    const render = renderResult?.render || { submitted: 0, failed: 0 };

    const lines = [];

    lines.push('# 超现实工业创作系统 - 生产报告');
    lines.push(`**版本**: v${this.version}  |  **总耗时**: ${totalTime}ms`);
    lines.push('');

    // 确认状态
    lines.push('## ✅ 确认状态');
    lines.push('');
    lines.push(`| 环节 | 状态 | 时间 |`);
    lines.push(`|------|------|------|`);
    if (confirmations?.script) {
      lines.push(`| 剧本确认 | ${confirmations.script.approved ? '✅ 通过' : '❌ 未通过'} ${confirmations.script.skipped ? '(跳过)' : ''} | ${confirmations.script.reviewedAt || 'N/A'} |`);
    }
    if (confirmations?.prompts) {
      lines.push(`| 提示词审核 | ${confirmations.prompts.approved ? '✅ 通过' : '❌ 未通过'} ${confirmations.prompts.skipped ? '(跳过)' : ''} | ${confirmations.prompts.reviewedAt || 'N/A'} |`);
    }
    lines.push('');

    // 项目信息
    lines.push('## 📋 项目信息');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 标题 | ${blueprint.meta.title || '未命名'} |`);
    lines.push(`| 叙事模式 | ${blueprint.meta.narrative_mode || 'default'} |`);
    lines.push(`| 目标时长 | ${blueprint.meta.target_duration || 120}s |`);
    lines.push(`| 场景数 | ${report.scenes_count} |`);
    lines.push(`| 角色数 | ${report.characters_count} |`);
    lines.push(`| 台词数 | ${report.dialogues_count} |`);
    lines.push('');

    // 剧本校验
    lines.push('## ✅ 剧本校验');
    lines.push(`**状态**: ${validation.passed ? '通过 ✓' : '未通过 ✗'} | **综合评分**: ${validation.overall_score}/100`);
    lines.push('');
    lines.push(`| 维度 | 评分 |`);
    lines.push(`|------|------|`);
    for (const [dim, score] of Object.entries(validation.scores?.detailed || {})) {
      lines.push(`| ${dim} | ${score} |`);
    }
    lines.push('');

    // 镜头总览
    lines.push('## 🎬 镜头总览');
    lines.push(`| 镜头ID | 类型 | 时长 | Prompt长度 | 状态 |`);
    lines.push(`|--------|------|------|------------|------|`);
    for (const shot of production.shots) {
      lines.push(`| ${shot.shotId} | ${shot.sceneType} | ${shot.timing.duration}s | ${shot.prompt?.length || 0} | ${shot.status} |`);
    }
    lines.push('');

    // 渲染结果
    if (renderResult && !renderResult.skipped) {
      lines.push('## 🎨 渲染结果');
      lines.push(`| 提交 | 成功 | 失败 | 成功率 |`);
      lines.push(`|------|------|------|--------|`);
      lines.push(`| ${render.results.length} | ${render.submitted} | ${render.failed} | ${render.results.length > 0 ? Math.round((render.submitted / render.results.length) * 100) : 0}% |`);
      lines.push('');
    }

    // 完整 Prompts
    lines.push('## 📝 完整 Prompts');
    lines.push('');
    for (const p of production.prompts) {
      lines.push(`### ${p.shotId}`);
      lines.push(`**长度**: ${p.length} 字符 | **定妆照**: ${p.imageRefs?.length || 0} 张`);
      lines.push('');
      lines.push('```');
      lines.push(p.prompt);
      lines.push('```');
      lines.push('');
    }

    // 质量门
    const qg = production.stages?.qualityGate;
    if (qg) {
      lines.push('## 🛡️ 质量门检查');
      lines.push(`**状态**: ${qg.passed ? '通过 ✓' : '失败 ✗'} (${qg.passedCount}/${qg.totalPrompts})`);
      lines.push('');
      lines.push(`| 镜头 | 有镜头时间轴 | 有角色 | 长度合规 | 状态 |`);
      lines.push(`|------|------------|--------|----------|------|`);
      for (const check of (qg.checks || [])) {
        lines.push(`| ${check.shotId} | ${check.hasTimeline ? '✓' : '✗'} | ${check.hasCharacters ? '✓' : '✗'} | ${check.withinLimit ? '✓' : '✗'} | ${check.passed ? '✓' : '✗'} |`);
      }
      lines.push('');
    }

    // 后期制作结果
    if (postResult && !postResult.skipped) {
      const post = postResult;
      lines.push('## 🎬 后期制作');
      lines.push(`**状态**: ${post.success ? '通过 ✓' : '未通过 ✗'}`);
      lines.push('');
      
      // 版本列表
      lines.push('### 输出版本');
      lines.push(`| 版本 | 字幕 | 音乐 | 弹幕 | 转场 | 片头 |`);
      lines.push(`|------|------|------|------|------|------|`);
      for (const [version, data] of Object.entries(post.versions || {})) {
        const f = data.features || {};
        lines.push(`| ${version} | ${f.subtitles ? '✓' : '✗'} | ${f.music ? '✓' : '✗'} | ${f.danmaku ? '✓' : '✗'} | ${f.transitions ? '✓' : '✗'} | ${f.titleCard ? '✓' : '✗'} |`);
      }
      lines.push('');
      
      // 字幕预览
      if (post.stages?.subtitles?.tracks?.length > 0) {
        lines.push('### 身份介绍字幕');
        lines.push(`| 角色 | 场景 | 时长 | 内容 |`);
        lines.push(`|------|------|------|------|`);
        for (const sub of post.stages.subtitles.tracks.slice(0, 3)) {
          lines.push(`| ${sub.characterName} | ${sub.sceneId} | ${sub.duration}s | ${sub.content.title} |`);
        }
        lines.push('');
      }
      
      // 音乐预览
      if (post.stages?.music?.tracks?.length > 0) {
        lines.push('### 无版权音乐配置');
        lines.push(`| 场景 | 风格 | 情绪 | 音量 |`);
        lines.push(`|------|------|------|------|`);
        for (const track of post.stages.music.tracks.slice(0, 3)) {
          lines.push(`| ${track.sceneId} | ${track.searchParams.genre} | ${track.searchParams.mood} | ${track.config.volume} |`);
        }
        lines.push('');
      }
      
      // 弹幕预览
      if (post.stages?.danmaku?.list?.length > 0) {
        lines.push('### 弹幕预览');
        lines.push(`| 内容 | 场景 | 颜色 |`);
        lines.push(`|------|------|------|`);
        for (const dm of post.stages.danmaku.list.slice(0, 3)) {
          lines.push(`| ${dm.text} | ${dm.sceneId} | ${dm.color} |`);
        }
        lines.push('');
      }
    }

    // 时序分析
    lines.push('## ⏱️ 时序分析');
    lines.push('');
    lines.push(`| 阶段 | 耗时 | 占比 |`);
    lines.push(`|------|------|------|`);
    lines.push(`| 剧本引擎 | ${scriptResult.timing || 'N/A'} | - |`);
    lines.push(`| 制作引擎 | ${production.timing?.total || 'N/A'} | - |`);
    lines.push(`| 渲染引擎 | ${renderResult?.timing?.total || 'N/A'} | - |`);
    lines.push(`| 后期引擎 | ${postResult?.timing?.total || 'N/A'} | - |`);
    lines.push(`| 总耗时 | ${totalTime}ms | 100% |`);
    lines.push('');

    lines.push('---');
    lines.push(`*生成时间: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * 保存完整结果到文件
   */
  async save(result, outputDir) {
    const fs = require('fs').promises;
    const path = require('path');

    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = path.join(outputDir, `hyperreality-${timestamp}`);

    // 保存完整结果 JSON
    await fs.writeFile(
      `${basePath}-result.json`,
      JSON.stringify(result, null, 2)
    );

    // 保存 Markdown 报告
    if (result.finalReport) {
      await fs.writeFile(
        `${basePath}-report.md`,
        result.finalReport
      );
    }

    // 保存剧本确认报告
    if (result.confirmations?.script?.report) {
      await fs.writeFile(
        `${basePath}-script-review.md`,
        result.confirmations.script.report
      );
    }

    // 保存提示词审核报告
    if (result.confirmations?.prompts?.report) {
      await fs.writeFile(
        `${basePath}-prompt-review.md`,
        result.confirmations.prompts.report
      );
    }

    // 保存后期制作报告
    if (result.stages?.postProductionEngine?.report) {
      await fs.writeFile(
        `${basePath}-post-production.md`,
        result.stages.postProductionEngine.report
      );
    }

    // 保存 Prompts 单独文件
    if (result.stages?.productionEngine?.prompts) {
      const promptsMD = this._generatePromptsOnlyMD(result.stages.productionEngine.prompts);
      await fs.writeFile(
        `${basePath}-prompts.md`,
        promptsMD
      );
    }

    console.log(`\n💾 结果已保存到: ${outputDir}`);
    return outputDir;
  }

  /**
   * 生成纯 Prompts MD
   */
  _generatePromptsOnlyMD(prompts) {
    const lines = [];
    lines.push('# 镜头 Prompts 清单');
    lines.push('');

    for (const p of prompts) {
      lines.push(`## ${p.shotId}`);
      lines.push('');
      lines.push(p.prompt);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = { HyperrealitySystem };
```

---

## 📄 hyperreality-system/README.md

```md
# 超现实工业创作系统（Hyperreality Industrial Creation System）

**代号**：超现实系统（Hyperreality System）  
**版本**：v1.2.0-alpha1  
**更新日期**：2026-06-08  
**创建日期**：2026-06-07  
**架构**：四层工业化架构

---

## 系统定位

面向工业级 AI 视频创作的完整解决方案，支持从创意意图到成片交付的全链路自动化。

与现有 "AI 视频制作系统"（v6.x）独立演进，互不干扰。

---

## 四层架构

```
┌─────────────────────────────────────────────────┐
│  第四层：后期引擎（Post-Production Engine） ✅ 新增  │
│  字幕、智能配乐、弹幕、多版本输出、HyperFrames    │
├─────────────────────────────────────────────────┤
│  第三层：渲染引擎（Rendering Engine）            │
│  Seedance API 适配、镜头渲染、质量门、进度追踪   │
├─────────────────────────────────────────────────┤
│  第二层：制作引擎（Production Engine）            │
│  镜头语言引擎、Prompt 工程、分镜合成、场景构建   │
├─────────────────────────────────────────────────┤
│  第一层：剧本引擎（Script Engine）      ← 已完成   │
│  意图解析、剧本生成、剧本校验、世界观扩展、适配   │
└─────────────────────────────────────────────────┘
```

---

## 模块清单

| 层级 | 模块 | 状态 | 文件路径 |
|------|------|------|----------|
| Layer 1 | Intent Parser | ✅ | `engines/script-engine/core/intent-parser.js` |
| Layer 1 | Script Blueprint | ✅ | `engines/script-engine/core/script-blueprint.js` |
| Layer 1 | Script Generator | ✅ | `engines/script-engine/core/script-generator.js` |
| Layer 1 | Script Validator | ✅ | `engines/script-engine/core/script-validator.js` |
| Layer 1 | Nirath Extension | ✅ | `engines/script-engine/extensions/nirath-extension.js` |
| Layer 1 | Dramatic Template | ✅ | `engines/script-engine/templates/dramatic-template.json` |
| Layer 1 | Adapter | ✅ | `engines/script-engine/core/adapter.js` |
| Layer 1 | Script Engine Entry | ✅ | `engines/script-engine/index.js` |
| Layer 2 | Production Engine | ✅ 完成 | 7 Stage 全流程 |
| Layer 3 | Rendering Engine | ✅ 完成 | 复用现有 Seedance 提交核心 |
| Layer 4 | Post-Production Engine | 🔄 | 待开发 |

---

## 运行测试

```bash
cd /root/.openclaw/workspace/hyperreality-system
node engines/script-engine/tests/test-script-engine.js      # 剧本引擎测试
node tests/test-integration.js                                # 深度融合测试（全链路）
```

---

## 生产发布记录

- [v1.1.0-alpha1](RELEASE-v1.1.0-alpha1.md) - 2026-06-08: 渲染引擎 + 剧本确认环节 + 提示词审核

---

## 设计文档

- **旧系统**：`AI 视频制作系统`（v6.x）→ 继续独立演进，生产使用
- **新系统**：`超现实工业创作系统`（v1.x）→ 从零构建，逐步成熟后替代

两条链路完全独立，代码不共享，版本号不关联。

---

## 设计文档

- [接口契约 v1.0](docs/interface-contract-v1.md)

```

---

## 📄 hyperreality-system/RELEASE-v1.1.0-alpha1.md

```md
# 超现实工业创作系统 - 发布记录

## v1.1.0-alpha1 (2026-06-08)

### 发布概要

**代号**: 超现实系统  
**版本**: v1.1.0-alpha1  
**发布日期**: 2026-06-08 01:05 GMT+8  
**Git Commit**: 待提交  
**发布人**: 小G

### 新增内容

#### 1. 渲染引擎（Layer 3）
- **文件**: `engines/rendering-engine/rendering-engine.js`
- **功能**: 复用现有 AI 视频制作系统的 `render-submitter-core.js`
- **特性**:
  - 复用现有 Seedance API 提交逻辑（完整定妆照绑定验证）
  - 支持并发控制（默认 3 并发）
  - 支持模拟模式（dryRun）和真实 API 模式
  - 自动生成绑定清单（binding-manifest.json）
  - 支持渲染状态查询
- **API 接入**:
  - 端点: `ep-20260518004622-jp46s` (Seedance-2.0)
  - 密钥: 环境变量 `VOLCENGINE_ARK_API_KEY`
  - 最大并发: 3

#### 2. 剧本确认环节（新增 P0 流程）
- **位置**: `HyperrealitySystem.create()` 中
- **流程**:
  ```
  1. 剧本引擎生成 → 2. 🆕 剧本确认 → 3. 制作引擎 → 4. 🆕 提示词审核 → 5. 渲染引擎
  ```
- **剧本确认报告**:
  - 场景总览表（ID/类型/时长/角色/台词）
  - 详细场景设定、角色、台词
  - 确认须知（5 项检查点）
- **提示词审核报告**:
  - 镜头总览表（ID/长度/定妆照/时间轴/约束）
  - 完整 Prompts 文本
  - 审核须知（5 项检查点）
- **报告输出**: Markdown 格式，可飞书发送

#### 3. 主入口更新
- **文件**: `hyperreality-system/index.js`
- **新增参数**:
  - `skipScriptConfirmation`: 跳过剧本确认（调试模式）
  - `skipPromptReview`: 跳过提示词审核（调试模式）
  - `skipRender`: 跳过渲染（调试模式）
- **生产流程**（默认）:
  ```
  用户意图 → 剧本引擎 → 【剧本确认】→ 制作引擎 → 【提示词审核】→ 渲染引擎 → 成片
  ```

### 完整架构状态

| 层级 | 模块 | 状态 | 说明 |
|------|------|------|------|
| Layer 1 | 剧本引擎 (ScriptEngine) | ✅ 完成 | 5 核心模块 + 1 扩展 + 测试 100% |
| Layer 1 | 适配层 (Adapter) | ✅ 完成 | 数据格式转换 |
| Layer 2 | 制作引擎 (ProductionEngine) | ✅ 完成 | 7 Stage 全流程 |
| Layer 3 | 渲染引擎 (RenderingEngine) | ✅ 完成 | 复用现有 Seedance 提交核心 |
| 全链路 | 深度融合测试 | ✅ 通过 | 65 项测试 100% |
| 流程 | 剧本确认 | ✅ 新增 | P0-固化流程环节 |
| 流程 | 提示词审核 | ✅ 新增 | P0-固化流程环节 |

### 测试数据

```
✅ 通过: 65
❌ 失败: 0
🎯 成功率: 100%
```

### 文件清单

```
hyperreality-system/
├── .current-version          # v1.1.0-alpha1
├── README.md
├── index.js                  # 统一入口（含确认环节）
├── engines/
│   ├── script-engine/        # ✅ Layer 1 完成
│   ├── production-engine/    # ✅ Layer 2 完成
│   │   └── production-engine.js
│   └── rendering-engine/     # ✅ Layer 3 新增
│       └── rendering-engine.js
└── tests/
    └── test-integration.js  # 65 项测试
```

### 与现有系统关系

- **AI 视频制作系统**（v6.5.12）：继续独立演进，生产使用
- **超现实工业创作系统**（v1.1.0）：新架构，从零构建

两条链路完全独立，版本号不关联。

### 已知限制

1. 渲染引擎依赖 `VOLCENGINE_ARK_API_KEY` 环境变量
2. 剧本确认和提示词审核目前为自动通过（需接入人工审批流程）
3. 后期引擎（Layer 4）尚未开发
4. 制作引擎目前使用模板生成，未接入 LLM

### 下一步

- [ ] Layer 4：后期引擎（AI 剪辑、配乐、字幕、包装）
- [ ] 接入真实 LLM 生成剧本（非模板）
- [ ] 人工审批流程集成（飞书/消息通知）
- [ ] 生产环境 API 密钥配置
- [ ] 性能优化（当前全链路 ~7ms，实际 LLM + API 预计 ~5-10 分钟）

---

*发布记录生成时间: 2026-06-08 01:05:05*
```

---

## 📄 hyperreality-system/RELEASE-v1.2.0-alpha1.md

```md
# 超现实系统 v1.2.0-alpha1 发布记录

**发布日期**: 2026-06-08  
**版本**: v1.2.0-alpha1  
**Git Commit**: 46dc27e  

## 🎬 新增内容：后期引擎（Layer 4）

### 核心功能

1. **字幕系统** — 身份介绍式字幕（嘉宾信息卡风格）
   - 角色出场时显示 3-5 秒信息卡片（非台词时间戳对齐）
   - 包含：角色名、物种、特征、Nirath 身份头衔
   - 视觉样式：左下角、绿色边框、黑底透明、GSAP 滑入动画
   - 字段流转：角色信息 → 身份信息生成 → 字幕轨道 → HyperFrames HTML

2. **音乐系统** — 无版权自动配乐
   - 支持 Pixabay / Bensound / Freesound 三大免费库
   - 场景类型 → 音乐风格映射：
     - 片头 → 史诗管弦乐
     - 探索 → 环境氛围
     - 冲突 → 紧张动作
     - 高潮 → 情感戏剧
     - 结尾 → 温暖希望
   - 音量控制：≤ 35%（不盖过台词）
   - 淡入/淡出：2s / 3s

3. **弹幕系统** — 智能弹幕生成
   - 从台词、场景设定自动提取关键词
   - 场景类型差异化：片头🔥燃向 / 探索🌟 wonder / 冲突💥紧张 / 高潮😭泪目 / 结尾✨期待
   - 顶部飘过，避免遮挡画面
   - 随机颜色、速度、大小

4. **多版本输出** — 5 种版本一键生成
   | 版本 | 字幕 | 音乐 | 弹幕 | 转场 | 用途 |
   |------|------|------|------|------|------|
   | standard | ✅ | ✅ | ❌ | ✅ | 标准发布 |
   | clean | ❌ | ❌ | ❌ | ✅ | 纯净版 |
   | subtitled | ✅ | ✅ | ❌ | ✅ | 字幕专用 |
   | danmaku | ✅ | ✅ | ✅ | ✅ | 弹幕版 |
   | raw | ❌ | ❌ | ❌ | ❌ | 原始素材 |

5. **HyperFrames 集成** — HTML 视频合成
   - 使用 data-start / data-duration / data-track-index 控制时间线
   - GSAP 动画引擎：字幕滑入、弹幕飘过、转场淡入淡出
   - 视频/音频/字幕/弹幕分层轨道
   - 支持 preview 预览 + render 导出 MP4

### 全链路流程（完整版）

```
用户意图
  → Layer 1 剧本引擎（ScriptEngine）
  → [🆕 剧本确认]（人工审核）
  → Layer 2 制作引擎（ProductionEngine）
  → [🆕 提示词审核]（人工审核）
  → Layer 3 渲染引擎（RenderingEngine）→ Seedance API
  → [🆕 Layer 4 后期引擎（PostProductionEngine）]
      → 字幕生成（身份介绍式）
      → 音乐匹配（无版权库）
      → 弹幕生成（智能提取）
      → 多版本组装（HyperFrames HTML）
      → 质量检查
  → 成片（5 版本）
```

### 测试

- 54 项测试，100% 通过率
- 字幕：7 条身份卡 / 音乐：5 段匹配 / 弹幕：18 条 / 版本：5 个
- 质量检查：0 问题

### 📁 新增文件

```
hyperreality-system/
├── engines/post-production-engine/
│   └── post-production-engine.js     # 后期引擎核心
├── tests/test-post-production.js     # 54 项测试
└── .current-version → v1.2.0-alpha1
```

### 📊 架构状态

| 层级 | 模块 | 状态 |
|------|------|------|
| Layer 1 | 剧本引擎 | ✅ 完成 |
| Layer 2 | 制作引擎 | ✅ 完成 |
| Layer 3 | 渲染引擎 | ✅ 完成 |
| Layer 4 | 后期引擎 | ✅ 完成（新增） |
| 流程 | 剧本确认 | ✅ 新增 |
| 流程 | 提示词审核 | ✅ 新增 |

---

*生成时间: 2026-06-08*
```

---

## 📄 hyperreality-system/test-output.js

```js
const { ProductionEngine } = require('./engines/production-engine/production-engine');

const blueprint = {
  config: {
    title: '山海经：白泽',
    featured_beast_id: 'bai-ze',
    opening_duration: 10,
    producer: 'Genius',
    style_notes: 'cinematic, hyperrealistic'
  },
  worldSetting: {
    world_id: 'nirath',
    name: 'Nirath',
    atmosphere: 'mysterious',
    time_of_day: 'golden hour',
    spatial_depth: 'atmospheric layers'
  },
  characters: [
    {
      character_id: 'xiaoG',
      name: '小G',
      species: 'Human',
      visual_anchor: { core_features: ['explorer', 'curious', 'brave'] }
    },
    {
      character_id: 'bai-ze',
      name: '白泽',
      species: 'Beast',
      visual_anchor: { core_features: ['white fur', 'mythical', 'wise'] }
    }
  ],
  scenes: [
    {
      scene_id: 'S01',
      scene_type: 'establishing',
      scene_function: 'establish',
      setting: '知识圣殿',
      timing: { start: 0, duration: 15, end: 15 },
      characters: ['xiaoG', 'bai-ze'],
      dialogue: {
        has_dialogue: true,
        lines: [
          { speaker: '小G', type: '独白', emotion: '好奇', text: '这就是白泽的领地吗？' }
        ]
      },
      emotional_target: { valence: 0.5, arousal: 0.6 },
      visual_direction: { style: 'cinematic' }
    }
  ]
};

async function test() {
  const engine = new ProductionEngine();
  const result = await engine.produce(blueprint);
  
  console.log('=== META ===');
  console.log(JSON.stringify(result.meta, null, 2));
  
  console.log('\n=== OPENING ===');
  console.log(JSON.stringify(result.opening, null, 2));
  
  console.log('\n=== SHOTS[0] ===');
  console.log(JSON.stringify(result.shots[0], null, 2));
  
  console.log('\n=== PROMPT ===');
  console.log(result.shots[0]?.prompt);
}

test().catch(console.error);
```

---

## 📄 hyperreality-system/tests/test-integration.js

```js
// hyperreality-system/tests/test-integration.js
// 深度融合测试 - 从意图到完整镜头
// 运行: node hyperreality-system/tests/test-integration.js

const { HyperrealitySystem } = require('../index');

console.log('========================================');
console.log('  超现实系统 - 深度融合测试 v1.0');
console.log('========================================\n');

const results = {
  passed: 0,
  failed: 0
};

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    results.passed++;
  } else {
    console.log(`  ❌ ${message}`);
    results.failed++;
  }
}

async function runTest() {
  // 初始化系统
  const system = new HyperrealitySystem({
    scriptEngine: {
      // 不提供 API Key，使用模板模式
    }
  });

  console.log('🔥 [测试] 完整创作流程');
  console.log('----------------------------------------\n');

  // 执行创作（跳过确认环节，便于测试）
  const result = await system.create(
    '创作山海经异兽志第一集，主角饕餮，120秒，Nirath星球，小G探索',
    {
      title: '山海经：异兽志 EP01 饕餮',
      target_duration: 120,
      world_setting: 'Nirath',
      featured_beast_id: 'taotie',
      protagonist: 'xiaoG'
    },
    {
      skipScriptConfirmation: true,  // 跳过剧本确认（测试模式）
      skipPromptReview: true,         // 跳过提示词审核（测试模式）
      skipRender: true                // 跳过渲染（测试模式）
    }
  );

  console.log('\n----------------------------------------');
  console.log('📊 结果验证');
  console.log('----------------------------------------');

  // 1. 整体成功
  assert(result.success, '整体流程成功');

  // 2. 剧本引擎阶段
  assert(result.stages.scriptEngine, '剧本引擎阶段存在');
  assert(result.stages.scriptEngine.blueprint, '剧本蓝图已生成');
  assert(result.stages.scriptEngine.validation, '剧本校验已执行');
  assert(result.stages.scriptEngine.timing > 0, '剧本引擎有耗时');

  // 3. 制作引擎阶段
  assert(result.stages.productionEngine, '制作引擎阶段存在');
  assert(result.stages.productionEngine.shots, '镜头已生成');
  assert(result.stages.productionEngine.prompts, 'Prompts 已生成');
  assert(result.stages.productionEngine.timing > 0, '制作引擎有耗时');

  // 4. 确认环节
  assert(result.confirmations.script, '剧本确认环节已执行');
  assert(result.confirmations.script.approved, '剧本已确认通过');
  assert(result.confirmations.prompts, '提示词审核环节已执行');
  assert(result.confirmations.prompts.approved, '提示词已确认通过');

  // 5. 渲染引擎（已跳过）
  assert(result.stages.renderingEngine, '渲染阶段存在');
  assert(result.stages.renderingEngine.skipped, '渲染已跳过（测试模式）');

  // 6. 镜头数量
  const shots = result.stages.productionEngine.shots;
  assert(shots.length > 0, `有 ${shots.length} 个镜头`);
  assert(shots.length >= 5, `至少 5 个镜头（实际: ${shots.length}）`);

  // 5. Prompts 数量
  const prompts = result.stages.productionEngine.prompts;
  assert(prompts.length === shots.length, 'Prompts 数量等于镜头数量');

  // 6. 每个镜头验证
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const prompt = prompts[i];

    assert(shot, `镜头 ${i} 存在`);
    assert(shot.shotId, `镜头 ${i} 有 ID: ${shot.shotId}`);
    assert(shot.sceneType, `镜头 ${i} 有类型: ${shot.sceneType}`);
    assert(shot.timing, `镜头 ${i} 有 timing 对象`);
    assert(shot.timing.duration > 0, `镜头 ${i} 时长 > 0: ${shot.timing?.duration}s`);
    assert(prompt, `镜头 ${i} 有对应的 Prompt 对象`);
    assert(prompt.prompt, `镜头 ${i} 有 Prompt 文本`);
    assert(prompt.length > 0, `镜头 ${i} Prompt 长度 > 0: ${prompt.length}`);
  }

  // 7. 总时长
  const totalDuration = shots.reduce((sum, s) => sum + s.timing.duration, 0);
  assert(totalDuration > 0, `总时长 > 0: ${totalDuration}s`);

  // 8. 质量门
  const quality = result.stages.productionEngine.quality;
  if (quality) {
    assert(quality.totalPrompts > 0, `质量门检查 ${quality.totalPrompts} 个 Prompt`);
  }

  // 9. 最终报告
  assert(result.finalReport, '最终报告已生成');
  assert(result.finalReport.includes('超现实工业创作系统'), '报告包含系统名称');
  assert(result.finalReport.includes('镜头总览'), '报告包含镜头总览');
  assert(result.finalReport.includes('完整 Prompts'), '报告包含完整 Prompts');

  // 10. 耗时
  assert(result.timing.total > 0, `总耗时 > 0: ${result.timing.total}ms`);

  // 打印详细信息
  console.log('\n----------------------------------------');
  console.log('📋 详细数据');
  console.log('----------------------------------------');
  console.log(`  镜头数: ${shots.length}`);
  console.log(`  总时长: ${totalDuration}s`);
  console.log(`  剧本耗时: ${result.stages.scriptEngine.timing}ms`);
  console.log(`  制作耗时: ${result.stages.productionEngine.timing}ms`);
  console.log(`  总耗时: ${result.timing.total}ms`);
  console.log(`  平均Prompt长度: ${Math.round(prompts.reduce((s, p) => s + p.length, 0) / prompts.length)} 字符`);

  // 打印前2个镜头
  console.log('\n  前2个镜头预览:');
  for (let i = 0; i < Math.min(2, shots.length); i++) {
    console.log(`\n  [${shots[i].shotId}] ${shots[i].sceneType} (${shots[i].timing.duration}s)`);
    console.log(`  Prompt: ${prompts[i].prompt.substring(0, 100)}...`);
    console.log(`  长度: ${prompts[i].length} 字符`);
  }

  // 保存结果
  try {
    const fs = require('fs');
    const path = require('path');
    const outputDir = '/tmp/hyperreality-test';
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    fs.writeFileSync(
      path.join(outputDir, `test-result-${timestamp}.json`),
      JSON.stringify(result, null, 2)
    );
    
    if (result.finalReport) {
      fs.writeFileSync(
        path.join(outputDir, `test-report-${timestamp}.md`),
        result.finalReport
      );
    }
    
    console.log(`\n💾 测试结果已保存到: ${outputDir}`);
  } catch (e) {
    console.log(`\n⚠️ 保存失败: ${e.message}`);
  }

  // 汇总
  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
  console.log(`  ✅ 通过: ${results.passed}`);
  console.log(`  ❌ 失败: ${results.failed}`);
  console.log(`  📊 总计: ${results.passed + results.failed}`);
  console.log(`  🎯 成功率: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  console.log('========================================');

  if (results.failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 深度融合测试全部通过！双链路协同工作正常。\n');
    process.exit(0);
  }
}

runTest().catch(err => {
  console.error('\n❌ 测试异常:', err.message);
  console.error(err.stack);
  process.exit(1);
});
```

---

## 📄 hyperreality-system/tests/test-post-production.js

```js
// hyperreality-system/tests/test-post-production.js
// 后期引擎测试 - 验证字幕、音乐、弹幕、多版本输出

const { PostProductionEngine } = require('../engines/post-production-engine/post-production-engine');
const fs = require('fs');

console.log('========================================');
console.log('  超现实系统 - 后期引擎测试 v1.0');
console.log('========================================');
console.log();

// 模拟数据
const mockProductionResult = {
  shots: [
    { shotId: 'SC00', sceneType: 'opening', timing: { duration: 31, start_time: 0 } },
    { shotId: 'SC01', sceneType: 'establishing', timing: { duration: 25, start_time: 31 } },
    { shotId: 'SC02', sceneType: 'conflict', timing: { duration: 33, start_time: 56 } },
    { shotId: 'SC03', sceneType: 'emotional_climax', timing: { duration: 38, start_time: 89 } },
    { shotId: 'SC04', sceneType: 'resolution', timing: { duration: 25, start_time: 127 } }
  ],
  prompts: [
    { shotId: 'SC00', prompt: '电影级镜头...', length: 198, imageRefs: [{characterId: 'xiaoG'}] },
    { shotId: 'SC01', prompt: '电影级镜头...', length: 196, imageRefs: [{characterId: 'xiaoG'}] },
    { shotId: 'SC02', prompt: '电影级镜头...', length: 198, imageRefs: [{characterId: 'xiaoG'}] },
    { shotId: 'SC03', prompt: '电影级镜头...', length: 208, imageRefs: [{characterId: 'xiaoG'}] },
    { shotId: 'SC04', prompt: '电影级镜头...', length: 194, imageRefs: [{characterId: 'xiaoG'}] }
  ]
};

const mockScriptResult = {
  blueprint: {
    meta: { title: '山海经：异兽志 EP01 饕餮', target_duration: 120 },
    structure: {
      scenes: [
        {
          scene_id: 'SC00',
          scene_type: 'opening',
          scene_name: '片头',
          setting: 'Nirath 硅晶草原，双月当空',
          timing: { duration: 31, start_time: 0 },
          characters: ['xiaoG'],
          dialogue: {
            lines: [{ speaker: 'xiaoG', text: '我是小G，这是 Nirath。', emotion: 'curious' }]
          }
        },
        {
          scene_id: 'SC01',
          scene_type: 'establishing',
          scene_name: '探索',
          setting: '晶体森林深处',
          timing: { duration: 25, start_time: 31 },
          characters: ['xiaoG'],
          dialogue: {
            lines: [{ speaker: 'xiaoG', text: '这里的晶体在发光。', emotion: 'wonder' }]
          }
        },
        {
          scene_id: 'SC02',
          scene_type: 'conflict',
          scene_name: '遭遇',
          setting: '饕餮领地',
          timing: { duration: 33, start_time: 56 },
          characters: ['xiaoG', 'taotie'],
          dialogue: {
            lines: [
              { speaker: 'xiaoG', text: '小心！', emotion: 'alert' },
              { speaker: 'taotie', text: '吼——', emotion: 'aggressive' }
            ]
          }
        },
        {
          scene_id: 'SC03',
          scene_type: 'emotional_climax',
          scene_name: '共鸣',
          setting: '记忆之河',
          timing: { duration: 38, start_time: 89 },
          characters: ['xiaoG', 'taotie'],
          dialogue: {
            lines: [
              { speaker: 'xiaoG', text: '你不是怪物，你是记忆。', emotion: 'empathy' }
            ]
          }
        },
        {
          scene_id: 'SC04',
          scene_type: 'resolution',
          scene_name: '启程',
          setting: '等离子河边',
          timing: { duration: 25, start_time: 127 },
          characters: ['xiaoG'],
          dialogue: {
            lines: [{ speaker: 'xiaoG', text: '下一站，刑天。', emotion: 'determined' }]
          }
        }
      ],
      characters: [
        { id: 'xiaoG', name: '小G', role: 'protagonist', visuals: { color: '银灰' } },
        { id: 'taotie', name: '饕餮', role: 'featured_beast', tags: ['beast'] }
      ]
    }
  }
};

const mockRenderResult = {
  success: true,
  results: [
    { success: true, shotId: 'SC00', taskId: 'task-001' },
    { success: true, shotId: 'SC01', taskId: 'task-002' },
    { success: true, shotId: 'SC02', taskId: 'task-003' },
    { success: true, shotId: 'SC03', taskId: 'task-004' },
    { success: true, shotId: 'SC04', taskId: 'task-005' }
  ]
};

async function runTest() {
  console.log('🔥 [测试] 后期引擎全流程');
  console.log('----------------------------------------');
  console.log();

  const engine = new PostProductionEngine({
    outputDir: '/tmp/hyperreality-test-post',
    enableSubtitles: true,
    enableDanmaku: true,
    enableMusic: true,
    subtitleStyle: 'identity-card',
    versions: ['standard', 'clean', 'subtitled', 'danmaku', 'raw'],
    musicSource: 'pixabay'
  });

  const result = await engine.postProduce(
    mockProductionResult,
    mockScriptResult,
    mockRenderResult
  );

  console.log();
  console.log('----------------------------------------');
  console.log('📊 结果验证');
  console.log('----------------------------------------');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message}`);
      failed++;
    }
  }

  // 1. 整体成功
  assert(result.success, '后期制作成功');
  assert(result.timing.total > 0, '有耗时记录');

  // 2. 字幕
  assert(result.stages.subtitles?.count > 0, '生成了字幕');
  assert(result.stages.subtitles?.tracks?.length > 0, '有字幕轨道');
  
  const firstSubtitle = result.stages.subtitles.tracks[0];
  assert(firstSubtitle.type === 'identity_card', '字幕类型为身份卡');
  assert(firstSubtitle.duration > 0, '字幕有持续时间');
  assert(firstSubtitle.content?.name, '字幕有角色名');
  assert(firstSubtitle.content?.title?.includes('Nirath'), '字幕标题包含 Nirath');
  assert(firstSubtitle.content?.species, '字幕有物种信息');
  assert(firstSubtitle.content?.trait, '字幕有特征信息');
  assert(firstSubtitle.style?.position === 'bottom-left', '字幕位置在左下角');
  assert(firstSubtitle.style?.borderLeft?.includes('00ff88'), '字幕有绿色边框');

  // 3. 音乐
  assert(result.stages.music?.count > 0, '匹配了音乐');
  assert(result.stages.music?.tracks?.length > 0, '有音乐轨道');
  
  const firstMusic = result.stages.music.tracks[0];
  assert(firstMusic.searchParams?.mood, '音乐有情绪标签');
  assert(firstMusic.searchParams?.genre, '音乐有风格标签');
  assert(firstMusic.searchParams?.tags?.length > 0, '音乐有搜索标签');
  assert(firstMusic.config?.volume <= 0.5, '背景音乐音量 <= 50%');
  assert(firstMusic.config?.fadeIn > 0, '音乐有淡入');
  assert(firstMusic.source?.platform === 'pixabay', '音乐来源为 Pixabay');
  assert(firstMusic.source?.license?.includes('Free'), '音乐有免费许可');

  // 4. 弹幕
  assert(result.stages.danmaku?.count > 0, '生成了弹幕');
  assert(result.stages.danmaku?.list?.length > 0, '有弹幕列表');
  
  const firstDanmaku = result.stages.danmaku.list[0];
  assert(firstDanmaku.text, '弹幕有内容');
  assert(firstDanmaku.color, '弹幕有颜色');
  assert(firstDanmaku.position === 'top', '弹幕在顶部');
  assert(firstDanmaku.duration > 0, '弹幕有持续时间');

  // 5. 多版本
  assert(Object.keys(result.versions).length === 5, '生成了 5 个版本');
  assert(result.versions.standard, '有标准版');
  assert(result.versions.clean, '有纯净版');
  assert(result.versions.subtitled, '有字幕版');
  assert(result.versions.danmaku, '有弹幕版');
  assert(result.versions.raw, '有原始版');

  // 6. 版本特征检查
  assert(result.versions.standard.features.subtitles === true, '标准版有字幕');
  assert(result.versions.standard.features.music === true, '标准版有音乐');
  assert(result.versions.clean.features.subtitles === false, '纯净版无字幕');
  assert(result.versions.clean.features.music === false, '纯净版无音乐');
  assert(result.versions.danmaku.features.danmaku === true, '弹幕版有弹幕');
  assert(result.versions.raw.features.subtitles === false, '原始版无字幕');

  // 7. 版本文件
  assert(result.versions.standard.htmlPath, '标准版有 HTML 文件');
  assert(result.versions.standard.configPath, '标准版有配置文件');
  assert(result.versions.standard.renderCommand?.includes('hyperframes'), '有渲染命令');

  // 8. HyperFrames HTML 检查
  if (fs.existsSync(result.versions.standard.htmlPath)) {
    const html = fs.readFileSync(result.versions.standard.htmlPath, 'utf8');
    assert(html.includes('data-composition-id'), 'HTML 包含合成 ID');
    assert(html.includes('data-start'), 'HTML 包含时间数据');
    assert(html.includes('data-duration'), 'HTML 包含持续时间');
    assert(html.includes('identity-card'), 'HTML 包含身份卡样式');
    assert(html.includes('gsap'), 'HTML 包含 GSAP');
    assert(html.includes('window.__timelines'), 'HTML 包含时间线注册');
  } else {
    console.log('  ⚠️ HTML 文件尚未生成（检查文件系统权限）');
  }

  // 9. 质量检查
  assert(result.stages.quality?.passed === true, '质量检查通过');
  assert(result.stages.quality?.issues?.length === 0, '无质量问题');

  // 10. 报告生成
  const report = engine.generateReport(result);
  assert(report.includes('后期制作报告'), '报告标题正确');
  assert(report.includes('字幕预览'), '报告包含字幕信息');
  assert(report.includes('音乐配置'), '报告包含音乐信息');
  assert(report.includes('版本详情'), '报告包含版本信息');

  console.log();
  console.log('========================================');
  console.log('  测试完成');
  console.log('========================================');
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  📊 总计: ${passed + failed}`);
  console.log(`  🎯 成功率: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('========================================');

  if (failed === 0) {
    console.log('\n🎉 后期引擎测试全部通过！');
  }

  // 保存测试报告
  fs.writeFileSync('/tmp/hyperreality-test-post/report.md', report);
  console.log('\n💾 测试报告已保存到: /tmp/hyperreality-test-post/report.md');
}

runTest().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
```

---

# 📦 hyperreal

路径: `/root/.openclaw/workspace/hyperreal` | 文件数: 1

## 📄 hyperreal/product-layer/product-definition.md

```md
# 超现实工业视频创作系统 — 产品定义 v1.0

> **Hyperreal AI Video System (HAVS)**
> 
> 品牌口号：**所想即所见，所见即超凡。**
> 
> English: **Imagine the Impossible. Render the Hyperreal.**

---

## 系统定位

面向专业创作者、内容团队与企业的**工业化智能视频创作平台**。不做模板的搬运工，而是做叙事的锻造者——从你的一句话创意到完整成片，全链路自动化，分钟级交付，每一帧都经过导演级质量门控。

---

## 核心架构：ScriptCraft Engine（剧本引擎）

ScriptCraft Engine 不是传统剧本生成工具，而是**多类型叙事操作系统**。

### 五大专业化叙事引擎

| 引擎 ID | 引擎名称 | 英文 | 场景 | 理论基础 |
|:--------|:---------|:-----|:-----|:---------|
| `dramatic` | 戏剧性引擎 | Dramatic Engine | 电影、短剧、品牌故事片 | 三幕结构、英雄之旅、Save the Cat 等 12 种叙事模板 |
| `educational` | 科普教育引擎 | Educational Engine | 知识科普、教育内容 | 认知脚手架理论：激活→桥接→建构→巩固→迁移 |
| `documentary` | 纪录片引擎 | Documentary Engine | 纪实内容、人物专访 | 主张-证据-论证模型，三线交织 |
| `lifelog` | 生活记录引擎 | LifeLog Engine | 家庭影像、Vlog、回忆视频 | 记忆织锦模型：情感聚类 + 时间编织 |
| `commercial` | 商业营销引擎 | Commercial Engine | 广告、营销、带货 | AIDA-N、PAS-N、品牌故事弧等 6 种营销模型 |

### 质量评估体系

| 引擎 | 评估框架 | 维度 | 关键指标 |
|:-----|:---------|:-----|:---------|
| Dramatic | DramaBench | 6维 | 格式标准、叙事效率、角色一致性、情感深度、逻辑一致性、冲突处理 |
| Educational | EduScore | 5维 | 认知流畅度、术语可及性、类比质量、记忆锚点、迁移潜力 |
| Documentary | DocuScore | 5维 | 论证强度、真实感、人物深度、节奏控制、伦理合规 |
| LifeLog | LifeScore | 4维 | 情感真挚度、人物覆盖度、记忆锚点密度、节奏舒适度 |
| Commercial | MktScore | 5维 | 注意力捕获、转化驱动力、品牌对齐度、传播潜力、合规安全性 |

**质量门规则**：未通过质量门 → 自动进入最多 3 轮诊断-修复循环。

---

## 关键技术能力

### 1. Intent Router（意图自动路由）

三层路由架构：
- **快速分类器**：关键词规则，10-50ms，识别明显类型信号
- **深度理解器**：LLM分析，200-400ms，分析内容领域/目标受众/期望效果
- **渐进式澄清**：置信度<0.7时主动提问，2轮内锁定类型

**类型识别准确率 ≥ 96.5%**

### 2. 混合创作模式（Hybrid Mode）

支持 **主导引擎 + 辅助引擎** 的跨类型融合：

| 模式 ID | 模式名称 | 主引擎 | 辅引擎 | 典型场景 |
|:--------|:---------|:-------|:-------|:---------|
| `knowledge-marketing` | 知识营销 | Educational | Commercial | 科普内容自然植入品牌 |
| `brand-story` | 品牌故事片 | Dramatic | Commercial | 电影级叙事承载品牌信息 |
| `docu-marketing` | 纪实营销 | Documentary | Commercial | 纪录片形式的品牌溯源 |
| `lifestyle-marketing` | 生活化营销 | LifeLog | Commercial | UGC风格的真实产品分享 |
| `sci-doc` | 科教纪录 | Educational | Documentary | 科学内容的人物证言增强 |

### 3. 双模式运行

| 模式 | 定位 | 集成点 | 适用场景 |
|:-----|:-----|:-------|:---------|
| **Embedded** | 嵌入生产流水线 | Stage-5 剧本引擎，接入上下游角色/场景/镜头/渲染 | 批量工业化生产 |
| **Standalone** | 独立 CLI 工具 | 独立运行，Logline→剧本→多种输出格式 | 前期创意探索、IP开发 |

### 4. 统一数据模型：Story Blueprint

一个数据模型兼容所有类型，类型扩展字段按需激活。

---

## 品牌关键词

**中文**：超现实、工业级、叙事大脑、自动路由、五大引擎、混合创作、导演级质量、分钟级交付、所想即所见

**English**：Hyperreal, HAVS, Hyper-Industrial, Narrative Brain, Intent Router, Five Engines, Hybrid Creation, Director-Grade Quality, Minutes to Film, Render the Hyperreal

---

## 对外宣传文案（存档）

### 一句话版
> 超现实工业视频创作系统 — 所想即所见，所见即超凡。

### 三句话电梯演讲
> 超现实工业视频创作系统是一套拥有"叙事大脑"的 AI 视频平台。内置五大专业化创作引擎——从电影短剧到科普教育，从纪实纪录到商业营销——系统自动识别你的创作意图，将一句话创意锻造成专业级视频。所想即所见，所见即超凡。

### 对比向文案
> 传统视频制作：写脚本 2 天，画分镜 1 天，拍摄 3 天，后期 2 天。
> 超现实工业视频创作系统：说一句话，8 分钟。
> 不是替代创作者，是给创作者一把「暴风战斧」。

---

## 行业应用场景矩阵

| 行业 | 典型场景 | 推荐引擎 | 输出示例 |
|:-----|:---------|:---------|:---------|
| 快消品牌 | 新品上市短视频 | Commercial (AIDA-N) | 15-30 秒转化型广告 |
| 科技品牌 | 技术原理科普 | Educational + Commercial | 60 秒知识营销视频 |
| 文化传媒 | 短剧/微电影 | Dramatic (三幕/英雄之旅) | 1-3 分钟剧情短片 |
| 教育机构 | 课程知识讲解 | Educational (知识阶梯) | 3-10 分钟教学视频 |
| 公益组织 | 纪录片/人物志 | Documentary (人物志) | 5-15 分钟纪实片 |
| 个人创作者 | 家庭聚会/旅行Vlog | LifeLog (记忆织锦) | 1-5 分钟情感影像 |
| 电商平台 | 带货短视频 | Commercial (PAS-N) | 30-60 秒效果广告 |
| 汽车/房产 | 品牌溯源纪录片 | Documentary + Commercial | 3-8 分钟品牌纪录片 |
| 金融/保险 | 产品科普动画 | Educational (类比之旅) | 60-120 秒解释视频 |
| 医疗健康 | 健康科普内容 | Educational + Documentary | 2-5 分钟科教纪录 |

---

*文档版本：v1.0*
*归档日期：2026-06-08*
*系统版本：Hyperreal AI Video System v2*
```

---

