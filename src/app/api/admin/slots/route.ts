import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshScheduleOccupancy, SERVICE_DURATION_MINUTES, type ServiceType } from "@/lib/slots";

export async function POST(request: NextRequest) {
  const { service_type, slot_time } = await request.json();

  if (!["bfm", "brt", "psychology"].includes(service_type)) {
    return NextResponse.json({ error: "Неверный тип услуги" }, { status: 400 });
  }

  if (!slot_time) {
    return NextResponse.json({ error: "Укажите время" }, { status: 400 });
  }

  const { error } = await db.from("slots").insert({
    service_type,
    slot_time,
    duration_minutes: SERVICE_DURATION_MINUTES[service_type as ServiceType],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await refreshScheduleOccupancy();

  return NextResponse.json({ ok: true }, { status: 201 });
}
