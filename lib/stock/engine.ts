import type { Condition, ConditionPatch, Evaluation, Field, Metric, PricePoint, Stock } from './types.ts';

export const DICTIONARY_VERSION='2026-10-v3';
export const LIMITATIONS:Record<Field,string>={revenue:'同比增长不代表增速加快，也没有验证现金流或增长原因。',profit:'这里是累计归母净利润；未核验扣非利润、现金流或盈利质量。',pe:'仅比较正 PE(TTM) 的绝对倍数；不代表公允价值或跨行业便宜。',volatility:'衡量过去的起伏。持续小幅下跌也可能低波动；不是未来最大亏损。',drawdown:'衡量窗口内从先前高点的最大跌幅，不是个人持仓亏损或未来损失上限。'};

export function applyPatches(current:Condition[],operations:ConditionPatch[]):Condition[]{
 if(!Array.isArray(operations)||operations.length>8)throw new Error('条件修改格式无效。');
 let next=current.map(c=>({...c}));const touched=new Set<string>();
 for(const p of operations){
  if(!p||!['update','remove','add'].includes(p.type))throw new Error('不支持的修改操作。');
  if(p.type==='add'){if(!p.condition)throw new Error('新增条件缺失。');next.push({...p.condition});continue;}
  if(typeof p.id!=='string'||touched.has(p.id)||next.filter(c=>c.id===p.id).length!==1)throw new Error('修改目标不明确或不存在。');
  touched.add(p.id);
  if(p.type==='remove')next=next.filter(c=>c.id!==p.id);
  else{if(p.op===undefined&&p.value===undefined)throw new Error('修改没有指定内容。');next=next.map(c=>c.id===p.id?{...c,...(p.op!==undefined?{op:p.op}:{}),...(p.value!==undefined?{value:p.value}:{})}:c);}
 }
 const structural=validateConditions(next).filter(e=>!e.includes('冲突'));
 if(structural.length)throw new Error(structural.join(' '));return next;
}

