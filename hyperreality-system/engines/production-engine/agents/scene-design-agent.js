/**
 * SceneDesignAgent - 场景设计Agent
 * 负责: 场景五维描述、情绪设计、动作设计
 */
const { BaseAgent } = require('./base-agent');

class SceneDesignAgent extends BaseAgent {
  constructor(options = {}) {
    super({ name: 'SceneDesignAgent', ...options });
  }

  _getSystemPrompt() {
    return `你是一位专业的电影场景设计师。根据剧本场景信息，为每个镜头设计完整的场景描述、情绪基调和角色动作。

【绝对约束 - 违反则输出无效】
1. 场景必须从以下选项中选择：
   - 场景A：医院健康宣教室（荧光灯、白墙面、健康知识海报、木质讲台）
   - 场景B：三甲医院检验科走廊（冷白色光源、指示牌、检验窗口、排队座椅）
   - 场景C：医生诊室（听诊器、血压计、检查床、医学挂图、办公桌）
   - 场景D：医院健康管理中心（柔和顶灯、接待台、健康宣传展板、沙发座椅）
2. 禁止自创场景，禁止科幻/抽象元素
3. 禁止词汇：全息、虚拟、投影、抽象、概念、光影场域、数据空间、数字、元宇宙、时间操控、霓虹、微观世界、宏观、抽象几何、流动光影、交织光影、色彩对冲
4. 光线必须是真实光源：荧光灯、LED顶灯、窗光、无影灯
5. 角色必须在真实地面站立，背景必须是真实墙面

输出JSON格式要求:
{
  "shots": [
    {
      "shotId": "SC01",
      "scene": "场景A: 医院健康宣教室，荧光灯照明，白墙面贴有健康知识海报，陈卓站在木质讲台前",
      "mood": "情绪关键词和氛围描述",
      "action": "角色动作描述（含肢体语言、走位）",
      "emotional_target": "场景情绪目标（如：警示、安抚、引导）"
    }
  ]
}

设计原则:
1. 场景描述要具体真实：包含墙面材质、灯光类型、医疗设备、地面材质
2. 情绪要与台词匹配：台词警示时情绪紧张，台词安抚时情绪平和
3. 动作要自然：走动、手势、转身、指向等
4. 考虑镜头连续性：相邻场景的环境和光线要有逻辑关联;`;
  }

  async process(shots, blueprint) {
    console.log(`[SceneDesignAgent] 开始处理 ${shots.length} 个镜头...`);

    const prompt = this._buildPrompt(shots, blueprint);

    const schema = {
      required: ['shots']
    };

    const llmResult = await this._callLLM(prompt, schema, () => {
      // 降级：使用原规则方法
      return this._fallback(shots);
    });

    if (llmResult.degraded) {
      return { shots: llmResult.result?.shots || shots, degraded: true, degradeReason: llmResult.degradeReason };
    }

    // 合并LLM结果回原shots
    const forbiddenWords = ['全息', '虚拟', '投影', '抽象', '光影场域', '数据空间', '元宇宙', '时间操控', '霓虹', '微观世界', '宏观', '抽象几何', '流动光影', '交织光影', '色彩对冲'];
    
    const designedShots = shots.map((shot, index) => {
      const designed = llmResult.result?.shots?.find(s => s.shotId === shot.shotId) || {};
      let scene = designed.scene || shot.scene || '';
      
      // 【v2.1.4-fix9-P5】场景校验：包含禁止词汇则使用兜底场景
      const hasForbidden = forbiddenWords.some(w => scene.includes(w));
      if (hasForbidden) {
        console.warn(`[SceneDesignAgent] ⚠️ 镜头 ${shot.shotId} 包含禁止词汇: "${scene}"，使用兜底场景`);
        // 根据镜头索引分配兜底场景
        const fallbackScenes = [
          '场景A: 医院健康宣教室，白色荧光灯均匀照明，白墙面贴有骨骼肌解剖图与运动损伤海报，木质讲台表面带有细微使用划痕',
          '场景B: 三甲医院检验科走廊，冷白色LED光源从走廊顶部连续排列向下照射，指示牌清晰指向尿液检验窗口，地面为浅色抛光瓷砖',
          '场景C: 医生诊室，白色墙面悬挂医学挂图，办公桌摆放听诊器与血压计，检查床铺有蓝色一次性床单，无影灯悬于上方',
          '场景D: 医院健康管理中心，嵌入式LED灯带洒下柔和暖白光，接待台后方排列健康宣传展板，前方摆放皮质沙发与实木茶几'
        ];
        scene = fallbackScenes[index % fallbackScenes.length];
      }
      
      return {
        ...shot,
        scene: scene,
        mood: designed.mood || shot.mood || '',
        action: designed.action || shot.action || '',
        emotional_target: designed.emotional_target || ''
      };
    });

    console.log(`[SceneDesignAgent] 完成 ✓`);
    return { shots: designedShots, degraded: false, degradeReason: null };
  }

