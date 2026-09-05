import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const removeMemberSchema = z.object({
  userId: z.string().trim().min(1, "کاربر را مشخص کنید"),
});

/**
 * POST /api/groups/[id]/members/remove — رهبر/ADMIN حذف عضو.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { userId } = removeMemberSchema.parse(body);

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (group.leaderId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "فقط رهبر گروه یا ادمین می‌تواند عضو را حذف کند" },
        { status: 403 },
      );
    }

    if (group.leaderId === userId) {
      return NextResponse.json(
        { error: "رهبر گروه را نمی‌توان حذف کرد؛ ابتدا رهبری را منتقل کنید" },
        { status: 400 },
      );
    }

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
      include: { user: { select: { name: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "عضویت یافت نشد" }, { status: 404 });
    }

    await db.groupMember.delete({ where: { id: membership.id } });

    await logAudit({
      actorId: user.id,
      action: "GROUP_MEMBER_REMOVE",
      entityType: "GROUP",
      entityId: id,
      summary: `${membership.user.name} از گروه «${group.name}» حذف شد`,
    });

    await notifyUser(userId, {
      title: "حذف از گروه",
      message: `شما از گروه «${group.name}» حذف شدید.`,
      type: "GROUP",
      link: `#/groups`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
