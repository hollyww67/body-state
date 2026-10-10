"use client";

import SiteImage from '@/components/SiteImage';
import { useEffect, useState } from "react";
import { FileBadge2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FileUploader from "@/components/FileUploader";

type AboutDocument = { id: string; title: string; image_url: string };

export default function AboutDocumentsEditor() {
  const [documents, setDocuments] = useState<AboutDocument[]>([]);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadKey, setUploadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/admin/about-documents");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить документы");
      setDocuments(data.documents || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const addDocument = async () => {
    if (!title.trim() || !imageUrl) return toast.error("Укажите название и загрузите изображение");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/about-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, image_url: imageUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось добавить документ");
      setDocuments((current) => [...current, data.document]);
      setTitle(""); setImageUrl(""); setUploadKey((key) => key + 1);
      toast.success("Документ добавлен на страницу");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка сохранения"); }
    finally { setSaving(false); }
  };

  const removeDocument = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/about-documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось удалить документ");
      setDocuments((current) => current.filter((item) => item.id !== id));
      toast.success("Документ убран со страницы");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ошибка удаления"); }
    finally { setDeletingId(null); }
  };

  return <section className="content-panel mt-6 rounded-[24px] p-5 md:p-7">
    <div className="mb-5 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}><FileBadge2 className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Дипломы и сертификаты</h2><p className="mt-1 text-sm leading-6" style={{ color: "var(--foreground-secondary)" }}>Загрузите фотографию или скан. Документы появятся отдельной галереей на странице «О специалисте».</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-medium">Название документа</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Диплом о профессиональной переподготовке" className="w-full rounded-xl border px-4 py-3" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" }} /></label><FileUploader key={uploadKey} type="image" currentUrl={imageUrl} onUpload={setImageUrl} label="Загрузить документ" accept="image/jpeg,image/png,image/webp" /><button type="button" onClick={addDocument} disabled={saving || !title.trim() || !imageUrl} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}><Plus className="h-4 w-4" />{saving ? "Добавляем…" : "Добавить документ"}</button></div>
      <div>{loading ? <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Загружаем документы…</p> : documents.length === 0 ? <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed text-center" style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}><div><FileBadge2 className="mx-auto mb-2 h-7 w-7 opacity-40" /><p className="text-sm">Документы пока не добавлены</p></div></div> : <div className="grid gap-3 sm:grid-cols-2">{documents.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}><SiteImage src={item.image_url} alt={item.title} className="aspect-[4/3] w-full bg-gray-50 object-contain" /><div className="flex items-center gap-3 p-3"><p className="min-w-0 flex-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>{item.title}</p><button type="button" onClick={() => removeDocument(item.id)} disabled={deletingId === item.id} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50" aria-label={`Удалить ${item.title}`}><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}</div>
    </div>
  </section>;
}
