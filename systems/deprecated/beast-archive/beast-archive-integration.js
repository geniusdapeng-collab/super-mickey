/**
 * Beast Archive Integration
 * 神兽档案库集成模块 - 统一入口，协调五大引擎
 * 
 * 核心职责：
 * 1. 统一API入口 - 所有神兽功能通过此模块调用
 * 2. 引擎协调 - Prompt注入→一致性检查→世界观校准→运镜推荐→场景生成
 * 3. 批量处理 - 支持多神兽同框场景
 * 4. 缓存管理 - 神兽档案缓存与索引
 * 5. 预生产集成 - 输出到预生产报告系统
 */

const BeastPromptInjector = require('./beast-prompt-injector');
const BeastConsistencyGuard = require('./beast-consistency-guard');
const NirathWorldSync = require('./nirath-world-sync');
const BeastCameraAdvisor = require('./beast-camera-advisor');
const BeastSceneGenerator = require('./beast-scene-generator');

class BeastArchiveIntegration {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    
    // 初始化五大引擎
    this.injector = new BeastPromptInjector(options.injector);
    this.guard = new BeastConsistencyGuard(options.guard);
    this.sync = new NirathWorldSync(options.sync);
    this.advisor = new BeastCameraAdvisor(options.advisor);
    this.sceneGen = new BeastSceneGenerator(options.sceneGen);
    
