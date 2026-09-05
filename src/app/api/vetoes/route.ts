import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

import { computeBalance } from "../polls/_lib/settle";

/**
 * دفتر وتوها — مشاهده موجودی، تاریخچه، نظرسنجی‌های وتو‌شده و
 * فرصت‌های کسب وتو (نظرسنجی‌های VETO_GRANT باز).
 */

export async function GET(_req: NextRequest) {
  try {
    const { user } = await requireUser();

    const balance = await computeBalance(user.id);

    // ۱) تاریخچه دفتر من (همه ورودی‌ها به‌ترتیب جدید به قدیم)
    const ledger = await db.vetoLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const ledgerWithPoll = await Promise.all(
      ledger.map(async (entry) => {
        const sourcePoll = entry.sourcePollId
          ? await db.poll.findUnique({
              where: { id: entry.sourcePollId },
              select: { id: true, title: true, type: true, status: true },
            })
          : null;
        return {
          id: entry.id,
          delta: entry.delta,
          reason: entry.reason,
          balanceAfter: entry.balanceAfter,
          createdAt: entry.createdAt.toISOString(),
          sourcePoll: sourcePoll
            ? {
                id: sourcePoll.id,
                title: sourcePoll.title,
                type: sourcePoll.type,
                status: sourcePoll.status,
              }
            : null,
        };
      }),
    );

    // ۲) همه نظرسنجی‌های وتو‌شده (توسط هرکس) — برای نمایش همگانی
    const vetoedPolls = await db.poll.findMany({
      where: { status: "VETOED", deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    const vetoedWithVetoer = await Promise.all(
      vetoedPolls.map(async (p) => {
        const vetoEntry = await db.vetoLedger.findFirst({
          where: { sourcePollId: p.id, delta: { lt: 0 } },
          include: { user: true },
        });
        const creator = await db.user.findUnique({
          where: { id: p.createdById },
        });
        return {
          id: p.id,
          title: p.title,
          type: p.type,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          createdBy: creator ? toSafeUser(creator) : null,
          vetoer: vetoEntry ? toSafeUser(vetoEntry.user) : null,
          reason: vetoEntry?.reason ?? "",
        };
      }),
    );

    // ۳) فرصت‌های کسب وتو — نظرسنجی‌های VETO_GRANT باز
    const grantPolls = await db.poll.findMany({
      where: { type: "VETO_GRANT", status: "OPEN", deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const grantPollsDTO = await Promise.all(
      grantPolls.map(async (p) => {
        const target = p.targetUserId
          ? await db.user.findUnique({ where: { id: p.targetUserId } })
          : null;
        const options = await db.pollOption.findMany({
          where: { pollId: p.id },
          select: {
            id: true,
            text: true,
            _count: { select: { votes: true } },
          },
        });
        const yesOption =
          options.find((o) => o.text.trim().startsWith("بله")) ?? options[0];
        const noOption = options.find((o) => o.id !== yesOption?.id);
        return {
          id: p.id,
          title: p.title,
          type: p.type,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          closesAt: p.closesAt ? p.closesAt.toISOString() : null,
          targetUser: target ? toSafeUser(target) : null,
          vetoAmount: p.vetoAmount,
          yesVotes: yesOption?._count.votes ?? 0,
          noVotes: noOption?._count.votes ?? 0,
        };
      }),
    );

    return NextResponse.json({
      balance,
      ledger: ledgerWithPoll,
      vetoedPolls: vetoedWithVetoer,
      grantPolls: grantPollsDTO,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
