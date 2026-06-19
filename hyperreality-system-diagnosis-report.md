# 超现实系统（Hyperreality System）问题全面分析报告

> 版本：v1.0 | 日期：2026-06-19 | 编制：小G（AI助手）
> 用途：供外部专家诊断参考

---

## 一、系统概述

### 1.1 系统定位

**超现实工业创作系统（Hyperreality System）** 是一个面向工业级 AI 视频创作的 Node.js 全链路自动化系统，支持从用户意图到成片交付的完整流程。

- **当前版本**：v1.2.5-fix4
- **架构**：四层工业化架构（剧本引擎 → 制作引擎 → 渲染引擎 → 后期引擎）
- **核心依赖**：火山引擎 Seedance-2.0 API、Kimi k2p6 LLM
- **代码规模**：~50个文件，核心代码约 15,000+ 行

### 1.2 标准预生产流程

```
用户输入 → 需求清单确认 → 剧本生成 → 制作引擎(Prompt生成) → 提示词审核 → 渲染提交
```

**关键约束**：
- Prompt 硬上限：1500 字符（超现实系统扩容）
- 最大并发：3
- 目标时长：62s（当前测试用例）
- 底层约束：禁止旁白(Voiceover)，仅保留台词(Dialogue)

---

## 二、已确认问题（Confirmed Issues）

### 问题 1：剧本生成 JSON 截断（CRITICAL）

**问题背景**：
剧本生成环节调用 LLM（kimi-k2p6）生成结构化 JSON 剧本。由于 LLM 的 reasoning_content 超长（可达 16,573 tokens），导致实际 content 输出被截断，JSON 解析失败。

**期望结果**：
LLM 返回完整的、可解析的 JSON 剧本，无截断。

**现有代码**（script-generator.js 第 290-310 行）：
```javascript
// v1.2.5: 增加maxTokens到16000，防止长推理导致JSON截断
const result = await this.llmEngine.generate(prompt, {
  systemPrompt: '你是一位专业的AI视频编剧，只输出严格格式的JSON。不要输出思考过程，直接输出JSON。',
  maxTokens: 16000,  // 已扩到16000但仍不够
  timeoutMs: this.config.timeout
});
```

**具体报错**：
```
[ScriptGenerator] 剧本生成失败，尝试修复: SyntaxError: Unexpected end of JSON input
```

**已尝试的修复**：
- v1.2.5-fix4: maxTokens 从 16000 扩到 32000
- 在 systemPrompt 中增加"紧凑JSON，禁止多余空格和换行"
- 但仍未完全解决

**根本原因分析**：
- kimi-k2p6 的 reasoning_content 消耗大量 token 预算
- content 和 reasoning_content 共享同一 max_tokens 预算
- 即使 max_tokens=32000，reasoning_content 可能占用 25000+，content 仍被截断

---

### 问题 2：制作引擎输出空镜头（CRITICAL）

**问题背景**：
制作引擎（Production Engine）负责将剧本转换为镜头 Prompt。但在实际运行中，输出的 shots 数组为空或 prompts 数组为空，导致后续提示词审核报告显示"镜头数：0"。

**期望结果**：
制作引擎应输出与剧本场景数量匹配的镜头（如 6 个场景 → 6 个镜头），每个镜头有完整的 Prompt 文本。

**现有代码**（production-engine.js 核心逻辑）：
```javascript
// [PRODUCE] 阶段输出
return {
  shots: shots.map(s => ({
    shotId: s.shotId,
    sceneType: s.sceneType,
    timing: s.timing,
    promptLength: s.prompt?.length,
    status: s.status
  })),
  prompts: productionResult.prompts,  // 可能为空
  quality: productionResult.stages.qualityGate
};
```

**实际运行日志**：
```
[PRODUCE] ✅ 制作完成: 6 镜头, 6 Prompts
   ✅ 制作完成 (6ms)
      镜头: 6 | Prompts: 6
      质量门: 失败
```

