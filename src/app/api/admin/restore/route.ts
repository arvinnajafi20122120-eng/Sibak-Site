import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const ENTITY_TYPES = [
  "IDEA",
  "POLL",
  "DEBT",
  "EVENT",
  "ANNOUNCEMENT",
  "COMMENT",
  "GROUP",
] as const;

const SCHEMA = z.object({
  entityType: z.enum(ENTITY_TYPES, {
    message: "نوع موجودیت نامعتبر است",
  }),
  entityId: z.string().trim().min(1, "شناسه موجودیت الزامی است"),
});

const ENTITY_LABEL_FA: Record<string, string> = {
  IDEA: "ایده",
  POLL: "نظرسنجی",
  DEBT: "بدهی",
  EVENT: "رویداد",
  ANNOUNCEMENT: "پیام",
  COMMENT: "نظر",
  GROUP: "گروه",
};

/** شناسه مالک هر موجودیت — برای notify بعد از بازیابی. */
async function findOwner(
  entityType: string,
  entityId: string,
): Promise<{ ownerId: string | null; label: string }> {
  switch (entityType) {
    case "IDEA": {
      const r = await db.idea.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, authorId: true, deletedAt: true },
      });
      return {
        ownerId: r?.authorId ?? null,
        label: r?.title ?? ENTITY_LABEL_FA.IDEA,
      };
    }
    case "POLL": {
      const r = await db.poll.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, createdById: true, deletedAt: true },
      });
      return {
        ownerId: r?.createdById ?? null,
        label: r?.title ?? ENTITY_LABEL_FA.POLL,
      };
    }
    case "DEBT": {
      const r = await db.debt.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, debtorId: true, deletedAt: true },
      });
      return {
        ownerId: r?.debtorId ?? null,
        label: r?.title ?? ENTITY_LABEL_FA.DEBT,
      };
    }
    case "EVENT": {
      const r = await db.calendarEvent.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, createdById: true, deletedAt: true },
      });
      return {
        ownerId: r?.createdById ?? null,
        label: r?.title ?? ENTITY_LABEL_FA.EVENT,
      };
    }
    case "ANNOUNCEMENT": {
      const r = await db.announcement.findUnique({
        where: { id: entityId },
        select: { id: true, title: true, createdById: true, deletedAt: true },
      });
      return {
        ownerId: r?.createdById ?? null,
        label: r?.title ?? ENTITY_LABEL_FA.ANNOUNCEMENT,
      };
    }
    case "COMMENT": {
      const r = await db.comment.findUnique({
        where: { id: entityId },
        select: { id: true, body: true, authorId: true, deletedAt: true },
      });
      return {
        ownerId: r?.authorId ?? null,
        label: r?.body?.slice(0, 30) ?? ENTITY_LABEL_FA.COMMENT,
      };
    }
    case "GROUP": {
      const r = await db.group.findUnique({
        where: { id: entityId },
        select: { id: true, name: true, leaderId: true, deletedAt: true },
      });
      return {
        ownerId: r?.leaderId ?? null,
        label: r?.name ?? ENTITY_LABEL_FA.GROUP,
      };
    }
    default:
      return { ownerId: null, label: ENTITY_LABEL_FA[entityType] ?? "موجودیت" };
  }
}

/**
 * POST /api/admin/restore body {entityType, entityId}
 * بازیافت محتوای حذف‌شده — set deletedAt=null + audit RESTORE + notify owner.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const owner = await findOwner(data.entityType, data.entityId);
    const label = owner.label;

    // پاک کردن deletedAt بر اساس نوع موجودیت
    switch (data.entityType) {
      case "IDEA": {
        const r = await db.idea.findUnique({ where: { id: data.entityId } });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.idea.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "POLL": {
        const r = await db.poll.findUnique({ where: { id: data.entityId } });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.poll.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "DEBT": {
        const r = await db.debt.findUnique({ where: { id: data.entityId } });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.debt.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "EVENT": {
        const r = await db.calendarEvent.findUnique({
          where: { id: data.entityId },
        });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.calendarEvent.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "ANNOUNCEMENT": {
        const r = await db.announcement.findUnique({
          where: { id: data.entityId },
        });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.announcement.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "COMMENT": {
        const r = await db.comment.findUnique({ where: { id: data.entityId } });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.comment.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
      case "GROUP": {
        const r = await db.group.findUnique({ where: { id: data.entityId } });
        if (!r) throw new AuthError(404, "موجودیت یافت نشد");
        if (!r.deletedAt)
          throw new AuthError(400, "این موجودیت حذف‌شده نیست");
        await db.group.update({
          where: { id: data.entityId },
          data: { deletedAt: null },
        });
        break;
      }
    }

    await logAudit({
      actorId: user.id,
      action: "RESTORE",
      entityType: data.entityType,
      entityId: data.entityId,
      summary: `بازیافت ${ENTITY_LABEL_FA[data.entityType] ?? "موجودیت"} «${label}»`,
      data: { entityType: data.entityType, entityId: data.entityId },
    });

    if (owner.ownerId && owner.ownerId !== user.id) {
      await notifyUser(owner.ownerId, {
        title: "محتوای شما بازیابی شد",
        message: `«${label}» که حذف شده بود، توسط ادمین بازیابی شد.`,
        type: "USER",
        link: null,
      });
    }

    return NextResponse.json({ ok: true, entityType: data.entityType, entityId: data.entityId });
  } catch (e) {
    return handleApiError(e);
  }
}
