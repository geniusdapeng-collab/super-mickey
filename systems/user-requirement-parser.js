/**
 * 用户需求解析确认模块 - UserRequirementParser
 * Stage -1: 将用户自然语言输入解析为结构化需求清单
 * 
 * 设计原则：
 * 1. 用户只需要说一句话，系统负责给出完整方案
 * 2. 主动提案、轻量确认
 * 3. 规则库+LLM混合解析
 * 4. 100%向后兼容
 * 
 * @version 1.0
 * @since v6.6.0
 */

const { LLMEngine } = require('./llm-reasoning-engine');

/**
 * 风格编码展开映射器
 * 统一处理编码→中文描述的转换
 * 支持上下文感知的动态展开
 */
const StyleEncoder = {
  // 主风格编码映射
  primaryStyles: {
    'REAL': { name: '写实纪实', description: '自然光、真实场景、手持感', contextDescriptions: {
      'EDU': '真实可信的纪实风格，增强专业信任感',
      'DOC': '深度纪实的真实质感，保留现场感',
      'VLOG': '自然随性的记录风格，贴近生活',
      'default': '写实纪实的真实质感'
    }},
    'CINE': { name: '电影质感', description: '戏剧性光影、宽画幅、景深', contextDescriptions: {
      'DRAMA': '电影级叙事质感，增强戏剧张力',
      'MV': '艺术化的电影视觉，强化情绪表达',
      'ADV': '高端电影质感，提升品牌调性',
      'default': '电影级的戏剧质感'
    }},
    'POL': { name: '精致商业', description: '高饱和、精致布光、产品特写', contextDescriptions: {
      'ADV': '精致商业广告质感，突出产品卖点',
      'COR': '高端商业品质感，展示企业实力',
      'default': '精致商业的高品质呈现'
    }},
    'MINI': { name: '极简现代', description: 'clean背景、大留白、几何构图', contextDescriptions: {
      'ADV': '极简现代的产品展示，突出科技感',
      'COR': '现代简约的商务风格',
      'default': '极简现代的设计美学'
    }},
    'RET': { name: '复古怀旧', description: '暖色调、胶片颗粒、年代感', contextDescriptions: {
      'DRAMA': '复古怀旧的叙事氛围，唤起情感共鸣',
      'MV': '怀旧复古的视觉风格，营造年代感',
      'default': '复古怀旧的温暖质感'
    }},
    'FUT': { name: '科幻未来', description: '冷色调、霓虹光、科技感UI', contextDescriptions: {
      'ADV': '科幻未来的前卫视觉，彰显科技实力',
      'MV': '未来科幻的艺术表达',
      'default': '科幻未来的科技美学'
    }},
    'ART': { name: '艺术实验', description: '非常规构图、抽象视觉、强烈色彩', contextDescriptions: {
      'MV': '艺术实验的前卫表达',
      'ADV': '艺术化的创意视觉',
      'default': '艺术实验的独特美学'
    }},
    'WARM': { name: '温暖治愈', description: '柔和光线、暖色调、慢节奏', contextDescriptions: {
      'EDU': '温暖治愈的亲和风格，降低知识门槛',
      'VLOG': '温暖治愈的生活记录',
      'default': '温暖治愈的情感氛围'
    }},
    'STREET': { name: '街头潮流', description: '快速剪辑、涂鸦元素、动感运镜', contextDescriptions: {
      'SOC': '街头潮流的年轻活力',
      'ADV': '潮流前卫的品牌表达',
      'default': '街头潮流的动感风格'
    }},
    'FAIRY': { name: '梦幻童话', description: '柔光、仙气、超现实元素', contextDescriptions: {
      'DRAMA': '梦幻童话的浪漫氛围',
      'ADV': '梦幻唯美的产品呈现',
      'default': '梦幻童话的超现实美感'
    }}
  },

  // 辅助风格编码映射
  secondaryStyles: {
    'LUX': { name: '奢华感', effect: '金色/暗调、高级质感、慢镜头' },
    'VIV': { name: '活力感', effect: '高饱和、快节奏、动感音乐' },
    'EMO': { name: '情绪感', effect: '低饱和、慢节奏、叙事性强' },
    'NAT': { name: '自然感', effect: '户外、自然光、绿意/蓝天' },
    'GRI': { name: '粗粝感', effect: '高对比、暗部细节、纪实感' },
    'SWE': { name: '甜美感', effect: '粉色/马卡龙、柔光、可爱元素' },
    'DAR': { name: '暗黑感', effect: '低key布光、阴影、神秘氛围' },
    'NOS': { name: '怀旧感', effect: '胶片色、颗粒、老电视效果' }
  },

  /**
   * 展开主风格编码为中文描述
   * @param {string} code - 风格编码如 'REAL'
   * @param {string} videoType - 视频类型如 'EDU'
   * @returns {string} 中文描述
   */
  expandPrimary(code, videoType) {
    const style = this.primaryStyles[code];
    if (!style) return code;
    const contextDesc = style.contextDescriptions[videoType] || style.contextDescriptions['default'];
    return `${style.name}风格，${contextDesc}，${style.description}`;
  },

  /**
   * 展开辅助风格编码为中文描述
   * @param {string} code - 辅助风格编码如 '+LUX'
   * @returns {string} 中文描述
   */
  expandSecondary(code) {
    const cleanCode = code.replace(/^\+/, '');
    const style = this.secondaryStyles[cleanCode];
    if (!style) return code;
    return `${style.name}(${style.effect})`;
  },

  /**
   * 展开完整风格组合
   * @param {string} primary - 主风格编码
   * @param {string[]} secondary - 辅助风格编码数组
   * @param {string} videoType - 视频类型
   * @returns {string} 完整中文描述
   */
  expandStyle(primary, secondary = [], videoType = 'default') {
    const primaryDesc = this.expandPrimary(primary, videoType);
    if (secondary.length === 0) return primaryDesc;
    
    const secondaryDescs = secondary.map(s => this.expandSecondary(s));
    return `${primaryDesc}，叠加${secondaryDescs.join('、')}`;
  }
};

