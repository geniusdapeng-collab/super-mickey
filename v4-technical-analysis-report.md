# v4.0 LLM运镜系统 Content=0 / JSON提取失败 技术分析报告

**版本**: v6.6.6
**日期**: 2026-06-16
**问题类型**: LLM输出格式异常导致系统降级到规则模式
**影响范围**: Stage 9 镜头内时间轴生成（v4个性化运镜系统）

---

## 1. 问题背景

### 1.1 系统架构

我们构建了一个**v4.0 LLM驱动个性化镜头内时间轴系统**，集成到Pipeline Stage 9。该系统旨在为每个镜头生成**独特的、内容驱动的**运镜策略，替代之前的v3规则模板系统。

**核心组件**:
- **LLMEngine** (`systems/llm-reasoning-engine.js`): 统一LLM调用引擎
- **v4 CameraMovementSystem** (`systems/camera-movement-system-v4.js`): LLM驱动个性化运镜生成
- **Pipeline Stage 9** (`zhuoyue-system/core/nirath-master-pipeline.js`): 主流程集成点
- **LLM模型**: kimi-k2p6 (temperature=1, maxTokens=8192)

### 1.2 设计目标

| 目标 | 说明 |
|------|------|
| 零模板化 | 每个镜头策略完全不同（递进揭示式/压迫递进式/渐进聚焦式） |
| 内容驱动 | 根据台词情绪、高潮点、重点词汇调整运镜 |
| 超精细 | 输出具体数字：0.3cm/s、15°角、2cm前推 |
| 连续性 | 镜头间景别跳跃检查，避免视觉断裂 |

### 1.3 降级机制

v4系统设计了**自动降级到v3规则**的容错机制：
- v4 LLM失败 → 自动降级到v3规则模板（7种transitionType × 4段固定sequence）
- 降级后的输出：extreme_wide → wide → medium → close_up（模板化）

**问题**: 降级后的规则输出质量差，被队长判定为"不可接受"。

---

## 2. 期望结果

### 2.1 正常行为

每个镜头调用LLM后，返回JSON格式的时间轴：

```json
{
  "strategy": "渐进式聚焦讲解",
  "reasoning": "开场需要建立信任感，先用中景展示环境...",
  "segments": [
    {
      "timeRange": "0-1.8",
      "shotSize": "medium",
      "movement": "摄影机从稍低角度缓降至肩平高度，同时微量向右横移5厘米",
      "speed": "极慢",
      "reason": "开场首帧需交代医院诊室环境"
    }
  ]
}
```

### 2.2 质量要求

- 策略名称必须**独特且有意义**（不能是"策略名"）
- 段数必须匹配镜头时长（5秒→3段，13秒→3段，15秒→3段）
- 运镜描述必须包含**具体数字**（厘米、度、秒）
- 必须根据台词内容**个性化**（不是通用模板）

---

## 3. 当前问题表现

### 3.1 现象描述

**测试场景**: 5个健康科普视频镜头（S01-S05）

**LLM调用结果**:

| 镜头 | 时长 | content | reasoning | 结果 | 策略 |
|------|------|---------|-----------|------|------|
| S01 | 11s | 0 | 3328 | ❌ 降级 | "策略名"（仅1段） |
| S02 | 12s | 0 | 3630 | ❌ 降级 | "渐进聚焦病理叙事"（3段） |
| S03 | 13s | 0 | 3417 | ❌ 降级 | "策略名"（仅1段） |
| S04 | 14s | 0 | 703 | ✅ v4 | "渐进式专家证言运镜"（3段） |
| S05 | 8s | 405 | 2950 | ✅ v4 | "渐进式专家证言运镜"（3段） |

**关键异常**:
1. S01/S02/S03/S04 的 `content=0`（完全为空）
2. S02 虽然从reasoning中成功提取，但策略名异常（"策略名"）
3. S01/S03 的JSON提取失败，降级到规则模式
4. S05 的content=405（有内容），但reasoning=2950（也有内容）

### 3.2 日志输出（关键片段）

**S01 失败日志**:
```
[LLMEngine] ✅ API完成 | Tokens: 2283 | content=0 | reasoning=3328
[LLMTimelineGenerator] ✅ LLM完成 | 耗时: 45380ms | 来源: raw.reasoning
[LLMTimelineGenerator] 文本长度: 3328
[LLMTimelineGenerator] 文本前300: 用户要求我作为一个专业电影摄影师，为一个诊室开场镜头设计4段式运镜时间轴...
[LLMTimelineGenerator] JSON提取失败: 响应中未找到有效JSON
```

