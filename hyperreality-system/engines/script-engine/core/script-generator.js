// engines/script-engine/core/script-generator.js
// Script Generator - 调用 LLM 生成结构化剧本
// 版本：v1.0 | 日期：2026-06-07

const fs = require('fs');
const path = require('path');
const { ScriptBlueprint } = require('./script-blueprint');

// 复用现有LLM引擎
const LLM_ENGINE_PATH = path.join(__dirname, '../../../../systems/llm-reasoning-engine.js');
let LLMEngine;
try {
  ({ LLMEngine } = require(LLM_ENGINE_PATH));
} catch (e) {
  console.warn('[ScriptGenerator] 无法加载LLMEngine:', e.message);
}

class ScriptGenerator {
  constructor(options = {}) {
    this.config = {
      llmEndpoint: options.llmEndpoint || process.env.LLM_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      model: options.model || 'ep-20260518004622-jp46s',
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature || 1,
      promptTemplateDir: options.promptTemplateDir || path.join(__dirname, '../prompts'),
      templateDir: options.templateDir || path.join(__dirname, '../templates'),
      timeout: options.timeout || 300000, // v1.2.5: 从180s增加到300s，API有时需要更长时间
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // 初始化LLM引擎（优先使用现有引擎）
    this.llmEngine = null;
    if (LLMEngine) {
      this.llmEngine = new LLMEngine({
        model: 'kimi-k2p6',
        maxTokens: this.config.maxTokens,
        timeoutMs: this.config.timeout,
        maxRetries: this.config.maxRetries
      });
      console.log('[ScriptGenerator] 使用LLMEngine (kimi-k2p6)');
    }
  }

  /**
   * 主入口：生成剧本
   * @param {object} userIntent - 用户意图对象
   * @param {object} templateData - 模板数据（可选）
   * @returns {ScriptBlueprint} 生成的剧本蓝图
   */
  async generate(userIntent, templateData = null) {
    console.log(`[ScriptGenerator] 开始生成剧本: ${userIntent.metadata?.title}`);

    // 1. 加载模板
    const template = templateData || await this._loadTemplate(userIntent);

    // 2. 构建 LLM Prompt
    const prompt = this._buildGenerationPrompt(userIntent, template);

    // 3. 调用 LLM
    const llmResponse = await this._callLLM(prompt);

    // 4. 解析并构建 Blueprint
    const blueprint = this._parseLLMResponse(llmResponse, userIntent);

    console.log(`[ScriptGenerator] 剧本生成完成: ${blueprint.blueprint_id}, ${blueprint.structure.scenes.length} 场景`);
    return blueprint;
  }

  /**
   * 加载模板
   */
  async _loadTemplate(userIntent) {
    const mode = userIntent.parsed?.primary_mode || 'dramatic';
    const templatePath = path.join(this.config.templateDir, `${mode}-template.json`);

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      return JSON.parse(templateContent);
    } catch (err) {
      console.warn(`[ScriptGenerator] 模板加载失败: ${templatePath}, 使用默认模板`);
      return this._getDefaultTemplate();
    }
  }

  /**
   * 获取默认模板
   */
  _getDefaultTemplate() {
    return {
      structure: {
        acts: [
          { act_id: 'ACT-1', act_name: '第一幕', act_function: 'establish', beats: [] },
          { act_id: 'ACT-2', act_name: '第二幕', act_function: 'confront', beats: [] },
          { act_id: 'ACT-3', act_name: '第三幕', act_function: 'resolve', beats: [] }
        ]
      },
      default_scene_count: 5,
      default_duration_per_scene: 20
    };
  }