/**
 * 规则库 - 视频需求解析规则
 */
const ParserRules = {
  // 视频类型推断规则（关键词→类型）
  videoTypeRules: [
    { keywords: ['科普', '讲解', '知识', '教学', '课程', '教育', '健康科普'], type: 'EDU', name: '教育科普' },
    { keywords: ['短剧', '剧情', '故事', '角色', '集', '微电影'], type: 'DRAMA', name: '短剧/微电影' },
    { keywords: ['广告', '宣传', '推广', '品牌', '产品', '宣传片'], type: 'ADV', name: '商业广告' },
    { keywords: ['纪录片', '记录', '纪实', '真实'], type: 'DOC', name: '纪录片' },
    { keywords: ['电影', '院线'], type: 'DRAMA', name: '短剧/微电影(降级)', isDowngrade: true },
    { keywords: ['vlog', '日常', '记录生活', '跟我'], type: 'VLOG', name: 'Vlog/记录' },
    { keywords: ['抖音', '快手', '小红书', 'viral', '短视频'], type: 'SOC', name: '社媒短视频' },
    { keywords: ['企业', '公司', '工厂', '实力'], type: 'COR', name: '企业宣传' },
    { keywords: ['活动', '现场', '会议', '庆典'], type: 'EVT', name: '活动记录' },
    { keywords: ['mv', '音乐', '歌曲'], type: 'MV', name: '音乐视频' }
  ],

  // 风格推断规则（关键词→风格）
  styleRules: [
    { keywords: ['写实', '真实', '纪实', '纪录片感'], style: 'REAL' },
    { keywords: ['电影感', '大片', '质感', ' cinematic'], style: 'CINE' },
    { keywords: ['精致', '高级', '商业', '产品'], style: 'POL' },
    { keywords: ['极简', '现代', '科技', 'clean'], style: 'MINI' },
    { keywords: ['复古', '怀旧', '年代', '老'], style: 'RET' },
    { keywords: ['科幻', '未来', '科技', '赛博'], style: 'FUT' },
    { keywords: ['艺术', '实验', '前卫', '独特'], style: 'ART' },
    { keywords: ['温暖', '治愈', '柔和', '温情'], style: 'WARM' },
    { keywords: ['街头', '潮流', '潮', '涂鸦'], style: 'STREET' },
    { keywords: ['梦幻', '童话', '仙气', '唯美'], style: 'FAIRY' }
  ],

  // 辅助风格推断规则
  modifierRules: [
    { keywords: ['奢华', 'luxury', '高端', '金色'], modifier: 'LUX' },
    { keywords: ['活力', '动感', '快节奏', '年轻'], modifier: 'VIV' },
    { keywords: ['情绪', '情感', '叙事', '深沉'], modifier: 'EMO' },
    { keywords: ['自然', '户外', '绿色', '阳光'], modifier: 'NAT' },
    { keywords: ['粗粝', ' gritty', '纪实', '真实'], modifier: 'GRI' },
    { keywords: ['甜美', '可爱', '粉色', '马卡龙'], modifier: 'SWE' },
    { keywords: ['暗黑', '神秘', '阴影', '低key'], modifier: 'DAR' },
    { keywords: ['怀旧', '胶片', '颗粒', '老'], modifier: 'NOS' }
  ],

  // 平台推断规则
  platformRules: [
    { keywords: ['抖音'], platform: '抖音', defaultRatio: '9:16' },
    { keywords: ['快手'], platform: '快手', defaultRatio: '9:16' },
    { keywords: ['小红书'], platform: '小红书', defaultRatio: '9:16' },
    { keywords: ['视频号'], platform: '视频号', defaultRatio: '9:16' },
    { keywords: ['b站', 'bilibili', 'youtube'], platform: 'B站/YouTube', defaultRatio: '16:9' },
    { keywords: ['朋友圈'], platform: '朋友圈', defaultRatio: '9:16' },
    { keywords: ['大屏', '户外'], platform: '户外大屏', defaultRatio: '16:9' }
  ],

  // 时长推断规则（按类型）
  durationDefaults: {
    'EDU': { default: 90, range: [60, 120], unit: 'seconds' },
    'SOC': { default: 30, range: [15, 60], unit: 'seconds' },
    'ADV': { default: 30, range: [15, 60], unit: 'seconds' },
    'DOC': { default: 150, range: [60, 180], unit: 'seconds' },
    'DRAMA': { default: 150, range: [60, 180], unit: 'seconds' },
    'COR': { default: 90, range: [60, 120], unit: 'seconds' },
    'EVT': { default: 120, range: [60, 180], unit: 'seconds' },
    'VLOG': { default: 90, range: [60, 120], unit: 'seconds' },
    'MV': { default: 150, range: [60, 180], unit: 'seconds' }
  },

  // 系统硬约束
  constraints: {
    maxSingleDuration: 180,      // 单集最长180秒
    maxTotalDuration: 1200,      // 总时长最长20分钟（1200秒）
    maxShotDuration: 15,         // 单个镜头最长15秒
    maxEpisodes: 7,              // 最多7集
    recommendedMaxEpisodes: 5,   // 推荐最多5集
    recommendedMaxTotalDuration: 900 // 推荐总时长15分钟
  }
};

