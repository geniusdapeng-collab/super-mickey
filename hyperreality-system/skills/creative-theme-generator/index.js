/**
 * CreativeThemeGenerator - 创意主题生成器
 * 位置: 全链路最开头
 * 职责: 将任意用户输入转化为结构化的12字段创意主题
 * v2.1.7: 新增模块，解决用户输入→标准化需求的断层
 */

const { EventBus } = require('../../infrastructure/event-bus');

// ============ 配置常量 ============
const TYPE_LIBRARY = {
  '医疗急救': ['医疗', '医院', '急救', '手术', '医生', '护士', '抢救'],
  '硬科幻': ['科幻', '太空', '未来', '火星', '星际', '宇宙', '飞船'],
  '赛博朋克': ['赛博', '朋克', '霓虹', '黑客', '义体', '未来都市'],
  '武侠动作': ['武侠', '古装', '剑客', '江湖', '功夫', '门派'],
  '恐怖悬疑': ['恐怖', '惊悚', '悬疑', '鬼', '灵异', '密室'],
  '自然纪录片': ['自然', '动物', '森林', '海洋', '纪录片', '生态'],
  '美食文化': ['美食', '餐厅', '料理', '烹饪', '厨师', '食材'],
  '商业广告': ['商业', '广告', '产品', '品牌', '宣传', '营销'],
  '科普教育': ['科普', '教育', '知识', '科学', '教学', '讲解'],
  '音乐MV': ['音乐', '舞蹈', 'MV', '节奏', '歌曲', '演唱会'],
  '家庭温情': ['家庭', '亲情', '温情', '父母', '孩子', '团圆'],
  '浪漫爱情': ['爱情', '浪漫', '恋爱', '约会', '情侣', '告白'],
  '喜剧荒诞': ['喜剧', '搞笑', '幽默', '荒诞', '无厘头', '讽刺'],
  '历史战争': ['历史', '战争', '古代', '朝代', '战场', '将军'],
  '艺术实验': ['艺术', '实验', '抽象', '意识', '先锋', '独立'],
  '社会现实': ['社会', '现实', '底层', '民生', '阶层', '都市'],
  '运动竞技': ['运动', '体育', '竞技', '比赛', '运动员', '冠军'],
  '文化遗产': ['文化', '遗产', '传统', '工艺', '非遗', '文物']
};

const TONE_LIBRARY = {
  '紧张压抑': ['紧张', '压抑', '窒息', '紧迫', '危机', '危急'],
  '温暖治愈': ['温暖', '治愈', '感人', '温情', '暖心', '感动'],
  '黑色幽默': ['搞笑', '幽默', '荒诞', '无厘头', '讽刺', '喜剧'],
  '心理恐惧': ['恐怖', '吓人', '诡异', '阴森', '毛骨悚然'],
  '热血感动': ['热血', '激动', '燃', '震撼', '励志', '拼搏'],
  'bittersweet': ['浪漫', '甜蜜', '苦涩', '遗憾', '错过'],
  '神秘敬畏': ['神秘', '未知', '探索', '好奇', '浩瀚', '深邃'],
  '冷酷精密': ['冷酷', '冰冷', '无情', '机械', '理性', '精准'],
  '诗意哀伤': ['诗意', '抒情', '忧伤', '哀愁', '孤独', '怀旧'],
  '肃杀诗意': ['肃杀', '冷峻', '凌厉', '悲壮', '苍凉'],
  '轻快明朗': ['欢快', '明亮', '轻松', '愉快', '阳光'],
  '史诗悲壮': ['史诗', '宏大', '悲壮', '英雄', '牺牲']
};

const DIFFICULTY_KEYWORDS = {
  '极高': ['极限', '硬核', '地狱', '不可能', '疯狂', '终极'],
  '高': ['有挑战', '有压力', '困难', '高级', '复杂'],
  '中': ['中等', '正常', '标准', '普通', '一般'],
  '低': ['简单', '入门', '基础', '轻松', '容易']
};

const PRESSURE_ANCHORS = [
  { id: 'PA-01', name: '物理模拟', tags: ['流体', '刚体', '布料', '粒子', '烟雾', '火焰'], types: ['硬科幻', '灾难', '武侠动作'] },
  { id: 'PA-02', name: '微表情/表演', tags: ['面部', '瞳孔', '呼吸', '眼神'], types: ['医疗急救', '浪漫爱情', '家庭温情'] },
  { id: 'PA-03', name: '群像调度', tags: ['多角色', '站位', '视线', '走位'], types: ['历史战争', '武侠动作', '商业广告'] },
  { id: 'PA-04', name: '一镜到底', tags: ['长镜头', '无剪辑', '连续性'], types: ['艺术实验', '动作', '恐怖悬疑'] },
  { id: 'PA-05', name: '科学可视化', tags: ['抽象概念', '公式', '数据', '微观'], types: ['硬科幻', '科普教育'] },
  { id: 'PA-06', name: '文化遗产', tags: ['历史精确', '工艺', '服饰', '道具'], types: ['历史战争', '文化遗产', '武侠动作'] },
  { id: 'PA-07', name: '零重力/特殊物理', tags: ['太空', '深海', '微观', '非地球'], types: ['硬科幻', '自然纪录片'] },
  { id: 'PA-08', name: '音乐/节拍同步', tags: ['视听同步', 'BPM', '节奏', '舞蹈'], types: ['音乐MV', '艺术实验'] },
  { id: 'PA-09', name: '非线性叙事', tags: ['时间跳跃', '意识流', '记忆碎片'], types: ['艺术实验', '恐怖悬疑', '心理'] },
  { id: 'PA-10', name: '行业术语精确', tags: ['医学', '法律', '军事', '工程'], types: ['医疗急救', '历史战争'] },
  { id: 'PA-11', name: '生物力学', tags: ['运动', '变形', '病理', '古生物'], types: ['运动竞技', '自然纪录片', '武侠动作'] },
  { id: 'PA-12', name: '视觉欺骗', tags: ['透视违反', '超现实', '非欧几何'], types: ['艺术实验', '恐怖悬疑'] }
];

