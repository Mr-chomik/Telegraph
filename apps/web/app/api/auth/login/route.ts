import { NextResponse } from "next/server";
import { prisma } from "@fun/db";
import { loginSchema, parseJsonBody } from "@/lib/validators";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { rateLimiter, requestKey, authRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request): Promise<Response> {
  const ip = requestKey(new Headers(request.headers));
  if (!rateLimiter.allow(`login:${ip}`, authRateLimit(), 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseJsonBody(body, loginSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const user = await prisma().user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}