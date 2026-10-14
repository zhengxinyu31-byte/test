# 自然语言条件选股 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本轮用户已授权完成研究、对抗审查与文档修订后直接实施；执行以 v4 PRD 和技术设计为准。

**Goal:** 完成“模糊意图 → 用户确认的条件 → 真实数据筛选 → 证据 → 修改影响 → 比较与保存”的可操作 MVP。

**Architecture:** LLM 只提出受限条件草稿；验证器检查结构与语义边界；数据适配保存字段、口径和时间证据；纯函数引擎进行三态判断与变化计算。页面将草稿、已执行条件和历史保存结果分开。

**Tech Stack:** React 19、TypeScript、Vinext、Cloudflare Workers、Sites、Node 内置测试；浏览器端验证使用可用的浏览器工具或明确记录的 Playwright 替代。

**Spec:** `docs/superpowers/specs/2026-10-14-stock-intent-prd.md`（研究修订 v4）。

**Technical design:** `docs/TECHNICAL_DESIGN.md`；**Research decisions:** `docs/RESEARCH_REVIEW.md` R1–R10。

## Global Constraints

- 主链路必须从自然语言意图出发；结果复核不能代替选股。
- 股票池：完整当前上证 50；报告期：2026H1／2025FY，明确固定报告期。
- 仅 AND，最多 8 条；字段 revenue、profit、pe、volatility、drawdown；百分比数值 30 表示 30%。
- 模糊含义必须确认，明确数值、否定和报告期不静默改写；不支持的部分不静默删除。
- 每个证券都有 pass／fail／unknown；已知失败优先，但缺失标记必须保留。
- 只修改条件时固定快照；数据刷新、报告期切换另起运行。
- 不输出收益承诺、确定性涨跌、直接买卖建议或综合荐股排名。
- 比较最多三只，同浏览器保存最多五次；不做回测、监控、下单或账户接入。
- 凭据、参考文档原件、个人信息、供应商受限原始数据不得进入公开仓库或前端构建产物。
- 两小时是题目总时限；包括需求与探索。记录真实投入，不把已消耗时间排除后宣称从零两小时完成。

## Review Focus

1. “不要利润下降”“不超过二十倍”“小于等于”等方向与边界表达：不得悄悄翻转或变更数值；任务 3 加样例。
2. “2025 年报利润增长”与页面默认中报不一致：必须确认报告期；任务 3 的时间意图测试和任务 4 的状态测试覆盖。
3. 用户连续改报告期、模型请求返回乱序、输入已修改但旧结果仍在：旧响应不能覆盖新状态，保存不能混合版本；任务 4 覆盖。
4. 全池接口成功但返回空字段、未来来源时间、旧交易日历：不得把空数据或旧数据伪装成正常实时结果；任务 2 覆盖。
5. 已有冲突下输入修复指令、候选已通过但另一字段缺失、四舍五入边界：修复入口保持可用，解释保留完整证据；任务 1、3、4 覆盖。

## 现状及本轮边界

项目目录：`stock-intent-lab`，现有引擎、适配和模型调用均是旧方案原型，不能据此跳过本版差异审查。现有页面仍是脚手架。已有凭据和基础连通性验证可复用，但不能代表生产端到端验收。

研究与对抗性审查已经完成，用户随后明确授权修订后直接开发完整 Demo。现在在既有独立项目分支继续，由本会话直接实施，完成后按执行技能作一次独立全量审查，不为每个任务额外引入实施代理。

## 文件与接口边界

| 文件 | 职责 |
|---|---|
| `lib/stock/types.ts` | 条件、解释草稿、快照、证据、执行与保存类型 |
| `lib/stock/engine.ts` | 条件校验、三态判定、同比／风险计算、变化和去项诊断 |
| `lib/stock/data.ts` | 扶摇受控请求、金融字段映射、时间与完整性校验、缓存 |
| `lib/stock/intent.ts` | 模型契约、输入边界、结构输出、语义保真检查 |
| `lib/stock/server.ts` | 请求限制与脱敏错误 |
| `lib/stock/workspace.ts` | 草稿／执行版本、确认、请求乱序和报告期切换状态 |
| `lib/stock/storage.ts` | 保存、容量失败、历史恢复与版本校验 |
| `app/api/interpret/route.ts`、`app/api/dataset/route.ts` | 服务端 API；密钥不下发浏览器 |
| `components/stock/*.tsx` | 意图、条件、结果、证据、比较、保存视图 |
| `app/page.tsx`、`app/globals.css`、`app/layout.tsx` | 工作台组装、响应式样式与元数据 |
| `tests/*.test.ts`、`tests/browser-check.mjs` | 计算／契约／状态／存储与浏览器主链路验证 |
| `README.md`、`docs/AI_USAGE.md`、`docs/TESTING.md`、`docs/DEMO.md` | 启动、选择、真实 AI 记录、测试证据和演示脚本 |

