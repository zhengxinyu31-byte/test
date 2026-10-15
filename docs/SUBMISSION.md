# 题目交付索引

- **Web产品**：https://stock-intent-lab-zheng.liaoyanqing666.chatgpt.site
- **源代码与启动说明**：[GitHub仓库及README](https://github.com/zhengxinyu31-byte/test)
- **需求与设计**：[PRD](superpowers/specs/2026-10-15-stock-intent-v5-prd.md)、[交互设计](designs/2026-10-15-v5-interaction-design.md)
- **技术与实施**：[技术设计](TECHNICAL_DESIGN.md)、[实施计划](superpowers/plans/2026-10-15-stock-intent-v5.md)、[实施裁定](IMPLEMENTATION-DECISIONS-V5.md)
- **问句—策略知识库**：[研究及来源](knowledge/intent-strategy-research.md)、[结构化知识库](../lib/stock/knowledge.ts)
- **AI使用与验证**：[AI记录](AI-USAGE-V5.md)、[真实编译结果](validation/v5-model-final.json)
- **测试与合规边界**：[测试报告](TEST-REPORT-V5.md)、[逐项验收](REQUIREMENTS-CHECKLIST.md)、[公开发布说明](RELEASE-V5.md)
- **演示**：[90秒操作脚本](DEMO.md)，未制作可选视频。

## 评审可直接操作

先点第二个示例，再筛选，查看一只股票的依据；点“查看条件与依据”，输入“PE上限改成25倍，其他条件不变”，先看变化后应用；比较最多三只，保存并重新打开历史结果。该示例原句是“利润比去年同期多，PE不超过20倍”。

再输入“稳健”查看澄清；输入“PE大于30，PE小于20”查看冲突；输入“现金流好，PE不超过20”查看未支持项。不要把被拦截要求删除后得到的名单称为满足原意图。

## 有意缩小的范围

服务已有行业研究方向、但不熟悉指标公式的自主研究者。只接入白电整机观察组；19类意图中11类当前可执行，其余解释所需数据和边界。公司业务可比性尚未逐家审核，组内中位数仅为初筛参考。首屏零必填参数，默认值及其用途随结果展示。

初筛事实来自扶摇，金融数值由确定性程序计算，AI只参与意图解释。后续使用由比较与保存满足；不做回测、监控、买卖建议或收益承诺。两小时是MVP范围标准，项目经过多轮研究修订，不声称全部工作从零两小时完成。
