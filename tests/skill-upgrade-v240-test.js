#!/usr/bin/env node
/**
 * skill-upgrade-v240-test.js — A4/A5/A6/B1/B2 升级项回归测试
 *
 * 覆盖：
 *   A4 主体门控（无脸镜头禁注演技技能）+ 双通道编制（1演技+1摄影）
 *   A5 运镜冲突表（航拍镜头禁配手持/斯坦尼康技能）
 *   A6 时间轴按时长缩放
 *   B1 结构化编译产物加载（含质检块/分级/强度区间）
 *   B2 LLM 语义路由（caller 命中走 v3，异常降级 v2）
 *
 * 运行：node tests/skill-upgrade-v240-test.js
 */
const router = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-skill-router.js');

let failures = [];
const assert = (c, m) => { if (!c) failures.push(m); };

// ===== A4-1 主体门控：无脸镜头禁注演技 =====
const faceless = { shotId: 'F1', description: '乐器随椅子滑向船舷，水面反光', mood: '哀伤', cameraMovement: '缓推' };
const planF = router.routeAndEnhanceV2([faceless], { minScore: 5, maxSkillsPerShot: 2, assignedDirector: '斯皮尔伯格', filmGenre: 'drama' });
const fMatched = planF.get('F1').matched;
assert(!fMatched.some(m => m.domain === 'acting'), `A4 无脸镜头不应命中演技技能，实际: ${fMatched.map(m => m.file).join(',')}`);

// ===== A4-2 双通道：有人物镜头应 1演技+1摄影 编制 =====
const person = { shotId: 'P1', description: '女人对着电脑打字，一滴眼泪滑过面颊，她的手指没有停', mood: '哀伤', cameraMovement: '手持贴近' };
const planP = router.routeAndEnhanceV2([person], { minScore: 5, maxSkillsPerShot: 2, assignedDirector: '斯皮尔伯格', filmGenre: 'drama' });
const pMatched = planP.get('P1').matched;
const domains = pMatched.map(m => m.domain);
assert(domains.includes('acting'), 'A4 有人物特写镜头应命中演技技能');
assert(domains.includes('cinematography'), 'A4 双通道应同时保留摄影技能（不再被演技挤占）');

// ===== A5 运镜冲突：航拍镜头禁配手持/斯坦尼康 =====
const aerial = { shotId: 'A1', description: '航拍热气球群升起在帝王谷上空，日出金光铺满大地', mood: '壮丽', cameraMovement: '航拍环绕' };
const planA = router.routeAndEnhanceV2([aerial], { minScore: 5, maxSkillsPerShot: 2, assignedDirector: '维伦纽瓦', filmGenre: 'documentary' });
const aMatched = planA.get('A1').matched;
assert(!aMatched.some(m => /手持/.test(m.file)), `A5 航拍镜头不应配手持技能: ${aMatched.map(m => m.file).join(',')}`);
assert(!aMatched.some(m => /斯坦尼康/.test(m.file)), `A5 航拍镜头不应配斯坦尼康技能: ${aMatched.map(m => m.file).join(',')}`);

// ===== A6 时间轴缩放 =====
const scaled = router.scaleSkillTimeline('0-3秒假象，3-5秒压强，5-7秒决堤，7-10秒流淌', 5);
assert(/0\.0-1\.5秒/.test(scaled) && /3\.5-5\.0秒/.test(scaled), `A6 时间轴应按比例缩放到5秒，实际: ${scaled}`);

// ===== B1 结构化编译产物 =====
const qc = router.getSkillQCBlocks(['微表情_压抑悲伤_无声落泪.md']);
assert(qc.length === 1 && qc[0].qc.length >= 5, `B1 编译产物应携带质检清单，实际 ${qc[0] ? qc[0].qc.length : 0} 条`);
const viol = router.checkSkillCompliance('配乐渲染的悲伤场面，慢镜眼泪特写', qc[0]);
assert(viol.length >= 2, `B3 机械合规应检出禁止词残留，实际 ${JSON.stringify(viol)}`);

// ===== B2 LLM 语义路由 =====
(async () => {
  const shots = [
    { shotId: 'L1', description: '火星尘暴中地质学家爬行，面罩结霜', mood: '窒息', cameraMovement: '手持贴近' },
    { shotId: 'L2', description: '避难舱轮廓在尘暴中若隐若现', mood: '希望', cameraMovement: '推进' }
  ];
  // mock caller：永远选第一个候选
  const mockCaller = async (prompt) => {
    const m = prompt.match(/\d+\.\s(\S+\.md)/);
    return { picks: [{ file: m[1], reason: 'mock：语义最贴' }] };
  };
  const planV3 = await router.routeAndEnhanceV3(shots, { minScore: 5, maxSkillsPerShot: 2, assignedDirector: '维伦纽瓦', filmGenre: 'sci-fi', llmCaller: mockCaller });
  assert(planV3.get('L1').router === 'v3-llm', `B2 有 caller 时应走 v3-llm，实际 ${planV3.get('L1').router}`);
  assert(planV3.get('L1').matched[0].llmReason === 'mock：语义最贴', 'B2 LLM 理由应透传');

  // 异常 caller：应静默降级 v2
  const badCaller = async () => { throw new Error('LLM 挂了'); };
  const planV2 = await router.routeAndEnhanceV3(shots, { minScore: 5, maxSkillsPerShot: 2, assignedDirector: '维伦纽瓦', filmGenre: 'sci-fi', llmCaller: badCaller });
  assert(planV2.get('L1').router === 'v2-score', `B2 caller 异常应降级 v2-score，实际 ${planV2.get('L1').router}`);
  assert(planV2.get('L1').matched.length > 0, 'B2 降级后仍应有匹配结果');

  // ===== 报告 =====
  console.log('\n📊 v2.4.0 升级项回归报告');
  console.log(`  A4 主体门控: ${!failures.some(f => f.startsWith('A4')) ? '✓' : '✗'}`);
  console.log(`  A5 运镜冲突: ${!failures.some(f => f.startsWith('A5')) ? '✓' : '✗'}`);
  console.log(`  A6 时间轴缩放: ${!failures.some(f => f.startsWith('A6')) ? '✓' : '✗'}`);
  console.log(`  B1 编译产物/质检: ${!failures.some(f => f.startsWith('B1') || f.startsWith('B3')) ? '✓' : '✗'}`);
  console.log(`  B2 LLM 语义路由: ${!failures.some(f => f.startsWith('B2')) ? '✓' : '✗'}`);
  if (failures.length > 0) {
    console.log('\n❌ 未通过断言:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\n✅ v2.4.0 升级项全部通过');
})();
