# 🎬 健康科普视频预生产 - 完整提示词

> **项目**: 什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查
> **版本**: v6.6.9.4-patch11
> **生成时间**: 2026-06-17
> **总镜头数**: 6
> **总时长**: 64秒
> **画幅比例**: 16:9
> **角色**: 陈卓（警服）

---

## S00

| 属性 | 值 |
|------|-----|
| 类型 | opening |
| 时长 | 9秒 |
| 场景 | 片头 |
| 角色 | chen-zhuo |

### 💬 Dialogue（台词）

系列片头

### 🎬 Final Render Prompt（最终渲染提示词）

```
16:9宽屏电影级镜头。【约束】16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic | 【基础】hyperrealistic, ultra-detailed, high dynamic range, film grain, 35mm texture, cinematic film | 【空间】明亮整洁的健康科普演播室/医疗教育环境，柔和自然光，干净真实 | 【主体】陈卓，身穿专业医护工作服，亲切温和，专业可信，面向镜头，自然微笑 | 【动态】【0-2.3s 钩子】超写实纪录片风格，画面从柔和渐变中亮起，展现明亮整洁的健康科普演播室或医疗教育环境，柔和自然光从侧方洒入，画面干净真实，专业医疗质感。 【2.3-6.8s 展开】主讲人陈卓身穿专业医护工作服，位于画面中央偏左位置，姿态端正自然，面向镜头。画面采用中近景构图，背景为干净明亮的医疗科普环境，可见健康宣传海报或人体示意图，柔和专业布光，肤色真实细腻。 【6.8-9.0s 定格】画面定格，主讲人微笑自然，双手自然交叠或轻做手势。画面右侧或底部浮现标题：主标题【health-edu-ep01-rhabdo-v669】，整体呈现权威、可信、温暖的医学科普开场质感。 | 【风格】color palette: natural earth tones + daylight highlights + medical white accents, professional documentary aesthetic | 【质控】blurry, low resolution, cartoon, anime, 3D render, CGI, plastic look, overexposed, crushed blacks, distorted face, extra fingers, waxy skin | 【明亮约束】自然光或柔和室内照明，画面真实干净，禁止暗黑/灰暗 | 【角色约束】画面中仅出现陈卓，禁止重复角色
```

### 👄 Mouth Action（口型动作）

片头标题展现,无口播

### 🎥 Camera Movement（运镜）

```json
{
  "description": "片头运镜由opening-system-v3.js控制",
  "isOpening": true,
  "timeline": null
}
```

---

## S01

| 属性 | 值 |
|------|-----|
| 类型 | opening |
| 时长 | 6秒 |
| 场景 | 医院大厅开场 |
| 角色 | chen-zhuo |

### 📖 Narration（旁白/讲解词）

今天想和大家聊一个运动健身里可能遇到的健康隐患。

### 💬 Dialogue（台词）

今天想和大家聊一个运动健身里可能遇到的健康隐患。

### 🎨 Visual Prompt（视觉描述）

```
超写实纪录片风格，专业健康科普演播室内，主讲人陈卓身穿整洁便装或白大褂，正面朝向镜头站立或端坐，神态亲和自然，双手适度配合讲解动作。竖屏中近景构图，人物占据画面主体，背景为明亮整洁的医疗咨询室或科普演播空间，墙面可有简约健康宣传元素。柔和自然光从侧前方漫射，面部明暗过渡细腻，肤色真实，镜头稳定，画面色调克制真实，整体呈现专业、亲切、可信的医学科普开场质感。, Arri Alexa 65, Cooke S7/i, f/2.0 shallow DOF, natural diffused overcast, no hard light, muted desaturated earth tones, teal shadows, warm highlights, subsurface scattering, motion blur on fast elements, subtle film grain, subtle golden rim backlight, luminous edge glow separating subject, warm champagne gold and ivory white color palette, ambient gold 15% + structural gold 20% + highlight gold 10%
```

### 🎬 Final Render Prompt（最终渲染提示词）

```
【视觉】{CHARACTER: chen-zhuo | DIALOGUE: 今天想和大家聊一个运动健身里可能遇到的健康隐患。 | SCENE: 医院大厅开场 | MOOD: establishing | CAMERA: （一镜到底！），镜头时间轴：0-2s: static (宁静) → 2-4s: push_in (聚焦) → 4-6s: orbit_right (升华)，medium shot from normal，平滑 smooth_track，由generic驱动，使用35mm，运镜路径：standard tracking，参考影片氛围：general cinematic；orbit_360，极端远景（环境全貌）；push_in，远景（环境+主体）；push_in，中景（半身/双人） | LIGHTING: 仅轮廓可见 2000K；侧光渐强 2800K；主体清晰 4500K | NEGATIVE: no blurry, no low resolution, no watermark, no text, no logo, no duplicate elements, no broken anatomy, no cartoon, no anime, no illustration, no plastic skin, no CGI look, no deformed hands, no extra fingers | AUDIO: 【环境音效】风穿过物体声、风声 | RENDER: 电影级、超写实、细节丰富 | DIRECTOR: 景别策略:progressive_reveal；光影策略:dawn_break；速度曲线:slow_fast_slow} [创意指数0.5][[LIGHTING:L2]] 电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充 [[COLOR:L2]] 电影级色彩：电影LUT、冷暖对比、单色调色 [[VFX:L2]] 电影级特效：光效粒子、镜头光晕、环境互动粒子[/创意指数]。中景为主，特写辅助。人物专业可信，画面清晰明亮。 | 【运镜】缓慢推镜，聚焦主体。构图稳定，焦点清晰。 | 【光影】自然光，柔和补光，明亮清晰。色温4500K，明暗适中。 | 【音频】环境音自然，人声清晰。中等语速，关键信息停顿，便于理解记忆。 | 【渲染】超写实风格，高清细腻，色彩准确，适合医疗科普传播。
```

