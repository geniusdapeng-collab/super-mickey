/**
 * FieldConsistencyChecker - 跨字段一致性校验模块
 * 负责: 校验25维字段之间的逻辑一致性
 * 核心规则: mood-lighting-camera_movement-color_palette 四维映射
 *           timeline-camera_movement-action 三维同步
 *           scene-lighting-bright_constraint 时序一致
 * v2.1.7: 新增模块，解决字段各自为政问题
 */

class FieldConsistencyChecker {
  constructor(options = {}) {
    this.strict = options.strict !== false; // 默认严格模式
    this.logLevel = options.logLevel || 'warn'; // warn|error|silent
  }

  /**
   * 主入口：校验单个镜头的25维字段一致性
   */
  check(shot) {
    const fields = shot.fields || shot;
    const issues = [];

    // 1. 情绪-灯光一致性
    issues.push(...this._checkMoodLighting(fields));
    // 2. 情绪-运镜一致性
    issues.push(...this._checkMoodCamera(fields));
    // 3. 情绪-色彩一致性
    issues.push(...this._checkMoodColor(fields));
    // 4. 时间轴-运镜同步
    issues.push(...this._checkTimelineCamera(fields));
    // 5. 时间轴-动作同步
    issues.push(...this._checkTimelineAction(fields));
    // 6. 场景-灯光-明亮约束时序一致
    issues.push(...this._checkSceneLightingBright(fields));
    // 7. 动作-运镜同步
    issues.push(...this._checkActionCamera(fields));
    // 8. 构图-运镜景别一致
    issues.push(...this._checkCompositionCamera(fields));
    // 9. 景深-景别一致
    issues.push(...this._checkDepthOfFieldComposition(fields));
    // 10. 节奏-运镜速度一致
    issues.push(...this._checkPacingCamera(fields));

    const result = {
      shotId: shot.shotId,
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues: issues,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      errorCount: issues.filter(i => i.severity === 'error').length
    };

    if (issues.length > 0 && this.logLevel !== 'silent') {
      const level = result.errorCount > 0 ? 'error' : 'warn';
      console[level](`[FieldConsistencyChecker] ${shot.shotId}: ${issues.length} issues (${result.errorCount} errors, ${result.warningCount} warnings)`);
      if (this.logLevel === 'warn' || this.logLevel === 'error') {
        issues.forEach(i => console[i.severity](`  ${i.severity}: ${i.fieldA} ↔ ${i.fieldB}: ${i.message}`));
      }
    }

    return result;
  }

  /**
   * 自动修复：根据校验结果自动修复字段
   */
  autoFix(shot) {
    const checkResult = this.check(shot);
    if (checkResult.valid && checkResult.warningCount === 0) return shot;

    const fields = { ...(shot.fields || shot) };
    let fixed = false;

    for (const issue of checkResult.issues) {
      if (issue.fixable) {
        const fix = issue.fix(fields);
        if (fix) {
          Object.assign(fields, fix);
          fixed = true;
          console.log(`[FieldConsistencyChecker] ${shot.shotId} 自动修复: ${issue.message}`);
        }
      }
    }

    return fixed ? { ...shot, fields } : shot;
  }

  // ==================== 校验规则 ====================

