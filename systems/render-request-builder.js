'use strict';

const fs = require('fs');
const path = require('path');
const { resolvePromptText } = require('./prompt-resolver');
const renderPolicy = require('../config/render-policy');
const { ValidationError } = require('./errors');
const { PromptGuardian } = require('../scripts/prompt-guardian');
const { RenderPipelineGuard } = require('../scripts/render-pipeline-guard');
const { RenderQAChecker } = require('../scripts/render-qa-checker');

function imageFileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const buffer = fs.readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function buildRenderContent({ promptText, referenceImages = [], roleId = null, workspaceRoot = null }) {
  // v6.6.5-fix: PromptGuardian 自动修复
  const guardian = new PromptGuardian();
  
  // 读取角色信息用于Guardian
  const charInfos = [];
  if (roleId && workspaceRoot) {
    const characterCardPath = `${workspaceRoot}/characters/${roleId}/character-card.json`;
    if (fs.existsSync(characterCardPath)) {
      try {
        const card = JSON.parse(fs.readFileSync(characterCardPath, 'utf-8'));
        charInfos.push({
          name: card.name || roleId,
          role: card.role || '',
          tags: card.tags || []
        });
      } catch (e) {
        // ignore
      }
    }
  }

  // v6.5.65-P3-fix: 如果有参考图，在提示词中追加详细特征描述，帮助模型匹配
  let enhancedPrompt = promptText;
  
  if (referenceImages.length > 0 && roleId && workspaceRoot) {
    const characterCardPath = `${workspaceRoot}/characters/${roleId}/character-card.json`;
    if (fs.existsSync(characterCardPath)) {
      try {
        const card = JSON.parse(fs.readFileSync(characterCardPath, 'utf-8'));
        
        // v6.6.5-fix: 注入外观锚定文本（优先级最高，放在最前面）
        const anchor = card.appearanceAnchor?.uniform || card.appearanceAnchor?.default;
        if (anchor) {
          enhancedPrompt = `【角色外观锁定】${anchor}。\n${enhancedPrompt}`;
        }
        
        const visualIdentity = card.visualIdentity?.appearance;
        
        if (visualIdentity) {
          const fragments = [];
          
          if (visualIdentity.face?.promptFragment) {
            fragments.push(`面部特征: ${visualIdentity.face.promptFragment}`);
          }
          if (visualIdentity.hair?.promptFragment) {
            fragments.push(`发型: ${visualIdentity.hair.promptFragment}`);
          }
          if (visualIdentity.bodyType?.promptFragment) {
            fragments.push(`体态: ${visualIdentity.bodyType.promptFragment}`);
          }
          
          if (fragments.length > 0) {
            // 在提示词末尾追加参考图特征描述
            const characterRef = `

【参考图绑定】角色: ${card.name || roleId} | 身份: ${card.role || '未知'} | ${fragments.join(' | ')} | 严格保持角色形象一致性，面部特征、发型、体态必须与参考图完全一致。`;
            enhancedPrompt = enhancedPrompt + characterRef;
          }
        }
      } catch (e) {
        // 读取失败，使用原始提示词
      }
    }
  }

  // v6.6.5-fix: PromptGuardian 自动修复
  const fixResult = guardian.autoFix(enhancedPrompt, charInfos);
  if (fixResult.changed) {
    console.log(`[buildRenderContent] 🔧 PromptGuardian修复了${fixResult.fixes.length}项:`);
    for (const f of fixResult.fixes) {
      console.log(`  - ${f.ruleName}: ${f.message}`);
    }
  }
  enhancedPrompt = fixResult.prompt;

  const content = [];

  content.push({
    type: 'text',
    text: enhancedPrompt
  });

  for (const image of referenceImages) {
    content.push({
      type: 'image_url',
      role: 'reference_image',
      image_url: {
        url: image.dataUrl
      },
      metadata: {
        angle: image.angle,
        roleId: image.roleId
      }
    });
  }

  return { content, fixResult };
}

function buildRenderPayload({
  model,
  shot,
  preproductionData = null,
  referenceImages = [],
  ratio = renderPolicy.defaultRatio,
  resolution = renderPolicy.defaultResolution
}) {
  // v6.5.65-P3-fix: 支持从预生产数据读取完整 prompt
  const promptText = preproductionData 
    ? resolvePromptText(shot, preproductionData)
    : resolvePromptText(shot);

  if (!promptText) {
    throw new ValidationError('镜头缺少可用Prompt', {
      details: { shotId: shot.id || shot.shotId }
    });
  }

  const duration = Number(shot.duration || renderPolicy.minDuration);
  if (duration < renderPolicy.minDuration || duration > renderPolicy.maxDuration) {
    throw new ValidationError(`镜头时长不合法: ${duration}`, {
      details: {
        min: renderPolicy.minDuration,
        max: renderPolicy.maxDuration,
        shotId: shot.id || shot.shotId
      }
    });
  }

  const { content, fixResult } = buildRenderContent({
    promptText,
    referenceImages,
    roleId: referenceImages.length > 0 ? referenceImages[0].roleId : null,
    workspaceRoot: process.cwd()
  });

  // v6.6.5-fix: 构建完整 payload
  const payload = {
    model,
    content,
    ratio,
    duration,
    resolution
  };

  // v6.6.5-fix: 有台词时自动设置 generate_audio
  const hasDialogue = promptText.includes('"') || promptText.includes('"') || 
                      promptText.includes('：') || promptText.includes(':');
  if (hasDialogue) {
    payload.generate_audio = true;
    console.log(`[buildRenderPayload] 🎵 检测到台词，自动设置 generate_audio=true`);
  }

  // v6.6.5-fix: RenderPipelineGuard 强制检查
  const pipelineGuard = new RenderPipelineGuard();
  try {
    pipelineGuard.checkStrict(payload);
    console.log(`[buildRenderPayload] ✅ PipelineGuard 全部通过`);
  } catch (err) {
    console.error(`[buildRenderPayload] ❌ PipelineGuard 阻止提交: ${err.message}`);
    throw err;
  }

  // v6.6.5-fix: QA检查（非阻塞，仅记录警告）
  const qaChecker = new RenderQAChecker({ strict: false });
  const qaContext = { characters: referenceImages.length > 0 ? [{ name: referenceImages[0].roleId }] : [] };
  const qaResult = qaChecker.check(payload, qaContext);
  if (qaResult.warnings.length > 0) {
    console.log(`[buildRenderPayload] ⚠️ QA检查发现${qaResult.warnings.length}项警告:`);
    for (const w of qaResult.warnings) {
      console.log(`  - ${w.name}: ${w.message}`);
    }
  }
  if (qaResult.errors.length > 0) {
    console.error(`[buildRenderPayload] ❌ QA检查发现${qaResult.errors.length}项错误:`);
    for (const e of qaResult.errors) {
      console.error(`  - ${e.name}: ${e.message}`);
    }
  }

  return payload;
}

module.exports = {
  buildRenderPayload,
  imageFileToDataUrl
};
