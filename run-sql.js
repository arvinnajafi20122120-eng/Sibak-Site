const { createClient } = require("@libsql/client");

const client = createClient({
  url: "libsql://sibak-site-arvinnajafi20122120-eng.aws-ap-south-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NTY0MjQsImlkIjoiMDFhMDNjZDktNTQwMS03MzAwLWIwOWItMjYwY2RmY2U0OWI5Iiwia2lkIjoiSVlsR1VaMTdRdF9NZG1FcUpJUzAwX2xTaWsyZlAtTFVVRGh1WEVXaEpGMCIsInJpZCI6IjIyMjZmNTZlLTlkNDYtNGIxYi05ZDBiLWVkZGM0NDI2N2I5OCJ9.RIAcwUChv4NvZPdljhk7d6eKNNrDvqdAT_a75jMGz9rGKKVWo-T_52xrj6i_SYCyEQ-TJE8TB1BoFc2WcEFXCA"
});

async function main() {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS "RgFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ownerId" TEXT,
      "pathname" TEXT NOT NULL UNIQUE,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "storage" TEXT NOT NULL DEFAULT 'LOCAL',
      "refType" TEXT,
      "refId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" DATETIME,
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "RgFile_ownerId_deletedAt_idx" ON "RgFile"("ownerId", "deletedAt")`,
    `CREATE TABLE IF NOT EXISTS "RgEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "level" TEXT NOT NULL DEFAULT 'INFO',
      "message" TEXT NOT NULL,
      "meta" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "RgEvent_type_createdAt_idx" ON "RgEvent"("type", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "RgEvent_createdAt_idx" ON "RgEvent"("createdAt")`
  ];

  for (const sql of sqls) {
    try {
      await client.execute(sql);
      console.log("OK:", sql.substring(0, 50));
    } catch (e) {
      console.error("ERR:", e.message);
    }
  }

  // Verify
  const result = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('RgFile', 'RgEvent')`
  );
  console.log("\nTables found:", result.rows.map(r => r.name));
  
  client.close();
}

main();