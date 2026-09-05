import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import { getActiveGroupMemberIds } from "@/app/api/_lib/content";

/**
 * GET /api/events?from=&to=&groupId=&upcoming=1
 * - رویدادهای هم‌پوشان با بازه (date بین from/to یا endDate در بازه).
 * - upcoming=1 → ۷ روز آینده را در فیلد upcoming برمی‌گرداند.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const groupId = sp.get("groupId");
    const upcoming = sp.get("upcoming") === "1";

    const where: Record<string, unknown> = { deletedAt: null };
    if (groupId) where.groupId = groupId;

    let from: Date | null = null;
    let to: Date | null = null;
    if (fromStr) from = new Date(fromStr);
    if (toStr) to = new Date(toStr);
    if (from && to) {
      // رویدادی که (date<=to و endDate>=from) — یعنی هم‌پوشان با بازه
      where.AND = [
        { OR: [{ date: { lte: to } }, { endDate: { lte: to } }] },
        {
          OR: [
            { endDate: { gte: from } },
            { AND: [{ endDate: null }, { date: { gte: from } }] },
          ],
        },
      ];
    }

    const eventsRaw = await db.calendarEvent.findMany({
      where: where as never,
      include: { createdBy: true, group: { select: { id: true, name: true, color: true } } },
      orderBy: { date: "asc" },
    });

    const events = eventsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      date: e.date.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      groupId: e.groupId,
      group: e.group,
      createdBy: toSafeUser(e.createdBy),
      createdAt: e.createdAt.toISOString(),
    }));

    // upcoming — ۷ روز آینده
    let upcomingEvents: typeof events = [];
    if (upcoming) {
      const now = new Date();
      const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      upcomingEvents = events
        .filter((e) => {
          const d = new Date(e.date);
          return d >= now && d <= inSevenDays;
        })
        .slice(0, 10);
    }

    return NextResponse.json({ events, upcoming: upcoming ? upcomingEvents : undefined });
  } catch (e) {
    return handleApiError(e);
  }
}

const createEventSchema = z.object({
  title: z.string().trim().min(2, "عنوان رویداد را وارد کنید").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z
    .enum(["GENERAL", "EXAM", "HOMEWORK", "MEETING", "HOLIDAY", "PROJECT"])
    .default("GENERAL"),
  date: z.string().min(1, "تاریخ رویداد را وارد کنید"),
  endDate: z.string().optional().nullable(),
  groupId: z.string().trim().optional().nullable(),
  time: z.string().optional(), // "HH:mm" اختیاری — روی تاریخ اعمال می‌شود
});

/**
 * POST /api/events — فقط ADMIN/MANAGER.
 * - date را از ISO یا رشته شمسی (با jalali) می‌پذیرد.
 * - اگر groupId → notify ACTIVE members گروه.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const data = createEventSchema.parse(body);

    // تبدیل تاریخ: اگر رشته ISO نباشد، تلاش می‌کنیم به‌صورت YYYY-MM-DD یا شمسی تفسیر کنیم.
    const parsedDate = new Date(data.date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "تاریخ رویداد نامعتبر است" },
        { status: 400 },
      );
    }
    // اگر time داده شده، ساعت و دقیقه را تنظیم می‌کنیم
    if (data.time && /^\d{2}:\d{2}$/.test(data.time)) {
      const [hh, mm] = data.time.split(":").map(Number);
      parsedDate.setHours(hh, mm, 0, 0);
    }

    let endDate: Date | null = null;
    if (data.endDate) {
      const ed = new Date(data.endDate);
      if (!isNaN(ed.getTime())) {
        endDate = ed;
        // اگر endDate قبل از date باشد، آن را برابر date قرار می‌دهیم
        if (endDate < parsedDate) endDate = new Date(parsedDate);
      }
    }

    let groupId: string | null = null;
    if (data.groupId) {
      const g = await db.group.findFirst({
        where: { id: data.groupId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!g) {
        return NextResponse.json({ error: "گروه انتخاب‌شده یافت نشد" }, { status: 404 });
      }
      groupId = g.id;
    }

    const event = await db.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        date: parsedDate,
        endDate,
        groupId,
        createdById: user.id,
      },
      include: {
        createdBy: true,
        group: { select: { id: true, name: true, color: true } },
      },
    });

    await logAudit({
      actorId: user.id,
      action: "EVENT_CREATE",
      entityType: "EVENT",
      entityId: event.id,
      summary: `رویداد «${event.title}» ساخته شد`,
      data: { type: event.type, date: parsedDate.toISOString(), groupId },
    });

    // اطلاع به اعضای فعال گروه (اگر groupId دارد)
    if (groupId) {
      const memberIds = await getActiveGroupMemberIds(groupId);
      await notifyUsers(
        memberIds.filter((uid) => uid !== user.id),
        {
          title: "رویداد جدید در گروه",
          message: `رویداد «${event.title}» در گروه شما ثبت شد.`,
          type: "GROUP",
          link: `#/calendar`,
        },
      );
    }

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.type,
        date: event.date.toISOString(),
        endDate: event.endDate ? event.endDate.toISOString() : null,
        groupId: event.groupId,
        group: event.group,
        createdBy: toSafeUser(event.createdBy),
        createdAt: event.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
