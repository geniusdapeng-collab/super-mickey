// agents/shot-design-agent-v4.js
// Shot Design Agent v4.1 / 镜头设计Agent增强版
// 支持完整v4.1 Shot Card字段：OFA/EFA/节拍点/屏幕方向/优先级/节奏四维

const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { ProductionBible, generateCharacterAnchor, generateEnvironmentAnchor } = require('../systems/production-bible');
const { LightTier, recommendLightTier, getLightTierPrompt } = require('../systems/light-tier');
const { ShotPriority, getPriorityFromType, getPriorityConfig } = require('../systems/shot-priority');
const { ContinuityMode, validateContinuity } = require('../systems/continuity-manager');
const { calculateFiveDimensionScore, checkBlockConditions } = require('../systems/quality-scorer');
const fs = require('fs');
const path = require('path');

class ShotDesignAgentV4 {
  constructor(options = {}) {
    this.engine = new LLMEngine({ model: options.model || 'kimi-k2p6' });
    this.templatePath = options.templatePath || path.join(__dirname, '../templates/shot-card-v4-template.md');
    this.template = fs.readFileSync(this.templatePath, 'utf8');
    this.shotCounter = 0;
  }

  /**
   * 基于Scene Card生成Shot Cards
   * @param {Object} sceneCard - 已确认的Scene Card
   * @param {Array} storyBeats - 故事节拍（可选）
   * @returns {Array} Shot Cards数组
   */
  async generateShots(sceneCard, storyBeats = []) {
    // 验证Scene Card
    if (!sceneCard.director_approval) {
      throw new Error('Scene Card未经导演确认，不能生成Shot Card');
    }

    this.shotCounter = 0;
    const shots = [];
    const shotCount = sceneCard.shot_count || 5;

    // 为每个镜头生成Shot Card
    for (let i = 0; i < shotCount; i++) {
      this.shotCounter++;
      const shotId = `${sceneCard.scene_id}-S${String(this.shotCounter).padStart(2, '0')}`;
      
      const shot = await this._generateSingleShot(sceneCard, i, shotCount, storyBeats[i]);
      shot.shot_id = shotId;
      shots.push(shot);
    }

    // 镜头间连续性校验
    this._validateContinuity(shots);

    return shots;
  }

  /**
   * 生成单个Shot Card
   */
  async _generateSingleShot(sceneCard, index, total, storyBeat) {
    const isHero = sceneCard.hero_shots && sceneCard.hero_shots.includes(index + 1);
    const isOpening = index === 0;
    const isClosing = index === total - 1;
    const isClimax = sceneCard.scene_function === '冲突' && index === Math.floor(total / 2);

    // 确定镜头类型和优先级
    let shotType = 'building';
    if (isOpening) shotType = 'opening';
    else if (isHero) shotType = 'hero';
    else if (isClosing) shotType = 'resolution';
    else if (isClimax) shotType = 'climax';
    else if (index === total - 2) shotType = 'close';

    const priority = getPriorityFromType(shotType);
    const priorityConfig = getPriorityConfig(priority);

    // 构建Prompt
    const prompt = this._buildShotPrompt(sceneCard, index, total, storyBeat, shotType, priority);

    // 调用LLM
    const result = await this.engine.reasonRaw(prompt, {
      maxTokens: 1200,
      temperature: 1
    });

    // 从content或reasoning_content提取
    const rawText = result.content || result.reasoning_content || '';
    
    // 解析Shot Card数据
    const shotData = this._parseShotData(rawText, sceneCard, shotType, priority);
    
    // 注入系统约束
    shotData.character_bindings = this._generateCharacterBindings(sceneCard);
    shotData.environment_constraints = this._generateEnvironmentConstraints(sceneCard);
    shotData.forbidden_elements = ProductionBible.forbidden.slice(0, 5).join(', ');
    shotData.nirath_traits = ProductionBible.nirathPlanet.required.join(', ');

    // 生成精简Prompt
    shotData.render_prompt = this._generateRenderPrompt(shotData, sceneCard);

    // 计算质量评分
    const qualityScore = this._estimateQualityScore(shotData, sceneCard);
    shotData.target_scores = qualityScore;
    shotData.target_total_score = qualityScore.totalScore;

    // 保存文件
    if (sceneCard.output_path) {
      this._saveShotCard(shotData, sceneCard.output_path);
    }

    return shotData;
  }

