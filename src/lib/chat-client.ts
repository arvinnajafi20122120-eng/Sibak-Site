"use client";

import { io, type Socket } from "socket.io-client";

import type { SafeUser } from "@/lib/types";
import { getAuthToken } from "@/lib/session-token";

export type ChatRole =
  | "ADMIN"
  | "MANAGER"
  | "TEACHER"
  | "MEMBER";

export interface ChatProfile {
  userId: string;
  username: string;
  name: string;
  avatar: string | null;
  role: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  author: ChatProfile;
  type: "text" | "file";
  text?: string;
  file?: {
    name: string;
    size: number;
    mime: string;
    dataUrl: string;
  };
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  kind: "dm" | "group";
  members: ChatProfile[];
}

export interface ChatRoomMembership {
  room: ChatRoom;
  /** آخرین پیام اتاق — برای مرتب‌سازی سایدبار بین نشست‌ها */
  lastMessage: ChatMessage | null;
}

let socket: Socket | null = null;

export function getChatSocket(
  user: SafeUser | null,
): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!user) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    return null;
  }

  if (socket) {
    return socket;
  }

  const profile: ChatProfile = {
    userId: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
  };

  const chatUrl =
    process.env.NEXT_PUBLIC_CHAT_URL;

  const socketOptions = {
    transports: [
      "websocket",
      "polling",
    ] as const,

    // اتصال مجدد بی‌نهایت — اگر سرویس چت موقتاً بالا نبود، به‌محض بالا آمدن
    // وصل می‌شود (قبلاً بعد از ۸ تلاش برای همیشه رها می‌شد)
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 8000,
    timeout: 12000,

    auth: async (
      callback: (auth: {
        token: string;
        profile: ChatProfile;
      }) => void,
    ) => {
      let token = getAuthToken();

      if (!token) {
        try {
          const response = await fetch(
            "/api/chat/token",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            },
          );

          if (response.ok) {
            const data =
              (await response.json()) as {
                token?: string;
              };

            token = data.token ?? null;
          }
        } catch {
          token = null;
        }
      }

      if (!token) {
        console.warn(
          "[chat] authentication token not available",
        );

        callback({
          token: "",
          profile,
        });

        return;
      }

      callback({
        token,
        profile,
      });
    },
  };

  if (chatUrl && chatUrl.trim()) {
    socket = io(
      chatUrl.trim(),
      socketOptions,
    );
  } else {
    socket = io(
      "/?XTransformPort=3003",
      socketOptions,
    );
  }

  return socket;
}

export function disconnectChat() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function dmRoomId(
  a: string,
  b: string,
): string {
  const [x, y] = [a, b].sort();
  return `dm:${x}__${y}`;
}