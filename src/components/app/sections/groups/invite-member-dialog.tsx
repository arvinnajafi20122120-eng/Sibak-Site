"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPicker } from "@/components/app/sections/_shared/user-picker";
import type { SafeUser } from "@/lib/types";

/**
 * دیالوگ دعوت/افزودن عضو به گروه.
 */
export function InviteMemberDialog({
  groupId,
  open,
  onClose,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/groups/${groupId}/members`, { userId }),
    onSuccess: () => {
      toast.success("عضو اضافه شد");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در افزودن عضو"),
    onSettled: () => setSubmitting(false),
  });

  function handleSelect(u: SafeUser) {
    setSubmitting(true);
    addMutation.mutate(u.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
            <UserPlus className="size-4 text-primary" aria-hidden />
            دعوت عضو به گروه
          </DialogTitle>
        </DialogHeader>
        <UserPicker groupId={groupId} onSelect={handleSelect} />
        <DialogFooter className="mt-1">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={onClose}
          >
            بستن
          </Button>
          {submitting && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
