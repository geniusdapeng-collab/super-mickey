# LLM强制驱动机制设计文档 v1.0
## 背景
当前系统只有STAGE-5A/B（剧本/视觉）由LLM驱动，其余关键环节（PRD、对齐、时长、故事板、运镜、渲染）均为本地规则。这导致画面质量上限被锁定在规则水平，无法生成丰富的构图、光影、运镜设计。

## 设计原则
1. **LLM优先**：所有核心环节必须先走LLM
2. **关键链路无兜底**：STAGE-5/6/7/9/11等关键链路，LLM失败不重试到规则兜底，而是重试LLM直到成功或明确失败
3. **失败即报告**：LLM走不通时，报告失败原因，不静默降级
4. **质量>速度**：不为了省token或提速而跳过LLM

## 机制架构

### 1. Stage级LLM强制标记
```javascript
const LLM_REQUIRED_STAGES = [
  'STAGE-1',   // PRD生成：LLM分析需求，生成完整PRD
  'STAGE-2',   // 对齐检查：LLM检查需求完整性、冲突
  'STAGE-5A',  // 剧本：已有LLM
  'STAGE-5B',  // 视觉：已有LLM
  'STAGE-6',   // 时长分配：LLM根据内容复杂度智能分配
  'STAGE-7',   // 故事板：LLM生成视觉化故事板
  'STAGE-9',   // 运镜：LLM设计运镜方案
  'STAGE-11',  // 渲染：LLM优化最终Prompt
];
```

### 2. LLM调用包装器（带重试）
```javascript
async function enforceLLM(stageId, promptFn, fallbackFn) {
  const isRequired = LLM_REQUIRED_STAGES.includes(stageId);
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callLLM(promptFn());
      log(stageId, `✅ LLM调用成功 | attempt=${attempt}`);
      return { result, driver: 'llm', attempts: attempt };
    } catch (err) {
      log(stageId, `⚠️ LLM失败 | attempt=${attempt}: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(EXPONENTIAL_BACKOFF[attempt]);
    }
  }
  
  if (isRequired) {
    throw new Error(`${stageId} LLM调用失败(${MAX_RETRIES}次重试)，关键链路不允许降级。错误：${err.message}`);
  }
  
  // 非关键链路才允许降级
  log(stageId, `⚠️ 降级到规则执行`);
  return { result: await fallbackFn(), driver: 'rule', attempts: MAX_RETRIES };
}
```

### 3. 各Stage LLM Prompt设计

#### STAGE-1: LLM-PRD生成
Prompt: 分析用户输入（projectName, scenes, characters, duration, style），生成完整PRD文档，包含：
- meta（标题、版本、模式）
- core（核心主题、目标受众）
- world（世界观、场景设定、氛围）
- characters（角色详细档案）
- scenes（场景列表与顺序）
- style（视觉风格、色调、参考）
- constraints（限制条件）

#### STAGE-2: LLM-需求对齐
Prompt: 检查PRD完整性，识别：
- 缺失的关键字段
- 逻辑冲突（如时长与场景数不匹配）
- 角色与场景关联性
- 风格一致性

#### STAGE-6: LLM-时长分配
Prompt: 根据场景内容复杂度、台词字数、视觉复杂度，智能分配每个场景的时长。
输入：场景列表（含台词、类型、重要性）
输出：每个场景的分配时长（秒）

#### STAGE-7: LLM-故事板生成
Prompt: 根据PRD和场景，生成视觉化故事板：
- 每个场景的构图描述
- 镜头角度、景别
- 角色位置、动作
- 背景元素、光影方向
- 转场方式

#### STAGE-9: LLM-运镜设计
Prompt: 根据场景内容和故事板，设计运镜方案：
- 镜头运动（推、拉、摇、移、跟、升、降）
- 镜头速度（缓、急、匀速）
- 镜头意图（强调、揭示、过渡）
- 与角色动作的配合

#### STAGE-11: LLM-渲染Prompt优化
Prompt: 整合所有上游输出（视觉Prompt、运镜、故事板、角色、音频），生成最终渲染Prompt：
- 确保1500字符充分利用
- 保留关键信息（视觉、运镜、角色、时间轴）
- 智能裁剪低优先级字段
- 注入定妆照引用

## 实施计划
1. 创建 `llm-enforcement-layer.js`（机制层）
2. 改造 `nirath-master-pipeline.js`：
   - STAGE-1: 接入LLM-PRD
   - STAGE-2: 接入LLM-对齐
   - STAGE-6: 接入LLM-时长
   - STAGE-7: 接入LLM-故事板
   - STAGE-9: 接入LLM-运镜
   - STAGE-11: 接入LLM-渲染优化
3. 人物动作：在STAGE-5B/11中增加动态动作指令
4. 测试运行

## 关键约束
- 每次LLM调用必须记录：调用时长、token消耗、成功/失败
- 失败必须精确报告：Stage X 失败，错误：Y，需要：Z
- 禁止静默降级到规则（关键链路）
