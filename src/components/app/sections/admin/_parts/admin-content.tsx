"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  EyeOff,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Pin,
  PinOff,
  RotateCcw,
  Scale,
  Trash2,
  Users,
  Vote,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { toFa, formatJalaliDate, relativeTime } from "@/lib/jalali";
import { api } from "@/lib/api-client";
import { useHashRoute } from "@/components/app/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import {
  type AdminOverview,
} from "./types";

export function AdminContent() {
  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="ideas" className="gap-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="ideas" className="text-xs">
            <Lightbulb className="ms-1 size-3.5" aria-hidden />
            ایده‌های در انتظار
          </TabsTrigger>
          <TabsTrigger value="polls" className="text-xs">
            <Vote className="ms-1 size-3.5" aria-hidden />
            نظرسنجی‌ها
          </TabsTrigger>
          <TabsTrigger value="groups" className="text-xs">
            <Users className="ms-1 size-3.5" aria-hidden />
            گروه‌ها
          </TabsTrigger>
          <TabsTrigger value="announcements" className="text-xs">
            <Megaphone className="ms-1 size-3.5" aria-hidden />
            پیام‌ها
          </TabsTrigger>
          <TabsTrigger value="debts" className="text-xs">
            <Scale className="ms-1 size-3.5" aria-hidden />
            بدهی‌ها
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs">
            <MessageSquare className="ms-1 size-3.5" aria-hidden />
            نظرات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ideas">
          <IdeasTab />
        </TabsContent>
        <TabsContent value="polls">
          <PollsTab />
        </TabsContent>
        <TabsContent value="groups">
          <GroupsTab />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
        <TabsContent value="debts">
          <DebtsTab />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface IdeasListResponse {
  ideas: {
    id: string;
    title: string;
    description: string;
    status: string;
    author: {
      id: string;
      name: string;
      username: string;
      avatar: string | null;
    };
    group: { id: string; name: string; color: string } | null;
    votesCount: number;
    commentsCount: number;
    myVote: boolean;
    createdAt: string;
  }[];
}

function IdeasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-ideas-pending"],
    queryFn: () => api.get<IdeasListResponse>("/api/ideas?status=PENDING"),
  });
  const ideas = data?.ideas ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-ideas-pending"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/api/ideas/${id}`, { status: "APPROVED" });
      toast.success("ایده تأیید شد (+۵ امتیاز به نویسنده)");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleReject = async (id: string) => {
    try {
      await api.patch(`/api/ideas/${id}`, {
        status: "REJECTED",
        note: "این ایده در زمان فعلی قابل پذیرش نیست.",
      });
      toast.success("ایده رد شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading) return <SkeletonRows />;
  if (ideas.length === 0)
    return (
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardContent className="p-4">
          <EmptyState
            icon={Check}
            title="هیچ ایده‌ی در انتظاری نیست"
            description="همه ایده‌ها بررسی شده‌اند."
          />
        </CardContent>
      </Card>
    );

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Lightbulb className="size-4 text-primary" aria-hidden />
          ایده‌های در انتظار تأیید
          <Badge className="bg-chart-2/15 text-accent-foreground border-chart-2/40">
            {toFa(ideas.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-auto p-2">
        <ul className="flex flex-col gap-1">
          {ideas.map((i) => (
            <li
              key={i.id}
              className="flex items-start gap-3 rounded-xl p-2 hover:bg-secondary/40"
            >
              <SafeAvatar user={i.author} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{i.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {i.description}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {i.author.name} • {relativeTime(new Date(i.createdAt))} • {toFa(i.votesCount)} رأی • {toFa(i.commentsCount)} نظر
                  {i.group && ` • گروه «${i.group.name}»`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="default"
                  className="h-9 gap-1.5 px-3 text-xs"
                  onClick={() => handleApprove(i.id)}
                >
                  <Check className="size-3.5" aria-hidden />
                  تأیید
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 gap-1.5 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleReject(i.id)}
                >
                  <X className="size-3.5" aria-hidden />
                  رد
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

interface PollsListResponse {
  polls: {
    id: string;
    title: string;
    type: string;
    status: string;
    closesAt: string | null;
    createdAt: string;
    totalVotes?: number;
    hasVoted?: boolean;
  }[];
}

function PollsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-polls"],
    queryFn: () => api.get<PollsListResponse>("/api/polls"),
  });
  const polls = data?.polls ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-polls"] });
  };

  const handleAction = async (
    id: string,
    action: "close" | "delete",
  ) => {
    if (!confirm("انجام این عملیات؟")) return;
    try {
      if (action === "close") await api.post(`/api/polls/${id}/close`, {});
      if (action === "delete") await api.del(`/api/polls/${id}`);
      toast.success("عملیات انجام شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading) return <SkeletonRows />;

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Vote className="size-4 text-chart-5" aria-hidden />
          نظرسنجی‌ها
          <Badge className="bg-chart-5/15 text-chart-5 border-chart-5/30">
            {toFa(polls.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-auto p-2">
        {polls.length === 0 ? (
          <EmptyState icon={Vote} title="نظرسنجی‌ای نیست" />
        ) : (
          <ul className="flex flex-col gap-1">
            {polls.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.type === "VETO_GRANT" ? "اعطای وتو" : "معمولی"} • وضعیت: {p.status}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatJalaliDate(new Date(p.createdAt))}
                    {p.closesAt && ` • مهلت: ${formatJalaliDate(new Date(p.closesAt))}`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-9 px-2 text-xs">
                      عملیات
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>عملیات نظرسنجی</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {p.status === "OPEN" && (
                      <DropdownMenuItem
                        onClick={() => handleAction(p.id, "close")}
                        className="text-chart-4 focus:text-chart-4"
                      >
                        بستن
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleAction(p.id, "delete")}
                      className="text-destructive focus:text-destructive"
                    >
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface GroupListResponse {
  groups: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    joinPolicy: string;
    leader: { id: string; name: string; username: string } | null;
    memberCount: number;
    ideasCount: number;
    myMembership: string | null;
    createdAt: string;
  }[];
}

function GroupsTab() {
  const qc = useQueryClient();
  const { navigate } = useHashRoute();
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => api.get<GroupListResponse>("/api/groups"),
  });
  const groups = groupsData?.groups ?? [];

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ["admin-group-requests"],
    queryFn: () =>
      api.get<{ requests: AdminOverview["pendingJoinRequests"] }>(
        "/api/admin/group-requests",
      ),
  });
  const requests = reqData?.requests ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-groups"] });
    void qc.invalidateQueries({ queryKey: ["admin-group-requests"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const handleGroupDelete = async (id: string) => {
    if (!confirm("این گروه حذف شود؟")) return;
    try {
      await api.del(`/api/groups/${id}`);
      toast.success("گروه حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleReq = async (
    groupId: string,
    userId: string,
    action: "approve" | "reject",
  ) => {
    try {
      await api.post(`/api/groups/${groupId}/requests`, { userId, action });
      toast.success(action === "approve" ? "تأیید شد" : "رد شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading || reqLoading) return <SkeletonRows />;

  return (
    <div className="flex flex-col gap-4">
      {/* درخواست‌های عضویت */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Users className="size-4 text-chart-5" aria-hidden />
            درخواست‌های عضویت گروه
            <Badge className="bg-chart-5/15 text-chart-5 border-chart-5/30">
              {toFa(requests.length)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 overflow-auto p-2">
          {requests.length === 0 ? (
            <EmptyState icon={Check} title="صف خالی" />
          ) : (
            <ul className="flex flex-col gap-1">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <SafeAvatar user={r.user} className="size-8" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        درخواست عضویت در «{r.groupName}»
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-9 gap-1.5 px-3 text-xs"
                      onClick={() => handleReq(r.groupId, r.userId, "approve")}
                    >
                      <Check className="size-3.5" aria-hidden />
                      پذیرفتن
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 gap-1.5 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleReq(r.groupId, r.userId, "reject")}
                    >
                      <X className="size-3.5" aria-hidden />
                      رد
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* لیست گروه‌ها */}
      <Card className="glass rounded-3xl border-0 shadow-sm">
        <CardHeader className="border-b border-border/50 p-5">
          <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
            <Users className="size-4 text-primary" aria-hidden />
            همه گروه‌ها
            <Badge className="bg-primary/10 text-primary border-primary/30">
              {toFa(groups.length)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[36rem] overflow-auto p-2">
          {groups.length === 0 ? (
            <EmptyState icon={Users} title="گروهی ساخته نشده" />
          ) : (
            <ul className="flex flex-col gap-1">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      رهبر: {g.leader?.name ?? "—"} • {toFa(g.memberCount)} عضو • {toFa(g.ideasCount)} ایده
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      سیاست عضویت: {g.joinPolicy === "OPEN" ? "باز" : g.joinPolicy === "REQUEST" ? "درخواستی" : "دعوتی"} • {formatJalaliDate(new Date(g.createdAt))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-xs"
                      onClick={() => navigate(`/groups/${g.id}`)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleGroupDelete(g.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AnnListResponse {
  announcements: {
    id: string;
    title: string;
    level: string;
    pinned: boolean;
    audience: string;
    createdAt: string;
    createdBy: { name: string } | null;
  }[];
}

function AnnouncementsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get<AnnListResponse>("/api/announcements"),
  });
  const anns = data?.announcements ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  };

  const handlePin = async (id: string, pinned: boolean) => {
    try {
      await api.patch(`/api/announcements/${id}`, { pinned: !pinned });
      toast.success(pinned ? "سوزن برداشته شد" : "سوزن زده شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("این پیام حذف شود؟")) return;
    try {
      await api.del(`/api/announcements/${id}`);
      toast.success("پیام حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading) return <SkeletonRows />;

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Megaphone className="size-4 text-accent-foreground" aria-hidden />
          پیام‌های همگانی
          <Badge className="bg-chart-2/15 text-accent-foreground border-chart-2/40">
            {toFa(anns.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-auto p-2">
        {anns.length === 0 ? (
          <EmptyState icon={Megaphone} title="پیامی نیست" />
        ) : (
          <ul className="flex flex-col gap-1">
            {anns.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {a.pinned && <Pin className="size-3.5 text-primary" aria-hidden />}
                    {a.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    سطح: {a.level} • مخاطب: {a.audience === "ALL" ? "همه" : "گروهی"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {a.createdBy?.name ?? "—"} • {formatJalaliDate(new Date(a.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    onClick={() => handlePin(a.id, a.pinned)}
                  >
                    {a.pinned ? <PinOff className="size-3.5" aria-hidden /> : <Pin className="size-3.5" aria-hidden />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface DebtsListResponse {
  debts: {
    id: string;
    title: string;
    amount: number;
    status: string;
    visibility: string;
    createdAt: string;
    debtor: { id: string; name: string };
    creditor: { id: string; name: string };
  }[];
}

function DebtsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-debts"],
    queryFn: () => api.get<DebtsListResponse>("/api/debts"),
  });
  const debts = data?.debts ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-debts"] });
  };

  const handleVisibility = async (id: string, visibility: string) => {
    try {
      await api.patch(`/api/debts/${id}`, { visibility });
      toast.success("سطح نمایش به‌روزرسانی شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleSettle = async (id: string) => {
    try {
      await api.post(`/api/debts/${id}/confirm`, {});
      toast.success("بدهی تسویه شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleForgive = async (id: string) => {
    try {
      await api.post(`/api/debts/${id}/forgive`, {});
      toast.success("بدهی بخشیده شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleReopen = async (id: string) => {
    try {
      await api.post(`/api/debts/${id}/reopen`, {});
      toast.success("بدهی بازگشایی شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("این بدهی حذف شود؟")) return;
    try {
      await api.del(`/api/debts/${id}`);
      toast.success("بدهی حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading) return <SkeletonRows />;

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <Scale className="size-4 text-chart-4" aria-hidden />
          همه بدهی‌ها
          <Badge className="bg-chart-4/15 text-chart-4 border-chart-4/40">
            {toFa(debts.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-auto p-2">
        {debts.length === 0 ? (
          <EmptyState icon={Scale} title="بدهی‌ای ثبت نشده" />
        ) : (
          <ul className="flex flex-col gap-1">
            {debts.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {d.title}{" "}
                    <span className="text-muted-foreground">({toFa(d.amount)} امتیاز)</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.debtor.name} ← {d.creditor.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    وضعیت: {d.status} • نمایش: {d.visibility === "PUBLIC" ? "عمومی" : d.visibility === "RESTRICTED" ? "محدود" : "خصوصی"}
                    {" • "}
                    {formatJalaliDate(new Date(d.createdAt))}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-9 px-2 text-xs">
                      عملیات
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>عملیات بدهی</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleVisibility(d.id, "PUBLIC")}
                    >
                      <Eye className="ms-2 size-3.5" aria-hidden />
                      نمایش عمومی
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleVisibility(d.id, "PRIVATE")}
                    >
                      <EyeOff className="ms-2 size-3.5" aria-hidden />
                      فقط درگیرها
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {d.status !== "SETTLED" && d.status !== "FORGIVEN" && (
                      <DropdownMenuItem onClick={() => handleSettle(d.id)}>
                        <Check className="ms-2 size-3.5" aria-hidden />
                        تسویه
                      </DropdownMenuItem>
                    )}
                    {d.status !== "FORGIVEN" && d.status !== "SETTLED" && (
                      <DropdownMenuItem onClick={() => handleForgive(d.id)}>
                        <RotateCcw className="ms-2 size-3.5" aria-hidden />
                        بخشش
                      </DropdownMenuItem>
                    )}
                    {(d.status === "SETTLED" || d.status === "FORGIVEN") && (
                      <DropdownMenuItem onClick={() => handleReopen(d.id)}>
                        <RotateCcw className="ms-2 size-3.5" aria-hidden />
                        بازگشایی
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(d.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="ms-2 size-3.5" aria-hidden />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface CommentsListResponse {
  comments: {
    id: string;
    body: string;
    entityType: string;
    entityId: string;
    author: { id: string; name: string; username: string; avatar: string | null };
    createdAt: string;
    deletedAt: string | null;
    relative: string;
  }[];
}

function CommentsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: () => api.get<CommentsListResponse>("/api/admin/comments?limit=50"),
  });
  const comments = data?.comments ?? [];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-comments"] });
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/api/comments/${id}`);
      toast.success("نظر حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  if (isLoading) return <SkeletonRows />;

  return (
    <Card className="glass rounded-3xl border-0 shadow-sm">
      <CardHeader className="border-b border-border/50 p-5">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold">
          <MessageSquare className="size-4 text-chart-5" aria-hidden />
          نظرات اخیر
          <Badge className="bg-chart-5/15 text-chart-5 border-chart-5/30">
            {toFa(comments.length)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[36rem] overflow-auto p-2">
        {comments.length === 0 ? (
          <EmptyState icon={MessageSquare} title="نظری نیست" />
        ) : (
          <ul className="flex flex-col gap-1">
            {comments.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl p-2 hover:bg-secondary/40",
                  c.deletedAt && "bg-destructive/5",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <SafeAvatar user={c.author} className="size-8" />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        c.deletedAt && "text-destructive line-through",
                      )}
                    >
                      {c.body}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {c.author.name} • روی {c.entityType} • {c.relative}
                    </p>
                  </div>
                </div>
                {!c.deletedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
