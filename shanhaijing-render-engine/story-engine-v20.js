/**
 * Story Engine v20.0-Peng — 叙事驱动镜头设计引擎
 * 
 * 核心升级：从"画面堆砌"到"叙事推进"
 * 原则：每镜必须推动故事前进，而非单纯展示画面
 * 
 * 叙事结构：
 * Act 1 铺垫 (Setting) → 建立人物、环境、目标
 * Act 2 冲突 (Confrontation) → 遇到问题、尝试解决
 * Act 3 高潮 (Climax) → 情感爆发、关键转折
 * Act 4 结局 (Resolution) → 问题解决、情感收束
 */

// ========== 故事节拍模板 ==========
const STORY_BEATS = {
  // 标准三幕结构 + 序章
  four_act: {
    act1_setup: {
      name: "铺垫",
      purpose: "建立人物状态、环境、目标",
      beats: [
        "人物登场：展示主角当前状态（疲惫/迷茫/坚定）",
        "环境建立：展示世界观/场景氛围",
        "目标暗示：主角看到/想到什么，驱动他行动",
        "开始行动：主角迈出第一步"
      ],
      duration_ratio: 0.25  // 占总时长25%
    },
    act2_confrontation: {
      name: "冲突",
      purpose: "遇到问题，尝试解决",
      beats: [
        "障碍出现：主角遇到第一个困难",
        "尝试解决：主角用自己的方式应对",
        "遇到更大的障碍：问题升级",
        "接近核心：主角越来越接近目标"
      ],
      duration_ratio: 0.30
    },
    act3_climax: {
      name: "高潮",
      purpose: "情感爆发，关键转折",
      beats: [
        "情感铺垫：主角的情绪积累到临界点",
        "关键行动：主角做出决定性的举动",
        "转折发生：世界/人物发生质变",
        "即时反应：主角对转折的第一反应"
      ],
      duration_ratio: 0.25
    },
    act4_resolution: {
      name: "结局",
      purpose: "问题解决，情感收束",
      beats: [
        "新状态展示：世界/人物的新面貌",
        "主角反应：主角对变化的回应",
        "情感升华：温暖的/感动的/希望的收尾",
        "余韵：留给观众的最后一个画面"
      ],
      duration_ratio: 0.20
    }
  }
};

// ========== 叙事约束检查器 ==========
class StoryValidator {
  /**
   * 检查镜头序列是否有叙事断裂
   */
  static validateShots(shots, storyName) {
    const issues = [];
    
    // 检查1：是否有无意义的纯画面镜头
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      if (!shot.narrativePurpose) {
        issues.push(`S${i+1}: 缺少叙事目的，仅为画面展示`);
      }
    }
    
    // 检查2：动作是否服务于情绪
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const action = shot.action || '';
      const emotion = shot.emotion || 'neutral';
      
      // 高兴时不能蜷缩
      if (emotion === 'joy' && action.includes('huddles')) {
        issues.push(`S${i+1}: 情绪与动作矛盾（高兴时蜷缩）`);
      }
      // 悲伤时不能大笑
      if (emotion === 'sad' && action.includes('laughing')) {
        issues.push(`S${i+1}: 情绪与动作矛盾（悲伤时大笑）`);
      }
      // 疲惫时不能冲刺
      if (emotion === 'exhausted' && action.includes('sprints')) {
        issues.push(`S${i+1}: 情绪与动作矛盾（疲惫时冲刺）`);
      }
    }
    
    // 检查3：是否有跳跃性的奇幻行为
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      // 用正则确保是独立单词匹配，避免"hair flying"误判为"fly"
      const fantasticalPatterns = [
        /\bfly\b(?!\s+(?:with|hair|leaf|flag|paper|bird|kite|dust|spark|ember|snow|rain|wind|cloud|smoke|feather|ribbon|scarf|cape|coat|dress|skirt|sleeve|pant|banner|curtain|silk|lock|strand|wave|curl|bang|braid|ponytail|bun|pigtail|dreadlock)\b)/,  // fly但不匹配hair flying with spin
        /\bturns?\s+into\s+light\b/,
        /\bbecomes?\s+(a\s+)?star\b/,
        /\bmelts?\s+into\b/,
        /\btransforms?\s+(his\s+|her\s+)?body\b/,
        /\bdisappears?\s+into\s+dust\b/,
        /\bgolden\s+dust\b/,
        /\btranslucent\s+body\b/,
        /\bethereal\s+form\b/,
        /\bdissolves?\s+into\b/,
        /\bbody\s+dissolves?\b/
      ];
      
      if (shot.characters && shot.characters.includes('xiaog')) {
        for (const pattern of fantasticalPatterns) {
          if (shot.action && pattern.test(shot.action.toLowerCase())) {
            issues.push(`S${i+1}: AgentX做了奇幻行为（${pattern.source}）`);
          }
        }
      }
    }
    
    // 检查4：是否有突然出现的无关元素
    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i-1];
      const curr = shots[i];
      
      // 人群突然出现
      if (curr.action && curr.action.includes('crowd') && 
          !(prev.action && prev.action.includes('crowd'))) {
        issues.push(`S${i+1}: 人群突然出场，无铺垫`);
      }
      
      // 新物品突然出现
      const newItems = ['scroll', 'crystal', 'amulet', 'talisman'];
      for (const item of newItems) {
        if (curr.action && curr.action.includes(item) && 
            !(prev.action && prev.action.includes(item))) {
          // 检查前面是否有铺垫
          let hasSetup = false;
          for (let j = 0; j < i; j++) {
            if (shots[j].action && shots[j].action.includes(item)) {
              hasSetup = true;
              break;
            }
          }
          if (!hasSetup) {
            issues.push(`S${i+1}: 物品"${item}"突然出现，前面无铺垫`);
          }
        }
      }
    }
    
    // 检查5：Act 3必须有质变
    const totalShots = shots.length;
    const act3Start = Math.floor(totalShots * 0.55);
    const act3End = Math.floor(totalShots * 0.80);
    let hasTransformation = false;
    
    for (let i = act3Start; i < act3End && i < totalShots; i++) {
      const action = shots[i].action || '';
      if (action.includes('opens') || action.includes('blazes') || 
          action.includes('transforms') || action.includes('awakens') ||
          action.includes('shatters') || action.includes('erupts')) {
        hasTransformation = true;
        break;
      }
    }
    
    if (!hasTransformation) {
      issues.push(`Act 3: 缺少质变/转折事件，高潮不够有力`);
    }
    
    return {
      storyName,
      totalShots,
      issues,
      passed: issues.length === 0,
      summary: issues.length === 0 
        ? `✅ ${storyName}: 叙事结构完整，${totalShots}镜通过验证`
        : `⚠️ ${storyName}: 发现${issues.length}个叙事问题`
    };
  }
}

