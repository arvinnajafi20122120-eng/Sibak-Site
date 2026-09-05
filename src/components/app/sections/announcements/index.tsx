"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Megaphone,
  Pin,
  Trash2,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { toFa, relativeTime, formatJalaliDateTime } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { ROLE_LABELS } from "@/components/app/nav";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { Announcement, AnnouncementLevel } from "../polls/_parts/types";
import { CreateAnnouncementDialog } from "./_parts/create-announcement-dialog";

const LEVEL_META: Record<
  AnnouncementLevel,
  { label: string; border: string; tint: string; icon: typeof Info; dot: string }
> = {
  INFO: {
    label: "اطلاعیه",
    border: "border-e-chart-1/50",
    tint: "bg-chart-1/5",
    icon: Info,
    dot: "bg-chart-1",
  },
  SUCCESS: {
    label: "موفقیت",
    border: "border-e-chart-1/60",
    tint: "bg-chart-1/10",
    icon: CheckCircle2,
    dot: "bg-chart-1",
  },
  WARNING: {
    label: "هشدار",
    border: "border-e-chart-2/60",
    tint: "bg-chart-2/10",
    icon: AlertTriangle,
    dot: "bg-chart-2",
  },
  URGENT: {
    label: "فوری",
    border: "border-e-destructive/60",
    tint: "bg-destructive/10",
    icon: AlertTriangle,
    dot: "bg-destructive",
  },
};

const GROUP_COLOR_BG: Record<string, string> = {
  emerald: "bg-chart-1/15 text-primary border-chart-1/30",
  rose: "bg-destructive/10 text-destructive border-destructive/30",
  amber: "bg-chart-2/15 text-accent-foreground border-chart-2/40",
  teal: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  orange: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

/**
 * پیام‌های همگانی سیبک — لیست + ساخت + ویرایش/حذف.
 */
export default function AnnouncementsSection() {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const canPost = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: Announcement[] }>("/api/announcements"),
    select: (res) => res.announcements,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/announcements/${id}`),
    onSuccess: () => {
      toast.success("پیام حذف شد");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["site-banner"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onChanged() {
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
    queryClient.invalidateQueries({ queryKey: ["site-banner"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const items = data ?? [];

  return (
    <section className="flex flex-col gap-5" aria-label="پیام‌های همگانی">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-chart-2/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Megaphone className="size-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">پیام‌های همگانی</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
                اطلاعیه‌های مهم ادمین و مدیران: از جلسات فوری تا خوش‌آمدگویی‌ها و فرصت‌های جدید.
              </p>
            </div>
          </div>
          {canPost && (
            <Button
              type="button"
              className="gap-2 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Megaphone className="size-4" aria-hidden />
              ساخت پیام
            </Button>
          )}
        </div>
      </div>

      {/* لیست */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/70 bg-background/30 p-12 text-center">
          <Megaphone className="size-12 text-muted-foreground/50" aria-hidden />
          <p className="text-lg font-bold">هنوز پیامی منتشر نشده است.</p>
          <p className="text-sm text-muted-foreground">
            {canPost
              ? "اولین پیام همگانی را برای اعضا ارسال کنید."
              : "اطلاعیه‌های جدید در این صفحه نمایش داده می‌شوند."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a, i) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              canManage={canPost && (a.createdBy?.id === user?.id || user?.role === "ADMIN")}
              onDelete={() => deleteMutation.mutate(a.id)}
              index={i}
            />
          ))}
        </div>
      )}

      <CreateAnnouncementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChanged}
      />
    </section>
  );
}

function AnnouncementCard({
  announcement,
  canManage,
  onDelete,
  index,
}: {
  announcement: Announcement;
  canManage: boolean;
  onDelete: () => void;
  index: number;
}) {
  const meta = LEVEL_META[announcement.level as AnnouncementLevel] ?? LEVEL_META.INFO;
  const Icon = meta.icon;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(0.05 * index, 0.3) }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 border-e-4 bg-background/40 backdrop-blur-sm",
        meta.border,
        meta.tint,
        announcement.pinned && "ring-1 ring-chart-2/40",
      )}
    >
      <div className="flex flex-col gap-3 p-4 md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                meta.tint,
              )}
            >
              <Icon className="size-5 text-foreground" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold md:text-lg">{announcement.title}</h3>
                {announcement.pinned && (
                  <Badge className="gap-1 bg-chart-2/15 text-accent-foreground">
                    <Pin className="size-3" aria-hidden />
                    سنجاق
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1 px-2 text-[10px]">
                  <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
                  {meta.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {announcement.createdBy && (
                  <span>
                    {announcement.createdBy.name}
                    <span className="ms-1 text-muted-foreground/60">
                      ({ROLE_LABELS[announcement.createdBy.role as keyof typeof ROLE_LABELS]})
                    </span>
                  </span>
                )}
                <span>·</span>
                <span>{relativeTime(new Date(announcement.createdAt))}</span>
                <span>·</span>
                <span>{formatJalaliDateTime(new Date(announcement.createdAt))}</span>
                {announcement.group && (
                  <>
                    <span>·</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 px-1.5 text-[10px]",
                        GROUP_COLOR_BG[announcement.group.color] ?? GROUP_COLOR_BG.emerald,
                      )}
                    >
                      <Users className="size-3" aria-hidden />
                      {announcement.group.name}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  حذف
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف پیام</AlertDialogTitle>
                  <AlertDialogDescription>
                    آیا از حذف این پیام مطمئنید؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onDelete}
                  >
                    بله، حذف کن
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </header>

        <p className="whitespace-pre-line text-sm leading-7 text-foreground/80">
          {announcement.body}
        </p>
      </div>
    </motion.article>
  );
}
