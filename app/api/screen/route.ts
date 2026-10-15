import type {ScreenCondition} from '@/lib/stock/screen-types';
import { compileIntent } from '@/lib/stock/screen-intent';
import { getDataset } from '@/lib/stock/data';
import { makeRun,presetPlan,validateScreenConditions,changeConditions,rebaseConditions } from '@/lib/stock/screen-policy';
import { limited,errorResponse } from '@/lib/stock/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(limited(request,'interpret'))return errorResponse('操作较频繁，请一分钟后再试。',429);
 try{
 const raw=await request.text();if(raw.length>3000)return errorResponse('输入过长。',413);
 const body=JSON.parse(raw) as {query?:unknown;preset?:unknown;refresh?:boolean;interpretOnly?:boolean;conditions?:ScreenCondition[]};
 if(typeof body.query!=='string'||!body.query.trim()||body.query.length>400)return errorResponse('请输入1–400字选股想法。',400);
 if(body.preset!==undefined&&(!Number.isInteger(body.preset)||Number(body.preset)<0||Number(body.preset)>5))return errorResponse('示例不存在。',400);
 const plan=body.preset!==undefined?presetPlan(Number(body.preset)):await compileIntent(body.query.trim(),process.env.OPENROUTER_API_KEY??'',process.env.LLM_MODEL??'dots-studio/dots-3-note-preview:free');
 if(body.preset!==undefined&&plan.query!==body.query)return errorResponse('示例与输入不一致，请重新选择。',400);
 if(plan.unsupported.length||plan.question||body.interpretOnly)return Response.json({plan},{headers:{'Cache-Control':'no-store'}});
 if(plan.constraints.length){const errors=validateScreenConditions(plan.constraints.map((c,i)=>({...c,id:String(i),origin:'user',goal:'explicit',basis:''})));if(errors.length)return Response.json({plan:{...plan,question:errors.join(' ')}},{headers:{'Cache-Control':'no-store'}});}
 const dataset=await getDataset(process.env.FUYAO_API_KEY??'',plan.report,!!body.refresh,'white-goods');
 let run=makeRun(dataset,plan);
 if(body.refresh&&body.conditions){if(validateScreenConditions(body.conditions).length)return errorResponse('当前条件无效，未刷新。',400);run=changeConditions(run,rebaseConditions(body.conditions,run.benchmarks),'刷新数据，保留原条件；相对参考线按新快照计算。');}
 return Response.json({run},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e instanceof SyntaxError?'请求格式不正确。':(e as Error).message);}
}
