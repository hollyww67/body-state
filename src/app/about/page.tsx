import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { supabaseAdmin } from "@/lib/supabase";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "О специалисте",
  description: "Информация о специалисте",
};

export default async function AboutPage() {
  const { data } = await supabaseAdmin.from("page_content").select("*").eq("slug", "about").single();

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
            <Sparkles className="w-4 h-4" /> О специалисте
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-6" style={{ color: 'var(--foreground)' }}>
            {data?.title || "О специалисте"}
          </h1>
          <div
            className="prose prose-lg max-w-none leading-relaxed"
            style={{ color: 'var(--foreground-secondary)' }}
            dangerouslySetInnerHTML={{ __html: data?.content || "" }}
          />
        </div>
      </section>
    </main>
  );
}
