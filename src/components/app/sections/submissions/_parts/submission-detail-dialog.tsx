"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileText,
  Paperclip,
  PenLine,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliDateTime, relativeTime, toFa } from "@/lib/jalali";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  GROUP_COLOR_BADGE,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";

import {
  SUBMISSION_STATUS_META,
  type SubmissionListItem,
  type SubmissionStatus,
} from "./types";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * دیالوگ جزئیات ارسال تکلیف — فایل‌ها با دانلود، وضعیت بازبینی و
 * دکمه‌های بازبینی برای استاد همان کلاس یا ادمین/مدیر.
 */
export function SubmissionDetailDialog({
  submission,
  canReview,
  onClose,
}: {
  submission: SubmissionListItem | null;
  canReview: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: (status: SubmissionStatus) =>
      api.patch<{ submission: SubmissionListItem }>(
        `/api/submissions/${submission!.id}`,
        { status },
      ),
    onSuccess: (data) => {
      toast.success(
        data.submission.status === "REVIEWED"
          ? "تکلیف تایید شد ✅"
          : "به دانش‌آموز اعلام شد که اصلاح لازم است",
      );
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submission", submission!.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = !!submission;
  const meta = submission ? SUBMISSION_STATUS_META[submission.status] : null;
  const colorCls = submission
    ? GROUP_COLOR_BADGE[normalizeColor(submission.group.color)]
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {submission && meta ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">
                {submission.title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className={`gap-1.5 ${meta.chip}`}>
                  <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </Badge>
                <Badge variant="outline" className={colorCls}>
                  {submission.group.name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(new Date(submission.createdAt))}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              {/* دانش‌آموز */}
              <div className="glass flex items-center gap-3 rounded-2xl p-3">
                <SafeAvatar user={submission.student} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{submission.student.name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    @{submission.student.username}
                  </p>
                </div>
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>

              {/* توضیحات */}
              {submission.description && (
                <p className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm leading-7">
                  {submission.description}
                </p>
              )}

              {/* فایل‌ها */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold">
                  پیوست‌ها ({toFa(submission.files.length)})
                </p>
                {submission.files.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                    فایلی پیوست نشده است.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {submission.files.map((f) => (
                      <li key={f.id}>
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                          aria-label={`دانلود ${f.fileName}`}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {f.fileName}
                            </span>
                            <span className="block text-xs text-muted-foreground" dir="ltr">
                              {formatSize(f.fileSize)}
                            </span>
                          </span>
                          <Download className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {submission.reviewedBy && submission.reviewedAt && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    بازبین: {submission.reviewedBy.name} —{" "}
                    {formatJalaliDateTime(new Date(submission.reviewedAt))}
                  </p>
                </>
              )}
            </div>

            {/* اکشن‌های بازبینی */}
            {canReview && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => reviewMutation.mutate("NEEDS_REVISION")}
                  disabled={reviewMutation.isPending || submission.status === "NEEDS_REVISION"}
                >
                  <PenLine className="size-4" aria-hidden />
                  نیاز به اصلاح
                </Button>
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() => reviewMutation.mutate("REVIEWED")}
                  disabled={reviewMutation.isPending || submission.status === "REVIEWED"}
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  تایید تکلیف
                </Button>
                {reviewMutation.isPending && (
                  <Skeleton className="h-9 w-24 rounded-xl" />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3 py-6">
            <Skeleton className="h-7 w-2/3 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Paperclip className="hidden" aria-hidden />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
