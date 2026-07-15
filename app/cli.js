#!/usr/bin/env node
'use strict';

const { createLogger } = require('../systems/logger');
const logger = createLogger('cli');

async function main() {
  const command = process.argv[2] || 'preproduction';

  if (command === 'preproduction') {
    const { run } = require('./commands/preproduction');
    await run({});
    return;
  }

  logger.error('未知命令', { command });
  process.exit(1);
}

main().catch(err => {
  logger.error('CLI执行失败', { error: err.message });
  process.exit(1);
});
