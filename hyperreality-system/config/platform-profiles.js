'use strict';

/**
 * PlatformProfiles（平台规格蓝图）
 * ------------------------------------------------------------
 * 【v2.5.0 新增】社媒营销包 SocialPack · P0-2
 *
 * 把平台规则从"成片后补丁"升格为"蓝图级输入"：蓝图阶段一次确定，
 * 画幅/单镜时长带/台词速率/钩子约束/CTA/画面文字政策全链路下游继承。
 *
 * 各字段含义：
 *   ratio            画幅（约束模板的唯一来源）
 *   shotDuration     单镜时长带 {min, max}（营销快节奏收窄）
 *   speechRate       台词速率基准/极限（营销 VO 快于电影叙事）
 *   hook             钩子规则 {windowSec: 钩子窗口, productInHook: 商品是否须在钩子在场}
 *   cta              CTA 规则 {required: 是否强制, position: 'final'|'any'}
 *   onscreenText     画面文字政策 {mode: 'designed'|'forbidden'}
 *                      - forbidden: 电影叙事包默认，负面约束全画面禁字
 *                      - designed: 社媒营销包，放行设计化文字，仅禁水印/乱码/平台UI文字
 *   safeArea         竖屏安全区（避开平台 UI 遮挡）
 *   subtitleLanguage 字幕语言
 */

const PROFILES = {
  cinematic: {
    name: '电影叙事（默认）',
    ratio: '16:9',
    shotDuration: { min: 3, max: 12 },
    speechRate: { normal: 3.5, limit: 4.5 },
    hook: null,
    cta: { required: false, position: 'any' },
    onscreenText: { mode: 'forbidden' },
    safeArea: null,
    subtitleLanguage: 'zh'
  },
  tiktok: {
    name: 'TikTok',
    ratio: '9:16',
    shotDuration: { min: 2, max: 5 },
    speechRate: { normal: 4.5, limit: 5.5 },
    hook: { windowSec: 2, productInHook: true, styles: ['pattern-interrupt', 'question', 'data-shock', 'contrast'] },
    cta: { required: true, position: 'final' },
    onscreenText: { mode: 'designed' },
    safeArea: {
      note: '9:16 画布避开右侧 120px 操作栏与底部 320px 文案/按钮区，核心文字居中偏上 2/3 区域',
      rightRailPx: 120,
      bottomPx: 320,
      topPx: 120
    },
    subtitleLanguage: 'en'
  },
  douyin: {
    name: '抖音',
    ratio: '9:16',
    shotDuration: { min: 2, max: 5 },
    speechRate: { normal: 4.5, limit: 5.5 },
    hook: { windowSec: 3, productInHook: true, styles: ['question', 'conflict', 'data-shock', 'contrast'] },
    cta: { required: true, position: 'final' },
    onscreenText: { mode: 'designed' },
    safeArea: { note: '避开右侧 120px 操作栏与底部 320px 文案区', rightRailPx: 120, bottomPx: 320, topPx: 120 },
    subtitleLanguage: 'zh'
  },
  xiaohongshu: {
    name: '小红书',
    ratio: '3:4',
    shotDuration: { min: 3, max: 6 },
    speechRate: { normal: 4.0, limit: 5.0 },
    hook: { windowSec: 3, productInHook: false, styles: ['aesthetic', 'value-preview'] },
    cta: { required: false, position: 'final' },
    onscreenText: { mode: 'designed' },
    safeArea: { note: '避开底部 240px 文案区', rightRailPx: 0, bottomPx: 240, topPx: 100 },
    subtitleLanguage: 'zh'
  },
  'instagram-reels': {
    name: 'Instagram Reels',
    ratio: '9:16',
    shotDuration: { min: 3, max: 5 },
    speechRate: { normal: 4.2, limit: 5.2 },
    hook: { windowSec: 2, productInHook: false, styles: ['aesthetic-first-frame', 'pattern-interrupt'] },
    cta: { required: false, position: 'final' },
    onscreenText: { mode: 'designed' },
    safeArea: { note: '避开右侧 120px 与底部 280px', rightRailPx: 120, bottomPx: 280, topPx: 120 },
    subtitleLanguage: 'en'
  }
};

const DEFAULT_PROFILE = PROFILES.cinematic;

/**
 * 解析镜头所属平台 Profile（逐级回退：shot.platform > blueprint.platform > cinematic）
 */
function resolveProfile(shot = {}, blueprint = {}) {
  const key = shot.platform || blueprint.platform || 'cinematic';
  const profile = PROFILES[key] || DEFAULT_PROFILE;
  return { ...profile, platformKey: PROFILES[key] ? key : 'cinematic' };
}

/** 生成约束模板字符串（蓝图驱动的 constraintTemplate 唯一来源） */
function constraintTemplateOf(profile, extra = '') {
  const base = `${profile.ratio}画幅，8K分辨率，24fps，MP4格式`;
  return extra ? `${base}，${extra}` : base;
}

/** 是否为社媒营销场景（画面文字政策为 designed 即营销包） */
function isSocialCommerce(profile) {
  return !!(profile.onscreenText && profile.onscreenText.mode === 'designed');
}

module.exports = { PROFILES, resolveProfile, constraintTemplateOf, isSocialCommerce };
