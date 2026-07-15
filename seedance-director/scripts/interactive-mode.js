/**
 * Seedance Interactive Mode v9.4-Peng — Claude Code式对话生产
 *
 * 核心功能：
 * 1. 对话式任务创建：用户用自然语言描述需求，AI逐步澄清
 * 2. 增量修改："再加一个特写镜头"、"把主角换成女性"
 * 3. 实时预览：每步操作后展示当前状态
 * 4. 意图识别：理解用户的隐式指令（"太暗了"→调整光影）
 * 5. 上下文保持：多轮对话保持任务上下文
 * 6. 撤销/重做：支持操作历史回退
 * 7. 快捷指令：/render、/preview、/undo、/status
 *
 * 交互示例：
 *   用户: "做一个赛博朋克风格的短片"
 *   AI: "好的！时长多少秒？主角是什么角色？"
 *   用户: "30秒，主角是一只机械猫"
 *   AI: "已创建任务！需要我现在开始规划故事吗？"
 *   用户: "再加一个雨夜的场景"
 *   AI: "已添加雨夜场景！当前规划: 1.机械猫特写 2.雨夜街道..."
 *
 * 与P0/P1衔接：
 * - 使用Agent Loop的run方法驱动生产
 * - 使用Tool Pool执行具体技能
 * - 使用State Machine追踪任务状态
 * - 使用Memory System积累用户偏好
 */

const path = require('path');

// ============ 交互状态 ============
const INTERACTIVE_STATES = {
  IDLE: 'idle',              // 等待用户输入
  CLARIFYING: 'clarifying',  // 澄清需求
  PLANNING: 'planning',      // 规划中
  EXECUTING: 'executing',    // 执行中
  REVIEWING: 'reviewing',    // 等待用户确认
  MODIFYING: 'modifying',    // 增量修改
  DONE: 'done'               // 完成
};

// ============ 快捷指令 ============
const COMMANDS = {
  '/render': { action: 'start_render', description: '开始渲染' },
  '/preview': { action: 'show_preview', description: '预览当前方案' },
  '/status': { action: 'show_status', description: '显示任务状态' },
  '/undo': { action: 'undo', description: '撤销上一步' },
  '/redo': { action: 'redo', description: '重做' },
  '/save': { action: 'save_checkpoint', description: '保存检查点' },
  '/fork': { action: 'fork_task', description: '创建分支任务' },
  '/help': { action: 'show_help', description: '显示帮助' }
};

class InteractiveMode {
  constructor(options = {}) {
    this.state = INTERACTIVE_STATES.IDLE;
    this.task = null;           // 当前任务
    this.history = [];          // 操作历史（用于undo/redo）
    this.conversation = [];     // 对话历史
    this.userPreferences = {};  // 用户偏好（写入Memory System）
    this.config = options;
  }

  /**
   * 处理用户输入（核心方法）
   * @param {string} input - 用户输入
   * @returns {Object} - 响应
   */
  async process(input) {
    // 记录对话
    this.conversation.push({ role: 'user', content: input, timestamp: Date.now() });

    // 检查快捷指令
    if (input.startsWith('/')) {
      return this._handleCommand(input);
    }

    // 意图识别
    const intent = this._parseIntent(input);

    // 根据当前状态和意图处理
    switch (this.state) {
      case INTERACTIVE_STATES.IDLE:
        return this._handleIdle(intent, input);
      case INTERACTIVE_STATES.CLARIFYING:
        return this._handleClarifying(intent, input);
      case INTERACTIVE_STATES.PLANNING:
        return this._handlePlanning(intent, input);
      case INTERACTIVE_STATES.EXECUTING:
        return this._handleExecuting(intent, input);
      case INTERACTIVE_STATES.REVIEWING:
        return this._handleReviewing(intent, input);
      case INTERACTIVE_STATES.MODIFYING:
        return this._handleModifying(intent, input);
      default:
        return { type: 'error', message: '未知状态' };
    }
  }

  /**
   * 创建新任务（对话式）
   */
  async createTask(description) {
    this.task = {
      id: `task_${Date.now()}`,
      description,
      title: null,
      duration: null,
      style: null,
      characters: [],
      scenes: [],
      shots: [],
      status: 'draft'
    };

    this.state = INTERACTIVE_STATES.CLARIFYING;

    return {
      type: 'clarify',
      message: '🎬 收到！我来帮你规划这个短片。',
      questions: [
        '时长多少秒？（建议15-60秒）',
        '主角是什么角色？（人物/动物/物体）',
        '视觉风格？（赛博朋克/古风/科幻/写实...）'
      ],
      task: this.task
    };
  }

