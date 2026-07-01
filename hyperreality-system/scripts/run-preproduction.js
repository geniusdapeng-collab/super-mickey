/**
 * 【预生产六步法】正式预生产流程运行脚本
 * 
 * Step 1: 清理旧数据
 * Step 2: 创意主题生成 + 人工确认
 * Step 3: 需求要点清单 + 人工确认  
 * Step 4: 定妆照检查/生成 + 人工确认
 * Step 5: 执行预生产链路
 * Step 6: 结果输出为 MD 文件 + 最终确认
 * 
 * 用法: node run-preproduction.js "用户输入"
 */

const path = require('path');
const fs = require('fs');
const { HyperrealitySystem } = require('../index');

// 六步法配置
const CONFIG = {
  outputDir: path.resolve(__dirname, '../output'),
  confirmationsDir: path.resolve(__dirname, '../output/confirmations'),
  debugDir: path.resolve(__dirname, '../debug_llm'),
  tmpDir: path.resolve(__dirname, '../tmp'),
  cacheDir: path.resolve(__dirname, '../cache'),
  charactersDir: path.resolve(__dirname, '../characters'),
};

/**
 * Step 1: 清理旧数据
 * 删除历史产物，确保从零开始
 */
function cleanupOldData() {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('🧹 Step 1/6: 清理旧数据');
  console.log('══════════════════════════════════════════');
  
  const dirsToClean = [
    CONFIG.confirmationsDir,
    CONFIG.debugDir,
    CONFIG.tmpDir,
    CONFIG.cacheDir,
    path.join(CONFIG.outputDir, 'checkpoints'),
    path.join(CONFIG.outputDir, 'renders'),
    path.join(CONFIG.outputDir, 'post-production'),
  ];
  
  let cleanedCount = 0;
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              fs.rmSync(filePath, { recursive: true });
            } else {
              fs.unlinkSync(filePath);
            }
            cleanedCount++;
          } catch (e) {
            // 忽略清理错误
          }
        }
        console.log(`  ✅ 清理: ${dir} (${files.length} 项)`);
      } catch (e) {
        console.log(`  ⚠️ 清理失败: ${dir}`);
      }
    }
  }
  
  // 清理根目录的调试文件
  const rootDebugFiles = [
    path.resolve(__dirname, '../debug_reasoning.json'),
    path.resolve(__dirname, '../debug_llm_reasoning.json'),
  ];
  for (const f of rootDebugFiles) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      cleanedCount++;
    }
  }
  
  console.log(`  📊 共清理 ${cleanedCount} 个文件/目录`);
  console.log('  ✅ 旧数据清理完成');
  return true;
}

/**
 * Step 4: 检查定妆照
 */
function checkCharacterPortraits() {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('🎭 Step 4/6: 检查定妆照');
  console.log('══════════════════════════════════════════');
  
  if (!fs.existsSync(CONFIG.charactersDir)) {
    console.log('  ⚠️ characters/ 目录不存在，跳过定妆照检查');
    return { hasPortraits: false, characters: [] };
  }
  
  const characters = fs.readdirSync(CONFIG.charactersDir)
    .filter(f => fs.statSync(path.join(CONFIG.charactersDir, f)).isDirectory());
  
  if (characters.length === 0) {
    console.log('  ⚠️ 未找到角色目录');
    return { hasPortraits: false, characters: [] };
  }
  
  console.log(`  📁 发现 ${characters.length} 个角色:`);
  for (const char of characters) {
    const portraitDir = path.join(CONFIG.charactersDir, char, 'portraits');
    const hasPortrait = fs.existsSync(portraitDir) && fs.readdirSync(portraitDir).length > 0;
    console.log(`    ${hasPortrait ? '✅' : '❌'} ${char}${hasPortrait ? '' : ' (无定妆照)'}`);
  }
  
  return { hasPortraits: true, characters };
}

/**
 * Step 6: 输出预生产结果为 MD 文件
 */
