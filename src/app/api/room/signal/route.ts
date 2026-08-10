import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  const body = await request.json();
  const { type, sdp, candidate, from } = body;
  const key = `signal-${id}`;

  const { data: existing } = await supabaseAdmin.from("settings").select("value").eq("key", key).single();
  let state: any = { offer: null, answer: null, callerCandidates: [], answererCandidates: [] };

  if (existing?.value) {
    try { state = JSON.parse(existing.value); } catch {}
  }

  if (type === "offer") {
    state.offer = sdp;
    state.callerCandidates = [];
  } else if (type === "answer") {
    state.answer = sdp;
  } else if (type === "ice") {
    // Сохраняем объект кандидата как есть — {candidate, sdpMid, sdpMLineIndex}
    if (from === "caller" && candidate) {
      state.callerCandidates.push(candidate);
    }
    if (from === "answerer" && candidate) {
      state.answererCandidates.push(candidate);
    }
  }

  await supabaseAdmin.from("settings").upsert(
    { key, value: JSON.stringify(state) },
    { onConflict: "key" }
  );

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const role = searchParams.get("role");
  if (!id || !role) return NextResponse.json(null);

  const key = `signal-${id}`;
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", key).single();
  if (!data?.value) return NextResponse.json(null);

  let state: any;
  try { state = JSON.parse(data.value); } catch { return NextResponse.json(null); }

  if (role === "offer") {
    if (state.offer) return NextResponse.json({ sdp: state.offer });
    return NextResponse.json(null);
  }

  if (role === "answer") {
    if (state.answer) return NextResponse.json({ sdp: state.answer });
    return NextResponse.json(null);
  }

  if (role === "ice-caller") {
    const candidates = state.answererCandidates || [];
    if (candidates.length > 0) {
      const candidate = candidates.shift();
      await supabaseAdmin.from("settings").update({ value: JSON.stringify(state) }).eq("key", key);
      return NextResponse.json({ candidate });
    }
    return NextResponse.json(null);
  }

  if (role === "ice-answerer") {
    const candidates = state.callerCandidates || [];
    if (candidates.length > 0) {
      const candidate = candidates.shift();
      await supabaseAdmin.from("settings").update({ value: JSON.stringify(state) }).eq("key", key);
      return NextResponse.json({ candidate });
    }
    return NextResponse.json(null);
  }

  return NextResponse.json(null);
}