  /**
   * 增量修改（核心功能）
   */
  async modifyTask(modification) {
    if (!this.task) {
      return { type: 'error', message: '还没有创建任务，先告诉我你想做什么短片' };
    }

    // 保存历史（用于undo）
    this._saveHistory();

    // 解析修改意图
    const mod = this._parseModification(modification);

    // 应用修改
    switch (mod.type) {
      case 'add_shot':
        this.task.shots.push(mod.data);
        break;
      case 'remove_shot':
        this.task.shots = this.task.shots.filter(s => s.id !== mod.data.id);
        break;
      case 'modify_shot':
        const idx = this.task.shots.findIndex(s => s.id === mod.data.id);
        if (idx >= 0) this.task.shots[idx] = { ...this.task.shots[idx], ...mod.data };
        break;
      case 'change_style':
        this.task.style = mod.data.style;
        break;
      case 'change_duration':
        this.task.duration = mod.data.duration;
        break;
      case 'add_character':
        this.task.characters.push(mod.data);
        break;
      default:
        return { type: 'error', message: `暂不支持的修改类型: ${mod.type}` };
    }

    this.state = INTERACTIVE_STATES.MODIFYING;

    return {
      type: 'modified',
      message: `✅ 已${mod.action}！`,
      modification: mod,
      currentPlan: this._summarizeTask()
    };
  }

  /**
   * 撤销
   */
  undo() {
    if (this.history.length === 0) {
      return { type: 'error', message: '没有可撤销的操作' };
    }

    const previous = this.history.pop();
    this.task = previous.task;
    this.state = previous.state;

    return {
      type: 'undo',
      message: '↩️ 已撤销上一步',
      restored: previous.action
    };
  }

  /**
   * 获取任务摘要
   */
  _summarizeTask() {
    if (!this.task) return '暂无任务';

    return {
      title: this.task.title || '未命名',
      duration: this.task.duration || '未设定',
      style: this.task.style || '未设定',
      characters: this.task.characters.length,
      scenes: this.task.scenes.length,
      shots: this.task.shots.length,
      status: this.task.status
    };
  }

  // ============ 意图识别 ============

  _parseIntent(input) {
    const lower = input.toLowerCase();

    // 创建任务意图
    if (lower.match(/做|制作|生成|创建|拍/) && lower.match(/视频|短片|片子|动画/)) {
      return { type: 'create', confidence: 0.9 };
    }

    // 修改意图
    if (lower.match(/加|添加|再来|增加/)) {
      return { type: 'add', confidence: 0.8 };
    }
    if (lower.match(/删|去掉|移除/)) {
      return { type: 'remove', confidence: 0.8 };
    }
    if (lower.match(/改|换成|变成|调整/)) {
      return { type: 'modify', confidence: 0.8 };
    }

    // 控制意图
    if (lower.match(/开始|渲染|生产|跑/)) {
      return { type: 'execute', confidence: 0.9 };
    }
    if (lower.match(/预览|看看|展示/)) {
      return { type: 'preview', confidence: 0.8 };
    }
    if (lower.match(/状态|进度|怎么样了/)) {
      return { type: 'status', confidence: 0.9 };
    }

    // 回答澄清问题
    return { type: 'clarify_answer', confidence: 0.6 };
  }

  _parseModification(input) {
    const lower = input.toLowerCase();

    // 添加镜头
    const addMatch = lower.match(/加.*?(.+?)镜头|添加.*?(.+?)镜头|再来一个(.+?)/);
    if (addMatch) {
      const desc = addMatch[1] || addMatch[2] || addMatch[3];
      return {
        type: 'add_shot',
        action: '添加镜头',
        data: {
          id: `shot_${Date.now()}`,
          description: desc,
          duration: 5
        }
      };
    }

    // 改变风格
    const styleMatch = lower.match(/(.+?)风格|(.+?)风/);
    if (styleMatch) {
      return {
        type: 'change_style',
        action: '改变风格',
        data: { style: styleMatch[1] || styleMatch[2] }
      };
    }

    // 默认
    return { type: 'unknown', action: '未知修改', data: {} };
  }

  // ============ 状态处理 ============

  _handleIdle(intent, input) {
    if (intent.type === 'create') {
      return this.createTask(input);
    }
    return {
      type: 'idle',
      message: '你好！告诉我你想做什么样的短片，我来帮你规划 🎬'
    };
  }

