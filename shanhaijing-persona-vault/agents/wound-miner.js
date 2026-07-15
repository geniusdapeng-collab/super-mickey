#!/usr/bin/env node
/**
 * Wound Miner v1.0-Peng — Agent 1: 伤口矿工
 * 
 * 挖掘角色灵魂的三层伤口结构：表层/结构性/存在性
 * 以及呼吸特征（语言指纹）
 */

class WoundMiner {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async mine({ characterId, characterName, oneLiner, role, worldContext, themeAnchor }) {
    console.log(`  🔍 [WoundMiner] 挖掘 ${characterName} 的三层伤口...`);
    
    // Pass 1: 表层伤口 — 显性创伤事件
    const surfaceWound = this.mineSurfaceWound(characterName, oneLiner, worldContext);
    
    // Pass 2: 结构性伤口 — 行为模式塑造
    const structuralWound = this.mineStructuralWound(surfaceWound, role, worldContext);
    
    // Pass 3: 存在性伤口 — 身份核心追问
    const existentialWound = this.mineExistentialWound(surfaceWound, structuralWound, characterName, themeAnchor);
    
    // 呼吸特征：语言指纹
    const breathing = this.inferBreathingPattern(characterName, role, surfaceWound, structuralWound);
    
    return {
      characterId,
      characterName,
      wound: {
        surface: surfaceWound,
        structure: structuralWound,
        existential: existentialWound
      },
      breathing
    };
  }

  mineSurfaceWound(name, oneLiner, worldContext) {
    // 从一句话描述中提取关键创伤事件
    // 如果没有明确创伤，根据角色类型推断最可能的创伤
    
    const traumaKeywords = ['失去', '被', '死', '失败', '背叛', '抛弃', '误解', '压', '囚', '杀', '毁'];
    const hasExplicitTrauma = traumaKeywords.some(kw => oneLiner.includes(kw));
    
    if (hasExplicitTrauma) {
      // 提取描述中的创伤事件
      return {
        event: this.extractTraumaEvent(oneLiner),
        age: this.inferAge(oneLiner),
        immediateImpact: this.inferImmediateImpact(oneLiner)
      };
    }
    
    // 无显性创伤时，根据角色类型推断
    const inferredTrauma = this.inferTraumaByType(name, oneLiner);
    return {
      event: inferredTrauma.event,
      age: inferredTrauma.age,
      immediateImpact: inferredTrauma.impact
    };
  }

  extractTraumaEvent(oneLiner) {
    // 简单提取：找包含创伤关键词的句子片段
    const sentences = oneLiner.split(/[，。；]/);
    const traumaSentences = sentences.filter(s => 
      ['失去', '被', '死', '失败', '背叛', '抛弃', '误解', '压', '囚', '杀', '毁'].some(kw => s.includes(kw))
    );
    return traumaSentences[0] || oneLiner.slice(0, 80);
  }

  inferAge(oneLiner) {
    const ageMatch = oneLiner.match(/(\d+)/);
    if (ageMatch) {
      const num = parseInt(ageMatch[1]);
      if (num < 200) return num; // 可能是年龄
    }
    return '未知'; // 无法确定年龄
  }

  inferImmediateImpact(oneLiner) {
    if (oneLiner.includes('自由')) return '自由被剥夺，尊严受损';
    if (oneLiner.includes('信任')) return '信任崩塌，安全感丧失';
    if (oneLiner.includes('爱') || oneLiner.includes('亲情')) return '情感联结断裂，孤独感';
    if (oneLiner.includes('身份') || oneLiner.includes('认同')) return '身份认同危机，自我怀疑';
    if (oneLiner.includes('失去') || oneLiner.includes('死亡')) return '重要他人/事物丧失，存在性空虚';
    return '心理创伤，行为模式改变';
  }

