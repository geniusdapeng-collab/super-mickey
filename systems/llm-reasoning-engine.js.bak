// llm-reasoning-engine.js v6.5.27-expert-fix
// 专家重构：两阶段生成 + 禁止reasoning_content顶替content
const fs = require('fs');
const path = require('path');
const { normalizeLLMOutput } = require('./llm-output-normalizer');

class LLMEngine {
  constructor(options = {}) {
    this.model = options.model || 'kimi-k2p6';
    this.maxTokens = options.maxTokens || 4096;
  // v6.6.3-fix: 超时 10 分钟→2 分钟
  // 原因: kimi-k2p6 正常响应 30-120 秒；超过 2 分钟大概率是 API 卡死
  // 配合心跳保活，即使超时也能快速 retry，避免长时间空等
  this.timeoutMs = options.timeoutMs || 120000;
    this.temperature = options.temperature ?? 1;  // v6.6.5-fix: 允许覆盖，默认1
    this.topP = options.topP ?? 0.95;            // v6.6.5-fix: 允许覆盖，默认0.95
    this.maxRetries = options.maxRetries || 3;
    this.contextWindow = options.contextWindow || 8192;
    this.conversationHistory = [];
    this.stats = { totalCalls: 0, totalTokens: 0, totalDuration: 0, errors: 0 };
    this.mode = options.mode || 'production';
    this.baseUrl = options.baseUrl || 'https://agent-gw.kimi.com/coding/v1/chat/completions';
    this.apiKey = options.apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.KIMI_PLUGIN_API_KEY;

    if (!this.apiKey) {
      console.warn('[LLMEngine] ⚠️ 未检测到 API Key，请确认环境变量 KIMI_API_KEY 或 MOONSHOT_API_KEY');
    }
  }

