import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * ویرایش/حذف پیام همگانی — توسط سازنده یا ادمین.
 */

const LEVELS = ["INFO", "SUCCESS", "WARNING", "URGENT"] as const;
const AUDIENCES = ["ALL", "GROUP"] as const;

const PATCH_SCHEMA = z.object({
  title: z
    .string()
    .trim()
    .min(3, "عنوان پیام را وارد کنید")
    .max(140, "عنوان طولانی است")
    .optional(),
  body: z
    .string()
    .trim()
    .min(3, "متن پیام را وارد کنید")
    .max(2000, "متن پیام طولانی است")
    .optional(),
  level: z.enum(LEVELS, { message: "سطح اهمیت نامعتبر است" }).optional(),
  pinned: z.boolean().optional(),
  audience: z.enum(AUDIENCES, { message: "مخاطب نامعتبر است" }).optional(),
  groupId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const ann = await db.announcement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ann) {
      return NextResponse.json({ error: "پیام یافت نشد" }, { status: 404 });
    }
    if (ann.createdById !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "فقط سازنده یا ادمین می‌تواند ویرایش کند");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PATCH_SCHEMA.parse(body);

    if (parsed.audience === "GROUP" && !parsed.groupId && !ann.groupId) {
      return NextResponse.json(
        { error: "برای مخاطب گروهی، یک گروه انتخاب کنید" },
        { status: 400 },
      );
    }
    if (parsed.groupId) {
      const g = await db.group.findUnique({ where: { id: parsed.groupId } });
      if (!g || g.deletedAt) {
        return NextResponse.json({ error: "گروه معتبر نیست" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.title !== undefined) data.title = parsed.title;
    if (parsed.body !== undefined) data.body = parsed.body;
    if (parsed.level !== undefined) data.level = parsed.level;
    if (parsed.pinned !== undefined) data.pinned = parsed.pinned;
    if (parsed.audience !== undefined) {
      data.audience = parsed.audience;
      if (parsed.audience === "ALL") data.groupId = null;
      else if (parsed.groupId) data.groupId = parsed.groupId;
    } else if (parsed.groupId !== undefined) {
      data.groupId = parsed.groupId;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "هیچ فیلدی برای ویرایش ارسال نشد" },
        { status: 400 },
      );
    }

    const updated = await db.announcement.update({ where: { id }, data });
    await logAudit({
      actorId: user.id,
      action: "ANNOUNCEMENT_UPDATE",
      entityType: "Announcement",
      entityId: id,
      summary: `ویرایش پیام همگانی «${updated.title}»`,
      data: parsed as unknown,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const ann = await db.announcement.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ann) {
      return NextResponse.json({ error: "پیام یافت نشد" }, { status: 404 });
    }
    if (ann.createdById !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "فقط سازنده یا ادمین می‌تواند حذف کند");
    }

    await db.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logAudit({
      actorId: user.id,
      action: "ANNOUNCEMENT_DELETE",
      entityType: "Announcement",
      entityId: id,
      summary: `حذف پیام همگانی «${ann.title}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
