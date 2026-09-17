const { Server } = require("socket.io");
const http = require("http");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { createClient } = require("@libsql/client");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const JWT_SECRET = process.env.JWT_SECRET || "sibak-dev-secret-key-change-me";
const PORT = process.env.PORT || 8080;

// استفاده از HTTP client به جای embedded replica
const db = createClient({
  url: process.env.TURSO_URL.replace("libsql://", "https://"),
  authToken: process.env.TURSO_TOKEN,
});
console.log(`[chat] DB URL: ${process.env.TURSO_URL?.substring(0, 30)}...`);
// ─── Auth Middleware ───
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

  // ─── ارسال لیست اتاق‌های کاربر بعد از اتصال ───
  try {
    console.log(`[chat] fetching rooms for ${user.id}`);
    const result = await db.execute(
      `SELECT r.id, r.name, r.kind, r.createdAt
       FROM ChatRoom r
       INNER JOIN ChatRoomMember m ON r.id = m.roomId
       WHERE m.userId = ?`,
      [user.id]
    );
    console.log(`[chat] found ${result.rows.length} rooms`);
    const roomsWithLastMsg = [];
    for (const r of result.rows) {
      let lastMessage = null;
      try {
        const msgResult = await db.execute(
          `SELECT id, roomId, senderId, content, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt DESC LIMIT 1`,
          [r.id]
        );
        if (msgResult.rows.length > 0) {
          const m = msgResult.rows[0];
          lastMessage = {
            id: m.id,
            roomId: m.roomId,
            senderId: m.senderId,
            type: "text",
            text: m.content,
            createdAt: m.createdAt,
          };
        }
      } catch (e) {
        console.error("[chat] lastMessage error:", e.message);
      }
      roomsWithLastMsg.push({
        room: {
          id: r.id,
          name: r.name,
          kind: r.kind,
          members: [],
          createdAt: r.createdAt,
        },
        lastMessage,
      });
    }
    socket.emit("rooms", { rooms: roomsWithLastMsg });
    console.log(`[chat] emitted ${roomsWithLastMsg.length} rooms to ${user.id}`);
  } catch (e) {
    console.error("[chat] rooms error:", e.message);
  }

  // ─── hello ───
  socket.emit("hello", { userId: user.id });

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
    console.log(`[chat] message from ${user.id} in ${data.roomId}`);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await db.execute(
        `INSERT INTO ChatMessage (id, roomId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [id, data.roomId, user.id, data.content, now]
      );
      console.log(`[chat] ChatMessage saved: ${id}`);
    } catch (e) {
      console.error("[chat] save error:", e.message);
    }
    const msg = {
      id,
      roomId: data.roomId,
      senderId: user.id,
      content: data.content,
      createdAt: now,
    };
    io.to(data.roomId).emit("message:new", msg);
  });

  // ─── ساخت گروه جدید ───
  socket.on("room:create", async (data) => {
    try {
      const roomId = `group:${crypto.randomUUID()}`;
      const memberIds = [user.id, ...(data.memberIds || [])];
      const uniqueMembers = [...new Set(memberIds)];

      await db.execute(
        `INSERT INTO ChatRoom (id, name, kind, createdAt) VALUES (?, ?, 'group', ?)`,
        [roomId, data.name || "گروه جدید", new Date().toISOString()]
      );
      console.log(`[chat] ChatRoom inserted: ${roomId}`);

      for (const memberId of uniqueMembers) {
        await db.execute(
          `INSERT OR IGNORE INTO ChatRoomMember (roomId, userId, joinedAt) VALUES (?, ?, ?)`,
          [roomId, memberId, new Date().toISOString()]
        );
        console.log(`[chat] ChatRoomMember inserted: ${roomId} -> ${memberId}`);
      }

      const room = {
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
      };

      socket.emit("room:created", { room });
      socket.join(roomId);

      console.log(`[chat] room created: ${roomId} by ${user.id}`);
    } catch (e) {
      console.error("[chat] room:create error:", e.message);
      socket.emit("error", { error: e.message });
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