const FILM_REFERENCES = {
  '医疗急救': ['《急诊室的故事》', '《白色巨塔》', '《机智医生生活》'],
  '硬科幻': ['《星际穿越》', '《2001太空漫游》', '《降临》'],
  '赛博朋克': ['《银翼杀手2049》', '《攻壳机动队》', '《阿基拉》'],
  '武侠动作': ['《卧虎藏龙》', '《绣春刀》', '《一代宗师》'],
  '恐怖悬疑': ['《怪形》', '《恐怖游轮》', '《遗传厄运》'],
  '自然纪录片': ['《蓝色星球》', '《绿色星球》', '《我们的星球》'],
  '商业广告': ['苹果发布会风格', '《她》科技美学'],
  '科普教育': ['《宇宙时空之旅》', '《细胞》', '《人体奥秘》'],
  '音乐MV': ['《爱乐之城》', '《幻想曲2000》', '《创：战纪》'],
  '家庭温情': ['《海街日记》', '《步履不停》', '《美丽人生》'],
  '浪漫爱情': ['《爱》', '《本杰明·巴顿奇事》', '《时空恋旅人》'],
  '喜剧荒诞': ['《楚门的世界》', '《布达佩斯大饭店》', '《摩登时代》'],
  '历史战争': ['《拯救大兵瑞恩》', '《1917》', '《大明王朝1566》'],
  '社会现实': ['贾樟柯作品风格', '《十二怒汉》', '《我不是药神》'],
  '艺术实验': ['《镜子》', '《永恒和一日》', '《入侵脑细胞》'],
  '运动竞技': ['《烈火战车》', '《极速车王》', '《摔跤吧爸爸》'],
  '美食文化': ['《舌尖上的中国》', '《主厨的餐桌》', '《小森林》'],
  '文化遗产': ['《我在故宫修文物》', '《数字敦煌》', '《至爱梵高》']
};

const TYPE_DURATION_RANGES = {
  '医疗急救': { min: 40, max: 60 },
  '硬科幻': { min: 45, max: 60 },
  '赛博朋克': { min: 35, max: 55 },
  '武侠动作': { min: 40, max: 60 },
  '恐怖悬疑': { min: 35, max: 50 },
  '自然纪录片': { min: 40, max: 60 },
  '美食文化': { min: 30, max: 45 },
  '商业广告': { min: 15, max: 30 },
  '科普教育': { min: 30, max: 50 },
  '音乐MV': { min: 30, max: 60 },
  '家庭温情': { min: 30, max: 50 },
  '浪漫爱情': { min: 30, max: 50 },
  '喜剧荒诞': { min: 25, max: 45 },
  '历史战争': { min: 45, max: 60 },
  '艺术实验': { min: 40, max: 60 },
  '社会现实': { min: 35, max: 50 },
  '运动竞技': { min: 35, max: 55 },
  '文化遗产': { min: 40, max: 60 }
};

const TYPE_AUDIENCE = {
  '医疗急救': '医学专业人士/医疗剧爱好者',
  '硬科幻': '科幻迷/科技从业者',
  '赛博朋克': '科幻游戏玩家/视觉系观众',
  '武侠动作': '武侠片爱好者/动作片观众',
  '恐怖悬疑': '惊悚片爱好者/年轻成人',
  '自然纪录片': '自然爱好者/全年龄',
  '美食文化': '美食爱好者/生活方式受众',
  '商业广告': '目标消费者/品牌受众',
  '科普教育': '学生/知识爱好者',
  '音乐MV': '音乐爱好者/年轻群体',
  '家庭温情': '家庭观众/亲情主题爱好者',
  '浪漫爱情': '爱情片观众/年轻女性',
  '喜剧荒诞': '喜剧爱好者/全年龄',
  '历史战争': '历史爱好者/男性观众',
  '艺术实验': '电影节观众/艺术爱好者',
  '社会现实': '文艺片观众/关注社会议题者',
  '运动竞技': '体育爱好者/年轻男性',
  '文化遗产': '文化爱好者/高知群体'
};

