import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  SUPPORT_SETTING_KEYS,
  type SupportDTO,
  type SupportStatus,
} from "@/lib/support";

/**
 * GET /api/support — اطلاعات بخش «حمایت از سیبک».
 * عموم: تنظیمات کارت + حامیانِ عمومی + اعلامِ در انتظارِ خودش.
 * مدیر/ادمین: به‌علاوهٔ کل صف اعلام‌ها و حامیانِ پنهان.
 */
export async function GET() {
  try {
    const { user } = await requireUser();
    const canManage = user.role === "ADMIN" || user.role === "MANAGER";

    const [settingRows, rows] = await Promise.all([
      db.setting.findMany({
        where: {
          key: {
            in: Object.values(SUPPORT_SETTING_KEYS),
          },
        },
      }),
      db.support.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const settingsMap = new Map(settingRows.map((r) => [r.key, r.value]));
    const rawCard = settingsMap.get(SUPPORT_SETTING_KEYS.cardNumber) ?? "";

    function toDTO(s: (typeof rows)[number]): SupportDTO {
      return {
        id: s.id,
        name: s.name,
        amount: s.amount,
        message: s.message,
        status: s.status as SupportStatus,
        isPublic: s.isPublic,
        userId: s.userId,
        createdAt: s.createdAt.toISOString(),
        registeredAt: s.registeredAt?.toISOString() ?? null,
      };
    }

    const registered = rows.filter((r) => r.status === "REGISTERED");
    const supporters = canManage
      ? registered.map(toDTO)
      : registered.filter((r) => r.isPublic).map(toDTO);

    const pendingRows = canManage ? rows.filter((r) => r.status === "PENDING") : [];
    const rejectedRows = canManage
      ? rows.filter((r) => r.status === "REJECTED").slice(0, 20)
      : [];
    const myPendingRow =
      rows.find((r) => r.status === "PENDING" && r.userId === user.id) ?? null;

    const res = {
      settings: {
        // شمارهٔ کارت فقط وقتی ادمین ثبتش کرده پر است؛ در ابتدا خالی است
        cardNumber: rawCard ? rawCard : null,
        cardHolder: settingsMap.get(SUPPORT_SETTING_KEYS.cardHolder) || null,
      },
      supporters,
      pending: pendingRows.map(toDTO),
      rejected: rejectedRows.map(toDTO),
      myPending: myPendingRow ? toDTO(myPendingRow) : null,
      canManage,
    };
    return NextResponse.json(res);
  } catch (e) {
    return handleApiError(e);
  }
}

const declareSchema = z.object({
  name: z.string().trim().min(2, "نام حداقل ۲ حرف باشد").max(60, "نام حداکثر ۶۰ حرف").optional(),
  amount: z
    .number()
    .int("مبلغ باید عدد صحیح باشد")
    .min(1, "مبلغ نامعتبر است")
    .max(1_000_000_000, "مبلغ بیش از حد بزرگ است")
    .nullable()
    .optional(),
  message: z.string().trim().max(300, "پیام حداکثر ۳۰۰ حرف است").optional(),
  /** میل فرد به دیدن نامش در فهرست حامیان — مدیر هنگام ثبت، تأیید نهایی را می‌کند */
  isPublic: z.boolean().optional(),
});

/**
 * POST /api/support — اعلام حمایت پس از واریز (هر کاربر واردشده).
 * رکورد PENDING می‌سازد و به همهٔ ادمین‌ها و مدیرها اعلان می‌دهد تا ثبتش کنند.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const data = declareSchema.parse(body);

    // ضد اسپم: هر کاربر همزمان فقط یک اعلام در انتظار بررسی دارد
    const existing = await db.support.findFirst({
      where: { userId: user.id, status: "PENDING", deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { error: "شما یک اعلام حمایت در انتظار بررسی دارید؛ صبر کنید تا مدیر بررسی کند" },
        { status: 409 },
      );
    }

    const created = await db.support.create({
      data: {
        name: data.name ?? user.name,
        amount: data.amount ?? null,
        message: data.message ?? null,
        isPublic: data.isPublic ?? false,
        status: "PENDING",
        userId: user.id,
      },
    });

    // اعلان به همهٔ ادمین‌ها و مدیرهای فعال
    const managers = await db.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });
    const amountText =
      created.amount !== null ? ` به مبلغ ${created.amount.toLocaleString("fa-IR")} تومان` : "";
    await db.notification.createMany({
      data: managers
        .filter((m) => m.id !== user.id)
        .map((m) => ({
          userId: m.id,
          title: "اعلام حمایت جدید ❤️",
          message: `${created.name} اعلام حمایت${amountText} کرده است؛ پس از تأیید واریز، آن را در فهرست حامیان ثبت کنید.`,
          type: "INFO",
          link: "#/support",
        })),
    });

    await logAudit({
      actorId: user.id,
      action: "SUPPORT_DECLARE",
      entityType: "SUPPORT",
      entityId: created.id,
      summary: `اعلام حمایت توسط ${created.name}`,
      data: { amount: created.amount, hasMessage: Boolean(created.message) },
    });

    return NextResponse.json(
      {
        ok: true,
        declaration: {
          id: created.id,
          name: created.name,
          amount: created.amount,
          message: created.message,
          status: created.status,
          isPublic: created.isPublic,
          userId: created.userId,
          createdAt: created.createdAt.toISOString(),
          registeredAt: null,
        } satisfies SupportDTO,
      },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
