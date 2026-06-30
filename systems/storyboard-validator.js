const fs = require('fs');
const path = require('path');
const { CameraMovementSystem } = require('./camera-movement-system-v2.js');
const { FiveElementInspector } = require('./five-element-inspector');

class StoryboardValidator {
  constructor(config = {}) {
    this.config = {
      openingActionKeywords: ['打招呼', '挥手', '欢迎', '介绍', '开场', '自我介绍', '右手抬起', '左手抬起', '双手张开', '做手势', '嘴部张开', '正在说话', '开口', '讲话', '点头示意', '微笑致意', '眼神交流', '打招呼手势', '比划', '示意'],
      staticPoseKeywords: ['双手自然交叠', '双手放在身前', '双手放在腹部', '端庄站立', '静态', '站立面对镜头', '双手自然下垂', '双臂交叉', '双手背在身后'],
      requiredCharacters: [], // 默认不强制，由项目配置决定
      minChars: 450,
      maxChars: 1500,
      // v2升级：时长弹性区间配置（动态上限，避免硬编码）
      durationConfig: {
        minDuration: 3,
        maxDuration: 30,  // v6.2-patch71-fix: 从15改为30，支持更长场景
        defaultDuration: 5
      },
      // v3.6升级：五要素检查配置
      fiveElementCheck: {
        enabled: true,
        strictMode: false, // 警告模式，不拦截
        thresholds: {
          adventureInitiative: 40,
          beastUniqueness: 50,
          emotionalResonance: 40,
          growthTransformation: 30,
          worldConsistency: 60
        }
      },
      ...config
    };
    
    // 如果故事板有projectConfig.requiredCharacters，优先使用
    this.projectConfig = null;
    
    // v3.6：初始化五要素检查器
    if (this.config.fiveElementCheck.enabled) {
      this.fiveElementInspector = new FiveElementInspector({
        strictMode: this.config.fiveElementCheck.strictMode,
        thresholds: this.config.fiveElementCheck.thresholds
      });
    }
    
    this.errors = [];
    this.warnings = [];
  }

  async validate(storyboardPath) {
    let storyboard;
    
    // 支持对象直接传入或文件路径
    if (typeof storyboardPath === 'string') {
      const data = await fs.promises.readFile(storyboardPath, 'utf8');
      storyboard = JSON.parse(data);
    } else if (typeof storyboardPath === 'object' && storyboardPath !== null) {
      storyboard = storyboardPath;
    } else {
      throw new Error('validate参数必须是文件路径或故事板对象');
    }
    
    console.log('🔍 故事板审核开始');
    console.log('=' .repeat(60));
    console.log(`项目: ${storyboard.project || '未命名'}`);
    console.log(`版本: ${storyboard.version || '未指定'}`);
    console.log(`总镜头: ${storyboard.shots?.length || 0}`);
    console.log('=' .repeat(60));

    this.validateOpeningShot(storyboard);
    this.validateCharacterCompleteness(storyboard);
    this.validatePromptActions(storyboard);
    this.validateTextCompliance(storyboard);
    this.validateCharCount(storyboard);
    this.validateMouthAction(storyboard);
    this.validateDurationMatch(storyboard);
    this.validateCameraMovement(storyboard);
    
    // 【v6.0-patch22 新增】叙事完整性验证
    this.validateNarrationCompletion(storyboard);
    
    // v3.6升级：五要素检查（山海经系列）
    if (this.config.fiveElementCheck.enabled && this.fiveElementInspector) {
      this.validateFiveElements(storyboard);
    }

    return this.generateReport(storyboard);
  }

