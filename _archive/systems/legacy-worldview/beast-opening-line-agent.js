/**
 * 【v6.2-patch54】神兽人声签名开场白Agent — BeastOpeningLineAgent
 *
 * 产品定位：专门撰写神兽第一句人声签名（开场白），一句话震撼人心
 * 核心方法论：钩子公式 = 身份颠覆 + 情绪冲突 + 悬念留白
 *
 * 通用性：服务所有山海经系列神兽，不硬编码任何单case内容
 * 挂载点：opening-system-v3.js 神兽人声签名生成环节
 */

class BeastOpeningLineAgent {
  constructor(config = {}) {
    this.config = {
      maxLength: 60,        // 开场白最大字数（中文）
      minImpactScore: 80,   // 冲击力最低分
      toneOptions: ['ominous', 'poetic', 'defiant', 'mournful', 'cosmic'],
      ...config
    };
  }

  /**
   * 主入口：为指定神兽生成震撼开场白
   *
   * @param {Object} beastProfile — 神兽档案
   * @param {Object} episodeContext — 本集剧情上下文
   * @returns {Object} { line, impactScore, tone, formula }
   */
  async generate(beastProfile, episodeContext = {}) {
    const beastName = beastProfile?.name || beastProfile?.beastName || '神兽';
    const beastTrait = beastProfile?.coreTrait || beastProfile?.uniqueAbility || '未知能力';
    const habitat = beastProfile?.habitat || 'Nirath';
    const theme = episodeContext?.theme || '未知主题';
    const reversal = episodeContext?.reversal || '';

    // 分析神兽类型，选择最佳钩子公式
    const formula = this.selectFormula(beastProfile, episodeContext);

    // 基于公式生成候选台词
    const candidates = this.generateCandidates(formula, beastName, beastTrait, habitat, theme, reversal);

    // 评分排序
    const scored = candidates.map(line => ({
      line,
      ...this.score(line, beastProfile)
    })).sort((a, b) => b.impactScore - a.impactScore);

    const winner = scored[0];

    return {
      line: winner.line,
      impactScore: winner.impactScore,
      tone: winner.tone,
      formula: formula.name,
      alternatives: scored.slice(1, 4).map(s => s.line), // 返回3个备选
      reasoning: winner.reasoning
    };
  }

  /**
   * 钩子公式选择器
   * 根据神兽特征和本集主题，选择最佳叙事钩子公式
   */
  selectFormula(beastProfile, episodeContext) {
    const beastName = beastProfile?.name || '';
    const trait = beastProfile?.coreTrait || '';
    const theme = episodeContext?.theme || '';
    const reversal = episodeContext?.reversal || '';

    // 关键词匹配
    const hasReversal = reversal && reversal.length > 0;
    const isDefender = trait.includes('守护') || trait.includes('保护') || theme.includes('守护');
    const isTragic = trait.includes('遗忘') || trait.includes('孤独') || trait.includes('误解');
    const isPowerful = trait.includes('吞噬') || trait.includes('毁灭') || trait.includes('力量');
    const isAncient = beastProfile?.age?.includes('亿') || beastProfile?.age?.includes('万年');

    // 公式优先级
    if (hasReversal && isDefender) {
      return {
        name: '反差颠覆',
        template: '{被误解的身份}……{真相的碎片}。{动作}。',
        example: '"他们叫我吞噬者。"……"但没人问过，我在守护什么。"'
      };
    }

    if (isTragic) {
      return {
        name: '孤独独白',
        template: '{时间长度}，{孤独状态}。{转折动作}。',
        example: '"三百年了，第一个不逃的。"'
      };
    }

    if (isPowerful && isAncient) {
      return {
        name: '古老威压',
        template: '{身份宣告}。{时间跨度}。{你不是第一个}。',
        example: '"我见过你的文明诞生。"……"也见过它遗忘我的名字。"'
      };
    }

    if (hasReversal) {
      return {
        name: '悬念钩子',
        template: '{表面认知}……{颠覆暗示}。{留白}。',
        example: '"你以为你看清了。"……"但你只看到了我想让你看到的。"'
      };
    }

    // 默认公式
    return {
      name: '存在宣告',
      template: '{名字不是重点}。{重点是我的存在本身}。{威胁/邀请}。',
      example: '"别记我的名字。"……"记住这个声音——当你再次听见时，跑。"'
    };
  }

