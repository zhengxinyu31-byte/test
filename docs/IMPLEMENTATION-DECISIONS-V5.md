# 实施裁定与边界

- Ruling: 不做整套通用金融Agent；补足多类问法但只执行数据已核验的策略 — 用户要求专业映射而非无边界覆盖 — 成本是分红、现金流等暂不执行。
- Ruling: 沿用已隔离feat分支和Sites源码工作流，由helper统一提交 — 避免重复工作树及历史分叉 — 每任务用测试和ledger追踪。
- Task 2: initial 10 RED→GREEN tests. Real model first pass 5/6 example families, explicit PE got redundant fuzzy goal rejected. Ruling: remove only redundant fuzzy goals whose every field is explicitly specified; keep all explicit operators/values and reject unrelated goals — harmless structural redundancy should not force user repetition — additional regression added. Conflict evaluator needs separate success definition from ordinary-ready intent.
- Task 4: Ruling: explicit numeric edit uses deterministic parser after two observed model failures — user already supplied all necessary information, avoids unnecessary nondeterminism — cost: narrowly supported phrasing; other phrasing still uses fallible model. Two RED→GREEN regression tests, suite101/101.

独立审查6项重要问题已修复，无延后轻微项。新增的明确修改解析经两项失败回归与真实接口验证。
