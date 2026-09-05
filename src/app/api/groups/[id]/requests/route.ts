import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const requestActionSchema = z.object({
  userId: z.string().trim().min(1, "شناسه کاربر الزامی است"),
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "اقدام باید تایید یا رد باشد" }),
  }),
});

/**
 * POST /api/groups/[id]/requests — رهبر/ADMIN تایید یا رد درخواست عضویت PENDING.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { userId, action } = requestActionSchema.parse(body);

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (group.leaderId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "فقط رهبر گروه یا ادمین می‌تواند درخواست‌ها را بررسی کند" },
        { status: 403 },
      );
    }

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
      include: { user: true },
    });
    if (!membership || membership.status !== "PENDING") {
      return NextResponse.json(
        { error: "درخواست عضویت PENDING یافت نشد" },
        { status: 404 },
      );
    }

    if (action === "approve") {
      await db.groupMember.update({
        where: { id: membership.id },
        data: { status: "ACTIVE", joinedAt: new Date() },
      });
      await logAudit({
        actorId: user.id,
        action: "GROUP_MEMBER_APPROVE",
        entityType: "GROUP",
        entityId: id,
        summary: `عضویت ${membership.user.name} در گروه «${group.name}» تایید شد`,
      });
      await notifyUser(userId, {
        title: "عضویت شما تایید شد",
        message: `عضویت شما در گروه «${group.name}» تایید شد. خوش آمدید!`,
        type: "GROUP",
        link: `#/groups/${id}`,
      });
      return NextResponse.json({ status: "ACTIVE" });
    }

    // reject → رکورد را حذف می‌کنیم تا دوباره بتواند درخواست بدهد
    await db.groupMember.delete({ where: { id: membership.id } });
    await logAudit({
      actorId: user.id,
      action: "GROUP_MEMBER_REJECT",
      entityType: "GROUP",
      entityId: id,
      summary: `درخواست عضویت ${membership.user.name} در گروه «${group.name}» رد شد`,
    });
    await notifyUser(userId, {
      title: "درخواست عضویت رد شد",
      message: `متأسفانه درخواست شما برای عضویت در گروه «${group.name}» تایید نشد.`,
      type: "GROUP",
      link: `#/groups`,
    });
    return NextResponse.json({ status: "REJECTED" });
  } catch (e) {
    return handleApiError(e);
  }
}
