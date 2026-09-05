import { createHash } from "crypto";
import path from "path";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";

import { db } from "@/lib/db";
import { emitRgEvent } from "@/lib/resource-guard";

/**
 * بکاپ و بازیابی سیبک — اسنپ‌شات JSON مستقل از موتور دیتابیس.
 *
 * چرا JSON و نه فایل SQLite؟
 *  - روی Turso/libsql (دیتابیس واقعی آینده) فایل sqlite در دسترس نیست؛
 *    اسنپ‌شات JSON با هر Prisma datasource سازگار است.
 *  - قابل خواندن توسط انسان، قابل دانلود از مرورگر و قابل انتقال بین محیط‌ها.
 *
 * ایمنی:
 *  - checksum (SHA-256) روی محتوای اسنپ‌شات — فایل خراب هرگز ری‌استور نمی‌شود.
 *  - مدل‌های اسنپ‌شات باید دقیقاً با اسکیمای فعلی بخوانند (نسخه + فهرست مدل‌ها).
 *  - ری‌استور درون یک تراکنش انجام می‌شود؛ هر خطی → rollback کامل، داده‌ها سالم.
 *  - ترتیب حذف/درج FK-امن (فرزندان قبل از والدین و برعکس برای درج).
 */

export const RG_BACKUP_DIR = path.join(process.cwd(), "db", "backups");
const RG_BACKUP_NAME_RE = /^sibak-backup-[0-9A-Za-z_-]+\.json$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class RgBackupError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RgBackupError";
    this.status = status;
  }
}

/**
 * ترتیب FK-امن جدول‌ها — حذف: از فرزندان به والدین؛ درج: معکوس.
 * این فهرست باید با prisma/schema.prisma همگام بماند.
 */
export const RG_BACKUP_VERSION = 1;
const TABLE_ORDER = [
  "chatRoomMember",
  "chatMessage",
  "chatRoom",
  "rgFile",
  "rgEvent",
  "notification",
  "auditLog",
  "pointLog",
  "userBadge",
  "userMedal",
  "medal",
  "badge",
  "debtVisibility",
  "debtEvent",
  "debt",
  "vetoLedger",
  "pollVote",
  "pollOption",
  "poll",
  "comment",
  "ideaVote",
  "idea",
  "calendarEvent",
  "submissionFile",
  "submission",
  "teacherContent",
  "teacherGroup",
  "groupMember",
  "group",
  "support",
  "announcement",
  "setting",
  "user",
] as const;

type Row = Record<string, unknown>;
interface Delegate {
  findMany: (args?: unknown) => Promise<Row[]>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
  createMany: (args: unknown) => Promise<{ count: number }>;
  count: (args?: unknown) => Promise<number>;
}

function delegateOf(client: unknown, key: string): Delegate {
  const d = (client as Record<string, unknown>)[key];
  if (!d || typeof (d as Delegate).findMany !== "function") {
    throw new RgBackupError(500, `مدل «${key}» در کلاینت دیتابیس یافت نشد — اسکیمای بکاپ با کد همگام نیست`);
  }
  return d as Delegate;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** احیای تاریخ‌ها — رشته‌های ISO دقیق به Date تبدیل می‌شوند */
function reviveRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && ISO_DATE_RE.test(v) ? new Date(v) : v;
  }
  return out;
}

function backupFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes(),
  )}-${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `sibak-backup-${stamp}-${rand}.json`;
}

function validateName(name: string): void {
  if (!RG_BACKUP_NAME_RE.test(name) || name.includes("..")) {
    throw new RgBackupError(400, "نام فایل پشتیبان نامعتبر است");
  }
}

/* ---------- ساخت بکاپ ---------- */

export interface CreateBackupResult {
  fileName: string;
  sizeBytes: number;
  checksum: string;
  totalRows: number;
  counts: Record<string, number>;
  /** در حالت download فایل روی دیسک ذخیره نشده و محتوا برگردانده می‌شود */
  content?: string;
}