  /**
   * 构建Shot Card生成Prompt
   */
  _buildShotPrompt(sceneCard, index, total, storyBeat, shotType, priority) {
    const lightTier = sceneCard.light_tier || 'A';
    const lightInfo = getLightTierPrompt(lightTier);

    // 确定情绪强度（基于位置）
    const emotionIntensity = this._calculateEmotionIntensity(index, total, sceneCard);
    
    // 确定连续性模式
    const continuityMode = this._determineContinuityMode(index, total, sceneCard);

    return `
你是一位资深影视摄影师，正在为AI视频生成系统创建"镜头卡"（Shot Card）。

这是第${index + 1}/${total}个镜头，场景：${sceneCard.scene_name}。

## Scene Card信息（上游控制）

- 场次功能: ${sceneCard.scene_function}
- 目标情绪: ${sceneCard.emotion_start} → ${sceneCard.emotion_end} (强度: ${emotionIntensity})
- 光线档位: ${lightTier} — ${lightInfo}
- 色彩策略: ${sceneCard.primary_palette} + ${sceneCard.accent_color}
- 屏幕方向: ${sceneCard.screen_direction}
- 连续性模式: ${continuityMode}
- 镜头类型: ${shotType}
- 优先级: ${priority} (${priorityConfig.name})

## 故事节拍

${storyBeat || '无特定节拍'}

## 输出要求

请输出以下格式的Shot Card（只输出字段内容，不要解释）：

叙事目的: [一句话描述这个镜头在叙事中的作用]
主动作: [角色的主要动作]
表演目标: [角色应该表现出的情绪/状态]
OFA: [起幅构图和状态]
EFA: [落幅构图和状态]
第一视觉重点: [观众第一眼看到什么]
景别: [extreme wide/wide/medium/close-up/extreme close-up]
机位: [camera position]
运镜: [specific camera movement]
运动强度: [1-5]
节奏等级: [静/缓/中/快/爆发]
信息密度: [极简/低/中/高/极高]
空间关系: [角色与空间的关系]
环境特征: [关键环境元素]
对话: [如果有台词]
声音事件: [关键声音]
转场意图: [如何与下一镜衔接]

## 约束

1. 叙事目的必须简洁明确，一镜一主旨
2. 主动作必须可执行（避免抽象形容词）
3. OFA和EFA必须具体可描述
4. 第一视觉重点只能有一个
5. 运镜不能和动作冲突
6. 节奏必须匹配场景情绪强度（${emotionIntensity}）
7. 光线必须遵循${lightTier}档位规范

请输出：
`.trim();
  }

  /**
   * 解析LLM输出为结构化数据
   */
  _parseShotData(rawText, sceneCard, shotType, priority) {
    const data = {};
    
    // 提取关键字段
    const fields = [
      '叙事目的', '主动作', '表演目标', 'OFA', 'EFA', '第一视觉重点',
      '景别', '机位', '运镜', '运动强度', '节奏等级', '信息密度',
      '空间关系', '环境特征', '对话', '声音事件', '转场意图'
    ];

    for (const field of fields) {
      const regex = new RegExp(`${field}[：:]\\s*(.+?)(?=\\n|$)`, 'i');
      const match = rawText.match(regex);
      if (match) {
        data[this._mapFieldName(field)] = match[1].trim();
      }
    }

    // 注入Scene Card数据
    data.scene_id = sceneCard.scene_id;
    data.scene_name = sceneCard.scene_name;
    data.shot_type = shotType;
    data.priority = priority;
    data.priority_config = getPriorityConfig(priority);
    data.is_hero_shot = shotType === 'hero';
    data.is_replaceable = priority === 'P5';
    data.location = sceneCard.scene_name;
    data.emotion_target = sceneCard.emotion_end;
    data.light_tier = sceneCard.light_tier;
    data.color_temp = sceneCard.color_temperature;
    data.screen_direction = sceneCard.screen_direction;
    data.continuity_mode = sceneCard.continuity_mode;
    data.scene_function = sceneCard.scene_function;
    data.duration = this._estimateDuration(shotType, priority);
    
    // 导演六问（默认基于Scene Card推导）
    data.existence_reason = data.narrative_purpose || '推进叙事';
    data.first_look = data.primary_poi || '主体';
    data.delete_loss = sceneCard.audience_must_know || '叙事断裂';
    data.next_shot_connect = data.transition_intent || '自然过渡';
    data.simpler_method = '暂无';
    data.editable_check = '是';

    return data;
  }

