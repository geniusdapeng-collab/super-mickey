// hyperreality-system/index.js
// Hyperreality System - 超现实工业创作系统统一入口
// 深度融合：剧本引擎 → 适配层 → 制作引擎 → 完整镜头
// 版本：v1.2.5 | 日期：2026-06-19

const { ScriptEngine } = require('./engines/script-engine');
const { ProductionEngine } = require('./engines/production-engine/production-engine');
const { RenderingEngine } = require('./engines/rendering-engine/rendering-engine');
const { PostProductionEngine } = require('./engines/post-production-engine/post-production-engine');
const { RequirementListBuilder } = require('./engines/script-engine/core/requirement-list-builder');
const { CreativeIntensityEngine } = require('./engines/script-engine/core/creative-intensity-engine');
const { FieldGuard } = require('./engines/field-guard');
const fs = require('fs');
const path = require('path');

class HyperrealitySystem {
  constructor(options = {}) {
    this.requirementListBuilder = new RequirementListBuilder(options.requirementListBuilder);
    this.creativeIntensityEngine = new CreativeIntensityEngine(options.creativeIntensityEngine);
    this.scriptEngine = new ScriptEngine(options.scriptEngine);
    this.productionEngine = new ProductionEngine(options.productionEngine);
    this.renderingEngine = new RenderingEngine(options.renderingEngine);
    this.postProductionEngine = new PostProductionEngine(options.postProductionEngine);
    this.fieldGuard = new FieldGuard({ strict: true, logPrefix: '[Hyperreality]' });
    this.version = '1.2.5';
  }

