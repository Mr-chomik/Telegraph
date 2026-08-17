import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@telegraph/db";

export const SESSION_COOKIE = "telegraph_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  language: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma().session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma().session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const record = await prisma().session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { preferences: { select: { language: true } } } } },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) return null;

  const { user } = record;
  const language = user.preferences?.language || user.language || "ru";
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    language,
  };
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}