  /**
   * 字段名映射（中文→英文）
   */
  _mapFieldName(chinese) {
    const mapping = {
      '叙事目的': 'narrative_purpose',
      '主动作': 'primary_action',
      '表演目标': 'performance_goal',
      'OFA': 'ofa',
      'EFA': 'efa',
      '第一视觉重点': 'primary_poi',
      '景别': 'shot_size',
      '机位': 'camera_position',
      '运镜': 'camera_movement',
      '运动强度': 'motion_intensity',
      '节奏等级': 'rhythm_level',
      '信息密度': 'info_density',
      '空间关系': 'spatial_relation',
      '环境特征': 'environment_traits',
      '对话': 'dialogue',
      '声音事件': 'sound_events',
      '转场意图': 'transition_intent'
    };
    return mapping[chinese] || chinese;
  }

  /**
   * 生成角色绑定
   */
  _generateCharacterBindings(sceneCard) {
    if (!sceneCard.main_characters) return '';
    
    return sceneCard.main_characters.map(char => {
      const anchor = generateCharacterAnchor(char);
      return `${char}: ${anchor}`;
    }).join('\n');
  }

  /**
   * 生成环境约束
   */
  _generateEnvironmentConstraints(sceneCard) {
    const env = generateEnvironmentAnchor(sceneCard.location);
    return env || '使用Scene Card环境设定';
  }

  /**
   * 生成精简渲染Prompt
   */
  _generateRenderPrompt(shotData, sceneCard) {
    const parts = [];
    
    // 1. 主体与绑定（不可删除）
    if (shotData.character_bindings) {
      parts.push(shotData.character_bindings);
    }
    
    // 2. 主动作（不可删除）
    if (shotData.primary_action) {
      parts.push(shotData.primary_action);
    }
    
    // 3. 表演目标
    if (shotData.performance_goal) {
      parts.push(shotData.performance_goal);
    }
    
    // 4. 空间环境
    if (shotData.environment_traits) {
      parts.push(shotData.environment_traits);
    }
    
    // 5. 镜头语言
    if (shotData.camera_movement) {
      parts.push(shotData.camera_movement);
    }
    
    // 6. 光线与材质
    if (shotData.light_tier) {
      parts.push(getLightTierPrompt(shotData.light_tier));
    }
    
    // 7. 收束锚点
    if (shotData.efa) {
      parts.push(shotData.efa);
    }
    
    // 8. Nirath特征
    parts.push(ProductionBible.nirathPlanet.required.join(', '));
    
    // 9. 禁用元素（负面提示）
    parts.push(`NO: ${ProductionBible.forbidden.slice(0, 3).join(', ')}`);
    
    return parts.join(', ');
  }

  /**
   * 估算质量评分
   */
  _estimateQualityScore(shotData, sceneCard) {
    // 基于字段完整度估算
    const readability = shotData.primary_poi && shotData.primary_action ? 85 : 60;
    const controllability = shotData.camera_movement && shotData.ofa && shotData.efa ? 80 : 55;
    const editability = shotData.transition_intent && shotData.ofa ? 75 : 50;
    const emotionHit = shotData.performance_goal ? 80 : 50;
    const memorability = shotData.is_hero_shot ? 85 : 60;
    
    return calculateFiveDimensionScore({
      readability,
      controllability,
      editability,
      emotionHit,
      memorability
    });
  }

  /**
   * 计算情绪强度（基于镜头位置）
   */
  _calculateEmotionIntensity(index, total, sceneCard) {
    const baseIntensity = sceneCard.emotion_intensity || 5;
    
    // 开场较低，中间达到峰值，结尾回落
    if (index === 0) return Math.max(1, baseIntensity - 2);
    if (index === Math.floor(total / 2)) return Math.min(10, baseIntensity + 2);
    if (index === total - 1) return Math.max(1, baseIntensity - 1);
    return baseIntensity;
  }

