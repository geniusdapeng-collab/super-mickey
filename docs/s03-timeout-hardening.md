# S03 超时防护加固方案

## 问题
ScriptGenerator LLM 超时(300000ms) — 服务端并发限流导致连接 hang 住

## 解决方案

### 1. 服务端健康检查（前置防护）

在 `_callLLM` 前增加轻量 ping：

```javascript
async _checkServerHealth() {
  try {
    const result = await this.llmEngine.generate('ping', { 
      maxTokens: 10, 
      timeoutMs: 10000 
    });
    return result.success;
  } catch (e) {
    return false;
  }
}
```

### 2. 指数退避重试（容错机制）

```javascript
const retryDelays = [10000, 30000, 60000]; // 10s, 30s, 60s

async _callWithRetry(prompt, options) {
  for (let i = 0; i < retryDelays.length; i++) {
    try {
      return await this.llmEngine.generate(prompt, options);
    } catch (error) {
      if (i < retryDelays.length - 1) {
        console.log(`[ScriptGenerator] 第${i+1}次失败，${retryDelays[i]/1000}秒后重试...`);
        await new Promise(r => setTimeout(r, retryDelays[i]));
      } else {
        throw error;
      }
    }
  }
}
```

### 3. 并发控制（全局锁）

```javascript
// 全局锁，防止多个进程同时调用
let isCalling = false;

async _callLLM(prompt) {
  if (isCalling) {
    console.warn('[ScriptGenerator] 已有 LLM 调用进行中，等待...');
    while (isCalling) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  isCalling = true;
  try {
    return await this._callLLMInternal(prompt);
  } finally {
    isCalling = false;
  }
}
```

### 4. 动态超时调整

```javascript
// 根据历史响应时间动态调整超时
const avgResponseTime = this.stats.totalDuration / this.stats.totalCalls;
const dynamicTimeout = Math.max(300000, avgResponseTime * 3);
```

## 实施计划

1. **立即**：验证 S03 修复效果（B 方案）
2. **今晚**：实现健康检查 + 指数退避
3. **本周**：实现并发控制 + 动态超时
4. **下周**：接入本地 LLM 缓存层

## 文件变更

- `engines/script-engine/core/script-generator.js` — 增加重试和并发控制
- `systems/llm-reasoning-engine.js` — 增加健康检查接口
- `index.js` — 增加全局并发锁配置
