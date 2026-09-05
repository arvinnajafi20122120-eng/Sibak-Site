import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

import { ADMIN_SAFE_SELECT } from "../../../_lib/dto";

const SCHEMA = z.object({
  note: z.string().trim().max(500).optional(),
});

/** POST /api/admin/users/[id]/approve — PENDING→ACTIVE + notify welcome. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_SAFE_SELECT,
    });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.status !== "PENDING") {
      throw new AuthError(400, "فقط کاربران در انتظار می‌توانند تأیید شوند");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: ADMIN_SAFE_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_APPROVE",
      entityType: "USER",
      entityId: id,
      summary: `عضویت ${target.name} تأیید شد`,
      data: { note: data.note ?? null },
    });
    await notifyUser(id, {
      title: "🎉 عضویت شما تأیید شد",
      message: `عضویت شما در سیبک تأیید شد — خوش آمدید! اکنون می‌توانید وارد فضای همکاری شوید.`,
      type: "USER",
      link: "#/home",
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}
