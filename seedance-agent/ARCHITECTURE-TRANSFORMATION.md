# Seedance → Claude Code 架构改造蓝图

> **目标**：将 Seedance v6.0-Peng 从「流水线脚本系统」升级为「Agent 驱动的视频生成工作流系统」——视频生成行业的 Claude Code。
>
> **原则**：渐进改造，保持现有核心能力不变，先注入 Agent 灵魂，再逐步替换。

---

## 一、现有架构诊断

### Seedance v6.0-Peng 现状

```
用户请求
  ↓
[Phase 0] 角色定妆照 → [Phase 1] 多方案生成 → [Phase 2] 比稿评测
  ↓
[Phase 3] 对齐闸机 → [Phase 4] 渲染引擎 → [Phase 5] 后期合成
  ↓
[Phase 6] 交付 → [Phase 7] 战报
```

**特征**：
- **脚本式执行**：预定义 Phase 顺序，按脚本跑完
- **文件系统传递状态**：每个 Phase 读写 JSON 文件
- **有限反馈闭环**：比稿评测 → 方案重生成（最多 3 轮）
- **模型自动降级**：4 级 fallback（QuotaExceeded/429）
- **多技能模块**：16 个子技能，通过 shell spawn 调用
- **StoryForge Pro 编排器**：有基本并行（Promise.all），但仍是脚本式

**核心问题**：这是 **Pipeline**，不是 **Agent Loop**。

---

## 二、Claude Code 七组件架构

来自 Anthropic 2026 年 4 月官方论文《The Design Space of Today's and Future AI Agent Systems》：

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code 架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User → Interfaces → Agent Loop ←→ Permission System        │
│                          ↓                                    │
│                    Tool Pool (54 tools + MCP)                 │
│                          ↓                                    │
│              Execution Environment (Shell/FS/Web)            │
│                          ↓                                    │
│              State & Persistence (JSONL/CLAUDE.md)              │
│                                                               │
│  Context Management: 5层 Compaction Pipeline                  │
│    Budget → Snip → Microcompact → Context Collapse → Auto-compact
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**核心机制**：
1. **Agent Loop** (`queryLoop`)：持续循环——感知环境 → 思考 → 行动 → 观察结果 → 再决策
2. **Tool Use**：结构化 JSON 工具调用，所有外部交互统一走 Tool Interface
3. **Permission System**：Deny-first + Human Escalation，敏感操作 pause 等待确认
4. **Context Window Management**：5 层渐进压缩，上下文是稀缺资源
5. **State Persistence**：JSONL session transcripts + CLAUDE.md 层级记忆
6. **Human-in-the-loop**：关键决策点自动 pause，不是全自动黑盒
7. **Agent Swarm**：可 spawn 子 Agent 并行处理独立任务

---

## 三、差距诊断矩阵

| 维度 | Seedance 现状 | Claude Code | 差距等级 | 改造优先级 |
|------|--------------|-------------|---------|----------|
| **执行模式** | 预定义 Phase 流水线 | Agent Loop 动态决策 | 🔴 P0 | 最高 |
| **人机协作** | 全自动黑盒 | Human-in-the-loop | 🔴 P0 | 最高 |
| **上下文管理** | 无 Token 管理 | 5 层 Compaction | 🔴 P0 | 最高 |
| **状态持久化** | 松散文件系统 | JSONL + CLAUDE.md 层级 | 🟡 P1 | 高 |
| **工具系统** | Shell spawn 调用 | 统一 Tool Pool + Schema | 🟡 P1 | 高 |
| **错误恢复** | Try-catch + 降级 | 多层级恢复 + 重试策略 | 🟡 P1 | 高 |
| **记忆系统** | 无跨会话记忆 | CLAUDE.md + Auto Memory | 🟡 P1 | 中 |
| **Agent Swarm** | 有限并行渲染 | 子 Agent 独立上下文 | 🟢 P2 | 中 |
| **Permission** | 无权限控制 | Deny-first + 规则层 | 🟢 P2 | 低 |

---

## 四、改造蓝图

### 4.1 总体架构：Seedance Agent Loop

