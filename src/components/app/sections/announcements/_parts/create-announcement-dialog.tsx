"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Megaphone,
  Pin,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Announcement, AnnouncementLevel, AnnouncementAudience, GroupLite } from "../../polls/_parts/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const LEVELS: { value: AnnouncementLevel; label: string; dot: string; icon: typeof Info }[] = [
  { value: "INFO", label: "اطلاعیه", dot: "bg-chart-1", icon: Info },
  { value: "SUCCESS", label: "موفقیت", dot: "bg-chart-1", icon: CheckCircle2 },
  { value: "WARNING", label: "هشدار", dot: "bg-chart-2", icon: AlertTriangle },
  { value: "URGENT", label: "فوری", dot: "bg-destructive", icon: AlertTriangle },
];

export function CreateAnnouncementDialog({ open, onOpenChange, onCreated }: Props) {
  const user = useSession((s) => s.user);
  const canPost = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("INFO");
  const [pinned, setPinned] = useState(false);
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL");
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle("");
      setBody("");
      setLevel("INFO");
      setPinned(false);
      setAudience("ALL");
      setGroupId(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  const { data: groups } = useQuery({
    queryKey: ["meta-groups"],
    enabled: open,
    queryFn: () => api.get<{ groups: GroupLite[] }>("/api/meta/groups"),
    select: (res) => res.groups,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ announcement: Announcement }>("/api/announcements", {
        title: title.trim(),
        body: body.trim(),
        level,
        pinned,
        audience,
        ...(audience === "GROUP" && groupId ? { groupId } : {}),
      }),
    onSuccess: () => {
      toast.success("پیام همگانی ساخته شد");
      onCreated();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (title.trim().length < 3) {
      toast.error("عنوان پیام را وارد کنید");
      return;
    }
    if (body.trim().length < 3) {
      toast.error("متن پیام را وارد کنید");
      return;
    }
    if (audience === "GROUP" && !groupId) {
      toast.error("یک گروه انتخاب کنید");
      return;
    }
    createMutation.mutate();
  }

  if (!canPost) return null;

  const isSubmitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Megaphone className="size-5 text-primary" aria-hidden />
            ساخت پیام همگانی
          </DialogTitle>
          <DialogDescription className="text-xs">
            پیام‌های اطلاع‌رسانی به همه اعضا یا یک گروه خاص.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-title" className="text-xs font-semibold">
              عنوان
            </Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: جلسه مهم شنبه"
              className="h-11 rounded-xl"
              maxLength={140}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ann-body" className="text-xs font-semibold">
                متن پیام
              </Label>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  body.length > 1800 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {body.length} / ۲۰۰۰
              </span>
            </div>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="متن کامل پیام…"
              className="min-h-28 rounded-xl"
              maxLength={2000}
            />
          </div>

          {/* سطح اهمیت */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              سطح اهمیت
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LEVELS.map((l) => {
                const Icon = l.icon;
                const isActive = level === l.value;
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLevel(l.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 p-2.5 text-xs font-bold transition-all",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", l.dot)} aria-hidden />
                    <span className="flex items-center gap-1">
                      <Icon className="size-3.5" aria-hidden />
                      {l.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* مخاطب */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">مخاطب</span>
            <RadioGroup
              value={audience}
              onValueChange={(v) => setAudience(v as AnnouncementAudience)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="aud-all"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold",
                  audience === "ALL" ? "border-primary bg-primary/5" : "border-border/60",
                )}
              >
                <RadioGroupItem value="ALL" id="aud-all" />
                همه اعضا
              </Label>
              <Label
                htmlFor="aud-group"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold",
                  audience === "GROUP" ? "border-primary bg-primary/5" : "border-border/60",
                )}
              >
                <RadioGroupItem value="GROUP" id="aud-group" />
                گروه خاص
              </Label>
            </RadioGroup>
            {audience === "GROUP" && (
              <div className="mt-1">
                <Select
                  value={groupId ?? "none"}
                  onValueChange={(v) => setGroupId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <span className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" aria-hidden />
                      <SelectValue placeholder="گروه را انتخاب کنید" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* سنجاق */}
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <Switch checked={pinned} onCheckedChange={setPinned} id="pinned" />
              <Label htmlFor="pinned" className="cursor-pointer text-sm font-semibold">
                سنجاق شود
              </Label>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Pin className="size-3" aria-hidden />
              پیام سنجاق‌شده همیشه بالای لیست نمایش داده می‌شود.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 p-5">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            انصراف
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={submit}
            disabled={isSubmitting}
          >
            <Plus className="size-4" aria-hidden />
            {isSubmitting ? "در حال ساخت…" : "انتشار پیام"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
