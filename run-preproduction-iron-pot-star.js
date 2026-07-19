#!/usr/bin/env node
/**
 * 预生产标准入口 - SuperMickey v2.1.13
 * 基于 25字段体系
 * 完整预生产六步法执行
 *
 * 【设计原则】此入口为通用标准入口，不针对任何特定主题硬编码
 * 主题通过命令行参数或 JSON 配置文件传入，系统通用化处理
 *
 * 【v2.1.13-fix】Step 0.5 新增确认服务器健康自检（ensure-confirmation-server.js）
 * 【v2.1.12-fix 多进程竞态修复】
 *  - 启动即获取单实例锁（PID 锁文件 + 存活探测）：已有活进程在跑时明确报错退出，
 *    杜绝"重复启动 → 互相清理 checkpoints/output → 竞争消费确认文件"的事故链
 *  - Step 1 清理前先把上一轮遗留的 confirmation-*.md/json 全部归档（archive/pre-run/），
 *    消除"旧确认自动放行新内容"与 gatekeeper 状态误报
 *  - HyperrealitySystem 实例改为持锁后再构建（未持锁的进程不做任何重活）
 *  - 移除从未被调用的 waitForUserConfirmation 死代码；监控日志改为状态变化时才打印
 *  - 运行结束（成功/失败/信号）均释放锁并归档运行状态
 *
 * 【v2.1.9-fix】修复 CreativeThemeGenerator 上下文感知缺失：
 *  - Scene B 分类误判：中文文本无空格但含语法结构时不应判定为"单个关键词"
 *  - 关键词子串误匹配："动物园"不应命中"自然纪录片"类型
 *  - 新增上下文推断：宝宝+动物园→家庭温情，医院+观察→社会现实
 * 【v2.1.9-fix】支持两种输入模式：
 * 模式A: 字符串主题 —— node run-preproduction-iron-pot-star.js "主题描述"
 * 模式B: 结构化JSON —— node run-preproduction-iron-pot-star.js --config theme.json
 *        或 echo '{"type":"...","theme":"..."}' | node run-preproduction-iron-pot-star.js --stdin
 *
 * 【六步法强制流程】
 * Step 1: 清理旧数据（本入口自动执行）
 * Step 2: 创意主题生成 + 人工确认（系统强制，不可跳过）
 * Step 3: 需求清单 + 人工确认（系统强制，不可跳过）
 * Step 4: 定妆照检查/生成 + 人工确认（系统强制，不可跳过）
 * Step 5: 执行预生产链路（自动执行）
 * Step 6: 结果输出为 MD 文件 + 最终确认（自动执行）
 */

const { HyperrealitySystem } = require('./hyperreality-system');
const fs = require('fs');
const path = require('path');
const runCoordinator = require('./scripts/run-coordinator');

// 【v2.1.10-hotfix】确保 HUMAN_CONFIRMATION_SECRET 密钥同步
// 主入口和 human-confirm.js 必须使用同一密钥，否则签名验证失败
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath) && !process.env.HUMAN_CONFIRMATION_SECRET) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const secretMatch = envContent.match(/HUMAN_CONFIRMATION_SECRET=(.+)/);
    if (secretMatch) {
      process.env.HUMAN_CONFIRMATION_SECRET = secretMatch[1].trim();
      console.log('[v2.1.10-hotfix] 已从 .env 同步 HUMAN_CONFIRMATION_SECRET');
    }
  }
} catch (e) {
  // 忽略 .env 读取错误
}

// 【v2.1.9-防跳过机制】加载确认检查点
let gatekeeper;
try {
  gatekeeper = require('./scripts/preproduction-gatekeeper');
} catch (e) {
  console.warn('⚠️ gatekeeper 加载失败:', e.message);
}

// 环境变量配置
process.env.STORMAXE_LLM_MODEL = process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
process.env.STORMAXE_LLM_FAST_MODEL = process.env.STORMAXE_LLM_FAST_MODEL || 'kimi-k2p6';
// 【v2.1.9-fix】总预算 60 分钟（3600 秒），支持通过环境变量覆盖
process.env.STORMAXE_TOTAL_DEADLINE_MS = process.env.STORMAXE_TOTAL_DEADLINE_MS || '3600000';

/**
 * 【v2.1.9-fix】解析命令行参数
 * 支持:
 *   node run-preproduction-iron-pot-star.js "主题描述"
 *   node run-preproduction-iron-pot-star.js --config theme.json
 *   echo '{"type":"..."}' | node run-preproduction-iron-pot-star.js --stdin
 */
