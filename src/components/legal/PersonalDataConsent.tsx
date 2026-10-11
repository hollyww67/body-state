"use client";

import Link from "next/link";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  publication?: boolean;
};

export default function PersonalDataConsent({ checked, onChange, id, publication = false }: Props) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-left text-xs leading-5" style={{ color: "var(--foreground-secondary)" }}>
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span>
        {publication ? "Я даю отдельное согласие на публикацию отзыва на сайте на условиях " : "Я даю отдельное согласие на обработку персональных данных на условиях "}
        <Link href={publication ? "/consent-publication" : "/personal-data-consent"} target="_blank" className="underline underline-offset-2">согласия</Link>
        {!publication && <> и подтверждаю, что ознакомлен(а) с <Link href="/privacy" target="_blank" className="underline underline-offset-2">Политикой обработки персональных данных</Link></>}.
      </span>
    </label>
  );
}
