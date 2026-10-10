import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { generatePromoCode } from "@/lib/promo-codes";

type CustomerIdentity = { accountUserId?: string | null; phone?: string | null; email?: string | null };
type SuccessfulVisit = CustomerIdentity & { serviceCode: "bfm" | "brt" | "psychology" | "psychology_program"; bookingId?: string | null; orderId?: string | null; completedAt?: string };

function emailOf(value?: string | null) { return String(value || "").trim().toLowerCase(); }

async function resolveAccount(client: PoolClient, identity: CustomerIdentity) {
  if (identity.accountUserId) return identity.accountUserId;
  void client;
  return null;
}

async function issueRewards(client: PoolClient, accountUserId: string) {
  const countResult = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM client_visits
      WHERE account_user_id=$1`, [accountUserId],
  );
  const visits = Number(countResult.rows[0]?.count || 0);
  const rules = await client.query<{ id: string; visits_required: number; discount_percent: number }>(
    "SELECT id::text, visits_required, discount_percent FROM loyalty_rules WHERE is_active=true AND visits_required <= $1 ORDER BY visits_required", [visits],
  );
  for (const rule of rules.rows) {
    const reward = await client.query<{ id: string }>(
      `INSERT INTO loyalty_rewards (account_user_id, rule_id, visits_at_award)
       VALUES ($1,$2,$3) ON CONFLICT (account_user_id,rule_id) DO NOTHING RETURNING id::text`,
      [accountUserId, rule.id, visits],
    );
    if (!reward.rows[0]) continue;
    for (let attempt=0; attempt<8; attempt++) {
      const code = generatePromoCode("CARE");
      try {
        const promo = await client.query<{ id: string }>(
          `INSERT INTO promo_codes (code,discount_type,discount_value,service_codes,max_redemptions,assigned_account_user_id,source)
           VALUES ($1,'percent',$2,ARRAY['bfm','brt','psychology','psychology_program']::text[],1,$3,'loyalty') ON CONFLICT (code) DO NOTHING RETURNING id::text`,
          [code, Number(rule.discount_percent), accountUserId],
        );
        if (!promo.rows[0]) {
          if (attempt === 7) throw new Error("Could not generate a unique reward code");
          continue;
        }
        await client.query("UPDATE loyalty_rewards SET promo_code_id=$2 WHERE id=$1", [reward.rows[0].id, promo.rows[0].id]);
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== "23505" || attempt === 7) throw error;
      }
    }
  }
  return visits;
}

export async function syncLoyaltyRewards(identity: CustomerIdentity) {
  return db.transaction(async (client) => {
    const accountUserId = await resolveAccount(client, identity);
    if (!accountUserId) return { accountUserId: null, visits: 0 };
    const visits = await issueRewards(client, accountUserId);
    return { accountUserId, visits };
  });
}

export async function recordSuccessfulVisit(visit: SuccessfulVisit, transactionClient?: PoolClient) {
  const record = async (client: PoolClient) => {
  await client.query(
    `INSERT INTO client_visits (account_user_id,client_phone,client_email,service_code,source_type,booking_id,order_id,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
    [visit.accountUserId || null, visit.phone || null, emailOf(visit.email) || null, visit.serviceCode, visit.orderId ? "payment_link" : "booking", visit.bookingId || null, visit.orderId || null, visit.completedAt || new Date().toISOString()],
  );
  const accountUserId = await resolveAccount(client, visit);
  const visits = accountUserId ? await issueRewards(client, accountUserId) : 0;
  return { accountUserId, visits };
  };
  return transactionClient ? record(transactionClient) : db.transaction(record);
}
