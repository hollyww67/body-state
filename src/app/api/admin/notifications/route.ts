import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {pool} from '@/lib/db';
import {readJsonObject} from '@/lib/request';
import {requeueNotification} from '@/lib/appointment-notifications';
import {validBookingId} from '@/lib/booking-journey';
export async function GET(request:NextRequest){
 const denied=await requireAdmin(request);if(denied)return denied;
 try{const booking=request.nextUrl.searchParams.get('booking');if(booking&&!validBookingId(booking))return NextResponse.json({error:'Некорректная запись'},{status:400});
 const r=await pool.query(`SELECT id,booking_id,service_type,event_type,channel,status,scheduled_at,attempts,next_attempt_at,last_error,accepted_at,delivered_at,updated_at,
   (engine='v1' AND status IN ('failed','not_configured') AND attempts<4 AND event_type NOT IN ('reset_requested','reminder_24h','reminder_2h')) AS retry_allowed
   FROM appointment_notifications ${booking?'WHERE booking_id=$1':''} ORDER BY created_at DESC,id DESC LIMIT 200`,booking?[booking]:[]);
 return NextResponse.json({notifications:r.rows},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Не удалось загрузить журнал'},{status:500});}
}
export async function POST(request:NextRequest){
 const denied=await requireAdmin(request);if(denied)return denied;
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Недопустимый источник'},{status:403});
 try{const b=await readJsonObject(request,2048);if(!validBookingId(String(b.id)))return NextResponse.json({error:'Некорректное уведомление'},{status:400});
 const row=(await pool.query('SELECT engine FROM appointment_notifications WHERE id=$1',[b.id])).rows[0];
 if(row?.engine!=='v1')return NextResponse.json({error:'Исторические отправки требуют отдельного разбора и не повторяются здесь.'},{status:409});
 const ok=await requeueNotification(String(b.id));return ok?NextResponse.json({ok:true}):NextResponse.json({error:'Повтор недоступен: сообщение устарело, обрабатывается или могло быть принято провайдером.'},{status:409});}catch{return NextResponse.json({error:'Не удалось поставить сообщение в очередь'},{status:500});}
}
