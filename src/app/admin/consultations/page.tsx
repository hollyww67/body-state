'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Consultation {
  id: number;
  name: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
}

export default function ConsultationsAdmin() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/consultation')
      .then(res => res.json())
      .then(data => {
        setConsultations(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Заявки на консультацию</h1>
      <div className="space-y-4">
        {consultations.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-gray-600">{item.phone}</p>
                {item.message && <p className="text-gray-500 mt-2">{item.message}</p>}
              </div>
              <div className="text-right text-sm text-gray-400">
                {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
              </div>
            </div>
          </div>
        ))}
        {consultations.length === 0 && (
          <p className="text-gray-500">Нет заявок</p>
        )}
      </div>
    </div>
  );
}
