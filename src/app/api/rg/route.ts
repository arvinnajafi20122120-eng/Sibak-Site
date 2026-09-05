import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import {
  evaluateGlobalUsage,
  getRgConfig,
  measureDatabase,
  measurePerUserUsage,
  measureUploadsDir,
  maybePruneRgEvents,
} from "@/lib/resource-guard";
import { backupsSummary } from "@/lib/rg-backup";
import { usageLevel } from "@/lib/rg-types";

/**
 * داشبورد نگهبان منابع — GET /api/rg
 * ADMIN و MANAGER (فقط خواندنی) — خروجی کامل: سقف‌ها، مصرف فایل/دیتابیس/دیسک،
 * مصرف کاربران، رویدادها و خلاصه بکاپ‌ها.
 *
 * بازدید داشبورد خودش ارزیابی هشدارها را هم انجام می‌دهد (رویدادهای
 * WARNING/CRITICAL با dedupe روزانه ثبت می‌شوند) و رویدادهای قدیمی را هرس می‌کند.
 */
export async function GET() {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);

    const cfg = await getRgConfig();

    const globalAgg = await db.rgFile.aggregate({
      where: { deletedAt: null },
      _sum: { size: true },
      _count: { _all: true },
    });
    const usedBytes = globalAgg._sum.size ?? 0;
    const fileCount = globalAgg._count._all;
    const pct =
      cfg.globalStorageBytes > 0
        ? Math.min(100, (usedBytes / cfg.globalStorageBytes) * 100)
        : 0;

    // ثبت هشدارها (در صورت عبور از آستانه) + هرس رویدادهای قدیمی
    await evaluateGlobalUsage();

    const [disk, database, users, backups] = await Promise.all([
      measureUploadsDir(),
      measureDatabase(),
      measurePerUserUsage(cfg),
      backupsSummary(),
    ]);

    const events = await db.rgEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    void maybePruneRgEvents();

    return NextResponse.json({
      config: cfg,
      canManage: user.role === "ADMIN",
      storage: {
        usedBytes,
        fileCount,
        quotaBytes: cfg.globalStorageBytes,
        pct,
        level: usageLevel(pct, cfg.warnPct, cfg.criticalPct),
      },
      disk: disk ? { bytes: disk.bytes, count: disk.count } : null,
      database,
      users,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        level: e.level,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      })),
      backups,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
