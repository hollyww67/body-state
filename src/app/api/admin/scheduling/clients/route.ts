import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {pool} from '@/lib/db';
export async function GET(request:NextRequest) {
  const unauthorized=await requireAdmin(request);if(unauthorized)return unauthorized;
  const search=request.nextUrl.searchParams.get('q')?.trim()??'';
  if(search.length<3||search.length>120)return NextResponse.json({clients:[]},{headers:{'Cache-Control':'no-store'}});
  const pattern=`%${search.replace(/[\\%_]/g,'\\$&')}%`;
  try {
    const result=await pool.query(`SELECT id::text,display_name,phone,email FROM account_users
      WHERE disabled_at IS NULL AND (display_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
      ORDER BY display_name NULLS LAST,id LIMIT 20`,[pattern]);
    return NextResponse.json({clients:result.rows},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Поиск клиентов недоступен'},{status:503});}
}
