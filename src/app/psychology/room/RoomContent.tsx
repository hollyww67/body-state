"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from 'lucide-react';

type Access = { role: 'doctor'|'client'; name: string; expiresAt: string };
type Session = { session: string; role: 'doctor'|'client'; iceServers: RTCIceServer[] };
type Signal = { id: string; from: string; type: 'offer'|'answer'|'ice'; data: RTCSessionDescriptionInit & RTCIceCandidateInit };

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Ошибка подключения'), { status: res.status });
  return data;
}

export default function RoomContent() {
  const [id,setId]=useState('');
  const [access,setAccess]=useState<Access|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(false);
  const [session,setSession]=useState<Session|null>(null);
  const [status,setStatus]=useState('Проверяем доступ…');
  const [muted,setMuted]=useState(false);
  const [cameraOff,setCameraOff]=useState(false);
  const [hasCamera,setHasCamera]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [playBlocked,setPlayBlocked]=useState(false);
  const local=useRef<HTMLVideoElement>(null);
  const remote=useRef<HTMLVideoElement>(null);
  const media=useRef<MediaStream|null>(null);
  const screen=useRef<MediaStream|null>(null);
  const pc=useRef<RTCPeerConnection|null>(null);
  const active=useRef<{id:string;session:string}|null>(null);
  const operation=useRef(0);

  const release=useCallback(()=>{
    operation.current++;
    const current=active.current; active.current=null;
    if(current) void fetch('/api/room/signal?id='+encodeURIComponent(current.id)+'&session='+current.session,{method:'DELETE',keepalive:true}).catch(()=>{});
    pc.current?.close(); pc.current=null;
    media.current?.getTracks().forEach(t=>t.stop());media.current=null;
    screen.current?.getTracks().forEach(t=>t.stop());screen.current=null;
    if(local.current)local.current.srcObject=null;
    if(remote.current)remote.current.srcObject=null;
  },[]);

  useEffect(()=>{
    const roomId=new URLSearchParams(window.location.search).get('id')||'';
    setId(roomId);
    let cancelled=false;
    api('/api/room/check?id='+encodeURIComponent(roomId)).then(data=>{
      if(cancelled)return;setAccess(data);setStatus('Проверьте камеру и микрофон перед входом.');
    }).catch(e=>{if(!cancelled){setError(e.message);setStatus('Вход недоступен');}});
    const leave=()=>release();
    window.addEventListener('pagehide',leave);
    return()=>{cancelled=true;window.removeEventListener('pagehide',leave);release();};
  },[release]);

  const leave=useCallback(()=>{
    release();setSession(null);setPreview(false);setBusy(false);setSharing(false);setMuted(false);setCameraOff(false);setPlayBlocked(false);
    setStatus('Вы вышли из комнаты. Камера и микрофон выключены.');
  },[release]);

  async function prepare(audioOnly=false) {
    if(busy)return;
    setBusy(true);setError('');
    const version=++operation.current;
    try {
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Нужен современный браузер и защищённое HTTPS-соединение.');
      const stream=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true},
        video:audioOnly?false:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}
      });
      if(version!==operation.current){stream.getTracks().forEach(t=>t.stop());return;}
      media.current?.getTracks().forEach(t=>t.stop());media.current=stream;
      if(local.current){local.current.srcObject=stream;void local.current.play().catch(()=>{});}
      setPreview(true);setHasCamera(!audioOnly);setCameraOff(audioOnly);setMuted(false);setStatus('Устройства готовы. Нажмите «Войти в консультацию».');
    }catch(e){
      const name=e instanceof Error?e.name:'';
      setError(name==='NotAllowedError'?'Разрешите камеру и микрофон в настройках браузера. После этого повторите проверку.':name==='NotFoundError'?'Камера или микрофон не найдены. Попробуйте вход только со звуком.':e instanceof Error?e.message:'Не удалось включить устройства');
    }finally{if(version===operation.current)setBusy(false);}
  }

  async function join() {
    if(busy||!media.current)return;
    setBusy(true);setError('');
    const version=operation.current;
    try {
      const data:Session=await api('/api/room/signal?id='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'join'})});
      if(version!==operation.current){
        void fetch('/api/room/signal?id='+encodeURIComponent(id)+'&session='+data.session,{method:'DELETE',keepalive:true});
        return;
      }
      active.current={id,session:data.session};setSession(data);
    }catch(e){setError((e as Error).message);}finally{if(version===operation.current)setBusy(false);}
  }

  useEffect(()=>{
    if(!session||!media.current)return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>;
    let peer:string|null=null;
    let candidates:RTCIceCandidateInit[]=[];
    const seen=new Set<string>();
    let lastSuccess=Date.now();
    const base='/api/room/signal?id='+encodeURIComponent(id);
    const send=async(type:string,data:unknown,target:string)=>{
      if(cancelled)return;
      await api(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:session.session,peer:target,type,data})});
    };
    function connection(target:string) {
      pc.current?.close();candidates=[];setPlayBlocked(false);
      if(remote.current)remote.current.srcObject=null;
      const current=new RTCPeerConnection({iceServers:session!.iceServers,iceTransportPolicy:'relay'});
      pc.current=current;
      media.current!.getTracks().forEach(t=>current.addTrack(t,media.current!));
      // A specialist joining without a camera must still be able to see the client.
      if(session!.role==='doctor'&&!media.current!.getVideoTracks().length)current.addTransceiver('video',{direction:'recvonly'});
      if(screen.current){
        const sender=current.getSenders().find(s=>s.track?.kind==='video');
        if(sender)void sender.replaceTrack(screen.current.getVideoTracks()[0]);
      }
      current.onicecandidate=e=>{
        if(e.candidate&&!cancelled&&pc.current===current)void send('ice',e.candidate.toJSON(),target).catch(()=>{
          if(!cancelled&&pc.current===current)setError('Не удалось передать данные соединения. Если связь не установится, выйдите и войдите снова.');
        });
      };
      current.ontrack=e=>{
        if(!remote.current||cancelled||pc.current!==current)return;
        remote.current.srcObject=e.streams[0]||new MediaStream([e.track]);
        void remote.current.play().catch(()=>setPlayBlocked(true));
      };
      current.onconnectionstatechange=()=>{
        if(cancelled||pc.current!==current)return;
        if(current.connectionState==='connected'){setStatus('Вы на связи');setError('');}
        if(current.connectionState==='disconnected')setStatus('Связь прервана. Ожидаем восстановления сети…');
        if(current.connectionState==='failed'){setStatus('Соединение потеряно');setError('Не удалось восстановить связь. Нажмите «Выйти», затем войдите снова.');}
      };
      return current;
    }
    async function poll() {
      if(cancelled)return;
      try {
        const data:{peer:string|null;messages:Signal[]}=await api(base+'&session='+session!.session);
        if(cancelled)return;
        lastSuccess=Date.now();
        if(peer!==data.peer){
          peer=data.peer;
          pc.current?.close();pc.current=null;candidates=[];
          if(remote.current)remote.current.srcObject=null;
          setStatus(peer?'Устанавливаем защищённое соединение…':'Ожидаем второго участника…');
          if(peer&&session!.role==='doctor'){
            const current=connection(peer);
            const offer=await current.createOffer();
            if(cancelled)return;
            await current.setLocalDescription(offer);
            await send('offer',current.localDescription,peer);
          }
        }
        for(const message of data.messages){
          if(cancelled)return;
          if(seen.has(message.id)||message.from!==peer)continue;
          if(message.type==='offer'&&session!.role==='client'){
            // Candidates can arrive before SDP; preserve that queue.
            const waiting=candidates;
            const current=connection(peer!);
            candidates=waiting;
            await current.setRemoteDescription(message.data);
            for(const c of candidates)await current.addIceCandidate(c);candidates=[];
            await current.setLocalDescription(await current.createAnswer());
            await send('answer',current.localDescription,peer!);
          }else if(message.type==='answer'&&session!.role==='doctor'&&pc.current?.signalingState==='have-local-offer'){
            await pc.current.setRemoteDescription(message.data);
            for(const c of candidates)await pc.current.addIceCandidate(c);candidates=[];
          }else if(message.type==='ice'){
            if(pc.current?.remoteDescription)await pc.current.addIceCandidate(message.data);
            else candidates.push(message.data);
          }
          seen.add(message.id);
        }
        if(seen.size>1024){const keep=[...seen].slice(-512);seen.clear();keep.forEach(x=>seen.add(x));}
      }catch(e){
        if(cancelled)return;
        const err=e as Error&{status?:number};
        if([401,403,404,409,410].includes(err.status||0)||Date.now()-lastSuccess>25000){
          leave();setError(err.message);return;
        }
        setStatus('Проверяем соединение с сервером…');
      }
      if(!cancelled)timer=setTimeout(()=>void poll(),1000);
    }
    setStatus('Ожидаем второго участника…');void poll();
    return()=>{cancelled=true;clearTimeout(timer);pc.current?.close();pc.current=null;};
  },[id,session,leave]);

  async function share() {
    if(sharing){screen.current?.getTracks().forEach(t=>t.stop());await restoreCamera();return;}
    if(!pc.current||!media.current?.getVideoTracks().length){setError('Для демонстрации включите камеру до входа и дождитесь соединения.');return;}
    const current=pc.current;
    try{
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      if(pc.current!==current||!active.current){stream.getTracks().forEach(t=>t.stop());return;}
      screen.current=stream;
      await current.getSenders().find(s=>s.track?.kind==='video')?.replaceTrack(stream.getVideoTracks()[0]);
      if(local.current)local.current.srcObject=stream;
      stream.getVideoTracks()[0].onended=()=>void restoreCamera();
      setSharing(true);
    }catch{setError('Демонстрация экрана не началась. Возможно, браузер её не поддерживает или доступ не разрешён.');}
  }
  async function restoreCamera(){
    screen.current?.getTracks().forEach(t=>t.stop());screen.current=null;
    const track=media.current?.getVideoTracks()[0];
    try{if(track)await pc.current?.getSenders().find(s=>s.track?.kind==='video')?.replaceTrack(track);}catch{setError('Не удалось вернуть камеру. Переподключитесь.');}
    if(local.current)local.current.srcObject=media.current;
    setSharing(false);
  }

  return <main className="min-h-dvh bg-[#151020] px-4 py-5 text-white sm:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm text-violet-300">BODY STATE · Онлайн</p><h1 className="mt-1 text-xl font-semibold">{access?.name||'Онлайн-консультация'}</h1></div>
        <Link onClick={leave} href={access?.role==='doctor'?'/admin/psychology-rooms':'/account'} className="rounded-xl border border-white/25 px-4 py-3">В кабинет</Link>
      </header>
      <p role="status" className="mb-4 rounded-xl bg-white/10 p-4">{status}</p>
      {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-400/50 bg-rose-950 p-4 text-rose-100">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="relative aspect-video overflow-hidden rounded-2xl bg-[#292039]">
          <video ref={local} muted autoPlay playsInline className="h-full w-full object-contain"/>
          {!preview&&<p className="absolute inset-0 flex items-center justify-center text-violet-200">Камера выключена</p>}
          <p className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1 text-sm">Вы{muted?' · Микрофон выключен':''}</p>
        </section>
        <section className="relative aspect-video overflow-hidden rounded-2xl bg-[#292039]">
          <video ref={remote} autoPlay playsInline className="h-full w-full object-contain"/>
          <p className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1 text-sm">{access?.role==='doctor'?'Клиент':'Специалист'}</p>
        </section>
      </div>
      {playBlocked&&<button className="mt-4 rounded-xl bg-violet-600 px-5 py-3" onClick={()=>void remote.current?.play().then(()=>setPlayBlocked(false)).catch(()=>setError('Браузер заблокировал звук. Проверьте разрешения.'))}>Включить звук собеседника</button>}
      {access&&!session&&<div className="mt-5 flex flex-wrap gap-3">
        {busy&&<button onClick={leave} className="min-h-12 rounded-xl border border-white/25 px-5 py-3">Отменить подключение</button>}
        <button disabled={busy} onClick={()=>void prepare()} className="min-h-12 rounded-xl bg-violet-600 px-5 py-3 disabled:opacity-50">{busy?'Подождите…':preview?'Проверить устройства снова':'Проверить камеру и микрофон'}</button>
        <button disabled={busy} onClick={()=>void prepare(true)} className="min-h-12 rounded-xl border border-white/25 px-5 py-3 disabled:opacity-50">Только звук</button>
        {preview&&<button disabled={busy} onClick={()=>void join()} className="min-h-12 rounded-xl bg-teal-600 px-5 py-3 disabled:opacity-50">Войти в консультацию</button>}
      </div>}
      {preview&&<div className="mt-5 flex flex-wrap gap-3">
        <button aria-pressed={muted} onClick={()=>{media.current?.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted);}} className="flex min-h-12 items-center gap-2 rounded-xl bg-white/10 px-4">{muted?<MicOff size={20}/>:<Mic size={20}/>} {muted?'Включить микрофон':'Выключить микрофон'}</button>
        <button disabled={!hasCamera||sharing} aria-pressed={cameraOff} onClick={()=>{media.current?.getVideoTracks().forEach(t=>t.enabled=cameraOff);setCameraOff(!cameraOff);}} className="flex min-h-12 items-center gap-2 rounded-xl bg-white/10 px-4 disabled:opacity-40">{cameraOff?<VideoOff size={20}/>:<Video size={20}/>}Камера</button>
        {session&&<button onClick={()=>void share()} className="flex min-h-12 items-center gap-2 rounded-xl bg-white/10 px-4"><MonitorUp size={20}/>{sharing?'Остановить показ':'Показать экран'}</button>}
        <button onClick={leave} className="flex min-h-12 items-center gap-2 rounded-xl bg-rose-700 px-4"><PhoneOff size={20}/>Выйти</button>
      </div>}
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-violet-200">Камера и микрофон включаются только с вашего разрешения. Сайт не записывает разговор. Для конфиденциальности используйте наушники и отдельное помещение. Если связь прервётся, выйдите и подключитесь снова.</p>
    </div>
  </main>;
}
