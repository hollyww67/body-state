const SMSAERO_EMAIL = process.env.SMSAERO_EMAIL;
const SMSAERO_API_KEY = process.env.SMSAERO_API_KEY;
import { providerFailure, type ProviderResult } from '@/lib/notification-result';

export async function deliverSMS(phone: string, message: string, sign: string = "SMS Aero"): Promise<ProviderResult> {
  if (!SMSAERO_EMAIL || !SMSAERO_API_KEY) {
    return {status:'not_configured',error:'channel_not_configured'};
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
      signal: AbortSignal.timeout(10000),
    });
    if(!res.ok) return providerFailure(res.status);
    const data = await res.json();

    if (!data.success) {
      return {status:'failed',error:'provider_rejected'};
    }

    return {status:'accepted',id:data.data?.id?String(data.data.id):undefined};
  } catch {
    return {status:'uncertain',error:'provider_outcome_unknown'};
  }
}
export async function sendSMS(phone:string,message:string,sign='SMS Aero'):Promise<boolean> {
  const r=await deliverSMS(phone,message,sign);return r.status==='accepted'||r.status==='delivered';
}
