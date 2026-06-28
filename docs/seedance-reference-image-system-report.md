# Seedance reference_image 100% 生效 — 系统级解决方案报告

> **报告版本**: v2.1.1  
> **日期**: 2026-06-20  
> **适用**: 香香彩虹桥、超短裙系统、作业系统、卓越系统及其他OpenClaw视频生成系统  
> **状态**: ✅ 已验证通过（横纹肌溶解科普 EP02）

---

## 一、问题定义

### 1.1 现象描述

使用 Seedance 2.0 API 的 `reference_image` 功能时，发现：
- ❌ 定妆照未生效（角色未按定妆照生成）
- ❌ 角色服装被场景描述覆盖（如穿警服的角色变成运动装）
- ❌ 台词未生成（视频无声）
- ❌ 台词随机（说与Prompt无关的内容）
- ❌ API报错：`role must be specified`、`AccountOverdueError`、`OutputVideoSensitiveContentDetected`

### 1.2 影响范围

所有使用 Seedance 2.0 API 进行角色一致性渲染的系统。

---

## 二、根本原因分析（RCA）

### 2.1 根因树

```
定妆照未生效
├── 服装被覆盖
│   ├── Prompt未明确锁定服装（"穿警服的"）
│   ├── 场景描述权重过高（"健身房""运动"）
│   └── 缺少外观特征锚定（警帽、警徽等细节）
├── 定妆照绑定失败
│   ├── 未指定 role: "reference_image"
│   ├── 引用格式错误（@image1 而非 图片1）
│   └── 只传1张图而非3-5张多角度
├── 台词问题
│   ├── 未传 generate_audio: true
│   └── 台词含竖杠 | 干扰音频生成
└── API报错
    ├── 敏感词触发（痛苦、受伤、血汗）
    └── 账户欠费（AccountOverdueError）
```

### 2.2 核心洞察

**reference_image 不是万能药**。Seedance 2.0 在生成时会同时处理：
1. 文本Prompt的语义引导
2. reference_image 的视觉锚定
3. 场景环境的自适应调整

当三者冲突时，**文本Prompt的语义权重往往更高**。因此：
- 仅上传定妆照不够
- 必须在Prompt中**明确锁定服装**和**描述标志性配饰**
- 必须传 `generate_audio: true` 才能生成台词音频
- 必须指定 `role: "reference_image"`

---

## 三、解决方案（代码级机制）

### 3.1 系统架构

```
渲染提交流程
  │
  ├── 1. PromptGuardian（自动修复层）
  │   ├── 服装锁定检查 → 自动添加"穿警服的"
  │   ├── 外观锚定检查 → 自动添加"佩戴警帽警徽"
  │   ├── 引用格式修正 → @image1 → 图片1
  │   ├── 台词净化 → 移除竖杠 |
  │   └── 敏感词过滤 → 痛苦→不适
  │
  ├── 2. buildPayload（构建层）
  │   ├── 绑定4张定妆照（front/threeQuarter/closeup/side）
  │   ├── 设置 role: "reference_image"
  │   └── 设置 generate_audio: true
  │
  ├── 3. PipelineGuard（强制检查层）【新增】
  │   ├── REF_IMAGE_ROLE ✅
  │   ├── GENERATE_AUDIO ✅
  │   ├── REF_IMAGE_COUNT ⚠️
  │   ├── COSTUME_LOCK ✅
  │   ├── APPEARANCE_ANCHOR ⚠️
  │   ├── DIALOGUE_FORMAT ✅
  │   ├── SENSITIVE_WORDS ✅
  │   ├── REFERENCE_FORMAT ✅
  │   ├── PROMPT_LENGTH ✅
  │   └── IMAGE_FILE_VALID ✅
  │   └── ❌ 任何一项失败 → 阻止提交
  │
  └── 4. API提交
```

### 3.2 核心代码模块

#### 模块A：PromptGuardian（自动修复）

**文件**: `scripts/prompt-guardian.js`

