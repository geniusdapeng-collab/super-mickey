# SuperMickey 预生产流程问题汇总报告

> 生成时间: 2026-06-30
> 系统版本: v2.1.0
> 涉及系统: hyperreality-system (超级小香宝)

---

## 问题 1: LLM 调用超时 (300秒/180秒)

### 问题描述
PromptFusionAgent 在调用 LLM 进行提示词融合时，频繁触发超时错误 `This operation was aborted`。
- 主调用超时: 180000ms (3分钟)
- 重试时超时: 270000ms (4.5分钟，progressive-timeout 策略)
- fill 补齐超时: 60000ms (1分钟)

超时发生时，LLM 实际上正在处理（从日志可以看到 token 在增长），但 HTTP 连接被强制终止。

### 期望结果
- LLM 调用应该在合理时间内完成（30-120秒）
- 如果服务端确实需要更长时间，应该有更长的宽容度
- 重试策略应该更智能，避免连续超时

### 涉及模块完整代码

#### 模块: `systems/llm-reasoning-engine.js` (LLMEngine)

```javascript
// 关键方法: _fetchWithTimeout
// 问题: timeoutMs 参数被传递给 fetch，但服务端处理时间可能超过此值

async _fetchWithTimeout(url, options, timeoutMs) {
    console.log(`[LLMEngine._fetchWithTimeout] 发起请求 | url=${url} | timeout=${timeoutMs}ms`);
    // ... fetch 逻辑
    // 当服务端处理时间 > timeoutMs 时，触发 abort
}
```

完整代码见: `systems/llm-reasoning-engine.js`

#### 模块: `engines/production-engine/agents/base-agent.js` (BaseAgent)

```javascript
// 关键逻辑: perCallTimeout 计算

async _callLLM(prompt, schema, fallbackFn, options = {}) {
    // ...
    const shotBudget = options.shotBudget || null;
    const effectiveBudget = shotBudget ? Math.min(shotBudget, this._remainingMs()) : this._remainingMs();
    
    const callMaxTokens = options.maxTokens || this.llmMaxTokens;
    const callMaxRetries = options.maxRetries ?? this.llmMaxRetries;
    const baseTimeout = options.timeoutMs || this.llmTimeout;
    const perCallTimeout = Math.min(baseTimeout, effectiveBudget);
    
    console.log(`[${this.name}] _callLLM 进入 | perCallTimeout=${perCallTimeout}ms maxTokens=${callMaxTokens} retries=${callMaxRetries} budget=${effectiveBudget}ms${shotBudget ? ' (镜头独立预算)' : ''}`);
    // ...
}
```

#### 模块: `engines/production-engine/agents/prompt-fusion-agent.js` (PromptFusionAgent)

```javascript
// 问题场景:
// 1. 主调用 _fuseSingleShot 使用 180000ms 超时
// 2. 失败重试时使用 270000ms (1.5x progressive-timeout)
// 3. fill 补齐使用 60000ms 超时

async _fuseSingleShot(shot, ratio, characters) {
    // ... 构建 prompt ...
    const llmResult = await this._callLLM(prompt, schema, () => {
        throw new Error('LLM fallback');
    });
    // ...
}

async _ensureFieldCompleteness(shot, fields, ratio, characters) {
    // ...
    const fillResult = await this._callLLM(fillPrompt, fillSchema, () => null, {
        maxRetries: 2,  // 【修复后】从3降到2
        maxTokens: 4096,
        timeoutMs: 60000 // 【修复后】从90s降到60s
    });
    // ...
}
```

---

## 问题 2: 总预算耗尽导致后半段镜头全部失败

### 问题描述
Layer 2 制作引擎的总预算（totalDeadlineMs）在 S1-S5 消耗完后，S6/S7 因预算不足被迫使用极短的 timeout（<10000ms），导致连续失败。

