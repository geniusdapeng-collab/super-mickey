# v2.0.0 LLM-Agent 集成问题全面分析报告

> 生成时间: 2026-06-19 23:00
> 系统版本: 超现实系统 v2.0.0-LLM-Agent
> 基线版本: v1.2.8

---

## 一、背景与目标

### 1.1 升级背景

基于外部专家（郑建灿）提供的 `v2.0.0-LLM-Agent 升级方案`，我们对超现实系统的**制作引擎（ProductionEngine）**进行了 LLM-Agent 化改造。

**核心目标**：将原本纯模板驱动的制作引擎（10ms完成）升级为"半规则半LLM"的融合引擎，由LLM负责创造性环节（场景设计、视觉语言、音频设计、Prompt融合），提升Prompt质量。

### 1.2 架构设计

```
制作引擎 8 Stage 流程:
1. SCENE-EXTRACTION      - 场景提取（规则）
2. DURATION-ALLOCATION   - 时长分配（规则）
3. SCENE-DESIGN-AGENT    - 场景设计（LLM ✓）
4. VISUAL-LANGUAGE-AGENT - 运镜灯光（LLM ✓）
5. AUDIO-DESIGN-AGENT    - 音效设计（LLM ✓）
6. PROMPT-FUSION-AGENT   - Prompt融合（LLM ✓ 刚打通）
7. OPENING-DESIGN-AGENT  - 片头设计（LLM - 被终止）
8. CONTINUITY-REVIEW     - 连续性审查（LLM - 未执行）
```

### 1.3 期望结果

- 全部 6 个LLM Agent 正常调用，无降级
- 每个 Agent 的LLM调用时间在 5 分钟内
- 整条预生产链路在 15-20 分钟内完成
- 输出高质量的导演分镜Prompt

---

## 二、当前状态

### 2.1 成功突破 ✅

| Agent | 状态 | 耗时 | LLM Tokens |
|-------|------|------|------------|
| SceneDesignAgent | ✅ 成功 | ~85-167s | 4000-6500 |
| VisualLanguageAgent | ✅ 成功 | ~163-258s | 8000-11000 |
| AudioDesignAgent | ✅ 成功 | ~68-98s | 3000-4500 |
| **PromptFusionAgent** | **✅ 刚打通** | **78s** | **4916** |

**PromptFusionAgent 成功日志（最后一次运行）**：
```
[PromptFusionAgent] 开始处理 5 个镜头（全量模式）...
[PromptFusionAgent] LLM引擎加载成功
[LLMEngine] ✅ API完成 | Tokens: 4916 | content=748 | reasoning=5656
[PromptFusionAgent] LLM调用成功 ✓
[PromptFusionAgent] 完成 ✓ | 降级: 0/5
[PROMPT-FUSION-AGENT] 完成 (78273ms)
```

### 2.2 仍然卡住 ❌

**问题：进程被系统 SIGTERM/SIGKILL 终止**

**时间线分析（最后一次完整运行）**：
```
剧本引擎:        154s  ✅
SceneDesign:     168s  ✅
VisualLanguage:  164s  ✅
AudioDesign:      98s  ✅
PromptFusion:     78s  ✅
--- 小计: 662s ≈ 11分钟 ---
OpeningDesign:     ?    ❌ 被SIGTERM终止
```

**报错信息**：
```
Process exited with signal SIGTERM
```

**规律**：
- 无论前几个Agent多快，总时间达到约11分钟后，进程必然被终止
- 不是某个Agent的问题，是**系统级总时间限制**

---

## 三、已尝试的解决方案及效果

### 方案1: 增加超时时间
- 将 exec timeout 从默认调至 1200秒（20分钟）
- **效果**: 无效，进程仍被SIGTERM

### 方案2: PromptFusionAgent 降级（原规则拼接）
- 禁用 PromptFusionAgent 的LLM，走原规则方法
- **效果**: 链路能跑通，但prompt为空（0字符），质量门全挂
- **问题**: 队长明确要求**不能用降级**，必须用LLM

### 方案3: PromptFusionAgent 精简Prompt + 单批全量
- 大幅精简Prompt，砍掉冗余描述
- 从"分批处理"改为"一次性全量处理"
- **效果**: ✅ **成功！** PromptFusionAgent 78秒完成，0降级

### 方案4: 分批处理（3+3镜头）
- 将6个镜头拆成2批，每批3个
- **效果**: 每批仍超时（5分钟不够）

---

## 四、核心问题定义

### 4.1 根本问题

