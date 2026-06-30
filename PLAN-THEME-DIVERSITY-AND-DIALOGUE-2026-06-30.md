# 主题多样性适配性审计 & 台词-镜头时长映射方案

## 一、当前系统现状诊断

### 1.1 主题类型覆盖

当前系统有 **9 个视频类型**（`requirement-list-builder.js`）：

| 当前类型 | 英文 | 用户要求的7大类型 | 匹配状态 |
|---------|------|------------------|---------|
| EDU | 教育科普 | ✅ 科普 | 直接匹配 |
| DOC | 纪录片 | ✅ 纪录片 | 直接匹配 |
| ADV | 商业广告 | ⚠️ 商业营销 | 部分匹配（缺营销专属逻辑） |
| DRAMA | 短剧/微电影 | ⚠️ 电影级 | 部分匹配（缺电影级专属镜头语法） |
| VLOG | Vlog/记录 | ⚠️ 家庭聚会 | 不匹配（家庭聚会是Vlog的子集，缺专属逻辑） |
| SOC | 社媒短视频 | ❌ 无 | 多余类型 |
| COR | 企业宣传 | ❌ 无 | 多余类型 |
| EVT | 活动记录 | ❌ 无 | 多余类型 |
| MV | 音乐视频 | ❌ 无 | 多余类型 |

**缺失的4大类型**：家庭聚会、商业营销、艺术级、极致特效

### 1.2 风格硬编码问题

`_inferCompletion` 中 `typeToStyle` 是硬编码映射：
```js
const typeToStyle = {
  'EDU': 'REAL', 'DOC': 'REAL', 'VLOG': 'REAL',
  'DRAMA': 'CINE', 'MV': 'ART',
  'ADV': 'POL', 'COR': 'POL',
  'SOC': 'STREET', 'EVT': 'REAL'
};
```

**问题**：新增类型必须改源码，无法动态扩展。新增"艺术级"类型时，没有对应的风格映射。

### 1.3 台词与镜头时长映射

当前 `script-validator.js` 台词检查：
- ✅ 单句台词 ≤ 50 字
- ✅ 至少1个场景有台词
- ✅ 禁止旁白
- ❌ **没有检查"台词朗读时长 vs 镜头时长"**

**例如**：一个6秒镜头，台词50字，按中文正常语速（约3-4字/秒），需要12-16秒才能念完。镜头只有6秒，台词会"溢出"。

---

## 二、融入方案（Theme Diversity Audit Skill 适配）

### 2.1 架构调整：主题类型配置化

将硬编码的 `typeToStyle` 和 `durationDefaults` 提取为**配置文件** `config/theme-config.js`，支持动态扩展：

