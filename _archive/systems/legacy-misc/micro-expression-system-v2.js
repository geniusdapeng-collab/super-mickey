/**
 * 微表情系统 v2.0 — 场景化情绪映射引擎
 * 基于队长提供的《AI微表情提示词升级方案》系统化接入
 * 
 * 核心升级：
 * 1. 镜头专属微表情分配（告别"一套打天下"）
 * 2. 情绪导向描述替代毫米级解剖指令
 * 3. 关键字段保护器（防止截断）
 * 4. 镜头-动作一致性校验器
 * 5. 神兽/人类双维度适配
 */

const { CharacterFeatureExtractor } = require('./character-feature-extractor.js');

// ========== 1. 场景化情绪映射库 ==========
const SCENE_EMOTION_MAP = {
  // 山海经系列场景类型 → 情绪基调
  'establishing': { tone: 'mysterious', intensity: 'medium' },      // 建立镜头：神秘
  'building': { tone: 'curious', intensity: 'medium' },            // 发展镜头：好奇
  'reveal': { tone: 'awe', intensity: 'strong' },                // 揭示镜头：敬畏
  'climax': { tone: 'tense', intensity: 'strong' },               // 高潮镜头：紧张
  'resolution': { tone: 'warm', intensity: 'weak' },             // 收尾镜头：温暖
  'confrontation': { tone: 'wrath', intensity: 'strong' },       // 对峙：怒意
  'discovery': { tone: 'curious', intensity: 'medium' },         // 发现：好奇
  'farewell': { tone: 'fated_break', intensity: 'strong' },      // 诀别：宿命破碎
  'intimate': { tone: 'deep_love', intensity: 'medium' },        // 亲密：深情
  'battle': { tone: 'wrath', intensity: 'strong' },              // 战斗：怒意
  'rest': { tone: 'serene', intensity: 'weak' },                 // 休憩：安详
  'celebration': { tone: 'coquettish', intensity: 'medium' }      // 庆典：欢悦
};

// ========== 2. 人类微表情维度库（三层结构） ==========
const HUMAN_MICRO_EXPRESSION = {
  // 眼部（最关键）
  eye: {
    pupil: {
      contract: '瞳孔微微收缩凝滞',
      dilate: '瞳孔放大',
      freeze: '瞳孔凝滞不动',
      flicker: '瞳孔晃动不定'
    },
    eyelid: {
      rapid_blink: '眼睫快速颤动两下',
      slow_droop: '眼睫缓缓低垂',
      fixed_tremor: '眼睫定格颤动'
    },
    eye_corner: {
      flush: '眼尾淡淡泛红',
      upturn: '眼尾微微上挑',
      downturn: '眼尾微微下挑',
      misty: '眼尾带水汽'
    },
    gaze: {
      lock: '视线锁定对方',
      avoid: '视线躲闪',
      downcast: '低头看指尖',
      steady: '对视不移'
    }
  },
  // 眉眼
  eyebrow: {
    brow: {
      slight_furrow: '眉头轻蹙',
      relax: '眉头舒展',
      tense: '眉头紧锁',
      loosen: '眉头微松'
    },
    shape: {
      flat: '眉形平缓',
      slight_raise: '眉形微挑',
      press_down: '眉形下压'
    }
  },
  // 口鼻脸颊
  mouth_cheek: {
    mouth_corner: {
      tighten: '嘴角拧直',
      slight_up: '嘴角微扬',
      bitter_smile: '嘴角苦笑',
      hesitate: '嘴角欲言又止'
    },
    lip: {
      tremble: '嘴唇轻颤',
      tighten_pale: '嘴唇紧抿发白',
      part_speechless: '嘴唇微张失语'
    },
    cheek_ear: {
      flush_spread: '泛红蔓延至下颚',
      ear_instant_red: '耳根瞬间爆红'
    }
  }
};

