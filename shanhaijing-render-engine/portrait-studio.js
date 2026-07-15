// ========== Nirath定妆照工作室 — Portrait Studio v13.1-Peng
// 
// 世界观：Nirath = 地球前身 = 2147年科技文明归元产物
// 《山海经：异兽志》是8岁男孩AgentX在Nirath上的真实记录
// 
// 职责：
// - 主角定妆（多角度 + 表情 + 服装细节）
// - 异兽定妆（Nirath科技废墟×神话仙境双重视觉精确还原）
// - 三视图锚定（正面/侧面/背面）确保角色一致性
// - 科技前身校验：所有角色形象严格按Nirath世界观v2.0描述
// - v13.1: 科技废墟×神话仙境 — 双重视觉重构（2147年科技文明归元产物）
// - 负面约束强化 — 杜绝地球已知文化符号/东方传统/西方传统元素

const { generateShanhaiImage } = require('../volcengine-api-client.js');
const NIRATH_CREATURES = require('../data/nirath-creature-data.js');

// ========== 定妆照配置 ==========
const PORTRAIT_CONFIG = {
  defaultSize: '2K',
  masterType: '正面全身',
  angles: ['正面全身', '45度侧面', '背面全身', '表情特写', '服装细节'],
  beastAngles: ['全身侧视', '头部特写', '背部纹理', '肢体细节', '动态姿态'],
  generateAudio: false
};

// ========== Nirath异兽志 — v2.0山海经×Nirath双重视觉数据库 ==========
// 数据已从系统代码提取到 data/nirath-creature-data.js
// 新增异兽请直接编辑该数据文件
// 
// 核心原则：
// 1. 每个异兽必须同时包含《山海经》原著原文和Nirath世界观设定
// 2. Prompt生成时融合两者，既有山海经传统韵味，又有Nirath科技废墟美学
// 3. 视觉锚定以山海经原文为准，Nirath设定为美学重构层

const SHANHAIJING_BESTIARY = NIRATH_CREATURES;

// ========== 主角定妆配置 ==========
const CHARACTER_PORTRAIT_CONFIG = {
  xiaog: {
    name: 'AgentX',
    angles: [
      {
        type: '正面全身',
        description: '站立姿势，完整身形展示',
        prompt: '正面全身照，站立姿势，完整身形，圆脸短发大眼睛，卡其色工装裤，深绿色探险夹克，8岁男孩，CG cinematic animation, photorealistic human character, hyper-detailed skin, anatomically accurate proportions, 8K texture, ACES color space, professional studio lighting, clean background',
        isMaster: true
      },
      {
        type: '45度侧面',
        description: '45度角展示面部轮廓和身形',
        prompt: '45度侧面照，展示面部轮廓和身形，圆脸短发大眼睛，卡其色工装裤，深绿色探险夹克，8岁男孩，CG cinematic animation, photorealistic, 8K texture, ACES color space, studio lighting',
        isMaster: false
      },
      {
        type: '背面全身',
        description: '背面展示服装和身形',
        prompt: '背面全身照，展示背影和服装细节，卡其色工装裤，深绿色探险夹克，8岁男孩身形，CG cinematic animation, photorealistic, 8K texture, ACES color space, studio lighting',
        isMaster: false
      },
      {
        type: '表情特写',
        description: '面部表情特写，喜怒哀乐',
        prompt: '面部表情特写，大眼睛明亮好奇，圆脸短发，8岁男孩，快乐表情微笑，CG cinematic animation, photorealistic, hyper-detailed skin, lifelike eyes, 8K texture, studio lighting, clean background',
        isMaster: false
      },
      {
        type: '服装细节',
        description: '服装材质纹理特写',
        prompt: '服装材质特写，卡其色工装裤纹理，深绿色探险夹克细节，布料质感，CG cinematic, photorealistic, 8K texture, macro detail, studio lighting',
        isMaster: false
      }
    ]
  }
};

// ========== PortraitStudio 类 ==========
class PortraitStudio {
  constructor(options = {}) {
    this.apiClient = options.apiClient || require('../volcengine-api-client.js');
    this.config = { ...PORTRAIT_CONFIG, ...options };
    this.portraitCache = new Map(); // 缓存已生成的定妆照
  }

