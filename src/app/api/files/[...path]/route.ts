import { NextResponse } from "next/server";
import { head, get } from "@vercel/blob";
import { readFile, stat } from "fs/promises";
import path from "path";

import { handleApiError, requireUser, AuthError } from "@/lib/auth";

/**
 * سرو فایل‌های خصوصی سیبک از طریق /api/files/<pathname>.
 *
 * - احراز هویت الزامی (کوکی یا Bearer) — خطای ۴۰۱ با handleApiError.
 * - مسیرهای با پیشوند uploads/ → از دیسک محلی (db/uploads) خوانده می‌شوند.
 * - بقیه → Vercel Blob خصوصی.
 * - جلوگیری از path traversal در مسیر محلی.
 */

const LOCAL_PREFIX = "uploads/";

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  zip: "application/zip",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function guessMime(pathname: string): string {
  const ext = path.extname(pathname).slice(1).toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

function safeFileName(name: string): string {
  // filename* استاندارد RFC 5987 برای نام‌های فارسی
  const base = path.basename(name) || "file";
  return encodeURIComponent(base);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    await requireUser(); // بدون نشست → AuthError ۴۰۱ از handleApiError

    const { path: segments } = await params;
    const pathname = segments.join("/");

    if (!pathname || pathname.includes("..")) {
      throw new AuthError(400, "مسیر فایل نامعتبر است");
    }

    // ---------- فایل محلی (توسعه/پیش‌نمایش) ----------
    if (pathname.startsWith(LOCAL_PREFIX)) {
      const uploadDir = path.join(process.cwd(), "db", "uploads");
      const resolved = path.resolve(uploadDir, pathname.slice(LOCAL_PREFIX.length));
      if (!resolved.startsWith(uploadDir + path.sep)) {
        throw new AuthError(400, "مسیر فایل نامعتبر است");
      }

      const info = await stat(resolved).catch(() => null);
      if (!info || !info.isFile()) {
        return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
      }

      const data = await readFile(resolved);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": guessMime(resolved),
          "Content-Length": String(info.size),
          "Content-Disposition": `inline; filename*=UTF-8''${safeFileName(resolved)}`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    // ---------- Vercel Blob (پروداکشن) ----------
    let blob;
    try {
      blob = await head(pathname);
    } catch {
      return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
    }

    const file = await get(blob.url, { access: "private" });
    if (!file) {
      return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
    }

    return new NextResponse(file.stream, {
      headers: {
        "Content-Type":
          blob.contentType || guessMime(pathname),
        "Content-Disposition": `inline; filename*=UTF-8''${safeFileName(blob.pathname)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return handleApiError(e); // ۴۰۱ به‌جای ۵۰۰
  }
}
