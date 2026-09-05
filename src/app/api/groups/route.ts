import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import {
  GROUP_COLORS,
  ensureUniqueSlug,
  getActiveGroupMemberIds,
  slugifyFa,
} from "@/app/api/_lib/content";

/**
 * GET /api/groups?mine=1 — همه گروه‌های حذف‌نشده با متادیتای عضویت کاربر.
 * شامل: memberCount (فعال)، leader (safe)، وضعیت عضویت من، ideasCount.
 * ?excludeClasses=1 — گروه‌هایی که استاد دارند (کلاس‌ها) را حذف می‌کند
 * تا سکشن «زیرمجموعه‌ها» فقط گروه‌های مطالعاتی را نشان دهد.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const mineOnly = req.nextUrl.searchParams.get("mine") === "1";
    const excludeClasses = req.nextUrl.searchParams.get("excludeClasses") === "1";

    const groups = await db.group.findMany({
      where: {
        deletedAt: null,
        ...(excludeClasses ? { teacherGroups: { none: {} } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        leader: true,
        members: { where: mineOnly ? { userId: user.id } : {} },
        _count: { select: { ideas: { where: { deletedAt: null } } } },
      },
    });

    // memberCount را جدا می‌گیریم تا فقط ACTIVE بشمارد
    const withMemberCount = await Promise.all(
      groups.map(async (g) => {
        const activeCount = await db.groupMember.count({
          where: { groupId: g.id, status: "ACTIVE" },
        });
        const myMembership = g.members.find((m) => m.userId === user.id) ?? null;
        return {
          id: g.id,
          name: g.name,
          slug: g.slug,
          description: g.description,
          color: g.color,
          icon: g.icon,
          joinPolicy: g.joinPolicy,
          createdAt: g.createdAt.toISOString(),
          leader: g.leader ? toSafeUser(g.leader) : null,
          memberCount: activeCount,
          ideasCount: g._count.ideas,
          myMembership: myMembership ? myMembership.status : null,
        };
      }),
    );

    const filtered = mineOnly
      ? withMemberCount.filter((g) => g.myMembership === "ACTIVE")
      : withMemberCount;

    return NextResponse.json({ groups: filtered });
  } catch (e) {
    return handleApiError(e);
  }
}

const createGroupSchema = z.object({
  name: z.string().trim().min(2, "نام گروه را وارد کنید").max(80, "نام گروه بیش از طول است"),
  description: z.string().trim().max(500).optional(),
  color: z.enum(["emerald", "rose", "amber", "teal", "orange"]).default("emerald"),
  icon: z.string().trim().max(60).default("users"),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE"]).default("REQUEST"),
  leaderId: z.string().trim().optional(),
});

/**
 * POST /api/groups — فقط ADMIN/MANAGER. slug خودکار از نام.
 * Audit + اعلان به ادمین‌ها/مدیران.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const body = await req.json().catch(() => ({}));
    const data = createGroupSchema.parse(body);

    // اگر leaderId داده‌شده، باید کاربر فعال باشد
    let leaderId = user.id;
    if (data.leaderId) {
      const target = await db.user.findFirst({
        where: { id: data.leaderId, deletedAt: null, status: "ACTIVE" },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "کاربر انتخاب‌شده برای رهبری یافت نشد" },
          { status: 404 },
        );
      }
      leaderId = target.id;
    }

    if (!GROUP_COLORS.includes(data.color as never)) {
      return NextResponse.json({ error: "رنگ گروه نامعتبر است" }, { status: 400 });
    }

    const slug = await ensureUniqueSlug(slugifyFa(data.name));

    const group = await db.group.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        color: data.color,
        icon: data.icon,
        joinPolicy: data.joinPolicy,
        leaderId,
      },
      include: { leader: true },
    });

    // خود رهبر به‌عنوان ACTIVE عضو می‌شود
    await db.groupMember.create({
      data: { groupId: group.id, userId: leaderId, status: "ACTIVE" },
    });

    await logAudit({
      actorId: user.id,
      action: "GROUP_CREATE",
      entityType: "GROUP",
      entityId: group.id,
      summary: `گروه «${group.name}» ساخته شد`,
      data: { name: group.name, slug: group.slug, color: group.color, joinPolicy: group.joinPolicy },
    });

    // اعلان به همه ادمین/مدیرها (به‌جز خودسازنده)
    const staffIds = (await db.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, status: "ACTIVE", deletedAt: null, id: { not: user.id } },
      select: { id: true },
    })).map((u) => u.id);
    await notifyUsers(staffIds, {
      title: "گروه جدید ساخته شد",
      message: `${user.name} گروه جدیدی به نام «${group.name}» ساخت.`,
      type: "GROUP",
      link: `#/groups/${group.id}`,
    });

    // اطمینان از عضویت‌های فعال برای پاسخ نهایی
    const memberIds = await getActiveGroupMemberIds(group.id);
    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        color: group.color,
        icon: group.icon,
        joinPolicy: group.joinPolicy,
        leader: group.leader ? toSafeUser(group.leader) : null,
        memberCount: memberIds.length,
        ideasCount: 0,
        myMembership: user.id === leaderId ? "ACTIVE" : null,
        createdAt: group.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
