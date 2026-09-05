import { NextResponse } from "next/server";

import { getRubikaBotStatus } from "@/lib/rubika-bot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rubika-bot/status
 *
 * وضعیت ربات روبیکا — دو حالت:
 *
 *   ۱) RUBIKA_BOT_STANDALONE تنظیم نیست (لوکال/VPS):
 *      ربات داخل همین پروسس Next.js در حال polling است → وضعیت درون‌پروسسی.
 *
 *   ۲) RUBIKA_BOT_STANDALONE=true (پروداکشن روی Vercel):
 *      polling مال سرویس مستقل روی Render است → وضعیت از RUBIKA_BOT_URL
 *      (مثلاً https://sibak-bot.onrender.com) پروکسی می‌شود.
 */
export async function GET() {
  const standalone = process.env.RUBIKA_BOT_STANDALONE === "true";

  // ─── حالت پروداکشن: پروکسی به سرویس مستقل ربات ───
  if (standalone) {
    const base = (process.env.RUBIKA_BOT_URL ?? "http://localhost:3004").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return NextResponse.json({ ...data, via: "standalone" });
      }
      return NextResponse.json(
        {
          ok: false,
          standalone: true,
          reachable: false,
          base,
          error: `سرویس ربات پاسخ HTTP ${res.status} داد`,
        },
        { status: 502 },
      );
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          standalone: true,
          reachable: false,
          base,
          error: e instanceof Error ? e.message : "سرویس ربات در دسترس نیست",
        },
        { status: 502 },
      );
    }
  }

  // ─── حالت لوکال: وضعیت درون‌پروسسی ───
  try {
    return NextResponse.json({ ...getRubikaBotStatus(), via: "in-process" });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
