import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const NAV = [
  { href: "/", label: "Latest" },
  { href: "/mypaper", label: "My Paper" },
  { href: "/archive", label: "Archive" },
  { href: "/sources", label: "Sources" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-svh">
      <nav className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="font-ui shrink-0 text-sm font-bold uppercase tracking-[0.2em] text-ink">
            The Daily News
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-ui px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            {session.role === "ADMIN" && (
              <Link
                href="/admin"
                className="font-ui px-3 py-1.5 text-sm font-bold text-accent transition-colors hover:bg-paper-dim"
              >
                Admin
              </Link>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-ui hidden text-xs text-ink-faint md:block">
              {session.name ?? session.email}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="font-ui border border-rule px-2.5 py-1 text-xs uppercase tracking-wider text-ink-soft transition-colors hover:border-rule-dark hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}