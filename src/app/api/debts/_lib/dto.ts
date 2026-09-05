import { db } from "@/lib/db";
import { toSafeUser } from "@/lib/types";
import type { Debt, DebtEvent, DebtVisibility, User } from "@prisma/client";

/**
 * تبدیل رکورد بدهی به DTO امن برای کلاینت.
 * شامل debtor/creditor safe، تعداد events، نقش من روی بدهی.
 */

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

const SAFE_SELECT = {
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
  lastLoginAt: true,
  createdAt: true,
} as const;

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
  debtor: ReturnType<typeof toSafeUser>;
  creditor: ReturnType<typeof toSafeUser>;
  createdBy: ReturnType<typeof toSafeUser>;
  eventsCount: number;
  myRole: "debtor" | "creditor" | "observer";
  allowedUsers?: ReturnType<typeof toSafeUser>[];
}

export interface DebtEventDTO {
  id: string;
  type: DebtEventType;
  note: string | null;
  createdAt: string;
  actor: ReturnType<typeof toSafeUser>;
}

export interface DebtDetail extends DebtListItem {
  events: DebtEventDTO[];
  allowedUsers: ReturnType<typeof toSafeUser>[];
}

/** ساخت DTO لیست/کارت از روی رکورد Debt. */
export async function toDebtListItem(
  debt: Debt & {
    debtor: User;
    creditor: User;
    createdBy: User;
    _count?: { events?: number };
    events?: { id: string }[];
    allowedUsers?: (DebtVisibility & { user: User })[];
  },
  viewerId: string,
): Promise<DebtListItem> {
  const eventsCount = debt._count?.events ?? debt.events?.length ?? 0;
  let myRole: "debtor" | "creditor" | "observer" = "observer";
  if (debt.debtorId === viewerId) myRole = "debtor";
  else if (debt.creditorId === viewerId) myRole = "creditor";

  const item: DebtListItem = {
    id: debt.id,
    title: debt.title,
    projectName: debt.projectName,
    description: debt.description,
    amount: debt.amount,
    status: debt.status as DebtStatus,
    visibility: debt.visibility as DebtVisibilityKind,
    dueDate: debt.dueDate ? debt.dueDate.toISOString() : null,
    createdAt: debt.createdAt.toISOString(),
    settledAt: debt.settledAt ? debt.settledAt.toISOString() : null,
    forgivenAt: debt.forgivenAt ? debt.forgivenAt.toISOString() : null,
    debtor: toSafeUser(debt.debtor),
    creditor: toSafeUser(debt.creditor),
    createdBy: toSafeUser(debt.createdBy),
    eventsCount,
    myRole,
  };

  if (debt.allowedUsers && debt.allowedUsers.length > 0 && "user" in debt.allowedUsers[0]!) {
    item.allowedUsers = debt.allowedUsers.map((av) => toSafeUser(av.user));
  }
  return item;
}

/** ساخت DTO کامل با تایم‌لاین events + allowedUsers. */
export async function toDebtDetail(
  debtId: string,
  viewerId: string,
): Promise<DebtDetail | null> {
  const debt = await db.debt.findUnique({
    where: { id: debtId },
    include: {
      debtor: { select: SAFE_SELECT },
      creditor: { select: SAFE_SELECT },
      createdBy: { select: SAFE_SELECT },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: SAFE_SELECT } },
      },
      allowedUsers: { include: { user: { select: SAFE_SELECT } } },
    },
  });
  if (!debt || debt.deletedAt) return null;

  const base = await toDebtListItem(
    {
      ...debt,
      debtor: debt.debtor as unknown as User,
      creditor: debt.creditor as unknown as User,
      createdBy: debt.createdBy as unknown as User,
      _count: { events: debt.events.length },
      allowedUsers: debt.allowedUsers,
    },
    viewerId,
  );

  const events: DebtEventDTO[] = debt.events.map((e) => ({
    id: e.id,
    type: e.type as DebtEventType,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    actor: toSafeUser(e.actor as unknown as User),
  }));

  return {
    ...base,
    events,
    allowedUsers: debt.allowedUsers.map((av) => toSafeUser(av.user as unknown as User)),
  };
}

export { SAFE_SELECT };
