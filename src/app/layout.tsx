import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import UmamiScript from "@/components/UmamiScript";
import SiteChrome from "@/components/SiteChrome";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const reviewSerif = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-review-serif" });

export const metadata: Metadata = {
  metadataBase: new URL("https://body-state.ru"),
  title: {
    default: "Через тело к состоянию | Реабилитолог в Хотьково",
    template: "%s | Через тело к состоянию",
  },
  description: "Бережная социально-психологическая и физическая реабилитация в Хотьково. Помогаю восстановить ресурс организма через работу с нервной системой и телом.",
  keywords: ["реабилитолог Хотьково", "психологическая реабилитация", "физическая реабилитация", "биорезонансная коррекция"],
  openGraph: {
    title: "Через тело к состоянию",
    description: "Бережное восстановление нервной системы и тела с индивидуальной программой.",
    images: ["/logo.png"],
    type: "website",
    locale: "ru_RU",
    siteName: "Через тело к состоянию",
  },
  twitter: { card: "summary_large_image", title: "Через тело к состоянию", description: "Бережная реабилитация в Хотьково.", images: ["/logo.png"] },
  icons: {
    icon: [{ url: "/logo.png?v=20260908", type: "image/png", sizes: "any" }],
    shortcut: ["/logo.png?v=20260908"],
    apple: [{ url: "/logo.png?v=20260908", type: "image/png", sizes: "180x180" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${reviewSerif.variable} font-sans`} style={{ fontFamily: "'Manrope', sans-serif" }}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');if(t==='violet'||t==='teal'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='violet'?'dark':'light'}var a=localStorage.getItem('admin-theme');document.documentElement.setAttribute('data-admin-theme',a==='violet'?'violet':'light')}catch(e){}})()`}
        </Script>
        <ThemeProvider />
        {children}
        <SiteChrome />
        <UmamiScript />
      </body>
    </html>
  );
}
