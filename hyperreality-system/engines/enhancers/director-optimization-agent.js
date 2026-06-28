/**
 * Director Optimization Agent — 导演优化 Agent (SuperMickey 适配版)
 *
 * 来源: 暴风战斧 director-optimization-agent.js
 * 适配: SuperMickey 四层架构，在 Layer 2 后调用
 *
 * 核心能力：
 * 1. 四维评分：故事性 30%、连贯性 25%、视觉语言 25%、风格一致性 20%
 * 2. 自动迭代优化（通过 LLM 调用，降级保护）
 * 3. 通过阈值 4.0/5.0，最大迭代 3 次
 * 4. 降级保护：LLM 调用失败不阻断 Pipeline
 */

class DirectorOptimizationAgent {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.threshold = options.threshold || 4.0; // 4.0/5.0
    this.maxIterations = options.maxIterations || 3;
    this.weights = options.weights || {
      story: 0.30,
      continuity: 0.25,
      visual: 0.25,
      style: 0.20
    };

    // LLM 配置（降级保护）
    this.llmEnabled = options.llmEnabled !== false;
    this.llmModel = options.llmModel || process.env.STORMAXE_LLM_MODEL || 'kimi-k2p6';
    this.llmTimeout = options.llmTimeout || 180000;
    this.llmMaxRetries = options.llmMaxRetries || 2;
  }

  /**
   * SuperMickey 主入口：优化 shots
   * @param {Array} shots - shots 数组
   * @param {Object} metadata - 元数据
   * @returns {Object} { shots, score, iterations, improved }
   */
  async optimize(shots, metadata = {}) {
    if (!this.enabled || !shots || shots.length === 0) {
      return { shots, score: 5.0, iterations: 0, improved: false };
    }

    console.log('\n🎬 [DirectorOptimizationAgent] 导演优化...');

    let currentShots = [...shots];
    let currentScore = this._score(currentShots, metadata);
    let iterations = 0;
    let improved = false;

    console.log(`   初始评分: ${currentScore.toFixed(2)}/5.0`);

    // 迭代优化
    while (currentScore < this.threshold && iterations < this.maxIterations) {
      iterations++;
      console.log(`   迭代 ${iterations}/${this.maxIterations}...`);

      try {
        const optimized = await this._optimizeWithLLM(currentShots, metadata, currentScore);
        if (optimized && optimized.shots) {
          const newScore = this._score(optimized.shots, metadata);
          if (newScore > currentScore) {
            currentShots = optimized.shots;
            currentScore = newScore;
            improved = true;
            console.log(`   优化后评分: ${currentScore.toFixed(2)}/5.0`);
          } else {
            console.log(`   优化未提升评分，停止迭代`);
            break;
          }
        }
      } catch (err) {
        console.warn(`   ⚠️ LLM 优化失败 (降级保护): ${err.message}`);
        // 降级：使用规则-based 优化
        const ruleOptimized = this._optimizeWithRules(currentShots, metadata);
        const newScore = this._score(ruleOptimized, metadata);
        if (newScore > currentScore) {
          currentShots = ruleOptimized;
          currentScore = newScore;
          improved = true;
          console.log(`   规则优化后评分: ${currentScore.toFixed(2)}/5.0`);
        } else {
          break;
        }
      }
    }

    if (currentScore >= this.threshold) {
      console.log(`   ✅ 导演优化通过: ${currentScore.toFixed(2)}/5.0`);
    } else {
      console.log(`   ⚠️ 导演优化未达阈值: ${currentScore.toFixed(2)}/5.0 (阈值: ${this.threshold})`);
    }

    return {
      shots: currentShots,
      score: currentScore,
      iterations,
      improved
    };
  }

  // ========== 私有方法 ==========

  _score(shots, metadata) {
    // 四维评分：故事性、连贯性、视觉语言、风格一致性
    const storyScore = this._scoreStory(shots, metadata);
    const continuityScore = this._scoreContinuity(shots);
    const visualScore = this._scoreVisual(shots);
    const styleScore = this._scoreStyle(shots, metadata);

    return (
      storyScore * this.weights.story +
      continuityScore * this.weights.continuity +
      visualScore * this.weights.visual +
      styleScore * this.weights.style
    );
  }

  _scoreStory(shots, metadata) {
    // 故事性：检查是否有起承转合结构
    let score = 3.0;

    const types = shots.map(s => String(s.type || '').toLowerCase());
    const hasOpening = types.some(t => t.includes('opening') || t.includes('establish'));
    const hasClimax = types.some(t => t.includes('climax') || t.includes('reveal'));
    const hasResolution = types.some(t => t.includes('resolution') || t.includes('ending'));

    if (hasOpening) score += 0.5;
    if (hasClimax) score += 0.5;
    if (hasResolution) score += 0.5;

    // 检查是否有情绪变化
    const emotions = shots.map(s => String(s.emotion || '').toLowerCase());
    const uniqueEmotions = new Set(emotions);
    if (uniqueEmotions.size >= 2) score += 0.5;

    return Math.min(5.0, score);
  }

  _scoreContinuity(shots) {
    // 连贯性：检查相邻镜头是否有逻辑连接
    if (shots.length < 2) return 3.0;

    let score = 3.0;
    let continuityCount = 0;

    for (let i = 1; i < shots.length; i++) {
      const prev = shots[i - 1];
      const curr = shots[i];

      // 检查是否有过渡
      if (curr.transition || curr._transitionType) {
        continuityCount++;
      }
      // 检查情绪是否连贯
      const prevEmotion = String(prev.emotion || '').toLowerCase();
      const currEmotion = String(curr.emotion || '').toLowerCase();
      if (prevEmotion === currEmotion || prevEmotion && currEmotion) {
        continuityCount++;
      }
    }

    const continuityRatio = continuityCount / (shots.length - 1);
    score += continuityRatio * 2.0;

    return Math.min(5.0, score);
  }

  _scoreVisual(shots) {
    // 视觉语言：检查镜头多样性
    if (shots.length === 0) return 3.0;

    let score = 3.0;

    const cameras = shots.map(s => String(s.camera || '').toLowerCase());
    const uniqueCameras = new Set(cameras);
    if (uniqueCameras.size >= 3) score += 0.5;
    if (uniqueCameras.size >= 5) score += 0.5;

    const lightings = shots.map(s => String(s.lighting || '').toLowerCase());
    const uniqueLightings = new Set(lightings);
    if (uniqueLightings.size >= 2) score += 0.5;

    const distances = shots.map(s => String(s.distance || '').toLowerCase());
    const uniqueDistances = new Set(distances);
    if (uniqueDistances.size >= 2) score += 0.5;

    return Math.min(5.0, score);
  }

  _scoreStyle(shots, metadata) {
    // 风格一致性：检查是否保持统一风格
    let score = 3.0;

    const style = metadata.style?.primary || '';
    if (!style) return 3.0;

    let consistentCount = 0;
    for (const shot of shots) {
      const promptText = shot.prompt || shot.description || '';
      if (promptText.includes(style)) {
        consistentCount++;
      }
    }

    const consistencyRatio = consistentCount / shots.length;
    score += consistencyRatio * 2.0;

    return Math.min(5.0, score);
  }

  async _optimizeWithLLM(shots, metadata, currentScore) {
    // 简化版：返回 null，降级到规则优化
    // 在实际部署中，这里可以调用 LLM 进行优化
    return null;
  }

  _optimizeWithRules(shots, metadata) {
    // 规则-based 优化
    const optimized = [...shots];

    // 1. 确保片头有 opening hook
    if (optimized.length > 0) {
      const first = optimized[0];
      if (!first.type || first.type === 'scene') {
        first.type = 'opening';
      }
    }

    // 2. 确保有 climax 镜头
    if (optimized.length > 2) {
      const mid = Math.floor(optimized.length / 2);
      if (!optimized[mid].type || optimized[mid].type === 'scene') {
        optimized[mid].type = 'climax';
      }
    }

    // 3. 确保最后有 resolution
    if (optimized.length > 1) {
      const last = optimized[optimized.length - 1];
      if (!last.type || last.type === 'scene') {
        last.type = 'resolution';
      }
    }

    // 4. 添加过渡
    for (let i = 1; i < optimized.length; i++) {
      if (!optimized[i].transition) {
        optimized[i].transition = 'smooth';
      }
    }

    return optimized;
  }
}

module.exports = { DirectorOptimizationAgent };