### 👄 Mouth Action（口型动作）

speaking_normal

### 🎥 Camera Movement（运镜）

```json
{
  "timeline": {
    "strategy": "动态揭示推进",
    "reasoning": "好奇心情绪需要通过空间信息的逐步揭露来构建，从环境全貌到核心细节的视觉递进，配合稳定的镜头运动形成探索感，让观众产生'接下来会发现什么'的期待",
    "segmentCount": 2,
    "segments": [
      {
        "index": 0,
        "timeRange": "0-3",
        "shotSize": "wide",
        "movement": "轨道向左平移90cm，机位高度从180cm匀速降至120cm",
        "speed": "30cm/秒",
        "reason": "宽幅建立空间环境，横向位移配合降镜制造窥探视角，避开extreme_wide限制，用动态wide模拟场景展开感"
      },
      {
        "index": 1,
        "timeRange": "3-6",
        "shotSize": "medium",
        "movement": "向前推轨60cm同时向右摇摄15度",
        "speed": "20cm/秒",
        "reason": "中景锁定潜在运动区域（如器械/瑜伽垫），推轨加轻微摇摄形成主动探索姿态，将好奇心引导至具体健身隐患标的物"
      }
    ],
    "generatedBy": "LLM-v4",
    "description": "动态揭示推进：从wide逐步过渡到medium，共2段，强调内容驱动的细微推进。",
    "transitionType": "llm_v4",
    "timeline": {
      "strategy": "动态揭示推进",
      "reasoning": "好奇心情绪需要通过空间信息的逐步揭露来构建，从环境全貌到核心细节的视觉递进，配合稳定的镜头运动形成探索感，让观众产生'接下来会发现什么'的期待",
      "segments": [
        {
          "index": 0,
          "timeRange": "0-3",
          "shotSize": "wide",
          "movement": "轨道向左平移90cm，机位高度从180cm匀速降至120cm",
          "speed": "30cm/秒",
          "reason": "宽幅建立空间环境，横向位移配合降镜制造窥探视角，避开extreme_wide限制，用动态wide模拟场景展开感"
        },
        {
          "index": 1,
          "timeRange": "3-6",
          "shotSize": "medium",
          "movement": "向前推轨60cm同时向右摇摄15度",
          "speed": "20cm/秒",
          "reason": "中景锁定潜在运动区域（如器械/瑜伽垫），推轨加轻微摇摄形成主动探索姿态，将好奇心引导至具体健身隐患标的物"
        }
      ]
    }
  },
  "v4Enabled": true,
  "v4Analysis": {
    "spaceSize": "medium",
    "sceneType": "establishing",
    "sceneTypeName": "建立",
    "segmentCount": 3,
    "constraints": {
      "minSize": "medium",
      "maxSize": "wide",
      "forbidden": [
        "extreme_wide"
      ],
      "preferred": [
        "wide",
        "medium"
      ],
      "defaultSize": "wide"
    },
    "movementStyle": "reveal",
    "characterCount": 1,
    "duration": 6,
    "shotId": "医院大厅开场",
    "dialogue": "今天想和大家聊一个运动健身里可能遇到的健康隐患。",
    "emotionPhase": "curiosity"
  },
  "v4Continuity": null,
  "description": "动态揭示推进：从wide逐步过渡到medium，共2段精细运镜。首段：轨道向左平移90cm，机位高度从180cm匀速降至120cm。设计意图：好奇心情绪需要通过空间信息的逐步揭露来构建，从环境全貌到核心细节的视觉递进，配合稳定的镜头运动形成探索感，让观众产生'接下来会发现什么'的期待",
  "shotSize": "wide",
  "position": "center",
  "movement": "轨道向左平移90cm，机位高度从180cm匀速降至120cm",
  "speed": "30cm/秒",
  "timeRange": "0-3"
}
```

---

## S02

| 属性 | 值 |
|------|-----|
| 类型 | content |
| 时长 | 10秒 |
| 场景 | 症状警示 |
| 角色 | chen-zhuo, presenter |

### 📖 Narration（旁白/讲解词）

很多人觉得肌肉酸痛就是练到位了，但如果尿色变深、全身无力，这可能是横纹肌溶解的信号，必须立刻就医。

### 💬 Dialogue（台词）

