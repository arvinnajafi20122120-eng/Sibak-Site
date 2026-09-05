import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { put } from "@vercel/blob";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher, AuthError } from "@/lib/auth";
import {
  buildStorageName,
  checkUploadQuota,
  recordRgFile,
  saveToDisk,
} from "@/lib/resource-guard";
import { RgError } from "@/lib/rg-types";

/**
 * آپلود فایل سیبک — با قفل کامل نگهبان منابع (Resource Guard).
 *
 * جریان:
 *  1. احراز هویت (مهمان مجاز نیست)
 *  2. اعتبارسنجی فایل (موجودیت + پسوند مسدودشده)
 *  3. قفل سهمیه: حجم فایل / سقف روزانه / فضای کاربر / فضای کل سایت
 *  4. ثبت رکورد در دفتر نگهبان (RgFile) — DB-first
 *  5. ذخیره فیزیکی: دیسک محلی (db/uploads) یا Vercel Blob (پروداکشن)
 *     — اگر ذخیره شکست بخورد، رکورد دفتر حذف می‌شود (بدون ناسازگاری)
 *
 * خروجی: { url, pathname, fileName, fileSize, mimeType, id }
 * pathname را هنگام ساخت موجودیت نهایی (تکلیف/محتوا) می‌فرستید و
 * reconcileRgFiles فایل را به آن موجودیت وصل می‌کند.
 */

export const runtime = "nodejs";

/** پسوندهای خطرناک — همیشه مسدود */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "sh", "ps1", "jar", "apk", "app", "vbs",
]);

function blockedExtension(name: string): boolean {
  const ext = path
    .extname(name)
    .slice(1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return BLOCKED_EXTENSIONS.has(ext);
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMemberOrHigher(); // GUEST ممنوع

    const form = await req.formData().catch(() => null);
    const raw = form?.get("file");
    // چک ساختاری (نه instanceof) — سازگار با هر runtime (Node/undici، Bun، Workers)
    const isFileLike =
      !!raw &&
      typeof raw === "object" &&
      typeof (raw as File).arrayBuffer === "function" &&
      typeof (raw as File).size === "number" &&
      typeof (raw as File).name === "string";
    if (!form || !isFileLike) {
      console.error(
        "[upload] diagnosing: form=", form ? "parsed" : "NULL",
        "| raw=", typeof raw,
        "| ctor=", raw && typeof raw === "object" ? (Object.getPrototypeOf(raw) as { constructor?: { name?: string } })?.constructor?.name : "-",
        "| contentType=", req.headers.get("content-type"),
      );
      throw new AuthError(400, "فایلی ارسال نشده است");
    }
    const file = raw as File;

    if (blockedExtension(file.name)) {
      throw new AuthError(400, "این نوع فایل به دلایل امنیتی مجاز نیست");
    }

    // ---------- قفل نگهبان منابع ----------
    await checkUploadQuota({ userId: user.id, fileSize: file.size, kind: "FILE" });

    const storageName = buildStorageName(file.name);
    const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    // در محیط Blob از پیشوند blob/ استفاده می‌کنیم تا /api/files آن را
    // به Vercel Blob بفرستد (پیشوند uploads/ مخصوص دیسک محلی است).
    const pathname = useBlob ? `blob/${storageName}` : `uploads/${storageName}`;
    const mimeType = (file.type || "application/octet-stream").slice(0, 120);
    const buffer = Buffer.from(await file.arrayBuffer());

    // ---------- ثبت در دفتر (DB-first) ----------
    const rgFile = await db.rgFile.create({
      data: {
        ownerId: user.id,
        pathname,
        fileName: file.name.slice(0, 200),
        mimeType,
        size: file.size,
        storage: useBlob ? "BLOB" : "LOCAL",
      },
      select: { id: true },
    });

    // ---------- ذخیره فیزیکی ----------
    try {
      if (useBlob) {
        await put(pathname, buffer, {
          access: "private",
          addRandomSuffix: false,
          contentType: mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      } else {
        await saveToDisk(storageName, buffer);
      }
    } catch (e) {
      // همگام‌سازی: رکورد دفتر را حذف کن تا مصرف ثبت‌شده اضافه نماند
      await db.rgFile.delete({ where: { id: rgFile.id } }).catch(() => {});
      console.error("[upload] ذخیره فیزیکی ناموفق:", e);
      throw new AuthError(500, "ذخیرهٔ فایل ناموفق بود؛ دوباره تلاش کنید");
    }

    return NextResponse.json(
      {
        url: `/api/files/${pathname}`,
        pathname,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        id: rgFile.id,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof RgError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return handleApiError(e);
  }
}
