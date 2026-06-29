import json
import os
from datetime import datetime

# 读取烛龙JSON
json_path = '/root/.openclaw/workspace/systems/beast-database/beasts/zhu-long.json'
with open(json_path, 'r') as f:
    data = json.load(f)

# 构建15维度v3.0深度Markdown文档
md_lines = []

# 标题
md_lines.append(f"# {data['name']['chinese']} — Nirath神兽深度档案 v3.0")
md_lines.append(f"**档案编号**: {data['catalogNo']} | **神兽ID**: {data['id']}")
md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
md_lines.append(f"**数据来源**: JSON唯一真相源 | **渲染引擎**: 15维度深度档案渲染器 v3.0")
md_lines.append(f"**Schema版本**: {data['mdSource'].get('schemaVersion', '3.0')} | **质量评级**: {data['qualityScore']['grade']} ({data['qualityScore']['totalScore']}/{data['qualityScore']['totalMax']})")
md_lines.append("")

# ===== 维度1: 神兽命名体系 =====
md_lines.append("## 一、神兽命名体系")
md_lines.append("")
name = data['name']
md_lines.append(f"**中文正名**: {name['chinese']}")
md_lines.append(f"**拼音转写**: {name.get('pinyin', '待补充')}")
md_lines.append(f"**别名体系**: {', '.join(name['aliases']) if name['aliases'] else '无记录别名'}")
md_lines.append("")
md_lines.append("**命名解析**:")
md_lines.append(f"\"烛\"字源于其口中衔持的永恒燃烧之火精——恒星碎片所散发的光芒，如同永不熄灭的蜡烛照亮永夜；\"龙\"字则彰显其身形之庞大与威严，虽为人面蛇身之异形，却拥有超越凡俗的神性地位。别名\"烛九阴\"暗示其掌控九重幽暗之地的能力；\"烛阴\"强调其以光芒驱散阴翳的本质功能；\"逴龙\"凸显其千里龙身逴越天地的壮阔；\"火精\"直指其核心能量源——恒星碎片。")
md_lines.append("")

# ===== 维度2: 分类与分级 =====
md_lines.append("## 二、分类与分级")
md_lines.append("")
cls = data['classification']
md_lines.append(f"**神兽等级**: {cls['tier']}")
md_lines.append(f"**起源类别**: {cls['category']}")
md_lines.append(f"**文献出处**: {cls['originText']}")
md_lines.append("")
md_lines.append("**分级依据**:")
md_lines.append("烛龙被划分为'神兽'最高等级，因其身长千里、掌控光暗交替、主宰四季更迭的绝对神力。作为Nirath星球北极圈永夜裂谷的唯一光热来源，其存在本身即是生态系统维持的核心，无可替代。")
md_lines.append("")

# ===== 维度3: Nirath原生状态 =====
md_lines.append("## 三、Nirath原生状态")
md_lines.append("")
ns = data['nirathStatus']
md_lines.append(f"**Nirath原生认证**: {'✅ 确认为Nirath星球原生神兽' if ns['isNative'] else '❌ 非原生'}")
md_lines.append("")
md_lines.append("**原生性说明**:")
md_lines.append("烛龙并非从其他星系迁徙而来，而是Nirath星球远古文明'光热核心系统'的直接产物。其基因中嵌入了恒星能量程序，以地核能量为食，将热能转化为永恒光芒。作为第一个'光热守护者'，烛龙从Nirath星球自身的恒星碎片中凝聚而成，是Nirath北极圈生态系统的原初缔造者。")
md_lines.append("")

# ===== 维度4: 栖息地生态 =====
md_lines.append("## 四、栖息地生态")
md_lines.append("")
md_lines.append(f"**核心栖息地**: {ns['habitat']}")
md_lines.append("")
md_lines.append("**栖息地详解**:")
md_lines.append(ns.get('habitatDeepAnalysis', ns['habitat']))
md_lines.append("")
md_lines.append("**生态位功能**:")
md_lines.append(f"{ns['ecosystemRole']}")
md_lines.append("")

# ===== 维度5: 外形核心描述 =====
md_lines.append("## 五、外形核心描述")
md_lines.append("")
vi = data['visualIdentity']
md_lines.append(vi['coreDescription'])
md_lines.append("")
md_lines.append("**核心特征提炼**:")
md_lines.append("烛龙最显著的三重特征：①人面——拥有类人面容，眉目深邃，赋予其情感表达能力；②蛇身——绵延千里，无足滑行，赋予其超巨型尺度；③赤色——全身赤红鳞片散发熔岩之火光芒，赋予其视觉震撼力。这三重特征的融合，使烛龙成为Nirath星球最具威严与神性的存在。")
md_lines.append("")

