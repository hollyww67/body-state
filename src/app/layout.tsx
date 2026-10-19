import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Manrope, Playfair_Display } from "next/font/google";
import { DEFAULT_THEME, THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import UmamiScript from "@/components/UmamiScript";
import SiteChrome from "@/components/SiteChrome";
import PublicSurface from "@/components/PublicSurface";
import "./quiet-precision.css";
import "./theme-tokens.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const reviewSerif = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-review-serif" });
const quietSerif = Playfair_Display({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], display: "swap", variable: "--font-quiet-serif" });
const quietSans = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-quiet-sans" });

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
    <html lang="ru" suppressHydrationWarning data-scroll-behavior="smooth" data-theme={DEFAULT_THEME} data-admin-theme={DEFAULT_THEME} style={{ colorScheme: "light" }}>
      <head>
        <script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${manrope.variable} ${reviewSerif.variable} ${quietSerif.variable} ${quietSans.variable} font-sans`} style={{ fontFamily: "'Manrope', sans-serif" }}>
        <ThemeProvider />
        <PublicSurface>{children}<SiteChrome /></PublicSurface>
        <UmamiScript />
      </body>
    </html>
  );
}