  /**
   * 1. 情绪-灯光一致性
   * 紧张→硬光/高对比, 温馨→柔光/低对比, 史诗→侧光/轮廓光
   */
  _checkMoodLighting(fields) {
    const issues = [];
    const mood = this._extractMood(fields.mood);
    const lighting = String(fields.lighting || '').toLowerCase();

    if (!mood || !lighting) return issues;

    const rules = {
      tense: {
        required: ['hard', 'harsh', 'high contrast', 'sharp', 'dramatic', 'chiaroscuro'],
        forbidden: ['soft', 'gentle', 'diffuse', 'warm', 'cozy', 'ambient'],
        message: '紧张情绪需要硬光/高对比，当前灯光偏柔和'
      },
      sad: {
        required: ['soft', 'diffuse', 'low key', 'shadow', 'dim', 'cool'],
        forbidden: ['bright', 'hard', 'harsh', 'high contrast', 'warm', 'sunny'],
        message: '悲伤情绪需要柔光/低对比/冷色，当前灯光偏明亮'
      },
      epic: {
        required: ['rim', 'backlight', 'silhouette', 'golden', 'dramatic', 'side'],
        forbidden: ['flat', 'even', 'front', 'soft', 'ambient'],
        message: '史诗情绪需要轮廓光/侧光/戏剧性，当前灯光偏平'
      },
      warm: {
        required: ['warm', 'soft', 'golden', 'diffuse', 'gentle'],
        forbidden: ['cold', 'harsh', 'hard', 'blue', 'clinical'],
        message: '温馨情绪需要暖色/柔光，当前灯光偏冷/硬'
      },
      calm: {
        required: ['soft', 'even', 'diffuse', 'ambient', 'natural'],
        forbidden: ['harsh', 'dramatic', 'high contrast', 'strobe', 'flicker'],
        message: '平静情绪需要均匀/柔光，当前灯光偏戏剧性'
      }
    };

    const rule = rules[mood];
    if (!rule) return issues;

    const hasRequired = rule.required.some(r => lighting.includes(r));
    const hasForbidden = rule.forbidden.some(f => lighting.includes(f));

    if (!hasRequired || hasForbidden) {
      issues.push({
        severity: 'warning',
        fieldA: 'mood',
        fieldB: 'lighting',
        message: `${rule.message} (mood: ${mood})`,
        fixable: true,
        fix: (f) => {
          // 自动修复：在lighting前添加合适的修饰词
          const fixes = {
            tense: 'hard directional lighting, high contrast, dramatic shadows',
            sad: 'soft diffused lighting, low key, cool tones, gentle shadows',
            epic: 'golden rim lighting, dramatic side light, strong backlight',
            warm: 'warm golden soft light, gentle diffused illumination',
            calm: 'soft even ambient lighting, natural diffused light'
          };
          return { lighting: `${fixes[mood]}; ${f.lighting}` };
        }
      });
    }

    return issues;
  }

  /**
   * 2. 情绪-运镜一致性
   * 紧张→handheld/fast, 平静→static/slow, 史诗→wide/slow_push
   */
  _checkMoodCamera(fields) {
    const issues = [];
    const mood = this._extractMood(fields.mood);
    const camera = String(fields.camera_movement || '').toLowerCase();

    if (!mood || !camera) return issues;

    const rules = {
      tense: {
        required: ['handheld', 'fast', 'shaky', 'quick', 'whip', 'snap'],
        forbidden: ['slow', 'static', 'stable', 'smooth', 'gentle', 'gradual'],
        message: '紧张情绪需要手持/快速运镜'
      },
      sad: {
        required: ['slow', 'static', 'smooth', 'drift', 'float'],
        forbidden: ['fast', 'quick', 'handheld', 'shaky', 'whip'],
        message: '悲伤情绪需要缓慢/稳定运镜'
      },
      epic: {
        required: ['wide', 'crane', 'drone', 'slow', 'sweep', 'grand'],
        forbidden: ['close', 'handheld', 'shaky', 'intimate'],
        message: '史诗情绪需要大景别/缓慢运镜'
      },
      warm: {
        required: ['slow', 'smooth', 'gentle', 'soft', 'drift'],
        forbidden: ['fast', 'hard', 'shaky', 'abrupt', 'snap'],
        message: '温馨情绪需要柔和/缓慢运镜'
      }
    };

    const rule = rules[mood];
    if (!rule) return issues;

    const hasRequired = rule.required.some(r => camera.includes(r));
    const hasForbidden = rule.forbidden.some(f => camera.includes(f));

    if (!hasRequired || hasForbidden) {
      issues.push({
        severity: 'warning',
        fieldA: 'mood',
        fieldB: 'camera_movement',
        message: `${rule.message} (mood: ${mood})`,
        fixable: true,
        fix: (f) => {
          const fixes = {
            tense: 'handheld camera, fast movement, shaky motion, quick pans',
            sad: 'slow static camera, gentle drift, smooth tracking',
            epic: 'wide crane shot, slow grand movement, sweeping aerial',
            warm: 'slow smooth camera, gentle drift, soft tracking'
          };
          return { camera_movement: `${fixes[mood]}; ${f.camera_movement}` };
        }
      });
    }

    return issues;
  }

