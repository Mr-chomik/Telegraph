import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@fun/db";
import { fetchChannelPreview, normalizeTelegramUsername } from "@fun/core";
import { getSession } from "@/lib/session";
import { rateLimiter, requestKey } from "@/lib/rate-limit";

const addChannelSchema = z.object({
  username: z.string().min(1).max(128),
  categoryKey: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channels = await prisma().channel.findMany({
    orderBy: [{ priority: "asc" }, { title: "asc" }],
    include: { category: true },
  });
  return NextResponse.json({ channels });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = requestKey(request.headers);
  if (!rateLimiter.allow(`channel-add:${ip}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many channels added recently" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = addChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid channel input" }, { status: 400 });
  }

  const username = normalizeTelegramUsername(parsed.data.username);
  if (!username) {
    return NextResponse.json(
      { error: "Invalid channel name. Use something like @example_channel or t.me/example_channel" },
      { status: 400 },
    );
  }

  const existing = await prisma().channel.findUnique({ where: { telegramUsername: username } });
  if (existing) {
    return NextResponse.json({ error: "This channel is already in the list" }, { status: 409 });
  }

  // Best-effort preview metadata; authoritative MTProto validation happens in the worker.
  const preview = await fetchChannelPreview(username).catch(() => null);
  let categoryId: string | null = null;
  if (parsed.data.categoryKey) {
    const category = await prisma().category.findUnique({ where: { key: parsed.data.categoryKey } });
    categoryId = category?.id ?? null;
  }

  const channel = await prisma().channel.create({
    data: {
      telegramUsername: username,
      title: (preview?.exists ? preview.title : null) ?? username,
      description: preview?.exists ? preview.description || null : null,
      avatarUrl: preview?.avatarUrl ?? null,
      status: "VALIDATING",
      enabled: true,
      priority: parsed.data.priority ?? 5,
      categoryId,
      ownerUserId: session.id,
    },
    include: { category: true },
  });

  // The user who adds a source subscribes to it with a high weight automatically.
  await prisma().channelSubscription.upsert({
    where: { userId_channelId: { userId: session.id, channelId: channel.id } },
    update: { weight: 8, enabled: true },
    create: { userId: session.id, channelId: channel.id, weight: 8, enabled: true },
  });

  return NextResponse.json({ channel }, { status: 201 });
}