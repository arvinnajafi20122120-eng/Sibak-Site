import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const addMemberSchema = z.object({
  userId: z.string().trim().min(1, "کاربر را انتخاب کنید"),
});

/**
 * POST /api/groups/[id]/members — رهبر/ADMIN افزودن مستقیم عضو (INVITE یا افزودن سریع).
 * اعضای تکراری در حالت ACTIVE: ok ؛ در حالت PENDING → ارتقا به ACTIVE.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { userId } = addMemberSchema.parse(body);

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (group.leaderId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "فقط رهبر گروه یا ادمین می‌تواند عضو اضافه کند" },
        { status: 403 },
      );
    }

    const target = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "کاربر هنوز تایید نشده است" },
        { status: 400 },
      );
    }

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (existing && existing.status === "ACTIVE") {
      return NextResponse.json({ error: "این کاربر از قبل عضو گروه است" }, { status: 400 });
    }

    if (existing) {
      await db.groupMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", joinedAt: new Date() },
      });
    } else {
      await db.groupMember.create({
        data: { groupId: id, userId, status: "ACTIVE" },
      });
    }

    await logAudit({
      actorId: user.id,
      action: "GROUP_MEMBER_ADD",
      entityType: "GROUP",
      entityId: id,
      summary: `${target.name} به گروه «${group.name}» دعوت/افزوده شد`,
    });

    await notifyUser(userId, {
      title: "دعوت به گروه",
      message: `شما به گروه «${group.name}» دعوت شدید و عضو شدید.`,
      type: "GROUP",
      link: `#/groups/${id}`,
    });

    return NextResponse.json({ status: "ACTIVE" });
  } catch (e) {
    return handleApiError(e);
  }
}