    // 性能统计
    this.stats = {
      totalProcessed: 0,
      blockedCount: 0,
      fixedCount: 0,
      cacheHits: 0
    };
  }

  /**
   * 主入口：处理神兽场景
   * 
   * 完整链路：
   * 1. 注入神兽Prompt
   * 2. 检查一致性
   * 3. 校准世界观
   * 4. 推荐运镜
   * 5. 生成场景
   * 6. 输出最终Prompt
   * 
   * @param {Object} input - 输入参数
   * @returns {Object} 完整处理结果
   */
  async process(input) {
    const startTime = Date.now();
    const {
      scriptText,
      sceneType = '展示',
      habitat,
      time = '黄昏',
      weather = '晴朗',
      mood = '庄严',
      humanCharacters = [],
      mode = 'compact'
    } = input;

    this.log('🐉 神兽档案库开始处理...');
    
    // ============ Step 1: Prompt注入 ============
    this.log('Step 1: 注入神兽Prompt...');
    const injectionResult = this.injector.inject(scriptText, { mode, habitat });
    
    if (injectionResult.beastsUsed.length === 0) {
      return {
        success: false,
        error: '未检测到神兽引用',
        originalText: scriptText
      };
    }

    // ============ Step 2: 一致性检查 ============
    this.log('Step 2: 检查神兽一致性...');
    const consistencyResults = [];
    let finalPrompt = injectionResult.injectedText;
    
    for (const beast of injectionResult.beastsUsed) {
      const guardResult = this.guard.check(finalPrompt, beast.id);
      consistencyResults.push(guardResult);
      
      if (!guardResult.passed) {
        this.stats.blockedCount++;
        if (guardResult.fixed) {
          finalPrompt = guardResult.fixed;
          this.stats.fixedCount++;
        }
      }
    }

    const allConsistent = consistencyResults.every(r => r.passed);

    // ============ Step 3: 世界观校准 ============
    this.log('Step 3: 校准Nirath世界观...');
    const syncResult = this.sync.calibrate(finalPrompt, { habitat });
    
    if (!syncResult.passed) {
      finalPrompt = syncResult.corrected;
    }

    // ============ Step 4: 运镜推荐 ============
    this.log('Step 4: 推荐运镜方案...');
    const cameraPlans = [];
    
    for (const beast of injectionResult.beastsUsed) {
      const plan = this.advisor.advise(beast.name, sceneType);
      cameraPlans.push(plan);
    }

    // 处理人类角色同框
    let coexistPlan = null;
    if (humanCharacters.length > 0 && injectionResult.beastsUsed.length > 0) {
      coexistPlan = this.advisor.adviseCoexist(
        injectionResult.beastsUsed[0].name,
        humanCharacters[0],
        '对视'
      );
    }

    // ============ Step 5: 场景生成 ============
    this.log('Step 5: 生成场景描述...');
    const sceneDescription = this.sceneGen.generate(habitat || '通用栖息地', {
      time,
      weather,
      mood,
      includeTerrain: true,
      includeAtmosphere: true
    });

    // ============ Step 6: 组装最终Prompt ============
    const finalBeastPrompt = this.assembleFinalPrompt({
      sceneDescription,
      beastPrompts: injectionResult.promptFragments,
      cameraPlan: cameraPlans[0],
      mode
    });

    const processingTime = Date.now() - startTime;
    this.stats.totalProcessed++;

    // 生成预生产报告条目
    const preProductionEntries = this.generatePreProductionEntries({
      beasts: injectionResult.beastsUsed,
      consistencyResults,
      syncResult,
      cameraPlans,
      sceneDescription
    });

    return {
      success: true,
      processingTime,
      originalText: scriptText,
      finalPrompt,
      finalBeastPrompt,
      beasts: injectionResult.beastsUsed,
      consistency: {
        allPassed: allConsistent,
        results: consistencyResults
      },
      worldSync: syncResult,
      camera: {
        plans: cameraPlans,
        coexist: coexistPlan
      },
      scene: sceneDescription,
      preProduction: preProductionEntries,
      stats: { ...this.stats }
    };
  }

  /**
   * 组装最终Prompt
   */
  assembleFinalPrompt({ sceneDescription, beastPrompts, cameraPlan, mode }) {
    const parts = [];
    
    // 1. 场景描述
    if (sceneDescription) {
      parts.push(sceneDescription);
    }
    
    // 2. 神兽描述
    for (const beast of beastPrompts) {
      parts.push(beast.fragment);
    }
    
    // 3. 运镜信息
    if (cameraPlan) {
      parts.push(`运镜: ${cameraPlan.camera.shotSize} ${cameraPlan.camera.movement}`);
    }
    
    // 4. 风格
    parts.push('超写实CG渲染，东方神话史诗风格，IMAX级视觉');
    
    return parts.join('，');
  }

  /**
   * 生成预生产报告条目
   */
  generatePreProductionEntries({ beasts, consistencyResults, syncResult, cameraPlans, sceneDescription }) {
    const entries = [];
    
    // 神兽完整性检查
    entries.push({
      category: '神兽档案',
      check: '神兽引用完整性',
      status: beasts.length > 0 ? '🟢 通过' : '🔴 失败',
      detail: `检测到 ${beasts.length} 只神兽: ${beasts.map(b => b.name).join(', ')}`
    });
    
    // 一致性检查
    for (const result of consistencyResults) {
      entries.push({
        category: '神兽一致性',
        check: `${result.beastId} 形象一致性`,
        status: result.passed ? '🟢 通过' : (result.severity === 'critical' ? '🔴 严重' : '🟡 警告'),
        detail: result.passed 
          ? '形象特征符合档案规范' 
          : `违规: ${result.violations.map(v => v.detail).join('; ')}`
      });
    }
    
    // 世界观检查
    entries.push({
      category: 'Nirath世界观',
      check: '环境与世界观一致性',
      status: syncResult.passed ? '🟢 通过' : '🟡 警告',
      detail: syncResult.passed 
        ? '环境描述符合Nirath设定' 
        : `需修正: ${syncResult.violations.map(v => v.detail).join('; ')}`
    });
    
    // 运镜方案
    for (const plan of cameraPlans) {
      entries.push({
        category: '运镜设计',
        check: `${plan.beastName} 运镜方案`,
        status: '🟢 通过',
        detail: `${plan.camera.shotSize} + ${plan.camera.movement}，参考: ${plan.reference}`
      });
    }
    
    // 场景描述
    entries.push({
      category: '场景设计',
      check: '栖息地场景生成',
      status: sceneDescription ? '🟢 通过' : '🔴 失败',
      detail: sceneDescription ? sceneDescription.substring(0, 50) + '...' : '生成失败'
    });
    
    return entries;
  }

  /**
   * 快速查询神兽信息
   */
  query(beastId) {
    return this.injector.loadBeast(beastId);
  }

  /**
   * 批量处理多个场景
   */
  async processBatch(inputs) {
    const results = [];
    
    for (const input of inputs) {
      const result = await this.process(input);
      results.push(result);
    }
    
    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  log(msg) {
    if (this.verbose) {
      console.log(`[BeastArchive] ${msg}`);
    }
  }
}

