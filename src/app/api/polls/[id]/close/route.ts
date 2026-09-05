import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

import { settlePoll } from "../../_lib/settle";
import { toPollDTO } from "../../_lib/dto";

/**
 * بستن دستی نظرسنجی — توسط سازنده یا ادمین/مدیر.
 * پس از بستن، تسویه (settlePoll) اجرا می‌شود.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const poll = await db.poll.findFirst({ where: { id, deletedAt: null } });
    if (!poll) {
      return NextResponse.json({ error: "نظرسنجی یافت نشد" }, { status: 404 });
    }
    if (poll.status !== "OPEN") {
      return NextResponse.json(
        { error: "این نظرسنجی قبلاً بسته شده است" },
        { status: 400 },
      );
    }
    const canClose =
      poll.createdById === user.id ||
      user.role === "ADMIN" ||
      user.role === "MANAGER";
    if (!canClose) {
      throw new AuthError(403, "بستن نظرسنجی برای شما مجاز نیست");
    }

    const updated = await db.poll.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    await settlePoll({
      id: updated.id,
      title: updated.title,
      type: updated.type,
      status: updated.status,
      targetUserId: updated.targetUserId,
      vetoAmount: updated.vetoAmount,
      createdById: updated.createdById,
    });
    await logAudit({
      actorId: user.id,
      action: "POLL_CLOSE",
      entityType: "Poll",
      entityId: id,
      summary: `بستن دستی نظرسنجی «${poll.title}»`,
    });

    const dto = await toPollDTO(updated, user.id);
    return NextResponse.json({ poll: dto });
  } catch (e) {
    return handleApiError(e);
  }
}
