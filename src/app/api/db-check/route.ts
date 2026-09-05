import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkUploadQuota, buildStorageName } from "@/lib/resource-guard";

export async function GET() {
  const results: Record<string, string> = {};

  try { await checkUploadQuota({ userId: "test", fileSize: 1024, kind: "FILE" }); results["checkUploadQuota"] = "OK"; } catch (e: any) { results["checkUploadQuota"] = e.message; }
  try { buildStorageName("test.pdf"); results["buildStorageName"] = "OK"; } catch (e: any) { results["buildStorageName"] = e.message; }
  try { await db.rgFile.count(); results["rgFile.count"] = "OK"; } catch (e: any) { results["rgFile.count"] = e.message; }
  try { await db.setting.findFirst(); results["setting.findFirst"] = "OK"; } catch (e: any) { results["setting.findFirst"] = e.message; }

  return NextResponse.json(results);
}