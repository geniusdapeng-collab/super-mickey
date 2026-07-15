# Seedance Agent v9.2.0-Peng 🎬

> 基于 Claude Code Agent Loop 架构改造的视频制作系统
> 
> 从 v6.0 的线性流水线升级为动态决策循环

---

## 架构对比

| 维度 | v6.0 (Pipeline) | v7.0 (Agent Loop) |
|------|----------------|-------------------|
| 核心模式 | Phase 0-7 顺序执行 | `while(true)` 动态决策 |
| 用户干预 | 无（黑盒执行） | 关键节点 pause 等人确认 |
| 状态恢复 | 无（每次从零开始） | resume/fork/rewind |
| 成本管理 | 固定预算 | 五级分辨率渐进升级 |
| 安全 | 单层阈值闸机 | 七层权限门控 |

---

## 核心模块

```
seedance-agent/
├── core/
│   ├── agent-loop.js       # Agent Loop 核心引擎（9步流水线）
│   ├── permission-gate.js  # 权限门控（7层安全前三层）
│   ├── context-manager.js  # 五级素材分辨率管理
│   ├── state-machine.js    # 状态机（resume/fork/rewind）
│   ├── tool-pool.js        # 工具池（三层注册结构）
│   └── index.js            # 统一导出入口
├── config/
│   ├── seedance.md         # 项目配置模板（类似 CLAUDE.md）
│   └── seedance.json       # 运行时配置
└── ARCHITECTURE-TRANSFORMATION.md  # 完整改造蓝图
```

---

## 快速开始

### 1. 创建项目

```bash
cd seedance-agent
node -e "
  import('./core/index.js').then(async m => {
    const agent = await m.createAgent('my-project', '制作一个品牌宣传短片');
    const loop = agent.start();
    for await (const event of loop) {
      console.log(event.type, event.message || '');
    }
  });
"
```

### 2. 权限模式

```javascript
import { PermissionGate } from './core/permission-gate.js';

const gate = new PermissionGate({
  permissionMode: 'semi-auto',  // plan | default | acceptEdits | semi-auto | auto | dontAsk | bypass
  renderBudgetUSD: 10.0
});
```

### 3. 状态恢复

```javascript
import { StateMachine } from './core/state-machine.js';

const sm = new StateMachine('my-project');
sm.init({ projectName: 'Brand Video' });
sm.transition({ turn: 1, action: 'generate_plan' });

// 回退到任意历史点
sm.rewind(0);

// 分叉创建新版本
const v2 = sm.fork('dark-theme', { variant: 'dark' });
```

---

## 向后兼容

v7.0 保留 v6.0 的完整 CLI 接口：

```bash
# 新方式：Agent Loop
node core/agent-loop.js my-project "制作需求"

# 旧方式：v6.0 兼容模式
node core/agent-loop.js my-project "制作需求" --legacy
```

---

## 配置

复制模板并自定义：

```bash
cp config/seedance.md projects/my-project/PROJECT.md
```

---

## 架构原则

> **模型负责创意推理，Harness 负责一切其他事务。**

1. **渐进降级** — 从免费预览开始，逐级升级
2. **拒绝优先** — deny > ask > allow
3. **追加式持久化** — 原始状态永不修改
4. **成本感知** — 每次操作都有成本估算
5. **安全纵深** — 七层独立机制

---

## License

MIT — Seedance Team
