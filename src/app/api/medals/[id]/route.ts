import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  MEDAL_IMAGE_MAX_LENGTH,
  MEDAL_RARITIES,
  type MedalRarity,
} from "@/lib/medals";

const EDIT_SCHEMA = z.object({
  name: z.string().trim().min(2, "نام مدال حداقل ۲ حرف باشد").max(60, "نام مدال طولانی است").optional(),
  description: z
    .string()
    .trim()
    .min(2, "توضیحات حداقل ۲ حرف باشد")
    .max(500, "توضیحات حداکثر ۵۰۰ حرف است")
    .optional(),
  imageUrl: z
    .string()
    .startsWith("data:image/png;base64,", "عکس باید PNG باشد")
    .max(MEDAL_IMAGE_MAX_LENGTH, "عکس خیلی بزرگ است — نسخهٔ کوچک‌تری بگذار")
    .optional(),
  rarity: z.enum(MEDAL_RARITIES as [MedalRarity, ...MedalRarity[]]).optional(),
  points: z.number().int().min(0, "امتیاز نمی‌تواند منفی باشد").max(1000, "امتیاز حداکثر ۱۰۰۰").optional(),
  maxCount: z
    .number()
    .int()
    .min(1, "سقف تعداد حداقل ۱ است")
    .max(999, "سقف تعداد حداکثر ۹۹۹")
    .nullable()
    .optional(),
});

/**
 * PUT /api/medals/[id] — ویرایش مدال (فقط ADMIN).
 * imageUrl اختیاری است — اگر نیاید عکس قبلی حفظ می‌شود.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = EDIT_SCHEMA.parse(body);

    const medal = await db.medal.findFirst({ where: { id, deletedAt: null } });
    if (!medal) {
      return NextResponse.json({ error: "مدال یافت نشد" }, { status: 404 });
    }

    // سقف تعداد نمی‌تواند کمتر از دارندگان فعلی شود
    if (data.maxCount !== undefined && data.maxCount !== null) {
      const count = await db.userMedal.count({ where: { medalId: id } });
      if (data.maxCount < count) {
        return NextResponse.json(
          { error: `سقف تعداد نمی‌تواند کمتر از ${count} دارندهٔ فعلی باشد` },
          { status: 400 },
        );
      }
    }

    const updated = await db.medal.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.rarity !== undefined ? { rarity: data.rarity } : {}),
        ...(data.points !== undefined ? { points: data.points } : {}),
        ...(data.maxCount !== undefined ? { maxCount: data.maxCount } : {}),
      },
    });

    await logAudit({
      actorId: user.id,
      action: "MEDAL_UPDATE",
      entityType: "MEDAL",
      entityId: id,
      summary: `مدال «${updated.name}» ویرایش شد`,
      data: { fields: Object.keys(data) },
    });

    return NextResponse.json({ ok: true, medal: { id: updated.id, name: updated.name } });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/medals/[id] — حذف نرم مدال (فقط ADMIN).
 * ردیف‌های UserMedal برای پرونده ادمین باقی می‌مانند؛ مدال از کتابخانه و پروفایل‌ها محو می‌شود.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const medal = await db.medal.findFirst({ where: { id, deletedAt: null } });
    if (!medal) {
      return NextResponse.json({ error: "مدال یافت نشد" }, { status: 404 });
    }

    await db.medal.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: user.id,
      action: "MEDAL_DELETE",
      entityType: "MEDAL",
      entityId: id,
      summary: `مدال «${medal.name}» حذف شد`,
      data: { name: medal.name, rarity: medal.rarity },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
