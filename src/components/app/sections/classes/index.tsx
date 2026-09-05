"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  LogIn,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { GroupIcon } from "@/components/app/sections/_shared/lucide-icons";
import {
  GROUP_COLOR_BADGE,
  GROUP_COLOR_GRADIENT,
  GROUP_COLOR_TEXT_ON_GRADIENT,
  JOIN_POLICY_LABELS,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";

/**
 * سکشن «کلاس‌ها» — مستقل از زیرمجموعه‌ها.
 *
 * کلاس = گروهی که استاد در آن تخصیص یافته است (TeacherGroup).
 * کارت کلاس نشان می‌دهد: اساتید، شمار دانش‌آموزان، شمار محتوای منتشرشده،
 * وضعیت عضویت من + اقدام‌ها: عضویت / مشاهده جزئیات / محتوای کلاس / ارسال تکلیف.
 */
interface ClassItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  joinPolicy: "OPEN" | "REQUEST" | "INVITE";
  createdAt: string;
  teachers: { id: string; name: string; username: string; avatar: string | null }[];
  studentCount: number;
  contentCount: number;
  myMembership: "ACTIVE" | "PENDING" | "REJECTED" | null;
}

export default function ClassesSection() {
  const user = useSession((s) => s.user);
  const { navigate } = useHashRoute();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassItem[] }>("/api/classes"),
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.post<{ status: string }>(`/api/groups/${id}/join`),
    onSuccess: (res) => {
      toast.success(res.status === "ACTIVE" ? "به کلاس پیوستید!" : "درخواست عضویت در کلاس ثبت شد");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در عضویت"),
  });

  const classes = data?.classes ?? [];

  return (
    <section className="flex flex-col gap-5" aria-label="کلاس‌ها">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-chart-2/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 size-56 animate-blob rounded-full bg-chart-5/15 blur-3xl [animation-delay:-6s]"
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">کلاس‌ها 🎓</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
              کلاس‌های درسی با استاد، دانش‌آموز و محتوای آموزشی — جدا از گروه‌های
              مطالعاتی؛ این‌جا کلاس خودت را پیدا کن و عضو شو.
            </p>
          </div>
        </div>
      </div>

      {/* محتوا */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="هنوز کلاسی ساخته نشده"
          description="وقتی ادمین برای یک گروه، استاد تخصیص دهد، آن گروه به‌عنوان کلاس در این‌جا دیده می‌شود."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {classes.map((c, i) => (
            <ClassCard
              key={c.id}
              item={c}
              index={i}
              busy={joinMutation.isPending && joinMutation.variables === c.id}
              onJoin={() => joinMutation.mutate(c.id)}
              onDetail={() => navigate(`/groups/${c.id}`)}
              onContent={() => navigate("/submissions")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- کارت کلاس ---------- */
function ClassCard({
  item,
  index,
  busy,
  onJoin,
  onDetail,
  onContent,
}: {
  item: ClassItem;
  index: number;
  busy?: boolean;
  onJoin: () => void;
  onDetail: () => void;
  onContent: () => void;
}) {
  const user = useSession((s) => s.user);
  const color = normalizeColor(item.color);
  const colorCls = GROUP_COLOR_BADGE[color];
  const isMember = item.myMembership === "ACTIVE";
  const isPending = item.myMembership === "PENDING";
  const canJoin =
    !isMember && !isPending && item.joinPolicy !== "INVITE" && user?.role !== "GUEST";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="glass flex flex-col gap-3 rounded-2xl border p-4"
    >
      {/* عنوان + آیکن */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base ${GROUP_COLOR_GRADIENT[color]} ${GROUP_COLOR_TEXT_ON_GRADIENT[color]}`}
            aria-hidden
          >
            <GroupIcon name={item.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-black leading-6">{item.name}</h3>
            {item.description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 gap-1 ${colorCls}`}>
          {JOIN_POLICY_LABELS[item.joinPolicy] ?? item.joinPolicy}
        </Badge>
      </div>

      {/* اساتید */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-muted-foreground">استاد:</span>
        {item.teachers.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          item.teachers.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 py-0.5 pe-2.5 ps-1 text-xs font-semibold"
            >
              <SafeAvatar user={t} className="size-5 text-[9px]" />
              {t.name}
            </span>
          ))
        )}
      </div>

      {/* آمار */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1.5">
          <Users className="size-3.5" aria-hidden />
          {toFa(item.studentCount)} دانش‌آموز
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <BookOpenCheck className="size-3.5" aria-hidden />
          {toFa(item.contentCount)} محتوا
        </Badge>
        {isMember && (
          <Badge className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="size-3.5" aria-hidden />
            عضو کلاس
          </Badge>
        )}
        {isPending && (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            در انتظار تایید
          </Badge>
        )}
      </div>

      {/* اقدام‌ها */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        {canJoin ? (
          <Button type="button" size="sm" className="gap-1.5 rounded-xl" onClick={onJoin} disabled={busy}>
            <LogIn className="size-4" aria-hidden />
            {item.joinPolicy === "OPEN" ? "پیوستن به کلاس" : "درخواست عضویت"}
          </Button>
        ) : isMember ? (
          <>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={onContent}>
              <BookOpenCheck className="size-4" aria-hidden />
              محتوای کلاس
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={onDetail}>
              <ClipboardList className="size-4" aria-hidden />
              ارسال تکلیف
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ms-auto gap-1.5 rounded-xl text-muted-foreground"
          onClick={onDetail}
        >
          جزئیات
        </Button>
      </div>
    </motion.div>
  );
}
