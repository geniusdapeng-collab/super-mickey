/**
 * DirectorSkillInjector v6.7.0
 * 负责：导演技能增强（可选层）
 * 三套导演风格模板（基于斯皮尔伯格经典手法）：
 * - 雨夜手持（悬疑紧张）
 * - 史诗斯坦尼康（宏大场面）
 * - 温情斯坦尼康（温情治愈）
 */

class DirectorSkillInjector {
  constructor(options = {}) {
    this.log = options.log || console.log;
    this.templates = this._loadTemplates();
  }

  _loadTemplates() {
    return {
      'rainy_night_handheld': {
        name: '剧情_斯皮尔伯格_雨夜手持',
        targetFields: ['动作', '运镜'],
        enhancements: {
          动作: '增加急促紧张的身体语言描述，加入轻微颤抖和防御性姿态',
          运镜: '增加手持摄影特有的轻微晃动感，模拟雨夜中不稳定的光源反射'
        },
        applicable: (ctx) => ctx.mood?.includes('tense') || ctx.mood?.includes('suspense') || ctx.sceneType === 'night'
      },
      'epic_steadicam': {
        name: '剧情_斯皮尔伯格_史诗斯坦尼康',
        targetFields: ['运镜', '构图'],
        enhancements: {
          运镜: '增加斯坦尼康稳定器特有的流畅长镜头描述，强调空间纵深感',
          构图: '增加大场面全景构图和纵深层次感，使用广角透视强调空间规模'
        },
        applicable: (ctx) => ctx.mood?.includes('epic') || ctx.mood?.includes('grand') || ctx.sceneScale === 'large'
      },
      'warm_steadicam': {
        name: '剧情_斯皮尔伯格_温情斯坦尼康',
        targetFields: ['情绪', '灯光'],
        enhancements: {
          情绪: '增加温暖治愈的情绪关键词，强调柔和的情感氛围',
          灯光: '增加柔光、逆光轮廓光等温馨灯光描述，金色暖调为主'
        },
        applicable: (ctx) => ctx.mood?.includes('warm') || ctx.mood?.includes('healing') || ctx.mood?.includes('family')
      }
    };
  }

  async enhance(prompt, context, selectedTemplate = null) {
    let result = prompt || '';

    // 自动选择模板
    let template = selectedTemplate;
    if (!template) {
      for (const [key, t] of Object.entries(this.templates)) {
        if (t.applicable(context)) {
          template = key;
          break;
        }
      }
    }

    if (!template || !this.templates[template]) {
      return result; // 无匹配模板，不增强
    }

    const t = this.templates[template];
    this.log('DIRECTOR-SKILL', `  🎬 应用导演技能: ${t.name}`);

    // 增强目标字段
    for (const field of t.targetFields) {
      const tag = `【${field}】`;
      const enhancement = t.enhancements[field];
      
      if (result.includes(tag) && enhancement) {
        // 在现有字段描述后追加增强描述
        const regex = new RegExp(`(${tag}[^【|]*)(?=[【|]|$)`);
        result = result.replace(regex, (match) => {
          return `${match}, ${enhancement}`;
        });
      }
    }

    return result;
  }

  listTemplates() {
    return Object.entries(this.templates).map(([key, t]) => ({
      key,
      name: t.name,
      targetFields: t.targetFields
    }));
  }
}

module.exports = { DirectorSkillInjector };