/**
 * TaskLogger - 任务全链路审计日志系统
 * 
 * 每个新任务创建独立logger，记录从PRD加载到闸机决策的全部环节
 * 最终生成完整Markdown文档留档，支持回溯和自我监督
 */

const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

class TaskLogger {
  constructor({ taskName, codename, version, agent = 'Seedance-v20' }) {
    this.taskId = `${codename}_${version}_${this._formatTime()}`;
    this.meta = {
      taskName,
      codename,
      version,
      agent,
      startTime: new Date().toISOString(),
      stages: [],
      status: 'RUNNING'
    };
    this.stages = [];
    this.currentStage = null;
  }

  _formatTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  }

  _timestamp() {
    return new Date().toISOString();
  }

  /**
   * 记录环节开始
   * @param {string} stageName - 环节名称: PRD_LOAD/STORY_GENERATE/PROMPT_ASSEMBLE/PRD_CALIBRATE/STORY_SCORE/GATE_DECISION
   * @param {object} data - 环节详细数据
   */
  logStage(stageName, data = {}) {
    const stage = {
      name: stageName,
      timestamp: this._timestamp(),
      data: data,
      checks: this._getStageChecks(stageName, data)
    };
    this.stages.push(stage);
    this.currentStage = stageName;
    
    // 控制台打印（便于实时查看）
    console.log(`\n[${stageName}] ${this._timestamp()}`);
    console.log(`  数据项: ${Object.keys(data).length}个`);
    
    return stage;
  }

  /**
   * 获取环节的监督检查项
   */
  _getStageChecks(stageName, data) {
    const checks = {
      PRD_LOAD: [
        { name: 'meta完整', check: !!data.meta?.title, required: true },
        { name: 'core完整', check: !!data.core?.theme, required: true },
        { name: 'characters完整', check: !!data.characters && Object.keys(data.characters).length > 0, required: true },
        { name: 'structure完整', check: !!data.structure?.acts && data.structure.acts.length > 0, required: true },
        { name: 'negative完整', check: !!data.negative?.forbiddenActions, required: true },
        { name: 'calibrationRules完整', check: !!data.calibrationRules && Object.keys(data.calibrationRules).length > 0, required: true }
      ],
      STORY_GENERATE: [
        { name: '有分镜数据', check: !!data.shots && data.shots.length > 0, required: true },
        { name: '有情绪弧线', check: !!data.emotionalArc && data.emotionalArc.length > 0, required: true },
        { name: '有叙事目的', check: !!data.narrativePurposes && data.narrativePurposes.length > 0, required: true },
        { name: '符合目标镜数', check: data.shots?.length >= 10, required: false } // 警告但不阻断
      ],
      PROMPT_ASSEMBLE: [
        { name: '每镜有Prompt', check: !!data.l3Action && data.l3Action.length > 0, required: true },
        { name: 'Prompt含角色', check: data.l4Character && data.l4Character.length > 0, required: true },
        { name: 'Prompt含约束', check: !!data.l5Constraints, required: true }
      ],
      PRD_CALIBRATE: [
        { name: '执行了角色检查', check: !!data.characterChecks && data.characterChecks.length > 0, required: true },
        { name: '执行了情绪检查', check: !!data.emotionChecks && data.emotionChecks.length > 0, required: true },
        { name: '执行了Prompt检查', check: !!data.promptChecks && data.promptChecks.length > 0, required: true },
        { name: '记录了偏离项', check: !!data.deviations, required: true }
      ],
      STORY_SCORE: [
        { name: '有4维度评分', check: !!data.dimensions && Object.keys(data.dimensions).length >= 4, required: true },
        { name: '有最终得分', check: typeof data.finalScore === 'number', required: true },
        { name: '有通过状态', check: typeof data.passed === 'boolean', required: true }
      ],
      GATE_DECISION: [
        { name: '有决策动作', check: !!data.action, required: true },
        { name: '有评分记录', check: typeof data.score === 'number', required: true },
        { name: '有反馈信息', check: !!data.feedback, required: true }
      ]
    };
    
    return checks[stageName] || [];
  }

  /**
   * 完成日志，生成报告
   */
  finalize(finalData = {}) {
    this.meta.endTime = this._timestamp();
    this.meta.status = 'COMPLETED';
    this.meta.duration = new Date(this.meta.endTime) - new Date(this.meta.startTime);
    
    // 生成报告
    const report = this.generateReport(finalData);
    
    // 保存文件
    const date = this.meta.startTime.split('T')[0];
    const logsDir = path.join(process.cwd(), 'logs', date);
    if (!fss.existsSync(logsDir)) {
      fss.mkdirSync(logsDir, { recursive: true });
    }
    
    const filename = `Task_${this.taskId}.md`;
    const filepath = path.join(logsDir, filename);
    fss.writeFileSync(filepath, report, 'utf8');
    
    console.log(`\n📄 审计日志已保存: ${filepath}`);
    console.log(`   任务: ${this.meta.taskName}`);
    console.log(`   环节: ${this.stages.length}/6`);
    console.log(`   耗时: ${this.meta.duration}ms`);
    
    return filepath;
  }

  /**
   * 生成完整Markdown报告
   */
  generateReport(finalData = {}) {
    const lines = [];
    
    // 标题
    lines.push(`# 任务审计日志: ${this.meta.taskName}`);
    lines.push(`**任务ID**: ${this.taskId}`);
    lines.push(`**时间**: ${this.meta.startTime}`);
    lines.push(`**状态**: ${this.meta.status}`);
    lines.push(`**版本**: ${this.meta.version}`);
    lines.push(`**引擎**: ${this.meta.agent}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // 环节详情
    for (const stage of this.stages) {
      lines.push(`## 环节: ${stage.name}`);
      lines.push(`**时间**: ${stage.timestamp}`);
      lines.push('');
      
      // 数据摘要
      lines.push('### 数据记录');
      lines.push(this._formatStageData(stage.name, stage.data));
      lines.push('');
      
      // 监督检查
      lines.push('### 自我监督');
      for (const check of stage.checks) {
        const status = check.check ? '✅' : (check.required ? '❌' : '⚠️');
        const label = check.required ? '（必填）' : '（建议）';
        lines.push(`- ${status} ${check.name}${label}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    
    // 执行总结
    lines.push('## 执行总结');
    lines.push(`- **总耗时**: ${this.meta.duration}ms`);
    lines.push(`- **环节数**: ${this.stages.length}/6`);
    lines.push(`- **完成状态**: ${this.meta.status}`);
    
    if (finalData.calibrationSummary) {
      lines.push(`- **校准结果**: ${finalData.calibrationSummary.passed}通过 / ${finalData.calibrationSummary.failed}偏离`);
    }
    if (typeof finalData.finalScore === 'number') {
      lines.push(`- **最终评分**: ${finalData.finalScore}/100`);
    }
    if (finalData.gateAction) {
      lines.push(`- **闸机决策**: ${finalData.gateAction}`);
    }
    lines.push('');
    
    // 完整性检查
    lines.push('## 完整性检查');
    const requiredStages = ['PRD_LOAD', 'STORY_GENERATE', 'PROMPT_ASSEMBLE', 'PRD_CALIBRATE', 'STORY_SCORE', 'GATE_DECISION'];
    const executedStages = this.stages.map(s => s.name);
    
    for (const stage of requiredStages) {
      const done = executedStages.includes(stage);
      lines.push(`- ${done ? '✅' : '❌'} ${stage}`);
    }
    lines.push('');
    
    // 问题与警告
    const issues = this._collectIssues();
    if (issues.length > 0) {
      lines.push('## ⚠️ 问题与警告');
      for (const issue of issues) {
        lines.push(`- ${issue}`);
      }
      lines.push('');
    }
    
    lines.push('---');
    lines.push(`*日志生成时间: ${new Date().toISOString()}*`);
    
    return lines.join('\n');
  }

  /**
   * 格式化环节数据为Markdown
   */
  _formatStageData(stageName, data) {
    const lines = [];
    
    switch (stageName) {
      case 'PRD_LOAD':
        lines.push(`**标题**: ${data.meta?.title || 'N/A'}`);
        lines.push(`**代号**: ${data.meta?.codename || 'N/A'}`);
        lines.push(`**主题**: ${data.core?.theme || 'N/A'}`);
        lines.push(`**情绪弧线**: ${(data.core?.emotionalArc || []).join(' → ')}`);
        lines.push(`**角色数**: ${Object.keys(data.characters || {}).length}`);
        lines.push(`**幕数**: ${(data.structure?.acts || []).length}`);
        lines.push(`**禁忌数**: ${(data.negative?.forbiddenActions || []).length + (data.negative?.forbiddenVisuals || []).length}`);
        lines.push(`**校准规则**: ${Object.values(data.calibrationRules || {}).flat().length}条`);
        break;
        
      case 'STORY_GENERATE':
        lines.push(`**生成镜头数**: ${(data.shots || []).length}`);
        lines.push(`**情绪序列**: ${(data.emotionalArc || []).join(' → ')}`);
        lines.push('');
        lines.push('**分镜列表**:');
        for (const shot of (data.shots || []).slice(0, 5)) {
          lines.push(`- ${shot.shotId}: [${shot.emotion}] ${shot.narrativePurpose?.substring(0, 60)}...`);
        }
        if ((data.shots || []).length > 5) {
          lines.push(`- ... 共${data.shots.length}镜`);
        }
        break;
        
      case 'PROMPT_ASSEMBLE':
        lines.push(`**组装镜头数**: ${(data.l3Action || []).length}`);
        lines.push('');
        lines.push('**Prompt示例** (前3镜):');
        for (let i = 0; i < Math.min(3, (data.l3Action || []).length); i++) {
          const action = data.l3Action[i];
          lines.push(`\n**镜${i + 1}**:`);
          lines.push('```');
          lines.push(action.substring(0, 200) + '...');
          lines.push('```');
        }
        break;
        
      case 'PRD_CALIBRATE':
        lines.push(`**检查项**: ${data.passed + data.failed}项`);
        lines.push(`**通过**: ${data.passed}`);
        lines.push(`**偏离**: ${data.failed}`);
        if ((data.deviations || []).length > 0) {
          lines.push('');
          lines.push('**偏离项**:');
          for (const dev of (data.deviations || []).slice(0, 5)) {
            lines.push(`- ⚠️ ${dev}`);
          }
          if ((data.deviations || []).length > 5) {
            lines.push(`- ... 共${data.deviations.length}项`);
          }
        }
        break;
        
      case 'STORY_SCORE':
        lines.push(`**最终评分**: ${data.finalScore}/100`);
        lines.push(`**通过状态**: ${data.passed ? '✅ 通过' : '❌ 未通过'}`);
        lines.push('');
        lines.push('**维度得分**:');
        for (const [dim, scoreData] of Object.entries(data.dimensions || {})) {
          lines.push(`- ${dim}: ${scoreData.score}/${scoreData.max} (权重${scoreData.weight}%)`);
        }
        break;
        
      case 'GATE_DECISION':
        lines.push(`**决策**: ${data.action}`);
        lines.push(`**评分**: ${data.score}/100`);
        lines.push(`**阈值**: ${data.threshold}`);
        lines.push(`**反馈**: ${data.feedback}`);
        if (data.nextSteps) {
          lines.push(`**下一步**: ${data.nextSteps}`);
        }
        break;
        
      default:
        lines.push(JSON.stringify(data, null, 2).substring(0, 500));
    }
    
    return lines.join('\n');
  }

  /**
   * 收集所有问题
   */
  _collectIssues() {
    const issues = [];
    
    // 检查缺失的必填环节
    const requiredStages = ['PRD_LOAD', 'STORY_GENERATE', 'PROMPT_ASSEMBLE', 'PRD_CALIBRATE', 'STORY_SCORE', 'GATE_DECISION'];
    const executedStages = this.stages.map(s => s.name);
    for (const stage of requiredStages) {
      if (!executedStages.includes(stage)) {
        issues.push(`❌ 缺失必填环节: ${stage}`);
      }
    }
    
    // 检查环节内的必填项
    for (const stage of this.stages) {
      for (const check of stage.checks) {
        if (check.required && !check.check) {
          issues.push(`❌ [${stage.name}] ${check.name}未满足`);
        }
      }
    }
    
    // 检查偏离项
    const calibrateStage = this.stages.find(s => s.name === 'PRD_CALIBRATE');
    if (calibrateStage && calibrateStage.data.failed > 0) {
      issues.push(`⚠️ 校准发现${calibrateStage.data.failed}项偏离`);
    }
    
    // 检查评分
    const scoreStage = this.stages.find(s => s.name === 'STORY_SCORE');
    if (scoreStage && !scoreStage.data.passed) {
      issues.push(`❌ 故事性评分未通过: ${scoreStage.data.finalScore}/100`);
    }
    
    return issues;
  }
}

module.exports = { TaskLogger };
