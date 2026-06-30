/**
 * 全链路预生产测试脚本 v2.1.7 - 改进版
 * 支持: 预置确认、LLM超时保护、详细结果报告
 */

const path = require('path');
const fs = require('fs');
const { HyperrealitySystem } = require('../index');

// 重定向控制台输出到文件
const logFile = '/tmp/preproduction-test-output.log';
const originalLog = console.log;
const originalError = console.error;

function logToFile(...args) {
  const msg = args.join(' ') + '\n';
  fs.appendFileSync(logFile, msg);
  originalLog.apply(console, args);
}

console.log = logToFile;
console.error = (...args) => {
  const msg = args.join(' ') + '\n';
  fs.appendFileSync(logFile, msg);
  originalError.apply(console, args);
};

// 清空日志文件
fs.writeFileSync(logFile, '');
function setupPreApprovals() {
  const outputDir = path.join(__dirname, '../output/confirmations');
  
  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 清除旧的确认文件（确保测试从干净状态开始）
  ['creative-theme', 'requirement', 'prompt'].forEach(type => {
    const file = path.join(outputDir, `confirmation-${type}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  
  console.log('⏳ 模拟用户确认模式已启用');
  console.log('   系统将等待确认，测试脚本会自动在内容生成后创建确认文件');
  console.log('');
  
  // 监控并自动确认（模拟用户延迟确认）
  const checkInterval = setInterval(() => {
    const types = ['creative-theme', 'requirement', 'prompt'];
    types.forEach(type => {
      const contentFile = path.join(outputDir, `confirmation-${type}.md`);
      const confirmFile = path.join(outputDir, `confirmation-${type}.json`);
      
      // 如果内容文件存在但确认文件不存在，自动确认
      if (fs.existsSync(contentFile) && !fs.existsSync(confirmFile)) {
        console.log(`   🤖 [自动确认] 检测到 ${type} 待确认内容，3秒后自动确认...`);
        setTimeout(() => {
          fs.writeFileSync(confirmFile, JSON.stringify({
            approved: true,
            reason: 'automated-test-confirmation',
            timestamp: new Date().toISOString()
          }, null, 2));
          console.log(`   ✅ [自动确认] ${type} 已确认`);
        }, 3000);
      }
    });
  }, 2000);
  
  // 10分钟后停止监控
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log('   🛑 自动确认监控已停止');
  }, 10 * 60 * 1000);
  
  return checkInterval;
}

// 随机用户输入池
const RANDOM_INPUTS = [
  '我想拍一个医疗急救的视频，要有紧张感，时长50秒',
  '帮我生成一个硬科幻短片，关于火星殖民地的故事',
  '想要一个武侠风格的视频，主角在竹林中决斗',
  '做一个恐怖悬疑短片，发生在废弃医院里',
  '深海探险',
  '赛博朋克',
  '极限运动',
  '医疗急救，紧张压抑，50秒'
];

function getRandomInput() {
  return RANDOM_INPUTS[Math.floor(Math.random() * RANDOM_INPUTS.length)];
}

async function runPreProductionTest() {
  console.log('🚀 全链路预生产测试开始');
  console.log('版本: v2.1.7 | 模式: 预生产 (跳过渲染和后期)');
  console.log('');
  
  // 预置确认文件
  setupPreApprovals();
  
  const system = new HyperrealitySystem({
    scriptEngine: { charactersDir: './characters' },
    productionEngine: { charactersDir: './characters' },
    renderingEngine: { charactersDir: './characters' }
  });
  
  const testInput = getRandomInput();
  console.log(`📝 测试输入: "${testInput}"`);
  console.log('');
  
  const startTime = Date.now();
  let result = null;
  let timeoutReached = false;
  
  // 设置总体超时
  const TEST_TIMEOUT = 10 * 60 * 1000; // 10分钟总超时
  const timeoutId = setTimeout(() => {
    timeoutReached = true;
    console.log('\n⏰ 测试总超时 (10分钟)，强制终止');
  }, TEST_TIMEOUT);
  
  try {
    result = await system.create(testInput, {
      title: `preproduction-test-${Date.now()}`,
      projectId: `test-${Date.now()}`,
      requester: 'preproduction-test'
    }, {
      skipRender: true,
      skipPostProduction: true,
      skipRequirementList: false,
      skipPromptReview: false
    });
    
    clearTimeout(timeoutId);
    
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('\n❌ 测试失败:', err.message);
    
    // 生成错误报告
    const errorReport = {
      timestamp: new Date().toISOString(),
      input: testInput,
      error: err.message,
      stack: err.stack,
      stage: err.stage || 'unknown'
    };
    
    fs.writeFileSync('./output/preproduction-error-report.json', JSON.stringify(errorReport, null, 2));
    console.log('💾 错误报告已保存到 output/preproduction-error-report.json');
    
    process.exit(1);
  }
  
  const elapsed = Date.now() - startTime;
  
  // 生成完整报告
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('📊 全链路预生产测试报告');
  console.log('══════════════════════════════════════════');
  console.log(`测试输入: ${testInput}`);
  console.log(`测试耗时: ${(elapsed/1000).toFixed(1)}秒`);
  console.log(`整体成功: ${result.success ? '✅' : '❌'}`);
  console.log('');
  
  // 阶段报告
  console.log('📋 阶段完成状态:');
  const stages = result.stages || {};
  const stageNames = {
    creativeTheme: '🎨 创意主题生成',
    requirementList: '📋 需求清单生成',
    emotionIntent: '💫 情绪意图解析',
    script: '📖 剧本生成',
    production: '🎬 制作引擎',
    prompts: '💬 提示词生成',
    promptReview: '🔍 提示词审核'
  };
  
  for (const [key, label] of Object.entries(stageNames)) {
    if (stages[key]) {
      const timing = stages[key].timing ? `(${(stages[key].timing/1000).toFixed(1)}s)` : '';
      console.log(`   ✅ ${label} ${timing}`);
    } else {
      console.log(`   ⏭️  ${label} (跳过/未执行)`);
    }
  }
  
  // 错误报告
  if (result.errors && result.errors.length > 0) {
    console.log('');
    console.log(`⚠️  错误 (${result.errors.length}个):`);
    result.errors.forEach((e, i) => {
      console.log(`   ${i+1}. [${e.stage}] ${e.message}`);
    });
  }
  
  // 创意主题详情
  if (stages.creativeTheme && stages.creativeTheme.data) {
    const task = stages.creativeTheme.data.tasks?.[0];
    if (task) {
      console.log('');
      console.log('🎨 创意主题详情:');
      console.log(`   类型: ${task.type}`);
      console.log(`   主题: ${task.theme}`);
      console.log(`   时长: ${task.duration_sec}秒`);
      console.log(`   难度: ${task.difficulty}`);
      console.log(`   情绪: ${task.tone}`);
    }
  }
  
  // 制作引擎结果
  if (stages.production && stages.production.shots) {
    const shots = stages.production.shots;
    console.log('');
    console.log(`🎬 生成镜头: ${shots.length}个`);
    shots.forEach((s, i) => {
      console.log(`   SC${String(i).padStart(2,'0')}: ${s.duration || '?'}s | ${s.cameraMovement || 'N/A'}`);
    });
  }
  
  // 保存完整报告
  const reportPath = './output/preproduction-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    input: testInput,
    success: result.success,
    elapsed: elapsed,
    stages: Object.keys(stages),
    errors: result.errors || [],
    creativeTheme: stages.creativeTheme?.data?.tasks?.[0] || null,
    shotCount: stages.production?.shots?.length || 0
  }, null, 2));
  console.log('');
  console.log(`💾 详细报告已保存: ${reportPath}`);
  
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log(result.success ? '✅ 全链路预生产测试通过' : '❌ 全链路预生产测试失败');
  console.log('══════════════════════════════════════════');
  
  process.exit(result.success ? 0 : 1);
}

// 运行测试
runPreProductionTest().catch(err => {
  console.error('💥 测试异常:', err);
  process.exit(1);
});
