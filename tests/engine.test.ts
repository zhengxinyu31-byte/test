import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConditions, evaluate, compareRuns, calculateYoY, calculateRisk, relaxations, applyPatches } from '../lib/stock/engine.ts';
import type { Condition, Stock, Metric } from '../lib/stock/types.ts';

const metric = (value: number | null, issue?: string): Metric => ({ value, unit: '%', quality: issue ? 'missing' : 'ok', issue, evidence: [] });
const stock = (code: string, pe: number | null, revenue = 10): Stock => ({ code, name: code, metrics: { pe: metric(pe), revenue: metric(revenue), profit: metric(10), volatility: metric(20), drawdown: metric(10) }, prices: [] });
const c = (field: Condition['field'], op: Condition['op'], value: number, id: string = field): Condition => ({ id, field, op, value, sourceText: '测试条件' });

test('limited patches preserve untouched conditions and reject invalid targets',()=>{
 const before=[c('revenue','>',0),c('pe','<=',25)];
 const after=applyPatches(before,[{type:'update',id:'pe',value:30}]);
 assert.deepEqual(after[0],before[0]);assert.equal(after[1].value,30);assert.equal(before[1].value,25);
 assert.throws(()=>applyPatches(before,[{type:'update',id:'not-found',value:30}]));
 assert.throws(()=>applyPatches(before,[{type:'update',id:'pe',value:NaN}]));
});

test('a steadily falling price path can have almost zero volatility and a large drawdown',()=>{
 const dates=Array.from({length:61},(_,i)=>String(i).padStart(3,'0'));
 const risk=calculateRisk(dates.map((date,i)=>({date,close:100*.99**i,volume:10})),dates);
 assert.ok(risk.volatility.value!<1e-9);assert.ok(Math.abs(risk.drawdown.value!-(1-.99**60)*100)<1e-9);
});

test('mutually exclusive and open-bound intervals are rejected', () => {
  assert.ok(validateConditions([c('pe','>',30,'a'),c('pe','<',15,'b')]).length);
  assert.ok(validateConditions([c('pe','>',15,'a'),c('pe','<=',15,'b')]).length);
  assert.equal(validateConditions([c('pe','>=',15,'a'),c('pe','<=',15,'b')]).length,0);
});
test('invalid fields, NaN, infinity and duplicate IDs are rejected', () => {
  for (const value of [NaN,Infinity]) assert.ok(validateConditions([c('pe','<=',value)]).length);
  assert.ok(validateConditions([{...c('pe','<=',25),field:'invented'} as unknown as Condition]).length);
  assert.ok(validateConditions([c('pe','>',0),c('pe','<=',25)]).length);
});
test('three-valued evaluation retains every security, including missing facts', () => {
  const r=evaluate([stock('A',20),stock('B',30),stock('C',null)], [c('pe','<=',25)]);
  assert.deepEqual(r.map(x=>x.status),['pass','fail','unknown']);
  assert.equal(r.length,3);
});
test('negative PE is not treated as cheap; zero PE is not meaningful', () => {
  assert.equal(evaluate([stock('A',-5),stock('B',0)],[c('pe','<=',25)])[0].status,'unknown');
  assert.equal(evaluate([stock('A',0)],[c('pe','<=',25)])[0].status,'unknown');
});
test('known failure wins but missing evidence remains visible', () => {
  const r=evaluate([stock('A',null,-3)],[c('pe','<=',25),c('revenue','>',0)])[0];
  assert.equal(r.status,'fail'); assert.equal(r.checks[0].status,'unknown');
});
test('thresholds compare original precision, not rounded display', () => {
  assert.equal(evaluate([stock('A',25.00001)],[c('pe','<=',25)])[0].status,'fail');
});
test('relaxing a condition preserves old pass set and computes exact changes', () => {
  const s=[stock('A',20),stock('B',30),stock('C',null)];
  const a=evaluate(s,[c('pe','<=',25)]),b=evaluate(s,[c('pe','<=',35)]);
  const d=compareRuns(a,b); assert.deepEqual(d.added,['B']);assert.deepEqual(d.removed,[]);
  assert.deepEqual(evaluate(s,[c('pe','<=',25)]),a);
});
test('removing a condition previews result count without changing inputs', () => {
  const cs=[c('pe','<=',25),c('revenue','>',0)];
  const r=relaxations([stock('A',30),stock('B',20,-1)],cs);
  assert.equal(r[0].count,1); assert.equal(r[1].count,1);assert.equal(cs.length,2);
});
test('YoY uses matched positive base and never treats missing or zero as zero growth', () => {
  assert.equal(calculateYoY(120,100).value,20);
  for(const base of [0,-10,null]) assert.equal(calculateYoY(120,base).value,null);
  assert.equal(calculateYoY(null,100).value,null);
});
test('risk uses 60 returns, sample standard deviation and peak-to-trough drawdown', () => {
  const dates=Array.from({length:61},(_,i)=>String(i));
  const bars=dates.map((date,i)=>({date,close:i===60?80:100,volume:100}));
  const r=calculateRisk(bars,dates);
  assert.equal(r.drawdown.value,20);
  const returns=Array.from({length:60},(_,i)=>i===59?Math.log(.8):0);
  const mean=returns.reduce((a,b)=>a+b,0)/60;
  const expected=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/59)*Math.sqrt(252)*100;
  assert.ok(Math.abs(r.volatility.value!-expected)<1e-9);
});
test('incomplete windows, duplicate days, suspension, invalid prices are unknown', () => {
  const dates=Array.from({length:61},(_,i)=>String(i));
  const good=dates.map(date=>({date,close:100,volume:100}));
  for(const bars of [good.slice(1),[...good,good[0]],good.map((b,i)=>i===4?{...b,volume:0}:b),good.map((b,i)=>i===4?{...b,close:0}:b)])
    assert.equal(calculateRisk(bars,dates).volatility.value,null);
});
test('zero volatility is valid when all trading days are observed and traded', () => {
  const dates=Array.from({length:61},(_,i)=>String(i));
  const r=calculateRisk(dates.map(date=>({date,close:100,volume:100})),dates);
  assert.equal(r.volatility.value,0);assert.equal(r.drawdown.value,0);
});