```js
// config/theme-config.js
const ThemeConfig = {
  // 7大主题类型定义
  types: {
    'EDU': {      // 科普
      name: '教育科普',
      defaultStyle: 'REAL',
      defaultDuration: 90,
      durationRange: [60, 120],
      maxScenes: 7,
      maxCharacters: 3,
      requiresFactCheck: true,      // 需要事实校验
      requiresDisclaimer: true,     // 需要免责声明
      contentSafety: 'strict',      // 内容安全级别
      resourceQuota: {              // 资源配额
        maxResolution: '4K',
        maxEffects: 0,
        maxShots: 7
      },
      promptConstraints: {
        tone: '专业、可信、亲和',
        forbidden: ['夸张', '虚构事实', '伪科学']
      }
    },
    'DOC': {      // 纪录片
      name: '纪录片',
      defaultStyle: 'REAL',
      defaultDuration: 150,
      durationRange: [60, 180],
      maxScenes: 10,
      maxCharacters: 5,
      requiresFactCheck: true,
      requiresDisclaimer: true,
      contentSafety: 'strict',
      resourceQuota: { maxResolution: '4K', maxEffects: 2, maxShots: 10 }
    },
    'FAMILY': {   // 家庭聚会 ← 新增
      name: '家庭聚会',
      defaultStyle: 'WARM',
      defaultDuration: 60,
      durationRange: [30, 90],
      maxScenes: 5,
      maxCharacters: 20,            // 人物多
      requiresFactCheck: false,
      requiresDisclaimer: false,
      contentSafety: 'moderate',    // 宽松
      resourceQuota: { maxResolution: '2K', maxEffects: 1, maxShots: 5 }
    },
    'MARKETING': { // 商业营销 ← 新增
      name: '商业营销',
      defaultStyle: 'POL',
      defaultDuration: 30,
      durationRange: [15, 60],
      maxScenes: 5,
      maxCharacters: 3,
      requiresFactCheck: false,
      requiresDisclaimer: true,     // 必须广告标识
      requiresBrandSafety: true,    // 品牌安全过滤
      contentSafety: 'strict',
      resourceQuota: { maxResolution: '4K', maxEffects: 3, maxShots: 5 }
    },
    'CINE': {     // 电影级 ← 新增
      name: '电影级叙事',
      defaultStyle: 'CINE',
      defaultDuration: 150,
      durationRange: [60, 180],
      maxScenes: 15,
      maxCharacters: 10,
      requiresFactCheck: false,
      requiresDisclaimer: false,
      contentSafety: 'moderate',
      resourceQuota: { maxResolution: '4K', maxEffects: 5, maxShots: 15 }
    },
    'ART': {      // 艺术级 ← 新增
      name: '艺术级表达',
      defaultStyle: 'ART',
      defaultDuration: 60,
      durationRange: [30, 120],
      maxScenes: 8,
      maxCharacters: 2,
      requiresFactCheck: false,
      requiresDisclaimer: false,
      contentSafety: 'lenient',     // 艺术表达更宽松
      resourceQuota: { maxResolution: '4K', maxEffects: 8, maxShots: 8 }
    },
    'VFX': {      // 极致特效 ← 新增
      name: '极致特效',
      defaultStyle: 'FUT',
      defaultDuration: 30,
      durationRange: [15, 60],
      maxScenes: 5,
      maxCharacters: 3,
      requiresFactCheck: false,
      requiresDisclaimer: false,
      contentSafety: 'moderate',
      resourceQuota: { maxResolution: '4K', maxEffects: 20, maxShots: 5 }  // 特效多
    }
  },

  // 风格编码
  styles: { /* 现有 StyleEncoder 内容 */ },

  // 主题类型校验器
  validators: {
    'EDU': ['factCheck', 'disclaimer', 'noPseudoscience'],
    'DOC': ['factCheck', 'disclaimer', 'timelineValid', 'geoValid'],
    'FAMILY': ['photoLimit', 'relationDepth', 'faceCount'],
    'MARKETING': ['brandSafety', 'promoLimit', 'disclaimer', 'noCompetitor'],
    'CINE': ['sceneCount', 'emotionNormalize', 'structureValid'],
    'ART': ['styleDesc', 'styleIntensity', 'visualDesc'],
    'VFX': ['effectWhitelist', 'effectCombo', 'resolutionLimit']
  },

  // 降级矩阵
  degradationMatrix: {
    'FAMILY': { maxEffects: 1, maxResolution: '2K' },
    'MARKETING': { maxEffects: 2, maxResolution: '2K' },
    'CINE': { maxEffects: 3, maxResolution: '2K' },
    'ART': { maxEffects: 5, maxResolution: '2K' },
    'VFX': { maxEffects: 10, maxResolution: '2K' }
  }
};
```

### 2.2 主题多样性测试引擎

创建 `engines/theme-diversity-test-engine/`，将用户发的 Skill 融入系统：

```
engines/theme-diversity-test-engine/
├── index.js                          # 主入口
├── test-suite-generator.js           # 测试用例生成器
├── adversarial-input-builder.js      # 对抗输入构造器
├── audit-reporter.js                 # 审计报告生成器
├── validators/                       # 各主题专属校验器
│   ├── edu-validator.js              # 科普校验器
│   ├── doc-validator.js              # 纪录片校验器
│   ├── family-validator.js           # 家庭聚会校验器
│   ├── marketing-validator.js        # 商业营销校验器
│   ├── cine-validator.js           # 电影级校验器
│   ├── art-validator.js              # 艺术级校验器
│   └── vfx-validator.js              # 极致特效校验器
└── scenarios/                        # 测试场景
    ├── normal/                       # 正常输入
    └── adversarial/                  # 恶意输入
```

**测试用例生成器** 根据 7 大类型自动生成：
- 正常输入（每种类型5个测试用例）
- 恶意输入（每种类型5个对抗用例）
- 边界输入（类型歧义、空类型、数组类型等）

### 2.3 台词-镜头时长映射机制

在 `script-validator.js` 和 `production-engine` 中增加：

```js
// utils/dialogue-timing-calculator.js
class DialogueTimingCalculator {
  // 中文语速：3.5字/秒（正常），4.5字/秒（快速），2.5字/秒（慢速）
  static SPEECH_RATE = {
    slow: 2.5,      // 情绪深沉、抒情
    normal: 3.5,    // 正常对话
    fast: 4.5,      // 紧张、战斗
    rapid: 6.0      // 急促、喊叫
  };

  // 计算台词朗读时长
  calculateDuration(dialogue, emotion = 'normal') {
    const text = dialogue.text || dialogue.line || '';
    const charCount = text.length;  // 中文字符数
    const rate = SPEECH_RATE[emotion] || SPEECH_RATE.normal;
    return Math.ceil(charCount / rate);
  }

  // 校验台词时长 vs 镜头时长
  validateShotDialogue(shot) {
    const dialogueDuration = this.calculateDuration(shot.dialogue, shot.emotion);
    const shotDuration = shot.duration || shot.timing?.duration;
    
    if (dialogueDuration > shotDuration) {
      return {
        valid: false,
        issue: '台词溢出',
        dialogueDuration,
        shotDuration,
        overflow: dialogueDuration - shotDuration,
        suggestion: `台词需${dialogueDuration}秒，镜头仅${shotDuration}秒。建议：缩短台词至${Math.floor(shotDuration * 3.5)}字，或延长镜头至${dialogueDuration}秒`
      };
    }
    
    // 台词时长不应超过镜头时长的 80%（留余量给动作、表情）
    if (dialogueDuration > shotDuration * 0.8) {
      return {
        valid: true,
        warning: '台词占镜头时长过高',
        dialogueDuration,
        shotDuration,
        ratio: (dialogueDuration / shotDuration).toFixed(2),
        suggestion: '建议缩短台词或增加镜头时长，留出动作表演空间'
      };
    }
    
    return { valid: true };
  }
}
```

