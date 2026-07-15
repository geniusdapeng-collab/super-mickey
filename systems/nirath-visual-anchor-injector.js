/**
 * 【系统级 v6.0-patch22】Nirath 视觉锚点注入器
 * 
 * 职责：
 * - 每镜 Prompt 强制注入 ≥2 个肉眼可见的 Nirath 特征
 * - 不是"背景描写"，是"前景视觉元素"
 * - 与 Seedance 渲染 Prompt 直接集成
 * 
 * Nirath 视觉锚点库（12个核心特征）：
 * 1. 双恒星 Aurelius（5800K 暖金）+ Silvana（6500K 银白）
 * 2. 低重力 0.82G — 漂浮尘埃、缓慢飘落、轻盈悬浮
 * 3. 3.2 Tesla 磁场 — 磁光、极光弧、淡蓝紫色光环
 * 4. 以太孢子 1200/cm³ — 荧光孢子云、发光微粒、呼吸般脉动
 * 5. 大气折射率 1.00045 — 光线弯折、远景扭曲、海市蜃楼
 * 6. 钩吾山地貌 — 多铜玉、磁铁矿丰富、地质纹理
 * 7. 生物荧光 — 植物/微生物发光、冷色调荧光
 * 8. 光河/光幕 — 能量河流、发光帷幕
 * 9. 磁场共鸣 — 物体表面微光共振、金属发光
 * 10. 双色太阳光晕 — 天空双色渐变、金橙+冷白交织
 * 11. 低重力尘埃带 — 地面扬起尘埃缓慢漂浮、形成光柱
 * 12. 孢子云团 — 聚集的荧光孢子形成云雾状发光团块
 */

class NirathVisualAnchorInjector {
  constructor(options = {}) {
    this.config = {
      minAnchorsPerShot: 2,    // 每镜最少锚点数量
      maxAnchorsPerShot: 4,    // 每镜最多锚点数量（避免过载）
      injectPosition: 'environment', // 'environment' | 'lighting' | 'foreground'
      ...options
    };
    
    // Nirath 核心视觉锚点（带视觉描述模板）
    this.anchorLibrary = {
      'dual_sun': {
        name: '双恒星',
        templates: [
          '5800K暖金色的Aurelius恒星与6500K银白色的Silvana双星高挂天际，双色光晕在天空中交织成金橙与冷白的渐变光带',
          '天空中Aurelius与Silvana双恒星同时照耀，投射出温暖金色与清冷银白的双重光影',
          '地平线附近Silvana的银白光与Aurelius的金橙光在天穹交汇，形成罕见的双色日光弧'
        ],
        category: 'lighting',
        visibility: 'high' // high = 肉眼极易识别
      },
      'low_gravity': {
        name: '低重力',
        templates: [
          '低重力0.82G环境中，细小尘埃与孢子微粒轻盈漂浮在空中，缓慢地上下起落如同水下',
          '地面扬起的铜玉粉尘在低重力下形成垂直的光柱，缓缓飘散而非快速坠落',
          '空气中悬浮的磁铁矿微粒在双色阳光下闪烁，因低重力而久久不落'
        ],
        category: 'environment',
        visibility: 'high'
      },
      'magnetic_field': {
        name: '磁场',
        templates: [
          '3.2 Tesla强磁场在空气中形成淡蓝紫色的极光弧，如同透明的光幕轻轻飘动',
          '磁场共鸣在金属表面产生微光共振，铜玉岩石发出幽蓝的电磁辉光',
          '天空中磁场线与双恒星光线交织，形成网格状的光纹在天穹缓慢流动'
        ],
        category: 'lighting',
        visibility: 'high'
      },
      'spores': {
        name: '以太孢子',
        templates: [
          '空气中1200每立方厘米的荧光孢子云缓缓漂浮，发出淡绿色和幽蓝色的呼吸般脉动光芒',
          '孢子微粒聚集成发光的云雾团块，如同活着的光团在画面中漂浮移动',
          '呼吸间可见的孢子云在口鼻附近形成微弱的发光漩涡，荧光绿与幽蓝交替明灭'
        ],
        category: 'foreground',
        visibility: 'high'
      },
      'terrain': {
        name: '钩吾山地貌',
        templates: [
          '钩吾山独特的铜玉地质纹理在光线照射下呈现金属般的光泽，磁铁矿脉如暗红色血管镶嵌其中',
          '地面铺满多铜玉碎石，在双恒星照射下反射出金橙与银白的双色反光',
          '远处裂谷边缘的磁铁矿岩壁发出幽微的电磁光芒，地质断层清晰可见'
        ],
        category: 'environment',
        visibility: 'medium'
      },
      'bio_luminescence': {
        name: '生物荧光',
        templates: [
          '地面与岩缝中生长的荧光苔藓和菌类发出冷色调幽蓝光芒，与暖金日光形成冷暖对比',
          '裂谷深处的生物发光带如同流动的光河，荧光植物在阴影中呼吸般明灭',
          '微生物群落在湿润岩壁上形成发光的斑块，如同天然的荧光壁画'
        ],
        category: 'environment',
        visibility: 'medium'
      },
      'light_river': {
        name: '光河/光幕',
        templates: [
          '远处能量汇聚形成的发光河流在地平线上流淌，如同液态的光带缓缓流动',
          '天空中淡金色的光幕从双恒星方向垂下，如同极光但更温暖、更稳定',
          '磁场与孢子相互作用形成的光带在空气中蜿蜒，如同发光的丝带'
        ],
        category: 'lighting',
        visibility: 'medium'
      },
      'refraction': {
        name: '大气折射',
        templates: [
          '高折射率大气使远处景物产生轻微扭曲，地平线附近的景物如同透过水晶般弯折',
          '阳光穿过高密度以太大气形成奇特的光弯折效果，远景如同水中倒影般晃动',
          '双恒星的光线在1.00045折射率大气中分离成细微的双影'
        ],
        category: 'environment',
        visibility: 'low'
      }
    };
    
    // 锚点组合策略（不同场景类型推荐组合）
    this.sceneStrategies = {
      'opening': ['dual_sun', 'terrain', 'low_gravity'],           // 开场：建立世界观
      'hook': ['dual_sun', 'spores', 'low_gravity'],               // 钩子：异兽日常
      'deepen': ['magnetic_field', 'spores', 'bio_luminescence'],  // 深入：神秘感
      'crack': ['low_gravity', 'spores', 'magnetic_field'],        // 裂缝：异变感
      'twist': ['dual_sun', 'magnetic_field', 'light_river'],      // 翻转：壮丽感
      'resonance': ['spores', 'bio_luminescence', 'dual_sun'],     // 余韵：温暖+神秘
      'default': ['dual_sun', 'low_gravity', 'spores']             // 默认：全能组合
    };
  }
  
