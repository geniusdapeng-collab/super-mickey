/**
 * Feishu Notifier — 飞书通知集成 (v9.2-Peng)
 *
 * 当 Permission Gate 触发 pause 时，自动发送飞书消息通知队长。
 * 支持：
 * - 人工确认请求（渲染/导出等敏感操作）
 * - 预算预警（超 80%）
 * - 风险告警（渲染失败、循环检测等）
 * - 进度汇报（里程碑完成）
 */

import { fileURLToPath } from 'url';
import path from 'path';

// ============ 配置 ============
const NOTIFIER_CONFIG = {
  enabled: true,
  // 通知级别: info | warning | critical
  minLevel: 'warning',
  // 队长 open_id（从消息上下文获取）
  targetUser: process.env.FEISHU_TARGET_USER || 'ou_d23919f714f99866a42561a864d6d433',
  // 通知冷却（相同内容不重复发送）
  cooldownMs: 300000, // 5分钟
  // 进度汇报间隔
  progressIntervalMs: 600000 // 10分钟
};

// 通知历史（防重复）
const notificationHistory = new Map();

// ============ 主入口：发送通知 ============
export async function sendNotification(type, payload) {
  if (!NOTIFIER_CONFIG.enabled) {
    return { sent: false, reason: 'disabled' };
  }

  // 级别过滤
  const level = NOTIFICATION_TYPES[type]?.level || 'info';
  if (!shouldNotify(level)) {
    return { sent: false, reason: 'level_filtered' };
  }

  // 冷却检查
  const cacheKey = `${type}_${payload.projectId || 'global'}`;
  const lastSent = notificationHistory.get(cacheKey);
  if (lastSent && Date.now() - lastSent < NOTIFIER_CONFIG.cooldownMs) {
    return { sent: false, reason: 'cooldown' };
  }

  // 构建消息内容
  const message = buildMessage(type, payload);

  // 发送飞书消息
  try {
    const result = await sendFeishuMessage(message, payload);
    notificationHistory.set(cacheKey, Date.now());
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error('[FeishuNotifier] 发送失败:', error.message);
    return { sent: false, reason: error.message };
  }
}

// ============ 通知类型定义 ============
const NOTIFICATION_TYPES = {
  'permission_request': {
    level: 'warning',
    template: 'permission'
  },
  'budget_warning': {
    level: 'warning',
    template: 'budget'
  },
  'budget_critical': {
    level: 'critical',
    template: 'budget'
  },
  'risk_alert': {
    level: 'critical',
    template: 'risk'
  },
  'progress_milestone': {
    level: 'info',
    template: 'progress'
  },
  'render_complete': {
    level: 'info',
    template: 'progress'
  },
  'style_drift': {
    level: 'warning',
    template: 'style_drift'
  },
  'style_conflict': {
    level: 'warning',
    template: 'style_conflict'
  },
  'style_srs': {
    level: 'info',
    template: 'style_srs'
  },
  'error': {
    level: 'critical',
    template: 'error'
  }
};

function shouldNotify(level) {
  const levels = { info: 0, warning: 1, critical: 2 };
  return levels[level] >= levels[NOTIFIER_CONFIG.minLevel];
}

