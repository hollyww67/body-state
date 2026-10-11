import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { requireAdmin } from "@/lib/admin-auth";

const UPLOAD_DIR = "/var/www/doctor-site-uploads";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "Нет файла" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Файл больше 15 МБ" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Неподдерживаемый формат изображения" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 12000 || metadata.height > 12000) throw new Error("Invalid dimensions");
  } catch {
    return NextResponse.json({ error: "Файл не является корректным изображением" }, { status: 400 });
  }
  const extensionByType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const fileName = `${randomUUID()}.${extensionByType[file.type]}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, fileName);

  await writeFile(filePath, buffer);

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