  /**
   * 核心方法：为单个镜头注入 Nirath 视觉锚点
   * @param {String} prompt - 原始 Prompt
   * @param {String} sceneType - 场景类型（hook/deepen/crack/twist/resonance/opening）
   * @param {Object} options - { forceInject: true, existingAnchors: [] }
   * @returns {Object} { prompt: 注入后的Prompt, injectedAnchors: [], wasInjected: true }
   */
  inject(prompt, sceneType = 'default', options = {}) {
    const existingAnchors = this.detectExistingAnchors(prompt);
    
    // 如果已有足够锚点，跳过注入
    if (existingAnchors.length >= this.config.minAnchorsPerShot && !options.forceInject) {
      return {
        prompt,
        injectedAnchors: [],
        wasInjected: false,
        existingAnchors,
        reason: `已有 ${existingAnchors.length} 个Nirath锚点，满足要求`
      };
    }
    
    // 选择需要注入的锚点
    const neededCount = Math.max(0, this.config.minAnchorsPerShot - existingAnchors.length);
    if (neededCount === 0) {
      return {
        prompt,
        injectedAnchors: [],
        wasInjected: false,
        existingAnchors,
        reason: '已有足够锚点'
      };
    }
    
    // 选择锚点类型（避免重复）
    const strategy = this.sceneStrategies[sceneType] || this.sceneStrategies.default;
    const availableTypes = strategy.filter(t => !existingAnchors.some(ea => ea.type === t));
    
    const selectedTypes = availableTypes.slice(0, neededCount);
    // 如果策略不够，从默认策略补充
    if (selectedTypes.length < neededCount) {
      const defaults = this.sceneStrategies.default.filter(t => 
        !existingAnchors.some(ea => ea.type === t) && !selectedTypes.includes(t)
      );
      selectedTypes.push(...defaults.slice(0, neededCount - selectedTypes.length));
    }
    
    // 生成注入文本
    const injectedAnchors = [];
    const injectionParts = [];
    
    for (const type of selectedTypes) {
      const anchor = this.anchorLibrary[type];
      if (!anchor) continue;
      
      // 随机选择一个模板
      const template = anchor.templates[Math.floor(Math.random() * anchor.templates.length)];
      injectionParts.push(template);
      injectedAnchors.push({
        type,
        name: anchor.name,
        text: template,
        category: anchor.category
      });
    }
    
    // 将注入文本插入到 Prompt 的环境/光照描述区域
    // 策略：在 Prompt 的 "环境" 或 "光照" 描述后插入，如果没有则在末尾添加
    const injectedPrompt = this.embedIntoPrompt(prompt, injectionParts);
    
    return {
      prompt: injectedPrompt,
      injectedAnchors,
      wasInjected: true,
      existingAnchors,
      reason: `注入 ${injectedAnchors.length} 个Nirath锚点（类型: ${selectedTypes.join(', ')}）`
    };
  }
  
