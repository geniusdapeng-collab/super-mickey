#!/usr/bin/env node
/**
 * Empathy Engine v1.0-Peng — Agent 3: 共情引擎
 * 
 * 对反派角色执行"同情术"——让观众又爱又恨
 */

class EmpathyEngine {
  constructor(stateBus) {
    this.stateBus = stateBus;
  }

  async calculate({ characterId, characterName, woundProfile, storyFunction, themeAnchor }) {
    console.log(`  💔 [EmpathyEngine] 计算 ${characterName} 的共情矩阵...`);
    
    const wound = woundProfile?.wound || {};
    
    // 五步同情术
    const wantsWhatYouWant = this.analyzeWants(wound, characterName);
    const hurtLikeYouHurt = this.analyzeHurt(wound, characterName);
    const theMoment = this.findTheMoment(wound, storyFunction, characterName);
    const theTrap = this.analyzeTheTrap(wound, characterName);
    const theWarning = this.generateWarning(wound, themeAnchor, characterName);
    
    // 计算分数
    const sympathyScore = this.calculateSympathyScore(wantsWhatYouWant, hurtLikeYouHurt, theMoment);
    const repulsionScore = this.calculateRepulsionScore(wound, theTrap);
    const complexityScore = this.calculateComplexityScore(wantsWhatYouWant, theTrap, theWarning);
    
    return {
      characterId,
      characterName,
      empathyMatrix: {
        wantsWhatYouWant,
        hurtLikeYouHurt,
        theMoment,
        theTrap,
        sympathyScore,
        repulsionScore,
        complexityScore
      }
    };
  }

  analyzeWants(wound, characterName) {
    const coreNeed = wound.structure?.coreNeed || '';
    
    let desire = '';
    let audienceConnection = '';
    
    if (coreNeed.includes('尊重')) {
      desire = '被尊重——她做的一切都是为了证明自己的价值';
      audienceConnection = '每个人都渴望被尊重，尤其是在被轻视之后';
    } else if (coreNeed.includes('接纳')) {
      desire = '被接纳——她的恶行源于从未被真正接纳的痛苦';
      audienceConnection = '被排斥、被标签化的经历是普遍的，每个人都害怕被排除在外';
    } else if (coreNeed.includes('安全感')) {
      desire = '安全感——她的控制欲源于对失控的深层恐惧';
      audienceConnection = '对不确定性的恐惧是人类的共同体验';
    } else if (coreNeed.includes('爱') || coreNeed.includes('关怀')) {
      desire = '被爱——她的冷酷是未被满足的爱的需求的外壳';
      audienceConnection = '渴望被爱是人类最根本的需求之一';
    } else {
      desire = '被理解——她的行为背后有未被看见的正当理由';
      audienceConnection = '每个人都希望自己的行为能被理解而非简单评判';
    }
    
    return { desire, audienceConnection };
  }

  analyzeHurt(woundProfile, characterName) {
    const surfaceEvent = woundProfile.surface?.event || '';
    const existential = woundProfile.existential?.fundamentalFear || '';
    
    let woundDesc = surfaceEvent;
    let audienceConnection = '';
    
    if (surfaceEvent.includes('失去') || surfaceEvent.includes('抛弃')) {
      audienceConnection = '失去重要之人的痛苦是每个人生命中的必修课';
    } else if (surfaceEvent.includes('背叛') || surfaceEvent.includes('信任')) {
      audienceConnection = '被信任的人背叛是最深的痛之一，几乎每个人都经历过';
    } else if (surfaceEvent.includes('身份') || surfaceEvent.includes('认同')) {
      audienceConnection = '不知道自己是谁的迷茫，是成长中不可避免的阶段';
    } else {
      audienceConnection = '她受的伤，你也可能受过——只是你选择了不同的应对方式';
    }
    
    return { wound: woundDesc, audienceConnection };
  }

  findTheMoment(wound, storyFunction, characterName) {
    const fundamentalFear = wound.existential?.fundamentalFear || '';
    const coreNeed = wound.structure?.coreNeed || '';
    
    let scene = '';
    let effect = '';
    
    if (fundamentalFear.includes('意义')) {
      scene = `${characterName}在计划失败后的独白："我做的一切...到底是为了什么？"——那一刻她不是反派，是一个迷失的人`;
      effect = '观众突然意识到：她的恶行是存在性虚无的代偿';
    } else if (coreNeed.includes('接纳')) {
      scene = `${characterName}被击败时，没有诅咒主角，而是轻声说："你们至少还有彼此"——她的羡慕比她的恨更真实`;
      effect = '观众突然意识到：她只是个渴望归属的孤独者';
    } else if (fundamentalFear.includes('信任')) {
      scene = `${characterName}在最后一刻选择保护一个小孩——不是因为善良，而是那个孩子让她想起了曾经的自己`;
      effect = '观众突然意识到：她内心深处还有未完全泯灭的光';
    } else {
      scene = `${characterName}在无人时的脆弱时刻——卸下所有伪装，只是一个受过伤的人`;
      effect = '观众被迫面对：反派也是人，她的选择可能是我们的另一种可能';
    }
    
    return { scene, effect };
  }

