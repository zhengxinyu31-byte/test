import fs from 'node:fs';
import {interpret} from '../lib/stock/intent.ts';
import {DEFAULT_CONDITIONS} from '../lib/stock/engine.ts';
process.loadEnvFile('.dev.vars');
const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await original(...args);if(String(args[0]).includes('openrouter.ai')){const body=await r.clone().json();console.log(JSON.stringify({model:body.model,finish:body.choices?.[0]?.finish_reason,content:body.choices?.[0]?.message?.content,usage:body.usage,error:body.error}));}return r;};
for(const query of ['营收同比大于0，归母净利润同比大于0，PE不超过20','不要归母净利润下降的公司，PE小于20']){try{console.log('RESULT',await interpret(query,'2026H1',process.env.OPENROUTER_API_KEY,process.env.LLM_MODEL));}catch(e){console.log('validation:',e.message);}}
