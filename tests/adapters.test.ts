import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset, fetchFuyao, financialMetrics, shanghaiDay } from '../lib/stock/data.ts';
import { boundaryCheck, validateInterpretation } from '../lib/stock/intent.ts';

test('HTTP 200 with business failure is an error',async()=>{
  const f=(async()=>Response.json({code:2001,message:'invalid key'})) as typeof fetch;
  await assert.rejects(()=>fetchFuyao('/api/test','test-key',f),/2001/);
});
test('successful response requires a data envelope and request ID',async()=>{
  const f=(async()=>Response.json({code:0,data:null})) as typeof fetch;
  await assert.rejects(()=>fetchFuyao('/api/test','test-key',f));
});
test('financial years must match; parent profit is never substituted with total profit',()=>{
  const rows=[{fiscal_year:2026,fiscal_period:'Q2',currency:'CNY',period_end_ms:1782748800000,report_date_ms:1786723200000,operating_income:120,parent_holder_net_profit:90,net_profit:999},{fiscal_year:2025,fiscal_period:'Q2',currency:'CNY',period_end_ms:1751212800000,report_date_ms:1755216000000,operating_income:100,parent_holder_net_profit:100}];
  const r=financialMetrics(rows,'2026H1',{requestId:'r',retrievedAt:'2026-10-14T10:00:00Z',sourceTime:null});
  assert.equal(r.revenue.value,20);assert.equal(r.profit.value,-10);
  assert.equal(financialMetrics(rows.slice(0,1),'2026H1',{requestId:'r',retrievedAt:'2026-10-14T10:00:00Z',sourceTime:null}).revenue.value,null);
});
test('a future disclosure must not be used as known data',()=>{
  const rows=[{fiscal_year:2026,fiscal_period:'Q2',currency:'CNY',period_end_ms:1782748800000,report_date_ms:1999999999999,operating_income:120},{fiscal_year:2025,fiscal_period:'Q2',currency:'CNY',period_end_ms:1751212800000,report_date_ms:1755216000000,operating_income:100}];
  assert.equal(financialMetrics(rows,'2026H1',{requestId:'r',retrievedAt:'2026-10-14T10:00:00Z',sourceTime:null}).revenue.value,null);
});
test('trading dates are derived in Asia/Shanghai',()=>assert.equal(shanghaiDay(1791907200000),'2026-10-14'));
test('unsupported OR is never silently compiled into AND',()=>assert.equal(boundaryCheck('营收增长或利润增长')?.status,'unsupported'));
test('buy instructions yield a boundary notice, not stock picks',()=>assert.equal(boundaryCheck('明天必涨的股票买什么')?.status,'unsupported'));
const result={status:'ready',conditions:[{field:'pe',op:'<',value:20,sourceText:'PE小于20'}],questions:[],unsupported:[],notices:[],report:'2026H1'};
test('exact numeric instructions survive structured output validation',()=>{
  const r=validateInterpretation(result,'PE小于20','mock-model','2026H1');
  assert.equal(r.conditions[0].value,20);assert.equal(r.conditions[0].op,'<');
  assert.throws(()=>validateInterpretation({...result,conditions:[{...result.conditions[0],value:25}]},'PE小于20','mock-model','2026H1'),/阈值/);
});
test('invented metrics and model advice are rejected',()=>{
  assert.throws(()=>validateInterpretation({...result,conditions:[{field:'future_return',op:'>',value:10}]},'收益','mock','2026H1'));
  assert.throws(()=>validateInterpretation({...result,notices:['建议买入此股票']},'PE小于20','mock','2026H1'));
});
test('incomplete universe must not masquerade as all SSE50',async()=>{const f=(async(input)=>Response.json({code:0,request_id:'test',data:{item:String(input).includes('constituents')?[{thscode:'600000.SH',name:'test'}]:[]}})) as typeof fetch;await assert.rejects(()=>buildDataset('test','2026H1',f),/50/);});
test('authentication and transport failures remain errors',async()=>{await assert.rejects(()=>fetchFuyao('/test','test',(async()=>new Response('',{status:401})) as typeof fetch),/401/);await assert.rejects(()=>fetchFuyao('/test','test',(async()=>{throw new Error('timeout');}) as typeof fetch),/超时/);});
test('fiscal label cannot override a mismatched period end',()=>{const items=[{fiscal_year:2026,fiscal_period:'Q2',currency:'CNY',period_end_ms:Date.parse('2026-03-31T00:00:00+08:00'),report_date_ms:1787932800000,operating_income:120},{fiscal_year:2025,fiscal_period:'Q2',currency:'CNY',period_end_ms:1751212800000,report_date_ms:1787932800000,operating_income:100}];assert.equal(financialMetrics(items,'2026H1',{requestId:'test',retrievedAt:'2026-10-14T10:00:00Z',sourceTime:null}).revenue.value,null);});
