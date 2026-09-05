/**
 * تبدیل‌دهنده مشترک Poll به DTO — توسط polls/route.ts و polls/[id]/route.ts مصرف می‌شود.
 * این فایل فقط سمت سرور است.
 */
import { db } from "@/lib/db";
import { toSafeUser } from "@/lib/types";

/** فیلدهای کاربر امن (مشترک در همه کوئری‌ها). */
export const USER_SAFE_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  status: true,
  joinReason: true,
  skills: true,
  bio: true,
  avatar: true,
  points: true,
  rejectionNote: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** فیلدهای Poll که در تبدیل DTO لازم است. */
export interface PollDTOInput {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  isAnonymous: boolean;
  closesAt: Date | null;
  createdAt: Date;
  createdById: string;
  groupId: string | null;
  targetUserId: string | null;
  vetoAmount: number | null;
}

/**
 * تبدیل یک رکورد Poll خام به پاسخ DTO کامل (برای کلاینت).
 * - createdBy/group/targetUser به‌صورت SafeUser تبدیل می‌شوند.
 * - options شامل votesCount و (در صورت نبودن رأی مخفی) voters است.
 * - myVote و granted و totalVotes محاسبه می‌شوند.
 */
export async function toPollDTO(
  poll: PollDTOInput,
  viewerId: string | null,
) {
  const isVeto = poll.type === "VETO_GRANT" && poll.targetUserId;
  const [creator, group, optionsRaw, votes, myVote, grantLedger, targetUser] =
    await Promise.all([
      db.user.findUnique({
        where: { id: poll.createdById },
        select: USER_SAFE_SELECT,
      }),
      poll.groupId
        ? db.group.findUnique({
            where: { id: poll.groupId },
            select: { id: true, name: true, slug: true, color: true },
          })
        : Promise.resolve(null),
      db.pollOption.findMany({
        where: { pollId: poll.id },
        select: {
          id: true,
          text: true,
          votes: { select: { user: { select: USER_SAFE_SELECT } } },
        },
      }),
      db.pollVote.count({ where: { pollId: poll.id } }),
      viewerId
        ? db.pollVote.findUnique({
            where: { pollId_userId: { pollId: poll.id, userId: viewerId } },
            select: { optionId: true },
          })
        : Promise.resolve(null),
      isVeto && poll.status === "CLOSED"
        ? db.vetoLedger.findFirst({
            where: { sourcePollId: poll.id, delta: { gt: 0 } },
            select: { id: true },
          })
        : Promise.resolve(null),
      isVeto
        ? db.user.findUnique({
            where: { id: poll.targetUserId! },
            select: USER_SAFE_SELECT,
          })
        : Promise.resolve(null),
    ]);

  const showVoters = !poll.isAnonymous;

  const options = optionsRaw.map((opt) => ({
    id: opt.id,
    text: opt.text,
    votesCount: opt.votes.length,
    voters: showVoters ? opt.votes.map((v) => toSafeUser(v.user)) : [],
  }));

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    type: poll.type,
    status: poll.status,
    isAnonymous: poll.isAnonymous,
    closesAt: poll.closesAt ? poll.closesAt.toISOString() : null,
    createdAt: poll.createdAt.toISOString(),
    createdBy: creator ? toSafeUser(creator) : null,
    group: group
      ? { id: group.id, name: group.name, slug: group.slug, color: group.color }
      : null,
    options,
    totalVotes: votes,
    myVote: myVote ? { optionId: myVote.optionId } : null,
    targetUser: isVeto && targetUser ? toSafeUser(targetUser) : null,
    vetoAmount: poll.type === "VETO_GRANT" ? poll.vetoAmount : null,
    granted: !!grantLedger,
  };
}
