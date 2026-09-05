import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

/**
 * GET /api/groups/[id]/members/eligible?q=...
 * کاربران فعالی که می‌توان به گروه دعوت کرد (یعنی ACTIVE و عضو فعالی نیستند).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    const group = await db.group.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, leaderId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    // اعضای فعلی گروه
    const existing = await db.groupMember.findMany({
      where: { groupId: id, status: "ACTIVE" },
      select: { userId: true },
    });
    const excludeIds = new Set(existing.map((m) => m.userId));
    excludeIds.add(user.id);

    const where: Record<string, unknown> = {
      status: "ACTIVE",
      deletedAt: null,
      id: { notIn: Array.from(excludeIds) },
    };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
      ];
    }

    const users = await db.user.findMany({
      where: where as never,
      take: 20,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users: users.map(toSafeUser) });
  } catch (e) {
    return handleApiError(e);
  }
}
