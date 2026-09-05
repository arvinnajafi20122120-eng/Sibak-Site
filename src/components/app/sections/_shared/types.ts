/**
 * تایپ‌های مشترک کلاینت برای سکشن‌های گروه/ایده/تقویم.
 */
import type { SafeUser } from "@/lib/types";

export interface GroupListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  joinPolicy: "OPEN" | "REQUEST" | "INVITE";
  createdAt: string;
  leader: SafeUser | null;
  memberCount: number;
  ideasCount: number;
  myMembership: "PENDING" | "ACTIVE" | "REJECTED" | null;
}

export interface GroupMember {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  joinedAt: string;
  user: SafeUser;
}

export interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  joinPolicy: "OPEN" | "REQUEST" | "INVITE";
  createdAt: string;
  leader: SafeUser | null;
  memberCount: number;
  myMembership: "PENDING" | "ACTIVE" | "REJECTED" | null;
  canManage: boolean;
}

export interface GroupDetailResponse {
  group: GroupDetail;
  members: GroupMember[];
  ideas: IdeaListItem[];
  events: CalendarEventListItem[];
}

export interface IdeaGroupRef {
  id: string;
  name: string;
  color: string;
}

export interface IdeaListItem {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED" | "IN_PROGRESS" | "DONE" | "REJECTED";
  author: SafeUser;
  group: IdeaGroupRef | null;
  groupId: string | null;
  votesCount: number;
  commentsCount: number;
  myVote: boolean;
  createdAt: string;
}

export interface IdeaComment {
  id: string;
  body: string;
  author: SafeUser;
  createdAt: string;
}

export interface IdeaVoter {
  id: string;
  user: SafeUser;
  createdAt: string;
}

export interface IdeaDetailResponse {
  idea: {
    id: string;
    title: string;
    description: string;
    status: IdeaListItem["status"];
    author: SafeUser;
    group: IdeaGroupRef | null;
    groupId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  voters: IdeaVoter[];
  votesCount: number;
  myVote: boolean;
  comments: IdeaComment[];
  commentsCount: number;
  canManage: boolean;
}

export interface CalendarEventListItem {
  id: string;
  title: string;
  description: string | null;
  type: "GENERAL" | "EXAM" | "HOMEWORK" | "MEETING" | "HOLIDAY" | "PROJECT";
  date: string;
  endDate: string | null;
  groupId: string | null;
  group?: { id: string; name: string; color: string } | null;
  createdBy: SafeUser;
  createdAt: string;
}

export interface GroupOption {
  id: string;
  name: string;
  color: string;
  icon: string;
  joinPolicy: string;
}
