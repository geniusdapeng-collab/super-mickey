/**
 * Agent 2: Stage Art Director（舞台美术师）
 * 设计镜头画面的空间层次与构图
 * @module agents/stage-art-director
 */

class StageArtDirector {
  constructor() {
    this.compositionRules = {
      extreme_wide: {
        foreground: '必含：角色脚下的局部纹理或小型生态元素，建立尺度感',
        midground: '必含：主体建筑/地貌/异兽，占画面50%',
        background: '必含：远景山脉/天空/大气效果，建立深度',
        sky: '必含：双恒星或磁场极光，建立星球身份',
        depthRatio: [15, 50, 25, 10] // fg:mg:bg:sky
      },
      wide: {
        foreground: '可含：局部植被或岩石，引导视线',
        midground: '必含：主体，占画面60%',
        background: '必含：环境特征地貌',
        sky: '可含：局部光效',
        depthRatio: [10, 60, 20, 10]
      },
      medium: {
        foreground: '虚化或局部道具',
        midground: '必含：主体互动，占画面70%',
        background: '可含：环境氛围色彩',
        sky: '极少或虚化',
        depthRatio: [5, 70, 20, 5]
      },
      close_up: {
        foreground: '主体面部/局部，占画面80%',
        midground: '虚化背景色块',
        background: '仅色彩氛围',
        sky: '无',
        depthRatio: [80, 15, 5, 0]
      },
      extreme_close: {
        foreground: '微观纹理，占画面95%',
        midground: '边缘虚化',
        background: '无',
        sky: '无',
        depthRatio: [95, 5, 0, 0]
      }
    };
  }

  /**
   * 设计镜头构图
   * @param {Object} scenicTemplate - 场景模板
   * @param {Object} templateParams - 模板参数
   * @param {Object} cameraMovement - 运镜信息
   * @param {string} shotSize - 景别
   * @returns {Object} depthLayers + compositionNotes
   */
  designComposition(scenicTemplate, templateParams, cameraMovement, shotSize) {
    const rules = this.compositionRules[shotSize] || this.compositionRules.medium;
    const templateDefaults = scenicTemplate.depthDefault || {};
    
    // 根据模板参数调整默认层描述
    const depthLayers = {
      foreground: this._adaptLayer(templateDefaults.foreground, rules.foreground, templateParams, 'foreground'),
      midground: this._adaptLayer(templateDefaults.midground, rules.midground, templateParams, 'midground'),
      background: this._adaptLayer(templateDefaults.background, rules.background, templateParams, 'background'),
      sky: this._adaptLayer(templateDefaults.sky, rules.sky, templateParams, 'sky')
    };
    
    // 运镜影响构图
    const movementNotes = this._applyMovement(cameraMovement, depthLayers);
    
    // 生成构图注释
    const compositionNotes = {
      depthRatio: rules.depthRatio,
      eyePath: this._deriveEyePath(depthLayers, cameraMovement),
      movementNotes,
      scaleReference: templateParams.scale === 'massive' ? '以微小生物群建立异兽/地貌的尺度对比' : null
    };
    
    return { depthLayers, compositionNotes };
  }

  _adaptLayer(defaultDesc, ruleDesc, params, layerName) {
    if (!defaultDesc) return ruleDesc;
    
    let result = defaultDesc;
    
    // 根据生态密度调整
    if (params.ecologyDensity === 'high' && layerName !== 'sky') {
      result = result.replace(/。$/, '，生物群落密度极高，多层次生态交叠。');
    } else if (params.ecologyDensity === 'focused' && layerName === 'foreground') {
      result = result.replace(/。$/, '，局部生态细节被放大至微观尺度。');
    }
    
    // 根据能量状态调整
    if (params.energyState === 'active' && (layerName === 'midground' || layerName === 'background')) {
      result = result.replace(/。$/, '，能量活跃导致局部光效脉动。');
    }
    
    return result;
  }

  _applyMovement(cameraMovement, depthLayers) {
    if (!cameraMovement) return null;
    
    const movement = cameraMovement.description || cameraMovement.movement || '';
    const notes = [];
    
    if (movement.includes('推进') || movement.includes('push')) {
      notes.push('推进运镜：前景元素快速放大掠过，中景主体渐进清晰，背景保持氛围');
    }
    if (movement.includes('拉远') || movement.includes('pull')) {
      notes.push('拉远运镜：前景元素退出画面，更多背景环境逐渐 reveal');
    }
    if (movement.includes('环绕') || movement.includes('orbit')) {
      notes.push('环绕运镜：各层元素相对位移不同，产生视差深度');
    }
    if (movement.includes('升') || movement.includes('raise')) {
      notes.push('升镜：天空层占比增加，地面层减少');
    }
    if (movement.includes('降') || movement.includes('lower')) {
      notes.push('降镜：前景层占比增加，天空层减少');
    }
    
    return notes.length > 0 ? notes.join('；') : null;
  }

  _deriveEyePath(depthLayers, cameraMovement) {
    // 默认视线路径：从前景引导到中景主体
    let path = '前景细节 → 中景主体';
    
    if (depthLayers.background && depthLayers.background !== '无') {
      path += ' → 背景氛围';
    }
    if (depthLayers.sky && depthLayers.sky !== '无') {
      path += ' → 天空光效（收尾）';
    }
    
    return path;
  }
}

module.exports = { StageArtDirector };
