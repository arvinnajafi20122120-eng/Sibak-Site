import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

import { ADMIN_FULL_SELECT, toAdminSafeUser } from "../_lib/dto";

/**
 * GET /api/admin/users?q=&status=&role=&deleted=1
 * لیست همه کاربران (شامل حذف‌شده‌ها در صورت deleted=1) با آمار سریع.
 * فقط ADMIN.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    void user;

    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const status = sp.get("status");
    const role = sp.get("role");
    const includeDeleted = sp.get("deleted") === "1";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
      ];
    }
    if (!includeDeleted) where.deletedAt = null;

    const usersRaw = await db.user.findMany({
      where: where as never,
      select: ADMIN_FULL_SELECT,
      orderBy: { createdAt: "desc" },
    });

    const ids = usersRaw.map((u) => u.id);
    const [ideaCounts, pollCounts, debtCounts, ideaDeletedCounts] =
      await Promise.all([
        db.idea.groupBy({
          by: ["authorId"],
          where: { authorId: { in: ids }, deletedAt: null },
          _count: true,
        }),
        db.poll.groupBy({
          by: ["createdById"],
          where: { createdById: { in: ids }, deletedAt: null },
          _count: true,
        }),
        db.debt.groupBy({
          by: ["debtorId"],
          where: {
            OR: [{ debtorId: { in: ids } }, { creditorId: { in: ids } }],
            deletedAt: null,
          },
          _count: true,
        }),
        db.idea.groupBy({
          by: ["authorId"],
          where: { authorId: { in: ids }, NOT: { deletedAt: null } },
          _count: true,
        }),
      ]);
    const ideaMap = new Map(ideaCounts.map((r) => [r.authorId, r._count]));
    const pollMap = new Map(pollCounts.map((r) => [r.createdById, r._count]));
    // debt groupBy روی debtorId است؛ برای اختصاص نهایی، بدهکار یا طلبکار هر کسی یک رکورد دارد
    const debtMap = new Map(debtCounts.map((r) => [r.debtorId, r._count]));
    const ideaDeletedMap = new Map(
      ideaDeletedCounts.map((r) => [r.authorId, r._count]),
    );

    const users = usersRaw.map((u) => {
      const safe = toAdminSafeUser(u as never);
      return {
        ...safe,
        ideasCount: ideaMap.get(u.id) ?? 0,
        ideasDeletedCount: ideaDeletedMap.get(u.id) ?? 0,
        pollsCount: pollMap.get(u.id) ?? 0,
        debtsCount: debtMap.get(u.id) ?? 0,
      };
    });

    return NextResponse.json({ users });
  } catch (e) {
    return handleApiError(e);
  }
}