  /**
   * 构建 LLM 生成 Prompt
   */
  _buildGenerationPrompt(userIntent, template) {
    const meta = userIntent.metadata;
    const constraints = userIntent.constraints;
    const parsed = userIntent.parsed;

    const prompt = `你是一位顶级短视频编剧，专门为AI视频生成系统创作结构化剧本。

## 任务
为以下项目创作完整的结构化剧本，输出必须是严格的 JSON 格式。

## 项目信息
- 标题：${meta.title}
- 叙事类型：${parsed.primary_mode} ${parsed.hybrid_config ? '+ ' + parsed.secondary_modes.join(', ') : ''}
- 目标时长：${meta.target_duration}秒
- 世界观：${meta.world_setting}
${meta.featured_beast_id ? '- 主角异兽：' + meta.featured_beast_id : ''}
- 主角：${meta.protagonist}
- 平台：${meta.target_platform.join(', ')}
- 语言：${meta.language}

## 系统约束（不可违反）
1. 禁止旁白（Voiceover），只保留角色对话（Dialogue）
2. 每个场景必须有角色对话（台词）
3. 台词必须口语化，适合短视频节奏（每句不超过30字）
4. 场景时长分配：根据内容重要性、台词长度、视觉复杂度三维度分配
5. 总时长必须严格等于 ${meta.target_duration} 秒
6. 角色视觉锚点必须保持一致（定妆照引用）

## 剧本结构模板
采用三幕式结构：
${JSON.stringify(template.structure.acts, null, 2)}

## 世界观设定
${meta.world_setting === 'Nirath' ? `
- Nirath是地球前身，一个硅基与碳基生命共存的星球
- 《山海经》实为Nirath往事的记录
- 核心主题：记忆即存在
- 环境特征：硅晶草原、双月当空、等离子河流、晶体森林
- 禁止暗黑风格，要求明亮多色彩强质感
` : meta.world_setting ? `
- 世界观：${meta.world_setting}
` : `
- 现实世界设定，真实场景，写实风格
- 环境特征：根据内容类型选择合适场景（医院、实验室、户外等）
- 要求明亮、专业、可信的视觉效果
`}

## 输出格式要求
你必须输出一个严格的 JSON 对象，符合以下 Schema：

\`\`\`json
{
  "meta": {
    "title": "标题",
    "narrative_mode": "dramatic",
    "target_duration": ${meta.target_duration},
    "acts_count": 3,
    "scenes_count": 场景数量
  },
  "structure": {
    "acts": [
      {
        "act_id": "ACT-1",
        "act_name": "幕名称",
        "act_function": "establish|confront|resolve",
        "start_time": 0,
        "end_time": 幕结束秒数,
        "beats": [
          {
            "beat_id": "B-1.1",
            "beat_type": "hook|setup|rising|climax|resolution",
            "description": "节拍描述",
            "target_emotion": "wonder|tension|joy|sadness|awe"
          }
        ]
      }
    ],
    "scenes": [
      {
        "scene_id": "SC00",
        "scene_name": "场景名称",
        "scene_type": "opening|establishing|conflict|emotional_climax|resolution",
        "scene_function": "establish|advance|conflict|climax|resolve",
        "act_id": "ACT-1",
        "timing": {
          "start": 开始秒数,
          "duration": 持续秒数,
          "end": 结束秒数
        },
        "characters": ["角色ID"],
        "setting": "场景时空设定",
        "dialogue": {
          "has_dialogue": true,
          "lines": [
            {
              "speaker": "角色ID",
              "text": "台词内容（口语化，不超过30字）",
              "emotion": "情绪标签"
            }
          ]
        },
        "visual_notes": "视觉指导备注",
        "emotional_target": {
          "valence": 0.8,
          "arousal": 0.6,
          "dominance": 0.5
        }
      }
    ]
  },
  "character_system": {
    "characters": [
      {
        "character_id": "xiaoG",
        "name": "小G",
        "role": "protagonist",
        "voice_profile": {
          "persona": "角色人设描述",
          "tone": "语气标签",
          "speaking_style": "说话风格"
        },
        "visual_anchor": {
          "core_features": ["核心特征1", "核心特征2", "核心特征3"],
          "reference_images": ["定妆照路径"]
        }
      }
    ]
  },
  "voice_system": {
    "global_voice_policy": "dialogue_only_no_voiceover",
    "voice_profiles": [
      {
        "voice_id": "V-角色ID",
        "character_id": "角色ID",
        "role": "角色定位",
        "tone": "语气",
        "pace": "语速",
        "constraints": {
          "forbidden_words": ["禁用词"],
          "max_line_length": 30
        }
      }
    ]
  },
  "world_setting": {
    "world_id": "nirath",
    "world_name": "Nirath星球",
    "era": "上古纪元",
    "core_rules": ["规则1", "规则2"],
    "environment_tags": ["环境标签1", "环境标签2"]
  }
}
\`\`\`

## 关键要求
1. 场景数量建议 5-7 个，总时长严格等于 ${meta.target_duration} 秒
2. 每个场景的台词必须包含在场景中（不能旁白）
3. 场景时长分配需严格计算，总和必须精确等于${meta.target_duration}秒，例如：${Math.round(meta.target_duration/5)}秒×5场景
4. 角色视觉锚点必须保持一致（定妆照引用）
${meta.characters?.length > 0 ? `
## 角色信息（必须严格使用，禁止自创角色）
${meta.characters.map(c => `- ${c.name} (ID: ${c.id || c.name}): ${c.description || '主讲人'}`).join('\n')}
` : ''}
${meta.series?.totalEpisodes > 1 ? `
## 系列作品约束（极其重要）
- 这是第 ${meta.series?.currentEpisode || 1} 集 / 共 ${meta.series?.totalEpisodes} 集
- 本集主题：${meta.series?.episodeTitles?.[meta.series?.currentEpisode - 1] || meta.title}
- 内容边界：只讲本集主题，不跨集（不重复已讲内容，不提前讲后续内容）
${meta.series?.currentEpisode > 1 ? '- **本集无片头标题画面**（片头仅第一集有）' : ''}
${meta.noNextEpisodePreview ? '- **结尾禁止预告下一集**（不提及后续内容）' : ''}
` : ''}
5. 高潮场景必须包含情感张力和视觉冲击力

请直接输出 JSON，不要包含任何其他解释文字。`;

    return prompt;
  }