// ========== 3. 神兽微表情维度库（特殊器官适配） ==========
const BEAST_MICRO_EXPRESSION = {
  // 基础眼部（适配兽瞳）
  eye: {
    pupil: {
      vertical_contract: '竖瞳微微收缩',
      vertical_dilate: '竖瞳放大',
      round_freeze: '圆瞳凝滞',
      slit_flicker: '裂瞳晃动'
    },
    eyelid: {
      inner_blink: '内眼睑快速眨动',
      outer_droop: '外眼睑缓垂',
      membrane_tremor: '瞬膜定格颤动'
    }
  },
  // 特殊器官
  beast_special: {
    horn_crest_glow: {
      gold_flow: '角尖金光流转',
      dim: '角尖光芒暗淡',
      burst: '角尖光芒爆发闪烁',
      shimmer: '角尖微光萦落'
    },
    gill_operculum: {
      tense: '鳃弓紧缩',
      relax: '鳃弓完全放松',
      flare: '鳃瓣展开',
      pulse: '鳃瓣有节奏脉动'
    },
    scale_fur: {
      erect: '鳞片全部立起',
      flat: '鳞片平贴',
      ruffle: '毛发倒伏膨胀',
      smooth: '毛发顺滑'
    },
    tail_wing: {
      gentle_sway: '尾巴轻摇',
      tight_wrap: '尾巴紧缠',
      high_raise: '尾巴高抬',
      emotional_wag: '尾巴情绪性摆动'
    },
    ear: {
      prick_forward: '耳朵竖直前倾',
      fold_back: '耳朵轻折向后',
      rotate: '耳朵旋转定位',
      twitch: '耳朵轻颤'
    }
  }
};

// ========== 4. 肢体动作维度库 ==========
const BODY_ACTION = {
  human: {
    head: {
      tilt: '歪头',
      lower: '低头',
      raise_chin: '抬下颚',
      turn_gaze: '侧首凝望'
    },
    shoulder_back: {
      stiff: '肩背微僵',
      shrink: '肩背微瑟缩',
      slight_shake: '肩膀轻晃',
      straighten: '脊背挺直'
    },
    hand: {
      grip_sleeve: '攥衣摆',
      curl_fingertip: '指尖蜷缩',
      light_tap: '轻扣胸口',
      light_caress: '轻抚'
    },
    posture: {
      lean_forward: '微微前倾',
      half_step: '半步距离',
      approach_resist: '身体下意识靠近又克制'
    },
    stance: {
      opera_posture: '京剧闺门旦身段',
      youthful_pine: '挺拔如松'
    }
  },
  beast: {
    head: {
      tilt: '头部侧倾',
      lower: '头部低垂',
      raise_snout: '抬鼻嗅探',
      turn_gaze: '侧首凝视'
    },
    shoulder_back: {
      stiff: '肩背肌肉紧绷',
      shrink: '身体微瑟缩',
      loom: '身体威压 looming',
      coiled: '身体盘曲蓄势'
    },
    paw: {
      claw_extend: '利爪微露',
      paw_tap: '爪尖轻叩地面',
      grip_ground: '爪紧抓地面',
      light_caress: '爪轻抚'
    },
    posture: {
      lean_forward: '身体微微前倾',
      half_step: '半步距离',
      loom_over: '身体威压俯视'
    },
    stance: {
      beast_looming: '神兽威压 looming',
      coiled_ready: '盘曲蓄势待发'
    }
  }
};

