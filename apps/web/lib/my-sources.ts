import "server-only";
import { prisma } from "@telegraph/db";

export const DEFAULT_WEIGHT = 5;

export interface MySource {
  id: string;
  telegramUsername: string;
  title: string | null;
  status: string;
  categoryKey: string | null;
  postCount: number;
  weight: number;
  enabled: boolean;
  mine: boolean;
}

// First visit: materialize a subscription row for every enabled channel so the
// digest defaults to "all sources, medium weight" and the UI has something to edit.
export async function ensureSubscriptions(userId: string): Promise<void> {
  const existing = await prisma().channelSubscription.count({ where: { userId } });
  if (existing > 0) return;
  const channels = await prisma().channel.findMany({
    where: { enabled: true },
    select: { id: true },
  });
  if (channels.length === 0) return;
  await prisma().channelSubscription.createMany({
    data: channels.map((c) => ({ userId, channelId: c.id, weight: DEFAULT_WEIGHT, enabled: true })),
    skipDuplicates: true,
  });
}

export async function getMySources(userId: string): Promise<MySource[]> {
  const db = prisma();
  await ensureSubscriptions(userId);

  const [channels, subscriptions] = await Promise.all([
    db.channel.findMany({
      orderBy: [{ priority: "asc" }, { title: "asc" }],
      include: { category: true, _count: { select: { posts: true } } },
    }),
    db.channelSubscription.findMany({ where: { userId } }),
  ]);

  const subByChannel = new Map(subscriptions.map((s) => [s.channelId, s]));
  return channels.map((c) => {
    const sub = subByChannel.get(c.id);
    return {
      id: c.id,
      telegramUsername: c.telegramUsername,
      title: c.title,
      status: c.status,
      categoryKey: c.category?.key ?? null,
      postCount: c._count.posts,
      weight: sub?.weight ?? DEFAULT_WEIGHT,
      enabled: sub?.enabled ?? true,
      mine: c.ownerUserId === userId,
    };
  });
}