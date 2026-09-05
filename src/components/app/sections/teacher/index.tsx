"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileUp,
  GraduationCap,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { relativeTime, toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import {
  GROUP_COLOR_BADGE,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";

import {
  fileHref,
  type MyGroupItem,
  type TeacherContentItem,
} from "@/components/app/sections/submissions/_parts/types";

/**
 * پنل استاد سیبک — انتشار محتوای آموزشی در کلاس‌های تخصیص‌یافته.
 * - استاد فقط کلاس‌هایی را می‌بیند که ادمین به او تخصیص داده (TeacherGroup).
 * - انتشار محتوا با فایل پیوست (اختیاری) از /api/upload.
 * - مدیریت محتوای منتشرشده: دانلود پیوست و حذف.
 */
export default function TeacherSection() {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();

  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowed = user?.role === "TEACHER" || user?.role === "ADMIN";

  const groupsQ = useQuery({
    queryKey: ["teacher-groups"],
    queryFn: () => api.get<{ groups: MyGroupItem[] }>("/api/teacher/groups"),
    enabled: allowed,
  });

  const contentsQ = useQuery({
    queryKey: ["teacher-content", "mine"],
    queryFn: () =>
      api.get<{ contents: TeacherContentItem[] }>("/api/teacher/content"),
    enabled: allowed,
  });

  const groups = groupsQ.data?.groups ?? [];
  const contents = contentsQ.data?.contents ?? [];

  function resetForm() {
    setTitle("");
    setSubject("");
    setDescription("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const publishMutation = useMutation({
    mutationFn: async () => {
      let fileUrl = "";
      let fileName = "";
      let filePath = "";

      if (file) {
        const up = await uploadFile(file);
        fileUrl = up.url;
        fileName = up.fileName;
        filePath = up.pathname;
      }

      return api.post<{ content: TeacherContentItem }>("/api/teacher/content", {
        groupId,
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        filePath: filePath || undefined,
      });
    },
    onSuccess: () => {
      toast.success("محتوا با موفقیت منتشر شد 📚");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["teacher-content"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPublishing(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/teacher/content/${id}`),
    onSuccess: () => {
      toast.success("محتوا حذف شد");
      queryClient.invalidateQueries({ queryKey: ["teacher-content"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePublish() {
    if (!groupId) {
      toast.error("کلاس را انتخاب کنید");
      return;
    }
    if (!title.trim() || !subject.trim()) {
      toast.error("عنوان و موضوع الزامی است");
      return;
    }
    setPublishing(true);
    publishMutation.mutate();
  }

  /* ---------- گارد نقش سمت کلاینت ---------- */
  if (!allowed) {
    return (
      <section className="flex flex-col gap-5" aria-label="پنل استاد">
        <EmptyState
          icon={GraduationCap}
          title="دسترسی محدود"
          description="این بخش فقط برای اساتید و ادمین است."
        />
      </section>
    );
  }

  const canPublish = !!groupId && title.trim() && subject.trim() && !publishing;

  return (
    <section className="flex flex-col gap-5" aria-label="پنل استاد">
      {/* سربرگ */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-chart-5/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">پنل استاد 🎓</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-7 text-muted-foreground">
              انتشار جزوه و محتوای آموزشی برای کلاس‌هایی که به شما تخصیص یافته است.
            </p>
          </div>
        </div>

        {/* کلاس‌های من */}
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">کلاس‌های من:</span>
          {groupsQ.isLoading ? (
            <Skeleton className="h-6 w-40 rounded-full" />
          ) : groups.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              هنوز کلاسی به شما اختصاص نیافته — از ادمین بخواهید تخصیص دهد.
            </span>
          ) : (
            groups.map((g) => (
              <Badge
                key={g.id}
                variant="outline"
                className={GROUP_COLOR_BADGE[normalizeColor(g.color)]}
              >
                {g.name}
              </Badge>
            ))
          )}
        </div>
      </div>

      {/* فرم انتشار */}
      <div className="glass rounded-3xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Plus className="size-5 text-primary" aria-hidden />
          انتشار محتوای جدید
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">کلاس</Label>
            <Select value={groupId} onValueChange={setGroupId} dir="rtl">
              <SelectTrigger className="h-11 w-full rounded-xl">
                <SelectValue placeholder="انتخاب کلاس…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tc-subject" className="text-sm font-bold">
              موضوع
            </Label>
            <Input
              id="tc-subject"
              dir="rtl"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثلاً: ریاضی — هندسه"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="tc-title" className="text-sm font-bold">
              عنوان محتوا
            </Label>
            <Input
              id="tc-title"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: جزوه فصل دوم — توابع"
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="tc-desc" className="text-sm font-bold">
              توضیحات (اختیاری)
            </Label>
            <Textarea
              id="tc-desc"
              dir="rtl"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="چند خط درباره این محتوا…"
              maxLength={5000}
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <Label className="text-sm font-bold">فایل پیوست (اختیاری — تا ۱۵MB)</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="انتخاب فایل"
            />
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="حذف فایل انتخابی"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-xl border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={publishing}
              >
                <Paperclip className="size-4" aria-hidden />
                انتخاب فایل
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={() => void handlePublish()}
            disabled={!canPublish}
          >
            {publishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {publishing ? "در حال انتشار…" : "انتشار محتوا"}
          </Button>
        </div>
      </div>

      {/* محتوای منتشرشده */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-black">محتوای منتشرشده ({toFa(contents.length)})</h2>

        {contentsQ.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : contents.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="هنوز محتوایی منتشر نکرده‌اید"
            description="اولین جزوه یا محتوای آموزشی خود را از فرم بالا منتشر کنید."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {contents.map((c) => {
              const href = fileHref(c);
              return (
                <div key={c.id} className="glass flex flex-col gap-3 rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-black leading-6">{c.title}</h3>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-chart-5/40 bg-chart-5/15 text-chart-5"
                    >
                      {c.subject}
                    </Badge>
                  </div>

                  {c.description && (
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {c.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {c.group && (
                      <Badge
                        variant="outline"
                        className={GROUP_COLOR_BADGE[normalizeColor(c.group.color)]}
                      >
                        {c.group.name}
                      </Badge>
                    )}
                    <span>{relativeTime(new Date(c.createdAt))}</span>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    {href && (
                      <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <Download className="size-4" aria-hidden />
                          {c.fileName ?? "دانلود"}
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ms-auto gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingId(c.id)}
                      aria-label={`حذف ${c.title}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      حذف
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* تایید حذف */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محتوا؟</AlertDialogTitle>
            <AlertDialogDescription>
              این محتوا برای همیشه از کلاس حذف می‌شود و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
              disabled={deleteMutation.isPending}
            >
              حذف کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