  /**
   * 主创作流程（含剧本确认 + 提示词审核 + 后期制作环节）
   * @param {string} intent - 用户意图
   * @param {object} metadata - 元数据
   * @param {object} options - { skipScriptConfirmation, skipPromptReview, skipRender, skipPostProduction }
   * @returns {object} 完整创作结果
   */
  async create(intent, metadata = {}, options = {}) {
    console.log(`\n🔥 [HyperrealitySystem v${this.version}] 开始创作`);
    console.log(`   意图: ${intent}`);
    console.log(`   项目: ${metadata.title || '未命名'}`);
    console.log(`   流程: ${options.skipScriptConfirmation ? '跳过' : '含'}剧本确认 → ${options.skipPromptReview ? '跳过' : '含'}提示词审核 → ${options.skipRender ? '跳过' : '含'}渲染 → ${options.skipPostProduction ? '跳过' : '含'}后期`);
    console.log('');

    const result = {
      success: false,
      stages: {},
      errors: [],
      timing: {},
      confirmations: {} // 记录确认状态
    };

    const totalStart = Date.now();

    try {
      // ========== 🆕 Layer 0: 需求清单生成确认 ==========
      if (!options.skipRequirementList) {
        console.log('📋 [Layer 0] 需求清单生成 - 解析用户意图...');
        const stage0Start = Date.now();

        const requirementList = await this.requirementListBuilder.build(intent, metadata);

        result.stages.requirementList = {
          data: requirementList,
          timing: Date.now() - stage0Start
        };

        console.log(`   ✅ 需求清单生成完成 (${result.stages.requirementList.timing}ms)`);
        console.log(`      类型: ${requirementList.videoTypeName} | 时长: ${requirementList.targetDuration}s | 风格: ${requirementList.style.primary}`);
        console.log(`      角色: ${requirementList.characters.length}个 | 置信度: ${(requirementList._analysis.confidence * 100).toFixed(0)}%`);

        // 生成 Markdown 供人工确认
        if (!options.skipRequirementConfirmation) {
          console.log('\n📋 [需求清单确认] 等待人工确认...');

          const markdown = this.requirementListBuilder.generateMarkdown(requirementList);
          const requirementConfirmation = await this._confirmRequirementList(markdown, requirementList);
          result.confirmations.requirementList = requirementConfirmation;

          if (!requirementConfirmation.approved) {
            console.log('   ❌ 需求清单未确认，流程中止');
            result.success = false;
            result.stages.requirementReview = {
              status: 'rejected',
              reason: requirementConfirmation.reason || '用户未确认需求清单',
              suggestions: requirementConfirmation.suggestions || []
            };
            return result;
          }

          console.log('   ✅ 需求清单已确认，继续创作');

          // 如果用户提供了修改意见，重新生成
          if (requirementConfirmation.suggestions?.length > 0) {
            console.log(`   🔄 根据用户反馈重新生成...`);
            requirementList.contentConstraints = requirementList.contentConstraints || [];
            requirementList.contentConstraints.push(...requirementConfirmation.suggestions.map(s => `用户要求: ${s}`));
          }
        } else {
          console.log('\n⚠️ [需求清单确认] 跳过（调试模式）');
          result.confirmations.requirementList = { approved: true, skipped: true };
        }

        // 将需求清单转换为 ScriptEngine 可用的 metadata
        const enhancedMetadata = {
          ...metadata,
          ...this.requirementListBuilder.toScriptEngineMetadata(requirementList)
        };
        metadata = enhancedMetadata;

        // ========== 🆕 创意指数解析与配置注入 ==========
        const intensity = this.creativeIntensityEngine.parse(requirementList);
        const narrativeMode = requirementList.narrativeMode || 'dialogue';
        const worldSetting = requirementList._analysis?.worldSetting || 'default';

        console.log(`\n💡 [创意指数] 解析结果: ${intensity} (${this.creativeIntensityEngine.getLevel(intensity).name})`);
        console.log(`   叙事模式: ${narrativeMode} | 世界设定: ${worldSetting}`);

        const engineConfigs = this.creativeIntensityEngine.generateEngineConfigs(intensity, narrativeMode, worldSetting);

        result.stages.creativeIntensity = {
          intensity,
          level: engineConfigs.level,
          activeCapabilities: engineConfigs._metadata.activeCapabilities,
          report: this.creativeIntensityEngine.generateReport(intensity, narrativeMode, worldSetting)
        };

        // 将创意指数配置注入到各引擎选项
        metadata._creativeIntensity = {
          intensity,
          engineConfigs,
          instructions: {
            script: engineConfigs.scriptEngine?.creativeInstructions || '',
            production: engineConfigs.productionEngine?.creativeInstructions || '',
            rendering: engineConfigs.renderingEngine?.creativeInstructions || '',
            postProduction: engineConfigs.postProductionEngine?.creativeInstructions || ''
          }
        };

        console.log(`   ✅ 创意指数配置已生成，${engineConfigs._metadata.activeCapabilities}个能力激活`);
        console.log(`      Layer 1: ${Object.keys(engineConfigs.scriptEngine).length > 0 ? '✅' : '❌'} 叙事结构配置`);
        console.log(`      Layer 2: ${Object.keys(engineConfigs.productionEngine).length > 0 ? '✅' : '❌'} 视觉表现配置`);
        console.log(`      Layer 3: ${Object.keys(engineConfigs.renderingEngine).length > 0 ? '✅' : '❌'} 渲染质感配置`);
        console.log(`      Layer 4: ${Object.keys(engineConfigs.postProductionEngine).length > 0 ? '✅' : '❌'} 后期风格配置`);
      } else {
        console.log('\n⚠️ [Layer 0] 需求清单生成跳过（调试模式）');
        result.stages.requirementList = { skipped: true };
      }

      // ========== Layer 1: 剧本引擎 ==========
      console.log('📖 [Layer 1] 剧本引擎 - 生成结构化剧本...');
      const stage1Start = Date.now();

      const scriptResult = await this.scriptEngine.process(intent, metadata);

      result.stages.scriptEngine = {
        blueprint: scriptResult.blueprint?.meta,
        validation: scriptResult.validation,
        report: scriptResult.report
      };
      result.stages.scriptEngine.timing = Date.now() - stage1Start;

      console.log(`   ✅ 剧本生成完成 (${result.stages.scriptEngine.timing}ms)`);
      console.log(`      场景: ${scriptResult.report.scenes_count} | 角色: ${scriptResult.report.characters_count} | 台词: ${scriptResult.report.dialogues_count}`);
      console.log(`      校验: ${scriptResult.validation.passed ? '通过' : '失败'} (${scriptResult.validation.overall_score}分)`);

      // ========== 🆕 剧本确认环节（P0-固化） ==========
      if (!options.skipScriptConfirmation) {
        console.log('\n🎭 [剧本确认] 等待人工确认...');
        
        const scriptConfirmation = await this._confirmScript(scriptResult.blueprint);
        result.confirmations.script = scriptConfirmation;
        
        if (!scriptConfirmation.approved) {
          console.log('   ❌ 剧本未确认，流程中止');
          result.success = false;
          result.stages.scriptReview = {
            status: 'rejected',
            reason: scriptConfirmation.reason || '用户未确认',
            suggestions: scriptConfirmation.suggestions || []
          };
          return result;
        }
        
        console.log('   ✅ 剧本已确认，继续制作');
      } else {
        console.log('\n⚠️ [剧本确认] 跳过（调试模式）');
        result.confirmations.script = { approved: true, skipped: true };
      }

      // ========== 适配层 ==========
      console.log('\n🔗 [Adapter] 适配层 - 转换数据格式...');
      const adapted = scriptResult.adapted;

      // ========== Layer 2: 制作引擎 ==========
      console.log('\n🎬 [Layer 2] 制作引擎 - 生成镜头...');
      const stage2Start = Date.now();

      const productionResult = await this.productionEngine.produce(adapted);

      result.stages.productionEngine = {
        shots: productionResult.shots.map(s => ({
          shotId: s.shotId,
          sceneType: s.sceneType,
          timing: s.timing,
          promptLength: s.prompt?.length,
          status: s.status
        })),
        prompts: productionResult.prompts,
        quality: productionResult.stages.qualityGate
      };
      result.stages.productionEngine.timing = Date.now() - stage2Start;

      console.log(`   ✅ 制作完成 (${result.stages.productionEngine.timing}ms)`);
      console.log(`      镜头: ${productionResult.shots.length} | Prompts: ${productionResult.prompts.length}`);
      console.log(`      质量门: ${productionResult.stages.qualityGate?.passed ? '通过' : '失败'}`);

      // ========== 🆕 字段标准化与守门（专家诊断建议）==========
      console.log('\n🛡️ [FieldGuard] Layer 2 输出标准化与校验...');
      try {
        const normalized = this.fieldGuard.normalizeAndValidate(productionResult.shots, 'Layer2-Production');
        productionResult.shots = normalized.shots;
        productionResult.prompts = normalized.shots; // Prompts 即 shots 的引用
        console.log(`   ✅ 字段标准化通过 (${normalized.report.warnings.length} 警告)`);
        this.fieldGuard.printShotSummary(normalized.shots, 'Layer2-Production');
      } catch (err) {
        console.error(`   ❌ 字段校验失败: ${err.message}`);
        if (err.report) {
          console.error(`      错误: ${err.report.errors.join(' | ')}`);
        }
        // 非严格模式下继续，但记录错误
        result.errors.push({ stage: 'FieldGuard-Layer2', message: err.message });
      }

      // ========== 🆕 提示词审核确认环节 ==========
      if (!options.skipPromptReview) {
        console.log('\n📝 [提示词审核] 等待人工确认...');
        
        const promptConfirmation = await this._confirmPrompts(productionResult.prompts);
        result.confirmations.prompts = promptConfirmation;
        
        if (!promptConfirmation.approved) {
          console.log('   ❌ 提示词未确认，流程中止');
          result.success = false;
          result.stages.promptReview = {
            status: 'rejected',
            reason: promptConfirmation.reason || '用户未确认',
            issues: promptConfirmation.issues || []
          };
          return result;
        }
        
        console.log('   ✅ 提示词已确认，继续渲染');
      } else {
        console.log('\n⚠️ [提示词审核] 跳过（调试模式）');
        result.confirmations.prompts = { approved: true, skipped: true };
      }

      // ========== Layer 3: 渲染引擎 ==========
      let renderResult = null; // 声明在作用域顶部，避免 skipRender 时 undefined
      
      if (!options.skipRender) {
        console.log('\n🎨 [Layer 3] 渲染引擎 - 提交 Seedance...');
        const stage3Start = Date.now();

        renderResult = await this.renderingEngine.render(productionResult.prompts, {
          dryRun: options.dryRun || !this.renderingEngine.config.apiKey
        });

        result.stages.renderingEngine = {
          render: renderResult,
          report: this.renderingEngine.generateReport(renderResult)
        };
        result.stages.renderingEngine.timing = Date.now() - stage3Start;

        console.log(`   ✅ 渲染完成 (${result.stages.renderingEngine.timing}ms)`);
        console.log(`      提交: ${renderResult.submitted}/${renderResult.results.length} | 失败: ${renderResult.failed}`);
      } else {
        console.log('\n⚠️ [渲染] 跳过（调试模式）');
        result.stages.renderingEngine = { skipped: true };
      }

      // ========== Layer 4: 后期引擎 ==========
      if (!options.skipPostProduction) {
        console.log('\n🎬 [Layer 4] 后期引擎 - 字幕/音乐/弹幕/多版本...');
        const stage4Start = Date.now();

        const postResult = await this.postProductionEngine.postProduce(
          productionResult,
          scriptResult,
          renderResult || { success: false, results: [] }
        );

        result.stages.postProductionEngine = {
          success: postResult.success,
          versions: postResult.versions,
          stages: postResult.stages,
          report: this.postProductionEngine.generateReport(postResult)
        };
        result.stages.postProductionEngine.timing = Date.now() - stage4Start;

        console.log(`   ✅ 后期制作完成 (${result.stages.postProductionEngine.timing}ms)`);
        console.log(`      版本: ${Object.keys(postResult.versions).join(', ')}`);
        console.log(`      字幕: ${postResult.stages.subtitles?.count || 0}条 | 音乐: ${postResult.stages.music?.count || 0}段 | 弹幕: ${postResult.stages.danmaku?.count || 0}条`);
      } else {
        console.log('\n⚠️ [后期制作] 跳过（调试模式）');
        result.stages.postProductionEngine = { skipped: true };
      }

      // ========== 汇总 ==========
      result.success = true;
      result.timing.total = Date.now() - totalStart;

      console.log(`\n🏁 [完成] 总耗时: ${result.timing.total}ms`);
      console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);

      // 生成最终报告
      result.finalReport = this._generateFinalReport(scriptResult, productionResult, result.stages.renderingEngine, result.stages.postProductionEngine, result.timing.total, result.confirmations);

      // ========== 🆕 最终导出前字段标准化（专家诊断建议）==========
      if (productionResult && productionResult.shots) {
        console.log('\n🛡️ [FieldGuard] 最终导出前标准化...');
        try {
          const normalized = this.fieldGuard.normalizeAndValidate(productionResult.shots, 'Final-Export');
          productionResult.shots = normalized.shots;
          productionResult.prompts = normalized.shots;
          result.stages.productionEngine.shots = normalized.shots.map(s => ({
            shotId: s.shotId,
            sceneType: s.sceneType,
            timing: s.timing,
            promptLength: s.prompt?.length,
            status: s.status
          }));
          console.log('   ✅ 最终导出字段标准化通过');
          this.fieldGuard.printShotSummary(normalized.shots, 'Final-Export');
        } catch (err) {
          console.error(`   ❌ 最终字段校验失败: ${err.message}`);
          result.errors.push({ stage: 'FieldGuard-Final', message: err.message });
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        stage: 'HYPERREALITY_SYSTEM',
        message: error.message,
        stack: error.stack
      });
      console.error(`\n❌ [系统错误] ${error.message}`);
    }

