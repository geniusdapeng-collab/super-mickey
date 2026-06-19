// llm-reasoning-engine.js v6.5.28-parallel
// 在 v6.5.27 基础上增加：截止时间(deadline)感知 + 可控重试，适配并行链路
const fs = require('fs');
const path = require('path');
const { normalizeLLMOutput } = require('./llm-output-normalizer');

class LLMEngine {
  constructor(options = {}) {
    this.model = options.model || 'kimi-k2p6';
    this.maxTokens = options.maxTokens || 4096;
    this.timeoutMs = options.timeoutMs || 600000;
    this.temperature = 1;
    this.topP = 0.95;
    this.maxRetries = options.maxRetries || 3;
    this.contextWindow = options.contextWindow || 8192;
    this.conversationHistory = [];
    this.stats = { totalCalls: 0, totalTokens: 0, totalDuration: 0, errors: 0 };
    this.mode = options.mode || 'production';
    this.baseUrl = options.baseUrl || 'https://agent-gw.kimi.com/coding/v1/chat/completions';
    this.apiKey = options.apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.KIMI_PLUGIN_API_KEY;

    if (!this.apiKey) {
      console.warn('[LLMEngine] 未检测到 API Key，请确认环境变量 KIMI_API_KEY 或 MOONSHOT_API_KEY');
    }
  }

  _buildHeaders() {
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
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      // 将 response.text() 也包进超时控制，防止网络半开时挂死
      const textPromise = res.text();
      const text = await textPromise;
      return { ...res, text: () => Promise.resolve(text) };
    } finally {
      clearTimeout(timer);
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

    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch?.[1]) {
      const candidate = codeBlockMatch[1].trim();
      try { JSON.parse(candidate); return candidate; } catch (_) {}
    }

    const whole = text.trim();
    try { JSON.parse(whole); return whole; } catch (_) {}

