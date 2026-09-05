/**
 * ربات روبیکا سیبک — نسخهٔ ادغام‌شده در پروسس Next.js.
 *
 * این ماژول جایگزین mini-services/robika-bot/index.ts است. دلیل:
 *   - سندباکس هر پروسس بک‌گراوند جداگانه‌ای را بعد از ۳۰–۶۰ ثانیه می‌کشد.
 *   - فقط پروسس dev server خود Next.js (پورت ۳۰۰۰) که از boot شروع شده زنده می‌ماند.
 *   - پس polling ربات را داخل همان پروسس Next.js می‌چرانیم تا برای همیشه زنده بماند.
 *
 * این ماژول از طریق src/instrumentation.ts در زمان boot شدن Next.js
 * یک بار فراخوانی می‌شود (register hook) و تا زمان زنده بودن Next.js polling می‌زند.
 *
 * نحوه کار:
 *   - مستقیماً fetch می‌زنیم به https://botapi.rubika.ir/v3/{token}/{method}
 *   - بدون وابستگی به کتابخانهٔ rubika (کتابخانهrubika در polling خود باعث کرش خاموش process می‌شد)
 *   - offset و message_id‌های پردازش‌شده را در rubika-offset.json در ریشهٔ پروژه ذخیره می‌کنیم
 *   - هر ۳ ثانیه getUpdates می‌زنیم و پیام‌های جدید را dedup+process می‌کنیم
 *
 * رابطه با سایت:
 *   - همهٔ درخواست‌ها به ${SITE_URL}{path} می‌روند (مثل /api/auth/login).
 *   - احراز هویت با Bearer token (همان JWT که از /api/auth/login گرفته می‌شود).
 *   - هر کاربر ربات، توکن خودش را پس از /login در سایت می‌گیرد و در userSessions نگه‌داری می‌شود.
 *
 * مهم: این ماژول فقط در محیط Node.js اجرا می‌شود (instrumentation.ts فقط در NEXT_RUNTIME=nodejs صدا می‌زند).
 * هرگز به کلاینت import نمی‌شود.
 */

// NOTE: مستقیماً fetch می‌زنیم به botapi.rubika.ir — بدون وابستگی به کتابخانهٔ rubika
// (کتابخانهٔ rubika در polling خود باعث کرش خاموش process می‌شد)

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ───────── متغیرهای محیطی ─────────
const BOT_TOKEN = process.env.RUBIKA_BOT_TOKEN ?? "";
const SITE_URL = process.env.SIBAK_SITE_URL ?? "http://localhost:3000";

// ───────── URL پایهٔ API روبیکا ─────────
const RUBIKA_BASE = `https://botapi.rubika.ir/v3/${BOT_TOKEN}`;

// ───────── فایل offset (در ریشهٔ پروژه) ─────────
const OFFSET_FILE = join(process.cwd(), "rubika-offset.json");

// ───────── state سراسری ماژول (روی globalThis تا بین نمونه‌های dev-mode به‌اشتراک گذاشته شود) ─────────
// نکته مهم: Next.js dev mode (Turbopack) ممکن است این ماژول را در دو context مختلف load کند
// (یکی برای instrumentation.ts و یکی برای API route). برای اینکه وضعیت polling
// بین این دو نمونه به‌اشتراک گذاشته شود، state را روی globalThis نگه‌می‌داریم.
type RubikaState = {
  started: boolean;
  startTime: number;
  pollCount: number;
  connected: boolean;
  botTitle: string;
  botUsername: string;
  userSessions: Map<string, { token: string; username: string }>;
  processedMessageIds: Set<string>;
  currentOffset: string | undefined;
  lastPollAt: number;
  lastPollError: string | null;
};

const G = (globalThis as unknown as { __rubikaBotState?: RubikaState });
if (!G.__rubikaBotState) {
  G.__rubikaBotState = {
    started: false,
    startTime: 0,
    pollCount: 0,
    connected: false,
    botTitle: "Sibak Bot",
    botUsername: "SibakBot",
    userSessions: new Map<string, { token: string; username: string }>(),
    processedMessageIds: new Set<string>(),
    currentOffset: undefined,
    lastPollAt: 0,
    lastPollError: null,
  };
}
const state: RubikaState = G.__rubikaBotState;

