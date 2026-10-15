/** Sources establish language or definitions, never expected investment returns. */
export const KNOWLEDGE_VERSION='2026-10-15.1';
export interface KnowledgeSource {title:string;url:string;kind:'community'|'platform-example'|'professional'|'research';observed:string;access:string}
export const SOURCES:Record<string,KnowledgeSource>={
 q1:{title:'同花顺量化社区：问财语句使用技巧',url:'https://quant.10jqka.com.cn/view/article/2183',kind:'platform-example',observed:'出现均线、财务、估值、资金、股东及行业范围等组合问句。是社区教程，不是后台用户日志。',access:'2026-10-15，全文'},
 q2:{title:'雪球：净利润断层模式如何选股',url:'https://xueqiu.com/5267944508/252234851',kind:'community',observed:'作者描述以业绩预告日期和跳空缺口组合搜索，并以盘中筛选为使用场景。',access:'2026-10-15，搜索索引摘要；原网页反爬，未取得完整正文'},
 q3:{title:'雪球：集合竞价战法',url:'https://xueqiu.com/8012370082/241710507',kind:'community',observed:'作者描述竞价结束后用问财筛选昨日首板股票。这里仅收录需求，不采纳战法或收益说法。',access:'2026-10-15，搜索索引摘要；原网页反爬'},
 q4:{title:'雪球：该怎么选股息率高的股票',url:'https://xueqiu.com/3888343781/380061185',kind:'community',observed:'讨论分红持续性与股息陷阱，显示高股息表达背后还有持续支付能力要求。',access:'2026-10-15，搜索索引正文'},
 q5:{title:'雪球：以财务条件筛选的个人经验帖',url:'https://xueqiu.com/3139782047/398514319',kind:'community',observed:'包含多年ROE、利润现金含量、毛利率、负债与分红条件。文中结果数量前后不一致，收益与效果不作为证据。',access:'2026-10-15，搜索索引正文'},
 q6:{title:'雪球：巧用问财选股功能',url:'https://xueqiu.com/6519173495/111900613',kind:'community',observed:'作者描述筛选后查看基本资料、加入自选和保存条件的后续行为。',access:'2026-10-15，搜索索引正文'},
 cfa:{title:'CFA Institute：价格与企业价值倍数',url:'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/market-based-valuation-price-enterprise-value-multiples',kind:'professional',observed:'倍数需结合盈利、增长、风险和可比性；周期盈利需标准化，不能把低PE直接当便宜。',access:'2026-10-15，全文'},
 peers:{title:'Damodaran：相对估值',url:'https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/relintro.pdf',kind:'professional',observed:'可比企业取决于现金流、增长与风险；同一行业不保证可比。',access:'2026-10-15，PDF/搜索索引'},
 msci:{title:'MSCI：质量与高股息指数',url:'https://www.msci.com/indexes/factor-indexes/quality-and-high-dividend-yield-indexes',kind:'professional',observed:'质量包含盈利能力、盈利稳定性、杠杆；高股息另检验持续性与支付能力。',access:'2026-10-15，全文'},
 sma:{title:'Fidelity：简单移动平均',url:'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/sma',kind:'professional',observed:'SMA为指定期间价格均值，是滞后的历史价格指标。',access:'2026-10-15，全文'},
 roc:{title:'Fidelity：价格变化率',url:'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/roc',kind:'professional',observed:'ROC以当前价格与N期前价格之比计算历史变化。',access:'2026-10-15，全文'},
 picard:{title:'PICARD：受约束的结构化生成',url:'https://aclanthology.org/2021.emnlp-main.779/',kind:'research',observed:'语法约束可减少不可执行输出；本项目还需独立验证语义、字段与阈值。',access:'2026-10-15，论文摘要'},
};
export interface KnowledgeEntry {id:string;title:string;phrases:string[];explanation:string;defaultRule:string;applicability:string;boundary:string;sources:string[];supported:boolean}
export const KNOWLEDGE:KnowledgeEntry[]=[
 {id:'growth',title:'经营比去年好',phrases:['经营改善','业绩比去年好','收入和利润都在增长'],explanation:'收入增加，且归属于上市公司股东的利润也增加。',defaultRule:'营收同比 > 0 且归母净利润同比 > 0；默认2026中报对比上年同期累计值。',applicability:'基期为正、同报告期和币种；白电观察组。',boundary:'不代表增速加快、扣非增长或现金流变好。',sources:['q1','msci'],supported:true},
 {id:'revenue_growth',title:'生意规模扩大',phrases:['营收增长','收入增加','营业收入比去年多'],explanation:'看公司卖出的产品和服务带来的收入是否增加。',defaultRule:'营业收入同比 > 0；0是增加与减少的分界。',applicability:'同口径累计收入，基期为正。',boundary:'收入增长可能未带来利润增长。',sources:['q1'],supported:true},
 {id:'profit_growth',title:'利润比去年多',phrases:['利润增长','盈利同比增加','净利润比去年多'],explanation:'看归属于上市公司股东的利润是否比去年同期增加。',defaultRule:'归母净利润同比 > 0。明确数字则保留数字。',applicability:'上年同期利润为正。',boundary:'归母口径，不等同扣非利润；低基数可能放大增幅。',sources:['q1','q2'],supported:true},
 {id:'value',title:'盈利倍数别太高',phrases:['估值合理','价格别太贵','相对便宜','PE不高'],explanation:'先比较本组正盈利公司的PE，缩小研究范围。',defaultRule:'正PE不高于本组适用公司中位数；近两个完整年度及本期、基期归母利润均为正。',applicability:'仅本组；有效样本≥5且覆盖率≥80%。业务、规模仍可能不同。',boundary:'中位数只是参考线，不是合理价。不能跨行业、用于亏损公司或证明低估。',sources:['q1','cfa','peers'],supported:true},
 {id:'low_vol',title:'日常起伏小些',phrases:['波动小一点','不要大起大落','低波动'],explanation:'比较过去每天涨跌起伏的大小。',defaultRule:'60个交易日年化波动率不高于本组中位数。',applicability:'61个完整有效前复权收盘价；不以盈利为前提。',boundary:'持续缓跌也可能低波动；不表示未来少亏。',sources:['q1','roc'],supported:true},
 {id:'low_drawdown',title:'从高点回落少些',phrases:['回撤小一点','从高点跌得少','历史回落别太大'],explanation:'看这段时间从先前高点最多跌了多少。',defaultRule:'60个交易日最大回撤不高于本组中位数。',applicability:'完整前复权收盘价；回撤用正数百分比。',boundary:'不是个人持仓亏损，也不是未来损失上限。',sources:['q1','roc'],supported:true},
 {id:'stable',title:'走势相对稳定',phrases:['走势相对稳定','走势稳一点','少些起伏和回落'],explanation:'同时看日常起伏和高点后的回落。',defaultRule:'波动率、最大回撤均不高于各自组内中位数。',applicability:'两项价格指标各自覆盖率≥80%，样本≥5。',boundary:'历史较稳仍可能亏损，不等于低风险资产。',sources:['q1','roc'],supported:true},
 {id:'profitable',title:'本期没有亏损',phrases:['不要亏损公司','本期盈利','归母利润为正'],explanation:'核对本期归属于上市公司股东的净利润是否为正。',defaultRule:'指定报告期归母净利润 > 0；不额外要求同比增长。',applicability:'2026中报或2025年报原值可核验。',boundary:'本期盈利不代表连续盈利、主营盈利或盈利质量好。',sources:['q1','msci'],supported:true},
 {id:'turnaround',title:'从亏损转为盈利',phrases:['扭亏为盈','去年亏今年赚','上年同期亏损本期盈利'],explanation:'去年同期归母利润小于0，本期大于0。',defaultRule:'同口径上年同期归母利润 < 0 且本期 > 0。',applicability:'两期原值均可核验；不计算负基数同比。',boundary:'不把扭亏写成增长百分比；需另核查持续性与一次性收益。',sources:['q2','cfa'],supported:true},
 {id:'trend',title:'收盘在20日均线上方',phrases:['站在20日均线上方','收盘价高于20日均线'],explanation:'最后一个完整交易日的收盘价高于近20日平均收盘价。',defaultRule:'(收盘价 / 20日均价 − 1) × 100% > 0。',applicability:'有效前复权价格窗口；20个价格均含结束日。',boundary:'仅当前位置，不代表当天上穿、持续站稳或未来上涨。',sources:['q1','sma'],supported:true},
 {id:'return_positive',title:'近60日价格上涨',phrases:['近60个交易日上涨','60日涨幅为正'],explanation:'最后收盘价比60个交易日前高。',defaultRule:'(期末前复权收盘价 / 期初前复权收盘价 − 1) × 100% > 0。',applicability:'完整61个交易日价格。',boundary:'只描述历史价格变化，不是总回报或回测收益。',sources:['q1','roc'],supported:true},
 {id:'dividend',title:'分红持续、股息率高',phrases:['想收股息','年年分红','股息率高一点'],explanation:'需要区分已实施分红与预案，并检查支付能力与持续性。',defaultRule:'规划：实施现金分红/价格、连续分红年数、支付率及现金流；本版不定阈值。',applicability:'应分行业核查分红与财务数据；银行不直接套工业现金流口径。',boundary:'股价下跌会抬高股息率；没有分红数据时不能用低PE替代。',sources:['q4','msci'],supported:false},
 {id:'quality',title:'盈利质量好',phrases:['好公司','赚钱能力强','ROE高且负债低'],explanation:'通常需要盈利能力、稳定性、杠杆与一次性损益等多项核查。',defaultRule:'规划：ROE、盈利波动、杠杆和扣非；未接入不能执行。',applicability:'财务结构相近的企业；银行杠杆不能和工业企业直接比较。',boundary:'利润增长不等于高质量，通用ROE阈值可能掩盖高杠杆。',sources:['q5','msci'],supported:false},
 {id:'cashflow',title:'赚到现金',phrases:['现金流好','利润有含金量','现金能覆盖利润'],explanation:'需要经营现金流与利润对应，并观察多年和营运资本变化。',defaultRule:'规划：经营现金流/净利润与多期趋势；分母为负时不能照搬比率。',applicability:'非金融经营企业；本版尚未接入现金流表。',boundary:'不把会计利润当现金流；单期现金流可能受季节性影响。',sources:['q5','msci'],supported:false},
 {id:'acceleration',title:'增速加快',phrases:['增长加速','增速比以前快','连续三年增长'],explanation:'加速比较增长率；连续增长检查每期，均不等于一期正增长。',defaultRule:'规划：至少三期同口径比较，明确累计还是单季。',applicability:'期数、披露时点和基数完整；本版未建立全部期数契约。',boundary:'不能简化成同比>0。',sources:['q1','q2'],supported:false},
 {id:'surprise',title:'业绩超预期',phrases:['业绩超预期','刚发利好公告'],explanation:'需要公告原文与当时可见的一致预期，比较事实与预期差。',defaultRule:'规划：已披露实绩对比事前一致预期；不是同比增长。',applicability:'时间版本明确的预期与公告；本版不接入。',boundary:'新闻利好不等于未来上涨。',sources:['q2'],supported:false},
 {id:'breakout',title:'放量突破或竞价筛选',phrases:['放量突破','今天上穿均线','竞价强势','主力流入'],explanation:'需要定义突破参照、量能窗口、盘口或资金统计口径。',defaultRule:'规划：量价与时序事件分别建模；先明确窗口与事件。',applicability:'相应频率的完整行情；本版只有日收盘，不具备盘中执行数据。',boundary:'在均线上方不等于上穿，不把资金统计叫做主力意图。',sources:['q1','q3','sma'],supported:false},
 {id:'bank',title:'银行相对估值',phrases:['找便宜的银行股','低PB高ROE银行'],explanation:'银行需结合PB、ROE、资产质量和资本约束。',defaultRule:'规划：银行专用比较组及指标，不套用白电PE默认值。',applicability:'银行专用数据与口径；本版不支持该股票池。',boundary:'低PB也可能反映资产质量与盈利风险。',sources:['cfa','peers'],supported:false},
 {id:'cyclical',title:'周期股估值',phrases:['煤炭PE低','有色便宜'],explanation:'周期盈利高点可能使PE看起来很低，需要跨周期盈利分析。',defaultRule:'规划：标准化盈利、周期位置与行业供需；不自动套PE中位数。',applicability:'覆盖完整周期的可靠财务与行业数据。',boundary:'低PE不等于低估。',sources:['cfa','peers'],supported:false},
];
export const EXAMPLES=[
 {label:'业绩和价格一起看',query:'经营改善，估值别太高，走势稳一点',goals:['growth','value','stable'],provenance:'constructed'},
 {label:'只看利润增长',query:'利润比去年同期多，PE不超过20倍',goals:['profit_growth'],provenance:'constructed'},
 {label:'少些起伏和回落',query:'不要大起大落，从高点回落也少一点',goals:['low_vol','low_drawdown'],provenance:'constructed'},
 {label:'盈利且在均线上方',query:'本期盈利，收盘价高于20日均线',goals:['profitable','trend'],provenance:'constructed'},
 {label:'找扭亏公司',query:'上年同期亏损，本期扭亏为盈',goals:['turnaround'],provenance:'constructed'},
 {label:'价格近60日上涨',query:'近60个交易日涨幅大于0%，营收同比大于0%',goals:[],provenance:'constructed'},
] as const;
