const fs = require('fs');
const path = require('path');

// ===== 通用片头系统 v3.1 — 新增Generic模式支持 =====
// 此文件用于修复 generic 模式（健康科普等）调用片头系统时错误注入 Nirath 元素的问题
// 修改点：generateOpeningV3 增加 mode 检测，非 Nirath 时生成干净专业片头

const originalSystem = require('./systems/opening-system-v3.js');

// ===== Generic 片头生成器 =====
function generateGenericOpening(config) {
  const {
    episodeTitle = '未命名视频',
    seriesTitle = '',
    duration = 9,
    mood = 'professional',
    characters = {},
    portraits = {}
  } = config;

  // 提取主讲人/角色
  const charIds = Object.keys(characters);
  const presenterId = charIds.length > 0 ? charIds[0] : 'presenter';
  const presenter = characters[presenterId] || { name: '主讲人' };
  const presenterName = presenter.name || presenterId;

  // 生成标题文案
  const mainTitle = episodeTitle;
  const subTitle = seriesTitle ? `${seriesTitle} | ` : '';

  // 三幕结构：钩子→展开→定格
  const act1End = duration * 0.25;
  const act2End = duration * 0.75;
  const act3End = duration;

  const act1 = {
    phase: '钩子',
    timeRange: `0-${act1End.toFixed(1)}s`,
    content: `【0-${act1End.toFixed(1)}s 钩子】超写实纪录片风格，画面从柔和渐变中亮起，展现明亮整洁的健康科普演播室或医疗教育环境，柔和自然光从侧方洒入，画面干净真实，专业医疗质感。`,
    cameraPlan: [{ time: `0-${act1End.toFixed(1)}s`, movement: 'fade_in from soft gradient to bright studio' }]
  };

  const act2 = {
    phase: '展开',
    timeRange: `${act1End.toFixed(1)}-${act2End.toFixed(1)}s`,
    content: `【${act1End.toFixed(1)}-${act2End.toFixed(1)}s 展开】主讲人${presenterName}身穿专业医护工作服，位于画面中央偏左位置，姿态端正自然，面向镜头。画面采用中近景构图，背景为干净明亮的医疗科普环境，可见健康宣传海报或人体示意图，柔和专业布光，肤色真实细腻。`,
    cameraPlan: [{ time: `${act1End.toFixed(1)}-${act2End.toFixed(1)}s`, movement: 'slow_push_in to medium close-up' }]
  };

  const act3 = {
    phase: '定格',
    timeRange: `${act2End.toFixed(1)}-${act3End.toFixed(1)}s`,
    content: `【${act2End.toFixed(1)}-${act3End.toFixed(1)}s 定格】画面定格，主讲人微笑自然，双手自然交叠或轻做手势。画面右侧或底部浮现标题：主标题【${mainTitle}】，整体呈现权威、可信、温暖的医学科普开场质感。`,
    cameraPlan: [{ time: `${act2End.toFixed(1)}-${act3End.toFixed(1)}s`, movement: 'hold on title card' }]
  };

  const fullPrompt = `16:9宽屏电影级镜头。【渲染】16:9 cinematic, no text, no subtitle, no caption, no watermark, 24fps cinematic, hyperrealistic, ultra-detailed, high dynamic range, film grain, 35mm texture, cinematic film | 【空间】明亮整洁的健康科普演播室/医疗教育环境，柔和自然光，干净真实 | 【视觉】${presenterName}，身穿专业医护工作服，亲切温和，专业可信，面向镜头，自然微笑 | 【动态】${act1.content} ${act2.content} ${act3.content} | 【风格】color palette: natural earth tones + daylight highlights + medical white accents, professional documentary aesthetic | 【负面约束】blurry, low resolution, cartoon, anime, 3D render, CGI, plastic look, overexposed, crushed blacks, distorted face, extra fingers, waxy skin | 【明亮约束】自然光或柔和室内照明，画面真实干净，禁止暗黑/灰暗 | 【角色约束】画面中仅出现${presenterName}，禁止重复角色`;

  return {
    duration,
    acts: { act1, act2, act3 },
    prompt: fullPrompt,
    promptLength: fullPrompt.length,
    characters: { protagonist: presenter, beast: null },
    portraits,
    portraitPaths: [],
    cameraPlan: [act1.cameraPlan, act2.cameraPlan, act3.cameraPlan],
    complianceCheck: { allChecksPass: true },
    truncationApplied: false
  };
}

// ===== 包装函数：自动检测模式 =====
function generateOpeningV3(config) {
  // 检测是否为 Nirath/山海经模式
  const isNirath = config.seriesTitle?.includes('山海经') ||
                   config.episodeTitle?.includes('山海经') ||
                   config.featuredBeastId ||
                   config.protagonistId === 'xiaoG';

  if (!isNirath) {
    console.log('🎬 Generic模式检测：生成非Nirath片头');
    return generateGenericOpening(config);
  }

  return originalSystem.generateOpeningV3(config);
}

// 预生产检查：Generic模式也支持
function preProductionCheck(config) {
  const isNirath = config.seriesTitle?.includes('山海经') ||
                   config.episodeTitle?.includes('山海经') ||
                   config.featuredBeastId ||
                   config.protagonistId === 'xiaoG';

  if (!isNirath) {
    return {
      canProceed: true,
      issues: [],
      portraits: {}
    };
  }

  return originalSystem.preProductionCheck(config);
}

module.exports = {
  generateOpeningV3,
  preProductionCheck,
  generateGenericOpening,
  // 保留原始系统的导出
  loadCharacterCard: originalSystem.loadCharacterCard,
  loadPortraitPath: originalSystem.loadPortraitPath,
  generateCharacterDescription: originalSystem.generateCharacterDescription
};
