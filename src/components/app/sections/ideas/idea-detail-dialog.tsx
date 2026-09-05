"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Loader2, Send, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliDateTime, relativeTime, toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { IdeaStatusBadge } from "@/components/app/sections/_shared/idea-status-badge";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import type { IdeaComment, IdeaDetailResponse, IdeaListItem } from "@/components/app/sections/_shared/types";

/**
 * دیالوگ جزئیات ایده + کامنت‌ها + رأی.
 */
export function IdeaDetailDialog({
  idea,
  onClose,
}: {
  idea: IdeaListItem | null;
  onClose: () => void;
}) {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["idea", idea?.id],
    queryFn: () => api.get<IdeaDetailResponse>(`/api/ideas/${idea?.id}`),
    enabled: !!idea,
  });

  const voteMutation = useMutation({
    mutationFn: () => api.post<{ myVote: boolean; votesCount: number }>(`/api/ideas/${idea?.id}/vote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea", idea?.id] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ثبت رأی"),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      api.post<{ comment: IdeaComment }>(`/api/comments`, {
        entityType: "IDEA",
        entityId: idea?.id,
        body,
      }),
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["idea", idea?.id] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("نظر شما ثبت شد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ثبت نظر"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.del(`/api/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea", idea?.id] });
      toast.success("نظر حذف شد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف نظر"),
  });

  function submitComment() {
    const body = commentBody.trim();
    if (!body) return;
    commentMutation.mutate(body);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  }

  return (
    <Dialog open={!!idea} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-base font-extrabold">
            {idea?.title ?? "ایده"}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="p-5">
            <Skeleton className="mb-3 h-3 w-1/3" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-5 pb-5">
            {/* توضیحات کامل */}
            <div>
              <div className="mb-2 flex items-center gap-2.5">
                <SafeAvatar user={data.idea.author} className="size-8" />
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-bold">{data.idea.author.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {relativeTime(new Date(data.idea.createdAt))}
                  </span>
                </div>
                <IdeaStatusBadge status={data.idea.status} />
              </div>
              <p className="text-sm leading-7 text-foreground/85">
                {data.idea.description}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                {formatJalaliDateTime(new Date(data.idea.createdAt))}
              </p>
            </div>

            {/* رأی + رأیدهندگان */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">
              <Button
                type="button"
                variant={data.myVote ? "default" : "outline"}
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => voteMutation.mutate()}
                disabled={voteMutation.isPending}
              >
                {voteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ThumbsUp className={cn("size-4", data.myVote && "fill-current")} aria-hidden />
                )}
                <span className="text-xs font-black tabular-nums">{toFa(data.votesCount)}</span>
              </Button>
              <div className="flex -space-x-2 space-x-reverse">
                {data.voters.slice(0, 6).map((v) => (
                  <SafeAvatar key={v.id} user={v.user} className="size-7 ring-2 ring-background" />
                ))}
                {data.voters.length > 6 && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold ring-2 ring-background">
                    {toFa(`+${data.voters.length - 6}`)}
                  </span>
                )}
              </div>
              <span className="ms-auto text-[11px] text-muted-foreground">
                {toFa(data.voters.length)} رأی
              </span>
            </div>

            {/* کامنت‌ها */}
            <div className="flex flex-col gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-bold">
                <span>💬</span>
                نظرات
                <span className="text-[11px] text-muted-foreground">
                  ({toFa(data.comments.length)})
                </span>
              </h4>

              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pe-1">
                {data.comments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    هنوز نظری ثبت نشده — اولین نفر باش!
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {data.comments.map((c) => {
                      const canDelete =
                        user?.id === c.author.id || user?.role === "ADMIN";
                      return (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-start gap-2.5 rounded-xl bg-background/50 p-2.5"
                        >
                          <SafeAvatar user={c.author} className="size-7" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-bold">{c.author.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {relativeTime(new Date(c.createdAt))}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {c.body}
                            </p>
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => deleteCommentMutation.mutate(c.id)}
                              className="mt-0.5 size-7 rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label="حذف نظر"
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* ورودی کامنت */}
              <div className="mt-1 flex flex-col gap-2">
                <Textarea
                  dir="rtl"
                  rows={2}
                  placeholder="نظرت رو بنویس… (Enter برای ثبت، Shift+Enter برای خط جدید)"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value.slice(0, 1000))}
                  onKeyDown={handleKeyDown}
                  className="min-h-12 resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {toFa(commentBody.length)}/۱۰۰۰
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 min-h-9 gap-1.5 rounded-xl"
                    onClick={submitComment}
                    disabled={!commentBody.trim() || commentMutation.isPending}
                  >
                    {commentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    ثبت نظر
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** دیالوگ بدون ایده (هنگام بسته بودن). */
export function IdeaDetailDialogEmpty() {
  return (
    <EmptyState
      icon={Lightbulb}
      title="هیچ ایده‌ای برای نمایش نیست"
    />
  );
}
