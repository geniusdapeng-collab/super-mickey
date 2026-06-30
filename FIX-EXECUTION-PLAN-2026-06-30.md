# 降级问题修复执行方案 v1.0

**日期**: 2026-06-30  
**状态**: Phase 1 已实施，待验证  
**提交**: `efdb53b`

---

## 一、根因确认（已完成）

### 1.1 真正原因

**不是** LLM 不稳定，**不是** Prompt 太长，**不是** 网络问题。

**真正原因**：`totalDeadlineMs = 1050000ms = 17.5 分钟`，但实际预生产流程需要 **30+ 分钟**。

当全局 deadline 过期后，`base-agent.js` 中的逻辑：
```javascript
if (perCallTimeout < 20000) {
  return this._executeFallback(fallbackFn, 'insufficient time budget');
}
```

强制所有后续 LLM 调用降级。这就是 83.3% 降级率的根源。

### 1.2 证据

- S-2 未降级（在 deadline 过期前完成）
- S-1, S-3-S-6 全部降级（degradeReason = "主LLM失败,规则兜底"）
- 测试总耗时 1954 秒（32.5 分钟）> 17.5 分钟 deadline

---

## 二、Phase 1 紧急修复（已实施）

### 2.1 修复 1：提升全局时间预算

**文件**: `production-engine.js`
**改动**:
```javascript
// 修复前
totalDeadlineMs: 1050000 // 17.5分钟

// 修复后  
totalDeadlineMs: 2400000 // 40分钟
```

**效果**: 全局 deadline 从 17.5 分钟提升到 40 分钟，覆盖实际 30+ 分钟的运行时间。

### 2.2 修复 2：移除 deadline 过期强制降级

**文件**: `base-agent.js`
**改动**:
```javascript
// 修复前
if (perCallTimeout < 20000) {
  console.warn(`剩余预算不足，提前降级`);
  return this._executeFallback(fallbackFn, 'insufficient time budget');
}

// 修复后
if (perCallTimeout < 20000) {
  console.warn(`⚠️ 剩余预算不足，但仍尝试 LLM 调用（不自动降级）`);
  // 继续执行，不 return fallback
}
```

**效果**: 即使时间预算紧张，也继续尝试 LLM 调用，不自动降级。

### 2.3 修复 3：提升 PromptFusion 重试次数

**文件**: `prompt-fusion-agent.js`
**改动**:
```javascript
// 修复前
constructor(options = {}) {
  super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 300000, ...options });
  // llmMaxRetries 继承 BaseAgent 默认值 = 2
}

// 修复后
constructor(options = {}) {
  super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 300000, llmMaxRetries: 5, ...options });
}
```

**效果**: 主调用从 2 次重试提升到 5 次，增加成功概率。

### 2.4 修复 4：提升补齐调用重试和超时

**文件**: `prompt-fusion-agent.js` `_ensureFieldCompleteness`
**改动**:
```javascript
// 修复前
const fillResult = await this._callLLM(fillPrompt, fillSchema, () => null, {
  maxRetries: 1,
  maxTokens: 4096,
  timeoutMs: 45000 // 45秒
});

// 修复后
const fillResult = await this._callLLM(fillPrompt, fillSchema, () => null, {
  maxRetries: 3,
  maxTokens: 4096,
  timeoutMs: 90000 // 90秒
});
```

**效果**: 字段补齐从 1 次重试/45秒 提升到 3 次/90秒。

### 2.5 修复 5：process() 增加主调用重试

**文件**: `prompt-fusion-agent.js` `process()`
**改动**:
```javascript
// 修复前：_fuseSingleShot 失败 → 直接补全 → 兜底
catch (e) {
  const filled = await this._fillMissingFieldsWithRetry(shot, ratio, characters);
  // 补全失败 → 规则兜底
}

// 修复后：增加 3 次主调用重试（指数退避）
catch (e) {
  for (let retry = 1; retry <= 3; retry++) {
    await new Promise(r => setTimeout(r, 2000 * retry));
    fused = await this._fuseSingleShot(shot, ratio, characters);
    if (fused) break;
  }
  // 重试后仍失败 → 补全 → 已有字段组装 → 最后兜底
}
```

**效果**: 主调用失败后先重试 3 次，不轻易降级。

---

## 三、待实施 Phase 2（本周）

### 3.1 Phase 2 降级策略

目标：Phase 2（VisualAudio）主动降级，释放时间给 Phase 3。

```javascript
// VisualLanguage 降级
visualLanguage.degradeTo({ sceneType: true, mood: true }); // 只保留2个字段

// AudioDesign 降级  
audioDesign.degradeTo({ hasDialogue: true }); // 只保留标记

// ContinuityReview 跳过
continuityReview.skip(); // Phase 3 会处理一致性
```

### 3.2 断点续跑

新增 `preproduction-state.js`：
- 每个镜头独立保存状态
- 已成功的镜头不重新跑
- 失败的镜头可单独重试

### 3.3 Prompt 瘦身

- 精简 800+ 行 system prompt
- 分段请求：先核心字段(P0)，再增强字段(P1)

---

## 四、验证计划

### 4.1 立即验证（今天）

重新跑预生产测试，检查：
- [ ] 降级率是否从 83.3% 降到 <20%
- [ ] S-1, S-3-S-6 是否不再降级
- [ ] 总耗时是否在 40 分钟内

### 4.2 稳定性验证（本周）

连续跑 10 次预生产测试，统计：
- [ ] 平均降级率
- [ ] 平均耗时
- [ ] LLM 调用成功率

---

## 五、关键决策记录

| 决策 | 原因 |
|------|------|
| totalDeadlineMs 40 分钟 | 实际测试需 30+ 分钟，预留 10 分钟余量 |
| 不移除 deadline 机制 | 保留全局时间感知，但改为警告不强制 |
| 主调用重试 5 次 | LLM 偶发失败，5 次覆盖绝大多数抖动 |
| 补全重试 3 次 | 补全是轻量调用，3 次足够 |
| 指数退避 2s/4s/6s | 避免连续请求触发 API 限流 |

---

## 六、提交记录

```
提交: efdb53b
文件: 3 files changed, 50 insertions(+), 15 deletions(-)
```

**修改文件**:
- `engines/production-engine/production-engine.js` — 提升 deadline
- `engines/production-engine/agents/base-agent.js` — 移除强制降级
- `engines/production-engine/agents/prompt-fusion-agent.js` — 提升重试+增加重试逻辑

---

**下一步**: 重新跑预生产测试验证修复效果。
