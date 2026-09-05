/**
 * Seed سیبک — نسخهٔ تمیز و واقعی.
 * اجرا: bun prisma/seed.ts
 * این اسکریپت دترمینیستیك است: ابتدا همه جداول را پاک و سپس دوباره پر می‌کند.
 *
 * فقط دادهٔ حداقل لازم برای راه‌اندازی:
 *  - تنظیمات سایت (نام، شعار، سیاست ثبت‌نام، ربات روبیکا)
 *  - یک ادمین با نام کاربری و رمز پیچیده
 *  - تعاریف نشان‌ها (۶ تعریف ثابت سیستم)
 *
 * هیچ کاربر دمویی، گروه/ایده/نظرسنجی/بدهی/رویداد/پیام دمویی ساخته نمی‌شود.
 * دادهٔ واقعی از طریق اپلیکیشن (ثبت‌نام + تأیید ادمین + پنل مدیریت) اضافه می‌شود.
 */
import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";

// ============================================================
// اعتبارنامهٔ ادمین پیش‌فرض — پیچیده و امن.
// ادمین پس از اولین ورود می‌تواند رمز خود را از پروفایل تغییر دهد.
// ============================================================
const ADMIN_USERNAME = "sibakadmin";
const ADMIN_PASSWORD = "Sib@k!Adm1403";

async function main() {
  console.log("🌱 شروع Seed سیبک (نسخهٔ تمیز)…");

  // ---------- پاک‌سازی کامل (ترتیب FK-امن) ----------
  await db.$transaction([
    db.userBadge.deleteMany(),
    db.badge.deleteMany(),
    db.pointLog.deleteMany(),
    db.auditLog.deleteMany(),
    db.notification.deleteMany(),
    db.announcement.deleteMany(),
    db.debtVisibility.deleteMany(),
    db.debtEvent.deleteMany(),
    db.debt.deleteMany(),
    db.vetoLedger.deleteMany(),
    db.pollVote.deleteMany(),
    db.pollOption.deleteMany(),
    db.poll.deleteMany(),
    db.calendarEvent.deleteMany(),
    db.comment.deleteMany(),
    db.ideaVote.deleteMany(),
    db.idea.deleteMany(),
    db.groupMember.deleteMany(),
    db.group.deleteMany(),
    db.setting.deleteMany(),
    db.user.deleteMany(),
  ]);

  // ---------- تنظیمات سایت ----------
  await db.setting.createMany({
    data: [
      { key: "siteName", value: "سیبک" },
      {
        key: "siteTagline",
        value: "بستری برای هم‌فکری و هم‌کاری",
      },
      { key: "allowRegistration", value: "true" },
      { key: "rubikaBot", value: "SibakBot" },
    ],
  });

  // ---------- ادمین ----------
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await db.user.create({
    data: {
      name: "ادمین سیبک",
      username: ADMIN_USERNAME,
      password: passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      bio: "نگهبان باغ سیبک؛ مسئول تأیید اعضا و سلامت فضای هم‌فکری.",
      skills: "مدیریت تیم، برنامه‌ریزی، حل تعارض",
      avatar: "🛡️",
      points: 0,
      lastLoginAt: null,
      createdAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_INIT",
      entityType: "SYSTEM",
      summary: "راه‌اندازی اولیهٔ سیبک با ادمین پیش‌فرض",
    },
  });

  // ---------- تعاریف نشان‌ها (۶ تعریف ثابت) ----------
  await Promise.all([
    db.badge.create({
      data: {
        key: "idea-maker",
        name: "ایده‌پرداز",
        description: "برای کسانی که ایده‌های تأییدشده ثبت کرده‌اند.",
        icon: "💡",
        color: "amber",
      },
    }),
    db.badge.create({
      data: {
        key: "helper",
        name: "همکار نمونه",
        description: "کمک واقعی و مستمر به بقیه اعضا.",
        icon: "🤝",
        color: "emerald",
      },
    }),
    db.badge.create({
      data: {
        key: "veto-holder",
        name: "وتو دار",
        description: "دارندهٔ اختیار وتو در تصمیم‌های جمعی.",
        icon: "🛡",
        color: "rose",
      },
    }),
    db.badge.create({
      data: {
        key: "loyal-debtor",
        name: "بدهکار وفادار",
        description: "تسویهٔ به‌موقع بدهکاری‌های ثبت‌شده.",
        icon: "⚖️",
        color: "orange",
      },
    }),
    db.badge.create({
      data: {
        key: "active-member",
        name: "عضو فعال",
        description: "حضور و فعالیت مستمر در فضای هم‌کاری.",
        icon: "🔥",
        color: "teal",
      },
    }),
    db.badge.create({
      data: {
        key: "sibak-star",
        name: "ستاره سیبک",
        description: "بالاترین سطح اعتبار در سیبک.",
        icon: "🌟",
        color: "emerald",
      },
    }),
  ]);

  console.log("✅ Seed سیبک کامل شد.");
  console.log(`   ادمین: @${ADMIN_USERNAME} / ${ADMIN_PASSWORD.replace(/./g, "•")}`);
  console.log("   (رمز واقعی در کد seed یا متغیر محیطی)");
}

main()
  .catch((e) => {
    console.error("❌ Seed شکست خورد:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