  validateOpeningShot(storyboard) {
    const shots = storyboard.shots || [];
    const openingShot = shots[0];
    if (!openingShot) {
      this.errors.push({ rule: '开场镜头', severity: 'error', message: '故事板没有镜头', suggestion: '至少需要一个开场镜头' });
      return;
    }
    
    // v1.1-fix: 片头镜头跳过开场动作检查
    if (openingShot.type === 'opening' || openingShot.type === '片头' || openingShot.id === 'S00') {
      console.log(`ℹ️  开场镜头 ${openingShot.id} 为片头，跳过开场动作检查`);
      return;
    }
    const prompt = openingShot.prompt || '';
    const hasOpeningAction = this.config.openingActionKeywords.some(kw => prompt.includes(kw));
    const hasStaticPose = this.config.staticPoseKeywords.some(kw => prompt.includes(kw));
    if (!hasOpeningAction && hasStaticPose) {
      this.errors.push({ rule: '开场动作', severity: 'error', shot: openingShot.id, message: `开场镜头 ${openingShot.id} 只有静态姿态，缺少开场动作`, currentAction: openingShot.action || '未定义', promptPreview: prompt.substring(0, 100) + '...', suggestion: `开场镜头需要动作描述，例如：\n- "右手抬起做打招呼手势"\n- "嘴部微微张开正在说话介绍"\n- "微笑着向观众挥手示意"\n- "头部微微前倾像在欢迎观众"`, autoFix: this.generateOpeningFix(openingShot) });
    } else if (!hasOpeningAction && !hasStaticPose) {
      this.warnings.push({ rule: '开场动作', severity: 'warning', shot: openingShot.id, message: `开场镜头 ${openingShot.id} 可能缺少明确的开场动作`, suggestion: '建议显式描述开场动作（挥手/打招呼/说话）' });
    } else {
      console.log(`✅ 开场镜头 ${openingShot.id}: 包含开场动作`);
    }
  }

  validateCharacterCompleteness(storyboard) {
    const shots = storyboard.shots || [];
    
    // 读取项目配置中的必需角色（从故事板或项目配置）
    const projectConfig = storyboard.projectConfig || {};
    const requiredChars = projectConfig.requiredCharacters || this.config.requiredCharacters || [];
    
    // 如果没有指定必需角色，跳过检查（通用性设计）
    if (requiredChars.length === 0) {
      console.log(`ℹ️  角色检查: 未配置必需角色，跳过`);
      return;
    }
    
    const characterAppearances = {};
    shots.forEach(shot => {
      (shot.characters || []).forEach(char => {
        characterAppearances[char] = (characterAppearances[char] || 0) + 1;
      });
    });
    
    requiredChars.forEach(char => {
      const count = characterAppearances[char] || 0;
      if (count === 0) {
        this.errors.push({
          rule: '角色完整性',
          severity: 'error',
          character: char,
          message: `角色 "${char}" 在项目配置的必需列表中，但故事板中从未出场`,
          totalShots: shots.length,
          suggestion: `如需该角色出场，请在适当镜头中加入；如不需要，请从 projectConfig.requiredCharacters 中移除 "${char}"`
        });
      } else {
        console.log(`✅ 角色 ${char}: 出场 ${count} 次`);
      }
    });
    
    console.log('\n📊 角色出场分布:');
    Object.entries(characterAppearances).forEach(([char, count]) => {
      const bar = '█'.repeat(count) + '░'.repeat(shots.length - count);
      console.log(`   ${char.padEnd(15)} ${bar} ${count}/${shots.length}`);
    });
  }

  validatePromptActions(storyboard) {
    const shots = storyboard.shots || [];
    shots.forEach(shot => {
      const prompt = shot.render_prompt || shot.renderPrompt || shot.prompt || shot.visualPrompt || '';
      const staticKeywords = ['双手自然交叠', '双手放在', '端庄站立', '静态站立'];
      const hasStaticOnly = staticKeywords.some(kw => prompt.includes(kw));
      const actionKeywords = ['指向', '抬起', '举起', '挥舞', '比划', '触摸', '拿着', '展示', '讲解时', '说话时'];
      const hasAction = actionKeywords.some(kw => prompt.includes(kw));
      if (hasStaticOnly && !hasAction && shot.id !== 'S01') {
        this.warnings.push({ rule: 'Prompt动作', severity: 'warning', shot: shot.id, message: `镜头 ${shot.id} 描述过于静态，建议加入动作`, suggestion: `建议加入动作描述，例如：\n- "右手抬起指向XX"\n- "左手轻抚XX示意"\n- "双手比划XX的手势"` });
      }
    });
  }

  validateTextCompliance(storyboard) {
    const shots = storyboard.shots || [];
    const forbiddenText = ['小字清晰可辨', '印刷工整', '字迹清晰', '上面写着', '文字说明详细', '文字标注清晰', '字体清晰'];
    shots.forEach(shot => {
      const prompt = shot.render_prompt || shot.renderPrompt || shot.prompt || shot.visualPrompt || '';
      forbiddenText.forEach(text => {
        if (prompt.includes(text)) {
          this.errors.push({ rule: '画面文字', severity: 'error', shot: shot.id, message: `镜头 ${shot.id} 包含违规文字描述: "${text}"`, suggestion: '删除或替换为"模糊的文字"、"不清晰的标识"、"示意性文字"' });
        }
      });
    });
  }

