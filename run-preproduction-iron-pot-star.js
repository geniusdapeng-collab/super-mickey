#!/usr/bin/env node
/**
 * 预生产标准入口 - SuperMickey v2.1.9
 * 基于 25字段体系
 * 完整预生产六步法执行
 * 
 * 【设计原则】此入口为通用标准入口，不针对任何特定主题硬编码
 * 主题通过命令行参数或 JSON 配置文件传入，系统通用化处理
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

/**
 * 【v2.1.9-防跳过机制】等待用户确认
 * 系统生成 .md 确认文件后，必须调用此函数暂停流程
 * 只有检测到对应的 .json 确认文件存在后，才能继续
 */
async function waitForUserConfirmation(step, stepName) {
  if (!gatekeeper) return;
  
  const status = gatekeeper.checkApprovalStatus(step);
  if (!status.needsApproval) {
    console.log(`   ✅ ${stepName}: 已确认，继续...`);
    return;
  }
  
  console.log('');
  console.log('⏳ '.repeat(20));
  console.log(`【强制暂停】${stepName}`);
  console.log(`确认文件已生成: ${status.mdPath}`);
  console.log('');
  console.log('⚠️  你必须查看确认文件并回复"确认"或"OK"');
  console.log('⚠️  AI 不得擅自创建 confirmation-${step}.json');
  console.log('');
  console.log('等待确认中...');
  console.log('⏳ '.repeat(20));
  console.log('');
  
  // 轮询等待 .json 文件出现（由用户或主会话创建）
  const maxWait = 30 * 60 * 1000; // 最多等30分钟
  const interval = 5000; // 每5秒检查一次
  let waited = 0;
  
  while (waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, interval));
    waited += interval;
    
    const check = gatekeeper.checkApprovalStatus(step);
    if (!check.needsApproval) {
      console.log(`   ✅ ${stepName}: 用户已确认，继续流程`);
      return;
    }
    
    if (waited % 60000 === 0) {
      console.log(`   ⏳ 已等待 ${waited / 60000} 分钟...`);
    }
  }
  
  throw new Error(`${stepName} 等待超时（30分钟），流程终止`);
}

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

// 环境变量配置
process.env.STORMAXE_LLM_MODEL = process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
process.env.STORMAXE_LLM_FAST_MODEL = process.env.STORMAXE_LLM_FAST_MODEL || 'kimi-k2p6';
// 【v2.1.9-fix】总预算 60 分钟（3600 秒），支持通过环境变量覆盖
process.env.STORMAXE_TOTAL_DEADLINE_MS = process.env.STORMAXE_TOTAL_DEADLINE_MS || '3600000';

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
    title = userIntent.split('，')[0].substring(0, 20) || '未命名主题';
  }
  
  console.log('🔥 [HyperrealitySystem v2.1.9] 通用预生产启动');
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

  // 通用 metadata，不针对特定主题
  const metadata = {
    title: title,
    target_duration: structuredTheme?.duration_sec || 45,
    has_opening: true,
    creative_intensity: structuredTheme?.creative_style || 0.72,
    style: 'CINE',
    aspect_ratio: '16:9',
    content_theme: structuredTheme?.type || '通用主题',
    content_summary: (structuredTheme?.description || userIntent).toString().substring(0, 100),
    visual_style: structuredTheme?.visual_style || '根据主题自动推断',
    key_messages: [title]
  };

  const startTime = Date.now();
  
  // 【v2.1.9-防跳过机制】启动确认文件监控
  let monitorInterval = null;
  if (gatekeeper) {
    monitorInterval = setInterval(() => {
      const statuses = gatekeeper.getAllApprovalStatus();
      for (const s of statuses) {
        if (s.needsApproval) {
          console.log('');
          console.log('⏳ '.repeat(15));
          console.log(`【强制暂停】${s.step} 需要人工确认`);
          console.log(`确认文件: ${s.mdPath || '已生成'}`);
          console.log('请查看确认文件并回复"确认"或"OK"');
          console.log('⏳ '.repeat(15));
          console.log('');
        }
      }
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
    console.log(`总耗时: ${(duration/1000).toFixed(1)}秒`);
    console.log(`镜头数: ${result.shots?.length || 0}`);
    console.log(`是否有片头: ${result.opening ? '是' : '否'}`);
    console.log(`降级状态: ${result.degraded ? '部分降级' : '完整生成'}`);
    
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
}

runPreproduction();
