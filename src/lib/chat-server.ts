/**
 * سرویس چت سیبک — نسخهٔ درون‌پروسسی (DB-backed)
 *
 * چرا داخل پروسس Next.js؟ سندباکس هر پروسس پس‌زمینه را بعد از پایان اجرا
 * می‌کُشد؛ فقط پروسس Next.js زنده می‌ماند (پیش‌نمایش کاربر). همان الگوی
 * اثبات‌شدهٔ ربات روبیکا: startChatServer از instrumentation.ts صدا زده می‌شود.
 *
 * در پروداکشن (Vercel): CHAT_STANDALONE=true → این سرور استارت نمی‌شود و
 * سرویس مستقل mini-services/chat-service روی Render مالک پورت است.
 *
 * تفاوت با نسخهٔ مستقل: این نسخه تاریخچهٔ اتاق‌ها/پیام‌ها را در SQLite
 * (Prisma) می‌نویسد — با ری‌استارت هیچ‌چیز از دست نمی‌رود.
 *
 * ایمنی:
 *  - احراز هویت JWT (HS256، issuer=sibak، همان AUTH_SECRET با auth.ts)
 *  - نقش GUEST اجازهٔ اتصال ندارد
 *  - عضویت اتاق در DB چک می‌شود (پیام فقط برای اعضا)
 *  - room:created فقط به اعضا می‌رود (نه broadcast به همه)
 */

import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { jwtVerify } from "jose";

import { db } from "./db";
import { checkUploadQuota, recordRgFile } from "./resource-guard";
import { RgError } from "./rg-types";

const PORT = Number(process.env.CHAT_PORT ?? 3003);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const HISTORY_LIMIT = 50;
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "sibak-dev-secret-key-change-me";

interface UserProfile {
  userId: string;
  username: string;
  name: string;
  avatar: string | null;
  role: string;
}

interface ChatMsg {
  id: string;
  roomId: string;
  author: UserProfile;
  type: "text" | "file";
  text?: string;
  file?: { name: string; size: number; mime: string; dataUrl: string };
  createdAt: string;
}

interface ChatRoomSummary {
  id: string;
  name: string | null;
  kind: "dm" | "group";
  members: UserProfile[];
}

const socketsByUser = new Map<string, Set<string>>();
let started = false;

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  avatar: true,
  role: true,
} as const;

function toProfile(u: {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  role: string;
}): UserProfile {
  return {
    userId: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
  };
}

function dmRoomId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `dm:${x}__${y}`;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** پروفایل آنلاین‌ها — از DB با idها */
async function onlineProfiles(): Promise<UserProfile[]> {
  const ids = Array.from(socketsByUser.keys());
  if (ids.length === 0) return [];
  const rows = await db.user.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: USER_SELECT,
  });
  return rows.map(toProfile);
}

async function broadcastPresence(io: Server) {
  const online = await onlineProfiles();
  io.emit("presence", { online });
}

function socketsOf(io: Server, userId: string): Socket[] {
  const result: Socket[] = [];
  const sids = socketsByUser.get(userId);
  if (!sids) return result;
  for (const sid of sids) {
    const s = io.sockets.sockets.get(sid);
    if (s) result.push(s);
  }
  return result;
}

async function roomSummary(roomId: string): Promise<ChatRoomSummary | null> {
  const room = await db.chatRoom.findFirst({
    where: { id: roomId, deletedAt: null },
    include: {
      members: { include: { user: { select: USER_SELECT } } },
    },
  });
  if (!room) return null;
  return {
    id: room.id,
    name: room.name,
    kind: room.kind === "group" ? "group" : "dm",
    members: room.members
      .filter((m) => !m.user.deletedAt)
      .map((m) => toProfile(m.user)),
  };
}

async function messageFromRow(row: {
  id: string;
  roomId: string;
  type: string;
  text: string | null;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  fileData: string | null;
  createdAt: Date;
  author: { id: string; username: string; name: string; avatar: string | null; role: string };
}): Promise<ChatMsg> {
  const msg: ChatMsg = {
    id: row.id,
    roomId: row.roomId,
    author: toProfile(row.author),
    type: row.type === "file" ? "file" : "text",
    createdAt: row.createdAt.toISOString(),
  };
  if (msg.type === "text") {
    msg.text = row.text ?? "";
  } else {
    msg.file = {
      name: row.fileName ?? "فایل",
      size: row.fileSize ?? 0,
      mime: row.fileMime ?? "application/octet-stream",
      dataUrl: row.fileData ?? "",
    };
  }
  return msg;
}

