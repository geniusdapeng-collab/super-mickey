/**
 * Subtext Weaver v9.2.0-Peng — 潜台词编织者
 * 为每个对话场景铺设"水下内容"
 */
class SubtextWeaver {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async weave({ sceneId, sceneContext, characters, personaData }) {
    console.log(`  🌊 [SubtextWeaver] 铺设场景 ${sceneId} 的潜台词...`);

    const subtextMap = {};
    let lineIndex = 1;

    // 为每个角色在场景中的互动生成潜台词
    const charList = characters || Object.keys(personaData || {});
    
    for (let i = 0; i < charList.length; i++) {
      for (let j = i + 1; j < charList.length; j++) {
        const charA = charList[i];
        const charB = charList[j];
        
        const dataA = personaData[charA] || {};
        const dataB = personaData[charB] || {};
        
        const lines = this.generateSubtextLines(charA, charB, dataA, dataB, sceneContext);
        
        for (const line of lines) {
          subtextMap[`line_${String(lineIndex).padStart(2, '0')}`] = line;
          lineIndex++;
        }
      }
    }

    // 单角色场景生成独白潜台词
    if (charList.length === 1) {
      const soloChar = charList[0];
      const data = personaData[soloChar] || {};
      const wound = data.wound || {};
      
      subtextMap[`line_${String(lineIndex).padStart(2, '0')}`] = {
        speaker: soloChar,
        surface: `（${data.name || soloChar}独自思考着）`,
        underwater: `核心伤口被触动：${wound.surface || '未知'}。内心深处渴望：${wound.structure?.coreNeed || '被理解'}`,
        subtextType: 'soliloquy',
        whyThisWay: `${data.name || soloChar}独处时内心独白，暴露真实想法`
      };
      lineIndex++;
    }

    await this.stateBus.updateSubtext(sceneId, subtextMap);
    console.log(`    ✅ 潜台词铺设完成: ${Object.keys(subtextMap).length} 句`);
    return subtextMap;
  }

  generateSubtextLines(charA, charB, dataA, dataB, sceneContext) {
    const nameA = dataA.name || charA;
    const nameB = dataB.name || charB;
    const woundA = dataA.wound || {};
    const woundB = dataB.wound || {};
    const coreLieA = woundA.structure?.coreLie || '';
    const coreNeedA = woundA.structure?.coreNeed || '';
    const coreLieB = woundB.structure?.coreLie || '';
    const coreNeedB = woundB.structure?.coreNeed || '';

    const setting = sceneContext?.setting || '';
    const emotionalState = sceneContext?.emotionalState || {};
    const sceneGoal = sceneContext?.sceneGoal || '';

    // 基于场景冲突生成典型对话
    const lines = [];

    // 第一回合：质疑/防御
    lines.push({
      speaker: charA,
      surface: `${this.generateSurfaceLine(nameA, '质疑', nameB, setting)}`,
      underwater: `自我保护：${coreLieA}。真正需要：${coreNeedA}。`,
      subtextType: 'self-protection',
      whyThisWay: `${nameA}用质疑${nameB}来保护自己不面对"我错了"的痛苦`
    });

    // 第二回合：辩解/愤怒
    lines.push({
      speaker: charB,
      surface: `${this.generateSurfaceLine(nameB, '辩解', nameA, setting)}`,
      underwater: `${coreNeedB}被否定后的绝望反应。`,
      subtextType: 'pleading-under-anger',
      whyThisWay: `${nameB}从不说"求"，用愤怒包装乞求——暴露脆弱比死更可怕`
    });

    // 第三回合：决绝/关闭
    lines.push({
      speaker: charA,
      surface: `${this.generateSurfaceLine(nameA, '决绝', nameB, setting)}`,
      underwater: `再信你我就无法面对自己了。`,
      subtextType: 'false-certainty',
      whyThisWay: `${nameA}用"够了"来关闭对话——因为知道再多说一句就会动摇`
    });

    // 第四回合：放弃/沉默
    lines.push({
      speaker: charB,
      surface: `（沉默）......好。`,
      underwater: `我又被抛弃了。和所有人一样。我不想解释了。解释意味着还在乎。`,
      subtextType: 'shutdown',
      whyThisWay: `'好'是${nameB}最痛的字——意味着放弃了。放弃比战斗痛一百倍。`
    });

    return lines;
  }

  generateSurfaceLine(name, action, target, setting) {
    const templates = {
      '质疑': [
        `${name}，你又要${this.extractAction(setting)}吗？`,
        `你真的相信${target}吗？`,
        `${name}对此表示怀疑。`
      ],
      '辩解': [
        `${target}！你听我解释！`,
        `我说的都是真的！`,
        `你根本不了解${this.extractTopic(setting)}！`
      ],
      '决绝': [
        `够了。我已经给了你三次机会。`,
        `你走吧。`,
        `我再也不想听了。`
      ],
      '告别': [
        `师父保重。`,
        `......再见。`,
        `后会无期。`
      ]
    };
    
    const list = templates[action] || templates['质疑'];
    return list[Math.floor(Math.random() * list.length)];
  }

  extractAction(setting) {
    if (setting.includes('打死')) return '打死这个无辜的人';
    if (setting.includes('误解')) return '误解我';
    if (setting.includes('欺骗')) return '欺骗所有人';
    return '这样做';
  }

  extractTopic(setting) {
    if (setting.includes('妖怪')) return '妖怪';
    if (setting.includes('真相')) return '真相';
    return '这件事';
  }
}

module.exports = SubtextWeaver;