**但提示词审核报告**：
```markdown
# 📝 提示词审核报告
**镜头数**: 0
**平均长度**: NaN 字符
```

**关键发现**：
- production-engine.js 日志显示 `6 镜头, 6 Prompts`
- 但 `_generatePromptsReport` 接收到的 `prompts` 数组为空
- 疑似适配层（Adapter）或数据传递过程中丢失数据

---

### 问题 3：适配层数据转换不一致（HIGH）

**问题背景**：
适配层（Adapter）负责将 `ScriptBlueprint`（剧本引擎输出）转换为 `ProductionEngine` 可消费的格式。但字段映射存在不一致。

**期望结果**：
剧本引擎输出的场景数据应完整、准确地传递到制作引擎。

**现有代码**（adapter.js 关键字段映射）：
```javascript
// 字段映射不一致示例
adapted.scenes = blueprint.structure.scenes.map(scene => ({
  shotId: scene.scene_id,  // 使用 scene_id 作为 shotId
  sceneType: scene.scene_type,
  timing: scene.timing,
  scene: scene.scene_name,
  sceneDescription: scene.setting,
  prompt: scene.visual_notes || '',  // visual_notes 可能为空
  dialogue: scene.dialogue?.lines || [],
  characters: scene.characters || [],
  // ... 其他字段
}));
```

**具体问题**：
1. `visual_notes` 字段在剧本中可能为空，导致 `prompt` 为空字符串
2. `shotId` 使用 `scene_id`（如 SC00），但制作引擎期望 `shotId`
3. 定妆照引用路径格式不一致（有时是绝对路径，有时是相对路径）
4. `timeline` 字段在剧本中未生成，制作引擎依赖它做质量检查

**运行日志佐证**：
```
[ScriptEngine] 剧本校验: 失败 (98分)
[Adapter] 适配完成: 6 场景, 1 角色
```

剧本校验 98 分但仍标记为"失败"，说明校验逻辑过于严格或有 bug。

---

### 问题 4：提示词审核报告显示空数据（HIGH）

**问题背景**：
提示词审核环节生成报告时，所有镜头数据为 0 或 NaN。

**期望结果**：
提示词审核报告应正确显示镜头数量、Prompt 长度、定妆照引用等信息。

**现有代码**（_generatePromptsReport 方法）：
```javascript
_generatePromptsReport(prompts) {
  const lines = [];
  lines.push(`**镜头数**: ${prompts.length}`);
  lines.push(`**平均长度**: ${Math.round(prompts.reduce((s, p) => s + p.length, 0) / prompts.length)} 字符`);
  // ...
  for (const p of prompts) {
    const hasImages = (p.imageRefs || []).length > 0;
    const hasTimeline = p.timeline && (p.timeline.start !== undefined || p.timeline.text) ? true : false;
    // ...
  }
}
```

**问题分析**：
- `prompts` 数组传入时为空
- 即使不为空，`p.length` 应为 `p.prompt?.length` 而非 `p.length`（因为 prompt 是对象，不是字符串）
- `p.timeline` 的访问方式可能不正确

---

### 问题 5：剧本确认环节已被移除（已完成）

**状态**：✅ 已修复（2026-06-19）

**背景**：
原流程包含"剧本确认"环节（需求确认 → 剧本确认 → 提示词审核 → 渲染）。队长要求简化为：需求确认 → 直接跑完整预生产 → 提示词审核 → 渲染。

**修复内容**：
- 从 `index.js` 主流程中移除 `_confirmScript` 调用
- 删除 `_confirmScript` 方法和 `_generateScriptReport` 方法
- 剧本生成后自动继续，不等待人工确认

---

### 问题 6：质量门（Quality Gate）逻辑过于严格（MEDIUM）

**问题背景**：
质量门检查所有镜头是否满足：有镜头时间轴、有角色引用、Prompt 长度在限制内。但即使大部分通过，整体仍标记为"失败"。

