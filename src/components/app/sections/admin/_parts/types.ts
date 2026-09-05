"use client";

import type { SafeUser } from "@/lib/types";
import type { Role, UserStatus } from "@/lib/types";

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

export interface AuditRow {
  id: string;
  actor: SafeUser | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  data: unknown;
  createdAt: string;
  relative: string;
  dateFa: string;
  dateTimeFa: string;
}

export interface PendingJoinRequest {
  id: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  leaderId: string | null;
  user: SafeUser;
  createdAt: string;
  relative: string;
}

export interface AdminOverview {
  counts: AdminCounts;
  recentPending: SafeUser[];
  recentAudit: AuditRow[];
  pendingJoinRequests: PendingJoinRequest[];
}

export interface AdminUser extends SafeUser {
  deletedAt: string | null;
  ideasCount: number;
  ideasDeletedCount: number;
  pollsCount: number;
  debtsCount: number;
}

export interface DossierCounts {
  ideasTotal: number;
  ideasDeleted: number;
  pollsTotal: number;
  pollsDeleted: number;
  debtsTotal: number;
  debtsDeleted: number;
  eventsTotal: number;
  eventsDeleted: number;
  announcementsTotal: number;
  announcementsDeleted: number;
  commentsTotal: number;
  commentsDeleted: number;
  groupMemberships: number;
  auditActions: number;
}

export interface DossierVetoEntry {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  sourcePollId: string | null;
  createdAt: string;
  dateFa: string;
  relative: string;
}

export interface DossierDebt {
  id: string;
  title: string;
  amount: number;
  status: string;
  visibility: string;
  createdAt: string;
  deletedAt: string | null;
  debtor: SafeUser;
  creditor: SafeUser;
  myRole: "debtor" | "creditor";
  eventsCount: number;
}

export interface DossierBadge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  awardedAt: string;
  awardedById: string | null;
}

export interface DossierMembership {
  id: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  status: string;
  joinedAt: string;
  groupDeleted: boolean;
}

export interface DossierDeletedContent {
  ideas: {
    id: string;
    title: string;
    description: string;
    status: string;
    groupId: string | null;
    createdAt: string;
    deletedAt: string | null;
  }[];
  polls: {
    id: string;
    title: string;
    type: string;
    status: string;
    createdAt: string;
    deletedAt: string | null;
    closesAt: string | null;
  }[];
  debts: DossierDebt[];
  events: {
    id: string;
    title: string;
    type: string;
    date: string;
    groupId: string | null;
    deletedAt: string | null;
  }[];
  announcements: {
    id: string;
    title: string;
    level: string;
    pinned: boolean;
    audience: string;
    createdAt: string;
    deletedAt: string | null;
  }[];
  comments: {
    id: string;
    body: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    deletedAt: string | null;
  }[];
  ideasDeletedCount: number;
  pollsDeletedCount: number;
}

export interface Dossier {
  user: SafeUser & { deletedAt: string | null };
  counts: DossierCounts;
  pointsSeries: { month: string; delta: number }[];
  vetoSeries: { month: string; grants: number; uses: number; balance: number }[];
  vetoBalance: number;
  vetoLedger: DossierVetoEntry[];
  debtsInvolving: DossierDebt[];
  debtChart: { month: string; iOwe: number; owedToMe: number; net: number }[];
  badges: DossierBadge[];
  auditHistory: AuditRow[];
  statusHistory: AuditRow[];
  deletedContent: DossierDeletedContent;
  memberships: DossierMembership[];
}

export interface AdminComment {
  id: string;
  body: string;
  entityType: string;
  entityId: string;
  author: SafeUser;
  createdAt: string;
  dateTimeFa: string;
  relative: string;
  deletedAt: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "ادمین",
  TEACHER: "استاد",
  MANAGER: "مدیر",
  MEMBER: "کاربر",
  GUEST: "مهمان",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "در انتظار",
  ACTIVE: "فعال",
  SUSPENDED: "معلق",
  REJECTED: "ردشده",
};

