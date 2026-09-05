/**
 * Next.js Instrumentation Hook
 *
 * This runs ONCE when the Next.js server starts (in nodejs runtime).
 * We use it to start the Rubika bot polling loop INSIDE the Next.js process,
 * so the polling survives as long as the Next.js dev server survives
 * (the sandbox kills every other background process after ~30-60s).
 *
 * ⚠️ مهم — معماری دو حالتهٔ ربات:
 *
 *   حالت A (پیش‌فرض / لوکال / VPS): RUBIKA_BOT_STANDALONE تنظیم نیست
 *     → polling داخل همین پروسس Next.js اجرا می‌شود (برای سندباکس لازم است).
 *
 *   حالت B (پروداکشن روی Vercel): RUBIKA_BOT_STANDALONE=true
 *     → polling درون‌پروسسی خاموش می‌شود چون توابع serverless بی‌پایان نیستند
 *       و حلقهٔ while(true) به‌محض آزادشدن instance منجمد/کشته می‌شود
 *       (این دقیقاً همان باگی بود که «ربات بعد از دپلوی کار نمی‌کرد»).
 *     → در این حالت سرویس مستقل mini-services/robika-bot روی Render
 *       (یا هر هاست همیشه‌روشن) polling را انجام می‌دهد و Next.js فقط
 *       از طریق /api/rubika-bot/status وضعیت آن را پروکسی می‌کند.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // حالت B — پروداکشن serverless: polling مال سرویس مستقل است، نه این پروسس
    if (process.env.RUBIKA_BOT_STANDALONE === "true") {
      console.log(
        "[instrumentation] RUBIKA_BOT_STANDALONE=true → in-process Rubika polling DISABLED (the standalone bot service owns polling)",
      );
    } else {
      try {
        const { startRubikaBot } = await import("./lib/rubika-bot");
        startRubikaBot();
        console.log("[instrumentation] Rubika bot polling started inside Next.js process");
      } catch (e) {
        // Never let instrumentation failure kill the Next.js boot
        console.error("[instrumentation] Failed to start Rubika bot:", e instanceof Error ? e.message : e);
      }
    }

    // ---------- سرویس چت (WebSocket) ----------
    // همین منطق دو حالته: در سندباکس/لوکال داخل همین پروسس بالا می‌آید تا
    // پیش‌نمایش کاربر همیشه چت زنده داشته باشد؛ در پروداکشن serverless
    // (CHAT_STANDALONE=true) سرویس مستقل روی Render مالک پورت است.
    if (process.env.CHAT_STANDALONE === "true") {
      console.log(
        "[instrumentation] CHAT_STANDALONE=true → in-process chat server DISABLED (standalone chat service owns the port)",
      );
    } else {
      try {
        const { startChatServer } = await import("./lib/chat-server");
        startChatServer();
        console.log("[instrumentation] Chat server started inside Next.js process");
      } catch (e) {
        console.error("[instrumentation] Failed to start chat server:", e instanceof Error ? e.message : e);
      }
    }
  }
}