// ============ 输入规范化器 ============
class InputNormalizer {
  /**
   * 将任意格式输入统一规范化为纯文本描述
   * 支持: JSON、Python dict、纯文本、Markdown 等
   */
  normalize(input) {
    const text = String(input || '').trim();
    
    // 场景1: JSON 格式
    if ((text.startsWith('{') && text.endsWith('}')) || 
        (text.startsWith('[') && text.endsWith(']'))) {
      return this._normalizeJSON(text);
    }
    
    // 场景2: Python dict 格式 (key='value' 或 key="value")
    if (text.includes("='") || text.includes('="') || text.includes('": ')) {
      const pythonResult = this._normalizePythonDict(text);
      if (pythonResult) return pythonResult;
    }
    
    // 场景3: 代码块 (```json/```python)
    if (text.includes('```')) {
      const codeResult = this._normalizeCodeBlock(text);
      if (codeResult) return codeResult;
    }
    
    // 场景4: 纯文本（直接返回）
    return { text, format: 'text', sourceFields: {} };
  }
  
  _normalizeJSON(text) {
    try {
      const data = JSON.parse(text);
      return this._extractFromObject(data, 'json');
    } catch (e) {
      // JSON 解析失败，可能是截断或不完整的 JSON，尝试提取关键字段
      return this._extractFieldsFromText(text, 'json-partial');
    }
  }
  