  /**
   * 3. 情绪-色彩一致性
   * 紧张→冷色/高对比, 悲伤→低饱和/冷色, 史诗→金色/高饱和
   */
  _checkMoodColor(fields) {
    const issues = [];
    const mood = this._extractMood(fields.mood);
    const color = String(fields.color_palette || '').toLowerCase();

    if (!mood || !color) return issues;

    const rules = {
      tense: {
        required: ['cool', 'cold', 'blue', 'high contrast', 'saturated'],
        forbidden: ['warm', 'pastel', 'soft', 'gentle', 'low contrast'],
        message: '紧张情绪需要冷色/高对比/高饱和'
      },
      sad: {
        required: ['cool', 'desaturated', 'muted', 'blue', 'grey'],
        forbidden: ['warm', 'saturated', 'bright', 'vibrant', 'golden'],
        message: '悲伤情绪需要冷色/低饱和/灰暗'
      },
      epic: {
        required: ['golden', 'warm', 'saturated', 'rich', 'vibrant'],
        forbidden: ['pastel', 'muted', 'desaturated', 'cool', 'grey'],
        message: '史诗情绪需要金色/暖色/高饱和'
      },
      warm: {
        required: ['warm', 'golden', 'soft', 'orange', 'amber'],
        forbidden: ['cool', 'cold', 'blue', 'grey', 'clinical'],
        message: '温馨情绪需要暖色/金色/柔和'
      }
    };

    const rule = rules[mood];
    if (!rule) return issues;

    const hasRequired = rule.required.some(r => color.includes(r));
    const hasForbidden = rule.forbidden.some(f => color.includes(f));

    if (!hasRequired || hasForbidden) {
      issues.push({
        severity: 'warning',
        fieldA: 'mood',
        fieldB: 'color_palette',
        message: `${rule.message} (mood: ${mood})`,
        fixable: true,
        fix: (f) => {
          const fixes = {
            tense: 'cool blue tones, high contrast, saturated colors, sharp separation',
            sad: 'desaturated cool tones, muted grey-blue palette, low contrast',
            epic: 'golden warm tones, rich saturated colors, vibrant amber highlights',
            warm: 'warm golden tones, soft amber palette, gentle orange highlights'
          };
          return { color_palette: `${fixes[mood]}; ${f.color_palette}` };
        }
      });
    }

    return issues;
  }

  /**
   * 4. 时间轴-运镜同步
   * timeline的每个节拍必须有对应的camera_movement
   */
  _checkTimelineCamera(fields) {
    const issues = [];
    const timeline = String(fields.timeline || '');
    const camera = String(fields.camera_movement || '');

    if (!timeline || !camera) return issues;

    // 检查timeline是否包含高潮/爆发等强情绪节拍
    const highEnergyMarkers = ['高潮', '爆发', '碰撞', '冲击', '加速', '激烈', '释放'];
    const hasHighEnergy = highEnergyMarkers.some(m => timeline.includes(m));
    
    // 如果timeline有高潮，camera_movement必须有fast/push/handheld等
    if (hasHighEnergy) {
      const fastMarkers = ['fast', 'push', 'handheld', 'quick', 'whip', 'snap', 'shaky'];
      const hasFast = fastMarkers.some(m => camera.toLowerCase().includes(m));
      
      if (!hasFast) {
        issues.push({
          severity: 'error',
          fieldA: 'timeline',
          fieldB: 'camera_movement',
          message: 'timeline包含高潮/爆发节拍，但camera_movement没有快速/手持/推进运镜',
          fixable: true,
          fix: (f) => ({
            camera_movement: `${f.camera_movement}; T00:高潮时刻快速推轨+手持晃动，强化冲击感`
          })
        });
      }
    }

    // 检查timeline是否包含建立/平静等低情绪节拍
    const lowEnergyMarkers = ['建立', '平静', '收尾', '定格', '展示', '引入'];
    const hasLowEnergy = lowEnergyMarkers.some(m => timeline.includes(m));
    
    if (hasLowEnergy) {
      const slowMarkers = ['slow', 'static', 'stable', 'smooth', 'gradual', 'gentle'];
      const hasSlow = slowMarkers.some(m => camera.toLowerCase().includes(m));
      
      if (!hasSlow) {
        issues.push({
          severity: 'warning',
          fieldA: 'timeline',
          fieldB: 'camera_movement',
          message: 'timeline包含建立/平静节拍，但camera_movement没有缓慢/稳定运镜',
          fixable: true,
          fix: (f) => ({
            camera_movement: `T00:开场缓慢稳定构图; ${f.camera_movement}`
          })
        });
      }
    }

    return issues;
  }

