/**
 * RedundancyDetector v6.7.0
 * 冗余检测与去重模块
 * 负责：检测字段间重复描述，释放字符空间
 */

class RedundancyDetector {
  constructor(options = {}) {
    this.log = options.log || console.log;
    this.similarityThreshold = options.similarityThreshold || 0.7;
  }

  detect(prompt) {
    const redundancies = [];
    const blocks = this._extractBlocks(prompt);

    // 检测1: 模板字段间重复（如"约束"和"基础"对分辨率的重叠限定）
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const sim = this._similarity(blocks[i].text, blocks[j].text);
        if (sim > this.similarityThreshold) {
          redundancies.push({
            type: 'field_overlap',
            field1: blocks[i].tag,
            field2: blocks[j].tag,
            similarity: sim,
            suggestion: `保留${blocks[i].priority <= blocks[j].priority ? blocks[i].tag : blocks[j].tag}版本，删除另一字段的重复描述`
          });
        }
      }
    }

    // 检测2: 同字段内重复描述
    for (const block of blocks) {
      const phrases = block.text.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const seen = new Set();
      for (const phrase of phrases) {
        const lower = phrase.toLowerCase();
        if (seen.has(lower)) {
          redundancies.push({
            type: 'internal_duplicate',
            field: block.tag,
            phrase: phrase,
            suggestion: `删除同字段内重复描述: "${phrase}"`
          });
        }
        seen.add(lower);
      }
    }

    // 检测3: 环境描述重复（场景和灯光之间的光源重叠）
    const sceneBlock = blocks.find(b => b.tag === '场景');
    const lightBlock = blocks.find(b => b.tag === '灯光/照明');
    if (sceneBlock && lightBlock) {
      const lightKeywords = ['sunlight', 'moonlight', 'LED', 'tungsten', 'candlelight', 'fluorescent', '自然光', '日光', '月光'];
      for (const kw of lightKeywords) {
        if (sceneBlock.text.toLowerCase().includes(kw) && lightBlock.text.toLowerCase().includes(kw)) {
          redundancies.push({
            type: 'scene_lighting_overlap',
            field1: '场景',
            field2: '灯光/照明',
            keyword: kw,
            suggestion: '保留灯光字段的专业光照描述，简化场景字段环境光叙述'
          });
        }
      }
    }

    return redundancies;
  }

  remove(prompt, redundancies) {
    let result = prompt;
    let removedChars = 0;

    for (const r of redundancies) {
      if (r.type === 'internal_duplicate') {
        // 删除同字段内重复短语（保留第一次出现）
        const regex = new RegExp(`(${this._escapeRegex(r.phrase)})[,，]\\s*\\1`, 'gi');
        const before = result.length;
        result = result.replace(regex, '$1');
        removedChars += before - result.length;
      } else if (r.type === 'scene_lighting_overlap') {
        // 简化场景字段中的光源描述（保留灯光字段版本）
        const sceneRegex = new RegExp(`(【场景】[^【|]*)${this._escapeRegex(r.keyword)}[^,，]*[,，]?`, 'gi');
        const before = result.length;
        result = result.replace(sceneRegex, (match) => match.replace(new RegExp(`${this._escapeRegex(r.keyword)}[^,，]*[,，]?`, 'i'), ''));
        removedChars += before - result.length;
      }
    }

    // 清理多余的空格和分隔符
    result = result.replace(/\s{2,}/g, ' ').replace(/\|\s*\|/g, '|').trim();

    this.log('REDUNDANCY', `  🧹 冗余清理: 释放${removedChars}字符`);
    return { prompt: result, savedChars: removedChars };
  }

  _extractBlocks(prompt) {
    const blocks = [];
    const tags = [
      { tag: '导演指令', priority: 0 },
      { tag: '约束', priority: 0 },
      { tag: '基础', priority: 0 },
      { tag: '场景', priority: 0 },
      { tag: '灯光/照明', priority: 0 },
      { tag: '构图', priority: 1 },
      { tag: '色彩/色调', priority: 1 },
      { tag: '景深', priority: 1 },
      { tag: '运镜', priority: 0 },
      { tag: '角色', priority: 0 },
      { tag: '服装', priority: 2 },
      { tag: '化妆', priority: 3 },
      { tag: '动作', priority: 0 },
      { tag: '道具', priority: 2 },
      { tag: '定妆照', priority: 0 },
      { tag: '台词', priority: 0 },
      { tag: '时间轴', priority: 1 },
      { tag: '情绪', priority: 1 },
      { tag: '节奏', priority: 2 },
      { tag: '转场', priority: 3 },
      { tag: '音频', priority: 2 },
      { tag: '负面约束', priority: 0 },
      { tag: '明亮约束', priority: 1 },
      { tag: '角色约束', priority: 1 },
      { tag: '角色一致性', priority: 0 }
    ];

    for (const { tag, priority } of tags) {
      const regex = new RegExp(`【${tag}】([^【|]*)(?=[【|]|$)`, 'g');
      const matches = prompt.matchAll(regex);
      for (const m of matches) {
        blocks.push({ tag, text: m[1].trim(), priority });
      }
    }

    return blocks;
  }

  _similarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/[\s,，]/).filter(Boolean));
    const setB = new Set(b.toLowerCase().split(/[\s,，]/).filter(Boolean));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { RedundancyDetector };