## Task 1: 固化数据契约与确定性判断

**Files:** Modify `lib/stock/types.ts`, `lib/stock/engine.ts`; Test `tests/engine.test.ts`。

**Interfaces:**

- 保留 `Condition { id, field, op, value, sourceText }`；单位由字段定义决定，禁止模型自行选择单位。
- `IntentMapping { sourceText: string; conditionIds: string[]; requiresConfirmation: boolean }`：把原话映射到条件；指标解释和限制由字段字典填充。
- 扩展 `Interpretation`：`mappings: IntentMapping[]; requestedReport: Report | null; operations: ConditionPatch[]; baseRevision: number`，保留 questions、unsupported、notices、实际 model 与 requestId。
- `ConditionPatch` 为有限 update（id, op?, value?）、remove（id）、add（condition）联合类型；`applyPatches(current: Condition[], operations: ConditionPatch[]): Condition[]` 只变更指定项，未知或歧义目标拒绝。
- `Dataset` 增加 `fetchStartedAt: string`，createdAt 表示构建完成；保留每项证据的来源时间和获取时间。
- `Strategy { id: string; version: number; intent: string; report: Report; conditions: Condition[]; mappings: IntentMapping[]; confirmedAt: string; omittedRequirements: string[]; model: string }`。
- `ResearchRun { strategy: Strategy; dataset: Dataset; evaluations: Evaluation[]; executedAt: string }`。
- `SavedRun { version: 2; id: string; name: string; savedAt: string; run: ResearchRun }`；不把旧草稿结构自动视为合法已确认策略。
- 保留 `validateConditions(conditions: Condition[]): string[]`、`evaluate(stocks: Stock[], conditions: Condition[]): Evaluation[]`、`compareRuns(before: Evaluation[], after: Evaluation[])`、`relaxations(stocks: Stock[], conditions: Condition[])`。

- [ ] 为未覆盖差异补充测试：严格区间、闭区间、非白名单原型键、空策略在执行入口被阻止、完整精度、已知失败并存未知、单纯放宽的集合包含性质。既有通过测试直接复用，不人为破坏代码制造失败。
- [ ] 加入反例测试：60 次固定 -1% 收益时波动率接近零、回撤约 45.2843%；相同快照可能无法区分 `<20` 与 `<=20`，必须同时验证条件结构与边界数据。
- [ ] 针对需要改变的行为先运行新增测试，确认失败及原因，再调整实现。
- [ ] 独立数学例子：同比 120 对 100 为 20%；基期 0／负值 unknown；61 价格窗口含 100→120→90，之后不创新低且有效成交，则最大回撤 25%；60 个交替 ±0.01 对数收益的波动率为 `sqrt(60/59)*0.01*sqrt(252)*100`（允许浮点误差）。
- [ ] 运行 `node --experimental-strip-types --test tests/engine.test.ts` 与 `npx tsc --noEmit`。Expected：相关测试全部 PASS，类型检查退出码 0。期间新接口消费者尚未更新的错误列明并在对应任务消除，不宣称全项目已绿。
- [ ] 提交限定路径，记录实际命令、结果和与 PRD 的差异。

## Task 2: 验证真实数据与异常契约

**Files:** Modify `lib/stock/data.ts`, `app/api/dataset/route.ts`, `lib/stock/server.ts`; Test `tests/adapters.test.ts`。

**Interfaces:**

