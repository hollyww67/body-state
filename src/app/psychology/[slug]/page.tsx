import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import PsychologyBookingSection from "@/components/PsychologyBookingSection";
import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

async function getProgram(slug: string) {
  const { data, error } = await db
    .from("psychology_programs")
    .select("id, title, slug, description, price, duration, features")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) console.error("[Psychology] Program load failed", error);
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  return program
    ? { title: String(program.title), description: String(program.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) }
    : { title: "Программа не найдена", robots: { index: false, follow: false } };
}

export default async function ProgramPage({ params }: PageProps) {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();

  const price = Number(program.price) || 0;
  const features = Array.isArray(program.features) ? program.features.map(String) : [];

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />
      <section className="px-4 pb-16 pt-32">
        <div className="mx-auto max-w-4xl">
          <Link href="/psychology" className="mb-8 inline-flex items-center gap-2" style={{ color: "var(--primary)" }}>
            <ArrowLeft className="h-4 w-4" />
            Назад к программам
          </Link>

          <h1 className="mb-6 text-3xl font-bold lg:text-4xl" style={{ color: "var(--foreground)" }}>{String(program.title)}</h1>
          <div className="prose-content" style={{ lineHeight: "1.8", color: "var(--foreground-secondary)" }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(String(program.description || "")) }} />

          <div className="mt-8 mb-8 flex flex-wrap gap-6 rounded-2xl p-6" style={{ background: "var(--bg-secondary)" }}>
            <div className="flex items-center gap-2"><Clock className="h-5 w-5" style={{ color: "var(--primary)" }} /><span>{String(program.duration || "По согласованию")}</span></div>
            <strong className="text-2xl" style={{ color: "var(--primary)" }}>{price.toLocaleString("ru-RU")} ₽</strong>
          </div>

          {features.length > 0 && <div className="mb-8"><h2 className="mb-4 text-xl font-semibold">Что входит</h2><ul className="space-y-3">{features.map((feature) => <li key={feature} className="flex items-start gap-3"><span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--primary)" }} /><span style={{ color: "var(--foreground-secondary)" }}>{feature}</span></li>)}</ul></div>}

          <h2 className="mb-6 text-2xl font-semibold">Записаться на программу</h2>
          <div className="glass-feature rounded-3xl p-5 sm:p-7">
            <PsychologyBookingSection programId={Number(program.id)} programTitle={String(program.title)} price={price} />
          </div>
        </div>
      </section>
    </main>
  );
}
