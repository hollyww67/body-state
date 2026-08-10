// Временная заглушка для push-уведомлений
// TODO: установить firebase-admin и настроить правильно

export async function sendPushToAdmin(message: string, data?: any) {
  console.log('[PUSH] Would send:', message, data);
  return { success: true, message: 'Push notifications disabled' };
}

export async function sendPushToUser(token: string, message: string) {
  console.log('[PUSH] Would send to user:', token, message);
  return { success: true };
}

export default {
  sendPushToAdmin,
  sendPushToUser,
};
