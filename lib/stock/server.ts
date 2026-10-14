const buckets=new Map<string,{count:number;start:number}>();
export function limited(request:Request,kind:'dataset'|'interpret'):boolean {
  const address=request.headers.get('cf-connecting-ip')??'local';
  const key=kind+':'+address,now=Date.now(),b=buckets.get(key);
  if(buckets.size>10000)buckets.clear();
  if(!b||now-b.start>60000){buckets.set(key,{count:1,start:now});return false;}
  b.count++;return b.count>(kind==='interpret'?6:12);
}
export function errorResponse(message:string,status=502) {return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
