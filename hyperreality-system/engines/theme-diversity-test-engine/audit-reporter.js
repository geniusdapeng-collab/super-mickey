/**
 * AuditReporter - 审计报告生成器
 * 生成 P0-P3 分级的审计报告
 */

class AuditReporter {
  constructor() {
    this.reports = [];
  }

  addReport(report) {
    this.reports.push(report);
  }

  generateSummary() {
    const allResults = this.reports.flatMap(r => r.results || []);
    const total = allResults.length;
    const passed = allResults.filter(r => r.passed).length;
    const failed = total - passed;

    const bySeverity = { P0: [], P1: [], P2: [], P3: [] };
    for (const r of allResults) {
      if (!r.passed && r.severity) {
        bySeverity[r.severity].push(r);
      }
    }

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : 0,
      bySeverity: {
        P0: { count: bySeverity.P0.length, items: bySeverity.P0 },
        P1: { count: bySeverity.P1.length, items: bySeverity.P1 },
        P2: { count: bySeverity.P2.length, items: bySeverity.P2 },
        P3: { count: bySeverity.P3.length, items: bySeverity.P3 }
      },
      timestamp: new Date().toISOString()
    };
  }

  generateMarkdownReport() {
    const summary = this.generateSummary();
    const lines = [];

    lines.push('# 主题多样性审计报告');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    // 摘要
    lines.push('## 执行摘要');
    lines.push(`- 总测试数: ${summary.total}`);
    lines.push(`- 通过: ${summary.passed}`);
    lines.push(`- 失败: ${summary.failed}`);
    lines.push(`- 通过率: ${summary.passRate}%`);
    lines.push('');

    // 按严重程度
    lines.push('## 问题分级');
    lines.push('');

    for (const [severity, data] of Object.entries(summary.bySeverity)) {
      const emoji = severity === 'P0' ? '🔴' : severity === 'P1' ? '🟠' : severity === 'P2' ? '🟡' : '🔵';
      lines.push(`### ${emoji} ${severity} (${data.count})`);
      
      if (data.count === 0) {
        lines.push('无问题');
      } else {
        for (const item of data.items.slice(0, 10)) {  // 最多显示10条
          lines.push(`- **${item.testId}**: ${item.error || '未通过'}`);
        }
        if (data.count > 10) {
          lines.push(`- ... 还有 ${data.count - 10} 条`);
        }
      }
      lines.push('');
    }

    // 修复建议
    lines.push('## 修复建议');
    lines.push('');

    const p0Items = summary.bySeverity.P0.items;
    if (p0Items.length > 0) {
      lines.push('### 立即修复 (P0)');
      for (const item of p0Items) {
        lines.push(`- [ ] ${item.testId}: ${item.error}`);
      }
      lines.push('');
    }

    const p1Items = summary.bySeverity.P1.items;
    if (p1Items.length > 0) {
      lines.push('### 高优先级 (P1)');
      for (const item of p1Items) {
        lines.push(`- [ ] ${item.testId}: ${item.error}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('报告由 Theme Diversity Test Engine 自动生成');

    return lines.join('\n');
  }

  saveToFile(path) {
    const fs = require('fs');
    const report = this.generateMarkdownReport();
    fs.writeFileSync(path, report, 'utf-8');
    return path;
  }
}

module.exports = { AuditReporter };
