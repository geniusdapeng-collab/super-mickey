# v6.2-patch99: 饕餮定妆照系统级升级（面部科学解析手册版）

**发布日期**: 2026-06-01
**队长确认**: 李大鹏 ✅
**核心问题**: 面部一致性 + 真人照片感 + 材质质感

---

## 升级内容

### 1. 面部科学解析手册集成（新增）
- **新增文件**: `docs/shanhaijing-beast-facial-analysis.md`（队长提供的面部科学解析手册）
- **面型修正**: `human-like face` → `chimeric anthropoid face, monstrous visage`
  - 明确为混合面型（人面+兽身），非真人照片
- **面部皮肤质感**: `thick skin texture, not human skin`
  - 基于手册2.4.1：面部皮肤分区，厚皮肤适应陆生大型动物
- **表情神态**: `thick lips, powerful jaw muscles bulging`
  - 基于手册3.3.2：狰狞神态 — 牙齿外露+面部褶皱+眦裂

### 2. 面部一致性强化（修复）
- **负面约束增强**:
  - `NO realistic human face` — 禁止真人脸
  - `NO human portrait` — 禁止人像照片风格
  - `NO different face, NO changing face` — 禁止不同脸
  - `NO Asian face, NO Caucasian face` — 禁止特定人种
  - `NO human skin texture` — 禁止人类皮肤纹理
- **面部一致性强制**:
  - `SAME face across all angles` — 所有角度同一张脸
  - `IDENTICAL facial features in every shot` — 每张照片面部相同
  - `face locked to reference image` — 面部锁定到参考图
  - `NO different ethnicity, NO changing expression` — 人种/表情不变
- **面部特写增强**: `SAME face as reference` — 面部特写必须和参考图同一张脸

### 3. 虎齿特征（新增）
- `conical ivory-white fangs protruding beyond lips` — 犬齿极度发达，超出唇闭合线
- `massive canine teeth exposed` — 象牙白，圆锥形
- 基于面部科学解析手册2.2.4：牙齿外露度 — 极度外露，犬齿超长超出唇闭合线

### 4. 巨口特征（增强）
- `wide gape beyond cranial width` — 口裂极大，可张开至超越颅宽
- `ravenous expression` — 永远饥饿的表情
- 基于面部科学解析手册2.2.4：嘴部基本类型 — 宽裂型

### 5. 材质质感（保持科学级）
- `embedded osteoderm plates` — 嵌入式骨板（鳄鱼皮内成骨）
- `dark grey-black dermal bone armor` — 真皮骨装甲
- `surface covered with thin keratin layer` — 薄角质表层
- `rough lava-like texture with cooling cracks` — 冷却裂纹纹理
- `not ceramic not man-made` — 明确声明非陶瓷非人造

---

## 修复问题清单

1. ✅ 面部一致性 — 所有角度同一张脸
2. ✅ 真人照片感 — 禁止真人脸/人种/皮肤纹理
3. ✅ 虎齿特征 — 突出唇外的圆锥形象牙白犬齿
4. ✅ 巨口特征 — 占面部三分之二的巨口
5. ✅ 材质质感 — 科学级嵌入式骨板，非陶瓷
6. ✅ 颜色准确性 — dark grey-black，非蓝色
7. ✅ 科技风/机甲元素 — 全部禁止
8. ✅ 翅膀 — 已消除

---

## Prompt结构（v3.0最终版）

```
NO realistic human face, NO human portrait, NO different face, NO plastic, NO ceramic, NO tech, NO smooth surface, NO wings, pure white background, studio lighting, [角度描述], massive quadruped beast, sheep body, chimeric anthropoid face, monstrous visage, NOT realistic human portrait, thick skin texture, not human skin, dark charcoal grey-black body, embedded osteoderm plates, dark grey-black dermal bone armor, surface covered with thin keratin layer, rough lava-like texture with cooling cracks, cool to touch, hard as armor yet slightly flexible at joints, not ceramic not man-made, gigantic mouth, two-thirds of face, massive jaws, wide gape beyond cranial width, conical ivory-white fangs protruding beyond lips, massive canine teeth exposed, ravenous expression, thick lips, powerful jaw muscles bulging, always hungry, mouth always open, eyes under armpits, sulfur-yellow eyes, volcanic rock armor, natural armor covering body, SAME face across all angles, IDENTICAL facial features in every shot, face locked to reference image, national geographic wildlife photography, 8K texture, 2K
```

**Prompt长度**: 1271字符（在API限制内）

---

## 队长反馈

> "这一版ok。把此次升级的代码提交生产版本发布，固化成果"

---

## 系统级固化

- **文件**: `scripts/character-portrait-generator.js`（已更新）
- **面部科学解析手册**: `docs/shanhaijing-beast-facial-analysis.md`（已保存）
- **所有异兽受益**: 此升级适用于所有40只异兽的定妆照生成

---

*发布者: 小G*
*审核者: 李大鹏（队长）*
