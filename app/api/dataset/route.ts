import { getDataset, REPORTS } from '@/lib/stock/data';
import { errorResponse, limited } from '@/lib/stock/server';
import type { Report } from '@/lib/stock/types';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  if(limited(request,'dataset'))return errorResponse('请求过于频繁，请稍后再试。',429);
  const url=new URL(request.url),report=url.searchParams.get('report')??'2026H1';
  if(!(Object.hasOwn(REPORTS,report)))return errorResponse('不支持的报告期。',400);
  try{const data=await getDataset(process.env.FUYAO_API_KEY??'',report as Report,url.searchParams.get('refresh')==='1');return Response.json(data,{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse((e as Error).message);}
}