export async function createBackup(options?: { persist?: boolean }): Promise<CreateBackupResult> {
  const persist = options?.persist ?? true;

  const tables: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  let totalRows = 0;
  for (const key of TABLE_ORDER) {
    const rows = await delegateOf(db, key).findMany();
    tables[key] = rows;
    counts[key] = rows.length;
    totalRows += rows.length;
  }

  const payload = {
    version: RG_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
  };
  const bodyJson = JSON.stringify(payload);
  const checksum = sha256(bodyJson);
  const fileName = backupFileName();
  const content = JSON.stringify({ ...payload, checksum });

  if (persist) {
    try {
      await mkdir(RG_BACKUP_DIR, { recursive: true });
      await writeFile(path.join(RG_BACKUP_DIR, fileName), content, "utf8");
    } catch (e) {
      console.error("[rg-backup] ذخیره روی دیسک ناموفق:", e);
      throw new RgBackupError(
        500,
        "ذخیرهٔ فایل پشتیبان در محیط فعلی ممکن نیست؛ از حالت «دانلود» استفاده کنید",
      );
    }
  }

  await emitRgEvent("BACKUP", "INFO", `پشتیبان کامل با ${totalRows} رکورد ساخته شد`, {
    fileName,
    totalRows,
    checksum,
    persisted: persist,
  });

  return {
    fileName,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    checksum,
    totalRows,
    counts,
    content: persist ? undefined : content,
  };
}

/* ---------- فهرست بکاپ‌ها ---------- */

export async function listBackups(): Promise<{
  fileName: string;
  sizeBytes: number;
  mtimeMs: number;
  createdAt: string;
  version: number;
  totalRows: number;
  checksum: string;
}[]> {
  let entries: string[];
  try {
    entries = await readdir(RG_BACKUP_DIR);
  } catch {
    return [];
  }
  const names = entries
    .filter((n) => RG_BACKUP_NAME_RE.test(n))
    .sort((a, b) => (a < b ? 1 : -1)) // جدیدترین اول (نام شامل زمان است)
    .slice(0, 50);

  const out: Awaited<ReturnType<typeof listBackups>> = [];
  for (const fileName of names) {
    try {
      const full = path.join(RG_BACKUP_DIR, fileName);
      const info = await stat(full);
      const parsed = JSON.parse(await readFile(full, "utf8")) as {
        version?: number;
        createdAt?: string;
        checksum?: string;
        tables?: Record<string, Row[]>;
      };
      const totalRows = parsed.tables
        ? Object.values(parsed.tables).reduce((acc, rows) => acc + rows.length, 0)
        : 0;
      out.push({
        fileName,
        sizeBytes: info.size,
        mtimeMs: info.mtimeMs,
        createdAt: parsed.createdAt ?? new Date(info.mtimeMs).toISOString(),
        version: parsed.version ?? 0,
        totalRows,
        checksum: parsed.checksum ?? "",
      });
    } catch (e) {
      console.error(`[rg-backup] خواندن ${fileName} ناموفق:`, e);
    }
  }
  return out;
}

