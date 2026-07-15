#!/usr/bin/env node
/**
 * StoryForge-to-Seedance Bridge v4.0-Peng
 * 剧本→视频渲染 Pipeline 桥接层
 * 
 * 将 StoryForge Pro 的剧本产出自动转换为 seedance-director 可消费的格式，
 * 打通从"创意大纲→专业剧本→Seedance渲染→后期成片"的完整闭环。
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

class StoryForgeToSeedanceBridge {
  constructor(storyforgeOutputDir) {
    this.storyforgeDir = storyforgeOutputDir;
    this.universePath = path.join(storyforgeOutputDir, 'story-universe.json');
    // VoiceCraft 角色声纹路径（自动查找）
    this.voiceStatePath = path.join(storyforgeOutputDir, 'voice-craft', 'voice-state.json');
  }

  /**
   * 读取 StoryForge Pro 产出并转换为 Director 输入
   */
  convertToDirectorInput() {
    if (!fss.existsSync(this.universePath)) {
      throw new Error(`story-universe.json 未找到: ${this.universePath}`);
    }

    const universe = JSON.parse(fss.readFileSync(this.universePath, 'utf8'));
    
    return {
      title: (universe.metadata?.title && universe.metadata.title.trim()) ? universe.metadata.title.trim() : '未命名故事',
      outline: this._buildOutline(universe),
      characters: this._buildCharacters(universe),
      style: this._buildStyle(universe),
      duration: this._calculateDuration(universe),
      aspect: universe.metadata?.aspect || '16:9',
      storyforgeMeta: {
        version: 'v4.0-Peng',
        scenes: universe.scenes?.length || 0,
        characters: universe.characters?.length || 0,
        dialogues: universe.dialogues?.length || 0,
        mode: universe.metadata?.mode || 'create'
      }
    };
  }

  /**
   * 将 StoryForge 的角色数据转换为 Director 的字符格式
   * 格式: "名称:物种:特征1+特征2+特征3:签名道具"
   */
  _buildCharacters(universe) {
    const chars = universe.characters || [];
    if (chars.length === 0) return '';

    return chars.map(char => {
      const name = char.name || char.characterId || '未命名';
      const species = this._inferSpecies(char);
      const features = this._extractFeatures(char);
      const signature = this._extractSignature(char);
      return `${name}:${species}:${features}:${signature}`;
    }).join(', ');
  }

  _inferSpecies(char) {
    // 从角色类型推断物种
    const role = char.role || '';
    const personality = char.personality || {};
    
    if (role.includes('protagonist')) return '人形主角';
    if (role.includes('antagonist')) return '反派生物';
    if (role.includes('mentor')) return '导师型角色';
    if (personality?.archetype?.includes('robot') || personality?.archetype?.includes('机甲')) return '机甲/机器人';
    
    return char.type || '人形角色';
  }

  _extractFeatures(char) {
    const features = [];
    const appearance = char.appearance || {};
    const personality = char.personality || {};
    
    // 从 appearance 提取外貌特征
    if (appearance.hair) features.push(appearance.hair);
    if (appearance.eyes) features.push(appearance.eyes);
    if (appearance.build) features.push(appearance.build);
    if (appearance.clothing) features.push(appearance.clothing);
    
    // 从 personality 提取核心特征
    if (personality.dominantTrait) features.push(personality.dominantTrait);
    if (personality.coreFear) features.push(`内心恐惧:${personality.coreFear}`);
    
    // 限制特征数量，保持简洁
    return features.slice(0, 4).join('+') || '标准外貌';
  }

  _extractSignature(char) {
    // 提取标志性道具/元素
    const appearance = char.appearance || {};
    const equipment = char.equipment || {};
    
    if (equipment.weapon) return equipment.weapon;
    if (equipment.accessory) return equipment.accessory;
    if (appearance.signatureItem) return appearance.signatureItem;
    if (appearance.markings) return appearance.markings;
    
    return '无特殊道具';
  }

  /**
   * 构建大纲：从 plot + scenes 提取叙事摘要
   */
  _buildOutline(universe) {
    const plot = universe.plot || {};
    const scenes = universe.scenes || {};
    const metadata = universe.metadata || {};
    const theme = universe.theme || {};
    
    // 优先级: metadata.concept > plot.plotSpine > theme.coreTheme > 默认
    let outline = metadata.concept || plot.plotSpine?.oneLineSummary || theme.coreTheme || '一个精彩的故事';
    
    // 添加场景摘要
    const sceneEntries = Object.values(scenes);
    if (sceneEntries.length > 0) {
      const sceneSummaries = sceneEntries.slice(0, 5).map((s, i) => {
        const action = s.action || s.purpose || '关键场景';
        return `场景${i + 1}: ${action}`;
      }).join('；');
      outline += `。${sceneSummaries}`;
    }
    
    return outline;
  }

  /**
   * 构建风格描述：从 world + cinematography 提取
   */
  _buildStyle(universe) {
    const world = universe.world || {};
    const cinematography = universe.cinematography || {};
    const theme = universe.theme || {};
    
    const parts = [];
    
    // 视觉风格
    if (cinematography.visualStyle) parts.push(cinematography.visualStyle);
    if (world.visualKeywords?.length > 0) parts.push(world.visualKeywords.join(','));
    
    // 色调
    if (cinematography.colorPalette) parts.push(cinematography.colorPalette);
    if (world.atmosphereKeywords?.length > 0) parts.push(world.atmosphereKeywords.join(','));
    
    // 渲染质量
    parts.push('3D国漫CG渲染,UnrealEngine5,工业光魔级VFX');
    
    return parts.join(',') || '3D国漫CG渲染,UnrealEngine5';
  }

  /**
   * 计算总时长
   */
  _calculateDuration(universe) {
    const metadata = universe.metadata || {};
    // 修复：使用 !== undefined && !== null 来支持 duration=0
    if (metadata.duration !== undefined && metadata.duration !== null) {
      return parseInt(metadata.duration);
    }
    
    const scenes = universe.scenes || {};
    return Object.keys(scenes).length * 15; // 默认每场景15秒
  }

  /**
   * 生成导演命令行参数
   */
  generateDirectorArgs(outputDir) {
    const input = this.convertToDirectorInput();
    
    // 检查 voice-state 文件是否存在
    const voiceStatePath = fss.existsSync(this.voiceStatePath) ? this.voiceStatePath : null;
    
    return {
      title: input.title,
      outline: input.outline,
      characters: input.characters,
      style: input.style,
      duration: input.duration,
      aspect: input.aspect,
      outputDir,
      // VoiceCraft 角色声纹路径（仅当文件存在时传递）
      voiceStatePath,
    };
  }

  /**
   * 生成完整的导演命令
   */
  generateDirectorCommand(outputDir) {
    const args = this.generateDirectorArgs(outputDir);
    const charArg = args.characters ? `\\ --characters "${args.characters}"` : '';
    const voiceStateArg = args.voiceStatePath ? `\\ --voice-state "${args.voiceStatePath}"` : '';
    
    return `node skills/seedance-director/scripts/director.js produce \\
  --title "${args.title}" \\
  --outline "${args.outline}"${charArg} \\
  --style "${args.style}" \\
  --duration ${args.duration} \\
  --aspect "${args.aspect}" \\
  --output-dir "${outputDir}"${voiceStateArg}`;
  }

  /**
   * 保存转换后的导演输入到文件（用于调试和审计）
   */
  saveDirectorInput(outputPath) {
    const input = this.convertToDirectorInput();
    fss.writeFileSync(outputPath, JSON.stringify(input, null, 2));
    return outputPath;
  }

  /**
   * 执行完整的 Pipeline：StoryForge → Seedance Director
   */
  async runFullPipeline(directorOutputDir) {
    console.log('🎬 [Seedance Bridge] 启动 StoryForge → Seedance Pipeline');
    
    // 1. 转换输入
    const directorInput = this.convertToDirectorInput();
    console.log(`   ✅ 剧本转换完成: ${directorInput.storyforgeMeta.scenes}场景, ${directorInput.storyforgeMeta.characters}角色`);
    
    // 2. 保存转换记录
    const bridgeLogPath = path.join(this.storyforgeDir, 'seedance-bridge-input.json');
    this.saveDirectorInput(bridgeLogPath);
    console.log(`   ✅ 转换记录已保存: ${bridgeLogPath}`);
    
    // 3. 调用 Director（通过 child_process）
    const { execSync } = require('child_process');
    const cmd = this.generateDirectorCommand(directorOutputDir);
    
    console.log('   🎬 调用 Seedance Director...');
    try {
      const result = execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });
      console.log('   ✅ Director 执行完成');
      return { success: true, output: result, directorOutputDir };
    } catch (e) {
      console.error('   ❌ Director 执行失败:', e.message);
      return { success: false, error: e.message };
    }
  }
}

// CLI 入口
function main() {
  const args = process.argv.slice(2);
  let storyforgeDir = null;
  let directorOutputDir = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--storyforge-dir' || args[i] === '-s') storyforgeDir = args[++i];
    if (args[i] === '--output-dir' || args[i] === '-o') directorOutputDir = args[++i];
  }
  
  if (!storyforgeDir) {
    console.error('用法: node seedance-bridge.js --storyforge-dir <路径> [--output-dir <导演输出路径>]');
    process.exit(1);
  }
  
  const bridge = new StoryForgeToSeedanceBridge(storyforgeDir);
  
  // 仅转换模式（不调用导演）
  if (!directorOutputDir) {
    const input = bridge.convertToDirectorInput();
    console.log(JSON.stringify(input, null, 2));
    return;
  }
  
  // 完整 Pipeline 模式
  bridge.runFullPipeline(directorOutputDir).then(result => {
    if (result.success) {
      console.log('\n✅ Seedance Pipeline 执行成功！');
      console.log(`   输出目录: ${result.directorOutputDir}`);
    } else {
      console.log('\n❌ Seedance Pipeline 执行失败');
      console.log(`   错误: ${result.error}`);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { StoryForgeToSeedanceBridge };