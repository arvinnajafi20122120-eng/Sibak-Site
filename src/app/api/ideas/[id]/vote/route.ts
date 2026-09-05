import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher } from "@/lib/auth";

/**
 * POST /api/ideas/[id]/vote — toggle my vote (ثبت/حذف). بدون audit (سبک).
 * اعضای مهمان (GUEST) اجازه رأی‌دهی ندارند.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMemberOrHigher();
    const { id } = await params;

    const idea = await db.idea.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!idea) {
      return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
    }

    const existing = await db.ideaVote.findUnique({
      where: { ideaId_userId: { ideaId: id, userId: user.id } },
    });
    if (existing) {
      await db.ideaVote.delete({ where: { id: existing.id } });
      const count = await db.ideaVote.count({ where: { ideaId: id } });
      return NextResponse.json({ myVote: false, votesCount: count });
    }

    await db.ideaVote.create({
      data: { ideaId: id, userId: user.id, value: 1 },
    });
    const count = await db.ideaVote.count({ where: { ideaId: id } });
    return NextResponse.json({ myVote: true, votesCount: count });
  } catch (e) {
    return handleApiError(e);
  }
}
