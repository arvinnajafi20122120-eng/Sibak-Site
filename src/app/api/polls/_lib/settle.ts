/**
 * ابزار مشترک نظرسنجی‌های سیبک — تسویه (settle) در زمان بسته‌شدن.
 * این فایل فقط سمت سرور است و توسط routeهای polls/* و vetoes/* مصرف می‌شود.
 */
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toFa } from "@/lib/jalali";

export interface SettleablePoll {
  id: string;
  title: string;
  type: string; // NORMAL | VETO_GRANT
  status: string; // OPEN | CLOSED | VETOED
  targetUserId: string | null;
  vetoAmount: number | null;
  createdById: string;
}

/**
 * موجودی وتوی کاربر = مجموع دلتاهای VetoLedger او.
 * هرگز روی فیلد ذخیره‌شده اتکا نکنیم — همیشه روی‌هو محاسبه می‌شود.
 */
export async function computeBalance(userId: string): Promise<number> {
  const result = await db.vetoLedger.aggregate({
    _sum: { delta: true },
    where: { userId },
  });
  return result._sum.delta ?? 0;
}

/**
 * تشخیص گزینه «بله» در نظرسنجی VETO_GRANT.
 * طبق قرارداد seed و createPoll، متن گزینه بله با «بله» شروع می‌شود؛
 * در غیر این صورت نخستین گزینه را به‌عنوان بله در نظر می‌گیریم.
 */
function pickYesOption(options: { id: string; text: string }[]): {
  yes: { id: string; text: string } | null;
  no: { id: string; text: string } | null;
} {
  if (options.length === 0) return { yes: null, no: null };
  const yes = options.find((o) => o.text.trim().startsWith("بله")) ?? options[0];
  const no = options.find((o) => o.id !== yes.id) ?? null;
  return { yes, no };
}

/**
 * تسویه نظرسنجی پس از بسته‌شدن (دستی یا خودکار).
 * فرض: Poll.status پیش از فراخوانی به CLOSED به‌روزرسانی شده است.
 *
 * - VETO_GRANT: اگر بله‌ها > نه‌ها → اعطای وتو (VetoLedger delta=+vetoAmount)
 *   و اعلان به کاربر هدف و ممیزی. در غیر این صورت اعلان «نتیجه‌ای نداشت».
 * - NORMAL: فقط اعلان «پایان یافت» به سازنده.
 */
export async function settlePoll(
  poll: SettleablePoll,
): Promise<{ granted: boolean }> {
  if (poll.type === "VETO_GRANT") {
    const options = await db.pollOption.findMany({
      where: { pollId: poll.id },
      select: { id: true, text: true },
    });
    const { yes, no } = pickYesOption(options);
    if (!yes) return { granted: false };

    const yesVotes = await db.pollVote.count({ where: { optionId: yes.id } });
    const noVotes = no
      ? await db.pollVote.count({ where: { optionId: no.id } })
      : 0;

    if (
      yesVotes > noVotes &&
      poll.targetUserId &&
      poll.vetoAmount &&
      poll.vetoAmount > 0
    ) {
      const currentBalance = await computeBalance(poll.targetUserId);
      const newBalance = currentBalance + poll.vetoAmount;
      await db.vetoLedger.create({
        data: {
          userId: poll.targetUserId,
          delta: poll.vetoAmount,
          reason: `اعطای وتو از نظرسنجی: ${poll.title}`,
          sourcePollId: poll.id,
          balanceAfter: newBalance,
        },
      });
      await notifyUser(poll.targetUserId, {
        title: "اعطای وتو",
        message: `🎉 شما ${toFa(poll.vetoAmount)} وتو دریافت کردید: ${poll.title}`,
        type: "VETO",
        link: "#/vetoes",
      });
      await logAudit({
        actorId: poll.createdById,
        action: "VETO_GRANT",
        entityType: "Poll",
        entityId: poll.id,
        summary: `اعطای ${poll.vetoAmount} وتو به‌پاس نظرسنجی «${poll.title}»`,
        data: {
          pollId: poll.id,
          targetUserId: poll.targetUserId,
          amount: poll.vetoAmount,
          yesVotes,
          noVotes,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
        },
      });
      return { granted: true };
    }

    if (poll.targetUserId) {
      await notifyUser(poll.targetUserId, {
        title: "نتیجه نظرسنجی اعطای وتو",
        message: `نظرسنجی وتو برای شما نتیجه‌ای نداشت: ${poll.title}`,
        type: "VETO",
        link: "#/polls",
      });
    }
    return { granted: false };
  }

  // NORMAL
  await notifyUser(poll.createdById, {
    title: "پایان نظرسنجی",
    message: `نظرسنجی شما پایان یافت: ${poll.title}`,
    type: "POLL",
    link: "#/polls",
  });
  return { granted: false };
}

/**
 * بستن خودکار نظرسنجی‌های OPEN با closesAt گذشته.
 * در ابتدای GET /api/polls فراخوانی می‌شود. اگر تعدادی بسته شدند،
 * تسویه نیز روی هرکدام اعمال می‌گردد.
 */
export async function autoCloseExpiredPolls(): Promise<void> {
  const expired = await db.poll.findMany({
    where: {
      status: "OPEN",
      deletedAt: null,
      closesAt: { lt: new Date() },
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      targetUserId: true,
      vetoAmount: true,
      createdById: true,
    },
  });
  if (!expired.length) return;

  for (const poll of expired) {
    try {
      await db.poll.update({
        where: { id: poll.id },
        data: { status: "CLOSED" },
      });
      await settlePoll(poll);
      await logAudit({
        actorId: null,
        action: "POLL_AUTO_CLOSE",
        entityType: "Poll",
        entityId: poll.id,
        summary: `بسته‌شدن خودکار نظرسنجی «${poll.title}» (پایان مهلت)`,
      });
    } catch (e) {
      console.error("[auto-close-poll] خطا:", e);
    }
  }
}