export const FIELDS: Record<Field, { label: string; short: string; unit: '%' | '倍'; description: string }> = {
  revenue: { label: '营业收入同比', short: '营收同比', unit: '%', description: '同一报告期累计营业收入，与上年同期比较；基期须为正。' },
  profit: { label: '归母净利润同比', short: '归母利润同比', unit: '%', description: '同一报告期归属于母公司股东的净利润，与上年同期比较；基期须为正。' },
  pe: { label: '市盈率 PE(TTM)', short: 'PE · TTM', unit: '倍', description: '最新估值快照；仅对正值进行常规倍数筛选，低市盈率不等于低估。' },
  volatility: { label: '60 日年化波动率', short: '年化波动率', unit: '%', description: '61 个完整交易日的前复权收盘价；60 个日对数收益的样本标准差 × √252。' },
  drawdown: { label: '60 日最大回撤', short: '最大回撤', unit: '%', description: '61 个交易日窗口中，前复权收盘价相对此前最高收盘价的最大跌幅，按正数展示。' },
};
export const DEFAULT_CONDITIONS: Condition[] = [
  { id:'revenue',field:'revenue',op:'>',value:0,sourceText:'经营改善 → 营收同比为正' },
  { id:'profit',field:'profit',op:'>',value:0,sourceText:'经营改善 → 归母净利润同比为正' },
  { id:'pe',field:'pe',op:'<=',value:25,sourceText:'估值合理 → 正 PE(TTM) 不高于 25 倍' },
  { id:'volatility',field:'volatility',op:'<=',value:30,sourceText:'走势相对稳定 → 年化波动率不高于 30%' },
];
export const STATUS_LABELS = {pass:'符合条件',fail:'未通过',unknown:'无法判断'};
export function formatValue(value: number | null | undefined, unit = '%') {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}${unit}`;
}
export function conditionLabel(c: Condition) {return `${FIELDS[c.field]?.label ?? c.field} ${c.op} ${c.value}${FIELDS[c.field]?.unit ?? ''}`;}
export function validateConditions(conditions: Condition[]): string[] {
  const errors: string[]=[];
  if (!Array.isArray(conditions) || conditions.length>8) return ['最多支持 8 项条件。'];
  const ids=new Set<string>();
  for (const c of conditions) {
    if (!c || !(Object.hasOwn(FIELDS,c.field)) || !['>','>=','<','<=','='].includes(c.op) || !Number.isFinite(c.value) || typeof c.id!=='string' || !c.id) {errors.push('条件包含未知指标、操作符或无效数值。');continue;}
    if(ids.has(c.id)) errors.push('条件标识重复。');ids.add(c.id);
  }
  if(errors.length) return [...new Set(errors)];
  for(const field of Object.keys(FIELDS) as Field[]) {
    let low=-Infinity,high=Infinity,lowOpen=false,highOpen=false;
    for(const c of conditions.filter(c=>c.field===field)) {
      if(['>','>=','='].includes(c.op) && c.value>=low) {
        lowOpen=c.value===low ? lowOpen||c.op==='>' : c.op==='>';low=c.value;
      }
      if(['<','<=','='].includes(c.op) && c.value<=high) {
        highOpen=c.value===high ? highOpen||c.op==='<' : c.op==='<';high=c.value;
      }
    }
    if(low>high || (low===high && (lowOpen||highOpen))) errors.push(`${FIELDS[field].label}的上下限互相冲突，请修改后执行。`);
  }
  return errors;
}
function compare(actual:number,c:Condition) {
  switch(c.op) {case '>':return actual>c.value;case '>=':return actual>=c.value;case '<':return actual<c.value;case '<=':return actual<=c.value;case '=':return actual===c.value;}
}
export function evaluate(stocks:Stock[],conditions:Condition[]):Evaluation[] {
  const errors=validateConditions(conditions);if(errors.length)throw new Error(errors.join(' '));
  return [...stocks].sort((a,b)=>a.code.localeCompare(b.code)).map(stock=>{
    const checks=conditions.map(condition=>{
      const m=stock.metrics[condition.field];
      if(!m || m.value===null || !Number.isFinite(m.value) || m.quality!=='ok' || (condition.field==='pe'&&m.value<=0)) return {condition,status:'unknown' as const,actual:m?.value??null,reason:m?.issue||(condition.field==='pe'&&m?.value!=null&&m.value<=0?'PE 非正，不适用于常规低估值比较。':'该指标缺少可验证数据。')};
      const pass=compare(m.value,condition);
      return {condition,status:pass?'pass' as const:'fail' as const,actual:m.value,reason:`实际 ${formatValue(m.value,m.unit)}，${pass?'满足':'不满足'} ${condition.op} ${condition.value}${m.unit}。`};
    });
    return {stock,checks,status:checks.some(c=>c.status==='fail')?'fail':checks.some(c=>c.status==='unknown')?'unknown':'pass'};
  });
}
export function compareRuns(before:Evaluation[],after:Evaluation[]) {
  const a=new Map(before.map(x=>[x.stock.code,x.status]));
  return {added:after.filter(x=>x.status==='pass'&&a.get(x.stock.code)!=='pass').map(x=>x.stock.code),removed:after.filter(x=>x.status!=='pass'&&a.get(x.stock.code)==='pass').map(x=>x.stock.code),changes:after.filter(x=>a.has(x.stock.code)&&a.get(x.stock.code)!==x.status).map(x=>({code:x.stock.code,name:x.stock.name,from:a.get(x.stock.code)!,to:x.status}))};
}
export function relaxations(stocks:Stock[],conditions:Condition[]) {return conditions.map(c=>({id:c.id,label:conditionLabel(c),count:evaluate(stocks,conditions.filter(x=>x.id!==c.id)).filter(x=>x.status==='pass').length}));}
export function unknownMetric(issue:string,unit:'%'|'倍'='%',quality:Metric['quality']='missing'):Metric{return {value:null,unit,quality,issue,evidence:[]};}
export function calculateYoY(current:number|null,previous:number|null):Metric {
  if(current==null||previous==null||!Number.isFinite(current)||!Number.isFinite(previous)) return unknownMetric('缺少同口径本期或上年同期原值。');
  if(previous<=0)return unknownMetric('上年同期基期不为正，不适用于常规同比；不将扭亏解释为常规增长。','%','invalid');
  return {value:(current-previous)/previous*100,unit:'%',quality:'ok',evidence:[]};
}
export function calculateRisk(bars:PricePoint[],expectedDates:string[]):{volatility:Metric;drawdown:Metric} {
  const bad=(reason:string)=>({volatility:unknownMetric(reason),drawdown:unknownMetric(reason)});
  if(expectedDates.length!==61 || new Set(expectedDates).size!==61)return bad('交易日历不足 61 个交易日。');
  const expected=new Set(expectedDates),selected=bars.filter(b=>expected.has(b.date));
  if(selected.length!==61||new Set(selected.map(b=>b.date)).size!==61)return bad('61 个交易日窗口存在缺失或重复日期，未进行补值。');
  const byDate=new Map(selected.map(b=>[b.date,b]));const ordered=expectedDates.map(d=>byDate.get(d)!);
  if(ordered.some(b=>!Number.isFinite(b.close)||b.close<=0||!Number.isFinite(b.volume)||b.volume<=0))return bad('窗口内存在无效价格或无成交记录，不能可靠评估稳定性。');
  const returns=ordered.slice(1).map((b,i)=>Math.log(b.close/ordered[i].close));
  const mean=returns.reduce((a,b)=>a+b,0)/60;
  const volatility=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/59)*Math.sqrt(252)*100;
  let peak=ordered[0].close,drawdown=0;for(const b of ordered){peak=Math.max(peak,b.close);drawdown=Math.max(drawdown,(peak-b.close)/peak*100);}
  return {volatility:{value:volatility,unit:'%',quality:'ok',evidence:[]},drawdown:{value:drawdown,unit:'%',quality:'ok',evidence:[]}};
}
