import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseAdmin } from "@/lib/supabase";
import AddToCartButton from "./AddToCartButton";
import ReviewSection from "./ReviewSection";
import ProductGallery from "./ProductGallery";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: product } = await supabaseAdmin.from("products").select("*").eq("slug", slug).single();
  if (!product) return { title: "Товар не найден" };
  return { title: product.name, description: product.description?.slice(0, 160) };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: product } = await supabaseAdmin.from("products").select("*").eq("slug", slug).single();
  if (!product) notFound();

  return (
    <main style={{ background: 'var(--bg)' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--primary)' }}>
            <ArrowLeft className="w-4 h-4" /> Назад в магазин
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-16">
            <ProductGallery images={product.images || []} productName={product.name} />

            <div>
              <h1 className="text-3xl md:text-4xl font-semibold leading-[1.1] mb-4" style={{ color: 'var(--foreground)' }}>{product.name}</h1>
              <p className="text-3xl font-bold mb-6" style={{ color: 'var(--primary)' }}>{product.price} ₽</p>

              <div className="space-y-4 mb-8">
                <p className="text-base leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>{product.description}</p>
                {product.composition && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Состав</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>{product.composition}</p>
                  </div>
                )}
                {product.volume_ml && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Объём</h3>
                    <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{product.volume_ml} мл</p>
                  </div>
                )}
              </div>

              <AddToCartButton productId={product.id} slug={product.slug} name={product.name} price={product.price} image={product.images?.[0]} stock={product.stock} />
            </div>
          </div>

          <ReviewSection productId={product.id} />
        </div>
      </section>
    </main>
  );
}
