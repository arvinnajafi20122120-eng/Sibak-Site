import path from "path";
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";

import { db } from "@/lib/db";
import { notifyUser, notifyUsers } from "@/lib/notify";
import {
  DEFAULT_RG_CONFIG,
  formatBytes,
  RG_CONFIG_KEY,
  RgError,
  sanitizeRgConfig,
  usageLevel,
  type RgCleanupCandidate,
  type RgCleanupReport,
  type RgConfig,
  type RgTableRow,
  type RgUserUsage,
} from "@/lib/rg-types";

/**
 * نگهبان منابع سیبک — هستهٔ سمت سرور.
 *
 * وظایف:
 *  1. پیکربندی سهمیه‌ها (ذخیره در Setting با کلید resourceGuardConfig)
 *  2. قفل سهمیه قبل از هر آپلود (حجم فایل، سقف روزانه، فضای کاربر، فضای کل)
 *  3. دفتر ثبت فایل‌ها (RgFile) + اتصال به موجودیت مصرف‌کننده
 *  4. هشدار مصرف (رویداد RgEvent با dedupe روزانه + اعلان)
 *  5. سنجش دیتابیس (تعداد رکوردها، حجم فایل db، پیوست‌های چت)
 *  6. پاک‌سازی فایل‌های یتیم/موقت + تخلیه پیوست چتِ حذف‌شده از DB
 *
 * ایمنی ۱۰۰٪ پاک‌سازی: هیچ فایلی که در SubmissionFile.fileUrl یا
 * TeacherContent.filePath ارجاع دارد، هرگز حذف نمی‌شود — حتی اگر
 * رکورد RgFile نداشته باشد (داده‌های قبل از راه‌اندازی نگهبان).
 */

export const UPLOADS_DIR = path.join(process.cwd(), "db", "uploads");
export const LOCAL_URL_PREFIX = "/api/files/uploads/";

/* ---------- پیکربندی ---------- */

export async function getRgConfig(): Promise<RgConfig> {
  try {
    const row = await db.setting.findUnique({ where: { key: RG_CONFIG_KEY } });
    if (!row?.value) return { ...DEFAULT_RG_CONFIG };
    return sanitizeRgConfig(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_RG_CONFIG };
  }
}

export async function saveRgConfig(next: RgConfig): Promise<RgConfig> {
  const cfg = sanitizeRgConfig(next);
  await db.setting.upsert({
    where: { key: RG_CONFIG_KEY },
    update: { value: JSON.stringify(cfg) },
    create: { key: RG_CONFIG_KEY, value: JSON.stringify(cfg) },
  });
  return cfg;
}

