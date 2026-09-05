import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * DELETE /api/comments/[id] — نویسنده یا ADMIN (soft).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const comment = await db.comment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, body: true, entityType: true, entityId: true },
    });
    if (!comment) {
      return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (comment.authorId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "شما اجازه حذف این نظر را ندارید" },
        { status: 403 },
      );
    }

    await db.comment.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: user.id,
      action: "COMMENT_DELETE",
      entityType: comment.entityType,
      entityId: comment.entityId,
      summary: `کامنت حذف شد`,
      data: { commentId: id, byAdmin: isAdmin },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