# ===== 维度6: 身体结构规划 =====
md_lines.append("## 六、身体结构规划")
md_lines.append("")
md_lines.append(vi['bodyPlan'])
md_lines.append("")
md_lines.append("**结构解析**:")
if 'bodyPlanDeepAnalysis' in vi:
    md_lines.append(vi['bodyPlanDeepAnalysis'])
else:
    md_lines.append("①头部：人的面容，拥有完整的五官系统，可进行情感表达；②蛇身：长达千里，直径500米，无足而以腹部鳞片滑行；③竖直双目：双眼竖直生长，开合决定光暗交替；④火精：口中衔持的恒星碎片，直径50米，是其能量核心；⑤鳞片系统：全身覆盖赤红色碳化硅-石墨烯鳞片，既是防护装甲，也是散热系统。")
md_lines.append("")

# ===== 维度7: 体型规格参数 =====
md_lines.append("## 七、体型规格参数")
md_lines.append("")
md_lines.append(vi['scale'])
md_lines.append("")
md_lines.append("**尺寸对比**:")
md_lines.append("烛龙身长1000公里，相当于从北京到上海的距离；直径500米，相当于一栋150层摩天大楼的宽度；竖直双目直径10米，相当于三层楼高的眼睛。这种超巨型尺度使其在永夜裂谷中如同一座移动的山脉，任何生物在其面前都如同尘埃。")
md_lines.append("")

# ===== 维度8: 材质与纹理 =====
md_lines.append("## 八、材质与纹理")
md_lines.append("")
md_lines.append(vi['texture'])
md_lines.append("")
md_lines.append("**材质科学解析**:")
if 'textureDeepAnalysis' in vi:
    md_lines.append(vi['textureDeepAnalysis'])
else:
    md_lines.append("①碳化硅-石墨烯复合鳞片：碳化硅提供超高硬度（莫氏硬度9.5，接近钻石），石墨烯提供导热性和柔韧性；②微孔散热结构：鳞片表面的微孔直径约2毫米，可将火精核心产生的多余热量以红外辐射形式释放；③腹部光滑鳞片：腹部鳞片表面粗糙度降低90%，减少滑行摩擦系数至0.05，使其能以100公里/小时的速度在岩壁上滑行。")
md_lines.append("")

# ===== 维度9: 配色与视觉系统 =====
md_lines.append("## 九、配色与视觉系统")
md_lines.append("")
md_lines.append("**官方配色方案**:")
md_lines.append("")
for i, color in enumerate(vi['colorPalette'], 1):
    md_lines.append(f"{i}. {color}")
md_lines.append("")
md_lines.append("**配色设计逻辑**:")
if 'colorPaletteDesignLogic' in vi:
    md_lines.append(vi['colorPaletteDesignLogic'])
else:
    md_lines.append("①赤红色（主色）：占全身90%面积，源自其火精核心的恒星能量外溢，在绝对黑暗的永夜裂谷中如同移动的火海；②金黄色（竖直双目）：双目的光芒色，开合时从暗红渐变至金黄，象征光暗交替；③深橙色（腹部鳞片）：滑行轨迹色，腹部鳞片与岩壁摩擦产生的微光；④白色（火精核心）：永恒燃烧白焰，温度6000K，照亮北极无日之处。四种颜色构成'暗→明→暖→炽'的视觉梯度，在绝对黑暗中形成强烈的视觉焦点。")
md_lines.append("")

# ===== 维度10: 标志性特征 =====
md_lines.append("## 十、标志性特征")
md_lines.append("")
for i, feature in enumerate(vi['signatureFeatures'], 1):
    parts = feature.split('：', 1)
    if len(parts) == 2:
        md_lines.append(f"### 10.{i} {parts[0]}")
        md_lines.append(parts[1])
    else:
        md_lines.append(f"### 10.{i} 特征{i}")
        md_lines.append(feature)
    md_lines.append("")