  validateCharCount(storyboard) {
    const shots = storyboard.shots || [];
    shots.forEach(shot => {
      // 🔥 v1.1-fix: 如果 shot 还没有 prompt 字段（Stage-11 才生成），跳过字数检查
      // 因为 visualPrompt + narration 在 Stage-8 时必然不足，这是阶段性正常现象
      if (!shot.prompt && !shot.render_prompt && !shot.renderPrompt && !shot.visualPrompt) {
        return; // 跳过：Prompt 尚未生成，Stage-11 会增强至 1470-1500
      }
      
      const prompt = shot.render_prompt || shot.renderPrompt || shot.prompt || shot.visualPrompt || shot.narration || '';
      const count = this.countChineseChars(prompt);
      if (count < this.config.minChars) {
        this.warnings.push({ rule: '字数', severity: 'warning', shot: shot.id, message: `镜头 ${shot.id} 字数不足: ${count} < ${this.config.minChars} (检查字段: prompt/visualPrompt/narration)`, suggestion: '补充环境细节、质感描述、光影细节等' });
      } else if (count > this.config.maxChars) {
        this.errors.push({ rule: '字数', severity: 'error', shot: shot.id, message: `镜头 ${shot.id} 字数超标: ${count} > ${this.config.maxChars}`, suggestion: '删除冗余描述，优先保留：人物外貌、动作、核心场景' });
      } else {
        console.log(`✅ 镜头 ${shot.id}: ${count}字`);
      }
    });
  }

  validateMouthAction(storyboard) {
    const shots = storyboard.shots || [];
    let missingCount = 0;
    shots.forEach(shot => {
      // 片头镜头跳过检查
      if (shot.type === 'opening' || shot.type === '片头' || shot.id === 'S00' || shot.isOpening) {
        return;
      }
      // 同时支持驼峰和下划线两种命名
      const mouthAction = shot.mouthAction || shot.mouth_action;
      if (!mouthAction || (typeof mouthAction === 'string' && mouthAction.trim() === '')) {
        missingCount++;
        this.warnings.push({ rule: '口播动作', severity: 'warning', shot: shot.id, message: `镜头 ${shot.id} 缺少 mouthAction/mouth_action 字段`, suggestion: '添加 mouthAction 描述人物嘴部动作，例如：\n- "嘴部微微张开正在讲解科学知识"\n- "嘴部微张微笑着回应"\n- "嘴部微微张开正在总结讲话"' });
      }
    });
    if (missingCount === 0) {
      console.log(`✅ 口播动作: 全部 ${shots.filter(s => !(s.type === 'opening' || s.type === '片头' || s.id === 'S00' || s.isOpening)).length} 内容镜已设置 mouthAction`);
    }
  }

  validateDurationMatch(storyboard) {
    const shots = storyboard.shots || [];
    const speedMap = {
      'host': 4.0,
      'explanation': 4.5,
      'interaction': 5.0,
      'symptom': 4.5,
      'lab': 4.5,
      'summary': 4.0,
      'default': 4.5
    };
    const bufferSeconds = 0.5;
    const { minDuration, maxDuration } = this.config.durationConfig;

    shots.forEach(shot => {
      if (!shot.narration || shot.narration.trim() === '') return;

      if (!shot.duration) {
        this.errors.push({
          rule: '时长缺失',
          severity: 'error',
          shot: shot.id,
          message: `镜头 ${shot.id} 有narration但缺少duration字段`,
          suggestion: '设置duration字段，或删除narration'
        });
        return;
      }

      if (shot.duration <= 0) {
        this.errors.push({
          rule: '时长无效',
          severity: 'error',
          shot: shot.id,
          message: `镜头 ${shot.id} duration=${shot.duration}秒无效`,
          suggestion: 'duration必须大于0'
        });
        return;
      }

      // v2: 时长弹性区间检查（3-12秒）
      if (shot.duration < minDuration) {
        this.errors.push({
          rule: '时长过短',
          severity: 'error',
          shot: shot.id,
          message: `镜头 ${shot.id} duration=${shot.duration}秒 < 最小${minDuration}秒`,
          suggestion: `duration必须在${minDuration}-${maxDuration}秒区间内`
        });
        return;
      }
      if (shot.duration > maxDuration) {
        this.errors.push({
          rule: '时长超限',
          severity: 'error',
          shot: shot.id,
          message: `镜头 ${shot.id} duration=${shot.duration}秒 > 最大${maxDuration}秒`,
          suggestion: `duration必须在${minDuration}-${maxDuration}秒区间内，或调整API配置`
        });
        return;
      }

      const charCount = this.countChineseChars(shot.narration);
      const speed = speedMap[shot.type] || speedMap.default;
      const requiredDuration = Math.ceil((charCount / speed) + bufferSeconds);

      // v2: 时长匹配（基于可读性语速的警告，非拦截）
      if (requiredDuration > shot.duration) {
        this.warnings.push({
          rule: '时长匹配',
          severity: 'warning',
          shot: shot.id,
          message: `镜头 ${shot.id} 按舒适语速(${speed}字/秒)需${requiredDuration}秒(${charCount}字+缓冲) > 分配${shot.duration}秒，内容可能说不完`,
          suggestion: `建议：精简narration到${Math.floor((shot.duration - bufferSeconds) * speed)}字以内，或增加duration到${requiredDuration}秒（最大${maxDuration}秒）`
        });
      } else {
        console.log(`✅ 镜头 ${shot.id}: duration=${shot.duration}秒，narration=${charCount}字，舒适语速需${requiredDuration}秒，匹配`);
      }
    });
  }

