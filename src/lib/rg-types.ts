/**
 * نگهبان منابع سیبک (Sibak Resource Guard) — انواع و منطق مشترک.
 *
 * این فایل عمداً هیچ وابستگی سمت‌سرور (db/next) ندارد تا هم کلاینت و هم سرور
 * بتوانند از آن import کنند — قرارداد مشابه src/lib/support.ts.
 *
 * معماری چند-محیطی (برای اتصال دیتابیس واقعی در آینده):
 *  - دیتابیس: Prisma — الان SQLite محلی، بعداً Turso (libsql) بدون تغییر کد.
 *  - فایل‌ها: LOCAL (دیسک db/uploads) یا BLOB (Vercel Blob) یا DB (پیوست چت).
 *  - بکاپ: اسنپ‌شات JSON مستقل از موتور دیتابیس → روی Turso هم ری‌استورشدنی.
 */

import { toFa } from "@/lib/jalali";

/* ---------- خطای سهمیه (سرور پرتاب می‌کند، کلاینت فقط نوع را می‌شناسد) ---------- */

export class RgError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RgError";
    this.status = status;
  }
}

/* ---------- پیکربندی سهمیه‌ها ---------- */

export interface RgConfig {
  /** کل سیستم فعال باشد؟ (خاموش = هیچ سهمیه‌ای اعمال نمی‌شود ولی ثبت مصرف ادامه دارد) */
  enabled: boolean;
  /** حداکثر حجم هر فایل آپلودی (بایت) */
  maxFileBytes: number;
  /** سقف مجموع فضای فایل‌های هر کاربر (بایت) */
  perUserStorageBytes: number;
  /** حداکثر تعداد آپلود روزانه هر کاربر */
  perUserDailyUploads: number;
  /** سقف کل فضای فایل‌های سایت (بایت) */
  globalStorageBytes: number;
  /** حداکثر حجم فایل پیوست چت (بایت) */
  chatMaxFileBytes: number;
  /** آستانه هشدار مصرف (درصد) */
  warnPct: number;
  /** آستانه بحرانی مصرف (درصد) */
  criticalPct: number;
  /** عمر فایل موقت/یتیم (ساعت) — بعد از آن قابل پاک‌سازی است */
  tempMaxAgeHours: number;
  /** هشدار حجم دیتابیس (بایت) — 0 = خاموش */
  dbWarnBytes: number;
}

export const MB = 1024 * 1024;
export const GB = 1024 * MB;