  inferTraumaByType(name, oneLiner) {
    const lower = oneLiner.toLowerCase();
    
    if (lower.includes('王') || lower.includes('皇') || lower.includes('帝')) {
      return {
        event: '权力巅峰后的失落——失去一切后的落差',
        age: '成年',
        impact: '从掌控者变成被动者，控制感丧失'
      };
    }
    if (lower.includes('孤') || lower.includes('独') || lower.includes('弃')) {
      return {
        event: '被排斥/被抛弃的经历——从未真正被接纳',
        age: '幼年',
        impact: '归属需求未满足，永远寻找接纳'
      };
    }
    if (lower.includes('复仇') || lower.includes('恨')) {
      return {
        event: '被深深伤害后选择仇恨——正义未得到伸张',
        age: '青年',
        impact: '正义感扭曲为报复欲，信任彻底崩塌'
      };
    }
    
    // 默认推断
    return {
      event: '未明确表达的创伤——被压抑或遗忘的核心伤痛',
      age: '关键成长期',
      impact: '隐性影响，通过行为和选择间接表现'
    };
  }

  mineStructuralWound(surfaceWound, role, worldContext) {
    const event = surfaceWound.event || '';
    
    // 根据表层伤口推断行为模式
    let behavioralPattern = '';
    let copingMechanism = '';
    let coreLie = '';
    let coreNeed = '';
    
    if (event.includes('自由') || event.includes('压') || event.includes('囚')) {
      behavioralPattern = '对所有权威极度不信任，用叛逆和暴力作为防御机制';
      copingMechanism = '用愤怒掩盖脆弱，用战斗代替思考';
      coreLie = '只有足够强大，才不会被欺负';
      coreNeed = '被真正尊重，而不是被利用后抛弃';
    } else if (event.includes('信任') || event.includes('背叛') || event.includes('误解')) {
      behavioralPattern = '过度敏感于他人意图，用怀疑保护自己';
      copingMechanism = '先拒绝别人，避免被再次伤害';
      coreLie = '没有人真正值得信任';
      coreNeed = '被无条件接纳和理解';
    } else if (event.includes('失去') || event.includes('死') || event.includes('抛弃')) {
      behavioralPattern = '紧紧抓住现有关系，害怕再次被抛弃';
      copingMechanism = '过度付出以求不被离开';
      coreLie = '我不值得被爱，所以我必须拼命留住';
      coreNeed = '稳定的安全感和归属感';
    } else if (event.includes('身份') || event.includes('认同')) {
      behavioralPattern = '不断证明自己，通过成就确认自我价值';
      copingMechanism = '用成功填补内心空洞';
      coreLie = '我的价值取决于我做了什么，而不是我是谁';
      coreNeed = '被认可为独特的、有价值的个体';
    } else {
      behavioralPattern = '用自我保护机制应对世界，行为模式固着于创伤时期';
      copingMechanism = '根据角色类型选择：战斗/逃避/讨好/冻结';
      coreLie = '世界是不安全的，我必须时刻保持警惕';
      coreNeed = '安全感和控制感';
    }
    
    // 构建触发器地图
    const triggerMap = this.buildTriggerMap(surfaceWound, coreLie, coreNeed);
    
    return {
      behavioralPattern,
      triggerMap,
      copingMechanism,
      coreLie,
      coreNeed
    };
  }

  buildTriggerMap(surfaceWound, coreLie, coreNeed) {
    const event = surfaceWound.event || '';
    const triggers = {};
    
    // 根据核心伤口构建触发器
    if (coreLie.includes('强大')) {
      triggers['被轻视'] = '激活羞辱记忆 → 暴怒反击';
      triggers['被欺骗'] = '激活背叛记忆 → 过度反应';
      triggers['保护对象受威胁'] = '激活无力感 → 拼命守护';
    } else if (coreLie.includes('信任')) {
      triggers['被质疑'] = '激活被误解记忆 → 防御性解释或沉默';
      triggers['他人接近'] = '激活被背叛恐惧 → 先推开对方';
      triggers['需要依赖他人'] = '激活脆弱感 → 拒绝帮助';
    } else if (coreLie.includes('抛弃')) {
      triggers['关系疏远'] = '激活被抛弃恐惧 → 过度讨好或控制';
      triggers['被忽视'] = '激活不被需要感 → 制造存在感';
      triggers['离别场景'] = '激活失去创伤 → 情绪崩溃或冷漠';
    } else {
      triggers['权威压制'] = '激活无力记忆 → 反抗或服从';
      triggers['相似场景重现'] = '激活创伤记忆 → 战斗/逃跑/冻结';
      triggers['核心需求被触及'] = '激活深层渴望 → 情绪化反应';
    }
    
    return triggers;
  }

