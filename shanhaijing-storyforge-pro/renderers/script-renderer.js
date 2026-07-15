/**
 * Script Renderer v3.6-Peng
 * 将 Story Universe 渲染为标准剧本文档
 * 
 * 输出格式：专业 screenplay.md
 */

class ScriptRenderer {
  render(universe) {
    const lines = [];
    
    // 标题页
    lines.push(`# ${universe.theme?.coreTheme || '未命名作品'}`);
    lines.push('');
    lines.push(`**类型**: ${universe.world?.genre || '未指定'}`);
    lines.push(`**时长**: ${universe.plot?.targetDuration || '未指定'}秒`);
    lines.push(`**基调**: ${universe.theme?.tone || '未指定'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // 世界观简介
    if (universe.world) {
      lines.push('## 世界观');
      lines.push('');
      lines.push(universe.world.worldTagline || '');
      lines.push('');
      lines.push(`**时代**: ${universe.world.era || '未指定'}`);
      lines.push(`**地理**: ${universe.world.geography || '未指定'}`);
      lines.push(`**社会结构**: ${universe.world.socialStructure || '未指定'}`);
      lines.push('');
    }
    
    // 角色表
    if (universe.characters) {
      lines.push('## 角色');
      lines.push('');
      const charEntries = Array.isArray(universe.characters) 
        ? universe.characters.map((c, i) => [c.id || c.characterId || String(i), c])
        : Object.entries(universe.characters);
      charEntries.forEach(([id, char]) => {
        if (!char || typeof char !== 'object') return;
        lines.push(`### ${char.name || id}`);
        lines.push('');
        lines.push(`**角色**: ${char.role || '未指定'}`);
        lines.push(`**物种**: ${char.species || '未指定'}`);
        lines.push(`**外貌**: ${(char.features || []).join(', ')}`);
        lines.push(`**标志性元素**: ${char.signature || '未指定'}`);
        lines.push('');
        lines.push(`**核心欲望**: ${char.interior?.desire || '未指定'}`);
        lines.push(`**核心恐惧**: ${char.interior?.fear || '未指定'}`);
        lines.push(`**相信的谎言**: ${char.interior?.lieTheyBelieve || '未指定'}`);
        lines.push(`**需要接受的真相**: ${char.interior?.truthTheyNeed || '未指定'}`);
        lines.push('');
      });
    }
    
    // 场景剧本
    if (universe.scenes) {
      lines.push('## 剧本');
      lines.push('');
      
      Object.entries(universe.scenes).forEach(([id, scene]) => {
        lines.push(`### ${scene.slugline || id}`);
        lines.push('');
        lines.push(`**时长**: ${scene.durationEstimate || '未指定'}秒`);
        lines.push(`**目的**: ${scene.purpose || '未指定'}`);
        lines.push(`**情绪弧线**: ${scene.emotionalArc || '未指定'}`);
        lines.push('');
        
        // 动作描述
        if (scene.action) {
          lines.push(scene.action);
          lines.push('');
        }
        
        // 对白
        if (scene.dialogues) {
          scene.dialogues.forEach(d => {
            const speaker = d.character || '未知角色';
            const text = d.text || '';
            const parenthetical = d.parenthetical ? ` (${d.parenthetical})` : '';
            const subtext = d.subtext ? ` // 潜台词: ${d.subtext}` : '';
            lines.push(`${speaker}${parenthetical}`);
            lines.push(`    ${text}${subtext}`);
            lines.push('');
          });
        }
        
        lines.push('---');
        lines.push('');
      });
    }
    
    // IP 分析附录
    if (universe.ipAnalysis) {
      lines.push('## 附录：IP 解析');
      lines.push('');
      lines.push(`**精神内核**: ${universe.ipAnalysis.spiritualCore?.coreDNA || '未提取'}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

module.exports = { ScriptRenderer };