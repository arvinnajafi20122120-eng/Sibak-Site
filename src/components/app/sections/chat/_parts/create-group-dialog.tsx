"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ScrollArea } from "@/components/ui/scroll-area";

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "؟";
}

/**
 * دیالوگ ساخت گروه چت — انتخاب نام + حداقل یک عضو.
 * پس از تأیید، onCreate(name, memberIds) صدا زده می‌شود و parent باید
 * به سوکت room:create بفرستد و دیالوگ را ببندد.
 */
export function CreateGroupDialog({
  open,
  onOpenChange,
  peers,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peers: SafeUser[];
  onCreate: (name: string, memberIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = peers.filter((p) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return p.name.toLowerCase().includes(t) || p.username.toLowerCase().includes(t);
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("نام گروه باید حداقل ۲ نویسه باشد");
      return;
    }
    if (selected.size === 0) {
      setError("حداقل یک عضو انتخاب کنید");
      return;
    }
    onCreate(name.trim(), Array.from(selected));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ساخت گروه چت جدید</DialogTitle>
          <DialogDescription>
            یک نام انتخاب کنید و حداقل یک همکار را دعوت کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
              نام گروه
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: تیم همکاری ریاضی"
              maxLength={60}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">
              اعضا ({selected.size} انتخاب‌شده)
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی همکار..."
              className="mb-2"
            />
            <ScrollArea className="max-h-64">
              <div className="flex flex-col gap-1">
                {filtered.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    همکاری یافت نشد
                  </p>
                )}
                {filtered.map((p) => {
                  const isSel = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl p-2 text-right transition-colors",
                        isSel ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary/60",
                      )}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-chart-1/15 text-primary text-[11px] font-bold">
                          {initials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">@{p.username}</p>
                      </div>
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-md border text-[10px]",
                          isSel
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent",
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={submit}
            disabled={name.trim().length < 2 || selected.size === 0}
            className="gap-1.5"
          >
            ساخت گروه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
