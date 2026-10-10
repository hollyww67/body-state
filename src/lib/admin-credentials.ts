import { db } from "@/lib/db";

const PASSWORD_HASH_KEY = "admin_password_hash";

export async function getAdminPasswordHash() {
  const { data, error } = await db
    .from<{ value: string }>("settings")
    .select("value")
    .eq("key", PASSWORD_HASH_KEY)
    .maybeSingle();

  if (error) console.error("[admin] Failed to read password hash override", error);
  return (data?.value || process.env.ADMIN_PASSWORD_HASH || "").replace(/\\\$/g, "$");
}

export async function setAdminPasswordHash(passwordHash: string) {
  const { error } = await db.from("settings").upsert({
    key: PASSWORD_HASH_KEY,
    value: passwordHash,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) throw error;
}

