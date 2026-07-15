#!/usr/bin/env node
/**
 * Evolution Tracker v1.0-Peng — Agent 4: 进化追踪者
 * 
 * 追踪角色在整个系列中的成长轨迹
 */

class EvolutionTracker {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async track({ characterId, woundProfile, gravityMap, totalEpisodes, structureOutline }) {
    console.log(`  📈 [EvolutionTracker] 设计 ${characterId} 的 ${totalEpisodes}集成长轨迹...`);
    
    const wound = woundProfile?.wound || {};
    const structure = wound.structure || {};
    const existential = wound.existential || {};
    
    // 定义起点状态
    const startingState = this.defineStartingState(wound, structure, totalEpisodes);
    
    // 定义终点状态（基于存在性伤口的救赎之门）
    const endingState = this.defineEndingState(wound, structure, existential, totalEpisodes);
    
    // 基于结构大纲定义关键转折点
    const keyTurningPoints = this.defineTurningPoints(wound, structure, totalEpisodes, structureOutline);
    
    // 生成每集状态快照
    const episodeSnapshots = this.generateSnapshots(startingState, endingState, keyTurningPoints, totalEpisodes);
    
    // 定义一致性基线
    const consistencyBaseline = this.defineConsistencyBaseline(structure);
    
    return {
      characterId,
      evolutionTrack: {
        startingState,
        endingState,
        keyTurningPoints,
        episodeSnapshots,
        consistencyBaseline
      }
    };
  }

  defineStartingState(wound, structure, totalEpisodes) {
    const behavioralPattern = structure.behavioralPattern || '';
    const coreLie = structure.coreLie || '';
    
    let belief = '';
    let behavior = '';
    let emotionalState = '';
    
    if (coreLie.includes('强大')) {
      belief = '强者不需要遵守规则';
      behavior = '无法无天，不服管束';
      emotionalState = '愤怒、叛逆、不信任任何人';
    } else if (coreLie.includes('信任')) {
      belief = '没有人真正值得信任';
      behavior = '保持距离，不依赖任何人';
      emotionalState = '警惕、孤独、表面冷漠';
    } else if (coreLie.includes('抛弃')) {
      belief = '我不值得被爱，必须拼命留住';
      behavior = '过度付出，害怕冲突';
      emotionalState = '焦虑、讨好、没有安全感';
    } else if (coreLie.includes('价值')) {
      belief = '我的价值取决于我做了什么';
      behavior = '拼命证明，不敢休息';
      emotionalState = '紧张、成就驱动、内心空虚';
    } else {
      belief = '世界是不安全的，必须时刻保持警惕';
      behavior = '根据角色类型选择：战斗/逃避/讨好/冻结';
      emotionalState = '紧张、防御、随时准备应对威胁';
    }
    
    return {
      episode: 'E01',
      belief,
      behavior,
      emotionalState,
      relationshipState: {} // 会在后续填充
    };
  }

  defineEndingState(wound, structure, existential, totalEpisodes) {
    const redemptionDoor = existential.redemptionDoor || '';
    const coreNeed = structure.coreNeed || '';
    
    let belief = '';
    let behavior = '';
    let emotionalState = '';
    
    if (redemptionDoor.includes('脆弱') || redemptionDoor.includes('不完美')) {
      belief = '真正的力量包含脆弱，不完美也是完整的';
      behavior = '有力量但不滥用，敢于展示脆弱';
      emotionalState = '平静中带着力量，愤怒变成了坚定';
    } else if (redemptionDoor.includes('信任')) {
      belief = '信任是选择，不是结果——选择信任本身就是勇气';
      behavior = '谨慎但开放，给关系和机会一个可能性';
      emotionalState = '安宁、有边界的安全感、不再孤独';
    } else if (redemptionDoor.includes('价值')) {
      belief = '我的存在本身就有价值，不需要证明';
      behavior = '做事因为想做，不是为了证明自己';
      emotionalState = '满足、内在充实、享受过程';
    } else {
      belief = '接纳真实的自己，在不完美中找到完整';
      behavior = '有责任感但不失本性，主动约束自己';
      emotionalState = '平静、有方向感、接纳过去';
    }
    
    return {
      episode: `E${totalEpisodes}`,
      belief,
      behavior,
      emotionalState,
      relationshipState: {} // 会在后续填充
    };
  }

