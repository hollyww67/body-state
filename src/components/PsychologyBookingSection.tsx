'use client';
import AppointmentBookingForm from '@/components/AppointmentBookingForm';
export default function PsychologyBookingSection({programId,price}:{programId:number;programTitle:string;price:number}){return <AppointmentBookingForm service="psychology" price={price} programId={programId}/>;}
