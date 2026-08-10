const SMSAERO_EMAIL = process.env.SMSAERO_EMAIL;
const SMSAERO_API_KEY = process.env.SMSAERO_API_KEY;

export async function sendSMS(phone: string, message: string, sign: string = "SMS Aero"): Promise<boolean> {
  if (!SMSAERO_EMAIL || !SMSAERO_API_KEY) {
    console.warn("SMS Aero not configured");
    return false;
  }

  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const auth = Buffer.from(`${SMSAERO_EMAIL}:${SMSAERO_API_KEY}`).toString("base64");

    const url = `https://gate.smsaero.ru/v2/sms/send?number=${cleanPhone}&text=${encodeURIComponent(message)}&sign=${encodeURIComponent(sign)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json",
      },
    });

    const data = await res.json();

    if (!data.success) {
      console.error("SMS Aero error:", data.message || data);
      return false;
    }

    return true;
  } catch (e) {
    console.error("SMS send error:", e);
    return false;
  }
}
