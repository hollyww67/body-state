import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {pool} from '@/lib/db';
import {readJsonObject} from '@/lib/request';
import {reviewPaymentCase} from '@/lib/payment-cases';
import {validBookingId} from '@/lib/booking-journey';
export async function GET(request:NextRequest){
 const denied=await requireAdmin(request);if(denied)return denied;
 try{const cases=await pool.query(`SELECT c.*,o.total,o.status AS payment_status FROM payment_cases c JOIN orders o ON o.id=c.order_id ORDER BY c.status,c.created_at DESC LIMIT 200`);const history=await pool.query(`SELECT h.* FROM payment_case_history h WHERE h.case_id=ANY($1::uuid[]) ORDER BY h.created_at DESC LIMIT 1000`,[cases.rows.map(r=>r.id)]);return NextResponse.json({cases:cases.rows,history:history.rows},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Не удалось получить платёжные исключения'},{status:500});}
}
export async function PATCH(request:NextRequest){
 const denied=await requireAdmin(request);if(denied)return denied;
 try{const b=await readJsonObject(request,4096);if(!validBookingId(String(b.id)))return NextResponse.json({error:'Некорректный случай'},{status:400});const ok=await reviewPaymentCase(String(b.id),String(b.status),String(b.result||''),String(b.comment||''));return ok?NextResponse.json({ok:true}):NextResponse.json({error:'Случай не найден'},{status:404});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='INVALID_REVIEW'?'Укажите результат и комментарий от 5 до 1000 символов':'Не удалось сохранить разбор'},{status:e instanceof Error&&e.message==='INVALID_REVIEW'?400:500});}
}