很多人觉得肌肉酸痛就是练到位了，但如果尿色变深、全身无力，这可能是横纹肌溶解的信号，必须立刻就医。

### 🎨 Visual Prompt（视觉描述）

```
超写实纪录片风格，真实医疗科普演播室内，陈卓身着专业正装立于简洁医学背景前，面向镜头进行清晰讲解，左手自然垂放，右手辅以适度手势强调重点，神情专注而平和。竖屏中近景构图，人物占据画面主体，背景可见真实的人体模型或医学挂图与整洁的白色墙面。画面采用柔和均匀的自然光与室内照明混合，肤色真实细腻，无明显滤镜，镜头稳定，整体呈现权威、可信且贴近现实的医疗教育质感。, Arri Alexa 65, Cooke S7/i, f/2.0 shallow DOF, natural diffused overcast, no hard light, muted desaturated earth tones, teal shadows, warm highlights, subsurface scattering, motion blur on fast elements, subtle film grain, subtle golden rim backlight, luminous edge glow separating subject, warm champagne gold and ivory white color palette, ambient gold 15% + structural gold 20% + highlight gold 10%
```

### 🎬 Final Render Prompt（最终渲染提示词）

```
【视觉】{CHARACTER: chen-zhuo，presenter | DIALOGUE: 很多人觉得肌肉酸痛就是练到位了，但如果尿色变深、全身无力，这可能是横纹肌溶解的信号，必须立刻就医。 | SCENE: 症状警示 | MOOD: tension | CAMERA: （一镜到底！），镜头时间轴：0-3s: static (宁静) → 3-7s: push_in (聚焦) → 7-10s: orbit_right (升华)，medium shot from normal，平滑 smooth_track，由generic驱动，使用35mm，运镜路径：standard tracking，参考影片氛围：general cinematic；orbit_360，极端远景（环境全貌）；push_in，远景（环境+主体）；push_in，中景（半身/双人） | LIGHTING: 仅轮廓可见 2000K；侧光渐强 2800K；主体清晰 4500K | NEGATIVE: no blurry, no low resolution, no watermark, no text, no logo, no duplicate elements, no broken anatomy, no cartoon, no anime, no illustration, no plastic skin, no CGI look, no deformed hands, no extra fingers | AUDIO: 【环境音效】风穿过物体声、风声 | RENDER: 电影级、超写实、细节丰富 | DIRECTOR: 景别策略:progressive_reveal；光影策略:dawn_break；速度曲线:slow_fast_slow} [创意指数0.5][[LIGHTING:L2]] 电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充 [[COLOR:L2]] 电影级色彩：电影LUT、冷暖对比、单色调色 [[VFX:L2]] 电影级特效：光效粒子、镜头光晕、环境互动粒子[/创意指数]。中景为主，特写辅助。人物专业可信，画面清晰明亮。 | 【运镜】缓慢推镜，聚焦主体。构图稳定，焦点清晰。 | 【光影】自然光，柔和补光，明亮清晰。色温4500K，明暗适中。 | 【音频】环境音自然，人声清晰。中等语速，关键信息停顿，便于理解记忆。 | 【渲染】超写实风格，高清细腻，色彩准确，适合医疗科普传播。
```

### 👄 Mouth Action（口型动作）

speaking_emphasis

### 🎥 Camera Movement（运镜）

