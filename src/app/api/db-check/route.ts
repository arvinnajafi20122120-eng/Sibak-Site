import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // دقیقاً همان کوئری که /api/rg اجرا می‌کند
    const globalAgg = await db.rgFile.aggregate({
      where: { deletedAt: null },
      _sum: { size: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      success: true,
      usedBytes: globalAgg._sum.size ?? 0,
      fileCount: globalAgg._count._all,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      stack: e.stack?.substring(0, 500),
    }, { status: 500 });
  }
}