"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ShopVisibilityLink() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/site-visibility", { cache: "no-store" })
        .then((r) => r.ok ? r.json() : { shopVisible: false })
        .then((data) => { if (active) setVisible(data.shopVisible === true); })
        .catch(() => { if (active) setVisible(false); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);
  return visible ? <Link href="/shop" className="footer-link">Магазин</Link> : null;
}
