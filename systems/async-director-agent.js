/**
 * 异步导演优化Agent (Async Director Agent) v1.0
 * v6.2-patch71: 独立执行的导演优化+编剧优化任务
 * 
 * 职责：
 * 1. 接收镜头方案、PRD、导演方案等输入
 * 2. 执行导演优化（Stage 16）
 * 3. 执行导演-编剧闭环优化（Stage 17）
 * 4. 输出完整优化报告和优化后的镜头方案
 * 5. 结果写入指定JSON文件，供主pipeline读取
 * 
 * 使用方式：
 * node async-director-agent.js --input=input.json --output=output.json
 * 
 * @version v1.0 (v6.2-patch71)
 * @author 小G
 */

const fs = require('fs');
const path = require('path');

class AsyncDirectorAgent {
  constructor(options = {}) {
    this.mode = options.mode || 'nirath';
    this.minPassScore = options.minPassScore || 75;
    this.maxIterations = options.maxIterations || 3;
    this.projectName = options.projectName || 'unknown';
    
    // 输入数据
    this.inputShots = options.shots || [];
    this.inputPrd = options.prd || {};
    this.inputDirectorPlan = options.directorPlan || null;
    
    // 输出路径
    this.outputPath = options.outputPath || './async-director-result.json';
    
    console.log(`[AsyncDirectorAgent] 🎬 异步导演优化Agent启动 | 项目: ${this.projectName}`);
    console.log(`[AsyncDirectorAgent] 📊 输入: ${this.inputShots.length}个镜头 | 模式: ${this.mode}`);
  }

