#!/usr/bin/env node
/**
 * 健康科普视频 - 超级小香宝运行脚本
 * 横纹肌溶解 EP01 在 SuperXiangBao 中运行
 */

const { HyperrealitySystem } = require('../hyperreality-system');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('🎬 启动超级小香宝 - 健康科普视频预生产\n');

  // 用户意图
  const intent = `制作一集健康科普短视频，主题为"横纹肌溶解的症状与实验室检查"。
场景：社区健康讲座现场。
角色：
- 陈女士（35岁，穿警服的护士，主讲人，专业亲和）
- 小G（8岁男孩，现场听众，听得津津有味）
- 李明教练（40岁，运动康复专家，展示案例）
时长：62秒。
风格：超写实纪录片，真实医疗科普场景，自然光+室内柔和补光，专业、亲切、通俗易懂。
第一集内容：横纹肌溶解的症状（肌肉疼痛/茶色尿/全身乏力）以及实验室检查（CK值/肌红蛋白/肾功能）。
不预告下一集。`;

  // 元数据
  const metadata = {
    title: '横纹肌溶解-症状与检查',
    project_id: 'rhabdomyolysis-ep01',
    category: 'health-education',
    target_duration: 62,
    style: 'documentary-realistic',
    mode: 'generic' // 非nirath
  };

  // 选项：跳过确认环节（自动通过，用于测试）
  const options = {
    skipScriptConfirmation: true,  // 跳过剧本确认
    skipPromptReview: true,          // 跳过提示词审核
    skipRender: true,              // 跳过渲染（先测试剧本+制作）
    skipPostProduction: true,      // 跳过后期
    dryRun: true
  };

  // 创建系统实例
  const system = new HyperrealitySystem({
    scriptEngine: {
      // 剧本引擎配置
    },
    productionEngine: {
      // 制作引擎配置
    },
    renderingEngine: {
      // 渲染引擎配置（需要API key）
      apiKey: process.env.VOLCENGINE_ARK_API_KEY || null
    },
    postProductionEngine: {
      // 后期引擎配置
    }
  });

  try {
    const result = await system.create(intent, metadata, options);

    console.log('\n' + '='.repeat(60));
    console.log('📊 超级小香宝运行结果');
    console.log('='.repeat(60));
    console.log(`成功: ${result.success ? '✅' : '❌'}`);
    console.log(`总耗时: ${result.timing?.total || 'N/A'}ms`);
    console.log(`\n各阶段状态:`);
    console.log(`  剧本引擎: ${result.stages.scriptEngine ? '✅' : '❌'}`);
    console.log(`  制作引擎: ${result.stages.productionEngine ? '✅' : '❌'}`);
    console.log(`  渲染引擎: ${result.stages.renderingEngine?.skipped ? '⏭️ 跳过' : '✅'}`);
    console.log(`  后期引擎: ${result.stages.postProductionEngine?.skipped ? '⏭️ 跳过' : '✅'}`);

    // 如果有错误，显示
    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ 错误 (${result.errors.length}):`);
      for (const err of result.errors) {
        console.log(`  [${err.stage}] ${err.message}`);
      }
    }

    // 保存结果
    const outputDir = path.join(__dirname, '../output/hyperreality-health-edu');
    await system.save(result, outputDir);
    console.log(`\n💾 结果已保存到: ${outputDir}`);

    return result;
  } catch (error) {
    console.error('\n❌ 运行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
