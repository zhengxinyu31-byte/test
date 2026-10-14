import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryCheck, validateInterpretation } from '../lib/stock/intent.ts';
import { DEFAULT_CONDITIONS } from '../lib/stock/engine.ts';
const draft=(field='pe',op='<=',value=25)=>({status:'ready',conditions:[{field,op,value,sourceText:''}],operations:[],questions:[],unsupported:[],notices:[]});
const cases=[
 ['OR','PE小于20或利润同比大于10',true],['English OR','PE<20 OR PE>30',true],
 ['future','明天必涨的股票',true],['advice','直接告诉我买什么',true],
 ['choice','波动率或回撤哪个更适合描述稳定？',false],['normal','经营改善、估值合理、走势稳定',false],
] as const;
for(const [name,query,blocked] of cases)test(`boundary ${name}`,()=>assert.equal(!!boundaryCheck(query),blocked));
const unsupportedCases=[
 ['accelerating','利润增速加快','profit','>',0],['turnaround','扭亏为盈','profit','>',0],
 ['level','排除亏损公司','profit','>=',0],['window','近20日波动率小于10%','volatility','<',10],
 ['static','静态市盈率小于20','pe','<',20],['industry','行业内估值便宜','pe','<=',25],
 ['quality','扣非净利润增长','profit','>',0],['pp','利润同比提高5个百分点','profit','>',5],
] as const;
for(const [name,query,field,op,value] of unsupportedCases)test(`no silent substitution ${name}`,()=>assert.throws(()=>validateInterpretation(draft(field,op,value),query,'test','2026H1')));
test('unsupported requirements retained when honestly reported',()=>assert.equal(validateInterpretation({...draft(),conditions:[],unsupported:['首版不支持增速加快比较']},'利润增速加快','test','2026H1').status,'unsupported'));
test('explicit strict operator preserved',()=>assert.throws(()=>validateInterpretation(draft('pe','<=',20),'PE小于20','test','2026H1')));
test('explicit inclusive operator preserved',()=>assert.equal(validateInterpretation(draft('pe','<=',20),'PE不超过20','test','2026H1').conditions[0].op,'<='));
test('negative growth preserved',()=>assert.equal(validateInterpretation(draft('profit','<',0),'利润同比小于0','test','2026H1').conditions[0].value,0));
test('negated decline not silently mapped to decline',()=>assert.throws(()=>validateInterpretation(draft('profit','<',0),'不要利润下降的公司','test','2026H1')));
test('profit basis requires clarification',()=>assert.equal(validateInterpretation(draft('profit','>',10),'利润同比大于10','test','2026H1').status,'clarify'));
test('patch preserves other conditions and identity',()=>{const v=validateInterpretation({...draft(),conditions:[],operations:[{type:'update',id:'pe',op:'<=',value:20}]},'把PE上限改成20，其他不变','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:3});assert.equal(v.baseRevision,3);assert.equal(v.conditions.length,4);assert.deepEqual(v.conditions[0],DEFAULT_CONDITIONS[0]);assert.equal(v.conditions[2].value,20);});
test('patch cannot invent a target',()=>assert.throws(()=>validateInterpretation({...draft(),conditions:[],operations:[{type:'remove',id:'invented'}]},'删除估值','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:3})));
test('modify cannot supply replacement query',()=>assert.throws(()=>validateInterpretation(draft(),'把PE改为20','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:3})));
test('report change is returned for confirmation',()=>assert.equal(validateInterpretation({...draft(),requestedReport:'2025FY'},'2025年报PE不超过25','test','2026H1').requestedReport,'2025FY'));
test('reasonable valuation cannot silently create a universal PE cutoff',()=>{const v=validateInterpretation(draft(),'估值合理','test','2026H1');assert.equal(v.conditions.some(c=>c.field==='pe'),false);assert.deepEqual(v.unresolved,['valuation']);});
test('fuzzy modification does not erase an existing explicit PE condition',()=>{const v=validateInterpretation({...draft(),conditions:[],operations:[],questions:['请明确便宜的标准']},'我想要更便宜的','test','2026H1',{mode:'modify',current:DEFAULT_CONDITIONS,revision:4});assert.deepEqual(v.conditions,DEFAULT_CONDITIONS);assert.deepEqual(v.unresolved,['valuation']);});
test('unrelated unsupported request does not excuse losing a supported explicit constraint',()=>{assert.throws(()=>validateInterpretation({...draft('revenue','>',0),unsupported:['新闻条件未支持']},'营收大于0，PE小于20，最近有利好新闻','test','2026H1'));});
