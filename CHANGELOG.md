# CHANGELOG — 超现实系统

## v2.1.1 — 2026-06-20（最新）

### 新增（基于行业专业人士经验包）
- **外观特征锚定系统**
  - 自动添加详细服装配饰描述（警帽、警徽、肩章等）
  - 防止场景描述覆盖服装
- **引用格式自动修正**
  - @image1 → 图片1（符合官方规范）
- **提示词结构优化**
  - 主体→动作→场景→风格的自动排序建议

### 自动化约束（PromptGuardian v2）
1. **服装锁定**：自动检测角色服装缺失，添加"穿警服的"
2. **外观锚定**：自动添加"佩戴警帽、警徽、肩章"等细节
3. **引用格式**：自动修正 @imageN → 图片N
4. **台词净化**：自动移除竖杠 |
5. **敏感词过滤**：自动替换痛苦→不适等

---

## v2.1.0 — 2026-06-20

### 新增
- **PromptGuardian 自动化防护系统**（prompt-guardian.js）
  - 自动修复Prompt：服装锁定、台词净化、敏感词过滤
  - 不是报错，而是自动修复 + 日志记录
  - 集成到 render-submitter-core.js，提交前自动调用

### 修复（v2.0.9延续）
- Seedance reference_image 角色绑定失效
- 添加 `role: "reference_image"` 到 image_url 内容
- 添加 `generate_audio: true` 确保台词音频渲染
- 修复 MIME 类型检测（文件头替代扩展名）

### 文档
- 新增：`docs/seedance-reference-image-best-practice.md`
- 新增：`scripts/prompt-guardian.js`

---

## v2.0.8 — 2026-06-18

### 修复
- CreativeIntensity 解析（metadata.creativeIntensity 优先）
- 导演技能注入时机（ProductionEngine 后调用 routeAndEnhance）
- 中文字段名、时间轴、dialogueStr 等5大问题
