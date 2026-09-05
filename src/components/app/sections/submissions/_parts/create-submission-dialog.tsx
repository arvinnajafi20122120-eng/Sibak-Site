"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { uploadFile } from "@/lib/upload-client";
import { toFa } from "@/lib/jalali";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import type { MyGroupItem, UploadedFileMeta } from "./types";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

/**
 * دیالوگ ارسال پروژه/تکلیف جدید.
 * گروه باید از گروه‌هایی باشد که کاربر عضو فعال آن است.
 * فایل‌ها اول به /api/upload می‌روند، سپس متادیتا با ارسال ثبت می‌شود.
 */
export function CreateSubmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFileMeta[]>([]);
  const [uploading, setUploading] = useState(false);

  const groupsQ = useQuery({
    queryKey: ["groups", "mine"],
    queryFn: () =>
      api.get<{ groups: MyGroupItem[] }>("/api/groups?mine=1"),
    enabled: open,
    select: (res) =>
      res.groups.filter((g) => g.myMembership === "ACTIVE"),
  });

  const groups = groupsQ.data ?? [];

  function reset() {
    setGroupId("");
    setTitle("");
    setDescription("");
    setFiles([]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      toast.error(`حداکثر ${toFa(MAX_FILES)} فایل مجاز است`);
      return;
    }

    const list = Array.from(selected).slice(0, remaining);
    setUploading(true);
    const uploaded: UploadedFileMeta[] = [];

    try {
      for (const file of list) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`«${file.name}» بزرگ‌تر از ۱۵ مگابایت است`);
          continue;
        }
        try {
          const up = await uploadFile(file);
          uploaded.push({
            fileName: up.fileName,
            pathname: up.pathname,
            fileSize: up.fileSize,
            mimeType: up.mimeType,
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "خطا در آپلود فایل");
        }
      }
      if (uploaded.length > 0) {
        setFiles((prev) => [...prev, ...uploaded]);
        toast.success(`${toFa(uploaded.length)} فایل آماده شد 📎`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/api/submissions", {
        groupId,
        title: title.trim(),
        description: description.trim() || undefined,
        files: files.length > 0 ? files : undefined,
      }),
    onSuccess: () => {
      toast.success("پروژه با موفقیت ارسال شد 🎉");
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const canSubmit =
    !!groupId && title.trim().length >= 2 && !uploading && !createMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <FileUp className="size-5 text-primary" aria-hidden />
            ارسال پروژه جدید
          </DialogTitle>
          <DialogDescription>
            پروژه یا تکلیف خود را برای استاد کلاس بفرستید. فایل‌ها تا ۱۵ مگابایت.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* گروه */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">کلاس / گروه</Label>
            {groupsQ.isLoading ? (
              <Skeleton className="h-11 w-full rounded-xl" />
            ) : groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                شما عضو فعال هیچ کلاسی نیستید. اول از بخش «زیرمجموعه‌ها» عضو شوید.
              </p>
            ) : (
              <Select value={groupId} onValueChange={setGroupId} dir="rtl">
                <SelectTrigger className="h-11 w-full rounded-xl">
                  <SelectValue placeholder="کلاس را انتخاب کنید…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* عنوان */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-title" className="text-sm font-bold">
              عنوان پروژه
            </Label>
            <Input
              id="sub-title"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: گزارش آزمایش فیزیک ۲"
              maxLength={200}
            />
          </div>

          {/* توضیحات */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sub-desc" className="text-sm font-bold">
              توضیحات (اختیاری)
            </Label>
            <Textarea
              id="sub-desc"
              dir="rtl"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="چند خط درباره کار انجام‌شده…"
              maxLength={5000}
            />
          </div>

          {/* فایل‌ها */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">
              فایل‌ها (اختیاری — حداکثر {toFa(MAX_FILES)} فایل)
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
              aria-label="انتخاب فایل"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || files.length >= MAX_FILES}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="size-4" aria-hidden />
              )}
              {uploading ? "در حال آپلود…" : "افزودن فایل"}
            </Button>

            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.pathname}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-medium">{f.fileName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                        {f.fileSize >= 1024 * 1024
                          ? `${(f.fileSize / (1024 * 1024)).toFixed(1)} MB`
                          : `${Math.max(1, Math.round(f.fileSize / 1024))} KB`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`حذف فایل ${f.fileName}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={createMutation.isPending}
          >
            انصراف
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
          >
            <Send className="size-4" aria-hidden />
            ارسال پروژه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