/**
 * 用户需求解析确认模块主类
 */
class UserRequirementParser {
  constructor(options = {}) {
    this.llmEngine = options.llmEngine || new LLMEngine();
    this.rules = ParserRules;
    this.styleEncoder = StyleEncoder;
    this.options = {
      maxIterations: 2,           // 最大迭代轮次
      confidenceThreshold: 0.6,   // 置信度阈值
      useLLM: true,               // 是否使用LLM
      ...options
    };
  }

  /**
   * 主解析方法
   * @param {string} userInput - 用户自然语言输入
   * @param {Object} context - 上下文信息（如历史对话）
   * @returns {RequirementParseResult} 解析结果
   */
  async parse(userInput, context = {}) {
    // 1. 规则库快速解析（确定性提取）
    const ruleBasedResult = this._ruleBasedParse(userInput);
    
    // 2. LLM深度解析（语义理解）
    let llmResult = {};
    if (this.options.useLLM) {
      llmResult = await this._llmParse(userInput, ruleBasedResult, context);
    }
    
    // 3. 合并结果（LLM结果优先）
    const mergedResult = this._mergeResults(ruleBasedResult, llmResult);
    
    // 4. 推断补全（填充缺失字段）
    const completedResult = this._inferCompletion(mergedResult);
    
    // 5. 约束检查（确保在系统限制内）
    const constrainedResult = this._applyConstraints(completedResult);
    
    // 6. 生成最终输出
    return this._buildOutput(constrainedResult, userInput);
  }

