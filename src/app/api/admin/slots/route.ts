import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from '@/lib/admin-auth';
import { refreshSlotOccupancy, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";
import {readJsonObject} from '@/lib/request';

export async function POST(request: NextRequest) {
  const unauthorized=await requireAdmin(request);if(unauthorized)return unauthorized;
  let service_type:unknown,slot_time:unknown;
  try {({service_type,slot_time}=await readJsonObject(request,8192));}catch{return NextResponse.json({error:'Некорректный JSON'},{status:400});}

  if (!["bfm", "brt", "psychology"].includes(String(service_type))) {
    return NextResponse.json({ error: "Неверный тип услуги" }, { status: 400 });
  }

  const time=new Date(String(slot_time));
  if (!slot_time||!Number.isFinite(time.getTime())||time<=new Date()) {
    return NextResponse.json({ error: "Укажите время" }, { status: 400 });
  }

  try {
    const result=await db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock($1)',[913202609]);
      const inserted=await client.query('INSERT INTO slots(service_type,slot_time,duration_minutes) VALUES($1,$2,$3) ON CONFLICT(slot_time,service_type) DO NOTHING RETURNING id',[service_type,time.toISOString(),SERVICE_DURATION_MINUTES[service_type as ServiceType]]);
      await refreshSlotOccupancy(client);
      const slot=(await client.query('SELECT * FROM slots WHERE service_type=$1 AND slot_time=$2',[service_type,time.toISOString()])).rows[0];
      return {ok:true,created:!!inserted.rowCount,slot};
    });
    return NextResponse.json(result,{status:201});
  }catch{return NextResponse.json({error:'Не удалось создать окно'},{status:500});}
}
