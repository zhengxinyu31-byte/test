import { FIELDS } from './engine.ts';
import { buildBenchmarks,evaluateScreen,validateScreenConditions } from './screen-policy.ts';
import type { ScreenRun } from './screen-types.ts';
export const STORAGE_KEY='stock-intent-v5-saved';
export function readSaved(raw:string|null):ScreenRun[]{try{const parsed=JSON.parse(raw??'[]');if(!Array.isArray(parsed))return [];return parsed.slice(0,5).filter((r:ScreenRun)=>{try{
 if(r?.version!==5||typeof r.plan?.query!=='string'||!['2026H1','2025FY'].includes(r.plan.report)||!Array.isArray(r.history)||!r.history.every(x=>typeof x==='string')||!r.dataset?.id||!Array.isArray(r.dataset.stocks)||r.dataset.stocks.length!==r.dataset.universe?.count||!Array.isArray(r.plan.goals)||!Array.isArray(r.plan.constraints)||!Array.isArray(r.conditions)||validateScreenConditions(r.conditions).length)return false;
 if(r.dataset.stocks.some(s=>typeof s.code!=='string'||typeof s.name!=='string'||!Array.isArray(s.prices)||!Object.keys(FIELDS).every(f=>{const m=s.metrics?.[f as keyof typeof FIELDS];return m&&Array.isArray(m.evidence)&&m.evidence.every(e=>e&&typeof e==='object'&&typeof e.field==='string')&&(m.value===null||Number.isFinite(m.value));})||(s.profitHistory!==undefined&&(!Array.isArray(s.profitHistory)||s.profitHistory.some(h=>!h||typeof h.period!=='string'||!h.evidence||(h.value!==null&&!Number.isFinite(h.value)))))))return false;
 r.benchmarks=buildBenchmarks(r.dataset);r.evaluations=evaluateScreen(r.dataset,r.conditions);return true;
 }catch{return false;}});}catch{return [];}}