  defineTurningPoints(wound, structure, totalEpisodes, structureOutline) {
    const points = [];
    const coreLie = structure.coreLie || '';
    
    // 默认四幕结构转折点分布
    const quarter = Math.floor(totalEpisodes / 4);
    
    // 第一幕终点：第一个重大选择
    points.push({
      episode: `E${Math.floor(quarter * 0.5)}`,
      event: '首次为保护他人而自愿收敛',
      from: '完全自私',
      to: '开始有保护对象',
      cost: '压抑自己的天性',
      visibleChange: '打斗时刻意不伤及无辜'
    });
    
    // 第二幕中点：信任危机
    points.push({
      episode: `E${quarter}`,
      event: '信任崩塌——核心关系受到最大考验',
      from: '对他人有信任',
      to: '彻底封闭内心',
      cost: '确认了"没人真正懂我"的信念',
      visibleChange: '回到孤立状态，拒绝连接'
    });
    
    // 第三幕起点：身份危机
    points.push({
      episode: `E${quarter * 2}`,
      event: '身份危机——"我到底是谁？"',
      from: '知道自己是谁',
      to: '怀疑身份认同',
      cost: '身份认同的根基动摇',
      visibleChange: '第一次主动求助，不再独自扛'
    });
    
    // 第四幕高潮：最终抉择
    points.push({
      episode: `E${quarter * 3}`,
      event: '最终抉择——牺牲执念换取所爱之人的安全',
      from: '执念高于一切',
      to: '所爱之人的安全高于执念',
      cost: '放弃了长期坚守的信念',
      visibleChange: '主动接受约束，不再抗拒'
    });
    
    // 根据核心谎言调整
    if (coreLie.includes('强大')) {
      points[0].event = '首次为保护弱者而选择不战斗';
      points[0].visibleChange = '放下武器，用对话解决冲突';
      points[3].event = '最终抉择——接受自己的脆弱比战斗更需要勇气';
    } else if (coreLie.includes('信任')) {
      points[0].event = '首次选择相信一个人';
      points[0].visibleChange = '允许他人靠近，不再先推开';
    } else if (coreLie.includes('抛弃')) {
      points[0].event = '首次允许别人离开而不挽留';
      points[0].visibleChange = '尊重对方选择，不再控制';
    }
    
    return points;
  }

  generateSnapshots(startingState, endingState, turningPoints, totalEpisodes) {
    const snapshots = [];
    
    // 提取情绪维度
    const startEmotions = this.parseEmotionalState(startingState.emotionalState);
    const endEmotions = this.parseEmotionalState(endingState.emotionalState);
    
    // 为每集生成状态
    for (let ep = 1; ep <= totalEpisodes; ep++) {
      const progress = (ep - 1) / (totalEpisodes - 1); // 0 到 1
      
      // 检查是否是转折点
      const turningPoint = turningPoints.find(tp => {
        const tpEp = parseInt(tp.episode.replace('E', ''));
        return tpEp === ep;
      });
      
      // 计算当前情绪（线性插值 + 转折点扰动）
      let currentEmotions = {};
      Object.keys(startEmotions).forEach(key => {
        const startVal = startEmotions[key] || 0;
        const endVal = endEmotions[key] || 0;
        let val = startVal + (endVal - startVal) * progress;
        
        // 转折点附近增加波动
        if (turningPoint) {
          // 转折点前：情绪恶化
          // 转折点后：情绪改善
          val += (Math.random() - 0.5) * 20; // ±10 的随机波动
        }
        
        currentEmotions[key] = Math.round(Math.max(0, Math.min(100, val)));
      });
      
      // 活跃伤口
      const activeWound = this.getActiveWound(ep, turningPoints, totalEpisodes);
      
      snapshots.push({
        episode: `E${String(ep).padStart(2, '0')}`,
        emotionalState: this.formatEmotionalState(currentEmotions),
        activeWound,
        isTurningPoint: !!turningPoint,
        turningPointEvent: turningPoint?.event || null
      });
    }
    
    return snapshots;
  }

  parseEmotionalState(stateStr) {
    const emotions = {};
    const pairs = stateStr.split(/[,，\s]+/);
    pairs.forEach(pair => {
      const match = pair.match(/(\D+)(\d+)/);
      if (match) {
        emotions[match[1]] = parseInt(match[2]);
      }
    });
    
    // 默认值
    if (Object.keys(emotions).length === 0) {
      return { 愤怒: 50, 信任: 50, 自由: 50 };
    }
    return emotions;
  }

  formatEmotionalState(emotions) {
    return Object.entries(emotions)
      .map(([k, v]) => `${k}${v}`)
      .join(' ');
  }

  getActiveWound(episodeNum, turningPoints, totalEpisodes) {
    // 找到当前活跃的伤口
    const tp = turningPoints.find(tp => {
      const tpEp = parseInt(tp.episode.replace('E', ''));
      return Math.abs(tpEp - episodeNum) <= 2; // 转折点前后2集
    });
    
    if (tp) {
      return tp.event;
    }
    
    // 根据进度返回默认伤口
    const progress = episodeNum / totalEpisodes;
    if (progress < 0.25) return '表层创伤持续影响';
    if (progress < 0.5) return '结构性伤口被激活';
    if (progress < 0.75) return '存在性恐惧浮现';
    return '伤口愈合中';
  }

  defineConsistencyBaseline(structure) {
    const behavioralPattern = structure.behavioralPattern || '';
    const coreLie = structure.coreLie || '';
    
    const neverChanges = [];
    const evolves = [];
    
    // 分析哪些特征不会改变
    if (behavioralPattern.includes('愤怒')) {
      neverChanges.push('不服输的内核');
      evolves.push('愤怒的表达方式');
    }
    if (behavioralPattern.includes('保护')) {
      neverChanges.push('保护弱小的本能');
    }
    if (coreLie.includes('强大')) {
      neverChanges.push('自称"俺"'); // 语言指纹
      evolves.push('对规则的态度', '对弱者的态度');
    }
    if (coreLie.includes('信任')) {
      neverChanges.push('谨慎观察的习惯');
      evolves.push('信任的深度', '依赖的程度');
    }
    
    return {
      neverChanges: neverChanges.length > 0 ? neverChanges : ['核心价值观'],
      evolves: evolves.length > 0 ? evolves : ['行为方式', '关系模式'],
      changeMustHaveTrigger: true,
      maxChangePerEpisode: 0.15 // 每集最大变化幅度
    };
  }
}

module.exports = EvolutionTracker;