  _normalizePythonDict(text) {
    // 尝试匹配 key='value' 或 key="value" 或 key: value 模式
    const fieldPatterns = [
      // "key": "value" 或 'key': 'value'
      /['"](\w+)['"]\s*:\s*['"]([^'"]+)['"]/g,
      // key='value'
      /(\w+)\s*=\s*['"]([^'"]+)['"]/g,
      // key: value (无引号字符串)
      /['"](\w+)['"]\s*:\s*([^,\n\r]+)/g
    ];
    
    const fields = {};
    for (const pattern of fieldPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, key, value] = match;
        if (key && value) {
          fields[key] = value.trim();
        }
      }
    }
    
    if (Object.keys(fields).length >= 2) {
      return this._buildTextFromFields(fields, 'python-dict');
    }
    return null;
  }
  
  _normalizeCodeBlock(text) {
    // 提取 ```json/```python 等代码块内容
    const codeBlockPattern = /```(?:json|python)?\s*\n?([\s\S]*?)```/;
    const match = text.match(codeBlockPattern);
    if (match) {
      const content = match[1].trim();
      // 递归处理代码块内的内容
      return this.normalize(content);
    }
    return null;
  }
  
  _extractFromObject(data, format) {
    const fields = {};
    
    // 提取常见字段
    const fieldMap = {
      'type': ['type', '类型', 'category', 'genre'],
      'theme': ['theme', '主题', 'title', 'name'],
      'description': ['description', '描述', 'desc', 'content', 'prompt', 'story'],
      'duration_sec': ['duration_sec', 'duration', '时长', 'length', 'time'],
      'tone': ['tone', '情绪', 'mood', 'emotion', 'atmosphere'],
      'visual_style': ['visual_style', 'visual', '视觉风格', 'style'],
      'dialogue_requirement': ['dialogue_requirement', 'dialogue', '对白', '台词'],
      'special_notes': ['special_notes', 'special', '备注', 'notes', 'requirements'],
      'target_audience': ['target_audience', 'audience', '受众', '观众']
    };
    
    for (const [canonical, aliases] of Object.entries(fieldMap)) {
      for (const alias of aliases) {
        if (data[alias] !== undefined) {
          fields[canonical] = data[alias];
          break;
        }
      }
    }
    
    return this._buildTextFromFields(fields, format);
  }
  
  _buildTextFromFields(fields, format) {
    // 构建规范化文本：优先使用 description，其次是 theme + 其他字段
    const parts = [];
    
    // 1. 类型信息（如果有）
    if (fields.type) {
      parts.push(String(fields.type));
    }
    
    // 2. 主题信息（如果有）
    if (fields.theme) {
      parts.push(String(fields.theme));
    }
    
    // 3. 核心描述（最重要）
    if (fields.description) {
      parts.push(String(fields.description));
    }
    
    // 4. 其他补充信息
    const extraFields = ['dialogue_requirement', 'visual_style', 'special_notes', 'tone', 'target_audience'];
    for (const field of extraFields) {
      if (fields[field] && !parts.includes(String(fields[field]))) {
        parts.push(String(fields[field]));
      }
    }
    
    // 5. 时长信息
    if (fields.duration_sec) {
      parts.push(`${fields.duration_sec}秒`);
    }
    
    const normalizedText = parts.join('，');
    
    return {
      text: normalizedText,
      format,
      sourceFields: fields
    };
  }
  
  _extractFieldsFromText(text, format) {
    // 从非标准文本中提取可能的字段
    const fields = {};
    
    // 尝试匹配 "key": "value" 模式（可能是不完整的 JSON）
    const pairPattern = /['"](\w+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = pairPattern.exec(text)) !== null) {
      fields[match[1]] = match[2];
    }
    
    if (Object.keys(fields).length >= 2) {
      return this._buildTextFromFields(fields, format);
    }
    
    // 回退：返回清理后的文本
    const cleanText = text.replace(/[{}[\]"']/g, ' ').replace(/\s+/g, ' ').trim();
    return { text: cleanText, format, sourceFields: {} };
  }
}

// ============ 输入解析器 ============
class InputParser {
  parse(input) {
    // 【v2.1.8-fix】先规范化输入（支持 JSON/Python/纯文本等多种格式）
    const normalizer = new InputNormalizer();
    const normalized = normalizer.normalize(input);
    const text = normalized.text;
    
    console.log(`[InputParser] 输入格式: ${normalized.format}, 长度: ${text.length}字符`);
    
    // 场景C：无输入/随机
    if (!text || this._isRandomRequest(text)) {
      return { scene: 'C', input: text, sourceFields: normalized.sourceFields };
    }
    
    // 场景D：长篇文本
    if (text.length > 500) {
      return { scene: 'D', input: text, sourceFields: normalized.sourceFields };
    }
    
    // 场景B：单个关键词
    if (text.length < 20 && !text.includes(' ')) {
      return { scene: 'B', input: text, sourceFields: normalized.sourceFields };
    }
    
    // 场景E：部分字段检测（基于规范化后的文本）
    const partialFields = this._detectPartialFields(text, normalized.sourceFields);
    if (partialFields.length >= 2) {
      return { scene: 'E', input: text, partialFields, sourceFields: normalized.sourceFields };
    }
    
    // 场景A：自然语言描述
    return { scene: 'A', input: text, sourceFields: normalized.sourceFields };
  }
  
  _isRandomRequest(text) {
    const triggers = ['随便', '随机', '来一个', '推荐', '创意主题', '随便来', '来几个'];
    return triggers.some(t => text.includes(t));
  }
  
  _detectPartialFields(text, sourceFields = {}) {
    const fields = [];
    
    // 检测类型（基于描述内容而非关键词）
    const typeFromSource = sourceFields?.type;
    if (typeFromSource) {
      // 如果原始输入明确提供了类型，优先使用
      const normalizedType = this._normalizeTypeName(typeFromSource);
      if (normalizedType) {
        fields.push({ field: 'type', value: normalizedType });
      }
    }
    
    // 基于内容推断类型（改进：使用加权匹配而非简单包含）
    if (!fields.find(f => f.field === 'type')) {
      const inferredType = this._inferTypeWeighted(text);
      if (inferredType) {
        fields.push({ field: 'type', value: inferredType });
      }
    }
    
    // 检测时长
    const durationMatch = text.match(/(\d+)\s*(秒|分钟|分|s|min)/);
    if (durationMatch) {
      const num = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      const sec = unit === '分钟' || unit === '分' || unit === 'min' ? num * 60 : num;
      fields.push({ field: 'duration_sec', value: sec });
    }
    
    // 检测情绪
    for (const [tone, keywords] of Object.entries(TONE_LIBRARY)) {
      if (keywords.some(k => text.includes(k))) {
        fields.push({ field: 'tone', value: tone });
        break;
      }
    }
    return fields;
  }
  
  /**
   * 规范化类型名称（处理用户自定义类型）
   */
  _normalizeTypeName(typeName) {
    const typeMappings = {
      '音乐舞蹈·编舞同步': '音乐MV',
      '音乐MV': '音乐MV',
      '音乐': '音乐MV',
      '舞蹈': '音乐MV',
      '编舞': '音乐MV',
      '纪录片': '自然纪录片',
      '科幻': '硬科幻',
      '武侠': '武侠动作',
      '恐怖': '恐怖悬疑',
      '悬疑': '恐怖悬疑',
      '广告': '商业广告',
      '宣传片': '商业广告',
      '科普': '科普教育',
      '教育': '科普教育',
      '美食': '美食文化',
      '家庭': '家庭温情',
      '爱情': '浪漫爱情',
      '浪漫': '浪漫爱情',
      '喜剧': '喜剧荒诞',
      '搞笑': '喜剧荒诞',
      '历史': '历史战争',
      '战争': '历史战争',
      '运动': '运动竞技',
      '体育': '运动竞技',
      '文化': '文化遗产',
      '社会': '社会现实',
      '艺术': '艺术实验',
      '实验': '艺术实验'
    };
    
    const normalized = String(typeName).trim();
    return typeMappings[normalized] || null;
  }
  
  /**
   * 加权类型推断（避免单一关键词误匹配）
   * 策略: 统计每个类型的关键词命中数，选择得分最高的
   */
  _inferTypeWeighted(text) {
    const scores = {};
    
    for (const [type, keywords] of Object.entries(TYPE_LIBRARY)) {
      let score = 0;
      for (const keyword of keywords) {
        // 使用正则匹配完整词，避免子串误匹配
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex);
        if (matches) {
          // 长关键词权重更高
          score += matches.length * keyword.length;
        }
      }
      if (score > 0) {
        scores[type] = score;
      }
    }
    
    // 选择得分最高的类型
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    
    // 如果最高分明显领先（> 第二名的1.5倍），直接采用
    if (sorted.length === 1 || sorted[0][1] > sorted[1][1] * 1.5) {
      return sorted[0][0];
    }
    
    // 分数接近时，返回 null（让上层使用更多上下文判断）
    return null;
  }
}

// ============ 字段补全器 ============
class FieldCompleter {
  complete(fields, scene, input) {
    const result = { ...fields };
    
    // task_id
    if (!result.task_id) {
      result.task_id = this._generateTaskId(scene);
    }
    
    // type
    if (!result.type) {
      result.type = this._inferType(input);
    }
    
    // theme
    if (!result.theme) {
      result.theme = this._generateTheme(result.type, input);
    }
    
    // description
    if (!result.description) {
      result.description = this._generateDescription(result.type, result.theme, input);
    }
    
    // duration_sec
    if (!result.duration_sec) {
      result.duration_sec = this._deriveDuration(result.type, result.difficulty);
    }
    
    // creative_style
    if (result.creative_style === undefined) {
      result.creative_style = this._deriveCreativeStyle(result.type, result.difficulty);
    }
    
    // tone
    if (!result.tone) {
      result.tone = this._inferTone(input) || this._defaultTone(result.type);
    }
    
    // dialogue_requirement
    if (!result.dialogue_requirement) {
      result.dialogue_requirement = this._generateDialogueRequirement(result.type);
    }
    
    // visual_style
    if (!result.visual_style) {
      result.visual_style = this._generateVisualStyle(result.type);
    }
    
    // special_notes
    if (!result.special_notes) {
      result.special_notes = this._generateSpecialNotes(result.type, result.pressureAnchors || []);
    }
    
    // target_audience
    if (!result.target_audience) {
      result.target_audience = TYPE_AUDIENCE[result.type] || '一般观众';
    }
    
    // difficulty
    if (!result.difficulty) {
      result.difficulty = this._deriveDifficulty(result.pressureAnchors || []);
    }
    
    return result;
  }
  
  _generateTaskId(scene) {
    const prefix = scene === 'C' ? 'R' : scene === 'D' ? 'N' : 'C';
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return `${prefix}-${seq}`;
  }
  
  _inferType(input) {
    const text = String(input || '').toLowerCase();
    for (const [type, keywords] of Object.entries(TYPE_LIBRARY)) {
      if (keywords.some(k => text.includes(k.toLowerCase()))) {
        return type;
      }
    }
    return '艺术实验'; // 默认
  }
  
  /**
   * 加权类型推断（改进版，避免单一关键词误匹配）
   */
  _inferTypeWeighted(input) {
    const text = String(input || '').toLowerCase();
    const scores = {};
    
    for (const [type, keywords] of Object.entries(TYPE_LIBRARY)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword.toLowerCase(), 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length * keyword.length;
        }
      }
      if (score > 0) {
        scores[type] = score;
      }
    }
    
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return '艺术实验';
    
    if (sorted.length === 1 || sorted[0][1] > sorted[1][1] * 1.5) {
      return sorted[0][0];
    }
    
    return '艺术实验'; // 分数接近时，使用默认
  }
  
