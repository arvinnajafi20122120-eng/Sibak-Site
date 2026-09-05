import { db } from "@/lib/db";
import { toSafeUser } from "@/lib/types";
import type { Role, UserStatus } from "@/lib/types";
import {
  JALALI_MONTHS,
  jalaliToGregorian,
  toFa,
  toJalali,
  relativeTime,
  formatJalaliDate,
  formatJalaliDateTime,
} from "@/lib/jalali";
import type { User } from "@prisma/client";

/**
 * ابزارهای مشترک پنل ادمین سیبک — همگی سمت سرور.
 */

export const ADMIN_SAFE_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  status: true,
  joinReason: true,
  skills: true,
  bio: true,
  avatar: true,
  points: true,
  rejectionNote: true,
  guestExpiresAt: true,
  guestScope: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** شامل deletedAt برای پنل ادمین — لیست/پرونده می‌بیند حذف‌شده‌ها را. */
export const ADMIN_FULL_SELECT = {
  ...ADMIN_SAFE_SELECT,
  deletedAt: true,
} as const;

export interface AdminCounts {
  usersTotal: number;
  usersActive: number;
  usersPending: number;
  usersRejected: number;
  usersSuspended: number;
  guestsCount: number;
  groups: number;
  ideasPending: number;
  ideasTotal: number;
  pollsOpen: number;
  debtsOpen: number;
  announcements: number;
  vetoesGrantedTotal: number;
}

/** ۶ ماه شمسی اخیر برای نمودار. */
export function sixJalaliMonths(): {
  jy: number;
  jm: number;
  label: string;
  start: Date;
  end: Date;
}[] {
  const now = new Date();
  const cur = toJalali(now);
  const months: {
    jy: number;
    jm: number;
    label: string;
    start: Date;
    end: Date;
  }[] = [];
  let jy = cur.jy;
  let jm = cur.jm;
  for (let i = 0; i < 6; i++) {
    const start = jalaliToGregorian(jy, jm, 1);
    const nextM = jm === 12 ? 1 : jm + 1;
    const nextY = jm === 12 ? jy + 1 : jy;
    const end = jalaliToGregorian(nextY, nextM, 1);
    months.unshift({
      jy,
      jm,
      label: `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`,
      start,
      end,
    });
    jm -= 1;
    if (jm < 1) {
      jm = 12;
      jy -= 1;
    }
  }
  return months;
}

/** خلاصه audit برای نمایش در پنل — actor safe + summary + relative + data. */
export async function toAuditDTO(a: {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  data: string | null;
  createdAt: Date;
}) {
  let actor: ReturnType<typeof toSafeUser> | null = null;
  if (a.actorId) {
    const u = await db.user.findUnique({
      where: { id: a.actorId },
      select: ADMIN_SAFE_SELECT,
    });
    if (u) actor = toSafeUser(u as never);
  }
  let parsedData: unknown = null;
  if (a.data) {
    try {
      parsedData = JSON.parse(a.data);
    } catch {
      parsedData = a.data;
    }
  }
  return {
    id: a.id,
    actor,
    actorId: a.actorId,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    summary: a.summary,
    data: parsedData,
    createdAt: a.createdAt.toISOString(),
    relative: relativeTime(a.createdAt),
    dateFa: formatJalaliDate(a.createdAt),
    dateTimeFa: formatJalaliDateTime(a.createdAt),
  };
}

export type AuditRowDTO = Awaited<ReturnType<typeof toAuditDTO>>;

export const STATUS_CHIP: Record<UserStatus, string> = {
  PENDING: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  ACTIVE: "bg-chart-1/15 text-primary border-chart-1/40",
  SUSPENDED: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
};

export const STATUS_LABEL_FA: Record<UserStatus, string> = {
  PENDING: "در انتظار",
  ACTIVE: "فعال",
  SUSPENDED: "معلق",
  REJECTED: "ردشده",
};

export const ROLE_LABEL_FA: Record<Role, string> = {
  ADMIN: "ادمین",
  MANAGER: "مدیر",
  MEMBER: "کاربر",
  GUEST: "مهمان",
};

/** کاربر با deletedAt در خروجی — برای پنل ادمین. */
export function toAdminSafeUser(u: User & { deletedAt?: Date | null }) {
  const safe = toSafeUser(u as never);
  return {
    ...safe,
    deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
  };
}

export type AdminUserDTO = ReturnType<typeof toAdminSafeUser>;
