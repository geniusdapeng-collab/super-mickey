/**
 * MicroMotion 集成适配器 v1.0-Peng
 * 桥接 Seedance Director Pipeline 与 MicroMotion 子系统
 * 接入点: Phase4 批量渲染前，seedance-prompt 生成后
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const MM_PATH = path.join(__dirname, '..', '..', 'seedance-micromotion');
const { MicroMotionSystem } = require(path.join(MM_PATH, 'scripts/micromotion'));

/**
 * 将 Director 的 prompts 格式转换为 MicroMotion 输入格式
 */
function convertDirectorPromptsToMicroMotion(prompts, plan = {}) {
  const shots = prompts.map(({ shot, prompt }) => {
    // 从 shot 中提取 emotion
    const emotion = shot.emotionStart || shot.emotion || '';
    const emotionEnd = shot.emotionEnd || '';
    const finalEmotion = emotionEnd || emotion;
    
    // 从 shot 中提取强度（通过张力/情绪变化推断）
    const tension = shot.tension || 50;
    const intensity = Math.min(5, Math.max(1, Math.ceil(tension / 20)));
    
    // 从 shot 中提取 camera distance
    const camera = shot.camera || '';
    let cameraDistance = 'medium';
    if (camera.includes('特写') || camera.includes('微距')) cameraDistance = '面部特写';
    else if (camera.includes('近景')) cameraDistance = '近景';
    else if (camera.includes('中景')) cameraDistance = '中景';
    else if (camera.includes('全景') || camera.includes('大全景')) cameraDistance = '全景';
    
    return {
      shotId: shot.id,
      character: shot.characters?.[0]?.split('-')[1] || shot.characters?.[0] || '',
      emotion: finalEmotion,
      emotionIntensity: intensity,
      cameraDistance: cameraDistance,
      duration: shot.duration || 5,
      originalPrompt: prompt,
      // 额外字段供 MicroMotion Agent 使用
      mood: shot.mood || '',
      camera: shot.camera || '',
      transition: shot.transitionType || '',
      type: shot.type || ''
    };
  });
  
  return {
    project: plan.title || 'untitled',
    context: {
      sceneType: plan.videoType || 'action',
      style: plan.styleManifesto || '',
      lighting: plan.lightingThreeLayer || ''
    },
    shots: shots
  };
}

/**
 * 将 MicroMotion 增强结果合并回 Director prompts
 */
function mergeMicroMotionBack(prompts, mmResults) {
  const enhancedMap = {};
  for (const result of mmResults) {
    enhancedMap[result.shotId] = result;
  }
  
  return prompts.map(({ shot, prompt, refs }) => {
    const enhanced = enhancedMap[shot.id];
    if (!enhanced) {
      return { shot, prompt, refs };
    }
    
    // 使用增强后的提示词
    const newPrompt = enhanced.enhanced || prompt;
    
    return {
      shot,
      prompt: newPrompt,
      refs,
      _microMotion: {
        original: enhanced.original,
        agents: enhanced.agents,
        specialEffects: enhanced.specialEffects
      }
    };
  });
}

/**
 * 增强 prompts（主入口）
 * @param {Array} prompts - Director 生成的 prompts
 * @param {Object} plan - 故事规划
 * @param {string} productionDir - 生产目录
 * @param {Function} log - 日志函数
 * @returns {Array} 增强后的 prompts
 */
function enhancePromptsWithMicroMotion(prompts, plan, productionDir, logFn = console.log) {
  if (!fss.existsSync(MM_PATH)) {
    logFn('MicroMotion', '⚠️ MicroMotion 未安装，跳过增强', 'warn');
    return prompts;
  }
  
  const log = logFn || (() => {});
  log('MicroMotion', '🎭 开始 MicroMotion 微动作增强...', 'phase');
  
  // 转换格式
  const mmInput = convertDirectorPromptsToMicroMotion(prompts, plan);
  
  // 执行增强
  const mm = new MicroMotionSystem({
    outputDir: path.join(productionDir, '06-micromotion')
  });
  
  const { results } = mm.enhanceBatch(mmInput.shots, mmInput.context);
  
  // 合并回 Director 格式
  const enhanced = mergeMicroMotionBack(prompts, results);
  
  log('MicroMotion', `✅ MicroMotion 增强完成: ${results.length} 个镜头已注入微动作`, 'success');
  
  // 统计增强效果
  let totalAdded = 0;
  for (const r of results) {
    totalAdded += (r.enhanced?.length || 0) - (r.original?.length || 0);
  }
  log('MicroMotion', `📊 平均每个镜头新增 ${Math.round(totalAdded / results.length)} 字符`, 'info');
  
  return enhanced;
}

/**
 * 保存增强报告
 */
function saveMicroMotionReport(enhancedPrompts, productionDir) {
  const reportPath = path.join(productionDir, '06-micromotion', 'integration-report.json');
  const report = {
    version: '1.0-Peng',
    timestamp: new Date().toISOString(),
    totalShots: enhancedPrompts.length,
    enhancedShots: enhancedPrompts.filter(p => p._microMotion).length,
    shots: enhancedPrompts.map(p => ({
      shotId: p.shot.id,
      originalLength: p._microMotion?.original?.length || p.prompt.length,
      enhancedLength: p.prompt.length,
      addedChars: p._microMotion ? (p.prompt.length - p._microMotion.original.length) : 0,
      specialEffects: p._microMotion?.specialEffects || ''
    }))
  };
  
  fss.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

module.exports = {
  enhancePromptsWithMicroMotion,
  saveMicroMotionReport,
  convertDirectorPromptsToMicroMotion,
  mergeMicroMotionBack
};```

## 文件: seedance-director/scripts/pack-code.js
