import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@fun/db";
import { getSession } from "@/lib/session";

const preferencesSchema = z
  .object({
    language: z.enum(["ru", "en"]).default("ru"),
    humorEnabled: z.boolean().default(true),
    contentAmount: z.enum(["light", "normal", "full"]).default("normal"),
    myNewspaperEnabled: z.boolean().default(false),
  })
  .strict();

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await prisma().userPreference.findUnique({ where: { userId: session.id } });
  return NextResponse.json({
    preferences: prefs ?? {
      language: session.language,
      humorEnabled: true,
      contentAmount: "normal",
      myNewspaperEnabled: false,
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  }

  const preferences = await prisma().userPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...parsed.data },
    update: { ...parsed.data },
  });

  return NextResponse.json({ ok: true, preferences });
}