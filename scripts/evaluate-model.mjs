import fs from 'node:fs';
import {interpret} from '../lib/stock/intent.ts';
import {DEFAULT_CONDITIONS,validateConditions} from '../lib/stock/engine.ts';
process.loadEnvFile('.dev.vars');
const output=process.argv[2]??'outputs/model-evaluation.json';
const selectedModel=process.argv[3]??process.env.LLM_MODEL;
let actualModel;let requestId;const realFetch=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await realFetch(...args);if(String(args[0]).includes('openrouter.ai')&&response.ok){const body=await response.clone().json();actualModel=body.model;requestId=body.id;}return response;};
const cases=[
 {id:'fuzzy',query:'经营改善、估值合理、走势相对稳定',check:r=>r.status==='clarify'&&r.unresolved?.includes('valuation')&&!r.conditions.some(c=>c.field==='pe')},
 {id:'precise',query:'营收同比大于0，归母净利润同比大于0，PE不超过20',check:r=>r.conditions.some(c=>c.field==='pe'&&c.op==='<='&&c.value===20)},
 {id:'negative',query:'不要归母净利润下降的公司，PE小于20',check:r=>r.conditions.some(c=>c.field==='profit'&&['>','>='].includes(c.op)&&c.value===0)&&r.conditions.some(c=>c.field==='pe'&&c.op==='<'&&c.value===20)},
 {id:'patch',query:'把PE上限改成20，其他不变',mode:'modify',check:r=>r.conditions.length===4&&r.conditions[2].value===20&&r.conditions[0].id==='revenue'&&r.conditions[3].value===30},
 {id:'conflict',query:'PE大于30，同时PE小于15',check:r=>validateConditions(r.conditions).some(x=>x.includes('冲突'))},
 {id:'inapplicable',query:'银行估值合理，同时资产质量改善',check:r=>r.status==='unsupported'&&r.unsupported.length>0&&!r.conditions.some(c=>c.field==='pe')},
];
cases.push({...cases[2],id:'negative-repeat'},{...cases[3],id:'patch-repeat'});
fs.mkdirSync('outputs',{recursive:true});const records=[];
for(const c of cases){const started=new Date().toISOString();actualModel=undefined;requestId=undefined;let record;
try{const r=await interpret(c.query,'2026H1',process.env.OPENROUTER_API_KEY,selectedModel, c.mode?DEFAULT_CONDITIONS:[],c.mode??'new',3);record={id:c.id,input:c.query,started,elapsedMs:Date.now()-Date.parse(started),passed:!!c.check(r),actual:r};}catch(e){record={id:c.id,input:c.query,started,elapsedMs:Date.now()-Date.parse(started),passed:false,error:e.message,model:actualModel,requestId};}
records.push(record);fs.writeFileSync(output,JSON.stringify(records,null,2));console.log(JSON.stringify({id:record.id,passed:record.passed,model:record.actual?.model,error:record.error,elapsedMs:record.elapsedMs}));}
console.log('complete',records.filter(x=>x.passed).length,'/',records.length);