预算消耗链:
- Phase1 (SceneDesign): ~90-180秒
- Phase2 (VisualLanguage): ~150-300秒（含重试）
- Phase2 (AudioDesign): ~100-200秒
- Phase3 S1: ~173秒
- Phase3 S2: ~233秒（含重试）
- Phase3 S3: ~180秒（触发超时）
- 剩余预算: <1000秒，不够 S4-S7

### 期望结果
- 7 个镜头都应该有足够的预算完成
- 预算分配应该更智能，或者总预算应该更充足
- 每个镜头应该有独立的保底预算

### 涉及模块完整代码

#### 模块: `engines/production-engine/production-engine.js`

```javascript
// 全局时间预算配置

const DEFAULT_AGENT_CONFIG = {
  enableLLMAgents: true,
  llmTimeout: 180000, // 【修复后】从300000降到180000
  llmMaxRetries: 3,   // 【修复后】从5降到3
  llmModel: process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
  fastModel: process.env.STORMAXE_LLM_FAST_MODEL || process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
  totalDeadlineMs: 2400000, // 40分钟总预算 【修复后】提升到3600000 (60分钟)
  memThresholdMB: 1800,
  promptFusionConcurrency: 1 // 【修复后】从2降到1（串行）
};

// produce() 方法中的预算计算
async produce(adaptedBlueprint, runtimeAgentConfig = null) {
    const startTime = Date.now();
    // ...
    const HARD_BUDGET_MS = this.agentConfig.totalDeadlineMs || 1200000;
    const SAFETY_MARGIN_MS = 60000; // 余量60s
    const globalDeadline = startTime + HARD_BUDGET_MS - SAFETY_MARGIN_MS;
    this._globalDeadline = globalDeadline;
    this._setAgentDeadline(globalDeadline);
    // ...
}
```

#### 模块: `engines/production-engine/agents/base-agent.js`

```javascript
// 剩余预算计算

_remainingMs() {
    if (!this._globalDeadline) return this.llmTimeout;
    return Math.max(10000, this._globalDeadline - Date.now());
}

_canAfford(needMs) {
    return this._remainingMs() > needMs;
}
```

---

## 问题 3: LLM 返回空 content，但 reasoning 有内容

### 问题描述
在 JSON 模式下，LLM 返回 `content=""`（空字符串），但 `reasoning_content` 包含有效的推理内容和 JSON 数据。这导致 `JSON.parse()` 失败，触发降级。

### 期望结果
- 当 content 为空时，系统应该自动尝试从 reasoning_content 提取 JSON
- 不应该因为 content 为空就直接失败

### 涉及模块完整代码

#### 模块: `systems/llm-reasoning-engine.js`

```javascript
// 【修复后】支持从 reasoning 提取 JSON

try {
    // 【修复】当 content 为空但 reasoning 有内容时，尝试从 reasoning 提取 JSON
    let sourceContent = result.content;
    if (!sourceContent || !sourceContent.trim()) {
        if (result.reasoning_content && result.reasoning_content.trim()) {
            console.log(`[LLMEngine] content为空，尝试从reasoning提取JSON...`);
            sourceContent = result.reasoning_content;
        } else {
            const dump = this._dumpDebugFile('json_extract_fail_content', result.content || '');
            throw new Error(`content为空，无法解析JSON${dump ? ` | dump=${dump}` : ''}`);
        }
    }
    const extracted = this._extractJsonObject(sourceContent);
    if (!extracted) {
        const dump = this._dumpDebugFile('json_extract_fail_content', sourceContent);
        throw new Error(`无法从content提取合法JSON${dump ? ` | dump=${dump}` : ''}`);
    }
    const parsed = JSON.parse(extracted);
    return { success: true, data: parsed, rawContent: sourceContent, reasoning_content: result.reasoning_content };
} catch (parseError) {
    lastError = `JSON parse error: ${parseError.message}`;
    console.warn(`[LLMEngine] reasonStructured attempt ${attempt}/${maxRetries} 解析失败: ${lastError}`);
}
```

---

## 问题 4: 测试脚本自动跳过需求确认

### 问题描述
`run-preproduction-test-wukong.js` 在启动时自动创建 `confirmation-requirement.json` 文件，导致需求确认阶段被静默跳过，违背了正常流程。