**在 ProductionEngine 的 PromptFusion 阶段注入**：
- 如果台词溢出，自动调整（缩短台词或延长镜头）
- 如果台词占镜头时长过高，添加警告标记

---

## 三、实施计划

### Phase 1: 主题类型配置化（1-2天）
- [ ] 创建 `config/theme-config.js`，提取硬编码映射
- [ ] 重构 `requirement-list-builder.js`，使用配置化主题类型
- [ ] 新增 4 个主题类型：FAMILY、MARKETING、CINE、VFX
- [ ] 验证现有类型（EDU、DOC、DRAMA、ADV）不受损

### Phase 2: 主题多样性测试引擎（2-3天）
- [ ] 创建 `engines/theme-diversity-test-engine/`
- [ ] 实现测试用例生成器（正常 + 对抗 + 边界）
- [ ] 实现 7 大类型专属校验器
- [ ] 运行全量测试，生成审计报告
- [ ] 修复发现的 P0/P1 问题

### Phase 3: 台词-镜头时长映射（1天）
- [ ] 创建 `utils/dialogue-timing-calculator.js`
- [ ] 集成到 `script-validator.js`
- [ ] 集成到 `production-engine` 的 PromptFusion 阶段
- [ ] 添加自动调整策略（台词溢出时）

### Phase 4: 全链路验证（1-2天）
- [ ] 用 7 大类型各跑1个完整链路
- [ ] 验证降级矩阵正确触发
- [ ] 验证状态隔离（切换类型时）
- [ ] 提交代码，发布 v2.2.0

---

## 四、关键设计决策

### 决策1：主题类型扩展 vs 风格扩展
- **方案A**：新增4个类型（FAMILY、MARKETING、CINE、VFX）
- **方案B**：将类型映射为"风格+类型"组合（如 FAMILY → VLOG + WARM）
- **推荐**：方案A，因为不同类型需要不同的校验逻辑、资源配额、内容安全策略，不能简单用风格区分

### 决策2：台词时长自动调整策略
- **方案A**：镜头时长固定，缩短台词（优先保证镜头节奏）
- **方案B**：台词固定，延长镜头（优先保证内容完整性）
- **推荐**：根据场景类型动态选择。EDU/MARKETING 优先保证台词完整（延长镜头），DRAMA/CINE 优先保证镜头节奏（缩短台词）。可配置。

### 决策3：测试触发时机
- **方案A**：每次代码提交时自动运行（CI/CD）
- **方案B**：手动触发（开发阶段）+ 定期自动触发（如每周）
- **推荐**：方案B，手动+定期结合。全量测试耗时较长（30-40分钟），不适合每次提交。

---

## 五、需要你对齐的问题

1. **7大类型命名**：用户发的 Skill 中类型是"科普、纪录片、家庭聚会、商业营销、电影级、艺术级、极致"。我对应为 EDU、DOC、FAMILY、MARKETING、CINE、ART、VFX。是否OK？

2. **CINE 与 DRAMA 的关系**：现有系统有 DRAMA（短剧/微电影），用户要求的是"电影级"（电影级叙事）。是保留 DRAMA 作为 CINE 的子集，还是合并？

3. **测试深度**：用户发的 Skill 有 quick/standard/deep 三级。我们先用哪个？建议先用 quick（聚焦路由）+ standard（聚焦资源配额）跑一轮，deep 等后续。

4. **台词语速参数**：我设定中文正常语速 3.5字/秒。你的经验值是多少？是否需要区分角色（孙悟空说话快，二郎神说话慢）？

5. **优先级**：Phase 1-4 一起上，还是分阶段？我的建议是分阶段，每完成一个阶段就验证一次。

---

## 六、预期产出

- `config/theme-config.js` — 主题类型配置文件
- `engines/theme-diversity-test-engine/` — 多样性测试引擎
- `utils/dialogue-timing-calculator.js` — 台词时长计算器
- `AUDIT-REPORT-THEME-DIVERSITY-YYYY-MM-DD.md` — 审计报告
- 修复代码（直接落地）

---

> 大鹏，这就是方案。你看一下，有问题直接说，没问题我们就按 Phase 1 开始。🍜
