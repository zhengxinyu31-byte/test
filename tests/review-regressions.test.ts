import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInterpretation} from '../lib/stock/intent.ts';
import {DEFAULT_CONDITIONS,unknownMetric} from '../lib/stock/engine.ts';
import {buildDataset} from '../lib/stock/data.ts';
import * as workspace from '../lib/stock/workspace.ts';
const {parseSavedRuns}=workspace;
const mergeInterpretation=(...args:Parameters<typeof workspace.mergeInterpretation>)=>workspace.mergeInterpretation(...args);
import type {Interpretation} from '../lib/stock/types.ts';
const raw={status:'ready',conditions:[],operations:[],questions:[],unsupported:[],notices:[]};
const pe={field:'pe',op:'<=',value:25,sourceText:'PE'};
test('review: PE-only request cannot modify profit or remove another condition',()=>{
 for(const operations of [[{type:'update',id:'profit',value:20}],[{type:'update',id:'pe',value:20},{type:'remove',id:'profit'}]])assert.throws(()=>validateInterpretation({...raw,operations},'把PE上限改成20，其他不变','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:1}));
});
test('review: ambiguous duplicate PE targets require clarification',()=>{assert.throws(()=>validateInterpretation({...raw,operations:[{type:'update',id:'a',value:20}]},'把PE改成20','test','2026H1',{mode:'modify',current:[{...pe,id:'a'},{...pe,id:'b',op:'>',value:10}] as never,revision:1}));});
test('review: modification must preserve explicit replacement number',()=>{assert.throws(()=>validateInterpretation({...raw,operations:[{type:'update',id:'pe',value:21}]},'把PE上限改成20，其他不变','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:1}));});
test('review: Unicode comparison and full-width digits preserve explicit bounds',()=>{for(const q of ['PE≤20','PE不超过２０'])assert.throws(()=>validateInterpretation({...raw,conditions:[pe]},q,'test','2026H1'));});
test('review: revenue decline and profit growth can coexist',()=>{assert.doesNotThrow(()=>validateInterpretation({...raw,conditions:[{field:'revenue',op:'<',value:0,sourceText:'营收同比下降'},{field:'profit',op:'>',value:10,sourceText:'归母净利润同比大于10'}]},'营收同比下降，归母净利润同比大于10','test','2026H1'));});
test('review: stale calendar cannot make 2024 prices current in 2026',async()=>{
 const days=Array.from({length:61},(_,i)=>new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10).replaceAll('-',''));
 const f=(async(input)=>{const url=String(input);return Response.json({code:0,request_id:'fixture',data:{timestamp:Date.parse('2024-03-25T10:00:00Z'),item:url.includes('constituents')?Array.from({length:50},(_,i)=>({thscode:`${600000+i}.SH`,name:'测试'})):url.includes('calendar')?days.map(date=>({date})):[]}});}) as typeof fetch;
 await assert.rejects(()=>buildDataset('test','2026H1',f),/日历.*(?:过期|覆盖|时间)/);
});
test('review: follow-up preserves unresolved requirements and explicit omissions',()=>{
 const before={...raw,report:'2026H1',model:'test',status:'clarify',unsupported:['ROE未支持'],unresolved:['valuation'],questions:['估值需澄清']} as Interpretation;
 const after={...raw,report:'2026H1',model:'test',status:'ready'} as Interpretation;
 const merged=mergeInterpretation(before,after,'modify',['ROE未支持'],true);
 assert.deepEqual(merged.interpretation.unsupported,['ROE未支持']);assert.equal(merged.valuationPending,true);assert.deepEqual(merged.omitted,['ROE未支持']);
 assert.equal(mergeInterpretation(before,after,'new',['ROE未支持'],true).valuationPending,false);
});
const saved=()=>({version:2,id:'saved',name:'test',savedAt:'2026-10-14T10:00:00Z',run:{executedAt:'2026-10-14T10:00:00Z',strategy:{id:'s',version:1,intent:'test',report:'2026H1',conditions:[DEFAULT_CONDITIONS[2]],mappings:[],omittedRequirements:[],confirmedAt:'2026-10-14T10:00:00Z',model:'manual'},dataset:{id:'d',createdAt:'2026-10-14T10:00:00Z',report:'2026H1',tradeDate:'2026-10-14',windowStart:'2026-07-01',source:'扶摇金融数据',universe:{name:'上证50',code:'000016.SH',count:1,requestId:'r',sourceTime:null},issues:[] as unknown[],stocks:[{code:'600000.SH',name:'测试',prices:[],metrics:Object.fromEntries(['revenue','profit','pe','volatility','drawdown'].map(f=>[f,{...unknownMetric('test',f==='pe'?'倍':'%'),value:10,quality:'ok'}]))}]}}});
test('review: corrupt nested issues and evidence are rejected before rendering',()=>{const a=saved();a.run.dataset.issues=[{broken:'object'}];assert.throws(()=>parseSavedRuns(JSON.stringify([a])));const b=saved();b.run.dataset.stocks[0].metrics.pe.evidence=[null] as never;assert.throws(()=>parseSavedRuns(JSON.stringify([b])));});