// ============ 构建消息内容 ============
function buildMessage(type, payload) {
  const templates = {
    permission: () => `🎬 **Seedance 权限确认请求**

**项目**: ${payload.projectName || payload.projectId || '未命名'}
**操作**: ${payload.toolName || '未知操作'}
**预估成本**: $${payload.estimatedCost?.toFixed(2) || '0.00'}
**原因**: ${payload.reason || '需要人工确认'}

${payload.details ? `详情: ${JSON.stringify(payload.details, null, 2).substring(0, 500)}` : ''}

⏳ **等待确认中...**
回复 "确认" 批准执行
回复 "拒绝" 跳过此步骤
回复 "预算+数字" 调整预算（如 "预算20"）`,

    budget: () => `💰 **预算预警**

**项目**: ${payload.projectName || payload.projectId}
**已使用**: $${payload.used?.toFixed(2)} / $${payload.limit?.toFixed(2)}
**使用率**: ${((payload.used / payload.limit) * 100).toFixed(1)}%

${payload.level === 'critical' ? '⚠️ **预算即将耗尽！** 建议暂停高成本操作。' : '建议关注预算使用。'}`,

    risk: () => `🚨 **风险告警**

**项目**: ${payload.projectName || payload.projectId}
**类型**: ${payload.riskType || '未知风险'}
**严重度**: ${payload.severity || 'medium'}
**描述**: ${payload.description || '检测到异常'}

**建议**: ${payload.suggestion || '请检查项目状态'}`,

    progress: () => `✅ **制作进度更新**

**项目**: ${payload.projectName || payload.projectId}
**里程碑**: ${payload.milestone || '进度更新'}
**当前阶段**: ${payload.currentStage || '进行中'}
${payload.budgetUsed ? `**预算使用**: $${payload.budgetUsed.toFixed(2)}` : ''}

${payload.deliverables ? `交付物: ${payload.deliverables.join(', ')}` : ''}`,

    style_drift: () => `🎨 **风格漂移告警**

**项目**: ${payload.projectName || payload.projectId}
**镜头**: #${payload.shotIndex || '?'}
**配方**: ${payload.recipe ? `${payload.recipe.base?.style || ''} + ${payload.recipe.accent?.style || ''}` : '默认'}

**检测到的偏差**:
${payload.violations?.map(v => `- ${v.param}: 偏差 ${v.diff} (阈值 ${v.threshold})`).join('\n') || '无详情'}

系统已自动修正或标记待审。`,

    style_conflict: () => `⚠️ **风格配方冲突检测**

**项目**: ${payload.projectName || payload.projectId}
**配方**: ${payload.recipe ? `${payload.recipe.base?.style || ''} + ${payload.recipe.accent?.style || ''}` : '默认'}

${payload.conflicts?.hard?.length > 0 ? `**硬冲突（阻止保存）**:
${payload.conflicts.hard.map(c => `- ${c.styles.join(' + ')}: ${c.reason}`).join('\n')}` : ''}

${payload.conflicts?.soft?.length > 0 ? `**软冲突（提示警告）**:
${payload.conflicts.soft.map(c => `- ${c.styles.join(' + ')}: ${c.reason}`).join('\n')}` : ''}

${payload.conflicts?.hard?.length > 0 ? '请调整配方后再试。' : '配方可保存，但请注意可能的不协调。'}`,

    style_srs: () => `📊 **风格辨识度评分 (SRS)**

**项目**: ${payload.projectName || payload.projectId}
**总分**: ${payload.srs?.total || 0}/100
**等级**: ${payload.srs?.tier || '未评级'}

**五维度评分**:
- 视觉一致性: ${payload.srs?.dimensions?.visualConsistency || 0}
- 叙事气质独特性: ${payload.srs?.dimensions?.narrativeUniqueness || 0}
- 声音标识性: ${payload.srs?.dimensions?.soundIdentity || 0}
- 节奏独特性: ${payload.srs?.dimensions?.rhythmUniqueness || 0}
- 整体记忆性: ${payload.srs?.dimensions?.memorability || 0}

${payload.srs?.total >= 75 ? '🎉 达到品牌级辨识度标准！' : payload.srs?.total >= 50 ? '⚡ 有风格倾向，继续打磨。' : '💡 风格模糊，建议检查风格DNA执行。'}`,

    error: () => `❌ **制作异常**

**项目**: ${payload.projectName || payload.projectId}
**错误**: ${payload.error || '未知错误'}
**阶段**: ${payload.stage || '未知'}

建议检查日志或重新开始。`
  };

  const template = NOTIFICATION_TYPES[type]?.template || 'progress';
  return templates[template] ? templates[template]() : `通知: ${type}`;
}

