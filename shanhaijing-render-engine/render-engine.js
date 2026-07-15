/**
 * Nirath渲染合成引擎 — Nirath Render Engine v13.1-Peng
 * 
 * 世界观：Nirath = 地球前身 = 2147年科技文明归元产物
 * 《山海经：异兽志》是8岁男孩AgentX在Nirath上的真实记录
 * 
 * 集成火山引擎Seedance API，负责:
 * - 单镜头视频生成
 * - 角色定妆照生成（PortraitStudio集成）
 * - 视频任务状态轮询
 * - 结果收集与质量检查
 * - 字幕烧录（ffmpeg字幕叠加）
 * - Nirath科技废墟×神话仙境双重视觉校验
 * - v11.8: 潜叙事引擎大幅升级（6维度叙事）
 * - v11.9: 角色一致性强化+负面约束（禁红眼/禁铭文/禁分身）
 * - v12.0: 卡梅隆式生物发光仙境基座
 * - v12.1: 去除地球文化符号版+角色一致性致命BUG修复
 * - v13.0: 原创异世界转型 — 彻底移除东方/西方传统元素
 * - v13.1: 科技废墟×神话仙境 — 双重视觉重构（2147年科技文明归元产物）
 * - v13.1-Peng: 🏆 帧传递机制(Frame Pass) — 解决跨镜头角色一致性+首尾帧丝滑切换
 *   - 双重保险：定妆照(master portrait)静态约束 + 上一镜头末帧动态连续性约束
 *   - sequentialFramePass顺序渲染：牺牲并发速度换取镜头间无缝衔接
 *   - 回退机制：帧URL不可用时自动降级为仅定妆照，不阻断生产
 * - v13.1.6-Peng: 修复EP01生产脚本audio开关bug（generateAudio误设为false→恢复true）
 * 
 * 接入点: shanhaijing-pipeline production阶段
 */

const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const { VolcengineArkClient, generateShanhaiVideo, generateShanhaiImage } = require('../volcengine-api-client.js');
const { buildOrientPrompt, L1_CHARACTER, L2_ENVIRONMENT, L3_SCENES, L4_CHARACTERS } = require('./orient-primordial-core.js');
const { CharacterManager } = require('../systems/character-manager.js');
const { PortraitStudio, SHANHAIJING_BESTIARY } = require('./portrait-studio.js'); // v13.1: 重新启用，与character-manager互补
const { LoreValidator } = require('./shanhaijing-lore-validator.js');

// ============ 渲染配置 ============
const RENDER_CONFIG = {
  // 默认视频参数
  defaultDuration: 8,           // 默认镜头时长(秒)
  defaultRatio: '16:9',         // 默认画面比例
  generateAudio: true,          // 默认生成音频
  
  // 质量门控阈值
  minQualityScore: 0.75,        // 最低质量分
  maxRetries: 2,                // 失败重试次数
  
  // 定妆照参数
  portraitSize: '2K',           // 定妆照分辨率
  portraitCount: 5,             // 每个角色生成定妆照数量（正面/侧面/特写/全身/表情）
  
  // v11.5-Peng: Nirath科技废墟×神话仙境质感系统开关
  orientPrimordialMode: true,  // 启用队长"科技废墟×神话仙境"版本
  
  // v11.5-Peng: 角色一致性强化 — 只使用master portrait作为reference
  masterPortraitType: '正面全身',  // 作为视频渲染reference的定妆照类型
  useOnlyMasterPortrait: true,       // 只传master portrait，不传所有角度
  
  // v11.1-Peng: 超写实CG人物风格 — 分离定妆照/电影场景两套约束
  // 人物风格 — 电影场景用（精简版，不含棚拍词汇）
  characterStyleCinematic: 'photorealistic human character, hyper-detailed skin with visible pores and peach fuzz, lifelike eyes with iris fiber detail, individual hair strands with flyaway hairs, soft cinematic diffused lighting, shallow depth of field, micro-expressions, 8K texture, ACES color space',
  
  // 人物风格 — 定妆照用（含棚拍布光词汇）
  characterStylePortrait: 'CG cinematic animation, photorealistic human character, hyper-detailed skin with visible pores, peach fuzz and subtle subsurface scattering, anatomically accurate facial proportions, lifelike eyes with iris fiber detail and natural tear film reflection, individual hair strands with flyaway hairs and anisotropic highlights, soft cinematic diffused lighting with natural shadow falloff, shallow depth of field, micro-expressions driving emotion, natural breathing rhythm and random blink intervals, 8K texture fidelity, ACES color space, photorealistic rendering, cinematic still, professional studio lighting, clean background, character prominent',
  
  // 人物风格 — 负面约束
  characterStyleNegative: 'cartoon, anime, 3D render, plastic skin, wax figure, doll-like, oversized eyes, small nose, sharp chin, symmetrical perfect face, flat lighting, low poly, video game screenshot, puppet, mannequin, robotic repetitive movement, dead eyes, oversaturated, desaturated, blurry texture, poor anatomy',
  
  // 异兽风格 — 电影场景用
  beastStyleCinematic: 'hyper-realistic mythical creature with authentic biological anatomy, detailed skin/scales texture, accurate fur/hair physics, volumetric light and particle effects, cinematic lighting',
  
  // 异兽风格 — 定妆照用
  beastStylePortrait: '超写实CG渲染，生物质感真实可信，皮肤纹理细腻，毛发/鳞片物理模拟准确，体积光与粒子特效真实，电影级光影，神话生物但具备真实生物解剖结构',
  
  // v11.3-Peng: P0 — 色彩脚本+材质精确+节奏标记+光影参数（爱死机水准注入）
  // 色彩脚本（每幕主色调+色温）
  colorScript: {
    '起': '暖黄3200K古铜暗金',
    '承': '蓝绿5600K青阴影暗金rim',
    '转': '金红6500K火焰色温白炽',
    '合': '橙红3200K暖散景深蓝阴影'
  },
  
  // 材质精确描述（替换笼统"超写实"）
  materialPrecise: {
    'human': '毛孔桃子绒SSS，指膝污垢聚集，汗水微光',
    'dragon': '半透明龙鳞内岩浆光，边缘磨损钙化薄膜'
  },
  
  // 镜头节奏标记（爱死机速度感）
  rhythmMark: {
    '起': '手持微晃呼吸感',
    '承': '稳定器推进紧张感',
    '转': '慢动作50%粒子凝滞',
    '合': '舒缓长镜头收束'
  },
  
  // 全局风格标签（精简版）
  globalStyleTags: 'IMAX，Panavision镜头，60s复古科幻，暖橙海盐蓝，胶片颗粒',
  
  // 场景化氛围 — 精简版（为P0腾空间）
  sceneAtmospheres: {
    'indoor': '昏暗室内，暖色局部照明',
    'mountain': '漂浮山脉遗迹，太空电梯残骸，大气透视',
    'cave': '光脉晶窟，粒子对撞机隧道，岩壁反射',
    'forest': '薄雾光斑，基因库遗迹，湿润空气，生物发光',
    'sunset': '夕阳暖金，长阴影',
    'sacred': '神圣空间，量子实验室遗迹，金色粒子'
  },
};