  /**
   * 调用 LLM API
   * v1.1: 优先使用LLMEngine (kimi-k2p6)
   */
  async _callLLM(prompt) {
    // 优先使用LLMEngine
    if (this.llmEngine) {
      try {
        console.log('[ScriptGenerator] 使用LLMEngine调用...');
        // v1.2.5: 增加maxTokens到32000，防止长推理导致JSON截断
        // 同时要求紧凑输出以减少token消耗
        const result = await this.llmEngine.generate(prompt, {
          systemPrompt: '你是一位专业的AI视频编剧。只输出严格格式的JSON，不要markdown代码块，不要解释，不要思考过程。使用最紧凑的JSON格式（不要换行和缩进）。',
          maxTokens: 32000,
          timeoutMs: this.config.timeout
        });
        
        // v1.2.5-fix: 正确处理LLM引擎返回结构
        if (!result.success) {
          console.error('[ScriptGenerator] LLM引擎返回失败:', result.error);
          throw new Error(`LLM引擎错误: ${result.error}`);
        }
        
        if (result.content && result.content.trim()) {
          return result.content.trim();
        }
        if (result.reasoning_content && result.reasoning_content.trim()) {
          console.warn('[ScriptGenerator] 从reasoning_content提取内容');
          return result.reasoning_content.trim();
        }
        throw new Error('LLM返回空内容（success=true但content为空）');
      } catch (error) {
        console.error('[ScriptGenerator] LLMEngine调用失败:', error.message);
        throw error;
      }
    }
    
    // 降级：直接HTTP调用（保留旧逻辑作为fallback）
    const axios = require('axios');
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[ScriptGenerator] LLM 直接调用尝试 ${attempt}/${this.config.maxRetries}`);

        const response = await axios.post(
          this.config.llmEndpoint,
          {
            model: this.config.model,
            messages: [
              { role: 'system', content: '你是一位专业的AI视频编剧，只输出严格格式的JSON。' },
              { role: 'user', content: prompt }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        );

        const content = response.data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('LLM 返回内容为空');
        }

        return content;

      } catch (error) {
        lastError = error;
        console.warn(`[ScriptGenerator] LLM 调用失败 (${attempt}/${this.config.maxRetries}): ${error.message}`);

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`LLM 调用失败，已重试 ${this.config.maxRetries} 次: ${lastError?.message}`);
  }

  /**
   * 解析 LLM 响应
   */
  _parseLLMResponse(response, userIntent) {
    try {
      // 清理响应中的 markdown 代码块标记
      let jsonStr = response;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      // v1.2.5: 尝试解析JSON，失败则尝试从截断文本中提取
      let parsed = this._tryParseJson(jsonStr);
      
      // 如果主解析失败，尝试从文本中提取最长有效JSON
      if (!parsed) {
        console.warn('[ScriptGenerator] 主JSON解析失败，尝试提取有效JSON...');
        parsed = this._extractValidJson(jsonStr);
      }
      
      if (!parsed) {
        throw new Error('无法从响应中提取有效JSON');
      }

      // v1.2.5: 从metadata注入角色信息（覆盖LLM生成的错误角色）
      const metadataChars = userIntent.metadata?.characters || [];
      if (metadataChars.length > 0) {
        const overrideCharacters = metadataChars.map(c => ({
          character_id: c.id || c.name,
          name: c.name,
          role: c.role || 'protagonist',
          visual_anchor: {
            core_features: c.description ? c.description.split(/[,，、]/) : ['写实人物'],
            reference_images: c.portraitPaths || c.portraits || []
          },
          voice_profile: {
            persona: c.description || c.name,
            tone: '专业',
            speaking_style: '口语化科普'
          }
        }));
        
        // 替换LLM生成的角色
        parsed.character_system = {
          characters: overrideCharacters
        };
        
        // 同时替换所有场景中的角色引用
        if (parsed.structure?.scenes) {
          for (const scene of parsed.structure.scenes) {
            if (scene.characters) {
              scene.characters = overrideCharacters.map(c => c.character_id);
            }
            if (scene.dialogue?.lines) {
              for (const line of scene.dialogue.lines) {
                line.speaker = overrideCharacters[0]?.name || line.speaker;
              }
            }
          }
        }
        
        console.log(`[ScriptGenerator] 角色覆盖: ${metadataChars.map(c => c.name).join(', ')}`);
      }

      // v1.2.5: 注入metadata._metadata到blueprint meta
      const meta = {
        ...parsed.meta,
        narrative_mode: userIntent.parsed?.narrative_mode || 'dramatic',
        target_duration: userIntent.metadata?.target_duration || 120,
        _metadata: {
          isSeries: userIntent.metadata?.series?.totalEpisodes > 1,
          episodeNumber: userIntent.metadata?.series?.currentEpisode || 1,
          totalEpisodes: userIntent.metadata?.series?.totalEpisodes || 1,
          hasOpening: userIntent.metadata?.hasOpening !== false,
          noNextEpisodePreview: userIntent.metadata?.noNextEpisodePreview || false,
          aspectRatio: userIntent.metadata?.aspectRatio || '16:9',
          ...userIntent.metadata?._metadata
        }
      };

      // 构建 Blueprint
      const blueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: meta,
        structure: parsed.structure,
        character_system: parsed.character_system,
        voice_system: parsed.voice_system,
        world_setting: parsed.world_setting,
        extensions: {
          dramatic_extension: parsed.dramatic_extension || {},
          nirath_extension: {
            featured_beast_id: userIntent.metadata?.featured_beast_id,
            memory_theme: '记忆即存在'
          }
        }
      });

      return blueprint;

    } catch (err) {
      console.error('[ScriptGenerator] JSON 解析失败:', err.message);
      console.error('[ScriptGenerator] 原始响应:', response.substring(0, 500));

      // 返回一个带有错误信息的 Blueprint
      const fallbackBlueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          title: userIntent.metadata?.title || '生成失败',
          narrative_mode: 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
        quality_report: {
          evaluator: 'Error',
          scores: { error: 0 },
          passed: false
        }
      });

      fallbackBlueprint._generation_error = {
        message: err.message,
        raw_response: response.substring(0, 1000)
      };

      return fallbackBlueprint;
    }
  }

  /**
   * v1.2.5: 尝试解析JSON字符串
   * @returns {object|null} 解析成功返回对象，失败返回null
   */
  _tryParseJson(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  /**
   * v1.2.5: 从可能截断的文本中提取最长有效JSON
   * 策略：从字符串末尾逐步截断，尝试找到能解析的最长前缀
   */
  _extractValidJson(str) {
    // 先找到最外层的大括号范围
    let start = str.indexOf('{');
    if (start === -1) return null;
    
    // 从字符串末尾开始，逐步向前尝试解析
    // 步长：先尝试大步长，再精细搜索
    const stepSizes = [1000, 500, 100, 50, 10, 5, 1];
    let bestEnd = -1;
    
    for (const step of stepSizes) {
      for (let end = str.length; end > start; end -= step) {
        const candidate = str.substring(start, end);
        try {
          const parsed = JSON.parse(candidate);
          // 确保解析结果至少包含meta和structure
          if (parsed.meta && parsed.structure) {
            bestEnd = end;
            // 记录这次成功的解析
            console.log(`[ScriptGenerator] 从截断文本提取JSON成功，使用 ${end}/${str.length} 字符`);
            return parsed;
          }
        } catch (e) {
          // 继续尝试
        }
      }
      
      // 如果已经找到有效JSON，停止搜索
      if (bestEnd > 0) break;
    }
    
    // 最后的尝试：直接找第一个完整的JSON对象
    if (bestEnd === -1) {
      // 尝试使用更暴力的方法：找到匹配的最后一个右大括号
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      let lastValidEnd = -1;
      
      for (let i = start; i < str.length; i++) {
        const ch = str[i];
        
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
        } else if (ch === '{') {
          braceCount++;
        } else if (ch === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastValidEnd = i + 1;
          }
        }
      }
      
      if (lastValidEnd > start) {
        const candidate = str.substring(start, lastValidEnd);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed.meta && parsed.structure) {
            console.log(`[ScriptGenerator] 通过括号匹配提取JSON成功，使用 ${lastValidEnd}/${str.length} 字符`);
            return parsed;
          }
        } catch (e) {
          // 失败
        }
      }
    }
    
    return null;
  }

  /**
   * 保存剧本到文件
   */
  async saveBlueprint(blueprint, outputPath) {
    const json = blueprint.toJSON();
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`[ScriptGenerator] 剧本已保存: ${outputPath}`);
    return outputPath;
  }

  /**
   * 从文件加载剧本
   */
  static loadBlueprint(filePath) {
    const json = fs.readFileSync(filePath, 'utf-8');
    return ScriptBlueprint.fromJSON(json);
  }
}

module.exports = { ScriptGenerator };
