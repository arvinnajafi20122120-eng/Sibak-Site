"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Link2, Loader2, Unlink, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { relativeTime, toFa } from "@/lib/jalali";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

import type { MyGroupItem } from "@/components/app/sections/submissions/_parts/types";
import type { SafeUser } from "@/lib/types";

interface AssignmentRow {
  id: string;
  createdAt: string;
  teacher: Pick<SafeUser, "id" | "name" | "username" | "avatar" | "role">;
  group: {
    id: string;
    name: string;
    slug: string;
    color: string;
    deletedAt: string | null;
  };
}

/**
 * مدیریت اساتید — تخصیص چند استاد به هر کلاس و لغو تخصیص (فقط ادمین).
 * هر استاد فقط محتوای کلاس‌هایی را مدیریت می‌کند که در همین‌جا تخصیص یافته است.
 */
export function AdminAssignments() {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");

  const teachersQ = useQuery({
    queryKey: ["admin-assignments", "teachers"],
    queryFn: () =>
      api.get<{ users: SafeUser[] }>("/api/admin/users?role=TEACHER&status=ACTIVE"),
  });

  const groupsQ = useQuery({
    queryKey: ["admin-assignments", "groups"],
    queryFn: () => api.get<{ groups: MyGroupItem[] }>("/api/meta/groups"),
  });

  const assignmentsQ = useQuery({
    queryKey: ["admin-assignments", "list"],
    queryFn: () =>
      api.get<{ assignments: AssignmentRow[] }>("/api/teacher/assignments"),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-assignments"] });
  }

  const assignMutation = useMutation({
    mutationFn: () =>
      api.post("/api/teacher/assignments", { teacherId, groupId }),
    onSuccess: () => {
      toast.success("استاد به کلاس تخصیص یافت 🎓");
      setTeacherId("");
      setGroupId("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: (row: AssignmentRow) =>
      api.del("/api/teacher/assignments", {
        teacherId: row.teacher.id,
        groupId: row.group.id,
      }),
    onSuccess: () => {
      toast.success("تخصیص لغو شد");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const teachers = teachersQ.data?.users ?? [];
  const groups = groupsQ.data?.groups ?? [];
  const assignments = assignmentsQ.data?.assignments ?? [];

  const activeAssignments = assignments.filter((a) => !a.group.deletedAt);
  const teacherName = (id: string) =>
    teachers.find((t) => t.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* فرم تخصیص */}
      <div className="glass rounded-3xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <GraduationCap className="size-5 text-primary" aria-hidden />
          تخصیص استاد به کلاس
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          هر کلاس می‌تواند چند استاد داشته باشد و هر استاد فقط محتوای کلاس‌های خودش را
          مدیریت می‌کند. استاد باید از قبل در «کاربران» نقش استاد بگیرد.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold" htmlFor="assign-teacher">
              استاد
            </label>
            <Select value={teacherId} onValueChange={setTeacherId} dir="rtl">
              <SelectTrigger id="assign-teacher" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="انتخاب استاد…" />
              </SelectTrigger>
              <SelectContent>
                {teachersQ.isLoading ? (
                  <div className="p-2">
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    استاد فعالی یافت نشد
                  </div>
                ) : (
                  teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold" htmlFor="assign-group">
              کلاس
            </label>
            <Select value={groupId} onValueChange={setGroupId} dir="rtl">
              <SelectTrigger id="assign-group" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="انتخاب کلاس…" />
              </SelectTrigger>
              <SelectContent>
                {groupsQ.isLoading ? (
                  <div className="p-2">
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </div>
                ) : (
                  groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            className="gap-2 rounded-xl"
            disabled={!teacherId || !groupId || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            ثبت تخصیص
          </Button>
        </div>
      </div>

      {/* لیست تخصیص‌ها */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-black">
          تخصیص‌های جاری ({toFa(activeAssignments.length)})
        </h2>

        {assignmentsQ.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : activeAssignments.length === 0 ? (
          <EmptyState
            icon={UserRoundCheck}
            title="هنوز تخصیصی ثبت نشده"
            description="یک استاد را به یک کلاس تخصیص دهید تا بتواند محتوای آن را منتشر کند."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeAssignments.map((a) => (
              <div
                key={a.id}
                className="glass flex items-center gap-3 rounded-2xl border p-4"
              >
                <SafeAvatar user={a.teacher} className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.teacher.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={GROUP_COLOR_BADGE[normalizeColor(a.group.color)]}
                    >
                      {a.group.name}
                    </Badge>
                    <span>از {relativeTime(new Date(a.createdAt))}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => unassignMutation.mutate(a)}
                  disabled={unassignMutation.isPending}
                  aria-label={`لغو تخصیص ${teacherName(a.teacher.id)} از ${a.group.name}`}
                >
                  <Unlink className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