  /**
   * 基于公式生成候选台词
   */
  generateCandidates(formula, beastName, beastTrait, habitat, theme, reversal) {
    const candidates = [];

    // 根据公式模板填充
    switch (formula.name) {
      case '反差颠覆':
        candidates.push(
          `他们叫我${this.getNickname(beastName, '负面')}。但没人问过……我在守护什么。`,
          `"${this.getNickname(beastName, '负面')}。"……${beastName}低笑。"多方便的标签。"`,
          `${beastName}开口时，${habitat}的磁场震颤了一下："你看见的……不是真的。"`,
          `"你以为的${beastName}……"声音从地底传来。"和真实的我，相差三千年。"`,
          `"所有传说都漏了一件事。"${beastName}的瞳孔收缩。"关于我，关于你，关于我们为什么相遇。"`
        );
        break;

      case '孤独独白':
        candidates.push(
          `"${this.getTimeSpan()}。"${beastName}说。"你是第一个${this.getFirstAction()}的。"`,
          `${beastName}没有眨眼："上一次有人对我笑……是${this.getTimeSpan()}前。"`,
          `"孤独久了，连恐惧都是礼物。"${beastName}的声音像风穿过峡谷。"谢谢你……没有跑。"`,
          `"${this.getTimeSpan()}。"${beastName}重复了一遍，像是在确认。"你……真的不害怕？"`,
          `${beastName}望着远方："我见过太多${this.getFirstAction()}的。你……不一样。"`
        );
        break;

      case '古老威压':
        candidates.push(
          `"我见过你的文明学会用火。"${beastName}说。"也见过它……学会遗忘。"`,
          `${beastName}的声音像地壳移动："在你之前，有${this.getNumber()}个。他们都有你的眼神。"`,
          `"不是每个时代……都有资格看见真实。"${beastName}的瞳孔暗红如熔岩。"你……准备好承受了吗？"`,
          `"${this.getTimeSpan()}前，有人说过和你一样的话。"${beastName}沉默了一秒。"他成了传说。"`,
          `"我比你们的第一个故事更老。"${beastName}低语。"也比你们的最后一个……更持久。"`
        );
        break;

      case '悬念钩子':
        candidates.push(
          `"你看清了吗？"${beastName}问。"因为……我还没决定让你看见什么。"`,
          `"每个故事都有两个版本。"${beastName}说。"你听到的……是较安全的那个。"`,
          `${beastName}的眼睛不眨："你站在这里……不是因为勇敢。是因为我还允许。"`,
          `"真相是……"${beastName}停顿。"比你想象的更近。也更危险。"`,
          `"你以为你来探索。"${beastName}的声音很轻。"但也许……是你被找到了。"`
        );
        break;

      default: // 存在宣告
        candidates.push(
          `"别记我的名字。"${beastName}说。"记住这个声音。当你再次听见时……${this.getWarningAction()}。"`,
          `"${beastName}不是称呼。"声音从四面八方涌来。"是警告。"`,
          `${beastName}开口时，空气变重了："你可以离开。趁我还能……控制自己。"`,
          `"我不是你的敌人。"${beastName}说。"但我也……从来不是你的朋友。"`,
          `"走进来的人里，${this.getNumber()}个活着出去了。"${beastName}微笑。"你想试试吗？"`
        );
    }

    return candidates;
  }

