"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  ClipboardList,
  Download,
  FileText,
  Inbox,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { relativeTime, toFa } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  GROUP_COLOR_BADGE,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";

import {
  SUBMISSION_STATUS_META,
  fileHref,
  type MyGroupItem,
  type SubmissionListItem,
  type SubmissionStatus,
  type TeacherContentItem,
} from "./_parts/types";
import { CreateSubmissionDialog } from "./_parts/create-submission-dialog";
import { SubmissionDetailDialog } from "./_parts/submission-detail-dialog";

type Tab = "mine" | "review" | "content";
type StatusFilter = "ALL" | SubmissionStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "همه" },
  { key: "PENDING", label: "در انتظار بررسی" },
  { key: "REVIEWED", label: "بررسی‌شده" },
  { key: "NEEDS_REVISION", label: "نیاز به اصلاح" },
];

/**
 * بخش «تکالیف و پروژه‌ها»:
 *  - ارسالی‌های من: دانش‌آموز پروژه می‌فرستد و وضعیتش را می‌بیند.
 *  - بررسی ارسال‌ها: استادِ کلاس (یا ادمین/مدیر) ارسال‌ها را می‌بیند و بازبینی می‌کند.
 *  - محتوای کلاس: محتوای آموزشی منتشرشده اساتید هر کلاس + دانلود فایل.
 */
