/**
 * Agent 5: Prompt Synthesizer & Compressor（提示词融合器）
 * 将丰富设计压缩为高密度环境提示词，并与现有visualPrompt智能融合
 * @module agents/prompt-synthesizer
 */

class PromptSynthesizer {
  constructor() {
    this.compressionLevels = {
      full: { maxLength: 220, ecologyBudget: 80, materialBudget: 80, compositionBudget: 60 },
      standard: { maxLength: 150, ecologyBudget: 50, materialBudget: 60, compositionBudget: 40 },
      minimal: { maxLength: 80, ecologyBudget: 30, materialBudget: 30, compositionBudget: 20 }
    };
  }

  /**
   * 合成最终环境提示词
   * @param {Object} designData - 前4个Agent的完整输出
   * @param {string} existingVisualPrompt - 现有visualPrompt
   * @param {number} promptBudget - 剩余字符预算
   * @returns {Object} { environmentPrompt, mergedVisualPrompt, compressionLevel }
   */
  synthesize(designData, existingVisualPrompt, promptBudget) {
    const { scenicTemplate, templateParams, depthLayers, materialSpecs, ecologyDetails } = designData;
    
    // Step 1: 确定压缩级别
    const level = this._determineLevel(promptBudget);
    const budget = this.compressionLevels[level];
    
    // Step 2: 合成环境提示词（分三段：构图+材质+生态）
    const environmentPrompt = this._buildEnvironmentPrompt({
      scenicTemplate,
      templateParams,
      depthLayers,
      materialSpecs,
      ecologyDetails,
      budget
    });
    
    // Step 3: 与现有visualPrompt融合
    const mergedVisualPrompt = this._mergeIntoVisual(existingVisualPrompt, environmentPrompt, promptBudget);
    
    return {
      environmentPrompt,
      mergedVisualPrompt,
      compressionLevel: level,
      originalLength: existingVisualPrompt?.length || 0,
      mergedLength: mergedVisualPrompt.length
    };
  }

  _determineLevel(promptBudget) {
    if (promptBudget >= 250) return 'full';
    if (promptBudget >= 150) return 'standard';
    return 'minimal';
  }

  _buildEnvironmentPrompt({ scenicTemplate, templateParams, depthLayers, materialSpecs, ecologyDetails, budget }) {
    const parts = [];
    
    // 段1：构图描述（层位）
    const compositionPart = this._buildCompositionPart(depthLayers, budget.compositionBudget);
    if (compositionPart) parts.push(compositionPart);
    
    // 段2：材质描述
    const materialPart = this._buildMaterialPart(materialSpecs, budget.materialBudget);
    if (materialPart) parts.push(materialPart);
    
    // 段3：生态描述
    const ecologyPart = this._buildEcologyPart(ecologyDetails, budget.ecologyBudget);
    if (ecologyPart) parts.push(ecologyPart);
    
    // 合并
    let result = parts.join('。');
    
    // 全局约束追加
    result += '。禁止塑料/CG质感，禁止光秃秃/荒芜/寸草不生';
    
    // 最终裁剪
    if (result.length > budget.maxLength) {
      result = result.substring(0, budget.maxLength - 3) + '...';
    }
    
    return result;
  }

  _buildCompositionPart(depthLayers, maxLength) {
    const layers = ['foreground', 'midground', 'background'];
    const parts = [];
    
    layers.forEach(layer => {
      const desc = depthLayers[layer];
      if (desc && desc !== '无') {
        const prefix = layer === 'foreground' ? '前景' : layer === 'midground' ? '中景' : '远景';
        parts.push(`${prefix}${desc}`);
      }
    });
    
    let result = parts.join('，');
    if (result.length > maxLength) {
      // 仅保留中景
      const mid = depthLayers.midground;
      if (mid) result = `中景${mid}`;
    }
    
    return result;
  }

  _buildMaterialPart(materialSpecs, maxLength) {
    const parts = [];
    
    ['foreground', 'midground', 'background'].forEach(layer => {
      const spec = materialSpecs?.[layer];
      if (spec?.compressed) {
        parts.push(spec.compressed);
      }
    });
    
    let result = parts.join('；');
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    
    return result;
  }

  _buildEcologyPart(ecologyDetails, maxLength) {
    if (!ecologyDetails || ecologyDetails.length === 0) return null;
    
    let result = ecologyDetails.join('；');
    if (result.length > maxLength) {
      // 保留第一条完整
      result = ecologyDetails[0];
    }
    
    return result;
  }

  _mergeIntoVisual(existingVisualPrompt, environmentPrompt, promptBudget) {
    if (!existingVisualPrompt) {
      return `【场景设定】${environmentPrompt}`;
    }
    
    // 策略1：检测并替换通用背景词
    const backgroundPatterns = [
      /背景是[，,]?[^，,。]{0,30}[，,。]?/,
      /周围是[，,]?[^，,。]{0,30}[，,。]?/,
      /场景是[，,]?[^，,。]{0,30}[，,。]?/,
      /环境是[，,]?[^，,。]{0,30}[，,。]?/,
      /在[^，,。]{0,20}[上地]上?[，,。]?/,
      /位于[^，,。]{0,20}[，,。]?/
    ];
    
    let merged = existingVisualPrompt;
    let replaced = false;
    
    for (const pattern of backgroundPatterns) {
      if (pattern.test(merged)) {
        merged = merged.replace(pattern, `【场景设定】${environmentPrompt}，`);
        replaced = true;
        break;
      }
    }
    
    // 策略2：若无通用背景词，在主体描述后追加
    if (!replaced) {
      // 找到第一个句号后的位置，或直接在开头追加
      const firstPeriod = merged.indexOf('。');
      if (firstPeriod > 0 && firstPeriod < merged.length - 1) {
        merged = merged.slice(0, firstPeriod + 1) + `【场景设定】${environmentPrompt}，` + merged.slice(firstPeriod + 1);
      } else {
        merged = `【场景设定】${environmentPrompt}。${merged}`;
      }
    }
    
    // Step 4: 总长度校验
    const totalLength = merged.length;
    if (totalLength > promptBudget + 200) { // 允许200字符弹性
      // 优先裁剪环境提示词而非主体
      const envStart = merged.indexOf('【场景设定】');
      const envEnd = merged.indexOf('，', envStart + 6);
      
      if (envStart >= 0 && envEnd > envStart) {
        const compressedEnv = environmentPrompt.substring(0, 80) + '...';
        merged = merged.slice(0, envStart) + `【场景设定】${compressedEnv}，` + merged.slice(envEnd + 1);
      }
    }
    
    return merged;
  }
}

module.exports = { PromptSynthesizer };
