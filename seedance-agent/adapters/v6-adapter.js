/**
 * Adapter Layer — v9.2.0 模块适配器 (v9.2-Peng)
 *
 * 将 v7.0 的 Tool Pool 接口转换为 v6.0 模块的实际调用。
 * 支持两种模式：
 * - exec: 子进程调用（兼容现有 CLI 脚本）
 * - require: 直接模块引用（性能更优）
 *
 * 核心职责：
 * - 接口转换（v7.0 Tool Pool → v6.0 模块参数）
 * - 结果包装（v6.0 输出 → v7.0 标准化格式）
 * - 错误处理与重试
 * - 成本追踪
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// ============ v6.0 模块路径映射 ============
const V6_MODULE_PATHS = {
  // Tier 1: Always Active — 核心制作工具
  'story-engine': {
    name: 'Story Engine',
    category: 'preview',
    tier: 1,
    description: '故事方案生成引擎',
    script: 'seedance-story-engine/scripts/story-engine.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} plan --title "{title}" --duration {duration} --outline "{outline}" --characters "{characters}" --output {output}',
    concurrentSafe: true,
    costEstimate: 0.01
  },
  // Tier 1: 视频渲染引擎（火山引擎Seedance）
  'render-engine': {
    name: 'Render Engine',
    category: 'render',
    tier: 1,
    description: '视频渲染引擎（火山引擎Seedance API）',
    module: 'volcengine-api-client.js',
    mode: 'require',
    entry: 'generateShanhaiVideo',
    concurrentSafe: false,
    costEstimate: 0.5,
    // 火山引擎API参数映射
    paramMap: {
      productionDir: null,  // 不使用本地目录
      planFile: null,
      prompt: 'text',
      duration: 'duration',
      ratio: 'ratio',
      fast: 'fast',
      referenceImages: 'referenceImages',
      referenceVideos: 'referenceVideos',
      referenceAudios: 'referenceAudios'
    }
  },
  // Tier 1: 图片生成引擎（火山引擎Seedream）
  'image-engine': {
    name: 'Image Engine',
    category: 'render',
    tier: 1,
    description: '图片生成引擎（火山引擎Seedream API）',
    module: 'volcengine-api-client.js',
    mode: 'require',
    entry: 'generateShanhaiImage',
    concurrentSafe: true,
    costEstimate: 0.05,
    paramMap: {
      prompt: 'prompt',
      size: 'size'
    }
  },
  'pitch-evaluation': {
    name: 'Pitch Evaluation',
    category: 'preview',
    tier: 1,
    description: '方案比稿评测',
    script: 'pitch-evaluation/scripts/pitch-evaluation.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} evaluate --input {input} --output {output} --min-score {minScore}',
    concurrentSafe: true,
    costEstimate: 0.005
  },
  'post-production': {
    name: 'Post Production',
    category: 'edit',
    tier: 1,
    description: '后期制作与合成',
    script: 'seedance-post-production/scripts/post-production.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} assemble --production-dir {productionDir} --output {output}',
    concurrentSafe: false,
    costEstimate: 0.05
  },
  'sound-design': {
    name: 'Sound Design',
    category: 'edit',
    tier: 1,
    description: '声音设计与混音',
    script: 'seedance-sound-design/scripts/sound-design.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} design --production-dir {productionDir} --story-plan {storyPlan} --output {output}',
    concurrentSafe: true,
    costEstimate: 0.1
  },
  'character-manager': {
    name: 'Character Manager',
    category: 'proxy',
    tier: 1,
    description: '角色管理与定妆照生成',
    script: 'seedance-character-manager/scripts/character-manager.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} generate --name "{name}" --description "{description}" --style "{style}" --output {output}',
    concurrentSafe: false,
    costEstimate: 0.02
  },
  'delivery-engine': {
    name: 'Delivery Engine',
    category: 'export',
    tier: 1,
    description: '成片交付',
    script: 'seedance-delivery-engine/scripts/delivery-engine.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} produce --production-dir {productionDir} --output {output}',
    concurrentSafe: false,
    costEstimate: 0.01
  },

  // Tier 2: Conditionally Active
  'choreography': {
    name: 'Choreography',
    category: 'proxy',
    tier: 2,
    description: '舞蹈动作编排',
    script: 'seedance-choreography/scripts/choreography.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} generate --prompt "{prompt}" --dance-style "{danceStyle}" --output {output}',
    concurrentSafe: true,
    costEstimate: 0.02,
    activateWhen: (context) => context.hasDanceContent
  },

  // Director 主控（作为 orchestrator 使用）
  'director': {
    name: 'Director',
    category: 'preview',
    tier: 1,
    description: '导演主控（完整流水线）',
    script: 'seedance-director/scripts/director.js',
    mode: 'exec',
    entry: null,
    cli: 'node {script} produce --title "{title}" --outline "{outline}" --style "{style}" --output {output}',
    concurrentSafe: false,
    costEstimate: 1.0
  }
};

// ============ 适配器主类 ============
export class V6Adapter {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.workspaceDir = path.join(projectDir, '..');
    this.executionLog = [];
    this.moduleCache = new Map();
  }

  /**
   * 执行工具调用
   */
  async execute(toolId, params = {}, context = {}) {
    const config = V6_MODULE_PATHS[toolId];
    if (!config) {
      throw new Error(`未知工具: ${toolId}`);
    }

    const startTime = Date.now();
    const scriptPath = this.resolveScriptPath(config.script);

    // 检查脚本是否存在
    const exists = fs.existsSync(scriptPath);

    let result;
    if (exists && config.mode === 'require') {
      result = await this.executeRequire(toolId, scriptPath, config, params, context);
    } else {
      result = await this.executeExec(toolId, scriptPath, config.cli, params, context);
    }

    const duration = Date.now() - startTime;
    const cost = this.calculateCost(toolId, params);

    this.executionLog.push({
      toolId,
      params,
      cost,
      duration,
      timestamp: new Date().toISOString(),
      status: result.error ? 'error' : 'success'
    });

    return {
      data: result.data || result,
      cost,
      duration,
      metadata: {
        toolId,
        scriptPath,
        mode: config.mode,
        executedAt: new Date().toISOString()
      }
    };
  }

  // ============ Require 模式 ============
  async executeRequire(toolId, scriptPath, config, params, context) {
    try {
      let module;
      if (this.moduleCache.has(scriptPath)) {
        module = this.moduleCache.get(scriptPath);
      } else {
        try {
          module = await import(scriptPath);
        } catch (esmError) {
          module = require(scriptPath);
        }
        this.moduleCache.set(scriptPath, module);
      }

      const v6Params = this.convertParams(toolId, params, context);

      // 处理类实例化
      let result;
      if (config.method) {
        const Cls = module[config.entry];
        const instance = new Cls(v6Params);
        result = await instance[config.method](v6Params.candidates || []);
      } else {
        const entryFn = module[config.entry] || module.default?.[config.entry];
        if (!entryFn) {
          throw new Error(`模块 ${toolId} 找不到入口函数: ${config.entry}`);
        }
        result = await entryFn(v6Params);
      }

      return this.wrapResult(toolId, result);
    } catch (error) {
      return { error: true, message: error.message, fallback: true };
    }
  }

  // ============ Exec 模式 ============
  async executeExec(toolId, scriptPath, cliTemplate, params, context) {
    return new Promise((resolve) => {
      const cmd = this.buildCliCommand(cliTemplate, scriptPath, toolId, params, context);

      console.log(`[V6Adapter] 执行: ${cmd}`);

      const child = spawn('bash', ['-c', cmd], {
        cwd: this.workspaceDir,
        env: {
          ...process.env,
          SEEDANCE_PROJECT: context.projectId || 'default',
          SEEDANCE_MODE: 'v7-agent'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({
            error: true,
            exitCode: code,
            stderr: stderr.substring(0, 500),
            stdout: stdout.substring(0, 500)
          });
        } else {
          let parsed;
          try {
            parsed = JSON.parse(stdout);
          } catch {
            parsed = { raw: stdout.substring(0, 2000) };
          }
          resolve(parsed);
        }
      });

      child.on('error', (error) => {
        resolve({ error: true, message: error.message });
      });
    });
  }

  // ============ 参数转换 ============
  convertParams(toolId, params, context) {
    const converters = {
      'story-engine': (p, c) => ({
        title: p.title || p.userRequest?.substring(0, 50) || 'Untitled',
        duration: p.duration || 15,
        outline: p.outline || p.userRequest || '',
        characters: p.characters || '',
        output: p.outputPath || `./projects/${c.projectId}/story.json`
      }),
      'render-engine': (p, c) => ({
        productionDir: p.productionDir || `./projects/${c.projectId}`,
        planFile: p.planFile || `./projects/${c.projectId}/story.json`,
        resolution: p.resolution || '1080p'
      }),
      'pitch-evaluation': (p, c) => ({
        input: p.input || `./projects/${c.projectId}/candidates.json`,
        output: p.outputPath || `./projects/${c.projectId}/evaluation.json`,
        minScore: p.minScore || 7.5
      }),
      'post-production': (p, c) => ({
        productionDir: p.productionDir || `./projects/${c.projectId}`,
        output: p.outputPath || `./projects/${c.projectId}/draft.mp4`
      }),
      'sound-design': (p, c) => ({
        productionDir: p.productionDir || `./projects/${c.projectId}`,
        storyPlan: p.storyPlan || `./projects/${c.projectId}/story.json`,
        output: p.outputPath || `./projects/${c.projectId}/sound/`
      }),
      'character-manager': (p, c) => ({
        name: p.name || 'Character',
        description: p.description || p.userRequest || '',
        style: p.style || 'realistic',
        output: p.outputPath || `./projects/${c.projectId}/characters/`
      }),
      'delivery-engine': (p, c) => ({
        productionDir: p.productionDir || `./projects/${c.projectId}`,
        output: p.outputPath || `./projects/${c.projectId}/deliverables/`
      }),
      'choreography': (p, c) => ({
        prompt: p.prompt || p.userRequest || '',
        danceStyle: p.danceStyle || 'contemporary',
        output: p.outputPath || `./projects/${c.projectId}/choreography.json`
      }),
      'director': (p, c) => ({
        title: p.title || p.userRequest?.substring(0, 50) || 'Untitled',
        outline: p.outline || p.userRequest || '',
        style: p.style || 'cinematic',
        output: p.outputPath || `./projects/${c.projectId}/`
      })
    };

    const converter = converters[toolId];
    return converter ? converter(params, context) : params;
  }

  // ============ CLI 命令构建 ============
  buildCliCommand(template, scriptPath, toolId, params, context) {
    const v6Params = this.convertParams(toolId, params, context);
    
    // 构建替换映射，空值标记为 null
    const replacements = {
      '{script}': scriptPath,
      '{title}': v6Params.title || null,
      '{duration}': v6Params.duration || 15,
      '{outline}': v6Params.outline || null,
      '{characters}': v6Params.characters || null,
      '{style}': v6Params.style || null,
      '{name}': v6Params.name || null,
      '{description}': v6Params.description || null,
      '{prompt}': v6Params.prompt || null,
      '{danceStyle}': v6Params.danceStyle || null,
      '{productionDir}': v6Params.productionDir || `./projects/${context.projectId}`,
      '{planFile}': v6Params.planFile || null,
      '{storyPlan}': v6Params.storyPlan || null,
      '{input}': v6Params.input || null,
      '{output}': v6Params.output || `./projects/${context.projectId}/`,
      '{minScore}': v6Params.minScore || 7.5
    };
    
    let cmd = template;
    
    // 第一轮：处理带 -- 前缀的参数，空值时移除整个 --key value
    for (const [placeholder, value] of Object.entries(replacements)) {
      if (value === null) {
        // 空值：移除 --key {placeholder} 整个部分
        const keyPattern = placeholder.replace(/[{}]/g, '');
        const regex = new RegExp(`\\s*--${keyPattern}\\s+${placeholder.replace(/[{}]/g, '\\{\\}')}\\s*`, 'g');
        cmd = cmd.replace(regex, ' ');
      } else {
        cmd = cmd.replace(placeholder, this.escapeShell(String(value)));
      }
    }
    
    // 清理多余空格和未替换的占位符
    cmd = cmd.replace(/\s{2,}/g, ' ').trim();
    cmd = cmd.replace(/{\w+}/g, '');

    return cmd;
  }

  escapeShell(str) {
    return String(str).replace(/["\\$`]/g, '\\$&');
  }

  // ============ 成本计算 ============
  calculateCost(toolId, params) {
    const baseCosts = {
      'story-engine': 0.01,
      'pitch-evaluation': 0.005,
      'character-manager': 0.02,
      'render-engine': 0.5,
      'post-production': 0.05,
      'sound-design': 0.1,
      'delivery-engine': 0.01,
      'choreography': 0.02,
      'director': 1.0
    };

    let cost = baseCosts[toolId] || 0.1;

    if (params.resolution) {
      const multipliers = {
        '480p': 0.05, '720p': 0.2, '1080p': 0.8,
        '2k': 2.0, '4k': 5.0
      };
      cost *= multipliers[params.resolution] || 1.0;
    }

    if (params.duration) {
      cost *= (params.duration / 15);
    }

    return parseFloat(cost.toFixed(3));
  }

  // ============ 路径解析 ============
  resolveScriptPath(relativePath) {
    const candidates = [
      path.join(this.workspaceDir, relativePath),
      path.join(this.workspaceDir, '..', relativePath),
      path.join(process.cwd(), relativePath),
      path.join(process.cwd(), '..', relativePath)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.join(this.workspaceDir, relativePath);
  }

  // ============ 结果包装 ============
  wrapResult(toolId, v6Result) {
    return {
      tool: toolId,
      status: v6Result.error ? 'error' : 'success',
      data: v6Result,
      artifacts: v6Result.outputPath || v6Result.file || null,
      metrics: v6Result.metrics || {},
      logs: v6Result.logs || []
    };
  }

  // ============ 统计 ============
  getStats() {
    return {
      totalExecutions: this.executionLog.length,
      byTool: this.executionLog.reduce((acc, e) => {
        acc[e.toolId] = (acc[e.toolId] || 0) + 1;
        return acc;
      }, {}),
      totalCost: this.executionLog.reduce((sum, e) => sum + (e.cost || 0), 0),
      errors: this.executionLog.filter(e => e.status === 'error').length
    };
  }
}

// 辅助函数：从参数推断工具ID
function toolIdFromParams(params) {
  // 从 params.tool 或 params.toolId 推断
  return params.tool || params.toolId || 'director';
}

// ============ 便捷函数 ============
export function createV6Adapter(projectDir) {
  return new V6Adapter(projectDir);
}

export { V6_MODULE_PATHS };

// ============ 测试入口 ============
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const adapter = new V6Adapter();

  console.log('=== V6 Adapter 测试 ===');
  console.log('模块映射:', Object.keys(V6_MODULE_PATHS));
  console.log('脚本路径检查:');
  
  for (const [id, config] of Object.entries(V6_MODULE_PATHS)) {
    const scriptPath = adapter.resolveScriptPath(config.script);
    const exists = fs.existsSync(scriptPath);
    console.log(`  ${id}: ${exists ? '✅' : '❌'} ${scriptPath}`);
  }
}
