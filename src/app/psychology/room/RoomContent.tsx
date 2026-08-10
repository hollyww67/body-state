"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageCircle, Send, MonitorUp, Hand } from "lucide-react";

export default function RoomContent() {
  const [roomId, setRoomId] = useState("default");
  const [role, setRole] = useState<"caller" | "answerer" | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; from: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusText, setStatusText] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const mountedRef = useRef(true);
  const answerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(false);

  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: ["turn:85.198.71.172:3478", "turn:85.198.71.172:3478?transport=tcp"],
      username: "webrtc",
      credential: "webrtc123",
    },
  ];

  const log = (msg: string) => {
    console.log(msg);
    setStatusText((prev) => (prev + "\n" + msg).slice(-2000));
  };

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "default";
    const roleParam = params.get("role");
    const validId = /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : "default";
    const finalRole = roleParam === "doctor" ? "caller" : "answerer";
    log(`ROOM: ${validId}, ROLE: ${finalRole}`);
    setRoomId(validId);
    setRole(finalRole);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const cleanup = () => {
    if (answerTimeoutRef.current) { clearTimeout(answerTimeoutRef.current); answerTimeoutRef.current = null; }
    if (iceTimeoutRef.current) { clearTimeout(iceTimeoutRef.current); iceTimeoutRef.current = null; }
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
  };

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; stopMedia(); cleanup(); }; }, []);

  const stopMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    originalVideoTrackRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
  };

  const attachStream = async (video: HTMLVideoElement, stream: MediaStream, muted: boolean = false) => {
    video.srcObject = stream;
    video.muted = muted;
    video.playsInline = true;
    video.autoplay = true;
    await new Promise((r) => { video.onloadedmetadata = () => r(true); });
    try { await video.play(); } catch (err) { log("PLAY ERR: " + err); }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const audioCtx = audioContextRef.current!;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    analyserRef.current = analyser;

    const checkSpeaking = () => {
      if (!analyserRef.current || !mountedRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      setSpeaking(data.reduce((a, b) => a + b, 0) / data.length > 30);
      animationFrameRef.current = requestAnimationFrame(checkSpeaking);
    };
    checkSpeaking();
  };

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc;
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.id && msg.from && msg.text) {
          setChatMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
        }
      } catch {}
    };
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream, isCaller: boolean) => {
    log("PC created, caller=" + isCaller);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    if (stream.getVideoTracks().length > 0) originalVideoTrackRef.current = stream.getVideoTracks()[0];

    if (isCaller) {
      setupDataChannel(pc.createDataChannel("chat"));
    } else {
      pc.ondatachannel = (e) => setupDataChannel(e.channel);
    }

    pc.onicecandidate = (e) => {
      if (!e.candidate) { log("ICE gathering done"); return; }
      log("SEND ICE: " + (e.candidate.type || e.candidate.candidate?.split(" ")[7] || "?"));
      fetch(`/api/room/signal?id=${roomId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ice", from: isCaller ? "caller" : "answerer", candidate: e.candidate }),
      }).catch((err) => log("SEND ERR: " + err));
    };

    pc.ontrack = async (e) => {
      log("REMOTE TRACK, streams=" + e.streams.length);
      if (remoteVideoRef.current && mountedRef.current) {
        await attachStream(remoteVideoRef.current, e.streams[0], false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      log("ICE: " + pc.iceConnectionState);
      const state = pc.iceConnectionState;
      if (state === "disconnected" || state === "failed") setReconnecting(true);
      else if (state === "connected" || state === "completed") {
        setReconnecting(false);
        setConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      log("PC: " + pc.connectionState);
      const state = pc.connectionState;
      if (state === "connected") setConnected(true);
      else if (state === "disconnected" || state === "failed" || state === "closed") {
        if (mountedRef.current) setConnected(false);
      }
    };

    return pc;
  }, [roomId, setupDataChannel]);

  const flushPendingCandidates = useCallback(async () => {
    if (!pcRef.current) return;
    while (pendingCandidates.current.length > 0) {
      const c = pendingCandidates.current.shift()!;
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { log("Flush err: " + e); }
    }
  }, []);

  const startIcePolling = useCallback((isCaller: boolean) => {
    const pollIce = async () => {
      if (!mountedRef.current || !pcRef.current) return;
      try {
        const iceRole = isCaller ? "ice-caller" : "ice-answerer";
        const res = await fetch(`/api/room/signal?id=${roomId}&role=${iceRole}`);
        const data = await res.json();
        if (data?.candidate) {
          const type = data.candidate.type || data.candidate.candidate?.split(" ")[7] || "?";
          log("RECV ICE: " + type);
          if (pcRef.current?.remoteDescription) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { log("Add ICE err: " + e); }
          } else {
            pendingCandidates.current.push(data.candidate);
          }
        }
      } catch (e) { log("ICE poll err: " + e); }
      iceTimeoutRef.current = setTimeout(pollIce, 250);
    };
    pollIce();
  }, [roomId]);

  const hangUp = useCallback(() => {
    stopMedia();
    cleanup();
    setConnected(false);
    setReady(false);
    setReconnecting(false);
    log("HANGUP");
  }, []);

  const doStartCall = useCallback(async () => {
    if (role !== "caller") return;
    setStarting(true);
    stopMedia();
    cleanup();
    pendingCandidates.current = [];
    setStatusText("");

    try {
      log("getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      log("Stream OK, video=" + stream.getVideoTracks().length);
      localStreamRef.current = stream;
      if (localVideoRef.current) await attachStream(localVideoRef.current, stream, true);
      setupAudioAnalysis(stream);

      const pc = createPeerConnection(stream, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`/api/room/signal?id=${roomId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "offer", sdp: pc.localDescription }),
      });
      log("OFFER sent: " + res.status);

      startIcePolling(true);

      const pollAnswer = async () => {
        if (!mountedRef.current || !pcRef.current) return;
        try {
          const res = await fetch(`/api/room/signal?id=${roomId}&role=answer`);
          const data = await res.json();
          if (data?.sdp && pcRef.current?.signalingState !== "stable") {
            log("ANSWER received");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await flushPendingCandidates();
            return;
          }
        } catch (e) { log("Answer poll err: " + e); }
        answerTimeoutRef.current = setTimeout(pollAnswer, 250);
      };
      pollAnswer();

      setPermissionDenied(false);
      setReady(true);
    } catch (e: any) {
      log("START ERR: " + (e?.message || e?.name || String(e)));
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") setPermissionDenied(true);
    } finally {
      setStarting(false);
    }
  }, [role, roomId, createPeerConnection, startIcePolling, flushPendingCandidates]);

  const startAnswererFlow = useCallback(async () => {
    stopMedia();
    cleanup();
    pendingCandidates.current = [];
    setStatusText("");

    log("Answerer waiting...");
    const pollOffer = async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`/api/room/signal?id=${roomId}&role=offer`);
        const data = await res.json();
        if (data?.sdp && !pcRef.current) {
          log("OFFER received");
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480 },
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) await attachStream(localVideoRef.current, stream, true);
            setupAudioAnalysis(stream);

            const pc = createPeerConnection(stream, false);
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await flushPendingCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await fetch(`/api/room/signal?id=${roomId}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "answer", sdp: pc.localDescription }),
            });
            log("ANSWER sent");

            startIcePolling(false);
            setReady(true);
            return;
          } catch (e: any) {
            log("Flow ERR: " + (e?.message || String(e)));
            if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
              setPermissionDenied(true);
              return;
            }
          }
        }
      } catch (e) { log("Offer poll err: " + e); }
      answerTimeoutRef.current = setTimeout(pollOffer, 250);
    };
    pollOffer();
  }, [roomId, createPeerConnection, startIcePolling, flushPendingCandidates]);

  useEffect(() => {
    if (role === "answerer") startAnswererFlow();
  }, [role, startAnswererFlow]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = muted));
      setMuted(!muted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = videoOff));
      setVideoOff(!videoOff);
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenStream.getVideoTracks()[0]);
      }
      screenStream.getVideoTracks()[0].onended = () => {
        if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        if (pcRef.current && originalVideoTrackRef.current) {
          const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(originalVideoTrackRef.current);
        }
      };
    } catch {}
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !dcRef.current || dcRef.current.readyState !== "open") return;
    const msg = { id: crypto.randomUUID(), from: "me", text, time: new Date().toLocaleTimeString() };
    setChatMessages((prev) => [...prev, msg]);
    dcRef.current.send(JSON.stringify(msg));
    setChatInput("");
  };

  if (role === null) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}><p className="text-white">Загрузка...</p></div>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 text-white text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium">{roomId} ({role})</span>
          {connected && <span className="w-2 h-2 rounded-full bg-green-500" />}
          {reconnecting && <span className="text-yellow-400 text-xs">Reconnecting...</span>}
        </div>
        <div className="flex items-center gap-2">
          {!ready && role === "caller" && (
            <button type="button" onClick={doStartCall} disabled={starting}
              className="px-4 py-1.5 rounded-full text-white text-xs font-medium"
              style={{ background: "var(--primary)" }}>
              {starting ? "Connecting..." : "Start Call"}
            </button>
          )}
          <button onClick={() => { setChatOpen(!chatOpen); setUnreadCount(0); }} className="p-2 rounded-full hover:bg-white/10 transition-colors relative">
            <MessageCircle className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadCount}</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        <div className="relative rounded-2xl overflow-hidden bg-gray-800" style={{ minHeight: 200 }}>
          <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs z-10">You</div>
          {muted && <MicOff className="absolute top-3 right-3 w-4 h-4 text-red-400 z-10" />}
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-gray-800" style={{ minHeight: 200 }}>
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs z-10">Specialist</div>
        </div>
      </div>

      <div className="px-4 py-2 bg-black/30 text-green-400 text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
        {statusText || "Waiting..."}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-4 bg-black/50">
        <button onClick={toggleMute} className={`p-3 rounded-full transition-all ${muted ? "bg-red-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>{muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
        <button onClick={toggleVideo} className={`p-3 rounded-full transition-all ${videoOff ? "bg-red-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>{videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}</button>
        <button onClick={shareScreen} className="p-3 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"><MonitorUp className="w-5 h-5" /></button>
        <button onClick={hangUp} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all ml-4"><PhoneOff className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
