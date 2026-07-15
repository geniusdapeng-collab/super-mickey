const { RenderSubmitter } = require('./render-submitter.js');
const { loadShotFromPreproduction } = require('./prompt-resolver.js');
const fs = require('fs');

/**
 * 生产环境渲染提交脚本 v6.5.65-P3
 * 
 * 使用方式:
 *   node systems/production-render-cli.js <预生产JSON路径> <镜头ID>
 * 
 * 示例:
 *   node systems/production-render-cli.js ./output/health-edu-ep01/preproduction-result.json S01
 * 
 * 功能:
 *   1. 从预生产结果读取完整 stages.style 渲染提示词（1500字符）
 *   2. 自动检查并生成缺失的 CG 定妆照
 *   3. 使用系统级 RenderSubmitter API 提交
 *   4. 输出详细的提交报告
 */

async function main() {
  const preproductionPath = process.argv[2];
  const shotId = process.argv[3];

  if (!preproductionPath || !shotId) {
    console.error('用法: node systems/production-render-cli.js <预生产JSON路径> <镜头ID>');
    console.error('示例: node systems/production-render-cli.js ./output/health-edu-ep01/preproduction-result.json S01');
    process.exit(1);
  }

  console.log(`🎬 生产渲染提交 v6.5.65-P3`);
  console.log(`   预生产文件: ${preproductionPath}`);
  console.log(`   镜头 ID: ${shotId}\n`);

  // 1. 加载预生产数据
  if (!fs.existsSync(preproductionPath)) {
    console.error(`❌ 预生产文件不存在: ${preproductionPath}`);
    process.exit(1);
  }

  const preproductionData = JSON.parse(fs.readFileSync(preproductionPath, 'utf-8'));
  
  // 2. 从预生产数据加载完整 shot（优先 stages.style）
  const shot = loadShotFromPreproduction(preproductionData, shotId);
  if (!shot) {
    console.error(`❌ 未在预生产结果中找到镜头: ${shotId}`);
    console.error('   可用镜头:');
    const styleShots = preproductionData.stages?.style?.map(s => s.shotId || s.id) || [];
    const sceneShots = preproductionData.script?.scenes?.map(s => s.id) || [];
    [...new Set([...styleShots, ...sceneShots])].forEach(id => console.error(`     - ${id}`));
    process.exit(1);
  }

  console.log(`✅ 找到镜头数据`);
  console.log(`   来源: ${shot._source || 'preproduction'}`);
  console.log(`   类型: ${shot.type || 'unknown'}`);
  console.log(`   时长: ${shot.duration || 8}秒`);

  // 3. 检查 prompt 完整性
  const promptText = shot.prompt || '';
  const checks = {
    hasDirector: promptText.includes('DIRECTOR'),
    hasScene: promptText.includes('SCENE'),
    hasSpace: promptText.includes('【空间】'),
    hasDepth: promptText.includes('【纵深】'),
    hasCamera: promptText.includes('CAMERA'),
    hasLighting: promptText.includes('LIGHTING'),
    hasAudio: promptText.includes('AUDIO'),
    hasRender: promptText.includes('RENDER'),
    hasDialogue: promptText.includes('大家好') || promptText.includes('台词') || promptText.includes('ACTION')
  };

  console.log(`\n📋 Prompt 完整性检查 (${promptText.length} 字符):`);
  Object.entries(checks).forEach(([key, val]) => {
    const name = key.replace('has', '').replace(/([A-Z])/g, ' $1').trim();
    console.log(`   ${val ? '✅' : '❌'} ${name}`);
  });

  const completeCount = Object.values(checks).filter(v => v).length;
  const totalCount = Object.keys(checks).length;
  console.log(`   完整度: ${completeCount}/${totalCount} (${Math.round(completeCount/totalCount*100)}%)`);

  if (completeCount < 6) {
    console.warn(`\n⚠️ 警告: Prompt 完整度较低 (${completeCount}/${totalCount})`);
    console.warn(`   建议检查预生产链路是否完整执行了所有 Stage`);
  }

  // 4. 检查参考图
  console.log(`\n📸 参考图检查:`);
  const submitter = new RenderSubmitter();
  const referenceImages = submitter.collectReferenceImages(shot);
  
  if (referenceImages.length > 0) {
    console.log(`   ✅ 找到 ${referenceImages.length} 张参考图:`);
    referenceImages.forEach(img => {
      console.log(`      - ${img.roleId} / ${img.angle}: ${img.path}`);
    });
  } else {
    console.log(`   ⚠️ 未找到参考图`);
    console.log(`   角色: ${submitter.extractCharactersFromShot(shot).join(', ') || 'none'}`);
  }

  // 5. 提交渲染（需要主人确认）
  console.log(`\n⏳ 等待主人确认...`);
  console.log(`   主人说"渲染"或"提交"后执行`);
  console.log(`   说"取消"则退出`);

  // 这里在实际使用中需要等待用户输入
  // 为了自动化，添加 --confirm 参数来跳过确认
  const skipConfirm = process.argv.includes('--confirm');
  
  if (!skipConfirm) {
    console.log(`\n🛑 已暂停，等待主人确认`);
    console.log(`   请回复 "渲染" 或 "提交" 以继续`);
    console.log(`   或添加 --confirm 参数跳过确认（仅用于自动化测试）`);
    
    // 读取 stdin 等待确认
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        const input = chunk.trim().toLowerCase();
        if (input === '渲染' || input === '提交' || input === 'yes' || input === 'y') {
          doSubmit(submitter, shot, preproductionData);
        } else {
          console.log('❌ 已取消');
          process.exit(0);
        }
      }
    });
  } else {
    console.log(`\n⚠️ 使用 --confirm 跳过确认，直接提交`);
    await doSubmit(submitter, shot, preproductionData);
  }
}

async function doSubmit(submitter, shot, preproductionData) {
  console.log(`\n📡 正在提交渲染...`);
  
  try {
    const result = await submitter.submitShot(shot, {
      preproductionData  // 传递完整预生产数据，让 resolvePromptText 使用 stages.style
    });

    console.log(`\n✅ 提交成功!`);
    console.log(`   任务 ID: ${result.response?.id || result.response?.taskId || 'unknown'}`);
    console.log(`   Shot ID: ${result.shotId}`);
    
    // 保存任务记录
    const taskRecord = {
      shotId: result.shotId,
      taskId: result.response?.id || result.response?.taskId,
      submittedAt: new Date().toISOString(),
      promptLength: result.payload?.content?.[0]?.text?.length || 0,
      referenceImageCount: result.payload?.content?.filter(c => c.type === 'image_url').length || 0,
      version: 'v6.5.65-P3'
    };

    const outputDir = './output/production-tasks';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      `${outputDir}/${result.shotId}-${taskRecord.taskId}.json`,
      JSON.stringify(taskRecord, null, 2)
    );

    console.log(`\n💾 任务记录已保存: ${outputDir}/${result.shotId}-${taskRecord.taskId}.json`);

  } catch (error) {
    console.error(`\n❌ 提交失败: ${error.message}`);
    if (error.details) {
      console.error(`   详情:`, JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 未处理的错误:', err);
  process.exit(1);
});
