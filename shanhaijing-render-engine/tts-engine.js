const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Nirath原创世界观TTS旁白引擎 — TTS Narration Engine v12.1-Peng
 * 
 * 职责：
 * - 从字幕文件提取旁白文本
 * - 使用 edge-tts (Microsoft Edge TTS) 生成专业旁白音频
 * - 旁白音频合成到最终视频
 * 
 * v12.1: 基础版 — 整段旁白音频替换原音轨
 * v12.2: 升级 — 按字幕时间点逐句精确对齐
 */

// ========== TTS配置 ==========
const TTS_CONFIG = {
  // 旁白节奏
  sentencePause: '……',    // 句间停顿标记（文本层面）
  
  // 音频参数
  audioFormat: 'mp3',
  sampleRate: 24000,
  
  // 音量平衡
  narrationVolume: 1.0,
  
  // 模式
  mode: 'full',
};

// ========== 音色库 — Nirath原创世界观主题精选 ==========
const VOICE_PRESETS = {
  // 推荐：纪录片旁白男声 — 沉稳大气，专业可靠，适合史诗神话
  yunyang: {
    voice: 'zh-CN-YunyangNeural',
    name: '云扬',
    gender: 'male',
    style: 'News',
    traits: 'Professional, Reliable',
    description: '沉稳大气的新闻播报男声，咬字清晰，节奏稳健，适合纪录片/史诗神话旁白',
    speed: '-5%',      // 稍慢，增加庄重感
    pitch: '+0Hz',
  },

  // 备选：温暖女声 — 适合故事叙述，引导儿童视角
  xiaoxiao: {
    voice: 'zh-CN-XiaoxiaoNeural',
    name: '晓晓',
    gender: 'female',
    style: 'News, Novel',
    traits: 'Warm',
    description: '温暖而专业的女声，适合故事叙述，有亲和力',
    speed: '-5%',
    pitch: '+0Hz',
  },

  // 备选：活力男声 — 适合冒险、动态场景
  yunxi: {
    voice: 'zh-CN-YunxiNeural',
    name: '云希',
    gender: 'male',
    style: 'Novel',
    traits: 'Lively, Sunshine',
    description: '充满活力的年轻男声，适合冒险故事的动态叙事',
    speed: '0%',
    pitch: '+0Hz',
  },

  // 默认：纪录片旁白男声（云扬）
  default: 'yunyang'
};

class TTSEngine {
  constructor(options = {}) {
    this.config = { ...TTS_CONFIG, ...options };
    const presetName = options.voice || VOICE_PRESETS.default;
    this.voice = VOICE_PRESETS[presetName] || VOICE_PRESETS[VOICE_PRESETS.default];
    console.log(`🎙️ [TTSEngine] 旁白音色: ${this.voice.name} (${this.voice.gender}, ${this.voice.style})`);
    console.log(`   描述: ${this.voice.description}`);
  }

  /**
   * 从ASS字幕文件提取纯文本内容
   */
  parseAssSubtitles(assPath) {
    if (!fss.existsSync(assPath)) {
      throw new Error(`ASS文件不存在: ${assPath}`);
    }
    
    const content = fss.readFileSync(assPath, 'utf8');
    const lines = content.split('\n');
    
    const subtitles = [];
    let inEvents = false;
    
    for (const line of lines) {
      if (line.trim() === '[Events]') {
        inEvents = true;
        continue;
      }
      if (inEvents && line.startsWith('Dialogue:')) {
        const parts = line.split(',');
        if (parts.length >= 10) {
          const start = parts[1].trim();
          const end = parts[2].trim();
          const text = parts.slice(9).join(',').trim();
          const cleanText = text.replace(/\{[^}]+\}/g, '').trim();
          
          if (cleanText) {
            subtitles.push({ start, end, text: cleanText });
          }
        }
      }
    }
    
