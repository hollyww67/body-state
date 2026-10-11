import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {readAdminToday,moscowDay} from '@/lib/admin-today';
export async function GET(request:NextRequest){const denied=await requireAdmin(request);if(denied)return denied;try{return NextResponse.json(await readAdminToday(request.nextUrl.searchParams.get('day')||moscowDay()),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='INVALID_DAY'?'Выберите корректную дату':'Не удалось получить рабочую сводку'},{status:e instanceof Error&&e.message==='INVALID_DAY'?400:500});}}
