'use strict';

/**
 * 预生产命令 — SuperMickey v2.1.x
 * 【审计修复】原实现引用的 ../../systems/preproduction-service 为 v6.x 旧架构模块,
 * 在当前仓库中已不存在, 导致 `npm start` / `npm run preproduction` 启动即崩溃
 * (MODULE_NOT_FOUND)。现桥接到当前架构的 HyperrealitySystem 主链路,
 * 与 run-preproduction-iron-pot-star.js 保持同一入口逻辑。
 */

const path = require('path');
const fs = require('fs');
const { createLogger } = require('../../systems/logger');

const logger = createLogger('command-preproduction');

async function run(args = {}) {
  const { HyperrealitySystem } = require('../../hyperreality-system');

  // LLM 引擎(可选, 加载失败时系统按降级模式运行)
  let llmEngine = null;
  try {
    const { LLMEngine } = require('../../systems/llm-reasoning-engine.js');
    llmEngine = new LLMEngine({
      model: process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
      timeout: 180000
    });
    logger.info('LLM 引擎加载成功');
  } catch (e) {
    logger.warn('LLM 引擎加载失败, 按降级模式运行', { error: e.message });
  }

  process.env.STORMAXE_TOTAL_DEADLINE_MS = process.env.STORMAXE_TOTAL_DEADLINE_MS || '3600000';

  const system = new HyperrealitySystem({
    llmEngine,
    productionEngine: {
      agentConfig: {
        enableLLMAgents: true,
        llmTimeout: 180000,
        llmMaxRetries: 2,
        llmModel: process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
        fastModel: process.env.STORMAXE_LLM_FAST_MODEL || 'kimi-k2p6',
        totalDeadlineMs: parseInt(process.env.STORMAXE_TOTAL_DEADLINE_MS),
        memThresholdMB: 1800,
        promptFusionConcurrency: 1,
        checkpointDir: './checkpoints',
        enableResume: true
      },
      charactersDir: path.join(process.cwd(), 'characters')
    }
  });

  // 输入: --input <json> | 环境变量 SUPERMICKEY_USER_INTENT（兼容旧名 STORMAXE_USER_INTENT，由 systems/env-aliases.js 桥接） | 默认故事输入
  let intent, metadata = {};
  const inputArgIdx = process.argv.indexOf('--input');
  const inputPath = args.inputPath
    || (inputArgIdx !== -1 ? process.argv[inputArgIdx + 1] : null);

  if (inputPath) {
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    intent = input.intent || input.theme || input.description || JSON.stringify(input);
    metadata = { ...input, title: input.title || input.projectName || path.basename(inputPath, '.json') };
  } else if (process.env.STORMAXE_USER_INTENT) {
    intent = process.env.STORMAXE_USER_INTENT;
    metadata = { title: 'cli-preproduction' };
  } else {
    const defaultInput = path.join(process.cwd(), 'stories', 'taotie-ep01-input.json');
    if (fs.existsSync(defaultInput)) {
      const input = JSON.parse(fs.readFileSync(defaultInput, 'utf8'));
      intent = input.intent || input.theme || input.description || JSON.stringify(input);
      metadata = { ...input, title: input.title || 'taotie-ep01' };
    } else {
      throw new Error('未提供创作意图: 请使用 --input <json> 或环境变量 SUPERMICKEY_USER_INTENT（兼容旧名 STORMAXE_USER_INTENT）');
    }
  }

  const result = await system.create(intent, metadata, {});

  logger.info('命令执行完成', {
    success: result.success,
    stages: Object.keys(result.stages || {})
  });

  // 强制退出, 避免事件循环残留导致进程挂起
  process.exit(result.success ? 0 : 1);
}

module.exports = { run };
