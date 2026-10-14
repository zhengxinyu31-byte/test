import test from 'node:test';
import assert from 'node:assert/strict';
import {getDataset,shanghaiDay} from '../lib/stock/data.ts';

test('production: disabled default cache uses an isolated named cache',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const saved={id:'cached-fixture',createdAt:new Date().toISOString(),report:'2025FY'};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{get default(){throw new Error('This Worker is not permitted to access the default cache.');},open:async()=>({match:async()=>Response.json(saved)})}});
 try{assert.equal((await getDataset('test','2025FY')).id,saved.id);}finally{if(prior)Object.defineProperty(globalThis,'caches',prior);else Reflect.deleteProperty(globalThis,'caches');}
});

test('production: cache unavailable must not hide a real data error',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'caches'),fetch=globalThis.fetch;
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{get default(){throw new Error('cache denied');},open:async()=>{throw new Error('cache denied');}}});
 globalThis.fetch=async()=>Response.json({code:0,request_id:'fixture',data:{timestamp:Date.now(),item:[]}});
 try{await assert.rejects(()=>getDataset('test','2026H1'),/上证 50 成分股/);}finally{globalThis.fetch=fetch;if(prior)Object.defineProperty(globalThis,'caches',prior);else Reflect.deleteProperty(globalThis,'caches');}
});

test('production: cache write failure still returns freshly verified data',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'caches'),fetch=globalThis.fetch;
 const denied={match:async()=>undefined,put:async()=>{throw new Error('cache write denied');}};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:denied,open:async()=>denied}});
 const members=Array.from({length:50},(_,i)=>({thscode:`${600000+i}.SH`,name:'构造样例',pe_ttm:20}));
 const days=Array.from({length:70},(_,i)=>({date:shanghaiDay(Date.now()-(70-i)*86400000).replaceAll('-','')}));
 globalThis.fetch=async(input)=>Response.json({code:0,request_id:'fixture',data:{timestamp:Date.now(),item:String(input).includes('constituents')||String(input).includes('valuations')?members:String(input).includes('calendar')?days:[]}});
 try{const data=await getDataset('test','2026H1');assert.equal(data.stocks.length,50);assert.equal(data.stocks[0].metrics.pe.value,20);}finally{globalThis.fetch=fetch;if(prior)Object.defineProperty(globalThis,'caches',prior);else Reflect.deleteProperty(globalThis,'caches');}
});