// shortcuts برای استفاده در داخل ماژول
const userSessions = state.userSessions;
const processedMessageIds = state.processedMessageIds;

// ───────── helper مستقیم API روبیکا (بدون کتابخانه) ─────────
async function rubikaCall<T>(
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const url = `${RUBIKA_BASE}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[rubika-bot] ✗ ${method} HTTP ${res.status}`);
      return {
        status: "HTTP_ERROR",
        http_status: res.status,
      } as unknown as T;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(
      `[rubika-bot] ✗ ${method} network error:`,
      e instanceof Error ? e.message : e,
    );
    return { status: "NETWORK_ERROR", error: String(e) } as unknown as T;
  }
}

// ───────── offset (برای ادامه از جایی که قبلاً رسیدیم) ─────────
function loadOffset(): string | undefined {
  try {
    if (existsSync(OFFSET_FILE)) {
      const data = JSON.parse(readFileSync(OFFSET_FILE, "utf-8"));
      // بارگذاری message_id‌های پردازش‌شده از فایل
      if (Array.isArray(data.processed)) {
        for (const id of data.processed) {
          if (typeof id === "string") processedMessageIds.add(id);
        }
        console.log(
          `[rubika-bot] ${processedMessageIds.size} message_id پردازش‌شده بارگذاری شد`,
        );
      }
      return data.offset;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function saveOffset(offset: string): void {
  try {
    // ذخیرهٔ offset + ۲۰۰۰ message_id آخر (برای جلوگیری از رشد بی‌نهایت)
    const recentIds = Array.from(processedMessageIds).slice(-2000);
    writeFileSync(
      OFFSET_FILE,
      JSON.stringify({ offset, processed: recentIds }),
    );
  } catch {
    /* ignore */
  }
}

// ثبت message_id پردازش‌شده + سقف حافظه (Set ترتیب درج را نگه می‌دارد)
function rememberMessageId(msgId: string): void {
  processedMessageIds.add(msgId);
  if (processedMessageIds.size > 5000) {
    let toDelete = processedMessageIds.size - 4000;
    for (const id of processedMessageIds) {
      if (toDelete-- <= 0) break;
      processedMessageIds.delete(id);
    }
  }
}

// ───────── helper‌های HTTP به سایت ─────────
async function siteGet<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${SITE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`site ${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function sitePost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${SITE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "خطای ناشناخته" }));
    throw new Error(
      (data as { error?: string }).error ?? `status ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

// ───────── متون پاسخ (همه فارسی، با لحن سیبک) ─────────
// این متون به‌عنوان نمونه هستند — هر کدام بعد از زدن دستور به کاربر نمایش داده می‌شود.

function fmtIdeas(list: Array<{ title: string; status: string }>): string {
  const head = `💡 آخرین ایده‌ها (${String(list.length)} مورد)\n\n`;
  if (list.length === 0) return head + "(هیچ ایده‌ای هنوز ثبت نشده)";
  const body = list
    .slice(0, 5)
    .map((i, idx) => `${idx + 1}. ${i.title}\n   وضعیت: ${i.status}`)
    .join("\n\n");
  return head + body + "\n\nبرای دیدن همه و رأی دادن، توی سایت به /ideas برو.";
}

function fmtPolls(list: Array<{ title: string; id: string }>): string {
  const head = `🗳 نظرسنجی‌های باز (${String(list.length)} مورد)\n\n`;
  if (list.length === 0) return head + "(هیچ نظرسنجی باز نیست)";
  const body = list
    .slice(0, 5)
    .map((p, idx) => `${idx + 1}. ${p.title}\n   ID: ${p.id}\n   رأی: /vote ${p.id} yes`)
    .join("\n\n");
  return head + body;
}

function fmtEvents(list: Array<{ title: string; date: string; type: string }>): string {
  const head = `📅 رویدادهای پیش‌رو (${String(list.length)} مورد)\n\n`;
  if (list.length === 0) return head + "(هیچ رویدادی پیش‌رو نیست)";
  const body = list
    .slice(0, 5)
    .map((e, idx) => `${idx + 1}. ${e.title}\n   تاریخ: ${e.date} • نوع: ${e.type}`)
    .join("\n\n");
  return head + body;
}

function fmtGroups(list: Array<{ name: string; id: string; leader: string }>): string {
  const head = `👥 زیرمجموعه‌ها (${String(list.length)} گروه)\n\n`;
  if (list.length === 0) return head + "(هنوز هیچ گروهی ساخته نشده)";
  const body = list
    .slice(0, 8)
    .map((g, idx) => `${idx + 1}. ${g.name}\n   رهبر: ${g.leader}\n   عضویت: /join ${g.id}`)
    .join("\n\n");
  return head + body;
}

function fmtDebts(list: Array<{ title: string; amount: number; role: string }>): string {
  const head = `💰 بدهی‌های باز من (${String(list.length)} مورد)\n\n`;
  if (list.length === 0) return head + "(هیچ بدهی باز نداری) 🎉";
  const body = list
    .slice(0, 5)
    .map((d, idx) => `${idx + 1}. ${d.title}\n   مبلغ: ${d.amount} امتیاز • نقش: ${d.role}`)
    .join("\n\n");
  return head + body;
}

function fmtLeaderboard(list: Array<{ name: string; points: number }>): string {
  const head = `🏆 برترین‌ها\n\n`;
  if (list.length === 0) return head + "(هنوز کسی امتیاز نگرفته)";
  const body = list
    .slice(0, 10)
    .map((u, idx) => {
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
      return `${medal} ${u.name} — ${u.points} امتیاز`;
    })
    .join("\n");
  return head + body;
}

function fmtMe(
  name: string,
  username: string,
  role: string,
  points: number,
  vetoes: number,
): string {
  return (
    `👤 پروفایل من\n\n` +
    `نام: ${name}\n` +
    `یوزرنیم: @${username}\n` +
    `نقش: ${role}\n` +
    `امتیاز: ${points}\n` +
    `موجودی وتو: ${vetoes}\n\n` +
    `برای ویرایش، توی سایت به /profile برو.`
  );
}

function fmtLoginOk(name: string, points: number): string {
  return (
    `✅ وارد شدی، ${name}!\n\n` +
    `امتیاز فعلی: ${points}\n\n` +
    `حالا می‌تونی این دستورات رو بزنی:\n` +
    `/me — پروفایلت\n` +
    `/ideas — آخرین ایده‌ها\n` +
    `/polls — نظرسنجی‌های باز\n` +
    `/link — لینک ورود به سایت`
  );
}

function fmtVetoes(balance: number): string {
  return (
    `🛡 دفتر وتو\n\n` +
    `موجودی وتوی فعلی: ${balance}\n\n` +
    `وتوها در نظرسنجی‌های ویژه (VETO_GRANT) اعطا می‌شوند.\n` +
    `برای تاریخچه، توی سایت به /vetoes برو.`
  );
}

function fmtAnnounce(title: string, body: string): string {
  return (
    `📣 آخرین پیام همگانی\n\n` +
    `${title}\n\n` +
    `${body}\n\n` +
    `برای دیدن همهٔ پیام‌ها، توی سایت به /announcements برو.`
  );
}

const TXT = {
  start:
    `🍎 سلام به سیبک خوش آمدی!\n\n` +
    `سیبک بستر همکاری درسیه — ایده‌ها، نظرسنجی‌ها، تقویم، گروه‌ها، چت زنده، بدهکاری مودبانه و وتوها، همه این‌جا.\n\n` +
    `برای شروع:\n` +
    `۱. در سایت ثبت‌نام کن: /register <username> <password>\n` +
    `۲. وارد شو: /login <username> <password>\n` +
    `۳. بعد از تأیید ادمین، می‌تونی همه‌ی امکانات رو استفاده کنی.\n\n` +
    `👇 یا دکمهٔ زیر رو بزن:\n\n` +
    `📋 /help — همهٔ دستورات`,

  help:
    `📋 دستورات سیبک\n\n` +
    `🔐 حساب:\n` +
    `/start — خوش‌آمدگویی\n` +
    `/register <u> <p> — ثبت‌نام در سایت\n` +
    `/login <u> <p> — ورود به سایت\n` +
    `/me — پروفایل من\n` +
    `/link — لینک جادویی ورود به سایت\n\n` +
    `💡 ایده‌ها:\n` +
    `/ideas — آخرین ایده‌ها\n` +
    `/newidea <title> — ثبت ایدهٔ جدید\n\n` +
    `🗳 نظرسنجی‌ها:\n` +
    `/polls — نظرسنجی‌های باز\n` +
    `/vote <pollId> <yes|no> — رأی دادن\n\n` +
    `📅 تقویم:\n` +
    `/events — رویدادهای پیش‌رو\n\n` +
    `👥 گروه‌ها:\n` +
    `/groups — لیست زیرمجموعه‌ها\n` +
    `/join <groupId> — عضویت در گروه\n\n` +
    `💬 چت:\n` +
    `/chatlink — لینک ورود به چت سایت\n\n` +
    `📣 پیام‌ها:\n` +
    `/announce — آخرین پیام همگانی\n\n` +
    `💰 بدهکاری:\n` +
    `/debts — بدهی‌های باز من\n\n` +
    `🛡 وتوها:\n` +
    `/vetoes — موجودی وتوی من\n\n` +
    `🏆 برترین‌ها:\n` +
    `/leaderboard — جدول امتیازات\n\n` +
    `❓ راهنما:\n` +
    `/help — همین لیست\n` +
    `/cancel — لغو عملیات جاری`,

  registerOk:
    `✅ ثبت‌نامت انجام شد!\n\n` +
    `با ثبت‌نام، قوانین سیبک را هم پذیرفته‌ای (در صفحهٔ اول سایت قابل مشاهده‌اند).\n\n` +
    `پس از تأیید ادمین سایت (معمولاً کمتر از ۲۴ ساعت)، می‌تونی وارد بشوی:\n` +
    `/login <username> <password>\n\n` +
    `اگه سوالی داشتی، /help رو بزن.`,

  registerFail:
    `❌ ثبت‌نام ناموفق بود.\n\n` +
    `ممکنه:\n` +
    `- یوزرنیم قبلاً گرفته شده باشه — یکی دیگه انتخاب کن.\n` +
    `- پسورد خیلی کوتاه باشه (حداقل ۶ حرف).\n` +
    `- فرمت دستور اشتباه باشه.\n\n` +
    `✅ مثال درست:\n` +
    `/register ali_salehi mySecret123`,

  loginOk: fmtLoginOk,
  loginFail:
    `❌ ورود ناموفق بود.\n\n` +
    `اگه هنوز ثبت‌نام نکردی: /register <u> <p>\n` +
    `اگه منتظر تأیید ادمینی: صبر کن، ادمین خبر می‌کنه.\n` +
    `اگه پسورد رو فراموش کردی، به ادمین پیام بده.`,

  me: fmtMe,

  notLoggedIn:
    `🔒 هنوز وارد نشدی!\n\n` +
    `اول: /login <username> <password>\n\n` +
    `اگه ثبت‌نام نکردی: /register <username> <password>`,

  ideas: fmtIdeas,

  newIdeaOk:
    `✅ ایده‌ات ثبت شد!\n\n` +
    `منتظر رأی‌گیری بمان. وقتی تأیید شد، توی سایت به /ideas می‌تونی ببینیش.`,

  polls: fmtPolls,

  voteOk: `✅ رأیت ثبت شد!\n\nمی‌تونی نتیجهٔ نهایی رو توی سایت ببینی: /polls`,

  events: fmtEvents,

  groups: fmtGroups,

  joinOk: `✅ درخواست عضویتت ثبت شد!\n\nمنتظر تأیید رهبر گروه بمان.`,

  announce: fmtAnnounce,

  announceEmpty:
    `📣 پیام همگانی فعلی نیست.\n\n` +
    `برای دیدن همهٔ پیام‌های قبلی، توی سایت به /announcements برو.`,

  debts: fmtDebts,

  vetoes: fmtVetoes,

  leaderboard: fmtLeaderboard,

  link: (link: string) =>
    `🔗 لینک جادویی ورود به سایت\n\n${link}\n\nاین لینک فقط ۱۰ دقیقه معتبره. اگه منقضی شد، دوباره /link رو بزن.`,

  unknown: `🤔 این دستور رو نشناسم.\n\nبرای دیدن همهٔ دستورات: /help`,

  cancel: `❌ عملیات لغو شد.`,

  adminOnly: `🔒 این دستور فقط برای ادمین‌هاست.`,
};

// ───────── handler اصلی هر پیام از روبیکا ─────────
async function handleMessage(chatId: string, text: string) {
  // فقط متن را پردازش می‌کنیم (media/page/voice را نادیده می‌گیریم)
  if (!text || !text.startsWith("/")) {
    return;
  }

  const [cmd, ...args] = text.trim().split(/\s+/);
  const command = cmd.toLowerCase();

  // نشست کاربر
  const session = userSessions.get(chatId);

  try {
    switch (command) {
      case "/start":
        await sendText(chatId, TXT.start);
        break;

      case "/help":
        await sendText(chatId, TXT.help);
        break;

      case "/cancel":
        await sendText(chatId, TXT.cancel);
        break;

      case "/register": {
        const [username, password] = args;
        if (!username || !password) {
          await sendText(chatId, "❌ فرمت: /register <username> <password>");
          return;
        }
        try {
          await sitePost("/api/auth/register", { username, password, acceptedRules: true });
          await sendText(chatId, TXT.registerOk);
        } catch (e) {
          await sendText(
            chatId,
            `${TXT.registerFail}\n\nجزئیات: ${e instanceof Error ? e.message : ""}`,
          );
        }
        break;
      }

      case "/login": {
        const [username, password] = args;
        if (!username || !password) {
          await sendText(chatId, "❌ فرمت: /login <username> <password>");
          return;
        }
        try {
          const res = await sitePost<{ user: { name: string; points: number }; token: string }>(
            "/api/auth/login",
            { identifier: username, password },
          );
          userSessions.set(chatId, {
            token: res.token,
            username,
          });
          await sendText(chatId, TXT.loginOk(res.user.name, res.user.points));
        } catch (e) {
          await sendText(
            chatId,
            `${TXT.loginFail}\n\nجزئیات: ${e instanceof Error ? e.message : ""}`,
          );
        }
        break;
      }

      case "/me": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const me = await siteGet<{ user: { name: string; username: string; role: string; points: number } }>(
          "/api/auth/me",
          session.token,
        );
        // موجودی وتو از دفتر جدا
        let vetoBalance = 0;
        try {
          const v = await siteGet<{ balance: number }>("/api/vetoes", session.token);
          vetoBalance = v.balance;
        } catch {
          /* بی‌اهمیت */
        }
        await sendText(
          chatId,
          TXT.me(me.user.name, me.user.username, me.user.role, me.user.points, vetoBalance),
        );
        break;
      }

      case "/ideas": {
        const data = await siteGet<{ ideas: { id: string; title: string; status: string }[] }>(
          "/api/ideas?sort=top&status=APPROVED",
          session?.token,
        );
        await sendText(chatId, TXT.ideas(data.ideas));
        break;
      }

      case "/newidea": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const title = args.join(" ");
        if (!title) {
          await sendText(chatId, "❌ فرمت: /newidea <title>");
          return;
        }
        await sitePost("/api/ideas", { title, description: "", groupId: null }, session.token);
        await sendText(chatId, TXT.newIdeaOk);
        break;
      }

      case "/polls": {
        const data = await siteGet<{ polls: { id: string; title: string }[] }>(
          "/api/polls?status=OPEN",
          session?.token,
        );
        await sendText(chatId, TXT.polls(data.polls));
        break;
      }

      case "/vote": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const [pollId, choice] = args;
        if (!pollId || !choice) {
          await sendText(chatId, "❌ فرمت: /vote <pollId> <yes|no>");
          return;
        }
        await sitePost(`/api/polls/${pollId}/vote`, { optionText: choice === "yes" ? "بله" : "خیر" }, session.token);
        await sendText(chatId, TXT.voteOk);
        break;
      }

      case "/events": {
        const data = await siteGet<{ events: { id: string; title: string; date: string; type: string }[] }>(
          "/api/events?upcoming=1",
          session?.token,
        );
        await sendText(chatId, TXT.events(data.events));
        break;
      }

      case "/groups": {
        const data = await siteGet<{ groups: { id: string; name: string; leader: { name: string } | null }[] }>(
          "/api/meta/groups",
          session?.token,
        );
        await sendText(
          chatId,
          TXT.groups(
            data.groups.map((g) => ({
              name: g.name,
              id: g.id,
              leader: g.leader?.name ?? "—",
            })),
          ),
        );
        break;
      }

      case "/join": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const [groupId] = args;
        if (!groupId) {
          await sendText(chatId, "❌ فرمت: /join <groupId>");
          return;
        }
        await sitePost(`/api/groups/${groupId}/join`, {}, session.token);
        await sendText(chatId, TXT.joinOk);
        break;
      }

      case "/announce": {
        const data = await siteGet<{ announcement: { title: string; body: string } | null }>(
          "/api/announcements?banner=1",
          session?.token,
        );
        if (!data.announcement) {
          await sendText(chatId, TXT.announceEmpty);
        } else {
          await sendText(chatId, TXT.announce(data.announcement.title, data.announcement.body));
        }
        break;
      }

      case "/debts": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const data = await siteGet<{
          debts: { id: string; title: string; amount: number; myRole: string }[];
        }>("/api/debts", session.token);
        await sendText(
          chatId,
          TXT.debts(
            data.debts.map((d) => ({
              title: d.title,
              amount: d.amount,
              role: d.myRole,
            })),
          ),
        );
        break;
      }

      case "/vetoes": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        const data = await siteGet<{ balance: number }>("/api/vetoes", session.token);
        await sendText(chatId, TXT.vetoes(data.balance));
        break;
      }

      case "/leaderboard": {
        const data = await siteGet<{ leaderboard: { user: { name: string }; points: number }[] }>(
          "/api/leaderboard?period=all",
          session?.token,
        );
        await sendText(
          chatId,
          TXT.leaderboard(
            data.leaderboard.map((e) => ({
              name: e.user.name,
              points: e.points,
            })),
          ),
        );
        break;
      }

      case "/chatlink": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        await sendText(
          chatId,
          `💬 چت زندهٔ سیبک:\n\n${SITE_URL.replace(/\/$/, "")}/#/chat\n\n` +
            `اگر داخل سایت وارد نشده باشی، اول /login <u> <p> رو بزن.`,
        );
        break;
      }

      case "/link": {
        if (!session) {
          await sendText(chatId, TXT.notLoggedIn);
          return;
        }
        // تولید لینک جادویی: فرض بر این است که سایت این قابلیت دارد.
        // اگر ندارد، کاربر می‌تواند با username/password در سایت وارد شود.
        await sendText(chatId, TXT.link(`${SITE_URL.replace(/\/$/, "")}/#/login`));
        break;
      }

      default:
        await sendText(chatId, TXT.unknown);
    }
  } catch (e) {
    await sendText(
      chatId,
      `⚠️ خطا در اجرای دستور.\n\n${e instanceof Error ? e.message : "نامشخص"}\n\nاگه تکرار شد، /help رو بزن.`,
    );
  }
}

