/**
 * CrossFieldConsistencyChecker v6.7.0
 * 跨字段一致性检查模块
 * 负责：检测字段间逻辑冲突和一致性
 */

class CrossFieldConsistencyChecker {
  constructor(options = {}) {
    this.log = options.log || console.log;
  }

  check(prompt) {
    const issues = [];

    // 检查1: 导演指令与色彩/情绪一致性
    const directorMatch = prompt.match(/【导演指令】([^【|]*)/);
    const directorText = directorMatch ? directorMatch[1].trim() : '';
    const moodMatch = prompt.match(/【情绪】([^【|]*)/);
    const moodText = moodMatch ? moodMatch[1].trim() : '';
    const colorMatch = prompt.match(/【色彩\/色调】([^【|]*)/);
    const colorText = colorMatch ? colorMatch[1].trim() : '';

    // 导演指令说"tense"，但情绪是"relaxed" → 冲突
    if (/tense|suspense|紧张|悬疑/i.test(directorText) && /relaxed|calm|serene|放松|平静/i.test(moodText)) {
      issues.push({
        type: 'mood_conflict',
        severity: 'warning',
        fields: ['导演指令', '情绪'],
        description: '导演指令指定紧张基调，但情绪字段为放松/平静，存在冲突',
        suggestion: '统一情绪基调为紧张或悬疑类关键词'
      });
    }

    // 导演指令说"warm"，但色彩是冷色调 → 冲突
    if (/warm|温情|治愈|温馨/i.test(directorText) && /(teal|cyan|blue|cool|冷)/i.test(colorText)) {
      issues.push({
        type: 'color_mood_conflict',
        severity: 'warning',
        fields: ['导演指令', '色彩/色调'],
        description: '导演指令为温暖基调，但色彩字段为冷色调，存在冲突',
        suggestion: '将色彩调整为暖色调（amber/orange/golden）'
      });
    }

    // 检查2: 场景与灯光光源一致性
    const sceneMatch = prompt.match(/【场景】([^【|]*)/);
    const sceneText = sceneMatch ? sceneMatch[1].trim() : '';
    const lightMatch = prompt.match(/【灯光\/照明】([^【|]*)/);
    const lightText = lightMatch ? lightMatch[1].trim() : '';

    if (/night|evening|dark|nighttime|夜晚|夜间/i.test(sceneText) && /sunlight|daylight|sun|日光|阳光/i.test(lightText)) {
      issues.push({
        type: 'lighting_scene_conflict',
        severity: 'error',
        fields: ['场景', '灯光/照明'],
        description: '场景为夜晚/夜间，但灯光描述为日光/阳光，严重冲突',
        suggestion: '将灯光调整为夜景布光（月光/路灯/室内灯光）'
      });
    }

    // 检查3: 角色约束与角色描述一致性
    const charMatch = prompt.match(/【角色约束】([^【|]*)/);
    const charConstraint = charMatch ? charMatch[1].trim() : '';
    const charDescMatch = prompt.match(/【角色】([^【|]*)/);
    const charDesc = charDescMatch ? charDescMatch[1].trim() : '';

    if (charConstraint && charDesc) {
      const constraintName = charConstraint.match(/只出现(.+?)一人/);
      if (constraintName && !charDesc.includes(constraintName[1])) {
        issues.push({
          type: 'character_name_mismatch',
          severity: 'warning',
          fields: ['角色约束', '角色'],
          description: `角色约束指定"${constraintName[1]}"，但角色描述中未提及该名称`,
          suggestion: '确保角色约束中的角色名与角色描述一致'
        });
      }
    }

    // 检查4: 运镜速度与时长合理性
    const camMatch = prompt.match(/【运镜】([^【|]*)/);
    const camText = camMatch ? camMatch[1].trim() : '';
    const timeMatch = prompt.match(/【时间轴】([^【|]*)/);
    const timeText = timeMatch ? timeMatch[1].trim() : '';

    const duration = parseInt(timeText.match(/时长:(\d+)s/)?.[1] || '0');
    const speedMatch = camText.match(/(\d+\.?\d*)m\/s/);
    const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;

    if (duration > 0 && speed > 0) {
      const estimatedDistance = speed * duration;
      if (estimatedDistance > 20) {
        issues.push({
          type: 'camera_speed_unrealistic',
          severity: 'warning',
          fields: ['运镜', '时间轴'],
          description: `运镜速度${speed}m/s × 时长${duration}s = ${estimatedDistance.toFixed(1)}m，距离过长可能不现实`,
          suggestion: '考虑降低运镜速度或缩短镜头时长'
        });
      }
    }

    // 检查5: 台词长度与时长匹配 (v6.7.0-dialogue-patch: 支持【对话指令】和【台词】)
    const dialogueMatch = prompt.match(/【对话指令】([^【|]*)/) || prompt.match(/【台词】([^【|]*)/);
    const dialogueText = dialogueMatch ? dialogueMatch[1].trim() : '';
    if (dialogueText && duration > 0) {
      const charCount = dialogueText.length;
      const maxChars = duration * 3.5; // 基于中文语速约每分钟200-220字
      if (charCount > maxChars) {
        issues.push({
          type: 'dialogue_too_long',
          severity: 'error',
          fields: ['对话指令', '时间轴'],
          description: `对话指令${charCount}字 > 时长允许上限${Math.floor(maxChars)}字（${duration}s × 3.5），口型同步将不匹配`,
          suggestion: '缩短台词或延长镜头时长'
        });
      }
    }

    return issues;
  }

  severityLevel(issues) {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    if (errors.length > 0) return 'critical';
    if (warnings.length > 3) return 'high';
    if (warnings.length > 0) return 'medium';
    return 'low';
  }
}

module.exports = { CrossFieldConsistencyChecker };
