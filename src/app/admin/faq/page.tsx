"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminInput, AdminLoadingState, AdminPageHeader, AdminTextarea } from '@/components/admin/ui';
export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState(""); const [keywords, setKeywords] = useState("");
  const [answer, setAnswer] = useState(""); const [category, setCategory] = useState("Общее");
  const fetchFaqs = () => { setLoading(true); fetch("/api/admin/faq").then((r) => r.json()).then((data) => { setFaqs(data.faqs || []); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchFaqs(); }, []);
  const addFaq = async (e: React.FormEvent) => { e.preventDefault(); await fetch("/api/admin/faq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean), answer, category }) }); setShowForm(false); setQuestion(""); setKeywords(""); setAnswer(""); fetchFaqs(); };
  const toggleFaq = async (id: string, is_active: boolean) => { await fetch("/api/admin/faq", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active }) }); fetchFaqs(); };
  const deleteFaq = async (id: string) => { await fetch(`/api/admin/faq?id=${id}`, { method: "DELETE" }); fetchFaqs(); };
  return (
    <div className="admin-faq-page max-w-4xl mx-auto">
      <AdminPageHeader title="FAQ для чат-бота"><AdminButton onClick={()=>setShowForm(!showForm)}><Plus size={16} aria-hidden="true" />Добавить</AdminButton></AdminPageHeader>
      {showForm && <form onSubmit={addFaq} className="bs-form mb-6">
        <label>Вопрос<AdminInput required value={question} onChange={e=>setQuestion(e.target.value)} /></label>
        <label>Ключевые слова<AdminInput required value={keywords} onChange={e=>setKeywords(e.target.value)} /></label>
        <label>Ответ<AdminTextarea required value={answer} onChange={e=>setAnswer(e.target.value)} rows={3} /></label>
        <label>Категория<AdminInput value={category} onChange={e=>setCategory(e.target.value)} /></label><AdminButton type="submit">Сохранить</AdminButton>
      </form>}
      {loading ? <AdminLoadingState /> : faqs.length===0 ? <AdminEmptyState title="Нет записей" /> : <div className="space-y-3">{faqs.map(faq=><AdminCard key={faq.id}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="bs-toolbar mb-2"><AdminBadge>{faq.category}</AdminBadge><AdminBadge tone={faq.is_active?'success':'neutral'}>{faq.is_active?'Активен':'Выключен'}</AdminBadge></div><p className="font-semibold">{faq.question}</p><p className="bs-muted mt-2 text-sm">{faq.answer}</p></div><div className="bs-toolbar"><AdminButton variant="outline" size="icon" aria-label={faq.is_active?'Выключить ответ':'Включить ответ'} onClick={()=>toggleFaq(faq.id,!faq.is_active)}>{faq.is_active?<X size={16}/>:<Check size={16}/>}</AdminButton><AdminButton variant="destructive" size="icon" aria-label="Удалить ответ" onClick={()=>deleteFaq(faq.id)}><Trash2 size={16}/></AdminButton></div></div></AdminCard>)}</div>}
    </div>
  );
}
