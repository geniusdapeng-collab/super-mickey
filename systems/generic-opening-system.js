/**
 * 通用片头系统 v2.0 (v6.5.65-P5)
 * 
 * 系统级设计：专业级片头生成系统，支持任意类型视频
 * - 非Nirath专属，支持健康科普、纪录片、广告等所有generic模式
 * - 内置15+种好莱坞级动效模板
 * 
 * 核心特性：
 * 1. 只展示主标题 + 副标题（不展示集数）
 * 2. 15+种专业动效：淡入、滑动、缩放、打字机、光晕、粒子等
 * 3. 三幕结构：钩子→展开→定格
 * 4. 智能选择：根据视频类型自动匹配最佳动效
 */

const path = require('path');

class GenericOpeningSystem {
  constructor(options = {}) {
    this.duration = options.duration || 8;
    this.mode = options.mode || 'generic';
  }

  /**
   * 生成通用片头
   */
  generateOpening(input, storyboard, characters) {
    const world = input.world || {};
    const mainTitle = this._extractMainTitle(input);
    const subTitle = this._extractSubTitle(input);
    const videoType = input.videoType || 'generic';
    
    // 选择最佳动效
    const effect = this._selectEffect(videoType, world);
    
    // 三幕结构
    const hook = this._buildHook(world, characters, effect);
    const reveal = this._buildReveal(mainTitle, subTitle, world, effect);
    const freeze = this._buildFreeze(world, effect);
    
    // 组装Prompt
    const prompt = this._assemblePrompt(hook, reveal, freeze, world, characters, effect, mainTitle, subTitle);
    
    return {
      id: 'S00',
      shotId: 'S00',
      type: 'opening',
      isOpening: true,
      duration: this.duration,
      prompt: prompt,
      length: prompt.length,
      utilization: Math.min(100, Math.round(prompt.length / 1500 * 100)),
      utilizationStatus: prompt.length >= 1400 ? 'ideal' : (prompt.length >= 1000 ? 'good' : 'insufficient'),
      title: {
        main: mainTitle,
        sub: subTitle,
        displayTiming: `T00:${Math.floor(this.duration * 0.25)}-T00:${Math.floor(this.duration * 0.75)}`,
        position: 'center',
        style: effect.fontStyle
      },
      scene: '片头-开场',
      shotType: 'opening',
      mouthAction: '',
      emotionPhase: 'curiosity',
      ratio: '16:9',
      referenceImages: this._extractReferenceImages(characters),
      characters: Object.keys(characters || {}),
      cameraMovement: this._buildCameraMovement(effect),
      effect: effect.name,
      qualityScore: 85
    };
  }