// ───────── ارسال پیام به روبیکا (مستقیم با fetch) ─────────
async function sendText(chatId: string, text: string) {
  if (!BOT_TOKEN) {
    console.log(`[rubika-bot][dry-run] → ${chatId}:\n${text}`);
    return;
  }
  try {
    const res = await rubikaCall<{ status: string; data?: { message_id: string } }>(
      "sendMessage",
      { chat_id: chatId, text },
    );
    if (res.status === "OK" && res.data?.message_id) {
      console.log(`[rubika-bot] ✓ sent → ${chatId}: ${text.slice(0, 60)}...`);
    } else {
      console.error(`[rubika-bot] ✗ sendMessage failed → ${chatId}: status=${res.status}`);
    }
  } catch (e) {
    console.error(`[rubika-bot] ✗ send error → ${chatId}:`, e instanceof Error ? e.message : e);
  }
}

// ───────── حلقهٔ polling مستقیم ─────────
// هر ۳ ثانیه یک‌بار getUpdates را صدا می‌زنیم. اگر پیام جدید بود،
// handleMessage را صدا می‌زنیم. offset را به‌روز می‌کنیم.
// همه‌چیز در try/catch — هرگز نباید پروسس Next.js را کرش کند.
async function pollLoop() {
  console.log("[rubika-bot] 🔄 حلقهٔ polling شروع شد. صبر برای پیام‌ها...");

  while (true) {
    try {
      state.pollCount++;

      const res = await rubikaCall<{
        status: string;
        data?: {
          updates?: Array<{
            type: string;
            chat_id: string;
            new_message?: { text?: string; sender_id?: string; message_id?: string };
            update_time: number;
          }>;
          next_offset_id?: string;
        };
      }>("getUpdates", { offset: state.currentOffset, limit: 100 });

      if (res.status === "OK" && res.data?.updates && res.data.updates.length > 0) {
        let newCount = 0;
        for (const u of res.data.updates) {
          // dedup برای «همهٔ» آپدیت‌ها (متنی و غیرمتنی) — وگرنه آپدیت مدیا هر ۳ ثانیه دوباره می‌آید
          const msgId = u.new_message?.message_id ?? "";
          if (msgId && processedMessageIds.has(msgId)) continue;
          if (msgId) rememberMessageId(msgId);

          // فقط پیام‌های متنی را پاسخ می‌دهیم (media/page/voice نادیده)
          if (u.type !== "NewMessage" || !u.new_message?.text) continue;

          const chatId = u.chat_id;
          const text = u.new_message.text ?? "";
          const senderId = u.new_message.sender_id ?? "?";
          console.log(`[rubika-bot] ← ${chatId} (sender=${senderId}): ${text.slice(0, 80)}`);
          newCount++;
          try {
            await handleMessage(chatId, text);
          } catch (e) {
            console.error(`[rubika-bot] handler error:`, e instanceof Error ? e.message : e);
          }
        }
        // offset را بعد از پردازش «کل» batch پیش ببر — حتی اگر batch فقط
        // آپدیت غیرمتنی داشت (وگرنه همان batch تا ابد تکرار می‌شود)
        if (res.data.next_offset_id) {
          state.currentOffset = res.data.next_offset_id;
          saveOffset(state.currentOffset);
        }
      }
      // poll موفق — وضعیت سلامت را ثبت کن
      state.lastPollAt = Date.now();
      state.lastPollError = null;
    } catch (e) {
      // هرگز نباید پروسس Next.js را کرش کند — فقط لاگ
      const msg = e instanceof Error ? e.message : String(e);
      state.lastPollError = msg;
      console.error(`[rubika-bot] polling error:`, msg);
    }
    // ۳ ثانیه صبر قبل از دور بعد
    await new Promise((r) => setTimeout(r, 3000));
  }
}