**功能**: 在构建Payload前自动修复Prompt内容

```javascript
// 使用示例
const { PromptGuardian } = require('./prompt-guardian');
const guardian = new PromptGuardian();

const result = guardian.autoFix(prompt, [
  { id: 'chen-zhuo', name: '陈卓', role: '警察' }
]);

// result.prompt = 修复后的Prompt
// result.fixes = 修复项列表
// result.safe = 是否安全
```

**自动修复规则**:

| 规则 | 触发条件 | 修复动作 |
|------|---------|---------|
| 服装锁定 | 角色是警察但Prompt无"穿警服" | 添加"穿警服的"前缀 |
| 外观锚定 | 有"穿警服"但无配饰描述 | 添加"佩戴警帽、警徽、肩章" |
| 引用格式 | 使用@image1 | 修正为"图片1" |
| 台词净化 | 台词含竖杠\| | 替换为逗号 |
| 敏感词过滤 | 含"痛苦""受伤"等 | 替换为中性词 |

#### 模块B：RenderPipelineGuard（强制阻塞）

**文件**: `scripts/render-pipeline-guard.js` 【新增】

**功能**: 在提交API前进行10项强制检查，**不通过则阻止提交**

```javascript
// 使用示例
const { RenderPipelineGuard } = require('./render-pipeline-guard');
const guard = new RenderPipelineGuard();

// 严格模式（不通过抛异常）
guard.checkStrict(payload);

// 普通模式（返回检查结果）
const result = guard.check(payload);
// result.pass = true/false
// result.errors = 错误列表
// result.warnings = 警告列表
```

**强制检查清单**:

| 检查项 | 类型 | 说明 |
|--------|------|------|
| REF_IMAGE_ROLE | 错误 | image_url必须指定role:"reference_image" |
| GENERATE_AUDIO | 错误 | 有台词时必须generate_audio:true |
| COSTUME_LOCK | 错误 | Prompt必须明确锁定服装 |
| DIALOGUE_FORMAT | 错误 | 台词不能含竖杠\| |
| SENSITIVE_WORDS | 错误 | 不能含痛苦/受伤/死亡等词 |
| REFERENCE_FORMAT | 错误 | 不能用@imageN，必须用图片N |
| PROMPT_LENGTH | 错误 | Prompt不能超过1500字符 |
| IMAGE_FILE_VALID | 错误 | 图片base64数据必须有效 |
| REF_IMAGE_COUNT | 警告 | 建议至少3-5张定妆照 |
| APPEARANCE_ANCHOR | 警告 | 建议描述标志性配饰 |

#### 模块C：RenderSubmitterCore（统一提交）

**文件**: `scripts/render-submitter-core.js`

**集成方式**:

```javascript
// 在buildPayload方法中自动调用
buildPayload(shot, manifest) {
  // Step 1: PromptGuardian自动修复
  const guardian = new PromptGuardian();
  const fixResult = guardian.autoFix(prompt, charInfos);
  
  // Step 2: 构建Payload（含4张定妆照绑定）
  const payload = { ... };
  
  // Step 3: PipelineGuard强制检查【新增】
  const pipelineGuard = new RenderPipelineGuard();
  const guardResult = pipelineGuard.check(payload);
  
  if (!guardResult.pass) {
    throw new Error(`PIPELINE_GUARD_FAILED: ...`);
  }
  
  return payload;
}
```

---

## 四、快速复用指南

### 4.1 对于其他OpenClaw系统

**步骤1**: 复制3个核心文件到项目
```bash
cp scripts/prompt-guardian.js /your-project/scripts/
cp scripts/render-pipeline-guard.js /your-project/scripts/
cp scripts/render-submitter-core.js /your-project/scripts/
```

**步骤2**: 在构建Payload时调用Guardian
```javascript
const { PromptGuardian } = require('./scripts/prompt-guardian');
const guardian = new PromptGuardian();

// 在提交前自动修复
const result = guardian.autoFix(yourPrompt, characters);
const fixedPrompt = result.prompt;
```

