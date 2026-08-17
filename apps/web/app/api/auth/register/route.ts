import { NextResponse } from "next/server";
import { prisma } from "@fun/db";
import { getEnv } from "@fun/core";
import { registerSchema, parseJsonBody, type RegisterInput } from "@/lib/validators";
import { hashPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { rateLimiter, requestKey, authRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<Response> {
  const ip = requestKey(new Headers(request.headers));
  if (!rateLimiter.allow(`register:${ip}`, authRateLimit(), 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseJsonBody(body, registerSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const input: RegisterInput = parsed.data;

  const existing = await prisma().user.findUnique({ where: { email: input.email } });
  if (existing) {
    return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  const adminEmails = getEnv().adminEmails;
  const user = await prisma().user.create({
    data: {
      email: input.email,
      name: input.name || null,
      passwordHash,
      role: adminEmails.includes(input.email) ? "ADMIN" : "USER",
    },
  });

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role } },
    { status: 201 },
  );
}