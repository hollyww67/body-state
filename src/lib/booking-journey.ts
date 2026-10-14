import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { legalDetails } from '@/lib/legal';
import { getServicePrice } from '@/lib/service-prices';
import { validatePromoCode } from '@/lib/promo-codes';

export const JOURNEY_SERVICES = ['bfm','brt','psychology'] as const;
export type JourneyService = typeof JOURNEY_SERVICES[number];
export const isJourneyService = (v: string): v is JourneyService => JOURNEY_SERVICES.includes(v as JourneyService);
export const validBookingId = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export type JourneySnapshot = { title: string; duration: number; address: string | null; preparation: string | null; subtotal: number; discount: number; total: number; promoCode: string | null; format: 'online'|'offline' };
export type BookingJourney = { id: string; service: JourneyService; status: string; attendance:string|null; paymentChecking:boolean; paymentOption: string; paymentStatus: string; slotTime: string; holdExpiresAt: string | null; snapshot: JourneySnapshot | null; linkedToAccount: boolean };
export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function matchesAccessToken(token: string, hash?: string | null) {
  if (!hash || !/^[a-f0-9]{64}$/.test(hash) || token.length > 100) return false;
  return timingSafeEqual(Buffer.from(hashAccessToken(token),'hex'), Buffer.from(hash,'hex'));
}
export const createBookingAccess = () => { const token=randomBytes(32).toString('base64url'); return {token,hash:hashAccessToken(token)}; };
export async function createJourneySnapshot(service: JourneyService, fields: Record<string,unknown>, duration: number, client: Pick<PoolClient,'query'> = pool): Promise<JourneySnapshot> {
  const price = await getServicePrice(service,client);
  let title=price.label, subtotal=Number(price.price);
  if (service==='psychology' && fields.program_id) {
    const program=await client.query('SELECT title,price FROM psychology_programs WHERE id=$1 AND is_active=true',[fields.program_id]);
    if (!program.rows[0]) throw new Error('Программа недоступна');
    title=program.rows[0].title; subtotal=Number(program.rows[0].price);
  }
  if (!price.is_active || !Number.isFinite(subtotal) || subtotal<=0) throw new Error('Цена услуги не настроена');
  const promoCode=typeof fields.journey_promo_code==='string' && fields.payment_option!=='at_appointment' ? fields.journey_promo_code.trim().toUpperCase() : null;
  const applied=promoCode ? await validatePromoCode(promoCode, fields.program_id ? 'psychology_program' : service, subtotal, fields.account_user_id as string|undefined,client) : null;
  return {title,duration,address: fields.booking_type==='online' ? null : legalDetails.address || null,preparation:null,subtotal,discount:applied?.discount||0,total:applied?.total??subtotal,promoCode,format:fields.booking_type==='online'?'online':'offline'};
}
export async function loadJourney(service: JourneyService,id: string, client: Pick<PoolClient,'query'> = pool) {
  const r=await client.query(`SELECT b.*,s.slot_time,s.duration_minutes,EXISTS(SELECT 1 FROM orders o,jsonb_array_elements(o.items) i WHERE lower(i->>'bookingId')=b.id::text AND i->>'bookingType'=$2 AND o.status='pending') AS payment_checking FROM ${service}_bookings b JOIN slots s ON s.id=b.slot_id WHERE b.id=$1`,[id,service]);
  return r.rows[0] || null;
}
export function publicJourney(service:JourneyService, b: Record<string,unknown>): BookingJourney {
  const iso=(value:unknown)=>(value instanceof Date?value:new Date(String(value))).toISOString();
  return {id:String(b.id),service,status:String(b.status),attendance:typeof b.attendance==='string'?b.attendance:null,paymentChecking:Boolean(b.payment_checking),paymentOption:String(b.payment_option),paymentStatus:String(b.payment_status),slotTime:iso(b.slot_time),holdExpiresAt:b.hold_expires_at?iso(b.hold_expires_at):null,snapshot:b.journey_snapshot as JourneySnapshot|null,linkedToAccount:Boolean(b.account_user_id)};
}
function icsEscape(v:string) {return v.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function fold(line:string) {let result='',chunk=''; for(const ch of line){if(Buffer.byteLength(chunk+ch)>73){result+=chunk+'\r\n ';chunk='';}chunk+=ch;}return result+chunk;}
export function appointmentICS(j:BookingJourney) {
  if(!j.snapshot || !j.snapshot.duration || j.status!=='confirmed') throw new Error('Календарь доступен для подтверждённой записи с указанной длительностью');
  const utc=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const start=new Date(j.slotTime),end=new Date(start.getTime()+j.snapshot.duration*60000);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Body State//Appointments//RU','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${j.service}-${j.id}@body-state.ru`,`DTSTAMP:${utc(new Date())}`,`DTSTART:${utc(start)}`,`DTEND:${utc(end)}`,`SUMMARY:${icsEscape(j.snapshot.title)}`,...(j.snapshot.address?[`LOCATION:${icsEscape(j.snapshot.address)}`]:[]),'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'];
  return lines.map(fold).join('\r\n')+'\r\n';
}