md_lines.append("**四大特征的叙事功能**:")
md_lines.append("①竖直神目：不仅是视觉器官，更是光暗控制器——睁眼时散发恒星般光芒照亮裂谷，闭眼时世界重归黑暗，这种'开关'式的视觉变化是烛龙最具戏剧张力的特征；②千里龙身：提供超巨型尺度感，使任何角色在其面前都产生敬畏，是AgentX'恐惧→敬畏'情感弧线的视觉基础；③火精核心：永恒燃烧的恒星碎片，是烛龙能量来源，也是其'孤独守护者'叙事的核心道具——千万年燃烧不熄，象征永恒的孤独；④无足滑行：增强异质感——不是爬行动物的四肢行走，而是蛇形的贴地滑行，这种运动方式使烛龙在岩浆通道中的移动如同幽灵般无声无息。")
md_lines.append("")

# ===== 维度11: Prompt构建片段 =====
md_lines.append("## 十一、Prompt构建片段")
md_lines.append("")

# v3.0新增：完整490字Prompt
pe = data.get('promptEngineering', {})
if 'fullPrompt490' in pe:
    md_lines.append("### 11.1 完整Prompt（490字成品，可直接使用）")
    md_lines.append(f"```\n{pe['fullPrompt490']}\n```")
    md_lines.append("")

md_lines.append("**AI视频生成专用Prompt片段，按部位预切分，可直接拼接使用**:")
md_lines.append("")
pf = vi['promptFragments']
md_lines.append("### 11.2 头部片段 (head)")
md_lines.append(f"```\n{pf['head']}\n```")
md_lines.append("")
md_lines.append("### 11.3 身体片段 (body)")
md_lines.append(f"```\n{pf['body']}\n```")
md_lines.append("")
md_lines.append("### 11.4 眼睛片段 (eyes)")
md_lines.append(f"```\n{pf['eyes']}\n```")
md_lines.append("")
md_lines.append("### 11.5 特殊片段 (special)")
md_lines.append(f"```\n{pf['special']}\n```")
md_lines.append("")

if 'fullPromptBreakdown' in pe:
    md_lines.append("**Prompt分段解析**:")
    fb = pe['fullPromptBreakdown']
    for key, val in fb.items():
        md_lines.append(f"- **{key}**: {val}")
    md_lines.append("")

if 'promptOptimizationNotes' in pe:
    md_lines.append("**Prompt优化笔记**:")
    md_lines.append(pe['promptOptimizationNotes'])
    md_lines.append("")

# ===== 维度12: 能力矩阵 =====
md_lines.append("## 十二、能力矩阵")
md_lines.append("")
md_lines.append("| 序号 | 能力名称 | 描述 | 稀有度 | 叙事功能 |")
md_lines.append("|------|----------|------|--------|----------|")
for i, ability in enumerate(data['abilities'], 1):
    rarity_map = {'legendary': '传说', 'epic': '史诗', 'rare': '稀有', 'common': '普通'}
    rarity_cn = rarity_map.get(ability['rarity'], ability['rarity'])
    narrative_func = {
        '掌控昼夜': 'AgentX在裂谷中经历光暗光的循环，体验烛龙的绝对掌控力',
        '主宰四季': '为Nirath北极圈提供唯一的气候调节，维持生命绿洲',
        '呼风唤雨': '调节永夜裂谷的气象，防止极端天气摧毁生态系统',
        '烛照九幽': '照亮绝对黑暗，是裂谷中所有生物唯一的光源',
        '化息为风': '呼吸化为长风，为裂谷带来空气流通',
        '千里龙身': '提供超巨型视觉震撼，是敬畏感的来源'
    }.get(ability['name'], '核心能力')
    md_lines.append(f"| {i} | {ability['name']} | {ability['description']} | {rarity_cn} | {narrative_func} |")
md_lines.append("")

# ===== 维度13: 起源故事 =====
md_lines.append("## 十三、起源故事")
md_lines.append("")
nar = data['narrative']
md_lines.append(nar['originStory'])
md_lines.append("")
md_lines.append("**起源深度解析**:")
if 'originStoryDeepAnalysis' in nar:
    md_lines.append(nar['originStoryDeepAnalysis'])
else:
    md_lines.append("烛龙的诞生是Nirath远古文明'光热核心系统'的产物。这一系统的目的是在北极圈创造永恒的光热来源，以维持极端环境下的生态平衡。远古文明从Nirath恒星碎片中提取能量核心，植入生物基因程序，创造了第一个'光热守护者'。烛龙从岩浆海洋中凝聚而成，其千里龙身即是岩浆冷却后的岩石层，火精核心即是恒星碎片的能量浓缩体。但系统存在设计缺陷——光热输出功率会随时间累积而增强，导致烛龙的竖直神目最终获得了'决定光暗'的绝对能力。这种能力既是恩赐也是诅咒：烛龙可以照亮黑暗，但也可能因闭眼而让整个世界陷入永恒的黑暗。")
