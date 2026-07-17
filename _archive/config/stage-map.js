'use strict';

const STAGE_MAP = [
  { stageId: 'STAGE-1', title: 'PRD生成', progress: 5, capability: null },
  { stageId: 'STAGE-2', title: '需求对齐', progress: 8, capability: null },
  { stageId: 'STAGE-3', title: 'Schema校验', progress: 10, capability: null },
  { stageId: 'STAGE-4', title: '角色系统', progress: 15, capability: null },
  { stageId: 'STAGE-5', title: '剧本生成', progress: 20, capability: 'scriptService' },
  { stageId: 'STAGE-6', title: '时长分配', progress: 30, capability: 'durationService' },
  { stageId: 'STAGE-7', title: '故事板生成', progress: 40, capability: 'storyboardService' },
  { stageId: 'STAGE-7.2', title: '主角主动性注入', progress: 43, capability: null },
  { stageId: 'STAGE-7.3', title: 'Narration精简', progress: 45, capability: null },
  { stageId: 'STAGE-7.4', title: '时长对齐', progress: 47, capability: null },
  { stageId: 'STAGE-7.5', title: '片头生成', progress: 49, capability: null },
  { stageId: 'STAGE-8', title: '故事板校验', progress: 52, capability: null },
  { stageId: 'STAGE-8.5', title: '五要素检查', progress: 54, capability: null },
  { stageId: 'STAGE-9', title: '运镜生成', progress: 58, capability: 'cameraService' },
  { stageId: 'STAGE-10', title: '连续性检查', progress: 62, capability: null },
  { stageId: 'STAGE-10.5', title: '渲染前置检查', progress: 65, capability: null },
  { stageId: 'STAGE-11', title: '渲染前准备', progress: 70, capability: 'renderPrepService' },
  { stageId: 'STAGE-11.5', title: 'Prompt质量闸门', progress: 73, capability: 'qualityGate' },
  { stageId: 'STAGE-12', title: '合规检查', progress: 78, capability: null },
  { stageId: 'STAGE-13', title: '定妆照/引用图检查', progress: 82, capability: null },
  { stageId: 'STAGE-14', title: '风格注入', progress: 86, capability: null },
  { stageId: 'STAGE-15', title: '后期规则', progress: 90, capability: null },
  { stageId: 'STAGE-16', title: '导演优化', progress: 94, capability: null },
  { stageId: 'STAGE-17', title: '编剧闭环优化', progress: 97, capability: null }
];

function getStageMap(mode = 'nirath') {
  return STAGE_MAP;
}

function getStageMeta(stageId) {
  return STAGE_MAP.find(s => s.stageId === stageId) || null;
}

module.exports = {
  STAGE_MAP,
  getStageMap,
  getStageMeta
};