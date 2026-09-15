const { Server } = require("socket.io");
const http = require("http");
const crypto = require("crypto");
const { createClient } = require("@libsql/client");
const jwt = require("jsonwebtoken");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const JWT_SECRET = process.env.JWT_SECRET || "sibak-dev-secret-key-change-me";
const PORT = process.env.PORT || 8080;

const secretKey = new TextEncoder().encode(JWT_SECRET);

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "sibak" });
    socket.data.user = { id: payload.uid, role: payload.role };
    next();
  } catch (e) {
    console.error("[chat] auth error:", e.message);
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const user = socket.data.user;
  console.log(`[chat] connect ${user.id}`);

  socket.on("join", async (roomId) => {
    socket.join(roomId);
    try {
      const history = await db.execute(
        `SELECT id, roomId, senderId, content, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt DESC LIMIT 50`,
        [roomId]
      );
      socket.emit("history", history.rows.reverse());
    } catch (e) {
      console.error("[chat] history error:", e.message);
    }
    socket.to(roomId).emit("user:joined", { userId: user.id });
  });

  socket.on("message", async (data) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await db.execute(
        `INSERT INTO ChatMessage (id, roomId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [id, data.roomId, user.id, data.content, now]
      );
    } catch (e) {
      console.error("[chat] save error:", e.message);
    }
    socket.to(data.roomId).emit("message", {
      id,
      roomId: data.roomId,
      senderId: user.id,
      content: data.content,
      createdAt: now,
    });
  });

  // ─── ساخت گروه جدید ───
  socket.on("room:create", async (data) => {
    try {
      const roomId = `group:${crypto.randomUUID()}`;
      const memberIds = [user.id, ...(data.memberIds || [])];
      const uniqueMembers = [...new Set(memberIds)];

      // ذخیره اتاق در دیتابیس
      await db.execute(
        `INSERT INTO ChatRoom (id, name, kind, createdAt) VALUES (?, ?, 'group', ?)`,
        [roomId, data.name || "گروه جدید", new Date().toISOString()]
      );

      // اضافه کردن اعضا
      for (const memberId of uniqueMembers) {
        await db.execute(
          `INSERT OR IGNORE INTO ChatRoomMember (roomId, userId, joinedAt) VALUES (?, ?, ?)`,
          [roomId, memberId, new Date().toISOString()]
        );
      }

      // اطلاع به سازنده
            socket.emit("room:created", {
        room: {
          id: roomId,
          name: data.name || "گروه جدید",
          kind: "group",
          members: uniqueMembers.map((id) => ({
            userId: id,
            username: "",
            name: "",
            avatar: null,
            role: "",
          })),
        },
      });
      // عضو شدن خودکار سازنده در اتاق
      socket.join(roomId);

      console.log(`[chat] room created: ${roomId} by ${user.id}`);
    } catch (e) {
      console.error("[chat] room:create error:", e.message);
      socket.emit("room:create:error", { message: e.message });
    }
  });

  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("typing", {
      userId: user.id,
      isTyping: data.isTyping,
    });
  });

  socket.on("leave", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user:left", { userId: user.id });
  });

  socket.on("disconnect", () => {
    console.log(`[chat] disconnect ${user.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on port ${PORT}`);
});