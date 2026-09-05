import type { User, Debt, DebtVisibility } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * قوانین دید یک بدهکاری مودبانه در سیبک:
 * - ADMIN همیشه می‌بیند.
 * - بدهکار یا طلبکار همیشه می‌بیند.
 * - visibility=PUBLIC → همه اعضای فعال.
 * - visibility=RESTRICTED → فقط کاربرانی که در DebtVisibility آن بدهی هستند.
 * - visibility=PRIVATE → فقط درگیرها + ادمین.
 * - MANAGER فقط PUBLIC بدهی‌های دیگران را می‌بیند؛ مگر خودش درگیر باشد.
 */

export type DebtWithRelations = Pick<
  Debt,
  "id" | "debtorId" | "creditorId" | "visibility"
> & { allowedUsers?: DebtVisibility[] };

/**
 * بررسی دید یک کاربر روی یک بدهی.
 * اگر debt.allowedUsers از قبل include شده باشد، از همان استفاده می‌کنیم؛
 * در غیر این صورت از db کوئری می‌گیریم.
 */
export async function canSeeDebt(
  user: Pick<User, "id" | "role" | "status">,
  debt: DebtWithRelations,
  prisma: typeof db = db,
): Promise<boolean> {
  // کاربر درگیر
  if (debt.debtorId === user.id || debt.creditorId === user.id) return true;
  // ادمین همه‌چیز را می‌بیند
  if (user.role === "ADMIN") return true;

  // کاربر فعال نیست (PENDING/SUSPENDED/REJECTED) — جز درگیرها یا ادمین، هیچی
  if (user.status !== "ACTIVE") return false;

  if (debt.visibility === "PUBLIC") {
    // MANAGER و MEMBER هردو PUBLIC را می‌بینند
    return true;
  }

  if (debt.visibility === "RESTRICTED") {
    let allowed = debt.allowedUsers;
    if (!allowed) {
      allowed = await prisma.debtVisibility.findMany({
        where: { debtId: debt.id },
        select: { userId: true },
      });
    }
    return allowed.some((u) => u.userId === user.id);
  }

  // PRIVATE — فقط درگیرها و ادمین (که قبل‌تر چک شد)
  return false;
}

/** نسخهٔ از پیش‌محاسبه‌شده: وقتی allowedUserIds را به‌صورت Set داریم. */
export function canSeeDebtFast(
  user: Pick<User, "id" | "role" | "status">,
  debt: DebtWithRelations,
  allowedUserIds: Set<string>,
): boolean {
  if (debt.debtorId === user.id || debt.creditorId === user.id) return true;
  if (user.role === "ADMIN") return true;
  if (user.status !== "ACTIVE") return false;
  if (debt.visibility === "PUBLIC") return true;
  if (debt.visibility === "RESTRICTED") return allowedUserIds.has(user.id);
  return false; // PRIVATE
}
