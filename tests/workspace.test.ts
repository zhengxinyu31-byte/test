import test from 'node:test';
import assert from 'node:assert/strict';
import { canApplyResponse, parseSavedRuns, addSavedRun } from '../lib/stock/workspace.ts';
import type { SavedRun } from '../lib/stock/types.ts';
test('stale model response cannot overwrite a newer draft',()=>{assert.equal(canApplyResponse(3,3),true);assert.equal(canApplyResponse(3,4),false);});
test('storage rejects corrupted JSON and outdated schema',()=>{assert.throws(()=>parseSavedRuns('{broken'));assert.throws(()=>parseSavedRuns('[{"version":1}]'));assert.deepEqual(parseSavedRuns(null),[]);});
test('storage validates nested stock shape before restoring',()=>{assert.throws(()=>parseSavedRuns(JSON.stringify([{version:2,id:'x',name:'x',savedAt:'now',run:{strategy:{},dataset:{stocks:[{}]}}}])));});
test('saved run limit is five and duplicate identity is replaced',()=>{const rows=Array.from({length:5},(_,i)=>({id:String(i),name:'x'}) as SavedRun);assert.equal(addSavedRun(rows,{id:'new'} as SavedRun).length,5);assert.equal(addSavedRun(rows,{id:'1',name:'new'} as SavedRun).filter(x=>x.id==='1').length,1);});
