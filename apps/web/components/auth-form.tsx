"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (isRegister) payload.name = String(form.get("name") ?? "");

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="client-card space-y-4 p-6">
      {isRegister && (
        <div>
          <label htmlFor="name" className="font-ui mb-1 block text-sm text-ink-soft">
            Name
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className="font-ui mb-1 block text-sm text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="font-ui mb-1 block text-sm text-ink-soft">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={isRegister ? 8 : undefined}
          className="font-ui w-full border border-rule bg-paper px-3 py-2 text-ink focus:border-accent"
        />
        {isRegister && (
          <p className="font-ui mt-1 text-xs text-ink-faint">At least 8 characters.</p>
        )}
      </div>

      {error && (
        <p role="alert" className="font-ui border-l-2 border-accent bg-paper-dim px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className={clsx(
          "font-ui w-full bg-ink px-4 py-2.5 font-bold uppercase tracking-widest text-paper transition-colors",
          "hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="font-ui text-center text-sm text-ink-soft">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link className="font-bold text-accent underline decoration-accent-soft underline-offset-2" href="/login">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New reader?{" "}
            <Link className="font-bold text-accent underline decoration-accent-soft underline-offset-2" href="/register">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}