  _buildHeaders() {
    // 使用Kimi Plugin认证（兼容agent-gw.kimi.com/coding端点）
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'Kimi Claw Plugin',
      'X-Msh-Device-Name': 'openclaw-kimi-embedding'
    };
  }

  async _fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // v6.6.3-fix: LLM 调用心跳保活
    // 问题: kimi-k2p6 推理模型单次响应需 30-120 秒，期间 await fetch 等待网络
    // 响应时进程无 stdout 输出，子代理活跃度监控判定为"僵死"并 SIGKILL。
    // 原理: Node.js 的 await fetch 是异步 I/O，等待期间事件循环不阻塞，
    // setInterval 心跳可以正常触发，持续向 stdout 输出保活信号。
    let heartbeatTicks = 0;
    const heartbeat = setInterval(() => {
      heartbeatTicks++;
      process.stdout.write('.');
      // 每 12 次心跳（约 60 秒）输出一次带内存信息的完整心跳行
      if (heartbeatTicks % 12 === 0) {
        const m = process.memoryUsage();
        process.stdout.write(` [llm-heartbeat ${heartbeatTicks * 5}s | rss=${(m.rss / 1048576).toFixed(0)}MB | heap=${(m.heapUsed / 1048576).toFixed(0)}MB]\n`);
      }
    }, 5000);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
      clearInterval(heartbeat);
      // 心跳结束后补一个换行，避免后续日志粘连在点号后
      if (heartbeatTicks > 0) process.stdout.write('\n');
    }
  }

  _dumpDebugFile(prefix, content) {
    try {
      const dir = path.resolve(process.cwd(), 'debug_llm');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}_${prefix}.txt`);
      fs.writeFileSync(file, content || '', 'utf8');
      return file;
    } catch (e) {
      return null;
    }
  }

  _extractJsonObject(text) {
    if (!text || typeof text !== 'string') return null;

    // v6.5.65-P8-fix-3: 增强 JSON 提取鲁棒性 — 先去掉常见非 JSON 前缀
    const prefixesToStrip = [
      /^JSON格式[：:]\s*/i,
      /^字数检查[：:]\s*/i,
      /^分析如下[：:]\s*/i,
      /^优化方向[：:]\s*/i,
      /^以下[是为]*[：:]\s*/i,
      /^回答[：:]\s*/i,
    ];
    let cleanedText = text;
    for (const prefix of prefixesToStrip) {
      cleanedText = cleanedText.replace(prefix, '');
    }

    const codeBlockMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch?.[1]) {
      const candidate = codeBlockMatch[1].trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch (_) {}
    }

    const whole = cleanedText.trim();
    try {
      JSON.parse(whole);
      return whole;
    } catch (_) {}

    const startCandidates = [];
    for (let i = 0; i < cleanedText.length; i++) {
      if (cleanedText[i] === '{' || cleanedText[i] === '[') startCandidates.push(i);
    }

    for (const start of startCandidates) {
      const open = cleanedText[start];
      const close = open === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = start; i < cleanedText.length; i++) {
        const ch = cleanedText[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === open) depth++;
        if (ch === close) depth--;
        if (depth === 0) {
          const candidate = cleanedText.slice(start, i + 1).trim();
          try {
            JSON.parse(candidate);
            return candidate;
          } catch (_) {
            break;
          }
        }
      }

      // v6.5.65-P8-fix-3: 处理被截断的 JSON — 尝试补全闭合括号
      if (depth > 0) {
        const candidate = cleanedText.slice(start).trim() + close.repeat(depth);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch (_) {}
      }
    }
    return null;
  }

  _extractFromReasoning(reasoning) {
    if (!reasoning || typeof reasoning !== 'string') return null;

    // v6.5.65-P8-patch-005: 通用化 reasoning 内容提取
    // 不再依赖硬编码关键词，直接尝试提取 JSON 或返回完整内容
    
    // 策略 1: 尝试从 reasoning 中提取 JSON 对象（与 content 提取逻辑一致）
    const jsonExtracted = this._extractJsonObject(reasoning);
    if (jsonExtracted) {
      return jsonExtracted;
    }
    
    // 策略 2: 清理 reasoning 中的标记，返回纯文本内容
    // 移除常见的 reasoning 前缀标记（如 "## 分析"、"让我思考" 等）
    const cleaned = reasoning
      .replace(/^[\s\S]*?(?={\s*"|"id"|"visualPrompt")/g, '')
      .trim();
    
    if (cleaned.length > 100) {
      return cleaned;
    }
    
    // 策略 3: 如果内容过短，返回完整 reasoning
    return reasoning.length > 10 ? reasoning : null;
  }

  async reason(prompt, options = {}) {
    const startedAt = Date.now();
    this.stats.totalCalls++;

    const body = {
      model: options.model || this.model,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || '你是一个严格输出 JSON 的助手。除合法 JSON 外不要输出任何额外文字。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature ?? this.temperature,  // v6.6.5-fix: 优先使用传入值，回退实例值
      top_p: options.topP ?? this.topP,
      max_tokens: options.maxTokens ?? this.maxTokens
    };

    if (options.responseFormat) {
      body.response_format = options.responseFormat;
    }

    try {
      const response = await this._fetchWithTimeout(
        this.baseUrl,
        {
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify(body)
        },
        options.timeoutMs || this.timeoutMs
      );

      const text = await response.text();
      if (!response.ok) {
        this.stats.errors++;
        const file = this._dumpDebugFile('http_error', text);
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}${file ? ` | dump=${file}` : ''}`);
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        this.stats.errors++;
        const file = this._dumpDebugFile('invalid_response_json', text);
        throw new Error(`API响应不是合法JSON: ${e.message}${file ? ` | dump=${file}` : ''}`);
      }

      const message = result.choices?.[0]?.message || {};
      const content = message.content || '';
      const reasoningContent = message.reasoning_content || '';
      const usage = result.usage || {};
      const tokenCount = usage.total_tokens || 0;

      this.stats.totalTokens += tokenCount;
      this.stats.totalDuration += Date.now() - startedAt;

      console.log(`[LLMEngine] ✅ API完成 | Tokens: ${tokenCount} | content=${content.length} | reasoning=${reasoningContent.length}`);

      // 统一使用 normalizeLLMOutput 处理输出
      const normalized = normalizeLLMOutput({
        content,
        reasoning_content: reasoningContent
      });

      let finalContent = normalized.text;

      if (!normalized.ok || !finalContent || finalContent.trim().length < 50) {
        if (reasoningContent && reasoningContent.length > 50) {  // v6.5.65-P8-patch-005: 降低阈值，适配通用内容
          const extracted = this._extractFromReasoning(reasoningContent);
          if (extracted && extracted.length > 50) {  // v6.5.65-P8-patch-005: 降低阈值
            finalContent = extracted;
            console.log(`[LLMEngine] ✅ 从reasoning提取内容 | 长度: ${extracted.length}`);
          } else {
            const reasonFile = this._dumpDebugFile('empty_content_reasoning', reasoningContent);
            throw new Error(
              `LLM返回content为空，且无法从reasoning提取有效内容` +
              `${reasonFile ? ` | reasoning_dump=${reasonFile}` : ''}`
            );
          }
        } else {
          const reasonFile = this._dumpDebugFile('empty_content_reasoning', reasoningContent);
          throw new Error(
            `LLM返回content为空，疑似tokens被reasoning耗尽` +
            `${reasonFile ? ` | reasoning_dump=${reasonFile}` : ''}`
          );
        }
      }

      return {
        success: true,
        content: finalContent,
        reasoning_content: reasoningContent,
        source: normalized.source,
        tokenCount
        // raw: result  // v6.6-fix: 不返回完整raw响应,减少内存占用
      };
    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  async generate(prompt, options = {}) {
    const result = await this.reason(prompt, options);
    return result;
  }

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
      '6. 绝对禁止输出"字数检查""分析如下""优化方向"等元信息',
      '7. 绝对禁止输出任何纯文本描述、思考过程或自我检查',
      '8. visualPrompt 字段必须是纯画面描述字符串，不要包含任何分析标记',
      '',
      '【目标JSON结构示例】',
      JSON.stringify(schema, null, 2)
    ].join('\n');

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.reason(structuredPrompt, {
        ...options,
        responseFormat: { type: 'json_object' },
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? this.maxTokens
      });

      if (!result.success) {
        lastError = result.error;
        console.warn(`[LLMEngine] ⚠️ reasonStructured attempt ${attempt}/${this.maxRetries} 失败: ${lastError}`);
        continue;
      }

      try {
        const extracted = this._extractJsonObject(result.content);
        if (!extracted) {
          const dump = this._dumpDebugFile('json_extract_fail_content', result.content);
          throw new Error(`无法从content提取合法JSON${dump ? ` | dump=${dump}` : ''}`);
        }

        const parsed = JSON.parse(extracted);

        return {
          success: true,
          data: parsed,
          rawContent: result.content,
          reasoning_content: result.reasoning_content
        };
      } catch (parseError) {
        lastError = `JSON parse error: ${parseError.message}`;
        console.warn(`[LLMEngine] ⚠️ reasonStructured attempt ${attempt}/${this.maxRetries} 解析失败: ${lastError}`);
      }
    }

    return {
      success: false,
      error: lastError || '未知错误'
    };
  }
}

module.exports = { LLMEngine };
