import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

/**
 * GET /api/comments?entityType=&entityId= — کامنت‌های غیرحذف‌شده (صعودی).
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const entityType = sp.get("entityType");
    const entityId = sp.get("entityId");
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "نوع و شناسه موجودیت الزامی است" },
        { status: 400 },
      );
    }

    const comments = await db.comment.findMany({
      where: { entityType, entityId, deletedAt: null },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: toSafeUser(c.author),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const createCommentSchema = z.object({
  entityType: z.enum(["IDEA", "POLL", "GROUP", "ANNOUNCEMENT", "DEBT"], {
    errorMap: () => ({ message: "نوع موجودیت نامعتبر است" }),
  }),
  entityId: z.string().trim().min(1, "شناسه موجودیت الزامی است"),
  body: z
    .string()
    .trim()
    .min(1, "متن نظر را وارد کنید")
    .max(1000, "متن نظر طولانی است"),
});

/**
 * POST /api/comments — هر کاربر ACTIVE (به‌جز عضو مهمان). اطلاع به صاحب موجودیت (ایده).
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMemberOrHigher();
    const body = await req.json().catch(() => ({}));
    const data = createCommentSchema.parse(body);

    // برای IDEA: وجود ایده و دسترسی کاربر را بررسی کن
    let ownerId: string | null = null;
    let ownerMessageTitle = "کامنت جدید";
    let ownerMessageBody = "";
    let ownerLink: string | null = null;
    if (data.entityType === "IDEA") {
      const idea = await db.idea.findFirst({
        where: { id: data.entityId, deletedAt: null },
        include: { author: { select: { id: true, name: true } } },
      });
      if (!idea) {
        return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
      }
      const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";
      if (idea.status === "PENDING" && idea.authorId !== user.id && !isAdmin) {
        return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
      }
      ownerId = idea.author.id !== user.id ? idea.author.id : null;
      ownerMessageTitle = "کامنت جدید روی ایده";
      ownerMessageBody = `${user.name} روی ایده «${idea.title}» شما نظر گذاشت: ${data.body.slice(0, 80)}`;
      ownerLink = `#/ideas`;
    }

    const comment = await db.comment.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        authorId: user.id,
        body: data.body,
      },
      include: { author: true },
    });

    await logAudit({
      actorId: user.id,
      action: "COMMENT_CREATE",
      entityType: data.entityType,
      entityId: data.entityId,
      summary: `کامنت جدید روی ${data.entityType} ${data.entityId.slice(0, 8)}`,
      data: { commentId: comment.id, body: data.body.slice(0, 120) },
    });

    if (ownerId) {
      await notifyUser(ownerId, {
        title: ownerMessageTitle,
        message: ownerMessageBody,
        type: data.entityType === "IDEA" ? "IDEA" : "INFO",
        link: ownerLink ?? undefined,
      });
    }

    return NextResponse.json({
      comment: {
        id: comment.id,
        body: comment.body,
        author: toSafeUser(comment.author),
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
