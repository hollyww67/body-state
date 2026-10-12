import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {db} from '@/lib/db';
import {dateRange,dayAfter,moscowInstant,ScheduleError,validDay} from '@/lib/schedule-plan';

export async function GET(request:NextRequest) {
  const unauthorized=await requireAdmin(request);if(unauthorized)return unauthorized;
  try {
    const from=validDay(request.nextUrl.searchParams.get('from')),to=validDay(request.nextUrl.searchParams.get('to'));
    if(dateRange(from,to).length>42) throw new ScheduleError('Календарь загружается периодами до 42 дней');
    const bounds=[moscowInstant(from,0),moscowInstant(dayAfter(to),0)];
    const data=await db.transaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const slots=await client.query(`SELECT id,service_type,slot_time,duration_minutes,is_booked FROM slots WHERE slot_time>=$1 AND slot_time<$2 ORDER BY slot_time,service_type,id`,bounds);
      const bookings=[];
      for(const service of ['bfm','brt','psychology']) {
        const rows=await client.query(`SELECT b.id,b.client_name,b.client_phone,b.client_email,b.status,b.attendance,b.payment_status,b.payment_option,b.created_at,
          s.slot_time,s.duration_minutes,'${service}' AS service_type
          FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id
          WHERE s.slot_time+s.duration_minutes*interval '1 minute'>$1 AND s.slot_time<$2 AND b.archived_at IS NULL ORDER BY s.slot_time,b.id`,bounds);
        bookings.push(...rows.rows);
      }
      const breaks=await client.query('SELECT * FROM schedule_breaks WHERE ends_at>$1 AND starts_at<$2 ORDER BY starts_at,id',bounds);
      const days=await client.query('SELECT day::text,mode,hours,template_id FROM schedule_days WHERE day>=$1 AND day<=$2 ORDER BY day',[from,to]);
      const template=(await client.query('SELECT id,week,horizon_days FROM schedule_templates WHERE active')).rows[0]??null;
      return {from,to,slots:slots.rows,bookings,breaks:breaks.rows,days:days.rows,template};
    });
    return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof ScheduleError?error.message:'Календарь недоступен. Повторите загрузку.'},{status:error instanceof ScheduleError?error.status:500});}
}
