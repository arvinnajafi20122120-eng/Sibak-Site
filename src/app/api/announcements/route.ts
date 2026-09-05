import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

/** اعضای فعال یک گروه — برای اطلاع‌رسانی پیام گروهی. */
async function getActiveGroupMemberIds(groupId: string): Promise<string[]> {
  const rows = await db.groupMember.findMany({
    where: { groupId, status: "ACTIVE" },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/**
 * پیام‌های همگانی سیبک — لیست + ساخت.
 * - ALL: برای همه اعضا قابل‌مشاهده.
 * - GROUP: برای همه قابل‌مشاهده اما chip گروهی نشان داده می‌شود.
 */

const LEVELS = ["INFO", "SUCCESS", "WARNING", "URGENT"] as const;
const AUDIENCES = ["ALL", "GROUP"] as const;

const CREATE_SCHEMA = z.object({
  title: z
    .string()
    .trim()
    .min(3, "عنوان پیام را وارد کنید")
    .max(140, "عنوان طولانی است"),
  body: z
    .string()
    .trim()
    .min(3, "متن پیام را وارد کنید")
    .max(2000, "متن پیام طولانی است"),
  level: z.enum(LEVELS, { message: "سطح اهمیت نامعتبر است" }),
  pinned: z.boolean().optional(),
  audience: z.enum(AUDIENCES, { message: "مخاطب نامعتبر است" }),
  groupId: z.string().optional(),
});

/** تبدیل رکورد Announcement به DTO. */
async function toAnnouncementDTO(
  ann: {
    id: string;
    title: string;
    body: string;
    level: string;
    pinned: boolean;
    audience: string;
    groupId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdById: string;
  },
) {
  const [creator, group] = await Promise.all([
    db.user.findUnique({
      where: { id: ann.createdById },
      select: {
        id: true, name: true, username: true, role: true,
        status: true, joinReason: true, skills: true, bio: true,
        avatar: true, points: true, rejectionNote: true,
        lastLoginAt: true, createdAt: true,
      },
    }),
    ann.groupId
      ? db.group.findUnique({
          where: { id: ann.groupId },
          select: { id: true, name: true, slug: true, color: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    id: ann.id,
    title: ann.title,
    body: ann.body,
    level: ann.level,
    pinned: ann.pinned,
    audience: ann.audience,
    createdAt: ann.createdAt.toISOString(),
    updatedAt: ann.updatedAt.toISOString(),
    createdBy: creator ? toSafeUser(creator) : null,
    group: group
      ? { id: group.id, name: group.name, slug: group.slug, color: group.color }
      : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    void user;

    const url = new URL(req.url);
    const onlyBanner = url.searchParams.get("banner") === "1";

    if (onlyBanner) {
      // آخرین URGENT یا pinned در ۱۴ روز اخیر
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const candidates = await db.announcement.findMany({
        where: {
          deletedAt: null,
          OR: [{ level: "URGENT" }, { pinned: true }],
          createdAt: { gte: since },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 1,
      });
      const latest = candidates[0];
      if (!latest) return NextResponse.json({ announcement: null });
      const dto = await toAnnouncementDTO(latest);
      return NextResponse.json({ announcement: dto });
    }

    const all = await db.announcement.findMany({
      where: { deletedAt: null },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });

    const dtos = await Promise.all(all.map(toAnnouncementDTO));
    return NextResponse.json({ announcements: dtos });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);

    const body = await req.json().catch(() => ({}));
    const parsed = CREATE_SCHEMA.parse(body);

    if (parsed.audience === "GROUP" && !parsed.groupId) {
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

    const created = await db.announcement.create({
      data: {
        title: parsed.title,
        body: parsed.body,
        level: parsed.level,
        pinned: parsed.pinned ?? false,
        audience: parsed.audience,
        groupId: parsed.audience === "GROUP" ? parsed.groupId! : null,
        createdById: user.id,
      },
    });

    // اطلاع‌رسانی
    if (parsed.audience === "ALL") {
      const active = await db.user.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      await notifyUsers(
        active.map((u) => u.id),
        {
          title: "📣 پیام همگانی جدید",
          message: parsed.title,
          type: "INFO",
          link: "#/announcements",
        },
      );
    } else {
      const members = await getActiveGroupMemberIds(parsed.groupId!);
      await notifyUsers(members, {
        title: "📣 پیام گروهی جدید",
        message: parsed.title,
        type: "GROUP",
        link: "#/announcements",
      });
    }

    await logAudit({
      actorId: user.id,
      action: "ANNOUNCEMENT_CREATE",
      entityType: "Announcement",
      entityId: created.id,
      summary: `ساخت پیام همگانی «${parsed.title}» (${parsed.audience === "ALL" ? "همه" : "گروهی"})`,
      data: {
        title: parsed.title,
        level: parsed.level,
        audience: parsed.audience,
        groupId: parsed.groupId ?? null,
        pinned: parsed.pinned ?? false,
      },
    });

    const dto = await toAnnouncementDTO(created);
    return NextResponse.json({ announcement: dto }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
