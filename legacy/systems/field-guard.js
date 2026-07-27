/**
 * FieldGuard v6.7.0
 * 质量检查模块 - 25字段完整性校验
 * 继承并升级自 RenderPipelineGuard + RenderQAChecker
 */

const { 字段优先级, 字段标签映射 } = require('./prompt-stability-guard');

class FieldGuard {
  constructor(options = {}) {
    this.log = options.log || console.log;
    this.maxChars = options.maxChars || 3000;
    this.strictMode = options.strictMode !== false; // 默认严格模式
  }

  async validate(prompt, shot = {}) {
    const results = {
      passed: true,
      errors: [],
      warnings: [],
      checks: {}
    };

    // 1. P0 致命级检查（12项）
    const p0Result = this._checkP0(prompt, shot);
    results.checks.P0 = p0Result;
    if (!p0Result.passed) {
      results.passed = false;
      results.errors.push(...p0Result.errors);
    }
    results.warnings.push(...p0Result.warnings);

    // 2. P1 核心级检查（7项）
    const p1Result = this._checkP1(prompt, shot);
    results.checks.P1 = p1Result;
    if (!p1Result.passed) {
      if (this.strictMode) results.passed = false;
      results.warnings.push(...p1Result.warnings);
    }

    // 3. P2 增强级检查（4项）
    const p2Result = this._checkP2(prompt, shot);
    results.checks.P2 = p2Result;
    results.warnings.push(...p2Result.warnings);

    // 4. P3 可选级检查（2项）
    const p3Result = this._checkP3(prompt, shot);
    results.checks.P3 = p3Result;

    // 5. 通用检查（5项）
    const generalResult = this._checkGeneral(prompt, shot);
    results.checks.general = generalResult;
    if (!generalResult.passed) {
      results.passed = false;
      results.errors.push(...generalResult.errors);
    }

    // v6.7.0-patch: 字段长度下限检查（原 FieldGuard 只查存在性，漏报"存在但不足"）
    const lengthIssues = this._checkFieldLength(prompt);
    if (lengthIssues.length > 0) {
      results.warnings.push(...lengthIssues);
      // P0 字段长度不足视为 error
      const p0LengthErrors = lengthIssues.filter(w => w.includes('[P0]'));
      if (p0LengthErrors.length > 0) {
        results.passed = false;
        results.errors.push(...p0LengthErrors);
      }
    }

    return results;
  }