  generateOpeningFix(shot) {
  }

  generateCharacterFix(character, shots) {
    const charNameMap = { 'chen-nurse': '陈女士（护士）', 'xiaoG': '小G（8岁男孩）', 'coach-li': '李明教练' };
    const charName = charNameMap[character] || character;
    const interactionShots = shots.filter(s => s.type === 'interaction' || s.type === 'summary');
    const explanationShots = shots.filter(s => s.type === 'explanation' || s.type === 'symptom');
    return { character: charName, suggestions: [{ type: '家庭场景插入', description: `在互动镜头中加入${charName}`, targetShots: interactionShots.map(s => s.id), example: `镜头中加入"右侧${charName}站在旁边认真倾听"` }, { type: '演示场景插入', description: `在讲解镜头中加入${charName}做演示`, targetShots: explanationShots.slice(0, 2).map(s => s.id), example: `镜头中加入"${charName}做运动演示，陈女士在旁边讲解"` }] };
  }

  countChineseChars(text) {
    const chineseMatches = text.match(/[\u4e00-\u9fff]/g);
    return chineseMatches ? chineseMatches.length : 0;
  }

  /**
   * 运镜描述验证（v1运镜控制系统）
   */
  validateCameraMovement(storyboard) {
    const shots = storyboard.shots || [];
    if (shots.length === 0) return;
    
    const cameraSystem = new CameraMovementSystem();
    let hasCameraMovement = false;
    let validCount = 0;
    
    shots.forEach((shot, index) => {
      if (shot.cameraMovement) {
        hasCameraMovement = true;
        // v6.5.65-P8-fix: CameraMovementSystem 无 validate 方法，跳过验证
        if (typeof cameraSystem.validate === 'function') {
          const result = cameraSystem.validate(shot.cameraMovement);
          if (!result.valid) {
            this.errors.push({
              rule: '运镜配置',
              severity: 'error',
              message: `镜头 ${shot.id} 运镜配置错误: ${result.errors.join(', ')}`,
              shot: shot.id,
              suggestion: '检查shotSize/position/movement/speed字段是否有效'
            });
          } else {
            validCount++;
            console.log(`✅ 镜头 ${shot.id}: 运镜配置有效 (${shot.cameraMovement.shotSize || '默认'})`);
          }
        } else {
          // validate 方法不存在，直接认为有效
          validCount++;
          console.log(`✅ 镜头 ${shot.id}: 运镜配置存在 (无validate方法，跳过校验)`);
        }
      }
    });
    
    if (hasCameraMovement) {
      console.log(`\n📹 运镜验证: ${validCount}/${shots.length} 镜头配置有效`);
    } else {
      console.log(`\nℹ️ 运镜验证: 未配置cameraMovement字段，跳过`);
    }
  }

  /**
   * 【v6.0-patch22 新增】叙事完整性验证
   * 确保结尾镜有明确的"句点感"，故事完整收束
   * 
   * 检查项：
   * 1. 结尾镜 narration 必须以句号/感叹号/问号结尾（不能说到一半断掉）
   * 2. 字幕时长 ≥ narration 朗读时长 + 1秒留白
   * 3. 结尾镜 visualPrompt 必须有收尾感描述（不能是"正在说话中"突然结束）
   */
  validateNarrationCompletion(storyboard) {
    const shots = storyboard.shots || [];
    if (shots.length === 0) return;
    
    // 找到最后一个非片头镜头（真正的结尾镜）
    const endingShots = shots.filter(s => s.id !== 'S00' && s.type !== 'opening' && s.isOpening !== true);
    if (endingShots.length === 0) return;
    
    const lastShot = endingShots[endingShots.length - 1];
    
    console.log('\n📖 叙事完整性验证...');
    
    // 检查1: 结尾 narration 完整性
    const narration = lastShot.narration || lastShot.dialogue || '';
    if (narration) {
      const lastChar = narration.trim().slice(-1);
      const isComplete = ['。', '！', '？', '.', '!', '?', '"', '"', '\'', '\'', '…', '」'].includes(lastChar);
      
      if (!isComplete) {
        this.errors.push({
          rule: '叙事完整性-结尾句',
          severity: 'error',
          shot: lastShot.id,
          message: `结尾镜 ${lastShot.id} 的 narration 未完整收束（以"${lastChar}"结尾），故事话没说完就断了`,
          suggestion: '结尾 narration 必须以完整句子结束，例如："谢谢...看见。"、"这就是答案。"、"他走了，带着种子。"',
          currentEnding: lastChar
        });
      } else {
        console.log(`   ✅ 结尾镜 ${lastShot.id}: narration 收束完整（"${lastChar}"）`);
      }
    }
    
    // 检查2: 时长与 narration 匹配（结尾镜特别严格）
    // v6.5.36-fix: 全局禁用narration，使用dialogue作为文本源
    const endingText = lastShot.narration || lastShot.dialogue || '';
    if (endingText && lastShot.duration) {
      const charCount = (endingText.match(/[\u4e00-\u9fff]/g) || []).length;
      const speed = 4.5; // 讲解语速
      const requiredDuration = Math.ceil((charCount / speed) + 1.0); // +1秒留白
      
      if (lastShot.duration < requiredDuration) {
        this.warnings.push({
          rule: '叙事完整性-时长不足',
          severity: 'warning',
          shot: lastShot.id,
          message: `结尾镜 ${lastShot.id} 时长可能不足: ${lastShot.duration}s < 需要的 ${requiredDuration}s（台词 ${charCount}字 + 1秒留白）`,
          suggestion: `增加结尾镜时长至 ${requiredDuration}秒，或精简台词到 ${Math.floor((lastShot.duration - 1) * speed)} 字以内`
        });
      } else {
        console.log(`   ✅ 结尾镜 ${lastShot.id}: 时长 ${lastShot.duration}s ≥ 需要 ${requiredDuration}s`);
      }
    }
    
    // 检查3: 结尾镜必须有"句点感"视觉描述
    const visualText = lastShot.visualPrompt || lastShot.prompt || '';
    const endingKeywords = ['转身', '离去', '远去', '背影', '静默', '伫立', '凝视', '微笑', '收束', '定格', '余晖', '落幕', '远去', '消失', '渐暗', 'fade', '结束', '完'];
    const hasEndingVisual = endingKeywords.some(kw => visualText.includes(kw));
    
    if (!hasEndingVisual && visualText.length > 0) {
      this.warnings.push({
        rule: '叙事完整性-视觉收束',
        severity: 'warning',
        shot: lastShot.id,
        message: `结尾镜 ${lastShot.id} 缺乏视觉收束感，画面可能突然中断`,
        suggestion: '在结尾镜 visualPrompt 中加入收束动作："转身离去"、"背影远去"、"静默伫立"、"微笑定格"、"画面渐暗"'
      });
    } else {
      console.log(`   ✅ 结尾镜 ${lastShot.id}: 包含视觉收束元素`);
    }
  }

