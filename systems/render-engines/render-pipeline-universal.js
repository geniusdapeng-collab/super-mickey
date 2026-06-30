/**
 * 通用写实风格渲染管线
 * 适用于：科普视频、宣传片、产品介绍等通用视频项目
 * 特点：强制写实风格，自动引用角色档案，与山海经系统隔离
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { CharacterManager } = require('../character-manager.js');
const { UniversalStyleInjector } = require('../universal-style-injector.js');

class UniversalRenderPipeline {
  constructor(projectConfig) {
    this.config = projectConfig;
    this.styleInjector = new UniversalStyleInjector('universal-realistic');
    this.characterManager = new CharacterManager();
    
    // API配置
    this.apiKey = process.env.VOLCENGINE_ARK_API_KEY;
    this.modelId = projectConfig.modelId || process.env.SEEDANCE_ENDPOINT || 'YOUR_SEEDANCE_ENDPOINT_ID';
    this.baseUrl = 'https://ark.cn-beijing.volces.com';
    
    // 输出配置
    this.outputDir = projectConfig.outputDir || './production/shots';
    this.maxPromptLength = 490;
    this.maxReferenceImages = 3;
  }
  
  /**
   * 构建增强Prompt
   */
  buildEnhancedPrompt(shot) {
    // 1. 字数利用率检查（系统级保障）
    const utilization = this.styleInjector.checkUtilization(shot.prompt, {
      maxLength: this.maxPromptLength,
      minLength: 450
    });
    
    // 记录利用率信息
    console.log(`📊 [${shot.id}] Prompt利用率: ${utilization.percentage}% (${utilization.length}/${this.maxPromptLength}字)`);
    
    if (!utilization.isValid) {
      if (utilization.status === '字数不足') {
        throw new Error(
          `【系统拦截】${shot.id} Prompt字数不足！\n` +
          `当前: ${utilization.length}字 (${utilization.percentage}%)\n` +
          `要求: 450-490字 (≥91.8%)\n` +
          `原因: 每个镜头独立提交渲染，需充分利用API字数空间\n` +
          `建议: 补充场景细节、光影描述、质感细节、环境元素等`
        );
      } else if (utilization.status === '超限') {
        throw new Error(
          `【系统拦截】${shot.id} Prompt超限！\n` +
          `当前: ${utilization.length}字 (超${utilization.length - this.maxPromptLength}字)\n` +
          `要求: ≤${this.maxPromptLength}字`
        );
      }
    }
    
    // 2. 注入写实风格
    const styledPrompt = this.styleInjector.inject(shot.prompt, {
      sceneType: shot.sceneType || 'default'
    });
    
    // 3. 注入音色描述（如果配置且空间允许）
    if (this.config.voiceStyle) {
      const voicePrefix = `【音色】${this.config.voiceStyle}，`;
      if ((voicePrefix + styledPrompt).length <= this.maxPromptLength) {
        return voicePrefix + styledPrompt;
      }
    }
    
    return styledPrompt;
  }
  
  /**
   * 获取角色参考图
   */
  getReferenceImagesForShot(shot) {
    const characterIds = shot.characters || [];
    const images = [];
    
    for (const charId of characterIds) {
      try {
        const refs = this.characterManager.getReferenceImages(charId, ['front', 'threeQuarter']);
        if (Array.isArray(refs)) {
          for (const ref of refs) {
            if (ref && typeof ref === 'string') {
              const absPath = path.isAbsolute(ref) ? ref : path.join(process.cwd(), ref);
              if (fss.existsSync(absPath)) {
                images.push(absPath);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ 获取角色 ${charId} 定妆照失败:`, e.message);
      }
    }
    
    // 去重并限制数量
    return [...new Set(images)].slice(0, this.maxReferenceImages);
  }
  
  /**
   * 创建API任务
   */
  async createTask(shot) {
    // 1. 构建增强Prompt
    const enhancedPrompt = this.buildEnhancedPrompt(shot);
    
    // 2. 获取参考图
    const refImages = this.getReferenceImagesForShot(shot);
    
    // 3. Prompt中引用参考图（v6.2-patch119: Seedance 2.0官方 @image 格式绑定角色定妆照）
    let finalPrompt = enhancedPrompt;
    if (refImages.length > 0) {
      // 构建角色与@image的映射
      const characterIds = shot.characters || [];
      const refTags = refImages.map((_, i) => {
        const charId = characterIds[i] || '角色';
        const charName = charId === 'xiaoG' ? '小G' : 
                        charId === 'taotie' ? '饕餮' : 
                        charId === 'chen-nurse' ? '陈护士' : charId;
        return `@image${i+1} 作为${charName}角色形象参考`;
      }).join('，');
      
      const refTag = `（${refTags}）`;
      
      if ((enhancedPrompt + refTag).length <= this.maxPromptLength) {
        finalPrompt = enhancedPrompt + refTag;
      } else {
        console.warn(`⚠️ ${shot.id} 加入引用后超长，仅传图不引用`);
      }
    }
    
    // 4. 构建content数组
    const content = [{ type: 'text', text: finalPrompt }];
    
    for (const imgPath of refImages) {
      const base64 = fss.readFileSync(imgPath).toString('base64');
      const ext = path.extname(imgPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
        role: 'reference_image'
      });
    }
    
    // 5. 构建请求
    const payload = {
      model: this.modelId,
      content: content,
      width: 1280,
      height: 720,
      duration: shot.duration,
      ratio: shot.ratio || '16:9',
      fps: 30
    };
    
    // 6. 提交请求
    const response = await fetch(`${this.baseUrl}/api/v3/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  }
  
  /**
   * 轮询任务
   */
  async pollTask(taskId, timeout = 1200000) {
    const startTime = Date.now();
    const pollInterval = 30000;
    
    while (Date.now() - startTime < timeout) {
      const response = await fetch(`${this.baseUrl}/api/v3/contents/generations/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      
      if (!response.ok) throw new Error(`Poll failed: HTTP ${response.status}`);
      
      const result = await response.json();
      const status = result.status || (result.data && result.data.status);
      
      if (status === 'succeeded') return result;
      if (status === 'failed') throw new Error(`Task failed: ${JSON.stringify(result)}`);
      
      await new Promise(r => setTimeout(r, pollInterval));
    }
    
    throw new Error('Poll timeout');
  }
  
  /**
   * 下载视频
   */
  async downloadVideo(url, outputPath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    fss.writeFileSync(outputPath, Buffer.from(buffer));
    
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`   ✅ 下载完成: ${outputPath} (${sizeMB}MB)`);
    return outputPath;
  }
  
  /**
   * 渲染单个镜头
   */
  async renderShot(shot) {
    console.log(`🚀 提交 ${shot.id} (${shot.duration}秒)...`);
    
    const result = await this.createTask(shot);
    const taskId = result.id || (result.data && result.data.id);
    
    if (!taskId) {
      throw new Error('No task ID returned');
    }
    
    console.log(`   ✅ 任务ID: ${taskId}`);
    
    // 轮询
    console.log(`⏳ 轮询中...`);
    const finalResult = await this.pollTask(taskId);
    
    // 下载
    const videoUrl = finalResult.content?.video_url || finalResult.video_url;
    if (!videoUrl) {
      throw new Error('No video URL');
    }
    
    const outputPath = path.join(this.outputDir, `${shot.id}.mp4`);
    await this.downloadVideo(videoUrl, outputPath);
    
    return { shot, outputPath, taskId };
  }
  
  /**
   * 批量渲染
   */
  async renderBatch(shots) {
    console.log(`🎬 通用写实风格渲染管线启动`);
    console.log(`📊 共 ${shots.length} 个镜头\n`);
    
    // 确保输出目录存在
    if (!fss.existsSync(this.outputDir)) {
      fss.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const results = [];
    for (const shot of shots) {
      try {
        const result = await this.renderShot(shot);
        results.push({ ...result, status: 'success' });
      } catch (e) {
        console.error(`   ❌ ${shot.id} 失败: ${e.message}`);
        results.push({ shot, status: 'failed', error: e.message });
      }
      
      // 延迟避免并发限制
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // 输出报告
    this.printReport(results);
    return results;
  }
  
  /**
   * 输出报告
   */
  printReport(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 渲染报告');
    console.log('='.repeat(50));
    
    const success = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`✅ 成功: ${success.length}/${results.length}`);
    console.log(`❌ 失败: ${failed.length}/${results.length}`);
    
    for (const r of success) {
      const size = (fss.statSync(r.outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`   ${r.shot.id}: ${size}MB`);
    }
    
    for (const r of failed) {
      console.log(`   ${r.shot.id}: ${r.error}`);
    }
  }
}

module.exports = { UniversalRenderPipeline };
