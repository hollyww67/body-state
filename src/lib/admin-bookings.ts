import { db } from '@/lib/db';
import { refreshSlotOccupancy } from '@/lib/slots';
import { recordSuccessfulVisit } from '@/lib/loyalty';
import { enqueueAppointment, invalidateAppointmentNotifications, scheduleReminder } from '@/lib/appointment-notifications';
import { isJourneyService } from '@/lib/booking-journey';
import { findBookingPaymentCases } from '@/lib/payment-cases';

const TABLES = ['bfm_bookings', 'brt_bookings', 'psychology_bookings', 'program_enrollments', 'consultation_enrollments'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class BookingActionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

/** Serialize status changes with bookings, breaks and rescheduling. */
export async function updateAdminBooking(id: string, action: string, link?: { email: string; reason: string; confirmed: boolean }) {
  const numericId = /^[1-9][0-9]{0,17}$/.test(id);
  if (!uuid.test(id) && !numericId) throw new BookingActionError('Некорректный ID', 400);
  return db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [913202609]);
    await client.query("SELECT set_config('body_state.actor','admin',true)");
    for (const table of TABLES) {
      if ((table === 'consultation_enrollments') !== numericId) continue;
      const found = await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
      const booking = found.rows[0];
      if (!booking) continue;
      if (action === 'link_account') {
        if (!link?.confirmed || !link.email || link.reason.trim().length < 5) throw new BookingActionError('Подтвердите личность клиента и укажите основание привязки', 400);
        await client.query("SELECT set_config('body_state.reason',$1,true)",[link.reason.trim()]);
        const account = await client.query('SELECT id FROM account_users WHERE lower(email)=$1 AND disabled_at IS NULL', [link.email.toLowerCase().trim()]);
        if (!account.rows[0]) throw new BookingActionError('Аккаунт с таким email не найден', 404);
        const accountId = account.rows[0].id;
        if (booking.account_user_id && booking.account_user_id !== accountId) throw new BookingActionError('Запись уже принадлежит другому аккаунту');
        if (!booking.account_user_id) {
          await client.query(`UPDATE ${table} SET account_user_id=$2, updated_at=now() WHERE id=$1`, [id, accountId]);
          if (!numericId) await client.query('UPDATE client_visits SET account_user_id=$2 WHERE booking_id=$1 AND account_user_id IS NULL', [id, accountId]);
          await client.query('INSERT INTO booking_account_links(booking_id,booking_table,account_user_id,reason) VALUES($1,$2,$3,$4)', [id,table,accountId,link.reason]);
        }
        return { ...booking, account_user_id: accountId, table };
      }
      if (!['confirmed','completed','cancelled','no_show'].includes(action)) throw new BookingActionError('Некорректный статус', 400);
      const target = action === 'no_show' ? 'cancelled' : action;
      if (booking.status === target) return { ...booking, table };
      if (['completed','cancelled'].includes(booking.status)) throw new BookingActionError('Закрытую запись нельзя восстановить. Создайте новую на свободное время.');
      if (target === 'confirmed' && table.endsWith('_bookings')) throw new BookingActionError('Оплата подтверждается банком. Для оплаты на приёме создайте новую запись.');
      if ((target === 'completed' || action === 'no_show') && booking.status !== 'confirmed') throw new BookingActionError('Сначала подтвердите запись');
      if (booking.slot_id && (target === 'completed' || action === 'no_show')) {
        const slot = await client.query('SELECT slot_time <= now() AS started FROM slots WHERE id=$1', [booking.slot_id]);
        if (!slot.rows[0]?.started) throw new BookingActionError('Нельзя отметить посещение до начала приёма');
      }
      const attendance = target === 'completed' ? 'present' : action === 'no_show' ? 'absent' : null;
      await client.query(`UPDATE ${table} SET status=$2, attendance=$3, updated_at=now() WHERE id=$1`, [id,target,attendance]);
      const service=table.replace('_bookings','');
      if(isJourneyService(service)&&target==='confirmed'){
        await invalidateAppointmentNotifications(client,service,id);
        await enqueueAppointment(client,service,id,'confirmed');
        await scheduleReminder(client,service,id);
      }
      if(isJourneyService(service) && ['cancelled','completed'].includes(target)) {
        await invalidateAppointmentNotifications(client,service,id);
        if(target==='cancelled'){await enqueueAppointment(client,service,id,'cancelled');await findBookingPaymentCases(id,service,client);}
      }
      if (target === 'completed' && table !== 'consultation_enrollments') {
        await recordSuccessfulVisit({ accountUserId: booking.account_user_id, phone: booking.client_phone, email: booking.client_email,
          serviceCode: table === 'bfm_bookings' ? 'bfm' : table === 'brt_bookings' ? 'brt' : table === 'program_enrollments' || booking.program_id ? 'psychology_program' : 'psychology',
          bookingId: id }, client);
      }
      await refreshSlotOccupancy(client);
      return { ...booking, status: target, attendance, table, changed: true };
    }
    throw new BookingActionError('Запись не найдена', 404);
  });
}
