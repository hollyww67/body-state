import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const color = searchParams.get("color") || "#0F766E";
  const withLogo = searchParams.get("logo") !== "false";

  if (!url) {
    return NextResponse.json({ error: "URL обязателен" }, { status: 400 });
  }

  try {
    const qrBuffer = await QRCode.toBuffer(url, {
      width: 400,
      margin: 2,
      color: { dark: color, light: "#ffffff00" },
    });

    if (!withLogo) {
      return new NextResponse(new Uint8Array(qrBuffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (!fs.existsSync(logoPath)) {
      return new NextResponse(new Uint8Array(qrBuffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    const logoSize = 80;
    const logoBuffer = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    const qrMeta = await sharp(qrBuffer).metadata();
    const left = Math.floor((qrMeta.width! - logoSize - 8) / 2);
    const top = Math.floor((qrMeta.height! - logoSize - 8) / 2);

    const result = await sharp(qrBuffer)
      .composite([{ input: logoBuffer, top, left }])
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(result), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  } catch (e) {
    console.error("QR error:", e);
    return NextResponse.json({ error: "Ошибка генерации" }, { status: 500 });
  }
}
