"use client";
import { AdminPageHeader, AdminLoadingState, AdminBadge, AdminButton, AdminInput, AdminSelect, AdminCheckbox, AdminCard } from '@/components/admin/ui';

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Percent, RefreshCw, Sparkles, Tag, TicketPercent } from "lucide-react";
import { toast } from "sonner";

type PromoCode = {
  id: string; code: string; discount_type: "percent" | "fixed"; discount_value: number;
  service_codes: string[]; max_redemptions: number | null; redeemed_count: number;
  reserved_count: number; expires_at: string | null; is_active: boolean; created_at: string;
  assigned_account_user_id?: string | null; source?: "manual" | "loyalty";
};

const SERVICES = [
  { code: "bfm", label: "Физическая реабилитация" },
  { code: "brt", label: "БРТ" },
  { code: "psychology", label: "Психологическая реабилитация" },
  { code: "psychology_program", label: "Психологические программы" },
];

export default function PromoCodesAdminPage() {
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [serviceCodes, setServiceCodes] = useState(SERVICES.map((item) => item.code));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promo-codes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить промокоды");
      setItems(data.promoCodes || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code || undefined, discountType, discountValue: Number(discountValue), maxRedemptions: maxRedemptions || null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, serviceCodes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать промокод");
      setItems((current) => [data.promoCode, ...current]);
      setCode("");
      toast.success(`Промокод ${data.promoCode.code} создан`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка создания"); }
    finally { setSaving(false); }
  };

  const toggle = async (item: PromoCode) => {
    setUpdatingId(item.id);
    try {
      const response = await fetch("/api/admin/promo-codes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isActive: !item.is_active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось обновить промокод");
      setItems((current) => current.map((currentItem) => currentItem.id === item.id ? data.promoCode : currentItem));
      toast.success(data.promoCode.is_active ? "Промокод включён" : "Промокод отключён");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка обновления"); }
    finally { setUpdatingId(""); }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Промокод скопирован");
  };

  const serviceLabel = (codes: string[]) => codes.length === SERVICES.length ? "Все процедуры" : SERVICES.filter((item) => codes.includes(item.code)).map((item) => item.label).join(", ");

  return <div className="admin-promo-codes-page bs-page">
    <AdminPageHeader title="Промокоды на процедуры" description="Создавайте уникальные скидки, задавайте срок действия и контролируйте количество применений."><AdminButton variant="outline" type="button" onClick={() => void load()} className="self-start md:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Обновить</AdminButton></AdminPageHeader>

    <div className="grid items-start gap-6 xl:grid-cols-[390px_1fr]">
      <form onSubmit={create} className="bs-form xl:sticky xl:top-28">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[var(--bs-radius-control)]" style={{ background: "var(--bs-primary-soft)", color: "var(--bs-primary)" }}><Sparkles className="h-5 w-5" /></span><div><h2 className="bs-section-heading" style={{ color: "var(--bs-foreground)" }}>Новый промокод</h2><p className="text-xs" style={{ color: "var(--bs-muted)" }}>Оставьте код пустым для генерации</p></div></div>
        <label className="grid gap-2 text-sm font-medium">Код<AdminInput value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))} placeholder="BODY-XXXXXXXX" minLength={4} className="font-mono uppercase tracking-wider" /></label>
        <div className="grid grid-cols-[1fr_120px] gap-3"><label className="grid gap-2 text-sm font-medium">Тип скидки<AdminSelect value={discountType} onChange={(event) => setDiscountType(event.target.value as "percent" | "fixed")}><option value="percent">Процент</option><option value="fixed">Сумма, ₽</option></AdminSelect></label><label className="grid gap-2 text-sm font-medium">Размер<AdminInput required type="number" min="1" max={discountType === "percent" ? 99 : 1000000} step={discountType === "percent" ? 1 : 100} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} /></label></div>
        <fieldset><legend className="mb-2 text-sm font-medium">Действует на</legend><div className="grid gap-2">{SERVICES.map((service) => <label key={service.code} className="flex items-center gap-3 min-h-11 rounded-[var(--bs-radius-control)] border p-3 text-sm" style={{ borderColor: "var(--bs-border)" }}><AdminCheckbox checked={serviceCodes.includes(service.code)} onChange={(event) => setServiceCodes((current) => event.target.checked ? [...current, service.code] : current.filter((codeValue) => codeValue !== service.code))} /><span>{service.label}</span></label>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="grid gap-2 text-sm font-medium">Лимит применений<AdminInput type="number" min="1" step="1" value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value)} placeholder="Без лимита" /></label><label className="grid gap-2 text-sm font-medium">Действует до<AdminInput type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label></div>
        <AdminButton variant="primary" type="submit" disabled={saving || !serviceCodes.length} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketPercent className="h-4 w-4" />}{code ? "Создать промокод" : "Сгенерировать промокод"}</AdminButton>
      </form>

      <section className="grid gap-3">
        {loading ? <AdminLoadingState>Загружаем промокоды…</AdminLoadingState> : items.length === 0 ? <AdminCard className="text-center"><Tag className="mx-auto mb-3 h-8 w-8 opacity-30" /><h2 className="bs-section-heading">Промокодов пока нет</h2><p className="mt-2 text-sm" style={{ color: "var(--bs-muted)" }}>Создайте первый уникальный код в форме слева.</p></AdminCard> : items.map((item) => {
          const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
          const exhausted = item.max_redemptions !== null && item.redeemed_count + item.reserved_count >= item.max_redemptions;
          const available = item.is_active && !expired && !exhausted;
          return <AdminCard key={item.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminButton variant="outline" type="button" onClick={() => void copy(item.code)} className="gap-2 font-mono tracking-wider">{item.code}<Copy className="h-3.5 w-3.5" /></AdminButton><AdminBadge tone={available ? "success" : "neutral"}>{expired ? "Истёк" : exhausted ? "Лимит исчерпан" : item.is_active ? "Активен" : "Отключён"}</AdminBadge>{item.source === "loyalty" && <AdminBadge tone="info">Персональная награда</AdminBadge>}</div><p className="bs-money mt-3 flex items-center gap-2" style={{ color: "var(--bs-primary)" }}>{item.discount_type === "percent" ? <Percent className="h-5 w-5" /> : <Tag className="h-5 w-5" />}{Number(item.discount_value).toLocaleString("ru-RU")}{item.discount_type === "percent" ? "%" : " ₽"} скидка</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--bs-muted)" }}>{serviceLabel(item.service_codes)}</p></div><AdminButton variant={item.is_active ? "destructive" : "outline"} type="button" onClick={() => void toggle(item)} disabled={updatingId === item.id || expired} className="shrink-0 gap-2">{updatingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.is_active ? null : <Check className="h-4 w-4" />}{item.is_active ? "Отключить" : "Включить"}</AdminButton></div><div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-xs sm:grid-cols-4" style={{ borderColor: "var(--bs-border)", color: "var(--bs-muted)" }}><span>Использовано<br/><b style={{ color: "var(--bs-foreground)" }}>{item.redeemed_count}</b></span><span>В оплате<br/><b style={{ color: "var(--bs-foreground)" }}>{item.reserved_count}</b></span><span>Лимит<br/><b style={{ color: "var(--bs-foreground)" }}>{item.max_redemptions ?? "∞"}</b></span><span>До<br/><b style={{ color: "var(--bs-foreground)" }}>{item.expires_at ? new Date(item.expires_at).toLocaleDateString("ru-RU") : "без срока"}</b></span></div></AdminCard>;
        })}
      </section>
    </div>
  </div>;
}
