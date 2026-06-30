/**
 * Set Design Module 集成补丁
 * 插入位置: nirath-master-pipeline.js Stage 10.5
 * 在运镜设计完成后、渲染核心调用前
 */

// ========== 在 nirath-master-pipeline.js 的 require 区域添加 ==========
// const { SetDesignModule } = require('./set-design-module');

// ========== 在 this.modules 初始化区域添加 ==========
// setDesignModule: new SetDesignModule({ debug: false }),

// ========== 在 STAGE-11 渲染核心之前插入 ==========
/*
// Stage 10.5: 美术布景设计（v6.2-patch46新增）
if (this.mode === 'nirath' && this.modules.setDesignModule) {
  const setDesignResult = await this.modules.setDesignModule.design(shot, {
    nirathAnchor: getNirathAnchor(),
    promptBudget: Math.max(150, 1500 - (shot.visualPrompt?.length || 0) - 150) // 预留150给角色+运镜
  });
  
  shot.environmentPrompt = setDesignResult.environmentPrompt;
  shot.visualPrompt = setDesignResult.mergedVisualPrompt;
  
  this.log('STAGE-10.5', `  ✅ 布景设计: ${shot.id} | 模板:${setDesignResult.designMetadata.template} | 环境:${setDesignResult.environmentPrompt.length}字 | 融合后:${setDesignResult.designMetadata.mergedLength}字 | 级别:${setDesignResult.compressionLevel}`);
}
*/

// ========== 在 shot.prompt 赋值后添加校验 ==========
/*
// v6.2-patch46: 校验环境提示词是否注入成功
if (shot.environmentPrompt && shot.prompt) {
  if (!shot.prompt.includes('场景设定') && !shot.prompt.includes(scenicTemplate.bibleScene)) {
    this.log('STAGE-11', `  ⚠️ 环境提示词可能未成功融入Prompt，手动追加`);
    prompt += ` 【场景】${shot.environmentPrompt}`;
  }
}
*/

// ========== 完整集成代码（可直接复制粘贴） ==========
const INTEGRATION_CODE = `
      // ========== v6.2-patch46: Stage 10.5 美术布景设计 ==========
      if (this.mode === 'nirath' && this.modules.setDesignModule) {
        try {
          const setDesignResult = await this.modules.setDesignModule.design(shot, {
            nirathAnchor: getNirathAnchor(),
            promptBudget: Math.max(150, 1500 - (shot.visualPrompt?.length || 0) - 150)
          });
          
          shot.environmentPrompt = setDesignResult.environmentPrompt;
          shot.visualPrompt = setDesignResult.mergedVisualPrompt;
          
          this.log('STAGE-10.5', \`  ✅ 布景设计: \${shot.id} | 模板:\${setDesignResult.designMetadata.template} | 环境:\${setDesignResult.environmentPrompt.length}字 | 融合后:\${setDesignResult.designMetadata.mergedLength}字 | 级别:\${setDesignResult.compressionLevel}\`);
        } catch (e) {
          this.log('STAGE-10.5', \`  ⚠️ 布景设计失败: \${shot.id} - \${e.message}\`);
        }
      }
`;

module.exports = { INTEGRATION_CODE };