export const STATUS_CHIP: Record<UserStatus, string> = {
  PENDING: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  ACTIVE: "bg-chart-1/15 text-primary border-chart-1/40",
  SUSPENDED: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
};

export const ROLE_CHIP: Record<Role, string> = {
  ADMIN: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  TEACHER: "bg-chart-5/15 text-chart-5 border-chart-5/40",
  MANAGER: "bg-chart-1/15 text-primary border-chart-1/40",
  MEMBER: "bg-secondary text-secondary-foreground border-border",
  GUEST: "bg-chart-4/15 text-chart-4 border-chart-4/40",
};

/** رنگ‌کد اکشن‌های ممیزی برای بج. */
export const ACTION_TONE: Record<string, string> = {
  USER_APPROVE: "bg-chart-1/15 text-primary border-chart-1/40",
  USER_REJECT: "bg-destructive/15 text-destructive border-destructive/30",
  USER_SUSPEND: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  USER_ACTIVATE: "bg-chart-1/15 text-primary border-chart-1/40",
  USER_ROLE_CHANGE: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  USER_STATUS_CHANGE: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  USER_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  USER_RESTORE: "bg-chart-1/15 text-primary border-chart-1/40",
  USER_REJECTION_NOTE_UPDATE: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  GUEST_CREATE: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  POINTS_ADJUST: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  RESTORE: "bg-chart-1/15 text-primary border-chart-1/40",
  IDEA_CREATE: "bg-chart-1/15 text-primary border-chart-1/40",
  IDEA_STATUS_CHANGE: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  IDEA_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  POLL_CREATE: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  POLL_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  EVENT_CREATE: "bg-chart-1/15 text-primary border-chart-1/40",
  EVENT_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  GROUP_CREATE: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  GROUP_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  ANNOUNCEMENT_CREATE: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  ANNOUNCEMENT_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  DEBT_CREATE: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  DEBT_DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  SETTING_UPDATE: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  BADGE_AWARD: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  VETO_ADMIN_ADJUST: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
};

/** عنوان فارسی اکشن برای نمودار پرونده. */
export const ACTION_LABEL_FA: Record<string, string> = {
  USER_APPROVE: "تأیید عضویت",
  USER_REJECT: "رد عضویت",
  USER_SUSPEND: "معلق‌سازی",
  USER_ACTIVATE: "فعال‌سازی",
  USER_ROLE_CHANGE: "تغییر نقش",
  USER_STATUS_CHANGE: "تغییر وضعیت",
  USER_DELETE: "حذف کاربر",
  USER_RESTORE: "بازیابی کاربر",
  USER_REJECTION_NOTE_UPDATE: "ویرایش یادداشت رد",
  GUEST_CREATE: "ایجاد عضو مهمان",
  POINTS_ADJUST: "تنظیم امتیاز",
  RESTORE: "بازیافت محتوا",
  IDEA_CREATE: "ساخت ایده",
  IDEA_STATUS_CHANGE: "تغییر وضعیت ایده",
  IDEA_DELETE: "حذف ایده",
  POLL_CREATE: "ساخت نظرسنجی",
  POLL_DELETE: "حذف نظرسنجی",
  EVENT_CREATE: "ساخت رویداد",
  EVENT_DELETE: "حذف رویداد",
  GROUP_CREATE: "ساخت گروه",
  GROUP_DELETE: "حذف گروه",
  ANNOUNCEMENT_CREATE: "ساخت پیام",
  ANNOUNCEMENT_DELETE: "حذف پیام",
  DEBT_CREATE: "ساخت بدهی",
  DEBT_DELETE: "حذف بدهی",
  SETTING_UPDATE: "ویرایش تنظیمات",
  BADGE_AWARD: "اعطای نشان",
  VETO_ADMIN_ADJUST: "تنظیم وتو",
};