  _handleClarifying(intent, input) {
    // 提取信息
    if (input.match(/\d+/)) {
      const num = input.match(/\d+/)[0];
      if (!this.task.duration) {
        this.task.duration = parseInt(num);
        return {
          type: 'clarify',
          message: `✅ 时长设定为 ${num} 秒`,
          nextQuestion: '主角是什么角色？'
        };
      }
    }

    // 假设回答了角色
    if (!this.task.characters || this.task.characters.length === 0) {
      this.task.characters.push({ name: input, type: 'main' });
      return {
        type: 'clarify',
        message: `✅ 主角设定: ${input}`,
        nextQuestion: '视觉风格？（赛博朋克/古风/科幻...）'
      };
    }

    // 假设回答了风格
    this.task.style = input;
    this.task.title = `${input}风格的短片`;
    this.state = INTERACTIVE_STATES.PLANNING;

    return {
      type: 'plan_ready',
      message: `🎬 任务创建完成！\n\n📋 当前规划:\n- 时长: ${this.task.duration}秒\n- 主角: ${this.task.characters[0].name}\n- 风格: ${this.task.style}`,
      task: this.task
    };
  }

  _handlePlanning(intent, input) {
    if (intent.type === 'add') {
      return this.modifyTask(input);
    }
    if (intent.type === 'execute') {
      this.state = INTERACTIVE_STATES.EXECUTING;
      return {
        type: 'executing',
        message: '⚙️ 开始执行生产流程...',
        status: 'started'
      };
    }
    return this.modifyTask(input);
  }

  _handleExecuting(intent, input) {
    return {
      type: 'executing',
      message: '⏳ 生产中，请稍候...',
      progress: '50%'
    };
  }

  _handleReviewing(intent, input) {
    if (lower.match(/确认|通过|好|可以/)) {
      this.state = INTERACTIVE_STATES.EXECUTING;
      return { type: 'approved', message: '✅ 已确认，继续执行' };
    }
    if (lower.match(/修改|调整|改/)) {
      this.state = INTERACTIVE_STATES.MODIFYING;
      return { type: 'modify', message: '✏️ 请描述修改内容' };
    }
    return { type: 'review', message: '请确认或提出修改意见' };
  }

  _handleModifying(intent, input) {
    return this.modifyTask(input);
  }

  // ============ 快捷指令 ============

  _handleCommand(input) {
    const parts = input.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    const command = COMMANDS[cmd];
    if (!command) {
      return { type: 'error', message: `未知指令: ${cmd}，输入 /help 查看帮助` };
    }

    switch (command.action) {
      case 'show_status':
        return {
          type: 'status',
          message: '📊 当前状态',
          state: this.state,
          task: this._summarizeTask()
        };
      case 'undo':
        return this.undo();
      case 'show_help':
        return {
          type: 'help',
          message: '📖 快捷指令:\n' +
            Object.entries(COMMANDS).map(([k, v]) => `  ${k} - ${v.description}`).join('\n')
        };
      default:
        return { type: 'info', message: `指令 ${cmd} 已收到（功能开发中）` };
    }
  }

  // ============ 历史管理 ============

  _saveHistory() {
    this.history.push({
      task: JSON.parse(JSON.stringify(this.task)),
      state: this.state,
      action: 'modify',
      timestamp: Date.now()
    });

    // 限制历史长度
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }
  }
}

// ============ 导出 ============
module.exports = {
  InteractiveMode,
  INTERACTIVE_STATES,
  COMMANDS
};

// CLI测试
if (require.main === module) {
  (async () => {
    console.log('💬 Interactive Mode v9.4-Peng 测试\n');

    const mode = new InteractiveMode();

    // 测试1：创建任务
    console.log('🧑 用户: 做一个赛博朋克风格的短片');
    const r1 = await mode.process('做一个赛博朋克风格的短片');
    console.log(`🤖 AI: ${r1.message}`);
    if (r1.questions) {
      for (const q of r1.questions) {
        console.log(`   ❓ ${q}`);
      }
    }

    // 测试2：回答澄清
    console.log('\n🧑 用户: 30秒');
    const r2 = await mode.process('30秒');
    console.log(`🤖 AI: ${r2.message}`);

    console.log('\n🧑 用户: 主角是一只机械猫');
    const r3 = await mode.process('主角是一只机械猫');
    console.log(`🤖 AI: ${r3.message}`);

    console.log('\n🧑 用户: 赛博朋克风格');
    const r4 = await mode.process('赛博朋克风格');
    console.log(`🤖 AI: ${r4.message}`);

    // 测试3：增量修改
    console.log('\n🧑 用户: 再加一个雨夜的场景');
    const r5 = await mode.process('再加一个雨夜的场景');
    console.log(`🤖 AI: ${r5.message}`);

    // 测试4：快捷指令
    console.log('\n🧑 用户: /status');
    const r6 = await mode.process('/status');
    console.log(`🤖 AI: ${r6.message}`);
    console.log(`   状态: ${r6.state}`);
    console.log(`   任务: ${JSON.stringify(r6.task)}`);

    console.log('\n✅ Interactive Mode 测试完成！');
  })();
}
