/**
 * render-pipeline-guard.js — 渲染流水线强制检查机制
 * 
 * 核心设计：不是建议，而是强制阻塞
 * - 检查不通过 → 阻止提交 → 给出明确修复指令
 * - 所有检查项必须代码化，不能靠人记住
 * 
 * 这是比 PromptGuardian 更底层的约束：
 * - PromptGuardian = 自动修复Prompt内容
 * - PipelineGuard = 强制检查提交条件，不满足就阻塞
 */

const fs = require('fs');
const path = require('path');

class RenderPipelineGuard {
  constructor(options = {}) {
    this.charactersDir = options.charactersDir || path.join(__dirname, '..', 'characters');
    this.strictMode = options.strictMode !== false; // 默认严格模式
    
    // 强制检查规则（不可绕过）
    this.requiredRules = [
      {
        id: 'REF_IMAGE_ROLE',
        name: 'reference_image角色指定',
        check: (payload) => {
          const images = payload.content?.filter(c => c.type === 'image_url') || [];
          if (images.length === 0) return { pass: true }; // 无图=豁免
          const allHaveRole = images.every(c => c.role === 'reference_image');
          return {
            pass: allHaveRole,
            message: allHaveRole ? null : `${images.filter(c => c.role !== 'reference_image').length} 张图片未指定 role: "reference_image"`,
            fix: '为所有 image_url 内容添加 role: "reference_image"'
          };
        }
      },
      {
        id: 'GENERATE_AUDIO',
        name: '台词音频生成开关',
        check: (payload) => {
          const hasDialogue = payload.content?.some(c => 
            c.type === 'text' && /【台词】/.test(c.text)
          );
          if (!hasDialogue) return { pass: true }; // 无台词=豁免
          const hasAudio = payload.generate_audio === true;
          return {
            pass: hasAudio,
            message: hasAudio ? null : 'Prompt包含台词但 generate_audio 未设为 true',
            fix: '设置 generate_audio: true'
          };
        }
      },
      {
        id: 'REF_IMAGE_COUNT',
        name: '定妆照数量检查',
        check: (payload) => {
          const refImages = payload.content?.filter(c => 
            c.type === 'image_url' && c.role === 'reference_image'
          ) || [];
          if (refImages.length === 0) return { pass: true }; // 无角色=豁免
          const pass = refImages.length >= 3;
          return {
            pass,
            message: pass ? null : `只有 ${refImages.length} 张定妆照，建议至少3-5张`,
            fix: '上传3-5张多角度定妆照（正面、45度、侧面、特写）',
            severity: 'warning' // 警告但不阻塞
          };
        }
      },
      {
        id: 'COSTUME_LOCK',
        name: '服装锁定检查',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const hasCharacter = /陈卓|小G|林警官|角色/.test(text);
          if (!hasCharacter) return { pass: true }; // 无角色=豁免
          const hasCostumeLock = /穿[警护白][服大褂]|身穿/.test(text);
          return {
            pass: hasCostumeLock,
            message: hasCostumeLock ? null : 'Prompt未明确锁定角色服装',
            fix: '在角色描述前添加"穿警服的/穿护士服的/穿白大褂的"'
          };
        }
      },
      {
        id: 'APPEARANCE_ANCHOR',
        name: '外观特征锚定',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const hasPolice = /穿警服/.test(text);
          if (!hasPolice) return { pass: true }; // 非警服=豁免
          const hasAnchor = /警帽|警徽|肩章|领花|胸牌/.test(text);
          return {
            pass: hasAnchor,
            message: hasAnchor ? null : '穿警服但未描述标志性配饰（警帽、警徽等）',
            fix: '添加"佩戴警帽、警徽、肩章、领花、胸牌"',
            severity: 'warning'
          };
        }
      },
      {
        id: 'DIALOGUE_FORMAT',
        name: '台词格式检查',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const dialogues = text.match(/【台词】[^【】]+/g) || [];
          if (dialogues.length === 0) return { pass: true }; // 无台词=豁免
          const badDialogues = dialogues.filter(d => /\|/.test(d));
          return {
            pass: badDialogues.length === 0,
            message: badDialogues.length === 0 ? null : `${badDialogues.length} 句台词包含竖杠 |`,
            fix: '将台词中的 | 替换为 ，'
          };
        }
      },
      {
        id: 'SENSITIVE_WORDS',
        name: '敏感词预检',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const sensitiveWords = ['痛苦', '疼痛', '受伤', '死亡', '血汗'];
          const found = sensitiveWords.filter(w => text.includes(w));
          return {
            pass: found.length === 0,
            message: found.length === 0 ? null : `发现敏感词: ${found.join(', ')}`,
            fix: `替换为中性词: ${found.map(w => `${w}→${this._getReplacement(w)}`).join(', ')}`
          };
        }
      },
      {
        id: 'REFERENCE_FORMAT',
        name: '引用格式检查',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const hasBadFormat = /@image\d+/.test(text);
          return {
            pass: !hasBadFormat,
            message: hasBadFormat ? '使用了错误的引用格式 @imageN' : null,
            fix: '将 @imageN 替换为 图片N'
          };
        }
      },
      {
        id: 'PROMPT_LENGTH',
        name: 'Prompt长度检查',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const maxLength = 1500; // 超短裙系统上限
          return {
            pass: text.length <= maxLength,
            message: text.length <= maxLength ? null : `Prompt ${text.length} 字符，超过 ${maxLength} 上限`,
            fix: `精简Prompt至 ${maxLength} 字符以内`
          };
        }
      },
      {
        id: 'IMAGE_FILE_VALID',
        name: '图片文件有效性',
        check: (payload) => {
          const images = payload.content?.filter(c => 
            c.type === 'image_url' && c.role === 'reference_image'
          ) || [];
          if (images.length === 0) return { pass: true };
          
          // 检查base64数据是否有效
          const invalidImages = images.filter(c => {
            const url = c.image_url?.url || '';
            return !url.startsWith('data:') || url.length < 1000;
          });
          
          return {
            pass: invalidImages.length === 0,
            message: invalidImages.length === 0 ? null : `${invalidImages.length} 张图片数据无效`,
            fix: '重新读取图片文件并转为base64'
          };
        }
      },
      {
        id: 'MULTIMODAL_LIMIT',
        name: '多模态参考数量限制',
        check: (payload) => {
          const images = payload.content?.filter(c => c.type === 'image_url') || [];
          const videos = payload.content?.filter(c => c.type === 'video_url') || [];
          const audios = payload.content?.filter(c => c.type === 'audio_url') || [];
          const total = images.length + videos.length + audios.length;
          
          return {
            pass: total <= 12,
            message: total <= 12 ? null : `参考素材总计 ${total} 个，超过上限 12 个（图片≤9，视频≤3，音频≤3）`,
            fix: `减少参考素材数量：当前图片${images.length}张、视频${videos.length}段、音频${audios.length}段`
          };
        }
      },
      {
        id: 'RESOLUTION_OPT',
        name: '分辨率成本优化',
        check: (payload) => {
          const resolution = payload.resolution;
          if (!resolution) return { pass: true }; // 未设置=豁免
          
          // 检查是否使用1080p进行预览（浪费成本）
          if (resolution === '1080p' && payload._isPreview) {
            return {
              pass: false,
              message: '预览阶段使用1080p，建议先用720p或mini预览',
              fix: '预览阶段使用 resolution: "720p" 或 Seedance 2.0 mini 降低成本',
              severity: 'warning'
            };
          }
          
          return { pass: true };
        }
      },
      {
        id: 'NEGATIVE_PROMPT',
        name: '负向提示词检查',
        check: (payload) => {
          const text = payload.content?.find(c => c.type === 'text')?.text || '';
          const hasNegative = /【负向】/.test(text);
          
          return {
            pass: true, // 不阻塞，仅提示
            message: hasNegative ? null : '未使用负向提示词【负向】标记',
            fix: '如需排除特定元素，可添加【负向】不想要的元素描述',
            severity: 'warning'
          };
        }
      }
    ];
  }

  /**
   * 主入口：强制检查Payload
   * @param {Object} payload - API请求Payload
   * @returns {Object} { pass, errors, warnings }
   */
  check(payload) {
    const errors = [];
    const warnings = [];

    console.log('🔒 【PipelineGuard】启动强制检查...');

    for (const rule of this.requiredRules) {
      const result = rule.check(payload);
      
      if (!result.pass) {
        const item = {
          rule: rule.id,
          name: rule.name,
          message: result.message,
          fix: result.fix
        };
        
        if (result.severity === 'warning') {
          warnings.push(item);
          console.log(`  ⚠️ ${rule.name}: ${result.message}`);
        } else {
          errors.push(item);
          console.log(`  ❌ ${rule.name}: ${result.message}`);
        }
      } else {
        console.log(`  ✅ ${rule.name}`);
      }
    }

    const pass = errors.length === 0;
    
    console.log(`\n📊 检查结果: ${pass ? '✅ 通过' : '❌ 失败'} | 错误:${errors.length} | 警告:${warnings.length}`);

    return { pass, errors, warnings };
  }

  /**
   * 严格模式：不通过就抛异常
   */
  checkStrict(payload) {
    const result = this.check(payload);
    if (!result.pass) {
      const errorMsg = result.errors.map(e => `[${e.rule}] ${e.message}。修复: ${e.fix}`).join('\n');
      throw new Error(`PIPELINE_GUARD_FAILED:\n${errorMsg}`);
    }
    return result;
  }

  _getReplacement(word) {
    const map = {
      '痛苦': '不适',
      '疼痛': '不适',
      '受伤': '受影响',
      '死亡': '严重',
      '血汗': '体液'
    };
    return map[word] || '中性词';
  }
}

module.exports = { RenderPipelineGuard };

// 自测
if (require.main === module) {
  const guard = new RenderPipelineGuard();
  
  // 测试用例：有问题的Payload
  const badPayload = {
    content: [
      { type: 'text', text: '16:9 | 陈卓站在健身房中，痛苦的表情' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } } // 缺少role
    ],
    generate_audio: false
  };
  
  console.log('\n🔍 测试有问题的Payload:');
  const result = guard.check(badPayload);
  console.log('通过:', result.pass);
  console.log('错误:', result.errors.length);
  console.log('警告:', result.warnings.length);
  
  // 测试用例：正确的Payload
  const goodPayload = {
    content: [
      { type: 'text', text: '16:9 | 穿警服的陈卓，佩戴警帽警徽，表情专注 | 【台词】横纹肌溶解，会导致肌肉不适' },
      { type: 'image_url', role: 'reference_image', image_url: { url: 'data:image/jpeg;base64,' + 'A'.repeat(1000) } }
    ],
    generate_audio: true
  };
  
  console.log('\n🔍 测试正确的Payload:');
  const result2 = guard.check(goodPayload);
  console.log('通过:', result2.pass);
}
