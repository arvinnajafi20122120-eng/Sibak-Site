"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Lightbulb,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { formatJalaliDate, toFa } from "@/lib/jalali";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { SafeAvatar } from "@/components/app/sections/_shared/safe-avatar";
import { EmptyState } from "@/components/app/sections/_shared/empty-state";
import { IdeaList } from "@/components/app/sections/ideas/idea-list";
import { CreateEditGroupDialog } from "@/components/app/sections/groups/create-group-dialog";
import { InviteMemberDialog } from "@/components/app/sections/groups/invite-member-dialog";
import {
  GROUP_COLOR_GRADIENT,
  GROUP_COLOR_TEXT_ON_GRADIENT,
  JOIN_POLICY_LABELS,
  normalizeColor,
} from "@/components/app/sections/_shared/group-colors";
import { GroupIcon } from "@/components/app/sections/_shared/lucide-icons";
import { CreateEditEventDialog } from "@/components/app/sections/calendar/create-event-dialog";
import { EventCard } from "@/components/app/sections/calendar/event-card";
import type { GroupDetailResponse, GroupMember, CalendarEventListItem } from "@/components/app/sections/_shared/types";

/**
 * نمای جزئیات گروه — هیرو + اعضا + درخواست‌ها + تب‌های ایده/رویداد.
 */
