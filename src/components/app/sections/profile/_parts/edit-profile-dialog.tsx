"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Save, UserCog } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMOJI_AVATARS = ["🍎", "🦊", "🐯", "🦉", "🐧", "🦄", "🐝", "🐙", "🌸", "🚀", "📚", "🎓", "💡", "🎨", "🎵", "⚽"];

/**
 * دیالوگ ویرایش پروفایل خودم.
 * شامل: name, bio, skills, avatar (emoji picker), change-password sub-dialog.
 */
export function EditProfileDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: {
    name: string;
    bio: string | null;
    skills: string | null;
    avatar: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [skills, setSkills] = useState(initial.skills ?? "");
  const [avatar, setAvatar] = useState(initial.avatar ?? "");
  const [pwdOpen, setPwdOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch("/api/users/me", {
        name: name.trim() || undefined,
        bio: bio.trim() || null,
        skills: skills.trim() || null,
        avatar: avatar || null,
      }),
    onSuccess: () => {
      toast.success("پروفایل به‌روزرسانی شد");
      queryClient.invalidateQueries({ queryKey: ["me-profile"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = name.trim().length >= 2 && !updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // reset به مقادیر اولیه
          setName(initial.name);
          setBio(initial.bio ?? "");
          setSkills(initial.skills ?? "");
          setAvatar(initial.avatar ?? "");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <UserCog className="size-5 text-primary" aria-hidden />
            ویرایش پروفایل
          </DialogTitle>
          <DialogDescription>
            اطلاعات خودتان را به‌روز کنید — نام، درباره، مهارت‌ها و آواتار.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* آواتار ایموجی */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-bold">آواتار</Label>
            <div className="grid grid-cols-8 gap-1.5 rounded-2xl border border-border/50 bg-background/40 p-2">
              {EMOJI_AVATARS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setAvatar(e)}
                  className={`flex size-9 items-center justify-center rounded-lg text-xl transition-colors ${
                    avatar === e
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "hover:bg-accent"
                  }`}
                  aria-label={`آواتار ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* نام */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="prf-name" className="text-sm font-bold">
              نام نمایشی
            </Label>
            <Input
              id="prf-name"
              dir="rtl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* درباره */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="prf-bio" className="text-sm font-bold">
              دربارهٔ شما (اختیاری)
            </Label>
            <Textarea
              id="prf-bio"
              dir="rtl"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={400}
              placeholder="مثلاً: دانش‌آموز پایهٔ دوازدهم، علاقه‌مند به فیزیک و برنامه‌نویسی…"
            />
          </div>

          {/* مهارت‌ها */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="prf-skills" className="text-sm font-bold">
              مهارت‌ها (اختیاری)
            </Label>
            <Input
              id="prf-skills"
              dir="rtl"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              maxLength={200}
              placeholder="با کاما جدا کنید: ریاضی, فیزیک, طراحی وب"
            />
            <span className="text-[11px] text-muted-foreground">
              مهارت‌ها را با کاما جدا کنید.
            </span>
          </div>

          {/* تغییر رمز */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              <div className="flex flex-col">
                <span className="text-sm font-bold">رمز عبور</span>
                <span className="text-[11px] text-muted-foreground">
                  هر ۳ ماه یک‌بار توصیه می‌شود.
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPwdOpen(true)}
            >
              تغییر رمز
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            انصراف
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => updateMutation.mutate()}
            className="gap-2"
          >
            <Save className="size-4" aria-hidden />
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>

      <ChangePasswordAlertDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </Dialog>
  );
}

function ChangePasswordAlertDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.post("/api/users/me/password", {
        currentPassword: cur,
        newPassword: next,
      });
      toast.success("رمز عبور تغییر کرد");
      setCur("");
      setNext("");
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            تغییر رمز عبور
          </AlertDialogTitle>
          <AlertDialogDescription>
            رمز فعلی و رمز جدید را وارد کنید. حداقل ۶ کاراکتر.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cur-pwd" className="text-xs font-bold">
              رمز فعلی
            </Label>
            <Input
              id="cur-pwd"
              type="password"
              dir="ltr"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pwd" className="text-xs font-bold">
              رمز جدید
            </Label>
            <Input
              id="new-pwd"
              type="password"
              dir="ltr"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="••••••"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              submit();
            }}
            disabled={!cur || next.length < 6 || loading}
          >
            تغییر
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