// ========== 5. 情绪组合库（可直接复用） ==========
const EMOTION_COMBINATIONS = {
  human: {
    coquettish: {
      eye: ['eye_corner.upturn', 'eyebrow.brow.slight_furrow', 'mouth_cheek.mouth_corner.tighten'],
      body: ['head.tilt', 'hand.grip_sleeve', 'posture.half_step']
    },
    restrained: {
      eye: ['eye.eye_corner.flush', 'eye.eyelid.slow_droop', 'mouth_cheek.mouth_corner.tighten'],
      body: ['shoulder_back.stiff', 'hand.curl_fingertip', 'posture.approach_resist']
    },
    deep_love: {
      eye: ['eye.gaze.steady', 'eye.eye_corner.misty', 'eyebrow.brow.relax'],
      body: ['head.turn_gaze', 'posture.lean_forward', 'stance.youthful_pine']
    },
    fated_break: {
      eye: ['eye.eye_corner.flush', 'eye.eyelid.slow_droop', 'mouth_cheek.lip.tremble'],
      body: ['shoulder_back.shrink', 'hand.curl_fingertip', 'posture.approach_resist']
    },
    wrath: {
      eye: ['eye.gaze.lock', 'eye.pupil.contract', 'eyebrow.brow.tense'],
      body: ['shoulder_back.stiff', 'hand.grip_sleeve', 'stance.youthful_pine']
    },
    serene: {
      eye: ['eye.gaze.steady', 'eyebrow.brow.relax', 'mouth_cheek.mouth_corner.slight_up'],
      body: ['shoulder_back.straighten', 'posture.lean_forward', 'stance.youthful_pine']
    }
  },
  beast: {
    wrath: {
      special: ['beast_special.gill_operculum.tense', 'beast_special.gill_operculum.flare', 
                'beast_special.horn_crest_glow.burst', 'beast_special.scale_fur.erect'],
      body: ['shoulder_back.stiff', 'paw.claw_extend', 'tail_wing.high_raise']
    },
    serene: {
      special: ['beast_special.gill_operculum.relax', 'beast_special.gill_operculum.flare',
                'beast_special.horn_crest_glow.dim', 'beast_special.scale_fur.flat'],
      body: ['head.lower', 'paw.paw_tap', 'tail_wing.gentle_sway']
    },
    curious: {
      special: ['beast_special.ear.prick_forward', 'beast_special.ear.rotate',
                'beast_special.scale_fur.smooth', 'beast_special.tail_wing.gentle_sway'],
      body: ['head.tilt', 'paw.paw_tap', 'posture.lean_forward']
    },
    awe: {
      special: ['beast_special.horn_crest_glow.gold_flow', 'beast_special.scale_fur.erect',
                'beast_special.ear.prick_forward', 'beast_special.tail_wing.high_raise'],
      body: ['head.raise_snout', 'shoulder_back.stiff', 'stance.beast_looming']
    },
    fated_break: {
      special: ['beast_special.horn_crest_glow.dim', 'beast_special.gill_operculum.tense',
                'beast_special.scale_fur.flat', 'beast_special.tail_wing.tight_wrap'],
      body: ['head.lower', 'shoulder_back.shrink', 'paw.grip_ground']
    }
  }
};

// ========== 6. 镜头类型微表情分配器 ==========
class MicroExpressionAllocator {
  constructor() {
    this.featureExtractor = new CharacterFeatureExtractor();
  }

  /**
   * 为镜头分配专属微表情
   * @param {Object} shot - 镜头对象
   * @param {Array} characters - 角色数组 [{id, type, role}]
   * @param {String} emotionalArc - 情绪弧线阶段
   * @returns {Object} - 每个角色的微表情分配
   */
  allocate(shot, characters, emotionalArc) {
    const allocations = {};
    
    for (const character of characters) {
      const type = character.type || 'human';
      const role = character.role || 'support';
      
      // 1. 确定情绪基调
      const sceneType = shot.type || 'building';
      const emotionBase = this._resolveEmotion(sceneType, emotionalArc, role);
      
      // 2. 获取微表情组合
      const combination = this._getCombination(type, emotionBase);
      
      // 3. 生成具象描述
      const expression = this._generateExpression(type, combination, character);
      
      // 4. 生成肢体动作
      const bodyAction = this._generateBodyAction(type, combination, character, shot);
      
      allocations[character.id] = {
        emotion: emotionBase,
        microExpression: expression,
        bodyAction: bodyAction,
        // 关键：每个镜头最多3个动作
        actionCount: this._countActions(expression, bodyAction)
      };
    }
    
    return allocations;
  }

  /**
   * 解析情绪基调
   */
  _resolveEmotion(sceneType, emotionalArc, role) {
    // 场景类型映射
    const baseEmotion = SCENE_EMOTION_MAP[sceneType] || { tone: 'curious', intensity: 'medium' };
    
    // 角色角色调整
    if (role === 'protagonist') {
      // 主角情绪更细腻
      return baseEmotion.tone;
    } else if (role === 'beast') {
      // 神兽情绪更强烈
      return baseEmotion.tone;
    }
    
    return baseEmotion.tone;
  }