  _generateTheme(type, input) {
    const themes = {
      '医疗急救': ['创伤中心黄金10分钟', '深夜急诊室', '手术台上的抉择'],
      '硬科幻': ['火星沙尘暴中的救援', '深空信号', '最后一艘方舟'],
      '赛博朋克': ['霓虹雨夜', '义体医生的黄昏', '数据幽灵'],
      '武侠动作': ['竹林对决', '雪夜单刀', '破庙中的秘籍'],
      '恐怖悬疑': ['阁楼里的录音带', '最后一班地铁', '镜子里的陌生人'],
      '自然纪录片': ['深海发光生物', '极地追踪', '雨林隐秘王国'],
      '美食文化': ['深夜食堂', '最后的祖传秘方', '街头米其林'],
      '商业广告': ['下一秒，改变一切', '唤醒感官', '超越期待'],
      '科普教育': ['DNA的双螺旋之舞', '黑洞边缘', '细胞内的城市'],
      '音乐MV': ['雨中的节奏', '霓虹梦', '最后一支舞'],
      '家庭温情': ['爸爸的便当', '回家的路', '老照片'],
      '浪漫爱情': ['便利店的暖光', '迟到的告白', '平行时空的相遇'],
      '喜剧荒诞': ['冰箱里的宇宙', '会说话的猫', '时间管理局'],
      '历史战争': ['烽火家书', '最后的骑兵', '战壕里的钢琴'],
      '艺术实验': ['光影迷宫', '时间的形状', '记忆的碎片'],
      '社会现实': ['城中村的星空', '快递员的地图', '凌晨四点的早餐铺'],
      '运动竞技': ['0.01秒的差距', '逆风翻盘', '最后一投'],
      '文化遗产': ['故宫的晨钟', '修复时光', '非遗新生']
    };
    const typeThemes = themes[type] || ['未命名主题'];
    return typeThemes[Math.floor(Math.random() * typeThemes.length)];
  }
  
