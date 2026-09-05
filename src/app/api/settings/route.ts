import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { SiteRule, SiteSettings } from "@/lib/types";

/** قوانین پیش‌فرض سیبک — هنگام خالی بودن دیتابیس استفاده می‌شوند. */
const DEFAULT_RULES: SiteRule[] = [
  {
    title: "احترام متقابل، همیشه",
    body: "در سیبک همه با هم یاد می‌گیرند؛ نظر مخالف را با استدلال و ادب مطرح کنید، نه با تحقیر.",
  },
  {
    title: "شفافیت، ارز مشترک",
    body: "هر تصمیم جمعی، تغییر وضعیت و حذف محتوا در پرونده‌ها ثبت می‌شود؛ پشت پرده کاری در کار نیست.",
  },
  {
    title: "بدهکاری را جدی بگیر",
    body: "تعهد کوچک مثل «گزارش آزمایش» هم بدهی است؛ سر موعدش پس بده تا اعتماد از بین نرود.",
  },
  {
    title: "وتو، آخرین نه‌ی همیشگی",
    body: "وتو ابزار مسئولانه است، نه سلاح؛ هر استفاده از آن باید در دفتر وتوها قابل ردیابی باشد.",
  },
];

/** تجزیه‌ی امن قوانین ذخیره‌شده در دیتابیس (JSON string). */
function parseRules(raw: string | undefined): SiteRule[] {
  if (!raw) return DEFAULT_RULES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_RULES;
    const rules: SiteRule[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.title === "string" &&
        typeof item.body === "string"
      ) {
        rules.push({ title: item.title, body: item.body });
      }
    }
    return rules.length > 0 ? rules : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

export async function GET() {
  try {
    const rows = await db.setting.findMany({
      where: {
        key: {
          in: [
            "siteName",
            "siteTagline",
            "logo",
            "allowRegistration",
            "rubikaBot",
            "siteRules",
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const settings: SiteSettings = {
      siteName: map.get("siteName") ?? "سیبک",
      siteTagline: map.get("siteTagline") ?? "بستر همکاری درسی",
      logo: map.get("logo") ?? null,
      allowRegistration: (map.get("allowRegistration") ?? "true") !== "false",
      rubikaBot: map.get("rubikaBot") ?? "SibakBot",
      siteRules: parseRules(map.get("siteRules")),
    };
    return NextResponse.json(settings);
  } catch (e) {
    return handleApiError(e);
  }
}

const ruleSchema = z.object({
  title: z.string().trim().min(2, "عنوان قانون حداقل ۲ حرف باشد").max(80),
  body: z.string().trim().min(2, "متن قانون حداقل ۲ حرف باشد").max(500),
});

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "نام سایت را وارد کنید").max(60).optional(),
  siteTagline: z.string().trim().max(140).optional(),
  logo: z.string().max(2_000_000).nullable().optional(),
  allowRegistration: z.boolean().optional(),
  rubikaBot: z.string().trim().min(2, "یوزرنیم ربات را وارد کنید").max(40).optional(),
  siteRules: z.array(ruleSchema).max(50, "حداکثر ۵۰ قانون").optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = settingsSchema.parse(body);

    const entries: { key: string; value: string }[] = [];
    if (data.siteName !== undefined) entries.push({ key: "siteName", value: data.siteName });
    if (data.siteTagline !== undefined)
      entries.push({ key: "siteTagline", value: data.siteTagline });
    if (data.logo !== undefined)
      entries.push({ key: "logo", value: data.logo ?? "" });
    if (data.allowRegistration !== undefined)
      entries.push({ key: "allowRegistration", value: data.allowRegistration ? "true" : "false" });
    if (data.rubikaBot !== undefined)
      entries.push({ key: "rubikaBot", value: data.rubikaBot.replace(/^@/, "") });
    if (data.siteRules !== undefined)
      entries.push({ key: "siteRules", value: JSON.stringify(data.siteRules) });

    for (const entry of entries) {
      await db.setting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: entry,
      });
    }

    await logAudit({
      actorId: user.id,
      action: "SETTING_UPDATE",
      entityType: "SETTING",
      summary: "به‌روزرسانی تنظیمات سایت",
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