  mineExistentialWound(surfaceWound, structuralWound, name, themeAnchor) {
    const coreLie = structuralWound.coreLie || '';
    const coreNeed = structuralWound.coreNeed || '';
    
    // 追问：如果这道伤口不存在，这个角色还是他自己吗？
    let fundamentalFear = '';
    let identityCrisis = '';
    let redemptionDoor = '';
    
    if (coreLie.includes('强大')) {
      fundamentalFear = '自己的存在本身没有意义——如果不强大，我就什么都不是';
      identityCrisis = '我是谁？强大的我是真正的我，还是只是一个保护自己的壳？';
      redemptionDoor = '接受脆弱也是力量的一部分，在不完美的力量中找到真正的自由';
    } else if (coreLie.includes('信任')) {
      fundamentalFear = '独自面对世界的恐惧——如果没有可信任的人，存在的孤独如何承受？';
      identityCrisis = '我是那个拒绝信任的人，还是内心深处渴望被信任的人？';
      redemptionDoor = '选择信任一次，哪怕可能受伤——信任本身就是勇气的证明';
    } else if (coreLie.includes('抛弃')) {
      fundamentalFear = '不被需要的恐惧——如果没有人需要我，我的存在还有价值吗？';
      identityCrisis = '我是那个害怕被抛弃的人，还是那个值得被留下的人？';
      redemptionDoor = '认识到自己的价值不取决于他人是否留下';
    } else if (coreLie.includes('价值')) {
      fundamentalFear = '无价值的恐惧——如果不通过成就证明自己，我还有什么？';
      identityCrisis = '我是我的成就，还是成就背后的那个人？';
      redemptionDoor = '接纳自己的内在价值，不需要任何外在证明';
    } else {
      fundamentalFear = '存在性虚无——我的存在对这个世界有意义吗？';
      identityCrisis = '面具下的真实自我，是否有勇气被看见？';
      redemptionDoor = '接纳不完美的自己，在不完美中找到完整';
    }
    
    return {
      fundamentalFear,
      identityCrisis,
      redemptionDoor
    };
  }

  inferBreathingPattern(name, role, surfaceWound, structuralWound) {
    const event = surfaceWound.event || '';
    const pattern = structuralWound.behavioralPattern || '';
    
    let pace = '中等节奏';
    let volume = '正常音量';
    let silencePattern = '常规停顿';
    let sentenceSignature = '标准句式';
    
    if (pattern.includes('愤怒') || pattern.includes('叛逆') || pattern.includes('暴力')) {
      pace = '急促爆发式，像鞭炮';
      volume = '大，从不低语';
      silencePattern = '愤怒前兆——越危险越安静，安静到极点突然爆发';
      sentenceSignature = '短句为主，爱用反问，不耐烦时打断别人';
    } else if (pattern.includes('怀疑') || pattern.includes('敏感')) {
      pace = '谨慎缓慢，每个词都经过筛选';
      volume = '偏低，试探性';
      silencePattern = '被质疑时突然沉默，眼神游移';
      sentenceSignature = '问句多，爱用条件句（如果...那么...），自我保护性措辞';
    } else if (pattern.includes('讨好') || pattern.includes('付出')) {
      pace = '快速，生怕对方不耐烦';
      volume = '讨好时偏小，被忽视时突然变大';
      silencePattern = '害怕被抛弃时的过度解释';
      sentenceSignature = '承诺式语句多（"我会...""我保证..."），解释性语言过多';
    } else if (pattern.includes('证明') || pattern.includes('成就')) {
      pace = '自信流畅，偶尔加速（说到成就时）';
      volume = '偏大，展示性';
      silencePattern = '被质疑能力时的防御性沉默';
      sentenceSignature = '成就性语言，引用事实/数据，否定性自我陈述少';
    } else if (role === 'antagonist') {
      pace = '缓慢而精确，像蛇';
      volume = '控制性，忽大忽小制造压迫';
      silencePattern = '威胁前的不自然停顿';
      sentenceSignature = '反问和讽刺，操纵性语言，表面礼貌实则攻击';
    }
    
    return {
      pace,
      volume,
      silencePattern,
      sentenceSignature
    };
  }
}

module.exports = WoundMiner;