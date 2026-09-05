import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

/**
 * GET /api/search?q=... — جستجوی واقعی در کل داده‌های سیبک.
 *
 * دامنه جستجو بر اساس نقش:
 *   - همه نقش‌ها (حتی GUEST): گروه‌ها/کلاس‌ها، اطلاعیه‌ها، رویدادهای تقویم
 *   - به‌جز GUEST: ایده‌ها، نظرسنجی‌ها، کاربران
 *
 * هر نتیجه: { type, id, title, subtitle, link } — لینک یک مسیر هش‌محور است
 * که هدر با navigate باز می‌کند.
 *
 * نکته SQLite: contains به بزرگی/کوچکی حروف حساس است؛ برای پوشش لاتین
 * سه واریانت (خودِ عبارت، حروف کوچک، حروف بزرگ) با OR جستجو می‌شود.
 * (فارسی بی‌حس به بزرگی/کوچکی است.)
 */

const TYPE_LABELS: Record<string, string> = {
  class: "کلاس",
  group: "زیرمجموعه",
  idea: "ایده",
  announcement: "اطلاعیه",
  poll: "نظرسنجی",
  event: "رویداد",
  user: "کاربر",
};

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const lower = q.toLowerCase();
    const upper = q.toUpperCase();
    const variants = Array.from(new Set([q, lower, upper]));

    const orLike = (fields: string[]) =>
      variants.flatMap((v) => fields.map((f) => ({ [f]: { contains: v } })));

    const isStaff = user.role === "ADMIN" || user.role === "MANAGER";
    const canDeepSearch = user.role !== "GUEST";

    // عضویت‌های فعال من — برای محدود کردن اطلاعیه‌های گروهی و رویدادهای گروهی
    const myGroupIds = (
      await db.groupMember.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { groupId: true },
      })
    ).map((m) => m.groupId);

    type Hit = {
      type: keyof typeof TYPE_LABELS;
      id: string;
      title: string;
      subtitle: string;
      link: string;
    };
    const hits: Hit[] = [];

    /* ---------- گروه‌ها و کلاس‌ها (برای همه) ---------- */
    const groups = await db.group.findMany({
      where: {
        deletedAt: null,
        OR: orLike(["name", "description"]),
      },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
        teacherGroups: { select: { teacherId: true }, take: 1 },
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    });
    for (const g of groups) {
      const isClass = g.teacherGroups.length > 0;
      hits.push({
        type: isClass ? "class" : "group",
        id: g.id,
        title: g.name,
        subtitle: isClass
          ? `کلاس درسی · ${g._count.members} عضو`
          : `زیرمجموعه · ${g._count.members} عضو`,
        link: `/groups/${g.id}`,
      });
    }

    /* ---------- اطلاعیه‌ها (برای همه؛ سطح‌بندی ALL یا گروه‌های من) ---------- */
    const announcements = await db.announcement.findMany({
      where: {
        OR: orLike(["title", "body"]),
        AND: [
          {
            OR: [
              { audience: "ALL" },
              { audience: "GROUP", groupId: { in: myGroupIds } },
              ...(isStaff ? [{ audience: "GROUP" }] : []),
            ],
          },
        ],
      },
      select: { id: true, title: true, level: true, createdAt: true },
      take: 6,
      orderBy: { createdAt: "desc" },
    });
    for (const a of announcements) {
      hits.push({
        type: "announcement",
        id: a.id,
        title: a.title,
        subtitle: a.level === "URGENT" ? "اطلاعیه فوری" : "اطلاعیه",
        link: "/announcements",
      });
    }

    /* ---------- رویدادهای تقویم (برای همه؛ عمومی یا گروه‌های من) ---------- */
    const events = await db.calendarEvent.findMany({
      where: {
        deletedAt: null,
        OR: orLike(["title", "description"]),
        AND: [{ OR: [{ groupId: null }, { groupId: { in: myGroupIds } }] }],
      },
      select: { id: true, title: true, type: true, date: true },
      take: 6,
      orderBy: { date: "asc" },
    });
    for (const ev of events) {
      hits.push({
        type: "event",
        id: ev.id,
        title: ev.title,
        subtitle: ev.type === "EXAM" ? "رویداد امتحان" : "رویداد تقویم",
        link: "/calendar",
      });
    }

    /* ---------- بخش‌های ویژه کاربران واردشده (غیر GUEST) ---------- */
    if (canDeepSearch) {
      const ideas = await db.idea.findMany({
        where: {
          deletedAt: null,
          // ایده‌های در انتظار تایید فقط برای استاف دیده می‌شود
          ...(isStaff ? {} : { status: { not: "PENDING" } }),
          OR: orLike(["title", "description"]),
        },
        select: {
          id: true,
          title: true,
          status: true,
          author: { select: { name: true } },
        },
        take: 6,
        orderBy: { createdAt: "desc" },
      });
      for (const idea of ideas) {
        hits.push({
          type: "idea",
          id: idea.id,
          title: idea.title,
          subtitle: `ایده · ${idea.author.name}`,
          link: "/ideas",
        });
      }

      const polls = await db.poll.findMany({
        where: {
          deletedAt: null,
          OR: orLike(["title", "description"]),
        },
        select: { id: true, title: true, status: true },
        take: 6,
        orderBy: { createdAt: "desc" },
      });
      for (const p of polls) {
        hits.push({
          type: "poll",
          id: p.id,
          title: p.title,
          subtitle: p.status === "OPEN" ? "نظرسنجی باز" : "نظرسنجی بسته",
          link: "/polls",
        });
      }

      const users = await db.user.findMany({
        where: {
          deletedAt: null,
          ...(isStaff ? {} : { status: "ACTIVE" }),
          OR: orLike(["name", "username"]),
        },
        select: { id: true, name: true, username: true, role: true, avatar: true },
        take: 6,
        orderBy: { name: "asc" },
      });
      for (const u of users) {
        hits.push({
          type: "user",
          id: u.id,
          title: u.name,
          subtitle: `@${u.username}`,
          link: `/profile/${u.id}`,
        });
      }
    }

    return NextResponse.json({ results: hits });
  } catch (e) {
    return handleApiError(e);
  }
}