  /**
   * 5. 时间轴-动作同步
   * timeline的每个节拍必须有对应的action变化
   */
  _checkTimelineAction(fields) {
    const issues = [];
    const timeline = String(fields.timeline || '');
    const action = String(fields.action || '');

    if (!timeline || !action) return issues;

    // 检查timeline是否描述动作变化
    const actionMarkers = ['抬手', '挥手', '奔跑', '跳跃', '转身', '攻击', '防御'];
    const timelineHasAction = actionMarkers.some(m => timeline.includes(m));
    
    // 如果timeline有动作描述，action字段必须包含对应动作
    if (timelineHasAction) {
      // 提取timeline中的动作词
      const timelineActions = actionMarkers.filter(m => timeline.includes(m));
      const actionContains = timelineActions.some(a => action.includes(a));
      
      if (!actionContains) {
        issues.push({
          severity: 'warning',
          fieldA: 'timeline',
          fieldB: 'action',
          message: `timeline描述动作"${timelineActions[0]}"，但action字段未包含该动作`,
          fixable: true,
          fix: (f) => ({
            action: `${f.action}; ${timelineActions[0]}动作`
          })
        });
      }
    }

    return issues;
  }

  /**
   * 6. 场景-灯光-明亮约束时序一致
   * 夜晚场景不能bright_constraint="bright lighting"
   */
  _checkSceneLightingBright(fields) {
    const issues = [];
    const scene = String(fields.scene || '').toLowerCase();
    const lighting = String(fields.lighting || '').toLowerCase();
    const bright = String(fields.bright_constraint || '').toLowerCase();

    // 检查场景时间
    const nightMarkers = ['夜晚', 'night', 'dark', 'moon', 'stars', 'midnight', 'evening'];
    const dayMarkers = ['白天', 'day', 'sun', 'morning', 'afternoon', 'noon'];
    const isNight = nightMarkers.some(m => scene.includes(m));
    const isDay = dayMarkers.some(m => scene.includes(m));

    if (isNight && bright.includes('bright') && !bright.includes('not bright')) {
      issues.push({
        severity: 'error',
        fieldA: 'scene',
        fieldB: 'bright_constraint',
        message: '夜晚场景但bright_constraint要求明亮，矛盾',
        fixable: true,
        fix: (f) => ({
          bright_constraint: 'atmospheric low-key lighting, moonlight illumination, dark moody ambiance, clear visibility through contrast not brightness'
        })
      });
    }

    if (isDay && lighting.includes('dark') && !lighting.includes('not dark')) {
      issues.push({
        severity: 'warning',
        fieldA: 'scene',
        fieldB: 'lighting',
        message: '白天场景但lighting描述为暗光，可能矛盾',
        fixable: false
      });
    }

    return issues;
  }

