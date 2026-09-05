"use client";

import type { SafeUser } from "@/lib/types";

export type DebtStatus =
  | "OPEN"
  | "SETTLE_PENDING"
  | "SETTLED"
  | "FORGIVEN"
  | "DISPUTED";

export type DebtVisibilityKind = "PUBLIC" | "RESTRICTED" | "PRIVATE";

export type DebtEventType =
  | "CREATE"
  | "SETTLE_REQUEST"
  | "SETTLE_CONFIRM"
  | "FORGIVE"
  | "REOPEN"
  | "ADJUST"
  | "COMMENT";

export interface DebtListItem {
  id: string;
  title: string;
  projectName: string | null;
  description: string | null;
  amount: number;
  status: DebtStatus;
  visibility: DebtVisibilityKind;
  dueDate: string | null;
  createdAt: string;
  settledAt: string | null;
  forgivenAt: string | null;
  debtor: SafeUser;
  creditor: SafeUser;
  createdBy: SafeUser;
  eventsCount: number;
  myRole: "debtor" | "creditor" | "observer";
  allowedUsers?: SafeUser[];
}

export interface DebtEventDTO {
  id: string;
  type: DebtEventType;
  note: string | null;
  createdAt: string;
  actor: SafeUser;
}

export interface DebtDetail extends DebtListItem {
  events: DebtEventDTO[];
  allowedUsers: SafeUser[];
}

export interface DebtStats {
  iOwe: number;
  owedToMe: number;
  netBalance: number;
  openCount: number;
  settledCount: number;
  forgivenCount: number;
}

export interface DebtChartPoint {
  month: string;
  iOwe: number;
  owedToMe: number;
  net: number;
}

export const STATUS_META: Record<
  DebtStatus,
  { label: string; chip: string; border: string; tint: string; dot: string }
> = {
  OPEN: {
    label: "باز",
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    border: "border-e-destructive/50",
    tint: "bg-destructive/5",
    dot: "bg-destructive",
  },
  SETTLE_PENDING: {
    label: "در انتظار تأیید جبران",
    chip: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
    border: "border-e-chart-2/50",
    tint: "bg-chart-2/5",
    dot: "bg-chart-2",
  },
  SETTLED: {
    label: "جبران شد",
    chip: "bg-chart-1/15 text-primary border-chart-1/40",
    border: "border-e-chart-1/50",
    tint: "bg-chart-1/5",
    dot: "bg-chart-1",
  },
  FORGIVEN: {
    label: "بخیده شد",
    chip: "bg-chart-5/15 text-chart-5 border-chart-5/40",
    border: "border-e-chart-5/50",
    tint: "bg-chart-5/5",
    dot: "bg-chart-5",
  },
  DISPUTED: {
    label: "اختلافی",
    chip: "bg-chart-4/15 text-chart-4 border-chart-4/40",
    border: "border-e-chart-4/50",
    tint: "bg-chart-4/5",
    dot: "bg-chart-4",
  },
};

export const VISIBILITY_META: Record<
  DebtVisibilityKind,
  { label: string; description: string }
> = {
  PUBLIC: {
    label: "عمومی",
    description: "برای همهٔ اعضا قابل‌مشاهده — شفافیت کامل.",
  },
  RESTRICTED: {
    label: "محدود به منتخبان",
    description: "فقط شما، طرفین و کاربرانی که انتخاب می‌کنید می‌بینند.",
  },
  PRIVATE: {
    label: "خصوصی",
    description: "فقط شما و طرفین درگیر. ادمین هم می‌بیند.",
  },
};
