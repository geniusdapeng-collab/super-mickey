const { BaseAgent } = require('../../production-engine/agents/base-agent');

/**
 * Agent 2: CreativeDirectionAgent
 * 创意方向 Agent - 核心 LLM Agent
 * 职责：进行视角转换，从业务需求语言提炼产品制作语言
 * 耗时：30-60s
 */
class CreativeDirectionAgent extends BaseAgent {
  constructor(options = {}) {
    super(options);
    this.agentName = 'CreativeDirectionAgent';
    this.timeoutMs = options.timeoutMs || 120000; // 2 分钟
  }

  async process(discoveryResult) {
    // 保存 discoveryResult 供 _parseResult 使用
    this._lastDiscoveryResult = discoveryResult;
    const prompt = this._buildPrompt(discoveryResult);
    
    try {
      // 【审计修复】参数错位：原代码 _callLLM(prompt, { timeout: this.timeoutMs }) 把 timeout 对象放在 schema 位置，
      // 导致 timeoutMs 不生效、schema 污染提示词、返回值包装对象未解包 → LLM 产出 100% 被丢弃
      const llmResponse = await this._callLLM(prompt, null, null, { timeoutMs: this.timeoutMs });
      // 解包：BaseAgent._callLLM 返回 { result, degraded, degradeReason, attempts }
      const result = llmResponse && llmResponse.result !== undefined ? llmResponse.result : llmResponse;
      return this._parseResult(result);
    } catch (error) {
      console.warn(`[${this.agentName}] LLM 调用失败: ${error.message}，使用 fallback`);
      return this.fallback(discoveryResult);
    }
  }

  _buildPrompt(discoveryResult) {
    const { upstreamFields, audienceProfile, sceneStructure, referenceCases } = discoveryResult;
    
    return `你是一位资深视频导演/制片人，正在将客户的业务需求转化为产品制作需求。

【业务需求输入】
视频类型: ${upstreamFields.type || '通用'}
核心主题: ${upstreamFields.theme || '未指定'}
情绪基调: ${upstreamFields.tone || '中性'}
视觉风格: ${upstreamFields.visual_style || '未指定'}
主题描述: ${upstreamFields.description || upstreamFields.theme || '未指定'}

【受众洞察】
主要受众: ${audienceProfile?.primaryAudience?.ageRange || '25-30'}岁，${audienceProfile?.primaryAudience?.gender || 'all'}
兴趣标签: ${(audienceProfile?.primaryAudience?.interestTags || []).join(', ')}
情绪触发点: ${(audienceProfile?.emotionTriggers || []).join(', ')}
内容期望: ${(audienceProfile?.contentExpectations || []).join(', ')}

【场景结构】
叙事弧线: ${sceneStructure?.narrativeArc || 'setup→rising→climax→falling→resolution'}
场景数: ${sceneStructure?.sceneCount || '3'}
总时长: ${sceneStructure?.totalDuration || upstreamFields.duration_sec || '52'}秒

【参考案例】
参考影片: ${(referenceCases?.filmReferences || []).map(f => f.title || f).join(', ')}

请输出 JSON 格式的创意核心（不要添加任何解释文本，只输出 JSON）：

{
  "coreTheme": "核心主题（20-100字，导演视角的提炼，不是业务描述）",
  "creativeHook": "创意钩子（20-100字，必须包含'前3秒抓眼策略'和'为什么观众会被吸引'）",
  "emotionalArc": "setup→rising→climax→falling→resolution",
  "keyMessages": ["核心信息1（5-50字，标注优先级如P0）", "核心信息2"],
  "twistPoint": "反转/高潮点（可选，如没有则填空字符串）",
  "endingType": "开放式|闭合式|悬念式|升华式|反转式"
}

严格要求：
1. coreTheme 必须是导演视角的提炼，不是业务描述。例如不是"关于火星救援的故事"，而是"孤独与希望的对抗：一个被遗弃的星球上，人类用科学对抗绝望"
2. creativeHook 必须包含前3秒抓眼策略（如"第一帧即悬念"、"强烈视觉冲击开场"）
3. keyMessages 1-4个，每个5-50字，至少标注一个P0级
4. emotionalArc 必须从以下枚举选择：setup→rising→climax→falling→resolution, setup→rising→climax→resolution, setup→climax→resolution, loop, flat→peak→flat
5. endingType 必须从枚举选择：开放式, 闭合式, 悬念式, 升华式, 反转式
6. 所有字段必须存在，不能为 null
7. 只输出 JSON，不要任何 markdown 代码块标记，不要解释文本`;
  }

