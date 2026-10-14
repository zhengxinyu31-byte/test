import { calculateRisk, calculateYoY, unknownMetric } from './engine.ts';
import type { Dataset, Evidence, Metric, PricePoint, Report, Stock } from './types.ts';

type Row = Record<string, unknown>;
type Envelope = { code: number; request_id: string; data: Record<string, unknown>; message?: string };
type Meta = { requestId:string; retrievedAt:string; sourceTime:string|null };
const BASE='https://fuyao.aicubes.cn';
export const REPORTS:Record<Report,{label:string;year:number;quarter:string;end:string}>={
  '2026H1':{label:'2026 年中报',year:2026,quarter:'Q2',end:'2026-06-30'},
  '2025FY':{label:'2025 年报',year:2025,quarter:'Q4',end:'2025-12-31'},
};
export function shanghaiDay(time:number|string|Date):string {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));}
function iso(value:unknown):string|null {return typeof value==='number'&&Number.isFinite(value)&&value>0?new Date(value).toISOString():null;}
function num(v:unknown):number|null {return typeof v==='number'&&Number.isFinite(v)?v:null;}
function rows(d:Record<string,unknown>):Row[]{return Array.isArray(d.item)?d.item.filter(x=>x&&typeof x==='object'):[];}
export async function fetchFuyao(path:string,key:string,fetcher:typeof fetch=fetch):Promise<{data:Record<string,unknown>;meta:Meta}> {
  if(!key)throw new Error('服务端尚未配置扶摇数据凭据。');
  for(let attempt=0;attempt<2;attempt++) {
    let response:Response;
    try{response=await fetcher(BASE+path,{headers:{'X-api-key':key},signal:AbortSignal.timeout(12000)});}catch{throw new Error('扶摇接口连接失败或超时。');}
    if(response.status===429&&attempt===0){const pause=Math.min(3,Math.max(1,Number(response.headers.get('retry-after'))||1));await new Promise(r=>setTimeout(r,pause*1000));continue;}
    if(!response.ok)throw new Error(`扶摇接口 HTTP ${response.status}，未使用替代数据。`);
    let body:Envelope;try{body=await response.json() as Envelope;}catch{throw new Error('扶摇接口返回了不可解析的数据。');}
    if(body.code===4001&&attempt===0){await new Promise(r=>setTimeout(r,1000));continue;}
    if(body.code!==0)throw new Error(`扶摇接口业务错误 ${body.code ?? '未知'}（追踪 ${body.request_id??'不可用'}）。`);
    if(!body.data||typeof body.data!=='object'||!body.request_id)throw new Error('扶摇数据响应缺少结果或请求追踪标识。');
    return {data:body.data,meta:{requestId:body.request_id,retrievedAt:new Date().toISOString(),sourceTime:iso(body.data.timestamp)}};
  }
  throw new Error('扶摇请求受到限流，请稍后重试。');
}
export function financialMetrics(items:Row[],report:Report,meta:Meta):{revenue:Metric;profit:Metric} {
  const r=REPORTS[report];
  const matches=(year:number)=>items.filter(x=>x.fiscal_year===year&&(x.fiscal_period===r.quarter||(r.quarter==='Q4'&&x.fiscal_period==='FY')));
  const a=matches(r.year),b=matches(r.year-1);const current=a[0],previous=b[0];
  const build=(field:string):Metric=>{
    let m:Metric;
    const timeValid=(x:Row|undefined)=>!!x&&typeof x.report_date_ms==='number'&&x.report_date_ms>0&&x.report_date_ms<=Date.parse(meta.retrievedAt);
    const periodValid=(x:Row|undefined,year:number)=>!!x&&typeof x.period_end_ms==='number'&&shanghaiDay(x.period_end_ms)===`${year}${r.end.slice(4)}`;
    if(a.length!==1||b.length!==1)m=unknownMetric('缺少唯一的本期或上年同期报表，无法同口径比较。');
    else if(!timeValid(current)||!timeValid(previous))m=unknownMetric('报表披露日期缺失或晚于获取时间，不能作为已知事实。');
    else if(!periodValid(current,r.year)||!periodValid(previous,r.year-1))m=unknownMetric('报表期末日期与指定累计报告期不匹配。');
    else if(current.currency!=='CNY'||previous.currency!=='CNY')m=unknownMetric('财报币种缺失或不一致。');
    else m=calculateYoY(num(current[field]),num(previous[field]));
    m.evidence=[{source:'扶摇金融数据',endpoint:'/api/a-share/financials/income-statements',field,requestId:meta.requestId,retrievedAt:meta.retrievedAt,sourceTime:meta.sourceTime,period:`${r.label} / ${r.year-1} 年同期`,publishedAt:iso(current?.report_date_ms),raw:{current:current?{value:current[field]??null,period_end_ms:current.period_end_ms,report_date_ms:current.report_date_ms,currency:current.currency}:null,previous:previous?{value:previous[field]??null,period_end_ms:previous.period_end_ms,report_date_ms:previous.report_date_ms,currency:previous.currency}:null},formula:'(本期累计值 − 上年同期累计值) ÷ 上年同期累计值 × 100%',note:'原始金额单位为人民币元。使用当前接口提供的同口径比较数；不声明这是历史时点可见版本，不能用于历史策略回测。'}];
    return m;
  };
  return {revenue:build('operating_income'),profit:build('parent_holder_net_profit')};
}
async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]> {
  const result:R[]=new Array(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;result[i]=await fn(items[i]);}}));return result;
}
export async function buildDataset(key:string,report:Report,fetcher:typeof fetch=fetch):Promise<Dataset> {
  const fetchStartedAt=new Date().toISOString();
  const get=(path:string)=>fetchFuyao(path,key,fetcher);
  const [u,calendar]=await Promise.all([get('/api/a-share-index/constituents/ths-stock-list?thscode=000016.SH'),get('/api/a-share/calendar/trading-days')]);
  const members=rows(u.data).filter(x=>typeof x.thscode==='string'&&/^\d{6}\.SH$/.test(x.thscode));
  if(members.length!==50||new Set(members.map(x=>x.thscode)).size!==members.length)throw new Error('上证 50 成分股清单不足 50 只、重复或异常，无法可靠筛选。');
  const now=new Date(),today=shanghaiDay(now);
  const calendarTime=calendar.meta.sourceTime?Date.parse(calendar.meta.sourceTime):NaN;
  if(!Number.isFinite(calendarTime)||shanghaiDay(calendarTime)!==today||calendarTime>now.getTime()+60000)throw new Error('交易日历来源时间缺失、过期或异常，不能确认当前交易窗口。');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
  const tradingDays=rows(calendar.data).map(x=>typeof x.date==='string'&&/^\d{8}$/.test(x.date)?`${x.date.slice(0,4)}-${x.date.slice(4,6)}-${x.date.slice(6,8)}`:'').filter(d=>d&&(d<today||(d===today&&hour>=16))).sort();
  const expected=[...new Set(tradingDays)].slice(-61);
  if(expected.length!==61)throw new Error('交易日历不足以构造 60 个完整交易日收益窗口。');
  const end=expected[60],start=expected[0],issues:string[]=[];
  if(now.getTime()-Date.parse(end+'T16:00:00+08:00')>14*86400000)throw new Error('交易日历覆盖范围过期，未使用旧行情作为当前结果。');
  if(members.length!==50)issues.push(`供应商当前返回 ${members.length} 只成分股，与通常的 50 只不一致，请核对股票池。`);
  let valuation:Awaited<ReturnType<typeof fetchFuyao>>|null=null;
  try{valuation=await get('/api/a-share/valuations/snapshot?'+new URLSearchParams({thscodes:members.map(x=>x.thscode).join(',')}));}catch(e){issues.push((e as Error).message);}
  const peMap=new Map(rows(valuation?.data??{}).map(x=>[x.thscode,x]));
  const stocks=await mapLimit(members,2,async(member):Promise<Stock>=>{
    const code=String(member.thscode),name=String(member.name??code);
    let revenue=unknownMetric('财务数据不可用。'),profit=unknownMetric('财务数据不可用。');
    let volatility=unknownMetric('价格数据不可用。'),drawdown=unknownMetric('价格数据不可用。');
    let prices:PricePoint[]=[];
    // Sequential per security: at most two upstream requests globally.
    try{const f=await get('/api/a-share/financials/income-statements?'+new URLSearchParams({thscode:code,period:'quarterly',limit:'12'}));({revenue,profit}=financialMetrics(rows(f.data),report,f.meta));}catch(e){revenue=unknownMetric((e as Error).message,'%','unavailable');profit={...revenue};}
    try{
      const path='/api/a-share/prices/historical?'+new URLSearchParams({thscode:code,interval:'1d',adjust:'forward',start:String(Date.parse(start+'T00:00:00+08:00')),end:String(Date.parse(end+'T23:59:59+08:00'))});
      const p=await get(path);
      prices=rows(p.data).filter(x=>typeof x.date_ms==='number').map(x=>({date:shanghaiDay(x.date_ms as number),close:num(x.close_price)??NaN,volume:num(x.volume)??NaN}));
      ({volatility,drawdown}=calculateRisk(prices,expected));
      const proof:Evidence={source:'扶摇金融数据',endpoint:'/api/a-share/prices/historical',field:'close_price / volume / date_ms',requestId:p.meta.requestId,retrievedAt:p.meta.retrievedAt,sourceTime:p.meta.sourceTime,period:`${start} 至 ${end}`,raw:prices.map(x=>({date:x.date,close:Number.isFinite(x.close)?x.close:null,volume:Number.isFinite(x.volume)?x.volume:null})),note:'前复权日收盘价。仅取已完成交易日，窗口内缺失、重复或无成交时不补值。'};
      volatility.evidence=[{...proof,formula:'样本标准差(log(Pt / Pt−1)，ddof=1) × √252 × 100%；n=60'}];
      drawdown.evidence=[{...proof,formula:'max[(截至当日历史最高收盘价 − 当日收盘价) / 截至当日历史最高收盘价] × 100%'}];
      prices=prices.filter(p=>Number.isFinite(p.close)&&Number.isFinite(p.volume)).sort((a,b)=>a.date.localeCompare(b.date));
    }catch(e){volatility=unknownMetric((e as Error).message,'%','unavailable');drawdown={...volatility};}
    const rawPe=peMap.get(code)?.pe_ttm,peValue=num(rawPe);
    let pe:Metric={value:peValue,unit:'倍',quality:peValue!==null&&peValue>0?'ok':'invalid',issue:peValue==null?'估值字段缺失。':peValue<=0?'PE 非正，不适用于常规倍数比较。':undefined,evidence:[]};
    if(!valuation)pe=unknownMetric('估值接口调用失败。','倍','unavailable');
    else {
      if(!valuation.meta.sourceTime){pe.quality='missing';pe.issue='估值元数据时间缺失，无法确认时效。';}
      else if(Date.parse(valuation.meta.sourceTime)>Date.parse(valuation.meta.retrievedAt)+60000){pe.quality='invalid';pe.issue='估值来源时间晚于获取时间，无法确认时效。';}
      else if(shanghaiDay(valuation.meta.sourceTime)<end){pe.quality='stale';pe.issue='估值元数据早于本次价格窗口结束日，需重新核实。';}
      pe.evidence=[{source:'扶摇金融数据',endpoint:'/api/a-share/valuations/snapshot',field:'pe_ttm',requestId:valuation.meta.requestId,retrievedAt:valuation.meta.retrievedAt,sourceTime:valuation.meta.sourceTime,raw:rawPe??null,note:'倍；TTM 使用最近连续 12 个月财务数据。来源时间为响应元数据的最大有效时间，不保证所有字段同一时刻更新。跨行业 PE 不代表公允价值。'}];
    }
    return {code,name,metrics:{revenue,profit,pe,volatility,drawdown},prices};
  });
  if(stocks.every(s=>Object.values(s.metrics).every(m=>m.quality!=='ok')))throw new Error('所有证券均无可验证指标，本次未生成正常筛选结果。');
  const incomplete=stocks.filter(s=>Object.values(s.metrics).some(m=>m.quality!=='ok')).length;
  if(incomplete)issues.push(`${incomplete} 只股票至少有一个缺失、不适用或异常指标；是否能够判断取决于所选条件。`);
  return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),fetchStartedAt,report,tradeDate:end,windowStart:start,universe:{name:'上证 50',code:'000016.SH',count:members.length,sourceTime:u.meta.sourceTime,requestId:u.meta.requestId},stocks,issues,source:'扶摇金融数据'};
}
const memory=new Map<Report,Dataset>(),pending=new Map<Report,Promise<Dataset>>();
export async function getDataset(key:string,report:Report,refresh=false):Promise<Dataset> {
  let cached=memory.get(report);
  // Namespaced Workers disable caches.default. Cache availability must not
  // determine whether fresh, verified financial data can be returned.
  let edge:Cache|undefined;
  try{edge=await globalThis.caches?.open('stock-intent-v4');}catch{ /* memory cache remains available */ }
  const cacheKey=new Request(`https://stock-intent-cache.internal/v4/${report}`);
  if(!cached&&edge){try{const r=await edge.match(cacheKey);if(r)cached=await r.json() as Dataset;}catch{ /* fetch fresh data on cache failure */ }}
  const age=cached?Date.now()-Date.parse(cached.createdAt):Infinity;
  if(cached&&age<(refresh?60000:900000)){memory.set(report,cached);return cached;}
  if(pending.has(report))return pending.get(report)!;
  const run=buildDataset(key,report).then(async data=>{memory.set(report,data);if(edge){try{await edge.put(cacheKey,Response.json(data,{headers:{'Cache-Control':'public, max-age=900'}}));}catch{ /* a failed cache write does not invalidate verified data */ }}return data;}).finally(()=>pending.delete(report));
  pending.set(report,run);return run;
}
