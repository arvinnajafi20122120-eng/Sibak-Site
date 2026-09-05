import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toSafeUser } from "@/lib/types";

const updateEventSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z
    .enum(["GENERAL", "EXAM", "HOMEWORK", "MEETING", "HOLIDAY", "PROJECT"])
    .optional(),
  date: z.string().optional(),
  endDate: z.string().optional().nullable(),
  time: z.string().optional(),
  groupId: z.string().trim().nullable().optional(),
});

/**
 * PATCH /api/events/[id] — سازنده یا ADMIN.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = updateEventSchema.parse(body);

    const event = await db.calendarEvent.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true, createdById: true },
    });
    if (!event) {
      return NextResponse.json({ error: "رویداد یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (event.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "شما اجازه ویرایش این رویداد را ندارید" },
        { status: 403 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.date !== undefined) {
      const d = new Date(data.date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "تاریخ نامعتبر است" }, { status: 400 });
      }
      if (data.time && /^\d{2}:\d{2}$/.test(data.time)) {
        const [hh, mm] = data.time.split(":").map(Number);
        d.setHours(hh, mm, 0, 0);
      }
      updateData.date = d;
    } else if (data.time && /^\d{2}:\d{2}$/.test(data.time)) {
      const base = new Date(); // چون date را نداریم، فقط time را روی تاریخ فعلی می‌گذاریم
      const [hh, mm] = data.time.split(":").map(Number);
      base.setHours(hh, mm, 0, 0);
    }
    if (data.endDate !== undefined) {
      if (data.endDate === null) {
        updateData.endDate = null;
      } else {
        const ed = new Date(data.endDate);
        if (!isNaN(ed.getTime())) {
          updateData.endDate = ed;
        }
      }
    }
    if (data.groupId !== undefined) {
      if (data.groupId === null) {
        updateData.groupId = null;
      } else {
        const g = await db.group.findFirst({
          where: { id: data.groupId, deletedAt: null },
          select: { id: true },
        });
        if (!g) {
          return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
        }
        updateData.groupId = data.groupId;
      }
    }

    const updated = await db.calendarEvent.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: true,
        group: { select: { id: true, name: true, color: true } },
      },
    });

    await logAudit({
      actorId: user.id,
      action: "EVENT_UPDATE",
      entityType: "EVENT",
      entityId: id,
      summary: `رویداد «${updated.title}» ویرایش شد`,
      data: { fields: Object.keys(updateData) },
    });

    return NextResponse.json({
      event: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        type: updated.type,
        date: updated.date.toISOString(),
        endDate: updated.endDate ? updated.endDate.toISOString() : null,
        groupId: updated.groupId,
        group: updated.group,
        createdBy: toSafeUser(updated.createdBy),
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/events/[id] — سازنده یا ADMIN (soft).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const event = await db.calendarEvent.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true, createdById: true },
    });
    if (!event) {
      return NextResponse.json({ error: "رویداد یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (event.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "شما اجازه حذف این رویداد را ندارید" },
        { status: 403 },
      );
    }

    await db.calendarEvent.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: user.id,
      action: "EVENT_DELETE",
      entityType: "EVENT",
      entityId: id,
      summary: `رویداد «${event.title}» حذف شد`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
