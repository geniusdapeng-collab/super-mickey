/**
 * 战报复盘官 — 自动生成器
 * 读取memory文件，提取关键信息，生成战报飞书文档
 */

const fs = require('fs');
const path = require('path');

class BattleReportGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, 'templates', 'default.md');
    this.outputDir = path.join(__dirname, 'outputs');
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // 读取memory文件并解析
  parseMemory(memoryFilePath) {
    const content = fs.readFileSync(memoryFilePath, 'utf8');
    const sections = this._splitIntoSections(content);
    
    return {
      date: this._extractDate(memoryFilePath),
      events: this._extractEvents(sections),
      systemVersion: this._extractVersion(content),
      captainQuotes: this._extractCaptainQuotes(content),
      problems: this._extractProblems(content),
      solutions: this._extractSolutions(content),
      lessons: this._extractLessons(content)
    };
  }

  // 生成战报
  generate(data) {
    const template = fs.readFileSync(this.templatePath, 'utf8');
    
    let report = template;
    
    // 替换所有模板变量
    report = this._replaceVariable(report, 'issueType', this._determineIssueType(data));
    report = this._replaceVariable(report, 'summary', this._generateSummary(data));
    report = this._replaceVariable(report, 'date', data.date);
    report = this._replaceVariable(report, 'systemVersion', data.systemVersion || '未知');
    report = this._replaceVariable(report, 'difficultyStars', this._calculateDifficulty(data));
    report = this._replaceVariable(report, 'timeSpent', this._calculateTimeSpent(data));
    report = this._replaceVariable(report, 'captainQuote', data.captainQuotes[0] || '无');
    
    report = this._replaceVariable(report, 'background', this._generateBackground(data));
    report = this._replaceVariable(report, 'problemDescription', this._generateProblemDescription(data));
    report = this._replaceVariable(report, 'severity', this._determineSeverity(data));
    report = this._replaceVariable(report, 'manifestation', this._generateManifestation(data));
    
    report = this._replaceVariable(report, 'difficulties', this._generateDifficulties(data));
    report = this._replaceVariable(report, 'struggles', this._generateStruggles(data));
    
    report = this._replaceVariable(report, 'captainFirstReaction', this._generateCaptainFirstReaction(data));
    report = this._replaceVariable(report, 'captainPrinciples', this._generateCaptainPrinciples(data));
    report = this._replaceVariable(report, 'captainKeyCommands', this._generateCaptainKeyCommands(data));
    
    report = this._replaceVariable(report, 'initialAnalysis', this._generateInitialAnalysis(data));
    report = this._replaceVariable(report, 'hypotheses', this._generateHypotheses(data));
    report = this._replaceVariable(report, 'verificationProcess', this._generateVerificationProcess(data));
    report = this._replaceVariable(report, 'mistakes', this._generateMistakes(data));
    
    report = this._replaceVariable(report, 'rootCauseAnalysis', this._generateRootCauseAnalysis(data));
    report = this._replaceVariable(report, 'solution', this._generateSolution(data));
    report = this._replaceVariable(report, 'codeChanges', this._generateCodeChanges(data));
    report = this._replaceVariable(report, 'verificationTests', this._generateVerificationTests(data));
    report = this._replaceVariable(report, 'releaseProcess', this._generateReleaseProcess(data));
    
    report = this._replaceVariable(report, 'results', this._generateResults(data));
    report = this._replaceVariable(report, 'lessons', this._generateLessons(data));
    
    report = this._replaceVariable(report, 'relatedFiles', this._generateRelatedFiles(data));
    report = this._replaceVariable(report, 'keyLogs', this._generateKeyLogs(data));
    report = this._replaceVariable(report, 'renderRecords', this._generateRenderRecords(data));
    
    return report;
  }

  // 保存战报
  save(report, issueType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `battle-report-${issueType}-${timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, report, 'utf8');
    console.log(`✅ 战报已保存: ${filepath}`);
    
    return filepath;
  }

  // 辅助方法
  _splitIntoSections(content) {
    return content.split(/\n---\n/);
  }

  _extractDate(memoryFilePath) {
    const basename = path.basename(memoryFilePath, '.md');
    return basename;
  }

  _extractEvents(sections) {
    return sections.map(section => {
      const lines = section.split('\n');
      const title = lines[0].replace(/^#+\s*/, '');
      const content = lines.slice(1).join('\n');
      return { title, content };
    });
  }

  _extractVersion(content) {
    const match = content.match(/v\d+\.\d+(?:-patch\d+)?/);
    return match ? match[0] : null;
  }

  _extractCaptainQuotes(content) {
    const quotes = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('队长') && (line.includes('"') || line.includes('“'))) {
        const match = line.match(/[""]([^""]+)[""]/);
        if (match) quotes.push(match[1]);
      }
    }
    
    return quotes;
  }

  _extractProblems(content) {
    const problems = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.match(/问题|错误|失败|缺失|bug|阻塞/i)) {
        problems.push(line.replace(/^#+\s*/, '').trim());
      }
    }
    
    return problems;
  }

  _extractSolutions(content) {
    const solutions = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.match(/修复|解决|方案|新增|修改|升级/i)) {
        solutions.push(line.replace(/^#+\s*/, '').trim());
      }
    }
    
    return solutions;
  }

  _extractLessons(content) {
    const lessons = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.match(/教训|经验|原则|忠告|铁律/i)) {
        lessons.push(line.replace(/^#+\s*/, '').trim());
      }
    }
    
    return lessons;
  }

  _determineIssueType(data) {
    const problems = data.problems.join(' ');
    
    if (problems.includes('FPV')) return 'FPV缺失';
    if (problems.includes('角色') || problems.includes('形象')) return '角色一致性';
    if (problems.includes('Prompt')) return 'Prompt合规';
    if (problems.includes('API') || problems.includes('参数')) return 'API调用';
    if (problems.includes('合并') || problems.includes('重构')) return '系统重构';
    
    return '系统问题';
  }

  _generateSummary(data) {
    const firstProblem = data.problems[0] || '未知问题';
    return firstProblem.substring(0, 50);
  }

  _calculateDifficulty(data) {
    const problemCount = data.problems.length;
    if (problemCount >= 5) return '⭐⭐⭐⭐⭐';
    if (problemCount >= 3) return '⭐⭐⭐⭐';
    if (problemCount >= 2) return '⭐⭐⭐';
    return '⭐⭐';
  }

  _calculateTimeSpent(data) {
    const events = data.events;
    if (events.length < 2) return '未知';
    
    // 简单估算：每个事件约30分钟
    return `约${events.length * 30}分钟`;
  }

  _replaceVariable(template, variable, value) {
    const regex = new RegExp(`{{${variable}}}`, 'g');
    return template.replace(regex, value || '待补充');
  }

  // 生成各模块内容（简化版）
  _generateBackground(data) {
    return data.events.slice(0, 2).map(e => `- ${e.title}`).join('\n');
  }

  _generateProblemDescription(data) {
    return data.problems.slice(0, 3).map(p => `- ${p}`).join('\n');
  }

  _determineSeverity(data) {
    if (data.problems.some(p => p.includes('BLOCKING'))) return '🔴 BLOCKING（阻塞渲染）';
    if (data.problems.some(p => p.includes('严重'))) return '🟠 严重（影响成片质量）';
    return '🟡 中等（可优化）';
  }

  _generateManifestation(data) {
    return '详见问题描述';
  }

  _generateDifficulties(data) {
    return data.problems.slice(0, 3).map(p => `- ${p}`).join('\n');
  }

  _generateStruggles(data) {
    return data.events.filter(e => e.title.includes('困难') || e.title.includes('失败')).map(e => `- ${e.title}`).join('\n');
  }

  _generateCaptainFirstReaction(data) {
    return data.captainQuotes[0] || '队长发现问题并指出';
  }

  _generateCaptainPrinciples(data) {
    return '详见队长的指导原则';
  }

  _generateCaptainKeyCommands(data) {
    return data.captainQuotes.slice(1, 3).join('\n');
  }

  _generateInitialAnalysis(data) {
    return data.solutions.slice(0, 2).join('\n');
  }

  _generateHypotheses(data) {
    return '详见解决过程';
  }

  _generateVerificationProcess(data) {
    return data.events.filter(e => e.title.includes('测试') || e.title.includes('验证')).map(e => `- ${e.title}`).join('\n');
  }

  _generateMistakes(data) {
    return data.events.filter(e => e.title.includes('错误') || e.title.includes('失误')).map(e => `- ${e.title}`).join('\n');
  }

  _generateRootCauseAnalysis(data) {
    return data.problems.map((p, i) => `${i + 1}. ${p}`).join('\n');
  }

  _generateSolution(data) {
    return data.solutions.slice(0, 5).map(s => `- ${s}`).join('\n');
  }

  _generateCodeChanges(data) {
    return data.solutions.filter(s => s.includes('.js') || s.includes('文件')).join('\n');
  }

  _generateVerificationTests(data) {
    return '详见测试输出';
  }

  _generateReleaseProcess(data) {
    return data.events.filter(e => e.title.includes('发布') || e.title.includes('版本')).map(e => `- ${e.title}`).join('\n');
  }

  _generateResults(data) {
    return data.events.filter(e => e.title.includes('完成') || e.title.includes('通过')).map(e => `- ${e.title}`).join('\n');
  }

  _generateLessons(data) {
    return data.lessons.slice(0, 5).map(l => `- ${l}`).join('\n');
  }

  _generateRelatedFiles(data) {
    return '详见附录';
  }

  _generateKeyLogs(data) {
    return '详见日志';
  }

  _generateRenderRecords(data) {
    return '详见渲染记录';
  }
}

// 主函数
async function main() {
  const memoryFilePath = process.argv[2];
  
  if (!memoryFilePath) {
    console.error('用法: node generator.js <memory-file-path>');
    process.exit(1);
  }

  console.log(`🔍 读取memory文件: ${memoryFilePath}`);
  
  const generator = new BattleReportGenerator();
  const data = generator.parseMemory(memoryFilePath);
  
  console.log(`📊 解析结果:`);
  console.log(`  - 日期: ${data.date}`);
  console.log(`  - 版本: ${data.systemVersion}`);
  console.log(`  - 事件数: ${data.events.length}`);
  console.log(`  - 问题数: ${data.problems.length}`);
  console.log(`  - 解决数: ${data.solutions.length}`);
  console.log(`  - 教训数: ${data.lessons.length}`);
  console.log(`  - 队长金句: ${data.captainQuotes.length}`);
  
  console.log('📝 生成战报...');
  const report = generator.generate(data);
  
  const issueType = generator._determineIssueType(data);
  const outputPath = generator.save(report, issueType);
  
  console.log(`✅ 战报已生成: ${outputPath}`);
  console.log('');
  console.log('💡 下一步:');
  console.log('  1. 用 feishu_create_doc 工具发布为飞书文档');
  console.log('  2. 队长确认后，可发布到公众号/知乎/即刻');
}

main().catch(console.error);
