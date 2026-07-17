// engines/script-engine/core/script-generator.js
// Script Generator - 调用 LLM 生成结构化剧本
// 版本：v1.0 | 日期：2026-06-07

const fs = require('fs');
const path = require('path');
const { ScriptBlueprint } = require('./script-blueprint');

class ScriptGenerator {
  constructor(options = {}) {
    this.config = {
      llmEndpoint: options.llmEndpoint || process.env.LLM_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      model: options.model || '003cENDPOINT_STD003e', // 使用文本模型
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
      promptTemplateDir: options.promptTemplateDir || path.join(__dirname, '../prompts'),
      templateDir: options.templateDir || path.join(__dirname, '../templates'),
      timeout: options.timeout || 180000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
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

## 世界观设定（Nirath）
- Nirath是地球前身，一个硅基与碳基生命共存的星球
- 《山海经》实为Nirath往事的记录
- 核心主题：记忆即存在
- 环境特征：硅晶草原、双月当空、等离子河流、晶体森林
- 禁止暗黑风格，要求明亮多色彩强质感

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
        "name": "AgentX",
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
2. 片头场景（SC00）必须有角色出场 + 对话，建立世界观
3. 高潮场景必须包含情感张力和视觉冲击力
4. 结尾场景必须有角色成长/感悟 + 下集钩子
5. 每个场景的台词必须包含在场景中（不能旁白）
6. 场景时长分配示例：SC00=15s, SC01=25s, SC02=30s, SC03=30s, SC04=20s（总120s）

请直接输出 JSON，不要包含任何其他解释文字。`;

    return prompt;
  }

  /**
   * 调用 LLM API
   */
  async _callLLM(prompt) {
    const axios = require('axios');
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[ScriptGenerator] LLM 调用尝试 ${attempt}/${this.config.maxRetries}`);

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

      // 解析 JSON
      const parsed = JSON.parse(jsonStr);

      // 构建 Blueprint
      const blueprint = new ScriptBlueprint({
        intent_ref: userIntent.intent_id,
        meta: {
          ...parsed.meta,
          narrative_mode: userIntent.parsed?.narrative_mode || 'dramatic',
          target_duration: userIntent.metadata?.target_duration || 120
        },
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