module.exports = BeastArchiveIntegration;

// 测试
if (require.main === module) {
  console.log('🐉 BeastArchiveIntegration 集成测试');
  
  (async () => {
    const archive = new BeastArchiveIntegration({ verbose: true });
    
    // 创建一个测试神兽档案
    const fs = require('fs');
    const path = require('path');
    
    const testBeast = {
      id: 'zhu-long',
      catalogNo: '01',
      name: { chinese: '烛龙', pinyin: 'Zhú Lóng', aliases: ['烛九阴', '烛阴'] },
      classification: { tier: '创世神祇', category: '时空主宰', originText: '《山海经·大荒北经》' },
      nirathStatus: { isNative: true, habitat: '永夜裂谷', ecosystemRole: '星球级生态调节器' },
      visualIdentity: {
        coreDescription: '人面蛇身而赤，身长千里，直目正乘',
        bodyPlan: '人首蛇身',
        colorPalette: ['赤红', '金色', '暗紫'],
        scale: '超巨型',
        texture: '鳞片',
        signatureFeatures: ['竖直生长的双目', '身长千里横亘山脉', '口中衔持永恒火精'],
        promptFragments: {
          head: '人面头部眉目深邃目光如炬',
          body: '绵延蛇身长达千里赤红鳞片',
          eyes: '竖直双目炯炯有神开合决定昼夜',
          special: '口中衔持火精永恒燃烧的等离子体光芒'
        },
        portraitConfig: { model: 'seedream-5-0', size: '2K', style: '超写实CG渲染', angles: ['front', 'threeQuarter', 'closeup', 'side'] }
      },
      abilities: [
        { name: '掌控昼夜', description: '睁眼为白昼，闭眼为黑夜', rarity: 'legendary' },
        { name: '主宰四季', description: '吹气为冬，呼气为夏', rarity: 'legendary' }
      ],
      narrative: {
        originStory: '烛龙为钟山之神，掌控时空运转...',
        keyLegends: ['大禹之父鲧的守护神', '屈原天问'],
        symbolism: ['光明与希望', '永恒守护'],
        relationships: [{ target: 'ying-long', type: '同族', dynamic: '同为神龙地位相当' }]
      }
    };
    
    // 创建测试目录和文件
    const testDir = path.join(__dirname, '../beast-database/beasts');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(path.join(testDir, 'zhu-long.json'), JSON.stringify(testBeast, null, 2));
    
    // 执行测试
    const result = await archive.process({
      scriptText: '小G在永夜裂谷遇见了烛龙，烛龙睁开竖直双目照亮黑暗',
      sceneType: '展示',
      habitat: '永夜裂谷',
      time: '永夜',
      mood: '庄严',
      humanCharacters: ['小G'],
      mode: 'compact'
    });
    
    console.log('\n📊 测试结果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  处理时间: ${result.processingTime}ms`);
    console.log(`  最终Prompt: ${result.finalPrompt.substring(0, 100)}...`);
    console.log(`  一致性通过: ${result.consistency.allPassed}`);
    console.log(`  运镜方案: ${result.camera.plans[0]?.camera?.shotSize || 'N/A'}`);
    console.log(`  场景描述: ${result.scene?.substring(0, 50)}...`);
    console.log(`\n📋 预生产检查项: ${result.preProduction.length}项`);
    result.preProduction.forEach(p => {
      console.log(`  ${p.status} [${p.category}] ${p.check}`);
    });
    
    // 清理测试文件
    fs.unlinkSync(path.join(testDir, 'zhu-long.json'));
  })();
}
