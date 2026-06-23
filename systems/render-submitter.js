'use strict';

const axios = require('axios');
const { createLogger } = require('./logger');
const { requireEnv } = require('./env');
const { resolvePromptText } = require('./prompt-resolver');
const { resolvePortraitsForRole, resolveBestAngles } = require('./portrait-resolver');
const { buildRenderPayload, imageFileToDataUrl } = require('./render-request-builder');
const renderPolicy = require('../config/render-policy');
const { ValidationError, ExternalAPIError } = require('./errors');

const logger = createLogger('render-submitter');

class RenderSubmitter {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.apiUrl =
      options.apiUrl ||
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
    this.model = options.model || 'ep-20260518004622-jp46s';
    this.apiKey = options.apiKey || requireEnv('VOLCENGINE_ARK_API_KEY');
    this.requireReferenceImages =
      options.requireReferenceImages !== undefined
        ? options.requireReferenceImages
        : renderPolicy.requireReferenceImages;
  }

  extractCharactersFromShot(shot) {
    const set = new Set();

    // 1. 显式 characters
    if (Array.isArray(shot.characters)) {
      for (const item of shot.characters) {
        if (typeof item === 'string') set.add(item);
        if (item && typeof item === 'object') {
          if (item.id) set.add(item.id);
          else if (item.name) set.add(item.name);
        }
      }
    }

    // 2. 从 prompt 文本兜底提取
    const prompt = resolvePromptText(shot);
    const knownRoles = [
      'xiaoG',
      '小G',
      'tao-tie',
      'taotie',
      '饕餮',
      'jiu-wei-hu',
      '九尾狐',
      'zhu-long',
      '烛龙',
      'xing-tian',
      '刑天',
      'baiZe',
      '白泽'
    ];

    for (const role of knownRoles) {
      if (prompt.includes(role)) {
        set.add(role);
      }
    }

    return Array.from(set);
  }

  normalizeRoleId(role) {
    const map = {
      '小G': 'xiaoG',
      '饕餮': 'tao-tie',
      'taotie': 'tao-tie',
      '九尾狐': 'jiu-wei-hu',
      '烛龙': 'zhu-long',
      '刑天': 'xing-tian',
      '白泽': 'baiZe'
    };

    return map[role] || role;
  }

  collectReferenceImages(shot) {
    const shotType = shot.type || shot.shotType || '';
    const rawRoles = this.extractCharactersFromShot(shot);
    const roleIds = rawRoles.map(r => this.normalizeRoleId(r));

    const referenceImages = [];

    for (const roleId of roleIds) {
      const portraits = resolvePortraitsForRole(this.workspaceRoot, roleId);
      if (!portraits.found) {
        logger.warn('角色无定妆照', { roleId, shotId: shot.id || shot.shotId });
        continue;
      }

      const bestAngles = resolveBestAngles(portraits, shotType);

      for (const angleItem of bestAngles) {
        referenceImages.push({
          roleId,
          angle: angleItem.angle,
          path: angleItem.path,
          dataUrl: imageFileToDataUrl(angleItem.path)
        });
      }
    }

    return referenceImages;
  }

  async submitShot(shot, options = {}) {
    const promptText = resolvePromptText(shot);
    if (!promptText) {
      throw new ValidationError('镜头没有可提交的Prompt', {
        details: { shotId: shot.id || shot.shotId }
      });
    }

    const referenceImages = this.collectReferenceImages(shot);

    if (this.requireReferenceImages && referenceImages.length === 0) {
      throw new ValidationError('镜头需要参考图，但未找到任何定妆照', {
        details: {
          shotId: shot.id || shot.shotId,
          characters: this.extractCharactersFromShot(shot)
        }
      });
    }

    const payload = buildRenderPayload({
      model: options.model || this.model,
      shot,
      referenceImages,
      ratio: options.ratio || renderPolicy.defaultRatio,
      resolution: options.resolution || renderPolicy.defaultResolution
    });

    logger.info('提交渲染请求', {
      shotId: shot.id || shot.shotId,
      promptLength: promptText.length,
      referenceImageCount: referenceImages.length,
      duration: payload.duration,
      ratio: payload.ratio,
      resolution: payload.resolution
    });

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        timeout: 180000
      });

      logger.info('渲染请求提交成功', {
        shotId: shot.id || shot.shotId,
        taskId: response.data?.id || response.data?.taskId || null
      });

      return {
        success: true,
        shotId: shot.id || shot.shotId,
        payload,
        response: response.data
      };
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message;

      logger.error('渲染请求提交失败', {
        shotId: shot.id || shot.shotId,
        error: message
      });

      throw new ExternalAPIError(`渲染提交失败: ${message}`, {
        details: {
          shotId: shot.id || shot.shotId,
          response: err.response?.data || null
        }
      });
    }
  }

  async submitBatch(shots, options = {}) {
    const results = [];

    for (const shot of shots) {
      try {
        const result = await this.submitShot(shot, options);
        results.push({ shotId: shot.id || shot.shotId, success: true, result });
      } catch (err) {
        // 【v2.1.4-fix10-P25-fix5】单镜头失败不中断整批
        console.error(`[RenderSubmitter] 镜头 ${shot.id || shot.shotId} 提交失败: ${err.message}`);
        results.push({ 
          shotId: shot.id || shot.shotId, 
          success: false, 
          error: err.message 
        });
      }
    }

    return {
      submitted: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = {
  RenderSubmitter
};