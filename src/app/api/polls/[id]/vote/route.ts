import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * رأی‌دادن در نظرسنجی — فقط در حالت OPEN.
 * یک کاربر فقط یک رأی دارد؛ در صورت وجود، انتخابش عوض می‌شود.
 * اعضای مهمان (GUEST) اجازه رأی‌دهی ندارند.
 */

const VOTE_SCHEMA = z.object({
  optionId: z.string().min(1, "گزینه رأی را انتخاب کنید"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMemberOrHigher();
    const { id } = await params;

    const poll = await db.poll.findFirst({ where: { id, deletedAt: null } });
    if (!poll) {
      return NextResponse.json({ error: "نظرسنجی یافت نشد" }, { status: 404 });
    }
    if (poll.status !== "OPEN") {
      return NextResponse.json(
        { error: "این نظرسنجی بسته شده و رأی‌دادن ممکن نیست" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { optionId } = VOTE_SCHEMA.parse(body);

    const option = await db.pollOption.findUnique({
      where: { id: optionId },
    });
    if (!option || option.pollId !== poll.id) {
      return NextResponse.json(
        { error: "گزینه رأی به این نظرسنجی تعلق ندارد" },
        { status: 400 },
      );
    }

    // یک کاربر فقط یک رأی دارد — به‌روزرسانی یا ساخت
    const existing = await db.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: user.id } },
    });
    if (existing) {
      if (existing.optionId === optionId) {
        return NextResponse.json({ ok: true, unchanged: true });
      }
      await db.pollVote.update({
        where: { id: existing.id },
        data: { optionId },
      });
      await logAudit({
        actorId: user.id,
        action: "POLL_VOTE_CHANGE",
        entityType: "Poll",
        entityId: poll.id,
        summary: `تغییر رأی در نظرسنجی «${poll.title}»`,
        data: { fromOptionId: existing.optionId, toOptionId: optionId },
      });
    } else {
      await db.pollVote.create({
        data: { pollId: poll.id, optionId, userId: user.id },
      });
      await logAudit({
        actorId: user.id,
        action: "POLL_VOTE",
        entityType: "Poll",
        entityId: poll.id,
        summary: `رأی در نظرسنجی «${poll.title}»`,
        data: { optionId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