// ========== 动作-情绪映射库 ==========
const ACTION_EMOTION_MAP = {
  // 疲惫/迷茫
  exhausted: ['trudges', 'huddles', 'shivers', 'slumps', 'sits', 'leans', 
            'catches breath', 'wipes sweat', 'looks around lost'],
  
  // 好奇/探索
  curious: ['peeks', 'tiptoes', 'points', 'tilts head', 'squints', 
           'leans closer', 'reaches tentatively', 'examines'],
  
  // 兴奋/激动
  excited: ['runs', 'rushes', 'dashes a few steps', 'jumps', 'waves', 
           'points excitedly', 'laughs', 'spins around'],
  
  // 敬畏/恐惧
  awe: ['freezes', 'mouth opens', 'steps back', 'looks up wide-eyed',
        'hands tremble', 'knees weak', 'stares in wonder'],
  
  // 悲伤/孤独
  sad: ['sits alone', 'hugs knees', 'looks down', 'wipes tears', 
        'hunches shoulders', 'sniffles', 'holds self'],
  
  // 温暖/感动
  warm: ['smiles softly', 'reaches gently', 'touches tenderly', 
         'looks with love', 'hugs', 'rests head', 'holds hands'],
  
  // 决心/勇气
  determined: ['stands up', 'clenches fist', 'sets jaw', 'takes deep breath',
              'marches forward', 'looks ahead firmly', 'nods firmly'],
  
  // 喜悦/幸福
  joy: ['laughs', 'spins', 'dances', 'jumps for joy', 'throws arms up',
        'smiles brightly', 'claps hands', 'hugs self']
};

/**
 * 根据情绪选择合适的动作
 */
function getActionForEmotion(emotion, intensity = 'medium') {
  const actions = ACTION_EMOTION_MAP[emotion] || ACTION_EMOTION_MAP.curious;
  
  // 根据强度选择
  if (intensity === 'low') {
    return actions[0] || actions[Math.floor(Math.random() * 3)];
  } else if (intensity === 'high') {
    return actions[actions.length - 1] || actions[Math.floor(Math.random() * actions.length)];
  }
  
  return actions[Math.floor(Math.random() * actions.length)];
}

// ========== 角色能力边界定义 ==========
const CHARACTER_CAPABILITIES = {
  xiaog: {
    name: 'AgentX',
    type: 'human_child',
    age: 8,
    canDo: [
      'walk', 'run short distances', 'climb', 'sit', 'stand', 'point',
      'touch', 'hold objects', 'speak', 'cry', 'laugh', 'hug',
      'look around', 'fall', 'get up', 'throw small objects'
    ],
    cannotDo: [
      'fly', 'turn into light', 'dissolve into dust', 'melt objects',
      'control magic', 'transform body', 'survive extreme conditions alone',
      'lift heavy objects', 'read ancient texts', 'communicate with gods'
    ],
    maxPhysical: {
      climbHeight: '50 meters with rest breaks',
      runDistance: '100 meters before tiring',
      coldTolerance: 'can endure but shows discomfort',
      heatTolerance: 'can endure but shows discomfort'
    }
  },
  
  zhulong: {
    name: '烛龙',
    type: 'beast',
    canDo: [
      'breathe warmth', 'open/close eyes', 'move head', 'growl',
      'shed scales', 'generate light', 'control temperature',
      'live for millennia', 'understand human emotion'
    ],
    cannotDo: [
      'speak human language', 'transform into human', 'leave mountain',
      'fully open both eyes at once (story constraint)'
    ]
  }
};

/**
 * 检查动作是否在角色能力范围内
 */
function validateCharacterAction(character, action) {
  const caps = CHARACTER_CAPABILITIES[character];
  if (!caps) return { valid: true }; // 未知角色不做限制
  
  const cannotDo = caps.cannotDo || [];
  for (const cannot of cannotDo) {
    if (action.toLowerCase().includes(cannot.toLowerCase())) {
      return {
        valid: false,
        issue: `${caps.name} (${caps.type}) 不能做: ${cannot}`,
        suggestion: `改为 ${caps.canDo[Math.floor(Math.random() * caps.canDo.length)]}`
      };
    }
  }
  
  return { valid: true };
}

// ========== 导出 ==========
module.exports = {
  STORY_BEATS,
  StoryValidator,
  ACTION_EMOTION_MAP,
  CHARACTER_CAPABILITIES,
  getActionForEmotion,
  validateCharacterAction
};