// ───────── راه‌اندازی ربات (idempotent — امن برای فراخوانی چندباره) ─────────
export function startRubikaBot(): void {
  if (state.started) return;
  if (!BOT_TOKEN) {
    console.warn(
      "[rubika-bot] ⚠️  RUBIKA_BOT_TOKEN تنظیم نشده — startRubikaBot در حالت dry-run اجرا شد ولی polling واقعی انجام نمی‌شود.",
    );
    state.started = true;
    state.startTime = Date.now();
    return;
  }

  state.started = true;
  state.startTime = Date.now();
  state.connected = false;

  console.log("[rubika-bot] سرویس ربات روبیکا سیبک (ادغام‌شده در Next.js) در حال راه‌اندازی...");
  console.log(`[rubika-bot] SITE_URL = ${SITE_URL}`);
  console.log("[rubika-bot] BOT_TOKEN = (تنظیم‌شده ✓)");

  // اعتبارسنجی توکن با getMe و سپس شروع polling — به‌صورت غیرهمزمان (بدون بلاکه‌کردن boot)
  void (async () => {
    try {
      console.log("[rubika-bot] در حال اعتبارسنجی توکن با getMe...");
      const me = await rubikaCall<{
        status: string;
        data?: { bot?: { bot_title: string; username: string } };
      }>("getMe");
      if (me.status === "OK" && me.data?.bot) {
        state.connected = true;
        state.botTitle = me.data.bot.bot_title || state.botTitle;
        state.botUsername = me.data.bot.username || state.botUsername;
        console.log(
          `[rubika-bot] ✓ توکن معتبر — ربات: "${state.botTitle}" (@${state.botUsername})`,
        );
      } else {
        console.error(
          `[rubika-bot] ✗ توکن نامعتبر یا getMe ناموفق. status=${me.status}`,
        );
        console.error("[rubika-bot] ربات در حالت گوش‌دادن ادامه می‌دهد، ولی ممکن است کار نکند.");
      }
    } catch (e) {
      console.error(
        "[rubika-bot] ✗ خطا در getMe:",
        e instanceof Error ? e.message : e,
      );
    }

    try {
      // اولین getUpdates برای گرفتن offset آخرین پیام (رد کردن پیام‌های قدیمی)
      state.currentOffset = loadOffset();
      if (!state.currentOffset) {
        console.log(
          "[rubika-bot] offset قبلی پیدا نشد — همهٔ پیام‌های قدیمی را علامت می‌زنیم (بدون پاسخ)...",
        );
        const first = await rubikaCall<{
          status: string;
          data?: {
            updates?: Array<{ new_message?: { message_id?: string } }>;
            next_offset_id?: string;
          };
        }>("getUpdates", { limit: 100 });
        if (first.status === "OK" && first.data) {
          // همهٔ message_id‌های قدیمی را به‌عنوان پردازش‌شده علامت بزن — بدون پاسخ دادن
          let oldCount = 0;
          for (const u of first.data.updates ?? []) {
            const msgId = u.new_message?.message_id;
            if (msgId) {
              processedMessageIds.add(msgId);
              oldCount++;
            }
          }
          if (first.data.next_offset_id) {
            state.currentOffset = first.data.next_offset_id;
            saveOffset(state.currentOffset);
            console.log(
              `[rubika-bot] ✓ ${oldCount} پیام قدیمی علامت خورده (بدون پاسخ). offset: ${state.currentOffset.slice(0, 12)}...`,
            );
          }
        }
      } else {
        console.log(
          `[rubika-bot] ✓ offset قبلی بارگذاری شد: ${state.currentOffset.slice(0, 12)}...`,
        );
      }
    } catch (e) {
      console.error(
        "[rubika-bot] ✗ خطا در setup اولیهٔ offset:",
        e instanceof Error ? e.message : e,
      );
    }

    console.log("[rubika-bot] ✅ ربات به روبیکا وصل شد (Long-Polling مستقیم در پروسس Next.js).");
    // شروع حلقهٔ polling — بدون بلاکه‌کردن boot
    pollLoop().catch((e) =>
      console.error("[rubika-bot] pollLoop fatal (caught, not crashing):", e),
    );
  })();
}

