"use client";

import { useState, useEffect, useDeferredValue } from "react";
import Image from "next/image";
import { Download, Copy, Check, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

interface Props {
  color: string;
  withLogo: boolean;
}

function isValidUrl(url: string) {
  try { new URL(url); return true; } catch { return false; }
}

export default function QRGenerator({ color, withLogo }: Props) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const deferredInput = useDeferredValue(input);
  const valid = isValidUrl(deferredInput);

  const qrSrc = valid
    ? `/api/qr?url=${encodeURIComponent(deferredInput)}&color=${encodeURIComponent(color)}&logo=${withLogo}`
    : "";

  useEffect(() => { if (deferredInput) setLoading(true); }, [deferredInput]);

  const copy = () => {
    navigator.clipboard.writeText(deferredInput);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = "qr-custom.png";
    a.click();
  };

  return (
    <div className="bg-white/80 backdrop-blur rounded-3xl border border-white/20 shadow-sm p-5">
      <h2 className="font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Свой QR-код</h2>

      <input
        type="text"
        placeholder="Вставьте ссылку..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full h-12 rounded-2xl border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 mb-3"
        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--foreground)' }}
      />

      {deferredInput && !valid && (
        <p className="text-red-500 text-xs mb-3">Укажите корректный URL (например, https://example.com)</p>
      )}

      {valid && (
        <div className="text-center">
          <div className="relative w-40 h-40 mx-auto mb-2">
            {loading && <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-xl" />}
            <Image src={qrSrc} alt="QR-код" width={160} height={160} className="mx-auto rounded-xl" unoptimized onLoad={() => setLoading(false)} />
          </div>
          <p className="text-xs truncate mb-2" style={{ color: 'var(--foreground-secondary)' }}>{deferredInput}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={copy} className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Скопировано" : "Ссылка"}
            </button>
            <button onClick={download} className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              <Download className="w-3 h-3" /> Скачать
            </button>
            <a href={deferredInput} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              <ExternalLink className="w-3 h-3" /> Открыть
            </a>
          </div>
        </div>
      )}

      {!deferredInput && (
        <div className="text-center py-8">
          <QrCode className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--foreground-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>Введите ссылку для генерации QR-кода</p>
        </div>
      )}
    </div>
  );
}
