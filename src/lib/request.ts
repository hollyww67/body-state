import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function enforceRateLimit(request: NextRequest, scope: string, limit: number, ttlSeconds: number) {
  const allowed = await checkRateLimit(`${scope}:${getClientIp(request)}`, limit, ttlSeconds);
  return allowed ? null : NextResponse.json(
    { error: "Слишком много запросов. Попробуйте позже." },
    { status: 429, headers: { "Retry-After": String(ttlSeconds) } },
  );
}

export async function readJsonObject(request: NextRequest, maxBytes = 32_768): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_JSON_OBJECT");
  return value as Record<string, unknown>;
}

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function cleanMultiline(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizePhone(value: unknown): string {
  const raw = cleanText(value, 40);
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return "";
}

export function normalizeEmail(value: unknown): string {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
