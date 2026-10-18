"use client";

import AppointmentBookingForm from "@/components/AppointmentBookingForm";

export default function ServiceBookingForm({ bfmPrice, psychologyPrice }: { bfmPrice: number; psychologyPrice: number }) {
  return <AppointmentBookingForm service="bfm" price={bfmPrice} serviceOptions={[
    { id: "bfm", title: "Физическая реабилитация", description: "Индивидуальная работа с телом и фасциальной системой", price: bfmPrice },
    { id: "psychology", title: "Психологическая реабилитация", description: "Индивидуальная психологическая консультация", price: psychologyPrice },
  ]} />;
}
