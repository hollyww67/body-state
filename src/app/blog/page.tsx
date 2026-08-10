import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowRight } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Блог",
  description: "Статьи и заметки о теле, фасциях, нервной системе и бережном подходе к восстановлению.",
};

export default async function BlogPage() {
  const { data: posts } = await supabaseAdmin
    .from("blog_posts")
    .select("slug, title, excerpt, image, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <main style={{ background: 'var(--bg)' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-8" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
            <ArrowRight className="w-4 h-4" /> Блог
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.05] mb-6" style={{ color: 'var(--foreground)' }}>
            Статьи и заметки
          </h1>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--foreground-secondary)' }}>
            О теле, фасциях, нервной системе и бережном подходе к восстановлению.
          </p>

          {!posts || posts.length === 0 ? (
            <p className="text-[#6B7280]">Пока нет статей</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post: any) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="glass-feature rounded-2xl p-6 block hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-sm mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                    {new Date(post.created_at).toLocaleDateString("ru")}
                  </p>
                  <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{post.title}</h2>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{post.excerpt}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
