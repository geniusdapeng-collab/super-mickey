/**
 * 通知抽象层 (P2-5.2)
 * 通用通知接口，支持多平台（飞书/Discord/Telegram/Email）
 */

const fs = require('fs');
const path = require('path');

// ============ 抽象接口定义 ============
class BaseNotifier {
  constructor(config = {}) {
    this.config = config;
    this.enabled = config.enabled !== false;
    this.minLevel = config.minLevel || 'warning';
    this.cooldownMs = config.cooldownMs || 300000;
    this.history = new Map();
  }

  // 子类必须实现
  async send(content, payload) {
    throw new Error('子类必须实现 send() 方法');
  }

  // 通用发送逻辑（级别过滤 + 冷却）
  async notify(type, payload) {
    if (!this.enabled) return { sent: false, reason: 'disabled' };

    const notificationType = NOTIFICATION_TYPES[type];
    if (!notificationType) return { sent: false, reason: 'unknown_type' };

    const level = notificationType.level || 'info';
    if (!this.shouldNotify(level)) return { sent: false, reason: 'level_filtered' };

    // 冷却检查
    const cacheKey = `${type}_${payload.projectId || 'global'}`;
    const lastSent = this.history.get(cacheKey);
    if (lastSent && Date.now() - lastSent < this.cooldownMs) {
      return { sent: false, reason: 'cooldown' };
    }

    try {
      const content = buildMessage(type, payload);
      const result = await this.send(content, payload);
      this.history.set(cacheKey, Date.now());
      return { sent: true, ...result };
    } catch (error) {
      console.error(`[${this.constructor.name}] 发送失败:`, error.message);
      return { sent: false, reason: error.message };
    }
  }

  shouldNotify(level) {
    const levels = { info: 0, warning: 1, critical: 2 };
    return levels[level] >= levels[this.minLevel];
  }
}

// ============ 通知类型定义 ============
const NOTIFICATION_TYPES = {
  'permission_request': { level: 'warning', template: 'permission' },
  'budget_warning': { level: 'warning', template: 'budget' },
  'budget_critical': { level: 'critical', template: 'budget' },
  'budget_exhausted': { level: 'critical', template: 'budget' },
  'risk_alert': { level: 'critical', template: 'risk' },
  'progress_milestone': { level: 'info', template: 'progress' },
  'render_complete': { level: 'info', template: 'progress' },
  'error': { level: 'critical', template: 'error' },
  'style_drift': { level: 'warning', template: 'style_drift' },
  'style_conflict': { level: 'warning', template: 'style_conflict' },
  'style_srs': { level: 'info', template: 'style_srs' }
};

// ============ 消息构建器 ============
function buildMessage(type, payload) {
  const templates = {
    permission: () => `🎬 **Seedance 权限确认请求**

**项目**: ${payload.projectName || payload.projectId || '未命名'}
**操作**: ${payload.toolName || '未知操作'}
**预估成本**: $${payload.estimatedCost?.toFixed(2) || '0.00'}
**原因**: ${payload.reason || '需要人工确认'}

⏳ **等待确认中...**`,

    budget: () => `💰 **预算预警**

**项目**: ${payload.projectName || payload.projectId}
**已使用**: $${payload.used?.toFixed(2)} / $${payload.limit?.toFixed(2)}
**使用率**: ${((payload.used / payload.limit) * 100).toFixed(1)}%

${payload.level === 'critical' || payload.status === 'budget_exhausted' ? '⚠️ **预算已耗尽！** 新渲染请求被拒绝。' : '建议关注预算使用。'}`,

    risk: () => `🚨 **风险告警**

**项目**: ${payload.projectName || payload.projectId}
**类型**: ${payload.riskType || '未知风险'}
**严重度**: ${payload.severity || 'medium'}
**描述**: ${payload.description || '检测到异常'}`,

    progress: () => `✅ **制作进度更新**

**项目**: ${payload.projectName || payload.projectId}
**里程碑**: ${payload.milestone || '进度更新'}
**当前阶段**: ${payload.currentStage || '进行中'}
${payload.budgetUsed ? `**预算使用**: $${payload.budgetUsed.toFixed(2)}` : ''}`,

    error: () => `❌ **制作异常**

**项目**: ${payload.projectName || payload.projectId}
**错误**: ${payload.error || '未知错误'}
**阶段**: ${payload.stage || '未知'}`,

    style_drift: () => `🎨 **风格漂移告警**

**项目**: ${payload.projectName || payload.projectId}
**镜头**: #${payload.shotIndex || '?'}`,

    style_conflict: () => `⚠️ **风格配方冲突**

**项目**: ${payload.projectName || payload.projectId}`,

    style_srs: () => `📊 **风格辨识度评分**

**项目**: ${payload.projectName || payload.projectId}
**总分**: ${payload.srs?.total || 0}/100`
  };

  const template = NOTIFICATION_TYPES[type]?.template || 'progress';
  return templates[template] ? templates[template]() : `通知: ${type}`;
}

