# 🤖 راهنمای کامل ربات روبیکا سیبک (نسخه ۲ — معماری دوبخشی)

این سند توضیح می‌دهد ربات چطور کار می‌کند، **چرا بعد از دپلوی روی Vercel می‌مرد**، و چطور در پروداکشن درست راه‌اندازی می‌شود.

---

## 🧠 معماری جدید — یک منطق، دو حالت اجرا

منطق ربات **فقط یک‌جا** زندگی می‌کند: `src/lib/rubika-bot.ts`. هیچ کپی دوباره‌ای وجود ندارد.

| محیط | چه کسی polling می‌زند | کلید |
|------|----------------------|------|
| لوکال / سندباکس / VPS | پروسس Next.js (از طریق `instrumentation.ts`) | پیش‌فرض |
| پروداکشن (Vercel + Render) | سرویس مستقل `mini-services/robika-bot` روی Render | `RUBIKA_BOT_STANDALONE=true` در Vercel |

### ❌ چرا قبلاً «بعد دپلوی کار نمی‌کرد»؟

روی Vercel، هر request روی یک **تابع serverless لحظه‌ای** اجرا می‌شود. حلقهٔ `while(true)` داخل `instrumentation.ts` فقط تا پایان همان request زنده می‌ماند؛ بعدش instance منجمد/کشته می‌شود و ربات خاموش می‌شد — درحالی‌که لوکال (سرور Node دائمی) همیشه کار می‌کرد. راه‌حل: polling باید روی یک **پروسس همیشه‌روشن خارج از Vercel** اجرا شود (Render Web Service رایگان).

### ✅ معماری پروداکشن

```
┌──────────────────────┐        ┌──────────────────────┐
│  Vercel — سایت سیبک   │        │  Render — سرویس ربات  │
│  (Next.js serverless) │        │  (همیشه‌روشن 24/7)     │
│                       │        │                       │
│  RUBIKA_BOT_STANDALONE│        │  mini-services/       │
│  = true               │        │  robika-bot/index.ts  │
│  RUBIKA_BOT_URL=      │◄───────│  GET /health (status) │
│    https://...render  │ proxy  │                       │
└──────────┬────────────┘        └──────────┬────────────┘
           │                                │ long-polling
           │ HTTPS (SIBAK_SITE_URL)          │ botapi.rubika.ir
           ▼                                ▼
     APIهای سایت                        سرور روبیکا
   (/api/auth/*, /api/ideas...)      (getUpdates/sendMessage)
```

---

## 📋 فهرست

