import { db } from "@/lib/db";

export async function sendPushToAdmin(message: string, data?: any) {
  const result = await db.from<{ token: string }>("push_tokens").select("token");
  const tokens = (result.data || []).map((row) => row.token).filter((token) => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
  if (!tokens.length) return { success: true, sent: 0 };
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    signal: AbortSignal.timeout(10000),
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, sound: "default", title: "body-state admin", body: message, data: data || {}, priority: "high" }))),
  });
  return { success: response.ok, sent: tokens.length };
}

export async function sendPushToUser(token: string, message: string) {
  console.log('[PUSH] Would send to user:', token, message);
  return { success: true };
}

const push = {
  sendPushToAdmin,
  sendPushToUser,
};
export default push;