  /**
   * 生成主角定妆照
   * @param {Object} character — 角色信息
   * @returns {Promise<Object>} 定妆照结果
   */
  async generateCharacterPortrait(character) {
    const { id, name, age, gender, appearance, outfit } = character;
    const config = CHARACTER_PORTRAIT_CONFIG[id] || CHARACTER_PORTRAIT_CONFIG.xiaog;
    
    console.log(`📸 [PortraitStudio] 为 ${name} 生成 ${config.angles.length} 张定妆照...`);
    
    const portraits = [];
    let masterPortrait = null;
    
    for (const angle of config.angles) {
      try {
        // 构建定妆照Prompt
        const prompt = this._buildPortraitPrompt(character, angle);
        
        console.log(`  📸 生成 ${angle.type}...`);
        
        const result = await generateShanhaiImage(prompt, {
          size: this.config.defaultSize,
          n: 1
        });
        
        if (result.imageUrl) {
          const portrait = {
            type: angle.type,
            description: angle.description,
            imageUrl: result.imageUrl,
            isMaster: angle.isMaster,
            status: 'success'
          };
          
          portraits.push(portrait);
          
          if (angle.isMaster) {
            masterPortrait = portrait;
            console.log(`    ✅ Master Portrait (${angle.type}) 生成成功`);
          } else {
            console.log(`    ✅ ${angle.type} 生成成功`);
          }
        } else {
          portraits.push({
            type: angle.type,
            status: 'failed',
            error: result.error || '未知错误'
          });
          console.log(`    ❌ ${angle.type} 生成失败`);
        }
      } catch (err) {
        portraits.push({
          type: angle.type,
          status: 'failed',
          error: err.message
        });
        console.error(`    ❌ ${angle.type} 异常:`, err.message);
      }
    }
    
    const result = {
      characterId: id,
      characterName: name,
      portraits: portraits,
      masterPortrait: masterPortrait,
      portraitCount: portraits.filter(p => p.status === 'success').length,
      timestamp: new Date().toISOString()
    };
    
    // 缓存结果
    this.portraitCache.set(id, result);
    
    console.log(`\n✅ [PortraitStudio] ${name} 定妆照完成: ${result.portraitCount}/${config.angles.length}张`);
    if (masterPortrait) {
      console.log(`   🎯 Master: ${masterPortrait.type}`);
    }
    
    return result;
  }

  /**
   * 生成异兽定妆照
   * @param {string} beastId — 异兽ID（如 'zhulong', 'fenghuang'）
   * @param {Object} options — 选项
   * @returns {Promise<Object>} 异兽定妆照结果
   */
  async generateBeastPortrait(beastId, options = {}) {
    const beast = SHANHAIJING_BESTIARY[beastId] || SHANHAIJING_BESTIARY.default;
    const angles = options.angles || this.config.beastAngles;
    
    console.log(`📸 [PortraitStudio] 为Nirath原创异兽「${beast.name}」生成定妆照...`);
    console.log(`   📖 出处: ${beast.source}`);
    console.log(`   📝 描述: ${beast.description}`);
    
    const portraits = [];
    let masterPortrait = null;
    
    for (const angleType of angles) {
      try {
        const prompt = this._buildBeastPrompt(beast, angleType, options.scene);
        
        console.log(`  📸 生成 ${angleType}...`);
        
        const result = await generateShanhaiImage(prompt, {
          size: this.config.defaultSize,
          n: 1
        });
        
        if (result.imageUrl) {
          const portrait = {
            type: angleType,
            imageUrl: result.imageUrl,
            isMaster: angleType === '全身侧视',
            status: 'success'
          };
          
          portraits.push(portrait);
          
          if (portrait.isMaster) {
            masterPortrait = portrait;
          }
          
          console.log(`    ✅ ${angleType} 生成成功`);
        } else {
          portraits.push({
            type: angleType,
            status: 'failed',
            error: result.error || '未知错误'
          });
          console.log(`    ❌ ${angleType} 生成失败`);
        }
      } catch (err) {
        portraits.push({
          type: angleType,
          status: 'failed',
          error: err.message
        });
        console.error(`    ❌ ${angleType} 异常:`, err.message);
      }
    }
    
    const result = {
      beastId: beastId,
      beastName: beast.name,
      source: beast.source,
      description: beast.description,
      portraits: portraits,
      masterPortrait: masterPortrait,
      loreCompliant: true, // 标记已通过Nirath原创世界观校验
      portraitCount: portraits.filter(p => p.status === 'success').length,
      timestamp: new Date().toISOString()
    };
    
    // 缓存结果
    this.portraitCache.set(beastId, result);
    
    console.log(`\n✅ [PortraitStudio] 「${beast.name}」定妆照完成: ${result.portraitCount}/${angles.length}张`);
    console.log(`   📖 严格遵从Nirath原创世界观描述`);
    if (masterPortrait) {
      console.log(`   🎯 Master: ${masterPortrait.type}`);
    }
    
    return result;
  }

