/**
 * 连贯性引擎 (Continuity Engine) v1.0
 * 检查相邻镜头间的转场连贯性、运镜一致性、景别合法性
 * 
 * 核心检查项：
 * 1. 景别过渡检查 — 相邻镜头景别差≤1级硬切合法，=2级需叠化，≥3级非法
 * 2. 运镜方向追踪 — 推/拉/摇/移/跟的向量一致性，防止方向突变
 * 3. 视觉元素验证 — 光影、环境、道具跨镜头连续性
 * 4. 转场类型建议 — 基于相邻镜头参数推荐合法转场类型
 * 
 * @version v1.0
 * @author 小G
 */

class ContinuityEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    
    // 七级景别体系（从远到近）
    this.SHOT_SCALES = [
      'ELS', // Extreme Long Shot 大远景
      'LS',  // Long Shot 远景
      'FS',  // Full Shot 全景
      'MS',  // Medium Shot 中景
      'MCU', // Medium Close-Up 近景
      'CU',  // Close-Up 特写
      'ECU'  // Extreme Close-Up 大特写
    ];
    
    // 景别过渡合法性矩阵（行=当前，列=下一个）
    // √=硬切合法, △=需叠化/淡入淡出, ×=非法
    this.SCALE_TRANSITION_MATRIX = {
      'ELS': { 'ELS': '√', 'LS': '√', 'FS': '△', 'MS': '×', 'MCU': '×', 'CU': '×', 'ECU': '×' },
      'LS':  { 'ELS': '√', 'LS': '√', 'FS': '√', 'MS': '△', 'MCU': '×', 'CU': '×', 'ECU': '×' },
      'FS':  { 'ELS': '△', 'LS': '√', 'FS': '√', 'MS': '√', 'MCU': '△', 'CU': '×', 'ECU': '×' },
      'MS':  { 'ELS': '×', 'LS': '△', 'FS': '√', 'MS': '√', 'MCU': '√', 'CU': '△', 'ECU': '×' },
      'MCU': { 'ELS': '×', 'LS': '×', 'FS': '△', 'MS': '√', 'MCU': '√', 'CU': '√', 'ECU': '△' },
      'CU':  { 'ELS': '×', 'LS': '×', 'FS': '×', 'MS': '△', 'MCU': '√', 'CU': '√', 'ECU': '√' },
      'ECU': { 'ELS': '×', 'LS': '×', 'FS': '×', 'MS': '×', 'MCU': '△', 'CU': '√', 'ECU': '√' }
    };
    
    // 运镜方向向量映射（简化三维向量）
    this.CAMERA_VECTORS = {
      'push_in':    { x: 0, y: 0, z: 1 },    // 推向主体
      'pull_out':   { x: 0, y: 0, z: -1 },   // 拉远
      'pan_left':   { x: -1, y: 0, z: 0 },   // 左摇
      'pan_right':  { x: 1, y: 0, z: 0 },    // 右摇
      'tilt_up':    { x: 0, y: 1, z: 0 },     // 上摇
      'tilt_down':  { x: 0, y: -1, z: 0 },    // 下摇
      'truck_left': { x: -1, y: 0, z: 0 },   // 左移
      'truck_right':{ x: 1, y: 0, z: 0 },    // 右移
      'crane_up':   { x: 0, y: 1, z: 0 },     // 升
      'crane_down': { x: 0, y: -1, z: 0 },    // 降
      'orbit_cw':   { x: 1, y: 0, z: 0.5 },  // 顺时针环绕
      'orbit_ccw':  { x: -1, y: 0, z: 0.5 }, // 逆时针环绕
      'static':     { x: 0, y: 0, z: 0 },     // 固定
      'handheld':   { x: 0.5, y: 0.3, z: 0.2 }, // 手持（随机扰动）
      'dolly_in':   { x: 0, y: 0, z: 1 },     // 轨道推
      'dolly_out':  { x: 0, y: 0, z: -1 },    // 轨道拉
      'follow':     { x: 0.5, y: 0, z: 0.5 }, // 跟随
      'zoom_in':    { x: 0, y: 0, z: 1 },     // 变焦推
      'zoom_out':   { x: 0, y: 0, z: -1 }     // 变焦拉
    };
    
    // 严重冲突的运镜方向对（夹角>90°且无过渡）
    this.CONFLICTING_PAIRS = [
      ['push_in', 'pull_out'],
      ['pan_left', 'pan_right'],
      ['tilt_up', 'tilt_down'],
      ['dolly_in', 'dolly_out'],
      ['zoom_in', 'zoom_out'],
      ['orbit_cw', 'orbit_ccw']
    ];
  }

  /**
   * 主入口：分析全镜头序列的连贯性
   * @param {Array} shots - 镜头数组
   * @returns {Object} 连贯性分析报告
   */
  analyze(shots) {
    console.log(`\n[ContinuityEngine] 🔗 连贯性引擎启动 | 镜头数: ${shots.length}`);
    
    const result = {
      score: 0,
      maxScore: 100,
      issues: [],
      transitions: [],
      summary: {}
    };

    // 逐对分析相邻镜头
    for (let i = 0; i < shots.length - 1; i++) {
      const curr = shots[i];
      const next = shots[i + 1];
      const pairId = `${curr.shotId}→${next.shotId}`;
      
      const pairAnalysis = this._analyzePair(curr, next, pairId);
      result.transitions.push(pairAnalysis);
      
      // 收集问题
      if (pairAnalysis.issues.length > 0) {
        result.issues.push(...pairAnalysis.issues);
      }
    }

    // 计算总分
    result.score = this._calculateScore(result.issues, shots.length - 1);
    result.summary = this._generateSummary(result);

    this._printReport(result);
    return result;
  }

  /**
   * 分析相邻镜头对
   */
  _analyzePair(curr, next, pairId) {
    const issues = [];
    const checks = {};
    
    // === 1. 景别过渡检查 ===
    checks.scale = this._checkScaleTransition(curr, next, pairId);
    if (checks.scale.issue) {
      issues.push(checks.scale.issue);
    }
    
    // === 2. 运镜方向检查 ===
    checks.motion = this._checkMotionConsistency(curr, next, pairId);
    if (checks.motion.issue) {
      issues.push(checks.motion.issue);
    }
    
    // === 3. 视觉元素连续性检查 ===
    checks.visual = this._checkVisualContinuity(curr, next, pairId);
    if (checks.visual.issue) {
      issues.push(checks.visual.issue);
    }
    
    // === 4. 转场类型建议 ===
    checks.transition = this._recommendTransition(curr, next, checks);
    
    return {
      pairId,
      checks,
      issues,
      severity: this._getPairSeverity(issues)
    };
  }

  /**
   * 景别过渡检查
   * 基于七级景别体系合法性矩阵
   */
  _checkScaleTransition(curr, next, pairId) {
    const currScale = this._extractShotScale(curr);
    const nextScale = this._extractShotScale(next);
    
    const scaleDelta = Math.abs(
      this.SHOT_SCALES.indexOf(currScale) - this.SHOT_SCALES.indexOf(nextScale)
    );
    
    const verdict = this.SCALE_TRANSITION_MATRIX[currScale]?.[nextScale] || '×';
    
    const result = {
      currScale,
      nextScale,
      scaleDelta,
      verdict,
      issue: null
    };
    
    if (verdict === '×') {
      result.issue = {
        severity: 'fatal',
        category: 'continuity',
        subCategory: 'scale',
        pairId,
        message: `景别从${this._scaleToChinese(currScale)}直接跳至${this._scaleToChinese(nextScale)}，跨度${scaleDelta}级，非法跳切`,
        fix: `插入过渡镜头（如${this._scaleToChinese(this._recommendIntermediateScale(currScale, nextScale))}），或使用叠化/淡入淡出过渡`,
        currScale,
        nextScale
      };
    } else if (verdict === '△') {
      result.issue = {
        severity: 'severe',
        category: 'continuity',
        subCategory: 'scale',
        pairId,
        message: `景别从${this._scaleToChinese(currScale)}跳至${this._scaleToChinese(nextScale)}，跨度${scaleDelta}级，需叠化/淡入淡出过渡`,
        fix: '使用叠化（dissolve）或淡入淡出（fade）过渡，避免硬切',
        currScale,
        nextScale
      };
    }
    
    return result;
  }

  /**
   * 运镜方向一致性检查
   */
  _checkMotionConsistency(curr, next, pairId) {
    const currMoves = this._extractCameraMoves(curr);
    const nextMoves = this._extractCameraMoves(next);
    
    const result = {
      currMoves,
      nextMoves,
      issue: null
    };
    
    if (currMoves.length === 0 || nextMoves.length === 0) {
      return result;
    }
    
    // 检查最后一动作与下一镜头第一动作的方向冲突
    const currLast = currMoves[currMoves.length - 1];
    const nextFirst = nextMoves[0];
    
    const currVec = this.CAMERA_VECTORS[currLast] || { x: 0, y: 0, z: 0 };
    const nextVec = this.CAMERA_VECTORS[nextFirst] || { x: 0, y: 0, z: 0 };
    
    // 计算向量夹角
    const angle = this._calculateAngle(currVec, nextVec);
    const speedDelta = this._calculateSpeedDelta(curr, next);
    
    // 检查是否为冲突对
    const isConflictPair = this.CONFLICTING_PAIRS.some(
      pair => (pair[0] === currLast && pair[1] === nextFirst) || 
              (pair[0] === nextFirst && pair[1] === currLast)
    );
    
    if (isConflictPair) {
      result.issue = {
        severity: 'severe',
        category: 'continuity',
        subCategory: 'motion',
        pairId,
        message: `运镜方向完全反转：${currLast} → ${nextFirst}，造成视觉震荡`,
        fix: '插入静止过渡镜头或强制叠化，避免方向突变',
        currMove: currLast,
        nextMove: nextFirst,
        angle
      };
    } else if (angle > 90 && speedDelta > 0.5) {
      result.issue = {
        severity: 'medium',
        category: 'continuity',
        subCategory: 'motion',
        pairId,
        message: `运镜方向突变${angle.toFixed(0)}°且速度差异${(speedDelta * 100).toFixed(0)}%，运动不连贯`,
        fix: '调整运镜方向使其平滑过渡，或使用叠化弱化跳变',
        currMove: currLast,
        nextMove: nextFirst,
        angle,
        speedDelta
      };
    }
    
    return result;
  }

  /**
   * 视觉元素连续性检查
   * 检查光影、环境、道具的跨镜头一致性
   */
  _checkVisualContinuity(curr, next, pairId) {
    const currPrompt = curr.prompt || '';
    const nextPrompt = next.prompt || '';
    
    const result = {
      issue: null
    };
    
    // 提取光影关键词
    const lightKeywords = ['暖色', '冷色', '金色', '蓝色', '红色', '火把', '月光', '日光', '霓虹', '逆光', '侧光'];
    const currLight = lightKeywords.filter(kw => currPrompt.includes(kw));
    const nextLight = lightKeywords.filter(kw => nextPrompt.includes(kw));
    
    // 检查光影突变（从暖色突变为冷色）
    const warmWords = ['暖色', '金色', '火把', '日光', '暖'];
    const coolWords = ['冷色', '蓝色', '月光', '冷'];
    
    const currWarm = warmWords.some(w => currPrompt.includes(w));
    const currCool = coolWords.some(w => currPrompt.includes(w));
    const nextWarm = warmWords.some(w => nextPrompt.includes(w));
    const nextCool = coolWords.some(w => nextPrompt.includes(w));
    
    if ((currWarm && nextCool) || (currCool && nextWarm)) {
      // 检查是否有时间流逝的叙事动机
      const hasTimePass = currPrompt.includes('时间流逝') || nextPrompt.includes('时间流逝') ||
                          currPrompt.includes('转场') || nextPrompt.includes('转场');
      
      if (!hasTimePass) {
        result.issue = {
          severity: 'medium',
          category: 'continuity',
          subCategory: 'visual',
          pairId,
          message: `光影基调突变：从${currWarm ? '暖色' : '冷色'}突变为${nextWarm ? '暖色' : '冷色'}，无时间流逝叙事动机`,
          fix: '统一光源逻辑，或添加时间流逝的叙事铺垫（如“夜幕降临”）',
          currLight: currLight.join(',') || '未标注',
          nextLight: nextLight.join(',') || '未标注'
        };
      }
    }
    
    // 检查环境突变（如从森林突变为城市）
    const envKeywords = {
      '森林': ['森林', '树林', '树木', '丛林'],
      '城市': ['城市', '建筑', '街道', '高楼'],
      '沙漠': ['沙漠', '沙丘', '戈壁'],
      '海洋': ['海洋', '水', '海浪'],
      '山地': ['山', '山脉', '峰'],
      '室内': ['室内', '房间', '宫殿', '建筑内部']
    };
    
    const currEnv = Object.entries(envKeywords).find(([_, kws]) => kws.some(kw => currPrompt.includes(kw)));
    const nextEnv = Object.entries(envKeywords).find(([_, kws]) => kws.some(kw => nextPrompt.includes(kw)));
    
    if (currEnv && nextEnv && currEnv[0] !== nextEnv[0]) {
      // 检查是否有场景转换标记
      const hasSceneChange = currPrompt.includes('转场') || nextPrompt.includes('转场') ||
                             currPrompt.includes('切换场景') || nextPrompt.includes('切换场景');
      
      if (!hasSceneChange) {
        result.issue = {
          severity: 'medium',
          category: 'continuity',
          subCategory: 'visual',
          pairId,
          message: `环境突变：从${currEnv[0]}突变为${nextEnv[0]}，无场景转换标记`,
          fix: '添加场景转换铺垫（如“与此同时，在另一个地方”），或使用叠化过渡',
          currEnv: currEnv[0],
          nextEnv: nextEnv[0]
        };
      }
    }
    
    return result;
  }

  /**
   * 推荐转场类型
   */
  _recommendTransition(curr, next, checks) {
    const scaleCheck = checks.scale;
    const motionCheck = checks.motion;
    
    // 默认硬切
    let recommended = 'hard_cut';
    
    // 景别差≥2级 → 推荐叠化
    if (scaleCheck.verdict === '△' || scaleCheck.verdict === '×') {
      recommended = 'dissolve';
    }
    
    // 运镜方向冲突 → 推荐叠化或淡入淡出
    if (motionCheck.issue && motionCheck.issue.severity === 'severe') {
      recommended = 'fade';
    }
    
    // 光影/环境突变 → 推荐淡入淡出
    if (checks.visual.issue) {
      recommended = 'fade';
    }
    
    return {
      recommended,
      alternatives: this._getAlternativeTransitions(recommended)
    };
  }

  /**
   * 提取镜头景别
   */
  _extractShotScale(shot) {
    const prompt = shot.prompt || '';
    
    // 从prompt中提取景别关键词
    if (prompt.includes('大特写') || prompt.includes('extreme_close')) return 'ECU';
    if (prompt.includes('特写') || prompt.includes('closeup') || prompt.includes('close-up')) return 'CU';
    if (prompt.includes('近景') || prompt.includes('medium_close')) return 'MCU';
    if (prompt.includes('中景') || prompt.includes('medium_shot')) return 'MS';
    if (prompt.includes('全景') || prompt.includes('full_shot')) return 'FS';
    if (prompt.includes('远景') || prompt.includes('long_shot')) return 'LS';
    if (prompt.includes('大远景') || prompt.includes('extreme_long')) return 'ELS';
    
    // 从cameraMovement中提取
    const scale = shot.cameraMovement?.scale || shot.scale || '';
    if (scale) {
      const scaleUpper = scale.toUpperCase();
      if (this.SHOT_SCALES.includes(scaleUpper)) return scaleUpper;
    }
    
    // 默认根据镜头类型推断
    if (shot.isOpening || shot.shotId === 'S00') return 'LS'; // 片头通常远景开场
    if (shot.shotType?.includes('close')) return 'CU';
    if (shot.shotType?.includes('wide')) return 'LS';
    
    return 'MS'; // 默认中景
  }

  /**
   * 提取运镜动作列表
   */
  _extractCameraMoves(shot) {
    const prompt = shot.prompt || '';
    const moves = [];
    
    // 从【运镜】字段提取
    const moveMatch = prompt.match(/【运镜】([^【]+)/);
    if (moveMatch) {
      const moveStr = moveMatch[1].trim();
      // 解析运镜指令（如 "push_in → pan_left → orbit_cw"）
      const moveList = moveStr.split(/[→|→,]/).map(m => m.trim().toLowerCase());
      
      moveList.forEach(m => {
        // 映射到标准向量名
        const mapped = this._mapMoveToVector(m);
        if (mapped) moves.push(mapped);
      });
    }
    
    // 从cameraMovement字段提取
    if (shot.cameraMovement?.type) {
      const type = shot.cameraMovement.type.toLowerCase();
      const mapped = this._mapMoveToVector(type);
      if (mapped && !moves.includes(mapped)) moves.push(mapped);
    }
    
    return moves.length > 0 ? moves : ['static'];
  }

  /**
   * 将运镜描述映射到标准向量名
   */
  _mapMoveToVector(moveStr) {
    const moveMap = {
      '推': 'push_in',
      '拉': 'pull_out',
      '左摇': 'pan_left',
      '右摇': 'pan_right',
      '上摇': 'tilt_up',
      '下摇': 'tilt_down',
      '左移': 'truck_left',
      '右移': 'truck_right',
      '上升': 'crane_up',
      '下降': 'crane_down',
      '环绕': 'orbit_cw',
      '顺时针': 'orbit_cw',
      '逆时针': 'orbit_ccw',
      '固定': 'static',
      '手持': 'handheld',
      '跟随': 'follow',
      '变焦推': 'zoom_in',
      '变焦拉': 'zoom_out',
      '轨道推': 'dolly_in',
      '轨道拉': 'dolly_out'
    };
    
    // 直接匹配
    if (moveMap[moveStr]) return moveMap[moveStr];
    
    // 模糊匹配
    for (const [key, val] of Object.entries(moveMap)) {
      if (moveStr.includes(key)) return val;
    }
    
    // 检查是否在CAMERA_VECTORS中
    if (this.CAMERA_VECTORS[moveStr]) return moveStr;
    
    return null;
  }

  /**
   * 计算向量夹角（度）
   */
  _calculateAngle(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2);
    const mag2 = Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = dot / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  }

  /**
   * 计算速度差异率
   */
  _calculateSpeedDelta(curr, next) {
    const currSpeed = this._extractSpeed(curr);
    const nextSpeed = this._extractSpeed(next);
    
    const maxSpeed = Math.max(currSpeed, nextSpeed);
    if (maxSpeed === 0) return 0;
    
    return Math.abs(currSpeed - nextSpeed) / maxSpeed;
  }

  /**
   * 提取运镜速度
   */
  _extractSpeed(shot) {
    const speedCurve = shot.cameraMovement?.speedCurve || shot.speedCurve || '';
    
    const speedMap = {
      'exploding': 1.0,
      'building': 0.8,
      'fast_slow_fast': 0.7,
      'slow_fast_slow': 0.5,
      'breathing': 0.2,
      'gentle_float': 0.3,
      'slow_drifting': 0.2,
      'steady_flow': 0.4,
      'fast': 0.9,
      'medium': 0.5,
      'slow': 0.3,
      'static': 0.0
    };
    
    return speedMap[speedCurve] || 0.5;
  }

  /**
   * 推荐中间景别
   */
  _recommendIntermediateScale(scale1, scale2) {
    const idx1 = this.SHOT_SCALES.indexOf(scale1);
    const idx2 = this.SHOT_SCALES.indexOf(scale2);
    const midIdx = Math.floor((idx1 + idx2) / 2);
    return this.SHOT_SCALES[midIdx];
  }

  /**
   * 获取转场备选方案
   */
  _getAlternativeTransitions(primary) {
    const alternatives = {
      'hard_cut': ['dissolve'],
      'dissolve': ['fade', 'hard_cut'],
      'fade': ['dissolve', 'wipe'],
      'wipe': ['dissolve', 'fade']
    };
    return alternatives[primary] || ['dissolve'];
  }

  /**
   * 景别代码转中文
   */
  _scaleToChinese(scale) {
    const map = {
      'ELS': '大远景',
      'LS': '远景',
      'FS': '全景',
      'MS': '中景',
      'MCU': '近景',
      'CU': '特写',
      'ECU': '大特写'
    };
    return map[scale] || scale;
  }

  /**
   * 计算连贯性总分
   */
  _calculateScore(issues, totalTransitions) {
    const baseScore = 100;
    
    const deductions = {
      'fatal': 20,
      'severe': 12,
      'medium': 6,
      'low': 2
    };
    
    let totalDeduction = 0;
    issues.forEach(issue => {
      totalDeduction += deductions[issue.severity] || 5;
    });
    
    return Math.max(0, baseScore - totalDeduction);
  }

  /**
   * 获取问题对的最高严重度
   */
  _getPairSeverity(issues) {
    if (issues.some(i => i.severity === 'fatal')) return 'fatal';
    if (issues.some(i => i.severity === 'severe')) return 'severe';
    if (issues.some(i => i.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * 生成摘要
   */
  _generateSummary(result) {
    const severityCount = { fatal: 0, severe: 0, medium: 0, low: 0 };
    result.issues.forEach(i => severityCount[i.severity]++);
    
    return {
      totalTransitions: result.transitions.length,
      fatalIssues: severityCount.fatal,
      severeIssues: severityCount.severe,
      mediumIssues: severityCount.medium,
      lowIssues: severityCount.low,
      score: result.score,
      status: result.score >= 80 ? '良好' : result.score >= 60 ? '合格' : '需修复'
    };
  }

  /**
   * 输出报告
   */
  _printReport(result) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔗 连贯性引擎报告`);
    console.log(`${'='.repeat(60)}`);
    console.log(`评分: ${result.score}/100`);
    console.log(`状态: ${result.summary.status}`);
    console.log(`检查转场数: ${result.summary.totalTransitions}`);
    console.log(`\n问题统计:`);
    console.log(`  🔴 致命: ${result.summary.fatalIssues}`);
    console.log(`  🟠 严重: ${result.summary.severeIssues}`);
    console.log(`  🟡 中等: ${result.summary.mediumIssues}`);
    console.log(`  🟢 轻微: ${result.summary.lowIssues}`);
    
    if (result.issues.length > 0) {
      console.log(`\n问题详情:`);
      result.issues.forEach((issue, idx) => {
        const icon = issue.severity === 'fatal' ? '🔴' : issue.severity === 'severe' ? '🟠' : issue.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} [${issue.pairId}] ${issue.message}`);
        if (issue.fix) {
          console.log(`     → 修复: ${issue.fix}`);
        }
      });
    }
    
    console.log(`${'='.repeat(60)}\n`);
  }
}

module.exports = { ContinuityEngine };
// v6.2-patch68: 新增连贯性引擎（ContinuityEngine）
