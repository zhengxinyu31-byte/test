import test from 'node:test';import assert from 'node:assert/strict';import {readSaved} from '../lib/stock/screen-storage.ts';
test('new saved-run schema rejects malformed, wrong version and nested corrupt data',()=>{for(const value of ['{broken','{}','[null]','[{"version":4}]','[{"version":5,"plan":{"query":"x"},"dataset":{"stocks":[null]}}]'])assert.deepEqual(readSaved(value),[]);});
