import { NextRequest,NextResponse } from 'next/server';
import { getAccountSession } from '@/lib/account-auth';
import { appointmentICS,isJourneyService,validBookingId,loadJourney,matchesAccessToken,publicJourney } from '@/lib/booking-journey';
import { cancelAccountBooking,rescheduleBooking } from '@/lib/slots';
import { readJsonObject } from '@/lib/request';
import {checkBookingRescheduleLimit} from '@/lib/booking-reschedule-rate';
type Context={params:Promise<{service:string;id:string}>};
async function authorized(request:NextRequest,ctx:Context){
  const {service,id}=await ctx.params;
  if(!isJourneyService(service)||!validBookingId(id))return null;
  const b=await loadJourney(service,id);if(!b)return null;
  const session=await getAccountSession(request);
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]||'';
  if(!(session?.userId&&b.account_user_id===session.userId)&&!matchesAccessToken(token,b.access_hash))return null;
  return {b,service,id:id.toLowerCase()};
}
export async function GET(request:NextRequest,ctx:Context){
  try{
    const a=await authorized(request,ctx);if(!a)return NextResponse.json({error:'Запись недоступна. Войдите в кабинет или используйте сохранённую ссылку.'},{status:403});
    const journey=publicJourney(a.service,a.b);
    if(request.nextUrl.searchParams.get('format')==='ics'){
      if(a.b.status!=='confirmed'||!journey.snapshot)return NextResponse.json({error:'Запись ещё не подтверждена или её длительность не сохранена'},{status:409});
      return new NextResponse(appointmentICS(journey),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="appointment.ics"','Cache-Control':'no-store'}});
    }
    return NextResponse.json({booking:journey},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Не удалось загрузить запись'},{status:500});}
}
export async function PATCH(request:NextRequest,ctx:Context){
  try{
    const a=await authorized(request,ctx);if(!a)return NextResponse.json({error:'Нет доступа к записи'},{status:403});
    const body=await readJsonObject(request,4096);
    if(body.action==='reschedule'&&!await checkBookingRescheduleLimit(a.service,a.id)) return NextResponse.json({error:'Слишком много переносов. Повторите позже.'},{status:429,headers:{'Retry-After':'900'}});
    const result=body.action==='cancel'?await cancelAccountBooking(a.id,a.service,undefined):body.action==='reschedule'&&validBookingId(String(body.slot_id))?await rescheduleBooking({bookingId:a.id,serviceType:a.service,newSlotId:String(body.slot_id)}):null;
    if(!result)return NextResponse.json({error:'Выберите действие и свободное время'},{status:400});
    if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Не удалось изменить запись'},{status:500});}
}
