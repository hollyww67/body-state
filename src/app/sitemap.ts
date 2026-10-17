import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { isShopVisible } from "@/lib/site-visibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://body-state.ru").replace(/\/$/, "");
  const now = new Date();
  const shopVisible = await isShopVisible();
  const [{ data: posts }, { data: programs }, { data: products }] = await Promise.all([
    db.from("blog_posts").select("slug,updated_at").eq("published", true).order("updated_at", { ascending: false }),
    db.from("psychology_programs").select("slug,updated_at").eq("is_active", true).order("updated_at", { ascending: false }),
    db.from("products").select("slug,updated_at").eq("is_active", true).order("updated_at", { ascending: false }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/bfm`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/brt`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/rehabilitation`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/about-rehabilitation`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/psychology`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/program`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/consultation`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/reviews`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/promotions`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/media`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/oferta`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/personal-data-consent`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/consent-publication`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/review-rules`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  return staticPages.concat(
    ...(shopVisible ? [{ url: `${baseUrl}/shop`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    (posts || []).map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    (programs || []).map((program) => ({
      url: `${baseUrl}/psychology/${program.slug}`,
      lastModified: program.updated_at ? new Date(program.updated_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    (shopVisible ? products || [] : []).map((product) => ({
      url: `${baseUrl}/shop/${product.slug}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );
}
