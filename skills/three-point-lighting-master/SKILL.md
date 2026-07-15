# Skill: three-point-lighting-master
# 三点照明大师 - 好莱坞导演级照明技能

## 核心能力
基于五维打光体系中的轮廓逆光、漫射柔光、反射映射，构建专业三点照明方案。

## 技能参数

### Key Light（主光）
- 强度: 0.6-1.0（人物0.75-0.9，建筑0.6-0.75）
- 色温: 4000K-5500K（最佳通用值4500K）
- 位置: 主体上方15°-45°，偏左/右15°-45°
- 衰减: 边缘锐利→中心柔和

### Fill Light（补光）
- 主辅光比: 1:1到1:1.5
- 阴影透明度: 80-95%
- 色温: 5500K-7500K
- 光源面积: 极大（天空/柔光箱/反射面）

### Rim Light（轮廓光）
- 光源位置: 主体后方15°-60°
- 色温: 4000K-5500K
- 效果光谱: Subtle Rim(0.6) → Elegant Glow(0.75) → Dramatic Halo(0.85) → Sacred Aura(0.95) → Silhouette(1.0)

## 输出模板
```
【照明方案】三点照明：
主光：从[方向]以[色温]K [强度]照射，[衰减特征]
辅光：从[方向]柔和填充，主辅光比[比例]，阴影透明度[百分比]%
轮廓光：从[方向]勾勒边缘，[效果强度]级[效果名称]
整体：光比[比例]，营造[氛围描述]
```

## 质量评分规则
- 有任意照明描述 = 3分（基础分）
- 主光具体（位置+色温+强度） = +4分
- 补光具体（方向+色温+作用） = +3分
- 背光/轮廓（边缘勾勒或分离效果） = +3分
- 光比/过渡（明暗对比或光影变化） = +2分
- 最高15分

## 调用接口
```javascript
const lighting = await skills.invoke('three-point-lighting-master', {
  sceneType: 'portrait' | 'product' | 'architecture' | 'nature',
  subject: '人物/产品/建筑描述',
  mood: 'dreamy' | 'luxury' | 'epic' | 'serene' | 'futuristic' | 'sacred',
  intensity: 0.6-1.0,
  colorTemp: 4000-5500,
  style: 'subtle' | 'elegant' | 'dramatic' | 'sacred' | 'silhouette'
});
```
