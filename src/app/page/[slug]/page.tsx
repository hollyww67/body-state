import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseAdmin.from("page_content").select("title").eq("slug", slug).single();
  if (!data) return { title: "Страница не найдена" };
  return { title: data.title };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await supabaseAdmin.from("page_content").select("*").eq("slug", slug).single();
  if (!data) notFound();

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-6" style={{ color: 'var(--foreground)' }}>
            {data.title}
          </h1>
          <div
            className="prose prose-lg max-w-none leading-relaxed"
            style={{ color: 'var(--foreground-secondary)' }}
            dangerouslySetInnerHTML={{ __html: data.content }}
          />
        </div>
      </section>
    </main>
  );
}
