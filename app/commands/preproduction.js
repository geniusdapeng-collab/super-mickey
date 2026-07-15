'use strict';

const path = require('path');
const { runPreproduction } = require('../../systems/preproduction-service');
const { createLogger } = require('../../systems/logger');

const logger = createLogger('command-preproduction');

async function run(args = {}) {
  const inputPath = args.inputPath || path.join(process.cwd(), 'stories', 'taotie-ep01-input.json');
  const input = require(inputPath);

  const result = await runPreproduction(input, {
    outputDir: path.join(process.cwd(), 'output'),
    outputKeyword: 'taotie-ep01-preproduction',
    resultPrefix: 'taotie-ep01-preproduction',
    reportPrefix: 'taotie-ep01-preproduction-report',
    mode: 'nirath',
    projectConfig: {
      requiredCharacters: ['xiaoG', 'tao-tie'],
      isPreProduction: true,
      ownerApproved: true
    }
  });

  logger.info('命令执行完成', {
    jsonPath: result.jsonPath,
    mdPath: result.mdPath
  });

  // v6.5.0-fix8: 强制退出进程，避免事件循环残留导致进程挂起
  process.exit(0);

  return result;
}

module.exports = { run };
