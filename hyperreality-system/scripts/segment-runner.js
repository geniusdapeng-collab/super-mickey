/**
 * 分段执行引擎 - Segment Runner
 * 
 * 将预生产拆分为5个独立Segment，每个Segment可独立运行、保存checkpoint、支持断点恢复。
 * 每个Segment目标执行时间 < 35分钟，避免40分钟硬杀。
 * 
 * 核心设计：
 * - 每个 Segment 是一个独立进程，通过文件系统 checkpoint 衔接
 * - 被 kill 后可以从最后一个完成的 checkpoint 恢复
 * - 通过 yieldMs 机制定期输出，重置 Gateway 超时计时器
 * 
 * 用法: 
 *   node segment-runner.js all          # 运行完整流程
 *   node segment-runner.js theme        # 只运行 Segment 1
 *   node segment-runner.js script       # 只运行 Segment 2（依赖 Segment 1）
 *   node segment-runner.js all --resume # 从 checkpoint 恢复
 *   node segment-runner.js clear        # 清理所有 checkpoint
 *   node segment-runner.js status       # 查看 checkpoint 状态
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { HyperrealitySystem } = require('../index');

const BASE_DIR = path.resolve(__dirname, '..');
const CHECKPOINT_DIR = path.join(BASE_DIR, 'output', 'checkpoints');

// 确保 checkpoint 目录存在
if (!fs.existsSync(CHECKPOINT_DIR)) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
}

// Segment 定义
// 【v2.1.8-fix】全局预算 60 分钟，阶段按比例分配
const TOTAL_BUDGET_MS = parseInt(process.env.STORMAXE_TOTAL_DEADLINE_MS || '3600000');

const SEGMENTS = [
  {
    id: 'theme',
    name: 'Step 1: 清理 + 创意主题 + 需求洞察',
    maxDuration: Math.round(TOTAL_BUDGET_MS * 0.20), // 20% = 12 分钟
    description: '清理旧数据，生成创意主题和需求洞察',
    phases: ['cleanup', 'creativeTheme', 'requirementDiscovery']
  },
  {
    id: 'script',
    name: 'Step 2: 剧本生成',
    maxDuration: Math.round(TOTAL_BUDGET_MS * 0.13), // 13% = 8 分钟
    description: '基于主题和需求生成剧本',
    phases: ['script']
  },
  {
    id: 'design',
    name: 'Step 3: 镜头设计 + 视觉语言 + 音频设计 + 连续性审查',
    maxDuration: Math.round(TOTAL_BUDGET_MS * 0.17), // 17% = 10 分钟
    description: '设计镜头、视觉语言、音频设计和连续性',
    phases: ['sceneDesign', 'visualLanguage', 'audioDesign', 'continuityReview']
  },
  {
    id: 'fusion',
    name: 'Step 4: 提示词融合（分批执行）',
    maxDuration: Math.round(TOTAL_BUDGET_MS * 0.42), // 42% = 25 分钟
    description: '融合提示词，分批处理镜头',
    phases: ['promptFusion'],
    batchSize: 2
  },
  {
    id: 'quality',
    name: 'Step 5: 质量检查 + 最终输出',
    maxDuration: Math.round(TOTAL_BUDGET_MS * 0.08), // 8% = 5 分钟（含缓冲）
    description: '检查质量并生成最终输出',
    phases: ['fieldQuality', 'qualityGate', 'mdOutput']
  }
];

class SegmentRunner {
  constructor(options = {}) {
    this.userInput = options.userInput || '';
    this.duration = options.duration || 30;
    this.autoConfirm = options.autoConfirm !== false;
    this.resume = options.resume || false;
    this.system = null;
    this.systemOptions = null;
  }

  /**
   * 输出心跳信息，重置 Gateway 超时计时器
   */
  heartbeat(message) {
    console.log(`[HEARTBEAT ${new Date().toISOString()}] ${message}`);
  }

  /**
   * 加载或初始化系统
   */
  async initSystem() {
    if (this.system) return this.system;

    this.systemOptions = {
      outputDir: path.join(BASE_DIR, 'output'),
      confirmationsDir: path.join(BASE_DIR, 'output', 'confirmations'),
      debugDir: path.join(BASE_DIR, 'debug_llm'),
      tmpDir: path.join(BASE_DIR, 'tmp'),
      cacheDir: path.join(BASE_DIR, 'cache'),
      charactersDir: path.join(BASE_DIR, 'characters'),
    };

    this.system = new HyperrealitySystem(this.systemOptions);
    // HyperrealitySystem 构造函数已同步完成所有初始化，无需 await
    return this.system;
  }

  /**
   * 保存 Checkpoint
   */
  saveCheckpoint(segmentId, data, metadata = {}) {
    const checkpointPath = path.join(CHECKPOINT_DIR, `checkpoint-${segmentId}.json`);
    const checkpoint = {
      segmentId,
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        userInput: this.userInput,
        duration: this.duration,
        autoConfirm: this.autoConfirm,
        ...metadata
      }
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    console.log(`[Checkpoint] ✅ 已保存: ${checkpointPath}`);
    return checkpoint;
  }

  /**
   * 加载 Checkpoint
   */
  loadCheckpoint(segmentId) {
    const checkpointPath = path.join(CHECKPOINT_DIR, `checkpoint-${segmentId}.json`);
    if (!fs.existsSync(checkpointPath)) return null;
    
    try {
      const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      console.log(`[Checkpoint] ✅ 已加载: ${checkpointPath} (${checkpoint.timestamp})`);
      
      // 恢复系统状态
      if (checkpoint.metadata) {
        this.userInput = checkpoint.metadata.userInput || this.userInput;
        this.duration = checkpoint.metadata.duration || this.duration;
        this.autoConfirm = checkpoint.metadata.autoConfirm !== undefined ? checkpoint.metadata.autoConfirm : this.autoConfirm;
      }
      
      return checkpoint;
    } catch (e) {
      console.error(`[Checkpoint] ❌ 加载失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 清理所有 Checkpoint
   */
  clearAllCheckpoints() {
    const files = fs.readdirSync(CHECKPOINT_DIR).filter(f => f.startsWith('checkpoint-'));
    for (const file of files) {
      fs.unlinkSync(path.join(CHECKPOINT_DIR, file));
    }
    console.log(`[Checkpoint] 🧹 已清理 ${files.length} 个检查点`);
  }

  /**
   * 检查是否有完整的 checkpoint 链
   */
  getCompletedSegments() {
    const completed = [];
    for (const seg of SEGMENTS) {
      const cp = this.loadCheckpoint(seg.id);
      if (cp && !cp.data.error) {
        completed.push(seg.id);
      }
    }
    return completed;
  }

  /**
   * 运行指定 Segment
   */
  async runSegment(segmentId) {
    const segment = SEGMENTS.find(s => s.id === segmentId);
    if (!segment) {
      throw new Error(`未知 Segment: ${segmentId}`);
    }

    console.log('');
    console.log('══════════════════════════════════════════');
    console.log(`🚀 运行 Segment: ${segment.name}`);
    console.log(`   预计耗时: ${segment.maxDuration / 60000}分钟`);
    console.log('══════════════════════════════════════════');
    console.log('');

    const startTime = Date.now();
    
    // 检查是否需要恢复
    if (this.resume) {
      const checkpoint = this.loadCheckpoint(segmentId);
      if (checkpoint && checkpoint.data && !checkpoint.data.error) {
        console.log(`[Segment] ✅ 从 checkpoint 恢复，跳过执行`);
        return checkpoint.data;
      }
    }

    // 初始化系统
    await this.initSystem();

    // 设置定期心跳（每3分钟输出一次，重置 Gateway 超时）
    const heartbeatInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 60000;
      this.heartbeat(`Segment ${segmentId} 运行中... ${elapsed.toFixed(1)}分钟`);
    }, 180000); // 3分钟

    // 执行 Segment
    let result;
    try {
      switch (segmentId) {
        case 'theme':
          result = await this.runThemeSegment();
          break;
        case 'script':
          result = await this.runScriptSegment();
          break;
        case 'design':
          result = await this.runDesignSegment();
          break;
        case 'fusion':
          result = await this.runFusionSegment();
          break;
        case 'quality':
          result = await this.runQualitySegment();
          break;
        default:
          throw new Error(`未实现 Segment: ${segmentId}`);
      }
    } finally {
      clearInterval(heartbeatInterval);
    }

    // 保存 Checkpoint
    this.saveCheckpoint(segmentId, result);

    const elapsed = Date.now() - startTime;
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log(`✅ Segment ${segmentId} 完成`);
    console.log(`   实际耗时: ${(elapsed / 1000).toFixed(1)}秒 (${(elapsed / 60000).toFixed(1)}分钟)`);
    console.log(`   剩余预算: ${((segment.maxDuration - elapsed) / 60000).toFixed(1)}分钟`);
    console.log('══════════════════════════════════════════');
    console.log('');

    return result;
  }

  /**
   * Segment 1: 清理 + 创意主题 + 需求清单
   */
  async runThemeSegment() {
    this.heartbeat('开始 Step 1: 清理旧数据');
    
    // 清理旧数据
    console.log('[Segment 1] 🧹 清理旧数据...');
    const dirsToClean = [
      this.systemOptions.confirmationsDir,
      this.systemOptions.debugDir,
      this.systemOptions.tmpDir,
      this.systemOptions.cacheDir,
      path.join(this.systemOptions.outputDir, 'checkpoints'),
      path.join(this.systemOptions.outputDir, 'renders'),
      path.join(this.systemOptions.outputDir, 'post-production'),
    ];
    
    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      fs.mkdirSync(dir, { recursive: true });
    }
    console.log('[Segment 1] ✅ 清理完成');
    this.heartbeat('清理完成，开始创意主题');

    // 调用系统 create 方法，但只执行到需求清单确认
    console.log('[Segment 1] 🎨 生成创意主题和需求清单...');
    
    const result = await this.system.create(this.userInput, {
      title: '预生产项目',
      targetDuration: this.duration,
      // 【修复】注入结构化输入，确保 CreativeThemeGenerator 能识别用户提供的完整字段
      _structuredInput: this.structuredInput
    }, {
      skipScript: true, // 只执行到需求清单
      skipProduction: true,
      skipPromptReview: true,
      skipRender: true,
      skipPostProduction: true
    });

    this.heartbeat('创意主题和需求清单完成');
    
    return {
      creativeTheme: result.stages.creativeTheme?.data,
      requirementList: result.stages.requirementList?.data,
      confirmations: result.confirmations
    };
  }

  /**
   * Segment 2: 剧本生成
   */
  async runScriptSegment() {
    const prevCheckpoint = this.loadCheckpoint('theme');
    if (!prevCheckpoint) {
      throw new Error('Segment 2 需要 Segment 1 的 checkpoint，请先运行: node segment-runner.js theme');
    }

    const { creativeTheme, requirementList } = prevCheckpoint.data;
    
    this.heartbeat('开始 Step 2: 剧本生成');
    console.log('[Segment 2] 📝 生成剧本...');
    console.log(`   使用主题: ${creativeTheme?.tasks?.[0]?.theme || 'N/A'}`);
    console.log(`   使用类型: ${creativeTheme?.tasks?.[0]?.type || 'N/A'}`);

    // 调用 ScriptEngine 生成剧本
    const metadata = {
      title: '预生产项目',
      targetDuration: this.duration,
      _creativeTheme: creativeTheme?.tasks?.[0],
      ...requirementList
    };

    const scriptResult = await this.system.scriptEngine.process(this.userInput, metadata);
    
    this.heartbeat('剧本生成完成');
    console.log(`[Segment 2] ✅ 剧本完成: ${scriptResult.scenes?.length || 0} 场景, ${scriptResult.characters?.length || 0} 角色`);

    return { scriptBlueprint: scriptResult };
  }

  /**
   * Segment 3: 镜头设计 + 视觉语言 + 音频设计 + 连续性审查
   */
  async runDesignSegment() {
    const prevCheckpoint = this.loadCheckpoint('script');
    if (!prevCheckpoint) {
      throw new Error('Segment 3 需要 Segment 2 的 checkpoint，请先运行: node segment-runner.js script');
    }

    const { scriptBlueprint } = prevCheckpoint.data;
    
    this.heartbeat('开始 Step 3: 镜头设计');
    console.log('[Segment 3] 🎬 执行镜头设计...');
    console.log(`   剧本: ${scriptBlueprint.scenes?.length || 0} 场景`);

    // 使用 ProductionEngine 的 Phase 2
    const productionEngine = this.system.productionEngine;
    
    // 并行执行四个子任务
    const results = await Promise.allSettled([
      productionEngine.runSceneDesign(scriptBlueprint).catch(e => ({ error: e.message, phase: 'sceneDesign' })),
      productionEngine.runVisualLanguage(scriptBlueprint).catch(e => ({ error: e.message, phase: 'visualLanguage' })),
      productionEngine.runAudioDesign(scriptBlueprint).catch(e => ({ error: e.message, phase: 'audioDesign' })),
      productionEngine.runContinuityReview(scriptBlueprint).catch(e => ({ error: e.message, phase: 'continuityReview' }))
    ]);

    const [sceneDesign, visualLanguage, audioDesign, continuityReview] = results.map(r => 
      r.status === 'fulfilled' ? r.value : { error: r.reason?.message || String(r.reason) }
    );
    
    this.heartbeat('镜头设计完成');
    console.log('[Segment 3] ✅ 设计完成');
    console.log(`   镜头设计: ${sceneDesign.error ? '❌ ' + sceneDesign.error : '✅'}`);
    console.log(`   视觉语言: ${visualLanguage.error ? '❌ ' + visualLanguage.error : '✅'}`);
    console.log(`   音频设计: ${audioDesign.error ? '❌ ' + audioDesign.error : '✅'}`);
    console.log(`   连续性审查: ${continuityReview.error ? '❌ ' + continuityReview.error : '✅'}`);

    return { sceneDesign, visualLanguage, audioDesign, continuityReview };
  }

  /**
   * Segment 4: 提示词融合（分批处理，支持增量恢复）
   */
  async runFusionSegment() {
    // 加载 design checkpoint
    const designCheckpoint = this.loadCheckpoint('design');
    if (!designCheckpoint) {
      throw new Error('Segment 4 需要 Segment 3 的 checkpoint，请先运行: node segment-runner.js design');
    }

    const { sceneDesign, visualLanguage, audioDesign } = designCheckpoint.data;
    
    // 获取所有镜头
    const shots = sceneDesign?.shots || sceneDesign?.data?.shots || [];
    if (shots.length === 0) {
      throw new Error('没有镜头需要融合');
    }

    // 检查是否已有 fusion checkpoint（支持增量恢复）
    let completedShots = 0;
    let allPrompts = [];
    
    const fusionCheckpoint = this.loadCheckpoint('fusion');
    if (fusionCheckpoint && fusionCheckpoint.data) {
      const { completed, prompts, total } = fusionCheckpoint.data;
      if (completed && prompts && total === shots.length) {
        if (completed >= shots.length) {
          console.log(`[Segment 4] ✅ 全部 ${shots.length} 个镜头已融合，从 checkpoint 恢复`);
          return { prompts };
        }
        // 部分完成，从已完成的数量继续
        completedShots = completed;
        allPrompts = prompts;
        console.log(`[Segment 4] 🔄 从 checkpoint 恢复: 已完成 ${completed}/${shots.length} 个镜头`);
      }
    }
    
    this.heartbeat('开始 Step 4: 提示词融合');
    console.log('[Segment 4] 🔮 提示词融合...');
    console.log(`[Segment 4] 总镜头数: ${shots.length}`);
    console.log(`[Segment 4] 已处理: ${completedShots}`);

    // 分批处理（从已完成的位置继续）
    const batchSize = 2; // 每批2个镜头
    const batchCount = Math.ceil((shots.length - completedShots) / batchSize);
    
    for (let i = completedShots; i < shots.length; i += batchSize) {
      const batch = shots.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const remainingBatches = Math.ceil((shots.length - i) / batchSize);
      
      this.heartbeat(`处理批次 ${batchNum}，剩余 ${remainingBatches} 批`);
      console.log(`[Segment 4] 批次 ${batchNum} (剩余 ${remainingBatches} 批): ${batch.map(s => s.shotId || s.id).join(', ')}`);
      
      try {
        const batchPrompts = await this.system.productionEngine.runPromptFusion(batch, {
          visualLanguage: visualLanguage?.data || visualLanguage,
          audioDesign: audioDesign?.data || audioDesign
        });
        
        allPrompts.push(...(Array.isArray(batchPrompts) ? batchPrompts : [batchPrompts]));
      } catch (e) {
        console.warn(`[Segment 4] 批次 ${batchNum} 失败: ${e.message}`);
      }
      
      // 每批处理完后保存增量 checkpoint
      this.saveCheckpoint('fusion', { 
        prompts: allPrompts, 
        completed: i + batch.length, 
        total: shots.length 
      });
      
      console.log(`[Segment 4] 批次 ${batchNum} 完成，已处理 ${allPrompts.length}/${shots.length} 个镜头`);
    }

    this.heartbeat('提示词融合完成');
    console.log(`[Segment 4] ✅ 全部融合完成: ${allPrompts.length} 个镜头`);
    return { prompts: allPrompts };
  }

  /**
   * Segment 5: 质量检查 + 最终输出
   */
  async runQualitySegment() {
    const prevCheckpoint = this.loadCheckpoint('fusion');
    if (!prevCheckpoint) {
      throw new Error('Segment 5 需要 Segment 4 的 checkpoint，请先运行: node segment-runner.js fusion');
    }

    const { prompts } = prevCheckpoint.data;
    
    this.heartbeat('开始 Step 5: 质量检查');
    console.log('[Segment 5] 🔍 质量检查...');
    
    let qualityResult;
    try {
      qualityResult = await this.system.productionEngine.runQualityCheck(prompts);
    } catch (e) {
      console.warn(`[Segment 5] 质量检查失败: ${e.message}，使用默认结果`);
      qualityResult = { passed: false, score: 0, issues: [] };
    }
    
    this.heartbeat('生成最终输出');
    console.log(`[Segment 5] 质量检查: ${qualityResult.passed ? '✅ 通过' : '⚠️ 未通过'}`);
    console.log(`[Segment 5] 分数: ${qualityResult.score || 'N/A'}`);
    
    // 生成最终输出
    console.log('[Segment 5] 📄 生成最终输出...');
    let finalResult;
    try {
      finalResult = await this.system.productionEngine.generateFinalOutput({
        prompts,
        qualityResult
      });
    } catch (e) {
      console.warn(`[Segment 5] 生成最终输出失败: ${e.message}`);
      finalResult = this.generateFallbackOutput(prompts);
    }

    // 保存到文件
    const outputPath = path.join(
      this.systemOptions.outputDir, 
      `preproduction-result-${new Date().toISOString().replace(/[:.]/g, '-')}.md`
    );
    fs.writeFileSync(outputPath, finalResult);
    
    this.heartbeat('最终输出完成');
    console.log(`[Segment 5] ✅ 最终输出: ${outputPath}`);
    
    return { finalResult, outputPath, qualityResult };
  }

  /**
   * 生成降级输出（当最终输出失败时）
   */
  generateFallbackOutput(prompts) {
    let md = '# 预生产结果（降级输出）\n\n';
    md += `> 生成时间: ${new Date().toISOString()}\n\n`;
    md += '## 镜头列表\n\n';
    
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      md += `### ${p.shotId || `S-${String(i + 1).padStart(2, '0')}`}\n\n`;
      md += `- 场景: ${p.scene || 'N/A'}\n`;
      md += `- 提示词: ${p.prompt || p.promptText || 'N/A'}\n\n`;
    }
    
    return md;
  }

  /**
   * 运行完整流程（所有 Segment）
   */
  async runAll() {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     SuperMickey 预生产分段执行引擎       ║');
    console.log('║     v1.0 - 彻底解决 40 分钟超时问题      ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`📋 输入: "${this.userInput}"`);
    console.log(`⏱️ 时长: ${this.duration}秒`);
    console.log(`🔄 恢复模式: ${this.resume ? '是' : '否'}`);
    console.log('');

    const startTime = Date.now();
    const results = {};

    for (const segment of SEGMENTS) {
      try {
        const result = await this.runSegment(segment.id);
        results[segment.id] = result;
      } catch (error) {
        console.error('');
        console.error('══════════════════════════════════════════');
        console.error(`❌ Segment ${segment.id} 失败`);
        console.error('══════════════════════════════════════════');
        console.error(error.message);
        console.error('');
        console.error('💡 提示: 修复问题后，使用以下命令恢复:');
        console.error(`   node segment-runner.js ${segment.id} --resume`);
        console.error('');
        
        throw error;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     🎉 预生产完成！                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`总耗时: ${(totalTime / 60000).toFixed(1)}分钟`);
    console.log(`输出: ${results.quality?.outputPath || 'N/A'}`);
    console.log('');

    return results;
  }
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const segmentId = args[0];
  const options = {
    userInput: process.env.PREPRODUCTION_INPUT || '环卫工人的一天，带有一点奇幻色彩',
    duration: parseInt(process.env.PREPRODUCTION_DURATION) || 30,
    autoConfirm: process.env.PREPRODUCTION_AUTO_CONFIRM !== 'false',
    resume: args.includes('--resume') || args.includes('-r')
  };

  const runner = new SegmentRunner(options);

  // 处理特殊命令
  if (segmentId === 'all' || !segmentId) {
    // 如果不是恢复模式，清理旧 checkpoint
    if (!options.resume) {
      console.log('[Init] 清理旧 checkpoint...');
      runner.clearAllCheckpoints();
    }
    await runner.runAll();
  } else if (segmentId === 'clear') {
    runner.clearAllCheckpoints();
    console.log('✅ 所有检查点已清理');
  } else if (segmentId === 'status') {
    const checkpoints = fs.readdirSync(CHECKPOINT_DIR).filter(f => f.startsWith('checkpoint-'));
    console.log('📋 检查点状态:');
    if (checkpoints.length === 0) {
      console.log('   无检查点');
    } else {
      for (const cp of checkpoints) {
        const data = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, cp), 'utf-8'));
        const status = data.data?.error ? '❌ 失败' : '✅ 完成';
        console.log(`   ${status} ${data.segmentId}: ${data.timestamp}`);
      }
    }
  } else if (SEGMENTS.some(s => s.id === segmentId)) {
    await runner.runSegment(segmentId);
  } else {
    console.error('');
    console.error('用法: node segment-runner.js [segment|all|clear|status] [options]');
    console.error('');
    console.error('Segments:');
    for (const seg of SEGMENTS) {
      console.error(`  ${seg.id.padEnd(10)} - ${seg.name}`);
    }
    console.error('');
    console.error('选项:');
    console.error('  --resume, -r    从 checkpoint 恢复');
    console.error('');
    console.error('环境变量:');
    console.error('  PREPRODUCTION_INPUT        用户输入');
    console.error('  PREPRODUCTION_DURATION     时长(秒)');
    console.error('  PREPRODUCTION_AUTO_CONFIRM 自动确认(true/false)');
    console.error('');
    console.error('示例:');
    console.error('  node segment-runner.js all');
    console.error('  node segment-runner.js theme');
    console.error('  node segment-runner.js script --resume');
    console.error('  PREPRODUCTION_INPUT="我的主题" node segment-runner.js all');
    process.exit(1);
  }
}

// 导出供其他模块使用
module.exports = { SegmentRunner, SEGMENTS };

// 直接运行
if (require.main === module) {
  main().catch(error => {
    console.error('');
    console.error('══════════════════════════════════════════');
    console.error('❌ 致命错误:', error.message);
    console.error('══════════════════════════════════════════');
    console.error('');
    process.exit(1);
  });
}
