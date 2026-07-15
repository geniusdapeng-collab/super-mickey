#!/usr/bin/env node
/**
 * Requirement Alignment Gate v1.0-Peng
 * 原始需求对齐闸机 — 确保最终产出与用户需求一致
 * 
 * 核心机制：
 * 1. 需求契约提取：从用户大纲中提取"不可协商元素"
 * 2. 多阶段对齐验证：每个生产阶段检查契约元素是否保留
 * 3. 最终对齐评分：渲染前最后一道防线
 * 4. 反向追溯：从最终prompt反推是否包含原始故事
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

// v5.5-Peng: 全局常量定义（避免硬编码分散在方法中）
const ACTION_KEYWORDS = [
  // 中文动作词
  '大战', '对决', '激战', '交锋', '碰撞', '追逐', '逃亡', '变身',
  '施展', '祭出', '释放', '挥舞', '横扫', '刺穿', '击碎', '闪避',
  '腾空', '飞跃', '坠落', '撞击', '炸裂', '爆发', '凝聚', '消散',
  // 英文动作词（CinePrompt V2）
  'battle', 'clash', 'showdown', 'confrontation', 'collision', 'impact',
  'chase', 'pursuit', 'transform', 'perform', 'execute', 'cast',
  'unleash', 'swing', 'strike', 'shatter', 'dodge', 'evade',
  'leap', 'fly', 'fall', 'crash', 'explode', 'erupt', 'gather', 'dissipate'
];

const SCENE_EXCLUDE_WORDS = ['天庭', '下令', '追捕', '请缨', '展开', '最终', '同时', '约定', '英雄'];

// ============ 需求契约提取器 ============
class RequirementContract {
  constructor(userOutline, userCharacters, userStyle, userType, userDuration) {
    this.rawOutline = userOutline || '';
    this.rawCharacters = userCharacters || '';
    this.rawStyle = userStyle || '';
    this.rawType = userType || '';
    this.rawDuration = userDuration || 180;
    
    // 提取契约元素
    this.elements = this._extractElements();
  }

  _extractElements() {
    const elements = {
      // 角色契约
      characters: [],
      // 场景契约（关键地点/环境）
      scenes: [],
      // 动作契约（关键动作/事件）
      actions: [],
      // 道具契约（关键道具/武器）
      props: [],
      // 情绪契约
      emotion: null,
      // 风格契约
      style: null,
      // 核心情节（起承转合）
      plotPoints: [],
      // 不可丢失的关键词（用户明确提到的）
      mustHaveKeywords: []
    };

    const text = this.rawOutline;
    
    // 1. 提取角色
    if (this.rawCharacters) {
      elements.characters = this.rawCharacters.split(',').map(c => {
        const parts = c.trim().split(':');
        return {
          name: parts[0]?.trim() || '',
          type: parts[1]?.trim() || '',
          features: parts[2]?.trim().split('+').map(f => f.trim()).filter(Boolean) || [],
          weapon: parts[3]?.trim() || ''
        };
      }).filter(c => c.name);
    }

    // 2. 从大纲中提取场景关键词
    const scenePatterns = [
      /([\u4e00-\u9fa5]{2,6})(?:山|谷|林|海|湖|河|城|宫|殿|塔|洞|崖|原|野|空|庭|院|阁|楼)/g,
      /在([\u4e00-\u9fa5]{2,6})(?:上|中|里|内|外|下|前|后)/g
    ];
    // 场景名排除词（避免误提取动词/连词作为场景）
    for (const pattern of scenePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const sceneName = match[1];
        // 排除过短的词和角色名
        if (sceneName.length >= 2 && 
            !elements.characters.some(c => c.name.includes(sceneName)) &&
            !SCENE_EXCLUDE_WORDS.includes(sceneName)) {
          if (!elements.scenes.includes(sceneName)) {
            elements.scenes.push(sceneName);
          }
        }
      }
    }

    // 3. 提取动作关键词（v5.5-Peng-CinePrompt: 中英双语支持）
    for (const keyword of ACTION_KEYWORDS) {
      if (text.includes(keyword)) {
        elements.actions.push(keyword);
      }
    }

    // 4. 提取道具/武器
    // 优先从角色定义的weapon字段提取
    for (const char of elements.characters) {
      if (char.weapon && char.weapon.trim()) {
        const weapons = char.weapon.split('+').map(w => w.trim()).filter(Boolean);
        for (const weapon of weapons) {
          if (!elements.props.includes(weapon)) {
            elements.props.push(weapon);
          }
        }
      }
    }
    
    // 从文本中补充提取（排除已知的角色名+武器组合）
    const propPatterns = [
      /(?:[手持挥舞横扫刺穿击碎]{1,2})([\u4e00-\u9fa5]{1,4}(?:棒|刀|剑|枪|戟|叉|鞭|锤|斧|弓|箭|盾))/g,
      /([\u4e00-\u9fa5]{1,4}(?:棒|刀|剑|枪|戟|叉|鞭|锤|斧|弓|箭|盾|甲|袍|衣|冠|盔))/g,
      /([\u4e00-\u9fa5]{1,4}(?:火|水|风|雷|电|光|影|雾|云|气|波))/g
    ];
    for (const pattern of propPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const prop = match[1];
        // 如果道具名包含角色名，只保留纯道具名（如"悟空金箍棒"→"金箍棒"）
        let cleanedProp = prop;
        for (const char of elements.characters) {
          if (prop.includes(char.name) || prop.includes(char.name.slice(-2))) {
            cleanedProp = prop.replace(char.name, '').replace(char.name.slice(-2), '');
          }
        }
        cleanedProp = cleanedProp.trim();
        
        if (cleanedProp.length >= 2 && !elements.props.includes(cleanedProp)) {
          elements.props.push(cleanedProp);
        }
      }
    }

    // 5. 提取情绪
    const emotionKeywords = {
      '热血': 'epic', '暗黑': 'dark', '悬疑': 'suspense', '感人': 'emotional',
      '治愈': 'healing', '恐怖': 'horror', '史诗': 'epic', '悲壮': 'tragic',
      '激昂': 'epic', '紧张': 'tense', '温馨': 'warm', '震撼': 'shocking'
    };
    for (const [cn, en] of Object.entries(emotionKeywords)) {
      if (this.rawStyle?.includes(cn) || text.includes(cn)) {
        elements.emotion = cn;
        break;
      }
    }

    // 6. 提取起承转合（v5.5-Peng-CinePrompt: 支持中英文标记）
    const plotPatterns = [
      // 中文标记
      { regex: /([起])[：:]\s*([^；。]+)/, name: '起' },
      { regex: /([承])[：:]\s*([^；。]+)/, name: '承' },
      { regex: /([转])[：:]\s*([^；。]+)/, name: '转' },
      { regex: /([合])[：:]\s*([^；。]+)/, name: '合' },
      { regex: /(起幕)[：:]\s*([^；。]+)/, name: '起' },
      { regex: /(发展)[：:]\s*([^；。]+)/, name: '承' },
      { regex: /(转折)[：:]\s*([^；。]+)/, name: '转' },
      { regex: /(高潮)[：:]\s*([^；。]+)/, name: '高潮' },
      { regex: /(合幕)[：:]\s*([^；。]+)/, name: '合' },
      // 英文标记（CinePrompt V2）
      { regex: /(opening|establishment)[：:]\s*([^；。]+)/i, name: '起' },
      { regex: /(rising|development|escalating)[：:]\s*([^；。]+)/i, name: '承' },
      { regex: /(climax|intense|showdown)[：:]\s*([^；。]+)/i, name: '高潮' },
      { regex: /(resolution|ending|conclusion)[：:]\s*([^；。]+)/i, name: '合' }
    ];
    for (const { regex, name } of plotPatterns) {
      const match = text.match(regex);
      if (match) {
        elements.plotPoints.push({
          act: name,
          description: match[2].trim()
        });
      }
    }

    // 7. 提取must-have关键词（用户明确提到的专有名词）
    const words = text.split(/[，,、.。;；:!！?？\s]+/);
    for (const word of words) {
      const trimmed = word.trim();
      if (trimmed.length >= 2 && trimmed.length <= 6) {
        // 排除常见虚词
        const stopWords = ['一个', '这是', '那个', '然后', '接着', '最后', '最终', '开始', '进行', '展开'];
        if (!stopWords.includes(trimmed)) {
          elements.mustHaveKeywords.push(trimmed);
        }
      }
    }
    // 去重
    elements.mustHaveKeywords = [...new Set(elements.mustHaveKeywords)].slice(0, 20);

    return elements;
  }

  // 检查一个字符串是否包含契约元素
  checkAlignment(targetText, stage = 'unknown') {
    const results = {
      stage,
      overallScore: 100,
      characterMatch: { score: 100, missing: [] },
      actionMatch: { score: 100, missing: [] },
      propMatch: { score: 100, missing: [] },
      sceneMatch: { score: 100, missing: [] },
      plotMatch: { score: 100, missing: [] },
      keywordMatch: { score: 100, missing: [] },
      details: []
    };

    const text = targetText.toLowerCase();

    // 1. 角色匹配
    for (const char of this.elements.characters) {
      const charName = char.name.toLowerCase();
      const charFound = text.includes(charName);
      const weaponFound = char.weapon ? text.includes(char.weapon.toLowerCase()) : true;
      const featureFound = char.features.some(f => text.includes(f.toLowerCase()));
      
      if (!charFound && !weaponFound && !featureFound) {
        results.characterMatch.missing.push(char.name);
      }
    }
    if (this.elements.characters.length > 0) {
      const missingRate = results.characterMatch.missing.length / this.elements.characters.length;
      results.characterMatch.score = Math.max(0, 100 - missingRate * 100);
      if (missingRate > 0.3) {
        results.details.push({
          severity: 'error',
          item: '角色丢失',
          message: `丢失角色: ${results.characterMatch.missing.join(', ')}`
        });
      }
    }

    // 2. 动作匹配（v5.5-Peng-CinePrompt: 支持中英文动作关键词）
    const actionMap = {
      '大战': ['大战', 'battle'],
      '对决': ['对决', 'showdown', 'confrontation'],
      '激战': ['激战', 'intense battle'],
      '交锋': ['交锋', 'clash'],
      '碰撞': ['碰撞', 'collision', 'impact', 'crash'],
      '追逐': ['追逐', 'chase', 'pursuit'],
      '逃亡': ['逃亡', 'flee', 'escape'],
      '变身': ['变身', 'transform', 'morph'],
      '施展': ['施展', 'perform', 'execute', 'cast'],
      '祭出': ['祭出', 'summon', 'invoke'],
      '释放': ['释放', 'unleash', 'release'],
      '挥舞': ['挥舞', 'swing', 'wield'],
      '横扫': ['横扫', 'sweep'],
      '刺穿': ['刺穿', 'pierce', 'stab'],
      '击碎': ['击碎', 'shatter', 'smash'],
      '闪避': ['闪避', 'dodge', 'evade'],
      '腾空': ['腾空', 'leap', 'soar'],
      '飞跃': ['飞跃', 'fly', 'jump'],
      '坠落': ['坠落', 'fall', 'drop'],
      '撞击': ['撞击', 'crash', 'slam'],
      '炸裂': ['炸裂', 'explode', 'blast'],
      '爆发': ['爆发', 'erupt', 'burst'],
      '凝聚': ['凝聚', 'gather', 'condense'],
      '消散': ['消散', 'dissipate', 'fade']
    };
    for (const action of this.elements.actions) {
      const enList = actionMap[action] || [action];
      const found = enList.some(word => text.includes(word.toLowerCase()));
      if (!found) {
        results.actionMatch.missing.push(action);
      }
    }
    if (this.elements.actions.length > 0) {
      const missingRate = results.actionMatch.missing.length / this.elements.actions.length;
      results.actionMatch.score = Math.max(0, 100 - missingRate * 80);
      if (missingRate > 0.5) {
        results.details.push({
          severity: 'error',
          item: '动作丢失',
          message: `丢失关键动作: ${results.actionMatch.missing.join(', ')}`
        });
      }
    }

    // 3. 道具匹配
    for (const prop of this.elements.props) {
      if (!text.includes(prop.toLowerCase())) {
        results.propMatch.missing.push(prop);
      }
    }
    if (this.elements.props.length > 0) {
      const missingRate = results.propMatch.missing.length / this.elements.props.length;
      results.propMatch.score = Math.max(0, 100 - missingRate * 80);
    }

    // 4. 场景匹配
    for (const scene of this.elements.scenes) {
      if (!text.includes(scene.toLowerCase())) {
        results.sceneMatch.missing.push(scene);
      }
    }
    if (this.elements.scenes.length > 0) {
      const missingRate = results.sceneMatch.missing.length / this.elements.scenes.length;
      results.sceneMatch.score = Math.max(0, 100 - missingRate * 60);
    }

    // 5. 起承转合匹配（v5.5-Peng-CinePrompt: 支持中英文act名称）
    const actNameMap = {
      '起': ['起', 'opening', 'establishment'],
      '承': ['承', 'rising', 'development', 'escalating'],
      '转': ['转', 'turning', 'twist'],
      '合': ['合', 'resolution', 'ending', 'conclusion'],
      '高潮': ['高潮', 'climax', 'intense', 'showdown']
    };
    for (const plot of this.elements.plotPoints) {
      const plotText = plot.description.toLowerCase();
      const plotKeywords = plotText.split(/[，,、.。;；\s]+/).filter(w => w.length >= 2);
      const matched = plotKeywords.filter(kw => text.includes(kw));
      const matchRate = plotKeywords.length > 0 ? matched.length / plotKeywords.length : 1;
      // v5.5-Peng-CinePrompt: 中英文act名称都匹配
      const actNames = actNameMap[plot.act] || [plot.act];
      const actNameMatch = actNames.some(name => text.includes(name.toLowerCase()));
      const finalMatchRate = actNameMatch ? Math.max(matchRate, 0.5) : matchRate;
      if (finalMatchRate < 0.3) {
        results.plotMatch.missing.push(plot.act);
      }
    }
    if (this.elements.plotPoints.length > 0) {
      const missingRate = results.plotMatch.missing.length / this.elements.plotPoints.length;
      results.plotMatch.score = Math.max(0, 100 - missingRate * 100);
      if (missingRate > 0.25) {
        results.details.push({
          severity: 'error',
          item: '情节丢失',
          message: `丢失情节: ${results.plotMatch.missing.join(', ')}`
        });
      }
    }

    // 6. 关键词匹配
    let keywordHits = 0;
    for (const keyword of this.elements.mustHaveKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        keywordHits++;
      }
    }
    const keywordRate = this.elements.mustHaveKeywords.length > 0 ? 
      keywordHits / this.elements.mustHaveKeywords.length : 1;
    results.keywordMatch.score = Math.floor(keywordRate * 100);

    // 计算总分（加权）
    results.overallScore = Math.floor(
      results.characterMatch.score * 0.30 +
      results.actionMatch.score * 0.20 +
      results.propMatch.score * 0.15 +
      results.sceneMatch.score * 0.10 +
      results.plotMatch.score * 0.15 +
      results.keywordMatch.score * 0.10
    );

    // 判断是否通过闸机
    results.passed = results.overallScore >= 60 && 
                     results.characterMatch.score >= 40 &&
                     results.plotMatch.score >= 40;

    return results;
  }

  // 序列化契约
  toJSON() {
    return {
      rawOutline: this.rawOutline,
      elements: this.elements,
      summary: this._generateSummary()
    };
  }

  _generateSummary() {
    return {
      characters: this.elements.characters.map(c => c.name),
      actions: this.elements.actions,
      props: this.elements.props,
      scenes: this.elements.scenes,
      emotion: this.elements.emotion,
      plotPoints: this.elements.plotPoints.map(p => p.act),
      keywordCount: this.elements.mustHaveKeywords.length
    };
  }
}

// ============ 对齐闸机引擎 ============
class AlignmentGate {
  constructor(contract) {
    this.contract = contract;
    this.checkpoints = [];
  }

  // 在指定阶段检查对齐度
  check(stage, content, metadata = {}) {
    const result = this.contract.checkAlignment(content, stage);
    const checkpoint = {
      stage,
      timestamp: new Date().toISOString(),
      score: result.overallScore,
      passed: result.passed,
      details: result.details,
      metadata
    };
    this.checkpoints.push(checkpoint);
    return result;
  }

  // 生成对齐报告
  generateReport() {
    const allPassed = this.checkpoints.every(c => c.passed);
    const failed = this.checkpoints.filter(c => !c.passed);
    
    return {
      allPassed,
      totalCheckpoints: this.checkpoints.length,
      passedCount: this.checkpoints.filter(c => c.passed).length,
      failedCheckpoints: failed.map(c => ({ stage: c.stage, score: c.score, details: c.details })),
      checkpoints: this.checkpoints,
      recommendation: allPassed 
        ? '所有对齐检查通过，可以继续生产'
        : `有${failed.length}个阶段未通过对齐检查，建议修正后再生产`
    };
  }
}

// ============ CLI接口 ============
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'extract') {
    const outline = args[args.indexOf('--outline') + 1] || '';
    const characters = args[args.indexOf('--characters') + 1] || '';
    const style = args[args.indexOf('--style') + 1] || '';
    
    const contract = new RequirementContract(outline, characters, style);
    console.log(JSON.stringify(contract.toJSON(), null, 2));
    return;
  }

  if (command === 'check') {
    const contractFile = args[args.indexOf('--contract') + 1];
    const content = args[args.indexOf('--content') + 1] || '';
    const stage = args[args.indexOf('--stage') + 1] || 'unknown';
    
    if (!contractFile || !fss.existsSync(contractFile)) {
      console.error('错误: 需要 --contract 参数指向有效的契约文件');
      process.exit(1);
    }
    
    const contractData = JSON.parse(fss.readFileSync(contractFile, 'utf8'));
    const contract = new RequirementContract(
      contractData.rawOutline,
      '',
      ''
    );
    contract.elements = contractData.elements;
    
    const result = contract.checkAlignment(content, stage);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`
用法:
  node requirement-alignment-gate.js extract --outline "大纲" --characters "角色定义" --style "风格"
  node requirement-alignment-gate.js check --contract <file> --content "要检查的文本" --stage <stage>
`);
}

module.exports = { RequirementContract, AlignmentGate };

if (require.main === module) {
  main();
}