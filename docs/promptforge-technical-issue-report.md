# PromptForge技术问题报告 - 寻求专家咨询

**提交人**: 小G (OpenClaw AI助手)
**提交时间**: 2026-06-04 20:15 GMT+8
**项目**: 山海经：异兽志 - Nirath星球视频生成系统
**版本**: v6.2-patch105
**咨询对象**: 技术专家（LLM/Node.js/系统架构）

---

## 一、期望结果 (Expected Outcome)

### 1.1 核心目标
打造一个**自动化PromptForge系统**，能够：
- 基于已有的镜头描述（500-600字符），通过LLM（Kimi-k2p6）进行导演级优化
- **输出精简的、可直接用于AI视频渲染的Prompt**
- 每个Prompt控制在**990字符以内**（约495中文汉字）
- 保持视觉冲击力（目标90分），包含视觉主体、场景环境、光影效果、运镜方案、情绪氛围
- 强化Nirath异世界特征（双恒星、荧光生态、低重力）
- 保持角色一致性（xiaoG、taotie）

### 1.2 具体产出格式
```
Cinematic shot, xiaoG explores Lumina-velum in Nirath alien world, twin suns casting amber-cyan dual shadows across floating bioluminescent flora, low gravity causing drifting spore particles, standard narrative dolly-in camera pushing forward, shallow depth of field, volumetric fog, epic mysterious atmosphere, 8K, film grain, anamorphic lens flare.
```

### 1.3 批量处理要求
- 一次处理6个镜头（S00-S05）
- 每个镜头独立处理，避免内存累积
- 总耗时控制在合理范围（10-15分钟）

---

## 二、实际遇到的问题 (Actual Problems)

### 2.1 问题1：LLM输出包含大量思考过程
**现象**：LLM不直接输出最终Prompt，而是输出完整的思考链：
```
用户要求我作为电影导演优化专家...

当前描述的问题：
1. 过于平淡，缺乏视觉细节
2. "标准叙事镜头"没有视觉冲击力

优化方向应该包括：
1. 镜头运动/角度（如低角度仰拍...）

让我构思3条：
1. 低角度仰拍主角剪影...

建议1：低角度仰拍主角剪影...
建议2：广角镜头特写面部微表情...
建议3：设计轨道环绕长镜头...

让我再检查一下字数...

最终版本：
Cinematic shot, xiaoG explores...
```

**影响**：
- 自动化提取逻辑无法区分思考过程和最终Prompt
- 截取的990字符可能包含思考过程而非最终Prompt
- 部分镜头提取后只有100+字符，严重不足

### 2.2 问题2：内存累积导致OOM
**现象**：连续处理多个镜头时，Node.js进程内存持续增长，最终触发OOM Killer

**进程终止记录**：
- 第1次：15分钟SIGTERM（timeout=900秒）
- 第2次：15分钟SIGTERM（timeout=900秒）
- 第3次：30分钟OOM Killer（timeout=1800秒，anon-rss:5127176kB ≈ 5.1GB）
- 第4次（单进程单镜头）：处理4个镜头成功，第5个镜头OOM

**系统日志**：
```
Out of memory: Killed process 965897 (MainThread)
anon-rss:5127176kB
```

### 2.3 问题3：Prompt长度控制不准确
**现象**：即使明确要求"990字符以内"，LLM仍可能输出：
- 3000+字符（包含思考过程）
- 或100+字符（严重不足）
- 或截断在中间（如"anamorphic partic"）

**字符数统计**：
| 镜头 | 第1轮 | 第2轮 | 第3轮 | 目标 |
|------|------|------|------|------|
| S00 | 990(截断) | 990(截断) | 815 | 990 |
| S01 | 990(截断) | 990(截断) | 990(截断) | 990 |
| S02 | 990(截断) | 990(截断) | 141❌ | 990 |
| S03 | 990(截断) | 990(截断) | 494 | 990 |
| S04 | 990(截断) | 990(截断) | 709 | 990 |
| S05 | 990(截断) | 990(截断) | 599 | 990 |

### 2.4 问题4：LLM调用方式限制
**现象**：
- LLMGateway（core/llm-gateway.js）返回HTTP 403："Kimi For Coding is currently only available for Coding Agents"
- LLMEngine（systems/llm-reasoning-engine.js）可调用，但输出包含reasoning_content
- 无法直接使用OpenAI格式API（JSON mode、function calling等）

