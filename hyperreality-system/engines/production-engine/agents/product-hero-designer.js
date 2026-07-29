'use strict';

/**
 * ProductHeroDesigner（商品定妆照设计器）
 * ------------------------------------------------------------
 * 【v2.6.0 新增】社媒营销包 SocialPack · P1-4
 *
 * 复用角色定妆照机制，为商品建立"英雄照绑定"体系：
 * 营销片的转化可信度来自商品真实感——UI 截图/产品实拍必须绑定，
 * 禁止渲染层虚构商品外观（虚构 UI 是营销片翻车头号原因）。
 *
 * 三层锚点（守卫可校验的硬规则）：
 *   1) 英雄照绑定  —— 实拍素材编号（heroImageId），格式 [A-Z0-9]+-[A-Z]+-\d{3}
 *   2) 材质/LOGO 锚点 —— 材质质感描述 + LOGO 位置与最小画面占比
 *   3) 卖点特写锚点 —— 与镜头承接卖点对应的特写动作/部位
 *
 * 跨镜头一致性：【商品一致性】字段锁定 LOGO 位置/英雄照角度/配色，
 * 同一 Brief 的 N 个镜头商品外观不得漂移。
 *
 * 输入：brief.productHero = {
 *   heroImageId: 'QW-HERO-001'（必填，实拍绑定；缺失时 normalize 记 issue）
 *   materials: ['磨砂玻璃质感UI卡片', ...],
 *   logo: { position: '界面左上角', minSizePct: 5 },
 *   closeups: ['生成按钮按下瞬间', '翻页动效']（卖点特写候选，按镜头卖点轮换）
 * }
 */

class ProductHeroDesigner {
  /** 英雄照绑定编号格式（实拍素材库编号纪律） */
  static HERO_ID_PATTERN = /^[A-Z0-9]+-[A-Z]+-\d{3}$/;

  /**
   * 生成【商品锚点】字段
   * @param {object} shot 镜头数据（shotId/sellingPoint）
   * @param {object} brief 营销 Brief（product/productHero）
   * @returns {{fieldText:string, anchors:object}}
   */
  designAnchor(shot = {}, brief = {}) {
    const hero = brief.productHero || {};
    const product = brief.product || '商品';
    const heroId = hero.heroImageId || '待绑定';
    const materials = (hero.materials && hero.materials.length ? hero.materials : ['商品真实材质']).join('、');
    const logo = hero.logo || {};
    const logoPos = logo.position || '画面内商品主体上';
    const logoPct = Number(logo.minSizePct) > 0 ? Number(logo.minSizePct) : 5;
    const closeup = this._pickCloseup(shot, hero);

    const anchors = { heroImageId: heroId, materials, logoPosition: logoPos, logoMinSizePct: logoPct, closeup };
    const fieldText = [
      `${product}英雄照实拍绑定（${heroId}），禁止虚构商品外观与 UI 元素`,
      `材质锚点：${materials}`,
      `LOGO锚点：${logoPos}，占画面不小于 ${logoPct}%`,
      `卖点特写锚点：${closeup}`
    ].join('；');
    return { fieldText, anchors };
  }

  /**
   * 生成【商品一致性】字段（跨镜头锁定）
   */
  designConsistency(brief = {}) {
    const hero = brief.productHero || {};
    const logo = hero.logo || {};
    const logoPos = logo.position || '画面内商品主体上';
    const heroId = hero.heroImageId || '待绑定';
    return `全片商品一致性锁定：英雄照统一绑定 ${heroId}，LOGO 固定${logoPos}，界面配色与英雄照角度跨镜一致，禁止同片出现第二种商品外观`;
  }

  /** 按镜头承接卖点轮换特写锚点（确定性，同镜同结果） */
  _pickCloseup(shot, hero) {
    const closeups = Array.isArray(hero.closeups) ? hero.closeups.filter(Boolean) : [];
    if (!closeups.length) return '商品核心功能区特写';
    const h = String(shot.shotId || 'S0').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return closeups[h % closeups.length];
  }
}

module.exports = { ProductHeroDesigner };
