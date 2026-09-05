import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import { toFa } from "@/lib/jalali";

import { computeBalance } from "../../_lib/settle";

/**
 * استفاده از وتو روی نظرسنجی (NORMAL یا VETO_GRANT).
 * - کاربر باید ACTIVE و موجودی ≥ ۱ داشته باشد.
 * - نظرسنجی باید OPEN یا CLOSED باشد (نه VETOED).
 * - اثر: Poll.status=VETOED، VetoLedger {delta:-1}،
 *   اعلان به سازنده و ادمین‌ها.
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
    if (poll.status === "VETOED") {
      return NextResponse.json(
        { error: "این نظرسنجی قبلاً وتو شده است" },
        { status: 400 },
      );
    }
    if (poll.createdById === user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید روی نظرسنجی خودتان وتو بزنید" },
        { status: 400 },
      );
    }

    const balance = await computeBalance(user.id);
    if (balance < 1) {
      throw new AuthError(403, "شما وتویی برای مصرف ندارید");
    }

    const newBalance = balance - 1;
    await db.poll.update({
      where: { id },
      data: { status: "VETOED" },
    });
    await db.vetoLedger.create({
      data: {
        userId: user.id,
        delta: -1,
        reason: `وتوی نظرسنجی: ${poll.title}`,
        sourcePollId: poll.id,
        balanceAfter: newBalance,
      },
    });

    // اطلاع به سازنده و ادمین‌ها
    await notifyUser(poll.createdById, {
      title: "وتو شد",
      message: `نظرسنجی «${poll.title}» توسط ${user.name} وتو شد.`,
      type: "VETO",
      link: "#/polls",
    });
    const admins = await db.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    await notifyUsers(
      admins.map((a) => a.id),
      {
        title: "گزارش وتو",
        message: `نظرسنجی «${poll.title}» توسط ${user.name} وتو شد.`,
        type: "VETO",
        link: "#/polls",
      },
    );

    await logAudit({
      actorId: user.id,
      action: "POLL_VETO",
      entityType: "Poll",
      entityId: id,
      summary: `وتوی نظرسنجی «${poll.title}» — موجودی: ${balance} → ${newBalance}`,
      data: {
        pollId: id,
        balanceBefore: balance,
        balanceAfter: newBalance,
      },
    });

    // پاسخ شامل موجودی جدید و کاربر فعلی (برای invalidate کلاینت)
    const me = await db.user.findUnique({
      where: { id: user.id },
    });
    return NextResponse.json({
      ok: true,
      balance: newBalance,
      vetoer: me ? toSafeUser(me) : null,
      amountUsed: toFa(1),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