  _checkP0(prompt, shot) {
    const errors = [];
    const warnings = [];

    // P0-1: 导演指令
    if (!prompt.includes('【导演指令】') || !/(风格|质感|写实|情绪|技术)/.test(prompt)) {
      errors.push('P0-1: 导演指令缺失或四要素不完整（风格定位+写实要求+情绪基调+技术方向）');
    }

    // P0-2: 约束
    if (!prompt.includes('【约束】') || !/Aspect ratio|Resolution|Format|Frame rate/.test(prompt)) {
      warnings.push('P0-2: 约束字段缺失技术参数（画幅/分辨率/格式/帧率）');
    }

    // P0-3: 基础
    if (!prompt.includes('【基础】') || !/(8K|cinematic|photorealistic|highly detailed)/i.test(prompt)) {
      warnings.push('P0-3: 基础字段缺失画质锚定词');
    }

    // P0-4: 场景
    if (!prompt.includes('【场景】') || !/(interior|exterior|indoor|outdoor|室内|室外)/i.test(prompt)) {
      errors.push('P0-4: 场景字段缺失空间类型描述');
    }

    // P0-5: 灯光
    if (!prompt.includes('【灯光') || !/(key light|fill light|色温|color temperature|lighting)/i.test(prompt)) {
      errors.push('P0-5: 灯光字段缺失五要素（光源/色温/光质/光位/光比）');
    }

    // P0-6: 运镜
    if (!prompt.includes('【运镜】') || !/(Push In|Pull Out|Pan|Track|Follow|Crane|Orbit|推|拉|摇|移|跟|升降|环绕)/i.test(prompt)) {
      errors.push('P0-6: 运镜字段缺失运动方式描述');
    }

    // P0-7: 角色
    if (!prompt.includes('【角色】') && !/CHARACTER\s*:/i.test(prompt)) {
      errors.push('P0-7: 角色字段缺失');
    }

    // P0-8: 动作
    if (!prompt.includes('【动作】') && !/ACTION\s*:/i.test(prompt)) {
      errors.push('P0-8: 动作字段缺失');
    }

    // v6.7.0-dialogue-patch: P0-9 检查【对话指令】，向后兼容【台词】
    if (!prompt.includes('【对话指令】') && !prompt.includes('【台词】') && !prompt.includes('【旁白/台词】') && !/DIALOGUE\s*:/i.test(prompt)) {
      // 如果shot有dialogue或dialogueBlock则报错，否则仅警告
      if (shot.dialogue || shot.narration || (shot.dialogueBlock?.text)) {
        errors.push('P0-9: 有配音需求但对话指令字段缺失');
      } else {
        warnings.push('P0-9: 对话指令字段缺失（无配音需求）');
      }
    }

    // P0-10: 负面约束
    if (!prompt.includes('【负面约束】') || !/no text|no watermark|no blurry|no extra limbs/i.test(prompt)) {
      errors.push('P0-10: 负面约束缺失基础排除项（no text/no watermark/no blurry）');
    }

    // P0-11: 定妆照
    if (!prompt.includes('【定妆照】') && !/@image\d+/i.test(prompt)) {
      warnings.push('P0-11: 定妆照路径缺失（可能无角色需求）');
    }

    // P0-12: 角色一致性
    if (!prompt.includes('【角色一致性】') && !/只出现.*一人|禁止.*分身|禁止.*克隆/i.test(prompt)) {
      warnings.push('P0-12: 角色一致性锚定词缺失');
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  _checkP1(prompt, shot) {
    const warnings = [];

    // P1-1: 构图
    if (!prompt.includes('【构图】') || !/(Extreme Long Shot|Long Shot|Medium Shot|Close-Up|Extreme Close-Up|三分法|中心|对称)/i.test(prompt)) {
      warnings.push('P1-1: 构图字段缺失景别等级或主体位置');
    }

    // P1-2: 色彩
    if (!prompt.includes('【色彩') || !/(dominant|accent|saturation|contrast)/i.test(prompt)) {
      warnings.push('P1-2: 色彩字段缺失四维度描述');
    }

    // P1-3: 景深
    if (!prompt.includes('【景深】') || !/(shallow depth of field|deep depth of field|focus|bokeh)/i.test(prompt)) {
      warnings.push('P1-3: 景深字段缺失焦点位置或虚化程度');
    }

    // P1-4: 时间轴
    if (!prompt.includes('【时间轴】') && !prompt.includes('【全局时间定位】') && !/TIMELINE\s*:/i.test(prompt)) {
      warnings.push('P1-4: 时间轴字段缺失');
    }

    // P1-5: 情绪
    if (!prompt.includes('【情绪】') && !/mood|emotion|tense|serene|joyful|melancholic/i.test(prompt)) {
      warnings.push('P1-5: 情绪字段缺失');
    }

    // P1-6: 明亮约束
    if (!prompt.includes('【明亮约束】') || !/(bright|well-lit|clear visibility|no dark shadows|adequate illumination)/i.test(prompt)) {
      warnings.push('P1-6: 明亮约束字段缺失四要素');
    }

    // P1-7: 角色约束
    if (!prompt.includes('【角色约束】') || !/只出现|禁止.*入镜|禁止.*重复|禁止.*分身/i.test(prompt)) {
      warnings.push('P1-7: 角色约束字段缺失四项限制');
    }

    return { passed: warnings.length === 0, errors: [], warnings };
  }

  _checkP2(prompt, shot) {
    const warnings = [];

    // P2-1: 服装
    if (!prompt.includes('【服装】')) {
      warnings.push('P2-1: 服装字段缺失');
    }

    // P2-2: 道具
    if (!prompt.includes('【道具】')) {
      warnings.push('P2-2: 道具字段缺失');
    }

    // P2-3: 节奏
    if (!prompt.includes('【节奏】')) {
      warnings.push('P2-3: 节奏字段缺失');
    }

    // P2-4: 音频
    if (!prompt.includes('【音频】') && !/AUDIO\s*:/i.test(prompt)) {
      warnings.push('P2-4: 音频字段缺失');
    }

    return { passed: warnings.length === 0, errors: [], warnings };
  }

  _checkP3(prompt, shot) {
    const warnings = [];

    // P3-1: 化妆
    if (!prompt.includes('【化妆】')) {
      warnings.push('P3-1: 化妆字段缺失');
    }

    // P3-2: 转场
    if (!prompt.includes('【转场】')) {
      warnings.push('P3-2: 转场字段缺失');
    }

    return { passed: warnings.length === 0, errors: [], warnings };
  }

  _checkGeneral(prompt, shot) {
    const errors = [];
    const warnings = [];

    // 1. 字符数检查
    if (prompt.length > this.maxChars) {
      errors.push(`GEN-1: 提示词字符数超限(${prompt.length} > ${this.maxChars})`);
    }

    // 2. 跨字段一致性
    const hasColdMood = /(cold|cool|teal|cyan|blue)/i.test(prompt);
    const hasWarmMood = /(warm|golden|amber|orange)/i.test(prompt);
    if (hasColdMood && hasWarmMood) {
      warnings.push('GEN-2: 色彩冷暖调冲突（同时出现冷色调和暖色调关键词）');
    }

    // 3. 冗余检测
    const lines = prompt.split(' | ');
    const seen = new Set();
    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (seen.has(lower)) {
        warnings.push(`GEN-3: 冗余内容检测 - "${line.slice(0, 30)}..."`);
      }
      seen.add(lower);
    }

    // 4. 英文关键词优先检查
    const chineseTechTerms = /(高画质|电影级|自然光|浅景深|大光圈)/g;
    const matches = prompt.match(chineseTechTerms);
    if (matches && matches.length > 3) {
      warnings.push(`GEN-4: 技术术语中文描述过多(${matches.length}处)，建议优先使用英文关键词`);
    }

    // 5. 格式规范检查
    if (prompt.includes('。') || prompt.includes('；') || prompt.includes('：')) {
      warnings.push('GEN-5: 检测到中文标点（。/；/：），建议使用逗号分隔的关键词列表格式');
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  _checkFieldLength(prompt) {
    const issues = [];
    const specs = [
      ['导演指令', 50, 'P0'], ['约束', 100, 'P0'], ['基础', 80, 'P0'],
      ['场景', 150, 'P0'], ['灯光', 100, 'P0'], ['运镜', 80, 'P0'],
      ['角色', 50, 'P0'], ['动作', 100, 'P0'], ['负面约束', 200, 'P0'],
      ['角色一致性', 50, 'P0'], ['构图', 80, 'P1'], ['色彩', 80, 'P1'],
      ['景深', 60, 'P1'], ['时间轴', 150, 'P1'], ['情绪', 30, 'P1'],
      ['明亮约束', 50, 'P1'], ['角色约束', 50, 'P1'],
    ];
    for (const [tag, min, pri] of specs) {
      const m = prompt.match(new RegExp(`【${tag}[^】]*】([^【|]*)`));
      if (m) {
        const len = m[1].trim().length;
        if (len < min) {
          issues.push(`[${pri}] 字段长度不足：【${tag}】当前 ${len} 字符，要求 ≥ ${min}`);
        }
      }
    }
    return issues;
  }
}

module.exports = { FieldGuard };