- `buildDataset(key: string, report: Report, fetcher: typeof fetch = fetch, now: () => Date = () => new Date()): Promise<Dataset>`；时钟可注入以测试交易窗口和未来时间。
- `getDataset(key: string, report: Report, refresh = false): Promise<Dataset>`；同一缓存快照不重复构建，最小刷新间隔 60 秒，缓存 900 秒。
- GET `/api/dataset?report=2026H1[&refresh=1]`：成功返回 Dataset，错误返回 `{error: string}` 与非成功状态码；HTTP 与业务状态都检查。

- [ ] 新增受控 fetch 测试：401、429（有界重试）、超时、HTTP 200 业务失败、空数据、字段改名、源时间晚于获取时间、估值过期、重复成员、成员数不符 50、历史不足及重复价格日期。
- [ ] 新增部分失败案例：维持 50 个证券，失败指标 unknown，其他指标可按确定结果继续判定；全量接口失败／全量空响应不返回伪造的正常空候选。
- [ ] 新增报告期测试：2026Q2 对 2025Q2；2025FY 对 2024FY；不可用 Q1、总净利润或币种不一致行替代；基期日期和披露日期必须合理。
- [ ] 运行新增测试，确认旧适配的缺口；修正字段、完整性、时间检查与缓存。网络错误日志不含密钥和完整请求头。
- [ ] 运行 `node --experimental-strip-types --test tests/adapters.test.ts`。Expected：全部 PASS。
- [ ] 从服务端分别实际取两个报告期，各抽一只复核同比原值与 61 日窗口；只在忽略目录保存调试原始响应，公开文档只留允许披露的测试结论和请求追踪信息。
- [ ] 记录实际耗时和质量计数。首次加载耗时过长时显示真实加载状态；不可塞入未经标注的静态样例冒充实时数据。
- [ ] 提交适配与测试，不提交供应商原始数据。

## Task 3: 完成意图理解、澄清与修改契约

**Files:** Modify `lib/stock/intent.ts`, `app/api/interpret/route.ts`; Test `tests/intent.test.ts`。

**Interfaces:**

- `interpret(query: string, report: Report, key: string, model = 'openrouter/free', current: Condition[] = [], context = {mode: 'new', baseRevision: 0}): Promise<Interpretation>`；context.mode 类型 new／modify，baseRevision 为非负整数。
- `validateInterpretation(raw: unknown, query: string, model: string, report: Report): Interpretation` 处理有限 schema、来源片段与请求中的显式约束。
- POST 输入 `{query, report, conditions, mode, baseRevision}`；修改使用 Task 1 的 applyPatches 和有限 operations，不让模型重写其他条件；当前条件有区间冲突仍允许发起修复解析，结构非法则拒绝。

- [ ] 用精确断言写用例：模糊三词产生待确认状态；PE 小于 20 保留 `<20`；PE 不超过 20 保留 `<=20`；不要利润下降不得变成 `<0`；中文二十倍不得变成其他值或直接执行无法确认的解释。
- [ ] 写用例：逻辑 OR 不转 AND，“波动率或回撤哪个更适合”进入解释选择；利润水平与增长率不互换，百分比与百分点不互换，静态 PE 不替代 TTM；行业低估不能被 PE<25 静默替代；“利润增速加快”不能冒充利润同比正增长；“2025 年报利润增长”与当前报告期不同时返回请求期与待确认状态；不支持年份保留未支持提示。
- [ ] 写用例：`PE>30 且 PE<15` 冲突可见；随后“把上限改成40，其他不变”允许解析；未提及的营收、利润条件不能变化。
- [ ] 写用例：非法 JSON、未知字段、超长输出、源片段不在原文、模型超时／429、角色扮演与买卖承诺均不能变成正常筛选。混合安全与违规要求不能静默省略，用户需明确处理未支持项。
- [ ] 实施需要参数支持的路由约束（provider.require_parameters=true），有限补丁、baseRevision 校验、受限结构输出、字段白名单、自有属性检查、明确阈值核对、报告期冲突处理及不支持项状态。说明任意自然语言语义等价无法由有限规则证明，不以关键词命中率冒充完整理解率。
- [ ] 运行 `node --experimental-strip-types --test tests/intent.test.ts`。Expected：全部 PASS。
- [ ] 先建立至少 24 条语义与边界样例，标明 AI 草拟期望及开发／首次保留用途；实际模型至少 6 类首轮（模糊、精确、否定、修改、报告期、不支持），否定和修改各重复一次，总计至少 8 次真实调用。记录实际模型、promptVersion、期望、输出、耗时与失败归因；规则拦截不冒充模型调用，配额不足如实记未覆盖，保留样例一经调试转为回归。
- [ ] 提交解释模块与可公开测试记录；凭据和原始敏感日志不提交。

