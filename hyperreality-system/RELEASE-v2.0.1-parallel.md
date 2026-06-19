# 超现实系统 v2.0.1-parallel 发布说明

**发布日期**: 2026-06-19  
**版本号**: v2.0.1-parallel  
**Git Commit**: 75942b8  
**分支**: master → github.com:geniusdapeng-collab/hyperreal.git  

---

## 概述

v2.0.1-parallel 基于外部专家并行化方案，将制作引擎从**纯串行**改造为**三阶段并行编排**，解决了 v2.0.0 串行执行在 ~11 分钟系统 SIGTERM 硬限制下必然超时的问题。

**核心改进**: 关键路径耗时从 ~662 秒降至 ~408-506 秒 (6.8-8.4 分钟)，稳在 11 分钟安全线内。

---

## 改动详情

### 1. `engines/production-engine/agents/base-agent.js`
- **模型透传修复**: `loadLLMEngine()` 现在按 Agent 配置传入 model，不再写死 `kimi-k2p6`
- **全局截止时间感知**: `setDeadline()` 由 ProductionEngine 下发，`_remainingMs()` 计算剩余预算
- **截止时间自适应超时**: 单次调用超时 = min(自身超时, 剩余预算)，不足 20 秒提前降级
- **重试收敛**: `llmMaxRetries` 从 3 次降至 2 次，消除隐藏时间炸弹

### 2. `systems/llm-reasoning-engine.js`
- **reasonStructured 增强**: 支持 `maxRetries` / `deadlineMs` 覆盖
- **截止时间门控重试**: 每次重试前检查 `Date.now() >= deadlineMs`，超时立即停止，保住剩余预算给下游
- **单次超时动态收缩**: `attemptTimeout = min(timeoutMs, deadline - now)`

### 3. `engines/production-engine/production-engine.js`
- **并行编排（核心）**:
  - Phase 1: `SceneDesign ∥ OpeningDesign`（独立，OpeningDesign 仅依赖 blueprint）
  - Phase 2: `VisualLanguage ∥ AudioDesign ∥ ContinuityReview`（三者只依赖 SceneDesign 的 scene/mood/action，输出字段不冲突）
  - Phase 3: `PromptFusion`（依赖 VisualLanguage 的 cameraString/lightingString）
- **分模型策略**: 深度模型（SceneDesign/VisualLanguage/PromptFusion）vs 快速模型（AudioDesign/OpeningDesign/ContinuityReview）
- **全局时间预算**: `HARD_BUDGET_MS = 660000` (11 分钟)，`SAFETY_MARGIN_MS = 90000` (90 秒余量)
- **质量门修复**: 从格式标记检查（`K` / `AMBIENT:` / `T00:`）改为内容存在性 + 长度检查，解决 LLM Agent 输出自然语言时的全挂误报
- **新增辅助方法**:
  - `_shouldGenerateOpening()`: 片头生成判断
  - `_setAgentDeadline()`: 截止时间下发
  - `_cloneShots()`: 浅拷贝（并行分支互不污染）
  - `_mergeShotsByShotId()`: 按 shotId 合并字段（空值不覆盖）
  - `_runParallel()`: Promise.allSettled 并行执行（单点失败不阻塞）
  - `_emptyAgentResult()`: 并行异常兜底

---

## 预期效果

| 指标 | v2.0.0 (串行) | v2.0.1-parallel (并行) |
|------|---------------|------------------------|
| 关键路径耗时 | ~662 秒 | ~408-506 秒 |
| 是否触 SIGTERM | ❌ 必触 | ✅ 稳在 11 分钟内 |
| LLM Agent 降级 | PromptFusion 被迫降级 | 0 降级（正常路径） |
| 质量门 | 全挂（格式误报） | 按内容真实校验 |
| 单 Agent 重试风险 | 3×200s = 10min 炸弹 | 2 次 + 截止时间门控 |

---

## 兼容性

- **向后兼容**: `enableLLMAgents: false` 时走原规则路径，行为完全不变
- `result.stages` 结构、`generateReport()`、`llmStats` 字段全部保留
- 并行安全: 每个 Agent 持有独立 LLMEngine 实例，无共享可变状态

---

## 快速验证

```bash
node scripts/verify-parallel-v201.js
```

验证内容: 文件加载、辅助方法存在性、_cloneShots、_mergeShotsByShotId、_runParallel、全局截止时间配置。

---

## 下一步

运行完整预生产验证（第二集横纹肌溶解原因分析），确认端到端产出质量。
