import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/request";
import { verifyPaymentStatusToken } from "@/lib/tbank";
import {isJourneyService,loadJourney,publicJourney} from '@/lib/booking-journey';

const PUBLIC_STATUSES = new Set(["pending", "paid", "failed", "cancelled", "refunded"]);

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, "payment-status", 90, 60 * 60);
  if (limited) return limited;

  const orderId = request.nextUrl.searchParams.get("orderId") || "";
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !verifyPaymentStatusToken(orderId, token)) {
    return NextResponse.json({ error: "Недействительная ссылка на платеж" }, { status: 403 });
  }

  const { data: order, error } = await db.from("orders").select("status,items").eq("id", orderId).maybeSingle();
  if (error) return NextResponse.json({ error: "Не удалось проверить платеж" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const status = ["shipped", "delivered"].includes(String(order.status)) ? "paid"
    : PUBLIC_STATUSES.has(String(order.status)) ? String(order.status) : "pending";
  const bookings=[];
  for(const item of order.items||[]){if(typeof item.bookingType==='string'&&isJourneyService(item.bookingType)&&typeof item.bookingId==='string'){
    const b=await loadJourney(item.bookingType,item.bookingId);if(b)bookings.push(publicJourney(item.bookingType,b));
  }}
  return NextResponse.json({ status,bookings }, { headers: { "Cache-Control": "no-store" } });
}
