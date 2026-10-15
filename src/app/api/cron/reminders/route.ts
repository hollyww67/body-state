import { NextRequest,NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/cron-auth';
import { syncReminders,processNotificationQueue } from '@/lib/appointment-notifications';
import { processV1Notifications } from '@/lib/notification-core';
export async function GET(request:NextRequest){
  const denied=requireCronSecret(request);if(denied)return denied;
  try{await syncReminders();return NextResponse.json({ok:true,...await processNotificationQueue(),v1:await processV1Notifications()});}
  catch{return NextResponse.json({error:'Не удалось обработать очередь уведомлений'},{status:500});}
}