  /**
   * 主入口：执行完整的导演优化+编剧优化流程
   */
  async execute() {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎬 异步导演优化+编剧优化 开始执行`);
    console.log(`${'='.repeat(70)}\n`);

    let reviewResult = null;
    let loopResult = null;
    let optimizedShots = [...this.inputShots];
    let errors = [];

    try {
      // 🔥 v6.2-patch83-fix2: 增加heartbeat机制，防止看起来"卡住"
      const heartbeatInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[AsyncDirectorAgent] 💓 Heartbeat | 已运行${elapsed}秒 | 导演优化:${reviewResult ? '✅' : '⏳'} | 编剧优化:${loopResult ? '✅' : '⏳'}`);
      }, 30000); // 每30秒输出一次
      
      try {
      console.log(`[AsyncDirectorAgent] 🎬 Step 1: 导演优化...`);
      const { DirectorFinalReview } = require('./director-final-review.js');
      const directorReview = new DirectorFinalReview({ 
        mode: this.mode, 
        useLLM: true,
        minPassScore: this.minPassScore 
      });

      reviewResult = await directorReview.review({
        projectName: this.projectName,
        prd: this.inputPrd,
        shots: this.inputShots,
        directorPlan: this.inputDirectorPlan
      });

      console.log(`[AsyncDirectorAgent] ✅ 导演优化完成 | 评分: ${reviewResult.score}/100 | ${reviewResult.passed ? '通过' : '未通过'}`);

      // ===== Step 2: 导演-编剧闭环优化 =====
      console.log(`[AsyncDirectorAgent] ✍️ Step 2: 导演-编剧闭环优化...`);
      const { DirectorScreenwriterLoop } = require('./director-screenwriter-loop.js');
      const loop = new DirectorScreenwriterLoop({ 
        mode: this.mode, 
        useLLM: true,
        maxIterations: this.maxIterations,
        minPassScore: this.minPassScore
      });

      loopResult = await loop.execute({
        projectName: this.projectName,
        shots: this.inputShots,
        prd: this.inputPrd,
        directorPlan: this.inputDirectorPlan
      });

      // 更新优化后的镜头
      if (loopResult.shots && loopResult.shots.length > 0) {
        optimizedShots = loopResult.shots;
      }

      console.log(`[AsyncDirectorAgent] ✅ 编剧优化完成 | 迭代: ${loopResult.iteration}轮 | 评分: ${loopResult.summary?.directorScore || 0}/100`);
      
      } catch (error) {
        console.error(`[AsyncDirectorAgent] 💥 执行失败: ${error.message}`);
        console.error(error.stack);
        errors.push({
          stage: 'ASYNC-DIRECTOR-AGENT',
          message: error.message,
          stack: error.stack
        });
      } finally {
        // P1-fix: 无论成功失败都清理心跳定时器，避免阻止进程退出
        clearInterval(heartbeatInterval);
      }
    }

    // ===== 组装结果 =====
    const totalTime = Date.now() - startTime;
    const result = {
      success: errors.length === 0,
      projectName: this.projectName,
      totalTime,
      timestamp: new Date().toISOString(),
      
      // 导演优化结果
      directorReview: reviewResult ? {
        passed: reviewResult.passed,
        score: reviewResult.score,
        issues: reviewResult.issues || [],
        suggestions: reviewResult.suggestions || [],
        reviewTime: reviewResult.reviewTime,
        llmEnabled: reviewResult.llmEnabled
      } : null,
      
      // 编剧优化结果
      screenwriterLoop: loopResult ? {
        passed: loopResult.passed,
        iteration: loopResult.iteration,
        totalShots: loopResult.summary?.totalShots || 0,
        directorScore: loopResult.summary?.directorScore || 0,
        continuityScore: loopResult.summary?.continuityScore || 0,
        dialogueScore: loopResult.summary?.dialogueScore || 0,
        totalIssues: loopResult.summary?.totalIssues || 0,
        status: loopResult.summary?.status || 'UNKNOWN',
        issuesFixed: loopResult.optimization?.issuesFixed || 0,
        issuesRemaining: loopResult.optimization?.issuesRemaining || 0
      } : null,
      
      // 优化后的镜头方案
      optimizedShots,
      
      // 统计摘要
      summary: {
        originalShotCount: this.inputShots.length,
        optimizedShotCount: optimizedShots.length,
        directorScore: reviewResult?.score || 0,
        finalScore: loopResult?.summary?.directorScore || reviewResult?.score || 0,
        issuesTotal: (reviewResult?.issues?.length || 0) + (loopResult?.summary?.totalIssues || 0),
        executionTimeMs: totalTime,
        executionTimeSec: Math.round(totalTime / 1000)
      },
      
      errors
    };

    // ===== 写入输出文件 =====
    this._writeResult(result);

    // ===== 输出报告 =====
    this._printReport(result);

    return result;
  }

  /**
   * 写入结果到JSON文件
   */
  _writeResult(result) {
    try {
      // 确保目录存在
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`[AsyncDirectorAgent] 💾 结果已写入: ${this.outputPath}`);
    } catch (error) {
      console.error(`[AsyncDirectorAgent] ❌ 写入结果失败: ${error.message}`);
      // 尝试写入临时目录
      const fallbackPath = `/tmp/async-director-${Date.now()}.json`;
      try {
        fs.writeFileSync(fallbackPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`[AsyncDirectorAgent] 💾 结果已写入备用路径: ${fallbackPath}`);
      } catch (e) {
        console.error(`[AsyncDirectorAgent] ❌ 备用写入也失败`);
      }
    }
  }

  /**
   * 打印执行报告
   */
  _printReport(result) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 异步导演优化+编剧优化 执行报告`);
    console.log(`${'='.repeat(70)}`);
    console.log(`项目: ${result.projectName}`);
    console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`总耗时: ${result.summary.executionTimeSec}秒`);
    console.log(`\n导演优化:`);
    if (result.directorReview) {
      console.log(`  评分: ${result.directorReview.score}/100`);
      console.log(`  状态: ${result.directorReview.passed ? '✅ 通过' : '❌ 未通过'}`);
      console.log(`  问题: ${result.directorReview.issues.length}个`);
      console.log(`  建议: ${result.directorReview.suggestions.length}个`);
      console.log(`  LLM: ${result.directorReview.llmEnabled ? '✅ 启用' : '❌ 未启用'}`);
    } else {
      console.log(`  ❌ 未执行`);
    }
    
    console.log(`\n编剧优化:`);
    if (result.screenwriterLoop) {
      console.log(`  迭代: ${result.screenwriterLoop.iteration}轮`);
      console.log(`  评分: ${result.screenwriterLoop.directorScore}/100`);
      console.log(`  修复: ${result.screenwriterLoop.issuesFixed}个问题`);
      console.log(`  遗留: ${result.screenwriterLoop.issuesRemaining}个问题`);
    } else {
      console.log(`  ❌ 未执行`);
    }
    
    console.log(`\n镜头方案:`);
    console.log(`  原始: ${result.summary.originalShotCount}个镜头`);
    console.log(`  优化后: ${result.summary.optimizedShotCount}个镜头`);
    
    if (result.errors.length > 0) {
      console.log(`\n❌ 错误:`);
      result.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. [${err.stage}] ${err.message}`);
      });
    }
    
    console.log(`${'='.repeat(70)}\n`);
  }
}

// ==================== CLI入口 ====================

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputPath = './async-director-result.json';
  let mode = 'nirath';

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      inputPath = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.split('=')[1];
    } else if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1];
    }
  }

  if (!inputPath) {
    console.error('用法: node async-director-agent.js --input=input.json --output=output.json [--mode=nirath]');
    console.error('');
    console.error('input.json格式:');
    console.error(JSON.stringify({
      projectName: "项目名称",
      shots: [],
      prd: {},
      directorPlan: null
    }, null, 2));
    process.exit(1);
  }

  // 读取输入
  console.log(`[AsyncDirectorAgent] 📂 读取输入文件: ${inputPath}`);
  const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  // 创建Agent并执行
  const agent = new AsyncDirectorAgent({
    mode: inputData.mode || mode,
    projectName: inputData.projectName || 'unknown',
    shots: inputData.shots || [],
    prd: inputData.prd || {},
    directorPlan: inputData.directorPlan || null,
    outputPath,
    minPassScore: inputData.minPassScore || 75,
    maxIterations: inputData.maxIterations || 3
  });

  const result = await agent.execute();
  
  // 返回退出码
  process.exit(result.success ? 0 : 1);
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(error => {
    console.error(`[AsyncDirectorAgent] 💥 未捕获异常: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { AsyncDirectorAgent };

// v6.2-patch71: 异步导演优化Agent — 支持独立执行的导演优化+编剧优化任务
