import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";

const updateSchema = z.object({
  categoryId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  }

  const existing = await prisma().channel.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  const channel = await prisma().channel.update({ where: { id }, data, include: { category: true } });
  return NextResponse.json({ channel });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma().channel.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  // Editors may remove any channel; a user may remove channels they added.
  const isOwner = existing.ownerUserId === session.id;
  if (session.role !== "ADMIN" && !isOwner) {
    return NextResponse.json({ error: "Only editors (or the channel's owner) may remove it" }, { status: 403 });
  }

  await prisma().channel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}