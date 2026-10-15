'use client';
import {useState} from 'react';
import {ArrowRight,SlidersHorizontal,X} from 'lucide-react';
import {KNOWLEDGE} from '@/lib/stock/knowledge';
import {displayMetric,SCREEN_FIELDS,validateScreenConditions} from '@/lib/stock/screen-policy';
import type {PreparedScreen,ScreenCondition,ScreenField} from '@/lib/stock/screen-types';
import type {Operator} from '@/lib/stock/types';

const MEANING:Record<ScreenField,string>={
 revenue:'营业收入与去年同期相比增加或减少了多少。大于0，表示公司收入比去年同期多。',
 profit:'归属于上市公司股东的净利润，与去年同期相比的变化。大于0，表示利润增加；基期亏损时不能照算增长率。',
 pe:'当前股价相当于每1元过去12个月每股盈利的多少倍。用来比较盈利对应的价格，不代表多少年保证回本。',
 volatility:'把过去60个交易日的日常起伏折算成年化数值，不是实际年度涨跌幅。数值越低，历史起伏越小，但也可能持续缓跌。',
 drawdown:'这段时间从先前高点最多回落了多少。数值越小，历史回落越少，不代表未来的亏损上限。',
 return60:'最后收盘价相对60个交易日前的涨跌幅。大于0，表示这段时间价格上涨。',
 ma20gap:'最后收盘价与最近20个交易日平均收盘价相比的位置。高于均线，只说明当前价格高于这段时间的均价。',
 profitPositive:'看所选报告期归属于上市公司股东的净利润是否大于0，不额外要求利润增长。',
 turnaround:'核对上年同期归母净利润是否小于0、本期是否大于0。扭亏不换算成负基数的增长率。',
};
const OP:Record<Operator,string>={'>':'大于','>=':'不低于','<':'低于','<=':'不高于','=':'等于'};
export function readableRule(c:ScreenCondition){if(c.field==='profitPositive'&&c.op==='='&&c.value===1)return '本期归母净利润大于0';if(c.field==='turnaround'&&c.op==='='&&c.value===1)return '上年同期亏损，本期盈利';return `${SCREEN_FIELDS[c.field].short}${OP[c.op]}${displayMetric(c.field,c.value)}`;}
export function IndicatorReview({prepared,onChange,onExecute,onBack}:{prepared:PreparedScreen;onChange:(conditions:ScreenCondition[])=>void;onExecute:()=>void;onBack:()=>void}){
 const [editing,setEditing]=useState(false);
 const groups=Array.from(new Set(prepared.conditions.map(c=>c.goal))).map(goal=>({goal,items:prepared.conditions.filter(c=>c.goal===goal),knowledge:KNOWLEDGE.find(k=>k.id===goal)}));
 const errors=validateScreenConditions(prepared.conditions);
 const update=(id:string,patch:Partial<ScreenCondition>)=>onChange(prepared.conditions.map(c=>c.id===id?{...c,...patch,origin:'edited',basis:'你在选股前调整了这项条件；其他条件不变。'}:c));
 return <section className="interpretation" data-testid="indicator-review">
  <div className="review-heading"><span className="eyebrow">第2步 · 看懂指标</span><h2>你的想法，会这样筛选</h2><p>先看每项指标的含义和标准，确认后再选股。</p></div>
  <div className="review-period">财务：{prepared.dataset.report==='2026H1'?'2026年中报，与上年同期比较':'2025年报，与上年同期比较'}<span>价格：{prepared.dataset.windowStart} — {prepared.dataset.tradeDate}</span></div>
  {groups.map(({goal,items,knowledge})=><article className="intent-group" key={goal}>
   <div className="intent-source"><small>你说</small><strong>“{goal==='explicit'?'按给出的指标和数字':items[0].sourceText}”</strong><span>{items.every(c=>c.origin==='user')?'保留原条件':'对应以下指标'}</span></div>
   <div className="indicator-list">{items.map(c=><div className="indicator-item" key={c.id}>
    <h3>{SCREEN_FIELDS[c.field].label}</h3><p className="indicator-meaning">{MEANING[c.field]}</p>
    <div className="indicator-standard"><span>{c.origin==='user'?'你设定的条件':c.origin==='edited'?'已调整的条件':'本次默认条件'}</span><strong>{c.value===null?'数据不足，暂不能确定参考线':readableRule(c)}</strong></div>
    {c.benchmark&&<p className="indicator-basis">取本组{c.benchmark==='pe'?'适用盈利公司':'有效价格样本'}的中间水平，共{prepared.benchmarks[c.benchmark].count}只有效样本。{c.benchmark==='pe'?'用于初筛，不代表公允价值。':'只比较历史表现，不预测未来。'}</p>}
    {c.profitGate&&<p className="indicator-basis">这项PE比较还要求近两年、本期及上年同期归母净利润均为正。</p>}
    {editing&&<div className="numeric-edit"><select aria-label={`${SCREEN_FIELDS[c.field].short}比较方式`} value={c.op} onChange={e=>update(c.id,{op:e.target.value as Operator})}>{Object.entries(OP).map(([op,label])=><option key={op} value={op}>{label}</option>)}</select><input aria-label={`${SCREEN_FIELDS[c.field].short}阈值`} type="number" step="any" value={c.value??''} onChange={e=>update(c.id,{value:e.target.value===''?null:Number(e.target.value),benchmark:undefined,percentile:undefined})}/><span>{SCREEN_FIELDS[c.field].unit}</span><button aria-label={`移除${SCREEN_FIELDS[c.field].short}`} disabled={prepared.conditions.length===1} onClick={()=>onChange(prepared.conditions.filter(x=>x.id!==c.id))}><X size={16}/></button></div>}
   </div>)}{knowledge&&<p className="group-limit">{knowledge.boundary}</p>}</div>
  </article>)}
  {errors.length>0&&<p role="alert" className="error-inline">{errors.join(' ')}</p>}
  {prepared.conditions.some(c=>c.value===null)&&<p className="caution">部分参考线无法取得。选股时会保留“无法判断”，不会补成正常数值。</p>}
  <div className="review-actions"><button className="text-button" onClick={()=>setEditing(!editing)}><SlidersHorizontal size={15}/>{editing?'收起条件编辑':'调整条件'}</button><div><button className="secondary" onClick={onBack}>修改想法</button><button className="primary" disabled={errors.length>0||prepared.conditions.some(c=>c.value===null&&!c.benchmark)} onClick={onExecute}>按这些条件选股 <ArrowRight size={16}/></button></div></div>
  <p className="review-note">所有条件需同时满足。选股时使用上面这份数据和条件，不会重新改写你的要求。</p>
 </section>;
}