  _parseResult(result) {
    try {
      // 如果 result 是对象，尝试转换为字符串
      if (typeof result !== 'string') {
        result = typeof result === 'object' ? JSON.stringify(result) : String(result);
      }
      
      // 清理可能的 markdown 代码块
      let clean = result.trim();
      if (clean.startsWith('```json')) clean = clean.slice(7);
      if (clean.startsWith('```')) clean = clean.slice(3);
      if (clean.endsWith('```')) clean = clean.slice(0, -3);
      clean = clean.trim();
      
      const parsed = JSON.parse(clean);
      
      // 【修复】字段缺失自动补全，不再抛错误
      const upstreamTheme = this._lastDiscoveryResult?.upstreamFields?.theme || '未指定主题';
      const upstreamType = this._lastDiscoveryResult?.upstreamFields?.type || '通用';
      const upstreamTone = this._lastDiscoveryResult?.upstreamFields?.tone || '中性';
      
      // 必填字段兜底
      if (!parsed.coreTheme || parsed.coreTheme === '待补充核心主题') {
        parsed.coreTheme = `${upstreamTheme}：在${upstreamType}背景下，探索人性与环境的对抗`;
        console.warn(`[${this.agentName}] ⚠️ coreTheme 缺失，自动补全: ${parsed.coreTheme.substring(0, 40)}...`);
      }
      if (!parsed.creativeHook) {
        parsed.creativeHook = `前3秒以强烈视觉冲击开场，迅速建立${upstreamTone}氛围，吸引观众注意力`;
        console.warn(`[${this.agentName}] ⚠️ creativeHook 缺失，自动补全`);
      }
      if (!parsed.emotionalArc) {
        parsed.emotionalArc = 'setup→rising→climax→falling→resolution';
        console.warn(`[${this.agentName}] ⚠️ emotionalArc 缺失，使用默认值`);
      }
      if (!parsed.keyMessages || !Array.isArray(parsed.keyMessages) || parsed.keyMessages.length === 0) {
        parsed.keyMessages = [`P0: ${upstreamTheme}的核心情感体验`];
        console.warn(`[${this.agentName}] ⚠️ keyMessages 缺失，自动补全`);
      }
      if (parsed.twistPoint === undefined || parsed.twistPoint === null) {
        parsed.twistPoint = '';
      }
      if (!parsed.endingType) {
        parsed.endingType = '闭合式';
        console.warn(`[${this.agentName}] ⚠️ endingType 缺失，使用默认值`);
      }
      
      // 确保 keyMessages 是数组
      if (!Array.isArray(parsed.keyMessages)) {
        parsed.keyMessages = [String(parsed.keyMessages)];
      }
      
      // 限制 keyMessages 长度
      parsed.keyMessages = parsed.keyMessages.slice(0, 4);
      
      return { creativeCore: parsed };
    } catch (error) {
      console.error(`[${this.agentName}] 解析失败: ${error.message}`);
      throw error;
    }
  }

  // Fallback：当 LLM 超时或失败时使用
  fallback(discoveryResult) {
    const { upstreamFields, sceneStructure } = discoveryResult;
    const theme = upstreamFields.theme || '未指定主题';
    const tone = upstreamFields.tone || '中性';
    
    // 构建简单的创意核心
    const coreTheme = `${theme}：在${upstreamFields.type || '通用'}背景下，探索人性与环境的对抗`;
    const creativeHook = `前3秒以强烈视觉冲击开场，迅速建立${tone}氛围，吸引观众注意力`;
    
    const emotionalArcMap = {
      '紧张': 'setup→rising→climax→falling→resolution',
      '悲伤': 'flat→peak→flat',
      '欢快': 'setup→climax→resolution',
      '悬疑': 'setup→rising→climax→falling→resolution',
      '中性': 'setup→rising→climax→falling→resolution'
    };
    
    const endingTypeMap = {
      '紧张': '闭合式', '悲伤': '开放式', '欢快': '闭合式', '悬疑': '悬念式', '中性': '闭合式'
    };
    
    return {
      creativeCore: {
        coreTheme: coreTheme.slice(0, 100),
        creativeHook: creativeHook.slice(0, 100),
        emotionalArc: emotionalArcMap[tone] || 'setup→rising→climax→falling→resolution',
        keyMessages: [`P0: ${theme}的核心价值`, `P1: 视觉体验`],
        twistPoint: '',
        endingType: endingTypeMap[tone] || '闭合式'
      }
    };
  }
}

module.exports = { CreativeDirectionAgent };