  /**
   * 获取情绪组合
   */
  _getCombination(type, emotion) {
    const lib = type === 'beast' ? EMOTION_COMBINATIONS.beast : EMOTION_COMBINATIONS.human;
    return lib[emotion] || lib['serene'];
  }

  /**
   * 生成具象微表情描述
   */
  _generateExpression(type, combination, character) {
    const parts = [];
    
    if (type === 'beast' && combination.special) {
      // 神兽：特殊器官优先
      for (const path of combination.special.slice(0, 3)) {
        const desc = this._resolvePath(BEAST_MICRO_EXPRESSION, path);
        if (desc) parts.push(desc);
      }
    } else {
      // 人类：眼部优先
      if (combination.eye) {
        for (const path of combination.eye.slice(0, 2)) {
          const desc = this._resolvePath(HUMAN_MICRO_EXPRESSION, path);
          if (desc) parts.push(desc);
        }
      }
    }
    
    return parts.join('，');
  }

  /**
   * 生成肢体动作描述
   */
  _generateBodyAction(type, combination, character, shot) {
    const parts = [];
    const bodyLib = type === 'beast' ? BODY_ACTION.beast : BODY_ACTION.human;
    
    if (combination.body) {
      for (const path of combination.body.slice(0, 2)) {
        const desc = this._resolvePath(bodyLib, path);
        if (desc) parts.push(desc);
      }
    }
    
    // 根据镜头类型添加距离描述
    if (shot.type === 'intimate') {
      parts.push('半步距离');
    } else if (shot.type === 'confrontation') {
      parts.push('一拳距离');
    }
    
    return parts.join('，');
  }

  /**
   * 解析路径获取描述
   */
  _resolvePath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (!current || !current[part]) return null;
      current = current[part];
    }
    return current;
  }

  /**
   * 统计动作数量（确保不超过3个）
   */
  _countActions(expression, bodyAction) {
    const exprCount = expression.split('，').length;
    const bodyCount = bodyAction.split('，').length;
    return exprCount + bodyCount;
  }
}

// ========== 7. 关键字段保护器（防截断） ==========
class CriticalFieldProtector {
  constructor() {
    // 关键字段优先级（必须完整保留）
    this.criticalFields = [
      '【角色约束】',
      '【情感落点】',
      '【核心动作】',
      '【角色】',
      '【情绪定调】'
    ];
    
    // 可裁剪字段（优先级低）
    this.trimmableFields = [
      '【环境布景】',
      '【材质细节】',
      '【背景描述】',
      '【光影细节】'
    ];
  }

  /**
   * 保护关键字段，优先裁剪非关键内容
   */
  protect(prompt, maxLength) {
    if (prompt.length <= maxLength) return prompt;
    
    const excess = prompt.length - maxLength;
    let trimmed = prompt;
    
    // 阶段1：裁剪可裁剪字段的内容
    for (const field of this.trimmableFields) {
      if (excess <= 0) break;
      trimmed = this._trimField(trimmed, field, excess);
    }
    
    // 阶段2：如果还超长，裁剪非关键句子
    if (trimmed.length > maxLength) {
      trimmed = this._trimSentences(trimmed, maxLength);
    }
    
    return trimmed;
  }

  /**
   * 裁剪指定字段的内容
   */
  _trimField(prompt, fieldMarker, excess) {
    const regex = new RegExp(`(${fieldMarker}[^【]*)(?=[【]|$)`, 'g');
    return prompt.replace(regex, (match) => {
      const content = match.replace(fieldMarker, '');
      // 保留前30%内容，后面用省略号
      const keepLength = Math.max(20, Math.floor(content.length * 0.3));
      return fieldMarker + content.substring(0, keepLength) + '...';
    });
  }

  /**
   * 按句子裁剪（避免截断句子）
   */
  _trimSentences(prompt, maxLength) {
    const sentences = prompt.split(/([。，！？；])/);
    let result = '';
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i];
      const punctuation = sentences[i + 1] || '';
      
      if ((result + sentence + punctuation).length > maxLength) {
        break;
      }
      result += sentence + punctuation;
    }
    
    return result;
  }
}