function parseArgs() {
  const args = process.argv.slice(2);

  // 模式B: --config 指定 JSON 文件
  const configIndex = args.indexOf('--config');
  if (configIndex !== -1 && args[configIndex + 1]) {
    const configPath = args[configIndex + 1];
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      return { mode: 'structured', data: JSON.parse(configData), source: configPath };
    } catch (e) {
      console.error(`❌ 无法读取配置文件: ${configPath} - ${e.message}`);
      process.exit(1);
    }
  }

  // 模式B: --stdin 从标准输入读取 JSON
  if (args.includes('--stdin')) {
    return { mode: 'stdin', data: null, source: 'stdin' };
  }

  // 模式A: 环境变量
  const envIntent = process.env.STORMAXE_USER_INTENT;
  if (envIntent) {
    // 检测是否是 JSON
    const trimmed = envIntent.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return { mode: 'structured', data: JSON.parse(trimmed), source: 'env-json' };
      } catch (e) {
        // 不是有效 JSON，按字符串处理
      }
    }
    return { mode: 'string', data: envIntent, source: 'env' };
  }

  // 模式A: 命令行参数（字符串）
  if (args.length > 0 && !args[0].startsWith('--')) {
    const argText = args.join(' ');
    // 检测是否是 JSON
    const trimmed = argText.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return { mode: 'structured', data: JSON.parse(trimmed), source: 'arg-json' };
      } catch (e) {
        // 不是有效 JSON，按字符串处理
      }
    }
    return { mode: 'string', data: argText, source: 'arg' };
  }

  return null;
}

