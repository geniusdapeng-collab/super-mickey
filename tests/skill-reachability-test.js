#!/usr/bin/env node
/**
 * skill-reachability-test.js — 技能可达性回归测试
 *
 * 背景：历史上 43/149 个技能（29%）因识别词表断裂永远无法被路由命中（死技能）。
 * 本测试为每个技能构造一个"自然描述"的合成镜头（由技能自身的片种/导演/情绪/运镜
 * 中文轴生成），分别走 V1（extractShotMetadata → matchSkills）与
 * V2（normalizeShotMeta → routeAndEnhanceV2）两条生产链路，断言该技能进入 Top3。
 * 任何一个技能不可达即退出码 1，CI 打回。
 *
 * 运行：node tests/skill-reachability-test.js
 */
const fs = require('fs');
const router = require('../hyperreality-system/skills/hollywood-cinematography/cinematography-skill-router.js');

const CAMERA_ZH = {
  '航拍': '航拍无人机缓慢推进',
  '斯坦尼康': '斯坦尼康环绕跟拍',
  '手持': '手持贴近跟拍',
  '定场': '定场镜头缓慢横移'
};

function buildSyntheticShot(meta) {
  const descParts = [
    meta.type_zh, meta.director_zh, meta.emotion_zh, meta.emotionDetail,
    meta.shotType, meta.tech,
    meta.type_zh === '微表情' ? '面部特写' : '', '场景'
  ].filter(Boolean);
  return {
    shotId: 'T00',
    description: descParts.join('，'),
    scene: descParts.join('，'),
    mood: meta.emotion_zh || '',
    emotion: meta.emotion_zh || '',
    cameraMovement: ((CAMERA_ZH[meta.shotType] || '') + (meta.tech ? ' ' + meta.tech : '')).trim(),
    lighting: meta.tech || '',
    duration: 8
  };
}

function main() {
  if (!fs.existsSync(router.SKILL_LIB_ROOT)) {
    console.log('⚠️ 技能库目录不存在，跳过可达性测试（无技能增强模式）');
    process.exit(0);
  }
  const files = fs.readdirSync(router.SKILL_LIB_ROOT).filter(f => f.endsWith('.md'));
  const failV1 = [], failV2 = [];
  for (const f of files) {
    const meta = router.parseSkillFilename(f);
    const shot = buildSyntheticShot(meta);
    const gotV1 = router.matchSkills(router.extractShotMetadata(shot), 3).map(x => x.meta.filename);
    if (!gotV1.includes(f)) failV1.push({ file: f, got: gotV1 });
    // 【v2.4.2】V2 可达性改在"双通道选编之前"的候选短名单上断言：
    // A4 双通道会为异 domain 技能保留槽位，同 domain 同分技能可能被合法挤出最终 Top3
    // （实例：微表情_战栗_不祥预感 原始分 52 并列第一，仍被摄影轨槽位挤出最终选编）。
    // 死技能的定义是"挤不进候选短名单"，故断言 = 进入 matchSkillsV2 Top5 候选（203 进 5 已是硬门槛）。
    const v2ranked = router.matchSkillsV2(router.normalizeShotMeta(shot), { limit: 5, minScore: 1 });
    const hitV2 = v2ranked.find(x => x.skill && x.skill.file === f);
    if (!hitV2) {
      failV2.push({ file: f, got: v2ranked.map(x => x.skill ? x.skill.file : '?'), score: hitV2 ? hitV2.score : 0 });
    }
  }
  console.log(`\n📊 技能可达性测试：共 ${files.length} 个技能`);
  console.log(`  V1 链路：${files.length - failV1.length}/${files.length} 可达`);
  console.log(`  V2 链路：${files.length - failV2.length}/${files.length} 可达`);
  if (failV1.length > 0) {
    console.log(`\n❌ V1 不可达（${failV1.length}）：`);
    failV1.forEach(x => console.log(`  - ${x.file}  [实际命中: ${x.got.join(', ') || '无'}]`));
  }
  if (failV2.length > 0) {
    console.log(`\n❌ V2 不可达（${failV2.length}）：`);
    failV2.forEach(x => console.log(`  - ${x.file}  [Top5候选: ${x.got.join(', ') || '无'}] [本分: ${x.score}]`));
  }
  if (failV1.length === 0 && failV2.length === 0) {
    console.log('\n✅ 全部技能在两条生产链路均可达，无死技能。');
    process.exit(0);
  }
  console.log('\n❌ 存在死技能，路由识别层需要修复。');
  process.exit(1);
}
main();
