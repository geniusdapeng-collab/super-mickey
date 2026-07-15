#!/usr/bin/env node
/**
 * VoiceCraft v9.2.0-Peng — 声音铸造系统
 * 主入口 / CLI
 * 
 * 命令:
 *   vc mine --id C01
 *   vc subtext --scene SC25 --chars C01,C02
 *   vc forge --scene SC25
 *   vc lose-control --scene SC25
 *   vc silence --scene SC25
 *   vc guard --scene SC25
 *   vc state [--scene SC25]
 *   vc export --scene SC25 [--format json+md]
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const VoiceStateBus = require('./voice-state-bus');
const VoiceMiner = require('./agents/voice-miner');
const SubtextWeaver = require('./agents/subtext-weaver');
const DialogueSmith = require('./agents/dialogue-smith');
const LoseControlTrigger = require('./agents/lose-control-trigger');
const SilenceArchitect = require('./agents/silence-architect');
const VoiceGuardian = require('./agents/voice-guardian');

class VoiceCraft {
  constructor(dataDir = './voice-craft-data') {
    this.stateBus = new VoiceStateBus(dataDir);
    this.miner = new VoiceMiner(this.stateBus);
    this.weaver = new SubtextWeaver(this.stateBus);
    this.smith = new DialogueSmith(this.stateBus);
    this.trigger = new LoseControlTrigger(this.stateBus);
    this.architect = new SilenceArchitect(this.stateBus);
    this.guardian = new VoiceGuardian(this.stateBus);
  }

  // 1. 声纹提取
  async mine(opts = {}) {
    const { characterId } = opts || {};
    console.log(`\n🔍 [VoiceCraft] 声纹提取: ${characterId}`);

    // 从PersonaVault加载角色数据（如果可用）
    const personaData = opts.personaData || await this.loadPersonaData(characterId) || this.generateMockPersona(characterId);

    const signature = await this.miner.extract({
      characterId,
      personaData
    });

    console.log(`✅ 声纹已提取: ${signature.signature.vocabularyFingerprint?.signatureWords?.length} 个签名词`);
    return signature;
  }

  // 2. 潜台词铺设
  async subtext(opts = {}) {
    const { sceneId, characters = [], personaData = {} } = opts || {};
    console.log(`\n🌊 [VoiceCraft] 潜台词铺设: ${sceneId}`);

    const subtextMap = await this.weaver.weave({
      sceneId,
      sceneContext: opts.sceneContext || {},
      characters,
      personaData
    });

    console.log(`✅ 潜台词已铺设: ${Object.keys(subtextMap).length} 句`);
    return subtextMap;
  }

  // 3. 对白锻造
  async forge(opts = {}) {
    const { sceneId } = opts || {};
    console.log(`\n🔨 [VoiceCraft] 对白锻造: ${sceneId}`);

    const signatures = opts.voiceSignatures || this.stateBus.getFullState().signatures || {};
    const subtextMap = opts.subtextMap || await this.stateBus.getSubtext(sceneId);

    if (!subtextMap) {
      throw new Error(`场景 ${sceneId} 没有潜台词数据，请先执行 subtext`);
    }

    const draft = await this.smith.forge({
      sceneId,
      voiceSignatures: signatures,
      subtextMap,
      sceneRequirements: opts.sceneRequirements || {}
    });

    console.log(`✅ 对白已锻造: ${draft.dialogueSegments?.length} 段, 预估 ${draft.estimatedDuration} 秒`);
    return draft;
  }

  // 4. 失控触发
  async loseControl(opts = {}) {
    const { sceneId } = opts || {};
    console.log(`\n💥 [VoiceCraft] 失控检测: ${sceneId}`);

    const draft = opts.dialogueDraft || await this.stateBus.getDialogue(sceneId)?.draft;
    if (!draft) {
      throw new Error(`场景 ${sceneId} 没有对白草稿，请先执行 forge`);
    }

    const result = await this.trigger.trigger({
      sceneId,
      dialogueDraft: draft,
      characterWounds: opts.characterWounds || {},
      sceneIntensity: opts.sceneIntensity || 0.8
    });

    console.log(`✅ 失控检测完成: ${result?.controlMoments?.length || 0} 个失控时刻`);
    return result;
  }

  // 5. 沉默设计
  async silence(opts = {}) {
    const { sceneId } = opts || {};
    console.log(`\n🤫 [VoiceCraft] 沉默设计: ${sceneId}`);

    const final = opts.dialogueFinal || await this.stateBus.getDialogue(sceneId)?.final;
    if (!final) {
      throw new Error(`场景 ${sceneId} 没有对白的final版本，请先执行 lose-control`);
    }

    const result = await this.architect.design({
      sceneId,
      dialogueFinal: final,
      sceneEmotionCurve: opts.sceneEmotionCurve || [],
      keyLines: opts.keyLines || []
    });

    console.log(`✅ 沉默设计完成: ${result?.silenceDesign?.length || 0} 处沉默`);
    return result;
  }

  // 6. 声音校验
  async guard(opts = {}) {
    const { sceneId } = opts || {};
    console.log(`\n🛡️ [VoiceCraft] 声音校验: ${sceneId}`);

    const complete = opts.dialogueComplete || await this.stateBus.getDialogue(sceneId)?.complete;
    if (!complete) {
      throw new Error(`场景 ${sceneId} 没有对白的complete版本，请先执行 silence`);
    }

    const signatures = opts.voiceSignatures || this.stateBus.getFullState().signatures || {};

    const report = await this.guardian.check({
      sceneId,
      dialogueComplete: complete,
      voiceSignatures: signatures,
      checkItems: opts.checkItems || ['syntax', 'vocabulary', 'rhythm', 'emotion-map']
    });

    console.log(`✅ 声音校验完成: ${report?.overallScore || 0}/100`);
    return report;
  }

  // 7. 查看状态
  state(opts = {}) {
    const { sceneId } = opts || {};
    if (sceneId) {
      return {
        dialogue: this.stateBus.getDialogue(sceneId),
        subtext: this.stateBus.getSubtext(sceneId),
        silences: this.stateBus.getSilences(sceneId)
      };
    }
    return this.stateBus.getFullState();
  }

  // 8. 导出完整对白
  export(opts = {}) {
    const { sceneId, format = 'json+md' } = opts || {};
    console.log(`\n📤 [VoiceCraft] 导出: ${sceneId}`);

    const state = this.stateBus.getFullState();
    const signatures = state.signatures || {};
    const dialogue = state.dialogues?.[sceneId]?.complete || state.dialogues?.[sceneId]?.final || state.dialogues?.[sceneId]?.draft;
    const subtext = state.subtexts?.[sceneId];
    const silences = state.silences?.[sceneId];

    if (format === 'json') {
      return { signatures, dialogue, subtext, silences };
    }

    // Markdown格式
    let md = `# VoiceCraft 输出 — ${sceneId}\n\n`;

    // 签名
    md += `## 角色声纹\n\n`;
    for (const [cid, sig] of Object.entries(signatures)) {
      md += `### ${sig.characterName || cid}\n`;
      const v = sig.signature?.vocabularyFingerprint || {};
      md += `- 签名词: ${v.signatureWords?.join('、') || '无'}\n`;
      md += `- 自称: ${v.selfReference || '我'}\n`;
      md += `- 侮辱风格: ${v.insultStyle || '无'}\n\n`;
    }

    // 对白
    if (dialogue?.dialogueSegments) {
      md += `## 对白设计\n\n`;
      for (const seg of dialogue.dialogueSegments) {
        md += `### ${seg.segmentId}\n`;
        if (seg.type === 'silence') {
          md += `> **沉默** — ${seg.text}\n\n`;
        } else {
          md += `**${seg.speaker}**: ${seg.text}\n`;
          md += `- 情绪: ${seg.emotion}\n`;
          md += `- 表演: ${seg.deliveryNote}\n`;
          if (seg.subtext) md += `- 潜台词: ${seg.subtext}\n`;
          if (seg.seedanceCue) md += `- 视频提示: ${seg.seedanceCue}\n`;
          md += `\n`;
        }
      }
    }

    // 沉默设计
    if (silences?.length > 0) {
      md += `## 沉默设计\n\n`;
      for (const s of silences) {
        md += `### ${s.position}\n`;
        md += `- 类型: ${s.type}\n`;
        md += `- 时长: ${s.duration}秒\n`;
        md += `- 视觉: ${s.visualDirection}\n`;
        md += `- 听觉: ${s.audioDirection}\n`;
        md += `- 效果: ${s.audienceEffect}\n\n`;
      }
    }

    return { json: { signatures, dialogue, subtext, silences }, markdown: md };
  }

  // 工具方法
  async loadPersonaData(characterId) {
    // 尝试从PersonaVault加载
    const pvPath = path.join(process.cwd(), 'persona-vault-data', 'persona-state.json');
    try {
      await fs.access(pvPath);
      const pvState = JSON.parse(await fs.readFile(pvPath, 'utf8'));
      const char = pvState.characters?.[characterId];
      if (char) {
        return {
          name: char.name,
          wound: char.wound,
          breathing: char.breathing,
          role: char.role
        };
      }
    } catch {
      // 忽略加载错误
    }
    return null;
  }

  generateMockPersona(characterId) {
    return {
      name: characterId,
      wound: {
        surface: '未定义的创伤',
        structure: { coreLie: '我很强大', coreNeed: '被认可' },
        existential: '存在本身缺乏根基'
      },
      breathing: {
        pace: '正常',
        volume: '中等',
        silencePattern: '常规沉默'
      },
      role: 'protagonist'
    };
  }
}

// CLI入口
async function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = parseArgs(args.slice(1));

  const vc = new VoiceCraft(params.dataDir || './voice-craft-data');

  switch (command) {
    case 'mine':
      await vc.mine(params);
      break;
    case 'subtext':
      await vc.subtext(params);
      break;
    case 'forge':
      await vc.forge(params);
      break;
    case 'lose-control':
      await vc.loseControl(params);
      break;
    case 'silence':
      await vc.silence(params);
      break;
    case 'guard':
      await vc.guard(params);
      break;
    case 'state':
      console.log(JSON.stringify(vc.state(params), null, 2));
      break;
    case 'export':
      const result = vc.export(params);
      console.log(result.markdown || JSON.stringify(result, null, 2));
      break;
    default:
      console.log(`
VoiceCraft v9.2.0-Peng — 声音铸造系统

命令:
  vc mine --id C01 [--personaData {...}]
  vc subtext --scene SC25 [--chars C01,C02] [--personaData {...}]
  vc forge --scene SC25
  vc lose-control --scene SC25 [--intensity 0.9]
  vc silence --scene SC25
  vc guard --scene SC25
  vc state [--scene SC25]
  vc export --scene SC25 [--format json|json+md]
`);
  }
}

function parseArgs(args) {
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    if (value && !value.startsWith('--')) {
      if (value.includes(',')) {
        params[key] = value.split(',');
      } else if (!isNaN(value) && value.includes('.')) {
        params[key] = parseFloat(value);
      } else {
        params[key] = value;
      }
    } else {
      params[key] = true;
      i--;
    }
  }
  return params;
}

// 直接运行CLI
if (require.main === module) {
  runCLI().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

module.exports = VoiceCraft;