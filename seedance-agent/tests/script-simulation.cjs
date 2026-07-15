#!/usr/bin/env node
/**
 * Seedance v7.1.0 脚本提示词流程模拟测试
 * 
 * 模拟4个不同主题的完整脚本生成流程：
 * 1. v7.0风格配方解析
 * 2. story-engine plan生成脚本
 * 3. pitch-evaluation评分
 * 4. 质量报告汇总
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = '/root/.openclaw/workspace';

// ============ 4个测试主题 ============
const TEST_CASES = [
  {
    id: 'TC01',
    title: '逐光者',
    duration: 30,
    style: '热血',
    styleRecipe: '诺兰',
    outline: '起：深夜写字楼，主角独自加班，疲惫但眼神坚定；承：回忆创业初心，闪回年轻时的梦想；转：面对重大挫折，资金链断裂，团队解散；高潮：主角在废墟中站起，重新出发，眼中燃烧不屈的火焰；合：晨光中，主角带着新团队走向远方',
    characters: '创业者',
    expected: {
      minScore: 7.5,
      styleDNA: 'nolan',
      tensionPeak: '高潮幕',
      keyMoment: '废墟中站起'
    }
  },
  {
    id: 'TC02',
    title: '午后时光',
    duration: 60,
    style: '治愈',
    styleRecipe: '韦斯安德森风格+宫崎骏氛围',
    outline: '起：小镇糖果色街道，老奶奶在花园浇花，对称构图；承：小猫跑来蹭腿，老奶奶微笑放下水壶，一起走进屋内；转：发现一张老照片，回忆年轻时的冒险；高潮：老奶奶戴上老花镜，开始讲述一个关于星空的故事；合：夕阳西下，老奶奶和小猫坐在 porch 上，画面温暖圆满',
    characters: '老奶奶,小猫',
    expected: {
      minScore: 7.5,
      styleDNA: 'anderson+miyazaki',
      tensionPeak: '转幕',
      keyMoment: '老照片回忆'
    }
  },
  {
    id: 'TC03',
    title: '暗房',
    duration: 45,
    style: '悬疑',
    styleRecipe: '大卫芬奇骨架+维伦纽瓦氛围',
    outline: '起：雨夜，废弃精神病院，冷绿色调，主角手持手电筒；承：走廊深处传来脚步声，主角屏息贴墙，发现墙上涂鸦；转：推开一扇门，发现失踪多年的妹妹坐在角落，背对镜头；高潮：妹妹缓缓转头——不是她，而是一个从未见过的陌生人；合：灯光闪烁，真相在阴影中若隐若现',
    characters: '侦探,妹妹',
    expected: {
      minScore: 7.5,
      styleDNA: 'fincher+villeneuve',
      tensionPeak: '转幕/高潮',
      keyMoment: '妹妹转头'
    }
  },
  {
    id: 'TC04',
    title: '破晓之舞',
    duration: 30,
    style: '热血',
    styleRecipe: '迈克尔贝+昆汀',
    outline: '起：街舞少年在天台热身，城市天际线为背景；承：音乐响起，开始freestyle，镜头跟随动作；转：突然出现一位神秘舞者挑战，battle开始；高潮：双人同步高难度动作，镜头360度环绕，音乐达到峰值；合：两人握手，夕阳下背影，音乐渐弱',
    characters: '街舞少年,神秘舞者',
    expected: {
      minScore: 7.5,
      styleDNA: 'bay+tarantino',
      tensionPeak: '高潮',
      keyMoment: '360度环绕battle'
    }
  }
];

// ============ 执行story-engine plan ============
function runStoryEngine(testCase) {
  const projectId = `sim-${testCase.id}-${Date.now()}`;
  const outputDir = path.join(WORKSPACE, 'projects', projectId);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const storyEnginePath = path.join(WORKSPACE, 'seedance-story-engine/scripts/story-engine.js');
  
  // 构建CLI命令
  const cmd = `node "${storyEnginePath}" plan ` +
    `--title "${testCase.title}" ` +
    `--duration ${testCase.duration} ` +
    `--outline "${testCase.outline}" ` +
    `--characters "${testCase.characters}" ` +
    `--output "${outputDir}"`;

  console.log(`\n🎬 [${testCase.id}] 执行: ${testCase.title}`);
  console.log(`   风格: ${testCase.styleRecipe} | 时长: ${testCase.duration}s`);
  
  try {
    const output = execSync(cmd, { 
      cwd: WORKSPACE,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`   ✅ story-engine 执行成功`);
    
    // 查找生成的plan文件
    const files = fs.readdirSync(outputDir);
    const planFile = files.find(f => f.includes('plan') && f.endsWith('.json'));
    
    if (planFile) {
      const planPath = path.join(outputDir, planFile);
      const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
      return { success: true, plan, planPath, outputDir };
    }
    
    return { success: false, error: '未找到plan文件', output };
  } catch (err) {
    console.error(`   ❌ story-engine 失败:`, err.message);
    return { success: false, error: err.message, stderr: err.stderr };
  }
}

// ============ 执行pitch-evaluation ============
function runPitchEvaluation(testCase, planResult) {
  if (!planResult.success) return null;

  const pitchEvalPath = path.join(WORKSPACE, 'pitch-evaluation/scripts/pitch-evaluation.js');
  
  // 构建候选方案
  const candidate = {
    id: testCase.id,
    storyPlan: planResult.plan,
    prompts: planResult.plan.shots?.map((s, i) => ({
      id: `shot-${i+1}`,
      prompt: `${s.description}。${s.camera}。光影: ${s.lighting || '自然光'}。`,
      shotRef: s.id
    })) || []
  };

  // 写入临时文件
  const inputPath = path.join(planResult.outputDir, 'candidate.json');
  fs.writeFileSync(inputPath, JSON.stringify({ candidates: [candidate] }, null, 2));

  const cmd = `node "${pitchEvalPath}" evaluate --input "${inputPath}" --output "${planResult.outputDir}" --min-score ${testCase.expected.minScore}`;

  try {
    const output = execSync(cmd, {
      cwd: WORKSPACE,
      encoding: 'utf8',
      timeout: 30000
    });
    console.log(`   ✅ pitch-evaluation 执行成功`);
    
    // 读取评分结果
    const resultFiles = fs.readdirSync(planResult.outputDir);
    const evalFile = resultFiles.find(f => f.includes('evaluation') || f.includes('result'));
    
    if (evalFile) {
      const evalPath = path.join(planResult.outputDir, evalFile);
      const evalResult = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
      return evalResult;
    }
    
    return null;
  } catch (err) {
    console.error(`   ❌ pitch-evaluation 失败:`, err.message);
    return null;
  }
}

// ============ v7.0风格配方解析（模拟） ============
function parseStyleRecipeV7(request) {
  // 简化版：基于关键词匹配
  const text = request.toLowerCase();
  const STYLE_NAMES = {
    '诺兰': 'nolan', 'nolan': 'nolan',
    '维伦纽瓦': 'villeneuve', 'villeneuve': 'villeneuve',
    '韦斯安德森': 'anderson', 'anderson': 'anderson',
    '宫崎骏': 'miyazaki', 'miyazaki': 'miyazaki',
    '大卫芬奇': 'fincher', 'fincher': 'fincher',
    '迈克尔贝': 'bay', 'bay': 'bay',
    '昆汀': 'tarantino', 'tarantino': 'tarantino'
  };

  const matched = [];
  for (const [keyword, styleId] of Object.entries(STYLE_NAMES)) {
    if (text.includes(keyword.toLowerCase())) matched.push(styleId);
  }

  const unique = [...new Set(matched)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return { base: { style: unique[0], weight: 1.0 } };
  
  return {
    base: { style: unique[0], weight: 0.6 },
    accent: unique[1] ? { style: unique[1], weight: 0.3 } : undefined,
    contrast: unique[2] ? { style: unique[2], weight: 0.1 } : undefined
  };
}

// ============ 主流程 ============
async function runSimulation() {
  console.log('========================================');
  console.log('Seedance v7.1.0 脚本提示词流程模拟测试');
  console.log('========================================');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`测试主题数: ${TEST_CASES.length}\n`);

  const results = [];

  for (const tc of TEST_CASES) {
    // Step 1: v7.0风格配方解析
    const recipe = parseStyleRecipeV7(tc.styleRecipe);
    console.log(`🎨 [${tc.id}] v7.0风格配方: ${JSON.stringify(recipe)}`);

    // Step 2: story-engine生成脚本
    const planResult = runStoryEngine(tc);
    
    // Step 3: pitch-evaluation评分
    const evalResult = runPitchEvaluation(tc, planResult);

    // Step 4: 汇总
    const result = {
      id: tc.id,
      title: tc.title,
      styleRecipe: tc.styleRecipe,
      recipe,
      planSuccess: planResult.success,
      planShots: planResult.plan?.shots?.length || 0,
      planDuration: planResult.plan?.totalDuration || 0,
      evalResult
    };

    results.push(result);

    // 输出当前结果
    if (evalResult) {
      const score = evalResult.winnerScore || evalResult.scores?.[tc.id]?.total || 0;
      const passed = evalResult.passed || score >= tc.expected.minScore;
      console.log(`\n📊 [${tc.id}] 评分结果:`);
      console.log(`   总分: ${score}/10 ${passed ? '✅ 通过' : '❌ 未通过'} (门槛: ${tc.expected.minScore})`);
      if (evalResult.scores?.[tc.id]?.dimensions) {
        const dims = evalResult.scores[tc.id].dimensions;
        console.log(`   需求对齐: ${dims['需求对齐'] || dims.requirementAlignment || 'N/A'}`);
        console.log(`   剧本质量: ${dims['剧本质量'] || dims.scriptQuality || 'N/A'}`);
        console.log(`   规范符合: ${dims['规范符合'] || dims.specCompliance || 'N/A'}`);
        console.log(`   艺术性: ${dims['艺术性'] || dims.artistry || 'N/A'}`);
      }
    } else {
      console.log(`   ⚠️ 评分未执行`);
    }
  }

  // ============ 汇总报告 ============
  console.log('\n========================================');
  console.log('📋 模拟测试汇总报告');
  console.log('========================================');

  const passed = results.filter(r => {
    const score = r.evalResult?.winnerScore || r.evalResult?.scores?.[r.id]?.total || 0;
    return score >= 7.5;
  });

  const failed = results.filter(r => {
    const score = r.evalResult?.winnerScore || r.evalResult?.scores?.[r.id]?.total || 0;
    return score < 7.5;
  });

  console.log(`\n总测试数: ${results.length}`);
  console.log(`✅ 通过: ${passed.length} (${((passed.length/results.length)*100).toFixed(0)}%)`);
  console.log(`❌ 未通过: ${failed.length}`);

  console.log('\n--- 各主题详情 ---');
  for (const r of results) {
    const score = r.evalResult?.winnerScore || r.evalResult?.scores?.[r.id]?.total || 0;
    const dims = r.evalResult?.scores?.[r.id]?.dimensions || {};
    console.log(`\n[${r.id}] ${r.title}`);
    console.log(`  风格: ${r.styleRecipe} → ${JSON.stringify(r.recipe)}`);
    console.log(`  镜头数: ${r.planShots} | 时长: ${r.planDuration}s`);
    console.log(`  评分: ${score}/10 ${score >= 7.5 ? '✅' : '❌'}`);
    if (dims['需求对齐']) {
      console.log(`  四维: 对齐${dims['需求对齐']} | 质量${dims['剧本质量']} | 规范${dims['规范符合']} | 艺术${dims['艺术性']}`);
    }
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');

  return results;
}

runSimulation().catch(console.error);
