import { NextRequest, NextResponse } from "next/server";
import { getAccountSession } from "@/lib/account-auth";
import { pool } from "@/lib/db";
import { cleanText, normalizeEmail, normalizePhone, readJsonObject } from "@/lib/request";
import { syncLoyaltyRewards } from "@/lib/loyalty";

type Activity = { created_at: string };

async function readProfile(userId: string) {
  const result = await pool.query<{
    id: string;
    username: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  }>(
    `SELECT id::text, username, display_name, email, phone, address
       FROM account_users
      WHERE id=$1 AND disabled_at IS NULL
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

export async function GET(request: NextRequest) {
  const session = await getAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const profile = await readProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const loyaltySync = await syncLoyaltyRewards({ accountUserId: session.userId, phone: profile.phone, email: profile.email });
  const bookingsResult = await pool.query<Activity>(`
    SELECT b.id::text, 'bfm' AS service_type, b.status, b.created_at, s.slot_time, b.payment_option, b.payment_status
      FROM bfm_bookings b LEFT JOIN slots s ON s.id=b.slot_id
     WHERE b.account_user_id=$1
    UNION ALL
    SELECT b.id::text, 'brt', b.status, b.created_at, s.slot_time, b.payment_option, b.payment_status
      FROM brt_bookings b LEFT JOIN slots s ON s.id=b.slot_id
     WHERE b.account_user_id=$1
    UNION ALL
    SELECT b.id::text, 'psychology', b.status, b.created_at, s.slot_time, b.payment_option, b.payment_status
      FROM psychology_bookings b LEFT JOIN slots s ON s.id=b.slot_id
     WHERE b.account_user_id=$1
    UNION ALL
    SELECT b.id::text, 'program', b.status, b.created_at, NULL::timestamptz, NULL::text, NULL::text
      FROM program_enrollments b
     WHERE b.account_user_id=$1
    UNION ALL
    SELECT b.id::text, COALESCE(NULLIF(b.service_type, ''), 'consultation'), CASE WHEN b.status='new' THEN 'pending' ELSE b.status END, b.created_at, NULL::timestamptz, NULL::text, NULL::text
      FROM consultation_enrollments b
     WHERE b.account_user_id=$1
    ORDER BY created_at DESC`, [session.userId]);

  const orders = await pool.query(
    `SELECT id::text, status, total, items, created_at, paid_at
       FROM orders
      WHERE account_user_id=$1
      ORDER BY created_at DESC
      LIMIT 100`,
    [session.userId],
  );

  const [rules, rewards, successfulVisits] = await Promise.all([
    pool.query(`SELECT visits_required, discount_percent FROM loyalty_rules WHERE is_active=true ORDER BY visits_required`),
    pool.query(
      `SELECT lr.id::text, lr.visits_at_award, lr.created_at, r.visits_required, COALESCE(p.discount_value, r.discount_percent) AS discount_percent,
              p.code, p.redeemed_count, p.reserved_count, p.is_active, p.expires_at
         FROM loyalty_rewards lr JOIN loyalty_rules r ON r.id=lr.rule_id
         LEFT JOIN promo_codes p ON p.id=lr.promo_code_id
        WHERE lr.account_user_id=$1 ORDER BY r.visits_required DESC`, [session.userId],
    ),
    pool.query(
      `SELECT id::text, service_code, source_type, completed_at
         FROM client_visits
        WHERE account_user_id=$1
        ORDER BY completed_at DESC
        LIMIT 100`,
      [session.userId],
    ),
  ]);
  const nextRule = rules.rows.find((rule) => Number(rule.visits_required) > loyaltySync.visits) || null;

  const videoRooms = await pool.query(`
    SELECT room_id, room_name, expires_at FROM psychology_rooms
    WHERE account_user_id=$1 AND is_active=true AND expires_at>now()
    UNION ALL
    SELECT b.room_id, 'Онлайн-консультация', s.slot_time+make_interval(mins => COALESCE(s.duration_minutes,90)+30)
    FROM psychology_bookings b JOIN slots s ON s.id=b.slot_id
    WHERE b.account_user_id=$1 AND b.booking_type='online' AND b.status='confirmed' AND b.payment_status='paid'
      AND b.room_id IS NOT NULL AND s.slot_time+make_interval(mins => COALESCE(s.duration_minutes,90)+30)>now()
    ORDER BY expires_at`, [session.userId]);

  return NextResponse.json({
    video_rooms: videoRooms.rows,
    username: profile.username,
    contact: profile.email || profile.phone,
    display_name: profile.display_name,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
    bookings: bookingsResult.rows,
    orders: orders.rows,
    successful_visits: successfulVisits.rows,
    loyalty: { visits: loyaltySync.visits, next_rule: nextRule, rewards: rewards.rows },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const session = await getAccountSession(request);
  if (!session) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request, 16_384); }
  catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }

  const displayName = cleanText(body.display_name, 80);
  const email = body.email ? normalizeEmail(body.email) : "";
  const phone = body.phone ? normalizePhone(body.phone) : "";
  const address = cleanText(body.address, 500);

  if (displayName.length < 2) return NextResponse.json({ error: "Укажите имя длиной не менее 2 символов" }, { status: 400 });
  if (body.email && !email) return NextResponse.json({ error: "Укажите корректный e-mail" }, { status: 400 });
  if (body.phone && !phone) return NextResponse.json({ error: "Укажите корректный телефон" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "E-mail нужен для входа и восстановления пароля" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE account_users SET display_name=$2, email=$3, username=$3, phone=$4, address=$5, updated_at=now() WHERE id=$1`,
      [session.userId, displayName, email || null, phone || null, address || null],
    );
    // Contact fields are editable and are not proof of ownership of past bookings.
    await client.query("COMMIT");
    await syncLoyaltyRewards({ accountUserId: session.userId, phone, email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Этот e-mail или телефон уже используется" }, { status: 409 });
    }
    console.error("[Account] Profile update failed", error);
    return NextResponse.json({ error: "Не удалось сохранить профиль" }, { status: 500 });
  } finally {
    client.release();
  }
}
