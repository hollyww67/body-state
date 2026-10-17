"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ShopVisibilityLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      fetch("/api/site-visibility", { cache: "no-store", signal: requestController.signal })
        .then((r) => r.ok ? r.json() : { shopVisible: false })
        .then((data) => { if (active && !requestController.signal.aborted) setVisible(data.shopVisible === true); })
        .catch(() => { if (active && !requestController.signal.aborted) setVisible(false); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", refresh); };
  }, [pathname]);
  return visible ? <Link href="/shop" className="footer-link">Магазин</Link> : null;
}
