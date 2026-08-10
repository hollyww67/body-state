import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import UmamiScript from "@/components/UmamiScript";
import { AnimatedBackground, ChatWidget, Snowfall } from "@/components/LazyComponents";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });

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
  icons: { icon: "/logo.png" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${manrope.variable} font-sans`} style={{ fontFamily: "'Manrope', sans-serif" }}>
        <ThemeProvider />
        <AnimatedBackground />
        <Snowfall />
        {children}
        <Footer />
        <ChatWidget />
        <UmamiScript />
      </body>
    </html>
  );
}
