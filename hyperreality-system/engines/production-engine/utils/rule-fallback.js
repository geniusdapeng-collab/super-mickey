/**
 * 规则降级引擎 (Rule Fallback Engine)
 * 
 * 职责：
 * - LLM 禁用时的规则模式生产路径
 * - LLM 失败时的兜底恢复
 * - 极简 Prompt 拼接
 */

const { FALLBACK_SCENES, FALLBACK_ACTIONS } = require('../../config/neutral-fallbacks');

class RuleFallbackEngine {
  constructor(options = {}) {
    this.log = options.logFn || console.log;
    this.config = options.config || { maxPromptLength: 2000 };
    this.agents = options.agents || {};
    this.llmModel = options.llmModel || 'kimi-k2p6';
  }

  /**
   * 规则模式完整生产路径(LLM 禁用时)
   */
  async produceViaRules(currentShots, adaptedBlueprint, result, startTime) {
    this.log('RULES', '启用规则引擎模式(LLM 已禁用)');
    
    // 这些需要在 ProductionEngine 中执行，这里返回标记让调用方处理
    return {
      mode: 'rules',
      shots: currentShots,
      needsQualityGate: true,
      needsOpening: this._shouldGenerateOpening(adaptedBlueprint),
      needsContinuity: true
    };
  }

  /**
   * 规则 Prompt 工程兜底(LLM PromptFusion 失败时)
   */
  async engineerPromptsFallback(shots, blueprint) {
    if (typeof this._engineerPrompts === 'function') {
      try {
        const r = await this._engineerPrompts(shots, blueprint);
        if (r?.shots?.length) return r.shots;
      } catch (e) {
        this.log('FALLBACK', `_engineerPrompts 失败: ${e.message},使用极简拼接`);
      }
    }
    return shots.map(s => ({
      ...s,
      prompt: this.assemblePromptSimple(s),
      enhanced_prompt: this.assemblePromptSimple(s),
      negative_prompt: 'blurry, low quality, distorted, watermark, text, deformed, extra limbs'
    }));
  }

  /**
   * 极简 Prompt 拼接(最后兜底)
   * 【v2.1.4-fix9-P12】兜底路径也强制写实场景和动作
   */
  assemblePromptSimple(shot) {
    const parts = [];
    
    // 场景强制写实检查
    let sceneDesc = shot.scene || '';
    const sceneForbidden = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    if (sceneForbidden.some(w => sceneDesc.includes(w))) {
      // 【修复 P0-3】领域中立兜底场景：从唯一真源读取
      const fallbackScenes = FALLBACK_SCENES;
      const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
      sceneDesc = fallbackScenes[idx % fallbackScenes.length];
    }
    if (sceneDesc) parts.push(sceneDesc);
    
    if (shot.visual_elements) parts.push(shot.visual_elements);
    if (shot.lighting) parts.push(shot.lighting);
    if (shot.camera_movement) parts.push(shot.camera_movement);
    
    // 动作强制写实检查
    let actionDesc = shot.action || '';
    const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画', '湿版摄影', '黑色电影'];
    if (actionForbidden.some(w => actionDesc.includes(w))) {
      // 【修复 P0-3】领域中立兜底动作：从唯一真源读取
      const fallbackActions = FALLBACK_ACTIONS;
      const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
      actionDesc = fallbackActions[idx % fallbackActions.length];
    }
    if (actionDesc) parts.push(actionDesc);
    
    if (shot.mood) parts.push(`atmosphere: ${shot.mood}`);
    
    // 【P2-9 修复】动态 require 加 try/catch，缺失时用内联默认值
    // 【修复 P0-3】require 路径修正：指向真实存在的全局负面提示词模块
    let globalNegativePromptInjector = null;
    try { globalNegativePromptInjector = require('../../../systems/global-negative-prompts.js').globalNegativePromptInjector; } catch (_) {
      try { globalNegativePromptInjector = require('../../../systems/global-negative-prompts.js'); } catch (__) {
        globalNegativePromptInjector = { generateForOpeningShot: () => 'no text, no watermark, no logo', generateForContentShot: () => 'no text, no watermark, no logo, no blurry' };
      }
    }
    const isOpeningSimple = shot.type === 'opening' || shot.sceneType === 'opening';
    const negativeSimple = isOpeningSimple
      ? globalNegativePromptInjector.generateForOpeningShot({ maxLength: 200 }).replace('【负面约束】', '')
      : globalNegativePromptInjector.generateForContentShot({ maxLength: 250 }).replace('【负面约束】', '');
    parts.push(negativeSimple);
    
    return parts.filter(Boolean).join(', ').slice(0, this.config.maxPromptLength);
  }

  _shouldGenerateOpening(adaptedBlueprint) {
    const _meta = adaptedBlueprint.config?._metadata || adaptedBlueprint._metadata || {};
    return _meta.isSeries ? (_meta.episodeNumber === 1) : (_meta.hasOpening !== false);
  }
}

module.exports = { RuleFallbackEngine };