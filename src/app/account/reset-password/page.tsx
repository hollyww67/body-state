import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Container from "@/components/ui/Container";
import ResetPasswordClient from "@/components/account/ResetPasswordClient";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <><Navbar /><main className="min-h-screen pb-20 pt-32" style={{ background: "var(--bg)" }}><Container><ResetPasswordClient token={token} /></Container></main></>;
}