    console.log(`📝 [TTSEngine] 从ASS提取 ${subtitles.length} 句字幕`);
    return subtitles;
  }

  /**
   * 从SRT字幕文件提取纯文本内容
   */
  parseSrtSubtitles(srtPath) {
    if (!fss.existsSync(srtPath)) {
      throw new Error(`SRT文件不存在: ${srtPath}`);
    }
    
    const content = fss.readFileSync(srtPath, 'utf8');
    const blocks = content.split('\n\n');
    
    const subtitles = [];
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const textLines = lines.slice(2);
        
        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          const start = timeMatch[1];
          const end = timeMatch[2];
          const text = textLines.join(' ').trim();
          
          if (text) {
            subtitles.push({ start, end, text });
          }
        }
      }
    }
    
    console.log(`📝 [TTSEngine] 从SRT提取 ${subtitles.length} 句字幕`);
    return subtitles;
  }

  /**
   * 构建完整旁白文本（带停顿标记）
   */
  buildNarrationText(subtitles) {
    const parts = [];
    
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i];
      parts.push(sub.text);
      
      // 句间停顿
      if (i < subtitles.length - 1) {
        parts.push(this.config.sentencePause);
      }
    }
    
    const narration = parts.join(' ');
    console.log(`🎙️ [TTSEngine] 旁白文本构建完成 (${narration.length} 字符)`);
    console.log(`   "${narration.substring(0, 100)}..."`);
    
    return narration;
  }

  /**
   * 使用 edge-tts 生成旁白音频
   * @param {string} text - 旁白文本
   * @param {string} outputPath - 输出音频路径
   * @returns {Promise<Object>} TTS结果
   */
  async generateTTS(text, outputPath) {
    console.log(`🎙️ [TTSEngine] 生成旁白TTS...`);
    console.log(`   音色: ${this.voice.name} (${this.voice.voice})`);
    console.log(`   语速: ${this.voice.speed} | 音调: ${this.voice.pitch}`);
    console.log(`   文本: "${text.substring(0, 60)}..." (${text.length} 字符)`);
    
    try {
      // 构建 edge-tts 命令
      // edge-tts 参数必须用 = 连接（如 --rate=-5%）
      const cmd = `edge-tts --voice="${this.voice.voice}" --rate="${this.voice.speed}" --pitch="${this.voice.pitch}" --text="${text.replace(/"/g, '\\"')}" --write-media="${outputPath}"`;
      
      console.log(`   执行: edge-tts --voice ${this.voice.voice} ...`);
      execSync(cmd, { stdio: 'pipe', timeout: 120000 });
      
      // 检查输出文件
      if (fss.existsSync(outputPath)) {
        const stats = fss.statSync(outputPath);
        console.log(`✅ 旁白生成成功: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
        return {
          success: true,
          outputPath,
          size: stats.size,
          voice: this.voice,
          duration: null // TODO: 通过ffprobe获取
        };
      } else {
        throw new Error('TTS输出文件未生成');
      }
      
    } catch (err) {
      console.error(`❌ [TTSEngine] TTS生成失败: ${err.message}`);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * 旁白音频合成到视频 — 整段替换模式
   * @param {string} videoPath - 输入视频
   * @param {string} audioPath - 旁白音频
   * @param {string} outputPath - 输出视频
   * @returns {boolean} 是否成功
   */
  mixNarrationToVideo(videoPath, audioPath, outputPath) {
    if (!fss.existsSync(videoPath)) {
      console.error(`❌ 视频文件不存在: ${videoPath}`);
      return false;
    }
    if (!fss.existsSync(audioPath)) {
      console.error(`❌ 音频文件不存在: ${audioPath}`);
      return false;
    }
    
    console.log(`🎬 [TTSEngine] 合成旁白到视频...`);
    console.log(`   视频: ${videoPath}`);
    console.log(`   旁白: ${audioPath}`);
    console.log(`   输出: ${outputPath}`);
    
    try {
      // ffmpeg: 替换原音轨为旁白音轨
      // 使用 -shortest 确保以较短的为准（通常是视频长度）
      const cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`;
      execSync(cmd, { stdio: 'inherit', timeout: 300000 });
      
      if (fss.existsSync(outputPath)) {
        const stats = fss.statSync(outputPath);
        console.log(`✅ 合成完成: ${outputPath} (${(stats.size / (1024*1024)).toFixed(1)} MB)`);
        return true;
      }
      return false;
      
    } catch (err) {
      console.error(`❌ 合成失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 完整旁白流程 — 字幕→旁白→视频
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 结果
   */
  async process(options = {}) {
    const {
      videoPath,
      subtitlePath,
      outputPath,
      voice = 'yunyang'
    } = options;
    
    // 如果指定了不同音色，重新设置
    if (voice !== this.voice.voice && VOICE_PRESETS[voice]) {
      this.voice = VOICE_PRESETS[voice];
      console.log(`🎙️ [TTSEngine] 切换旁白音色: ${this.voice.name}`);
    }
    
    console.log('\n🎙️ ==========================================');
    console.log('🎙️ TTS旁白引擎 — v12.1-Peng');
    console.log('🎙️ ==========================================\n');
    
    // Step 1: 解析字幕
    let subtitles;
    if (subtitlePath.endsWith('.ass')) {
      subtitles = this.parseAssSubtitles(subtitlePath);
    } else if (subtitlePath.endsWith('.srt')) {
      subtitles = this.parseSrtSubtitles(subtitlePath);
    } else {
      throw new Error('字幕格式不支持（仅ASS/SRT）');
    }
    
    if (subtitles.length === 0) {
      throw new Error('字幕文件为空');
    }
    
    // Step 2: 构建旁白文本
    const narrationText = this.buildNarrationText(subtitles);
    
    // Step 3: 生成TTS音频
    const tempAudioPath = outputPath.replace(/\.mp4$/, '-narration.mp3');
    const ttsResult = await this.generateTTS(narrationText, tempAudioPath);
    
    if (!ttsResult.success) {
      return {
        success: false,
        stage: 'tts_generation',
        error: ttsResult.error,
        subtitles: subtitles.length
      };
    }
    
    // Step 4: 合成到视频
    const mixSuccess = this.mixNarrationToVideo(videoPath, tempAudioPath, outputPath);
    
    return {
      success: mixSuccess,
      subtitles: subtitles.length,
      narrationLength: narrationText.length,
      videoPath: outputPath,
      audioPath: tempAudioPath,
      voice: this.voice,
      mode: this.config.mode
    };
  }

  /**
   * 快速测试 — 生成单句TTS试听
   * @param {string} text - 测试文本
   * @param {string} outputPath - 输出路径
   */
  async test(text, outputPath) {
    console.log('\n🧪 [TTSEngine] 音色测试');
    console.log(`   音色: ${this.voice.name}`);
    console.log(`   文本: "${text}"`);
    
    const result = await this.generateTTS(text, outputPath);
    
    if (result.success) {
      console.log(`✅ 测试音频已生成: ${outputPath}`);
      console.log(`   请试听，如果不符合主题风格可更换音色`);
      console.log(`   可用音色: yunyang(纪录片男声) | xiaoxiao(温暖女声) | yunxi(活力男声)`);
    }
    
    return result;
  }
}

// ========== 导出 ==========
module.exports = {
  TTSEngine,
  VOICE_PRESETS,
  TTS_CONFIG
};

// ========== 命令行测试 ==========
if (require.main === module) {
  (async () => {
    const engine = new TTSEngine({ voice: process.argv[2] || 'yunyang' });
    
    // 测试ASS解析
    const testAss = `ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans SC,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,AgentX站在浮空晶簇山脉脚下，仰望断裂的天柱
Dialogue: 0,0:00:04.00,0:00:06.50,Default,,0,0,0,,他掌心触摸着风化的远古祭器`;
    
    fss.writeFileSync('/tmp/test.ass', testAss);
    const subs = engine.parseAssSubtitles('/tmp/test.ass');
    console.log('\n🧪 字幕解析结果:', subs);
    
    const text = engine.buildNarrationText(subs);
    console.log('\n🧪 旁白文本:', text);
    
    // 测试TTS生成
    if (process.argv[3] === '--test-tts') {
      console.log('\n🧪 测试TTS生成...');
      await engine.test(text, '/tmp/test-narration.mp3');
    }
    
    fss.unlinkSync('/tmp/test.ass');
  })();
}