export const DEFAULT_RG_CONFIG: RgConfig = {
  enabled: true,
  maxFileBytes: 15 * MB,
  perUserStorageBytes: 200 * MB,
  perUserDailyUploads: 30,
  globalStorageBytes: 1 * GB,
  chatMaxFileBytes: 5 * MB,
  warnPct: 80,
  criticalPct: 90,
  tempMaxAgeHours: 72,
  dbWarnBytes: 512 * MB,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** اعتبارسنجی/پاکسازی ورودی نامعتبر — همیشه یک RgConfig سالم برمی‌گرداند */
export function sanitizeRgConfig(raw: unknown): RgConfig {
  const r = (raw ?? {}) as Partial<RgConfig>;
  const cfg: RgConfig = {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_RG_CONFIG.enabled,
    maxFileBytes: clampInt(r.maxFileBytes, 100 * 1024, 200 * MB, DEFAULT_RG_CONFIG.maxFileBytes),
    perUserStorageBytes: clampInt(r.perUserStorageBytes, 10 * MB, 10 * GB, DEFAULT_RG_CONFIG.perUserStorageBytes),
    perUserDailyUploads: clampInt(r.perUserDailyUploads, 1, 1000, DEFAULT_RG_CONFIG.perUserDailyUploads),
    globalStorageBytes: clampInt(r.globalStorageBytes, 50 * MB, 100 * GB, DEFAULT_RG_CONFIG.globalStorageBytes),
    chatMaxFileBytes: clampInt(r.chatMaxFileBytes, 100 * 1024, 50 * MB, DEFAULT_RG_CONFIG.chatMaxFileBytes),
    warnPct: clampInt(r.warnPct, 50, 99, DEFAULT_RG_CONFIG.warnPct),
    criticalPct: clampInt(r.criticalPct, 51, 100, DEFAULT_RG_CONFIG.criticalPct),
    tempMaxAgeHours: clampInt(r.tempMaxAgeHours, 1, 24 * 365, DEFAULT_RG_CONFIG.tempMaxAgeHours),
    dbWarnBytes: clampInt(r.dbWarnBytes, 0, 50 * GB, DEFAULT_RG_CONFIG.dbWarnBytes),
  };
  // هشدار باید پایین‌تر از آستانه بحرانی باشد
  if (cfg.warnPct >= cfg.criticalPct) cfg.warnPct = cfg.criticalPct - 1;
  return cfg;
}

export const RG_CONFIG_KEY = "resourceGuardConfig";

/* ---------- فرمت و سطح مصرف ---------- */

export function formatBytes(bytes: number): string {
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const num = i === 0 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  return `${toFa(num)} ${units[i]}`;
}

export type RgLevel = "OK" | "WARNING" | "CRITICAL";

export function usageLevel(pct: number, warnPct: number, criticalPct: number): RgLevel {
  if (pct >= criticalPct) return "CRITICAL";
  if (pct >= warnPct) return "WARNING";
  return "OK";
}

export const RG_LEVEL_LABELS: Record<RgLevel, string> = {
  OK: "سالم",
  WARNING: "هشدار مصرف",
  CRITICAL: "بحرانی",
};

/* ---------- رویدادها ---------- */

export type RgEventType =
  | "QUOTA_DENIED"
  | "USER_WARNING"
  | "GLOBAL_WARNING"
  | "DB_WARNING"
  | "CLEANUP"
  | "BACKUP"
  | "RESTORE"
  | "CONFIG";

export const RG_EVENT_TYPE_LABELS: Record<RgEventType, string> = {
  QUOTA_DENIED: "رد آپلود",
  USER_WARNING: "هشدار کاربر",
  GLOBAL_WARNING: "هشدار کلی",
  DB_WARNING: "هشدار دیتابیس",
  CLEANUP: "پاک‌سازی",
  BACKUP: "پشتیبان‌گیری",
  RESTORE: "بازگردانی",
  CONFIG: "تغییر سقف‌ها",
};

export interface RgEventDTO {
  id: string;
  type: string;
  level: string;
  message: string;
  createdAt: string;
}

/* ---------- مصرف کاربران ---------- */

export interface RgUserUsage {
  userId: string;
  name: string;
  username: string;
  avatar: string | null;
  role: string;
  /** مجموع فایل‌های آپلودی فعال (بایت) */
  storageBytes: number;
  fileCount: number;
  /** پیوست‌های چت که داخل دیتابیس ذخیره شده‌اند (بایت) */
  chatBytes: number;
  chatCount: number;
  /** تعداد آپلود امروز (شامل رکوردهای حذف‌شده امروز — ضد اسپم) */
  uploadsToday: number;
  /** درصد پرشدن سهمیه شخصی */
  pct: number;
}

/* ---------- پاک‌سازی ---------- */

export type RgCleanupReason = "DELETED_REF" | "UNATTACHED" | "ORPHAN_DISK";

export const RG_CLEANUP_REASON_LABELS: Record<RgCleanupReason, string> = {
  DELETED_REF: "موجودیتِ آن حذف شده",
  UNATTACHED: "آپلودشده ولی هیچ‌جا استفاده نشده",
  ORPHAN_DISK: "بدون رکورد در دفتر (فایل قدیمی)",
};

export interface RgCleanupCandidate {
  pathname: string;
  fileName: string;
  size: number;
  reason: RgCleanupReason;
  ageHours: number;
}

export interface RgCleanupReport {
  dryRun: boolean;
  candidates: RgCleanupCandidate[];
  removed: number;
  freedBytes: number;
  /** تعداد پیوست‌های چتِ حذف‌شده که data URL شان قابل تخلیه از DB است */
  chatPurgeCandidates: number;
  /** تعداد پیوست‌هایی که در این اجرا واقعاً تخلیه شدند */
  chatPurged: number;
}

/* ---------- بکاپ ---------- */

export interface RgBackupMeta {
  fileName: string;
  sizeBytes: number;
  mtimeMs: number;
  createdAt: string;
  version: number;
  totalRows: number;
  checksum: string;
  counts: Record<string, number>;
}

/* ---------- پاسخ داشبورد ---------- */

export interface RgTableRow {
  key: string;
  label: string;
  count: number;
}

export interface RgOverviewResponse {
  config: RgConfig;
  canManage: boolean;
  storage: {
    usedBytes: number;
    fileCount: number;
    quotaBytes: number;
    pct: number;
    level: RgLevel;
  };
  /** فقط در محیط لوکال (دیسک) — در Vercel Blob نال */
  disk: { bytes: number; count: number } | null;
  database: {
    dbBytes: number | null;
    chatAttachBytes: number;
    chatAttachCount: number;
    rows: RgTableRow[];
  };
  users: RgUserUsage[];
  events: RgEventDTO[];
  backups: { count: number; totalBytes: number };
}