1. [ساختن ربات و گرفتن توکن](#گام-۱--ساختن-ربات-در-اپ-روبیکا)
2. [راه‌اندازی لوکال](#گام-۲--راه‌اندازی-لوکال)
3. [دپلوی سرویس ربات روی Render](#گام-۳--دپلوی-سرویس-ربات-روی-render)
4. [تنظیمات Vercel](#گام-۴--تنظیمات-vercel)
5. [تست نهایی](#گام-۵--تست-نهایی)
6. [لیست دستورات](#لیست-دستورات)
7. [رفع اشکال](#رفع-اشکال)

---

## گام ۱ — ساختن ربات در اپ روبیکا

1. در اپ روبیکا، **BotFather** را پیدا کنید (`rubika.ir/botfather`).
2. دستور `/newbot` را بزنید؛ نام و یوزرنیم (مثل `SibakBot`) بدهید.
3. توکن را کپی کنید (رشته‌ی حروف بزرگ انگلیسی؛ مثل `XXXXXXXX...`).
4. اگر توکن لو رفت: در BotFather → `/mybots` → ربات → **Revoke Token**.

> وضعیت فعلی: ربات **«سیبات»** با یوزرنیم **@SibakBot** ساخته شده و توکنش معتبر است (با getMe تأیید شد).

---

## گام ۲ — راه‌اندازی لوکال

در ریشهٔ پروژه، `.env` را پر کنید:

```env
RUBIKA_BOT_TOKEN=توکن-ربات-خود-را-اینجا-وارد-کنید
SIBAK_SITE_URL=http://localhost:3000
```

فقط `bun run dev` — ربات از طریق `instrumentation.ts` داخل پروسس Next.js بالا می‌آید. تأیید:

```bash
curl http://localhost:3000/api/rubika-bot/status
# باید connected: true و botUsername: "SibakBot" ببینید
```

> در لوکال سرویس `mini-services/robika-bot` را اجرا **نکنید** — دو poller همزمان آپدیت‌ها را می‌دزدند. آن سرویس فقط برای دپلوی است.

---

## گام ۳ — دپلوی سرویس ربات روی Render

1. پروژه را روی GitHub push کنید.
2. در [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → مخزن را انتخاب کنید.
3. تنظیمات:
   - **Root Directory:** `mini-services/robika-bot`
   - **Runtime:** Bun
   - **Build Command:** `bun install`
   - **Start Command:** `bun run start`
   - **Health Check Path:** `/health`
4. Environment Variables:
   - `RUBIKA_BOT_TOKEN` = توکن ربات
   - `SIBAK_SITE_URL` = `https://sibak-site.vercel.app` (آدرس واقعی سایت روی Vercel)
   - `PORT` — لازم نیست؛ Render خودش ست می‌کند.
5. **Create Web Service** → بعد از deploy باید `<service-url>/health` جواب بدهد.

> رایگان بودن Render کافی است؛ سرویس بعد از ۱۵ دقیقه بی‌ترافیکی می‌خوابد ولی polling خودش ترافیک دائمی تولید می‌کند، پس بیدار می‌ماند.

---

## گام ۴ — تنظیمات Vercel

در Vercel → پروژه سیبک → Settings → Environment Variables:

| کلید | مقدار | چرا |
|------|-------|-----|
| `RUBIKA_BOT_STANDALONE` | `true` | جلوگیری از polling بی‌فایده داخل serverless (باگ قدیمی) |
| `RUBIKA_BOT_URL` | `https://<your-bot-service>.onrender.com` | برای پروکسی status در پنل ادمین |
| `RUBIKA_BOT_TOKEN` | ❌ لازم نیست | فقط سرویس ربات به توکن نیاز دارد |

بعد از تغییر، **Redeploy** بزنید.

---

## گام ۵ — تست نهایی

1. `https://<bot-service>.onrender.com/health` → باید `connected: true` ببیند.
2. `https://<site>.vercel.app/api/rubika-bot/status` → همان وضعیت، پروکسی‌شده.
3. در روبیکا به `@SibakBot` بروید → `/start` → باید خوش‌آمد سیبک بیاید.
4. `/register ali mypass123` → ثبت‌نام → تأیید ادمین در سایت → `/login ali mypass123`.

---

## لیست دستورات

| دسته | دستورات |
|------|---------|
| 🔐 حساب | `/start` `/help` `/register <u> <p>` `/login <u> <p>` `/me` `/link` `/cancel` |
| 💡 ایده‌ها | `/ideas` `/newidea <title>` |
| 🗳 نظرسنجی‌ها | `/polls` `/vote <pollId> <yes\|no>` |
| 📅 تقویم | `/events` |
| 👥 گروه‌ها | `/groups` `/join <groupId>` |
| 💬 چت | `/chatlink` |
| 📣 پیام‌ها | `/announce` |
| 💰 بدهکاری | `/debts` |
| 🛡 وتوها | `/vetoes` |
| 🏆 برترین‌ها | `/leaderboard` |

---

## رفع اشکال

| مشکل | علت / راه‌حل |
|------|--------------|
| ربات لوکال جواب می‌دهد ولی بعد دپلوی نه | `RUBIKA_BOT_STANDALONE=true` در Vercel را نگذاشته‌اید، یا سرویس Render deploy نشده. `/health` سرویس Render را چک کنید. |
| `/health` سرویس Render خطای `توکن معتبر نیست` می‌دهد | `RUBIKA_BOT_TOKEN` در Environment Variables سرویس Render را چک کنید (بدون فاصله/کوتیشن). |
| دو ربات همزمان جواب می‌دهند / پیام‌ها نصفه می‌آیند | دو poller همزمان دارید (مثلاً سرویس Render + VPS). فقط یکی! |
| status روی سایت خطای 502 می‌دهد | `RUBIKA_BOT_URL` در Vercel اشتباه است یا سرویس Render خوابیده؛ `/health` مستقیم را بزنید. |
| کاربر `/login` می‌زند ولی ۴۰۱ می‌گیرد | کاربر هنوز در سایت تأیید نشده (ادمین پنل > کاربران) یا رمز اشتباه است. |
| پیام می‌رسد ولی پاسخ نمی‌آید | لاگ سرویس Render → اگر `✗ send failed` است، chat_id اشتباه یا توکن نامعتبر است. |

---

## 📞 کد

- منطق واحد ربات: `src/lib/rubika-bot.ts`
- wrapper دپلوی: `mini-services/robika-bot/index.ts`
- وضعیت در Next.js: `GET /api/rubika-bot/status`
