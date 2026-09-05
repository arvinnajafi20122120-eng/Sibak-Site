"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Search, UserPlus, Users as UsersIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/types";
import type { ChatProfile, ChatRoom } from "@/lib/chat-client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RoomState {
  room: ChatRoom;
  lastMessage?: import("@/lib/chat-client").ChatMessage;
  unread: number;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "؟";
}

function preview(msg: RoomState["lastMessage"]): string {
  if (!msg) return "بدون پیام";
  if (msg.type === "text") return msg.text ?? "";
  return `📎 ${msg.file?.name ?? "فایل"}`;
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ConversationList({
  user,
  peers,
  online,
  dmList,
  groupList,
  activeRoomId,
  onPickPeer,
  onPickRoom,
  onCreateGroup,
}: {
  user: SafeUser | null;
  peers: SafeUser[];
  online: ChatProfile[];
  dmList: RoomState[];
  groupList: RoomState[];
  activeRoomId: string | null;
  onPickPeer: (peer: SafeUser) => void;
  onPickRoom: (room: ChatRoom) => void;
  onCreateGroup: () => void;
}) {
  const [q, setQ] = useState("");

  const filteredPeers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return peers;
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.username.toLowerCase().includes(term),
    );
  }, [peers, q]);

  if (!user) return null;

  const onlineIds = new Set(online.map((o) => o.userId));
  // ابتدا آنلاین‌ها، بعد آفلاین‌ها — هر کدام بر اساس نام
  const sortedPeers = [...filteredPeers].sort((a, b) => {
    const ao = onlineIds.has(a.id) ? 0 : 1;
    const bo = onlineIds.has(b.id) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "fa");
  });

  return (
    <div className="flex h-full max-h-[78vh] flex-col">
      {/* جستجو */}
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی همکار..."
            className="pr-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-2">
          {/* گروه‌ها */}
          {groupList.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <UsersIcon className="size-3.5" aria-hidden />
                  گروه‌ها
                </span>
                <button
                  onClick={onCreateGroup}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                >
                  + جدید
                </button>
              </div>
              {groupList.map((rs) => (
                <RoomRow
                  key={rs.room.id}
                  label={rs.room.name ?? "گروه"}
                  subtitle={`${rs.room.members.length} عضو`}
                  preview={preview(rs)}
                  time={fmtTime(rs.lastMessage?.createdAt)}
                  unread={rs.unread}
                  active={activeRoomId === rs.room.id}
                  onClick={() => onPickRoom(rs.room)}
                  icon="group"
                />
              ))}
            </div>
          )}

          {/* گروه‌های شروع‌شده با DM */}
          {dmList.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-muted-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                گفت‌وگوهای اخیر
              </span>
              {dmList.map((rs) => {
                const other = rs.room.members.find((m) => m.userId !== user.id);
                const name = other?.name ?? "کاربر";
                return (
                  <RoomRow
                    key={rs.room.id}
                    label={name}
                    subtitle={other ? `@${other.username}` : ""}
                    preview={preview(rs)}
                    time={fmtTime(rs.lastMessage?.createdAt)}
                    unread={rs.unread}
                    active={activeRoomId === rs.room.id}
                    onClick={() => onPickRoom(rs.room)}
                    icon="dm"
                    online={other ? onlineIds.has(other.userId) : false}
                  />
                );
              })}
            </div>
          )}

          {/* همه اعضا برای شروع DM جدید */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <UserPlus className="size-3.5" aria-hidden />
                همکاران ({sortedPeers.length})
              </span>
            </div>
            {sortedPeers.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {q ? "هیچ همکاری یافت نشد" : "همکاری برای چت موجود نیست"}
              </p>
            )}
            {sortedPeers.map((p) => {
              const isOnline = onlineIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => onPickPeer(p)}
                  className="flex items-center gap-2.5 rounded-xl p-2 text-right transition-colors hover:bg-secondary/60"
                >
                  <div className="relative">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-chart-1/15 text-primary text-[11px] font-bold">
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-background",
                        isOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      @{p.username} · {p.role === "ADMIN" ? "ادمین" : p.role === "MANAGER" ? "مدیر" : "کاربر"}
                    </p>
                  </div>
                  {isOnline && (
                    <span className="text-[10px] font-bold text-emerald-600">آنلاین</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function RoomRow({
  label,
  subtitle,
  preview,
  time,
  unread,
  active,
  onClick,
  icon,
  online,
}: {
  label: string;
  subtitle?: string;
  preview: string;
  time?: string;
  unread: number;
  active: boolean;
  onClick: () => void;
  icon: "dm" | "group";
  online?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl p-2 text-right transition-colors",
        active ? "bg-primary/10" : "hover:bg-secondary/60",
      )}
    >
      {icon === "group" ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chart-2/15 text-accent-foreground">
          <UsersIcon className="size-4" aria-hidden />
        </div>
      ) : (
        <div className="relative">
          <Avatar className="size-9">
            <AvatarFallback className="bg-chart-1/15 text-primary text-[11px] font-bold">
              {initials(label)}
            </AvatarFallback>
          </Avatar>
          {online && (
            <span className="absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold">{label}</p>
          {time && <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>}
        </div>
        {subtitle && icon === "group" && (
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-muted-foreground">{preview}</p>
          {unread > 0 && (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "۹+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