  _generateDescription(type, theme, input) {
    // 【v2.1.7-fix】基于输入和类型生成核心描述，不再使用随机占位符
    const cleanInput = String(input || '').replace(/[，。！？]/g, ' ').trim();
    
    // 如果输入已包含具体场景/情节描述，直接提取作为核心描述
    if (cleanInput.length > 5) {
      // 提取核心动作/事件：过滤掉修饰词和数字时间
      const core = cleanInput
        .replace(/\b(制作|生成|一个|视频|短片|关于|的|了|在|和|与|以及|需要|想要|给我|帮我|请|一下|秒|分钟|分钟|30|60|90|15|10|5|20)\b/g, '')
        .trim();
      if (core.length > 3) {
        return `${core}主题叙事，融合视觉冲击力与情感深度，展现独特的世界观与角色张力`;
      }
    }
    
    // 回退：基于类型生成结构化描述
    const typeDesc = {
      '医疗急救': '围绕生死边缘的紧张抉择展开，展现医疗团队的专业与温度',
      '硬科幻': '在未知宇宙边界中探索人类命运，融合硬核科技想象与哲学追问',
      '武侠动作': '古典侠义精神与现代视觉语言交融，展现极致动作美学与江湖情义',
      '恐怖悬疑': '在心理恐惧与未知真相之间构建张力，层层剥茧直至核心反转',
      '自然纪录片': '捕捉自然世界的壮丽与脆弱，用镜头语言讲述生命共生故事',
      '浪漫爱情': '在情感流动中刻画人性柔软，用视觉诗意呈现爱的不同形态',
      '家庭温情': '在日常细节中发掘深层情感，以温暖视角审视家庭与归属',
      '喜剧荒诞': '以荒诞镜像折射现实，在笑声中包裹尖锐的社会观察',
      '历史战争': '重现史诗时刻中的人性抉择，用视觉宏大叙事承载历史重量',
      '艺术实验': '打破常规叙事边界，用视觉与声音实验探索感知新维度',
      '社会现实': '扎根真实生活切片，用克制而有力的镜头呈现时代切片',
      '运动竞技': '捕捉极限瞬间中的身体美学与意志力量，展现竞技精神',
      '文化遗产': '在现代语境中重新激活传统，让文化遗产获得当代视觉表达',
      '商业广告': '以精准视觉策略传递品牌价值，创造 memorable 的感官记忆',
      '科普教育': '将抽象知识转化为可感知的视觉体验，让认知过程充满美感',
      '音乐MV': '用视听通感放大音乐情绪，创造沉浸式的感官旅程'
    };
    return typeDesc[type] || '融合视觉冲击力与情感深度的原创叙事';
  }
  
  _deriveDuration(type, difficulty) {
    const range = TYPE_DURATION_RANGES[type] || { min: 30, max: 60 };
    const base = Math.floor((range.min + range.max) / 2);
    if (difficulty === '极高') return Math.min(range.max, base + 10);
    if (difficulty === '高') return base;
    if (difficulty === '低') return Math.max(range.min, base - 10);
    return base;
  }
  
  _deriveCreativeStyle(type, difficulty) {
    const ranges = {
      '医疗急救': [0.35, 0.60], '硬科幻': [0.70, 0.98], '赛博朋克': [0.65, 0.90],
      '武侠动作': [0.55, 0.80], '恐怖悬疑': [0.50, 0.75], '自然纪录片': [0.55, 0.80],
      '美食文化': [0.45, 0.70], '商业广告': [0.40, 0.65], '科普教育': [0.45, 0.70],
      '音乐MV': [0.60, 0.85], '家庭温情': [0.40, 0.65], '浪漫爱情': [0.50, 0.75],
      '喜剧荒诞': [0.55, 0.80], '历史战争': [0.50, 0.75], '艺术实验': [0.75, 1.0],
      '社会现实': [0.40, 0.65], '运动竞技': [0.50, 0.75], '文化遗产': [0.45, 0.70]
    };
    const [min, max] = ranges[type] || [0.4, 0.8];
    let csc = min + Math.random() * (max - min);
    if (difficulty === '极高') csc = Math.min(1.0, csc + 0.1);
    if (difficulty === '中') csc = Math.max(0.2, csc - 0.05);
    return parseFloat(csc.toFixed(2));
  }
  
  _inferTone(input) {
    const text = String(input || '');
    for (const [tone, keywords] of Object.entries(TONE_LIBRARY)) {
      if (keywords.some(k => text.includes(k))) return tone;
    }
    return null;
  }
  
  _defaultTone(type) {
    const defaults = {
      '医疗急救': '紧张压抑', '硬科幻': '神秘敬畏', '赛博朋克': '冷酷精密',
      '武侠动作': '肃杀诗意', '恐怖悬疑': '心理恐惧', '自然纪录片': '神秘敬畏',
      '美食文化': '温暖治愈', '商业广告': '轻快明朗', '科普教育': '轻快明朗',
      '音乐MV': '热血感动', '家庭温情': '温暖治愈', '浪漫爱情': 'bittersweet',
      '喜剧荒诞': '黑色幽默', '历史战争': '史诗悲壮', '艺术实验': '诗意哀伤',
      '社会现实': '冷酷精密', '运动竞技': '热血感动', '文化遗产': '诗意哀伤'
    };
    return defaults[type] || '神秘敬畏';
  }
  
  _generateDialogueRequirement(type) {
    const requirements = {
      '医疗急救': '不超过6句医疗指令，每句不超过12字，包含一句关键诊断结论',
      '硬科幻': '科学解释+情感对白交织，不超过5句',
      '武侠动作': '武侠风格对白，含一句标志性台词',
      '恐怖悬疑': '暗示性对白，避免直白解释',
      '商业广告': 'slogan+产品卖点，不超过3句',
      '音乐MV': '歌词片段或情绪哼唱，配合节奏',
      '家庭温情': '自然日常对话，含一句情感金句',
      '浪漫爱情': '含蓄告白或遗憾独白，含一句记忆点台词',
      '喜剧荒诞': '反转对白或荒诞台词，含一句笑点',
      '历史战争': '简短有力的命令或家书式独白',
      '自然纪录片': '旁白解说，不超过100字',
      '科普教育': '解释性旁白+关键术语，不超过4句'
    };
    return requirements[type] || '根据场景需要设计对白，不超过5句';
  }
  
