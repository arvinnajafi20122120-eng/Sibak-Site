import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const results: Record<string, string> = {};

  try { await db.medal.count(); results["Medal"] = "OK"; } catch (e: any) { results["Medal"] = e.message.substring(0, 200); }

  return NextResponse.json(results);
}
