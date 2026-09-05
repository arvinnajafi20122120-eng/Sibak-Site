import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import type { Role } from "@/lib/types";

/**
 * احراز هویت سفارشی سیبک — JWT (jose) در کوکی httpOnly با نام sibak_session.
 */

export const SESSION_COOKIE = "sibak_session";
const SESSION_DAYS = 30;

const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "sibak-dev-secret-key-change-me";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(AUTH_SECRET);
}

export interface SessionPayload {
  uid: string;
  role: string;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSessionToken(user: {
  id: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ uid: user.id, role: user.role } as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sibak")
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "sibak" });
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, role: String(payload.role ?? "MEMBER") };
  } catch {
    return null;
  }
}

/** خواندن توکن از کوکی — از req (هدر cookie) یا cookies() سروالکت */
function readCookieFromReq(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** خواندن توکن از هدر Authorization: Bearer <jwt> — fallback برای iframe. */
function readBearerFromReq(req: Request): string | undefined {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return undefined;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return undefined;
}

export async function getSessionUser(req?: Request) {
  try {
    let token: string | undefined;
    if (req) {
      // اولویت ۱: کوکی httpOnly (در context اول-شخص).
      token = readCookieFromReq(req, SESSION_COOKIE);
      // اولویت ۲: هدر Authorization (در iframe که کوکی مسدود است).
      if (!token) token = readBearerFromReq(req);
    }
    if (!token) {
      const store = await cookies();
      token = store.get(SESSION_COOKIE)?.value;
    }
    // fallback بحرانی: حتی اگر هندلر req پاس نداده باشد،
    // هدر Authorization را از next/headers بخوانیم — این در iframe
    // که کوکی مسدود است نشست را حفظ می‌کند.
    if (!token) {
      const h = await headers();
      const auth =
        h.get("authorization") ?? h.get("Authorization") ?? undefined;
      if (auth && auth.toLowerCase().startsWith("bearer ")) {
        token = auth.slice(7).trim();
      }
    }
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    const user = await db.user.findUnique({ where: { id: payload.uid } });
    if (!user || user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * الزام کاربر واردشده و ACTIVE (+ در صورت تعیین نقش، عضویت در نقش‌ها).
 * در صورت عدم احراز، AuthError با status و پیام فارسی پرتاب می‌کند.
 */
export async function requireUser(roles?: Role[]) {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "ابتدا وارد شوید");
  if (user.status === "PENDING") {
    throw new AuthError(403, "حساب شما هنوز تایید نشده است");
  }
  if (user.status === "SUSPENDED") {
    throw new AuthError(403, "حساب شما موقتاً غیرفعال شده است");
  }
  if (user.status === "REJECTED") {
    throw new AuthError(403, "درخواست عضویت شما رد شده است");
  }
  if (roles && roles.length > 0 && !roles.includes(user.role as Role)) {
    throw new AuthError(403, "دسترسی لازم را ندارید");
  }
  return { user };
}

/** میان‌بر الزام ادمین */
export async function requireAdmin() {
  return requireUser(["ADMIN"]);
}

/**
 * الزام کاربر غیرمهمان (ADMIN | MANAGER | MEMBER).
 * مهمان‌ها (GUEST) می‌توانند بخش‌های فقط‌خواندنی را ببینند، اما
 * در عملیات نوشتن (ساخت ایده، رأی، بدهی، رویداد، پیام، عضویت گروه، نظر)
 * محدود می‌شوند. این helper را در POST handler های mutation استفاده کنید.
 */
export async function requireMemberOrHigher() {
  const { user } = await requireUser();
  if (user.role === "GUEST") {
    throw new AuthError(403, "این بخش برای اعضای مهمان محدود است");
  }
  return { user };
}

export const cookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};

/**
 * مدیریت یکپارچه خطاهای API — AuthError، خطای اعتبارسنجی Zod،
 * خطای یکتایی Prisma و خطای ناشناخته؛ پاسخ همیشه {error: پیام فارسی}.
 */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof z.ZodError) {
    const msg = e.issues[0]?.message ?? "داده‌های ارسالی معتبر نیست";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  // Prisma unique constraint
  const prismaErr = e as { code?: string; meta?: { target?: string[] } };
  if (prismaErr?.code === "P2002") {
    return NextResponse.json(
      { error: "این نام کاربری قبلاً گرفته شده است" },
      { status: 400 },
    );
  }
  console.error("[api-error]", e);
  return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
}
