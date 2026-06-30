/**
 * Phase 3: PromptFusion 串行执行
 * 
 * 职责：
 * - 串行执行 PromptFusion Agent（每镜头独立 LLM 调用）
 * - 动态预算计算（根据镜头数）
 * - 合并 25 字段到 shots
 * - 保存 checkpoint
 */

const { PhaseExecutor } = require('./phase-executor');
const { DialogueTimingCalculator } = require('../../../utils/dialogue-timing-calculator');
const ThemeConfig = require('../../../config/theme-config');

class Phase3PromptFusion extends PhaseExecutor {
  constructor(options) {
    super({ name: 'Phase3-PromptFusion', ...options });
  }

  async execute(state) {
    const { shots, result, adaptedBlueprint } = state;
    const startTime = Date.now();
    const shotCount = shots.length;

    // 动态预算计算
    // 【P0-4 修复】支持 fastMode：预算不足时自动切换
    const PHASE3_PER_SHOT_MS = 90000;   // 标准模式：每镜头90秒
    const PHASE3_FAST_PER_SHOT_MS = 45000; // fastMode：每镜头45秒
    const PHASE3_BUFFER_MS = 30000;     // 30秒缓冲
    
    // 判断是否需要启用 fastMode
    const standardNeedMs = shotCount * PHASE3_PER_SHOT_MS + PHASE3_BUFFER_MS;
    const budgetRemaining = this.budgetRemaining ? this.budgetRemaining() : Infinity;
    const useFastMode = budgetRemaining < standardNeedMs && budgetRemaining > shotCount * PHASE3_FAST_PER_SHOT_MS;
    
    const perShotMs = useFastMode ? PHASE3_FAST_PER_SHOT_MS : PHASE3_PER_SHOT_MS;
    const needMs = shotCount * perShotMs + PHASE3_BUFFER_MS;

    this.log('PHASE-3', `📊 动态预算: ${shotCount}镜头 × ${perShotMs/1000}s${useFastMode ? '(fastMode)' : ''} + ${PHASE3_BUFFER_MS/1000}s缓冲 = 需${Math.round(needMs/1000)}s`);
    if (useFastMode) {
      this.log('PHASE-3', '⚡ fastMode 已启用：预算不足，缩短单镜头超时、禁用重试');
    }

    // 预算检查
    // 【v2.1.6-fix】Phase 3 是核心环节，预算不足时告警但继续执行，不可跳过
    const canAfford = this.checkBudget(needMs, 'Phase 3');
    if (!canAfford) {
      this.log('PHASE-3', '⚠️ 预算不足，但 Phase 3 是核心环节，继续执行（可能超时）');
    }

    try {
      // 【v2.1.6-fix】系统级修复：启用长时间任务模式，避免HealthMonitor误判
      if (this.healthMonitor) {
        // 每镜头至少3分钟缓冲，总时长不低于10分钟
        const phase3Timeout = Math.max(shotCount * 180000 + 60000, 600000);
        this.healthMonitor.setLongTaskMode('ProductionEngine', true, phase3Timeout);
      } else {
        console.log('[Phase3PromptFusion] ⚠️ healthMonitor 未设置，长时间任务模式未启用');
      }

      this.log('PROMPT-FUSION-AGENT', `开始(串行模式,${shotCount}镜头,${useFastMode ? 'fastMode,' : ''}预计${Math.round(needMs/1000)}s)...`);
      
      // 【P0-4 修复】fastMode 下调整 Agent 配置
      if (useFastMode && this.agents.promptFusion) {
        this.agents.promptFusion.llmTimeout = PHASE3_FAST_PER_SHOT_MS;
        this.agents.promptFusion.llmMaxRetries = 0; // fastMode 禁用重试
        this.log('PHASE-3', '⚡ fastMode 配置已下发：timeout=45s, retries=0');
      }
      
      const pfResult = await this.agents.promptFusion.process(
        this.cloneShots(shots), 
        adaptedBlueprint
      );

      // 合并 25 字段
      const newShots = this.mergeShots(shots, pfResult.shots, [
        'prompt', 'enhanced_prompt', 'negative_prompt', 'fields', 'fusionText', 'promptCharCount',
        'director_instruction', 'constraint', 'baseline', 'scene', 'lighting', 'composition',
        'color_palette', 'depth_of_field', 'camera_movement', 'character', 'costume', 'makeup',
        'action', 'props', 'portraits', 'dialogue', 'timeline', 'mood', 'pacing', 'transition',
        'audio', 'negative', 'bright_constraint', 'character_constraint', 'consistency'
      ]);

      // 【v2.2.0-Phase3】台词-镜头时长映射检查
      const timingCheckedShots = await this._checkDialogueTiming(newShots, adaptedBlueprint);

      result.llmStats.promptFusion = pfResult.timing;
      
      const timing = Date.now() - startTime;
      this.log('PROMPT-FUSION-AGENT', `完成 (${timing}ms)`);

      // 保存 checkpoint
      await this.saveCheckpoint('phase3', timingCheckedShots, {
        opening: result.opening,
        llmStats: result.llmStats
      });

      return { success: true, shots: timingCheckedShots, result, timing };
    } catch (e) {
      this.log('PROMPT-FUSION-FAIL', `❌ ${e.message},部分镜头降级到规则 Prompt`);
      return { success: false, shots, result, timing: Date.now() - startTime, error: e.message };
    } finally {
      // 【v2.1.6-fix】系统级修复：关闭长时间任务模式
      if (this.healthMonitor) {
        this.healthMonitor.setLongTaskMode('ProductionEngine', false);
      }
    }
  }
  /**
   * 【v2.2.0-Phase3】台词-镜头时长映射检查
   * 在 PromptFusion 后、checkpoint 前执行
   * - 检测台词溢出（台词时长 > 镜头时长）
   * - 检测台词占比过高（>80%）
   * - 根据类型自动选择调整策略
   */
  async _checkDialogueTiming(shots, blueprint) {
    // 获取视频类型以确定调整策略
    const videoType = blueprint?.config?.type || blueprint?.type || 'EDU';
    const typeConfig = ThemeConfig.getType(videoType) || ThemeConfig.getType('EDU');
    
    // 根据类型选择策略：EDU/MARKETING/FAMILY 优先保台词（延长镜头），DRAMA/CINE/ART 优先保节奏（缩短台词）
    const strategy = ['EDU', 'MARKETING', 'FAMILY', 'DOC'].includes(videoType) ? 'extend' : 'shorten';
    
    const calculator = new DialogueTimingCalculator({
      autoAdjust: true,
      adjustStrategy: strategy
    });

    this.log('DIALOGUE-TIMING', `开始检查 (${videoType} 类型, 策略:${strategy})...`);
    
    const checkResult = calculator.validateShots(shots);
    
    if (checkResult.criticalCount > 0) {
      this.log('DIALOGUE-TIMING', `⚠️ 发现 ${checkResult.criticalCount} 个镜头台词溢出，自动调整中...`);
    }
    if (checkResult.warningCount > 0) {
      this.log('DIALOGUE-TIMING', `⚡ 发现 ${checkResult.warningCount} 个镜头台词占比过高`);
    }
    
    // 应用自动修复到 shots
    const adjustedShots = shots.map((shot, index) => {
      const result = checkResult.results[index];
      if (!result || !result.hasDialogue) return shot;
      
      const metadata = {
        dialogueTiming: {
          checked: true,
          dialogueDuration: result.dialogueDuration,
          shotDuration: result.shotDuration,
          ratio: result.ratio,
          severity: result.severity,
          issue: result.issue
        }
      };
      
      // 如果有 autoFix，应用修复
      if (result.autoFix) {
        metadata.dialogueTiming.autoFix = result.autoFix;
        
        if (result.autoFix.type === 'shorten_dialogue' && shot.dialogue) {
          // 应用缩短后的台词
          const suggestedText = result.autoFix.suggestedText;
          if (suggestedText && shot.dialogue.lines) {
            shot.dialogue.lines[0].text = suggestedText;
            this.log('DIALOGUE-TIMING', `✂️ ${shot.shot_id || shot.shotId}: 台词已缩短 ${result.autoFix.originalChars}→${result.autoFix.targetChars} 字`);
          }
        } else if (result.autoFix.type === 'extend_shot') {
          // 延长镜头时长
          const newDuration = result.autoFix.suggestedDuration;
          if (shot.duration !== undefined) {
            shot.duration = newDuration;
            this.log('DIALOGUE-TIMING', `⏱️ ${shot.shot_id || shot.shotId}: 镜头时长已延长 ${result.autoFix.originalDuration}→${newDuration}s`);
          } else if (shot.timing) {
            shot.timing.duration = newDuration;
            this.log('DIALOGUE-TIMING', `⏱️ ${shot.shot_id || shot.shotId}: 镜头时长已延长 ${result.autoFix.originalDuration}→${newDuration}s`);
          }
        }
      }
      
      // 合并 metadata 到 shot
      return { ...shot, ...metadata };
    });
    
    this.log('DIALOGUE-TIMING', `完成 | 总镜头:${checkResult.totalShots} | 含台词:${checkResult.shotsWithDialogue} | 严重:${checkResult.criticalCount} | 警告:${checkResult.warningCount}`);
    
    return adjustedShots;
  }
}

module.exports = { Phase3PromptFusion };