/**
 * 【v2.1.9-fix】从标准输入读取 JSON
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data.trim()));
      } catch (e) {
        reject(new Error(`无法解析标准输入为 JSON: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

async function runPreproduction() {
  // 解析输入
  const parsed = parseArgs();

  if (!parsed) {
    console.error('❌ 错误：未提供主题。用法：');
    console.error('  字符串模式: node run-preproduction-iron-pot-star.js "主题描述"');
    console.error('  JSON 文件:  node run-preproduction-iron-pot-star.js --config theme.json');
    console.error('  标准输入:   echo \'{"type":"..."}\' | node run-preproduction-iron-pot-star.js --stdin');
    process.exit(1);
  }

  let userIntent;
  let structuredTheme = null;
  let title;

  if (parsed.mode === 'stdin') {
    try {
      structuredTheme = await readStdin();
      userIntent = structuredTheme;
      title = structuredTheme.theme || structuredTheme.title || '未命名主题';
      console.log(`✅ 从标准输入读取结构化主题: ${title}`);
    } catch (e) {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    }
  } else if (parsed.mode === 'structured') {
    structuredTheme = parsed.data;
    userIntent = structuredTheme;  // 直接传入结构化对象
    title = structuredTheme.theme || structuredTheme.title || '未命名主题';
    console.log(`✅ 从 ${parsed.source} 读取结构化主题: ${title}`);
  } else {
    userIntent = parsed.data;  // 字符串
    // 【v2.1.15-fix 主题漂移】标题取第一个语义完整子句（≤40字符），
    // 不再硬截断20字符导致"穿越遇到现代王勃"等核心创意丢失
    title = userIntent.split(/[，。！？；：:]/)[0].substring(0, 40) || '未命名主题';
  }

  console.log('🔥 [HyperrealitySystem v2.1.13] 通用预生产启动');
  console.log('='.repeat(70));
  console.log(`输入模式: ${parsed.mode === 'structured' ? '结构化JSON' : '字符串'}`);
  console.log(`主题: ${title}`);
  if (structuredTheme) {
    console.log(`类型: ${structuredTheme.type || '未指定'}`);
    console.log(`时长: ${structuredTheme.duration_sec || '未指定'}秒`);
    console.log(`难度: ${structuredTheme.difficulty || '未指定'}`);
  }
  console.log('');
  console.log('【六步法强制流程】');
  console.log('Step 1: 清理旧数据');
  console.log('Step 2: 创意主题生成 + 人工确认（强制）');
  console.log('Step 3: 需求清单 + 人工确认（强制）');
  console.log('Step 4: 定妆照检查/生成 + 人工确认（强制）');
  console.log('Step 5: 执行预生产链路');
  console.log('Step 6: 结果输出为 MD 文件 + 最终确认');
  console.log('');

  // 【v2.1.12-fix】Step 0: 单实例锁 —— 必须在任何清理/构建之前
  // 已有活进程在运行时，明确报错退出（不再允许"重复启动互相拆台"）
  const forceLock = process.env.STORMAXE_FORCE_RUN === '1';
  const lockResult = runCoordinator.acquireLock(
    { title, intent: String(typeof userIntent === 'string' ? userIntent : JSON.stringify(userIntent)).substring(0, 120), source: 'run-preproduction-iron-pot-star' },
    { force: forceLock }
  );
  if (!lockResult.acquired) {
    const h = lockResult.holder || {};
    console.error('');
    console.error('⛔ '.repeat(20));
    console.error('【禁止重复启动】已有预生产流程正在运行:');
    console.error(`   持有者 PID: ${h.pid}`);
    console.error(`   主题: ${h.title || '未知'}`);
    console.error(`   启动于: ${h.started_at || '未知'}`);
    console.error('');
    console.error('   处理建议:');
    console.error(`     1. 等待该流程完成，或人工确认后 kill ${h.pid}`);
    console.error('     2. 若确认是僵尸进程（PID 已不存在），重新启动即可自动接管失效锁');
    console.error('     3. 确需强制接管活进程: STORMAXE_FORCE_RUN=1 node run-preproduction-iron-pot-star.js ...（危险，慎用）');
    console.error('⛔ '.repeat(20));
    process.exit(1);
  }
  if (lockResult.tookOverStale) {
    console.log(`   ♻️ 已接管失效锁（原持有者 PID=${lockResult.previousHolder?.pid} 已退出）`);
  }
  if (lockResult.forcedOverLiveHolder) {
    console.warn(`   ⚠️ STORMAXE_FORCE_RUN=1 强制接管锁！原持有者 PID=${lockResult.previousHolder?.pid} 仍存活，请确认这是你有意为之`);
  }
  console.log(`   🔒 单实例锁已获取 (PID=${process.pid})`);

  // 【v2.1.13-fix】Step 0.5: 确认服务器健康自检（防旧实例密钥/版本漂移）
  // 背景：07-19 事故中，16 小时前启动的旧确认服务器持有轮换前的旧密钥，
  // 签出的确认被新主流程验签拒绝，流程空转至被杀，用户被迫二次确认。
  // 自检失败不阻断主流程（human-confirm.js 手工确认通道不受影响），只警告。
  try {
    const { spawnSync } = require('child_process');
    const ensure = spawnSync(
      process.execPath,
      [path.join(__dirname, 'scripts', 'ensure-confirmation-server.js')],
      { stdio: 'inherit', timeout: 30000 }
    );
    if (ensure.status !== 0) {
      console.warn('   ⚠️ 确认服务器自检未通过，可人工运行: node scripts/ensure-confirmation-server.js');
    }
  } catch (e) {
    console.warn('   ⚠️ 确认服务器自检执行失败（不影响主流程）:', e.message);
  }

  // 任何路径退出都要释放锁（process.on('exit') 由 coordinator 注册兜底，
  // 这里在 finally 中显式释放，双保险）

  try {
    // Step 1: 清理旧数据
    console.log('🧹 Step 1: 清理旧数据...');
    const dirsToClean = ['checkpoints', 'output', 'debug_llm'];
    dirsToClean.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ 已清理: ${dir}`);
      }
    });

    // 【v2.1.12-fix】归档上一轮遗留的确认文件（confirmation-*.md / *.json）
    // 持有锁之后执行才安全：不会再误删"别的进程正在等待的确认"
    const archived = runCoordinator.archiveStaleConfirmations();
    if (archived.length > 0) {
      console.log(`   🗂️ 已归档上轮遗留确认文件 ${archived.length} 个: ${archived.join(', ')}`);
    } else {
      console.log('   ✅ 确认目录无遗留文件');
    }

    // 【v2.1.12-fix】持锁后再构建重型系统实例（未持锁进程不做任何重活）
    // ⭐ v2.1.8: 加载 LLM 引擎，供需求洞察引擎和 PRD 生成器使用
    let llmEngine = null;
    try {
      const { LLMEngine } = require('./systems/llm-reasoning-engine.js');
      llmEngine = new LLMEngine({
        model: process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6',
        timeout: 180000
      });
      console.log('[启动] LLM 引擎加载成功:', process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6');
    } catch (e) {
      console.warn('[启动] LLM 引擎加载失败:', e.message);
    }

    const agentConfig = {
      enableLLMAgents: true,
      llmTimeout: 180000,        // 180秒/镜头
      llmMaxRetries: 2,
      llmModel: process.env.STORMAXE_LLM_MODEL,
      fastModel: process.env.STORMAXE_LLM_FAST_MODEL,
      totalDeadlineMs: parseInt(process.env.STORMAXE_TOTAL_DEADLINE_MS), // 从环境变量读取
      memThresholdMB: 1800,
      promptFusionConcurrency: 1,
      checkpointDir: './checkpoints',
      enableResume: true
    };

    const system = new HyperrealitySystem({
      llmEngine, // ⭐ v2.1.9: 传入 LLM 引擎
      productionEngine: {
        agentConfig,
        charactersDir: path.join(__dirname, 'characters')
      }
    });

    // 通用 metadata，不针对特定主题
    const metadata = {
      title: title,
      target_duration: structuredTheme?.duration_sec || 45,
      has_opening: true,
      creative_intensity: structuredTheme?.creative_style || 0.72,
      style: 'CINE',
      aspect_ratio: '16:9',
      content_theme: structuredTheme?.type || '通用主题',
      // 【v2.1.15-fix 主题漂移】content_summary 默认不截断（完整意图全量传递）；
      // 如需上限可通过 STORMAXE_CONTENT_SUMMARY_MAX 配置（0=不截断）
      content_summary: (() => {
        const raw = (structuredTheme?.description || userIntent).toString();
        const cap = parseInt(process.env.STORMAXE_CONTENT_SUMMARY_MAX || '0', 10);
        return Number.isFinite(cap) && cap > 0 ? raw.substring(0, cap) : raw;
      })(),
      visual_style: structuredTheme?.visual_style || '根据主题自动推断',
      key_messages: [title]
    };

    const startTime = Date.now();

    // 【v2.1.9-防跳过机制】启动确认文件监控
    // 【v2.1.12-fix】仅在状态"变化"时打印，不再每 10 秒重复刷屏
    let monitorInterval = null;
    let lastMonitorSignature = '';
    if (gatekeeper) {
      monitorInterval = setInterval(() => {
        const statuses = gatekeeper.getAllApprovalStatus();
        const pending = statuses.filter(s => s.needsApproval);
        const signature = pending.map(s => s.step).join(',');
        if (pending.length > 0 && signature !== lastMonitorSignature) {
          for (const s of pending) {
            console.log('');
            console.log('⏳ '.repeat(15));
            console.log(`【强制暂停】${s.step} 需要人工确认`);
            console.log(`确认文件: ${s.mdPath || '已生成'}`);
            console.log('请查看确认文件并回复"确认"或"OK"');
            console.log('⏳ '.repeat(15));
            console.log('');
          }
        }
        lastMonitorSignature = signature;
      }, 10000); // 每10秒检查一次
    }

    try {
      // 【v2.1.9-强制流程】运行完整预生产链路
      // 如果 userIntent 是结构化对象，系统会直接信任用户定义
      const result = await system.create(userIntent, metadata);

      // 清理监控
      if (monitorInterval) clearInterval(monitorInterval);

      const duration = Date.now() - startTime;
      console.log('');
      console.log('='.repeat(70));
      console.log('✅ 预生产完成！');
      console.log(`总耗时: ${(duration / 1000).toFixed(1)}秒`);
      console.log(`镜头数: ${result.shots?.length || 0}`);
      console.log(`是否有片头: ${result.opening ? '是' : '否'}`);
      console.log(`降级状态: ${result.degraded ? '部分降级' : '完整生成'}`);

      // 【v2.1.12-fix】锁冲突导致的提前返回，按失败处理并给出非零退出码
      if (result.lockConflict) {
        console.error('⛔ 预生产因单实例锁冲突未执行（详见上方日志）');
        process.exitCode = 1;
        return;
      }

      // 保存完整结果
      const outputDir = path.join(__dirname, 'output', 'preproduction-v2.1.9');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, 'preproduction-result.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`结果已保存: ${outputPath}`);

      // 输出镜头概览
      if (result.shots) {
        console.log('');
        console.log('📋 镜头概览:');
        result.shots.forEach((shot, i) => {
          const isOpening = shot.sceneType === 'opening' || shot.shotId?.match(/^S?C?00/);
          console.log(`  ${isOpening ? '🎬' : '🎥'} 镜头 ${i + 1}: ${shot.shotId || 'N/A'} | ${shot.duration || '?'}秒 | ${shot.description?.substring(0, 40) || '无描述'}...`);
        });
      }

    } catch (error) {
      console.error('');
      console.error('❌ 预生产失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  } finally {
    // 【v2.1.12-fix】显式释放单实例锁（coordinator 的 exit 钩子为兜底）
    runCoordinator.releaseLock();
  }
}

runPreproduction();