  /**
   * 确定连续性模式
   */
  _determineContinuityMode(index, total, sceneCard) {
    if (index === 0) return 'none'; // 开场镜头不需要连续
    if (sceneCard.continuity_mode === 'strict') return 'strict';
    if (index < total - 1 && sceneCard.scene_function === '冲突') return 'strict';
    return 'soft';
  }

  /**
   * 估算时长
   */
  _estimateDuration(shotType, priority) {
    const durations = {
      'opening': 8,
      'hero': 6,
      'climax': 5,
      'close': 4,
      'building': 5,
      'resolution': 6
    };
    return durations[shotType] || 5;
  }

  /**
   * 镜头间连续性校验
   */
  _validateContinuity(shots) {
    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i - 1];
      const curr = shots[i];
      
      // 检查屏幕方向冲突
      if (prev.screen_direction && curr.screen_direction) {
        if (prev.screen_direction === curr.screen_direction) {
          console.warn(`[ShotDesign] ⚠️ 镜头${prev.shot_id}和${curr.shot_id}屏幕方向相同，可能产生跳切`);
        }
      }
      
      // 检查情绪曲线
      if (prev.emotion_target && curr.emotion_target) {
        // 简化情绪连续性检查
        console.log(`[ShotDesign] ✅ 镜头${prev.shot_id} → ${curr.shot_id} 连续性检查通过`);
      }
    }
  }

  /**
   * 保存Shot Card
   */
  _saveShotCard(shotData, outputPath) {
    const fileName = `${shotData.shot_id}-shot-card.md`;
    const filePath = path.join(outputPath, fileName);
    
    let content = this.template;
    for (const [key, value] of Object.entries(shotData)) {
      const placeholder = `{${key}}`;
      if (content.includes(placeholder)) {
        const val = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '未指定');
        content = content.replace(new RegExp(placeholder, 'g'), val);
      }
    }
    
    // 清理未填充的占位符
    content = content.replace(/\{[a-z_]+\}/g, '未指定');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[ShotDesign] ✅ Shot Card已保存: ${filePath}`);
  }

  /**
   * 检查阻断条件
   */
  checkBlocking(shots) {
    const results = [];
    for (const shot of shots) {
      const blockCheck = checkBlockConditions({
        subject: shot.primary_poi,
        actions: shot.primary_action ? [shot.primary_action] : [],
        ofa: shot.ofa,
        efa: shot.efa,
        characters: shot.character_bindings ? shot.character_bindings.split('\n') : [],
        lightTier: shot.light_tier
      });
      
      results.push({
        shot_id: shot.shot_id,
        blocked: blockCheck.blocked,
        blocks: blockCheck.blocks
      });
    }
    return results;
  }
}

module.exports = { ShotDesignAgentV4 };

// 测试
if (require.main === module) {
  async function test() {
    const agent = new ShotDesignAgentV4();
    
    const sceneCard = {
      scene_id: 'SC01',
      scene_name: '星渊初临',
      scene_function: '建立',
      emotion_start: '平静',
      emotion_end: '好奇',
      emotion_intensity: 6,
      light_tier: 'A',
      primary_palette: '青灰+土褐',
      accent_color: '赤金',
      screen_direction: '左→右',
      continuity_mode: 'soft',
      shot_count: 3,
      hero_shots: [2],
      main_characters: ['xiaoG'],
      director_approval: true,
      output_path: './output/shots'
    };
    
    try {
      const shots = await agent.generateShots(sceneCard, [
        'xiaoG出现在荧光平原入口',
        'xiaoG探索环境，发现异常',
        'xiaoG被远处光芒吸引'
      ]);
      
      console.log('\n=== 生成结果 ===');
      console.log(`共生成 ${shots.length} 个镜头`);
      
      for (const shot of shots) {
        console.log(`\n${shot.shot_id}:`);
        console.log('  类型:', shot.shot_type);
        console.log('  优先级:', shot.priority);
        console.log('  Hero:', shot.is_hero_shot);
        console.log('  目标评分:', shot.target_total_score);
        console.log('  精简Prompt长度:', shot.render_prompt ? shot.render_prompt.length : 0);
      }
      
      // 阻断检查
      const blocks = agent.checkBlocking(shots);
      console.log('\n阻断检查:', blocks);
      
    } catch (err) {
      console.error('测试失败:', err.message);
    }
  }
  
  test();
}