class ShanhaiRenderEngine {
  constructor(options = {}) {
    this.client = new VolcengineArkClient({
      apiKey: options.apiKey || process.env.VOLCENGINE_ARK_API_KEY,
      debug: options.debug || false
    });
    this.config = { ...RENDER_CONFIG, ...options };
    this.taskHistory = [];       // 渲染任务历史
    this.portraits = new Map();  // 角色定妆照缓存
  }

  /**
   * 渲染单镜头（v10.0-Peng: 支持角色定妆照作为referenceImages传递）
   * @param {Object} shot - 镜头数据
   * @param {Object} options - 渲染选项
   *   @param {Array} options.referenceImages - 参考图片URL列表（角色定妆照）
   *   @param {Array} options.referenceVideos - 参考视频URL列表
   *   @param {Array} options.referenceAudios - 参考音频URL列表
   * @returns {Promise<Object>} 渲染结果
   */
  async renderShot(shot, options = {}) {
    // 🔥 v6.2-patch100-fix: 优先使用 production-engine Stage 11 生成的高质量 Prompt
    // 根因：render-engine.js 的 _buildShotPrompt 使用旧版 buildOrientPrompt，忽略 Stage 11 的完整 Prompt
    // 修复：如果 shot.prompt 存在，优先使用它，避免 Stage 11 工作被浪费
    let prompt;
    if (shot.prompt && shot.prompt.length > 0) {
      // 🔥 v6.2-patch100-fix: 合并全局上下文（如果存在）
      // 如果 shot.prompt 包含 [全局注入] 占位符，需要合并全局上下文
      if (shot.prompt.includes('[全局注入]') && shot.globalContext) {
        prompt = this.mergeGlobalContext(shot.prompt, shot.globalContext);
        console.log(`[RenderEngine] ${shot.shotId} 合并全局上下文后: ${prompt.length}字符`);
      } else {
        prompt = shot.prompt;
      }
      console.log(`[RenderEngine] ${shot.shotId} 使用 Stage 11 生成的 Prompt (${prompt.length}字符)`);
    } else {
      prompt = this._buildShotPrompt(shot);
      console.log(`[RenderEngine] ${shot.shotId} 使用旧版 _buildShotPrompt 生成的 Prompt (${prompt.length}字符)`);
    }
    const duration = shot.duration || this.config.defaultDuration;
    
    // v11.5-Peng: 自动提取角色定妆照作为referenceImages
    // v11.5-Peng: 只使用master portrait（正面全身照）作为reference，确保一致性
    let refImages = options.referenceImages || [];
    
    // v13.1-Peng: 帧传递机制 — 加入上一镜头最后一帧作为reference，确保跨镜头角色一致性
    if (options.prevFrameUrl) {
      refImages.push(options.prevFrameUrl);
      console.log(`  🎞️ 携带上一镜头最后一帧（帧传递机制）作为角色连续性约束`);
    }
    
    if (shot.characters && shot.characters.length > 0) {
      for (const char of shot.characters) {
        const portraitCache = this.portraits.get(char.id);
        if (portraitCache) {
          // 优先使用master portrait（正面全身照）
          if (this.config.useOnlyMasterPortrait && portraitCache.masterPortrait) {
            if (portraitCache.masterPortrait.imageUrl) {
              refImages.push(portraitCache.masterPortrait.imageUrl);
              console.log(`  📸 使用 ${char.name} 的master portrait（正面全身）作为角色一致性约束`);
            }
          } else if (portraitCache.portraits) {
            // 回退：使用所有成功的定妆照（旧行为）
            const urls = portraitCache.portraits
              .filter(p => p.status === 'success' && p.imageUrl)
              .map(p => p.imageUrl);
            refImages = [...refImages, ...urls];
          }
        }
      }
    }
    
    // 去重
    refImages = [...new Set(refImages)];
    
    console.log(`🎬 [RenderEngine] 渲染镜头 ${shot.shotId}: ${shot.description.substring(0, 40)}...`);
    if (refImages.length > 0) {
      console.log(`  📸 携带 ${refImages.length} 张参考图（角色一致性 + 帧传递约束）`);
    }

    try {
      // 提交视频生成任务
      const task = await this.client.generateVideo({
        prompt,
        model: options.fast ? 'seedance-2-0-fast' : 'seedance-2-0',
        ratio: this.config.defaultRatio,
        duration,
        generateAudio: this.config.generateAudio,
        watermark: false,
        referenceImages: refImages,  // v10.0-Peng: 使用自动提取的角色定妆照
        referenceVideos: options.referenceVideos,
        referenceAudios: options.referenceAudios
      });

      // 记录任务
      this.taskHistory.push({
        shotId: shot.shotId,
        taskId: task.taskId,
        prompt,
        submittedAt: new Date().toISOString(),
        status: 'submitted'
      });

      console.log(`✅ [RenderEngine] 任务提交成功: ${task.taskId}`);

      return {
        shotId: shot.shotId,
        taskId: task.taskId,
        prompt,
        status: 'submitted',
        estimatedWait: duration > 8 ? 120 : 60 // 预估等待时间(秒)
      };

    } catch (err) {
      console.error(`❌ [RenderEngine] 渲染失败 ${shot.shotId}:`, err.message);
      
      // 重试逻辑
      if (options.retries < this.config.maxRetries) {
        console.log(`🔄 [RenderEngine] 重试 ${shot.shotId} (${options.retries + 1}/${this.config.maxRetries})...`);
        return this.renderShot(shot, { ...options, retries: (options.retries || 0) + 1 });
      }

      throw err;
    }
  }

