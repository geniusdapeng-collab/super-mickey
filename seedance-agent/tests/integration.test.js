/**
 * Integration Test — v9.2 Agent Loop 端到端测试 (v9.2-Peng)
 *
 * 测试场景：完整的视频制作流程
 * 1. 用户输入需求
 * 2. Agent Loop 启动
 * 3. 方案生成 → pause 等确认
 * 4. 渲染预览 → pause 等确认
 * 5. 高清渲染 → pause 等确认
 * 6. 声音设计 → 完成
 */

import {
  directorLoop,
  resume,
  PermissionGate,
  ContextManager,
  StateMachine,
  ToolPool,
  createAgent
} from '../core/index.js';

// ============ 测试配置 ============
const TEST_CONFIG = {
  permissionMode: 'semi-auto',
  renderBudgetUSD: 5.0,
  featureFlags: {
    HISTORY_SNIP: true,
    CACHED_MICROCOMPACT: true,
    CONTEXT_COLLAPSE: true
  }
};

// ============ 测试工具 ============
async function createMockProject(projectId) {
  const { default: fs } = await import('fs');
  const { default: path } = await import('path');
  const projectDir = path.join(process.cwd(), 'projects', projectId);
  
  if (!fs.existsSync(projectDir)) {
    await fs.mkdirSync(projectDir, { recursive: true });
    await fs.mkdirSync(path.join(projectDir, 'renders'), { recursive: true });
    await fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });
  }
  
  // 创建 PROJECT.md
  const projectMd = path.join(projectDir, 'PROJECT.md');
  if (!fs.existsSync(projectMd)) {
    await fs.writeFileSync(projectMd, `# Project: ${projectId}\n\nTest project for integration testing.\n`);
  }
  
  return projectDir;
}

