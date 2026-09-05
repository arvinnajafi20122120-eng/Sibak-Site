"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Send,
  Users as UsersIcon,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useHashRoute } from "@/components/app/router";
import { api } from "@/lib/api-client";
import {
  getChatSocket,
  disconnectChat,
  dmRoomId,
  type ChatMessage,
  type ChatProfile,
  type ChatRoom,
  type ChatRoomMembership,
} from "@/lib/chat-client";
import type { SafeUser } from "@/lib/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationList } from "./_parts/conversation-list";
import { CreateGroupDialog } from "./_parts/create-group-dialog";

/**
 * بخش چت سیبک — چت یک‌به‌یک + گروهی + اشتراک فایل (real-time WebSocket).
 * آدرس: #/chat
 */

interface RoomState {
  room: ChatRoom;
  lastMessage?: ChatMessage;
  unread: number;
}

function fileUrl(name: string, dataUrl: string): string {
  return dataUrl;
}

function isImageMime(mime: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(mime);
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "؟";
}

export default function ChatSection() {
  const { user } = useSession();
  const { navigate } = useHashRoute();

  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<ChatProfile[]>([]);
  const [peers, setPeers] = useState<SafeUser[]>([]);
  const [roomStates, setRoomStates] = useState<Record<string, RoomState>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [typing, setTyping] = useState<Record<string, { name: string } | null>>({});
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<{ name: string; mime: string; dataUrl: string } | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // نمونه socket — idempotent (getChatSocket در هر فراخوانی همان نمونه را می‌دهد)
  const socket = getChatSocket(user);

  // اتصال به سوکت — لزومی نیست socket را در state نگه داریم؛ getChatSocket
  // در هر فراخوانی همان نمونه را می‌دهد.
  useEffect(() => {
    if (!user) return;
    if (user.role === "GUEST") return; // مهمان‌ها به چت دسترسی ندارند
    if (!socket) return;
    const s = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHello = (payload: { online: ChatProfile[] }) => setOnline(payload.online ?? []);
    const onPresence = (payload: { online: ChatProfile[] }) => setOnline(payload.online ?? []);
    // اتاق‌های من از سرور (DB-backed) — سایدبار بین نشست‌ها پر می‌ماند
    const onRooms = (payload: { rooms: ChatRoomMembership[] }) => {
      const list = payload.rooms ?? [];
      if (list.length === 0) return;
      setRoomStates((prev) => {
        const next = { ...prev };
        for (const item of list) {
          const existing = next[item.room.id];
          next[item.room.id] = {
            room: item.room,
            lastMessage: item.lastMessage ?? existing?.lastMessage,
            unread: existing?.unread ?? 0,
          };
        }
        return next;
      });
    };
    const onRoomJoined = (payload: { room: ChatRoom; history: ChatMessage[] }) => {
      setRoomStates((prev) => ({
        ...prev,
        [payload.room.id]: {
          ...(prev[payload.room.id] ?? { room: payload.room, unread: 0 }),
          room: payload.room,
        },
      }));
      setMessages((prev) => ({ ...prev, [payload.room.id]: payload.history ?? [] }));
      // هر اتاقی که ما به آن join می‌شویم (DM یا گروه) → فعال می‌شود
      if (user) setActiveRoomId(payload.room.id);
    };
    const onRoomMembers = (payload: { room: ChatRoom }) => {
      setRoomStates((prev) =>
        prev[payload.room.id]
          ? { ...prev, [payload.room.id]: { ...prev[payload.room.id], room: payload.room } }
          : { ...prev, [payload.room.id]: { room: payload.room, unread: 0 } },
      );
    };
    const onRoomInvited = (payload: { room: ChatRoom }) => {
      setRoomStates((prev) =>
        prev[payload.room.id] ?? { ...prev, [payload.room.id]: { room: payload.room, unread: 0 } },
      );
    };
    const onRoomCreated = (payload: { room: ChatRoom }) => {
      // فقط اگر عضو هستیم نگه دار
      const me = user.id;
      if (payload.room.members.some((m) => m.userId === me)) {
        setRoomStates((prev) =>
          prev[payload.room.id] ?? { ...prev, [payload.room.id]: { room: payload.room, unread: 0 } },
        );
      }
    };
    const onMessageNew = (msg: ChatMessage) => {
      setMessages((prev) => ({
        ...prev,
        [msg.roomId]: [...(prev[msg.roomId] ?? []), msg],
      }));
      setRoomStates((prev) => {
        const existing = prev[msg.roomId];
        // اگر پیام در اتاق فعال می‌رسد، unread را صفر نگه می‌داریم
        const isActive = msg.roomId === activeRoomId;
        return {
          ...prev,
          [msg.roomId]: {
            room: existing?.room ?? { id: msg.roomId, name: msg.author.name, kind: "dm", members: [] },
            lastMessage: msg,
            unread: isActive ? 0 : (existing?.unread ?? 0) + 1,
          },
        };
      });
    };
    const onTyping = (payload: { roomId: string; userId: string; name: string; isTyping: boolean }) => {
      setTyping((prev) => ({
        ...prev,
        [payload.roomId]: payload.isTyping ? { name: payload.name } : null,
      }));
    };
    const onError = (payload: { error: string }) => setError(payload.error);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("hello", onHello);
    s.on("presence", onPresence);
    s.on("rooms", onRooms);
    s.on("room:joined", onRoomJoined);
    s.on("room:members", onRoomMembers);
    s.on("room:invited", onRoomInvited);
    s.on("room:created", onRoomCreated);
    s.on("message:new", onMessageNew);
    s.on("typing", onTyping);
    s.on("error", onError);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("hello", onHello);
      s.off("presence", onPresence);
      s.off("rooms", onRooms);
      s.off("room:joined", onRoomJoined);
      s.off("room:members", onRoomMembers);
      s.off("room:invited", onRoomInvited);
      s.off("room:created", onRoomCreated);
      s.off("message:new", onMessageNew);
      s.off("typing", onTyping);
      s.off("error", onError);
    };
  }, [user?.id, activeRoomId]);

  // پاک‌سازی هنگام unmount
  useEffect(() => {
    return () => {
      disconnectChat();
    };
  }, []);

  // گرفتن لیست همکاران
  useEffect(() => {
    if (!user || user.role === "GUEST") return;
    api
      .get<{ peers: SafeUser[] }>("/api/chat/peers")
      .then((r) => setPeers(r.peers ?? []))
      .catch(() => setPeers([]));
  }, [user?.id, user?.role]);

  // اسکرول به پایین وقتی پیام جدید می‌رسد — فقط side-effect روی DOM.
  // نمی‌خواهیم state را در effect تغییر دهیم (قاعده‌ی react-hooks/set-state-in-effect).
  // reset unread وقتی اتاق فعال می‌شود، در click handlerهای openDm/openGroup انجام می‌شود.
  useEffect(() => {
    if (!activeRoomId) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeRoomId, messages[activeRoomId ?? ""]?.length]);

  const openDm = (peer: SafeUser) => {
    if (!socket || !user) return;
    const roomId = dmRoomId(user.id, peer.id);
    setActiveRoomId(roomId);
    setRoomStates((prev) =>
      prev[roomId]
        ? { ...prev, [roomId]: { ...prev[roomId], unread: 0 } }
        : prev,
    );
    socket.emit("room:join", { roomId, peerId: peer.id });
    setDraft("");
    setPendingFile(null);
  };

  const openGroup = (room: ChatRoom) => {
    if (!socket) return;
    setActiveRoomId(room.id);
    setRoomStates((prev) =>
      prev[room.id]
        ? { ...prev, [room.id]: { ...prev[room.id], unread: 0 } }
        : prev,
    );
    socket.emit("room:join", { roomId: room.id });
    setDraft("");
    setPendingFile(null);
  };

  const sendText = () => {
    if (!socket || !activeRoomId) return;
    const text = draft.trim();
    if (!text) return;
    socket.emit("message:send", { roomId: activeRoomId, type: "text", text });
    setDraft("");
    socket.emit("typing", { roomId: activeRoomId, isTyping: false });
  };

  const sendFile = () => {
    if (!socket || !activeRoomId || !pendingFile) return;
    socket.emit("message:send", {
      roomId: activeRoomId,
      type: "file",
      file: { name: pendingFile.name, mime: pendingFile.mime, size: 0, dataUrl: pendingFile.dataUrl },
    });
    setPendingFile(null);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("حجم فایل بیش از ۵ مگابایت است");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setPendingFile({ name: f.name, mime: f.type, dataUrl });
    };
    reader.onerror = () => setError("خواندن فایل ناموفق بود");
    reader.readAsDataURL(f);
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (!socket || !activeRoomId) return;
    socket.emit("typing", { roomId: activeRoomId, isTyping: v.length > 0 });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("typing", { roomId: activeRoomId, isTyping: false });
    }, 1800);
  };

  const activeRoom = activeRoomId ? roomStates[activeRoomId]?.room : null;
  const activeMessages = activeRoomId ? messages[activeRoomId] ?? [] : [];
  const activeTyping = activeRoomId ? typing[activeRoomId] : null;

  // ساخت لیست DMها: آخرین پیام هر اتاق dm:*
  const dmList = useMemo(() => {
    return Object.values(roomStates)
      .filter((r) => r.room.kind === "dm")
      .sort((a, b) => {
        const ta = a.lastMessage?.createdAt ?? "";
        const tb = b.lastMessage?.createdAt ?? "";
        return tb.localeCompare(ta);
      });
  }, [roomStates]);

  const groupList = useMemo(() => {
    return Object.values(roomStates)
      .filter((r) => r.room.kind === "group")
      .sort((a, b) => {
        const ta = a.lastMessage?.createdAt ?? "";
        const tb = b.lastMessage?.createdAt ?? "";
        return tb.localeCompare(ta);
      });
  }, [roomStates]);

  if (user?.role === "GUEST") {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-20 text-center" aria-label="چت سیبک">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-chart-4/15 text-chart-4">
          <MessageSquarePlus className="size-8" aria-hidden />
        </div>
        <h2 className="text-xl font-black">دسترسی محدود</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          اعضای مهمان به فضای چت دسترسی ندارند. برای فعال‌سازی، با ادمین سایت در میان بگذارید.
        </p>
        <Button variant="outline" onClick={() => navigate("home")}>
          بازگشت به خانه
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label="چت سیبک">
      {/* هدر */}
      <div className="glass card-hover relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div className="pointer-events-none absolute -top-12 -left-12 size-40 rounded-full bg-chart-1/15 blur-3xl" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-chart-1/15 text-primary">
              <MessageSquarePlus className="size-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-3xl">چت</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                گفت‌وگوی زنده با همکاران، گروه‌ها و اشتراک فایل
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs">
              <span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              {connected ? "متصل" : "در حال اتصال..."}
            </span>
            <Button size="sm" onClick={() => setShowCreateGroup(true)} className="gap-1.5">
              <UsersIcon className="size-4" aria-hidden />
              گروه جدید
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass flex items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="rounded-lg p-1 hover:bg-destructive/10">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* بدنه دو ستونه */}
      <div className="glass grid grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-[320px_1fr]">
        {/* سایدبار لیست گفت‌وگوها — در موبایل فقط وقتی اتاقی فعال نیست */}
        <div className={cn("border-l border-border/60", activeRoomId && "hidden md:block")}>
          <ConversationList
            user={user}
            peers={peers}
            online={online}
            dmList={dmList}
            groupList={groupList}
            activeRoomId={activeRoomId}
            onPickPeer={openDm}
            onPickRoom={openGroup}
            onCreateGroup={() => setShowCreateGroup(true)}
          />
        </div>

        {/* ناحیه اصلی پیام‌ها */}
        <div className={cn("flex min-h-[60vh] flex-col", !activeRoomId && "hidden md:flex")}>
          {activeRoom && user ? (
            <>
              {/* هدر اتاق */}
              <div className="flex items-center justify-between gap-3 border-b border-border/60 p-3 md:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setActiveRoomId(null)}
                    className="flex size-9 items-center justify-center rounded-xl bg-secondary/60 hover:bg-secondary md:hidden"
                    aria-label="بازگشت به لیست"
                  >
                    <ArrowRight className="size-5" aria-hidden />
                  </button>
                  {activeRoom.kind === "dm" ? (
                    (() => {
                      const other = activeRoom.members.find((m) => m.userId !== user.id) ??
                        (peers.find((p) => p.id !== user.id) as unknown as ChatProfile | undefined);
                      const isOnline = other && online.some((o) => o.userId === other.userId);
                      const name = other?.name ?? "کاربر";
                      return (
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-chart-1/15 text-primary text-xs font-bold">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{name}</p>
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className={cn("size-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                              {isOnline ? "آنلاین" : "آفلاین"}
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-chart-2/15 text-accent-foreground">
                        <UsersIcon className="size-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{activeRoom.name ?? "گروه"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {activeRoom.members.length} عضو
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {activeRoom.kind === "group" && (
                  <Badge variant="outline" className="gap-1">
                    <UsersIcon className="size-3" aria-hidden />
                    گروه
                  </Badge>
                )}
              </div>

              {/* لیست پیام‌ها */}
              <ScrollArea className="flex-1 p-3 md:p-4">
                <div className="flex flex-col gap-2.5">
                  {activeMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                      <MessageSquarePlus className="size-8 opacity-40" aria-hidden />
                      <p className="text-sm">هنوز پیامی رد و بدل نشده — اولین پیام را شما بزنید!</p>
                    </div>
                  )}
                  {activeMessages.map((m) => (
                    <MessageBubble key={m.id} msg={m} mine={m.author.userId === user.id} />
                  ))}
                  {activeTyping && (
                    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                      <span className="flex gap-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
                      </span>
                      {activeTyping.name} در حال تایپ...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* پیش‌نمایش فایل انتخاب‌شده */}
              {pendingFile && (
                <div className="flex items-center gap-2 border-t border-border/60 bg-secondary/30 p-2">
                  {isImageMime(pendingFile.mime) ? (
                    <img src={fileUrl(pendingFile.name, pendingFile.dataUrl)} alt={pendingFile.name} className="size-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-xs font-bold">
                      {pendingFile.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{pendingFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">آماده ارسال</p>
                  </div>
                  <button
                    onClick={() => setPendingFile(null)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="لغو فایل"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                  <Button size="sm" onClick={sendFile} className="gap-1.5">
                    <Send className="size-3.5" aria-hidden />
                    ارسال
                  </Button>
                </div>
              )}

              {/* نوار ورودی */}
              <div className="flex items-end gap-2 border-t border-border/60 p-2.5 md:p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={onPickFile}
                  accept="image/*,application/pdf,text/*,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="پیوست فایل"
                  disabled={!connected}
                >
                  <Paperclip className="size-4" aria-hidden />
                </Button>
                <textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                  placeholder="پیام خود را بنویسید..."
                  rows={1}
                  disabled={!connected}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                />
                <Button
                  onClick={sendText}
                  disabled={!connected || !draft.trim()}
                  className="shrink-0 gap-1.5"
                  aria-label="ارسال پیام"
                >
                  <Send className="size-4" aria-hidden />
                  <span className="hidden sm:inline">ارسال</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <MessageSquarePlus className="size-12 opacity-30" aria-hidden />
              <p className="text-sm">یک گفت‌وگو از لیست کناری انتخاب کنید تا چت را شروع کنید.</p>
              {!connected && (
                <p className="flex items-center gap-1.5 text-xs">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  در حال اتصال به سرور چت...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateGroupDialog
        key={`cg-${showCreateGroup}`}
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        peers={peers}
        onCreate={(name, memberIds) => {
          if (!socket || !user) return;
          socket.emit("room:create", { name, memberIds });
          // سرور با room:created پاسخ می‌دهد؛ اگر اتاق active نشد، یکی از
          // اتاق‌های اخیر را active کن. به‌هرحال دیالوگ بسته می‌شود.
          setShowCreateGroup(false);
        }}
      />
    </section>
  );
}

/** رندر یک پیام — متن یا فایل. */
function MessageBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      <div className={cn("flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground", mine && "flex-row-reverse")}>
        <span className="font-bold">{mine ? "شما" : msg.author.name}</span>
        <span>•</span>
        <span>{fmtTime(msg.createdAt)}</span>
      </div>
      {msg.type === "text" ? (
        <div
          className={cn(
            "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6",
            mine ? "rounded-bl-md bg-primary text-primary-foreground" : "rounded-br-md bg-secondary text-secondary-foreground",
          )}
        >
          {msg.text}
        </div>
      ) : msg.file ? (
        <div
          className={cn(
            "max-w-[78%] overflow-hidden rounded-2xl",
            mine ? "rounded-bl-md bg-primary/10" : "rounded-br-md bg-secondary/60",
          )}
        >
          {isImageMime(msg.file.mime) ? (
            <a href={msg.file.dataUrl} download={msg.file.name} target="_blank" rel="noreferrer">
              <img src={msg.file.dataUrl} alt={msg.file.name} className="max-h-64 w-full cursor-zoom-in object-contain" />
            </a>
          ) : (
            <a
              href={msg.file.dataUrl}
              download={msg.file.name}
              className="flex items-center gap-2.5 p-3 text-sm hover:bg-secondary/80"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chart-2/15 text-accent-foreground">
                <Paperclip className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold">{msg.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(msg.file.size / 1024).toFixed(1)} کیلوبایت — برای دانلود کلیک کنید
                </p>
              </div>
            </a>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