  /**
   * 7. 动作-运镜同步
   * 快速动作需要fast camera，缓慢动作需要slow camera
   */
  _checkActionCamera(fields) {
    const issues = [];
    const action = String(fields.action || '').toLowerCase();
    const camera = String(fields.camera_movement || '').toLowerCase();

    if (!action || !camera) return issues;

    const fastActions = ['奔跑', '冲刺', '跳跃', '攻击', '挥舞', '快速', '猛冲', '冲锋', '突进'];
    const slowActions = ['站立', '静坐', '沉思', '凝视', '缓慢', '静止', '定格', '沉思'];

    const isFastAction = fastActions.some(a => action.includes(a));
    const isSlowAction = slowActions.some(a => action.includes(a));

    if (isFastAction) {
      const fastCamera = ['fast', 'handheld', 'quick', 'track', 'follow'];
      const hasFastCamera = fastCamera.some(c => camera.includes(c));
      if (!hasFastCamera) {
        issues.push({
          severity: 'warning',
          fieldA: 'action',
          fieldB: 'camera_movement',
          message: '动作快速但运镜没有快速/跟踪/手持',
          fixable: true,
          fix: (f) => ({
            camera_movement: `fast handheld tracking following the action; ${f.camera_movement}`
          })
        });
      }
    }

    if (isSlowAction) {
      const slowCamera = ['slow', 'static', 'stable', 'smooth'];
      const hasSlowCamera = slowCamera.some(c => camera.includes(c));
      if (!hasSlowCamera) {
        issues.push({
          severity: 'warning',
          fieldA: 'action',
          fieldB: 'camera_movement',
          message: '动作缓慢但运镜没有稳定/缓慢',
          fixable: true,
          fix: (f) => ({
            camera_movement: `slow static camera, stable composition; ${f.camera_movement}`
          })
        });
      }
    }

    return issues;
  }

  /**
   * 8. 构图-运镜景别一致
   * composition的shot_size必须与camera_movement的景别一致
   */
  _checkCompositionCamera(fields) {
    const issues = [];
    const composition = String(fields.composition || '').toLowerCase();
    const camera = String(fields.camera_movement || '').toLowerCase();

    if (!composition || !camera) return issues;

    const shotSizes = {
      wide: ['全景', 'wide', 'long shot', 'establishing', '全景'],
      medium: ['中景', 'medium', 'medium shot', 'waist', '膝上'],
      close: ['特写', 'close', 'close-up', 'close up', '面部', '眼睛'],
      extreme: ['极特写', 'extreme', 'extreme close-up', 'macro', '细节']
    };

    // 提取composition的景别
    let compSize = null;
    for (const [size, markers] of Object.entries(shotSizes)) {
      if (markers.some(m => composition.includes(m))) {
        compSize = size;
        break;
      }
    }

    // 提取camera_movement的景别
    let camSize = null;
    for (const [size, markers] of Object.entries(shotSizes)) {
      if (markers.some(m => camera.includes(m))) {
        camSize = size;
        break;
      }
    }

    // 如果两者都有景别描述且不一致
    if (compSize && camSize && compSize !== camSize) {
      issues.push({
        severity: 'error',
        fieldA: 'composition',
        fieldB: 'camera_movement',
        message: `构图景别(${compSize})与运镜景别(${camSize})不一致`,
        fixable: true,
        fix: (f) => {
          // 以composition为准修正camera_movement
          const sizeMap = {
            wide: 'wide establishing shot',
            medium: 'medium shot framing',
            close: 'close-up focusing',
            extreme: 'extreme close-up macro'
          };
          return { camera_movement: `${sizeMap[compSize]}; ${f.camera_movement}` };
        }
      });
    }

    return issues;
  }

