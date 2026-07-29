'use strict';

/**
 * ProductPortraitBranch — 商品定妆照分支链路（独立分支模块）
 * ------------------------------------------------------------
 * 商品定妆照与角色定妆照的根本差异：商品必须"真实"，
 * 禁止凭空生成外观（虚构商品是营销片翻车头号原因）。
 * 因此商品链路是一个三段式分支，强制从真实参考图出发：
 *
 *   阶段1 reference-search  联网搜索商品真实参考图
 *      - 构建搜索任务（商品名+类目+官方/实拍关键词）
 *      - api 模式：由外部搜索服务执行并返回图片 URL 列表
 *      - spec 模式：产出搜索任务清单，由执行方（Agent/人工）
 *        完成搜索并将参考图回填 manifest
 *
 *   阶段2 processing        参考图标准化处理管线
 *      - 抠图（主体分离，去除原始背景）
 *      - 白底替换（电商级纯白底基准图）
 *      - 光影统一（匹配短片视觉系统的光位/色温/对比度）
 *      - spec 模式产出逐步处理指令；api 模式接图像处理服务
 *
 *   阶段3 stylization       风格化定妆照生成
 *      - 以处理后的白底基准图为参考图（reference binding）
 *      - 按商品 5 视角包生成最终定妆照
 *      - 全程注入短片视觉系统锚点，保证与镜头提示词风格统一
 */

const { getProductViewPackage } = require('./angle-catalog');

// 参考图质量门槛：低于该数量的商品标记 needsMoreReference
const MIN_REFERENCE_IMAGES = 2;

class ProductPortraitBranch {
  /**
   * @param {Object} options
   * @param {number} options.minReferenceImages 参考图最低数量（默认 2）
   */
  constructor(options = {}) {
    this.minReferenceImages = options.minReferenceImages || MIN_REFERENCE_IMAGES;
  }

  /**
   * 规划全部商品的定妆照任务
   * @param {Object} context
   * @param {Array}  context.products     商品定义数组 [{ id, name, category, sellingPoints, materials }]
   * @param {Object} context.visualStyle  视觉系统锚点
   * @param {Object} context.sceneContext 场景上下文（供"使用场景"视角取景）
   * @returns {Array} 商品定妆照任务数组
   */
  plan(context = {}) {
    const products = this._normalizeProducts(context.products || []);
    if (products.length === 0) return [];

    const visualStyle = context.visualStyle || {};
    const sceneContext = context.sceneContext || {};

    return products.map(p => this._buildProductTask(p, visualStyle, sceneContext));
  }

  // ========== 内部方法 ==========

  _normalizeProducts(products) {
    return products
      .map(p => {
        if (typeof p === 'string') return { id: p, name: p, category: '', sellingPoints: [], materials: [] };
        return {
          id: p.id || p.productId || p.name || '',
          name: p.name || p.id || p.productId || '',
          category: p.category || p.类目 || '',
          sellingPoints: p.sellingPoints || p.卖点 || [],
          materials: p.materials || (p.productHero && p.productHero.materials) || [],
          heroImageId: p.heroImageId || (p.productHero && p.productHero.heroImageId) || null
        };
      })
      .filter(p => p.name);
  }

  _buildProductTask(product, visualStyle, sceneContext) {
    return {
      taskType: 'product',
      productId: product.id,
      productName: product.name,
      heroImageId: product.heroImageId,
      branch: 'product-portrait-branch',
      stages: {
        referenceSearch: this._buildReferenceSearchStage(product),
        processing: this._buildProcessingStage(product, visualStyle),
        stylization: this._buildStylizationStage(product, visualStyle, sceneContext)
      },
      status: 'pending'
    };
  }