  /**
   * 台词冲击力评分
   */
  score(line, beastProfile) {
    let score = 50; // 基础分
    const reasoning = [];

    // 1. 悬念感（有留白/省略号/反问）
    if (line.includes('……') || line.includes('...') || line.includes('？')) {
      score += 15;
      reasoning.push('悬念留白+15');
    }

    // 2. 情绪冲突（表面vs真实）
    if (/但|却|然而|其实|真相/.test(line)) {
      score += 10;
      reasoning.push('情绪冲突+10');
    }

    // 3. 时间跨度（古老感）
    if (/年|世纪|纪元|万年|亿/.test(line)) {
      score += 10;
      reasoning.push('时间跨度+10');
    }

    // 4. 动作感（不是静态描述）
    if (/震颤|移动|收缩|微笑|低语|注视/.test(line)) {
      score += 10;
      reasoning.push('动作感+10');
    }

    // 5. 身份颠覆（挑战预期）
    if (/不是|不|但|真相|真实/.test(line)) {
      score += 10;
      reasoning.push('身份颠覆+10');
    }

    // 6. 长度适中（一句话震撼，不啰嗦）
    const charCount = line.replace(/[^\u4e00-\u9fff]/g, '').length;
    if (charCount >= 15 && charCount <= 40) {
      score += 10;
      reasoning.push('长度黄金+10');
    } else if (charCount > 40) {
      score -= 5;
      reasoning.push('略长-5');
    }

    // 7. 个性化（提到了神兽特征）
    const beastName = beastProfile?.name || '';
    if (line.includes(beastName)) {
      score += 5;
      reasoning.push('个性化+5');
    }

    // 判断tone
    let tone = 'ominous';
    if (/温柔|礼物|感谢|笑/.test(line)) tone = 'poetic';
    else if (/战|不屈|不逃|抵抗/.test(line)) tone = 'defiant';
    else if (/遗忘|孤独|消失|最后/.test(line)) tone = 'mournful';
    else if (/文明|纪元|星球|宇宙/.test(line)) tone = 'cosmic';

    return {
      impactScore: Math.min(score, 100),
      tone,
      reasoning: reasoning.join('，')
    };
  }

  // ===== 辅助方法 =====

  getNickname(beastName, type = '负面') {
    const negative = ['吞噬者', '毁灭者', '怪物', '恐惧本身', '不详之物', '被遗忘者'];
    const neutral = ['守护者', '古老者', '见证者', '守望者', '最后一只'];
    return type === '负面' ? negative[Math.floor(Math.random() * negative.length)] : neutral[Math.floor(Math.random() * neutral.length)];
  }

  getTimeSpan() {
    const spans = ['三百年', '一千年', '三千年', '一万年', '很久', '从第一个故事开始'];
    return spans[Math.floor(Math.random() * spans.length)];
  }

  getFirstAction() {
    const actions = ['不逃', '对我笑', '触碰我', '直视我', '听我说完', '相信'];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  getNumber() {
    const nums = ['三', '七', '十二', '一百', '无数', '零'];
    return nums[Math.floor(Math.random() * nums.length)];
  }

  getWarningAction() {
    const actions = ['跑', '祈祷', '记住', '不要回头', '叫我的名字', '闭上眼'];
    return actions[Math.floor(Math.random() * actions.length)];
  }
}

module.exports = { BeastOpeningLineAgent };

// 如果直接运行，测试饕餮开场白
if (require.main === module) {
  const agent = new BeastOpeningLineAgent();

  const taotieProfile = {
    name: '饕餮',
    beastName: 'tao-tie',
    coreTrait: '吞噬与守护的矛盾体——被误解为毁灭者，实则是唯一能看到"黑暗"的过滤器',
    uniqueAbility: '腋下双眼（暗红色竖瞳）能看见大气中的毒素黑暗',
    habitat: '钩吾山',
    age: '三亿年'
  };

  const episodeContext = {
    theme: '饕餮的唯一能看见"黑暗"的眼睛',
    reversal: '腋下双眼不是武器，是大气过滤器'
  };

  agent.generate(taotieProfile, episodeContext).then(result => {
    console.log('\n🏆 最佳开场白:');
    console.log(`"${result.line}"`);
    console.log(`\n📊 冲击力: ${result.impactScore}/100`);
    console.log(`🎭 情绪: ${result.tone}`);
    console.log(`📐 公式: ${result.formula}`);
    console.log(`\n💭 评分依据: ${result.reasoning}`);
    console.log('\n📝 备选:');
    result.alternatives.forEach((alt, i) => console.log(`  ${i + 1}. "${alt}"`));
  });
}