```
┌─────────────────────────────────────────────────────────────┐
│              Seedance Agent v9.2.0-Peng                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  用户请求 → Agent Loop (seedance-agent.js)                   │
│                ↓                                              │
│    ┌──────────────────────────────────────────┐              │
│    │  Perception: 读取环境状态                  │              │
│    │  → 检查 productions/ 目录                  │              │
│    │  → 读取 SEEDANCE.md (项目规则)             │              │
│    │  → 读取 memory.jsonl (会话历史)            │              │
│    └──────────────────────────────────────────┘              │
│                ↓                                              │
│    ┌──────────────────────────────────────────┐              │
│    │  Planning: 动态规划任务                    │              │
│    │  → 根据当前状态决定下一步行动              │              │
│    │  → 不是固定 Phase，而是动态 Task Graph     │              │
│    └──────────────────────────────────────────┘              │
│                ↓                                              │
│    ┌──────────────────────────────────────────┐              │
│    │  Action: 调用 Tool                        │              │
│    │  → generate_story_plan                    │              │
│    │  → evaluate_pitch                         │              │
│    │  → render_shot (with model fallback)      │              │
│    │  → compose_video                          │              │
│    │  → ask_human (permission gate)          │              │
│    └──────────────────────────────────────────┘              │
│                ↓                                              │
│    ┌──────────────────────────────────────────┐              │
│    │  Observation: 收集结果                     │              │
│    │  → Tool result 回传 Loop                   │              │
│    │  → 更新 state.json                         │              │
│    │  → 决定是否继续 / 重试 / 升级              │              │
│    └──────────────────────────────────────────┘              │
│                ↓                                              │
│         (Loop 直到完成或用户中断)                              │
│                                                               │
│  Tool Pool:                                                   │
│  ├── story-plan-tool (原 story-engine)                        │
│  ├── pitch-eval-tool (原 pitch-evaluation)                   │
│  ├── render-tool (原 seedance-wrapper)                       │
│  ├── post-prod-tool (原 post-production)                     │
│  ├── sound-design-tool (原 sound-design)                     │
│  ├── character-tool (原 character-manager)                   │
│  ├── dialogue-tool (原 dialogue-engine)                      │
│  ├── ask-human-tool (新增)                                   │
│  └── ... (其他 16 个技能全部封装)                             │
│                                                               │
│  Context Management:                                          │
│  ├── SEEDANCE.md (项目级规则，类似 CLAUDE.md)                 │
│  ├── session.jsonl (会话转录)                                │
│  ├── state.json (实时状态机)                                 │
│  └── context-compactor.js (5层压缩)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 核心改造模块

#### 模块 A：Agent Loop 核心 (P0)

**新文件**：`seedance-agent/core/agent-loop.js`

```javascript
/**
 * Seedance Agent Loop v1.0
 * 核心循环：感知 → 规划 → 行动 → 观察
 */
class SeedanceAgentLoop {
  constructor(config) {
    this.state = new StateMachine();
    this.toolPool = new ToolPool();
    this.permissionGate = new PermissionGate();
    this.contextManager = new ContextManager();
    this.memory = new MemorySystem();
  }

