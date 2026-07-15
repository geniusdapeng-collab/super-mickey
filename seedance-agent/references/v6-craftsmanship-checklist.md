# Seedance v6.0 匠人手艺层优化清单
# 来源: 业务视角精细化提升建议书（v7.0-Peng-Director 吸收后剩余）
# 定位: 这些建议应由各 v6.0 模块内部实现，不由 v7.0 Agent Loop 替代
# 生成时间: 2026-05-15

---

## 清单说明

以下建议来自业务视角报告，**有道理但属于模块内部"匠人手艺"**。
v7.0 Agent Loop（导演）不该替代这些专业判断，应该由各 v6.0 模块（crew）自行升级。

---

## 1. 剧本开发层（Story Engine / StoryForge Pro）

### 1.1 潜台词层（Subtext Layer）
- **当前问题**: Scene Writer 只有表层叙事，无潜台词
- **建议**: 对白输出升级为双层结构（表层+潜台词）
- **潜台词用途**: 指导 MicroMotion 微表情、Dialogue Engine 语调
- **实施模块**: `voice-craft` / `storyforge-pro`
- **优先级**: 高

### 1.2 角色弧线追踪（Character Arc）
- **当前问题**: 角色信息静态，无内心状态变化记录
- **建议**: story-plan.json 增加 `innerStateDelta` 字段
- **用途**: 场景连贯性检查 + 表演一致性校验
- **实施模块**: `seedance-story-engine`
- **优先级**: 高

### 1.3 剧本冻结（Script Lock）
- **当前问题**: 渲染阶段剧本仍可能被修改，导致额度浪费
- **建议**: 增设 `story-plan-locked.json`，标记版本号和时间戳
- **变更流程**: 任何修改需创建 revision，导演确认后替换
- **实施模块**: `seedance-director` + `seedance-story-engine`
- **优先级**: 中

---

## 2. 视觉预演层（Shot Design / Storyboard / Persona Vault）

### 2.1 镜头叙事功能标注（Narrative Function）
- **当前问题**: 六要素公式只有描述性语法，无叙事功能
- **建议**: 增加第七维度 `narrativeFunction`: EXPO/EMOT/TENS/RELE
- **用途**: 指导摄影手法选择、剪辑决策
- **实施模块**: `seedance-shot-design`
- **优先级**: 高

### 2.2 轴线规则与视线匹配（Axis & Eyeline）
- **当前问题**: 完全无 180 度轴线意识
- **建议**: 
  - 越轴检测（Axis Violation Detection）
  - 视线方向字段 `eyelineDirection`
  - 相邻对话场景自动校验视线镜像对称
- **实施模块**: `seedance-shot-design`
- **优先级**: 高

### 2.3 剪辑预演思维（Action/Eyeline/Composition Match）
- **当前问题**: 逐镜头独立生成，无跨镜头连贯性
- **建议**: 生成提示词阶段读取前后镜头数据，校验连贯性
- **实施模块**: `seedance-shot-design` + `seedance-post-production`
- **优先级**: 中

### 2.4 角色-场景适配检测
- **当前问题**: 角色造型与场景色调/时代不匹配
- **建议**: 三个维度校验（时代一致性、色调协调性、饱和度匹配）
- **实施模块**: `seedance-character-manager` + `seedance-shot-design`
- **优先级**: 低

---

## 3. 拍摄执行层（Render Engine / Choreography / MicroMotion）

### 3.1 叙事优先级动态调度（替代四批次固定排序）
- **当前问题**: 按技术优先级渲染，非叙事优先级
- **建议**: 分析每个镜头的"创意验证价值"动态重排
- **输出**: "叙事优先级报告"供导演确认
- **实施模块**: `seedance-render-engine`
- **优先级**: 中

### 3.2 拍摄方案书（机位/灯位/运动轨迹）
- **当前问题**: 提交 API 前无方案确认
- **建议**: 自动生成拍摄方案书（机位拓扑图+灯位方案+运动轨迹）
- **用途**: 内部预检清单，确保分镜意图完整转译
- **实施模块**: `seedance-render-engine`
- **优先级**: 低

### 3.3 动作叙事（Action Narrative）
- **当前问题**: 动作被编排但无叙事目的
- **建议**: 每个切片增加"戏剧目的"字段（Establishing/Escalation/Reversal/Foreshadowing）
- **实施模块**: `seedance-choreography`
- **优先级**: 中

### 3.4 动作风格完整语法包
- **当前问题**: 成龙风格只有5个关键词，不理解完整语法
- **建议**: 升级为完整动作语法包（道具逻辑+失误补救节奏+摄影机协同）
- **实施模块**: `seedance-choreography`
- **优先级**: 低