export default function SubmissionsSection() {
  const user = useSession((s) => s.user);
  const role = user?.role;

  const isStudentLike = role === "MEMBER" || role === "MANAGER" || role === "ADMIN";
  const canReview = role === "TEACHER" || role === "ADMIN" || role === "MANAGER";

  const defaultTab: Tab = role === "TEACHER" ? "review" : isStudentLike ? "mine" : "content";
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  /* ---------- داده تب‌ها ---------- */
  const mineQ = useQuery({
    queryKey: ["submissions", "mine"],
    queryFn: () =>
      api.get<{ submissions: SubmissionListItem[] }>("/api/submissions"),
    enabled: tab === "mine",
  });

  const reviewQ = useQuery({
    queryKey: ["submissions", "review"],
    queryFn: () =>
      api.get<{ submissions: SubmissionListItem[] }>("/api/submissions"),
    enabled: tab === "review",
  });

  const myGroupsQ = useQuery({
    queryKey: ["submissions", "my-groups"],
    queryFn: () => api.get<{ groups: MyGroupItem[] }>("/api/groups?mine=1"),
    enabled: tab === "content",
  });

  const [contentGroupId, setContentGroupId] = useState<string>("");
  const activeGroups = useMemo(
    () =>
      (myGroupsQ.data?.groups ?? []).filter(
        (g) => g.myMembership === "ACTIVE",
      ),
    [myGroupsQ.data],
  );

  const effectiveContentGroup =
    contentGroupId && activeGroups.some((g) => g.id === contentGroupId)
      ? contentGroupId
      : (activeGroups[0]?.id ?? "");

  const contentQ = useQuery({
    queryKey: ["teacher-content", "group", effectiveContentGroup],
    queryFn: () =>
      api.get<{ contents: TeacherContentItem[] }>(
        `/api/teacher/content?groupId=${effectiveContentGroup}`,
      ),
    enabled: tab === "content" && !!effectiveContentGroup,
  });

  const selected = useMemo(() => {
    const pool = [...(mineQ.data?.submissions ?? []), ...(reviewQ.data?.submissions ?? [])];
    return pool.find((s) => s.id === selectedId) ?? null;
  }, [selectedId, mineQ.data, reviewQ.data]);

  const mine = mineQ.data?.submissions ?? [];
  const review = useMemo(() => {
    const list = reviewQ.data?.submissions ?? [];
    if (statusFilter === "ALL") return list;
    return list.filter((s) => s.status === statusFilter);
  }, [reviewQ.data, statusFilter]);

  const pendingCount = (reviewQ.data?.submissions ?? []).filter(
    (s) => s.status === "PENDING",
  ).length;

  return (
    <section className="flex flex-col gap-5" aria-label="تکالیف و پروژه‌ها">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 size-56 animate-blob rounded-full bg-chart-4/15 blur-3xl [animation-delay:-6s]"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="size-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">تکالیف و پروژه‌ها 📚</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
                پروژه‌ات را بفرست، بازخورد بگیر؛ و محتوای آموزشی کلاس‌هایت همیشه این‌جاست.
              </p>
            </div>
          </div>
          {isStudentLike && (
            <Button
              type="button"
              className="no-print gap-2 rounded-xl"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              ارسال پروژه
            </Button>
          )}
        </div>
      </div>

      {/* تب‌ها */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="no-print">
        <TabsList className="flex h-11 w-full flex-wrap justify-start gap-1 rounded-2xl bg-secondary/50 p-1">
          {isStudentLike && (
            <TabsTrigger value="mine" className="rounded-xl">
              ارسالی‌های من
            </TabsTrigger>
          )}
          {canReview && (
            <TabsTrigger value="review" className="gap-1.5 rounded-xl">
              بررسی ارسال‌ها
              {pendingCount > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                  {toFa(pendingCount)}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="content" className="rounded-xl">
            محتوای کلاس
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ---------- تب ارسالی‌های من ---------- */}
      {tab === "mine" && isStudentLike && (
        <SubmissionList
          loading={mineQ.isLoading}
          items={mine}
          emptyTitle="هنوز چیزی نفرستاده‌ای"
          emptyDescription="اولین پروژه‌ات را بفرست تا استاد بررسی کند."
          onOpen={setSelectedId}
          emptyIcon={Inbox}
        />
      )}

      {/* ---------- تب بررسی ارسال‌ها ---------- */}
      {tab === "review" && canReview && (
        <div className="flex flex-col gap-4">
          <div className="no-print flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                  statusFilter === f.key
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
                aria-pressed={statusFilter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
          <SubmissionList
            loading={reviewQ.isLoading}
            items={review}
            emptyTitle={
              statusFilter === "ALL" ? "هیچ ارسالی وجود ندارد" : "در این وضعیت ارسالی نیست"
            }
            emptyDescription={
              role === "TEACHER"
                ? "ارسال‌های دانش‌آموزان کلاس‌هایی که استادش هستی این‌جا دیده می‌شود."
                : "همه ارسال‌های سایت این‌جا جمع می‌شود."
            }
            onOpen={setSelectedId}
            emptyIcon={BookOpenCheck}
            showStudent
          />
        </div>
      )}

      {/* ---------- تب محتوای کلاس ---------- */}
      {tab === "content" && (
        <div className="flex flex-col gap-4">
          {activeGroups.length === 0 ? (
            <EmptyState
              icon={BookOpenCheck}
              title="عضو کلاسی نیستی"
              description="از بخش «زیرمجموعه‌ها» عضو یک کلاس شو تا محتوای آموزشی‌اش را ببینی."
            />
          ) : (
            <>
              <div className="no-print flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground">کلاس:</span>
                <Select
                  value={effectiveContentGroup}
                  onValueChange={setContentGroupId}
                  dir="rtl"
                >
                  <SelectTrigger className="h-10 w-56 rounded-xl">
                    <SelectValue placeholder="انتخاب کلاس…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {contentQ.isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                  ))}
                </div>
              ) : (contentQ.data?.contents ?? []).length === 0 ? (
                <EmptyState
                  icon={BookOpenCheck}
                  title="هنوز محتوایی منتشر نشده"
                  description="استاد این کلاس هنوز جزوه یا محتوایی منتشر نکرده است."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {contentQ.data!.contents.map((c, i) => (
                    <TeacherContentCard key={c.id} item={c} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CreateSubmissionDialog open={createOpen} onOpenChange={setCreateOpen} />

      <SubmissionDetailDialog
        submission={selected}
        canReview={canReview}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}

/* ---------- کارت ارسال ---------- */
function SubmissionCard({
  item,
  index,
  showStudent,
  onOpen,
}: {
  item: SubmissionListItem;
  index: number;
  showStudent?: boolean;
  onOpen: () => void;
}) {
  const meta = SUBMISSION_STATUS_META[item.status];
  const colorCls = GROUP_COLOR_BADGE[normalizeColor(item.group.color)];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      onClick={onOpen}
      className="glass card-hover group flex flex-col gap-3 rounded-2xl border p-4 text-right"
      aria-label={`باز کردن ارسال ${item.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-black leading-6">{item.title}</h3>
        <Badge variant="outline" className={`shrink-0 gap-1.5 ${meta.chip}`}>
          <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label}
        </Badge>
      </div>

      {item.description && (
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {item.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={colorCls}>
          {item.group.name}
        </Badge>
        {showStudent && (
          <span className="inline-flex items-center gap-1.5">
            <SafeAvatar user={item.student} className="size-5 text-[10px]" />
            {item.student.name}
          </span>
        )}
        {item.files.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden />
            {toFa(item.files.length)} پیوست
          </span>
        )}
        <span className="ms-auto">{relativeTime(new Date(item.createdAt))}</span>
      </div>
    </motion.button>
  );
}

/* ---------- لیست ارسال‌ها + حالت خالی ---------- */
function SubmissionList({
  loading,
  items,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  showStudent,
  onOpen,
}: {
  loading: boolean;
  items: SubmissionListItem[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: LucideIcon;
  showStudent?: boolean;
  onOpen: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((s, i) => (
        <SubmissionCard
          key={s.id}
          item={s}
          index={i}
          showStudent={showStudent}
          onOpen={() => onOpen(s.id)}
        />
      ))}
    </div>
  );
}

/* ---------- کارت محتوای استاد ---------- */
export function TeacherContentCard({
  item,
  index = 0,
}: {
  item: TeacherContentItem;
  index?: number;
}) {
  const href = fileHref(item);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="glass flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-black leading-6">{item.title}</h3>
        <Badge
          variant="outline"
          className="shrink-0 border-chart-5/40 bg-chart-5/15 text-chart-5"
        >
          {item.subject}
        </Badge>
      </div>

      {item.description && (
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {item.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.teacher && (
          <span className="inline-flex items-center gap-1.5">
            <SafeAvatar user={item.teacher} className="size-5 text-[10px]" />
            {item.teacher.name}
          </span>
        )}
        <span>{relativeTime(new Date(item.createdAt))}</span>
      </div>

      {href && (
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            {item.fileName ? (
              <>
                <Download className="size-4" aria-hidden />
                {item.fileName}
              </>
            ) : (
              <>
                <Download className="size-4" aria-hidden />
                دانلود فایل
              </>
            )}
          </a>
        </Button>
      )}
    </motion.div>
  );
}
