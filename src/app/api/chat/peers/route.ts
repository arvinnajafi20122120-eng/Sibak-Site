import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireMemberOrHigher } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

/**
 * GET /api/chat/peers
 * فهرست اعضای فعال (به‌جز خودم) برای شروع چت یک‌به‌یک.
 * نقش GUEST از این endpoint مستثنی است (فقط اعضای دائمی می‌توانند چت کنند).
 */

const PEER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  status: true,
  joinReason: true,
  skills: true,
  bio: true,
  avatar: true,
  points: true,
  rejectionNote: true,
  guestExpiresAt: true,
  guestScope: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function GET() {
  try {
    const { user } = await requireMemberOrHigher();

    const rows = await db.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        id: { not: user.id },
        role: { not: "GUEST" },
      },
      orderBy: [{ lastLoginAt: "desc" }, { name: "asc" }],
      take: 100,
      select: PEER_SELECT,
    });

    const peers = rows.map((r) => toSafeUser({ ...r, email: r.email ?? null }));
    return NextResponse.json({ peers });
  } catch (e) {
    return handleApiError(e);
  }
}
