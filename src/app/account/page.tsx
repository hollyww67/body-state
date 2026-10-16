import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";
import AccountClient from "@/components/account/AccountClient";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <><Navbar /><main className="min-h-screen pb-20 pt-28" style={{ background: "var(--bg)" }}><Container><AccountClient /><nav aria-label="Настройки кабинета" className="mx-auto mt-8 max-w-4xl"><Link href="/account/notifications" className="ds-secondary-button">Настройки уведомлений</Link></nav></Container></main></>;
}
