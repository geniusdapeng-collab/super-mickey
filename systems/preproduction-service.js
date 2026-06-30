'use strict';

const path = require('path');
const { NirathMasterPipeline } = require('../zhuoyue-system/core/nirath-master-pipeline.js');
const { StatusReporter } = require('../systems/status-reporter.js');
const { cleanOutputFiles } = require('./output-cleaner');
const { writeJsonReport, writeMarkdownReport } = require('./report-writer');
const { createLogger } = require('./logger');
const { StageExecutionError } = require('./errors');

const logger = createLogger('preproduction-service');

async function runPreproduction(input, options = {}) {
  const {
    outputDir = path.join(process.cwd(), 'output'),
    outputKeyword = '',
    reportPrefix = 'preproduction-report',
    resultPrefix = 'preproduction',
    mode = 'nirath',
    projectConfig = {},
    waitPendingTasks = true,
    checkpoint = null,       // 🔥 v6.5.60: 断点恢复
    onStageComplete = null     // 🔥 v6.5.60: 阶段完成回调
  } = options;

  const reporter = new StatusReporter({
    projectName: input.projectName || '未命名项目'
  });
  reporter.init();

  process.on('SIGTERM', () => {
    reporter.killed('SIGTERM', reporter.currentStage);
    process.exit(143);
  });

  process.on('SIGINT', () => {
    reporter.killed('SIGINT', reporter.currentStage);
    process.exit(130);
  });

  const removed = cleanOutputFiles(outputDir, { keyword: outputKeyword });
  reporter.message(`🧹 清理旧输出 ${removed.length} 个文件`, true);

  const pipeline = new NirathMasterPipeline({
    mode,
    useLLM: true,
    skipDirectorReview: false,
    skipScreenwriterOptimization: false,
    projectConfig,
    statusReporter: reporter
  });

  const start = Date.now();

  try {
    reporter.stage('主链路执行', 10, '剧本生成 → 镜头生成 → 时间轴');
    
    // 🔥 v6.5.60: 传入阶段完成回调
    const pipelineOptions = {};
    if (onStageComplete) {
      pipelineOptions.onStageComplete = onStageComplete;
    }
    const result = await pipeline.execute(input, pipelineOptions);

    if (waitPendingTasks && typeof pipeline.getPendingAsyncTasks === 'function') {
      const pendingTasks = pipeline.getPendingAsyncTasks() || [];
      if (pendingTasks.length > 0) {
        reporter.stage('异步任务收尾', 85, `等待 ${pendingTasks.length} 个任务`);
        try {
          await Promise.race([
            Promise.allSettled(pendingTasks),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('异步任务等待超时')), 300000)
            )
          ]);
        } catch (err) {
          logger.warn('异步任务收尾超时，继续输出当前结果', { message: err.message });
        }
      }
    }

    const totalDuration = Date.now() - start;
    const jsonPath = writeJsonReport(outputDir, resultPrefix, result);
    const mdPath = writeMarkdownReport(
      outputDir,
      reportPrefix,
      buildMarkdownSummary(result, totalDuration)
    );

    reporter.success(result, `总耗时 ${(totalDuration / 1000).toFixed(1)} 秒`);
    logger.info('预生产完成', { jsonPath, mdPath, totalDurationMs: totalDuration });

    return { result, reporter, jsonPath, mdPath, totalDuration };
  } catch (err) {
    reporter.fail(err, reporter.currentStage);
    logger.error('预生产失败', { stage: reporter.currentStage, error: err.message });
    throw new StageExecutionError(`预生产失败: ${err.message}`, {
      stage: reporter.currentStage,
      details: err
    });
  }
}

function buildMarkdownSummary(result, totalDuration) {
  const prompts = result?.stages?.output?.prompts || [];
  const errors = result?.errors || [];

  const lines = [];
  lines.push('# 预生产摘要报告');
  lines.push('');
  lines.push(`- 生成时间: ${new Date().toISOString()}`);
  lines.push(`- 总耗时: ${(totalDuration / 1000).toFixed(1)}秒`);
  lines.push(`- 镜头数: ${prompts.length}`);
  lines.push(`- 错误数: ${errors.length}`);
  lines.push('');

  if (prompts.length > 0) {
    lines.push('## Prompt统计');
    lines.push('');
    for (const prompt of prompts) {
      const text =
        prompt.render_prompt ||
        prompt.renderPrompt ||
        prompt.prompt ||
        prompt.visualPrompt ||
        '';
      lines.push(`- ${prompt.shotId || 'UNKNOWN'}: ${text.length} 字符`);
    }
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('## 错误列表');
    lines.push('');
    for (const err of errors) {
      lines.push(`- ${err.stage || 'UNKNOWN'}: ${err.message || String(err)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { runPreproduction };