  /**
   * 批量渲染镜头（v11.4-Peng: 支持并发控制）
   * @param {Array} shots - 镜头列表
   * @param {Object} options - 渲染选项
   * @returns {Promise<Array>} 渲染结果列表
   */
  async renderShots(shots, options = {}) {
    console.log(`🎬 [RenderEngine] 批量渲染 ${shots.length} 个镜头（并发限制: ${this.client.maxConcurrent}）...`);
    
    // v13.1-Peng: 帧传递模式 — 顺序渲染，每镜头携带上一镜头最后一帧作为reference
    // 确保跨镜头角色外貌、服装、姿态绝对一致
    if (options.sequentialFramePass) {
      console.log(`🎞️ [RenderEngine] 启用帧传递模式 — 顺序渲染 + 上一帧reference注入`);
      const results = [];
      let prevFrameUrl = null;
      
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        console.log(`\n🎬 [RenderEngine] 帧传递渲染 镜头 ${i + 1}/${shots.length}: ${shot.shotId}`);
        if (prevFrameUrl) {
          console.log(`   🎞️ 注入上一镜头最后一帧作为角色连续性约束`);
        }
        
        const result = await this.renderShot(shot, {
          ...options,
          prevFrameUrl,
          referenceImages: [] // 帧传递模式下，由renderShot自动管理referenceImages
        });
        results.push(result);
        
        // 等待此镜头完成，提取最后一帧URL用于下一镜头
        if (result.taskId) {
          const final = await this.client.waitForVideo(result.taskId, {
            interval: 5000,
            maxAttempts: 120
          });
          
          if (final.success && final.videoUrl) {
            // 提取视频最后一帧作为下一镜头的reference
            prevFrameUrl = await this._extractLastFrame(final.videoUrl);
            if (prevFrameUrl) {
              console.log(`   ✅ 提取最后一帧成功，已缓存用于下一镜头`);
            }
          }
        }
      }
      
      const successCount = results.filter(r => r.success || r.taskId).length;
      console.log(`\n✅ [RenderEngine] 帧传递批量渲染完成: ${successCount}/${shots.length} 成功`);
      return results;
    }
    
