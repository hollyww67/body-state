'use client';
import {useEffect,useState} from 'react';
import {AdminButton,AdminCard,AdminFeedback} from '@/components/admin/ui';
type Pending={maxUserId:string;maxChatId:string;expiresAt:string};
type Pair={code:string;expiresAt:string;botUrl:string};
export default function MaxNotificationBinding(){
 const [connected,setConnected]=useState(false),[enabled,setEnabled]=useState(false),[pending,setPending]=useState<Pending|null>(null),[pair,setPair]=useState<Pair|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function request(method='GET',body?:object){
  const response=await fetch('/api/admin/notifications/max',{method,cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===503&&method==='GET')return null;
  if(!response.ok){
   const messages:Record<number,string>={401:'Сессия администратора истекла. Войдите снова.',403:'Откройте админку по основному адресу сайта и повторите действие.',409:'Код подключения истёк или диалог изменился. Создайте новый код.',429:'Слишком много попыток. Подождите несколько минут.',503:'MAX временно недоступен. Повторите позже или обратитесь к администратору.'};
   throw new Error(messages[response.status]||'Не удалось выполнить действие. Повторите позже.');
  }
  return response.json();
 }
 useEffect(()=>{
  let active=true;
  void request().then(data=>{if(active&&data){setEnabled(true);setConnected(data.connected);setPending(data.pending);}})
   .catch(()=>{if(active)setError('Не удалось проверить подключение MAX.');});
  return()=>{active=false;};
 },[]);
 async function act(method:string){
  if(busy)return;setBusy(true);setError('');
  try{
   const data=await request(method,method==='PATCH'?{maxUserId:pending?.maxUserId,maxChatId:pending?.maxChatId}:undefined);
   if(method==='POST')setPair(data);
   else{const state=await request();if(state){setConnected(state.connected);setPending(state.pending);}if(method!=='GET')setPair(null);}
  }catch(error){setError(error instanceof Error?error.message:'Ошибка подключения');}finally{setBusy(false);}
 }
 return <AdminCard className="space-y-3" aria-label="MAX администратора">
  <h3 className="font-semibold">MAX администратора</h3>
  <p className="text-sm text-[var(--admin-muted)]">{!enabled?'Канал выключен до проверки официального бота и webhook.':connected?'Подключён отдельный административный диалог.':'Административный диалог не подключён.'} Клиентская привязка не даёт доступа к административным уведомлениям.</p>
  {error&&<AdminFeedback tone="destructive">{error}</AdminFeedback>}
  {enabled&&<div className="flex flex-wrap gap-2">
   <AdminButton variant="outline" disabled={busy} onClick={()=>void act('POST')}>Создать код подключения</AdminButton>
   <AdminButton variant="outline" disabled={busy} onClick={()=>void act('GET')}>Проверить диалог</AdminButton>
   {connected&&<AdminButton variant="destructive" disabled={busy} onClick={()=>void act('DELETE')}>Отключить</AdminButton>}
  </div>}
  {pair&&<div className="space-y-2"><p>Откройте бота и отправьте этот одноразовый код. Затем нажмите «Проверить диалог».</p><code className="block break-all select-all">{pair.code}</code><p>Действует до {new Date(pair.expiresAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'})} МСК.</p><a className="admin-secondary-action" href={pair.botUrl} target="_blank" rel="noopener noreferrer">Открыть официального бота MAX</a></div>}
  {pending&&<div className="space-y-2"><p>Подтвердите, что это ваш диалог. MAX user ID: <code>{pending.maxUserId}</code>, chat ID: <code>{pending.maxChatId}</code>.</p><p className="text-sm">Сверьте идентификаторы с вашим аккаунтом. При сомнении не подтверждайте подключение.</p><AdminButton disabled={busy||Date.parse(pending.expiresAt)<Date.now()} onClick={()=>void act('PATCH')}>Это мой диалог — подтвердить</AdminButton></div>}
 </AdminCard>;
}
