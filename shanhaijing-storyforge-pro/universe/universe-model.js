/**
 * Story Universe Model v3.6-Peng
 * 统一故事模型 — 所有视图的单一真相源
 */

const UNIVERSE_SCHEMA = {
  version: '3.0',
  required: ['world', 'characters', 'plot', 'scenes'],
  
  world: {
    required: ['physical', 'social', 'rules', 'history'],
    physical: {
      geography: 'string',
      climate: 'string', 
      architecture: 'string',
      technology: 'string'
    },
    social: {
      power: 'string',
      economy: 'string',
      culture: 'string',
      language: 'string'
    },
    rules: {
      physics: 'string',
      morality: 'string',
      taboos: ['string']
    },
    history: {
      timeline: ['string'],
      legends: 'string',
      crisis: 'string'
    },
    visual_style: {
      color_palette: ['string'],
      cinematography: 'string',
      key_visuals: ['string']
    }
  },

  characters: {
    type: 'map',
    value: {
      required: ['exterior', 'interior', 'arc'],
      exterior: {
        appearance: 'string',
        age: 'string',
        style: 'string'
      },
      interior: {
        desire: 'string',
        fear: 'string',
        wound: 'string',
        secret: 'string',
        belief: 'string'
      },
      arc: {
        start: 'string',
        inciting: 'string',
        midpoint: 'string',
        darkest: 'string',
        climax: 'string',
        end: 'string'
      },
      voice: {
        pattern: 'string',
        vocabulary: 'string',
        phrases: ['string'],
        silence: 'string'
      },
      relationships: {
        type: 'map',
        value: 'string'
      }
    }
  },

  plot: {
    required: ['framework', 'acts'],
    framework: 'string',
    acts: [{
      number: 'number',
      purpose: 'string',
      beats: [{
        name: 'string',
        function: 'string',
        emotional: 'string',
        scenes: ['string']
      }]
    }],
    tension_curve: [{
      minute: 'number',
      value: 'number'
    }],
    twists: [{
      position: 'number',
      type: 'string',
      setup: 'string'
    }]
  },

  scenes: {
    type: 'map',
    value: {
      required: ['act', 'slugline', 'purpose'],
      act: 'number',
      beat: 'string',
      slugline: 'string',
      purpose: 'string',
      emotional_arc: 'string',
      characters: ['string'],
      key_moment: 'string',
      visual_notes: 'string',
      audio_notes: 'string',
      dialogues: [{
        character: 'string',
        text: 'string',
        subtext: 'string',
        function: 'string'
      }]
    }
  }
};

class StoryUniverse {
  constructor(data = {}) {
    this.data = {
      version: '3.0',
      universe_id: generateUUID(),
      world: data.world || {},
      characters: data.characters || {},
      plot: data.plot || {},
      scenes: data.scenes || {},
      metadata: {
        created_at: new Date().toISOString(),
        mode: data.mode || 'original'
      }
    };
  }

  // 层填充方法
  setWorld(world) { this.data.world = world; }
  setCharacters(characters) { this.data.characters = characters; }
  setPlot(plot) { this.data.plot = plot; }
  setScenes(scenes) { this.data.scenes = scenes; }

  // 验证
  validate() {
    // 简化的验证逻辑
    const errors = [];
    if (!this.data.world.physical) errors.push('Missing world.physical');
    if (Object.keys(this.data.characters).length === 0) errors.push('No characters');
    if (!this.data.plot.framework) errors.push('Missing plot.framework');
    if (Object.keys(this.data.scenes).length === 0) errors.push('No scenes');
    return errors;
  }

  // 序列化
  toJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  // 从JSON加载
  static fromJSON(json) {
    return new StoryUniverse(JSON.parse(json));
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

module.exports = { StoryUniverse, UNIVERSE_SCHEMA };