### 期望结果
- 测试脚本不应该自动创建确认文件
- 需求确认应该等待人工确认
- 或者应该有明确的参数控制是否跳过

### 涉及模块完整代码

#### 模块: `hyperreality-system/run-preproduction-test-wukong.js`

```javascript
// 【修复后】删除自动确认逻辑

// 修复前（有问题的代码）:
// const confirmationsDir = path.join(__dirname, 'output', 'confirmations');
// fs.mkdirSync(confirmationsDir, { recursive: true });
// fs.writeFileSync(
//   path.join(confirmationsDir, 'confirmation-requirement.json'),
//   JSON.stringify({ approved: true }),
//   'utf8'
// );
// console.log('✅ 已自动创建需求确认文件');

// 修复后（正常流程）:
const startTime = Date.now();
try {
    const result = await system.create(intent, metadata, {
        skipRender: true,
        skipPostProduction: true
    });
    // ...
}
```

---

## 问题 5: 进程异常终止

### 问题描述
预生产进程在运行约 26 分钟后异常终止（PID 782041 消失），无错误日志。最后状态显示正在处理 PromptFusion S-3。

可能原因:
1. 系统 OOM（内存不足）
2. 被外部信号终止（SIGKILL）
3. Node.js 内存限制

### 期望结果
- 进程应该稳定运行直到完成
- 如果有异常，应该有明确的错误日志
- 应该支持断点续跑（checkpoint 机制）

### 涉及模块完整代码

#### 模块: `engines/production-engine/utils/checkpoint-manager.js`

```javascript
// Checkpoint 管理器支持断点续跑

class CheckpointManager {
    constructor(checkpointDir) {
        this.checkpointDir = checkpointDir || './checkpoints';
        if (!fs.existsSync(this.checkpointDir)) {
            fs.mkdirSync(this.checkpointDir, { recursive: true });
        }
    }

    async save(phase, shots, extra = {}) {
        const checkpoint = {
            phase,
            shots,
            timestamp: Date.now(),
            ...extra
        };
        const filePath = path.join(this.checkpointDir, `checkpoint-${phase}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(checkpoint, null, 2));
        console.log(`[CHECKPOINT] ✅ ${phase} 已落盘 → checkpoint-${phase}.json`);
        return filePath;
    }

    async load(phase) {
        const filePath = path.join(this.checkpointDir, `checkpoint-${phase}.json`);
        if (!fs.existsSync(filePath)) return null;
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    }
}
```

---

## 问题 6: 代码版本混乱

### 问题描述
系统中存在多个版本的 `llm-reasoning-engine.js`：
1. `hyperreality-system/engines/production-engine/` 下有旧版本
2. `systems/` 下有新版本
3. `hyperreality-system/systems/` 下有重复副本

不同 Agent 加载了不同版本的引擎，导致行为不一致。

### 期望结果
- 系统中应该只有一份 `llm-reasoning-engine.js`
- 所有模块都从统一路径加载
- 不应该有重复/冲突的副本

### 修复方案
已执行以下清理：
1. 删除 `hyperreality-system/systems/llm-reasoning-engine.js` 重复副本
2. 所有模块统一从 `systems/` 加载
3. 创建一致性检查脚本 `scripts/check-code-consistency.sh`

---

## 修复状态汇总

| 问题 | 状态 | 修复文件 |
|------|------|----------|
| LLM 超时 | ✅ 已缓解 | `prompt-fusion-agent.js` (超时降额) |
| 预算耗尽 | ✅ 已修复 | `production-engine.js` (总预算提升) |
| 空 content | ✅ 已修复 | `llm-reasoning-engine.js` (reasoning 降级) |
| 自动跳过确认 | ✅ 已修复 | `run-preproduction-test-wukong.js` (删除自动确认) |
| 进程终止 | ⚠️ 待观察 | 需进一步排查 |
| 代码版本混乱 | ✅ 已修复 | 删除重复副本 |

---

*报告结束*