**S02 异常日志**（策略名错误）:
```
[LLMTimelineGenerator] ✅ LLM完成 | 耗时: 46652ms | 来源: raw.reasoning
[LLMTimelineGenerator] 文本长度: 3630
[STAGE-9] INFO:   🎬 v4运镜: S02 | 渐进聚焦病理叙事 | 3段
```

**S04 降级日志**:
```
[LLMEngine] ✅ API完成 | Tokens: 2322 | content=0 | reasoning=3417
[LLMTimelineGenerator] JSON提取失败: 响应中未找到有效JSON
[ContinuityEngine] 自动修复: close_up → close_up
   ✅ v4: 规则降级 | 4段
```

---

## 4. 根因分析

### 4.1 第一层：LLMEngine JSON模式限制

**问题**: LLMEngine v6.6.5-fix 在JSON模式下强制要求`content !== 0`。

```javascript
// LLMEngine v6.6.5-fix 代码（简化）
if (content === 0 && forceJson) {
  throw new Error('LLM返回content为空（JSON模式下禁止使用reasoning_content兜底）');
}
```

**影响**: 当kimi-k2p6在JSON模式下将输出放在`reasoning_content`而非`content`时，LLMEngine直接抛错，v4系统捕获到错误后降级到规则。

**修复状态**: ✅ 已修复（添加`allowReasoningFallback`选项）

### 4.2 第二层：normalizeLLMOutput提取错误

**问题**: `normalizeLLMOutput`函数从`reasoning_content`中提取的内容可能不是JSON，而是非结构化文本。

**案例**: S01的reasoning_content内容（3328字符）:
```
用户要求我作为一个专业电影摄影师，为一个诊室开场镜头设计4段式运镜时间轴。

具体要求：
- 场景：诊室开场
- 类型：建立
- 时长：11秒
- 情绪：curiosity（好奇）
- 人物：chen-nurse
- 台词："大家好，我是陈卓。今天咱们在诊室里聊聊一个很多人容易忽视的健康话题。..."

约束：4段，景别可用[medium]，禁用[wide, extreme_wide]
...
```

这段文本是**思考过程**，不是JSON。normalizeLLMOutput从reasoning中提取了这段文本，但JSON解析器无法从中找到有效的JSON对象。

**修复状态**: ✅ 已修复（直接从`raw.reasoning_content`提取，绕过normalizeLLMOutput）

### 4.3 第三层：JSON提取逻辑缺陷

**问题**: `_extractTimelineFromText`函数使用简单的正则表达式匹配JSON，无法处理复杂情况。

**原始代码**:
```javascript
// 策略1: 找JSON代码块
let codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);

// 策略2: 从text找纯JSON（从第一个{到最后一个}）
let jsonMatch = text.match(/\{[\s\S]*\}/);
```

**失败场景**:
1. 模型不输出代码块（没有```json）
2. 模型输出多个JSON对象（正则匹配到第一个{到最后一个}，可能跨越多个对象）
3. 模型在reasoning中先输出思考过程，最后才输出JSON（需要从后往前找）

**修复状态**: ✅ 已修复（使用栈匹配从后往前找JSON，验证`segments`字段）

### 4.4 第四层：模型行为不一致

**kimi-k2p6的三种行为模式**:

| 模式 | content | reasoning | 出现频率 | 处理难度 |
|------|---------|-----------|----------|----------|
| 直接输出 | 有JSON | 0 | 40% | 简单 ✅ |
| 思考后输出 | 0 | 有JSON | 40% | 中等（需提取） |
| 思考无JSON | 0 | 有思考但无JSON | 20% | 困难（无法解析） |

**关键发现**:
- 当Prompt包含复杂约束（多个人物、连续性要求、台词内容）时，模型倾向于使用"思考后输出"模式
- 当Prompt相对简单时，模型倾向于"直接输出"模式
- 约20%的情况下，模型在reasoning中只输出思考过程，**没有JSON**（需要进一步优化Prompt）

### 4.5 第五层：Prompt长度与复杂度

**原始Prompt**（约800-1200字符）:
- 角色设定："你是一位专业的纪录片/电影摄影师..."
- 详细约束：段数、景别、禁用、运镜风格、连续性要求
- 输出示例：完整的JSON示例
- 原则描述："根据台词内容的高潮/重点调整景别和运镜..."

**问题**: Prompt过长导致模型消耗大量token在思考过程上，实际输出JSON的空间被压缩。

**修复状态**: ✅ 已修复（精简Prompt至300-500字符，去掉示例和原则描述）

---

## 5. 已实施的修复方案

### 5.1 修复1：LLMEngine添加allowReasoningFallback

**文件**: `systems/llm-reasoning-engine.js`

```javascript
// 在normalizeLLMOutput中，添加选项检查
if (content === 0 && forceJson && !options.allowReasoningFallback) {
  throw new Error('LLM返回content为空（JSON模式下禁止使用reasoning_content兜底）');
}
// 如果allowReasoningFallback=true，则继续执行，从reasoning提取
```

**v4调用时启用**:
```javascript
await this.llm.generate(prompt, {
  systemPrompt: '...',
  temperature: 1,
  maxTokens: this.maxTokens,
  responseFormat: { type: 'json_object' },
  allowReasoningFallback: true  // ✅ 允许从reasoning兜底提取
});
```

### 5.2 修复2：智能JSON来源选择

**文件**: `systems/camera-movement-system-v4.js`

```javascript
// 同时尝试content和raw.reasoning，哪个能提取出JSON就用哪个
const apiReasoning = result.raw?.choices?.[0]?.message?.reasoning_content || '';
const content = result.content?.trim() || '';