**期望结果**：
质量门应准确反映镜头质量，区分"硬拦截"和"警告"。

**现有代码**（quality-gate 逻辑）：
```javascript
const qg = productionResult.stages.qualityGate;
// 运行日志显示：质量门: 失败
// 但后续流程继续执行（没有真正拦截）
```

**矛盾点**：
- 日志显示"质量门: 失败"
- 但流程继续进入提示词审核环节
- 说明质量门没有真正阻止流程，只是标记状态

---

### 问题 7：异步确认机制不稳定（MEDIUM）

**问题背景**：
提示词审核环节使用文件轮询机制等待用户确认：写入 MD 文件 → 轮询等待 JSON 确认文件。

**现有代码**（_waitForExternalConfirmation）：
```javascript
async _waitForExternalConfirmation(type, content) {
  // 写入待确认内容
  fs.writeFileSync(contentPath, content, 'utf8');
  
  // 轮询等待确认文件（最多30分钟）
  const maxWait = 120 * 60 * 1000; // 30分钟
  const checkInterval = 3000; // 3秒
  
  while (Date.now() - startTime < maxWait) {
    if (fs.existsSync(confirmPath)) {
      const confirmData = JSON.parse(fs.readFileSync(confirmPath, 'utf8'));
      return { approved: confirmData.approved !== false, ... };
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  return { approved: false, reason: '等待确认超时' };
}
```

**潜在问题**：
1. 轮询间隔 3 秒，CPU 占用虽低但不够实时
2. 超时时间 30 分钟，没有进度反馈
3. 没有处理文件系统权限错误
4. 如果进程崩溃，用户确认文件可能遗留，导致下次运行读取旧数据

---

### 问题 8：模板加载失败回退机制（MEDIUM）

**问题背景**：
剧本生成时尝试加载模板文件，如果文件不存在则使用默认模板。

**运行日志**：
```
[ScriptGenerator] 模板加载失败: /root/.openclaw/workspace/hyperreality-system/engines/script-engine/templates/educational-template.json, 使用默认模板
```

**期望结果**：
模板文件应存在且可被正确加载，或默认模板应足够健壮。

**潜在风险**：
- 默认模板可能不包含教育科普场景的特定优化
- 模板加载失败是静默的（仅 warning 日志），可能掩盖配置问题

---

## 三、潜在问题（Potential Issues）

### 问题 9：系统架构复杂度过高

**观察**：
- 四层架构（剧本 → 制作 → 渲染 → 后期）理论上清晰，但实现中耦合严重
- `index.js` 主流程长达 700+ 行，包含确认逻辑、报告生成、文件保存等杂糅功能
- 适配层（Adapter）作为中间转换层，增加了数据丢失风险

**建议**：
- 考虑将确认机制、报告生成、文件保存抽离为独立模块
- 使用事件驱动架构替代线性流程

---

### 问题 10：错误处理和回退机制不足

**观察**：
- 剧本生成失败时有重试逻辑（最多 3 次），但重试间隔和策略固定
- LLM 返回空 content 时，没有有效的降级方案（如使用 reasoning_content 作为后备）
- 制作引擎输出空数据时，流程仍继续到提示词审核，没有早期终止

**代码片段**（script-generator.js 错误处理）：
```javascript
catch (error) {
  console.error(`[ScriptGenerator] 剧本生成失败，尝试修复:`, error.message);
  // 尝试从错误中提取部分 JSON
  // 但如果完全截断，无法修复
}
```

---

### 问题 11：LLM 引擎与系统其他部分耦合

**观察**：
- `llm-reasoning-engine.js` 是系统级共享模块（位于 `systems/`）
- 但 `script-generator.js` 直接从 `../../../../systems/llm-reasoning-engine.js` 加载
- 路径硬编码，如果目录结构变化会崩溃

