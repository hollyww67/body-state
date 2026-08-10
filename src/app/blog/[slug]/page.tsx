import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ArrowLeft } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await supabaseAdmin.from("blog_posts").select("title, excerpt").eq("slug", slug).eq("published", true).single();
  if (!post) return { title: "Статья не найдена" };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: post } = await supabaseAdmin.from("blog_posts").select("*").eq("slug", slug).eq("published", true).single();
  if (!post) notFound();

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <article className="pt-32 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--primary)' }}>
            <ArrowLeft className="w-4 h-4" /> Назад в блог
          </Link>
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>
            {new Date(post.created_at).toLocaleDateString("ru")}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-[1.15] mb-6" style={{ color: 'var(--foreground)' }}>
            {post.title}
          </h1>
          {post.image && <img src={post.image} alt={post.title} className="w-full rounded-2xl mb-8" />}
          <div className="prose prose-lg max-w-none leading-relaxed" style={{ color: 'var(--foreground-secondary)' }} dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      </article>
    </main>
  );
}