function exportResultsToMarkdown(result) {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('📝 Step 6/6: 输出预生产结果');
  console.log('══════════════════════════════════════════');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(CONFIG.outputDir, `preproduction-result-${timestamp}.md`);
  
  let md = `# 预生产结果报告

> 生成时间: ${new Date().toLocaleString('zh-CN')}
> 项目: ${result.projectName || '未命名'}

## 一、创意主题

- **类型**: ${result.creativeTheme?.type || 'N/A'}
- **主题**: ${result.creativeTheme?.theme || 'N/A'}
- **时长**: ${result.creativeTheme?.duration || 'N/A'}秒
- **情绪基调**: ${result.creativeTheme?.tone || 'N/A'}

## 二、需求清单

- **视频类型**: ${result.requirementList?.videoTypeName || 'N/A'}
- **目标时长**: ${result.requirementList?.targetDuration || 'N/A'}秒
- **画幅比例**: ${result.requirementList?.aspectRatio || 'N/A'}
- **风格**: ${result.requirementList?.style?.description || 'N/A'}

## 三、剧本概要

${result.script ? `- 场景数: ${result.script.scenes?.length || 0}
- 角色数: ${result.script.characters?.length || 0}
- 台词数: ${result.script.dialogues?.length || 0}` : '剧本生成失败'}

## 四、镜头设计

${result.shots ? result.shots.map((s, i) => `- **镜头 ${i+1}** (${s.shotId}): ${s.scene || 'N/A'} | ${s.duration || '?'}秒`).join('\n') : '镜头设计失败'}

## 五、25维提示词

${result.prompts ? result.prompts.map((p, i) => `### 镜头 ${i+1} (${p.shotId})

| 字段 | 内容 |
|------|------|
${Object.entries(p.fields || {}).map(([k, v]) => `| ${k} | ${String(v).substring(0, 100)}${String(v).length > 100 ? '...' : ''} |`).join('\n')}

---
`).join('\n') : '提示词融合失败'}

## 六、质量检查

${result.quality ? `- 总分: ${result.quality.score || 'N/A'}/100
- 通过检查: ${result.quality.passedChecks || 0}/${result.quality.totalChecks || 0}` : '未执行质量检查'}

---

**请审阅以上结果，确认 OK 后回复"确认"，我将提交预生产。**
`;
  
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`  ✅ MD 文件已输出: ${mdPath}`);
  return mdPath;
}

async function main() {
  // 获取用户输入
  const userInput = process.argv[2] !== undefined ? process.argv[2] : '';
  
  if (!userInput) {
    console.error('❌ 请提供用户输入: node run-preproduction.js "用户输入"');
    process.exit(1);
  }
  
  console.log('══════════════════════════════════════════');
  console.log('🎬 超级小香宝 v2.1.8 预生产六步法');
  console.log('══════════════════════════════════════════');
  console.log(`输入: "${userInput}"`);
  console.log('');
  
  // Step 1: 清理旧数据
  cleanupOldData();
  
  // 确保目录存在
  [CONFIG.outputDir, CONFIG.confirmationsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('⏳ 准备启动预生产流程');
  console.log('══════════════════════════════════════════');
  console.log('⚠️  以下环节需要人工确认：');
  console.log('   Step 2: 创意主题确认');
  console.log('   Step 3: 需求清单确认');
  console.log('   Step 4: 定妆照确认（如需要）');
  console.log('   Step 6: 最终结果确认');
  console.log('');
  console.log('   系统将输出确认内容到 output/confirmations/');
  console.log('   请审阅后创建 confirmation-*.json 文件');
  console.log('══════════════════════════════════════════');
  console.log('');
  
  const system = new HyperrealitySystem({
    scriptEngine: { charactersDir: './characters' },
    productionEngine: { charactersDir: './characters' },
    renderingEngine: { charactersDir: './characters' }
  });
  
  try {
    // Step 2-5: 执行系统流程（包含确认环节）
    const result = await system.create(userInput, {
      skipRender: true,
      skipPostProduction: true
    });
    
    // Step 6: 输出结果
    const mdPath = exportResultsToMarkdown(result);
    
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('✅ 预生产六步法执行完毕');
    console.log('══════════════════════════════════════════');
    console.log(`结果 MD 文件: ${mdPath}`);
    console.log('');
    console.log('⏳ 等待最终确认...');
    console.log('请审阅 MD 文件后回复 "确认" 提交预生产');
    
  } catch (error) {
    console.error('');
    console.error('══════════════════════════════════════════');
    console.error('❌ 预生产流程失败');
    console.error('══════════════════════════════════════════');
    console.error('错误:', error.message);
    process.exit(1);
  }
}

main();
