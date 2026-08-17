import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";
import { DEFAULT_WEIGHT, getMySources } from "@/lib/my-sources";

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channels = await getMySources(session.id);
  return NextResponse.json({ channels });
}

const putSchema = z.object({
  channels: z
    .array(
      z.object({
        channelId: z.string().min(1),
        weight: z.number().int().min(1).max(10).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function PUT(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription input" }, { status: 400 });
  }

  const db = prisma();
  for (const item of parsed.data.channels) {
    const existing = await db.channel.findUnique({ where: { id: item.channelId } });
    if (!existing) continue;
    await db.channelSubscription.upsert({
      where: { userId_channelId: { userId: session.id, channelId: item.channelId } },
      update: {
        ...(item.weight !== undefined ? { weight: item.weight } : {}),
        ...(item.enabled !== undefined ? { enabled: item.enabled } : {}),
      },
      create: {
        userId: session.id,
        channelId: item.channelId,
        weight: item.weight ?? DEFAULT_WEIGHT,
        enabled: item.enabled ?? true,
      },
    });
  }

  return NextResponse.json({ ok: true });
}