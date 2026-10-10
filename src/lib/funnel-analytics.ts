'use client';
export const FUNNEL_EVENTS=['service_selected','slot_selected','booking_created','online_payment_started'] as const;
export type FunnelEvent=typeof FUNNEL_EVENTS[number];
export function trackFunnel(event:FunnelEvent,localDedupKey?:string) {
  if(typeof window==='undefined'||!FUNNEL_EVENTS.includes(event))return;
  try{
    if(localStorage.getItem('privacy-analytics')!=='accepted')return;
    const umami=(window as Window & {umami?:{track:(payload:Record<string,string>)=>unknown}}).umami;
    if(!umami)return;
    const website=process.env.NEXT_PUBLIC_UMAMI_ID;
    if(!website)return;
    // Object payload avoids the tracker's implicit URL, title and referrer.
    const payload={website,name:event,url:'/booking-flow',title:'Booking flow'};
    const send=()=>{void Promise.resolve(umami.track(payload)).catch(()=>undefined);};
    if(localDedupKey){const key=`funnel:${event}:${localDedupKey}`;if(sessionStorage.getItem(key))return;send();sessionStorage.setItem(key,'1');}
    else send();
  }catch{/* Analytics must not interrupt booking. */}
}
