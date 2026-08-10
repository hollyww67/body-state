"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import QRCard from "@/components/qr/QRCard";
import QRGenerator from "@/components/qr/QRGenerator";
import QRSettings from "@/components/qr/QRSettings";

const DEFAULT_URLS = [
  { label: "Главная", url: "https://body-state.ru" },
  { label: "Магазин", url: "https://body-state.ru/shop" },
  { label: "БФМ", url: "https://body-state.ru/bfm" },
  { label: "БРТ", url: "https://body-state.ru/brt" },
  { label: "Психология", url: "https://body-state.ru/psychology" },
];

export default function QrPage() {
  const [color, setColor] = useState("#0F766E");
  const [withLogo, setWithLogo] = useState(true);

  const qrUrl = (url: string) =>
    `/api/qr?url=${encodeURIComponent(url)}&color=${encodeURIComponent(color)}&logo=${withLogo}`;

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>QR-коды</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>Сканируйте, чтобы открыть страницу на телефоне</p>

          <QRSettings color={color} setColor={setColor} withLogo={withLogo} setWithLogo={setWithLogo} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-10">
            {DEFAULT_URLS.map((item) => (
              <QRCard key={item.label} label={item.label} url={item.url} qrUrl={qrUrl(item.url)} />
            ))}
          </div>

          <QRGenerator color={color} withLogo={withLogo} />
        </div>
      </section>
    </main>
  );
}