// ============ 发送飞书消息 ============
async function sendFeishuMessage(content, payload) {
  // 使用 OpenClaw 的消息工具发送飞书消息
  // 注意：这里使用 feishu_im_user_message 工具（以用户身份发送）

  const target = NOTIFIER_CONFIG.targetUser || payload.targetUser;
  if (!target) {
    throw new Error('未配置目标用户 open_id');
  }

  // 构建消息卡片（更美观）
  const cardContent = buildCardContent(content, payload);

  // 实际发送通过外部调用（因为工具函数在运行时注入）
  // 这里返回待发送内容，由调用方执行实际发送
  return {
    content,
    cardContent,
    target,
    type: 'interactive'
  };
}

function buildCardContent(text, payload) {
  // 构建飞书消息卡片 JSON
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '🎬 Seedance 通知' },
      template: payload.level === 'critical' ? 'red' : payload.level === 'warning' ? 'orange' : 'blue'
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: text } },
      {
        tag: 'action',
        actions: [
          { tag: 'button', text: { tag: 'plain_text', content: '✅ 确认' }, type: 'primary', value: { action: 'approve', projectId: payload.projectId } },
          { tag: 'button', text: { tag: 'plain_text', content: '❌ 拒绝' }, type: 'danger', value: { action: 'reject', projectId: payload.projectId } }
        ]
      }
    ]
  };
}

// ============ 便捷函数 ============

export async function notifyPermissionRequest(projectId, toolName, estimatedCost, reason, details = {}) {
  return sendNotification('permission_request', {
    projectId,
    toolName,
    estimatedCost,
    reason,
    details
  });
}

export async function notifyBudgetWarning(projectId, used, limit, level = 'warning') {
  return sendNotification(level === 'critical' ? 'budget_critical' : 'budget_warning', {
    projectId,
    used,
    limit,
    level
  });
}

export async function notifyRisk(projectId, riskType, severity, description, suggestion) {
  return sendNotification('risk_alert', {
    projectId,
    riskType,
    severity,
    description,
    suggestion
  });
}

export async function notifyProgress(projectId, milestone, currentStage, budgetUsed, deliverables = []) {
  return sendNotification('progress_milestone', {
    projectId,
    milestone,
    currentStage,
    budgetUsed,
    deliverables
  });
}

export async function notifyError(projectId, error, stage) {
  return sendNotification('error', {
    projectId,
    error,
    stage
  });
}

// ============ 风格相关通知（v7.0-Peng-Style）============

export async function notifyStyleDrift(projectId, recipe, violations, shotIndex) {
  return sendNotification('style_drift', {
    projectId,
    recipe,
    violations,
    shotIndex,
    level: 'warning'
  });
}

export async function notifyStyleConflict(projectId, recipe, conflicts) {
  const hasHard = conflicts.hard?.length > 0;
  return sendNotification('style_conflict', {
    projectId,
    recipe,
    conflicts,
    level: hasHard ? 'critical' : 'warning'
  });
}

export async function notifyStyleSRS(projectId, srs, dna) {
  return sendNotification('style_srs', {
    projectId,
    srs,
    dna,
    level: srs.total >= 75 ? 'info' : srs.total >= 50 ? 'warning' : 'critical'
  });
}

// ============ 配置接口 ============
export function setNotifierTarget(userOpenId) {
  NOTIFIER_CONFIG.targetUser = userOpenId;
  console.log(`[FeishuNotifier] 通知目标设置为: ${userOpenId}`);
}

export function setNotifierEnabled(enabled) {
  NOTIFIER_CONFIG.enabled = enabled;
  console.log(`[FeishuNotifier] 通知开关: ${enabled ? '开启' : '关闭'}`);
}

export function getNotifierConfig() {
  return { ...NOTIFIER_CONFIG };
}

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('=== Feishu Notifier 测试 ===');

  // 测试消息构建
  const testPayload = {
    projectId: 'test-123',
    projectName: '品牌宣传短片',
    toolName: 'render-engine',
    estimatedCost: 3.5,
    reason: '需要队长确认是否渲染高清版本'
  };

  const msg = buildMessage('permission_request', testPayload);
  console.log('权限请求消息:');
  console.log(msg);
}