```json
{
  "timeline": {
    "strategy": "张力递进式推切镜",
    "reasoning": "针对医疗警示台词，前半段用缓慢推近制造潜伏危机，中段用急速推切特写放大生理恐惧，末段用微震颤强化病理严重性与紧迫感。全程在无人物空镜中通过景别紧缩和速度变化传递情绪转折。",
    "segmentCount": 3,
    "segments": [
      {
        "index": 0,
        "timeRange": "0-3.3",
        "shotSize": "medium",
        "movement": "摄影机以每秒0.4厘米的速度轻微前推2厘米，同时从低于视线3°抬升至平视，建立稳定进入感。",
        "speed": "slow",
        "reason": "台词前半段为日常误区叙述，中景缓慢推近建立表面平静下暗藏隐患的视觉基调。"
      },
      {
        "index": 1,
        "timeRange": "3.3-6.7",
        "shotSize": "close_up",
        "movement": "镜头保持人物主体在画面中心偏左5%，以每秒0.6厘米的速度向前推进3厘米，并微量右移4厘米，强化讲解重点。",
        "speed": "fast",
        "reason": "转折词触发节奏突变，快速切入特写对准病理对象，制造信息冲击与生理不安。"
      },
      {
        "index": 2,
        "timeRange": "6.7-10",
        "shotSize": "close_up",
        "movement": "微震2cm/s叠加横摇4度/秒",
        "speed": "medium",
        "reason": "揭示重症病名，手持微震模拟身体失控感，强化必须立刻就医的紧迫命令。"
      }
    ],
    "generatedBy": "LLM-v4",
    "description": "张力递进式推切镜：从medium逐步过渡到close_up，共3段，强调内容驱动的细微推进。",
    "transitionType": "llm_v4",
    "timeline": {
      "strategy": "张力递进式推切镜",
      "reasoning": "针对医疗警示台词，前半段用缓慢推近制造潜伏危机，中段用急速推切特写放大生理恐惧，末段用微震颤强化病理严重性与紧迫感。全程在无人物空镜中通过景别紧缩和速度变化传递情绪转折。",
      "segments": [
        {
          "index": 0,
          "timeRange": "0-3.3",
          "shotSize": "medium",
          "movement": "摄影机以每秒0.4厘米的速度轻微前推2厘米，同时从低于视线3°抬升至平视，建立稳定进入感。",
          "speed": "slow",
          "reason": "台词前半段为日常误区叙述，中景缓慢推近建立表面平静下暗藏隐患的视觉基调。"
        },
        {
          "index": 1,
          "timeRange": "3.3-6.7",
          "shotSize": "close_up",
          "movement": "镜头保持人物主体在画面中心偏左5%，以每秒0.6厘米的速度向前推进3厘米，并微量右移4厘米，强化讲解重点。",
          "speed": "fast",
          "reason": "转折词触发节奏突变，快速切入特写对准病理对象，制造信息冲击与生理不安。"
        },
        {
          "index": 2,
          "timeRange": "6.7-10",
          "shotSize": "close_up",
          "movement": "微震2cm/s叠加横摇4度/秒",
          "speed": "medium",
          "reason": "揭示重症病名，手持微震模拟身体失控感，强化必须立刻就医的紧迫命令。"
        }
      ]
    }
  },
  "v4Enabled": true,
  "v4Analysis": {
    "spaceSize": "medium",
    "sceneType": "dialogue",
    "sceneTypeName": "对话",
    "segmentCount": 3,
    "constraints": {
      "minSize": "medium",
      "maxSize": "wide",
      "forbidden": [
        "extreme_wide"
      ],
      "preferred": [
        "medium",
        "close_up"
      ],
      "defaultSize": "medium"
    },
    "movementStyle": "stable",
    "characterCount": 2,
    "duration": 10,
    "shotId": "症状警示",
    "dialogue": "很多人觉得肌肉酸痛就是练到位了，但如果尿色变深、全身无力，这可能是横纹肌溶解的信号，必须立刻就医。",
    "emotionPhase": "tension"
  },
  "v4Continuity": {
    "valid": true,
    "warnings": [],
    "fixes": []
  },
  "description": "张力递进式推切镜：从medium逐步过渡到close_up，共3段精细运镜。首段：摄影机以每秒0.4厘米的速度轻微前推2厘米，同时从低于视线3°抬升至平视，建立稳定进入感。。设计意图：针对医疗警示台词，前半段用缓慢推近制造潜伏危机，中段用急速推切特写放大生理恐惧，末段用微震颤强化病理严重性与紧迫感。全程在无人物空镜中通过景别紧缩和速度变化传递",
  "shotSize": "medium",
  "position": "center",
  "movement": "摄影机以每秒0.4厘米的速度轻微前推2厘米，同时从低于视线3°抬升至平视，建立稳定进入感。",
  "speed": "slow",
  "timeRange": "0-3.3"
}
```

---

## S03

| 属性 | 值 |
|------|-----|
| 类型 | content |
| 时长 | 13秒 |
| 场景 | 症状警示 |
| 角色 | chen-zhuo |

### 📖 Narration（旁白/讲解词）

如果大家运动后肌肉剧烈酸痛，伴随全身无力，而且尿液变成了浓茶色或者酱油色，这时候千万别硬撑，这很可能是横纹肌溶解的典型信号。

### 💬 Dialogue（台词）

如果大家运动后肌肉剧烈酸痛，伴随全身无力，而且尿液变成了浓茶色或者酱油色，这时候千万别硬撑，这很可能是横纹肌溶解的典型信号。

### 🎨 Visual Prompt（视觉描述）

```
超写实纪录片风格，专业医疗科普演播环境中，陈卓身穿白大褂或正式便装，正面面对镜头站立讲解，神态认真关切，双手自然配合讲解做出示意动作，位于中近景竖屏构图，人物占据画面主体，背景为简洁明亮的医院诊室或科普演播空间，墙面干净专业，光线采用柔和自然光，肤色与衣物纹理细节真实，镜头稳定微微仰拍，整体画面呈现权威、真实、克制的医学科普质感。, Arri Alexa 65, Cooke S7/i, f/2.0 shallow DOF, natural diffused overcast, no hard light, muted desaturated earth tones, teal shadows, warm highlights, subsurface scattering, motion blur on fast elements, subtle film grain, subtle golden rim backlight, luminous edge glow separating subject, warm champagne gold and ivory white color palette, ambient gold 15% + structural gold 20% + highlight gold 10%
```

### 🎬 Final Render Prompt（最终渲染提示词）