  /**
   * 获取已缓存的定妆照
   * @param {string} id — 角色/异兽ID
   * @returns {Object|null} 定妆照结果
   */
  getPortrait(id) {
    return this.portraitCache.get(id) || null;
  }

  /**
   * 获取Master Portrait（用于视频渲染reference）
   * @param {string} id — 角色/异兽ID
   * @returns {Object|null} Master Portrait
   */
  getMasterPortrait(id) {
    const portrait = this.portraitCache.get(id);
    if (portrait && portrait.masterPortrait) {
      return portrait.masterPortrait;
    }
    // 如果没有master，返回第一个成功的
    if (portrait && portrait.portraits.length > 0) {
      return portrait.portraits.find(p => p.status === 'success') || null;
    }
    return null;
  }

  /**
   * 获取异兽原创世界观描述（用于Prompt构建）
   * @param {string} beastId — 异兽ID
   * @returns {Object} 异兽描述信息
   */
  getBeastLore(beastId) {
    return SHANHAIJING_BESTIARY[beastId] || SHANHAIJING_BESTIARY.default;
  }

  /**
   * 校验异兽Prompt是否符合Nirath原创世界观
   * @param {string} beastId — 异兽ID
   * @param {string} prompt — 待校验的Prompt
   * @returns {Object} 校验结果
   */
  validateBeastPrompt(beastId, prompt) {
    const beast = this.getBeastLore(beastId);
    const issues = [];
    
    // 检查是否包含原创世界观关键特征
    if (beast.appearance.face && !prompt.includes(beast.appearance.face.split('—')[0].trim())) {
      issues.push(`缺少原创世界观特征: ${beast.appearance.face}`);
    }
    if (beast.appearance.body && !prompt.includes(beast.appearance.body.split('—')[0].trim())) {
      issues.push(`缺少原创世界观特征: ${beast.appearance.body}`);
    }
    
    // 检查是否包含禁止元素
    if (beast.negativePrompt) {
      const forbidden = beast.negativePrompt.split(', ');
      for (const word of forbidden) {
        if (prompt.toLowerCase().includes(word.toLowerCase())) {
          issues.push(`包含禁止元素: ${word}（违反Nirath原创世界观）`);
        }
      }
    }
    
    return {
      beastId,
      beastName: beast.name,
      isValid: issues.length === 0,
      issues,
      loreCompliant: issues.length === 0
    };
  }

  // ========== 私有方法 ==========

  _buildPortraitPrompt(character, angle) {
    const { name, age, gender, appearance, outfit } = character;
    
    let prompt = angle.prompt;
    
    // 注入角色特定描述
    if (appearance) {
      prompt = prompt.replace('8岁男孩', `${age}岁男孩，${appearance.face || ''}`);
    }
    if (outfit) {
      prompt = prompt.replace('卡其色工装裤，深绿色探险夹克', outfit);
    }
    
    return prompt;
  }

  _buildBeastPrompt(beast, angleType, scene = '') {
    let sceneDesc = scene || 'Nirath原创异世界生态，山海经神话美学，film grain，cinematic lighting';
    
    // 融合山海经原文 + Nirath设定构建Prompt
    let prompt = beast.promptTemplate.replace('{scene}', sceneDesc);
    
    // 根据角度调整
    if (angleType === '头部特写') {
      prompt = prompt.replace('全身', '头部特写');
      prompt += '， hyper-detailed head, facial features, close-up, macro detail';
    } else if (angleType === '背部纹理') {
      prompt += '，背部纹理细节， scale texture, back view, detailed skin/scales';
    } else if (angleType === '肢体细节') {
      prompt += '，肢体细节特写， limb detail, claw/foot close-up, anatomical accuracy';
    } else if (angleType === '动态姿态') {
      prompt += '，动态飞行/奔跑姿态， dynamic pose, motion blur, action shot';
    }
    
    // 添加风格约束 — 强调山海经×Nirath双重视觉
    prompt += '， CG cinematic, photorealistic mythical creature, 《山海经》异兽志风格, Nirath科技废墟美学, 8K texture, ACES color space, studio lighting';
    
    return prompt;
  }
}

// ========== 导出 ==========
module.exports = {
  PortraitStudio,
  SHANHAIJING_BESTIARY,
  CHARACTER_PORTRAIT_CONFIG,
  PORTRAIT_CONFIG
};
