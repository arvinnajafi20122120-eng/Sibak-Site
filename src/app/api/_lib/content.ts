/**
 * ابزارهای مشترک API سکشن‌های گروه/ایده/رویداد سیبک.
 * این فایل فقط سمت سرور است.
 */
import { db } from "@/lib/db";

/** رنگ‌های مجاز گروه. */
export const GROUP_COLORS = ["emerald", "rose", "amber", "teal", "orange"] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];

export const GROUP_COLOR_LABELS: Record<string, string> = {
  emerald: "سبز سیبی",
  rose: "گل‌سرخی",
  amber: "کهربایی",
  teal: "فیروزه‌ای",
  orange: "نارنجی",
};

export const JOIN_POLICY_LABELS: Record<string, string> = {
  OPEN: "باز",
  REQUEST: "درخواستی",
  INVITE: "دعوتی",
};

/** تولید slug از نام (با transliterate ساده فارسی→لاتین) — در تداخل، پسوند تصادفی. */
const FA_MAP: Record<string, string> = {
  ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s",
  ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z",
  ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s",
  ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f",
  ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n",
  و: "v", ه: "h", ی: "y",
};

export function slugifyFa(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return `group-${rand()}`;
  const mapped = Array.from(trimmed)
    .map((ch) => {
      if (/[a-z0-9]/.test(ch)) return ch;
      if (FA_MAP[ch]) return FA_MAP[ch];
      if (ch === " " || ch === "-" || ch === "_") return "-";
      return "";
    })
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return mapped || `group-${rand()}`;
}

export function rand(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** بررسی یکتایی slug — در تداخل، پسوند تصادفی می‌چسباند. */
export async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (await db.group.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${base}-${rand()}`;
    if (attempt > 10) break;
  }
  return slug;
}

/** آیا کاربر فعالی (با نقش مجاز)؟ */
export function canManageContent(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** جستجوی ادمین‌ها و مدیران — برای اعلان محتوای جدید. */
export async function getStaffUserIds(): Promise<string[]> {
  const staff = await db.user.findMany({
    where: {
      role: { in: ["ADMIN", "MANAGER"] },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  return staff.map((u) => u.id);
}

/** اعضای فعال یک گروه. */
export async function getActiveGroupMemberIds(groupId: string): Promise<string[]> {
  const members = await db.groupMember.findMany({
    where: { groupId, status: "ACTIVE" },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * اعطای امتیاز با ثبت PointLog.
 * فراخواننده موظف است فقط هنگام انتقال به وضعیت جدید صدا بزند
 * (به‌جای وابستن به idempotency داخلی، از hasPointsBeenAwarded استفاده کنید).
 */
export async function awardPoints(
  userId: string,
  delta: number,
  reason: string,
  actorId?: string,
): Promise<void> {
  try {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { points: { increment: delta } },
      }),
      db.pointLog.create({
        data: { userId, delta, reason, actorId: actorId ?? null },
      }),
    ]);
  } catch (e) {
    console.error("[award-points] خطا:", e);
  }
}

/**
 * بررسی idempotency: آیا قبلاً برای این reason/user امتیاز ثبت شده؟
 */
export async function hasPointsBeenAwarded(userId: string, reason: string): Promise<boolean> {
  const existing = await db.pointLog.findFirst({
    where: { userId, reason },
    select: { id: true },
  });
  return !!existing;
}