**代码**：
```javascript
const LLM_ENGINE_PATH = path.join(__dirname, '../../../../systems/llm-reasoning-engine.js');
```

---

### 问题 12：配置文件分散且缺乏统一加载机制

**观察**：
- `config/error-codes.js` - 错误码定义
- `config/prompt-length.js` - Prompt 长度配置
- `config/quality-dimensions.js` - 质量维度定义
- 但主流程 `index.js` 没有统一加载这些配置，各模块自行 import

---

### 问题 13：缺乏端到端集成测试

**观察**：
- 有单元测试（test-script-engine.js）和集成测试（test-integration.js）
- 但集成测试使用 `skipScriptConfirmation: true` 和 `skipPromptReview: true`
- 没有覆盖完整流程（含确认环节）的自动化测试
- 没有覆盖错误路径的测试（如 LLM 返回空、JSON 截断等）

---

### 问题 14：日志和可观测性不足

**观察**：
- 日志使用 `console.log`，没有结构化日志
- 没有链路追踪（trace ID）
- 没有性能指标收集（各阶段耗时虽打印但未持久化）
- 没有错误上报机制（如 Sentry）

---

### 问题 15：版本管理和升级策略

**观察**：
- `.current-version` 文件记录版本号
- 但版本升级依赖手动修改和 git 提交
- 没有自动版本校验机制
- 多个文件顶部有版本注释，容易遗漏更新

---

## 四、关键运行日志摘录

### 4.1 最近一次运行日志（2026-06-19）

```
🔥 [HyperrealitySystem v1.2.5] 开始创作
   意图: 穿警服的陈卓女士，讲解居民健康护理知识...
   项目: 横纹肌溶解科普-第二集
   流程: 含剧本确认 → 含提示词审核 → 跳过渲染 → 跳过后期

📋 [Layer 0] 需求清单生成 - 解析用户意图...
   ✅ IntentParser 分类: educational (置信度: 1)
   ✅ 规则库解析: 类型=EDU, 时长=62
   ✅ 需求清单生成完成 (2ms)
      类型: EDU | 时长: 62s | 风格: REAL
      角色: 1个 | 结构: 3段

📋 [需求清单确认] 等待人工确认...
   ✅ 收到确认: approved=true

💡 [创意指数] 解析结果: 0.5 (平衡)
   叙事模式: educational | 世界设定: default
   ✅ 创意指数配置已生成，11个能力激活

📖 [Layer 1] 剧本引擎 - 生成结构化剧本...
[ScriptEngine v1.0.0] 开始处理: 横纹肌溶解科普-第二集
[ScriptGenerator] 开始生成剧本: 横纹肌溶解科普-第二集
[ScriptGenerator] 模板加载失败: educational-template.json, 使用默认模板
[ScriptGenerator] 使用LLMEngine调用...
[LLMEngine] ✅ API完成 | Tokens: 9034 | content=4908 | reasoning=16573
[ScriptGenerator] 角色覆盖: 陈卓
[ScriptGenerator] 剧本生成完成: 4243927e-a270-4438-a2d6-23d13a6a0b39, 6 场景
[ScriptEngine] 剧本校验: 失败 (98分)
[Adapter] 适配剧本: 横纹肌溶解科普-第二集
[Adapter] 适配完成: 6 场景, 1 角色
[ScriptEngine] 修复计划: 1 项
[ScriptEngine] 处理完成: 6 场景, 1 角色
   ✅ 剧本生成完成 (161537ms)
      场景: 6 | 角色: 1 | 台词: 14
      校验: 失败 (98分)

🎭 [剧本确认] 等待人工确认...
⏳ [等待确认] script 已输出到: output/confirmations/confirmation-script.md
   ✅ 收到确认: approved=true
   ✅ 剧本已确认，继续制作

🔗 [Adapter] 适配层 - 转换数据格式...

🎬 [Layer 2] 制作引擎 - 生成镜头...
[PRODUCE] 🎬 ProductionEngine 启动 | 深度融合模式
[SCENE-EXTRACTION] 开始...
[ProductionEngine] 时长已精确匹配: 62s
[SCENE-EXTRACTION] 完成 (2ms)
[DURATION-ALLOCATION] 完成 (0ms)
[CAMERA-DESIGN] 完成 (1ms)
[PROMPT-ENGINEERING] 完成 (2ms)
[QUALITY-GATE] 开始...
[QUALITY-GATE] 完成 (1ms)
[CONTINUITY] 完成 (0ms)
[PRODUCE] ✅ 制作完成: 6 镜头, 6 Prompts
   ✅ 制作完成 (6ms)
      镜头: 6 | Prompts: 6
      质量门: 失败

🛡️ [FieldGuard] 输出字段检查...
   ✅ 标准化后: 6 镜头
   ✅ 标准化后: 6 Prompts

📝 [提示词审核] 等待人工确认...
⏳ [等待确认] prompts 已输出到: output/confirmations/confirmation-prompts.md
```

