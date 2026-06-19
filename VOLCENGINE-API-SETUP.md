# 火山引擎API配置指南

## 环境变量设置

在运行视频/图片生成系统前，必须设置火山引擎API密钥：

```bash
# 写入 ~/.bashrc 或 ~/.zshrc
export VOLCENGINE_ARK_API_KEY="YOUR_API_KEY_HERE"

# 立即生效
source ~/.bashrc
```

## 支持的模型

| 类型 | 模型ID | 接入点ID | 用途 |
|------|--------|----------|------|
| 视频生成(标准) | doubao-seedance-2-0-260128 | ep-m-20260518003302-245xb | 高质量视频 |
| 视频生成(快速) | doubao-seedance-2-0-fast-260128 | ep-m-20260518003252-p4chz | 快速预览 |
| 图片生成 | doubao-seedream-5-0-260128 | ep-m-20260518003223-58l4t | 定妆照/概念图 |

## API端点

- 视频生成: `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`
- 图片生成: `https://ark.cn-beijing.volces.com/api/v3/images/generations`
- 任务查询: `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{taskId}`

## 使用方式

### 1. 山海经系统

```javascript
const { ShanhaiRenderEngine } = require('./shanhaijing-render-engine/render-engine');
const engine = new ShanhaiRenderEngine();

// 渲染镜头
const result = await engine.renderShot({
  shotId: 'E01_A1_S1',
  description: '烛龙觉醒，金色光芒',
  emotion: '敬畏',
  beastSpecies: 'dragon',
  duration: 8
});

// 等待完成
const videos = await engine.waitForRenders([result]);
```

### 2. 通用视频系统

```javascript
const { generateShanhaiVideo, generateShanhaiImage } = require('./volcengine-api-client');

// 生成视频
const video = await generateShanhaiVideo('史诗级神话场景', {
  duration: 10,
  fast: false
});

// 生成图片
const image = await generateShanhaiImage('角色定妆照');
```

## 安全提示

⚠️ **API密钥属于敏感信息**：
- 禁止硬编码在代码中
- 禁止提交到Git仓库
- 使用环境变量或专用密钥管理服务
- 密钥泄露后立即在火山引擎控制台重置

## 故障排查

| 错误 | 原因 | 解决 |
|------|------|------|
| API Key未配置 | 环境变量未设置 | `export VOLCENGINE_ARK_API_KEY=...` |
| HTTP 401 | 密钥无效或过期 | 检查密钥，或重新生成 |
| HTTP 429 | 请求频率过高 | 降低请求频率，或增加delayBetweenShots |
| 任务失败 | 内容审核不通过 | 检查prompt是否符合内容安全规范 |

## 计费说明

- 视频生成：按Token计费（具体费率参考火山引擎控制台）
- 图片生成：按Token计费
- 快速版(Seedance-2.0-fast)：成本约为标准版的60%，质量略低

## 控制台链接

- [模型广场](https://console.volcengine.com/ark/region:ark+cn-beijing/model)
- [接入点管理](https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint)
- [API密钥管理](https://console.volcengine.com/ark/region:ark+cn-beijing/apikey)