  async run(userRequest) {
    // 初始化会话
    this.state.init(userRequest);
    this.memory.loadSession();
    
    // 主循环
    while (!this.state.isComplete() && !this.state.isAborted()) {
      // 1. Perception: 感知当前环境
      const perception = await this.perceive();
      
      // 2. Planning: 决定下一步行动
      const plan = await this.plan(perception);
      
      // 3. Permission Check: 敏感操作 pause
      if (plan.requiresPermission) {
        const approved = await this.permissionGate.check(plan);
        if (!approved) {
          this.state.markAwaitingHuman();
          break; // 暂停，等用户响应
        }
      }
      
      // 4. Action: 执行 Tool
      const result = await this.toolPool.execute(plan.tool, plan.args);
      
      // 5. Observation: 观察结果，更新状态
      this.state.update(result);
      this.memory.appendTurn(plan, result);
      
      // 6. Context Compaction: 管理上下文压力
      await this.contextManager.compactIfNeeded();
    }
    
    return this.state.getResult();
  }
}
```

**关键设计**：
- 不是固定 Phase 顺序，而是根据当前状态动态决策
- `StateMachine` 维护完整状态，支持 resume/fork/rewind
- 每个 turn 都是一次完整的感知-规划-行动-观察循环
- 用户可以在任何 turn 介入、修改、中断

#### 模块 B：统一 Tool Pool (P1)

**新文件**：`seedance-agent/tools/tool-registry.js`

把所有现有技能封装为统一 Tool Interface：

```javascript
const TOOL_SCHEMAS = {
  'generate_story_plan': {
    description: '生成视频故事的方案脚本',
    parameters: {
      title: { type: 'string', required: true },
      outline: { type: 'string', required: true },
      duration: { type: 'number', default: 180 },
      variants: { type: 'number', default: 3 },
      style: { type: 'string' },
    },
    handler: async (args) => {
      // 调用原 story-engine.js
      return await storyEngine.planMulti(args);
    }
  },
  
  'evaluate_pitch': {
    description: '比稿评测，选择最佳方案',
    parameters: {
      candidates: { type: 'array', required: true },
      minScore: { type: 'number', default: 7.5 },
    },
    handler: async (args) => {
      return await pitchEvaluation.evaluate(args);
    }
  },
  
  'render_shot': {
    description: '渲染单个镜头',
    parameters: {
      prompt: { type: 'string', required: true },
      model: { type: 'string' },
      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    handler: async (args) => {
      return await renderTool.create(args);
    }
  },
  
  'compose_video': {
    description: '后期合成成片',
    parameters: {
      productionDir: { type: 'string', required: true },
      soundDir: { type: 'string' },
    },
    handler: async (args) => {
      return await postProduction.assemble(args);
    }
  },
  
  'ask_human': {
    description: '请求人类确认或输入',
    parameters: {
      question: { type: 'string', required: true },
      options: { type: 'array' },
    },
    handler: async (args) => {
      return await humanInterface.ask(args);
    }
  },
  
  // ... 其他所有技能
};
```

**改造原则**：
- 现有技能代码**不改动**，只加一层 Tool Wrapper
- 每个 Tool 有 JSON Schema 定义，支持自动参数校验
- Tool 可以并行执行（Agent Swarm 模式）

#### 模块 C：Human-in-the-loop Permission Gate (P0)

**新文件**：`seedance-agent/core/permission-gate.js`

```javascript
/**
 * Permission Gate — Deny-first + Human Escalation
 */
class PermissionGate {
  constructor() {
    // 规则：deny > ask > allow
    this.rules = [
      { pattern: /delete.*production/, action: 'deny' },
      { pattern: /render.*shot/, action: 'ask' },
      { pattern: /evaluate_pitch/, action: 'allow' },
      { pattern: /compose_video/, action: 'ask' },
      { pattern: /.*batch.*/, action: 'ask' },
    ];
  }
  
  async check(plan) {
    // 1. 检查 deny 规则
    if (this.isDenied(plan)) {
      return { approved: false, reason: 'Rule denied' };
    }
    
    // 2. 检查 ask 规则 → pause 等待人类
    if (this.requiresAsk(plan)) {
      return { approved: false, awaitingHuman: true, question: this.buildQuestion(plan) };
    }
    
    // 3. 默认 allow
    return { approved: true };
  }
}
```

**关键决策点**（会自动 pause 等待确认）：
- 渲染提交前："即将提交 X 个镜头渲染，消耗 Y 额度，确认？"
- 比稿选出最佳方案后："最佳方案是 A，是否进入渲染？"
- 后期合成前："所有素材就绪，是否开始合成？"
- 最终交付前："成片已生成，是否发送？"
- 任何批量删除操作

#### 模块 D：Context Manager 上下文管理 (P0)

**新文件**：`seedance-agent/core/context-manager.js`

```javascript
/**
 * Context Manager — 5层渐进压缩
 * 灵感来自 Claude Code 的 compaction pipeline
 */
class ContextManager {
  constructor(budget = 100000) { // 100K token 预算
    this.budget = budget;
    this.layers = [
      new BudgetReducer(),      // 层1: 预算缩减（单个超大输出）
      new SnipHandler(),        // 层2: 时间深度裁剪（旧消息）
      new MicroCompactor(),     // 层3: 缓存开销压缩
      new ContextCollapser(),   // 层4: 超长历史压缩
      new AutoCompactor(),      // 层5: 语义压缩（最后手段）
    ];
  }
  
  async compactIfNeeded() {
    const currentSize = await this.estimateSize();
    if (currentSize < this.budget * 0.8) return; // 80% 阈值
    
    for (const layer of this.layers) {
      const reduced = await layer.compact(this.history);
      if (reduced) break; // 一旦压缩成功就停止
    }
  }
}
```

**Seedance 特化压缩策略**：
- **Layer 1 (Budget)**：单个 shot prompt 过长时自动精简
- **Layer 2 (Snip)**：裁剪旧的 story-plan 迭代版本，保留最终版
- **Layer 3 (Microcompact)**：压缩重复的渲染日志
- **Layer 4 (Collapse)**：多轮比稿评测的历史压缩为摘要
- **Layer 5 (Auto-compact)**：语义摘要，保留关键决策点

#### 模块 E：State Machine + 持久化 (P1)

**新文件**：`seedance-agent/core/state-machine.js`

```javascript
/**
 * State Machine — 统一状态管理
 * 支持: resume / fork / rewind / snapshot
 */
class ProductionStateMachine {
  constructor(productionId) {
    this.id = productionId;
    this.state = {
      phase: 'init',           // init → planning → evaluating → rendering → compositing → delivery
      status: 'idle',          // idle → running → paused → error → complete
      userRequest: null,       // 原始需求
      storyPlan: null,         // 当前 story-plan
      candidates: [],          // 候选方案
      selectedCandidate: null, // 选定方案
      shots: [],               // 所有镜头状态
      renderedShots: [],       // 已渲染镜头
      failedShots: [],         // 失败镜头
      composition: null,       // 合成配置
      delivery: null,          // 交付状态
      history: [],             // 操作历史（用于 rewind）
    };
  }
  
  // 保存到 session.jsonl（追加式）
  async save() {
    const entry = {
      timestamp: Date.now(),
      state: this.state,
    };
    await appendJSONL(`productions/${this.id}/session.jsonl`, entry);
    await writeJSON(`productions/${this.id}/state.json`, this.state);
  }
  
  // 从任意历史点恢复
  async resume(snapshotId) {
    const snapshot = await loadSnapshot(this.id, snapshotId);
    this.state = snapshot.state;
  }
  
  // Fork：从当前状态创建分支
  async fork(newId) {
    const forked = new ProductionStateMachine(newId);
    forked.state = { ...this.state, id: newId, parentId: this.id };
    return forked;
  }
}
```

#### 模块 F：Memory System 记忆系统 (P1)

**层级记忆（类比 CLAUDE.md）**：

```
~/.openclaw/workspace/
├── SEEDANCE.md                    ← 全局规则（用户定义，所有项目共享）
├── productions/
│   └── 项目A/
│       ├── SEEDANCE.md            ← 项目级规则（每部视频的配置）
│       ├── session.jsonl          ← 会话转录（所有 turn 记录）
│       ├── state.json             ← 实时状态
│       ├── auto-memory.md         ← 自动记忆（Agent 自写）
│       └── snapshots/             ← 状态快照
│           ├── 001-init.json
│           ├── 010-plan-selected.json
│           └── 020-render-complete.json
```

**SEEDANCE.md 层级**：
- **全局** (`~/.openclaw/workspace/SEEDANCE.md`)：用户偏好、常用风格、API 配置
- **项目级** (`productions/xxx/SEEDANCE.md`)：该视频的特定规则、角色设定、风格约束
- **自动记忆** (`auto-memory.md`)：Agent 在过程中学习的经验（如"这个角色上次渲染失败了，需要调整 prompt"）

#### 模块 G：Agent Swarm 并行渲染 (P2)

**新能力**：把 Agent Loop 中的任务分解为子 Agent

```javascript
// Agent Swarm 模式：并行渲染多个镜头
async function swarmRender(shots) {
  const swarm = new AgentSwarm();
  
  for (const shot of shots) {
    // 每个镜头 spawn 一个独立子 Agent
    const agent = swarm.spawn({
      task: `render shot ${shot.id}`,
      context: { shot, styleGuide },
      isolated: true, // 独立上下文窗口
    });
    
    agent.onComplete(result => {
      mainAgentLoop.observe({ shotId: shot.id, result });
    });
  }
  
  await swarm.waitAll();
}
```

**应用场景**：
- 并行渲染 25 个镜头（每个子 Agent 独立上下文，避免窗口溢出）
- 并行生成 3 个候选方案（每个方案一个子 Agent）
- 并行执行后期合成 + 声音设计

---

## 五、改造实施路径

### Phase 1: 核心骨架（1-2 天）

**目标**：搭出 Agent Loop + Tool Pool + Permission Gate 的核心框架

**任务**：
1. ✅ 创建 `seedance-agent/` 目录结构
2. ✅ 实现 `AgentLoop` 核心类
3. ✅ 实现 `ToolRegistry`（封装现有技能为 Tools）
4. ✅ 实现 `PermissionGate`（deny-first + ask-human）
5. ✅ 实现基础 `StateMachine`（支持 save/load/resume）
6. ✅ 写 `SEEDANCE.md` 模板

**验证**：
```bash
node seedance-agent.js produce --title "测试" --outline "测试大纲"
# 应该看到 Agent Loop 运行，在关键决策点 pause 等待确认
```

### Phase 2: 上下文管理（2-3 天）

**目标**：解决长任务上下文溢出问题

**任务**：
1. 实现 5 层 Context Compaction Pipeline
2. 给 story-plan、shots、render logs 设计压缩策略
3. 加入 Token 预算监控和告警
4. 实现 session.jsonl 追加式记录

**验证**：
- 25 个镜头的完整生产流程不溢出上下文
- 可以 resume 中断的生产任务

### Phase 3: 记忆系统（2-3 天）

**目标**：跨会话学习和经验积累

**任务**：
1. 实现 SEEDANCE.md 层级加载
2. 实现 auto-memory（Agent 自写笔记）
3. 设计记忆写入触发器（何时写、写什么）
4. 集成到 Agent Loop 的 Perception 阶段

**验证**：
- 第二次生产同一风格视频时，Agent 记得上次的问题
- 角色渲染失败的经验被记录，下次自动调整

### Phase 4: Agent Swarm（3-5 天）

**目标**：并行能力 + 多 Agent 协作

**任务**：
1. 实现子 Agent spawn（利用 OpenClaw 的 sessions_spawn）
2. 并行渲染 25 个镜头
3. 并行生成多方案
4. 主 Agent 与子 Agent 的结果聚合

**验证**：
- 25 个镜头并行渲染，速度提升 5-10x
- 3 个候选方案并行生成

### Phase 5: 打磨集成（持续）

**目标**：所有现有技能无缝接入新架构

**任务**：
1. 逐个迁移 16 个子技能到 Tool Pool
2. 完善错误恢复策略
3. 优化 Human-in-the-loop 体验（飞书卡片交互）
4. 写完整文档和测试

---

## 六、关键设计决策

### Q1: 为什么不直接重写，而是渐进改造？

**A**: Seedance v6.0 的 249 个文件、16 个子技能、53K 行代码是大量实战打磨出来的。直接重写风险极高。**渐进改造**的策略：
- 第一步：只改**执行层**（Agent Loop 替代 director.js 的 Phase 顺序）
- 现有技能代码**零改动**，只加 Tool Wrapper
- 逐步替换，随时可回滚

### Q2: Human-in-the-loop 会不会太慢？

**A**: 不会。只在**关键决策点** pause：
- 方案选择（3 选 1）
- 渲染提交前（确认额度消耗）
- 最终成片确认
- 其他步骤全自动

可以配置 `auto-approve` 规则：信任度高的操作自动通过。

### Q3: 怎么利用 OpenClaw 现有能力？

**A**: OpenClaw 本身就是 Agent 平台：
- `sessions_spawn` → Agent Swarm 子 Agent
- `cron` → 定时任务/后台渲染
- `memory_search` → 自动记忆的检索
- `feishu_ask_user_question` → Human-in-the-loop 飞书交互
- 这些能力 Seedance 之前没用上，新架构要充分利用

---

## 七、新目录结构

```
~/.openclaw/workspace/
├── SEEDANCE.md                          ← 全局规则
├── seedance-agent/                      ← 新架构核心
│   ├── core/
│   │   ├── agent-loop.js               ← Agent Loop 核心
│   │   ├── state-machine.js            ← 状态机
│   │   ├── context-manager.js          ← 上下文管理
│   │   ├── permission-gate.js          ← 权限控制
│   │   └── memory-system.js            ← 记忆系统
│   ├── tools/
│   │   ├── tool-registry.js            ← Tool 注册中心
│   │   ├── tool-wrapper.js             ← 现有技能包装器
│   │   └── schemas/                    ← JSON Schema 定义
│   ├── swarm/
│   │   ├── agent-swarm.js              ← Agent 集群
│   │   └── sub-agent.js                ← 子 Agent 模板
│   ├── interfaces/
│   │   ├── cli.js                      ← 命令行界面
│   │   └── feishu-ui.js                ← 飞书交互界面
│   ├── seedance-agent.js               ← 主入口
│   └── package.json
│
├── skills/                              ← 现有技能（不变）
│   ├── seedance-director/              ← director.js 仍保留
│   ├── seedance-story-engine/
│   ├── seedance-render-engine/
│   ├── seedance-post-production/
│   └── ... (其他 12 个)
│
└── productions/                         ← 生产目录
    └── 项目ID/
        ├── SEEDANCE.md                  ← 项目级规则
        ├── session.jsonl                ← 会话转录
        ├── state.json                   ← 实时状态
        ├── auto-memory.md               ← 自动记忆
        ├── snapshots/                   ← 状态快照
        └── ... (素材文件)
```

---

## 八、下一步行动

队长，以上是**完整蓝图**。你看完确认方向后，我立刻开始 **Phase 1 核心骨架**的实现。

你可以：
1. **确认总体方向** → 我立刻开始写代码
2. **调整优先级** → 哪些模块先做/后做
3. **补充细节** → 你的第二份材料（Claude Code 改写建议）到了之后叠加
4. **直接开干** → 不用等，我现在就开始搭骨架

等你指令！🫡
