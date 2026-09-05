/**
 * ربات روبیکا سیبک — سرویس مستقل (نسخهٔ پروداکشن)
 * ─────────────────────────────────────────────────────────
 * این فایل یک WRAPPER نازک است و «همان کد» رباتی را اجرا می‌کند که در
 * حالت لوکال داخل پروسس Next.js اجرا می‌شود (src/lib/rubika-bot.ts).
 * یعنی هیچ کپی دوباره‌ای وجود ندارد؛ یک منبع واحد منطق، دو نحوهٔ اجرا:
 *
 *   • لوکال/سندباکس → polling داخل پروسس Next.js (از طریق instrumentation.ts)
 *   • پروداکشن     → همین سرویس مستقل روی Render (یا هر هاست همیشه‌روشن)
 *
 * چرا سرویس مستقل لازم است؟
 *   روی Vercel توابع serverless بی‌پایان نیستند؛ حلقهٔ long-polling به‌محض
 *   آزادشدن instance منجمد می‌شود و ربات «بعد از دپلوی» می‌میرد. این سرویس
 *   یک پروسس Node/Bun همیشه‌روشن است که ۲۴/۷ به روبیکا گوش می‌دهد.
 *
 * متغیرهای محیطی:
 *   RUBIKA_BOT_TOKEN  → توکن ربات از BotFather روبیکا (الزامی)
 *   SIBAK_SITE_URL    → آدرس سایت Next.js (مثلاً https://sibak-site.vercel.app)
 *   PORT              → پورت health check (روی Render خودکار ست می‌شود؛ پیش‌فرض 3004)
 *
 * Health check: GET / یا /health یا /status → JSON وضعیت ربات
 *   (روی Render، Health Check Path را روی /health بگذارید)
 *
 * اجرا:  bun index.ts   (یا bun run start)
 */

import { createServer } from "node:http";

import { getRubikaBotStatus, startRubikaBot } from "../../src/lib/rubika-bot";

const PORT = Number(process.env.PORT ?? 3004);

// ۱) شروع ربات (polling واقعی به botapi.rubika.ir)
startRubikaBot();

// ۲) سرور سلامت — برای Render Health Check و مانیتورینگ دستی
const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/" || path === "/health" || path === "/status") {
    const body = JSON.stringify({
      ...getRubikaBotStatus(),
      service: "sibak-rubika-bot",
      runtime: "standalone",
    });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`[robika-bot] health endpoint روی پورت ${PORT} → GET /health`);
});
