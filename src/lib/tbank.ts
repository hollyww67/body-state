import crypto from "crypto";
import https from "https";

const TERMINAL_KEY = process.env.TINKOFF_TERMINAL_KEY || "";
const PASSWORD = process.env.TINKOFF_PASSWORD || "";

export function generateToken(params: Record<string, unknown>, password: string = PASSWORD): string {
  const tokenParams: Record<string, string> = { Password: password };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || typeof value === "object") continue;
    tokenParams[key] = String(value);
  }
  const tokenString = Object.keys(tokenParams)
    .sort()
    .map((key) => tokenParams[key])
    .join("");
  return crypto.createHash("sha256").update(tokenString, "utf8").digest("hex");
}

export function createPaymentStatusToken(orderId: string): string {
  return generateToken({ Purpose: "payment-status", OrderId: orderId }, PASSWORD);
}

export function verifyPaymentStatusToken(orderId: string, token: string): boolean {
  if (!PASSWORD || !token) return false;
  const expected = createPaymentStatusToken(orderId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

/** Verify T‑Bank NotificationURL callback signature. */
export function verifyNotificationToken(body: Record<string, unknown>): boolean {
  if (!PASSWORD || !TERMINAL_KEY) return false;
  const token = body.Token;
  if (typeof token !== "string" || !token) return false;

  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === "Token") continue;
    if (value === undefined || value === null || typeof value === "object") continue;
    params[key] = value;
  }

  if (params.TerminalKey && String(params.TerminalKey) !== TERMINAL_KEY) {
    return false;
  }

  const expected = generateToken(params, PASSWORD);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

function postJson(path: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const payload = { ...params, Token: generateToken(params, PASSWORD) };
  const payloadString = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "securepay.tinkoff.ru",
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payloadString),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.setTimeout(10_000, () => req.destroy(new Error("T-Bank request timeout")));
    req.write(payloadString);
    req.end();
  });
}

export async function getPaymentState(paymentId: string): Promise<Record<string, unknown> | null> {
  if (!TERMINAL_KEY || !PASSWORD) return null;
  return postJson("/v2/GetState", {
    TerminalKey: TERMINAL_KEY,
    PaymentId: paymentId,
  });
}

export async function cancelPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  if (!TERMINAL_KEY || !PASSWORD) return null;
  return postJson("/v2/Cancel", {
    TerminalKey: TERMINAL_KEY,
    PaymentId: paymentId,
  });
}

export { TERMINAL_KEY, PASSWORD };
