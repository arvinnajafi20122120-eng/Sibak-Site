import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const results: Record<string, string> = {};

  try { await db.teacherContent.count(); results["TeacherContent"] = "OK"; } catch (e: any) { results["TeacherContent"] = e.message.substring(0, 200); }

  return NextResponse.json(results);
}