  /**
   * 15+种专业动效模板库
   */
  _getEffectTemplates() {
    return {
      // 1. 优雅淡入 (纪录片/科普)
      'elegant-fade': {
        name: '优雅淡入',
        description: '主标题从虚空中缓缓淡入，副标题随后以0.5秒延迟跟进，如晨雾散去',
        timing: 'T00:25-T00:75',
        fontStyle: '现代人文无衬线体，细字重，字距宽松',
        visual: 'alpha透明度渐变，从0%到100%，ease-in-out曲线，无突兀感',
        mood: '专业、宁静、可信',
        suitableFor: ['documentary', 'educational', 'health']
      },
      
      // 2. 打字机效果 (新闻/严肃)
      'typewriter': {
        name: '打字机显现',
        description: '标题逐字出现，模拟打字机敲击，每字0.08秒，有轻微机械质感',
        timing: 'T00:20-T00:80',
        fontStyle: '等宽衬线体，中等字重，如打字机字体',
        visual: '逐字符alpha显现，带轻微闪烁光标效果，节奏明确',
        mood: '严谨、权威、新闻感',
        suitableFor: ['news', 'documentary', 'investigation']
      },
      
      // 3. 滑动入场 (现代/活力)
      'slide-in': {
        name: '滑动入场',
        description: '主标题从画面下方滑入，副标题从上方滑入，交汇于中心',
        timing: 'T00:20-T00:70',
        fontStyle: '几何无衬线体，粗字重，视觉冲击力强',
        visual: 'Y轴位移+透明度组合，缓动曲线ease-out，有轻微运动模糊',
        mood: '现代、活力、动感',
        suitableFor: ['tech', 'lifestyle', 'commercial']
      },
      
      // 4. 缩放聚焦 (震撼/史诗)
      'zoom-focus': {
        name: '缩放聚焦',
        description: '标题从远处极速拉近，伴随景深变化，从模糊到锐利',
        timing: 'T00:15-T00:60',
        fontStyle: '超粗无衬线体，极字重，占据画面40%',
        visual: 'Z轴缩放+景深同步，从blur(8px)到sharp，0.3秒完成',
        mood: '震撼、宏大、冲击力',
        suitableFor: ['epic', 'cinematic', 'trailer']
      },
      
      // 5. 光晕扩散 (温暖/治愈)
      'glow-expand': {
        name: '光晕扩散',
        description: '标题从中心光点扩散而出，如太阳升起，温暖光晕铺满画面',
        timing: 'T00:25-T00:75',
        fontStyle: '圆润人文体，中等字重，柔和边缘',
        visual: 'radial-gradient光晕从中心扩散，文字从光晕中"凝结"成形',
        mood: '温暖、治愈、亲切',
        suitableFor: ['health', 'family', 'wellness']
      },
      
      // 6. 粒子聚合 (科幻/未来)
      'particle-merge': {
        name: '粒子聚合',
        description: '无数微小光点从画面边缘飞向中心，聚合成标题文字',
        timing: 'T00:20-T00:70',
        fontStyle: '未来感无衬线体，细字重，科技感',
        visual: '粒子系统，100+光点，从random位置到target位置，ease-in-out',
        mood: '科幻、未来、精密',
        suitableFor: ['tech', 'sci-fi', 'future']
      },
      
      // 7. 水墨晕染 (东方/文化)
      'ink-bleed': {
        name: '水墨晕染',
        description: '标题如墨滴入水，从中心向外晕染，边缘有自然扩散纹理',
        timing: 'T00:30-T00:80',
        fontStyle: '书法衬线体，粗字重，笔画有飞白质感',
        visual: 'fractal noise驱动边缘扩散，alpha从中心向外渐变，有机感',
        mood: '东方、文化、诗意',
        suitableFor: ['culture', 'history', 'art']
      },
      
      // 8. 百叶窗展开 (商务/专业)
      'blinds-reveal': {
        name: '百叶窗展开',
        description: '标题被水平百叶窗遮挡，叶片逐层翻转，露出文字',
        timing: 'T00:25-T00:75',
        fontStyle: '经典衬线体，中等字重，商务感',
        visual: 'clip-path百叶窗动画，5-7层叶片，依次翻转90度',
        mood: '商务、专业、秩序',
        suitableFor: ['business', 'corporate', 'finance']
      },
      
      // 9. 旋转入场 (创意/艺术)
      'rotate-in': {
        name: '旋转入场',
        description: '标题从画面外旋转进入，伴随轻微弹跳，活力十足',
        timing: 'T00:20-T00:70',
        fontStyle: '手写风格体，粗字重，不规则感',
        visual: 'rotation+scale组合，从-90度到0度，scale从0.5到1.0，ease-out-bounce',
        mood: '创意、活泼、艺术',
        suitableFor: ['creative', 'art', 'kids']
      },
      
      // 10. 水波纹显现 (自然/环保)
      'ripple-appear': {
        name: '水波纹显现',
        description: '如水面投石，标题从涟漪中心浮现，波纹向外扩散',
        timing: 'T00:30-T00:80',
        fontStyle: '自然人文体，中等字重，有机感',
        visual: 'ripple distortion效果，文字从扭曲中逐渐清晰，波纹持续3秒',
        mood: '自然、清新、宁静',
        suitableFor: ['nature', 'environment', 'health']
      },
      
      // 11. 霓虹闪烁 (都市/夜生活)
      'neon-flicker': {
        name: '霓虹闪烁',
        description: '标题如霓虹灯招牌，闪烁3次后稳定亮起，有光晕拖尾',
        timing: 'T00:20-T00:60',
        fontStyle: '霓虹灯管体，粗字重，发光效果',
        visual: '闪烁动画：亮→暗→亮→暗→稳定，每次0.15秒，有发光bloom',
        mood: '都市、夜生活、潮流',
        suitableFor: ['nightlife', 'urban', 'fashion']
      },
      
      // 12. 翻页效果 (书籍/教育)
      'page-turn': {
        name: '翻页效果',
        description: '如翻开书页，标题从页面折痕处显现，有纸张质感',
        timing: 'T00:25-T00:75',
        fontStyle: '印刷衬线体，中等字重，学术感',
        visual: '3D page curl效果，书页从右向左翻开，文字从背面显现',
        mood: '知识、学术、阅读',
        suitableFor: ['education', 'book', 'academic']
      },
      
      // 13. 烟雾凝结 (神秘/悬疑)
      'smoke-form': {
        name: '烟雾凝结',
        description: '标题从烟雾中凝结，如烟柱旋转上升后固化成文字',
        timing: 'T00:30-T00:80',
        fontStyle: '哥特衬线体，粗字重，神秘',
        visual: 'smoke simulation，粒子从random位置螺旋上升，在中心聚合成文字',
        mood: '神秘、悬疑、魔幻',
        suitableFor: ['mystery', 'fantasy', 'thriller']
      },
      
      // 14. 方块拼合 (积木/童趣)
      'block-assemble': {
        name: '方块拼合',
        description: '标题由无数小方块从四面飞入，在中心拼合成完整文字',
        timing: 'T00:20-T00:70',
        fontStyle: '几何无衬线体，极粗字重，模块化',
        visual: '方块粒子，每个字由20-30个小方块组成，从random位置飞入，0.5秒拼合',
        mood: '童趣、建构、模块化',
        suitableFor: ['kids', 'education', 'diy']
      },
      
      // 15. 极简划线 (高端/极简)
      'minimal-line': {
        name: '极简划线',
        description: '一条细线从画面中心横向展开，标题在线的上下方出现',
        timing: 'T00:25-T00:75',
        fontStyle: '极简无衬线体，细字重，极致留白',
        visual: 'line stroke动画，从中心向两侧展开，文字在线出现后以0.2秒淡入',
        mood: '高端、极简、克制',
        suitableFor: ['luxury', 'minimal', 'design']
      },
      
      // 16. 玻璃破碎 (动作/冲击)
      'glass-shatter': {
        name: '玻璃破碎',
        description: '标题如被冰封，表面裂纹蔓延后破碎，文字从碎片中显现',
        timing: 'T00:20-T00:70',
        fontStyle: '硬朗无衬线体，极粗字重，力量感',
        visual: 'crack pattern蔓延，碎片飞散，文字从碎片后显现，碎片有物理模拟',
        mood: '冲击、力量、动作',
        suitableFor: ['action', 'sports', 'automotive']
      }
    };
  }

