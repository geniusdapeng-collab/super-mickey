# 降级根因深度分析与机制性解决方案

**分析时间**: 2026-06-30  
**分析对象**: Hyperreality 预生产系统（25字段）  
**核心问题**: 5/6 镜头降级（83.3%），LLM 推理被规则兜底替换，丧失创作灵气

---

## 一、降级根因分析

### 1.1 降级路径追踪

```
fuseSingleShot(shot)
  → _callLLM(prompt, schema, fallbackFn)
    → llm.reasonStructured(fullPrompt, schema, options)
      → reason(structuredPrompt, {forceJson: true, ...})
        → _fetchWithTimeout(url, options, timeoutMs)
          ← 返回失败: success=false, error="xxx"
    ← 执行 fallbackFn() → 标记 degraded=true
  ← 标记 degradeReason="主LLM失败,规则兜底"
```

### 1.2 当前降级触发点

| 触发位置 | 触发条件 | 影响 |
|---------|---------|------|
| `base-agent.js:104` | Agent disabled | 全局降级 |
| `base-agent.js:109` | LLM引擎不可用 | 全局降级 |
| `base-agent.js:132` | 剩余预算 < 20s | 提前降级 |
| `base-agent.js:147` | reasonStructured 返回 success=false | LLM调用失败 |
| `base-agent.js:152` | Schema校验失败 | 数据格式降级 |
| `prompt-fusion-agent.js:186` | 补全也失败 | 规则兜底 |
| `prompt-fusion-agent.js:245` | usedFallback=true | 标记降级 |

### 1.3 具体失败原因（推测）

由于测试日志未保留详细错误信息，根据代码分析，LLM 失败可能原因：

**A. API 调用层面**
- API Key 缺失/失效（`LLMEngine._noApiKey` 检查）
- 网络超时（`_fetchWithTimeout` 超时）
- API 限流/服务不可用（HTTP 429/5xx）

**B. Prompt 层面**
- Prompt 过长，超过模型上下文窗口（当前 `maxTokens: 16000`）
- System prompt 过于复杂（800+行 JSON schema），导致模型难以聚焦
- 25字段 schema 要求过于严格，模型输出被截断

**C. 解析层面**
- 模型返回非 JSON 格式（markdown 代码块、解释文本）
- JSON 字段缺失（schema 要求 25 个字段，模型可能漏掉部分）
- 字段值类型错误（字符串/数组/对象不匹配）

### 1.4 当前降级机制设计缺陷

| 缺陷 | 说明 | 后果 |
|------|------|------|
| **自动兜底** | LLM 失败后立即调用 `_fallbackSingleShot` | 用户无感知，无法选择重试或中止 |
| **单点故障** | 一个镜头失败不影响其他，但全部走兜底 | 整体质量下降 |
| **预算分配不均** | Phase 2 消耗过多时间，Phase 3 时间不足 | Phase 3 被迫降级 |
| **无断点续跑** | 失败后无法只重试失败镜头 | 必须重新跑完整流程 |
| **字段耦合** | 25字段一次性全部请求 | 任一字段失败即整体降级 |

---

## 二、机制性解决方案（底线：不降级）

### 2.1 核心设计原则

1. **关键层（Phase 3 PromptFusion）绝不降级** — 这是创作灵魂
2. **非关键层（Phase 2）可降级** — 但不能影响 Phase 3 的预算
3. **失败即停** — LLM 失败时不自动兜底，让用户决定重试或调整
4. **断点续跑** — 支持只重试失败的镜头
5. **字段解耦** — 支持分批次/分镜头调用 LLM

### 2.2 方案 A：强化重试 + 预算保障（推荐）

```javascript
// prompt-fusion-agent.js
async fuseSingleShot(shot, ratio, characters, retryOptions = {}) {
  const { maxRetries = 5, timeoutMs = 300000 } = retryOptions; // 5分钟/镜头
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. 简化 prompt：只传必要上下文
      const minimalPrompt = this._buildMinimalPrompt(shot, ratio, characters);
      
      // 2. 分段请求：先请求核心字段（P0），再请求增强字段（P1）
      const coreFields = ['director_instruction', 'constraint', 'baseline', 'scene', 
                          'lighting', 'camera_movement', 'character', 'action', 'negative'];
      const coreResult = await this._callLLMWithGuarantee(minimalPrompt, coreFields);
      
      // 3. 核心字段成功后再请求增强字段
      if (coreResult.success) {
        const enhancedFields = ['composition', 'color_palette', 'depth_of_field', ...];
        const enhancedResult = await this._callLLMWithGuarantee(minimalPrompt, enhancedFields);
        // 合并结果...
      }
      
      return result; // 成功，不标记降级
    } catch (err) {
      console.warn(`尝试 ${attempt}/${maxRetries} 失败: ${err.message}`);
      if (attempt === maxRetries) {
        // 【关键】失败即停，不兜底，抛出错误让用户决定
        throw new Error(`镜头 ${shot.shotId} LLM 融合失败，已达到最大重试次数: ${err.message}`);
      }
      // 指数退避等待
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 30000)));
    }
  }
}
```

**关键改动**：
- `maxRetries` 从 2 次提升到 5 次
- `timeoutMs` 从 180s 提升到 300s（5分钟/镜头）
- **移除 `_fallbackSingleShot` 自动兜底**，改为抛出错误
- 分段请求：先核心字段，后增强字段

