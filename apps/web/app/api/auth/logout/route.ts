import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(): Promise<Response> {
  await destroySession();
  const res = NextResponse.redirect(new URL("/login", requestUrl()));
  res.cookies.delete("fun_session");
  return res;
}

function requestUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}