```
【视觉】{CHARACTER: chen-zhuo | DIALOGUE: 如果大家运动后肌肉剧烈酸痛，伴随全身无力，而且尿液变成了浓茶色或者酱油色，这时候千万别硬撑，这很可能是横纹肌溶解的典型信号。 | SCENE: 症状警示 | MOOD: tension | CAMERA: （一镜到底！），镜头时间轴：0-4s: static (宁静) → 4-9s: push_in (聚焦) → 9-13s: orbit_right (升华)，medium shot from normal，平滑 smooth_track，由generic驱动，使用35mm，运镜路径：standard tracking，参考影片氛围：general cinematic；orbit_360，极端远景（环境全貌）；push_in，远景（环境+主体）；push_in，中景（半身/双人） | LIGHTING: 仅轮廓可见 2000K；侧光渐强 2800K；主体清晰 4500K | NEGATIVE: no blurry, no low resolution, no watermark, no text, no logo, no duplicate elements, no broken anatomy, no cartoon, no anime, no illustration, no plastic skin, no CGI look, no deformed hands, no extra fingers | AUDIO: 【环境音效】风声、风穿过物体声 | RENDER: 电影级、超写实、细节丰富 | DIRECTOR: 景别策略:progressive_reveal；光影策略:dawn_break；速度曲线:slow_fast_slow} [创意指数0.5][[LIGHTING:L2]] 电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充 [[COLOR:L2]] 电影级色彩：电影LUT、冷暖对比、单色调色 [[VFX:L2]] 电影级特效：光效粒子、镜头光晕、环境互动粒子[/创意指数]。中景为主，特写辅助。人物专业可信，画面清晰明亮。 | 【运镜】稳定推进，适度跟随。构图稳定，焦点清晰。 | 【光影】自然光，柔和补光，明亮清晰。色温4500K，明暗适中。 | 【音频】环境音自然，人声清晰。中等语速，关键信息停顿，便于理解记忆。 | 【渲染】超写实风格，高清细腻，色彩准确，适合医疗科普传播。
```

### 👄 Mouth Action（口型动作）

speaking_normal

### 🎥 Camera Movement（运镜）

```json
{
  "description": "平滑平稳左移，中景居中构图，纪录片场景。5秒内完成景别过渡，保持画面稳定流畅。通过精准的镜头运动引导观众视线，强化叙事节奏。",
  "movement": "slide_left",
  "movementType": "slide_left",
  "speed": "smooth",
  "shotSize": "medium",
  "position": "center",
  "timeRange": [
    0,
    5
  ],
  "physics": false
}
```

---

## S04

| 属性 | 值 |
|------|-----|
| 类型 | content |
| 时长 | 15秒 |
| 场景 | 典型症状警示 |
| 角色 | chen-zhuo |

### 📖 Narration（旁白/讲解词）

陈卓在这里提醒大家，要是运动后肌肉持续剧痛，尿液还变成了深茶色，千万别不当回事，必须立刻就医。

### 💬 Dialogue（台词）

陈卓在这里提醒大家，要是运动后肌肉持续剧痛，尿液还变成了深茶色，千万别不当回事，必须立刻就医。

### 🎨 Visual Prompt（视觉描述）

```
超写实纪录片风格，明亮的医疗科普演播室内，陈卓身着白大褂或整洁正装，面向镜头站立讲解，神情严肃而关切，双手配合语言做出自然手势。画面采用竖屏中近景构图，人物位于画面中央，背景可见简洁的医疗教育展板或诊室内景。柔和自然光从侧面洒入，面部细节清晰真实，无明显滤镜。镜头稳定，景深适中，整体呈现专业、冷静、值得信赖的健康科普质感，突出医学警示的严肃性。, Arri Alexa 65, Cooke S7/i, f/2.0 shallow DOF, natural diffused overcast, no hard light, muted desaturated earth tones, teal shadows, warm highlights, subsurface scattering, motion blur on fast elements, subtle film grain, subtle golden rim backlight, luminous edge glow separating subject, warm champagne gold and ivory white color palette, ambient gold 15% + structural gold 20% + highlight gold 10%
```

### 🎬 Final Render Prompt（最终渲染提示词）

```
【视觉】{CHARACTER: chen-zhuo | DIALOGUE: 陈卓在这里提醒大家，要是运动后肌肉持续剧痛，尿液还变成了深茶色，千万别不当回事，必须立刻就医。 | SCENE: 典型症状警示 | MOOD: tension | CAMERA: （一镜到底！），镜头时间轴：0-5s: static (宁静) → 5-10s: push_in (聚焦) → 10-15s: orbit_right (升华)，medium shot from normal，平滑 smooth_track，由generic驱动，使用35mm，运镜路径：standard tracking，参考影片氛围：general cinematic；orbit_360，极端远景（环境全貌）；push_in，远景（环境+主体）；push_in，中景（半身/双人） | LIGHTING: 仅轮廓可见 2000K；侧光渐强 2800K；主体清晰 4500K | NEGATIVE: no blurry, no low resolution, no watermark, no text, no logo, no duplicate elements, no broken anatomy, no cartoon, no anime, no illustration, no plastic skin, no CGI look, no deformed hands, no extra fingers | AUDIO: 【环境音效】风穿过物体声、风声 | RENDER: 电影级、超写实、细节丰富 | DIRECTOR: 景别策略:progressive_reveal；光影策略:dawn_break；速度曲线:slow_fast_slow} [创意指数0.5][[LIGHTING:L2]] 电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充 [[COLOR:L2]] 电影级色彩：电影LUT、冷暖对比、单色调色 [[VFX:L2]] 电影级特效：光效粒子、镜头光晕、环境互动粒子[/创意指数]。中景为主，特写辅助。人物专业可信，画面清晰明亮。 | 【运镜】缓慢推镜，聚焦主体。构图稳定，焦点清晰。 | 【光影】自然光，柔和补光，明亮清晰。色温4500K，明暗适中。 | 【音频】环境音自然，人声清晰。中等语速，关键信息停顿，便于理解记忆。 | 【渲染】超写实风格，高清细腻，色彩准确，适合医疗科普传播。
```