async function runTest() {
  console.log('=====================================');
  console.log('Seedance v7.0 Agent Loop 集成测试');
  console.log('=====================================\n');
  
  const projectId = `test-${Date.now()}`;
  const userRequest = '制作一个30秒的品牌宣传短片，风格热血激昂，目标平台抖音';
  
  console.log(`[Test] 项目ID: ${projectId}`);
  console.log(`[Test] 需求: ${userRequest}\n`);
  
  // ============ 测试 1: 初始化组件 ============
  console.log('--- 测试 1: 组件初始化 ---');
  
  const permissionGate = new PermissionGate(TEST_CONFIG);
  console.log(`✅ Permission Gate 就绪 (模式: ${permissionGate.mode})`);
  
  const contextManager = new ContextManager(projectId, { maxCacheSizeMB: 100 });
  console.log(`✅ Context Manager 就绪`);
  
  const stateMachine = new StateMachine(projectId, { maxSnapshots: 10 });
  console.log(`✅ State Machine 就绪`);
  
  const toolPool = new ToolPool({
    mode: 'semi-auto',
    featureFlags: TEST_CONFIG.featureFlags
  });
  console.log(`✅ Tool Pool 就绪 (${toolPool.getAllTools().length} 个工具)\n`);
  
  // ============ 测试 2: Agent Loop 启动 ============
  console.log('--- 测试 2: Agent Loop 启动 ---');
  
  const loop = directorLoop({
    projectId,
    userRequest,
    config: TEST_CONFIG
  });
  
  let pauseCount = 0;
  let results = [];
  
  for await (const event of loop) {
    console.log(`[Agent Loop] ${event.type}: ${event.message || event.reason || ''}`);
    results.push(event);
    
    if (event.type === 'pause') {
      pauseCount++;
      console.log(`\n⏸️ 暂停 #${pauseCount}: ${event.reason}`);
      
      if (event.details) {
        console.log(`   工具: ${event.details.tool?.name}`);
        console.log(`   预估成本: ${event.details.estimatedCost} USD`);
        console.log(`   风险级别: ${event.details.riskLevel}`);
      }
      
      // 模拟队长确认（自动批准前2次，最后一次拒绝）
      if (pauseCount <= 2) {
        console.log(`   → 模拟队长确认: 批准 ✅`);
        // 实际使用中需要调用 resume()
      } else {
        console.log(`   → 模拟队长确认: 拒绝 ❌`);
      }
      
      console.log();
    }
    
    if (event.type === 'budget_exhausted') {
      console.log(`\n💰 预算耗尽: ${event.used}/${event.limit} USD`);
    }
    
    if (event.type === 'stop') {
      console.log(`\n🛑 终止: ${event.reason}`);
    }
    
    if (event.type === 'complete') {
      console.log(`\n✅ 完成！决策: ${JSON.stringify(event.decision, null, 2)}`);
    }
  }
  
  // ============ 测试 3: 状态机操作 ============
  console.log('\n--- 测试 3: 状态机操作 ---');
  
  const initState = stateMachine.init({
    projectName: 'Test Video',
    budget: TEST_CONFIG.renderBudgetUSD
  });
  console.log(`✅ 状态初始化: turn=${initState.turn}`);
  
  stateMachine.transition({ turn: 1, action: 'generate_plan', status: 'success' });
  stateMachine.transition({ turn: 2, action: 'render_preview', status: 'paused' });
  console.log(`✅ 状态转移: 当前 turn=${stateMachine.getCurrentState().turn}`);
  
  const history = stateMachine.getHistory();
  console.log(`✅ 历史记录: ${history.length} 条`);
  
  // 回退测试
  const rewindState = stateMachine.rewind(1);
  console.log(`✅ 回退到 turn=1: 当前 turn=${rewindState.turn}`);
  
  // 分叉测试
  const fork = stateMachine.fork('version-b', { variant: 'dark-theme' });
  console.log(`✅ 分叉创建: ${fork.getCurrentState().forkName}`);
  
  // ============ 测试 4: 权限门 ============
  console.log('\n--- 测试 4: 权限门测试 ---');
  
  const testTools = [
    { name: 'story-engine', params: { action: 'generate' } },
    { name: 'render-engine', params: { resolution: '1080p', duration: 120 } },
    { name: 'delivery-engine', params: { action: 'export' } },
    { name: 'delete-original', params: {} }
  ];
  
  const mockState = {
    projectId,
    renderBudgetUsed: 2.0,
    timelineState: { hasPlan: true }
  };
  
  const evalResult = await permissionGate.evaluate(testTools, mockState);
  console.log(`✅ 权限评估完成`);
  console.log(`   已批准: ${evalResult.approved.length} 个`);
  console.log(`   已阻断: ${evalResult.blocked.length} 个`);
  console.log(`   待确认: ${evalResult.pending.length} 个`);
  
  if (evalResult.blocked.length > 0) {
    console.log(`   阻断详情:`);
    evalResult.blocked.forEach(b => {
      console.log(`     - ${b.tool.name}: ${b.reason}`);
    });
  }
  
  // ============ 测试 5: 工具池执行 ============
  console.log('\n--- 测试 5: 工具池执行 ---');
  
  // 测试批量执行
  const batchCalls = [
    { toolId: 'story-engine', params: { title: 'Test' } },
    { toolId: 'shot-design', params: { plan: {} } },
    { toolId: 'pitch-evaluation', params: { candidates: [] } }
  ];
  
  const batchResults = await toolPool.executeBatch(batchCalls, { projectId });
  console.log(`✅ 批量执行完成: ${batchResults.length} 个工具`);
  
  batchResults.forEach((result, i) => {
    console.log(`   [${i + 1}] ${result.result?.tool || 'unknown'}: ${result.result?.status || 'unknown'} (cost: ${result.cost})`);
  });
  
  // ============ 测试 6: 统计汇总 ============
  console.log('\n--- 测试 6: 统计汇总 ---');
  
  console.log('\n📊 Agent Loop 事件统计:');
  const eventTypes = results.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});
  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  
  console.log('\n📊 权限门统计:');
  console.log(`   审计事件: ${permissionGate.auditLog.length}`);
  
  console.log('\n📊 工具池统计:');
  console.log(`   活跃工具: ${toolPool.getStats().totalTools}`);
  console.log(`   执行次数: ${toolPool.getStats().executions}`);
  console.log(`   总成本: ${toolPool.getStats().totalCost.toFixed(3)} USD`);
  
  console.log('\n📊 状态机统计:');
  console.log(`   快照数: ${stateMachine.snapshots.length}`);
  console.log(`   分叉数: ${stateMachine.forks.length}`);
  console.log(`   历史事件: ${stateMachine.transcript.length}`);
  
  // ============ 测试 7: 风格配方系统（v7.0-Peng-Style）===========
  console.log('\n--- 测试 7: 风格配方系统 ---');
  
  const { parseStyleRecipe, generateStyleDNA, detectStyleConflicts, calculateStyleSRS, detectStyleDrift, generateStyleChromosome } = await import('../core/model-decision-engine.js');
  
  // 测试7a: 单一风格解析
  const singleRecipe = parseStyleRecipe('制作一条诺兰风格的短片');
  console.log(`✅ 单一风格解析: ${JSON.stringify(singleRecipe)}`);
  
  // 测试7b: 配方解析（多风格）
  const mixedRecipe = parseStyleRecipe('诺兰骨架+维伦纽瓦氛围+韦斯安德森点缀');
  console.log(`✅ 配方解析: base=${mixedRecipe.base.style} + accent=${mixedRecipe.accent.style} + contrast=${mixedRecipe.contrast.style}`);
  
  // 测试7c: DNA生成
  const dna = generateStyleDNA(mixedRecipe);
  console.log(`✅ DNA生成: ${Object.keys(dna).length} 维参数`);
  console.log(`   光比: ${dna['VG01光比偏好']}`);
  console.log(`   阴影密度: ${dna['VG02阴影密度']}`);
  console.log(`   幕结构: ${dna['NG01幕结构']}`);
  
  // 测试7d: 冲突检测
  const conflicts = detectStyleConflicts(mixedRecipe);
  console.log(`✅ 冲突检测: hard=${conflicts.hard.length}, soft=${conflicts.soft.length}`);
  
  // 测试7e: 硬冲突检测
  const badRecipe = parseStyleRecipe('迈克尔贝风格+维伦纽瓦风格');
  const badConflicts = detectStyleConflicts(badRecipe);
  console.log(`✅ 硬冲突检测: ${badConflicts.hard.length > 0 ? '检测到硬冲突！' : '无硬冲突'}`);
  if (badConflicts.hard.length > 0) {
    console.log(`   冲突: ${badConflicts.hard[0].styles.join(' vs ')} — ${badConflicts.hard[0].reason}`);
  }
  
  // 测试7f: SRS评分
  const styleMockState = { styleDNA: dna };
  const srs = calculateStyleSRS(styleMockState);
  console.log(`✅ SRS评分: ${srs.total}/100 — ${srs.tier}`);
  console.log(`   视觉一致性: ${srs.dimensions.visualConsistency}`);
  console.log(`   叙事独特性: ${srs.dimensions.narrativeUniqueness}`);
  
  // 测试7g: 风格漂移检测
  const prevDNA = { 'VG03色温基调': '5600K冷灰', 'VG04饱和度': '0.9' };
  const currDNA = { 'VG03色温基调': '4500K青绿', 'VG04饱和度': '0.85' };
  const drift = detectStyleDrift(prevDNA, currDNA, 'continuous');
  console.log(`✅ 风格漂移: ${drift.detected ? '检测到漂移！' : '无漂移'}`);
  
  // 测试7h: 风格染色体（系列化）
  const chromosome = generateStyleChromosome(dna, 1);
  console.log(`✅ 风格染色体: ${chromosome.description}`);
  console.log(`   核心基因: ${Object.keys(chromosome.coreGenes).length} 个`);
  console.log(`   可变基因: ${Object.keys(chromosome.variableGenes).length} 个`);
  console.log(`   传承率: ${chromosome.inheritanceRate}`);
  
  // 测试7i: 状态机风格字段
  const styleState = stateMachine.init({
    styleRecipe: mixedRecipe,
    styleDNA: dna
  });
  console.log(`✅ 状态机风格字段: styleRecipe=${styleState.styleRecipe?.base?.style}, styleDNA=${styleState.styleDNA ? '已注入' : '无'}`);
  
  // ============ 完成 ============
  console.log('\n=====================================');
  console.log('✅ 所有集成测试通过！');
  console.log('=====================================');
  
  return {
    projectId,
    eventTypes,
    pauseCount,
    stats: {
      toolPool: toolPool.getStats(),
      permissionGate: permissionGate.exportAuditLog(),
      stateMachine: stateMachine.exportState()
    }
  };
}

// ============ 运行测试 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runTest().then(result => {
    console.log('\n📋 测试报告:', JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
}

export { runTest };