### 3.5 情绪-动作联动
- **当前问题**: 同一动作在不同情绪下无区分
- **建议**: 引入"情绪-动作映射层"（愤怒幅度大/恐惧收缩/冷静精准）
- **实施模块**: `seedance-choreography` + `seedance-micromotion`
- **优先级**: 中

### 3.6 斯坦尼斯拉夫斯基表演体系（三层次）
- **当前问题**: MicroMotion 五路增强只做第三层（身体反应）
- **建议**: 重构为三层（任务层→情绪记忆层→身体反应层）
- **实施模块**: `seedance-micromotion`
- **优先级**: 高

### 3.7 眼神控制升级（聚焦/眼睑/深度）
- **当前问题**: Eye Director 只有方向和类型
- **建议**: 增加三个维度（聚焦状态、眼睑张力、目光深度）
- **实施模块**: `seedance-micromotion`
- **优先级**: 中

### 3.8 呼吸转折点标记
- **当前问题**: Breath Engine 只有生理模拟
- **建议**: 增加呼吸转折点（情绪变化过渡）和戏剧张力编排
- **实施模块**: `seedance-micromotion`
- **优先级**: 低

### 3.9 五路融合一致性检查
- **当前问题**: Merge Agent 只校验格式，不校验表演逻辑
- **建议**: 增加"表演一致性检查"（面部/身体/眼神/呼吸情绪方向自洽）
- **实施模块**: `seedance-micromotion`
- **优先级**: 中

---

## 4. 声音设计层（Sound Design / Voice Craft）

### 4.1 声学环境建模（RT60/反射/衰减）
- **当前问题**: 只有环境音素材切换，无物理声学参数
- **建议**: 为每种场景类型预设声学参数包
- **效果**: 同一句话在洞穴像神谕、在森林像恳求
- **实施模块**: `seedance-sound-design`
- **优先级**: 中

### 4.2 主观声音设计（Subjective Sound）
- **当前问题**: 完全是客观视角声音
- **建议**: POV镜头触发主观听觉预设（心跳脉冲+耳鸣+夸张威胁音）
- **实施模块**: `seedance-sound-design`
- **优先级**: 中

### 4.3 戏剧性静默（Dead Silence）
- **当前问题**: EMOTION_ACOUSTICS_MAP 缺少"死寂"状态
- **建议**: 主动拉低全轨至-60dB，0.5-2秒后缓慢恢复
- **实施模块**: `seedance-sound-design`
- **优先级**: 低

### 4.4 配音导演层（Delivery Layer）
- **当前问题**: 只有"说什么+用什么声音"，无"怎么说"
- **建议**: 增加语速曲线、音量包络、重音位置、气息特征
- **实施模块**: `voice-craft`
- **优先级**: 高

### 4.5 群戏声音焦点管理
- **当前问题**: 多人对话无声音焦点
- **建议**: 画内清晰(-3dB)、画外模糊(-12dB)、关键台词时其他衰减
- **实施模块**: `seedance-sound-design`
- **优先级**: 低

### 4.6 音乐情绪语汇重组
- **当前问题**: MUSIC_STYLES 按场景类型而非情感类型
- **建议**: 按紧张/悲伤/崇高/诡异梯度重组，叠加节奏基底
- **实施模块**: `seedance-sound-design`
- **优先级**: 中

### 4.7 音乐对位法（Counterpoint）
- **当前问题**: 只有同向匹配
- **建议**: 增加反向对位选项（画面平静→音乐不安）
- **实施模块**: `seedance-sound-design`
- **优先级**: 低

### 4.8 主题音乐（Leitmotif）
- **当前问题**: 每次配乐独立选择，无主题关联
- **建议**: 为核心角色生成4-8小节音乐主题，后续变奏重现
- **实施模块**: `seedance-sound-design`
- **优先级**: 低

---

## 5. 后期制作层（Post-Production）

### 5.1 剪辑节奏设计（镜头时长随张力变化）
- **当前问题**: 所有镜头时长固定，剪辑阶段不做 trim
- **建议**: 镜头时长 = f(张力值, 情绪类型, 景别)
- **前提**: 渲染时预留 30-50% 素材冗余度
- **实施模块**: `seedance-post-production`
- **优先级**: 高

### 5.2 匹配剪辑（Match Cut）
- **当前问题**: 转场只基于情绪差值，不考虑画面内容
- **建议**: 识别形状相似性、运动方向一致性、色彩呼应
- **实施模块**: `seedance-post-production`
- **优先级**: 低

### 5.3 J-Cut / L-Cut 自动应用
- **当前问题**: 音画严格同步切
- **建议**: 声音先入(J-Cut) / 画面先出(L-Cut)
- **前提**: 声音设计层需输出独立音轨而非单一混音
- **实施模块**: `seedance-post-production` + `seedance-sound-design`
- **优先级**: 中

