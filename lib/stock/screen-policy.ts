import { FIELDS, unknownMetric } from './engine.ts';
import { KNOWLEDGE, KNOWLEDGE_VERSION, EXAMPLES } from './knowledge.ts';
import type { Dataset, Metric, Stock } from './types.ts';
import type { Benchmark, IntentPlan, PreparedScreen, ScreenCondition, ScreenEvaluation, ScreenField, ScreenRun, ScreenStatus } from './screen-types.ts';
export const SCREEN_FIELDS={...FIELDS,
 ma20gap:{label:'收盘价高于20日均线',short:'距20日均线',unit:'%',description:'(最后完整交易日收盘价 / 最近20个交易日平均收盘价 − 1) × 100%。'},
 return60:{label:'近60个交易日价格涨幅',short:'60日涨幅',unit:'%',description:'(期末 / 60个交易日前的前复权收盘价 − 1) × 100%；不是策略收益。'},
 profitPositive:{label:'本期归母净利润为正',short:'本期盈利',unit:'',description:'所选报告期归母净利润原值大于0。'},
 turnaround:{label:'上年同期亏损、本期盈利',short:'同比扭亏',unit:'',description:'上年同期归母净利润小于0且本期大于0；零基期不计为扭亏。'},
};
export const SCREEN_STATUS:Record<ScreenStatus,string>={pass:'符合条件',fail:'未通过',unknown:'无法判断',inapplicable:'默认方案不适用'};
export function displayMetric(field:ScreenField,value:number|null){if(value===null||!Number.isFinite(value))return '—';return field==='profitPositive'||field==='turnaround'?(value===1?'是':'否'):`${value.toFixed(2)}${SCREEN_FIELDS[field].unit}`;}
export function quantile(values:number[],q:number):number|null{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),h=(a.length-1)*q,l=Math.floor(h);return a[l]+(a[Math.ceil(h)]-a[l])*(h-l);}
export function peEligibility(stock:Stock,report:Dataset['report']):{status:'ok'|'missing'|'inapplicable';reason:string}{
 const periods=report==='2026H1'?['2024FY','2025FY','2025H1','2026H1']:['2024FY','2025FY'];
 const values=periods.map(p=>stock.profitHistory?.find(x=>x.period===p));
 if(values.some(x=>x?.value!==null&&x?.value!==undefined&&x.value<=0))return {status:'inapplicable',reason:'近两年、本期或同比基期存在非正盈利，不适用本默认PE比较。'};
 if(values.some(x=>x?.value==null))return {status:'missing',reason:'缺少盈利历史，无法确认本默认PE比较的适用性。'};
 return {status:'ok',reason:'所需报告期归母利润均为正。'};
}
export function buildBenchmarks(d:Dataset):Record<'pe'|'volatility'|'drawdown',Benchmark>{
 const entries=(['pe','volatility','drawdown'] as const).map(field=>{
 const pool=field==='pe'?d.stocks.filter(s=>peEligibility(s,d.report).status!=='inapplicable'):d.stocks;
 const members=pool.filter(s=>(field!=='pe'||peEligibility(s,d.report).status==='ok')&&s.metrics[field].quality==='ok'&&s.metrics[field].value!==null&&(field!=='pe'||s.metrics[field].value!>0)).map(s=>({code:s.code,value:s.metrics[field].value!}));
 const coverage=pool.length?members.length/pool.length:0,valid=members.length>=5&&coverage>=.8,values=members.map(m=>m.value);
 const b:Benchmark={field,valid,count:members.length,denominator:pool.length,coverage,members,p25:valid?quantile(values,.25):null,p50:valid?quantile(values,.5):null,p75:valid?quantile(values,.75):null,...(!valid?{issue:`有效样本${members.length}只，覆盖率${(coverage*100).toFixed(0)}%；需至少5只且覆盖率达到80%。`}:{})};return [field,b];
 });return Object.fromEntries(entries) as Record<'pe'|'volatility'|'drawdown',Benchmark>;
}
export function metricFor(s:Stock,field:ScreenField,d:Dataset):Metric{
 if(field in s.metrics)return s.metrics[field as keyof Stock['metrics']];
 if(field==='profitPositive'||field==='turnaround'){
 const current=s.profitHistory?.find(x=>x.period===d.report),base=s.profitHistory?.find(x=>x.period===(d.report==='2026H1'?'2025H1':'2024FY'));
 const ev=[current?.evidence,...(field==='turnaround'?[base?.evidence]:[])].filter(x=>!!x);
 if(current?.value==null||(field==='turnaround'&&base?.value==null))return {...unknownMetric('缺少同口径已披露归母利润原值。'),evidence:ev};
 return {value:current.value>0&&(field==='profitPositive'||base!.value!<0)?1:0,unit:'%',quality:'ok',evidence:ev};
 }
 const risk=s.metrics.volatility;
 if(risk.quality!=='ok'||s.prices.length!==61)return {...unknownMetric(risk.issue??'价格窗口不完整。'),evidence:risk.evidence};
 const prices=[...s.prices].sort((a,b)=>a.date.localeCompare(b.date));const last=prices[60].close,denominator=field==='ma20gap'?prices.slice(-20).reduce((a,b)=>a+b.close,0)/20:prices[0].close;
 return {value:(last/denominator-1)*100,unit:'%',quality:'ok',evidence:risk.evidence.map(e=>({...e,formula:field==='ma20gap'?'(期末收盘价 / 最近20个交易日收盘价算术平均 − 1) × 100%':'(期末收盘价 / 60个交易日前收盘价 − 1) × 100%',note:'前复权价格；均线位置不等于上穿事件，价格涨幅不等于策略总回报。'}))};
}
export function validateScreenConditions(conditions:ScreenCondition[]):string[]{
 if(!conditions.length||conditions.length>10)return ['请保留1至10项条件。'];
 const errors:string[]=[];const ids=new Set<string>();
 for(const c of conditions){if(!c||!Object.hasOwn(SCREEN_FIELDS,c.field)||!['>','>=','<','<=','='].includes(c.op)||(c.value!==null&&!Number.isFinite(c.value))||!c.id||ids.has(c.id))errors.push('条件格式有误。');ids.add(c.id);}
 if(errors.length)return errors;
 for(const field of Object.keys(SCREEN_FIELDS)){
 let lo=-Infinity,hi=Infinity,openLo=false,openHi=false;
 for(const c of conditions.filter(c=>c.field===field&&c.value!==null)){const n=c.value!;if(['>','>=','='].includes(c.op)&&n>=lo){openLo=n===lo?openLo||c.op==='>':c.op==='>';lo=n;}if(['<','<=','='].includes(c.op)&&n<=hi){openHi=n===hi?openHi||c.op==='<':c.op==='<';hi=n;}}
 if(lo>hi||(lo===hi&&(openLo||openHi)))errors.push(`${SCREEN_FIELDS[field as ScreenField].label}上下限冲突，请改掉其中一项。`);
 }return errors;
}
export function resolvePlan(plan:IntentPlan,d:Dataset,benchmarks=buildBenchmarks(d)):ScreenCondition[]{
 if(plan.unsupported.length||plan.question)throw new Error('仍有未处理的要求，未执行筛选。');
 const result:ScreenCondition[]=plan.constraints.map((c,i)=>({...c,id:`explicit-${i}`,origin:'user',goal:'explicit',basis:'保留你给出的指标、方向和数字。'}));
 const explicit=new Set(plan.constraints.map(c=>c.field));
 const add=(field:ScreenField,goal:string,sourceText:string,relative=false)=>{
 if(explicit.has(field)||result.some(c=>c.field===field))return;
 const b=relative?benchmarks[field as 'pe'|'volatility'|'drawdown']:null;
 result.push({id:`default-${field}`,field,op:relative?'<=':field==='turnaround'||field==='profitPositive'?'=':'>',value:b?b.p50:field==='turnaround'||field==='profitPositive'?1:0,sourceText,origin:'default',goal,basis:KNOWLEDGE.find(k=>k.id===goal)?.defaultRule??'',...(relative?{benchmark:field as 'pe'|'volatility'|'drawdown',percentile:.5}:{}),...(field==='pe'&&relative?{profitGate:true}:{})});
 };
 for(const g of plan.goals){switch(g.id){case'growth':add('revenue',g.id,g.sourceText);add('profit',g.id,g.sourceText);break;case'revenue_growth':add('revenue',g.id,g.sourceText);break;case'profit_growth':add('profit',g.id,g.sourceText);break;case'value':add('pe',g.id,g.sourceText,true);break;case'low_vol':add('volatility',g.id,g.sourceText,true);break;case'low_drawdown':add('drawdown',g.id,g.sourceText,true);break;case'stable':add('volatility',g.id,g.sourceText,true);add('drawdown',g.id,g.sourceText,true);break;case'profitable':add('profitPositive',g.id,g.sourceText);break;case'turnaround':add('turnaround',g.id,g.sourceText);break;case'trend':add('ma20gap',g.id,g.sourceText);break;case'return_positive':add('return60',g.id,g.sourceText);break;default:throw new Error('该策略尚不能执行。');}}
 const errors=validateScreenConditions(result);if(errors.length)throw new Error(errors.join(' '));return result;
}
export function evaluateScreen(d:Dataset,conditions:ScreenCondition[]):ScreenEvaluation[]{
 const errors=validateScreenConditions(conditions);if(errors.length)throw new Error(errors.join(' '));
 return [...d.stocks].sort((a,b)=>a.code.localeCompare(b.code)).map(stock=>{
 const checks=conditions.map(condition=>{
 const metric=metricFor(stock,condition.field,d);let status:ScreenStatus='unknown',reason='';
 const eligibility=condition.profitGate?peEligibility(stock,d.report):null;
 if(eligibility&&eligibility.status!=='ok'){status=eligibility.status==='inapplicable'?'inapplicable':'unknown';reason=eligibility.reason;}
 else if(condition.value===null)reason='本组参考线的数据不足，不能判断是否符合。';
 else if(metric.quality!=='ok'||metric.value===null||(condition.field==='pe'&&metric.value<=0))reason=metric.issue??'指标缺失或不适用。';
 else{const a=metric.value,b=condition.value;const ok=condition.op==='>'?a>b:condition.op==='>='?a>=b:condition.op==='<'?a<b:condition.op==='<='?a<=b:a===b;status=ok?'pass':'fail';reason=`${displayMetric(condition.field,a)}，${ok?'符合':'不符合'} ${condition.op} ${displayMetric(condition.field,b)}`;}
 return {condition,status,actual:metric.value,reason,evidence:[...metric.evidence,...(condition.profitGate?(stock.profitHistory??[]).map(x=>x.evidence):[])]};
 });
 const status:ScreenStatus=checks.some(c=>c.status==='fail')?'fail':checks.some(c=>c.status==='inapplicable')?'inapplicable':checks.some(c=>c.status==='unknown')?'unknown':'pass';return {stock,status,checks};
 });
}
export function prepareScreen(dataset:Dataset,plan:IntentPlan):PreparedScreen{const benchmarks=buildBenchmarks(dataset);return {plan,dataset,benchmarks,conditions:resolvePlan(plan,dataset,benchmarks)};}
export function executePreparedScreen(prepared:PreparedScreen):ScreenRun{return {...prepared,version:5,id:crypto.randomUUID(),evaluations:evaluateScreen(prepared.dataset,prepared.conditions),executedAt:new Date().toISOString(),history:[]};}
export function makeRun(dataset:Dataset,plan:IntentPlan):ScreenRun{return executePreparedScreen(prepareScreen(dataset,plan));}
export function changeConditions(run:ScreenRun,conditions:ScreenCondition[],description='修改条件'):ScreenRun{return {...run,id:crypto.randomUUID(),conditions,evaluations:evaluateScreen(run.dataset,conditions),executedAt:new Date().toISOString(),history:[...run.history,description]};}
export function difference(before:ScreenRun,after:ScreenRun){const passed=new Set(before.evaluations.filter(x=>x.status==='pass').map(x=>x.stock.code)),next=new Set(after.evaluations.filter(x=>x.status==='pass').map(x=>x.stock.code));return {added:after.evaluations.filter(x=>next.has(x.stock.code)&&!passed.has(x.stock.code)),removed:before.evaluations.filter(x=>passed.has(x.stock.code)&&!next.has(x.stock.code)),changed:after.evaluations.filter(x=>before.evaluations.find(y=>y.stock.code===x.stock.code)?.status!==x.status)};}
export function presetPlan(index:number):IntentPlan{const e=EXAMPLES[index];if(!e)throw new Error('示例不存在。');return {query:e.query,goals:e.goals.map(id=>({id,sourceText:e.query})),constraints:index===1?[{field:'pe',op:'<=',value:20,sourceText:'PE不超过20倍'}]:index===5?[{field:'return60',op:'>',value:0,sourceText:'近60个交易日涨幅大于0%'},{field:'revenue',op:'>',value:0,sourceText:'营收同比大于0%'}]:[],unsupported:[],question:null,report:'2026H1',model:'已核对的知识库示例（未调用模型）',knowledgeVersion:KNOWLEDGE_VERSION};}
export function rebaseConditions(conditions:ScreenCondition[],benchmarks:ScreenRun['benchmarks']):ScreenCondition[]{return conditions.map(c=>{if(!c.benchmark)return c;if(!['pe','volatility','drawdown'].includes(c.benchmark)||c.benchmark!==c.field||![.25,.5,.75].includes(c.percentile??NaN))throw new Error('相对条件口径无效。');const b=benchmarks[c.benchmark];return {...c,value:c.percentile===.25?b.p25:c.percentile===.75?b.p75:b.p50};});}
export function mergeConditionUpdates(current:ScreenCondition[],next:import('./types.ts').Condition[]):ScreenCondition[]{
 const ids=new Set(next.map(c=>c.id));const updated=current.filter(c=>!Object.hasOwn(FIELDS,c.field)||c.value===null||ids.has(c.id)).map(old=>{const n=next.find(c=>c.id===old.id);if(!n||n.field===old.field&&n.op===old.op&&n.value===old.value)return old;return {...old,...n,origin:'edited' as const,benchmark:undefined,percentile:undefined,basis:'按你的要求修改数值；其他条件保持。'};});
 return [...updated,...next.filter(c=>!current.some(x=>x.id===c.id)).map(c=>({...c,origin:'edited' as const,goal:'explicit',basis:'按你的要求增加。'}))];
}
export function explicitConditionEdit(input:string,current:ScreenCondition[]):ScreenCondition[]|null{
 const query=input.normalize('NFKC').trim();
 const match=query.match(/^(PE|市盈率|营收同比|营业收入同比|归母净利润同比|利润同比|波动率|最大回撤|回撤)\s*(上限|下限)?\s*(?:改成|改为|调整为|设为|调到)\s*(-?\d+(?:\.\d+)?)\s*(倍|%)?\s*(?:[,，]\s*其他(?:条件)?(?:不变|不动|保持不变))?[。.]?$/i);
 if(!match)return null;
 const fields:Record<string,ScreenCondition['field']>={pe:'pe',市盈率:'pe',营收同比:'revenue',营业收入同比:'revenue',归母净利润同比:'profit',利润同比:'profit',波动率:'volatility',最大回撤:'drawdown',回撤:'drawdown'};
 const field=fields[match[1].toLowerCase()];
 if(match[4]&&(field==='pe'?match[4]!=='倍':match[4]!=='%'))throw new Error('修改的单位不符：PE用倍，其余指标用百分比。');
 const targets=current.filter(c=>c.field===field&&(!match[2]||(match[2]==='上限'?['<','<=']:['>','>=']).includes(c.op)));
 if(targets.length!==1)throw new Error('修改目标不存在或有多项，请在具体条件中指定。');
 return current.map(c=>c.id===targets[0].id?{...c,value:Number(match[3]),origin:'edited',benchmark:undefined,percentile:undefined,basis:'按你的明确数值修改；其他条件与适用门槛不变。'}:c);
}
export function canShortcut(run:ScreenRun,kind:'pe'|'risk'):boolean{
 const fields=kind==='pe'?['pe']:['volatility','drawdown'],targets=run.conditions.filter(c=>fields.includes(c.field));
 if(!targets.length||new Set(targets.map(c=>c.field)).size!==targets.length)return false;
 return targets.every(c=>c.benchmark===c.field&&c.op==='<='&&c.value!==null&&(kind!=='pe'||c.profitGate)&&run.benchmarks[c.benchmark!].valid&&(kind==='pe'?run.benchmarks[c.benchmark!].p75!>c.value:run.benchmarks[c.benchmark!].p25!<c.value));
}
export function shortcutConditions(run:ScreenRun,kind:'pe'|'risk'):ScreenCondition[]{
 if(!canShortcut(run,kind))throw new Error('当前条件不适用这项快捷调整，请查看并修改具体条件。');
 return run.conditions.map(c=>{if(kind==='pe'&&c.field==='pe')return {...c,value:run.benchmarks.pe.p75,origin:'edited',percentile:.75,basis:'本组PE参考线由中间水平放宽到75%分位；盈利门槛不变。'};if(kind==='risk'&&['volatility','drawdown'].includes(c.field))return {...c,value:run.benchmarks[c.benchmark!].p25,origin:'edited',percentile:.25,basis:'本组对应走势参考线收紧到25%分位；其他条件不变。'};return c;});
}
export function conditionChanges(before:ScreenCondition[],after:ScreenCondition[]):{id:string;before:ScreenCondition|null;after:ScreenCondition|null}[]{
 return [...new Set([...before.map(c=>c.id),...after.map(c=>c.id)])].map(id=>({id,before:before.find(c=>c.id===id)??null,after:after.find(c=>c.id===id)??null})).filter(x=>JSON.stringify(x.before)!==JSON.stringify(x.after));
}