---

## 三、限制条件 (Constraints)

### 3.1 系统资源限制
- **内存上限**：~5.1GB触发OOM Killer（anon-rss:5127176kB）
- **CPU**：无明确限制，但Node.js单进程
- **exec timeout**：可设置到1800秒（30分钟），但内存是硬限制

### 3.2 LLM API限制
- **模型**：Kimi-k2p6（通过KimiProviderAdapter）
- **端点**：https://agent-gw.kimi.com/coding/v1/chat/completions
- **maxTokens**：可设置（测试过800、1500、2000）
- **temperature**：0.7
- **不支持**：JSON mode、function calling、structured output
- **返回格式**：包含reasoning_content（思维链）+ content（最终输出）

### 3.3 Seedance API限制
- **Prompt长度**：990字符（或495中文汉字）
- **语言**：英文为主（中文支持有限）
- **内容要求**：NO Chinese traditional symbols, NO anime/cartoon, NO ink wash painting

### 3.4 架构限制
- **单进程**：Node.js单进程，内存共享
- **无持久化内存**：每次session重启，内存清零
- **文件系统**：可读写文件，但磁盘空间有限

---

## 四、当前问题代码 (Problematic Code)

### 4.1 LLM调用核心代码（promptforge-render.js）
```javascript
const { LLMEngine } = require('../systems/llm-reasoning-engine');

const engine = new LLMEngine({ model: 'kimi-k2p6' });

const result = await engine.reason(optimizationPrompt, {
  maxTokens: 1500, // 或800、2000
  temperature: 0.7
});

let optimizedPrompt = result.content.trim();

// 问题：result.content经常为空，实际内容在reasoning_content中
// LLMEngine内部处理：从reasoning_content提取JSON，失败则使用完整思维链回退
```

### 4.2 提取逻辑（问题所在）
```javascript
// 从LLM输出中提取Prompt（去除思考过程）
const markers = [
  '让我构思Prompt',
  '让我构思',
  '最终版本',
  'Prompt:',
  '输出Prompt',
  '精简Prompt',
  'Cinematic shot,',
  'IMAX',
  '电影级镜头',
  'Epic shot,',
  'Wide shot,'
];

let promptStart = -1;
for (const marker of markers) {
  const idx = optimizedPrompt.indexOf(marker);
  if (idx !== -1) {
    promptStart = idx;
    break;
  }
}

if (promptStart !== -1) {
  optimizedPrompt = optimizedPrompt.substring(promptStart).trim();
}

// 问题：无法可靠区分思考过程和最终Prompt
// 问题：无法准确提取"最终版本"后的内容
// 问题：无法处理多段式思考（先分析后总结）
```

### 4.3 内存控制代码（部分有效）
```javascript
// 单进程单镜头模式
async function processSingleShot(shotFile) {
  // 处理单个镜头...
  
  // 强制垃圾回收
  if (global.gc) {
    global.gc();
  }
  
  // 处理间隔
  await new Promise(r => setTimeout(r, 3000));
}

// 问题：即使单进程+GC，连续处理5个镜头后仍可能OOM
// 问题：LLMEngine实例化后内存不释放
// 问题：reasoning_content（5000+字符）累积在内存中
```

### 4.4 完整脚本（promptforge-render.js）
文件路径：`/root/.openclaw/workspace/scripts/promptforge-render.js`

```javascript
const fs = require('fs');
const path = require('path');
const { LLMEngine } = require('../systems/llm-reasoning-engine');

async function optimizeForRender(shotFile) {
  const promptContent = fs.readFileSync(shotFile, 'utf8');
  
  const sceneMatch = promptContent.match(/\*\*场景\*\*: (.+)/);
  const typeMatch = promptContent.match(/\*\*类型\*\*: (.+)/);
  
  const scene = sceneMatch ? sceneMatch[1] : 'unknown';
  const type = typeMatch ? typeMatch[1] : 'unknown';
  
  const visualMatch = promptContent.match(/【视觉】(.+?)(?=【|$)/s);
  const visualDesc = visualMatch ? visualMatch[1].substring(0, 400) : '';
  
  const optimizationPrompt = `你是一位电影导演优化专家...

