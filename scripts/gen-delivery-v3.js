const fs = require('fs');
const input = JSON.parse(fs.readFileSync('/tmp/director-1780367889783-xnvs0v-input.json', 'utf8'));
const shots = input.shots;

let md = '# 饕餮EP01 预生产交付物 v3（v6.2-patch101-fix 验证版）\n\n';
md += '> 生成时间: 2026-06-02 10:41\n';
md += '> 总镜头: ' + shots.length + ' | 总时长: ' + shots.reduce((s, x) => s + x.duration, 0) + '秒\n';
md += '> 版本: v6.2-patch101-fix（场景差异化+时间轴差异化+微表情修复+片头分离）\n\n';
md += '---\n\n';

shots.forEach((shot, idx) => {
  md += '## ' + shot.id + ' | ' + (shot.scene || '未知场景') + ' | ' + shot.duration + '秒\n\n';
  
  const scene = shot.scene || '';
  let comboType = '通用';
  if (scene.includes('片头')) comboType = 'opening-system-v3（片头专用）';
  else if (scene.includes('火山') || scene.includes('熔岩') || scene.includes('岩浆')) comboType = 'volcanic_epic（火山史诗）';
  else if (scene.includes('森林') || scene.includes('丛林')) comboType = 'forest_intimate（森林亲密）';
  else if (scene.includes('沼泽') || scene.includes('湿地') || scene.includes('毒')) comboType = 'swamp_horror（沼泽恐怖）';
  else if (scene.includes('荒原') || scene.includes('沙漠') || scene.includes('戈壁')) comboType = 'wasteland_suspense（荒原悬疑）';
  else if (scene.includes('晶体') || scene.includes('圣殿') || scene.includes('遗迹')) comboType = 'crystal_suspense（晶体悬疑）';
  else if (scene.includes('骸骨') || scene.includes('废墟') || scene.includes('骨骼')) comboType = 'bone_awe（骸骨敬畏）';
  
  md += '**运镜组合**: ' + comboType + '\n';
  
  if (shot.cameraMovement && shot.cameraMovement.timeline && shot.cameraMovement.timeline.segments) {
    const tl = shot.cameraMovement.timeline;
    md += '**时间轴**: ' + (tl.transitionDesc || tl.transitionName || '') + ' | ' + (tl.lightingDesc || tl.lightingName || '') + '\n';
    tl.segments.forEach((s, i) => {
      const st = s.startTime !== undefined ? s.startTime.toFixed(1) : '?';
      const et = s.endTime !== undefined ? s.endTime.toFixed(1) : '?';
      md += '- [' + st + 's-' + et + 's] ' + (s.camera || s.movement || '运镜') + ' | ' + (s.emotion || '') + '\n';
    });
  } else if (shot.cameraMovement) {
    md += '**运镜**: ' + (shot.cameraMovement.description || '无详细时间轴') + '\n';
  }
  
  md += '\n**台词/旁白**: ' + (shot.dialogue || shot.narration || '无') + '\n';
  
  const promptLen = (shot.prompt || '').length;
  md += '**Prompt长度**: ' + promptLen + '字符（' + (promptLen >= 950 ? '✅ 理想' : promptLen >= 800 ? '⚠️ 可用' : '🔴 偏短') + '）\n';
  
  const hasPlaceholder = (shot.prompt || '').includes('****');
  md += '**占位符检查**: ' + (hasPlaceholder ? '🔴 发现残留' : '✅ 已清理') + '\n';
  
  const hasMouthAction = (shot.prompt || '').includes('【口播动作】') || (shot.prompt || '').includes('mouth');
  md += '**嘴部动作**: ' + (shot.mouthAction || '无') + '\n';
  
  md += '\n<details>\n<summary>完整Prompt（点击展开）</summary>\n\n```\n' + (shot.prompt || '无').substring(0, 1500) + (shot.prompt && shot.prompt.length > 1500 ? '\n...[截断，共' + shot.prompt.length + '字符]...' : '') + '\n```\n\n</details>\n\n---\n\n';
});

// 添加问题汇总
md += '\n# 验证问题汇总\n\n';
const issues = [];
shots.forEach(s => {
  if ((s.prompt || '').includes('****')) issues.push(s.id + ': 占位符残留');
  if ((s.prompt || '').length < 800) issues.push(s.id + ': Prompt偏短(' + (s.prompt || '').length + '字符)');
});

if (issues.length === 0) {
  md += '✅ 所有镜头无占位符残留\n';
} else {
  md += '## 发现 ' + issues.length + ' 个问题\n';
  issues.forEach(i => md += '- ' + i + '\n');
}

md += '\n## 核心待修复（系统级）\n';
md += '- [P0] STAGE-9 运镜输出未被 buildPromptV3 消费：S01/S02 cameraMovement.timeline 存在但 prompt 中无时间轴描述\n';
md += '- [P1] 5镜 Prompt \u003c 950字符，空间未充分利用（L2降级提示）\n';
md += '- [P1] narration-scene 对齐度 0-8%，场景名与叙述内容不匹配\n';
md += '- [P2] 片头合规：缺少英文副标题\n';

fs.writeFileSync('/root/.openclaw/workspace/output/taotie-ep01-preproduction-delivery-2026-06-02-v3.md', md);
console.log('Delivery v3 generated: ' + md.length + ' chars');
