import { notFound } from "next/navigation";
import { isShopVisible } from "@/lib/site-visibility";

export const dynamic = "force-dynamic";

/** Guards /shop, product details, cart and checkout. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  if (!(await isShopVisible())) notFound();
  return children;
}
