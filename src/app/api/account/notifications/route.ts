import { NextRequest,NextResponse } from 'next/server';
import { getAccountSession } from '@/lib/account-auth';
import { pool } from '@/lib/db';
import { readJsonObject,enforceRateLimit } from '@/lib/request';
import { emailV1Enabled,maxV1Enabled } from '@/lib/notification-core';

export async function GET(request:NextRequest){
  const session=await getAccountSession(request);if(!session)return NextResponse.json({error:'Войдите в личный кабинет'},{status:401});
  const row=(await pool.query(`SELECT a.email,s.reminders_24h,s.reminders_2h,
    EXISTS(SELECT 1 FROM max_account_bindings m WHERE m.account_user_id=a.id) AS max_connected
    FROM account_users a LEFT JOIN account_notification_settings s ON s.account_user_id=a.id WHERE a.id=$1`,[session.userId])).rows[0];
  return NextResponse.json({email:row.email,emailEnabled:emailV1Enabled(),maxEnabled:maxV1Enabled(),maxConnected:row.max_connected,
    reminders24h:row.reminders_24h??true,reminders2h:row.reminders_2h??true},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(request:NextRequest){
  if(request.headers.get('origin')!==request.nextUrl.origin||request.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'Недопустимый источник'},{status:403});
  const session=await getAccountSession(request);if(!session)return NextResponse.json({error:'Войдите в личный кабинет'},{status:401});
  const limited=await enforceRateLimit(request,'notification-preferences',30,60);if(limited)return limited;
  try{
    const body=await readJsonObject(request,1024);
    if(typeof body.reminders24h!=='boolean'||typeof body.reminders2h!=='boolean')return NextResponse.json({error:'Некорректные настройки'},{status:400});
    await pool.query(`INSERT INTO account_notification_settings(account_user_id,reminders_24h,reminders_2h) VALUES($1,$2,$3)
      ON CONFLICT(account_user_id) DO UPDATE SET reminders_24h=$2,reminders_2h=$3,updated_at=now()`,[session.userId,body.reminders24h,body.reminders2h]);
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Не удалось сохранить настройки'},{status:400});}
}
