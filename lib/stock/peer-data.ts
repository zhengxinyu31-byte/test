import type { Evidence } from './types.ts';
type Row=Record<string,unknown>;type Meta={requestId:string;retrievedAt:string;sourceTime:string|null};
export interface ProfitPeriod {period:string;value:number|null;issue?:string;evidence:Evidence}
export function selectPeerMembers(parent:Row[],parts:Row[]):Row[]{
 const valid=(a:Row[])=>a.length>0&&a.every(x=>typeof x.thscode==='string'&&/^\d{6}\.(SH|SZ|BJ)$/.test(x.thscode))&&new Set(a.map(x=>x.thscode)).size===a.length;
 if(!valid(parent)||(parts.length&&!valid(parts)))throw new Error('观察组名单缺失、重复或代码无效。');
 const all=new Set(parent.map(x=>x.thscode)),excluded=new Set(parts.map(x=>x.thscode));
 if(parts.some(x=>!all.has(x.thscode)))throw new Error('零部件名单与白色家电名单不一致，暂不生成观察组。');
 const selected=parent.filter(x=>!excluded.has(x.thscode));if(!selected.length)throw new Error('观察组为空，未生成筛选结果。');return selected;
}
export function profitHistory(rows:Row[],meta:Meta):ProfitPeriod[]{
 return [{year:2024,q:'Q4',suffix:'FY',end:'12-31'},{year:2025,q:'Q4',suffix:'FY',end:'12-31'},{year:2025,q:'Q2',suffix:'H1',end:'06-30'},{year:2026,q:'Q2',suffix:'H1',end:'06-30'}].map(p=>{
 const found=rows.filter(x=>x.fiscal_year===p.year&&(x.fiscal_period===p.q||(p.q==='Q4'&&x.fiscal_period==='FY'))),r=found[0];let issue:string|undefined;
 if(found.length!==1)issue='报表缺失或重复。';
 else if(r.currency!=='CNY'||typeof r.parent_holder_net_profit!=='number'||!Number.isFinite(r.parent_holder_net_profit))issue='利润原值或币种缺失。';
 else if(typeof r.report_date_ms!=='number'||r.report_date_ms<=0||r.report_date_ms>Date.parse(meta.retrievedAt))issue='披露日期缺失或在未来。';
 else if(typeof r.period_end_ms!=='number'||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.period_end_ms))!==`${p.year}-${p.end}`)issue='报告期末不匹配。';
 return {period:`${p.year}${p.suffix}`,value:issue?null:r.parent_holder_net_profit as number,issue,evidence:{source:'扶摇金融数据',endpoint:'/api/a-share/financials/income-statements',field:'parent_holder_net_profit',requestId:meta.requestId,retrievedAt:meta.retrievedAt,sourceTime:meta.sourceTime,period:`${p.year}${p.suffix}`,raw:r?{value:r.parent_holder_net_profit??null,currency:r.currency,period_end_ms:r.period_end_ms,report_date_ms:r.report_date_ms}:null,note:'归属于母公司股东的累计净利润，人民币元。'}};
 });
}
