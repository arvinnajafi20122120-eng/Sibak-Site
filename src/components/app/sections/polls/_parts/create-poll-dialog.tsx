"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Minus,
  Plus,
  ShieldBan,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useSession } from "@/store/session";
import type { SafeUser } from "@/lib/types";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { GroupLite, PollType } from "./types";
import { JalaliDatePicker } from "./jalali-date-picker";
import { UserPicker } from "./user-picker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

interface CreateBody {
  type: PollType;
  title: string;
  description?: string;
  options?: string[];
  isAnonymous?: boolean;
  targetUserId?: string;
  vetoAmount?: number;
  closesAt?: string;
  groupId?: string;
}

/** کارت انتخاب نوع نظرسنجی. */
function TypeCard({
  active,
  icon,
  label,
  desc,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border-2 p-4 text-right transition-all",
        active
          ? "border-primary bg-primary/5"
          : "border-border/60 hover:border-primary/40 hover:bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-bold">{label}</span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{desc}</p>
    </button>
  );
}

export function CreatePollDialog({ open, onOpenChange, onCreated }: Props) {
  const user = useSession((s) => s.user);
  const canVetoGrant = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [type, setType] = useState<PollType>("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<SafeUser | null>(null);
  const [vetoAmount, setVetoAmount] = useState(1);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setType("NORMAL");
      setTitle("");
      setDescription("");
      setOptions(["", ""]);
      setIsAnonymous(false);
      setClosesAt(null);
      setGroupId(null);
      setTargetUserId(null);
      setTargetUser(null);
      setVetoAmount(1);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  // فقط ادمین/مدیر اجازه VETO_GRANT دارند
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!canVetoGrant && type === "VETO_GRANT") setType("NORMAL");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [canVetoGrant, type]);

  const { data: groups } = useQuery({
    queryKey: ["meta-groups"],
    enabled: open,
    queryFn: () => api.get<{ groups: GroupLite[] }>("/api/meta/groups"),
    select: (res) => res.groups,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateBody) => api.post<{ poll: unknown }>("/api/polls", body),
    onSuccess: () => {
      toast.success("نظرسنجی ساخته شد");
      onCreated();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addOption() {
    if (options.length >= 6) return;
    setOptions((o) => [...o, ""]);
  }
  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, i) => i !== idx));
  }
  function setOption(idx: number, value: string) {
    setOptions((o) => o.map((v, i) => (i === idx ? value : v)));
  }

  function submit() {
    if (title.trim().length < 3) {
      toast.error("عنوان نظرسنجی را وارد کنید");
      return;
    }
    if (type === "NORMAL") {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) {
        toast.error("حداقل دو گزینه لازم است");
        return;
      }
      const unique = new Set(cleaned);
      if (unique.size !== cleaned.length) {
        toast.error("متن گزینه‌ها نباید تکراری باشد");
        return;
      }
      createMutation.mutate({
        type: "NORMAL",
        title: title.trim(),
        description: description.trim() || undefined,
        options: cleaned,
        isAnonymous,
        closesAt: closesAt ?? undefined,
        groupId: groupId ?? undefined,
      });
    } else {
      if (!targetUserId) {
        toast.error("کاربر هدف را انتخاب کنید");
        return;
      }
      createMutation.mutate({
        type: "VETO_GRANT",
        title: title.trim(),
        description: description.trim() || undefined,
        targetUserId,
        vetoAmount,
        closesAt: closesAt ?? undefined,
        groupId: groupId ?? undefined,
      });
    }
  }

  const isSubmitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="border-b border-border/40 p-5">
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
            <Vote className="size-5 text-primary" aria-hidden />
            ساخت نظرسنجی جدید
          </DialogTitle>
          <DialogDescription className="text-xs">
            نظرسنجی معمولی برای تصمیم‌گیری جمعی، یا نظرسنجی اعطای وتو به یک کاربر شایسته.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* انتخاب نوع */}
          <div className="grid gap-3 sm:grid-cols-2">
            <TypeCard
              active={type === "NORMAL"}
              icon={<Sparkles className="size-5" aria-hidden />}
              label="نظرسنجی معمولی"
              desc="گزینه‌های آزاد؛ هر کاربر یک رأی. مناسب انتخاب بهترین گزینه جمعی."
              onClick={() => setType("NORMAL")}
            />
            <TypeCard
              active={type === "VETO_GRANT"}
              disabled={!canVetoGrant}
              icon={<ShieldBan className="size-5" aria-hidden />}
              label="نظرسنجی اعطای وتو"
              desc="گزینه‌های ثابت بله/خیر؛ در صورت اکثریت، n وتو به کاربر هدف اعطا می‌شود."
              onClick={() => canVetoGrant && setType("VETO_GRANT")}
            />
          </div>
          {!canVetoGrant && (
            <p className="text-[11px] text-muted-foreground">
              تنها ادمین و مدیر می‌توانند نظرسنجی اعطای وتو بسازند.
            </p>
          )}

          {/* عنوان */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poll-title" className="text-xs font-semibold">
              عنوان نظرسنجی
            </Label>
            <Input
              id="poll-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: کدام روز برای جلسه هفتگی؟"
              className="h-11 rounded-xl"
              maxLength={140}
            />
          </div>

          {/* توضیحات */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poll-desc" className="text-xs font-semibold">
              توضیحات (اختیاری)
            </Label>
            <Textarea
              id="poll-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه درباره هدف نظرسنجی…"
              className="min-h-20 rounded-xl"
              maxLength={700}
            />
          </div>

          {/* گزینه‌ها (فقط NORMAL) */}
          {type === "NORMAL" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">گزینه‌ها (۲ تا ۶)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 rounded-lg text-xs"
                  onClick={addOption}
                  disabled={options.length >= 6}
                >
                  <Plus className="size-3.5" aria-hidden />
                  افزودن گزینه
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {options.map((opt, i) => (
                  <motion.div
                    key={i}
                    layout
                    className="flex items-center gap-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {toFa(i + 1)}
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`گزینه ${i + 1}`}
                      className="h-10 flex-1 rounded-lg"
                      maxLength={80}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                        onClick={() => removeOption(i)}
                        aria-label="حذف گزینه"
                      >
                        <Minus className="size-4" aria-hidden />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* تنظیمات VETO_GRANT */}
          {type === "VETO_GRANT" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-chart-4/30 bg-chart-4/5 p-4">
              <UserPicker
                value={targetUserId}
                onChange={(uid, u) => {
                  setTargetUserId(uid || null);
                  setTargetUser(u ?? null);
                }}
                excludeUserId={user?.id}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold">تعداد وتو</span>
                  <span className="text-[11px] text-muted-foreground">
                    در صورت اکثریت بله، این تعداد وتو اعطا می‌شود.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-lg"
                    onClick={() => setVetoAmount((v) => Math.max(1, v - 1))}
                    aria-label="کاهش"
                  >
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <span className="w-10 text-center text-lg font-black tabular-nums">
                    {toFa(vetoAmount)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-lg"
                    onClick={() => setVetoAmount((v) => Math.min(5, v + 1))}
                    aria-label="افزایش"
                  >
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* مهلت و گروه و رأی مخفی */}
          <div className="grid gap-3 sm:grid-cols-2">
            <JalaliDatePicker
              value={closesAt}
              onChange={setClosesAt}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                گروه (اختیاری)
              </span>
              <Select
                value={groupId ?? "none"}
                onValueChange={(v) => setGroupId(v === "none" ? null : v)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <span className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" aria-hidden />
                    <SelectValue placeholder="بدون گروه" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون گروه</SelectItem>
                  {groups?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "NORMAL" && (
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                  id="anon"
                />
                <Label htmlFor="anon" className="cursor-pointer text-sm font-semibold">
                  رأی مخفی
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                رأی‌دهندگان مخفی می‌مانند؛ فقط درصد نمایش داده می‌شود.
              </p>
            </div>
          )}
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
            {isSubmitting ? "در حال ساخت…" : "ساخت نظرسنجی"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