/** تاریخچهٔ آخر هر اتاق — صعودی */
async function loadHistory(roomId: string): Promise<ChatMsg[]> {
  const rows = await db.chatMessage.findMany({
    where: { roomId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: { author: { select: USER_SELECT } },
  });
  rows.reverse();
  const out: ChatMsg[] = [];
  for (const row of rows) out.push(await messageFromRow(row));
  return out;
}

async function isMember(roomId: string, userId: string): Promise<boolean> {
  const membership = await db.chatRoomMember.findFirst({
    where: { roomId, userId },
  });
  return Boolean(membership);
}

/** اتاق DM را در DB تضمین می‌کند (id قطعی dm:a__b) و هر دو عضو را اضافه می‌کند */
async function ensureDmRoom(me: UserProfile, peerId: string): Promise<string | null> {
  const peer = await db.user.findFirst({
    where: { id: peerId, deletedAt: null, status: "ACTIVE" },
    select: USER_SELECT,
  });
  if (!peer || peer.role === "GUEST") return null;

  const roomId = dmRoomId(me.userId, peerId);
  await db.chatRoom.upsert({
    where: { id: roomId },
    update: { deletedAt: null },
    create: { id: roomId, kind: "dm", name: null },
  });
  for (const uid of [me.userId, peerId]) {
    await db.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId: uid } },
      update: {},
      create: { roomId, userId: uid },
    });
  }
  return roomId;
}

/**
 * استارت سرور چت — idempotent؛ هرگز نباید بوت Next.js را زمین بزند.
 */