### 👄 Mouth Action（口型动作）

speaking_emphasis

### 🎥 Camera Movement（运镜）

```json
{
  "timeline": {
    "strategy": "压迫式渐近",
    "reasoning": "健康警告内容需要建立紧迫感，通过景别逐步收紧和镜头不安定运动传递身体危机的隐喻，最终锁定在面部信息让警示具有不可逃避的压迫力。",
    "segmentCount": 3,
    "segments": [
      {
        "index": 0,
        "timeRange": "0-5",
        "shotSize": "medium",
        "movement": "手持向前推进15厘米，同时向右微摇3度模拟急促呼吸",
        "speed": "0.3秒/厘米，伴随不规则0.5秒/度抖动",
        "reason": "以中景建立说话者权威感，缓慢推进制造逼近紧张，微小角度偏移暗示生理系统的不稳定。"
      },
      {
        "index": 1,
        "timeRange": "5-10",
        "shotSize": "close_up",
        "movement": "从嘴角血迹暗示区域横摇至眼部，行程8厘米，配合垂直下坠2厘米模拟肌肉失控",
        "speed": "横摇0.6秒/厘米，下坠停顿1.2秒制造坠落感",
        "reason": "在'深茶色'台词时切换近景，横摇如尿液化验报告的视觉扫描，下坠运动对应身体垮塌的躯体记忆。"
      },
      {
        "index": 2,
        "timeRange": "10-15",
        "shotSize": "close_up",
        "movement": "固定机位下突然震颤前移3厘米后骤停，最终呼吸微颤0.5度往复",
        "speed": "前移0.15秒/厘米爆发式，后续0.8秒/度濒死呼吸节律",
        "reason": "'立刻就医'四字需要休克式冲击，爆发推进模拟急救警报，最终微颤如心电监护仪的残余波动，将警告刻入肌肉记忆。"
      }
    ],
    "generatedBy": "LLM-v4",
    "description": "压迫式渐近：从medium逐步过渡到close_up，共3段，强调内容驱动的细微推进。",
    "transitionType": "llm_v4",
    "timeline": {
      "strategy": "压迫式渐近",
      "reasoning": "健康警告内容需要建立紧迫感，通过景别逐步收紧和镜头不安定运动传递身体危机的隐喻，最终锁定在面部信息让警示具有不可逃避的压迫力。",
      "segments": [
        {
          "index": 0,
          "timeRange": "0-5",
          "shotSize": "medium",
          "movement": "手持向前推进15厘米，同时向右微摇3度模拟急促呼吸",
          "speed": "0.3秒/厘米，伴随不规则0.5秒/度抖动",
          "reason": "以中景建立说话者权威感，缓慢推进制造逼近紧张，微小角度偏移暗示生理系统的不稳定。"
        },
        {
          "index": 1,
          "timeRange": "5-10",
          "shotSize": "close_up",
          "movement": "从嘴角血迹暗示区域横摇至眼部，行程8厘米，配合垂直下坠2厘米模拟肌肉失控",
          "speed": "横摇0.6秒/厘米，下坠停顿1.2秒制造坠落感",
          "reason": "在'深茶色'台词时切换近景，横摇如尿液化验报告的视觉扫描，下坠运动对应身体垮塌的躯体记忆。"
        },
        {
          "index": 2,
          "timeRange": "10-15",
          "shotSize": "close_up",
          "movement": "固定机位下突然震颤前移3厘米后骤停，最终呼吸微颤0.5度往复",
          "speed": "前移0.15秒/厘米爆发式，后续0.8秒/度濒死呼吸节律",
          "reason": "'立刻就医'四字需要休克式冲击，爆发推进模拟急救警报，最终微颤如心电监护仪的残余波动，将警告刻入肌肉记忆。"
        }
      ]
    }
  },
  "v4Enabled": true,
  "v4Analysis": {
    "spaceSize": "medium",
    "sceneType": "dialogue",
    "sceneTypeName": "对话",
    "segmentCount": 3,
    "constraints": {
      "minSize": "medium",
      "maxSize": "wide",
      "forbidden": [
        "extreme_wide"
      ],
      "preferred": [
        "medium",
        "close_up"
      ],
      "defaultSize": "medium"
    },
    "movementStyle": "stable",
    "characterCount": 1,
    "duration": 15,
    "shotId": "典型症状警示",
    "dialogue": "陈卓在这里提醒大家，要是运动后肌肉持续剧痛，尿液还变成了深茶色，千万别不当回事，必须立刻就医。",
    "emotionPhase": "tension"
  },
  "v4Continuity": {
    "valid": true,
    "warnings": [],
    "fixes": []
  },
  "description": "压迫式渐近：从medium逐步过渡到close_up，共3段精细运镜。首段：手持向前推进15厘米，同时向右微摇3度模拟急促呼吸。设计意图：健康警告内容需要建立紧迫感，通过景别逐步收紧和镜头不安定运动传递身体危机的隐喻，最终锁定在面部信息让警示具有不可逃避的压迫力。",
  "shotSize": "medium",
  "position": "center",
  "movement": "手持向前推进15厘米，同时向右微摇3度模拟急促呼吸",
  "speed": "0.3秒/厘米，伴随不规则0.5秒/度抖动",
  "timeRange": "0-5"
}
```

