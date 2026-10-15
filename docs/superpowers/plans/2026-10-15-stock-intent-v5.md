# 多意图选股 Demo v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 基于有出处的问句—策略知识库，交付不必填参数的可交互选股 Demo。
**Architecture:** 知识库定义目标、默认解释和边界；AI 只识别目标与用户明确条件；确定性代码从同一快照计算基准、判断和变化。复用已验证的数据获取、证据、部署能力，保留旧版测试作为回归基线。
**Tech Stack:** React / TypeScript / Vinext / Cloudflare Workers / 扶摇 / OpenRouter。
**Spec:** `docs/superpowers/specs/2026-10-15-stock-intent-v5-prd.md` 与本轮 `docs/knowledge/intent-strategy-research.md`。用户已明确要求生成 Demo，直接实施。

## Global Constraints

- Node >=22.13；不添加依赖；密钥与原始供应商数据不进仓库。
- 普通首次筛选零必填数字、零必勾确认；仅实质歧义需要选择。
- 显式条件优先；不补用户未提到的投资目标；不静默删掉不支持的目标。
- 白电整机观察组仅为命名范围，不宣称业务完全可比或等同官方申万分类。
- PE 默认先验盈利门槛与价格基准分开；样本至少5、覆盖率至少80%；P50/P75/P25用线性插值。
- 本轮修改固定快照和比较组；刷新另起一次；事实不由 AI 填写。
- 保留完整股票池，符合/未通过/无法判断/默认方案不适用四类互斥；不排名推荐买入。
- 不承诺涨跌、收益、未来亏损；无数据不生成正常结论。

## Review Focus

1. 多目标输入混入未支持条件：保留该条件并阻止冒充完整结果（任务2测试）。
2. 只有明确 PE 条件：不得额外增加盈利增长、风险、历史盈利门槛（任务2）。
3. 修改已有条件的自然语言：范围外条件不得变化，预览可撤销（任务2/3）。
4. 亏损、低基数、数据缺失：扭亏不能当同比增长，缺失不能当不适用或失败（任务1/2）。
5. 历史保存、过期异步响应、模型错误：结果版本不混淆，降级来源明确（任务3/4）。

### Task 1: 问句知识库与数据能力

**Files:** `lib/stock/knowledge.ts`, `docs/knowledge/intent-strategy-research.md`, `lib/stock/data.ts`, `lib/stock/types.ts`, `tests/knowledge.test.ts`, `tests/peer-data.test.ts`。
**Interfaces:** `KNOWLEDGE` 提供策略 id/名称/原话例子/解释/适用范围/默认/边界/来源/支持状态；`buildDataset(key,report,fetcher,scope)` 增加 white-goods；Stock 可选 profitHistory 保存各报告期原值证据。
- [x] 写样本来源分类、策略唯一ID和适用限制、观察组集合差与盈利历史缺失测试；运行并确认 RED。
- [x] 先落研究和结构化知识库；复用数据代码，支持观察组及已验证的盈利历史。
- [x] 运行测试 GREEN；真实全组取数，记录覆盖与不适用，不以样本数据代替。

### Task 2: 意图编译、基准与执行

**Files:** `lib/stock/screen-{types,policy,intent}.ts`, `app/api/screen/route.ts`, `tests/screen-policy.test.ts`, `tests/screen-intent.test.ts`。
**Interfaces:** `compileIntent(query,key,model): Promise<IntentPlan>`；`buildBenchmarks(dataset): Benchmark[]`；`resolvePlan(plan,dataset): ScreenCondition[]`；`evaluateScreen(dataset,conditions): ScreenEvaluation[]`；`previewChange(run,action): ScreenRun`。
- [x] RED：8条构造数据的中位数/分位数、缺失覆盖、显式阈值优先、混合不支持、冲突、否定、不同问句映射和基准固定。
- [x] 实现结构化输出与白名单，确定性默认政策；支持业绩/估值/起伏/回撤/盈利状态/60日涨幅/20日均线；无新增数据依赖的价格指标复用有效窗口。
- [x] GREEN；真实模型跨类别评测，失败如实保留。

### Task 3: 一句话到结果的交互

**Files:** `components/stock/workbench.tsx`, `components/stock/screen-details.tsx`, `app/globals.css`, `scripts/browser-v5.mjs`。
**Interfaces:** `/api/screen` 返回计划、条件、真实快照、基准、逐股证据；调整在同快照内本地确定性试算；保存v5独立localStorage键。
- [x] 写浏览器验收：无需填指标即可结果、知识库问法可选、原因与来源、变化预览/撤销、三股比较、保存恢复、窄屏无溢出。
- [x] 重做工作台：简洁入口、六个不同问法、条件摘要、完整结果分类、单层详情、按需高级编辑、自然语言修改。
- [x] 浏览器验证及模型/接口故障验证；修复可复现问题。

### Task 4: 验证、文档和发布

**Files:** README、PRD、研究记录、测试报告、AI使用记录、演示脚本。
- [x] 全套测试、类型检查、生产构建、密钥扫描；保留真实测试输入与结论。
- [x] 一次全分支独立审查；重要问题一轮修复及针对性回归。
- [x] Sites发布现有公开站点，匿名主链路、异常与明确修改验收通过。
- 最终交付动作：将已核验源码同步至已授权GitHub，比较两端源码树；一致后输出交付回执。该动作由发布流程执行，最终提交以仓库main为准。
