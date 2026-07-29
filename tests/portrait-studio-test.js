'use strict';

/**
 * PortraitStudio 定妆照工作室测试
 * 覆盖：角度目录 / 角色规划分级 / 商品分支链路 / 定妆照集构建 / 双模式 / Resolver 增强
 *
 * 运行: node tests/portrait-studio-test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { PortraitStudio } = require('../hyperreality-system/engines/portrait-studio');
const { CharacterPortraitPlanner } = require('../hyperreality-system/engines/portrait-studio/character-planner');
const { ProductPortraitBranch } = require('../hyperreality-system/engines/portrait-studio/product-branch');
const { PortraitSetBuilder } = require('../hyperreality-system/engines/portrait-studio/portrait-set-builder');
const { getCharacterAnglePackage, getProductViewPackage } = require('../hyperreality-system/engines/portrait-studio/angle-catalog');
const { PortraitResolver } = require('../hyperreality-system/engines/portrait-resolver');

console.log('🧪 PortraitStudio 定妆照工作室测试\n');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ========== 测试夹具 ==========
const CHARACTERS = [
  { id: 'leishan', name: '莱桑', role: 'protagonist', isProtagonist: true, description: '14岁马赛少年，红披风，瘦高' },
  { id: 'father', name: '父亲', description: '马赛牧民，沉默坚毅' },
  { id: 'tourist', name: '游客', description: '路过的摄影师' },
  { id: 'cattle', name: '老牛', description: '家里的领头牛' }
];

const PROMPTS = [
  { prompt: '莱桑站在草原上眺望', characterRef: '莱桑' },
  { prompt: '莱桑与父亲修理栅栏', characterRef: '莱桑,父亲' },
  { prompt: '莱桑举起投石索', characterRef: '莱桑', dialogue: '莱桑：草原教了我十四年' },
  { prompt: '父亲点头示意', characterRef: '父亲' },
  { prompt: '游客举起相机', characterRef: '游客' }
];

const PRODUCTS = [
  { id: 'qw-office', name: '千问办公', category: 'AI办公软件', sellingPoints: ['一键生成PPT'], materials: ['磨砂玻璃质感UI卡片'] }
];

const VISUAL_STYLE = {
  renderStyle: '超写实CG渲染，8K画质',
  tone: '枯黄草原暖金色调',
  lighting: '低角度自然日光',
  atmosphere: '辽阔苍凉'
};

// ========== 角度目录 ==========
test('A1: 主角 8 角度包完整且按优先级排序', () => {
  const pkg = getCharacterAnglePackage('lead');
  assert.strictEqual(pkg.length, 8, '主角应有 8 个角度');
  for (let i = 1; i < pkg.length; i++) {
    assert.ok(pkg[i].priority >= pkg[i - 1].priority, '角度应按 priority 升序');
  }
  assert.ok(pkg.some(a => a.id === 'front_full'), '应含正面全身');
  assert.ok(pkg.some(a => a.id === 'face_closeup'), '应含面部特写');
});

test('A2: 配角 4 角度 / 客串 2 角度', () => {
  assert.strictEqual(getCharacterAnglePackage('supporting').length, 4);
  assert.strictEqual(getCharacterAnglePackage('cameo').length, 2);
});

test('A3: 商品固定 5 视角', () => {
  const views = getProductViewPackage();
  assert.strictEqual(views.length, 5);
  assert.deepStrictEqual(views.map(v => v.id), ['hero_45', 'front_eye', 'side_profile', 'detail_macro', 'in_context']);
});

test('A4: 未知档位回退客串包', () => {
  assert.strictEqual(getCharacterAnglePackage('nonexistent-tier').length, 2);
});

// ========== 角色规划器 ==========
test('B1: 显式主角标记 → lead，8 角度任务', () => {
  const planner = new CharacterPortraitPlanner();
  const tasks = planner.plan({ characters: CHARACTERS, prompts: PROMPTS, visualStyle: VISUAL_STYLE });
  const leishan = tasks.find(t => t.characterId === 'leishan');
  assert.ok(leishan, '莱桑任务应存在');
  assert.strictEqual(leishan.tier, 'lead');
  assert.strictEqual(leishan.angleCount, 8);
});

test('B2: 戏份驱动的配角/客串分级', () => {
  const planner = new CharacterPortraitPlanner();
  const tasks = planner.plan({ characters: CHARACTERS, prompts: PROMPTS, visualStyle: VISUAL_STYLE });
  const father = tasks.find(t => t.characterId === 'father');
  const tourist = tasks.find(t => t.characterId === 'tourist');
  assert.strictEqual(father.tier, 'supporting', '父亲 2/5 镜头应为配角');
  assert.strictEqual(tourist.tier, 'cameo', '游客 1/5 镜头应为客串');
});

test('B3: prompt 注入角色档案与视觉系统锚点', () => {
  const planner = new CharacterPortraitPlanner();
  const tasks = planner.plan({ characters: CHARACTERS, prompts: PROMPTS, visualStyle: VISUAL_STYLE });
  const leishan = tasks.find(t => t.characterId === 'leishan');
  const front = leishan.portraits.find(p => p.angle === 'front_full');
  assert.ok(front.prompt.includes('14岁马赛少年'), '应含角色档案描述');
  assert.ok(front.prompt.includes('枯黄草原暖金色调'), '应含视觉系统色调');
  assert.ok(front.prompt.includes('低角度自然日光'), '应含视觉系统光影');
  assert.ok(front.prompt.includes('anatomical consistency'), '应含一致性锁');
});

test('B4: 空角色列表安全返回空', () => {
  const planner = new CharacterPortraitPlanner();
  assert.deepStrictEqual(planner.plan({ characters: [], prompts: PROMPTS }), []);
  assert.deepStrictEqual(planner.plan({}), []);
});

// ========== 商品分支链路 ==========
test('C1: 商品任务三段式分支结构完整', () => {
  const branch = new ProductPortraitBranch();
  const tasks = branch.plan({ products: PRODUCTS, visualStyle: VISUAL_STYLE });
  assert.strictEqual(tasks.length, 1);
  const t = tasks[0];
  assert.strictEqual(t.branch, 'product-portrait-branch');
  assert.ok(t.stages.referenceSearch, '应有参考图搜索阶段');
  assert.ok(t.stages.processing, '应有处理管线阶段');
  assert.ok(t.stages.stylization, '应有风格化阶段');
});

test('C2: 参考图搜索任务含查询词与真实图硬性要求', () => {
  const branch = new ProductPortraitBranch();
  const [t] = branch.plan({ products: PRODUCTS, visualStyle: VISUAL_STYLE });
  const rs = t.stages.referenceSearch;
  assert.ok(rs.queries.length >= 2, '应至少 2 条搜索词');
  assert.ok(rs.queries[0].includes('千问办公'), '搜索词应含商品名');
  assert.ok(rs.requirements.some(r => r.includes('真实商品图')), '应强制真实商品图');
  assert.ok(rs.requirements.some(r => r.includes('官方')), '应优先官方渠道');
});

test('C3: 处理管线含抠图/白底/光影三步', () => {
  const branch = new ProductPortraitBranch();
  const [t] = branch.plan({ products: PRODUCTS, visualStyle: VISUAL_STYLE });
  const steps = t.stages.processing.pipeline.map(s => s.step);
  assert.deepStrictEqual(steps, ['matting', 'white_base', 'lighting_unify']);
  const lighting = t.stages.processing.pipeline.find(s => s.step === 'lighting_unify');
  assert.ok(lighting.instruction.includes('低角度自然日光'), '光影统一应对齐视觉系统');
});

test('C4: 风格化 5 视角且强制绑定基准图、禁止虚构', () => {
  const branch = new ProductPortraitBranch();
  const [t] = branch.plan({ products: PRODUCTS, visualStyle: VISUAL_STYLE });
  const styl = t.stages.stylization;
  assert.strictEqual(styl.referenceBinding, 'outputBaseImage', '必须绑定处理后基准图');
  assert.strictEqual(styl.portraits.length, 5);
  for (const p of styl.portraits) {
    assert.ok(p.prompt.includes('忠于实物'), `${p.viewName} prompt 应含忠于实物约束`);
    assert.ok(p.prompt.includes('磨砂玻璃质感UI卡片'), '应含材质锚点');
  }
});

// ========== 定妆照集构建器 ==========
test('D1: 定妆照集 manifest + md 双产物落地', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portrait-set-'));
  const studio = new PortraitStudio({ mode: 'auto', outputDir: tmpDir });
  const plan = studio.plan({
    characters: CHARACTERS, products: PRODUCTS, prompts: PROMPTS,
    prd: { visual_style: { render_style: VISUAL_STYLE.renderStyle, tone: VISUAL_STYLE.tone, lighting: VISUAL_STYLE.lighting } }
  });
  const set = studio.finalize(plan, { title: '马赛少年', runId: 'test-run', generatedAt: '2026-07-29T00:00:00Z' });

  assert.ok(fs.existsSync(set.manifestPath), 'manifest.json 应存在');
  assert.ok(fs.existsSync(set.docPath), '定妆照集.md 应存在');

  const manifest = JSON.parse(fs.readFileSync(set.manifestPath, 'utf8'));
  assert.strictEqual(manifest.setType, 'portrait-set');
  assert.strictEqual(manifest.stats.characterCount, 4);
  assert.strictEqual(manifest.stats.productCount, 1);
  assert.ok(manifest.stats.totalPortraits > 0);
  assert.strictEqual(manifest.visualStyleAnchor.tone, '枯黄草原暖金色调', '视觉系统锚点应入 manifest');

  const doc = fs.readFileSync(set.docPath, 'utf8');
  assert.ok(doc.includes('# 定妆照集 — 马赛少年'));
  assert.ok(doc.includes('莱桑（主角 · 8 角度）'));
  assert.ok(doc.includes('千问办公'));
  assert.ok(doc.includes('抠图') || doc.includes('主体抠图'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ========== 主引擎双模式 ==========
test('E1: interactive 模式需要确认 / auto 模式免确认', () => {
  const interactive = new PortraitStudio({ mode: 'interactive' });
  const auto = new PortraitStudio({ mode: 'auto' });
  assert.strictEqual(interactive.needsConfirmation(), true);
  assert.strictEqual(auto.needsConfirmation(), false);
});

test('E2: spec 执行产出规格包且任务保持 pending', async () => {
  const studio = new PortraitStudio({ mode: 'auto', executor: 'spec' });
  const plan = studio.plan({ characters: CHARACTERS, products: PRODUCTS, prompts: PROMPTS });
  const result = await studio.execute(plan, {});
  assert.strictEqual(result.executor, 'spec');
  assert.ok(result.pending > 0, 'pending 应大于 0');
  assert.ok(result.specPackage, '应产出规格包');
  assert.ok(result.specPackage.productReferenceSearches.length === 1, '规格包应含商品搜索任务');
  const leishan = plan.characterTasks.find(t => t.characterId === 'leishan');
  assert.ok(leishan.portraits.every(p => p.status === 'pending'), 'spec 模式任务保持 pending');
});

test('E3: api 执行调用渲染函数并回填产物', async () => {
  const studio = new PortraitStudio({ mode: 'auto', executor: 'api' });
  const plan = studio.plan({ characters: [{ id: 'a', name: '甲', isProtagonist: true, description: 'x' }], prompts: PROMPTS });
  let renderCount = 0;
  const result = await studio.execute(plan, {
    apiRender: async (p) => { renderCount++; return `/tmp/${p.portraitId}.png`; }
  });
  assert.strictEqual(renderCount, 8, '主角 8 角度应渲染 8 次');
  assert.strictEqual(result.executed, 8);
  assert.strictEqual(result.failed, 0);
  const all = plan.characterTasks[0].portraits;
  assert.ok(all.every(p => p.status === 'completed' && p.outputFile), '全部产物应回填');
});

test('E4: 计划摘要包含角色角度与商品分支说明', () => {
  const studio = new PortraitStudio({});
  const plan = studio.plan({ characters: CHARACTERS, products: PRODUCTS, prompts: PROMPTS });
  assert.ok(plan.summary.includes('定妆照生成计划'));
  assert.ok(plan.summary.includes('莱桑'));
  assert.ok(plan.summary.includes('搜参考图'));
  assert.ok(plan.summary.includes('千问办公'));
});

// ========== PortraitResolver 增强 ==========
test('F1: Resolver 优先消费定妆照集 manifest 产物', () => {
  const resolver = new PortraitResolver({ charactersDir: '/nonexistent-dir-for-test' });
  const manifest = {
    characters: [{
      characterId: 'leishan', characterName: '莱桑',
      portraits: [
        { angle: 'front_full', angleName: '正面全身', status: 'completed', outputFile: '/p/leishan-front.png' },
        { angle: 'face_closeup', angleName: '面部特写', status: 'pending', outputFile: null }
      ]
    }]
  };
  const { bindings } = resolver.resolve([{ prompt: '莱桑眺望草原' }], CHARACTERS, manifest);
  const leishan = bindings.find(b => b.character === '莱桑');
  assert.strictEqual(leishan.mode, 'studio', '应命中 studio 模式');
  assert.strictEqual(leishan.portraits.length, 1, '仅已完成的产物进入绑定');
  assert.strictEqual(leishan.file, '/p/leishan-front.png');
});

test('F2: 无 manifest 时回退文字模式', () => {
  const resolver = new PortraitResolver({ charactersDir: '/nonexistent-dir-for-test' });
  const { bindings } = resolver.resolve([{ prompt: '莱桑眺望草原' }], CHARACTERS, null);
  const leishan = bindings.find(b => b.character === '莱桑');
  assert.strictEqual(leishan.mode, 'text');
});

// ========== 运行 ==========
(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`✅ ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${t.name}`);
      console.error(`   ${e.message}`);
    }
  }
  console.log(`\n结果: ${passed}/${tests.length} 通过`);
  process.exit(failed > 0 ? 1 : 0);
})();
