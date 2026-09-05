"use client";

import { useEffect } from "react";
import { Users } from "lucide-react";

import { useHashRoute } from "@/components/app/router";
import { GroupList } from "@/components/app/sections/groups/group-list";
import { GroupDetail } from "@/components/app/sections/groups/group-detail";

/**
 * سکشن زیرمجموعه‌ها — بر اساس segments[1] بین فهرست و جزئیات جابه‌جا می‌شود.
 * هش‌های پشتیبانی‌شده: #/groups (فهرست) و #/groups/<id> (جزئیات).
 */
export default function GroupsSection() {
  const { segments, navigate } = useHashRoute();
  const id = segments[1];

  // اگر id وجود دارد ولی طولش ناقص است (مثلاً کاربر هش #/groups/ را تایپ کرده)، برگرد
  useEffect(() => {
    if (segments.length > 1 && !id) {
      navigate("/groups");
    }
  }, [segments.length, id, navigate]);

  if (id) {
    return (
      <GroupDetail id={id} onBack={() => navigate("/groups")} />
    );
  }

  return (
    <GroupList onOpenDetail={(gid) => navigate(`/groups/${gid}`)} />
  );
}

void Users; // (icon kept for future badges)
