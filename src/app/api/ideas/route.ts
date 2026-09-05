import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import { getStaffUserIds } from "@/app/api/_lib/content";

/**
 * GET /api/ideas?status=&groupId=&mine=1&search=&sort=new|top
 * MEMBER: status != PENDING OR author=me. ADMIN/MANAGER: همه (PENDING هایلایت).
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const groupId = sp.get("groupId");
    const mine = sp.get("mine") === "1";
    const search = sp.get("search")?.trim();
    const sort = sp.get("sort") === "top" ? "top" : "new";

    const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";

    const where: Record<string, unknown> = { deletedAt: null };
    if (groupId) where.groupId = groupId;
    if (mine) where.authorId = user.id;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (!isAdmin) {
      // ایده‌های PENDING فقط نویسنده خودش
      where.OR = [
        { status: { not: "PENDING" } },
        { authorId: user.id },
        ...(where.OR ? (where.OR as unknown[]) : []),
      ];
    }

    const ideasRaw = await db.idea.findMany({
      where: where as never,
      include: {
        author: true,
        group: { select: { id: true, name: true, color: true } },
        _count: { select: { votes: true } },
      },
      orderBy:
        sort === "top"
          ? { votes: { _count: "desc" } }
          : { createdAt: "desc" },
    });

    // myVote و commentsCount به‌صورت batch
    const ideaIds = ideasRaw.map((i) => i.id);
    const myVotes = await db.ideaVote.findMany({
      where: { ideaId: { in: ideaIds }, userId: user.id },
      select: { ideaId: true },
    });
    const myVoteSet = new Set(myVotes.map((v) => v.ideaId));

    const commentCounts = await db.comment.groupBy({
      by: ["entityId"],
      where: { entityType: "IDEA", entityId: { in: ideaIds }, deletedAt: null },
      _count: true,
    });
    const commentMap = new Map(commentCounts.map((c) => [c.entityId, c._count]));

    const ideas = ideasRaw.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      author: toSafeUser(i.author),
      group: i.group
        ? { id: i.group.id, name: i.group.name, color: i.group.color }
        : null,
      groupId: i.groupId,
      votesCount: i._count.votes,
      commentsCount: commentMap.get(i.id) ?? 0,
      myVote: myVoteSet.has(i.id),
      createdAt: i.createdAt.toISOString(),
    }));

    return NextResponse.json({ ideas });
  } catch (e) {
    return handleApiError(e);
  }
}

const createIdeaSchema = z.object({
  title: z.string().trim().min(3, "عنوان ایده را وارد کنید").max(120, "عنوان ایده طولانی است"),
  description: z
    .string()
    .trim()
    .min(8, "توضیحات ایده را کامل کنید")
    .max(2000, "توضیحات ایده طولانی است"),
  groupId: z.string().trim().optional().nullable(),
});

/**
 * POST /api/ideas — هر کاربر ACTIVE (به‌جز عضو مهمان). وضعیت PENDING. اعلان به ادمین/مدیر.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMemberOrHigher();
    const body = await req.json().catch(() => ({}));
    const data = createIdeaSchema.parse(body);

    let groupId: string | null = null;
    if (data.groupId) {
      const g = await db.group.findFirst({
        where: { id: data.groupId, deletedAt: null },
        select: { id: true },
      });
      if (!g) {
        return NextResponse.json({ error: "گروه انتخاب‌شده یافت نشد" }, { status: 404 });
      }
      groupId = g.id;
    }

    const idea = await db.idea.create({
      data: {
        title: data.title,
        description: data.description,
        status: "PENDING",
        authorId: user.id,
        groupId,
      },
      include: { author: true, group: { select: { id: true, name: true, color: true } } },
    });

    await logAudit({
      actorId: user.id,
      action: "IDEA_CREATE",
      entityType: "IDEA",
      entityId: idea.id,
      summary: `ایده «${idea.title}» ثبت شد`,
      data: { title: idea.title, groupId },
    });

    // اطلاع به همه ادمین/مدیرها
    const staffIds = await getStaffUserIds();
    await notifyUsers(
      staffIds.filter((sid) => sid !== user.id),
      {
        title: "ایده جدید در انتظار بررسی",
        message: `ایده جدید «${idea.title}» توسط ${user.name} ثبت شد و منتظر بررسی است.`,
        type: "IDEA",
        link: `#/ideas`,
      },
    );

    return NextResponse.json({
      idea: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        status: idea.status,
        author: toSafeUser(idea.author),
        group: idea.group,
        groupId: idea.groupId,
        votesCount: 0,
        commentsCount: 0,
        myVote: false,
        createdAt: idea.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