**步骤3**: 在提交前强制检查
```javascript
const { RenderPipelineGuard } = require('./scripts/render-pipeline-guard');
const guard = new RenderPipelineGuard();

// 严格模式：不通过就阻止
guard.checkStrict(payload);
```

**步骤4**: 确认API参数
```javascript
const payload = {
  model: "your-endpoint",
  content: [
    { type: "text", text: fixedPrompt },
    { type: "image_url", role: "reference_image", image_url: { url: "data:image/jpeg;base64,..." } }
  ],
  ratio: "16:9",
  duration: 5,
  generate_audio: true  // 必须有台词时设置
};
```

### 4.2 对于非OpenClaw项目

**核心要点**（不依赖任何框架）：

1. **Prompt必须锁定服装**
   ```
   ❌ 陈卓站在健身房中
   ✅ 穿警服的陈卓，佩戴警帽警徽肩章，站在健身房中
   ```

2. **image_url必须加role**
   ```json
   {
     "type": "image_url",
     "role": "reference_image",
     "image_url": { "url": "data:image/jpeg;base64,..." }
   }
   ```

3. **有台词时必须generate_audio:true**
   ```json
   { "generate_audio": true }
   ```

4. **上传3-5张多角度定妆照**
   - 正面全身/半身
   - 45度角半身
   - 侧面面部/半身
   - 面部特写（推荐）

5. **避免敏感词**
   - 痛苦→不适
   - 受伤→受影响
   - 血汗→体液
   - 死亡→严重

---

## 五、验证清单（提交前必查）

- [ ] `role: "reference_image"` 已指定
- [ ] `generate_audio: true` 已设置（如有台词）
- [ ] Prompt明确锁定服装（如"穿警服的"）
- [ ] Prompt描述标志性配饰（警帽、警徽等）
- [ ] 引用格式为"图片N"而非"@imageN"
- [ ] 台词纯文本，无竖杠 `|`
- [ ] 无敏感词（痛苦、受伤、血汗、死亡等）
- [ ] 上传3-5张多角度定妆照
- [ ] 图片文件有效（base64数据完整）
- [ ] Prompt长度不超过1500字符

---

## 六、历史教训与最佳实践

### 6.1 时间线

| 时间 | 事件 | 教训 |
|------|------|------|
| 6月14日 | 视频无声 | 未传 `generate_audio` |
| 6月20日 | 角色未穿警服 | Prompt未锁定服装 |
| 6月20日 | API报错`role` | 未指定`role: "reference_image"` |
| 6月20日 | 输出敏感检测 | Prompt含"痛苦"等词 |
| 6月20日 | 配饰丢失 | 未描述警徽肩章 |
| 6月20日 | 引用失效 | 使用`@image1`而非`图片1` |

### 6.2 最佳实践

1. **多层防护**：PromptGuardian（自动修复）+ PipelineGuard（强制阻塞）+ 人工检查
2. **日志记录**：所有自动修复记录到文件，可追溯
3. **失败阻断**：任何检查不通过，立即停止提交，不浪费渲染资源
4. **经验代码化**：所有经验转化为代码规则，不靠人记住
5. **持续迭代**：每次遇到问题，更新规则库，让系统更智能

---

## 七、附录：文件清单

| 文件 | 作用 | 版本 |
|------|------|------|
| `scripts/prompt-guardian.js` | Prompt自动修复 | v2.1.1 |
| `scripts/render-pipeline-guard.js` | 强制检查阻塞 | v1.0 |
| `scripts/render-submitter-core.js` | 统一提交核心 | v2.1.1 |
| `docs/seedance-reference-image-best-practice.md` | 最佳实践文档 | v2.1.1 |
| `CHANGELOG.md` | 版本变更记录 | v2.1.1 |

---

> **我们获得了别人的帮助，我们也要深刻帮助到别人。**
> 
> 这份报告可以分享给任何使用 Seedance 2.0 API 的开发者，帮助他们的角色一致性渲染100%生效。
