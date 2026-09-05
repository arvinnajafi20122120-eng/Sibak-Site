/**
 * تایپ‌های مشترک سیبک — قابل استفاده در سرور و کلاینت.
 * SafeUser: کاربر بدون فیلد password (هرگز پسورد را به کلاینت نفرستید).
 */

export type Role = "ADMIN" | "MANAGER" | "TEACHER" | "MEMBER" | "GUEST";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface SafeUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  joinReason: string | null;
  skills: string | null;
  bio: string | null;
  avatar: string | null;
  points: number;
  rejectionNote: string | null;
  guestExpiresAt: string | null;
  guestScope: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SiteRule {
  title: string;
  body: string;
}

export interface SiteSettings {
  siteName: string;
  siteTagline: string;
  logo: string | null;
  allowRegistration: boolean;
  rubikaBot: string;
  siteRules: SiteRule[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function toSafeUser(u: {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  role: string;
  status: string;
  joinReason?: string | null;
  skills?: string | null;
  bio?: string | null;
  avatar?: string | null;
  points: number;
  rejectionNote?: string | null;
  guestExpiresAt?: Date | null;
  guestScope?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  password?: string;
}): SafeUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email ?? null,
    role: u.role as Role,
    status: u.status as UserStatus,
    joinReason: u.joinReason ?? null,
    skills: u.skills ?? null,
    bio: u.bio ?? null,
    avatar: u.avatar ?? null,
    points: u.points,
    rejectionNote: u.rejectionNote ?? null,
    guestExpiresAt: u.guestExpiresAt ? u.guestExpiresAt.toISOString() : null,
    guestScope: u.guestScope ?? null,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}
