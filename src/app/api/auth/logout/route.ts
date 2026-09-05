import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE, getSessionUser, handleApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getSessionUser();
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    // کوکی را از استور سمت سرور هم پاک می‌کنیم
    try {
      const store = await cookies();
      store.delete(SESSION_COOKIE);
    } catch {
      /* ignore */
    }
    if (user) {
      await logAudit({
        actorId: user.id,
        action: "LOGOUT",
        entityType: "USER",
        entityId: user.id,
        summary: `خروج از حساب: ${user.name}`,
      });
    }
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