---

## S05

| 属性 | 值 |
|------|-----|
| 类型 | closing |
| 时长 | 11秒 |
| 场景 | 结尾总结与号召 |
| 角色 | chen-zhuo |

### 📖 Narration（旁白/讲解词）

记住，运动是好事，但科学运动更重要。如果出现肌肉剧痛、尿液变色，请立即就医。健康第一，我们下期再见。

### 💬 Dialogue（台词）

记住，运动是好事，但科学运动更重要。如果出现肌肉剧痛、尿液变色，请立即就医。健康第一，我们下期再见。

### 🎨 Visual Prompt（视觉描述）

```
超写实纪录片风格，专业医疗科普演播环境中，主持人陈卓正面对镜头站立，以沉稳自然的表情直接向观众进行总结性讲解，双手可自然交叠或做适度手势强调重点。画面采用竖屏中近景构图，人物位于画面中心偏上位置，背景为简洁明亮的医疗科普空间。整体光线柔和均匀，肤色与衣物纹理细节真实，镜头稳定，营造出专业、亲切且值得信赖的医学科普氛围，结尾传递健康第一的核心信息。, Arri Alexa 65, Cooke S7/i, f/2.0 shallow DOF, natural diffused overcast, no hard light, muted desaturated earth tones, teal shadows, warm highlights, subsurface scattering, motion blur on fast elements, subtle film grain, subtle golden rim backlight, luminous edge glow separating subject, warm champagne gold and ivory white color palette, ambient gold 15% + structural gold 20% + highlight gold 10%
```

### 🎬 Final Render Prompt（最终渲染提示词）

```
【视觉】{CHARACTER: chen-zhuo | DIALOGUE: 记住，运动是好事，但科学运动更重要。如果出现肌肉剧痛、尿液变色，请立即就医。健康第一，我们下期再见。 | SCENE: 结尾总结与号召；背景景物不再压迫，整体气氛转向释然与开放 | MOOD: resolution；轻盈、安定、新生 | CAMERA: （一镜到底！），镜头时间轴：0-4s: static (宁静) → 4-7s: push_in (聚焦) → 7-11s: orbit_right (升华)，medium shot from normal，平滑 smooth_track，由generic驱动，使用35mm，运镜路径：standard tracking，参考影片氛围：general cinematic；orbit_360，极端远景（环境全貌）；push_in，远景（环境+主体）；push_in，中景（半身/双人） | LIGHTING: 仅轮廓可见 2000K；侧光渐强 2800K；主体清晰 4500K；环境中残留温暖光晕，阴影被细腻填平 | NEGATIVE: no blurry, no low resolution, no watermark, no text, no logo, no duplicate elements, no broken anatomy, no cartoon, no anime, no illustration, no plastic skin, no CGI look, no deformed hands, no extra fingers | AUDIO: 【环境音效】风声、风穿过物体声 | RENDER: 电影级、超写实、细节丰富 | DIRECTOR: 景别策略:progressive_reveal；光影策略:dawn_break；速度曲线:slow_fast_slow；结尾不要急着收，给观众1秒情绪停留} [创意指数0.5][[LIGHTING:L2]] 电影级灯光：戏剧性光影、伦勃朗光、剪影、环境光填充 [[COLOR:L2]] 电影级色彩：电影LUT、冷暖对比、单色调色 [[VFX:L2]] 电影级特效：光效粒子、镜头光晕、环境互动粒子[/创意指数]。中景为主，特写辅助。人物专业可信，画面清晰明亮。 | 【运镜】稳定推进，适度跟随。构图稳定，焦点清晰。 | 【光影】自然光，柔和补光，明亮清晰。色温4500K，明暗适中。 | 【音频】环境音自然，人声清晰。中等语速，关键信息停顿，便于理解记忆。 | 【渲染】超写实风格，高清细腻，色彩准确，适合医疗科普传播。
```

### 👄 Mouth Action（口型动作）

speaking_emphasis

### 🎥 Camera Movement（运镜）

