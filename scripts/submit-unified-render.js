/**
 * 统一渲染提交脚本 v6.2-patch50
 * 所有系列通用：硬拦截 + 全角度定妆照绑定
 * 
 * 【P0铁律】⚠️ 绝对禁止未经队长明确确认提交渲染！
 * 必须先跑完整预生产流程，得到队长明确回复"可以提交渲染"后方可执行。
 * 
 * 【v6.2-patch50 修复】定妆照全角度绑定保障
 * - 每个角色的 front, threeQuarter, closeup, side 全部4角度传入
 * - PortraitGuard 自动扫描 + 硬拦截（非手动硬编码）
 * - 预生产报告直接驱动，无需手动配置角色路径
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { PortraitGuard } = require('../systems/portrait-guard.js');

// API配置
const API_KEY = process.env.VOLCENGINE_ARK_API_KEY;
if (!API_KEY) {
  console.error('❌ 错误：环境变量 VOLCENGINE_ARK_API_KEY 未设置');
  process.exit(1);
}
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
const ENDPOINT = '003cENDPOINT_STD003e'; // openclaw2 自定义接入点
const MAX_CONCURRENT = 3;

// 角色定妆照目录
const CHARACTERS_DIR = path.join(__dirname, '..', 'characters');

// 读取预生产报告（默认路径）
function loadReport(reportPath) {
  const defaultPath = path.join(__dirname, '..', 'output', 'taotie-ep01-prompts-full.json');
  const targetPath = reportPath || defaultPath;
  
  if (!fs.existsSync(targetPath)) {
    throw new Error(`预生产报告不存在: ${targetPath}`);
  }
  
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

// 从预生产报告提取角色列表
function extractCharactersFromReport(report) {
  const chars = new Set();
  
  for (const shot of report.prompts || report.shots || []) {
    const shotChars = shot.characters || [];
    for (const c of shotChars) {
      const charId = typeof c === 'string' ? c : (c.id || c.characterId || '');
      if (charId) chars.add(charId);
    }
  }
  
  return Array.from(chars);
}

// 为所有角色加载全部4角度定妆照
function loadAllReferenceImages(characterIds) {
  console.log('\n📷 加载角色定妆照（全部4角度）...');
  
  const allImages = [];
  let totalLoaded = 0;
  
  for (const charId of characterIds) {
    const portraitDir = path.join(CHARACTERS_DIR, charId, 'portraits');
    if (!fs.existsSync(portraitDir)) {
      console.error(`⛔ 角色 ${charId} 的 portraits 目录不存在: ${portraitDir}`);
      continue;
    }
    
    const files = fs.readdirSync(portraitDir);
    const loadedAngles = [];
    
    for (const angle of ['front', 'threeQuarter', 'closeup', 'side']) {
      // 支持多种命名格式（包括带连字符和不带连字符的变体）
      const charIdVariants = [
        charId,
        charId.replace(/-/g, ''),  // 去掉连字符: tao-tie → taotie
        charId.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),  // 驼峰转连字符
        charId.toLowerCase(),
        charId.toUpperCase()
      ];
      
      const patterns = charIdVariants.map(v => 
        new RegExp(`${v}.*-${angle}\.(png|jpg|jpeg)$`, 'i')
      );
      
      let matchedFile = null;
      for (const pattern of patterns) {
        matchedFile = files.find(f => pattern.test(f));
        if (matchedFile) break;
      }
      
      if (!matchedFile) {
        console.error(`⛔ 角色 ${charId} 缺少 ${angle} 角度定妆照`);
        continue;
      }
      
      const filePath = path.join(portraitDir, matchedFile);
      try {
        const base64 = fs.readFileSync(filePath).toString('base64');
        const mimeType = matchedFile.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        
        allImages.push({
          data: base64,
          type: mimeType,
          role: 'reference_image',
          label: `${charId}-${angle}`,
          characterId: charId,
          angle
        });
        
        loadedAngles.push(angle);
        totalLoaded++;
      } catch (e) {
        console.error(`⛔ 读取 ${charId} ${angle} 失败: ${e.message}`);
      }
    }
    
    if (loadedAngles.length === 4) {
      console.log(`  ✅ ${charId}: ${loadedAngles.join(', ')} (4/4)`);
    } else {
      console.error(`  ❌ ${charId}: ${loadedAngles.join(', ')} (${loadedAngles.length}/4)`);
    }
  }
  
  return { images: allImages, totalLoaded };
}

// 为每个镜头选择需要的参考图（根据镜头角色）
function selectReferenceImagesForShot(shot, allImages) {
  const shotChars = new Set();
  
  if (shot.characters && Array.isArray(shot.characters)) {
    for (const c of shot.characters) {
      shotChars.add(typeof c === 'string' ? c : (c.id || c.characterId || ''));
    }
  }
  
  // 过滤出该镜头需要的角色的全部4角度
  return allImages.filter(img => shotChars.has(img.characterId));
}

// 提交单个渲染任务
async function submitRender(shot, referenceImages) {
  const prompt = shot.prompt || '';
  const duration = shot.isOpening ? 9 : (shot.duration || 12);
  const shotId = shot.shotId || shot.id;
  
  // 构建 content 数组
  const content = [{ type: 'text', text: prompt }];
  
  // 选择该镜头需要的参考图
  const shotRefImages = selectReferenceImagesForShot(shot, referenceImages);
  
  // 为每个镜头注入其需要的角色的全部4角度
  for (const img of shotRefImages) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.type};base64,${img.data}` },
      role: 'reference_image'
    });
  }
  
  // 🔥 硬拦截：检查每个必需角色的4角度是否齐全
  const shotChars = shot.characters || [];
  for (const charId of shotChars) {
    const charIdStr = typeof charId === 'string' ? charId : (charId.id || '');
    const charAngles = shotRefImages.filter(img => img.characterId === charIdStr).map(img => img.angle);
    const missingAngles = ['front', 'threeQuarter', 'closeup', 'side'].filter(a => !charAngles.includes(a));
    if (missingAngles.length > 0) {
      throw new Error(`RENDER_BLOCKED: 镜头 ${shotId} 角色 ${charIdStr} 缺少角度: ${missingAngles.join(', ')}`);
    }
  }
  
  const payload = {
    model: ENDPOINT,
    content,
    metadata: { max_new_tokens: 8192 },
    ratio: '16:9',
    duration
  };
  
  console.log(`\n🎬 提交 ${shotId} | 时长:${duration}s | Prompt:${prompt.length}字符 | 参考图:${shotRefImages.length}张(${shotChars.join('+') || '无角色'})`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const taskId = response.id || response.taskId || response.task_id || response.data?.id;
          if (!taskId) {
            console.error(`⚠️ ${shotId} 无taskId，原始:`, JSON.stringify(response).substring(0, 200));
          }
          resolve({
            success: true,
            shotId,
            taskId,
            status: response.status || 'submitted',
            refImageCount: shotRefImages.length
          });
        } catch (e) {
          resolve({ success: false, shotId, error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, shotId, error: e.message });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// 主函数
async function main() {
  console.log('🔥 【统一渲染提交】v6.2-patch50（全角度定妆照硬拦截）');
  console.log('=' .repeat(60));
  
  // 1. 读取预生产报告
  const report = loadReport(process.argv[2]);
  console.log(`📖 项目: ${report.project || '山海经系列'}`);
  console.log(`🎥 镜头数: ${report.prompts?.length || report.shots?.length || 0}`);
  
  // 2. 提取角色
  const characterIds = extractCharactersFromReport(report);
  console.log(`👥 角色: ${characterIds.join(', ')}`);
  
  // 3. 加载全部4角度定妆照
  const { images: allRefImages, totalLoaded } = loadAllReferenceImages(characterIds);
  
  if (totalLoaded === 0) {
    throw new Error('没有加载到任何定妆照，渲染中止！');
  }
  
  console.log(`\n📊 共加载 ${totalLoaded} 张定妆照（${characterIds.length}个角色 × 4角度）`);
  
  // 4. PortraitGuard 全量验证
  console.log('\n🔒 PortraitGuard 硬拦截检查...');
  const guard = new PortraitGuard({ mode: 'production', charactersDir: CHARACTERS_DIR });
  const shotsForValidation = (report.prompts || report.shots || []).map(shot => ({
    id: shot.shotId || shot.id,
    characters: shot.characters || [],
    content: [] // 将在submitRender中构建
  }));
  
  // 构建content用于验证
  for (const shot of shotsForValidation) {
    const shotRefs = selectReferenceImagesForShot(shot, allRefImages);
    shot.content = [
      { type: 'text', text: 'placeholder' },
      ...shotRefs.map(img => ({
        type: 'image_url',
        image_url: { url: `data:${img.type};base64,${img.data}` },
        role: 'reference_image',
        characterId: img.characterId,
        angle: img.angle
      }))
    ];
  }
  
  try {
    guard.validateOrThrow(shotsForValidation);
    console.log('✅ PortraitGuard 硬拦截通过');
  } catch (e) {
    console.error('\n❌❌❌ 硬拦截触发 ❌❌❌');
    console.error(e.message);
    process.exit(1);
  }
  
  // 5. 提交渲染
  const shots = report.prompts || report.shots || [];
  const results = [];
  
  console.log(`\n🎬 开始提交 ${shots.length} 个镜头...`);
  
  for (let i = 0; i < shots.length; i += MAX_CONCURRENT) {
    const batch = shots.slice(i, i + MAX_CONCURRENT);
    console.log(`\n📦 批次 ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(shots.length / MAX_CONCURRENT)}: ${batch.map(s => s.shotId || s.id).join(', ')}`);
    
    const batchResults = await Promise.all(
      batch.map(shot => submitRender(shot, allRefImages))
    );
    
    results.push(...batchResults);
    
    if (i + MAX_CONCURRENT < shots.length) {
      console.log('⏳ 等待3秒...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // 6. 汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 提交汇总');
  console.log('='.repeat(60));
  
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalRefImages = results.reduce((sum, r) => sum + (r.refImageCount || 0), 0);
  
  console.log(`✅ 成功: ${succeeded.length}/${shots.length}`);
  console.log(`❌ 失败: ${failed.length}/${shots.length}`);
  console.log(`📸 定妆照引用总计: ${totalRefImages}张`);
  
  if (succeeded.length > 0) {
    console.log('\n🎉 成功任务:');
    for (const r of succeeded) {
      console.log(`  ${r.shotId} → ${r.taskId} (${r.status}) [${r.refImageCount}张参考图]`);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️ 失败任务:');
    for (const r of failed) {
      console.log(`  ${r.shotId} → ${r.error}`);
    }
  }
  
  // 7. 保存记录
  const recordPath = path.join(__dirname, '..', 'output', `render-submit-record-v6.2-patch50.json`);
  fs.writeFileSync(recordPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    version: 'v6.2-patch50',
    project: report.project,
    totalShots: shots.length,
    succeeded: succeeded.length,
    failed: failed.length,
    totalRefImages,
    characters: characterIds,
    results
  }, null, 2));
  
  console.log(`\n💾 提交记录已保存: ${recordPath}`);
}

main().catch(e => {
  console.error(`\n❌ 渲染提交失败: ${e.message}`);
  process.exit(1);
});