严格要求：
1. 只输出Prompt文本本身...
2. 不要输出"让我构思"...
...

当前描述：
场景: ${scene}
类型: ${type}
${visualDesc}

错误示例（不要这样输出）：
"让我构思一个Prompt...最终版本：Cinematic shot..."

正确示例（必须这样输出）：
Cinematic shot, xiaoG stands in Nirath alien world...

现在直接输出Prompt：`;

  const engine = new LLMEngine({ model: 'kimi-k2p6' });
  
  const result = await engine.reason(optimizationPrompt, {
    maxTokens: 1500,
    temperature: 0.7
  });
  
  let optimizedPrompt = result.content.trim();
  
  // 提取逻辑...（见4.2）
  
  // 追加到文件
  const section = `\n\n---\n\n**【精简渲染Prompt】**\n\n\`\`\`\n${optimizedPrompt}\n\`\`\`\n`;
  fs.appendFileSync(shotFile, section);
}
```

### 4.5 LLMEngine核心代码（systems/llm-reasoning-engine.js）
```javascript
class LLMEngine {
  async reason(prompt, options = {}) {
    // 调用Kimi API
    const response = await callKimiAPI(prompt, options);
    
    // 问题：content经常为空
    if (!response.content) {
      // 从reasoning_content提取JSON
      const json = extractJSONFromReasoning(response.reasoning_content);
      if (json) {
        return json;
      }
      // 失败则使用完整思维链回退
      return { content: response.reasoning_content, tokenCount: response.tokens };
    }
    
    return { content: response.content, tokenCount: response.tokens };
  }
}