```json
{
  "timeline": {
    "strategy": "渐进式聚焦健康警示",
    "reasoning": "resolution情绪需要平稳、可信赖的收尾感。台词前半段为温和建议，后半段转为紧急警示，最后回归温暖告别。通过景别从medium渐进到close_up再回落，配合缓慢稳定的运动，建立信任感，在警示处通过微距特写强化信息权重，最终温和收尾。",
    "segmentCount": 3,
    "segments": [
      {
        "index": 0,
        "timeRange": "0.00-4.00",
        "shotSize": "medium",
        "movement": "轨道右移30厘米，机位高度下降10厘米，持续4秒",
        "speed": "5厘米/秒",
        "reason": "开场'运动是好事'语气平和，medium景别建立宽松安全的对话空间，缓慢轨道右移营造陪伴感，让观众自然进入倾听状态"
      },
      {
        "index": 1,
        "timeRange": "4.00-8.50",
        "shotSize": "close_up",
        "movement": "镜头前推15厘米，焦点从面部眼睛区域过渡至嘴唇，持续4.5秒",
        "speed": "3.3厘米/秒",
        "reason": "'肌肉剧痛、尿液变色'为关键警示信息，close_up压缩空间制造紧迫感，缓慢前推强化信息侵入性，让观众无法回避健康警告，3.3厘米/秒的低速与内容的严重性形成张力，加深记忆锚点"
      },
      {
        "index": 2,
        "timeRange": "8.50-11.00",
        "shotSize": "medium",
        "movement": "轨道复位后撤20厘米，机位微抬5度，持续2.5秒",
        "speed": "缓慢",
        "reason": "'健康第一，下期再见'回归温暖和解，medium景别释放压迫感，后撤运动制造呼吸空间，微仰角度重建平等对话关系，2.5秒的短暂收束让resolution情绪干净落地，不拖沓"
      }
    ],
    "generatedBy": "LLM-v4",
    "description": "渐进式聚焦健康警示：从medium逐步过渡到medium，共3段，强调内容驱动的细微推进。",
    "transitionType": "llm_v4",
    "timeline": {
      "strategy": "渐进式聚焦健康警示",
      "reasoning": "resolution情绪需要平稳、可信赖的收尾感。台词前半段为温和建议，后半段转为紧急警示，最后回归温暖告别。通过景别从medium渐进到close_up再回落，配合缓慢稳定的运动，建立信任感，在警示处通过微距特写强化信息权重，最终温和收尾。",
      "segments": [
        {
          "index": 0,
          "timeRange": "0.00-4.00",
          "shotSize": "medium",
          "movement": "轨道右移30厘米，机位高度下降10厘米，持续4秒",
          "speed": "5厘米/秒",
          "reason": "开场'运动是好事'语气平和，medium景别建立宽松安全的对话空间，缓慢轨道右移营造陪伴感，让观众自然进入倾听状态"
        },
        {
          "index": 1,
          "timeRange": "4.00-8.50",
          "shotSize": "close_up",
          "movement": "镜头前推15厘米，焦点从面部眼睛区域过渡至嘴唇，持续4.5秒",
          "speed": "3.3厘米/秒",
          "reason": "'肌肉剧痛、尿液变色'为关键警示信息，close_up压缩空间制造紧迫感，缓慢前推强化信息侵入性，让观众无法回避健康警告，3.3厘米/秒的低速与内容的严重性形成张力，加深记忆锚点"
        },
        {
          "index": 2,
          "timeRange": "8.50-11.00",
          "shotSize": "medium",
          "movement": "轨道复位后撤20厘米，机位微抬5度，持续2.5秒",
          "speed": "缓慢",
          "reason": "'健康第一，下期再见'回归温暖和解，medium景别释放压迫感，后撤运动制造呼吸空间，微仰角度重建平等对话关系，2.5秒的短暂收束让resolution情绪干净落地，不拖沓"
        }
      ]
    }
  },
  "v4Enabled": true,
  "v4Analysis": {
    "spaceSize": "medium",
    "sceneType": "dialogue",
    "sceneTypeName": "对话",
    "segmentCount": 3,
    "constraints": {
      "minSize": "medium",
      "maxSize": "wide",
      "forbidden": [
        "extreme_wide"
      ],
      "preferred": [
        "medium",
        "close_up"
      ],
      "defaultSize": "medium"
    },
    "movementStyle": "stable",
    "characterCount": 1,
    "duration": 11,
    "shotId": "结尾总结与号召",
    "dialogue": "记住，运动是好事，但科学运动更重要。如果出现肌肉剧痛、尿液变色，请立即就医。健康第一，我们下期再见。",
    "emotionPhase": "resolution"
  },
  "v4Continuity": {
    "valid": true,
    "warnings": [],
    "fixes": []
  },
  "description": "渐进式聚焦健康警示：从medium逐步过渡到medium，共3段精细运镜。首段：轨道右移30厘米，机位高度下降10厘米，持续4秒。设计意图：resolution情绪需要平稳、可信赖的收尾感。台词前半段为温和建议，后半段转为紧急警示，最后回归温暖告别。通过景别从medium渐进到close_up再回落",
  "shotSize": "medium",
  "position": "center",
  "movement": "轨道右移30厘米，机位高度下降10厘米，持续4秒",
  "speed": "5厘米/秒",
  "timeRange": "0.00-4.00"
}
```

---

