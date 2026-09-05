import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { id: true, name: true, role: true },
      take: 5,
    });
    return NextResponse.json({ userCount: users.length, users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}