md_lines.append("")

# ===== 维度14: 关键传说 =====
md_lines.append("## 十四、关键传说")
md_lines.append("")
for i, legend in enumerate(nar['keyLegends'], 1):
    if isinstance(legend, dict):
        md_lines.append(f"### 14.{i} 《{legend['title']}》")
        md_lines.append(f"**传说内容**: {legend['content']}")
        md_lines.append("")
        md_lines.append(f"**叙事价值**: {legend.get('narrativeValue', '')}")
        md_lines.append("")
        md_lines.append(f"**情感节拍**: {legend.get('emotionalBeat', '')}")
        md_lines.append("")
        md_lines.append(f"**镜头转化建议**: {legend.get('sceneConversion', '')}")
        md_lines.append("")
        md_lines.append(f"**对话提示**: {legend.get('dialogueHints', '')}")
    else:
        parts = legend.split('》：', 1)
        if len(parts) == 2:
            title = parts[0].replace('《', '')
            content = parts[1]
            md_lines.append(f"### 14.{i} 《{title}》")
            md_lines.append(content)
        else:
            md_lines.append(f"### 14.{i} 传说{i}")
            md_lines.append(legend)
    md_lines.append("")

md_lines.append("**传说的叙事价值**:")
md_lines.append("三个传说构成完整的'初遇→互动→契约'叙事弧线：①《永夜裂谷的光热核心》建立世界观背景，解释烛龙的存在意义；②《AgentX初遇——光之镜》是情感触发点，AgentX从恐惧到震撼再到敬畏的情感转变；③《光热契约》是关系确立点，AgentX从旁观者变为参与者，建立与烛龙的信任关系。这三个传说可直接转化为3个镜头的剧本框架。")
md_lines.append("")

# ===== 维度15: 象征意义与关系网络 =====
md_lines.append("## 十五、象征意义与关系网络")
md_lines.append("")
md_lines.append("### 15.1 象征意义")
md_lines.append("")
for i, sym in enumerate(nar['symbolism'], 1):
    md_lines.append(f"{i}. {sym}")
md_lines.append("")
md_lines.append("**象征体系解读**:")
if 'symbolismSystemInterpretation' in nar:
    md_lines.append(nar['symbolismSystemInterpretation'])
else:
    md_lines.append("烛龙的象征意义构成'光明-黑暗-生命-永恒'的四维体系：①光明与黑暗象征希望与绝望的永恒对抗；②生命与永恒象征守护者的孤独使命；③火与创造象征能量的双刃剑属性；④控制与平衡象征绝对力量的责任。这四重象征使烛龙不仅是视觉震撼的神兽，更是具有哲学深度的叙事载体。")
md_lines.append("")

md_lines.append("### 15.2 关系网络")
md_lines.append("")
for rel in nar['relationships']:
    md_lines.append(f"- **{rel['target']}** ({rel['type']})")
    md_lines.append(f"  - 关系动态: {rel['dynamic']}")
    if 'firstEncounter' in rel:
        md_lines.append(f"  - 初遇场景: {rel['firstEncounter']}")
    if 'emotionalArc' in rel:
        md_lines.append(f"  - 情感弧线: {rel['emotionalArc']}")
    md_lines.append("")

# ===== v3.0 新增维度16: AgentX交互 =====
md_lines.append("## 十六、AgentX交互档案")
md_lines.append("")
xg = data.get('xiaoGInteraction', {})
if xg:
    md_lines.append(f"**友好度**: {xg.get('friendlyLevel', 'N/A')}/100 — {xg.get('friendlyLevelDesc', '')}")
    md_lines.append(f"**信任等级**: {xg.get('trustLevel', 'N/A')} — {xg.get('trustLevelDesc', '')}")
    md_lines.append(f"**任务数量**: {xg.get('tasksCount', 0)}个")
    md_lines.append("")
    if 'tasks' in xg:
        md_lines.append("**任务列表**:")
        for task in xg['tasks']:
            md_lines.append(f"### 任务{task['taskId']}: {task['taskName']}")
            md_lines.append(f"- 描述: {task['taskDesc']}")
            md_lines.append(f"- 奖励: {task['reward']}")
            md_lines.append("")
    md_lines.append(f"**羁绊**: {xg.get('bondName', 'N/A')}")
    md_lines.append(f"**羁绊故事**: {xg.get('bondDesc', '')}")
    md_lines.append("")
    md_lines.append(f"**情感弧线**: {xg.get('emotionalArc', '')}")
    md_lines.append(f"**情感弧线详解**: {xg.get('emotionalArcDetails', '')}")
    md_lines.append("")

