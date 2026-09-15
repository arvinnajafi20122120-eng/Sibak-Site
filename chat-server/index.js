const { Server } = require("socket.io");
const http = require("http");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { createClient } = require("@libsql/client");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const JWT_SECRET = process.env.JWT_SECRET || "sibak-secret";
const PORT = process.env.PORT || 3001;

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    socket.data.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
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