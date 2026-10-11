"use client";

import dynamic from "next/dynamic";

export const AnimatedBackground = dynamic(() => import("@/components/AnimatedBackground"), { ssr: false });
export const Snowfall = dynamic(() => import("@/components/Snowfall"), { ssr: false });
