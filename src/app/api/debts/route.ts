import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toDebtListItem } from "./_lib/dto";
import { canSeeDebtFast } from "./_lib/visibility";

/**
 * سیستم بدهکاری مودبانه — لیست + ساخت.
 * واژگان: تعهد / جبران / بدهی دوستانه — هرگز تحقیرآمیز نیست.
 */

const CREATE_SCHEMA = z.object({
  debtorId: z
    .string({ error: "بدهکار را انتخاب کنید" })
    .min(1, "بدهکار را انتخاب کنید"),
  creditorId: z
    .string({ error: "طلبکار را انتخاب کنید" })
    .min(1, "طلبکار را انتخاب کنید"),
  title: z
    .string({ error: "عنوان تعهد را وارد کنید" })
    .trim()
    .min(3, "عنوان تعهد را وارد کنید")
    .max(140, "عنوان طولانی است"),
  projectName: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  amount: z.coerce
    .number({ error: "مقدار امتیاز نامعتبر است" })
    .int()
    .min(1, "مقدار امتیاز حداقل ۱ است")
    .max(1000, "مقدار امتیاز حداکثر ۱۰۰۰ است"),
  visibility: z
    .enum(["PUBLIC", "RESTRICTED", "PRIVATE"], {
      message: "نوع نمایش نامعتبر است",
    })
    .default("PUBLIC"),
  dueDate: z
    .string()
    .datetime({ message: "تاریخ سررسید نامعتبر است" })
    .optional(),
  allowedUserIds: z.array(z.string()).optional(),
}).refine((d) => d.debtorId !== d.creditorId, {
  message: "بدهکار و طلبکار نمی‌توانند یک نفر باشند",
  path: ["creditorId"],
}).refine(
  (d) => d.visibility !== "RESTRICTED" || (d.allowedUserIds && d.allowedUserIds.length > 0),
  { message: "برای نمایش محدود، حداقل یک کاربر منتخب انتخاب کنید", path: ["allowedUserIds"] },
);

/**
 * GET /api/debts?mine=1&status=&as=debtor|creditor
 * - mine=1 → فقط بدهی‌هایی که من درگیرم
 * - پیش‌فرض MEMBER → PUBLIC + درگیری‌های خودم
 * - ADMIN → همه
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const mineOnly = sp.get("mine") === "1";
    const status = sp.get("status");
    const as = sp.get("as"); // debtor|creditor

    const isAdmin = user.role === "ADMIN";

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;

    if (mineOnly || as) {
      const OR: Record<string, unknown>[] = [];
      if (as === "debtor") OR.push({ debtorId: user.id });
      else if (as === "creditor") OR.push({ creditorId: user.id });
      else {
        OR.push({ debtorId: user.id }, { creditorId: user.id });
      }
      where.OR = OR;
    } else if (!isAdmin) {
      // MEMBER/MANAGER: PUBLIC + درگیری‌های خودم + RESTRICTED که در allowedUsers‌ام
      where.OR = [
        { visibility: "PUBLIC" },
        { debtorId: user.id },
        { creditorId: user.id },
        {
          AND: [
            { visibility: "RESTRICTED" },
            { allowedUsers: { some: { userId: user.id } } },
          ],
        },
      ];
    }

    const debtsRaw = await db.debt.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      include: {
        debtor: true,
        creditor: true,
        createdBy: true,
        events: { select: { id: true } },
        allowedUsers: { select: { userId: true } },
      },
    });

    // فیلتر دید سمت سرور
    const visible: typeof debtsRaw = [];
    for (const d of debtsRaw) {
      const allowedSet = new Set(d.allowedUsers.map((u) => u.userId));
      if (canSeeDebtFast(user, d, allowedSet)) visible.push(d);
    }

    // آمار events با groupBy روی همه‌ی debtId های مرئی
    const ids = visible.map((d) => d.id);
    const counts = await db.debtEvent.groupBy({
      by: ["debtId"],
      where: { debtId: { in: ids } },
      _count: true,
    });
    const countMap = new Map(counts.map((c) => [c.debtId, c._count]));

    const items = await Promise.all(
      visible.map((d) =>
        toDebtListItem(
          { ...d, _count: { events: countMap.get(d.id) ?? 0 } },
          user.id,
        ),
      ),
    );

    return NextResponse.json({ debts: items });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/debts — فقط ADMIN یا MANAGER.
 * ساخت تعهد جدید + رویداد CREATE + اطلاع به بدهکار و طلبکار.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const data = CREATE_SCHEMA.parse(body);

    // اعتبارسنجی کاربرها
    const [debtor, creditor] = await Promise.all([
      db.user.findFirst({
        where: { id: data.debtorId, deletedAt: null, status: "ACTIVE" },
      }),
      db.user.findFirst({
        where: { id: data.creditorId, deletedAt: null, status: "ACTIVE" },
      }),
    ]);
    if (!debtor) {
      return NextResponse.json({ error: "بدهکار انتخاب‌شده یافت نشد" }, { status: 404 });
    }
    if (!creditor) {
      return NextResponse.json({ error: "طلبکار انتخاب‌شده یافت نشد" }, { status: 404 });
    }

    // اعتبارسنجی allowedUserIds اگر RESTRICTED
    let allowedUserIds: string[] = [];
    if (data.visibility === "RESTRICTED") {
      const ids = data.allowedUserIds ?? [];
      const ok = await db.user.findMany({
        where: { id: { in: ids }, deletedAt: null, status: "ACTIVE" },
        select: { id: true },
      });
      const okSet = new Set(ok.map((u) => u.id));
      allowedUserIds = ids.filter((id) => okSet.has(id));
    }

    const dueDate = data.dueDate ? new Date(data.dueDate) : null;

    const debt = await db.debt.create({
      data: {
        debtorId: debtor.id,
        creditorId: creditor.id,
        title: data.title,
        projectName: data.projectName?.trim() || null,
        description: data.description?.trim() || null,
        amount: data.amount,
        status: "OPEN",
        visibility: data.visibility,
        dueDate,
        createdById: user.id,
        ...(allowedUserIds.length
          ? { allowedUsers: { create: allowedUserIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: {
        debtor: true,
        creditor: true,
        createdBy: true,
        allowedUsers: { include: { user: true } },
      },
    });

    await db.debtEvent.create({
      data: {
        debtId: debt.id,
        actorId: user.id,
        type: "CREATE",
        note: data.description?.trim() || null,
      },
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_CREATE",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `تعهد «${debt.title}» ثبت شد — ${debt.amount} امتیاز از ${debtor.name} به ${creditor.name}`,
      data: {
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount: debt.amount,
        visibility: debt.visibility,
        projectName: debt.projectName,
      },
    });

    // اطلاع مودبانه به بدهکار و طلبکار
    await notifyUser(debtor.id, {
      title: "یک تعهد دوستانه ثبت شد 🌱",
      message: `«${debt.title}» — ${debt.amount} امتیاز به ${creditor.name}. هر زمان جبران کنید؛ این‌جا یادآوری دوستانه است.`,
      type: "DEBT",
      link: `#/debts`,
    });
    if (creditor.id !== debtor.id) {
      await notifyUser(creditor.id, {
        title: "تعهدی به نفع شما ثبت شد 🌱",
        message: `«${debt.title}» — ${debtor.name} متعهد شد ${debt.amount} امتیاز را جبران کند. هر زمان آماده بودید تسویه کنید.`,
        type: "DEBT",
        link: `#/debts`,
      });
    }

    const item = await toDebtListItem(
      { ...debt, _count: { events: 1 } },
      user.id,
    );
    return NextResponse.json({ debt: item }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