    const startCandidates = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{' || text[i] === '[') startCandidates.push(i);
    }

    for (const start of startCandidates) {
      const open = text[start];
      const close = open === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (escaped) { escaped = false; }
          else if (ch === '\\') { escaped = true; }
          else if (ch === '"') { inString = false; }
          continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === open) depth++;
        if (ch === close) depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1).trim();
          try { JSON.parse(candidate); return candidate; } catch (_) { break; }
        }
      }
    }
    return null;
  }

  _extractFromReasoning(reasoning) {
    if (!reasoning || typeof reasoning !== 'string') return null;
    const lines = reasoning.split('\n');
    const indicators = [
      '"meta"', '"structure"', '"scenes"', '"characters"', '"dialogue"',
      '"character_system"', '"world_setting"', '"voice_system"',
      '{', '}',
      '镜头', '全景', '中景', '特写', '推轨', '场景', '角色', '台词',
      '独白', '对白', '旁白', '片头', '片尾', '画面'
    ];
    let best = null, bestLen = 0, current = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) {
        if (current.length > bestLen) {
          const hasInd = indicators.some(ind => current.includes(ind));
          if (hasInd) { bestLen = current.length; best = current.trim(); }
        }
        current = '';
      } else {
        current = line + '\n' + current;
      }
    }
    if (current.length > bestLen) {
      const hasInd = indicators.some(ind => current.includes(ind));
      if (hasInd) { bestLen = current.length; best = current.trim(); }
    }
    return best;
  }

  async reason(prompt, options = {}) {
    const startedAt = Date.now();
    this.stats.totalCalls++;

    const forceJson = options.forceJson === true || options.responseFormat?.type === 'json_object';

    const body = {
      model: options.model || this.model,
      messages: [
        { role: 'system', content: options.systemPrompt || (forceJson ? '你是一个严格输出 JSON 的助手。除合法 JSON 外不要输出任何额外文字。' : '你是一个可靠的助手。') },
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature ?? 1,
      top_p: options.topP ?? 0.95,
      max_tokens: options.maxTokens ?? this.maxTokens
    };

    if (forceJson) body.response_format = { type: 'json_object' };
    else if (options.responseFormat) body.response_format = options.responseFormat;

    try {
      const response = await this._fetchWithTimeout(
        this.baseUrl,
        { method: 'POST', headers: this._buildHeaders(), body: JSON.stringify(body) },
        options.timeoutMs || this.timeoutMs
      );

      const text = await response.text();
      if (!response.ok) {
        this.stats.errors++;
        const file = this._dumpDebugFile('http_error', text);
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}${file ? ` | dump=${file}` : ''}`);
      }

      let result;
      try { result = JSON.parse(text); }
      catch (e) {
        this.stats.errors++;
        const file = this._dumpDebugFile('invalid_response_json', text);
        throw new Error(`API响应不是合法JSON: ${e.message}${file ? ` | dump=${file}` : ''}`);
      }

      const message = result.choices?.[0]?.message || {};
      const content = typeof message.content === 'string' ? message.content : '';
      const reasoningContent = typeof message.reasoning_content === 'string' ? message.reasoning_content : '';
      const usage = result.usage || {};
      const tokenCount = usage.total_tokens || 0;

      this.stats.totalTokens += tokenCount;
      this.stats.totalDuration += Date.now() - startedAt;

      console.log(`[LLMEngine] API完成 | Tokens: ${tokenCount} | content=${content.length} | reasoning=${reasoningContent.length}`);

      const normalized = normalizeLLMOutput({ content, reasoning_content: reasoningContent });
      let finalContent = normalized.text || '';

      if (forceJson && !options.allowReasoningFallback) {
        if (!content || !content.trim()) {
          const reasonFile = this._dumpDebugFile('empty_content_reasoning', reasoningContent);
          throw new Error(`LLM返回content为空（JSON模式下禁止使用reasoning_content兜底）${reasonFile ? ` | reasoning_dump=${reasonFile}` : ''}`);
        }
        finalContent = content.trim();
      } else {
        if (!normalized.ok || !finalContent || !finalContent.trim()) {
          const reasonFile = this._dumpDebugFile('empty_content_reasoning', reasoningContent);
          throw new Error(`LLM返回content为空，且当前请求未获得有效正文${reasonFile ? ` | reasoning_dump=${reasonFile}` : ''}`);
        }
      }

      return { success: true, content: finalContent, reasoning_content: reasoningContent, source: forceJson ? 'content-only-json-mode' : normalized.source, tokenCount, raw: result };
    } catch (error) {
      this.stats.errors++;
      return { success: false, error: error.message || String(error) };
    }
  }

  async generate(prompt, options = {}) { return this.reason(prompt, options); }

  /**
   * 结构化推理（v6.5.28：支持 maxRetries / deadlineMs 覆盖 + 截止时间门控重试）
   */
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

    const maxRetries = options.maxRetries ?? this.maxRetries;
    const deadlineMs = options.deadlineMs || null;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // === 截止时间门控：超时则停止重试，把剩余预算留给下游 ===
      if (deadlineMs && Date.now() >= deadlineMs) {
        console.warn(`[LLMEngine] 截止时间已到，停止重试 (attempt ${attempt}/${maxRetries})`);
        break;
      }

      // 单次超时 = min(调用方 timeoutMs, 距截止时间)
      let attemptTimeout = options.timeoutMs || this.timeoutMs;
      if (deadlineMs) {
        attemptTimeout = Math.min(attemptTimeout, Math.max(10000, deadlineMs - Date.now()));
      }

      const result = await this.reason(structuredPrompt, {
        ...options,
        forceJson: true,
        responseFormat: { type: 'json_object' },
        temperature: options.temperature ?? 1,
        maxTokens: options.maxTokens ?? this.maxTokens,
        timeoutMs: attemptTimeout
      });

      if (!result.success) {
        lastError = result.error;
        console.warn(`[LLMEngine] reasonStructured attempt ${attempt}/${maxRetries} 失败: ${lastError}`);
        continue;
      }

      try {
        if (!result.content || !result.content.trim()) {
          const dump = this._dumpDebugFile('json_extract_fail_content', result.content || '');
          throw new Error(`content为空，无法解析JSON${dump ? ` | dump=${dump}` : ''}`);
        }
        const extracted = this._extractJsonObject(result.content);
        if (!extracted) {
          const dump = this._dumpDebugFile('json_extract_fail_content', result.content);
          throw new Error(`无法从content提取合法JSON${dump ? ` | dump=${dump}` : ''}`);
        }
        const parsed = JSON.parse(extracted);
        return { success: true, data: parsed, rawContent: result.content, reasoning_content: result.reasoning_content };
      } catch (parseError) {
        lastError = `JSON parse error: ${parseError.message}`;
        console.warn(`[LLMEngine] reasonStructured attempt ${attempt}/${maxRetries} 解析失败: ${lastError}`);
      }
    }

    return { success: false, error: lastError || '未知错误' };
  }
}

module.exports = { LLMEngine };
