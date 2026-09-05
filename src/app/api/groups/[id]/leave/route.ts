import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

/**
 * POST /api/groups/[id]/leave — خروج خودکار عضویت (hard-delete رکورد OK).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    // رهبر نمی‌تواند گروه را ترک کند (مگر ادمین رهبری را منتقل کند)
    if (group.leaderId === user.id) {
      return NextResponse.json(
        { error: "رهبر گروه نمی‌تواند آن را ترک کند؛ ابتدا رهبری را منتقل کنید" },
        { status: 400 },
      );
    }

    await db.groupMember.deleteMany({
      where: { groupId: id, userId: user.id },
    });

    await logAudit({
      actorId: user.id,
      action: "GROUP_LEAVE",
      entityType: "GROUP",
      entityId: id,
      summary: `${user.name} از گروه «${group.name}» خارج شد`,
    });

    if (group.leaderId) {
      await notifyUser(group.leaderId, {
        title: "خروج عضو",
        message: `${user.name} از گروه «${group.name}» خارج شد.`,
        type: "GROUP",
        link: `#/groups/${id}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
