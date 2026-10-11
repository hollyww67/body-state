import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";
import AccountClient from "@/components/account/AccountClient";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <><Navbar /><main className="min-h-screen pb-20 pt-28" style={{ background: "var(--bg)" }}><Container><AccountClient /></Container></main></>;
}
