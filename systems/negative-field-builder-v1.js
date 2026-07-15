/**
 * 字段级负面提示构建器
 * 专门生成 NEGATIVE 字段
 */

class NegativeFieldBuilder {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 220;
  }

  build(context = {}) {
    const {
      sceneType = 'nature_epic',
      hasCharacter = true,
      isRealistic = true,
      extraNegatives = []
    } = context;

    const base = [
      'no blurry',
      'no low resolution',
      'no watermark',
      'no text',
      'no logo',
      'no duplicate elements',
      'no broken anatomy'
    ];

    const realistic = isRealistic ? [
      'no cartoon',
      'no anime',
      'no illustration',
      'no plastic skin',
      'no CGI look'
    ] : [];

    const character = hasCharacter ? [
      'no deformed hands',
      'no extra fingers',
      'no asymmetrical eyes',
      'no empty expression',
      'no dead eyes'
    ] : [];

    const sceneSpecificMap = {
      nature_epic: [
        'no fake water',
        'no plastic foliage',
        'no painted sky',
        'no dead landscape'
      ],
      character_narrative: [
        'no stiff pose',
        'no wax face',
        'no unnatural smile'
      ],
      urban: [
        'no distorted buildings',
        'no floating cars'
      ],
      scifi: [
        'no fantasy medieval props',
        'no random magic symbols'
      ],
      documentary: [
        'no oversaturated colors',
        'no dramatic fake glow'
      ]
    };

    const sceneSpecific = sceneSpecificMap[sceneType] || [];

    const all = [
      ...base,
      ...realistic,
      ...character,
      ...sceneSpecific,
      ...(extraNegatives || [])
    ];

    const unique = [...new Set(all)];
    let text = unique.join(', ');

    if (text.length > this.maxLength) {
      text = this._trim(unique).join(', ');
    }

    return text;
  }

  _trim(list) {
    const result = [];
    let len = 0;
    for (const item of list) {
      const addLen = item.length + 2;
      if (len + addLen > this.maxLength) break;
      result.push(item);
      len += addLen;
    }
    return result;
  }
}

module.exports = { NegativeFieldBuilder };
