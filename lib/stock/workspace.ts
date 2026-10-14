import { evaluate, FIELDS, validateConditions } from './engine.ts';
import type { Interpretation, SavedRun } from './types.ts';
export const STORAGE_KEY='stock-intent-runs-v2';
export function canApplyResponse(base:number,current:number){return base===current;}
export function mergeInterpretation(before:Interpretation|null,next:Interpretation,mode:'new'|'modify',omitted:string[],pending:boolean){
 if(mode==='new')return {interpretation:next,omitted:[],valuationPending:next.unresolved?.includes('valuation')??false};
 const unsupported=[...new Set([...(before?.unsupported??[]),...next.unsupported])];
 const questions=[...new Set([...(before?.questions??[]),...next.questions])];
 const valuationPending=pending||(next.unresolved?.includes('valuation')??false);
 return {interpretation:{...next,unsupported,questions,requestedReport:next.requestedReport??before?.requestedReport,unresolved:valuationPending?['valuation']:[]},omitted:[...omitted],valuationPending};
}
export function parseSavedRuns(text:string|null):SavedRun[]{
 if(!text)return [];
 const values=JSON.parse(text);
 if(!Array.isArray(values)||values.length>5)throw new Error('本地记录格式不兼容。');
 for(const v of values){
  const r=v?.run,s=r?.strategy,d=r?.dataset;
  if(v?.version!==2||typeof v.id!=='string'||typeof v.name!=='string'||!s||typeof s.intent!=='string'||!['2026H1','2025FY'].includes(s.report)||!Array.isArray(s.conditions)||!s.conditions.length||validateConditions(s.conditions).length||!Array.isArray(s.mappings)||!Array.isArray(s.omittedRequirements)||!d||typeof d.id!=='string'||!Array.isArray(d.stocks)||!d.stocks.length||d.stocks.length>100||!Array.isArray(d.issues)||d.report!==s.report||!d.universe)throw new Error('本地记录损坏或版本不兼容，未恢复。');
  if(d.issues.some((x:unknown)=>typeof x!=='string')||s.omittedRequirements.some((x:unknown)=>typeof x!=='string')||s.conditions.some((x:{sourceText:unknown})=>typeof x.sourceText!=='string')||typeof d.tradeDate!=='string'||typeof d.windowStart!=='string'||!Number.isFinite(Date.parse(d.createdAt)))throw new Error('本地记录包含损坏字段，未恢复。');
  if(typeof s.id!=='string'||!Number.isSafeInteger(s.version)||typeof v.savedAt!=='string'||['name','code','requestId'].some(k=>typeof d.universe[k]!=='string')||d.universe.count!==d.stocks.length||(d.universe.sourceTime!=null&&typeof d.universe.sourceTime!=='string'))throw new Error('保存记录中的策略或股票池无效。');
  for(const stock of d.stocks){if(typeof stock?.code!=='string'||typeof stock.name!=='string'||!Array.isArray(stock.prices)||!stock.metrics)throw new Error('股票记录不完整。');for(const f of Object.keys(FIELDS)){const m=stock.metrics[f];if(!m||!['ok','missing','invalid','stale','unavailable'].includes(m.quality)||!Array.isArray(m.evidence)||(m.value!==null&&(typeof m.value!=='number'||!Number.isFinite(m.value)))||m.unit!==(f==='pe'?'倍':'%')||(m.issue!==undefined&&typeof m.issue!=='string'))throw new Error('指标记录不完整。');for(const e of m.evidence){if(!e||['source','endpoint','field','requestId','retrievedAt'].some(k=>typeof e[k]!=='string')||['sourceTime','period','publishedAt','formula','note'].some(k=>e[k]!=null&&typeof e[k]!=='string'))throw new Error('原始证据记录损坏，未恢复。');}}}
  // Recompute decisions from the saved conditions; do not trust persisted verdicts.
  r.evaluations=evaluate(d.stocks,s.conditions);
 }
 return values;
}
export function addSavedRun(existing:SavedRun[],entry:SavedRun):SavedRun[]{return [entry,...existing.filter(x=>x.id!==entry.id)].slice(0,5);}