  /**
   * 根据视频类型选择最佳动效
   */
  _selectEffect(videoType, world) {
    const templates = this._getEffectTemplates();
    const type = videoType.toLowerCase();
    
    // 按类型匹配
    for (const [key, effect] of Object.entries(templates)) {
      if (effect.suitableFor.includes(type)) {
        return { ...effect, key };
      }
    }
    
    // 根据氛围回退
    const atmosphere = (world.atmosphere || '').toLowerCase();
    if (atmosphere.includes('温暖') || atmosphere.includes('亲切')) {
      return { ...templates['glow-expand'], key: 'glow-expand' };
    }
    if (atmosphere.includes('专业') || atmosphere.includes('严谨')) {
      return { ...templates['elegant-fade'], key: 'elegant-fade' };
    }
    if (atmosphere.includes('现代') || atmosphere.includes('活力')) {
      return { ...templates['slide-in'], key: 'slide-in' };
    }
    
    // 默认
    return { ...templates['elegant-fade'], key: 'elegant-fade' };
  }

  /**
   * 第一幕：钩子
   */
  _buildHook(world, characters, effect) {
    const setting = world.setting || '专业环境';
    const atmosphere = world.atmosphere || '专业、可信';
    const charList = Object.values(characters || {}).map(c => c.name).filter(Boolean);
    
    let hook = '';
    if (charList.length > 0) {
      hook = `${charList[0]}面向镜头，自然微笑，专业姿态，背景${setting}，${atmosphere}氛围`;
    } else {
      hook = `专业${setting}全景，${atmosphere}，自然光线，画面稳定`;
    }
    
    return {
      phase: 'hook',
      duration: Math.floor(this.duration * 0.25),
      content: hook,
      timing: `T00:00-T00:${Math.floor(this.duration * 0.25)}`
    };
  }

  /**
   * 第二幕：展开 - 标题展示（只展示主标题+副标题，无集数）
   */
  _buildReveal(mainTitle, subTitle, world, effect) {
    const setting = world.setting || '专业环境';
    const lighting = world.lighting || '自然光';
    
    // 核心：只展示主标题和副标题，不展示集数
    let titleBlock = `主标题"${mainTitle}"以"${effect.name}"动效呈现`;
    if (subTitle) {
      titleBlock += `，副标题"${subTitle}"随后以0.5秒延迟跟进，同样采用"${effect.name}"动效`;
    }
    
    // 动效描述
    const effectDesc = effect.description || '';
    const visualDesc = effect.visual || '';
    
    return {
      phase: 'reveal',
      duration: Math.floor(this.duration * 0.50),
      content: `${titleBlock}。动效描述：${effectDesc}。视觉效果：${visualDesc}。背景${setting}，${lighting}，字体风格：${effect.fontStyle}。不展示集数、EP编号或任何数字标识。`,
      timing: `T00:${Math.floor(this.duration * 0.25)}-T00:${Math.floor(this.duration * 0.75)}`,
      effect: effect.name
    };
  }

