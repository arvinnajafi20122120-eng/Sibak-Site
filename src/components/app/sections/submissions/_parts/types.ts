import type { SafeUser } from "@/lib/types";

/**
 * تایپ‌های بخش «تکالیف و پروژه‌ها».
 */

export type SubmissionStatus = "PENDING" | "REVIEWED" | "NEEDS_REVISION";

export interface SubmissionFileDTO {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface SubmissionListItem {
  id: string;
  title: string;
  description: string | null;
  status: SubmissionStatus;
  createdAt: string;
  reviewedAt: string | null;
  student: Pick<SafeUser, "id" | "name" | "username" | "avatar">;
  group: { id: string; name: string; color: string };
  files: SubmissionFileDTO[];
  reviewedBy?: Pick<SafeUser, "id" | "name" | "username"> | null;
}

export interface UploadedFileMeta {
  fileName: string;
  pathname: string;
  fileSize: number;
  mimeType: string;
}

export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; chip: string; dot: string }
> = {
  PENDING: {
    label: "در انتظار بررسی",
    chip: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
    dot: "bg-chart-2",
  },
  REVIEWED: {
    label: "بررسی شد",
    chip: "bg-chart-1/15 text-primary border-chart-1/40",
    dot: "bg-chart-1",
  },
  NEEDS_REVISION: {
    label: "نیاز به اصلاح",
    chip: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export interface TeacherContentItem {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  filePath: string | null;
  createdAt: string;
  teacher?: Pick<SafeUser, "id" | "name" | "username" | "avatar">;
  group?: { id: string; name: string; color: string; slug: string };
}

export interface MyGroupItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  /** وضعیت عضویت من — رشته (ACTIVE/PENDING) یا null */
  myMembership?: string | null;
}

/** لینک دانلود امن بر اساس filePath یا fileUrl */
export function fileHref(item: {
  filePath?: string | null;
  fileUrl?: string | null;
}): string | null {
  if (item.filePath) return `/api/files/${item.filePath}`;
  if (item.fileUrl && item.fileUrl.startsWith("/api/files/")) return item.fileUrl;
  return null;
}
