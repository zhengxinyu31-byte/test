import type { Dataset, Evidence, Field, Operator, Report, Stock } from './types.ts';
export type ScreenField=Field|'ma20gap'|'return60'|'profitPositive'|'turnaround';
export type ScreenStatus='pass'|'fail'|'unknown'|'inapplicable';
export interface ExplicitCondition {field:ScreenField;op:Operator;value:number;sourceText:string}
export interface IntentPlan {query:string;goals:{id:string;sourceText:string}[];constraints:ExplicitCondition[];unsupported:string[];question:string|null;report:Report;model:string;requestId?:string;knowledgeVersion:string}
export interface ScreenCondition {id:string;field:ScreenField;op:Operator;value:number|null;sourceText:string;origin:'user'|'default'|'edited';goal:string;basis:string;benchmark?:'pe'|'volatility'|'drawdown';percentile?:number;profitGate?:boolean}
export interface Benchmark {field:'pe'|'volatility'|'drawdown';valid:boolean;count:number;denominator:number;coverage:number;p25:number|null;p50:number|null;p75:number|null;members:{code:string;value:number}[];issue?:string}
export interface ScreenCheck {condition:ScreenCondition;status:ScreenStatus;actual:number|null;reason:string;evidence:Evidence[]}
export interface ScreenEvaluation {stock:Stock;status:ScreenStatus;checks:ScreenCheck[]}
export interface ScreenRun {version:5;id:string;plan:IntentPlan;dataset:Dataset;benchmarks:Record<'pe'|'volatility'|'drawdown',Benchmark>;conditions:ScreenCondition[];evaluations:ScreenEvaluation[];executedAt:string;history:string[]}