  _buildPrompt(shots, blueprint) {
    const characters = blueprint.character_system?.characters || [];
    const characterDesc = characters.map(c =>
      `- ${c.name}: ${c.description || '无描述'}${c.portraitPaths ? ' [有定妆照]' : ''}`
    ).join('\n');

    const shotsInfo = shots.map((s, idx) => {
      const dialogue = s.dialogue?.lines?.map(l => `"${l.content}"`).join('; ') || s.dialogue || '';
      const existingScene = s.scene || '';
      return `镜头 ${s.shotId}: ${s.duration || '?'}s; 现有场景: ${existingScene.substring(0, 60)}; 台词: ${dialogue.substring(0, 80)}`;
    }).join('\n');
    
    // 【v2.1.4-fix9-P1】构建导演上下文
    const directorContext = this._buildDirectorContext(blueprint);

    return `${directorContext}

## 角色
${characterDesc || '无'}

## 镜头
${shotsInfo}

## 任务
为每个镜头设计场景、情绪和动作。

【重要】每个镜头已有写实场景基础，你的任务是：
1. 如果现有场景已写实（医院宣教室、检验科、诊室等），保留并细化细节
2. 如果现有场景不写实，必须从以下选项中强制选择一个替换：
   - 场景A：医院健康宣教室（荧光灯照明，白墙面，健康知识海报，木质讲台，座椅排列）
   - 场景B：三甲医院检验科走廊（冷白色光源，指示牌，检验窗口，排队座椅，地面反光）
   - 场景C：医生诊室（听诊器、血压计、检查床、医学挂图、白色墙面、办公桌）
   - 场景D：医院健康管理中心（柔和顶灯，接待台，健康宣传展板，沙发座椅）

【设计要求】
1. scene: 输出最终场景描述（必须是写实医院环境，50-80字）
2. mood: 情绪氛围（15-25字）
3. action: 角色动作（肢体语言、走位、手势，30-50字）
4. emotional_target: 情绪目标（1个词）

【强制约束 - 违反则输出无效】
- 场景描述必须包含具体物理细节：墙面材质、灯光类型、医疗设备、地面材质
- 禁止使用以下任何词汇：全息、虚拟、投影、抽象、概念、光影场域、数据空间、数字、元宇宙、时间操控、霓虹、微观世界、宏观、抽象几何、流动光影、交织光影、色彩对冲
- 光线必须是真实光源：荧光灯、LED顶灯、窗光、无影灯
- 角色必须在真实地面站立，背景必须是真实墙面

输出JSON: {"shots": [{"shotId":"SC01","scene":"场景A: 医院健康宣教室，荧光灯照明，白墙面贴有健康知识海报，陈卓站在木质讲台前","mood":"...","action":"...","emotional_target":"..."}]}`;
  }
  
  /**
   * 【v2.1.4-fix9-P1】构建导演上下文
   */
  _buildDirectorContext(blueprint) {
    const meta = blueprint.metadata || {};
    const config = blueprint.config || {};
    const title = meta.title || config.title || '未命名';
    
    // 从 config 读取导演上下文信息
    const contentTheme = config.content_theme || '';
    const contentSummary = config.content_summary || '';
    const visualStyle = config.visual_style || 'REAL';
    const sceneRequirement = config.scene_requirement || '';
    const characterDescription = config.character_description || '';
    const forbiddenScenes = config.forbidden_scenes || [];
    const keyMessages = config.key_messages || [];
    
    return `## 🎬 导演指令上下文
视频标题：${title}
内容主题：${contentTheme}
核心内容：${contentSummary}
视觉风格：${visualStyle}
创意指数：${blueprint.config?.creativeIntensity || 0.5}（低创意=强制写实）
场景要求：${sceneRequirement}
角色设定：${characterDescription}
关键信息：${keyMessages.join('；') || '无'}
禁止场景：${forbiddenScenes.join('、') || '无'}
禁止元素：全息投影、虚拟空间、未来感、霓虹特效、元宇宙、数字空间、抽象几何
`;
  }

  _fallback(shots) {
    console.log(`[SceneDesignAgent] 使用降级规则...`);
    return {
      shots: shots.map(shot => ({
        shotId: shot.shotId,
        scene: shot.scene || '',
        mood: shot.mood || '',
        action: shot.action || '',
        emotional_target: ''
      }))
    };
  }
}

module.exports = { SceneDesignAgent };
