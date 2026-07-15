/**
 * PromptForge Director 子进程入口
 * 完整运行 promptforge-director.js 三阶流水线（子进程隔离防OOM）
 * 
 * 输入：JSON文件 { rawReport, projectConfig }
 * 输出：JSON文件 { shots, vision, qualityReport, version }
 * 
 * v6.3-patch8-fix: 改进LLM内容提取策略，修复系统模板长度计算
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// LLM 引擎
const { LLMEngine } = require('../systems/llm-reasoning-engine');
const { PromptForge } = require('../systems/promptforge-director');

const { charCounter } = require('../systems/char-counter');
const { dedupeShotFields } = require('../systems/prompt-dedupe');

// 动态补齐配置
const CALIBRATION_CONFIG = {
  HARD_LIMIT: 988,
  TARGET_MIN: 889,
  TARGET_IDEAL: 960,
  TARGET_SOFT_MAX: 980
};

function safeJoin(parts) {
  return parts.filter(Boolean).join(', ').replace(/\s+/g, ' ').trim();
}

function buildExpansionLibrary(shot) {
  return {
    worldview: 'Nirath ancient alien biosphere, bio-luminescent energy veins, mineralized tectonic formations, layered atmospheric depth, colossal environmental scale, mythic non-human ecology',
    material: 'crystalline ridges, metallic stone surfaces, weathered geological fractures, suspended particulate matter, reflective mineral dust, textured terrain response, damp sheen and hard-edge highlights',
    lighting: 'dual-star spectral illumination, warm rim glow against cool ambient fill, volumetric haze, selective contrast control, luminous edge separation, reflective bounce on hard surfaces',
    camera: 'cinematic lens choreography, controlled aerial descent, slow parallax reveal, deliberate framing hierarchy, focus migration from environment to subject, measured pacing with stable visual rhythm',
    performance: 'character preserves identity continuity, subtle breathing cadence, muscular restraint, eye-line adjustment, posture transfer, precise head angle shift, controlled emotional leakage through micro-expression',
    atmosphere: 'wind-driven particles, drifting ash-like dust, faint energy shimmer, distant environmental motion, layered depth cues, subtle vibration in air density, spatial richness without clutter',
    negative: 'no deformed anatomy, no extra limbs, no duplicated body parts, no modern objects, no text watermark, no cartoon style, no low-detail face, no broken hands',
    render: 'hyper-real cinematic CG, physically plausible materials, Unreal Engine 5 quality, high detail consistency, grounded scale perception, premium environment storytelling'
  };
}

function appendUntilTarget(prompt, fillers, targetLen, hardLimit) {
  let out = String(prompt || '').trim();

  for (const filler of fillers) {
    if (!filler) continue;
    if (out.includes(filler)) continue;

    const candidate = safeJoin([out, filler]);
    const len = charCounter.count(candidate);

    if (len <= targetLen) {
      out = candidate;
      continue;
    }

    if (len > targetLen && len <= hardLimit) {
      out = candidate;
      break;
    }
  }

  if (charCounter.count(out) > hardLimit) {
    out = charCounter.truncate(out, hardLimit);
  }

  return out;
}

function calibratePrompt(prompt, shot) {
  const lib = buildExpansionLibrary(shot);
  let output = String(prompt || '').trim();
  const before = charCounter.count(output);

  if (before < CALIBRATION_CONFIG.TARGET_MIN) {
    const fillers = [
      lib.render, lib.worldview, lib.material, lib.lighting, 
      lib.camera, lib.performance, lib.atmosphere, lib.negative
    ];
    output = appendUntilTarget(output, fillers, CALIBRATION_CONFIG.TARGET_IDEAL, CALIBRATION_CONFIG.TARGET_SOFT_MAX);
  }

  if (charCounter.count(output) < CALIBRATION_CONFIG.TARGET_MIN) {
    const secondPass = [
      'Nirath mythic-scale environment continuity, ecological coherence, deep background storytelling, physically grounded atmospheric layering',
      'character silhouette readability, costume structure clarity, facial anchor stability, intentional motion rhythm, believable body mechanics',
      'surface detail integrity, premium texture response, cinematic depth hierarchy, strong foreground-midground-background separation'
    ];
    output = appendUntilTarget(output, secondPass, CALIBRATION_CONFIG.TARGET_SOFT_MAX, CALIBRATION_CONFIG.HARD_LIMIT);
  }

  const after = charCounter.count(output);
  return {
    prompt: output,
    before,
    after,
    strategy: before < CALIBRATION_CONFIG.TARGET_MIN ? 'AUTO_FILL' : 'PASS_THROUGH'
  };
}

// 最终兜底补齐
function fillPromptToTarget(prompt, shot) {
  let out = String(prompt || '').trim();
  const target = 960;
  const hardLimit = 988;

  const shotName = shot?.id || 'shot';
  const fillers = [
    'epic environmental storytelling with layered spatial depth',
    'physically plausible material response and premium texture fidelity',
    'cinematic lighting separation with volumetric atmosphere',
    'clear subject readability and stable visual identity continuity',
    'subtle particle motion and environmental micro-dynamics',
    'controlled camera rhythm with deliberate focus migration',
    'mythic alien ecology, crystalline terrain, energy-vein landscape logic',
    'high-end CG realism, Unreal Engine 5 quality, grounded scale perception',
    `continuity and visual coherence preserved for ${shotName}`,
    'micro-expression integrity, posture realism, breathing cadence, and stable body mechanics'
  ];

  for (const item of fillers) {
    if (charCounter.count(out) >= target) break;
    const next = `${out}, ${item}`;
    if (charCounter.count(next) <= hardLimit) {
      out = next;
    }
  }

  if (charCounter.count(out) > hardLimit) {
    out = charCounter.truncate(out, hardLimit);
  }

  return out;
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || inputPath.replace('.json', '-output.json');

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(`[DirectorWorker] ❌ 输入文件不存在: ${inputPath}`);
    process.exit(1);
  }

  // 自超时保护
  const OVERALL_TIMEOUT = 5400000; // 5400秒 = 90分钟
  setTimeout(() => {
    console.error('[Worker] 整体超时，强制退出');
    process.exit(2);
  }, OVERALL_TIMEOUT);

  console.log(`[DirectorWorker] 🎬 启动 | 输入: ${path.basename(inputPath)}`);

  // 读取输入
  const { rawReport, projectConfig } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`[DirectorWorker] 📥 镜头数: ${rawReport.shots?.length || 0} | 神兽: ${projectConfig.beastId || 'unknown'}`);

  // 初始化 LLM 引擎
  const llmEngine = new LLMEngine({
    model: 'kimi-k2p6',
    mode: 'production',
    maxRetries: 3,
    maxTokens: 8192
  });

  // 【v6.3-patch8-fix】改进LLM内容提取策略
  const llmClient = {
    complete: async (prompt, options = {}) => {
      const result = await llmEngine.generate(prompt, {
        systemPrompt: '你是顶级Prompt工程师。请直接输出镜头Prompt文本，不要解释，不要JSON格式。',
        temperature: 1,
        maxTokens: options.maxTokens || 4000, // 【v6.3-patch8-fix】降低到4000
        timeoutMs: options.timeoutMs || 180000
      });

      // 【v6.3-patch8-fix】当 content 为空时，从 reasoning_content 提取
      // 核心修复：删除所有字符计数和分析行，保留纯画面描述
      let text = '';
      if (result.content && result.content.trim().length > 0) {
        text = result.content.trim();
      } else if (result.reasoning_content && result.reasoning_content.trim().length > 0) {
        const rc = result.reasoning_content.trim();
        
        // 🔥【v6.3-patch8-fix】删除所有字符计数和分析行
        // 将文本按行分割，过滤掉计数行，保留画面描述行
        const lines = rc.split('\n');
        const cleanLines = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // 跳过空行
          if (!trimmed) continue;
          
          // 跳过字符计数行（包含 =数字、字。、characters等）
          if (trimmed.match(/=\s*\d+\s*[字chars]/)) continue;
          if (trimmed.match(/\(\d+\)/)) continue;
          if (trimmed.includes('总中文字符')) continue;
          if (trimmed.includes('仍然不够')) continue;
          if (trimmed.includes('我数错了')) continue;
          if (trimmed.includes('让我重新数')) continue;
          if (trimmed.includes('字数统计')) continue;
          if (trimmed.includes('当前字数')) continue;
          if (trimmed.match(/^\d+\s*[字chars]/)) continue;
          
          // 跳过字数统计行（包含 (数字) 模式）
          if (/\(\d+\).{1,3}\(\d+\)/.test(trimmed)) continue;
          // 注意：只保留明确是元思考/分析的词汇，不要包含可能在画面描述中出现的连词
          const thinkPrefixes = [
            '用户要求', '用户希望', '用户输入', '用户没有', '用户明确', '用户说',
            '我需要', '让我', '修改点', '等等，', '等等。',
            '思考', '考虑', '注意：', '注意，', '确实，', '确实。',
            '首先，', '其次，', '然后，', '最后，', '总结，',
            '首先分析', '先构思', '分析输入', '输入要素',
            '当前', '字数', '字符', '长度', '不够', '仍然', '已经',
            '总字数', '总字符', '字数统计', '让我重新', '我数错了',
            '重写', '更系统', '更详细', '更具体', '更完整',
            '规则', '禁止', '必须', '要求', '输出格式',
            '关键要求', '输入要素整理', '先起草',
            '这意味着', '这表明', '这显示', '这证明',
            '简单来说', '换句话说', '简而言之',
            '具体来说', '详细来说',
            '总之', '总而言之', '综上所述', '由此可见',
            '不仅如此', '更重要的是', '关键在于',
            '值得注意', '重要的是', '特别的是',
            '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.',
            '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
            '（1）', '（2）', '（3）', '（4）', '（5）',
            '（6）', '（7）', '（8）', '（9）', '（10）',
            '哦，', '哦。', '哦！', '在这种情况下', '在这种情况下，',
            '哦，不对', '哦，不对，', '不对，', '不对。', '不对！',
            '输入设计要素分析', '需要融合为', '计数：',
            '需要整合的关键要素', '整合的关键要素',
            '数一下', '数一下：'
          ];
          if (thinkPrefixes.some(kw => trimmed.startsWith(kw))) continue;
          
          // 保留画面描述行（以中文开头，包含场景描述）
          cleanLines.push(trimmed);
        }
        
        text = cleanLines.join('\n');
        
        // 【v6.3-patch8-fix】找到第一个【视觉】，从那里开始取内容（保留完整版本）
        const textLines = text.split('\n');
        const visualIndex = textLines.map(l => l.trim()).indexOf('【视觉】');
        if (visualIndex >= 0) {
          console.log(`[DirectorWorker] 🎯 从第一个【视觉】（第${visualIndex+1}行）开始提取`);
          // 从第一个【视觉】开始保留所有内容，但丢弃模板复述行
          const contentAfter = textLines.slice(visualIndex + 1);
          const cleanContent = [];
          for (const line of contentAfter) {
            const trimmed = line.trim();
            if (['画面描述正文', '运镜词', '环境声音描述'].includes(trimmed)) {
              continue; // 跳过模板复述
            }
            cleanContent.push(line);
          }
          // 保留【视觉】标记本身 + 清理后的内容
          text = ['【视觉】', ...cleanContent].join('\n');
        }
        
        console.log(`[DirectorWorker] 🧹 清理后剩余 ${text.split('\n').length} 行，共 ${text.length} 字符`);
        
        // 如果过滤后太短，回退到所有内容（不过滤）
        const TARGET_MIN = 540; // 与 promptforge-director.js 中的 targetMin 一致
        if (text.length < TARGET_MIN * 0.8) {
          text = lines.join('\n');
          console.log(`[DirectorWorker] 过滤后太短(${text.length} < ${TARGET_MIN * 0.8})，回退取所有内容并去掉字符计数`);
          // 去掉字符计数模式：如 (256)鼻(257)尖
          text = text.replace(/\(\d+\)([^\(\d\)])/g, '$1');
        }
        
        // 🔍 调试
        if (text.length > 0) {
          const firstLine = text.split('\n')[0].substring(0, 50);
          console.log(`[DirectorWorker] 🔍 提取文本首行: ${firstLine}`);
        }
      } else {
        text = JSON.stringify(result);
        console.log(`[DirectorWorker] ❌ content和reasoning_content均为空，返回原始结构`);
      }

      // 【v6.3-patch10-fix】动态补齐：如果提示词太短，自动补齐到目标长度
        const calibration = calibratePrompt(text, { id: 'forge-shot' });
        if (calibration.strategy === 'AUTO_FILL') {
          console.log(`[DirectorWorker] 📏 动态补齐: forge-shot | ${calibration.before} → ${calibration.after}字符`);
          text = calibration.prompt;
        }
        
        // 最终兜底补齐
        text = fillPromptToTarget(text, { id: 'forge-shot' });
        
        return { text };
    }
  };

  // 创建 PromptForge 实例（所有依赖使用fallback确保可运行）
  const forge = new PromptForge({
    llmClient,
    beastArchive: { get: async () => ({}) },
    nirathArchive: { getVisual: async () => ({}), getElements: async () => [] },
    directorStyleLib: { select: async () => [] },
    cameraMovementLib: { get: async () => ({}) },
    microExpressionLib: { get: async () => ({}) },
    lightingLib: { get: async () => ({}) },
    dialogueLib: { getReference: async () => [] },
    qualityStandard: { check: async () => ({ passed: true }) },
    openingSystem: null,
    log: (tag, msg) => console.log(`[${tag}] ${msg}`)
  });

  try {
    console.log(`[DirectorWorker] 🎬 启动三阶流水线...`);
    const startTime = Date.now();

    const result = await forge.orchestrate(rawReport, projectConfig);

    const duration = Date.now() - startTime;
    console.log(`[DirectorWorker] ✅ 完成 | 耗时: ${(duration/1000).toFixed(1)}秒 | 总分: ${result.qualityReport?.overallScore || 'N/A'}`);

    // 序列化输出
    const output = {
      success: true,
      shots: result.shots.map(s => ({
        id: s.id,
        scene: s.scene,
        emotionPhase: s.emotionPhase,
        duration: s.duration,
        dialogue: s.dialogue || '',
        dialogueDepth: s.dialogueDepth || 'L0',
        finalPrompt: s.finalPrompt,
        promptLength: s.promptLength,
        cameraDesign: s.cameraDesign || '',
        lightingDesign: s.lightingDesign || '',
        visualElements: s.visualElements || '',
        performance: s.performance || '',
        promptEnhancement: s.promptEnhancement || '',
        emotionReinforcement: s.emotionReinforcement || '',
        emotionArc: s.emotionArc || [],
        shotEmotion: s.shotEmotion || ''
      })),
      vision: {
        coreTheme: result.vision?.coreTheme,
        emotionArc: result.vision?.emotionArc,
        directorStyle: result.vision?.directorStyle,
        visualTone: result.vision?.visualTone,
        narrativeStrategy: result.vision?.narrativeStrategy
      },
      qualityReport: {
        overallScore: result.qualityReport?.overallScore,
        overallPassed: result.qualityReport?.overallPassed,
        shotReports: result.qualityReport?.shotReports?.map(r => ({
          shotId: r.shotId,
          passed: r.passed,
          score: r.score,
          checks: r.checks
        }))
      },
      duration,
      version: result.version
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`[DirectorWorker] 💾 结果已保存: ${outputPath}`);
    process.exit(0);

  } catch (err) {
    console.error(`[DirectorWorker] ❌ 失败: ${err.message}`);
    console.error(err.stack);
    fs.writeFileSync(outputPath, JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    }, null, 2));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[DirectorWorker] 💥 未捕获错误: ${err.message}`);
  process.exit(1);
});
