#!/usr/bin/env node
/**
 * Gravity Weaver v1.0-Peng — Agent 2: 引力编织者
 * 
 * 计算角色间的引力场：wound-overlap, force-direction, scene-impact
 */

class GravityWeaver {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async weave({ sourceCharacter, woundProfile, otherCharacters }) {
    console.log(`  🌐 [GravityWeaver] 计算 ${sourceCharacter} 的引力场...`);
    
    const gravityMap = {};
    const sourceWound = woundProfile?.wound || {};
    const sourceName = sourceCharacter.split('-')[1] || sourceCharacter;
    
    for (const targetId of otherCharacters) {
      const target = this.stateBus.getCharacter(targetId);
      if (!target) {
        gravityMap[targetId] = { error: '角色不存在' };
        continue;
      }
      
      const targetWound = target.wound || {};
      const targetName = target.name || targetId;
      
      // 1. 伤口重叠计算
      const woundOverlap = this.calculateWoundOverlap(sourceWound, targetWound, sourceName, targetName);
      
      // 2. 力方向计算
      const forceDirection = this.calculateForceDirection(sourceWound, targetWound, sourceName, targetName);
      
      // 3. 场景影响预测
      const sceneImpact = this.predictSceneImpact(woundOverlap, forceDirection, sourceName, targetName);
      
      // 4. 进化弧线
      const evolutionArc = this.inferEvolutionArc(sourceWound, targetWound, sourceName, targetName);
      
      // 5. 关键场景
      const keyScenes = this.identifyKeyScenes(sourceWound, targetWound, sourceName, targetName);
      
      gravityMap[targetId] = {
        relationship: this.inferRelationshipType(sourceWound, targetWound),
        woundOverlap,
        forceType: forceDirection,
        sceneImpact,
        evolutionArc,
        keyScenes
      };
    }
    
    return {
      sourceCharacter,
      gravityMap
    };
  }

  calculateWoundOverlap(sourceWound, targetWound, sourceName, targetName) {
    const sourceCoreNeed = sourceWound.structure?.coreNeed || '';
    const targetCoreNeed = targetWound.structure?.coreNeed || '';
    const sourceCoreLie = sourceWound.structure?.coreLie || '';
    const targetCoreLie = targetWound.structure?.coreLie || '';
    
    // 核心需求互补 → 强引力
    const needsMap = {
      '尊重': '认可',
      '接纳': '归属',
      '安全感': '稳定',
      '价值': '意义',
      '自由': '空间',
      '爱': '关怀'
    };
    
    let overlap = '';
    
    // 检查需求互补
    if (sourceCoreNeed && targetCoreNeed) {
      const sourceNeed = Object.keys(needsMap).find(k => sourceCoreNeed.includes(k));
      const targetNeed = Object.keys(needsMap).find(k => targetCoreNeed.includes(k));
      
      if (sourceNeed && targetNeed) {
        if (sourceNeed === targetNeed) {
          overlap = `${sourceName}和${targetName}有相同的核心需求（${sourceNeed}）——要么是盟友，要么是竞争者`;
        } else {
          overlap = `${sourceName}需要${sourceNeed}，${targetName}需要${targetNeed}——互补伤口可能形成依赖关系`;
        }
      }
    }
    
    // 检查伤口相似
    if (sourceWound.surface?.event && targetWound.surface?.event) {
      const sourceTrauma = this.extractTraumaTheme(sourceWound.surface.event);
      const targetTrauma = this.extractTraumaTheme(targetWound.surface.event);
      
      if (sourceTrauma === targetTrauma) {
        overlap += `；两人经历了相似的${sourceTrauma}创伤——同病相怜或同极相斥`;
      }
    }
    
    // 检查谎言对立
    if (sourceCoreLie.includes('强大') && targetCoreLie.includes('信任')) {
      overlap += `；${sourceName}相信"强大即安全"，${targetName}相信"无人可信"——一个向外求，一个向内缩`;
    } else if (sourceCoreLie.includes('抛弃') && targetCoreLie.includes('价值')) {
      overlap += `；${sourceName}害怕被抛弃，${targetName}害怕无价值——都是存在性恐惧的不同面向`;
    }
    
    return overlap || '伤口模式不同，关系张力来自差异而非共鸣';
  }

  extractTraumaTheme(event) {
    if (event.includes('自由') || event.includes('压') || event.includes('囚')) return '自由剥夺';
    if (event.includes('信任') || event.includes('背叛')) return '信任崩塌';
    if (event.includes('失去') || event.includes('死') || event.includes('抛弃')) return '丧失';
    if (event.includes('身份') || event.includes('认同')) return '身份危机';
    return '创伤';
  }

