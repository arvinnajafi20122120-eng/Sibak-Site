const { createClient } = require("@libsql/client");

const TURSO_URL = "libsql://sibak-site-arvinnajafi20122120-eng.aws-ap-south-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NTY0MjQsImlkIjoiMDFhMDNjZDktNTQwMS03MzAwLWIwOWItMjYwY2RmY2U0OWI5Iiwia2lkIjoiSVlsR1VaMTdRdF9NZG1FcUpJUzAwX2xTaWsyZlAtTFVVRGh1WEVXaEpGMCIsInJpZCI6IjIyMjZmNTZlLTlkNDYtNGIxYi05ZDBiLWVkZGM0NDI2N2I5OCJ9.RIAcwUChv4NvZPdljhk7d6eKNNrDvqdAT_a75jMGz9rGKKVWo-T_52xrj6i_SYCyEQ-TJE8TB1BoFc2WcEFXCA";

async function main() {
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  await db.execute(`CREATE TABLE IF NOT EXISTS ChatRoom(
    id TEXT PRIMARY KEY,
    name TEXT,
    kind TEXT NOT NULL DEFAULT 'group',
    createdAt TEXT NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS ChatRoomMember(
    roomId TEXT NOT NULL,
    userId TEXT NOT NULL,
    joinedAt TEXT NOT NULL,
    PRIMARY KEY (roomId, userId)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS ChatMessage(
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    content TEXT,
    createdAt TEXT NOT NULL
  )`);

  console.log("Tables created!");
  const r = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`);
  console.log(r.rows);
}

main().catch(console.error);