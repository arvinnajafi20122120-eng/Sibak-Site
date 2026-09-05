import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const tables = await db.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );
    return NextResponse.json({
      databaseUrl: process.env.DATABASE_URL?.substring(0, 40) + "...",
      tables: (tables as any[]).map((r: any) => r.name),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}