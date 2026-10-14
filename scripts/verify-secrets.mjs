import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
if(fs.existsSync('.dev.vars'))process.loadEnvFile('.dev.vars');
const secrets=['FUYAO_API_KEY','OPENROUTER_API_KEY'].map(k=>process.env[k]).filter(v=>v&&v.length>15&&!v.startsWith('replace-'));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const visit=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?visit(path.join(d,x.name)):[path.join(d,x.name)]):[];
const leaks=[];
for(const file of [...new Set([...files,...visit('dist/client')])]){if(!fs.statSync(file).isFile())continue;const s=fs.readFileSync(file,'utf8');if(secrets.some(v=>s.includes(v))||/sk-or-v1-[a-f0-9]{20,}|eyJraWQiOiJtY3AtYXBp/.test(s)&&file!=='scripts/verify-secrets.mjs')leaks.push(file);}
let history='';try{history=execFileSync('git',['log','-p','--all'],{encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});}catch{}
if(secrets.some(v=>history.includes(v)))leaks.push('git history');
console.log(JSON.stringify({checkedSourceFiles:files.length,checkedClientFiles:visit('dist/client').length,secretValuesChecked:secrets.length,leaks},null,2));if(leaks.length)process.exitCode=1;