  /**
   * 第三幕：定格
   */
  _buildFreeze(world, effect) {
    const atmosphere = world.atmosphere || '专业';
    
    return {
      phase: 'freeze',
      duration: this.duration - Math.floor(this.duration * 0.75),
      content: `标题稳定定格，${effect.mood || atmosphere}，淡入正片过渡，无突兀切换，标题保持2秒静态后渐隐`,
      timing: `T00:${Math.floor(this.duration * 0.75)}-T00:${this.duration}`
    };
  }

  /**
   * 组装Prompt（1500字符预算）
   */
  _assemblePrompt(hook, reveal, freeze, world, characters, effect, mainTitle, subTitle) {
    const parts = [];
    
    // L1: 约束层
    // 【v2.1.4-fix10-P25-fix8-P1B】正向渲染属性移出 NEGATIVE，单独放 RENDER 通道
    parts.push(`NEGATIVE: no episode number, no EP text, no "EP01" or "第一集" text, no anime, no cartoon, no deformed hands, no extra fingers, no watermark, no subtitle, no caption, no logo, no text artifacts`);
    parts.push(`RENDER: 16:9 cinematic, 24fps, hyperrealistic, ultra-detailed, HDR, film grain, 35mm texture, photorealistic with filmic treatment`);
    
    // L2: 基础层
    const charNames = Object.values(characters || {}).map(c => c.name).filter(Boolean).join(', ');
    parts.push(`CHARACTER: ${charNames || '无角色'}`);
    
    // L3: 场景层
    parts.push(`SCENE: ${world.name || '片头'} | ${world.setting || '专业环境'} | ${world.lighting || '自然光'} | ${world.atmosphere || '专业氛围'}`);
    
    // L4: 主体层（三幕）
    parts.push(`ACTION: ${hook.content} | ${reveal.content} | ${freeze.content}`);
    
    // L5: 动态层（动效详情）
    parts.push(`EFFECT: ${effect.name} | ${effect.description} | ${effect.visual}`);
    parts.push(`FONT: ${effect.fontStyle}`);
    parts.push(`CAMERA: 稳定开场，缓慢推进，标题区域聚焦，适度景深，专业运镜`);
    parts.push(`TIMELINE: T00:00-T00:${this.duration} / duration: ${this.duration}s / type: opening / mood: ${effect.mood}`);
    
    // L6: 风格层
    parts.push(`MOOD: ${effect.mood || '专业开场'} | 清晰 | 可信 | 现代`);
    parts.push(`LIGHTING: ${world.lighting || '自然光，柔和明亮，均匀照明'}`);
    
    // L7: 音频层
    parts.push(`AUDIO: L1:舒缓背景音，-20LUFS | L2:自然环境音 | L3:温暖氛围，72BPM | 避让:标题出现时背景音乐降低3dB`);
    
    // L8: 内部层
    parts.push(`RENDER: hyperrealistic cinematic quality, 35mm film grain, HDR, photorealistic, 16:9 cinematic, documentary realistic style`);
    parts.push(`DIRECTOR: 专业片头设计，${effect.name}动效，开场稳重，信息清晰，现代感，不展示集数`);
    
    // 定妆照引用
    const charKeys = Object.keys(characters || {});
    if (charKeys.length > 0) {
      parts.push(`@image1 ${charKeys[0]}近景，核心特征，超写实`);
    }
    
    return parts.join(' | ');
  }

  _extractMainTitle(input) {
    // 优先从opening配置提取
    return input.opening?.seriesTitle || 
           input.title?.main || 
           input.world?.name || 
           input.projectName || 
           '未命名项目';
  }

  _extractSubTitle(input) {
    // 优先从opening配置提取
    return input.opening?.subtitle || 
           input.opening?.episodeTitle || 
           input.title?.sub || 
           input.world?.subtitle || 
           input.subtitle || 
           '';
  }

  _extractReferenceImages(characters) {
    const refs = [];
    for (const [id, char] of Object.entries(characters || {})) {
      if (char.portraits?.front) {
        refs.push({ id: `${id}-front`, path: char.portraits.front });
      }
    }
    return refs;
  }

  _buildCameraMovement(effect) {
    return {
      scene: '片头',
      primaryMovement: '稳定开场-缓慢推进-定格',
      speed: 'slow',
      shotSize: 'wide-to-medium',
      timeline: `T00:00-T00:${this.duration}`,
      effect: effect?.name || 'none'
    };
  }
}

module.exports = GenericOpeningSystem;