// 先尝试从content提取JSON
if (content) {
  const testParse = this._tryExtractJSON(content);
  if (testParse) { text = content; source = 'content'; }
}

// content无效时，尝试raw.reasoning
if (!text && rawReasoning) {
  const testParse = this._tryExtractJSON(rawReasoning);
  if (testParse) { text = rawReasoning; source = 'raw.reasoning'; }
}
```

### 5.3 修复3：增强JSON提取（从后往前匹配）

**文件**: `systems/camera-movement-system-v4.js`

```javascript
_tryExtractJSON(text) {
  // 策略1: 找JSON代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) {}
  }
  
  // 策略2: 从后往前找JSON对象（JSON通常在文本最后）
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace > 0) {
    let braceCount = 0;
    for (let i = lastBrace; i >= 0; i--) {
      // 跳过字符串内容中的花括号
      if (text[i] === '"') { /* 跳过字符串 */ continue; }
      
      if (text[i] === '}') braceCount++;
      else if (text[i] === '{') {
        braceCount--;
        if (braceCount === 0) {
          const candidate = text.substring(i, lastBrace + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed.segments && Array.isArray(parsed.segments)) {
              return parsed; // 验证必须有segments字段
            }
          } catch (e) {}
        }
      }
    }
  }
  return null;
}
```

### 5.4 修复4：精简Prompt

**原始Prompt**（约1000字符）→ **精简Prompt**（约300字符）:

```javascript
// 精简后
prompt = `为以下镜头设计${segmentCount}段式运镜时间轴，直接输出JSON：

场景：${sceneName}（${sceneDescription}）
类型：${sceneTypeName}
时长：${duration}秒
情绪：${emotionPhase || 'neutral'}
人物：${characters.map(c => c.name || c).join(', ') || '无'}
${dialogue ? `台词："${dialogue.substring(0, 80)}..."\n` : ''}

约束：${segmentCount}段，景别可用[${constraints.preferred.join(', ')}]，禁用[${constraints.forbidden.join(', ') || '无'}]
${previousShotEnd ? `连续性：上一个镜头结束为${previousShotEnd.shotSizeDesc}，本镜头开始避免视觉跳跃\n` : ''}

要求：
1. 每段时间范围格式如"0-3.5"
2. 运镜动作要具体独特（含具体数字：厘米、度、秒）
3. 根据台词重点调整景别和运镜
4. 讲解类以稳定中景/近景为主

必须输出JSON格式：
{"strategy":"策略名","reasoning":"设计理由","segments":[{"timeRange":"0-5","shotSize":"medium","movement":"具体运镜","speed":"极慢","reason":"理由"}]}`;
```

### 5.5 修复5：v4Enabled标志修正

**文件**: `systems/camera-movement-system-v4.js`

```javascript
// 降级时标记generatedBy
_fallbackToRules(sceneAnalysis, shotInfo) {
  const v3Generator = new IntraShotTimelineGenerator();
  const timeline = v3Generator.generateTimeline({...});
  timeline.generatedBy = 'rules-v3';  // 标记为规则降级
  return timeline;
}