### 4.2 提示词审核报告输出

```markdown
# 📝 提示词审核报告

**镜头数**: 0
**平均长度**: NaN 字符

## 镜头总览

| 镜头 | 长度 | 有定妆照 | 有时间轴 | 有约束 |
|------|------|----------|----------|--------|

## 完整提示词

## ⚠️ 审核须知
...
```

---

## 五、相关代码文件清单

### 5.1 核心引擎文件

| 文件路径 | 行数 | 职责 |
|----------|------|------|
| `hyperreality-system/index.js` | ~700 | 主流程控制器 |
| `hyperreality-system/engines/script-engine/index.js` | ~200 | 剧本引擎入口 |
| `hyperreality-system/engines/script-engine/core/script-generator.js` | ~400 | LLM 剧本生成 |
| `hyperreality-system/engines/script-engine/core/adapter.js` | ~300 | 数据适配层 |
| `hyperreality-system/engines/script-engine/core/script-blueprint.js` | ~200 | 剧本数据模型 |
| `hyperreality-system/engines/script-engine/core/script-validator.js` | ~300 | 剧本校验器 |
| `hyperreality-system/engines/production-engine/production-engine.js` | ~500 | 制作引擎 |
| `hyperreality-system/engines/rendering-engine/rendering-engine.js` | ~400 | 渲染引擎 |
| `hyperreality-system/engines/post-production-engine/post-production-engine.js` | ~500 | 后期引擎 |
| `hyperreality-system/engines/field-guard.js` | ~200 | 字段标准化/校验 |
| `hyperreality-system/engines/field-standardizer.js` | ~300 | 字段标准化器 |
| `systems/llm-reasoning-engine.js` | ~300 | LLM 调用引擎 |

### 5.2 配置文件

| 文件路径 | 职责 |
|----------|------|
| `config/error-codes.js` | 全局错误码 |
| `config/prompt-length.js` | Prompt 长度配置（1500字符上限） |
| `config/quality-dimensions.js` | 6维度质量评分体系 |

### 5.3 扩展和模板

| 文件路径 | 职责 |
|----------|------|
| `engines/script-engine/extensions/nirath-extension.js` | Nirath 世界观扩展 |
| `engines/script-engine/templates/dramatic-template.json` | 戏剧性剧本模板 |
| `engines/script-engine/core/creative-intensity-engine.js` | 创意指数引擎 |
| `core/immutable-shot.js` | 不可变镜头对象 |

---

## 六、环境信息

- **Node.js 版本**：v24.15.0
- **操作系统**：Linux 6.8.0-71-generic (x64)
- **API 端点**：https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
- **LLM 端点**：https://agent-gw.kimi.com/coding/v1/chat/completions
- **Seedance 接入点**：ep-20260518004622-jp46s
- **Seedance Fast 接入点**：ep-20260518003432-n8v8f
- **图片接入点**：ep-20260518004750-lz76f（Seedream-5.0-lite）