## Task 4: 建立可操作工作台与研究记录

**Files:** Create `lib/stock/workspace.ts`, `lib/stock/storage.ts`, `components/stock/intent-panel.tsx`, `condition-editor.tsx`, `result-table.tsx`, `evidence-drawer.tsx`, `compare-dialog.tsx`, `saved-runs.tsx`; Modify `app/page.tsx`, `app/globals.css`, `app/layout.tsx`; Test `tests/workspace.test.ts`, `tests/storage.test.ts`。

**Interfaces:**

- `createRun(strategy: Strategy, dataset: Dataset): ResearchRun`：验证确认、报告期匹配与条件合法后执行；空条件拒绝。
- `isCurrentResponse(pendingId: string | null, responseId: string): boolean`：只有当前请求可写入状态。
- `saveRun(storage: Pick<Storage,'getItem'|'setItem'>, saved: SavedRun): void`：最多五次，失败抛可展示错误。
- `loadRuns(storage: Pick<Storage,'getItem'>): {runs: SavedRun[]; warnings: string[]}`：版本或结构异常不崩溃、不冒充正常历史记录。
- 页面分别持有 draft（当前编辑）、run（已执行）、historical（恢复的历史），不同版本禁止混存。

- [ ] 先写状态测试：含糊且未确认不能执行；不支持项未处置不能执行；切换报告期不能继续用旧 Dataset；旧请求返回不能覆盖新输入；保存采用已执行 intent 和 conditions，不能采用正在编辑的草稿。
- [ ] 写存储测试：第六次保存淘汰最早记录且明确告知；空间不足不得返回成功；损坏 JSON 或未知版本提示无法恢复；历史打开保留原时点和结果。
- [ ] 实施单屏意图与条件确认：三组原话映射、财报期选择、稳定性口径选择、所有阈值可编辑、变更前后对照。展示用户主动忽略的要求，不隐藏它们。指标模板提供朴素含义、不能推出的结论和未核验范围，不将未核验写成个股风险事实。
- [ ] 实施结果三状态计数、检索、代码排序、逐股证据、完整精度、数据质量提示、同快照新增／移出／状态变化和零结果去项预览。
- [ ] 实施三股比较、五次本地保存、历史结果恢复、刷新新运行。新输入、解析中、加载、异常等状态有明确下一步，按钮不产生伪成功。
- [ ] 运行 `node --experimental-strip-types --test tests/workspace.test.ts tests/storage.test.ts` 与 `npx tsc --noEmit`。Expected：全部 PASS，类型检查退出码 0。
- [ ] 在 1440px 和 390px 宽度查看页面。桌面证据不遮住关闭入口，窄屏可按顺序完成任务；输入有标签，焦点与错误状态可辨认。
- [ ] 提交界面、状态和存储功能。

## Task 5: 主链路、异常及独立审查

**Files:** Create `tests/browser-check.mjs`, `docs/TESTING.md`, `docs/AI_USAGE.md`；按缺陷修改对应模块。

**Interfaces:** Browser 消费真实公开形状 API；故障注入只用测试拦截和明确构造 fixtures，不改变正式页面的数据来源。

- [ ] 浏览器真实主链路：输入三词 → 模型草稿 → 确认 → 50 股筛选 → 打开一只入选与一只落选的证据 → 修改一项阈值 → 看到变化 → 比较 → 保存 → 刷新页面恢复历史。
- [ ] 浏览器边界：冲突阻止执行后修复；零结果诊断不自动改条件；池外代码显示范围提示；最多三股比较；模型失败时手动编辑；数据失败时无假名单；部分未知保留；保存空间失败有错误反馈。
- [ ] 运行 `node --experimental-strip-types --test tests/*.test.ts`、`npx tsc --noEmit`、`node tests/browser-check.mjs`。Expected：各项通过；记录跳过或未覆盖项，不能用“测试全过”遮盖未运行的验收。
- [ ] 按 Superpowers 执行技能发起一次独立全量代码审查，重点覆盖 Review Focus。根据用户实际影响判断严重级别，重要问题先写失败回归测试再修复；未解决问题不得宣称完成。
- [ ] AI 使用记录区分：工具完成的研究／设计／代码、用户提出的产品纠偏、代码审查修复、仍需真人验证的假设。不得虚构“候选人手动修正”经历。
- [ ] 提交修复与文档。

