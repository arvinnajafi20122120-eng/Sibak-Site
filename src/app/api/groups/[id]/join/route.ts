import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";

/**
 * POST /api/groups/[id]/join
 * - OPEN → عضویت فعال فوری
 * - REQUEST → عضویت PENDING (منتظر تایید رهبر)
 * - INVITE → 403 «عضویت فقط با دعوت»
 * اعضای مهمان (GUEST) نمی‌توانند به گروه بپیوندند.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMemberOrHigher();
    const { id } = await params;

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    });
    if (existing && existing.status === "ACTIVE") {
      return NextResponse.json({ error: "شما از قبل عضو این گروه هستید" }, { status: 400 });
    }
    if (existing && existing.status === "PENDING") {
      return NextResponse.json({ error: "درخواست عضویت شما در انتظار بررسی است" }, { status: 400 });
    }

    if (group.joinPolicy === "INVITE") {
      return NextResponse.json(
        { error: "عضویت در این گروه فقط با دعوت امکان‌پذیر است" },
        { status: 403 },
      );
    }

    if (group.joinPolicy === "OPEN") {
      // عضویت فعال فوری
      if (existing) {
        await db.groupMember.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", joinedAt: new Date() },
        });
      } else {
        await db.groupMember.create({
          data: { groupId: id, userId: user.id, status: "ACTIVE" },
        });
      }
      await logAudit({
        actorId: user.id,
        action: "GROUP_JOIN",
        entityType: "GROUP",
        entityId: id,
        summary: `${user.name} به گروه «${group.name}» پیوست`,
      });
      // اطلاع به رهبر و ادمین‌ها
      const recipients = new Set<string>();
      if (group.leaderId) recipients.add(group.leaderId);
      const admins = await db.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { not: user.id } },
        select: { id: true },
      });
      admins.forEach((a) => recipients.add(a.id));
      await notifyUsers(Array.from(recipients), {
        title: "عضو جدید در گروه",
        message: `${user.name} به گروه «${group.name}» پیوست.`,
        type: "GROUP",
        link: `#/groups/${id}`,
      });
      return NextResponse.json({ status: "ACTIVE" });
    }

    // REQUEST → PENDING
    if (existing) {
      await db.groupMember.update({
        where: { id: existing.id },
        data: { status: "PENDING", joinedAt: new Date() },
      });
    } else {
      await db.groupMember.create({
        data: { groupId: id, userId: user.id, status: "PENDING" },
      });
    }
    await logAudit({
      actorId: user.id,
      action: "GROUP_JOIN_REQUEST",
      entityType: "GROUP",
      entityId: id,
      summary: `درخواست عضویت ${user.name} در گروه «${group.name}»`,
    });
    // اطلاع به رهبر و ادمین‌ها
    const recipients = new Set<string>();
    if (group.leaderId) recipients.add(group.leaderId);
    const admins = await db.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { not: user.id } },
      select: { id: true },
    });
    admins.forEach((a) => recipients.add(a.id));
    await notifyUsers(Array.from(recipients), {
      title: "درخواست عضویت جدید",
      message: `${user.name} درخواست عضویت در گروه «${group.name}» را ثبت کرد.`,
      type: "GROUP",
      link: `#/groups/${id}`,
    });
    return NextResponse.json({ status: "PENDING" });
  } catch (e) {
    return handleApiError(e);
  }
}
