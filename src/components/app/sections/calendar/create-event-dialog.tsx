"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliDate, toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { JalaliDatePicker } from "@/components/app/sections/calendar/jalali-date-picker";
import {
  EVENT_TYPE_BADGE,
  EVENT_TYPE_LABELS,
  type EventTypeKey,
} from "@/components/app/sections/_shared/group-colors";
import { EventTypeIcon } from "@/components/app/sections/calendar/event-card";
import type {
  CalendarEventListItem,
  GroupOption,
} from "@/components/app/sections/_shared/types";

const GROUP_NONE = "__none__";

/**
 * دیالوگ ساخت/ویرایش رویداد — فقط ADMIN/MANAGER.
 * تاریخ از طریق JalaliDatePicker popover انتخاب می‌شود.
 */
export function CreateEditEventDialog({
  open,
  onClose,
  editEvent,
  fixedGroupId,
}: {
  open: boolean;
  onClose: () => void;
  editEvent?: CalendarEventListItem | null;
  fixedGroupId?: string | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editEvent;

  const [title, setTitle] = useState(editEvent?.title ?? "");
  const [description, setDescription] = useState(editEvent?.description ?? "");
  const [type, setType] = useState<EventTypeKey>(
    (editEvent?.type as EventTypeKey) ?? "GENERAL",
  );
  const [date, setDate] = useState<Date | null>(
    editEvent ? new Date(editEvent.date) : null,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    editEvent?.endDate ? new Date(editEvent.endDate) : null,
  );
  const [time, setTime] = useState<string>(
    editEvent ? extractTime(new Date(editEvent.date)) : "",
  );
  const [groupId, setGroupId] = useState<string>(
    editEvent?.groupId ?? fixedGroupId ?? GROUP_NONE,
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
      if (!date) throw new Error("تاریخ رویداد را انتخاب کنید");
      const payload = {
        title,
        description: description || null,
        type,
        date: date.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        time: time || undefined,
        groupId: groupId === GROUP_NONE ? null : groupId,
      };
      if (isEdit && editEvent) {
        return api.patch(`/api/events/${editEvent.id}`, payload);
      }
      return api.post(`/api/events`, payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "رویداد ویرایش شد" : "رویداد ساخته شد");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar", "events"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ذخیره رویداد"),
  });

  const canSubmit = title.trim().length >= 2 && !!date && !saveMutation.isPending;

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
            <CalendarDays className="size-4 text-primary" aria-hidden />
            {isEdit ? "ویرایش رویداد" : "رویداد جدید"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">عنوان</Label>
            <Input
              id="event-title"
              dir="rtl"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="مثلاً: امتحان ریاضی…"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-type">نوع رویداد</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventTypeKey)}>
              <SelectTrigger id="event-type" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EVENT_TYPE_LABELS) as EventTypeKey[]).map((t) => {
                  return (
                    <SelectItem key={t} value={t}>
                      <span
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px]",
                          EVENT_TYPE_BADGE[t],
                        )}
                      >
                        <EventTypeIcon type={t} className="size-3" />
                        {EVENT_TYPE_LABELS[t]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-date">تاریخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="event-date"
                    variant="outline"
                    className="h-10 w-full justify-start rounded-md text-right font-normal"
                  >
                    {date ? formatJalaliDate(date) : "انتخاب تاریخ…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto min-w-72 rounded-2xl p-3"
                  align="start"
                >
                  <JalaliDatePicker
                    selected={date}
                    onSelect={(d) => setDate(d)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-time">ساعت (اختیاری)</Label>
              <Input
                id="event-time"
                dir="ltr"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 text-left"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-end">تاریخ پایان (اختیاری)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="event-end"
                  variant="outline"
                  className="h-10 w-full justify-start rounded-md text-right font-normal"
                >
                  {endDate ? formatJalaliDate(endDate) : "بدون تاریخ پایان"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-72 rounded-2xl p-3" align="start">
                <JalaliDatePicker
                  selected={endDate}
                  onSelect={(d) => setEndDate(d)}
                />
              </PopoverContent>
            </Popover>
          </div>

          {!fixedGroupId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-group">گروه (اختیاری)</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="event-group" className="h-10 w-full">
                  <SelectValue placeholder="بدون گروه (عمومی)" />
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-desc">توضیحات (اختیاری)</Label>
            <Textarea
              id="event-desc"
              dir="rtl"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="جزئیات بیشتر…"
            />
          </div>
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
              <CalendarDays className="size-4" aria-hidden />
            )}
            {isEdit ? "ذخیره تغییرات" : "ساخت رویداد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

void toFa; // utility re-exported in case needed