/* ---------- رویدادها و هشدارها ---------- */

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ثبت رویداد ساده نگهبان (بدون dedupe) — هرگز خطا نمی‌دهد */
export async function emitRgEvent(
  type: string,
  level: "INFO" | "WARNING" | "CRITICAL",
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.rgEvent.create({
      data: {
        type,
        level,
        message,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (e) {
    console.error("[rg] خطا در ثبت رویداد:", e);
  }
}

/** ثبت رویداد با dedupe — هر dedupeKey فقط یک‌بار در روز */
async function emitDedupedEvent(input: {
  type: string;
  level: string;
  message: string;
  dedupeKey: string;
  meta?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const exists = await db.rgEvent.count({
      where: { meta: { contains: input.dedupeKey } },
    });
    if (exists > 0) return false;
    await db.rgEvent.create({
      data: {
        type: input.type,
        level: input.level,
        message: input.message,
        meta: JSON.stringify({ ...(input.meta ?? {}), dedupeKey: input.dedupeKey }),
      },
    });
    return true;
  } catch (e) {
    console.error("[rg] خطا در ثبت رویداد:", e);
    return false;
  }
}

async function activeAdminIds(): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** سنجش مصرف کل + تولید هشدار GLOBAL (فراخوانی: داشبورد و بعد از هر آپلود) */
export async function evaluateGlobalUsage(): Promise<void> {
  try {
    const cfg = await getRgConfig();
    if (cfg.globalStorageBytes <= 0) return;
    const agg = await db.rgFile.aggregate({
      where: { deletedAt: null },
      _sum: { size: true },
    });
    const used = agg._sum.size ?? 0;
    const pct = Math.min(100, (used / cfg.globalStorageBytes) * 100);
    const level = usageLevel(pct, cfg.warnPct, cfg.criticalPct);
    if (level === "OK") return;
    const dk = dayKey();
    const created = await emitDedupedEvent({
      type: "GLOBAL_WARNING",
      level: level === "CRITICAL" ? "CRITICAL" : "WARNING",
      message:
        level === "CRITICAL"
          ? `فضای فایل سایت ${Math.round(pct)}٪ پر شده — وضعیت بحرانی`
          : `فضای فایل سایت به ${Math.round(pct)}٪ سقف رسیده است`,
      dedupeKey: `GLOBAL:${dk}:${level}`,
      meta: { usedBytes: used, pct: Math.round(pct) },
    });
    if (created && level === "CRITICAL") {
      const admins = await activeAdminIds();
      await notifyUsers(admins, {
        title: "🚨 فضای سیبک رو به اتمام است",
        message: `مصرف فایل‌ها به ${Math.round(pct)}٪ سقف رسیده. پاک‌سازی یا افزایش سقف را در نگهبان منابع بررسی کنید.`,
        type: "WARNING",
        link: "#/admin-resources",
      });
    }
  } catch (e) {
    console.error("[rg] خطا در ارزیابی مصرف کلی:", e);
  }
}

/** هشدار حجم دیتابیس (بر اساس PRAGMA یا اندازه فایل db) */
export async function evaluateDbUsage(dbBytes: number | null): Promise<void> {
  try {
    if (dbBytes == null) return;
    const cfg = await getRgConfig();
    if (cfg.dbWarnBytes <= 0 || dbBytes < cfg.dbWarnBytes) return;
    await emitDedupedEvent({
      type: "DB_WARNING",
      level: "WARNING",
      message: "حجم دیتابیس از آستانه هشدار گذشته است",
      dedupeKey: `DB:${dayKey()}:${Math.floor(dbBytes / (100 * 1024 * 1024))}`, // هر ۱۰۰ مگابایت یک‌بار
      meta: { dbBytes },
    });
  } catch (e) {
    console.error("[rg] خطا در ارزیابی حجم دیتابیس:", e);
  }
}

/* ---------- قفل سهمیه آپلود ---------- */

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function deny(
  status: number,
  message: string,
  userId: string,
  reason: string,
): Promise<never> {
  // ثبت رویداد رد آپلود — روزانه حداکثر یک‌بار برای هر کاربر/دلیل (ضد اسپم)
  await emitDedupedEvent({
    type: "QUOTA_DENIED",
    level: "INFO",
    message,
    dedupeKey: `QUOTA:${userId}:${reason}:${dayKey()}`,
  });
  throw new RgError(status, message);
}

export interface UploadQuotaInput {
  userId: string;
  fileSize: number;
  kind?: "FILE" | "CHAT";
}

/**
 * قفل سهمیه قبل از آپلود — در صورت تخلف RgError با پیام فارسی پرتاب می‌کند.
 * اگر سهمیه شخصی کاربر به آستانه هشدار برسد، به خودش اعلان می‌دهد (روزی یک‌بار).
 */
export async function checkUploadQuota(input: UploadQuotaInput): Promise<void> {
  const { userId, fileSize } = input;
  const cfg = await getRgConfig();
  if (!cfg.enabled) return;

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    await deny(400, "حجم فایل نامعتبر است", userId, "INVALID");
  }

  const maxFile = input.kind === "CHAT" ? cfg.chatMaxFileBytes : cfg.maxFileBytes;
  if (fileSize > maxFile) {
    await deny(413, `حجم فایل بیش از سقف مجاز (${formatBytes(maxFile)}) است`, userId, "SIZE");
  }

  // سقف روزانه — رکوردهای امروز حتی اگر بعداً حذف شده باشند شمرده می‌شوند (ضد اسپم)
  const usedToday = await db.rgFile.count({
    where: { ownerId: userId, createdAt: { gte: startOfToday() } },
  });
  if (cfg.perUserDailyUploads > 0 && usedToday >= cfg.perUserDailyUploads) {
    await deny(
      429,
      `سقف آپلود روزانه شما (${cfg.perUserDailyUploads} فایل) پر شده است؛ فردا دوباره تلاش کنید`,
      userId,
      "DAILY",
    );
  }

  // سقف فضای شخصی
  const userAgg = await db.rgFile.aggregate({
    where: { ownerId: userId, deletedAt: null },
    _sum: { size: true },
  });
  const userUsed = userAgg._sum.size ?? 0;
  if (cfg.perUserStorageBytes > 0 && userUsed + fileSize > cfg.perUserStorageBytes) {
    await deny(
      403,
      "سقف فضای ذخیره‌سازی شما پر شده است؛ فایل‌های قدیمی را حذف کنید یا با ادمین تماس بگیرید",
      userId,
      "USER_QUOTA",
    );
  }

  // سقف فضای کل سایت
  const globalAgg = await db.rgFile.aggregate({
    where: { deletedAt: null },
    _sum: { size: true },
  });
  const globalUsed = globalAgg._sum.size ?? 0;
  if (cfg.globalStorageBytes > 0 && globalUsed + fileSize > cfg.globalStorageBytes) {
    await deny(403, "فضای ذخیره‌سازی سایت پر شده است؛ لطفاً به ادمین اطلاع دهید", userId, "GLOBAL_QUOTA");
  }

  // هشدار مصرف شخصی (به خود کاربر) — روزی یک‌بار در هر سطح
  if (cfg.perUserStorageBytes > 0) {
    const pct = ((userUsed + fileSize) / cfg.perUserStorageBytes) * 100;
    const level = usageLevel(pct, cfg.warnPct, cfg.criticalPct);
    if (level !== "OK") {
      const created = await emitDedupedEvent({
        type: "USER_WARNING",
        level: level === "CRITICAL" ? "CRITICAL" : "WARNING",
        message: `مصرف فضای کاربر به ${Math.round(pct)}٪ سقف رسید`,
        dedupeKey: `USER:${userId}:${dayKey()}:${level}`,
        meta: { userId, pct: Math.round(pct) },
      });
      if (created) {
        await notifyUser(userId, {
          title: level === "CRITICAL" ? "فضای شما تقریباً کامل است ⚠️" : "هشدار مصرف فضا",
          message: `${Math.round(pct)}٪ سقف فضای ذخیره‌سازی‌تان مصرف شده است.`,
          type: "WARNING",
          link: "#/profile",
        });
      }
    }
  }

  // هشدار مصرف کلی (اکنون که آپلودی انجام می‌شود، دوباره ارزیابی کن)
  await evaluateGlobalUsage();
}

/* ---------- دفتر فایل‌ها ---------- */

export interface RecordRgFileInput {
  ownerId?: string | null;
  pathname: string;
  fileName: string;
  mimeType: string;
  size: number;
  storage: "LOCAL" | "BLOB" | "DB";
  refType?: string | null;
  refId?: string | null;
}

export async function recordRgFile(input: RecordRgFileInput): Promise<string> {
  const row = await db.rgFile.create({
    data: {
      ownerId: input.ownerId ?? null,
      pathname: input.pathname,
      fileName: input.fileName.slice(0, 200),
      mimeType: input.mimeType.slice(0, 120),
      size: Math.max(0, Math.floor(input.size)),
      storage: input.storage,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

/** علامت‌گذاری حذف بر اساس موجودیت مصرف‌کننده — هرگز خطا نمی‌دهد */
export async function markRgFilesByRef(refType: string, refId: string): Promise<void> {
  try {
    await db.rgFile.updateMany({
      where: { refType, refId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  } catch (e) {
    console.error("[rg] خطا در علامت‌گذاری حذف فایل‌ها:", e);
  }
}

/** اتصال رکوردهای موقت به موجودیت نهایی (بعد از ساخت Submission/محتوا و ...) */
export async function reconcileRgFiles(
  refType: string,
  refId: string,
  pathnames: string[],
): Promise<void> {
  const list = pathnames.filter(Boolean);
  if (list.length === 0) return;
  try {
    await db.rgFile.updateMany({
      where: { pathname: { in: list }, deletedAt: null },
      data: { refType, refId },
    });
  } catch (e) {
    console.error("[rg] خطا در اتصال فایل‌ها به موجودیت:", e);
  }
}

/* ---------- سنجش ---------- */

export interface RgDiskInfo {
  bytes: number;
  count: number;
  files: { name: string; size: number; mtimeMs: number }[];
}

/** پیمایش db/uploads — در محیط بدون دیسک (Vercel) null */
export async function measureUploadsDir(): Promise<RgDiskInfo | null> {
  try {
    await stat(UPLOADS_DIR);
  } catch {
    return null;
  }
  try {
    const entries = await readdir(UPLOADS_DIR);
    const files: RgDiskInfo["files"] = [];
    let bytes = 0;
    for (const name of entries) {
      const info = await stat(path.join(UPLOADS_DIR, name)).catch(() => null);
      if (!info?.isFile()) continue;
      files.push({ name, size: info.size, mtimeMs: info.mtimeMs });
      bytes += info.size;
    }
    return { bytes, count: files.length, files };
  } catch (e) {
    console.error("[rg] خطا در پیمایش پوشه آپلود:", e);
    return null;
  }
}

const RG_TABLES: { key: string; label: string; softDeletable: boolean }[] = [
  { key: "user", label: "کاربران", softDeletable: true },
  { key: "group", label: "زیرمجموعه‌ها", softDeletable: true },
  { key: "idea", label: "ایده‌ها", softDeletable: true },
  { key: "comment", label: "کامنت‌ها", softDeletable: true },
  { key: "poll", label: "نظرسنجی‌ها", softDeletable: true },
  { key: "debt", label: "بدهکاری‌ها", softDeletable: true },
  { key: "announcement", label: "پیام‌های همگانی", softDeletable: true },
  { key: "calendarEvent", label: "رویدادهای تقویم", softDeletable: true },
  { key: "submission", label: "تکالیف", softDeletable: false },
  { key: "chatRoom", label: "اتاق‌های چت", softDeletable: true },
  { key: "chatMessage", label: "پیام‌های چت", softDeletable: true },
  { key: "notification", label: "اعلان‌ها", softDeletable: false },
  { key: "auditLog", label: "رکوردهای ممیزی", softDeletable: false },
  { key: "rgFile", label: "دفتر فایل‌ها", softDeletable: true },
  { key: "rgEvent", label: "رویدادهای نگهبان", softDeletable: false },
];

export interface RgDatabaseInfo {
  dbBytes: number | null;
  chatAttachBytes: number;
  chatAttachCount: number;
  rows: RgTableRow[];
}

async function databaseFileBytes(): Promise<number | null> {
  // روش ۱: PRAGMA (هم SQLite و هم libsql/Turso پشتیبانی می‌کنند)
  try {
    const pc = (await db.$queryRawUnsafe("PRAGMA page_count")) as Array<{ page_count?: number | bigint }>;
    const ps = (await db.$queryRawUnsafe("PRAGMA page_size")) as Array<{ page_size?: number | bigint }>;
    const pageCount = Number(pc?.[0]?.page_count ?? 0);
    const pageSize = Number(ps?.[0]?.page_size ?? 0);
    if (pageCount > 0 && pageSize > 0) return pageCount * pageSize;
  } catch {
    /* روش بعدی */
  }
  // روش ۲ (fallback): اندازه فایل در محیط لوکال
  try {
    const url = process.env.DATABASE_URL ?? "";
    if (url.startsWith("file:")) {
      const info = await stat(url.slice("file:".length));
      return info.size;
    }
  } catch {
    /* بی‌خیال */
  }
  return null;
}

export async function measureDatabase(): Promise<RgDatabaseInfo> {
  const rows: RgTableRow[] = [];
  for (const t of RG_TABLES) {
    try {
      const count = await (db as unknown as Record<string, { count: (a?: unknown) => Promise<number> }>)[t.key]?.count(
        t.softDeletable ? { where: { deletedAt: null } } : undefined,
      );
      rows.push({ key: t.key, label: t.label, count: count ?? 0 });
    } catch {
      rows.push({ key: t.key, label: t.label, count: 0 });
    }
  }

  let chatAttachBytes = 0;
  let chatAttachCount = 0;
  try {
    const agg = await db.chatMessage.aggregate({
      where: { type: "file", deletedAt: null },
      _sum: { fileSize: true },
      _count: { _all: true },
    });
    chatAttachBytes = agg._sum.fileSize ?? 0;
    chatAttachCount = agg._count._all;
  } catch {
    /* پیش‌فرض صفر */
  }

  const dbBytes = await databaseFileBytes();
  await evaluateDbUsage(dbBytes);
  return { dbBytes, chatAttachBytes, chatAttachCount, rows };
}

export async function measurePerUserUsage(cfg: RgConfig): Promise<RgUserUsage[]> {
  const start = startOfToday();
  const [byOwner, byAuthor, todayCounts, users] = await Promise.all([
    db.rgFile.groupBy({
      by: ["ownerId"],
      where: { deletedAt: null, ownerId: { not: null } },
      _sum: { size: true },
      _count: { _all: true },
    }),
    db.chatMessage.groupBy({
      by: ["authorId"],
      where: { deletedAt: null, type: "file" },
      _sum: { fileSize: true },
      _count: { _all: true },
    }),
    db.rgFile.groupBy({
      by: ["ownerId"],
      where: { ownerId: { not: null }, createdAt: { gte: start } },
      _count: { _all: true },
    }),
    db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, username: true, avatar: true, role: true },
    }),
  ]);

  const storageMap = new Map<string, { bytes: number; files: number }>();
  for (const row of byOwner) {
    if (!row.ownerId) continue;
    storageMap.set(row.ownerId, { bytes: row._sum.size ?? 0, files: row._count._all });
  }
  const chatMap = new Map<string, { bytes: number; files: number }>();
  for (const row of byAuthor) {
    chatMap.set(row.authorId, { bytes: row._sum.fileSize ?? 0, files: row._count._all });
  }
  const todayMap = new Map<string, number>();
  for (const row of todayCounts) {
    if (row.ownerId) todayMap.set(row.ownerId, row._count._all);
  }

  const out: RgUserUsage[] = users.map((u) => {
    const s = storageMap.get(u.id);
    const c = chatMap.get(u.id);
    const storageBytes = s?.bytes ?? 0;
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      role: u.role,
      storageBytes,
      fileCount: s?.files ?? 0,
      chatBytes: c?.bytes ?? 0,
      chatCount: c?.files ?? 0,
      uploadsToday: todayMap.get(u.id) ?? 0,
      pct:
        cfg.perUserStorageBytes > 0
          ? Math.min(100, (storageBytes / cfg.perUserStorageBytes) * 100)
          : 0,
    };
  });
  out.sort((a, b) => b.storageBytes + b.chatBytes - (a.storageBytes + a.chatBytes));
  return out;
}

/* ---------- پاک‌سازی فایل‌های یتیم/موقت ---------- */

function pathnameFromFileUrl(url: string): string | null {
  const prefix = "/api/files/";
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

function ageHours(ms: number): number {
  return Math.max(0, (Date.now() - ms) / 3_600_000);
}

/**
 * یافتن کاندیدهای پاک‌سازی با ایمنی کامل:
 *  - هر مسیری که در SubmissionFile یا TeacherContent ارجاع دارد محافظت می‌شود.
 *  - فایل‌های تازه (کمتر از tempMaxAgeHours) دست‌نخورده می‌مانند.
 */
export async function findCleanupCandidates(): Promise<RgCleanupCandidate[]> {
  const cfg = await getRgConfig();
  const cutoffHours = cfg.tempMaxAgeHours;

  const [disk, activeRows, deletedRows, submissionFiles, contents] = await Promise.all([
    measureUploadsDir(),
    db.rgFile.findMany({
      where: { deletedAt: null },
      select: { pathname: true, fileName: true, size: true, storage: true, refType: true, createdAt: true },
    }),
    db.rgFile.findMany({
      where: { deletedAt: { not: null } },
      select: { pathname: true, fileName: true, size: true, storage: true, deletedAt: true },
    }),
    db.submissionFile.findMany({ select: { fileUrl: true } }),
    db.teacherContent.findMany({ select: { filePath: true } }),
  ]);

  // مجموعه محافظت‌شده — قلب ایمنی سیستم
  const protectedPaths = new Set<string>();
  for (const f of submissionFiles) {
    const p = pathnameFromFileUrl(f.fileUrl);
    if (p) protectedPaths.add(p);
  }
  for (const c of contents) {
    if (c.filePath) protectedPaths.add(c.filePath);
  }

  const activePaths = new Set<string>(activeRows.map((r) => r.pathname));
  const deletedPaths = new Set<string>(deletedRows.map((r) => r.pathname));

  const candidates: RgCleanupCandidate[] = [];

  // ۱) رکوردهای حذف‌شده که فایل فیزیکی‌شان هنوز روی دیسک است
  for (const row of deletedRows) {
    if (row.storage !== "LOCAL") continue;
    const base = row.pathname.startsWith("uploads/") ? row.pathname.slice("uploads/".length) : row.pathname;
    const onDisk = disk?.files.find((f) => f.name === base);
    if (!onDisk) continue;
    if (protectedPaths.has(row.pathname)) continue; // ایمنی: ارجاع فعال دارد
    candidates.push({
      pathname: row.pathname,
      fileName: row.fileName,
      size: onDisk.size,
      reason: "DELETED_REF",
      ageHours: ageHours(row.deletedAt?.getTime() ?? onDisk.mtimeMs),
    });
  }

  // ۲) آپلودشده ولی هیچ‌وقت به هیچ موجودیتی وصل نشده (موقت/رهاشده)
  for (const row of activeRows) {
    if (row.storage !== "LOCAL" || row.refType) continue;
    if (protectedPaths.has(row.pathname)) continue;
    const h = ageHours(row.createdAt.getTime());
    if (h < cutoffHours) continue;
    candidates.push({
      pathname: row.pathname,
      fileName: row.fileName,
      size: row.size,
      reason: "UNATTACHED",
      ageHours: h,
    });
  }

  // ۳) فایل‌های روی دیسک بدون هیچ رکوردی (داده‌های قدیمی/زباله) — با چک محافظت
  if (disk) {
    for (const f of disk.files) {
      const pathname = `uploads/${f.name}`;
      if (activePaths.has(pathname) || deletedPaths.has(pathname) || protectedPaths.has(pathname)) continue;
      const h = ageHours(f.mtimeMs);
      if (h < cutoffHours) continue;
      candidates.push({
        pathname,
        fileName: f.name,
        size: f.size,
        reason: "ORPHAN_DISK",
        ageHours: h,
      });
    }
  }

  return candidates;
}

export interface RgChatPurgeTarget {
  id: string;
  roomId: string;
  fileName: string | null;
}

/**
 * پیوست‌های چتِ نرم-حذف‌شده، data URL شان برای همیشه داخل DB می‌ماند.
 * این تابع data URL آن‌ها را تخلیه می‌کند (فراداده پیام حفظ می‌شود).
 */
export async function findChatPurgeTargets(): Promise<RgChatPurgeTarget[]> {
  const cfg = await getRgConfig();
  const cutoff = new Date(Date.now() - cfg.tempMaxAgeHours * 3_600_000);
  return db.chatMessage.findMany({
    where: { deletedAt: { not: null }, type: "file", fileData: { not: null }, updatedAt: { lt: cutoff } },
    select: { id: true, roomId: true, fileName: true },
  });
}

export async function runCleanup(dryRun: boolean): Promise<RgCleanupReport> {
  const candidates = await findCleanupCandidates();
  const chatTargets = await findChatPurgeTargets();
  let removed = 0;
  let freedBytes = 0;
  let chatPurged = 0;

  if (!dryRun) {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    for (const c of candidates) {
      try {
        if (c.pathname.startsWith("uploads/")) {
          const base = c.pathname.slice("uploads/".length);
          await unlink(path.join(UPLOADS_DIR, base));
        }
        // رکورد فعال (UNATTACHED) → نرم-حذف تا دفتر همگام بماند
        await db.rgFile.updateMany({
          where: { pathname: c.pathname, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        removed++;
        freedBytes += c.size;
      } catch (e) {
        console.error(`[rg] حذف فایل ${c.pathname} ناموفق:`, e);
      }
    }

    // فایل‌های BLOB حذف‌شده از موجودیت — حذف فیزیکی از Vercel Blob
    if (blobToken) {
      const blobRows = await db.rgFile.findMany({
        where: { deletedAt: { not: null }, storage: "BLOB" },
        select: { pathname: true },
      });
      for (const row of blobRows) {
        try {
          const { del } = await import("@vercel/blob");
          await del(row.pathname, { token: blobToken });
        } catch {
          /* فایل شاید قبلاً حذف شده باشد */
        }
      }
    }

    // تخلیه data URL پیوست‌های چتِ حذف‌شده از دیتابیس
    if (chatTargets.length > 0) {
      try {
        const res = await db.chatMessage.updateMany({
          where: { id: { in: chatTargets.map((t) => t.id) } },
          data: { fileData: null },
        });
        chatPurged = res.count;
      } catch (e) {
        console.error("[rg] تخلیه پیوست چت ناموفق:", e);
      }
    }
  }

  return {
    dryRun,
    candidates,
    removed,
    freedBytes,
    chatPurgeCandidates: chatTargets.length,
    chatPurged,
  };
}

/* ---------- نگهداری بلندمدت ---------- */

let lastPruneAt = 0;

/** هراسیدن رویدادهای قدیمی نگهبان (بیش از ۹۰ روز) — حداکثر ساعتی یک‌بار */
export async function maybePruneRgEvents(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 3_600_000) return;
  lastPruneAt = now;
  try {
    const cutoff = new Date(now - 90 * 86_400_000);
    const res = await db.rgEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (res.count > 0) {
      console.log(`[rg] ${res.count} رویداد قدیمی نگهبان هرس شد`);
    }
  } catch (e) {
    console.error("[rg] هرس رویدادها ناموفق:", e);
  }
}

/* ---------- ابزار ذخیره فیزیکی (برای /api/upload) ---------- */

export function buildStorageName(originalName: string): string {
  const ext = path
    .extname(originalName)
    .slice(1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return ext ? `${base}.${ext}` : base;
}

export async function saveToDisk(storageName: string, data: Buffer): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, storageName), data);
}