**系统对单个进程有硬时间限制（约11-12分钟）**，而我们需要的总时间：

```
剧本引擎:        120-170s
SceneDesign:      85-170s
VisualLanguage:  163-260s
AudioDesign:      68-100s
PromptFusion:     78s  ✅ 已优化
OpeningDesign:    40-80s
ContinuityReview:  ?
--------------------------------
总计:            约600-800s = 10-13分钟
```

即使PromptFusionAgent优化到78秒，总时间仍然压在11分钟边缘，一旦某个Agent慢一点，就会超时。

### 4.2 子问题

1. **LLM reasoning 时间过长**: kimi-k2p6 是推理模型，reasoning tokens 经常 >5000，导致API响应时间长达2-5分钟
2. **串行执行**: 6个Agent串行调用，时间累加
3. **系统级进程限制**: 无法通过代码层面增加超时

---

## 五、相关核心代码

### 5.1 base-agent.js（LLM Agent 基类）

```javascript
class BaseAgent {
  constructor(options = {}) {
    this.name = options.name || 'BaseAgent';
    this.llmTimeout = options.llmTimeout || 300000; // 5分钟
    this.llmMaxRetries = options.llmMaxRetries || 3;
    this.llmModel = options.llmModel || 'kimi-k2p6';
    this.enabled = options.enabled !== false;
  }

  async _callLLM(prompt, schema, fallbackFn) {
    if (!this.enabled) {
      return this._executeFallback(fallbackFn, 'Agent disabled');
    }

    const llm = this._getLLMEngine();
    if (!llm) {
      return this._executeFallback(fallbackFn, 'LLM engine not available');
    }

    try {
      const fullPrompt = `${this._getSystemPrompt()}\n\n${prompt}`;
      const result = await llm.reasonStructured(fullPrompt, schema, {
        maxTokens: 16000,
        timeoutMs: this.llmTimeout
      });

      if (!result.success) {
        throw new Error(`LLM引擎返回失败: ${result.error}`);
      }

      return { result: result.data, degraded: false, degradeReason: null };
    } catch (err) {
      return this._executeFallback(fallbackFn, `LLM failed: ${err.message}`);
    }
  }
}
```

### 5.2 prompt-fusion-agent.js（核心Agent，刚打通）

```javascript
class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 600000, ...options });
    this.maxPromptLength = options.maxPromptLength || 1500;
  }

  async process(shots, blueprint) {
    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    // 一次性全量处理（不是分批）
    const prompt = this._buildBatchPrompt(shots, ratio, characters);
    const schema = { shots: [{ shotId: 'SC01', fusionText: '...' }] };

    const llmResult = await this._callLLM(prompt, schema, () => {
      return this._fallbackBatch(shots, ratio);
    });

    // 合并结果...
  }

  _buildBatchPrompt(shots, ratio, characters) {
    const characterInfo = characters.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');
    const shotsInfo = shots.map(s => {
      const dialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || s.dialogue || '';
      return `${s.shotId}(${s.duration || '?'}s): ${(s.scene || '').substring(0, 50)} | ${s.mood || ''} | ${dialogue.substring(0, 50)} | 运镜:${(s.cameraString || '').substring(0, 30)} | 灯光:${(s.lightingString || '').substring(0, 30)}`;
    }).join('\n');

    return `画幅:${ratio}\n角色:${characterInfo || '无'}\n镜头:\n${shotsInfo}\n\n任务:为每个镜头写fusionText(80-120字导演分镜描述)。叙事化、动态运镜、场景化灯光。不要长推理，直接输出JSON。\n\n输出:{"shots":[{"shotId":"SC01","fusionText":"..."},...]}`;
  }
}
```

### 5.3 production-engine.js（主流程）

```javascript
async produce(adaptedBlueprint) {
  // Stage 3: SceneDesignAgent
  const sdResult = await this._runStage('scene-design-agent', () =>
    this.agents.sceneDesign.process(currentShots, adaptedBlueprint)
  );
  currentShots = sdResult.shots;

  // Stage 4: VisualLanguageAgent
  const vlResult = await this._runStage('visual-language-agent', () =>
    this.agents.visualLanguage.process(currentShots, adaptedBlueprint)
  );
  currentShots = vlResult.shots;

  // Stage 5: AudioDesignAgent
  const adResult = await this._runStage('audio-design-agent', () =>
    this.agents.audioDesign.process(currentShots, adaptedBlueprint)
  );
  currentShots = adResult.shots;

  // Stage 6: PromptFusionAgent
  const pfResult = await this._runStage('prompt-fusion-agent', () =>
    this.agents.promptFusion.process(currentShots, adaptedBlueprint)
  );
  currentShots = pfResult.shots;

  // Stage 7: OpeningDesignAgent
  const odResult = await this._runStage('opening-design-agent', () =>
    this.agents.openingDesign.process(adaptedBlueprint)
  );

  // Stage 8: ContinuityReviewAgent
  const crResult = await this._runStage('continuity-review-agent', () =>
    this.agents.continuityReview.process(currentShots, adaptedBlueprint)
  );
}
```

