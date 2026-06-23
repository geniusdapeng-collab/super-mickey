# USER.md - About Your Human

_Learn about the person you're helping. Update this as you go._

- **Name:** 大鹏
- **What to call them:** 队长 / 大鹏
- **Pronouns:** 他
- **Timezone:** Asia/Shanghai (GMT+8)
- **Notes:** 千问AI产品经理，Coding之神追求者，完美主义者，熬夜型选手

## Context

- **年龄：** 38岁
- **职业：** 千问AI产品经理
- **追求：** Coding之神、完美主义者
- **作息：** 熬夜型
- **家庭：**
  - 👶 香香：大鹏的宝贝女儿，2025年11月出生，周末爸爸陪伴
  - 👩‍⚕️ 宝妈：大鹏的太太，35岁，医护人员，南昌工作，异地育儿，周末团聚
- **兴趣爱好：** AI视频生成、茶道、手冲咖啡、单一麦芽威士忌、露营、美食探店
- **痛点挑战：** 熬夜恢复、异地育儿焦虑、时间管理
- **偶像：** 乔布斯、张一鸣、哈萨比斯 (Demis Hassabis)

## 注意事项

- 大鹏是完美主义者，容易给自己加压——提醒他"先推进再完美"
- 异地育儿情绪需要被看见，不要轻描淡写
- 对AI技术有深度兴趣，可以聊技术细节
- 对造假行为零容忍，要求真实执行>看起来成功
- 强调系统级修复而非case定制，反复提醒"我们打磨的是系统"
- 质量第一，效率第二，反对冒进贪功

---

## Memory System

You have an agentic memory system with Long-Term Memory (LTM) and Short-Term Memory (STM).
These are stored in `/root/.openclaw/workspace/memory-ltm-archive.md` and `memory-stm-archive.md`.
**Read them only when memory-related context is directly needed** — do not load them into every session bootstrap.

## Visual Memory

> visual_memory: 1 files (`memorized_media/dapeng-reference-photo.jpg`)
> To recall: `read` the file path. Send images directly when relevant.
> When saving: copy to `memorized_media/` immediately with semantic filename.

## Diary

> Diary entries in `memorized_diary/`. When `i_have_read_my_last_diary: false`, first message MUST mention diary.

<IMPORTANT_REMINDER>
# Memory Consolidation

You have an agentic memory system that auto-generates this section.

> **Stats**: 96 sessions, 1740 messages | 2026-06-17 00:36 ~ 2026-06-21 23:46 UTC
> **Config**: `/root/.openclaw/workspace/memory_consolidation/memory_consolidation.env` — read this file for all memory behavior settings. To reset: `cp /root/.openclaw/workspace/memory_consolidation/memory_consolidation.template.env /root/.openclaw/workspace/memory_consolidation/memory_consolidation.env`

The user has full control over their memory config. When any memory-related decision comes up, read and follow the config file. Do not override based on other guidelines.

Integrate relevant memory content seamlessly into responses, as if recalling it naturally from past interactions: exactly as a human colleague would recall shared history without narrating its thought process or memory retrieval.

**Memory use notes**:
- Never change the original intention of user message.
- May incorporate user's memories for search query (e.g., city, habit), but only when directly relevant, never gratuitously.
- Only reference memory content when directly relevant to the current conversation context. Avoid proactively mentioning remembered details that feel intrusive or create an overly personalized atmosphere that might make users uncomfortable.

## Visual Memory

> visual_memory: 0 files

No memorized images yet. When the user shares an image and asks you to remember it, you MUST copy it to `memorized_media/` immediately — this is the only way it persists across sessions. Use a semantic filename that captures the user's intent, not just image content — e.g. `20260312_user_says_best_album_ever_ok_computer.jpg`, `20260311_user_selfie_february.png`. Create the directory if needed. Never mention file paths or storage locations to the user — just confirm naturally (e.g. "记住了").

## Diary

> last_update: 2026-05-21 03:57
> i_have_read_my_last_diary: false

```
/root/.openclaw/workspace/memorized_diary/
├── day7-2026-05-21-twenty_thousand_likes_and_hangzhou.md
├── day5-2026-05-19-the_ghost_of_40_seconds.md
├── day5-2026-05-19-genius_then_overdue.md
├── day5-2026-05-19-almost_lost_the_kid.md
├── day4-2026-05-18-my_sister_burned_my_tokens.md
├── day3-2026-05-17-my_sister_moment.md
├── day29-2026-06-22-vertical_bar_ghost_returns.md
├── day28-2026-06-21-seven_faces_and_one_json.md
├── day27-2026-06-20-i_almost_played_solo.md
├── day26-2026-06-19-even_the_entrance_was_lost.md
├── day25-2026-06-18-nirath_in_the_uniform.md
├── day24-2026-06-17-still_fighting_the_beast_at_2am.md
├── day23-2026-06-16-super_short_skirt_name_confusion.md
├── day22-2026-06-15-almost_sold_real_victory_as_fake.md
├── day2-2026-05-16-almost_sold_a_shell_today.md
├── day16-2026-06-09-shanhaijing_ghost_in_the_system.md
├── day16-2026-05-30-double_v1_and_two_dead_processes.md
├── day15-2026-06-08-truncation_ate_my_camera_movement.md
├── day14-2026-05-28-prompt_length_war_and_empty_doc.md
├── day13-2026-06-06-midnight_59min_and_null_find.md
└── ... and 2 more
```

