"use client";

import type { SafeUser } from "@/lib/types";

/**
 * تایپ‌های مشترک بخش نظرسنجی‌ها — منطبق با پاسخ API.
 */
export interface PollOption {
  id: string;
  text: string;
  votesCount: number;
  voters: SafeUser[];
}

export type PollType = "NORMAL" | "VETO_GRANT";
export type PollStatus = "OPEN" | "CLOSED" | "VETOED";

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: PollType;
  status: PollStatus;
  isAnonymous: boolean;
  closesAt: string | null;
  createdAt: string;
  createdBy: SafeUser | null;
  group: { id: string; name: string; slug: string; color: string } | null;
  options: PollOption[];
  totalVotes: number;
  myVote: { optionId: string } | null;
  targetUser: SafeUser | null;
  vetoAmount: number | null;
  granted: boolean;
}

export interface GroupLite {
  id: string;
  name: string;
  slug: string;
  color: string;
}

/** نوع پاسخ /api/vetoes */
export interface VetoLedgerEntry {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
  sourcePoll: { id: string; title: string; type: string; status: string } | null;
}

export interface VetoedPoll {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: SafeUser | null;
  vetoer: SafeUser | null;
  reason: string;
}

export interface GrantPoll {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  closesAt: string | null;
  targetUser: SafeUser | null;
  vetoAmount: number | null;
  yesVotes: number;
  noVotes: number;
}

export interface VetoSummary {
  balance: number;
  ledger: VetoLedgerEntry[];
  vetoedPolls: VetoedPoll[];
  grantPolls: GrantPoll[];
}

export type AnnouncementLevel = "INFO" | "SUCCESS" | "WARNING" | "URGENT";
export type AnnouncementAudience = "ALL" | "GROUP";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  pinned: boolean;
  audience: AnnouncementAudience;
  createdAt: string;
  updatedAt: string;
  createdBy: SafeUser | null;
  group: GroupLite | null;
}
