import { interpret } from '@/lib/stock/intent';
import { validateConditions } from '@/lib/stock/engine';
import { errorResponse, limited } from '@/lib/stock/server';
import type { Condition, Report } from '@/lib/stock/types';
export async function POST(request:Request) {
  if(limited(request,'interpret'))return errorResponse('解析请求过于频繁，请一分钟后再试。',429);
  if(Number(request.headers.get('content-length'))>12000)return errorResponse('输入过长。',413);
  try{
    const text=await request.text();if(text.length>12000)return errorResponse('输入过长。',413);
    const body=JSON.parse(text) as {query?:unknown;report?:unknown;conditions?:unknown;mode?:unknown;revision?:unknown};
    if(typeof body.query!=='string'||!body.query.trim()||body.query.length>400)return errorResponse('请输入 1–400 字选股想法。',400);
    if(body.report!==undefined&&!['2026H1','2025FY'].includes(String(body.report)))return errorResponse('不支持的报告期。',400);
    const current=body.conditions??[];if(!Array.isArray(current)||validateConditions(current as Condition[]).some(x=>!x.includes('冲突')))return errorResponse('当前条件无效，请先修正。',400);
    if(body.mode!==undefined&&!['new','modify'].includes(String(body.mode)))return errorResponse('未知解析模式。',400);
    if(body.revision!==undefined&&(!Number.isSafeInteger(body.revision)||Number(body.revision)<0))return errorResponse('无效草稿版本。',400);
    const result=await interpret(body.query.trim(),(body.report??'2026H1') as Report,process.env.OPENROUTER_API_KEY??'',process.env.LLM_MODEL??'dots-studio/dots-3-note-preview:free',current as Condition[],body.mode==='modify'?'modify':'new',Number(body.revision??0));
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return errorResponse(e instanceof SyntaxError?'输入不是合法 JSON。':(e as Error).message);}
}