### 5.4 场景级情绪调色
- **当前问题**: 统一 LUT 导致全片情绪同质
- **建议**: 每个 scene 独立判断调色方案
- **实施模块**: `seedance-post-production`
- **优先级**: 高

### 5.5 色彩叙事（Color Arc）
- **当前问题**: 无角色色彩轨迹
- **建议**: 角色设计层增加 `colorArc`，调色引擎叠加
- **实施模块**: `seedance-post-production` + `seedance-character-manager`
- **优先级**: 中

### 5.6 关键帧色彩标记
- **当前问题**: 一套规则应用到全部画面
- **建议**: 导演层在分镜阶段打 color-key 标记
- **实施模块**: `seedance-post-production`
- **优先级**: 低

### 5.7 图形叙事层（片头片尾升级）
- **当前问题**: 3秒黑底白字片头 + 5秒黑底白字片尾
- **建议**: 片头设计与影片风格统一，片尾与正片视觉衔接
- **实施模块**: `seedance-post-production`
- **优先级**: 低

---

## 6. 质量管控层（Pitch Evaluation / Compliance Agent）

### 6.1 戏剧感染力维度
- **当前问题**: 四维评测缺少"感染力"
- **建议**: 增加第五维度（hook强度+情感曲线+记忆点密度）
- **实施模块**: `pitch-evaluation`
- **优先级**: 高

### 6.2 虚拟试映（Virtual Screening）
- **当前问题**: 事后打分，无事前预警
- **建议**: 模拟预测注意力曲线和情感反应
- **实施模块**: `pitch-evaluation`（新建子模块）
- **优先级**: 低

### 6.3 风格保护模式（合规代理）
- **当前问题**: 精炼策略过度压缩诗意描述
- **建议**: 检测修辞密度，高则保守精炼
- **实施模块**: `byted-ark-seedance-skill`（Compliance Agent）
- **优先级**: 中

### 6.4 技术合规分 vs 艺术潜力分分离
- **当前问题**: 一个分数覆盖两个维度
- **建议**: 独立输出两个分数，优先选艺术潜力分高的
- **实施模块**: `pitch-evaluation`
- **优先级**: 中

---

## 7. 交付层（Delivery Engine）

### 7.1 首映体验（非文件传输）
- **当前问题**: 输出文件包，无创作说明
- **建议**: 附带创作手记（意图+参数+参考）
- **实施模块**: `seedance-delivery-engine`
- **优先级**: 中

### 7.2 版本管理（导演剪辑版/公映版）
- **当前问题**: 每次调整覆盖旧成片
- **建议**: 语义化版本号 + 双版本并行（导演剪辑版/平台适配版）
- **实施模块**: `seedance-delivery-engine`
- **优先级**: 低

---

## 优先级总览

### 🔴 高优先级（立即实施）
1. 潜台词层（voice-craft）
2. 角色弧线追踪（story-engine）
3. 镜头叙事功能标注（shot-design）
4. 轴线规则与视线匹配（shot-design）
5. 斯坦尼斯拉夫斯基表演体系（micromotion）
6. 配音导演层（voice-craft）
7. 剪辑节奏设计（post-production）
8. 场景级情绪调色（post-production）
9. 戏剧感染力维度（pitch-evaluation）

### 🟡 中优先级（短期实施）
10. 剧本冻结（director+story-engine）
11. 剪辑预演思维（shot-design+post-production）
12. 情绪-动作联动（choreography+micromotion）
13. 五路融合一致性（micromotion）
14. 声学环境建模（sound-design）
15. 主观声音设计（sound-design）
16. 音乐情绪语汇重组（sound-design）
17. J-Cut/L-Cut（post-production+sound-design）
18. 色彩叙事（post-production+character-manager）
19. 风格保护模式（compliance）
20. 技术/艺术分数分离（pitch-evaluation）
21. 首映体验（delivery-engine）

### 🟢 低优先级（中长期）
22. 角色-场景适配检测
23. 拍摄方案书
24. 动作叙事
25. 动作风格完整语法包
26. 眼神控制升级
27. 呼吸转折点
28. 群戏声音焦点
29. 音乐对位法
30. 主题音乐（Leitmotif）
31. 匹配剪辑（Match Cut）
32. 关键帧色彩标记
33. 图形叙事层
34. 虚拟试映
35. 版本管理

---

## 总结

**35项匠人手艺优化**，v7.0 Agent Loop **不碰任何一项**。

v7.0 只负责：
- ✅ 导演阐释（创作意图分析）
- ✅ 张力曲线驱动决策
- ✅ 三级质量决策（绿灯/黄灯/红灯）
- ✅ A/B 拍摄策略选择
- ✅ 日拍夜看简报生成
- ✅ 飞书通知协调

v6.0 各模块负责：
- 🔧 剧本、分镜、摄影、表演、声音、剪辑、调色、交付的专业手艺

**分工明确：导演做决策，crew 做手艺。**