// ============ 飞书实现 ============
class FeishuNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.targetUser = config.targetUser || process.env.FEISHU_TARGET_USER;
  }

  async send(content, payload) {
    if (!this.targetUser) {
      throw new Error('未配置飞书目标用户');
    }

    // 使用 OpenClaw 的 message 工具发送（通过外部调用）
    // 返回待发送内容，由调用方执行实际发送
    return {
      content,
      target: this.targetUser,
      platform: 'feishu',
      type: 'interactive'
    };
  }
}

// ============ Discord 实现 ============
class DiscordNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.webhookUrl = config.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    this.channelId = config.channelId;
  }

  async send(content, payload) {
    if (!this.webhookUrl) {
      throw new Error('未配置 Discord Webhook URL');
    }

    // 使用 discord webhook 格式
    const discordPayload = {
      content: content.substring(0, 2000), // Discord 限制 2000 字符
      embeds: payload.level === 'critical' ? [{
        title: '🚨 Seedance 告警',
        color: 0xff0000,
        description: content.substring(0, 4096),
        timestamp: new Date().toISOString()
      }] : undefined
    };

    return {
      content: discordPayload,
      target: this.webhookUrl,
      platform: 'discord',
      type: 'webhook'
    };
  }
}

// ============ Telegram 实现 ============
class TelegramNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
  }

  async send(content, payload) {
    if (!this.botToken || !this.chatId) {
      throw new Error('未配置 Telegram Bot Token 或 Chat ID');
    }

    // Telegram HTML 格式
    const htmlContent = content
      .replace(/\*\*/g, '') // 移除 Markdown 粗体
      .replace(/\n/g, '\n');

    return {
      content: htmlContent.substring(0, 4096), // Telegram 限制
      target: this.chatId,
      platform: 'telegram',
      type: 'bot_message'
    };
  }
}

// ============ 邮件实现 ============
class EmailNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.smtpConfig = config.smtp;
    this.toAddress = config.toAddress;
  }

  async send(content, payload) {
    if (!this.toAddress) {
      throw new Error('未配置邮件接收地址');
    }

    return {
      content,
      subject: `[Seedance] ${payload.projectName || payload.projectId} - ${payload.type || '通知'}`,
      target: this.toAddress,
      platform: 'email',
      type: 'smtp'
    };
  }
}

// ============ 通知工厂 ============
class NotifierFactory {
  static create(config = {}) {
    const platform = config.platform || 'feishu';

    switch (platform.toLowerCase()) {
      case 'feishu':
      case 'lark':
        return new FeishuNotifier(config);
      case 'discord':
        return new DiscordNotifier(config);
      case 'telegram':
        return new TelegramNotifier(config);
      case 'email':
      case 'smtp':
        return new EmailNotifier(config);
      case 'multi':
        // 多平台通知：同时发送到所有配置的平台
        return new MultiNotifier(config);
      default:
        console.warn(`[NotifierFactory] 未知平台: ${platform}，回退到飞书`);
        return new FeishuNotifier(config);
    }
  }
}

// ============ 多平台通知器 ============
class MultiNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.notifiers = [];
    const platforms = config.platforms || ['feishu'];

    for (const platform of platforms) {
      try {
        const notifier = NotifierFactory.create({ ...config, platform });
        this.notifiers.push(notifier);
      } catch (e) {
        console.warn(`[MultiNotifier] ${platform} 初始化失败: ${e.message}`);
      }
    }
  }

  async send(content, payload) {
    const results = await Promise.allSettled(
      this.notifiers.map(n => n.send(content, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    return {
      platform: 'multi',
      sentCount: successful.length,
      totalCount: this.notifiers.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message })
    };
  }
}

// ============ 便捷函数 ============
async function notifyPermissionRequest(notifier, projectId, toolName, estimatedCost, reason, details = {}) {
  return notifier.notify('permission_request', { projectId, toolName, estimatedCost, reason, details });
}

async function notifyBudgetWarning(notifier, projectId, used, limit, level = 'warning') {
  return notifier.notify(level === 'critical' ? 'budget_critical' : 'budget_warning', { projectId, used, limit, level });
}

async function notifyBudgetExhausted(notifier, projectId, used, limit) {
  return notifier.notify('budget_exhausted', { projectId, used, limit, status: 'budget_exhausted' });
}

async function notifyRisk(notifier, projectId, riskType, severity, description, suggestion) {
  return notifier.notify('risk_alert', { projectId, riskType, severity, description, suggestion });
}

async function notifyProgress(notifier, projectId, milestone, currentStage, budgetUsed, deliverables = []) {
  return notifier.notify('progress_milestone', { projectId, milestone, currentStage, budgetUsed, deliverables });
}

async function notifyError(notifier, projectId, error, stage) {
  return notifier.notify('error', { projectId, error, stage });
}

// ============ 导出 ============
module.exports = {
  BaseNotifier,
  FeishuNotifier,
  DiscordNotifier,
  TelegramNotifier,
  EmailNotifier,
  MultiNotifier,
  NotifierFactory,
  buildMessage,
  notifyPermissionRequest,
  notifyBudgetWarning,
  notifyBudgetExhausted,
  notifyRisk,
  notifyProgress,
  notifyError,
  NOTIFICATION_TYPES
};
