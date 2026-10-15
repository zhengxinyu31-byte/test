import {interpret} from '@/lib/stock/intent';
import {FIELDS} from '@/lib/stock/engine';
import {validateScreenConditions,mergeConditionUpdates,explicitConditionEdit} from '@/lib/stock/screen-policy';
import {limited,errorResponse} from '@/lib/stock/server';
import type {Condition} from '@/lib/stock/types';
import type {ScreenCondition} from '@/lib/stock/screen-types';
export async function POST(request:Request){
 if(limited(request,'interpret'))return errorResponse('修改较频繁，请一分钟后再试。',429);
 try{const text=await request.text();if(text.length>16000)return errorResponse('请求过长。',413);const body=JSON.parse(text) as {query:string;conditions:ScreenCondition[]};
 if(typeof body.query!=='string'||!body.query.trim()||body.query.length>400||!Array.isArray(body.conditions)||validateScreenConditions(body.conditions).length)return errorResponse('修改内容或当前条件无效。',400);
 if(/亿元|万元|人民币|美元|港元|\d\s*(?:亿|万|元)/.test(body.query))return errorResponse('金额条件尚未接入，不能把金额改成同比。',422);
 const explicit=explicitConditionEdit(body.query,body.conditions);
 if(explicit){const errors=validateScreenConditions(explicit);if(errors.length)return errorResponse(errors.join(' '),422);return Response.json({conditions:explicit,model:'明确修改解析（未调用模型）'},{headers:{'Cache-Control':'no-store'}});}
 const current=body.conditions.filter(c=>Object.hasOwn(FIELDS,c.field)&&c.value!==null) as Condition[];
 const result=await interpret(body.query,'2026H1',process.env.OPENROUTER_API_KEY??'',process.env.LLM_MODEL??'dots-studio/dots-3-note-preview:free',current,'modify',0);
 if(result.unsupported.length||result.questions.length||!result.operations?.length)return errorResponse([...result.unsupported,...result.questions,'这次未修改条件。可以直接编辑具体数值。'].join(' '),422);
 const conditions=mergeConditionUpdates(body.conditions,result.conditions);
 const errors=validateScreenConditions(conditions);if(errors.length)return errorResponse(errors.join(' '),422);
 return Response.json({conditions,model:result.model},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse((e as Error).message);}
}