  analyzeTheTrap(wound, characterName) {
    const surfaceEvent = wound.surface?.event || '';
    const behavioralPattern = wound.structure?.behavioralPattern || '';
    const copingMechanism = wound.structure?.copingMechanism || '';
    
    let descent = '';
    let warning = '';
    
    if (behavioralPattern.includes('愤怒') || behavioralPattern.includes('暴力')) {
      descent = `被伤害 → 愤怒保护自己 → 愤怒成为唯一工具 → 伤害他人 → 自己也成了施害者`;
      warning = `她走过的路，每个人在极端情况下都可能走——愤怒是双刃剑，保护自己也会割伤他人`;
    } else if (behavioralPattern.includes('怀疑') || copingMechanism.includes('拒绝')) {
      descent = `被背叛 → 不再信任 → 推开所有人 → 孤独 → 怨恨世界 → 主动伤害作为报复`;
      warning = `不信任是自我实现的预言——当你认为所有人都会背叛你，你最终会逼他们这么做`;
    } else if (behavioralPattern.includes('控制')) {
      descent = `失控的恐惧 → 试图控制一切 → 控制成瘾 → 为控制不惜一切 → 自己也成了囚徒`;
      warning = `控制的尽头是被控制——当你试图控制一切，你终将被自己的控制欲控制`;
    } else {
      descent = `创伤 → 错误的应对 → 短暂的缓解 → 更深的创伤 → 更极端的应对 → 恶性循环`;
      warning = `每个人心中都有成为她的种子——关键是在哪个时刻选择了不同的路`;
    }
    
    return { descent, warning };
  }

  generateWarning(wound, themeAnchor, characterName) {
    const fundamentalFear = wound.existential?.fundamentalFear || '';
    const coreLie = wound.structure?.coreLie || '';
    
    let warning = '';
    
    if (themeAnchor.includes('信任')) {
      warning = `${characterName}是对主角的警告——"如果你继续被误解和排斥，你也会变成我"`;
    } else if (themeAnchor.includes('自由') || themeAnchor.includes('约束')) {
      warning = `${characterName}是对主角的警告——"没有约束的自由就是毁灭"`;
    } else if (themeAnchor.includes('身份') || themeAnchor.includes('认同')) {
      warning = `${characterName}是对主角的警告——"如果你继续用外在成就定义自己，你也会迷失"`;
    } else {
      warning = `${characterName}不是例外，而是规则——"在相似的处境下，任何人都可能做出相似的选择"`;
    }
    
    return warning;
  }

  calculateSympathyScore(wants, hurt, moment) {
    let score = 50; // 基础分
    
    // 普遍性加分
    if (wants.audienceConnection.includes('普遍') || wants.audienceConnection.includes('每个人')) score += 10;
    if (hurt.audienceConnection.includes('每个人') || hurt.audienceConnection.includes('共同')) score += 10;
    
    // 情感深度加分
    if (moment.effect.includes('突然意识到') || moment.effect.includes('被迫面对')) score += 15;
    if (moment.scene.includes('独白') || moment.scene.includes('轻声')) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  calculateRepulsionScore(wound, theTrap) {
    let score = 50;
    
    const behavioralPattern = wound.structure?.behavioralPattern || '';
    
    // 行为模式越极端，反感度越高
    if (behavioralPattern.includes('暴力')) score += 20;
    if (behavioralPattern.includes('欺骗')) score += 15;
    if (behavioralPattern.includes('控制')) score += 10;
    
    // 道德边界
    if (theTrap.descent.includes('伤害')) score += 10;
    if (theTrap.descent.includes('报复')) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  calculateComplexityScore(wants, theTrap, theWarning) {
    let score = 60;
    
    // 动机复杂性
    if (wants.desire.includes('而不是')) score += 10;
    if (theTrap.descent.includes('而不是')) score += 10;
    
    // 主题映射
    if (theWarning.includes('警告')) score += 15;
    if (theWarning.includes('每个人') || theWarning.includes('任何人')) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }
}

module.exports = EmpathyEngine;