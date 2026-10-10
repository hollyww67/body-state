import BookingJourneyClient from '@/components/BookingJourneyClient';
export const metadata={title:'Ваша запись',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{service:string;id:string}>}){const {service,id}=await params;return <main className="mx-auto max-w-3xl px-4 pb-16 pt-28"><h1 className="mb-6 text-3xl font-semibold">Управление записью</h1><BookingJourneyClient service={service} id={id}/></main>;}
