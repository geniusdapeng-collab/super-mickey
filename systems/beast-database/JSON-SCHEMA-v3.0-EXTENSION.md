# 神兽档案JSON Schema v3.0 扩展设计

## 目标
让15维度渲染器自动生成的内容 **比手工精修飞书文档更深、更完整**

## 当前JSON缺失字段（导致渲染深度不够）

### 1. AgentX交互维度（全新增加）
```json
{
  "xiaoGInteraction": {
    "friendlyLevel": 55,
    "friendlyLevelDesc": "友好度55/100——亦敌亦友，需通过考验",
    "trustLevel": "B级信任",
    "trustLevelDesc": "B级信任——需完成特定任务才能提升至A级",
    "tasks": [
      {
        "taskId": 1,
        "taskName": "幻术试炼",
        "taskDesc": "在九尾狐的幻术中保持清醒，找到真实",
        "reward": "信任度+10，获得幻术抗性"
      }
    ],
    "tasksCount": 4,
    "bondName": "真相之舞",
    "bondDesc": "AgentX与九尾狐以'真相'为契约纽带，九尾狐不再用幻术欺骗AgentX",
    "emotionalArc": "迷惑→警惕→理解→友谊",
    "emotionalArcDetails": "AgentX初到青丘群岛时被幻术迷惑（恐惧），识破后产生警惕（怀疑），理解九尾狐的守护使命（理解），最终建立基于真相的友谊（信任）"
  }
}
```

### 2. Prompt工程维度（全新增加）
```json
{
  "promptEngineering": {
    "fullPrompt490": "完整的490字中文Prompt成品，可直接用于AI视频生成",
    "fullPromptBreakdown": {
      "scene": "场景描述部分",
      "character": "角色描述部分",
      "action": "动作描述部分",
      "style": "风格指令部分",
      "negative": "负面提示词部分"
    },
    "promptOptimizationNotes": "Prompt优化说明——为什么这么写、哪些词关键、如何控制字数"
  }
}
```

### 3. 质量评分维度（全新增加）
```json
{
  "qualityScore": {
    "totalScore": 46,
    "totalMax": 50,
    "grade": "优秀",
    "dimensionScores": {
      "visualImpact": 10,
      "narrativeDepth": 9,
      "nirathIntegration": 10,
      "promptQuality": 8,
      "xiaoGChemistry": 9
    },
    "scoreRationale": "评分理由说明"
  }
}
```

### 4. Nirath融合深度（扩展）
```json
{
  "nirathIntegration": {
    "innovationDesc": "Nirath融合创新设定详解——如何将传统神兽转化为科幻设定",
    "scientificBasis": "科学依据——为什么这个设定合理",
    "visualManifestation": "视觉表现——如何在画面中体现这个设定",
    "narrativeFunction": "叙事功能——这个设定在故事中起什么作用"
  }
}
```

### 5. 叙事价值分析（扩展）
每个传说增加叙事价值字段：
```json
{
  "keyLegends": [
    {
      "title": "传说标题",
      "content": "传说内容",
      "narrativeValue": "这个传说在故事中的叙事功能",
      "emotionalBeat": "这个传说对应的情感节拍（恐惧/敬畏/信任等）",
      "sceneConversion": "如何转化为镜头——建议景别/运镜/时长",
      "dialogueHints": "对话提示——AgentX和神兽可能说什么"
    }
  ]
}
```

### 6. 深度解析字段（各维度增加）
每个主要维度增加 "深度解析" 字段：
- habitat → habitatDeepAnalysis
- bodyPlan → bodyPlanDeepAnalysis
- texture → textureDeepAnalysis
- colorPalette → colorPaletteDesignLogic
- originStory → originStoryDeepAnalysis
- symbolism → symbolismSystemInterpretation

## 渲染器v3.0 升级计划

### 新增渲染逻辑
1. **AgentX交互维度渲染**：友好度进度条、信任等级徽章、任务列表、羁绊故事
2. **Prompt工程维度渲染**：完整Prompt展示、分段解析、优化笔记
3. **质量评分渲染**：雷达图文字版、评分理由
4. **Nirath融合渲染**：创新设定详解、科学依据、视觉表现
5. **叙事价值渲染**：每个传说的叙事功能、情感节拍、镜头转化建议

### 渲染深度增强
每个维度的渲染都包含：
- 基础信息（JSON数据）
- 深度解析（新字段）
- 设计逻辑（推理说明）
- 叙事功能（如何用在故事中）
- 视觉指导（如何在画面中体现）

## 实施步骤
1. 更新JSON schema（所有40只神兽）
2. 为烛龙填充完整v3.0数据（标杆）
3. 升级渲染器到v3.0
4. 渲染烛龙v3.0，对比v2.0
5. 队长确认后，批量更新40只神兽
