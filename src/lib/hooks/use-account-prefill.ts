"use client";

import { useEffect, useState } from "react";

export type AccountPrefill = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function useAccountPrefill() {
  const [profile, setProfile] = useState<AccountPrefill | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setProfile({
          display_name: data.display_name || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return profile;
}