    // v11.4-Peng: 使用Promise.all并发提交，API客户端内部控制并发数
    const promises = shots.map(shot => this.renderShot(shot, options));
    const results = await Promise.all(promises);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [RenderEngine] 批量渲染完成: ${successCount}/${shots.length} 成功`);

    return results;
  }

  /**
   * v11.7-Peng: 生成角色定妆照 — 使用PortraitStudio独立模块
   * v12.1-Peng: 修复角色一致性BUG — 将定妆照结果缓存到this.portraits
   * @param {Object} character - 角色信息
   * @returns {Promise<Object>} 定妆照结果
   */
  async generatePortrait(character) {
    // v11.7: 使用PortraitStudio生成更专业的定妆照
    const studio = new PortraitStudio({ apiClient: this.client });
    
    let result;
    if (character.beastId) {
      // 异兽定妆照
      result = await studio.generateBeastPortrait(character.beastId, {
        scene: character.scene || 'Nirath原创异世界生态'
      });
    } else {
      // 人类角色定妆照
      result = await studio.generateCharacterPortrait(character);
    }
    
    // v12.1-Peng: CRITICAL FIX — 将定妆照结果缓存到this.portraits，供renderShot使用
    if (result && result.characterId) {
      this.portraits.set(result.characterId, result);
      console.log(`🎯 [RenderEngine] 角色 ${result.characterName} 定妆照已缓存，供后续渲染使用`);
    }
    
    return result;
  }

  /**
   * v12.1-Peng: 从JSON文件加载定妆照缓存
   * 用于恢复之前生成的定妆照，避免重复生成
   * @param {string} filePath - portrait-master.json路径
   * @returns {boolean} 是否成功加载
   */
  loadPortraitsFromFile(filePath) {
    try {
      if (fss.existsSync(filePath)) {
        const data = JSON.parse(fss.readFileSync(filePath, 'utf8'));
        if (data.characterId) {
          this.portraits.set(data.characterId, data);
          console.log(`🎯 [RenderEngine] 从 ${filePath} 加载角色 ${data.characterName} 定妆照缓存`);
          console.log(`   📸 Master: ${data.masterPortrait ? '✅ 可用' : '❌ 不可用'}`);
          console.log(`   📸 成功: ${data.portraitCount || 0}/${data.portraits ? data.portraits.length : 0}张`);
          return true;
        }
      }
    } catch (err) {
      console.warn(`⚠️ [RenderEngine] 加载定妆照缓存失败: ${err.message}`);
    }
    return false;
  }

  /**
   * 轮询等待渲染完成
   * @param {Array} renderResults - renderShot/renderShots的返回结果
   * @param {Object} options - 轮询选项
   * @returns {Promise<Array>} 完成的渲染结果
   */
  async waitForRenders(renderResults, options = {}) {
    console.log(`⏳ [RenderEngine] 等待 ${renderResults.length} 个渲染任务完成...`);
    
    const completed = [];
    for (const result of renderResults) {
      if (result.status === 'submitted' && result.taskId) {
        const final = await this.client.waitForVideo(result.taskId, {
          interval: options.interval || 5000,
          maxAttempts: options.maxAttempts || 120
        });

        completed.push({
          shotId: result.shotId,
          ...final
        });

        // 更新历史
        const historyEntry = this.taskHistory.find(t => t.taskId === result.taskId);
        if (historyEntry) {
          historyEntry.status = final.success ? 'completed' : 'failed';
          historyEntry.completedAt = new Date().toISOString();
          historyEntry.videoUrl = final.videoUrl;
        }
      }
    }

    const successCount = completed.filter(c => c.success).length;
    console.log(`✅ [RenderEngine] ${successCount}/${completed.length} 渲染完成`);

    return completed;
  }

  /**
   * 获取任务历史
   */
  getTaskHistory() {
    return this.taskHistory;
  }

  /**
   * 获取定妆照缓存
   */
  getPortraits() {
    return Array.from(this.portraits.values());
  }

  /**
   * v13.1-Peng: 从视频URL提取最后一帧图片
   * 用于帧传递机制 — 将上一镜头的最后一帧作为下一镜头的referenceImage
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<string|null>} 最后一帧图片URL或null
   */
  async _extractLastFrame(videoUrl) {
    try {
      console.log(`   🎞️ [RenderEngine] 尝试提取视频最后一帧...`);
      
      // 构造最后一帧URL
      let frameUrl = null;
      if (videoUrl.includes('volces.com') || videoUrl.includes('volcengine.com')) {
        frameUrl = `${videoUrl}?x-oss-process=video/snapshot,t_9999000,f_jpg,w_1024`;
      } else if (videoUrl.includes('aliyuncs.com')) {
        frameUrl = `${videoUrl}?x-oss-process=video/snapshot,t_9999,f_jpg,w_1024`;
      }
      
      if (!frameUrl) {
        console.warn(`   ⚠️ 无法构造最后一帧URL，回退到仅定妆照`);
        return null;
      }
      
      // v13.1-Peng: 验证URL是否可用（API必须能下载此图片）
      try {
        const http = require('http');
        const https = require('https');
        const client = frameUrl.startsWith('https') ? https : http;
        
        await new Promise((resolve, reject) => {
          const req = client.request(frameUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.on('timeout', () => reject(new Error('timeout')));
          req.end();
        });
        
        console.log(`   ✅ 最后一帧URL验证通过，用于下一镜头`);
        return frameUrl;
      } catch (verifyErr) {
        console.warn(`   ⚠️ 最后一帧URL不可用(${verifyErr.message})，回退到仅定妆照`);
        return null;
      }
    } catch (err) {
      console.warn(`   ⚠️ 提取最后一帧失败: ${err.message}`);
      return null;
    }
  }

  // ============ Prompt构建 ============

  /**
   * v11.5-Peng: 构建镜头渲染Prompt — Nirath原创异世界质感注入
   * 
   * 当 orientPrimordialMode=true 时使用队长提供的Nirath原创异世界核心锚点
   * 否则使用v11.2-Peng的4层架构
   */
  _buildShotPrompt(shot) {
    // v11.5-Peng: Nirath原创异世界模式 — 使用核心锚点系统
    if (this.config.orientPrimordialMode) {
      return this._buildOrientPrimordialPrompt(shot);
    }
    
    // 原有v11.2-Peng 4层架构（向后兼容）
    return this._buildLegacyPrompt(shot);
  }
  
  /**
   * v11.7-Peng: Nirath原创异世界Prompt构建 — 加入舞蹈动作+潜叙事+字幕锚点
   * 
   * 四层架构:
   * - L1+L2: 人物核心(121) + 环境核心(111) = 232字符（固定）
   * - L3: 场景定制(~90字符，按场景类型选择）
   * - L4: 角色定制(~127字符，含外貌锚点+舞蹈动作）
   * - L5: 动作/镜头描述（余量~40字符）
   * 
   * 总计: ~490字符
   */
  _buildOrientPrimordialPrompt(shot) {
    const { description, emotion, beastSpecies, characters = [], act, scene, cameraType } = shot;
    
    // 检测场景类型
    const sceneType = this._detectSceneType(shot) || 'default';
    
    // 检测角色类型
    let charType = 'default';
    const hasHuman = characters.some(c => c.id === 'char_xiaog');
    const hasBeast = !!beastSpecies;
    
    if (hasHuman && !hasBeast) {
      charType = 'human_child';
    } else if (hasBeast && !hasHuman) {
      if (beastSpecies === 'dragon') charType = 'dragon';
      else if (beastSpecies === 'phoenix') charType = 'bird';
      else charType = 'beast';
    } else if (hasHuman && hasBeast) {
      charType = 'human_child';
    }
    
    // v11.7-Peng: 构建潜叙事元素（提升画面信息密度）
    const subnarrative = this._buildSubnarrativeElements(shot);
    
    // v11.7-Peng: 构建舞蹈动作（AgentX是快乐boy，喜欢跳舞）
    const danceAction = this._buildDanceAction(shot);
    
    // v11.9-Peng: 调整拼接顺序 — description优先，潜叙事后置
    // 这样buildOrientPrompt截断时优先保留核心角色动作，截断尾部潜叙事
    let enhancedDescription = description;
    if (danceAction && hasHuman) {
      enhancedDescription = enhancedDescription + '，' + danceAction;
    }
    if (subnarrative) {
      enhancedDescription = enhancedDescription + '，' + subnarrative;
    }
    
    // 使用Nirath原创异世界核心锚点构建Prompt
    const prompt = buildOrientPrompt(sceneType, charType, enhancedDescription);
    
    // 如果还有余量，注入情绪词和色彩脚本
    let finalPrompt = prompt;
    const extras = [];
    
    // 情绪词（极简版）
    const emotionShort = {
      '敬畏': '神圣庄严',
      '恐惧': '暗黑压迫',
      '好奇': '神秘光芒',
      '悲伤': '忧郁柔和',
      '愤怒': '激烈爆发',
      '平静': '宁静自然',
      '神秘': '迷雾奇异',
      '希望': '温暖曙光'
    };
    if (emotion && emotionShort[emotion]) {
      extras.push(emotionShort[emotion]);
    }
    
    // 色彩脚本（每幕色温）
    if (act && this.config.colorScript && this.config.colorScript[act]) {
      extras.push(this.config.colorScript[act]);
    }
    
    // v11.7-Peng: 镜头类型标记（帮助字幕定位）
    if (cameraType) {
      const cameraMark = {
        'epic': '史诗大景',
        'closeup': '面部特写',
        'wide': '全景',
        'tracking': '跟随',
        'aerial': '航拍'
      };
      if (cameraMark[cameraType]) {
        extras.push(cameraMark[cameraType]);
      }
    }
    
    // v14.0-Peng: 系统级负面约束 — 强约束写入prompt（大爆炸后：禁科技+主角禁发光）
    const negativeConstraints = '杜绝红眼，杜绝眼中有火光，杜绝瞳孔发光发红，杜绝铭文文字符号，杜绝甲骨文显现，杜绝多个相同人物，杜绝角色分身重影，杜绝远古发光祭器质感器物，杜绝主角眼中发光，杜绝主角喷火，杜绝主角周身耀眼光芒，杜绝科技元素，杜绝机械装置，杜绝数据晶片';
    if ((finalPrompt + '，' + negativeConstraints).length <= 490) {
      finalPrompt += '，' + negativeConstraints;
      console.log(`[RenderEngine] ${shot.shotId} 完整负面约束已注入 ✅`);
    } else {
      // 超490时精简版负面约束（核心约束保留）
      const shortNegative = '禁红眼，禁铭文，禁分身，禁主角发光，禁科技，禁卡通';
      if ((finalPrompt + '，' + shortNegative).length <= 490) {
        finalPrompt += '，' + shortNegative;
        console.log(`[RenderEngine] ${shot.shotId} 精简负面约束已注入 ⚡（禁主角发光+禁科技）`);
      } else {
        console.warn(`[RenderEngine] ${shot.shotId} 负面约束无法注入（已达490上限）`);
      }
    }
    
    // 尝试追加extras（低优先级，负面约束之后）
    if (extras.length > 0) {
      const extraStr = extras.join('，');
      if ((finalPrompt + '，' + extraStr).length <= 490) {
        finalPrompt += '，' + extraStr;
      }
    }
    
    console.log(`[RenderEngine] ${shot.shotId} Nirath原创异世界Prompt: ${finalPrompt.length}字符`);
    
    return finalPrompt;
  }

  /**
   * v11.7-Peng: 潜叙事元素构建 — 提升画面信息密度
   * 在不增加Prompt长度的前提下，通过更精确的描述增加画面细节
   */
  _buildSubnarrativeElements(shot) {
    const { act, scene, beastSpecies, emotion } = shot;
    const elements = [];
    
    // 场景氛围细节（基础环境叙事）— v13.1: 科技废墟×神话仙境双重视觉
    const { sceneAtmospheres } = require('../data/nirath-scene-data.js');
    
    if (scene && sceneAtmospheres[scene]) {
      elements.push(sceneAtmospheres[scene]);
    }
    
    // 道具细节叙事（从data加载）
    const { propNarratives } = require('../data/nirath-scene-data.js');
    
    if (scene && propNarratives[scene]) {
      elements.push(propNarratives[scene]);
    }
    
    // 异兽潜叙事（从data加载）
    const { beastSubnarratives } = require('../data/nirath-scene-data.js');
    
    if (beastSpecies === 'dragon' && scene === '光脉晶窟山') {
      elements.push(beastSubnarratives['dragon']['守光巨兽']);
    } else if (beastSpecies === 'dragon' && scene === '光球谷地') {
      elements.push(beastSubnarratives['dragon']['光翼游天兽']);
    } else if (beastSpecies && beastSubnarratives[beastSpecies]) {
      elements.push(beastSubnarratives[beastSpecies]);
    }
    
    // 文化符号叙事（从data加载）
    const { culturalSymbols } = require('../data/nirath-scene-data.js');
    
    if (scene && culturalSymbols[scene]) {
      elements.push(culturalSymbols[scene]);
    }
    
    // 环境动态叙事（从data加载）
    const { environmentDynamics } = require('../data/nirath-scene-data.js');
    
    if (scene && environmentDynamics[scene]) {
      elements.push(environmentDynamics[scene]);
    }
    
    // 情绪潜台词（从data加载）
    const { emotionSubtext } = require('../data/nirath-scene-data.js');
    
    if (emotion && emotionSubtext[emotion]) {
      elements.push(emotionSubtext[emotion]);
    }
    
    if (emotion && emotionSubtext[emotion]) {
      elements.push(emotionSubtext[emotion]);
    }
    
    // 返回潜叙事描述（不再内部截断，由上层490字符总限制控制）
    const subtext = elements.join('，');
    return subtext;
  }

  /**
   * v11.7-Peng: 舞蹈动作构建 — AgentX是快乐boy，喜欢跳舞
   * 根据情绪和场景自动匹配合适的舞蹈动作
   */
  _buildDanceAction(shot) {
    const { emotion, act, characters = [] } = shot;
    
    // 只给AgentX添加舞蹈动作
    const hasXiaog = characters.some(c => c.id === 'char_xiaog');
    if (!hasXiaog) return '';
    
    // 舞蹈库（根据情绪和幕次匹配）
    const danceMoves = {
      '起': {
        '敬畏': '双手缓缓抬起如托天，脚尖轻点地面，身体微微后仰',
        '平静': '轻快的踮步旋转，双臂自然摆动，面带微笑'
      },
      '承': {
        '神秘': '手指轻点空中如触摸无形之物，身体微微侧倾，头抬起15度',
        '恐惧': '双手护胸后退舞步，脚尖快速点地，身体紧绷'
      },
      '转': {
        '恐惧': '转身欲逃又停住的矛盾姿态，单脚悬空，身体前倾',
        '神秘': '手指在空中描绘符文轨迹，头微侧，身体后仰15度'
      },
      '合': {
        '敬畏': '张开双臂仰望天空，双膝微屈如跪拜前的准备，身体后仰15度',
        '希望': '欢快的跳跃旋转，双臂高举挥舞，脸上绽放笑容'
      }
    };
    
    if (danceMoves[act] && danceMoves[act][emotion]) {
      return danceMoves[act][emotion];
    }
    
    // 默认舞蹈（快乐boy）
    return '轻快的踮步，双臂自然摆动，面带微笑';
  }
  
  /**
   * v11.2-Peng: 原有4层架构Prompt（向后兼容）
   */
  _buildLegacyPrompt(shot) {
    const { description, emotion, beastSpecies, characters = [], act, scene } = shot;
    const layers = [];
    
    // === Layer1: 场景基础（核心，不可删减）===
    let layer1 = description;
    
    // 情绪词（极简版）
    const emotionShort = {
      '敬畏': '神圣庄严',
      '恐惧': '暗黑压迫',
      '好奇': '神秘光芒',
      '悲伤': '忧郁柔和',
      '愤怒': '激烈爆发',
      '平静': '宁静自然',
      '神秘': '迷雾奇异',
      '希望': '温暖曙光'
    };
    if (emotion && emotionShort[emotion]) {
      layer1 += `，${emotionShort[emotion]}`;
    }
    layers.push(layer1);
    
    // === Layer2: 角色约束（精简锚点，去冗余）===
    const hasHuman = characters.some(c => c.id === 'char_xiaog');
    const hasBeast = !!beastSpecies;
    let layer2 = '';
    
    if (hasHuman) {
      // v11.3-Peng: 材质精确描述注入（爱死机水准）
      layer2 += '8岁男孩，圆脸短发，大眼睛明亮好奇，卡其色工装裤，深绿色探险夹克';
      // 去掉photorealistic（全局标签已有超写实CG），加材质精确
      layer2 += '，毛孔桃子绒SSS，指膝污垢聚集，汗水微光';
      layer2 += '，8K texture，杜绝cartoon/anime/plastic';
    }
    
    if (hasBeast) {
      const beastShort = {
        'dragon': '龙形生物，红色火焰鳞片，星渊之眼蛇身',
        'phoenix': '虹羽焰灵形态，五彩火焰羽毛',
        'fox': '九尾光狐，白色毛发',
        'tiger': '白虎形态，金属质感',
        'turtle': '玄武形态，厚重琥珀化石'
      };
      if (beastShort[beastSpecies]) {
        layer2 += beastShort[beastSpecies];
      }
      // v11.3-Peng: 异兽加材质精确描述
      layer2 += '，半透明龙鳞内岩浆光，边缘磨损钙化薄膜';
      layer2 += '，cinematic lighting，杜绝cartoon/anime/3D/plastic';
    }
    
    if (layer2) layers.push(layer2);
    
    // === Layer3: 技术参数（精简电影级构图）===
    const cinematography = this._buildCinematographyCompact(shot);
    if (cinematography) {
      layers.push(cinematography);
    }
    
    // === Layer4: 风格标签（充分利用490余量）===
    const styleTags = [];
    
    // v11.3-Peng: 色彩脚本注入（每幕主色调+色温）
    if (act && this.config.colorScript && this.config.colorScript[act]) {
      styleTags.push(this.config.colorScript[act]);
    }
    
    // 全局标签（精简版）
    styleTags.push(this.config.globalStyleTags);
    
    // 场景氛围（精简版）
    const sceneAtmospheresCompact = {
      'indoor': '昏暗室内，暖色局部照明',
      'mountain': '山脉日光，太空电梯残骸，大气透视',
      'cave': '洞穴神光渗出，粒子对撞机隧道，岩壁反射',
      'forest': '薄雾光斑，基因库遗迹，湿润空气',
      'sunset': '夕阳暖金，长阴影',
      'sacred': '神圣空间，量子实验室遗迹，金色粒子'
    };
    const sceneType = this._detectSceneType(shot);
    if (sceneType && sceneAtmospheresCompact[sceneType]) {
      styleTags.push(sceneAtmospheresCompact[sceneType]);
    }
    
    // 声学cue（有余量时添加）
    const acousticCue = this._buildAcousticCueV2(shot);
    
    // 合并Layer4
    let layer4 = styleTags.join('，');
    
    // === 合并所有层 ===
    let prompt = layers.join('，');
    
    // 预添加Layer4，检查是否超490
    const testPrompt = prompt + '，' + layer4;
    if (testPrompt.length <= 490) {
      prompt = testPrompt;
      // 还有余量才加声学
      if (acousticCue && (prompt + '，' + acousticCue).length <= 490) {
        prompt += '，' + acousticCue;
      }
    } else if (testPrompt.length <= 520) {
      // 稍微超一点，尝试精简Layer4
      const shortLayer4 = styleTags[0]; // 只用全局标签
      const test2 = prompt + '，' + shortLayer4;
      if (test2.length <= 490) {
        prompt = test2;
      }
    } else {
      console.warn(`⚠️ [RenderEngine] ${shot.shotId} Layer4省略，核心层已达${prompt.length}字符`);
    }
    
    // === 490字符硬控 ===
    const MAX_LEN = 490;
    if (prompt.length > MAX_LEN) {
      console.warn(`⚠️ [RenderEngine] ${shot.shotId} 提示词${prompt.length}字符超490，截断`);
      prompt = prompt.substring(0, MAX_LEN);
      const lastComma = prompt.lastIndexOf('，');
      if (lastComma > prompt.length * 0.8) {
        prompt = prompt.substring(0, lastComma);
      }
    }
    
    console.log(`[RenderEngine] ${shot.shotId} 提示词: ${prompt.length}字符`);
    
    return prompt;
  }

  /**
   * v11.2-Peng: 精简版电影级构图（去掉冗余描述）
   */
  _buildCinematographyCompact(shot) {
    const { cameraType, emotion, act } = shot;
    const cues = [];
    
    // 精简镜头运动
    const cameraShort = {
      'wide': '广角镜头，大景深',
      'closeup': '特写镜头，浅景深，聚焦面部',
      'tracking': '跟拍镜头，手持稳定器质感',
      'dolly': '推轨镜头，缓慢推进',
      'epic': '低角度仰拍，天空占比30%',
      'aerial': '航拍镜头，宏大俯瞰'
    };
    
    if (cameraType && cameraShort[cameraType]) {
      cues.push(cameraShort[cameraType]);
    }
    
    // v11.3-Peng: 节奏标记注入（爱死机速度感）
    if (act && this.config.rhythmMark && this.config.rhythmMark[act]) {
      cues.push(this.config.rhythmMark[act]);
    }
    
    // v11.3-Peng: 光影精确参数（替换简单光影词）
    const lightPrecise = {
      '起': '主光45度侧逆5600K，补光正面柔光降对比',
      '承': '底光+侧逆长阴影，冷暖交界线清晰',
      '转': '顶光+金色rim暗角，火焰色温6500K',
      '合': '逆光金色fill面部暖调，夕阳光3200K'
    };
    
    if (act && lightPrecise[act]) {
      cues.push(lightPrecise[act]);
    }
    
    // 精简情绪光影
    const emotionLight = {
      '敬畏': '顶光+侧逆rim，神圣光晕',
      '恐惧': '底光硬光，半明半暗',
      '愤怒': '顶光+边缘光，暗部红',
      '神秘': '侧逆+蓝紫晕，剪影发光',
      '平静': '漫反射柔光',
      '好奇': '局部聚光暖重点'
    };
    
    if (emotion && emotionLight[emotion]) {
      cues.push(emotionLight[emotion]);
    }
    
    return cues.join('，');
  }

  /**
   * v11.1-Peng: 场景类型检测 — 根据镜头描述推断场景
   */
  _detectSceneType(shot) {
    const desc = (shot.description || '').toLowerCase();
    const scene = (shot.scene || '').toLowerCase();
    
    if (desc.includes('洞穴') || desc.includes('山洞') || scene.includes('洞穴')) return 'cave';
    if (desc.includes('山') || desc.includes('山脉') || scene.includes('山')) return 'mountain';
    if (desc.includes('阁楼') || desc.includes('室内') || desc.includes('房间')) return 'indoor';
    if (desc.includes('森林') || desc.includes('树') || desc.includes('小径')) return 'forest';
    if (desc.includes('夕阳') || desc.includes('黄昏') || desc.includes('晚霞')) return 'sunset';
    if (desc.includes('传承') || desc.includes('觉醒') || desc.includes('祭坛') || desc.includes('神圣')) return 'sacred';
    
    // 默认根据幕次推断
    if (shot.act === '起') return 'forest'; // 开篇通常是户外
    if (shot.act === '转') return 'sacred'; // 转折通常是神圣时刻
    if (shot.act === '合') return 'sunset'; // 结局通常是夕阳
    return 'mountain';
  }

  /**
   * v11.1-Peng: 声学cue构建 — 按场景严格过滤，错配零容忍
   */
  _buildAcousticCueV2(shot) {
    const { act, emotion, beastSpecies, scene } = shot;
    const desc = (shot.description || '').toLowerCase();
    const cues = [];
    
    // 基础幕次声学（简短）
    if (act === '起') cues.push('风声渐入，环境音由远及近');
    else if (act === '承') cues.push('紧张低频嗡鸣，细微声响放大');
    else if (act === '转') cues.push('震撼低频冲击，能量爆发轰鸣');
    else if (act === '合') cues.push('庄严史诗音乐渐起，余音绕梁');
    
    // 情绪声学（简短）
    if (emotion === '敬畏') cues.push('神圣合唱回声');
    if (emotion === '恐惧') cues.push('心跳低频');
    if (emotion === '神秘') cues.push('空灵钟声');
    
    // 场景声学（严格按场景匹配）
    const sceneType = this._detectSceneType(shot);
    
    if (sceneType === 'cave') {
      cues.push('水滴回音，岩壁共振');
      // 洞穴中且有龙 → 龙吟
      if (beastSpecies === 'dragon' || desc.includes('龙') || desc.includes('守光巨兽')) {
        cues.push('龙吟低频，鳞片摩擦');
      }
    } else if (sceneType === 'mountain') {
      cues.push('山风呼啸，岩石摩擦');
    } else if (sceneType === 'indoor') {
      cues.push('木梁吱嘎，尘埃浮动');
    } else if (sceneType === 'forest') {
      cues.push('树叶沙沙，鸟鸣远传');
    }
    
    // 只有在场景中有火/能量爆发时才加火焰声
    if (desc.includes('火焰') || desc.includes('燃烧') || desc.includes('爆裂') || desc.includes('吐息')) {
      cues.push('火焰噼啪爆裂');
    }
    
    return cues.length > 0 ? cues.join('，') : '';
  }

  /**
   * v11.1-Peng: 提示词去重 — 移除重复标签
   */
  _deduplicatePrompt(prompt) {
    // 按逗号分割，去重后再合并
    const segments = prompt.split(/[，,]/);
    const seen = new Set();
    const unique = [];
    
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;
      
      // 检查是否已有相似内容（简单包含关系）
      let isDuplicate = false;
      for (const existing of seen) {
        if (existing.includes(trimmed) || trimmed.includes(existing)) {
          if (trimmed.length <= existing.length) {
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (!isDuplicate) {
        seen.add(trimmed);
        unique.push(trimmed);
      }
    }
    
    return unique.join('，');
  }

  /**
   * 🔥 v6.2-patch100-fix: 合并全局上下文到 Prompt
   * 如果 shot.prompt 包含 [全局注入] 占位符，用实际的全局上下文替换
   */
  mergeGlobalContext(prompt, globalContext) {
    if (!globalContext || globalContext.length === 0) return prompt;
    if (!prompt.includes('[全局注入]')) return prompt;
    
    let result = prompt;
    const blocks = globalContext.split(/(?=【)/).filter(b => b.trim());
    
    for (const block of blocks) {
      const marker = block.match(/【([^】]+)】/)?.[1];
      if (!marker) continue;
      
      const globalContent = block.replace(/【[^】]+】/, '').trim();
      if (!globalContent) continue;
      
      // 替换 [全局注入] 为实际内容
      const placeholder = new RegExp(`【${marker}】\[全局注入\]`, 'g');
      result = result.replace(placeholder, `【${marker}】${globalContent}`);
    }
    
    return result;
  }

  /**
   * 构建镜头渲染Prompt（v10.0旧版，保留兼容）
   * @deprecated 使用 _buildShotPrompt v11.1
   */
  _buildShotPromptOld(shot) {
    return this._buildShotPrompt(shot);
  }

  /**
   * 构建声学cue（v11.0旧版，保留兼容）
   * @deprecated 使用 _buildAcousticCueV2
   */
  _buildAcousticCue(shot) {
    return this._buildAcousticCueV2(shot);
  }

  /**
   * v11.0-Peng: 构建电影级构图与光影描述
   * 增强画面质感：镜头运动、光影层次、景深、色调
   */
  _buildCinematography(shot) {
    const { cameraType, emotion, act } = shot;
    const cues = [];
    
    // 镜头运动描述
    const cameraMovements = {
      'wide': '广角镜头，大景深，展现宏大场景，前景细节清晰',
      'closeup': '特写镜头，浅景深，背景虚化，聚焦人物面部微表情',
      'tracking': '跟拍镜头，手持稳定器质感，轻微晃动增强真实感',
      'dolly': '推轨镜头，缓慢推进，营造探索感与紧张感',
      'epic': '史诗级构图，低角度仰拍，突出角色威严，天空占比30%',
      'medium': '中景镜头，waist-up构图，人物与环境平衡',
      'aerial': '航拍视角，俯瞰大地，展现环境规模与人物渺小对比'
    };
    
    if (cameraType && cameraMovements[cameraType]) {
      cues.push(cameraMovements[cameraType]);
    }
    
    // 光影层次（基于情绪）
    const lightingMoods = {
      '敬畏': '顶光+侧逆光勾勒轮廓，金色rim light，面部阴影柔和过渡',
      '恐惧': '底光+硬光，强烈明暗对比，长阴影，面部半明半暗',
      '好奇': '侧光45度角，面部立体感强，头微微侧倾',
      '悲伤': '柔光散射，低对比度，面部光比2:1，泪光反射',
      '愤怒': '硬光直射，高对比度，面部光比8:1，阴影锐利',
      '平静': '自然漫反射，均匀照明，面部光比3:1，无硬阴影',
      '神秘': '逆光剪影+局部补光，雾气散射光线，丁达尔效应',
      '希望': '逆光+金色fill light，面部温暖色调，头微微仰起'
    };
    
    if (emotion && lightingMoods[emotion]) {
      cues.push(lightingMoods[emotion]);
    }
    
    // 幕次氛围
    const actAtmosphere = {
      '起': '画面通透，色彩鲜明，建立视觉基调',
      '承': '光影层次丰富，细节增加，叙事推进',
      '转': '戏剧性用光，视觉张力最大化，转折点强调',
      '合': '温暖柔和色调，视觉收束，情感回味'
    };
    
    if (act && actAtmosphere[act]) {
      cues.push(actAtmosphere[act]);
    }
    
    // 通用电影级品质
    cues.push('电影级构图，黄金分割或三分法，画面平衡感，视觉引导线清晰');
    cues.push('8K超高清纹理，微观细节丰富，材质质感真实');
    
    return cues.join('，');
  }

  /**
   * 构建定妆照Prompt（v10.0-Peng: 区分人类/异兽，注入超写实风格）
   * @param {Object} character - 角色信息
   * @param {Object} portraitType - 定妆照类型 {suffix, prompt}
   */
  _buildPortraitPrompt(character, portraitType = { suffix: '正面全身', prompt: '正面全身照' }) {
    const { name, description, beastId, age, gender, appearance } = character;
    const isHuman = !beastId;
    
    let prompt = '';
    
    // === 人类角色定妆照 ===
    if (isHuman) {
      prompt = `${name}，${portraitType.prompt}`;
      
      // v11.5-Peng: 强化角色一致性 — 固定外貌锚点（seed-like描述）
      // 无论appearance是否提供，都注入强制外貌锁定
      const fixedAppearance = `圆脸短发大眼睛，卡其色工装裤，深绿色探险夹克，8岁男孩`;
      prompt += `，${fixedAppearance}`;
      
      // 注入详细外貌描述（v10.0-Peng: 关键修复，确保角色一致性）
      if (appearance) {
        const app = appearance;
        prompt += `，${app.face || ''}，${app.hair || ''}，${app.skin || ''}，${app.body || ''}，${app.clothing || ''}`;
      } else if (description) {
        prompt += `，${description}`;
      }
      
      // 年龄/性别锚定
      if (age) prompt += `，${age}岁`;
      if (gender === 'boy') prompt += `，男孩`;
      if (gender === 'girl') prompt += `，女孩`;
      
      // v11.1-Peng: 定妆照用 portrait 版本风格
      prompt += `，${this.config.characterStylePortrait}`;
      prompt += `，杜绝${this.config.characterStyleNegative}`;
      
    // === 异兽角色定妆照 ===
    } else {
      prompt = `${name}，${portraitType.prompt}`;
      
      if (description) {
        prompt += `，${description}`;
      }
      
      // 根据异兽ID添加特征
      const beastTraits = {
        'zhulong': '守光巨兽特征，星渊之眼蛇身，红色鳞片，掌控光明的神性，星渊之眼威严庄重，蛇身覆盖火焰鳞片',
        'jiuweihu': '九尾光狐特征，九条尾巴，妖媚眼神，白色毛发',
        'taotie': '晶齿萌兽特征，贪欲之口，岩石质感，凶煞之气',
        'yinglong': '光翼游天兽特征，背生双翼，黄色龙身，雷电环绕',
        'fenghuang': '虹羽焰灵特征，五彩羽毛，涅槃火焰，高贵气质'
      };
      
      if (beastId && beastTraits[beastId]) {
        prompt += `，${beastTraits[beastId]}`;
      }
      
      // v11.1-Peng: 异兽定妆照用 portrait 版本
      prompt += `，${this.config.beastStylePortrait}`;
    }
    
    // v11.1-Peng: 定妆照不再注入环境氛围（避免棚拍词污染）
    // 只保留棚拍专用布光
    prompt += '，专业影棚布光，背景纯净，角色突出，定妆照风格';
    
    return prompt;
  }
}

// ============ 导出 ============
module.exports = {
  ShanhaiRenderEngine,
  RENDER_CONFIG
};

// CLI测试
if (require.main === module) {
  (async () => {
    console.log('🎬 Nirath原创世界观渲染引擎测试\n');
    
    try {
      const engine = new ShanhaiRenderEngine({ apiKey: 'test-key' });
      
      // 测试Prompt构建
      const testShot = {
        shotId: 'E01_A1_S1',
        description: '守光巨兽睁开眼睛，金色光芒照亮黑暗的山谷',
        emotion: '敬畏',
        beastSpecies: 'dragon',
        duration: 5
      };
      
      const prompt = engine._buildShotPrompt(testShot);
      console.log('📝 镜头Prompt:', prompt);
      console.log('\n✅ Prompt构建测试通过');
      
      // 测试定妆照Prompt
      const testChar = {
        id: 'char_zhulong',
        name: '守光巨兽',
        description: '掌控光明的远古神龙',
        beastId: 'zhulong'
      };
      
      const portraitPrompt = engine._buildPortraitPrompt(testChar);
      console.log('\n📝 定妆照Prompt:', portraitPrompt);
      console.log('\n✅ 定妆照Prompt构建测试通过');
      
    } catch (err) {
      console.error('❌ 测试失败:', err.message);
    }
  })();
}

/**
 * v11.7-Peng: 字幕生成与烧录模块
 * 
 * 职责：
 * - 根据镜头信息生成字幕文件（ASS/SRT格式）
 * - 使用ffmpeg将字幕烧录到视频中
 * - 支持中文/英文双语字幕
 * - Nirath原创异世界风格字幕样式
 */
class SubtitleEngine {
  constructor(options = {}) {
    this.style = {
      // Nirath原创异世界风格字幕样式
      fontName: options.fontName || 'Noto Sans SC',
      fontSize: options.fontSize || 24,
      primaryColor: options.primaryColor || '&H00FFFFFF', // 白色
      secondaryColor: options.secondaryColor || '&H0000FFFF', // 青色
      outlineColor: options.outlineColor || '&H00000000', // 黑色描边
      backColor: options.backColor || '&H00000000', // 黑色背景
      bold: options.bold !== false ? 1 : 0,
      italic: 0,
      borderStyle: 1,
      outline: 2,
      shadow: 1,
      alignment: 2, // 底部居中
      marginV: 30
    };
    this.language = options.language || 'zh'; // zh/en/both
  }

  /**
   * 生成ASS字幕内容
   * @param {Array} shots - 镜头列表，每个包含subtitle字段
   * @returns {string} ASS格式字幕内容
   */
  generateASS(shots) {
    const header = this._buildASSHeader();
    const events = shots.map((shot, index) => this._buildASSEvent(shot, index)).join('\n');
    return header + events;
  }

  /**
   * 生成SRT字幕内容
   * @param {Array} shots - 镜头列表
   * @returns {string} SRT格式字幕内容
   */
  generateSRT(shots) {
    return shots.map((shot, index) => this._buildSRTEvent(shot, index)).join('\n');
  }

  /**
   * 将字幕烧录到视频（ffmpeg）
   * @param {string} videoPath - 输入视频路径
   * @param {string} subtitlePath - 字幕文件路径
   * @param {string} outputPath - 输出视频路径
   * @returns {Promise<Object>} 烧录结果
   */
  async burnSubtitles(videoPath, subtitlePath, outputPath) {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      // ffmpeg命令：烧录ASS字幕
      const cmd = `ffmpeg -i "${videoPath}" -vf "ass=${subtitlePath}" -c:a copy "${outputPath}" -y`;
      
      console.log(`🔥 [SubtitleEngine] 烧录字幕: ${videoPath} -> ${outputPath}`);
      
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ [SubtitleEngine] 烧录失败:', error.message);
          reject({ success: false, error: error.message });
          return;
        }
        
        console.log('✅ [SubtitleEngine] 字幕烧录完成');
        resolve({ success: true, outputPath });
      });
    });
  }

  /**
   * 批量烧录字幕到多个视频片段
   * @param {Array} videoPaths - 视频路径列表
   * @param {Array} shots - 对应的镜头信息
   * @param {string} outputDir - 输出目录
   * @returns {Promise<Array>} 烧录结果列表
   */
  async burnBatch(videoPaths, shots, outputDir) {
    const results = [];
    
    for (let i = 0; i < videoPaths.length; i++) {
      const videoPath = videoPaths[i];
      const shot = shots[i];
      
      if (!shot.subtitle) {
        results.push({ success: false, skipped: true, reason: '无字幕内容' });
        continue;
      }
      
      // 生成单镜头字幕文件
      const subtitlePath = `${outputDir}/subtitle_${String(i).padStart(2, '0')}.ass`;
      const assContent = this.generateASS([shot]);
      fss.writeFileSync(subtitlePath, assContent, 'utf8');
      
      // 烧录字幕
      const outputPath = `${outputDir}/subtitled_${String(i).padStart(2, '0')}.mp4`;
      try {
        const result = await this.burnSubtitles(videoPath, subtitlePath, outputPath);
        results.push({ success: true, outputPath, subtitlePath });
      } catch (err) {
        results.push({ success: false, error: err.error });
      }
    }
    
    return results;
  }

  // ========== 私有方法 ==========

  _buildASSHeader() {
    const s = this.style;
    return `[Script Info]
Title: Nirath原创世界观 EP01 字幕
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${s.fontName},${s.fontSize},${s.primaryColor},${s.secondaryColor},${s.outlineColor},${s.backColor},${s.bold},${s.italic},0,0,100,100,0,0,${s.borderStyle},${s.outline},${s.shadow},${s.alignment},10,10,${s.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  }

  _buildASSEvent(shot, index) {
    const startTime = this._formatTime(index * 8); // 每镜头8秒
    const endTime = this._formatTime((index + 1) * 8);
    const subtitle = shot.subtitle || '';
    
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${subtitle}`;
  }

  _buildSRTEvent(shot, index) {
    const startTime = this._formatSRTTime(index * 8);
    const endTime = this._formatSRTTime((index + 1) * 8);
    const subtitle = shot.subtitle || '';
    
    return `${index + 1}
${startTime} --> ${endTime}
${subtitle}
`;
  }

  _formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(h).padStart(1, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  _formatSRTTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }
}

module.exports.SubtitleEngine = SubtitleEngine;
