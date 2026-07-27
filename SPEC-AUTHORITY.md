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
| 内容镜头 25 字段 | `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js` | 01.【语言约束】→ 25.【角色一致性】，序号化【】标签格式 |
| 片头镜头 30 字段 | 同上（`isOpening` 分支） | 25 标准 + 5 片头专属：主标题内容 / 副标题内容 / 标题动画设计 / 标题字体设计 / 开场音频设计 |
| 字段校验分级 | `hyperreality-system/engines/field-standardizer.js` | P0 致命 12 字段、P1 核心 7 字段、导出前 25 字段非空硬检查 |
| Prompt 长度 | `hyperreality-system/config/prompt-length.js` | TARGET 2470-3000 / HARD_MAX 3000；**990、1400-1500 等旧数字一律无效** |
| 审核报告格式 | `hyperreality-system/index.js`（审核报告生成器） | 镜头总览五列核验（字符数/字段数/定妆照/时间轴/约束）+ 7 条审核须知 |
| 镜头设计卡（中间态） | `templates/shot-card-v4-template.md` | 仅管线内部结构数据，**不是最终渲染 Prompt 格式**，禁止混用 |
| 原始故事文本直通 | 见提交【方案A-fix】系列 | 用户输入原文必须原样进入需求洞察确认单与 PRD 链路 |

## 三、已弃用/仅参考清单（禁止作为执行依据）

| 文件 | 状态 | 说明 |
|------|------|------|
| `templates/prompt-v4-template.md` 旧版内容 | **已弃用** | 8 步结构 / 990 字符上限均已失效，该文件现为指引页 |
| `SYSTEM.md` 中 v6.x 编号 | 仅子系统历史编号 | 与系统版本无关 |
| `SKILL.md`（根目录） | 子系统文档 | Realism Enhancement 子系统说明，非系统规范入口 |
| `docs/` 下各文档 | 参考 | 运营/背景材料，非执行规范 |

## 四、给 AI Agent 的执行前必读清单（Step 0）

按以下顺序读取，读完再执行任何生成任务：

1. 本文件（SPEC-AUTHORITY.md）
2. `package.json` → 确认版本号
3. `scripts/version-check.js` 运行结果 → 三源必须一致
4. `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js` → 25/30 字段组装逻辑
5. `hyperreality-system/config/prompt-length.js` → 长度标准
6. `hyperreality-system/index.js` 审核报告生成段落 → 最终交付物包装格式

**未完成 Step 0 六步阅读的产出，视为未按系统规范执行。**
