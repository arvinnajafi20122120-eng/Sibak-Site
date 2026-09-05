import type { IdeaListItem } from "@/components/app/sections/_shared/types";

export const IDEA_STATUS_LABELS: Record<IdeaListItem["status"], string> = {
  PENDING: "در انتظار تایید",
  APPROVED: "تاییدشده",
  IN_PROGRESS: "در حال اجرا",
  DONE: "انجام‌شده",
  REJECTED: "ردشده",
};

/** رنگ متمایز برای هر وضعیت — بدون آبی/ایندیگو. */
export const IDEA_STATUS_BADGE: Record<IdeaListItem["status"], string> = {
  PENDING: "bg-chart-2/20 text-accent-foreground border-chart-2/50",
  APPROVED: "bg-chart-1/15 text-primary border-chart-1/40",
  IN_PROGRESS: "bg-chart-4/20 text-foreground border-chart-4/50",
  DONE: "bg-chart-1/25 text-primary border-chart-1/60",
  REJECTED: "bg-chart-3/15 text-destructive border-chart-3/40",
};

/** فیلترهای تب ایده‌ها. */
export const IDEA_FILTER_TABS: {
  key: string;
  label: string;
  status?: IdeaListItem["status"];
  mine?: boolean;
}[] = [
  { key: "all", label: "همه" },
  { key: "PENDING", label: "در انتظار تایید", status: "PENDING" },
  { key: "APPROVED", label: "تاییدشده", status: "APPROVED" },
  { key: "IN_PROGRESS", label: "در حال اجرا", status: "IN_PROGRESS" },
  { key: "DONE", label: "انجام‌شده", status: "DONE" },
  { key: "REJECTED", label: "ردشده", status: "REJECTED" },
  { key: "mine", label: "ایده‌های من", mine: true },
];
