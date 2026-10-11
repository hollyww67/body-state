'use client';
import {useEffect,useState} from 'react';
import BookingReceipt from '@/components/BookingReceipt';
import type {BookingJourney} from '@/lib/booking-journey';
export default function BookingJourneyClient({service,id}:{service:string;id:string}){
 const [booking,setBooking]=useState<BookingJourney|null>(null),[token,setToken]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let access=window.location.hash.slice(1);try{access=access||sessionStorage.getItem(`booking-access:${service}:${id}`)||'';}catch{/* Account or fragment authorization still works without storage. */}setToken(access);setError('');const c=new AbortController();void fetch(`/api/booking/${service}/${id}`,{headers:access?{Authorization:`Bearer ${access}`}:{},cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setBooking(d.booking);}).catch(e=>{if(!c.signal.aborted)setError(e.message||'Не удалось загрузить запись');});return()=>c.abort();},[service,id,attempt]);
 if(error)return <div role="alert"><p>{error}</p><button className="ds-secondary-button mt-4 min-h-12" onClick={()=>setAttempt(v=>v+1)}>Повторить</button></div>;
 return booking?<BookingReceipt initial={booking} accessToken={token}/>:<p role="status">Загружаем запись…</p>;
}
