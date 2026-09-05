import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

import { autoCloseExpiredPolls } from "./_lib/settle";
import { toPollDTO } from "./_lib/dto";

/**
 * نظرسنجی‌های سیبک — لیست + ساخت.
 * نوع‌ها: NORMAL (گزینه آزاد) | VETO_GRANT (بله/خیر ثابت + targetUserId + vetoAmount).
 * وضعیت: OPEN | CLOSED | VETOED.
 */

const NORMAL_SCHEMA = z.object({
  type: z.literal("NORMAL"),
  title: z.string().trim().min(3, "عنوان نظرسنجی را وارد کنید").max(140, "عنوان طولانی است"),
  description: z.string().trim().max(700, "توضیحات طولانی است").optional(),
  options: z
    .array(z.string().trim().min(1, "متن گزینه خالی است").max(80, "متن گزینه طولانی است"))
    .min(2, "حداقل دو گزینه لازم است")
    .max(6, "حداکثر شش گزینه مجاز است"),
  isAnonymous: z.boolean().optional(),
  closesAt: z.string().datetime({ message: "تاریخ نامعتبر است" }).optional(),
  groupId: z.string().optional(),
});

const VETO_SCHEMA = z.object({
  type: z.literal("VETO_GRANT"),
  title: z.string().trim().min(3, "عنوان نظرسنجی را وارد کنید").max(140, "عنوان طولانی است"),
  description: z.string().trim().max(700, "توضیحات طولانی است").optional(),
  targetUserId: z.string().min(1, "کاربر هدف را انتخاب کنید"),
  vetoAmount: z.coerce.number().int().min(1, "حداقل ۱").max(5, "حداکثر ۵"),
  closesAt: z.string().datetime({ message: "تاریخ نامعتبر است" }).optional(),
  groupId: z.string().optional(),
});

const CREATE_SCHEMA = z.discriminatedUnion("type", [NORMAL_SCHEMA, VETO_SCHEMA]);


export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    // ۱) بستن خودکار نظرسنجی‌های OPEN با closesAt گذشته (و تسویه).
    await autoCloseExpiredPolls();

    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // OPEN|CLOSED|VETOED
    const type = url.searchParams.get("type"); // NORMAL|VETO_GRANT
    const mine = url.searchParams.get("mine") === "1";

    const polls = await db.poll.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(mine ? { createdById: user.id } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const dtos = await Promise.all(
      polls.map((p) =>
        toPollDTO(
          {
            id: p.id,
            title: p.title,
            description: p.description,
            type: p.type,
            status: p.status,
            isAnonymous: p.isAnonymous,
            closesAt: p.closesAt,
            createdAt: p.createdAt,
            createdById: p.createdById,
            groupId: p.groupId,
            targetUserId: p.targetUserId,
            vetoAmount: p.vetoAmount,
          },
          user.id,
        ),
      ),
    );

    return NextResponse.json({ polls: dtos });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMemberOrHigher();

    const body = await req.json().catch(() => ({}));
    const parsed = CREATE_SCHEMA.parse(body);

    // اعتبارسنجی یکتایی گزینه‌ها در حالت NORMAL
    if (parsed.type === "NORMAL") {
      const normalized = parsed.options.map((o) => o.trim());
      const unique = new Set(normalized);
      if (unique.size !== normalized.length) {
        return NextResponse.json(
          { error: "متن گزینه‌ها نباید تکراری باشد" },
          { status: 400 },
        );
      }
    }

    // اعتبارسنجی کاربر هدف و گروه
    if (parsed.type === "VETO_GRANT") {
      if (user.role !== "ADMIN" && user.role !== "MANAGER") {
        return NextResponse.json(
          { error: "ساخت نظرسنجی اعطای وتو فقط برای ادمین و مدیر مجاز است" },
          { status: 403 },
        );
      }
      const target = await db.user.findUnique({ where: { id: parsed.targetUserId } });
      if (!target || target.deletedAt || target.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "کاربر هدف معتبر نیست" },
          { status: 400 },
        );
      }
    }
    if (parsed.groupId) {
      const g = await db.group.findUnique({ where: { id: parsed.groupId } });
      if (!g || g.deletedAt) {
        return NextResponse.json({ error: "گروه معتبر نیست" }, { status: 400 });
      }
    }

    const closesAt = parsed.closesAt ? new Date(parsed.closesAt) : null;
    if (closesAt && closesAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "مهلت نظرسنجی باید در آینده باشد" },
        { status: 400 },
      );
    }

    let newPollId: string;

    if (parsed.type === "NORMAL") {
      const created = await db.poll.create({
        data: {
          title: parsed.title,
          description: parsed.description ?? null,
          type: "NORMAL",
          status: "OPEN",
          isAnonymous: parsed.isAnonymous ?? false,
          closesAt,
          createdById: user.id,
          groupId: parsed.groupId ?? null,
          options: {
            create: parsed.options.map((text) => ({ text: text.trim() })),
          },
        },
        include: { options: true },
      });
      newPollId = created.id;
    } else {
      // VETO_GRANT — گزینه‌های ثابت بله/خیر
      const created = await db.poll.create({
        data: {
          title: parsed.title,
          description: parsed.description ?? null,
          type: "VETO_GRANT",
          status: "OPEN",
          isAnonymous: false,
          closesAt,
          createdById: user.id,
          groupId: parsed.groupId ?? null,
          targetUserId: parsed.targetUserId,
          vetoAmount: parsed.vetoAmount,
          options: {
            create: [
              { text: "بله، وتو بدهد" },
              { text: "خیر" },
            ],
          },
        },
      });
      newPollId = created.id;

      // اطلاع به کاربر هدف
      await notifyUser(parsed.targetUserId, {
        title: "نظرسنجی اعطای وتو برای شما",
        message: `نظرسنجی اعطای وتو برای شما آغاز شد: ${parsed.title}`,
        type: "VETO",
        link: "#/polls",
      });
    }

    await logAudit({
      actorId: user.id,
      action: parsed.type === "NORMAL" ? "POLL_CREATE" : "POLL_CREATE_VETO_GRANT",
      entityType: "Poll",
      entityId: newPollId,
      summary: `ساخت نظرسنجی «${parsed.title}» (${parsed.type === "NORMAL" ? "معمولی" : "اعطای وتو"})`,
      data: {
        type: parsed.type,
        title: parsed.title,
        closesAt: closesAt ? closesAt.toISOString() : null,
        targetUserId: parsed.type === "VETO_GRANT" ? parsed.targetUserId : null,
        vetoAmount: parsed.type === "VETO_GRANT" ? parsed.vetoAmount : null,
      },
    });

    const fresh = await db.poll.findUnique({ where: { id: newPollId } });
    if (!fresh) throw new Error("نظرسنجی ساخته نشد");
    const dto = await toPollDTO(
      {
        id: fresh.id,
        title: fresh.title,
        description: fresh.description,
        type: fresh.type,
        status: fresh.status,
        isAnonymous: fresh.isAnonymous,
        closesAt: fresh.closesAt,
        createdAt: fresh.createdAt,
        createdById: fresh.createdById,
        groupId: fresh.groupId,
        targetUserId: fresh.targetUserId,
        vetoAmount: fresh.vetoAmount,
      },
      user.id,
    );
    return NextResponse.json({ poll: dto }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
