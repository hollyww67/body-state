export type ProviderResult = { status:'accepted'|'delivered'|'retry'|'failed'|'not_configured'|'uncertain'; id?:string; error?:string; retryAfterSeconds?:number };
// Never persist provider bodies, exception messages, destination or message text.
export const providerFailure = (status:number): ProviderResult => ({status:status===429||status>=500?'retry':'failed',error:status===429?'provider_rate_limited':status>=500?'provider_unavailable':'provider_rejected'});