  /**
   * 9. 景深-景别一致
   * 特写→浅景深, 全景→深景深
   */
  _checkDepthOfFieldComposition(fields) {
    const issues = [];
    const dof = String(fields.depth_of_field || '').toLowerCase();
    const composition = String(fields.composition || '').toLowerCase();

    if (!dof || !composition) return issues;

    // 提取composition的景别
    const isClose = ['特写', 'close', 'close-up', '面部', '眼睛'].some(m => composition.includes(m));
    const isWide = ['全景', 'wide', 'establishing', 'long shot'].some(m => composition.includes(m));

    // 特写应该有浅景深
    if (isClose) {
      const shallow = ['shallow', 'f/2', 'f/1', 'blur', 'bokeh', 'f/2.8'];
      const hasShallow = shallow.some(s => dof.includes(s));
      if (!hasShallow) {
        issues.push({
          severity: 'warning',
          fieldA: 'composition',
          fieldB: 'depth_of_field',
          message: '特写镜头但景深没有浅景深(f/2.8以下)，背景虚化不足',
          fixable: true,
          fix: (f) => ({
            depth_of_field: `shallow depth of field f/2.8, strong background bokeh, sharp focus on subject; ${f.depth_of_field}`
          })
        });
      }
    }

    // 全景应该有深景深
    if (isWide) {
      const deep = ['deep', 'f/8', 'f/11', 'f/16', 'sharp throughout'];
      const hasDeep = deep.some(d => dof.includes(d));
      if (!hasDeep) {
        issues.push({
          severity: 'warning',
          fieldA: 'composition',
          fieldB: 'depth_of_field',
          message: '全景镜头但景深没有深景深(f/8以上)，前景背景清晰度不足',
          fixable: true,
          fix: (f) => ({
            depth_of_field: `deep depth of field f/8, sharp focus throughout entire frame; ${f.depth_of_field}`
          })
        });
      }
    }

    return issues;
  }

  /**
   * 10. 节奏-运镜速度一致
   * pacing说fast则camera必须有fast
   */
  _checkPacingCamera(fields) {
    const issues = [];
    const pacing = String(fields.pacing || '').toLowerCase();
    const camera = String(fields.camera_movement || '').toLowerCase();

    if (!pacing || !camera) return issues;

    const fastPacing = ['fast', 'quick', 'rapid', 'tense', 'urgent', 'accelerating'];
    const slowPacing = ['slow', 'gentle', 'gradual', 'calm', 'peaceful', 'relaxed'];

    const isFastPacing = fastPacing.some(p => pacing.includes(p));
    const isSlowPacing = slowPacing.some(p => pacing.includes(p));

    if (isFastPacing) {
      const fastCamera = ['fast', 'quick', 'handheld', 'whip'];
      const hasFast = fastCamera.some(c => camera.includes(c));
      if (!hasFast) {
        issues.push({
          severity: 'warning',
          fieldA: 'pacing',
          fieldB: 'camera_movement',
          message: 'pacing描述为快速/紧张，但camera_movement没有快速运镜',
          fixable: true,
          fix: (f) => ({
            camera_movement: `fast dynamic camera movement matching the quick pacing; ${f.camera_movement}`
          })
        });
      }
    }

    if (isSlowPacing) {
      const slowCamera = ['slow', 'static', 'smooth', 'gentle'];
      const hasSlow = slowCamera.some(c => camera.includes(c));
      if (!hasSlow) {
        issues.push({
          severity: 'warning',
          fieldA: 'pacing',
          fieldB: 'camera_movement',
          message: 'pacing描述为缓慢/平静，但camera_movement没有缓慢运镜',
          fixable: true,
          fix: (f) => ({
            camera_movement: `slow smooth camera movement, gentle and relaxed; ${f.camera_movement}`
          })
        });
      }
    }

    return issues;
  }

  // ==================== 辅助方法 ====================

  /**
   * 从mood字符串提取核心情绪
   */
  _extractMood(moodStr) {
    if (!moodStr) return null;
    const str = String(moodStr).toLowerCase();
    
    const moodMap = {
      tense: ['tense', '紧张', '紧迫', '悬疑', 'anxious', 'nervous', 'suspense'],
      sad: ['sad', '悲伤', '忧郁', 'melancholy', 'sorrow', 'grief', 'depressed'],
      epic: ['epic', '史诗', '宏大', '壮丽', 'grand', 'majestic', 'heroic'],
      warm: ['warm', '温馨', '温暖', 'cozy', 'gentle', 'tender', 'affectionate'],
      calm: ['calm', '平静', '宁静', 'peaceful', 'serene', 'tranquil', 'quiet']
    };

    for (const [mood, markers] of Object.entries(moodMap)) {
      if (markers.some(m => str.includes(m))) return mood;
    }
    return null;
  }
}

module.exports = { FieldConsistencyChecker };
