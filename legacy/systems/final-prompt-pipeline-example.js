const { FinalPromptBuilder } = require('./final-prompt-builder-v1');
const { PromptValidator } = require('./prompt-validator-v1');

class FinalPromptPipelineExample {
  constructor(options = {}) {
    this.builder = new FinalPromptBuilder(options);
    this.validator = new PromptValidator({ maxLength: 1500 });
  }

  async buildPromptForShot(shot, context = {}) {
    // 1. 构建
    const built = await this.builder.build(shot, context);

    // 2. 校验
    const validation = this.validator.validate(built);

    // 3. 返回结果
    return {
      success: validation.valid,
      prompt: built.prompt,
      fields: built.fields,
      length: built.length,
      missingFields: built.missingFields,
      validation
    };
  }
}

module.exports = { FinalPromptPipelineExample };

if (require.main === module) {
  (async () => {
    const pipeline = new FinalPromptPipelineExample();

    const shot = {
      id: 'S01',
      type: 'opening',
      scene: '青丘灵原',
      emotionPhase: '神秘、敬畏',
      narration: '小G第一次走入荧光草浪起伏的平原，远处异兽的轮廓在雾中浮现。',
      characters: ['小G'],
      visualPrompt: '荧光草地、远山、双恒星光照'
    };

    const context = {
      totalShots: 6,
      beastId: 'jiu-wei',
      beastName: '九尾狐',
      habitat: '青丘灵原',
      episodeTheme: '初遇与信任',
      storyGoal: '建立世界观与情绪钩子',
      protagonistName: '小G',
      sceneType: 'nature_epic'
    };

    const result = await pipeline.buildPromptForShot(shot, context);
    console.log(JSON.stringify(result, null, 2));
  })();
}
