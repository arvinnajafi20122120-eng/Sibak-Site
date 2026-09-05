"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, Medal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { toFa } from "@/lib/jalali";
import {
  MEDAL_IMAGE_MAX_LENGTH,
  MEDAL_IMAGE_MAX_SIDE,
  MEDAL_RARITIES,
  RARITY_CLASSES,
  RARITY_LABELS,
  type MedalDTO,
  type MedalRarity,
} from "@/lib/medals";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { MedalImage } from "./medal-image";

/**
 * فشرده‌سازی PNG سمت کلاینت: مربع تا ۲۵۶px با حفظ شفافیت.
 */
async function processPng(file: File): Promise<string> {
  if (file.type !== "image/png") {
    throw new Error("فقط فایل PNG (بدون پس‌زمینه) مجاز است");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("حجم عکس بیش از ۴ مگابایت است");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MEDAL_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("مرورگر از پردازش عکس پشتیبانی نمی‌کند");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > MEDAL_IMAGE_MAX_LENGTH) {
    throw new Error("عکس بعد از فشرده‌سازی هنوز بزرگ است — نسخهٔ ساده‌تری انتخاب کنید");
  }
  return dataUrl;
}

/**
 * فرم ساخت/ویرایش مدال — فقط ادمین.
 */
export function MedalFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MedalDTO | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rarity, setRarity] = useState<MedalRarity>("COMMON");
  const [points, setPoints] = useState("10");
  const [limited, setLimited] = useState(false);
  const [maxCount, setMaxCount] = useState("5");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setImageUrl(editing?.imageUrl ?? null);
      setRarity(editing?.rarity ?? "COMMON");
      setPoints(editing ? String(editing.points) : "10");
      setLimited(editing?.maxCount != null);
      setMaxCount(editing?.maxCount != null ? String(editing.maxCount) : "5");
    }
  }, [open, editing]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      const dataUrl = await processPng(file);
      setImageUrl(dataUrl);
      toast.success("عکس آماده شد ✓");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function submit() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (trimmedName.length < 2) return toast.error("نام مدال حداقل ۲ حرف باشد");
    if (trimmedDesc.length < 2) return toast.error("توضیحات حداقل ۲ حرف باشد");
    if (!imageUrl) return toast.error("عکس PNG بدون پس‌زمینه را انتخاب کنید");
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < 0 || pts > 1000)
      return toast.error("امتیاز باید عددی بین ۰ تا ۱۰۰۰ باشد");
    let cap: number | null = null;
    if (limited) {
      const mc = Number(maxCount);
      if (!Number.isInteger(mc) || mc < 1 || mc > 999)
        return toast.error("سقف تعداد باید عددی بین ۱ تا ۹۹۹ باشد");
      cap = mc;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/medals/${editing!.id}`, {
          name: trimmedName,
          description: trimmedDesc,
          imageUrl,
          rarity,
          points: pts,
          maxCount: cap,
        });
        toast.success("مدال ویرایش شد ✓");
      } else {
        await api.post("/api/medals", {
          name: trimmedName,
          description: trimmedDesc,
          imageUrl,
          rarity,
          points: pts,
          maxCount: cap,
        });
        toast.success(`مدال «${trimmedName}» ساخته شد 🎖`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Medal className="size-5 text-primary" aria-hidden />
            {isEdit ? `ویرایش مدال «${editing!.name}»` : "مدال جدید"}
          </DialogTitle>
          <DialogDescription>
            عکس PNG شفاف (بدون پس‌زمینه) + توضیحات + سطح نایابی و امتیاز را مشخص کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">
          {/* عکس */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              {imageUrl ? (
                <MedalImage
                  src={imageUrl}
                  alt="پیش‌نمایش مدال"
                  className="size-24 rounded-2xl border border-border/60 bg-background/60 p-1.5"
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
                  <Medal className="size-8" aria-hidden />
                </div>
              )}
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="flex items-center gap-1 text-[10px] font-bold text-destructive hover:underline"
                >
                  <Trash2 className="size-3" aria-hidden />
                  حذف عکس
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="medal-image">عکس مدال (PNG شفاف)</Label>
              <input
                ref={fileRef}
                id="medal-image"
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={processing}
                onClick={() => fileRef.current?.click()}
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImageUp className="size-4" aria-hidden />
                )}
                {imageUrl ? "تغییر عکس" : "انتخاب عکس"}
              </Button>
              <p className="text-[11px] leading-5 text-muted-foreground">
                تا ۴ مگابایت — خودکار به مربع {toFa(MEDAL_IMAGE_MAX_SIDE)} پیکسل فشرده می‌شود و
                شفافیت حفظ می‌شود.
              </p>
            </div>
          </div>

          {/* نام */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="medal-name">نام مدال</Label>
            <Input
              id="medal-name"
              dir="rtl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: قهرمان ریاضی"
              maxLength={60}
            />
          </div>

          {/* توضیحات */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="medal-desc">توضیحات</Label>
            <Textarea
              id="medal-desc"
              dir="rtl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="این مدال به چه کسی و چرا داده می‌شود؟"
              rows={3}
              maxLength={500}
            />
            <span className="text-[10px] text-muted-foreground">
              {toFa(description.length)}/۵۰۰
            </span>
          </div>

          {/* نایابی + امتیاز */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>سطح نایابی</Label>
              <Select value={rarity} onValueChange={(v) => setRarity(v as MedalRarity)}>
                <SelectTrigger aria-label="سطح نایابی مدال">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDAL_RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", RARITY_CLASSES[r])}
                      >
                        {RARITY_LABELS[r]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="medal-points">امتیاز مدال</Label>
              <Input
                id="medal-points"
                dir="ltr"
                type="number"
                min={0}
                max={1000}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
          </div>

          {/* سقف تعداد */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-3.5">
            <div className="flex flex-col">
              <Label className="text-sm" htmlFor="medal-limited">
                نسخهٔ محدود
              </Label>
              <span className="text-[11px] text-muted-foreground">
                سقف تعداد دارندگان این مدال
              </span>
            </div>
            <div className="flex items-center gap-2">
              {limited && (
                <Input
                  id="medal-limited"
                  dir="ltr"
                  type="number"
                  min={1}
                  max={999}
                  value={maxCount}
                  onChange={(e) => setMaxCount(e.target.value)}
                  className="h-9 w-20"
                  aria-label="سقف تعداد دارندگان"
                />
              )}
              <Switch checked={limited} onCheckedChange={setLimited} aria-label="نسخهٔ محدود" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            انصراف
          </Button>
          <Button type="button" onClick={submit} disabled={saving || processing} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isEdit ? "ذخیره تغییرات" : "ساخت مدال"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
