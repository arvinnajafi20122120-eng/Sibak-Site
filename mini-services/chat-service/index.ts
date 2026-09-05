/**
 * سرویس چت سیبک — WebSocket (Socket.IO)
 *
 * امکانات:
 *  - چت یک‌به‌یک
 *  - چت گروهی
 *  - اشتراک فایل تا ۵MB
 *  - حضور آنلاین/آفلاین
 *  - تاریخچه ۵۰ پیام آخر هر اتاق
 *  - typing indicator
 *  - احراز هویت JWT در handshake
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { jwtVerify } from "jose";

const PORT = Number(process.env.PORT ?? 3003);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const HISTORY_LIMIT = 50;

interface UserProfile {
  userId: string;
  username: string;
  name: string;
  avatar: string | null;
  role: string;
}

interface ChatMessage {
  id: string;
  roomId: string;
  author: UserProfile;
  type: "text" | "file";
  text?: string;
  file?: {
    name: string;
    size: number;
    mime: string;
    dataUrl: string;
  };
  createdAt: string;
}

interface Room {
  id: string;
  name: string | null;
  kind: "dm" | "group";
  members: Set<string>;
  history: ChatMessage[];
}

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    res.end(
      JSON.stringify({
        ok: true,
        service: "sibak-chat",
      }),
    );

    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 10 * 1024 * 1024,
});

const socketsByUser = new Map<string, Set<string>>();
const userProfiles = new Map<string, UserProfile>();
const rooms = new Map<string, Room>();

function rid(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

function dmRoomId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `dm:${x}__${y}`;
}

function onlineUsers(): UserProfile[] {
  return Array.from(socketsByUser.keys())
    .map((uid) => userProfiles.get(uid))
    .filter((user): user is UserProfile => Boolean(user));
}

function broadcastPresence() {
  io.emit("presence", {
    online: onlineUsers(),
  });
}

function getOrCreateRoom(
  roomId: string,
  kind: "dm" | "group",
  name: string | null,
): Room {
  let room = rooms.get(roomId);

  if (!room) {
    room = {
      id: roomId,
      name,
      kind,
      members: new Set(),
      history: [],
    };

    rooms.set(roomId, room);
  }

  return room;
}

function roomSummary(room: Room) {
  return {
    id: room.id,
    name: room.name,
    kind: room.kind,
    members: Array.from(room.members)
      .map((uid) => userProfiles.get(uid))
      .filter((user): user is UserProfile => Boolean(user)),
  };
}

/**
 * احراز هویت WebSocket
 *
 * JWT:
 *   alg = HS256
 *   issuer = sibak
 *   payload:
 *     uid
 *     role
 *
 * پروفایل برای نام/آواتار استفاده می‌شود،
 * اما هویت اصلی فقط از JWT پذیرفته می‌شود.
 */
io.use(async (socket, next) => {
  try {
    const auth = socket.handshake.auth as
      | {
          token?: string;
          profile?: Partial<UserProfile>;
        }
      | undefined;

    const token = auth?.token;
    const profile = auth?.profile;

    if (!token) {
      return next(
        new Error("توکن احراز هویت ارسال نشده است"),
      );
    }

    const secret = process.env.AUTH_SECRET;

    if (!secret) {
      console.error(
        "[chat] AUTH_SECRET تنظیم نشده است",
      );

      return next(
        new Error("احراز هویت سرویس تنظیم نشده است"),
      );
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        issuer: "sibak",
      },
    );

    if (typeof payload.uid !== "string") {
      return next(new Error("شناسه کاربر در توکن نامعتبر است"));
    }

    const tokenRole = String(
      payload.role ?? "MEMBER",
    );

    if (!profile?.userId || profile.userId !== payload.uid) {
      return next(
        new Error("پروفایل کاربر با توکن مطابقت ندارد"),
      );
    }

    if (
      profile.role &&
      String(profile.role) !== tokenRole
    ) {
      return next(
        new Error("نقش کاربر با توکن مطابقت ندارد"),
      );
    }

    (socket.data as { user: UserProfile }).user = {
      userId: payload.uid,
      username: profile.username ?? "",
      name: profile.name ?? "",
      avatar: profile.avatar ?? null,
      role: tokenRole,
    };

    next();
  } catch (error) {
    console.error(
      "[chat] authentication failed:",
      error,
    );

    next(
      new Error("احراز هویت چت نامعتبر است"),
    );
  }
});

