"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Check, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  label: string;
  url: string;
  qrUrl: string;
}

export default function QRCard({ label, url, qrUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `qr-${label.toLowerCase().replace(/\s/g, "-")}.png`;
    a.click();
  };

  return (
    <div className="group bg-white/80 backdrop-blur rounded-3xl border border-white/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-5 text-center">
      <div className="relative w-40 h-40 mx-auto mb-3">
        {loading && <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-xl" />}
        <Image
          src={qrUrl}
          alt={`QR-код: ${label}`}
          width={160}
          height={160}
          className="mx-auto rounded-xl"
          unoptimized
          onLoad={() => setLoading(false)}
        />
      </div>

      <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{label}</p>
      <p className="text-xs truncate mt-1 mb-3" style={{ color: 'var(--foreground-secondary)' }}>{url}</p>

      <div className="flex items-center justify-center gap-2">
        <button onClick={copy} className="text-xs flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }} aria-label={`Копировать ссылку ${label}`}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Скопировано" : "Ссылка"}
        </button>
        <button onClick={download} className="text-xs flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }} aria-label={`Скачать QR-код ${label}`}>
          <Download className="w-3 h-3" /> Скачать
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }} aria-label={`Открыть ${label}`}>
          <ExternalLink className="w-3 h-3" /> Открыть
        </a>
      </div>
    </div>
  );
}
