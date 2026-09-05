"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { GroupOption, IdeaListItem } from "@/components/app/sections/_shared/types";

const GROUP_NONE = "__none__";

/** دیالوگ ساخت ایده جدید یا ویرایش ایده PENDING. */
export function CreateEditIdeaDialog({
  open,
  onClose,
  editIdea,
  fixedGroupId,
}: {
  open: boolean;
  onClose: () => void;
  editIdea?: IdeaListItem | null;
  fixedGroupId?: string | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editIdea;

  const [title, setTitle] = useState(editIdea?.title ?? "");
  const [description, setDescription] = useState(editIdea?.description ?? "");
  const [groupId, setGroupId] = useState<string>(
    editIdea?.groupId ?? fixedGroupId ?? GROUP_NONE,
  );

  const { data: groupsData } = useQuery({
    queryKey: ["groups", "list"],
    queryFn: async () => {
      const r = await api.get<{ groups: GroupOption[] }>(`/api/groups`);
      return { groups: r.groups as GroupOption[] };
    },
    enabled: open && !fixedGroupId,
  });
  const groups = groupsData?.groups ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit && editIdea) {
        return api.patch(`/api/ideas/${editIdea.id}`, {
          title,
          description,
          groupId: groupId === GROUP_NONE ? null : groupId,
        });
      }
      return api.post(`/api/ideas`, {
        title,
        description,
        groupId: groupId === GROUP_NONE ? null : groupId,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "ایده ویرایش شد" : "ایده ثبت شد و در انتظار بررسی است");
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      onClose();
      setTitle("");
      setDescription("");
      setGroupId(fixedGroupId ?? GROUP_NONE);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ثبت ایده"),
  });

  const canSubmit =
    title.trim().length >= 3 && description.trim().length >= 8 && !saveMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <Lightbulb className="size-4 text-primary" aria-hidden />
            {isEdit ? "ویرایش ایده" : "ایده جدید"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="idea-title">عنوان ایده</Label>
            <Input
              id="idea-title"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="یک عنوان کوتاه و گویا…"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="idea-desc">توضیحات</Label>
            <Textarea
              id="idea-desc"
              dir="rtl"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="ایده‌ات را کامل شرح بده: چرا مفید است، چطور اجرا شود…"
            />
          </div>
          {!fixedGroupId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="idea-group">گروه (اختیاری)</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="idea-group" className="h-10 w-full">
                  <SelectValue placeholder="بدون گروه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GROUP_NONE}>بدون گروه (عمومی)</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
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
              <Lightbulb className="size-4" aria-hidden />
            )}
            {isEdit ? "ذخیره تغییرات" : "ثبت ایده"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