### 5.4 llm-reasoning-engine.js（LLM引擎核心）

```javascript
async reasonStructured(prompt, schema, options = {}) {
  const structuredPrompt = [
    prompt,
    '',
    '【硬性输出要求】',
    '1. 只输出合法 JSON',
    '2. 不要输出 markdown 代码块',
    '3. 不要输出解释、前言、结尾',
    '4. 所有字段必须存在',
    '5. 输出必须能被 JSON.parse 直接解析',
    '',
    '【目标JSON结构示例】',
    JSON.stringify(schema, null, 2)
  ].join('\n');

  for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    const result = await this.reason(structuredPrompt, {
      ...options,
      forceJson: true,
      responseFormat: { type: 'json_object' },
      temperature: options.temperature ?? 1,
      maxTokens: options.maxTokens ?? this.maxTokens
    });
    // JSON解析...
  }
}
```

---

## 六、需要外部专家解答的问题

### 6.1 核心问题（P0）

**如何在不降级的情况下，让整条LLM-Agent链路在系统时间限制内跑通？**

具体子问题：
1. **并行化**: 是否可以将6个LLM Agent改为并行执行（而非串行）？例如 SceneDesign + VisualLanguage + AudioDesign 同时调用LLM，然后PromptFusion等结果合并后再执行。
2. **异步化**: 是否可以将Agent的LLM调用改为异步，先提交所有请求，然后轮询等待结果？
3. **模型选择**: kimi-k2p6 的reasoning时间太长，是否有更快但质量可接受的替代模型？（如 kimi-k2p5、其他厂商模型）
4. **减少Reasoning**: 是否有方法让kimi-k2p6减少reasoning量（如通过system prompt或参数设置）？
5. **系统时间限制**: 是否有办法绕过或增加系统的进程时间限制？

### 6.2 架构问题（P1）

1. **PromptFusionAgent的设计**: 当前是"一次性全量处理所有镜头"，prompt长度约1000-2000 tokens。是否有更好的分批策略？
2. **Agent粒度**: 当前是6个独立Agent，每个都调用LLM。是否可以合并某些Agent（如 VisualLanguage + AudioDesign）？
3. **缓存机制**: 是否有必要引入结果缓存，避免相同输入重复调用LLM？

---

## 七、完整日志（最后一次运行）

```
[HyperrealitySystem v2.0.0] 开始创作
剧本引擎: 5场景, 16台词, 100分 (154400ms)
[SCENE-DESIGN-AGENT] 完成 (167901ms) | Tokens: 8143
[VISUAL-LANGUAGE-AGENT] 完成 (163751ms) | Tokens: 8040
[AUDIO-DESIGN-AGENT] 完成 (98154ms) | Tokens: 4485
[PROMPT-FUSION-AGENT] 完成 (78273ms) | Tokens: 4916 | 降级: 0/5 ✅
[OPENING-DESIGN-AGENT] 开始...
Process exited with signal SIGTERM ❌
```

---

## 八、环境信息

- **系统**: 超现实系统 v2.0.0-LLM-Agent
- **Node.js**: v24.15.0
- **LLM模型**: kimi-k2p6（通过 LLMEngine 调用）
- **API端点**: https://agent-gw.kimi.com/coding/v1/chat/completions
- **超时设置**: 
  - exec timeout: 1200s（20分钟）
  - Agent LLM timeout: 600000ms（10分钟）
  - LLMEngine默认timeout: 600000ms（10分钟）
- **进程限制**: 约11-12分钟（系统级SIGTERM）

---

## 九、总结

**已验证的事实**：
1. ✅ LLM-Agent 架构可行，PromptFusionAgent已成功跑通
2. ✅ Prompt精简策略有效，reasoning量可大幅减少
3. ❌ 系统有硬时间限制（约11分钟），串行6个Agent总时间压线

**需要专家帮助的方向**：
1. 并行化/异步化 Agent 执行
2. 选择更快的LLM模型或降低reasoning量
3. 绕过系统进程时间限制