  _generateVisualStyle(type) {
    const refs = FILM_REFERENCES[type] || ['经典电影风格'];
    const ref = refs[Math.floor(Math.random() * refs.length)];
    const features = {
      '医疗急救': '冷白无影灯照明，手持摄影，仪器UI界面清晰',
      '硬科幻': '宏大尺度，科学精确，冷峻色调，IMAX质感',
      '赛博朋克': '霓虹光污染，雨夜反光，全息投影，未来都市',
      '武侠动作': '水墨意境，雨丝质感，慢动作美学，古典色调',
      '恐怖悬疑': '低光氛围，暗示性恐怖，声音设计，心理压迫',
      '自然纪录片': '微距细节，自然光，延时摄影，生态真实',
      '美食文化': '微距食物纹理，蒸汽，暖光，质感丰富',
      '商业广告': '极简构图，产品光效，留白，高级感',
      '科普教育': '科学可视化，动画解释，信息图层，清晰易懂'
    };
    return `${ref}风格，${features[type] || '电影级质感，专业摄影'}`;
  }
  
  _generateSpecialNotes(type, pressureAnchors) {
    const notes = [];
    // 根据类型生成至少3条
    const typeNotes = {
      '医疗急救': [
        '除颤器放电瞬间需展现电流从电极片扩散至胸腔的皮下透光效果',
        '心电监护仪波形需医学准确：室颤→平直→窦性心律的三阶段转变',
        '一镜到底：从走廊推车进入→推开手术室门→overhead无影灯亮起'
      ],
      '硬科幻': [
        '太空场景需展现零重力下物体漂浮的物理真实感',
        '星际航行场景需包含相对论时间膨胀的视觉暗示',
        '外星环境需设计独特的光照和大气散射效果'
      ],
      '武侠动作': [
        '武器碰撞需展现金属质感和火花粒子效果',
        '轻功场景需展现衣物飘动和气流扰动',
        '内功场景需设计能量流动的可视化表现'
      ],
      '恐怖悬疑': [
        '阴影区域需保留足够细节同时维持恐怖氛围',
        '镜面反射需设计渐进式恐怖 reveal',
        '声音设计需与视觉不同步制造不安感'
      ]
    };
    const defaultNotes = [
      '确保画面构图符合电影级标准，避免电视感',
      '光照需自然真实，避免过度后期感',
      '角色动作需流畅自然，避免机械感'
    ];
    const selected = typeNotes[type] || defaultNotes;
    return selected.slice(0, 3).map((n, i) => `①②③`[i] + n).join(' ');
  }
  
  _deriveDifficulty(pressureAnchors) {
    const count = pressureAnchors.length;
    if (count >= 3) return '极高';
    if (count === 2) return '高';
    if (count === 1) return '中';
    return '低';
  }
}

// ============ 压力锚点选择器 ============
class PressureAnchorSelector {
  select(type, input) {
    // 根据类型推荐相关PA
    const related = PRESSURE_ANCHORS.filter(pa => pa.types.includes(type));
    if (related.length === 0) {
      // 随机选1-2个
      return this._randomSelect(1, 2);
    }
    // 选1-3个不重复的
    const count = Math.min(3, Math.max(1, Math.floor(Math.random() * 3) + 1));
    const shuffled = this._shuffle([...related]);
    return shuffled.slice(0, count).map(pa => pa.id);
  }
  
  _randomSelect(min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = this._shuffle([...PRESSURE_ANCHORS]);
    return shuffled.slice(0, count).map(pa => pa.id);
  }
  
  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// ============ 质量检查器 ============
class QualityChecker {
  check(task) {
    const checks = [];
    
    // 1. 画面感测试
    checks.push({
      name: '画面感测试',
      pass: this._hasVisualImagery(task.description),
      message: '描述能否形成至少3个视觉画面'
    });
    
    // 2. 可执行性测试
    checks.push({
      name: '可执行性测试',
      pass: task.type && task.theme && task.duration_sec > 0,
      message: 'AI视频系统能否生成具体提示词'
    });
    
    // 3. 时长合理性
    checks.push({
      name: '时长合理性',
      pass: task.duration_sec >= 15 && task.duration_sec <= 120,
      message: '时长是否在合理范围内'
    });
    
    // 4. 参考影片
    checks.push({
      name: '参考影片',
      pass: task.visual_style && task.visual_style.includes('《'),
      message: '是否包含具体影片参考'
    });
    
    // 5. 特殊要求
    checks.push({
      name: '特殊要求',
      pass: task.special_notes && task.special_notes.includes('①'),
      message: '是否包含至少3条特殊要求'
    });
    
    const passed = checks.filter(c => c.pass).length;
    return {
      total: checks.length,
      passed,
      failed: checks.length - passed,
      checks,
      passed: passed === checks.length
    };
  }
  