  /**
   * 批量注入：为故事板所有镜头注入
   * @param {Array} shots - 故事板镜头列表
   * @returns {Array} 注入后的 shots
   */
  injectBatch(shots) {
    return shots.map(shot => {
      const sceneType = shot.beatName || shot.type || 'default';
      const result = this.inject(shot.visualPrompt || shot.prompt || '', sceneType);
      
      return {
        ...shot,
        visualPrompt: result.prompt,
        _nirathAnchors: {
          injected: result.injectedAnchors,
          existing: result.existingAnchors,
          wasInjected: result.wasInjected
        }
      };
    });
  }
  
  /**
   * 检测 Prompt 中已有的 Nirath 锚点
   */
  detectExistingAnchors(prompt) {
    const found = [];
    const text = prompt.toLowerCase();
    
    for (const [type, anchor] of Object.entries(this.anchorLibrary)) {
      // 检查是否包含该锚点的关键词
      const keywords = [
        anchor.name,
        ...anchor.templates[0].split(/[，。、]/).filter(w => w.length >= 2)
      ];
      
      const hasMatch = keywords.some(kw => text.includes(kw.toLowerCase()));
      if (hasMatch) {
        found.push({ type, name: anchor.name });
      }
    }
    
    return found;
  }
  
  /**
   * 将注入文本嵌入 Prompt
   * 策略：尝试在"环境"描述后插入，否则追加到末尾
   */
  embedIntoPrompt(prompt, injectionParts) {
    if (injectionParts.length === 0) return prompt;
    
    const injectionText = injectionParts.join('，');
    
    // 策略1：如果 Prompt 有 "环境" 或 "场景" 描述，在其后插入
    const envMarkers = ['环境下', '场景中', '地貌上', '背景中', '天空下', '地面覆盖'];
    for (const marker of envMarkers) {
      const idx = prompt.indexOf(marker);
      if (idx !== -1) {
        const insertPos = idx + marker.length;
        return prompt.slice(0, insertPos) + '，' + injectionText + prompt.slice(insertPos);
      }
    }
    
    // 策略2：如果 Prompt 有 "光照" 描述，在其后插入
    const lightMarkers = ['光照', '光线', '阳光', '光晕', '照明'];
    for (const marker of lightMarkers) {
      const idx = prompt.indexOf(marker);
      if (idx !== -1) {
        // 找到这个词后面的句号或逗号
        const afterIdx = idx + marker.length;
        const nextPunct = prompt.slice(afterIdx).search(/[，。]/);
        const insertPos = nextPunct !== -1 ? afterIdx + nextPunct + 1 : afterIdx;
        return prompt.slice(0, insertPos) + injectionText + '，' + prompt.slice(insertPos);
      }
    }
    
    // 策略3：追加到末尾（用句号连接）
    const separator = prompt.endsWith('。') ? '' : '。';
    return prompt + separator + injectionText + '。';
  }
  
  /**
   * 验证：检查故事板是否每镜都有足够的 Nirath 锚点
   * 返回验证报告
   */
  validate(shots) {
    const errors = [];
    const warnings = [];
    
    console.log('\n🌍 Nirath 视觉锚点验证...');
    console.log('='.repeat(60));
    
    for (const shot of shots) {
      const prompt = shot.visualPrompt || shot.prompt || '';
      const existing = this.detectExistingAnchors(prompt);
      
      if (existing.length < this.config.minAnchorsPerShot) {
        errors.push({
          shotId: shot.id,
          rule: 'Nirath锚点缺失',
          severity: 'error',
          message: `镜头 ${shot.id} Nirath视觉锚点不足: ${existing.length}个（要求≥${this.config.minAnchorsPerShot}个）`,
          existingAnchors: existing.map(e => e.name),
          suggestion: `使用 NirathVisualAnchorInjector.inject() 自动注入，或手动添加至少2个特征：` +
            `"5800K暖金Aurelius恒星高挂"、"低重力下荧光孢子云漂浮"、"磁场共鸣淡蓝紫极光"`
        });
      } else {
        console.log(`   ✅ ${shot.id}: ${existing.length}个Nirath锚点（${existing.map(e => e.name).join(', ')}）`);
      }
      
      if (existing.length > this.config.maxAnchorsPerShot) {
        warnings.push({
          shotId: shot.id,
          rule: 'Nirath锚点过载',
          severity: 'warning',
          message: `镜头 ${shot.id} Nirath锚点过多: ${existing.length}个（建议≤${this.config.maxAnchorsPerShot}个）`,
          suggestion: '锚点过多可能导致Seedance忽略核心主体，建议保留最显眼的2-3个'
        });
      }
    }
    
    const valid = errors.length === 0;
    console.log(`\n${valid ? '✅' : '❌'} Nirath锚点验证: ${valid ? '通过' : `失败 (${errors.length}错误)`}`);
    console.log('='.repeat(60));
    
    return { valid, errors, warnings };
  }
}

module.exports = { NirathVisualAnchorInjector };