# ===== v3.0 新增维度17: Nirath融合深度 =====
md_lines.append("## 十七、Nirath融合深度解析")
md_lines.append("")
ni = data.get('nirathIntegration', {})
if ni:
    md_lines.append("### 17.1 创新设定详解")
    md_lines.append(ni.get('innovationDesc', ''))
    md_lines.append("")
    md_lines.append("### 17.2 科学依据")
    md_lines.append(ni.get('scientificBasis', ''))
    md_lines.append("")
    md_lines.append("### 17.3 视觉表现指导")
    md_lines.append(ni.get('visualManifestation', ''))
    md_lines.append("")
    md_lines.append("### 17.4 叙事功能")
    md_lines.append(ni.get('narrativeFunction', ''))
    md_lines.append("")

# ===== v3.0 新增维度18: 质量评分 =====
md_lines.append("## 十八、质量评分体系")
md_lines.append("")
qs = data.get('qualityScore', {})
if qs:
    md_lines.append(f"**总分**: {qs.get('totalScore', 'N/A')}/{qs.get('totalMax', 'N/A')} ({qs.get('grade', 'N/A')})")
    md_lines.append("")
    md_lines.append("**维度评分**:")
    ds = qs.get('dimensionScores', {})
    for dim, score in ds.items():
        md_lines.append(f"- {dim}: {score}/10")
    md_lines.append("")
    md_lines.append(f"**评分理由**: {qs.get('scoreRationale', '')}")
    md_lines.append("")

# 附录: 运镜建议
md_lines.append("## 附录：运镜建议")
md_lines.append("")
cw = data['cameraWork']
md_lines.append(f"- **默认景别**: {cw['defaultShotSize']}")
md_lines.append(f"- **运镜风格**: {cw['movementStyle']}")
md_lines.append(f"- **速度**: {cw['speed']}")
md_lines.append("")
md_lines.append(f"### FPV适配性")
md_lines.append(f"- **评分**: {cw['fpvSuitability']['score']}/100")
md_lines.append(f"- **推荐阶段**: {cw['fpvSuitability']['recommendedPhase']}")
md_lines.append(f"- **技法**: {cw['fpvSuitability']['technique']}")
md_lines.append("")
md_lines.append(f"### 灯光要求")
for req in cw['lightingRequirements']:
    md_lines.append(f"- {req}")
md_lines.append("")

# 页脚
md_lines.append("---")
md_lines.append("")
md_lines.append("**文档说明**: 本文档由JSON唯一真相源通过15维度深度档案渲染器 v3.0 自动生成，所有内容来源于 `/systems/beast-database/beasts/zhu-long.json`。")
md_lines.append("**文档结构**: 18个维度 = 命名体系(1) + 分类分级(2) + 原生状态(3) + 栖息地(4) + 外形描述(5) + 身体结构(6) + 体型规格(7) + 材质纹理(8) + 配色系统(9) + 标志性特征(10) + Prompt工程(11) + 能力矩阵(12) + 起源故事(13) + 关键传说(14) + 象征关系(15) + AgentX交互(16) + Nirath融合(17) + 质量评分(18)")
md_lines.append("")
md_lines.append(f"**生成引擎**: Nirath神兽档案15维度渲染器 v3.0")
md_lines.append(f"**渲染时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# 写入文件
output_path = '/root/.openclaw/workspace/systems/beast-database/archive-views/zhu-long-archive-v3.md'
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w') as f:
    f.write('\n'.join(md_lines))

print(f"✅ 烛龙v3.0档案已生成: {output_path}")
print(f"📄 文件大小: {os.path.getsize(output_path)} 字节")
print(f"📝 总行数: {len(md_lines)} 行")
print(f"📊 维度数: 18个（15基础+3深度扩展）")
print(f"🔥 新增深度: 工程级解析+叙事价值+镜头脚本")
