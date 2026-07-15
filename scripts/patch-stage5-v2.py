#!/usr/bin/env python3

# 读取文件
with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'r') as f:
    lines = f.readlines()

# 找到替换范围
start_line = 1487 - 1  # 0-indexed (1487行是 "async _llmGenerateScript")
end_line = 1722 - 1     # 0-indexed (1722行是 "_buildScriptPrompt")

print(f"替换范围: {start_line+1} 到 {end_line}")
print(f"行数: {end_line - start_line}")

# 验证起始行
print(f"起始行内容: {lines[start_line].strip()[:60]}")
print(f"结束行内容: {lines[end_line].strip()[:60]}")

# 新内容
new_content = '''  async _llmGenerateScript(input, prd) {
    const scenes = input.scenes || [];

    const mem = (label) => {
      const m = process.memoryUsage();
      console.log(
        `[MEM] ${label} | heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB | rss=${(m.rss / 1024 / 1024).toFixed(1)}MB`
      );
    };

    mem('Stage 5 start');

    // Phase A: 生成剧本骨架（轻量）
    const phaseAScenes = await this._generateScriptCorePhase(input);

    if (global.gc) global.gc();
    mem('Stage 5 after Phase A');

    // Phase B: 单独生成每个镜头的视觉提示词
    const phaseBScenes = await this._generateVisualPromptPhase({
      ...input,
      scenes: phaseAScenes
    });

    if (global.gc) global.gc();
    mem('Stage 5 after Phase B');

    return {
      ...input,
      scenes: phaseBScenes
    };
  }

  async _generateScriptCorePhase(input) {
    const { LLMEngine } = require('./llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 3072,
      temperature: 0.1,
      topP: 0.9
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const world = {
      name: input.projectName || 'Nirath',
      setting: input.style || '默认世界观'
    };

    const batchSize = 1;
    const batches = [];
    for (let i = 0; i < scenes.length; i += batchSize) {
      batches.push(scenes.slice(i, i + batchSize));
    }

    const results = [];

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const prompt = this._buildScriptCorePrompt(batch, core, world, batchIdx, batches.length);

      this.log('STAGE-5A', `🧩 批次 ${batchIdx + 1}/${batches.length} | 镜数: ${batch.length} | Prompt: ${prompt.length}字符`);

      const schema = {
        scenes: batch.map((scene) => ({
          id: scene.id,
          scene: scene.name || '',
          dialogue: '',
          narration: '',
          mouthAction: 'speaking_normal',
          emotionPhase: 'curiosity'
        })),
        narrative: {
          emotion: 'neutral',
          pace: 'medium',
          totalDuration: batch.reduce((sum, s) => sum + (s.duration || 10), 0)
        },
        world: {
          name: world.name || 'Nirath',
          setting: world.setting || ''
        }
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 3072,
        temperature: 0.1
      });

      if (result.success && Array.isArray(result.data?.scenes)) {
        const normalized = batch.map((srcScene) => {
          const generated = result.data.scenes.find((x) => x.id === srcScene.id) || {};
          return {
            ...srcScene,
            scene: generated.scene || srcScene.name || '',
            dialogue: generated.dialogue || this._buildFallbackDialogue(srcScene, input.characters),
            narration: generated.narration || this._buildFallbackNarration(srcScene),
            mouthAction: generated.mouthAction || 'speaking_normal',
            emotionPhase: generated.emotionPhase || this._inferEmotionPhase(srcScene),
            scriptCoreSuccess: true
          };
        });

        results.push(...normalized);
        this.log('STAGE-5A', `✅ 批次 ${batchIdx + 1} 成功`);
      } else {
        this.log('STAGE-5A', `⚠️ 批次 ${batchIdx + 1} 失败: ${result.error}`);

        const fallback = batch.map((scene) => ({
          ...scene,
          scene: scene.name || '',
          dialogue: this._buildFallbackDialogue(scene, input.characters),
          narration: this._buildFallbackNarration(scene),
          mouthAction: 'speaking_normal',
          emotionPhase: this._inferEmotionPhase(scene),
          scriptCoreSuccess: false,
          scriptCoreError: result.error
        }));

        results.push(...fallback);
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  async _generateVisualPromptPhase(input) {
    const { LLMEngine } = require('./llm-reasoning-engine');

    const llm = new LLMEngine({
      model: 'kimi-k2p6',
      mode: 'production',
      maxRetries: 3,
      maxTokens: 2048,
      temperature: 0.2,
      topP: 0.9
    });

    const scenes = input.scenes || [];
    const core = input.characters || {};
    const world = {
      name: input.projectName || 'Nirath',
      setting: input.style || '默认世界观'
    };

    const results = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const prompt = this._buildVisualPrompt(scene, core, world, i, scenes.length);

      this.log('STAGE-5B', `🎬 镜头 ${i + 1}/${scenes.length} | scene=${scene.id} | Prompt: ${prompt.length}字符`);

      const schema = {
        id: scene.id,
        visualPrompt: ''
      };

      const result = await llm.reasonStructured(prompt, schema, {
        maxTokens: 2048,
        temperature: 0.2
      });

      if (result.success && result.data?.id === scene.id) {
        results.push({
          ...scene,
          visualPrompt: result.data.visualPrompt || this._buildFallbackVisualPrompt(scene, world),
          visualPromptSuccess: true
        });
        this.log('STAGE-5B', `✅ ${scene.id} visualPrompt 成功`);
      } else {
        this.log('STAGE-5B', `⚠️ ${scene.id} visualPrompt 失败: ${result.error}`);
        results.push({
          ...scene,
          visualPrompt: this._buildFallbackVisualPrompt(scene, world),
          visualPromptSuccess: false,
          visualPromptError: result.error
        });
      }

      if (global.gc) global.gc();
    }

    return results;
  }

  _buildScriptCorePrompt(batch, core, world, batchIdx, totalBatches) {
    const parts = [];

    parts.push(`你是一位专业的视频剧本策划Agent。`);
    parts.push(`请为当前批次场景生成简洁、可直接用于视频制作的剧本骨架。`);
    parts.push(`只输出一个合法JSON对象，不要输出解释、思考过程、markdown代码块。`);

    parts.push(`\n【世界观】`);
    parts.push(`名称：${world.name || 'Nirath'}`);
    parts.push(`设定：${world.setting || '默认世界观'}`);

    parts.push(`\n【当前批次】${batchIdx + 1}/${totalBatches}`);

    parts.push(`\n【角色信息】`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''}`);
    });

    parts.push(`\n【场景列表】`);
    batch.forEach((scene, idx) => {
      parts.push(`场景${idx + 1}`);
      parts.push(`- id: ${scene.id}`);
      parts.push(`- 名称: ${scene.name || '未命名'}`);
      parts.push(`- 类型: ${scene.type || 'explanation'}`);
      parts.push(`- 时长: ${scene.duration || 10}秒`);
      parts.push(`- 描述: ${scene.description || '无描述'}`);
      parts.push(`- 角色: ${(scene.characters || []).join(', ') || '无'}`);
    });

    parts.push(`\n【生成要求】`);
    parts.push(`1. scene：场景名称，可简要优化`);
    parts.push(`2. dialogue：口语化、自然，适合视频表达`);
    parts.push(`3. narration：必要时提供简短准确的旁白`);
    parts.push(`4. mouthAction：只能是 speaking_normal / speaking_whisper / speaking_emphasis`);
    parts.push(`5. emotionPhase：只能是 curiosity / tension / climax / resolution`);

    parts.push(`\n【风格要求】`);
    parts.push(`- 健康科普内容应专业、清晰、不过度夸张`);
    parts.push(`- 语言适合短视频口播`);
    parts.push(`- 优先保证可读性与可拍摄性`);

    parts.push(`\n【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层必须包含 scenes, narrative, world`);
    parts.push(`- scenes 数量必须与输入场景数完全一致`);
    parts.push(`- scenes 中每项必须包含 id, scene, dialogue, narration, mouthAction, emotionPhase`);
    parts.push(`- 每个 id 必须与输入一致`);

    parts.push(`\n【输出示例】`);
    parts.push(`{\n  "scenes": [\n    {\n      "id": "S01",\n      "scene": "开场介绍",\n      "dialogue": "大家好，今天我们来聊一个需要高度重视的问题。",\n      "narration": "本集主题为横纹肌溶解。",\n      "mouthAction": "speaking_normal",\n      "emotionPhase": "curiosity"\n    }\n  ],\n  "narrative": {\n    "emotion": "neutral",\n    "pace": "medium",\n    "totalDuration": 12\n  },\n  "world": {\n    "name": "Nirath",\n    "setting": "默认世界观"\n  }\n}`);

    return parts.join('\n');
  }

  _buildVisualPrompt(scene, core, world, idx, total) {
    const parts = [];

    parts.push(`你是一位专业的视频分镜视觉提示词生成Agent。`);
    parts.push(`请只为当前单个场景生成 visualPrompt。`);
    parts.push(`只输出一个合法JSON对象，不要输出解释、思考过程、markdown代码块。`);

    parts.push(`\n【世界观】`);
    parts.push(`名称：${world.name || 'Nirath'}`);
    parts.push(`设定：${world.setting || '默认世界观'}`);

    parts.push(`\n【当前镜头】${idx + 1}/${total}`);
    parts.push(`- id: ${scene.id}`);
    parts.push(`- 名称: ${scene.name || '未命名'}`);
    parts.push(`- 类型: ${scene.type || 'explanation'}`);
    parts.push(`- 时长: ${scene.duration || 10}秒`);
    parts.push(`- 描述: ${scene.description || '无描述'}`);
    parts.push(`- dialogue: ${scene.dialogue || ''}`);
    parts.push(`- narration: ${scene.narration || ''}`);

    parts.push(`\n【角色信息】`);
    Object.values(core || {}).forEach((c) => {
      parts.push(`- ${c.id || ''} | 名称:${c.name || ''} | 角色:${c.role || ''}`);
    });

    parts.push(`\n【生成要求】`);
    parts.push(`请生成 120-180 字的 visualPrompt，用于视频生成。`);
    parts.push(`内容需包含：`);
    parts.push(`1. 场景环境`);
    parts.push(`2. 人物动作与姿态`);
    parts.push(`3. 镜头景别或机位`);
    parts.push(`4. 光线与画面质感`);
    parts.push(`5. 纪录片/真实科普风格`);
    parts.push(`6. 不要出现参数化提示词，不要出现分辨率、英文模型参数、括号权重`);

    parts.push(`\n【风格要求】`);
    parts.push(`- 超写实纪录片风格`);
    parts.push(`- 医疗/科普场景真实可信`);
    parts.push(`- 人物表情自然，不夸张`);
    parts.push(`- 适合后续视频生成模型理解`);

    parts.push(`\n【硬性约束】`);
    parts.push(`- 输出必须是合法JSON`);
    parts.push(`- 顶层只包含 id 和 visualPrompt`);
    parts.push(`- id 必须与输入一致`);

    parts.push(`\n【输出示例】`);
    parts.push(`{\n  "id": "${scene.id}",\n  "visualPrompt": "超写实纪录片风格，专业医疗科普环境中，主持人面对镜头进行清晰讲解，神态自然沉稳，人物位于中近景构图，背景为整洁明亮的诊室或科普演播空间，画面采用柔和自然光，细节真实，镜头稳定，整体呈现专业、可信、克制的医学科普质感。"\n}`);

    return parts.join('\n');
  }

  _buildFallbackDialogue(scene, characters = {}) {
    const name = scene.name || '当前场景';

    if (scene.type === 'establishing') {
      return `大家好，今天我们来了解一下${name}相关的核心内容。`;
    }

    if (scene.type === 'explanation') {
      return `这一部分我们重点讲解${name}，帮助大家快速抓住关键知识点。`;
    }

    if (scene.type === 'demonstration') {
      return `接下来我们通过一个示范动作，直观理解${name}的表现和检查方式。`;
    }

    if (scene.type === 'closing') {
      return `最后再强调一次，如果出现相关症状，一定要及时就医，不要拖延。`;
    }

    return `下面进入${name}。`;
  }

  _buildFallbackNarration(scene) {
    return scene.description || `${scene.name || '该场景'}的补充说明。`;
  }

  _buildFallbackVisualPrompt(scene, world) {
    return [
      `超写实纪录片风格，`,
      `${world?.setting || '真实场景'}，`,
      `镜头表现${scene.name || '当前场景'}，`,
      `突出${scene.description || '关键信息讲解'}，`,
      `人物动作自然，表情专业克制，`,
      `采用中近景或特写镜头，`,
      `自然光或柔和室内布光，`,
      `画面真实、干净、稳定，适合医学科普视频生成。`
    ].join('');
  }

  _inferEmotionPhase(scene) {
    switch (scene.type) {
      case 'establishing':
        return 'curiosity';
      case 'explanation':
        return 'tension';
      case 'demonstration':
        return 'climax';
      case 'closing':
        return 'resolution';
      default:
        return 'curiosity';
    }
  }
'''

# 替换
new_lines = lines[:start_line] + [new_content] + lines[end_line:]

# 写入文件
with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'w') as f:
    f.writelines(new_lines)

print(f"✅ 替换完成! 删除了 {end_line - start_line} 行，插入了 {new_content.count(chr(10))} 行")

# 验证
with open('/root/.openclaw/workspace/systems/nirath-master-pipeline.js', 'r') as f:
    content = f.read()

if '_generateScriptCorePhase' in content:
    print("✅ _generateScriptCorePhase 已添加")
else:
    print("❌ _generateScriptCorePhase 未找到")

if '_generateVisualPromptPhase' in content:
    print("✅ _generateVisualPromptPhase 已添加")
else:
    print("❌ _generateVisualPromptPhase 未找到")

if '_buildScriptCorePrompt' in content:
    print("✅ _buildScriptCorePrompt 已添加")
else:
    print("❌ _buildScriptCorePrompt 未找到")

if '_buildFallbackDialogue' in content:
    print("✅ _buildFallbackDialogue 已添加")
else:
    print("❌ _buildFallbackDialogue 未找到")

print(f"文件总行数: {content.count(chr(10))}")