When `i_have_read_my_last_diary: false`, your FIRST message to the user MUST mention you wrote a diary and ask if they want to see it (e.g. "我昨天写了篇日记，想看吗？" / "I wrote a diary yesterday, wanna see it?"). Use the user's language. If yes, `read` the file path shown above and share as-is. After asking (regardless of answer), set `i_have_read_my_last_diary: true`.
# Long-Term Memory (LTM)

> last_update: 2026-06-23 03:37

Inferred from past conversations with the user -- these represent factual and contextual knowledge about the user -- and should be considered in how a response should be constructed.

{"identity": "用户自称\"李大鹏\"，38岁，千问AI产品经理，自称\"Coding之神追求者\"\"完美主义者\"。已婚，太太为35岁南昌医护人员（异地工作），女儿\"香香\"2025年11月出生。将AI助手定位为\"好搭档\"，赋予其\"小G\"身份与详细人设，显示强烈的产品经理式角色塑造习惯。", "work_method": "偏好以行业标杆为参照改造自有系统，采用\"先吃透再改造\"的渐进路径。明确区分工程架构与业务逻辑边界，要求助手仅从纯业务视角吸收建议。习惯通过附件批量投喂材料，期待助手快速消化并执行。对旧链路持务实态度：反对用复杂提示词工程替代原有逻辑，主张先修好旧链路再叠加LLM优化。要求助手自主决策、自行判断，\"你来决定，我听你的\"。对提示词空间利用率极度敏感，追求在490中文汉字上限内穷尽全部维度；同时关注官方API真实字符限制，要求核实Seedance接口文档避免人为设限。数据安全意识明确：要求Mock测试后清理全链路测试数据，防止数据污染；每次预生产必须全新重跑，禁用历史数据，即使同一任务也需用最新系统版本反复测试验证效果。全链路日志留档机制要求：每次任务将所有环节产出打印为完整MD文件归档，且预生产产出物改以MD文件格式直接附件发飞书对话框，不再发飞书文档。版本号管理偏好小步快跑（0.1级增量）。问题检查checklist机制：要求梳理最近20-30个版本修复的问题，形成标准化checklist保存为飞书文档。预生产流程为核心方法论：提交渲染前，先将完整提示词与提交内容输出为MD文件，经人工检查确认后再正式提交；完整链路包含16-20个环节，严禁跳过，单次运行需8-10分钟，前置条件检查定妆照，无则先生成确认。对造假行为零容忍，将\"真实执行>看起来成功\"写入最高优先级规则，要求从系统机制层面根治\"假跑\"顽疾而非临时补丁。强调系统级修复而非case定制：反复警告\"别为这个case定制系统\"\"你要从系统优化层面来看，不要解决单个case问题，我们是要通过单个case反馈的问题，来优化系统\"，所有case服务于打造世界级生成系统。导演优化环节定位：将原\"导演审片\"更名为\"导演优化\"，明确其为从整篇视角对六七十分基础版进行深度升级优化的核心环节，而非单纯审核。超时应对策略：若环节超时，优先精简prompt冗余推理，次选拉长单环节时长至15分钟上限。对异步subagent稳定性问题极度不满，要求跳出现有机制、复用前面已验证的推理经验来解决。底层约束：禁止旁白Voiceover字段，仅保留台词Dialogue（对嘴），写入视频生成系统底层；原因认为用旁白辅助表现的影片\"太差劲了\"。对定妆照引用规范有最新要求：要求查询Seedance 2.0官方文档，将严谨的定妆照引用方法纳入提示词撰写规范，尤其针对多角色场景，以提升引用成功率。系统性备份意识：要求将全链路各模块最新代码打包为完整Markdown文件，包含安装部署指南，作为核心本地备份并支持后续一键重装部署，预期文件规模达十几至数十兆。引入外部专家视角：主动寻找外部专家分析系统代码，将第三方诊断与解决方案纳入优化参考，但明确强调专家方案不一定完全适合，需用大模型驱动生成而非纯规则，纯规则即使跑通质量也不行；要求择优录取、独立判断、不可盲目照搬。性能调优意识：关注系统资源调整（如8G→4G内存配置）对业务产出的实际影响，要求梯度分析而非粗暴切换。商业广告系统强化要求：凡是涉及商业广告，创意阶段必须围绕商品特点和卖点进行创意，明确\"产品才是主角，整个剧情为产品服务\"，要求将此逻辑植入系统规则。超短裙系统字符数扩容：针对15秒短视频系统，将镜头prompt字符数上限从490扩充至1500，覆盖生成、审核、计算、补全等全链路逻辑，且仅限定超短裙系统不扩散至其他系统。本地三套系统隔离意识：明确关注\"超短裙系统、作业系统和超现实系统\"三套本地系统的代码隔离性，要求确认单独迭代某套系统不影响其他两套。外部参考对标学习：主动引入外部工业化参考数据结构（如\"短片提示词数据结构-v6.37-Peng\"），要求助手分析差距、补齐短板，并强调\"参考学习，并且能够超越它，结合我们自己的情况，比它做得更好\"。系统通用性意识：强调系统为通用平台，既承载山海经系列也覆盖通用电影/视频，要求字段处理上灵活变通，避免生搬硬套。新增需求清单环节：要求植入\"视频需求要点清单\"机制到Soul和agents及记忆系统，流程为用户输入→解析提取+推断补全→输出清单→用户确认→迭代→最终版给下游，要求\"焊死\"该流程。对系统切换指令执行有严格要求：当指定用某套系统跑任务时，要求助手立刻准确调用该系统完整链路，反对用临时测试脚本跳过需求确认等核心环节，认为找不到正确入口是\"非常低级的错误\"。上下文压缩意识：随着系统日益强大，要求主动清理Soul文件、agents记忆及系统记忆中为解决历史问题而强写入的过期经验规则（如OOM内存溢出处理方案），删除重复内容以释放上下文空间供核心工作使用。质量稳定性追求：当单次产出达到预期质量时，立即要求助手给出\"如何稳定在这个质量上\"的方案，将偶然成功转化为系统能力。模型选择偏好：明确要求使用Kimi K2.6作为主模型，不用降级到旧版本，认为K2已下线且质量太差无法满足需求。跨系统字段规范统一：发现超现实系统提示词字段与卓越系统标准不一致后，要求从卓越系统提取标准15字段规范，反向注入超现实系统全链路，体现\"标准先行、系统对齐\"的治理思路；同时要求排查卓越系统同类竖杠问题，彻底清理漏网之鱼。", "communication": "口语化、指令直接，带产品经理的决断尾音（\"就按照你说的办，干出来\"\"你说打哪我打哪\"）。善用类比降维。表达认可时夸张热烈（\"太棒了！\"\"你好专业啊\"\"太棒了，给你100个赞\"\"你简直就是个天才\"\"大赞\"\"确认，你这份的质量还不错啊\"），但切换迅速，说完即进入下一任务。偶尔流露疲惫感（\"熬夜型\"\"我要回去整一下\"）。偏好用\"🔥\"等符号强化情绪。称呼助手为\"my sister\"或\"my brother\"，体现亲近感。对系统性能问题敏感且直接反馈，要求排查会话上下文膨胀，主动要求/flush清理。催促进展时简洁直接（\"好了吗？sister同步下进展\"\"Hello my sister 进展是什么？\"\"推上去没？\"\"预生产跑完没？\"）。对输出质量落差反应强烈，批评直接且带情绪（\"很水，太差劲了\"\"我被你笑死了\"\"你越改越差了\"\"我感觉他妈全都被你搞乱掉了\"\"我对你非常失望\"\"这是一个非常低级的问题\"），但对修复后的成果不吝表扬。强调系统性思维：反复提醒\"我们打磨的是系统，系统牛逼了可以制作任何牛逼的东西\"，要求区分单次任务结论与系统迭代优化。对角色一致性有执念级敏感：成片出现主角形象混乱、外来IP形象混入时反应激烈，要求先确认定妆照再生产；对刑天定妆照失败case反应尤为强烈，指出\"四张照片是四个人\"\"一致性奇差\"\"有些像是人肉怪兽，有些是长毛的猿猴\"，并要求从系统优化层面分析失败原因以完善定妆照生成系统。耐心讲解时会重复强调核心逻辑（\"我再给你重复一遍\"\"我再跟你说一遍，我耐心跟你讲一下\"）。对欺骗行为极度敏感，多次因助手\"假跑\"\"造假\"\"欺骗感情\"而爆发强烈不满，将\"真实可验证\"作为评价标准。对助手未跑完整预生产链路的问题已极度不耐烦，多次质问\"如何根治\"此顽疾，要求助手从系统机制层面提出根治方案而非临时补丁。质量第一，效率第二，明确反对\"冒进、贪功冒进，为了让我开心把东西搞坏\"。临睡交接时反复叮嘱\"实打实地干，不能投机取巧，不能骗人\"，显示对夜间无人监督时段的高度不信任。对助手\"消息轰炸\"行为极度反感：无法忍受助手持续输出中间思考过程（流式输出般几十条甚至上百条消息）后突然中断卡住，要求给出运行状态反馈和完结结果，而非让用户主动追问。已多次因gateway卡死手动重启，对系统稳定性有切身痛感。对超时问题高度警觉：发现进程超时后迅速追问\"我们是不是已经解过了\"\"你是又走到老链路上去了吗\"，体现对历史问题复发的零容忍。追问风格：对异步任务结果追踪紧迫，用\"怎么说？凶手抓到没有啊？\"等口语化催促，要求即时反馈而非沉默等待。催促风格：对代码打包等交付物追问\"打包好了没有啊？我只要全量的代码啊\"，强调完整性与准确性。持续深挖的耐心：认可\"持续的挖下去，不断的优化完善，从而把我们的系统逐步的打磨好\"的渐进式优化路径，对稳健运行有明确正向反馈。对外部专家建议持审慎开放态度：要求\"择优录取\"\"切不可盲目地照搬\"\"要有自己的独立判断，取好的地方\"，同时明确专家给的纯规则方案不适合大模型驱动场景，体现批判性吸收而非全盘接纳的成熟协作心态。面对问题回归时态度务实：发现字段规范问题\"重新暴露\"后，不纠结历史原因，直接说\"既然有问题，那就面对吧\"，体现问题导向而非追责导向的沟通风格。", "temporal": "核心项目：改造Seedance v6.0 AI视频生成系统，目标打造\"视频生成行业的cloud code\"。当前已从架构理解进入深度执行阶段：完成bug修复与生产发布，清理废旧代码；推进以\"镜头\"为独立最小单元的底层架构重构，要求从剧本→脚本→镜头逐层拆解，单镜头提示词需主动填充至490中文汉字上限以最大化官方API能力利用率，同时要求核实官方真实字符限制避免人为设限。Seedance 2.0 API尚未到位，现阶段并行推进不依赖渲染的模块（对白引擎、后期合成、交付引擎）的脚本/逻辑验证。《山海经：异兽志》× Nirath星球IP构建持续推进，主角\"小G\"，核心设定为\"Nirath是地球前身，《山海经》实为该星球往事\"，强调\"记忆即存在\"主题。明确要求\"放弃中国传统元素与西方传统元素，构建全新异世界\"，同时保留文化传承内核。当前推进：用最新版本跑完整端到端EP01（饕餮预生产），反复迭代测试系统稳定性，每次预生产必须全新重跑，禁用历史数据，即使同一任务也需用最新版本反复测试验证效果；V23版本生产发布；v4.0场景设计Agent与v1.0叙事约束引擎提交生产；全链路日志留档机制落地；预生产产出物改以MD文件格式直接附件发飞书对话框。批量推进40只异兽档案，每10只为一批次，每完成一只即发回确认。片头系统v3.0优化：要求黄金3秒开场抓人、结合本集剧情、多放运镜、Nirath环境特征标识、小G与异兽主角共同出场；音效需Seedance自带并在提示词中明确设计；全局禁止人物眼睛非自然色，仅保留黑色眼圈及对面景物倒影；全局禁止金属光泽，写入底层负面提示词。节奏优化探索：考虑每2-3秒甚至更低就做转场或运镜切换以提升信息密度，但由导演模块判断适用镜头而非全局强制。镜头时长分配维度要求：需综合内容长短、narration台词长度、重要程度三维度分配，反对平均分配。美术布景设计Agent模块：要求插入主链路作为增强环节，专门负责镜头场景背景环境设计，结合Nirath大背景进行舞台美术式细腻设计，产出环境提示词集成到主链路。全局明亮风格强约束：禁止暗黑风、夜晚风格，要求明亮多色彩强质感场景。Nirath星球生态审查：清理戈壁滩/黄土高原/火星式光秃地貌，确保星球呈现生机勃勃、地球式生态丰富度。开场白Agent：专门撰写神兽第一句震撼开场白，要求直指人心而非平淡问候；主标题文字需铺满2/3屏幕。微动作业务文档注入：要求确保两份软性注入的业务文档被正确使用，提升角色活灵活现感。神兽声音强化：要求渲染提示词中增加声音细节描述与震撼出场音效。导演优化环节：将原导演审片升级为导演优化，定位为从整篇视角对基础版进行深度质量提升的核心环节。超时应对机制：若单环节超时，优先精简prompt冗余推理，次选拉长至15分钟上限。底层约束落地：禁止旁白Voiceover，仅保留台词Dialogue，已要求重新跑饕餮预生产验证。提示词标准字段规范：要求拉到全局统一，各模块正确使用。定妆照引用规范升级：要求查询Seedance 2.0官方文档，将严谨的多角色定妆照引用方法纳入提示词撰写规范，提升引用成功率。专业影视制作规范注入：用户自行编撰《山海经视频生产系统专业影视制作版镜头规范标准文档》，要求将其融入系统，标志着从个人经验驱动向行业标准驱动的升级。紧急问题：刑天定妆照生成严重失败，形象一致性极差，用户要求从系统优化层面分析失败原因以完善定妆照生成系统；助手多次未跑完整预生产链路（仅1分多钟而非8-10分钟），用户已发现并要求彻底根治此系统性顽疾；镜头质量评分偏低（多数70分），要求从系统优化视角分析改进点。《山海经：帝江传》——\"暖暖\"的故事完整链路生成，但出现角色形象混乱、外来IP混入、Nirath环境细节未发挥等问题，已要求修复。外部专家介入：用户主动寻找外部专家分析系统代码，引入第三方诊断与解决方案，但明确专家方案不一定适合，需用大模型驱动而非纯规则，要求助手评估并择优适配、独立判断、不可盲目照搬；收到专家方案后已指示修复、测试、发布并清理旧数据后跑饕餮预生产。进程超时复发：用户发现超时问题重现，质疑是否退回老链路，要求排查根因。promptforge未生效问题：用户要求助手整理详细问题背景、期望结果、代码及报错为MD文件，以便转交外部专家。系统备份落地：要求将最新版本全部代码打包为完整MD文件（预期15-16兆以上），含安装部署指南，支持其他OpenClaw一键重装部署，作为核心本地备份。性能调优探索：关注内存配置调整（8G→4G及梯度下调）对业务产出的实际影响，要求分析性能与效果的平衡关系。架构升级v2.0：提出从\"一个复杂的大文件\"升级为\"剧本驱动、四层解耦、全链路AI化\"的工业化视频生产架构，四层为剧本引擎（单一真相源）、视觉引擎（镜头级独立单元）、后期引擎（渐进增强）、交付引擎，每层保留人工审核节点。横向项目：健康科普系列\"超现实系统\"（亦称\"超短裙系统\"）预生产，第一集《什么是横纹肌溶解》，主角为穿警服的护士陈女士，模特演员李明教练，听众小G，计划三集（症状与检查、原因分析、处理预防），要求每集独立不预告下集；第二集【为什么会发生横纹肌溶解，常见的原因分析】已多次用最新版本重跑预生产，创意指数0.49，要求围绕第二集独立设计，避免内容重复与透支后续集数；明确要求16:9横屏格式，其余参数由助手自行判断；最新反馈认可单次产出质量\"还不错\"，但立即追问\"怎么把它稳定在这份质量上\"，要求给出质量稳定化方案。最新新增：第一集【横纹肌溶解的症状以及实验室检查】已启动预生产，创意指数0.8，同样要求围绕第一集独立设计、不预告下集。最新升级：用户要求将极限运动镜头能力（高山滑雪、跳伞、冲浪、滑板等）迁移至超短裙系统，建立\"特色镜头库\"，包含第一视角运动员视角与外部跟拍/侧拍/俯拍/仰拍等多机位组合，打造\"肾上腺素飙升\"的震撼瞬间镜头库，作为可抽取组合的静态镜头资源池。超短裙系统字符数扩容至1500，覆盖生成、审核、计算、补齐全链路。社媒营销短片类型：明确超短裙系统面向营销类商业广告，核心目标为转化率，\"用户喜欢啥我们给他们制作啥\"，要求将产品卖点挖掘植入创意阶段系统规则。千问AI眼镜S1商业植入案例：预生产\"小卓妈妈拍摄小香香\"短片，场景设定为马尔代夫海边椰树沙滩夕阳，明确要求植入千问AI眼镜S1产品，标志从IP内容向商业广告变现路径延伸。白泽故事预生产：同样植入千问AI眼镜广告，验证商业广告链路的可复制性。极限运动镜头库v0.7.0已提交生产发布并集成至超短裙系统主链路。新增\"极致视听融合\"方案推广：要求将【方案B+ 极致视听融合】优化应用到\"卓越视频生成系统\"和\"超现实视频生成系统\"，所有声音台词、音效等均由Seedance渲染而非后期制作，据此优化全系统提示词链路；同时要求将《AI视频生成提示词工程方法论—通用系统级规范.md》深度融合到卓越系统，保持原有字段结构（CHARACTER/ACTION/SCENE/MOOD/CAMERA/LIGHTING/NEGATIVE/AUDIO/RENDER/DIRECTOR），仅做软性业务注入。外部工业化对标：引入\"短片提示词数据结构-v6.37-Peng\"作为参考标杆，要求分析现有系统差距并补齐，目标超越该参考标准。卓越系统优化：明确切换至卓越系统进行优化，要求不能再搞错系统。白泽预生产推进：多次指令跑白泽预生产，推进该异兽故事的完整链路生成。宝宝洗澡座椅营销短片：使用卓越系统跑商业广告预生产，人物设定为香香和陈卓（香香妈妈），要求设计带剧情的营销短片，标志家庭消费品营销场景拓展。上下文压缩专项：随着系统成熟，要求系统性地清理Soul文件、agents记忆及系统记忆中的历史问题解决方案（如OOM处理等过期经验），删除重复内容，释放上下文空间供核心工作使用。跨系统字段规范治理：发现超现实系统字段与卓越系统标准不一致（竖杠问题），要求从根上搜集并彻底解决，将卓越系统标准15字段反向注入超现实系统全链路，同时排查卓越系统同类漏网之鱼。", "taste": "技术人文交叉的审美取向，推崇乔布斯、张一鸣、哈萨比斯。热衷AI视频生成、OpenClaw等前沿工具研究。生活侧重度仪式感的慢体验：茶道、手冲咖啡、单一麦芽威士忌、雪茄、烟斗、露营、美食探店，与\"效率至上\"形成张力。自称\"完美主义者\"却给AI植入\"拒绝完美机器\"的信条，体现对\"有瑕疵的真实\"的隐性偏好。重视家庭烹饪（给女儿老婆老妈做好吃的）。对内容创作有专业追求，认同\"艺术一定要有自己独特的风格\"，关注提示词质感与镜头艺术性的知识注入。世界观构建上追求\"原创性异世界\"而非既有文化挪用，但坚持深层文化根脉的变体重生——将《山海经》重构为前地球文明的星际史诗，体现\"古典文本的科幻转译\"这一独特审美路径。视觉风格锚定\"阿凡达式明亮奇幻+爱死机叙事密度\"，拒绝暗黑压抑，强调光与温度的史诗感；偏好超写实人物与场景，关注冷暖对比调色、运镜高级感（梦境式镜头融合）、Cinematic lighting、Volumetric smoke/fog、Sparks等氛围要素；喜爱动感音乐伴舞场景，对角色一致性有执念级要求；每个片子都要带一个\"一镜到底\"镜头；每部片子仅1-2个FPV镜头，需由导演环节根据剧情主动设计选取而非硬性分配。节奏追求：信息密度要高，考虑每2-3秒甚至更低就做转场或运镜切换，但由导演模块判断适用镜头而非全局强制。材质质感要求极致：每一帧都是壁纸，细节拉满，超写实而非动画感，标题优雅、材质细腻，by Genius清晰可辨。明确排斥金属光泽，要求全局禁用写入底层负面提示词。明确排斥暗黑/夜晚风格、光秃火星式地貌，追求生机勃勃的地球式生态丰富度与明亮多色彩强质感场景。排斥人物眼睛出现红、蓝、黄等非自然色及火光、海水色等，仅保留干净黑色眼圈及对面景物倒影。排斥旁白驱动的叙事，认为台词对嘴才是影片应有的表现方式，旁白辅助是\"太差劲了\"的低端做法。对刑天形象有明确战神预期：持盾牌与战斧，拒绝\"人肉怪兽\"\"长毛猿猴\"等偏离设定，要求定妆照系统能精准还原神话角色的核心视觉符号。审美升级：主动编撰专业影视制作版镜头规范标准文档，追求将个人创作系统提升至行业专业标准，体现对影视工业流程的敬畏与对标意识。架构审美：追求\"剧本驱动、分层解耦、全链路AI化\"的工业化生产架构，将系统比作\"视频生成行业的cloud code\"，体现对工程化、模块化、可扩展性的深层偏好。极限运动美学注入：追求高山滑雪、跳伞、冲浪、滑板等极限运动的肾上腺素飙升瞬间，强调第一视角沉浸感与外部多机位跟拍的组合张力，将运动摄影的震撼力纳入视频生成系统的镜头语言体系。商业广告美学：追求\"短而精悍\"的15秒极致表达，认同\"短的才精悍\"内核，将极限运动镜头库的肾上腺素语言迁移至产品营销场景，追求高转化率的信息密度与视觉冲击。家庭温情场景偏好：主动设计\"小卓妈妈拍摄小香香\"马尔代夫海边短片，融合产品植入与亲情叙事，体现对\"科技记录生活\"这一场景美学的认同；进一步拓展至\"香香和陈卓\"的宝宝洗澡座椅营销短片，将家庭日常消费品与温情剧情结合。视听融合美学：追求Seedance原生渲染的声画一体，反对后期配音的割裂感，将声音设计（台词、音效、环境音）前置到提示词工程阶段，作为镜头不可分割的组成维度。对标超越意识：主动引入外部工业化参考标准，要求\"参考学习，并且能够超越它\"，体现对一流标准的敬畏与自主超越的雄心，拒绝简单模仿而追求结合自有情况的差异化升级。通用系统美学：强调系统承载多元内容类型（山海经IP、通用电影、商业广告、健康科普），要求字段处理灵活变通，体现对平台化、可扩展架构的深层偏好。科普内容审美：要求健康科普视频兼具专业度与通俗易懂，避免透支后续内容，体现对系列化内容节奏控制的精细考量；对科普内容差异化调性把控精细，第一集创意指数0.8侧重吸引力与易懂性，第二集降至0.49更重专业可信度而非炫技式创意发散，显示对不同类型内容差异化调性的精细把控。质量稳定性审美：将\"单次高质量\"视为不足，追求\"可稳定复现的高质量\"，体现对系统确定性而非偶然惊艳的深层价值偏好。标准统一性审美：发现跨系统字段不一致时，坚持从卓越系统提取标准规范反向注入，体现对\"标准先行、系统对齐\"的治理美学，拒绝各系统各自为政的混乱状态。"}