export function GroupDetail({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => api.get<GroupDetailResponse>(`/api/groups/${id}`),
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post<{ status: string }>(`/api/groups/${id}/join`),
    onSuccess: (res) => {
      toast.success(res.status === "ACTIVE" ? "به گروه پیوستید!" : "درخواست عضویت شما ثبت شد");
      queryClient.invalidateQueries({ queryKey: ["group", id] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در عضویت"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/api/groups/${id}/leave`),
    onSuccess: () => {
      toast.success("از گروه خارج شدید");
      queryClient.invalidateQueries({ queryKey: ["group", id] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در خروج"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/groups/${id}`),
    onSuccess: () => {
      toast.success("گروه حذف شد");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف گروه"),
  });

  const requestActionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: "approve" | "reject" }) =>
      api.post(`/api/groups/${id}/requests`, { userId, action }),
    onSuccess: (_res, vars) => {
      toast.success(vars.action === "approve" ? "عضویت تایید شد" : "درخواست رد شد");
      queryClient.invalidateQueries({ queryKey: ["group", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در بررسی درخواست"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/groups/${id}/members/remove`, { userId }),
    onSuccess: () => {
      toast.success("عضو حذف شد");
      queryClient.invalidateQueries({ queryKey: ["group", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف عضو"),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  const g = data.group;
  const color = normalizeColor(g.color);
  const isAdmin = user?.role === "ADMIN";
  const canManage = g.canManage;
  const members: GroupMember[] = data.members;
  const pendingMembers = members.filter((m) => m.status === "PENDING");
  const activeMembers = members.filter((m) => m.status === "ACTIVE");
  const myMembership = g.myMembership;
  const isMember = myMembership === "ACTIVE";

  return (
    <div className="flex flex-col gap-5">
      {/* دکمه بازگشت */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-fit gap-1.5 rounded-xl text-muted-foreground"
        onClick={onBack}
      >
        <ArrowRight className="size-4 rotate-180" aria-hidden />
        بازگشت به فهرست گروه‌ها
      </Button>

      {/* هیرو */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "relative overflow-hidden rounded-3xl bg-gradient-to-l p-6 md:p-8",
          GROUP_COLOR_GRADIENT[color],
          GROUP_COLOR_TEXT_ON_GRADIENT,
        )}
      >
        <div className="absolute -top-20 -left-20 size-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <GroupIcon name={g.icon} className="size-8" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-black md:text-3xl">{g.name}</h1>
              <p className="max-w-xl text-sm leading-7 opacity-90">
                {g.description ?? "—"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                  {JOIN_POLICY_LABELS[g.joinPolicy]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px]">
                  <Users className="size-3" aria-hidden />
                  {toFa(g.memberCount)} عضو
                </span>
                {g.leader && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px]">
                    <SafeAvatar user={g.leader} className="size-5 ring-1 ring-white/40" />
                    رهبر: {g.leader.name}
                  </span>
                )}
                <span className="text-[10px] opacity-70">
                  از {formatJalaliDate(new Date(g.createdAt))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl bg-white/15 text-white hover:bg-white/25"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" aria-hidden />
                  ویرایش
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl bg-white/15 text-white hover:bg-white/25"
                  onClick={() => setInviteOpen(true)}
                >
                  <UserPlus className="size-4" aria-hidden />
                  دعوت عضو
                </Button>
              </>
            )}
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                className="h-10 gap-1.5 rounded-xl bg-chart-3/30 text-white hover:bg-chart-3/50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                حذف گروه
              </Button>
            )}
            {!isMember && g.joinPolicy !== "INVITE" && (
              <Button
                variant="default"
                size="sm"
                className="h-10 min-h-10 gap-1.5 rounded-xl bg-white text-primary hover:bg-white/90"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : myMembership === "PENDING" ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <UserPlus className="size-4" aria-hidden />
                )}
                {myMembership === "PENDING" ? "درخواست ثبت شد" : g.joinPolicy === "OPEN" ? "پیوستن" : "درخواست عضویت"}
              </Button>
            )}
            {isMember && g.leaderId !== user?.id && (
              <Button
                variant="secondary"
                size="sm"
                className="h-10 min-h-10 gap-1.5 rounded-xl bg-white/15 text-white hover:bg-white/25"
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
              >
                <LogOut className="size-4" aria-hidden />
                خروج از گروه
              </Button>
            )}
            {g.joinPolicy === "INVITE" && !isMember && (
              <span className="rounded-xl bg-white/15 px-3 py-2 text-[11px] font-bold">
                عضویت فقط با دعوت‌نامه
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* درخواست‌های PENDING — فقط رهبر/ADMIN */}
      {canManage && pendingMembers.length > 0 && (
        <div className="glass flex flex-col gap-3 rounded-3xl p-4 md:p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
            <UserPlus className="size-4 text-chart-2" aria-hidden />
            درخواست‌های عضویت ({toFa(pendingMembers.length)})
          </h3>
          <div className="flex flex-col gap-2">
            {pendingMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
              >
                <SafeAvatar user={m.user} className="size-9" />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-bold">{m.user.name}</span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    @{m.user.username} · {formatJalaliDate(new Date(m.joinedAt))}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="h-9 min-h-9 gap-1.5 rounded-xl"
                  onClick={() =>
                    requestActionMutation.mutate({ userId: m.user.id, action: "approve" })
                  }
                  disabled={requestActionMutation.isPending}
                >
                  <Check className="size-4" aria-hidden />
                  تایید
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 min-h-9 gap-1.5 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    requestActionMutation.mutate({ userId: m.user.id, action: "reject" })
                  }
                  disabled={requestActionMutation.isPending}
                >
                  <X className="size-4" aria-hidden />
                  رد
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* اعضا + تب‌ها */}
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* لیست اعضا */}
        <div className="glass flex flex-col gap-3 rounded-3xl p-4 md:p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
            <Users className="size-4 text-primary" aria-hidden />
            اعضا ({toFa(activeMembers.length)})
          </h3>
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pe-1">
            {activeMembers.map((m) => {
              const isLeader = g.leaderId === m.user.id;
              return (
                <div
                  key={m.id}
                  className="group flex items-center gap-2.5 rounded-2xl border border-border/50 bg-background/40 p-2.5"
                >
                  <SafeAvatar user={m.user} className="size-9" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-bold">{m.user.name}</span>
                    <span className="text-[11px] text-muted-foreground" dir="ltr">
                      @{m.user.username}
                    </span>
                  </div>
                  {isLeader && (
                    <Badge className="text-[10px]" variant="secondary">
                      رهبر
                    </Badge>
                  )}
                  {canManage && !isLeader && (
                    <button
                      type="button"
                      onClick={() => removeMemberMutation.mutate(m.user.id)}
                      className="size-7 rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="حذف عضو"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-h-10 gap-1.5 rounded-xl"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="size-4" aria-hidden />
              دعوت عضو جدید
            </Button>
          )}
        </div>

        {/* تب‌ها: ایده‌های گروه + رویدادها */}
        <div className="flex flex-col">
          <Tabs defaultValue="ideas" className="gap-3">
            <TabsList className="glass h-11 rounded-2xl p-1.5">
              <TabsTrigger
                value="ideas"
                className="flex min-h-9 gap-1.5 rounded-xl px-4 text-sm font-bold"
              >
                <Lightbulb className="size-4" aria-hidden />
                ایده‌های گروه
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="flex min-h-9 gap-1.5 rounded-xl px-4 text-sm font-bold"
              >
                <CalendarDays className="size-4" aria-hidden />
                رویدادها
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ideas">
              <IdeaList
                groupId={id}
                heading={
                  <h3 className="text-base font-extrabold">ایده‌های این گروه</h3>
                }
              />
            </TabsContent>

            <TabsContent value="events">
              <GroupEventsPanel
                events={data.events}
                canManage={canManage}
                userIsAdmin={user?.role === "ADMIN" || user?.role === "MANAGER"}
                currentUserId={user?.id ?? ""}
                onCreateForGroup={id}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* دیالوگ‌ها */}
      <CreateEditGroupDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editGroup={g}
      />
      <InviteMemberDialog
        groupId={id}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گروه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف گروه «{g.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست و
              ایده‌ها و رویدادهای گروه نیز حذف خواهند شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "در حال حذف…" : "حذف کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** پنل رویدادهای گروه — در تب دوم جزئیات گروه. */
function GroupEventsPanel({
  events,
  canManage,
  userIsAdmin,
  currentUserId,
  onCreateForGroup,
}: {
  events: CalendarEventListItem[];
  canManage: boolean;
  userIsAdmin: boolean;
  currentUserId: string;
  onCreateForGroup: string;
}) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CalendarEventListItem | null>(null);

  // delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/events/${id}`),
    onSuccess: () => {
      toast.success("رویداد حذف شد");
      queryClient.invalidateQueries({ queryKey: ["group", onCreateForGroup] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در حذف رویداد"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-extrabold">رویدادهای این گروه</h3>
        {userIsAdmin && (
          <Button
            variant="default"
            size="sm"
            className="h-10 min-h-10 gap-1.5 rounded-xl"
            onClick={() => {
              setEditing(null);
              setShowCreate(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            رویداد گروه
          </Button>
        )}
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="رویدادی برای این گروه ثبت نشده"
          description="جلسه، کارگاه یا تحویل پروژه را به‌عنوان رویداد گروه ثبت کنید."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <EventRow
                  event={e}
                  canManage={userIsAdmin || e.createdBy.id === currentUserId}
                  onEdit={(ev) => {
                    setEditing(ev);
                    setShowCreate(true);
                  }}
                  onDelete={(ev) => deleteMutation.mutate(ev.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {userIsAdmin && (
        <CreateEventButton
          open={showCreate}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          editEvent={editing}
          fixedGroupId={onCreateForGroup}
        />
      )}
    </div>
  );
}

// وارد کردن دیالوگ و کارت رویداد برای استفاده در تب جزئیات گروه.
function CreateEventButton({
  open,
  onClose,
  editEvent,
  fixedGroupId,
}: {
  open: boolean;
  onClose: () => void;
  editEvent: CalendarEventListItem | null;
  fixedGroupId: string;
}) {
  return (
    <CreateEditEventDialog
      open={open}
      onClose={onClose}
      editEvent={editEvent}
      fixedGroupId={fixedGroupId}
    />
  );
}

function EventRow({
  event,
  canManage,
  onEdit,
  onDelete,
}: {
  event: CalendarEventListItem;
  canManage: boolean;
  onEdit: (e: CalendarEventListItem) => void;
  onDelete: (e: CalendarEventListItem) => void;
}) {
  return (
    <EventCard event={event} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
  );
}
