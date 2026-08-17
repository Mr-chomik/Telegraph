import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="space-y-6">
      <header className="border-b border-rule pb-3">
        <h1 className="font-ui text-lg font-bold uppercase tracking-[0.2em] text-ink">Editor&apos;s desk</h1>
        <p className="font-ui text-sm text-ink-soft">Administration &amp; moderation</p>
      </header>
      {children}
    </div>
  );
}