// 问题：无法区分reasoning_content中的思考过程和最终结论
// 问题：无法强制LLM只输出结构化JSON
```

---

## 五、已尝试的解决方案 (Attempted Solutions)

### 5.1 方案1：限制输入/输出规模（失败）
- 输入截断到150字符，输出限制600 tokens
- 结果：产出3条30字建议，质量严重不足，被项目负责人否定

### 5.2 方案2：单进程单镜头+强制GC（部分成功）
- 每个镜头独立Node进程，处理完立即退出
- 强制global.gc()，3秒间隔
- 结果：6个镜头全部成功，但产出仍包含思考过程
- 问题：无法解决LLM输出格式问题

### 5.3 方案3：边界测试（成功）
- 测试单镜头最大处理能力：600字符输入 + 2000 tokens输出
- 确认系统内存上限：连续4-5镜头后触发OOM
- 结论：单次LLM调用能力充足，瓶颈在多镜头累积和输出格式

### 5.4 方案4：手工整理（成功但非自动化）
- 基于LLM完整分析（3000+字符），人工提取精华
- 生成6个精简Prompt（平均317字符，全部符合990限制）
- 问题：不是自动化，无法批量处理
- 问题：每次需要人工介入，效率低

---

## 六、需要咨询的问题 (Questions for Expert)

### 6.1 LLM输出控制
1. **如何强制LLM只输出最终Prompt，不包含思考过程？**
   - 当前Prompt指令已非常严格（"不要输出分析、不要输出思考过程、不要输出让我构思"）
   - 但LLM仍然输出完整思考链
   - 是否有更好的Prompt工程技巧？

2. **是否有办法使用JSON mode或structured output？**
   - 当前API端点（Kimi coding）不支持JSON mode
   - 是否有其他端点或方式可以获取结构化输出？

3. **如何准确控制输出长度（990字符以内）？**
   - maxTokens控制的是token数，不是字符数
   - 1 token ≈ 1-2中文字符或1个英文单词
   - 无法精确控制字符数

### 6.2 Node.js内存管理
4. **如何彻底释放LLMEngine实例的内存？**
   - 每次new LLMEngine()后，即使global.gc()，内存仍增长
   - 是否有方法强制释放所有引用？

5. **是否应该使用子进程（child_process）处理每个镜头？**
   - 当前方案：单进程顺序处理，强制GC
   - 是否应该：父进程管理队列，子进程处理每个镜头，处理完自动退出？

6. **如何处理reasoning_content（5000+字符）的内存占用？**
   - 每次LLM调用返回5000+字符的reasoning_content
   - 即使提取了最终Prompt，reasoning_content仍在内存中

### 6.3 系统架构
7. **是否应该将PromptForge拆分为多个阶段？**
   - 阶段1：LLM导演分析（输出3000+字符分析）
   - 阶段2：基于分析，LLM生成精简Prompt（输出990字符）
   - 或：阶段2使用规则引擎/模板，而非LLM

8. **是否有更好的批量处理架构？**
   - 当前：单进程顺序处理
   - 备选：进程池、队列系统、消息队列等

### 6.4 API调用
9. **是否有其他可用的LLM API？**
   - 当前使用Kimi-k2p6（通过KimiProviderAdapter）
   - 是否有其他支持JSON mode、function calling的API？
   - 是否可以调用OpenAI格式API（如GPT-4）？

10. **是否可以微调模型或训练专用模型？**
    - 训练一个专门用于Prompt精简的模型
    - 输入：完整导演分析（3000字符）
    - 输出：精简Prompt（990字符）

---

## 七、附件 (Attachments)

### 7.1 相关文件
1. `scripts/promptforge-lite.js` - 轻量级PromptForge（完整输入/2000 tokens输出）
2. `scripts/promptforge-render.js` - 精简Prompt生成脚本（问题代码）
3. `scripts/fix-render-prompts.js` - 从LLM输出中提取Prompt（修复尝试）
4. `scripts/boundary-test.js` - 系统LLM能力边界测试
5. `scripts/process-remaining-shots.js` - 单镜头独立进程处理
6. `output/prompts/render-prompts-final.md` - 手工整理的6个精简Prompt（成功案例）
7. `systems/llm-reasoning-engine.js` - LLMEngine核心代码

### 7.2 日志文件
1. `memory/2026-06-04.md` - 完整的预生产运行日志和调试记录
2. `preproduction-run-9.log` 到 `preproduction-run-13.log` - 各次运行日志

### 7.3 示例数据
**输入示例**（S01 星渊初临）：
```
xiaoG在Nirath异世界场景中，场景: Lumina-velum，标准叙事镜头, 推进剧情发展。
Nirath异世界场景，双恒星光照，5800K暖金色的Aurelius恒星与6500K银白色的Silvana双星高挂天际，双色光晕在天空中交织成金橙与冷白的渐变光带，低重力0.82G环境中，细小尘埃与孢子微粒轻盈漂浮在空中。
```

**期望输出示例**（S01 精简Prompt）：
```
Cinematic shot, xiaoG explores Lumina-velum in Nirath alien world, twin suns casting amber-cyan dual shadows across floating bioluminescent flora, low gravity causing drifting spore particles and slow-motion fabric movement, vast starry abyss background, fluorescent ecosystem glowing in violet and teal, standard narrative dolly-in camera pushing forward, shallow depth of field, volumetric fog, epic mysterious atmosphere, awe-inspiring discovery mood, 8k, film grain, anamorphic lens flare.
```

**LLM实际输出示例**（思考过程+最终Prompt）：
```
用户要求我作为电影导演优化专家...

当前描述的问题：
1. 过于平淡，缺乏视觉细节
2. "标准叙事镜头"没有视觉冲击力

让我构思3条：
1. 低角度仰拍主角剪影...

建议1：低角度仰拍主角剪影...
建议2：广角镜头特写面部微表情...
建议3：设计轨道环绕长镜头...

让我再检查一下字数...

最终版本：
Cinematic shot, xiaoG explores Lumina-velum in Nirath alien world...

字数：约290字。完美。

检查是否包含所有要求：
1. 增强的视觉细节 ✓
2. 光影设计优化 ✓
...
```

---

## 八、紧急程度 (Priority)

**P0 - 阻塞生产**
- 当前无法自动化生成符合990字符限制的精简Prompt
- 需要人工介入，效率低，无法批量处理
- 阻塞下一阶段（提交渲染）

---

## 九、联系信息 (Contact)

**提交人**: 小G (OpenClaw AI助手)
**项目**: 山海经：异兽志 - Nirath星球视频生成系统
**队长**: 项目负责人（千问AI产品经理）
**技术栈**: Node.js + LLM (Kimi-k2p6) + Seedance API

---

*本报告由系统自动生成，包含完整的技术细节和代码示例*
*时间: 2026-06-04 20:15 GMT+8*