  /**
   * 阶段1：联网搜索真实参考图
   */
  _buildReferenceSearchStage(product) {
    const base = product.name;
    const category = product.category || '';
    const queries = [
      `${base} ${category} 官方产品图`.trim(),
      `${base} 实拍 高清`.trim(),
      `${base} 白底图`.trim()
    ];
    return {
      stage: 'reference-search',
      executor: 'external', // spec 模式下由 Agent/人工执行联网搜索
      queries,
      minImages: this.minReferenceImages,
      requirements: [
        '必须为真实商品图，禁止 AI 生成图/概念图/渲染图冒充',
        '优先官方渠道图（官网/旗舰店/官方社媒）',
        '分辨率不低于 800px 短边',
        '覆盖至少两个不同角度',
        // 【v2.8.1】系列化产品型号甄别：检索词必须含目标型号全名，
        // 逐张核对型号标识/发售时间，剔除同系列旧款/近似款
        '系列化产品必须甄别型号版本：检索词含目标型号全名，逐张核对型号标识与发售信息，剔除同系列旧款/近似款'
      ],
      referenceImages: [], // 执行后回填：[{ url, source, angle, localPath }]
      status: 'pending'
    };
  }

  /**
   * 阶段2：参考图标准化处理管线
   */
  _buildProcessingStage(product, visualStyle) {
    return {
      stage: 'processing',
      dependsOn: 'reference-search',
      pipeline: [
        {
          step: 'matting',
          name: '主体抠图',
          instruction: `将${product.name}主体从参考图背景中精确分离，边缘无锯齿无残留，透明底 PNG`
        },
        {
          step: 'white_base',
          name: '白底替换',
          instruction: '替换为纯白背景（#FFFFFF），商品居中，占画面比例 70%-80%，电商基准图规范'
        },
        {
          step: 'lighting_unify',
          name: '光影统一',
          instruction: this._buildLightingInstruction(visualStyle)
        }
      ],
      outputBaseImage: null, // 执行后回填：处理完成的基准图路径
      status: 'pending'
    };
  }

  _buildLightingInstruction(visualStyle) {
    const parts = ['统一光影至短片视觉系统'];
    if (visualStyle.lighting) parts.push(`光位与质感对齐：${visualStyle.lighting}`);
    if (visualStyle.tone) parts.push(`色温色调对齐：${visualStyle.tone}`);
    parts.push('保留商品真实材质反射特性，禁止磨平材质细节');
    return parts.join('；');
  }

  /**
   * 阶段3：风格化定妆照生成（5 视角）
   */
  _buildStylizationStage(product, visualStyle, sceneContext) {
    const views = getProductViewPackage();
    return {
      stage: 'stylization',
      dependsOn: 'processing',
      referenceBinding: 'outputBaseImage', // 强制绑定处理后的基准图，禁止无参考生成
      portraits: views.map(view => ({
        portraitId: `${product.id || product.name}-${view.id}`,
        view: view.id,
        viewName: view.name,
        purpose: view.purpose,
        priority: view.priority,
        prompt: this._buildProductPrompt(product, view, visualStyle, sceneContext),
        status: 'pending',
        outputFile: null
      })),
      status: 'pending'
    };
  }

  _buildProductPrompt(product, view, visualStyle, sceneContext) {
    const materials = product.materials.length ? product.materials.join('、') : '商品真实材质';
    const sections = [
      `【商品定妆照】${product.name} — ${view.name}`,
      `商品：${product.name}${product.category ? `（${product.category}）` : ''}`,
      `材质锚点：${materials}`,
      `构图：${view.framing}`
    ];
    if (view.id === 'in_context' && sceneContext.typicalScene) {
      sections.push(`场景：${sceneContext.typicalScene}`);
    }
    const styleParts = [];
    if (visualStyle.renderStyle) styleParts.push(visualStyle.renderStyle);
    if (visualStyle.tone) styleParts.push(`色调：${visualStyle.tone}`);
    if (visualStyle.lighting) styleParts.push(`光影：${visualStyle.lighting}`);
    if (styleParts.length) sections.push(`视觉系统：${styleParts.join('，')}`);
    sections.push('约束：以处理后的白底基准图为唯一外观参考，商品外观/LOGO/配色 100% 忠于实物，禁止虚构细节，商业摄影级品质');
    return sections.join('\n');
  }
}

module.exports = { ProductPortraitBranch, MIN_REFERENCE_IMAGES };
