import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

import { toPollDTO } from "../_lib/dto";
import { settlePoll } from "../_lib/settle";

/**
 * نظرسنجی — جزئیات / ویرایش / حذف.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const poll = await db.poll.findFirst({
      where: { id, deletedAt: null },
    });
    if (!poll) {
      return NextResponse.json({ error: "نظرسنجی یافت نشد" }, { status: 404 });
    }

    const dto = await toPollDTO(poll, user.id);
    return NextResponse.json({ poll: dto });
  } catch (e) {
    return handleApiError(e);
  }
}

const PATCH_SCHEMA = z.object({
  title: z
    .string()
    .trim()
    .min(3, "عنوان نظرسنجی را وارد کنید")
    .max(140, "عنوان طولانی است")
    .optional(),
  description: z
    .string()
    .trim()
    .max(700, "توضیحات طولانی است")
    .optional(),
  closesAt: z.string().datetime({ message: "تاریخ نامعتبر است" }).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const poll = await db.poll.findFirst({ where: { id, deletedAt: null } });
    if (!poll) {
      return NextResponse.json({ error: "نظرسنجی یافت نشد" }, { status: 404 });
    }

    // فقط سازنده می‌تواند ویرایش کند؛ و فقط در حالت OPEN و بدون رأی
    if (poll.createdById !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "فقط سازنده می‌تواند ویرایش کند");
    }
    if (poll.status !== "OPEN") {
      return NextResponse.json(
        { error: "ویرایش فقط در حالت باز ممکن است" },
        { status: 400 },
      );
    }
    const voteCount = await db.pollVote.count({ where: { pollId: poll.id } });
    if (voteCount > 0) {
      return NextResponse.json(
        { error: "این نظرسنجی رأی گرفته و قابل ویرایش نیست" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PATCH_SCHEMA.parse(body);

    const data: Record<string, unknown> = {};
    if (parsed.title !== undefined) data.title = parsed.title;
    if (parsed.description !== undefined) data.description = parsed.description ?? null;
    if (parsed.closesAt !== undefined) {
      const closesAt = parsed.closesAt ? new Date(parsed.closesAt) : null;
      if (closesAt && closesAt.getTime() < Date.now()) {
        return NextResponse.json(
          { error: "مهلت نظرسنجی باید در آینده باشد" },
          { status: 400 },
        );
      }
      data.closesAt = closesAt;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "هیچ فیلدی برای ویرایش ارسال نشد" },
        { status: 400 },
      );
    }

    const updated = await db.poll.update({ where: { id }, data });
    await logAudit({
      actorId: user.id,
      action: "POLL_UPDATE",
      entityType: "Poll",
      entityId: id,
      summary: `ویرایش نظرسنجی «${updated.title}»`,
      data: parsed as unknown,
    });

    const dto = await toPollDTO(updated, user.id);
    return NextResponse.json({ poll: dto });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const poll = await db.poll.findFirst({ where: { id, deletedAt: null } });
    if (!poll) {
      return NextResponse.json({ error: "نظرسنجی یافت نشد" }, { status: 404 });
    }

    if (poll.createdById !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "فقط سازنده یا ادمین می‌تواند حذف کند");
    }

    await db.poll.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logAudit({
      actorId: user.id,
      action: "POLL_DELETE",
      entityType: "Poll",
      entityId: id,
      summary: `حذف نظرسنجی «${poll.title}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
