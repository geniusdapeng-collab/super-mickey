#!/usr/bin/env node
/**
 * Seedance v7.1.0 Phase 0-3 端到端流水线测试
 * 不依赖渲染，覆盖：角色定妆 → 需求对齐 → 分镜生成
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = '/root/.openclaw/workspace';
const SCRIPTS = {
  characterManager: path.join(WORKSPACE, 'seedance-character-manager/scripts/character-manager.js'),
  alignmentGate: path.join(WORKSPACE, 'seedance-director/scripts/requirement-alignment-gate.js'),
  storyboard: path.join(WORKSPACE, 'seedance2-storyboard-generator/scripts/storyboard-generator.js')
};

// ============ 4个测试主题（与 script-simulator-v2 一致） ============
const TEST_CASES = [
  {
    id: 'TC01', title: '逐光者', duration: 30, style: '热血', styleRecipe: '诺兰',
    outline: '起：深夜写字楼，主角独自加班，疲惫但眼神坚定；承：回忆创业初心，闪回年轻时的梦想；转：面对重大挫折，资金链断裂，团队解散；高潮：主角在废墟中站起，重新出发，眼中燃烧不屈的火焰；合：晨光中，主角带着新团队走向远方',
    characters: '创业者',
    platform: '抖音'
  },
  {
    id: 'TC02', title: '午后时光', duration: 60, style: '治愈', styleRecipe: '韦斯安德森风格+宫崎骏氛围',
    outline: '起：小镇糖果色街道，老奶奶在花园浇花，对称构图；承：小猫跑来蹭腿，老奶奶微笑放下水壶，一起走进屋内；转：发现一张老照片，回忆年轻时的冒险；高潮：老奶奶戴上老花镜，开始讲述一个关于星空的故事；合：夕阳西下，老奶奶和小猫坐在 porch 上，画面温暖圆满',
    characters: '老奶奶,小猫',
    platform: '小红书'
  },
  {
    id: 'TC03', title: '暗房', duration: 45, style: '悬疑', styleRecipe: '大卫芬奇骨架+维伦纽瓦氛围',
    outline: '起：雨夜，废弃精神病院，冷绿色调，主角手持手电筒；承：走廊深处传来脚步声，主角屏息贴墙，发现墙上涂鸦；转：推开一扇门，发现失踪多年的妹妹坐在角落，背对镜头；高潮：妹妹缓缓转头——不是她，而是一个从未见过的陌生人；合：灯光闪烁，真相在阴影中若隐若现',
    characters: '侦探,妹妹',
    platform: 'B站'
  },
  {
    id: 'TC04', title: '破晓之舞', duration: 30, style: '热血', styleRecipe: '迈克尔贝+昆汀',
    outline: '起：街舞少年在天台热身，城市天际线为背景；承：音乐响起，开始freestyle，镜头跟随动作；转：突然出现一位神秘舞者挑战，battle开始；高潮：双人同步高难度动作，镜头360度环绕，音乐达到峰值；合：两人握手，夕阳下背影，音乐渐弱',
    characters: '街舞少年,神秘舞者',
    platform: '抖音'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

// ============ Phase 0: 角色定妆 ============
function runCharacterManager(tc, outputDir) {
  log('Phase0', `[${tc.id}] 角色定妆: ${tc.characters}`);
  const charDir = path.join(outputDir, 'characters');
  ensureDir(charDir);

  const chars = tc.characters.split(',').map(c => c.trim()).filter(Boolean);
  const results = [];

  for (const charName of chars) {
    // 推断 species
    const speciesMap = {
      '小猫': '猫', '小狗': '狗', '狐狸': '狐狸', '龙': '龙',
      '创业者': '人类', '老奶奶': '人类', '侦探': '人类', '妹妹': '人类',
      '街舞少年': '人类', '神秘舞者': '人类'
    };
    const species = speciesMap[charName] || '人类';

    const charDir = path.join(os.homedir(), 'Seedance-Characters');
    const outFile = path.join(charDir, `${charName.replace(/\s+/g, '_')}_meta.json`);
    const cmd = `node "${SCRIPTS.characterManager}" generate --name "${charName}" --species "${species}" --description "${tc.outline.substring(0, 60)}..." --style "${tc.styleRecipe}" --output "${outFile}"`;

    try {
      execSync(cmd, { cwd: WORKSPACE, encoding: 'utf8', timeout: 30000 });
      if (fs.existsSync(outFile)) {
        const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        results.push({ name: charName, status: 'ok', file: outFile });
        log('Phase0', `  ✅ ${charName}: ${data.description?.substring(0, 50) || 'generated'}...`);
      } else {
        results.push({ name: charName, status: 'warn', reason: 'output missing' });
        log('Phase0', `  ⚠️ ${charName}: 输出文件未生成`);
      }
    } catch (err) {
      results.push({ name: charName, status: 'error', reason: err.message.substring(0, 100) });
      log('Phase0', `  ❌ ${charName}: ${err.message.substring(0, 100)}`);
    }
  }

  return results;
}

// ============ Phase 2: 对齐闸机 ============
function runAlignmentGate(tc, planPath, outputDir) {
  log('Phase2', `[${tc.id}] 需求对齐闸机`);
  const reportPath = path.join(outputDir, 'alignment-report.json');

  // Step 1: 提取契约
  const extractCmd = `node "${SCRIPTS.alignmentGate}" extract --outline "${tc.outline}" --characters "${tc.characters}" --style "${tc.styleRecipe}"`;
  let contractData;
  try {
    const extractOutput = execSync(extractCmd, { cwd: WORKSPACE, encoding: 'utf8', timeout: 30000 });
    contractData = JSON.parse(extractOutput);
  } catch (err) {
    log('Phase2', `  ❌ 契约提取失败: ${err.message.substring(0, 100)}`);
    return { status: 'error', reason: 'extract failed' };
  }

  const contractFile = path.join(outputDir, 'contract.json');
  fs.writeFileSync(contractFile, JSON.stringify(contractData, null, 2));

  // Step 2: 读取 plan 内容并检查对齐
  if (!fs.existsSync(planPath)) {
    log('Phase2', `  ❌ Plan 文件不存在: ${planPath}`);
    return { status: 'error', reason: 'plan missing' };
  }

  const planContent = fs.readFileSync(planPath, 'utf8');
  const checkCmd = `node "${SCRIPTS.alignmentGate}" check --contract "${contractFile}" --content '${planContent.replace(/'/g, "'\"'\"'")}' --stage pre-render`;

  let checkResult;
  try {
    const checkOutput = execSync(checkCmd, { cwd: WORKSPACE, encoding: 'utf8', timeout: 30000 });
    checkResult = JSON.parse(checkOutput);
  } catch (err) {
    log('Phase2', `  ❌ 对齐检查失败: ${err.message.substring(0, 100)}`);
    return { status: 'error', reason: 'check failed' };
  }

  fs.writeFileSync(reportPath, JSON.stringify(checkResult, null, 2));

  const passed = checkResult.passed || checkResult.overallScore >= 40;
  log('Phase2', `  ${passed ? '✅' : '❌'} 对齐评分: ${checkResult.overallScore || 'N/A'}/100 | 通过: ${passed}`);

  return { status: passed ? 'pass' : 'fail', score: checkResult.overallScore, report: reportPath };
}

// ============ Phase 3: 分镜生成 ============
function runStoryboard(tc, planPath, outputDir) {
  log('Phase3', `[${tc.id}] 分镜生成`);
  const sbDir = path.join(outputDir, 'storyboard');
  ensureDir(sbDir);

  const cmd = `node "${SCRIPTS.storyboard}" generate --story-plan "${planPath}" --output-dir "${sbDir}"`;

  try {
    execSync(cmd, { cwd: WORKSPACE, encoding: 'utf8', timeout: 60000 });

    // 检查输出
    const files = fs.readdirSync(sbDir);
    const sbFiles = files.filter(f => f.includes('storyboard') || f.endsWith('.json'));

    if (sbFiles.length > 0) {
      log('Phase3', `  ✅ 分镜生成完成: ${sbFiles.length} 个文件`);
      return { status: 'ok', files: sbFiles.length, dir: sbDir };
    } else {
      log('Phase3', `  ⚠️ 分镜目录为空`);
      return { status: 'warn', reason: 'empty output' };
    }
  } catch (err) {
    log('Phase3', `  ❌ 分镜生成失败: ${err.message.substring(0, 150)}`);
    return { status: 'error', reason: err.message.substring(0, 150) };
  }
}

// ============ 主流程 ============
async function runPipeline() {
  console.log('========================================');
  console.log('Seedance v7.1.0 Phase 0-3 端到端流水线');
  console.log('覆盖: 角色定妆 → 需求对齐 → 分镜生成');
  console.log('========================================\n');

  const results = [];

  for (const tc of TEST_CASES) {
    const outputDir = path.join(WORKSPACE, 'projects', `pipeline-${tc.id}-${Date.now()}`);
    ensureDir(outputDir);

    console.log(`\n🎬 [${tc.id}] ${tc.title}`);
    console.log(`   📁 输出: ${outputDir}`);

    // 使用 Phase 1 已有的 plan（如果有的话）
    const existingPlan = path.join(WORKSPACE, 'projects', `sim-${tc.id}-1778860050*`, '01-story-plan.json');
    const planGlob = require('child_process').execSync(`ls -t ${existingPlan} 2>/dev/null | head -1`).toString().trim();
    let planPath;

    if (planGlob && fs.existsSync(planGlob)) {
      planPath = planGlob;
      log('Setup', `  复用 Phase 1 Plan: ${planPath}`);
    } else {
      // 如果没有，用 script-simulator 生成一个
      log('Setup', `  生成新 Plan...`);
      const simDir = path.join(outputDir, 'phase1');
      ensureDir(simDir);
      // 这里简化处理，实际可以用 script-simulator-v2 的逻辑
      planPath = path.join(simDir, '01-story-plan.json');
      // 写一个简单的 plan
      const simplePlan = {
        title: tc.title, duration: tc.duration, totalDuration: tc.duration,
        totalShots: Math.ceil(tc.duration / 4), style: tc.style, styleRecipe: { base: { style: 'nolan' } },
        shots: [], characters: tc.characters.split(',').map((c,i) => ({ name: c.trim(), role: i===0?'protagonist':'ally' })),
        outline: tc.outline, metadata: { platform: tc.platform }
      };
      fs.writeFileSync(planPath, JSON.stringify(simplePlan, null, 2));
    }

    const tcResult = {
      id: tc.id, title: tc.title, outputDir,
      phase0: runCharacterManager(tc, outputDir),
      phase2: runAlignmentGate(tc, planPath, outputDir),
      phase3: runStoryboard(tc, planPath, outputDir)
    };

    results.push(tcResult);
  }

  // ============ 汇总 ============
  console.log('\n========================================');
  console.log('📋 Phase 0-3 流水线汇总报告');
  console.log('========================================');

  let totalPass = 0;
  for (const r of results) {
    const p0Ok = r.phase0.every(c => c.status === 'ok');
    const p2Ok = r.phase2.status === 'pass';
    const p3Ok = r.phase3.status === 'ok';
    const allOk = p0Ok && p2Ok && p3Ok;
    if (allOk) totalPass++;

    console.log(`\n[${r.id}] ${r.title} ${allOk ? '✅' : '⚠️'}`);
    console.log(`  Phase 0 角色定妆: ${p0Ok ? '✅' : '❌'} (${r.phase0.length}角色)`);
    console.log(`  Phase 2 对齐闸机: ${p2Ok ? '✅' : '❌'} (评分: ${r.phase2.score || 'N/A'})`);
    console.log(`  Phase 3 分镜生成: ${p3Ok ? '✅' : '❌'} (${r.phase3.files || 0}文件)`);
  }

  console.log(`\n总测试: ${results.length} | 全通: ${totalPass} (${((totalPass/results.length)*100).toFixed(0)}%)`);
  console.log('========================================');

  return results;
}

runPipeline().catch(err => {
  console.error('流水线异常:', err);
  process.exit(1);
});
