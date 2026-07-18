// v2.1.10-fix 冒烟测试 —— 验证核心修复点
const path = require('path');

console.log('=== SuperMickey v2.1.10-fix 冒烟测试 ===\n');

// 1. 旁白策略判定测试
console.log('[1/6] 旁白策略判定');
const { ScriptGenerator } = require('./hyperreality-system/engines/script-engine/core/script-generator.js');
const sg = new ScriptGenerator({ model: 'test' });

const testCases = [
  { meta: { _prd: { audioSpecification: { voicePolicy: '旁白+对白' } } }, expected: true },
  { meta: { dialogue_requirement: '需要画外音解说' }, expected: true },
  { meta: { narrative_mode: 'narration' }, expected: true },
  { meta: {}, expected: false }
];
let pass = 0;
for (const tc of testCases) {
  const result = sg._resolveVoiceoverPolicy({ metadata: tc.meta });
  if (result.allowed === tc.expected) { pass++; }
  else { console.error('  ❌ 失败:', tc.meta, '期望', tc.expected, '实际', result.allowed); }
}
console.log(`  ✅ ${pass}/${testCases.length} 通过`);

// 2. 角色归一化测试
console.log('[2/6] 角色归一化');
const parsed = {
  structure: {
    scenes: [
      { characters: ['CHAR_MESSI_OLD', 'CHAR_RONALDO_OLD'] },
      { characters: ['CHAR_MESSI_OLD'] }
    ]
  },
  character_system: { characters: [] }
};
sg._normalizeCharacters(parsed);
const cs = parsed.character_system.characters;
const hasProtagonist = cs.some(c => c.role === 'protagonist');
const hasStubs = cs.some(c => c._auto_stub);
const messiIsProtagonist = cs.find(c => c.character_id === 'CHAR_MESSI_OLD')?.role === 'protagonist';
console.log(`  角色数: ${cs.length}, 有主角: ${hasProtagonist}, 有stub: ${hasStubs}, Messi是主角: ${messiIsProtagonist}`);
console.log(`  ${hasProtagonist && hasStubs && messiIsProtagonist ? '✅ 通过' : '❌ 失败'}`);

// 3. 台词归一化测试
console.log('[3/6] 台词归一化');
const parsed2 = {
  structure: {
    scenes: [
      { dialogue: '这是一段字符串台词' },
      { dialogue: { has_dialogue: false, lines: [{ text: 'test' }], blocks: [] } },
      { narration: '游离旁白内容', characters: ['A'] }
    ]
  }
};
sg._normalizeScenesDialogue(parsed2, false);
const d0 = parsed2.structure.scenes[0].dialogue;
const d1 = parsed2.structure.scenes[1].dialogue;
const d2 = parsed2.structure.scenes[2].dialogue;
console.log(`  场景0: has_dialogue=${d0.has_dialogue}, lines=${d0.lines.length}, blocks=${d0.blocks.length}`);
console.log(`  场景1: has_dialogue=${d1.has_dialogue}, lines=${d1.lines.length}, blocks=${d1.blocks.length}`);
console.log(`  场景2: has_dialogue=${d2.has_dialogue}, lines=${d2.lines.length}, blocks=${d2.blocks.length}`);
const ok3 = d0.has_dialogue === true && d0.blocks.length > 0 && d1.has_dialogue === true && d2.has_dialogue === true && d2.blocks.length > 0;
console.log(`  ${ok3 ? '✅ 通过' : '❌ 失败'}`);

// 4. 时长强制对齐测试
console.log('[4/6] 时长强制对齐');
const parsed3 = {
  structure: {
    scenes: [
      { timing: { duration: 10 } },
      { timing: { duration: 20 } },
      { timing: { duration: 30 } }
    ]
  },
  meta: {}
};
sg._enforceTargetDuration(parsed3, 45);
const total = parsed3.structure.scenes.reduce((t, s) => t + s.timing.duration, 0);
console.log(`  目标45s, 实际${total}s, 场景时长: ${parsed3.structure.scenes.map(s => s.timing.duration).join(',')}`);
console.log(`  ${total === 45 ? '✅ 通过' : '❌ 失败'}`);

// 5. CheckpointManager 初始化测试
console.log('[5/6] Checkpoint 初始化');
const { ProductionEngine } = require('./hyperreality-system/engines/production-engine/production-engine.js');
const pe = new ProductionEngine({ checkpointDir: '/tmp/test-ckpt' });
const ckptMgr = pe._getCheckpointManager();
console.log(`  _checkpointDir: ${pe._checkpointDir}`);
console.log(`  _enableResume: ${pe._enableResume}`);
console.log(`  checkpointManager.baseDir: ${ckptMgr?.baseDir}`);
console.log(`  ${pe._checkpointDir === '/tmp/test-ckpt' && pe._enableResume === true && ckptMgr?.baseDir === '/tmp/test-ckpt' ? '✅ 通过' : '❌ 失败'}`);

// 6. 确认 TTL 测试
console.log('[6/6] 确认签名 TTL');
const { generateSignature, verifyConfirmation } = require('./scripts/confirmation-crypto.js');
const secret = process.env.HUMAN_CONFIRMATION_SECRET || 'test-secret-for-smoke';
process.env.HUMAN_CONFIRMATION_SECRET = secret;

const makeConfirm = (type, ts) => {
  const nonce = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sig = generateSignature(type, ts, nonce);
  return { type, timestamp: ts, nonce, signature: sig };
};

// 新鲜确认
const fresh = makeConfirm('creative-theme', Date.now());
const freshOk = verifyConfirmation(fresh, 'creative-theme');
// 模拟2小时前确认
const twoHoursAgo = makeConfirm('creative-theme', Date.now() - 2 * 60 * 60 * 1000);
const twoHoursOk = verifyConfirmation(twoHoursAgo, 'creative-theme');
// 模拟25小时前确认
const old = makeConfirm('creative-theme', Date.now() - 25 * 60 * 60 * 1000);
const oldOk = verifyConfirmation(old, 'creative-theme');
// 模拟未来时间戳
const future = makeConfirm('creative-theme', Date.now() + 20 * 60 * 1000);
const futureOk = verifyConfirmation(future, 'creative-theme');
console.log(`  新鲜确认: ${freshOk ? '✅通过' : '❌失败'}`);
console.log(`  2小时前: ${twoHoursOk ? '✅通过' : '❌失败'}`);
console.log(`  25小时前: ${oldOk ? '❌应失败' : '✅正确拒绝'}`);
console.log(`  未来时间: ${futureOk ? '❌应失败' : '✅正确拒绝'}`);
const ttlOk = freshOk && twoHoursOk && !oldOk && !futureOk;
console.log(`  ${ttlOk ? '✅ 全部通过' : '❌ 有失败项'}`);

console.log('\n=== 冒烟测试完成 ===');