    return result;
  }

  /**
   * 🆕 需求清单确认（Layer 0）
   * v1.2.5: 支持外部确认——输出文件后等待队长确认
   */
  async _confirmRequirementList(markdown, requirementList) {
    console.log('\n--- 📋 需求清单确认 ---');
    console.log(markdown);
    console.log('\n---');
    
    // v1.2.5: 写入文件并等待外部确认
    const confirmPath = await this._waitForExternalConfirmation('requirement', markdown);
    
    if (confirmPath.approved) {
      console.log('   ✅ 需求清单已确认');
    } else {
      console.log('   ❌ 需求清单被拒绝:', confirmPath.reason);
    }
    
    return {
      approved: confirmPath.approved,
      reviewedAt: new Date().toISOString(),
      requirementList: requirementList,
      reason: confirmPath.reason,
      suggestions: confirmPath.suggestions
    };
  }

  /**
   * 剧本确认环节
   * v1.2.5: 支持外部确认
   */
  async _confirmScript(blueprint) {
    // 生成剧本报告供审阅
    const scriptReport = this._generateScriptReport(blueprint);
    
    // v1.2.5: 写入文件并等待外部确认
    const confirmPath = await this._waitForExternalConfirmation('script', scriptReport);
    
    if (confirmPath.approved) {
      console.log('   ✅ 剧本已确认');
    } else {
      console.log('   ❌ 剧本被拒绝:', confirmPath.reason);
    }
    
    return {
      approved: confirmPath.approved,
      reviewedAt: new Date().toISOString(),
      report: scriptReport,
      reason: confirmPath.reason,
      suggestions: confirmPath.suggestions
    };
  }

  /**
   * 提示词确认环节
   * v1.2.5: 支持外部确认
   */
  async _confirmPrompts(prompts) {
    // 生成提示词报告供审阅
    const promptReport = this._generatePromptsReport(prompts);
    
    // v1.2.5: 写入文件并等待外部确认
    const confirmPath = await this._waitForExternalConfirmation('prompt', promptReport);
    
    if (confirmPath.approved) {
      console.log('   ✅ 提示词已确认');
    } else {
      console.log('   ❌ 提示词被拒绝:', confirmPath.reason);
    }
    
    return {
      approved: confirmPath.approved,
      reviewedAt: new Date().toISOString(),
      report: promptReport,
      reason: confirmPath.reason,
      suggestions: confirmPath.suggestions
    };
  }

  /**
   * v1.2.5: 等待外部确认
   * 将内容写入文件，轮询等待确认文件
   */
  async _waitForExternalConfirmation(type, content) {
    const outputDir = './output/confirmations';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 写入待确认内容
    const contentPath = path.join(outputDir, `confirmation-${type}.md`);
    fs.writeFileSync(contentPath, content, 'utf8');
    
    // 删除旧的确认文件（如果存在）
    const confirmPath = path.join(outputDir, `confirmation-${type}.json`);
    if (fs.existsSync(confirmPath)) {
      fs.unlinkSync(confirmPath);
    }
    
    console.log(`\n⏳ [等待确认] ${type} 已输出到: ${contentPath}`);
    console.log(`   请审阅内容后，创建确认文件: ${confirmPath}`);
    console.log('   格式: {"approved": true} 或 {"approved": false, "reason": "..."}');
    
    // 轮询等待确认文件（最多30分钟）
    const maxWait = 120 * 60 * 1000; // 30分钟
    const checkInterval = 3000; // 3秒
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      if (fs.existsSync(confirmPath)) {
        try {
          const confirmData = JSON.parse(fs.readFileSync(confirmPath, 'utf8'));
          console.log(`   ✅ 收到确认: approved=${confirmData.approved}`);
          return {
            approved: confirmData.approved !== false,
            reason: confirmData.reason || '',
            suggestions: confirmData.suggestions || []
          };
        } catch (e) {
          console.log('   ⚠️ 确认文件解析失败，继续等待...');
        }
      }
      
      // 每10秒打印一次等待提示
      const elapsed = Date.now() - startTime;
      if (elapsed % 10000 < checkInterval) {
        const mins = Math.floor(elapsed / 60000);
        console.log(`   ⏳ 等待确认中... (${mins}分钟)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // 超时
    console.log('   ⏰ 确认超时，默认拒绝');
    return { approved: false, reason: '等待确认超时', suggestions: [] };
  }

  /**
   * 生成剧本报告（供审阅）
   */
  _generateScriptReport(blueprint) {
    const scenes = blueprint.structure?.scenes || [];
    const lines = [];
    
    lines.push('# 🎭 剧本确认报告');
    lines.push('');
    lines.push(`**项目**: ${blueprint.meta?.title || '未命名'}`);
    lines.push(`**时长**: ${blueprint.meta?.target_duration || 120}s`);
    lines.push(`**场景**: ${scenes.length} 个`);
    lines.push(`**校验**: ${blueprint.validate ? '通过' : '待校验'}`);
    lines.push('');
    lines.push('## 场景总览');
    lines.push('');
    lines.push('| 场景 | 类型 | 时长 | 角色 | 台词 |');
    lines.push('|------|------|------|------|------|');
    
    for (const scene of scenes) {
      const chars = (scene.characters || []).join(', ');
      const dialogueCount = scene.dialogue?.lines?.length || 0;
      lines.push(`| ${scene.scene_id} | ${scene.scene_type} | ${scene.timing?.duration || 0}s | ${chars} | ${dialogueCount}句 |`);
    }
    
    lines.push('');
    lines.push('## 详细场景');
    lines.push('');
    
    for (const scene of scenes) {
      lines.push(`### ${scene.scene_id}: ${scene.scene_name}`);
      lines.push(`**类型**: ${scene.scene_type} | **时长**: ${scene.timing?.duration || 0}s`);
      lines.push(`**设定**: ${scene.setting || '无'}`);
      lines.push(`**角色**: ${(scene.characters || []).join(', ') || '无'}`);
      lines.push('');
      
      if (scene.dialogue?.lines?.length > 0) {
        lines.push('**台词**:');
        for (const line of scene.dialogue.lines) {
          lines.push(`- ${line.speaker}: 「${line.text}」 (${line.emotion || 'neutral'})`);
        }
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    }
    
    lines.push('## ⚠️ 确认须知');
    lines.push('');
    lines.push('1. 确认场景时序连续无断层');
    lines.push('2. 确认每个场景有角色对话');
    lines.push('3. 确认总时长等于目标时长');
    lines.push('4. 确认角色数量、设定符合预期');
    lines.push('');
    lines.push('**请回复 "确认" 继续，或 "修改" 并指出问题**');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 生成提示词报告（供审阅）
   */
  _generatePromptsReport(prompts) {
    const lines = [];
    
    lines.push('# 📝 提示词审核报告');
    lines.push('');
    lines.push(`**镜头数**: ${prompts.length}`);
    lines.push(`**平均长度**: ${Math.round(prompts.reduce((s, p) => s + p.length, 0) / prompts.length)} 字符`);
    lines.push('');
    lines.push('## 镜头总览');
    lines.push('');
    lines.push('| 镜头 | 长度 | 有定妆照 | 有时间轴 | 有约束 |');
    lines.push('|------|------|----------|----------|--------|');
    
    for (const p of prompts) {
      const hasImages = (p.imageRefs || []).length > 0;
      const hasTimeline = p.prompt?.includes('【镜头时间轴】') || false;
      const hasConstraints = p.prompt?.includes('【角色一致性】') || false;
      lines.push(`| ${p.shotId} | ${p.length} | ${hasImages ? '✓' : '✗'} | ${hasTimeline ? '✓' : '✗'} | ${hasConstraints ? '✓' : '✗'} |`);
    }
    
    lines.push('');
    lines.push('## 完整提示词');
    lines.push('');
    
    for (const p of prompts) {
      lines.push(`### ${p.shotId}`);
      lines.push(`**长度**: ${p.length} 字符 | **定妆照**: ${p.imageRefs?.length || 0} 张`);
      lines.push('');
      lines.push('```');
      lines.push(p.prompt);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    
    lines.push('## ⚠️ 审核须知');
    lines.push('');
    lines.push('1. 确认每个镜头有【镜头时间轴】');
    lines.push('2. 确认角色定妆照引用正确');
    lines.push('3. 确认负面约束（暗黑风/金属光泽）已包含');
    lines.push('4. 确认角色一致性约束已包含');
    lines.push('5. 确认 Prompt 长度在 980 字符以内');
    lines.push('');
    lines.push('**请回复 "确认" 继续渲染，或 "修改" 并指出问题**');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 生成最终报告（含确认环节 + 渲染结果 + 后期制作）
   */
  _generateFinalReport(scriptResult, productionResult, renderResult, postResult, totalTime, confirmations) {
    const blueprint = scriptResult.blueprint;
    const validation = scriptResult.validation;
    const report = scriptResult.report;
    const production = productionResult;
    const render = renderResult?.render || { submitted: 0, failed: 0 };

    const lines = [];

    lines.push('# 超现实工业创作系统 - 生产报告');
    lines.push(`**版本**: v${this.version}  |  **总耗时**: ${totalTime}ms`);
    lines.push('');

    // 确认状态
    lines.push('## ✅ 确认状态');
    lines.push('');
    lines.push(`| 环节 | 状态 | 时间 |`);
    lines.push(`|------|------|------|`);
    if (confirmations?.script) {
      lines.push(`| 剧本确认 | ${confirmations.script.approved ? '✅ 通过' : '❌ 未通过'} ${confirmations.script.skipped ? '(跳过)' : ''} | ${confirmations.script.reviewedAt || 'N/A'} |`);
    }
    if (confirmations?.prompts) {
      lines.push(`| 提示词审核 | ${confirmations.prompts.approved ? '✅ 通过' : '❌ 未通过'} ${confirmations.prompts.skipped ? '(跳过)' : ''} | ${confirmations.prompts.reviewedAt || 'N/A'} |`);
    }
    lines.push('');

    // 项目信息
    lines.push('## 📋 项目信息');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 标题 | ${blueprint.meta.title || '未命名'} |`);
    lines.push(`| 叙事模式 | ${blueprint.meta.narrative_mode || 'default'} |`);
    lines.push(`| 目标时长 | ${blueprint.meta.target_duration || 120}s |`);
    lines.push(`| 场景数 | ${report.scenes_count} |`);
    lines.push(`| 角色数 | ${report.characters_count} |`);
    lines.push(`| 台词数 | ${report.dialogues_count} |`);
    lines.push('');

    // 剧本校验
    lines.push('## ✅ 剧本校验');
    lines.push(`**状态**: ${validation.passed ? '通过 ✓' : '未通过 ✗'} | **综合评分**: ${validation.overall_score}/100`);
    lines.push('');
    lines.push(`| 维度 | 评分 |`);
    lines.push(`|------|------|`);
    for (const [dim, score] of Object.entries(validation.scores?.detailed || {})) {
      lines.push(`| ${dim} | ${score} |`);
    }
    lines.push('');

    // 镜头总览
    lines.push('## 🎬 镜头总览');
    lines.push(`| 镜头ID | 类型 | 时长 | Prompt长度 | 状态 |`);
    lines.push(`|--------|------|------|------------|------|`);
    for (const shot of production.shots) {
      lines.push(`| ${shot.shotId} | ${shot.sceneType} | ${shot.timing.duration}s | ${shot.prompt?.length || 0} | ${shot.status} |`);
    }
    lines.push('');

    // 渲染结果
    if (renderResult && !renderResult.skipped) {
      lines.push('## 🎨 渲染结果');
      lines.push(`| 提交 | 成功 | 失败 | 成功率 |`);
      lines.push(`|------|------|------|--------|`);
      lines.push(`| ${render.results.length} | ${render.submitted} | ${render.failed} | ${render.results.length > 0 ? Math.round((render.submitted / render.results.length) * 100) : 0}% |`);
      lines.push('');
    }

    // 完整 Prompts
    lines.push('## 📝 完整 Prompts');
    lines.push('');
    for (const p of production.prompts) {
      lines.push(`### ${p.shotId}`);
      lines.push(`**长度**: ${p.length} 字符 | **定妆照**: ${p.imageRefs?.length || 0} 张`);
      lines.push('');
      lines.push('```');
      lines.push(p.prompt);
      lines.push('```');
      lines.push('');
    }

    // 质量门
    const qg = production.stages?.qualityGate;
    if (qg) {
      lines.push('## 🛡️ 质量门检查');
      lines.push(`**状态**: ${qg.passed ? '通过 ✓' : '失败 ✗'} (${qg.passedCount}/${qg.totalPrompts})`);
      lines.push('');
      lines.push(`| 镜头 | 有镜头时间轴 | 有角色 | 长度合规 | 状态 |`);
      lines.push(`|------|------------|--------|----------|------|`);
      for (const check of (qg.checks || [])) {
        lines.push(`| ${check.shotId} | ${check.hasTimeline ? '✓' : '✗'} | ${check.hasCharacters ? '✓' : '✗'} | ${check.withinLimit ? '✓' : '✗'} | ${check.passed ? '✓' : '✗'} |`);
      }
      lines.push('');
    }

    // 后期制作结果
    if (postResult && !postResult.skipped) {
      const post = postResult;
      lines.push('## 🎬 后期制作');
      lines.push(`**状态**: ${post.success ? '通过 ✓' : '未通过 ✗'}`);
      lines.push('');
      
      // 版本列表
      lines.push('### 输出版本');
      lines.push(`| 版本 | 字幕 | 音乐 | 弹幕 | 转场 | 片头 |`);
      lines.push(`|------|------|------|------|------|------|`);
      for (const [version, data] of Object.entries(post.versions || {})) {
        const f = data.features || {};
        lines.push(`| ${version} | ${f.subtitles ? '✓' : '✗'} | ${f.music ? '✓' : '✗'} | ${f.danmaku ? '✓' : '✗'} | ${f.transitions ? '✓' : '✗'} | ${f.titleCard ? '✓' : '✗'} |`);
      }
      lines.push('');
      
      // 字幕预览
      if (post.stages?.subtitles?.tracks?.length > 0) {
        lines.push('### 身份介绍字幕');
        lines.push(`| 角色 | 场景 | 时长 | 内容 |`);
        lines.push(`|------|------|------|------|`);
        for (const sub of post.stages.subtitles.tracks.slice(0, 3)) {
          lines.push(`| ${sub.characterName} | ${sub.sceneId} | ${sub.duration}s | ${sub.content.title} |`);
        }
        lines.push('');
      }
      
      // 音乐预览
      if (post.stages?.music?.tracks?.length > 0) {
        lines.push('### 无版权音乐配置');
        lines.push(`| 场景 | 风格 | 情绪 | 音量 |`);
        lines.push(`|------|------|------|------|`);
        for (const track of post.stages.music.tracks.slice(0, 3)) {
          lines.push(`| ${track.sceneId} | ${track.searchParams.genre} | ${track.searchParams.mood} | ${track.config.volume} |`);
        }
        lines.push('');
      }
      
      // 弹幕预览
      if (post.stages?.danmaku?.list?.length > 0) {
        lines.push('### 弹幕预览');
        lines.push(`| 内容 | 场景 | 颜色 |`);
        lines.push(`|------|------|------|`);
        for (const dm of post.stages.danmaku.list.slice(0, 3)) {
          lines.push(`| ${dm.text} | ${dm.sceneId} | ${dm.color} |`);
        }
        lines.push('');
      }
    }

    // 时序分析
    lines.push('## ⏱️ 时序分析');
    lines.push('');
    lines.push(`| 阶段 | 耗时 | 占比 |`);
    lines.push(`|------|------|------|`);
    lines.push(`| 剧本引擎 | ${scriptResult.timing || 'N/A'} | - |`);
    lines.push(`| 制作引擎 | ${production.timing?.total || 'N/A'} | - |`);
    lines.push(`| 渲染引擎 | ${renderResult?.timing?.total || 'N/A'} | - |`);
    lines.push(`| 后期引擎 | ${postResult?.timing?.total || 'N/A'} | - |`);
    lines.push(`| 总耗时 | ${totalTime}ms | 100% |`);
    lines.push('');

    lines.push('---');
    lines.push(`*生成时间: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * 保存完整结果到文件
   */
  async save(result, outputDir) {
    const fs = require('fs').promises;
    const path = require('path');

    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = path.join(outputDir, `hyperreality-${timestamp}`);

    // 保存完整结果 JSON
    await fs.writeFile(
      `${basePath}-result.json`,
      JSON.stringify(result, null, 2)
    );

    // 保存 Markdown 报告
    if (result.finalReport) {
      await fs.writeFile(
        `${basePath}-report.md`,
        result.finalReport
      );
    }

    // 保存剧本确认报告
    if (result.confirmations?.script?.report) {
      await fs.writeFile(
        `${basePath}-script-review.md`,
        result.confirmations.script.report
      );
    }

    // 保存提示词审核报告
    if (result.confirmations?.prompts?.report) {
      await fs.writeFile(
        `${basePath}-prompt-review.md`,
        result.confirmations.prompts.report
      );
    }

    // 保存后期制作报告
    if (result.stages?.postProductionEngine?.report) {
      await fs.writeFile(
        `${basePath}-post-production.md`,
        result.stages.postProductionEngine.report
      );
    }

    // 保存 Prompts 单独文件
    if (result.stages?.productionEngine?.prompts) {
      const promptsMD = this._generatePromptsOnlyMD(result.stages.productionEngine.prompts);
      await fs.writeFile(
        `${basePath}-prompts.md`,
        promptsMD
      );
    }

    console.log(`\n💾 结果已保存到: ${outputDir}`);
    return outputDir;
  }

  /**
   * 生成纯 Prompts MD
   */
  _generatePromptsOnlyMD(prompts) {
    const lines = [];
    lines.push('# 镜头 Prompts 清单');
    lines.push('');

    for (const p of prompts) {
      lines.push(`## ${p.shotId}`);
      lines.push('');
      lines.push(p.prompt);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = { HyperrealitySystem };
