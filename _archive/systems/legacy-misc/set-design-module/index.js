/**
 * Set Design Module v1.0 — 美术布景设计模块主入口
 * 5Agent流水线：场景解码 → 舞台美术 → 质感工程 → 生态布景 → 提示词融合
 * @module set-design-module
 */

const { SceneDecoder } = require('./agents/scene-decoder');
const { StageArtDirector } = require('./agents/stage-art-director');
const { TextureEngineer } = require('./agents/texture-engineer');
const { EcologicalSetDresser } = require('./agents/ecological-set-dresser');
const { PromptSynthesizer } = require('./agents/prompt-synthesizer');

class SetDesignModule {
  constructor(options = {}) {
    this.sceneDecoder = new SceneDecoder();
    this.stageArtDirector = new StageArtDirector();
    this.textureEngineer = new TextureEngineer();
    this.ecologicalSetDresser = new EcologicalSetDresser();
    this.promptSynthesizer = new PromptSynthesizer();
    
    this.options = {
      defaultBudget: 220,
      debug: options.debug || false,
      ...options
    };
  }

  /**
   * 主入口：为单个镜头设计布景
   * @param {Object} shot - 镜头对象（需含 scene, type, shotSize, cameraMovement 等）
   * @param {Object} context - 上下文（nirathAnchor, promptBudget 等）
   * @returns {Object} { environmentPrompt, mergedVisualPrompt, compressionLevel, designMetadata }
   */
  async design(shot, context = {}) {
    const { nirathAnchor, promptBudget } = context;
    const budget = promptBudget || this.options.defaultBudget;
    
    // ===== Agent 1: Scene Decoder =====
    const decoded = this.sceneDecoder.decode(shot);
    const { scenicTemplate, templateParams, confidence } = decoded;
    
    if (this.options.debug) {
      console.log(`[SetDesign] Agent1解码: ${scenicTemplate.bibleScene} | 置信度:${confidence} | 类型:${templateParams.scale}`);
    }
    
    // ===== Agent 2: Stage Art Director =====
    const composition = this.stageArtDirector.designComposition(
      scenicTemplate,
      templateParams,
      shot.cameraMovement,
      shot.shotSize || 'medium'
    );
    
    if (this.options.debug) {
      console.log(`[SetDesign] Agent2构图: 视线路径:${composition.compositionNotes.eyePath}`);
    }
    
    // ===== Agent 3: Texture Engineer =====
    const materialSpecs = this.textureEngineer.assignMaterials(
      composition.depthLayers,
      scenicTemplate.materialPalette,
      templateParams.energyState === 'active' ? 'bioluminescent' : 'aurelius_dominant'
    );
    
    if (this.options.debug) {
      console.log(`[SetDesign] Agent3材质: ${Object.keys(materialSpecs).filter(k => materialSpecs[k]).length}层`);
    }
    
    // ===== Agent 4: Ecological Set Dresser =====
    // v6.2-patch103-fix: 传入 scenicTemplate，让生态布景使用模板中的 ecologyRules
    const ecologyDetails = this.ecologicalSetDresser.dress(
      this._getTemplateKey(scenicTemplate),
      templateParams,
      composition.depthLayers,
      scenicTemplate
    );
    
    if (this.options.debug) {
      console.log(`[SetDesign] Agent4生态: ${ecologyDetails.length}条细节`);
    }
    
    // ===== Agent 5: Prompt Synthesizer =====
    const designData = {
      scenicTemplate,
      templateParams,
      depthLayers: composition.depthLayers,
      materialSpecs,
      ecologyDetails
    };
    
    const synthesis = this.promptSynthesizer.synthesize(
      designData,
      shot.visualPrompt,
      budget
    );
    
    if (this.options.debug) {
      console.log(`[SetDesign] Agent5融合: 级别:${synthesis.compressionLevel} | 环境:${synthesis.environmentPrompt.length}字 | 合并后:${synthesis.mergedLength}字`);
    }
    
    // 返回完整结果
    return {
      environmentPrompt: synthesis.environmentPrompt,
      mergedVisualPrompt: synthesis.mergedVisualPrompt,
      compressionLevel: synthesis.compressionLevel,
      designMetadata: {
        template: scenicTemplate.bibleScene,
        confidence,
        templateParams,
        depthLayers: composition.depthLayers,
        ecologyCount: ecologyDetails.length,
        materialLayers: Object.keys(materialSpecs).filter(k => materialSpecs[k]),
        originalLength: synthesis.originalLength,
        mergedLength: synthesis.mergedLength
      }
    };
  }

  /**
   * 批量设计（用于整个故事板）
   * @param {Array} shots - 镜头数组
   * @param {Object} context - 全局上下文
   * @returns {Array} 每个镜头的 designResult
   */
  async designBatch(shots, context = {}) {
    const results = [];
    
    for (const shot of shots) {
      try {
        const result = await this.design(shot, context);
        results.push({ shotId: shot.id, ...result });
      } catch (e) {
        console.error(`[SetDesign] ${shot.id} 布景设计失败:`, e.message);
        results.push({
          shotId: shot.id,
          environmentPrompt: '',
          mergedVisualPrompt: shot.visualPrompt,
          compressionLevel: 'error',
          designMetadata: { error: e.message }
        });
      }
    }
    
    return results;
  }

  _getTemplateKey(scenicTemplate) {
    // 反向查找模板键
    const { SCENIC_TEMPLATES } = require('./scenic-templates');
    for (const [key, template] of Object.entries(SCENIC_TEMPLATES)) {
      if (template.bibleScene === scenicTemplate.bibleScene) {
        return key;
      }
    }
    return 'primordial_spine';
  }
}

module.exports = { SetDesignModule };