export function startChatServer(): void {
  if (started) return;
  started = true;

  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, service: "sibak-chat", persistent: true }));
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  });

  const io = new Server(httpServer, {
    path: "/",
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  /* ---------- احراز هویت handshake ---------- */
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth as
        | { token?: string; profile?: Partial<UserProfile> }
        | undefined;

      if (!auth?.token) {
        return next(new Error("توکن احراز هویت ارسال نشده است"));
      }

      const { payload } = await jwtVerify(
        auth.token,
        new TextEncoder().encode(AUTH_SECRET),
        { issuer: "sibak" },
      );

      if (typeof payload.uid !== "string") {
        return next(new Error("شناسه کاربر در توکن نامعتبر است"));
      }

      const role = String(payload.role ?? "MEMBER");
      if (role === "GUEST") {
        return next(new Error("اعضای مهمان به چت دسترسی ندارند"));
      }

      const row = await db.user.findFirst({
        where: { id: payload.uid, deletedAt: null, status: "ACTIVE" },
        select: USER_SELECT,
      });
      if (!row) {
        return next(new Error("کاربر فعال نیست"));
      }

      (socket.data as { user: UserProfile }).user = toProfile(row);
      next();
    } catch {
      next(new Error("احراز هویت چت نامعتبر است"));
    }
  });

  /* ---------- اتصال ---------- */
  io.on("connection", (socket) => {
    const user = (socket.data as { user: UserProfile }).user;
    console.log(`[chat] connect ${user.username} (${socket.id})`);

    let sids = socketsByUser.get(user.userId);
    if (!sids) {
      sids = new Set();
      socketsByUser.set(user.userId, sids);
    }
    sids.add(socket.id);

    socket.emit("hello", { user, online: [] });

    // اتاق‌های من از DB — سایدبار بین نشست‌ها پر می‌ماند
    void (async () => {
      try {
        const memberships = await db.chatRoomMember.findMany({
          where: { userId: user.userId, room: { deletedAt: null } },
          include: { room: true },
          orderBy: { joinedAt: "asc" },
        });

        const roomIds = memberships.map((m) => m.room.id);
        const lastRows = await db.chatMessage.findMany({
          where: { roomId: { in: roomIds }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { author: { select: USER_SELECT } },
        });
        const lastByRoom = new Map<string, ChatMsg>();
        for (const row of lastRows) {
          if (!lastByRoom.has(row.roomId)) {
            lastByRoom.set(row.roomId, await messageFromRow(row));
          }
        }

        const rooms: { room: ChatRoomSummary; lastMessage: ChatMsg | null }[] = [];
        for (const m of memberships) {
          const summary = await roomSummary(m.roomId);
          if (!summary) continue;
          socket.join(summary.id);
          rooms.push({ room: summary, lastMessage: lastByRoom.get(summary.id) ?? null });
        }
        socket.emit("rooms", { rooms });
        await broadcastPresence(io);
      } catch (e) {
        console.error("[chat] خطا در بارگذاری اتاق‌ها:", e);
      }
    })();

    /* ---------- ورود به اتاق ---------- */
    socket.on(
      "room:join",
      (payload: { roomId?: string; peerId?: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        void (async () => {
          try {
            if (!payload || (!payload.roomId && !payload.peerId)) {
              socket.emit("error", { error: "شناسه اتاق الزامی است" });
              ack?.({ ok: false, error: "شناسه اتاق الزامی است" });
              return;
            }

            let roomId: string;
            if (payload.peerId) {
              const ensured = await ensureDmRoom(user, payload.peerId);
              if (!ensured) {
                socket.emit("error", { error: "این کاربر برای چت در دسترس نیست" });
                ack?.({ ok: false, error: "این کاربر برای چت در دسترس نیست" });
                return;
              }
              roomId = ensured;
            } else {
              roomId = payload.roomId!;
              if (!(await isMember(roomId, user.userId))) {
                // اگر اتاق dm خودم باشم (مثلاً از دستگاه دیگر با لینک قدیمی)،
                // عضویت را با مسیر استاندارد تضمین کن
                const parts = roomId.startsWith("dm:")
                  ? roomId.slice(3).split("__")
                  : [];
                const peerId = parts.length === 2 ? parts.find((x) => x !== user.userId) : undefined;
                const ensured =
                  parts.length === 2 && peerId
                    ? await ensureDmRoom(user, peerId)
                    : null;
                if (ensured !== roomId) {
                  socket.emit("error", { error: "ابتدا باید عضو اتاق باشید" });
                  ack?.({ ok: false, error: "ابتدا باید عضو اتاق باشید" });
                  return;
                }
              }
            }

            const summary = await roomSummary(roomId);
            if (!summary) {
              socket.emit("error", { error: "اتاق پیدا نشد" });
              ack?.({ ok: false, error: "اتاق پیدا نشد" });
              return;
            }

            socket.join(roomId);
            const history = await loadHistory(roomId);
            socket.emit("room:joined", { room: summary, history });
            socket.to(roomId).emit("room:members", { room: summary });
            ack?.({ ok: true });
          } catch (e) {
            console.error("[chat] خطا در room:join:", e);
            socket.emit("error", { error: "ورود به اتاق ناموفق بود" });
          }
        })();
      },
    );

    /* ---------- ساخت گروه ---------- */
    socket.on(
      "room:create",
      (payload: { name?: string; memberIds?: string[] }, ack?: (res: { ok: boolean; error?: string; roomId?: string }) => void) => {
        void (async () => {
          try {
            const name = (payload?.name ?? "").trim().slice(0, 60);
            const memberIds = Array.isArray(payload?.memberIds)
              ? Array.from(new Set(payload.memberIds)).slice(0, 30)
              : [];

            if (name.length < 2 || memberIds.length === 0) {
              socket.emit("error", { error: "نام و حداقل یک عضو الزامی است" });
              ack?.({ ok: false, error: "نام و حداقل یک عضو الزامی است" });
              return;
            }

            // اعضا باید واقعی، فعال و غیرمهمان باشند
            const validUsers = await db.user.findMany({
              where: {
                id: { in: [...memberIds, user.userId] },
                deletedAt: null,
                status: "ACTIVE",
                role: { not: "GUEST" },
              },
              select: USER_SELECT,
            });

            const roomId = `grp:${newId()}`;
            await db.chatRoom.create({
              data: {
                id: roomId,
                name,
                kind: "group",
                createdById: user.userId,
                members: {
                  create: validUsers.map((u) => ({ userId: u.id })),
                },
              },
            });

            const summary = await roomSummary(roomId);
            if (!summary) throw new Error("summary failed");

            socket.join(roomId);
            socket.emit("room:joined", { room: summary, history: [] });
            ack?.({ ok: true, roomId });

            // دعوت فقط به اعضا (نه broadcast عمومی — رفع باگ حریم خصوصی)
            for (const u of validUsers) {
              if (u.id === user.userId) continue;
              for (const target of socketsOf(io, u.id)) {
                target.join(roomId);
                target.emit("room:invited", { room: summary });
              }
            }
          } catch (e) {
            console.error("[chat] خطا در room:create:", e);
            socket.emit("error", { error: "ساخت گروه ناموفق بود" });
          }
        })();
      },
    );

    /* ---------- ارسال پیام ---------- */
    socket.on(
      "message:send",
      (payload: {
        roomId?: string;
        type?: "text" | "file";
        text?: string;
        file?: { name: string; size: number; mime: string; dataUrl: string };
      }) => {
        void (async () => {
          try {
            if (!payload?.roomId || !payload.type) {
              socket.emit("error", { error: "پیام ناقص است" });
              return;
            }
            const roomId = payload.roomId;
            if (!(await isMember(roomId, user.userId))) {
              socket.emit("error", { error: "اول به اتاق بپیوندید" });
              return;
            }

            if (payload.type === "text") {
              const text = (payload.text ?? "").trim().slice(0, 4000);
              if (!text) {
                socket.emit("error", { error: "متن پیام خالی است" });
                return;
              }
              const row = await db.chatMessage.create({
                data: { roomId, authorId: user.userId, type: "text", text },
                include: { author: { select: USER_SELECT } },
              });
              io.to(roomId).emit("message:new", await messageFromRow(row));
              return;
            }

            if (payload.type === "file") {
              const file = payload.file;
              if (!file?.dataUrl || !file.name) {
                socket.emit("error", { error: "فایل ناقص است" });
                return;
              }
              const commaIndex = file.dataUrl.indexOf(",");
              const base64 = commaIndex >= 0 ? file.dataUrl.slice(commaIndex + 1) : file.dataUrl;
              const approxBytes = Math.ceil(base64.length * 0.75);
              if (approxBytes > MAX_FILE_BYTES) {
                socket.emit("error", { error: "حجم فایل بیش از ۵ مگابایت است" });
                return;
              }

              // ---------- قفل نگهبان منابع (سقف فایل چت، فضای کاربر و سایت) ----------
              try {
                await checkUploadQuota({ userId: user.userId, fileSize: approxBytes, kind: "CHAT" });
              } catch (e) {
                if (e instanceof RgError) {
                  socket.emit("error", { error: e.message });
                  return;
                }
                throw e;
              }

              const row = await db.chatMessage.create({
                data: {
                  roomId,
                  authorId: user.userId,
                  type: "file",
                  fileName: file.name.slice(0, 200),
                  fileMime: (file.mime || "application/octet-stream").slice(0, 100),
                  fileSize: approxBytes,
                  fileData: file.dataUrl,
                },
                include: { author: { select: USER_SELECT } },
              });

              // ثبت مصرف در دفتر نگهبان — پیوست چت داخل DB ذخیره می‌شود (storage: DB)
              recordRgFile({
                ownerId: user.userId,
                pathname: `chat:${row.id}`,
                fileName: file.name.slice(0, 200),
                mimeType: (file.mime || "application/octet-stream").slice(0, 100),
                size: approxBytes,
                storage: "DB",
                refType: "CHAT",
                refId: row.id,
              }).catch((e) => console.error("[chat] ثبت مصرف پیوست در نگهبان ناموفق:", e));

              io.to(roomId).emit("message:new", await messageFromRow(row));
            }
          } catch (e) {
            console.error("[chat] خطا در message:send:", e);
            socket.emit("error", { error: "ارسال پیام ناموفق بود" });
          }
        })();
      },
    );

    /* ---------- تایپ ---------- */
    socket.on("typing", (payload: { roomId?: string; isTyping?: boolean }) => {
      if (!payload?.roomId) return;
      socket.to(payload.roomId).emit("typing", {
        roomId: payload.roomId,
        userId: user.userId,
        name: user.name,
        isTyping: Boolean(payload.isTyping),
      });
    });

    socket.on("room:leave", (payload: { roomId?: string }) => {
      if (!payload?.roomId) return;
      socket.leave(payload.roomId);
    });

    socket.on("disconnect", () => {
      console.log(`[chat] disconnect ${user.username} (${socket.id})`);
      const sids = socketsByUser.get(user.userId);
      if (!sids) return;
      sids.delete(socket.id);
      if (sids.size === 0) {
        socketsByUser.delete(user.userId);
        void broadcastPresence(io);
      }
    });
  });

  httpServer.on("error", (e) => {
    console.error("[chat] خطای سرور چت:", e.message);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[chat] سرویس چت سیبک (درون‌پروسسی، DB-backed) روی پورت ${PORT} آماده است`);
  });
}
