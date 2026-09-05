"use client";

import type { SafeUser } from "@/lib/types";
import type { EarnedMedalDTO } from "@/lib/medals";

export interface BadgeDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
  awardedAt: string | null;
}

export interface ActivityItem {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  relative: string;
  dateFa: string;
}

export interface MyProfile {
  user: SafeUser;
  stats: {
    badgesCount: number;
    medalsCount: number;
    ideasCount: number;
    pollsCount: number;
    debtsSettledCount: number;
    vetoBalance: number;
    iOwe: number;
    owedToMe: number;
    netDebt: number;
    points: number;
  };
  badges: BadgeDTO[];
  medals: EarnedMedalDTO[];
  activity: ActivityItem[];
  pointsSeries: { month: string; delta: number }[];
}

export interface PublicProfile {
  user: SafeUser;
  stats: {
    badgesCount: number;
    medalsCount: number;
    ideasCount: number;
    pollsCount: number;
    points: number;
  };
  badges: BadgeDTO[];
  medals: EarnedMedalDTO[];
  activity: ActivityItem[];
  isMe: boolean;
}

export interface LeaderboardRow {
  user: SafeUser;
  points: number;
  monthlyPoints: number;
  badgesCount: number;
  ideasCount: number;
  rank: number;
}

export const BADGE_COLOR: Record<string, string> = {
  emerald: "bg-chart-1/15 text-primary border-chart-1/40",
  rose: "bg-destructive/15 text-destructive border-destructive/30",
  amber: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  teal: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  orange: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

export const ACTION_ICONS: Record<string, string> = {
  IDEA_CREATE: "💡",
  IDEA_UPDATE: "✨",
  IDEA_DELETE: "🗑",
  IDEA_VOTE: "👍",
  POLL_CREATE: "🗳",
  POLL_VOTE: "🗳",
  POLL_CLOSE: "✅",
  POLL_VETO: "🛡",
  EVENT_CREATE: "📅",
  EVENT_DELETE: "🗑",
  GROUP_CREATE: "👥",
  GROUP_JOIN: "🚪",
  GROUP_LEAVE: "👋",
  ANNOUNCEMENT_CREATE: "📢",
  ANNOUNCEMENT_DELETE: "🗑",
  DEBT_CREATE: "🌱",
  DEBT_UPDATE: "✏️",
  DEBT_DELETE: "🗑",
  DEBT_SETTLE_REQUEST: "🤲",
  DEBT_SETTLE_CONFIRM: "🎉",
  DEBT_FORGIVE: "🤝",
  DEBT_REOPEN: "↩️",
  DEBT_COMMENT: "💬",
  BADGE_AWARD: "🏅",
  MEDAL_CREATE: "🎖",
  MEDAL_UPDATE: "✏️",
  MEDAL_DELETE: "🗑",
  MEDAL_AWARD: "🎖",
  MEDAL_REVOKE: "🚫",
  VETO_GRANT: "🛡",
  VETO_REVOKE: "🛡",
  USER_APPROVE: "✅",
  USER_REJECT: "❌",
  USER_SUSPEND: "⏸",
  USER_UPDATE_PROFILE: "👤",
  USER_UPDATE_PASSWORD: "🔐",
  SETTING_UPDATE: "⚙️",
};