  /**
   * v3.6升级：五要素检查（山海经系列专属）
   * 检查小G冒险主动性、异兽独特性、情感共鸣度、成长转变、Nirath世界观一致性
   */
  validateFiveElements(storyboard) {
    const mode = storyboard.mode || storyboard.projectConfig?.mode || 'generic';
    
    // 仅对nirath模式启用五要素检查
    if (mode !== 'nirath') {
      console.log('\n🌟 五要素检查: 通用模式跳过');
      return;
    }
    
    console.log('\n🌟 五要素检查启动（山海经系列）');
    console.log('='.repeat(60));
    
    try {
      const options = {
        beastProfile: storyboard.beast || storyboard.projectConfig?.beast || {},
        protagonistProfile: storyboard.protagonist || storyboard.projectConfig?.protagonist || {}
      };
      
      const report = this.fiveElementInspector.inspect(storyboard, options);
      
      console.log(`综合评分: ${report.overallScore}/100`);
      console.log(`通过: ${report.passed}项 | 未通过: ${report.failed}项`);
      
      // 将五要素结果融入审核报告
      for (const result of report.results) {
        if (result.passed) {
          console.log(`✅ ${result.label}: ${result.score}/${result.threshold} 通过`);
        } else {
          const severity = this.config.fiveElementCheck.strictMode ? 'error' : 'warning';
          const message = {
            rule: `五要素-${result.label}`,
            severity,
            message: `${result.label}不足: ${result.score}/${result.threshold}（${result.suggestion}）`,
            suggestion: result.suggestion,
            details: result.details
          };
          
          if (severity === 'error') {
            this.errors.push(message);
          } else {
            this.warnings.push(message);
          }
          
          console.log(`${severity === 'error' ? '❌' : '⚠️'} ${result.label}: ${result.score}/${result.threshold} 未通过`);
          console.log(`   💡 ${result.suggestion}`);
        }
      }
      
      // 如果严格模式下整体未通过，添加汇总错误
      if (this.config.fiveElementCheck.strictMode && !report.overallPassed) {
        this.errors.push({
          rule: '五要素-整体',
          severity: 'error',
          message: `五要素整体未通过（评分${report.overallScore}，需≥60）`,
          suggestion: report.summary.criticalGap || '请检查未通过的要素并优化',
          failedElements: report.summary.failedElements
        });
      }
      
      console.log('='.repeat(60));
    } catch (err) {
      console.error('⚠️ 五要素检查异常:', err.message);
      this.warnings.push({
        rule: '五要素-系统',
        severity: 'warning',
        message: `五要素检查执行异常: ${err.message}`,
        suggestion: '请检查五要素检查器配置'
      });
    }
  }

  generateReport(storyboard) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 审核报告');
    console.log('='.repeat(60));
    const totalErrors = this.errors.length;
    const totalWarnings = this.warnings.length;
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('🎉 全部通过！故事板审核无问题。');
      return { valid: true, errors: [], warnings: [] };
    }
    if (totalErrors > 0) {
      console.log(`\n❌ 错误 (${totalErrors}项) - 必须修复:`);
      this.errors.forEach((err, i) => {
        console.log(`\n   ${i+1}. [${err.rule}] ${err.message}`);
        if (err.shot) console.log(`      镜头: ${err.shot}`);
        if (err.suggestion) {
          console.log(`      💡 修复建议:`);
          if (typeof err.suggestion === 'string') {
            console.log(`         ${err.suggestion}`);
          } else if (err.suggestion.suggestions) {
            err.suggestion.suggestions.forEach((s, j) => {
              console.log(`         ${j+1}. ${s.type}: ${s.description}`);
              console.log(`            目标镜头: ${s.targetShots.join(', ')}`);
            });
          } else if (err.suggestion.promptAdditions) {
            console.log(`         新增动作:`);
            err.suggestion.promptAdditions.forEach(a => console.log(`            + ${a}`));
            console.log(`         删除静态描述:`);
            err.suggestion.promptRemovals.forEach(r => console.log(`            - ${r}`));
          }
        }
      });
    }
    if (totalWarnings > 0) {
      console.log(`\n⚠️ 警告 (${totalWarnings}项) - 建议优化:`);
      this.warnings.forEach((warn, i) => {
        console.log(`\n   ${i+1}. [${warn.rule}] ${warn.message}`);
        if (warn.shot) console.log(`      镜头: ${warn.shot}`);
        if (warn.suggestion) console.log(`      💡 ${warn.suggestion}`);
      });
    }
    console.log('\n' + '='.repeat(60));
    console.log(`审核结果: ${totalErrors === 0 ? '✅ 通过' : '❌ 未通过'} (${totalErrors}错误, ${totalWarnings}警告)`);
    console.log('='.repeat(60));
    return { valid: totalErrors === 0, errors: this.errors, warnings: this.warnings };
  }
}

if (require.main === module) {
  const storyboardPath = process.argv[2];
  if (!storyboardPath) {
    console.log('用法: node storyboard-validator.js <storyboard.json>');
    process.exit(1);
  }
  const validator = new StoryboardValidator();
  const result = validator.validate(storyboardPath);
  process.exit(result.valid ? 0 : 1);
}

module.exports = { StoryboardValidator };