## Task 6: 可访问产品、源码和交付材料

**Files:** Modify `README.md`, `.gitignore`, `.env.example`, deployment metadata as required；Create `docs/DEMO.md`。

**Interfaces:** 使用既有 Sites 项目；公开源码目标 `https://github.com/zhengxinyu31-byte/test`。本版用户批准后，该计划的发布范围沿用先前选定目标，不重复创建项目。

- [ ] README 包含启动命令、服务端变量名、数据与模型来源、产品取舍、角色边界、成本／缓存／限流边界、未完成事项、测试入口；.env.example 只有占位符。
- [ ] 编写约 90 秒演示脚本：原话确认 → 真实入选与落选证据 → 改条件看影响 → 保存。无需视频文件。
- [ ] 运行 Sites 官方 build helper 并检查实际退出码；检查浏览器产物、待提交文件及提交历史中的密钥、附件原件和受限数据泄露。保护机制需要检查实际文件，不只检查 .gitignore。
- [ ] 使用既有项目完成源码与部署，按用户已选公开范围发布；记录部署版本和源码 commit 的对应关系。
- [ ] 从匿名环境访问实际 URL 再走核心任务。检查两个 API、模型真实标识、完整池和保存恢复；本地通过不能代替线上验证。
- [ ] 将实际线上结果写入 TESTING.md；必要时同步最终文档版本并记录最终对应 commit。交付 Web URL、仓库 URL、文档、已知限制、iFinD 安装与调用状态。

## 两小时时间安排与失败取舍

| 阶段 | 总预算内的计划时段 | 必须产出 |
|---|---|---|
| 需求与对抗审查 | 0–20 分钟 | 认可的用户任务、语义边界与验收 |
| 数据与引擎 | 20–40 分钟 | 全池数据、指标证据、确定性测试 |
| 意图与澄清 | 40–60 分钟 | 真实模型结构输出和必要确认 |
| 可操作界面 | 60–95 分钟 | 端到端选股、证据、修改、比较保存 |
| 验证与修复 | 95–110 分钟 | 主链路、异常、合规与审查证据 |
| 发布交付 | 110–120 分钟 | 匿名可用 URL、仓库与 README |

这是范围控制预算，不是承诺或历史成绩。既有原型中通过复核的部分可复用；已有探索与讨论计入实际工作记录。若剩余时间不足，先删除非必需视觉装饰与额外模型样例，不删除证据、缺失处理或必交物；确实无法按时通过则如实报告时间与未完成项，不能将静态截图或假数据产品算作完成。

## 计划自审

- PRD F1–F2 → Task 3、4；F3–F5 → Task 1、2、4；F6–F7 → Task 4、5。
- 数据、来源、时间与安全 → Task 2、3、6；真实 AI 与验证记录 → Task 3、5；公开交付 → Task 6。
- Review Focus 五项均已分配到明确测试任务。
- 策略、执行结果和快照采用共同契约，保存格式升级为 version 2；旧原型不得作为已确认策略静默迁移。
- 用户已授权实施的范围依据：目标人群和场景、解释确认的交互、五指标和上证 50 范围、三项核心亮点、比较与保存作为选股后的下一步。

**执行依据：** 用户最新指令为“修订后直接进入开发，给我生成完整的 demo”。本计划据此执行；不再重复请求同范围批准。

### 用户追加行业差异要求（执行中修订）

- [x] 查阅 CFA Institute 银行分析及 Damodaran 相对估值原始讲义；验证 iFinD 行业分类实际字段。
- [x] 新增失败测试：模糊估值不可自动产生统一 PE 上限；实现 valuation 待澄清状态。
- [x] 界面要求用户自己输入上限或明确跳过，方法入口提供适用范围，禁止个股价值排名。
- [ ] 测试新流程并同步文档与实际验证记录。