---

## 七、优先级排序

| 优先级 | 问题 | 影响 | 建议行动 |
|--------|------|------|----------|
| P0 | 问题1：JSON 截断 | 剧本生成完全失败 | 1) 使用流式输出 2) 分块生成 3) 换用支持更长输出的模型 |
| P0 | 问题2：制作引擎空输出 | 无法生成 Prompt | 1) 检查适配层数据传递 2) 增加调试日志 3) 验证字段映射 |
| P1 | 问题3：适配层不一致 | 数据丢失/错位 | 1) 统一字段命名 2) 增加 Schema 校验 3) 写入单元测试 |
| P1 | 问题7：确认机制不稳定 | 用户体验差 | 1) 使用事件/回调替代轮询 2) 增加 WebSocket 支持 |
| P2 | 问题6：质量门逻辑 | 误报/漏报 | 1) 重新定义通过标准 2) 区分警告和错误 |
| P2 | 问题10：错误处理不足 | 流程脆弱 | 1) 增加降级方案 2) 早期失败快速返回 |

---

## 八、附录：关键代码片段

### 8.1 LLM 引擎调用（llm-reasoning-engine.js）

```javascript
async reason(prompt, options = {}) {
  const body = {
    model: options.model || this.model,
    messages: [
      { role: 'system', content: options.systemPrompt || '...' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature ?? 1,
    top_p: options.topP ?? 0.95,
    max_tokens: options.maxTokens ?? this.maxTokens
  };
  
  const response = await this._fetchWithTimeout(this.baseUrl, {
    method: 'POST',
    headers: this._buildHeaders(),
    body: JSON.stringify(body)
  }, options.timeoutMs || this.timeoutMs);
  
  // 解析响应...
  const message = result.choices?.[0]?.message || {};
  const content = typeof message.content === 'string' ? message.content : '';
  const reasoningContent = typeof message.reasoning_content === 'string' ? message.reasoning_content : '';
  
  // v6.6.5-fix: JSON模式下只接受 content，禁止 reasoning_content 兜底
  if (forceJson && !options.allowReasoningFallback) {
    if (!content || !content.trim()) {
      throw new Error(`LLM返回content为空（JSON模式下禁止使用reasoning_content兜底）`);
    }
  }
}
```

### 8.2 剧本生成器调用（script-generator.js）

```javascript
async _callLLM(prompt) {
  // 优先使用LLMEngine
  if (this.llmEngine) {
    const result = await this.llmEngine.generate(prompt, {
      systemPrompt: '你是一位专业的AI视频编剧...',
      maxTokens: 32000,  // v1.2.5-fix4: 扩到32000
      timeoutMs: this.config.timeout
    });
    
    if (!result.success) {
      throw new Error(`LLM引擎错误: ${result.error}`);
    }
    
    return result.content.trim();
  }
}
```

### 8.3 制作引擎核心（production-engine.js）

```javascript
class ProductionEngine {
  constructor(options = {}) {
    this.config = {
      targetDuration: options.targetDuration || 120,
      shotDurationRange: options.shotDurationRange || [8, 20],
      promptMaxLength: options.promptMaxLength || 1500,
      ...options
    };
  }
  
  async produce(scenes, characters, worldSetting, options = {}) {
    // 7 Stage 流程：提取 → 分配 → 设计 → 工程 → 质量 → 连续 → 输出
    const shots = this._extractShots(scenes);
    this._allocateDurations(shots, this.config.targetDuration);
    this._designCamera(shots);
    this._engineerPrompts(shots, characters, worldSetting);
    const qualityReport = this._runQualityGate(shots);
    this._checkContinuity(shots);
    
    return { shots, prompts: shots.map(s => s.prompt), quality: qualityReport };
  }
}
```

---

> **报告完成**。如需补充更多代码片段、运行日志或其他信息，请告知。
