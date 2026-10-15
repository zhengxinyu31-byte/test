export type Field = 'revenue' | 'profit' | 'pe' | 'volatility' | 'drawdown';
export type Operator = '>' | '>=' | '<' | '<=' | '=';
export type Report = '2026H1' | '2025FY';
export type Status = 'pass' | 'fail' | 'unknown';
export interface Condition { id: string; field: Field; op: Operator; value: number; sourceText: string }
export type ConditionPatch = {type:'update';id:string;op?:Operator;value?:number} | {type:'remove';id:string} | {type:'add';condition:Condition};
export interface IntentMapping {sourceText:string;conditionIds:string[];requiresConfirmation:boolean}
export interface Evidence {
  source: string; endpoint: string; field: string; requestId: string; retrievedAt: string;
  sourceTime?: string | null; period?: string; publishedAt?: string | null;
  raw: unknown; formula?: string; note?: string;
}
export interface Metric {
  value: number | null; unit: '%' | '倍'; quality: 'ok' | 'missing' | 'invalid' | 'stale' | 'unavailable';
  issue?: string; evidence: Evidence[];
}
export interface PricePoint { date: string; close: number; volume: number }
export interface Stock { profitHistory?: import('./peer-data.ts').ProfitPeriod[]; code: string; name: string; metrics: Record<Field, Metric>; prices: PricePoint[] }
export interface Dataset {
  id: string; createdAt: string; fetchStartedAt?:string; report: Report; tradeDate: string; windowStart: string;
  universe: { name: string; code: string; count: number; sourceTime: string | null; requestId: string; memberships?: Evidence[] };
  stocks: Stock[]; issues: string[]; source: '扶摇金融数据';
}
export interface Check { condition: Condition; status: Status; actual: number | null; reason: string }
export interface Evaluation { stock: Stock; status: Status; checks: Check[] }
export interface Interpretation {
  status: 'ready' | 'clarify' | 'unsupported'; conditions: Condition[];
  questions: string[]; unsupported: string[]; notices: string[]; model: string;
  requestId?: string; report: Report;
  unresolved?:string[];
  mappings?:IntentMapping[];requestedReport?:Report|null;operations?:ConditionPatch[];baseRevision?:number;
}
export interface Strategy {id:string;version:number;intent:string;report:Report;conditions:Condition[];mappings:IntentMapping[];confirmedAt:string;omittedRequirements:string[];model:string}
export interface ResearchRun {strategy:Strategy;dataset:Dataset;evaluations:Evaluation[];executedAt:string}
export interface SavedRun {
  version: 2; id: string; name: string; savedAt: string; run:ResearchRun;
}