io.on("connection", (socket) => {
  const user = (
    socket.data as { user: UserProfile }
  ).user;

  console.log(
    `[chat] connect ${user.username} (${socket.id})`,
  );

  userProfiles.set(user.userId, user);

  let sockets = socketsByUser.get(user.userId);

  if (!sockets) {
    sockets = new Set();
    socketsByUser.set(user.userId, sockets);
  }

  sockets.add(socket.id);

  socket.emit("hello", {
    user,
    online: onlineUsers(),
  });

  broadcastPresence();

  socket.on(
    "room:join",
    (payload: {
      roomId?: string;
      peerId?: string;
      name?: string | null;
    }) => {
      if (
        !payload ||
        (!payload.roomId && !payload.peerId)
      ) {
        socket.emit("error", {
          error: "شناسه اتاق الزامی است",
        });
        return;
      }

      let roomId = payload.roomId!;
      let kind: "dm" | "group" = "group";
      let name = payload.name ?? null;

      if (payload.peerId) {
        roomId = dmRoomId(
          user.userId,
          payload.peerId,
        );

        kind = "dm";
        name = null;
      }

      const room = getOrCreateRoom(
        roomId,
        kind,
        name,
      );

      room.members.add(user.userId);
      socket.join(roomId);

      socket.emit("room:joined", {
        room: roomSummary(room),
        history: room.history.slice(-HISTORY_LIMIT),
      });

      socket
        .to(roomId)
        .emit("room:members", {
          room: roomSummary(room),
        });
    },
  );

  socket.on(
    "room:create",
    (payload: {
      roomId?: string;
      name?: string;
      memberIds?: string[];
    }) => {
      if (
        !payload ||
        !payload.name ||
        !Array.isArray(payload.memberIds) ||
        payload.memberIds.length === 0
      ) {
        socket.emit("error", {
          error: "نام و حداقل یک عضو الزامی است",
        });
        return;
      }

      const roomId =
        payload.roomId ?? `grp:${rid()}`;

      const room = getOrCreateRoom(
        roomId,
        "group",
        payload.name,
      );

      room.members.add(user.userId);

      for (const uid of payload.memberIds) {
        room.members.add(uid);
      }

      socket.join(roomId);

      io.emit("room:created", {
        room: roomSummary(room),
      });

      for (const uid of room.members) {
        if (uid === user.userId) continue;

        const userSockets =
          socketsByUser.get(uid);

        if (!userSockets) continue;

        for (const sid of userSockets) {
          const target =
            io.sockets.sockets.get(sid);

          if (!target) continue;

          target.join(roomId);

          target.emit("room:invited", {
            room: roomSummary(room),
          });
        }
      }

      socket.emit("room:joined", {
        room: roomSummary(room),
        history: room.history.slice(-HISTORY_LIMIT),
      });
    },
  );

  socket.on(
    "message:send",
    (payload: {
      roomId?: string;
      type?: "text" | "file";
      text?: string;
      file?: {
        name: string;
        size: number;
        mime: string;
        dataUrl: string;
      };
    }) => {
      if (
        !payload ||
        !payload.roomId ||
        !payload.type
      ) {
        socket.emit("error", {
          error: "پیام ناقص است",
        });
        return;
      }

      const room = rooms.get(
        payload.roomId,
      );

      if (
        !room ||
        !room.members.has(user.userId)
      ) {
        socket.emit("error", {
          error: "اول به اتاق بپیوندید",
        });
        return;
      }

      if (payload.type === "text") {
        const text = (
          payload.text ?? ""
        )
          .slice(0, 4000)
          .trim();

        if (!text) {
          socket.emit("error", {
            error: "متن پیام خالی است",
          });
          return;
        }

        const message: ChatMessage = {
          id: rid(),
          roomId: room.id,
          author: user,
          type: "text",
          text,
          createdAt: new Date().toISOString(),
        };

        room.history.push(message);

        if (
          room.history.length >
          HISTORY_LIMIT
        ) {
          room.history.shift();
        }

        io.to(room.id).emit(
          "message:new",
          message,
        );

        return;
      }

      if (payload.type === "file") {
        const file = payload.file;

        if (
          !file ||
          !file.dataUrl ||
          !file.name
        ) {
          socket.emit("error", {
            error: "فایل ناقص است",
          });
          return;
        }

        const commaIndex =
          file.dataUrl.indexOf(",");

        const base64 =
          commaIndex >= 0
            ? file.dataUrl.slice(
                commaIndex + 1,
              )
            : file.dataUrl;

        const approxBytes = Math.ceil(
          base64.length * 0.75,
        );

        if (
          approxBytes >
          MAX_FILE_BYTES
        ) {
          socket.emit("error", {
            error:
              "حجم فایل بیش از ۵ مگابایت است",
          });
          return;
        }

        const message: ChatMessage = {
          id: rid(),
          roomId: room.id,
          author: user,
          type: "file",
          file: {
            name: file.name.slice(0, 200),
            size: approxBytes,
            mime: (
              file.mime ||
              "application/octet-stream"
            ).slice(0, 100),
            dataUrl: file.dataUrl,
          },
          createdAt:
            new Date().toISOString(),
        };

        room.history.push(message);

        if (
          room.history.length >
          HISTORY_LIMIT
        ) {
          room.history.shift();
        }

        io.to(room.id).emit(
          "message:new",
          message,
        );
      }
    },
  );

  socket.on(
    "typing",
    (payload: {
      roomId?: string;
      isTyping?: boolean;
    }) => {
      if (!payload?.roomId) return;

      socket
        .to(payload.roomId)
        .emit("typing", {
          roomId: payload.roomId,
          userId: user.userId,
          name: user.name,
          isTyping: Boolean(
            payload.isTyping,
          ),
        });
    },
  );

  socket.on(
    "room:leave",
    (payload: {
      roomId?: string;
    }) => {
      if (!payload?.roomId) return;

      socket.leave(payload.roomId);
    },
  );

  socket.on("disconnect", () => {
    console.log(
      `[chat] disconnect ${user.username} (${socket.id})`,
    );

    const userSockets =
      socketsByUser.get(
        user.userId,
      );

    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      socketsByUser.delete(
        user.userId,
      );

      userProfiles.delete(
        user.userId,
      );

      broadcastPresence();
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[chat] سرویس چت سیبک روی پورت ${PORT} آماده است`,
  );
});