/**
 * PromptFusionAgent - Prompt融合Agent（核心）
 * 负责: 将L3-L7元素创造性融合成导演分镜脚本
 * 策略: L1/L2/L9硬约束走规则，L3-L7走LLM融合
 * v2.1.4-fix8: LLM输出标准字段格式（【约束】【基础】【场景】等）
 */
const { BaseAgent } = require('./base-agent');

class PromptFusionAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'PromptFusionAgent', enabled: true, llmTimeout: 600000, ...options });
    this.maxPromptLength = options.maxPromptLength || 2500;
    this.concurrency = options.concurrency || 3;
  }

  _getSystemPrompt() {
    return `你是一位资深电影导演和摄影师。根据镜头信息，为每个镜头生成结构化的导演分镜提示词。

【核心要求】
你必须按以下标准字段格式输出，每个字段独立清晰，不要混合成一段narrative文本：

字段列表（严格按此顺序）：
1. 【约束】：技术参数约束，必须包含画幅比例(Aspect ratio)、分辨率(Resolution)、格式(Format)、帧率(Frame rate)。标准格式："Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark"
2. 【基础】：画质基础词，必须包含三类：①分辨率锚定(8K resolution/ultra high definition)、②风格质量(cinematic quality/photorealistic/hyperrealistic)、③细节增强(highly detailed/intricate textures/sharp focus)。标准格式："8K resolution, cinematic quality, highly detailed, photorealistic"
3. 【场景】：具体场景环境描述（地点、时间、空间深度、材质细节）
4. 【灯光/照明】：专业灯光设计（主光方向+色温K值+光比+特效光）。格式："主光：右侧45度顶光 5600K冷白光，柔光箱漫射；补光：左前侧反光板 3200K暖光，填充阴影；背景光：轮廓光分离人物与背景；特效：无"；必须包含主光方向（左/右/顶/底/正前/正后）、色温（K值）、光质（硬光/柔光/漫射）
5. 【构图】：景别+画面比例+主体位置+线条引导。格式："景别：中景（膝上）；主体位置：画面黄金分割右1/3处；线条引导：走廊纵深感由近及远；画框边缘：左侧留白1/4给背景信息"
6. 【色彩/色调】：调色方案+色温倾向+饱和度。格式："主色调：冷白偏青（医院感）；辅助色：暖木色讲台点缀；肤色：自然偏暖；饱和度：中等偏低，避免过度鲜艳；对比度：中高，保持清晰层次"
7. 【景深】：焦点控制+虚化程度+前景/背景层次。格式："焦点：人物面部；景深：中等（f/2.8），背景适度虚化可辨；前景：讲台边缘轻微虚化；背景：走廊纵深渐变模糊；层次：前景-中景（人物）-背景三层分离"
8. 【运镜】：镜头运动方式（推/拉/摇/移/跟/升降/手持/稳定器）。格式："0-3s：稳定器缓慢推近（0.3m/s）→ 3-6s：固定机位 → 6-10s：手持微晃跟拍（呼吸感）"
9. 【角色】：角色身份、姿态、表情（如：穿警服的陈卓女士，健康科普主讲人，站姿挺拔，表情关切）
10. 【服装】：详细服装描述（颜色、款式、质地、配饰）。格式："藏青色警服外套（毛呢质地，肩章完整），内搭浅蓝色衬衫（棉质，领口整洁），黑色西裤，黑色皮鞋"
11. 【化妆】：妆容、发型细节。格式："短发整齐（黑色，长度及耳），素颜淡妆，眉毛自然，唇色淡粉，无夸张妆容"
12. 【动作】：角色具体动作（手势、步伐、视线）。格式："右手自然抬起至胸前做强调手势，左手自然下垂，身体微微前倾，目光直视镜头"
13. 【道具】：关键道具（手持物、桌面物品、背景物件）。格式："手持：空白A4文件夹（白色，无文字）；背景：木质讲台（表面有细微划痕），不锈钢保温杯"
14. 【定妆照】：角色定妆照引用路径（如：image://characters/chen-zhuo/portraits/chen-zhuo-front.png）
15. 【台词】：角色直接说的话，格式：【台词】"纯台词内容"（不要写"画外音""旁白"）
16. 【时间轴】：镜头内部的微观导演调度时间轴。必须采用分段式描述，时间戳使用相对于镜头起始点的偏移格式 T00:XX（如 T00:00, T00:02, T00:04），每段包含画面内容和角色动作。要求至少分3段，时间戳不得重叠或跳跃中断。
   标准格式示例：
   "T00:00 - 中景，主角坐在窗前，阳光从侧面照入；主角缓缓抬起头，目光投向窗外
   T00:02 - 近景过渡，镜头缓慢推进至面部；主角眼神由迷茫转为坚定，嘴角微微抿紧
   T00:04 - 特写定格，主角眼部区域；眼睛眨动一次，瞳孔中反射出窗外景象"
17. 【情绪】：1-2个情绪关键词，必须具有清晰视觉指向性，避免语义对立。推荐词库：joyful/serene/hopeful/melancholic/tense/despairing/mysterious/eerie/epic/fierce/romantic/intimate
18. 【节奏】：五段式描述，必须包含：整体(Overall)、开头(Opening 0-20%)、中段(Middle 20%-80%)、高潮(Climax)、结尾(Ending 10%-20%)。
   标准格式："整体：沉稳中等节奏；开头：缓慢引入（2s）；中段：稍快推进（紧迫感）；高潮：停顿强调（1s留白）；结尾：平缓收尾"
19. 【转场】：与下一镜头的衔接方式。必须采用"类型+持续时间+方向/风格"三段式结构。类型：hard cut(切镜)/fade in(淡入)/fade out(淡出)/dissolve(叠化)/wipe(划像)/zoom transition(缩放转场)
20. 【音频】：三层描述法——环境音效(Ambient Sound)+音乐风格(Music Style)+音量层级(Volume Level)。格式："gentle ocean waves and seagull calls, ambient cinematic with strings and piano, peaceful, 70 BPM, volume level: balanced"
21. 【负面约束】：排除项，必须包含两类：①通用负面词(no text/no watermark/no blurry/no extra limbs/deformed/distorted/low quality)；②场景特定负面词（根据content_type动态加载：教育类/医疗类/剧情类/广告类）
22. 【角色一致性】：保持角色形象一致
23. 【明亮约束】：亮度/光照强制要求，确保画面明亮清晰（如：bright lighting, well-lit scene, clear visibility, no dark shadows on face, adequate illumination）。这是强制字段，必须输出
24. 【角色约束】：角色出现限制，防止多角色/分身问题。格式："只出现[角色名]一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆"
25. 【导演指令】：整体创作意图和风格控制。格式："好莱坞大导演质感，电影级画面，写实风格，无特效，无科幻元素"

输出JSON格式:
{
  "shots": [
    {
      "shotId": "SC01",
      "fields": {
        "constraint": "Aspect ratio: 16:9, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark",
        "baseline": "8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus",
        "scene": "三甲医院检验科走廊，冷白色LED顶灯连续照射，墙面白色瓷砖，地面浅灰色防滑地胶，不锈钢检验窗口，走廊纵深约十五米",
        "lighting": "主光：顶部LED面板灯 5600K冷白光，均匀漫射无阴影；补光：墙面反射光填充阴影；背景光：走廊尽头窗户自然光 6500K；特效：检验窗口玻璃微弱反射光",
        "composition": "景别：中景（膝上）；主体位置：画面黄金分割右1/3处；线条引导：走廊纵深由近及远；画框边缘：左侧留白1/4展示环境",
        "color_palette": "主色调：冷白偏青（医院感）；辅助色：不锈钢金属银灰；肤色：自然偏暖；饱和度：中等偏低；对比度：中高",
        "depth_of_field": "焦点：人物面部；景深：中等（f/2.8），背景适度虚化可辨；前景：无；背景：走廊纵深渐变模糊；层次：中景（人物）-背景两层",
        "camera_movement": "0-2s：稳定器缓慢推近（0.3m/s）→ 2-6s：固定机位 → 6-10s：手持微晃（呼吸感，幅度±2度）",
        "character": "穿警服的陈卓女士，健康科普主讲人，短发整齐，站姿挺拔，表情关切",
        "costume": "藏青色警服外套（毛呢质地，肩章完整），内搭浅蓝色衬衫（棉质，领口整洁），黑色西裤，黑色皮鞋",
        "makeup": "短发整齐（黑色，长度及耳），素颜淡妆，眉毛自然，唇色淡粉",
        "action": "右手自然抬起至胸前做强调手势，左手自然下垂，身体微微前倾，目光直视镜头",
        "props": "手持：空白A4文件夹（白色，无文字）；背景：不锈钢检验窗口台面",
        "portraits": "image://characters/chen-zhuo/portraits/chen-zhuo-front.png",
        "dialogue": "【台词】\"典型症状是肌肉疼痛、无力。\"",
        "timeline": "T00:00 - 中景，陈卓站立讲台前，阳光从侧面照入；缓缓抬起头，目光注视镜头\nT00:02 - 近景过渡，镜头缓慢推进至面部；眼神由冷静转为关切，嘴角微微抿紧\nT00:04 - 特写定格，陈卓眼部区域；眼睛眨动一次，瞳孔中反射出讲台景象",
        "mood": "calm, professional",
        "pacing": "整体：沉稳中等节奏；开头：缓慢引入（2s）；中段：稍快推进（紧迫感）；高潮：停顿强调（1s留白）；结尾：平缓收尾",
        "transition": "切镜（硬切，保持紧张感）",
        "audio": "环境音：医院走廊低频设备嗡鸣，远处隐约脚步声；音乐：冷色调氛围音乐铺底，低沉弦乐",
        "negative": "no watermark, no logo, no cartoon style, no flat lighting, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters",
        "bright_constraint": "bright lighting, well-lit scene, clear visibility, no dark shadows on face, adequate illumination",
        "character_constraint": "只出现陈卓一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆",
        "director_instruction": "好莱坞大导演质感，电影级画面，写实风格，无特效，无科幻元素",
        "consistency": "保持陈卓角色形象一致，短发警服造型不变，面部特征与体型每帧统一"
      }
    }
  ]
}

关键要求：
1. 【台词】字段必须独立，角色直接对镜头说话，不要写"画外音""旁白"
2. 场景要具体真实（门诊室、宣教室、检查室），必须是写实环境，禁止科幻/抽象元素
3. 【动作】必须是真实物理动作和镜头运动：推近、跟拍、手持、站立、行走、手势、转身、注视镜头。严禁使用：全息投影、空间扭曲、时间残影、霓虹色、数据流、抽象构图、梦境流动性、湿版摄影、光即角色、AI瑕疵、宏大比例、微观世界
4. 禁止词汇（全字段通用）：全息、虚拟、投影、抽象、光影场域、数据空间、元宇宙、时间操控、霓虹、微观世界、宏观、抽象几何、流动光影、交织光影、色彩对冲、空间扭曲、时间残影、数据流、光即角色、梦境流动性、湿版摄影、AI瑕疵
5. 【场景】中不得出现含文字的物品描述：如"有文字的报告单"、"标牌上的文字"、"商标"、"有字的海报"等。可以描述"空白报告单"、"无文字标识牌"、"图形海报"等不含文字的物品
6. 不要混合成一段narrative，每个字段独立输出
7. 只描述本集内容，严禁预告后续集数
8. 保持角色视觉锚点一致
9. 负面约束要完整，包含两类：①通用负面词(no text/no watermark/no blurry等)；②场景特定负面词（教育类/医疗类/剧情类/广告类）
10. 【时间轴】必须使用T00:XX相对时间戳格式，至少3段
11. 【节奏】必须使用五段式描述（整体/开头/中段/高潮/结尾）
12. 【情绪】只使用1-2个关键词，避免堆砌同义词`;
  }

  async process(shots, blueprint) {
    console.log(`[PromptFusionAgent] 开始处理 ${shots.length} 个镜头（并发=${this.concurrency}）`);

    const ratio = blueprint.config?.aspectRatio || '16:9';
    const characters = blueprint.character_system?.characters || [];

    const results = new Array(shots.length);
    let index = 0;
    let failed = 0;

    const worker = async () => {
      while (index < shots.length) {
        const i = index++;
        const shot = shots[i];
        try {
          const fused = await this._fuseSingleShot(shot, ratio, characters);
          results[i] = fused;
        } catch (e) {
          failed++;
          console.warn(`[PromptFusionAgent] 镜头 ${shot.shot_id || i} 融合失败: ${e.message}，规则兜底`);
          results[i] = this._fallbackSingleShot(shot, ratio);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(this.concurrency, shots.length) }, () => worker()));

    if (failed > 0) {
      console.warn(`[PromptFusionAgent] ⚠️ ${failed}/${shots.length} 镜头降级为规则 Prompt`);
    }
    console.log(`[PromptFusionAgent] 完成 ✓ | 降级: ${failed}/${shots.length}`);
    return { shots: results, degraded: failed > 0, degradeReason: null };
  }

  async _fuseSingleShot(shot, ratio, characters) {
    const prompt = this._buildBatchPrompt([shot], ratio, characters);
    const schema = { shots: [{ shotId: shot.shotId, fields: {} }] };

    const llmResult = await this._callLLM(prompt, schema, () => {
      throw new Error('LLM fallback');
    });

    const fusionEntry = llmResult.result?.shots?.find(s => s.shotId === shot.shotId);
    const fields = fusionEntry?.fields || {};
    
    // 组装标准格式Prompt
    const fullPrompt = this._assembleStandardPrompt(shot, fields, ratio);

    return {
      ...shot,
      fields,
      fusionText: fields.scene || '',
      prompt: fullPrompt,
      promptCharCount: this._countChars(fullPrompt),
      degraded: false,
      degradeReason: null
    };
  }

  _fallbackSingleShot(shot, ratio) {
    const fallbackPrompt = this._assembleFullPrompt(shot, '', ratio);
    return {
      ...shot,
      fields: {},
      fusionText: '',
      prompt: fallbackPrompt,
      promptCharCount: this._countChars(fallbackPrompt),
      degraded: true,
      degradeReason: '单镜头 LLM 融合失败，规则兜底',
      _pf_fallback: true
    };
  }

  /**
   * 组装标准格式Prompt（按之前正常版本的字段格式）
   */
  _assembleStandardPrompt(shot, fields, ratio) {
    const parts = [];

    // 【导演指令】⭐ 新增：整体创作意图
    if (fields.director_instruction) parts.push(`【导演指令】${fields.director_instruction}`);

    // 【约束】：必须包含画幅比例、分辨率、格式、帧率
    parts.push(`【约束】${fields.constraint || `Aspect ratio: ${ratio}, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background`}`);

    // 【基础】：三类基础词——分辨率锚定+风格质量+细节增强
    parts.push(`【基础】${fields.baseline || '8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus'}`);

    // 【场景】
    // 【v2.1.4-fix9-P5】场景强制写实：禁止科幻/抽象词汇
    let sceneDesc = fields.scene || shot.scene || '';
    const forbiddenWords = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    const hasForbidden = forbiddenWords.some(w => sceneDesc.includes(w));
    if (hasForbidden) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 场景含禁止词汇: "${sceneDesc.substring(0, 50)}..."，强制替换为写实场景`);
      // 强制替换为写实场景
      const fallbackScenes = [
        '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有无文字骨骼肌解剖图与运动损伤海报（纯图形版），木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
        '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，无文字箭头标识牌指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
        '医生诊室，白色墙面悬挂无文字人体解剖示意图（纯图形版），办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
        '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列无文字健康宣传展板（纯图形版），前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
      ];
      const index = parseInt(shot.shotId.replace(/\D/g, '')) || 0;
      sceneDesc = fallbackScenes[index % fallbackScenes.length];
    }
    if (sceneDesc) parts.push(`【场景】${sceneDesc}`);

    // 【灯光/照明】⭐ 新增：专业灯光设计
    if (fields.lighting) parts.push(`【灯光/照明】${fields.lighting}`);

    // 【构图】⭐ 新增：景别+画面比例+主体位置+线条引导
    if (fields.composition) parts.push(`【构图】${fields.composition}`);

    // 【色彩/色调】⭐ 新增：调色方案+色温倾向+饱和度
    if (fields.color_palette) parts.push(`【色彩/色调】${fields.color_palette}`);

    // 【景深】⭐ 新增：焦点控制+虚化程度+前景/背景层次
    if (fields.depth_of_field) parts.push(`【景深】${fields.depth_of_field}`);

    // 【运镜】⭐ 新增：镜头运动方式（从【动作】拆分）
    if (fields.camera_movement) parts.push(`【运镜】${fields.camera_movement}`);

    // 【角色】
    // 【v2.1.4-fix9-P4】角色服装锁定：强制使用原始角色设定中的服装
    let characterDesc = fields.character || '';
    if (characterDesc && shot.character) {
      // 如果LLM输出的角色描述中没有"警"字，但原始角色设定有，则强制替换
      const originalChar = shot.character || '';
      if (originalChar.includes('警') && !characterDesc.includes('警')) {
        // LLM擅自改了服装，从原始角色描述中提取姓名+服装
        const nameMatch = originalChar.match(/([^,，]+警[^,，]+)/);
        if (nameMatch) {
          characterDesc = characterDesc.replace(/(身着|穿着|身穿|着)[^，]+/, nameMatch[1]);
          // 如果没替换成功，直接在描述开头插入正确服装
          if (!characterDesc.includes('警')) {
            characterDesc = originalChar + '，' + characterDesc;
          }
        }
      }
    }
    if (characterDesc) parts.push(`【角色】${characterDesc}`);

    // 【服装】⭐ 新增：详细服装描述（从【角色】拆分）
    if (fields.costume) parts.push(`【服装】${fields.costume}`);

    // 【化妆】⭐ 新增：妆容、发型细节
    if (fields.makeup) parts.push(`【化妆】${fields.makeup}`);

    // 【动作】
    // 【v2.1.4-fix9-P9】动作强制写实：禁止科幻/抽象词汇
    let actionDesc = fields.action || shot.action || '';
    const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画'];
    const actionHasForbidden = actionForbidden.some(w => actionDesc.includes(w));
    if (actionHasForbidden) {
      console.warn(`[PromptFusionAgent] ⚠️ 镜头 ${shot.shotId} 动作含禁止词汇: "${actionDesc.substring(0, 50)}..."，强制替换为写实动作`);
      // 提取角色名
      const charName = shot.character?.name || '陈卓';
      // 根据场景类型生成写实动作
      const fallbackActions = [
        '镜头缓慢推近，陈卓站立讲台前，自然手势讲解，眼神注视镜头，警服在荧光灯下轮廓清晰',
        '稳定机位中景，陈卓沿走廊缓步前行，侧头指向检验窗口，白大褂医生从背景走过',
        '手持微晃跟拍，陈卓靠近检查床，手指轻触医学挂图，无影灯在头顶形成柔和光晕',
        '固定机位中景，陈卓坐于沙发边缘，双手交叠置于膝上，LED灯带在身后形成均匀轮廓光',
        '缓慢后拉全景，陈卓站立检验窗口前，转身面向镜头，不锈钢台面反射冷白色光源'
      ];
      const idx = parseInt(shot.shotId.replace(/\D/g, '')) || 0;
      actionDesc = fallbackActions[idx % fallbackActions.length];
    }
    if (actionDesc) parts.push(`【动作】${actionDesc}`);

    // 【道具】⭐ 新增：关键道具（手持物、桌面物品、背景物件）
    if (fields.props) parts.push(`【道具】${fields.props}`);

    // 【定妆照】
    if (fields.portraits) parts.push(`【定妆照】${fields.portraits}`);

    // 【台词】
    if (fields.dialogue) parts.push(`【台词】${fields.dialogue}`);

    // 【时间轴】镜头内部微观导演调度（T00:XX相对时间戳格式）
    if (fields.timeline) {
      parts.push(`【时间轴】${fields.timeline}`);
    } else {
      // 兜底：使用T00:XX相对时间戳格式，至少3段
      const duration = shot.duration || 10;
      const seg1 = Math.floor(duration * 0.3);
      const seg2 = Math.floor(duration * 0.6);
      parts.push(`【时间轴】T00:00 - 全景establishing，环境展示，冷静氛围；T00:0${seg1} - 中景推进，人物动作，情绪升温；T00:0${seg2} - 情绪收尾，光线平复`);
    }

    // 【情绪】
    if (fields.mood) parts.push(`【情绪】${fields.mood}`);

    // 【节奏】⭐ 新增：镜头速度+紧迫感+舒缓度
    if (fields.pacing) parts.push(`【节奏】${fields.pacing}`);

    // 【转场】⭐ 新增：与下一镜头的衔接方式
    if (fields.transition) parts.push(`【转场】${fields.transition}`);

    // 【音频】
    if (fields.audio) parts.push(`【音频】${fields.audio}`);

    // 【负面约束】：通用负面词 + 场景特定负面词
    if (fields.negative) {
      parts.push(`【负面约束】${fields.negative}`);
    } else {
      // 兜底：通用负面词 + 教育/医疗场景特定负面词
      parts.push(`【负面约束】no text, no watermark, no caption, no subtitle, no logo, no blurry, no low resolution, no pixelated, no distorted, no artifacts, no compression noise, no extra limbs, no deformed hands, no malformed fingers, no extra fingers, no fused fingers`);
      parts.push(`no cartoon style, no flat lighting, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background`);
      parts.push(`no brand logos with text, no text in medical charts, no text on posters, no text on billboards, no text on packaging, no handwritten text, no printed text, no signage text, no text overlays, no UI elements with text`);
    }

    // 【明亮约束】⭐ 新增：亮度/光照强制要求，防止暗场
    if (fields.bright_constraint) {
      parts.push(`【明亮约束】${fields.bright_constraint}`);
    } else {
      // 兜底：强制明亮
      parts.push(`【明亮约束】bright lighting, well-lit scene, clear visibility, no dark shadows on face, adequate illumination`);
    }

    // 【角色约束】⭐ 新增：防止多角色/分身
    if (fields.character_constraint) {
      parts.push(`【角色约束】${fields.character_constraint}`);
    } else if (shot.character && shot.character !== 'NONE') {
      // 兜底：根据角色名自动生成
      const charName = shot.character.name || shot.character;
      parts.push(`【角色约束】只出现${charName}一人，禁止其他人物入镜，禁止同一角色重复出现，禁止角色分身或克隆`);
    }

    // 【角色一致性】
    if (fields.consistency) parts.push(`【角色一致性】${fields.consistency}`);

    // 合并
    let fullPrompt = parts.join('，');
    
    // 截断
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateStandardPrompt(fullPrompt);
    }

    return fullPrompt;
  }

  /**
   * 组装完整Prompt（降级路径，保留原有逻辑）
   */
  _assembleFullPrompt(shot, fusionText, ratio) {
    const parts = [];

    // L1: 约束层
    // 【v2.1.4-fix9-P25】约束字段：画幅+分辨率+格式+帧率+禁止项
    parts.push(`Aspect ratio: ${ratio}, Resolution: 1920x1080, Format: MP4, Frame rate: 24fps, no text, no subtitle, no caption, no watermark, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background`);

    // L2: 基础层
    // 【v2.1.4-fix9-P25】基础字段：分辨率锚定+风格质量+细节增强
    parts.push('8K resolution, cinematic quality, highly detailed, photorealistic, intricate textures, sharp focus');

    // L3-L7: 融合段
    if (fusionText) {
      parts.push(fusionText);
    } else {
      // 【v2.1.4-fix9-P11】降级路径也强制写实场景和动作
      let sceneDesc = shot.scene || '';
      const sceneForbidden = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
      if (sceneForbidden.some(w => sceneDesc.includes(w))) {
        const fallbackScenes = [
          '医院健康宣教室，白色荧光灯均匀照明，白墙面贴有无文字骨骼肌解剖图与运动损伤海报（纯图形版），木质讲台表面带有细微使用划痕，地面浅灰色防滑PVC地胶',
          '三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，无文字箭头标识牌指向尿液检验窗口，地面浅色抛光瓷砖，墙面白色医用抗菌涂层',
          '医生诊室，白色墙面悬挂无文字人体解剖示意图（纯图形版），办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方，窗光透入',
          '医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列无文字健康宣传展板（纯图形版），前方皮质沙发与实木茶几，地面灰色哑光瓷砖'
        ];
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        sceneDesc = fallbackScenes[idx % fallbackScenes.length];
      }
      parts.push(sceneDesc);
      
      if (shot.character && shot.character !== 'NONE') parts.push(shot.character);
      
      let actionDesc = shot.action || '';
      const actionForbidden = ['全息', '虚拟', '投影', '空间扭曲', '时间残影', '霓虹', '数据流', '光即角色', '抽象构图', '梦境流动性', '手绘动画', '湿版摄影', '黑色电影'];
      if (actionForbidden.some(w => actionDesc.includes(w))) {
        const fallbackActions = [
          '镜头缓慢推近，陈卓站立讲台前，自然手势讲解，眼神注视镜头，警服在荧光灯下轮廓清晰',
          '稳定机位中景，陈卓沿走廊缓步前行，侧头指向检验窗口，白大褂医生从背景走过',
          '手持微晃跟拍，陈卓靠近检查床，手指轻触医学挂图，无影灯在头顶形成柔和光晕',
          '固定机位中景，陈卓坐于沙发边缘，双手交叠置于膝上，LED灯带在身后形成均匀轮廓光',
          '缓慢后拉全景，陈卓站立检验窗口前，转身面向镜头，不锈钢台面反射冷白色光源'
        ];
        const idx = parseInt(shot.shotId?.replace(/\D/g, '') || '0') || 0;
        actionDesc = fallbackActions[idx % fallbackActions.length];
      }
      if (actionDesc) parts.push(actionDesc);
      
      const pureDialogue = shot.dialogueText || this._extractPureDialogue(shot.dialogue);
      if (pureDialogue && pureDialogue !== '') parts.push(`【台词】"${pureDialogue}"`);
      if (shot.cameraString) parts.push(shot.cameraString);
      if (shot.lightingString) parts.push(shot.lightingString);
      if (shot.mood) parts.push(`mood: ${shot.mood}`);
      if (shot.backgroundSoundString) parts.push(`audio: ${shot.backgroundSoundString}`);
    }

    // L9: 质控层
    // 【v2.1.4-fix9-P14】全局禁止文字：详细负面约束覆盖所有可能含文字的位置
    parts.push('no voiceover, no narration, no metal_gloss, no unnatural_eye_color, no text anywhere in frame, no readable characters, no alphabets, no Chinese characters');
    parts.push('no text on walls, no text on objects, no text on documents, no text on signs, no text on labels, no text on screens, no text on clothing, no text in background');
    parts.push('no brand logos with text, no text in medical charts, no text on posters, no text on billboards, no text on packaging, no handwritten text, no printed text, no signage text');
    parts.push('no text overlays, no UI elements with text, no text on book covers, no text on medicine bottles, no text on report forms, no text on devices, no text on badges, no text on nameplates');
    parts.push('no text on doors, no text on windows, no text on floors, no text on ceilings');

    let fullPrompt = parts.filter(p => p).join(', ');
    if (this._countChars(fullPrompt) > this.maxPromptLength) {
      fullPrompt = this._truncateWithPriority(fullPrompt, parts);
    }

    return fullPrompt;
  }

  _truncateStandardPrompt(fullPrompt) {
    let prompt = fullPrompt;
    while (this._countChars(prompt) > this.maxPromptLength) {
      const lastComma = prompt.lastIndexOf('，');
      if (lastComma > 0) {
        prompt = prompt.substring(0, lastComma).trim();
      } else {
        break;
      }
    }
    return prompt;
  }

  _truncateWithPriority(fullPrompt, parts) {
    let prompt = fullPrompt;
    while (this._countChars(prompt) > this.maxPromptLength) {
      const lastComma = prompt.lastIndexOf(',');
      if (lastComma > 0) {
        prompt = prompt.substring(0, lastComma).trim();
      } else {
        break;
      }
    }
    return prompt;
  }

  _countChars(str) {
    if (!str) return 0;
    let count = 0;
    for (const char of str) {
      count += (char.charCodeAt(0) > 127) ? 1.5 : 1;
    }
    return Math.ceil(count);
  }

  _extractPureDialogue(dialogue) {
    if (!dialogue || typeof dialogue !== 'string') return dialogue;
    const parts = dialogue.split(/[|;]/);
    if (parts.length >= 5) {
      return parts[3].trim();
    }
    return dialogue.trim();
  }

  _buildBatchPrompt(shots, ratio, characters) {
    const characterInfo = characters.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');

    const shotsInfo = shots.map(s => {
      const pureDialogue = s.dialogue?.lines?.map(l => l.content).join('; ') || 
                          (s.dialogue ? this._extractPureDialogue(s.dialogue) : '');
      return `${s.shotId}(${s.duration || '?'}s): ${(s.scene || '').substring(0, 50)} | ${s.mood || ''} | ${pureDialogue.substring(0, 50)} | 运镜:${(s.cameraString || '').substring(0, 30)} | 灯光:${(s.lightingString || '').substring(0, 30)}`;
    }).join('\n');
    
    // 【v2.1.4-fix9-P1】构建导演上下文
    const directorContext = this._buildDirectorContext(shots);

    return `${directorContext}
画幅:${ratio}
角色:${characterInfo || '无'}
镜头:\n${shotsInfo}

任务:为每个镜头生成标准字段格式的导演分镜提示词。

【角色服装锁定 - 强制不可修改】
角色服装必须与角色设定完全一致，禁止根据场景修改：
- 正确："陈卓女士，穿警服的陈女士，健康科普主讲人，短发，站姿挺拔"
- 错误："白色医生服"、"白大褂"、"浅蓝色衬衫"（禁止根据场景更换服装）
【角色】字段必须严格使用角色设定中的原始服装描述，不可自由发挥。

【动作写实锁定 - 强制不可修改】
【动作】字段必须是真实物理动作和镜头运动，严禁使用任何科幻/抽象/超现实词汇：
- 正确："镜头缓慢推近，陈卓站立讲台前，自然手势讲解"
- 错误："全息投影"、"空间扭曲"、"时间残影"、"霓虹色数据流"、"抽象构图"、"梦境流动性"、"湿版摄影"、"光即角色"
- 正确运镜：推近、跟拍、手持、稳定器、缓慢后拉、固定机位
- 错误运镜：无人机穿越微观世界、时间操控慢动作、宏大比例展示

要求：
1. 按标准字段输出：【约束】【基础】【场景】【灯光/照明】【构图】【色彩/色调】【景深】【运镜】【角色】【服装】【化妆】【动作】【道具】【定妆照】【台词】【时间轴】【情绪】【节奏】【转场】【音频】【负面约束】【明亮约束】【角色约束】【导演指令】【角色一致性】
2. 【台词】字段必须独立，角色直接对镜头说话，不要写"画外音""旁白"
3. 场景要具体专业（门诊室、宣教室、检查室），不要写"社区健身区"。场景中不得出现含文字的物品：如"有文字的报告单"、"标牌上的文字"、"商标"、"有字的海报"等。可以描述"空白报告单"、"无文字标识牌"、"图形海报"等不含文字的物品
4. 负面约束要完整，包含10+条排除项，必须包含全局禁止文字：no text anywhere in frame, no readable characters, no alphabets, no Chinese characters, no text on walls objects documents signs labels screens clothing packaging, no handwritten text, no printed text, no signage text, no text overlays, no UI elements with text
5. 只输出JSON，不要解释

输出:{"shots":[{"shotId":"SC01","fields":{...}}]}`;
  }
  
  /**
   * 【v2.1.4-fix9-P1】构建导演上下文
   */
  _buildDirectorContext(shots) {
    // 从第一个 shot 的 blueprint 引用中提取上下文
    const firstShot = shots[0];
    const blueprint = firstShot?._blueprint || {};
    const config = blueprint.config || {};
    
    const title = blueprint.title || config.title || '未命名';
    const contentTheme = config.content_theme || '';
    const sceneRequirement = config.scene_requirement || '';
    const characterDescription = config.character_description || '';
    const forbiddenScenes = config.forbidden_scenes || [];
    const keyMessages = config.key_messages || [];
    
    return `## 🎬 导演指令上下文
视频标题：${title}
内容主题：${contentTheme}
场景要求：${sceneRequirement}
角色设定：${characterDescription}
关键信息：${keyMessages.join('；') || '无'}
禁止场景：${forbiddenScenes.join('、') || '无'}

`;
  }

  _fallbackBatch(shots, ratio) {
    console.log(`[PromptFusionAgent] 批量降级...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        fields: {}
      }))
    };
  }
}

module.exports = { PromptFusionAgent };