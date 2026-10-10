'use client';
import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function AdminPwa() {
  const [offline,setOffline]=useState(false);
  const [install,setInstall]=useState<InstallPrompt|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const update=()=>setOffline(!navigator.onLine);
    const offer=(event:Event)=>{event.preventDefault();setInstall(event as InstallPrompt);};
    const installed=()=>setInstall(null);
    update();
    window.addEventListener('online',update);window.addEventListener('offline',update);
    window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',installed);
    if(process.env.NODE_ENV==='production' && 'serviceWorker' in navigator){
      void navigator.serviceWorker.register('/admin/sw.js',{scope:'/admin/',updateViaCache:'none'}).catch(()=>setMessage('Не удалось включить экран потери связи. Админка доступна через интернет.'));
    }
    return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',installed);};
  },[]);
  async function installApp(){
    if(!install||busy)return;setBusy(true);
    try{await install.prompt();await install.userChoice;setInstall(null);}catch{setMessage('Установите приложение через меню браузера.');}finally{setBusy(false);}
  }
  return <div className="admin-pwa-notices">
    {offline&&<p role="alert">Нет интернета. Данные могут быть устаревшими; изменения не сохраняются. Проверьте соединение и обновите страницу перед работой.</p>}
    {message&&<p role="status">{message}</p>}
    {install&&<button type="button" disabled={busy} onClick={()=>void installApp()}>{busy?'Подождите…':'Установить админку на телефон'}</button>}
  </div>;
}
