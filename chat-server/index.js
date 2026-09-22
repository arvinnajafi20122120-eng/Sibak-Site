const { Server } = require("socket.io");
const http = require("http");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { createClient } = require("@libsql/client");

const server = http.createServer();
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const JWT_SECRET = process.env.JWT_SECRET || "sibak-dev-secret-key-change-me";
const PORT = process.env.PORT || 8080;

const db = createClient({
  url: process.env.TURSO_URL.replace("libsql://", "https://"),
  authToken: process.env.TURSO_TOKEN,
});

function formatMessage(row) {
  return {
    id: row.id,
    roomId: row.roomId,
    author: { userId: row.authorId, name: "", username: "" },
    text: row.text || "",
    type: row.type || "text",
    createdAt: row.createdAt
  };
}

io.use(function(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;
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

io.on("connection", async function(socket) {
  const user = socket.data.user;
  console.log("[chat] connect " + user.id);

  // ارسال لیست اتاق‌ها
  try {
    var result = await db.execute(
      "SELECT r.id, r.name, r.kind, r.createdAt FROM ChatRoom r INNER JOIN ChatRoomMember m ON r.id = m.roomId WHERE m.userId = ?",
      [user.id]
    );
    console.log("[chat] found " + result.rows.length + " rooms");
    var list = [];
    for (var i = 0; i < result.rows.length; i++) {
      var r = result.rows[i];
      var lm = null;
      try {
        var mr = await db.execute(
          "SELECT id, roomId, authorId, text, type, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt DESC LIMIT 1",
          [r.id]
        );
        if (mr.rows.length > 0) {
          lm = formatMessage(mr.rows[0]);
        }
      } catch (e2) {}
      list.push({
        room: { id: r.id, name: r.name, kind: r.kind, members: [], createdAt: r.createdAt },
        lastMessage: lm
      });
    }
    socket.emit("rooms", { rooms: list });
    console.log("[chat] emitted " + list.length + " rooms");
  } catch (e) {
    console.error("[chat] rooms error:", e.message);
  }

  socket.emit("hello", { userId: user.id });

  // join به اتاق
  socket.on("room:join", async function(data) {
    var roomId = typeof data === "string" ? data : (data && data.roomId ? data.roomId : "");
    if (!roomId) return;
    console.log("[chat] room:join received: " + roomId + " from " + user.id);
    socket.join(roomId);

    // دریافت اطلاعات اتاق برای ارسال به کلاینت
    var roomInfo = null;
    try {
      var ri = await db.execute("SELECT id, name, kind, createdAt FROM ChatRoom WHERE id = ?", [roomId]);
      if (ri.rows.length > 0) {
        roomInfo = { id: ri.rows[0].id, name: ri.rows[0].name, kind: ri.rows[0].kind, members: [], createdAt: ri.rows[0].createdAt };
      }
    } catch (e) {}

    // دریافت تاریخچه پیام‌ها
    var history = [];
    try {
      var h = await db.execute(
        "SELECT id, roomId, authorId, text, type, createdAt FROM ChatMessage WHERE roomId = ? ORDER BY createdAt ASC LIMIT 50",
        [roomId]
      );
      history = h.rows.map(formatMessage);
      console.log("[chat] emitting history with " + history.length + " messages");
    } catch (e) {
      console.error("[chat] history error:", e.message);
    }

    // ارسال room:joined با payload کامل (مطابق انتظار کلاینت)
    socket.emit("room:joined", {
      room: roomInfo || { id: roomId, name: "", kind: "group", members: [], createdAt: "" },
      history: history
    });

    socket.to(roomId).emit("user:joined", { userId: user.id });
  });

  // ارسال پیام
  socket.on("message:send", async function(data) {
    console.log("[chat] message from " + user.id + " in " + data.roomId);
    var id = crypto.randomUUID();
    var now = new Date().toISOString();
    var msgText = data.text || data.content || "";
    var msgType = data.type || "text";
    try {
      await db.execute(
        "INSERT INTO ChatMessage (id, roomId, authorId, type, text, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, data.roomId, user.id, msgType, msgText, now, now]
      );
      console.log("[chat] saved: " + id);
    } catch (e) {
      console.error("[chat] save error:", e.message);
    }
    var msg = formatMessage({
      id: id,
      roomId: data.roomId,
      authorId: user.id,
      text: msgText,
      type: msgType,
      createdAt: now
    });
    io.to(data.roomId).emit("message:new", msg);
  });

  // ساخت گروه
  socket.on("room:create", async function(data) {
    try {
      var roomId = "group:" + crypto.randomUUID();
      var mids = [user.id].concat(data.memberIds || []);
      var uniq = Array.from(new Set(mids));
      await db.execute(
        "INSERT INTO ChatRoom (id, name, kind, createdAt) VALUES (?, ?, 'group', ?)",
        [roomId, data.name || "New Group", new Date().toISOString()]
      );
      console.log("[chat] ChatRoom inserted: " + roomId);
      for (var j = 0; j < uniq.length; j++) {
        await db.execute(
          "INSERT OR IGNORE INTO ChatRoomMember (id, roomId, userId, joinedAt) VALUES (?, ?, ?, ?)",
          [crypto.randomUUID(), roomId, uniq[j], new Date().toISOString()]
        );
        console.log("[chat] Member inserted: " + uniq[j]);
      }
      var room = {
        id: roomId,
        name: data.name || "New Group",
        kind: "group",
        members: uniq.map(function(mid) {
          return { userId: mid, username: "", name: "", avatar: null, role: "" };
        })
      };
      socket.emit("room:created", { room: room });
      socket.join(roomId);
      console.log("[chat] room created: " + roomId);
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