// ───────── وضعیت ربات برای API route ─────────
export function getRubikaBotStatus() {
  return {
    ok: true,
    started: state.started,
    connected: state.connected,
    mode: BOT_TOKEN ? "polling" : "dry-run",
    tokenSet: !!BOT_TOKEN,
    botName: state.botTitle,
    botUsername: state.botUsername,
    uptime: state.started ? Math.round((Date.now() - state.startTime) / 1000) : 0,
    pollCount: state.pollCount,
    processedCount: state.processedMessageIds.size,
    sessionsCount: state.userSessions.size,
    offsetSet: !!state.currentOffset,
    lastPollAt: state.lastPollAt || null,
    lastPollAgoSec: state.lastPollAt ? Math.round((Date.now() - state.lastPollAt) / 1000) : null,
    lastPollError: state.lastPollError,
    siteUrl: SITE_URL,
  };
}

// ───────── هندلرهای سراسری برای جلوگیری از کرش خاموش ─────────
// حتی اگر یک‌جا promise رد‌نکرده تولید شود، فقط لاگ می‌زنیم — بدون خروج از process.
// (فقط یک‌بار ثبت می‌شوند تا در dev mode با hot reload چندباره ثبت نشوند)
const GLOBAL_HOOK = (globalThis as unknown as { __rubikaBotHooksInstalled?: boolean });
if (!GLOBAL_HOOK.__rubikaBotHooksInstalled) {
  GLOBAL_HOOK.__rubikaBotHooksInstalled = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[rubika-bot] ⚠️  unhandledRejection (caught, not crashing):");
    console.error("  ", reason instanceof Error ? reason.message : reason);
    if (reason instanceof Error && reason.stack) {
      console.error("  stack:", reason.stack.split("\n").slice(0, 4).join("\n  "));
    }
  });

  process.on("uncaughtException", (err) => {
    console.error("[rubika-bot] ⚠️  uncaughtException (caught, not crashing):");
    console.error("  ", err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
      console.error("  stack:", err.stack.split("\n").slice(0, 4).join("\n  "));
    }
  });
}
