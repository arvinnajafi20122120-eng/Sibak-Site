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

const db = createClient({
  url: process.env.TURSO_URL.replace("libsql://", "https://"),
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
  console.log("[chat] connect " + user.id);

  try {
    console.log("[chat] fetching rooms for " + user.id);
    const result = await db.execute(
      "SELECT r.id, r.name, r.kind, r.createdAt FROM ChatRoom r INNER JOIN ChatRoomMember m ON r.id = m.roomId WHERE m.userId = ?",
      [user.id]
    );
    console.log("[chat] found " + result.rows.length + " rooms");
    var roomsWithLastMsg = [];
    for (var i = 0; i < result.rows.length; i++) {
      var r = result.rows[i];
      var lastMessage = null;
      try {
        var msgResult = await db.execute(
          "SELECT id, roomId, senderId, content, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt DESC LIMIT 1",
          [r.id]
        );
        if (msgResult.rows.length > 0) {
          var m = msgResult.rows[0];
          lastMessage = { id: m.id, roomId: m.roomId, senderId: m.senderId, type: "text", text: m.content, createdAt: m.createdAt };
        }
      } catch (e2) {
        console.error("[chat] lastMessage error:", e2.message);
      }
      roomsWithLastMsg.push({ room: { id: r.id, name: r.name, kind: r.kind, members: [], createdAt: r.createdAt }, lastMessage: lastMessage });
    }
    socket.emit("rooms", { rooms: roomsWithLastMsg });
    console.log("[chat] emitted " + roomsWithLastMsg.length + " rooms to " + user.id);
  } catch (e) {
    console.error("[chat] rooms error:", e.message);
  }

  socket.emit("hello", { userId: user.id });

  socket.on("join", async (roomId) => {
    socket.join(roomId);
    try {
      var history = await db.execute(
        "SELECT id, roomId, senderId, content, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt DESC LIMIT 50",
        [roomId]
      );
      socket.emit("history", history.rows.reverse());
    } catch (e) {
      console.error("[chat] history error:", e.message);
    }
    socket.to(roomId).emit("user:joined", { userId: user.id });
  });

  socket.on("message", async (data) => {
    console.log("[chat] message from " + user.id + " in " + data.roomId);
    var id = crypto.randomUUID();
    var now = new Date().toISOString();
    try {
      await db.execute(
        "INSERT INTO ChatMessage (id, roomId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)",
        [id, data.roomId, user.id, data.content, now]
      );
      console.log("[chat] ChatMessage saved: " + id);
    } catch (e) {
      console.error("[chat] save error:", e.message);
    }
    var msg = { id: id, roomId: data.roomId, senderId: user.id, content: data.content, createdAt: now };
    io.to(data.roomId).emit("message:new", msg);
  });

  socket.on("room:create", async (data) => {
    try {
      var roomId = "group:" + crypto.randomUUID();
      var memberIds = [user.id].concat(data.memberIds || []);
      var uniqueMembers = Array.from(new Set(memberIds));

      await db.execute(
        "INSERT INTO ChatRoom (id, name, kind, createdAt) VALUES (?, ?, 'group', ?)",
        [roomId, data.name || "New Group", new Date().toISOString()]
      );
      console.log("[chat] ChatRoom inserted: " + roomId);

      for (var j = 0; j < uniqueMembers.length; j++) {
        await db.execute(
          "INSERT OR IGNORE INTO ChatRoomMember (roomId, userId, joinedAt) VALUES (?, ?, ?)",
          [roomId, uniqueMembers[j], new Date().toISOString()]
        );
        console.log("[chat] ChatRoomMember inserted: " + roomId + " -> " + uniqueMembers[j]);
      }

      var verify = await db.execute("SELECT COUNT(*) as cnt FROM ChatRoom WHERE id = ?", [roomId]);
      console.log("[chat] VERIFY: " + verify.rows[0].cnt + " rooms with id " + roomId);

      var verifyAll = await db.execute("SELECT COUNT(*) as cnt FROM ChatRoom");
      console.log("[chat] VERIFY ALL: " + verifyAll.rows[0].cnt + " total rooms in DB");

      var room = {
        id: roomId,
        name: data.name || "New Group",
        kind: "group",
        members: uniqueMembers.map(function(mid) { return { userId: mid, username: "", name: "", avatar: null, role: "" }; })
      };

      socket.emit("room:created", { room: room });
      socket.join(roomId);
      console.log("[chat] room created: " + roomId + " by " + user.id);
    } catch (e) {
      console.error("[chat] room:create error:", e.message);
      socket.emit("error", { error: e.message });
    }
  });

  socket.on("typing", function(data) {
    socket.to(data.roomId).emit("typing", { userId: user.id, isTyping: data.isTyping });
  });

  socket.on("leave", function(roomId) {
    socket.leave(roomId);
    socket.to(roomId).emit("user:left", { userId: user.id });
  });

  socket.on("disconnect", function() {
    console.log("[chat] disconnect " + user.id);
  });
});

server.listen(PORT, function() {
  console.log("Chat server running on port " + PORT);
});