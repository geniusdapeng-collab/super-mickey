#!/usr/bin/env node
/**
 * Vertical Engine v3.6-Peng
 * M1 增强模块 — 竖屏镜头转换器
 * 
 * 将横屏镜头语言全面转换为竖屏 9:16
 */

const fs = require('fs').promises;
const fss = require('fs');

// 竖屏景别映射
const VERTICAL_SHOT_MAP = {
  '大全景': { vertical: '竖屏全景', usage: '极少使用，人物太小', template: '仅宏大场景首帧' },
  '全景': { vertical: '竖屏半全景', usage: '人物占画面30%', template: '人物占画面1/3高度' },
  '中景': { vertical: '竖屏中近景', usage: '最常用，人物占60%', template: '竖屏中近景，人物占画面60%' },
  '近景': { vertical: '竖屏胸像', usage: '高频使用，占70%', template: '竖屏胸像，胸部以上占70%' },
  '特写': { vertical: '竖屏面部特写', usage: '情绪爆发时', template: '竖屏面部特写，面部占80%' },
  '微距': { vertical: '竖屏眼部特写', usage: '关键时刻', template: '竖屏眼部极特写，眼部占50%' }
};

// 竖屏运镜映射
const VERTICAL_MOVEMENT_MAP = {
  '推轨': { vertical: '纵向推轨', template: '缓慢纵向推进，从全身推至面部' },
  '拉远': { vertical: '纵向拉远', template: '纵向拉远，revealing宏大背景' },
  '摇镜': { vertical: '上下摇镜', template: '从下至上摇镜，revealing天空' },
  '固定': { vertical: '固定机位', template: '固定机位，人物从下方走入中央' },
  '跟随': { vertical: '纵向跟随', template: '纵向跟随，人物保持中央' }
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fss.readFileSync(args.input, 'utf8'));
  
  const converted = convertToVertical(input);
  
  fss.writeFileSync(args.output, JSON.stringify(converted, null, 2));
  console.log('✅ Vertical Engine: 竖屏转换完成');
}

function convertToVertical(scenes) {
  return Object.entries(scenes).map(([id, scene]) => {
    // 转换 shots
    const convertedShots = (scene.shots || []).map(shot => {
      const shotSize = shot.camera?.shotSize || '中景';
      const movement = shot.camera?.movement || '固定';
      
      const verticalShot = VERTICAL_SHOT_MAP[shotSize] || VERTICAL_SHOT_MAP['中景'];
      const verticalMovement = VERTICAL_MOVEMENT_MAP[movement] || VERTICAL_MOVEMENT_MAP['固定'];
      
      return {
        ...shot,
        camera: {
          ...shot.camera,
          shotSize: verticalShot.vertical,
          movement: verticalMovement.vertical,
          verticalTemplate: `${verticalShot.template}, ${verticalMovement.template}`,
          composition: '竖屏构图：上1/3氛围+中1/3主体+下1/3细节'
        },
        description: convertDescription(shot.description)
      };
    });
    
    return {
      ...scene,
      shots: convertedShots,
      isVertical: true,
      aspectRatio: '9:16'
    };
  });
}

function convertDescription(desc) {
  if (!desc) return desc;
  // 添加竖屏构图提示
  return `${desc} （竖屏9:16构图，人物占画面高度60-70%）`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--output') args.output = argv[++i];
  }
  return args;
}

main();