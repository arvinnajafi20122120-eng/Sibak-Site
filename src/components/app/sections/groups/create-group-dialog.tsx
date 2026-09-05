"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GROUP_COLORS,
  GROUP_COLOR_LABELS,
  GROUP_COLOR_GRADIENT,
  GROUP_COLOR_TEXT_ON_GRADIENT,
} from "@/components/app/sections/_shared/group-colors";
import {
  GROUP_ICON_KEYS,
  GROUP_ICON_LABELS,
  GroupIcon,
} from "@/components/app/sections/_shared/lucide-icons";
import type { GroupDetail, GroupListItem } from "@/components/app/sections/_shared/types";
import { cn } from "@/lib/utils";

const POLICIES = [
  { key: "OPEN", label: "باز (عضویت فوری)" },
  { key: "REQUEST", label: "درخواستی (نیازمند تایید)" },
  { key: "INVITE", label: "دعوتی (فقط با دعوت‌نامه)" },
] as const;

/**
 * دیالوگ ساخت/ویرایش گروه.
 */
export function CreateEditGroupDialog({
  open,
  onClose,
  editGroup,
}: {
  open: boolean;
  onClose: () => void;
  editGroup?: GroupDetail | GroupListItem | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editGroup;

  const [name, setName] = useState(editGroup?.name ?? "");
  const [description, setDescription] = useState(editGroup?.description ?? "");
  const [color, setColor] = useState<string>(editGroup?.color ?? "emerald");
  const [icon, setIcon] = useState<string>(editGroup?.icon ?? "users");
  const [joinPolicy, setJoinPolicy] = useState<string>(editGroup?.joinPolicy ?? "REQUEST");

  // برای ویرایش، کانال‌ها را از update حذف می‌کنیم — فقط فیلدهای مجاز
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || null,
        color,
        icon,
        joinPolicy,
      };
      if (isEdit && editGroup) {
        return api.patch(`/api/groups/${editGroup.id}`, payload);
      }
      return api.post(`/api/groups`, payload);
    },
        onSuccess: () => {
      toast.success(isEdit ? "گروه ویرایش شد" : "گروه ساخته شد");
      queryClient.invalidateQueries({ queryKey: ["groups"], exact: false });
      if (editGroup) {
        queryClient.invalidateQueries({ queryKey: ["group", editGroup.id] });
      }
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ذخیره گروه"),
  });

  const canSubmit = name.trim().length >= 2 && !saveMutation.isPending;
  const previewColor = (GROUP_COLORS as readonly string[]).includes(color)
    ? (color as (typeof GROUP_COLORS)[number])
    : "emerald";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl rounded-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <Users className="size-4 text-primary" aria-hidden />
            {isEdit ? "ویرایش گروه" : "گروه جدید"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-2">
          {/* پیش‌نمایش */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-gradient-to-l p-4",
              GROUP_COLOR_GRADIENT[previewColor],
              GROUP_COLOR_TEXT_ON_GRADIENT,
            )}
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
              <GroupIcon name={icon} className="size-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black">
                {name || "نام گروه"}
              </span>
              <span className="text-[11px] opacity-80">
                {POLICIES.find((p) => p.key === joinPolicy)?.label ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">نام گروه</Label>
            <Input
              id="group-name"
              dir="rtl"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="مثلاً: تیم برنامه‌نویسی"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-desc">توضیحات (اختیاری)</Label>
            <Textarea
              id="group-desc"
              dir="rtl"
              rows={3}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="هدف گروه و فعالیت‌هایش را شرح بده…"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="group-color">رنگ</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger id="group-color" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-3 rounded-full bg-gradient-to-r",
                            GROUP_COLOR_GRADIENT[c],
                          )}
                          aria-hidden
                        />
                        {GROUP_COLOR_LABELS[c]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="group-icon">آیکون</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger id="group-icon" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_ICON_KEYS.map((k) => {
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <GroupIcon name={k} className="size-4" />
                          {GROUP_ICON_LABELS[k]}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="group-policy">سیاست عضویت</Label>
            <Select value={joinPolicy} onValueChange={setJoinPolicy}>
              <SelectTrigger id="group-policy" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 rounded-xl"
          >
            انصراف
          </Button>
          <Button
            type="button"
            className="h-10 gap-1.5 rounded-xl"
            onClick={() => saveMutation.mutate()}
            disabled={!canSubmit}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {isEdit ? "ذخیره تغییرات" : "ساخت گروه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
