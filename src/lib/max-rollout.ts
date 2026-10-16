// Missing mode preserves the existing full rollout. Production admin launch
// must explicitly set ADMIN_ONLY=true. Invalid values fail closed.
export const maxEnabled = () => process.env.NOTIFICATIONS_MAX_V1_ENABLED === 'true'
  && [undefined, 'true', 'false'].includes(process.env.NOTIFICATIONS_MAX_V1_ADMIN_ONLY);
export const maxClientsEnabled = () => maxEnabled()
  && process.env.NOTIFICATIONS_MAX_V1_ADMIN_ONLY !== 'true';
