"use client";

import { FileDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { printArea } from "@/lib/print";

/**
 * دکمهٔ «خروجی PDF» — با چاپ بومی مرورگر، فقط المنتر با کلاس
 * `.printable-area` (و نوادگانش) را چاپ می‌کند. سایر بخش‌های صفحه
 * (سایدبار، هدر، فوتر، دیالوگ‌ها، toggleها) به‌صورت خودکار توسط
 * استایل چاپ در `globals.css` پنهان می‌شوند.
 *
 * خود دکمه همیشه کلاس `no-print` دارد تا در خروجی چاپ ظاهر نشود.
 */
export function PrintButton({
  title,
  label,
  className,
}: {
  title?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "no-print h-9 min-h-9 gap-1.5 rounded-xl text-xs font-bold",
        className,
      )}
      onClick={() => printArea(title)}
    >
      <FileDown className="size-4" aria-hidden />
      {label ?? "خروجی PDF"}
    </Button>
  );
}
