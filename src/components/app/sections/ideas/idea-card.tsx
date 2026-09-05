"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { relativeTime, toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { IdeaStatusBadge } from "@/components/app/sections/_shared/idea-status-badge";
import { GROUP_COLOR_BADGE, normalizeColor } from "@/components/app/sections/_shared/group-colors";
import type { IdeaListItem } from "@/components/app/sections/_shared/types";

/**
 * کارت ایده — در #/ideas و در فراخوانی‌های پروژه گروه.
 * ویژگی‌ها: آواتار نویسنده + چیپ گروه + زمان نسبی، بَج وضعیت، دکمه رأی،
 * شمارنده کامنت، منوی ویرایش/حذف برای نویسنده، منوی وضعیت برای ادمین/مدیر.
 */
export function IdeaCard({
  idea,
  onOpenDetail,
  onEdit,
}: {
  idea: IdeaListItem;
  onOpenDetail: (idea: IdeaListItem) => void;
  onEdit?: (idea: IdeaListItem) => void;
}) {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthor = user?.id === idea.author.id;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canManage = isAuthor || isAdmin;
  const groupColor = normalizeColor(idea.group?.color);

  const voteMutation = useMutation({
    mutationFn: () => api.post<{ myVote: boolean; votesCount: number }>(`/api/ideas/${idea.id}/vote`),
    onMutate: async () => {
      // بهینه‌سازی فوری
      await queryClient.cancelQueries({ queryKey: ["ideas"] });
      queryClient.setQueriesData<{ ideas: IdeaListItem[] }>(
        { queryKey: ["ideas"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            ideas: old.ideas.map((i) =>
              i.id === idea.id
                ? {
                    ...i,
                    myVote: !i.myVote,
                    votesCount: i.votesCount + (i.myVote ? -1 : 1),
                  }
                : i,
            ),
          };
        },
      );
    },
    onError: (e) => {
      // برگشت
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.error(e instanceof Error ? e.message : "خطا در ثبت رأی");
    },
    onSuccess: (data) => {
      queryClient.setQueriesData<{ ideas: IdeaListItem[] }>(
        { queryKey: ["ideas"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            ideas: old.ideas.map((i) =>
              i.id === idea.id
                ? { ...i, myVote: data.myVote, votesCount: data.votesCount }
                : i,
            ),
          };
        },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/ideas/${idea.id}`),
    onSuccess: () => {
      toast.success("ایده حذف شد");
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "خطا در حذف ایده");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: IdeaListItem["status"]) =>
      api.patch(`/api/ideas/${idea.id}`, { status }),
    onSuccess: (_data, newStatus) => {
      toast.success(`وضعیت ایده به‌روزرسانی شد`);
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["idea", idea.id] });
      void newStatus;
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "خطا در تغییر وضعیت");
    },
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass card-hover relative flex flex-col gap-3 rounded-2xl p-5 text-right",
        idea.status === "PENDING" && isAdmin && "ring-1 ring-chart-2/40",
      )}
    >
      {/* سرخط: نویسنده + زمان + وضعیت */}
      <div className="flex items-center gap-2.5">
        <SafeAvatar user={idea.author} className="size-8" />
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-bold">{idea.author.name}</span>
          <span className="text-[11px] text-muted-foreground">
            {relativeTime(new Date(idea.createdAt))}
          </span>
        </div>
        <IdeaStatusBadge status={idea.status} />
      </div>

      {/* گروه و عنوان و توضیحات */}
      <button
        type="button"
        onClick={() => onOpenDetail(idea)}
        className="flex flex-col gap-1.5 text-right"
      >
        {idea.group && (
          <Badge
            variant="outline"
            className={cn(
              "w-fit gap-1 text-[10px] font-semibold",
              GROUP_COLOR_BADGE[groupColor],
            )}
          >
            <Users className="size-3" aria-hidden />
            {idea.group.name}
          </Badge>
        )}
        <h3 className="text-base font-extrabold leading-7">{idea.title}</h3>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {idea.description}
        </p>
      </button>

      {/* فوتر: رأی + کامنت + منو */}
      <div className="mt-1 flex items-center gap-1.5">
        <Button
          type="button"
          variant={idea.myVote ? "default" : "outline"}
          size="sm"
          className="h-9 min-h-9 gap-1.5 rounded-xl px-3"
          onClick={() => voteMutation.mutate()}
          disabled={voteMutation.isPending}
          aria-pressed={idea.myVote}
        >
          {voteMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ThumbsUp
              className={cn("size-4", idea.myVote && "fill-current")}
              aria-hidden
            />
          )}
          <motion.span
            key={idea.votesCount}
            initial={{ scale: 0.6, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="text-xs font-black tabular-nums"
          >
            {toFa(idea.votesCount)}
          </motion.span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 gap-1.5 rounded-xl px-3 text-muted-foreground"
          onClick={() => onOpenDetail(idea)}
        >
          <MessageSquare className="size-4" aria-hidden />
          <span className="text-xs font-bold tabular-nums">
            {toFa(idea.commentsCount)}
          </span>
        </Button>

        {canManage && (
          <div className="me-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg"
                  aria-label="اقدامات"
                >
                  <MoreVertical className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onEdit && isAuthor && idea.status === "PENDING" && (
                  <DropdownMenuItem onSelect={() => onEdit(idea)}>
                    <Pencil className="size-4" aria-hidden />
                    ویرایش
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuLabel>تغییر وضعیت</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => statusMutation.mutate("APPROVED")}>
                      <Check className="size-4 text-primary" aria-hidden />
                      تاییدشده
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => statusMutation.mutate("IN_PROGRESS")}>
                      <Clock className="size-4 text-foreground/70" aria-hidden />
                      در حال اجرا
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => statusMutation.mutate("DONE")}>
                      <Check className="size-4 text-primary" aria-hidden />
                      انجام‌شده
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => statusMutation.mutate("REJECTED")}>
                      <X className="size-4 text-destructive" aria-hidden />
                      ردشده
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canManage && (
                  <DropdownMenuItem
                    onSelect={() => setConfirmDelete(true)}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    حذف ایده
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ایده</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف ایده «{idea.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "در حال حذف…" : "حذف کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export function IdeaCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2 w-1/4" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-1 h-3 w-full" />
      <Skeleton className="mb-4 h-3 w-5/6" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16 rounded-xl" />
        <Skeleton className="h-9 w-12 rounded-xl" />
      </div>
    </div>
  );
}