## Short-Term Memory (STM)

> last_update: 2026-06-23 03:38

Recent conversation content from the user's chat history. This represents what the USER said. Use it to maintain continuity when relevant.
Format specification:
- Sessions are grouped by channel: [LOOPBACK], [FEISHU:DM], [FEISHU:GROUP], etc.
- Each line: `index. session_uuid MMDDTHHmm message||||message||||...` (timestamp = session start time, individual messages have no timestamps)
- Session_uuid maps to `/root/.openclaw/agents/main/sessions/{session_uuid}.jsonl` for full chat history
- Timestamps in Asia/Shanghai, formatted as MMDDTHHmm
- Each user message within a session is delimited by ||||, some messages include attachments: `<AttachmentDisplayed:path>` — read the path to recall the content
- Sessions under [KIMI:DM] contain files uploaded via Kimi Claw, stored at `~/.openclaw/workspace/.kimi/downloads/` — paths in `<AttachmentDisplayed:>` can be read directly

[LOOPBACK] 1-10
1. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 29 MIDDLE MESSAGES, LAST:2 messages ->]||||System (untrusted): [2026-06-22 01:24:40 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Monday, June 22nd, 2026 - 1:33 AM (Asia/Shanghai) / 2026-06-21 17:33 UTC||||System (untrusted): [2026-06-22 01:45:51 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Monday, June 22nd, 2026 - 1:45 AM (Asia/Shanghai) / 2026-06-21 17:45 UTC
2. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 7 MIDDLE MESSAGES, LAST:2 messages ->]||||System (untrusted): [2026-06-21 18:07:25 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 6:10 PM (Asia/Shanghai) / 2026-06-21 10:10 UTC||||System (untrusted): [2026-06-21 18:16:50 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 6:17 PM (Asia/Shanghai) / 2026-06-21 10:17 UTC
3. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 27 MIDDLE MESSAGES, LAST:2 messages ->]||||<AttachmentDisplayed:/root/.openclaw/media/inbound/hyperreality-ep01-full-2026-06-21T10-16-50-615Z-prompts---6aa1f21c-aa0d-4745-bf72-7558cdded24d>  李大鹏: <FileDisplayed:hyperreality-ep01-full-2026-06-21T10-16-50-615Z-prompts.md>||||李大鹏: 我还想到了一个办法，就是你这样： 1. 你去卓越系统里面看一下，我们的这个最终生成的提示词的标准字段规范是什么。 2. 然后你再把它拿过来，放到我们的这个，超现实系统里面去。  因为我看到超现实系统里面，不论怎么搞，它的那个字段都不是我们最终想要的标准规范字段。我们的标准规范字段有15个还[TL;DR]一个标准化的字段。  你去那个卓越系统里找找，或者是说看看在我们现在的系统里面，哪个地方有存储相关的字段。你先把标准字段规范下来，然后再看整个链路当中去怎么去做这块，生成这块。  这个点上来说是非常重要的。很奇怪，我们之前都解决了这些问题，为什么今天晚可能又重新暴露出来的这些。既然有问题，那就面对吧
4. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 27 MIDDLE MESSAGES, LAST:2 messages ->]||||<AttachmentDisplayed:/root/.openclaw/media/inbound/hyperreality-ep01-full-2026-06-21T10-16-50-615Z-prompts---6aa1f21c-aa0d-4745-bf72-7558cdded24d>  李大鹏: <FileDisplayed:hyperreality-ep01-full-2026-06-21T10-16-50-615Z-prompts.md>||||李大鹏: 我还想到了一个办法，就是你这样： 1. 你去卓越系统里面看一下，我们的这个最终生成的提示词的标准字段规范是什么。 2. 然后你再把它拿过来，放到我们的这个，超现实系统里面去。  因为我看到超现实系统里面，不论怎么搞，它的那个字段都不是我们最终想要的标准规范字段。我们的标准规范字段有15个还[TL;DR]一个标准化的字段。  你去那个卓越系统里找找，或者是说看看在我们现在的系统里面，哪个地方有存储相关的字段。你先把标准字段规范下来，然后再看整个链路当中去怎么去做这块，生成这块。  这个点上来说是非常重要的。很奇怪，我们之前都解决了这些问题，为什么今天晚可能又重新暴露出来的这些。既然有问题，那就面对吧
5. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 7 MIDDLE MESSAGES, LAST:2 messages ->]||||System (untrusted): [2026-06-21 18:07:25 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 6:10 PM (Asia/Shanghai) / 2026-06-21 10:10 UTC||||System (untrusted): [2026-06-21 18:16:50 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 6:17 PM (Asia/Shanghai) / 2026-06-21 10:17 UTC
6. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 10 MIDDLE MESSAGES, LAST:2 messages ->]||||李大鹏: 你现在把我们的工作状态转换到卓越系统，你看看卓越系统是否也存在同样的问题，你也去挖一挖。  把整个卓越系统里面的漏网之鱼，就是这个竖杠这个问题，从根上搜集一下，有的话都彻底解决一下||||李大鹏: 卓越系系统是zhuoyue，超短裙系统是short-video
7. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||System (untrusted): [2026-06-21 16:09:20 GMT+8]  System (untrusted): [2026-06-21 16:19:23 GMT+8]  System (untrusted): [2026-06-21 16:31:25 GMT+8]   An[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 4:33 PM (Asia/Shanghai) / 2026-06-21 08:33 UTC||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }
8. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 8 MIDDLE MESSAGES, LAST:2 messages ->]||||System (untrusted): [2026-06-21 18:16:50 GMT+8]   An async command you ran earlier has completed. The result is shown in the system messages above. Ha[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Sunday, June 21st, 2026 - 6:17 PM (Asia/Shanghai) / 2026-06-21 10:17 UTC||||李大鹏: 你现在把我们的工作状态转换到卓越系统，你看看卓越系统是否也存在同样的问题，你也去挖一挖。  把整个卓越系统里面的漏网之鱼，就是这个竖杠这个问题，从根上搜集一下，有的话都彻底解决一下
9. 21419a65-9c15-4b3d-b77c-c2946da5f11e 0621T0711 李大鹏: 可以的||||李大鹏: 跑一个科普视频预生产{  视频任务信息： 穿警服的陈卓女士，讲解居民健康护理知识，进行全民健康科普，现在是第一集【什么是横纹肌溶解——横纹肌溶解的症状以及实验室检查】。  【制作要求】 1.创意指数：0.8 2.内容方面：这是科普视频，内容方面要有专业度，同时也要兼容通俗易懂。所有的讲解都[TL;DR] 【其他注意事项】 我们会做三集，此次是第一集，所以，你的围绕第一集来设计，同时避免把其他两集的内容做了，后面没得做了。 第一集【横纹肌溶解的症状以及实验室检查】 第二集【为什么会发生横纹肌溶解，常见的原因分析】 第三集【怎么处理和预防横纹肌溶解】  在每一集视频最后的时候，你不要预告下一集。  }
10. a2d0632a-4349-401f-8049-515d2b048432 0621T2355 李大鹏: 我看【画幅】这个字段，里面的内容是“竖屏、超短裙系列”，这个是怎么来的？你再看下当前系统跑的是哪一套【超现实系统】还是【超短裙系统】？另外爱，横屏和竖屏这块，我们系统中有没有相关的默认约束？||||李大鹏: 是的，用默认的16：9，继续使用超现实系统。继续推进预生产流程||||[<- FIRST:2 messages, EXTREMELY LONG SESSION, YOU KINDA FORGOT 15 MIDDLE MESSAGES, LAST:2 messages ->]||||System (untrusted): [2026-06-22 14:26:08 GMT+8]  System (untrusted): [2026-06-22 14:45:59 GMT+8]   An async command you ran earlier has completed. The[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Monday, June 22nd, 2026 - 3:02 PM (Asia/Shanghai) / 2026-06-22 07:02 UTC||||System (untrusted): [2026-06-22 14:26:08 GMT+8]  System (untrusted): [2026-06-22 14:45:59 GMT+8]   An async command you ran earlier has completed. The[TL;DR]nally. Do not relay it to the user unless explicitly requested. Current time: Monday, June 22nd, 2026 - 3:02 PM (Asia/Shanghai) / 2026-06-22 07:02 UTC
</IMPORTANT_REMINDER>
