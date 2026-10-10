"use client";

import { useState } from "react";
import {trackFunnel} from '@/lib/funnel-analytics';
import { Brain, HandHelping } from "lucide-react";
import BfmBookingForm from "@/components/BfmBookingForm";
import PsychologyBookingForm from "@/components/PsychologyBookingForm";

type Service = "bfm" | "psychology";

const SERVICES = [
  { id: "bfm" as const, title: "Физическая реабилитация", description: "Работа с телом и фасциальной системой", duration: 90, icon: HandHelping },
  { id: "psychology" as const, title: "Психологическая реабилитация", description: "Индивидуальная психологическая консультация", duration: 90, icon: Brain },
];

export default function ServiceBookingForm({ bfmPrice, psychologyPrice }: { bfmPrice: number; psychologyPrice: number }) {
  const [service, setService] = useState<Service>("bfm");
  const chooseService=(value:Service)=>{setService(value);trackFunnel('service_selected',`form:${value}:`);};

  return (
    <div>
      <div className="mb-7">
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>1. Выберите процедуру</p>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Процедура">
          {SERVICES.map((item) => {
            const Icon = item.icon;
            const selected = service === item.id;
            return <button key={item.id} type="button" role="radio" aria-checked={selected} onClick={() => chooseService(item.id)} className="rounded-2xl border p-4 text-left transition-all" style={{ borderColor: selected ? "var(--primary)" : "var(--input-border)", background: selected ? "var(--primary-muted)" : "var(--input-bg)", boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)" : "none" }}>
              <span className="mb-3 grid h-9 w-9 place-items-center rounded-xl" style={{ background: selected ? "var(--primary)" : "var(--surface)", color: selected ? "white" : "var(--primary)" }}><Icon className="h-4 w-4" /></span>
              <span className="block font-semibold" style={{ color: "var(--foreground)" }}>{item.title}</span>
              <span className="mt-1 block text-xs leading-5" style={{ color: "var(--foreground-secondary)" }}>{item.description}</span>
              <span className="mt-2 block text-xs font-semibold" style={{ color: "var(--primary)" }}>{item.duration} минут</span>
            </button>;
          })}
        </div>
      </div>
      <div className="border-t pt-6" style={{ borderColor: "var(--glass-border)" }}>
        <p className="mb-4 text-sm font-semibold" style={{ color: "var(--foreground)" }}>2. Выберите свободное время</p>
        {service === "bfm" ? <BfmBookingForm price={bfmPrice} /> : <PsychologyBookingForm price={psychologyPrice} />}
      </div>
    </div>
  );
}