### 2.3 方案 B：时间预算重分配

当前预算分配（6镜头，总预算 1800s）：
```
Phase 1 (SceneDesign): ~150s
Phase 2 (VisualAudio): ~600s（可以降级或简化）
Phase 3 (PromptFusion): ~1050s（180s/镜头 × 6）
```

问题：Phase 2 消耗了 1/3 时间，但产出的 VisualLanguage 和 AudioDesign 在降级时直接被丢弃。

**重分配建议**：
```
Phase 1: 150s（不变）
Phase 2: 300s（简化，允许降级，只保留最核心信息）
Phase 3: 1350s（225s/镜头 × 6）
```

Phase 2 降级策略：
- VisualLanguage 降级 → 只保留 `sceneType` 和 `mood`
- AudioDesign 降级 → 只保留 `hasDialogue` 标记
- ContinuityReview 降级 → 跳过（Phase 3 会处理一致性）

### 2.4 方案 C：断点续跑 + 增量生成

```javascript
// 新增：状态保存与恢复
class PreproductionState {
  constructor(projectId) {
    this.projectId = projectId;
    this.completedShots = new Map(); // 已完成的镜头
    this.failedShots = new Map();    // 失败的镜头
    this.pendingShots = [];          // 待处理的镜头
  }
  
  save() {
    fs.writeFileSync(`state-${this.projectId}.json`, JSON.stringify({
      completed: Array.from(this.completedShots.entries()),
      failed: Array.from(this.failedShots.entries()),
      pending: this.pendingShots
    }));
  }
  
  load() {
    // 从文件恢复状态...
  }
}

// 主流程
async runPreproduction() {
  const state = new PreproductionState(projectId);
  state.load(); // 尝试恢复之前的状态
  
  for (const shot of state.pendingShots) {
    try {
      const result = await this.fuseSingleShot(shot); // 不降级
      state.completedShots.set(shot.shotId, result);
    } catch (err) {
      state.failedShots.set(shot.shotId, err.message);
      // 继续处理下一个镜头，不阻塞
    }
    state.save();
  }
  
  // 如果有失败镜头，提供重试选项
  if (state.failedShots.size > 0) {
    return {
      success: 'partial',
      completed: state.completedShots.size,
      failed: Array.from(state.failedShots.entries()),
      message: `${state.failedShots.size} 个镜头需要重试`
    };
  }
}
```

### 2.5 方案 D：Prompt 瘦身（减少失败概率）

当前 PromptFusion system prompt 约 800+ 行，包含完整的 25 字段 schema。

**问题**：
- Token 消耗大，容易触发模型输出限制
- 信息过载，模型难以聚焦

**瘦身策略**：
1. **分级 schema**：只传当前镜头需要的字段，不传全部 25 个
2. **示例精简**：每个字段只给 1 个示例，而不是完整模板
3. **上下文裁剪**：只传与该镜头相关的 Layer 1/2 数据，不传全部
4. **字段分组**：按优先级分批请求（P0 字段一批，P1 字段一批）

---

## 三、相关代码位置

| 文件 | 关键函数/行 | 说明 |
|------|-----------|------|
| `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js:229` | `_fuseSingleShot` | 主 LLM 调用入口 |
| `hyperreality-system/engines/production-engine/agents/prompt-fusion-agent.js:494` | `_fallbackSingleShot` | 规则兜底实现 |
| `hyperreality-system/engines/production-engine/agents/base-agent.js:104` | `_callLLM` | LLM 调用 + fallback 触发 |
| `hyperreality-system/systems/llm-reasoning-engine.js:397` | `reasonStructured` | LLM 结构化输出 |
| `hyperreality-system/engines/production-engine/phase-orchestrator.js` | `runPhase3` | Phase 3 编排 |

---

## 四、建议实施步骤

### Phase 1：紧急修复（今天完成）
1. **提升重试次数**：`maxRetries: 2 → 5`
2. **提升超时时间**：`perCallTimeout: 180s → 300s`
3. **移除自动兜底**：LLM 失败时抛出错误，不自动 fallback

### Phase 2：架构优化（本周完成）
1. **时间预算重分配**：Phase 2 降级，释放时间给 Phase 3
2. **断点续跑**：保存中间状态，支持失败镜头单独重试
3. **Prompt 瘦身**：精简 system prompt，分段请求

### Phase 3：长期优化（下周完成）
1. **字段解耦**：核心字段和增强字段分开调用
2. **智能预算**：根据镜头复杂度动态分配时间
3. **质量门控**：Phase 3 增加输出质量检查，不达标则重试

---

## 五、关键决策点

**需要大鹏确认的问题**：

1. **失败策略**：LLM 失败时是「自动重试 5 次」还是「立即停止等用户处理」？
2. **时间容忍**：单镜头最长能接受多少秒？（当前 180s，建议 300s）
3. **降级底线**：哪些模块绝对不能降级？（Phase 3 PromptFusion？DirectorOptimization？）
4. **分镜头处理**：是否接受先跑完能成功的镜头，失败的后补？（类似断点续跑）

---

*这份分析基于代码审查和日志推断。如需更精确的根因，需要保留完整 LLM 调用日志（包括请求体、响应体、错误信息）。*