  calculateForceDirection(sourceWound, targetWound, sourceName, targetName) {
    const sourcePattern = sourceWound.structure?.behavioralPattern || '';
    const targetPattern = targetWound.structure?.behavioralPattern || '';
    
    // 分析行为模式的相互作用
    if (sourcePattern.includes('叛逆') && targetPattern.includes('约束')) {
      return '双向拉扯——一方推向混乱，一方拉向秩序';
    }
    if (sourcePattern.includes('战斗') && targetPattern.includes('逃避')) {
      return '单向推动——战斗者逼迫逃避者面对';
    }
    if (sourcePattern.includes('怀疑') && targetPattern.includes('信任')) {
      return '双向试探——怀疑者测试信任者，信任者试图打破怀疑';
    }
    if (sourcePattern.includes('讨好') && targetPattern.includes('冷漠')) {
      return '单向追逐——讨好者追逐冷漠者，冷漠者退避';
    }
    if (sourcePattern.includes('证明') && targetPattern.includes('证明')) {
      return '同极相斥——两个都需要证明自己的人互相竞争';
    }
    
    return '中性互动——关系动态取决于具体场景';
  }

  predictSceneImpact(woundOverlap, forceDirection, sourceName, targetName) {
    const fd = forceDirection.toLowerCase();
    
    if (fd.includes('拉扯')) {
      return `只要两人在场，场景必然有张力——要么冲突，要么和解。观众永远不知道下一秒是爆发还是温情`;
    }
    if (fd.includes('推动')) {
      return `一方逼迫另一方成长——场景通常以被推动者的突破或崩溃结束`;
    }
    if (fd.includes('试探')) {
      return `微妙的权力游戏——每个对话都是测试，观众享受解读潜台词的过程`;
    }
    if (fd.includes('追逐')) {
      return `情感不对等——一方的热情与另一方的冷淡形成喜剧或悲剧效果`;
    }
    if (fd.includes('相斥')) {
      return `竞争张力——两人争夺同一资源（关注/认可/地位），推动情节前进`;
    }
    
    return `关系对场景的影响取决于外部事件——两人在一起时是背景状态，需要外部触发激活`;
  }

  inferEvolutionArc(sourceWound, targetWound, sourceName, targetName) {
    const forceDirection = this.calculateForceDirection(sourceWound, targetWound, sourceName, targetName);
    
    if (forceDirection.includes('拉扯')) {
      return '对抗 → 磨合 → 理解 → 互补共存';
    }
    if (forceDirection.includes('推动')) {
      return '抗拒 → 被迫面对 → 突破 → 感恩（或怨恨）';
    }
    if (forceDirection.includes('试探')) {
      return '不信任 → 试探 → 证明 → 信任建立（或确认不信任）';
    }
    if (forceDirection.includes('追逐')) {
      return '追逐 → 疲惫 → 接受不对等 → 找到平衡或放手';
    }
    if (forceDirection.includes('相斥')) {
      return '竞争 → 认识到彼此价值 → 合作 → 共同成长（或一方胜出）';
    }
    
    return '平行 → 交叉 → 影响 → 改变（关系深度取决于互动频率）';
  }

  identifyKeyScenes(sourceWound, targetWound, sourceName, targetName) {
    const scenes = [];
    
    // 根据伤口特征推断关键场景
    if (sourceWound.structure?.triggerMap && targetWound.structure?.triggerMap) {
      // 找到双方触发器的交汇点
      const sourceTriggers = Object.keys(sourceWound.structure.triggerMap);
      const targetTriggers = Object.keys(targetWound.structure.triggerMap);
      
      // 冲突场景：触发器互相激活
      scenes.push(`${sourceName}触发${targetName}的核心创伤——信任危机场景`);
      
      // 和解场景：一方治愈另一方
      scenes.push(`${sourceName}的某个行为意外治愈了${targetName}的伤口——转折点`);
    }
    
    // 高潮场景：价值观直接冲突
    scenes.push(`${sourceName}和${targetName}的核心信念直接碰撞——必须做出选择`);
    
    return scenes;
  }

  inferRelationshipType(sourceWound, targetWound) {
    const sourcePattern = sourceWound.structure?.behavioralPattern || '';
    const targetPattern = targetWound.structure?.behavioralPattern || '';
    
    if (sourcePattern.includes('叛逆') && targetPattern.includes('约束')) return '约束与被约束';
    if (sourcePattern.includes('战斗') && targetPattern.includes('战斗')) return '竞争对手';
    if (sourcePattern.includes('怀疑') && targetPattern.includes('信任')) return '试探与接纳';
    if (sourcePattern.includes('讨好') && targetPattern.includes('冷漠')) return '追逐与回避';
    if (sourcePattern.includes('证明') && targetPattern.includes('证明')) return '镜像竞争';
    
    return '复杂关联';
  }
}

module.exports = GravityWeaver;