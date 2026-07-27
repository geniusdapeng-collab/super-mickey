# 规范权威地图（SPEC AUTHORITY）

> **这份文件解决什么问题**：仓库中文档层与引擎代码层并存，历史上多次出现
> "AI Agent 按过期文档执行、产出偏离系统真实规范"的事故。
> 本文件是唯一官方的"规范该信谁"的裁决表。
> **任何 Agent 执行本系统前，必须先读本文件。**

## 一、总原则（铁律）

1. **引擎代码 > 文档**。文档（README/SYSTEM/SKILL/templates/docs）只做背景参考，
   凡与引擎代码冲突，一律以引擎代码为准。
2. **唯一权威源思想**：每类规范只有一个权威文件，其他文件不得登记同类字面数值
   （版本号、字符长度、字段数），防止双写漂移。
3. **发现文档与代码不一致**：以代码为准执行，并提 Issue 标记文档过期，禁止自行二选一。

## 二、各类规范的权威源清单

| 规范域 | 唯一权威文件 | 关键内容 |
|--------|--------------|----------|
| 系统版本号 | `package.json` → `"version"` | 禁止从 Git tag / 文档标题 / 子系统编号（v6.x）推断 |
| 版本一致性校验 | `scripts/version-check.js` | 三源校验：`.current-version` / `package.json` / `index.js` 头部注释，提交前必过 |
| 内容镜头 26 字段 | `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js` | 01.【语言约束】→ 26.【角色一致性】，序号化【】标签格式 |
| 片头镜头 31 字段 | 同上（`isOpening` 分支） | 26 标准 + 5 片头专属：主标题内容 / 副标题内容 / 标题动画设计 / 标题字体设计 / 开场音频设计 |
| 台词速率 | `hyperreality-system/config/speech-rate.js` | 基准 3.5 字/秒、极限 4.5 字/秒、台词占镜头时长 ≤80%；**"4-4.5 字/秒"等旧口径一律无效** |
| 审核门槛 | `hyperreality-system/config/audit-standards.js` | 内容镜头字段数 ≥25、片头镜头 ≥30（门槛为下限，实际字段数以 prompt-fusion-agent.js 解析为准） |
| 字段校验分级 | `hyperreality-system/engines/field-standardizer.js` | P0 致命 12 字段、P1 核心 7 字段、导出前 25 字段非空硬检查 |
| Prompt 长度 | `hyperreality-system/config/prompt-length.js` | 两阶段口径：组装目标 2470-3000 / HARD_MAX 3000；精炼后交付 ≥REFINED_MIN 且 ≤HARD_MAX；**990、1400-1500 等旧数字一律无效** |
| 审核报告格式 | `hyperreality-system/index.js`（审核报告生成器） | 镜头总览五列核验（字符数/字段数/定妆照/时间轴/约束）+ 7 条审核须知 |
| 镜头设计卡（中间态） | `templates/shot-card-v4-template.md` | 仅管线内部结构数据，**不是最终渲染 Prompt 格式**，禁止混用 |
| 原始故事文本直通 | 见提交【方案A-fix】系列 | 用户输入原文必须原样进入需求洞察确认单与 PRD 链路 |
| 中间环节交付物格式 | `skills/creative-theme-generator/index.js`（确认单）、`engines/requirement-discovery-engine.js`（对齐清单）、`engines/prd-generator/prd-generator.js`（PRD）各自的生成函数 | 创意主题确认单字段、业务需求对齐清单章节、PRD 章节结构以生成函数源码为唯一权威，技能/文档不得自带格式清单 |
| 内容精炼规则 | `engines/production-engine/agents/field-content-refiner.js` | 六类规则：剥英文前缀/去同义堆叠/分句去重/矛盾仲裁/碎片清理/句级闭合；挂载于组装函数 return 之前 |
| 文档陈旧字面值扫描 | `scripts/agent-preflight.js` | 980/990/1400-1500/MAX_PROMPT_LENGTH 等长度字面值无失效标注不得出现于任何 .md 文档，命中即退出码 1；日期快照文件降级为警告 |
| Agent 技能入口 | `skill/supermickey-studio/SKILL.md` | 随仓库发行的 supermickey-studio 技能，仅做流程编排；规范细节一律以 agent-preflight 规范卡为出口，技能不登记规范 |

## 三、已弃用/仅参考清单（禁止作为执行依据）

| 文件 | 状态 | 说明 |
|------|------|------|
| `templates/prompt-v4-template.md` 旧版内容 | **已弃用** | 8 步结构 / 990 字符上限均已失效，该文件现为指引页 |
| `SYSTEM.md` 中 v6.x 编号 | 仅子系统历史编号 | 与系统版本无关 |
| `REALISM-ENHANCER.md`（根目录） | 子系统文档 | Realism Enhancement 子系统说明，非系统规范入口 |
| `docs/` 下各文档 | 参考 | 运营/背景材料，非执行规范 |

## 四、给 AI Agent 的执行前预检（Step 0）

**单命令入口**：

```bash
node scripts/agent-preflight.js          # 人类可读规范卡
node scripts/agent-preflight.js --json   # 机器可读 JSON
```

该命令自动完成：工作区完整性检查（克隆文件丢失防护）、版本号确认、版本三源一致性校验、
内容镜头/片头字段全量提取（实时解析 prompt-fusion-agent.js，非硬编码）、长度标准读取
（实时读取 prompt-length.js）、中间环节交付物格式提取（实时解析三个引擎模块的生成函数）、
内容精炼六类规则提取（实时解析 field-content-refiner.js）、文档陈旧字面值扫描
（980/990/1400-1500/MAX_PROMPT_LENGTH 等字面值无失效标注出现于文档即阻断）、执行纪律输出。
退出码 0 = 可执行，1 = 有阻断项必须先修复。

**退出码非 0 时禁止继续执行**；退出码为 0 时，规范卡输出即为执行依据，无需再逐项人工阅读下列文件
（需要深入实现细节时再读）：

1. 本文件（SPEC-AUTHORITY.md）
2. `package.json` → 确认版本号
3. `scripts/version-check.js` 运行结果 → 三源必须一致
4. `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js` → 字段组装逻辑
5. `hyperreality-system/config/prompt-length.js` → 长度标准
6. `hyperreality-system/index.js` 审核报告生成段落 → 最终交付物包装格式

**未运行 agent-preflight 或预检未通过的产出，视为未按系统规范执行。**