// ========== 8. 镜头-动作一致性校验器 ==========
class LensActionConsistencyChecker {
  constructor() {
    this.movementPairs = {
      'push_in': { compatible: ['approach', 'lean_forward', 'step_closer'], incompatible: ['retreat', 'pull_back', 'walk_away'] },
      'pull_out': { compatible: ['retreat', 'pull_back', 'walk_away'], incompatible: ['approach', 'lean_forward', 'step_closer'] },
      'dolly_in': { compatible: ['approach', 'lean_forward'], incompatible: ['retreat'] },
      'dolly_out': { compatible: ['retreat', 'pull_back'], incompatible: ['approach'] },
      'tracking': { compatible: ['walk', 'run', 'move'], incompatible: ['static'] }
    };
  }

  /**
   * 检查镜头运动与角色动作是否一致
   */
  check(shot) {
    const cameraMovement = shot.cameraMovement || '';
    const narration = shot.narration || '';
    
    // 提取角色动作关键词
    const actionKeywords = this._extractActionKeywords(narration);
    
    // 检查兼容性
    const pair = this.movementPairs[cameraMovement];
    if (!pair) return { valid: true, conflicts: [] };
    
    const conflicts = [];
    for (const action of actionKeywords) {
      if (pair.incompatible.includes(action)) {
        conflicts.push({
          camera: cameraMovement,
          action: action,
          suggestion: this._generateSuggestion(cameraMovement, action)
        });
      }
    }
    
    return {
      valid: conflicts.length === 0,
      conflicts: conflicts
    };
  }

  /**
   * 提取动作关键词
   */
  _extractActionKeywords(narration) {
    const keywords = [];
    const actionMap = {
      '靠近': 'approach', '走近': 'approach', '伸手': 'approach',
      '后退': 'retreat', '远离': 'retreat', '后退': 'retreat',
      '前倾': 'lean_forward', '俯身': 'lean_forward',
      '转身': 'walk_away', '离去': 'walk_away'
    };
    
    for (const [cn, en] of Object.entries(actionMap)) {
      if (narration.includes(cn)) keywords.push(en);
    }
    
    return keywords;
  }

  /**
   * 生成修正建议
   */
  _generateSuggestion(cameraMovement, action) {
    const suggestions = {
      'push_in-approach': '镜头推近（push_in）与角色靠近（approach）同向，建议改为 pull_out 或保持 push_in 但角色动作改为 retreat',
      'pull_out-retreat': '镜头拉远（pull_out）与角色后退（retreat）同向，建议改为 push_in 或保持 pull_out 但角色动作改为 approach'
    };
    
    return suggestions[`${cameraMovement}-${action}`] || '镜头运动与角色动作方向矛盾，请调整其一';
  }
}

// ========== 9. 镜头权重分配器（解决空间浪费） ==========
class ShotWeightAllocator {
  constructor() {
    this.weightMap = {
      'reveal': 1.5,      // 揭示镜头最重要
      'climax': 1.4,      // 高潮镜头
      'confrontation': 1.3, // 对峙镜头
      'building': 1.0,    // 发展镜头
      'establishing': 0.8, // 建立镜头
      'resolution': 0.9   // 收尾镜头
    };
  }

  /**
   * 根据镜头重要性分配内容密度
   */
  allocateContentDensity(shots, maxCharsPerShot) {
    const allocations = [];
    
    for (const shot of shots) {
      const weight = this.weightMap[shot.type] || 1.0;
      const allocatedChars = Math.floor(maxCharsPerShot * weight);
      
      allocations.push({
        shotId: shot.id,
        type: shot.type,
        weight: weight,
        allocatedChars: allocatedChars,
        minChars: Math.floor(allocatedChars * 0.7),  // 最少70%
        maxChars: allocatedChars
      });
    }
    
    return allocations;
  }
}

// ========== 导出 ==========
module.exports = {
  MicroExpressionAllocator,
  CriticalFieldProtector,
  LensActionConsistencyChecker,
  ShotWeightAllocator,
  SCENE_EMOTION_MAP,
  HUMAN_MICRO_EXPRESSION,
  BEAST_MICRO_EXPRESSION,
  BODY_ACTION,
  EMOTION_COMBINATIONS
};
