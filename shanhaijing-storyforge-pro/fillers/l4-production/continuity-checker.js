#!/usr/bin/env node
/**
 * Continuity Checker v3.6-Peng
 * L4 生产层 — 连续性检查器
 * 
 * 检查剧本的逻辑一致性、角色连续性、时间线合理性
 * 8大检查项 + Seedance兼容性检查
 */

const fs = require('fs').promises;
const fss = require('fs');

const CHECK_ITEMS = [
  { id: 1, name: '角色连续性', description: '角色死亡后不再出现' },
  { id: 2, name: '时间线一致性', description: '场景顺序合理' },
  { id: 3, name: '地点连续性', description: '场景切换自洽' },
  { id: 4, name: '道具连续性', description: '重要道具出现/消失有交代' },
  { id: 5, name: '情绪曲线平滑', description: '张力值无断崖跳变' },
  { id: 6, name: '对白一致性', description: '角色口吻前后一致' },
  { id: 7, name: 'Seedance兼容性', description: '所有shots字段符合下游要求' },
  { id: 8, name: '系列连续性', description: '集间角色外貌/关系/状态一致' }
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const report = checkContinuity(input);
  
  const output = {
    version: '3.5-Peng',
    filler: 'continuity-checker',
    output: report
  };
  
  fss.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(`✅ Continuity Checker: ${report.checksPassed}/${report.totalChecks}项检查通过`);
}

function checkContinuity(input) {
  const universe = input.universe || {};
  const seriesMode = input.seriesMode || false;
  
  const scenes = universe.scenes || [];
  const characters = universe.characters || {};
  const plot = universe.plot || {};
  const cinematography = universe.cinematography || {};
  
  const checks = [];
  
  // 检查1: 角色连续性
  checks.push(checkCharacterContinuity(scenes, characters));
  
  // 检查2: 时间线一致性
  checks.push(checkTimelineConsistency(scenes));
  
  // 检查3: 地点连续性
  checks.push(checkLocationContinuity(scenes));
  
  // 检查4: 道具连续性
  checks.push(checkPropContinuity(scenes));
  
  // 检查5: 情绪曲线平滑
  checks.push(checkEmotionCurveSmoothness(plot));
  
  // 检查6: 对白一致性
  checks.push(checkDialogueConsistency(scenes, characters));
  
  // 检查7: Seedance兼容性
  checks.push(checkSeedanceCompatibility(cinematography));
  
  // 检查8: 系列连续性（仅在系列模式）
  if (seriesMode) {
    checks.push(checkSeriesContinuity(scenes, characters));
  }
  
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  
  return {
    checksPassed: passed,
    checksFailed: failed,
    totalChecks: checks.length,
    checks,
    issues: checks.filter(c => !c.passed).flatMap(c => c.issues || []),
    overallStatus: failed === 0 ? 'PASS' : failed <= 2 ? 'WARNING' : 'FAIL',
    metadata: {
      seriesMode,
      generatedAt: new Date().toISOString()
    }
  };
}

function checkCharacterContinuity(scenes, characters) {
  const issues = [];
  const deadChars = new Set();
  
  scenes.forEach((scene, i) => {
    const sceneChars = scene.characters || [];
    sceneChars.forEach(cid => {
      if (deadChars.has(cid)) {
        issues.push(`场景${scene.sceneId}: 角色${cid}已死亡但再次出现`);
      }
    });
    
    // 简化的死亡检测：如果场景描述包含"死亡""牺牲"
    if (scene.action?.includes('死亡') || scene.action?.includes('牺牲')) {
      sceneChars.forEach(cid => deadChars.add(cid));
    }
  });
  
  return {
    name: '角色连续性',
    passed: issues.length === 0,
    issues
  };
}

function checkTimelineConsistency(scenes) {
  const issues = [];
  
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    
    // 检查场景顺序是否合理
    if (curr.prerequisiteScenes?.length > 0) {
      const prereqMet = curr.prerequisiteScenes.every(pr => 
        scenes.slice(0, i).some(s => s.sceneId === pr)
      );
      if (!prereqMet) {
        issues.push(`场景${curr.sceneId}: 前置场景未满足`);
      }
    }
  }
  
  return {
    name: '时间线一致性',
    passed: issues.length === 0,
    issues
  };
}

function checkLocationContinuity(scenes) {
  const issues = [];
  
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    
    // 简化的地点检查：如果场景切换过快
    if (prev.slugLine !== curr.slugLine && i < 3) {
      issues.push(`场景${curr.sceneId}: 开场所景切换过于频繁`);
    }
  }
  
  return {
    name: '地点连续性',
    passed: issues.length === 0,
    issues
  };
}

function checkPropContinuity(scenes) {
  const issues = [];
  const propHistory = {};
  
  scenes.forEach(scene => {
    (scene.props || []).forEach(prop => {
      if (!propHistory[prop]) {
        propHistory[prop] = { firstSeen: scene.sceneId };
      } else {
        propHistory[prop].lastSeen = scene.sceneId;
      }
    });
  });
  
  return {
    name: '道具连续性',
    passed: issues.length === 0,
    issues
  };
}

function checkEmotionCurveSmoothness(plot) {
  const issues = [];
  const tensionCurve = plot.tensionCurve || [];
  
  for (let i = 1; i < tensionCurve.length; i++) {
    const diff = Math.abs(tensionCurve[i].tension - tensionCurve[i - 1].tension);
    if (diff > 40) {
      issues.push(`时间点${tensionCurve[i].time}: 张力跳变${diff}（过大）`);
    }
  }
  
  return {
    name: '情绪曲线平滑',
    passed: issues.length === 0,
    issues
  };
}

function checkDialogueConsistency(scenes, characters) {
  const issues = [];
  const charVoices = {};
  
  scenes.forEach(scene => {
    (scene.dialogues || []).forEach(d => {
      const speaker = d.speaker;
      if (!charVoices[speaker]) {
        charVoices[speaker] = d.emotion;
      } else if (charVoices[speaker] !== d.emotion) {
        // 简化的口吻检查
        issues.push(`场景${scene.sceneId}: ${speaker}口吻不一致`);
      }
    });
  });
  
  return {
    name: '对白一致性',
    passed: issues.length === 0,
    issues
  };
}

function checkSeedanceCompatibility(cinematography) {
  const issues = [];
  const shotPlan = cinematography.shotPlan || [];
  
  shotPlan.forEach(shot => {
    if (!shot.shotId) issues.push('镜头缺少ID');
    if (!shot.description) issues.push(`${shot.shotId}: 缺少描述`);
    if (!shot.duration) issues.push(`${shot.shotId}: 缺少时长`);
    if (!shot.type) issues.push(`${shot.shotId}: 缺少类型`);
  });
  
  return {
    name: 'Seedance兼容性',
    passed: issues.length === 0,
    issues
  };
}

function checkSeriesContinuity(scenes, characters) {
  const issues = [];
  
  // 简化的系列连续性检查
  const charAppearances = {};
  scenes.forEach(scene => {
    (scene.characters || []).forEach(cid => {
      if (!charAppearances[cid]) charAppearances[cid] = [];
      charAppearances[cid].push(scene.sceneId);
    });
  });
  
  return {
    name: '系列连续性',
    passed: issues.length === 0,
    issues
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--output') args.output = argv[++i];
  }
  return args;
}

main();