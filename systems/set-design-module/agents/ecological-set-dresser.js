/**
 * Agent 4: Ecological Set Dresser（生态布景师）
 * 注入"生机勃勃"的生命细节，禁止光秃秃
 * @module agents/ecological-set-dresser
 */

class EcologicalSetDresser {
  constructor() {
    // 生态细节库：按场景类型分类
    // v6.2-patch103-fix: 删除通用固定模板，改为场景特定差异化描述
    // 根因：universal 通用模板导致所有场景生态一模一样（发光毯+六足生物）
    this.ecologyDetails = {
      // 通用基础：只保留最基础的可复用元素，不定义具体生物形态
      universal: [
        '孢子群随磁场脉冲形成短暂光云',
        '岩石缝隙中发光植物随光照变色'
      ],
      volcanic_ridge: [
        '耐高温孢子蕨从岩缝喷出，孢子囊呈暗红色金属光泽',
        '岩浆通道上方热扰动使孢子轨迹呈螺旋上升',
        '磁性铁细菌在热液出口形成彩色菌毯'
      ],
      spore_forest: [
        '孢子群漂浮密度1200/cm³，形成可呼吸的金色雾霭',
        '荧光苔藓地毯踩踏产生绿色荧光涟漪扩散',
        '微小气游生物穿梭孢子间，留下光轨'
      ],
      abyssal_luminara: [
        '深海生物荧光群呈集群脉动，如海底星空',
        '压力气泡缓慢上升破裂，释放微型发光生物',
        '底栖发光毯覆盖海床，随水流波动明暗'
      ],
      magnetic_bog: [
        '厌氧发光菌群发出幽绿脉冲光，照亮沼泽局部',
        '磁悬浮液态汞珠群中寄生微小生物，呈银绿闪烁',
        '磁化淤泥表面形成几何波纹，菌群沿波纹生长'
      ],
      eternal_dawn: [
        '光敏孢子随光照强度爆发释放，呈金色喷泉状',
        '耐热藤蔓缠绕焦木生长，叶片呈暗红半透明',
        '焦木裂纹中渗出硅化物，形成微型水晶洞'
      ],
      floating_archipelago: [
        '悬浮植物岛独立生态系统，岛屿间孢子桥连接',
        '空游生物群在岛间穿梭，形成光带轨迹',
        '瀑布水滴反重力上升，表面寄生发光藻类'
      ],
      ancient_ruins: [
        '侵略性共生植物侵蚀遗迹表面，根系与岩石相互替代',
        '磁性尘埃在遗迹间形成漩涡，微小生物在其中筑巢',
        '遗迹几何缝隙中生长出几何排列的晶体植物'
      ],
      misty_archipelago: [
        '雾滴中发光水母状生物漂浮，触须捕捉孢子',
        '海市蜃楼产生多重岛屿虚像，虚像中也有生物活动',
        '雾中声波通道可见为波纹，惊扰生物群产生荧光爆发'
      ],
      energy_nexus: [
        '能量寄生植物在灼烧痕中生长，发出低强度幽光',
        '离子风使孢子定向飘移形成光带',
        '磁场线在几何顶点汇聚，吸引生物群聚集发光'
      ],
      primordial_spine: [
        '原始单细胞发光毯覆盖地表，随磁场脉动明暗',
        '地质活跃区热液喷口周围形成彩色菌环',
        '矿物结晶生长过程缓慢可见，表面附着发光微生物'
      ]
    };
    
    // 生态密度配置
    this.densityConfig = {
      high: { count: 3, prefix: '生态极度丰富：' },
      normal: { count: 2, prefix: '生态活跃：' },
      focused: { count: 1, prefix: '局部生态：' },
      low: { count: 1, prefix: '' }
    };
  }

  /**
   * 为场景注入生态细节
   * @param {string} templateKey - 场景模板键
   * @param {Object} templateParams - 模板参数（含ecologyDensity）
   * @param {Object} depthLayers - 层描述（用于判断在哪层添加生态）
   * @param {Object} scenicTemplate - 完整场景模板（含 ecologyRules）
   * @returns {Array} ecologyDetails 生态描述数组
   */
  dress(templateKey, templateParams, depthLayers, scenicTemplate = null) {
    const density = templateParams.ecologyDensity || 'normal';
    const config = this.densityConfig[density] || this.densityConfig.normal;
    
    // 收集候选生态细节
    const candidates = [];
    
    // 通用基础（只保留最基础的可复用元素）
    candidates.push(...this.ecologyDetails.universal);
    
    // 场景特定细节（优先使用 scenicTemplate 中的 ecologyRules）
    // v6.2-patch103-fix: 优先使用 scenic-templates.js 中的 ecologyRules
    if (scenicTemplate && scenicTemplate.ecologyRules && scenicTemplate.ecologyRules.length > 0) {
      candidates.push(...scenicTemplate.ecologyRules);
    } else {
      // 回退到 ecological-set-dresser 的 ecologyDetails
      const specific = this.ecologyDetails[templateKey];
      if (specific) {
        candidates.push(...specific);
      }
    }
    
    // 去重：避免 ecologyRules 与 ecologyDetails 重复
    const uniqueCandidates = [...new Set(candidates)];
    
    // 随机选择（但确保结果可复现，使用模板参数作为种子逻辑）
    const selected = this._selectByParams(uniqueCandidates, config.count, templateParams);
    
    // 添加前缀
    if (config.prefix) {
      selected[0] = config.prefix + selected[0];
    }
    
    return selected;
  }

  /**
   * 将生态细节分配到具体层位
   */
  assignToLayers(ecologyDetails, depthLayers) {
    const layerAssignment = {};
    
    ecologyDetails.forEach((detail, index) => {
      // 根据细节内容判断所属层
      if (detail.includes('地表') || detail.includes('地面') || detail.includes('苔藓')) {
        layerAssignment[index] = 'foreground';
      } else if (detail.includes('岩壁') || detail.includes('遗迹') || detail.includes('森林')) {
        layerAssignment[index] = 'midground';
      } else if (detail.includes('天空') || detail.includes('雾') || detail.includes('孢子群')) {
        layerAssignment[index] = 'sky';
      } else {
        // 默认分配到中景
        layerAssignment[index] = 'midground';
      }
    });
    
    return layerAssignment;
  }

  _selectByParams(candidates, count, params) {
    // 简单选择：根据参数哈希选择，确保同一镜头多次调用结果一致
    const seed = JSON.stringify(params).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const selected = [];
    
    for (let i = 0; i < count && i < candidates.length; i++) {
      const index = (seed + i * 7) % candidates.length;
      selected.push(candidates[index]);
    }
    
    return selected;
  }

  /**
   * 压缩生态细节到指定长度
   */
  compress(ecologyDetails, maxLength = 80) {
    const joined = ecologyDetails.join('；');
    
    if (joined.length <= maxLength) {
      return joined;
    }
    
    // 裁剪：保留第一条完整，第二条压缩
    if (ecologyDetails.length >= 2) {
      const first = ecologyDetails[0];
      const second = ecologyDetails[1];
      
      let result = first;
      const remaining = maxLength - first.length - 1;
      
      if (remaining > 10) {
        result += '；' + second.substring(0, remaining);
      }
      
      return result;
    }
    
    return joined.substring(0, maxLength - 3) + '...';
  }
}

module.exports = { EcologicalSetDresser };
