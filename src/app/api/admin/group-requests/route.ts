import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import { relativeTime } from "@/lib/jalali";

import { ADMIN_SAFE_SELECT } from "../_lib/dto";

/**
 * GET /api/admin/group-requests — لیست یکپارچه‌ی همه درخواست‌های عضویت PENDING.
 * برای پنل مدیریت محتوا.
 */
export async function GET() {
  try {
    const { user } = await requireUser(["ADMIN"]);
    void user;

    const rows = await db.groupMember.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: ADMIN_SAFE_SELECT },
        group: {
          select: {
            id: true,
            name: true,
            color: true,
            leaderId: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const items = rows.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      groupName: m.group.name,
      groupColor: m.group.color,
      leaderId: m.group.leaderId,
      groupDeleted: !!m.group.deletedAt,
      user: toSafeUser(m.user as never),
      userId: m.userId,
      createdAt: m.createdAt.toISOString(),
      relative: relativeTime(m.createdAt),
    }));

    return NextResponse.json({ requests: items });
  } catch (e) {
    return handleApiError(e);
  }
}