export async function backupsSummary(): Promise<{ count: number; totalBytes: number }> {
  try {
    const entries = await readdir(RG_BACKUP_DIR);
    let count = 0;
    let totalBytes = 0;
    for (const n of entries) {
      if (!RG_BACKUP_NAME_RE.test(n)) continue;
      count++;
      const info = await stat(path.join(RG_BACKUP_DIR, n)).catch(() => null);
      if (info) totalBytes += info.size;
    }
    return { count, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

/* ---------- خواندن و اعتبارسنجی ---------- */

interface ParsedBackup {
  version: number;
  createdAt: string;
  tables: Record<string, Row[]>;
  checksum: string;
  counts: Record<string, number>;
}

function parseAndVerify(raw: string): ParsedBackup {
  let parsed: ParsedBackup;
  try {
    parsed = JSON.parse(raw) as ParsedBackup;
  } catch {
    throw new RgBackupError(400, "فایل پشتیبان JSON معتبر نیست");
  }
  if (typeof parsed.version !== "number" || !parsed.tables || typeof parsed.checksum !== "string") {
    throw new RgBackupError(400, "ساختار فایل پشتیبان نامعتبر است");
  }
  if (parsed.version !== RG_BACKUP_VERSION) {
    throw new RgBackupError(400, "نسخهٔ بکاپ با نسخهٔ فعلی سیستم همخوان نیست");
  }
  const { checksum, ...rest } = parsed;
  const recomputed = sha256(JSON.stringify(rest));
  if (recomputed !== checksum) {
    throw new RgBackupError(400, "چک‌سام بکاپ نامعتبر است — فایل خراب یا دستکاری‌شده است");
  }
  // همخوانی مدل‌ها با اسکیمای فعلی
  const snapshotKeys = Object.keys(parsed.tables);
  const expected = [...TABLE_ORDER].sort();
  const actual = [...snapshotKeys].sort();
  if (expected.join(",") !== actual.join(",")) {
    throw new RgBackupError(
      400,
      "فهرست مدل‌های بکاپ با اسکیمای فعلی همخوان نیست؛ پس از تغییر اسکیما یک پشتیبان تازه بگیرید",
    );
  }
  const counts: Record<string, number> = {};
  for (const key of snapshotKeys) counts[key] = parsed.tables[key].length;
  return { ...parsed, counts };
}

export async function readBackupFile(name: string): Promise<ParsedBackup> {
  validateName(name);
  const full = path.join(RG_BACKUP_DIR, name);
  const raw = await readFile(full, "utf8").catch(() => {
    throw new RgBackupError(404, "فایل پشتیبان پیدا نشد");
  });
  return parseAndVerify(raw);
}

/** بایت‌های خام برای دانلود — بدون parse */
export async function getBackupBytes(name: string): Promise<Buffer> {
  validateName(name);
  const full = path.join(RG_BACKUP_DIR, name);
  return readFile(full).catch(() => {
    throw new RgBackupError(404, "فایل پشتیبان پیدا نشد");
  });
}

export async function deleteBackup(name: string): Promise<void> {
  validateName(name);
  const full = path.join(RG_BACKUP_DIR, name);
  await unlink(full).catch(() => {
    throw new RgBackupError(404, "فایل پشتیبان پیدا نشد");
  });
}

/* ---------- بازیابی ---------- */

export interface RestoreResult {
  ok: true;
  totalRows: number;
  counts: Record<string, number>;
}

export async function restoreBackup(name: string): Promise<RestoreResult> {
  const parsed = await readBackupFile(name);

  await db.$transaction(async (tx) => {
    // ۱) پاک‌سازی FK-امن — از فرزندان به والدین
    for (const key of TABLE_ORDER) {
      await delegateOf(tx, key).deleteMany({});
    }
    // ۲) درج FK-امن — از والدین به فرزندان
    for (const key of [...TABLE_ORDER].reverse()) {
      const rows = parsed.tables[key] ?? [];
      if (rows.length === 0) continue;
      await delegateOf(tx, key).createMany({ data: rows.map(reviveRow) });
    }
    // ۳) صحت‌سنجی تعداد رکوردها — هر مغایرت → rollback خودکار
    for (const key of TABLE_ORDER) {
      const actual = await delegateOf(tx, key).count();
      const expected = (parsed.tables[key] ?? []).length;
      if (actual !== expected) {
        throw new RgBackupError(
          500,
          `صحت‌سنجی بازیابی در جدول «${key}» شکست خورد (${actual} از ${expected}) — تراکنش لغو شد`,
        );
      }
    }
  });

  await emitRgEvent("RESTORE", "CRITICAL", `بازگردانی کامل بکاپ «${name}» انجام شد`, {
    fileName: name,
    totalRows: parsed.counts ? Object.values(parsed.counts).reduce((a, b) => a + b, 0) : 0,
  });

  return { ok: true, totalRows: Object.values(parsed.counts).reduce((a, b) => a + b, 0), counts: parsed.counts };
}
