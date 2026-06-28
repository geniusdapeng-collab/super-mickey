/**
 * Requirement Alignment Gate — 需求对齐闸机 (SuperMickey 适配版)
 *
 * 来源: 暴风战斧 requirement-alignment-gate.js
 * 适配: SuperMickey 四层架构，在最终返回前调用
 *
 * 核心能力：
 * 1. 需求契约提取：从用户意图中提取"不可协商元素"
 * 2. 多阶段对齐验证：检查各阶段是否保留契约元素
 * 3. 最终对齐评分：渲染前最后一道防线
 * 4. 反向追溯：从最终 prompts 反推是否包含原始故事
 */

class RequirementAlignmentGate {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.threshold = options.threshold || 0.7; // 对齐评分阈值
    this.strictMode = options.strictMode || false; // 严格模式：低于阈值阻止渲染

    // 动作关键词库
    this.actionKeywords = [
      '大战', '对决', '激战', '交锋', '碰撞', '追逐', '逃亡', '变身',
      '施展', '祭出', '释放', '挥舞', '横扫', '刺穿', '击碎', '闪避',
      '腾空', '飞跃', '坠落', '撞击', '炸裂', '爆发', '凝聚', '消散',
      'battle', 'clash', 'showdown', 'confrontation', 'collision', 'impact',
      'chase', 'pursuit', 'transform', 'perform', 'execute', 'cast',
      'unleash', 'swing', 'strike', 'shatter', 'dodge', 'evade',
      'leap', 'fly', 'fall', 'crash', 'explode', 'erupt', 'gather', 'dissipate'
    ];