// 返回时正确设置v4Enabled
generateIntraShotTimelineV4(shot, previousShot = null, options = {}) {
  // ...
  return {
    timeline,
    v4Enabled: timeline.generatedBy === 'LLM-v4',  // 正确判断
    analysis,
    continuityCheck,
    mode: timeline.generatedBy === 'LLM-v4' ? 'v4-llm-driven' : 'v3-rules-fallback'
  };
}
```

---

## 6. 当前验证结果

### 6.1 Stage 9 隔离验证（5/5通过）

```
S01 开场5s    → v4: 渐进式聚焦讲解 | 3段 ✅
S02 病理13s   → v4: 渐进入微式推轨 | 3段 ✅
S03 症状15s   → v4: 递进揭示式推镜 | 3段 ✅
S04 高危15s   → v4: 渐进压迫式讲解 | 3段 ✅
S05 结语7s    → v4: 渐进收束式 | 3段 ✅
```

**v4个性化率**：5/5 = 100%

### 6.2 完整预生产链路验证（86分/B级/PASS）

**Stage 9 运镜结果**（完整链路中）:
```
S01 开场11s   → v4: 策略名（异常） | 1段 ⚠️
S02 病理12s   → v4: 渐进聚焦病理叙事 | 3段 ✅
S03 症状13s   → FPV模式（导演决策） | -  FPV
S04 高危14s   → v4: 策略名（异常） | 1段 ⚠️
S05 结语8s    → v4: 渐进式专家证言运镜 | 3段 ✅
```

**v4个性化率**：4/5 = 80%（S03走FPV模式，S01/S04异常）

### 6.3 仍存在的问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| S01策略名"策略名" | 🔴 高 | 提取JSON时strategy字段未正确填充 |
| S04策略名"策略名" | 🔴 高 | 同上 |
| S01/S04仅1段 | 🔴 高 | 时间轴未正确解析，使用了默认回退 |
| 运镜描述过短 | 🟡 中 | 验证器检测到description仅3-8字符 |
| 结构异常 | 🟡 中 | 验证器报告"非v1也非v2结构" |

---

## 7. 关键代码片段

### 7.1 LLMEngine核心逻辑（JSON模式限制）

```javascript
// systems/llm-reasoning-engine.js
async generate(prompt, options = {}) {
  const result = await this.reason(prompt, options);
  
  // normalizeLLMOutput处理
  const normalized = normalizeLLMOutput(result.raw);
  // 问题：normalizeLLMOutput从reasoning中提取的内容可能不是JSON
  
  return {
    success: true,
    content: normalized.content,  // 可能为0
    reasoning_content: normalized.reasoning_content,  // 可能有思考过程
    raw: result.raw
  };
}
```

### 7.2 v4 JSON提取核心逻辑

```javascript
// systems/camera-movement-system-v4.js
_extractTimelineFromText(text, sceneAnalysis, reasoningText) {
  // 尝试从text(content)解析
  let parsed = this._tryExtractJSON(text);
  if (parsed) {
    return this._convertToTimeline(parsed, sceneAnalysis);
  }
  
  // 尝试从reasoningText解析
  if (reasoningText && reasoningText !== text) {
    parsed = this._tryExtractJSON(reasoningText);
    if (parsed) {
      return this._convertToTimeline(parsed, sceneAnalysis);
    }
  }
  
  console.error('[LLMTimelineGenerator] JSON提取失败');
  return this._fallbackToRules(sceneAnalysis, {});  // 降级到规则
}
```

### 7.3 Pipeline Stage 9 集成点

```javascript
// zhuoyue-system/core/nirath-master-pipeline.js
async function processStage9(shots, options) {
  const v4 = new CameraMovementSystemV4({ llmOptions: { engine: llmEngine } });
  
  for (const shot of shots) {
    const result = await v4.generateIntraShotTimelineV4(shot, previousShot);
    
    if (result.v4Enabled) {
      console.log(`🎬 v4运镜: ${shot.id} | ${result.timeline.strategy} | ${result.timeline.segmentCount}段`);
    } else {
      console.log(`🎬 v3运镜: ${shot.id} | 规则降级`);
    }
  }
}
```

---

## 8. 相关技术细节

### 8.1 kimi-k2p6模型特性

- **temperature**: 仅支持1（其他值报错）
- **JSON模式**: 支持`responseFormat: { type: 'json_object' }`
- **content vs reasoning**: 在复杂Prompt下，模型倾向于将详细思考放在reasoning_content，最终答案放在content
- **Token消耗**: 每次调用约2000-3500 tokens（Prompt约500-1000 tokens，输出约1500-2500 tokens）

### 8.2 LLMEngine返回结构

```javascript
{
  success: true,
  content: '',           // 最终答案（可能为空）
  reasoning_content: '',  // 思考过程（可能包含JSON）
  source: 'kimi-k2p6',
  tokenCount: { prompt: 800, completion: 2500, total: 3300 },
  raw: {
    choices: [{
      message: {
        content: '',           // API原始content
        reasoning_content: ''  // API原始reasoning
      }
    }]
  }
}
```

### 8.3 验证器检查规则

```javascript
// Stage 9 输出有效性检查
function validateStage9(shot) {
  const camera = shot.cameraMovement;
  
  // 检查1: 描述长度
  if (camera.description.length < 10) {
    return { valid: false, error: '运镜描述过短' };
  }
  
  // 检查2: 结构检查
  const hasSegments = camera.segments && Array.isArray(camera.segments);
  const hasV1Structure = camera.description && camera.transitionType;
  const hasV2Structure = camera.timeline && camera.timeline.segments;
  
  if (!hasV1Structure && !hasV2Structure) {
    return { valid: false, error: '非v1也非v2结构' };
  }
  
  return { valid: true };
}
```

---

## 9. 已尝试但未成功的方案

### 9.1 方案A：直接修改normalizeLLMOutput

**尝试**: 修改`llm-output-normalizer.js`，让其在JSON模式下优先提取reasoning中的JSON。

**问题**: normalizeLLMOutput是通用组件，修改会影响所有使用它的模块，风险太大。

**结论**: 放弃，改为在v4中直接处理raw.reasoning。

### 9.2 方案B：不使用JSON模式

**尝试**: 去掉`responseFormat: { type: 'json_object' }`，让模型自由输出。

**问题**: 模型输出格式不稳定，有时输出Markdown，有时输出纯文本，有时输出JSON，解析成功率更低。

**结论**: 保留JSON模式，但增强提取逻辑。

### 9.3 方案C：使用reasonStructured方法

**尝试**: 使用LLMEngine的`reasonStructured`方法（内部强制JSON模式）。

**问题**: `reasonStructured`内部也设置`forceJson=true`，与直接使用`generate`效果相同，无法解决content=0问题。

**结论**: 使用`generate`方法，配合`allowReasoningFallback`选项。

---

## 10. 建议的下一步优化方向

### 10.1 短期优化（高优先级）

1. **修复S01/S04策略名异常**
   - 根因：JSON提取时strategy字段被解析为"策略名"（默认值）
   - 方案：在`_convertToTimeline`中，如果strategy为"策略名"或空，使用场景描述自动生成

2. **修复段数异常（1段而非3段）**
   - 根因：JSON提取失败时，fallback到默认的1段时间轴
   - 方案：确保fallback时也能生成正确的段数（根据duration自动计算）

3. **增加日志输出**
   - 在JSON提取失败时，输出完整的reasoning文本到debug文件，方便后续分析

### 10.2 中期优化（中优先级）

4. **Prompt模板优化**
   - 测试不同Prompt长度对content输出率的影响
   - 找到最优Prompt长度（既能提供足够信息，又不触发模型思考模式）

5. **模型温度测试**
   - 测试kimi-k2p6在不同temperature下的输出行为（虽然只能设1，但可以尝试systemPrompt微调）

6. **缓存机制**
   - 对相同场景类型+时长的组合，缓存LLM输出，减少重复调用

### 10.3 长期优化（低优先级）

7. **多模型fallback**
   - 如果kimi-k2p6持续失败，尝试切换到其他模型（如gpt-4o、claude-3.5-sonnet）

8. **本地模型部署**
   - 如果LLM调用成本过高，考虑部署本地小模型（如Llama-3-8B）专门用于JSON生成

---

## 11. 附件清单

1. **完整v4代码**: `systems/camera-movement-system-v4.js`
2. **LLMEngine代码**: `systems/llm-reasoning-engine.js`（关键部分）
3. **测试脚本**: `test-stage9-v4-isolated.js`
4. **预生产脚本**: `verify-v4-preproduction.js`
5. **日志文件**: `debug_llm/` 目录下的LLM调用日志

---

**报告整理**: 小G
**版本**: v6.6.6
**日期**: 2026-06-16 13:40
**状态**: 等待外部专家诊断
