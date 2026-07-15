#!/usr/bin/env node
/**
 * Seedream Character Reference Generator
 * 角色定妆照生成器 — 用Seedream为每个角色生成3张一致性定妆照
 * 
 * 用法:
 *   node seedream-wrapper.js generate \
 *     --name "大圣" \
 *     --species "猴形金色生物" \
 *     --features "火眼金睛+金色毛发+灵巧" \
 *     --signature "燃烧长棒" \
 *     --style "3D国漫CG渲染,UnrealEngine5" \
 *     --output-dir "./productions/xxx/03-characters"
 * 
 *   node seedream-wrapper.js batch \
 *     --story-plan "./productions/xxx/01-story-plan.json" \
 *     --output-dir "./productions/xxx/03-characters"
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const https = require('https');
const { execAsync } = require('./exec-utils');

const API_BASE = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com';
const API_PATH = '/api/v3/images/generations';
const MODEL_ID = 'doubao-seedream-5-0-260128';

// ============ API Key解析（复用seedance逻辑） ============
async function resolveApiKey() {
  // 1. 环境变量
  if (process.env.ARK_API_KEY) return process.env.ARK_API_KEY;
  
  // 2. 尝试从seedance技能目录读取配置
  const configPaths = [
    path.join(require('os').homedir(), '.openclaw/workspace/skills/byted-ark-seedance-skill/.env'),
    path.join(require('os').homedir(), '.openclaw/workspace/skills/byted-ark-seedance-skill/config.json'),
  ];
  
  for (const configPath of configPaths) {
    if (fss.existsSync(configPath)) {
      const content = fss.readFileSync(configPath, 'utf8');
      const match = content.match(/ark-[a-f0-9-]+/);
      if (match) return match[0];
    }
  }
  
  // 3. 尝试从OpenClaw环境变量获取
  try {
    const envOutput = await execAsync('env | grep -i ARK_API_KEY || env | grep -i api_key', { encoding: 'utf8' });
    const match = envOutput.match(/ark-[a-f0-9-]+/);
    if (match) return match[0];
  } catch {}
  
  return null;
}

// ============ 日志 ============
function log(tag, msg) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`[${time}] [${tag}] ${msg}`);
}

// ============ 确保目录 ============
function ensureDir(dir) {
  if (!fss.existsSync(dir)) {
    fss.mkdirSync(dir, { recursive: true });
  }
}

// ============ HTTP请求 ============
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ 下载图片 ============
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fss.createWriteStream(filepath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', reject);
  });
}

// ============ 生成角色定妆照 ============
async function generateCharacterReference(args) {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    throw new Error('❌ 未找到ARK_API_KEY。请设置环境变量：export ARK_API_KEY=ark-xxx');
  }
  
  const name = args.name;
  const species = args.species || '';
  const features = args.features || '';
  const signature = args.signature || '';
  const style = args.style || '3D国漫CG渲染,UnrealEngine5,工业光魔级VFX';
  const outputDir = args['output-dir'] || args.outputDir || './characters';
  
  const charDir = path.join(outputDir, `${name}`);
  ensureDir(charDir);
  
  log('Seedream', `🎨 为角色 [${name}] 生成3张定妆照...`);
  log('Seedream', `   物种: ${species} | 特征: ${features} | 标志: ${signature}`);
  
  // 3张定妆照的prompt
  const shots = [
    {
      suffix: '全身',
      prompt: `正面全身站立姿态，${species}，${features}，${signature}，${style}，纯黑背景，全身完整可见，正面朝向镜头，双脚站立，双臂自然下垂，角色造型精细，服装细节清晰，光影立体感强`
    },
    {
      suffix: '特写',
      prompt: `面部特写肖像，${species}，${features}，${style}，纯黑背景，面部占画面80%，五官清晰锐利，眼神有神，表情坚定自信，皮肤纹理真实，光影戏剧性`
    },
    {
      suffix: '动态',
      prompt: `动态战斗姿态，${species}，${features}，${signature}，${style}，腾空跃起或挥舞武器姿态，充满力量感和速度感，纯黑背景，动作线条流畅，肌肉张力明显，风压气流效果`
    }
  ];
  
  const results = [];
  
  for (const shot of shots) {
    const filename = `${name}-${shot.suffix}.png`;
    const filepath = path.join(charDir, filename);
    
    // 检查是否已存在（避免重复生成）
    if (fss.existsSync(filepath)) {
      log('Seedream', `   ✅ ${filename} 已存在，跳过`);
      results.push({ suffix: shot.suffix, filepath, status: 'skipped' });
      continue;
    }
    
    log('Seedream', `   ⏳ 生成 ${filename}...`);
    
    try {
      const body = {
        model: MODEL_ID,
        prompt: shot.prompt,
        size: '2K',
        output_format: 'png',
        response_format: 'url',
        watermark: false,
        sequential_image_generation: 'auto',
        sequential_image_generation_options: { max_images: 3 }
      };
      
      const response = await postJson(
        `${API_BASE}${API_PATH}`,
        { 'Authorization': `Bearer ${apiKey}` },
        body
      );
      
      if (response.error) {
        throw new Error(`API错误: ${response.error.code} - ${response.error.message}`);
      }
      
      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('API未返回图片URL');
      }
      
      // 下载图片
      await downloadImage(imageUrl, filepath);
      log('Seedream', `   ✅ ${filename} 已下载 (${response.data[0].size || 'unknown'})`);
      results.push({ suffix: shot.suffix, filepath, status: 'success', url: imageUrl });
      
    } catch (err) {
      log('Seedream', `   ❌ ${filename} 失败: ${err.message}`);
      results.push({ suffix: shot.suffix, filepath, status: 'failed', error: err.message });
    }
  }
  
  // 生成角色元数据
  const meta = {
    name,
    species,
    features: features.split(/[,+]/).map(s => s.trim()).filter(Boolean),
    signature,
    style,
    referencePhotos: results.map(r => ({
      type: r.suffix,
      filename: path.basename(r.filepath),
      status: r.status,
      url: r.url || null
    })),
    generatedAt: new Date().toISOString(),
    model: MODEL_ID
  };
  
  fss.writeFileSync(path.join(charDir, 'character-meta.json'), JSON.stringify(meta, null, 2));
  log('Seedream', `✅ 角色 [${name}] 定妆完成！目录: ${charDir}`);
  
  return { charDir, results, meta };
}

// ============ 批量生成（从story-plan.json读取角色） ============
async function batchGenerate(args) {
  const storyPlanPath = args['story-plan'] || args.storyPlan;
  const outputDir = args['output-dir'] || args.outputDir || './characters';
  
  if (!storyPlanPath || !fss.existsSync(storyPlanPath)) {
    throw new Error(`❌ 未找到story-plan.json: ${storyPlanPath}`);
  }
  
  const storyPlan = JSON.parse(fss.readFileSync(storyPlanPath, 'utf8'));
  const characters = storyPlan.characters || [];
  
  if (characters.length === 0) {
    log('Seedream', '⚠️ story-plan中未定义角色，跳过定妆');
    return [];
  }
  
  log('Seedream', `🎬 批量生成 ${characters.length} 个角色的定妆照...`);
  
  const allResults = [];
  for (const char of characters) {
    const result = await generateCharacterReference({
      name: char.name,
      species: char.species || '',
      features: (char.features || []).join('+'),
      signature: char.signature || '',
      style: storyPlan.styleManifesto || '',
      'output-dir': outputDir
    });
    allResults.push(result);
  }
  
  // 生成批量报告
  const report = {
    totalCharacters: characters.length,
    totalPhotos: allResults.reduce((sum, r) => sum + r.results.length, 0),
    successCount: allResults.reduce((sum, r) => sum + r.results.filter(x => x.status === 'success').length, 0),
    failedCount: allResults.reduce((sum, r) => sum + r.results.filter(x => x.status === 'failed').length, 0),
    characters: allResults.map(r => ({
      name: r.meta.name,
      dir: r.charDir,
      photos: r.results.map(p => ({ type: p.suffix, status: p.status }))
    }))
  };
  
  fss.writeFileSync(path.join(outputDir, 'batch-report.json'), JSON.stringify(report, null, 2));
  log('Seedream', `✅ 批量定妆完成！成功: ${report.successCount}, 失败: ${report.failedCount}`);
  
  return allResults;
}

// ============ CLI解析 ============
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const rawKey = process.argv[i];
    if (!rawKey.startsWith('--')) continue;
    const key = rawKey.replace(/^--/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = process.argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

// ============ 主流程 ============
async function main() {
  const command = process.argv[2];
  const args = parseArgs();
  
  switch (command) {
    case 'generate':
      if (!args.name) {
        console.error('❌ 缺少 --name 参数');
        process.exit(1);
      }
      await generateCharacterReference(args);
      break;
      
    case 'batch':
      if (!args.storyPlan) {
        console.error('❌ 缺少 --story-plan 参数');
        process.exit(1);
      }
      await batchGenerate(args);
      break;
      
    case 'help':
    default:
      console.log(`
Seedream Character Reference Generator — 角色定妆照生成器

用法:
  node seedream-wrapper.js generate [options]   为单个角色生成定妆照
  node seedream-wrapper.js batch [options]        从story-plan批量生成

命令:
  generate    单角色生成
  batch       批量生成（读取story-plan.json）
  help        显示帮助

generate 选项:
  --name          角色名（必须）
  --species       物种/类型
  --features      特征列表（用+或,分隔）
  --signature     标志性元素
  --style         视觉风格
  --output-dir    输出目录（默认./characters）

batch 选项:
  --story-plan    story-plan.json路径（必须）
  --output-dir    输出目录（默认./characters）

环境变量:
  ARK_API_KEY     火山方舟API Key（必须）

示例:
  node seedream-wrapper.js generate --name "大圣" --species "猴形金色生物" --features "火眼金睛+金色毛发+灵巧" --signature "燃烧长棒"
  node seedream-wrapper.js batch --story-plan "./productions/xxx/01-story-plan.json" --output-dir "./productions/xxx/03-characters"
      `);
  }
}

main().catch(e => {
  console.error(`❌ 致命错误: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});

module.exports = { generateCharacterReference, batchGenerate };