    // 场景排除词
    this.sceneExcludeWords = ['天庭', '下令', '追捕', '请缨', '展开', '最终', '同时', '约定', '英雄'];
  }

  /**
   * SuperMickey 主入口：对齐验证
   * @param {string} intent - 用户原始意图
   * @param {Object} metadata - 元数据
   * @param {Object} result - 最终创作结果（包含 stages, shots, prompts）
   * @returns {Object} { pass, score, missing, report }
   */
  validate(intent, metadata, result) {
    if (!this.enabled || !intent || !result) {
      return { pass: true, score: 1.0, missing: [], report: {} };
    }

    console.log('\n🔍 [RequirementAlignmentGate] 需求对齐验证...');

    // 1. 提取需求契约
    const contract = this._extractContract(intent, metadata);

    // 2. 反向追溯：从最终结果反推
    const prompts = result.prompts || [];
    const shots = result.shots || [];

    const foundCharacters = this._checkCharacters(contract.characters, prompts, shots);
    const foundScenes = this._checkScenes(contract.scenes, prompts, shots);
    const foundActions = this._checkActions(contract.actions, prompts, shots);
    const foundProps = this._checkProps(contract.props, prompts, shots);
    const foundEmotion = this._checkEmotion(contract.emotion, prompts, shots);
    const foundStyle = this._checkStyle(contract.style, prompts, shots);

    // 3. 计算对齐评分
    const totalElements = contract.elementsCount;
    const foundElements = foundCharacters.found + foundScenes.found + foundActions.found + foundProps.found + (foundEmotion ? 1 : 0) + (foundStyle ? 1 : 0);
    const score = totalElements > 0 ? foundElements / totalElements : 1.0;

    const missing = [];
    if (foundCharacters.missing.length > 0) missing.push(`角色: ${foundCharacters.missing.join(', ')}`);
    if (foundScenes.missing.length > 0) missing.push(`场景: ${foundScenes.missing.join(', ')}`);
    if (foundActions.missing.length > 0) missing.push(`动作: ${foundActions.missing.join(', ')}`);
    if (foundProps.missing.length > 0) missing.push(`道具: ${foundProps.missing.join(', ')}`);
    if (!foundEmotion) missing.push(`情绪: ${contract.emotion}`);
    if (!foundStyle) missing.push(`风格: ${contract.style}`);

    const pass = score >= this.threshold;

    console.log(`   ${pass ? '✅' : '⚠️'} 对齐评分: ${(score * 100).toFixed(0)}% (阈值: ${(this.threshold * 100).toFixed(0)}%)`);
    if (missing.length > 0) {
      console.log(`   缺失元素: ${missing.slice(0, 3).join(' | ')}${missing.length > 3 ? '...' : ''}`);
    }

    return {
      pass,
      score,
      missing,
      report: {
        contract,
        foundCharacters,
        foundScenes,
        foundActions,
        foundProps,
        foundEmotion,
        foundStyle
      }
    };
  }

  // ========== 私有方法 ==========

  _extractContract(intent, metadata) {
    const text = intent || '';
    const characters = [];
    const scenes = [];
    const actions = [];
    const props = [];

    // 1. 提取角色（从 metadata 或意图）
    if (metadata.characters && Array.isArray(metadata.characters)) {
      for (const char of metadata.characters) {
        const name = typeof char === 'string' ? char : (char.name || char);
        if (name) characters.push(name);
      }
    }

    // 2. 提取场景关键词
    const scenePatterns = [
      /([\u4e00-\u9fa5]{2,6})(?:山|谷|林|海|湖|河|城|宫|殿|塔|洞|崖|原|野|空|庭|院|阁|楼)/g,
      /在([\u4e00-\u9fa5]{2,6})(?:上|中|里|内|外|下|前|后)/g
    ];
    for (const pattern of scenePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const sceneName = match[1];
        if (sceneName.length >= 2 && !this.sceneExcludeWords.includes(sceneName) && !characters.includes(sceneName)) {
          if (!scenes.includes(sceneName)) scenes.push(sceneName);
        }
      }
    }

    // 3. 提取动作关键词
    for (const keyword of this.actionKeywords) {
      if (text.includes(keyword)) {
        if (!actions.includes(keyword)) actions.push(keyword);
      }
    }

    // 4. 提取道具/武器
    const propPatterns = [
      /(?:[手持挥舞横扫刺穿击碎]{1,2})([\u4e00-\u9fa5]{1,4}(?:棒|刀|剑|枪|戟|叉|鞭|锤|斧|弓|箭|盾))/g,
      /([\u4e00-\u9fa5]{1,4}(?:棒|刀|剑|枪|戟|叉|鞭|锤|斧|弓|箭|盾|甲|袍|衣|冠|盔))/g,
      /([\u4e00-\u9fa5]{1,4}(?:火|水|风|雷|电|光|影|雾|云|气|波))/g
    ];
    for (const pattern of propPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const prop = match[1].trim();
        if (prop.length >= 2 && !props.includes(prop)) {
          props.push(prop);
        }
      }
    }

    // 5. 提取情绪
    const emotionKeywords = {
      '热血': 'epic', '暗黑': 'dark', '悬疑': 'suspense', '感人': 'emotional',
      '治愈': 'healing', '恐怖': 'horror', '史诗': 'epic', '悲壮': 'tragic',
      '激昂': 'epic', '紧张': 'tense', '温馨': 'warm', '震撼': 'shocking'
    };
    let emotion = null;
    for (const [cn, en] of Object.entries(emotionKeywords)) {
      if (text.includes(cn) || (metadata.style && metadata.style.primary === cn)) {
        emotion = cn;
        break;
      }
    }

    // 6. 提取风格
    const style = metadata.style?.primary || null;

    const elementsCount = characters.length + scenes.length + actions.length + props.length + (emotion ? 1 : 0) + (style ? 1 : 0);

    return {
      characters,
      scenes,
      actions,
      props,
      emotion,
      style,
      elementsCount
    };
  }

  _checkCharacters(characters, prompts, shots) {
    let found = 0;
    const missing = [];
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');

    for (const char of characters) {
      if (allText.includes(char)) {
        found++;
      } else {
        missing.push(char);
      }
    }

    return { found, missing, total: characters.length };
  }

  _checkScenes(scenes, prompts, shots) {
    let found = 0;
    const missing = [];
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');

    for (const scene of scenes) {
      if (allText.includes(scene)) {
        found++;
      } else {
        missing.push(scene);
      }
    }

    return { found, missing, total: scenes.length };
  }

  _checkActions(actions, prompts, shots) {
    let found = 0;
    const missing = [];
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');

    for (const action of actions) {
      if (allText.includes(action)) {
        found++;
      } else {
        missing.push(action);
      }
    }

    return { found, missing, total: actions.length };
  }

  _checkProps(props, prompts, shots) {
    let found = 0;
    const missing = [];
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');

    for (const prop of props) {
      if (allText.includes(prop)) {
        found++;
      } else {
        missing.push(prop);
      }
    }

    return { found, missing, total: props.length };
  }

  _checkEmotion(emotion, prompts, shots) {
    if (!emotion) return true;
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');
    return allText.includes(emotion);
  }

  _checkStyle(style, prompts, shots) {
    if (!style) return true;
    const allText = [...prompts.map(p => p.prompt || ''), ...shots.map(s => s.description || s.prompt || '')].join(' ');
    return allText.includes(style);
  }
}

module.exports = { RequirementAlignmentGate };
