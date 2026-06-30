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
    this.model = options.model || process.env.SEEDANCE_ENDPOINT || 'YOUR_SEEDANCE_ENDPOINT_ID';
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
    // v6.5.65-P3-fix: 支持传递预生产数据，让 resolvePromptText 使用 stages.style 完整提示词
    const preproductionData = options.preproductionData || null;
    
    const promptText = preproductionData 
      ? resolvePromptText(shot, preproductionData) 
      : resolvePromptText(shot);
    
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
      shot: { ...shot, prompt: promptText },  // 使用解析后的完整 prompt
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

      const taskId = response.data?.id || response.data?.taskId || null;
      logger.info('渲染请求提交成功', {
        shotId: shot.id || shot.shotId,
        taskId
      });

      // v6.6.5-fix: 异步轮询模式
      if (options.asyncMode && taskId) {
        logger.info('进入异步轮询模式', { shotId: shot.id || shot.shotId, taskId });
        const pollResult = await this.pollTaskStatus(taskId, {
          maxWait: options.maxWait || 600,
          initialDelay: options.initialDelay || 5,
          maxDelay: options.maxDelay || 30
        });
        return {
          success: pollResult.status === 'succeeded',
          shotId: shot.id || shot.shotId,
          taskId,
          payload,
          response: pollResult
        };
      }

      return {
        success: true,
        shotId: shot.id || shot.shotId,
        taskId,
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

  // v6.6.5-fix: 异步轮询 + 指数退避
  async pollTaskStatus(taskId, options = {}) {
    const maxWait = options.maxWait || 600; // 默认最大等待10分钟
    const initialDelay = options.initialDelay || 5;
    const maxDelay = options.maxDelay || 30;
    const startTime = Date.now();
    let delay = initialDelay;

    logger.info('开始轮询任务状态', { taskId, maxWait, initialDelay });

    while (Date.now() - startTime < maxWait * 1000) {
      try {
        const response = await axios.get(`${this.apiUrl}/${taskId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          timeout: 30000
        });

        const status = response.data?.status || response.data?.task_status;
        const result = response.data;

        logger.info('任务状态查询', { taskId, status, elapsed: Math.round((Date.now() - startTime) / 1000) });

        if (status === 'succeeded' || status === 'completed') {
          logger.info('任务完成', { taskId, duration: Math.round((Date.now() - startTime) / 1000) });
          return { status: 'succeeded', result };
        }

        if (status === 'failed' || status === 'error') {
          const errorMsg = result.error?.message || result.message || '未知错误';
          logger.error('任务失败', { taskId, error: errorMsg });
          return { status: 'failed', error: errorMsg, result };
        }

        // 任务仍在处理中，指数退避等待
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        delay = Math.min(delay * 1.5, maxDelay);

      } catch (err) {
        const message = err.response?.data?.message || err.message;
        
        // 429 限流，增加退避时间
        if (err.response?.status === 429) {
          logger.warn('触发限流，增加退避', { taskId, delay: delay * 2 });
          delay = Math.min(delay * 2, maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          continue;
        }

        logger.error('轮询异常', { taskId, error: message });
        
        // 非致命错误，继续轮询
        if (err.response?.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          delay = Math.min(delay * 1.5, maxDelay);
          continue;
        }

        throw new ExternalAPIError(`轮询任务状态失败: ${message}`, {
          details: { taskId }
        });
      }
    }

    throw new ExternalAPIError(`任务轮询超时: ${taskId}`, {
      details: { taskId, maxWait }
    });
  }

  async submitBatch(shots, options = {}) {
    const results = [];

    for (const shot of shots) {
      const result = await this.submitShot(shot, options);
      results.push(result);
    }

    return results;
  }
}

module.exports = {
  RenderSubmitter
};