  /**
   * 规则库解析 - 快速确定性提取
   */
  _ruleBasedParse(input) {
    const text = input.toLowerCase();
    const result = {
      videoType: null,
      videoTypeConfidence: 0,
      platform: null,
      style: { primary: null, secondary: [] },
      duration: null,
      title: null,
      keywords: []
    };

    // 提取关键词
    result.keywords = this._extractKeywords(text);

    // 推断视频类型
    for (const rule of this.rules.videoTypeRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.videoType = rule.type;
          result.videoTypeName = rule.name;
          result.videoTypeConfidence = 0.8;
          result.isDowngrade = rule.isDowngrade || false;
          break;
        }
      }
      if (result.videoType) break;
    }

    // 推断平台
    for (const rule of this.rules.platformRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.platform = rule.platform;
          result.defaultRatio = rule.defaultRatio;
          break;
        }
      }
      if (result.platform) break;
    }

    // 推断风格
    for (const rule of this.rules.styleRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          result.style.primary = rule.style;
          break;
        }
      }
      if (result.style.primary) break;
    }

    // 推断辅助风格
    for (const rule of this.rules.modifierRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          if (!result.style.secondary.includes(rule.modifier)) {
            result.style.secondary.push(rule.modifier);
          }
        }
      }
    }

    // 提取时长（数字+秒/分钟）
    const durationMatch = text.match(/(\d+)\s*(秒|分钟|分|s|sec|min)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      if (unit.includes('分') || unit.includes('min')) {
        result.duration = value * 60;
      } else {
        result.duration = value;
      }
    }

    // 提取创意指数
    const intensityMatch = text.match(/创意指数\s*[:：]?\s*(0?\.\d+|\d+)/i);
    if (intensityMatch) {
      result.creativeIntensity = parseFloat(intensityMatch[1]);
    }

    // 提取系列信息
    const seriesMatch = text.match(/(\d+)\s*集/);
    if (seriesMatch) {
      result.totalEpisodes = parseInt(seriesMatch[1]);
      result.isSeries = true;
    }

    const episodeMatch = text.match(/第\s*(\d+)\s*集/);
    if (episodeMatch) {
      result.currentEpisode = parseInt(episodeMatch[1]);
    }

    return result;
  }

  /**
   * LLM深度解析 - 语义理解
   */
  async _llmParse(userInput, ruleResult, context) {
    const prompt = this._buildLLMPrompt(userInput, ruleResult);
    
    try {
      const response = await this.llmEngine.complete({
        prompt: prompt,
        maxTokens: 2000,
        temperature: 1
      });

      // 解析LLM输出（期望JSON格式）
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || 
                        response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (error) {
      console.warn('[UserRequirementParser] LLM解析失败，回退到规则库:', error.message);
    }

    return {};
  }

  /**
   * 构建LLM提示词
   */
  _buildLLMPrompt(userInput, ruleResult) {
    return `你是一位资深视频制片人，擅长将用户的粗略需求转化为专业的视频制作方案。

## 用户输入
"""${userInput}"""

## 规则库初步解析结果（供参考）
${JSON.stringify(ruleResult, null, 2)}

## 系统硬约束（不可违反）
- 单次最长时长: 180秒
- 单个镜头最长: 15秒
- 单集最长: 180秒
- 总时长上限: 20分钟（1200秒）
- 系列最多7集，推荐最多5集
- 不存在"电影"类型，用户说"电影"时降级为"短剧/微电影"

## 视频类型分类
EDU=教育科普, SOC=社媒短视频, ADV=商业广告, DOC=纪录片, DRAMA=短剧/微电影, COR=企业宣传, EVT=活动记录, VLOG=Vlog/记录, MV=音乐视频

## 风格分类
主风格: REAL=写实纪实, CINE=电影质感, POL=精致商业, MINI=极简现代, RET=复古怀旧, FUT=科幻未来, ART=艺术实验, WARM=温暖治愈, STREET=街头潮流, FAIRY=梦幻童话
辅助风格: +LUX=奢华感, +VIV=活力感, +EMO=情绪感, +NAT=自然感, +GRI=粗粝感, +SWE=甜美感, +DAR=暗黑感, +NOS=怀旧感

## 任务
请分析用户需求，输出JSON格式的解析结果：

{
  "videoType": "类型编码",
  "title": "视频主题",
  "targetAudience": "目标受众",
  "platform": "投放平台",
  "duration": 时长数字,
  "style": {
    "primary": "主风格编码",
    "secondary": ["辅助风格编码"]
  },
  "creativeIntensity": 0.0到1.0,
  "characters": [{"name": "角色名", "description": "角色描述"}],
  "isSeries": true/false,
  "totalEpisodes": 集数,
  "currentEpisode": 当前集数,
  "keyPoints": ["关键需求点1", "关键需求点2"],
  "uncertainties": ["不确定项1"]
}

只输出JSON，不要其他内容。`;
  }

  /**
   * 合并规则库和LLM结果
   */
  _mergeResults(ruleResult, llmResult) {
    return {
      ...ruleResult,
      ...llmResult,
      // LLM结果优先，但保留规则库的高置信度字段
      videoType: llmResult.videoType || ruleResult.videoType,
      style: {
        primary: llmResult.style?.primary || ruleResult.style?.primary,
        secondary: llmResult.style?.secondary || ruleResult.style?.secondary || []
      }
    };
  }

  /**
   * 推断补全 - 填充缺失字段
   */
  _inferCompletion(result) {
    const completed = { ...result };

    // 补全视频类型（默认EDU）
    if (!completed.videoType) {
      completed.videoType = 'EDU';
      completed.videoTypeName = '教育科普';
      completed.videoTypeConfidence = 0.4;
      completed.videoTypeInferred = true;
    }

    // 补全时长
    if (!completed.duration) {
      const defaults = this.rules.durationDefaults[completed.videoType];
      if (defaults) {
        completed.duration = defaults.default;
        completed.durationRecommended = defaults.default;
        completed.durationRange = defaults.range;
        completed.durationInferred = true;
      }
    }

    // 补全风格
    if (!completed.style?.primary) {
      // 根据视频类型推断默认风格
      const typeToStyle = {
        'EDU': 'REAL', 'DOC': 'REAL', 'VLOG': 'REAL',
        'DRAMA': 'CINE', 'MV': 'ART',
        'ADV': 'POL', 'COR': 'POL',
        'SOC': 'STREET', 'EVT': 'REAL'
      };
      completed.style = completed.style || {};
      completed.style.primary = typeToStyle[completed.videoType] || 'REAL';
      completed.styleInferred = true;
    }

    // 补全创意指数
    if (completed.creativeIntensity === undefined) {
      const typeToIntensity = {
        'EDU': 0.5, 'DOC': 0.5, 'VLOG': 0.4,
        'DRAMA': 0.65, 'MV': 0.7,
        'ADV': 0.7, 'COR': 0.6,
        'SOC': 0.5, 'EVT': 0.4
      };
      completed.creativeIntensity = typeToIntensity[completed.videoType] || 0.5;
      completed.creativeIntensityInferred = true;
    }

    // 补全平台
    if (!completed.platform) {
      completed.platform = this._inferPlatform(completed.videoType);
      completed.platformInferred = true;
    }

    // 补全画幅比例
    if (!completed.aspectRatio) {
      completed.aspectRatio = completed.defaultRatio || this._inferAspectRatio(completed.platform, completed.videoType);
    }

    // 补全系列信息
    if (completed.isSeries === undefined) {
      completed.isSeries = false;
    }

    return completed;
  }

  /**
   * 应用系统硬约束
   */
  _applyConstraints(result) {
    const constrained = { ...result };
    const c = this.rules.constraints;

    // 单集时长约束
    if (constrained.duration > c.maxSingleDuration) {
      // 需要拆分
      constrained.needsSplit = true;
      constrained.originalDuration = constrained.duration;
      constrained.episodes = Math.ceil(constrained.duration / c.maxSingleDuration);
      
      // 检查总时长
      const totalDuration = constrained.duration;
      if (totalDuration > c.maxTotalDuration) {
        constrained.exceedsTotalLimit = true;
        constrained.maxAllowedDuration = c.maxTotalDuration;
        constrained.recommendedDuration = c.recommendedMaxTotalDuration;
      }

      // 检查集数
      if (constrained.episodes > c.maxEpisodes) {
        constrained.exceedsEpisodeLimit = true;
        constrained.maxAllowedEpisodes = c.maxEpisodes;
      }
    }

    // 创意指数约束
    if (constrained.creativeIntensity < 0) constrained.creativeIntensity = 0;
    if (constrained.creativeIntensity > 1) constrained.creativeIntensity = 1;

    return constrained;
  }

  /**
   * 构建最终输出
   */
  _buildOutput(result, originalInput) {
    const fieldConfidence = this._calculateConfidence(result);
    const requiresConfirmation = Object.entries(fieldConfidence)
      .filter(([_, conf]) => conf < this.options.confidenceThreshold)
      .map(([field, _]) => field);

    // 构建风格描述
    const styleDescription = this.styleEncoder.expandStyle(
      result.style.primary,
      result.style.secondary,
      result.videoType
    );

    return {
      version: '1.0',
      parseStatus: result.needsSplit ? 'needs_split' : 'complete',
      originalInput: originalInput,

      basicInfo: {
        videoType: result.videoType,
        videoTypeName: result.videoTypeName || this._getVideoTypeName(result.videoType),
        title: result.title || '未命名视频',
        topic: result.topic || result.title || '',
        characters: result.characters || [],
        targetAudience: result.targetAudience || this._inferAudience(result.videoType),
        platform: result.platform
      },

      productionSpecs: {
        duration: {
          target: result.duration,
          recommended: result.durationRecommended || result.duration,
          range: result.durationRange,
          unit: 'seconds'
        },
        aspectRatio: result.aspectRatio,
        style: {
          primary: result.style.primary,
          primaryName: this.styleEncoder.primaryStyles[result.style.primary]?.name || result.style.primary,
          secondary: result.style.secondary,
          secondaryNames: result.style.secondary.map(s => 
            this.styleEncoder.secondaryStyles[s.replace('+', '')]?.name || s
          ),
          description: styleDescription
        },
        quality: this._mapQuality(result.creativeIntensity),
        creativeIntensity: result.creativeIntensity,
        colorTone: result.colorTone || '根据风格自动匹配'
      },

      contentCreative: {
        narrativeMode: result.narrativeMode || 'dialogue',
        contentTone: result.contentTone || '标准',
        visualStyle: result.visualStyle || styleDescription,
        musicStyle: result.musicStyle || '根据风格自动匹配'
      },

      structure: {
        opening: {
          enabled: result.currentEpisode === 1 || result.currentEpisode === undefined,
          title: result.title || '',
          subtitle: result.subtitle || ''
        },
        scenes: result.scenes || [],
        ending: {
          style: result.endingStyle || 'summary',
          previewNext: false
        }
      },

      series: {
        isSeries: result.isSeries,
        totalEpisodes: result.totalEpisodes,
        currentEpisode: result.currentEpisode,
        episodeThemes: result.episodeThemes || [],
        contentIsolation: result.isSeries
      },

      constraints: {
        ...result.constraints,
        systemConstraints: this.rules.constraints
      },

      aiDecisionNotes: {
        videoType: result.videoTypeInferred ? `[AI推断] 基于关键词推断为${result.videoTypeName}` : '[用户指定]',
        style: result.styleInferred ? `[AI推断] 基于视频类型匹配${this.styleEncoder.primaryStyles[result.style.primary]?.name}` : '[用户指定]',
        duration: result.durationInferred ? `[AI推断] 基于视频类型推荐${result.duration}秒` : '[用户指定]',
        creativeIntensity: result.creativeIntensityInferred ? `[AI推断] 基于视频类型默认${result.creativeIntensity}` : '[用户指定]',
        platform: result.platformInferred ? `[AI推断] 基于视频类型推荐${result.platform}` : '[用户指定]'
      },

      fieldConfidence,
      requiresConfirmation,

      // 系统提示
      systemNotes: {
        needsSplit: result.needsSplit || false,
        exceedsTotalLimit: result.exceedsTotalLimit || false,
        exceedsEpisodeLimit: result.exceedsEpisodeLimit || false,
        isDowngrade: result.isDowngrade || false
      }
    };
  }

  /**
   * 迭代确认 - 根据用户反馈更新需求
   */
  async iterate(currentResult, userFeedback) {
    // 将用户反馈作为新的输入，结合当前结果进行更新
    const context = {
      currentResult: currentResult,
      previousRequirements: currentResult
    };

    // 重新解析用户反馈
    const feedbackResult = await this.parse(userFeedback, context);

    // 合并反馈结果到当前结果（用户反馈优先）
    return this._mergeWithFeedback(currentResult, feedbackResult, userFeedback);
  }

  /**
   * 转换为 pipeline input 格式
   */
  toPipelineInput(parseResult) {
    const basic = parseResult.basicInfo;
    const specs = parseResult.productionSpecs;
    const creative = parseResult.contentCreative;
    const structure = parseResult.structure;
    const series = parseResult.series;

    return {
      // 基本信息
      title: basic.title,
      videoType: basic.videoType.toLowerCase(),
      
      // 角色信息
      characters: basic.characters.map(char => ({
        name: char.name,
        profile: char.description,
        role: char.role || 'host'
      })),

      // 制作规格
      targetDuration: specs.duration.target,
      ratio: specs.aspectRatio,
      style: specs.style.primary,
      styleModifiers: specs.style.secondary,
      creativeIntensity: specs.creativeIntensity,

      // 内容创意
      narrativeMode: creative.narrativeMode,
      contentTone: creative.contentTone,
      visualStyle: creative.visualStyle,
      musicStyle: creative.musicStyle,

      // 平台
      platform: basic.platform,

      // 结构
      opening: structure.opening,
      scenes: structure.scenes,
      endingStyle: structure.ending.style,
      
      // 系列
      episode: series.currentEpisode,
      totalEpisodes: series.totalEpisodes,
      isSeries: series.isSeries,

      // 约束
      constraints: parseResult.constraints,

      // 核心
      core: {
        targetAudience: basic.targetAudience,
        platform: basic.platform,
        tone: creative.contentTone
      },

      // 元数据
      _requirementParseResult: parseResult
    };
  }

  // ============ 辅助方法 ============

  _extractKeywords(text) {
    // 提取用户输入中的关键名词和动词
    const words = text.split(/\s+/);
    const keywords = [];
    const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    
    for (const word of words) {
      if (word.length >= 2 && !stopWords.includes(word)) {
        keywords.push(word);
      }
    }
    return keywords.slice(0, 10); // 最多10个关键词
  }

  _inferPlatform(videoType) {
    const platformMap = {
      'EDU': '视频号/抖音/B站',
      'SOC': '抖音/快手/小红书',
      'ADV': '全平台',
      'DOC': 'B站/优酷',
      'DRAMA': '抖音/快手/视频号',
      'COR': '官网/展会',
      'EVT': '社交媒体',
      'VLOG': 'B站/YouTube/视频号',
      'MV': '音乐平台/社交媒体'
    };
    return platformMap[videoType] || '视频号/抖音';
  }

  _inferAspectRatio(platform, videoType) {
    if (platform?.includes('B站') || platform?.includes('YouTube')) {
      return '16:9';
    }
    if (videoType === 'DRAMA' || videoType === 'DOC') {
      return '16:9';
    }
    return '9:16';
  }

  _inferAudience(videoType) {
    const audienceMap = {
      'EDU': '普通大众',
      'SOC': '18-25岁年轻群体',
      'ADV': '目标消费群体',
      'DOC': '深度内容爱好者',
      'DRAMA': '18-35岁城市人群',
      'COR': '商务人士/合作伙伴',
      'EVT': '活动参与者',
      'VLOG': '生活方式关注者',
      'MV': '音乐爱好者'
    };
    return audienceMap[videoType] || '普通大众';
  }

  _getVideoTypeName(code) {
    const names = {
      'EDU': '教育科普', 'SOC': '社媒短视频', 'ADV': '商业广告',
      'DOC': '纪录片', 'DRAMA': '短剧/微电影', 'COR': '企业宣传',
      'EVT': '活动记录', 'VLOG': 'Vlog/记录', 'MV': '音乐视频'
    };
    return names[code] || code;
  }

  _mapQuality(intensity) {
    if (intensity <= 0.2) return 'standard';
    if (intensity <= 0.4) return 'premium';
    if (intensity <= 0.7) return 'artistic';
    return 'ultimate';
  }

  _calculateConfidence(result) {
    const confidence = {};
    
    confidence.videoType = result.videoTypeConfidence || 
      (result.videoType ? 0.7 : 0.3);
    
    confidence.title = result.title ? 1.0 : 0.2;
    confidence.duration = result.duration ? 
      (result.durationInferred ? 0.6 : 1.0) : 0.3;
    confidence.style = result.style?.primary ? 
      (result.styleInferred ? 0.6 : 0.85) : 0.3;
    confidence.creativeIntensity = result.creativeIntensity !== undefined ? 
      (result.creativeIntensityInferred ? 0.5 : 1.0) : 0.4;
    confidence.platform = result.platform ? 
      (result.platformInferred ? 0.5 : 0.9) : 0.3;
    
    return confidence;
  }

  _mergeWithFeedback(current, feedback, feedbackText) {
    // 简单的合并策略：用户反馈覆盖当前值
    const merged = JSON.parse(JSON.stringify(current));
    
    // 如果反馈中明确修改了某个字段，使用反馈的值
    if (feedback.basicInfo?.title && feedback.basicInfo.title !== '未命名视频') {
      merged.basicInfo.title = feedback.basicInfo.title;
    }
    if (feedback.basicInfo?.videoType) {
      merged.basicInfo.videoType = feedback.basicInfo.videoType;
      merged.basicInfo.videoTypeName = feedback.basicInfo.videoTypeName;
    }
    if (feedback.productionSpecs?.duration?.target) {
      merged.productionSpecs.duration.target = feedback.productionSpecs.duration.target;
    }
    if (feedback.productionSpecs?.creativeIntensity !== undefined) {
      merged.productionSpecs.creativeIntensity = feedback.productionSpecs.creativeIntensity;
    }
    if (feedback.productionSpecs?.style?.primary) {
      merged.productionSpecs.style.primary = feedback.productionSpecs.style.primary;
    }
    
    // 记录迭代历史
    if (!merged._iterationHistory) merged._iterationHistory = [];
    merged._iterationHistory.push({
      feedback: feedbackText,
      timestamp: new Date().toISOString()
    });
    
    return merged;
  }
  
  /**
   * v6.6.4: 生成《视频需求要点清单》Markdown文档
   * 用于用户确认环节，必须包含所有关键字段
   * @param {Object} parseResult - 解析结果
   * @returns {string} Markdown格式的需求清单
   */
  generateRequirementList(parseResult) {
    const basic = parseResult.basicInfo;
    const specs = parseResult.productionSpecs;
    const creative = parseResult.contentCreative;
    const structure = parseResult.structure;
    const series = parseResult.series;
    const confidence = parseResult.fieldConfidence || {};
    const notes = parseResult.aiDecisionNotes || {};
    
    const styleDesc = this.styleEncoder.expandStyle(
      specs.style.primary,
      specs.style.secondary,
      basic.videoType
    );
    
    const formatConfidence = (field) => {
      const conf = confidence[field];
      if (conf === undefined) return '—';
      if (conf >= 0.8) return '✅ 高置信度';
      if (conf >= 0.6) return '⚠️ 中等置信度';
      return '❓ 低置信度（建议确认）';
    };
    
    const formatInferred = (field) => {
      const note = notes[field];
      if (!note) return '';
      return note.includes('AI推断') ? ' *(AI推断)*' : ' *(用户指定)*';
    };

    return `# 🎬 视频需求要点清单

> **生成时间**: ${new Date().toLocaleString('zh-CN')}
> **版本**: v6.6.4
> **状态**: 待确认 ⏳

---

## 一、基本信息

| 字段 | 值 | 置信度 |
|------|-----|--------|
| **视频类型** | ${basic.videoTypeName || basic.videoType} | ${formatConfidence('videoType')}${formatInferred('videoType')} |
| **主题/标题** | ${basic.title || '未命名'} | ${formatConfidence('title')}${formatInferred('title')} |
| **目标受众** | ${basic.targetAudience || '—'} | — |
| **投放平台** | ${basic.platform || '—'} | ${formatConfidence('platform')}${formatInferred('platform')} |

## 二、制作规格

| 字段 | 值 | 置信度 |
|------|-----|--------|
| **目标时长** | ${specs.duration?.target || '—'} 秒 | ${formatConfidence('duration')}${formatInferred('duration')} |
| **画幅比例** | ${specs.aspectRatio || '—'} | — |
| **创意指数** | ${specs.creativeIntensity !== undefined ? specs.creativeIntensity.toFixed(1) : '—'} / 1.0 | ${formatConfidence('creativeIntensity')}${formatInferred('creativeIntensity')} |
| **质量等级** | ${specs.quality || '—'} | — |
| **色彩基调** | ${specs.colorTone || '根据风格自动匹配'} | — |

### 风格设定
- **主风格**: ${specs.style.primaryName || specs.style.primary || '—'}${formatInferred('style')}
- **辅助风格**: ${specs.style.secondaryNames?.join('、') || '无'}${formatInferred('style')}
- **风格描述**: ${styleDesc}

## 三、内容创意

| 字段 | 值 |
|------|-----|
| **叙事模式** | ${creative.narrativeMode || '—'} |
| **内容调性** | ${creative.contentTone || '—'} |
| **视觉风格** | ${creative.visualStyle || '—'} |
| **音乐风格** | ${creative.musicStyle || '根据风格自动匹配'} |

## 四、角色信息

${basic.characters?.length > 0 ? basic.characters.map((char, i) => `
**角色 ${i + 1}: ${char.name || '未命名'}**
- 描述: ${char.description || '—'}
- 角色定位: ${char.role || '—'}
`).join('') : '*(无角色信息)*'}

## 五、结构规划

### 开场
- ${structure.opening?.enabled ? '✅ 启用' : '❌ 跳过'}
${structure.opening?.title ? `  - 标题: ${structure.opening.title}` : ''}
${structure.opening?.subtitle ? `  - 副标题: ${structure.opening.subtitle}` : ''}

### 场景规划
${structure.scenes?.length > 0 ? structure.scenes.map((s, i) => `- 场景 ${i + 1}: ${s.description || s.type || '—'} (${s.duration || '—'}秒)`).join('\n') : '*(待生成)*'}

### 结尾
- 风格: ${structure.ending?.style || '—'}
- 下集预告: ${structure.ending?.previewNext ? '✅ 是' : '❌ 否'}

## 六、系列信息

${series.isSeries ? `
- **系列模式**: ✅ 是
- **总集数**: ${series.totalEpisodes || '—'} 集
- **当前集数**: 第 ${series.currentEpisode || '—'} 集
- **集间隔离**: ${series.contentIsolation ? '✅ 已启用' : '❌ 未启用'}
` : '- **系列模式**: 否（单集）'}

## 七、系统约束

| 约束项 | 限制 |
|--------|------|
| 单集最长时长 | 180秒 |
| 单个镜头最长 | 15秒 |
| 总时长上限 | 20分钟（1200秒） |
| 系列最多集数 | 7集（推荐5集） |

---

## ⚠️ 需要确认的事项

${parseResult.requiresConfirmation?.length > 0 ? parseResult.requiresConfirmation.map(f => `- **${f}**: 置信度较低，请确认`).join('\n') : '*(所有字段置信度均较高，无需特别确认)*'}

## 📝 AI决策说明

${Object.entries(notes).map(([field, note]) => `- **${field}**: ${note}`).join('\n') || '*(无AI决策说明)*'}

---

## ✅ 请确认

**请检查以上信息是否准确，如有修改意见请直接提出。**

确认方式：
- ✅ **确认无误** → 回复"确认"，进入预生产链路
- ✏️ **需要修改** → 指出具体修改项，最多迭代1-2轮
- ❌ **放弃** → 回复"取消"

> **注意**: 未确认前，预生产链路不会启动。这是为了确保最终成片符合您的预期。
`;
  }

  /**
   * v6.6.4: 保存需求清单到文件
   * @param {Object} parseResult - 解析结果
   * @param {string} outputPath - 输出路径（可选）
   * @returns {string} 文件路径
   */
  async saveRequirementList(parseResult, outputPath) {
    const markdown = this.generateRequirementList(parseResult);
    const fs = require('fs').promises;
    const path = require('path');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = outputPath || path.join(
      process.cwd(),
      'output',
      'requirement-lists',
      `requirement-list-${timestamp}.md`
    );
    
    // 确保目录存在
    await fs.mkdir(path.dirname(defaultPath), { recursive: true });
    await fs.writeFile(defaultPath, markdown, 'utf-8');
    
    return defaultPath;
  }

  /**
   * v6.6.4: 检查用户反馈是否包含确认指令
   * @param {string} feedback - 用户反馈文本
   * @returns {Object} { confirmed: boolean, modifications: Array, cancelled: boolean }
   */
  parseUserConfirmation(feedback) {
    const text = feedback.toLowerCase().trim();
    
    // 确认指令
    const confirmPatterns = ['确认', '没问题', 'ok', '可以', '对的', 'yes', '是的', '没错', '就这样', '通过'];
    const confirmed = confirmPatterns.some(p => text.includes(p));
    
    // 取消指令
    const cancelPatterns = ['取消', '放弃', '算了', 'stop', 'no', '不要'];
    const cancelled = cancelPatterns.some(p => text.includes(p));
    
    // 提取修改意见（简单实现）
    const modifications = [];
    if (!confirmed && !cancelled) {
      // 尝试提取"修改XXX为YYY"的模式
      const modifyMatches = text.match(/修改(.+?)为(.+?)[，。！]/g);
      if (modifyMatches) {
        modifyMatches.forEach(m => {
          const parts = m.match(/修改(.+?)为(.+?)[，。！]/);
          if (parts) {
            modifications.push({ field: parts[1].trim(), value: parts[2].trim() });
          }
        });
      }
    }
    
    return { confirmed, cancelled, modifications };
  }
}

module.exports = { UserRequirementParser, StyleEncoder, ParserRules };