  _hasVisualImagery(description) {
    const visualWords = ['镜头', '画面', '特写', '全景', '光影', '色彩', '构图', '景别', '推轨', '手持'];
    const count = visualWords.filter(w => description.includes(w)).length;
    return count >= 2;
  }
}

// ============ 主类：创意主题生成器 ============
class CreativeThemeGenerator {
  constructor(options = {}) {
    this.inputParser = new InputParser();
    this.fieldCompleter = new FieldCompleter();
    this.paSelector = new PressureAnchorSelector();
    this.qualityChecker = new QualityChecker();
    this.eventBus = options.eventBus || new EventBus();
  }
  
  /**
   * 主入口：生成创意主题
   * @param {string} input - 用户输入（任意格式）
   * @returns {Object} 包含tasks数组的结果
   */
  async generate(input) {
    console.log('[CreativeThemeGenerator] 开始解析用户输入...');
    
    // Step 1: 解析输入场景（含规范化）
    const parseResult = this.inputParser.parse(input);
    console.log(`[CreativeThemeGenerator] 识别场景: ${parseResult.scene}`);
    
    // Step 2: 提取已有字段（优先用户明确指定的）
    const extractedFields = this._extractFields(parseResult);
    
    // Step 3: 选择压力锚点
    const type = extractedFields.type || this.fieldCompleter._inferTypeWeighted(parseResult.input);
    const pressureAnchors = this.paSelector.select(type, parseResult.input);
    extractedFields.pressureAnchors = pressureAnchors;
    
    // Step 4: 补全所有字段
    const completedTask = this.fieldCompleter.complete(extractedFields, parseResult.scene, parseResult.input);
    
    // Step 5: 质量检查
    const quality = this.qualityChecker.check(completedTask);
    console.log(`[CreativeThemeGenerator] 质量检查: ${quality.passed}/${quality.total} 通过`);
    
    // Step 6: 组装输出
    const result = {
      meta: {
        version: '2.1.8',
        generated_at: new Date().toISOString().split('T')[0],
        total_tasks: 1,
        batch_name: '用户定制生成',
        purpose: '基于用户输入的定向创意主题生成'
      },
      tasks: [completedTask],
      quality: quality
    };
    
    // 发布事件
    this.eventBus.emit('creative-theme:generated', {
      taskId: completedTask.task_id,
      type: completedTask.type,
      theme: completedTask.theme
    });
    
    return result;
  }
  
  /**
   * 从解析结果中提取字段
   */
  _extractFields(parseResult) {
    const fields = {};
    
    // 优先使用原始输入中的明确字段（如 JSON 中的 type、theme 等）
    if (parseResult.sourceFields) {
      Object.assign(fields, parseResult.sourceFields);
    }
    
    // 然后叠加 partialFields
    if (parseResult.partialFields) {
      for (const pf of parseResult.partialFields) {
        // 如果 sourceFields 中已有该字段，优先保留（用户明确指定的）
        if (fields[pf.field] === undefined) {
          fields[pf.field] = pf.value;
        }
      }
    }
    return fields;
  }
  
  /**
   * 生成用户确认用的摘要文本
   */
  generateConfirmationSummary(result) {
    const task = result.tasks[0];
    return `
╔══════════════════════════════════════════╗
║      🎬 创意主题生成确认单               ║
╠══════════════════════════════════════════╣
║ 类型: ${task.type.padEnd(30)}║
║ 主题: ${task.theme.padEnd(30)}║
║ 时长: ${String(task.duration_sec + '秒').padEnd(30)}║
║ 难度: ${task.difficulty.padEnd(30)}║
║ 创意系数: ${String(task.creative_style).padEnd(26)}║
║ 情绪基调: ${task.tone.padEnd(28)}║
╠══════════════════════════════════════════╣
║ 📋 核心描述:                             ║
║ ${task.description.substring(0, 36).padEnd(40)}║
╠══════════════════════════════════════════╣
║ 🎨 视觉风格:                             ║
║ ${task.visual_style.substring(0, 36).padEnd(40)}║
╠══════════════════════════════════════════╣
║ 💬 台词要求:                             ║
║ ${task.dialogue_requirement.substring(0, 36).padEnd(40)}║
╠══════════════════════════════════════════╣
║ 🎯 目标受众: ${task.target_audience.substring(0, 26).padEnd(26)}║
╚══════════════════════════════════════════╝

请确认以上创意主题是否符合您的预期：
• 回复 "确认" 或 "OK" → 进入视频生成链路
• 回复 "调整:字段=值" → 修改指定字段
• 回复 "重新生成" → 基于相同输入重新生成
• 回复具体修改意见 → 我将据此调整
`;
  }
  
  /**
   * 根据用户反馈调整任务
   */
  adjustTask(result, adjustments) {
    const task = { ...result.tasks[0] };
    
    for (const [field, value] of Object.entries(adjustments)) {
      if (task[field] !== undefined) {
        task[field] = value;
        console.log(`[CreativeThemeGenerator] 调整字段: ${field} = ${value}`);
      }
    }
    
    // 重新检查
    const quality = this.qualityChecker.check(task);
    
    return {
      ...result,
      tasks: [task],
      quality,
      adjusted: true
    };
  }
}

module.exports = { CreativeThemeGenerator };
