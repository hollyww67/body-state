import { db } from "@/lib/db";

/** Store remains closed until explicitly enabled by an administrator. */
export async function isShopVisible(): Promise<boolean> {
  const { data, error } = await db.from("settings").select("value").eq("key", "shop_visible").maybeSingle();
  if (error) {
    console.error("Shop visibility lookup failed", error);
    return false;
  }
  return data?.value === "true";
}
